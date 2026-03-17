---
paths:
  - "packages/types/**/*.ts"
  - "packages/profiles/**/*.ts"
---

# Rules — Shared Types and Profiles

1. No `any` type — use `unknown` with type guards or specific union types.
2. Zod schemas MUST use `z.infer<typeof Schema>` to derive TypeScript types — no manual duplication.
3. `packages/types` MUST have zero runtime dependencies except `zod`.
4. `packages/profiles` MUST have zero runtime dependencies except `@html2asset/types`.
5. Profile objects MUST be `Object.freeze()`-d at module level.
6. `env.ts` MUST call `EnvSchema.parse(process.env)` at module load — fail fast on missing vars.
7. `Result<T, E>` error payloads MUST include a `code` string field for programmatic matching.
8. All exports from `packages/types/src/index.ts` MUST be named exports — no default exports.
9. `ProfileId` MUST be a string union type — never an enum — for JSON serialisation compatibility.
10. Env var defaults MUST be set in the Zod schema `.default()` — never in calling code.

```

---

### `.claudeignore`
```

# ============================================================

# CLAUDE CODE IGNORE FILE — html2asset

# Prevents speculative file reads that burn context tokens

# Load any of these explicitly with #path/to/file if genuinely needed

# ============================================================

# ── Node Modules ────────────────────────────────────────────

# Enormous — never relevant to code generation tasks
node_modules/
**/node_modules/

# ── Build Outputs ────────────────────────────────────────────

# Generated files — always read source, not output
dist/
**/dist/
build/
**/.next/
out/
.turbo/
coverage/
**/.cache/

# ── Lock Files ───────────────────────────────────────────────

# Machine-generated — no value in reading
pnpm-lock.yaml
package-lock.json
yarn.lock

# ── Markdown (except critical .claude/ files) ────────────────

# README and docs are verbose — load explicitly only if needed
*.md
!.claude/claude.md
!.claude/PROGRESS.md

# ── Test Files ───────────────────────────────────────────────

# Load explicitly in qa-agent sessions only
**/_.test.ts
**/_.spec.ts
**/**tests**/

# ── Config Files ─────────────────────────────────────────────

# Load explicitly when modifying tooling
.eslintrc.*
prettier.config.*
vitest.config.*
tsconfig*.json
*.config.ts
*.config.cjs
*.config.mjs

# ── Environment Files ─────────────────────────────────────────

# .env files must NEVER be read by Claude
.env
.env.*
!.env.example

# ── IDE & OS ──────────────────────────────────────────────────
.vscode/
.idea/
.DS_Store
Thumbs.db

# ── Log Files ─────────────────────────────────────────────────
_.log
logs/
npm-debug.log_

# ── Generated / Binary Assets ─────────────────────────────────

# Output images and videos from renders — not source files
output/
*.png
*.jpg
*.jpeg
*.gif
*.mp4
*.webm
*.webp

# ── Docker Build Context Artifacts ───────────────────────────
.dockerignore
docker/

# ── v2 Apps (do not touch in v1) ─────────────────────────────
apps/web/

```

---

### `.gitignore`
```

# ── Node ─────────────────────────────────────────────────────
node_modules/
**/node_modules/

# ── Build Outputs ─────────────────────────────────────────────
dist/
**/dist/
build/
out/
.turbo/

# ── Next.js (v2) ──────────────────────────────────────────────
.next/
.vercel/

# ── pnpm ──────────────────────────────────────────────────────
.pnpm-store/

# ── Environment ───────────────────────────────────────────────
.env
.env.local
.env.*.local

# Keep: .env.example is safe to commit

# ── Test Coverage ─────────────────────────────────────────────
coverage/
**/.coverage/
*.lcov

# ── TypeScript ────────────────────────────────────────────────
*.tsbuildinfo

# ── Logs ──────────────────────────────────────────────────────
_.log
logs/
npm-debug.log_
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# ── OS ────────────────────────────────────────────────────────
.DS_Store
Thumbs.db
desktop.ini

# ── IDE ───────────────────────────────────────────────────────
.vscode/
!.vscode/extensions.json
.idea/
*.swp
*.swo

# ── Render Outputs ────────────────────────────────────────────
output/
*.png
*.jpg
*.jpeg
*.gif
*.mp4
*.webm
*.webp

# ── Playwright ────────────────────────────────────────────────
/playwright-report/
/test-results/
.playwright/

# ── Temp Files ────────────────────────────────────────────────
tmp/
temp/
*.tmp

# ── Docker ────────────────────────────────────────────────────

# Keep Dockerfile and docker-compose.yml — ignore runtime volumes
docker-data/
