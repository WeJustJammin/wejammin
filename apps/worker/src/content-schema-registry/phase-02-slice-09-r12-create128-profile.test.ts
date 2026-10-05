import { describe, expect, it, vi } from 'vitest';

import { ContentTypeDraftRequestSchema } from '@wejammin/contracts';

import type { WorkerBindings } from '../index';
import {
  createContentSchemaRegistryApp,
  createProductionContentSchemaRegistryDependencies,
} from './index';
import {
  CMS_ORIGIN,
  REQUEST_ID,
  ok,
  resource,
  session,
  validDraft,
  validField,
} from './phase-02-slice-09-test-values';

/**
 * AC217 worker-level profile of the 128-field create (CMS-03A-01).
 * Measurement only for the Worker's own cost: the protected-RPC p95 under 300 ms
 * is measured in the database (supabase/tests/phase_02_slice_09_evidence_bench128.sql)
 * and has no headroom there (about 299 ms). The Tier 2 command budget of
 * 1,200 ms covers Worker + RPC, so this proves the Worker adds a small fraction
 * and reports the measured stages.
 */
const env: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'create128-profile',
  SUPABASE_SECRET_KEY: 'sb_secret_create128_profile',
  SUPABASE_URL: 'https://supabase.example.test',
};
const fieldFor = (index: number) => ({
  stableFieldId: `018f0c45-73fe-4dc2-8c09-${index.toString(16).padStart(12, '0')}`,
  key: `field_${index}`,
  kind: validField.kind,
  constraints: validField.constraints,
  required: validField.required,
  validatorKey: validField.validatorKey,
  validatorVersion: validField.validatorVersion,
  defaultMode: validField.defaultMode,
  localizationMode: validField.localizationMode,
  editorConfig: validField.editorConfig,
  lifecycle: validField.lifecycle,
});
const draft128 = {
  ...validDraft,
  fields: Array.from({ length: 128 }, (_, index) => fieldFor(index)),
};
const percentile = (values: readonly number[], rank: number): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return (
    sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * rank) - 1)] ??
    Number.NaN
  );
};
const summary = (values: readonly number[]) => ({
  p50: percentile(values, 0.5),
  p95: percentile(values, 0.95),
  max: Math.max(...values),
  n: values.length,
});

describe('[P2-S09-AC-217] worker-level cost of the 128-field create', () => {
  it('[P2-S09-AC-217] the Worker (body parse, strict validation, RPC projection, response check) adds far less than the 300 ms RPC budget, with a zero-latency RPC', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify(resource), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const dependencies = createProductionContentSchemaRegistryDependencies({
      environment: env,
      fetchImpl,
      resolveSession: async () => ok(session),
      rateLimit: async () =>
        ok({ allowed: true, limit: 30, remaining: 29, resetAt: 1_788_345_600 }),
      humanOrigins: [CMS_ORIGIN],
      releaseOrigins: ['https://release-worker.example.test'],
    });
    const app = createContentSchemaRegistryApp(dependencies);
    const body = JSON.stringify(draft128);
    const request = () =>
      new Request('https://api.example.test/api/v1/cms/content-types', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: CMS_ORIGIN,
          'idempotency-key': 'cms-create128-key-0001',
          'x-request-id': REQUEST_ID,
        },
        body,
      });
    const stages: Record<'parse' | 'request', number[]> = {
      parse: [],
      request: [],
    };
    for (let sample = 0; sample < 55; sample += 1) {
      const parseStart = performance.now();
      expect(
        ContentTypeDraftRequestSchema.safeParse(JSON.parse(body)).success,
      ).toBe(true);
      const parseMs = performance.now() - parseStart;
      const requestStart = performance.now();
      const response = await app.request(request());
      const requestMs = performance.now() - requestStart;
      expect(response.status).toBe(201);
      if (sample >= 5) {
        stages.parse.push(parseMs);
        stages.request.push(requestMs);
      }
    }
    const measured = {
      bodyBytes: new TextEncoder().encode(body).length,
      parse: summary(stages.parse),
      request: summary(stages.request),
    };
    console.info(`AC217 create128 worker profile ${JSON.stringify(measured)}`);
    // The Worker's own p95 stays below a third of the RPC budget, so an RPC at its
    // 300 ms budget keeps the command far under the 1,200 ms Tier 2 command budget.
    expect(measured.request.p95).toBeLessThan(100);
    expect(measured.parse.p95).toBeLessThan(measured.request.p95);
    expect(measured.request.p95 + 300).toBeLessThan(1_200);
    expect(fetchImpl).toHaveBeenCalled();
  });
});
