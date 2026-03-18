import path from 'node:path';
// ---------------------------------------------------------------------------
// ANSI color helpers
// ---------------------------------------------------------------------------
function ansi(code, text, enabled) {
    return enabled ? `\x1b[${code}m${text}\x1b[0m` : text;
}
function red(text, enabled) { return ansi('31', text, enabled); }
function bold(text, enabled) { return ansi('1', text, enabled); }
function dim(text, enabled) { return ansi('2', text, enabled); }
// ---------------------------------------------------------------------------
// Template registry
// ---------------------------------------------------------------------------
const TEMPLATES = {
    NO_ANIMATION_DETECTED: {
        title: 'No animation detected',
        whatHappened: () => 'No CSS animation was found on the page. Canvas and JS-driven animations require a manual duration.',
        howToFix: 'Add --duration <ms> to specify the cycle length, and --fps <number> for frame rate.',
        docs: '--duration, --fps',
        correction: { addFlag: '--duration 1000' },
    },
    SELECTOR_NOT_FOUND: {
        title: 'Selector matched no elements',
        whatHappened: (e) => e.message,
        howToFix: 'Check the selector is correct using browser DevTools, or omit --selector to capture the full page.',
        docs: '--selector',
        correction: null,
    },
    INVALID_FILE_TYPE: {
        title: 'Unsupported file type',
        whatHappened: (e) => e.message,
        howToFix: '--file accepts .html and .htm only. --image accepts .png, .jpg, .jpeg, .webp, .gif only. Use --url to render remote pages of any type.',
        docs: '--file, --image',
        correction: null,
    },
    FILE_NOT_FOUND: {
        title: 'File not found',
        whatHappened: (e) => e.message,
        howToFix: 'Use an absolute path. Relative paths are resolved from the current working directory.',
        docs: '--file',
        correction: null,
    },
    IMAGE_NOT_FOUND: {
        title: 'Image not found',
        whatHappened: (e) => e.message,
        howToFix: 'Use an absolute path. Relative paths are resolved from the current working directory.',
        docs: '--image',
        correction: null,
    },
    BROWSER_LAUNCH_FAILED: {
        title: 'Browser failed to launch',
        whatHappened: () => 'Playwright could not start Chromium. The browser binary may be missing or incompatible.',
        howToFix: 'Run `npx playwright install chromium` to reinstall the browser binary.',
        docs: '--help',
        correction: null,
    },
    PAGE_LOAD_FAILED: {
        title: 'Page failed to load',
        whatHappened: () => 'The browser could not load the page. The file path may be wrong, the URL unreachable, or the HTML invalid.',
        howToFix: 'Check the file path is absolute, the URL is reachable, or validate your HTML.',
        docs: '--file, --url, --html',
        correction: null,
    },
    CAPTURE_FAILED: {
        title: 'Screenshot capture failed',
        whatHappened: (e) => e.message,
        howToFix: 'Check that the page renders correctly in a browser. If using --selector, verify the element exists and is visible.',
        docs: '--selector, --width, --height',
        correction: null,
        showDetail: true,
    },
    ENCODE_FAILED: {
        title: 'FFmpeg encoding failed',
        whatHappened: () => 'FFmpeg failed during video or GIF encoding.',
        howToFix: 'Check that --fps and --duration values are valid. Include the Detail below in bug reports.',
        docs: '--fps, --duration',
        correction: null,
        showDetail: true,
    },
    SHARP_ERROR: {
        title: 'Image processing failed',
        whatHappened: () => 'Sharp could not process the input image.',
        howToFix: 'Check the input image is a valid PNG, JPEG, or WebP. Include the Detail below in bug reports.',
        docs: '--image',
        correction: null,
        showDetail: true,
    },
    INVALID_URL_PROTOCOL: {
        title: 'URL protocol not allowed',
        whatHappened: (e) => e.message,
        howToFix: 'Only http:// and https:// URLs are supported. file://, ftp://, data://, and other protocols are not permitted.',
        docs: '--url',
        correction: null,
    },
    INVALID_URL_HOST: {
        title: 'URL host not allowed',
        whatHappened: (e) => e.message,
        howToFix: 'Loopback (127.x.x.x), private (RFC1918), and cloud metadata (169.254.x.x) addresses are blocked. Use --allow-local to permit localhost rendering for development.',
        docs: '--url, --allow-local',
        correction: null,
    },
    INVALID_OUTPUT_PATH: {
        title: 'Invalid output path',
        whatHappened: (e) => e.message,
        howToFix: 'Ensure the output directory exists and is writable. Paths under /dev/, /proc/, and /sys/ are not allowed.',
        docs: '--output',
        correction: null,
    },
    INVALID_FPS: {
        title: 'Invalid frame rate',
        whatHappened: (e) => e.message,
        howToFix: '--fps must be an integer between 1 and 60.',
        docs: '--fps',
        correction: null,
    },
    INVALID_DURATION: {
        title: 'Invalid duration',
        whatHappened: (e) => e.message,
        howToFix: '--duration must be an integer between 100 and 300000 (milliseconds).',
        docs: '--duration',
        correction: null,
    },
    RESOURCE_LIMIT_EXCEEDED: {
        title: 'Resource limit exceeded',
        whatHappened: (e) => e.message,
        howToFix: 'Reduce --fps (max 60), --duration (max 300000ms), --width (max 7680), or --height (max 4320). For animation, lower fps or duration to keep total frames under 3600.',
        docs: '--fps, --duration, --width, --height',
        correction: null,
    },
};
// ---------------------------------------------------------------------------
// Secret scrubbing (11.1)
// ---------------------------------------------------------------------------
const SECRET_KEY_PATTERN = /key|token|secret|password|api_?key/i;
function scrubSecrets(ctx) {
    const result = {};
    for (const [k, v] of Object.entries(ctx)) {
        result[k] = SECRET_KEY_PATTERN.test(k) && typeof v === 'string' ? '[REDACTED]' : v;
    }
    return result;
}
// ---------------------------------------------------------------------------
// Path relativisation (11.3)
// ---------------------------------------------------------------------------
function relativizePaths(msg) {
    return msg.replace(/\/[^\s"']+/g, (abs) => {
        try {
            const rel = path.relative(process.cwd(), abs);
            return rel.startsWith('..') ? abs : rel;
        }
        catch {
            return abs;
        }
    });
}
// ---------------------------------------------------------------------------
// FFmpeg stderr sanitisation (11.4)
// ---------------------------------------------------------------------------
const BASE64_TOKEN_PATTERN = /[A-Za-z0-9+/=]{20,}/g;
function sanitizeFfmpegStderr(stderr) {
    return stderr.replace(BASE64_TOKEN_PATTERN, '[REDACTED]');
}
// ---------------------------------------------------------------------------
// argv reconstruction
// ---------------------------------------------------------------------------
function buildExample(argv, addFlag) {
    return `pixdom ${[...argv, addFlag].join(' ')}`;
}
// ---------------------------------------------------------------------------
// Main formatter
// ---------------------------------------------------------------------------
export function formatError(error, opts) {
    const { argv, color } = opts;
    // Scrub secrets from error context if it's a plain object (11.2)
    if (error.cause && typeof error.cause === 'object' && !Array.isArray(error.cause)) {
        error = {
            ...error,
            cause: scrubSecrets(error.cause),
        };
    }
    // Relativize absolute paths in message (11.3)
    const safeMessage = relativizePaths(error.message);
    const displayError = { ...error, message: safeMessage };
    const tpl = TEMPLATES[error.code];
    const lines = [];
    if (!tpl) {
        // Generic fallback
        lines.push(red(`✗ Unexpected error (${displayError.code})`, color));
        lines.push(`  ${bold('What happened:', color)} ${displayError.message}`);
        lines.push(`  ${bold('How to fix:', color)}    This is an unexpected error. Please file a bug report at:`);
        lines.push(`  ${dim('                   https://github.com/anthropics/claude-code/issues', color)}`);
        lines.push(`  ${bold('Error code:', color)}     ${displayError.code}`);
        return lines.join('\n');
    }
    lines.push(red(`✗ ${tpl.title}`, color));
    lines.push(`  ${bold('What happened:', color)} ${tpl.whatHappened(displayError)}`);
    lines.push(`  ${bold('How to fix:', color)}    ${tpl.howToFix}`);
    // Hint lines for NO_ANIMATION_DETECTED
    if (displayError.hints && displayError.hints.length > 0) {
        for (const hint of displayError.hints) {
            lines.push(`  ${bold('Hint:', color)}          ${hint}`);
        }
    }
    // Example line
    if (tpl.correction !== null && tpl.correction !== undefined) {
        const example = buildExample(argv, tpl.correction.addFlag);
        lines.push(`  ${bold('Example:', color)}       ${dim(example, color)}`);
    }
    lines.push(`  ${bold('Docs:', color)}          ${tpl.docs}`);
    // Detail block for encoder/processor errors (11.4: sanitize FFmpeg stderr)
    if (tpl.showDetail && displayError.message) {
        const detail = error.code === 'ENCODE_FAILED'
            ? sanitizeFfmpegStderr(displayError.message)
            : displayError.message;
        lines.push(`  ${bold('Detail:', color)}        ${dim(detail, color)}`);
    }
    return lines.join('\n');
}
