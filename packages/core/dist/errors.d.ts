export type RenderErrorCode = 'BROWSER_LAUNCH_FAILED' | 'PAGE_LOAD_FAILED' | 'CAPTURE_FAILED' | 'ENCODE_FAILED' | 'NO_ANIMATION_DETECTED';
export interface RenderError {
    code: RenderErrorCode;
    message: string;
    cause?: unknown;
}
export declare function makeError(code: RenderErrorCode, message: string, cause?: unknown): RenderError;
//# sourceMappingURL=errors.d.ts.map