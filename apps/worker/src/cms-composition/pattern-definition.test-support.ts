import {
  ApiErrorSchema,
  PatternVersionApiRequestSchema,
  PatternVersionDetailSchema,
  PatternVersionResourceSchema,
  type PatternVersionRequest,
  type PatternVersionResource,
} from '@wejammin/contracts';
import { createLogger } from '@wejammin/observability/logging';
import { parseServerEnvironment } from '@wejammin/config/environment';
import { Hono } from 'hono';
import { expect, vi } from 'vitest';

import { createWorkerApp, type WorkerBindings } from '../index';
import type { CmsEditorialSession } from '../cms-editorial/types';
import {
  createProductionWorkerAppRuntime,
  type ProductionCmsEditorialOptions,
} from '../production-worker-runtime';
import { createProductionCmsPatternDefinitionDependencies } from '../cms-composition-production-pattern-definition';
import { registerCmsPatternDefinitionRoutes } from './pattern-definition-routes';
import { registerCmsPatternLatestRoutes } from './pattern-definition-latest-routes';
import type { CmsPatternDefinitionDependencies } from './pattern-definition-ports';
import type { CmsEditorialProductionOptions } from '../cms-editorial-production-types';
import { authenticationSession } from '../cms-editorial-production-session-test-support';

export const ORIGIN = 'https://cms.example.test';
export const WRITE_PATH = '/api/v1/cms/patterns/versions';
export const PATTERN_KEY = 'profile-header';
export const READ_PATH = '/api/v1/cms/patterns/' + PATTERN_KEY;
export const REQUEST_ID = 'd1200000-0000-4000-8000-000000000091';
export const USER_ID = 'd1200000-0000-4000-8000-000000000092';
export const PARTY_ID = 'd1200000-0000-4000-8000-000000000093';
export const TYPE_ID = 'd1200000-0000-4000-8000-000000000094';
export const HASH = 'c'.repeat(64);
export const MAX_BYTES = 262_144;

const environment: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'slice-12-pattern-transport-red',
  SUPABASE_SECRET_KEY: 'sb_secret_synthetic_pattern_transport',
  SUPABASE_URL: 'https://supabase.example.test',
};

export const patternBody = (
  expectedVersion: string | null = null,
): PatternVersionRequest => ({
  patternKey: PATTERN_KEY,
  compatibleTypeIds: [TYPE_ID],
  blockTree: [
    {
      kind: 'block',
      key: 'header',
      blockKey: 'profile.header',
      blockVersion: 1,
      props: {},
      children: [],
    },
  ],
  expectedVersion,
});

export const patternResource = (
  version = 1,
  state: PatternVersionResource['state'] = 'draft',
): PatternVersionResource =>
  PatternVersionResourceSchema.parse({
    id: 'd1200000-0000-4000-8000-000000000095',
    version: String(version),
    createdAt: '2026-10-13T00:00:00Z',
    updatedAt: '2026-10-13T00:00:00Z',
    contentHash: HASH,
    state,
    patternId: 'd1200000-0000-4000-8000-000000000096',
    patternKey: PATTERN_KEY,
    patternVersion: version,
    compatibleTypeIds: [TYPE_ID],
    nodeCount: 1,
    blockRegistryDigest: HASH,
  });

export const patternDetail = (
  state: PatternVersionResource['state'] = 'draft',
) =>
  PatternVersionDetailSchema.parse({
    ...patternResource(7, state),
    blockTree: patternBody().blockTree,
  });

export const writeRequest = (
  body: unknown = patternBody(),
  headers: Record<string, string> = {},
): Request =>
  new Request('https://api.example.test' + WRITE_PATH, {
    method: 'POST',
    headers: {
      origin: ORIGIN,
      'content-type': 'application/json',
      'idempotency-key': 'pattern-definition-0001',
      'x-request-id': REQUEST_ID,
      ...headers,
    },
    body: JSON.stringify(body),
  });

export const readRequest = (
  path = READ_PATH,
  headers: Record<string, string> = {},
): Request =>
  new Request('https://api.example.test' + path, {
    headers: { origin: ORIGIN, 'x-request-id': REQUEST_ID, ...headers },
  });

/** Assert valid fixtures before reaching the missing production registration. */
export const assertWriteContract = (request: Request, body: unknown): void => {
  expect(
    PatternVersionApiRequestSchema.safeParse({
      headers: {
        contentType: request.headers.get('content-type'),
        idempotencyKey: request.headers.get('idempotency-key'),
        ...(request.headers.has('if-match')
          ? { ifMatch: request.headers.get('if-match') }
          : {}),
      },
      body,
    }).success,
  ).toBe(true);
};

export const designerSession: CmsEditorialSession = {
  userId: USER_ID,
  actingPartyId: PARTY_ID,
  capabilities: ['cms.template_designer'],
  mfaFresh: false,
};

/** Existing runtime seams only. No new pattern port or module is fabricated. */
export const patternHarness = (
  options: {
    anonymous?: boolean;
    integrated?: boolean;
    dependencies?: Partial<CmsPatternDefinitionDependencies>;
    authority?: Pick<
      CmsEditorialProductionOptions,
      'auth' | 'resolveCapabilities'
    >;
    session?: CmsEditorialSession;
    reply?: () => Promise<Response>;
    tuning?: ProductionCmsEditorialOptions;
  } = {},
) => {
  const logger = createLogger(
    {
      environment: 'staging',
      release: 'slice-12',
      service: 'wejammin-api',
    },
    {
      now: () => new Date('2026-10-13T00:00:00Z'),
      random: () => 0,
      sink: () => undefined,
    },
  );
  const resolveSession = vi.fn(async () =>
    options.anonymous === true
      ? {
          ok: false as const,
          status: 401 as const,
          code: 'UNAUTHENTICATED',
          message: 'Authentication is required.',
          details: {},
        }
      : {
          ok: true as const,
          value: authenticationSession({
            authUserId: (options.session ?? designerSession).userId,
            actingPartyId: (options.session ?? designerSession).actingPartyId,
            stepUpAt: null,
          }),
        },
  );
  const defaultRate: NonNullable<
    ProductionCmsEditorialOptions['rateLimit']
  > = async (input) => ({
    ok: true,
    value: {
      allowed: true,
      limit: input.limit,
      remaining: input.limit - 1,
      resetAt: 61,
    },
  });
  const rateLimit = vi.fn(options.tuning?.rateLimit ?? defaultRate);
  const fetchImpl = vi.fn<
    (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >(async () => {
    if (options.reply === undefined)
      throw new Error('Unscripted network boundary');
    return options.reply();
  });
  const tuning = {
    humanOrigins: [ORIGIN],
    now: () => 1_000,
    logger,
    ...options.tuning,
    ...(options.authority ?? {
      auth: { resolveSession },
      resolveCapabilities: (options.session ?? designerSession).capabilities,
    }),
    rateLimit,
  };
  const dependencies = {
    ...createProductionCmsPatternDefinitionDependencies({
      environment: parseServerEnvironment(environment),
      fetchImpl,
      ...tuning,
    }),
    ...options.dependencies,
  };
  const component = new Hono();
  registerCmsPatternDefinitionRoutes(component, dependencies);
  registerCmsPatternLatestRoutes(component, dependencies);
  const app =
    options.integrated === true
      ? createProductionWorkerAppRuntime(
          (dependencies) =>
            createWorkerApp({
              ...dependencies,
              createLogger: () => logger,
              now: () => 1_000,
            }),
          environment,
          fetchImpl,
          undefined,
          undefined,
          undefined,
          undefined,
          tuning,
        )
      : component;
  return {
    fetchImpl,
    resolveSession,
    rateLimit,
    dependencies,
    send: (request: Request) => app.request(request, undefined, environment),
  };
};

export const expectError = async (
  response: Response,
  status: number,
  code: string,
): Promise<ReturnType<typeof ApiErrorSchema.parse>> => {
  expect(response.status).toBe(status);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('x-request-id')).toBe(REQUEST_ID);
  expect(response.headers.get('etag')).toBeNull();
  const value = ApiErrorSchema.parse(await response.json());
  expect(value).toMatchObject({
    code,
    requestId: REQUEST_ID,
    message: `${code}: composition operation rejected or unavailable.`,
  });
  expect(JSON.stringify(value)).not.toContain('private provider');
  return value;
};

export const jsonReply = (value: unknown, status = 200): Promise<Response> =>
  Promise.resolve(Response.json(value, { status }));

/** Complete valid JSON at a precise byte count; no producer-bound claim. */
export const paddedResponse = (
  value: unknown,
  bytes: number,
  status = 200,
  declared = false,
): Response => {
  const json = JSON.stringify(value);
  const length = new TextEncoder().encode(json).byteLength;
  return new Response(json + ' '.repeat(bytes - length), {
    status,
    headers: {
      'content-type': 'application/json',
      ...(declared ? { 'content-length': String(bytes) } : {}),
    },
  });
};
