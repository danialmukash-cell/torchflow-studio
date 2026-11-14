mod codegen;
mod graph;

use axum::{
    extract::rejection::JsonRejection,
    http::{header::CONTENT_TYPE, HeaderValue, Method, StatusCode},
    routing::{get, post},
    Json, Router,
};
use graph::{Graph, Issue, Validation};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{env, net::SocketAddr};
use tower_http::cors::CorsLayer;

const DEFAULT_ORIGINS: &str = "http://localhost:5173,http://127.0.0.1:5173";
type BadRequest = (StatusCode, Json<Value>);

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Request {
    document: Graph,
    #[serde(default = "default_class_name")]
    class_name: String,
}

#[derive(Deserialize)]
struct ValidateRequest {
    document: Graph,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Generation {
    valid: bool,
    errors: Vec<Issue>,
    code: Option<String>,
    class_name: Option<String>,
}

fn default_class_name() -> String {
    "TorchFlowModel".into()
}

fn bad_request(status: StatusCode, detail: String) -> BadRequest {
    (status, Json(json!({"detail": detail})))
}

fn decode<T>(body: Result<Json<T>, JsonRejection>) -> Result<T, BadRequest> {
    body.map(|Json(request)| request).map_err(|err| {
        let status = match err {
            JsonRejection::JsonSyntaxError(_) | JsonRejection::JsonDataError(_) => {
                StatusCode::UNPROCESSABLE_ENTITY
            }
            _ => err.status(),
        };
        bad_request(status, err.body_text())
    })
}

async fn health() -> Json<Value> {
    Json(json!({"status": "ok", "version": env!("CARGO_PKG_VERSION")}))
}

async fn validate(
    body: Result<Json<ValidateRequest>, JsonRejection>,
) -> Result<Json<Validation>, BadRequest> {
    let graph = decode(body)?.document;
    graph
        .check_schema()
        .map_err(|err| bad_request(StatusCode::UNPROCESSABLE_ENTITY, err))?;
    Ok(Json(graph.analyze().validation))
}

async fn generate(
    body: Result<Json<Request>, JsonRejection>,
) -> Result<Json<Generation>, BadRequest> {
    let Request {
        document,
        class_name,
    } = decode(body)?;
    document
        .check_schema()
        .map_err(|err| bad_request(StatusCode::UNPROCESSABLE_ENTITY, err))?;
    let analysis = document.analyze();
    let (code, class_name, errors) = if analysis.validation.valid {
        match codegen::generate(&document.name, &analysis.layers, &class_name) {
            Ok(code) => (Some(code), Some(class_name), vec![]),
            Err(message) => (None, None, vec![Issue::new("codegen_error", message)]),
        }
    } else {
        (None, None, analysis.validation.errors)
    };
    Ok(Json(Generation {
        valid: errors.is_empty(),
        errors,
        code,
        class_name,
    }))
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let address: SocketAddr = env::var("TORCHFLOW_BIND")
        .unwrap_or_else(|_| "127.0.0.1:8000".into())
        .parse()?;
    let origins = env::var("TORCHFLOW_CORS_ORIGINS").unwrap_or_else(|_| DEFAULT_ORIGINS.into());
    let origins = origins
        .split(',')
        .map(str::trim)
        .filter(|origin| !origin.is_empty())
        .map(str::parse::<HeaderValue>)
        .collect::<Result<Vec<_>, _>>()?;
    let app = Router::new()
        .route("/api/health", get(health))
        .route("/api/validate", post(validate))
        .route("/api/generate", post(generate))
        .layer(
            CorsLayer::new()
                .allow_origin(origins)
                .allow_methods([Method::GET, Method::POST])
                .allow_headers([CONTENT_TYPE]),
        );
    let listener = tokio::net::TcpListener::bind(address).await?;
    eprintln!(
        "TorchFlow Studio listening on http://{}",
        listener.local_addr()?
    );
    axum::serve(listener, app).await?;
    Ok(())
}
