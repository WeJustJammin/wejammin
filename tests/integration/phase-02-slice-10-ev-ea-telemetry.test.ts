/**
 * Slice 10 evidence lane EA: the redacted telemetry of CMS-03B-01, -02, -03 and -04 through the
 * PRODUCTION Hono app and the PRODUCTION RPC adapter (harness: `support/ev-ea-editorial-app.ts`).
 * A served request and a refused request each emit exactly one event naming the operation, and no
 * event carries a user, party, entry, conflict, idempotency key, cookie, bearer token or value.
 */
import { describe, expect, it, vi } from 'vitest';
import { REVISION_RESTORE_SEAMS } from '@wejammin/contracts';

import {
  CHAIN,
  CONFLICT,
  ENTRY,
  OPERATIONS,
  ORIGIN,
  PARTY,
  REVISION,
  USER,
  build,
  rpcError,
} from './support/ev-ea-editorial-app';

const HASH = 'a'.repeat(64);
const CURRENT = '40000000-0000-4000-8000-0000000000d1';
const RESTORED = '41000000-0000-4000-8000-000000000004';
const SOURCE_SCHEMA = '60000000-0000-4000-8000-000000000006';
const ACTIVE_SCHEMA = '70000000-0000-4000-8000-000000000007';

const revisionResource = (overrides: Record<string, unknown> = {}) => ({
  id: RESTORED,
  version: '1',
  entryVersion: '3',
  createdAt: '2026-09-26T00:00:00Z',
  updatedAt: '2026-09-26T00:00:00Z',
  state: 'draft',
  entryId: ENTRY,
  revisionNumber: '3',
  schemaVersionId: ACTIVE_SCHEMA,
  templateVersionId: null,
  taxonomyVersionIds: [],
  locale: 'en-US',
  contentHash: HASH,
  parentRevisionIds: [],
  validationState: 'valid',
  conflictId: null,
  ...overrides,
});

const SUCCESS: Readonly<Record<string, { status: number; payload: unknown }>> =
  {
    'CMS-03B-01': { status: 201, payload: revisionResource() },
    'CMS-03B-02': {
      status: 201,
      payload: revisionResource({
        parentRevisionIds: [CURRENT, REVISION],
        conflictId: CONFLICT,
      }),
    },
    'CMS-03B-03': {
      status: 200,
      payload: { items: [], nextCursor: null, pageVersion: '3', compare: null },
    },
    'CMS-03B-04': {
      status: 201,
      payload: {
        resource: revisionResource({ parentRevisionIds: [CURRENT, REVISION] }),
        restoreVerification: {
          request: {
            entryId: ENTRY,
            revisionId: REVISION,
            migrationChainId: CHAIN,
            expectedVersion: '2',
          },
          registry: {
            revisionId: REVISION,
            migrationChainId: CHAIN,
            sourceSchemaVersionId: SOURCE_SCHEMA,
            activeSchemaVersionId: ACTIVE_SCHEMA,
            chainSchemaVersionIds: [SOURCE_SCHEMA, ACTIVE_SCHEMA],
            entryVersion: '2',
          },
          seams: [...REVISION_RESTORE_SEAMS],
        },
      },
    },
  };

describe.each(OPERATIONS)(
  '$id redacted telemetry through the production app and adapter',
  (operation) => {
    const FORBIDDEN = [
      USER,
      PARTY,
      ENTRY,
      CONFLICT,
      'ev-ea-idempotency-0001',
      'secret-cookie',
      'csrf-secret',
      'secret-bearer',
      'Hello',
    ];

    const sendWithSecrets = (app: ReturnType<typeof build>) =>
      Promise.resolve(
        app.request(operation.path, {
          method: operation.method,
          headers: {
            origin: ORIGIN,
            'x-request-id': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            cookie: 'wj_session_ref=secret-cookie; wj_csrf=csrf-secret',
            authorization: 'Bearer secret-bearer',
            ...(operation.method === 'POST'
              ? {
                  'content-type': 'application/json',
                  'idempotency-key': 'ev-ea-idempotency-0001',
                  'if-match': operation.ifMatch ?? '"1"',
                  'x-csrf-token': 'csrf-secret',
                }
              : {}),
          },
          ...(operation.body === undefined
            ? {}
            : { body: JSON.stringify(operation.body) }),
        }),
      );

    it(`${operation.id} emits one success event naming only the operation, never an identifier, value or credential`, async () => {
      const events: unknown[] = [];
      const { status, payload } = SUCCESS[operation.id] as {
        status: number;
        payload: unknown;
      };
      const fetchImpl = vi.fn(
        async () =>
          new Response(JSON.stringify(payload), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      );
      const response = await sendWithSecrets(
        build(fetchImpl as unknown as typeof fetch, {
          telemetry: (event) => events.push(event),
        }),
      );
      expect(response.status).toBe(status);
      await vi.waitFor(() => expect(events).toHaveLength(1));
      const event = events[0] as Record<string, unknown>;
      expect(event.operationId).toBe(operation.id);
      expect(event.outcome).toBe('success');
      const text = JSON.stringify(event);
      for (const forbidden of FORBIDDEN) expect(text).not.toContain(forbidden);
    });

    it(`${operation.id} emits a failure event with the status and retryability but still no identifier, value or credential`, async () => {
      const events: unknown[] = [];
      const fetchImpl = vi.fn(async () => rpcError('NOT_FOUND'));
      const response = await sendWithSecrets(
        build(fetchImpl as unknown as typeof fetch, {
          telemetry: (event) => events.push(event),
        }),
      );
      expect(response.status).toBe(404);
      await vi.waitFor(() => expect(events).toHaveLength(1));
      const event = events[0] as Record<string, unknown>;
      expect(event.operationId).toBe(operation.id);
      expect(event.status).toBe(404);
      expect(event.outcome).not.toBe('success');
      expect(typeof event.retryable).toBe('boolean');
      const text = JSON.stringify(event);
      for (const forbidden of FORBIDDEN) expect(text).not.toContain(forbidden);
    });
  },
);
