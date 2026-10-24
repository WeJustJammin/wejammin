import { describe, expect, it } from 'vitest';

import {
  assertAssignmentContract,
  ASSIGNMENT_ID,
  assignmentRequest,
  assignmentResource,
  createBody,
  expectError,
  jsonReply,
  KEY,
  OTHER_REVIEW_ID,
  ownerHarness,
  ownerSession,
  revokeBody,
  REVIEW_ID,
  REVIEWER_PERSON_ID,
  without,
} from './governed-review-ops.test-support';

const wireOf = (
  harness: ReturnType<typeof ownerHarness>,
): Record<string, unknown> =>
  (
    JSON.parse(String(harness.fetchImpl.mock.calls[0]?.[1]?.body)) as {
      p_request: Record<string, unknown>;
    }
  ).p_request;

describe('CMS-03C-08 contract (BE03c row 170, field matrix 391)', () => {
  it('answers 201 with Location and the assignment version ETag for a create', async () => {
    const body = createBody();
    assertAssignmentContract(body);
    const harness = ownerHarness();
    const response = await harness.send(assignmentRequest(body));
    expect(response.status).toBe(201);
    expect(response.headers.get('etag')).toBe('"1"');
    expect(response.headers.get('location')).toBe(
      `/api/v1/cms/governed-reviews/${REVIEW_ID}/assignments/${ASSIGNMENT_ID}`,
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual(assignmentResource());
    expect(Object.keys(wireOf(harness)).sort()).toEqual([
      'action',
      'context',
      'correlationId',
      'expectedVersion',
      'expiresAt',
      'idempotencyKey',
      'ifMatch',
      'reason',
      'reviewId',
      'reviewerPersonId',
    ]);
    expect(wireOf(harness)).toMatchObject({
      reviewId: REVIEW_ID,
      action: 'create',
      expectedVersion: '3',
      ifMatch: '3',
      idempotencyKey: KEY,
      reviewerPersonId: REVIEWER_PERSON_ID,
      expiresAt: '2026-10-15T00:00:00Z',
    });
  });

  it('answers 200 with no Location for a revoke', async () => {
    const body = revokeBody({ reason: 'Reassigned.' });
    assertAssignmentContract(body);
    const harness = ownerHarness({}, () =>
      jsonReply(
        assignmentResource({
          state: 'revoked',
          version: '2',
          reason: 'Reassigned.',
        }),
      ),
    );
    const response = await harness.send(assignmentRequest(body));
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"2"');
    expect(response.headers.get('location')).toBeNull();
    expect(wireOf(harness)).toMatchObject({
      action: 'revoke',
      assignmentId: ASSIGNMENT_ID,
      reason: 'Reassigned.',
    });
    expect('reviewerPersonId' in wireOf(harness)).toBe(false);
  });

  it('omits an absent reason from the wire (SQL exact keys)', async () => {
    const harness = ownerHarness();
    await harness.send(assignmentRequest(without(createBody(), 'reason')));
    expect('reason' in wireOf(harness)).toBe(false);
  });

  it('replays under the same key with byte-identical RPC input, so the database can return the committed outcome', async () => {
    const harness = ownerHarness();
    const first = await harness.send(assignmentRequest());
    const second = await harness.send(assignmentRequest());
    expect(second.status).toBe(201);
    expect(await second.json()).toEqual(await first.json());
    // The Worker owns no replay store (BE00 step 8): the key and `p_request` bytes must repeat.
    const calls = harness.fetchImpl.mock.calls.map(([, init]) => init);
    expect(calls).toHaveLength(2);
    const key = (init: RequestInit | undefined) =>
      new Headers(init?.headers).get('x-idempotency-key');
    expect(key(calls[0])).not.toBeNull();
    expect(key(calls[1])).toBe(key(calls[0]));
    expect(calls[1]?.body).toBe(calls[0]?.body);
  });

  it.each([
    [
      'another review',
      assignmentResource({ reviewId: OTHER_REVIEW_ID }),
      createBody(),
    ],
    [
      'a revoked assignment for a create',
      assignmentResource({ state: 'revoked' }),
      createBody(),
    ],
    [
      'another expiry',
      assignmentResource({ expiresAt: '2026-10-16T00:00:00Z' }),
      createBody(),
    ],
    ['another reason', assignmentResource({ reason: 'Other.' }), createBody()],
    ['an active assignment for a revoke', assignmentResource(), revokeBody()],
    [
      'another assignment for a revoke',
      assignmentResource({ state: 'revoked', id: OTHER_REVIEW_ID }),
      revokeBody(),
    ],
  ])(
    'refuses %s as a local 502 (response binding)',
    async (_name, resource, body) => {
      const harness = ownerHarness({}, () => jsonReply(resource));
      await expectError(
        await harness.send(assignmentRequest(body)),
        502,
        'DEPENDENCY_UNAVAILABLE',
      );
    },
  );

  it('accepts an expiry rounded within a millisecond (timestamptz microseconds)', async () => {
    const harness = ownerHarness({}, () =>
      jsonReply(
        assignmentResource({ expiresAt: '2026-10-15T00:00:00.000999Z' }),
      ),
    );
    const response = await harness.send(
      assignmentRequest(
        createBody({ expiresAt: '2026-10-15T00:00:00.000999999Z' }),
      ),
    );
    expect(response.status).toBe(201);
  });

  it('applies no Worker capability gate: the receipt-derived owner holds none in the session', async () => {
    const harness = ownerHarness({
      session: { ...ownerSession, capabilities: [] },
    });
    expect((await harness.send(assignmentRequest())).status).toBe(201);
  });
});
