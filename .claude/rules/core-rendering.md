---
paths:
  - "packages/core/**/*.ts"
---

# Rules — Core Rendering Engine

1. Every `Browser` instance MUST be closed in a `finally` block — no exceptions.
2. Temporary frame files MUST be written to `os.tmpdir()` and deleted in `finally`.
3. All FFmpeg processes MUST have `.on('error', ...)` handlers attached before `.run()`.
4. `render()` MUST return `Result<RenderOutput, RenderError>` — never throw to callers.
5. URL inputs MUST be validated (http/https scheme only) before passing to Playwright.
6. Never call `page.goto()` with a raw inline HTML string — use `page.setContent()` for inline.
7. Sharp operations MUST use the async API — `.toFile()` not `.toFileSync()`.
8. `chromium.launch()` MUST include `args: ['--no-sandbox', '--disable-setuid-sandbox']`.
9. Import `Page` from `playwright` as type-only: `import type { Page } from 'playwright'`.
10. No `console.log` in `packages/core` — use a passed-in logger or emit events.
