import { useCallback, useEffect, useRef, useState } from 'react';

import {
  readNestablePatterns,
  type NestablePattern,
  type NestableReadResult,
} from './pattern-nestable-read';

/** The seam of the read: the content types, the cursor of the page before (null for the first) and the cancel signal. */
export type ReadNestable = (
  typeIds: readonly string[],
  cursor: string | null,
  controls: { readonly signal: AbortSignal },
) => Promise<NestableReadResult>;

export const defaultReadNestable: ReadNestable = (typeIds, cursor, controls) =>
  readNestablePatterns(typeIds, cursor, fetch, controls);

export type NestableFailure = Readonly<{
  /** The refusal status, or null for an unavailable dependency. */
  status: number | null;
  retryAfterSeconds: number | null;
}>;
export interface NestableListState {
  readonly status:
    'idle' | 'loading' | 'ready' | 'loading_more' | 'failed' | 'more_failed';
  readonly items: readonly NestablePattern[];
  /** The opaque signed cursor of the next page; component state only. */
  readonly nextCursor: string | null;
  /** The listing restarted from the first page because its cursor no longer opened. */
  readonly restarted: boolean;
  readonly failure: NestableFailure | null;
}

const IDLE: NestableListState = {
  status: 'idle',
  items: [],
  nextCursor: null,
  restarted: false,
  failure: null,
};

const failureOf = (result: NestableReadResult): NestableFailure => ({
  status: result.kind === 'rejected' ? result.status : null,
  retryAfterSeconds:
    result.kind === 'rejected' ? (result.retryAfterSeconds ?? null) : null,
});

/**
 * The nestable patterns of the content types the pattern being designed lists (cmsPatternNestableRead, DEC-196): the first
 * page whenever the type set changes, later pages on request. A change of the type set cancels the read in flight and drops
 * the list (a stale answer is never shown); a cursor that no longer opens (400) restarts the listing from the first page.
 */
export const useNestablePatterns = (
  typeIds: readonly string[],
  read: ReadNestable = defaultReadNestable,
) => {
  const [state, setState] = useState<NestableListState>(IDLE);
  const controller = useRef<AbortController | null>(null);
  const types = useRef(typeIds);
  types.current = typeIds;
  const typeKey = typeIds.join(',');

  const run = useCallback(
    async (
      cursor: string | null,
      listed: readonly NestablePattern[],
      restarted: boolean,
    ): Promise<void> => {
      controller.current?.abort();
      const own = new AbortController();
      controller.current = own;
      setState((current) => ({
        ...current,
        status: cursor === null ? 'loading' : 'loading_more',
        failure: null,
        restarted,
        ...(cursor === null ? { items: [], nextCursor: null } : {}),
      }));
      const result = await read(types.current, cursor, { signal: own.signal });
      if (own.signal.aborted) return;
      if (result.kind === 'page') {
        setState({
          status: 'ready',
          items: [...listed, ...result.page.items],
          nextCursor: result.page.nextCursor,
          restarted,
          failure: null,
        });
        return;
      }
      if (
        cursor !== null &&
        result.kind === 'rejected' &&
        result.status === 400
      ) {
        await run(null, [], true);
        return;
      }
      setState({
        status: cursor === null ? 'failed' : 'more_failed',
        items: cursor === null ? [] : listed,
        nextCursor: cursor,
        restarted: false,
        failure: failureOf(result),
      });
    },
    [read],
  );

  useEffect(() => {
    if (typeKey === '') {
      controller.current?.abort();
      setState(IDLE);
      return undefined;
    }
    void run(null, [], false);
    return () => controller.current?.abort();
  }, [run, typeKey]);

  return {
    state,
    retry: useCallback(() => void run(null, [], false), [run]),
    loadMore: useCallback(
      () => void run(state.nextCursor, state.items, false),
      [run, state.items, state.nextCursor],
    ),
  };
};
