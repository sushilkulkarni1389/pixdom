import type { OnProgress } from './progress.js';
/**
 * Returns the ffmpeg-static binary path, throwing if unavailable.
 */
export declare function getFfmpegPath(): string;
/**
 * Spawns ffmpeg with the given argument array (no shell).
 * Parses `frame=N` lines from stderr to emit encode-progress events.
 * Rejects with an Error containing stderr output on non-zero exit.
 */
export declare function spawnFfmpeg(args: string[], totalFrames?: number, onProgress?: OnProgress): Promise<void>;
//# sourceMappingURL=ffmpeg-spawn.d.ts.map