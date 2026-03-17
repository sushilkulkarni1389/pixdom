# Layer 4 — Animation Detector
Load ONLY when working on Layer 4 — Animation Detector tasks.

## Goal
Detect CSS/JS animation cycles in a Playwright page and return a duration estimate via a fallback chain.

## Folder / File Structure to Create

```
packages/detector/src/
├── css-detector.ts       # Extract CSS animation-duration + transition values
├── js-detector.ts        # Detect rAF loops, GSAP, Web Animations API
├── cycle-estimator.ts    # LCM of detected durations, min/max clamp
├── fallback-chain.ts     # CSS → JS → userHint → default(3000ms)
├── errors.ts             # DetectorError type
└── index.ts              # detectAnimationCycle(page, userHint?)
```

## Key Interfaces

```typescript
// from @html2asset/types
interface CycleEstimate {
  durationMs: number
  source: 'css' | 'js' | 'user-hint' | 'default'
  confidence: 'high' | 'medium' | 'low'
}

interface DetectorError {
  code: 'BROWSER_ERROR' | 'EVALUATION_FAILED' | 'TIMEOUT'
  message: string
  cause?: unknown
}
```

## CSS Detector Logic

- Inject `page.evaluate()` script to read all CSSStyleSheet rules
- Extract `animation-duration` and `transition-duration` values
- Parse `s` and `ms` units to milliseconds
- Return array of millisecond values

## Cycle Estimator Logic

- `lcm(a, b) = (a * b) / gcd(a, b)` — reduce array with fold
- Clamp result: min 500ms, max 30,000ms
- If single duration: return it directly (LCM of one = itself)

## Fallback Chain

```
detectCss(page) → if empty →
detectJs(page)  → if empty →
userHint        → if undefined →
3000ms (default)
```

## Hard Rules

- All `page.evaluate()` calls wrapped in try/catch — return `err()` on `EvaluationError`
- Never import `Page` type directly — import from `playwright` as type-only import
- Detector has no knowledge of profiles or output format — pure duration detection

## Definition of Done

- `detectAnimationCycle` returns `durationMs` within 50ms of known CSS `animation-duration`
- Returns `{ source: 'default', durationMs: 3000 }` for pages with no animation
- LCM is correctly computed: lcm(1000, 1500) = 3000
- Clamped at 30,000ms maximum
- All tests pass with Playwright mocked
