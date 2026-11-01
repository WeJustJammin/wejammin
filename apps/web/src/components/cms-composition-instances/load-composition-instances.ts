import {
  compositionInstancesPageHonours,
  CompositionInstancePageSchema,
} from '@wejammin/contracts';

import type { CompositionPageReads } from './composition-page-reads';
import type { InstanceRow } from './composition-types';

/** The page size the loader asks for: the BE00 maximum (BE03c `CompositionInstancesQuery.limit` 1-50), so the fewest round trips. */
export const INSTANCE_PAGE_LIMIT = 50;

/**
 * How long one page load may spend following the cursor, in milliseconds. This is a resource bound of the page
 * request, not a fact of the specification: no spec bounds the heads of a draft revision (each placement may write 512
 * rows and the placements are not bounded), so the walk is not capped by a page count. A list that does not end
 * within the budget is refused as degraded, never shown truncated.
 */
export const INSTANCE_LOAD_BUDGET_MS = 20_000;

export type LoadedInstanceRows =
  | Readonly<{ kind: 'rows'; rows: readonly InstanceRow[] }>
  /** A non-200 answer of the read, for the caller to map (the 403 is the page-level 403). */
  | Readonly<{ kind: 'response'; response: Response }>
  /** An answer the strict contracts or the request binding did not verify: nothing is shown. */
  | Readonly<{ kind: 'unverified' }>
  /**
   * The walk could not complete: the list did not end within the time budget, or the read offered a cursor it had
   * already offered. The explicit degraded state (FE03 read state `degraded`): nothing is shown, never a prefix.
   */
  | Readonly<{ kind: 'degraded' }>;

const jsonOf = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
};

/**
 * Every row of the entry's current draft revision, in the render order the read answers (FE03 887: slot, then
 * authored `position`, then path), by following the cursor of each page until it ends. Each page must be the strict
 * page of the draft revision the entry detail named and must honour its request; the newest row of a path that two
 * pages both listed wins and keeps the place of its first listing. The order is the server's: it is never re-sorted
 * here, because the slot ordinal is not a member of a row. The walk has two fail-closed guards and no page cap: a
 * cursor the read has already offered (the walk is not advancing) and the time budget.
 */
export const loadInstanceRows = async (input: {
  readonly request: Request;
  readonly entryId: string;
  readonly revisionId: string;
  readonly reads: CompositionPageReads;
  readonly now?: () => number;
  readonly budgetMs?: number;
}): Promise<LoadedInstanceRows> => {
  const { request, entryId, revisionId, reads } = input;
  const now = input.now ?? Date.now;
  const deadline = now() + (input.budgetMs ?? INSTANCE_LOAD_BUDGET_MS);
  const rows: InstanceRow[] = [];
  const placeOf = new Map<string, number>();
  const offered = new Set<string>();
  let cursor: string | null = null;
  for (;;) {
    if (now() > deadline) return { kind: 'degraded' };
    const response = await reads.instances(
      request,
      entryId,
      cursor,
      INSTANCE_PAGE_LIMIT,
    );
    if (response.status !== 200) return { kind: 'response', response };
    const parsed = CompositionInstancePageSchema.safeParse(
      await jsonOf(response),
    );
    if (
      !parsed.success ||
      parsed.data.revisionId !== revisionId ||
      !compositionInstancesPageHonours(parsed.data, {
        ...(cursor === null ? {} : { cursor }),
        limit: INSTANCE_PAGE_LIMIT,
      })
    )
      return { kind: 'unverified' };
    for (const row of parsed.data.items) {
      const place = placeOf.get(row.path);
      if (place === undefined) {
        placeOf.set(row.path, rows.length);
        rows.push(row);
      } else if (BigInt(row.version) >= BigInt(rows[place]!.version)) {
        rows[place] = row;
      }
    }
    cursor = parsed.data.nextCursor;
    if (cursor === null) return { kind: 'rows', rows };
    if (offered.has(cursor)) return { kind: 'degraded' };
    offered.add(cursor);
  }
};
