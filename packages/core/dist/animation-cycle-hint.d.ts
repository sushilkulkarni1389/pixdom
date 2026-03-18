/**
 * Scans HTML/JS source for numeric patterns that likely represent animation
 * cycle lengths. Returns up to 3 hint strings in descending confidence order.
 *
 * Normalisation rule: bare numbers < 100 are treated as seconds and converted
 * to ms; numbers >= 100 are treated as ms directly.
 */
export declare function scanForCycleLengths(html: string): string[];
//# sourceMappingURL=animation-cycle-hint.d.ts.map