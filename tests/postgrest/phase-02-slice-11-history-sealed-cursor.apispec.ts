/**
 * Slice 11 real composition, review finding B-06 (P2-S11-AC-086, BE03b "Derived revision workflow state (E2)",
 * DEC-140): CMS-03B-03 revision history with a `state` filter, paged through the production Worker route with the
 * SEALED cursor.
 *
 * The pgTAP suite phase_02_slice_11_e2_scan_history_cursor_privacy.sql proves the sealed envelope against the private
 * wrapper. This suite proves what that suite cannot: that the cursor survives the caller-facing route. It is standard
 * base64 (it carries `+` and `/`) in a URL query string; the Worker must pass it to the RPC byte for byte, the page
 * behind it must resume exactly after the last scanned candidate, a tampered, truncated or foreign-context cursor must
 * be the typed refusal, and nothing but the opaque envelope may leave the database.
 *
 * Fixture, all through the production routes: one entry whose revision 1 is PUBLISHED, revisions 2 to 7 are `draft`
 * and revision 8 is `submitted`, so a `draft` filter excludes both ends of the list and a short window forces a cursor.
 *
 * Commits fixtures; run right after `pnpm db:reset`, and reset again afterwards.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { RevisionHistoryPageSchema } from '@wejammin/contracts';

import {
  expectStatus,
  expectUnchanged,
  snapshotDigest,
} from './support/phase-02-slice-11-assert';
import {
  approvedDraft,
  submitForReview,
} from './support/phase-02-slice-11-flow';
import {
  createS11Stack,
  type S11Response,
  type S11Stack,
} from './support/phase-02-slice-11-stack';
import {
  prepareS11World,
  type S11World,
} from './support/phase-02-slice-11-world';
import { appendEntryBody } from './support/cms-editorial-world';
import { psql } from './support/stack';

const REVISIONS = 8;
const WINDOW = 2;
/** `0x01 || keyId(16) || nonce(16) || ciphertext(208) || tag(32)`. */
const SEALED_BYTES = 273;
const SEALED_CHARS = 364;
const REGIONS = [
  ['key id', 1],
  ['nonce', 17],
  ['ciphertext', 33],
  ['authentication tag', 241 + 5],
] as const;

let world: S11World;
let stack: S11Stack;
let entryId = '';
const revisionIds = new Map<number, string>();

type Page = ReturnType<typeof RevisionHistoryPageSchema.parse>;

const historyPath = (query: string): string =>
  `/api/v1/cms/entries/${entryId}/revisions${query}`;
const numbersOf = (page: Page): string[] =>
  page.items.map((item) => item.revisionNumber);

const readPage = async (query: string): Promise<Page> => {
  const response = await stack.get(historyPath(query));
  expectStatus(response, 200);
  return RevisionHistoryPageSchema.parse(response.body);
};

const withCursor = (base: string, cursor: string): string =>
  `${base}&cursor=${encodeURIComponent(cursor)}`;

/** Every page of a filtered read, following the cursor from the first request. */
const collect = async (base: string) => {
  const pages: Page[] = [];
  const cursors: string[] = [];
  let query = base;
  for (let guard = 0; guard < REVISIONS; guard += 1) {
    const page = await readPage(query);
    pages.push(page);
    if (page.nextCursor === null) break;
    cursors.push(page.nextCursor);
    query = withCursor(base, page.nextCursor);
  }
  return { pages, cursors };
};

const flip = (cursor: string, offset: number): string => {
  const bytes = Buffer.from(cursor, 'base64');
  bytes[offset] = (bytes[offset] ?? 0) ^ 0x01;
  return bytes.toString('base64');
};

const expectRefusal = (
  response: S11Response,
  status: number,
  code: string,
  recoveryAction?: string,
): void => {
  expect(response.status, response.text).toBe(status);
  expect(response.body.code).toBe(code);
  if (recoveryAction !== undefined)
    expect(response.body.details).toMatchObject({ recoveryAction });
  expect(response.body).not.toHaveProperty('items');
};

const head = (): { version: string; number: string } => {
  const [version = '', number = ''] = psql(
    `select e.version, (select max(r.revision_number)
                          from platform_private.cms_entry_revisions r where r.entry_id = e.id)
       from platform_private.cms_content_entries e where e.id = '${entryId}'`,
  ).split('|');
  return { version, number };
};

beforeAll(async () => {
  world = await prepareS11World();
  stack = createS11Stack(world.owner);
  const draft = await approvedDraft(stack, world, 'Sealed history cursor');
  entryId = draft.entryId;
  stack.as(world.publisher, 'fresh');
  const published = await stack.post('/api/v1/cms/publications', {
    body: {
      entryId,
      revisionId: draft.revisionId,
      frozenHash: draft.frozenHash,
      expectedVersionSet: draft.versionSet,
      audience: 'public',
      expectedVersion: draft.reviewVersion,
    },
    ifMatch: draft.reviewVersion,
  });
  expectStatus(published, 202);
  stack.as(world.owner);
  for (let number = 2; number <= REVISIONS; number += 1) {
    const current = head();
    const appended = await stack.post(
      `/api/v1/cms/entries/${entryId}/revisions`,
      {
        body: appendEntryBody(
          world.editorial,
          entryId,
          `Sealed history revision ${number}`,
          current.number,
          current.version,
        ),
        ifMatch: current.version,
      },
    );
    expectStatus(appended, 201);
  }
  for (const row of psql(
    `select revision_number, id from platform_private.cms_entry_revisions
      where entry_id = '${entryId}' order by revision_number`,
  ).split('\n')) {
    const [number = '', id = ''] = row.split('|');
    revisionIds.set(Number(number), id);
  }
  expect(revisionIds.size).toBe(REVISIONS);
  await submitForReview(stack, world, {
    entryId,
    revisionId: revisionIds.get(REVISIONS) as string,
    entryVersion: head().version,
  });
}, 240_000);

describe('CMS-03B-03 state-filtered history paged with the sealed cursor through the Worker route', () => {
  it('[CMS-03B-03] a draft filter pages the six draft revisions two at a time: each cursor resumes exactly after the last scanned candidate and the last page has none', async () => {
    const { pages, cursors } = await collect(`?state=draft&limit=${WINDOW}`);
    expect(pages.map(numbersOf)).toEqual([
      ['7', '6'],
      ['5', '4'],
      ['3', '2'],
    ]);
    expect(cursors).toHaveLength(2);
    expect(pages.at(-1)?.nextCursor).toBeNull();
    for (const page of pages)
      expect(page.items.every((item) => item.state === 'draft')).toBe(true);
    const ids = pages.flatMap((page) => page.items.map((item) => item.id));
    expect(new Set(ids).size).toBe(6);
    // The excluded ends never appear: revision 1 is published, revision 8 submitted.
    expect(ids).not.toContain(revisionIds.get(1));
    expect(ids).not.toContain(revisionIds.get(REVISIONS));
  }, 60_000);

  it('[CMS-03B-03] a filter whose only match is the oldest or the newest revision is found by the scan and ends without a cursor', async () => {
    const published = await readPage('?state=published&limit=1');
    expect(numbersOf(published)).toEqual(['1']);
    expect(published.nextCursor).toBeNull();
    const submitted = await readPage('?state=submitted&limit=1');
    expect(numbersOf(submitted)).toEqual([String(REVISIONS)]);
    expect(submitted.nextCursor).toBeNull();
  });

  it('[CMS-03B-03] the cursor of a filtered page is the fixed-length sealed envelope, canonical base64 that carries URL-significant characters, and discloses no identifier', async () => {
    const { cursors } = await collect(`?state=draft&limit=${WINDOW}`);
    expect(cursors.length).toBeGreaterThan(0);
    for (const cursor of cursors) {
      const bytes = Buffer.from(cursor, 'base64');
      expect(bytes).toHaveLength(SEALED_BYTES);
      expect(cursor).toHaveLength(SEALED_CHARS);
      expect(bytes.toString('base64')).toBe(cursor);
      expect(bytes[0]).toBe(0x01);
      const forms = [bytes.toString('latin1'), bytes.toString('hex')];
      for (const secret of [entryId, ...revisionIds.values()])
        for (const form of [secret, secret.replaceAll('-', '')])
          expect(forms.some((text) => text.includes(form))).toBe(false);
      for (const member of ['lastRevision', 'queryHash', 'expiresAt'])
        expect(forms[0]).not.toContain(member);
    }
    // 364 characters of random base64 all but certainly contain a character that a naive URL join would corrupt.
    expect(cursors.some((cursor) => /[+/]/u.test(cursor))).toBe(true);
  });

  it('[CMS-03B-03] the Worker hands the RPC the exact cursor the browser sent (percent-decoding included) and returns the cursor the RPC answered', async () => {
    const first = await readPage(`?state=draft&limit=${WINDOW}`);
    const cursor = first.nextCursor as string;
    stack.clearRpcs();
    const second = await readPage(
      withCursor(`?state=draft&limit=${WINDOW}`, cursor),
    );
    const calls = stack
      .rpcs()
      .filter((call) => call.rpc === 'cms_list_revisions');
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call?.status).toBe(200);
    expect(call?.request.cursor).toBe(cursor);
    expect(call?.request.state).toBe('draft');
    expect(Number(call?.request.limit)).toBe(WINDOW);
    expect((call?.response as { nextCursor: string }).nextCursor).toBe(
      second.nextCursor,
    );
    expect(second.nextCursor).not.toBeNull();
  });

  it('[CMS-03B-03] a fresh nonce makes two identical first-page reads return different cursors that resume to the same page', async () => {
    const [a, b] = [
      await readPage(`?state=draft&limit=${WINDOW}`),
      await readPage(`?state=draft&limit=${WINDOW}`),
    ];
    expect(numbersOf(a)).toEqual(numbersOf(b));
    expect(a.nextCursor).not.toBe(b.nextCursor);
    const [pageA, pageB] = [
      await readPage(
        withCursor(`?state=draft&limit=${WINDOW}`, a.nextCursor as string),
      ),
      await readPage(
        withCursor(`?state=draft&limit=${WINDOW}`, b.nextCursor as string),
      ),
    ];
    expect(numbersOf(pageA)).toEqual(['5', '4']);
    expect(numbersOf(pageB)).toEqual(numbersOf(pageA));
  });

  it('[CMS-03B-03] a request without a state filter keeps the signed envelope: the kind is chosen by the request, never by the scan', async () => {
    const page = await readPage(`?limit=${WINDOW}`);
    const bytes = Buffer.from(page.nextCursor as string, 'base64');
    expect(bytes[0]).not.toBe(0x01);
    const envelope = JSON.parse(bytes.toString('utf8')) as Record<
      string,
      unknown
    >;
    expect(Object.keys(envelope).sort()).toEqual([
      'expiresAt',
      'keyId',
      'lastRevisionId',
      'lastRevisionNumber',
      'queryHash',
      'signature',
    ]);
  });
});

describe('CMS-03B-03 sealed cursor refusals through the Worker route', () => {
  let cursor = '';
  const base = `?state=draft&limit=${WINDOW}`;

  beforeAll(async () => {
    cursor = (await readPage(base)).nextCursor as string;
  });

  it.each(REGIONS)(
    '[CMS-03B-03] a cursor with a flipped bit in the %s is the typed 409 restart, never a page, and writes nothing',
    async (_region, offset) => {
      const before = snapshotDigest();
      const response = await stack.get(
        historyPath(withCursor(base, flip(cursor, offset))),
      );
      expectRefusal(response, 409, 'CONFLICT', 'refresh');
      expectUnchanged(
        before,
        snapshotDigest(),
        'a refused read writes nothing',
      );
    },
  );

  it.each([
    ['a changed state filter', `?state=submitted&limit=${WINDOW}`],
    ['a changed limit', `?state=draft&limit=${WINDOW + 1}`],
    ['no state filter', `?limit=${WINDOW}`],
    ['a locale filter', `?state=draft&limit=${WINDOW}&locale=en-US`],
  ])(
    '[CMS-03B-03] a valid sealed cursor replayed with %s is bound to its original context: the typed 409 restart',
    async (_label, query) => {
      const before = snapshotDigest();
      const response = await stack.get(historyPath(withCursor(query, cursor)));
      expectRefusal(response, 409, 'CONFLICT', 'refresh');
      expectUnchanged(
        before,
        snapshotDigest(),
        'a refused read writes nothing',
      );
    },
  );

  it.each([
    ['truncated by one byte', (bytes: Buffer) => bytes.subarray(0, -1)],
    [
      'longer by one byte',
      (bytes: Buffer) => Buffer.concat([bytes, Buffer.from([0x00])]),
    ],
  ])(
    '[CMS-03B-03] a sealed envelope %s is a structural 400 INVALID_REQUEST and writes nothing',
    async (_label, reshape) => {
      const malformed = reshape(Buffer.from(cursor, 'base64')).toString(
        'base64',
      );
      const before = snapshotDigest();
      const response = await stack.get(
        historyPath(withCursor(base, malformed)),
      );
      expectRefusal(response, 400, 'INVALID_REQUEST');
      expectUnchanged(
        before,
        snapshotDigest(),
        'a refused read writes nothing',
      );
    },
  );
});
