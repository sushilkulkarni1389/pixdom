import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Page } from 'playwright';
import type { RenderOptions } from '@pixdom/types';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

function assertFfmpegAvailable(): void {
  if (!ffmpegPath) {
    throw new Error('FFmpeg binary not available on this platform (ffmpeg-static returned null)');
  }
}

/**
 * Drives a rAF loop via page.evaluate for `cycleMs` duration, taking a
 * Playwright screenshot after each frame. Returns sorted frame file paths.
 */
export async function captureFrames(
  page: Page,
  cycleMs: number,
  fps: number,
  outDir: string,
): Promise<string[]> {
  const frameCount = Math.max(1, Math.round((cycleMs / 1000) * fps));
  const frameIntervalMs = cycleMs / frameCount;

  await page.clock.install({ time: 0 });

  const paths: string[] = [];
  for (let i = 0; i < frameCount; i++) {
    await page.clock.runFor(frameIntervalMs);
    const framePath = path.join(outDir, `frame-${String(i).padStart(6, '0')}.png`);
    await page.screenshot({ type: 'png', fullPage: false, path: framePath });
    paths.push(framePath);
  }
  return paths;
}

function ffmpegEncode(
  inputPattern: string,
  fps: number,
  outputPath: string,
  extraArgs: string[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg()
      .input(inputPattern)
      .inputOptions([`-framerate ${fps}`])
      .outputOptions(extraArgs)
      .on('error', reject)
      .on('end', () => resolve());
    cmd.save(outputPath);
  });
}

export async function encodeGif(
  frames: string[],
  fps: number,
  _cycleMs: number,
): Promise<Buffer> {
  assertFfmpegAvailable();
  const pattern = frames[0]!.replace(/frame-\d+\.png$/, 'frame-%06d.png');
  const palettePath = frames[0]!.replace(/frame-\d+\.png$/, 'palette.png');
  const outPath = frames[0]!.replace(/frame-\d+\.png$/, 'out.gif');

  // Pass 1: generate a globally-optimal palette from all frames
  await ffmpegEncode(pattern, fps, palettePath, ['-vf', 'palettegen']);

  // Pass 2: encode GIF using the palette derived from the full sequence
  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(pattern)
      .inputOptions([`-framerate ${fps}`])
      .input(palettePath)
      .outputOptions(['-loop', '0', '-filter_complex', '[0:v][1:v]paletteuse'])
      .on('error', reject)
      .on('end', () => resolve())
      .save(outPath);
  });

  const buf = await fs.readFile(outPath);
  await fs.unlink(outPath);
  return buf;
}

export async function encodeMp4(frames: string[], fps: number): Promise<Buffer> {
  assertFfmpegAvailable();
  const outPath = frames[0]!.replace(/frame-\d+\.png$/, 'out.mp4');
  const pattern = frames[0]!.replace(/frame-\d+\.png$/, 'frame-%06d.png');
  await ffmpegEncode(pattern, fps, outPath, ['-pix_fmt', 'yuv420p', '-movflags', '+faststart']);
  const buf = await fs.readFile(outPath);
  await fs.unlink(outPath);
  return buf;
}

export async function encodeWebm(frames: string[], fps: number): Promise<Buffer> {
  assertFfmpegAvailable();
  const outPath = frames[0]!.replace(/frame-\d+\.png$/, 'out.webm');
  const pattern = frames[0]!.replace(/frame-\d+\.png$/, 'frame-%06d.png');
  await ffmpegEncode(pattern, fps, outPath, ['-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '33']);
  const buf = await fs.readFile(outPath);
  await fs.unlink(outPath);
  return buf;
}

export async function renderAnimated(
  page: Page,
  options: RenderOptions,
  cycleMs: number,
): Promise<Buffer> {
  const tmpDir = path.join(os.tmpdir(), `pixdom-${randomUUID()}`);
  await fs.mkdir(tmpDir, { recursive: true });

  try {
    const fps = options.fps ?? 30;
    const frames = await captureFrames(page, cycleMs, fps, tmpDir);

    switch (options.format) {
      case 'gif':
        return await encodeGif(frames, fps, cycleMs);
      case 'mp4':
        return await encodeMp4(frames, fps);
      case 'webm':
        return await encodeWebm(frames, fps);
      default:
        throw new Error(`Animated renderer does not handle format: ${options.format}`);
    }
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}
