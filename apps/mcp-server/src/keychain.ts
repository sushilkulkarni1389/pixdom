import { execSync } from 'node:child_process';

const SERVICE = 'pixdom';
const ACCOUNT = 'anthropic_api_key';

// ── Platform helpers ───────────────────────────────────────────────────────

function commandExists(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// ── macOS: security CLI ────────────────────────────────────────────────────

function storeMacOS(key: string): void {
  // -U: update existing entry if present
  execSync(
    `security add-generic-password -s ${SERVICE} -a ${ACCOUNT} -w ${key} -U`,
    { stdio: 'pipe' },
  );
}

function readMacOS(): string | null {
  try {
    const result = execSync(
      `security find-generic-password -s ${SERVICE} -a ${ACCOUNT} -w`,
      { stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8' },
    );
    return result.trim() || null;
  } catch {
    return null;
  }
}

// ── Linux: secret-tool (libsecret) ────────────────────────────────────────

function storeLinux(key: string): void {
  execSync(
    `secret-tool store --label="pixdom" service ${SERVICE} username ${ACCOUNT}`,
    { input: key, stdio: ['pipe', 'pipe', 'pipe'] },
  );
}

function readLinux(): string | null {
  try {
    const result = execSync(
      `secret-tool lookup service ${SERVICE} username ${ACCOUNT}`,
      { stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8' },
    );
    return result.trim() || null;
  } catch {
    return null;
  }
}

// ── Windows: PowerShell PasswordVault ─────────────────────────────────────

function storeWindows(key: string): void {
  const script = [
    `$vault = [Windows.Security.Credentials.PasswordVault,Windows.Security.Credentials,ContentType=WindowsRuntime]::new()`,
    `$cred  = [Windows.Security.Credentials.PasswordCredential,Windows.Security.Credentials,ContentType=WindowsRuntime]::new('${SERVICE}', '${ACCOUNT}', '${key}')`,
    `$vault.Add($cred)`,
  ].join('; ');
  execSync(`powershell -Command "${script}"`, { stdio: 'pipe' });
}

function readWindows(): string | null {
  try {
    const script = [
      `$vault = [Windows.Security.Credentials.PasswordVault,Windows.Security.Credentials,ContentType=WindowsRuntime]::new()`,
      `$cred  = $vault.Retrieve('${SERVICE}', '${ACCOUNT}')`,
      `$cred.RetrievePassword()`,
      `Write-Output $cred.Password`,
    ].join('; ');
    const result = execSync(`powershell -Command "${script}"`, {
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf8',
    });
    return result.trim() || null;
  } catch {
    return null;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

export type StoreResult =
  | { method: 'keychain'; platform: string }
  | { method: 'unavailable'; reason: string };

export function storeKey(key: string): StoreResult {
  try {
    if (process.platform === 'darwin') {
      storeMacOS(key);
      return { method: 'keychain', platform: 'macOS keychain' };
    }
    if (process.platform === 'linux') {
      if (commandExists('secret-tool')) {
        storeLinux(key);
        return { method: 'keychain', platform: 'system keychain (libsecret)' };
      }
      process.stderr.write(
        'Note: secret-tool not found — install libsecret-tools for keychain storage.\n',
      );
      return { method: 'unavailable', reason: 'secret-tool not found' };
    }
    if (process.platform === 'win32') {
      storeWindows(key);
      return { method: 'keychain', platform: 'Windows Credential Manager' };
    }
    return { method: 'unavailable', reason: `unsupported platform: ${process.platform}` };
  } catch {
    return { method: 'unavailable', reason: 'keychain operation failed' };
  }
}

export function readKey(): string | null {
  try {
    if (process.platform === 'darwin') return readMacOS();
    if (process.platform === 'linux' && commandExists('secret-tool')) return readLinux();
    if (process.platform === 'win32') return readWindows();
  } catch {
    // fall through
  }
  return null;
}
