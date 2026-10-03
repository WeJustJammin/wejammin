/**
 * BE03a response-contract invariants for CMS-03A-10, -11, -12, -13, -14 and
 * -18: strict resources, closed enums, bounds, and identifier-free
 * projections, proven against the generated Zod schemas and OpenAPI document.
 */
import { describe, expect, it } from 'vitest';

import { buildOpenApiDocument } from '../../../../infra/openapi-document.mjs';
import { SchemaDryRunRequestSchema } from './requests.ts';
import {
  CmsCapabilityGrantListPageSchema,
  CmsCapabilityGrantResourceSchema,
  SchemaDryRunResourceSchema,
  SchemaReviewAssignmentResourceSchema,
  SchemaReviewDecisionResourceSchema,
  SchemaReviewResourceSchema,
} from './resources.ts';
import {
  approvedReview,
  assignment,
  completedPassedDryRun,
  decisionResource,
  instant,
  meta,
  openReview,
  queuedDryRun,
  uuid,
  uuid2,
} from './review-fixtures.test-support.ts';

const accepts = (schema: Parser, value: unknown): boolean =>
  schema.safeParse(value).success;
type Parser = Readonly<{ safeParse: (value: unknown) => { success: boolean } }>;

const summary = (index: number, label = `Reviewer ${index}`) => ({
  assignmentId: `123e4567-e89b-42d3-a456-4266141740${String(index).padStart(2, '0')}`,
  version: '1',
  state: 'active',
  startsAt: instant,
  endsAt: '2026-10-05T12:00:00.000Z',
  reviewerLabel: label,
});

const grant = {
  ...meta,
  resourceKind: 'cms_capability_grant',
  state: 'active',
  subjectPersonId: uuid2,
  capability: 'cms.author',
  validFrom: '2026-10-02',
  validThrough: '2026-10-08',
  endsAt: '2026-10-09T00:00:00.000Z',
  lastAction: 'granted',
  reason: null,
};

describe('BE03a CMS-03A-10 SchemaDryRunResource', () => {
  it('[P2-S09-AC-331] CMS-03A-10 SchemaDryRunResource exposes attemptId, jobId and migrationPlanId and never a caller-supplied value', () => {
    for (const key of ['attemptId', 'jobId', 'migrationPlanId']) {
      const without = { ...queuedDryRun } as Record<string, unknown>;
      delete without[key];
      expect(accepts(SchemaDryRunResourceSchema, without)).toBe(false);
      expect(
        accepts(SchemaDryRunResourceSchema, { ...queuedDryRun, [key]: 'nope' }),
      ).toBe(false);
      expect(
        accepts(SchemaDryRunRequestSchema, {
          expectedVersion: '1',
          transformKey: null,
          transformVersion: null,
          [key]: uuid,
        }),
      ).toBe(false);
    }
    expect(accepts(SchemaDryRunResourceSchema, queuedDryRun)).toBe(true);
  });

  it('[P2-S09-AC-332] CMS-03A-10 SchemaDryRunResource state is one of queued, running, completed or failed', () => {
    const sealed = completedPassedDryRun;
    const failed = {
      ...queuedDryRun,
      state: 'failed',
      failureCode: 'SCAN_ABORTED',
    };
    for (const value of [
      queuedDryRun,
      { ...queuedDryRun, state: 'running' },
      sealed,
      failed,
    ])
      expect(accepts(SchemaDryRunResourceSchema, value)).toBe(true);
    for (const state of ['cancelled', 'passed', 'pending', 'QUEUED', '', null])
      expect(
        accepts(SchemaDryRunResourceSchema, { ...queuedDryRun, state }),
      ).toBe(false);
  });

  it('[P2-S09-AC-333] CMS-03A-10 an unsealed (queued or running) resource carries null result, counts and hashes', () => {
    for (const state of ['queued', 'running'])
      expect(
        accepts(SchemaDryRunResourceSchema, { ...queuedDryRun, state }),
      ).toBe(true);
    for (const state of ['queued', 'running'])
      for (const patch of [
        { result: 'passed' },
        { sourceCount: 0 },
        { targetCount: 0 },
        { rowErrorCount: 0 },
        { sourceHash: 'a'.repeat(64) },
        { targetHash: 'a'.repeat(64) },
        { reportHash: 'a'.repeat(64) },
      ])
        expect(
          accepts(SchemaDryRunResourceSchema, {
            ...queuedDryRun,
            state,
            ...patch,
          }),
        ).toBe(false);
  });

  it('[P2-S09-AC-334] CMS-03A-10 a completed resource carries result, sourceCount, targetCount, rowErrorCount, sourceHash, targetHash and reportHash', () => {
    expect(accepts(SchemaDryRunResourceSchema, completedPassedDryRun)).toBe(
      true,
    );
    for (const key of [
      'result',
      'sourceCount',
      'targetCount',
      'rowErrorCount',
      'sourceHash',
      'targetHash',
      'reportHash',
    ])
      expect(
        accepts(SchemaDryRunResourceSchema, {
          ...completedPassedDryRun,
          [key]: null,
        }),
      ).toBe(false);
  });
});

describe('BE03a CMS-03A-11 SchemaReviewResource bounds', () => {
  it('[P2-S09-AC-374] CMS-03A-11 SchemaReviewResource exposes requiredDecisionCount between 1 and 8 and requiredCapabilities between 1 and 16 entries', () => {
    const caps = (count: number) =>
      Array.from({ length: count }, (_, index) => `cms.reviewer.c${index}`);
    for (const count of [1, 8])
      expect(
        accepts(SchemaReviewResourceSchema, {
          ...openReview,
          requiredDecisionCount: count,
        }),
      ).toBe(true);
    for (const count of [0, 9, -1, 1.5])
      expect(
        accepts(SchemaReviewResourceSchema, {
          ...openReview,
          requiredDecisionCount: count,
        }),
      ).toBe(false);
    for (const count of [1, 16])
      expect(
        accepts(SchemaReviewResourceSchema, {
          ...openReview,
          requiredCapabilities: caps(count),
        }),
      ).toBe(true);
    for (const count of [0, 17])
      expect(
        accepts(SchemaReviewResourceSchema, {
          ...openReview,
          requiredCapabilities: caps(count),
        }),
      ).toBe(false);
  });

  it('[P2-S09-AC-375] CMS-03A-11 SchemaReviewResource state is one of open, approved, rejected or invalidated', () => {
    for (const state of ['open', 'rejected', 'invalidated'])
      expect(
        accepts(SchemaReviewResourceSchema, { ...openReview, state }),
      ).toBe(true);
    // approved is the fourth member; it carries its own decision accounting.
    expect(SchemaReviewResourceSchema.parse(approvedReview).state).toBe(
      'approved',
    );
    for (const state of ['pending', 'draft', 'OPEN', '', null])
      expect(
        accepts(SchemaReviewResourceSchema, { ...openReview, state }),
      ).toBe(false);
  });
});

describe('BE03a CMS-03A-12 decision resource', () => {
  it('[P2-S09-AC-412] CMS-03A-12 SchemaReviewDecisionResource exposes only reviewId, decision, capability and decidedAt and no reviewer identifier', () => {
    expect(
      Object.keys(
        SchemaReviewDecisionResourceSchema.parse(decisionResource),
      ).sort(),
    ).toEqual([
      'capability',
      'contentHash',
      'createdAt',
      'decidedAt',
      'decision',
      'id',
      'resourceKind',
      'reviewId',
      'updatedAt',
      'version',
    ]);
    for (const leak of [
      'reviewerPersonId',
      'reviewerId',
      'actorId',
      'personId',
      'actingPartyId',
      'bindingContextHash',
    ])
      expect(
        accepts(SchemaReviewDecisionResourceSchema, {
          ...decisionResource,
          [leak]: uuid,
        }),
      ).toBe(false);
  });
});

describe('BE03a CMS-03A-13 review projection', () => {
  it('[P2-S09-AC-445] CMS-03A-13 returns only the capability-safe projection: frozen evidence summaries, required and recorded counts, decision references and permitted next actions', () => {
    const projection = SchemaReviewResourceSchema.parse(openReview);
    expect(Object.keys(projection).sort()).toEqual([
      'approvalEvidenceHash',
      'assignments',
      'contentHash',
      'contentTypeId',
      'contentTypeVersionId',
      'contentTypeVersionNo',
      'createdAt',
      'decidedAt',
      'decisions',
      'distinctApprovalCount',
      'dryRunId',
      'frozenEvidence',
      'id',
      'permittedNextActions',
      'policyHash',
      'policyKey',
      'policyVersion',
      'recordedDecisionCount',
      'requiredCapabilities',
      'requiredDecisionCount',
      'resourceKind',
      'riskClass',
      'state',
      'submittedAt',
      'updatedAt',
      'version',
    ]);
    for (const extra of [
      'evidenceRows',
      'dryRunRows',
      'reportRows',
      'definitionRows',
      'reviewerDecisions',
    ])
      expect(
        accepts(SchemaReviewResourceSchema, { ...openReview, [extra]: [] }),
      ).toBe(false);
  });

  it('[P2-S09-AC-446] CMS-03A-13 response contains no actor, person, party or private-binding identifiers and no caller-authoritative policy fields', () => {
    for (const leak of [
      'actorId',
      'personId',
      'partyId',
      'actingPartyId',
      'actingContextId',
      'bindingContextHash',
      'submitterPersonId',
      'reviewerPersonId',
      'ownerId',
      'callerPolicy',
      'callerRequiredDecisionCount',
    ])
      expect(
        accepts(SchemaReviewResourceSchema, { ...openReview, [leak]: uuid }),
      ).toBe(false);
    expect(
      accepts(SchemaReviewResourceSchema, {
        ...openReview,
        decisions: [
          {
            id: uuid,
            decision: 'approve',
            capability: 'cms.schema_review',
            decidedAt: instant,
            reviewerPersonId: uuid2,
          },
        ],
        recordedDecisionCount: 1,
      }),
    ).toBe(false);
  });

  it('[P2-S09-AC-448] CMS-03A-13 assignments is a list of at most eight safe summaries, each exactly { assignmentId, version, state active or revoked, startsAt, endsAt, reviewerLabel of 1 to 120 characters }, defaulting to [] and carrying no person, actor or party identifier', () => {
    const withoutAssignments = { ...openReview } as Record<string, unknown>;
    delete withoutAssignments.assignments;
    expect(
      SchemaReviewResourceSchema.parse(withoutAssignments).assignments,
    ).toEqual([]);
    const eight = Array.from({ length: 8 }, (_, index) => summary(index + 1));
    expect(
      accepts(SchemaReviewResourceSchema, {
        ...openReview,
        assignments: eight,
      }),
    ).toBe(true);
    expect(
      accepts(SchemaReviewResourceSchema, {
        ...openReview,
        assignments: [...eight, summary(9)],
      }),
    ).toBe(false);
    expect(Object.keys(summary(1)).sort()).toEqual([
      'assignmentId',
      'endsAt',
      'reviewerLabel',
      'startsAt',
      'state',
      'version',
    ]);
    for (const state of ['active', 'revoked'])
      expect(
        accepts(SchemaReviewResourceSchema, {
          ...openReview,
          assignments: [{ ...summary(1), state }],
        }),
      ).toBe(true);
    expect(
      accepts(SchemaReviewResourceSchema, {
        ...openReview,
        assignments: [{ ...summary(1), state: 'expired' }],
      }),
    ).toBe(false);
    for (const label of ['', 'x'.repeat(121), '   ', uuid])
      expect(
        accepts(SchemaReviewResourceSchema, {
          ...openReview,
          assignments: [summary(1, label)],
        }),
      ).toBe(false);
    expect(
      accepts(SchemaReviewResourceSchema, {
        ...openReview,
        assignments: [summary(1, 'x'.repeat(120))],
      }),
    ).toBe(true);
    for (const leak of ['reviewerPersonId', 'actorId', 'partyId', 'personId'])
      expect(
        accepts(SchemaReviewResourceSchema, {
          ...openReview,
          assignments: [{ ...summary(1), [leak]: uuid }],
        }),
      ).toBe(false);
  });
});

describe('BE03a CMS-03A-14 assignment resource', () => {
  it('[P2-S09-AC-481] CMS-03A-14 SchemaReviewAssignmentResource exposes capability as the literal cms.schema_review and actions as exactly [read, decide]', () => {
    expect(
      SchemaReviewAssignmentResourceSchema.parse(assignment).actions,
    ).toEqual(['read', 'decide']);
    expect(
      SchemaReviewAssignmentResourceSchema.parse(assignment).capability,
    ).toBe('cms.schema_review');
    for (const capability of [
      'cms.schema_designer',
      'cms.schema_review.assign',
      'cms.reviewer',
    ])
      expect(
        accepts(SchemaReviewAssignmentResourceSchema, {
          ...assignment,
          capability,
        }),
      ).toBe(false);
    for (const actions of [
      ['read'],
      ['decide', 'read'],
      ['read', 'decide', 'delegate'],
      ['read', 'read'],
      [],
    ])
      expect(
        accepts(SchemaReviewAssignmentResourceSchema, {
          ...assignment,
          actions,
        }),
      ).toBe(false);
  });

  it('[P2-S09-AC-482] CMS-03A-14 generated JSON schema pins the actions tuple with minItems and maxItems equal to 2 and additional items disallowed', () => {
    const schemas = (
      buildOpenApiDocument() as unknown as {
        components: {
          schemas: Record<
            string,
            { properties: Record<string, Record<string, unknown>> }
          >;
        };
      }
    ).components.schemas;
    const actions = schemas.SchemaReviewAssignmentResource?.properties.actions;
    expect(actions).toMatchObject({
      type: 'array',
      minItems: 2,
      maxItems: 2,
      items: false,
      prefixItems: [{ const: 'read' }, { const: 'decide' }],
    });
  });

  it('[P2-S09-AC-483] CMS-03A-14 never echoes the owner-supplied reviewerPersonId or the grantor or reviewer identity and returns only safe assignment fields', () => {
    expect(
      Object.keys(
        SchemaReviewAssignmentResourceSchema.parse(assignment),
      ).sort(),
    ).toEqual([
      'actions',
      'capability',
      'contentHash',
      'createdAt',
      'expiresAt',
      'id',
      'reason',
      'resourceKind',
      'reviewId',
      'startsAt',
      'state',
      'updatedAt',
      'version',
    ]);
    for (const leak of [
      'reviewerPersonId',
      'reviewerId',
      'grantorId',
      'grantorPersonId',
      'ownerId',
      'actorId',
      'actingPartyId',
    ])
      expect(
        accepts(SchemaReviewAssignmentResourceSchema, {
          ...assignment,
          [leak]: uuid,
        }),
      ).toBe(false);
  });
});

describe('BE03a CMS-03A-18 list page', () => {
  it('[P2-S09-AC-613] CMS-03A-18 returns at most 100 CmsCapabilityGrantResource items and a nullable nextCursor of 1 to 512 characters', () => {
    const items = (count: number) => Array.from({ length: count }, () => grant);
    for (const count of [0, 1, 100])
      expect(
        accepts(CmsCapabilityGrantListPageSchema, {
          items: items(count),
          nextCursor: null,
        }),
      ).toBe(true);
    expect(
      accepts(CmsCapabilityGrantListPageSchema, {
        items: items(101),
        nextCursor: null,
      }),
    ).toBe(false);
    for (const nextCursor of ['a', 'a'.repeat(512), 'abc_DEF-123'])
      expect(
        accepts(CmsCapabilityGrantListPageSchema, { items: [], nextCursor }),
      ).toBe(true);
    for (const nextCursor of ['', 'a'.repeat(513), 5, undefined])
      expect(
        accepts(CmsCapabilityGrantListPageSchema, { items: [], nextCursor }),
      ).toBe(false);
    expect(accepts(CmsCapabilityGrantResourceSchema, grant)).toBe(true);
  });
});
