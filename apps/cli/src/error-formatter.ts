import type { RenderError, RenderErrorCode } from '@pixdom/core';

// ---------------------------------------------------------------------------
// ANSI color helpers
// ---------------------------------------------------------------------------

function ansi(code: string, text: string, enabled: boolean): string {
  return enabled ? `\x1b[${code}m${text}\x1b[0m` : text;
}

function red(text: string, enabled: boolean): string { return ansi('31', text, enabled); }
function bold(text: string, enabled: boolean): string { return ansi('1', text, enabled); }
function dim(text: string, enabled: boolean): string { return ansi('2', text, enabled); }

// ---------------------------------------------------------------------------
// Template types
// ---------------------------------------------------------------------------

interface ErrorTemplate {
  title: string;
  whatHappened: (error: RenderError) => string;
  howToFix: string;
  docs: string;
  /** argv flag to add/replace to produce the Example line, or null to omit */
  correction?: { addFlag: string } | null;
  /** Append raw error message as Detail block */
  showDetail?: boolean;
}

// ---------------------------------------------------------------------------
// Template registry
// ---------------------------------------------------------------------------

const TEMPLATES: Partial<Record<RenderErrorCode, ErrorTemplate>> = {
  NO_ANIMATION_DETECTED: {
    title: 'No animation detected',
    whatHappened: () =>
      'No CSS animation was found on the page. Canvas and JS-driven animations require a manual duration.',
    howToFix: 'Add --duration <ms> to specify the cycle length, and --fps <number> for frame rate.',
    docs: '--duration, --fps',
    correction: { addFlag: '--duration 1000' },
  },
  SELECTOR_NOT_FOUND: {
    title: 'Selector matched no elements',
    whatHappened: (e) => e.message,
    howToFix:
      'Check the selector is correct using browser DevTools, or omit --selector to capture the full page.',
    docs: '--selector',
    correction: null,
  },
  INVALID_FILE_TYPE: {
    title: 'Unsupported file type',
    whatHappened: (e) => e.message,
    howToFix:
      '--file accepts .html and .htm only. --image accepts .png, .jpg, .jpeg, .webp, .gif only. Use --url to render remote pages of any type.',
    docs: '--file, --image',
    correction: null,
  },
  FILE_NOT_FOUND: {
    title: 'File not found',
    whatHappened: (e) => e.message,
    howToFix:
      'Use an absolute path. Relative paths are resolved from the current working directory.',
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
    whatHappened: () =>
      'Playwright could not start Chromium. The browser binary may be missing or incompatible.',
    howToFix:
      'Run `npx playwright install chromium` to reinstall the browser binary.',
    docs: '--help',
    correction: null,
  },
  PAGE_LOAD_FAILED: {
    title: 'Page failed to load',
    whatHappened: () =>
      'The browser could not load the page. The file path may be wrong, the URL unreachable, or the HTML invalid.',
    howToFix:
      'Check the file path is absolute, the URL is reachable, or validate your HTML.',
    docs: '--file, --url, --html',
    correction: null,
  },
  CAPTURE_FAILED: {
    title: 'Screenshot capture failed',
    whatHappened: (e) => e.message,
    howToFix:
      'Check that the page renders correctly in a browser. If using --selector, verify the element exists and is visible.',
    docs: '--selector, --width, --height',
    correction: null,
    showDetail: true,
  },
  ENCODE_FAILED: {
    title: 'FFmpeg encoding failed',
    whatHappened: () => 'FFmpeg failed during video or GIF encoding.',
    howToFix:
      'Check that --fps and --duration values are valid. Include the Detail below in bug reports.',
    docs: '--fps, --duration',
    correction: null,
    showDetail: true,
  },
  SHARP_ERROR: {
    title: 'Image processing failed',
    whatHappened: () =>
      'Sharp could not process the input image.',
    howToFix:
      'Check the input image is a valid PNG, JPEG, or WebP. Include the Detail below in bug reports.',
    docs: '--image',
    correction: null,
    showDetail: true,
  },
};

// ---------------------------------------------------------------------------
// argv reconstruction
// ---------------------------------------------------------------------------

function buildExample(argv: string[], addFlag: string): string {
  return `pixdom ${[...argv, addFlag].join(' ')}`;
}

// ---------------------------------------------------------------------------
// Main formatter
// ---------------------------------------------------------------------------

export function formatError(
  error: RenderError,
  opts: { argv: string[]; color: boolean },
): string {
  const { argv, color } = opts;
  const tpl = TEMPLATES[error.code];

  const lines: string[] = [];

  if (!tpl) {
    // Generic fallback
    lines.push(red(`✗ Unexpected error (${error.code})`, color));
    lines.push(`  ${bold('What happened:', color)} ${error.message}`);
    lines.push(`  ${bold('How to fix:', color)}    This is an unexpected error. Please file a bug report at:`);
    lines.push(`  ${dim('                   https://github.com/anthropics/claude-code/issues', color)}`);
    lines.push(`  ${bold('Error code:', color)}     ${error.code}`);
    return lines.join('\n');
  }

  lines.push(red(`✗ ${tpl.title}`, color));
  lines.push(`  ${bold('What happened:', color)} ${tpl.whatHappened(error)}`);
  lines.push(`  ${bold('How to fix:', color)}    ${tpl.howToFix}`);

  // Hint lines for NO_ANIMATION_DETECTED
  if (error.hints && error.hints.length > 0) {
    for (const hint of error.hints) {
      lines.push(`  ${bold('Hint:', color)}          ${hint}`);
    }
  }

  // Example line
  if (tpl.correction !== null && tpl.correction !== undefined) {
    const example = buildExample(argv, tpl.correction.addFlag);
    lines.push(`  ${bold('Example:', color)}       ${dim(example, color)}`);
  }

  lines.push(`  ${bold('Docs:', color)}          ${tpl.docs}`);

  // Detail block for encoder/processor errors
  if (tpl.showDetail && error.message) {
    lines.push(`  ${bold('Detail:', color)}        ${dim(error.message, color)}`);
  }

  return lines.join('\n');
}
