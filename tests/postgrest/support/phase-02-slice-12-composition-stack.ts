/**
 * The Slice 12 CMS-03C request chain for the real-API suites:
 *
 *   browser request -> first-party web proxy (apps/web/src/server)
 *     -> private PLATFORM_API binding -> production Hono Worker routes
 *     -> production RPC adapter -> Kong -> PostgREST -> newest SQL.
 *
 * Only two seams that never produce an RPC outcome are supplied: the verified session (cookie
 * authentication is not under test) and the rate limiter (always allowed). The binding hands the
 * proxy's request to the Worker app unchanged and nothing the database says is rewritten on the way
 * back. Mounted exactly as the production Worker mounts them (worker-route-composition.ts): the
 * template routes, then the latest-template read, then the locale route.
 */
import { randomUUID } from 'node:crypto';

import type { ServerEnvironment } from '@wejammin/config/environment';

import { forwardCmsLocaleVariantMutation } from '../../../apps/web/src/server/cms-composition-platform-locale';
import { readCmsTemplateContext } from '../../../apps/web/src/server/cms-composition-platform-context';
import { readCmsTemplateDetail } from '../../../apps/web/src/server/cms-composition-platform-detail';
import { forwardCmsTemplateDefineMutation } from '../../../apps/web/src/server/cms-composition-platform-mutation';
import { createProductionCmsTemplateDependencies } from '../../../apps/worker/src/cms-composition-production';
import { createProductionCmsLocaleDependencies } from '../../../apps/worker/src/cms-composition-production-locale';
import { registerCmsLocaleRoutes } from '../../../apps/worker/src/cms-composition/locale-routes';
import { registerCmsTemplateDetailRoutes } from '../../../apps/worker/src/cms-composition/template-detail-routes';
import { createCmsTemplateApp } from '../../../apps/worker/src/cms-composition/template-routes';
import type { CmsEditorialProductionOptions } from '../../../apps/worker/src/cms-editorial-production-types';
import { createIsolatedCmsOwner } from './cms-isolated-owner';
import { API_URL, type CmsOwner, psql, workerServiceCredential } from './stack';

export const BROWSER_ORIGIN = 'https://app.example.test';
const CSRF = 'csrf-token-api-gate-s12-0001';

export type CompositionSession = Readonly<{
  userId: string;
  actingPartyId: string | null;
  capabilities: readonly string[];
  mfaFresh: boolean;
}>;

export type ObservedRpc = Readonly<{
  rpc: string;
  status: number;
  message: string;
}>;

export type StackResponse = Readonly<{
  status: number;
  headers: Headers;
  body: Record<string, unknown>;
  text: string;
}>;

export type WriteOptions = Readonly<{
  idempotencyKey?: string;
  /** The version the caller read: becomes the strong If-Match. */
  ifMatch?: string;
  headers?: Readonly<Record<string, string>>;
  /** Replace the JSON body with raw text (malformed-body and media-type cases). */
  raw?: string;
}>;

/** A designer owner: an isolated CMS owner that also holds the cms.template_designer grant. */
export const createDesignerOwner = (): CmsOwner => {
  const owner = createIsolatedCmsOwner();
  psql(`
    insert into identity_private.organization_actor_grant(
      organization_id, person_id, capability_code, valid_from, valid_through, active)
    values ('${owner.organizationId}', '${owner.personId}', 'cms.template_designer',
            current_date, current_date + 30, true)
    on conflict (organization_id, person_id, capability_code)
    do update set active = true, valid_through = excluded.valid_through`);
  return owner;
};

export const designerSession = (
  owner: CmsOwner,
  capabilities: readonly string[] = ['cms.template_designer'],
): CompositionSession => ({
  userId: owner.authUserId,
  actingPartyId: owner.organizationId,
  capabilities,
  mfaFresh: false,
});

const toResponse = async (response: Response): Promise<StackResponse> => {
  const text = await response.text();
  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = text === '' ? {} : JSON.parse(text);
    if (typeof parsed === 'object' && parsed !== null)
      body = parsed as Record<string, unknown>;
  } catch {
    // a non-JSON body carries no members
  }
  return { status: response.status, headers: response.headers, body, text };
};

export type CompositionStack = ReturnType<typeof createCompositionStack>;

export const createCompositionStack = (initial: CompositionSession | null) => {
  let session: CompositionSession | null = initial;
  let loseNextResponse = false;
  let failNextRpc = false;
  const observed: ObservedRpc[] = [];

  const spyFetch = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    if (failNextRpc) {
      failNextRpc = false;
      throw new TypeError('PostgREST is unreachable');
    }
    const response = await fetch(input, init);
    const rpc =
      /\/rpc\/([a-z0-9_]+)$/u.exec(
        String(input instanceof Request ? input.url : input),
      )?.[1] ?? '';
    let message = '';
    try {
      const body = (await response.clone().json()) as { message?: unknown };
      if (typeof body.message === 'string') message = body.message;
    } catch {
      // a successful RPC body is not an error object
    }
    observed.push({ rpc, status: response.status, message });
    return response;
  }) as typeof fetch;

  const options: CmsEditorialProductionOptions = {
    environment: {
      SUPABASE_URL: API_URL,
      SUPABASE_SECRET_KEY: workerServiceCredential(),
      APP_ENVIRONMENT: 'development',
      APP_RELEASE: 'api-gate',
    } as unknown as ServerEnvironment,
    fetchImpl: spyFetch,
    humanOrigins: [BROWSER_ORIGIN],
    resolveSession: async () =>
      session === null
        ? {
            ok: false as const,
            status: 401 as const,
            code: 'UNAUTHENTICATED',
            message: 'No session.',
            details: { recoveryAction: 'reauthenticate' },
          }
        : { ok: true as const, value: session },
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
  const templateDependencies = createProductionCmsTemplateDependencies(options);
  const localeDependencies = createProductionCmsLocaleDependencies(options);
  // Mounted as worker-route-composition.ts mounts them: the context and versions routes first, so
  // the fixed segments are never read as a template key, then the latest read, then the locale route.
  const worker = createCmsTemplateApp(templateDependencies);
  registerCmsTemplateDetailRoutes(worker, templateDependencies);
  registerCmsLocaleRoutes(worker, localeDependencies);

  const binding = {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await worker.request(input as Request, init);
      if (loseNextResponse) {
        loseNextResponse = false;
        await response.text();
        throw new TypeError('the response never reached the proxy');
      }
      return response;
    },
  };

  const writeRequest = (path: string, body: unknown, write: WriteOptions) =>
    new Request(`${BROWSER_ORIGIN}${path}`, {
      method: 'POST',
      headers: {
        origin: BROWSER_ORIGIN,
        cookie: `wj_csrf=${CSRF}`,
        'x-csrf-token': CSRF,
        'content-type': 'application/json',
        'idempotency-key': write.idempotencyKey ?? `key-${randomUUID()}`,
        ...(write.ifMatch === undefined
          ? {}
          : { 'if-match': `"${write.ifMatch}"` }),
        ...write.headers,
      },
      body: write.raw ?? JSON.stringify(body),
    });
  const readRequest = (path: string) =>
    new Request(`${BROWSER_ORIGIN}${path}`, {
      method: 'GET',
      headers: { origin: BROWSER_ORIGIN, cookie: `wj_csrf=${CSRF}` },
    });

  return {
    observed: (): readonly ObservedRpc[] => observed,
    clearObserved: (): void => {
      observed.length = 0;
    },
    /** Switch the verified session (null = no session at all). */
    as: (next: CompositionSession | null): void => {
      session = next;
    },
    /** The next Worker response is executed, then dropped: a lost response. */
    loseNextResponse: (): void => {
      loseNextResponse = true;
    },
    /** The next RPC never reaches PostgREST (a transport failure). */
    failNextRpc: (): void => {
      failNextRpc = true;
    },
    /** A request straight to the Worker routes, bypassing the web proxy. */
    worker: async (
      method: 'GET' | 'POST',
      path: string,
      body?: unknown,
      write: WriteOptions = {},
    ): Promise<StackResponse> =>
      toResponse(
        await worker.request(
          new Request(`https://platform-api.internal${path}`, {
            method,
            headers:
              method === 'POST'
                ? {
                    'content-type': 'application/json',
                    'idempotency-key':
                      write.idempotencyKey ?? `key-${randomUUID()}`,
                    ...(write.ifMatch === undefined
                      ? {}
                      : { 'if-match': `"${write.ifMatch}"` }),
                    ...write.headers,
                  }
                : {},
            ...(method === 'POST'
              ? { body: write.raw ?? JSON.stringify(body) }
              : {}),
          }),
        ),
      ),
    defineTemplate: async (body: unknown, write: WriteOptions = {}) =>
      toResponse(
        await forwardCmsTemplateDefineMutation(
          writeRequest('/api/v1/cms/templates/versions', body, write),
          binding,
        ),
      ),
    templateContext: async () =>
      toResponse(
        await readCmsTemplateContext(
          readRequest('/api/v1/cms/templates/context'),
          binding,
        ),
      ),
    templateLatest: async (templateKey: string) =>
      toResponse(
        await readCmsTemplateDetail(
          readRequest(`/api/v1/cms/templates/${templateKey}`),
          binding,
          templateKey,
        ),
      ),
    authorLocale: async (
      entryId: string,
      locale: string,
      body: unknown,
      write: WriteOptions = {},
    ) =>
      toResponse(
        await forwardCmsLocaleVariantMutation(
          writeRequest(
            `/api/v1/cms/entries/${entryId}/locales/${locale}/variants`,
            body,
            write,
          ),
          entryId,
          locale,
          binding,
        ),
      ),
  };
};
