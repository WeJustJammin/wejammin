import { describe, expect, it } from 'vitest';

import {
  activateBody,
  activationHarness,
  activationPath,
  activationRequest,
  retireBody,
  scheduleAt,
  scheduleBody,
} from './governed-activation.test-support';
import {
  expectError,
  expectNoWork,
  reviewerSession,
} from './governed-review-ops.test-support';

const violation = (path: string) => ({
  violations: [{ path, code: 'invalid', message: 'The value is invalid.' }],
});

describe('CMS-03C-09 transport admission (BE00 order: parse before authority)', () => {
  it('answers an anonymous caller with UNAUTHENTICATED, never step-up', async () => {
    const harness = activationHarness({ anonymous: true });
    const error = await expectError(
      await harness.send(activationRequest()),
      401,
      'UNAUTHENTICATED',
    );
    expect(error.details).toEqual({ recoveryAction: 'reauthenticate' });
    expectNoWork(harness);
  });

  it.each([
    ['a query string', activationPath() + '?force=true'],
    ['a non-UUID review id', activationPath('not-a-uuid')],
  ])('refuses %s with 400 before the body, quota or RPC', async (_n, url) => {
    const harness = activationHarness();
    await expectError(
      await harness.send(activationRequest(activateBody(), {}, url)),
      400,
      'INVALID_REQUEST',
    );
    expectNoWork(harness);
  });

  it.each([
    ['an unknown member', activateBody({ capability: 'cms.admin' }), '/'],
    [
      'a step-up claim',
      activateBody({ stepUpAt: '2026-10-14T00:00:00Z' }),
      '/',
    ],
    [
      'activateAt on an immediate activation',
      activateBody({ activateAt: scheduleAt() }),
      '/activateAt',
    ],
    [
      'a schedule without activateAt',
      { action: 'schedule', expectedVersion: '3' },
      '/activateAt',
    ],
    [
      'activateAt on a retirement',
      retireBody({ activateAt: scheduleAt() }),
      '/activateAt',
    ],
    ['a reason on an activation', activateBody({ reason: 'No.' }), '/reason'],
    ['an unknown action', activateBody({ action: 'purge' }), '/action'],
    [
      'a signed version',
      activateBody({ expectedVersion: '-3' }),
      '/expectedVersion',
    ],
    [
      'a non-canonical version',
      activateBody({ expectedVersion: '03' }),
      '/expectedVersion',
    ],
    [
      'a bad activateAt member',
      scheduleBody({ activateAt: scheduleAt({ timezone: 'not a zone' }) }),
      '/activateAt/timezone',
    ],
    [
      'a bad disambiguation',
      scheduleBody({ activateAt: scheduleAt({ disambiguation: 'sooner' }) }),
      '/activateAt/disambiguation',
    ],
    [
      'an unknown activateAt member',
      scheduleBody({ activateAt: scheduleAt({ offset: '+01:00' }) }),
      '/',
    ],
    [
      'a retirement reason that is not NFC',
      retireBody({ reason: 'café' }),
      '/reason',
    ],
  ])(
    'answers %s with 422 at the contract pointer, before the capability, MFA and quota',
    async (_n, body, path) => {
      const harness = activationHarness({ stepUpAt: null });
      const error = await expectError(
        await harness.send(activationRequest(body)),
        422,
        'GOVERNED_REVIEW_VALIDATION_FAILED',
      );
      expect(error.details).toEqual(violation(path));
      expect(JSON.stringify(error)).not.toContain('cms.admin');
      expectNoWork(harness);
    },
  );

  it.each([
    ['no Idempotency-Key', { 'idempotency-key': null }],
    ['a short Idempotency-Key', { 'idempotency-key': 'short' }],
    ['no If-Match', { 'if-match': null }],
    ['a weak If-Match', { 'if-match': 'W/"3"' }],
    ['an unquoted If-Match', { 'if-match': '3' }],
    ['an If-Match other than expectedVersion', { 'if-match': '"4"' }],
  ])(
    'answers %s with 400 before capability, MFA and quota',
    async (_n, headers) => {
      const harness = activationHarness({
        stepUpAt: null,
        session: reviewerSession,
      });
      await expectError(
        await harness.send(activationRequest(activateBody(), { headers })),
        400,
        'INVALID_REQUEST',
      );
      expectNoWork(harness);
    },
  );
});
