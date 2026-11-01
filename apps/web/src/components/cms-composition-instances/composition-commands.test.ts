import { describe, expect, it, vi } from 'vitest';

import {
  newRootsRequest,
  placementRequest,
  submitPlacement,
  type PlacementFields,
} from './composition-commands';
import {
  PATTERN_ID,
  REVISION_ID,
  entryFacts,
  id,
  row,
  selectorItem,
} from './composition.test-support';
import { diffOf } from './composition.test-support';

/*
 * CMS-03C-02 (place) and CMS-03C-15 (accept or detach) commands from the browser (FE03 1114, 1115; DEC-193). A 2xx is
 * believed only when it is the answer to THIS request: the browser repeats the structural binding the proxy checked.
 */
const as = (fn: unknown) => fn as typeof fetch;
const json = (body: unknown, status: number, etag?: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...(etag ? { etag } : {}) },
  });
const refusal = (
  status: number,
  code: string,
  details: Record<string, unknown> = {},
) =>
  new Response(
    JSON.stringify({
      code,
      message: `${code}: composition operation rejected or unavailable.`,
      requestId: 'r',
      details,
    }),
    { status },
  );
const item = selectorItem('hero-block', 2);
const fields: PlacementFields = {
  item,
  linkMode: 'linked',
  slotPath: '/main',
  overridesText: '{"/hero": {"text": "mine"}}',
};
const ctx = (fetcher: typeof fetch) => ({
  csrfToken: 'csrf',
  idempotencyKey: 'key-0001-0001',
  fetcher,
});

describe('placementRequest: the form as PatternInstanceRequest', () => {
  it('builds the request from the entry, the chosen pattern version and the fields', () => {
    const built = placementRequest(fields, entryFacts());
    expect(built).toEqual({
      ok: true,
      request: {
        revisionId: REVISION_ID,
        patternId: PATTERN_ID,
        patternVersion: 2,
        linkMode: 'linked',
        slotPath: '/main',
        overrides: { '/hero': { text: 'mine' } },
        blockRegistryDigest: 'a'.repeat(64),
        expectedVersion: '9',
      },
    });
  });

  it.each([
    ['a slot path without a leading slash', { slotPath: 'main' }, 'slotPath'],
    ['an empty slot path', { slotPath: '' }, 'slotPath'],
    [
      'a slot path over 512 characters',
      { slotPath: `/${'a'.repeat(512)}` },
      'slotPath',
    ],
    [
      'a slot path with a control character',
      { slotPath: '/a\u0007' },
      'slotPath',
    ],
    ['overrides that are not JSON', { overridesText: '{nope' }, 'overrides'],
    ['overrides that are not an object', { overridesText: '[1]' }, 'overrides'],
    [
      'an override key that is not a node path',
      { overridesText: '{"hero": 1}' },
      'overrides',
    ],
    [
      'more than 64 override keys',
      {
        overridesText: JSON.stringify(
          Object.fromEntries(
            Array.from({ length: 65 }, (_, i) => [`/k${i}`, 1]),
          ),
        ),
      },
      'overrides',
    ],
  ])('refuses %s at its field before any request', (_name, patch, field) => {
    const built = placementRequest({ ...fields, ...patch }, entryFacts());
    expect(built.ok).toBe(false);
    if (!built.ok)
      expect(built.issues.map((issue) => issue.field)).toEqual([field]);
  });

  it('requires a pattern and an explicit link mode', () => {
    const none = placementRequest(
      { ...fields, item: null, linkMode: null },
      entryFacts(),
    );
    expect(none.ok).toBe(false);
    if (!none.ok)
      expect(none.issues.map((issue) => issue.field).sort()).toEqual([
        'linkMode',
        'pattern',
      ]);
  });

  it('treats blank overrides as none and accepts the root slot path', () => {
    const built = placementRequest(
      { ...fields, slotPath: '/', overridesText: '  ' },
      entryFacts(),
    );
    expect(built.ok && built.request.overrides).toEqual({});
  });
});

describe('submitPlacement: a 201 is the answer to this request', () => {
  const request = (() => {
    const built = placementRequest(fields, entryFacts());
    if (!built.ok) throw new Error('fixture');
    return built.request;
  })();
  const placed = (extra = {}) =>
    json(
      {
        items: [
          row(1, {
            path: '/main/hero',
            patternVersion: 2,
            state: 'draft',
            ...extra,
          }),
        ],
      },
      201,
      '"10"',
    );

  it('returns the placed rows and the committed entry version', async () => {
    const fetcher = vi.fn(async () => placed());
    const answer = await submitPlacement(request, ctx(as(fetcher)));
    expect(answer).toMatchObject({ kind: 'placed', version: '10' });
    expect(
      answer.kind === 'placed' && answer.rows.map((entry) => entry.path),
    ).toEqual(['/main/hero']);
    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('/api/v1/cms/compositions/pattern-instances');
    expect((init.headers as Record<string, string>)['if-match']).toBe('"9"');
    expect(JSON.parse(init.body as string)).toEqual(request);
  });

  it.each([
    ['another revision', { revisionId: id(77) }],
    ['another pattern', { patternId: id(78) }],
    ['another pattern version', { patternVersion: 5 }],
    ['another link mode', { linkMode: 'detached' }],
    ['a row outside the slot', { path: '/other/hero' }],
  ])(
    'treats a 201 for %s as an unknown outcome, never a guessed success',
    async (_name, patch) => {
      expect(
        await submitPlacement(request, ctx(as(async () => placed(patch)))),
      ).toEqual({ kind: 'uncertain' });
    },
  );

  it('treats an ETag that is not a newer entry version as an unknown outcome', async () => {
    const same = json(
      { items: [row(1, { path: '/main/hero', patternVersion: 2 })] },
      201,
      '"9"',
    );
    expect(await submitPlacement(request, ctx(as(async () => same)))).toEqual({
      kind: 'uncertain',
    });
  });

  it('keeps typed refusals for the form: reason, field pointers, and the current version of a conflict', async () => {
    expect(
      await submitPlacement(
        request,
        ctx(
          as(async () =>
            refusal(422, 'COMPOSITION_VALIDATION_FAILED', {
              violations: [
                { path: '/slotPath', code: 'invalid', message: 'x' },
              ],
            }),
          ),
        ),
      ),
    ).toMatchObject({ kind: 'refused', status: 422, paths: ['/slotPath'] });
    expect(
      await submitPlacement(
        request,
        ctx(
          as(async () =>
            refusal(409, 'COMPOSITION_VERSION_CONFLICT', {
              reasonCode: 'revision_not_editable',
            }),
          ),
        ),
      ),
    ).toMatchObject({
      kind: 'refused',
      status: 409,
      reason: 'revision_not_editable',
    });
  });
});

describe('newRootsRequest: the Place command of a block new in the version (DEC-193)', () => {
  const diff = diffOf(1, [], {
    slotPath: '/main',
    targetPatternVersion: 3,
    newRoots: [
      { rootPath: '/extra', blockKey: 'profile.header', blockVersion: 1 },
      { rootPath: '/shared/more', blockKey: 'profile.header', blockVersion: 1 },
    ],
  });

  it('sends the instance revision, pattern and link mode, the diff target and slot, the chosen roots and empty overrides', () => {
    const instance = row(1, {
      patternId: id(55),
      linkMode: 'linked',
      revisionId: id(66),
    });
    expect(
      newRootsRequest(
        diff,
        instance,
        ['/extra'],
        entryFacts({ version: '11' }),
      ),
    ).toEqual({
      revisionId: id(66),
      patternId: id(55),
      patternVersion: 3,
      linkMode: 'linked',
      slotPath: '/main',
      overrides: {},
      roots: ['/extra'],
      expectedVersion: '11',
    });
  });

  it('places nothing when no root is chosen or the row names no pattern', () => {
    expect(newRootsRequest(diff, row(1), [], entryFacts())).toBeNull();
    expect(
      newRootsRequest(
        diff,
        row(1, { patternId: null }),
        ['/extra'],
        entryFacts(),
      ),
    ).toBeNull();
  });

  it('is verified against the named roots: exactly those paths come back', async () => {
    const request = newRootsRequest(
      diff,
      row(1),
      ['/extra', '/shared/more'],
      entryFacts(),
    );
    if (request === null) throw new Error('fixture');
    const rows = [
      row(7, {
        path: '/main/extra',
        patternVersion: 3,
        state: 'draft',
        position: 4,
      }),
      row(8, {
        path: '/main/shared/more',
        patternVersion: 3,
        state: 'draft',
        position: 5,
      }),
    ];
    const good = await submitPlacement(
      request,
      ctx(as(async () => json({ items: rows }, 201, '"10"'))),
    );
    expect(good).toMatchObject({ kind: 'placed' });
    const missing = await submitPlacement(
      request,
      ctx(as(async () => json({ items: [rows[0]] }, 201, '"10"'))),
    );
    expect(missing).toEqual({ kind: 'uncertain' });
  });
});
