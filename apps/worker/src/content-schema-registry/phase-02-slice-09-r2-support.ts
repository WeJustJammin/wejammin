/**
 * R2 remediation harness: the real Hono app composed with the real production
 * adapters (CMS RPC adapter, CMS limiter, authentication limiter adapter).
 * Only the external PostgREST boundary is faked, by a model that returns
 * exactly the error or decision the database function returns.
 */
import { vi } from 'vitest';

import { createProductionAuthenticationDependencies } from '../authentication/production';
import { createContentSchemaRegistryApp } from './index';
import {
  CMS_SCHEMA_REGISTRY_RPC,
  createProductionContentSchemaRegistryDependencies,
} from './production';
import { environment, json, rpcName } from './production-test-support';
import { CMS_ORIGIN, ok } from './phase-02-slice-09-test-values';
import {
  requestFor,
  sessionFor,
  type EvidenceOp,
} from './phase-02-slice-09-be03a-evidence-support';

export type RpcHandler = (
  rpc: string,
  body: Record<string, unknown>,
  signal: AbortSignal,
) => Response | Promise<Response>;

/**
 * PostgREST renders a raised exception as HTTP 400 with `{ code, message,
 * details, hint }`; `message` is the exception text, `details` the DETAIL.
 */
export const raised = (
  message: string,
  details: string | null = null,
  status = 400,
): Response => json({ code: 'P0001', message, details, hint: null }, status);

export type AuthRateModel = Readonly<{
  handler: RpcHandler;
  calls: Array<{ operation: string; digest: string; windowEnd: number }>;
}>;

/**
 * Model of `platform_api.auth_rate_limit`
 * (supabase/migrations/20261002160000_auth_rate_limit_mfa_operations.sql):
 * a fixed window keyed by (operation id, bucket digest, window start) whose
 * `resetAt` is the epoch second the window ends. Authentication proves it in
 * supabase/tests/authentication_foundation.sql.
 */
export const authRateModel = (nowSeconds: () => number): AuthRateModel => {
  const counts = new Map<string, number>();
  const calls: AuthRateModel['calls'] = [];
  const handler: RpcHandler = (rpc, body) => {
    if (rpc !== 'auth_rate_limit') throw new Error(`unexpected rpc ${rpc}`);
    const limit = Number(body.p_limit);
    const windowSeconds = Number(body.p_window_seconds);
    const windowStart =
      Math.floor(nowSeconds() / windowSeconds) * windowSeconds;
    const key = `${String(body.p_operation_id)}|${String(body.p_bucket_digest)}|${windowStart}`;
    const count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);
    calls.push({
      operation: String(body.p_operation_id),
      digest: String(body.p_bucket_digest),
      windowEnd: windowStart + windowSeconds,
    });
    return json({
      allowed: count <= limit,
      limit,
      remaining: Math.max(0, limit - count),
      resetAt: windowStart + windowSeconds,
    });
  };
  return { handler, calls };
};

export type ComposedOptions = Readonly<{
  /** Answers every CMS RPC; defaults to the operation's success output. */
  cms?: RpcHandler;
  rate?: AuthRateModel;
  nowMs?: () => number;
  userId?: (request: Request) => string | undefined;
  /** Further operations the same session may call (rate keying tests). */
  alsoOps?: readonly EvidenceOp[];
  deadlineMs?: number;
}>;

/**
 * The full Worker stack for one operation. `cms` answers the CMS RPC
 * (anything not `auth_rate_limit`); `rate` answers the shared limiter RPC.
 */
export const composeProduction = (
  op: EvidenceOp,
  options: ComposedOptions = {},
) => {
  const nowMs = options.nowMs ?? (() => 1_788_345_600_000);
  const rate = options.rate ?? authRateModel(() => Math.floor(nowMs() / 1000));
  const ops = [op, ...(options.alsoOps ?? [])];
  const successByRpc = new Map<string, unknown>(
    ops.map((candidate) => [
      CMS_SCHEMA_REGISTRY_RPC[
        candidate.portName as keyof typeof CMS_SCHEMA_REGISTRY_RPC
      ],
      candidate.output,
    ]),
  );
  const rpcCalls: Array<{ rpc: string; body: Record<string, unknown> }> = [];
  const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
    const rpc = rpcName(input as string);
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<
      string,
      unknown
    >;
    rpcCalls.push({ rpc, body });
    const signal = init?.signal ?? new AbortController().signal;
    if (rpc === 'auth_rate_limit') return rate.handler(rpc, body, signal);
    if (options.cms !== undefined) return options.cms(rpc, body, signal);
    if (!successByRpc.has(rpc)) throw new Error(`unexpected rpc ${rpc}`);
    return json(successByRpc.get(rpc));
  });
  const auth = createProductionAuthenticationDependencies({
    environment,
    fetchImpl,
  });
  const capabilities = [
    ...new Set(ops.flatMap((candidate) => sessionFor(candidate).capabilities)),
  ];
  const dependencies = createProductionContentSchemaRegistryDependencies({
    environment,
    fetchImpl,
    auth,
    resolveSession: async (request) => {
      const userId = options.userId?.(request);
      return ok({
        ...sessionFor(op),
        capabilities,
        ...(userId === undefined ? {} : { userId }),
      });
    },
    humanOrigins: [CMS_ORIGIN],
    releaseOrigins: ['https://release.example.test'],
    now: nowMs,
    ...(options.deadlineMs === undefined
      ? {}
      : { deadlineMs: options.deadlineMs }),
  });
  const app = createContentSchemaRegistryApp(dependencies);
  const send = (request: Request = requestFor(op)): Promise<Response> =>
    Promise.resolve(app.request(request));
  return { app, send, fetchImpl, rpcCalls, rate };
};

export type Violation = Readonly<Record<string, unknown>>;

export const bodyOf = async (
  response: Response,
): Promise<{
  code: string;
  message: string;
  requestId: string;
  details: Record<string, unknown>;
}> => (await response.json()) as never;
