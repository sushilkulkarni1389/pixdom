import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
}
function assertFfmpegAvailable() {
    if (!ffmpegPath) {
        throw new Error('FFmpeg binary not available on this platform (ffmpeg-static returned null)');
    }
}
/**
 * Drives a rAF loop via page.evaluate for `cycleMs` duration, taking a
 * Playwright screenshot after each frame. Returns sorted frame file paths.
 * When `element` is provided, captures each frame via element.screenshot()
 * instead of page.screenshot(). The element's bounding box is computed once
 * before the loop begins.
 */
export async function captureFrames(page, cycleMs, fps, outDir, element, onProgress) {
    const emit = onProgress ?? (() => { });
    const frameCount = Math.max(1, Math.round((cycleMs / 1000) * fps));
    const frameIntervalMs = cycleMs / frameCount;
    // Compute bounding box once before the frame loop (spec: bounding box computed once)
    if (element) {
        await element.boundingBox();
    }
    await page.clock.install({ time: 0 });
    const paths = [];
    let lastEmitTs = 0;
    for (let i = 0; i < frameCount; i++) {
        await page.clock.runFor(frameIntervalMs);
        const framePath = path.join(outDir, `frame-${String(i).padStart(6, '0')}.png`);
        if (element) {
            await element.screenshot({ type: 'png', path: framePath });
        }
        else {
            await page.screenshot({ type: 'png', fullPage: false, path: framePath });
        }
        paths.push(framePath);
        const now = Date.now();
        if (now - lastEmitTs >= 100) {
            emit({ type: 'frame-progress', current: i + 1, total: frameCount });
            lastEmitTs = now;
        }
    }
    return paths;
}
function ffmpegEncode(inputPattern, fps, outputPath, extraArgs, onProgress) {
    return new Promise((resolve, reject) => {
        const cmd = ffmpeg()
            .input(inputPattern)
            .inputOptions([`-framerate ${fps}`])
            .outputOptions(extraArgs)
            .on('error', reject)
            .on('end', () => resolve());
        if (onProgress) {
            cmd.on('progress', (p) => {
                if (p.percent != null) {
                    onProgress({ type: 'encode-progress', pct: Math.round(p.percent) });
                }
            });
        }
        cmd.save(outputPath);
    });
}
export async function encodeGif(frames, fps, _cycleMs, onProgress) {
    assertFfmpegAvailable();
    const pattern = frames[0].replace(/frame-\d+\.png$/, 'frame-%06d.png');
    const palettePath = frames[0].replace(/frame-\d+\.png$/, 'palette.png');
    const outPath = frames[0].replace(/frame-\d+\.png$/, 'out.gif');
    // Pass 1: generate a globally-optimal palette from all frames
    await ffmpegEncode(pattern, fps, palettePath, ['-vf', 'palettegen']);
    // Pass 2: encode GIF using the palette derived from the full sequence
    await new Promise((resolve, reject) => {
        const cmd = ffmpeg()
            .input(pattern)
            .inputOptions([`-framerate ${fps}`])
            .input(palettePath)
            .outputOptions(['-loop', '0', '-filter_complex', '[0:v][1:v]paletteuse'])
            .on('error', reject)
            .on('end', () => resolve());
        if (onProgress) {
            cmd.on('progress', (p) => {
                if (p.percent != null) {
                    onProgress({ type: 'encode-progress', pct: Math.round(p.percent) });
                }
            });
        }
        cmd.save(outPath);
    });
    const buf = await fs.readFile(outPath);
    await fs.unlink(outPath);
    return buf;
}
export async function encodeMp4(frames, fps, onProgress) {
    assertFfmpegAvailable();
    const outPath = frames[0].replace(/frame-\d+\.png$/, 'out.mp4');
    const pattern = frames[0].replace(/frame-\d+\.png$/, 'frame-%06d.png');
    await ffmpegEncode(pattern, fps, outPath, ['-pix_fmt', 'yuv420p', '-movflags', '+faststart'], onProgress);
    const buf = await fs.readFile(outPath);
    await fs.unlink(outPath);
    return buf;
}
export async function encodeWebm(frames, fps, onProgress) {
    assertFfmpegAvailable();
    const outPath = frames[0].replace(/frame-\d+\.png$/, 'out.webm');
    const pattern = frames[0].replace(/frame-\d+\.png$/, 'frame-%06d.png');
    await ffmpegEncode(pattern, fps, outPath, ['-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '33'], onProgress);
    const buf = await fs.readFile(outPath);
    await fs.unlink(outPath);
    return buf;
}
export async function renderAnimated(page, options, cycleMs, element, onProgress) {
    const emit = onProgress ?? (() => { });
    const tmpDir = path.join(os.tmpdir(), `pixdom-${randomUUID()}`);
    await fs.mkdir(tmpDir, { recursive: true });
    try {
        const fps = options.fps ?? 30;
        const frames = await captureFrames(page, cycleMs, fps, tmpDir, element, onProgress);
        emit({ type: 'encode-format', format: options.format.toUpperCase() });
        switch (options.format) {
            case 'gif':
                return await encodeGif(frames, fps, cycleMs, onProgress);
            case 'mp4':
                return await encodeMp4(frames, fps, onProgress);
            case 'webm':
                return await encodeWebm(frames, fps, onProgress);
            default:
                throw new Error(`Animated renderer does not handle format: ${options.format}`);
        }
    }
    finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
    }
}
