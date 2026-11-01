import { describe, expect, it } from 'vitest';

import {
  EntryWorkflowApiRequestSchema,
  EntryWorkflowPathParamsSchema,
  EntryWorkflowPreparationSchema,
  EntryWorkflowPublicationSchema,
  EntryWorkflowQuerySchema,
  EntryWorkflowResourceSchema,
  EntryWorkflowRevisionSchema,
  EntryWorkflowScheduleSchema,
  WorkflowNextActionSchema,
} from './index';
import {
  hash2,
  uid,
  uuid,
  uuid2,
  uuid3,
  validFrozenCandidate,
  validPreflightReport,
  validReview,
  validWorkflowPreparation,
  validWorkflowPublication,
  validWorkflowResource,
  validWorkflowRevision,
  validWorkflowSchedule,
  without,
} from './workflow-fixtures.test-support';

type Parser = { safeParse: (value: unknown) => { success: boolean } };
const refused = (schema: Parser, value: unknown): boolean =>
  !schema.safeParse(value).success;

const withReview = (overrides: Record<string, unknown> = {}) => ({
  ...validWorkflowResource,
  preparation: null,
  revision: {
    ...validWorkflowRevision,
    state: 'submitted',
    isCurrentDraft: false,
  },
  review: { ...validReview, ...overrides, frozen: validFrozenCandidate },
  permittedNextActions: ['assign_reviewer'],
});

describe('[P2-S11-AC-049][P2-S11-AC-050] CMS-03B-15 request contracts', () => {
  it('takes a UUID entryId path and an optional UUID revisionId, with no other key', () => {
    expect(EntryWorkflowPathParamsSchema.parse({ entryId: uuid })).toEqual({
      entryId: uuid,
    });
    expect(EntryWorkflowQuerySchema.parse({ entryId: uuid })).toEqual({
      entryId: uuid,
    });
    expect(
      EntryWorkflowQuerySchema.parse({ entryId: uuid, revisionId: uuid2 })
        .revisionId,
    ).toBe(uuid2);
    expect(
      refused(EntryWorkflowQuerySchema, { entryId: uuid, revisionId: 'x' }),
    ).toBe(true);
    expect(
      refused(EntryWorkflowQuerySchema, { entryId: uuid, locale: 'en' }),
    ).toBe(true);
    expect(refused(EntryWorkflowQuerySchema, { revisionId: uuid2 })).toBe(true);
    expect(
      refused(EntryWorkflowPathParamsSchema, { entryId: uuid, extra: 1 }),
    ).toBe(true);
    expect(refused(EntryWorkflowPathParamsSchema, { entryId: 'x' })).toBe(true);
  });

  it('declares the OpenAPI transport view with the path and the only query member', () => {
    expect(
      EntryWorkflowApiRequestSchema.parse({ entryId: uuid, query: {} }),
    ).toEqual({ entryId: uuid, query: {} });
    expect(
      EntryWorkflowApiRequestSchema.parse({
        entryId: uuid,
        query: { revisionId: uuid2 },
      }).query.revisionId,
    ).toBe(uuid2);
    expect(
      refused(EntryWorkflowApiRequestSchema, {
        entryId: uuid,
        query: { revisionId: uuid2, cursor: 'x' },
      }),
    ).toBe(true);
    expect(
      refused(EntryWorkflowApiRequestSchema, {
        entryId: uuid,
        query: {},
        headers: {},
      }),
    ).toBe(true);
    expect(
      refused(EntryWorkflowApiRequestSchema, {
        entryId: uuid,
        query: {},
        body: {},
      }),
    ).toBe(true);
  });
});

describe('[P2-S11-AC-049] EntryWorkflowResource shape', () => {
  it('accepts a submittable draft with its preparation and no review', () => {
    expect(EntryWorkflowResourceSchema.parse(validWorkflowResource)).toEqual(
      validWorkflowResource,
    );
  });

  it('accepts a revision under review with its frozen candidate and no preparation', () => {
    const resource = withReview();
    expect(EntryWorkflowResourceSchema.parse(resource)).toEqual(resource);
  });

  it('rejects unknown keys and every missing member, including ownership identifiers', () => {
    for (const key of [
      'ownerId',
      'ownerPartyId',
      'assigneePersonId',
      'actingPartyId',
      'extra',
    ])
      expect(
        refused(EntryWorkflowResourceSchema, {
          ...validWorkflowResource,
          [key]: uuid,
        }),
        key,
      ).toBe(true);
    for (const key of Object.keys(validWorkflowResource)) {
      const rest = without(
        validWorkflowResource,
        key as keyof typeof validWorkflowResource,
      );
      expect(refused(EntryWorkflowResourceSchema, rest), key).toBe(true);
    }
    expect(
      refused(EntryWorkflowRevisionSchema, {
        ...validWorkflowRevision,
        ownerId: uuid,
      }),
    ).toBe(true);
  });

  it('derives the revision state from the closed EntryRevisionState vocabulary', () => {
    for (const state of [
      'draft',
      'submitted',
      'approved',
      'rejected',
      'scheduled',
      'published',
    ])
      expect(
        EntryWorkflowRevisionSchema.safeParse({
          ...validWorkflowRevision,
          state,
        }).success,
        state,
      ).toBe(true);
    expect(
      refused(EntryWorkflowRevisionSchema, {
        ...validWorkflowRevision,
        state: 'open',
      }),
    ).toBe(true);
    expect(
      refused(EntryWorkflowRevisionSchema, {
        ...validWorkflowRevision,
        validationState: 'maybe',
      }),
    ).toBe(true);
    expect(
      refused(EntryWorkflowRevisionSchema, {
        ...validWorkflowRevision,
        revisionNumber: '0',
      }),
    ).toBe(true);
    expect(
      refused(EntryWorkflowRevisionSchema, {
        ...validWorkflowRevision,
        locale: 'x',
      }),
    ).toBe(true);
    expect(
      refused(EntryWorkflowRevisionSchema, {
        ...validWorkflowRevision,
        isCurrentDraft: 'yes',
      }),
    ).toBe(true);
  });

  it('keeps entry.version as the If-Match operand of CMS-03B-05 and CMS-03B-08', () => {
    expect(
      refused(EntryWorkflowResourceSchema, {
        ...validWorkflowResource,
        entry: { ...validWorkflowResource.entry, version: '0' },
      }),
    ).toBe(true);
    expect(
      refused(EntryWorkflowResourceSchema, {
        ...validWorkflowResource,
        entry: { ...validWorkflowResource.entry, ownerId: uuid },
      }),
    ).toBe(true);
  });
});

describe('[P2-S11-AC-050] EntryWorkflowResource response-contract bounds (422 on breach)', () => {
  it('serves a preparation only for a submittable current draft', () => {
    for (const state of [
      'submitted',
      'approved',
      'rejected',
      'scheduled',
      'published',
    ])
      expect(
        refused(EntryWorkflowResourceSchema, {
          ...validWorkflowResource,
          revision: { ...validWorkflowRevision, state },
        }),
        state,
      ).toBe(true);
    expect(
      refused(EntryWorkflowResourceSchema, {
        ...validWorkflowResource,
        revision: { ...validWorkflowRevision, isCurrentDraft: false },
      }),
    ).toBe(true);
    expect(
      EntryWorkflowResourceSchema.safeParse({
        ...validWorkflowResource,
        preparation: null,
        revision: {
          ...validWorkflowRevision,
          state: 'published',
          isCurrentDraft: false,
        },
      }).success,
    ).toBe(true);
  });

  it('binds the preparation to the served revision, manifest and policy', () => {
    expect(
      refused(EntryWorkflowResourceSchema, {
        ...validWorkflowResource,
        preparation: { ...validWorkflowPreparation, frozenHash: hash2 },
      }),
    ).toBe(true);
    expect(
      refused(EntryWorkflowPreparationSchema, {
        ...validWorkflowPreparation,
        riskClass: 'protected',
      }),
    ).toBe(true);
    expect(
      refused(EntryWorkflowPreparationSchema, {
        ...validWorkflowPreparation,
        workflowPolicy: {
          ...validWorkflowPreparation.workflowPolicy,
          key: 'other.policy',
        },
      }),
    ).toBe(true);
    expect(
      refused(EntryWorkflowPreparationSchema, {
        ...validWorkflowPreparation,
        versionSet: {
          ...validWorkflowPreparation.versionSet,
          schemaHash: hash2,
        },
      }),
    ).toBe(true);
    expect(
      refused(EntryWorkflowPreparationSchema, {
        ...validWorkflowPreparation,
        dependencyHash: 'x',
      }),
    ).toBe(true);
    expect(
      refused(EntryWorkflowPreparationSchema, {
        ...validWorkflowPreparation,
        ownerId: uuid,
      }),
    ).toBe(true);
  });

  it('holds the locked Slice 10 manifest and version-set contracts', () => {
    const noChecker = without(
      validWorkflowPreparation.dependencyManifest,
      'checker',
    );
    expect(
      refused(EntryWorkflowPreparationSchema, {
        ...validWorkflowPreparation,
        dependencyManifest: noChecker,
      }),
    ).toBe(true);
    expect(
      refused(EntryWorkflowPreparationSchema, {
        ...validWorkflowPreparation,
        dependencyManifest: {
          ...validWorkflowPreparation.dependencyManifest,
          extra: 1,
        },
      }),
    ).toBe(true);
    const noSettings = without(
      validWorkflowPreparation.versionSet,
      'settingsVersion',
    );
    expect(
      refused(EntryWorkflowPreparationSchema, {
        ...validWorkflowPreparation,
        versionSet: noSettings,
      }),
    ).toBe(true);
  });

  it('carries exactly seventeen preflight results and tolerates an unavailable provider inside the report', () => {
    expect(
      EntryWorkflowPreparationSchema.safeParse(validWorkflowPreparation)
        .success,
    ).toBe(true);
    expect(
      refused(EntryWorkflowPreparationSchema, {
        ...validWorkflowPreparation,
        preflight: {
          ...validPreflightReport,
          results: validPreflightReport.results.slice(0, 16),
        },
      }),
    ).toBe(true);
    const unavailable = {
      ...validPreflightReport,
      passed: false,
      results: validPreflightReport.results.map((result) =>
        result.category === 'accessibility'
          ? { ...result, outcome: 'unavailable', reasonCode: 'checker_failed' }
          : result,
      ),
    };
    expect(
      EntryWorkflowPreparationSchema.safeParse({
        ...validWorkflowPreparation,
        preflight: unavailable,
      }).success,
    ).toBe(true);
  });

  it('bounds schedules at 16, publications at 64 and next actions at 6 unique closed members', () => {
    const schedules = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        ...validWorkflowSchedule,
        id: uid(100 + index),
      }));
    const publications = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        ...validWorkflowPublication,
        publicationVersionId: uid(300 + index),
        version: String(index + 1),
      }));
    expect(
      EntryWorkflowResourceSchema.safeParse({
        ...validWorkflowResource,
        schedules: schedules(16),
      }).success,
    ).toBe(true);
    expect(
      refused(EntryWorkflowResourceSchema, {
        ...validWorkflowResource,
        schedules: schedules(17),
      }),
    ).toBe(true);
    expect(
      EntryWorkflowResourceSchema.safeParse({
        ...validWorkflowResource,
        publications: publications(64),
      }).success,
    ).toBe(true);
    expect(
      refused(EntryWorkflowResourceSchema, {
        ...validWorkflowResource,
        publications: publications(65),
      }),
    ).toBe(true);
    expect(WorkflowNextActionSchema.options).toEqual([
      'submit_review',
      'assign_reviewer',
      'record_decision',
      'schedule',
      'preview',
      'publish',
    ]);
    expect(
      EntryWorkflowResourceSchema.safeParse({
        ...validWorkflowResource,
        permittedNextActions: [...WorkflowNextActionSchema.options],
      }).success,
    ).toBe(true);
    expect(
      refused(EntryWorkflowResourceSchema, {
        ...validWorkflowResource,
        permittedNextActions: ['submit_review', 'submit_review'],
      }),
    ).toBe(true);
    expect(
      refused(EntryWorkflowResourceSchema, {
        ...validWorkflowResource,
        permittedNextActions: ['delete'],
      }),
    ).toBe(true);
  });

  it('keeps schedule and publication summaries free of authority and token material', () => {
    expect(EntryWorkflowScheduleSchema.parse(validWorkflowSchedule)).toEqual(
      validWorkflowSchedule,
    );
    expect(
      EntryWorkflowPublicationSchema.parse(validWorkflowPublication),
    ).toEqual(validWorkflowPublication);
    expect(
      refused(EntryWorkflowScheduleSchema, {
        ...validWorkflowSchedule,
        createdBy: uuid,
      }),
    ).toBe(true);
    expect(
      refused(EntryWorkflowScheduleSchema, {
        ...validWorkflowSchedule,
        state: 'queued',
      }),
    ).toBe(true);
    expect(
      refused(EntryWorkflowScheduleSchema, {
        ...validWorkflowSchedule,
        reasonCode: 'invented',
      }),
    ).toBe(true);
    expect(
      refused(EntryWorkflowScheduleSchema, {
        ...validWorkflowSchedule,
        state: 'blocked',
        reasonCode: null,
      }),
    ).toBe(true);
    expect(
      refused(EntryWorkflowScheduleSchema, {
        ...validWorkflowSchedule,
        reasonCode: 'preflight_failed',
      }),
    ).toBe(true);
    expect(
      refused(EntryWorkflowPublicationSchema, {
        ...validWorkflowPublication,
        token: 'x',
      }),
    ).toBe(true);
    expect(
      refused(EntryWorkflowPublicationSchema, {
        ...validWorkflowPublication,
        state: 'pending',
      }),
    ).toBe(true);
    expect(
      refused(EntryWorkflowPublicationSchema, {
        ...validWorkflowPublication,
        action: 'unpublish',
        state: 'active',
      }),
    ).toBe(true);
    expect(
      refused(EntryWorkflowPublicationSchema, {
        ...validWorkflowPublication,
        projectionState: 'failed',
      }),
    ).toBe(true);
  });

  it('applies the review invariants to the embedded latest review and binds it to the served revision', () => {
    const resource = withReview();
    expect(EntryWorkflowResourceSchema.safeParse(resource).success).toBe(true);
    expect(
      refused(
        EntryWorkflowResourceSchema,
        withReview({ state: 'invalidated' }),
      ),
    ).toBe(true);
    expect(
      refused(
        EntryWorkflowResourceSchema,
        withReview({ recordedDecisionCount: 2 }),
      ),
    ).toBe(true);
    expect(
      refused(EntryWorkflowResourceSchema, withReview({ revisionId: uuid })),
    ).toBe(true);
    expect(
      refused(EntryWorkflowResourceSchema, withReview({ entryId: uuid })),
    ).toBe(true);
    expect(
      refused(EntryWorkflowResourceSchema, {
        ...resource,
        review: { ...resource.review, frozen: undefined },
      }),
    ).toBe(true);
    expect(
      refused(EntryWorkflowResourceSchema, {
        ...resource,
        review: {
          ...resource.review,
          frozen: { ...validFrozenCandidate, versionSet: {} },
        },
      }),
    ).toBe(true);
    expect(
      refused(EntryWorkflowResourceSchema, {
        ...resource,
        review: { ...resource.review, submittedBy: uuid },
      }),
    ).toBe(true);
    // The frozen candidate restates the review's own hashes, so the two must agree.
    expect(
      refused(EntryWorkflowResourceSchema, {
        ...resource,
        review: {
          ...resource.review,
          frozen: { ...validFrozenCandidate, frozenHash: hash2 },
        },
      }),
    ).toBe(true);
    expect(
      refused(EntryWorkflowResourceSchema, {
        ...resource,
        review: {
          ...resource.review,
          frozen: {
            ...validFrozenCandidate,
            dependencyHash: validFrozenCandidate.frozenHash,
          },
        },
      }),
    ).toBe(true);
    expect(uuid3).toBe(resource.review.revisionId);
  });
});
