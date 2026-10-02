import { MfaFactorsResourceSchema, type MfaFactorsResource } from '@wejammin/contracts';

import { forwardAuthRequest } from './auth-platform-api';

export type MfaFactorsRead =
  | Readonly<{
      kind: 'ok';
      resource: MfaFactorsResource;
      etagVersion: string | null;
    }>
  | Readonly<{ kind: 'unauthenticated' }>
  | Readonly<{ kind: 'unavailable' }>;

const FACTORS_PATH = '/api/v1/account/mfa/factors';

const versionFromEtag = (etag: string | null): string | null => {
  const match =
    etag === null ? null : /^(?:W\/)?"([1-9][0-9]{0,18})"$/u.exec(etag);
  return match?.[1] ?? null;
};

/**
 * Server-side AUTH-API-16 read for the two MFA pages. Only the session
 * cookie and request id cross the private binding; the result is parsed by
 * the contract before any page sees it.
 */
export const readMfaFactorsForPage = async (
  request: Request,
  binding: unknown,
  requestId: string,
): Promise<MfaFactorsRead> => {
  const headers = new Headers({ accept: 'application/json' });
  const cookie = request.headers.get('cookie');
  if (cookie !== null) headers.set('cookie', cookie);
  headers.set('x-request-id', requestId);
  try {
    const response = await forwardAuthRequest(
      new Request(new URL(FACTORS_PATH, request.url), { method: 'GET', headers }),
      binding,
      FACTORS_PATH,
      'GET',
    );
    if (response.status === 401) return { kind: 'unauthenticated' };
    if (!response.ok) return { kind: 'unavailable' };
    const parsed = MfaFactorsResourceSchema.safeParse(
      await response.json().catch(() => null),
    );
    return parsed.success
      ? {
          kind: 'ok',
          resource: parsed.data,
          etagVersion: versionFromEtag(response.headers.get('etag')),
        }
      : { kind: 'unavailable' };
  } catch {
    return { kind: 'unavailable' };
  }
};
