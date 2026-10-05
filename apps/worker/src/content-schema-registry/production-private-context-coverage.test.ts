import { describe, expect, it, vi } from 'vitest';

import type { Logger } from '@wejammin/observability/logging';

import type {
  ContentSchemaRegistryOperationId,
  ContentSchemaRegistryPortInput,
} from './types';
import { createSessionResolver } from './production-auth';
import {
  CMS_SCHEMA_REGISTRY_RPC,
  createProductionContentSchemaRegistryDependencies,
} from './production';
import { contextFor, rpcBodyFor } from './production-context';
import type { ServerSessionContext } from './production-types';
import {
  USER_ID,
  PARTY_ID,
  SESSION_ID,
  PERSON_ID,
  ACTING_CONTEXT_ID,
  REQUEST_ID,
  CORRELATION_ID,
  STEP_UP_AT,
  NOW,
  environment,
  newRequest,
  requestContext,
  authSession,
  withoutPrivateBinding,
  configuration,
} from './production-private-context-test-support';

describe('content registry private acting-context capture', () => {
  it('captures the validated private binding id in the server session registry only', async () => {
    const request = newRequest();
    const contexts = new WeakMap<Request, ServerSessionContext>();
    const resolveSession = createSessionResolver(
      {
        environment,
        auth: {
          resolveSession: vi.fn(async () => ({
            ok: true as const,
            value: authSession({ actingContextId: ACTING_CONTEXT_ID }),
          })),
        },
        resolveRequestContext: vi.fn(async () => requestContext),
      },
      configuration,
      contexts,
    );

    const result = await resolveSession(request, new AbortController().signal);

    expect(result).toEqual({
      ok: true,
      value: {
        userId: USER_ID,
        actingPartyId: PARTY_ID,
        capabilities: ['cms.schema_registry.read'],
        mfaFresh: true,
        stepUpFreshUntil: '2026-09-02T12:05:00.000Z',
      },
    });
    expect(result.ok && result.value).not.toHaveProperty('actingContextId');
    expect(JSON.stringify(result)).not.toContain(ACTING_CONTEXT_ID);
    expect(contexts.get(request)).toEqual({
      authUserId: USER_ID,
      sessionId: SESSION_ID,
      actorPersonId: PERSON_ID,
      actingPartyId: PARTY_ID,
      stepUpAt: STEP_UP_AT,
      actingContextId: ACTING_CONTEXT_ID,
    });
    expect(JSON.stringify(contexts.get(request))).not.toContain('capabilities');
  });

  it.each([
    ['a missing', undefined],
    ['an explicit null', null],
  ] as const)(
    'normalizes %s private binding id to null',
    async (_label, privateBinding) => {
      const request = newRequest();
      const contexts = new WeakMap<Request, ServerSessionContext>();
      const session =
        privateBinding === undefined
          ? withoutPrivateBinding(
              authSession({ actingContextId: ACTING_CONTEXT_ID }),
            )
          : authSession({ actingContextId: privateBinding });
      const resolveSession = createSessionResolver(
        {
          environment,
          auth: {
            resolveSession: vi.fn(async () => ({
              ok: true as const,
              value: session,
            })),
          },
          resolveRequestContext: vi.fn(async () => requestContext),
        },
        configuration,
        contexts,
      );

      await expect(
        resolveSession(request, new AbortController().signal),
      ).resolves.toMatchObject({ ok: true, value: { userId: USER_ID } });
      expect(contexts.get(request)).toMatchObject({ actingContextId: null });
    },
  );

  it('keeps the default telemetry projection free of the private binding id for every operation', async () => {
    const info = vi.fn();
    const dependencies = createProductionContentSchemaRegistryDependencies({
      environment,
      fetchImpl: vi.fn<typeof fetch>(),
      logger: { info } as unknown as Logger,
    });
    for (const operationId of Object.keys(
      CMS_SCHEMA_REGISTRY_RPC,
    ) as ContentSchemaRegistryOperationId[])
      dependencies.telemetry?.({
        operationId,
        requestId: REQUEST_ID,
        correlationId: CORRELATION_ID,
        outcome: 'success',
        status: 200,
        durationMs: 1,
        actorClass: 'human',
      });
    expect(info.mock.calls.length).toBeGreaterThanOrEqual(8);
    expect(JSON.stringify(info.mock.calls)).not.toContain(ACTING_CONTEXT_ID);
    expect(JSON.stringify(info.mock.calls)).not.toContain('actingContextId');
  });

  it('never projects a captured private binding id into non-activation context or RPC bodies', () => {
    const request = newRequest();
    const contexts = new WeakMap<Request, ServerSessionContext>();
    const captured = {
      authUserId: USER_ID,
      sessionId: SESSION_ID,
      actorPersonId: PERSON_ID,
      actingPartyId: PARTY_ID,
      stepUpAt: STEP_UP_AT,
      actingContextId: ACTING_CONTEXT_ID,
    } as ServerSessionContext;
    contexts.set(request, captured);
    const input = {
      operationId: 'CMS-03A-06',
      request,
      requestId: REQUEST_ID,
    } as unknown as ContentSchemaRegistryPortInput;
    const expected = {
      authUserId: USER_ID,
      sessionId: SESSION_ID,
      actorPersonId: PERSON_ID,
      actingPartyId: PARTY_ID,
      stepUpVerified: true,
      stepUpAt: STEP_UP_AT,
      requestId: REQUEST_ID,
      correlationId: CORRELATION_ID,
    };

    expect(contextFor(input, contexts, () => NOW)).toEqual(expected);
    expect(rpcBodyFor(input, contexts, () => NOW)).toEqual({
      context: expected,
    });
    expect(
      JSON.stringify(rpcBodyFor(input, contexts, () => NOW)),
    ).not.toContain(ACTING_CONTEXT_ID);
  });
});
