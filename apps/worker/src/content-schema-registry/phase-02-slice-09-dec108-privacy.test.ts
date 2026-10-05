/**
 * BE03a observability and security: responses, headers, logs, metrics and
 * telemetry never carry actor, person, party, binding, session or reviewer
 * identifiers (`reviewerPersonId` included); 13 is a read and is not counted
 * as a command.
 */
import { describe, expect, it, vi } from 'vitest';

import type { Logger } from '@wejammin/observability/logging';

import {
  CONTENT_SCHEMA_REGISTRY_CAPABILITY_HEADER,
  CONTENT_SCHEMA_REGISTRY_PRIVATE_SERVICE_HOST,
} from '@wejammin/contracts';

import { createProductionContentSchemaRegistryDependencies } from './production';
import type { TelemetryEvent } from './types';
import {
  PARTY_ID,
  REQUEST_ID,
  USER_ID,
  error,
  ok,
} from './phase-02-slice-09-test-values';
import {
  ACTING_CONTEXT_ID,
  ASSIGNMENT_ID,
  REVIEWER_PERSON_ID,
  SESSION_ID,
} from './phase-02-slice-09-dec108-test-values';
import {
  OPERATIONS,
  makeDec108Harness,
  requestFor,
  sessionFor,
  sessionResult,
  specFor,
} from './phase-02-slice-09-dec108-test-support';

const PRIVATE = [
  USER_ID,
  PARTY_ID,
  REVIEWER_PERSON_ID,
  ACTING_CONTEXT_ID,
  SESSION_ID,
  'verified-session',
  'cms-dec108-key-001',
] as const;

const ALLOWED_TELEMETRY_KEYS = new Set([
  'operationId',
  'requestId',
  'correlationId',
  'outcome',
  'status',
  'errorCode',
  'durationMs',
  'actorClass',
  'actingContextClass',
  'dependency',
  'entityType',
  'entityIdHash',
  'entityVersion',
  'rateClass',
  'rateLimit',
  'rateWindowSeconds',
  'deadlineMs',
  'slo',
  'alertClass',
  'alertRoute',
  'runbook',
  'traceSteps',
  'metrics',
]);

const surface = async (
  response: Response,
  telemetry: ReadonlyArray<readonly [TelemetryEvent]>,
): Promise<string> =>
  [
    await response.text(),
    [...response.headers.entries()].map(([k, v]) => `${k}: ${v}`).join('\n'),
    JSON.stringify(telemetry),
  ].join('\n');

describe('DEC-108 responses, headers and telemetry carry no private identifiers', () => {
  it.each(OPERATIONS)(
    '$operationId success keeps actor, party, person, binding and session ids out of every surface',
    async (spec) => {
      const harness = makeDec108Harness({ session: sessionResult(spec) });
      const response = await harness.app.request(requestFor(spec));
      expect(response.status).toBe(spec.status);
      const text = await surface(response, harness.telemetry.mock.calls);
      for (const value of PRIVATE) expect(text).not.toContain(value);
    },
  );

  it.each(OPERATIONS)(
    '$operationId failure keeps private identifiers out even when the port echoes them',
    async (spec) => {
      const harness = makeDec108Harness({
        session: sessionResult(spec),
        port: error(
          409,
          'CONFLICT',
          'The operation conflicts with current state.',
          {
            expectedVersion: '1',
            currentVersion: '2',
            reviewerPersonId: REVIEWER_PERSON_ID,
            actorId: USER_ID,
            actingContextId: ACTING_CONTEXT_ID,
            assignmentId: ASSIGNMENT_ID,
          },
        ),
      });
      const response = await harness.app.request(requestFor(spec));
      expect(harness.ports[spec.portName]).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(409);
      const body = (await response.clone().json()) as { details: unknown };
      expect(body.details).toEqual({
        conflict: 'INVALID_TRANSITION',
        recoveryAction: 'refresh',
        expectedVersion: '1',
        currentVersion: '2',
      });
      const text = await surface(response, harness.telemetry.mock.calls);
      for (const value of [REVIEWER_PERSON_ID, ACTING_CONTEXT_ID, USER_ID])
        expect(text).not.toContain(value);
    },
  );
});

describe('DEC-108 telemetry events (BE03a observability)', () => {
  it.each(OPERATIONS)(
    '$operationId emits exactly one allowlisted event with its operation, status and rate class',
    async (spec) => {
      const harness = makeDec108Harness({ session: sessionResult(spec) });
      await harness.app.request(requestFor(spec));
      expect(harness.telemetry).toHaveBeenCalledTimes(1);
      const event = harness.telemetry.mock.calls[0]?.[0] as TelemetryEvent;
      expect(event).toMatchObject({
        operationId: spec.operationId,
        outcome: 'success',
        status: spec.status,
        actorClass: 'human',
        rateClass: spec.rateClass,
        rateLimit: spec.limit,
        rateWindowSeconds: 60,
      });
      for (const key of Object.keys(event))
        expect(ALLOWED_TELEMETRY_KEYS.has(key), key).toBe(true);
    },
  );

  it.each(OPERATIONS)(
    '$operationId records a dependency failure as outcome failure with its error code and no identifiers',
    async (spec) => {
      const harness = makeDec108Harness({
        session: sessionResult(spec),
        port: error(
          503,
          'DEPENDENCY_UNAVAILABLE',
          'down',
          { retryable: true },
          5,
        ),
      });
      await harness.app.request(requestFor(spec));
      const event = harness.telemetry.mock.calls[0]?.[0] as TelemetryEvent;
      expect(event).toMatchObject({
        operationId: spec.operationId,
        outcome: 'failure',
        status: 503,
        errorCode: 'DEPENDENCY_UNAVAILABLE',
      });
      expect(JSON.stringify(event)).not.toContain(USER_ID);
    },
  );
});

describe('DEC-108 production telemetry measurements', () => {
  const eventFor = (operationId: string, extra: object = {}): TelemetryEvent =>
    ({
      operationId,
      requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      outcome: 'success',
      status: 200,
      durationMs: 3,
      actorClass: 'human',
      ...extra,
    }) as unknown as TelemetryEvent;

  const logged = (operationId: string, extra: object = {}) => {
    const info = vi.fn();
    const dependencies = createProductionContentSchemaRegistryDependencies({
      environment: {
        APP_ENVIRONMENT: 'staging',
        APP_RELEASE: 'telemetry-dec108',
        SUPABASE_SECRET_KEY: 'sb_secret_telemetry_dec108',
        SUPABASE_URL: 'https://supabase.example.test',
      },
      fetchImpl: vi.fn<typeof fetch>(),
      logger: { info } as unknown as Logger,
    });
    dependencies.telemetry?.(eventFor(operationId, extra));
    return info.mock.calls.map(
      ([details]) => details as { eventName: string; operation: string },
    );
  };

  it.each([
    'CMS-03A-09',
    'CMS-03A-10',
    'CMS-03A-11',
    'CMS-03A-12',
    'CMS-03A-14',
  ])('%s is measured as a command', (operationId) => {
    expect(logged(operationId).map((entry) => entry.eventName)).toContain(
      'cms.registry.command',
    );
  });

  it('CMS-03A-13 is a protected read: measured as rpc and acceptance, never as a command', () => {
    const names = logged('CMS-03A-13').map((entry) => entry.eventName);
    expect(names).toContain('cms.registry.rpc');
    expect(names).toContain('cms.registry.acceptance');
    expect(names).not.toContain('cms.registry.command');
  });

  it.each(OPERATIONS)(
    '$operationId log lines drop identifiers smuggled onto the event',
    (spec) => {
      const lines = logged(spec.operationId, {
        userId: USER_ID,
        actingPartyId: PARTY_ID,
        reviewerPersonId: REVIEWER_PERSON_ID,
        actingContextId: ACTING_CONTEXT_ID,
      });
      expect(lines.length).toBeGreaterThan(0);
      expect(
        lines.some(
          (entry) => entry.operation === `cms.registry.${spec.operationId}`,
        ),
      ).toBe(true);
      const text = JSON.stringify(lines);
      for (const value of [
        USER_ID,
        PARTY_ID,
        REVIEWER_PERSON_ID,
        ACTING_CONTEXT_ID,
      ])
        expect(text).not.toContain(value);
    },
  );
});

describe('DEC-108 private capability projection for the review read (CMS-03A-13)', () => {
  const privateRead = (): Request => {
    const spec = specFor('CMS-03A-13');
    return new Request(
      `https://${CONTENT_SCHEMA_REGISTRY_PRIVATE_SERVICE_HOST}${spec.path}`,
      {
        headers: {
          authorization: 'Bearer verified-session',
          'x-request-id': REQUEST_ID,
        },
      },
    );
  };

  it('keeps cms.schema_review across the private boundary and drops untrusted capabilities', async () => {
    const spec = specFor('CMS-03A-13');
    const harness = makeDec108Harness({
      session: ok(
        sessionFor(spec, {
          capabilities: ['cms.schema_review', 'internal.provider.secret'],
        }),
      ),
    });
    const response = await harness.app.request(privateRead());
    expect(response.status).toBe(200);
    expect(
      response.headers.get(CONTENT_SCHEMA_REGISTRY_CAPABILITY_HEADER),
    ).toBe('cms.schema_review');
  });

  it('never emits the capability header on a public-origin review read', async () => {
    const spec = specFor('CMS-03A-13');
    const harness = makeDec108Harness({ session: sessionResult(spec) });
    const response = await harness.app.request(requestFor(spec));
    expect(
      response.headers.has(CONTENT_SCHEMA_REGISTRY_CAPABILITY_HEADER),
    ).toBe(false);
  });
});
