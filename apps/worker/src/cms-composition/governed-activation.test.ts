import { describe, expect, it } from 'vitest';

import {
  activatedResource,
  activateBody,
  activationHarness,
  activationRequest,
  assertActivationContract,
  retireBody,
  retiredResource,
  scheduleAt,
  scheduleBody,
  scheduleHarness,
  scheduledResource,
  wireRequest,
} from './governed-activation.test-support';
import {
  expectError,
  jsonReply,
  KEY,
  OTHER_REVIEW_ID,
  PARTY_ID,
  REQUEST_ID,
  REVIEW_ID,
  sqlRefusal,
  USER_ID,
} from './governed-review-ops.test-support';

const RPC =
  'https://supabase.example.test/rest/v1/rpc/cms_activate_governed_subject';

describe('CMS-03C-09 activate (BE03c row 171, steps 1-6)', () => {
  it('answers 200 with the strict resource, the review ETag and the review Location', async () => {
    const body = activateBody();
    assertActivationContract(body);
    const harness = activationHarness();
    const response = await harness.send(activationRequest(body));
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"4"');
    expect(response.headers.get('location')).toBe(
      `/api/v1/cms/governed-reviews/${REVIEW_ID}`,
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual(activatedResource());
  });

  it('calls cms_activate_governed_subject with exactly the members the SQL producer accepts', async () => {
    const harness = activationHarness();
    const request = activationRequest(activateBody(), {
      headers: { 'x-actor-id': 'caller-controlled' },
    });
    expect((await harness.send(request)).status).toBe(200);
    expect(harness.fetchImpl.mock.calls[0]?.[0]).toBe(RPC);
    const headers = new Headers(harness.fetchImpl.mock.calls[0]?.[1]?.headers);
    expect(headers.get('x-operation-id')).toBe('CMS-03C-09');
    expect(headers.get('x-idempotency-key')).toBe(KEY);
    expect(headers.get('content-profile')).toBe('platform_api');
    const wire = wireRequest(harness);
    expect(Object.keys(wire).sort()).toEqual([
      'action',
      'context',
      'correlationId',
      'expectedVersion',
      'idempotencyKey',
      'ifMatch',
      'reviewId',
    ]);
    expect(wire).toMatchObject({
      reviewId: REVIEW_ID,
      action: 'activate',
      expectedVersion: '3',
      ifMatch: '3',
      idempotencyKey: KEY,
      context: {
        authUserId: USER_ID,
        actingPartyId: PARTY_ID,
        requestId: REQUEST_ID,
        stepUpVerified: true,
      },
    });
    expect(JSON.stringify(wire)).not.toContain('caller-controlled');
  });

  it('replays under the same key with byte-identical RPC input', async () => {
    const harness = activationHarness();
    const first = await harness.send(activationRequest());
    const second = await harness.send(activationRequest());
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual(await first.json());
    const calls = harness.fetchImpl.mock.calls.map(([, init]) => init);
    expect(calls).toHaveLength(2);
    expect(new Headers(calls[0]?.headers).get('x-idempotency-key')).toBe(KEY);
    expect(new Headers(calls[1]?.headers).get('x-idempotency-key')).toBe(KEY);
    expect(calls[1]?.body).toBe(calls[0]?.body);
  });

  it.each([
    ['another review', { reviewId: OTHER_REVIEW_ID }],
    ['a review version that did not advance', { reviewVersion: '3' }],
    ['a skipped review version', { reviewVersion: '5' }],
    ['the scheduled action', { action: 'schedule' }],
  ])('refuses %s as a local 502 (response binding)', async (_name, patch) => {
    // The schema refinements reject an inconsistent action/state/event, so a patch that breaks one
    // is also a strict-schema failure: both end as the same invalid dependency answer.
    const harness = activationHarness({}, () =>
      jsonReply({ ...activatedResource(), ...patch }),
    );
    const error = await expectError(
      await harness.send(activationRequest()),
      502,
      'DEPENDENCY_UNAVAILABLE',
    );
    expect(error.details).toEqual({
      dependencyClass: 'cms_composition',
      retryable: true,
    });
  });

  it('refuses a body that fails the strict resource schema', async () => {
    const harness = activationHarness({}, () =>
      jsonReply({ ...activatedResource(), reviewerPersonId: USER_ID }),
    );
    await expectError(
      await harness.send(activationRequest()),
      502,
      'DEPENDENCY_UNAVAILABLE',
    );
  });

  it('refuses a scheduled resource for an immediate activation', async () => {
    const harness = activationHarness({}, () => jsonReply(scheduledResource()));
    await expectError(
      await harness.send(activationRequest()),
      502,
      'DEPENDENCY_UNAVAILABLE',
    );
  });
});

describe('CMS-03C-09 schedule (202, no event)', () => {
  it('answers 202 with the unchanged review version as ETag and the review Location', async () => {
    const body = scheduleBody();
    assertActivationContract(body);
    const harness = scheduleHarness();
    const response = await harness.send(activationRequest(body));
    expect(response.status).toBe(202);
    expect(response.headers.get('etag')).toBe('"3"');
    expect(response.headers.get('location')).toBe(
      `/api/v1/cms/governed-reviews/${REVIEW_ID}`,
    );
    expect(await response.json()).toEqual(scheduledResource());
  });

  it('sends the five activateAt members unchanged and nothing else beyond the activate members', async () => {
    const harness = scheduleHarness();
    expect((await harness.send(activationRequest(scheduleBody()))).status).toBe(
      202,
    );
    const wire = wireRequest(harness);
    expect(Object.keys(wire).sort()).toEqual([
      'action',
      'activateAt',
      'context',
      'correlationId',
      'expectedVersion',
      'idempotencyKey',
      'ifMatch',
      'reviewId',
    ]);
    expect(wire.activateAt).toEqual(scheduleAt());
    expect(wire.action).toBe('schedule');
  });

  it.each([
    ['an immediate activation', () => activatedResource()],
    [
      'another scheduled instant',
      () => scheduledResource({ scheduledForUtc: '2026-11-01T14:31:00Z' }),
    ],
    [
      'an advanced review version',
      () => scheduledResource({ reviewVersion: '4' }),
    ],
    ['another review', () => scheduledResource({ reviewId: OTHER_REVIEW_ID })],
  ])('refuses %s as a local 502', async (_name, resource) => {
    const harness = scheduleHarness({}, () => jsonReply(resource()));
    await expectError(
      await harness.send(activationRequest(scheduleBody())),
      502,
      'DEPENDENCY_UNAVAILABLE',
    );
  });

  it('accepts a stored instant that differs from the requested one by less than a millisecond', async () => {
    const harness = scheduleHarness({}, () =>
      jsonReply(
        scheduledResource({ scheduledForUtc: '2026-11-01T14:30:00.000Z' }),
      ),
    );
    expect((await harness.send(activationRequest(scheduleBody()))).status).toBe(
      202,
    );
  });
});

describe('CMS-03C-09 retire (DEC-190: active subject only, review version advances by one)', () => {
  it('forwards action retire and an optional reason, with no activateAt, and answers the 200 resource with the review ETag', async () => {
    const body = retireBody({ reason: 'Superseded by the spring layout.' });
    assertActivationContract(body);
    const harness = activationHarness({}, () => jsonReply(retiredResource()));
    const response = await harness.send(activationRequest(body));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(retiredResource());
    expect(response.headers.get('etag')).toBe('"4"');
    expect(response.headers.get('location')).toBe(
      `/api/v1/cms/governed-reviews/${REVIEW_ID}`,
    );
    expect(harness.fetchImpl).toHaveBeenCalledOnce();
    expect(wireRequest(harness)).toMatchObject({
      action: 'retire',
      reason: 'Superseded by the spring layout.',
      expectedVersion: '3',
      ifMatch: '3',
    });
    expect(wireRequest(harness)).not.toHaveProperty('activateAt');
  });

  it('forwards a retirement without a reason with no reason member', async () => {
    const harness = activationHarness({}, () => jsonReply(retiredResource()));
    expect((await harness.send(activationRequest(retireBody()))).status).toBe(
      200,
    );
    expect(wireRequest(harness)).not.toHaveProperty('reason');
  });

  it('still demands recent MFA for retire before any RPC', async () => {
    const harness = activationHarness({ stepUpAt: null });
    await expectError(
      await harness.send(activationRequest(retireBody())),
      401,
      'STEP_UP_REQUIRED',
    );
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  });

  it('answers a retirement of a non-active subject as the closed 409 subject_not_retirable', async () => {
    const harness = activationHarness({}, () =>
      sqlRefusal('subject_not_retirable'),
    );
    const error = await expectError(
      await harness.send(activationRequest(retireBody())),
      409,
      'GOVERNED_REVIEW_VERSION_CONFLICT',
    );
    expect(error.details).toEqual({ reasonCode: 'subject_not_retirable' });
  });

  it('maps a database refusal of the retire reason to a violation at /reason', async () => {
    const harness = activationHarness({}, () =>
      sqlRefusal('VALIDATION_FAILED', '["/reason"]'),
    );
    const error = await expectError(
      await harness.send(activationRequest(retireBody({ reason: 'x' }))),
      422,
      'GOVERNED_REVIEW_VALIDATION_FAILED',
    );
    expect(error.details).toEqual({
      violations: [
        { path: '/reason', code: 'invalid', message: 'The value is invalid.' },
      ],
    });
  });

  it('answers a stale review version of a retirement as the review version mismatch', async () => {
    const harness = activationHarness({}, () =>
      sqlRefusal(
        'VERSION_MISMATCH',
        '{"expectedVersion":"3","currentVersion":"4"}',
      ),
    );
    await expectError(
      await harness.send(activationRequest(retireBody())),
      409,
      'GOVERNED_REVIEW_VERSION_CONFLICT',
    );
  });

  it.each(['3', '5', '9'])(
    'refuses a retirement answer whose review version is %s: a retirement advances expected 3 to exactly 4 (root ruling on DEC-190, like an activation)',
    async (reviewVersion) => {
      const harness = activationHarness({}, () =>
        jsonReply(retiredResource({ reviewVersion })),
      );
      await expectError(
        await harness.send(activationRequest(retireBody())),
        502,
        'DEPENDENCY_UNAVAILABLE',
      );
    },
  );

  it('still refuses a retirement answer for another review', async () => {
    const harness = activationHarness({}, () =>
      jsonReply(retiredResource({ reviewId: OTHER_REVIEW_ID })),
    );
    await expectError(
      await harness.send(activationRequest(retireBody())),
      502,
      'DEPENDENCY_UNAVAILABLE',
    );
  });

  it('refuses a retirement answer that is not a retirement', async () => {
    const harness = activationHarness({}, () => jsonReply(activatedResource()));
    await expectError(
      await harness.send(activationRequest(retireBody())),
      502,
      'DEPENDENCY_UNAVAILABLE',
    );
  });
});
