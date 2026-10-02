import type { MfaFactorsResource } from '@wejammin/contracts';
import { vi } from 'vitest';

export const REQUEST_ID = '0195b6f0-0000-7000-8000-000000000001';
export const FACTOR_ID = '0195b6f0-0000-7000-8000-00000000000a';
export const OTHER_FACTOR_ID = '0195b6f0-0000-7000-8000-00000000000b';

export const factorsResource = (
  overrides: Partial<MfaFactorsResource> = {},
): MfaFactorsResource => ({
  factors: [
    {
      id: FACTOR_ID,
      method: 'totp',
      friendlyName: 'Phone',
      state: 'verified',
      verifiedAt: '2026-09-01T10:00:00Z',
      lastUsedAt: null,
      pendingExpiresAt: null,
    },
  ],
  allowedMethods: ['totp'],
  stepUp: { fresh: false, freshUntil: null },
  version: '4',
  ...overrides,
});

export type BindingStub = Readonly<{
  fetch: ReturnType<typeof vi.fn<(request: Request) => Promise<Response>>>;
  requests: () => Request[];
}>;

/** A private PLATFORM_API binding that answers with the queued responses. */
export const bindingStub = (
  ...queue: readonly (Response | Error)[]
): BindingStub => {
  const seen: Request[] = [];
  const remaining = [...queue];
  const fetchStub = vi.fn((request: Request) => {
    seen.push(request);
    const next = remaining.shift() ?? new Error('unexpected upstream call');
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  });
  return { fetch: fetchStub, requests: () => seen };
};

export const jsonResponse = (
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

export const errorResponse = (
  status: number,
  code: string,
  details: Record<string, unknown> = {},
): Response =>
  jsonResponse(status, {
    code,
    message: 'Safe message.',
    details,
    requestId: REQUEST_ID,
  });

export const pageRequest = (
  path: string,
  cookie = 'wj_access=a; wj_session_ref=s',
): Request =>
  new Request(`https://app.example.test${path}`, { headers: { cookie } });
