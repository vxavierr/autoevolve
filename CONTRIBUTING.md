# Contributing to autoevolve

Autonomous improvement engine for code, prompts, and workflows. Contributions welcome.

## Prerequisites

- Node.js 20+
- No build step required — ESM modules, run directly

## Setup

```bash
git clone https://github.com/vxavierr/autoevolve.git
cd autoevolve
npm install
```

## Development Workflow

This project follows TDD. The loop:

1. Write a failing test in `test/`
2. Implement the minimum code to make it pass
3. Verify: `node --test test/**/*.test.js`
4. Refactor if needed, keep tests green

Never submit code without tests. Never submit tests without implementation.

## Running Tests

```bash
# All tests
node --test test/**/*.test.js

# Single file
node --test test/core/improvement-engine.test.js
```

## Project Structure

```
src/
  core/           # Improvement engine, scoring, session management
  domains/        # Domain adapters (code, prompts, workflows)
  prediction/     # Confidence scoring, outcome prediction
  hooks/          # Lifecycle hooks (pre/post improvement)
  dashboard/      # Vanilla JS frontend, no framework
  marketplace/    # Rule/improvement sharing and import
  multi/          # Multi-project orchestration
  cost/           # Cost tracking and budget enforcement
  evolution/      # Long-term learning, rule persistence
test/             # Mirror of src/ structure
```

## Commit Convention

Conventional commits, always:

```
feat: add confidence decay for stale rules
fix: handle missing domain adapter gracefully
docs: clarify scoring algorithm in README
chore: bump js-yaml to 4.1.0
test: add edge cases for trust engine
refactor: extract scoring into separate module
```

Reference an issue when applicable: `feat: add X (#42)`

## PR Guidelines

- One feature or fix per PR — no bundled changes
- Every PR must include tests
- No placeholder implementations (`TODO`, `throw new Error('not implemented')`)
- Tests must pass: `node --test test/**/*.test.js`
- Keep diffs small and focused — easier to review, easier to revert

## Code Style

- **ESM only** — `import`/`export`, no CommonJS
- **No build step** — code runs directly with Node.js
- **Zero external dependencies** beyond `js-yaml` — keep the dependency surface minimal
- **Vanilla JS for frontend** — no React, no bundler, no framework in `src/dashboard/`
- **No TypeScript** — plain JavaScript with clear naming over type annotations
- Prefer explicit over clever. If it needs a comment to understand, simplify it first.
