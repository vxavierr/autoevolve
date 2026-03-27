# Example: Improve Test Coverage

## As Claude Code skill

```bash
/autoevolve "improve test coverage to 80%"
```

## As standalone CLI

```bash
# 1. Configure
cat > .autoevolve/config.yaml << 'EOF'
domains:
  code:
    enabled: true
    metrics: [coverage]
    verify_command: "npm test -- --coverage"
loop:
  max_iterations: 15
EOF

# 2. Run
npx autoevolve run "improve test coverage to 80%"
```

## What happens

1. autoevolve measures current coverage (e.g., 62%)
2. Analyzes codebase, picks 1 file missing tests
3. Writes 1 test, commits
4. Runs coverage again — 64%? KEEP. 61%? REVERT.
5. Repeats until 80% or plateau
