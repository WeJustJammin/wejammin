import { describe, expect, it } from 'vitest';

import {
  INSTANCE_PAGE_LIMIT,
  instanceListPath,
  readInstanceList,
} from './composition-instance-list';
import { ENTRY_ID, REVISION_ID, row } from './composition.test-support';

/**
 * [P2-S12-AC-271] The browser read of `cmsCompositionInstancesRead` (DEC-206, FE03 1047): it walks the signed cursor
 * until it ends, keeps the newest row of a path, and fails closed on every answer the strict page would not be.
 */
const page = (
  items: unknown[],
  nextCursor: string | null = null,
  revisionId: string | null = REVISION_ID,
): Response =>
  new Response(JSON.stringify({ revisionId, items, nextCursor }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
const queued = (...answers: Array<Response | (() => Response)>) => {
  const calls: string[] = [];
  const fetcher = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    const next = answers.shift();
    if (next === undefined) throw new Error('unscripted read');
    return typeof next === 'function' ? next() : next;
  }) as typeof fetch;
  return { fetcher, calls };
};
const read = (fetcher: typeof fetch, extra = {}) =>
  readInstanceList(ENTRY_ID, REVISION_ID, { fetcher, ...extra });

describe('readInstanceList', () => {
  it('[P2-S12-AC-271] asks for 50 rows a page and encodes the cursor', () => {
    expect(instanceListPath(ENTRY_ID, null)).toBe(
      `/api/v1/cms/entries/${ENTRY_ID}/compositions?limit=${INSTANCE_PAGE_LIMIT}`,
    );
    expect(instanceListPath(ENTRY_ID, 'a b/c')).toBe(
      `/api/v1/cms/entries/${ENTRY_ID}/compositions?limit=50&cursor=a%20b%2Fc`,
    );
  });

  it('[P2-S12-AC-271] follows the cursor and keeps the newest row of a path where it first stood', async () => {
    const { fetcher, calls } = queued(
      page([row(1, { version: '3' }), row(2)], 'next'),
      page([row(1, { version: '5' }), row(2, { version: '1' }), row(3)]),
    );
    const answer = await read(fetcher);
    expect(calls).toHaveLength(2);
    expect(answer.kind).toBe('rows');
    if (answer.kind !== 'rows') return;
    expect(answer.rows.map((r) => [r.path, r.version])).toEqual([
      ['/main/row-1', '5'],
      ['/main/row-2', '3'],
      ['/main/row-3', '3'],
    ]);
  });

  it('[P2-S12-AC-271] fails closed when the walk does not end within its budget or offers a cursor twice', async () => {
    let tick = 0;
    const slow = queued(page([row(1)], 'a'), page([row(2)], 'b'));
    expect(
      await read(slow.fetcher, {
        now: () => (tick += 30_000),
        budgetMs: 20_000,
      }),
    ).toEqual({ kind: 'failed' });
    const repeating = queued(page([row(1)], 'a'), page([row(2)], 'a'));
    expect(await read(repeating.fetcher)).toEqual({ kind: 'failed' });
  });

  it.each([
    ['a failed read', () => new Response(null, { status: 500 })],
    ['a page of another revision', () => page([row(1)], null, row(77).id)],
    ['an entry without a draft revision', () => page([], null, null)],
    ['a row that is not an instance', () => page([{ path: 3 }])],
    ['a row of a retired state', () => page([row(1, { state: 'retired' })])],
    [
      'a row of another revision',
      () => page([row(1, { revisionId: row(77).id })]),
    ],
    [
      'too many rows for a page',
      () => page(Array.from({ length: 51 }, (_, i) => row(i + 1))),
    ],
    ['a cursor that is not text', () => page([row(1)], 7 as unknown as string)],
    ['an over-long cursor', () => page([row(1)], 'c'.repeat(513))],
    ['a body that is not a page', () => new Response('[]', { status: 200 })],
  ])('fails closed on %s', async (_name, reply) => {
    const { fetcher } = queued(reply);
    expect(await read(fetcher)).toEqual({ kind: 'failed' });
  });
});
