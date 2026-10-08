import { ApiErrorSchema, EntryCreateResourceSchema } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  FIELD_ID,
  IDEMPOTENCY_KEY,
  readError,
} from '../../apps/worker/src/cms-editorial-production-app.test-support';
import {
  REQUEST_ID,
  captureInit,
} from '../../apps/worker/src/cms-editorial-production.test-support';
import { createBody } from '../../apps/worker/src/cms-editorial/route-fixtures.test-support';
import {
  NEW_ENTRY_ID,
  SESSION_PARTY,
  SESSION_USER,
  appOk,
  created,
  rpcRequest,
  send,
} from './support/ev-eb-worker-create-support';

describe('EB create port binding (AC-063, AC-066)', () => {
  it('EB create port: the production create port binds to the named create RPC and sends no If-Match and no base version', async () => {
    const { app, fetchImpl } = appOk();
    const response = await send(app);
    expect(response.status).toBe(201);
    expect(EntryCreateResourceSchema.parse(await response.json())).toEqual(
      created,
    );
    expect(response.headers.get('etag')).toBe('"1"');
    expect(response.headers.get('location')).toBe(
      `/api/v1/cms/entries/${NEW_ENTRY_ID}`,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const { url, init } = captureInit(fetchImpl);
    expect(url).toBe(
      'https://supabase.example.test/rest/v1/rpc/cms_create_entry',
    );
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Operation-Id']).toBe('CMS-03B-10');
    expect(headers['X-Idempotency-Key']).toBe(IDEMPOTENCY_KEY);
    expect(headers['Content-Profile']).toBe('platform_api');
    expect(
      Object.keys(headers).map((name) => name.toLowerCase()),
    ).not.toContain('if-match');
    const request = rpcRequest(fetchImpl).p_request;
    for (const absent of [
      'ifMatch',
      'expectedVersion',
      'baseRevision',
      'version',
      'entryId',
    ])
      expect(request).not.toHaveProperty(absent);
    expect(request).toMatchObject({
      ...createBody,
      idempotencyKey: IDEMPOTENCY_KEY,
    });
  });

  it('EB create context: actor and acting party are the verified session ids and the capability is never forwarded', async () => {
    const { app, fetchImpl } = appOk(['cms.author']);
    expect((await send(app)).status).toBe(201);
    const request = rpcRequest(fetchImpl).p_request;
    expect(request.context).toMatchObject({
      authUserId: SESSION_USER,
      actingPartyId: SESSION_PARTY,
      requestId: REQUEST_ID,
      stepUpVerified: true,
    });
    for (const absent of [
      'ownerId',
      'actingPartyId',
      'authUserId',
      'actorId',
      'assigneePersonId',
      'authorId',
      'capability',
      'capabilities',
    ])
      expect(request).not.toHaveProperty(absent);
    expect(Object.keys(request.context)).not.toContain('capability');
    expect(JSON.stringify(request)).not.toContain('cms.author');
  });

  it.each([
    'ownerId',
    'assigneePersonId',
    'authorId',
    'actingPartyId',
    'capability',
    'authority',
  ])(
    'EB create authority: a body naming %s is a 422 unknown_field violation and never reaches the RPC',
    async (key) => {
      const { app, fetchImpl } = appOk();
      const response = await send(app, {
        body: { ...createBody, [key]: 'attacker-value' },
      });
      expect(response.status).toBe(422);
      const text = await response.text();
      expect(text).not.toContain('attacker-value');
      expect(ApiErrorSchema.parse(JSON.parse(text))).toMatchObject({
        code: 'VALIDATION_FAILED',
        details: {
          violations: [
            {
              path: `/${key}`,
              code: 'unknown_field',
              message: 'The value is invalid.',
            },
          ],
        },
      });
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );
});

describe('EB create capability (AC-063)', () => {
  it('EB create capability: a session holding only cms.editor creates with a 201 and reaches the RPC', async () => {
    const { app, fetchImpl } = appOk(['cms.editor']);
    const response = await send(app);
    expect(response.status).toBe(201);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(rpcRequest(fetchImpl).p_request.context).toMatchObject({
      authUserId: SESSION_USER,
    });
  });

  it('EB create capability: a session holding only cms.reviewer is a 403 CAPABILITY_REQUIRED and never reaches the RPC', async () => {
    const { app, fetchImpl } = appOk(['cms.reviewer']);
    const response = await send(app);
    expect(response.status).toBe(403);
    expect(await readError(response)).toMatchObject({
      code: 'FORBIDDEN',
      requestId: REQUEST_ID,
      details: { reasonCode: 'CAPABILITY_REQUIRED' },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('EB create capability: a session holding no capability is a 403 and never reaches the RPC', async () => {
    const { app, fetchImpl } = appOk([]);
    expect((await send(app)).status).toBe(403);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('EB create values bound (AC-062)', () => {
  const uuidKey = (index: number) =>
    `123e4567-e89b-42d3-a456-${String(index).padStart(12, '0')}`;
  const manyValues = (count: number) =>
    Object.fromEntries(
      Array.from({ length: count }, (_v, index) => [uuidKey(index), index]),
    );
  const nested = (levels: number) => {
    let value: unknown = 'leaf';
    for (let level = 0; level < levels; level += 1) value = { k: value };
    return value;
  };

  it('EB create values bound: 129 value keys answer 422 VALIDATION_FAILED pointing at /values and the RPC is never called', async () => {
    const { app, fetchImpl } = appOk();
    const response = await send(app, {
      body: { ...createBody, values: manyValues(129) },
    });
    expect(response.status).toBe(422);
    expect(await readError(response)).toMatchObject({
      code: 'VALIDATION_FAILED',
      details: {
        violations: [
          {
            path: '/values',
            code: 'entry_values_max_keys',
            message: 'The value is invalid.',
          },
        ],
      },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('EB create values bound: exactly 128 value keys are admitted and relayed to the RPC', async () => {
    const { app, fetchImpl } = appOk();
    const values = manyValues(128);
    expect((await send(app, { body: { ...createBody, values } })).status).toBe(
      201,
    );
    expect(rpcRequest(fetchImpl).p_request.values).toEqual(values);
  });

  it('EB create values bound: a values tree past 8 container levels answers 422 pointing at /values and the RPC is never called', async () => {
    const { app, fetchImpl } = appOk();
    const response = await send(app, {
      body: { ...createBody, values: { [FIELD_ID]: nested(8) } },
    });
    expect(response.status).toBe(422);
    expect((await readError(response)).details).toMatchObject({
      violations: [{ path: '/values', code: 'entry_values_json_depth' }],
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('EB create values bound: a values tree of exactly 8 container levels is admitted and relayed to the RPC', async () => {
    const { app, fetchImpl } = appOk();
    const values = { [FIELD_ID]: nested(7) };
    expect((await send(app, { body: { ...createBody, values } })).status).toBe(
      201,
    );
    expect(rpcRequest(fetchImpl).p_request.values).toEqual(values);
  });

  it('EB create values bound: a values payload over 256 KiB is stopped at the 256 KiB body ceiling as 400 INVALID_REQUEST and the RPC is never called', async () => {
    const { app, fetchImpl } = appOk();
    const response = await send(app, {
      body: { ...createBody, values: { [FIELD_ID]: 'x'.repeat(262_144) } },
    });
    expect(response.status).toBe(400);
    expect(await readError(response)).toMatchObject({
      code: 'INVALID_REQUEST',
      message: 'The request body is too large.',
      details: {},
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
