# TorchFlow Studio — Backend

FastAPI service that validates graphs and generates PyTorch `nn.Module`
code for the TorchFlow Studio frontend.

## What this service is *not*

- It does **not** execute PyTorch. There is no `/train`, `/predict`, or
  `/run` endpoint, and there will not be until a later milestone.
- It does **not** `exec` user-supplied code. It only returns code as a
  string. The only place `exec` appears in the repo is
  `tests/test_roundtrip_execution.py`, which is a test that proves the
  generator is correct.

## Setup

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt      # includes torch for tests
uvicorn app.main:app --reload --port 8000
```

The server listens on <http://127.0.0.1:8000>. Interactive docs at
<http://127.0.0.1:8000/docs>.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `TORCHFLOW_CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated allowed origins |

## Endpoints

### `GET /api/health`

```json
{ "status": "ok", "version": "0.2.0" }
```

### `POST /api/validate`

Request body: `{ "document": <GraphDocument schema v1> }`.

Response:
```json
{
  "valid": true,
  "errors": [],
  "shapes": { "input-1": [784], "linear-2": [128], "...": [...] },
  "nodeErrors": {}
}
```

If the document is invalid, `valid` is `false`, `errors` lists every
issue with `code`, `message`, and optional `nodeId` / `edgeId`, and
`nodeErrors` maps node ids to their first error for canvas badging.

Error codes: `unknown_param`, `invalid_param`, `missing_input`,
`multiple_inputs`, `missing_output`, `multiple_outputs`, `branching`,
`dangling_edge`, `self_loop`, `duplicate_node_id`, `duplicate_edge_id`,
`broken_chain`, `cycle`, `disconnected_nodes`, `empty_graph`,
`invalid_connection`, `shape_error`.

### `POST /api/generate`

Request body: `{ "document": <GraphDocument>, "className": "TorchFlowModel" }`.

Response on success:
```json
{ "valid": true, "errors": [], "code": "import torch\n...", "className": "TorchFlowModel" }
```

If validation fails, `valid` is `false`, `errors` is populated, and
`code` is `null`.

## Test suite

```bash
pytest
```

Covers: health, param validation, structural validation, shape
inference, codegen output, and (with `torch` installed) forward-pass
execution of every bundled example on CPU.

## Adding a node type

Add a `NodeSpec` to `app/node_specs.py`, add the corresponding case to
`_apply_shape` in `app/validation.py`, and add a branch to
`_emit_layer_init` in `app/generator.py`. Mirror the entry in
`frontend/src/graph/nodeRegistry.ts`. Existing schema v1 documents
remain valid — a new node type is additive.
