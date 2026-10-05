/**
 * Harness for the owner CMS capability grant suites (CMS-03A-15..18, DEC-119).
 * Every resource is parsed against the completed `@wejammin/contracts` schema
 * at module load so a drifted fixture fails loudly.
 */
import { vi } from 'vitest';

import {
  CmsCapabilityGrantListPageSchema,
  CmsCapabilityGrantResourceSchema,
} from '@wejammin/contracts';

import {
  createContentSchemaRegistryApp,
  type ContentSchemaRegistryDependencies,
  type ContentSchemaRegistryResult,
  type ContentSchemaRegistrySession,
  type TelemetryEvent,
} from './index';
import {
  API_ORIGIN,
  CMS_ORIGIN,
  HASH,
  PARTY_ID,
  REQUEST_ID,
  USER_ID,
  ok,
} from './phase-02-slice-09-test-values';

export const GRANT_ID = 'b1000000-0000-4000-8000-0000000000b1';
export const SUBJECT_PERSON_ID = 'b2000000-0000-4000-8000-0000000000b2';
const INSTANT = '2026-10-02T12:00:00.000Z';
const BASE = '/api/v1/cms/capability-grants';

const grantBase = {
  id: GRANT_ID,
  version: '1',
  contentHash: HASH,
  createdAt: INSTANT,
  updatedAt: INSTANT,
  resourceKind: 'cms_capability_grant' as const,
  state: 'active' as const,
  subjectPersonId: SUBJECT_PERSON_ID,
  capability: 'cms.author' as const,
  validFrom: '2026-10-02',
  validThrough: '2026-10-08',
  endsAt: '2026-10-09T00:00:00.000Z',
  lastAction: 'granted' as const,
  reason: null,
};
export const grantResource = CmsCapabilityGrantResourceSchema.parse(grantBase);
export const grantRenewed = CmsCapabilityGrantResourceSchema.parse({
  ...grantBase,
  version: '2',
  lastAction: 'renewed',
});
export const grantRevoked = CmsCapabilityGrantResourceSchema.parse({
  ...grantBase,
  version: '2',
  state: 'revoked',
  lastAction: 'revoked',
});
export const grantListPage = CmsCapabilityGrantListPageSchema.parse({
  items: [grantResource],
  nextCursor: null,
});

export const GRANT_OPERATION_IDS = [
  'CMS-03A-15',
  'CMS-03A-16',
  'CMS-03A-17',
  'CMS-03A-18',
] as const;
export type GrantOperationId = (typeof GRANT_OPERATION_IDS)[number];

export type GrantOperationSpec = Readonly<{
  operationId: GrantOperationId;
  portName:
    | 'grantCapability'
    | 'renewCapabilityGrant'
    | 'revokeCapabilityGrant'
    | 'listCapabilityGrants';
  rpc: string;
  method: 'GET' | 'POST';
  path: string;
  pathParams: Readonly<Record<string, string>>;
  body: Readonly<Record<string, unknown>> | undefined;
  output: unknown;
  status: 200 | 201;
  ifMatch: boolean;
  stepUp: boolean;
  rateClass: string;
  limit: number;
  partyLimit: number;
}>;

export const GRANT_OPERATIONS: readonly GrantOperationSpec[] = [
  {
    operationId: 'CMS-03A-15',
    portName: 'grantCapability',
    rpc: 'cms_grant_capability',
    method: 'POST',
    path: BASE,
    pathParams: {},
    body: {
      subjectPersonId: SUBJECT_PERSON_ID,
      capability: 'cms.author',
      validThrough: '2026-10-08',
      reason: 'Authoring access',
    },
    output: grantResource,
    status: 201,
    ifMatch: false,
    stepUp: true,
    rateClass: 'cms-activation',
    limit: 10,
    partyLimit: 20,
  },
  {
    operationId: 'CMS-03A-16',
    portName: 'renewCapabilityGrant',
    rpc: 'cms_renew_capability_grant',
    method: 'POST',
    path: `${BASE}/${GRANT_ID}/renewals`,
    pathParams: { grantId: GRANT_ID },
    body: { expectedVersion: '1', validThrough: '2026-10-08' },
    output: grantRenewed,
    status: 200,
    ifMatch: true,
    stepUp: true,
    rateClass: 'cms-activation',
    limit: 10,
    partyLimit: 20,
  },
  {
    operationId: 'CMS-03A-17',
    portName: 'revokeCapabilityGrant',
    rpc: 'cms_revoke_capability_grant',
    method: 'POST',
    path: `${BASE}/${GRANT_ID}/revocations`,
    pathParams: { grantId: GRANT_ID },
    body: { expectedVersion: '1', reason: 'Access no longer needed' },
    output: grantRevoked,
    status: 200,
    ifMatch: true,
    stepUp: true,
    rateClass: 'cms-activation',
    limit: 10,
    partyLimit: 20,
  },
  {
    operationId: 'CMS-03A-18',
    portName: 'listCapabilityGrants',
    rpc: 'cms_list_capability_grants',
    method: 'GET',
    path: BASE,
    pathParams: {},
    body: undefined,
    output: grantListPage,
    status: 200,
    ifMatch: false,
    stepUp: false,
    rateClass: 'cms-definition-read',
    limit: 120,
    partyLimit: 240,
  },
];

export const grantSpecFor = (
  operationId: GrantOperationId,
): GrantOperationSpec => {
  const found = GRANT_OPERATIONS.find(
    (spec) => spec.operationId === operationId,
  );
  if (found === undefined) throw new Error(`Unknown operation ${operationId}`);
  return found;
};

/** The owner is derived by the RPC, so the session carries no capability key. */
export const ownerSession = (
  overrides: Partial<ContentSchemaRegistrySession> = {},
): ContentSchemaRegistrySession => ({
  userId: USER_ID,
  actingPartyId: PARTY_ID,
  capabilities: [],
  mfaFresh: true,
  ...overrides,
});

export const grantRequestFor = (
  spec: GrantOperationSpec,
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
    headers['idempotency-key'] = 'cms-grant-key-0001';
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

export type GrantHarness = Readonly<{
  app: ReturnType<typeof createContentSchemaRegistryApp>;
  ports: Record<string, ReturnType<typeof vi.fn>>;
  resolveSession: ReturnType<typeof vi.fn>;
  rateLimit: ReturnType<typeof vi.fn>;
  telemetry: ReturnType<typeof vi.fn<(event: TelemetryEvent) => void>>;
}>;

export const makeGrantHarness = (
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
): GrantHarness => {
  const ports = Object.fromEntries(
    GRANT_OPERATIONS.map((spec) => [
      spec.portName,
      vi.fn(async () => options.port ?? ok(spec.output)),
    ]),
  );
  const resolveSession = vi.fn(
    async () => options.session ?? ok(ownerSession()),
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

export const calledPorts = (
  ports: Record<string, { mock: { calls: unknown[] } }>,
): number =>
  Object.values(ports).reduce((sum, port) => sum + port.mock.calls.length, 0);
