import { describe, expect, it } from 'vitest';

import {
  assignmentPath,
  assignmentRequest,
  ASSIGNMENT_ID,
  createBody,
  expectError,
  expectNoWork,
  ownerHarness,
  revokeBody,
  REVIEWER_PERSON_ID,
  STALE_STEP_UP,
  without,
} from './governed-review-ops.test-support';

describe('CMS-03C-08 strict input and order before any quota', () => {
  it.each([
    ['an unknown member', createBody({ capability: 'cms.reviewer' })],
    [
      'a create carrying assignmentId',
      createBody({ assignmentId: ASSIGNMENT_ID }),
    ],
    [
      'a revoke carrying reviewerPersonId',
      revokeBody({ reviewerPersonId: REVIEWER_PERSON_ID }),
    ],
    ['an unknown action', createBody({ action: 'renew' })],
    ['a missing expiresAt', without(createBody(), 'expiresAt')],
    ['a non-UUID reviewer', createBody({ reviewerPersonId: 'x' })],
    ['a date-only expiry', createBody({ expiresAt: '2026-10-15' })],
    ['a 257 code point reason', createBody({ reason: 'x'.repeat(257) })],
    ['a non-NFC reason', createBody({ reason: 'é' })],
    ['a bad expectedVersion', createBody({ expectedVersion: '0' })],
  ])('refuses %s with 422 naming no attacker member', async (_name, body) => {
    const harness = ownerHarness();
    const error = await expectError(
      await harness.send(assignmentRequest(body)),
      422,
      'GOVERNED_REVIEW_VALIDATION_FAILED',
    );
    expect(JSON.stringify(error)).not.toContain('capability');
    expectNoWork(harness);
  });

  it.each([
    ['reviewerPersonId', createBody({ reviewerPersonId: 'x' })],
    ['expiresAt', createBody({ expiresAt: '2026-10-15' })],
    ['reason', createBody({ reason: 'x'.repeat(257) })],
    ['expectedVersion', createBody({ expectedVersion: '0' })],
    ['assignmentId', revokeBody({ assignmentId: 'x' })],
  ])('names /%s for an invalid member', async (member, body) => {
    const harness = ownerHarness();
    const error = await expectError(
      await harness.send(assignmentRequest(body)),
      422,
      'GOVERNED_REVIEW_VALIDATION_FAILED',
    );
    expect(error.details).toEqual({
      violations: [
        {
          path: `/${member}`,
          code: 'invalid',
          message: 'The value is invalid.',
        },
      ],
    });
  });

  it.each([
    ['missing', null],
    ['weak', 'W/"3"'],
    ['a different operand', '"4"'],
  ])(
    'refuses %s If-Match with 400 before step-up and quota',
    async (_n, value) => {
      const harness = ownerHarness({ stepUpAt: null });
      await expectError(
        await harness.send(
          assignmentRequest(createBody(), { headers: { 'if-match': value } }),
        ),
        400,
        'INVALID_REQUEST',
      );
      expectNoWork(harness);
    },
  );

  it('refuses a non-UUID path with 400 and a query string with 400', async () => {
    for (const url of [
      assignmentPath('not-a-uuid'),
      assignmentPath() + '?x=1',
    ]) {
      const harness = ownerHarness();
      await expectError(
        await harness.send(assignmentRequest(createBody(), {}, url)),
        400,
        'INVALID_REQUEST',
      );
      expectNoWork(harness);
    }
  });

  it.each([
    ['no proof', null],
    ['a stale proof', STALE_STEP_UP],
  ])(
    'answers %s with 401 STEP_UP_REQUIRED unconditionally, before quota',
    async (_n, stepUpAt) => {
      const harness = ownerHarness({ stepUpAt });
      const error = await expectError(
        await harness.send(assignmentRequest()),
        401,
        'STEP_UP_REQUIRED',
      );
      expect(error.details).toEqual({
        recoveryAction: 'step_up',
        allowedMethods: ['totp'],
      });
      expectNoWork(harness);
    },
  );

  it('answers the preflight for POST with the command headers', async () => {
    const harness = ownerHarness();
    const response = await harness.send(
      new Request(assignmentPath(), {
        method: 'OPTIONS',
        headers: { origin: 'https://cms.example.test' },
      }),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-headers')).toContain(
      'If-Match',
    );
  });
});
