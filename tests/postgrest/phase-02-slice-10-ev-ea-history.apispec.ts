/**
 * Slice 10 evidence lane EA, CMS-03B-03 (revision history and compare) through the real stack:
 * browser request -> first-party proxy -> production Worker -> production RPC adapter -> Kong ->
 * PostgREST -> newest SQL. Only the verified session and an always-allow rate limiter are supplied.
 *
 * It proves the read contract end to end: the default window of 25 and the maximum of 50 with a
 * signed, context-bound keyset cursor that stays inside 512 characters; structural cursor and
 * query faults as 400, a well-formed cursor that is tampered or bound to another context as the
 * typed 409 restart; the compare block with its restore descriptor and typed 404 for a revision
 * the caller cannot read; 401, 403 and 404 for three principals; and that a read writes no row.
 *
 * Commits fixtures; run right after `pnpm db:reset` and reset again afterwards.
 */
import { randomUUID } from 'node:crypto';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  type EditorialWorld,
  appendEntryBody,
  authorSession,
  prepareEditorialWorld,
} from './support/cms-editorial-world';
import { createIsolatedCmsOwner } from './support/cms-isolated-owner';
import { seedEditorialEntry } from './support/cms-editorial-seed';
import {
  type EditorialStack,
  createEditorialStack,
} from './support/cms-editorial-stack';
import {
  expectRefusal,
  memberWithoutGrant,
  outsider,
  violation,
  violationsOf,
  snapshot,
} from './support/ev-ea-support';

const REVISIONS = 27;

let world: EditorialWorld;
let stack: EditorialStack;
let entryId = '';
let firstRevisionId = '';
let otherEntryRevisionId = '';

type Page = Readonly<{
  items: readonly { id: string; revisionNumber: string }[];
  nextCursor: string | null;
  pageVersion: string;
  compare: Record<string, unknown> | null;
}>;

const pageOf = (body: Record<string, unknown>): Page => body as unknown as Page;

beforeAll(async () => {
  world = await prepareEditorialWorld(createIsolatedCmsOwner());
  stack = createEditorialStack(authorSession(world));
  ({ entryId, firstRevisionId } = await seedEditorialEntry(stack, world));
  for (let version = 3; version < REVISIONS; version += 1) {
    const appended = await stack.append(
      entryId,
      appendEntryBody(
        world,
        entryId,
        `Revision ${version + 1}`,
        String(version),
        String(version),
      ),
      { ifMatch: String(version) },
    );
    expect(appended.status, appended.text).toBe(201);
  }
  const other = await seedEditorialEntry(stack, world);
  otherEntryRevisionId = other.firstRevisionId;
});

describe('CMS-03B-03 window, keyset cursor and cache contract through the real stack', () => {
  it('the default window is 25 revisions, newest first, with a strong version ETag, no-store and a signed cursor within 512 characters', async () => {
    const before = snapshot(entryId);
    const response = await stack.history(entryId);
    expect(response.status, response.text).toBe(200);
    const page = pageOf(response.body);
    expect(page.items).toHaveLength(25);
    expect(page.items.map((item) => item.revisionNumber)).toEqual(
      Array.from({ length: 25 }, (_, index) => String(REVISIONS - index)),
    );
    expect(page.nextCursor).not.toBeNull();
    expect((page.nextCursor ?? '').length).toBeLessThanOrEqual(512);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('etag')).toBe(`"${page.pageVersion}"`);
    expect(page.pageVersion).toBe(String(REVISIONS));
    // A read is safe: no revision, audit, outbox or conflict row appears.
    expect(snapshot(entryId)).toEqual(before);
  });

  it('the signed cursor continues exactly where the page stopped and the last page has no cursor', async () => {
    const first = pageOf((await stack.history(entryId)).body);
    const second = await stack.history(
      entryId,
      `?cursor=${encodeURIComponent(first.nextCursor ?? '')}`,
    );
    // The cursor binds the query: a continuation repeats the first request's default limit.
    expect(second.status, second.text).toBe(200);
    const page = pageOf(second.body);
    expect(page.items.map((item) => item.revisionNumber)).toEqual(['2', '1']);
    expect(page.nextCursor).toBeNull();
    const all = [...first.items, ...page.items].map((item) => item.id);
    expect(new Set(all).size).toBe(REVISIONS);
  });

  it('a limit of 50 is the maximum window and returns every revision of this entry in one page', async () => {
    const response = await stack.history(entryId, '?limit=50');
    expect(response.status, response.text).toBe(200);
    const page = pageOf(response.body);
    expect(page.items).toHaveLength(REVISIONS);
    expect(page.nextCursor).toBeNull();
  });

  it('a limit of 1 returns one revision and a cursor to the next', async () => {
    const response = await stack.history(entryId, '?limit=1');
    const page = pageOf(response.body);
    expect(response.status, response.text).toBe(200);
    expect(page.items.map((item) => item.revisionNumber)).toEqual([
      String(REVISIONS),
    ]);
    expect(page.nextCursor).not.toBeNull();
  });
});

describe('CMS-03B-03 query and cursor validation through the real stack', () => {
  it.each([
    ['a limit of 0', '?limit=0'],
    ['a limit of 51', '?limit=51'],
    ['a fractional limit', '?limit=1.5'],
    ['a non-numeric limit', '?limit=abc'],
    ['a repeated limit', '?limit=1&limit=2'],
    ['an unknown query member', '?ownerId=x'],
    ['an empty cursor', '?cursor='],
    ['a 513-character cursor', `?cursor=${'a'.repeat(513)}`],
    ['a cursor that is not base64', '?cursor=%25%25%25%25'],
    [
      'a cursor that is base64 of non-JSON',
      `?cursor=${encodeURIComponent(Buffer.from('not json at all').toString('base64'))}`,
    ],
    [
      'a cursor that is base64 of an array',
      `?cursor=${encodeURIComponent(Buffer.from('[]').toString('base64'))}`,
    ],
    [
      'a cursor whose JSON has none of the six signed members',
      `?cursor=${encodeURIComponent(Buffer.from('{"a":1}').toString('base64'))}`,
    ],
  ])(
    '%s is a structural 400 INVALID_REQUEST and writes nothing',
    async (_label, query) => {
      const before = snapshot(entryId);
      const response = await stack.history(entryId, query);
      expectRefusal(
        response,
        { status: 400, code: 'INVALID_REQUEST' },
        entryId,
        before,
      );
    },
  );

  it.each([
    [
      'a compareRevisionId that is not a UUID',
      '?compareRevisionId=nope',
      '/compareRevisionId',
      'invalid_value',
    ],
    [
      'a state outside the closed revision states',
      '?state=archived',
      '/state',
      'invalid_value',
    ],
    ['a malformed locale', '?locale=en_US', '/locale', 'locale_invalid'],
  ])(
    '%s is a 400 naming its pointer and code',
    async (_label, query, path, code) => {
      const response = await stack.history(entryId, query);
      expect(response.status, response.text).toBe(400);
      expect(response.body.code).toBe('INVALID_REQUEST');
      expect(violationsOf(response)).toEqual([violation(path, code)]);
    },
  );

  it('a malformed entry id in the path is a structural 400 naming /entryId', async () => {
    const response = await stack.history('not-a-uuid');
    expect(response.status, response.text).toBe(400);
    expect(violationsOf(response)).toEqual([
      violation('/entryId', 'invalid_uuid'),
    ]);
  });

  it('a well-formed cursor with a changed signature is the typed 409 restart, never a page', async () => {
    const first = pageOf((await stack.history(entryId, '?limit=1')).body);
    const envelope = JSON.parse(
      Buffer.from(first.nextCursor ?? '', 'base64').toString('utf8'),
    ) as { signature: string };
    const flipped = envelope.signature.endsWith('0') ? '1' : '0';
    envelope.signature = envelope.signature.slice(0, -1) + flipped;
    const tampered = Buffer.from(JSON.stringify(envelope)).toString('base64');
    const before = snapshot(entryId);
    const response = await stack.history(
      entryId,
      `?limit=1&cursor=${encodeURIComponent(tampered)}`,
    );
    expectRefusal(
      response,
      { status: 409, code: 'CONFLICT', details: { recoveryAction: 'refresh' } },
      entryId,
      before,
    );
  });

  it.each([
    ['a changed state filter', '&state=draft'],
    ['a changed limit', '&limit=2'],
    ['a changed locale filter', '&locale=en-US'],
  ])(
    'a valid cursor replayed with %s is bound to its original context: the typed 409 restart',
    async (_label, change) => {
      const first = pageOf((await stack.history(entryId, '?limit=1')).body);
      const cursor = encodeURIComponent(first.nextCursor ?? '');
      const query = change.startsWith('&limit')
        ? `?cursor=${cursor}${change}`
        : `?limit=1&cursor=${cursor}${change}`;
      const before = snapshot(entryId);
      const response = await stack.history(entryId, query);
      expectRefusal(
        response,
        {
          status: 409,
          code: 'CONFLICT',
          details: { recoveryAction: 'refresh' },
        },
        entryId,
        before,
      );
    },
  );
});

describe('CMS-03B-03 compare and the 401, 403 and 404 boundary through the real stack', () => {
  it('compareRevisionId returns the compare block with domain-tagged changes and the safe restore descriptor', async () => {
    const response = await stack.history(
      entryId,
      `?compareRevisionId=${firstRevisionId}`,
    );
    expect(response.status, response.text).toBe(200);
    const compare = pageOf(response.body).compare as {
      leftRevisionId: string;
      rightRevisionId: string;
      changes: readonly { domain: string; path: string; kind: string }[];
      restore: {
        migrationChainId: string;
        edgeCount: number;
        availability: string;
      };
    };
    expect(compare.leftRevisionId).toBe(firstRevisionId);
    expect(compare.changes.length).toBeGreaterThan(0);
    expect(compare.changes.every((change) => change.domain === 'field')).toBe(
      true,
    );
    expect(compare.changes[0]?.path).toBe(`/fields/${world.titleFieldId}`);
    expect(compare.restore.availability).toBe('available');
    expect(compare.restore.edgeCount).toBe(0);
  });

  it('a compareRevisionId that names no revision is an empty 404 and writes nothing', async () => {
    const before = snapshot(entryId);
    const response = await stack.history(
      entryId,
      `?compareRevisionId=${randomUUID()}`,
    );
    expectRefusal(
      response,
      { status: 404, code: 'NOT_FOUND' },
      entryId,
      before,
    );
    expect(response.body.details).toEqual({});
  });

  it('a compareRevisionId that belongs to another entry is the same empty 404', async () => {
    const response = await stack.history(
      entryId,
      `?compareRevisionId=${otherEntryRevisionId}`,
    );
    expect(response.status, response.text).toBe(404);
    expect(response.body.details).toEqual({});
  });

  it('no session is a 401 with a reauthenticate hint and nothing is written', async () => {
    const before = snapshot(entryId);
    stack.as(null);
    try {
      expectRefusal(
        await stack.history(entryId),
        {
          status: 401,
          code: 'UNAUTHENTICATED',
          details: { recoveryAction: 'reauthenticate' },
        },
        entryId,
        before,
      );
    } finally {
      stack.as(authorSession(world));
    }
  });

  it('a confirmed member holding no CMS grant is a 403 and nothing is written', async () => {
    const principal = memberWithoutGrant(world);
    const before = snapshot(entryId);
    stack.as(principal);
    try {
      expectRefusal(
        await stack.history(entryId),
        { status: 403, code: 'FORBIDDEN' },
        entryId,
        before,
      );
    } finally {
      stack.as(authorSession(world));
    }
  });

  it('a person outside the owning organization and an absent entry get the same empty 404', async () => {
    stack.as(outsider(world));
    let hidden;
    try {
      hidden = await stack.history(entryId);
    } finally {
      stack.as(authorSession(world));
    }
    const absent = await stack.history(randomUUID());
    expect(hidden.status, hidden.text).toBe(404);
    expect(absent.status, absent.text).toBe(404);
    expect(hidden.body.details).toEqual({});
    expect(absent.body.details).toEqual({});
    expect(hidden.body.message).toBe(absent.body.message);
  });
});
