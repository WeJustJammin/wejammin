import { describe, expect, it } from 'vitest';

import { USER_ID, error, ok } from './phase-02-slice-09-test-values';
import {
  OPERATIONS,
  makeDec108Harness,
  requestFor,
  sessionFor,
  sessionResult,
  specFor,
  type OperationSpec,
} from './phase-02-slice-09-dec108-test-support';

const MUTATIONS = OPERATIONS.filter((spec) => spec.method === 'POST');
const READ = specFor('CMS-03A-13');

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

const calledPorts = (ports: Record<string, { mock: { calls: unknown[] } }>) =>
  Object.values(ports).reduce((sum, port) => sum + port.mock.calls.length, 0);

describe('DEC-108 route admission: media and body (BE03a Route Registry, strict JSON)', () => {
  it.each(MUTATIONS)(
    '$operationId refuses a non-JSON media type with 415 before any session or port work',
    async (spec) => {
      const harness = makeDec108Harness({ session: sessionResult(spec) });
      const response = await harness.app.request(
        requestFor(spec, { headers: { 'content-type': 'text/plain' } }),
      );
      await expectStatus(response, 415, 'UNSUPPORTED_MEDIA_TYPE');
      expect(harness.resolveSession).not.toHaveBeenCalled();
      expect(calledPorts(harness.ports)).toBe(0);
    },
  );

  it.each(MUTATIONS)(
    '$operationId rejects an unknown body key with 422 VALIDATION_FAILED (strict request)',
    async (spec) => {
      const harness = makeDec108Harness({ session: sessionResult(spec) });
      const response = await harness.app.request(
        requestFor(spec, { body: { ...spec.body, callerCounts: 1 } }),
      );
      await expectStatus(response, 422, 'VALIDATION_FAILED');
      expect(calledPorts(harness.ports)).toBe(0);
    },
  );

  it.each([
    ['CMS-03A-09', { expectedVersion: '0' }],
    ['CMS-03A-09', { expectedVersion: '01' }],
    [
      'CMS-03A-10',
      { expectedVersion: '1', transformKey: 'a.b', transformVersion: null },
    ],
    [
      'CMS-03A-10',
      { expectedVersion: '1', transformKey: null, transformVersion: '1' },
    ],
    ['CMS-03A-11', { expectedVersion: '1', dryRunId: 'not-a-uuid' }],
    ['CMS-03A-12', { expectedVersion: '1', decision: 'maybe' }],
    ['CMS-03A-14', { action: 'create', expectedVersion: '1' }],
    [
      'CMS-03A-14',
      { action: 'revoke', expectedVersion: '1', reviewerPersonId: USER_ID },
    ],
    ['CMS-03A-14', { action: 'delegate', expectedVersion: '1' }],
  ] as const)(
    '%s rejects an invalid request body with 422 and no port call',
    async (operationId, body) => {
      const spec = specFor(operationId);
      const harness = makeDec108Harness({ session: sessionResult(spec) });
      const response = await harness.app.request(requestFor(spec, { body }));
      const payload = await expectStatus(response, 422, 'VALIDATION_FAILED');
      expect(JSON.stringify(payload.details)).not.toContain(USER_ID);
      expect(calledPorts(harness.ports)).toBe(0);
    },
  );
});

describe('DEC-108 route admission: mutation headers', () => {
  it.each(MUTATIONS)(
    '$operationId requires an Idempotency-Key of 8-128 printable characters',
    async (spec) => {
      const harness = makeDec108Harness({ session: sessionResult(spec) });
      for (const value of [null, '', 'short']) {
        const response = await harness.app.request(
          requestFor(spec, { headers: { 'idempotency-key': value } }),
        );
        await expectStatus(response, 400, 'INVALID_REQUEST');
      }
      expect(calledPorts(harness.ports)).toBe(0);
    },
  );

  it.each(MUTATIONS)(
    '$operationId requires an exact strong If-Match (weak and unquoted tags are 400)',
    async (spec) => {
      const harness = makeDec108Harness({ session: sessionResult(spec) });
      for (const value of [null, 'W/"1"', '1', '"0"', '"01"']) {
        const response = await harness.app.request(
          requestFor(spec, { headers: { 'if-match': value } }),
        );
        await expectStatus(response, 400, 'INVALID_REQUEST');
      }
      expect(calledPorts(harness.ports)).toBe(0);
    },
  );

  it.each(MUTATIONS)(
    '$operationId forwards the normalized key and If-Match to its port',
    async (spec) => {
      const harness = makeDec108Harness({ session: sessionResult(spec) });
      const response = await harness.app.request(requestFor(spec));
      expect(response.status).toBe(spec.status);
      expect(harness.ports[spec.portName]).toHaveBeenCalledWith(
        expect.objectContaining({
          operationId: spec.operationId,
          idempotencyKey: 'cms-dec108-key-001',
          ifMatch: '1',
          path: spec.pathParams,
        }),
        expect.any(AbortSignal),
      );
    },
  );
});

describe('DEC-108 route admission: CMS-03A-13 protected read', () => {
  it.each([
    ['an Idempotency-Key', { 'idempotency-key': 'cms-dec108-key-001' }],
    ['an If-Match', { 'if-match': '"1"' }],
    ['a body length', { 'content-length': '2' }],
  ] as const)(
    'rejects a read carrying %s with 400',
    async (_label, headers) => {
      const harness = makeDec108Harness({ session: sessionResult(READ) });
      const response = await harness.app.request(requestFor(READ, { headers }));
      await expectStatus(response, 400, 'INVALID_REQUEST');
      expect(harness.ports['getSchemaReview']).not.toHaveBeenCalled();
    },
  );

  it('accepts only the path UUID, so any query parameter is 400', async () => {
    const harness = makeDec108Harness({ session: sessionResult(READ) });
    const response = await harness.app.request(
      requestFor(READ, { path: `${READ.path}?expand=decisions` }),
    );
    await expectStatus(response, 400, 'INVALID_REQUEST');
    expect(harness.ports['getSchemaReview']).not.toHaveBeenCalled();
  });
});

describe('DEC-108 route admission: path identifiers', () => {
  it.each(OPERATIONS)(
    '$operationId rejects a malformed UUID path parameter with 400 and no port call',
    async (spec) => {
      const harness = makeDec108Harness({ session: sessionResult(spec) });
      const target = spec.pathParams.versionId ?? spec.pathParams.reviewId;
      const malformed = spec.path.replace(target as string, 'not-a-uuid');
      expect(malformed).not.toBe(spec.path);
      const response = await harness.app.request(
        requestFor(spec, { path: malformed }),
      );
      await expectStatus(response, 400, 'INVALID_REQUEST');
      expect(calledPorts(harness.ports)).toBe(0);
    },
  );
});

describe('DEC-108 route admission: origin, CSRF and authentication', () => {
  it.each(OPERATIONS)(
    '$operationId refuses a non-allowlisted browser origin with 403',
    async (spec) => {
      const harness = makeDec108Harness({ session: sessionResult(spec) });
      const response = await harness.app.request(
        requestFor(spec, { headers: { origin: 'https://evil.example.test' } }),
      );
      await expectStatus(response, 403, 'FORBIDDEN');
      expect(calledPorts(harness.ports)).toBe(0);
    },
  );

  it.each(MUTATIONS)(
    '$operationId requires a matching CSRF token when a session cookie is present',
    async (spec) => {
      const harness = makeDec108Harness({ session: sessionResult(spec) });
      const response = await harness.app.request(
        requestFor(spec, {
          headers: { cookie: 'wj_session_ref=abc; wj_csrf=one' },
        }),
      );
      await expectStatus(response, 403, 'FORBIDDEN');
      expect(calledPorts(harness.ports)).toBe(0);
    },
  );

  it.each(OPERATIONS)(
    '$operationId maps a missing session to 401 UNAUTHENTICATED with reauthenticate recovery',
    async (spec) => {
      const harness = makeDec108Harness({
        session: error(401, 'UNAUTHENTICATED', 'No session.', {
          recoveryAction: 'reauthenticate',
        }),
      });
      const response = await harness.app.request(requestFor(spec));
      const body = await expectStatus(response, 401, 'UNAUTHENTICATED');
      expect(body.details).toEqual({ recoveryAction: 'reauthenticate' });
      expect(calledPorts(harness.ports)).toBe(0);
    },
  );
});

describe('DEC-108 route admission: capability matrix (BE03a authorization)', () => {
  const lacking = (spec: OperationSpec): readonly string[] =>
    spec.operationId === 'CMS-03A-13'
      ? ['cms.schema_registry.read']
      : ['cms.schema_registry.read', 'cms.schema_designer_extra'];

  it.each(OPERATIONS)(
    '$operationId refuses a session without its capability with 403 CAPABILITY_REQUIRED',
    async (spec) => {
      const harness = makeDec108Harness({
        session: ok(sessionFor(spec, { capabilities: lacking(spec) })),
      });
      const response = await harness.app.request(requestFor(spec));
      const body = await expectStatus(response, 403, 'FORBIDDEN');
      expect(body.details).toEqual({ reasonCode: 'CAPABILITY_REQUIRED' });
      expect(calledPorts(harness.ports)).toBe(0);
    },
  );

  it.each([
    ['CMS-03A-09', 'cms.schema_review'],
    ['CMS-03A-10', 'cms.schema_review.assign'],
    ['CMS-03A-11', 'cms.schema_review'],
    ['CMS-03A-12', 'cms.schema_designer'],
    ['CMS-03A-12', 'cms.schema_review.assign'],
    ['CMS-03A-14', 'cms.schema_designer'],
    ['CMS-03A-14', 'cms.schema_review'],
  ] as const)(
    '%s refuses a holder of only %s (capabilities do not substitute)',
    async (operationId, capability) => {
      const spec = specFor(operationId);
      const harness = makeDec108Harness({
        session: ok(sessionFor(spec, { capabilities: [capability] })),
      });
      const response = await harness.app.request(requestFor(spec));
      await expectStatus(response, 403, 'FORBIDDEN');
      expect(calledPorts(harness.ports)).toBe(0);
    },
  );

  it.each(['cms.schema_designer', 'cms.schema_review'] as const)(
    'CMS-03A-13 admits a holder of %s (submitter/designer or assigned reviewer)',
    async (capability) => {
      const harness = makeDec108Harness({
        session: ok(sessionFor(READ, { capabilities: [capability] })),
      });
      const response = await harness.app.request(requestFor(READ));
      expect(response.status).toBe(200);
      expect(harness.ports['getSchemaReview']).toHaveBeenCalledTimes(1);
    },
  );
});
