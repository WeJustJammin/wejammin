/**
 * BE03a acceptance evidence that is provable from the wire contracts alone:
 * SchemaSuccessorRequest strictness, the ContentTypeVersionResource locale
 * exposure on list rows and detail, the SchemaActivationPreparation envelope,
 * and the browser-facing privacy of the review and activation schemas.
 */
import { describe, expect, it } from 'vitest';

import { buildOpenApiDocument } from '../../../../infra/openapi-document.mjs';
import {
  contentSchemaRegistryRoutePolicies,
  ContentSchemaRegistryDetailSchema,
  ContentSchemaRegistryListPageSchema,
  ContentTypeDraftRequestSchema,
  WorkflowPolicyEvidenceSchema,
  ContentTypeVersionResourceSchema,
  SchemaActivationPreparationSchema,
  SchemaSuccessorRequestSchema,
} from './index';
import {
  compatibleTemplate,
  hash,
  meta,
  preparation,
  uuid,
  uuid2,
  uuid3,
} from './review-fixtures.test-support';

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
  supportedLocales: ['en-US', 'fr-FR'],
  fallbackChains: { 'fr-FR': ['en-US'] },
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

const OWNERSHIP_KEYS = [
  'ownerId',
  'ownerPartyId',
  'organizationId',
  'actorId',
  'actingPartyId',
  'bindingId',
  'bindingContextHash',
  'createdByPersonId',
];

describe('BE03a CMS-03A-09 request object', () => {
  it('[P2-S09-AC-285] SchemaSuccessorRequest is a strict object that carries only expectedVersion plus the OD-4 locale pair and rejects unknown keys', () => {
    const base = {
      expectedVersion: '1',
      supportedLocales: null,
      fallbackChains: null,
    };
    expect(SchemaSuccessorRequestSchema.safeParse(base).success).toBe(true);
    for (const key of [
      ...OWNERSHIP_KEYS,
      'sourceLocale',
      'defaultLocale',
      'contentTypeVersionId',
      'callerPolicy',
      'extra',
    ])
      expect(
        SchemaSuccessorRequestSchema.safeParse({ ...base, [key]: 'x' }).success,
        key,
      ).toBe(false);
    expect(
      SchemaSuccessorRequestSchema.safeParse({ expectedVersion: '1' }).success,
    ).toBe(false);
  });
});

describe('BE03a content-type version locale exposure', () => {
  const record = { ...versionResource };

  it('[P2-S09-AC-1198] ContentTypeVersionResource in CMS-03A-07 and in CMS-03A-06 list rows exposes supportedLocales, fallbackChains and localeConfigHash with no ownership identifier', () => {
    const page = ContentSchemaRegistryListPageSchema.parse({
      items: [record],
      nextCursor: null,
    });
    expect(page.items[0]).toMatchObject({
      supportedLocales: ['en-US', 'fr-FR'],
      fallbackChains: { 'fr-FR': ['en-US'] },
      localeConfigHash: hash,
    });
    for (const key of [
      'supportedLocales',
      'fallbackChains',
      'localeConfigHash',
    ]) {
      const rest = Object.fromEntries(
        Object.entries(record).filter(([name]) => name !== key),
      );
      expect(
        ContentSchemaRegistryListPageSchema.safeParse({
          items: [rest],
          nextCursor: null,
        }).success,
        key,
      ).toBe(false);
      expect(ContentTypeVersionResourceSchema.safeParse(rest).success).toBe(
        false,
      );
    }
    for (const key of OWNERSHIP_KEYS) {
      expect(
        ContentSchemaRegistryListPageSchema.safeParse({
          items: [{ ...record, [key]: uuid }],
          nextCursor: null,
        }).success,
        key,
      ).toBe(false);
      expect(
        ContentSchemaRegistryDetailSchema.safeParse({
          resourceKind: 'content_type_version',
          resource: { ...record, [key]: uuid },
        }).success,
      ).toBe(false);
    }
  });
});

describe('BE03a activationPreparation envelope', () => {
  const parses = (value: unknown): boolean =>
    SchemaActivationPreparationSchema.safeParse(value).success;

  it('[P2-S09-AC-635] activationPreparation carries dryRunRef, jobRef, reviewRef, optional templateCompatibility and permittedNextActions only', () => {
    expect(parses(preparation)).toBe(true);
    expect(
      parses({ ...preparation, templateCompatibility: compatibleTemplate }),
    ).toBe(true);
    const withoutJob = Object.fromEntries(
      Object.entries(preparation).filter(([name]) => name !== 'jobRef'),
    );
    expect(parses(withoutJob)).toBe(false);
    for (const key of [
      'readiness',
      'policyKey',
      'riskClass',
      'requiredDecisionCount',
      'reviewerPersonId',
      'rawContent',
      'ownerId',
    ])
      expect(parses({ ...preparation, [key]: 'x' }), key).toBe(false);
    for (const nested of ['dryRunRef', 'jobRef', 'reviewRef'] as const)
      expect(
        parses({
          ...preparation,
          [nested]: { ...preparation[nested], extra: 'x' },
        }),
        nested,
      ).toBe(false);
  });

  it('[P2-S09-AC-637] permittedNextActions is a closed set of at most six of create_successor, start_dry_run, submit_review, assign_reviewer, record_decision and activate', () => {
    const all = [
      'create_successor',
      'start_dry_run',
      'submit_review',
      'assign_reviewer',
      'record_decision',
      'activate',
    ];
    expect(parses({ ...preparation, permittedNextActions: all })).toBe(true);
    expect(parses({ ...preparation, permittedNextActions: [] })).toBe(true);
    expect(
      parses({ ...preparation, permittedNextActions: [...all, 'activate'] }),
    ).toBe(false);
    for (const action of ['retire', 'schedule', 'ACTIVATE', 'approve', ''])
      expect(
        parses({ ...preparation, permittedNextActions: [action] }),
        action,
      ).toBe(false);
  });

  it('[P2-S09-AC-638] activationPreparation never reports a queued or running dry run as passed and treats only a completed passed report as satisfiable readiness', () => {
    for (const state of ['queued', 'running'])
      expect(
        parses({
          ...preparation,
          dryRunRef: { ...preparation.dryRunRef, state, result: 'passed' },
        }),
        state,
      ).toBe(false);
    expect(
      parses({
        ...preparation,
        dryRunRef: {
          ...preparation.dryRunRef,
          state: 'failed',
          result: 'passed',
        },
      }),
    ).toBe(false);
    expect(parses(preparation)).toBe(true);
    expect(
      parses({
        ...preparation,
        dryRunRef: { ...preparation.dryRunRef, result: 'failed' },
      }),
    ).toBe(true);
    for (const state of ['queued', 'running'])
      expect(
        parses({
          ...preparation,
          dryRunRef: { ...preparation.dryRunRef, state, result: null },
        }),
        state,
      ).toBe(true);
  });

  it('[P2-S09-AC-639] activationPreparation contains no actor ownership identifier, private binding id, raw content or caller-authoritative policy field', () => {
    for (const key of [
      ...OWNERSHIP_KEYS,
      'rawContent',
      'sourceRows',
      'workflowKey',
      'callerPolicy',
      'requiredCapabilities',
    ]) {
      expect(parses({ ...preparation, [key]: uuid }), key).toBe(false);
      expect(
        parses({
          ...preparation,
          reviewRef: { ...preparation.reviewRef, [key]: uuid3 },
        }),
        key,
      ).toBe(false);
    }
  });
});

type JsonSchema = Readonly<Record<string, unknown>>;
const collectKeys = (schema: unknown, into: Set<string>): Set<string> => {
  if (typeof schema !== 'object' || schema === null) return into;
  const record = schema as JsonSchema;
  const properties = record.properties;
  if (typeof properties === 'object' && properties !== null)
    for (const key of Object.keys(properties)) into.add(key);
  for (const value of Object.values(record)) collectKeys(value, into);
  return into;
};

describe('BE03a browser-facing privacy of the review and activation schemas', () => {
  const schemas = (
    buildOpenApiDocument() as unknown as {
      components: { schemas: Record<string, JsonSchema> };
    }
  ).components.schemas;
  const browserFacing = Object.keys(schemas).filter(
    (name) =>
      /^(SchemaReview|SchemaActivation|SchemaDryRun|ContentSchemaRegistryDetail|ContentTypeVersion|CmsCapabilityGrant)/u.test(
        name,
      ) && !/(Request|Params|Query)$/u.test(name),
  );

  it('[P2-S09-AC-640] the private actor, person, party and binding projection hash is never exposed to the browser as an evidence field or correlation token', () => {
    expect(browserFacing.length).toBeGreaterThanOrEqual(8);
    const forbidden =
      /(actor|person|party|binding|owner|acting).*(hash|projection|context)|(hash|projection).*(actor|person|party|binding|owner)|^bindingId$|^actorId$|^actingPartyId$|^ownerId$/iu;
    for (const name of browserFacing) {
      const keys = [...collectKeys(schemas[name], new Set())];
      expect(
        keys.filter((key) => forbidden.test(key)),
        name,
      ).toEqual([]);
    }
  });

  it('[P2-S09-AC-710] the template compatibility projection reaches the browser only as the optional templateCompatibility member of activationPreparation and only for a compatible result', () => {
    const carriers = Object.keys(schemas).filter((name) =>
      collectKeys(schemas[name], new Set()).has('templateCompatibility'),
    );
    expect(carriers.sort()).toEqual(
      ['ContentSchemaRegistryDetail', 'SchemaActivationPreparation'].sort(),
    );
    expect(
      SchemaActivationPreparationSchema.safeParse({
        ...preparation,
        templateCompatibility: { ...compatibleTemplate, compatible: false },
      }).success,
    ).toBe(false);
    expect(
      SchemaActivationPreparationSchema.safeParse({
        ...preparation,
        templateCompatibility: { ...compatibleTemplate, withdrawn: true },
      }).success,
    ).toBe(false);
    const paths = Object.keys(
      (buildOpenApiDocument() as unknown as { paths: Record<string, unknown> })
        .paths,
    );
    expect(
      paths.filter((path) => /compatib|resolve-template/iu.test(path)),
    ).toEqual([]);
  });
});

describe('BE03a generated OpenAPI parity', () => {
  it('[P2-S09-AC-019] the generated OpenAPI matches every BE03a route-registry row with no missing, extra, duplicate or stale operation', () => {
    const policies = contentSchemaRegistryRoutePolicies as readonly {
      operationId: string;
      method: string;
      path: string;
    }[];
    expect(policies).toHaveLength(18);
    const document = buildOpenApiDocument() as unknown as {
      paths: Record<string, Record<string, { operationId?: string }>>;
    };
    const generated = Object.entries(document.paths).flatMap(
      ([path, operations]) =>
        Object.entries(operations).flatMap(([method, operation]) =>
          operation.operationId?.startsWith('CMS-03A-') === true
            ? [
                {
                  id: operation.operationId,
                  key: `${method.toUpperCase()} ${path}`,
                },
              ]
            : [],
        ),
    );
    expect(generated).toHaveLength(18);
    expect(new Set(generated.map((entry) => entry.id)).size).toBe(18);
    for (const policy of policies)
      expect(
        generated.find((entry) => entry.id === policy.operationId)?.key,
      ).toBe(`${policy.method} ${policy.path}`);
    expect(generated.map((entry) => entry.id).sort()).toEqual(
      policies.map((policy) => policy.operationId).sort(),
    );
  });
});

const DRAFT_KEYS = [
  'capabilityBindings',
  'defaultLocale',
  'defaultTemplateVersionId',
  'fallbackChains',
  'fields',
  'label',
  'ownerCapability',
  'relations',
  'sourceLocale',
  'supportedLocales',
  'templateBindings',
  'typeKey',
  'workflowKey',
  'workflowVersion',
];
const draftRequest = {
  typeKey: 'release_notes',
  label: 'Release notes',
  ownerCapability: 'cms.schema_designer',
  sourceLocale: 'en-US',
  defaultLocale: 'en-US',
  supportedLocales: ['en-US'],
  fallbackChains: {},
  workflowKey: 'cms.standard',
  workflowVersion: '1',
  defaultTemplateVersionId: null,
  fields: [],
  relations: [],
  templateBindings: [],
  capabilityBindings: [],
};

describe('BE03a CMS-03A-01 request and CMS-03A-04 evidence shapes', () => {
  it('[P2-S09-AC-039] ContentTypeDraftRequest is a strict object with exactly typeKey, label, ownerCapability, sourceLocale, defaultLocale, supportedLocales, fallbackChains, workflowKey, workflowVersion, defaultTemplateVersionId, fields, relations, templateBindings and capabilityBindings', () => {
    expect(Object.keys(draftRequest).sort()).toEqual(DRAFT_KEYS);
    expect(ContentTypeDraftRequestSchema.safeParse(draftRequest).success).toBe(
      true,
    );
    for (const key of DRAFT_KEYS) {
      const without = Object.fromEntries(
        Object.entries(draftRequest).filter(([name]) => name !== key),
      );
      expect(
        ContentTypeDraftRequestSchema.safeParse(without).success,
        key,
      ).toBe(false);
    }
    for (const extra of [
      'ownerId',
      'actorId',
      'localeConfigHash',
      'state',
      'contentHash',
      'id',
    ])
      expect(
        ContentTypeDraftRequestSchema.safeParse({
          ...draftRequest,
          [extra]: 'x',
        }).success,
        extra,
      ).toBe(false);
  });

  it('[P2-S09-AC-090] frozen WorkflowPolicyEvidence contains key, version, policyHash, riskClass, requiredDecisionCount 1 to 8, requiredCapabilities and approvalEvidenceHash', () => {
    const evidence = {
      key: 'cms.standard',
      version: '1',
      policyHash: hash,
      riskClass: 'ordinary' as const,
      requiredDecisionCount: 1,
      requiredCapabilities: ['cms.reviewer'],
      approvalEvidenceHash: hash,
    };
    const parses = (value: unknown): boolean =>
      WorkflowPolicyEvidenceSchema.safeParse(value).success;
    expect(parses(evidence)).toBe(true);
    for (const key of Object.keys(evidence))
      expect(
        parses(
          Object.fromEntries(
            Object.entries(evidence).filter(([name]) => name !== key),
          ),
        ),
        key,
      ).toBe(false);
    expect(parses({ ...evidence, extra: 1 })).toBe(false);
    for (const count of [0, 9, 1.5, -1])
      expect(
        parses({ ...evidence, requiredDecisionCount: count }),
        `${count}`,
      ).toBe(false);
    for (const count of [1, 8])
      expect(
        parses({
          ...evidence,
          riskClass: 'ordinary',
          requiredDecisionCount: count,
        }),
        `${count}`,
      ).toBe(true);
    expect(parses({ ...evidence, riskClass: 'critical' })).toBe(false);
    expect(parses({ ...evidence, policyHash: 'A'.repeat(64) })).toBe(false);
  });
});
