import fs from 'node:fs';
import sharp from 'sharp';
import type { RenderOptions } from '@pixdom/types';
import { makeError } from './errors.js';
import type { OnProgress } from './progress.js';

const ANIMATED_FORMATS = new Set(['gif', 'mp4', 'webm']);

export async function renderImage(options: RenderOptions, onProgress?: OnProgress): Promise<Buffer> {
  const emit = onProgress ?? (() => {});

  if (options.input.type !== 'image') {
    throw makeError('CAPTURE_FAILED', 'renderImage called with non-image input');
  }

  if (ANIMATED_FORMATS.has(options.format)) {
    throw makeError('CAPTURE_FAILED', `Image input does not support animated output format: ${options.format}`);
  }

  if (!fs.existsSync(options.input.path)) {
    throw makeError('IMAGE_NOT_FOUND', `Image "${options.input.path}" does not exist`);
  }

  const { width, height } = options.viewport;
  const DEFAULT_WIDTH = 1280;
  const DEFAULT_HEIGHT = 720;

  emit({ type: 'step-start', step: 'read-image' });
  let image = sharp(options.input.path);
  emit({ type: 'step-done', step: 'read-image' });

  if (width !== DEFAULT_WIDTH || height !== DEFAULT_HEIGHT) {
    emit({ type: 'step-start', step: 'resize' });
    image = image.resize(width, height, { fit: 'inside' });
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
      throw makeError('SHARP_ERROR', `Image renderer does not handle format: ${options.format}`);
  }
  emit({ type: 'step-done', step: 'write-output' });
  return buf;
}
