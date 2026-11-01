import { describe, expect, it, vi } from 'vitest';

import type { CompositionPageReads } from './composition-page-reads';
import { row, ENTRY_ID, REVISION_ID } from './composition.test-support';
import {
  INSTANCE_LOAD_BUDGET_MS,
  INSTANCE_PAGE_LIMIT,
  loadInstanceRows,
} from './load-composition-instances';

/*
 * The instance-list walk (cmsCompositionInstancesRead, DEC-206 as aligned to BE00): pages of at most 50 rows, the
 * signed cursor followed until it ends, no page-count cap (BE03c bounds no revision's heads; review R3-04), and two
 * fail-closed guards that end a walk in the explicit degraded state instead of showing a prefix: a cursor offered
 * twice and the time budget.
 */
const PAGE = INSTANCE_PAGE_LIMIT;
const ok = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
const page = (
  start: number,
  length: number,
  nextCursor: string | null,
  revisionId = REVISION_ID,
) =>
  ok({
    revisionId,
    items: Array.from({ length }, (_, n) =>
      row(start + n, { revisionId: REVISION_ID }),
    ),
    nextCursor,
  });
const walk = (
  instances: CompositionPageReads['instances'],
  extra: { now?: () => number; budgetMs?: number } = {},
) =>
  loadInstanceRows({
    request: new Request('https://web.test/page'),
    entryId: ENTRY_ID,
    revisionId: REVISION_ID,
    reads: { instances } as unknown as CompositionPageReads,
    ...extra,
  });

describe('loadInstanceRows', () => {
  it('asks for pages of 50, the BE00 maximum, after the cursor of the page before', async () => {
    const pages = [page(0, PAGE, 'c1'), page(PAGE, 3, null)];
    const instances = vi.fn<CompositionPageReads['instances']>(
      async () => pages.shift() ?? ok({}),
    );
    const result = await walk(instances);
    expect(PAGE).toBe(50);
    expect(result.kind === 'rows' && result.rows).toHaveLength(PAGE + 3);
    expect(instances.mock.calls.map((call) => [call[2], call[3]])).toEqual([
      [null, 50],
      ['c1', 50],
    ]);
  });

  it('follows the cursor until the list ends, however many pages that is: there is no page-count cap', async () => {
    const PAGES = 120;
    let served = 0;
    const instances = vi.fn<CompositionPageReads['instances']>(async () => {
      const start = served * PAGE;
      served += 1;
      return page(start, PAGE, served < PAGES ? `cursor-${served}` : null);
    });
    const result = await walk(instances);
    expect(result.kind === 'rows' && result.rows).toHaveLength(PAGES * PAGE);
    expect(instances).toHaveBeenCalledTimes(PAGES);
  });

  it('degrades, never truncates, when the read offers a cursor it already offered', async () => {
    const instances = vi.fn<CompositionPageReads['instances']>(async () =>
      page(0, PAGE, 'again'),
    );
    const result = await walk(instances);
    expect(result).toEqual({ kind: 'degraded' });
    expect(instances).toHaveBeenCalledTimes(2);
  });

  it('degrades, never truncates, when the walk outlasts its time budget', async () => {
    let clock = 0;
    const instances = vi.fn<CompositionPageReads['instances']>(async () => {
      // A loader without the budget guard would walk for ever: end that walk with a failure instead of exhausting memory.
      if (instances.mock.calls.length > 10)
        return new Response(null, { status: 500 });
      clock += 7_000;
      return page(clock, PAGE, `cursor-${clock}`);
    });
    const result = await walk(instances, { now: () => clock });
    expect(INSTANCE_LOAD_BUDGET_MS).toBe(20_000);
    expect(result).toEqual({ kind: 'degraded' });
    expect(instances.mock.calls.length).toBeGreaterThan(1);
    expect(instances.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it('keeps a walk inside its budget however slow a page is, as long as it ends', async () => {
    let clock = 0;
    const pages = [page(0, PAGE, 'c1'), page(PAGE, 1, null)];
    const instances = vi.fn<CompositionPageReads['instances']>(async () => {
      clock += 9_000;
      return pages.shift() ?? ok({});
    });
    const result = await walk(instances, { now: () => clock });
    expect(result.kind).toBe('rows');
  });

  it.each([
    ['a page of another revision', () => page(0, 1, null, ENTRY_ID)],
    ['more rows than the 50 asked for', () => page(0, PAGE + 1, null)],
    ['a cursor on fewer rows than asked', () => page(0, 3, 'c1')],
    ['a body that is not a page', () => ok({ items: 'x' })],
  ])('refuses %s as unverified', async (_name, build) => {
    const result = await walk(vi.fn(async () => build()));
    expect(result).toEqual({ kind: 'unverified' });
  });

  it('hands a non-200 answer to the caller untouched', async () => {
    const forbidden = new Response('{}', { status: 403 });
    const result = await walk(vi.fn(async () => forbidden));
    expect(result.kind === 'response' && result.response.status).toBe(403);
  });
});
