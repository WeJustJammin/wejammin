import { describe, expect, it } from 'vitest';

import {
  ConflictChoiceSchema,
  EntryCreateRequestSchema,
  EntryRevisionRequestSchema,
} from './index';

/**
 * P2-S10-AC-030 / BE03b "Pointers" (normative): every command addresses a field
 * as `/fields/{stableFieldId}`. `/blocks/...` and every other pointer is refused
 * by CMS-03B-01, CMS-03B-02 and CMS-03B-10 until a composition write path
 * exists, exactly as the database refuses it, so the proxy and the Worker never
 * accept a shape SQL will reject.
 */

const entryId = '123e4567-e89b-42d3-a456-426614174000';
const typeId = '123e4567-e89b-42d3-a456-426614174001';
const versionId = '123e4567-e89b-42d3-a456-426614174002';
const fieldId = '123e4567-e89b-42d3-a456-426614174003';
const hash = 'a'.repeat(64);

const revision = (changedPaths: unknown) => ({
  entryId,
  baseRevision: '1',
  changedPaths,
  values: { [fieldId]: 'x' },
  locale: 'en-US',
  expectedVersion: '1',
});

const policy = {
  key: 'editorial',
  version: '1',
  policyHash: hash,
  riskClass: 'ordinary',
  requiredDecisionCount: 1,
  requiredCapabilities: ['cms.reviewer'],
  approvalEvidenceHash: hash,
};

const create = (changedPaths: unknown) => ({
  contentTypeId: typeId,
  contentTypeVersionId: versionId,
  locale: 'en-US',
  changedPaths,
  values: { [fieldId]: 'x' },
  schemaArtifact: {
    id: typeId,
    contentTypeVersionId: versionId,
    artifactHash: hash,
    compilerVersion: '1',
    zodContractRef: 'cms/content-type/a/v1',
  },
  validatorRefs: [],
  workflowPolicy: policy,
  activationEvidence: policy,
});

const BAD_POINTERS = [
  `/blocks/${fieldId}`,
  '/blocks/hero/0',
  `/relations/${fieldId}/${hash}`,
  '/fields/title',
  `/fields/${fieldId.toUpperCase()}`,
  `/fields/${fieldId}/nested`,
  '/title',
  '',
] as const;

describe('[P2-S10-AC-030] command pointers are /fields/{stableFieldId}', () => {
  it('accepts the field pointer on every command', () => {
    const pointer = `/fields/${fieldId}`;
    expect(
      EntryRevisionRequestSchema.safeParse(revision([pointer])).success,
    ).toBe(true);
    expect(EntryCreateRequestSchema.safeParse(create([pointer])).success).toBe(
      true,
    );
    expect(
      ConflictChoiceSchema.safeParse({ path: pointer, choice: 'theirs' })
        .success,
    ).toBe(true);
  });

  for (const bad of BAD_POINTERS)
    it(`refuses ${JSON.stringify(bad)} on CMS-03B-01, CMS-03B-02 and CMS-03B-10`, () => {
      expect(
        EntryRevisionRequestSchema.safeParse(revision([bad])).success,
      ).toBe(false);
      expect(EntryCreateRequestSchema.safeParse(create([bad])).success).toBe(
        false,
      );
      expect(
        ConflictChoiceSchema.safeParse({ path: bad, choice: 'theirs' }).success,
      ).toBe(false);
    });
});
