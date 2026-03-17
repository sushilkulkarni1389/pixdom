import sharp from 'sharp';
const ANIMATED_FORMATS = new Set(['gif', 'mp4', 'webm']);
export async function renderImage(options) {
    if (options.input.type !== 'image') {
        throw new Error('renderImage called with non-image input');
    }
    if (ANIMATED_FORMATS.has(options.format)) {
        throw new Error(`Image input does not support animated output format: ${options.format}`);
    }
    const { width, height } = options.viewport;
    const DEFAULT_WIDTH = 1280;
    const DEFAULT_HEIGHT = 720;
    let image = sharp(options.input.path);
    if (width !== DEFAULT_WIDTH || height !== DEFAULT_HEIGHT) {
        image = image.resize(width, height, { fit: 'inside' });
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
            throw new Error(`Image renderer does not handle format: ${options.format}`);
    }
}
