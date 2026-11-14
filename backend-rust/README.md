# TorchFlow Studio Rust backend

Run `cargo run --locked` from this directory. The server listens on
`127.0.0.1:8000` by default and serves the editor's graph schema v1.

| Endpoint | Input | Output |
| --- | --- | --- |
| `GET /api/health` | — | Status and version |
| `POST /api/validate` | `{ "document": … }` | `valid`, `errors`, `shapes`, `nodeErrors` |
| `POST /api/generate` | `{ "document": …, "className": "MyModel" }` | `valid`, `errors`, `code`, `className` |

`className` defaults to `TorchFlowModel`. It must be a normalized Python
identifier and cannot shadow the generated module's `nn` or `torch` imports.
Malformed JSON or invalid graph schemas return HTTP 422 with a `detail` string;
well-formed graphs with invalid connections or parameters return HTTP 200 with
`valid: false` and issue codes. Sizes are positive signed 64-bit integers.

Set `TORCHFLOW_BIND` to change the socket address. Set
`TORCHFLOW_CORS_ORIGINS` to a comma-separated list of editor origins. The default
permits Vite on `localhost:5173` and `127.0.0.1:5173`. The Python reference server
in `backend/` provides the old Swagger UI; the Rust server exposes the three API
routes above.

The server parses the existing graph format, validates parameters and the single
path, infers each node's feature width, and generates Python from typed layers.
It does not import PyTorch or execute exported source.

## Verify with PyTorch

Start the Rust server, then run the existing API and export tests from `backend/`:

```bash
python -m pip install -r requirements-dev.txt
TORCHFLOW_TEST_API_URL=http://127.0.0.1:8000 python -m pytest -q \
  tests/test_health.py tests/test_validate.py tests/test_generate.py tests/test_roundtrip_execution.py
```

In PowerShell, set `$env:TORCHFLOW_TEST_API_URL = 'http://127.0.0.1:8000'`
first and run the `python -m pytest` command on one line. Without that variable,
the same API tests use the FastAPI reference implementation.
