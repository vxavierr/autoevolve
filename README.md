# autoevolve

Autonomous improvement engine for code, prompts, and workflows.

Tight loop: **measure → change → verify → keep or revert.**

Inspired by [karpathy/autoresearch](https://github.com/karpathy/autoresearch). Designed for developers who use Claude Code daily.

## Quick Start

```bash
# As Claude Code skill (primary usage)
/autoevolve "improve test coverage to 80%"
/autoevolve predict
/autoevolve flow

# As standalone CLI
npm install -g autoevolve
autoevolve init
autoevolve run "improve test coverage"
```

## Features

- **Tight loop**: 1 atomic change per iteration, always committed before verification
- **Auto-revert**: if metric worsens, `git revert` keeps the codebase clean
- **Plateau detection**: stops after 3 consecutive no-improvement iterations
- **4 domains**: code, prompts, behavior, flow — each with its own metrics
- **Code above LLM**: repeated successful decisions become hardcoded rules, bypassing LLM reasoning on next runs
- **Git memory**: reads your `[autoevolve]` commit history to avoid repeating failed approaches

## How It Works

```
MEASURE → ANALYZE → CHANGE → COMMIT → VERIFY → DECIDE
  ↑                                               |
  └──────────────── REPEAT ──────────────────────┘
```

1. **MEASURE** — run verify command, capture baseline metric
2. **ANALYZE** — check hardcoded rules first, then reason about 1 change
3. **CHANGE** — apply exactly 1 modification
4. **COMMIT** — `git commit` (snapshot before verification)
5. **VERIFY** — run verify command again
6. **DECIDE** — improved? KEEP. Worsened? `git revert`. Unchanged? plateau flag.

## Domains

### code
Improves test coverage, reduces lint errors, tracks build time.

```bash
/autoevolve "fix all eslint errors"
/autoevolve "improve test coverage to 90%"
```

Metrics: `coverage` (higher-is-better), `lint-errors` (lower-is-better), `build-time` (lower-is-better)

### prompts
Optimizes CLAUDE.md, skills, and hooks for token efficiency and instruction quality.

```bash
/autoevolve "reduce CLAUDE.md token usage without losing quality"
```

Metrics: `token-usage` (lower-is-better), `instruction-density` (higher-is-better)

### behavior (`/autoevolve predict`)
Analyzes Claude Code session history to detect friction patterns.

```bash
/autoevolve predict
```

Detects: corrections, frustration signals, approvals, scope drift.
Proposes: guardrails, hooks, CLAUDE.md rules to prevent recurring friction.

### flow (`/autoevolve flow`)
Audits workflow items if a framework is detected (e.g., AIOX `.aios-core/`).

```bash
/autoevolve flow
```

Detects: stale stories, bottlenecks, workflow violations.

## Evolution Engine (Code above LLM)

After each run, autoevolve checks: did you make the same successful decision 3+ times?

If yes, it extracts a **hardcoded rule** to `.autoevolve/rules/hardcoded-rules.json`:

```json
{
  "id": "rule-abc12345",
  "domain": "code",
  "when": "eslint fixable errors > 0",
  "do": "run eslint --fix",
  "confidence": 1.0,
  "verified_count": 5
}
```

Next run: rule is checked BEFORE LLM reasoning. Match → execute directly. No LLM call needed.

This is progressive Code above LLM: the more you use autoevolve, the less it needs the LLM.

```bash
autoevolve rules          # list hardcoded rules
autoevolve rules export   # export as JSON
```

## Configuration

Copy `config/autoevolve.config.example.yaml` to `.autoevolve/config.yaml`:

```yaml
domains:
  code:
    enabled: true
    metrics: [coverage, lint-errors]
    verify_command: "npm test -- --coverage"
    scope: "src/**/*.{js,ts}"
  prompts:
    enabled: true
    scope: ".claude/**/*.md"
  behavior:
    enabled: true
  flow:
    enabled: auto  # auto-detect framework

loop:
  max_iterations: 20
  auto_revert: true
  plateau_threshold: 3

evolution:
  extract_after_repeats: 3
```

## CLI Reference

```bash
autoevolve init                    # detect domains, generate config
autoevolve run "goal"              # run improvement loop
autoevolve predict                 # analyze behavior patterns
autoevolve flow                    # audit workflow
autoevolve status                  # show current state
autoevolve rules                   # list hardcoded rules
autoevolve rules export            # export rules as JSON

# Options
--max <n>          max iterations (default: 20)
--domain <name>    only run specific domain
--dry-run          show plan without executing
```

## State Files

All state is stored in `.autoevolve/` (gitignored):

```
.autoevolve/
├── state.json              # current loop state
├── config.yaml             # your config
├── rules/
│   └── hardcoded-rules.json   # extracted patterns
├── logs/
│   └── iterations.jsonl    # iteration history (append-only)
└── reports/
    └── run-{date}.json     # run summaries
```

## Examples

- [Improve test coverage](examples/improve-test-coverage/README.md)
- [Optimize prompts](examples/optimize-prompts/README.md)
- [Analyze behavior](examples/analyze-behavior/README.md)

## Contributing

```bash
git clone ...
npm install
node --test test/**/*.test.js
```

Tech stack: Node.js ESM, no build step, YAML config, node:test runner.

## License

MIT
