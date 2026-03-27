# Example: Optimize Prompts

```bash
/autoevolve "reduce CLAUDE.md token usage without losing quality"
```

autoevolve counts tokens, removes redundancy, verifies quality with LLM-as-judge.
Each iteration: simplify 1 section → verify quality score didn't drop → keep or revert.
