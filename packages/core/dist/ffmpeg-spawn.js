import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
/**
 * Returns the ffmpeg-static binary path, throwing if unavailable.
 */
export function getFfmpegPath() {
    if (!ffmpegPath) {
        throw new Error('FFmpeg binary not available on this platform (ffmpeg-static returned null)');
    }
    return ffmpegPath;
}
/**
 * Spawns ffmpeg with the given argument array (no shell).
 * Parses `frame=N` lines from stderr to emit encode-progress events.
 * Rejects with an Error containing stderr output on non-zero exit.
 */
export function spawnFfmpeg(args, totalFrames, onProgress) {
    return new Promise((resolve, reject) => {
        const bin = getFfmpegPath();
        const proc = spawn(bin, args, { shell: false });
        const stderrLines = [];
        let stderrBuf = '';
        proc.stderr.on('data', (chunk) => {
            stderrBuf += chunk.toString();
            const lines = stderrBuf.split('\n');
            stderrBuf = lines.pop() ?? '';
            for (const line of lines) {
                stderrLines.push(line);
                if (onProgress && totalFrames != null && totalFrames > 0) {
                    const m = line.match(/frame=\s*(\d+)/);
                    if (m) {
                        const pct = Math.min(100, Math.round((parseInt(m[1], 10) / totalFrames) * 100));
                        onProgress({ type: 'encode-progress', pct });
                    }
                }
            }
        });
        proc.on('error', (err) => reject(err));
        proc.on('close', (code) => {
            if (code === 0) {
                resolve();
            }
            else {
                const stderr = stderrLines.join('\n');
                reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
            }
        });
    });
}
