import { createHash } from 'node:crypto';

import { ApiErrorSchema } from '@wejammin/contracts';
import { createLogger, type LogEvent } from '@wejammin/observability/logging';
import { describe, expect, it, vi } from 'vitest';

import {
  FIELD_ID,
  IDEMPOTENCY_KEY,
  fetchFailing,
  postgrestRaise,
  readError,
  wiredApp,
} from '../../apps/worker/src/cms-editorial-production-app.test-support';
import { productionCmsEditorialTelemetry } from '../../apps/worker/src/cms-editorial-production-telemetry';
import {
  ok,
  recorder,
} from '../../apps/worker/src/cms-editorial-production-telemetry.test-support';
import {
  PARTY_ID,
  REQUEST_ID,
  USER_ID,
  json,
} from '../../apps/worker/src/cms-editorial-production.test-support';
import { createBody } from '../../apps/worker/src/cms-editorial/route-fixtures.test-support';
import {
  NEW_ENTRY_ID,
  NEW_REVISION_ID,
  SESSION_PARTY,
  SESSION_USER,
  TITLE,
  created,
  failing,
  send,
  sessionOf,
} from './support/ev-eb-worker-create-support';

describe('EB create RPC failure mapping (AC-065)', () => {
  it('EB create RPC NOT_FOUND: the token is a 404 NOT_FOUND with empty details and none of the private DETAIL or HINT text', async () => {
    const { app } = failing(() =>
      postgrestRaise('NOT_FOUND', 'P0001', 400, {
        details: 'content type version belongs to foreign owner party 99',
        hint: 'concealed foreign tenant',
      }),
    );
    const response = await send(app);
    expect(response.status).toBe(404);
    const text = await response.text();
    expect(text).not.toMatch(/foreign|concealed|party 99/u);
    expect(ApiErrorSchema.parse(JSON.parse(text))).toMatchObject({
      code: 'NOT_FOUND',
      requestId: REQUEST_ID,
      details: {},
    });
  });

  it('EB create RPC VALIDATION_FAILED: the token with pointer /schemaArtifact is a 422 carrying exactly that safe violation', async () => {
    const { app } = failing(() =>
      postgrestRaise('VALIDATION_FAILED', 'P0001', 400, {
        details: JSON.stringify(['/schemaArtifact']),
        hint: 'artifact hash zzz mismatch',
      }),
    );
    const response = await send(app);
    expect(response.status).toBe(422);
    const body = await readError(response);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(body.details).toEqual({
      violations: [
        {
          path: '/schemaArtifact',
          code: 'invalid',
          message: 'The value is invalid.',
        },
      ],
    });
    expect(JSON.stringify(body)).not.toContain('zzz');
  });

  it('EB create RPC DEPENDENCY_UNAVAILABLE: the token is a retryable 503 whose details are the dependency class only', async () => {
    const { app } = failing(() =>
      postgrestRaise('DEPENDENCY_UNAVAILABLE', 'P0001', 400, {
        details: 'compiled artifact lookup timed out on shard 7',
      }),
    );
    const response = await send(app);
    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('5');
    expect(response.headers.get('x-cms-editorial-retryable')).toBe('true');
    const body = await readError(response);
    expect(body.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(body.details).toEqual({
      dependencyClass: 'cms_editorial',
      retryable: true,
    });
    expect(JSON.stringify(body)).not.toContain('shard 7');
  });

  it('EB create RPC INTERNAL_ERROR: the token is a scrubbed 500 INTERNAL_ERROR with empty details and no database text', async () => {
    const { app } = failing(() =>
      postgrestRaise('INTERNAL_ERROR', 'P0001', 400, {
        details: 'relation cms_content_entries violates secret_constraint',
        hint: 'private hint',
      }),
    );
    const response = await send(app);
    expect(response.status).toBe(500);
    expect(response.headers.get('x-cms-editorial-retryable')).toBe('false');
    const text = await response.text();
    expect(text).not.toMatch(/secret_constraint|private hint|cms_content/u);
    expect(ApiErrorSchema.parse(JSON.parse(text))).toMatchObject({
      code: 'INTERNAL_ERROR',
      details: {},
    });
  });

  it.each([500, 503])(
    'EB create RPC HTTP %i: a bare 5xx from PostgREST is a retryable 503 DEPENDENCY_UNAVAILABLE with no upstream text',
    async (status) => {
      const { app } = failing(() =>
        json({ message: 'pg internal detail leak' }, status),
      );
      const response = await send(app);
      expect(response.status).toBe(503);
      expect(response.headers.get('x-cms-editorial-retryable')).toBe('true');
      const body = await readError(response);
      expect(body.code).toBe('DEPENDENCY_UNAVAILABLE');
      expect(body.details).toEqual({
        dependencyClass: 'cms_editorial',
        retryable: true,
      });
      expect(JSON.stringify(body)).not.toContain('leak');
    },
  );

  it('EB create RPC transport failure: a rejected fetch is a retryable 503 DEPENDENCY_UNAVAILABLE', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('connect ECONNREFUSED 10.0.0.9:5432');
    }) as unknown as typeof fetch;
    const response = await send(wiredApp(fetchImpl));
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).not.toContain('ECONNREFUSED');
    expect(ApiErrorSchema.parse(JSON.parse(text)).details).toEqual({
      dependencyClass: 'cms_editorial',
      retryable: true,
    });
  });
});

const CREDENTIAL_HEADERS = {
  cookie: 'wj_session_ref=secret-cookie; wj_csrf=csrf-secret',
  'x-csrf-token': 'csrf-secret',
  authorization: 'Bearer secret-token',
};
const FORBIDDEN = [
  SESSION_USER,
  SESSION_PARTY,
  NEW_ENTRY_ID,
  NEW_REVISION_ID,
  TITLE,
  IDEMPOTENCY_KEY,
  'secret-cookie',
  'csrf-secret',
  'secret-token',
  USER_ID,
  PARTY_ID,
] as const;
const titled = { ...createBody, values: { [FIELD_ID]: TITLE } };
const entryHash = `sha256:${createHash('sha256').update(NEW_ENTRY_ID).digest('hex')}`;

describe('EB create redacted telemetry (AC-066)', () => {
  const telemetryApp = (
    response: () => Response,
    telemetry: (event: never) => void,
  ) =>
    wiredApp(fetchFailing(response), {
      resolveSession: sessionOf(['cms.author']),
      telemetry,
    });
  const expectRedacted = (value: unknown) => {
    const text = JSON.stringify(value);
    for (const forbidden of FORBIDDEN) expect(text).not.toContain(forbidden);
  };

  it('EB create telemetry success: the event names only a hashed entry id and no user, party, entry, revision, title, key or credential', async () => {
    const sink = recorder();
    const app = telemetryApp(ok(created), sink.telemetry);
    const response = await send(app, {
      body: titled,
      headers: CREDENTIAL_HEADERS,
    });
    expect(response.status).toBe(201);
    await sink.settled();
    expect(sink.events).toHaveLength(1);
    const [event] = sink.events;
    expect(event).toMatchObject({
      operationId: 'CMS-03B-10',
      status: 201,
      outcome: 'success',
      entityIdHash: entryHash,
      entityVersion: '1',
    });
    expect(event?.metrics).toMatchObject({
      'cms_entry_create_total{outcome="success"}': 1,
      changed_paths: 1,
    });
    expectRedacted(event);
  });

  it('EB create telemetry refusal: a database 409 refusal emits an event with the error code and no identifier, title, key or credential', async () => {
    const sink = recorder();
    const app = telemetryApp(
      () => postgrestRaise('IDEMPOTENCY_MISMATCH'),
      sink.telemetry,
    );
    const response = await send(app, {
      body: titled,
      headers: CREDENTIAL_HEADERS,
    });
    expect(response.status).toBe(409);
    await sink.settled();
    expect(sink.events).toHaveLength(1);
    expect(sink.events[0]).toMatchObject({
      operationId: 'CMS-03B-10',
      status: 409,
      outcome: 'rejected',
      errorCode: 'CONFLICT',
    });
    expect(sink.events[0]).not.toHaveProperty('entityIdHash');
    expectRedacted(sink.events[0]);
  });

  it('EB create telemetry validation refusal: a body refused before the RPC does not echo the refused value or any credential into the event', async () => {
    const sink = recorder();
    const app = telemetryApp(ok(created), sink.telemetry);
    const response = await send(app, {
      body: { ...titled, ownerId: SESSION_PARTY },
      headers: CREDENTIAL_HEADERS,
    });
    expect(response.status).toBe(422);
    await sink.settled();
    expect(sink.events[0]).toMatchObject({
      status: 422,
      errorCode: 'VALIDATION_FAILED',
    });
    expectRedacted(sink.events[0]);
  });

  it('EB create telemetry production sink: the structured log lines for a success and a refusal carry none of the forbidden values', async () => {
    const lines: LogEvent[] = [];
    const logger = createLogger(
      { environment: 'staging', release: 'slice-10', service: 'wejammin-api' },
      { sink: (line) => lines.push(JSON.parse(line) as LogEvent) },
    );
    const telemetry = productionCmsEditorialTelemetry(logger);
    const success = telemetryApp(ok(created), telemetry);
    const refusal = telemetryApp(
      () => postgrestRaise('IDEMPOTENCY_MISMATCH'),
      telemetry,
    );
    const options = { body: titled, headers: CREDENTIAL_HEADERS };
    expect((await send(success, options)).status).toBe(201);
    expect((await send(refusal, options)).status).toBe(409);
    await vi.waitFor(() =>
      expect(lines.map((line) => line.eventName)).toContain(
        'cms.editorial.acceptance',
      ),
    );
    expect(lines.length).toBeGreaterThanOrEqual(2);
    for (const line of lines) {
      expect(line).toMatchObject({ operation: 'cms.editorial.CMS-03B-10' });
      expectRedacted(line);
    }
    expect(lines[0]).toMatchObject({
      entityType: 'cms_entry',
      entityIdHash: entryHash,
    });
  });
});
