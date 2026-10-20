"""Mirror of frontend/src/graph/nodeRegistry.ts.

This is the single source of truth for node types, their parameters,
and their allowed connection degrees on the Python side. Keep it in
sync with the TypeScript registry when adding a node type.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

ParamKind = Literal["int", "float", "boolean", "select"]


@dataclass(frozen=True)
class ParamSpec:
    key: str
    kind: ParamKind
    default: object
    min: float | None = None
    max: float | None = None


@dataclass(frozen=True)
class NodeSpec:
    type: str
    params: tuple[ParamSpec, ...]
    allow_incoming: bool
    allow_outgoing: bool


NODE_SPECS: dict[str, NodeSpec] = {
    "input": NodeSpec(
        type="input",
        params=(ParamSpec("features", "int", 784, min=1),),
        allow_incoming=False,
        allow_outgoing=True,
    ),
    "linear": NodeSpec(
        type="linear",
        params=(
            ParamSpec("out_features", "int", 128, min=1),
            ParamSpec("bias", "boolean", True),
        ),
        allow_incoming=True,
        allow_outgoing=True,
    ),
    "relu": NodeSpec(type="relu", params=(), allow_incoming=True, allow_outgoing=True),
    "sigmoid": NodeSpec(
        type="sigmoid", params=(), allow_incoming=True, allow_outgoing=True
    ),
    "tanh": NodeSpec(type="tanh", params=(), allow_incoming=True, allow_outgoing=True),
    "flatten": NodeSpec(
        type="flatten", params=(), allow_incoming=True, allow_outgoing=True
    ),
    "dropout": NodeSpec(
        type="dropout",
        params=(ParamSpec("p", "float", 0.5, min=0.0, max=0.99),),
        allow_incoming=True,
        allow_outgoing=True,
    ),
    "output": NodeSpec(
        type="output",
        params=(ParamSpec("classes", "int", 10, min=1),),
        allow_incoming=True,
        allow_outgoing=False,
    ),
}

NODE_TYPE_IDS: tuple[str, ...] = tuple(NODE_SPECS.keys())
