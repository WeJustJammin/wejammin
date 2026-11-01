import type { TaxonomySelectorPage } from '@wejammin/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';

import { rateLimitMessage } from '../../lib/rate-limit-message';
import { readCmsTaxonomySelector } from './cms-taxonomy-selector-read';

/*
 * The connected read of the CMS-03C-17 taxonomy selector (BE03c; FE03 "Network and retry
 * contract"). The entry type key, the field key and the locale are the read scope, and the
 * page is only ever the strict verified page of the request this control made. The scope
 * keys, the injected fetch and the reload token are the dependencies, never the context
 * object a host rebuilds on each text edit. A scope change drops the shown page at once, so
 * a page of another scope can never resurface; a same-scope reload may keep the last
 * verified page but marks it stale, so no unverified choice can be made. Every read is
 * aborted and generation-fenced: an answer that is no longer current changes nothing.
 */

/** The planned optional CmsFieldEditor prop: the scope, the boundary and the reload token. */
export interface TaxonomyContextInput {
  readonly typeKey: string;
  readonly locale: string;
  /** Defaults to the global fetch; a test injects its own boundary here. */
  readonly fetcher?: typeof fetch | undefined;
  /** Bumped when the host learns a term is no longer available: reload from the first page. */
  readonly refreshToken?: number | undefined;
}

/** The one fixed sentence of a state; nothing here is taken from a response. */
export type TaxonomyReadNotice =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready' }
  | { readonly kind: 'empty' }
  | { readonly kind: 'signed_out' }
  | { readonly kind: 'forbidden' }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'degraded' }
  | { readonly kind: 'rate_limited' };

export interface TaxonomyReadState {
  /** The verified page to render, or null when nothing is verified for this scope. */
  readonly page: TaxonomySelectorPage | null;
  /** True when the shown page is not verified by the latest answer: its choices stay closed. */
  readonly stale: boolean;
  readonly notice: TaxonomyReadNotice;
  /** The cursor of the page shown or of the read in flight: null is the first page. */
  readonly cursor: string | null;
  readonly nextCursor: string | null;
  /** A 429's remaining wait in whole seconds; null while no wait is observed. */
  readonly remainingSeconds: number | null;
  /** True until a 429's stated wait has elapsed: the retry is held closed. */
  readonly waiting: boolean;
  readonly canLoadNext: boolean;
  readonly canStartAgain: boolean;
  readonly canRetry: boolean;
  readonly loadNext: () => void;
  readonly startAgain: () => void;
  readonly retry: () => void;
}

/** The contract's default page size (BE03c: default 50, maximum 100). */
const PAGE_LIMIT = 50;

const scopeKeyOf = (
  typeKey: string,
  fieldKey: string,
  locale: string,
): string => typeKey + '|' + fieldKey + '|' + locale;

const refusedNotice = (status: 401 | 403 | 404): TaxonomyReadNotice =>
  status === 401
    ? { kind: 'signed_out' }
    : status === 403
      ? { kind: 'forbidden' }
      : { kind: 'not_found' };

export const useTaxonomyRead = (
  fieldKey: string,
  context: TaxonomyContextInput,
): TaxonomyReadState => {
  const { typeKey, locale } = context;
  const refreshToken = context.refreshToken ?? 0;
  const fetcher = context.fetcher ?? fetch;
  const scope = scopeKeyOf(typeKey, fieldKey, locale);
  const effectKey = scope + '|' + String(refreshToken);

  const [page, setPage] = useState<TaxonomySelectorPage | null>(null);
  const [stale, setStale] = useState(false);
  const [notice, setNotice] = useState<TaxonomyReadNotice>({ kind: 'loading' });
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [failedCursor, setFailedCursor] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  const pageRef = useRef<TaxonomySelectorPage | null>(null);
  const generation = useRef(0);
  const aborter = useRef<AbortController | null>(null);
  const liveScope = useRef(scope);
  const liveEffect = useRef<string | null>(null);
  const liveFetcher = useRef(fetcher);

  const waiting = remaining !== null && remaining > 0;

  const start = useCallback(
    (target: string | null, dropPage: boolean): void => {
      const current = (generation.current += 1);
      aborter.current?.abort();
      const read = new AbortController();
      aborter.current = read;
      if (dropPage) {
        pageRef.current = null;
        setPage(null);
        setNextCursor(null);
        setStale(false);
      }
      setCursor(target);
      setFailedCursor(target);
      setRemaining(null);
      // A page kept in view while a read is in flight is no longer a verified choice.
      setStale(pageRef.current !== null);
      setNotice({ kind: 'loading' });
      void (async (): Promise<void> => {
        const answer = await readCmsTaxonomySelector(
          { typeKey, fieldKey, locale, limit: PAGE_LIMIT, cursor: target },
          fetcher,
          read.signal,
        );
        if (generation.current !== current || read.signal.aborted) return;
        if (answer.kind === 'loaded') {
          if (answer.page.items.length === 0) {
            pageRef.current = answer.page;
            setPage(answer.page);
            setNextCursor(answer.page.nextCursor);
            setStale(false);
            setNotice({ kind: 'empty' });
            return;
          }
          pageRef.current = answer.page;
          setPage(answer.page);
          setNextCursor(answer.page.nextCursor);
          setStale(false);
          setNotice({ kind: 'ready' });
          return;
        }
        if (
          answer.kind === 'rejected' &&
          (answer.status === 401 ||
            answer.status === 403 ||
            answer.status === 404)
        ) {
          pageRef.current = null;
          setPage(null);
          setNextCursor(null);
          setStale(false);
          setNotice(refusedNotice(answer.status));
          return;
        }
        setStale(pageRef.current !== null);
        if (answer.kind === 'rejected' && answer.status === 429) {
          setNotice({ kind: 'rate_limited' });
          setRemaining(answer.retryAfterSeconds);
          return;
        }
        setNotice({ kind: 'degraded' });
      })();
    },
    [fetcher, fieldKey, locale, typeKey],
  );

  useEffect((): void => {
    const sameScope = liveScope.current === scope;
    // An aborted read no longer belongs to this key: the next setup must start fresh,
    // which is what React.StrictMode's development remount (setup, cleanup, setup) needs.
    const aborted = aborter.current?.signal.aborted === true;
    if (
      !aborted &&
      liveEffect.current === effectKey &&
      sameScope &&
      liveFetcher.current === fetcher
    )
      return;
    const scopeChanged = !sameScope;
    liveEffect.current = effectKey;
    liveScope.current = scope;
    liveFetcher.current = fetcher;
    start(null, scopeChanged);
  }, [effectKey, fetcher, scope, start]);

  useEffect((): (() => void) => {
    if (!waiting) return () => undefined;
    const timer: ReturnType<typeof setInterval> = setInterval((): void => {
      setRemaining((value) => (value === null ? null : Math.max(value - 1, 0)));
    }, 1_000);
    return (): void => {
      clearInterval(timer);
    };
  }, [waiting]);

  useEffect((): (() => void) => {
    return (): void => {
      aborter.current?.abort();
    };
  }, []);

  const loadNext = useCallback((): void => {
    if (!waiting && nextCursor !== null) start(nextCursor, false);
  }, [nextCursor, start, waiting]);

  const startAgain = useCallback((): void => {
    if (!waiting) start(null, false);
  }, [start, waiting]);

  const retry = useCallback((): void => {
    if (!waiting) start(failedCursor, false);
  }, [failedCursor, start, waiting]);

  return {
    page,
    stale,
    notice,
    cursor,
    nextCursor,
    remainingSeconds: remaining,
    waiting,
    canLoadNext:
      page !== null && nextCursor !== null && notice.kind === 'ready',
    canStartAgain: page !== null && cursor !== null,
    canRetry: notice.kind === 'degraded' || notice.kind === 'rate_limited',
    loadNext,
    startAgain,
    retry,
  };
};

/** The announcement of a rate-limited read: the remaining wait, or "wait a moment". */
export const rateLimitedCopy = (remainingSeconds: number | null): string =>
  remainingSeconds !== null && remainingSeconds > 0
    ? rateLimitMessage(remainingSeconds)
    : rateLimitMessage(null);
