import type { Logger } from '@wejammin/observability/logging';

import {
  createWorkerApp,
  type WorkerDependencies,
} from '../../../apps/worker/src/index';
import type {
  ContentSchemaRegistryDependencies,
  ContentSchemaRegistryResult,
} from '../../../apps/worker/src/content-schema-registry/types';
import { SchemaReviewResourceSchema } from '../../../apps/worker/src/content-schema-registry/contracts';
import {
  createSessionVerifier,
  isLocalSessionId,
  verifyLocalSessionRequest,
} from './s09-session-authority';
import { createS09DisclosurePorts } from './s09-disclosure-fixture';
import {
  dispatchRegistryPorts,
  handleLaneControl,
  laneDependencies,
  registrySessionFor,
  verifyLaneRequest,
} from './s09-lane-api';
import { revokeLaneSession } from './s09-lane-auth';
import { createCmsTemplateFixture } from './cms-template-fixture';
import { createCmsLocaleFixture } from './cms-locale-fixture';
import {
  createS10RealCmsEditorial,
  type S10RealBindings,
} from './s10-real-editorial';

const USER_ID = '10000000-0000-4000-8000-000000000001';
const TYPE_ID = '30000000-0000-4000-8000-000000000003';
const VERSION_ID = '40000000-0000-4000-8000-000000000004';
const FIELD_ID = '50000000-0000-4000-8000-000000000005';
const ARTIFACT_ID = '60000000-0000-4000-8000-000000000006';
const BLOCK_ID = '70000000-0000-4000-8000-000000000007';
const DRY_RUN_ID = '90000000-0000-4000-8000-000000000009';
const REVIEW_ID = '90000000-0000-4000-8000-00000000000a';
const JOB_ID = '90000000-0000-4000-8000-00000000000b';
const DECISION_ID = '90000000-0000-4000-8000-00000000000c';
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
  state: 'approved' as const,
  contentTypeId: TYPE_ID,
  typeKey: 'article',
  label: 'Article',
  ownerCapability: 'cms.content.article',
  sourceLocale: 'en-US',
  defaultLocale: 'en-US',
  supportedLocales: ['en-US'],
  fallbackChains: {},
  localeConfigHash: HASH,
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
  // The legacy AC250 profile sessions inspect the activation confirmation of
  // an approved candidate; the producers that reach this state are driven end
  // to end by the stateful lane (tests/e2e/support/s09-lane-*.ts).
  activationPreparation: {
    dryRunRef: {
      id: DRY_RUN_ID,
      state: 'completed' as const,
      result: 'passed' as const,
      jobId: JOB_ID,
      sourceCount: 0,
      targetCount: 0,
      rowErrorCount: 0,
      sourceHash: HASH,
      targetHash: HASH,
      reportHash: HASH,
    },
    jobRef: { id: JOB_ID, state: 'succeeded' as const },
    reviewRef: { id: REVIEW_ID, state: 'approved' as const },
    permittedNextActions: ['activate' as const],
  },
};

const approvedReview = SchemaReviewResourceSchema.parse({
  ...versionMeta(REVIEW_ID),
  resourceKind: 'schema_review',
  state: 'approved',
  contentTypeId: TYPE_ID,
  contentTypeVersionId: VERSION_ID,
  contentTypeVersionNo: '1',
  riskClass: 'ordinary',
  requiredDecisionCount: 1,
  requiredCapabilities: ['cms.schema_review'],
  distinctApprovalCount: 1,
  recordedDecisionCount: 1,
  frozenEvidence: {
    contentTypeVersionId: VERSION_ID,
    contentTypeVersionNo: '1',
    definitionHash: HASH,
    localeConfigHash: HASH,
    schemaArtifact: {
      id: ARTIFACT_ID,
      state: 'compiled',
      compilerVersion: '1.0.0',
      zodContractRef: 'contracts/cms/content-type-v1',
      artifactHash: HASH,
    },
    dependencyManifestHash: HASH,
    dryRun: {
      id: DRY_RUN_ID,
      state: 'completed',
      result: 'passed',
      reportHash: HASH,
    },
  },
  dryRunId: DRY_RUN_ID,
  policyKey: 'cms.standard',
  policyVersion: '1',
  policyHash: HASH,
  approvalEvidenceHash: HASH,
  submittedAt: INSTANT,
  decidedAt: INSTANT,
  decisions: [
    {
      id: DECISION_ID,
      decision: 'approve',
      capability: 'cms.schema_review',
      decidedAt: INSTANT,
    },
  ],
  permittedNextActions: ['activate'],
});

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
  ports: dispatchRegistryPorts({
    createTypeDraft: async () => unavailable(),
    addFieldDefinition: async () => unavailable(),
    bindRelation: async () => unavailable(),
    activateSchema: async () => unavailable(),
    registerBlock: async () => unavailable(),
    advanceBlockLifecycle: async () => unavailable(),
    listContentTypes: async () => ok(list),
    getContentTypeVersion: async () => ok(detail),
    getSchemaReview: async () => ok(approvedReview),
  } as never),
  resolveSession: async (request) => {
    const lane = await verifyLaneRequest(request);
    if (lane !== null) return ok(registrySessionFor(lane));
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
  // The web facade forwards mutations with the internal service-binding origin.
  humanOrigins: ['http://127.0.0.1:4324', 'https://platform-api.internal'],
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

const legacyDependencies = {
  auth: s09.auth,
  identityAuthority: s09.identityAuthority,
};

const baseDependencies = {
  captureException: () => undefined,
  createLogger: () => logger,
  now: Date.now,
  auth: s09.auth,
  identityAuthority: s09.identityAuthority,
  contentSchemaRegistry: registry,
  cmsTemplate: createCmsTemplateFixture(hasValidSession),
  cmsLocale: createCmsLocaleFixture(hasValidSession),
  ...laneDependencies(legacyDependencies),
};

// The editorial dependency is the PRODUCTION composition over the local
// Supabase stack (s10-real-editorial.ts), so it needs the Worker bindings the
// launcher passes; the app is therefore built from the first request's env.
// When the launcher found no stack the dependency is left out and the editorial
// routes stay unregistered, a 404 (never a fixture); the Slice 10 specs probe for
// exactly that.
let app: ReturnType<typeof createWorkerApp> | null = null;
const appFor = (env: unknown): ReturnType<typeof createWorkerApp> => {
  if (app !== null) return app;
  const bindings = env as S10RealBindings;
  const editorial =
    bindings.SUPABASE_URL !== undefined &&
    bindings.SUPABASE_SECRET_KEY !== undefined
      ? { cmsEditorial: createS10RealCmsEditorial(bindings, revokedSessionIds) }
      : {};
  app = createWorkerApp({
    ...baseDependencies,
    ...editorial,
  } as unknown as WorkerDependencies);
  return app;
};

export default {
  fetch: async (request: Request, env: unknown, context: ExecutionContext) => {
    const url = new URL(request.url);
    if (url.pathname === '/_s09/revoke' && request.method === 'POST') {
      try {
        const body = (await request.json()) as { sessionId?: unknown };
        if (!isLocalSessionId(body.sessionId))
          return Response.json({ revoked: false }, { status: 400 });
        revokedSessionIds.add(body.sessionId);
        revokeLaneSession(body.sessionId);
        return Response.json({ revoked: true });
      } catch {
        return Response.json({ revoked: false }, { status: 400 });
      }
    }
    const laneControl = await handleLaneControl(request);
    if (laneControl !== null) return laneControl;
    return appFor(env).fetch(request, env, context);
  },
};
