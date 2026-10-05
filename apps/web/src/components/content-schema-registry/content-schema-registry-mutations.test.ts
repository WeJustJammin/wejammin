import { describe, expect, it, vi } from 'vitest';

import {
  forwardContentSchemaRegistryMutation,
  type ContentSchemaRegistryMutationTarget,
} from '../../server/content-schema-registry-platform-api';

const TYPE_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132da';
const VERSION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132db';
const FIELD_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dc';
const REQUEST_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dd';
const HASH = 'a'.repeat(64);
const INSTANT = '2026-09-02T12:00:00.000Z';

const baseHeaders = {
  cookie: 'wj_access=session; wj_csrf=csrf; tracking=omit',
  origin: 'https://app.test',
  'x-request-id': REQUEST_ID,
  'x-correlation-id': REQUEST_ID,
};

const typeResource = {
  id: VERSION_ID,
  version: '4',
  contentHash: HASH,
  createdAt: INSTANT,
  updatedAt: INSTANT,
  resourceKind: 'content_type_version',
  state: 'draft',
  contentTypeId: TYPE_ID,
  typeKey: 'release_note',
  label: 'Release note',
  ownerCapability: 'cms.schema_designer',
  sourceLocale: 'en-US',
  defaultLocale: 'en-US',
  supportedLocales: ['en-US'],
  fallbackChains: {},
  localeConfigHash: 'c'.repeat(64),
  workflowKey: 'cms.content.workflow',
  workflowVersion: '1',
  defaultTemplateVersionId: null,
  schemaArtifactId: FIELD_ID,
  fieldCount: 0,
  relationCount: 0,
  capabilityBindingCount: 0,
  compatibility: 'additive',
  dryRunId: null,
  activationEvidence: null,
} as const;

const fieldResource = {
  id: FIELD_ID,
  version: '5',
  contentHash: HASH,
  createdAt: INSTANT,
  updatedAt: INSTANT,
  resourceKind: 'field_definition_version',
  contentTypeVersionId: VERSION_ID,
  stableFieldId: FIELD_ID,
  key: 'title',
  kind: 'short_text',
  required: true,
  validatorKey: null,
  validatorVersion: null,
  defaultMode: 'none',
  localizationMode: 'none',
  lifecycle: 'active',
  migrationPlanId: null,
} as const;

const validDraft = {
  typeKey: 'release_note',
  label: 'Release note',
  ownerCapability: 'cms.schema_designer',
  sourceLocale: 'en-US',
  defaultLocale: 'en-US',
  supportedLocales: ['en-US'],
  fallbackChains: {},
  workflowKey: 'cms.content.workflow',
  workflowVersion: '1',
  defaultTemplateVersionId: null,
  fields: [],
  relations: [],
  templateBindings: [],
  capabilityBindings: [],
};

const validField = {
  stableFieldId: FIELD_ID,
  key: 'title',
  kind: 'short_text',
  constraints: {},
  required: true,
  validatorKey: null,
  validatorVersion: null,
  defaultMode: 'none',
  localizationMode: 'none',
  editorConfig: { label: 'Title', order: 0 },
  lifecycle: 'active',
  migrationPlanId: null,
};

const call = async (
  target: ContentSchemaRegistryMutationTarget,
  payload: unknown,
  responseBody: unknown,
  extraHeaders: Record<string, string> = {},
  contentType = 'application/json',
) => {
  let forwarded: Request | null = null;
  const binding = {
    fetch: vi.fn(async (input: RequestInfo | URL) => {
      forwarded = input instanceof Request ? input : new Request(input);
      return new Response(JSON.stringify(responseBody), {
        status: target.operationId === 'CMS-03A-04' ? 202 : 201,
        headers: { 'content-type': 'application/json', etag: '"5"' },
      });
    }),
  };
  const request = new Request('https://app.test/app/cms-content-modeling', {
    method: 'POST',
    headers: {
      ...baseHeaders,
      'content-type': contentType,
      'x-csrf-token': 'csrf',
      'idempotency-key': 'cms-operation-123',
      ...extraHeaders,
    },
    body: contentType.startsWith('application/json')
      ? JSON.stringify(payload)
      : new URLSearchParams(payload as Record<string, string>),
  });
  const response = await forwardContentSchemaRegistryMutation(
    request,
    binding,
    target,
  );
  return { response, binding, forwarded: forwarded as Request | null };
};

describe('content schema registry mutation facade', () => {
  it('validates and forwards A01 as generated JSON without form transport fields', async () => {
    const { response, forwarded } = await call(
      { operationId: 'CMS-03A-01' },
      validDraft,
      typeResource,
    );
    expect(response.status).toBe(201);
    expect(forwarded?.url).toBe(
      'https://platform-api.internal/api/v1/cms/content-types',
    );
    expect(forwarded?.method).toBe('POST');
    expect(forwarded?.headers.get('content-type')).toBe('application/json');
    expect(forwarded?.headers.get('idempotency-key')).toBe('cms-operation-123');
    expect(forwarded?.headers.get('if-match')).toBeNull();
    expect(forwarded?.headers.get('x-csrf-token')).toBe('csrf');
    expect(forwarded?.headers.get('cookie')).toBe(
      'wj_access=session; wj_csrf=csrf',
    );
    const body = await forwarded?.clone().json();
    expect(body).toEqual(validDraft);
    expect(JSON.stringify(body)).not.toContain('csrf');
  });

  it('binds A02 path IDs and exact If-Match while rejecting mismatched headers', async () => {
    const success = await call(
      {
        operationId: 'CMS-03A-02',
        contentTypeId: TYPE_ID,
        versionId: VERSION_ID,
      },
      validField,
      fieldResource,
      { 'if-match': '"4"' },
    );
    expect(success.response.status).toBe(201);
    expect(success.forwarded?.url).toBe(
      `https://platform-api.internal/api/v1/cms/content-types/${TYPE_ID}/versions/${VERSION_ID}/fields`,
    );
    expect(success.forwarded?.headers.get('if-match')).toBe('"4"');

    const mismatch = await call(
      {
        operationId: 'CMS-03A-02',
        contentTypeId: TYPE_ID,
        versionId: VERSION_ID,
      },
      { ...validField, ifMatch: '"3"' },
      fieldResource,
      { 'if-match': '"4"' },
    );
    expect(mismatch.response.status).toBe(422);
    expect(mismatch.binding.fetch).not.toHaveBeenCalled();
  });

  it('fails closed for missing CSRF, invalid path IDs, and non-JSON upstream responses', async () => {
    const missingCsrfRequest = new Request(
      'https://app.test/app/cms-content-modeling',
      {
        method: 'POST',
        headers: {
          ...baseHeaders,
          'content-type': 'application/json',
          'idempotency-key': 'cms-operation-123',
        },
        body: JSON.stringify(validDraft),
      },
    );
    const binding = { fetch: vi.fn() };
    const missingCsrf = await forwardContentSchemaRegistryMutation(
      missingCsrfRequest,
      binding,
      { operationId: 'CMS-03A-01' },
    );
    expect(missingCsrf.status).toBe(403);
    expect(binding.fetch).not.toHaveBeenCalled();

    const invalidId = await call(
      {
        operationId: 'CMS-03A-02',
        contentTypeId: 'not-an-id',
        versionId: VERSION_ID,
      },
      validField,
      fieldResource,
      { 'if-match': '"4"' },
    );
    expect(invalidId.response.status).toBe(400);
    expect(invalidId.binding.fetch).not.toHaveBeenCalled();
  });

  it('parses the native create form locale configuration into the contract body', async () => {
    const form = {
      typeKey: 'release_note',
      label: 'Release note',
      ownerCapability: 'cms.schema_designer',
      sourceLocale: 'en-US',
      defaultLocale: 'en-US',
      supportedLocales: '["en-US","fr"]',
      fallbackChains: '{"fr":["en-US"]}',
      workflowKey: 'cms.content.workflow',
      workflowVersion: '1',
      defaultTemplateVersionId: '',
      fields: '[]',
      relations: '[]',
      templateBindings: '[]',
      capabilityBindings: '[]',
    };
    const { response, forwarded } = await call(
      { operationId: 'CMS-03A-01' },
      form,
      typeResource,
      {},
      'application/x-www-form-urlencoded',
    );
    expect(response.status).toBe(201);
    const body = (await forwarded?.clone().json()) as Record<string, unknown>;
    expect(body.supportedLocales).toEqual(['en-US', 'fr']);
    expect(body.fallbackChains).toEqual({ fr: ['en-US'] });
  });

  it('[P2-S09-AC-003] [P2-S09-AC-045] [P2-S09-AC-049] submits the template-free create form as a null default and no bindings', async () => {
    const form = {
      typeKey: 'release_note',
      label: 'Release note',
      ownerCapability: 'cms.schema_designer',
      sourceLocale: 'en-US',
      defaultLocale: 'en-US',
      supportedLocales: '["en-US"]',
      fallbackChains: '{}',
      workflowKey: 'cms.content.workflow',
      workflowVersion: '1',
      fields: '[]',
      relations: '[]',
      capabilityBindings: '[]',
    };
    const { response, forwarded } = await call(
      { operationId: 'CMS-03A-01' },
      form,
      typeResource,
      {},
      'application/x-www-form-urlencoded',
    );
    expect(response.status).toBe(201);
    const body = (await forwarded?.clone().json()) as Record<string, unknown>;
    expect(body.defaultTemplateVersionId).toBeNull();
    expect(body.templateBindings).toEqual([]);
  });

  it.each([
    [
      'a default template version',
      { defaultTemplateVersionId: '4f5d7c0e-0b50-4c43-a4a3-0d6a4f3b7c11' },
    ],
    [
      'a template binding',
      {
        templateBindings:
          '[{"templateVersionId":"4f5d7c0e-0b50-4c43-a4a3-0d6a4f3b7c11"}]',
      },
    ],
  ])(
    '[P2-S09-AC-045] [P2-S09-AC-049] refuses a posted create form carrying %s before any dependency call',
    async (_name, extra) => {
      const { response, binding } = await call(
        { operationId: 'CMS-03A-01' },
        {
          typeKey: 'release_note',
          label: 'Release note',
          ownerCapability: 'cms.schema_designer',
          sourceLocale: 'en-US',
          defaultLocale: 'en-US',
          supportedLocales: '["en-US"]',
          fallbackChains: '{}',
          workflowKey: 'cms.content.workflow',
          workflowVersion: '1',
          fields: '[]',
          relations: '[]',
          capabilityBindings: '[]',
          ...extra,
        },
        typeResource,
        {},
        'application/x-www-form-urlencoded',
      );
      expect(response.status).toBe(422);
      expect(binding.fetch).not.toHaveBeenCalled();
    },
  );

  it('[P2-S09-AC-1230] returns the exact locale messages and pointers for an invalid create', async () => {
    const { response, binding } = await call(
      { operationId: 'CMS-03A-01' },
      {
        ...validDraft,
        supportedLocales: ['en-US', 'fr'],
        fallbackChains: { fr: ['en-US', 'fr'], 'de-DE': ['en-US'] },
      },
      typeResource,
    );
    expect(response.status).toBe(422);
    expect(binding.fetch).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({
      code: 'VALIDATION_FAILED',
      details: {
        violations: [
          {
            path: '/fallbackChains/de-DE',
            message: 'fallbackChains key must be a supported locale',
          },
          {
            path: '/fallbackChains/fr/1',
            message: 'fallback chain must not include its own target locale',
          },
          {
            path: '/fallbackChains/fr',
            message: 'fallback chain must end at defaultLocale',
          },
        ],
      },
    });
  });

  it('parses the successor form pairs and ignores the replacement choice radios', async () => {
    const target = {
      operationId: 'CMS-03A-09',
      contentTypeId: TYPE_ID,
      versionId: VERSION_ID,
    } as const;
    const keep = await call(
      target,
      {
        expectedVersion: '4',
        localeChoice: 'keep',
        supportedLocales: 'null',
        fallbackChains: 'null',
        templateChoice: 'keep',
        defaultTemplateVersionId: '',
        templateBindings: 'null',
      },
      typeResource,
      { 'if-match': '"4"' },
      'application/x-www-form-urlencoded',
    );
    expect(keep.response.status).toBe(201);
    expect(await keep.forwarded?.clone().json()).toEqual({
      expectedVersion: '4',
      supportedLocales: null,
      fallbackChains: null,
      defaultTemplateVersionId: null,
      templateBindings: null,
    });
    const change = await call(
      target,
      {
        expectedVersion: '4',
        localeChoice: 'change',
        supportedLocales: '["en-US","fr"]',
        fallbackChains: '{"fr":["en-US"]}',
        templateChoice: 'change',
        defaultTemplateVersionId: '018f0c45-73fe-4dc2-9c09-68f7ecf132da',
        templateBindings:
          '[{"templateVersionId":"018f0c45-73fe-4dc2-9c09-68f7ecf132da"}]',
      },
      typeResource,
      { 'if-match': '"4"' },
      'application/x-www-form-urlencoded',
    );
    expect(await change.forwarded?.clone().json()).toEqual({
      expectedVersion: '4',
      supportedLocales: ['en-US', 'fr'],
      fallbackChains: { fr: ['en-US'] },
      defaultTemplateVersionId: '018f0c45-73fe-4dc2-9c09-68f7ecf132da',
      templateBindings: [
        { templateVersionId: '018f0c45-73fe-4dc2-9c09-68f7ecf132da' },
      ],
    });
  });

  it('[P2-S09-AC-049] refuses half of the template pair locally with the pair message and no upstream call', async () => {
    const target = {
      operationId: 'CMS-03A-09',
      contentTypeId: TYPE_ID,
      versionId: VERSION_ID,
    } as const;
    const { response, binding } = await call(
      target,
      {
        expectedVersion: '4',
        supportedLocales: 'null',
        fallbackChains: 'null',
        defaultTemplateVersionId: '018f0c45-73fe-4dc2-9c09-68f7ecf132da',
        templateBindings: 'null',
      },
      typeResource,
      { 'if-match': '"4"' },
      'application/x-www-form-urlencoded',
    );
    expect(response.status).toBe(422);
    expect(binding.fetch).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({
      code: 'VALIDATION_FAILED',
      details: {
        violations: [
          {
            path: '/templateBindings',
            message:
              'defaultTemplateVersionId and templateBindings must be both null or both present',
          },
        ],
      },
    });
  });

  it('refuses malformed locale JSON text with a local 400', async () => {
    const { response, binding } = await call(
      {
        operationId: 'CMS-03A-09',
        contentTypeId: TYPE_ID,
        versionId: VERSION_ID,
      },
      {
        expectedVersion: '4',
        supportedLocales: '{broken',
        fallbackChains: 'null',
      },
      typeResource,
      { 'if-match': '"4"' },
      'application/x-www-form-urlencoded',
    );
    expect(response.status).toBe(400);
    expect(binding.fetch).not.toHaveBeenCalled();
  });
});
