/**
 * Slice 12 real-stack latency, part 4: the pattern definition and read routes at the 512-node bound. Browser request ->
 * production Worker routes -> production RPC adapter -> Kong -> PostgREST -> the newest SQL, over the same bounded world as
 * `supabase/tests/phase_02_slice_12_gaps_perf_patterns.sql`. Each operation is timed 24 times after 3 discarded warm-ups
 * (p95 over at least twenty samples, `percentile_cont`); every sample must succeed.
 *
 *   CMS-03C-12 save a 512-node forest (flat, nested references, successor)   Tier 2  p95 < 1,200 ms   P2-S12-AC-103, AC-279
 *   cmsPatternLatestRead of a 512-node version                               Tier 2  p95 < 1,200 ms   P2-S12-AC-174
 *   CMS-03C-13 selector, limit 50 of 65 active versions (first and cursor)   Tier 1  p95 <   750 ms   P2-S12-AC-109
 *
 * The block is registered through the production signed release route; every active pattern is activated through the
 * production governed chain. Commits fixtures; run right after `pnpm db:reset`, and reset again afterwards. Not run by the
 * author of this file.
 */
import { randomUUID } from 'node:crypto';

import {
  PatternSelectorPageSchema,
  PatternVersionDetailSchema,
} from '@wejammin/contracts';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  type Measurement,
  measure,
} from './support/phase-02-slice-11-latency-stats';
import { registerLatencyBlock } from './support/phase-02-slice-12-latency-blocks';
import {
  type DefinedPattern,
  block,
  definePatternRequest,
  defineActivePattern,
  forest512,
  references,
} from './support/phase-02-slice-12-latency-pattern-world';
import {
  type LatencyStack,
  createLatencyStack,
} from './support/phase-02-slice-12-latency-stack';
import {
  type LatencyWorld,
  expectCreated,
  expectOk,
  prepareLatencyWorld,
} from './support/phase-02-slice-12-latency-world';

const RUN = { samples: 24, warmups: 3 } as const;
const COUNT = RUN.samples + RUN.warmups;
const TIER_1_P95_MS = 750;
const TIER_2_P95_MS = 1_200;
const SELECTOR_ACTIVE = 60;

let world: LatencyWorld;
let stack: LatencyStack;
let base16: DefinedPattern;
let selectorCursor: string | null = null;
const flatKeys: string[] = [];
const measurements: Measurement[] = [];
const record = (measurement: Measurement): Measurement => {
  measurements.push(measurement);
  return measurement;
};
const tag = randomUUID().slice(0, 6);

beforeAll(async () => {
  world = await prepareLatencyWorld();
  stack = createLatencyStack(world.owner);
  await registerLatencyBlock(world.editorial.owner);
  // the active 16-root pattern the nested forests reference, and the population the selector pages over
  base16 = await defineActivePattern(stack, world, `gp-base16-${tag}`, [
    ...Array.from({ length: 16 }, (_, index) => block(`root${index + 1}`)),
  ]);
  for (let index = 1; index <= SELECTOR_ACTIVE; index += 1)
    await defineActivePattern(stack, world, `gp-sel-${tag}-${index}`, [
      block('only', [], { title: `selector ${index}` }),
    ]);
}, 1_800_000);

describe('Slice 12 pattern definition latency through the real stack', () => {
  it('[CMS-03C-12] saving a new lineage with a 512-node forest: p95 under the Tier 2 target of 1,200 ms [P2-S12-AC-103] [P2-S12-AC-279]', async () => {
    stack.as(world.owner);
    const result = record(
      await measure(
        'pattern_create_512',
        () => {
          const key = `gp-flat-${tag}-${flatKeys.length}`;
          flatKeys.push(key);
          return stack.post(
            '/api/v1/cms/patterns/versions',
            definePatternRequest(world, key, forest512()),
          );
        },
        (answer) => {
          expectCreated(answer, 'define a 512-node forest');
          expect(answer.body.nodeCount).toBe(512);
        },
        RUN,
      ),
    );
    expect(result.p95).toBeLessThan(TIER_2_P95_MS);
  }, 600_000);

  it('[CMS-03C-12] saving 32 references that expand to 512 nodes: p95 under the Tier 2 target of 1,200 ms [P2-S12-AC-103] [P2-S12-AC-279]', async () => {
    stack.as(world.owner);
    let counter = 0;
    const result = record(
      await measure(
        'pattern_create_nested512',
        () => {
          counter += 1;
          return stack.post(
            '/api/v1/cms/patterns/versions',
            definePatternRequest(
              world,
              `gp-nest-${tag}-${counter}`,
              references(base16, 32),
            ),
          );
        },
        (answer) => {
          expectCreated(answer, 'define nested references');
          expect(answer.body.nodeCount).toBe(512);
        },
        RUN,
      ),
    );
    expect(result.p95).toBeLessThan(TIER_2_P95_MS);
  }, 600_000);

  it('[CMS-03C-12] saving a successor of a 512-node lineage (expectedVersion = the parent): p95 under the Tier 2 target of 1,200 ms [P2-S12-AC-103]', async () => {
    stack.as(world.owner);
    expect(flatKeys.length).toBeGreaterThanOrEqual(COUNT);
    let counter = 0;
    const result = record(
      await measure(
        'pattern_create_successor512',
        () => {
          const key = flatKeys[counter] as string;
          counter += 1;
          return stack.post(
            '/api/v1/cms/patterns/versions',
            definePatternRequest(world, key, forest512(), '1'),
          );
        },
        (answer) => expectCreated(answer, 'define a successor'),
        RUN,
      ),
    );
    expect(result.p95).toBeLessThan(TIER_2_P95_MS);
  }, 600_000);
});

describe('Slice 12 pattern read latency through the real stack', () => {
  it('[cmsPatternLatestRead] the latest version of a 512-node lineage: p95 under the Tier 2 target of 1,200 ms [P2-S12-AC-174]', async () => {
    stack.as(world.owner);
    const path = `/api/v1/cms/patterns/${flatKeys[0]}`;
    const first = await stack.get(path);
    expectOk(first, 'latest');
    expect(PatternVersionDetailSchema.parse(first.body).nodeCount).toBe(512);
    const result = record(
      await measure(
        'pattern_latest_512',
        () => stack.get(path),
        (answer) => expectOk(answer, 'latest'),
        RUN,
      ),
    );
    expect(result.p95).toBeLessThan(TIER_2_P95_MS);
  }, 300_000);

  it('[CMS-03C-13] the selector first page at the maximum limit of 50: p95 under the Tier 1 target of 750 ms [P2-S12-AC-109]', async () => {
    stack.as(world.owner);
    const path = `/api/v1/cms/patterns/selector?contentTypeId=${world.editorial.contentTypeId}&limit=50`;
    const first = await stack.get(path);
    expectOk(first, 'selector');
    const page = PatternSelectorPageSchema.parse(first.body);
    expect(page.items).toHaveLength(50);
    expect(typeof page.nextCursor).toBe('string');
    selectorCursor = page.nextCursor;
    const result = record(
      await measure(
        'pattern_selector_page1',
        () => stack.get(path),
        (answer) => expectOk(answer, 'selector'),
        RUN,
      ),
    );
    expect(result.p95).toBeLessThan(TIER_1_P95_MS);
  }, 300_000);

  it('[CMS-03C-13] the selector cursor page: p95 under the Tier 1 target of 750 ms [P2-S12-AC-109]', async () => {
    stack.as(world.owner);
    expect(selectorCursor, 'the first page returned a cursor').not.toBeNull();
    const path = `/api/v1/cms/patterns/selector?contentTypeId=${world.editorial.contentTypeId}&limit=50&cursor=${encodeURIComponent(selectorCursor ?? '')}`;
    expectOk(await stack.get(path), 'selector cursor page');
    const result = record(
      await measure(
        'pattern_selector_cursor',
        () => stack.get(path),
        (answer) => expectOk(answer, 'selector cursor page'),
        RUN,
      ),
    );
    expect(result.p95).toBeLessThan(TIER_1_P95_MS);
  }, 300_000);

  it('every request of every measured operation, warm-ups included, completed within its exact deadline [P2-S12-AC-103]', () => {
    expect(measurements.length).toBeGreaterThanOrEqual(6);
    for (const entry of measurements) {
      expect(
        entry.samples.length,
        `${entry.op} samples`,
      ).toBeGreaterThanOrEqual(20);
      const deadline = entry.op.startsWith('pattern_create') ? 15_000 : 8_000;
      for (const elapsed of [...entry.warmups, ...entry.samples])
        expect(elapsed, entry.op).toBeLessThan(deadline);
    }
  });
});
