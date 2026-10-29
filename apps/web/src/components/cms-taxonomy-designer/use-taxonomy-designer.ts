import { retryable } from '../../lib/retryable-import';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useCmsTemplateRateWait } from '../cms-composition/cms-template-rate-wait';
import { TAXONOMY_RESULT_HEADING_ID } from './taxonomy-designer-ids';
import { buildTaxonomyVersionRequest } from './taxonomy-designer-request';
import type { TaxonomyFormStatus } from './taxonomy-designer-status';
import {
  MODULE_UNAVAILABLE_COPY,
  importModule,
  isModuleUnavailable,
} from '../../lib/module-unavailable';
import type { submitTaxonomyVersion } from './taxonomy-designer-submit';
import type { reconcileUnknownVersionOutcome as reconcileOutcome } from './taxonomy-outcome-reconcile';
import {
  readTaxonomyVersions,
  type TaxonomyVersionFacts,
} from './taxonomy-versions-read';
import type { CanonicalDomain, TaxonomyShape } from './taxonomy-vocabulary';
import {
  useTaxonomyConflict,
  type TaxonomyBaseIdentity,
} from './use-taxonomy-conflict';

/** The seams a test replaces: the dynamic imports of the write and of the unknown-outcome check. */
export const taxonomySubmitImporters = {
  submit: retryable(() => import('./taxonomy-designer-submit')),
  reconcile: retryable(() => import('./taxonomy-outcome-reconcile')),
};

/**
 * The write runs only when the person saves, so it loads then, not with the page (P2-S11-AC-106).
 * A chunk that cannot be fetched rejects with `ModuleUnavailableError`: nothing was sent.
 */
export const submitOnDemand: typeof submitTaxonomyVersion = async (...input) =>
  (
    await importModule(() => taxonomySubmitImporters.submit())
  ).submitTaxonomyVersion(...input);

export interface TaxonomyDesignerOptions {
  /** The vocabulary's newest version when editing; null for a new key. */
  readonly latest: TaxonomyVersionFacts | null;
  readonly csrfToken: string;
  /** Seams for a test. */
  readonly submit?: typeof submitTaxonomyVersion | undefined;
  readonly readVersions?: typeof readTaxonomyVersions | undefined;
}

const identityOf = (version: TaxonomyVersionFacts): TaxonomyBaseIdentity => ({
  id: version.id,
  version: version.version,
  contentHash: version.contentHash,
});

const toggled = <T>(list: readonly T[], value: T): T[] =>
  list.includes(value)
    ? list.filter((entry) => entry !== value)
    : [...list, value];

/** All state and commands of the vocabulary designer; the components only render. */
export const useTaxonomyDesigner = ({
  latest,
  csrfToken,
  submit = submitOnDemand,
  readVersions = readTaxonomyVersions,
}: TaxonomyDesignerOptions) => {
  const [taxonomyKey, setTaxonomyKey] = useState(latest?.taxonomyKey ?? '');
  const [shape, setShape] = useState<TaxonomyShape | ''>(latest?.shape ?? '');
  const [typeKeys, setTypeKeys] = useState<readonly string[]>(
    latest?.allowedTypeKeys ?? [],
  );
  const [fieldKeys, setFieldKeys] = useState<readonly string[]>(
    latest?.allowedFieldKeys ?? [],
  );
  const [domains, setDomains] = useState<readonly CanonicalDomain[]>(
    latest?.canonicalOverlapDomains ?? [],
  );
  const [base, setBase] = useState<TaxonomyVersionFacts | null>(latest);
  const [status, setStatus] = useState<TaxonomyFormStatus>({ kind: 'idle' });
  const summaryRef = useRef<HTMLDivElement>(null);
  const attemptRef = useRef<{ body: string; key: string } | null>(null);
  const inFlightRef = useRef(false);
  const sentRef = useRef('');
  const rateWait = useCmsTemplateRateWait();
  const taxonomyId = base?.taxonomyId ?? null;
  const conflict = useTaxonomyConflict(
    taxonomyId,
    base === null ? null : identityOf(base),
    readVersions,
  );
  const { check: checkLatest, clear: clearConflict } = conflict;

  useEffect(() => {
    // The named result heading takes focus (FE03 :1108); the region is the fallback.
    if (status.kind !== 'idle' && status.kind !== 'pending')
      (
        document.getElementById(TAXONOMY_RESULT_HEADING_ID) ??
        summaryRef.current
      )?.focus();
  }, [status]);

  const done = status.kind === 'created';
  const blocked = csrfToken.length === 0 || rateWait.waiting || done;

  const onSubmit = useCallback(async (): Promise<void> => {
    if (blocked || inFlightRef.current) return;
    const prepared = buildTaxonomyVersionRequest({
      taxonomyKey,
      shape,
      typeKeys,
      fieldKeys,
      domains,
      expectedVersion: base?.version ?? null,
    });
    if (!prepared.ok) {
      setStatus({
        kind: 'invalid',
        items: prepared.issues.map(({ message, field }) => ({
          message,
          field,
        })),
      });
      return;
    }
    // The fields this attempt sends; remembered once a save is CONFIRMED, so a value typed after it is flagged (FE03 1048).
    const snapshot = JSON.stringify([
      taxonomyKey,
      shape,
      typeKeys,
      fieldKeys,
      domains,
    ]);
    // The same unchanged body reuses its key only while the outcome is unknown.
    const key =
      attemptRef.current?.body === prepared.body
        ? attemptRef.current.key
        : crypto.randomUUID();
    attemptRef.current = { body: prepared.body, key };
    inFlightRef.current = true;
    setStatus({ kind: 'pending' });
    let result: Awaited<ReturnType<typeof submit>>;
    try {
      result = await submit(prepared.value, csrfToken, key);
    } catch (error) {
      inFlightRef.current = false;
      attemptRef.current = null;
      if (!isModuleUnavailable(error)) throw error;
      // The write's chunk could not load: nothing was sent, the values are kept.
      setStatus({
        kind: 'invalid',
        items: [{ message: MODULE_UNAVAILABLE_COPY, field: 'form' }],
      });
      return;
    }
    inFlightRef.current = false;
    if (result.kind !== 'uncertain') attemptRef.current = null;
    if (
      result.kind === 'rejected' &&
      result.status === 429 &&
      result.retryAfterSeconds !== undefined
    )
      rateWait.start(result.retryAfterSeconds);
    if (result.kind === 'created') {
      sentRef.current = snapshot;
      setStatus({ kind: 'created', resource: result.resource });
      return;
    }
    setStatus({ kind: 'result', result });
    if (result.kind !== 'uncertain' || taxonomyId === null) return;
    // FE03 :1050/:1173: an unknown outcome is checked against the server before any
    // retry, so a committed write is never offered as "newer" and saved twice.
    let reconcileUnknownVersionOutcome: typeof reconcileOutcome;
    try {
      ({ reconcileUnknownVersionOutcome } = await importModule(() =>
        taxonomySubmitImporters.reconcile(),
      ));
    } catch {
      // The check cannot load: the unknown outcome stays unknown and the person sees it.
      return;
    }
    const verdict = reconcileUnknownVersionOutcome(
      prepared.value,
      await checkLatest(),
    );
    if (verdict.kind === 'created') {
      attemptRef.current = null;
      clearConflict();
      sentRef.current = snapshot;
      setStatus({ kind: 'created', resource: verdict.resource });
    } else if (verdict.kind === 'not-saved') {
      clearConflict();
      setStatus({ kind: 'unsaved' });
    }
  }, [
    base,
    blocked,
    checkLatest,
    clearConflict,
    csrfToken,
    domains,
    fieldKeys,
    rateWait,
    shape,
    submit,
    taxonomyId,
    taxonomyKey,
    typeKeys,
  ]);

  const loaded =
    conflict.state.kind === 'loaded' ? conflict.state.latest : null;
  const rebase = useCallback((): void => {
    if (loaded === null) return;
    setBase(loaded);
    conflict.clear();
    setStatus({ kind: 'idle' });
  }, [conflict, loaded]);
  const discard = useCallback((): void => {
    if (loaded === null) return;
    setShape(loaded.shape);
    setTypeKeys(loaded.allowedTypeKeys);
    setFieldKeys(loaded.allowedFieldKeys);
    setDomains(loaded.canonicalOverlapDomains);
    setBase(loaded);
    conflict.clear();
    setStatus({ kind: 'idle' });
  }, [conflict, loaded]);

  return {
    taxonomyKey,
    setTaxonomyKey,
    shape,
    setShape,
    typeKeys,
    setTypeKeys,
    fieldKeys,
    setFieldKeys,
    domains,
    toggleDomain: useCallback(
      (domain: CanonicalDomain): void =>
        setDomains((current) => toggled(current, domain)),
      [],
    ),
    base,
    status,
    summaryRef,
    blocked,
    pending: status.kind === 'pending',
    done,
    /** True once a save is confirmed and the form now differs from what that save carried. */
    lateEdits:
      done &&
      JSON.stringify([taxonomyKey, shape, typeKeys, fieldKeys, domains]) !==
        sentRef.current,
    onSubmit,
    conflict: { ...conflict, rebase, discard },
    showConflict:
      taxonomyId !== null &&
      status.kind === 'result' &&
      (status.result.kind === 'conflict' || status.result.kind === 'uncertain'),
  };
};
