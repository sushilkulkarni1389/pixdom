# ROLES — pixdom

## Model Rule

- **All roles**: `/model sonnet`
- **Architect only**: `/model opus`
- Never use Haiku for this project — TypeScript inference requires Sonnet minimum.

---

## Role Definitions

### architect
**Model:** `/model opus`
**Use for:** System design, API contracts, package boundaries, layer planning, decision records
**Never use for:** Writing implementation code, creating source files, test writing
**Opener:**

```text
/model opus
Read `.claude/claude.md` then `.claude/PROGRESS.md`.
Role: architect.
Task: [describe design question].
Output: Written design only — interfaces, data flow, file structure, and rationale.
No implementation code. No file creation.
```

---

### implementer
**Model:** `/model sonnet`
**Use for:** All TypeScript source files, package.json, config files, build scripts
**Never use for:** Architecture decisions, UI design, test writing
**Opener:**

```text
/model sonnet
Read `.claude/claude.md` + `.claude/PROGRESS.md` + `.claude/context/[layer].md`.
Role: implementer.
Layer: [N] — [Layer Name].
I will complete tasks: [list task IDs].
I will NOT touch: [list out-of-scope areas].
Confirm scope before writing any code.
```

---

### qa-agent
**Model:** `/model sonnet`
**Use for:** Vitest unit tests, integration tests, coverage configuration
**Never use for:** Implementation code, bug fixes, architecture
**Opener:**

```text
/model sonnet
Read `.claude/claude.md` + `.claude/context/testing.md`.
Role: qa-agent.
Target: [package or module].
Rules: mock all externals, no internal mocks, 1 happy + 2 error paths per public fn.
Confirm test targets before writing.
```

---

### ui-builder
**Model:** `/model sonnet`
**Use for:** `apps/web` React components, Tailwind layout, shadcn/ui composition (v2 only)
**Never use for:** Core rendering logic, MCP tools, CLI, package internals
**Opener:**

```text
/model sonnet
Read `.claude/claude.md` + `.claude/context/ui.md`.
Role: ui-builder.
Component: [name].
Rules: shadcn/ui + Tailwind only, typed props, no custom CSS.
```

---

### reviewer
**Model:** `/model sonnet`
**Use for:** Code review pass before layer commit, spotting type errors, rule violations
**Never use for:** Implementing fixes (reviewer flags only — implementer fixes)
**Opener:**

```text
/model sonnet
Read `.claude/claude.md`.
Role: reviewer.
Review #path/to/file.ts against the hard rules in claude.md.
Output: list of rule violations with line references. No fixes — flag only.
```

---

## Layer → Role Matrix

| Layer | Primary Role | Secondary Role |
|---|---|---|
| 1 — Monorepo Setup | implementer | architect (initial design) |
| 2 — Shared Types | architect + implementer | reviewer |
| 3 — Platform Profiles | implementer | qa-agent |
| 4 — Animation Detector | implementer | qa-agent |
| 5 — Core Rendering Engine | implementer | qa-agent |
| 6 — CLI App | implementer | qa-agent |
| 7 — MCP Server | implementer | qa-agent |
| 8 — Claude Code Integration | implementer | reviewer |
| 9 — Docker & Environment | implementer | reviewer |
| 10 — Testing & QA | qa-agent | reviewer |

---

## Token-Saving Rules (All Roles)

1. **One context file per session** — never load two layer context files in the same session.
2. **Reference files with `#path` instead of asking Claude to read them** — avoids full-file ingestion unless needed.
3. **State explicit out-of-scope areas** — prevents Claude from speculatively touching adjacent code.
4. **Run `/compact` at 70% context** — never let it hit 100% before summarising.
5. **Commit at every layer boundary** — gives `/clear` a clean checkpoint with no lost work.
6. **Never paste full stack traces if a 3-line error message suffices** — summarise first, expand only if Claude asks.
7. **Keep the opener prompt under 200 tokens** — every word in the opener is overhead repeated at `/compact`.
