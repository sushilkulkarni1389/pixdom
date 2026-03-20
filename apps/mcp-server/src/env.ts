/**
 * env.ts — central environment resolution for the MCP server.
 *
 * Rule 3: ANTHROPIC_API_KEY MUST be loaded via this module.
 * Rule 8: Output files MUST use OUTPUT_DIR from this module.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { readKey } from './keychain.js';
import { getMcpOutputDir } from './mcp-sandbox.js';

// ── OUTPUT_DIR (rule 8) ────────────────────────────────────────────────────

export const OUTPUT_DIR: string = getMcpOutputDir();

// ── API key resolution (rule 3) ────────────────────────────────────────────

function readConfigKey(): string | null {
  const claudeJsonPath = path.join(os.homedir(), '.claude.json');
  try {
    const config = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf8')) as Record<string, unknown>;

    // Global mcpServers
    const globalEntry = (config.mcpServers as Record<string, unknown> | undefined)?.['pixdom'] as
      | Record<string, unknown>
      | undefined;
    const globalKey = (globalEntry?.env as Record<string, string> | undefined)?.ANTHROPIC_API_KEY;
    if (globalKey) return globalKey;

    // Project-scoped mcpServers
    const projects = config.projects as Record<string, Record<string, unknown>> | undefined;
    if (projects) {
      for (const proj of Object.values(projects)) {
        const projEntry = (proj.mcpServers as Record<string, unknown> | undefined)?.[
          'pixdom'
        ] as Record<string, unknown> | undefined;
        const projKey = (projEntry?.env as Record<string, string> | undefined)?.ANTHROPIC_API_KEY;
        if (projKey) return projKey;
      }
    }
  } catch {
    // file missing, unreadable, or invalid JSON — not an error
  }
  return null;
}

/**
 * Resolves ANTHROPIC_API_KEY with priority: keychain → env var → ~/.claude.json.
 * Returns null if not found by any method.
 */
export function resolveApiKey(): string | null {
  return readKey() ?? process.env['ANTHROPIC_API_KEY'] ?? readConfigKey() ?? null;
}

export type ApiKeySource = 'keychain' | 'env' | 'config' | 'not-set';

export function getApiKeySource(configKey?: string): ApiKeySource {
  if (readKey()) return 'keychain';
  if (process.env['ANTHROPIC_API_KEY']) return 'env';
  if (configKey) return 'config';
  return 'not-set';
}
