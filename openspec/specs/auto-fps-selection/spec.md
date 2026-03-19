# auto-fps-selection — requirements

### Requirement: autoDetectFps function signature
`packages/detector` SHALL export a function `autoDetectFps(page: Page, selector?: string): Promise<number>` where `Page` is imported from `playwright`. The function SHALL never throw; all errors SHALL be caught internally and result in the default value of `12`. The `selector` parameter, when provided, scopes the timing-function query to that element and its descendants.

#### Scenario: Return type is number
- **WHEN** TypeScript compiles a consumer that assigns the result to `number`
- **THEN** no type error is emitted

#### Scenario: Error in page.evaluate returns 12
- **WHEN** `page.evaluate()` rejects inside `autoDetectFps`
- **THEN** the function resolves with `12` and does not throw

### Requirement: FPS selection based on animation timing function
`autoDetectFps` SHALL query `getComputedStyle` via `page.evaluate()` on the scoped element subtree (or all elements if no selector provided) and inspect `animation-timing-function` values. If any element has a non-linear timing function (`ease`, `ease-in`, `ease-out`, `ease-in-out`, or any `cubic-bezier(...)` that is not equivalent to `linear`), the function SHALL return `24`. If only `linear` timing or CSS transitions (no `animation-timing-function`) are found, it SHALL return `12`.

#### Scenario: ease-in-out timing returns 24
- **WHEN** the page has an element with `animation-timing-function: ease-in-out`
- **THEN** `autoDetectFps` returns `24`

#### Scenario: cubic-bezier non-linear returns 24
- **WHEN** the page has an element with `animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1)`
- **THEN** `autoDetectFps` returns `24`

#### Scenario: linear timing returns 12
- **WHEN** all animated elements have `animation-timing-function: linear`
- **THEN** `autoDetectFps` returns `12`

#### Scenario: No animation-timing-function found returns 12
- **WHEN** the page has only CSS transitions (no `animation-timing-function` values)
- **THEN** `autoDetectFps` returns `12`

#### Scenario: Selector scopes the timing function query
- **WHEN** `autoDetectFps(page, '#card')` is called and only elements outside `#card` have non-linear timing
- **THEN** `autoDetectFps` returns `12` (only the scoped subtree is inspected)

### Requirement: Frame count ceiling guard
`autoDetectFps` SHALL accept an optional `durationMs` parameter. When provided, after selecting the base FPS (12 or 24), if `fps × (durationMs / 1000)` would exceed 1200 frames, the FPS SHALL be reduced to `Math.floor(1200 / (durationMs / 1000))`. The reduced value SHALL be at least `1`.

#### Scenario: FPS reduced to stay under 1200 frames
- **WHEN** `autoDetectFps(page, undefined, 10000)` is called with a 10-second duration and base FPS of 24
- **THEN** the function returns `120` (24fps × 10s = 240 frames, under limit — no reduction needed) — correction: 24 × 10 = 240, fine; test instead with 60s: `autoDetectFps(page, undefined, 60000)` with base FPS 24 would be 24 × 60 = 1440 > 1200 → reduced to `floor(1200/60) = 20`
- **THEN** the function returns `20`

#### Scenario: FPS not reduced when frame count is under ceiling
- **WHEN** `autoDetectFps(page, undefined, 3500)` is called with base FPS 24
- **THEN** `24 × 3.5 = 84` frames is under 1200 and the function returns `24`

#### Scenario: Reduced FPS is at least 1
- **WHEN** duration is extremely long and ceiling math would produce 0
- **THEN** `autoDetectFps` returns `1`
