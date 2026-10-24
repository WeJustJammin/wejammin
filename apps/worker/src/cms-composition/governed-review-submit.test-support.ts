import {
  ApiErrorSchema,
  GovernedReviewResourceSchema,
  GovernedReviewSubmissionApiRequestSchema,
  type GovernedReviewResource,
  type GovernedReviewSubmissionRequest,
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
import { createProductionCmsGovernedReviewDependencies } from '../cms-composition-production-governed-review';
import { registerCmsGovernedReviewRoutes } from './governed-review-routes';
import type { CmsGovernedReviewDependencies } from './governed-review-ports';
import type { CmsEditorialProductionOptions } from '../cms-editorial-production-types';
import { authenticationSession } from '../cms-editorial-production-session-test-support';

export const ORIGIN = 'https://cms.example.test';
export const PATH = '/api/v1/cms/governed-reviews';
export const REQUEST_ID = 'd1200000-0000-4000-8000-000000000191';
export const USER_ID = 'd1200000-0000-4000-8000-000000000192';
export const PARTY_ID = 'd1200000-0000-4000-8000-000000000193';
export const SUBJECT_ID = 'd1200000-0000-4000-8000-000000000194';
export const REVIEW_ID = 'd1200000-0000-4000-8000-000000000195';
export const LINEAGE_ID = 'd1200000-0000-4000-8000-000000000196';
export const HASH = 'c'.repeat(64);
export const POLICY_HASH = 'e'.repeat(64);
export const MAX_BYTES = 262_144;
export const IDEMPOTENCY_KEY = 'governed-submit-0001';

const environment: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'slice-12-governed-review-transport',
  SUPABASE_SECRET_KEY: 'sb_secret_synthetic_governed_transport',
  SUPABASE_URL: 'https://supabase.example.test',
};

export const submitBody = (
  subjectKind: GovernedReviewSubmissionRequest['subjectKind'] = 'template_version',
): GovernedReviewSubmissionRequest => ({
  subjectKind,
  subjectId: SUBJECT_ID,
  subjectHash: HASH,
});

/** A committed `open` review at version 1, as the SQL producer returns it. */
export const reviewResource = (
  subjectKind: GovernedReviewSubmissionRequest['subjectKind'] = 'template_version',
  overrides: Record<string, unknown> = {},
): GovernedReviewResource =>
  GovernedReviewResourceSchema.parse({
    id: REVIEW_ID,
    version: '1',
    contentHash: 'b'.repeat(64),
    createdAt: '2026-10-14T00:00:00Z',
    updatedAt: '2026-10-14T00:00:00Z',
    state: 'open',
    subjectKind,
    subjectId: SUBJECT_ID,
    lineageId: LINEAGE_ID,
    subjectKey: 'profile-header',
    subjectVersion: 2,
    subjectHash: HASH,
    riskClass: 'ordinary',
    requiredDecisionCount: 1,
    recordedDecisionCount: 0,
    requiredCapabilities: ['cms.reviewer'],
    policyBasisHash: POLICY_HASH,
    submittedAt: '2026-10-14T00:00:00Z',
    decidedAt: null,
    activatedAt: null,
    invalidatedReason: null,
    ...overrides,
  });

export const submitRequest = (
  body: unknown = submitBody(),
  headers: Record<string, string> = {},
): Request =>
  new Request('https://api.example.test' + PATH, {
    method: 'POST',
    headers: {
      origin: ORIGIN,
      'content-type': 'application/json',
      'idempotency-key': IDEMPOTENCY_KEY,
      'x-request-id': REQUEST_ID,
      ...headers,
    },
    body: JSON.stringify(body),
  });

/** Assert valid fixtures before reaching the production registration. */
export const assertSubmitContract = (request: Request, body: unknown): void => {
  expect(
    GovernedReviewSubmissionApiRequestSchema.safeParse({
      headers: {
        contentType: request.headers.get('content-type'),
        idempotencyKey: request.headers.get('idempotency-key'),
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
export const curatorSession: CmsEditorialSession = {
  ...designerSession,
  capabilities: ['cms.taxonomy_curator'],
};

type HarnessOptions = {
  anonymous?: boolean;
  integrated?: boolean;
  dependencies?: Partial<CmsGovernedReviewDependencies>;
  authority?: Pick<
    CmsEditorialProductionOptions,
    'auth' | 'resolveCapabilities'
  >;
  session?: CmsEditorialSession;
  /** The verified step-up instant of the resolved session (null = none). */
  stepUpAt?: string | null;
  reply?: () => Promise<Response>;
  tuning?: ProductionCmsEditorialOptions;
};

/** Existing runtime seams only; the network boundary is scripted per test. */
export const governedHarness = (options: HarnessOptions = {}) => {
  const logger = createLogger(
    { environment: 'staging', release: 'slice-12', service: 'wejammin-api' },
    {
      now: () => new Date('2026-10-14T00:00:00Z'),
      random: () => 0,
      sink: () => undefined,
    },
  );
  const session = options.session ?? designerSession;
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
            authUserId: session.userId,
            actingPartyId: session.actingPartyId,
            stepUpAt: options.stepUpAt ?? null,
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
      resolveCapabilities: session.capabilities,
    }),
    rateLimit,
  };
  const dependencies = {
    ...createProductionCmsGovernedReviewDependencies({
      environment: parseServerEnvironment(environment),
      fetchImpl,
      ...tuning,
    }),
    ...options.dependencies,
  };
  const component = new Hono();
  registerCmsGovernedReviewRoutes(component, dependencies);
  const app =
    options.integrated === true
      ? createProductionWorkerAppRuntime(
          (runtime) =>
            createWorkerApp({
              ...runtime,
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
    message: `${code}: governed-review operation rejected or unavailable.`,
  });
  expect(JSON.stringify(value)).not.toContain('private provider');
  return value;
};

export const jsonReply = (value: unknown, status = 200): Promise<Response> =>
  Promise.resolve(Response.json(value, { status }));

/** Complete valid JSON at a precise byte count. */
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

/** A scripted PostgREST refusal: the SQL producer's `raise exception '<token>'`. */
export const sqlRefusal = (
  token: string,
  details?: unknown,
): Promise<Response> =>
  jsonReply(
    {
      code: 'P0001',
      message: token,
      details: details ?? 'private provider',
    },
    400,
  );
