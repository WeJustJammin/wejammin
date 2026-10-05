import { describe, expect, it } from 'vitest';

import {
  GRANT_ID,
  GRANT_REQUEST_ID,
  SUBJECT_ID,
  callGrant,
  grantApiError,
  grantResource,
} from './cms-capability-grant.test-support';

/**
 * BE03a CMS-03A-15..17 through the first-party mutation facade: exact request
 * bodies, transport as headers, owner-only step-up passthrough and strict
 * refusal of anything outside the closed grantable registry.
 */

const grantBody = {
  subjectPersonId: SUBJECT_ID,
  capability: 'cms.author',
  validThrough: '2026-12-30',
};

describe('[DEC-119/120] CMS-03A-15 grant', () => {
  it('forwards the strict body to the grants collection with Idempotency-Key and no If-Match', async () => {
    const { response, forwarded, forwardedBody } = await callGrant({
      target: { operationId: 'CMS-03A-15' },
      payload: grantBody,
      headers: { 'if-match': null },
      upstream: { status: 201, body: grantResource() },
    });
    expect(response.status).toBe(201);
    expect(forwardedBody).toStrictEqual(grantBody);
    expect(new URL(forwarded?.url ?? '').pathname).toBe(
      '/api/v1/cms/capability-grants',
    );
    expect(forwarded?.method).toBe('POST');
    expect(forwarded?.headers.get('idempotency-key')).toBe(
      'cms-grant-12345678',
    );
    expect(forwarded?.headers.get('if-match')).toBeNull();
    expect(forwarded?.headers.get('x-step-up-token')).toBeNull();
    expect(forwarded?.headers.get('cookie')).not.toContain('tracking');
  });

  it('accepts the native form encoding and omits a blank reason', async () => {
    const { response, forwardedBody } = await callGrant({
      target: { operationId: 'CMS-03A-15' },
      form: {
        operationId: 'CMS-03A-15',
        ...grantBody,
        reason: '',
        csrf: 'csrf',
        'idempotency-key': 'cms-grant-12345678',
      },
      headers: {
        'x-csrf-token': null,
        'idempotency-key': null,
        'if-match': null,
      },
      upstream: { status: 201, body: grantResource() },
    });
    expect(response.status).toBe(201);
    expect(forwardedBody).toStrictEqual(grantBody);
  });

  it('forwards a supplied reason of at most 256 characters', async () => {
    const reason = 'x'.repeat(256);
    const { forwardedBody } = await callGrant({
      target: { operationId: 'CMS-03A-15' },
      payload: { ...grantBody, reason },
      upstream: { status: 201, body: grantResource() },
    });
    expect(forwardedBody).toMatchObject({ reason });
  });

  it.each([
    ['a non-UUID subject', { ...grantBody, subjectPersonId: 'abc' }],
    [
      'an assignment-only capability',
      { ...grantBody, capability: 'cms.schema_review' },
    ],
    [
      'an owner-only capability',
      { ...grantBody, capability: 'cms.schema_review.assign' },
    ],
    ['a wildcard capability', { ...grantBody, capability: 'cms.*' }],
    ['a non-date term', { ...grantBody, validThrough: '2026-13-40' }],
    ['an over-long reason', { ...grantBody, reason: 'x'.repeat(257) }],
    ['an unknown key', { ...grantBody, grantorId: SUBJECT_ID }],
  ])(
    'refuses %s locally with 422 and never forwards',
    async (_name, payload) => {
      const { response, fetch } = await callGrant({
        target: { operationId: 'CMS-03A-15' },
        payload,
        upstream: { status: 201, body: grantResource() },
      });
      expect(response.status).toBe(422);
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it('relays 401 STEP_UP_REQUIRED with its recovery details', async () => {
    const details = { recoveryAction: 'step_up', allowedMethods: ['totp'] };
    const { response } = await callGrant({
      target: { operationId: 'CMS-03A-15' },
      payload: grantBody,
      upstream: {
        status: 401,
        body: grantApiError('STEP_UP_REQUIRED', details),
      },
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      code: 'STEP_UP_REQUIRED',
      details,
    });
  });

  it.each([403, 404, 409, 422, 429, 503])(
    'relays upstream %i unchanged',
    async (status) => {
      const { response } = await callGrant({
        target: { operationId: 'CMS-03A-15' },
        payload: grantBody,
        upstream: { status, body: grantApiError('X') },
      });
      expect(response.status).toBe(status);
    },
  );

  it('answers 502 for a malformed success body', async () => {
    const { response } = await callGrant({
      target: { operationId: 'CMS-03A-15' },
      payload: grantBody,
      upstream: { status: 201, body: { ok: true } },
    });
    expect(response.status).toBe(502);
  });

  it('answers 502 for a 2xx other than the contract status', async () => {
    const { response } = await callGrant({
      target: { operationId: 'CMS-03A-15' },
      payload: grantBody,
      upstream: { status: 200, body: grantApiError('X') },
    });
    expect(response.status).toBe(502);
  });
});

describe.each([
  [
    'CMS-03A-16',
    'renewals',
    { expectedVersion: '2', validThrough: '2026-12-30' },
  ],
  ['CMS-03A-17', 'revocations', { expectedVersion: '2' }],
] as const)('[DEC-119/120] %s', (operationId, segment, body) => {
  it('posts to the row path with the strong If-Match', async () => {
    const { response, forwarded, forwardedBody } = await callGrant({
      target: { operationId, grantId: GRANT_ID },
      payload: body,
      upstream: { status: 200, body: grantResource({ version: '3' }) },
    });
    expect(response.status).toBe(200);
    expect(forwardedBody).toStrictEqual(body);
    expect(new URL(forwarded?.url ?? '').pathname).toBe(
      `/api/v1/cms/capability-grants/${GRANT_ID}/${segment}`,
    );
    expect(forwarded?.headers.get('if-match')).toBe('"2"');
  });

  it('accepts the native form, echoing the bound grant id as transport only', async () => {
    const { response, forwardedBody } = await callGrant({
      target: { operationId, grantId: GRANT_ID },
      form: {
        operationId,
        grantId: GRANT_ID,
        ...body,
        reason: '',
        csrf: 'csrf',
        'idempotency-key': 'cms-grant-12345678',
        'if-match': '"2"',
      },
      headers: {
        'x-csrf-token': null,
        'idempotency-key': null,
        'if-match': null,
      },
      upstream: { status: 200, body: grantResource() },
    });
    expect(response.status).toBe(200);
    expect(forwardedBody).toStrictEqual(body);
  });

  it('refuses a missing or weak If-Match with 400', async () => {
    for (const ifMatch of [null, 'W/"2"', '2']) {
      const { response, fetch } = await callGrant({
        target: { operationId, grantId: GRANT_ID },
        payload: body,
        headers: { 'if-match': ifMatch },
        upstream: { status: 200, body: grantResource() },
      });
      expect(response.status).toBe(400);
      expect(fetch).not.toHaveBeenCalled();
    }
  });

  it('refuses a missing or malformed grant id with 400', async () => {
    for (const grantId of [undefined, 'not-a-uuid', `${GRANT_ID}/x`]) {
      const { response, fetch } = await callGrant({
        target: { operationId, ...(grantId === undefined ? {} : { grantId }) },
        payload: body,
        upstream: { status: 200, body: grantResource() },
      });
      expect(response.status).toBe(400);
      expect(fetch).not.toHaveBeenCalled();
    }
  });

  it('refuses a body grant id that contradicts the bound one', async () => {
    const { response, fetch } = await callGrant({
      target: { operationId, grantId: GRANT_ID },
      form: {
        operationId,
        grantId: '8e5b04f7-2d91-7a6c-b3d8-1f70c4a95e26',
        ...body,
        csrf: 'csrf',
        'idempotency-key': 'cms-grant-12345678',
        'if-match': '"2"',
      },
      headers: {
        'x-csrf-token': null,
        'idempotency-key': null,
        'if-match': null,
      },
      upstream: { status: 200, body: grantResource() },
    });
    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('relays 409 and a concealed 404 with the request id', async () => {
    for (const status of [409, 404]) {
      const { response } = await callGrant({
        target: { operationId, grantId: GRANT_ID },
        payload: body,
        upstream: { status, body: grantApiError('X') },
      });
      expect(response.status).toBe(status);
      expect((await response.json()) as { requestId: string }).toMatchObject({
        requestId: GRANT_REQUEST_ID,
      });
    }
  });
});

describe('[DEC-120] term bound is not decided by the facade', () => {
  it('forwards an over-ceiling date unchanged so the server can answer 422', async () => {
    const { response, forwardedBody } = await callGrant({
      target: { operationId: 'CMS-03A-15' },
      payload: { ...grantBody, validThrough: '2027-01-30' },
      upstream: {
        status: 422,
        body: grantApiError('VALIDATION_FAILED', {
          violations: [
            {
              path: '/validThrough',
              code: 'grant_term_spans_at_most_ninety_utc_days',
            },
          ],
        }),
      },
    });
    expect(forwardedBody).toMatchObject({ validThrough: '2027-01-30' });
    expect(response.status).toBe(422);
  });
});
