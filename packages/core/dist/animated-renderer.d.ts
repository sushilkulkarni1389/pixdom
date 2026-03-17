import type { Page } from 'playwright';
import type { RenderOptions } from '@pixdom/types';
/**
 * Drives a rAF loop via page.evaluate for `cycleMs` duration, taking a
 * Playwright screenshot after each frame. Returns sorted frame file paths.
 */
export declare function captureFrames(page: Page, cycleMs: number, fps: number, outDir: string): Promise<string[]>;
export declare function encodeGif(frames: string[], fps: number, _cycleMs: number): Promise<Buffer>;
export declare function encodeMp4(frames: string[], fps: number): Promise<Buffer>;
export declare function encodeWebm(frames: string[], fps: number): Promise<Buffer>;
export declare function renderAnimated(page: Page, options: RenderOptions, cycleMs: number): Promise<Buffer>;
//# sourceMappingURL=animated-renderer.d.ts.map