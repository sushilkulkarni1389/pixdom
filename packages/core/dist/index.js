import fs from 'node:fs';
import { chromium } from 'playwright';
import { detectAnimationCycle } from '@pixdom/detector';
import { err, ok } from '@pixdom/types';
import { makeError } from './errors.js';
import { loadPage } from './load-page.js';
import { renderStatic } from './static-renderer.js';
import { renderAnimated } from './animated-renderer.js';
import { renderImage } from './image-renderer.js';
import { scanForCycleLengths } from './animation-cycle-hint.js';
const ANIMATED_FORMATS = new Set(['gif', 'mp4', 'webm']);
const STATIC_FORMATS = new Set(['png', 'jpeg', 'webp']);
export async function render(options, { onProgress } = {}) {
    const emit = onProgress ?? (() => { });
    // File existence check before browser launch
    if (options.input.type === 'file' && !fs.existsSync(options.input.path)) {
        return err(makeError('FILE_NOT_FOUND', `File "${options.input.path}" does not exist`));
    }
    // Image inputs bypass Playwright entirely — route directly to Sharp
    if (options.input.type === 'image') {
        try {
            const buffer = await renderImage(options, emit);
            return ok(buffer);
        }
        catch (cause) {
            // renderImage throws typed RenderError objects for known conditions
            if (cause && typeof cause === 'object' && 'code' in cause) {
                return err(cause);
            }
            const msg = cause instanceof Error ? cause.message : String(cause);
            return err(makeError('SHARP_ERROR', `Image processing failed: ${msg}`, cause));
        }
    }
    let browser;
    try {
        browser = await chromium.launch({
            args: [
                '--disable-background-timer-throttling',
                '--disable-renderer-backgrounding',
                '--disable-backgrounding-occluded-windows',
            ],
        });
    }
    catch (cause) {
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
        emit({ type: 'step-start', step: 'load-page' });
        try {
            await loadPage(page, options.input);
        }
        catch (cause) {
            return err(makeError('PAGE_LOAD_FAILED', 'Failed to load page', cause));
        }
        emit({ type: 'step-done', step: 'load-page' });
        // Auto-size: resize viewport to match content dimensions after page load
        // Skipped when --selector is active (element bounding box drives output dimensions)
        if (options.autoSize && !options.selector) {
            emit({ type: 'step-start', step: 'auto-size' });
            const { scrollWidth, scrollHeight } = await page.evaluate(() => ({
                scrollWidth: document.documentElement.scrollWidth,
                scrollHeight: document.documentElement.scrollHeight,
            }));
            const autoWidth = options.viewport.width === 1280 ? scrollWidth : options.viewport.width;
            await page.setViewportSize({ width: autoWidth, height: scrollHeight });
            emit({ type: 'step-done', step: 'auto-size' });
        }
        // Apply timeout if specified
        if (options.timeout) {
            page.setDefaultTimeout(options.timeout);
        }
        // Selector resolution — must happen after page load, before renderer dispatch
        let elementHandle;
        if (options.selector) {
            emit({ type: 'step-start', step: 'selector' });
            const matches = await page.$$(options.selector);
            if (matches.length === 0) {
                return err(makeError('SELECTOR_NOT_FOUND', `Selector '${options.selector}' matched no elements in the page`));
            }
            if (matches.length > 1) {
                process.stderr.write(`Warning: selector '${options.selector}' matched ${matches.length} elements; using the first match\n`);
            }
            const box = await matches[0].boundingBox();
            if (box === null) {
                return err(makeError('SELECTOR_NOT_FOUND', `Selector '${options.selector}' matched no elements in the page`));
            }
            elementHandle = matches[0];
            emit({ type: 'step-done', step: 'selector' });
        }
        const isAnimatedFormat = ANIMATED_FORMATS.has(options.format);
        const isStaticFormat = STATIC_FORMATS.has(options.format);
        if (isAnimatedFormat) {
            emit({ type: 'step-start', step: 'detect-animation' });
            const cycleMs = options.duration ?? await detectAnimationCycle(page);
            if (cycleMs === null) {
                const pageContent = await page.content();
                const hints = scanForCycleLengths(pageContent);
                return err(makeError('NO_ANIMATION_DETECTED', `No animation detected on page; cannot produce animated ${options.format}`, undefined, hints));
            }
            emit({ type: 'step-done', step: 'detect-animation' });
            try {
                const buffer = await renderAnimated(page, options, cycleMs, elementHandle, emit);
                return ok(buffer);
            }
            catch (cause) {
                const msg = cause instanceof Error ? cause.message : String(cause);
                const code = msg.toLowerCase().includes('ffmpeg')
                    ? 'ENCODE_FAILED'
                    : 'CAPTURE_FAILED';
                return err(makeError(code, `Animated render failed: ${msg}`, cause));
            }
        }
        if (isStaticFormat) {
            try {
                const buffer = await renderStatic(page, options, elementHandle, emit);
                return ok(buffer);
            }
            catch (cause) {
                return err(makeError('CAPTURE_FAILED', 'Static render failed', cause));
            }
        }
        return err(makeError('CAPTURE_FAILED', `Unknown output format: ${options.format}`));
    }
    finally {
        await browser.close();
    }
}
