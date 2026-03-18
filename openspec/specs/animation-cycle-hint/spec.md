# animation-cycle-hint — requirements

### Requirement: Cycle length pattern scanner
`packages/core` SHALL export a pure function `scanForCycleLengths(html: string): string[]` that scans HTML/JS source for numeric patterns that likely represent animation cycle lengths. The function SHALL return up to 3 candidate hint strings in descending confidence order. If no candidates are found, it SHALL return an empty array.

#### Scenario: No candidates returns empty array
- **WHEN** `scanForCycleLengths('<div>hello</div>')` is called
- **THEN** the function returns `[]`

#### Scenario: CSS animation-duration detected
- **WHEN** `scanForCycleLengths('<style>div { animation-duration: 1.5s; }</style>')` is called
- **THEN** the function returns a hint string containing `1500` (ms) and mentioning `--duration 1500`

#### Scenario: JS variable assignment detected
- **WHEN** `scanForCycleLengths('<script>const CYCLE = 3000;</script>')` is called
- **THEN** the function returns a hint string containing `3000` and mentioning `--duration 3000`

#### Scenario: rAF comparison detected
- **WHEN** `scanForCycleLengths('<script>if (t >= 14) { t = 0; }</script>')` is called
- **THEN** the function returns a hint string interpreting `14` as `14000ms` (seconds → ms conversion) and mentioning `--duration 14000`

#### Scenario: Multiple candidates capped at 3
- **WHEN** the page source contains 5 different duration patterns
- **THEN** `scanForCycleLengths()` returns exactly 3 hint strings

### Requirement: Hints attached to NO_ANIMATION_DETECTED error
When `render()` is about to return `{ code: 'NO_ANIMATION_DETECTED' }`, it SHALL call `scanForCycleLengths(await page.content())` and attach the result to `RenderError.hints`. If no candidates are found, `hints` SHALL be an empty array (not omitted).

#### Scenario: Hints field present on NO_ANIMATION_DETECTED
- **WHEN** `render({ format: 'gif', input: { type: 'html', html: '<div></div>' }, ... })` returns `NO_ANIMATION_DETECTED`
- **THEN** `result.error.hints` is an array (possibly empty)

#### Scenario: Hints field populated from page source
- **WHEN** `render({ format: 'gif', input: { type: 'html', html: '<style>div{animation-duration:2s}</style><div class="x"></div>' }, ... })` returns `NO_ANIMATION_DETECTED`
- **THEN** `result.error.hints` contains at least one string mentioning `2000`

### Requirement: Error formatter renders hints as Hint lines
The error formatter SHALL render each string in `error.hints` as an indented `Hint:` line below `How to fix:` when formatting a `NO_ANIMATION_DETECTED` error.

#### Scenario: Hint lines appear in stderr
- **WHEN** `formatError()` is called with `{ code: 'NO_ANIMATION_DETECTED', hints: ['Found possible cycle: 2s → try --duration 2000'] }`
- **THEN** stderr contains a line starting with `  Hint:` containing `--duration 2000`

#### Scenario: No hint lines when hints is empty
- **WHEN** `formatError()` is called with `{ code: 'NO_ANIMATION_DETECTED', hints: [] }`
- **THEN** stderr does NOT contain any `Hint:` line
