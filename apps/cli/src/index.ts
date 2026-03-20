#!/usr/bin/env node
import dns from 'node:dns/promises';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { program } from 'commander';
import { render } from '@pixdom/core';
import { resolveProfile, PROFILES } from '@pixdom/profiles';
import { ProfileIdSchema } from '@pixdom/types';
import type { RenderInput, OutputFormat, ProfileId } from '@pixdom/types';
import type { RenderError } from '@pixdom/core';
import { registerCompletion } from './commands/completion.js';
import { registerMcp } from './commands/mcp.js';
import { formatError } from './error-formatter.js';
import { validateFileInput } from './validate-input.js';
import { createProgressReporter } from './progress-reporter.js';

// ---------------------------------------------------------------------------
// Validation helpers (must be defined before program.parse())
// ---------------------------------------------------------------------------

interface Cidr4 { base: number; mask: number; }

function parseCidr4(cidr: string): Cidr4 {
  const [ip, bits] = cidr.split('/');
  const mask = bits ? ~((1 << (32 - Number(bits))) - 1) >>> 0 : 0xffffffff;
  const parts = ip!.split('.').map(Number);
  const base = (((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0);
  return { base: base >>> 0, mask: mask >>> 0 };
}

function ipv4ToInt(ip: string): number {
  const parts = ip.split('.').map(Number);
  return (((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0);
}

const BLOCKED_CIDRS: Cidr4[] = [
  '127.0.0.0/8', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '169.254.0.0/16',
].map(parseCidr4);

function isBlockedIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  return BLOCKED_CIDRS.some((c) => (n & c.mask) === c.base);
}

function isBlockedIpv6(ip: string): boolean {
  const lower = ip.toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
  if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  return false;
}

async function validateUrl(
  rawUrl: string,
  allowLocal: boolean,
  fmt: { argv: string[]; color: boolean },
): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    process.stderr.write(`Error: Invalid URL: ${rawUrl}\n`);
    process.exit(1);
    return;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    const renderErr: RenderError = {
      code: 'INVALID_URL_PROTOCOL',
      message: `URL protocol "${parsed.protocol}" is not allowed. Only http:// and https:// are supported.`,
    };
    process.stderr.write(formatError(renderErr, fmt) + '\n');
    process.exit(1);
  }

  if (!allowLocal) {
    const hostname = parsed.hostname.replace(/^\[/, '').replace(/\]$/, '');
    try {
      const addrs = await dns.lookup(hostname, { all: true });
      for (const addr of addrs) {
        const blocked =
          addr.family === 4 ? isBlockedIpv4(addr.address) : isBlockedIpv6(addr.address);
        if (blocked) {
          const renderErr: RenderError = {
            code: 'INVALID_URL_HOST',
            message: `URL host "${hostname}" resolves to a blocked address (${addr.address}). Loopback, private, and cloud-metadata addresses are not permitted.`,
          };
          process.stderr.write(formatError(renderErr, fmt) + '\n');
          process.exit(1);
        }
      }
    } catch {
      // DNS resolution failed — not a private host, allow through
    }
  } else {
    process.stderr.write('Warning: --allow-local is active — localhost and private network URLs are permitted.\n');
  }
}

const SHELL_METACHARACTERS = /[;&|$`()<>\n]/;

function validateOutputPath(
  outputPath: string,
  fmt: { argv: string[]; color: boolean },
): void {
  if (SHELL_METACHARACTERS.test(outputPath)) {
    const renderErr: RenderError = {
      code: 'INVALID_OUTPUT_PATH',
      message: `Output path contains shell metacharacters: ${outputPath}`,
    };
    process.stderr.write(formatError(renderErr, fmt) + '\n');
    process.exit(1);
  }

  const abs = path.resolve(outputPath);

  if (abs.startsWith('/dev/') || abs.startsWith('/proc/') || abs.startsWith('/sys/')) {
    const renderErr: RenderError = {
      code: 'INVALID_OUTPUT_PATH',
      message: `Output path "${abs}" is not allowed (device/proc/sys paths are prohibited).`,
    };
    process.stderr.write(formatError(renderErr, fmt) + '\n');
    process.exit(1);
  }

  const dir = path.dirname(abs);
  try {
    fsSync.accessSync(dir, fsSync.constants.F_OK);
  } catch {
    const renderErr: RenderError = {
      code: 'INVALID_OUTPUT_PATH',
      message: `Output directory does not exist: ${dir}`,
    };
    process.stderr.write(formatError(renderErr, fmt) + '\n');
    process.exit(1);
  }

  try {
    fsSync.accessSync(dir, fsSync.constants.W_OK);
  } catch {
    const renderErr: RenderError = {
      code: 'INVALID_OUTPUT_PATH',
      message: `Output directory is not writable: ${dir}`,
    };
    process.stderr.write(formatError(renderErr, fmt) + '\n');
    process.exit(1);
  }

  if (fsSync.existsSync(abs)) {
    process.stderr.write(`Warning: output file already exists and will be overwritten: ${abs}\n`);
  }
}

// ---------------------------------------------------------------------------
// ConvertOpts interface
// ---------------------------------------------------------------------------

interface ConvertOpts {
  html?: string;
  file?: string;
  url?: string;
  image?: string;
  profile?: string;
  output?: string;
  format: string;
  width: string;
  height: string;
  quality: string;
  fps?: string;
  duration?: string;
  autoSize?: boolean;
  selector?: string;
  allowLocal?: boolean;
  auto?: boolean;
}

// ---------------------------------------------------------------------------
// Main action
// ---------------------------------------------------------------------------

async function convertAction(opts: ConvertOpts, fmt: { argv: string[]; color: boolean; noProgress: boolean }): Promise<void> {
  // Input mutex validation
  const inputFlags = [opts.html, opts.file, opts.url, opts.image].filter((v) => v !== undefined);
  if (inputFlags.length === 0) {
    process.stderr.write('Error: Provide exactly one of --html, --file, --url, or --image\n');
    process.exit(1);
  }
  if (inputFlags.length > 1) {
    process.stderr.write('Error: Provide exactly one of --html, --file, --url, or --image (got multiple)\n');
    process.exit(1);
  }

  // --fps validation (7.1)
  let fps: number | undefined;
  if (opts.fps !== undefined) {
    fps = parseInt(opts.fps, 10);
    if (!Number.isInteger(fps) || isNaN(fps) || fps < 1 || fps > 60) {
      const renderErr: RenderError = {
        code: 'INVALID_FPS',
        message: `--fps must be an integer between 1 and 60 (got: ${opts.fps})`,
      };
      process.stderr.write(formatError(renderErr, fmt) + '\n');
      process.exit(1);
    }
  }

  // --duration validation (7.2)
  let duration: number | undefined;
  if (opts.duration !== undefined) {
    duration = parseInt(opts.duration, 10);
    if (!Number.isInteger(duration) || isNaN(duration) || duration < 100 || duration > 300000) {
      const renderErr: RenderError = {
        code: 'INVALID_DURATION',
        message: `--duration must be an integer between 100 and 300000 ms (got: ${opts.duration})`,
      };
      process.stderr.write(formatError(renderErr, fmt) + '\n');
      process.exit(1);
    }
  }

  // --width and --height limits (7.3, 7.4)
  const width = parseInt(opts.width, 10);
  const height = parseInt(opts.height, 10);
  if (isNaN(width) || width < 1 || width > 7680) {
    const renderErr: RenderError = {
      code: 'RESOURCE_LIMIT_EXCEEDED',
      message: `--width must be between 1 and 7680 (got: ${opts.width})`,
    };
    process.stderr.write(formatError(renderErr, fmt) + '\n');
    process.exit(1);
  }
  if (isNaN(height) || height < 1 || height > 4320) {
    const renderErr: RenderError = {
      code: 'RESOURCE_LIMIT_EXCEEDED',
      message: `--height must be between 1 and 4320 (got: ${opts.height})`,
    };
    process.stderr.write(formatError(renderErr, fmt) + '\n');
    process.exit(1);
  }

  // Derived frame count cap (7.5)
  if (fps !== undefined && duration !== undefined) {
    const frameCount = Math.ceil(duration / 1000) * fps;
    if (frameCount > 3600) {
      const renderErr: RenderError = {
        code: 'RESOURCE_LIMIT_EXCEEDED',
        message: `Derived frame count (${frameCount}) exceeds the limit of 3600. Lower --fps (current: ${fps}) or --duration (current: ${duration}ms).`,
      };
      process.stderr.write(formatError(renderErr, fmt) + '\n');
      process.exit(1);
    }
  }

  // --auto + --image incompatibility guard
  let autoEnabled = opts.auto === true;
  if (autoEnabled && opts.image !== undefined) {
    process.stderr.write(
      'Warning: --auto is not supported for --image inputs and will be ignored.\n',
    );
    autoEnabled = false;
  }

  // Build the RenderInput discriminated union
  let input: RenderInput;
  if (opts.html !== undefined) {
    input = { type: 'html', html: opts.html };
  } else if (opts.file !== undefined) {
    // Symlink resolution (8.1)
    let resolved: string;
    try {
      resolved = fsSync.realpathSync(path.resolve(opts.file));
    } catch {
      resolved = path.resolve(opts.file);
    }
    input = { type: 'file', path: resolved };
  } else if (opts.image !== undefined) {
    // Symlink resolution (8.2)
    let resolved: string;
    try {
      resolved = fsSync.realpathSync(path.resolve(opts.image));
    } catch {
      resolved = path.resolve(opts.image);
    }
    input = { type: 'image', path: resolved };
  } else {
    input = { type: 'url', url: opts.url! };
  }

  // URL protocol + host validation (5.1, 5.2)
  if (input.type === 'url') {
    await validateUrl(input.url, opts.allowLocal === true, fmt);
  }

  // File type + existence validation
  if (input.type === 'file') {
    const fileErr = validateFileInput('--file', input.path);
    if (fileErr) {
      process.stderr.write(formatError(fileErr, fmt) + '\n');
      process.exit(1);
    }
  }
  if (input.type === 'image') {
    const fileErr = validateFileInput('--image', input.path);
    if (fileErr) {
      process.stderr.write(formatError(fileErr, fmt) + '\n');
      process.exit(1);
    }
  }

  // Profile resolution — merge preset then apply flag overrides
  let format: OutputFormat = opts.format as OutputFormat;
  let finalWidth = width;
  let finalHeight = height;
  let quality = parseInt(opts.quality, 10);

  if (opts.profile !== undefined) {
    const profileParse = ProfileIdSchema.safeParse(opts.profile);
    if (!profileParse.success) {
      process.stderr.write(
        `Error: Invalid profile "${opts.profile}". Valid canonical slugs: ${Object.keys(PROFILES).join(', ')}. Legacy aliases: instagram, twitter, linkedin\n`,
      );
      process.exit(1);
    }
    const profile = resolveProfile(profileParse.data as ProfileId);
    format = opts.format !== 'png' ? (opts.format as OutputFormat) : profile.format;
    finalWidth = opts.width !== '1280' ? width : profile.width;
    finalHeight = opts.height !== '720' ? height : profile.height;
    quality = opts.quality !== '90' ? parseInt(opts.quality, 10) : profile.quality;
  }

  // --selector warnings and resolution
  let selector: string | undefined;
  if (opts.selector !== undefined) {
    if (input.type === 'image') {
      process.stderr.write(`Warning: --selector is ignored for --image inputs\n`);
    } else {
      selector = opts.selector;
      if (process.argv.includes('--width')) {
        process.stderr.write(`Warning: --width is ignored because --selector takes precedence; output dimensions are determined by the element bounding box\n`);
        finalWidth = 1280;
      }
      if (process.argv.includes('--height')) {
        process.stderr.write(`Warning: --height is ignored because --selector takes precedence; output dimensions are determined by the element bounding box\n`);
        finalHeight = 720;
      }
    }
  }

  // Output path validation (6.1–6.3)
  let outputPath = opts.output
    ? path.resolve(opts.output)
    : path.resolve(`pixdom-output.${format}`);

  if (opts.output) {
    validateOutputPath(opts.output, fmt);
  }

  // Build progress reporter
  const isAnimated = ['gif', 'mp4', 'webm'].includes(format);
  const isImagePassthrough = input.type === 'image';
  const hasResize = opts.profile !== undefined ||
    (isImagePassthrough && (process.argv.includes('--width') || process.argv.includes('--height')));
  const reporter = createProgressReporter(
    {
      hasSelector: !!selector,
      hasAutoSize: !!(opts.autoSize && !selector),
      isAnimated,
      isImagePassthrough,
      profileName: opts.profile,
      format: format.toUpperCase(),
      hasResize,
    },
    fmt.noProgress,
  );

  const ANIMATED_FORMATS_CLI = new Set(['gif', 'mp4', 'webm']);
  const baseOnProgress = reporter.onProgress;
  const onProgress = (event: Parameters<typeof baseOnProgress>[0]) => {
    if (event.type === 'auto-detected') {
      // Output path update must happen regardless of TTY state — affects file written to disk
      if (event.duration === null && ANIMATED_FORMATS_CLI.has(format)) {
        if (!opts.output) {
          outputPath = path.resolve('pixdom-output.png');
        } else if (/\.(gif|mp4|webm)$/i.test(outputPath)) {
          outputPath = outputPath.replace(/\.(gif|mp4|webm)$/i, '.png');
        }
      }
      if (!fmt.noProgress) {
        // LCM-exceeded warning
        if (event.lcmExceeded && event.lcmMs !== undefined) {
          process.stderr.write(
            `Warning: Animation LCM (${Math.round(event.lcmMs)}ms) exceeds 10s cap — using longest single cycle (${event.duration}ms)\n`,
          );
        }
        // No animation warning
        if (event.duration === null && ANIMATED_FORMATS_CLI.has(format)) {
          process.stderr.write(
            'Warning: No animation detected — producing static PNG. Use --duration to force animated output.\n',
          );
        }
        // Ambiguity warning
        if (event.elementAmbiguous) {
          process.stderr.write(
            'Auto-selector: ambiguous — capturing full page. Use --selector to specify.\n',
          );
        }
        // Auto-summary block
        const elementLabel = event.element
          ? `${event.element} (${event.elementWidth}×${event.elementHeight})`
          : event.elementAmbiguous
            ? 'full page (ambiguous)'
            : 'full page';
        const durationLabel =
          event.duration !== null
            ? (() => {
                const stratDesc =
                  event.durationStrategy === 'css-lcm'
                    ? 'CSS animation LCM'
                    : event.durationStrategy === 'css-transition'
                      ? 'CSS transition'
                      : event.durationStrategy === 'source-pattern'
                        ? 'source pattern'
                        : 'detected';
                return `${event.duration}ms (${stratDesc})`;
              })()
            : 'none detected — producing static PNG';
        const timingDesc = event.fps >= 24 ? 'ease-in-out detected' : 'linear timing';
        process.stderr.write(
          `Auto mode:\n` +
            `  Element:  ${elementLabel}\n` +
            `  Duration: ${durationLabel}\n` +
            `  FPS:      ${event.fps} (${timingDesc})\n` +
            `  Frames:   ${event.frames}\n`,
        );
      }
      return;
    }
    baseOnProgress(event);
  };

  const result = await render(
    {
      input,
      format,
      viewport: { width: finalWidth, height: finalHeight, deviceScaleFactor: 1 },
      quality,
      fps,
      duration,
      autoSize: selector ? false : (opts.autoSize ?? false),
      selector,
      allowLocal: opts.allowLocal === true,
      auto: autoEnabled,
    },
    { onProgress },
  );

  if (!result.ok) {
    process.stderr.write(formatError(result.error, fmt) + '\n');
    process.exit(1);
  }

  await fs.writeFile(outputPath, result.value);
  reporter.finish(outputPath);
  process.stdout.write(`${outputPath}\n`);
}

// ---------------------------------------------------------------------------
// CLI setup and parse
// ---------------------------------------------------------------------------

const originalArgv = process.argv.slice(2);

program
  .name('pixdom')
  .description('Convert HTML to platform-ready images and animated assets')
  .version('0.1.0')
  .option('--no-color', 'Disable ANSI color in error output')
  .option('--no-progress', 'Disable progress spinner output');

program
  .command('convert')
  .description('Render HTML, a file, or a URL to an image or video')
  .option('--html <string>', 'Inline HTML string to render')
  .option('--file <path>', 'Local HTML file path to render')
  .option('--url <url>', 'Remote URL to render')
  .option(
    '--profile <slug>',
    `Platform profile slug. Canonical: ${Object.keys(PROFILES).join(', ')}. Legacy aliases: instagram → instagram-post-square, twitter → twitter-post, linkedin → linkedin-post`,
  )
  .option('--output <path>', 'Output file path (default: ./pixdom-output.<format>)')
  .option('--format <fmt>', 'Output format: png | jpeg | webp | gif | mp4 | webm', 'png')
  .option('--width <n>', 'Viewport width in pixels', '1280')
  .option('--height <n>', 'Viewport height in pixels', '720')
  .option('--quality <n>', 'Compression quality 0–100', '90')
  .option('--image <path>', 'Local image file to convert (bypasses browser)')
  .option('--fps <n>', 'Frame rate for animated output (gif/mp4/webm)')
  .option('--duration <ms>', 'Animation cycle length in ms (overrides auto-detection)')
  .option('--auto-size', 'Auto-detect output dimensions from page content')
  .option('--selector <css>', 'CSS selector to capture a specific DOM element (e.g. "#canvas", ".card")')
  .option('--allow-local', 'Allow rendering of localhost and private network URLs (development only)')
  .option(
    '--auto',
    'Automatically detect the primary content element, animation duration, and optimal FPS',
  )
  .action(async (opts) => {
    const globalOpts = program.opts<{ color: boolean; progress: boolean }>();
    const color =
      globalOpts.color !== false &&
      process.env['NO_COLOR'] === undefined &&
      !!process.stderr.isTTY;
    const noProgress = globalOpts.progress === false || !process.stderr.isTTY;
    try {
      await convertAction(opts, { argv: originalArgv, color, noProgress });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error: ${msg}\n`);
      process.exit(1);
    }
  });

registerCompletion(program);
registerMcp(program);

program.parse();
