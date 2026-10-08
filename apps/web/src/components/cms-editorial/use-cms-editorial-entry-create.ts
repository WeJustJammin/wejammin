import type {
  AuthoringContextField,
  AuthoringContextType,
  JsonValue,
} from '@wejammin/contracts';
import * as React from 'react';

import type { CmsFieldErrorSummaryItem } from '../cms-editorial-fields/CmsFieldErrorSummary';
import { describeCmsAuthoringFields } from '../cms-editorial-fields/cms-field-descriptor';
import { cmsEditorialAppEntryPath } from './cms-editorial-app-routes';
import {
  collectCmsCreateValues,
  initialCmsCreateValues,
} from './cms-editorial-entry-create-values';
import {
  READ_CSRF_COOKIE_FROM_DOCUMENT,
  submitCmsEditorialEntryCreate,
  type CmsEditorialEntryCreateSubmitResult,
} from './cms-editorial-entry-create-submit';
import { markRouteHeadingForFocus } from '../../lib/route-heading-focus';
import { saveCmsEditorialResult } from './cms-editorial-result-handoff';
import type { CmsFieldIssue } from '../cms-editorial-fields/cms-field-issue';

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface CmsEditorialEntryCreateOptions {
  readonly type: AuthoringContextType;
  readonly fields: readonly AuthoringContextField[];
  readonly fetcher?: Fetcher | undefined;
  readonly navigate?: ((path: string) => void) | undefined;
}

interface Pending {
  readonly values: Readonly<Record<string, JsonValue>>;
  readonly locale: string;
  readonly key: string;
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
export const useCmsEditorialEntryCreate = (
  options: CmsEditorialEntryCreateOptions,
) => {
  const { type, fields } = options;
  const descriptors = React.useMemo(
    () => describeCmsAuthoringFields(fields),
    [fields],
  );
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
  const pending = React.useRef<Pending | null>(null);
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
        saveCmsEditorialResult(sessionStorageOrNull(), result.summary);
        markRouteHeadingForFocus(sessionStorageOrNull());
        (options.navigate ?? ((path) => window.location.assign(path)))(
          destination,
        );
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
      setSummaryToken((token) => token + 1);
      return;
    }
    setServerMessage(null);
    setServerFields(new Set());
    setStatus({
      kind: 'failed',
      message: result.message,
      unauthenticated: result.unauthenticated,
    });
  };

  const run = async (
    toSend: Readonly<Record<string, JsonValue>>,
    sendLocale: string,
    key: string | null,
  ): Promise<void> => {
    if (inFlight.current) return;
    inFlight.current = true;
    setStatus({ kind: 'submitting' });
    setServerFields(new Set());
    setServerMessage(null);
    const result = await submitCmsEditorialEntryCreate({
      prefill: {
        contentTypeId: type.contentTypeId,
        contentTypeVersionId: type.contentTypeVersionId,
        locale: sendLocale,
        schemaArtifact: type.schemaArtifact,
        validatorRefs: type.validatorRefs,
        workflowPolicy: type.workflowPolicy,
        activationEvidence: type.activationEvidence,
      },
      values: toSend,
      csrfToken: READ_CSRF_COOKIE_FROM_DOCUMENT(document),
      idempotencyKey: key,
      ...(options.fetcher === undefined ? {} : { fetcher: options.fetcher }),
    });
    // Only an attempt that may have been applied locks the form: the identical
    // request must be replayed under the same key, so nothing may change first.
    if (result.status === 'error' && result.outcomeUnknown) {
      inFlight.current = false;
      pending.current = {
        values: toSend,
        locale: sendLocale,
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
      const attempt = pending.current;
      await run(attempt.values, attempt.locale, attempt.key);
      return;
    }
    const collected = collectCmsCreateValues(descriptors, values, touched);
    setAttempted(true);
    if (collected.issues.size > 0 || Object.keys(inputErrors).length > 0) {
      setSummaryToken((token) => token + 1);
      return;
    }
    await run(collected.values, locale, null);
  };

  return {
    descriptors,
    values,
    locale,
    locked,
    status,
    summaryItems,
    summaryToken,
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
