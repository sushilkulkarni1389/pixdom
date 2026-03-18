#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { program } from 'commander';
import { render } from '@pixdom/core';
import { resolveProfile, PROFILES } from '@pixdom/profiles';
import { ProfileIdSchema } from '@pixdom/types';
import { registerCompletion } from './commands/completion.js';
import { formatError } from './error-formatter.js';
import { validateFileInput } from './validate-input.js';
import { createProgressReporter } from './progress-reporter.js';
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
    .option('--profile <slug>', `Platform profile slug. Canonical: ${Object.keys(PROFILES).join(', ')}. Legacy aliases: instagram → instagram-post-square, twitter → twitter-post, linkedin → linkedin-post`)
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
    .action(async (opts) => {
    const globalOpts = program.opts();
    const color = globalOpts.color !== false &&
        process.env['NO_COLOR'] === undefined &&
        !!process.stderr.isTTY;
    const noProgress = globalOpts.progress === false || !process.stderr.isTTY;
    try {
        await convertAction(opts, { argv: originalArgv, color, noProgress });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`Error: ${msg}\n`);
        process.exit(1);
    }
});
registerCompletion(program);
program.parse();
async function convertAction(opts, fmt) {
    // 2.2 Input mutex validation
    const inputFlags = [opts.html, opts.file, opts.url, opts.image].filter((v) => v !== undefined);
    if (inputFlags.length === 0) {
        process.stderr.write('Error: Provide exactly one of --html, --file, --url, or --image\n');
        process.exit(1);
    }
    if (inputFlags.length > 1) {
        process.stderr.write('Error: Provide exactly one of --html, --file, --url, or --image (got multiple)\n');
        process.exit(1);
    }
    // Build the RenderInput discriminated union
    let input;
    if (opts.html !== undefined) {
        input = { type: 'html', html: opts.html };
    }
    else if (opts.file !== undefined) {
        input = { type: 'file', path: path.resolve(opts.file) };
    }
    else if (opts.image !== undefined) {
        input = { type: 'image', path: path.resolve(opts.image) };
    }
    else {
        input = { type: 'url', url: opts.url };
    }
    // File type + existence validation (before any rendering)
    if (input.type === 'file') {
        const err = validateFileInput('--file', input.path);
        if (err) {
            process.stderr.write(formatError(err, fmt) + '\n');
            process.exit(1);
        }
    }
    if (input.type === 'image') {
        const err = validateFileInput('--image', input.path);
        if (err) {
            process.stderr.write(formatError(err, fmt) + '\n');
            process.exit(1);
        }
    }
    // 2.3 Profile resolution — merge preset then apply flag overrides
    let format = opts.format;
    let width = parseInt(opts.width, 10);
    let height = parseInt(opts.height, 10);
    let quality = parseInt(opts.quality, 10);
    if (opts.profile !== undefined) {
        const profileParse = ProfileIdSchema.safeParse(opts.profile);
        if (!profileParse.success) {
            process.stderr.write(`Error: Invalid profile "${opts.profile}". Valid canonical slugs: ${Object.keys(PROFILES).join(', ')}. Legacy aliases: instagram, twitter, linkedin\n`);
            process.exit(1);
        }
        const profile = resolveProfile(profileParse.data);
        // Preset fills in values; flags parsed from CLI override if explicitly different from defaults
        format = opts.format !== 'png' ? opts.format : profile.format;
        width = opts.width !== '1280' ? parseInt(opts.width, 10) : profile.width;
        height = opts.height !== '720' ? parseInt(opts.height, 10) : profile.height;
        quality = opts.quality !== '90' ? parseInt(opts.quality, 10) : profile.quality;
    }
    // --selector warnings and resolution
    let selector;
    if (opts.selector !== undefined) {
        if (input.type === 'image') {
            process.stderr.write(`Warning: --selector is ignored for --image inputs\n`);
        }
        else {
            selector = opts.selector;
            if (process.argv.includes('--width')) {
                process.stderr.write(`Warning: --width is ignored because --selector takes precedence; output dimensions are determined by the element bounding box\n`);
                width = 1280;
            }
            if (process.argv.includes('--height')) {
                process.stderr.write(`Warning: --height is ignored because --selector takes precedence; output dimensions are determined by the element bounding box\n`);
                height = 720;
            }
        }
    }
    // --duration validation
    let duration;
    if (opts.duration !== undefined) {
        duration = parseInt(opts.duration, 10);
        if (!Number.isFinite(duration) || duration <= 0) {
            process.stderr.write('Error: --duration must be a positive integer (milliseconds)\n');
            process.exit(1);
        }
    }
    // --fps parsing
    const fps = opts.fps !== undefined ? parseInt(opts.fps, 10) : undefined;
    // 2.4 Default output path
    const outputPath = opts.output
        ? path.resolve(opts.output)
        : path.resolve(`pixdom-output.${format}`);
    // Build progress reporter
    const isAnimated = ['gif', 'mp4', 'webm'].includes(format);
    const isImagePassthrough = input.type === 'image';
    const hasResize = opts.profile !== undefined ||
        (isImagePassthrough && (process.argv.includes('--width') || process.argv.includes('--height')));
    const reporter = createProgressReporter({
        hasSelector: !!selector,
        hasAutoSize: !!(opts.autoSize && !selector),
        isAnimated,
        isImagePassthrough,
        profileName: opts.profile,
        format: format.toUpperCase(),
        hasResize,
    }, fmt.noProgress);
    // 3.1 Build RenderOptions and call render()
    const result = await render({
        input,
        format,
        viewport: { width, height, deviceScaleFactor: 1 },
        quality,
        fps,
        duration,
        autoSize: selector ? false : (opts.autoSize ?? false),
        selector,
    }, { onProgress: reporter.onProgress });
    // 3.3 Error handling
    if (!result.ok) {
        process.stderr.write(formatError(result.error, fmt) + '\n');
        process.exit(1);
    }
    // 3.2 Write buffer and print path
    await fs.writeFile(outputPath, result.value);
    reporter.finish(outputPath);
    process.stdout.write(`${outputPath}\n`);
}
