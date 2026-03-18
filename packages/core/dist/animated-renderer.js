import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getFfmpegPath, spawnFfmpeg } from './ffmpeg-spawn.js';
/**
 * Drives a rAF loop via page.clock for `cycleMs` duration, taking a
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
    emit({ type: 'step-start', step: 'capture-frames' });
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
    emit({ type: 'step-done', step: 'capture-frames' });
    return paths;
}
export async function encodeGif(frames, fps, _cycleMs, onProgress) {
    getFfmpegPath(); // throws if unavailable
    const pattern = frames[0].replace(/frame-\d+\.png$/, 'frame-%06d.png');
    const palettePath = frames[0].replace(/frame-\d+\.png$/, 'palette.png');
    const outPath = frames[0].replace(/frame-\d+\.png$/, 'out.gif');
    // Pass 1: generate a globally-optimal palette from all frames
    await spawnFfmpeg(['-framerate', String(fps), '-i', pattern, '-vf', 'palettegen', '-y', palettePath]);
    // Pass 2: encode GIF using the palette derived from the full sequence
    await spawnFfmpeg([
        '-framerate', String(fps), '-i', pattern,
        '-i', palettePath,
        '-loop', '0',
        '-filter_complex', '[0:v][1:v]paletteuse',
        '-y', outPath,
    ], frames.length, onProgress);
    const buf = await fs.readFile(outPath);
    await fs.unlink(outPath);
    return buf;
}
export async function encodeMp4(frames, fps, onProgress) {
    getFfmpegPath();
    const pattern = frames[0].replace(/frame-\d+\.png$/, 'frame-%06d.png');
    const outPath = frames[0].replace(/frame-\d+\.png$/, 'out.mp4');
    await spawnFfmpeg([
        '-framerate', String(fps), '-i', pattern,
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        '-y', outPath,
    ], frames.length, onProgress);
    const buf = await fs.readFile(outPath);
    await fs.unlink(outPath);
    return buf;
}
export async function encodeWebm(frames, fps, onProgress) {
    getFfmpegPath();
    const pattern = frames[0].replace(/frame-\d+\.png$/, 'frame-%06d.png');
    const outPath = frames[0].replace(/frame-\d+\.png$/, 'out.webm');
    await spawnFfmpeg([
        '-framerate', String(fps), '-i', pattern,
        '-c:v', 'libvpx-vp9',
        '-b:v', '0',
        '-crf', '33',
        '-y', outPath,
    ], frames.length, onProgress);
    const buf = await fs.readFile(outPath);
    await fs.unlink(outPath);
    return buf;
}
export async function renderAnimated(page, options, cycleMs, element, onProgress) {
    const emit = onProgress ?? (() => { });
    const tmpDir = path.join(os.tmpdir(), `pixdom-${randomUUID()}`);
    await fs.mkdir(tmpDir, { recursive: true });
    // Restrict temp dir access to owner only (10.1)
    await fs.chmod(tmpDir, 0o700);
    // Signal handlers to clean up temp files on early exit (10.2)
    const cleanup = () => {
        try {
            fsSync.rmSync(tmpDir, { recursive: true, force: true });
        }
        catch {
            // ignore cleanup errors during signal handling
        }
    };
    const sigtermHandler = () => { cleanup(); process.kill(process.pid, 'SIGTERM'); };
    const sigintHandler = () => { cleanup(); process.kill(process.pid, 'SIGINT'); };
    process.once('SIGTERM', sigtermHandler);
    process.once('SIGINT', sigintHandler);
    try {
        const fps = options.fps ?? 30;
        const frames = await captureFrames(page, cycleMs, fps, tmpDir, element, onProgress);
        const fmt = options.format.toUpperCase();
        emit({ type: 'encode-format', format: fmt });
        let buf;
        switch (options.format) {
            case 'gif':
                buf = await encodeGif(frames, fps, cycleMs, onProgress);
                break;
            case 'mp4':
                buf = await encodeMp4(frames, fps, onProgress);
                break;
            case 'webm':
                buf = await encodeWebm(frames, fps, onProgress);
                break;
            default:
                throw new Error(`Animated renderer does not handle format: ${options.format}`);
        }
        emit({ type: 'encode-done', format: fmt });
        emit({ type: 'step-start', step: 'write-output' });
        emit({ type: 'step-done', step: 'write-output' });
        return buf;
    }
    finally {
        // Remove signal handlers to avoid accumulation (10.3)
        process.off('SIGTERM', sigtermHandler);
        process.off('SIGINT', sigintHandler);
        await fs.rm(tmpDir, { recursive: true, force: true });
    }
}
