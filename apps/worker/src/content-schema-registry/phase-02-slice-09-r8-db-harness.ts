/**
 * R8 harness: the real Hono app composed with the real production dependency
 * factory, so a request reaches the real RPC adapter. Only the PostgREST
 * transport is faked, and it behaves like the database contract: a refusal is
 * an HTTP 400 `{ code: 'P0001', message: <CODE>, details: <DETAIL> }`, and an
 * idempotency binding is unique on (actor, RPC, key) and compares the request
 * hash (BE00 Idempotency Canonicalization). Nothing in the Worker is told what
 * status or code to answer.
 */
import { vi } from 'vitest';

import {
  CMS_SCHEMA_REGISTRY_RPC,
  createProductionContentSchemaRegistryDependencies,
} from './production';
import {
  createContentSchemaRegistryApp,
  type ContentSchemaRegistryDependencies,
  type ContentSchemaRegistrySession,
  type TelemetryEvent,
} from './index';
import { json, options } from './production-test-support';
import { CMS_ORIGIN, ok } from './phase-02-slice-09-test-values';
import {
  sessionFor,
  type EvidenceOp,
} from './phase-02-slice-09-be03a-evidence-support';

export type RpcCall = Readonly<{
  rpc: string;
  actor: string | null;
  idempotencyKey: string | null;
  request: Readonly<Record<string, unknown>>;
}>;

export type DbAnswer = Response | Promise<Response>;
export type DbBehaviour = (call: RpcCall) => DbAnswer;

/** A PostgREST body for an exception raised by a CMS RPC. */
export const dbRefusal = (
  code: string,
  detail: unknown = null,
  status = 400,
): Response =>
  json(
    {
      code: 'P0001',
      message: code,
      details: detail === null ? null : JSON.stringify(detail),
      hint: null,
    },
    status,
  );

const stable = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stable(entry)}`)
    .join(',')}}`;
};

const withoutContext = (
  request: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> =>
  Object.fromEntries(
    Object.entries(request).filter(([key]) => key !== 'context'),
  );

/**
 * The database idempotency binding: same (actor, RPC, key) and identical
 * request hash replays the committed response; a different hash is
 * IDEMPOTENCY_MISMATCH. A different actor is a different binding.
 */
export const idempotentDb = (
  success: (call: RpcCall) => Response,
): Readonly<{ behaviour: DbBehaviour; commits: () => number }> => {
  const bindings = new Map<
    string,
    Readonly<{ hash: string; status: number; body: string }>
  >();
  let committed = 0;
  const behaviour: DbBehaviour = async (call) => {
    if (call.idempotencyKey === null) return success(call);
    const binding = `${call.actor ?? ''}|${call.rpc}|${call.idempotencyKey}`;
    const hash = stable(withoutContext(call.request));
    const previous = bindings.get(binding);
    if (previous !== undefined)
      return previous.hash === hash
        ? json(JSON.parse(previous.body), previous.status)
        : dbRefusal('IDEMPOTENCY_MISMATCH');
    const response = success(call);
    committed += 1;
    bindings.set(binding, {
      hash,
      status: response.status,
      body: await response.clone().text(),
    });
    return response;
  };
  return { behaviour, commits: () => committed };
};

export type DbBackedHarness = Readonly<{
  app: ReturnType<typeof createContentSchemaRegistryApp>;
  fetchImpl: ReturnType<typeof vi.fn<typeof fetch>>;
  calls: () => readonly RpcCall[];
  telemetry: ReturnType<typeof vi.fn<(event: TelemetryEvent) => void>>;
}>;

export const makeDbBackedHarness = (
  op: EvidenceOp,
  behaviour: DbBehaviour,
  overrides: Readonly<{
    session?: ContentSchemaRegistrySession | ((call: number) => ContentSchemaRegistrySession);
  }> = {},
): DbBackedHarness => {
  const calls: RpcCall[] = [];
  const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => {
    const headers = new Headers(init?.headers);
    const parsed = JSON.parse(String(init?.body)) as {
      p_request: Record<string, unknown>;
    };
    const context = parsed.p_request.context as { authUserId?: string };
    const call: RpcCall = {
      rpc: CMS_SCHEMA_REGISTRY_RPC[op.portName as keyof typeof CMS_SCHEMA_REGISTRY_RPC],
      actor: context.authUserId ?? null,
      idempotencyKey: headers.get('x-idempotency-key'),
      request: parsed.p_request,
    };
    calls.push(call);
    return behaviour(call);
  });
  const production = createProductionContentSchemaRegistryDependencies(
    options(fetchImpl, { humanOrigins: [CMS_ORIGIN] }) as never,
  );
  let sessionCalls = 0;
  const telemetry = vi.fn<(event: TelemetryEvent) => void>();
  const dependencies: ContentSchemaRegistryDependencies = {
    ...production,
    resolveSession: async () => {
      sessionCalls += 1;
      const requested = overrides.session;
      return ok(
        typeof requested === 'function'
          ? requested(sessionCalls)
          : (requested ?? sessionFor(op)),
      );
    },
    rateLimit: async () =>
      ok({ allowed: true, limit: 100, remaining: 99, resetAt: 1_788_345_600 }),
    telemetry,
  };
  return {
    app: createContentSchemaRegistryApp(dependencies),
    fetchImpl,
    calls: () => calls,
    telemetry,
  };
};
