export type RenderErrorCode = 'BROWSER_LAUNCH_FAILED' | 'PAGE_LOAD_FAILED' | 'CAPTURE_FAILED' | 'ENCODE_FAILED' | 'NO_ANIMATION_DETECTED' | 'SELECTOR_NOT_FOUND' | 'INVALID_FILE_TYPE' | 'FILE_NOT_FOUND' | 'IMAGE_NOT_FOUND' | 'SHARP_ERROR' | 'INVALID_URL_PROTOCOL' | 'INVALID_URL_HOST' | 'INVALID_OUTPUT_PATH' | 'INVALID_FPS' | 'INVALID_DURATION' | 'RESOURCE_LIMIT_EXCEEDED';
export interface RenderError {
    code: RenderErrorCode;
    message: string;
    cause?: unknown;
    hints?: string[];
}
export declare function makeError(code: RenderErrorCode, message: string, cause?: unknown, hints?: string[]): RenderError;
//# sourceMappingURL=errors.d.ts.map