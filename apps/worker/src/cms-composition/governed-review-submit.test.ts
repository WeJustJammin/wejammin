import { GovernedReviewResourceSchema } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  assertSubmitContract,
  expectError,
  governedHarness,
  HASH,
  IDEMPOTENCY_KEY,
  jsonReply,
  MAX_BYTES,
  REQUEST_ID,
  reviewResource,
  submitBody,
  submitRequest,
  SUBJECT_ID,
} from './governed-review-submit.test-support';

const KINDS = [
  'template_version',
  'pattern_version',
  'taxonomy_version',
] as const;

describe('CMS-03C-06 submit contract (BE03c row 168, field matrix 389)', () => {
  it.each(KINDS)('answers 201 with a strict %s review', async (kind) => {
    const body = submitBody(kind);
    const request = submitRequest(body);
    assertSubmitContract(request, body);
    const resource = reviewResource(kind);
    const harness = governedHarness({ reply: () => jsonReply(resource) });
    const response = await harness.send(request);
    expect(response.status).toBe(201);
    expect(GovernedReviewResourceSchema.parse(await response.json())).toEqual(
      resource,
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-request-id')).toBe(REQUEST_ID);
    expect(response.headers.get('etag')).toBe('"1"');
    expect(response.headers.get('content-type')).toBe(
      'application/json; charset=UTF-8',
    );
    expect(harness.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('forwards the exact body and key and carries no validator', async () => {
    const harness = governedHarness({
      reply: () => jsonReply(reviewResource()),
    });
    expect((await harness.send(submitRequest())).status).toBe(201);
    const init = harness.fetchImpl.mock.calls[0]?.[1];
    const headers = new Headers(init?.headers);
    expect(headers.get('x-idempotency-key')).toBe(IDEMPOTENCY_KEY);
    expect(headers.has('if-match')).toBe(false);
    const wire = JSON.parse(String(init?.body)) as {
      p_request: Record<string, unknown>;
    };
    expect(wire.p_request).toMatchObject({
      subjectKind: 'template_version',
      subjectId: SUBJECT_ID,
      subjectHash: HASH,
      idempotencyKey: IDEMPOTENCY_KEY,
      correlationId: REQUEST_ID,
    });
    expect(Object.keys(wire.p_request).sort()).toEqual([
      'context',
      'correlationId',
      'idempotencyKey',
      'subjectHash',
      'subjectId',
      'subjectKind',
    ]);
  });

  it('answers an idempotent replay with the same committed body and status', async () => {
    const resource = reviewResource();
    const harness = governedHarness({ reply: () => jsonReply(resource) });
    const first = await harness.send(submitRequest());
    const second = await harness.send(submitRequest());
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(await second.json()).toEqual(await first.json());
    const keys = harness.fetchImpl.mock.calls.map(([, init]) =>
      new Headers(init?.headers).get('x-idempotency-key'),
    );
    expect(keys).toEqual([IDEMPOTENCY_KEY, IDEMPOTENCY_KEY]);
  });

  it.each([
    ['subjectKind', 'navigation_version', '/subjectKind'],
    ['subjectKind', 'Template_Version', '/subjectKind'],
    ['subjectId', 'not-a-uuid', '/subjectId'],
    ['subjectHash', 'C'.repeat(64), '/subjectHash'],
    ['subjectHash', 'c'.repeat(63), '/subjectHash'],
  ] as const)(
    'refuses %s=%s with a 422 at %s before rate admission',
    async (member, value, pointer) => {
      const harness = governedHarness();
      const error = await expectError(
        await harness.send(submitRequest({ ...submitBody(), [member]: value })),
        422,
        'GOVERNED_REVIEW_VALIDATION_FAILED',
      );
      expect(error.details).toEqual({
        violations: [
          { path: pointer, code: 'invalid', message: 'The value is invalid.' },
        ],
      });
      expect(harness.rateLimit).not.toHaveBeenCalled();
      expect(harness.fetchImpl).not.toHaveBeenCalled();
    },
  );

  it.each([
    'actorId',
    'actingPartyId',
    'ownerPartyId',
    'capabilities',
    'context',
    'submittedBy',
    'state',
    'riskClass',
    'policyBasisHash',
    'ifMatch',
    'expectedVersion',
    'idempotencyKey',
  ])('rejects caller authority or private member %s', async (member) => {
    const harness = governedHarness();
    const error = await expectError(
      await harness.send(
        submitRequest({ ...submitBody(), [member]: 'caller-controlled' }),
      ),
      422,
      'GOVERNED_REVIEW_VALIDATION_FAILED',
    );
    // An unknown member name is attacker text and is never echoed back.
    expect(JSON.stringify(error)).not.toContain(member);
    expect(harness.rateLimit).not.toHaveBeenCalled();
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  });

  it.each(['subjectKind', 'subjectId', 'subjectHash'] as const)(
    'rejects a missing %s',
    async (member) => {
      const body: Record<string, unknown> = { ...submitBody() };
      delete body[member];
      const harness = governedHarness();
      await expectError(
        await harness.send(submitRequest(body)),
        422,
        'GOVERNED_REVIEW_VALIDATION_FAILED',
      );
      expect(harness.fetchImpl).not.toHaveBeenCalled();
    },
  );

  it('rejects malformed JSON before rate admission', async () => {
    const harness = governedHarness();
    const base = submitRequest();
    const request = new Request(base.url, {
      method: 'POST',
      headers: base.headers,
      body: '{',
    });
    await expectError(await harness.send(request), 400, 'INVALID_REQUEST');
    expect(harness.rateLimit).not.toHaveBeenCalled();
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  });

  it('accepts an exact 256 KiB valid JSON request', async () => {
    const harness = governedHarness({
      reply: () => jsonReply(reviewResource()),
    });
    const base = submitRequest();
    const json = JSON.stringify(submitBody());
    const request = new Request(base.url, {
      method: 'POST',
      headers: base.headers,
      body: json + ' '.repeat(MAX_BYTES - json.length),
    });
    expect((await harness.send(request)).status).toBe(201);
  });

  it.each([
    [
      'another subject id',
      { subjectId: 'd1200000-0000-4000-8000-0000000001ff' },
    ],
    ['another subject hash', { subjectHash: 'd'.repeat(64) }],
    ['another subject kind', { subjectKind: 'pattern_version' }],
    [
      'an approved review',
      { state: 'approved', decidedAt: '2026-10-14T00:00:00Z' },
    ],
    [
      'recorded decisions',
      { recordedDecisionCount: 1, requiredDecisionCount: 2 },
    ],
    ['an activated review', { activatedAt: '2026-10-14T00:00:00Z' }],
    ['a later review version', { version: '2' }],
  ] as const)('rejects a success body carrying %s', async (_name, change) => {
    const harness = governedHarness({
      reply: () =>
        jsonReply({ ...reviewResource('template_version'), ...change }),
    });
    await expectError(
      await harness.send(submitRequest()),
      502,
      'DEPENDENCY_UNAVAILABLE',
    );
  });

  it('rejects a success body that fails the strict resource schema', async () => {
    const harness = governedHarness({
      reply: () => jsonReply({ ...reviewResource(), submittedBy: 'person' }),
    });
    await expectError(
      await harness.send(submitRequest()),
      502,
      'DEPENDENCY_UNAVAILABLE',
    );
  });

  it.each([MAX_BYTES, MAX_BYTES + 1])(
    'bounds final route serialization at %i bytes, independent of the adapter',
    async (bytes) => {
      const value = {
        ...reviewResource(),
        createdAt: '2026-10-14T00:00:00.Z',
      };
      const base = new TextEncoder().encode(JSON.stringify(value)).byteLength;
      value.createdAt = '2026-10-14T00:00:00.' + '0'.repeat(bytes - base) + 'Z';
      GovernedReviewResourceSchema.parse(value);
      const harness = governedHarness({
        dependencies: { submitReview: async () => ({ ok: true, value }) },
      });
      const response = await harness.send(submitRequest());
      if (bytes > MAX_BYTES)
        await expectError(response, 502, 'DEPENDENCY_UNAVAILABLE');
      else {
        expect(response.status).toBe(201);
        expect((await response.arrayBuffer()).byteLength).toBe(bytes);
      }
      expect(harness.fetchImpl).not.toHaveBeenCalled();
    },
  );

  it('maps a port that throws to a scrubbed 503 and a malformed envelope to 502', async () => {
    const thrown = governedHarness({
      dependencies: {
        submitReview: async () => {
          throw new Error('private provider');
        },
      },
    });
    await expectError(
      await thrown.send(submitRequest()),
      503,
      'DEPENDENCY_UNAVAILABLE',
    );
    const malformed = governedHarness({
      dependencies: {
        submitReview: async () => ({ nonsense: true }) as never,
      },
    });
    await expectError(
      await malformed.send(submitRequest()),
      502,
      'DEPENDENCY_UNAVAILABLE',
    );
  });
});
