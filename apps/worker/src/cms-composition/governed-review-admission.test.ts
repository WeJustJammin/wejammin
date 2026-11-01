import { describe, expect, it, vi } from 'vitest';
import {
  authenticationSession,
  NOW,
} from '../cms-editorial-production-session-test-support';

import {
  assertSubmitContract,
  designerSession,
  expectError,
  governedHarness,
  jsonReply,
  MAX_BYTES,
  reviewResource,
  submitBody,
  submitRequest,
} from './governed-review-submit.test-support';
import { GOVERNED_MIN_RESPONSE_BYTES } from './governed-review-ports';

describe('CMS-03C-06 Worker admission (BE03c row 168, BE00 order)', () => {
  it('uses real resolver authority bound to the original Request', async () => {
    const request = submitRequest();
    const session = authenticationSession({ stepUpAt: '2026-09-26T10:00:00Z' });
    const auth = vi.fn(async () => ({ ok: true as const, value: session }));
    const capabilities = vi.fn(async () => ['cms.template_designer']);
    const harness = governedHarness({
      authority: {
        auth: { resolveSession: auth },
        resolveCapabilities: capabilities,
      },
      tuning: { now: () => NOW },
      reply: () => jsonReply(reviewResource()),
    });
    request.headers.set('x-actor-id', 'caller-controlled');
    request.headers.set('x-owner-party-id', 'caller-controlled');
    expect((await harness.send(request)).status).toBe(201);
    expect(auth).toHaveBeenCalledWith(
      request,
      expect.anything(),
      expect.any(AbortSignal),
    );
    expect(capabilities).toHaveBeenCalledWith(
      session,
      request,
      expect.anything(),
      expect.any(AbortSignal),
    );
    expect(harness.resolveSession).not.toHaveBeenCalled();
    const wire: unknown = JSON.parse(
      String(harness.fetchImpl.mock.calls[0]?.[1]?.body),
    );
    expect(wire).toMatchObject({
      p_request: {
        context: {
          authUserId: session.authUserId,
          sessionId: session.sessionId,
          actorPersonId: session.personId,
          actingPartyId: session.actingPartyId,
          stepUpAt: session.stepUpAt,
          stepUpVerified: false,
        },
      },
    });
    expect(JSON.stringify(wire)).not.toContain('caller-controlled');
  });

  it('bounds final validation errors to the configured 1024 bytes', async () => {
    const harness = governedHarness({ tuning: { maxResponseBytes: 1_024 } });
    const body = Object.fromEntries(
      Array.from({ length: 60 }, (_, index) => [`extra${index}`, 'x']),
    );
    const response = await harness.send(
      submitRequest({ ...submitBody(), ...body }),
    );
    expect((await response.clone().arrayBuffer()).byteLength).toBeLessThan(
      1_025,
    );
    const error = await expectError(response, 500, 'INTERNAL_ERROR');
    expect(error.details).toEqual({});
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  });

  it.each([1, 32, 128])(
    'rejects an impossible %i-byte error-envelope configuration',
    (maxResponseBytes) => {
      expect(() => governedHarness({ tuning: { maxResponseBytes } })).toThrow();
    },
  );

  it('accepts exactly the minimum complete error envelope budget', async () => {
    expect(() =>
      governedHarness({
        tuning: { maxResponseBytes: GOVERNED_MIN_RESPONSE_BYTES - 1 },
      }),
    ).toThrow();
    const harness = governedHarness({
      anonymous: true,
      tuning: { maxResponseBytes: GOVERNED_MIN_RESPONSE_BYTES },
    });
    const response = await harness.send(submitRequest());
    expect((await response.clone().arrayBuffer()).byteLength).toBe(
      GOVERNED_MIN_RESPONSE_BYTES,
    );
    expect(
      (await expectError(response, 500, 'INTERNAL_ERROR')).details,
    ).toEqual({});
  });

  it.each([502, 503, 504])(
    'never promotes a provider HTTP %i fault into a caller refusal',
    async (status) => {
      const harness = governedHarness({
        reply: () =>
          jsonReply({ code: 'P0001', message: 'capability_missing' }, status),
      });
      await expectError(
        await harness.send(submitRequest()),
        503,
        'DEPENDENCY_UNAVAILABLE',
      );
    },
  );

  it('mounts CMS-03C-06 and rejects a valid anonymous submission with 401', async () => {
    const harness = governedHarness({ anonymous: true, integrated: true });
    const body = submitBody();
    const request = submitRequest(body);
    assertSubmitContract(request, body);
    const error = await expectError(
      await harness.send(request),
      401,
      'UNAUTHENTICATED',
    );
    expect(error.details).toEqual({ recoveryAction: 'reauthenticate' });
    expect(harness.resolveSession).toHaveBeenCalledTimes(1);
    expect(harness.rateLimit).not.toHaveBeenCalled();
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  });

  it('refuses a foreign Origin before authentication', async () => {
    const input = submitRequest();
    input.headers.set('origin', 'https://foreign.example.test');
    const harness = governedHarness({ anonymous: true });
    await expectError(
      await harness.send(input),
      403,
      'GOVERNED_REVIEW_FORBIDDEN',
    );
    expect(harness.resolveSession).not.toHaveBeenCalled();
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  });

  it('requires an acting party even for an owner-capability holder', async () => {
    const harness = governedHarness({
      session: { ...designerSession, actingPartyId: null },
    });
    const error = await expectError(
      await harness.send(submitRequest()),
      403,
      'GOVERNED_REVIEW_FORBIDDEN',
    );
    expect(error.details).toEqual({ reasonCode: 'capability_missing' });
    expect(harness.rateLimit).not.toHaveBeenCalled();
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  });

  it('scrubs a thrown session dependency failure', async () => {
    const harness = governedHarness({
      tuning: {
        resolveSession: async () => {
          throw new Error('private provider');
        },
      },
    });
    await expectError(
      await harness.send(submitRequest()),
      503,
      'DEPENDENCY_UNAVAILABLE',
    );
    expect(harness.rateLimit).not.toHaveBeenCalled();
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects a malformed successful session', async () => {
    const harness = governedHarness({
      session: { ...designerSession, userId: 'invalid' },
    });
    await expectError(
      await harness.send(submitRequest()),
      401,
      'UNAUTHENTICATED',
    );
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  });

  it('refuses malformed quota output before RPC', async () => {
    const harness = governedHarness({
      tuning: {
        rateLimit: async () => ({
          ok: true,
          value: { allowed: true, remaining: -1, limit: 30, resetAt: 61 },
        }),
      },
    });
    await expectError(
      await harness.send(submitRequest()),
      502,
      'DEPENDENCY_UNAVAILABLE',
    );
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  });

  it('refuses cookie-bearing writes without matching CSRF before authentication', async () => {
    const harness = governedHarness({ anonymous: true });
    const request = submitRequest(submitBody(), {
      cookie: 'wj_session_ref=synthetic; wj_csrf=expected',
      'x-csrf-token': 'wrong',
    });
    await expectError(
      await harness.send(request),
      403,
      'GOVERNED_REVIEW_FORBIDDEN',
    );
    expect(harness.resolveSession).not.toHaveBeenCalled();
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects unsupported request media before the session', async () => {
    const input = submitRequest();
    input.headers.set('content-type', 'text/plain');
    const harness = governedHarness();
    const error = await expectError(
      await harness.send(input),
      415,
      'UNSUPPORTED_MEDIA_TYPE',
    );
    expect(error.details).toEqual({ allowedMediaTypes: ['application/json'] });
    expect(harness.resolveSession).not.toHaveBeenCalled();
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'keeps request bodies at 256 KiB (declared: %s)',
    async (declared) => {
      const harness = governedHarness();
      const base = submitRequest();
      const json = JSON.stringify(submitBody());
      const body = json + ' '.repeat(MAX_BYTES + 1 - json.length);
      if (declared) base.headers.set('content-length', String(MAX_BYTES + 1));
      await expectError(
        await harness.send(
          new Request(base.url, {
            method: 'POST',
            headers: base.headers,
            body,
          }),
        ),
        400,
        'INVALID_REQUEST',
      );
      expect(harness.resolveSession).not.toHaveBeenCalled();
      expect(harness.fetchImpl).not.toHaveBeenCalled();
    },
  );
});
