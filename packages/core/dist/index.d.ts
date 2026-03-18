import type { RenderOptions, Result } from '@pixdom/types';
import { type RenderError, type RenderErrorCode } from './errors.js';
import type { OnProgress } from './progress.js';
export type { RenderError, RenderErrorCode };
export type { ProgressEvent, OnProgress } from './progress.js';
export declare function render(options: RenderOptions, { onProgress }?: {
    onProgress?: OnProgress;
}): Promise<Result<Buffer, RenderError>>;
//# sourceMappingURL=index.d.ts.map