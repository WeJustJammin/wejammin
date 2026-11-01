import { retryable } from '../../lib/retryable-import';
import type {
  AuthoringContextField,
  AuthoringContextType,
  JsonValue,
} from '@wejammin/contracts';
import * as React from 'react';

import type { CmsFieldErrorSummaryItem } from '../cms-editorial-fields/CmsFieldErrorSummary';
import type { CmsFieldDescriptor } from '../cms-editorial-fields/cms-field-descriptor';
import { cmsEditorialAppEntryPath } from './cms-editorial-app-routes';
import {
  captureCmsEditorialEntryCreateAttempt,
  cmsEditorialEntryCreateUnavailable,
  type CmsEditorialEntryCreateAttempt,
} from './cms-editorial-entry-create-attempt';
import {
  collectCmsCreateValues,
  initialCmsCreateValues,
} from './cms-editorial-entry-create-values';
import type { CmsEditorialEntryCreateSubmitResult } from './cms-editorial-entry-create-submit';
import {
  READ_CSRF_COOKIE_FROM_DOCUMENT,
  newCmsEditorialIdempotencyKey,
} from './cms-editorial-request-support';
import { markRouteHeadingForFocus } from '../../lib/route-heading-focus';
import type { CmsFieldIssue } from '../cms-editorial-fields/cms-field-issue';

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface CmsEditorialEntryCreateOptions {
  readonly type: AuthoringContextType;
  readonly fields: readonly AuthoringContextField[];
  /** Decoded from `fields` by the page (server), so the island ships no zod (AC-106). */
  readonly descriptors: readonly CmsFieldDescriptor[];
  readonly fetcher?: Fetcher | undefined;
  readonly navigate?: ((path: string) => void) | undefined;
}

type Status =
  | { readonly kind: 'idle' }
  | { readonly kind: 'submitting' }
  | { readonly kind: 'created' }
  | {
      readonly kind: 'failed';
      readonly message: string;
      readonly unauthenticated: boolean;
    };

const STATUS_COPY = {
  submitting: 'Creating the entry.',
  created: 'The entry was created. Opening the draft.',
} as const;

const sessionStorageOrNull = (): Storage | null => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

/**
 * The state machine behind the create island. It owns the typed field values,
 * which fields have been touched, the raw-input errors, the pending attempt
 * whose outcome is unknown (the form locks and the identical request is replayed
 * under the same key), and the server's per-field refusals. Nothing here reads
 * the DOM: the island renders what this returns.
 */
const loadCreateSubmit = retryable(
  () => import('./cms-editorial-entry-create-submit'),
);

export const useCmsEditorialEntryCreate = (
  options: CmsEditorialEntryCreateOptions,
) => {
  const { type, fields, descriptors } = options;
  const [values, setValues] = React.useState(() =>
    initialCmsCreateValues(fields),
  );
  const [touched, setTouched] = React.useState<ReadonlySet<string>>(new Set());
  const [inputErrors, setInputErrors] = React.useState<
    Readonly<Record<string, string>>
  >({});
  const [locale, setLocale] = React.useState(type.defaultLocale);
  const [attempted, setAttempted] = React.useState(false);
  const [status, setStatus] = React.useState<Status>({ kind: 'idle' });
  const [serverFields, setServerFields] = React.useState<ReadonlySet<string>>(
    new Set(),
  );
  const [serverMessage, setServerMessage] = React.useState<string | null>(null);
  const [locked, setLocked] = React.useState(false);
  const [summaryToken, setSummaryToken] = React.useState(0);
  const [taxonomyRefreshToken, setTaxonomyRefreshToken] = React.useState(0);
  const pending = React.useRef<CmsEditorialEntryCreateAttempt | null>(null);
  const inFlight = React.useRef(false);

  const touch = (fieldId: string): void =>
    setTouched((current) => new Set(current).add(fieldId));

  const issuesFor = (fieldId: string): readonly CmsFieldIssue[] => {
    const shown = attempted || touched.has(fieldId);
    const own = shown
      ? (collectCmsCreateValues(descriptors, values, touched).issues.get(
          fieldId,
        ) ?? [])
      : [];
    const raw = inputErrors[fieldId];
    return [
      ...own,
      ...(raw === undefined ? [] : [{ code: 'input', message: raw }]),
      ...(serverFields.has(fieldId) && serverMessage !== null
        ? [{ code: 'server', message: serverMessage }]
        : []),
    ];
  };

  const summaryItems: readonly CmsFieldErrorSummaryItem[] = [
    ...descriptors.flatMap((descriptor) =>
      issuesFor(descriptor.fieldId).map((issue) => ({
        fieldId: descriptor.fieldId,
        label: descriptor.label,
        message: issue.message,
      })),
    ),
    ...(serverFields.size === 0 && serverMessage !== null
      ? [{ fieldId: null, label: 'The entry', message: serverMessage }]
      : []),
  ];

  const finish = (result: CmsEditorialEntryCreateSubmitResult): void => {
    inFlight.current = false;
    if (result.status === 'created') {
      pending.current = null;
      setLocked(false);
      const destination = cmsEditorialAppEntryPath(result.entryId);
      setStatus({ kind: 'created' });
      if (destination !== null) {
        const leave = (): void => {
          markRouteHeadingForFocus(sessionStorageOrNull());
          (options.navigate ?? ((path) => window.location.assign(path)))(
            destination,
          );
        };
        // The handoff (and the step-up draft store behind it) loads when the entry is created,
        // not with the page (AC-106); the editor still opens when it cannot be fetched.
        void import('./cms-editorial-result-save')
          .then(({ saveCmsEditorialResult }) => {
            saveCmsEditorialResult(sessionStorageOrNull(), result.summary);
          })
          .catch(() => undefined)
          .then(leave);
      }
      return;
    }
    pending.current = null;
    setLocked(false);
    if (result.status === 'refused') {
      setStatus({
        kind: 'failed',
        message: result.message,
        unauthenticated: false,
      });
      return;
    }
    if (result.status === 'invalid') {
      setServerFields(
        new Set(
          result.violations.flatMap((v) =>
            v.fieldId === null ? [] : [v.fieldId],
          ),
        ),
      );
      setServerMessage(result.message);
      setStatus({
        kind: 'failed',
        message: result.message,
        unauthenticated: false,
      });
      // A verified term refusal is the only refusal that re-reads the selector;
      // the create is never retried automatically, so the values stay put.
      if (result.taxonomyUnavailable)
        setTaxonomyRefreshToken((token) => token + 1);
      setSummaryToken((token) => token + 1);
      return;
    }
    setServerMessage(result.setupSummary === true ? result.message : null);
    setServerFields(new Set());
    if (result.setupSummary === true) setSummaryToken((token) => token + 1);
    setStatus({
      kind: 'failed',
      message: result.message,
      unauthenticated: result.unauthenticated,
    });
  };

  const run = async (
    attempt: CmsEditorialEntryCreateAttempt,
  ): Promise<void> => {
    if (inFlight.current) return;
    inFlight.current = true;
    setStatus({ kind: 'submitting' });
    setServerFields(new Set());
    setServerMessage(null);
    // The create transport (and the contract schemas it validates with) loads on
    // the first submit, never with the island (FE03 "Performance budgets and
    // loading strategy", AC-106).
    const submitter = await loadCreateSubmit().catch(() => null);
    const result: CmsEditorialEntryCreateSubmitResult =
      submitter === null
        ? cmsEditorialEntryCreateUnavailable(
            attempt.key ?? newCmsEditorialIdempotencyKey() ?? '',
          )
        : await submitter.submitCmsEditorialEntryCreate({
            prefill: attempt.prefill,
            values: attempt.values,
            csrfToken: READ_CSRF_COOKIE_FROM_DOCUMENT(document),
            idempotencyKey: attempt.key,
            ...(options.fetcher === undefined
              ? {}
              : { fetcher: options.fetcher }),
          });
    // Only an attempt that may have been applied locks the form: the identical
    // request must be replayed under the same key, so nothing may change first.
    if (result.status === 'error' && result.outcomeUnknown) {
      inFlight.current = false;
      pending.current = {
        ...attempt,
        key: result.idempotencyKey,
      };
      setLocked(true);
      setStatus({
        kind: 'failed',
        message: result.message,
        unauthenticated: false,
      });
      return;
    }
    finish(result);
  };

  const submit = async (): Promise<void> => {
    if (pending.current !== null) {
      await run(pending.current);
      return;
    }
    const collected = collectCmsCreateValues(descriptors, values, touched);
    setAttempted(true);
    if (collected.issues.size > 0 || Object.keys(inputErrors).length > 0) {
      setSummaryToken((token) => token + 1);
      return;
    }
    await run(
      captureCmsEditorialEntryCreateAttempt(type, collected.values, locale),
    );
  };

  return {
    descriptors,
    values,
    locale,
    locked,
    status,
    summaryItems,
    summaryToken,
    taxonomyRefreshToken,
    submitting: status.kind === 'submitting',
    statusMessage:
      status.kind === 'idle'
        ? ''
        : status.kind === 'failed'
          ? status.message
          : STATUS_COPY[status.kind],
    unauthenticated: status.kind === 'failed' && status.unauthenticated,
    issuesFor,
    touch,
    setLocale,
    setValue: (fieldId: string, value: JsonValue | null): void => {
      setValues((current) => ({ ...current, [fieldId]: value }));
      touch(fieldId);
      setServerFields((current) => {
        if (!current.has(fieldId)) return current;
        const next = new Set(current);
        next.delete(fieldId);
        return next;
      });
    },
    setInputError: (fieldId: string, message: string | null): void =>
      setInputErrors((current) => {
        if (message === null && !(fieldId in current)) return current;
        const next = { ...current };
        if (message === null) delete next[fieldId];
        else next[fieldId] = message;
        return next;
      }),
    submit,
  };
};
