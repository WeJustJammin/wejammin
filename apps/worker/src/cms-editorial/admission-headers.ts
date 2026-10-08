import { EntryRevisionHeadersSchema } from '@wejammin/contracts';

import { invalid, issues, type Result } from './admission-common';
import type { CmsEditorialError } from './types';

/** Parsed mutation headers: the bare decimal version, strong quotes stripped. */
export type EditorialHeaders = Readonly<{
  idempotencyKey: string;
  ifMatch: string;
}>;

/**
 * Validate the mutation header tuple against the locked contract. A missing or
 * weak If-Match is refused here, before any dependency call, so an admitted
 * command always carries a strong validator and a bounded idempotency key.
 */
export const parseEditorialHeaders = (
  request: Request,
  schema: typeof EntryRevisionHeadersSchema = EntryRevisionHeadersSchema,
): Result<EditorialHeaders> => {
  const parsed = schema.safeParse({
    contentType: request.headers.get('content-type')?.split(';')[0]?.trim(),
    idempotencyKey: request.headers.get('idempotency-key') ?? undefined,
    ifMatch: request.headers.get('if-match') ?? undefined,
  });
  if (!parsed.success)
    return invalid('The request headers are invalid.', issues(parsed.error));
  return {
    ok: true,
    value: {
      idempotencyKey: parsed.data.idempotencyKey,
      ifMatch: parsed.data.ifMatch.slice(1, -1),
    },
  };
};

/** A missing Origin is a same-origin browser request and stays admissible. */
export const checkOrigin = (
  request: Request,
  allowedOrigins: readonly string[],
): CmsEditorialError | null => {
  const origin = request.headers.get('origin');
  return origin === null || allowedOrigins.includes(origin)
    ? null
    : {
        ok: false,
        status: 403,
        code: 'FORBIDDEN',
        message: 'The request origin is not allowed.',
        details: {},
      };
};

/**
 * Cookie-gated CSRF rule: only a credential-carrying session cookie forces a
 * matching double-submit token, so a stateless bearer call stays unaffected.
 */
export const csrfErrorIfCookie = (
  request: Request,
): CmsEditorialError | null => {
  const cookie = request.headers.get('cookie');
  if (cookie === null) return null;
  const parts = cookie.split(';').map((part) => part.trim());
  if (!parts.some((part) => part.startsWith('wj_session_ref='))) return null;
  const token = parts
    .find((part) => part.startsWith('wj_csrf='))
    ?.slice('wj_csrf='.length);
  return token !== undefined &&
    token !== '' &&
    token === request.headers.get('x-csrf-token')
    ? null
    : {
        ok: false,
        status: 403,
        code: 'FORBIDDEN',
        message: 'A valid CSRF token is required.',
        details: {},
      };
};

/**
 * The body names the entry version the caller read and the strong If-Match is
 * the CAS validator. They must be the same value: a disagreement is refused
 * before any dependency call rather than letting either one silently win.
 */
export const versionDisagreement = (
  expectedVersion: string,
  ifMatch: string,
): CmsEditorialError | null =>
  expectedVersion === ifMatch
    ? null
    : invalid(
        'The expected version does not match If-Match.',
        {
          violations: [
            {
              path: '/expectedVersion',
              code: 'mismatch',
              message: 'The value is invalid.',
            },
          ],
        },
        422,
      );
