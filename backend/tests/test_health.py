from app.main import VERSION


def test_health_returns_ok_and_version(client) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["version"] == VERSION


def test_cors_accepts_local_editor_origin(client) -> None:
    origin = "http://127.0.0.1:5173"
    response = client.options("/api/generate", headers={
        "Origin": origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    })
    assert response.is_success
    assert response.headers["access-control-allow-origin"] == origin
