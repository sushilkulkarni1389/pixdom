## MODIFIED Requirements

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
