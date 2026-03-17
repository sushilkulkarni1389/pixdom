import type { Page } from 'playwright';
import type { RenderInput } from '@pixdom/types';

export async function loadPage(page: Page, input: RenderInput): Promise<void> {
  switch (input.type) {
    case 'html':
      await page.setContent(input.html, { waitUntil: 'networkidle' });
      break;
    case 'file':
      await page.goto(`file://${input.path}`, { waitUntil: 'networkidle' });
      break;
    case 'url':
      await page.goto(input.url, { waitUntil: 'networkidle' });
      break;
  }
}
