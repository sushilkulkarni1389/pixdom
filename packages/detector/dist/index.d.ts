import type { Page } from 'playwright';
export type AutoElementResult = {
    selector: string;
    width: number;
    height: number;
    ambiguous: false;
} | {
    selector: null;
    width: 0;
    height: 0;
    ambiguous: true;
} | null;
/**
 * Identifies the most prominent content element on the page using a scoring
 * algorithm (area × centrality − depth penalty). Returns null if no visible
 * block-level candidates exist.
 */
export declare function autoDetectElement(page: Page): Promise<AutoElementResult>;
export type AutoDurationResult = {
    durationMs: number;
    strategy: 'css-lcm' | 'css-transition' | 'source-pattern';
    /** Present when LCM exceeded 10 000ms and longest individual was used instead */
    lcmMs?: number;
};
/**
 * Detects animation cycle length using a multi-source strategy:
 * 1. CSS animation-duration LCM (capped at 10 000ms)
 * 2. CSS transition-duration fallback (longest ≥ 500ms)
 * 3. Source pattern scan
 * Returns null if no animation cycle can be determined.
 */
export declare function autoDetectDuration(page: Page, selector?: string): Promise<AutoDurationResult | null>;
/**
 * Selects optimal FPS based on CSS animation timing functions:
 * - Non-linear (ease, cubic-bezier): 24 fps
 * - Linear / transitions only: 12 fps
 * Applies a frame-count ceiling of 1200 frames when durationMs is provided.
 */
export declare function autoDetectFps(page: Page, selector?: string, durationMs?: number): Promise<number>;
/**
 * Detects the animation cycle length of the page in milliseconds.
 * Returns null for static pages or when no cycle can be determined.
 *
 * Strategy:
 * 1. CSS computed duration (fast, synchronous in-page query)
 * 2. rAF sampling fallback (catches JS-driven animations)
 * 3. null — page is static or cycle is indeterminate
 */
export declare function detectAnimationCycle(page: Page): Promise<number | null>;
//# sourceMappingURL=index.d.ts.map