"""Shared test fixtures — plain dicts so they can be sent over HTTP
unchanged and also passed straight to validate_document()."""

from __future__ import annotations

from copy import deepcopy
from typing import Any


def mlp_document() -> dict[str, Any]:
    """Valid 4-layer MLP: 784 → 128 → ReLU → 10 → Output(10)."""
    return {
        "schemaVersion": 1,
        "name": "MLP classifier",
        "nodes": [
            {"id": "in", "type": "input", "position": {"x": 0, "y": 0}, "params": {"features": 784}},
            {"id": "l1", "type": "linear", "position": {"x": 0, "y": 100}, "params": {"out_features": 128, "bias": True}},
            {"id": "r1", "type": "relu", "position": {"x": 0, "y": 200}, "params": {}},
            {"id": "l2", "type": "linear", "position": {"x": 0, "y": 300}, "params": {"out_features": 10, "bias": True}},
            {"id": "out", "type": "output", "position": {"x": 0, "y": 400}, "params": {"classes": 10}},
        ],
        "edges": [
            {"id": "e1", "source": "in", "target": "l1"},
            {"id": "e2", "source": "l1", "target": "r1"},
            {"id": "e3", "source": "r1", "target": "l2"},
            {"id": "e4", "source": "l2", "target": "out"},
        ],
    }


def binary_document() -> dict[str, Any]:
    """Valid small tanh network: 20 → 32 → Tanh → 16 → Sigmoid → 1 → Output(1)."""
    return {
        "schemaVersion": 1,
        "name": "Binary classifier",
        "nodes": [
            {"id": "in", "type": "input", "position": {"x": 0, "y": 0}, "params": {"features": 20}},
            {"id": "l1", "type": "linear", "position": {"x": 0, "y": 100}, "params": {"out_features": 32, "bias": True}},
            {"id": "t1", "type": "tanh", "position": {"x": 0, "y": 200}, "params": {}},
            {"id": "l2", "type": "linear", "position": {"x": 0, "y": 300}, "params": {"out_features": 16, "bias": True}},
            {"id": "s1", "type": "sigmoid", "position": {"x": 0, "y": 400}, "params": {}},
            {"id": "l3", "type": "linear", "position": {"x": 0, "y": 500}, "params": {"out_features": 1, "bias": True}},
            {"id": "out", "type": "output", "position": {"x": 0, "y": 600}, "params": {"classes": 1}},
        ],
        "edges": [
            {"id": "e1", "source": "in", "target": "l1"},
            {"id": "e2", "source": "l1", "target": "t1"},
            {"id": "e3", "source": "t1", "target": "l2"},
            {"id": "e4", "source": "l2", "target": "s1"},
            {"id": "e5", "source": "s1", "target": "l3"},
            {"id": "e6", "source": "l3", "target": "out"},
        ],
    }


def identity_document() -> dict[str, Any]:
    """Valid minimal graph: input(10) → output(10), no layers."""
    return {
        "schemaVersion": 1,
        "name": "Identity",
        "nodes": [
            {"id": "in", "type": "input", "position": {"x": 0, "y": 0}, "params": {"features": 10}},
            {"id": "out", "type": "output", "position": {"x": 0, "y": 100}, "params": {"classes": 10}},
        ],
        "edges": [{"id": "e1", "source": "in", "target": "out"}],
    }


def flatten_document() -> dict[str, Any]:
    """Valid graph exercising Flatten: input(784) → flatten → output(784)."""
    return {
        "schemaVersion": 1,
        "name": "Flatten passthrough",
        "nodes": [
            {"id": "in", "type": "input", "position": {"x": 0, "y": 0}, "params": {"features": 784}},
            {"id": "f", "type": "flatten", "position": {"x": 0, "y": 100}, "params": {}},
            {"id": "out", "type": "output", "position": {"x": 0, "y": 200}, "params": {"classes": 784}},
        ],
        "edges": [
            {"id": "e1", "source": "in", "target": "f"},
            {"id": "e2", "source": "f", "target": "out"},
        ],
    }


def dropout_document() -> dict[str, Any]:
    """Valid graph with Dropout."""
    return {
        "schemaVersion": 1,
        "name": "Dropout net",
        "nodes": [
            {"id": "in", "type": "input", "position": {"x": 0, "y": 0}, "params": {"features": 32}},
            {"id": "l1", "type": "linear", "position": {"x": 0, "y": 100}, "params": {"out_features": 16, "bias": True}},
            {"id": "d1", "type": "dropout", "position": {"x": 0, "y": 200}, "params": {"p": 0.25}},
            {"id": "l2", "type": "linear", "position": {"x": 0, "y": 300}, "params": {"out_features": 4, "bias": False}},
            {"id": "out", "type": "output", "position": {"x": 0, "y": 400}, "params": {"classes": 4}},
        ],
        "edges": [
            {"id": "e1", "source": "in", "target": "l1"},
            {"id": "e2", "source": "l1", "target": "d1"},
            {"id": "e3", "source": "d1", "target": "l2"},
            {"id": "e4", "source": "l2", "target": "out"},
        ],
    }


# ---------------------------------------------------------------------------
# Invalid fixtures
# ---------------------------------------------------------------------------


def _clone(d: dict[str, Any]) -> dict[str, Any]:
    return deepcopy(d)


def invalid_no_input() -> dict[str, Any]:
    doc = _clone(mlp_document())
    doc["nodes"] = [n for n in doc["nodes"] if n["type"] != "input"]
    doc["edges"] = [e for e in doc["edges"] if e["source"] != "in"]
    return doc


def invalid_two_inputs() -> dict[str, Any]:
    doc = _clone(mlp_document())
    doc["nodes"].append(
        {"id": "in2", "type": "input", "position": {"x": 100, "y": 0}, "params": {"features": 10}}
    )
    return doc


def invalid_no_output() -> dict[str, Any]:
    doc = _clone(mlp_document())
    doc["nodes"] = [n for n in doc["nodes"] if n["type"] != "output"]
    doc["edges"] = [e for e in doc["edges"] if e["target"] != "out"]
    return doc


def invalid_branching() -> dict[str, Any]:
    """Two outgoing edges from the same Linear node."""
    doc = _clone(mlp_document())
    doc["nodes"].append(
        {"id": "extra", "type": "relu", "position": {"x": 200, "y": 100}, "params": {}}
    )
    doc["edges"].append({"id": "e_extra", "source": "l1", "target": "extra"})
    return doc


def invalid_output_size_mismatch() -> dict[str, Any]:
    """Output.classes (5) ≠ incoming Linear.out_features (10)."""
    doc = _clone(mlp_document())
    doc["nodes"][-1]["params"]["classes"] = 5
    return doc


def invalid_linear_out_features() -> dict[str, Any]:
    """Linear.out_features = 0 fails min=1."""
    doc = _clone(mlp_document())
    doc["nodes"][1]["params"]["out_features"] = 0
    return doc


def invalid_unknown_param() -> dict[str, Any]:
    doc = _clone(mlp_document())
    doc["nodes"][1]["params"]["nonsense"] = 5
    return doc


def invalid_dangling_edge() -> dict[str, Any]:
    doc = _clone(mlp_document())
    doc["edges"].append({"id": "e_ghost", "source": "l1", "target": "ghost"})
    return doc


def invalid_schema_version() -> dict[str, Any]:
    doc = _clone(mlp_document())
    doc["schemaVersion"] = 99
    return doc


def invalid_unknown_node_type() -> dict[str, Any]:
    doc = _clone(mlp_document())
    doc["nodes"].append(
        {"id": "conv", "type": "conv2d", "position": {"x": 0, "y": 0}, "params": {}}
    )
    return doc


def invalid_disconnected_node() -> dict[str, Any]:
    doc = _clone(mlp_document())
    doc["nodes"].append(
        {"id": "orphan", "type": "relu", "position": {"x": 300, "y": 300}, "params": {}}
    )
    return doc
