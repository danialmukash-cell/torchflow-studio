# TorchFlow Studio

A visual PyTorch IDE. Build a neural network on an infinite canvas, inspect it,
and (soon) train it — without writing boilerplate.

> **Status: Milestone 3 — validation and PyTorch export verified end to end.** The visual graph editor, local JSON persistence, and example networks are implemented.
> The Rust backend validates graphs, infers tensor shapes, and generates
> PyTorch `nn.Module` source. Python and PyTorch are needed only to run the exported model.

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
| Tensor shape propagation | ✅ Rust |
| PyTorch code generation | ✅ Rust |
| Training / metrics | ❌ Future |

## Requirements

- Node.js 20+ and npm 10+
- Stable Rust and Cargo for the backend
- Python 3.11+ and PyTorch to execute exported models or run the API contract tests

## Setup

Launch the Rust backend (one terminal, from the repository root):

```bash
cargo run --locked --manifest-path backend-rust/Cargo.toml
```

The API listens on `127.0.0.1:8000`. See the [backend guide](backend-rust/README.md)
for endpoints and configuration.

Launch frontend in another terminal:

```bash
cd frontend
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

## Backend test suites

```bash
cargo test --locked --manifest-path backend-rust/Cargo.toml
```

The [API contract suite](backend-rust/README.md#verify-with-pytorch) sends requests
to the Rust server and runs the returned models on CPU. To run the Python
reference implementation's tests in process:

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

Rejected connections show an explanation in the bottom-center toast. Both the
editor and backend currently support sequential graphs only.

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

- **Validate** checks graph topology, parameters and tensor dimensions via the API.
- **Generate PyTorch** emits a runnable `torch.nn.Module` when the graph is valid.
- **Validation** tab shows errors and tensor shapes (excluding batch dimension).
- **PyTorch** tab displays the generated Python and lets you download `torchflow_model.py`.
- Structural and parameter edits clear cached results. Dragging nodes does not.
- There is no training, inference endpoint, branching DAG, or arbitrary user code execution.

## Known limitations

- Desktop-first layout; there is no mobile layout yet.
- Shape inference currently supports sequential flat feature vectors; CNNs and multi-dimensional tensors are not implemented.
- You can import incomplete graphs to keep editing. Backend validation must pass
  before you can generate Python.
- No undo/redo.

## Roadmap

- **Milestone 2 (implemented)** — FastAPI backend: `POST /api/validate`, `POST /api/generate`,
  `GET /api/health`; tensor shape propagation; PyTorch `nn.Module` generation.
- **Milestone 3 (implemented)** — Rust backend, API tests through real CPU forward
  passes, and a browser smoke check for generation and download.
- **Next** — validate and export a branching model with a residual connection,
  including diagnostics that point to the exact incompatible edge.

## Verification

Run `npm install`, `npm run typecheck`, `npm test`, and `npm run build` to verify
the frontend. The backend suite exercises validation and export through the API,
then runs the returned Python on CPU in the test process. The server does not
execute it.

## Contributing and next step

See [CONTRIBUTING.md](CONTRIBUTING.md) and the [verification log](docs/VERIFICATION.md).

## License

MIT — see [LICENSE](./LICENSE).
