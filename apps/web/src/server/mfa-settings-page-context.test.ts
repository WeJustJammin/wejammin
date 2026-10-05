import { describe, expect, it } from 'vitest';

import { resolveMfaSettingsPage } from './mfa-settings-page-context';
import {
  FACTOR_ID,
  REQUEST_ID,
  bindingStub,
  errorResponse,
  factorsResource,
  jsonResponse,
  pageRequest,
} from './step-up-mfa-context.test-support';

const resolve = (binding: unknown, returnToParam: string | null = null) =>
  resolveMfaSettingsPage({
    request: pageRequest('/settings/security/mfa'),
    binding,
    returnToParam,
    requestId: REQUEST_ID,
  });

/** FE01 `/settings/security/mfa` server rendering from AUTH-API-16. */
describe('resolveMfaSettingsPage', () => {
  it('is ready with every factor state, the ETag version and no return target by default', async () => {
    const resource = factorsResource({ version: '7' });
    const result = await resolve(
      bindingStub(jsonResponse(200, resource, { etag: '"7"' })),
    );
    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;
    expect(result.page.factors.map((factor) => factor.id)).toEqual([FACTOR_ID]);
    expect(result.page.expectedVersion).toBe('7');
    expect(result.page.returnTo).toBeNull();
    expect(result.page.allowedMethods).toEqual(['totp']);
    expect(result.page.requestId).toBe(REQUEST_ID);
  });

  it('keeps pending and reconciling rows for the list', async () => {
    const resource = factorsResource({
      factors: [
        {
          id: FACTOR_ID,
          method: 'totp',
          friendlyName: 'A',
          state: 'pending',
          verifiedAt: null,
          lastUsedAt: null,
          pendingExpiresAt: '2026-10-02T12:10:00Z',
        },
      ],
    });
    const result = await resolve(bindingStub(jsonResponse(200, resource)));
    expect(result.kind === 'ready' && result.page.factors).toHaveLength(1);
  });

  it('keeps a safe returnTo and drops an unsafe one', async () => {
    const safe = await resolve(
      bindingStub(jsonResponse(200, factorsResource())),
      '/app/cms-content-modeling',
    );
    expect(safe.kind === 'ready' && safe.page.returnTo).toBe(
      '/app/cms-content-modeling',
    );
    for (const unsafe of [
      'https://evil.example',
      '//evil.example',
      '/step-up',
      '/auth/sign-in',
    ]) {
      const result = await resolve(
        bindingStub(jsonResponse(200, factorsResource())),
        unsafe,
      );
      expect(result.kind === 'ready' && result.page.returnTo).toBeNull();
    }
  });

  it('[P2-S09-AC-1070] redirects a missing session to sign-in returning to the settings page', async () => {
    const result = await resolve(
      bindingStub(
        errorResponse(401, 'UNAUTHENTICATED', {
          recoveryAction: 'reauthenticate',
        }),
      ),
    );
    expect(result).toEqual({
      kind: 'unauthenticated',
      location: `/auth/sign-in?returnTo=${encodeURIComponent('/settings/security/mfa')}`,
    });
  });

  it.each([
    [
      'an upstream outage',
      () =>
        bindingStub(
          errorResponse(503, 'DEPENDENCY_UNAVAILABLE', {
            dependencyClass: 'database',
            retryable: true,
          }),
        ),
    ],
    ['a network failure', () => bindingStub(new Error('offline'))],
    ['an invalid body', () => bindingStub(jsonResponse(200, {}))],
    ['a missing binding', () => undefined],
  ])('is degraded with the request id for %s', async (_name, make) => {
    expect(await resolve(make())).toMatchObject({
      kind: 'degraded',
      requestId: REQUEST_ID,
    });
  });

  it('falls back to the resource version when the ETag is absent or malformed', async () => {
    const result = await resolve(
      bindingStub(
        jsonResponse(200, factorsResource({ version: '9' }), {
          etag: 'garbage',
        }),
      ),
    );
    expect(result.kind === 'ready' && result.page.expectedVersion).toBe('9');
  });
});
