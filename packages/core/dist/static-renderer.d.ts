import type { Page, ElementHandle } from 'playwright';
import type { RenderOptions } from '@pixdom/types';
import type { OnProgress } from './progress.js';
export declare function renderStatic(page: Page, options: RenderOptions, element?: ElementHandle, onProgress?: OnProgress): Promise<Buffer>;
//# sourceMappingURL=static-renderer.d.ts.map