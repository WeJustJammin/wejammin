import { describe, expect, it } from 'vitest';

import {
  blockNode,
  checkerInput,
  fieldNode,
  heading,
  richText,
  span,
} from './a11y-structural.test-support';
import { accessibilityBindingHash, accessibilityInputHash } from './hashes';

/**
 * Pinned vectors. The digests below were computed independently of the code
 * under test, with `sha256sum` over the hand-written RFC 8785 text, so they
 * pin the member names, their order and the JCS rendering:
 *
 *   inputHash   {"accessibilityRows":[],"blockRecordHashes":["b..b","d..d"],
 *                "checkerKey":"cms.a11y.structural","checkerVersion":"1",
 *                "renderPlanHash":"c..c","revisionContentHash":"a..a"}
 *   bindingHash {"checkerKey":"cms.a11y.structural","checkerVersion":"1",
 *                "dependencyHash":"e..e","revisionContentHash":"a..a",
 *                "revisionId":"11111111-1111-4111-8111-111111111111"}
 *
 * The binding vector is the one PostgreSQL `cms_accessibility_binding_hash`
 * must reproduce.
 */
const A = 'a'.repeat(64);
const B = 'b'.repeat(64);
const C = 'c'.repeat(64);
const D = 'd'.repeat(64);
const E = 'e'.repeat(64);

const INPUT_HASH_TWO_BLOCKS =
  'e881c996fa6172919528521c10783448d7dd6972a7bf5ecfc3d7757338cd0b52';
const INPUT_HASH_NO_BLOCKS =
  '98ebefa613147b2b626d564daf0396084534496007c9a45510cf8db0c9060f14';
const BINDING_HASH =
  '1199f04e59a554a54cd0ffc893eebeba79f75a4833882ea4d5ff027ce2171289';
const REVISION_ID = '11111111-1111-4111-8111-111111111111';

const withBlocks = (hashes: readonly string[], rest = {}) =>
  checkerInput(
    [
      fieldNode(1, richText(heading(2, span('Title')))),
      ...hashes.map((recordHash, index) => blockNode(index, { recordHash })),
    ],
    { revisionContentHash: A, renderPlanHash: C, ...rest },
  );

describe('accessibilityInputHash', () => {
  it('matches the pinned vector for two blocks, ignoring field nodes', async () => {
    expect(await accessibilityInputHash(withBlocks([B, D]))).toBe(
      INPUT_HASH_TWO_BLOCKS,
    );
  });

  it('matches the pinned vector for a revision without blocks', async () => {
    expect(
      await accessibilityInputHash(
        checkerInput([], { revisionContentHash: A, renderPlanHash: C }),
      ),
    ).toBe(INPUT_HASH_NO_BLOCKS);
  });

  it('is a lowercase SHA-256 hex digest and identical for identical inputs', async () => {
    const first = await accessibilityInputHash(withBlocks([B, D]));
    expect(first).toMatch(/^[a-f0-9]{64}$/u);
    expect(await accessibilityInputHash(withBlocks([B, D]))).toBe(first);
  });

  it.each([
    ['the revision content hash', { revisionContentHash: E }, [B, D]],
    ['the render plan hash', { renderPlanHash: E }, [B, D]],
    ['a block record hash', {}, [B, E]],
    ['the block order', {}, [D, B]],
    ['the number of blocks', {}, [B, D, D]],
  ])('changes with %s', async (_name, overrides, hashes) => {
    expect(
      await accessibilityInputHash(withBlocks(hashes, overrides)),
    ).not.toBe(INPUT_HASH_TWO_BLOCKS);
  });

  it('does not depend on members outside the BE05c definition', async () => {
    const base = withBlocks([B, D]);
    const variants = [
      { ...base, revisionId: '22222222-2222-4222-8222-222222222222' },
      { ...base, revisionNumber: '99' },
      { ...base, dependencyHash: E },
      { ...base, locale: 'de' },
      {
        ...base,
        nodes: base.nodes.map((node) =>
          node.kind === 'field'
            ? fieldNode(9, richText(heading(3, span('Other'))))
            : { ...node, accessibleName: 'Named', pointer: '/other/0' },
        ),
      },
    ];
    for (const variant of variants)
      expect(await accessibilityInputHash(variant)).toBe(INPUT_HASH_TWO_BLOCKS);
  });
});

describe('accessibilityBindingHash', () => {
  const binding = {
    revisionId: REVISION_ID,
    revisionContentHash: A,
    dependencyHash: E,
  };

  it('matches the pinned vector PostgreSQL cms_accessibility_binding_hash must reproduce', async () => {
    expect(await accessibilityBindingHash(binding)).toBe(BINDING_HASH);
  });

  it.each([
    ['the revision id', { revisionId: '22222222-2222-4222-8222-222222222222' }],
    ['the revision content hash', { revisionContentHash: B }],
    ['the dependency hash', { dependencyHash: B }],
  ])('changes with %s', async (_name, change) => {
    expect(await accessibilityBindingHash({ ...binding, ...change })).not.toBe(
      BINDING_HASH,
    );
  });

  it('is a function of exactly those three members', async () => {
    const extra = { ...binding, renderPlanHash: D, locale: 'de' };
    expect(await accessibilityBindingHash(extra)).toBe(BINDING_HASH);
  });
});
