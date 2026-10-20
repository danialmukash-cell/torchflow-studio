"""Pydantic request/response schemas.

`GraphDocument` intentionally mirrors the TypeScript type in
frontend/src/types/graph.ts. The JSON schema is v1 and MUST remain
backwards-compatible with documents saved by Milestone 1.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator

from .node_specs import NODE_TYPE_IDS

NodeTypeId = str  # validated against NODE_TYPE_IDS in GraphNode

SUPPORTED_SCHEMA_VERSION = 1


class Vec2(BaseModel):
    x: float
    y: float


class GraphNode(BaseModel):
    id: str = Field(min_length=1)
    type: NodeTypeId
    position: Vec2
    params: dict[str, Any] = Field(default_factory=dict)

    @field_validator("type")
    @classmethod
    def _check_type(cls, value: str) -> str:
        if value not in NODE_TYPE_IDS:
            raise ValueError(
                f'Node type "{value}" is not supported. '
                f"Allowed: {', '.join(NODE_TYPE_IDS)}."
            )
        return value


class GraphEdge(BaseModel):
    id: str = Field(min_length=1)
    source: str = Field(min_length=1)
    target: str = Field(min_length=1)


class GraphDocument(BaseModel):
    schemaVersion: int
    name: str = Field(default="Untitled network")
    nodes: list[GraphNode] = Field(default_factory=list)
    edges: list[GraphEdge] = Field(default_factory=list)

    @field_validator("schemaVersion")
    @classmethod
    def _check_version(cls, value: int) -> int:
        if value != SUPPORTED_SCHEMA_VERSION:
            raise ValueError(
                f"Unsupported schemaVersion {value}. "
                f"This backend supports schemaVersion {SUPPORTED_SCHEMA_VERSION}."
            )
        return value


class ValidationIssue(BaseModel):
    code: str
    message: str
    nodeId: str | None = None
    edgeId: str | None = None


class ValidateRequest(BaseModel):
    document: GraphDocument


class ValidateResponse(BaseModel):
    valid: bool
    errors: list[ValidationIssue]
    # nodeId -> inferred output shape, only for nodes whose shape was
    # successfully inferred. Nodes involved in errors are omitted.
    shapes: dict[str, list[int]]
    # nodeId -> first error message, for canvas badging.
    nodeErrors: dict[str, str]


class GenerateRequest(BaseModel):
    document: GraphDocument
    className: str = "TorchFlowModel"


class GenerateResponse(BaseModel):
    valid: bool
    errors: list[ValidationIssue]
    code: str | None = None
    className: str | None = None


class HealthResponse(BaseModel):
    status: str
    version: str
