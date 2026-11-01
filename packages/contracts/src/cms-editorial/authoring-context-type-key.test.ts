import { describe, expect, it } from 'vitest';

import { CmsTypeKeySchema } from '../content-schema-registry/primitives.ts';
import {
  AuthoringContextQuerySchema,
  AuthoringContextReadSchema,
  AuthoringContextResourceSchema,
  AuthoringContextTypeSchema,
  EntryCreateApiRequestSchema,
  EntryCreateRequestSchema,
} from './index';

/**
 * CMS-03B-14 evolve-contract RED: the author-safe AuthoringContextType
 * projection gains a server-derived `typeKey`.  This suite is written before
 * the contract change, so it fails on the current strict schema and pins the
 * exact behaviour the implementation must adopt.
 *
 * The member is response-only: the server derives it from the owning content
 * type, so a caller may never supply it on the read query or smuggle it into
 * the create request.  Adding a required member breaks the previous strict
 * parser -- an old AuthoringContextType without `typeKey` is refused -- and the
 * migration must not paper over that by weakening the member to optional or to
 * a catch-all object.
 */

const contentTypeId = 'b1200000-0000-4000-8000-000000000001';
const contentTypeVersionId = 'b1200000-0000-4000-8000-000000000002';
const schemaVersionId = 'b1200000-0000-4000-8000-000000000003';
const stableFieldId = 'b1200000-0000-4000-8000-000000000004';
const hash = 'c'.repeat(64);

const schemaArtifact = {
  id: schemaVersionId,
  contentTypeVersionId,
  artifactHash: hash,
  compilerVersion: '1.0.0',
  zodContractRef: 'cms.article.v1',
} as const;

const validatorEvidence = { key: 'cms.slug', version: '1' } as const;

const ordinaryPolicy = {
  key: 'cms.publish',
  version: '1',
  policyHash: hash,
  riskClass: 'ordinary',
  requiredDecisionCount: 1,
  requiredCapabilities: [],
  approvalEvidenceHash: hash,
} as const;

const validType = {
  contentTypeId,
  contentTypeVersionId,
  typeKey: 'article',
  label: 'Article',
  sourceLocale: 'en-US',
  defaultLocale: 'en-US',
  supportedLocales: ['en-US'],
  schemaArtifact,
  validatorRefs: [validatorEvidence],
  workflowPolicy: ordinaryPolicy,
  activationEvidence: ordinaryPolicy,
} as const;

/** The same author-safe type with the newly required member removed. */
const withoutTypeKey = (): Record<string, unknown> => {
  const clone: Record<string, unknown> = { ...validType };
  delete clone.typeKey;
  return clone;
};

const validField = {
  stableFieldId,
  key: 'display_name',
  kind: 'short_text',
  constraints: { minLength: 1 },
  required: true,
  defaultMode: 'none',
  localizationMode: 'none',
  editorConfig: { label: 'Display name', order: 0 },
  relationDefinition: null,
} as const;

const selectedResource = {
  creatableTypes: [validType],
  selectedType: validType,
  fields: [validField],
} as const;

const emptyResource = {
  creatableTypes: [validType],
  selectedType: null,
  fields: [],
} as const;

const validCreateRequest = {
  contentTypeId,
  contentTypeVersionId,
  locale: 'en-US',
  changedPaths: [`/fields/${stableFieldId}`],
  values: { [stableFieldId]: { title: 'Hello' } },
  schemaArtifact,
  validatorRefs: [validatorEvidence],
  workflowPolicy: ordinaryPolicy,
  activationEvidence: ordinaryPolicy,
} as const;

const validCreateApi = {
  headers: { contentType: 'application/json', idempotencyKey: 'create-0001' },
  body: validCreateRequest,
} as const;

const leakedKeys = [
  'ownerId',
  'assigneeId',
  'createdByPersonId',
  'actingPartyId',
  'registryPrivate',
  'cmsSchemaRegistryRead',
  'extra',
] as const;

/** Valid `typeKey` spellings plus every near-miss the grammar must refuse. */
const typeKeyCandidates = [
  'article',
  'release_notes',
  'ab',
  `a${'b'.repeat(63)}`,
  'type_2',
  'Article',
  'a',
  '1article',
  'art-icle',
  '_article',
  'article ',
  '',
  'x'.repeat(65),
] as const;

const invalidTypeKeys = [
  'Article',
  'art-icle',
  'a',
  '1article',
  '_article',
  'article ',
  '',
  'x'.repeat(65),
] as const;

/**
 * Normalizes a Zod result to its flat issue list, so the assertions can speak
 * about issue paths and refused keys without depending on the result union.
 */
const issuesOf = (parsed: {
  success: boolean;
  error?: unknown;
}): ReadonlyArray<{
  path: ReadonlyArray<unknown>;
  code?: string;
  keys?: ReadonlyArray<string>;
}> => {
  if (parsed.success) return [];
  const { issues } = parsed.error as {
    issues: ReadonlyArray<{
      path: ReadonlyArray<unknown>;
      code?: string;
      keys?: ReadonlyArray<string>;
    }>;
  };
  return issues;
};

const failurePaths = (parsed: {
  success: boolean;
  error?: unknown;
}): string[] =>
  issuesOf(parsed).map((issue) => issue.path.map(String).join('.'));

const refusedKeys = (parsed: { success: boolean; error?: unknown }): string[] =>
  issuesOf(parsed).flatMap((issue) =>
    issue.code === 'unrecognized_keys' ? [...(issue.keys ?? [])] : [],
  );

describe('CMS-03B-14 authoring-context typeKey', () => {
  it('accepts the canonical author-safe type once the server-derived typeKey is present', () => {
    expect(AuthoringContextTypeSchema.parse(validType)).toEqual(validType);
    expect(
      Object.hasOwn(AuthoringContextTypeSchema.parse(validType), 'typeKey'),
    ).toBe(true);
  });

  it('requires typeKey and reports its absence at path typeKey', () => {
    const parsed = AuthoringContextTypeSchema.safeParse(withoutTypeKey());
    expect(parsed.success).toBe(false);
    expect(failurePaths(parsed)).toContain('typeKey');
  });

  it('pins the typeKey grammar to CmsTypeKeySchema exactly', () => {
    const accepted: boolean[] = [];
    for (const candidate of typeKeyCandidates) {
      const projectionAccepted = AuthoringContextTypeSchema.safeParse({
        ...validType,
        typeKey: candidate,
      }).success;
      accepted.push(projectionAccepted);
      expect(projectionAccepted).toBe(
        CmsTypeKeySchema.safeParse(candidate).success,
      );
    }
    expect(accepted).toContain(true);
    expect(accepted).toContain(false);
  });

  it('rejects an invalid typeKey with an issue at path typeKey', () => {
    for (const candidate of invalidTypeKeys) {
      const parsed = AuthoringContextTypeSchema.safeParse({
        ...validType,
        typeKey: candidate,
      });
      expect(parsed.success).toBe(false);
      expect(failurePaths(parsed)).toContain('typeKey');
    }
  });

  it('accepts the creatable collection and the selected resource with typeKey', () => {
    expect(AuthoringContextResourceSchema.parse(selectedResource)).toEqual(
      selectedResource,
    );
    expect(AuthoringContextResourceSchema.parse(emptyResource)).toEqual(
      emptyResource,
    );
    expect(
      AuthoringContextReadSchema.safeParse({
        query: { contentTypeVersionId },
        resource: selectedResource,
      }).success,
    ).toBe(true);
    expect(selectedResource.selectedType.typeKey).toBe(
      selectedResource.creatableTypes[0].typeKey,
    );
  });

  it('stays strict: typeKey admits no ownership or registry-private extra', () => {
    for (const leaked of leakedKeys)
      expect(
        AuthoringContextTypeSchema.safeParse({
          ...validType,
          [leaked]: contentTypeId,
        }).success,
      ).toBe(false);
    const withExtra = AuthoringContextTypeSchema.safeParse({
      ...validType,
      registeredElsewhere: true,
    });
    expect(withExtra.success).toBe(false);
    expect(refusedKeys(withExtra)).toContain('registeredElsewhere');
  });

  it('leaves the query unchanged and refuses a caller-supplied typeKey', () => {
    expect(AuthoringContextQuerySchema.parse({})).toEqual({});
    expect(AuthoringContextQuerySchema.parse({ contentTypeVersionId })).toEqual(
      { contentTypeVersionId },
    );
    const withTypeKey = AuthoringContextQuerySchema.safeParse({
      typeKey: 'article',
    });
    expect(withTypeKey.success).toBe(false);
    expect(refusedKeys(withTypeKey)).toContain('typeKey');
  });

  it('never lets the response-only typeKey leak into the create request', () => {
    expect(EntryCreateRequestSchema.safeParse(validCreateRequest).success).toBe(
      true,
    );
    const requestWithTypeKey = EntryCreateRequestSchema.safeParse({
      ...validCreateRequest,
      typeKey: 'article',
    });
    expect(requestWithTypeKey.success).toBe(false);
    expect(refusedKeys(requestWithTypeKey)).toContain('typeKey');

    expect(EntryCreateApiRequestSchema.safeParse(validCreateApi).success).toBe(
      true,
    );
    const apiWithTypeKey = EntryCreateApiRequestSchema.safeParse({
      ...validCreateApi,
      body: { ...validCreateRequest, typeKey: 'article' },
    });
    expect(apiWithTypeKey.success).toBe(false);
    expect(refusedKeys(apiWithTypeKey)).toContain('typeKey');
  });
});
