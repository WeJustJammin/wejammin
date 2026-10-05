/** Harness for the DEC-108 Worker RED suites (CMS-03A-09..14). */
import { vi } from 'vitest';

import {
  createContentSchemaRegistryApp,
  type ContentSchemaRegistryDependencies,
  type ContentSchemaRegistryResult,
  type ContentSchemaRegistrySession,
  type TelemetryEvent,
} from './index';
import {
  API_ORIGIN,
  PARTY_ID,
  REQUEST_ID,
  USER_ID,
  activation,
  block,
  field,
  lifecycleEvent,
  ok,
  relation,
  resource,
  safeBlock,
} from './phase-02-slice-09-test-values';
import {
  CMS_ORIGIN,
  REVIEW_ID,
  TYPE_ID,
  VERSION_ID,
  activationPreparation,
  assignCreateBody,
  assignRevokeBody,
  assignmentCreated,
  assignmentRevoked,
  decisionBody,
  decisionResource,
  detailWithPreparation,
  dryRunBody,
  dryRunResource,
  reviewPath,
  reviewResource,
  submitBody,
  successorBody,
  successorResource,
  versionPath,
} from './phase-02-slice-09-dec108-test-values';

export { activationPreparation, detailWithPreparation };

export const NEW_OPERATION_IDS = [
  'CMS-03A-09',
  'CMS-03A-10',
  'CMS-03A-11',
  'CMS-03A-12',
  'CMS-03A-13',
  'CMS-03A-14',
] as const;
export type NewOperationId = (typeof NEW_OPERATION_IDS)[number];

/** Port names are the Worker seam names chosen by the DEC-108 RED suites. */
export const NEW_PORT_NAMES = {
  'CMS-03A-09': 'createSchemaSuccessor',
  'CMS-03A-10': 'startSchemaDryRun',
  'CMS-03A-11': 'submitSchemaReview',
  'CMS-03A-12': 'decideSchemaReview',
  'CMS-03A-13': 'getSchemaReview',
  'CMS-03A-14': 'assignSchemaReview',
} as const;
export type NewPortName = (typeof NEW_PORT_NAMES)[NewOperationId];

export type OperationSpec = Readonly<{
  operationId: NewOperationId;
  portName: NewPortName;
  method: 'GET' | 'POST';
  path: string;
  pathParams: Readonly<Record<string, string>>;
  body: Readonly<Record<string, unknown>> | undefined;
  output: unknown;
  status: 200 | 201 | 202;
  capabilities: readonly string[];
  ifMatch: boolean;
  stepUp: boolean;
  rateClass: string;
  limit: number;
  partyLimit: number;
}>;

const designer = ['cms.schema_designer'] as const;
const pathIds = { contentTypeId: TYPE_ID, versionId: VERSION_ID };
const reviewIds = { reviewId: REVIEW_ID };

export const OPERATIONS: readonly OperationSpec[] = [
  {
    operationId: 'CMS-03A-09',
    portName: 'createSchemaSuccessor',
    method: 'POST',
    path: versionPath('successors'),
    pathParams: pathIds,
    body: successorBody,
    output: successorResource,
    status: 201,
    capabilities: designer,
    ifMatch: true,
    stepUp: false,
    rateClass: 'cms-definition-write',
    limit: 30,
    partyLimit: 60,
  },
  {
    operationId: 'CMS-03A-10',
    portName: 'startSchemaDryRun',
    method: 'POST',
    path: versionPath('dry-runs'),
    pathParams: pathIds,
    body: dryRunBody,
    output: dryRunResource,
    status: 202,
    capabilities: designer,
    ifMatch: true,
    stepUp: false,
    rateClass: 'cms-definition-write',
    limit: 30,
    partyLimit: 60,
  },
  {
    operationId: 'CMS-03A-11',
    portName: 'submitSchemaReview',
    method: 'POST',
    path: versionPath('reviews'),
    pathParams: pathIds,
    body: submitBody,
    output: reviewResource,
    status: 201,
    capabilities: designer,
    ifMatch: true,
    stepUp: false,
    rateClass: 'cms-definition-write',
    limit: 30,
    partyLimit: 60,
  },
  {
    operationId: 'CMS-03A-12',
    portName: 'decideSchemaReview',
    method: 'POST',
    path: reviewPath('/decisions'),
    pathParams: reviewIds,
    body: decisionBody,
    output: decisionResource,
    status: 201,
    capabilities: ['cms.schema_review'],
    ifMatch: true,
    stepUp: true,
    rateClass: 'cms-activation',
    limit: 30,
    partyLimit: 60,
  },
  {
    operationId: 'CMS-03A-13',
    portName: 'getSchemaReview',
    method: 'GET',
    path: reviewPath(),
    pathParams: reviewIds,
    body: undefined,
    output: reviewResource,
    status: 200,
    capabilities: ['cms.schema_designer', 'cms.schema_review'],
    ifMatch: false,
    stepUp: false,
    rateClass: 'cms-definition-read',
    limit: 120,
    partyLimit: 240,
  },
  {
    operationId: 'CMS-03A-14',
    portName: 'assignSchemaReview',
    method: 'POST',
    path: reviewPath('/assignments'),
    pathParams: reviewIds,
    body: assignCreateBody,
    output: assignmentCreated,
    status: 201,
    capabilities: ['cms.schema_review.assign'],
    ifMatch: true,
    stepUp: true,
    rateClass: 'cms-activation',
    limit: 10,
    partyLimit: 20,
  },
];

export const specFor = (operationId: NewOperationId): OperationSpec => {
  const found = OPERATIONS.find((spec) => spec.operationId === operationId);
  if (found === undefined) throw new Error(`Unknown operation ${operationId}`);
  return found;
};

export const sessionFor = (
  spec: OperationSpec,
  overrides: Partial<ContentSchemaRegistrySession> = {},
): ContentSchemaRegistrySession => ({
  userId: USER_ID,
  actingPartyId: PARTY_ID,
  capabilities: [spec.capabilities[0] as string],
  mfaFresh: true,
  ...overrides,
});

export const requestFor = (
  spec: OperationSpec,
  options: Readonly<{
    headers?: Readonly<Record<string, string | null>>;
    body?: unknown;
    path?: string;
  }> = {},
): Request => {
  const headers: Record<string, string> = {
    origin: CMS_ORIGIN,
    authorization: 'Bearer verified-session',
    'x-request-id': REQUEST_ID,
  };
  if (spec.method === 'POST') {
    headers['content-type'] = 'application/json';
    headers['idempotency-key'] = 'cms-dec108-key-001';
    if (spec.ifMatch) headers['if-match'] = '"1"';
  }
  for (const [name, value] of Object.entries(options.headers ?? {})) {
    if (value === null) delete headers[name];
    else headers[name] = value;
  }
  return new Request(`${API_ORIGIN}${options.path ?? spec.path}`, {
    method: spec.method,
    headers,
    ...(spec.method === 'POST'
      ? { body: JSON.stringify(options.body ?? spec.body) }
      : {}),
  });
};

export type Dec108Harness = Readonly<{
  app: ReturnType<typeof createContentSchemaRegistryApp>;
  ports: Record<string, ReturnType<typeof vi.fn>>;
  resolveSession: ReturnType<typeof vi.fn>;
  rateLimit: ReturnType<typeof vi.fn>;
  telemetry: ReturnType<typeof vi.fn<(event: TelemetryEvent) => void>>;
}>;

export const makeDec108Harness = (
  options: Readonly<{
    session?: ContentSchemaRegistryResult<ContentSchemaRegistrySession>;
    rate?: ContentSchemaRegistryResult<{
      allowed: boolean;
      limit: number;
      remaining: number;
      resetAt: number;
    }>;
    port?: ContentSchemaRegistryResult<unknown>;
  }> = {},
): Dec108Harness => {
  const outputs: Record<string, unknown> = {
    createTypeDraft: resource,
    addFieldDefinition: field,
    bindRelation: relation,
    activateSchema: activation,
    registerBlock: block,
    advanceBlockLifecycle: lifecycleEvent,
    listContentTypes: { items: [resource, safeBlock], nextCursor: null },
    getContentTypeVersion: detailWithPreparation,
    ...Object.fromEntries(
      OPERATIONS.map((spec) => [spec.portName, spec.output]),
    ),
  };
  const ports = Object.fromEntries(
    Object.entries(outputs).map(([name, output]) => [
      name,
      vi.fn(async () => options.port ?? ok(output)),
    ]),
  );
  const resolveSession = vi.fn(
    async () =>
      options.session ??
      ok(sessionFor(specFor('CMS-03A-09'), { mfaFresh: true })),
  );
  const rateLimit = vi.fn(
    async () =>
      options.rate ??
      ok({ allowed: true, limit: 100, remaining: 99, resetAt: 1_788_345_600 }),
  );
  const telemetry = vi.fn<(event: TelemetryEvent) => void>();
  const dependencies: ContentSchemaRegistryDependencies = {
    ports: ports as unknown as ContentSchemaRegistryDependencies['ports'],
    resolveSession,
    verifyRelease: vi.fn(),
    rateLimit,
    humanOrigins: [CMS_ORIGIN],
    releaseOrigins: ['https://release-worker.example.test'],
    now: () => 1_788_345_600_000,
    telemetry,
  };
  return {
    app: createContentSchemaRegistryApp(dependencies),
    ports,
    resolveSession,
    rateLimit,
    telemetry,
  };
};

export const sessionResult = (
  spec: OperationSpec,
  overrides: Partial<ContentSchemaRegistrySession> = {},
): ContentSchemaRegistryResult<ContentSchemaRegistrySession> =>
  ok(sessionFor(spec, overrides));

export { assignRevokeBody, assignmentRevoked };
