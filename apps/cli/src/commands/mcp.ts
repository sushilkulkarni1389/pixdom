import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import type { Command } from 'commander';
import * as readline from 'node:readline';

const CLAUDE_JSON_PATH = path.join(os.homedir(), '.claude.json');
const MCP_ENTRY_NAME = 'pixdom';
const KEYCHAIN_SERVICE = 'pixdom';
const KEYCHAIN_ACCOUNT = 'anthropic_api_key';

// ---------------------------------------------------------------------------
// Keychain helpers (task 2.5 / 2.7)
// ---------------------------------------------------------------------------

function commandExists(cmd: string): boolean {
  try { execSync(`which ${cmd}`, { stdio: 'pipe' }); return true; } catch { return false; }
}

type StoreResult =
  | { method: 'keychain'; platform: string }
  | { method: 'unavailable'; reason: string };

function storeKeyInKeychain(key: string): StoreResult {
  try {
    if (process.platform === 'darwin') {
      execSync(
        `security add-generic-password -s ${KEYCHAIN_SERVICE} -a ${KEYCHAIN_ACCOUNT} -w ${key} -U`,
        { stdio: 'pipe' },
      );
      return { method: 'keychain', platform: 'macOS keychain' };
    }
    if (process.platform === 'linux') {
      if (commandExists('secret-tool')) {
        execSync(
          `secret-tool store --label="pixdom" service ${KEYCHAIN_SERVICE} username ${KEYCHAIN_ACCOUNT}`,
          { input: key, stdio: ['pipe', 'pipe', 'pipe'] },
        );
        return { method: 'keychain', platform: 'system keychain (libsecret)' };
      }
      process.stderr.write(
        'Note: secret-tool not found — install libsecret-tools for keychain storage.\n',
      );
      return { method: 'unavailable', reason: 'secret-tool not found' };
    }
    if (process.platform === 'win32') {
      const script = [
        `$v=[Windows.Security.Credentials.PasswordVault,Windows.Security.Credentials,ContentType=WindowsRuntime]::new()`,
        `$c=[Windows.Security.Credentials.PasswordCredential,Windows.Security.Credentials,ContentType=WindowsRuntime]::new('${KEYCHAIN_SERVICE}','${KEYCHAIN_ACCOUNT}','${key}')`,
        `$v.Add($c)`,
      ].join(';');
      execSync(`powershell -Command "${script}"`, { stdio: 'pipe' });
      return { method: 'keychain', platform: 'Windows Credential Manager' };
    }
    return { method: 'unavailable', reason: `unsupported platform: ${process.platform}` };
  } catch {
    return { method: 'unavailable', reason: 'keychain operation failed' };
  }
}

function readKeyFromKeychain(): string | null {
  try {
    if (process.platform === 'darwin') {
      const r = execSync(
        `security find-generic-password -s ${KEYCHAIN_SERVICE} -a ${KEYCHAIN_ACCOUNT} -w`,
        { stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8' },
      );
      return r.trim() || null;
    }
    if (process.platform === 'linux' && commandExists('secret-tool')) {
      const r = execSync(
        `secret-tool lookup service ${KEYCHAIN_SERVICE} username ${KEYCHAIN_ACCOUNT}`,
        { stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8' },
      );
      return r.trim() || null;
    }
    if (process.platform === 'win32') {
      const script = [
        `$v=[Windows.Security.Credentials.PasswordVault,Windows.Security.Credentials,ContentType=WindowsRuntime]::new()`,
        `$c=$v.Retrieve('${KEYCHAIN_SERVICE}','${KEYCHAIN_ACCOUNT}')`,
        `$c.RetrievePassword()`,
        `Write-Output $c.Password`,
      ].join(';');
      const r = execSync(`powershell -Command "${script}"`, {
        stdio: ['pipe', 'pipe', 'pipe'],
        encoding: 'utf8',
      });
      return r.trim() || null;
    }
  } catch { /* fall through */ }
  return null;
}

type ApiKeySource = 'keychain' | 'env' | 'config' | 'not-set';

function getApiKeySource(configKey?: string): ApiKeySource {
  if (readKeyFromKeychain()) return 'keychain';
  if (process.env['ANTHROPIC_API_KEY']) return 'env';
  if (configKey) return 'config';
  return 'not-set';
}

// ---------------------------------------------------------------------------
// MCP output sandbox / file scope helpers (tasks 1.6 / 3.5)
// ---------------------------------------------------------------------------

function getMcpOutputDir(): string {
  const envDir = process.env['PIXDOM_MCP_OUTPUT_DIR'];
  if (envDir) {
    return envDir.startsWith('~') ? path.join(os.homedir(), envDir.slice(1)) : path.resolve(envDir);
  }
  return path.join(os.homedir(), 'pixdom-output');
}

function getMcpAllowedDirs(): string[] {
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

function isActiveClaudeProject(proj: Record<string, unknown>): boolean {
  return proj.hasTrustDialogAccepted === true ||
    (typeof proj.projectOnboardingSeenCount === 'number' && proj.projectOnboardingSeenCount > 0);
}

function getMcpServersContainer(
  config: Record<string, unknown>,
): { container: Record<string, unknown>; scope: 'project' | 'global'; scopeKey: string } {
  const cwd = process.cwd();
  const homeDir = os.homedir();
  const projects = config.projects as Record<string, Record<string, unknown>> | undefined;

  if (cwd !== homeDir && projects && typeof projects === 'object') {
    // Pick the longest (most specific) matching project key that is an active Claude Code project
    let bestKey = '';
    for (const projectKey of Object.keys(projects)) {
      if (
        (cwd === projectKey || cwd.startsWith(projectKey + path.sep)) &&
        projectKey.length > bestKey.length &&
        isActiveClaudeProject(projects[projectKey])
      ) {
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
      `  3. To use generate_and_convert, set your Anthropic API key:\n` +
      `\n` +
      `     Recommended: add to ~/.bashrc (or ~/.zshrc):\n` +
      `       export ANTHROPIC_API_KEY=sk-ant-...\n` +
      `\n` +
      `     Or store securely in your OS keychain:\n` +
      `       pixdom mcp --set-key sk-ant-...\n`,
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

  // Task 2.5: attempt keychain storage first
  const storeResult = storeKeyInKeychain(key);

  if (storeResult.method === 'keychain') {
    process.stdout.write(`✔ API key stored in ${storeResult.platform}\n`);
    return;
  }

  // Plaintext fallback: write to ~/.claude.json env block
  if (!entry.env) entry.env = {};
  (entry.env as Record<string, string>).ANTHROPIC_API_KEY = key;
  writeClaudeJsonAtomic(config);

  // Harden file permissions to owner read/write only
  try { fs.chmodSync(CLAUDE_JSON_PATH, 0o600); } catch { /* best-effort */ }

  process.stdout.write(
    `API key saved to ${CLAUDE_JSON_PATH} MCP config\n` +
      `⚠  API key stored in plaintext in ${CLAUDE_JSON_PATH}\n` +
      `   For better security: export ANTHROPIC_API_KEY=sk-ant-... in ~/.bashrc\n`,
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

  // Check API key — task 2.7: show storage method
  const configKey = (configEntry?.env as Record<string, string> | undefined)?.ANTHROPIC_API_KEY;
  const keySource = getApiKeySource(configKey);
  const keySourceLabels: Record<typeof keySource, string> = {
    keychain: 'keychain',
    env: 'env var (ANTHROPIC_API_KEY)',
    config: 'plaintext (~/.claude.json)',
    'not-set': 'not set',
  };
  const keyOk = keySource !== 'not-set';
  const keyIcon = keyOk ? '✔' : '✘';
  process.stdout.write(`  API key storage: ${keyIcon} ${keySourceLabels[keySource]}\n`);
  if (!keyOk) anyFail = true;

  // Task 1.6: output sandbox directory
  const outputDir = getMcpOutputDir();
  process.stdout.write(`  Output directory: ${outputDir}\n`);

  // Task 3.5: allowed input directories
  const allowedDirs = getMcpAllowedDirs();
  process.stdout.write(`  Allowed input dirs:\n`);
  for (const dir of allowedDirs) {
    process.stdout.write(`    • ${dir}\n`);
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
