# TOKEN BUDGET — pixdom

---

## Session Overhead (Always Loaded)

| File | Est. Tokens | Notes |
|---|---|---|
| `.claude/claude.md` | ~600 | Read every session |
| `.claude/PROGRESS.md` | ~1,200 | Read every session |
| Active context file | ~400–600 | One per session |
| Session opener prompt | ~100–150 | From SESSION.md template |
| **Minimum session overhead** | **~2,300–2,550** | Before any code is written |

---

## Context Files (Load One Per Session)

| File | Est. Tokens | Load When |
|---|---|---|
| `context/monorepo-setup.md` | ~400 | Layer 1 sessions |
| `context/shared-types.md` | ~500 | Layer 2 sessions |
| `context/platform-profiles.md` | ~350 | Layer 3 sessions |
| `context/animation-detector.md` | ~450 | Layer 4 sessions |
| `context/core-rendering.md` | ~600 | Layer 5 sessions |
| `context/cli.md` | ~400 | Layer 6 sessions |
| `context/mcp-server.md` | ~500 | Layer 7 sessions |
| `context/claude-integration.md` | ~250 | Layer 8 sessions |
| `context/docker.md` | ~300 | Layer 9 sessions |
| `context/testing.md` | ~450 | Layer 10 sessions |

---

## Session Size Targets

| Session Type | Token Target | Warning Signs |
|---|---|---|
| Implementation | 20,000–40,000 | > 50k: too much context loaded or task too large |
| Architecture / Planning | 15,000–30,000 | > 40k: overly broad design scope |
| Bug Fix | 5,000–15,000 | > 20k: bug affects too many files — split it |
| Test Writing | 15,000–30,000 | > 40k: too many modules in scope |

---

## Top Token Waste Causes

1. **Reading `node_modules` or `dist`**: A single package in `node_modules` can be 100k+ tokens. `.claudeignore` is the only defence.
2. **Pasting full file contents when `#path` suffices**: Claude ingests the whole file even if only one function is relevant. Use `#path` and ask for the specific function.
3. **Multi-layer sessions**: Working across 2+ layers forces Claude to load 2× context files plus cross-references — doubles overhead with no benefit.
4. **Forgetting `/compact` until 95%+**: Summary quality at 95% is significantly worse than at 70%. Early compaction preserves more decision context.
5. **Re-explaining project state instead of reading PROGRESS.md**: A 500-token explanation of what's been done costs more than just reading PROGRESS.md (which Claude can scan in ~300 tokens).
6. **Using `/model opus` for implementation**: Opus has a 5× price multiplier and a larger internal context footprint — Sonnet is as good or better for TypeScript code generation.
7. **Loading all context files "just in case"**: Each extra context file is ~500 tokens of overhead before any actual work begins. Speculative loading doubles session cost.
8. **Long error paste without summarising first**: A full stack trace from a Node process can be 2k+ tokens. Paste only the error type and first 3 frames unless Claude asks for more.

## RTK-optimized commands

| Command              | Raw tokens | RTK tokens | Savings |
|----------------------|------------|------------|---------|
| pnpm test            | ~4,000     | ~400       | 90%     |
| playwright test      | ~8,000     | ~800       | 90%     |
| tsc --noEmit         | ~2,000     | ~300       | 85%     |
| git diff (full)      | ~3,000     | ~500       | 83%     |
| pnpm build           | ~3,000     | ~400       | 87%     |

Always prefer: rtk pnpm test, rtk tsc, rtk playwright test, rtk git diff
