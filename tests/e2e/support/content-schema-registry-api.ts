import type { Logger } from '@wejammin/observability/logging';

import {
  createWorkerApp,
  type WorkerDependencies,
} from '../../../apps/worker/src/index';
import type {
  ContentSchemaRegistryDependencies,
  ContentSchemaRegistryResult,
} from '../../../apps/worker/src/content-schema-registry/types';
import {
  createSessionVerifier,
  isLocalSessionId,
  verifyLocalSessionRequest,
} from './s09-session-authority';
import { createS09DisclosurePorts } from './s09-disclosure-fixture';
import { createCmsTemplateFixture } from './cms-template-fixture';
import { createCmsLocaleFixture } from './cms-locale-fixture';
import { createCmsEditorialHistoryFixture } from './cms-editorial-history-fixture';

const USER_ID = '10000000-0000-4000-8000-000000000001';
const TYPE_ID = '30000000-0000-4000-8000-000000000003';
const VERSION_ID = '40000000-0000-4000-8000-000000000004';
const FIELD_ID = '50000000-0000-4000-8000-000000000005';
const ARTIFACT_ID = '60000000-0000-4000-8000-000000000006';
const BLOCK_ID = '70000000-0000-4000-8000-000000000007';
const DRY_RUN_ID = '90000000-0000-4000-8000-000000000009';
const HASH = 'a'.repeat(64);
const INSTANT = '2026-09-02T12:00:00.000Z';

const versionMeta = (id: string, version = '1') => ({
  id,
  version,
  contentHash: HASH,
  createdAt: INSTANT,
  updatedAt: INSTANT,
});

const fieldIdFor = (index: number): string =>
  `50000000-0000-4000-8000-${(index + 5).toString(16).padStart(12, '0')}`;

const fields = Array.from({ length: 128 }, (_, index) => {
  const id = index === 0 ? FIELD_ID : fieldIdFor(index);
  return {
    ...versionMeta(id, String(index + 1)),
    resourceKind: 'field_definition_version' as const,
    contentTypeVersionId: VERSION_ID,
    stableFieldId: id,
    key: index === 0 ? 'title' : `field_${String(index + 1).padStart(3, '0')}`,
    kind: 'short_text' as const,
    required: index === 0,
    validatorKey: null,
    validatorVersion: null,
    defaultMode: 'none' as const,
    localizationMode: 'none' as const,
    lifecycle: 'active' as const,
    migrationPlanId: null,
  };
});

const resource = {
  ...versionMeta(VERSION_ID),
  resourceKind: 'content_type_version' as const,
  state: 'draft' as const,
  contentTypeId: TYPE_ID,
  typeKey: 'article',
  label: 'Article',
  ownerCapability: 'cms.content.article',
  sourceLocale: 'en-US',
  defaultLocale: 'en-US',
  workflowKey: 'editorial.default',
  workflowVersion: '1',
  defaultTemplateVersionId: null,
  schemaArtifactId: ARTIFACT_ID,
  fieldCount: fields.length,
  relationCount: 0,
  capabilityBindingCount: 1,
  compatibility: 'additive' as const,
  dryRunId: DRY_RUN_ID,
  activationEvidence: null,
};

const relation = {
  ...versionMeta('d0000000-0000-4000-8000-000000000010'),
  resourceKind: 'relation_definition' as const,
  state: 'draft' as const,
  contentTypeVersionId: VERSION_ID,
  fieldId: FIELD_ID,
  targetKind: 'content' as const,
  targetType: 'artist',
  projectionKey: 'public.summary',
  cardinality: 'many' as const,
  min: 0,
  max: 8,
  ordered: false,
  onUnavailable: 'placeholder' as const,
};

const artifact = {
  resourceKind: 'schema_artifact' as const,
  id: ARTIFACT_ID,
  version: '1',
  state: 'compiled' as const,
  contentTypeVersionId: VERSION_ID,
  compilerVersion: '1.0.0',
  zodContractRef: 'contracts/cms/content-type-v1',
  artifactHash: HASH,
  createdAt: INSTANT,
  updatedAt: INSTANT,
  compiledAt: INSTANT,
};

const block = {
  resourceKind: 'block_definition_registry_record' as const,
  id: BLOCK_ID,
  version: '1',
  blockKey: 'hero.banner',
  blockVersion: 1,
  propsSchemaRef: 'schemas/hero-banner.json',
  propsSchemaHash: HASH,
  rendererRef: 'renderer/hero-banner',
  releaseDigest: HASH,
  lifecycle: 'supported' as const,
};

const capabilityBinding = {
  resourceKind: 'capability_binding' as const,
  id: 'e0000000-0000-4000-8000-000000000011',
  contentTypeVersionId: VERSION_ID,
  capabilityKey: 'cms.content.article',
  capabilityVersion: '1',
  version: '1',
  state: 'draft' as const,
};

const list = {
  items: [
    {
      resourceKind: 'content_type' as const,
      id: TYPE_ID,
      version: '1',
      typeKey: 'article',
      builtIn: false,
      lifecycle: 'active' as const,
      createdAt: INSTANT,
      updatedAt: INSTANT,
    },
    resource,
    block,
    ...fields.slice(0, 97),
  ],
  nextCursor: null,
};

const detail = {
  resourceKind: 'content_type_version' as const,
  resource,
  fields,
  relations: [relation],
  schemaArtifact: artifact,
  templateBindings: [],
  capabilityBindings: [capabilityBinding],
  blockDefinitions: [block],
};

const ok = <T>(value: T): ContentSchemaRegistryResult<T> => ({
  ok: true,
  value,
});

const unavailable = (): ContentSchemaRegistryResult<never> => ({
  ok: false,
  status: 503,
  code: 'DEPENDENCY_UNAVAILABLE',
  message: 'CMS registry persistence is temporarily unavailable.',
  details: { dependencyClass: 'cms_registry', retryable: true },
  retryAfterSeconds: 5,
});

const revokedSessionIds = new Set<string>();
const hasValidSession = createSessionVerifier(USER_ID, revokedSessionIds);
const s09 = createS09DisclosurePorts({
  verifyClaim: (request) =>
    verifyLocalSessionRequest(USER_ID, revokedSessionIds, request),
});

const registry: ContentSchemaRegistryDependencies = {
  ports: {
    createTypeDraft: async () => unavailable(),
    addFieldDefinition: async () => unavailable(),
    bindRelation: async () => unavailable(),
    activateSchema: async () => unavailable(),
    registerBlock: async () => unavailable(),
    advanceBlockLifecycle: async () => unavailable(),
    listContentTypes: async () => ok(list),
    getContentTypeVersion: async () => ok(detail),
  },
  resolveSession: async (request) => {
    const claim = await verifyLocalSessionRequest(
      USER_ID,
      revokedSessionIds,
      request,
    );
    if (claim === null)
      return {
        ok: false,
        status: 401,
        code: 'UNAUTHENTICATED',
        message: 'The authentication session is invalid.',
        details: {},
      };
    return ok(s09.registrySessionForClaim(claim.sessionId));
  },
  verifyRelease: async () => unavailable(),
  rateLimit: async () =>
    ok({ allowed: true, limit: 30, remaining: 29, resetAt: 2_000_000_000 }),
  humanOrigins: ['http://127.0.0.1:4324'],
  releaseOrigins: [],
  now: Date.now,
  deadlineMs: 1_000,
};

const noop = () => undefined;
const logger = {
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
} as unknown as Logger;

const dependencies = {
  captureException: () => undefined,
  createLogger: () => logger,
  now: Date.now,
  auth: s09.auth,
  identityAuthority: s09.identityAuthority,
  contentSchemaRegistry: registry,
  cmsTemplate: createCmsTemplateFixture(hasValidSession),
  cmsLocale: createCmsLocaleFixture(hasValidSession),
  cmsEditorial: createCmsEditorialHistoryFixture(hasValidSession),
} as unknown as WorkerDependencies;

const app = createWorkerApp(dependencies);

export default {
  fetch: async (request: Request, env: unknown, context: ExecutionContext) => {
    const url = new URL(request.url);
    if (url.pathname === '/_s09/revoke' && request.method === 'POST') {
      try {
        const body = (await request.json()) as { sessionId?: unknown };
        if (!isLocalSessionId(body.sessionId))
          return Response.json({ revoked: false }, { status: 400 });
        revokedSessionIds.add(body.sessionId);
        return Response.json({ revoked: true });
      } catch {
        return Response.json({ revoked: false }, { status: 400 });
      }
    }
    return app.fetch(request, env, context);
  },
};
