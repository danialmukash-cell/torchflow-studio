"""The load-bearing Milestone 2 test.

Compiles the generated code, instantiates the model on CPU, runs a
forward pass, and asserts the output shape. This is the only place
generated code is executed — the server never executes it.

Skipped automatically if torch is not installed.
"""

from __future__ import annotations

import pytest

torch = pytest.importorskip("torch")

from app.generator import generate_code  # noqa: E402
from app.schemas import GraphDocument  # noqa: E402
from app.validation import validate_document  # noqa: E402

from . import fixtures as fx  # noqa: E402


def _build_and_load(document_dict: dict) -> type:
    """Validate, generate, compile, and return the generated class."""
    doc = GraphDocument(**document_dict)
    errors, shapes, _ = validate_document(doc)
    assert errors == [], f"unexpected validation errors: {errors}"
    code = generate_code(doc, shapes, class_name="ModelUnderTest")
    namespace: dict[str, object] = {}
    exec(compile(code, "<generated>", "exec"), namespace)  # noqa: S102 — test only
    return namespace["ModelUnderTest"]  # type: ignore[return-value]


def _forward_shape(document_dict: dict, input_shape: tuple[int, ...]) -> torch.Size:
    torch.manual_seed(0)
    model_cls = _build_and_load(document_dict)
    model = model_cls()
    model.eval()
    x = torch.randn(*input_shape)
    with torch.no_grad():
        y = model(x)
    return y.shape


def test_mlp_forward_pass_matches_declared_output() -> None:
    output = _forward_shape(fx.mlp_document(), (4, 784))
    assert output == (4, 10)


def test_binary_forward_pass() -> None:
    output = _forward_shape(fx.binary_document(), (8, 20))
    assert output == (8, 1)


def test_identity_forward_pass() -> None:
    output = _forward_shape(fx.identity_document(), (3, 10))
    assert output == (3, 10)


def test_flatten_forward_pass() -> None:
    output = _forward_shape(fx.flatten_document(), (2, 784))
    assert output == (2, 784)


def test_dropout_forward_pass_in_eval_mode() -> None:
    """In eval() mode, dropout is disabled, so output must be deterministic."""
    torch.manual_seed(0)
    model_cls = _build_and_load(fx.dropout_document())
    model = model_cls().eval()
    x = torch.randn(2, 32)
    with torch.no_grad():
        y1 = model(x)
        y2 = model(x)
    assert torch.equal(y1, y2)
    assert y1.shape == (2, 4)


def test_generated_model_has_correct_linear_in_features() -> None:
    """Indirectly verified via the forward pass, but assert the parameter
    shapes too — this is what a bad in_features inference would break."""
    model_cls = _build_and_load(fx.mlp_document())
    model = model_cls()
    first_linear = model.layer_1  # type: ignore[attr-defined]
    assert isinstance(first_linear, torch.nn.Linear)
    assert first_linear.in_features == 784
    assert first_linear.out_features == 128
