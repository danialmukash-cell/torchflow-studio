# Contributing to TorchFlow Studio

Thank you for considering a contribution!

## Local development

1. Install Node.js 20+.
2. Run `cd frontend && npm install`.
3. Start with `npm run dev`.
4. Before opening a pull request, run `npm run typecheck && npm test && npm run build`.

## Scope

Milestone 2 includes a stateless FastAPI backend for validation and code generation. Please keep graph types and validation logic framework-independent, and avoid fake features. New node types belong in the node registry. Do not execute arbitrary user-supplied code.

## Pull requests

Use focused commits, describe behavior changes, document verification, and include tests for graph operations and serialization. Large feature additions should be discussed in an issue first.

## Issues and security

Provide reproduction steps for bugs. Please avoid reporting sensitive information in public issues, and never commit secrets, credentials or proprietary datasets.

This project is distributed under the MIT license.
