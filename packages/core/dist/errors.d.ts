export type RenderErrorCode = 'BROWSER_LAUNCH_FAILED' | 'PAGE_LOAD_FAILED' | 'CAPTURE_FAILED' | 'ENCODE_FAILED' | 'NO_ANIMATION_DETECTED' | 'SELECTOR_NOT_FOUND' | 'INVALID_FILE_TYPE' | 'FILE_NOT_FOUND' | 'IMAGE_NOT_FOUND' | 'SHARP_ERROR';
export interface RenderError {
    code: RenderErrorCode;
    message: string;
    cause?: unknown;
    hints?: string[];
}
export declare function makeError(code: RenderErrorCode, message: string, cause?: unknown, hints?: string[]): RenderError;
//# sourceMappingURL=errors.d.ts.map