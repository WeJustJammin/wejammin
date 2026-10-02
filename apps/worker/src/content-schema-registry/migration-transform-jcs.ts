/** RFC 8785 (JCS) canonical JSON and SHA-256 hex for registry digests and output hashes. */

const MAX_DEPTH = 32;

const canonical = (value: unknown, depth: number): string => {
  if (depth > MAX_DEPTH) throw new Error('JSON nesting exceeds the bound');
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('non-finite number');
    return JSON.stringify(value);
  }
  if (Array.isArray(value))
    return `[${value.map((item) => canonical(item, depth + 1)).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    // JCS sorts member names by UTF-16 code units, the default string order.
    const members = Object.keys(record)
      .sort()
      .map(
        (key) => `${JSON.stringify(key)}:${canonical(record[key], depth + 1)}`,
      );
    return `{${members.join(',')}}`;
  }
  throw new Error('value is not canonical JSON');
};

export const canonicalJson = (value: unknown): string => canonical(value, 0);

export const sha256Hex = async (text: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
};

export const canonicalHash = async (value: unknown): Promise<string> =>
  sha256Hex(canonicalJson(value));
