import { expect, vi } from 'vitest';

import type {
  ContentSchemaRegistryDependencies,
  ContentSchemaRegistryResult,
  ContentSchemaRegistrySession,
} from './types';
import { ok, type Overrides } from './routes.coverage-results';
export { failure, ok, type Overrides } from './routes.coverage-results';

export const API_ORIGIN = 'https://api.example.test';
export const CMS_ORIGIN = 'https://cms-console.example.test';
export const RELEASE_ORIGIN = 'https://release-worker.example.test';
export const REQUEST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const USER_ID = '10000000-0000-4000-8000-000000000001';
export const PARTY_ID = '20000000-0000-4000-8000-000000000002';
export const TYPE_ID = '30000000-0000-4000-8000-000000000003';
export const VERSION_ID = '40000000-0000-4000-8000-000000000004';
export const BLOCK_ID = '50000000-0000-4000-8000-000000000005';
export const HASH = 'a'.repeat(64);
export const SIGNATURE = `${'A'.repeat(86)}==`;

const session: ContentSchemaRegistrySession = {
  userId: USER_ID,
  actingPartyId: PARTY_ID,
  capabilities: ['cms.schema_designer', 'cms.schema_registry.read'],
  mfaFresh: true,
};

export const contentTypeBody = {
  typeKey: 'article',
  label: 'Article',
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

export const activationBody = {
  expectedVersion: '1',
  dryRunId: TYPE_ID,
  approvalIds: [TYPE_ID, VERSION_ID],
  migrationPlanId: null,
};

export const blockBody = {
  blockKey: 'cms.hero',
  blockVersion: 1,
  propsSchemaRef: 'schemas/cms-hero.json',
  propsSchemaHash: HASH,
  propsSchemaSnapshot: {
    schemaVersion: '1',
    fields: [],
    additionalProperties: false,
  },
  propsSnapshotHash: HASH,
  propsSnapshotAttestation: {
    algorithm: 'Ed25519',
    keyId: 'release-key-v1',
    signature: SIGNATURE,
  },
  rendererRef: 'renderers/cms.hero',
  allowedChildren: [],
  slotRules: { maxDepth: 1, maxNodes: 32 },
  dataSourcePermissions: [],
  accessibility: {
    nameRequired: true,
    keyboard: true,
    focusOrder: 'document',
    statusAnnouncement: true,
  },
  compatibility: { minSchemaCompiler: '1', maxSchemaCompiler: '2' },
  lifecycle: 'supported',
  releaseDigest: HASH,
};

export const releaseBody = {
  fromLifecycle: 'supported',
  toLifecycle: 'deprecated',
  expectedVersion: '1',
  releaseDigest: HASH,
};

type CoveragePort = (
  input: unknown,
  signal: AbortSignal,
) => Promise<ContentSchemaRegistryResult<unknown>>;

const validVersion = {
  resourceKind: 'content_type_version' as const,
  id: VERSION_ID,
  version: '1',
  contentHash: HASH,
  createdAt: '2026-09-02T12:00:00.000Z',
  updatedAt: '2026-09-02T12:00:00.000Z',
  state: 'draft' as const,
  contentTypeId: TYPE_ID,
  typeKey: 'article',
  label: 'Article',
  ownerCapability: 'cms.schema_designer',
  sourceLocale: 'en-US',
  defaultLocale: 'en-US',
  supportedLocales: ['en-US'],
  fallbackChains: {},
  localeConfigHash: 'a'.repeat(64),
  workflowKey: 'cms.standard',
  workflowVersion: '1',
  defaultTemplateVersionId: null,
  schemaArtifactId: TYPE_ID,
  fieldCount: 0,
  relationCount: 0,
  capabilityBindingCount: 0,
  compatibility: 'additive' as const,
  dryRunId: null,
  activationEvidence: null,
};

const releasePrincipal = {
  principalId: 'release-worker-1',
  keyId: 'release-key-v1',
  capabilities: ['release.block_registry.write'],
  verifiedAt: '2026-09-02T12:00:00.000Z',
  rawBodyHash: HASH,
  signatureHash: HASH,
  nonceHash: HASH,
} as const;

const releaseHeaders = {
  'X-WeJammin-Release-Key-Id': 'release-key-v1',
  'X-WeJammin-Release-Issued-At': '2026-09-02T12:00:00.000Z',
  'X-WeJammin-Release-Nonce': BLOCK_ID,
  'X-WeJammin-Release-Signature': SIGNATURE,
};

export const makeDependencies = (
  overrides: Overrides = {},
): Readonly<{
  dependencies: ContentSchemaRegistryDependencies;
  ports: Record<string, CoveragePort>;
  resolveSession: ReturnType<typeof vi.fn>;
  rateLimit: ReturnType<typeof vi.fn>;
}> => {
  const outputs: Record<string, unknown> = {
    createTypeDraft: validVersion,
    addFieldDefinition: validVersion,
    bindRelation: validVersion,
    activateSchema: {
      ...validVersion,
      resourceKind: undefined,
    },
    registerBlock: {
      resourceKind: 'block_definition_version',
      id: BLOCK_ID,
      version: '1',
      blockKey: 'cms.hero',
      blockVersion: 1,
      propsSchemaRef: 'schemas/cms-hero.json',
      propsSchemaHash: HASH,
      propsSchemaSnapshot: {
        schemaVersion: '1',
        fields: [],
        additionalProperties: false,
      },
      propsSnapshotHash: HASH,
      propsSnapshotAttestation: {
        algorithm: 'Ed25519',
        keyId: 'release-key-v1',
        signature: SIGNATURE,
      },
      rendererRef: 'renderers/cms.hero',
      releaseDigest: HASH,
      releaseKeyId: 'release-key-v1',
      releaseRawBodyHash: HASH,
      releaseSignatureHash: HASH,
      releaseNonceHash: HASH,
      releaseVerifiedAt: '2026-09-02T12:00:00.000Z',
      lifecycle: 'supported',
    },
    advanceBlockLifecycle: {
      resourceKind: 'block_definition_lifecycle_event',
      id: BLOCK_ID,
      version: '1',
      blockDefinitionVersionId: BLOCK_ID,
      blockKey: 'cms.hero',
      blockVersion: 1,
      fromLifecycle: 'supported',
      toLifecycle: 'deprecated',
      lifecycle: 'deprecated',
      releaseDigest: HASH,
      releaseKeyId: 'release-key-v1',
      releaseNonceHash: HASH,
      releaseVerifiedAt: '2026-09-02T12:00:00.000Z',
      eventType: 'cms.block.lifecycle.changed.v1',
      createdAt: '2026-09-02T12:00:00.000Z',
    },
    listContentTypes: { items: [], nextCursor: null },
    getContentTypeVersion: {
      resourceKind: 'content_type_version',
      resource: validVersion,
      fields: [],
      relations: [],
      schemaArtifact: {
        resourceKind: 'schema_artifact',
        id: TYPE_ID,
        version: '1',
        state: 'compiled',
        contentTypeVersionId: VERSION_ID,
        compilerVersion: '1',
        zodContractRef: 'schemas/article.json',
        artifactHash: HASH,
        createdAt: '2026-09-02T12:00:00.000Z',
        updatedAt: '2026-09-02T12:00:00.000Z',
        compiledAt: '2026-09-02T12:00:00.000Z',
      },
      templateBindings: [],
      capabilityBindings: [],
      blockDefinitions: [],
    },
  };
  const names = Object.keys(outputs);
  const ports = Object.fromEntries(
    names.map((name) => [
      name,
      vi.fn(async () => overrides.port ?? ok(outputs[name])),
    ]),
  ) as Record<string, CoveragePort>;
  const resolveSession = vi.fn(async () => overrides.session ?? ok(session));
  const verifyRelease = vi.fn(
    async () => overrides.release ?? ok(releasePrincipal),
  );
  const rateLimit = vi.fn(
    async () =>
      overrides.rate ??
      ok({ allowed: true, limit: 100, remaining: 99, resetAt: 1_788_345_600 }),
  );
  const dependencies = {
    ports: ports as unknown as ContentSchemaRegistryDependencies['ports'],
    resolveSession,
    verifyRelease,
    rateLimit,
    humanOrigins: [CMS_ORIGIN],
    releaseOrigins: [RELEASE_ORIGIN],
    now: () => 1_788_345_600_000,
  } satisfies ContentSchemaRegistryDependencies;
  return { dependencies, ports, resolveSession, rateLimit };
};

export const humanRequest = (
  path: string,
  body: unknown = contentTypeBody,
  headers: Record<string, string> = {},
): Request =>
  new Request(`${API_ORIGIN}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: CMS_ORIGIN,
      authorization: 'Bearer session',
      'idempotency-key': 'coverage-key-001',
      'x-request-id': REQUEST_ID,
      ...headers,
    },
    body: JSON.stringify(body),
  });

export const releaseRequest = (
  path: string,
  body: unknown = blockBody,
  headers: Record<string, string> = {},
): Request =>
  new Request(`${API_ORIGIN}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: RELEASE_ORIGIN,
      'idempotency-key': 'release-key-001',
      'x-request-id': REQUEST_ID,
      ...releaseHeaders,
      ...headers,
    },
    body: JSON.stringify(body),
  });

export const expectError = async (
  response: Response,
  status: number,
): Promise<Record<string, unknown>> => {
  expect(response.status).toBe(status);
  expect(response.headers.get('content-type')).toContain('application/json');
  return (await response.json()) as Record<string, unknown>;
};
