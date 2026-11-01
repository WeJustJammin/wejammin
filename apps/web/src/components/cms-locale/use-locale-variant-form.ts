import { retryable } from '../../lib/retryable-import';
import type { JsonValue } from '@wejammin/contracts';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useCmsTemplateRateWait } from '../cms-composition/cms-template-rate-wait';
import type { refreshLocaleSource } from './locale-source-refresh';
import { LOCALE_RESULT_HEADING_ID } from './locale-variant-copy';
import {
  buildLocaleVariantRequest,
  type LocaleIssue,
} from './locale-variant-request';
import {
  MODULE_UNAVAILABLE_COPY,
  importModule,
  isModuleUnavailable,
} from '../../lib/module-unavailable';
import type {
  LocaleSubmitResult,
  SavedLocaleVariant,
  submitLocaleVariant,
} from './locale-variant-submit';
import type {
  LocaleEntryFacts,
  LocaleFieldInit,
  LocaleResolution,
  LocaleVariantInit,
  LocaleVariantState,
} from './locale-variant-types';
import { useLocaleSourceReview } from './use-locale-source-review';

/** The seam a test replaces: the dynamic import of the save. */
export const localeSubmitImporters = {
  submit: retryable(() => import('./locale-variant-submit')),
};

/**
 * The save runs only when the person saves, so it loads then, not with the form (P2-S11-AC-106).
 * A chunk that cannot be fetched rejects with `ModuleUnavailableError`: nothing was sent.
 */
export const submitOnDemand: typeof submitLocaleVariant = async (...input) =>
  (
    await importModule(() => localeSubmitImporters.submit())
  ).submitLocaleVariant(...input);

export type LocaleStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'invalid'; readonly issues: readonly LocaleIssue[] }
  | { readonly kind: 'pending' }
  | { readonly kind: 'saved'; readonly saved: SavedLocaleVariant }
  | {
      readonly kind: 'result';
      readonly result: Exclude<LocaleSubmitResult, { kind: 'saved' }>;
    };

export interface LocaleFormOptions {
  readonly entry: LocaleEntryFacts;
  readonly fallbackChain: readonly string[];
  readonly fields: readonly LocaleFieldInit[];
  readonly resolutions: readonly LocaleResolution[];
  /** The current variant: the form starts from its stored values and stale ids (DEC-205). */
  readonly variant: LocaleVariantInit;
  readonly csrfToken: string;
  readonly submit?: typeof submitLocaleVariant | undefined;
  readonly refresh?: typeof refreshLocaleSource | undefined;
}

/** All state and commands of the locale variant form; the components only render. */
export const useLocaleVariantForm = ({
  entry,
  fallbackChain,
  fields,
  resolutions,
  variant,
  csrfToken,
  submit = submitOnDemand,
  refresh,
}: LocaleFormOptions) => {
  const [values, setValues] = useState<
    Readonly<Record<string, JsonValue | null>>
  >(() => ({ ...variant.values }));
  const [variantState, setVariantState] = useState<LocaleVariantState>(
    variant.state,
  );
  const [inputErrors, setInputErrors] = useState<
    Readonly<Record<string, string>>
  >({});
  const [chain, setChain] = useState(fallbackChain);
  const [source, setSource] = useState({
    version: entry.version,
    sourceRevisionId: entry.sourceRevisionId,
    sourceHash: entry.sourceHash,
  });
  const [texts, setTexts] = useState<Readonly<Record<string, string | null>>>(
    () =>
      Object.fromEntries(
        fields.map((field) => [field.descriptor.fieldId, field.sourceText]),
      ),
  );
  const [status, setStatus] = useState<LocaleStatus>({ kind: 'idle' });
  const [savedIds, setSavedIds] = useState<readonly string[]>([]);
  const [staleIds, setStaleIds] = useState<readonly string[]>(
    variant.staleFieldIds,
  );
  const attemptRef = useRef<{ body: string; key: string } | null>(null);
  const inFlightRef = useRef(false);
  const sentValuesRef = useRef<Readonly<Record<string, JsonValue | null>>>({});
  const mountedRef = useRef(true);
  const sequenceRef = useRef(0);
  const rateWait = useCmsTemplateRateWait();
  const textFieldIds = useMemo(
    () =>
      fields
        .filter((field) => field.mode === 'localized')
        .map((field) => field.descriptor.fieldId),
    [fields],
  );
  const review = useLocaleSourceReview({
    entryId: entry.entryId,
    sourceLocale: entry.sourceLocale,
    fieldIds: textFieldIds,
    refresh,
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      sequenceRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (status.kind !== 'idle' && status.kind !== 'pending')
      document.getElementById(LOCALE_RESULT_HEADING_ID)?.focus();
  }, [status]);

  const edited = useCallback((): void => {
    // The conflict notice stays until the source is adopted: editing does not lift the review gate.
    // A save in flight stays pending: its fields are editable meanwhile (FE03 1048) but its state is not theirs to clear.
    setStatus((current) =>
      current.kind === 'pending' ||
      (current.kind === 'result' &&
        (current.result.kind === 'conflict' ||
          current.result.kind === 'limit_reached'))
        ? current
        : { kind: 'idle' },
    );
  }, []);

  const change = useCallback(
    (fieldId: string, value: JsonValue | null): void => {
      setValues((current) => ({ ...current, [fieldId]: value }));
      edited();
    },
    [edited],
  );
  const inputError = useCallback(
    (fieldId: string, message: string | null): void =>
      setInputErrors((current) => {
        const rest = Object.fromEntries(
          Object.entries(current).filter(([id]) => id !== fieldId),
        );
        return message === null ? rest : { ...rest, [fieldId]: message };
      }),
    [],
  );

  const blocked = csrfToken.length === 0 || rateWait.waiting || review.required;

  const save = useCallback(async (): Promise<void> => {
    if (!mountedRef.current || blocked || inFlightRef.current) return;
    const prepared = buildLocaleVariantRequest(
      { fields, values, fallbackChain: chain, inputErrors },
      { ...entry, ...source },
    );
    if (!prepared.ok) {
      setStatus({ kind: 'invalid', issues: prepared.issues });
      return;
    }
    // The same unchanged request reuses its key only while the outcome is unknown.
    const key =
      attemptRef.current?.body === prepared.body
        ? attemptRef.current.key
        : crypto.randomUUID();
    attemptRef.current = { body: prepared.body, key };
    inFlightRef.current = true;
    const sequence = ++sequenceRef.current;
    setStatus({ kind: 'pending' });
    let result: Awaited<ReturnType<typeof submit>>;
    try {
      result = await submit(prepared.value, csrfToken, key);
    } catch (error) {
      inFlightRef.current = false;
      attemptRef.current = null;
      if (!isModuleUnavailable(error)) throw error;
      // The save's chunk could not load: nothing was sent, the translation is kept.
      if (mountedRef.current && sequenceRef.current === sequence)
        setStatus({
          kind: 'invalid',
          issues: [
            {
              code: 'module_unavailable',
              message: MODULE_UNAVAILABLE_COPY,
              target: 'form',
            },
          ],
        });
      return;
    }
    if (!mountedRef.current || sequenceRef.current !== sequence) return;
    inFlightRef.current = false;
    if (result.kind !== 'uncertain') attemptRef.current = null;
    if (result.kind === 'saved') {
      setSource((current) => ({ ...current, version: result.saved.version }));
      // The confirmed save carried these values; a later attempt that is pending or failed has not.
      sentValuesRef.current = values;
      setSavedIds(result.saved.savedFieldIds);
      setStaleIds(result.saved.staleFieldIds);
      // A save writes a new draft, whatever the state was before (BE03c 1532).
      setVariantState('draft');
      setStatus({ kind: 'saved', saved: result.saved });
      return;
    }
    if (result.kind === 'chain_mismatch') setChain(result.activeFallbackChain);
    if (result.kind === 'conflict' || result.kind === 'limit_reached')
      review.require();
    if (
      result.kind === 'rejected' &&
      result.status === 429 &&
      result.retryAfterSeconds !== undefined
    )
      rateWait.start(result.retryAfterSeconds);
    setStatus({ kind: 'result', result });
  }, [
    blocked,
    chain,
    csrfToken,
    entry,
    fields,
    inputErrors,
    rateWait,
    review,
    source,
    submit,
    values,
  ]);

  /** Adopt the refetched version, source revision, fingerprint and source text. */
  const adopt = useCallback((): void => {
    const snapshot = review.snapshot;
    if (snapshot === null) return;
    setSource({
      version: snapshot.version,
      sourceRevisionId: snapshot.sourceRevisionId,
      sourceHash: snapshot.sourceHash,
    });
    setTexts((current) => ({ ...current, ...snapshot.texts }));
    review.clear();
    setStatus({ kind: 'idle' });
  }, [review]);

  const fieldIssues = status.kind === 'invalid' ? status.issues : [];
  // A field changed since the send is unsent, so it is not shown as saved.
  const sent = JSON.stringify(sentValuesRef.current);
  const sentSaved = savedIds.filter(
    (id) =>
      JSON.stringify(values[id]) === JSON.stringify(sentValuesRef.current[id]),
  );
  const anyStale =
    staleIds.length > 0 || resolutions.some((resolution) => resolution.stale);
  return {
    values,
    variantState,
    chain,
    version: source.version,
    // Until adopted, the refetched text sits beside the old fields so the change is visible.
    texts:
      review.snapshot === null ? texts : { ...texts, ...review.snapshot.texts },
    status,
    savedIds: sentSaved,
    lateEdits: status.kind === 'saved' && JSON.stringify(values) !== sent,
    staleIds,
    anyStale,
    pending: status.kind === 'pending',
    blocked,
    rateWaiting: rateWait.waiting,
    review,
    issuesFor: (fieldId: string) =>
      fieldIssues
        .filter((issue) => issue.target === fieldId)
        .map((issue) => ({
          code: issue.code,
          message: issue.detail ?? issue.message,
        })),
    change,
    inputError,
    save,
    adopt,
  };
};
