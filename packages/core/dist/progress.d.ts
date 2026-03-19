export type ProgressEvent = {
    type: 'step-start';
    step: string;
} | {
    type: 'step-done';
    step: string;
} | {
    type: 'frame-progress';
    current: number;
    total: number;
} | {
    type: 'encode-progress';
    pct: number;
} | {
    type: 'encode-format';
    format: string;
} | {
    type: 'encode-done';
    format: string;
} | {
    type: 'auto-detected';
    element: string | null;
    elementAmbiguous: boolean;
    elementWidth: number;
    elementHeight: number;
    duration: number | null;
    durationStrategy: 'css-lcm' | 'css-transition' | 'source-pattern' | null;
    lcmExceeded: boolean;
    lcmMs?: number;
    fps: number;
    frames: number;
};
export type OnProgress = (event: ProgressEvent) => void;
//# sourceMappingURL=progress.d.ts.map