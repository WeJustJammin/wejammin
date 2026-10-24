import { AuthoringContextResourceSchema } from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  CONTENT_TYPE_ID,
  CONTENT_TYPE_VERSION_ID,
  selectedType,
} from '../cms-editorial-fields/cms-field-fixtures.test-support';
import {
  ENTRY_ID,
  REVISION_ID as DRAFT_REVISION_ID,
  apiError,
  draftDetail,
} from '../cms-editorial/cms-editorial-editor-fixtures.test-support';
import { compositionPagePath } from './composition-path';
import type { CompositionPageReads } from './composition-page-reads';
import { loadCompositionPage } from './load-composition-page';
import { row, selectorItem, selectorPage } from './composition.test-support';

/*
 * FE03 1072, 1640; P2-S12-AC-269: the protected composition page. The loader verifies the entry draft (CMS-03B-11),
 * the instances of its current draft revision (cmsCompositionInstancesRead, DEC-206: every page, and the page-level
 * 403), the content type of its schema version (CMS-03B-14) and the first page of compatible patterns (CMS-03C-13)
 * before it builds one view, one closed state or a sign-in redirect. `:entryId` is the only URL state.
 */
const PATH = `/app/cms-content-modeling/entries/${ENTRY_ID}/composition`;
const ok = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
const context = (version = CONTENT_TYPE_VERSION_ID) =>
  ok(
    AuthoringContextResourceSchema.parse({
      creatableTypes: [selectedType()],
      selectedType: { ...selectedType(), contentTypeVersionId: version },
      fields: [],
    }),
  );
const detail = async (patch: Record<string, unknown> = {}) => {
  const body = (await draftDetail({
    entryVersion: '4',
    revisionNumber: '2',
    values: {},
  }).json()) as Record<string, unknown>;
  return ok({ ...body, ...patch });
};

/** One page of the instance list read (cmsCompositionInstancesRead, DEC-206) for the draft revision of `detail`. */
const instancesPage = (
  items: readonly unknown[],
  nextCursor: string | null = null,
  revisionId: string | null = DRAFT_REVISION_ID,
) => ({ revisionId, items, nextCursor });
const instanceRow = (n: number, extra: Record<string, unknown> = {}) =>
  row(n, { revisionId: DRAFT_REVISION_ID, ...extra });

/** A full page (50 rows, the page size the loader asks for) from row `start`: a cursor is only ever offered after one. */
const PAGE = 50;
const fullPage = (start: number) =>
  Array.from({ length: PAGE }, (_, index) => instanceRow(start + index));

const run = (
  parts: Partial<CompositionPageReads> = {},
  options: { path?: string; entryId?: string } = {},
) => {
  const reads = {
    draftDetail: vi.fn(async () => detail()),
    instances: vi.fn(async () => ok(instancesPage([]))),
    authoringContext: vi.fn(async () => context()),
    selector: vi.fn(async () =>
      ok(selectorPage([selectorItem('hero-block', 2)])),
    ),
    ...parts,
  } as unknown as CompositionPageReads;
  return {
    reads,
    outcome: loadCompositionPage({
      request: new Request(`https://web.test${options.path ?? PATH}`, {
        headers: { cookie: 'wj_access=a; wj_csrf=csrf-token' },
      }),
      entryId: options.entryId ?? ENTRY_ID,
      reads,
    }),
  };
};

describe('compositionPagePath', () => {
  it('is the entry sub-page for a UUID and null otherwise', () => {
    expect(compositionPagePath(ENTRY_ID)).toBe(PATH);
    expect(compositionPagePath('nope')).toBeNull();
  });
});

describe('loadCompositionPage: the view', () => {
  it('builds the page from the verified draft, its content type and the first selector page', async () => {
    const { outcome, reads } = run();
    const result = await outcome;
    expect(result.kind).toBe('view');
    if (result.kind !== 'view') return;
    expect(result).toMatchObject({
      status: 200,
      title: 'Composition',
      heading: 'Composition',
      description:
        'Insert patterns and resolve pattern updates for the current draft.',
    });
    expect(result.view).toMatchObject({
      entry: {
        entryId: ENTRY_ID,
        version: '4',
        revisionId: DRAFT_REVISION_ID,
        contentTypeId: CONTENT_TYPE_ID,
        editable: true,
      },
      csrfToken: 'csrf-token',
      path: PATH,
    });
    expect(result.view.selector.items.map((item) => item.patternKey)).toEqual([
      'hero-block',
    ]);
    expect(reads.draftDetail).toHaveBeenCalledTimes(1);
    expect(reads.authoringContext).toHaveBeenCalledWith(
      expect.any(Request),
      expect.any(String),
    );
    expect(reads.selector).toHaveBeenCalledWith(
      expect.any(Request),
      CONTENT_TYPE_ID,
    );
  });

  it('marks a revision that is not the editable draft as read-only without hiding the page', async () => {
    const { outcome } = run({
      draftDetail: async () => detail({ state: 'submitted' }),
    });
    const result = await outcome;
    expect(result.kind === 'view' && result.view.entry.editable).toBe(false);
    const held = await run({
      draftDetail: async () => detail({ lifecycle: 'held' }),
    }).outcome;
    expect(held.kind === 'view' && held.view.entry.editable).toBe(false);
  });

  it('lists the existing instances in the render order the read answered, not re-sorted', async () => {
    // Slot ordinal leads the order (main before side) although the side position is lower: the loader keeps the server order.
    const items = [
      instanceRow(1, { path: '/main/a', position: 4 }),
      instanceRow(2, { path: '/main/b', position: 5, state: 'pending_diff' }),
      instanceRow(3, {
        path: '/side/c',
        position: 0,
        linkMode: 'detached',
        conflictState: null,
      }),
    ];
    const { outcome, reads } = run({
      instances: vi.fn(async () => ok(instancesPage(items))),
    });
    const result = await outcome;
    expect(result.kind === 'view' && result.view.instances).toEqual(items);
    expect(reads.instances).toHaveBeenCalledTimes(1);
    expect(reads.instances).toHaveBeenCalledWith(
      expect.any(Request),
      ENTRY_ID,
      null,
      PAGE,
    );
  });

  it('reads every page with the cursor of the page before, in order, and concatenates them', async () => {
    const pages = [
      ok(instancesPage(fullPage(0), 'cursor-1')),
      ok(instancesPage(fullPage(PAGE), 'cursor-2')),
      ok(
        instancesPage([instanceRow(2 * PAGE), instanceRow(2 * PAGE + 1)], null),
      ),
    ];
    const instances = vi.fn<CompositionPageReads['instances']>(
      async () => pages.shift() ?? ok({}),
    );
    const { outcome } = run({ instances });
    const result = await outcome;
    expect(
      result.kind === 'view' && result.view.instances.map((r) => r.id),
    ).toEqual(
      [...Array.from({ length: 2 * PAGE + 2 }, (_, n) => n)].map(
        (n) => instanceRow(n).id,
      ),
    );
    expect(instances.mock.calls.map((call) => call[2])).toEqual([
      null,
      'cursor-1',
      'cursor-2',
    ]);
    expect(instances.mock.calls.map((call) => call[3])).toEqual([
      PAGE,
      PAGE,
      PAGE,
    ]);
  });

  it('keeps the newest row of a path that two pages both listed, in the place of its first listing', async () => {
    const pages = [
      ok(instancesPage(fullPage(0), 'c')),
      ok(
        instancesPage([
          instanceRow(0, { version: '4', state: 'pending_diff' }),
        ]),
      ),
    ];
    const { outcome } = run({
      instances: vi.fn(async () => pages.shift() ?? ok({})),
    });
    const result = await outcome;
    expect(result.kind === 'view' && result.view.instances).toHaveLength(PAGE);
    expect(
      result.kind === 'view' &&
        result.view.instances
          .slice(0, 2)
          .map((r) => [r.path, r.version, r.state]),
    ).toEqual([
      ['/main/row-0', '4', 'pending_diff'],
      ['/main/row-1', '3', 'active'],
    ]);
  });

  it('lists an entry whose draft has no instances as an empty list', async () => {
    const result = await run().outcome;
    expect(result.kind === 'view' && result.view.instances).toEqual([]);
  });

  it('maps a walk that cannot finish to the explicit degraded state and reads nothing more', async () => {
    const { outcome, reads } = run({
      instances: vi.fn(async () => ok(instancesPage(fullPage(0), 'again'))),
    });
    const result = await outcome;
    expect(result.kind === 'notice' && result.notice).toMatchObject({
      status: 503,
      heading: 'Composition list unavailable',
      retryHref: PATH,
    });
    expect(reads.selector).not.toHaveBeenCalled();
  });
});

describe('loadCompositionPage: closed states', () => {
  it.each([
    ['a path that is not a UUID', { entryId: 'nope' }, 400],
    ['a query on the address', { path: `${PATH}?x=1` }, 400],
  ])(
    'answers %s with a 400 before any read',
    async (_name, options, status) => {
      const { outcome, reads } = run({}, options);
      const result = await outcome;
      expect(result.kind === 'notice' && result.notice.status).toBe(status);
      expect(reads.draftDetail).not.toHaveBeenCalled();
    },
  );

  it('redirects a missing session to sign-in with the page as the return target', async () => {
    const result = await run({
      draftDetail: async () => apiError(401, 'UNAUTHENTICATED'),
    }).outcome;
    expect(result).toEqual({
      kind: 'redirect',
      location: `/auth/sign-in?returnTo=${encodeURIComponent(PATH)}`,
    });
  });

  it('answers a concealed or absent entry with the one disclosure-safe 404 and reads nothing more', async () => {
    const { outcome, reads } = run({
      draftDetail: async () => apiError(404, 'ENTRY_NOT_FOUND'),
    });
    const result = await outcome;
    expect(result.kind === 'notice' && result.notice.status).toBe(404);
    expect(reads.instances).not.toHaveBeenCalled();
    expect(reads.authoringContext).not.toHaveBeenCalled();
    expect(reads.selector).not.toHaveBeenCalled();
  });

  it('answers a visible entry the account cannot edit with a page-level 403 from the selector', async () => {
    const result = await run({
      selector: async () => apiError(403, 'COMPOSITION_FORBIDDEN'),
    }).outcome;
    expect(result.kind === 'notice' && result.notice).toMatchObject({
      status: 403,
      message: 'This account cannot edit the composition of this entry.',
    });
  });

  it('answers a visible entry the account cannot edit with the page-level 403 of the instance list read, and reads nothing more', async () => {
    const { outcome, reads } = run({
      instances: vi.fn(async () => apiError(403, 'COMPOSITION_FORBIDDEN')),
    });
    const result = await outcome;
    expect(result.kind === 'notice' && result.notice).toMatchObject({
      status: 403,
      message: 'This account cannot edit the composition of this entry.',
    });
    expect(reads.authoringContext).not.toHaveBeenCalled();
    expect(reads.selector).not.toHaveBeenCalled();
  });

  it('answers a concealed entry of the instance list read with the one disclosure-safe 404', async () => {
    const { outcome, reads } = run({
      instances: vi.fn(async () => apiError(404, 'COMPOSITION_NOT_FOUND')),
    });
    const result = await outcome;
    expect(result.kind === 'notice' && result.notice.status).toBe(404);
    expect(reads.selector).not.toHaveBeenCalled();
  });

  it.each([
    [
      'a list of another revision than the draft',
      { instances: async () => ok(instancesPage([], null, instanceRow(9).id)) },
    ],
    [
      'a list that names no revision for a draft that has one',
      { instances: async () => ok(instancesPage([], null, null)) },
    ],
    [
      'a list body that is not a page',
      { instances: async () => ok({ items: 'x' }) },
    ],
    [
      'a retired row, which the list never offers',
      {
        instances: async () =>
          ok(instancesPage([instanceRow(1, { state: 'retired' })])),
      },
    ],
    [
      'a later page of another revision',
      (() => {
        const pages = [
          ok(instancesPage(fullPage(0), 'c')),
          ok(instancesPage([], null, instanceRow(9).id)),
        ];
        return { instances: async () => pages.shift() ?? ok({}) };
      })(),
    ],
  ])('refuses %s as unverified', async (_name, parts) => {
    const result = await run(parts as Partial<CompositionPageReads>).outcome;
    expect(result.kind === 'notice' && result.notice.status).toBe(502);
  });

  it.each([429, 503])(
    'turns a %s answer of the instance list read into a closed notice with a retry link',
    async (status) => {
      const result = await run({
        instances: vi.fn(async () =>
          apiError(
            status,
            status === 429 ? 'RATE_LIMITED' : 'DEPENDENCY_UNAVAILABLE',
          ),
        ),
      }).outcome;
      expect(result.kind === 'notice' && result.notice.status).toBe(status);
      expect(result.kind === 'notice' && result.notice.retryHref).toBe(PATH);
    },
  );

  it.each([
    [
      'a draft detail that is not the entry asked for',
      { draftDetail: async () => ok({ entry: { id: ENTRY_ID } }) },
    ],
    [
      'a content type context for another version',
      {
        authoringContext: async () =>
          context('018f0c45-73fe-7dc2-9c09-000000000999'),
      },
    ],
    [
      'a selector body that is not a page',
      { selector: async () => ok({ items: 'x' }) },
    ],
  ])('refuses %s as unverified', async (_name, parts) => {
    const result = await run(parts as Partial<CompositionPageReads>).outcome;
    expect(result.kind === 'notice' && result.notice.status).toBe(502);
  });

  it.each([429, 503])(
    'turns a %s dependency answer into a closed notice with a retry link',
    async (status) => {
      const result = await run({
        selector: async () =>
          apiError(
            status,
            status === 429 ? 'RATE_LIMITED' : 'DEPENDENCY_UNAVAILABLE',
          ),
      }).outcome;
      expect(result.kind === 'notice' && result.notice.status).toBe(status);
      expect(result.kind === 'notice' && result.notice.retryHref).toBe(PATH);
    },
  );
});
