/**
 * The pattern half of the Slice 12 latency worlds: forests of the registered latency block, pattern definition and activation
 * through the production routes (CMS-03C-12, then the governed chain CMS-03C-06/08/07/09), and draft entries for placements.
 * Mirrors `supabase/tests/phase_02_slice_12_gaps_perf_patterns/` (the database benches) over HTTP.
 */
import { createEditorialStack } from './cms-editorial-stack';
import { createEntryBody } from './cms-editorial-world';
import {
  LATENCY_BLOCK_KEY,
  LATENCY_BLOCK_VERSION,
} from './phase-02-slice-12-latency-blocks';
import type { LatencyStack } from './phase-02-slice-12-latency-stack';
import {
  type DefinedVersion,
  type LatencyWorld,
  actOnReview,
  approvedReview,
  expectCreated,
  expectOk,
} from './phase-02-slice-12-latency-world';

export type PatternNodeBody = Record<string, unknown>;

export const block = (
  key: string,
  children: readonly PatternNodeBody[] = [],
  props: Record<string, unknown> = {},
): PatternNodeBody => ({
  kind: 'block',
  key,
  blockKey: LATENCY_BLOCK_KEY,
  blockVersion: LATENCY_BLOCK_VERSION,
  props,
  children,
});

/** 512 nodes: 32 roots, each with 3 children of 4 grandchildren (1 + 3 + 12 = 16 nodes), depth 3. */
export const forest512 = (): PatternNodeBody[] =>
  Array.from({ length: 32 }, (_, root) =>
    block(
      `root${root + 1}`,
      Array.from({ length: 3 }, (_, child) =>
        block(
          `c${child + 1}`,
          Array.from({ length: 4 }, (_, leaf) =>
            block(`g${leaf + 1}`, [], {
              title: `leaf ${root}/${child}/${leaf}`,
            }),
          ),
          { title: `child ${root}/${child}` },
        ),
      ),
      { title: `root ${root}` },
    ),
  );

/** `count` block roots without children. */
export const flatForest = (count: number, title = 'root'): PatternNodeBody[] =>
  Array.from({ length: count }, (_, index) =>
    block(`root${index + 1}`, [], { title: `${title}-${index + 1}` }),
  );

/** One root `wide` with 5 children and 122 grandchildren (g sits under child ((g-1) mod 5)+1): 128 nodes. */
export const wideForest = (tag: string, fill: string): PatternNodeBody[] => [
  block(
    'wide',
    Array.from({ length: 5 }, (_, child) =>
      block(
        `c${child + 1}`,
        Array.from({ length: 122 }, (_, index) => index + 1)
          .filter((leaf) => ((leaf - 1) % 5) + 1 === child + 1)
          .map((leaf) =>
            block(`g${leaf}`, [], {
              title: `${tag}-${leaf}${fill.repeat(200)}`,
            }),
          ),
        { title: `${tag}-c${child + 1}` },
      ),
    ),
    { title: `wide-${tag}` },
  ),
];

export const references = (
  base: Readonly<{ patternId: string; patternVersion: number }>,
  count: number,
): PatternNodeBody[] =>
  Array.from({ length: count }, (_, index) => ({
    kind: 'pattern',
    key: `nested${index + 1}`,
    patternId: base.patternId,
    patternVersion: base.patternVersion,
  }));

export type DefinedPattern = DefinedVersion &
  Readonly<{ patternId: string; patternVersion: number }>;

/** CMS-03C-12. A successor names its parent's `version`. */
export const definePatternRequest = (
  world: LatencyWorld,
  patternKey: string,
  blockTree: readonly PatternNodeBody[],
  parentVersion: string | null = null,
) => ({
  body: {
    patternKey,
    compatibleTypeIds: [world.editorial.contentTypeId],
    blockTree,
    expectedVersion: parentVersion,
  },
  ...(parentVersion === null ? {} : { ifMatch: parentVersion }),
});

export const definePattern = async (
  stack: LatencyStack,
  world: LatencyWorld,
  patternKey: string,
  blockTree: readonly PatternNodeBody[],
  parentVersion: string | null = null,
): Promise<DefinedPattern> => {
  stack.as(world.owner);
  const answer = await stack.post(
    '/api/v1/cms/patterns/versions',
    definePatternRequest(world, patternKey, blockTree, parentVersion),
  );
  expectCreated(answer, `define ${patternKey}`);
  return {
    id: String(answer.body.id),
    contentHash: String(answer.body.contentHash),
    version: String(answer.body.version),
    patternId: String(answer.body.patternId),
    patternVersion: Number(answer.body.patternVersion),
  };
};

/** Submit, assign, approve and activate a defined pattern version through the production routes. */
export const activatePattern = async (
  stack: LatencyStack,
  world: LatencyWorld,
  pattern: DefinedPattern,
): Promise<void> => {
  const review = await approvedReview(stack, world, 'pattern_version', pattern);
  expectOk(
    await actOnReview(stack, world, review, {
      action: 'activate',
      expectedVersion: review.version,
    }),
    'activate the pattern',
  );
};

export const defineActivePattern = async (
  stack: LatencyStack,
  world: LatencyWorld,
  patternKey: string,
  blockTree: readonly PatternNodeBody[],
  parentVersion: string | null = null,
): Promise<DefinedPattern> => {
  const pattern = await definePattern(
    stack,
    world,
    patternKey,
    blockTree,
    parentVersion,
  );
  await activatePattern(stack, world, pattern);
  return pattern;
};

export type DraftEntry = Readonly<{
  entryId: string;
  revisionId: string;
  version: string;
}>;

/** A factory of draft entries (CMS-03B-10) of the world's content type, written by the production editorial chain. */
export const draftEntryFactory = (world: LatencyWorld) => {
  const editorial = createEditorialStack({
    userId: world.owner.authUserId,
    actingPartyId: world.organizationId,
    capabilities: ['cms.author', 'cms.editor'],
    mfaFresh: false,
  });
  return async (title: string): Promise<DraftEntry> => {
    const context = await editorial.authoringContext();
    expectOk(context, 'authoring context');
    const type = (
      context.body.creatableTypes as readonly Record<string, unknown>[]
    ).find(
      (candidate) =>
        candidate.contentTypeVersionId === world.editorial.contentTypeVersionId,
    ) as Record<string, unknown>;
    const created = await editorial.create(
      createEntryBody(world.editorial, title, type),
    );
    expectCreated(created, 'create an entry');
    return {
      entryId: (created.body.entry as { id: string }).id,
      revisionId: (created.body.revision as { id: string }).id,
      version: (created.body.entry as { version: string }).version,
    };
  };
};
