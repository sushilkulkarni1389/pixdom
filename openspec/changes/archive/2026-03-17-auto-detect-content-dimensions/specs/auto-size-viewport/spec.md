## ADDED Requirements

### Requirement: Auto-size viewport from content dimensions
When `RenderOptions.autoSize` is `true`, `render()` SHALL query the rendered page's `document.documentElement.scrollWidth` and `document.documentElement.scrollHeight` after page load and resize the viewport to match before capture.

#### Scenario: Height auto-detected from content
- **WHEN** `render({ autoSize: true, viewport: { width: 800 }, ... })` is called with content taller than 720px
- **THEN** the captured output height equals the content's `scrollHeight`

#### Scenario: Width auto-detected when not explicitly set
- **WHEN** `render({ autoSize: true, viewport: {} })` is called with content wider than 1280px
- **THEN** the captured output width equals the content's `scrollWidth`

#### Scenario: Explicit width respected when autoSize is true
- **WHEN** `render({ autoSize: true, viewport: { width: 600 } })` is called
- **THEN** the layout width is 600px and only height is auto-detected

#### Scenario: autoSize false preserves existing behavior
- **WHEN** `render({ autoSize: false, viewport: { width: 1280, height: 720 } })` is called
- **THEN** the captured output is exactly 1280×720 regardless of content dimensions

#### Scenario: autoSize omitted preserves existing behavior
- **WHEN** `render({ viewport: { width: 1280, height: 720 } })` is called without `autoSize`
- **THEN** the captured output is exactly 1280×720 regardless of content dimensions
