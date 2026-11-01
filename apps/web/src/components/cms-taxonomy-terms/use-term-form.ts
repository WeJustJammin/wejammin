import { retryable } from '../../lib/retryable-import';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useCmsTemplateRateWait } from '../cms-composition/cms-template-rate-wait';
import type { TaxonomyShape } from '../cms-taxonomy-designer/taxonomy-vocabulary';
import type { TermFacts } from './taxonomy-terms-read';
import {
  buildTermActionRequest,
  type TermAction,
  type TermFormFields,
  type TermIssue,
} from './term-action-request';
import {
  MODULE_UNAVAILABLE_COPY,
  importModule,
  isModuleUnavailable,
} from '../../lib/module-unavailable';
import type { TermActionResult, submitTermAction } from './term-action-submit';

/** The seam a test replaces: the dynamic import of the write. */
export const termSubmitImporters = {
  submit: retryable(() => import('./term-action-submit')),
};

/**
 * The write runs only when the person acts, so it loads then, not with the page (P2-S11-AC-106).
 * A chunk that cannot be fetched rejects with `ModuleUnavailableError`: nothing was sent.
 */
export const submitOnDemand: typeof submitTermAction = async (...input) =>
  (await importModule(() => termSubmitImporters.submit())).submitTermAction(
    ...input,
  );
import type { ActiveVersion } from './use-term-list';

export const TERM_RESULT_HEADING_ID = 'cms-term-result-heading';
export const TERM_FORM_HEADING_ID = 'cms-term-form-heading';

export interface LabelRowState {
  /** A React key only; never serialized. */
  readonly id: string;
  readonly locale: string;
  readonly label: string;
}

export interface TermFormState {
  readonly action: TermAction;
  readonly target: TermFacts | null;
  readonly termKey: string;
  readonly parentId: string;
  readonly survivorId: string;
  /** The chosen survivor stopped being offered and was cleared; the person is told. */
  readonly survivorLost: boolean;
  readonly labels: readonly LabelRowState[];
  readonly aliases: readonly string[];
  /** Merge and deprecate are irreversible: they have a separate confirmation step. */
  readonly step: 'edit' | 'confirm';
}

export type TermStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'invalid'; readonly issues: readonly TermIssue[] }
  | { readonly kind: 'pending' }
  | {
      readonly kind: 'done';
      readonly action: TermAction;
      readonly term: Extract<TermActionResult, { kind: 'done' }>['term'];
    }
  | {
      readonly kind: 'result';
      readonly result: Exclude<TermActionResult, { kind: 'done' }>;
    };

export interface TermFormOptions {
  readonly taxonomyId: string;
  readonly shape: TaxonomyShape;
  readonly active: ActiveVersion | null;
  readonly csrfToken: string;
  readonly refresh: () => Promise<boolean>;
  readonly submit?: typeof submitTermAction | undefined;
}

const newRow = (locale = '', label = ''): LabelRowState => ({
  id: crypto.randomUUID(),
  locale,
  label,
});

const IRREVERSIBLE: ReadonlySet<TermAction> = new Set(['deprecate', 'merge']);

const initialFields = (
  action: TermAction,
  target: TermFacts | null,
): TermFormState => ({
  action,
  target,
  termKey: '',
  parentId: target?.parentId ?? '',
  survivorId: '',
  survivorLost: false,
  labels:
    action === 'create'
      ? [newRow('en')]
      : action === 'rename' && target !== null
        ? target.labels.map((entry) => newRow(entry.locale, entry.label))
        : [],
  aliases: [],
  step: 'edit',
});

/**
 * True while the open form holds input the server has not confirmed (FE03 "Unsaved changes"): anything typed, chosen or
 * added beyond what the form opened with. The row ids are React keys and never count.
 */
export const isTermFormDirty = (form: TermFormState | null): boolean => {
  if (form === null) return false;
  const initial = initialFields(form.action, form.target);
  const rows = (state: TermFormState): string =>
    JSON.stringify(state.labels.map((row) => [row.locale, row.label]));
  return (
    form.termKey !== initial.termKey ||
    form.parentId !== initial.parentId ||
    form.survivorId !== initial.survivorId ||
    JSON.stringify(form.aliases) !== JSON.stringify(initial.aliases) ||
    rows(form) !== rows(initial)
  );
};

/** All state and commands of the term action form; the components only render. */
export const useTermForm = ({
  taxonomyId,
  shape,
  active,
  csrfToken,
  refresh,
  submit = submitOnDemand,
}: TermFormOptions) => {
  const [form, setForm] = useState<TermFormState | null>(null);
  const [status, setStatus] = useState<TermStatus>({ kind: 'idle' });
  const attemptRef = useRef<{ body: string; key: string } | null>(null);
  const inFlightRef = useRef(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const rateWait = useCmsTemplateRateWait();

  useEffect(() => {
    if (status.kind !== 'idle' && status.kind !== 'pending')
      document.getElementById(TERM_RESULT_HEADING_ID)?.focus();
  }, [status]);

  // The form heading takes focus when a form opens and when its confirmation step appears.
  const focusKey =
    form === null
      ? null
      : `${form.action}:${form.target?.termId ?? ''}:${form.step}`;
  useEffect(() => {
    if (focusKey !== null)
      document.getElementById(TERM_FORM_HEADING_ID)?.focus();
  }, [focusKey]);

  // Without an active version no term action exists (FE03 :1068).
  useEffect(() => {
    if (active === null) setForm(null);
  }, [active]);

  const open = useCallback(
    (
      action: TermAction,
      target: TermFacts | null,
      trigger: HTMLElement | null,
    ) => {
      triggerRef.current = trigger;
      attemptRef.current = null;
      setStatus({ kind: 'idle' });
      setForm(initialFields(action, target));
    },
    [],
  );
  /**
   * True while focus is still where the press that opened the form left it (the page, or the control that opened it).
   * The form arrives after its chunk loads; it takes focus only then, so a person who moved on keeps their place
   * (WCAG 2.4.3; FE03 1452 "Refresh never steals focus").
   */
  const focusIsAtTrigger = useCallback((): boolean => {
    const focused = document.activeElement;
    return (
      focused === null ||
      focused === document.body ||
      focused === triggerRef.current
    );
  }, []);
  const close = useCallback(() => {
    setForm(null);
    setStatus({ kind: 'idle' });
    triggerRef.current?.focus();
  }, []);
  const edit = useCallback(
    (change: Partial<TermFormState>) =>
      setForm((current) =>
        current === null ? current : { ...current, ...change },
      ),
    [],
  );

  const blocked = active === null || csrfToken.length === 0 || rateWait.waiting;

  const commit = useCallback(async (): Promise<void> => {
    if (form === null || active === null || blocked || inFlightRef.current)
      return;
    const fields: TermFormFields = {
      action: form.action,
      termKey: form.termKey,
      parentId: form.parentId,
      survivorId: form.survivorId,
      labels: form.labels,
      aliases: form.aliases,
    };
    const prepared = buildTermActionRequest(fields, {
      taxonomyId,
      shape,
      activeVersion: active.version,
      target: form.target,
    });
    if (!prepared.ok) {
      edit({ step: 'edit' });
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
    setStatus({ kind: 'pending' });
    let result: Awaited<ReturnType<typeof submit>>;
    try {
      result = await submit(prepared.value, csrfToken, key);
    } catch (error) {
      inFlightRef.current = false;
      attemptRef.current = null;
      if (!isModuleUnavailable(error)) throw error;
      // The write's chunk could not load: nothing was sent, the values are kept.
      edit({ step: 'edit' });
      setStatus({
        kind: 'invalid',
        issues: [
          {
            code: 'module_unavailable',
            field: 'form',
            message: MODULE_UNAVAILABLE_COPY,
          },
        ],
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
    if (result.kind === 'done') {
      setStatus({ kind: 'done', action: form.action, term: result.term });
      setForm(null);
    } else {
      edit({ step: 'edit' });
      setStatus({ kind: 'result', result });
    }
    // FE03 :1047: every outcome that may have changed the vocabulary is reconciled by
    // refetching the list and the active version before anything else is offered.
    if (
      result.kind === 'done' ||
      result.kind === 'uncertain' ||
      result.kind === 'conflict' ||
      (result.kind === 'refused' && result.reason === 'taxonomy_not_active')
    )
      await refresh();
  }, [
    active,
    blocked,
    csrfToken,
    edit,
    form,
    refresh,
    rateWait,
    shape,
    submit,
    taxonomyId,
  ]);

  const onSubmit = useCallback(async (): Promise<void> => {
    if (form === null) return;
    if (IRREVERSIBLE.has(form.action) && form.step === 'edit') {
      const prepared = buildTermActionRequest(
        {
          action: form.action,
          termKey: form.termKey,
          parentId: form.parentId,
          survivorId: form.survivorId,
          labels: form.labels,
          aliases: form.aliases,
        },
        {
          taxonomyId,
          shape,
          activeVersion: active?.version ?? '',
          target: form.target,
        },
      );
      if (!prepared.ok) {
        setStatus({ kind: 'invalid', issues: prepared.issues });
        return;
      }
      setStatus({ kind: 'idle' });
      edit({ step: 'confirm' });
      return;
    }
    await commit();
  }, [active, commit, edit, form, shape, taxonomyId]);

  return {
    form,
    dirty: isTermFormDirty(form),
    status,
    open,
    close,
    focusIsAtTrigger,
    edit,
    onSubmit,
    blocked,
    pending: status.kind === 'pending',
    rateWaiting: rateWait.waiting,
  };
};
