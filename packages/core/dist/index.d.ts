import type { RenderOptions, Result } from '@pixdom/types';
import { type RenderError, type RenderErrorCode } from './errors.js';
export type { RenderError, RenderErrorCode };
export declare function render(options: RenderOptions): Promise<Result<Buffer, RenderError>>;
//# sourceMappingURL=index.d.ts.map