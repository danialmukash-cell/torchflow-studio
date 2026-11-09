# Contributing to TorchFlow Studio

Thank you for considering a contribution!

## Local development

1. Install Node.js 20+ and stable Rust.
2. Run `cd frontend && npm install`.
3. Start the Rust API with `cargo run --locked` from `backend-rust/`, and the editor with `npm run dev` from `frontend/`.
4. Before opening a pull request, run `npm run typecheck && npm test && npm run build`.

## Scope

The stateless Rust backend validates graphs and emits PyTorch source. Keep graph analysis independent of HTTP, and update the TypeScript node registry and API contract tests when adding a node type. Do not execute user-supplied code in the server.

## Pull requests

Use focused commits, describe behavior changes, document verification, and include tests for graph operations and serialization. Large feature additions should be discussed in an issue first.

## Issues and security

Provide reproduction steps for bugs. Please avoid reporting sensitive information in public issues, and never commit secrets, credentials or proprietary datasets.

This project is distributed under the MIT license.
