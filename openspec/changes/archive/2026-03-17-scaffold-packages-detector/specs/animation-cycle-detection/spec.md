## ADDED Requirements

### Requirement: Package scaffold
`packages/detector` SHALL be a valid pnpm workspace package named `@pixdom/detector` with `package.json`, `tsconfig.json`, and `src/index.ts`. It SHALL declare `playwright` as a peer dependency and `@pixdom/types` as a workspace dependency. It SHALL have zero other monorepo-internal imports.

#### Scenario: Package resolves in workspace
- **WHEN** another package declares `"@pixdom/detector": "workspace:*"` in its dependencies
- **THEN** TypeScript resolves all named exports from `packages/detector/src/index.ts`

#### Scenario: No circular imports
- **WHEN** `packages/detector/src/index.ts` is statically analysed
- **THEN** no import path resolves to another `packages/*` or `apps/*` workspace package except `@pixdom/types`

### Requirement: detectAnimationCycle function signature
`packages/detector` SHALL export a function `detectAnimationCycle(page: Page): Promise<number | null>` where `Page` is imported from `playwright`. The function SHALL never throw; all errors SHALL be caught internally and result in a `null` return.

#### Scenario: Static page returns null
- **WHEN** `detectAnimationCycle(page)` is called on a page with no CSS animations and no rAF-driven DOM changes
- **THEN** it returns `null`

#### Scenario: Return type is number or null
- **WHEN** TypeScript compiles a consumer that assigns the result to `number | null`
- **THEN** no type error is emitted

### Requirement: CSS duration detection
`detectAnimationCycle` SHALL inspect the computed `animation-duration` and `transition-duration` of all DOM elements via `page.evaluate()`. If any element has a non-zero, finite computed duration, the function SHALL return the maximum such duration converted to milliseconds.

#### Scenario: CSS keyframe animation detected
- **WHEN** the page contains an element with `animation: spin 1.2s linear infinite`
- **THEN** `detectAnimationCycle` returns `1200` (±50ms tolerance for floating-point conversion)

#### Scenario: CSS transition detected
- **WHEN** the page contains an element with `transition: opacity 0.8s ease`
- **THEN** `detectAnimationCycle` returns `800` (±50ms)

#### Scenario: Multiple durations — longest wins
- **WHEN** the page has elements with durations `0.5s` and `2s`
- **THEN** `detectAnimationCycle` returns `2000`

### Requirement: rAF sampling fallback
When CSS duration detection returns zero or is inconclusive, `detectAnimationCycle` SHALL fall back to requestAnimationFrame sampling via `page.evaluate()`. It SHALL collect at least 15 consecutive frame timestamps, compute the median inter-frame delta, and extrapolate a cycle estimate. If no consistent frame pattern is found, it SHALL return `null`.

#### Scenario: JS-driven rAF animation detected
- **WHEN** the page runs a `requestAnimationFrame` loop that mutates the DOM at ~60fps
- **THEN** `detectAnimationCycle` returns a non-null value within ±100ms of the actual cycle length

#### Scenario: No rAF activity returns null
- **WHEN** the page has no active `requestAnimationFrame` callbacks after the sampling window
- **THEN** `detectAnimationCycle` returns `null`

### Requirement: Serialisable page.evaluate calls
All calls to `page.evaluate()` inside `detectAnimationCycle` SHALL pass only plain serialisable values (primitives, plain objects, arrays). No functions, class instances, or non-serialisable types SHALL be passed as arguments or expected in return values.

#### Scenario: evaluate argument is serialisable
- **WHEN** each `page.evaluate()` call in the detector is statically inspected
- **THEN** every argument passed to the function parameter is a primitive or plain JSON-compatible value

### Requirement: Error containment
`detectAnimationCycle` SHALL catch all exceptions thrown during CSS inspection or rAF sampling and return `null` instead of propagating the error.

#### Scenario: page.evaluate throws
- **WHEN** `page.evaluate()` rejects (e.g., page navigated away mid-call)
- **THEN** `detectAnimationCycle` resolves with `null` and does not throw
