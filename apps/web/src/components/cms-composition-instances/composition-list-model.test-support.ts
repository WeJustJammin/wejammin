import { mergeRows } from './composition-rows';
import { REVISION_ID } from './composition.test-support';
import type { InstanceRow } from './composition-types';

/*
 * The server side of the instance list for a test that did not script it (review V20 n4). A read nobody scripted used to
 * answer 503, which the island ignores by keeping its rows, so the old suites passed whether or not the refetch ran. The
 * model answers what the server would: the rows the page was given plus the rows every successful mutation answered,
 * newest version per path, as the protected read lists them (`draft`, `active` and `pending_diff` heads only, DEC-206).
 * The refetch is a real 200 whose effect is the same rows; the test asserts that it happened (`page.lists`).
 */
const LISTED = new Set(['draft', 'active', 'pending_diff']);

/** A response built by the page support's `json()` carries the body it was built from, so the model reads it at once. */
const BODY = Symbol('testBody');
export const withBody = (response: Response, body: unknown): Response =>
  Object.assign(response, { [BODY]: body });
const bodyOf = (response: Response): { items?: unknown } | undefined =>
  (response as unknown as Record<symbol, { items?: unknown } | undefined>)[
    BODY
  ];

export const listModel = (initial: readonly InstanceRow[]) => {
  let rows: readonly InstanceRow[] = initial;
  const take = (response: Response): void => {
    if (response.status !== 200 && response.status !== 201) return;
    const items = bodyOf(response)?.items;
    if (Array.isArray(items)) rows = mergeRows(rows, items as InstanceRow[]);
  };
  return {
    /** A mutation answer: its `items` are now on the server. */
    observe: (reply: Promise<Response> | Response): void => {
      if (reply instanceof Promise) void reply.then(take, () => undefined);
      else take(reply);
    },
    answer: (): Response =>
      new Response(
        JSON.stringify({
          revisionId: REVISION_ID,
          items: rows.filter((row) => LISTED.has(row.state)),
          nextCursor: null,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
  };
};
