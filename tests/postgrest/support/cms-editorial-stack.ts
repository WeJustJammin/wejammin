/**
 * The full Slice 10 request chain for the real-API suites:
 *
 *   browser request -> first-party web proxy (apps/web/src/server)
 *     -> private PLATFORM_API binding -> production Hono Worker app
 *     -> production RPC adapter -> Kong -> PostgREST -> newest SQL.
 *
 * Only two seams that never produce an RPC outcome are supplied: the verified
 * session (cookie authentication is not under test) and the rate limiter
 * (always allowed). The binding hands the proxy's request to the Worker app
 * unchanged, and nothing the database says is rewritten on the way back.
 */
import { randomUUID } from 'node:crypto';

import type { ServerEnvironment } from '@wejammin/config/environment';

import {
  forwardCmsEditorialAuthoringContextRead,
  forwardCmsEditorialConflictDetailRead,
  forwardCmsEditorialEntryDraftDetailRead,
  forwardCmsEditorialEntryListRead,
  forwardCmsEditorialRevisionHistoryRead,
} from '../../../apps/web/src/server/cms-editorial-platform-reads';
import { forwardCmsEditorialConflictResolution } from '../../../apps/web/src/server/cms-editorial-platform-conflict';
import { forwardCmsEditorialEntryCreateMutation } from '../../../apps/web/src/server/cms-editorial-platform-mutation';
import { forwardCmsEditorialRevisionMutation } from '../../../apps/web/src/server/cms-editorial-platform-revision';
import { forwardCmsEditorialRevisionRestore } from '../../../apps/web/src/server/cms-editorial-platform-restore';
import { createCmsEditorialApp } from '../../../apps/worker/src/cms-editorial';
import type { CmsEditorialDependencies } from '../../../apps/worker/src/cms-editorial';
import { createProductionCmsEditorialDependencies } from '../../../apps/worker/src/cms-editorial-production';
import type { CmsEditorialTelemetryEvent } from '../../../apps/worker/src/cms-editorial-production-types';
import { API_URL, workerServiceCredential } from './stack';

export const BROWSER_ORIGIN = 'https://app.example.test';
const CSRF = 'csrf-token-api-gate-0001';

export type EditorialSession = Readonly<{
  userId: string;
  actingPartyId: string | null;
  capabilities: readonly string[];
  mfaFresh: boolean;
}>;

export type StackResponse = Readonly<{
  status: number;
  headers: Headers;
  body: Record<string, unknown>;
  text: string;
}>;

export type ObservedRpc = Readonly<{
  rpc: string;
  status: number;
  message: string;
}>;

export type WriteOptions = Readonly<{
  idempotencyKey?: string;
  /** The entry version the caller read: becomes the strong If-Match. */
  ifMatch?: string;
  headers?: Readonly<Record<string, string>>;
  signal?: AbortSignal;
}>;

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

export type EditorialStack = ReturnType<typeof createEditorialStack>;

export const createEditorialStack = (initial: EditorialSession) => {
  let session: EditorialSession | null = initial;
  let loseNextResponse = false;
  const observed: ObservedRpc[] = [];
  const events: CmsEditorialTelemetryEvent[] = [];

  const spyFetch = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
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

  const production = createProductionCmsEditorialDependencies({
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
    telemetry: (event) => {
      events.push(event);
    },
  });
  const worker = createCmsEditorialApp(
    production as unknown as CmsEditorialDependencies,
  );
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

  const writeHeaders = (options: WriteOptions): Record<string, string> => ({
    origin: BROWSER_ORIGIN,
    cookie: `wj_csrf=${CSRF}`,
    'x-csrf-token': CSRF,
    'content-type': 'application/json',
    'idempotency-key': options.idempotencyKey ?? `key-${randomUUID()}`,
    ...(options.ifMatch === undefined
      ? {}
      : { 'if-match': `"${options.ifMatch}"` }),
    ...options.headers,
  });
  const writeRequest = (path: string, body: unknown, options: WriteOptions) =>
    new Request(`${BROWSER_ORIGIN}${path}`, {
      method: 'POST',
      headers: writeHeaders(options),
      body: typeof body === 'string' ? body : JSON.stringify(body),
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    });
  const readRequest = (path: string) =>
    new Request(`${BROWSER_ORIGIN}${path}`, {
      method: 'GET',
      headers: { origin: BROWSER_ORIGIN, cookie: `wj_csrf=${CSRF}` },
    });

  const ENTRIES = '/api/v1/cms/entries';
  return {
    observed: (): readonly ObservedRpc[] => observed,
    clearObserved: (): void => {
      observed.length = 0;
    },
    events: (): readonly CmsEditorialTelemetryEvent[] => events,
    /** Switch the verified session (null = no session at all). */
    as: (next: EditorialSession | null): void => {
      session = next;
    },
    /** The next Worker response is executed, then dropped: a lost response. */
    loseNextResponse: (): void => {
      loseNextResponse = true;
    },
    /** A request straight to the Worker app, bypassing the web proxy. */
    worker: async (
      method: 'GET' | 'POST',
      path: string,
      body?: unknown,
      options: WriteOptions = {},
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
                      options.idempotencyKey ?? `key-${randomUUID()}`,
                    ...(options.ifMatch === undefined
                      ? {}
                      : { 'if-match': `"${options.ifMatch}"` }),
                  }
                : {},
            ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
          }),
        ),
      ),
    create: async (body: unknown, options: WriteOptions = {}) =>
      toResponse(
        await forwardCmsEditorialEntryCreateMutation(
          writeRequest(ENTRIES, body, options),
          binding,
        ),
      ),
    append: async (entryId: string, body: unknown, options: WriteOptions) =>
      toResponse(
        await forwardCmsEditorialRevisionMutation(
          writeRequest(`${ENTRIES}/${entryId}/revisions`, body, options),
          entryId,
          binding,
        ),
      ),
    resolve: async (
      entryId: string,
      conflictId: string,
      body: unknown,
      options: WriteOptions,
    ) =>
      toResponse(
        await forwardCmsEditorialConflictResolution(
          writeRequest(
            `${ENTRIES}/${entryId}/conflicts/${conflictId}/resolve`,
            body,
            options,
          ),
          entryId,
          conflictId,
          binding,
        ),
      ),
    restore: async (
      entryId: string,
      revisionId: string,
      body: unknown,
      options: WriteOptions,
    ) =>
      toResponse(
        await forwardCmsEditorialRevisionRestore(
          writeRequest(
            `${ENTRIES}/${entryId}/revisions/${revisionId}/restore`,
            body,
            options,
          ),
          entryId,
          revisionId,
          binding,
        ),
      ),
    authoringContext: async (query = '') =>
      toResponse(
        await forwardCmsEditorialAuthoringContextRead(
          readRequest(`${ENTRIES}/authoring-context${query}`),
          binding,
        ),
      ),
    draftDetail: async (entryId: string, query = '') =>
      toResponse(
        await forwardCmsEditorialEntryDraftDetailRead(
          readRequest(`${ENTRIES}/${entryId}${query}`),
          binding,
          entryId,
        ),
      ),
    history: async (entryId: string, query = '') =>
      toResponse(
        await forwardCmsEditorialRevisionHistoryRead(
          readRequest(`${ENTRIES}/${entryId}/revisions${query}`),
          binding,
          entryId,
        ),
      ),
    list: async (query = '') =>
      toResponse(
        await forwardCmsEditorialEntryListRead(
          readRequest(`${ENTRIES}${query}`),
          binding,
        ),
      ),
    conflictDetail: async (entryId: string, conflictId: string) =>
      toResponse(
        await forwardCmsEditorialConflictDetailRead(
          readRequest(`${ENTRIES}/${entryId}/conflicts/${conflictId}`),
          entryId,
          conflictId,
          binding,
        ),
      ),
  };
};
