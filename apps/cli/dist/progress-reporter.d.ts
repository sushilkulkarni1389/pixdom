import type { OnProgress } from '@pixdom/core';
export interface ProgressReporterContext {
    hasSelector: boolean;
    hasAutoSize: boolean;
    isAnimated: boolean;
    isImagePassthrough: boolean;
    profileName?: string;
    format: string;
    hasResize: boolean;
}
export declare function formatDuration(ms: number): string;
export interface ProgressReporter {
    onProgress: OnProgress;
    finish(outputPath: string): void;
}
export declare function createProgressReporter(context: ProgressReporterContext, noProgress: boolean): ProgressReporter;
//# sourceMappingURL=progress-reporter.d.ts.map