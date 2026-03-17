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
