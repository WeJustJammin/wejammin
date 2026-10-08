import { describe, expect, it } from 'vitest';

import {
  CONFLICT_ID,
  FIELD_ID,
  authoringContextRequest,
  conflictDetailRequest,
  entryListPayload,
  fetchFailing,
  listRequest,
  postgrestRaise,
  wiredApp,
} from '../../apps/worker/src/cms-editorial-production-app.test-support';
import {
  ENTRY_ID,
  PARTY_ID,
  REQUEST_ID,
  USER_ID,
} from '../../apps/worker/src/cms-editorial-production.test-support';
import {
  ok,
  recorder,
} from '../../apps/worker/src/cms-editorial-production-telemetry.test-support';

/**
 * Slice 10 evidence lane EC (P2-S10-AC-093; also the telemetry half of AC-097,
 * AC-098 and AC-104). BE03b "Observability" for the safe reads CMS-03B-12/13/14,
 * through the REAL route -> production adapter chain with only the PostgREST edge
 * and the session/rate seams faked: every request emits ONE event whose content is
 * the operation, the outcome, the latency, the status, the request id and safe
 * counts, and nothing that identifies a party, an entry, a conflict or a value.
 */

const HASH = 'a'.repeat(64);
const INSTANT = '2026-09-26T12:00:00.000Z';
const BASE_REVISION_ID = '40000000-0000-4000-8000-000000000004';
const THEIRS_REVISION_ID = '41000000-0000-4000-8000-000000000004';
const SCHEMA_VERSION_ID = '50000000-0000-4000-8000-000000000005';
const SECRET_VALUES = ['Base secret', 'Theirs secret', 'Yours secret'];

const side = (value: string) => ({
  value,
  provenance: 'authored' as const,
  valueHash: HASH,
});

const conflictDetailPayload = {
  conflict: {
    id: CONFLICT_ID,
    version: '2',
    createdAt: INSTANT,
    updatedAt: INSTANT,
    state: 'open',
    changedPaths: [`/fields/${FIELD_ID}`],
    conflictHash: HASH,
  },
  entry: { id: ENTRY_ID, version: '3', createdAt: INSTANT, updatedAt: INSTANT },
  base: {
    revisionId: BASE_REVISION_ID,
    revisionNumber: '1',
    schemaVersionId: SCHEMA_VERSION_ID,
    contentHash: HASH,
  },
  theirs: {
    revisionId: THEIRS_REVISION_ID,
    revisionNumber: '2',
    schemaVersionId: SCHEMA_VERSION_ID,
    contentHash: HASH,
  },
  yours: { source: 'proposed', revisionId: null, contentHash: HASH },
  paths: [
    {
      path: `/fields/${FIELD_ID}`,
      base: side(SECRET_VALUES[0] as string),
      theirs: side(SECRET_VALUES[1] as string),
      yours: side(SECRET_VALUES[2] as string),
    },
  ],
  resolvedRevisionId: null,
} as const;

const EVIDENCE = {
  key: 'editorial.standard',
  version: '1',
  policyHash: HASH,
  riskClass: 'ordinary',
  requiredDecisionCount: 1,
  requiredCapabilities: [],
  approvalEvidenceHash: HASH,
} as const;

const CONTENT_TYPE_VERSION_ID = '71000000-0000-4000-8000-000000000007';
const authoringContextPayload = {
  creatableTypes: [
    {
      contentTypeId: '70000000-0000-4000-8000-000000000007',
      contentTypeVersionId: CONTENT_TYPE_VERSION_ID,
      label: 'Private article label',
      sourceLocale: 'en-US',
      defaultLocale: 'en-US',
      supportedLocales: ['en-US'],
      schemaArtifact: {
        id: '72000000-0000-4000-8000-000000000007',
        contentTypeVersionId: CONTENT_TYPE_VERSION_ID,
        artifactHash: HASH,
        compilerVersion: '1.0.0',
        zodContractRef: '03a.content-type-version.v1',
      },
      validatorRefs: [],
      workflowPolicy: EVIDENCE,
      activationEvidence: EVIDENCE,
    },
  ],
  selectedType: null,
  fields: [],
} as const;

type ReadCase = Readonly<{
  operation: 'CMS-03B-12' | 'CMS-03B-13' | 'CMS-03B-14';
  payload: unknown;
  send: (app: ReturnType<typeof wiredApp>) => Promise<Response> | Response;
  count: string;
  expected: number;
}>;

const CASES: readonly ReadCase[] = [
  {
    operation: 'CMS-03B-12',
    payload: conflictDetailPayload,
    send: conflictDetailRequest,
    count: 'paths_returned',
    expected: 1,
  },
  {
    operation: 'CMS-03B-13',
    payload: entryListPayload,
    send: (app) => listRequest(app),
    count: 'items_returned',
    expected: 1,
  },
  {
    operation: 'CMS-03B-14',
    payload: authoringContextPayload,
    send: authoringContextRequest,
    count: 'types_returned',
    expected: 1,
  },
];

const REQUEST_TOTAL = (operation: string, outcome: string): string =>
  `cms_editorial_request_total{operation="${operation}",outcome="${outcome}"}`;

describe('EC-093 safe-read telemetry through the real route and production adapter', () => {
  it.each(CASES)(
    'a served $operation read emits one event with operation, outcome, latency, request id and a safe $count count',
    async ({ operation, payload, send, count, expected }) => {
      const sink = recorder();
      const response = await send(
        wiredApp(fetchFailing(ok(payload)), { telemetry: sink.telemetry }),
      );
      expect(response.status).toBe(200);
      await sink.settled();
      expect(sink.events).toHaveLength(1);
      const event = sink.events[0];
      expect(event).toMatchObject({
        operationId: operation,
        requestId: REQUEST_ID,
        outcome: 'success',
        status: 200,
        actorClass: 'human',
        eventType: 'none',
      });
      expect(typeof event?.durationMs).toBe('number');
      expect(event?.durationMs).toBeGreaterThanOrEqual(0);
      expect(event?.metrics).toMatchObject({
        [REQUEST_TOTAL(operation, 'success')]: 1,
        [count]: expected,
        request_status: 200,
      });
      expect(typeof event?.metrics?.cms_editorial_latency_ms).toBe('number');
    },
  );

  it.each(CASES)(
    'a served $operation read is read-only in its telemetry: no revision, audit or outbox metric, and an entity identity only as a sha256 hash',
    async ({ operation, payload, send }) => {
      const sink = recorder();
      await send(
        wiredApp(fetchFailing(ok(payload)), { telemetry: sink.telemetry }),
      );
      await sink.settled();
      const metrics = Object.keys(sink.events[0]?.metrics ?? {});
      expect(
        metrics.filter((name) => /revision_created|audit|outbox/u.test(name)),
      ).toEqual([]);
      const hash = sink.events[0]?.entityIdHash;
      expect(hash === undefined || /^sha256:[0-9a-f]{64}$/u.test(hash)).toBe(
        true,
      );
      expect(hash).not.toBe(ENTRY_ID);
      expect(sink.events[0]?.operationId).toBe(operation);
    },
  );

  it.each(CASES)(
    'a served $operation event carries no party, user, entry, conflict or value',
    async ({ payload, send }) => {
      const sink = recorder();
      await send(
        wiredApp(fetchFailing(ok(payload)), { telemetry: sink.telemetry }),
      );
      await sink.settled();
      const serialized = JSON.stringify(sink.events);
      for (const forbidden of [
        USER_ID,
        PARTY_ID,
        ENTRY_ID,
        CONFLICT_ID,
        FIELD_ID,
        HASH,
        'Private article label',
        ...SECRET_VALUES,
      ])
        expect(serialized).not.toContain(forbidden);
    },
  );

  it.each(CASES)(
    'a concealed $operation read counts a denied outcome and still carries the request id',
    async ({ operation, send }) => {
      const sink = recorder();
      const response = await send(
        wiredApp(
          fetchFailing(() => postgrestRaise('NOT_FOUND')),
          { telemetry: sink.telemetry },
        ),
      );
      expect(response.status).toBe(404);
      await sink.settled();
      expect(sink.events[0]).toMatchObject({
        operationId: operation,
        requestId: REQUEST_ID,
        outcome: 'rejected',
        status: 404,
      });
      expect(sink.events[0]?.metrics).toMatchObject({
        [REQUEST_TOTAL(operation, 'denied')]: 1,
        request_status: 404,
      });
      expect(sink.events[0]?.entityIdHash).toBeUndefined();
    },
  );

  it.each(CASES)(
    'a $operation dependency outage counts a failed outcome without any upstream text',
    async ({ operation, send }) => {
      const sink = recorder();
      const response = await send(
        wiredApp(
          fetchFailing(() =>
            postgrestRaise('relation "private_table" is down', '57P01', 503),
          ),
          { telemetry: sink.telemetry },
        ),
      );
      expect(response.status).toBeGreaterThanOrEqual(500);
      await sink.settled();
      expect(sink.events[0]).toMatchObject({
        operationId: operation,
        requestId: REQUEST_ID,
        outcome: 'failure',
      });
      expect(JSON.stringify(sink.events)).not.toContain('private_table');
    },
  );
});
