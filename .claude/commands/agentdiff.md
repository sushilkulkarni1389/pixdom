# agentdiff — What changed this session and why

## Steps

1. Run `rtk git diff HEAD~1..HEAD --stat` for a compressed file-level summary
2. Run `rtk git diff HEAD~1..HEAD -- packages/ apps/ --unified=3`
   for compressed code changes
3. For each changed file, map the change back to the active OpenSpec task
   in `openspec/changes/<active-change>/tasks.md`
4. Produce a structured report in this format:

---

## Session diff report

### Files changed
<!-- List each file with one-line reason -->

### Spec alignment
<!-- For each change: does it match a task in tasks.md? -->
<!-- Flag any changes NOT tied to a task as UNTRACKED -->

### What changed
<!-- Plain-language description of the actual code change -->

### Why it changed
<!-- Rationale from the task spec, or note if undocumented -->

### Next tasks
<!-- Remaining unchecked tasks from tasks.md -->
---

1. Save this report to `.claude/SESSION-DIFF-$(date +%Y-%m-%d).md`
