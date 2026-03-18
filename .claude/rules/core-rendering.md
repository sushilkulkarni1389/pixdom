---
paths:
  - "packages/core/**/*.ts"
---

# Rules — Core Rendering Engine

1. Every `Browser` instance MUST be closed in a `finally` block — no exceptions.
2. Temporary frame files MUST be written to `os.tmpdir()` and deleted in `finally`.
3. FFmpeg MUST be spawned via `child_process.spawn()` with explicit string-array args — never `fluent-ffmpeg`, never `{ shell: true }`.
4. `render()` MUST return `Result<RenderOutput, RenderError>` — never throw to callers.
5. URL inputs MUST be validated (http/https scheme only) before passing to Playwright.
6. Never call `page.goto()` with a raw inline HTML string — use `page.setContent()` for inline.
7. Sharp operations MUST use the async API — `.toFile()` not `.toFileSync()`.
8. `chromium.launch()` MUST NOT include `--no-sandbox` by default. Sandbox is required. To opt out (CI/containers only), set `PIXDOM_NO_SANDBOX=1` env var — this prints a warning and adds `--no-sandbox --disable-setuid-sandbox`. Hardening args `--disable-extensions --disable-plugins --disable-background-networking --disable-webrtc` MUST always be present.
9. Import `Page` from `playwright` as type-only: `import type { Page } from 'playwright'`.
10. No `console.log` in `packages/core` — use a passed-in logger or emit events.
