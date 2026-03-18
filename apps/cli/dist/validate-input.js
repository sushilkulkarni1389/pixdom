import fs from 'node:fs';
import path from 'node:path';
const HTML_EXTS = new Set(['.html', '.htm']);
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
/** Sniff first 16 bytes to determine if the file matches the expected category. */
function sniffFile(filePath, flag) {
    let buf;
    try {
        const fd = fs.openSync(filePath, 'r');
        buf = Buffer.alloc(16);
        fs.readSync(fd, buf, 0, 16, 0);
        fs.closeSync(fd);
    }
    catch {
        return false;
    }
    if (flag === '--file') {
        // HTML: starts with  <!  or  <h  or  <H  or  BOM + <
        const str = buf.toString('utf8', 0, 12).trimStart();
        return str.startsWith('<!') || str.toLowerCase().startsWith('<h') || str.startsWith('<');
    }
    if (flag === '--image') {
        // PNG: \x89PNG
        if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
            return true;
        // JPEG: \xFF\xD8
        if (buf[0] === 0xff && buf[1] === 0xd8)
            return true;
        // GIF: GIF8
        if (buf.toString('ascii', 0, 4) === 'GIF8')
            return true;
        // WebP: RIFF....WEBP
        if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP')
            return true;
    }
    return false;
}
/**
 * Validates existence and file type for --file and --image inputs.
 * Returns a ValidationError if the file is missing or has an unsupported type,
 * or null if validation passes.
 */
export function validateFileInput(flag, resolvedPath) {
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
