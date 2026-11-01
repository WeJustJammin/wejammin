import { describe, expect, it, vi } from 'vitest';
import {
  authenticationSession,
  NOW,
} from '../cms-editorial-production-session-test-support';
import {
  designerSession,
  expectError,
  governedHarness,
  jsonReply,
  REQUEST_ID,
  reviewResource,
  submitBody,
  submitRequest,
} from './governed-review-submit.test-support';

const owner = ['cms.template_designer'];

describe('CMS-03C-06 authority refresh and local deadlines', () => {
  it('keeps any_of: a designer swapped for a curator before refresh still reaches the RPC', async () => {
    let calls = 0;
    const capabilities = vi.fn(async () =>
      ++calls === 1 ? owner : ['cms.taxonomy_curator'],
    );
    const harness = governedHarness({
      authority: {
        auth: {
          resolveSession: async () => ({
            ok: true as const,
            value: authenticationSession(),
          }),
        },
        resolveCapabilities: capabilities,
      },
      tuning: { now: () => NOW },
      reply: () => jsonReply(reviewResource('taxonomy_version')),
    });
    const response = await harness.send(
      submitRequest(submitBody('taxonomy_version')),
    );
    expect(response.status).toBe(201);
    expect(harness.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('uses refreshed stale proof without adding step-up to NONE', async () => {
    const request = submitRequest();
    let calls = 0;
    const initial = authenticationSession();
    const stale = { ...initial, stepUpAt: '2026-09-26T10:00:00Z' };
    const auth = vi.fn(async () => ({
      ok: true as const,
      value: ++calls === 1 ? initial : stale,
    }));
    const harness = governedHarness({
      authority: {
        auth: { resolveSession: auth },
        resolveCapabilities: owner,
      },
      tuning: { now: () => NOW },
      reply: () => jsonReply(reviewResource()),
    });
    expect((await harness.send(request)).status).toBe(201);
    expect(auth).toHaveBeenCalledTimes(2);
    expect(
      JSON.parse(String(harness.fetchImpl.mock.calls[0]?.[1]?.body)),
    ).toMatchObject({
      p_request: {
        context: {
          authUserId: stale.authUserId,
          sessionId: stale.sessionId,
          actorPersonId: stale.personId,
          actingPartyId: stale.actingPartyId,
          stepUpAt: stale.stepUpAt,
          stepUpVerified: false,
        },
      },
    });
    expect(harness.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('bounds a stalled outbound refresh with the local deadline', async () => {
    vi.useFakeTimers();
    try {
      let calls = 0;
      const auth = vi.fn(async () =>
        ++calls === 1
          ? { ok: true as const, value: authenticationSession() }
          : new Promise<never>(() => undefined),
      );
      const harness = governedHarness({
        authority: {
          auth: { resolveSession: auth },
          resolveCapabilities: owner,
        },
        tuning: { now: () => NOW, deadlineMs: 10 },
        reply: () => jsonReply(reviewResource()),
      });
      const result = harness.send(submitRequest());
      await vi.advanceTimersByTimeAsync(10);
      await expectError(await result, 504, 'DEPENDENCY_UNAVAILABLE');
      expect(auth).toHaveBeenCalledTimes(2);
      expect(harness.fetchImpl).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('bounds a stalled RPC with the local deadline and never retries a mutation', async () => {
    vi.useFakeTimers();
    try {
      const harness = governedHarness({
        tuning: { deadlineMs: 10 },
        reply: () => new Promise<Response>(() => undefined),
      });
      const result = harness.send(submitRequest());
      await vi.advanceTimersByTimeAsync(10);
      await expectError(await result, 504, 'DEPENDENCY_UNAVAILABLE');
      expect(harness.fetchImpl).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

it.each([false, true])(
  'requires prior proof on the identical Request (copied: %s)',
  async (copied) => {
    const harness = governedHarness({
      authority: {
        auth: {
          resolveSession: async () => ({
            ok: true,
            value: authenticationSession(),
          }),
        },
        resolveCapabilities: owner,
      },
      tuning: { now: () => NOW },
      reply: () => jsonReply(reviewResource()),
    });
    const request = submitRequest();
    const signal = new AbortController().signal;
    const resolved = copied
      ? await harness.dependencies.resolveSession(request, signal)
      : null;
    if (resolved !== null && !resolved.ok)
      throw new Error('Valid provider fixture required');
    const result = await harness.dependencies.submitReview(
      {
        operationId: 'CMS-03C-06',
        request: copied ? request.clone() : request,
        requestId: REQUEST_ID,
        session: resolved?.value ?? designerSession,
        body: submitBody(),
        idempotencyKey: 'governed-submit-0001',
      },
      signal,
    );
    expect(result).toMatchObject({ ok: false, status: 401 });
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  },
);
