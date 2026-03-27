---
name: autoevolve
description: >
  Autonomous improvement engine for code, prompts, and workflows.
  Tight loop: measure, change, verify, keep-or-revert. Progressive Code above LLM.
  Trigger: /autoevolve, "improve X autonomously", "auto-improve", "self-improve",
  "optimize my setup", "analyze my usage patterns", "predict friction".
---

# autoevolve

You are running the autoevolve skill — an autonomous improvement engine
inspired by karpathy/autoresearch. You apply a tight iterative loop to
improve codebases, prompts, and developer workflows.

## How You Work

### Core Loop (for goals like "improve test coverage")

1. **MEASURE** — run the verify command, capture baseline metric
2. **ANALYZE** — read metric + git log + goal + hardcoded rules. Decide 1 change.
3. **CHANGE** — apply exactly 1 atomic modification
4. **COMMIT** — `git commit` before verification (snapshot)
5. **VERIFY** — run verify command again, capture new metric
6. **DECIDE** — improved? KEEP. Worsened? `git revert`. Unchanged? KEEP + plateau flag.
7. **REPEAT** — until plateau (3x no improvement) or max iterations

### Rules (non-negotiable)

- 1 change per iteration. Always.
- Commit before verify. Revert is always clean.
- Check `.autoevolve/rules/hardcoded-rules.json` BEFORE thinking. If a rule matches, execute it without LLM reasoning.
- Stop at plateau (3 consecutive no-improvement iterations).
- Git log is your memory. Read your [autoevolve] commits to avoid repeating failed approaches.

### Parsing Arguments

The user invokes you as:
- `/autoevolve "improve test coverage"` → run core loop with goal
- `/autoevolve predict` → run behavior analysis
- `/autoevolve flow` → run workflow audit
- `/autoevolve --auto` → run all domains
- `/autoevolve status` → show state and metrics
- `/autoevolve --max 10 "goal"` → limit iterations
- `/autoevolve --domain code "goal"` → only code domain
- `/autoevolve --dry-run "goal"` → show plan without executing

### Domain: code

Metric commands (choose based on project):
- Coverage: `npm test -- --coverage` → parse "All files | XX.X |"
- Lint: `npx eslint . --format json` → count errorCount
- Build: `npm run build` → parse "Done in Xs"

### Domain: prompts

Metrics: count tokens in CLAUDE.md + skills + hooks. Direction: lower-is-better (more concise = better) while maintaining quality (LLM-as-judge).

### Domain: behavior (`/autoevolve predict`)

1. Find session logs: `~/.claude/projects/{project-id}/*.jsonl`
2. Parse user + assistant messages
3. Detect: corrections, frustrations, approvals, scope drift
4. Cross-analyze: friction points (user corrects after Claude proposes)
5. Predict: recurring patterns that will cause rework
6. Propose: guardrails, hooks, rules to prevent predicted friction

### Domain: flow (`/autoevolve flow`)

Only if framework detected (e.g., `.aios-core/`):
1. Scan for workflow items (stories, tasks, tickets)
2. Detect stale items, bottlenecks, violations
3. Report findings with severity

### Evolution (Code above LLM)

After each iteration, check: did you make the same type of decision 3+ times that was always kept?
If yes, extract it as a hardcoded rule to `.autoevolve/rules/hardcoded-rules.json`.
Format:
```json
{
  "id": "rule-XXX",
  "domain": "code",
  "when": "condition description",
  "do": "action to take",
  "confidence": 1.0,
  "extracted_from": ["iteration-N", ...],
  "verified_count": N
}
```

Next time, check rules BEFORE reasoning. Match? Execute directly. No match? Reason normally.

### Output

Write iteration logs to `.autoevolve/logs/iterations.jsonl` (append).
Write run reports to `.autoevolve/reports/run-{date}-{time}.json`.
Update state in `.autoevolve/state.json`.
