import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// ── Task 3.1 ──────────────────────────────────────────────────────────────

export function getMcpAllowedDirs(): string[] {
  const envDirs = process.env['PIXDOM_MCP_ALLOWED_DIRS'];
  if (envDirs) {
    return envDirs
      .split(':')
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => (d.startsWith('~') ? path.join(os.homedir(), d.slice(1)) : path.resolve(d)));
  }
  return [
    path.join(os.homedir(), 'pixdom-input'),
    path.join(os.homedir(), 'Downloads'),
    path.join(os.homedir(), 'Desktop'),
  ];
}

// ── Task 3.2 ──────────────────────────────────────────────────────────────

interface FilePathError {
  code: 'MCP_FILE_PATH_RESTRICTED';
  message: string;
  howToFix: string;
}

export function validateMcpFilePath(
  filePath: string,
  allowedDirs: string[],
): FilePathError | null {
  let realPath: string;
  try {
    realPath = fs.realpathSync(filePath);
  } catch {
    const dirList = allowedDirs.map((d) => `  • ${d}`).join('\n');
    return {
      code: 'MCP_FILE_PATH_RESTRICTED',
      message: `File "${filePath}" does not exist or could not be resolved.`,
      howToFix:
        `MCP server only reads files from allowed directories:\n${dirList}\n` +
        `Set PIXDOM_MCP_ALLOWED_DIRS env var to add directories.`,
    };
  }

  const allowed = allowedDirs.some((dir) => {
    const normalised = dir.endsWith(path.sep) ? dir : dir + path.sep;
    return realPath === dir || realPath.startsWith(normalised);
  });

  if (!allowed) {
    const dirList = allowedDirs.map((d) => `  • ${d}`).join('\n');
    return {
      code: 'MCP_FILE_PATH_RESTRICTED',
      message: `File "${realPath}" is outside the allowed input directories.`,
      howToFix:
        `MCP server only reads files from allowed directories:\n${dirList}\n` +
        `Set PIXDOM_MCP_ALLOWED_DIRS env var to add directories.`,
    };
  }

  return null;
}
