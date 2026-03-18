import fs from 'node:fs';
import sharp from 'sharp';
import { makeError } from './errors.js';
const ANIMATED_FORMATS = new Set(['gif', 'mp4', 'webm']);
export async function renderImage(options, onProgress) {
    const emit = onProgress ?? (() => { });
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
            throw makeError('SHARP_ERROR', `Image renderer does not handle format: ${options.format}`);
    }
}
