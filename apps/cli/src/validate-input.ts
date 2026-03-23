import fs from 'node:fs';
import path from 'node:path';
import type { RenderErrorCode } from '@pixdom/core';

const HTML_EXTS = new Set(['.html', '.htm']);
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

// ---------------------------------------------------------------------------
// Raw IPv4 CIDR block check — runs before DNS, before Playwright
// ---------------------------------------------------------------------------

interface Cidr4 { base: number; mask: number; }

function parseCidr4(cidr: string): Cidr4 {
  const [ip, bits] = cidr.split('/');
  const mask = bits ? ~((1 << (32 - Number(bits))) - 1) >>> 0 : 0xffffffff;
  const parts = ip!.split('.').map(Number);
  const base = (((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0);
  return { base: base >>> 0, mask: mask >>> 0 };
}

function ipv4ToInt(ip: string): number {
  const parts = ip.split('.').map(Number);
  return (((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0);
}

const BLOCKED_CIDRS: Cidr4[] = [
  '127.0.0.0/8', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '169.254.0.0/16',
].map(parseCidr4);

const RAW_IPV4_RE = /^\d+\.\d+\.\d+\.\d+$/;

/**
 * If hostname is a raw IPv4 literal that falls within a blocked CIDR range,
 * returns a ValidationError. Returns null otherwise (including for hostnames
 * that are not raw IPv4 addresses — those are handled by DNS lookup later).
 * Call this before any dns.lookup and before Playwright launches.
 */
export function validateRawIpv4Host(hostname: string): ValidationError | null {
  if (!RAW_IPV4_RE.test(hostname)) return null;
  const n = ipv4ToInt(hostname);
  const blocked = BLOCKED_CIDRS.some((c) => ((n & c.mask) >>> 0) === c.base);
  if (blocked) {
    return {
      code: 'INVALID_URL_HOST',
      message: `URL host "${hostname}" is a blocked address. Loopback, private, and cloud-metadata addresses are not permitted.`,
    };
  }
  return null;
}

const VALID_FORMATS = ['png', 'jpeg', 'webp', 'gif', 'mp4', 'webm'] as const;

/**
 * Validates that the requested output format is supported.
 * Returns a ValidationError if unsupported, or null if valid.
 */
export function validateFormat(format: string): ValidationError | null {
  if (!(VALID_FORMATS as readonly string[]).includes(format)) {
    return {
      code: 'INVALID_FILE_TYPE',
      message: `Unsupported format "${format}". How to fix: Use one of: png, jpeg, webp, gif, mp4, webm`,
    };
  }
  return null;
}

interface ValidationError {
  code: RenderErrorCode;
  message: string;
}

/** Sniff first 16 bytes to determine if the file matches the expected category. */
function sniffFile(filePath: string, flag: '--file' | '--image'): boolean {
  let buf: Buffer;
  try {
    const fd = fs.openSync(filePath, 'r');
    buf = Buffer.alloc(16);
    fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);
  } catch {
    return false;
  }

  if (flag === '--file') {
    // HTML: starts with  <!  or  <h  or  <H  or  BOM + <
    const str = buf.toString('utf8', 0, 12).trimStart();
    return str.startsWith('<!') || str.toLowerCase().startsWith('<h') || str.startsWith('<');
  }

  if (flag === '--image') {
    // PNG: \x89PNG
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
    // JPEG: \xFF\xD8
    if (buf[0] === 0xff && buf[1] === 0xd8) return true;
    // GIF: GIF8
    if (buf.toString('ascii', 0, 4) === 'GIF8') return true;
    // WebP: RIFF....WEBP
    if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return true;
  }

  return false;
}

/**
 * Validates existence and file type for --file and --image inputs.
 * Returns a ValidationError if the file is missing or has an unsupported type,
 * or null if validation passes.
 */
export function validateFileInput(
  flag: '--file' | '--image',
  resolvedPath: string,
): ValidationError | null {
  const name = path.basename(resolvedPath);

  // Existence check first
  if (!fs.existsSync(resolvedPath)) {
    if (flag === '--image') {
      return { code: 'IMAGE_NOT_FOUND', message: `Image "${name}" does not exist at ${resolvedPath}` };
    }
    return { code: 'FILE_NOT_FOUND', message: `File "${name}" does not exist at ${resolvedPath}` };
  }

  const ext = path.extname(resolvedPath).toLowerCase();
  const allowedExts = flag === '--file' ? HTML_EXTS : IMAGE_EXTS;

  if (ext === '') {
    // No extension — fall through to MIME sniff
    if (!sniffFile(resolvedPath, flag)) {
      return {
        code: 'INVALID_FILE_TYPE',
        message: `"${name}" is not a supported input type for ${flag}. Could not determine file type from contents.`,
      };
    }
    return null;
  }

  if (!allowedExts.has(ext)) {
    if (flag === '--file') {
      return {
        code: 'INVALID_FILE_TYPE',
        message: `"${name}" is not a supported input file type. ${flag} only accepts .html or .htm files. To convert an image use --image instead.`,
      };
    }
    return {
      code: 'INVALID_FILE_TYPE',
      message: `"${name}" is not a supported image type. --image accepts .png, .jpg, .jpeg, .webp, .gif only.`,
    };
  }

  return null;
}
