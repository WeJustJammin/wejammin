import { describe, expect, it } from 'vitest';

import {
  AuthoringContextFieldSchema,
  AuthoringContextQuerySchema,
  AuthoringContextReadSchema,
  AuthoringContextResourceSchema,
  AuthoringContextTypeSchema,
} from './index';

const uuid = '123e4567-e89b-42d3-a456-426614174000';
const uuid2 = '123e4567-e89b-42d3-a456-426614174001';
const uuid3 = '123e4567-e89b-42d3-a456-426614174002';
const uuid4 = '123e4567-e89b-42d3-a456-426614174003';
const hash = 'a'.repeat(64);

const schemaArtifact = {
  id: uuid3,
  contentTypeVersionId: uuid2,
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

const protectedPolicy = {
  ...ordinaryPolicy,
  riskClass: 'protected',
  requiredDecisionCount: 2,
  requiredCapabilities: ['cms.publisher'],
} as const;

const validType = {
  contentTypeId: uuid,
  contentTypeVersionId: uuid2,
  label: 'Article',
  sourceLocale: 'en-US',
  defaultLocale: 'en-US',
  supportedLocales: ['en-US'],
  schemaArtifact,
  validatorRefs: [validatorEvidence],
  workflowPolicy: ordinaryPolicy,
  activationEvidence: ordinaryPolicy,
} as const;

const selectedType = { ...validType } as const;

const validField = {
  stableFieldId: uuid4,
  key: 'display_name',
  kind: 'short_text',
  constraints: { minLength: 1 },
  required: true,
  defaultMode: 'none',
  localizationMode: 'none',
  editorConfig: { label: 'Display name', order: 0 },
  relationDefinition: null,
} as const;

const emptyResource = {
  creatableTypes: [validType],
  selectedType: null,
  fields: [],
} as const;

const selectedResource = {
  creatableTypes: [validType],
  selectedType,
  fields: [validField],
} as const;

/** The canonical field row with the optional defaultValue member removed. */
const withoutDefaultValue = (): Record<string, unknown> => {
  const clone: Record<string, unknown> = { ...validField };
  delete clone.defaultValue;
  return clone;
};

const leakedKeys = [
  'ownerId',
  'assigneeId',
  'createdByPersonId',
  'actingPartyId',
  'registryPrivate',
  'cmsSchemaRegistryRead',
  'extra',
] as const;

describe('CMS-03B-14 authoring-context query', () => {
  it('binds an optional content type version id and nothing else', () => {
    expect(AuthoringContextQuerySchema.parse({})).toEqual({});
    expect(
      AuthoringContextQuerySchema.parse({ contentTypeVersionId: uuid }),
    ).toEqual({ contentTypeVersionId: uuid });
  });

  it('refuses unknown keys and every ownership or registry-private selector', () => {
    for (const leaked of leakedKeys)
      expect(
        AuthoringContextQuerySchema.safeParse({ [leaked]: uuid }).success,
      ).toBe(false);
  });

  it('requires a UUID when the version id is present', () => {
    expect(
      AuthoringContextQuerySchema.safeParse({ contentTypeVersionId: 'nope' })
        .success,
    ).toBe(false);
    expect(
      AuthoringContextQuerySchema.safeParse({ contentTypeVersionId: null })
        .success,
    ).toBe(false);
  });
});

describe('CMS-03B-14 authoring-context type', () => {
  it('parses the canonical author-safe create type', () => {
    expect(AuthoringContextTypeSchema.parse(validType)).toEqual(validType);
  });

  it('trims the label and bounds it to 1..120 characters', () => {
    expect(
      AuthoringContextTypeSchema.safeParse({
        ...validType,
        label: '  Article  ',
      }).success,
    ).toBe(true);
    expect(
      AuthoringContextTypeSchema.parse({ ...validType, label: '  Article  ' })
        .label,
    ).toBe('Article');
    expect(
      AuthoringContextTypeSchema.safeParse({
        ...validType,
        label: 'x'.repeat(120),
      }).success,
    ).toBe(true);
    expect(
      AuthoringContextTypeSchema.safeParse({
        ...validType,
        label: 'x'.repeat(121),
      }).success,
    ).toBe(false);
    expect(
      AuthoringContextTypeSchema.safeParse({ ...validType, label: '   ' })
        .success,
    ).toBe(false);
  });

  it('bounds supported locales to a non-empty set of at most 32', () => {
    expect(
      AuthoringContextTypeSchema.safeParse({
        ...validType,
        supportedLocales: Array.from({ length: 32 }, () => 'en-US'),
      }).success,
    ).toBe(true);
    expect(
      AuthoringContextTypeSchema.safeParse({
        ...validType,
        supportedLocales: Array.from({ length: 33 }, () => 'en-US'),
      }).success,
    ).toBe(false);
    expect(
      AuthoringContextTypeSchema.safeParse({
        ...validType,
        supportedLocales: [],
      }).success,
    ).toBe(false);
    expect(
      AuthoringContextTypeSchema.safeParse({
        ...validType,
        supportedLocales: ['not a locale'],
      }).success,
    ).toBe(false);
  });

  it('bounds validator refs to at most 128 exact validator evidence rows', () => {
    expect(
      AuthoringContextTypeSchema.safeParse({
        ...validType,
        validatorRefs: Array.from({ length: 128 }, () => validatorEvidence),
      }).success,
    ).toBe(true);
    expect(
      AuthoringContextTypeSchema.safeParse({
        ...validType,
        validatorRefs: Array.from({ length: 129 }, () => validatorEvidence),
      }).success,
    ).toBe(false);
    expect(
      AuthoringContextTypeSchema.safeParse({
        ...validType,
        validatorRefs: [{ key: 'Not-A-Key', version: '1' }],
      }).success,
    ).toBe(false);
  });

  it('validates the exact schema artifact and workflow-policy evidence', () => {
    expect(
      AuthoringContextTypeSchema.safeParse({
        ...validType,
        schemaArtifact: { ...schemaArtifact, artifactHash: 'short' },
      }).success,
    ).toBe(false);
    expect(
      AuthoringContextTypeSchema.safeParse({
        ...validType,
        schemaArtifact: { ...schemaArtifact, compilerVersion: '' },
      }).success,
    ).toBe(false);
    expect(
      AuthoringContextTypeSchema.safeParse({
        ...validType,
        schemaArtifact: { ...schemaArtifact, extra: 1 },
      }).success,
    ).toBe(false);
    expect(
      AuthoringContextTypeSchema.safeParse({
        ...validType,
        workflowPolicy: protectedPolicy,
      }).success,
    ).toBe(true);
    expect(
      AuthoringContextTypeSchema.safeParse({
        ...validType,
        workflowPolicy: {
          ...protectedPolicy,
          requiredDecisionCount: 1,
          requiredCapabilities: [],
        },
      }).success,
    ).toBe(false);
  });

  it('refuses unknown keys and ownership or registry-private fields', () => {
    for (const leaked of leakedKeys)
      expect(
        AuthoringContextTypeSchema.safeParse({
          ...validType,
          [leaked]: uuid,
        }).success,
      ).toBe(false);
  });
});

describe('CMS-03B-14 authoring-context field', () => {
  it('parses the canonical field projection', () => {
    expect(AuthoringContextFieldSchema.parse(validField)).toEqual(validField);
  });

  it('accepts an omitted or explicit-null default and refuses a non-JSON default', () => {
    const withoutDefault = withoutDefaultValue();
    expect(AuthoringContextFieldSchema.safeParse(withoutDefault).success).toBe(
      true,
    );
    expect(
      Object.hasOwn(
        AuthoringContextFieldSchema.parse(withoutDefault),
        'defaultValue',
      ),
    ).toBe(false);
    expect(
      AuthoringContextFieldSchema.safeParse({
        ...validField,
        defaultValue: null,
      }).success,
    ).toBe(true);
    expect(
      AuthoringContextFieldSchema.safeParse({
        ...validField,
        defaultValue: { title: 'Hello' },
      }).success,
    ).toBe(true);
    expect(
      AuthoringContextFieldSchema.safeParse({
        ...validField,
        defaultValue: { nested: undefined },
      }).success,
    ).toBe(false);
  });

  it('binds the closed field kind, default mode and localization mode', () => {
    expect(
      AuthoringContextFieldSchema.safeParse({
        ...validField,
        kind: 'not_a_kind',
      }).success,
    ).toBe(false);
    expect(
      AuthoringContextFieldSchema.safeParse({
        ...validField,
        defaultMode: 'sometimes',
      }).success,
    ).toBe(false);
    expect(
      AuthoringContextFieldSchema.safeParse({
        ...validField,
        localizationMode: 'sometimes',
      }).success,
    ).toBe(false);
  });

  it('keeps constraints a JSON record and relationDefinition nullable JSON', () => {
    expect(
      AuthoringContextFieldSchema.safeParse({
        ...validField,
        constraints: {},
      }).success,
    ).toBe(true);
    expect(
      AuthoringContextFieldSchema.safeParse({
        ...validField,
        constraints: { itemKind: 'list' },
        relationDefinition: { targetKind: 'content' },
      }).success,
    ).toBe(true);
    expect(
      AuthoringContextFieldSchema.safeParse({
        ...validField,
        constraints: { bad: undefined },
      }).success,
    ).toBe(false);
  });

  it('trims and bounds the editor config label, help text and order', () => {
    expect(
      AuthoringContextFieldSchema.safeParse({
        ...validField,
        editorConfig: { label: '  Label  ', helpText: '  Help  ', order: 0 },
      }).success,
    ).toBe(true);
    expect(
      AuthoringContextFieldSchema.parse({
        ...validField,
        editorConfig: { label: '  Label  ', helpText: '  Help  ', order: 0 },
      }).editorConfig,
    ).toEqual({ label: 'Label', helpText: 'Help', order: 0 });
    expect(
      AuthoringContextFieldSchema.safeParse({
        ...validField,
        editorConfig: { label: '', order: 0 },
      }).success,
    ).toBe(false);
    expect(
      AuthoringContextFieldSchema.safeParse({
        ...validField,
        editorConfig: { label: 'x'.repeat(121), order: 0 },
      }).success,
    ).toBe(false);
    expect(
      AuthoringContextFieldSchema.safeParse({
        ...validField,
        editorConfig: { label: 'Label', helpText: 'x'.repeat(501), order: 0 },
      }).success,
    ).toBe(false);
    expect(
      AuthoringContextFieldSchema.safeParse({
        ...validField,
        editorConfig: { label: 'Label', order: 10_000 },
      }).success,
    ).toBe(true);
    expect(
      AuthoringContextFieldSchema.safeParse({
        ...validField,
        editorConfig: { label: 'Label', order: 10_001 },
      }).success,
    ).toBe(false);
    expect(
      AuthoringContextFieldSchema.safeParse({
        ...validField,
        editorConfig: { label: 'Label', order: -1 },
      }).success,
    ).toBe(false);
    expect(
      AuthoringContextFieldSchema.safeParse({
        ...validField,
        editorConfig: { label: 'Label', order: 1.5 },
      }).success,
    ).toBe(false);
    expect(
      AuthoringContextFieldSchema.safeParse({
        ...validField,
        editorConfig: { label: 'Label', order: 0, extra: 1 },
      }).success,
    ).toBe(false);
  });

  it('refuses unknown keys and ownership fields on the field row', () => {
    for (const leaked of leakedKeys)
      expect(
        AuthoringContextFieldSchema.safeParse({
          ...validField,
          [leaked]: uuid,
        }).success,
      ).toBe(false);
  });
});

describe('CMS-03B-14 authoring-context resource', () => {
  it('parses the empty selection and the selected projection', () => {
    expect(AuthoringContextResourceSchema.parse(emptyResource)).toEqual(
      emptyResource,
    );
    expect(AuthoringContextResourceSchema.parse(selectedResource)).toEqual(
      selectedResource,
    );
  });

  it('bounds creatable types to at most 32', () => {
    expect(
      AuthoringContextResourceSchema.safeParse({
        ...emptyResource,
        creatableTypes: Array.from({ length: 32 }, () => validType),
      }).success,
    ).toBe(true);
    expect(
      AuthoringContextResourceSchema.safeParse({
        ...emptyResource,
        creatableTypes: Array.from({ length: 33 }, () => validType),
      }).success,
    ).toBe(false);
  });

  it('bounds projected fields to at most 128', () => {
    expect(
      AuthoringContextResourceSchema.safeParse({
        creatableTypes: [validType],
        selectedType,
        fields: Array.from({ length: 128 }, () => validField),
      }).success,
    ).toBe(true);
    expect(
      AuthoringContextResourceSchema.safeParse({
        creatableTypes: [validType],
        selectedType,
        fields: Array.from({ length: 129 }, () => validField),
      }).success,
    ).toBe(false);
  });

  it('refuses an unknown key and every ownership or registry-private field', () => {
    for (const leaked of leakedKeys)
      expect(
        AuthoringContextResourceSchema.safeParse({
          ...selectedResource,
          [leaked]: uuid,
        }).success,
      ).toBe(false);
  });
});

describe('CMS-03B-14 authoring-context read precedence', () => {
  it('reads the creatable set with no selection and no returned fields', () => {
    expect(
      AuthoringContextReadSchema.parse({ query: {}, resource: emptyResource }),
    ).toEqual({ query: {}, resource: emptyResource });
  });

  it('reads the selected projection when the version id is present', () => {
    expect(
      AuthoringContextReadSchema.safeParse({
        query: { contentTypeVersionId: uuid2 },
        resource: selectedResource,
      }).success,
    ).toBe(true);
  });

  it('forces selectedType null and empty fields when the version id is absent', () => {
    expect(
      AuthoringContextReadSchema.safeParse({
        query: {},
        resource: { creatableTypes: [validType], selectedType, fields: [] },
      }).success,
    ).toBe(false);
    expect(
      AuthoringContextReadSchema.safeParse({
        query: {},
        resource: {
          creatableTypes: [validType],
          selectedType: null,
          fields: [validField],
        },
      }).success,
    ).toBe(false);
  });

  it('forces a non-null selected type that matches the requested version', () => {
    expect(
      AuthoringContextReadSchema.safeParse({
        query: { contentTypeVersionId: uuid2 },
        resource: {
          creatableTypes: [validType],
          selectedType: null,
          fields: [],
        },
      }).success,
    ).toBe(false);
    expect(
      AuthoringContextReadSchema.safeParse({
        query: { contentTypeVersionId: uuid3 },
        resource: selectedResource,
      }).success,
    ).toBe(false);
  });

  it('refuses unknown keys and caller-supplied authority on the read envelope', () => {
    const read = { query: {}, resource: emptyResource };
    for (const leaked of leakedKeys)
      expect(
        AuthoringContextReadSchema.safeParse({ ...read, [leaked]: uuid })
          .success,
      ).toBe(false);
  });

  it('validates nested evidence through the read envelope', () => {
    expect(
      AuthoringContextReadSchema.safeParse({
        query: { contentTypeVersionId: uuid2 },
        resource: {
          ...selectedResource,
          selectedType: {
            ...selectedType,
            schemaArtifact: { ...schemaArtifact, artifactHash: 'short' },
          },
        },
      }).success,
    ).toBe(false);
  });
});
