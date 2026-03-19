import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { render } from '@pixdom/core';
import { getProfile } from '@pixdom/profiles';
import type { ProfileId, RenderOptions, OutputFormat } from '@pixdom/types';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

// --- Output directory ---
const OUTPUT_DIR = resolve(process.cwd(), 'output');

// --- System prompt (loaded at startup) ---
let systemPrompt: string;

// --- Helpers ---

function resolveRenderOptions(params: {
  html: string;
  profile?: string;
  format?: string;
  width?: number;
  height?: number;
  quality?: number;
}): RenderOptions {
  let width = 1280;
  let height = 720;
  let format: OutputFormat = 'png';
  let quality: number | undefined = 90;

  if (params.profile) {
    const profile = getProfile(params.profile as ProfileId);
    width = profile.width;
    height = profile.height;
    format = profile.format as OutputFormat;
    quality = profile.quality;
  }

  // Individual flags override profile
  if (params.format) format = params.format as OutputFormat;
  if (params.width) width = params.width;
  if (params.height) height = params.height;
  if (params.quality !== undefined) quality = params.quality;

  return {
    input: { type: 'html', html: params.html },
    format,
    viewport: { width, height, deviceScaleFactor: 1 },
    quality,
  };
}

async function writeOutput(
  buffer: Buffer,
  format: string,
  customPath?: string,
): Promise<string> {
  const outputPath = customPath
    ? resolve(customPath)
    : join(OUTPUT_DIR, `${randomUUID()}.${format}`);
  await writeFile(outputPath, buffer);
  return outputPath;
}

// --- MCP Server ---

const server = new McpServer(
  { name: 'pixdom', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

// --- Tool: convert_html_to_asset ---

server.registerTool(
  'convert_html_to_asset',
  {
    description:
      'Convert an HTML string to an image or animated asset (PNG, JPEG, WebP, GIF, MP4, WebM).',
    inputSchema: {
      html: z.string().describe('HTML markup to render'),
      profile: z
        .enum(['instagram', 'twitter', 'linkedin', 'square'])
        .optional()
        .describe('Platform preset to apply'),
      format: z
        .enum(['png', 'jpeg', 'webp', 'gif', 'mp4', 'webm'])
        .optional()
        .default('png')
        .describe('Output format'),
      width: z.number().int().min(1).max(7680).optional().default(1280).describe('Viewport width (1–7680)'),
      height: z.number().int().min(1).max(4320).optional().default(720).describe('Viewport height (1–4320)'),
      quality: z.number().min(0).max(100).optional().default(90).describe('Output quality (0-100)'),
      output: z.string().optional().describe('Custom output file path'),
    },
  },
  async (params) => {
    try {
      const options = resolveRenderOptions(params);
      const result = await render(options);

      if (!result.ok) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: result.error.message }],
        };
      }

      const outputPath = await writeOutput(result.value, options.format, params.output);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              path: outputPath,
              format: options.format,
              width: options.viewport.width,
              height: options.viewport.height,
            }),
          },
        ],
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        isError: true,
        content: [{ type: 'text' as const, text: message }],
      };
    }
  },
);

// --- Tool: generate_and_convert ---

server.registerTool(
  'generate_and_convert',
  {
    description:
      'Generate HTML from a plain-text prompt using Claude, then render it to an image or animated asset.',
    inputSchema: {
      prompt: z.string().describe('Plain-text description of the desired visual'),
      profile: z
        .enum(['instagram', 'twitter', 'linkedin', 'square'])
        .optional()
        .describe('Platform preset to apply'),
      format: z
        .enum(['png', 'jpeg', 'webp', 'gif', 'mp4', 'webm'])
        .optional()
        .default('png')
        .describe('Output format'),
      width: z.number().int().min(1).max(7680).optional().default(1280).describe('Viewport width (1–7680)'),
      height: z.number().int().min(1).max(4320).optional().default(720).describe('Viewport height (1–4320)'),
      quality: z.number().min(0).max(100).optional().default(90).describe('Output quality (0-100)'),
      model: z
        .string()
        .optional()
        .default('claude-haiku-4-5-20251001')
        .describe('Claude model to use for HTML generation'),
      output: z.string().optional().describe('Custom output file path'),
    },
  },
  async (params) => {
    try {
      const anthropic = new Anthropic();

      const message = await anthropic.messages.create({
        model: params.model ?? 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: params.prompt }],
      });

      const html = message.content
        .filter((block) => block.type === 'text')
        .map((block) => (block as { type: 'text'; text: string }).text)
        .join('');

      const options = resolveRenderOptions({ ...params, html });
      const result = await render(options);

      if (!result.ok) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: result.error.message }],
        };
      }

      const outputPath = await writeOutput(result.value, options.format, params.output);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              path: outputPath,
              format: options.format,
              width: options.viewport.width,
              height: options.viewport.height,
            }),
          },
        ],
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        isError: true,
        content: [{ type: 'text' as const, text: message }],
      };
    }
  },
);

// --- Start ---

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  try {
    systemPrompt = await readFile('.claude/context/claude-integration.md', 'utf-8');
  } catch {
    systemPrompt =
      'You are an HTML generation assistant. Output only valid, complete HTML markup with no explanation or markdown fencing. The HTML should be self-contained with inline styles.';
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(String(err) + '\n');
  process.exit(1);
});
