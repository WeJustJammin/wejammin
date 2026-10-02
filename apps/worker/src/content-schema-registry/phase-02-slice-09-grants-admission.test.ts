import { describe, expect, it } from 'vitest';

import { error, ok } from './phase-02-slice-09-test-values';
import {
  GRANT_OPERATIONS,
  calledPorts,
  grantRequestFor,
  grantSpecFor,
  makeGrantHarness,
  ownerSession,
} from './phase-02-slice-09-grants-test-support';

const MUTATIONS = GRANT_OPERATIONS.filter((spec) => spec.method === 'POST');
const LIST = grantSpecFor('CMS-03A-18');

const expectStatus = async (
  response: Response,
  status: number,
  code: string,
): Promise<Record<string, unknown>> => {
  expect(response.status).toBe(status);
  const body = (await response.json()) as Record<string, unknown>;
  expect(body.code).toBe(code);
  return body;
};

describe('grant admission: media and body (BE03a CMS-03A-15..17, strict JSON)', () => {
  it.each(MUTATIONS)(
    '$operationId refuses a non-JSON media type with 415 before any session or port work',
    async (spec) => {
      const harness = makeGrantHarness();
      const response = await harness.app.request(
        grantRequestFor(spec, { headers: { 'content-type': 'text/plain' } }),
      );
      await expectStatus(response, 415, 'UNSUPPORTED_MEDIA_TYPE');
      expect(harness.resolveSession).not.toHaveBeenCalled();
      expect(calledPorts(harness.ports)).toBe(0);
    },
  );

  it.each(MUTATIONS)(
    '$operationId rejects an unknown or authority-smuggling body key with 422',
    async (spec) => {
      for (const extra of [{ grantorId: 'x' }, { ownerPersonId: 'x' }]) {
        const harness = makeGrantHarness();
        const response = await harness.app.request(
          grantRequestFor(spec, { body: { ...spec.body, ...extra } }),
        );
        await expectStatus(response, 422, 'VALIDATION_FAILED');
        expect(calledPorts(harness.ports)).toBe(0);
      }
    },
  );

  it.each([
    ['CMS-03A-15', { subjectPersonId: 'not-a-uuid', capability: 'cms.author' }],
    ['CMS-03A-15', { capability: 'cms.schema_review' }],
    ['CMS-03A-15', { capability: 'cms.schema_review.assign' }],
    ['CMS-03A-15', { capability: 'cms.delivery_review' }],
    ['CMS-03A-15', { capability: 'admin.*' }],
    ['CMS-03A-15', { validThrough: '2026-02-30' }],
    ['CMS-03A-15', { validThrough: '10/08/2026' }],
    ['CMS-03A-15', { reason: '' }],
    ['CMS-03A-15', { reason: 'x'.repeat(257) }],
    ['CMS-03A-16', { expectedVersion: '0' }],
    ['CMS-03A-16', { validThrough: '2026-13-01' }],
    ['CMS-03A-17', { expectedVersion: '01' }],
    ['CMS-03A-17', { reason: 'x'.repeat(257) }],
  ] as const)(
    '%s rejects an invalid body field %j with 422 and no port call',
    async (operationId, patch) => {
      const spec = grantSpecFor(operationId);
      const harness = makeGrantHarness();
      const response = await harness.app.request(
        grantRequestFor(spec, { body: { ...spec.body, ...patch } }),
      );
      await expectStatus(response, 422, 'VALIDATION_FAILED');
      expect(calledPorts(harness.ports)).toBe(0);
    },
  );

  it.each([
    'cms.navigation_editor',
    'cms.media_contributor',
    'cms.media_curator',
  ])(
    'CMS-03A-15 admits the registered grantable capability %s',
    async (capability) => {
      const spec = grantSpecFor('CMS-03A-15');
      const harness = makeGrantHarness();
      const response = await harness.app.request(
        grantRequestFor(spec, { body: { ...spec.body, capability } }),
      );
      expect(response.status).toBe(201);
      expect(harness.ports['grantCapability']).toHaveBeenCalledTimes(1);
    },
  );
});

describe('grant admission: mutation headers', () => {
  it.each(MUTATIONS)(
    '$operationId requires an Idempotency-Key of 8-128 printable characters',
    async (spec) => {
      const harness = makeGrantHarness();
      for (const value of [null, '', 'short']) {
        const response = await harness.app.request(
          grantRequestFor(spec, { headers: { 'idempotency-key': value } }),
        );
        await expectStatus(response, 400, 'INVALID_REQUEST');
      }
      expect(calledPorts(harness.ports)).toBe(0);
    },
  );

  it.each(MUTATIONS.filter((spec) => spec.ifMatch))(
    '$operationId requires an exact strong If-Match',
    async (spec) => {
      const harness = makeGrantHarness();
      for (const value of [null, 'W/"1"', '1', '"0"', '"01"']) {
        const response = await harness.app.request(
          grantRequestFor(spec, { headers: { 'if-match': value } }),
        );
        await expectStatus(response, 400, 'INVALID_REQUEST');
      }
      expect(calledPorts(harness.ports)).toBe(0);
    },
  );

  it('CMS-03A-15 refuses an If-Match (a new grant has no prior version)', async () => {
    const spec = grantSpecFor('CMS-03A-15');
    const harness = makeGrantHarness();
    const response = await harness.app.request(
      grantRequestFor(spec, { headers: { 'if-match': '"1"' } }),
    );
    await expectStatus(response, 400, 'INVALID_REQUEST');
    expect(calledPorts(harness.ports)).toBe(0);
  });

  it.each(MUTATIONS)(
    '$operationId forwards the normalized key, If-Match and path to its port',
    async (spec) => {
      const harness = makeGrantHarness();
      const response = await harness.app.request(grantRequestFor(spec));
      expect(response.status).toBe(spec.status);
      expect(harness.ports[spec.portName]).toHaveBeenCalledWith(
        expect.objectContaining({
          operationId: spec.operationId,
          idempotencyKey: 'cms-grant-key-0001',
          path: spec.pathParams,
          body: spec.body,
          ...(spec.ifMatch ? { ifMatch: '1' } : {}),
        }),
        expect.any(AbortSignal),
      );
    },
  );
});

describe('grant admission: CMS-03A-18 protected list', () => {
  it.each([
    ['an Idempotency-Key', { 'idempotency-key': 'cms-grant-key-0001' }],
    ['an If-Match', { 'if-match': '"1"' }],
    ['a body length', { 'content-length': '2' }],
  ] as const)(
    'rejects a read carrying %s with 400',
    async (_label, headers) => {
      const harness = makeGrantHarness();
      const response = await harness.app.request(
        grantRequestFor(LIST, { headers }),
      );
      await expectStatus(response, 400, 'INVALID_REQUEST');
      expect(calledPorts(harness.ports)).toBe(0);
    },
  );

  it.each([
    '?unknown=1',
    '?limit=0',
    '?limit=101',
    '?capability=cms.schema_review',
    '?state=pending',
    '?sort=createdAt',
    '?direction=sideways',
    '?subjectPersonId=not-a-uuid',
    '?state=active&state=revoked',
  ])('rejects the query %s with 400 and no port call', async (query) => {
    const harness = makeGrantHarness();
    const response = await harness.app.request(
      grantRequestFor(LIST, { path: `${LIST.path}${query}` }),
    );
    await expectStatus(response, 400, 'INVALID_REQUEST');
    expect(calledPorts(harness.ports)).toBe(0);
  });

  it('forwards the strict query with its documented defaults', async () => {
    const harness = makeGrantHarness();
    const response = await harness.app.request(grantRequestFor(LIST));
    expect(response.status).toBe(200);
    expect(harness.ports['listCapabilityGrants']).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: 'CMS-03A-18',
        query: { limit: 25, sort: 'updatedAt', direction: 'desc' },
      }),
      expect.any(AbortSignal),
    );
  });

  it('forwards every supplied filter, sort and cursor', async () => {
    const harness = makeGrantHarness();
    const subject = 'b2000000-0000-4000-8000-0000000000b2';
    const response = await harness.app.request(
      grantRequestFor(LIST, {
        path: `${LIST.path}?subjectPersonId=${subject}&capability=cms.author&state=lapsed&limit=50&cursor=abc_DEF-123&sort=validThrough&direction=asc`,
      }),
    );
    expect(response.status).toBe(200);
    expect(harness.ports['listCapabilityGrants']).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {
          subjectPersonId: subject,
          capability: 'cms.author',
          state: 'lapsed',
          limit: 50,
          cursor: 'abc_DEF-123',
          sort: 'validThrough',
          direction: 'asc',
        },
      }),
      expect.any(AbortSignal),
    );
  });
});

describe('grant admission: path, origin, CSRF and authentication', () => {
  it.each(MUTATIONS.filter((spec) => spec.pathParams.grantId !== undefined))(
    '$operationId rejects a malformed grantId with 400 and no port call',
    async (spec) => {
      const harness = makeGrantHarness();
      const response = await harness.app.request(
        grantRequestFor(spec, {
          path: spec.path.replace(spec.pathParams.grantId as string, 'nope'),
        }),
      );
      await expectStatus(response, 400, 'INVALID_REQUEST');
      expect(calledPorts(harness.ports)).toBe(0);
    },
  );

  it.each(GRANT_OPERATIONS)(
    '$operationId refuses a non-allowlisted browser origin with 403',
    async (spec) => {
      const harness = makeGrantHarness();
      const response = await harness.app.request(
        grantRequestFor(spec, {
          headers: { origin: 'https://evil.example.test' },
        }),
      );
      await expectStatus(response, 403, 'FORBIDDEN');
      expect(calledPorts(harness.ports)).toBe(0);
    },
  );

  it.each(MUTATIONS)(
    '$operationId requires a matching CSRF token when a session cookie is present',
    async (spec) => {
      const harness = makeGrantHarness();
      const response = await harness.app.request(
        grantRequestFor(spec, {
          headers: { cookie: 'wj_session_ref=abc; wj_csrf=one' },
        }),
      );
      await expectStatus(response, 403, 'FORBIDDEN');
      expect(calledPorts(harness.ports)).toBe(0);
    },
  );

  it.each(GRANT_OPERATIONS)(
    '$operationId maps a missing session to 401 UNAUTHENTICATED with reauthenticate recovery',
    async (spec) => {
      const harness = makeGrantHarness({
        session: error(401, 'UNAUTHENTICATED', 'No session.', {
          recoveryAction: 'reauthenticate',
        }),
      });
      const response = await harness.app.request(grantRequestFor(spec));
      const body = await expectStatus(response, 401, 'UNAUTHENTICATED');
      expect(body.details).toEqual({ recoveryAction: 'reauthenticate' });
      expect(calledPorts(harness.ports)).toBe(0);
    },
  );
});

describe('grant admission: no capability key (owner derived server-side)', () => {
  it.each(GRANT_OPERATIONS)(
    '$operationId reaches its port for a session with no capability (the RPC derives and checks the owner)',
    async (spec) => {
      const harness = makeGrantHarness({
        session: ok(ownerSession({ capabilities: [] })),
      });
      const response = await harness.app.request(grantRequestFor(spec));
      expect(response.status).toBe(spec.status);
      expect(harness.ports[spec.portName]).toHaveBeenCalledTimes(1);
    },
  );

  it.each(GRANT_OPERATIONS)(
    '$operationId passes a non-owner 403 from the RPC through with reasonCode only, whatever capabilities the session holds',
    async (spec) => {
      const harness = makeGrantHarness({
        session: ok(
          ownerSession({
            capabilities: ['cms.schema_designer', 'cms.schema_registry.read'],
          }),
        ),
        port: error(403, 'FORBIDDEN', 'Not the owner.', {
          reasonCode: 'OWNER_REQUIRED',
          ownerPersonId: 'x',
        }),
      });
      const response = await harness.app.request(grantRequestFor(spec));
      const body = await expectStatus(response, 403, 'FORBIDDEN');
      expect(body.details).toEqual({ reasonCode: 'OWNER_REQUIRED' });
    },
  );
});
