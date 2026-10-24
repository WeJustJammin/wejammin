import { describe, expect, it } from 'vitest';

import {
  CMS_UPDATE_DIFF_MAX_BYTES,
  CMS_UPDATE_MAX_CHOICES,
  CMS_UPDATE_MAX_INSTANCES,
  CompositionUpdateApiRequestSchema as api,
  CompositionUpdateDiffResourceSchema as diffRes,
  CompositionUpdateHeadersSchema as headers,
  CompositionUpdateRequestSchema as update,
  PatternInstanceRequestSchema as instReq,
  PatternPlacementOverridesSchema as overrides,
  PatternUpdateChoiceSchema as choice,
} from '@wejammin/contracts';
import {
  isRefused,
  issueMessages,
  issuePaths,
  uid,
  without,
} from './composition-fixtures.test-support';

/*
 * DEC-193 contract migration (Slice 12): the executable form of the
 * owner-approved BE03c cascade of 2026-10-15. Every case imports only what
 * the package exports today, so it fails on the behavior it asserts and never
 * on a missing module; the public address type is not imported and its bounds
 * are asserted through its carriers.
 */

type Schema = Parameters<typeof issuePaths>[0];

/** True when an issue is reported at `prefix` or a member beneath it. */
const under = (paths: string[], prefix: string): boolean =>
  paths.some((p) => p === prefix || p.startsWith(`${prefix}.`));

/** True when `schema` reports an issue at `prefix` or beneath it. */
const hits = (schema: Schema, candidate: unknown, prefix: string): boolean =>
  under(issuePaths(schema, candidate), prefix);

/** `count` grammar-valid key segments of `length` characters, joined. */
const segs = (count: number, length: number): string =>
  `/${Array.from({ length: count }, () => 'a'.repeat(length)).join('/')}`;

/** DEC-193 public address bound: 72 segments of 64 = 4680 ASCII. */
const MAX_ADDRESS = segs(72, 64);
/** 73 short segments: grammar-valid, over the 72-segment address bound. */
const TOO_MANY = segs(73, 1);
/** Nine 64-character segments (585 chars): over the 512-char row path. */
const OVER_STORED = segs(9, 64);

const INSTANCE = {
  id: uid(110),
  version: '2',
  revisionId: uid(111),
  path: '/header/0/hero',
  state: 'draft',
  linkMode: 'linked',
  pinnedPatternVersion: 2,
};

/** A DEC-193 diff node value: identity, props and ordered children. */
const val = (props: unknown = {}, children: string[] = []) => ({
  blockKey: 'a.b',
  blockVersion: 1,
  props,
  children,
});

/** `count` distinct grammar-valid addresses (`/n0`..). */
const addrs = (count: number): string[] =>
  Array.from({ length: count }, (_, index) => `/n${index}`);

/** A target block root: the address plus the block identity. */
const root = (p: string) => ({ rootPath: p, blockKey: 'a.b', blockVersion: 1 });

const dp = (
  path: string,
  base: unknown,
  theirs: unknown,
  yours: unknown,
  collision: boolean,
  collisionKind: string | null,
) => ({ path, base, theirs, yours, collision, collisionKind });

/** A non-colliding path; `path` defaults to `/hero` for single-path cases. */
const plain = (base: unknown, theirs: unknown, path = '/hero') =>
  dp(path, base, theirs, null, false, null);

const STRUCT = 'structure',
  PROPS = 'props',
  REMOVED = 'removed_root';

const PLAIN = plain(val({ t: 1 }), val({ t: 2 }), '/hero/plain');

const DIFF = {
  instance: INSTANCE,
  slotPath: '/header/0',
  targetPatternVersion: 3,
  paths: [
    dp('/hero', val({ t: 1 }), val({ t: 2 }, ['/c']), null, true, STRUCT),
    dp('/hero/cta', val({ l: 1 }), val({ l: 2 }), { l: 3 }, true, PROPS),
    dp('/hero/x', val(), null, null, true, REMOVED),
    PLAIN,
  ],
  newRoots: [root('/shared/a')],
  collisionCount: 3,
  bulkEligible: false,
};

const BASE = {
  revisionId: uid(120),
  patternId: uid(121),
  patternVersion: 1,
  linkMode: 'linked',
  slotPath: '/main',
  overrides: {},
  expectedVersion: '1',
};

/** The diff-schema issues for `over` merged over DIFF. */
const diffHits = (over: Record<string, unknown>, prefix: string): boolean =>
  hits(diffRes, { ...DIFF, ...over }, prefix);

/** The diff-schema issues for these non-colliding paths. */
const pathHits = (paths: unknown[], prefix: string): boolean =>
  hits(
    diffRes,
    { ...DIFF, paths, collisionCount: 0, bulkEligible: true },
    prefix,
  );

describe('DEC-193 typed diff node values and collision kinds', () => {
  it('[DEC-193][diff-1] roundtrips the typed node values, slotPath, newRoots and collisionKind', () => {
    expect(diffRes.parse(DIFF)).toEqual(DIFF);
    const props = {
      ...DIFF,
      paths: [plain(val({ n: 1, list: [1, 2, null] }), val({ n: 2 }))],
      newRoots: [],
      collisionCount: 0,
      bulkEligible: true,
    };
    expect(diffRes.parse(props)).toEqual(props);
  });

  it('[DEC-193][diff-2] requires exactly one collisionKind on a collision and null otherwise', () => {
    const bad = { ...DIFF.paths[0], collisionKind: 'bogus' };
    expect(
      issuePaths(diffRes, {
        ...DIFF,
        paths: [bad],
        collisionCount: 1,
        bulkEligible: false,
      }),
    ).toContain('paths.0.collisionKind');
    for (const path of [
      { ...DIFF.paths[0], collisionKind: null },
      { ...PLAIN, collisionKind: PROPS },
    ]) {
      const candidate = {
        ...DIFF,
        paths: [path],
        collisionCount: path.collision ? 1 : 0,
        bulkEligible: false,
      };
      expect(isRefused(diffRes, candidate)).toBe(true);
      expect(under(issuePaths(diffRes, candidate), 'paths.0')).toBe(true);
    }
  });

  it('[DEC-193][diff-3] refuses a legacy scalar or props-only base/theirs at its member', () => {
    expect(pathHits([{ ...PLAIN, base: { t: 1 } }], 'paths.0.base')).toBe(true);
    expect(pathHits([{ ...PLAIN, base: 'Old' }], 'paths.0.base')).toBe(true);
    expect(pathHits([{ ...PLAIN, theirs: 42 }], 'paths.0.theirs')).toBe(true);
  });

  it('[DEC-193][diff-4] refuses an over-bound, unknown or snapshot node field', () => {
    const base = val();
    for (const field of [
      { ...base, extra: 1 },
      { ...base, blockVersion: 2_147_483_648 },
      { ...base, snapshot: { nodes: [] } },
    ])
      expect(pathHits([plain(field, null)], 'paths.0.base')).toBe(true);
  });

  it('[DEC-193][diff-5] bounds child addresses at 512 within the node cap', () => {
    const ok = {
      ...DIFF,
      paths: [plain(val({}, addrs(512)), val())],
      collisionCount: 0,
      bulkEligible: true,
    };
    expect(diffRes.parse(ok)).toEqual(ok);
    expect(
      pathHits([plain(val({}, addrs(513)), val())], 'paths.0.base.children'),
    ).toBe(true);
  });

  it('[DEC-193][diff-6] requires slotPath and newRoots and bounds the new-root addresses', () => {
    expect(issuePaths(diffRes, without(DIFF, 'slotPath'))).toContain(
      'slotPath',
    );
    expect(issuePaths(diffRes, without(DIFF, 'newRoots'))).toContain(
      'newRoots',
    );
    const dup = [DIFF.newRoots[0], DIFF.newRoots[0]];
    expect(diffHits({ newRoots: dup }, 'newRoots')).toBe(true);
    const many = { newRoots: addrs(513).map(root) };
    expect(diffHits(many, 'newRoots')).toBe(true);
    const bad = [root('a/b')];
    expect(diffHits({ newRoots: bad }, 'newRoots.0.rootPath')).toBe(true);
  });

  it('[DEC-193][diff-7] accepts a newer target with no changed paths and keeps an empty no-update answer', () => {
    const newer = { ...DIFF, paths: [], collisionCount: 0, bulkEligible: true };
    expect(diffRes.parse(newer)).toEqual(newer);
    const none = {
      ...DIFF,
      targetPatternVersion: 2,
      paths: [],
      newRoots: [],
      collisionCount: 0,
      bulkEligible: false,
    };
    expect(diffRes.parse(none)).toEqual(none);
    expect(diffHits({ ...none, newRoots: DIFF.newRoots }, 'newRoots')).toBe(
      true,
    );
    expect(diffHits({ collisionCount: 4 }, 'collisionCount')).toBe(true);
    expect(diffHits({ targetPatternVersion: 1 }, 'targetPatternVersion')).toBe(
      true,
    );
  });

  it('[DEC-193][diff-8] preserves the 128-path and 262144-byte diff bounds', () => {
    expect(CMS_UPDATE_DIFF_MAX_BYTES).toBe(262_144);
    const row = (i: number, props: unknown) =>
      dp(`/n${i}`, val(props), val(), null, false, null);
    const bounded = Array.from({ length: 128 }, (_, i) => row(i, {}));
    const ok = {
      ...DIFF,
      paths: bounded,
      collisionCount: 0,
      bulkEligible: true,
    };
    expect(diffRes.safeParse(ok).success).toBe(true);
    const over = [...bounded, row(128, {})];
    expect(isRefused(diffRes, { ...ok, paths: over })).toBe(true);
    const heavy = Array.from({ length: 128 }, (_, i) =>
      row(i, { blob: 'x'.repeat(2_100) }),
    );
    expect(issueMessages(diffRes, { ...ok, paths: heavy })).toEqual([
      'diff_too_large',
    ]);
  });
});

describe('DEC-193 public address, stored caps and pattern roots', () => {
  it('[DEC-193][choice-1] accepts a 72-segment 4680-character address and refuses a 73-segment or malformed one', () => {
    expect(choice.parse({ path: MAX_ADDRESS, choice: 'yours' })).toEqual({
      path: MAX_ADDRESS,
      choice: 'yours',
    });
    expect(choice.parse({ path: '/hero/cta', choice: 'theirs' })).toEqual({
      path: '/hero/cta',
      choice: 'theirs',
    });
    expect(hits(choice, { path: TOO_MANY, choice: 'yours' }, 'path')).toBe(
      true,
    );
    expect(hits(choice, { path: 'hero/a', choice: 'yours' }, 'path')).toBe(
      true,
    );
    const accept = {
      action: 'accept',
      targetPatternVersion: 3,
      instances: [
        {
          instanceId: INSTANCE.id,
          expectedVersion: '2',
          choices: [{ path: MAX_ADDRESS, choice: 'yours' }],
        },
      ],
      expectedVersion: '5',
    };
    expect(update.parse(accept)).toEqual(accept);
  });

  it('[DEC-193][caps-1] keeps the 512-character override key and slotPath bounds', () => {
    expect(overrides.parse({ '/hero/title': 'x' })).toEqual({
      '/hero/title': 'x',
    });
    expect(isRefused(overrides, { [OVER_STORED]: 1 })).toBe(true);
    const long = `/${'a'.repeat(512)}`;
    expect(isRefused(instReq, { ...BASE, slotPath: long })).toBe(true);
  });

  it('[DEC-193][roots-1] accepts an omitted roots member and a 1-512 unique full-address list', () => {
    expect(instReq.parse(BASE)).toEqual(BASE);
    const withRoots = { ...BASE, roots: [MAX_ADDRESS, '/hero'] };
    expect(instReq.parse(withRoots)).toEqual(withRoots);
    const full = { ...BASE, roots: addrs(512) };
    expect(instReq.parse(full)).toEqual(full);
    expect(hits(instReq, { ...BASE, roots: [] }, 'roots')).toBe(true);
    const dup = { ...BASE, roots: [MAX_ADDRESS, MAX_ADDRESS] };
    expect(hits(instReq, dup, 'roots')).toBe(true);
    const many = { ...BASE, roots: addrs(513) };
    expect(hits(instReq, many, 'roots')).toBe(true);
    expect(hits(instReq, { ...BASE, roots: ['hero'] }, 'roots.0')).toBe(true);
  });
});

describe('DEC-193 preserved update controls', () => {
  it('[DEC-193][controls-1] keeps the instance, choice, bulk, duplicate and If-Match controls', () => {
    const many = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        instanceId: uid(800 + index),
        expectedVersion: '1',
        choices: [],
      }));
    const accept = {
      action: 'accept',
      targetPatternVersion: 3,
      instances: many(1),
      expectedVersion: '5',
    };
    const bulk = { ...accept, instances: many(CMS_UPDATE_MAX_INSTANCES) };
    expect(update.parse(bulk)).toEqual(bulk);
    expect(isRefused(update, { ...accept, instances: many(33) })).toBe(true);
    const choices = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        path: `/node${index}`,
        choice: 'theirs',
      }));
    const single = {
      ...accept,
      instances: [
        {
          instanceId: uid(110),
          expectedVersion: '2',
          choices: choices(CMS_UPDATE_MAX_CHOICES),
        },
      ],
    };
    expect(update.parse(single)).toEqual(single);
    const tooMany = {
      ...accept,
      instances: [
        {
          instanceId: uid(110),
          expectedVersion: '2',
          choices: choices(CMS_UPDATE_MAX_CHOICES + 1),
        },
      ],
    };
    expect(isRefused(update, tooMany)).toBe(true);
    const bulkChoice = {
      ...accept,
      instances: [
        { ...many(2)[0], choices: [{ path: '/hero', choice: 'yours' }] },
        many(2)[1],
      ],
    };
    expect(issuePaths(update, bulkChoice)).toContain('instances.0.choices');
    const repeated = { ...accept, instances: [many(1)[0], many(1)[0]] };
    expect(issuePaths(update, repeated)).toContain('instances.1.instanceId');
    const hs = {
      contentType: 'application/json',
      idempotencyKey: 'dec193-0001',
      ifMatch: '"5"',
    };
    expect(headers.parse(hs)).toEqual(hs);
    const body = { headers: { ...hs, ifMatch: '"6"' }, body: accept };
    expect(issuePaths(api, body)).toContain('headers.ifMatch');
  });

  it('[DEC-193][privacy-1] refuses an owner, session, provenance or snapshot member', () => {
    expect(isRefused(diffRes, { ...DIFF, ownerId: uid(1) })).toBe(true);
    const session = { ...INSTANCE, sessionId: uid(1) };
    expect(issuePaths(diffRes, { ...DIFF, instance: session })).toContain(
      'instance',
    );
    const provenance = { ...DIFF.paths[0], provenance: { pin: 1 } };
    expect(issuePaths(diffRes, { ...DIFF, paths: [provenance] })).toContain(
      'paths.0',
    );
    const snap = { ...DIFF.paths[0], snapshot: { nodes: [] } };
    expect(issuePaths(diffRes, { ...DIFF, paths: [snap] })).toContain(
      'paths.0',
    );
  });
});
