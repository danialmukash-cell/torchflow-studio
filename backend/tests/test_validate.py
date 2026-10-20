import pytest
from fastapi.testclient import TestClient

from app.main import app

from . import fixtures as fx

client = TestClient(app)


def _post(document: dict) -> dict:
    response = client.post("/api/validate", json={"document": document})
    assert response.status_code == 200, response.text
    return response.json()


# --- valid graphs ---


@pytest.mark.parametrize(
    "builder",
    [
        fx.mlp_document,
        fx.binary_document,
        fx.identity_document,
        fx.flatten_document,
        fx.dropout_document,
    ],
)
def test_valid_documents(builder) -> None:
    body = _post(builder())
    assert body["valid"] is True, body["errors"]
    assert body["errors"] == []
    assert body["nodeErrors"] == {}
    assert len(body["shapes"]) > 0


def test_mlp_shapes_are_correct() -> None:
    body = _post(fx.mlp_document())
    assert body["shapes"]["in"] == [784]
    assert body["shapes"]["l1"] == [128]
    assert body["shapes"]["r1"] == [128]
    assert body["shapes"]["l2"] == [10]
    assert body["shapes"]["out"] == [10]


def test_identity_document_shape() -> None:
    body = _post(fx.identity_document())
    assert body["shapes"]["in"] == [10]
    assert body["shapes"]["out"] == [10]


# --- invalid graphs ---


@pytest.mark.parametrize(
    "builder, expected_code",
    [
        (fx.invalid_no_input, "missing_input"),
        (fx.invalid_two_inputs, "multiple_inputs"),
        (fx.invalid_no_output, "missing_output"),
        (fx.invalid_output_size_mismatch, "shape_error"),
        (fx.invalid_dangling_edge, "dangling_edge"),
        (fx.invalid_disconnected_node, "disconnected_nodes"),
    ],
)
def test_invalid_documents_have_expected_error_code(builder, expected_code) -> None:
    body = _post(builder())
    assert body["valid"] is False
    codes = [issue["code"] for issue in body["errors"]]
    assert expected_code in codes, codes


def test_branching_is_rejected() -> None:
    body = _post(fx.invalid_branching())
    assert body["valid"] is False
    assert any(issue["code"] == "branching" for issue in body["errors"])


def test_out_of_range_param_is_rejected() -> None:
    body = _post(fx.invalid_linear_out_features())
    assert body["valid"] is False
    assert any(issue["code"] == "invalid_param" for issue in body["errors"])
    assert "l1" in body["nodeErrors"]


def test_unknown_param_is_rejected() -> None:
    body = _post(fx.invalid_unknown_param())
    assert body["valid"] is False
    assert any(issue["code"] == "unknown_param" for issue in body["errors"])


def test_unsupported_schema_version_returns_422() -> None:
    response = client.post("/api/validate", json={"document": fx.invalid_schema_version()})
    assert response.status_code == 422
    body = response.json()
    assert "schemaVersion" in str(body)


def test_unknown_node_type_returns_422() -> None:
    response = client.post("/api/validate", json={"document": fx.invalid_unknown_node_type()})
    assert response.status_code == 422
    body = response.json()
    assert "conv2d" in str(body) or "not supported" in str(body)


def test_node_errors_map_uses_first_error_per_node() -> None:
    body = _post(fx.invalid_branching())
    assert body["valid"] is False
    assert "l1" in body["nodeErrors"]
