/**
 * The Slice 12 CMS-03C request chain for the real-stack latency suite:
 *
 *   browser request -> production Hono Worker app (every CMS-03C route the deployed Worker mounts)
 *     -> production composition dependencies (session resolver, fresh-context re-proof, RPC adapters)
 *     -> Kong -> PostgREST -> the newest SQL.
 *
 * The composition is the one `worker-route-composition.ts` mounts: the template routes, then the template
 * detail read, the locale routes, the taxonomy term action, the pattern instance, update, definition and
 * latest routes, the taxonomy definition routes, the governed review routes and the related-content routes.
 * Every dependency bundle is built by its production factory from ONE options object (session through
 * `options.auth` + `resolveCapabilities`, so the server session context the RPC receives carries the same
 * `sessionId`, `actorPersonId` and `stepUpAt` members as in production). Only the pieces that never produce an
 * RPC outcome are supplied: the verified authentication session (cookie authentication is not under test) and an
 * always-allow rate limiter. No database answer is rewritten on the way back. The twin of
 * `phase-02-slice-11-stack.ts` for the Slice 12 routes.
 */
import { createHash, randomUUID } from 'node:crypto';

import type { ServerEnvironment } from '@wejammin/config/environment';
import type { Hono } from 'hono';

import { registerCmsGovernedReviewRoutes } from '../../../apps/worker/src/cms-composition/governed-review-routes';
import { registerCmsLocaleRoutes } from '../../../apps/worker/src/cms-composition/locale-routes';
import { registerCmsPatternDefinitionRoutes } from '../../../apps/worker/src/cms-composition/pattern-definition-routes';
import { registerCmsPatternLatestRoutes } from '../../../apps/worker/src/cms-composition/pattern-definition-latest-routes';
import { registerCmsPatternInstanceRoutes } from '../../../apps/worker/src/cms-composition/pattern-instance-routes';
import { registerCmsPatternUpdateRoutes } from '../../../apps/worker/src/cms-composition/pattern-update-routes';
import { registerCmsRelatedContentRoutes } from '../../../apps/worker/src/cms-composition/related-content-routes';
import { registerCmsTaxonomyDefinitionRoutes } from '../../../apps/worker/src/cms-composition/taxonomy-definition-routes';
import { registerCmsTaxonomyRoutes } from '../../../apps/worker/src/cms-composition/taxonomy-routes';
import { registerCmsTemplateDetailRoutes } from '../../../apps/worker/src/cms-composition/template-detail-routes';
import { createCmsTemplateApp } from '../../../apps/worker/src/cms-composition/template-routes';
import { createProductionCmsTemplateDependencies } from '../../../apps/worker/src/cms-composition-production';
import { createProductionCmsGovernedReviewDependencies } from '../../../apps/worker/src/cms-composition-production-governed-review';
import { createProductionCmsLocaleDependencies } from '../../../apps/worker/src/cms-composition-production-locale';
import { createProductionCmsPatternDefinitionDependencies } from '../../../apps/worker/src/cms-composition-production-pattern-definition';
import { createProductionCmsPatternInstanceDependencies } from '../../../apps/worker/src/cms-composition-production-pattern';
import { createProductionCmsPatternUpdateDependencies } from '../../../apps/worker/src/cms-composition-production-pattern-update';
import { createProductionCmsRelatedContentDependencies } from '../../../apps/worker/src/cms-composition-production-related';
import { createProductionCmsTaxonomyDefinitionDependencies } from '../../../apps/worker/src/cms-composition-production-taxonomy-definition';
import { createProductionCmsTaxonomyDependencies } from '../../../apps/worker/src/cms-composition-production-taxonomy';
import type { CmsEditorialProductionOptions } from '../../../apps/worker/src/cms-editorial-production-types';
import { API_URL, workerServiceCredential } from './stack';

export const LATENCY_ORIGIN = 'https://app.example.test';
const CSRF = 'csrf-token-slice-12-latency-0001';

/** A person the verified session can stand for. */
export type LatencyActor = Readonly<{
  authUserId: string;
  personId: string;
  organizationId: string;
  capabilities: readonly string[];
}>;

/** How fresh the step-up proof of the next requests is. */
export type StepUp = 'fresh' | 'none';

export type LatencyResponse = Readonly<{
  status: number;
  headers: Headers;
  body: Record<string, unknown>;
  text: string;
}>;

export type SendOptions = Readonly<{
  body?: unknown;
  /** Defaults to a fresh key on POST. */
  idempotencyKey?: string;
  /** The bare version the caller read: becomes the strong If-Match. */
  ifMatch?: string;
}>;

const sessionIdOf = (actor: LatencyActor): string => {
  const hex = createHash('sha256')
    .update(`s12-latency-session:${actor.authUserId}`)
    .digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

const toResponse = async (response: Response): Promise<LatencyResponse> => {
  const text = await response.text();
  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = text === '' ? {} : JSON.parse(text);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed))
      body = parsed as Record<string, unknown>;
  } catch {
    // a non-JSON body carries no members
  }
  return { status: response.status, headers: response.headers, body, text };
};

export type LatencyStack = ReturnType<typeof createLatencyStack>;

export const createLatencyStack = (initial: LatencyActor) => {
  let actor: LatencyActor | null = initial;
  let stepUp: StepUp = 'none';
  const rpcs: { rpc: string; status: number }[] = [];

  const spyFetch = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const response = await fetch(input, init);
    const rpc =
      /\/rpc\/([a-z0-9_]+)$/u.exec(
        String(input instanceof Request ? input.url : input),
      )?.[1] ?? '';
    rpcs.push({ rpc, status: response.status });
    return response;
  }) as typeof fetch;

  const options: CmsEditorialProductionOptions = {
    environment: {
      SUPABASE_URL: API_URL,
      SUPABASE_SECRET_KEY: workerServiceCredential(),
      APP_ENVIRONMENT: 'development',
      APP_RELEASE: 'slice-12-latency',
    } as unknown as ServerEnvironment,
    fetchImpl: spyFetch,
    humanOrigins: [LATENCY_ORIGIN],
    auth: {
      resolveSession: async () =>
        actor === null
          ? {
              ok: false as const,
              status: 401 as const,
              code: 'UNAUTHENTICATED',
              message: 'No session.',
              details: { recoveryAction: 'reauthenticate' },
            }
          : {
              ok: true as const,
              value: {
                authUserId: actor.authUserId,
                sessionId: sessionIdOf(actor),
                accountState: 'active' as const,
                personId: actor.personId,
                actingPartyId: actor.organizationId,
                expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
                stepUpAt:
                  stepUp === 'fresh'
                    ? new Date(Date.now() - 1_000).toISOString()
                    : null,
              },
            },
    },
    resolveCapabilities: () => actor?.capabilities ?? [],
    rateLimit: async (input) => ({
      ok: true as const,
      value: {
        allowed: true,
        limit: input.limit,
        remaining: input.limit - 1,
        resetAt: Math.floor(Date.now() / 1000) + 60,
      },
    }),
  };

  // Mounted as worker-route-composition.ts mounts them (fixed segments before parameterised ones).
  const templates = createProductionCmsTemplateDependencies(options);
  const app: Hono = createCmsTemplateApp(templates);
  registerCmsTemplateDetailRoutes(app, templates);
  registerCmsLocaleRoutes(app, createProductionCmsLocaleDependencies(options));
  registerCmsTaxonomyRoutes(
    app,
    createProductionCmsTaxonomyDependencies(options),
  );
  registerCmsPatternInstanceRoutes(
    app,
    createProductionCmsPatternInstanceDependencies(options),
  );
  registerCmsRelatedContentRoutes(
    app,
    createProductionCmsRelatedContentDependencies(options),
  );
  registerCmsPatternUpdateRoutes(
    app,
    createProductionCmsPatternUpdateDependencies(options),
  );
  const patterns = createProductionCmsPatternDefinitionDependencies(options);
  registerCmsPatternDefinitionRoutes(app, patterns);
  registerCmsPatternLatestRoutes(app, patterns);
  registerCmsTaxonomyDefinitionRoutes(
    app,
    createProductionCmsTaxonomyDefinitionDependencies(options),
  );
  registerCmsGovernedReviewRoutes(
    app,
    createProductionCmsGovernedReviewDependencies(options),
  );

  const send = async (
    method: 'GET' | 'POST',
    path: string,
    sendOptions: SendOptions = {},
  ): Promise<LatencyResponse> => {
    const headers: Record<string, string> = {
      origin: LATENCY_ORIGIN,
      cookie: `wj_csrf=${CSRF}`,
    };
    if (method === 'POST') {
      headers['x-csrf-token'] = CSRF;
      headers['content-type'] = 'application/json';
      headers['idempotency-key'] =
        sendOptions.idempotencyKey ?? `key-${randomUUID()}`;
      if (sendOptions.ifMatch !== undefined)
        headers['if-match'] = `"${sendOptions.ifMatch}"`;
    }
    return toResponse(
      await app.request(
        new Request(`${LATENCY_ORIGIN}${path}`, {
          method,
          headers,
          ...(method === 'POST'
            ? { body: JSON.stringify(sendOptions.body ?? {}) }
            : {}),
        }),
      ),
    );
  };

  return {
    /** Switch the verified session (null = no session) and its step-up proof. */
    as: (next: LatencyActor | null, proof: StepUp = 'none'): void => {
      actor = next;
      stepUp = proof;
    },
    rpcs: (): readonly { rpc: string; status: number }[] => rpcs,
    clearRpcs: (): void => {
      rpcs.length = 0;
    },
    get: (path: string) => send('GET', path),
    post: (path: string, sendOptions: SendOptions = {}) =>
      send('POST', path, sendOptions),
  };
};
