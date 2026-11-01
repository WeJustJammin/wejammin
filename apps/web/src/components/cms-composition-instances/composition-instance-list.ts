import { readJson, type ReadOptions } from './composition-transport';
import type { InstanceRow } from './composition-types';

/*
 * The browser read of the entry's instance list (`cmsCompositionInstancesRead`, DEC-206; the first-party proxy is
 * `GET /api/v1/cms/entries/{entryId}/compositions`). It is zod-free (FE03 AC261): the proxy has already parsed the strict
 * page, so this layer repeats only the binding a caller relies on, by structure, and fails closed. It follows the opaque
 * signed cursor until it ends, like the page loader (`load-composition-instances.ts`), and the same two guards apply: a
 * cursor offered twice, and a time budget. A list that cannot be completed is a failure, never a truncated list.
 */
export const INSTANCE_PAGE_LIMIT = 50;
export const INSTANCE_LIST_BUDGET_MS = 20_000;
const LIVE_STATES: ReadonlySet<string> = new Set([
  'draft',
  'active',
  'pending_diff',
]);

type Json = Readonly<Record<string, unknown>>;
const isRecord = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isRow = (value: unknown, revisionId: string): value is InstanceRow =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.path === 'string' &&
  typeof value.version === 'string' &&
  /^[1-9]\d{0,18}$/u.test(value.version) &&
  typeof value.state === 'string' &&
  LIVE_STATES.has(value.state) &&
  value.revisionId === revisionId &&
  Number.isInteger(value.position) &&
  typeof value.blockKey === 'string' &&
  (value.linkMode === 'linked' || value.linkMode === 'detached');

export type InstanceListAnswer =
  | { readonly kind: 'rows'; readonly rows: readonly InstanceRow[] }
  | { readonly kind: 'failed' };

export const instanceListPath = (
  entryId: string,
  cursor: string | null,
): string =>
  `/api/v1/cms/entries/${encodeURIComponent(entryId)}/compositions?limit=${INSTANCE_PAGE_LIMIT}${
    cursor === null ? '' : `&cursor=${encodeURIComponent(cursor)}`
  }`;

/** Every row of the entry's current draft revision `revisionId`, in the render order the read answers. */
export const readInstanceList = async (
  entryId: string,
  revisionId: string,
  options: ReadOptions & {
    readonly now?: () => number;
    readonly budgetMs?: number;
  } = {},
): Promise<InstanceListAnswer> => {
  const now = options.now ?? Date.now;
  const deadline = now() + (options.budgetMs ?? INSTANCE_LIST_BUDGET_MS);
  const rows: InstanceRow[] = [];
  const placeOf = new Map<string, number>();
  const offered = new Set<string>();
  let cursor: string | null = null;
  for (;;) {
    if (now() > deadline) return { kind: 'failed' };
    const answer = await readJson(instanceListPath(entryId, cursor), options);
    if (answer.kind !== 'ok' || !isRecord(answer.body))
      return { kind: 'failed' };
    const { revisionId: page, items, nextCursor } = answer.body;
    if (
      page !== revisionId ||
      !Array.isArray(items) ||
      items.length > INSTANCE_PAGE_LIMIT ||
      !items.every((item) => isRow(item, revisionId)) ||
      !(
        nextCursor === null ||
        (typeof nextCursor === 'string' && nextCursor.length <= 512)
      )
    )
      return { kind: 'failed' };
    for (const item of items as InstanceRow[]) {
      const place = placeOf.get(item.path);
      if (place === undefined) {
        placeOf.set(item.path, rows.length);
        rows.push(item);
      } else if (BigInt(item.version) >= BigInt(rows[place]!.version)) {
        rows[place] = item;
      }
    }
    if (nextCursor === null) return { kind: 'rows', rows };
    if (offered.has(nextCursor)) return { kind: 'failed' };
    offered.add(nextCursor);
    cursor = nextCursor;
  }
};
