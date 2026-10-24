import { describe, expect, it, vi } from 'vitest';
import type {
  AuthenticationDependencies,
  AuthenticationSession,
} from '../authentication/types';
import {
  authenticationSession,
  NOW,
} from '../cms-editorial-production-session-test-support';
import {
  designerSession,
  expectError,
  jsonReply,
  MAX_BYTES,
  paddedResponse,
  PATTERN_KEY,
  patternDetail,
  patternHarness,
  patternResource,
  readRequest,
  REQUEST_ID,
  writeRequest,
} from './pattern-definition.test-support';

const operations = [
  {
    name: 'create',
    request: writeRequest,
    value: patternResource,
    status: 201,
  },
  { name: 'latest', request: readRequest, value: patternDetail, status: 200 },
] as const;
const changedId = 'd1200000-0000-4000-8000-000000000099';
const changes: [string, Partial<AuthenticationSession>, number][] = [
  ...(['authUserId', 'sessionId', 'personId', 'actingPartyId'] as const).map(
    (key): [string, Partial<AuthenticationSession>, number] => [
      key,
      { [key]: changedId },
      401,
    ],
  ),
  ['expired', { expiresAt: new Date(NOW - 1).toISOString() }, 401],
  ['inactive', { accountState: 'suspended' }, 403],
];

describe.each(operations)(
  '$name provider boundary regressions',
  (operation) => {
    it.each(
      [500, 502, 503, 504].flatMap((status) => [
        { status, payload: { code: 'FORBIDDEN' } },
        { status, payload: { code: 'P0001', message: 'capability_missing' } },
      ]),
    )(
      'normalizes actual provider fault $status / $payload',
      async ({ status, payload }) => {
        const harness = patternHarness({
          reply: () => jsonReply(payload, status),
        });
        await expectError(
          await harness.send(operation.request()),
          503,
          'DEPENDENCY_UNAVAILABLE',
        );
        expect(harness.fetchImpl).toHaveBeenCalledTimes(1);
      },
    );

    it.each(['json', 'media', 'utf8', 'declared', 'streamed'])(
      'keeps local invalid error-body classification for %s',
      async (kind) => {
        const harness = patternHarness({
          reply: async () => {
            if (kind === 'declared' || kind === 'streamed')
              return paddedResponse(
                { code: 'CONFLICT' },
                MAX_BYTES + 1,
                400,
                kind === 'declared',
              );
            return new Response(
              kind === 'utf8' ? new Uint8Array([0xff]) : '{',
              {
                status: 400,
                headers: {
                  'content-type':
                    kind === 'media' ? 'text/plain' : 'application/json',
                },
              },
            );
          },
        });
        await expectError(
          await harness.send(operation.request()),
          502,
          'DEPENDENCY_UNAVAILABLE',
        );
        expect(harness.fetchImpl).toHaveBeenCalledTimes(1);
      },
    );

    it.each([1_024, MAX_BYTES, 1_048_576])(
      'bounds provider errors with option %i',
      async (configured) => {
        const limit = Math.min(configured, MAX_BYTES);
        for (const excess of [0, 1]) {
          const harness = patternHarness({
            tuning: { maxResponseBytes: configured },
            reply: async () =>
              paddedResponse({ code: 'INVALID_REQUEST' }, limit + excess, 400),
          });
          await expectError(
            await harness.send(operation.request()),
            excess === 0 ? 400 : 502,
            excess === 0 ? 'INVALID_REQUEST' : 'DEPENDENCY_UNAVAILABLE',
          );
        }
      },
    );

    it.each(changes)(
      'refuses provider %s changed after admission',
      async (_name, change, status) => {
        let calls = 0;
        const initial = authenticationSession();
        const auth = vi.fn<AuthenticationDependencies['resolveSession']>(
          async () => ({
            ok: true as const,
            value: ++calls === 1 ? initial : { ...initial, ...change },
          }),
        );
        const request = operation.request();
        const harness = patternHarness({
          authority: {
            auth: { resolveSession: auth },
            resolveCapabilities: ['cms.template_designer'],
          },
          tuning: { now: () => NOW },
          reply: () => jsonReply(operation.value()),
        });
        await expectError(
          await harness.send(request),
          status,
          status === 401 ? 'UNAUTHENTICATED' : 'COMPOSITION_FORBIDDEN',
        );
        expect(auth).toHaveBeenCalledTimes(2);
        expect(
          auth.mock.calls.every(([original]) => original === request),
        ).toBe(true);
        expect(harness.fetchImpl).not.toHaveBeenCalled();
      },
    );

    it('refuses designer capability revoked after rate admission', async () => {
      const request = operation.request();
      const session = authenticationSession();
      const auth = vi.fn(async () => ({ ok: true as const, value: session }));
      let calls = 0;
      const capabilities = vi.fn(async () =>
        ++calls === 1 ? ['cms.template_designer'] : [],
      );
      const harness = patternHarness({
        authority: {
          auth: { resolveSession: auth },
          resolveCapabilities: capabilities,
        },
        tuning: { now: () => NOW },
        reply: () => jsonReply(operation.value()),
      });
      const error = await expectError(
        await harness.send(request),
        403,
        'COMPOSITION_FORBIDDEN',
      );
      expect(error.details).toEqual({ reasonCode: 'capability_missing' });
      expect(auth).toHaveBeenCalledTimes(2);
      expect(capabilities).toHaveBeenCalledTimes(2);
      expect(capabilities).toHaveBeenNthCalledWith(
        2,
        session,
        request,
        expect.anything(),
        expect.any(AbortSignal),
      );
      expect(harness.rateLimit).toHaveBeenCalledTimes(2);
      expect(harness.fetchImpl).not.toHaveBeenCalled();
    });

    it('uses refreshed stale proof without adding step-up to NONE', async () => {
      const request = operation.request();
      let calls = 0;
      const initial = authenticationSession();
      const stale = { ...initial, stepUpAt: '2026-09-26T10:00:00Z' };
      const auth = vi.fn(async () => ({
        ok: true as const,
        value: ++calls === 1 ? initial : stale,
      }));
      const capabilities = vi.fn(async () => ['cms.template_designer']);
      const harness = patternHarness({
        authority: {
          auth: { resolveSession: auth },
          resolveCapabilities: capabilities,
        },
        tuning: { now: () => NOW },
        reply: () => jsonReply(operation.value()),
      });
      expect((await harness.send(request)).status).toBe(operation.status);
      expect(auth).toHaveBeenCalledTimes(2);
      expect(capabilities).toHaveBeenNthCalledWith(
        2,
        stale,
        request,
        expect.anything(),
        expect.any(AbortSignal),
      );
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
        const harness = patternHarness({
          authority: {
            auth: { resolveSession: auth },
            resolveCapabilities: ['cms.template_designer'],
          },
          tuning: { now: () => NOW, deadlineMs: 10 },
          reply: () => jsonReply(operation.value()),
        });
        const result = harness.send(operation.request());
        await vi.advanceTimersByTimeAsync(10);
        await expectError(await result, 504, 'DEPENDENCY_UNAVAILABLE');
        expect(auth).toHaveBeenCalledTimes(2);
        expect(harness.fetchImpl).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });
  },
);

it.each([false, true])(
  'requires prior proof on the identical Request (copied: %s)',
  async (copied) => {
    const harness = patternHarness({
      authority: {
        auth: {
          resolveSession: async () => ({
            ok: true,
            value: authenticationSession(),
          }),
        },
        resolveCapabilities: ['cms.template_designer'],
      },
      tuning: { now: () => NOW },
      reply: () => jsonReply(patternDetail()),
    });
    const request = readRequest();
    const signal = new AbortController().signal;
    const resolved = copied
      ? await harness.dependencies.resolveSession(request, signal)
      : null;
    if (resolved !== null && !resolved.ok)
      throw new Error('Valid provider fixture required');
    const result = await harness.dependencies.readLatest(
      {
        operationId: 'cmsPatternLatestRead',
        request: copied ? request.clone() : request,
        requestId: REQUEST_ID,
        session: resolved?.value ?? designerSession,
        patternKey: PATTERN_KEY,
      },
      signal,
    );
    expect(result).toMatchObject({ ok: false, status: 401 });
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  },
);
