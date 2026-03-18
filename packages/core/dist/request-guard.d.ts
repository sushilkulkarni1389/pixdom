import type { Page } from 'playwright';
import type { RenderOptions } from '@pixdom/types';
/**
 * Installs a Playwright request interceptor that aborts requests to:
 * - Non-http/https protocols
 * - Loopback, RFC1918, link-local, and IPv6-private hosts (unless allowLocal is true)
 *
 * Must be called after page creation and before content is loaded.
 */
export declare function installRequestGuard(page: Page, options: RenderOptions): Promise<void>;
//# sourceMappingURL=request-guard.d.ts.map