## ADDED Requirements

### Requirement: onProgress callback in render()
`render()` SHALL accept an optional `onProgress?: (event: ProgressEvent) => void` parameter as part of a second options argument or directly alongside `RenderOptions`. When omitted or `undefined`, all progress event calls SHALL be no-ops. The callback SHALL be forwarded to the static renderer, animated renderer, and image renderer.

`ProgressEvent` SHALL be a discriminated union exported from `packages/core`:
```ts
export type ProgressEvent =
  | { type: 'step-start'; step: string }
  | { type: 'step-done'; step: string }
  | { type: 'frame-progress'; current: number; total: number }
  | { type: 'encode-progress'; pct: number }
  | { type: 'encode-format'; format: string };
```

#### Scenario: onProgress omitted — render succeeds without callback
- **WHEN** `render(options)` is called without an `onProgress` argument
- **THEN** `render()` completes successfully and no error is thrown

#### Scenario: onProgress receives step-start and step-done for page load
- **WHEN** `render(options, { onProgress: handler })` is called with an HTML input
- **THEN** `handler` is called with `{ type: 'step-start', step: 'load-page' }` before page load and `{ type: 'step-done', step: 'load-page' }` after

#### Scenario: onProgress receives step events for selector resolution
- **WHEN** `render({ ...options, selector: '#x' }, { onProgress: handler })` is called
- **THEN** `handler` is called with step events for selector resolution after page load

#### Scenario: ProgressEvent type exported from core
- **WHEN** TypeScript code does `import type { ProgressEvent } from '@pixdom/core'`
- **THEN** compilation succeeds and all event variants are accessible
