import { retryable } from '../../lib/retryable-import';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  importModule,
  isModuleUnavailable,
} from '../../lib/module-unavailable';
import type {
  LocaleSourceRefreshResult,
  LocaleSourceSnapshot,
  refreshLocaleSource,
} from './locale-source-refresh';

const loadRefresh = retryable(() => import('./locale-source-refresh'));

/** The refresh runs only after a 409, so it loads then, not with the form (P2-S11-AC-106). */
const refreshOnDemand: typeof refreshLocaleSource = async (input) => {
  try {
    return (await importModule(loadRefresh)).refreshLocaleSource(input);
  } catch (error) {
    if (!isModuleUnavailable(error)) throw error;
    // The review cannot load: the form says the source could not be read and offers it again.
    return { kind: 'failed', status: null };
  }
};

export type LocaleSourceReviewState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'reading' }
  | LocaleSourceRefreshResult;

interface Options {
  readonly entryId: string;
  readonly sourceLocale: string;
  /** The localizable fields whose source text the form displays. */
  readonly fieldIds: readonly string[];
  readonly refresh?: typeof refreshLocaleSource | undefined;
}

/**
 * The review gate after a 409 (FE03 :891): the entry or its source moved, so the form refetches the draft
 * detail and holds saving until the person adopts what it read. Unmounting aborts the owned read, and a late
 * answer of an earlier read is dropped.
 */
export const useLocaleSourceReview = ({
  entryId,
  sourceLocale,
  fieldIds,
  refresh = refreshOnDemand,
}: Options) => {
  const [required, setRequired] = useState(false);
  const [state, setState] = useState<LocaleSourceReviewState>({
    kind: 'idle',
  });
  const sequenceRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      sequenceRef.current += 1;
      controllerRef.current?.abort();
    },
    [],
  );

  const read = useCallback(async (): Promise<void> => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const sequence = ++sequenceRef.current;
    setState({ kind: 'reading' });
    const result = await refresh({
      entryId,
      sourceLocale,
      fieldIds,
      signal: controller.signal,
    });
    if (sequenceRef.current === sequence) setState(result);
  }, [entryId, fieldIds, refresh, sourceLocale]);

  const require = useCallback((): void => {
    setRequired(true);
    void read();
  }, [read]);

  const clear = useCallback((): void => {
    sequenceRef.current += 1;
    controllerRef.current?.abort();
    setRequired(false);
    setState({ kind: 'idle' });
  }, []);

  /** The verified snapshot to adopt, or null while none has been read. */
  const snapshot: LocaleSourceSnapshot | null =
    state.kind === 'ready' ? state.snapshot : null;

  return { required, state, snapshot, require, read, clear };
};
