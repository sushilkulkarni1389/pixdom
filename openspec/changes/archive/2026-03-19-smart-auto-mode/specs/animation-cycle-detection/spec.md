## ADDED Requirements

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
