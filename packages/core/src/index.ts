import fs from 'node:fs';
import { chromium } from 'playwright';
import type { ElementHandle } from 'playwright';
import { detectAnimationCycle, autoDetectElement, autoDetectDuration, autoDetectFps } from '@pixdom/detector';
import type { RenderOptions, Result } from '@pixdom/types';
import { err, ok } from '@pixdom/types';
import { makeError, type RenderError, type RenderErrorCode } from './errors.js';
import { loadPage } from './load-page.js';
import { renderStatic } from './static-renderer.js';
import { renderAnimated } from './animated-renderer.js';
import { renderImage } from './image-renderer.js';
import { scanForCycleLengths } from './animation-cycle-hint.js';
import { installRequestGuard } from './request-guard.js';
import type { OnProgress } from './progress.js';

export type { RenderError, RenderErrorCode };
export type { ProgressEvent, OnProgress } from './progress.js';
export { registerTempDir, releaseTempDir, cleanupAll } from './temp-registry.js';

const ANIMATED_FORMATS = new Set(['gif', 'mp4', 'webm']);
const STATIC_FORMATS = new Set(['png', 'jpeg', 'webp']);

export async function render(
  options: RenderOptions,
  { onProgress }: { onProgress?: OnProgress } = {},
): Promise<Result<Buffer, RenderError>> {
  const emit = onProgress ?? (() => {});

  // File existence check before browser launch
  if (options.input.type === 'file' && !fs.existsSync(options.input.path)) {
    return err(makeError('FILE_NOT_FOUND', `File "${options.input.path}" does not exist`));
  }

  // Image inputs bypass Playwright entirely — route directly to Sharp
  if (options.input.type === 'image') {
    try {
      const buffer = await renderImage(options, emit);
      return ok(buffer);
    } catch (cause) {
      // renderImage throws typed RenderError objects for known conditions
      if (cause && typeof cause === 'object' && 'code' in cause) {
        return err(cause as RenderError);
      }
      const msg = cause instanceof Error ? cause.message : String(cause);
      return err(makeError('SHARP_ERROR', `Image processing failed: ${msg}`, cause));
    }
  }

  let browser;

  const noSandbox =
    process.env['PIXDOM_NO_SANDBOX'] === '1' || process.env['PIXDOM_NO_SANDBOX'] === 'true';
  if (noSandbox) {
    process.stderr.write(
      'Warning: PIXDOM_NO_SANDBOX is set — running Chromium without sandbox. Do not use in production.\n',
    );
  }

  try {
    browser = await chromium.launch({
      args: [
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-background-networking',
        '--disable-webrtc',
        ...(noSandbox ? ['--no-sandbox', '--disable-setuid-sandbox'] : []),
      ],
    });
  } catch (cause) {
    return err(makeError('BROWSER_LAUNCH_FAILED', 'Failed to launch browser', cause));
  }

  try {
    const context = await browser.newContext({
      serviceWorkers: 'block',
      viewport: { width: options.viewport.width, height: options.viewport.height },
    });
    const page = await context.newPage();

    page.setDefaultNavigationTimeout(30000);

    await installRequestGuard(page, options);

    // deviceScaleFactor requires context-level config; set via emulation
    if (options.viewport.deviceScaleFactor !== 1) {
      await page.emulateMedia({ colorScheme: 'light' });
    }

    emit({ type: 'step-start', step: 'load-page' });
    try {
      await loadPage(page, options.input);
    } catch (cause) {
      return err(makeError('PAGE_LOAD_FAILED', 'Failed to load page', cause));
    }
    emit({ type: 'step-done', step: 'load-page' });

    // Auto-mode: detect element, duration, and FPS before renderer dispatch
    // Skipped for image inputs (no DOM available)
    let autoEffectiveSelector = options.selector;
    let autoEffectiveDuration: number | undefined = options.duration;
    let autoEffectiveFps = options.fps;
    let autoSwitchedToStatic = false;

    if (options.auto) {
      // Step 1: auto-element detection
      emit({ type: 'step-start', step: 'analyse-page' });
      let autoElement: string | null = null;
      let autoElementAmbiguous = false;
      let autoElementWidth = 0;
      let autoElementHeight = 0;

      if (!options.selector) {
        const elResult = await autoDetectElement(page);
        if (elResult !== null) {
          autoElement = elResult.selector;
          autoElementAmbiguous = elResult.ambiguous;
          autoElementWidth = elResult.width;
          autoElementHeight = elResult.height;
          // When profileViewport is set, don't override autoEffectiveSelector for capture —
          // the detected selector is used only for timing detection below.
          if (elResult.selector && !options.profileViewport) {
            autoEffectiveSelector = elResult.selector;
          }
        }
      } else {
        autoElement = options.selector;
      }
      emit({ type: 'step-done', step: 'analyse-page' });

      // Step 2: auto-duration and auto-fps detection.
      // Use the detected element selector for timing even when profileViewport suppresses capture.
      const timingSelector = autoElement ?? autoEffectiveSelector;
      emit({ type: 'step-start', step: 'detect-animations' });
      let autoDuration: number | null = null;
      let autoDurationStrategy: 'css-lcm' | 'css-transition' | 'source-pattern' | null = null;
      let autoLcmExceeded = false;
      let autoLcmMs: number | undefined;

      if (!options.duration) {
        const durResult = await autoDetectDuration(page, timingSelector ?? undefined);
        if (durResult !== null) {
          autoDuration = durResult.durationMs;
          autoDurationStrategy = durResult.strategy;
          autoLcmExceeded = durResult.lcmMs !== undefined;
          autoLcmMs = durResult.lcmMs;
          autoEffectiveDuration = autoDuration ?? undefined;
        }
      } else {
        autoDuration = options.duration;
        autoEffectiveDuration = options.duration;
      }

      if (!options.fps) {
        autoEffectiveFps = await autoDetectFps(
          page,
          timingSelector ?? undefined,
          autoEffectiveDuration ?? undefined,
        );
      }

      emit({ type: 'step-done', step: 'detect-animations' });

      const autoFrames =
        autoEffectiveDuration !== undefined
          ? Math.round((autoEffectiveFps ?? 12) * (autoEffectiveDuration / 1000))
          : 0;

      emit({
        type: 'auto-detected',
        element: autoElement,
        elementAmbiguous: autoElementAmbiguous,
        elementWidth: autoElementWidth,
        elementHeight: autoElementHeight,
        duration: autoDuration,
        durationStrategy: autoDurationStrategy,
        lcmExceeded: autoLcmExceeded,
        lcmMs: autoLcmMs,
        fps: autoEffectiveFps ?? 12,
        frames: autoFrames,
      });

      // If animated format requested but no animation detected, fall back to static
      if (ANIMATED_FORMATS.has(options.format) && autoDuration === null && !options.duration) {
        autoSwitchedToStatic = true;
      }

      // profile + auto: capture full profile viewport — do not use element capture
      if (options.profileViewport) {
        autoEffectiveSelector = undefined;
        // Do not resolve elementHandle for profile+auto combination
        // page.screenshot() at full profile viewport will be used instead
      }
    }

    // Auto-size: resize viewport to match content dimensions after page load
    // Skipped when --selector is active (element bounding box drives output dimensions)
    if (options.autoSize && !options.selector) {
      emit({ type: 'step-start', step: 'auto-size' });
      // Shrink to 1×1 so content wider/taller than the default viewport overflows
      // and scrollWidth/scrollHeight reflects actual content bounds, not viewport size.
      await page.setViewportSize({ width: 1, height: 1 });
      const { scrollWidth, scrollHeight } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
      }));
      await page.setViewportSize({ width: scrollWidth, height: scrollHeight });
      emit({ type: 'step-done', step: 'auto-size' });
    }

    // Apply timeout if specified
    if (options.timeout) {
      page.setDefaultTimeout(options.timeout);
    }

    // Selector resolution — must happen after page load, before renderer dispatch
    // Use autoEffectiveSelector when auto-mode injected a detected selector
    const resolvedSelector = autoEffectiveSelector;
    let elementHandle: ElementHandle | undefined;
    if (resolvedSelector) {
      emit({ type: 'step-start', step: 'selector' });
      const matches = await page.$$(resolvedSelector);
      if (matches.length === 0) {
        return err(
          makeError(
            'SELECTOR_NOT_FOUND',
            `Selector '${resolvedSelector}' matched no elements in the page`,
          ),
        );
      }
      if (matches.length > 1) {
        process.stderr.write(
          `Warning: selector '${resolvedSelector}' matched ${matches.length} elements; using the first match\n`,
        );
      }
      const box = await matches[0]!.boundingBox();
      if (box === null) {
        return err(
          makeError(
            'SELECTOR_NOT_FOUND',
            `Selector '${resolvedSelector}' matched no elements in the page`,
          ),
        );
      }
      elementHandle = matches[0]!;
      emit({ type: 'step-done', step: 'selector' });
    }

    const isAnimatedFormat = ANIMATED_FORMATS.has(options.format);
    const isStaticFormat = STATIC_FORMATS.has(options.format);

    // auto-mode static fallback: no animation detected for animated format
    if (autoSwitchedToStatic || isStaticFormat) {
      try {
        const staticOptions = autoSwitchedToStatic ? { ...options, format: 'png' as const } : options;
        const buffer = await renderStatic(page, staticOptions, elementHandle, emit);
        return ok(buffer);
      } catch (cause) {
        return err(makeError('CAPTURE_FAILED', 'Static render failed', cause));
      }
    }

    if (isAnimatedFormat) {
      emit({ type: 'step-start', step: 'detect-animation' });
      // Use auto-detected duration if available, otherwise fall back to detectAnimationCycle
      const cycleMs = autoEffectiveDuration ?? await detectAnimationCycle(page);
      if (cycleMs === null) {
        const pageContent = await page.content();
        const hints = scanForCycleLengths(pageContent);
        return err(
          makeError(
            'NO_ANIMATION_DETECTED',
            `No animation detected on page; cannot produce animated ${options.format}`,
            undefined,
            hints,
          ),
        );
      }
      emit({ type: 'step-done', step: 'detect-animation' });
      // Use auto-detected fps if available
      const effectiveOptions = autoEffectiveFps !== undefined && autoEffectiveFps !== options.fps
        ? { ...options, fps: autoEffectiveFps }
        : options;
      try {
        const buffer = await renderAnimated(page, effectiveOptions, cycleMs, elementHandle, emit);
        return ok(buffer);
      } catch (cause) {
        const msg = cause instanceof Error ? cause.message : String(cause);
        const code: RenderErrorCode = msg.toLowerCase().includes('ffmpeg')
          ? 'ENCODE_FAILED'
          : 'CAPTURE_FAILED';
        return err(makeError(code, `Animated render failed: ${msg}`, cause));
      }
    }

    return err(makeError('CAPTURE_FAILED', `Unknown output format: ${options.format}`));
  } finally {
    await browser.close();
  }
}
