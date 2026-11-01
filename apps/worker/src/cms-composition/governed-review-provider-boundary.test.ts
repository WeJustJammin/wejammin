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
  expectError,
  governedHarness,
  jsonReply,
  MAX_BYTES,
  paddedResponse,
  reviewResource,
  submitRequest,
} from './governed-review-submit.test-support';

const changedId = 'd1200000-0000-4000-8000-000000000199';
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
const owner = ['cms.template_designer'];

describe('CMS-03C-06 provider boundary regressions', () => {
  it.each(
    [500, 502, 503, 504].flatMap((status) => [
      { status, payload: { code: 'FORBIDDEN' } },
      { status, payload: { code: 'P0001', message: 'capability_missing' } },
      { status, payload: { code: 'P0001', message: 'NOT_FOUND' } },
    ]),
  )(
    'normalizes actual provider fault $status / $payload',
    async ({ status, payload }) => {
      const harness = governedHarness({
        reply: () => jsonReply(payload, status),
      });
      await expectError(
        await harness.send(submitRequest()),
        503,
        'DEPENDENCY_UNAVAILABLE',
      );
      expect(harness.fetchImpl).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['json', 'media', 'utf8', 'declared', 'streamed'])(
    'keeps local invalid error-body classification for %s',
    async (kind) => {
      const harness = governedHarness({
        reply: async () => {
          if (kind === 'declared' || kind === 'streamed')
            return paddedResponse(
              { code: 'CONFLICT' },
              MAX_BYTES + 1,
              400,
              kind === 'declared',
            );
          return new Response(kind === 'utf8' ? new Uint8Array([0xff]) : '{', {
            status: 400,
            headers: {
              'content-type':
                kind === 'media' ? 'text/plain' : 'application/json',
            },
          });
        },
      });
      await expectError(
        await harness.send(submitRequest()),
        502,
        'DEPENDENCY_UNAVAILABLE',
      );
      expect(harness.fetchImpl).toHaveBeenCalledTimes(1);
    },
  );

  it('answers a malformed 2xx body as a local 502, never a success', async () => {
    const harness = governedHarness({
      reply: async () => new Response('not json', { status: 200 }),
    });
    await expectError(
      await harness.send(submitRequest()),
      502,
      'DEPENDENCY_UNAVAILABLE',
    );
  });

  it.each([1_024, MAX_BYTES, 1_048_576])(
    'bounds provider errors with option %i',
    async (configured) => {
      const limit = Math.min(configured, MAX_BYTES);
      for (const excess of [0, 1]) {
        const harness = governedHarness({
          tuning: { maxResponseBytes: configured },
          reply: async () =>
            paddedResponse({ code: 'INVALID_REQUEST' }, limit + excess, 400),
        });
        await expectError(
          await harness.send(submitRequest()),
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
      const request = submitRequest();
      const harness = governedHarness({
        authority: {
          auth: { resolveSession: auth },
          resolveCapabilities: owner,
        },
        tuning: { now: () => NOW },
        reply: () => jsonReply(reviewResource()),
      });
      await expectError(
        await harness.send(request),
        status,
        status === 401 ? 'UNAUTHENTICATED' : 'GOVERNED_REVIEW_FORBIDDEN',
      );
      expect(auth).toHaveBeenCalledTimes(2);
      expect(auth.mock.calls.every(([original]) => original === request)).toBe(
        true,
      );
      expect(harness.fetchImpl).not.toHaveBeenCalled();
    },
  );

  it('refuses owner capability revoked after rate admission', async () => {
    const request = submitRequest();
    const session = authenticationSession();
    const auth = vi.fn(async () => ({ ok: true as const, value: session }));
    let calls = 0;
    const capabilities = vi.fn(async () => (++calls === 1 ? owner : []));
    const harness = governedHarness({
      authority: {
        auth: { resolveSession: auth },
        resolveCapabilities: capabilities,
      },
      tuning: { now: () => NOW },
      reply: () => jsonReply(reviewResource()),
    });
    const error = await expectError(
      await harness.send(request),
      403,
      'GOVERNED_REVIEW_FORBIDDEN',
    );
    expect(error.details).toEqual({ reasonCode: 'capability_missing' });
    expect(auth).toHaveBeenCalledTimes(2);
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
});
