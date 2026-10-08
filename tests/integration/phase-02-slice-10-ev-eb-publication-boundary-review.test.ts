import { describe, expect, it } from 'vitest';

import {
  DependencyManifestSchema,
  EditorialDecisionRequestSchema,
  ReviewSubmissionRequestSchema,
} from '@wejammin/contracts';

import {
  hash,
  validDecision,
  validDependencyManifest,
  validPolicyEvidence,
  validReviewSubmission,
} from '../../packages/contracts/src/cms-editorial/publication-contracts.test-support';
import {
  accepted,
  expect422,
  refusal,
} from './support/ev-eb-publication-boundary-support';

const withManifest = (patch: Record<string, unknown>) => ({
  ...validReviewSubmission,
  dependencyManifest: { ...validDependencyManifest, ...patch },
});

describe('EB publication boundary AC-038/AC-039/AC-040: CMS-03B-05 review submission is a 422 at the Worker body boundary', () => {
  it('EB boundary CMS-03B-05: the canonical submission is admitted', async () => {
    await accepted(ReviewSubmissionRequestSchema, validReviewSubmission);
  });
  for (const [label, frozenHash] of [
    ['an uppercase', 'A'.repeat(64)],
    ['a 63-character', 'a'.repeat(63)],
    ['a non-hex', 'g'.repeat(64)],
  ] as const)
    it(`EB boundary CMS-03B-05 frozenHash: ${label} frozen hash is 422 VALIDATION_FAILED at /frozenHash`, async () => {
      await expect422(
        ReviewSubmissionRequestSchema,
        { ...validReviewSubmission, frozenHash },
        '/frozenHash',
      );
    });
  it('EB boundary CMS-03B-05 dependencyManifest: an unknown manifest key is 422 unknown_field at its pointer', async () => {
    await expect422(
      ReviewSubmissionRequestSchema,
      withManifest({ extra: true }),
      '/dependencyManifest/extra',
      'unknown_field',
    );
  });
  it('EB boundary CMS-03B-05 dependencyManifest: a block with a malformed id is 422 at that block pointer', async () => {
    await expect422(
      ReviewSubmissionRequestSchema,
      withManifest({ blocks: [{ id: 'not-a-uuid', hash }] }),
      '/dependencyManifest/blocks/0/id',
    );
  });
  it('EB boundary CMS-03B-05 dependencyManifest: more than 256 entries is 422 with the max_entries code', async () => {
    const terms = Array.from({ length: 250 }, (_, index) => ({
      id: `123e4567-e89b-42d3-a456-${String(index).padStart(12, '0')}`,
      hash,
    }));
    const blocks = Array.from({ length: 8 }, (_, index) => ({
      id: `223e4567-e89b-42d3-a456-${String(index).padStart(12, '0')}`,
      hash,
    }));
    await expect422(
      ReviewSubmissionRequestSchema,
      withManifest({ terms, blocks }),
      '/dependencyManifest',
      'dependency_manifest_max_entries',
    );
  });
  it('EB boundary CMS-03B-05 dependencyManifest: the nested schema artifact refuses a short artifact hash, an empty compiler version and an oversized contract ref', async () => {
    const schema = (patch: Record<string, unknown>) => ({
      ...validDependencyManifest.schema,
      schemaArtifact: {
        ...validDependencyManifest.schema.schemaArtifact,
        ...patch,
      },
    });
    await expect422(
      ReviewSubmissionRequestSchema,
      withManifest({ schema: schema({ artifactHash: 'a'.repeat(63) }) }),
      '/dependencyManifest/schema/schemaArtifact/artifactHash',
    );
    await expect422(
      ReviewSubmissionRequestSchema,
      withManifest({ schema: schema({ compilerVersion: '' }) }),
      '/dependencyManifest/schema/schemaArtifact/compilerVersion',
    );
    await expect422(
      ReviewSubmissionRequestSchema,
      withManifest({ schema: schema({ zodContractRef: 'z'.repeat(257) }) }),
      '/dependencyManifest/schema/schemaArtifact/zodContractRef',
    );
    await expect422(
      ReviewSubmissionRequestSchema,
      withManifest({ schema: schema({ extra: 1 }) }),
      '/dependencyManifest/schema/schemaArtifact/extra',
      'unknown_field',
    );
  });
  it('EB boundary CMS-03B-05 dependencyManifest: the nested validator refs refuse an unregistered key and an unregistered version', async () => {
    const schema = (validatorRefs: unknown) => ({
      ...validDependencyManifest.schema,
      validatorRefs,
    });
    const outcome = await refusal(
      ReviewSubmissionRequestSchema,
      withManifest({
        schema: schema([{ key: 'attacker.validator', version: '1' }]),
      }),
    );
    expect(outcome?.status).toBe(422);
    expect(
      outcome?.violations.some((violation) =>
        violation.path.startsWith('/dependencyManifest/schema/validatorRefs'),
      ),
    ).toBe(true);
    const version = await refusal(
      ReviewSubmissionRequestSchema,
      withManifest({ schema: schema([{ key: 'rich_text.v1', version: '9' }]) }),
    );
    expect(version?.status).toBe(422);
    expect(
      version?.violations.some((violation) =>
        violation.path.startsWith('/dependencyManifest/schema/validatorRefs'),
      ),
    ).toBe(true);
  });
  it('EB boundary CMS-03B-05 riskClass: a caller-supplied riskClass is 422 unknown_field at /riskClass', async () => {
    await expect422(
      ReviewSubmissionRequestSchema,
      { ...validReviewSubmission, riskClass: 'ordinary' },
      '/riskClass',
      'unknown_field',
    );
  });
  it('EB boundary CMS-03B-05 riskClass: the manifest policy evidence refuses a riskClass other than ordinary or protected', async () => {
    const policy = { ...validPolicyEvidence, riskClass: 'critical' };
    const outcome = await refusal(
      ReviewSubmissionRequestSchema,
      withManifest({
        schema: { ...validDependencyManifest.schema, workflowPolicy: policy },
      }),
    );
    expect(outcome?.status).toBe(422);
    expect(
      outcome?.violations.some(
        (violation) =>
          violation.path ===
          '/dependencyManifest/schema/workflowPolicy/riskClass',
      ),
    ).toBe(true);
  });
  it('EB boundary CMS-03B-05 riskClass: protected manifest policy evidence with a single required decision is refused (two-person workflow)', async () => {
    const policy = {
      ...validPolicyEvidence,
      riskClass: 'protected',
      requiredDecisionCount: 1,
    };
    const outcome = await refusal(
      ReviewSubmissionRequestSchema,
      withManifest({
        schema: { ...validDependencyManifest.schema, workflowPolicy: policy },
      }),
    );
    expect(outcome?.status).toBe(422);
    expect(
      outcome?.violations.some((violation) =>
        violation.path.startsWith('/dependencyManifest/schema/workflowPolicy'),
      ),
    ).toBe(true);
    const twoPerson = {
      ...validPolicyEvidence,
      riskClass: 'protected',
      requiredDecisionCount: 2,
      requiredCapabilities: ['cms.reviewer', 'cms.reviewer.legal'],
    };
    await accepted(
      ReviewSubmissionRequestSchema,
      withManifest({
        schema: {
          ...validDependencyManifest.schema,
          workflowPolicy: twoPerson,
        },
      }),
    );
    expect(
      DependencyManifestSchema.safeParse({
        ...validDependencyManifest,
        schema: {
          ...validDependencyManifest.schema,
          workflowPolicy: twoPerson,
        },
      }).success,
    ).toBe(true);
  });
});

describe('EB publication boundary AC-041/AC-042: CMS-03B-06 decision is a 422 at the Worker body boundary', () => {
  it('EB boundary CMS-03B-06: the canonical decision is admitted', async () => {
    await accepted(EditorialDecisionRequestSchema, validDecision);
  });
  it('EB boundary CMS-03B-06 decision: a decision other than approve or reject is 422 at /decision', async () => {
    await expect422(
      EditorialDecisionRequestSchema,
      { ...validDecision, decision: 'request-changes' },
      '/decision',
    );
  });
  it('EB boundary CMS-03B-06 reason: an empty, an oversized and a markup reason are each 422 at /reason', async () => {
    await expect422(
      EditorialDecisionRequestSchema,
      { ...validDecision, reason: '' },
      '/reason',
    );
    await expect422(
      EditorialDecisionRequestSchema,
      { ...validDecision, reason: 'x'.repeat(2001) },
      '/reason',
      'reason_too_long',
    );
    await expect422(
      EditorialDecisionRequestSchema,
      { ...validDecision, reason: '<script>alert(1)</script>' },
      '/reason',
      'reason_unsafe_characters',
    );
  });
  it('EB boundary CMS-03B-06 reason: a control character and a non-NFC reason are 422 at /reason', async () => {
    await expect422(
      EditorialDecisionRequestSchema,
      { ...validDecision, reason: 'a\u0007b' },
      '/reason',
      'reason_control_or_bidi_characters',
    );
    await expect422(
      EditorialDecisionRequestSchema,
      { ...validDecision, reason: 'café' },
      '/reason',
      'reason_must_be_nfc',
    );
  });
  it('EB boundary CMS-03B-06 stepUpAt/capability: a caller-supplied stepUpAt, capability or authority is 422 unknown_field', async () => {
    await expect422(
      EditorialDecisionRequestSchema,
      { ...validDecision, stepUpAt: '2026-11-01T09:30:00Z' },
      '/stepUpAt',
      'unknown_field',
    );
    await expect422(
      EditorialDecisionRequestSchema,
      { ...validDecision, capability: 'cms.reviewer' },
      '/capability',
      'unknown_field',
    );
    await expect422(
      EditorialDecisionRequestSchema,
      { ...validDecision, authority: 'cms.editor' },
      '/authority',
      'unknown_field',
    );
  });
});
