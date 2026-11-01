import { createLogger } from '@wejammin/observability/logging';
import { parseServerEnvironment } from '@wejammin/config/environment';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createProductionCmsGovernedReviewDependencies } from './cms-composition-production-governed-review';
import { authenticationSession } from './cms-editorial-production-session-test-support';
import type { WorkerBindings } from './index';
import {
  activateBody,
  activationHarness,
  activationRequest,
} from './cms-composition/governed-activation.test-support';
import {
  assignmentPath,
  createBody,
  decisionBody,
  decisionPath,
  detailPath,
  detailResource,
  KEY,
  ownerSession,
  reviewerSession,
} from './cms-composition/governed-review-ops.test-support';
import {
  governedHarness,
  jsonReply,
  ORIGIN,
  REQUEST_ID,
  REVIEW_ID,
  submitBody,
  submitRequest,
} from './cms-composition/governed-review-submit.test-support';

afterEach(() => {
  vi.unstubAllGlobals();
});

const environment: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'slice-12-governed-review-coverage',
  SUPABASE_SECRET_KEY: 'sb_secret_synthetic_governed_coverage',
  SUPABASE_URL: 'https://supabase.example.test',
};

describe('composition-time configuration', () => {
  const create = (overrides: Record<string, unknown> = {}) =>
    createProductionCmsGovernedReviewDependencies({
      environment: parseServerEnvironment(environment),
      fetchImpl: vi.fn() as never,
      humanOrigins: [ORIGIN],
      ...overrides,
    });

  it.each([
    ['a zero deadline', { deadlineMs: 0 }],
    ['a fractional deadline', { deadlineMs: 1.5 }],
    ['a deadline above the 15 second route deadline', { deadlineMs: 15_001 }],
    ['a non-finite deadline', { deadlineMs: Number.NaN }],
    ['a zero response budget', { maxResponseBytes: 0 }],
    ['a fractional response budget', { maxResponseBytes: 10.5 }],
  ])('refuses %s at composition', (_n, overrides) => {
    expect(() => create(overrides)).toThrow(
      'Invalid CMS governed review production configuration.',
    );
  });

  it('uses the runtime fetch when none is injected', async () => {
    const runtimeFetch = vi.fn<typeof fetch>(async () =>
      Response.json(detailResource(), { status: 200 }),
    );
    vi.stubGlobal('fetch', runtimeFetch);
    const request = new Request(detailPath(), {
      headers: { origin: ORIGIN, 'x-request-id': REQUEST_ID },
    });
    const dependencies = createProductionCmsGovernedReviewDependencies({
      environment: parseServerEnvironment(environment),
      humanOrigins: [ORIGIN],
      now: () => 1_000,
      auth: {
        resolveSession: async () => ({
          ok: true as const,
          value: authenticationSession({
            authUserId: reviewerSession.userId,
            actingPartyId: reviewerSession.actingPartyId,
            stepUpAt: null,
          }),
        }),
      },
      resolveCapabilities: reviewerSession.capabilities,
    });
    const signal = new AbortController().signal;
    const session = await dependencies.resolveSession(request, signal);
    if (!session.ok) throw new Error('The session fixture must resolve.');
    const result = await dependencies.readReview(
      {
        operationId: 'CMS-03C-10',
        request,
        requestId: REQUEST_ID,
        session: session.value,
        reviewId: REVIEW_ID,
      },
      signal,
    );
    expect(result.ok).toBe(true);
    expect(runtimeFetch).toHaveBeenCalledTimes(1);
    expect(String(runtimeFetch.mock.calls[0]?.[0])).toBe(
      'https://supabase.example.test/rest/v1/rpc/cms_get_governed_review',
    );
  });
});

describe('the production ports re-parse their input against the frozen transport schema', () => {
  const idempotencyKey = KEY;

  const resolve = async (
    harness: ReturnType<typeof governedHarness>,
    request: Request,
  ) => {
    const signal = new AbortController().signal;
    const session = await harness.dependencies.resolveSession(request, signal);
    if (!session.ok) throw new Error('The session fixture must resolve.');
    return { session: session.value, signal };
  };

  it('refuses an invalid submission body with 400 and no network call', async () => {
    const harness = governedHarness();
    const request = submitRequest();
    const { session, signal } = await resolve(harness, request);
    const result = await harness.dependencies.submitReview(
      {
        operationId: 'CMS-03C-06',
        request,
        requestId: REQUEST_ID,
        session,
        body: { ...submitBody(), subjectHash: 'not-a-hash' },
        idempotencyKey,
      },
      signal,
    );
    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  });

  it('refuses an invalid decision input with 400 and no network call', async () => {
    const harness = governedHarness({ session: reviewerSession });
    const request = submitRequest();
    const { session, signal } = await resolve(harness, request);
    const result = await harness.dependencies.recordDecision(
      {
        operationId: 'CMS-03C-07',
        request,
        requestId: REQUEST_ID,
        session,
        reviewId: 'not-a-uuid',
        body: decisionBody() as never,
        idempotencyKey,
        ifMatch: '3',
      },
      signal,
    );
    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  });

  it('refuses an invalid assignment input with 400 and no network call', async () => {
    const harness = governedHarness({ session: ownerSession });
    const request = submitRequest();
    const { session, signal } = await resolve(harness, request);
    const result = await harness.dependencies.assignReviewer(
      {
        operationId: 'CMS-03C-08',
        request,
        requestId: REQUEST_ID,
        session,
        reviewId: REVIEW_ID,
        body: createBody({ expiresAt: 'tomorrow' }) as never,
        idempotencyKey,
        ifMatch: '3',
      },
      signal,
    );
    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  });

  it('refuses an invalid activation input with 400 and no network call', async () => {
    const harness = governedHarness();
    const request = submitRequest();
    const { session, signal } = await resolve(harness, request);
    const result = await harness.dependencies.activateReview(
      {
        operationId: 'CMS-03C-09',
        request,
        requestId: REQUEST_ID,
        session,
        reviewId: REVIEW_ID,
        body: activateBody({ action: 'launch' }) as never,
        idempotencyKey,
        ifMatch: '3',
      },
      signal,
    );
    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  });

  it('keeps the unused paths of the fixtures honest', () => {
    expect(decisionPath()).toContain(REVIEW_ID);
    expect(assignmentPath()).toContain(REVIEW_ID);
  });
});

describe('a committed invalidation is its own high-risk event', () => {
  it('emits cms_governed_review_invalidated_total apart from the request event', async () => {
    const lines: string[] = [];
    const logger = createLogger(
      { environment: 'staging', release: 'slice-12', service: 'wejammin-api' },
      { sink: (line) => lines.push(line) },
    );
    const harness = activationHarness({ tuning: { logger } }, () =>
      jsonReply({
        kind: 'refusal',
        reasonCode: 'dependency_changed',
        details: {},
      }),
    );
    expect((await harness.send(activationRequest(activateBody()))).status).toBe(
      409,
    );
    const events = lines.map(
      (line) => JSON.parse(line) as Record<string, unknown>,
    );
    const invalidated = events.filter(
      (event) =>
        event.eventName ===
        'cms.composition.governed_review.request.invalidated',
    );
    expect(invalidated).toHaveLength(1);
    expect(invalidated[0]).toMatchObject({
      operation: 'cms.composition.governed_review.activate',
      outcome: 'rejected',
      metrics: {
        'cms_governed_review_invalidated_total{reason="dependency_changed"}': 1,
      },
    });
    const requests = events.filter(
      (event) => event.eventName === 'cms.composition.governed_review.request',
    );
    expect(requests).toHaveLength(1);
    expect(JSON.stringify(requests[0])).not.toContain(
      'cms_governed_review_invalidated_total',
    );
  });
});
