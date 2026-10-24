import { PatternLatestApiRequestSchema } from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';
import {
  authenticationSession,
  NOW,
} from '../cms-editorial-production-session-test-support';

import {
  assertWriteContract,
  designerSession,
  expectError,
  MAX_BYTES,
  PATTERN_KEY,
  patternBody,
  patternHarness,
  jsonReply,
  patternResource,
  patternDetail,
  readRequest,
  writeRequest,
} from './pattern-definition.test-support';

const OPERATIONS = [
  { name: 'the CMS-03C-12 write', request: writeRequest },
  { name: 'the cmsPatternLatestRead read', request: readRequest },
] as const;

describe('CMS-03C-12 and cmsPatternLatestRead Worker admission', () => {
  it.each(OPERATIONS)(
    'uses real resolver authority bound to the original Request ($name)',
    async ({ request: makeRequest }) => {
      const request = makeRequest();
      const session = authenticationSession({
        stepUpAt: '2026-09-26T10:00:00Z',
      });
      const auth = vi.fn(async () => ({ ok: true as const, value: session }));
      const capabilities = vi.fn(async () => ['cms.template_designer']);
      const harness = patternHarness({
        authority: {
          auth: { resolveSession: auth },
          resolveCapabilities: capabilities,
        },
        tuning: { now: () => NOW },
        reply: () =>
          jsonReply(
            request.method === 'POST' ? patternResource() : patternDetail(),
          ),
      });
      request.headers.set('x-actor-id', 'caller-controlled');
      request.headers.set('x-owner-party-id', 'caller-controlled');
      expect((await harness.send(request)).status).toBe(
        request.method === 'POST' ? 201 : 200,
      );
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
    },
  );
  it('bounds final validation errors to the configured 1024 bytes', async () => {
    const harness = patternHarness({ tuning: { maxResponseBytes: 1_024 } });
    const response = await harness.send(
      writeRequest({
        ...patternBody(),
        compatibleTypeIds: Array.from({ length: 50 }, () => 'invalid'),
      }),
    );
    const bytes = await response.clone().arrayBuffer();
    expect(bytes.byteLength).toBeLessThanOrEqual(1_024);
    const error = await expectError(response, 500, 'INTERNAL_ERROR');
    expect(error.details).toEqual({});
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  });

  it.each([1, 32, 128])(
    'rejects an impossible %i-byte error-envelope configuration',
    (maxResponseBytes) => {
      expect(() => patternHarness({ tuning: { maxResponseBytes } })).toThrow();
    },
  );
  it.each([502, 503, 504])(
    'never promotes a provider HTTP %i fault into a caller refusal',
    async (status) => {
      const harness = patternHarness({
        reply: () =>
          jsonReply({ code: 'P0001', message: 'capability_missing' }, status),
      });
      await expectError(
        await harness.send(writeRequest()),
        503,
        'DEPENDENCY_UNAVAILABLE',
      );
    },
  );
  it('mounts CMS-03C-12 and rejects a valid anonymous first-version request with 401', async () => {
    const harness = patternHarness({ anonymous: true, integrated: true });
    const body = patternBody();
    const request = writeRequest(body);
    assertWriteContract(request, body);
    const response = await harness.send(request);
    const error = await expectError(response, 401, 'UNAUTHENTICATED');
    expect(error.details).toEqual({ recoveryAction: 'reauthenticate' });
    expect(harness.resolveSession).toHaveBeenCalledTimes(1);
    expect(harness.rateLimit).not.toHaveBeenCalled();
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  });

  it('mounts cmsPatternLatestRead and rejects a valid anonymous key read with 401', async () => {
    expect(
      PatternLatestApiRequestSchema.parse({ patternKey: PATTERN_KEY }),
    ).toEqual({ patternKey: PATTERN_KEY });
    const harness = patternHarness({ anonymous: true, integrated: true });
    const response = await harness.send(readRequest());
    const error = await expectError(response, 401, 'UNAUTHENTICATED');
    expect(error.details).toEqual({ recoveryAction: 'reauthenticate' });
    expect(harness.resolveSession).toHaveBeenCalledTimes(1);
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  });

  it.each(OPERATIONS)(
    'refuses a foreign Origin before authentication ($name)',
    async ({ request }) => {
      const input = request();
      input.headers.set('origin', 'https://foreign.example.test');
      const harness = patternHarness({ anonymous: true });
      await expectError(
        await harness.send(input),
        403,
        'COMPOSITION_FORBIDDEN',
      );
      expect(harness.resolveSession).not.toHaveBeenCalled();
      expect(harness.fetchImpl).not.toHaveBeenCalled();
    },
  );

  it.each(OPERATIONS)(
    'requires an acting party even for a designer ($name)',
    async ({ request }) => {
      const harness = patternHarness({
        session: { ...designerSession, actingPartyId: null },
      });
      const error = await expectError(
        await harness.send(request()),
        403,
        'COMPOSITION_FORBIDDEN',
      );
      expect(error.details).toEqual({ reasonCode: 'capability_missing' });
      expect(harness.rateLimit).not.toHaveBeenCalled();
      expect(harness.fetchImpl).not.toHaveBeenCalled();
    },
  );

  it.each(OPERATIONS)(
    'scrubs a thrown session dependency failure ($name)',
    async ({ request }) => {
      const harness = patternHarness({
        tuning: {
          resolveSession: async () => {
            throw new Error('private provider');
          },
        },
      });
      await expectError(
        await harness.send(request()),
        503,
        'DEPENDENCY_UNAVAILABLE',
      );
      expect(harness.rateLimit).not.toHaveBeenCalled();
      expect(harness.fetchImpl).not.toHaveBeenCalled();
    },
  );

  it.each(OPERATIONS)(
    'rejects a malformed successful session ($name)',
    async ({ request }) => {
      const harness = patternHarness({
        session: { ...designerSession, userId: 'invalid' },
      });
      await expectError(await harness.send(request()), 401, 'UNAUTHENTICATED');
      expect(harness.fetchImpl).not.toHaveBeenCalled();
    },
  );

  it.each(OPERATIONS)(
    'refuses malformed quota output before RPC ($name)',
    async ({ request }) => {
      const harness = patternHarness({
        tuning: {
          rateLimit: async () => ({
            ok: true,
            value: { allowed: true, remaining: -1, limit: 60, resetAt: 61 },
          }),
        },
      });
      await expectError(
        await harness.send(request()),
        502,
        'DEPENDENCY_UNAVAILABLE',
      );
      expect(harness.fetchImpl).not.toHaveBeenCalled();
    },
  );

  it('refuses cookie-bearing writes without matching CSRF before authentication', async () => {
    const harness = patternHarness({ anonymous: true });
    const request = writeRequest(patternBody(), {
      cookie: 'wj_session_ref=synthetic; wj_csrf=expected',
      'x-csrf-token': 'wrong',
    });
    await expectError(
      await harness.send(request),
      403,
      'COMPOSITION_FORBIDDEN',
    );
    expect(harness.resolveSession).not.toHaveBeenCalled();
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  });

  it.each(OPERATIONS)(
    'rejects unsupported request media before the session ($name)',
    async ({ request }) => {
      const input = request();
      input.headers.set('content-type', 'text/plain');
      const harness = patternHarness();
      await expectError(
        await harness.send(input),
        415,
        'UNSUPPORTED_MEDIA_TYPE',
      );
      expect(harness.resolveSession).not.toHaveBeenCalled();
      expect(harness.fetchImpl).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])(
    'keeps definition request bodies at 256 KiB (declared: %s)',
    async (declared) => {
      const harness = patternHarness();
      const base = writeRequest();
      const json = JSON.stringify(patternBody());
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

  it.each(OPERATIONS)(
    'requires a designer capability before rate admission ($name)',
    async ({ request }) => {
      const harness = patternHarness({
        session: {
          ...designerSession,
          capabilities: ['cms.author'],
        },
      });
      const error = await expectError(
        await harness.send(request()),
        403,
        'COMPOSITION_FORBIDDEN',
      );
      expect(error.details).toMatchObject({ reasonCode: 'capability_missing' });
      expect(harness.rateLimit).not.toHaveBeenCalled();
      expect(harness.fetchImpl).not.toHaveBeenCalled();
    },
  );
});
