/**
 * RFC 6238 TOTP (HMAC-SHA-1, 6 digits, 30 s) over the global Web Crypto API.
 * Shared by the lane's test-only MFA provider (verification) and by the
 * Playwright tests (code generation from the manual key the page shows), so a
 * real authenticator and the fixture agree on every code.
 */

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export const randomBase32Secret = (length = 32): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => BASE32[byte % 32]).join('');
};

const base32Decode = (value: string): Uint8Array => {
  let bits = 0;
  let acc = 0;
  const out: number[] = [];
  for (const character of value.replace(/=+$/u, '').toUpperCase()) {
    const index = BASE32.indexOf(character);
    if (index < 0) continue;
    acc = (acc << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 0xff);
    }
  }
  return Uint8Array.from(out);
};

export const totpCode = async (
  secret: string,
  atMs: number,
): Promise<string> => {
  const counter = Math.floor(atMs / 30_000);
  const message = new Uint8Array(8);
  new DataView(message.buffer).setUint32(4, counter >>> 0);
  new DataView(message.buffer).setUint32(0, Math.floor(counter / 2 ** 32));
  const key = await crypto.subtle.importKey(
    'raw',
    base32Decode(secret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, message));
  const offset = (mac[mac.length - 1] as number) & 0x0f;
  const truncated =
    (((mac[offset] as number) & 0x7f) << 24) |
    ((mac[offset + 1] as number) << 16) |
    ((mac[offset + 2] as number) << 8) |
    (mac[offset + 3] as number);
  return String(truncated % 1_000_000).padStart(6, '0');
};

/** Accept the current 30 s step and one step either side (clock skew). */
export const totpMatches = async (
  secret: string,
  code: string,
  atMs: number,
): Promise<boolean> => {
  for (const drift of [-1, 0, 1])
    if ((await totpCode(secret, atMs + drift * 30_000)) === code) return true;
  return false;
};
