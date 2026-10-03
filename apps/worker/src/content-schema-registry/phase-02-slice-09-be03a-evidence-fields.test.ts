/**
 * BE03a CMS-03A-09..17 request-body field evidence through the real route:
 * a rejected patch is 422 VALIDATION_FAILED with no port call, an accepted
 * patch reaches the port with the parsed body.
 */
import { describe, expect, it } from 'vitest';

import { assignmentRevoked } from './phase-02-slice-09-dec108-test-values';
import { ok } from './phase-02-slice-09-test-values';
import {
  bodyWith,
  calledPorts,
  harnessFor,
  opFor,
  requestFor,
  sendPatched as send,
  type EvidenceOperationId,
} from './phase-02-slice-09-be03a-evidence-support';

type FieldCase = Readonly<{
  marker: string;
  operationId: EvidenceOperationId;
  title: string;
  /** Body patches (undefined deletes the key) the route must refuse with 422. */
  rejected: readonly Record<string, unknown>[];
  /**
   * Body patches adding an unknown key the BE03a matrix names as a structural
   * 400 INVALID_REQUEST (CMS-03A-10: a caller-supplied count, hash,
   * classification or report, AC356).
   */
  structural?: readonly Record<string, unknown>[];
  /** Body patches the route must forward to the port unchanged. */
  accepted: readonly Record<string, unknown>[];
}>;

const NIL_PAIR = { transformKey: null, transformVersion: null };
const UUID_A = 'a3000000-0000-4000-8000-0000000000a3';

const VERSION_BAD = ['0', '01', '-1', '1.5', 'a', '', ' 1', 1, null, true];
const VERSION_OK = ['1', '9', '10', '9223372036854775807'];
const versionPatches = (values: readonly unknown[]) =>
  values.map((expectedVersion) => ({ expectedVersion }));

const CASES: readonly FieldCase[] = [
  {
    marker: '[P2-S09-AC-286]',
    operationId: 'CMS-03A-09',
    title:
      'expectedVersion is a positive decimal string matching ^[1-9][0-9]*$',
    rejected: versionPatches(VERSION_BAD),
    accepted: versionPatches(VERSION_OK),
  },
  {
    marker: '[P2-S09-AC-317]',
    operationId: 'CMS-03A-10',
    title:
      'SchemaDryRunRequest is a strict object containing only expectedVersion, transformKey and transformVersion and rejects unknown keys',
    structural: [
      { callerCounts: 1 },
      { classification: 'additive' },
      { sourceHash: 'a'.repeat(64) },
    ],
    rejected: [
      { expectedVersion: undefined },
      { transformKey: undefined },
      { transformVersion: undefined },
    ],
    accepted: [
      NIL_PAIR,
      { transformKey: 'identity.revalidate', transformVersion: '1' },
    ],
  },
  {
    marker: '[P2-S09-AC-318]',
    operationId: 'CMS-03A-10',
    title: 'expectedVersion is a positive decimal string',
    rejected: versionPatches(VERSION_BAD),
    accepted: versionPatches(VERSION_OK),
  },
  {
    marker: '[P2-S09-AC-319]',
    operationId: 'CMS-03A-10',
    title:
      'transformKey is nullable and, when present, matches the ValidatorKey grammar ^[a-z][a-z0-9._-]{0,127}$',
    rejected: [
      { transformKey: 'A.b', transformVersion: '1' },
      { transformKey: '1abc', transformVersion: '1' },
      { transformKey: '', transformVersion: '1' },
      { transformKey: `a${'b'.repeat(128)}`, transformVersion: '1' },
      { transformKey: 'a b', transformVersion: '1' },
      { transformKey: 'a/b', transformVersion: '1' },
    ],
    accepted: [
      NIL_PAIR,
      { transformKey: 'a', transformVersion: '1' },
      { transformKey: `a${'b'.repeat(127)}`, transformVersion: '1' },
      { transformKey: 'default.fill_literal-x', transformVersion: '1' },
    ],
  },
  {
    marker: '[P2-S09-AC-320]',
    operationId: 'CMS-03A-10',
    title:
      'transformVersion is nullable and, when present, is a positive decimal string',
    rejected: [
      { transformKey: 'a.b', transformVersion: '0' },
      { transformKey: 'a.b', transformVersion: '01' },
      { transformKey: 'a.b', transformVersion: 1 },
      { transformKey: 'a.b', transformVersion: '-1' },
    ],
    accepted: [NIL_PAIR, { transformKey: 'a.b', transformVersion: '12' }],
  },
  {
    marker: '[P2-S09-AC-321]',
    operationId: 'CMS-03A-10',
    title:
      'requires transformKey and transformVersion to be both null or both present',
    rejected: [
      { transformKey: 'a.b', transformVersion: null },
      { transformKey: null, transformVersion: '1' },
    ],
    accepted: [NIL_PAIR, { transformKey: 'a.b', transformVersion: '1' }],
  },
  {
    marker: '[P2-S09-AC-363]',
    operationId: 'CMS-03A-11',
    title:
      'SchemaReviewSubmissionRequest is a strict object containing only expectedVersion and dryRunId and rejects unknown keys',
    rejected: [
      { callerPolicy: 'cms.standard' },
      { requiredDecisionCount: 1 },
      { riskClass: 'ordinary' },
      { dryRunId: undefined },
      { expectedVersion: undefined },
    ],
    accepted: [{}],
  },
  {
    marker: '[P2-S09-AC-364]',
    operationId: 'CMS-03A-11',
    title: 'expectedVersion is a positive decimal string',
    rejected: versionPatches(VERSION_BAD),
    accepted: versionPatches(VERSION_OK),
  },
  {
    marker: '[P2-S09-AC-365]',
    operationId: 'CMS-03A-11',
    title: 'dryRunId is a UUID',
    rejected: [
      { dryRunId: 'not-a-uuid' },
      { dryRunId: '' },
      { dryRunId: null },
      { dryRunId: 12 },
      { dryRunId: `${UUID_A}0` },
    ],
    accepted: [{ dryRunId: UUID_A }],
  },
  {
    marker: '[P2-S09-AC-405]',
    operationId: 'CMS-03A-12',
    title:
      'SchemaReviewDecisionRequest is a strict object containing only expectedVersion and decision, so a caller-supplied reviewer identity is rejected',
    rejected: [
      { reviewerPersonId: UUID_A },
      { reviewerId: UUID_A },
      { actorId: UUID_A },
      { capability: 'cms.schema_review' },
      { decidedAt: '2026-10-02T12:00:00.000Z' },
      { decision: undefined },
      { expectedVersion: undefined },
    ],
    accepted: [{}],
  },
  {
    marker: '[P2-S09-AC-406]',
    operationId: 'CMS-03A-12',
    title: 'expectedVersion is a positive decimal string',
    rejected: versionPatches(VERSION_BAD),
    accepted: versionPatches(VERSION_OK),
  },
  {
    marker: '[P2-S09-AC-407]',
    operationId: 'CMS-03A-12',
    title: 'decision is the enum approve or reject',
    rejected: [
      { decision: 'maybe' },
      { decision: 'Approve' },
      { decision: 'approved' },
      { decision: '' },
      { decision: null },
      { decision: 1 },
    ],
    accepted: [{ decision: 'approve' }, { decision: 'reject' }],
  },
  {
    marker: '[P2-S09-AC-467]',
    operationId: 'CMS-03A-14',
    title: 'expectedVersion is a positive decimal string',
    rejected: versionPatches(VERSION_BAD),
    accepted: versionPatches(VERSION_OK),
  },
  {
    marker: '[P2-S09-AC-468]',
    operationId: 'CMS-03A-14',
    title: 'create reviewerPersonId is a UUID',
    rejected: [
      { reviewerPersonId: 'not-a-uuid' },
      { reviewerPersonId: '' },
      { reviewerPersonId: null },
      { reviewerPersonId: undefined },
      { reviewerPersonId: 7 },
    ],
    accepted: [{ reviewerPersonId: UUID_A }],
  },
  {
    marker: '[P2-S09-AC-470]',
    operationId: 'CMS-03A-14',
    title: 'create expiresAt is an ISO 8601 datetime with an offset',
    rejected: [
      { expiresAt: 'tomorrow' },
      { expiresAt: '2026-10-05' },
      { expiresAt: '2026-10-05T12:00:00' },
      { expiresAt: '2026-10-05 12:00:00Z' },
      { expiresAt: '2026-13-05T12:00:00Z' },
      { expiresAt: null },
      { expiresAt: undefined },
      { expiresAt: 1788345600 },
    ],
    accepted: [
      { expiresAt: '2026-10-05T12:00:00Z' },
      { expiresAt: '2026-10-05T12:00:00.000+02:00' },
      { expiresAt: '2026-10-05T12:00:00-07:00' },
    ],
  },
  {
    marker: '[P2-S09-AC-473]',
    operationId: 'CMS-03A-14',
    title: 'create reason is optional with 1 to 256 characters',
    rejected: [{ reason: '' }, { reason: 'x'.repeat(257) }, { reason: 5 }],
    accepted: [
      { reason: undefined },
      { reason: 'x' },
      { reason: 'x'.repeat(256) },
    ],
  },
  {
    marker: '[P2-S09-AC-476]',
    operationId: 'CMS-03A-14',
    title:
      'rejects broad scopes and delegation because the assignment is fixed to read and decide on one frozen review',
    rejected: [
      { scope: 'organization' },
      { scopes: ['cms.schema_review'] },
      { actions: ['read', 'decide', 'delegate'] },
      { capability: 'cms.schema_designer' },
      { delegable: true },
      { delegateTo: UUID_A },
      { reviewId: UUID_A },
      { action: 'delegate' },
      { action: 'CREATE' },
    ],
    accepted: [{}],
  },
];

const REVOKE_BASE = {
  action: 'revoke',
  expectedVersion: '1',
  assignmentId: 'a2000000-0000-4000-8000-0000000000a2',
};

describe('BE03a request-body field rules through the route', () => {
  it.each(CASES)(
    '$marker $operationId $title',
    async ({ operationId, rejected, accepted, structural = [] }) => {
      for (const patch of structural) {
        const { harness, response } = await send(operationId, patch);
        expect(
          response.status,
          `${operationId} must refuse ${JSON.stringify(patch)} as a structural 400`,
        ).toBe(400);
        const body = (await response.json()) as Record<string, unknown>;
        expect(body.code).toBe('INVALID_REQUEST');
        expect(calledPorts(harness.ports)).toBe(0);
      }
      for (const patch of rejected) {
        const { op, harness, response } = await send(operationId, patch);
        expect(
          response.status,
          `${operationId} must refuse ${JSON.stringify(patch)}`,
        ).toBe(422);
        const body = (await response.json()) as Record<string, unknown>;
        expect(body.code).toBe('VALIDATION_FAILED');
        expect(calledPorts(harness.ports)).toBe(0);
        expect(op.operationId).toBe(operationId);
      }
      for (const patch of accepted) {
        const { op, harness, body, response } = await send(operationId, patch);
        expect(
          response.status,
          `${operationId} must accept ${JSON.stringify(patch)}`,
        ).toBe(op.status);
        expect(harness.ports[op.portName]).toHaveBeenCalledWith(
          expect.objectContaining({ body }),
          expect.any(AbortSignal),
        );
      }
    },
  );

  it('[P2-S09-AC-466] CMS-03A-14 SchemaReviewAssignmentRequest is a strict discriminated union on action with the literals create and revoke and rejects unknown keys and any other action', async () => {
    const op = opFor('CMS-03A-14');
    for (const body of [
      { ...op.body, extra: 1 },
      { ...REVOKE_BASE, reviewerPersonId: UUID_A },
      { ...REVOKE_BASE, expiresAt: '2026-10-05T12:00:00Z' },
      { ...op.body, assignmentId: REVOKE_BASE.assignmentId },
      { ...op.body, action: 'assign' },
      { ...op.body, action: undefined },
      { expectedVersion: '1' },
    ]) {
      const harness = harnessFor(op);
      const response = await harness.app.request(requestFor(op, { body }));
      expect(response.status).toBe(422);
      expect(calledPorts(harness.ports)).toBe(0);
    }
    // BE03a CMS-03A-14: "201/200": a created assignment is 201 and a revoked
    // one (the resource state names it) is 200.
    for (const [body, status, answer] of [
      [op.body, 201, undefined],
      [REVOKE_BASE, 200, assignmentRevoked],
    ] as const) {
      const harness = harnessFor(op);
      if (answer !== undefined)
        harness.ports[op.portName]?.mockResolvedValueOnce(ok(answer));
      const response = await harness.app.request(requestFor(op, { body }));
      expect(response.status).toBe(status);
      expect(harness.ports[op.portName]).toHaveBeenCalledTimes(1);
    }
  });

  it('[P2-S09-AC-475] CMS-03A-14 revoke reason is optional with 1 to 256 characters', async () => {
    const op = opFor('CMS-03A-14');
    for (const reason of ['', 'x'.repeat(257), 3]) {
      const harness = harnessFor(op);
      const response = await harness.app.request(
        requestFor(op, { body: { ...REVOKE_BASE, reason } }),
      );
      expect(response.status).toBe(422);
      expect(calledPorts(harness.ports)).toBe(0);
    }
    for (const reason of [undefined, 'x', 'x'.repeat(256)]) {
      const harness = harnessFor(op);
      const body = bodyWith(REVOKE_BASE, { reason });
      const response = await harness.app.request(requestFor(op, { body }));
      expect(response.status).toBe(201);
      expect(harness.ports[op.portName]).toHaveBeenCalledWith(
        expect.objectContaining({ body }),
        expect.any(AbortSignal),
      );
    }
  });
});
