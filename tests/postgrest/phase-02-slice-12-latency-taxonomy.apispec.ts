/**
 * Slice 12 real-stack latency, part 2: the taxonomy routes. Browser request -> production Worker routes -> production RPC
 * adapter -> Kong -> PostgREST -> the newest SQL, over the same bounded worlds as
 * `supabase/tests/phase_02_slice_12_gaps_perf_taxonomy.sql`. Each operation is timed 24 times after 3 discarded warm-ups
 * (p95 over at least twenty samples, `percentile_cont`); every sample must succeed.
 *
 *   CMS-03C-16 save a version with 64 type keys, 64 field keys and 6 domains   Tier 2  p95 < 1,200 ms   P2-S12-AC-127
 *   cmsTaxonomyVersionsRead on a 50-version lineage                            Tier 1  p95 <   750 ms   P2-S12-AC-180
 *   cmsTaxonomyTermsRead, 50-term pages of a 120-term vocabulary               Tier 1  p95 <   750 ms   P2-S12-AC-186, AC-279
 *   CMS-03C-17 selector, limit 100                                             Tier 1  p95 <   750 ms   P2-S12-AC-133
 *
 * The vocabulary is activated through the production governed chain (CMS-03C-06/08/07/09) and its 120 terms are written by the
 * production term action (CMS-03C-03). Commits fixtures; run right after `pnpm db:reset`, and reset again afterwards.
 * Not run by the author of this file.
 */
import { randomUUID } from 'node:crypto';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  type DefinedVersion,
  type LatencyWorld,
  actOnReview,
  approvedReview,
  expectCreated,
  expectOk,
  prepareLatencyWorld,
} from './support/phase-02-slice-12-latency-world';
import {
  type LatencyStack,
  createLatencyStack,
} from './support/phase-02-slice-12-latency-stack';
import {
  type Measurement,
  measure,
} from './support/phase-02-slice-11-latency-stats';
import { psql } from './support/stack';

const RUN = { samples: 24, warmups: 3 } as const;
const TIER_1_P95_MS = 750;
const TIER_2_P95_MS = 1_200;
const TERMS = 120;

let world: LatencyWorld;
let stack: LatencyStack;
let typeKey = '';
let vocabulary = '';
let lineage = '';
let termsCursor: string | null = null;
let selectorCursor: string | null = null;
const measurements: Measurement[] = [];
const record = (measurement: Measurement): Measurement => {
  measurements.push(measurement);
  return measurement;
};
const tag = randomUUID().slice(0, 6);

const keys = (prefix: string, count: number): string[] =>
  Array.from(
    { length: count },
    (_, index) => `${prefix}_${String(index + 1).padStart(2, '0')}`,
  );

const versionBody = (
  taxonomyKey: string,
  expectedVersion: string | null,
): Record<string, unknown> => ({
  taxonomyKey,
  shape: 'flat',
  allowedTypeKeys: [typeKey, ...keys('bench_type', 63)],
  allowedFieldKeys: keys('bench_field', 64),
  canonicalOverlapDomains: [
    'role',
    'instrument',
    'gear',
    'place',
    'rights',
    'jurisdiction',
  ],
  expectedVersion,
});

beforeAll(async () => {
  world = await prepareLatencyWorld();
  stack = createLatencyStack(world.owner);
  typeKey = psql(
    `select type_key from platform_private.cms_content_types where id = '${world.editorial.contentTypeId}'`,
  );
  // The 120-term vocabulary: a flat, active vocabulary whose allowlist names the real type and the field `title`.
  stack.as(world.owner);
  const created = await stack.post('/api/v1/cms/taxonomies/versions', {
    body: {
      taxonomyKey: `lat-vocab-${tag}`,
      shape: 'flat',
      allowedTypeKeys: [typeKey],
      allowedFieldKeys: ['title'],
      canonicalOverlapDomains: [],
      expectedVersion: null,
    },
  });
  expectCreated(created, 'create the vocabulary');
  const subject: DefinedVersion = {
    id: String(created.body.id),
    contentHash: String(created.body.contentHash),
    version: String(created.body.version),
  };
  lineage = String(created.body.taxonomyId);
  vocabulary = subject.id;
  const review = await approvedReview(
    stack,
    world,
    'taxonomy_version',
    subject,
  );
  expectOk(
    await actOnReview(stack, world, review, {
      action: 'activate',
      expectedVersion: review.version,
    }),
    'activate the vocabulary',
  );
  for (let index = 1; index <= TERMS; index += 1) {
    stack.as(world.owner, 'fresh');
    const term = await stack.post(
      `/api/v1/cms/taxonomies/${lineage}/terms/actions`,
      {
        body: {
          taxonomyId: lineage,
          action: 'create',
          termKey: `tb-${String(index).padStart(3, '0')}`,
          parentId: null,
          survivorId: null,
          labels: [
            { locale: 'en-US', label: `Term ${index}` },
            { locale: 'fr-FR', label: `Terme ${index}` },
          ],
          aliases: [],
          expectedVersion: '1',
        },
        ifMatch: '1',
      },
    );
    expectOk(term, `create term ${index}`, 200);
  }
}, 900_000);

describe('Slice 12 taxonomy latency through the real stack', () => {
  it('[CMS-03C-16] saving a version with 64 type keys, 64 field keys and 6 domains: p95 under the Tier 2 target of 1,200 ms [P2-S12-AC-127]', async () => {
    stack.as(world.owner);
    const result = record(
      await measure(
        'taxonomy_create_bound',
        () =>
          stack.post('/api/v1/cms/taxonomies/versions', {
            body: versionBody(
              `lat-tax-${tag}-${randomUUID().slice(0, 8)}`,
              null,
            ),
          }),
        (answer) => expectCreated(answer, 'create a bounded version'),
        RUN,
      ),
    );
    expect(result.p95).toBeLessThan(TIER_2_P95_MS);
  }, 300_000);

  it('[cmsTaxonomyVersionsRead] a lineage of 50 versions: p95 under the Tier 1 target of 750 ms [P2-S12-AC-180]', async () => {
    stack.as(world.owner);
    const key = `lat-lineage-${tag}`;
    const first = await stack.post('/api/v1/cms/taxonomies/versions', {
      body: versionBody(key, null),
    });
    expectCreated(first, 'create the lineage');
    const lineageId = String(first.body.taxonomyId);
    for (let version = 1; version < 50; version += 1)
      expectCreated(
        await stack.post('/api/v1/cms/taxonomies/versions', {
          body: versionBody(key, String(version)),
          ifMatch: String(version),
        }),
        `successor ${version + 1}`,
      );
    const path = `/api/v1/cms/taxonomies/${lineageId}/versions`;
    const page = await stack.get(path);
    expectOk(page, 'versions');
    expect((page.body.items as readonly unknown[]).length).toBe(50);
    const result = record(
      await measure(
        'taxonomy_versions_read',
        () => stack.get(path),
        (answer) => expectOk(answer, 'versions'),
        RUN,
      ),
    );
    expect(result.p95).toBeLessThan(TIER_1_P95_MS);
  }, 600_000);

  it('[cmsTaxonomyTermsRead] first page of 50 terms: p95 under the Tier 1 target of 750 ms [P2-S12-AC-186]', async () => {
    stack.as(world.owner);
    const path = `/api/v1/cms/taxonomies/${lineage}/terms?limit=50`;
    const first = await stack.get(path);
    expectOk(first, 'terms');
    expect((first.body.items as readonly unknown[]).length).toBe(50);
    termsCursor = first.body.nextCursor as string | null;
    expect(typeof termsCursor).toBe('string');
    const result = record(
      await measure(
        'taxonomy_terms_page1',
        () => stack.get(path),
        (answer) => expectOk(answer, 'terms'),
        RUN,
      ),
    );
    expect(result.p95).toBeLessThan(TIER_1_P95_MS);
  }, 300_000);

  it('[cmsTaxonomyTermsRead] cursor page of 50 terms: p95 under the Tier 1 target of 750 ms [P2-S12-AC-186]', async () => {
    stack.as(world.owner);
    expect(termsCursor, 'the first page returned a cursor').not.toBeNull();
    const path = `/api/v1/cms/taxonomies/${lineage}/terms?limit=50&cursor=${encodeURIComponent(termsCursor ?? '')}`;
    const first = await stack.get(path);
    expectOk(first, 'terms cursor page');
    expect((first.body.items as readonly unknown[]).length).toBe(50);
    const result = record(
      await measure(
        'taxonomy_terms_cursor',
        () => stack.get(path),
        (answer) => expectOk(answer, 'terms cursor page'),
        RUN,
      ),
    );
    expect(result.p95).toBeLessThan(TIER_1_P95_MS);
  }, 300_000);

  it('[CMS-03C-17] the selector at the maximum limit of 100: p95 under the Tier 1 target of 750 ms [P2-S12-AC-133]', async () => {
    stack.as(world.owner);
    const path = `/api/v1/cms/taxonomies/selector?typeKey=${encodeURIComponent(typeKey)}&fieldKey=title&locale=en-US&limit=100`;
    const first = await stack.get(path);
    expectOk(first, 'selector');
    expect((first.body.items as readonly unknown[]).length).toBe(100);
    selectorCursor = first.body.nextCursor as string | null;
    expect(typeof selectorCursor).toBe('string');
    const result = record(
      await measure(
        'taxonomy_selector_page1',
        () => stack.get(path),
        (answer) => expectOk(answer, 'selector'),
        RUN,
      ),
    );
    expect(result.p95).toBeLessThan(TIER_1_P95_MS);
  }, 300_000);

  it('[CMS-03C-17] the selector cursor page: p95 under the Tier 1 target of 750 ms [P2-S12-AC-133]', async () => {
    stack.as(world.owner);
    expect(selectorCursor, 'the first page returned a cursor').not.toBeNull();
    const path = `/api/v1/cms/taxonomies/selector?typeKey=${encodeURIComponent(typeKey)}&fieldKey=title&locale=en-US&limit=100&cursor=${encodeURIComponent(selectorCursor ?? '')}`;
    expectOk(await stack.get(path), 'selector cursor page');
    const result = record(
      await measure(
        'taxonomy_selector_cursor',
        () => stack.get(path),
        (answer) => expectOk(answer, 'selector cursor page'),
        RUN,
      ),
    );
    expect(result.p95).toBeLessThan(TIER_1_P95_MS);
  }, 300_000);

  it('every request of every measured operation, warm-ups included, completed within its exact deadline [P2-S12-AC-127]', () => {
    expect(vocabulary).not.toBe('');
    expect(measurements.map((entry) => entry.op).sort()).toEqual(
      [
        'taxonomy_create_bound',
        'taxonomy_selector_cursor',
        'taxonomy_selector_page1',
        'taxonomy_terms_cursor',
        'taxonomy_terms_page1',
        'taxonomy_versions_read',
      ].sort(),
    );
    for (const entry of measurements) {
      expect(
        entry.samples.length,
        `${entry.op} samples`,
      ).toBeGreaterThanOrEqual(20);
      const deadline = entry.op === 'taxonomy_create_bound' ? 15_000 : 8_000;
      for (const elapsed of [...entry.warmups, ...entry.samples])
        expect(elapsed, entry.op).toBeLessThan(deadline);
    }
  });
});
