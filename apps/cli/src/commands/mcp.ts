import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import type { Command } from 'commander';
import * as readline from 'node:readline';

const CLAUDE_JSON_PATH = path.join(os.homedir(), '.claude.json');
const MCP_ENTRY_NAME = 'pixdom';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readClaudeJson(): Record<string, unknown> {
  if (!fs.existsSync(CLAUDE_JSON_PATH)) {
    process.stderr.write(
      `Claude Code config not found at ${CLAUDE_JSON_PATH}\n` +
        `Make sure Claude Code is installed before running this command.\n`,
    );
    process.exit(1);
  }
  let raw: string;
  try {
    raw = fs.readFileSync(CLAUDE_JSON_PATH, 'utf8');
  } catch (err) {
    process.stderr.write(`Could not read ${CLAUDE_JSON_PATH}: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    process.stderr.write(
      `Could not parse ${CLAUDE_JSON_PATH} — please check the file manually\n`,
    );
    process.exit(1);
  }
}

function writeClaudeJsonAtomic(config: Record<string, unknown>): void {
  const tmp = CLAUDE_JSON_PATH + '.tmp';
  const serialised = JSON.stringify(config, null, 2) + '\n';
  try {
    fs.writeFileSync(tmp, serialised, { encoding: 'utf8' });
    fs.renameSync(tmp, CLAUDE_JSON_PATH);
  } catch (err) {
    // Clean up tmp if it exists
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    process.stderr.write(
      `Failed to write ${CLAUDE_JSON_PATH}: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(1);
  }
}

function prompt(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

function resolveMcpBinary(): { path: string; resolved: boolean } {
  // Try which/where first
  try {
    const result = execSync('which pixdom-mcp', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const resolved = result.trim();
    if (resolved && fs.existsSync(resolved)) {
      return { path: resolved, resolved: true };
    }
  } catch { /* not found via which */ }

  // Try relative to the currently running node executable
  const nodeDir = path.dirname(process.execPath);
  const candidate = path.join(nodeDir, 'pixdom-mcp');
  if (fs.existsSync(candidate)) {
    return { path: candidate, resolved: true };
  }

  return { path: 'pixdom-mcp', resolved: false };
}

function getMcpServersContainer(
  config: Record<string, unknown>,
): { container: Record<string, unknown>; scope: 'project' | 'global'; scopeKey: string } {
  const cwd = process.cwd();
  const projects = config.projects as Record<string, Record<string, unknown>> | undefined;

  if (projects && typeof projects === 'object') {
    // Pick the longest (most specific) matching project key
    let bestKey = '';
    for (const projectKey of Object.keys(projects)) {
      if ((cwd === projectKey || cwd.startsWith(projectKey + path.sep)) && projectKey.length > bestKey.length) {
        bestKey = projectKey;
      }
    }
    if (bestKey) {
      const proj = projects[bestKey] as Record<string, unknown>;
      if (!proj.mcpServers) proj.mcpServers = {};
      return { container: proj.mcpServers as Record<string, unknown>, scope: 'project', scopeKey: bestKey };
    }
  }

  if (!config.mcpServers) config.mcpServers = {};
  return { container: config.mcpServers as Record<string, unknown>, scope: 'global', scopeKey: '' };
}

// ---------------------------------------------------------------------------
// --install
// ---------------------------------------------------------------------------

async function cmdInstall(): Promise<void> {
  const config = readClaudeJson();
  const { container, scope, scopeKey } = getMcpServersContainer(config);

  if (container[MCP_ENTRY_NAME]) {
    const overwrite = await prompt(`pixdom MCP server is already configured. Overwrite? (y/N) `);
    if (!overwrite) {
      process.stdout.write('Aborted — no changes made.\n');
      process.exit(0);
    }
  }

  const { path: binaryPath, resolved } = resolveMcpBinary();
  if (!resolved) {
    process.stderr.write(
      `Warning: Could not resolve pixdom-mcp binary path. Storing bare command name.\n` +
        `If the MCP server fails to start, ensure pixdom-mcp is on PATH.\n`,
    );
  }

  container[MCP_ENTRY_NAME] = { command: binaryPath };
  writeClaudeJsonAtomic(config);

  if (scope === 'project') {
    process.stdout.write(`Added pixdom MCP server to project: ${scopeKey}\n`);
  } else {
    process.stdout.write(`Added pixdom MCP server globally\n`);
  }

  process.stdout.write(
    `\n✔ pixdom MCP server added to Claude Code\n` +
      `  Config:  ${CLAUDE_JSON_PATH}\n` +
      `  Command: ${binaryPath}\n` +
      `\nNext steps:\n` +
      `  1. Restart Claude Code to load the MCP server\n` +
      `  2. Run /mcp in Claude Code to confirm pixdom is listed\n` +
      `  3. To use generate_and_convert, add your API key:\n` +
      `       pixdom mcp --set-key sk-ant-...\n` +
      `     (or add ANTHROPIC_API_KEY to your shell profile)\n`,
  );
}

// ---------------------------------------------------------------------------
// --set-key
// ---------------------------------------------------------------------------

async function cmdSetKey(key: string): Promise<void> {
  const config = readClaudeJson();
  const { container } = getMcpServersContainer(config);

  const entry = container[MCP_ENTRY_NAME] as Record<string, unknown> | undefined;
  if (!entry) {
    process.stderr.write(
      `pixdom MCP server is not configured. Run 'pixdom mcp --install' first.\n`,
    );
    process.exit(1);
  }

  const existingEnv = entry.env as Record<string, string> | undefined;
  if (existingEnv?.ANTHROPIC_API_KEY) {
    const replace = await prompt(`API key already configured. Replace? (y/N) `);
    if (!replace) {
      process.stdout.write('Aborted — no changes made.\n');
      process.exit(0);
    }
  }

  if (!entry.env) entry.env = {};
  (entry.env as Record<string, string>).ANTHROPIC_API_KEY = key;
  writeClaudeJsonAtomic(config);

  process.stdout.write(
    `API key saved to ${CLAUDE_JSON_PATH} MCP config\n` +
      `Note: ${CLAUDE_JSON_PATH} is not encrypted. For higher security, set ANTHROPIC_API_KEY in your shell profile instead.\n`,
  );
}

// ---------------------------------------------------------------------------
// --uninstall
// ---------------------------------------------------------------------------

function cmdUninstall(): void {
  const config = readClaudeJson();
  const { container } = getMcpServersContainer(config);

  if (!container[MCP_ENTRY_NAME]) {
    process.stdout.write(`pixdom MCP server is not configured — nothing to remove.\n`);
    process.exit(0);
  }

  delete container[MCP_ENTRY_NAME];
  writeClaudeJsonAtomic(config);
  process.stdout.write(`✔ pixdom MCP server removed. Restart Claude Code to apply.\n`);
}

// ---------------------------------------------------------------------------
// --status
// ---------------------------------------------------------------------------

function cmdStatus(): void {
  let anyFail = false;

  // Check config
  let configEntry: Record<string, unknown> | undefined;
  let configScope = '';
  if (!fs.existsSync(CLAUDE_JSON_PATH)) {
    process.stdout.write(`  Config entry:    ✘ ${CLAUDE_JSON_PATH} not found\n`);
    anyFail = true;
  } else {
    let config: Record<string, unknown>;
    try {
      config = JSON.parse(fs.readFileSync(CLAUDE_JSON_PATH, 'utf8')) as Record<string, unknown>;
    } catch {
      process.stdout.write(`  Config entry:    ✘ could not parse ${CLAUDE_JSON_PATH}\n`);
      anyFail = true;
      reportStatus(anyFail);
      return;
    }
    const { container, scope, scopeKey } = getMcpServersContainer(config);
    configEntry = container[MCP_ENTRY_NAME] as Record<string, unknown> | undefined;
    if (configEntry) {
      configScope = scope === 'project' ? `project scope (${scopeKey})` : 'global scope';
      process.stdout.write(`  Config entry:    ✔ found in ${CLAUDE_JSON_PATH} (${configScope})\n`);
    } else {
      process.stdout.write(`  Config entry:    ✘ not found in ${CLAUDE_JSON_PATH}\n`);
      anyFail = true;
    }
  }

  // Check binary
  const { path: binaryPath, resolved } = resolveMcpBinary();
  if (resolved) {
    process.stdout.write(`  Binary:          ✔ ${binaryPath}\n`);
  } else {
    process.stdout.write(`  Binary:          ✘ pixdom-mcp not found on PATH\n`);
    anyFail = true;
  }

  // Check API key
  const envKey = process.env.ANTHROPIC_API_KEY;
  const configKey = (configEntry?.env as Record<string, string> | undefined)?.ANTHROPIC_API_KEY;
  if (envKey) {
    process.stdout.write(`  API key:         ✔ set in shell environment\n`);
  } else if (configKey) {
    process.stdout.write(`  API key:         ✔ set in MCP config\n`);
  } else {
    process.stdout.write(`  API key:         ✘ not set (ANTHROPIC_API_KEY missing)\n`);
    anyFail = true;
  }

  process.stdout.write(`  Claude Code:     restart required to apply any recent changes\n`);
  reportStatus(anyFail);
}

function reportStatus(anyFail: boolean): void {
  if (anyFail) process.exit(1);
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

export function registerMcp(program: Command): void {
  program
    .command('mcp')
    .description('Manage the pixdom MCP server registration with Claude Code')
    .option('--install', 'Write MCP config entry to ~/.claude.json')
    .option('--uninstall', 'Remove pixdom MCP entry from ~/.claude.json')
    .option('--status', 'Show whether MCP server is registered and reachable')
    .option('--set-key <key>', 'Add ANTHROPIC_API_KEY to the MCP server env in ~/.claude.json')
    .action(async (opts: { install?: boolean; uninstall?: boolean; status?: boolean; setKey?: string }) => {
      if (opts.install) {
        await cmdInstall();
      } else if (opts.setKey !== undefined) {
        await cmdSetKey(opts.setKey);
      } else if (opts.uninstall) {
        cmdUninstall();
      } else if (opts.status) {
        process.stdout.write(`pixdom MCP server status:\n`);
        cmdStatus();
      } else {
        process.stdout.write(
          `Usage: pixdom mcp [options]\n\n` +
            `Options:\n` +
            `  --install          Write MCP config entry to ~/.claude.json\n` +
            `  --uninstall        Remove pixdom MCP entry from ~/.claude.json\n` +
            `  --status           Show whether MCP server is registered and reachable\n` +
            `  --set-key <key>    Add ANTHROPIC_API_KEY to the MCP server env\n` +
            `  --help             Show this help\n`,
        );
        process.exit(0);
      }
    });
}
