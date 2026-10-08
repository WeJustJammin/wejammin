import * as React from 'react';

import CmsFieldErrorSummary, {
  type CmsFieldErrorSummaryItem,
} from '../cms-editorial-fields/CmsFieldErrorSummary';
import type { CmsFieldIssue } from '../cms-editorial-fields/cms-field-issue';
import { validateCmsFieldValue } from '../cms-editorial-fields/cms-field-value';
import CmsEditorialConflictPath from './CmsEditorialConflictPath';
import CmsEditorialStatus from './CmsEditorialStatus';
import { cmsEditorialAppEntryPath } from './cms-editorial-app-routes';
import {
  useCmsEditorialConflict,
  type CmsEditorialConflictResolveProps,
} from './use-cms-editorial-conflict';

export type { CmsEditorialConflictResolveProps } from './use-cms-editorial-conflict';

/**
 * The CMS-06 resolution form (BE03b CMS-03B-02): per divergent field the base,
 * their version and your version as typed values, a radio for each and a fourth
 * for an explicit value, with a linked summary that focuses the first field
 * still to decide. Submit sends every choice explicitly under a key and
 * If-Match; a 409 re-reads the conflict and keeps unchanged choices; a 404 means
 * the conflict is no longer open.
 */
export default function CmsEditorialConflictResolveIsland(
  props: CmsEditorialConflictResolveProps,
): React.ReactElement {
  const { init } = props;
  const { controller, state } = useCmsEditorialConflict(props);
  const summaryRef = React.useRef<HTMLDivElement>(null);
  const alertRef = React.useRef<HTMLDivElement>(null);
  const submitRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (state.summaryToken > 0) summaryRef.current?.focus();
  }, [state.summaryToken]);
  React.useEffect(() => {
    // The states that disable the author's controls take focus explicitly (a
    // disabled control drops it to <body>): the alert for a closed conflict,
    // an expired session or a denial, the retry button for an unknown outcome.
    if (state.phase === 'unknown') submitRef.current?.focus();
    else if (
      state.phase === 'closed' ||
      state.phase === 'unauthenticated' ||
      state.phase === 'denied'
    )
      alertRef.current?.focus();
  }, [state.phase]);

  const issuesFor = (fieldId: string): readonly CmsFieldIssue[] => {
    if (!state.refusedFieldIds.includes(fieldId)) return [];
    const entry = state.choices[fieldId];
    const descriptor = controller.descriptors.get(fieldId);
    if (entry === undefined || entry.choice === null)
      return [{ code: 'undecided', message: 'Choose which version to keep.' }];
    const raw = state.inputErrors[fieldId];
    if (raw !== undefined) return [{ code: 'input', message: raw }];
    const local =
      entry.choice === 'explicit' && descriptor !== undefined
        ? validateCmsFieldValue(descriptor, entry.explicit)
        : [];
    return local.length > 0
      ? local
      : [{ code: 'server', message: state.message }];
  };
  const summaryItems: readonly CmsFieldErrorSummaryItem[] = state.paths.flatMap(
    (path) => {
      const descriptor = controller.descriptors.get(path.fieldId);
      return issuesFor(path.fieldId).map((issue) => ({
        fieldId: path.fieldId,
        label: descriptor?.label ?? 'Field',
        message: issue.message,
      }));
    },
  );
  const entryPath = cmsEditorialAppEntryPath(init.entryId);
  const finished = state.phase === 'closed' || state.phase === 'resolved';
  // The fields stay enabled while the resolve is in flight: the controller
  // ignores a change then, and disabling a focused radio would drop focus.
  const locked = finished || state.phase === 'unknown';
  const signIn = `/auth/sign-in?returnTo=${encodeURIComponent(
    typeof window === 'undefined'
      ? ''
      : `${window.location.pathname}${window.location.search}`,
  )}`;

  return (
    <form
      noValidate
      data-cms-editorial-conflict-resolve=""
      aria-busy={state.phase === 'submitting'}
      onSubmit={(event) => {
        event.preventDefault();
        void (state.phase === 'unknown'
          ? controller.retryReconcile()
          : controller.submit());
      }}
    >
      <CmsEditorialStatus
        regionId="cms-editorial-conflict-status"
        message={state.alert ? '' : state.message}
      />
      {state.alert ? (
        <div role="alert" tabIndex={-1} ref={alertRef}>
          <p>{state.message}</p>
          {state.phase === 'unauthenticated' ? (
            <p>
              <a href={signIn}>Sign in again</a>
            </p>
          ) : null}
          {state.phase === 'closed' && entryPath !== null ? (
            <p>
              <a href={entryPath}>Return to the entry</a>
            </p>
          ) : null}
        </div>
      ) : null}
      {summaryItems.length > 0 ? (
        <CmsFieldErrorSummary
          ref={summaryRef}
          id="cms-editorial-conflict-summary"
          heading="Check these fields before resolving"
          items={summaryItems}
        />
      ) : null}
      <p>
        Two versions changed the same fields. Choose what to keep for each
        field; nothing is decided for you and nothing is overwritten until you
        resolve.
      </p>
      {state.paths.map((path) => {
        const descriptor = controller.descriptors.get(path.fieldId);
        const entry = state.choices[path.fieldId];
        if (descriptor === undefined || entry === undefined)
          return (
            <p key={path.fieldId}>A field of this conflict cannot be shown.</p>
          );
        return (
          <CmsEditorialConflictPath
            key={path.fieldId}
            path={path}
            descriptor={descriptor}
            choice={entry}
            issues={issuesFor(path.fieldId)}
            disabled={locked}
            onChoose={(choice) => controller.choose(path.fieldId, choice)}
            onExplicit={(value) => controller.setExplicit(path.fieldId, value)}
            onInputError={(message) =>
              controller.setInputError(path.fieldId, message)
            }
          />
        );
      })}
      {/*
        Never disabled while the resolve is in flight (the controller refuses a
        second submit): a disabled focused button drops focus to <body>. One
        button, so focus survives the switch to "Retry resolve".
      */}
      <button
        ref={submitRef}
        type="submit"
        disabled={finished}
        aria-busy={state.phase === 'submitting' ? true : undefined}
      >
        {state.phase === 'unknown' ? 'Retry resolve' : 'Resolve conflict'}
      </button>
    </form>
  );
}
