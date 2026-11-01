/**
 * Slice 12 real-stack latency, part 5: pattern placement, linked update and update diff at their bounds. Browser request ->
 * production Worker routes -> production RPC adapter -> Kong -> PostgREST -> the newest SQL, over the same bounded world as
 * `supabase/tests/phase_02_slice_12_gaps_perf_patterns.sql`. Each operation is timed 24 times after 3 discarded warm-ups
 * (p95 over at least twenty samples, `percentile_cont`); every sample must succeed. Every entry is a fresh draft entry written
 * by the production CMS-03B-10 chain, because a placement occupies its row paths.
 *
 *   CMS-03C-02 placement of 512 rows (32 references x 16 roots) and of 32 rows   Tier 2  p95 < 1,200 ms   P2-S12-AC-279
 *   CMS-03C-15 accept and detach of 32 instances per request                     Tier 2  p95 < 1,200 ms   P2-S12-AC-121
 *   CMS-03C-14 update diff at the bound of 128 changed paths                     Tier 1  p95 <   750 ms   P2-S12-AC-115
 *
 * Commits fixtures; run right after `pnpm db:reset`, and reset again afterwards. Not run by the author of this file.
 */
import { randomUUID } from 'node:crypto';

import {
  CompositionUpdateDiffResourceSchema,
  CompositionUpdateResourceSchema,
  PatternPlacementResourceSchema,
} from '@wejammin/contracts';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  type Measurement,
  measure,
} from './support/phase-02-slice-11-latency-stats';
import { registerLatencyBlock } from './support/phase-02-slice-12-latency-blocks';
import {
  type DefinedPattern,
  type DraftEntry,
  defineActivePattern,
  draftEntryFactory,
  flatForest,
  references,
  wideForest,
} from './support/phase-02-slice-12-latency-pattern-world';
import {
  type LatencyStack,
  createLatencyStack,
} from './support/phase-02-slice-12-latency-stack';
import {
  type LatencyWorld,
  expectOk,
  prepareLatencyWorld,
} from './support/phase-02-slice-12-latency-world';
import { psql } from './support/stack';

const RUN = { samples: 24, warmups: 3 } as const;
const COUNT = RUN.samples + RUN.warmups;
const TIER_1_P95_MS = 750;
const TIER_2_P95_MS = 1_200;

type Item = Readonly<{ id: string; path: string; version: string }>;

let world: LatencyWorld;
let stack: LatencyStack;
let nested512: DefinedPattern;
let roots32: DefinedPattern;
let updatable: DefinedPattern;
let wide: DefinedPattern;
let newEntry: (title: string) => Promise<DraftEntry>;
let wideInstanceId = '';
const measurements: Measurement[] = [];
const record = (measurement: Measurement): Measurement => {
  measurements.push(measurement);
  return measurement;
};
const tag = randomUUID().slice(0, 6);

const entryVersion = (entryId: string): string =>
  psql(
    `select version from platform_private.cms_content_entries where id = '${entryId}'`,
  );

const placementBody = (
  entry: DraftEntry,
  pattern: DefinedPattern,
  overrides: Record<string, unknown> = {},
) => ({
  revisionId: entry.revisionId,
  patternId: pattern.patternId,
  patternVersion: pattern.patternVersion,
  linkMode: 'linked',
  slotPath: '/',
  overrides,
  expectedVersion: entry.version,
});

const place = (
  entry: DraftEntry,
  pattern: DefinedPattern,
  overrides: Record<string, unknown> = {},
) =>
  stack.post('/api/v1/cms/compositions/pattern-instances', {
    body: placementBody(entry, pattern, overrides),
    ifMatch: entry.version,
  });

/** Places `pattern` on `count` fresh entries (untimed) and returns each entry with the rows the placement answered. */
const placed = async (
  label: string,
  pattern: DefinedPattern,
  count: number,
): Promise<readonly { entry: DraftEntry; items: readonly Item[] }[]> => {
  const out: { entry: DraftEntry; items: readonly Item[] }[] = [];
  for (let index = 0; index < count; index += 1) {
    const entry = await newEntry(`${label} ${index}`);
    const answer = await place(entry, pattern);
    expectOk(answer, `place ${label}`, 201);
    out.push({
      entry,
      items: PatternPlacementResourceSchema.parse(answer.body).items,
    });
  }
  return out;
};

beforeAll(async () => {
  world = await prepareLatencyWorld();
  stack = createLatencyStack(world.owner);
  await registerLatencyBlock(world.editorial.owner);
  newEntry = draftEntryFactory(world);
  const base16 = await defineActivePattern(
    stack,
    world,
    `gp-base16-${tag}`,
    flatForest(16),
  );
  nested512 = await defineActivePattern(
    stack,
    world,
    `gp-nest-${tag}`,
    references(base16, 32),
  );
  roots32 = await defineActivePattern(
    stack,
    world,
    `gp-p32-${tag}`,
    flatForest(32),
  );
  updatable = await defineActivePattern(
    stack,
    world,
    `gp-u1-${tag}`,
    flatForest(32, 'U1'),
  );
  wide = await defineActivePattern(
    stack,
    world,
    `gp-w1-${tag}`,
    wideForest('n1', 'a'),
  );
}, 1_800_000);

describe('Slice 12 placement latency through the real stack', () => {
  it('[CMS-03C-02] placing 512 rows: p95 under the Tier 2 target of 1,200 ms [P2-S12-AC-279]', async () => {
    const entries: DraftEntry[] = [];
    for (let index = 0; index < COUNT; index += 1)
      entries.push(await newEntry(`place512 ${index}`));
    let at = 0;
    const result = record(
      await measure(
        'place512',
        () => {
          const entry = entries[at] as DraftEntry;
          at += 1;
          return place(entry, nested512);
        },
        (answer) => {
          expectOk(answer, 'place 512 rows', 201);
          expect(answer.body.items).toHaveLength(512);
        },
        RUN,
      ),
    );
    expect(result.p95).toBeLessThan(TIER_2_P95_MS);
  }, 900_000);

  it('[CMS-03C-02] placing 32 rows: p95 under the Tier 2 target of 1,200 ms [P2-S12-AC-279]', async () => {
    const entries: DraftEntry[] = [];
    for (let index = 0; index < COUNT; index += 1)
      entries.push(await newEntry(`place32 ${index}`));
    let at = 0;
    const result = record(
      await measure(
        'place32',
        () => {
          const entry = entries[at] as DraftEntry;
          at += 1;
          return place(entry, roots32);
        },
        (answer) => {
          expectOk(answer, 'place 32 rows', 201);
          expect(answer.body.items).toHaveLength(32);
        },
        RUN,
      ),
    );
    expect(result.p95).toBeLessThan(TIER_2_P95_MS);
  }, 900_000);
});

describe('Slice 12 linked-update latency through the real stack', () => {
  let accept: readonly { entry: DraftEntry; items: readonly Item[] }[] = [];
  let detach: readonly { entry: DraftEntry; items: readonly Item[] }[] = [];

  beforeAll(async () => {
    // every v1 placement happens before v2 is activated: a placement pins the version that is active at that time
    accept = await placed('accept', updatable, COUNT);
    detach = await placed('detach', updatable, COUNT);
    const wideEntry = await newEntry('wide');
    const overrides = Object.fromEntries(
      Array.from({ length: 10 }, (_, index) => index + 1).map((leaf) => [
        `/wide/c${((leaf - 1) % 5) + 1}/g${leaf}`,
        { title: `MINE-${leaf}` },
      ]),
    );
    const wideAnswer = await place(wideEntry, wide, overrides);
    expectOk(wideAnswer, 'place the wide pattern', 201);
    wideInstanceId = String(
      PatternPlacementResourceSchema.parse(wideAnswer.body).items[0]?.id,
    );
    await defineActivePattern(
      stack,
      world,
      `gp-u1-${tag}`,
      flatForest(32, 'U2'),
      '1',
    );
    await defineActivePattern(
      stack,
      world,
      `gp-w1-${tag}`,
      wideForest('n2', 'b'),
      '1',
    );
  }, 1_800_000);

  const requestFor = (
    action: 'accept' | 'detach',
    row: { entry: DraftEntry; items: readonly Item[] },
  ) => {
    const version = entryVersion(row.entry.entryId);
    return {
      body: {
        action,
        ...(action === 'accept' ? { targetPatternVersion: 2 } : {}),
        instances: row.items.map((item) => ({
          instanceId: item.id,
          expectedVersion: item.version,
        })),
        expectedVersion: version,
      },
      ifMatch: version,
    };
  };

  it('[CMS-03C-15] accepting 32 instances in one request: p95 under the Tier 2 target of 1,200 ms [P2-S12-AC-121]', async () => {
    stack.as(world.owner);
    const requests = accept.map((row) => requestFor('accept', row));
    let at = 0;
    const result = record(
      await measure(
        'update32_accept',
        () => {
          const request = requests[at] as (typeof requests)[number];
          at += 1;
          return stack.post(
            '/api/v1/cms/compositions/pattern-updates',
            request,
          );
        },
        (answer) => {
          expectOk(answer, 'accept 32');
          expect(
            CompositionUpdateResourceSchema.parse(answer.body).items,
          ).toHaveLength(32);
        },
        RUN,
      ),
    );
    expect(result.p95).toBeLessThan(TIER_2_P95_MS);
  }, 900_000);

  it('[CMS-03C-15] detaching 32 instances in one request: p95 under the Tier 2 target of 1,200 ms [P2-S12-AC-121]', async () => {
    stack.as(world.owner);
    const requests = detach.map((row) => requestFor('detach', row));
    let at = 0;
    const result = record(
      await measure(
        'update32_detach',
        () => {
          const request = requests[at] as (typeof requests)[number];
          at += 1;
          return stack.post(
            '/api/v1/cms/compositions/pattern-updates',
            request,
          );
        },
        (answer) => {
          expectOk(answer, 'detach 32');
          expect(
            CompositionUpdateResourceSchema.parse(answer.body).items,
          ).toHaveLength(32);
        },
        RUN,
      ),
    );
    expect(result.p95).toBeLessThan(TIER_2_P95_MS);
  }, 900_000);

  it('[CMS-03C-14] the update diff at the bound of 128 changed paths: p95 under the Tier 1 target of 750 ms [P2-S12-AC-115]', async () => {
    stack.as(world.owner);
    const path = `/api/v1/cms/compositions/instances/${wideInstanceId}/update-diff`;
    const first = await stack.get(path);
    expectOk(first, 'update diff');
    expect(
      CompositionUpdateDiffResourceSchema.parse(first.body).paths,
    ).toHaveLength(128);
    expect(new TextEncoder().encode(first.text).length).toBeLessThanOrEqual(
      262_144,
    );
    const result = record(
      await measure(
        'update_diff_128',
        () => stack.get(path),
        (answer) => expectOk(answer, 'update diff'),
        RUN,
      ),
    );
    expect(result.p95).toBeLessThan(TIER_1_P95_MS);
  }, 300_000);
});

describe('deadlines', () => {
  it('every request of every measured operation, warm-ups included, completed within its exact deadline [P2-S12-AC-279]', () => {
    expect(measurements.length).toBeGreaterThanOrEqual(5);
    for (const entry of measurements) {
      expect(
        entry.samples.length,
        `${entry.op} samples`,
      ).toBeGreaterThanOrEqual(20);
      const deadline = entry.op === 'update_diff_128' ? 8_000 : 15_000;
      for (const elapsed of [...entry.warmups, ...entry.samples])
        expect(elapsed, entry.op).toBeLessThan(deadline);
    }
  });
});
