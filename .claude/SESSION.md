# SESSION TEMPLATES — pixdom

Copy the relevant block, paste into a new Claude Code session, and send.

---

## 1. Standard Implementation Session

```text
/model sonnet

Read `.claude/claude.md` then `.claude/PROGRESS.md`.
Load context file: `.claude/context/[LAYER-NAME].md`

Role: implementer
Scope: Complete the unchecked tasks in Layer [N] — [Layer Name] only.
Do NOT touch: apps/web, BullMQ, Redis, S3, or any layer not listed as active.

Before writing any code, confirm:
1. The specific tasks you will complete
2. The files you will create or modify
3. What is explicitly out of scope
```

---

## 2. Architecture / Planning Session

```text
/model opus

Read `.claude/claude.md` then `.claude/PROGRESS.md`.

Role: architect
Task: Design [describe design problem in one sentence].
Output: A written task plan only — file paths, interfaces, data flow, and decisions.
Zero implementation code. Zero file creation.

Produce a decision record suitable for pasting into the Decisions Log in PROGRESS.md.
```

---

## 3. Test Writing Session

```text
/model sonnet

Read `.claude/claude.md` then `.claude/PROGRESS.md`.
Load context file: `.claude/context/testing.md`

Role: qa-agent
Scope: Write Vitest tests for [package or module name].
Rules:
- Mock all external dependencies (Playwright, FFmpeg, Sharp, Anthropic API, fs)
- Do NOT mock internal modules within the same package
- Cover: 1 happy path + at least 2 error paths per public function
- Test file lives alongside source: `[source-name].test.ts`

Confirm test targets before writing.
```

---

## 4. Bug Fix Session

```text
/model sonnet

Read `.claude/claude.md` only.

Role: implementer — bug fix
File: [path/to/file.ts]
Error: [paste exact error message or stack trace]
Hypothesis: [your best guess at root cause]

Fix this one file only. Do not refactor surrounding code.
After the fix, run typecheck and confirm it passes.
```

---

## 5. UI Component Session

```text
/model sonnet

Read `.claude/claude.md` then `.claude/context/ui.md` only.

Role: ui-builder
Scope: Build [component name] in `apps/web/`.
Constraints:
- shadcn/ui components only — no raw HTML where a shadcn component exists
- Tailwind utility classes only — no custom CSS files
- No new dependencies without explicit approval
- All props typed with TypeScript interfaces — no inline object types
```

---

## 6. Mid-Session Context Management

```text
# At 70% context window (act BEFORE hitting 100%):

# For implementation tasks:
/compact "Summarise: files created, current task status, next task, any blockers."

# For planning / architecture tasks:
/compact "Summarise: decisions made, open questions, next design step."

# For debugging tasks:
/compact "Summarise: error, what was tried, current hypothesis, next step."

# When to use /clear instead of /compact:
# - Switching to a completely different layer
# - Starting a new role (e.g. from implementer to qa-agent)
# - After completing a layer and committing
# Rule: /clear resets everything — always re-read claude.md + PROGRESS.md after /clear
```

---

## 7. Returning After a Break

```text
# Option A — Fresh session (away > 2 hours, always use this):
/model sonnet
Read `.claude/claude.md` then `.claude/PROGRESS.md`.
Load the context file for the active layer.
Summarise the current state and next task before doing anything.

# Option B — Short gap (< 1 hour, context still warm):
claude --continue   # resumes last conversation
# OR
claude --resume     # interactive session picker

# Rule: when in doubt, always use Option A.
# Stale context causes incorrect assumptions — Option A is always safe.
```

---

## 8. Session End Checklist

```text
Before ending this session:

1. List every file created or modified this session
2. Run: pnpm -r typecheck
3. Run: pnpm test (report pass/fail)
4. In PROGRESS.md:
   - Mark completed tasks ✅
   - Update ACTIVE TASK to next uncompleted task
   - Update LAST SESSION to today's date + brief summary
   - Add any design choices to Decisions Log
   - Add any shortcuts or known gaps to Technical Debt Log
5. If all tasks in the active layer are ✅:
   git add .
   git commit -m "[conventional commit message from PROGRESS.md layer definition]"
   Update LAST COMMIT in PROGRESS.md
   Update layer Status to ✅ Complete and add Git Tag
```

---

## 9. Anti-Patterns

| Anti-Pattern | Why It Hurts | Correct Behaviour |
|---|---|---|
| Reading all source files at session start | Burns 30–50% of context before writing a line | Load only the active context file |
| Using `/model opus` for implementation | 5× token cost, no quality gain for code | Use sonnet; opus only for architecture |
| Letting context hit 100% before `/compact` | Summary quality degrades past 85% | Run `/compact` at 70% |
| `process.env.VAR` inline throughout code | Bypasses validation, hard to test | Always use `env.ts` accessor |
| Catching errors and rethrowing as `Error` | Loses structured context | Return `err({ code, message, cause })` |
| Leaving Playwright browser open on error | Leaks Chromium processes, fills RAM | Always close in `finally` block |
| Importing `packages/core` directly by path | Breaks workspace boundaries | Declare workspace dep, import by name |
| Committing without typecheck pass | Breaks CI, wastes next session | Always `pnpm -r typecheck` before commit |
| Working on v2 code during v1 layer | Scope creep, untested dependencies | Respect layer boundaries in PROGRESS.md |
| Free-form session opener without template | Claude makes wrong scope assumptions | Always use SESSION.md template |
