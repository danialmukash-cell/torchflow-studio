"""Graph validation and shape inference.

Two phases with different error contracts:

  Phase 1 (structure + params) — no shape inference if this fails.
  Phase 2 (shape inference)    — only on a structurally sound graph.

Both phases are pure functions of the input document. No global state,
no memoisation, no ordering dependence beyond the document itself.
"""

from __future__ import annotations

from typing import Iterable
import math

from .node_specs import NODE_SPECS, NodeSpec
from .schemas import GraphDocument, GraphEdge, GraphNode, ValidationIssue

# ---------------------------------------------------------------------------
# Parameter validation
# ---------------------------------------------------------------------------


def _coerce_and_check(spec_param, value: object) -> tuple[bool, object, str | None]:
    """Return (ok, coerced_value, error). Enforces the declared kind and range."""
    kind = spec_param.kind

    if kind == "boolean":
        if not isinstance(value, bool):
            return False, value, f"must be a boolean, got {type(value).__name__}"
        return True, value, None

    if kind == "int":
        if isinstance(value, bool) or not isinstance(value, int):
            return False, value, f"must be an integer, got {type(value).__name__}"
        if spec_param.min is not None and value < spec_param.min:
            return False, value, f"must be >= {spec_param.min}"
        if spec_param.max is not None and value > spec_param.max:
            return False, value, f"must be <= {spec_param.max}"
        return True, value, None

    if kind == "float":
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            return False, value, f"must be a number, got {type(value).__name__}"
        fv = float(value)
        if not math.isfinite(fv):
            return False, value, "must be a finite number"
        if spec_param.min is not None and fv < spec_param.min:
            return False, value, f"must be >= {spec_param.min}"
        if spec_param.max is not None and fv > spec_param.max:
            return False, value, f"must be <= {spec_param.max}"
        return True, fv, None

    # 'select' is reserved for future use; not used by current node types.
    if isinstance(value, str):
        return True, value, None
    return False, value, f"must be a string, got {type(value).__name__}"


def validate_all_params(doc: GraphDocument) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []

    for node in doc.nodes:
        spec = NODE_SPECS[node.type]
        allowed = {p.key for p in spec.params}

        for unknown in node.params:
            if unknown not in allowed:
                issues.append(
                    ValidationIssue(
                        code="unknown_param",
                        message=(
                            f'Node "{node.id}" ({node.type}): '
                            f'unknown parameter "{unknown}".'
                        ),
                        nodeId=node.id,
                    )
                )

        for param_spec in spec.params:
            raw = node.params.get(param_spec.key, param_spec.default)
            ok, _coerced, error = _coerce_and_check(param_spec, raw)
            if not ok:
                issues.append(
                    ValidationIssue(
                        code="invalid_param",
                        message=(
                            f'Node "{node.id}" ({node.type}): '
                            f'parameter "{param_spec.key}" {error}.'
                        ),
                        nodeId=node.id,
                    )
                )

    return issues


# ---------------------------------------------------------------------------
# Structural validation
# ---------------------------------------------------------------------------


def _build_indexes(
    doc: GraphDocument,
) -> tuple[dict[str, GraphNode], list[ValidationIssue], dict[str, list[GraphEdge]], dict[str, list[GraphEdge]]]:
    issues: list[ValidationIssue] = []

    by_id: dict[str, GraphNode] = {}
    for node in doc.nodes:
        if node.id in by_id:
            issues.append(
                ValidationIssue(
                    code="duplicate_node_id",
                    message=f'Duplicate node id "{node.id}".',
                    nodeId=node.id,
                )
            )
        else:
            by_id[node.id] = node

    outgoing: dict[str, list[GraphEdge]] = {node_id: [] for node_id in by_id}
    incoming: dict[str, list[GraphEdge]] = {node_id: [] for node_id in by_id}
    seen_edge_ids: set[str] = set()

    for edge in doc.edges:
        if edge.id in seen_edge_ids:
            issues.append(
                ValidationIssue(
                    code="duplicate_edge_id",
                    message=f'Duplicate edge id "{edge.id}".',
                    edgeId=edge.id,
                )
            )
            continue
        seen_edge_ids.add(edge.id)

        if edge.source not in by_id:
            issues.append(
                ValidationIssue(
                    code="dangling_edge",
                    message=f'Edge "{edge.id}" points from nonexistent node "{edge.source}".',
                    edgeId=edge.id,
                )
            )
            continue
        if edge.target not in by_id:
            issues.append(
                ValidationIssue(
                    code="dangling_edge",
                    message=f'Edge "{edge.id}" points to nonexistent node "{edge.target}".',
                    edgeId=edge.id,
                )
            )
            continue
        if edge.source == edge.target:
            issues.append(
                ValidationIssue(
                    code="self_loop",
                    message=f'Edge "{edge.id}" connects node "{edge.source}" to itself.',
                    edgeId=edge.id,
                )
            )
            continue

        outgoing[edge.source].append(edge)
        incoming[edge.target].append(edge)

    return by_id, issues, outgoing, incoming


def _check_input_output_counts(
    by_id: dict[str, GraphNode],
) -> tuple[GraphNode | None, GraphNode | None, list[ValidationIssue]]:
    issues: list[ValidationIssue] = []
    inputs = [n for n in by_id.values() if n.type == "input"]
    outputs = [n for n in by_id.values() if n.type == "output"]

    if len(inputs) == 0:
        issues.append(
            ValidationIssue(
                code="missing_input",
                message="Graph must contain exactly one Input node.",
            )
        )
    elif len(inputs) > 1:
        issues.append(
            ValidationIssue(
                code="multiple_inputs",
                message=f"Graph has {len(inputs)} Input nodes; exactly one is required.",
            )
        )

    if len(outputs) == 0:
        issues.append(
            ValidationIssue(
                code="missing_output",
                message="Graph must contain exactly one Output node.",
            )
        )
    elif len(outputs) > 1:
        issues.append(
            ValidationIssue(
                code="multiple_outputs",
                message=f"Graph has {len(outputs)} Output nodes; exactly one is required.",
            )
        )

    input_node = inputs[0] if len(inputs) == 1 else None
    output_node = outputs[0] if len(outputs) == 1 else None
    return input_node, output_node, issues


def _check_degrees(
    by_id: dict[str, GraphNode],
    incoming: dict[str, list[GraphEdge]],
    outgoing: dict[str, list[GraphEdge]],
) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []

    for node_id, node in by_id.items():
        spec = NODE_SPECS[node.type]

        if not spec.allow_incoming and incoming[node_id]:
            issues.append(
                ValidationIssue(
                    code="invalid_connection",
                    message=(
                        f'Node "{node_id}" ({node.type}) cannot have incoming connections, '
                        f"but has {len(incoming[node_id])}."
                    ),
                    nodeId=node_id,
                )
            )

        if not spec.allow_outgoing and outgoing[node_id]:
            issues.append(
                ValidationIssue(
                    code="invalid_connection",
                    message=(
                        f'Node "{node_id}" ({node.type}) cannot have outgoing connections, '
                        f"but has {len(outgoing[node_id])}."
                    ),
                    nodeId=node_id,
                )
            )

        if len(incoming[node_id]) > 1:
            issues.append(
                ValidationIssue(
                    code="branching",
                    message=(
                        f'Node "{node_id}" has {len(incoming[node_id])} incoming edges. '
                        "Milestone 1/2 support sequential single-path graphs only."
                    ),
                    nodeId=node_id,
                )
            )

        if len(outgoing[node_id]) > 1:
            issues.append(
                ValidationIssue(
                    code="branching",
                    message=(
                        f'Node "{node_id}" has {len(outgoing[node_id])} outgoing edges. '
                        "Milestone 1/2 support sequential single-path graphs only."
                    ),
                    nodeId=node_id,
                )
            )

    return issues


def _walk_chain(
    input_node: GraphNode | None,
    output_node: GraphNode | None,
    by_id: dict[str, GraphNode],
    outgoing: dict[str, list[GraphEdge]],
) -> list[ValidationIssue]:
    """Follow the single outgoing edge from input until we reach output.

    With degree checks already passed, this proves the graph is a single
    connected chain covering every node.
    """
    if input_node is None or output_node is None:
        return []  # count errors already reported

    issues: list[ValidationIssue] = []
    visited: list[str] = []
    current = input_node
    seen: set[str] = set()

    while True:
        if current.id in seen:
            issues.append(
                ValidationIssue(
                    code="cycle",
                    message=f'Cycle detected involving node "{current.id}".',
                    nodeId=current.id,
                )
            )
            return issues
        seen.add(current.id)
        visited.append(current.id)

        if current.type == "output":
            break

        next_edges = outgoing[current.id]
        if not next_edges:
            issues.append(
                ValidationIssue(
                    code="broken_chain",
                    message=(
                        f'Node "{current.id}" ({current.type}) has no outgoing edge '
                        "but is not the Output node."
                    ),
                    nodeId=current.id,
                )
            )
            return issues

        next_id = next_edges[0].target
        if next_id not in by_id:
            # Already reported by dangling_edge, avoid double-reporting.
            return issues
        current = by_id[next_id]

    if current.id != output_node.id:
        issues.append(
            ValidationIssue(
                code="broken_chain",
                message=(
                    f'The chain from Input reaches "{current.id}" '
                    f'(type {current.type}), not the Output node.'
                ),
                nodeId=current.id,
            )
        )
        return issues

    if len(visited) != len(by_id):
        missing = set(by_id) - set(visited)
        issues.append(
            ValidationIssue(
                code="disconnected_nodes",
                message=(
                    "These nodes are not reachable from the Input node: "
                    + ", ".join(sorted(missing))
                    + "."
                ),
            )
        )

    return issues


def validate_structure(doc: GraphDocument) -> list[ValidationIssue]:
    if not doc.nodes:
        return [
            ValidationIssue(
                code="empty_graph",
                message="Graph has no nodes.",
            )
        ]

    by_id, issues, outgoing, incoming = _build_indexes(doc)
    input_node, output_node, count_issues = _check_input_output_counts(by_id)
    issues.extend(count_issues)

    if not any(i.code in {"duplicate_node_id", "dangling_edge", "self_loop"} for i in issues):
        issues.extend(_check_degrees(by_id, incoming, outgoing))

    # Only walk if the degree structure is sound: a walk on a branching
    # graph produces confusing duplicate errors.
    if not issues and input_node and output_node:
        issues.extend(_walk_chain(input_node, output_node, by_id, outgoing))

    return issues


# ---------------------------------------------------------------------------
# Shape inference
# ---------------------------------------------------------------------------


class ShapeError(Exception):
    """Raised by _apply_shape when a node cannot consume the incoming shape."""


def _apply_shape(node: GraphNode, input_shape: tuple[int, ...]) -> tuple[int, ...]:
    spec: NodeSpec = NODE_SPECS[node.type]

    if node.type == "input":
        return (int(node.params.get("features", spec.params[0].default)),)

    if node.type == "output":
        if len(input_shape) != 1:
            raise ShapeError(
                f"Output expects a 1-D incoming shape, got {list(input_shape)}."
            )
        classes = int(node.params.get("classes", spec.params[0].default))
        if input_shape[0] != classes:
            raise ShapeError(
                f"Output declares {classes} classes but the incoming shape is "
                f"[{input_shape[0]}]. Make the previous Linear layer's "
                f"out_features equal to {classes}, or change this Output node's "
                f"classes to {input_shape[0]}."
            )
        return input_shape

    if node.type == "linear":
        if len(input_shape) != 1:
            raise ShapeError(
                f"Linear expects a 1-D incoming shape, got {list(input_shape)}. "
                "Insert a Flatten node before this Linear."
            )
        return (int(node.params.get("out_features", spec.params[0].default)),)

    if node.type in {"relu", "sigmoid", "tanh", "dropout"}:
        if len(input_shape) < 1:
            raise ShapeError("Activation and dropout need a non-empty input shape.")
        return input_shape

    if node.type == "flatten":
        if len(input_shape) < 1:
            raise ShapeError("Flatten needs a non-empty input shape.")
        product = 1
        for dim in input_shape:
            product *= dim
        return (product,)

    raise ShapeError(f"Unknown node type {node.type}.")  # pragma: no cover


def infer_shapes(
    doc: GraphDocument,
) -> tuple[list[ValidationIssue], dict[str, list[int]]]:
    """Walk the chain from input, inferring shapes. Assumes structure is valid."""
    issues: list[ValidationIssue] = []
    shapes: dict[str, list[int]] = {}

    by_id = {n.id: n for n in doc.nodes}
    input_node = next(n for n in doc.nodes if n.type == "input")
    outgoing = {n.id: [] for n in doc.nodes}
    for edge in doc.edges:
        outgoing[edge.source].append(edge)

    current = input_node
    current_shape = _apply_shape(current, ())
    shapes[current.id] = list(current_shape)

    while current.type != "output":
        next_edges = outgoing[current.id]
        if not next_edges:  # pragma: no cover - structure check prevents this
            break
        current = by_id[next_edges[0].target]
        try:
            current_shape = _apply_shape(current, current_shape)
        except ShapeError as exc:
            issues.append(
                ValidationIssue(
                    code="shape_error",
                    message=f'Node "{current.id}" ({current.type}): {exc}',
                    nodeId=current.id,
                )
            )
            return issues, shapes
        shapes[current.id] = list(current_shape)

    return issues, shapes


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


def validate_document(
    doc: GraphDocument,
) -> tuple[list[ValidationIssue], dict[str, list[int]], dict[str, str]]:
    """Return (errors, shapes, nodeErrors). Shapes are only populated for
    nodes whose shape inference succeeded."""
    param_issues = validate_all_params(doc)
    if param_issues:
        return param_issues, {}, _node_error_map(param_issues)

    structural_issues = validate_structure(doc)
    if structural_issues:
        return structural_issues, {}, _node_error_map(structural_issues)

    shape_issues, shapes = infer_shapes(doc)
    return shape_issues, shapes, _node_error_map(shape_issues)


def _node_error_map(issues: Iterable[ValidationIssue]) -> dict[str, str]:
    out: dict[str, str] = {}
    for issue in issues:
        if issue.nodeId and issue.nodeId not in out:
            out[issue.nodeId] = issue.message
    return out
