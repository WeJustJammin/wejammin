/** DB-bearing real sweep observer. Raw wire values stay in memory; diagnostics are safe. */
import { createHash } from 'node:crypto';
import { expect } from 'vitest';
import {
  ClaimDueSchedulesRequestSchema,
  ClaimDueSchedulesResultSchema,
  ExecuteScheduleRequestSchema,
  ScheduleExecutionResultSchema,
  type ClaimedSchedule,
} from '@wejammin/contracts';
import type { AsyncWorkerBindings } from '../../../apps/worker/src/async-entrypoint';
import { runProductionCmsPublicationScheduleSweep } from '../../../apps/worker/src/cms-publication-schedule-sweep';
import { AccessibilityCheckerInputSchema } from '../../../apps/worker/src/cms-editorial/a11y-structural';
import {
  expectEvidenceNull,
  expectSafeEqual,
} from './phase-02-slice-11-assert';
import { API_URL, workerServiceCredential } from './stack';

export type SweepExchange = Readonly<{
  rpc: string;
  request: Record<string, unknown>;
  response: unknown;
  status: number;
  correlationId: string | null;
  started: number;
  finished: number;
  fault: boolean;
}>;
export type SweepTrace = readonly SweepExchange[];

const CLAIM = 'cms_claim_due_publication_schedules';
const LOAD = 'cms_load_quality_gate_input';
const EXECUTE = 'cms_execute_publication_schedule';
const environment = {
  SUPABASE_URL: API_URL,
  SUPABASE_SECRET_KEY: workerServiceCredential(),
  APP_ENVIRONMENT: 'development',
  APP_RELEASE: 'slice-11-api',
} as unknown as AsyncWorkerBindings;

const object = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('sweep wire object required');
  return value as Record<string, unknown>;
};

const parseWire = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
};

/** No raw Zod issues or wire payloads may escape a failed assertion. */
export const strictValue = <T>(
  schema: {
    safeParse: (
      value: unknown,
    ) => { success: true; data: T } | { success: false };
  },
  value: unknown,
): T => {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error('sweep strict contract failed');
  return result.data;
};

/** Capture all real boundaries. Named load/execute503 faults alone replace transport. */
export const tick = async (
  failLoadFor: readonly string[] = [],
  beforeExecute?: (request: Record<string, unknown>) => Promise<void>,
  failExecuteFor: readonly string[] = [],
): Promise<SweepTrace> => {
  const original = globalThis.fetch;
  const exchanges: SweepExchange[] = [];
  let sequence = 0;
  globalThis.fetch = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const url = String(input instanceof Request ? input.url : input);
    const rpc = /\/rpc\/([a-z0-9_]+)$/u.exec(url)?.[1] ?? '';
    if (![CLAIM, LOAD, EXECUTE].includes(rpc)) return original(input, init);
    const started = ++sequence;
    const request = object(
      object(parseWire(String(init?.body ?? '{}'))).p_request,
    );
    // Named test barrier: actual claim and load already occurred. The caller may
    // run an authorized public workflow or await real lease expiry, never alter operands.
    if (rpc === EXECUTE && beforeExecute !== undefined)
      await beforeExecute(request);
    const fault =
      (rpc === LOAD && failLoadFor.includes(String(request.scheduleId))) ||
      (rpc === EXECUTE && failExecuteFor.includes(String(request.scheduleId)));
    const response = fault
      ? new Response('{"message":"upstream unavailable"}', {
          status: 503,
          headers: { 'content-type': 'application/json' },
        })
      : await original(input, init);
    const body = parseWire(await response.clone().text());
    exchanges.push({
      rpc,
      request,
      response: body,
      status: response.status,
      fault,
      correlationId: new Headers(init?.headers).get('x-correlation-id'),
      started,
      finished: ++sequence,
    });
    return response;
  }) as typeof fetch;
  try {
    await runProductionCmsPublicationScheduleSweep(environment);
  } finally {
    globalThis.fetch = original;
  }
  return exchanges;
};

export const claimsOf = (trace: SweepTrace): readonly ClaimedSchedule[] => {
  const calls = trace.filter((item) => item.rpc === CLAIM);
  expect(calls.length).toBe(1);
  const call = calls[0];
  if (call === undefined) throw new Error('claim exchange missing');
  const request = strictValue(ClaimDueSchedulesRequestSchema, call.request);
  expect(request.batch).toBe(25);
  expect(call.status).toBe(200);
  const claims = strictValue(ClaimDueSchedulesResultSchema, call.response);
  expect(claims.length).toBeLessThanOrEqual(25);
  return claims;
};

export const executionOf = (trace: SweepTrace, scheduleId: string) => {
  const calls = trace.filter(
    (item) => item.rpc === EXECUTE && item.request.scheduleId === scheduleId,
  );
  expect(calls.length).toBe(1);
  const call = calls[0];
  if (call === undefined) throw new Error('execution exchange missing');
  expect(call.status).toBe(200);
  return {
    call,
    request: strictValue(ExecuteScheduleRequestSchema, call.request),
    result: strictValue(ScheduleExecutionResultSchema, call.response),
  };
};

/** Independent JCS oracle: these closed objects contain only ASCII keys and scalar/array values. */
const hash = (value: Readonly<Record<string, unknown>>): string =>
  createHash('sha256')
    .update(
      JSON.stringify(
        Object.fromEntries(
          Object.entries(value).sort(([left], [right]) =>
            left < right ? -1 : left > right ? 1 : 0,
          ),
        ),
      ),
    )
    .digest('hex');

export const expectOperandChain = (trace: SweepTrace): void => {
  const claims = claimsOf(trace);
  expect(trace.filter((item) => item.rpc === EXECUTE).length).toBe(
    claims.length,
  );
  let priorFinished = trace[0]?.finished ?? 0;
  for (const claim of claims) {
    const loads = trace.filter(
      (item) =>
        item.rpc === LOAD && item.request.scheduleId === claim.scheduleId,
    );
    expect(loads.length).toBeGreaterThanOrEqual(1);
    expect(loads.length).toBeLessThanOrEqual(2);
    const execute = executionOf(trace, claim.scheduleId);
    for (const load of loads) {
      expect(load.started).toBeGreaterThan(priorFinished);
      expect(load.finished).toBeLessThan(execute.call.started);
      expectSafeEqual(
        load.request,
        {
          phase: 'execute',
          scheduleId: claim.scheduleId,
          revisionId: claim.revisionId,
          dependencyHash: claim.dependencyHash,
        },
        'quality load uses actual claim operands',
      );
      expectSafeEqual(
        load.correlationId,
        claim.correlationId,
        'load correlation equals claim',
      );
    }
    expectSafeEqual(
      {
        scheduleId: execute.request.scheduleId,
        expectedVersion: execute.request.expectedVersion,
        leaseId: execute.request.leaseId,
      },
      {
        scheduleId: claim.scheduleId,
        expectedVersion: claim.scheduleVersion,
        leaseId: claim.leaseId,
      },
      'execute uses actual claim CAS and lease',
    );
    expectSafeEqual(
      execute.result.scheduleId,
      claim.scheduleId,
      'result names claimed schedule',
    );
    const loaded = loads.find((load) => load.status === 200);
    if (loaded === undefined) {
      expectEvidenceNull(execute.call.request);
      expect(loads.every((load) => load.fault && load.status === 503)).toBe(
        true,
      );
    } else {
      const input = strictValue(
        AccessibilityCheckerInputSchema,
        loaded.response,
      );
      expectSafeEqual(
        input.revisionId,
        claim.revisionId,
        'loaded revision equals claim',
      );
      expectSafeEqual(
        input.dependencyHash,
        claim.dependencyHash,
        'loaded dependency equals claim',
      );
      const evidence = execute.request.evidence;
      if (evidence === null)
        throw new Error('healthy load must produce checker evidence');
      expect(evidence.providerKey).toBe('cms.a11y.structural');
      expect(evidence.providerVersion).toBe('1');
      expect(evidence.bindingHash).toBe(
        hash({
          checkerKey: 'cms.a11y.structural',
          checkerVersion: '1',
          revisionId: input.revisionId,
          revisionContentHash: input.revisionContentHash,
          dependencyHash: input.dependencyHash,
        }),
      );
      expect(evidence.inputHash).toBe(
        hash({
          checkerKey: 'cms.a11y.structural',
          checkerVersion: '1',
          revisionContentHash: input.revisionContentHash,
          blockRecordHashes: input.nodes.flatMap((node) =>
            node.kind === 'block' ? [node.recordHash] : [],
          ),
          accessibilityRows: [],
          renderPlanHash: input.renderPlanHash,
        }),
      );
    }
    priorFinished = execute.call.finished;
  }
  expect(
    trace
      .filter((item) => item.rpc === LOAD)
      .every((load) =>
        claims.some((claim) => load.request.scheduleId === claim.scheduleId),
      ),
  ).toBe(true);
};
