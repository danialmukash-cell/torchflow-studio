# TorchFlow Studio

A visual PyTorch IDE. Build a neural network on an infinite canvas, inspect it,
and (soon) train it — without writing boilerplate.

> **Status: Milestone 2 — frontend + PyTorch code generator.** The visual graph editor, local JSON persistence, and example networks are implemented.
> The FastAPI backend now validates graphs, infers tensor shapes, and generates
> template-based PyTorch nn.Module models. Model execution/training is not served by the backend.

## What works today

| Feature | Status |
| --- | --- |
| Infinite canvas with pan / zoom | ✅ |
| Drag-and-drop node creation from palette | ✅ |
| Click-to-append node creation | ✅ |
| Connect nodes by dragging handles | ✅ |
| Delete nodes (Delete key or Inspector button) | ✅ |
| Delete connections (select edge + Delete) | ✅ |
| Duplicate node (Inspector button) | ✅ |
| Edit node parameters (Inspector) | ✅ |
| Rename graph | ✅ |
| Single-path connection rules with error messages | ✅ |
| Autosave to `localStorage` + restore on reload | ✅ |
| Download graph as JSON | ✅ |
| Upload graph JSON (schema-validated) | ✅ |
| Two bundled example networks | ✅ |
| Live graph JSON inspector panel | ✅ |
| Tensor shape propagation | ✅ FastAPI |
| PyTorch code generation | ✅ FastAPI |
| Training / metrics | ❌ Future |

## Requirements

- Node.js 20+ and npm 10+
- Python 3.11+ for the FastAPI backend
- PyTorch for CPU forward-pass tests (not needed to serve the backend)

## Setup

Launch backend (one terminal):

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Open http://127.0.0.1:8000/docs for the API documentation.

Launch frontend in another terminal:

```bash
git clone https://github.com/danialmukash-cell/torchflow-studio.git
cd torchflow-studio/frontend
npm install
npm run dev
```

Open <http://localhost:5173>.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check, then build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Run the unit tests (Vitest) |

## Backend test suite

```bash
cd backend
pip install -r requirements-dev.txt
pytest -q
```

Includes real generated-code forward-pass tests using PyTorch on CPU.
The application server itself never executes generated code.

## Using the editor

- **Add a node** — drag it from the left palette onto the canvas, or click it to
  append it below the lowest node.
- **Connect** — drag from the right handle of one node to the left handle of
  another.
- **Edit parameters** — click a node; the Inspector on the right shows its
  fields. Edits are applied immediately.
- **Delete** — select a node or a connection and press `Backspace` / `Delete`,
  or use the Inspector button.
- **Save** — the toolbar *Save* button downloads a `.torchflow.json` file.
- **Load** — the toolbar *Load* button opens a file picker and validates the
  file against schema v1 before applying it.
- Every change is also autosaved to `localStorage` (debounced 400 ms) and
  restored when you reload the page.

## Connection rules (Milestone 1 and 2)

Milestone 1 supports **sequential single-path** networks only:

- Exactly one `Input` and one `Output` are expected.
- Each node accepts at most **one** incoming and **one** outgoing connection.
- No self-loops, no cycles, no branching.
- `Input` cannot have incoming connections; `Output` cannot have outgoing ones.

Rejected connections show an explanation in the bottom-center toast. Branching
support requires the real DAG validator from Milestone 2.

## Graph JSON schema (v1)

```json
{
  "schemaVersion": 1,
  "name": "MLP classifier",
  "nodes": [
    { "id": "input-1", "type": "input", "position": { "x": 0, "y": 0 },
      "params": { "features": 784 } },
    { "id": "linear-2", "type": "linear", "position": { "x": 0, "y": 110 },
      "params": { "out_features": 128, "bias": true } }
  ],
  "edges": [
    { "id": "edge-1", "source": "input-1", "target": "linear-2" }
  ]
}
```

Allowed `type` values: `input`, `linear`, `relu`, `sigmoid`, `tanh`, `flatten`,
`dropout`, `output`.

The loader rejects files with an unsupported `schemaVersion`, unknown node
types, invalid parameter values, duplicate ids, edges pointing at missing
nodes, cycles, and unsupported branching.

## Repository layout

```
frontend/
  src/types/graph.ts        canonical graph model (no React imports)
  src/graph/nodeRegistry.ts node type definitions, defaults, param schemas
  src/graph/model.ts        pure graph operations
  src/graph/serialization.ts schema v1 parse/serialize
  src/graph/examples.ts     bundled example networks
  src/store/graphStore.ts   Zustand state wiring
  src/components/           UI layer
```

The graph model is deliberately independent of React Flow so it can be reused
by the Python-facing validator and generator in Milestone 2.

## What's new in Milestone 2

- **Validate** checks graph topology, parameters and tensor dimensions via FastAPI.
- **Generate PyTorch** emits a runnable `torch.nn.Module` when the graph is valid.
- **Validation** tab shows errors and tensor shapes (excluding batch dimension).
- **PyTorch** tab displays the generated Python and lets you download `torchflow_model.py`.
- Structural and parameter edits clear cached results. Dragging nodes does not.
- There is no training, inference endpoint, branching DAG, or arbitrary user code execution.

## Known limitations

- Desktop-first layout; there is no mobile layout yet.
- Shape inference currently supports sequential flat feature vectors; CNNs and multi-dimensional tensors are not implemented.
- Imported JSON is checked for supported single-path connectivity, but incomplete
  graphs are allowed until the full Milestone 2 validator is implemented.
- No undo/redo.

## Roadmap

- **Milestone 2 (implemented)** — FastAPI backend: `POST /api/validate`, `POST /api/generate`,
  `GET /api/health`; tensor shape propagation; PyTorch `nn.Module` generation.
- **Milestone 3** — integration tests, generated-code execution checks.
- **Future** — training, loss/accuracy charts, gradient visualization, dataset
  upload, ONNX export.

## Verification

Run `npm install`, `npm run typecheck`, `npm test`, and `npm run build` before declaring this version production-ready.
The code is not yet an executable PyTorch IDE; the FastAPI backend is planned for Milestone 2.

## Contributing and next step

See [CONTRIBUTING.md](CONTRIBUTING.md), [verification log](docs/VERIFICATION.md), and [Milestone 2 prompt](docs/NEXT_DEEPSEEK_PROMPT.md).

## License

MIT — see [LICENSE](./LICENSE).
