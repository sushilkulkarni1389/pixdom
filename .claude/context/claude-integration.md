# Layer 8 — Claude Code Integration
Load ONLY when working on Layer 8 — Claude Code Integration tasks.

## Goal
Create `.claude/commands/` slash commands and verify end-to-end Claude Code workflow.

## Folder / File Structure to Create

```
.claude/
└── commands/
    ├── convert.md        # /project:convert slash command
    └── create-post.md    # /project:create-post slash command
```

## `convert.md` — Slash Command Spec

```markdown
---
description: Convert HTML to a platform-ready image or animation
argument-hint: "[--html '<html>' | --file <path> | --url <url>] --format <fmt> [--profile <id>]"
---

Convert the provided HTML into a static or animated asset using the html2asset MCP tool.

Steps:
1. Call the `convert_html_to_asset` MCP tool with the provided arguments
2. Report the output file path and file size
3. If format is gif or mp4, report detected animation duration

Example: /project:convert --html "<h1>Hello</h1>" --format png --profile twitter
```

## `create-post.md` — Slash Command Spec

```markdown
---
description: Generate HTML for a social post and convert it to a platform-ready asset
argument-hint: "<platform> <description> [--format <fmt>] [--style <style>]"
---

Generate a platform-optimised HTML social post and convert it to a shareable image or animation.

Steps:
1. Call the `generate_and_convert` MCP tool with the platform, description, and optional style
2. Report the output file path, dimensions, and format
3. Describe the generated design briefly (colour scheme, layout, animation if present)

Example: /project:create-post twitter "Launching html2asset v1 — convert HTML to images instantly" --format png
```

## Hard Rules

- Slash command `.md` files must include `description` and `argument-hint` in YAML frontmatter
- Commands delegate entirely to MCP tools — no inline Claude logic
- Commands must include at least one example invocation

## Definition of Done

- `/project:convert` available in Claude Code after MCP server registered
- `/project:create-post` available in Claude Code
- Both commands listed in `claude mcp list` output
- Manual smoke test: `/project:convert --html "<h1>test</h1>" --format png` writes output file
