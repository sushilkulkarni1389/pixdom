## ADDED Requirements

### Requirement: autoDetectElement function signature
`packages/detector` SHALL export a function `autoDetectElement(page: Page): Promise<{ selector: string; width: number; height: number } | null>` where `Page` is imported from `playwright`. The function SHALL never throw; all errors SHALL be caught internally and result in a `null` return. A `null` return indicates no suitable element was found and the caller SHALL fall back to full-viewport capture.

#### Scenario: Return type is object or null
- **WHEN** TypeScript compiles a consumer that assigns the result to `{ selector: string; width: number; height: number } | null`
- **THEN** no type error is emitted

#### Scenario: Static page with no candidates returns null
- **WHEN** the page contains only `<body>` and `<html>` elements (no other block-level children)
- **THEN** `autoDetectElement` returns `null`

#### Scenario: Error in page.evaluate returns null
- **WHEN** `page.evaluate()` rejects inside `autoDetectElement`
- **THEN** the function resolves with `null` and does not throw

### Requirement: Element scoring algorithm
`autoDetectElement` SHALL score all visible block-level elements (`div`, `section`, `article`, `main`, `figure`, `canvas`, `svg`) via `page.evaluate()` using the following rules:
- **Visibility exclusion**: elements with `display: none`, `visibility: hidden`, or `opacity: 0` SHALL be excluded
- **Layout wrapper exclusion**: `<body>`, `<html>`, and elements whose `getBoundingClientRect().width` is ≥ 95% of `window.innerWidth` SHALL be excluded
- **Area score**: `width × height` of the element's bounding box
- **Centrality score**: inverse distance from element center to page center — elements closer to center score higher
- **Depth penalty**: the element's DOM depth (number of ancestor nodes) subtracted from the score as a multiplier reduction
- The combined score SHALL determine the winner

#### Scenario: Centred card element wins over full-width header
- **WHEN** the page contains a centred `<div id="card">` at 350×520 and a full-width `<header>` at 1280×80
- **THEN** `autoDetectElement` returns a selector resolving to the card element (full-width header excluded by 95% rule)

#### Scenario: Deeper nested element loses to shallower peer with same area
- **WHEN** two `<div>` elements have identical bounding boxes but one is nested 5 levels deeper
- **THEN** `autoDetectElement` returns the selector for the shallower element

#### Scenario: Invisible element excluded
- **WHEN** the page has a `<div>` with `opacity: 0` and a visible `<section>`
- **THEN** `autoDetectElement` returns a selector for the visible `<section>`, not the invisible div

### Requirement: Ambiguous detection fallback
When the top two candidates' combined scores are within 10% of each other, `autoDetectElement` SHALL return `null` to signal ambiguity. The caller is responsible for printing an ambiguity warning and falling back to full-viewport capture.

#### Scenario: Ambiguous scores return null
- **WHEN** the two highest-scoring elements have scores of 1000 and 960 (within 10%)
- **THEN** `autoDetectElement` returns `null`

#### Scenario: Clear winner does not return null
- **WHEN** the highest-scoring element scores 1000 and the second scores 800 (more than 10% difference)
- **THEN** `autoDetectElement` returns a non-null result

### Requirement: Selector string generation
The selector returned by `autoDetectElement` SHALL be the most specific stable identifier available for the winning element, chosen in this priority order: `#id` → `.unique-class` (a class present on only one element in the page) → `tagName:nth-child(n)` path. The selector SHALL be verified inside `page.evaluate()` by confirming `document.querySelector(selector)` returns the same element.

#### Scenario: Element with id returns id selector
- **WHEN** the winning element has `id="card"`
- **THEN** the returned selector is `"#card"`

#### Scenario: Element without id but unique class returns class selector
- **WHEN** the winning element has `class="hero-banner"` and no other element shares that class
- **THEN** the returned selector is `".hero-banner"`

#### Scenario: Selector resolves to winning element
- **WHEN** `document.querySelector(returned_selector)` is evaluated in the same page
- **THEN** it returns the same element that was selected as the winner
