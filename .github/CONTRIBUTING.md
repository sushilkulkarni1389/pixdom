# Contributing to pixdom

Thank you for your interest in contributing. pixdom is a community project and
we welcome contributions of all kinds — code, documentation, bug reports,
feature ideas, and feedback. Every bit helps.

## Code of Conduct

By participating, you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).
Please read it before contributing.

## Ways to Contribute

You don't have to write code to contribute meaningfully:

- **Report bugs** — open an issue with reproduction steps
- **Request features** — open an issue describing the problem and your idea
- **Improve docs** — fix typos, clarify confusing sections, add examples
- **Write tests** — we always welcome better test coverage
- **Review PRs** — thoughtful reviews are genuinely valuable
- **Share the project** — if pixdom helped you, tell someone

## Development Setup

Prerequisites: Node.js 18+, pnpm 9+
```bash
# Clone the repo
git clone https://github.com/sushilkulkarni1389/pixdom.git
cd pixdom

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Typecheck
pnpm typecheck
```

## Project Structure
```
pixdom/
├── apps/
│   ├── cli/          # Command-line interface
│   └── mcp-server/   # MCP server integration
├── packages/
│   ├── core/         # Core rendering logic (Playwright + Sharp + FFmpeg)
│   ├── detector/     # Animation and content detection
│   ├── profiles/     # Platform presets (LinkedIn, Twitter, Instagram, etc.)
│   └── types/        # Shared TypeScript types and Zod schemas
├── docs/             # Documentation and assets
└── openspec/         # OpenAPI specification
```

## Branching and Commits

Create a branch from `main` using these prefixes:
```bash
git checkout -b feat/your-feature-name
git checkout -b fix/issue-description
git checkout -b docs/what-you-updated
git checkout -b chore/what-you-cleaned-up
```

We follow [Conventional Commits](https://www.conventionalcommits.org):
```
feat: add Instagram Reel export support
fix: resolve sharp resize issue on ARM
docs: add usage example for CLI batch mode
chore: update playwright to 1.59
```

Stage files explicitly — avoid `git add .` when possible:
```bash
git add packages/profiles/src/index.ts
git commit -m "feat: add TikTok profile preset"
```

## Pull Request Process

1. Fork the repo and create your branch from `main`
2. Make your changes with clear, focused commits
3. Ensure `pnpm build` and `pnpm test` pass locally
4. Open a PR against `main` with a clear description
5. Fill out the PR template completely
6. A maintainer will review within 5 business days

Keep PRs focused — one feature or fix per PR makes review faster and merges cleaner.

## Reporting Bugs

Use the [bug report template](https://github.com/sushilkulkarni1389/pixdom/issues/new?template=bug_report.md).

Please include:
- Your OS and Node.js version
- Exact steps to reproduce
- What you expected vs. what happened
- Relevant logs or screenshots

## Requesting Features

Use the [feature request template](https://github.com/sushilkulkarni1389/pixdom/issues/new?template=feature_request.md).

Check existing issues first — your idea may already be tracked.

## Good First Issues

New to the codebase? Look for issues labeled [`good first issue`](https://github.com/sushilkulkarni1389/pixdom/labels/good%20first%20issue).

These are intentionally scoped to be approachable without deep knowledge of
the full codebase. If you're unsure where to start, open an issue and ask —
we're happy to point you in the right direction.

## Recognition

Contributors are credited in release changelogs. If you'd prefer to be listed
under a specific name or handle, mention it in your PR.
