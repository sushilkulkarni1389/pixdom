import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { render } from '@pixdom/core';
import type { RenderError } from '@pixdom/core';
import { getProfile } from '@pixdom/profiles';
import { ProfileIdSchema } from '@pixdom/types';
import type { ProfileId, RenderOptions, OutputFormat, RenderInput } from '@pixdom/types';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { validateUrl, validateOutputPath, validateResourceLimits, validateFileInput } from './validate-input.js';

// --- Output directory ---
const OUTPUT_DIR = resolve(process.cwd(), 'output');

// --- System prompt (loaded at startup) ---
let systemPrompt: string;

// --- Helpers ---

// task 1.4: structured error helper
type McpCallToolResult = { isError: true; content: [{ type: 'text'; text: string }] };

function mcpError(code: string, message: string, howToFix: string): McpCallToolResult {
  return {
    isError: true,
    content: [{ type: 'text' as const, text: JSON.stringify({ error: { code, message, howToFix } }) }],
  };
}

// Extracts usable HTML from a raw Claude API response string.
// Strips markdown fences, finds the first HTML boundary, and trims whitespace.
// Returns an empty string if no '<' character is found.
function robustHtmlExtract(raw: string): string {
  // Step 1: strip markdown code fences
  let s = raw
    .replace(/^```html\s*\n?/gm, '')
    .replace(/^```\s*\n?/gm, '')
    .replace(/\n?```\s*$/gm, '');

  // Step 2: slice from first HTML boundary
  const doctype = s.indexOf('<!DOCTYPE');
  const htmlTag = s.indexOf('<html');
  const firstAngle = s.indexOf('<');

  const candidates = [doctype, htmlTag, firstAngle].filter(i => i !== -1);
  if (candidates.length === 0) return '';
  const start = Math.min(...candidates);
  s = s.slice(start);

  // Step 3: trim
  return s.trim();
}

function mcpErrorFromRenderError(err: RenderError): McpCallToolResult {
  const howToFixMap: Record<string, string> = {
    GENERATE_EMPTY_HTML: 'The model returned no usable HTML — try rephrasing your prompt.',
    BROWSER_LAUNCH_FAILED: 'Check that Playwright is installed (`pnpm install`) and Chromium is available.',
    PAGE_LOAD_FAILED: 'Check that the URL or HTML content is valid and accessible.',
    CAPTURE_FAILED: 'Try a static format (png, jpeg, webp) or check for JavaScript errors in the page.',
    ENCODE_FAILED: 'Ensure FFmpeg is installed. For GIF output, try mp4 instead.',
    NO_ANIMATION_DETECTED: 'Add a CSS animation to the page, or use auto: true to detect animations. For static output, use format: "png".',
    SELECTOR_NOT_FOUND: 'Check that the CSS selector matches an element in the rendered HTML.',
    INVALID_FILE_TYPE: 'Use .html or .htm for file input, or .png/.jpg/.jpeg/.webp/.gif for image input.',
    FILE_NOT_FOUND: 'Check that the file path is correct and the file exists.',
    IMAGE_NOT_FOUND: 'Check that the image path is correct and the file exists.',
    SHARP_ERROR: 'Check that the image file is not corrupted and is a supported format.',
    INVALID_URL_PROTOCOL: 'Use http:// or https:// URLs only. file:// and other protocols are not supported.',
    INVALID_URL_HOST: 'Use a public URL, or set allowLocal: true to permit private-network URLs (development only).',
    INVALID_OUTPUT_PATH: 'Use a plain file path without shell metacharacters. Paths under /dev/, /proc/, or /sys/ are not allowed.',
    INVALID_FPS: 'Set fps between 1 and 60.',
    INVALID_DURATION: 'Set duration between 100 and 300000 milliseconds.',
    RESOURCE_LIMIT_EXCEEDED: 'Reduce fps, duration, width, or height. Maximum frame count is 3600.',
  };
  const howToFix = howToFixMap[err.code] ?? 'Check the MCP server logs for details.';
  return mcpError(err.code, err.message, howToFix);
}

// task 2.1: profile enum derived from ProfileIdSchema
const profileEnum = z.enum(ProfileIdSchema.options);

// task 2.2: profile slug list for tool descriptions
const profileSlugList = ProfileIdSchema.options.join(' | ');

function resolveProfile(params: {
  profile?: string;
  format?: string;
  width?: number;
  height?: number;
  quality?: number;
}): { format: OutputFormat; width: number; height: number; quality: number } {
  let width = 1280;
  let height = 720;
  let format: OutputFormat = 'png';
  let quality = 90;

  if (params.profile) {
    const profile = getProfile(params.profile as ProfileId);
    width = profile.width;
    height = profile.height;
    format = profile.format as OutputFormat;
    quality = profile.quality;
  }

  if (params.format) format = params.format as OutputFormat;
  if (params.width) width = params.width;
  if (params.height) height = params.height;
  if (params.quality !== undefined) quality = params.quality;

  return { format, width, height, quality };
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

// task 2.2: tool description with usage examples
const CONVERT_DESCRIPTION = [
  'Convert HTML, a URL, a local HTML file, or a local image to an image or animated asset (PNG, JPEG, WebP, GIF, MP4, WebM).',
  '',
  'Exactly one input must be provided: html, url, file, or image.',
  '',
  'Examples:',
  '  - To capture only a specific element: set selector to "#card"',
  '  - For animated output: set format to "gif" and either use auto: true or set duration',
  `  - For platform-sized output: set profile to "linkedin-post" instead of width/height`,
  '',
  `Available profiles: ${profileSlugList}`,
].join('\n');

server.registerTool(
  'convert_html_to_asset',
  {
    description: CONVERT_DESCRIPTION,
    inputSchema: {
      // task 3.1: four optional input modes
      html: z.string().optional().describe('Inline HTML markup to render'),
      url: z.string().optional().describe('Remote URL to render (http/https only)'),
      file: z.string().optional().describe('Absolute path to a local .html or .htm file'),
      image: z.string().optional().describe('Absolute path to a local image file (.png, .jpg, .jpeg, .webp, .gif) — bypasses the browser'),
      // output options
      profile: profileEnum.optional().describe(`Platform preset to apply. Options: ${profileSlugList}`),
      format: z
        .enum(['png', 'jpeg', 'webp', 'gif', 'mp4', 'webm'])
        .optional()
        .default('png')
        .describe('Output format'),
      width: z.coerce.number().int().min(1).max(7680).optional().default(1280).describe('Viewport width (1–7680). Must be a number, not a string.'),
      height: z.coerce.number().int().min(1).max(4320).optional().default(720).describe('Viewport height (1–4320). Must be a number, not a string.'),
      quality: z.coerce.number().min(0).max(100).optional().default(90).describe('Output quality (0–100). Must be a number, not a string.'),
      output: z.string().optional().describe('Custom output file path'),
      // task 4.1: processing flags
      selector: z.string().optional().describe('CSS selector to capture a specific DOM element (e.g. "#card", ".hero")'),
      auto: z.preprocess(v => v === 'true' ? true : v === 'false' ? false : v, z.boolean()).optional().describe('Enable smart auto mode: automatically detects animated elements, duration, and FPS. Must be boolean true or false, not a string.'),
      autoSize: z.preprocess(v => v === 'true' ? true : v === 'false' ? false : v, z.boolean()).optional().describe('Auto-detect content dimensions and resize viewport to fit. Must be boolean true or false, not a string.'),
      fps: z.coerce.number().int().min(1).max(60).optional().describe('Frame rate for animated output (1–60). Must be a number, not a string.'),
      duration: z.coerce.number().min(100).max(300000).optional().describe('Animation cycle length in milliseconds (100–300000). Must be a number, not a string.'),
      allowLocal: z.preprocess(v => v === 'true' ? true : v === 'false' ? false : v, z.boolean()).optional().describe('Allow localhost and private-network URLs (development only — prints a warning). Must be boolean true or false, not a string.'),
    },
  },
  async (params) => {
    try {
      // task 3.2: exactly-one-input enforcement
      const inputCount = [params.html, params.url, params.file, params.image].filter(
        (v) => v !== undefined,
      ).length;
      if (inputCount !== 1) {
        return mcpError(
          'INVALID_INPUT',
          inputCount === 0
            ? 'No input provided. Exactly one of html, url, file, or image must be supplied.'
            : 'Multiple inputs provided. Exactly one of html, url, file, or image must be supplied.',
          'Provide exactly one of: html (string), url (string), file (string), or image (string).',
        );
      }

      // task 4.2: resource limits
      const limitsErr = validateResourceLimits({
        width: params.width,
        height: params.height,
        fps: params.fps,
        duration: params.duration,
      });
      if (limitsErr) return mcpError(limitsErr.code, limitsErr.message, limitsErr.howToFix);

      // task 4.4: output path validation
      if (params.output) {
        const outErr = validateOutputPath(params.output);
        if (outErr) return mcpError(outErr.code, outErr.message, outErr.howToFix);
      }

      // Build RenderInput — task 3.3–3.6
      let input: RenderInput;

      if (params.url !== undefined) {
        // task 3.3: URL validation
        const urlErr = await validateUrl(params.url, params.allowLocal ?? false);
        if (urlErr) return mcpError(urlErr.code, urlErr.message, urlErr.howToFix);
        input = { type: 'url', url: params.url };

      } else if (params.file !== undefined) {
        // task 3.4: file input validation
        let resolvedPath: string;
        try {
          resolvedPath = realpathSync(params.file);
        } catch {
          return mcpError('FILE_NOT_FOUND', `File "${params.file}" does not exist.`, 'Check that the file path is correct and the file exists.');
        }
        const fileErr = validateFileInput('--file', resolvedPath);
        if (fileErr) return mcpError(fileErr.code, fileErr.message, 'Use .html or .htm for file input.');
        input = { type: 'file', path: resolvedPath };

      } else if (params.image !== undefined) {
        // task 3.5: image input validation
        let resolvedPath: string;
        try {
          resolvedPath = realpathSync(params.image);
        } catch {
          return mcpError('IMAGE_NOT_FOUND', `Image "${params.image}" does not exist.`, 'Check that the image path is correct and the file exists.');
        }
        const imageErr = validateFileInput('--image', resolvedPath);
        if (imageErr) return mcpError(imageErr.code, imageErr.message, 'Use .png, .jpg, .jpeg, .webp, or .gif for image input.');
        input = { type: 'image', path: resolvedPath };

      } else {
        // html
        input = { type: 'html', html: params.html! };
      }

      // task 3.6: build RenderOptions
      const { format, width, height, quality } = resolveProfile(params);
      const options: RenderOptions = {
        input,
        format,
        viewport: { width, height, deviceScaleFactor: 1 },
        quality,
        // task 4.3: processing flags
        selector: params.selector,
        auto: params.auto,
        autoSize: params.autoSize,
        fps: params.fps,
        duration: params.duration,
        allowLocal: params.allowLocal,
      };

      const result = await render(options);

      if (!result.ok) {
        // task 5.2: structured render errors
        return mcpErrorFromRenderError(result.error);
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
      // task 5.3: catch-all
      const message = e instanceof Error ? e.message : String(e);
      return mcpError('INTERNAL_ERROR', message, 'Check the MCP server logs for details.');
    }
  },
);

// --- Tool: generate_and_convert ---

const GENERATE_DESCRIPTION = [
  'Generate HTML from a plain-text prompt using Claude, then render it to an image or animated asset.',
  '',
  'Examples:',
  '  - For animated output: set format to "gif" and either use auto: true or set duration',
  `  - For platform-sized output: set profile to "instagram-post-square" instead of width/height`,
  '  - To capture only a specific element from the generated HTML: set selector to "#card"',
  '',
  `Available profiles: ${profileSlugList}`,
].join('\n');

server.registerTool(
  'generate_and_convert',
  {
    description: GENERATE_DESCRIPTION,
    inputSchema: {
      prompt: z.string().describe('Plain-text description of the desired visual'),
      // task 2.1: full profile enum
      profile: profileEnum.optional().describe(`Platform preset to apply. Options: ${profileSlugList}`),
      format: z
        .enum(['png', 'jpeg', 'webp', 'gif', 'mp4', 'webm'])
        .optional()
        .default('png')
        .describe('Output format'),
      width: z.coerce.number().int().min(1).max(7680).optional().default(1280).describe('Viewport width (1–7680). Must be a number, not a string.'),
      height: z.coerce.number().int().min(1).max(4320).optional().default(720).describe('Viewport height (1–4320). Must be a number, not a string.'),
      quality: z.coerce.number().min(0).max(100).optional().default(90).describe('Output quality (0–100). Must be a number, not a string.'),
      model: z
        .string()
        .optional()
        .default('claude-sonnet-4-20250514')
        .describe('Claude model to use for HTML generation'),
      output: z.string().optional().describe('Custom output file path'),
      // task 6.1: processing flags
      selector: z.string().optional().describe('CSS selector to capture a specific DOM element from the generated HTML'),
      auto: z.preprocess(v => v === 'true' ? true : v === 'false' ? false : v, z.boolean()).optional().describe('Enable smart auto mode: automatically detects animated elements, duration, and FPS. Must be boolean true or false, not a string.'),
      fps: z.coerce.number().int().min(1).max(60).optional().describe('Frame rate for animated output (1–60). Must be a number, not a string.'),
      duration: z.coerce.number().min(100).max(300000).optional().describe('Animation cycle length in milliseconds (100–300000). Must be a number, not a string.'),
    },
  },
  async (params) => {
    try {
      // task 6.2: resource limits before Claude API call
      const limitsErr = validateResourceLimits({
        width: params.width,
        height: params.height,
        fps: params.fps,
        duration: params.duration,
      });
      if (limitsErr) return mcpError(limitsErr.code, limitsErr.message, limitsErr.howToFix);

      // task 6.3: output path validation
      if (params.output) {
        const outErr = validateOutputPath(params.output);
        if (outErr) return mcpError(outErr.code, outErr.message, outErr.howToFix);
      }

      const anthropic = new Anthropic();

      const message = await anthropic.messages.create({
        model: params.model ?? 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: params.prompt }],
      });

      const rawHtml = message.content
        .filter((block) => block.type === 'text')
        .map((block) => (block as { type: 'text'; text: string }).text)
        .join('');

      const html = robustHtmlExtract(rawHtml);
      if (html.length < 50) {
        return mcpError(
          'GENERATE_EMPTY_HTML',
          'The model returned no usable HTML.',
          'The model returned no usable HTML — try rephrasing your prompt',
        );
      }

      const { format, width, height, quality } = resolveProfile(params);
      const options: RenderOptions = {
        input: { type: 'html', html },
        format,
        viewport: { width, height, deviceScaleFactor: 1 },
        quality,
        selector: params.selector,
        auto: params.auto,
        fps: params.fps,
        duration: params.duration,
        profileViewport: params.profile !== undefined ? true : undefined,
      };

      const result = await render(options);

      if (!result.ok) {
        // task 6.5: structured render errors
        return mcpErrorFromRenderError(result.error);
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
      // task 6.5: catch-all — avoid leaking API key
      const message = e instanceof Error ? e.message : String(e);
      // Ensure ANTHROPIC_API_KEY is not present in the error output
      const safeMessage = process.env['ANTHROPIC_API_KEY']
        ? message.replace(process.env['ANTHROPIC_API_KEY'], '[REDACTED]')
        : message;
      return mcpError('INTERNAL_ERROR', safeMessage, 'Check the MCP server logs for details.');
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

  process.on('SIGINT', () => {
    server.close().finally(() => process.exit(0));
  });
  process.on('SIGTERM', () => {
    server.close().finally(() => process.exit(0));
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(String(err) + '\n');
  process.exit(1);
});
