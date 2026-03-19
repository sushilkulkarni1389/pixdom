# animation-cycle-detection — requirements

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
`detectAnimationCycle` SHALL inspect the computed `animation-duration` and `transition-duration` of all DOM elements via `page.evaluate()`. If any element has a non-zero, finite `animation-duration`, the function SHALL include it in the maximum-duration calculation. `transition-duration` values SHALL only be included if they are **500ms or greater** OR if the same element also has a non-zero `animation-duration`. This prevents short UI hover transitions from being mistaken for content animation cycles.

#### Scenario: CSS keyframe animation detected
- **WHEN** the page contains an element with `animation: spin 1.2s linear infinite`
- **THEN** `detectAnimationCycle` returns `1200` (±50ms tolerance for floating-point conversion)

#### Scenario: Long CSS transition detected
- **WHEN** the page contains an element with `transition: opacity 0.8s ease`
- **THEN** `detectAnimationCycle` returns `800` (±50ms)

#### Scenario: Short UI transition ignored
- **WHEN** the page contains only elements with `transition-duration` under 500ms and no `animation-duration`
- **THEN** `detectAnimationCycle` returns `null` (CSS phase yields 0; rAF phase finds no mutations)

#### Scenario: Short transition ignored even if it is the longest duration
- **WHEN** the page has elements with `transition: color 0.2s` and `transition: background 0.3s` but no `animation-duration`
- **THEN** `detectAnimationCycle` returns `null`

#### Scenario: Element with both animation and short transition — full duration counted
- **WHEN** an element has `animation-duration: 2s` and `transition-duration: 0.2s`
- **THEN** `detectAnimationCycle` returns `2000` (the animation duration; transition is also eligible but animation wins as the max)

#### Scenario: Multiple durations — longest eligible duration wins
- **WHEN** the page has elements with `animation-duration: 0.5s` and `animation-duration: 2s`
- **THEN** `detectAnimationCycle` returns `2000`

### Requirement: rAF sampling fallback
When CSS duration detection returns zero or is inconclusive, `detectAnimationCycle` SHALL fall back to DOM mutation observation via `page.evaluate()`. It SHALL observe DOM mutations over a sampling window and return a cycle estimate if mutations are detected. If no DOM mutations are observed, it SHALL return `null`.

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


### Requirement: autoDetectDuration function signature
`packages/detector` SHALL export a function `autoDetectDuration(page: Page, selector?: string): Promise<{ durationMs: number; strategy: 'css-lcm' | 'css-transition' | 'source-pattern' } | null>` where `Page` is imported from `playwright`. The function SHALL never throw; all errors SHALL be caught internally and result in a `null` return. A `null` return indicates no animation cycle was detected via any strategy.

#### Scenario: Return type is object or null
- **WHEN** TypeScript compiles a consumer that assigns the result to `{ durationMs: number; strategy: string } | null`
- **THEN** no type error is emitted

#### Scenario: Error containment
- **WHEN** any internal `page.evaluate()` call throws inside `autoDetectDuration`
- **THEN** the function resolves with `null` and does not throw

### Requirement: Strategy 1 — CSS animation-duration LCM
When `autoDetectDuration` is called, it SHALL first query `getComputedStyle` on the scoped element subtree (or all elements if no selector provided) via `page.evaluate()` and collect all non-zero, finite `animation-duration` values. It SHALL compute the LCM of all collected durations (converted to milliseconds, rounded to the nearest integer). If the LCM is ≤ 10 000ms, it SHALL return `{ durationMs: lcm, strategy: 'css-lcm' }`.

#### Scenario: Single animation-duration uses that value
- **WHEN** the page has one element with `animation-duration: 3.5s`
- **THEN** `autoDetectDuration` returns `{ durationMs: 3500, strategy: 'css-lcm' }`

#### Scenario: Multiple coprime durations use LCM
- **WHEN** the page has elements with `animation-duration: 3.5s` and `animation-duration: 2.8s`
- **THEN** `autoDetectDuration` returns `{ durationMs: 9800, strategy: 'css-lcm' }` (LCM of 3500 and 2800 = 9800)

#### Scenario: LCM within 10s cap is used directly
- **WHEN** computed LCM is 9800ms
- **THEN** `autoDetectDuration` returns `{ durationMs: 9800, strategy: 'css-lcm' }`

### Requirement: LCM cap — fallback to longest individual duration
When the LCM computed in Strategy 1 exceeds 10 000ms, `autoDetectDuration` SHALL instead use `Math.max(...durations)` as the cycle length and still return `strategy: 'css-lcm'`. The caller SHALL receive a warning via a separate mechanism (the caller prints it based on the returned strategy and the fact that `durationMs` equals the max rather than the LCM).

#### Scenario: LCM exceeding 10s uses longest individual duration
- **WHEN** the page has elements with `animation-duration: 7s` and `animation-duration: 3s` (LCM = 21 000ms > 10 000ms)
- **THEN** `autoDetectDuration` returns `{ durationMs: 7000, strategy: 'css-lcm' }` (longest individual)

### Requirement: Strategy 2 — CSS transition-duration fallback
When Strategy 1 finds no `animation-duration` values, `autoDetectDuration` SHALL inspect `transition-duration` values via `getComputedStyle()` on the element subtree. It SHALL return the longest transition duration (in ms) that is ≥ 500ms as `{ durationMs: longest, strategy: 'css-transition' }`. Transitions under 500ms SHALL be ignored.

#### Scenario: Long transition used when no animation-duration found
- **WHEN** the page has no `animation-duration` but has `transition: opacity 0.8s ease`
- **THEN** `autoDetectDuration` returns `{ durationMs: 800, strategy: 'css-transition' }`

#### Scenario: Short transitions ignored
- **WHEN** the page has only `transition-duration: 0.2s` and no `animation-duration`
- **THEN** `autoDetectDuration` does not return a css-transition result (falls through to next strategy)

### Requirement: Strategy 3 — Source pattern scan fallback
When Strategies 1 and 2 both yield no result, `autoDetectDuration` SHALL retrieve the page source via `page.content()` and scan for numeric patterns associated with cycle-length keywords: `loop`, `duration`, `cycle`, `interval`, `delay` (case-insensitive, followed by a colon or equals and a number). The largest matched number, interpreted as milliseconds if ≥ 100 else as seconds × 1000, SHALL be returned as `{ durationMs: value, strategy: 'source-pattern' }`.

#### Scenario: Source pattern found as last resort
- **WHEN** page HTML contains `/* loop: 14 */` and no CSS animation/transition durations
- **THEN** `autoDetectDuration` returns `{ durationMs: 14000, strategy: 'source-pattern' }`

#### Scenario: Source value >= 100 treated as ms
- **WHEN** source contains `duration: 3500` and no CSS durations
- **THEN** `autoDetectDuration` returns `{ durationMs: 3500, strategy: 'source-pattern' }`

### Requirement: Strategy 4 — null when all strategies fail
When all three strategies produce no result, `autoDetectDuration` SHALL return `null`. The caller is responsible for warning the user and selecting a static output format.

#### Scenario: Fully static page returns null
- **WHEN** the page has no animation-duration, no transition-duration ≥ 500ms, and no source patterns
- **THEN** `autoDetectDuration` returns `null`
