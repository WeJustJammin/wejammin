/**
 * The real CMS registry Worker app composed for the real-API suites.
 *
 * The app is the production Hono app built on the production dependency factory,
 * so every request reaches the production RPC adapter and its error mapper, and
 * every RPC goes through Kong and PostgREST to the live database. Only the two
 * seams that never produce an RPC outcome are supplied directly: the session
 * (a verified owner session, since cookie authentication is not under test here)
 * and the rate limiter (always allowed). Nothing in the Worker is told which
 * status, code or detail to answer, and nothing the database says is rewritten.
 */
import { randomUUID } from 'node:crypto';

import type { ServerEnvironment } from '@wejammin/config/environment';

import {
  createContentSchemaRegistryApp,
  type ContentSchemaRegistryDependencies,
  type ContentSchemaRegistrySession,
  type TelemetryEvent,
} from '../../../apps/worker/src/content-schema-registry';
import { createProductionContentSchemaRegistryDependencies } from '../../../apps/worker/src/content-schema-registry/production';
import { API_URL, workerServiceCredential } from './stack';

export const CMS_TEST_ORIGIN = 'https://cms-console.example.test';

export type ObservedRpc = Readonly<{
  rpc: string;
  status: number;
  message: string;
}>;

/** The `p_request` member names the production adapter put on the wire for each RPC. */
export type SentRpc = Readonly<{ rpc: string; members: readonly string[] }>;

export type CmsApp = Readonly<{
  /** Sends one browser request through the Worker app. */
  send: (
    method: 'GET' | 'POST',
    path: string,
    options?: Readonly<{
      body?: unknown;
      idempotencyKey?: string;
      ifMatch?: string;
    }>,
  ) => Promise<Readonly<{ status: number; body: Record<string, unknown> }>>;
  /** Every RPC the production adapter issued, with the database's own answer. */
  observed: () => readonly ObservedRpc[];
  sent: () => readonly SentRpc[];
  clearObserved: () => void;
  telemetry: () => readonly TelemetryEvent[];
}>;

const environment = (): ServerEnvironment =>
  ({
    SUPABASE_URL: API_URL,
    SUPABASE_SECRET_KEY: workerServiceCredential(),
    APP_ENVIRONMENT: 'development',
    APP_RELEASE: 'api-gate',
  }) as unknown as ServerEnvironment;

export const ownerSession = (
  userId: string,
  organizationId: string,
  capabilities: readonly string[],
): ContentSchemaRegistrySession => ({
  userId,
  actingPartyId: organizationId,
  capabilities,
  mfaFresh: false,
});

export const createCmsApp = (session: ContentSchemaRegistrySession): CmsApp => {
  const observed: ObservedRpc[] = [];
  const sent: SentRpc[] = [];
  const events: TelemetryEvent[] = [];
  const spyFetch = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const response = await fetch(input, init);
    const rpc =
      /\/rpc\/([a-z0-9_]+)$/u.exec(
        String(input instanceof Request ? input.url : input),
      )?.[1] ?? '';
    try {
      const body = JSON.parse(String(init?.body)) as {
        p_request?: Record<string, unknown>;
      };
      sent.push({ rpc, members: Object.keys(body.p_request ?? {}).sort() });
    } catch {
      // a body that is not JSON carries no members to record
    }
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
  const production = createProductionContentSchemaRegistryDependencies({
    environment: environment(),
    fetchImpl: spyFetch,
  });
  const dependencies: ContentSchemaRegistryDependencies = {
    ...production,
    humanOrigins: [CMS_TEST_ORIGIN],
    resolveSession: async () => ({ ok: true as const, value: session }),
    rateLimit: async () => ({
      ok: true as const,
      value: {
        allowed: true,
        limit: 1000,
        remaining: 999,
        resetAt: Math.floor(Date.now() / 1000) + 60,
      },
    }),
    telemetry: (event) => {
      events.push(event);
    },
  };
  const app = createContentSchemaRegistryApp(dependencies);
  return {
    send: async (method, path, options = {}) => {
      const headers: Record<string, string> = {
        origin: CMS_TEST_ORIGIN,
        authorization: 'Bearer verified-session',
        'x-request-id': randomUUID(),
      };
      if (method === 'POST') {
        headers['content-type'] = 'application/json';
        headers['idempotency-key'] = options.idempotencyKey ?? randomUUID();
        if (options.ifMatch !== undefined)
          headers['if-match'] = `"${options.ifMatch}"`;
      }
      const response = await app.request(
        new Request(`https://api.example.test${path}`, {
          method,
          headers,
          ...(method === 'POST' ? { body: JSON.stringify(options.body) } : {}),
        }),
      );
      return {
        status: response.status,
        body: (await response.json()) as Record<string, unknown>,
      };
    },
    observed: () => observed,
    sent: () => sent,
    clearObserved: () => {
      observed.length = 0;
      sent.length = 0;
    },
    telemetry: () => events,
  };
};

/** The smallest valid CMS-03A-01 draft: one required short_text field. */
export const draftTypeBody = (typeKey: string): Record<string, unknown> => ({
  typeKey,
  label: `API gate ${typeKey}`,
  ownerCapability: 'cms.schema_designer',
  sourceLocale: 'en-US',
  defaultLocale: 'en-US',
  supportedLocales: ['en-US'],
  fallbackChains: {},
  workflowKey: 'editorial',
  workflowVersion: '1',
  defaultTemplateVersionId: null,
  fields: [
    {
      stableFieldId: randomUUID(),
      key: 'title',
      kind: 'short_text',
      constraints: {},
      required: true,
      validatorKey: null,
      validatorVersion: null,
      defaultMode: 'none',
      localizationMode: 'none',
      editorConfig: { label: 'Title', order: 0 },
      lifecycle: 'active',
    },
  ],
  relations: [],
  templateBindings: [],
  capabilityBindings: [],
});
