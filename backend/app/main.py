"""FastAPI application.

Three endpoints, all pure functions of their request:

  GET  /api/health    — liveness probe
  POST /api/validate  — structural validation + shape inference
  POST /api/generate  — validation + deterministic PyTorch code

The server never executes generated code and never accepts code as
input. See generator.py for the security rationale.
"""

from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .generator import generate_code
from .schemas import (
    GenerateRequest,
    GenerateResponse,
    HealthResponse,
    ValidateRequest,
    ValidateResponse,
    ValidationIssue,
)
from .validation import ShapeError, validate_document

VERSION = "0.2.0"

DEFAULT_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"


def _cors_origins() -> list[str]:
    raw = os.environ.get("TORCHFLOW_CORS_ORIGINS", DEFAULT_ORIGINS)
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


app = FastAPI(title="TorchFlow Studio", version=VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.get("/api/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", version=VERSION)


@app.post("/api/validate", response_model=ValidateResponse)
def validate(req: ValidateRequest) -> ValidateResponse:
    errors, shapes, node_errors = validate_document(req.document)
    return ValidateResponse(
        valid=not errors,
        errors=errors,
        shapes=shapes,
        nodeErrors=node_errors,
    )


@app.post("/api/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest) -> GenerateResponse:
    errors, shapes, _ = validate_document(req.document)
    if errors:
        return GenerateResponse(valid=False, errors=errors)

    try:
        code = generate_code(req.document, shapes, req.className)
    except ShapeError as exc:
        return GenerateResponse(
            valid=False,
            errors=[ValidationIssue(code="codegen_error", message=str(exc))],
        )

    return GenerateResponse(valid=True, errors=[], code=code, className=req.className)
