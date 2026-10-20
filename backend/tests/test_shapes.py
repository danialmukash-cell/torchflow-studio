"""Direct tests of infer_shapes, separate from the HTTP layer."""

from app.schemas import GraphDocument
from app.validation import infer_shapes, validate_structure

from . import fixtures as fx


def _as_doc(raw: dict) -> GraphDocument:
    return GraphDocument(**raw)


def test_mlp_shape_chain() -> None:
    doc = _as_doc(fx.mlp_document())
    assert validate_structure(doc) == []
    errors, shapes = infer_shapes(doc)
    assert errors == []
    assert shapes == {
        "in": [784],
        "l1": [128],
        "r1": [128],
        "l2": [10],
        "out": [10],
    }


def test_flatten_shape_collapses_multidim() -> None:
    # Hand-build a graph whose input is multi-dim by (mis)using features.
    # Currently every node is 1-D, so Flatten is effectively identity.
    # This test guards against Flatten accidentally changing 1-D shapes.
    doc = _as_doc(fx.flatten_document())
    errors, shapes = infer_shapes(doc)
    assert errors == []
    assert shapes["f"] == [784]


def test_output_size_mismatch_reports_node() -> None:
    doc = _as_doc(fx.invalid_output_size_mismatch())
    errors, shapes = infer_shapes(doc)
    assert len(errors) == 1
    assert errors[0].code == "shape_error"
    assert errors[0].nodeId == "out"
    # Shapes up to the failure point are still returned for display.
    assert "l2" in shapes


def test_linear_requires_1d_input() -> None:
    """Guard rail: if a future node type ever produces 2-D shapes,
    Linear must refuse to consume them."""
    from app.schemas import GraphNode
    from app.validation import ShapeError, _apply_shape

    node = GraphNode(
        id="l",
        type="linear",
        position={"x": 0, "y": 0},
        params={"out_features": 4, "bias": True},
    )
    import pytest

    with pytest.raises(ShapeError):
        _apply_shape(node, (2, 3))
