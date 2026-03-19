## MODIFIED Requirements

### Requirement: autoDetectElement function signature
`packages/detector` SHALL export a function `autoDetectElement(page: Page): Promise<AutoElementResult>` where `Page` is imported from `playwright` and `AutoElementResult` is:

```ts
export type AutoElementResult =
  | { selector: string; width: number; height: number; ambiguous: false }
  | { selector: null; width: 0; height: 0; ambiguous: true }
  | null;
```

The `ambiguous: true` variant is returned when the top two candidates' scores are within 10% of each other. A `null` return indicates no suitable element was found. The function SHALL never throw; all errors SHALL be caught internally and result in a `null` return. Callers MUST check the `ambiguous` field before using `selector` for capture — when `ambiguous: true`, callers SHALL fall back to full-viewport capture.

#### Scenario: Return type includes ambiguous variant
- **WHEN** TypeScript compiles a consumer that handles all three variants of `AutoElementResult`
- **THEN** no type error is emitted

#### Scenario: Ambiguous scores return ambiguous variant
- **WHEN** the two highest-scoring elements have scores within 10% of each other
- **THEN** `autoDetectElement` returns `{ selector: null, width: 0, height: 0, ambiguous: true }`

#### Scenario: Static page with no candidates returns null
- **WHEN** the page contains only `<body>` and `<html>` elements
- **THEN** `autoDetectElement` returns `null`

#### Scenario: Error in page.evaluate returns null
- **WHEN** `page.evaluate()` rejects inside `autoDetectElement`
- **THEN** the function resolves with `null` and does not throw

#### Scenario: Clear winner returns non-ambiguous result
- **WHEN** the highest-scoring element scores 1000 and the second scores 800 (>10% gap)
- **THEN** `autoDetectElement` returns `{ selector: string, width: number, height: number, ambiguous: false }`
