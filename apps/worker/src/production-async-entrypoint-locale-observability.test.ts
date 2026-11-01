import { createLogger } from '@wejammin/observability/logging';
import { describe, expect, it, vi } from 'vitest';

import type {
  AsyncExecutionContext,
  AsyncWorkerBindings,
} from './async-entrypoint';
import { createProductionAsyncEntrypoint } from './production-async-entrypoint';

/*
 * [P2-S12-AC-052] [P2-S12-AC-263] [P2-S12-AC-264] the production scheduled tick reads the database-side locale
 * observability window with the service-role RPC and records the counters, the gauge and the alert.
 */

const bindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'local',
  PLATFORM_JOBS: { send: vi.fn() },
  SUPABASE_SECRET_KEY: 'sb_secret_0123456789abcdef',
  SUPABASE_URL: 'https://staging.example.supabase.co',
} as unknown as AsyncWorkerBindings;
const executionContext = { waitUntil: vi.fn() } satisfies AsyncExecutionContext;
const T = Date.UTC(2026, 9, 22, 12, 5, 30);

type Line = Record<string, unknown>;

const harness = (
  localeAnswer: () => unknown,
  claim: () => unknown = () => [],
) => {
  const calls: Array<{ operation: string; body: Record<string, unknown> }> = [];
  const lines: Line[] = [];
  const fetchImpl = vi.fn(async (url: string, init: RequestInit = {}) => {
    const operation = url.split('/rest/v1/rpc/')[1] ?? '';
    calls.push({
      operation,
      body: JSON.parse(String(init.body ?? '{}')) as Record<string, unknown>,
    });
    if (operation === 'cms_locale_observability_read') {
      const answer = localeAnswer();
      if (answer instanceof Error) throw answer;
      return Response.json(answer);
    }
    if (operation === 'claim_outbox_batch') return Response.json(claim());
    if (operation === 'auth_mfa_reconciling_age')
      return Response.json({ count: 0, oldestAgeSeconds: null });
    throw new Error(`unexpected ${operation}`);
  });
  const entrypoint = createProductionAsyncEntrypoint(
    fetchImpl as unknown as typeof fetch,
    undefined,
    undefined,
    {
      logger: createLogger(
        { environment: 'staging', release: 'local', service: 'locale-test' },
        { sink: (line: string) => lines.push(JSON.parse(line) as Line) },
      ),
    },
  );
  return { calls, entrypoint, lines };
};

const tick = (entrypoint: ReturnType<typeof harness>['entrypoint']) =>
  entrypoint.scheduled(
    { cron: '* * * * *', scheduledTime: T },
    bindings,
    executionContext,
  );

const sample = (lines: readonly Line[]) =>
  lines.find((line) => line.eventName === 'cms.locale.observability.sample');

describe('production scheduled locale observability', () => {
  it('reads the window [T - 3 min, T - 2 min) through the service-role RPC on the tick', async () => {
    const { calls, entrypoint } = harness(() => ({
      fanoutRows: 2,
      staleFieldsAppended: 5,
      staleLegalFields: 0,
    }));
    await tick(entrypoint);
    const read = calls.filter(
      (call) => call.operation === 'cms_locale_observability_read',
    );
    expect(read).toHaveLength(1);
    expect(read[0]?.body).toEqual({
      p_window_start: '2026-10-22T12:02:00.000Z',
      p_window_end: '2026-10-22T12:03:00.000Z',
    });
  });

  it('records the two counters and the gauge in one structured line without a locale label', async () => {
    const { entrypoint, lines } = harness(() => ({
      fanoutRows: 2,
      staleFieldsAppended: 5,
      staleLegalFields: 0,
    }));
    await tick(entrypoint);
    expect(sample(lines)).toMatchObject({
      severity: 'INFO',
      outcome: 'success',
      dependency: 'database',
      metrics: {
        cms_locale_fanout_total: 2,
        cms_locale_stale_total: 5,
        cms_locale_stale_legal_fields: 0,
      },
    });
    expect(
      lines.some((line) => line.eventName === 'cms.locale.observability.alert'),
    ).toBe(false);
  });

  it('raises the stale locale legal-field alert at 1', async () => {
    const { entrypoint, lines } = harness(() => ({
      fanoutRows: 0,
      staleFieldsAppended: 0,
      staleLegalFields: 1,
    }));
    await tick(entrypoint);
    expect(
      lines.find((line) => line.eventName === 'cms.locale.observability.alert'),
    ).toMatchObject({
      severity: 'WARN',
      errorCode: 'STALE_LOCALE_LEGAL_FIELDS',
      attributes: { runbook: 'cms-composition' },
    });
  });

  it('swallows a failed read: the tick still succeeds and the sweep still ran', async () => {
    const { calls, entrypoint, lines } = harness(
      () => new Error('database down'),
    );
    await expect(tick(entrypoint)).resolves.toBeUndefined();
    expect(calls.map((call) => call.operation)).toContain('claim_outbox_batch');
    expect(sample(lines)).toMatchObject({
      severity: 'WARN',
      outcome: 'failure',
      errorCode: 'LOCALE_OBSERVABILITY_UNAVAILABLE',
    });
  });

  it('swallows a malformed answer: the failure is counted, no fan-out counter or gauge', async () => {
    const { entrypoint, lines } = harness(() => ({
      fanoutRows: 1,
      staleFieldsAppended: 1,
      staleLegalFields: 1,
      locale: 'fr-FR',
    }));
    await expect(tick(entrypoint)).resolves.toBeUndefined();
    expect(sample(lines)?.metrics).toEqual({
      cms_locale_observability_read_failed_total: 1,
    });
    expect(sample(lines)?.outcome).toBe('failure');
  });
});
