#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { program } from 'commander';
import { render } from '@pixdom/core';
import { getProfile, PROFILES } from '@pixdom/profiles';
import { ProfileIdSchema } from '@pixdom/types';
import type { RenderInput, OutputFormat, ProfileId } from '@pixdom/types';

program
  .name('pixdom')
  .description('Convert HTML to platform-ready images and animated assets')
  .version('0.1.0');

program
  .command('convert')
  .description('Render HTML, a file, or a URL to an image or video')
  .option('--html <string>', 'Inline HTML string to render')
  .option('--file <path>', 'Local HTML file path to render')
  .option('--url <url>', 'Remote URL to render')
  .option('--profile <id>', `Platform preset (${Object.keys(PROFILES).join(' | ')})`)
  .option('--output <path>', 'Output file path (default: ./pixdom-output.<format>)')
  .option('--format <fmt>', 'Output format: png | jpeg | webp | gif | mp4 | webm', 'png')
  .option('--width <n>', 'Viewport width in pixels', '1280')
  .option('--height <n>', 'Viewport height in pixels', '720')
  .option('--quality <n>', 'Compression quality 0–100', '90')
  .action(async (opts) => {
    try {
      await convertAction(opts);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error: ${msg}\n`);
      process.exit(1);
    }
  });

program.parse();

// ---------------------------------------------------------------------------

interface ConvertOpts {
  html?: string;
  file?: string;
  url?: string;
  profile?: string;
  output?: string;
  format: string;
  width: string;
  height: string;
  quality: string;
}

async function convertAction(opts: ConvertOpts): Promise<void> {
  // 2.2 Input mutex validation
  const inputFlags = [opts.html, opts.file, opts.url].filter((v) => v !== undefined);
  if (inputFlags.length === 0) {
    process.stderr.write('Error: Provide exactly one of --html, --file, or --url\n');
    process.exit(1);
  }
  if (inputFlags.length > 1) {
    process.stderr.write('Error: Provide exactly one of --html, --file, or --url (got multiple)\n');
    process.exit(1);
  }

  // Build the RenderInput discriminated union
  let input: RenderInput;
  if (opts.html !== undefined) {
    input = { type: 'html', html: opts.html };
  } else if (opts.file !== undefined) {
    input = { type: 'file', path: path.resolve(opts.file) };
  } else {
    input = { type: 'url', url: opts.url! };
  }

  // 2.3 Profile resolution — merge preset then apply flag overrides
  let format: OutputFormat = opts.format as OutputFormat;
  let width = parseInt(opts.width, 10);
  let height = parseInt(opts.height, 10);
  let quality = parseInt(opts.quality, 10);

  if (opts.profile !== undefined) {
    const profileParse = ProfileIdSchema.safeParse(opts.profile);
    if (!profileParse.success) {
      process.stderr.write(
        `Error: Invalid profile "${opts.profile}". Valid profiles: ${Object.keys(PROFILES).join(', ')}\n`,
      );
      process.exit(1);
    }
    const profile = getProfile(profileParse.data as ProfileId);
    // Preset fills in values; flags parsed from CLI override if explicitly different from defaults
    format = opts.format !== 'png' ? (opts.format as OutputFormat) : profile.format;
    width = opts.width !== '1280' ? parseInt(opts.width, 10) : profile.width;
    height = opts.height !== '720' ? parseInt(opts.height, 10) : profile.height;
    quality = opts.quality !== '90' ? parseInt(opts.quality, 10) : profile.quality;
  }

  // 2.4 Default output path
  const outputPath = opts.output
    ? path.resolve(opts.output)
    : path.resolve(`pixdom-output.${format}`);

  // 3.1 Build RenderOptions and call render()
  const result = await render({
    input,
    format,
    viewport: { width, height, deviceScaleFactor: 1 },
    quality,
  });

  // 3.3 Error handling
  if (!result.ok) {
    process.stderr.write(`Error: ${result.error.message} (code: ${result.error.code})\n`);
    process.exit(1);
  }

  // 3.2 Write buffer and print path
  await fs.writeFile(outputPath, result.value);
  process.stdout.write(`${outputPath}\n`);
}
