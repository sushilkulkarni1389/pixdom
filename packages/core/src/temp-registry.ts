import fsSync from 'node:fs';
import fs from 'node:fs/promises';

// ── Module-level registry ──────────────────────────────────────────────────

const activeTempDirs = new Set<string>();

// ── Task 4.1 ──────────────────────────────────────────────────────────────

export function registerTempDir(dir: string): void {
  activeTempDirs.add(dir);
}

// ── Task 4.2 ──────────────────────────────────────────────────────────────

export async function releaseTempDir(dir: string): Promise<void> {
  activeTempDirs.delete(dir);
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    // best-effort — ignore cleanup errors
  }
}

// ── Task 4.3 ──────────────────────────────────────────────────────────────

export function cleanupAll(): void {
  for (const dir of activeTempDirs) {
    try {
      fsSync.rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort — ignore cleanup errors during signal handling
    }
  }
  activeTempDirs.clear();
}

// ── Signal handlers — registered ONCE at module load (Task 4.1) ───────────

process.once('SIGINT', () => {
  cleanupAll();
  process.exit(130);
});

process.once('SIGTERM', () => {
  cleanupAll();
  process.exit(143);
});
