import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ApiErrorSchema,
  cmsEditorialRoutePolicies,
  type AuthoringContextResource,
  type AuthoringContextType,
} from '@wejammin/contracts';

import { createCmsEditorialApp, type CmsEditorialDependencies } from './index';

/*
 * BE00 admission shared by the three Slice 10 safe reads (CMS-03B-12 conflict
 * detail, CMS-03B-13 entry list, CMS-03B-14 authoring context): browser origin,
 * the verified human session, the route deadline, and the rate gate all answer
 * before any private port is called, whatever the request id or clock the
 * deployment supplies. Each case runs against every route so a drift in one
 * copy of the admission chain cannot hide behind the others.
 */

const origin = 'https://cms-console.example.test';
const userId = '10000000-0000-4000-8000-000000000001';
const partyId = '20000000-0000-4000-8000-000000000002';
const entryId = '30000000-0000-4000-8000-000000000003';
const conflictId = '31000000-0000-4000-8000-000000000003';
const versionId = '71000000-0000-4000-8000-000000000007';
const hash = 'a'.repeat(64);

const routes = [
  {
    name: 'CMS-03B-12 conflict detail',
    operationId: 'CMS-03B-12',
    url: `/api/v1/cms/entries/${entryId}/conflicts/${conflictId}`,
  },
  {
    name: 'CMS-03B-13 entry list',
    operationId: 'CMS-03B-13',
    url: '/api/v1/cms/entries',
  },
  {
    name: 'CMS-03B-14 authoring context',
    operationId: 'CMS-03B-14',
    url: '/api/v1/cms/entries/authoring-context',
  },
] as const;

const policyFor = (operationId: string) =>
  cmsEditorialRoutePolicies.find(
    (item) => item.operationId === operationId,
  ) as (typeof cmsEditorialRoutePolicies)[number];

const unavailable = async () => ({
  ok: false as const,
  status: 503 as const,
  code: 'DEPENDENCY_UNAVAILABLE',
  message: 'Unavailable.',
});

const humanSession = {
  userId,
  actingPartyId: partyId,
  capabilities: ['cms.author'],
  mfaFresh: true,
};

type Overrides = Partial<
  Pick<CmsEditorialDependencies, 'resolveSession' | 'rateLimit' | 'ports'>
> & { deadlineMs?: number };

/** No injected clock: the routes must fall back to the system clock. */
const compose = (overrides: Overrides = {}) =>
  createCmsEditorialApp({
    ports: {
      appendRevision: unavailable,
      getConflictDetail: unavailable,
      listEntries: unavailable,
      getAuthoringContext: unavailable,
    },
    resolveSession: async () => ({ ok: true as const, value: humanSession }),
    rateLimit: async () => ({
      ok: true as const,
      value: { allowed: true, limit: 300, remaining: 299, resetAt: 60 },
    }),
    humanOrigins: [origin],
    ...overrides,
  } as unknown as CmsEditorialDependencies);

const get = (
  app: ReturnType<typeof createCmsEditorialApp>,
  url: string,
  headers: Record<string, string> = { origin },
) => Promise.resolve(app.request(url, { method: 'GET', headers }));

afterEach(() => {
  vi.restoreAllMocks();
});

describe.each(routes)('$name admission', ({ operationId, url }) => {
  it('generates a request id and uses the system clock when none are supplied', async () => {
    const app = compose({
      resolveSession: async () => ({
        ok: false as const,
        status: 401 as const,
        code: 'UNAUTHENTICATED',
        message: 'Sign in.',
      }),
    });
    const response = await get(app, url);
    expect(response.status).toBe(401);
    expect(response.headers.get('x-request-id')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,
    );
    expect(ApiErrorSchema.parse(await response.json()).code).toBe(
      'UNAUTHENTICATED',
    );
  });

  it('refuses a browser origin outside the human allowlist before any session work', async () => {
    const resolveSession = vi.fn(async () => ({
      ok: true as const,
      value: humanSession,
    }));
    const response = await get(compose({ resolveSession }), url, {
      origin: 'https://evil.example.test',
    });
    expect(response.status).toBe(403);
    expect(resolveSession).not.toHaveBeenCalled();
  });

  it('refuses a resolved session that is not a structurally valid human session', async () => {
    const response = await get(
      compose({
        resolveSession: async () => ({
          ok: true as const,
          value: { ...humanSession, userId: 'not-a-uuid' },
        }),
      }),
      url,
    );
    expect(response.status).toBe(401);
    expect(ApiErrorSchema.parse(await response.json()).details).toEqual({
      recoveryAction: 'reauthenticate',
    });
  });

  it('falls back to the route deadline when the configured one is not finite', async () => {
    const response = await get(
      compose({
        deadlineMs: Number.NaN,
        resolveSession: async () => ({
          ok: false as const,
          status: 503 as const,
          code: 'DEPENDENCY_UNAVAILABLE',
          message: 'Unavailable.',
        }),
      }),
      url,
    );
    expect(response.status).toBe(503);
  });

  it('answers 504 without calling the session resolver once the deadline is spent', async () => {
    const resolveSession = vi.fn(async () => ({
      ok: true as const,
      value: humanSession,
    }));
    const response = await get(compose({ deadlineMs: 0, resolveSession }), url);
    expect(response.status).toBe(504);
    expect(resolveSession).not.toHaveBeenCalled();
  });

  it('publishes the exhausted quota with the decision limit and its remaining count', async () => {
    const response = await get(
      compose({
        rateLimit: async () => ({
          ok: true as const,
          value: { allowed: false, limit: 300, remaining: 0, resetAt: 1 },
        }),
      }),
      url,
    );
    expect(response.status).toBe(429);
    expect(response.headers.get('ratelimit-limit')).toBe('300');
    expect(response.headers.get('ratelimit-remaining')).toBe('0');
  });

  it('falls back to the route quota when a refusal carries no numeric limit', async () => {
    const response = await get(
      compose({
        rateLimit: async () => ({
          ok: false as const,
          status: 429 as const,
          code: 'RATE_LIMITED',
          message: 'Limited.',
        }),
      }),
      url,
    );
    expect(response.status).toBe(429);
    expect(response.headers.get('ratelimit-limit')).toBe(
      String(policyFor(operationId).rateLimit),
    );
  });

  it('answers a rate dependency outage as that outage, not as a quota refusal', async () => {
    const response = await get(
      compose({
        rateLimit: async () => ({
          ok: false as const,
          status: 503 as const,
          code: 'DEPENDENCY_UNAVAILABLE',
          message: 'Unavailable.',
        }),
      }),
      url,
    );
    expect(response.status).toBe(503);
    expect(response.headers.has('ratelimit-limit')).toBe(false);
  });
});

describe('CMS-03B-13 closed query', () => {
  it('refuses a repeated filter instead of choosing one of its values', async () => {
    const response = await get(
      compose(),
      '/api/v1/cms/entries?state=draft&state=approved',
    );
    expect(response.status).toBe(400);
    expect(ApiErrorSchema.parse(await response.json()).details).toMatchObject({
      violations: [{ path: '/state', code: 'duplicate_field' }],
    });
  });
});

/*
 * CMS-03B-14 cross-checks the dependency projection beyond the strict schema:
 * the selection must be one of the creatable types and no preparation may carry
 * the schema-registry read capability. The response ETag is a digest of the exact
 * response bytes, so an unavailable digest is a typed 500, never an unvalidated
 * 200.
 */
const evidence = {
  key: 'editorial.standard',
  version: '1',
  policyHash: hash,
  riskClass: 'ordinary' as const,
  requiredDecisionCount: 1,
  requiredCapabilities: [],
  approvalEvidenceHash: hash,
};

const type = (contentTypeVersionId: string): AuthoringContextType => ({
  contentTypeId: '70000000-0000-4000-8000-000000000007',
  contentTypeVersionId,
  label: 'Article',
  sourceLocale: 'en-US',
  defaultLocale: 'en-US',
  supportedLocales: ['en-US'],
  schemaArtifact: {
    id: '72000000-0000-4000-8000-000000000007',
    contentTypeVersionId,
    artifactHash: hash,
    compilerVersion: '1.0.0',
    zodContractRef: '03a.content-type-version.v1',
  },
  validatorRefs: [],
  workflowPolicy: evidence,
  activationEvidence: evidence,
});

const authoringApp = (resource: AuthoringContextResource) =>
  compose({
    ports: {
      appendRevision: unavailable,
      getAuthoringContext: async () => ({ ok: true as const, value: resource }),
    },
  } as Overrides);

const authoringUrl = `/api/v1/cms/entries/authoring-context?contentTypeVersionId=${versionId}`;

describe('CMS-03B-14 projection cross-checks', () => {
  it('refuses a selected type that is not among the creatable types', async () => {
    const response = await get(
      authoringApp({
        creatableTypes: [type('71000000-0000-4000-8000-000000000017')],
        selectedType: type(versionId),
        fields: [],
      }),
      authoringUrl,
    );
    expect(response.status).toBe(502);
  });

  it('answers a typed 500 when the response digest cannot be computed', async () => {
    vi.spyOn(crypto.subtle, 'digest').mockRejectedValue(new Error('no digest'));
    const response = await get(
      authoringApp({
        creatableTypes: [type(versionId)],
        selectedType: type(versionId),
        fields: [],
      }),
      authoringUrl,
    );
    expect(response.status).toBe(500);
    expect(ApiErrorSchema.parse(await response.json()).code).toBe(
      'INTERNAL_ERROR',
    );
  });
});
