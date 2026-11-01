import { describe, expect, it } from 'vitest';

import {
  validSelectorPage,
  validUpdateDiff,
  validUpdateResource,
} from './pattern-update-answers';
import {
  acceptBody,
  acceptResource,
  detachBody,
  detachResource,
  diffResource,
  emptyDiff,
  PU_ENTRY_ETAG,
  PU_INSTANCE_ID,
  PU_TYPE_ID,
  puId,
  resolvedAcceptBody,
  resolvedAcceptResource,
  selectorItem,
  selectorPage,
  updateRow,
} from './pattern-update.test-support';

/**
 * An answer is accepted only when it honours the request that asked for it. Anything else is an invalid dependency
 * answer (a local 502 at the route), never a body shown to the caller.
 */
const query = (limit = 25) => ({ contentTypeId: PU_TYPE_ID, limit });

describe('validSelectorPage (CMS-03C-13)', () => {
  it('accepts a strict page in keyset order within the limit', () => {
    expect(validSelectorPage(selectorPage(2), query())).toBe(true);
    expect(validSelectorPage(selectorPage(0), query())).toBe(true);
  });

  it('accepts several versions of one key in descending version order', () => {
    const items = [
      selectorItem(1, { patternVersion: 5 }),
      selectorItem(1, { patternVersion: 3, patternVersionId: puId(900) }),
      selectorItem(2),
    ];
    expect(validSelectorPage(selectorPage(0, { items }), query())).toBe(true);
  });

  it('accepts a cursor only on a full page', () => {
    expect(
      validSelectorPage(selectorPage(2, { nextCursor: 'abc.def' }), query(2)),
    ).toBe(true);
    expect(
      validSelectorPage(selectorPage(2, { nextCursor: 'abc.def' }), query(3)),
    ).toBe(false);
    expect(
      validSelectorPage(selectorPage(0, { nextCursor: 'abc.def' }), query(1)),
    ).toBe(false);
    expect(
      validSelectorPage(selectorPage(1, { nextCursor: '' }), query(1)),
    ).toBe(false);
  });

  it('refuses a page longer than the requested limit', () => {
    expect(validSelectorPage(selectorPage(3), query(2))).toBe(false);
  });

  it('refuses a repeated version row', () => {
    const first = selectorItem(1);
    const items = [
      first,
      { ...selectorItem(2), patternVersionId: first.patternVersionId },
    ];
    expect(validSelectorPage(selectorPage(0, { items }), query())).toBe(false);
  });

  it.each([
    ['keys out of order', [selectorItem(2), selectorItem(1)]],
    [
      'versions of one key ascending',
      [
        selectorItem(1, { patternVersion: 3 }),
        selectorItem(1, { patternVersion: 5, patternVersionId: puId(901) }),
      ],
    ],
    [
      'the same key and version twice',
      [
        selectorItem(1, { patternVersion: 3 }),
        selectorItem(1, { patternVersion: 3, patternVersionId: puId(902) }),
      ],
    ],
  ])('refuses %s', (_name, items) => {
    expect(validSelectorPage(selectorPage(0, { items }), query())).toBe(false);
  });

  it('refuses a body outside the strict contract', () => {
    expect(
      validSelectorPage({ ...selectorPage(1), extra: true }, query()),
    ).toBe(false);
    expect(validSelectorPage(null, query())).toBe(false);
    expect(
      validSelectorPage(selectorPage(1, { pageVersion: '0' }), query()),
    ).toBe(false);
  });
});

describe('validUpdateDiff (CMS-03C-14)', () => {
  it('accepts the diff and the empty diff of the requested instance', () => {
    expect(validUpdateDiff(diffResource(), PU_INSTANCE_ID)).toBe(true);
    expect(validUpdateDiff(emptyDiff(), PU_INSTANCE_ID)).toBe(true);
  });

  it('compares the instance id case-insensitively', () => {
    expect(validUpdateDiff(diffResource(), PU_INSTANCE_ID.toUpperCase())).toBe(
      true,
    );
  });

  it('refuses the diff of another instance', () => {
    expect(validUpdateDiff(diffResource(), puId(101))).toBe(false);
  });

  it('refuses a body outside the strict contract', () => {
    expect(
      validUpdateDiff(diffResource({ collisionCount: 1 }), PU_INSTANCE_ID),
    ).toBe(false);
    expect(
      validUpdateDiff({ ...diffResource(), extra: 1 }, PU_INSTANCE_ID),
    ).toBe(false);
    expect(validUpdateDiff('diff', PU_INSTANCE_ID)).toBe(false);
  });
});

describe('validUpdateResource (CMS-03C-15)', () => {
  it('accepts an accept and a detach that bind the request', () => {
    expect(
      validUpdateResource(acceptResource(1), PU_ENTRY_ETAG, acceptBody(1)),
    ).toBe(true);
    expect(
      validUpdateResource(acceptResource(3), PU_ENTRY_ETAG, acceptBody(3)),
    ).toBe(true);
    expect(
      validUpdateResource(detachResource(2), PU_ENTRY_ETAG, detachBody(2)),
    ).toBe(true);
  });

  it('accepts a retired row for an accept (the target removed the root)', () => {
    expect(
      validUpdateResource(
        resolvedAcceptResource('theirs'),
        PU_ENTRY_ETAG,
        resolvedAcceptBody('theirs'),
      ),
    ).toBe(true);
  });

  it.each([
    ['missing', null],
    ['weak', 'W/"8"'],
    ['unquoted', '8'],
    ['the request version unchanged', '"7"'],
    ['a later version', '"9"'],
    ['not a string', 8],
  ])('refuses an entry ETag that is %s', (_name, etag) => {
    expect(validUpdateResource(acceptResource(1), etag, acceptBody(1))).toBe(
      false,
    );
  });

  it('refuses a list that is not one row per requested instance', () => {
    expect(
      validUpdateResource(acceptResource(2), PU_ENTRY_ETAG, acceptBody(1)),
    ).toBe(false);
    expect(
      validUpdateResource(acceptResource(1), PU_ENTRY_ETAG, acceptBody(2)),
    ).toBe(false);
  });

  it('refuses a row whose version is not the instance version plus one, in request order', () => {
    const rows = acceptResource(2);
    const swapped = {
      items: [{ ...rows.items[0]!, version: '9' }, rows.items[1]!],
    };
    expect(validUpdateResource(swapped, PU_ENTRY_ETAG, acceptBody(2))).toBe(
      false,
    );
    const body = acceptBody(2);
    const mixed = {
      ...body,
      instances: [
        { ...body.instances[0]!, expectedVersion: '3' },
        { ...body.instances[1]!, expectedVersion: '5' },
      ],
    };
    expect(validUpdateResource(acceptResource(2), PU_ENTRY_ETAG, mixed)).toBe(
      false,
    );
  });

  it('refuses rows from two revisions, repeated ids or repeated paths', () => {
    const two = acceptResource(2);
    expect(
      validUpdateResource(
        { items: [two.items[0]!, { ...two.items[1]!, revisionId: puId(5) }] },
        PU_ENTRY_ETAG,
        acceptBody(2),
      ),
    ).toBe(false);
    expect(
      validUpdateResource(
        { items: [two.items[0]!, { ...two.items[1]!, id: two.items[0]!.id }] },
        PU_ENTRY_ETAG,
        acceptBody(2),
      ),
    ).toBe(false);
    expect(
      validUpdateResource(
        {
          items: [
            two.items[0]!,
            { ...two.items[1]!, path: two.items[0]!.path },
          ],
        },
        PU_ENTRY_ETAG,
        acceptBody(2),
      ),
    ).toBe(false);
  });

  it.each([
    ['not pinned to the target version', { patternVersion: 3 }],
    [
      'detached without any explicit choice',
      { linkMode: 'detached' as const, patternVersion: 1 },
    ],
    ['a draft row', { state: 'draft' as const }],
    ['a pending_diff row', { state: 'pending_diff' as const }],
    ['a superseded row', { state: 'superseded' as const }],
    ['without a pattern', { patternId: null }],
    ['without a pattern version', { patternVersion: null }],
  ])('refuses an accept answered with a row %s', (_name, override) => {
    expect(
      validUpdateResource(
        { items: [updateRow(0, override)] },
        PU_ENTRY_ETAG,
        acceptBody(1),
      ),
    ).toBe(false);
  });

  it.each([
    ['still linked', { linkMode: 'linked' as const }],
    ['retired', { state: 'retired' as const }],
    ['pending_diff', { state: 'pending_diff' as const }],
    ['without a pattern', { patternId: null }],
    ['without a pattern version', { patternVersion: null }],
  ])('refuses a detach answered with a row %s', (_name, override) => {
    expect(
      validUpdateResource(
        { items: [updateRow(0, { linkMode: 'detached', ...override })] },
        PU_ENTRY_ETAG,
        detachBody(1),
      ),
    ).toBe(false);
  });

  it('refuses a body outside the strict contract', () => {
    expect(
      validUpdateResource({ items: [] }, PU_ENTRY_ETAG, acceptBody(1)),
    ).toBe(false);
    expect(
      validUpdateResource(
        { ...acceptResource(1), extra: 1 },
        PU_ENTRY_ETAG,
        acceptBody(1),
      ),
    ).toBe(false);
    expect(validUpdateResource(undefined, PU_ENTRY_ETAG, acceptBody(1))).toBe(
      false,
    );
  });
});
