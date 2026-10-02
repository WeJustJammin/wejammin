import { describe, expect, it } from 'vitest';

import {
  REQUEST_ID,
  TYPE_ID,
  error,
  ok,
} from './phase-02-slice-09-test-values';
import {
  assignRevokeBody,
  assignmentRevoked,
  dryRunResource,
  reviewResource,
  ACTING_CONTEXT_ID,
  REVIEWER_PERSON_ID,
} from './phase-02-slice-09-dec108-test-values';
import {
  OPERATIONS,
  makeDec108Harness,
  requestFor,
  sessionResult,
  specFor,
} from './phase-02-slice-09-dec108-test-support';

const MUTATIONS = OPERATIONS.filter((spec) => spec.method === 'POST');

describe('DEC-108 handler success mapping (BE03a Route Registry and invariants)', () => {
  it.each(OPERATIONS)(
    '$operationId returns its registry success status and the contract resource through $portName',
    async (spec) => {
      const harness = makeDec108Harness({ session: sessionResult(spec) });
      const response = await harness.app.request(requestFor(spec));
      expect(response.status).toBe(spec.status);
      expect(await response.json()).toEqual(spec.output);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('x-request-id')).toBe(REQUEST_ID);
      expect(harness.ports[spec.portName]).toHaveBeenCalledTimes(1);
    },
  );

  it.each(MUTATIONS)(
    '$operationId sets ETag from the resource version and Location for the new resource',
    async (spec) => {
      const harness = makeDec108Harness({ session: sessionResult(spec) });
      const response = await harness.app.request(requestFor(spec));
      const output = spec.output as { version: string };
      expect(response.headers.get('etag')).toBe(`"${output.version}"`);
      expect(response.headers.get('location')).toBe(
        spec.operationId === 'CMS-03A-09'
          ? `/api/v1/cms/content-types/${TYPE_ID}/versions/${(spec.output as { id: string }).id}`
          : spec.path,
      );
    },
  );

  it('CMS-03A-13 is a safe read: no Location header and no mutation side effect headers', async () => {
    const spec = specFor('CMS-03A-13');
    const harness = makeDec108Harness({ session: sessionResult(spec) });
    const response = await harness.app.request(requestFor(spec));
    expect(response.status).toBe(200);
    expect(response.headers.has('location')).toBe(false);
  });

  it('CMS-03A-10 answers 202 for a queued attempt and never 200 or 201', async () => {
    const spec = specFor('CMS-03A-10');
    const harness = makeDec108Harness({
      session: sessionResult(spec),
      port: ok({ ...dryRunResource, state: 'running' }),
    });
    const response = await harness.app.request(requestFor(spec));
    expect(response.status).toBe(202);
  });

  it('CMS-03A-14 answers 201 for a created assignment and 200 for a revoked one', async () => {
    const spec = specFor('CMS-03A-14');
    const created = makeDec108Harness({ session: sessionResult(spec) });
    expect((await created.app.request(requestFor(spec))).status).toBe(201);
    const revoked = makeDec108Harness({
      session: sessionResult(spec),
      port: ok(assignmentRevoked),
    });
    const response = await revoked.app.request(
      requestFor(spec, { body: assignRevokeBody }),
    );
    expect(response.status).toBe(200);
    expect(revoked.ports['assignSchemaReview']).toHaveBeenCalledWith(
      expect.objectContaining({ body: assignRevokeBody }),
      expect.any(AbortSignal),
    );
  });

  it('CMS-03A-13 returns the safe review projection without reviewer person ids or evidence rows', async () => {
    const spec = specFor('CMS-03A-13');
    const harness = makeDec108Harness({ session: sessionResult(spec) });
    const text = await (await harness.app.request(requestFor(spec))).text();
    expect(text).not.toContain(REVIEWER_PERSON_ID);
    expect(text).not.toContain(ACTING_CONTEXT_ID);
    expect(JSON.parse(text)).toEqual(reviewResource);
  });
});

describe('DEC-108 handler error mapping (BE03a contract and error matrix)', () => {
  const failures = [
    [
      403,
      'FORBIDDEN',
      { reasonCode: 'CAPABILITY_REQUIRED' },
      { reasonCode: 'CAPABILITY_REQUIRED' },
    ],
    [404, 'NOT_FOUND', { leak: 'hidden' }, {}],
    [
      409,
      'CONFLICT',
      { expectedVersion: '1', currentVersion: '2', secret: 'x' },
      { expectedVersion: '1', currentVersion: '2' },
    ],
    [409, 'IDEMPOTENCY_CONFLICT', {}, {}],
    [500, 'INTERNAL_ERROR', { stack: 'trace' }, {}],
  ] as const;

  it.each(
    OPERATIONS.flatMap((spec) =>
      failures.map(([status, code, details, safe]) => ({
        spec,
        status,
        code,
        details,
        safe,
      })),
    ),
  )(
    '$spec.operationId maps a $status $code port failure to the allowlisted envelope',
    async ({ spec, status, code, details, safe }) => {
      const harness = makeDec108Harness({
        session: sessionResult(spec),
        port: error(status, code, 'Port message.', { ...details }),
      });
      const response = await harness.app.request(requestFor(spec));
      expect(harness.ports[spec.portName]).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(status);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.code).toBe(code);
      expect(body.requestId).toBe(REQUEST_ID);
      expect(body.details).toEqual(safe);
      expect(response.headers.get('cache-control')).toBe('no-store');
    },
  );

  it.each(MUTATIONS)(
    '$operationId maps a 422 port failure to VALIDATION_FAILED with at most 50 pointer violations',
    async (spec) => {
      const violations = Array.from({ length: 60 }, (_, index) => ({
        pointer: `/field/${index}`,
        code: 'INVALID_VALUE',
        message: 'The value is invalid.',
      }));
      const harness = makeDec108Harness({
        session: sessionResult(spec),
        port: error(422, 'VALIDATION_FAILED', 'Invalid.', { violations }),
      });
      const response = await harness.app.request(requestFor(spec));
      expect(harness.ports[spec.portName]).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(422);
      const body = (await response.json()) as {
        details: { violations: unknown[] };
      };
      expect(body.details.violations).toHaveLength(50);
    },
  );

  it.each(OPERATIONS)(
    '$operationId maps 503 and 504 to retryable dependency envelopes with Retry-After',
    async (spec) => {
      for (const [status, code] of [
        [503, 'DEPENDENCY_UNAVAILABLE'],
        [504, 'DEPENDENCY_DEADLINE_EXCEEDED'],
      ] as const) {
        const harness = makeDec108Harness({
          session: sessionResult(spec),
          port: error(
            status,
            code,
            'down',
            { dependencyClass: 'cms_registry', retryable: true, sql: 'x' },
            5,
          ),
        });
        const response = await harness.app.request(requestFor(spec));
        expect(harness.ports[spec.portName]).toHaveBeenCalledTimes(1);
        expect(response.status).toBe(status);
        expect(response.headers.get('retry-after')).toBe('5');
        const body = (await response.json()) as Record<string, unknown>;
        expect(body.details).toEqual({
          dependencyClass: 'cms_registry',
          retryable: true,
          retryAfterSeconds: 5,
        });
      }
    },
  );

  it.each(OPERATIONS)(
    '$operationId turns a port success with the wrong resource shape into 502 DEPENDENCY_INVALID_RESPONSE',
    async (spec) => {
      const wrong =
        spec.operationId === 'CMS-03A-10' ? reviewResource : dryRunResource;
      const harness = makeDec108Harness({
        session: sessionResult(spec),
        port: ok(wrong),
      });
      const response = await harness.app.request(requestFor(spec));
      expect(harness.ports[spec.portName]).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(502);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.code).toBe('DEPENDENCY_INVALID_RESPONSE');
    },
  );

  it.each(OPERATIONS)(
    '$operationId converts a thrown port error into scrubbed 503 and never leaks the message',
    async (spec) => {
      const harness = makeDec108Harness({ session: sessionResult(spec) });
      harness.ports[spec.portName]?.mockRejectedValueOnce(
        new Error('select * from cms_schema_reviews'),
      );
      const response = await harness.app.request(requestFor(spec));
      expect(harness.ports[spec.portName]).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(503);
      expect(await response.text()).not.toContain('cms_schema_reviews');
    },
  );
});

describe('DEC-108 handler idempotency (BE03a Idempotency / concurrency column)', () => {
  it.each(MUTATIONS)(
    '$operationId replays the same key and body once and rejects a changed body with 409 IDEMPOTENCY_CONFLICT',
    async (spec) => {
      const harness = makeDec108Harness({ session: sessionResult(spec) });
      const first = await harness.app.request(requestFor(spec));
      const second = await harness.app.request(requestFor(spec));
      expect(first.status).toBe(spec.status);
      expect(second.status).toBe(spec.status);
      expect(harness.ports[spec.portName]).toHaveBeenCalledTimes(1);
      const changed =
        spec.operationId === 'CMS-03A-12'
          ? { expectedVersion: '1', decision: 'reject' }
          : spec.operationId === 'CMS-03A-14'
            ? assignRevokeBody
            : { ...spec.body, expectedVersion: '2' };
      const conflict = await harness.app.request(
        requestFor(spec, {
          body: changed,
          ...('expectedVersion' in changed && changed.expectedVersion === '2'
            ? { headers: { 'if-match': '"2"' } }
            : {}),
        }),
      );
      expect(conflict.status).toBe(409);
      expect(((await conflict.json()) as { code: string }).code).toBe(
        'IDEMPOTENCY_CONFLICT',
      );
    },
  );
});
