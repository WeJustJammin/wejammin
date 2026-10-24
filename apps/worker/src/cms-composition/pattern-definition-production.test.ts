import { describe, expect, it, vi } from 'vitest';
import { PATTERN_MIN_RESPONSE_BYTES } from './pattern-definition-ports';

import {
  expectError,
  jsonReply,
  MAX_BYTES,
  paddedResponse,
  PARTY_ID,
  PATTERN_KEY,
  patternBody,
  patternDetail,
  patternHarness,
  patternResource,
  readRequest,
  REQUEST_ID,
  USER_ID,
  writeRequest,
} from './pattern-definition.test-support';

const operations = [
  {
    id: 'CMS-03C-12',
    rpc: 'cms_create_pattern_version',
    request: writeRequest,
    value: patternResource,
    status: 201,
    rateClass: 'cms-pattern-write',
    userLimit: 30,
  },
  {
    id: 'cmsPatternLatestRead',
    rpc: 'cms_pattern_latest',
    request: readRequest,
    value: patternDetail,
    status: 200,
    rateClass: 'cms-pattern-read',
    userLimit: 60,
  },
] as const;

it('accepts exactly the minimum complete error envelope budget and rejects one byte less', async () => {
  expect(() =>
    patternHarness({
      tuning: { maxResponseBytes: PATTERN_MIN_RESPONSE_BYTES - 1 },
    }),
  ).toThrow();
  const harness = patternHarness({
    anonymous: true,
    tuning: { maxResponseBytes: PATTERN_MIN_RESPONSE_BYTES },
  });
  const response = await harness.send(writeRequest());
  expect((await response.clone().arrayBuffer()).byteLength).toBe(
    PATTERN_MIN_RESPONSE_BYTES,
  );
  expect((await expectError(response, 500, 'INTERNAL_ERROR')).details).toEqual(
    {},
  );
});

describe.each(operations)(
  '$id existing-runtime transport boundary',
  (operation) => {
    it('uses the named RPC and server-bound context, not caller authority headers', async () => {
      const harness = patternHarness({
        reply: () => jsonReply(operation.value()),
      });
      const request = operation.request();
      request.headers.set('x-actor-id', 'caller-controlled');
      request.headers.set('x-capabilities', 'cms.admin');
      request.headers.set('x-owner-party-id', 'caller-controlled');
      expect((await harness.send(request)).status).toBe(operation.status);
      expect(harness.fetchImpl).toHaveBeenCalledTimes(1);
      const call = harness.fetchImpl.mock.calls[0];
      expect(call?.[0]).toBe(
        `https://supabase.example.test/rest/v1/rpc/${operation.rpc}`,
      );
      expect(call?.[1]?.method).toBe('POST');
      const headers = new Headers(call?.[1]?.headers);
      expect(headers.get('content-profile')).toBe('platform_api');
      expect(headers.get('accept-profile')).toBe('platform_api');
      expect(headers.get('x-operation-id')).toBe(operation.id);
      expect(headers.get('x-request-id')).toBe(REQUEST_ID);
      const wire: unknown = JSON.parse(String(call?.[1]?.body));
      expect(wire).toMatchObject({
        p_request: {
          ...(operation.id === 'CMS-03C-12'
            ? patternBody()
            : { patternKey: PATTERN_KEY }),
          context: {
            authUserId: USER_ID,
            actingPartyId: PARTY_ID,
            requestId: REQUEST_ID,
            correlationId: REQUEST_ID,
            stepUpVerified: false,
          },
        },
      });
      expect(JSON.stringify(wire)).not.toContain('caller-controlled');
      expect(JSON.stringify(wire)).not.toContain('cms.admin');
      expect(
        harness.rateLimit.mock.calls.map(([input]) => ({
          operationId: input.operationId,
          actorId: input.actorId,
          rateClass: input.rateClass,
          rateScope: input.rateScope,
          limit: input.limit,
          windowSeconds: input.windowSeconds,
        })),
      ).toEqual([
        {
          operationId: operation.id,
          actorId: USER_ID,
          rateClass: operation.rateClass,
          rateScope: 'user',
          limit: operation.userLimit,
          windowSeconds: 60,
        },
        {
          operationId: operation.id,
          actorId: PARTY_ID,
          rateClass: operation.rateClass,
          rateScope: 'party',
          limit: 60,
          windowSeconds: 60,
        },
      ]);
    });

    it.each([false, true])(
      'accepts exactly 256 KiB decoded success (declared: %s)',
      async (declared) => {
        const harness = patternHarness({
          reply: async () =>
            paddedResponse(operation.value(), MAX_BYTES, 200, declared),
        });
        const response = await harness.send(operation.request());
        expect(response.status).toBe(operation.status);
        expect(await response.json()).toEqual(operation.value());
      },
    );

    it.each([false, true])(
      'rejects 256 KiB + 1 decoded success (declared: %s)',
      async (declared) => {
        const harness = patternHarness({
          reply: async () =>
            paddedResponse(operation.value(), MAX_BYTES + 1, 200, declared),
        });
        await expectError(
          await harness.send(operation.request()),
          502,
          'DEPENDENCY_UNAVAILABLE',
        );
      },
    );

    it.each([MAX_BYTES, MAX_BYTES + 1])(
      'bounds an RPC error payload at %i bytes',
      async (bytes) => {
        const harness = patternHarness({
          reply: async () =>
            paddedResponse(
              {
                code: 'CONFLICT',
                message: 'private provider',
                details: {},
              },
              bytes,
              400,
            ),
        });
        const response = await harness.send(operation.request());
        // The oversized body cannot supply a conflict token to the mapper.
        await expectError(
          response,
          bytes === MAX_BYTES ? 409 : 502,
          bytes === MAX_BYTES
            ? 'COMPOSITION_VERSION_CONFLICT'
            : 'DEPENDENCY_UNAVAILABLE',
        );
      },
    );

    it('preserves a tighter configured response budget', async () => {
      const harness = patternHarness({
        tuning: { maxResponseBytes: 1_024 },
        reply: async () => paddedResponse(operation.value(), 1_025),
      });
      await expectError(
        await harness.send(operation.request()),
        502,
        'DEPENDENCY_UNAVAILABLE',
      );
    });

    it.each(['user', 'party'])(
      'stops denied %s quota before RPC',
      async (scope) => {
        const harness = patternHarness({
          tuning: {
            rateLimit: async (input) => ({
              ok: true,
              value: {
                allowed: input.rateScope !== scope,
                limit: input.limit,
                remaining: input.rateScope === scope ? 0 : input.limit - 1,
                resetAt: 61,
              },
            }),
          },
        });
        const response = await harness.send(operation.request());
        await expectError(response, 429, 'RATE_LIMITED');
        expect(response.headers.get('retry-after')).toBe('60');
        expect(response.headers.get('ratelimit-remaining')).toBe('0');
        expect(harness.rateLimit).toHaveBeenCalledTimes(
          scope === 'user' ? 1 : 2,
        );
        expect(harness.fetchImpl).not.toHaveBeenCalled();
      },
    );

    it('ends a stalled session at the 15 second route deadline', async () => {
      vi.useFakeTimers();
      try {
        const harness = patternHarness({
          tuning: { resolveSession: () => new Promise(() => undefined) },
        });
        const response = harness.send(operation.request());
        await vi.advanceTimersByTimeAsync(15_000);
        await expectError(await response, 504, 'DEPENDENCY_UNAVAILABLE');
        expect(harness.fetchImpl).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });
  },
);

describe('CMS-03C-12 typed SQL refusal transport (synthetic replies)', () => {
  it.each([
    ['capability_missing', 403],
    ['pattern_cycle', 409],
    ['block_registry_digest_mismatch', 409],
    ['key_reserved', 422],
    ['pattern_depth_exceeded', 422],
    ['pattern_nodes_exceeded', 422],
    ['pattern_version_not_active', 422],
    ['pattern_incompatible', 422],
    ['nested_pattern_not_active', 422],
  ] as const)('projects only the known %s reason', async (reason, status) => {
    const harness = patternHarness({
      reply: () =>
        jsonReply(
          {
            code: 'P0001',
            message: reason,
            details: 'private provider',
          },
          400,
        ),
    });
    const code =
      status === 403
        ? 'COMPOSITION_FORBIDDEN'
        : status === 409
          ? 'COMPOSITION_VERSION_CONFLICT'
          : 'COMPOSITION_VALIDATION_FAILED';
    const error = await expectError(
      await harness.send(writeRequest()),
      status,
      code,
    );
    expect(error.details).toMatchObject({ reasonCode: reason });
  });
});

describe('CMS-03C-12 DEC-210 block_rules_violated transport (synthetic replies)', () => {
  const refuse = async (detail: unknown) => {
    const harness = patternHarness({
      reply: () =>
        jsonReply(
          { code: 'P0001', message: 'block_rules_violated', details: detail },
          400,
        ),
    });
    return expectError(
      await harness.send(writeRequest()),
      422,
      'COMPOSITION_VALIDATION_FAILED',
    );
  };

  it.each([
    '/blockTree/0',
    '/blockTree/31/children/0',
    '/blockTree/0/children/0/children/1/children/2',
  ])(
    'names itself and relays the offending node pointer %s as a bounded violation',
    async (pointer) => {
      const error = await refuse(JSON.stringify([pointer]));
      expect(error.details).toMatchObject({
        reasonCode: 'block_rules_violated',
        violations: [
          {
            path: pointer,
            code: 'block_rules_violated',
            message: 'The value is invalid.',
          },
        ],
      });
    },
  );

  it.each([
    ['a foreign pointer', '["/secret-pointer"]'],
    ['a placement pointer', '["/roots"]'],
    ['prose', 'private provider'],
    ['a null DETAIL', null],
  ])('keeps the reasonCode and drops %s', async (_label, detail) => {
    const error = await refuse(detail);
    expect(error.details).toMatchObject({ reasonCode: 'block_rules_violated' });
    expect(error.details).not.toHaveProperty('violations');
    expect(JSON.stringify(error)).not.toContain('secret-pointer');
  });
});
