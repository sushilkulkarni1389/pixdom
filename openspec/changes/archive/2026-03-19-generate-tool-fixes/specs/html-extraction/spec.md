## ADDED Requirements

### Requirement: robustHtmlExtract function
The MCP server SHALL provide a `robustHtmlExtract(raw: string): string` helper that extracts usable HTML from a raw Claude API response string. The function SHALL apply the following transformations in order:
1. Strip markdown code fences — remove opening ` ```html ` or ` ``` ` lines and the corresponding closing ` ``` ` line
2. Locate the first HTML boundary — the first occurrence of `<!DOCTYPE`, `<html`, or `<` (whichever appears earliest in the string)
3. Slice from that boundary to end of string
4. Trim leading and trailing whitespace

The function SHALL be pure (no side effects) and SHALL NOT throw. If no `<` character is found in the raw string, the function SHALL return an empty string.

#### Scenario: Strips opening markdown fence
- **WHEN** `robustHtmlExtract('` ``` `html\n<!DOCTYPE html>...')` is called
- **THEN** the returned string starts with `<!DOCTYPE html>` and contains no backtick fence markers

#### Scenario: Strips closing markdown fence
- **WHEN** the raw string ends with `\n` ``` `
- **THEN** the returned string does not end with ` ``` `

#### Scenario: Slices from first DOCTYPE
- **WHEN** the raw string is `"Here is your HTML:\n<!DOCTYPE html><html>...</html>"`
- **THEN** the returned string starts with `<!DOCTYPE html>`

#### Scenario: Slices from first html tag when no DOCTYPE
- **WHEN** the raw string is `"Generated output:\n<html><body>hello</body></html>"`
- **THEN** the returned string starts with `<html>`

#### Scenario: Slices from first angle bracket as fallback
- **WHEN** the raw string is `"Result:\n<div class='card'>content</div>"`
- **THEN** the returned string starts with `<div`

#### Scenario: Returns empty string when no HTML found
- **WHEN** `robustHtmlExtract("Sorry, I cannot generate that.")` is called
- **THEN** the returned string is `""`

#### Scenario: Pure HTML input passes through unchanged
- **WHEN** the raw string is already valid HTML starting with `<!DOCTYPE html>`
- **THEN** the returned string equals the trimmed input

### Requirement: GENERATE_EMPTY_HTML error code
The `generate_and_convert` handler SHALL check the result of `robustHtmlExtract()` before passing HTML to `render()`. If the extracted string has fewer than 50 characters, the handler SHALL return `{ isError: true }` with error code `GENERATE_EMPTY_HTML` and `howToFix: "The model returned no usable HTML — try rephrasing your prompt"`. The Claude API SHALL NOT be retried automatically.

#### Scenario: Empty extraction returns structured error
- **WHEN** the Claude API response contains no HTML markup
- **THEN** the tool returns `{ isError: true }` with `error.code === 'GENERATE_EMPTY_HTML'`

#### Scenario: Short extraction (< 50 chars) returns structured error
- **WHEN** `robustHtmlExtract` returns a string of 30 characters
- **THEN** the handler returns `{ isError: true }` with the `GENERATE_EMPTY_HTML` code, not a render error

#### Scenario: Adequate extraction proceeds to render
- **WHEN** `robustHtmlExtract` returns a string of 200 characters of valid HTML
- **THEN** the handler passes the extracted HTML to `render()` and does not return `GENERATE_EMPTY_HTML`
