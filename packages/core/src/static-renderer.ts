import type { Page, ElementHandle } from 'playwright';
import type { RenderOptions } from '@pixdom/types';
import sharp from 'sharp';
import type { OnProgress } from './progress.js';

export async function renderStatic(
  page: Page,
  options: RenderOptions,
  element?: ElementHandle,
  onProgress?: OnProgress,
): Promise<Buffer> {
  const emit = onProgress ?? (() => {});
  emit({ type: 'step-start', step: 'capture' });
  const screenshot = element
    ? await element.screenshot({ type: 'png' })
    : await page.screenshot({ type: 'png', fullPage: false });
  emit({ type: 'step-done', step: 'capture' });
  const image = sharp(screenshot);

  switch (options.format) {
    case 'png':
      return image
        .png({ compressionLevel: Math.round(((100 - (options.quality ?? 100)) / 100) * 9) })
        .toBuffer();
    case 'jpeg':
      return image.jpeg({ quality: options.quality ?? 90 }).toBuffer();
    case 'webp':
      return image.webp({ quality: options.quality ?? 90 }).toBuffer();
    default:
      throw new Error(`Static renderer does not handle format: ${options.format}`);
  }
}
