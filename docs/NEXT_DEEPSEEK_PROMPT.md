# Prompt for DeepSeek — TorchFlow Studio Milestone 2

You are the lead engineer on the EXISTING open-source project **TorchFlow Studio** (React + TypeScript + Vite + React Flow + Zustand). You must work with the files I provide, not recreate a new frontend from scratch.

## Working agreement

- Inspect the existing repository and its README, node registry, canonical graph schema, tests, and known limitations before editing.
- **First complete the Milestone 1 verification:** run `npm install`, `npm run typecheck`, `npm test`, and `npm run build` from `frontend/`. Fix real failures. Do not claim a command passed unless you executed it; otherwise state "not executed" and why.
- Fix regressions with focused tests; keep graph document schemaVersion = 1 and maintain backward compatibility with saved graph JSON.
- Never replace working features with mockups, fake buttons, static screenshots, or invented test logs.
- Avoid unnecessary dependencies. Prefer simple, understandable code and explicit types.
- Treat uploaded JSON as untrusted input. Never use `eval`, `exec`, arbitrary file imports, shell execution, or dynamic code execution on untrusted user input.

## Milestone 2 objective

Make the current visual editor produce **real, valid, runnable PyTorch `nn.Module` source code** from a sequential graph. Implement an actual FastAPI backend and wire it to the existing editor.

### Backend structure

Create:
```
backend/
  app/__init__.py
  app/main.py
  app/schemas.py
  app/validation.py
  app/generator.py
  tests/test_validation.py
  tests/test_generation.py
  pyproject.toml
```

Provide documented Python 3.11+ setup. PyTorch CPU installation should be explained separately since it is heavy. Include FastAPI, Pydantic and pytest.

### API

- `GET /api/health` -> healthy status and version.
- `POST /api/validate` accepts the existing `GraphDocument` schema v1 -> `{ valid: boolean, errors: Array<{ nodeId?: string, code: string, message: string }>, shapes: Record<string, Array<number | null>> }`.
- `POST /api/generate` -> returns `{ code: string, className: string }` for valid graphs; rejects invalid graphs with structured errors and a meaningful HTTP status.
- Configure CORS only for documented local frontend origins by default.
- Cap request sizes, graph sizes and parameter ranges and produce useful error messages.

### Validation contract

- Initially support **a single complete ordered path**: exactly one Input and one Output, and all nodes belong to the sole path.
- Reject cycles, disconnected nodes, duplicate endpoints, branching, missing links, invalid node IDs, wrong param types, booleans in integer fields, non-finite numbers, and invalid values like negative feature counts or dropout p outside [0, 0.99].
- Infer tensor shapes along the path. Input is `[null, features]` (`null` stands for batch dimension). Linear changes last dimension to `out_features`. ReLU/Sigmoid/Tanh/Dropout preserve shape. Flatten preserves the existing two-dimensional feature vector under current schema v1; do not pretend to infer higher dimensional shapes that the schema cannot express.
- Output.classes must equal the preceding feature count, or report a clear mismatch. Do not secretly create an extra Linear layer in Output.
- Return shapes keyed by graph node ID, not by hard-coded example positions.

### Safe deterministic code generation

- Generate an importable Python file containing a genuine `torch.nn.Module` subclass with `__init__` and `forward` using an allowlist of supported layers: Input, Linear, ReLU, Sigmoid, Tanh, Flatten, Dropout, Output.
- Infer each Linear layer's `in_features` from the preceding shape rather than inventing dimensions.
- Generate stable, valid Python identifiers and escape all derived strings safely.
- No arbitrary user Python, custom operators, shell calls, file execution, serialized pickle data, or dynamic imports from graph values.
- Both bundled examples must generate code that can instantiate and process `torch.randn(batch_size, input_features)` with exactly the documented output shape. Training is OUT OF SCOPE for this milestone.

### Frontend integration

- Add **Validate** and **Generate PyTorch** buttons only when backed by working endpoint calls.
- Add a panel for structured validation errors and a code viewer with a Copy button and Download `.py` button.
- Display inferred shapes on the existing nodes or inspector and handle backend loading, down state, CORS/network errors, invalid graphs, and stale results after graph changes.
- Do not break drag-and-drop, edge selection/delete, inspector editing, autosave, JSON import/export, existing examples.
- Use a documented Vite proxy or environment variable for API calls; no cloud or API keys required.

### Tests / acceptance criteria

1. `npm run typecheck`, `npm test`, `npm run build` complete successfully.
2. `pytest` runs validation and API tests, including malformed graphs and known invalid shapes.
3. Both example networks yield correct shapes, and generated Python code can instantiate and run using CPU PyTorch where installed.
4. Input 784 -> Linear 128 -> ReLU -> Linear 10 -> Output 10 gives `[null, 10]`.
5. Input 20 -> Linear 1 -> Sigmoid -> Output 1 gives `[null, 1]`.
6. A deliberate Output.classes mismatch, a cycle, an out-of-range Dropout, and a disconnected node each produce explicit errors.
7. No fake or unimplemented actions appear as working UI controls.
8. README explains exact commands to run frontend and backend in two terminals, plus known limitations and actual test outcomes.

## Deliverables

- Actual changed files in the repository (not isolated snippets).
- Concise architecture explanation.
- Exact install/run/test commands for Windows PowerShell AND Linux bash.
- List of changed files and reasons.
- Test summary with **executed / not executed** status for each command.
- Known limitations, security considerations, and a proposed Milestone 3.
- Do not attempt deployment or publishing to GitHub unless authenticated and authorized. Never ask for or print passwords, tokens, or secrets. Do not alter an unrelated repository.

Implement incrementally: preflight and fixing the current MVP first, backend validation second, deterministic codegen third, frontend integration fourth, then tests and documentation. If you lack filesystem access, provide complete files in small numbered batches and do NOT claim you executed tests.
