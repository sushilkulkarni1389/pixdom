import sharp from 'sharp';
export async function renderStatic(page, options, element, onProgress) {
    const emit = onProgress ?? (() => { });
    emit({ type: 'step-start', step: 'capture' });
    const screenshot = element
        ? await element.screenshot({ type: 'png' })
        : await page.screenshot({ type: 'png', fullPage: false });
    emit({ type: 'step-done', step: 'capture' });
    const image = sharp(screenshot);
    emit({ type: 'step-start', step: 'write-output' });
    let buf;
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
