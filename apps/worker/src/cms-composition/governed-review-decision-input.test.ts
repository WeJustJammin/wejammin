import { describe, expect, it } from 'vitest';

import {
  decisionBody,
  decisionPath,
  decisionRequest,
  expectError,
  expectNoWork,
  FRESH_STEP_UP,
  OTHER_REVIEW_ID,
  reviewerHarness,
} from './governed-review-ops.test-support';

describe('CMS-03C-07 strict input (422 body, 400 transport) before any quota', () => {
  it.each([
    ['capability', { capability: 'cms.reviewer' }],
    ['stepUpAt', { stepUpAt: FRESH_STEP_UP }],
    ['an arbitrary member', { 'private provider': 1 }],
  ])('refuses %s as an unknown key with 422', async (_name, extra) => {
    const harness = reviewerHarness();
    const error = await expectError(
      await harness.send(decisionRequest({ ...decisionBody(), ...extra })),
      422,
      'GOVERNED_REVIEW_VALIDATION_FAILED',
    );
    expect(JSON.stringify(error)).not.toMatch(/private|capability|stepUpAt/);
    expectNoWork(harness);
  });

  it.each([
    [
      'decision',
      'a decision outside the closed set',
      decisionBody({ decision: 'abstain' }),
    ],
    ['reason', 'an empty reason', decisionBody({ reason: '' })],
    [
      'reason',
      'a 2001-character reason',
      decisionBody({ reason: 'x'.repeat(2001) }),
    ],
    [
      'reason',
      'a reason with a control character',
      decisionBody({ reason: 'bad\u0000control' }),
    ],
    [
      'reason',
      'a reason with markup',
      decisionBody({ reason: '<b>markup</b>' }),
    ],
    [
      'expectedVersion',
      'an expectedVersion of zero',
      decisionBody({ expectedVersion: '0' }),
    ],
    [
      'expectedVersion',
      'an expectedVersion with a leading zero',
      decisionBody({ expectedVersion: '03' }),
    ],
    [
      'reviewId',
      'a reviewId that is not a UUID',
      decisionBody({ reviewId: 'not-a-uuid' }),
    ],
  ])('names /%s for an invalid member (%s)', async (member, _name, body) => {
    const harness = reviewerHarness();
    const error = await expectError(
      await harness.send(decisionRequest(body)),
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
    expectNoWork(harness);
  });

  it('refuses a path and body reviewId that disagree with 422 at /reviewId', async () => {
    const harness = reviewerHarness();
    const error = await expectError(
      await harness.send(
        decisionRequest(decisionBody(), {}, decisionPath(OTHER_REVIEW_ID)),
      ),
      422,
      'GOVERNED_REVIEW_VALIDATION_FAILED',
    );
    expect(error.details).toMatchObject({
      violations: [{ path: '/reviewId' }],
    });
    expectNoWork(harness);
  });

  it('refuses a non-UUID path with 400', async () => {
    const harness = reviewerHarness();
    await expectError(
      await harness.send(
        decisionRequest(decisionBody(), {}, decisionPath('not-a-uuid')),
      ),
      400,
      'INVALID_REQUEST',
    );
    expectNoWork(harness);
  });

  it.each([
    ['missing', null],
    ['weak', 'W/"3"'],
    ['unquoted', '3'],
    ['star', '*'],
    ['a different operand than expectedVersion', '"4"'],
  ])(
    'refuses %s If-Match with 400 before capability and quota',
    async (_n, value) => {
      const harness = reviewerHarness();
      await expectError(
        await harness.send(
          decisionRequest(decisionBody(), { headers: { 'if-match': value } }),
        ),
        400,
        'INVALID_REQUEST',
      );
      expectNoWork(harness);
    },
  );

  it.each([null, 'short', 'caf\u00e9-key-0001'])(
    'refuses Idempotency-Key %j with 400 before capability and quota',
    async (value) => {
      const harness = reviewerHarness();
      await expectError(
        await harness.send(
          decisionRequest(decisionBody(), {
            headers: { 'idempotency-key': value },
          }),
        ),
        400,
        'INVALID_REQUEST',
      );
      expectNoWork(harness);
    },
  );

  it('refuses a query string, malformed JSON, non-JSON media and a foreign origin', async () => {
    const cases: readonly [Request, number, string][] = [
      [
        decisionRequest(decisionBody(), {}, decisionPath() + '?x=1'),
        400,
        'INVALID_REQUEST',
      ],
      [decisionRequest(null, { raw: '{"reviewId":' }), 400, 'INVALID_REQUEST'],
      [
        decisionRequest(decisionBody(), {
          headers: { 'content-type': 'text/plain' },
        }),
        415,
        'UNSUPPORTED_MEDIA_TYPE',
      ],
      [
        decisionRequest(decisionBody(), {
          headers: { origin: 'https://evil.example.test' },
        }),
        403,
        'GOVERNED_REVIEW_FORBIDDEN',
      ],
    ];
    for (const [request, status, code] of cases) {
      const harness = reviewerHarness();
      await expectError(await harness.send(request), status, code);
      expectNoWork(harness);
    }
  });
});
