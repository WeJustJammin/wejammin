import { CmsDefinitionVersionStateSchema } from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';
import {
  authenticationSession,
  NOW,
} from '../cms-editorial-production-session-test-support';

import {
  expectError,
  jsonReply,
  patternDetail,
  patternHarness,
  readRequest,
  READ_PATH,
  REQUEST_ID,
  MAX_BYTES,
  paddedResponse,
  writeRequest,
  PATTERN_KEY,
} from './pattern-definition.test-support';

describe('cmsPatternLatestRead immutable definition projection', () => {
  it.each(['userId', 'actingPartyId', 'mfaFresh'] as const)(
    'rechecks resolved WeakMap authority for changed %s',
    async (member) => {
      const request = readRequest();
      const harness = patternHarness({
        authority: {
          resolveCapabilities: ['cms.template_designer'],
          auth: {
            resolveSession: async () => ({
              ok: true,
              value: authenticationSession({
                stepUpAt: '2026-09-26T10:00:00Z',
              }),
            }),
          },
        },
        tuning: { now: () => NOW },
        reply: () => jsonReply(patternDetail()),
      });
      const signal = new AbortController().signal;
      const resolved = await harness.dependencies.resolveSession(
        request,
        signal,
      );
      if (!resolved.ok)
        throw new Error('The provider-backed session fixture must resolve.');
      expect(resolved.value.mfaFresh).toBe(false);
      const session = {
        ...resolved.value,
        [member]:
          member === 'mfaFresh' ? true : 'd1200000-0000-4000-8000-000000000099',
      };
      const result = await harness.dependencies.readLatest(
        {
          operationId: 'cmsPatternLatestRead',
          request,
          requestId: REQUEST_ID,
          session,
          patternKey: PATTERN_KEY,
        },
        signal,
      );
      if (member !== 'mfaFresh') {
        expect(result).toMatchObject({ ok: false, status: 401 });
        expect(harness.fetchImpl).not.toHaveBeenCalled();
      } else {
        expect(result.ok).toBe(true);
        const wire: unknown = JSON.parse(
          String(harness.fetchImpl.mock.calls[0]?.[1]?.body),
        );
        expect(wire).toMatchObject({
          p_request: { context: { stepUpVerified: false } },
        });
      }
    },
  );
  it.each([
    { code: 'FORBIDDEN' },
    { code: 'P0001', message: 'FORBIDDEN' },
    { code: 'NOT_FOUND' },
    { code: 'P0001', message: 'VALIDATION_FAILED' },
  ])(
    'keeps generic HTTP 500 provider tokens as dependency faults: %j',
    async (payload) => {
      for (const request of [writeRequest, readRequest]) {
        const harness = patternHarness({
          reply: () => jsonReply(payload, 500),
        });
        await expectError(
          await harness.send(request()),
          503,
          'DEPENDENCY_UNAVAILABLE',
        );
      }
    },
  );

  it.each([
    ['40001', 'VERSION_MISMATCH', 409, 'COMPOSITION_VERSION_CONFLICT'],
    ['40001', 'STALE_EDIT_PRESENCE', 409, 'COMPOSITION_VERSION_CONFLICT'],
    ['P0001', 'INTERNAL_ERROR', 500, 'INTERNAL_ERROR'],
  ] as const)(
    'preserves intentional SQL %s/%s semantics',
    async (code, message, status, expected) => {
      for (const upstream of [500, 502, 503, 504]) {
        for (const request of [writeRequest, readRequest]) {
          const harness = patternHarness({
            reply: () => jsonReply({ code, message }, upstream),
          });
          await expectError(await harness.send(request()), status, expected);
        }
      }
    },
  );
  it.each(CmsDefinitionVersionStateSchema.options)(
    'returns latest %s with the definition version ETag',
    async (state) => {
      const resource = patternDetail(state);
      const harness = patternHarness({ reply: () => jsonReply(resource) });
      const response = await harness.send(readRequest());
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(resource);
      expect(response.headers.get('etag')).toBe('"7"');
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('x-request-id')).toBe(REQUEST_ID);
      expect(harness.fetchImpl).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    `${READ_PATH}?ownerPartyId=caller`,
    '/api/v1/cms/patterns/Invalid_Key',
    '/api/v1/cms/patterns/nestable',
    '/api/v1/cms/patterns/profile%20header',
  ])('rejects malformed path or unexpected query %s', async (path) => {
    const harness = patternHarness();
    await expectError(
      await harness.send(readRequest(path)),
      400,
      'INVALID_REQUEST',
    );
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  });

  it.each(['if-match', 'idempotency-key'])(
    'rejects the unsupported latest-read header %s',
    async (header) => {
      const harness = patternHarness();
      await expectError(
        await harness.send(readRequest(READ_PATH, { [header]: '"7"' })),
        400,
        'INVALID_REQUEST',
      );
      expect(harness.fetchImpl).not.toHaveBeenCalled();
    },
  );

  it('allows a cookie-bound latest read without write-only CSRF', async () => {
    const harness = patternHarness({ reply: () => jsonReply(patternDetail()) });
    const response = await harness.send(
      readRequest(READ_PATH, { cookie: 'wj_session_ref=synthetic' }),
    );
    expect(response.status).toBe(200);
    expect(harness.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([
    { patternKey: 'another-pattern' },
    { patternVersion: 8 },
    { version: '8' },
    { lifecycleVersion: '99' },
    { lifecycle_version: '99' },
    { ownerPartyId: 'private provider' },
    { blockTree: undefined },
    { state: 'unknown' },
  ])(
    'refuses an unbound or private provider projection: %j',
    async (changed) => {
      const harness = patternHarness({
        reply: () => jsonReply({ ...patternDetail(), ...changed }),
      });
      await expectError(
        await harness.send(readRequest()),
        502,
        'DEPENDENCY_UNAVAILABLE',
      );
    },
  );

  it('keeps an absent or policy-hidden definition indistinguishable', async () => {
    const harness = patternHarness({
      reply: () =>
        jsonReply({ code: 'NOT_FOUND', message: 'private provider' }, 404),
    });
    const response = await harness.send(readRequest());
    const error = await expectError(response, 404, 'COMPOSITION_NOT_FOUND');
    expect(error.details).toEqual({});
  });

  it.each(['success', 'error'])(
    'clamps an oversized response option for %s bodies',
    async (kind) => {
      const harness = patternHarness({
        tuning: { maxResponseBytes: 1_048_576 },
        reply: async () =>
          paddedResponse(
            kind === 'success' ? patternDetail() : { code: 'CONFLICT' },
            MAX_BYTES + 1,
            kind === 'success' ? 200 : 400,
          ),
      });
      await expectError(
        await harness.send(readRequest()),
        502,
        'DEPENDENCY_UNAVAILABLE',
      );
    },
  );

  it('honors a tighter RPC error budget', async () => {
    const harness = patternHarness({
      tuning: { maxResponseBytes: 1_024 },
      reply: async () => paddedResponse({ code: 'CONFLICT' }, 1_025, 400),
    });
    await expectError(
      await harness.send(readRequest()),
      502,
      'DEPENDENCY_UNAVAILABLE',
    );
  });

  it.each(['media', 'declared'])(
    'cancels unread provider bodies after early %s refusal',
    async (kind) => {
      const cancel = vi.fn();
      const harness = patternHarness({
        reply: async () =>
          new Response(new ReadableStream({ cancel }), {
            headers: {
              'content-type':
                kind === 'media' ? 'text/plain' : 'application/json',
              ...(kind === 'declared'
                ? { 'content-length': String(MAX_BYTES + 1) }
                : {}),
            },
          }),
      });
      await expectError(
        await harness.send(readRequest()),
        502,
        'DEPENDENCY_UNAVAILABLE',
      );
      expect(cancel).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['headers', 'body'])(
    'aborts a stalled RPC %s without retry',
    async (stage) => {
      vi.useFakeTimers();
      const cancel = vi.fn();
      try {
        const harness = patternHarness({
          tuning: { deadlineMs: 10 },
          reply: () =>
            stage === 'headers'
              ? new Promise<Response>(() => undefined)
              : Promise.resolve(
                  new Response(new ReadableStream({ cancel }), {
                    headers: { 'content-type': 'application/json' },
                  }),
                ),
        });
        const pending = harness.send(readRequest());
        await vi.advanceTimersByTimeAsync(10);
        await expectError(await pending, 504, 'DEPENDENCY_UNAVAILABLE');
        expect(harness.fetchImpl).toHaveBeenCalledTimes(1);
        expect(harness.fetchImpl.mock.calls[0]?.[1]?.signal?.aborted).toBe(
          true,
        );
        if (stage === 'body') expect(cancel).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it('never accepts a creation-only typed reason on latest read', async () => {
    const harness = patternHarness({
      reply: () => jsonReply({ code: 'P0001', message: 'pattern_cycle' }, 400),
    });
    await expectError(await harness.send(readRequest()), 500, 'INTERNAL_ERROR');
  });
});
