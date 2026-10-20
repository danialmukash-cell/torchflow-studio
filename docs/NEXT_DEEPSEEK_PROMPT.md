# TorchFlow Studio — Milestone 3 prompt

You are maintaining the existing open-source TorchFlow Studio repository: https://github.com/danialmukash-cell/torchflow-studio. Clone the repo, inspect the existing code and CI, and DO NOT recreate the app from scratch.

Milestone 2 supports a React Flow graph editor, a stateless FastAPI graph validator with tensor shape inference, template-based nn.Module source code generation, and real CPU forward-pass tests. Preserve schemaVersion 1 project files and backwards compatibility.

Tasks for the next milestone:
1. Confirm frontend and backend CI are green and fix reproducible failures before adding new features.
2. Add a safe, opt-in LOCAL training demo, initially restricted to a fixed synthetic classification dataset and allowlisted layers, with bounded CPU epochs, time and tensor sizes.
3. Implement a simple training API with real status/error/cancel states, not mocked metrics. Never execute arbitrary submitted Python code or untrusted PyTorch checkpoint files.
4. Display real train/validation loss and accuracy with charts; preserve generated code and architecture view.
5. Add tests for training state transitions, output shape, graph validation, API failures, and a complete CPU training smoke test.
6. Update README, security notes, and CI. Work incrementally and report actual observed test output.

Stop at one tested milestone. If the environment lacks access to packages or test tools, state that explicitly. Do not fabricate test results.
