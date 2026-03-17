import { chromium } from 'playwright';
import { detectAnimationCycle } from '@pixdom/detector';
import type { RenderOptions, Result } from '@pixdom/types';
import { err, ok } from '@pixdom/types';
import { makeError, type RenderError, type RenderErrorCode } from './errors.js';
import { loadPage } from './load-page.js';
import { renderStatic } from './static-renderer.js';
import { renderAnimated } from './animated-renderer.js';

export type { RenderError, RenderErrorCode };

const ANIMATED_FORMATS = new Set(['gif', 'mp4', 'webm']);
const STATIC_FORMATS = new Set(['png', 'jpeg', 'webp']);

export async function render(
  options: RenderOptions,
): Promise<Result<Buffer, RenderError>> {
  let browser;

  try {
    browser = await chromium.launch({
      args: [
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
      ],
    });
  } catch (cause) {
    return err(makeError('BROWSER_LAUNCH_FAILED', 'Failed to launch browser', cause));
  }

  try {
    const page = await browser.newPage();

    await page.setViewportSize({
      width: options.viewport.width,
      height: options.viewport.height,
    });

    // deviceScaleFactor requires context-level config; set via emulation
    if (options.viewport.deviceScaleFactor !== 1) {
      await page.emulateMedia({ colorScheme: 'light' });
    }

    try {
      await loadPage(page, options.input);
    } catch (cause) {
      return err(makeError('PAGE_LOAD_FAILED', 'Failed to load page', cause));
    }

    // Apply timeout if specified
    if (options.timeout) {
      page.setDefaultTimeout(options.timeout);
    }

    const isAnimatedFormat = ANIMATED_FORMATS.has(options.format);
    const isStaticFormat = STATIC_FORMATS.has(options.format);

    if (isAnimatedFormat) {
      const cycleMs = await detectAnimationCycle(page);
      if (cycleMs === null) {
        return err(
          makeError(
            'NO_ANIMATION_DETECTED',
            `No animation detected on page; cannot produce animated ${options.format}`,
          ),
        );
      }
      try {
        const buffer = await renderAnimated(page, options, cycleMs);
        return ok(buffer);
      } catch (cause) {
        const msg = cause instanceof Error ? cause.message : String(cause);
        const code: RenderErrorCode = msg.toLowerCase().includes('ffmpeg')
          ? 'ENCODE_FAILED'
          : 'CAPTURE_FAILED';
        return err(makeError(code, `Animated render failed: ${msg}`, cause));
      }
    }

    if (isStaticFormat) {
      try {
        const buffer = await renderStatic(page, options);
        return ok(buffer);
      } catch (cause) {
        return err(makeError('CAPTURE_FAILED', 'Static render failed', cause));
      }
    }

    return err(makeError('CAPTURE_FAILED', `Unknown output format: ${options.format}`));
  } finally {
    await browser.close();
  }
}
