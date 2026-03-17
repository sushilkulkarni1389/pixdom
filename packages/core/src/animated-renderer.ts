import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Page } from 'playwright';
import type { RenderOptions } from '@pixdom/types';
import ffmpeg from 'fluent-ffmpeg';

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
  const frameInterval = cycleMs / frameCount; // ms between frames

  // Advance the page animation clock one frame at a time and screenshot
  const paths: string[] = [];
  for (let i = 0; i < frameCount; i++) {
    const framePath = path.join(outDir, `frame-${String(i).padStart(6, '0')}.png`);
    await page.screenshot({ type: 'png', fullPage: false, path: framePath });
    paths.push(framePath);
    // Advance time by injecting a small delay so CSS/rAF animations progress
    if (i < frameCount - 1) {
      await page.evaluate(
        (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
        frameInterval,
      );
    }
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
  const outPath = frames[0]!.replace(/frame-\d+\.png$/, 'out.gif');
  const pattern = frames[0]!.replace(/frame-\d+\.png$/, 'frame-%06d.png');
  await ffmpegEncode(pattern, fps, outPath, ['-loop', '0', '-vf', 'split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse']);
  const buf = await fs.readFile(outPath);
  await fs.unlink(outPath);
  return buf;
}

export async function encodeMp4(frames: string[], fps: number): Promise<Buffer> {
  const outPath = frames[0]!.replace(/frame-\d+\.png$/, 'out.mp4');
  const pattern = frames[0]!.replace(/frame-\d+\.png$/, 'frame-%06d.png');
  await ffmpegEncode(pattern, fps, outPath, ['-pix_fmt', 'yuv420p', '-movflags', '+faststart']);
  const buf = await fs.readFile(outPath);
  await fs.unlink(outPath);
  return buf;
}

export async function encodeWebm(frames: string[], fps: number): Promise<Buffer> {
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
