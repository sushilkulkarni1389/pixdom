# Layer 1 — Monorepo Setup
Load ONLY when working on Layer 1 — Monorepo Setup tasks.

## Goal
Initialise the pnpm workspace with all package scaffolds, root tsconfig, ESLint, Prettier, and Vitest.

## Folder / File Structure to Create

```
html2asset/
├── package.json                  # root — workspace scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json            # strict base config
├── .eslintrc.cjs
├── prettier.config.cjs
├── vitest.config.ts              # workspace test runner
├── apps/
│   ├── cli/package.json
│   └── mcp-server/package.json
└── packages/
    ├── types/package.json
    ├── detector/package.json
    ├── profiles/package.json
    └── core/package.json
```

## Key Config Values

### `tsconfig.base.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist"
  }
}
```

### `pnpm-workspace.yaml`

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### Root `package.json` scripts

```json
{
  "scripts": {
    "build": "pnpm -r build",
    "typecheck": "pnpm -r typecheck",
    "lint": "pnpm -r lint",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "dev": "pnpm -r --parallel dev"
  }
}
```

## Hard Rules

- All packages use `"type": "module"` and `"exports"` field — no CommonJS packages
- Each package name is `@html2asset/[package-name]` — scoped to `@html2asset`
- No `devDependencies` in individual packages for shared tools (ESLint, Prettier, Vitest) — root only
- All `tsconfig.json` files must extend `../../tsconfig.base.json`

## Definition of Done

- `pnpm install` exits 0 with no peer dependency warnings
- `pnpm -r typecheck` exits 0 on empty `src/index.ts` stubs in all packages
- `pnpm -r lint` exits 0
- `pnpm test` runs Vitest and reports 0 test suites (no failures)
- All package names resolve correctly in workspace: `pnpm -r ls`
