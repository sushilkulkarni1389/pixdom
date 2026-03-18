## 1. Fix omelette crash on TAB completion

- [x] 1.1 In `apps/cli/src/commands/completion.ts`, wrap `completion.init()` in a try/catch that silently swallows errors, preventing omelette's internal tree-traversal crash from surfacing as a stack trace when flag values are present alongside --file or --image

## 2. Verification

- [x] 2.1 Run `pnpm --filter pixdom build` — no TypeScript errors
