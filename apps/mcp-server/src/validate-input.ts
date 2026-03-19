import dns from 'node:dns/promises';
import fs from 'node:fs';
import path from 'node:path';
import type { RenderErrorCode } from '@pixdom/core';

interface ValidationError {
  code: RenderErrorCode | 'INTERNAL_ERROR';
  message: string;
  howToFix: string;
}

// --- File input validation (task 3.4 / 3.5) ---

const HTML_EXTS = new Set(['.html', '.htm']);
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

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
    const str = buf.toString('utf8', 0, 12).trimStart();
    return str.startsWith('<!') || str.toLowerCase().startsWith('<h') || str.startsWith('<');
  }

  if (flag === '--image') {
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
    if (buf[0] === 0xff && buf[1] === 0xd8) return true;
    if (buf.toString('ascii', 0, 4) === 'GIF8') return true;
    if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return true;
  }

  return false;
}

export function validateFileInput(
  flag: '--file' | '--image',
  resolvedPath: string,
): ValidationError | null {
  const name = path.basename(resolvedPath);

  if (!fs.existsSync(resolvedPath)) {
    if (flag === '--image') {
      return {
        code: 'IMAGE_NOT_FOUND',
        message: `Image "${name}" does not exist at ${resolvedPath}`,
        howToFix: 'Check that the image path is correct and the file exists.',
      };
    }
    return {
      code: 'FILE_NOT_FOUND',
      message: `File "${name}" does not exist at ${resolvedPath}`,
      howToFix: 'Check that the file path is correct and the file exists.',
    };
  }

  const ext = path.extname(resolvedPath).toLowerCase();
  const allowedExts = flag === '--file' ? HTML_EXTS : IMAGE_EXTS;

  if (ext === '') {
    if (!sniffFile(resolvedPath, flag)) {
      return {
        code: 'INVALID_FILE_TYPE',
        message: `"${name}" is not a supported input type for ${flag}. Could not determine file type from contents.`,
        howToFix: flag === '--file'
          ? 'Use a .html or .htm file, or ensure the file begins with valid HTML markup.'
          : 'Use a .png, .jpg, .jpeg, .webp, or .gif image file.',
      };
    }
    return null;
  }

  if (!allowedExts.has(ext)) {
    if (flag === '--file') {
      return {
        code: 'INVALID_FILE_TYPE',
        message: `"${name}" is not a supported input file type. file only accepts .html or .htm files.`,
        howToFix: 'Use a .html or .htm file for the file parameter, or use image for image files.',
      };
    }
    return {
      code: 'INVALID_FILE_TYPE',
      message: `"${name}" is not a supported image type. image accepts .png, .jpg, .jpeg, .webp, .gif only.`,
      howToFix: 'Use .png, .jpg, .jpeg, .webp, or .gif for image input.',
    };
  }

  return null;
}

// --- URL validation (tasks 1.1) ---

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

function isBlockedIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  return BLOCKED_CIDRS.some((c) => ((n & c.mask) >>> 0) === c.base);
}

function isBlockedIpv6(ip: string): boolean {
  const lower = ip.toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
  if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  return false;
}

export async function validateUrl(
  rawUrl: string,
  allowLocal: boolean,
): Promise<ValidationError | null> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return {
      code: 'INVALID_URL_PROTOCOL',
      message: `Invalid URL: ${rawUrl}`,
      howToFix: 'Provide a valid http:// or https:// URL.',
    };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      code: 'INVALID_URL_PROTOCOL',
      message: `URL protocol "${parsed.protocol}" is not allowed. Only http:// and https:// are supported.`,
      howToFix: 'Use http:// or https:// URLs only. file:// and other protocols are not supported.',
    };
  }

  if (!allowLocal) {
    const hostname = parsed.hostname.replace(/^\[/, '').replace(/\]$/, '');

    // Check if hostname is already a raw IP address
    const ipv4Re = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
    if (ipv4Re.test(hostname)) {
      if (isBlockedIpv4(hostname)) {
        return {
          code: 'INVALID_URL_HOST',
          message: `URL host "${hostname}" is a blocked address. Loopback, private, and cloud-metadata addresses are not permitted.`,
          howToFix: 'Use a public URL, or set allowLocal: true to permit private-network URLs (development only).',
        };
      }
    } else if (isBlockedIpv6(hostname)) {
      return {
        code: 'INVALID_URL_HOST',
        message: `URL host "${hostname}" is a blocked address. Loopback and private IPv6 addresses are not permitted.`,
        howToFix: 'Use a public URL, or set allowLocal: true to permit private-network URLs (development only).',
      };
    } else {
      // Resolve hostname via DNS and check resolved addresses
      try {
        const addrs = await Promise.race([
          dns.lookup(hostname, { all: true }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('DNS timeout')), 5000)),
        ]);
        for (const addr of addrs) {
          const blocked =
            addr.family === 4 ? isBlockedIpv4(addr.address) : isBlockedIpv6(addr.address);
          if (blocked) {
            return {
              code: 'INVALID_URL_HOST',
              message: `URL host "${hostname}" resolves to a blocked address (${addr.address}). Loopback, private, and cloud-metadata addresses are not permitted.`,
              howToFix: 'Use a public URL, or set allowLocal: true to permit private-network URLs (development only).',
            };
          }
        }
      } catch (e) {
        // DNS resolution failed or timed out — not a known private host, allow through
        if (e instanceof Error && e.message === 'DNS timeout') {
          return {
            code: 'INVALID_URL_HOST',
            message: `DNS lookup for "${hostname}" timed out.`,
            howToFix: 'Check that the hostname is reachable, or set allowLocal: true for local addresses.',
          };
        }
      }
    }
  } else {
    process.stderr.write('Warning: allowLocal is active — localhost and private network URLs are permitted.\n');
  }

  return null;
}

// --- Output path validation (task 1.2) ---

const SHELL_METACHARACTERS = /[;&|$`()<>\n]/;

export function validateOutputPath(outputPath: string): ValidationError | null {
  if (SHELL_METACHARACTERS.test(outputPath)) {
    return {
      code: 'INVALID_OUTPUT_PATH',
      message: `Output path contains shell metacharacters: ${outputPath}`,
      howToFix: 'Use a plain file path without shell metacharacters (no ;, &, |, $, `, (, ), <, >, or newlines).',
    };
  }

  const abs = path.resolve(outputPath);
  if (abs.startsWith('/dev/') || abs.startsWith('/proc/') || abs.startsWith('/sys/')) {
    return {
      code: 'INVALID_OUTPUT_PATH',
      message: `Output path "${abs}" is not allowed (device/proc/sys paths are prohibited).`,
      howToFix: 'Use a regular file path, not a device, proc, or sys path.',
    };
  }

  return null;
}

// --- Resource limits validation (task 1.3) ---

const MAX_WIDTH = 7680;
const MAX_HEIGHT = 4320;
const MAX_FPS = 60;
const MIN_FPS = 1;
const MAX_DURATION = 300000;
const MIN_DURATION = 100;
const MAX_FRAMES = 3600;

export function validateResourceLimits(params: {
  width?: number;
  height?: number;
  fps?: number;
  duration?: number;
}): ValidationError | null {
  const { width, height, fps, duration } = params;

  if (width !== undefined && (width < 1 || width > MAX_WIDTH)) {
    return {
      code: 'RESOURCE_LIMIT_EXCEEDED',
      message: `Viewport width ${width} exceeds the maximum allowed (${MAX_WIDTH}).`,
      howToFix: `Set width between 1 and ${MAX_WIDTH}.`,
    };
  }

  if (height !== undefined && (height < 1 || height > MAX_HEIGHT)) {
    return {
      code: 'RESOURCE_LIMIT_EXCEEDED',
      message: `Viewport height ${height} exceeds the maximum allowed (${MAX_HEIGHT}).`,
      howToFix: `Set height between 1 and ${MAX_HEIGHT}.`,
    };
  }

  if (fps !== undefined && (fps < MIN_FPS || fps > MAX_FPS)) {
    return {
      code: 'INVALID_FPS',
      message: `fps ${fps} is out of range. Must be between ${MIN_FPS} and ${MAX_FPS}.`,
      howToFix: `Set fps between ${MIN_FPS} and ${MAX_FPS}.`,
    };
  }

  if (duration !== undefined && (duration < MIN_DURATION || duration > MAX_DURATION)) {
    return {
      code: 'INVALID_DURATION',
      message: `duration ${duration}ms is out of range. Must be between ${MIN_DURATION} and ${MAX_DURATION}ms.`,
      howToFix: `Set duration between ${MIN_DURATION} and ${MAX_DURATION} milliseconds.`,
    };
  }

  if (fps !== undefined && duration !== undefined) {
    const frames = Math.ceil(fps * (duration / 1000));
    if (frames > MAX_FRAMES) {
      return {
        code: 'RESOURCE_LIMIT_EXCEEDED',
        message: `Estimated frame count ${frames} (fps=${fps} × duration=${duration}ms) exceeds the maximum of ${MAX_FRAMES} frames.`,
        howToFix: `Reduce fps or duration so that fps × (duration/1000) ≤ ${MAX_FRAMES}.`,
      };
    }
  }

  return null;
}
