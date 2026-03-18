import dns from 'node:dns/promises';
// Blocked protocol prefixes — only http: and https: are allowed
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
function parseCidr4(cidr) {
    const [ip, bits] = cidr.split('/');
    const mask = bits ? ~((1 << (32 - Number(bits))) - 1) >>> 0 : 0xffffffff;
    const parts = ip.split('.').map(Number);
    const base = (((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0);
    return { base: base >>> 0, mask: mask >>> 0 };
}
function ipv4ToInt(ip) {
    const parts = ip.split('.').map(Number);
    return (((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0);
}
const BLOCKED_CIDRS = [
    '127.0.0.0/8', // loopback
    '10.0.0.0/8', // RFC1918
    '172.16.0.0/12', // RFC1918
    '192.168.0.0/16', // RFC1918
    '169.254.0.0/16', // link-local / cloud metadata
].map(parseCidr4);
function isBlockedIpv4(ip) {
    const n = ipv4ToInt(ip);
    return BLOCKED_CIDRS.some((cidr) => (n & cidr.mask) === cidr.base);
}
function isBlockedIpv6(ip) {
    const lower = ip.toLowerCase();
    // ::1 loopback
    if (lower === '::1' || lower === '0:0:0:0:0:0:0:1')
        return true;
    // fc00::/7 — unique local addresses (fc and fd prefixes)
    if (lower.startsWith('fc') || lower.startsWith('fd'))
        return true;
    return false;
}
async function isBlockedHost(hostname) {
    try {
        const result = await dns.lookup(hostname, { all: true });
        for (const addr of result) {
            if (addr.family === 4 && isBlockedIpv4(addr.address))
                return true;
            if (addr.family === 6 && isBlockedIpv6(addr.address))
                return true;
        }
    }
    catch {
        // DNS resolution failure: allow through (not a private host)
    }
    return false;
}
/**
 * Installs a Playwright request interceptor that aborts requests to:
 * - Non-http/https protocols
 * - Loopback, RFC1918, link-local, and IPv6-private hosts (unless allowLocal is true)
 *
 * Must be called after page creation and before content is loaded.
 */
export async function installRequestGuard(page, options) {
    const allowLocal = options.allowLocal === true;
    await page.route('**', async (route) => {
        const url = new URL(route.request().url());
        // Protocol check — always enforced regardless of allowLocal.
        // file: is allowed when the input itself is a local file (already validated via realpathSync).
        const isFileInput = options.input.type === 'file';
        if (!ALLOWED_PROTOCOLS.has(url.protocol) && !(isFileInput && url.protocol === 'file:')) {
            await route.abort('blockedbyclient');
            return;
        }
        // Host check — skip if allowLocal is enabled or if this is a file: URL (no hostname)
        if (!allowLocal && url.protocol !== 'file:') {
            const blocked = await isBlockedHost(url.hostname);
            if (blocked) {
                await route.abort('blockedbyclient');
                return;
            }
        }
        await route.continue();
    });
}
