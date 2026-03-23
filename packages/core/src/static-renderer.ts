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
  let screenshot: Buffer;
  if (element) {
    const box = await element.boundingBox();
    if (!box) throw new Error('Could not get element bounding box');
    screenshot = await page.screenshot({ type: 'png', clip: box });
  } else {
    screenshot = await page.screenshot({ type: 'png', fullPage: false });
  }
  emit({ type: 'step-done', step: 'capture' });
  const image = sharp(screenshot);

  if (options.profileViewport) {
    emit({ type: 'step-start', step: 'resize' });
    emit({ type: 'step-done', step: 'resize' });
  }

  emit({ type: 'step-start', step: 'write-output' });
  let buf: Buffer;
  switch (options.format) {
    case 'png':
      buf = await image
        .png({ compressionLevel: Math.round(((100 - (options.quality ?? 100)) / 100) * 9) })
        .toBuffer();
      break;
    case 'jpeg':
      buf = await image.jpeg({ quality: options.quality ?? 90 }).toBuffer();
      break;
    case 'webp':
      buf = await image.webp({ quality: options.quality ?? 90 }).toBuffer();
      break;
    default:
      throw new Error(`Static renderer does not handle format: ${options.format}`);
  }
  emit({ type: 'step-done', step: 'write-output' });
  return buf;
}
