"""Tests that do NOT require torch — they assert on the emitted text."""

import pytest

from . import fixtures as fx


def _post_generate(client, document: dict, class_name: str = "TorchFlowModel") -> dict:
    response = client.post(
        "/api/generate",
        json={"document": document, "className": class_name},
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_mlp_generates_expected_lines(client) -> None:
    body = _post_generate(client, fx.mlp_document())
    assert body["valid"] is True
    code = body["code"]
    assert code is not None
    assert f"class {body['className']}(nn.Module):" in code
    assert "self.layer_1 = nn.Linear(784, 128, bias=True)" in code
    assert "self.layer_2 = nn.ReLU()" in code
    assert "self.layer_3 = nn.Linear(128, 10, bias=True)" in code
    # forward order
    first = code.index("x = self.layer_1(x)")
    second = code.index("x = self.layer_2(x)")
    third = code.index("x = self.layer_3(x)")
    assert first < second < third
    assert "return x" in code


def test_dropout_and_bias_false_are_emitted(client) -> None:
    body = _post_generate(client, fx.dropout_document())
    assert body["valid"] is True
    code = body["code"]
    assert "nn.Dropout(p=0.25)" in code
    assert "bias=False" in code


def test_identity_graph_generates_identity_forward(client) -> None:
    body = _post_generate(client, fx.identity_document())
    assert body["valid"] is True
    code = body["code"]
    assert "def forward(self, x):\n        return x" in code
    assert "nn.Linear" not in code
    assert "        pass\n" in code


def test_invalid_graph_returns_errors_and_no_code(client) -> None:
    body = _post_generate(client, fx.invalid_no_input())
    assert body["valid"] is False
    assert body["code"] is None
    assert any(issue["code"] == "missing_input" for issue in body["errors"])


@pytest.mark.parametrize("bad_name", ["1abc", "class", "has space", "with-dash"])
def test_invalid_class_name_is_rejected(client, bad_name: str) -> None:
    body = _post_generate(client, fx.mlp_document(), class_name=bad_name)
    assert body["valid"] is False
    assert body["code"] is None
    assert body["errors"][0]["code"] == "codegen_error"


def test_custom_class_name_is_used(client) -> None:
    body = _post_generate(client, fx.mlp_document(), class_name="MyNet")
    assert body["valid"] is True
    assert "class MyNet(nn.Module):" in body["code"]


def test_generated_code_handles_untrusted_graph_names_safely(client) -> None:
    doc = fx.mlp_document()
    doc["name"] = '"""\nraise Exception("unsafe")\n"""'
    body = _post_generate(client, doc)
    assert body["valid"] is True
    compile(body["code"], "<generated>", "exec")
    assert '\nraise Exception' not in body["code"]


def test_default_optional_params_do_not_crash_codegen(client) -> None:
    doc = fx.mlp_document()
    doc["nodes"][1]["params"] = {}
    body = _post_generate(client, doc)
    assert body["valid"] is True
    assert 'nn.Linear(784, 128, bias=True)' in body["code"]
