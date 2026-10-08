import { describe, expect, it } from 'vitest';

import {
  CmsEditorialDecisionPathParamsSchema,
  CmsEditorialReviewSubmissionHeadersSchema,
  CmsEditorialReviewSubmissionPathParamsSchema,
  CMS_DECISION_REASON_MAX_CHARACTERS,
  CMS_DEPENDENCY_MANIFEST_MAX_BYTES,
  CMS_DEPENDENCY_MANIFEST_MAX_ENTRIES,
  CMS_REVIEW_SUBMISSION_SEAMS,
  DependencyManifestSchema,
  EditorialDecisionRequestSchema,
  ReviewSubmissionRequestSchema,
  WorkflowPolicyEvidenceSchema,
} from './index';
import {
  hash,
  uuid,
  uuid2,
  uuid3,
  validDecision,
  validDependencyManifest,
  validPolicyEvidence,
  validReviewSubmission,
  validSchemaArtifact,
} from './publication-contracts.test-support';

describe('[P2-S10-AC-038] CMS-03B-05 frozenHash', () => {
  it('accepts the canonical submission with an exact 64 lowercase hex frozen hash', () => {
    expect(
      ReviewSubmissionRequestSchema.safeParse(validReviewSubmission).success,
    ).toBe(true);
  });

  it('rejects a frozenHash that is not exactly 64 lowercase hex', () => {
    for (const frozenHash of [
      '',
      'a'.repeat(63),
      'A'.repeat(64),
      'g'.repeat(64),
      hash + '0',
    ]) {
      expect(
        ReviewSubmissionRequestSchema.safeParse({
          ...validReviewSubmission,
          frozenHash,
        }).success,
      ).toBe(false);
    }
  });
});

describe('[P2-S10-AC-039] CMS-03B-05 dependencyManifest bounds', () => {
  it('accepts the canonical strict manifest with IDs and hashes for every declared group', () => {
    expect(
      DependencyManifestSchema.safeParse(validDependencyManifest).success,
    ).toBe(true);
  });

  it('rejects unknown manifest keys', () => {
    expect(
      DependencyManifestSchema.safeParse({
        ...validDependencyManifest,
        extra: true,
      }).success,
    ).toBe(false);
  });

  it('bounds every array group', () => {
    const id = (n: number) => uuid.slice(0, -3) + String(n).padStart(3, '0');
    const entry = (n: number) => ({ id: id(n), hash });
    const overBlocks = Array.from({ length: 129 }, (_, n) => entry(n));
    expect(
      DependencyManifestSchema.safeParse({
        ...validDependencyManifest,
        blocks: overBlocks,
      }).success,
    ).toBe(false);
    const overPatterns = Array.from({ length: 129 }, (_, n) => entry(n));
    expect(
      DependencyManifestSchema.safeParse({
        ...validDependencyManifest,
        patterns: overPatterns,
      }).success,
    ).toBe(false);
    const overTerms = Array.from({ length: 257 }, (_, n) => entry(n));
    expect(
      DependencyManifestSchema.safeParse({
        ...validDependencyManifest,
        terms: overTerms,
      }).success,
    ).toBe(false);
    const overLocaleSources = Array.from({ length: 33 }, (_, n) => ({
      locale: 'en-' + n,
      revisionId: uuid2,
      hash,
    }));
    expect(
      DependencyManifestSchema.safeParse({
        ...validDependencyManifest,
        localeSources: overLocaleSources,
      }).success,
    ).toBe(false);
    const overRelations = Array.from({ length: 129 }, (_, n) => ({
      fieldId: id(n),
      targetId: uuid2,
      targetVersion: '1',
    }));
    expect(
      DependencyManifestSchema.safeParse({
        ...validDependencyManifest,
        relations: overRelations,
      }).success,
    ).toBe(false);
  });

  it('serializes the canonical manifest within the 32 KiB bound and rejects an over-bound one', () => {
    const canonicalBytes = new TextEncoder().encode(
      JSON.stringify(validDependencyManifest),
    ).byteLength;
    expect(canonicalBytes).toBeLessThanOrEqual(
      CMS_DEPENDENCY_MANIFEST_MAX_BYTES,
    );
    const padded = {
      ...validDependencyManifest,
      checker: { key: 'k'.repeat(64), version: '1' },
      terms: Array.from({ length: 256 }, (_, n) => ({
        id: uuid.slice(0, -3) + String(n).padStart(3, '0'),
        hash,
      })),
      localeSources: Array.from({ length: 32 }, () => ({
        locale: 'en-US',
        revisionId: uuid2,
        hash,
      })),
    };
    const paddedBytes = new TextEncoder().encode(
      JSON.stringify(padded),
    ).byteLength;
    expect(paddedBytes).toBeGreaterThan(CMS_DEPENDENCY_MANIFEST_MAX_BYTES);
    const parsed = DependencyManifestSchema.safeParse(padded);
    expect(parsed.success).toBe(false);
    expect(
      parsed.success ? [] : parsed.error.issues.map((issue) => issue.message),
    ).toContain('dependency_manifest_max_bytes');
  });
});

const idN = (n: number): string =>
  `123e4567-e89b-42d3-a456-${String(n).padStart(12, '0')}`;
const entriesOf = (n: number, offset = 0) =>
  Array.from({ length: n }, (_unused, index) => ({
    id: idN(offset + index + 1),
    hash,
  }));
const issueMessages = (manifest: unknown): string[] => {
  const parsed = DependencyManifestSchema.safeParse(manifest);
  return parsed.success ? [] : parsed.error.issues.map((i) => i.message);
};
const bytesOf = (value: unknown): number =>
  new TextEncoder().encode(JSON.stringify(value)).byteLength;

describe('[P2-S10-AC-039] CMS-03B-05 dependencyManifest total-entry cap', () => {
  it('names the 256-entry ceiling', () => {
    expect(CMS_DEPENDENCY_MANIFEST_MAX_ENTRIES).toBe(256);
  });

  it('counts every list element plus each present singleton: 256 is accepted, 257 is refused', () => {
    // schema + template + settings + checker = 4 singletons; 252 list entries
    // reach exactly 256, and one more is 257.
    const at256 = {
      ...validDependencyManifest,
      schema: { ...validDependencyManifest.schema, validatorRefs: [] },
      blocks: entriesOf(128),
      patterns: entriesOf(124, 1000),
      terms: [],
      localeSources: [],
      relations: [],
    };
    const at257 = { ...at256, patterns: entriesOf(125, 1000) };
    expect(bytesOf(at256)).toBeLessThanOrEqual(
      CMS_DEPENDENCY_MANIFEST_MAX_BYTES,
    );
    expect(bytesOf(at257)).toBeLessThanOrEqual(
      CMS_DEPENDENCY_MANIFEST_MAX_BYTES,
    );
    expect(DependencyManifestSchema.safeParse(at256).success).toBe(true);
    expect(issueMessages(at257)).toEqual(['dependency_manifest_max_entries']);
  });

  it('does not count an absent template', () => {
    const noTemplate = {
      ...validDependencyManifest,
      template: null,
      schema: { ...validDependencyManifest.schema, validatorRefs: [] },
      blocks: entriesOf(128),
      patterns: entriesOf(125, 1000),
      terms: [],
      localeSources: [],
      relations: [],
    };
    // 3 singletons + 253 list entries = 256.
    expect(DependencyManifestSchema.safeParse(noTemplate).success).toBe(true);
  });

  it('counts locale sources toward the cap', () => {
    const base = {
      ...validDependencyManifest,
      schema: { ...validDependencyManifest.schema, validatorRefs: [] },
      blocks: entriesOf(128),
      patterns: entriesOf(120, 1000),
      terms: [],
      relations: [],
    };
    // 4 + 128 + 120 = 252; four locale sources reach 256 and a fifth is 257.
    const locales = (n: number) =>
      Array.from({ length: n }, (_unused, index) => ({
        locale: `en-${index}`,
        revisionId: uuid2,
        hash,
      }));
    expect(
      DependencyManifestSchema.safeParse({
        ...base,
        localeSources: locales(4),
      }).success,
    ).toBe(true);
    expect(issueMessages({ ...base, localeSources: locales(5) })).toContain(
      'dependency_manifest_max_entries',
    );
  });
});

describe('[P2-S10-AC-039] CMS-03B-05 dependencyManifest protected validator refs', () => {
  const withRefs = (validatorRefs: unknown) => ({
    ...validDependencyManifest,
    schema: { ...validDependencyManifest.schema, validatorRefs },
  });

  it('accepts only the registered protected member at its registered version', () => {
    expect(
      DependencyManifestSchema.safeParse(
        withRefs([{ key: 'rich_text.v1', version: '1' }]),
      ).success,
    ).toBe(true);
    expect(DependencyManifestSchema.safeParse(withRefs([])).success).toBe(true);
    for (const refs of [
      [{ key: 'pii.safety', version: '1' }],
      [{ key: 'rich_text.v1', version: '2' }],
      [{ key: 'rich_text.v1', version: '0' }],
      [{ key: 'cms.slug', version: '1' }],
      [{ key: 'rich_text.v1' }],
      [{ key: 'rich_text.v1', version: '1', extra: true }],
    ])
      expect(
        DependencyManifestSchema.safeParse(withRefs(refs)).success,
        JSON.stringify(refs),
      ).toBe(false);
  });

  it('refuses a validator named twice', () => {
    expect(
      DependencyManifestSchema.safeParse(
        withRefs([
          { key: 'rich_text.v1', version: '1' },
          { key: 'rich_text.v1', version: '1' },
        ]),
      ).success,
    ).toBe(false);
  });
});

describe('[P2-S10-AC-039] CMS-03B-05 dependencyManifest nested strictness', () => {
  const valid = validDependencyManifest;
  const refuses = (label: string, manifest: unknown) =>
    it(label, () => {
      expect(DependencyManifestSchema.safeParse(manifest).success).toBe(false);
    });

  refuses('refuses an unknown key inside schema', {
    ...valid,
    schema: { ...valid.schema, extra: 1 },
  });
  refuses('refuses an unknown key inside a block entry', {
    ...valid,
    blocks: [{ ...valid.blocks[0], extra: 1 }],
  });
  refuses('refuses an unknown key inside a pattern entry', {
    ...valid,
    patterns: [{ ...valid.patterns[0], extra: 1 }],
  });
  refuses('refuses an unknown key inside a term entry', {
    ...valid,
    terms: [{ ...valid.terms[0], extra: 1 }],
  });
  refuses('refuses an unknown key inside the template', {
    ...valid,
    template: { ...valid.template, extra: 1 },
  });
  refuses('refuses an unknown key inside a locale source', {
    ...valid,
    localeSources: [{ ...valid.localeSources[0], extra: 1 }],
  });
  refuses('refuses an unknown key inside settings', {
    ...valid,
    settings: { ...valid.settings, extra: 1 },
  });
  refuses('refuses an unknown key inside a relation', {
    ...valid,
    relations: [{ ...valid.relations[0], extra: 1 }],
  });
  refuses('refuses an unknown key inside the checker', {
    ...valid,
    checker: { ...valid.checker, extra: 1 },
  });
  refuses('refuses a bad UUID inside a block entry', {
    ...valid,
    blocks: [{ id: 'not-a-uuid', hash }],
  });
  refuses('refuses a bad UUID inside a pattern entry', {
    ...valid,
    patterns: [{ id: 'not-a-uuid', hash }],
  });
  refuses('refuses a bad UUID inside a term entry', {
    ...valid,
    terms: [{ id: 'not-a-uuid', hash }],
  });
  refuses('refuses a bad UUID inside the template', {
    ...valid,
    template: { id: 'not-a-uuid', hash },
  });
  refuses('refuses a bad revision UUID inside a locale source', {
    ...valid,
    localeSources: [{ locale: 'en-US', revisionId: 'nope', hash }],
  });
  refuses('refuses a bad field or target UUID inside a relation', {
    ...valid,
    relations: [{ fieldId: 'nope', targetId: uuid2, targetVersion: '1' }],
  });
  refuses('refuses an uppercase hash inside a block entry', {
    ...valid,
    blocks: [{ id: uuid3, hash: 'A'.repeat(64) }],
  });
  refuses('refuses a short hash inside the settings', {
    ...valid,
    settings: { version: '1', hash: 'a'.repeat(63) },
  });
  refuses('refuses a non-version settings version', {
    ...valid,
    settings: { version: '0', hash },
  });
  refuses('refuses a non-version relation target version', {
    ...valid,
    relations: [{ fieldId: uuid3, targetId: uuid2, targetVersion: '01' }],
  });
  refuses('refuses a non-version checker version', {
    ...valid,
    checker: { key: 'link.checker', version: 'x' },
  });
  refuses('refuses a malformed locale inside a locale source', {
    ...valid,
    localeSources: [{ locale: 'en_US', revisionId: uuid2, hash }],
  });

  it('refuses a block, pattern, term, locale or relation named twice', () => {
    expect(
      issueMessages({
        ...valid,
        blocks: [valid.blocks[0], valid.blocks[0]],
        patterns: [valid.patterns[0], valid.patterns[0]],
        terms: [valid.terms[0], valid.terms[0]],
        localeSources: [valid.localeSources[0], valid.localeSources[0]],
        relations: [valid.relations[0], valid.relations[0]],
      }),
    ).toEqual(Array(5).fill('dependency_manifest_entries_must_be_unique'));
  });
});

describe('[P2-S10-AC-039] CMS-03B-05 dependencyManifest schema binding', () => {
  it('requires the manifest schema artifact to bind the manifest schema version', () => {
    const schema = validDependencyManifest.schema;
    expect(
      DependencyManifestSchema.safeParse({
        ...validDependencyManifest,
        schema: {
          ...schema,
          schemaArtifact: {
            ...validSchemaArtifact,
            contentTypeVersionId: uuid3,
          },
        },
      }).success,
    ).toBe(false);
    expect(
      DependencyManifestSchema.safeParse({
        ...validDependencyManifest,
        schema: {
          ...schema,
          schemaArtifact: {
            ...validSchemaArtifact,
            contentTypeVersionId: schema.id,
          },
        },
      }).success,
    ).toBe(true);
  });
});

describe('[P2-S10-AC-040] CMS-03B-05 riskClass is server-derived', () => {
  it('rejects caller-supplied riskClass as an unknown key', () => {
    expect(
      ReviewSubmissionRequestSchema.safeParse({
        ...validReviewSubmission,
        riskClass: 'protected',
      }).success,
    ).toBe(false);
  });

  it('treats ordinary and protected policy evidence as valid within the manifest', () => {
    expect(
      WorkflowPolicyEvidenceSchema.safeParse(validPolicyEvidence).success,
    ).toBe(true);
    expect(
      WorkflowPolicyEvidenceSchema.safeParse({
        ...validPolicyEvidence,
        riskClass: 'protected',
        requiredDecisionCount: 2,
        requiredCapabilities: ['cms.reviewer', 'cms.reviewer.legal'],
      }).success,
    ).toBe(true);
  });

  it('requires the configured two-person workflow for protected policy evidence', () => {
    expect(
      WorkflowPolicyEvidenceSchema.safeParse({
        ...validPolicyEvidence,
        riskClass: 'protected',
      }).success,
    ).toBe(false);
    expect(
      WorkflowPolicyEvidenceSchema.safeParse({
        ...validPolicyEvidence,
        riskClass: 'protected',
        requiredDecisionCount: 2,
        requiredCapabilities: [],
      }).success,
    ).toBe(false);
    expect(
      WorkflowPolicyEvidenceSchema.safeParse({
        ...validPolicyEvidence,
        riskClass: 'protected',
        requiredDecisionCount: 1,
        requiredCapabilities: ['cms.reviewer', 'cms.reviewer.legal'],
      }).success,
    ).toBe(false);
  });
});

describe('[P2-S10-AC-041] CMS-03B-06 decision/reason', () => {
  it('accepts approve and reject decisions with a 1-2000 safe Unicode reason', () => {
    expect(
      EditorialDecisionRequestSchema.safeParse(validDecision).success,
    ).toBe(true);
    expect(
      EditorialDecisionRequestSchema.safeParse({
        ...validDecision,
        decision: 'reject',
      }).success,
    ).toBe(true);
  });

  it('rejects closed decision verbs and empty or oversized reasons', () => {
    expect(
      EditorialDecisionRequestSchema.safeParse({
        ...validDecision,
        decision: 'request-changes',
      }).success,
    ).toBe(false);
    expect(
      EditorialDecisionRequestSchema.safeParse({ ...validDecision, reason: '' })
        .success,
    ).toBe(false);
    expect(
      EditorialDecisionRequestSchema.safeParse({
        ...validDecision,
        reason: 'x'.repeat(2001),
      }).success,
    ).toBe(false);
  });

  it('rejects unsafe reason markup', () => {
    expect(
      EditorialDecisionRequestSchema.safeParse({
        ...validDecision,
        reason: '<script>alert(1)</script>',
      }).success,
    ).toBe(false);
  });

  const reasonAccepted = (reason: string): boolean =>
    EditorialDecisionRequestSchema.safeParse({ ...validDecision, reason })
      .success;

  it('counts Unicode characters, not UTF-16 units: exactly 2000 emoji is accepted and 2001 refused', () => {
    expect(CMS_DECISION_REASON_MAX_CHARACTERS).toBe(2000);
    expect(reasonAccepted('x'.repeat(2000))).toBe(true);
    expect(reasonAccepted('\u{1F600}'.repeat(2000))).toBe(true);
    expect(reasonAccepted('\u{1F600}'.repeat(2001))).toBe(false);
    expect(reasonAccepted('x'.repeat(2001))).toBe(false);
  });

  it('accepts non-ASCII reasons in any script', () => {
    for (const reason of [
      'Привет',
      '日本語',
      'café ✓',
      'Reason with emoji \u{1F600}',
    ])
      expect(reasonAccepted(reason), reason).toBe(true);
  });

  it('refuses control characters (C0, DEL, C1, newline, separators)', () => {
    for (const reason of [
      'a\u0000b',
      'a\u0001b',
      'line one\nline two',
      'a\tb',
      'a\u007Fb',
      'a\u0085b',
      'a\u009Fb',
      'a b',
      'a b',
    ])
      expect(reasonAccepted(reason), JSON.stringify(reason)).toBe(false);
  });

  it('refuses bidirectional formatting characters', () => {
    for (const reason of ['a‮b', 'a‪b', 'a⁦b', 'a⁩b', 'a‏b', 'a‎b', 'a؜b'])
      expect(reasonAccepted(reason), JSON.stringify(reason)).toBe(false);
  });

  it('refuses a reason that is not NFC and never normalizes it', () => {
    expect(reasonAccepted('café')).toBe(true);
    expect(reasonAccepted('café')).toBe(false);
  });
});

describe('[P2-S10-AC-042] CMS-03B-06 stepUpAt/capability are server-derived', () => {
  it('rejects caller-supplied stepUpAt and capability as unknown keys', () => {
    expect(
      EditorialDecisionRequestSchema.safeParse({
        ...validDecision,
        stepUpAt: '2026-11-01T09:30:00Z',
      }).success,
    ).toBe(false);
    expect(
      EditorialDecisionRequestSchema.safeParse({
        ...validDecision,
        capability: 'cms.reviewer',
      }).success,
    ).toBe(false);
  });

  it('rejects any caller-selected authority metadata', () => {
    expect(
      EditorialDecisionRequestSchema.safeParse({
        ...validDecision,
        authority: 'cms.editor',
      }).success,
    ).toBe(false);
  });
});

describe('CMS-03B-05/06/07/08/09 path and header transports', () => {
  it('binds the exact review submission path parameters and headers', () => {
    expect(
      CmsEditorialReviewSubmissionPathParamsSchema.safeParse({
        entryId: uuid,
      }).success,
    ).toBe(true);
    expect(
      CmsEditorialReviewSubmissionHeadersSchema.safeParse({
        contentType: 'application/json',
        idempotencyKey: 'S10-REVIEW-1234',
        ifMatch: '"3"',
      }).success,
    ).toBe(true);
  });

  it('binds the decision path parameter', () => {
    expect(
      CmsEditorialDecisionPathParamsSchema.safeParse({ reviewId: uuid2 })
        .success,
    ).toBe(true);
  });
});

describe('[P2-S10-AC-038/AC-048] runtime hash seams are named, not trusted', () => {
  it('names the normalized revision hash comparison the CMS-03B-05 runtime must perform', () => {
    expect(CMS_REVIEW_SUBMISSION_SEAMS).toEqual([
      'frozen_hash_equals_normalized_revision_hash',
      'dependency_manifest_resolves_to_live_registry',
      'one_open_review_per_revision',
    ]);
  });
});
