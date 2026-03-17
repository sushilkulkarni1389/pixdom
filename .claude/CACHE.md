# CACHE STRATEGY — html2asset

---

## Section A — Anthropic Prompt Caching (In-App LLM Calls)

### What to Cache
Cache content that is large and **does not change between requests**:

- System prompt for `generate_and_convert` tool (HTML generation instructions, platform constraints)
- Platform profile definitions passed as context to Claude
- Static reference content (CSS reset, animation pattern library)

### What NOT to Cache

- User HTML input (changes every call)
- Dynamic render options (format, dimensions, output path)
- Conversation history in multi-turn flows

### TypeScript Pattern

```typescript
// apps/mcp-server/src/handlers/generate.handler.ts
import Anthropic from '@anthropic-ai/sdk'
import { env } from '@html2asset/types/env'

const client = new Anthropic()

const SYSTEM_PROMPT = `You are an expert HTML/CSS animator...
[~2000 tokens of stable instructions]`

export async function generateHtml(userPrompt: string, profile: PlatformProfile) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },  // ← cache the stable system prompt
      },
      {
        type: 'text',
        text: `Target profile: ${JSON.stringify(profile)}`,
        cache_control: { type: 'ephemeral' },  // ← cache the profile context too
      },
    ],
    messages: [
      { role: 'user', content: userPrompt },  // ← NOT cached — changes every call
    ],
  })
  return response
}
```

### Cache Minimum
Anthropic caches blocks ≥ 1024 tokens. Ensure `SYSTEM_PROMPT` is ≥ 1024 tokens or combine stable blocks.

### Estimated Savings

| Scenario | Without Cache | With Cache | Saving |
|---|---|---|---|
| generate_and_convert (repeated profile) | ~2500 input tokens | ~200 input tokens | ~92% on system |
| Batch of 10 social posts (same profile) | 25,000 tokens | ~3,800 tokens | ~85% |
| Per-call cost @Sonnet pricing | $0.0075 | $0.0006 | ~92% |

---

## Section B — Claude Code Session Efficiency

| Mechanism | Token-Saving Effect |
|---|---|
| `.claudeignore` | Prevents auto-ingestion of `node_modules`, `dist`, lock files — saves 10k–50k tokens per session |
| Scoped context files (`.claude/context/*.md`) | Load 100–150 tokens of layer context vs 5k+ tokens of full codebase scan |
| `PROGRESS.md` as state store | Eliminates need to re-explain project state — one file read vs full conversation replay |
| Explicit `#file` references | Loads only the referenced file, not the whole directory tree |
| One role per session | Prevents scope bleed — implementer doesn't speculatively read test files or UI code |
| Layer-boundary commits | Clean checkpoint means `/clear` is safe — no need to recap uncommitted work |

---

## Implementation Checklist

- [ ] `SYSTEM_PROMPT` in `generate.handler.ts` is ≥ 1024 tokens
- [ ] `cache_control: { type: "ephemeral" }` on all stable system message blocks
- [ ] `.claudeignore` blocks all build outputs and lock files
- [ ] Each layer has its own context file ≤ 150 lines
- [ ] `PROGRESS.md` updated at every session end
- [ ] Layer committed before starting next layer
