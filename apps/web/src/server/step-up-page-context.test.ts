import { describe, expect, it } from 'vitest';

import { stepUpSignInHref } from '../components/identity-authority/step-up-mfa/step-up-return';
import { resolveStepUpPage } from './step-up-page-context';
import {
  FACTOR_ID,
  OTHER_FACTOR_ID,
  REQUEST_ID,
  bindingStub,
  errorResponse,
  factorsResource,
  jsonResponse,
  pageRequest,
} from './step-up-mfa-context.test-support';

const resolve = (
  binding: unknown,
  returnToParam: string | null = '/app/cms-content-modeling?tab=versions',
) =>
  resolveStepUpPage({
    request: pageRequest('/step-up'),
    binding,
    returnToParam,
    requestId: REQUEST_ID,
  });

/** FE01 `/step-up` server rendering from AUTH-API-16. */
describe('resolveStepUpPage', () => {
  it('[P2-S09-AC-1065] reads AUTH-API-16 through the private binding with the session cookie only', async () => {
    const binding = bindingStub(jsonResponse(200, factorsResource()));
    await resolve(binding);
    const [upstream] = binding.requests();
    expect(upstream?.method).toBe('GET');
    expect(new URL(upstream?.url ?? '').pathname).toBe(
      '/api/v1/account/mfa/factors',
    );
    expect(upstream?.headers.get('cookie')).toContain('wj_access=a');
    expect(upstream?.headers.get('if-match')).toBeNull();
    expect(upstream?.headers.get('idempotency-key')).toBeNull();
  });

  it('[P2-S09-AC-1065] [P2-S09-AC-1066] is ready with verified factors only and the validated returnTo', async () => {
    const resource = factorsResource({
      factors: [
        ...factorsResource().factors,
        {
          id: OTHER_FACTOR_ID,
          method: 'totp',
          friendlyName: 'Old',
          state: 'pending',
          verifiedAt: null,
          lastUsedAt: null,
          pendingExpiresAt: '2026-10-02T12:10:00Z',
        },
      ],
    });
    const result = await resolve(bindingStub(jsonResponse(200, resource)));
    expect(result).toMatchObject({ kind: 'ready' });
    if (result.kind !== 'ready') return;
    expect(result.page.returnTo).toBe('/app/cms-content-modeling?tab=versions');
    expect(result.page.factors.map((factor) => factor.id)).toEqual([FACTOR_ID]);
    expect(result.page.initialPhase).toBe('creating-challenge');
    expect(result.page.requestId).toBe(REQUEST_ID);
    expect(result.page.stepUp).toEqual({ fresh: false, freshUntil: null });
  });

  it.each([
    ['null', null],
    ['an external URL', 'https://evil.example/app'],
    ['the step-up page itself', '/step-up?returnTo=%2Fapp'],
    ['an auth path', '/auth/sign-in'],
  ])('[P2-S09-AC-1066] falls back to /app for %s', async (_name, param) => {
    const result = await resolve(
      bindingStub(jsonResponse(200, factorsResource())),
      param,
    );
    expect(result.kind === 'ready' && result.page.returnTo).toBe('/app');
  });

  it('chooses the no-factor phase when nothing is verified', async () => {
    const result = await resolve(
      bindingStub(jsonResponse(200, factorsResource({ factors: [] }))),
    );
    expect(result.kind === 'ready' && result.page.initialPhase).toBe(
      'no-factor',
    );
  });

  it('[P2-S09-AC-1064] carries a fresh proof for display but never auto-redirects', async () => {
    const resource = factorsResource({
      stepUp: { fresh: true, freshUntil: '2026-10-02T12:10:00Z' },
    });
    const result = await resolve(bindingStub(jsonResponse(200, resource)));
    expect(result.kind === 'ready' && result.page.stepUp).toEqual({
      fresh: true,
      freshUntil: '2026-10-02T12:10:00Z',
    });
  });

  it('[P2-S09-AC-1067] redirects a missing session to sign-in carrying /step-up', async () => {
    const result = await resolve(
      bindingStub(
        errorResponse(401, 'UNAUTHENTICATED', {
          recoveryAction: 'reauthenticate',
        }),
      ),
    );
    expect(result).toEqual({
      kind: 'unauthenticated',
      location: stepUpSignInHref('/app/cms-content-modeling?tab=versions'),
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
    [
      'an invalid body',
      () => bindingStub(jsonResponse(200, { factors: 'nope' })),
    ],
    ['a missing binding', () => undefined],
  ])('is degraded with the request id for %s', async (_name, make) => {
    const result = await resolve(make());
    expect(result).toMatchObject({
      kind: 'degraded',
      reason: 'unavailable',
      requestId: REQUEST_ID,
    });
  });

  it('is degraded when no allowlisted method remains', async () => {
    const resource = factorsResource({ allowedMethods: [] });
    const result = await resolve(bindingStub(jsonResponse(200, resource)));
    expect(result).toMatchObject({
      kind: 'degraded',
      reason: 'no-method',
      requestId: REQUEST_ID,
    });
  });
});
