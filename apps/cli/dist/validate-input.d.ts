import type { RenderErrorCode } from '@pixdom/core';
interface ValidationError {
    code: RenderErrorCode;
    message: string;
}
/**
 * Validates existence and file type for --file and --image inputs.
 * Returns a ValidationError if the file is missing or has an unsupported type,
 * or null if validation passes.
 */
export declare function validateFileInput(flag: '--file' | '--image', resolvedPath: string): ValidationError | null;
export {};
//# sourceMappingURL=validate-input.d.ts.map