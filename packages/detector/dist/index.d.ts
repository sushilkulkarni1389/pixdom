import type { Page } from 'playwright';
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