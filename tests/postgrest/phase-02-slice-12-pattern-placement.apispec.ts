/**
 * Slice 12 real composition for CMS-03C-02 (`POST /api/v1/cms/compositions/pattern-instances`), the declared happy path
 * (P2-S12-AC-010): browser request -> production Hono Worker routes -> production RPC adapter -> Kong -> PostgREST -> the
 * newest SQL. The only supplied seams are the verified session and an always-allow rate limiter, so the status, the body,
 * the ETag and every committed row below are what the database decided. The block is registered through the production
 * signed release route and each pattern is taken through the production governed chain, exactly as
 * `phase-02-slice-12-latency-compose.apispec.ts` prepares its own; every entry is a fresh draft entry written by the
 * production CMS-03B-10 chain.
 *
 * BE03c route row 164 (201 PatternPlacementResource, strong entry ETag), `Pattern versions and linked updates`
 * (one append-only row per block root at consecutive positions, entry version + 1, one audit record) and the SQL oracle
 * `phase_02_slice_12_pattern_placement/040-positive.sqlinc`.
 *
 * Commits fixtures: run right after `pnpm db:reset`, and reset again afterwards. Not run by the author of this file.
 */
import { randomUUID } from 'node:crypto';

import { PatternPlacementResourceSchema } from '@wejammin/contracts';
import { beforeAll, describe, expect, it } from 'vitest';

import { registerLatencyBlock } from './support/phase-02-slice-12-latency-blocks';
import {
  type DefinedPattern,
  type DraftEntry,
  defineActivePattern,
  draftEntryFactory,
  flatForest,
  references,
} from './support/phase-02-slice-12-latency-pattern-world';
import {
  type LatencyStack,
  createLatencyStack,
} from './support/phase-02-slice-12-latency-stack';
import {
  type LatencyWorld,
  prepareLatencyWorld,
} from './support/phase-02-slice-12-latency-world';
import { psql } from './support/stack';

const tag = randomUUID().slice(0, 6);
let world: LatencyWorld;
let stack: LatencyStack;
let newEntry: (title: string) => Promise<DraftEntry>;
let base2: DefinedPattern;
let nested: DefinedPattern;

const count = (sql: string): number => Number(psql(sql));

const placementBody = (entry: DraftEntry, pattern: DefinedPattern) => ({
  revisionId: entry.revisionId,
  patternId: pattern.patternId,
  patternVersion: pattern.patternVersion,
  linkMode: 'linked',
  slotPath: '/',
  overrides: {},
  expectedVersion: entry.version,
});

/** What the database stored for the revision: `path:position` in position order. */
const storedRows = (revisionId: string): string =>
  psql(
    `select coalesce(string_agg(path || ':' || position::text, ',' order by position), '')
       from platform_private.cms_composition_instances where revision_id = '${revisionId}'`,
  );
const storedIds = (revisionId: string): string =>
  psql(
    `select coalesce(string_agg(id::text, ',' order by position), '')
       from platform_private.cms_composition_instances where revision_id = '${revisionId}'`,
  );
const entryVersion = (entryId: string): number =>
  count(
    `select version from platform_private.cms_content_entries where id = '${entryId}'`,
  );

beforeAll(async () => {
  world = await prepareLatencyWorld();
  stack = createLatencyStack(world.owner);
  await registerLatencyBlock(world.editorial.owner);
  newEntry = draftEntryFactory(world);
  base2 = await defineActivePattern(
    stack,
    world,
    `hp-base2-${tag}`,
    flatForest(2, 'happy'),
  );
  nested = await defineActivePattern(
    stack,
    world,
    `hp-nested-${tag}`,
    references(base2, 2),
  );
}, 900_000);

describe('CMS-03C-02 pattern placement happy path through the real stack', () => {
  it('[P2-S12-AC-010] an assigned author placing an active compatible pattern on the current draft revision is a 201 { items } of CompositionInstanceResource rows, a strong entry ETag, the committed rows and one audit record', async () => {
    const entry = await newEntry(`happy ${tag}`);
    expect(storedRows(entry.revisionId)).toBe('');
    stack.as(world.owner);
    const response = await stack.post(
      '/api/v1/cms/compositions/pattern-instances',
      { body: placementBody(entry, base2), ifMatch: entry.version },
    );
    expect(response.status, response.text).toBe(201);
    // The closed body: exactly { items }, every row a strict CompositionInstanceResource of one placement.
    expect(Object.keys(response.body)).toEqual(['items']);
    const { items } = PatternPlacementResourceSchema.parse(response.body);
    expect(items.map((row) => row.path)).toEqual(['/root1', '/root2']);
    expect(items.map((row) => row.position)).toEqual([0, 1]);
    for (const row of items)
      expect(row).toMatchObject({
        state: 'active',
        version: '1',
        revisionId: entry.revisionId,
        patternId: base2.patternId,
        patternVersion: base2.patternVersion,
        linkMode: 'linked',
        conflictState: 'none',
      });

    // The entry aggregate advanced by exactly one and its new version is the strong ETag.
    const committedVersion = entryVersion(entry.entryId);
    expect(committedVersion).toBe(Number(entry.version) + 1);
    expect(response.headers.get('etag')).toBe(`"${String(committedVersion)}"`);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-type')).toContain('application/json');

    // The committed rows are the response rows, in position order, and nothing else was written to the revision.
    expect(storedRows(entry.revisionId)).toBe('/root1:0,/root2:1');
    expect(storedIds(entry.revisionId)).toBe(
      items.map((row) => row.id).join(','),
    );
    expect(
      count(
        `select count(*) from platform_private.cms_composition_instances
          where revision_id = '${entry.revisionId}' and pattern_id = '${base2.patternId}'
            and pattern_version = ${String(base2.patternVersion)} and link_mode = 'linked' and state = 'active'`,
      ),
    ).toBe(2);
    // Exactly one audit record names the placement (its first row).
    expect(
      count(
        `select count(*) from audit_private.audit_events
          where action = 'cms.composition.pattern.insert' and target_id = '${items[0]?.id ?? ''}'`,
      ),
    ).toBe(1);
    // The database, not a stub, answered through the named RPC.
    expect(
      stack
        .rpcs()
        .some(
          (call) =>
            call.rpc === 'cms_insert_pattern_instance' && call.status === 200,
        ),
    ).toBe(true);
  }, 120_000);

  it('[P2-S12-AC-010] a nested pattern reference expands into its block roots: the 201 carries one row per expanded root at consecutive positions under the reference key chain', async () => {
    const entry = await newEntry(`nested ${tag}`);
    stack.as(world.owner);
    const response = await stack.post(
      '/api/v1/cms/compositions/pattern-instances',
      { body: placementBody(entry, nested), ifMatch: entry.version },
    );
    expect(response.status, response.text).toBe(201);
    const { items } = PatternPlacementResourceSchema.parse(response.body);
    expect(items.map((row) => row.path)).toEqual([
      '/nested1/root1',
      '/nested1/root2',
      '/nested2/root1',
      '/nested2/root2',
    ]);
    expect(items.map((row) => row.position)).toEqual([0, 1, 2, 3]);
    // Every row stays pinned to the placed pattern, never to the nested one.
    for (const row of items)
      expect(row).toMatchObject({
        patternId: nested.patternId,
        patternVersion: nested.patternVersion,
      });
    expect(storedRows(entry.revisionId)).toBe(
      '/nested1/root1:0,/nested1/root2:1,/nested2/root1:2,/nested2/root2:3',
    );
    expect(response.headers.get('etag')).toBe(
      `"${String(entryVersion(entry.entryId))}"`,
    );
  }, 120_000);
});
