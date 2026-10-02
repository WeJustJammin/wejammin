import { describe, expect, it } from 'vitest';

import {
  ENTRY_CREATE_VERIFICATION_SEAMS,
  EntryCreateForbiddenAuthoritySchema,
  EntryCreateHeadersSchema,
  EntryCreateRequestSchema,
  EntryCreateResourceSchema,
  EntryCreateVerificationSchema,
  SchemaArtifactEvidenceSchema,
  ValidatorEvidenceSchema,
} from './index';

const uuid = '123e4567-e89b-42d3-a456-426614174000';
const uuid2 = '123e4567-e89b-42d3-a456-426614174001';
const uuid3 = '123e4567-e89b-42d3-a456-426614174002';
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
  // BE03b binds changed paths to stable field/block/relation IDs, so the
  // fixture points at the stable field UUID rather than a display name.
  changedPaths: ['/fields/' + uuid3],
  values: { [uuid3]: { title: 'Hello' } },
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

// The registry facts a trusted server-side read resolves; a caller has none.
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

describe('cms entry create body (CMS-03B-10)', () => {
  it('accepts the canonical create body', () => {
    expect(EntryCreateRequestSchema.safeParse(validCreate).success).toBe(true);
  });

  it('rejects unknown keys and every caller-supplied authority field', () => {
    expect(
      EntryCreateRequestSchema.safeParse({ ...validCreate, unexpected: 1 })
        .success,
    ).toBe(false);
    expect(
      callerSuppliedAuthorityKeys.map(
        (key) =>
          EntryCreateRequestSchema.safeParse({ ...validCreate, [key]: uuid })
            .success,
      ),
    ).toEqual([false, false, false, false, false, false]);
  });

  it('requires two UUID schema identities and a locale', () => {
    expect(
      EntryCreateRequestSchema.safeParse({
        ...validCreate,
        contentTypeId: 'nope',
      }).success,
    ).toBe(false);
    expect(
      EntryCreateRequestSchema.safeParse({
        ...validCreate,
        contentTypeVersionId: 'nope',
      }).success,
    ).toBe(false);
    expect(
      EntryCreateRequestSchema.safeParse({ ...validCreate, locale: 'e' })
        .success,
    ).toBe(false);
  });

  it('bounds changedPaths and values exactly as the revision route does', () => {
    expect(
      EntryCreateRequestSchema.safeParse({
        ...validCreate,
        changedPaths: [],
      }).success,
    ).toBe(false);
    expect(
      EntryCreateRequestSchema.safeParse({
        ...validCreate,
        changedPaths: ['/a', '/a'],
      }).success,
    ).toBe(false);
    const tooManyKeys = Object.fromEntries(
      Array.from({ length: 129 }, (_, index) => [
        '123e4567-e89b-42d3-a456-42661417' + String(index).padStart(4, '0'),
        1,
      ]),
    );
    expect(
      EntryCreateRequestSchema.safeParse({
        ...validCreate,
        values: tooManyKeys,
      }).success,
    ).toBe(false);
    expect(
      EntryCreateRequestSchema.safeParse({
        ...validCreate,
        values: { [uuid3]: '🎵'.repeat(65_536) },
      }).success,
    ).toBe(false);
  });

  it('enforces the protected workflow-policy dual-approval rule', () => {
    expect(
      EntryCreateRequestSchema.safeParse({
        ...validCreate,
        workflowPolicy: protectedPolicy,
      }).success,
    ).toBe(true);
    expect(
      EntryCreateRequestSchema.safeParse({
        ...validCreate,
        workflowPolicy: {
          ...protectedPolicy,
          requiredDecisionCount: 1,
          requiredCapabilities: [],
        },
      }).success,
    ).toBe(false);
    expect(
      EntryCreateRequestSchema.safeParse({
        ...validCreate,
        workflowPolicy: { ...protectedPolicy, requiredCapabilities: [] },
      }).success,
    ).toBe(false);
  });
});

describe('cms entry create evidence shapes', () => {
  it('locks the schema artifact evidence', () => {
    expect(SchemaArtifactEvidenceSchema.safeParse(schemaArtifact).success).toBe(
      true,
    );
    expect(
      SchemaArtifactEvidenceSchema.safeParse({
        ...schemaArtifact,
        artifactHash: 'short',
      }).success,
    ).toBe(false);
    expect(
      SchemaArtifactEvidenceSchema.safeParse({
        ...schemaArtifact,
        compilerVersion: '',
      }).success,
    ).toBe(false);
    expect(
      SchemaArtifactEvidenceSchema.safeParse({
        ...schemaArtifact,
        zodContractRef: 'c'.repeat(257),
      }).success,
    ).toBe(false);
    expect(
      SchemaArtifactEvidenceSchema.safeParse({
        ...schemaArtifact,
        extra: 1,
      }).success,
    ).toBe(false);
  });

  it('locks the validator evidence key grammar and version', () => {
    expect(
      ValidatorEvidenceSchema.safeParse({
        key: 'sanitize.rich_text',
        version: '3',
      }).success,
    ).toBe(true);
    expect(
      ValidatorEvidenceSchema.safeParse({ key: 'Sanitize', version: '3' })
        .success,
    ).toBe(false);
    expect(
      ValidatorEvidenceSchema.safeParse({ key: 'sanitize', version: '0' })
        .success,
    ).toBe(false);
    expect(ValidatorEvidenceSchema.safeParse({ key: 'sanitize' }).success).toBe(
      false,
    );
  });

  it('refuses to let the caller assert authority by name', () => {
    expect(EntryCreateForbiddenAuthoritySchema.safeParse({}).success).toBe(
      true,
    );
    expect(
      callerSuppliedAuthorityKeys.map(
        (key) =>
          EntryCreateForbiddenAuthoritySchema.safeParse({ [key]: uuid })
            .success,
      ),
    ).toEqual([false, false, false, false, false, false]);
  });
});

describe('cms entry create transport and success', () => {
  it('requires JSON plus an idempotency key and never an If-Match', () => {
    const headers = {
      contentType: 'application/json',
      idempotencyKey: 'abcdefgh',
    };
    expect(EntryCreateHeadersSchema.safeParse(headers).success).toBe(true);
    expect(
      EntryCreateHeadersSchema.safeParse({ ...headers, ifMatch: '"1"' })
        .success,
    ).toBe(false);
    expect(
      EntryCreateHeadersSchema.safeParse({
        ...headers,
        contentType: 'text/plain',
      }).success,
    ).toBe(false);
    expect(
      EntryCreateHeadersSchema.safeParse({ contentType: 'application/json' })
        .success,
    ).toBe(false);
    expect(
      Object.keys(EntryCreateHeadersSchema.shape).includes('ifMatch'),
    ).toBe(false);
  });

  it('returns entry plus first revision with closed lifecycle state', () => {
    expect(
      EntryCreateResourceSchema.safeParse(validCreateResource).success,
    ).toBe(true);
    expect(
      Object.keys(EntryCreateResourceSchema.parse(validCreateResource)).sort(),
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
      EntryCreateResourceSchema.safeParse({
        ...validCreateResource,
        lifecycle: 'draft',
      }).success,
    ).toBe(false);
    expect(
      EntryCreateResourceSchema.safeParse({
        ...validCreateResource,
        validationState: 'maybe',
      }).success,
    ).toBe(false);
    expect(
      EntryCreateResourceSchema.safeParse({
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

describe('cms entry create runtime verification seam', () => {
  it('binds changed paths to stable IDs and names the seam that proves it', () => {
    const pointer = validCreate.changedPaths[0];
    expect(pointer.startsWith('/fields/')).toBe(true);
    expect(pointer.slice('/fields/'.length)).toBe(uuid3);
    // JsonPointer can only prove pointer syntax, so UUID binding stays a
    // runtime seam rather than a static claim.
    expect(ENTRY_CREATE_VERIFICATION_SEAMS).toContain(
      'changed_paths_stable_id_binding',
    );
    expect(EntryCreateRequestSchema.safeParse(validCreate).success).toBe(true);
  });

  it('names every check that static Zod cannot prove', () => {
    expect([...ENTRY_CREATE_VERIFICATION_SEAMS]).toEqual([
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

  it('accepts create attestation only from registry evidence bound to the request', () => {
    expect(ENTRY_CREATE_VERIFICATION_SEAMS.length).toBe(8);
    const complete = {
      request: validCreate,
      registry: registryEvidence,
      seams: [...ENTRY_CREATE_VERIFICATION_SEAMS],
    };
    expect(EntryCreateVerificationSchema.safeParse(complete).success).toBe(
      true,
    );
    expect(
      EntryCreateVerificationSchema.safeParse({
        ...complete,
        seams: ENTRY_CREATE_VERIFICATION_SEAMS.slice(0, -1),
      }).success,
    ).toBe(false);
    expect(
      EntryCreateVerificationSchema.safeParse({
        ...complete,
        seams: [
          ...ENTRY_CREATE_VERIFICATION_SEAMS.slice(0, -1),
          ENTRY_CREATE_VERIFICATION_SEAMS[0],
        ],
      }).success,
    ).toBe(false);
    expect(
      EntryCreateVerificationSchema.safeParse({
        ...complete,
        seams: [],
      }).success,
    ).toBe(false);
    expect(
      EntryCreateVerificationSchema.safeParse({
        ...complete,
        seams: [...ENTRY_CREATE_VERIFICATION_SEAMS, 'made_up_seam'],
      }).success,
    ).toBe(false);
  });

  it('never treats a caller-supplied seam-name list as verification authority', () => {
    // The pre-hardening contract accepted exactly this shape from any caller.
    const fabricatedSeamList = {
      request: validCreate,
      seams: [...ENTRY_CREATE_VERIFICATION_SEAMS],
    };
    expect(
      EntryCreateVerificationSchema.safeParse(fabricatedSeamList).success,
    ).toBe(false);
    // Registry evidence that does not bind the claimed artifact is rejected.
    expect(
      EntryCreateVerificationSchema.safeParse({
        request: validCreate,
        registry: { ...registryEvidence, artifactHash: 'b'.repeat(64) },
        seams: [...ENTRY_CREATE_VERIFICATION_SEAMS],
      }).success,
    ).toBe(false);
    expect(
      EntryCreateVerificationSchema.safeParse({
        request: validCreate,
        registry: { ...registryEvidence, compilerVersion: '9.9.9' },
        seams: [...ENTRY_CREATE_VERIFICATION_SEAMS],
      }).success,
    ).toBe(false);
    expect(
      EntryCreateVerificationSchema.safeParse({
        request: validCreate,
        registry: { ...registryEvidence, schemaVersionId: uuid3 },
        seams: [...ENTRY_CREATE_VERIFICATION_SEAMS],
      }).success,
    ).toBe(false);
    expect(
      EntryCreateVerificationSchema.safeParse({
        request: validCreate,
        registry: { ...registryEvidence, contentTypeVersionId: uuid3 },
        seams: [...ENTRY_CREATE_VERIFICATION_SEAMS],
      }).success,
    ).toBe(false);
    // An empty registry is not registry evidence either.
    expect(
      EntryCreateVerificationSchema.safeParse({
        request: validCreate,
        registry: {},
        seams: [...ENTRY_CREATE_VERIFICATION_SEAMS],
      }).success,
    ).toBe(false);
  });
});
