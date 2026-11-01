/**
 * Slice 12 real-stack latency, part 1b: the template routes at the 64-slot bound. Browser request -> production Worker routes
 * -> production RPC adapter -> Kong -> PostgREST -> the newest SQL, over the same bounded world as
 * `supabase/tests/phase_02_slice_12_gaps_perf_templates.sql`. Each operation is timed 24 times after 3 discarded warm-ups
 * (p95 over at least twenty samples, `percentile_cont`); every sample must succeed.
 *
 *   CMS-03C-01 define a 64-slot template      Tier 2  p95 < 1,200 ms   P2-S12-AC-279
 *   cmsTemplateContextRead                    Tier 2  p95 < 1,200 ms   P2-S12-AC-162
 *   cmsTemplateLatestRead of a 64-slot one    Tier 2  p95 < 1,200 ms   P2-S12-AC-168
 *
 * Commits fixtures; run right after `pnpm db:reset`, and reset again afterwards. Not run by the author of this file.
 */
import { randomUUID } from 'node:crypto';

import {
  TemplateDesignerContextSchema,
  TemplateVersionDetailSchema,
} from '@wejammin/contracts';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  type Measurement,
  measure,
} from './support/phase-02-slice-11-latency-stats';
import {
  type LatencyStack,
  createLatencyStack,
} from './support/phase-02-slice-12-latency-stack';
import {
  type LatencyWorld,
  expectCreated,
  expectOk,
  prepareLatencyWorld,
  templateBody,
} from './support/phase-02-slice-12-latency-world';

const RUN = { samples: 24, warmups: 3 } as const;
const TIER_2_P95_MS = 1_200;

let world: LatencyWorld;
let stack: LatencyStack;
const measurements: Measurement[] = [];
const record = (measurement: Measurement): Measurement => {
  measurements.push(measurement);
  return measurement;
};
const tag = randomUUID().slice(0, 6);

beforeAll(async () => {
  world = await prepareLatencyWorld();
  stack = createLatencyStack(world.owner);
}, 600_000);

describe('Slice 12 template latency through the real stack', () => {
  it('[CMS-03C-01] defining a template with the 64-slot bound: p95 under the Tier 2 target of 1,200 ms [P2-S12-AC-279]', async () => {
    stack.as(world.owner);
    const result = record(
      await measure(
        'template_define_64',
        () =>
          stack.post('/api/v1/cms/templates/versions', {
            body: templateBody(
              world,
              `lat64-${tag}-${randomUUID().slice(0, 8)}`,
              64,
            ),
          }),
        (answer) => expectCreated(answer, 'define 64 slots'),
        RUN,
      ),
    );
    expect(result.p95).toBeLessThan(TIER_2_P95_MS);
  }, 300_000);

  it('[cmsTemplateContextRead] the designer context: p95 under the Tier 2 target of 1,200 ms [P2-S12-AC-162]', async () => {
    stack.as(world.owner);
    const first = await stack.get('/api/v1/cms/templates/context');
    expectOk(first, 'context');
    TemplateDesignerContextSchema.parse(first.body);
    const result = record(
      await measure(
        'template_context',
        () => stack.get('/api/v1/cms/templates/context'),
        (answer) => expectOk(answer, 'context'),
        RUN,
      ),
    );
    expect(result.p95).toBeLessThan(TIER_2_P95_MS);
  }, 300_000);

  it('[cmsTemplateLatestRead] the latest version of a 64-slot template: p95 under the Tier 2 target of 1,200 ms [P2-S12-AC-168]', async () => {
    stack.as(world.owner);
    const key = `lat64-read-${tag}`;
    const defined = await stack.post('/api/v1/cms/templates/versions', {
      body: templateBody(world, key, 64),
    });
    expectCreated(defined, 'define the read template');
    const first = await stack.get(`/api/v1/cms/templates/${key}`);
    expectOk(first, 'latest');
    expect(TemplateVersionDetailSchema.parse(first.body).slots).toHaveLength(
      64,
    );
    const result = record(
      await measure(
        'template_latest_64',
        () => stack.get(`/api/v1/cms/templates/${key}`),
        (answer) => expectOk(answer, 'latest'),
        RUN,
      ),
    );
    expect(result.p95).toBeLessThan(TIER_2_P95_MS);
  }, 300_000);
});

describe('deadlines', () => {
  it('every request of every measured operation, warm-ups included, completed within its exact deadline [P2-S12-AC-279]', () => {
    expect(measurements).toHaveLength(3);
    for (const entry of measurements) {
      expect(
        entry.samples.length,
        `${entry.op} samples`,
      ).toBeGreaterThanOrEqual(20);
      const deadline = entry.op === 'template_define_64' ? 15_000 : 8_000;
      for (const elapsed of [...entry.warmups, ...entry.samples])
        expect(elapsed, entry.op).toBeLessThan(deadline);
    }
  });
});
