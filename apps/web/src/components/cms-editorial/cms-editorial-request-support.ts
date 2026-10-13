/**
 * The small, zod-free helpers every CMS editorial write shares: the session CSRF
 * token read from the cookie, a fresh idempotency key, and the field a server
 * violation pointer names. They live apart from the submit and transport
 * modules, which carry the contract schemas, so an island can use them at
 * hydration while those modules stay a lazy chunk (FE03 "Performance budgets
 * and loading strategy", AC-106).
 */

export const READ_CSRF_COOKIE_FROM_DOCUMENT = (documentRef: {
  readonly cookie: string;
}): string | null => {
  const entry = documentRef.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('wj_csrf='));
  const value = entry?.slice('wj_csrf='.length);
  return value === undefined || value === '' ? null : value;
};

export const newCmsEditorialIdempotencyKey = (): string | null => {
  try {
    const api = globalThis.crypto;
    if (typeof api?.randomUUID === 'function') return api.randomUUID();
    const bytes = api.getRandomValues(new Uint8Array(16));
    return [...bytes]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return null;
  }
};

const FIELD_PATH = /^\/(?:values|fields)\/([0-9a-f]{8}-[0-9a-f-]{27})(?:\/|$)/u;

/** One server violation: its request pointer and, when it names one, the field. */
export interface CmsEditorialViolation {
  readonly path: string;
  readonly fieldId: string | null;
}

export const cmsEditorialViolationsFrom = (
  paths: readonly string[],
): readonly CmsEditorialViolation[] =>
  paths.map((path) => ({ path, fieldId: FIELD_PATH.exec(path)?.[1] ?? null }));
