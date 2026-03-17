## 1. Package Scaffold

- [x] 1.1 Create `packages/detector/package.json` with name `@pixdom/detector`, `@pixdom/types` workspace dependency, `playwright` peer dependency, and ESM+CJS dual exports
- [x] 1.2 Create `packages/detector/tsconfig.json` extending root tsconfig with `declarationDir` and `outDir`
- [x] 1.3 Create `packages/detector/src/index.ts` exporting `detectAnimationCycle`

## 2. CSS Duration Detection

- [x] 2.1 Implement `cssMaxDuration(page: Page): Promise<number>` — queries all elements via `page.evaluate()`, returns max computed `animation-duration` + `transition-duration` in ms (0 if none)
- [x] 2.2 Ensure all `page.evaluate()` arguments and return values are plain serialisable types

## 3. rAF Sampling Fallback

- [x] 3.1 Implement `rafSampleCycle(page: Page): Promise<number | null>` — collects 15 consecutive rAF timestamps via `page.evaluate()`, computes median inter-frame delta, returns extrapolated cycle or `null`
- [x] 3.2 Ensure rAF sampling handles the case where no active rAF loop is present (returns `null` within a bounded timeout)

## 4. detectAnimationCycle Orchestration

- [x] 4.1 Implement `detectAnimationCycle(page: Page): Promise<number | null>` — calls CSS detection first; if result > 0 returns it, else falls back to rAF sampling
- [x] 4.2 Wrap entire function body in try/catch — catch all exceptions and return `null`

## 5. Verification

- [x] 5.1 Run `tsc --noEmit` in `packages/detector` — zero type errors
- [x] 5.2 Confirm `detectAnimationCycle` returns `null` on a static HTML page (no animation)
- [x] 5.3 Confirm `detectAnimationCycle` returns ~1200 on a page with `animation: spin 1.2s linear infinite`
- [x] 5.4 Confirm `detectAnimationCycle` returns `null` when `page.evaluate()` throws
