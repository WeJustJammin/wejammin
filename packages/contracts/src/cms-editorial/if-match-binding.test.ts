import { describe, expect, it } from 'vitest';

import {
  CMS_IF_MATCH_EXPECTED_VERSION_MISMATCH,
  ConflictResolutionApiRequestSchema,
  EditorialDecisionApiRequestSchema,
  EditorialReviewAssignmentApiRequestSchema,
  EntryRevisionApiRequestSchema,
  PreviewApiRequestSchema,
  PublicationApiRequestSchema,
  PublicationScheduleApiRequestSchema,
  ReviewSubmissionApiRequestSchema,
  RevisionRestoreApiRequestSchema,
} from './index';
import {
  uuid,
  uuid2,
  uuid3,
  validAssignmentCreate,
  validAssignmentRevoke,
  validDecision,
  validPreview,
  validPublication,
  validReviewSubmission,
  validSchedule,
} from './workflow-fixtures.test-support';

/*
 * BE03b If-Match operands (single definition): "Wherever a body carries
 * expectedVersion, the strong If-Match must equal it exactly (a mismatch is 400
 * INVALID_REQUEST) and both name the same operand." Every composite transport
 * schema whose body carries expectedVersion enforces that equality itself, so a
 * generated client or a contract consumer cannot hold a value the runtime
 * refuses.
 */

type Schema = {
  safeParse: (value: unknown) =>
    | { success: true }
    | {
        success: false;
        error: {
          issues: readonly {
            path: readonly PropertyKey[];
            message: string;
          }[];
        };
      };
};

const headersFor = (ifMatch: string) => ({
  contentType: 'application/json',
  idempotencyKey: 'idem-key-0001',
  ifMatch,
});

const entryRevisionBody = {
  entryId: uuid,
  baseRevision: '3',
  changedPaths: [`/fields/${uuid2}`],
  values: { [uuid2]: 'text' },
  locale: 'en-US',
  expectedVersion: '3',
} as const;

const conflictResolutionBody = {
  entryId: uuid,
  conflictId: uuid2,
  baseRevision: '3',
  choices: [{ path: `/fields/${uuid3}`, choice: 'theirs' }],
  expectedVersion: '3',
} as const;

const revisionRestoreBody = {
  entryId: uuid,
  revisionId: uuid2,
  migrationChainId: uuid3,
  expectedVersion: '3',
} as const;

interface Case {
  readonly name: string;
  readonly schema: Schema;
  readonly build: (ifMatch: string, expectedVersion: string) => unknown;
}

const withVersion = <T extends { expectedVersion: string }>(
  body: T,
  expectedVersion: string,
): T => ({ ...body, expectedVersion });

const cases: readonly Case[] = [
  {
    name: 'CMS-03B-01 EntryRevisionApiRequest',
    schema: EntryRevisionApiRequestSchema,
    build: (ifMatch, expectedVersion) => ({
      entryId: uuid,
      headers: headersFor(ifMatch),
      body: withVersion(entryRevisionBody, expectedVersion),
    }),
  },
  {
    name: 'CMS-03B-02 ConflictResolutionApiRequest',
    schema: ConflictResolutionApiRequestSchema,
    build: (ifMatch, expectedVersion) => ({
      entryId: uuid,
      conflictId: uuid2,
      headers: headersFor(ifMatch),
      body: withVersion(conflictResolutionBody, expectedVersion),
    }),
  },
  {
    name: 'CMS-03B-04 RevisionRestoreApiRequest',
    schema: RevisionRestoreApiRequestSchema,
    build: (ifMatch, expectedVersion) => ({
      entryId: uuid,
      revisionId: uuid2,
      headers: headersFor(ifMatch),
      body: withVersion(revisionRestoreBody, expectedVersion),
    }),
  },
  {
    name: 'CMS-03B-06 EditorialDecisionApiRequest',
    schema: EditorialDecisionApiRequestSchema,
    build: (ifMatch, expectedVersion) => ({
      reviewId: uuid2,
      headers: headersFor(ifMatch),
      body: withVersion(validDecision, expectedVersion),
    }),
  },
  {
    name: 'CMS-03B-07 PublicationScheduleApiRequest',
    schema: PublicationScheduleApiRequestSchema,
    build: (ifMatch, expectedVersion) => ({
      headers: headersFor(ifMatch),
      body: withVersion(validSchedule, expectedVersion),
    }),
  },
  {
    name: 'CMS-03B-09 PublicationApiRequest',
    schema: PublicationApiRequestSchema,
    build: (ifMatch, expectedVersion) => ({
      headers: headersFor(ifMatch),
      body: withVersion(validPublication, expectedVersion),
    }),
  },
  {
    name: 'CMS-03B-18 EditorialReviewAssignmentApiRequest (create)',
    schema: EditorialReviewAssignmentApiRequestSchema,
    build: (ifMatch, expectedVersion) => ({
      reviewId: uuid,
      headers: headersFor(ifMatch),
      body: withVersion(validAssignmentCreate, expectedVersion),
    }),
  },
  {
    name: 'CMS-03B-18 EditorialReviewAssignmentApiRequest (revoke)',
    schema: EditorialReviewAssignmentApiRequestSchema,
    build: (ifMatch, expectedVersion) => ({
      reviewId: uuid,
      headers: headersFor(ifMatch),
      body: withVersion(validAssignmentRevoke, expectedVersion),
    }),
  },
];

const issuesOf = (schema: Schema, value: unknown) => {
  const result = schema.safeParse(value);
  return result.success
    ? null
    : result.error.issues.map(({ path, message }) => ({ path, message }));
};

describe('[P2-S11-AC-011][P2-S11-AC-017][P2-S11-AC-029][P2-S11-AC-067] a composite transport schema binds the strong If-Match to the body expectedVersion', () => {
  for (const { name, schema, build } of cases) {
    it(`${name} accepts an If-Match equal to expectedVersion`, () => {
      expect(schema.safeParse(build('"3"', '3')).success).toBe(true);
      expect(
        schema.safeParse(build('"9223372036854775807"', '9223372036854775807'))
          .success,
      ).toBe(true);
    });

    it(`${name} refuses an If-Match that differs from expectedVersion, naming only the header`, () => {
      for (const [ifMatch, expectedVersion] of [
        ['"3"', '4'],
        ['"4"', '3'],
        ['"10"', '1'],
      ] as const)
        expect(
          issuesOf(schema, build(ifMatch, expectedVersion)),
          `${ifMatch} vs ${expectedVersion}`,
        ).toEqual([
          {
            path: ['headers', 'ifMatch'],
            message: CMS_IF_MATCH_EXPECTED_VERSION_MISMATCH,
          },
        ]);
    });

    it(`${name} reports a malformed If-Match once, without a second equality issue`, () => {
      for (const ifMatch of ['3', 'W/"3"', '*', '"03"', '"0"', '']) {
        const issues = issuesOf(schema, build(ifMatch, '3'));
        expect(issues, ifMatch).not.toBeNull();
        expect(
          issues?.some(
            ({ message }) => message === CMS_IF_MATCH_EXPECTED_VERSION_MISMATCH,
          ),
          ifMatch,
        ).toBe(false);
      }
    });
  }

  it('exposes one message token for the mismatch', () => {
    expect(CMS_IF_MATCH_EXPECTED_VERSION_MISMATCH).toBe(
      'if_match_must_equal_expected_version',
    );
  });

  it('leaves the two commands whose body has no expectedVersion unconstrained', () => {
    // CMS-03B-05 and CMS-03B-08 carry the entry version only in If-Match.
    for (const ifMatch of ['"1"', '"3"', '"99"']) {
      expect(
        ReviewSubmissionApiRequestSchema.safeParse({
          entryId: uuid,
          headers: headersFor(ifMatch),
          body: validReviewSubmission,
        }).success,
      ).toBe(true);
      expect(
        PreviewApiRequestSchema.safeParse({
          headers: headersFor(ifMatch),
          body: validPreview,
        }).success,
      ).toBe(true);
    }
  });
});
