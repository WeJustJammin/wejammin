import { describe, expect, it } from 'vitest';

import { buildOpenApiDocument } from '../../../../infra/openapi-document.mjs';
import {
  ContentTypeDraftRequestSchema,
  ContentTypeVersionResourceSchema,
  SchemaActivatedEventPayloadSchema,
  SchemaActivationResourceSchema,
  SchemaReviewFrozenEvidenceSchema,
  SchemaSuccessorRequestSchema,
} from './index';
import {
  frozenEvidence,
  hash,
  hash2,
  instant,
  meta,
  uuid,
  uuid2,
} from './review-fixtures.test-support';

const policyEvidence = {
  key: 'cms.schema.protected',
  version: '1',
  policyHash: hash,
  riskClass: 'ordinary' as const,
  requiredDecisionCount: 1,
  requiredCapabilities: [],
  approvalEvidenceHash: hash2,
};

const localeConfig = {
  supportedLocales: ['en-US', 'fr-FR'],
  fallbackChains: { 'fr-FR': ['en-US'] },
} as const;

const omit = (
  value: Readonly<Record<string, unknown>>,
  key: string,
): Record<string, unknown> =>
  Object.fromEntries(Object.entries(value).filter(([name]) => name !== key));

const draft = {
  typeKey: 'release_notes',
  label: 'Release notes',
  ownerCapability: 'cms.schema_designer',
  sourceLocale: 'en-US',
  defaultLocale: 'en-US',
  ...localeConfig,
  workflowKey: 'cms.standard',
  workflowVersion: '1',
  defaultTemplateVersionId: null,
  fields: [],
  relations: [],
  templateBindings: [],
  capabilityBindings: [],
};

const issues = (
  schema: {
    safeParse: (value: unknown) => {
      success: boolean;
      error?: { issues: { path: PropertyKey[]; message: string }[] };
    };
  },
  value: unknown,
) => {
  const result = schema.safeParse(value);
  return result.success
    ? []
    : (result.error?.issues ?? []).map((issue) => ({
        path: issue.path,
        message: issue.message,
      }));
};

describe('CMS-03A-01 locale configuration', () => {
  it('carries supportedLocales and fallbackChains on the draft request', () => {
    expect(ContentTypeDraftRequestSchema.parse(draft)).toMatchObject(
      localeConfig,
    );
  });

  it('requires both locale fields with no defaults', () => {
    const withoutSupported = omit(draft, 'supportedLocales');
    const withoutChains = omit(draft, 'fallbackChains');
    expect(
      ContentTypeDraftRequestSchema.safeParse(withoutSupported).success,
    ).toBe(false);
    expect(ContentTypeDraftRequestSchema.safeParse(withoutChains).success).toBe(
      false,
    );
  });

  it('accepts a single-locale type with an empty chain map', () => {
    expect(
      ContentTypeDraftRequestSchema.safeParse({
        ...draft,
        supportedLocales: ['en-US'],
        fallbackChains: {},
      }).success,
    ).toBe(true);
  });

  it('returns the exact table messages with the table paths', () => {
    expect(
      issues(ContentTypeDraftRequestSchema, {
        ...draft,
        supportedLocales: ['en-US', 'fr-FR'],
        fallbackChains: { 'fr-FR': ['pt-BR', 'en-US'], 'de-DE': ['en-US'] },
      }),
    ).toEqual([
      {
        path: ['fallbackChains', 'de-DE'],
        message: 'fallbackChains key must be a supported locale',
      },
      {
        path: ['fallbackChains', 'fr-FR', 0],
        message: 'fallback chain locale must be a supported locale',
      },
    ]);
  });

  it('refuses a non-canonical sourceLocale at its own path', () => {
    expect(
      issues(ContentTypeDraftRequestSchema, {
        ...draft,
        sourceLocale: 'en-us',
      }),
    ).toContainEqual({
      path: ['sourceLocale'],
      message: 'locale tag must be a canonical-case BCP 47 tag',
    });
  });

  it('refuses a source that is not in supportedLocales', () => {
    expect(
      issues(ContentTypeDraftRequestSchema, {
        ...draft,
        sourceLocale: 'de-DE',
      }),
    ).toEqual([
      {
        path: ['supportedLocales'],
        message: 'supportedLocales must include sourceLocale',
      },
    ]);
  });

  it('refuses a cycle and a chain that does not end at the default', () => {
    expect(
      issues(ContentTypeDraftRequestSchema, {
        ...draft,
        supportedLocales: ['en-US', 'fr-FR', 'pt-BR'],
        fallbackChains: {
          'fr-FR': ['pt-BR', 'en-US'],
          'pt-BR': ['fr-FR', 'en-US'],
        },
      }),
    ).toEqual([
      {
        path: ['fallbackChains'],
        message: 'fallback chains must not form a cycle',
      },
    ]);
    expect(
      issues(ContentTypeDraftRequestSchema, {
        ...draft,
        supportedLocales: ['en-US', 'fr-FR', 'pt-BR'],
        fallbackChains: { 'fr-FR': ['en-US', 'pt-BR'], 'pt-BR': ['en-US'] },
      }),
    ).toEqual([
      {
        path: ['fallbackChains', 'fr-FR'],
        message: 'fallback chain must end at defaultLocale',
      },
    ]);
  });

  it('refuses non-string and non-array wire shapes', () => {
    expect(
      ContentTypeDraftRequestSchema.safeParse({
        ...draft,
        supportedLocales: 'en-US',
      }).success,
    ).toBe(false);
    expect(
      ContentTypeDraftRequestSchema.safeParse({
        ...draft,
        fallbackChains: { 'fr-FR': 'en-US' },
      }).success,
    ).toBe(false);
    expect(
      ContentTypeDraftRequestSchema.safeParse({
        ...draft,
        fallbackChains: [['en-US']],
      }).success,
    ).toBe(false);
  });

  it('does not accept a stored-order or hash field from the client', () => {
    expect(
      ContentTypeDraftRequestSchema.safeParse({
        ...draft,
        localeConfigHash: hash,
      }).success,
    ).toBe(false);
  });
});

describe('CMS-03A-09 successor locale configuration', () => {
  it('accepts both null (clone the source configuration)', () => {
    expect(
      SchemaSuccessorRequestSchema.parse({
        expectedVersion: '3',
        supportedLocales: null,
        fallbackChains: null,
      }),
    ).toEqual({
      expectedVersion: '3',
      supportedLocales: null,
      fallbackChains: null,
    });
  });

  it('accepts both present (replace the configuration)', () => {
    expect(
      SchemaSuccessorRequestSchema.safeParse({
        expectedVersion: '3',
        ...localeConfig,
      }).success,
    ).toBe(true);
  });

  it('refuses one of the pair without the other with the exact message', () => {
    const expected = [
      {
        path: ['fallbackChains'],
        message:
          'supportedLocales and fallbackChains must be both null or both present',
      },
    ];
    expect(
      issues(SchemaSuccessorRequestSchema, {
        expectedVersion: '3',
        supportedLocales: ['en-US'],
        fallbackChains: null,
      }),
    ).toEqual(expected);
    expect(
      issues(SchemaSuccessorRequestSchema, {
        expectedVersion: '3',
        supportedLocales: null,
        fallbackChains: {},
      }),
    ).toEqual(expected);
  });

  it('requires both fields to be present as keys', () => {
    expect(
      SchemaSuccessorRequestSchema.safeParse({ expectedVersion: '3' }).success,
    ).toBe(false);
  });

  it('validates a replacement without the inherited source and default', () => {
    expect(
      issues(SchemaSuccessorRequestSchema, {
        expectedVersion: '3',
        supportedLocales: ['en-US', 'fr-FR'],
        fallbackChains: { 'fr-FR': ['de-DE'] },
      }),
    ).toEqual([
      {
        path: ['fallbackChains', 'fr-FR', 0],
        message: 'fallback chain locale must be a supported locale',
      },
    ]);
    expect(
      issues(SchemaSuccessorRequestSchema, {
        expectedVersion: '3',
        supportedLocales: ['en-US', 'en-US'],
        fallbackChains: {},
      }),
    ).toContainEqual({
      path: ['supportedLocales', 1],
      message: 'supportedLocales must be unique',
    });
  });

  it('stays strict', () => {
    expect(
      SchemaSuccessorRequestSchema.safeParse({
        expectedVersion: '3',
        supportedLocales: null,
        fallbackChains: null,
        sourceLocale: 'en-US',
      }).success,
    ).toBe(false);
  });
});

const versionResource = {
  ...meta,
  resourceKind: 'content_type_version' as const,
  state: 'draft' as const,
  contentTypeId: uuid2,
  typeKey: 'release_notes',
  label: 'Release notes',
  ownerCapability: 'cms.schema_designer',
  sourceLocale: 'en-US',
  defaultLocale: 'en-US',
  ...localeConfig,
  localeConfigHash: hash,
  workflowKey: 'cms.standard',
  workflowVersion: '1',
  defaultTemplateVersionId: null,
  schemaArtifactId: uuid,
  fieldCount: 0,
  relationCount: 0,
  capabilityBindingCount: 0,
  compatibility: 'unknown' as const,
  dryRunId: null,
  activationEvidence: null,
};

describe('locale configuration in resources, evidence and events', () => {
  it('ContentTypeVersionResource exposes the configuration and hash', () => {
    expect(
      ContentTypeVersionResourceSchema.parse(versionResource),
    ).toMatchObject({ ...localeConfig, localeConfigHash: hash });
  });

  it.each(['supportedLocales', 'fallbackChains', 'localeConfigHash'])(
    'ContentTypeVersionResource requires %s',
    (key) => {
      const rest = omit(versionResource, key);
      expect(ContentTypeVersionResourceSchema.safeParse(rest).success).toBe(
        false,
      );
    },
  );

  it('ContentTypeVersionResource refuses a configuration that breaks the rules', () => {
    expect(
      ContentTypeVersionResourceSchema.safeParse({
        ...versionResource,
        fallbackChains: {},
      }).success,
    ).toBe(false);
    expect(
      ContentTypeVersionResourceSchema.safeParse({
        ...versionResource,
        localeConfigHash: 'A'.repeat(64),
      }).success,
    ).toBe(false);
  });

  it('SchemaActivationResource carries localeConfigHash', () => {
    const activation = {
      ...meta,
      state: 'active' as const,
      contentTypeVersionId: uuid,
      activatedAt: instant,
      migrationPlanId: null,
      localeConfigHash: hash,
      activationEvidence: policyEvidence,
      jobId: null,
      eventType: 'cms.schema.activated.v1' as const,
    };
    expect(
      SchemaActivationResourceSchema.parse(activation).localeConfigHash,
    ).toBe(hash);
    const without = omit(activation, 'localeConfigHash');
    expect(SchemaActivationResourceSchema.safeParse(without).success).toBe(
      false,
    );
  });

  it('SchemaReviewFrozenEvidence freezes localeConfigHash', () => {
    expect(
      SchemaReviewFrozenEvidenceSchema.parse(frozenEvidence).localeConfigHash,
    ).toBe(hash2);
    const without = omit(frozenEvidence, 'localeConfigHash');
    expect(SchemaReviewFrozenEvidenceSchema.safeParse(without).success).toBe(
      false,
    );
  });

  it('cms.schema.activated.v1 payload is a strict object with localeConfigHash', () => {
    const payload = {
      contentTypeId: uuid2,
      schemaVersionId: uuid,
      migrationPlanId: null,
      localeConfigHash: hash,
      activationEvidence: policyEvidence,
    };
    expect(SchemaActivatedEventPayloadSchema.parse(payload)).toEqual(payload);
    const without = omit(payload, 'localeConfigHash');
    expect(SchemaActivatedEventPayloadSchema.safeParse(without).success).toBe(
      false,
    );
    expect(
      SchemaActivatedEventPayloadSchema.safeParse({ ...payload, extra: 1 })
        .success,
    ).toBe(false);
  });
});

type JsonSchema = Record<string, unknown>;
const schemas = (
  buildOpenApiDocument() as unknown as {
    components: {
      schemas: Record<string, { properties: Record<string, JsonSchema> }>;
    };
  }
).components.schemas;

describe('locale configuration OpenAPI projection', () => {
  it('bounds supportedLocales and fallbackChains on the draft request', () => {
    const properties = schemas.ContentTypeDraftRequest?.properties;
    expect(properties?.supportedLocales).toMatchObject({
      type: 'array',
      minItems: 1,
      maxItems: 32,
      items: { type: 'string', minLength: 2, maxLength: 35 },
    });
    expect(properties?.fallbackChains).toMatchObject({
      type: 'object',
      maxProperties: 31,
      additionalProperties: {
        type: 'array',
        minItems: 1,
        maxItems: 16,
      },
    });
  });

  it('marks the successor pair nullable and the resource fields required', () => {
    const successor = schemas.SchemaSuccessorRequest?.properties;
    expect(Object.keys(successor ?? {}).sort()).toEqual([
      'expectedVersion',
      'fallbackChains',
      'supportedLocales',
    ]);
    const resource = schemas.ContentTypeVersionResource as unknown as {
      required: string[];
    };
    expect(resource.required).toEqual(
      expect.arrayContaining([
        'supportedLocales',
        'fallbackChains',
        'localeConfigHash',
      ]),
    );
  });
});

describe('CMS-03C-04 OpenAPI fallback-chain equality conflict', () => {
  it('documents the 409 reason, the active chain and the 422 membership rule', () => {
    const document = buildOpenApiDocument() as unknown as {
      paths: Record<
        string,
        {
          post: {
            responses: Record<string, { description: string }>;
          };
        }
      >;
    };
    const responses =
      document.paths['/api/v1/cms/entries/{entryId}/locales/{locale}/variants']
        ?.post.responses;
    expect(responses?.['409']?.description).toContain(
      'FALLBACK_CHAIN_MISMATCH',
    );
    expect(responses?.['409']?.description).toContain('activeFallbackChain');
    expect(responses?.['422']?.description).toContain('supportedLocales');
  });
});
