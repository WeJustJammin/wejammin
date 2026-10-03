// @vitest-environment jsdom

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  SchemaReviewAssignmentResourceSchema,
  SchemaReviewDecisionResourceSchema,
  SchemaReviewResourceSchema,
} from '@wejammin/contracts';

import {
  WorkbenchUnderTest,
  reviewPageProps,
} from './content-schema-review-dec108-render.test-support';
import {
  altFor,
  getPath,
  hash,
  leafPaths,
  uuid,
  withPaths,
} from './content-schema-registry-s09-r4-mapping.test-support';

/**
 * FE03 CMS-03A-13 / CMS-03A-11 / CMS-03A-12 / CMS-03A-14 response mapping: every
 * member of the schema review resource, its frozen evidence, decision
 * references and owner-only assignment summaries reaches the review route.
 */

const instant = (n: number) => `2026-0${n}-0${n}T0${n}:0${n}:0${n}.00${n}Z`;

const sentinel = () =>
  SchemaReviewResourceSchema.parse({
    id: uuid(300),
    version: '301',
    contentHash: hash(302),
    createdAt: instant(3),
    updatedAt: instant(4),
    resourceKind: 'schema_review',
    state: 'approved',
    contentTypeId: uuid(303),
    contentTypeVersionId: uuid(304),
    contentTypeVersionNo: '305',
    riskClass: 'protected',
    requiredDecisionCount: 2,
    requiredCapabilities: ['cms.schema_review', 'cms.reviewer.legal'],
    distinctApprovalCount: 2,
    recordedDecisionCount: 2,
    frozenEvidence: {
      contentTypeVersionId: uuid(304),
      contentTypeVersionNo: '305',
      definitionHash: hash(306),
      localeConfigHash: hash(307),
      schemaArtifact: {
        id: uuid(308),
        state: 'compiled',
        compilerVersion: 'compiler-sentinel',
        zodContractRef: 'cms/sentinel/v3',
        artifactHash: hash(309),
      },
      dependencyManifestHash: hash(310),
      dryRun: {
        id: uuid(311),
        state: 'completed',
        result: 'passed',
        reportHash: hash(312),
      },
    },
    dryRunId: uuid(311),
    policyKey: 'cms.sentinel.policy',
    policyVersion: '313',
    policyHash: hash(314),
    approvalEvidenceHash: hash(315),
    submittedAt: instant(5),
    decidedAt: instant(6),
    decisions: [
      {
        id: uuid(320),
        decision: 'approve',
        capability: 'cms.schema_review',
        decidedAt: instant(7),
      },
      {
        id: uuid(321),
        decision: 'approve',
        capability: 'cms.reviewer.legal',
        decidedAt: instant(8),
      },
    ],
    assignments: [
      {
        assignmentId: uuid(330),
        version: '331',
        state: 'active',
        startsAt: '2026-10-02T12:00:00.000Z',
        endsAt: '2026-10-05T12:00:00.000Z',
        reviewerLabel: 'Sentinel Reviewer',
      },
    ],
    permittedNextActions: ['assign_reviewer'],
  });

const base = sentinel();

/** An open review: counts, decision mix and the owner assignment members vary freely. */
const open = () =>
  SchemaReviewResourceSchema.parse({
    ...sentinel(),
    state: 'open',
    approvalEvidenceHash: null,
    decidedAt: null,
    distinctApprovalCount: 1,
    recordedDecisionCount: 2,
    decisions: [
      {
        id: uuid(320),
        decision: 'approve',
        capability: 'cms.schema_review',
        decidedAt: instant(7),
      },
      {
        id: uuid(321),
        decision: 'reject',
        capability: 'cms.reviewer.legal',
        decidedAt: instant(8),
      },
    ],
  });
const openBase = open();

type Review = z.infer<typeof SchemaReviewResourceSchema>;

const render = (review: Review): string =>
  renderToStaticMarkup(
    React.createElement(
      WorkbenchUnderTest,
      reviewPageProps(review, { variant: 'ownerFull', access: 'full' }),
    ),
  );

/** Paired members are refined to stay equal, so they change together. */
const APPROVED_CHANGES: Readonly<Record<string, Record<string, unknown>>> = {
  state: { state: 'invalidated', approvalEvidenceHash: null, decidedAt: null },
  riskClass: {
    riskClass: 'ordinary',
    requiredDecisionCount: 1,
    requiredCapabilities: ['cms.schema_review'],
    distinctApprovalCount: 1,
    recordedDecisionCount: 1,
    decisions: [
      {
        id: uuid(320),
        decision: 'approve',
        capability: 'cms.schema_review',
        decidedAt: instant(7),
      },
    ],
  },
  requiredCapabilities: {
    requiredCapabilities: ['cms.schema_review', 'cms.reviewer.security'],
  },
  contentTypeVersionId: {
    contentTypeVersionId: uuid(840),
    'frozenEvidence.contentTypeVersionId': uuid(840),
  },
  contentTypeVersionNo: {
    contentTypeVersionNo: '999',
    'frozenEvidence.contentTypeVersionNo': '999',
  },
  dryRunId: { dryRunId: uuid(841), 'frozenEvidence.dryRun.id': uuid(841) },
};

const OPEN_CHANGES: Readonly<Record<string, Record<string, unknown>>> = {
  requiredDecisionCount: { requiredDecisionCount: 3 },
  distinctApprovalCount: { distinctApprovalCount: 0 },
  recordedDecisionCount: {
    recordedDecisionCount: 3,
    decisions: [
      ...openBase.decisions,
      {
        id: uuid(322),
        decision: 'approve',
        capability: 'cms.schema_review',
        decidedAt: instant(9),
      },
    ],
  },
  'decisions.0.decision': {
    'decisions.0.decision': 'reject',
    distinctApprovalCount: 0,
  },
  'decisions.1.decision': { 'decisions.1.decision': 'approve' },
  'decisions.0.capability': {
    'decisions.0.capability': 'cms.reviewer.security',
  },
  'assignments.0.startsAt': {
    'assignments.0.startsAt': '2026-10-02T13:00:00.000Z',
  },
  'assignments.0.endsAt': {
    'assignments.0.endsAt': '2026-10-04T12:00:00.000Z',
  },
  'assignments.0.state': { 'assignments.0.state': 'revoked' },
  permittedNextActions: { permittedNextActions: [] },
};

/** Members asserted by their one generated value, not by a different one. */
const CONSTANT_TEXT: Readonly<Record<string, string>> = {
  resourceKind: '',
  'frozenEvidence.schemaArtifact.state': 'compiled',
  'frozenEvidence.dryRun.state': 'Sealed dry run</dt><dd>passed',
  'frozenEvidence.dryRun.result': 'Sealed dry run</dt><dd>passed',
  'frozenEvidence.dryRun.id': 'Sealed dry run ID',
  'frozenEvidence.contentTypeVersionNo': 'Candidate version</dt>',
  'frozenEvidence.contentTypeVersionId': 'Frozen candidate version ID',
  'decisions.0.decision': 'approve',
  'decisions.1.decision': 'approve',
};

const isOpenPath = (path: string): boolean =>
  path.startsWith('assignments.') ||
  path in OPEN_CHANGES ||
  path === 'decisions.0.capability';

const approvedLeaves = leafPaths(base).filter(
  (path) => !isOpenPath(path) && !(path in CONSTANT_TEXT),
);
const openLeaves = leafPaths(openBase).filter(
  (path) =>
    isOpenPath(path) && !(path in CONSTANT_TEXT && !(path in OPEN_CHANGES)),
);

describe('review resource field mapping', () => {
  it('[P2-S09-AC-259] the fixture carries every key of the generated review contract', () => {
    const json = z.toJSONSchema(SchemaReviewResourceSchema, {
      io: 'input',
      unrepresentable: 'any',
    }) as { properties: Record<string, unknown> };
    expect(Object.keys(base).sort()).toStrictEqual(
      Object.keys(json.properties).sort(),
    );
    const decision = z.toJSONSchema(SchemaReviewDecisionResourceSchema, {
      io: 'input',
      unrepresentable: 'any',
    }) as { properties: Record<string, unknown> };
    for (const key of Object.keys(base.decisions[0] as object))
      expect(Object.keys(decision.properties)).toContain(key);
    expect(
      Object.keys(
        (
          z.toJSONSchema(SchemaReviewAssignmentResourceSchema, {
            io: 'input',
            unrepresentable: 'any',
          }) as { properties: Record<string, unknown> }
        ).properties,
      ),
    ).toContain('actions');
  });

  it.each(approvedLeaves)(
    '[P2-S09-AC-259] [P2-S09-AC-264] %s changes the rendered approved review',
    (path) => {
      const changes = APPROVED_CHANGES[path] ?? {
        [path]: altFor(
          path,
          getPath(base, path),
          leafPaths(base).indexOf(path) + 1,
        ),
      };
      expect(
        render(SchemaReviewResourceSchema.parse(withPaths(base, changes))),
        path,
      ).not.toBe(render(base));
    },
  );

  it.each(openLeaves)(
    '[P2-S09-AC-259] [P2-S09-AC-264] %s changes the rendered open review',
    (path) => {
      const changes = OPEN_CHANGES[path] ?? {
        [path]: altFor(
          path,
          getPath(openBase, path),
          leafPaths(openBase).indexOf(path) + 1,
        ),
      };
      expect(
        render(SchemaReviewResourceSchema.parse(withPaths(openBase, changes))),
        path,
      ).not.toBe(render(openBase));
    },
  );

  it('[P2-S09-AC-259] the single-valued members are rendered by name', () => {
    const markup = render(base);
    for (const text of Object.values(CONSTANT_TEXT))
      expect(markup).toContain(text);
    expect(markup).toContain('approve');
    expect(markup).toContain(base.dryRunId);
    expect(markup).toContain(base.contentTypeVersionId);
  });

  it('[P2-S09-AC-259] every leaf of the review is partitioned into a changed or a named member', () => {
    const all = new Set(leafPaths(base));
    const covered = new Set([
      ...approvedLeaves,
      ...openLeaves,
      ...Object.keys(CONSTANT_TEXT),
    ]);
    expect([...all].filter((path) => !covered.has(path))).toStrictEqual([]);
  });

  it('[P2-S09-AC-259] the owner assignment form and revoke form render only for an open review the server lets the owner assign', () => {
    expect(render(openBase)).toContain('data-operation-id="CMS-03A-14"');
    expect(render(base)).not.toContain('data-operation-id="CMS-03A-14"');
    expect(render(openBase)).toContain('Sentinel Reviewer');
  });
});
