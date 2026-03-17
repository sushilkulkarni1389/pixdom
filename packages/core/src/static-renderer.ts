import type { Page } from 'playwright';
import type { RenderOptions } from '@pixdom/types';
import sharp from 'sharp';

export async function renderStatic(page: Page, options: RenderOptions): Promise<Buffer> {
  const screenshot = await page.screenshot({ type: 'png', fullPage: false });
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
