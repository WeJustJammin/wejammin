import { describe, expect, it } from 'vitest';

import {
  CMS_EDITORIAL_ENTRY_CREATE_VERIFICATION_SEAMS,
  CmsEditorialEntryCreateForbiddenAuthoritySchema,
  CmsEditorialEntryCreateHeadersSchema,
  CmsEditorialEntryCreateRequestSchema,
  CmsEditorialEntryCreateResourceSchema,
  CmsEditorialEntryCreateVerificationSchema,
  CmsEditorialSchemaArtifactEvidenceSchema,
  CmsEditorialValidatorEvidenceSchema,
} from './cms-editorial-entry-create';

const uuid = '123e4567-e89b-42d3-a456-426614174000';
const uuid2 = '123e4567-e89b-42d3-a456-426614174001';
const hash = 'a'.repeat(64);
const instant = '2026-09-26T00:00:00Z';

const ordinaryPolicy = {
  key: 'editorial.standard',
  version: '1',
  policyHash: hash,
  riskClass: 'ordinary',
  requiredDecisionCount: 1,
  requiredCapabilities: [],
  approvalEvidenceHash: hash,
} as const;

const protectedPolicy = {
  ...ordinaryPolicy,
  key: 'editorial.protected',
  riskClass: 'protected',
  requiredDecisionCount: 2,
  requiredCapabilities: ['cms.design'],
} as const;

const schemaArtifact = {
  id: uuid,
  contentTypeVersionId: uuid2,
  artifactHash: hash,
  compilerVersion: '1.0.0',
  zodContractRef: '03a.content-type-version.v1',
} as const;

const validCreate = {
  contentTypeId: uuid,
  contentTypeVersionId: uuid2,
  locale: 'en-US',
  changedPaths: ['/fields/title'],
  values: { [uuid2]: { title: 'Hello' } },
  schemaArtifact,
  validatorRefs: [{ key: 'sanitize.rich_text', version: '3' }],
  workflowPolicy: ordinaryPolicy,
  activationEvidence: ordinaryPolicy,
} as const;

const validCreateResource = {
  entry: { id: uuid, version: '1', createdAt: instant, updatedAt: instant },
  revision: { id: uuid2, version: '1', createdAt: instant, updatedAt: instant },
  revisionNumber: '1',
  lifecycle: 'active',
  state: 'draft',
  locale: 'en-US',
  contentHash: hash,
  validationState: 'valid',
} as const;

const registryEvidence = {
  schemaVersionId: uuid,
  contentTypeVersionId: uuid2,
  artifactHash: hash,
  compilerVersion: '1.0.0',
  validatorKeys: ['sanitize.rich_text'],
} as const;

const callerSuppliedAuthorityKeys = [
  'ownerId',
  'assigneeId',
  'authorId',
  'actingPartyId',
  'capability',
  'authority',
] as const;

describe('cms-editorial entry create body (CMS-03B-10)', () => {
  it('accepts the canonical create body', () => {
    expect(
      CmsEditorialEntryCreateRequestSchema.safeParse(validCreate).success,
    ).toBe(true);
  });

  it('rejects unknown keys and every caller-supplied authority field', () => {
    expect(
      CmsEditorialEntryCreateRequestSchema.safeParse({
        ...validCreate,
        unexpected: 1,
      }).success,
    ).toBe(false);
    expect(
      callerSuppliedAuthorityKeys.map(
        (key) =>
          CmsEditorialEntryCreateRequestSchema.safeParse({
            ...validCreate,
            [key]: uuid,
          }).success,
      ),
    ).toEqual([false, false, false, false, false, false]);
  });

  it('requires two UUID schema identities and a locale', () => {
    expect(
      CmsEditorialEntryCreateRequestSchema.safeParse({
        ...validCreate,
        contentTypeId: 'nope',
      }).success,
    ).toBe(false);
    expect(
      CmsEditorialEntryCreateRequestSchema.safeParse({
        ...validCreate,
        contentTypeVersionId: 'nope',
      }).success,
    ).toBe(false);
    expect(
      CmsEditorialEntryCreateRequestSchema.safeParse({
        ...validCreate,
        locale: 'e',
      }).success,
    ).toBe(false);
  });

  it('bounds changedPaths and values exactly as the revision route does', () => {
    expect(
      CmsEditorialEntryCreateRequestSchema.safeParse({
        ...validCreate,
        changedPaths: [],
      }).success,
    ).toBe(false);
    expect(
      CmsEditorialEntryCreateRequestSchema.safeParse({
        ...validCreate,
        changedPaths: ['/a', '/a'],
      }).success,
    ).toBe(false);
    const tooManyKeys = Object.fromEntries(
      Array.from({ length: 129 }, (_, index) => [
        '123e4567-e89b-42d3-a456-' + String(index).padStart(12, '0'),
        { title: 'value' },
      ]),
    );
    expect(
      CmsEditorialEntryCreateRequestSchema.safeParse({
        ...validCreate,
        values: tooManyKeys,
      }).success,
    ).toBe(false);
  });

  it('enforces the protected workflow-policy dual-approval rule', () => {
    expect(
      CmsEditorialEntryCreateRequestSchema.safeParse({
        ...validCreate,
        workflowPolicy: protectedPolicy,
      }).success,
    ).toBe(true);
    expect(
      CmsEditorialEntryCreateRequestSchema.safeParse({
        ...validCreate,
        workflowPolicy: {
          ...protectedPolicy,
          requiredDecisionCount: 1,
          requiredCapabilities: [],
        },
      }).success,
    ).toBe(false);
    expect(
      CmsEditorialEntryCreateRequestSchema.safeParse({
        ...validCreate,
        workflowPolicy: { ...protectedPolicy, requiredCapabilities: [] },
      }).success,
    ).toBe(false);
  });
});

describe('cms-editorial entry create evidence shapes', () => {
  it('locks the schema artifact evidence', () => {
    expect(
      CmsEditorialSchemaArtifactEvidenceSchema.safeParse(schemaArtifact)
        .success,
    ).toBe(true);
    expect(
      CmsEditorialSchemaArtifactEvidenceSchema.safeParse({
        ...schemaArtifact,
        artifactHash: 'short',
      }).success,
    ).toBe(false);
    expect(
      CmsEditorialSchemaArtifactEvidenceSchema.safeParse({
        ...schemaArtifact,
        compilerVersion: '',
      }).success,
    ).toBe(false);
    expect(
      CmsEditorialSchemaArtifactEvidenceSchema.safeParse({
        ...schemaArtifact,
        zodContractRef: 'c'.repeat(257),
      }).success,
    ).toBe(false);
    expect(
      CmsEditorialSchemaArtifactEvidenceSchema.safeParse({
        ...schemaArtifact,
        extra: 1,
      }).success,
    ).toBe(false);
  });

  it('locks the validator evidence key grammar and version', () => {
    expect(
      CmsEditorialValidatorEvidenceSchema.safeParse({
        key: 'sanitize.rich_text',
        version: '3',
      }).success,
    ).toBe(true);
    expect(
      CmsEditorialValidatorEvidenceSchema.safeParse({
        key: 'Sanitize',
        version: '3',
      }).success,
    ).toBe(false);
    expect(
      CmsEditorialValidatorEvidenceSchema.safeParse({
        key: 'sanitize',
        version: '0',
      }).success,
    ).toBe(false);
    expect(
      CmsEditorialValidatorEvidenceSchema.safeParse({ key: 'sanitize' })
        .success,
    ).toBe(false);
  });

  it('refuses to let the caller assert authority by name', () => {
    expect(
      CmsEditorialEntryCreateForbiddenAuthoritySchema.safeParse({}).success,
    ).toBe(true);
    expect(
      callerSuppliedAuthorityKeys.map(
        (key) =>
          CmsEditorialEntryCreateForbiddenAuthoritySchema.safeParse({
            [key]: uuid,
          }).success,
      ),
    ).toEqual([false, false, false, false, false, false]);
  });
});

describe('cms-editorial entry create transport and success', () => {
  it('requires JSON plus an idempotency key and never an If-Match', () => {
    const headers = {
      contentType: 'application/json',
      idempotencyKey: 'abcdefgh',
    };
    expect(
      CmsEditorialEntryCreateHeadersSchema.safeParse(headers).success,
    ).toBe(true);
    expect(
      CmsEditorialEntryCreateHeadersSchema.safeParse({
        ...headers,
        ifMatch: '"1"',
      }).success,
    ).toBe(false);
    expect(
      CmsEditorialEntryCreateHeadersSchema.safeParse({
        ...headers,
        contentType: 'text/plain',
      }).success,
    ).toBe(false);
    expect(
      CmsEditorialEntryCreateHeadersSchema.safeParse({
        contentType: 'application/json',
      }).success,
    ).toBe(false);
    expect(
      Object.keys(CmsEditorialEntryCreateHeadersSchema.shape).includes(
        'ifMatch',
      ),
    ).toBe(false);
  });

  it('returns entry plus first revision with closed lifecycle state', () => {
    expect(
      CmsEditorialEntryCreateResourceSchema.safeParse(validCreateResource)
        .success,
    ).toBe(true);
    expect(
      Object.keys(
        CmsEditorialEntryCreateResourceSchema.parse(validCreateResource),
      ).sort(),
    ).toEqual([
      'contentHash',
      'entry',
      'lifecycle',
      'locale',
      'revision',
      'revisionNumber',
      'state',
      'validationState',
    ]);
    expect(
      CmsEditorialEntryCreateResourceSchema.safeParse({
        ...validCreateResource,
        lifecycle: 'draft',
      }).success,
    ).toBe(false);
    expect(
      CmsEditorialEntryCreateResourceSchema.safeParse({
        ...validCreateResource,
        validationState: 'maybe',
      }).success,
    ).toBe(false);
    expect(
      CmsEditorialEntryCreateResourceSchema.safeParse({
        ...validCreateResource,
        revision: {
          id: uuid2,
          version: '1',
          createdAt: instant,
          updatedAt: instant,
          contentHash: hash,
        },
      }).success,
    ).toBe(false);
  });
});

describe('cms-editorial entry create runtime verification seam', () => {
  it('names every check that static Zod cannot prove', () => {
    expect([...CMS_EDITORIAL_ENTRY_CREATE_VERIFICATION_SEAMS]).toEqual([
      'active_compiled_schema_identity_pairing',
      'schema_artifact_id_hash_compiler_match',
      'activation_evidence_non_null',
      'protected_validator_refs_present',
      'changed_paths_stable_id_binding',
      'values_against_active_schema_typing',
      'locale_set_membership',
      'off_registry_artifact_validator_rejection',
    ]);
  });

  it('fails closed unless the registry evidence matches the request artifact', () => {
    const seams = [...CMS_EDITORIAL_ENTRY_CREATE_VERIFICATION_SEAMS];
    expect(seams.length).toBe(8);
    const complete = {
      request: validCreate,
      registry: registryEvidence,
      seams,
    };
    expect(
      CmsEditorialEntryCreateVerificationSchema.safeParse(complete).success,
    ).toBe(true);
    // Each row must fail. A bare checklist proves nothing, mismatched artifact
    // identity still fails with every seam named, and a short, duplicated,
    // extended, or empty seam list is rejected rather than sampled.
    const rejected = [
      { request: validCreate, seams },
      {
        ...complete,
        registry: { ...registryEvidence, artifactHash: 'b'.repeat(64) },
      },
      {
        ...complete,
        registry: { ...registryEvidence, compilerVersion: '9.9.9' },
      },
      { ...complete, seams: seams.slice(0, -1) },
      { ...complete, seams: [...seams.slice(0, -1), seams[0]] },
      { ...complete, seams: [...seams, 'made_up_seam'] },
      { ...complete, seams: [] },
      { ...complete, registry: { ...registryEvidence, validatorKeys: [] } },
    ];
    expect(
      rejected.map(
        (payload) =>
          CmsEditorialEntryCreateVerificationSchema.safeParse(payload).success,
      ),
    ).toEqual([false, false, false, false, false, false, false, false]);
  });
});
