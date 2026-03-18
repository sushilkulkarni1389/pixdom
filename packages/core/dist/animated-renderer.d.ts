import type { Page, ElementHandle } from 'playwright';
import type { RenderOptions } from '@pixdom/types';
import type { OnProgress } from './progress.js';
/**
 * Drives a rAF loop via page.evaluate for `cycleMs` duration, taking a
 * Playwright screenshot after each frame. Returns sorted frame file paths.
 * When `element` is provided, captures each frame via element.screenshot()
 * instead of page.screenshot(). The element's bounding box is computed once
 * before the loop begins.
 */
export declare function captureFrames(page: Page, cycleMs: number, fps: number, outDir: string, element?: ElementHandle, onProgress?: OnProgress): Promise<string[]>;
export declare function encodeGif(frames: string[], fps: number, _cycleMs: number, onProgress?: OnProgress): Promise<Buffer>;
export declare function encodeMp4(frames: string[], fps: number, onProgress?: OnProgress): Promise<Buffer>;
export declare function encodeWebm(frames: string[], fps: number, onProgress?: OnProgress): Promise<Buffer>;
export declare function renderAnimated(page: Page, options: RenderOptions, cycleMs: number, element?: ElementHandle, onProgress?: OnProgress): Promise<Buffer>;
//# sourceMappingURL=animated-renderer.d.ts.map