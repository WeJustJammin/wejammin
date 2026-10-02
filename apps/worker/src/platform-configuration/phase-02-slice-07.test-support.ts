import { createLogger } from '@wejammin/observability/logging';
import { expect, vi } from 'vitest';

import { createWorkerApp } from '../index';
import type {
  AuthenticationError,
  AuthenticationResult,
  AuthenticationSession,
  AuthRateLimitDecision,
} from '../authentication/types';
import type {
  ConfigurationPort,
  PlatformConfigurationDependencies,
} from './types';

export type {
  ConfigurationPort,
  PlatformConfigurationDependencies,
} from './types';

const BASE_URL = 'https://api.wejammin.test';
const ORIGIN = BASE_URL;
const REQUEST_ID = '11111111-1111-4111-8111-111111111111';
const CORRELATION_ID = '22222222-2222-4222-8222-222222222222';
const definitionId = '018f2f72-4b5a-7c9d-8e1f-123456789abc';
const otherId = '018f2f72-4b5a-7c9d-8e1f-123456789abd';
const actorId = '018f2f72-4b5a-7c9d-8e1f-123456789abe';
const instant = '2026-09-02T03:00:00.000Z';
const later = '2026-09-03T03:00:00.000Z';
const hash = 'a'.repeat(64);

const definitionRequest = {
  key: 'profile.visibility',
  valueKind: 'boolean',
  schema: { type: 'boolean' },
  ownerCapability: 'settings.profile.write',
  allowedScopes: ['platform', 'party'],
  precedence: ['party', 'platform'],
  mergeMode: 'replace',
  defaultSource: 'literal',
  defaultValue: false,
  riskClass: 'high',
  approverPolicy: {
    minimumDistinct: 2,
    requiresMfa: true,
    requiresCanary: true,
    notifyCapabilities: ['settings.profile.read'],
  },
  consumerKeys: ['web.profile'],
  contractRelease: 'phase-2.7',
  sensitivity: 'internal',
  reason: 'Register governed profile visibility.',
} as const;

const effectiveQuery =
  '/api/v1/config/profile.visibility/effective' +
  `?partyId=${definitionId}&consumerKey=web.profile&supportedDefinitionVersions=1`;

const proposal = {
  scopeType: 'party',
  scopeId: definitionId,
  environment: 'production',
  typedValue: true,
  interval: { effectiveFrom: instant, effectiveTo: later },
  expectedDefinitionVersion: '1',
  impactManifest: { consumers: ['web.profile'] },
  rollbackCandidate: false,
  reason: 'Enable the governed profile projection.',
  consumerKeys: ['web.profile'],
} as const;

const action = {
  action: 'activate',
  expectedReviewVersion: '1',
  candidateHash: hash,
  approvalReason: 'Reviewed against the frozen impact manifest.',
} as const;

const definitionResponse = {
  definitionId,
  definitionVersionId: otherId,
  key: 'profile.visibility',
  version: '1',
  valueKind: 'boolean',
  allowedScopes: ['platform', 'party'],
  precedence: ['party', 'platform'],
  mergeMode: 'replace',
  riskClass: 'high',
  lifecycle: 'active',
  schemaHash: hash,
  contractRelease: 'phase-2.7',
  synchronized: true,
  createdAt: instant,
} as const;

const effectiveResponse = {
  definitionId,
  definitionVersionId: otherId,
  key: 'profile.visibility',
  valueKind: 'boolean',
  ownerCapability: 'settings.profile.write',
  typedValue: true,
  sourceScope: 'party',
  sourceSubjectId: definitionId,
  sourceValueVersionId: otherId,
  isDefault: false,
  effectiveFrom: instant,
  effectiveTo: null,
  evaluatedAt: instant,
  evaluatorVersion: '1',
  correlationId: definitionId,
  compatibility: 'exact',
} as const;

const proposalResponse = {
  reviewId: definitionId,
  candidateValueVersionId: otherId,
  definitionId,
  definitionVersion: '1',
  state: 'draft',
  valueHash: hash,
  impactManifestHash: hash,
  effectivePreview: true,
  rollbackAvailable: true,
  submittedAt: instant,
} as const;

const actionResponse = {
  reviewId: definitionId,
  resultingValueVersionId: otherId,
  resultingState: 'active',
  resultingVersion: '2',
  candidateHash: hash,
  approvalCount: 2,
  snapshotIntentId: definitionId,
  outboxEventId: otherId,
  effectiveAt: instant,
} as const;

const releaseHeaders = {
  authorization: 'Bearer browser-token-must-not-authorize-release',
  'content-type': 'application/json',
  'idempotency-key': 'slice07-release-success',
  'x-release-principal': 'header.release',
  'x-release-signature': 'signed-release-proof',
};

const serviceHeaders = {
  'x-worker-consumer': 'header.consumer',
  'x-consumer-key': 'web.profile',
  'x-worker-signature': 'signed-service-proof',
};

const sessionFor = (sequence: number): AuthenticationSession => ({
  authUserId: `018f2f72-4b5a-7c9d-8e1f-${String(sequence).padStart(12, '0')}`,
  sessionId: `018f2f72-4b5a-7c9d-8e2f-${String(sequence).padStart(12, '0')}`,
  accountState: 'active',
  personId: actorId,
  actingPartyId: definitionId,
  expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  stepUpAt: new Date(Date.now() - 30 * 1000).toISOString(),
});

let harnessSequence = 0;

export type HarnessOptions = Readonly<{
  port?: ConfigurationPort;
  session?: AuthenticationSession;
  resolveSession?: AuthenticationResult<AuthenticationSession>;
  releasePrincipal?: AuthenticationResult<Readonly<{ principalId: string }>>;
  serviceConsumer?: AuthenticationResult<
    Readonly<{ principalId: string; consumerKey: string }>
  >;
  omitReleaseVerifier?: boolean;
  omitServiceVerifier?: boolean;
  rateLimit?: AuthenticationResult<AuthRateLimitDecision>;
  rateLimitThrows?: boolean;
}>;

export type Harness = Readonly<{
  app: ReturnType<typeof createWorkerApp>;
  auth: {
    resolveSession: ReturnType<typeof vi.fn>;
    rateLimit: ReturnType<typeof vi.fn>;
  };
  port: ConfigurationPort;
  session: AuthenticationSession;
}>;

export type TestHeaders = Readonly<Record<string, string | undefined>>;

const dependencyUnavailable = (): AuthenticationError => ({
  ok: false,
  status: 503,
  code: 'DEPENDENCY_UNAVAILABLE',
  message: 'Configuration persistence is temporarily unavailable.',
  details: { dependencyClass: 'configuration', retryable: true },
});

const defaultRate = (): AuthenticationResult<AuthRateLimitDecision> => ({
  ok: true,
  value: {
    allowed: true,
    limit: 1_000,
    remaining: 999,
    resetAt: Math.floor(Date.now() / 1000) + 300,
  },
});

const nextHarnessSession = (): AuthenticationSession =>
  sessionFor(++harnessSequence);

const makeHarness = (options: HarnessOptions = {}): Harness => {
  const sequence = ++harnessSequence;
  const session = options.session ?? sessionFor(sequence);
  const port =
    options.port ??
    (vi.fn<ConfigurationPort>(async () =>
      dependencyUnavailable(),
    ) as ConfigurationPort);
  const auth = {
    resolveSession: vi.fn(
      async () =>
        options.resolveSession ?? { ok: true as const, value: session },
    ),
    rateLimit: vi.fn(async () => {
      if (options.rateLimitThrows) throw new Error('rate limiter unavailable');
      return options.rateLimit ?? defaultRate();
    }),
  };
  const configuration: PlatformConfigurationDependencies = {
    registerDefinition: port,
    resolveEffectiveValue: port,
    proposeChange: port,
    changeAction: port,
    ...(options.omitReleaseVerifier
      ? {}
      : {
          resolveReleasePrincipal: async () =>
            options.releasePrincipal ?? {
              ok: true as const,
              value: { principalId: 'verified.release' },
            },
        }),
    ...(options.omitServiceVerifier
      ? {}
      : {
          resolveServiceConsumer: async () =>
            options.serviceConsumer ?? {
              ok: true as const,
              value: {
                principalId: 'verified.consumer',
                consumerKey: 'web.profile',
              },
            },
        }),
  };
  const app = createWorkerApp({
    auth: auth as never,
    captureException: () => undefined,
    createLogger: () =>
      createLogger({
        environment: 'test',
        release: 'slice-07-worker-acceptance',
        service: 'worker',
      }),
    now: () => Date.now(),
    platformConfiguration: configuration,
  });
  return { app, auth, port, session };
};

const request = (path: string, init: RequestInit = {}): Request => {
  const headers = new Headers(init.headers);
  if (!headers.has('accept')) headers.set('accept', 'application/json');
  if (!headers.has('origin')) headers.set('origin', ORIGIN);
  headers.set('x-request-id', REQUEST_ID);
  headers.set('x-correlation-id', CORRELATION_ID);
  return new Request(`${BASE_URL}${path}`, { ...init, headers });
};

const jsonRequest = (
  method: 'POST',
  path: string,
  body: unknown,
  headers: TestHeaders = {},
): Request => {
  const requestHeaders = new Headers(headers as Record<string, string>);
  for (const [name, value] of Object.entries(
    headers as Record<string, string | undefined>,
  )) {
    if (value === undefined) requestHeaders.delete(name);
  }
  requestHeaders.set('content-type', 'application/json');
  return request(path, {
    method,
    headers: requestHeaders,
    body: JSON.stringify(body),
  });
};

const releaseRequest = (body: unknown, headers: TestHeaders = {}): Request =>
  jsonRequest('POST', '/api/v1/internal/config/definitions', body, {
    ...releaseHeaders,
    ...headers,
  });

const proposalRequest = (
  body: unknown = proposal,
  headers: TestHeaders = {},
): Request =>
  jsonRequest('POST', `/api/v1/admin/settings/${definitionId}/changes`, body, {
    authorization: 'Bearer verified-session',
    'idempotency-key': 'slice07-proposal',
    ...headers,
  });

const actionRequest = (
  body: unknown = action,
  headers: TestHeaders = {},
): Request =>
  jsonRequest(
    'POST',
    `/api/v1/admin/settings/changes/${definitionId}/actions`,
    body,
    {
      authorization: 'Bearer verified-session',
      'idempotency-key': 'slice07-action',
      ...headers,
    },
  );

const effectiveRequest = (
  path = effectiveQuery,
  headers: TestHeaders = {},
): Request =>
  request(path, {
    method: 'GET',
    headers: { authorization: 'Bearer verified-session', ...headers },
  });

const serviceEffectiveRequest = (): Request =>
  request(
    '/api/v1/config/profile.visibility/effective?consumerKey=web.profile&supportedDefinitionVersions=1',
    { headers: serviceHeaders },
  );

const expectError = async (
  response: Response,
  status: AuthenticationError['status'],
  code: string,
  message: string,
  details: Record<string, unknown> = {},
): Promise<void> => {
  expect(response.status).toBe(status);
  await expect(response.json()).resolves.toEqual({
    code,
    details,
    message,
    requestId: REQUEST_ID,
  });
  expect(response.headers.get('cache-control')).toBe('no-store');
};

export const nextSession = nextHarnessSession;

export {
  BASE_URL,
  ORIGIN,
  REQUEST_ID,
  CORRELATION_ID,
  definitionId,
  otherId,
  actorId,
  instant,
  later,
  hash,
  definitionRequest,
  effectiveQuery,
  proposal,
  action,
  definitionResponse,
  effectiveResponse,
  proposalResponse,
  actionResponse,
  releaseHeaders,
  serviceHeaders,
  sessionFor,
  makeHarness,
  request,
  jsonRequest,
  releaseRequest,
  proposalRequest,
  actionRequest,
  effectiveRequest,
  serviceEffectiveRequest,
  expectError,
  dependencyUnavailable,
  defaultRate,
};
