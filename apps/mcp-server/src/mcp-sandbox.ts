import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomBytes } from 'node:crypto';

// ── Task 1.1 ──────────────────────────────────────────────────────────────

export function getMcpOutputDir(): string {
  const envDir = process.env['PIXDOM_MCP_OUTPUT_DIR'];
  if (envDir) {
    return envDir.startsWith('~')
      ? path.join(os.homedir(), envDir.slice(1))
      : path.resolve(envDir);
  }
  return path.join(os.homedir(), 'pixdom-output');
}

export function ensureMcpOutputDir(): string {
  const dir = getMcpOutputDir();
  fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
  return dir;
}

// ── Task 1.2 ──────────────────────────────────────────────────────────────

interface SandboxError {
  code: 'MCP_OUTPUT_PATH_RESTRICTED';
  message: string;
  howToFix: string;
}

export function validateMcpOutputPath(
  requestedPath: string,
  outputDir: string,
): SandboxError | null {
  const resolved = path.resolve(requestedPath);
  // Normalise to ensure trailing sep so "~/pixdom-output-evil" doesn't pass
  const normalised = outputDir.endsWith(path.sep) ? outputDir : outputDir + path.sep;
  if (resolved !== outputDir && !resolved.startsWith(normalised)) {
    return {
      code: 'MCP_OUTPUT_PATH_RESTRICTED',
      message:
        `MCP server only writes to ${outputDir} for security. ` +
        `Requested path "${resolved}" is outside the allowed directory.`,
      howToFix:
        `Set PIXDOM_MCP_OUTPUT_DIR env var to change the allowed directory, ` +
        `or omit the output parameter to use an auto-generated path inside ${outputDir}.`,
    };
  }
  return null;
}

// ── Task 1.3 ──────────────────────────────────────────────────────────────

export function generateMcpOutputPath(outputDir: string, format: string): string {
  const timestamp = Date.now();
  const random = randomBytes(2).toString('hex');
  return path.join(outputDir, `pixdom-output-${timestamp}-${random}.${format}`);
}
