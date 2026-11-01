import { describe, expect, it } from 'vitest';

import {
  assertDecisionContract,
  decidedReview,
  decisionBody,
  decisionRequest,
  expectError,
  FRESH_STEP_UP,
  governedHarness,
  jsonReply,
  KEY,
  OTHER_REVIEW_ID,
  PARTY_ID,
  REQUEST_ID,
  REVIEW_ID,
  reviewerSession,
  USER_ID,
} from './governed-review-ops.test-support';

const invalidated = () =>
  decidedReview('approved', {
    state: 'invalidated',
    decidedAt: null,
    invalidatedReason: 'dependency_changed',
  });

const harnessFor = (reply: () => Promise<Response>) =>
  governedHarness({
    session: reviewerSession,
    stepUpAt: FRESH_STEP_UP,
    reply,
  });

describe('CMS-03C-07 decision contract (BE03c row 169, field matrix 390)', () => {
  it.each([
    ['approve', 'approved'],
    ['approve', 'open'],
    ['reject', 'rejected'],
  ] as const)(
    'answers 200 with a strict review for %s leaving it %s',
    async (decision, state) => {
      const body = decisionBody({ decision });
      assertDecisionContract(body);
      const review = decidedReview(state);
      const harness = harnessFor(() => jsonReply(review));
      const response = await harness.send(decisionRequest(body));
      expect(response.status).toBe(200);
      expect(response.headers.get('etag')).toBe('"4"');
      expect(response.headers.get('location')).toBeNull();
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.json()).toEqual(review);
    },
  );

  it('calls cms_record_governed_decision with the CAS operand, key and server context only', async () => {
    const harness = harnessFor(() => jsonReply(decidedReview()));
    const request = decisionRequest(decisionBody(), {
      headers: { 'x-actor-id': 'caller-controlled' },
    });
    expect((await harness.send(request)).status).toBe(200);
    const call = harness.fetchImpl.mock.calls[0];
    expect(call?.[0]).toBe(
      'https://supabase.example.test/rest/v1/rpc/cms_record_governed_decision',
    );
    const headers = new Headers(call?.[1]?.headers);
    expect(headers.get('x-operation-id')).toBe('CMS-03C-07');
    expect(headers.get('x-idempotency-key')).toBe(KEY);
    const wire = JSON.parse(String(call?.[1]?.body)) as {
      p_request: Record<string, unknown>;
    };
    expect(Object.keys(wire.p_request).sort()).toEqual([
      'context',
      'correlationId',
      'decision',
      'expectedVersion',
      'idempotencyKey',
      'ifMatch',
      'reason',
      'reviewId',
    ]);
    expect(wire.p_request).toMatchObject({
      reviewId: REVIEW_ID,
      decision: 'approve',
      expectedVersion: '3',
      ifMatch: '3',
      idempotencyKey: KEY,
      context: {
        authUserId: USER_ID,
        actingPartyId: PARTY_ID,
        requestId: REQUEST_ID,
        stepUpVerified: true,
        stepUpAt: FRESH_STEP_UP,
      },
    });
    expect(JSON.stringify(wire)).not.toContain('caller-controlled');
  });

  it('replays under the same key with byte-identical RPC input, so the database can return the committed outcome', async () => {
    const harness = harnessFor(() => jsonReply(decidedReview()));
    const first = await harness.send(decisionRequest());
    const second = await harness.send(decisionRequest());
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual(await first.json());
    // The Worker owns no replay store (BE00 step 8): the database replays by the key and the
    // request hash, so both calls must carry the same key and identical `p_request` bytes.
    const calls = harness.fetchImpl.mock.calls.map(([, init]) => init);
    expect(calls).toHaveLength(2);
    const headersOf = (init: RequestInit | undefined) =>
      new Headers(init?.headers);
    expect(headersOf(calls[0]).get('x-idempotency-key')).toBe(KEY);
    expect(headersOf(calls[1]).get('x-idempotency-key')).toBe(KEY);
    expect(calls[1]?.body).toBe(calls[0]?.body);
  });

  it.each([
    ['another review', decidedReview('approved', { id: OTHER_REVIEW_ID })],
    ['a stale version', decidedReview('approved', { version: '3' })],
    ['a skipped version', decidedReview('approved', { version: '5' })],
    ['an invalidated review', invalidated()],
    ['approve answered rejected', decidedReview('rejected')],
  ])('refuses %s as a local 502 (response binding)', async (_name, review) => {
    const harness = harnessFor(() => jsonReply(review));
    const error = await expectError(
      await harness.send(decisionRequest()),
      502,
      'DEPENDENCY_UNAVAILABLE',
    );
    expect(error.details).toEqual({
      dependencyClass: 'cms_composition',
      retryable: true,
    });
  });

  it('refuses reject answered with a review that stays open', async () => {
    const harness = harnessFor(() => jsonReply(decidedReview('open')));
    await expectError(
      await harness.send(decisionRequest(decisionBody({ decision: 'reject' }))),
      502,
      'DEPENDENCY_UNAVAILABLE',
    );
  });

  it('refuses a body that fails the strict resource schema', async () => {
    const harness = harnessFor(() =>
      jsonReply({ ...decidedReview(), reviewerPersonId: USER_ID }),
    );
    await expectError(
      await harness.send(decisionRequest()),
      502,
      'DEPENDENCY_UNAVAILABLE',
    );
  });
});

describe('CMS-03C-07 committed refusal envelope (replayable 409)', () => {
  it.each(['dependency_changed', 'review_not_open'])(
    'maps the committed %s envelope to 409 with its reasonCode',
    async (reasonCode) => {
      const envelope = { kind: 'refusal', reasonCode, details: {} };
      const harness = harnessFor(() => jsonReply(envelope));
      const first = await harness.send(decisionRequest());
      const error = await expectError(
        first,
        409,
        'GOVERNED_REVIEW_VERSION_CONFLICT',
      );
      expect(error.details).toEqual({ reasonCode });
      // The stored outcome replays: the same key and request bytes reach the RPC again, and the
      // same committed answer is the same 409.
      const replay = await harness.send(decisionRequest());
      expect(replay.status).toBe(409);
      expect(await replay.json()).toMatchObject({ details: { reasonCode } });
      const calls = harness.fetchImpl.mock.calls.map(([, init]) => init);
      expect(calls).toHaveLength(2);
      expect(calls[1]?.body).toBe(calls[0]?.body);
      expect(new Headers(calls[1]?.headers).get('x-idempotency-key')).toBe(KEY);
    },
  );

  it.each([
    ['an unknown token', { kind: 'refusal', reasonCode: 'private_rule' }],
    ['a 403 token', { kind: 'refusal', reasonCode: 'capability_missing' }],
    [
      'a token of another operation',
      { kind: 'refusal', reasonCode: 'assignment_limit' },
    ],
    ['a missing token', { kind: 'refusal' }],
    [
      'an extra member',
      {
        kind: 'refusal',
        reasonCode: 'review_not_open',
        note: 'private provider',
      },
    ],
    [
      'non-object details',
      { kind: 'refusal', reasonCode: 'review_not_open', details: 'x' },
    ],
  ])('answers %s as a local 502, never a caller refusal', async (_n, body) => {
    const harness = harnessFor(() => jsonReply(body));
    const error = await expectError(
      await harness.send(decisionRequest()),
      502,
      'DEPENDENCY_UNAVAILABLE',
    );
    expect(JSON.stringify(error)).not.toContain('private');
  });
});
