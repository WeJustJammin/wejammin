import { describe, expect, it } from 'vitest';

import type {
  ContentSchemaRegistryOperationId,
  ContentSchemaRegistryPortInput,
} from './types';
import { contextFor, rpcBodyFor } from './production-context';
import type { ServerSessionContext } from './production-types';

const USER_ID = '10000000-0000-4000-8000-000000000001';
const PARTY_ID = '20000000-0000-4000-8000-000000000002';
const SESSION_ID = '30000000-0000-4000-8000-000000000003';
const PERSON_ID = '40000000-0000-4000-8000-000000000004';
const ACTING_CONTEXT_ID = '90000000-0000-4000-8000-000000000009';
const REQUEST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CORRELATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const STEP_UP_AT = '2026-09-02T11:55:00.000Z';
const NOW = Date.parse('2026-09-02T12:00:00.000Z');

const request = (): Request =>
  new Request('https://api.example.test/api/v1/cms/content-types', {
    headers: {
      'x-request-id': REQUEST_ID,
      'x-correlation-id': CORRELATION_ID,
    },
  });

const captured = (actingContextId: string | null): ServerSessionContext => ({
  authUserId: USER_ID,
  sessionId: SESSION_ID,
  actorPersonId: PERSON_ID,
  actingPartyId: PARTY_ID,
  stepUpAt: STEP_UP_AT,
  actingContextId,
});

const inputFor = (
  operationId: ContentSchemaRegistryOperationId,
  target: Request,
): ContentSchemaRegistryPortInput =>
  ({
    operationId,
    requestId: REQUEST_ID,
    request: target,
    path: { contentTypeId: USER_ID, versionId: PARTY_ID },
    body: { expectedVersion: '7' },
    idempotencyKey: 'cms-activate-001',
    ifMatch: '7',
  }) as unknown as ContentSchemaRegistryPortInput;

const otherOperations = [
  'CMS-03A-01',
  'CMS-03A-02',
  'CMS-03A-03',
  'CMS-03A-05',
  'CMS-03A-06',
  'CMS-03A-07',
  'CMS-03A-08',
] as const satisfies readonly ContentSchemaRegistryOperationId[];

describe('content registry activation trusted binding transport', () => {
  it('projects the captured binding id into the activation RPC context only', () => {
    const target = request();
    const contexts = new WeakMap<Request, ServerSessionContext>();
    contexts.set(target, captured(ACTING_CONTEXT_ID));

    const activation = contextFor(
      inputFor('CMS-03A-04', target),
      contexts,
      () => NOW,
    );
    expect(activation).toMatchObject({
      authUserId: USER_ID,
      sessionId: SESSION_ID,
      actorPersonId: PERSON_ID,
      actingPartyId: PARTY_ID,
      stepUpVerified: true,
      actingContextId: ACTING_CONTEXT_ID,
    });

    for (const operationId of otherOperations) {
      const context = contextFor(
        inputFor(operationId, target),
        contexts,
        () => NOW,
      );
      expect(context, operationId).not.toHaveProperty('actingContextId');
      expect(JSON.stringify(context), operationId).not.toContain(
        ACTING_CONTEXT_ID,
      );
    }
  });

  it('carries the binding id in the activation rpc body and no other rpc body', () => {
    const target = request();
    const contexts = new WeakMap<Request, ServerSessionContext>();
    contexts.set(target, captured(ACTING_CONTEXT_ID));

    const activation = rpcBodyFor(
      inputFor('CMS-03A-04', target),
      contexts,
      () => NOW,
    ) as { context: Record<string, unknown> };
    expect(activation.context).toMatchObject({
      actingContextId: ACTING_CONTEXT_ID,
      authUserId: USER_ID,
      actingPartyId: PARTY_ID,
    });

    for (const operationId of otherOperations) {
      const body = rpcBodyFor(
        inputFor(operationId, target),
        contexts,
        () => NOW,
      );
      expect(body, operationId).not.toHaveProperty('context.actingContextId');
      expect(JSON.stringify(body), operationId).not.toContain(
        ACTING_CONTEXT_ID,
      );
    }
  });

  it('omits the binding id from activation when no private binding was captured', () => {
    const target = request();
    const contexts = new WeakMap<Request, ServerSessionContext>();
    contexts.set(target, captured(null));

    const activation = contextFor(
      inputFor('CMS-03A-04', target),
      contexts,
      () => NOW,
    );
    expect(activation).not.toHaveProperty('actingContextId');
  });

  it('omits the binding id from activation when no server context was captured', () => {
    const target = request();
    const contexts = new WeakMap<Request, ServerSessionContext>();

    const activation = contextFor(
      inputFor('CMS-03A-04', target),
      contexts,
      () => NOW,
    );
    expect(activation).not.toHaveProperty('actingContextId');
  });
});
