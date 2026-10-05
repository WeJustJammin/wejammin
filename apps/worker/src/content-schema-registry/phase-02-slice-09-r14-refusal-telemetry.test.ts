/**
 * SEC-3 (audit), AC694: every Worker-side refusal of a human route emits the spec's
 * sanitized denial telemetry.
 *
 * The shared human-route gates (origin, body preflight, CSRF, session, path and body
 * validation, capability, step-up, idempotency headers) answered 401/403/4xx without
 * emitting any event, so a spike of decision, assignment or capability-grant denials
 * that the Worker itself refused never reached the alerts: they count `cms.registry.command`
 * events whose request_status is 401, 403 or 404. A refusal is one request: outcome
 * `rejected`, its status and error code, the operation, no identifier, no body.
 */
import { describe, expect, it } from 'vitest';

import { buildContentSchemaRegistryOperationalSnapshot } from './operational-alert-metrics';
import {
  harnessFor,
  opFor,
  requestFor,
  sessionFor,
  type EvidenceOp,
  type EvidenceOperationId,
} from './phase-02-slice-09-be03a-evidence-support';
import { error } from './phase-02-slice-09-test-values';
import { productionTelemetry } from './production-telemetry';
import type { TelemetryEvent } from './types';

type Refusal = Readonly<{
  name: string;
  status: number;
  code: string;
  actorClass: TelemetryEvent['actorClass'];
  request: (op: EvidenceOp) => Request;
  session?: (op: EvidenceOp) => Parameters<typeof harnessFor>[1];
}>;

const refusals: readonly Refusal[] = [
  {
    name: 'a foreign origin (CORS allowlist)',
    status: 403,
    code: 'FORBIDDEN',
    actorClass: 'anonymous',
    request: (op) =>
      requestFor(op, { headers: { origin: 'https://evil.example' } }),
  },
  {
    name: 'a non-JSON media type',
    status: 415,
    code: 'UNSUPPORTED_MEDIA_TYPE',
    actorClass: 'anonymous',
    request: (op) =>
      requestFor(op, { headers: { 'content-type': 'text/plain' } }),
  },
  {
    name: 'a cookie session without a matching CSRF token',
    status: 403,
    code: 'FORBIDDEN',
    actorClass: 'anonymous',
    request: (op) =>
      requestFor(op, { headers: { cookie: 'wj_session_ref=abc' } }),
  },
  {
    name: 'a missing or expired session',
    status: 401,
    code: 'UNAUTHENTICATED',
    actorClass: 'anonymous',
    request: (op) => requestFor(op),
    session: () => ({
      session: error(401, 'UNAUTHENTICATED', 'The session is invalid.'),
    }),
  },
  {
    name: 'a malformed path identifier',
    status: 400,
    code: 'INVALID_REQUEST',
    actorClass: 'human',
    request: (op) =>
      requestFor(op, {
        path: op.path.replace(
          /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/u,
          'not-a-uuid',
        ),
      }),
  },
  {
    name: 'an invalid body',
    status: 422,
    code: 'VALIDATION_FAILED',
    actorClass: 'human',
    request: (op) => requestFor(op, { body: { unknownMember: true } }),
  },
  {
    name: 'a missing capability',
    status: 403,
    code: 'FORBIDDEN',
    actorClass: 'human',
    request: (op) => requestFor(op),
    session: (op) => ({
      session: {
        ok: true,
        value: sessionFor(op, { capabilities: [], mfaFresh: true }),
      },
    }),
  },
  {
    name: 'a missing step-up verification',
    status: 401,
    code: 'STEP_UP_REQUIRED',
    actorClass: 'human',
    request: (op) => requestFor(op),
    session: (op) => ({
      session: { ok: true, value: sessionFor(op, { mfaFresh: false }) },
    }),
  },
  {
    name: 'a missing Idempotency-Key',
    status: 400,
    code: 'INVALID_REQUEST',
    actorClass: 'human',
    request: (op) => requestFor(op, { headers: { 'idempotency-key': null } }),
  },
];

/** The three families of AC694: decision (A12), assignment (A14), capability grant (A15). */
const FAMILY: readonly EvidenceOperationId[] = [
  'CMS-03A-12',
  'CMS-03A-14',
  'CMS-03A-15',
];

const send = async (op: EvidenceOp, refusal: Refusal) => {
  const harness = harnessFor(op, refusal.session?.(op) ?? {});
  const response = await harness.app.request(refusal.request(op));
  return { harness, response };
};

describe('Worker-side refusals emit sanitized denial telemetry (AC694)', () => {
  for (const operationId of FAMILY)
    for (const refusal of refusals) {
      const op = opFor(operationId);
      // CMS-03A-15 names its owner by receipt (the RPC decides), so the Worker holds
      // no capability gate for it and its path carries no identifier.
      const applies =
        (refusal.code !== 'STEP_UP_REQUIRED' || op.stepUp) &&
        !(
          operationId === 'CMS-03A-15' &&
          (refusal.name === 'a missing capability' ||
            refusal.name === 'a malformed path identifier')
        );
      if (!applies) continue;
      it(`[P2-S09-AC-694] ${operationId}: ${refusal.name} answers ${refusal.status} ${refusal.code} and emits exactly one rejected event`, async () => {
        const { harness, response } = await send(op, refusal);
        expect(response.status).toBe(refusal.status);
        expect(
          Object.values(harness.ports).flatMap((port) => port.mock.calls),
        ).toEqual([]);
        expect(harness.telemetry).toHaveBeenCalledTimes(1);
        const event = harness.telemetry.mock.calls[0]?.[0] as TelemetryEvent;
        expect(event).toMatchObject({
          operationId,
          outcome: 'rejected',
          status: refusal.status,
          errorCode: refusal.code,
          actorClass: refusal.actorClass,
          metrics: { request_status: refusal.status },
        });
        const text = JSON.stringify(event);
        expect(text).not.toMatch(/unknownMember|Bearer|verified-session/u);
        expect(text).not.toContain('10000000-0000-4000-8000-000000000001');
        expect(text).not.toContain('20000000-0000-4000-8000-000000000002');
      });
    }

  it('[P2-S09-AC-694] a denied capability-grant command carries the closed denied counter and no identifier', async () => {
    const op = opFor('CMS-03A-15');
    const { harness } = await send(
      op,
      refusals.find(
        (entry) => entry.name === 'a missing step-up verification',
      ) as Refusal,
    );
    const event = harness.telemetry.mock.calls[0]?.[0] as TelemetryEvent;
    expect(event.metrics).toMatchObject({
      'cms_capability_grant_total{action="granted",outcome="denied"}': 1,
    });
  });

  it('[P2-S09-AC-694] the denial-spike inputs of the alert evaluator see the refusals (decision, assignment and capability-grant families)', async () => {
    const now = Date.parse('2026-10-03T12:00:00.000Z');
    const logged: Array<{ source: Record<string, unknown> }> = [];
    const logger = {
      info: (details: Record<string, unknown>) => {
        logged.push({
          source: {
            ...details,
            timestamp: new Date(now - 10_000).toISOString(),
          },
        });
      },
    };
    for (const operationId of FAMILY) {
      const op = opFor(operationId);
      const { harness } = await send(
        op,
        refusals.find(
          (entry) => entry.name === 'a missing step-up verification',
        ) as Refusal,
      );
      productionTelemetry(logger as never)(
        harness.telemetry.mock.calls[0]?.[0] as TelemetryEvent,
      );
    }
    const snapshot = buildContentSchemaRegistryOperationalSnapshot({
      database: {},
      events: logged,
      now,
    });
    expect(snapshot.decisionDenialRate).toBe(1);
    expect(snapshot.assignmentDenialRate).toBe(1);
    expect(snapshot.capabilityGrantDenialRate).toBe(1);
  });
});
