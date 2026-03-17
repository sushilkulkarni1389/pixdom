## MODIFIED Requirements

### Requirement: Animation dispatch
`render()` SHALL call `detectAnimationCycle(page)` from `@pixdom/detector` after the page loads **unless `options.duration` is set**, in which case `options.duration` SHALL be used directly as `cycleMs` and `detectAnimationCycle()` SHALL NOT be called. If the resolved `cycleMs` is non-null and the requested `format` is an animated format (`gif | mp4 | webm`), it SHALL delegate to the animated renderer. Otherwise it SHALL delegate to the static renderer.

#### Scenario: Static format uses static renderer
- **WHEN** `format` is `'png'` regardless of animation detection result
- **THEN** the static renderer is used and the result is a PNG buffer

#### Scenario: Animated format with animation uses animated renderer
- **WHEN** `format` is `'mp4'` and `detectAnimationCycle` returns a non-null cycle length
- **THEN** the animated renderer is used

#### Scenario: Animated format with no animation returns error
- **WHEN** `format` is `'gif'` and `detectAnimationCycle` returns `null`
- **THEN** `render()` returns `Result.err({ code: 'NO_ANIMATION_DETECTED', message: '...' })`

#### Scenario: options.duration overrides detection
- **WHEN** `render({ format: 'gif', duration: 2000, ... })` is called
- **THEN** `detectAnimationCycle` is not called and the animated renderer receives `cycleMs = 2000`

#### Scenario: options.duration with static format is ignored
- **WHEN** `render({ format: 'png', duration: 2000, ... })` is called
- **THEN** the static renderer is used and the `duration` field has no effect
