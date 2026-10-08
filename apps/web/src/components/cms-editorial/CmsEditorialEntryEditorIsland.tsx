import * as React from 'react';

import CmsFieldEditor from '../cms-editorial-fields/CmsFieldEditor';
import CmsFieldErrorSummary, {
  type CmsFieldErrorSummaryItem,
} from '../cms-editorial-fields/CmsFieldErrorSummary';
import { validateCmsFieldValue } from '../cms-editorial-fields/cms-field-value';
import CmsEditorialDraftFacts from './CmsEditorialDraftFacts';
import CmsEditorialEditorBanners from './CmsEditorialEditorBanners';
import CmsEditorialResultPanel from './CmsEditorialResultPanel';
import CmsEditorialLeaveConfirmation from './CmsEditorialLeaveConfirmation';
import CmsEditorialStatus from './CmsEditorialStatus';
import { cmsEditorialAppRevisionsPath } from './cms-editorial-app-routes';
import { CMS_EDITORIAL_APP_ENTRIES_PATH } from './cms-editorial-app-routes';
import { useCmsEditorialLeaveGuard } from './use-cms-editorial-leave-guard';
import { useCmsEditorialResult } from './use-cms-editorial-result';
import {
  useCmsEditorialEntryEditor,
  type CmsEditorialEntryEditorProps,
} from './use-cms-editorial-entry-editor';

export type { CmsEditorialEntryEditorProps } from './use-cms-editorial-entry-editor';

const here = (): string =>
  `${window.location.pathname}${window.location.search}`;

/**
 * The CMS-05 draft editor: the stored values in native controls typed by the
 * compiled schema, advisory autosave (3 s idle, 30 s hard maximum) against the
 * explicit base revision, and an explicit Save draft. Autosave never moves
 * focus; a refusal, a lost response, a conflict or a lost session keeps every
 * unsent value, and the status region truthfully says which. The next
 * `baseRevision` / `If-Match` come only from verified responses.
 */
export default function CmsEditorialEntryEditorIsland(
  props: CmsEditorialEntryEditorProps,
): React.ReactElement {
  const { init } = props;
  const { controller, state } = useCmsEditorialEntryEditor(props);
  const summaryRef = React.useRef<HTMLDivElement>(null);
  const alertRef = React.useRef<HTMLDivElement>(null);
  const explicitSave = React.useRef(false);
  const result = useCmsEditorialResult(init.entryId);
  const guard = useCmsEditorialLeaveGuard({
    active: controller.hasUnsentWork(),
    save: () => controller.saveNow(),
    stillUnsent: () => controller.hasUnsentWork(),
    navigate:
      props.navigate ?? ((href: string) => window.location.assign(href)),
  });

  React.useEffect(() => {
    // Only an explicit Save draft may take focus; autosave is advisory.
    if (state.summaryToken > 0 && explicitSave.current) {
      explicitSave.current = false;
      summaryRef.current?.focus();
    }
  }, [state.summaryToken]);
  React.useEffect(() => {
    // The states that interrupt, and that disable the controls the author was
    // using, take focus: a disabled control drops it to <body> otherwise.
    if (
      state.phase === 'conflict' ||
      state.phase === 'sync-conflict' ||
      state.phase === 'unauthenticated' ||
      state.phase === 'denied'
    )
      alertRef.current?.focus();
  }, [state.phase]);

  const issuesFor = (fieldId: string) => {
    const descriptor = controller.descriptors.find(
      (entry) => entry.fieldId === fieldId,
    );
    const raw = state.inputErrors[fieldId];
    const refused = state.refusedFieldIds.includes(fieldId);
    const local =
      refused && descriptor !== undefined
        ? validateCmsFieldValue(descriptor, state.values[fieldId] ?? null)
        : [];
    return [
      ...(refused && local.length === 0
        ? [{ code: 'server', message: state.message }]
        : local),
      ...(raw === undefined ? [] : [{ code: 'input', message: raw }]),
    ];
  };
  const summaryItems: readonly CmsFieldErrorSummaryItem[] =
    controller.descriptors.flatMap((descriptor) =>
      issuesFor(descriptor.fieldId).map((issue) => ({
        fieldId: descriptor.fieldId,
        label: descriptor.label,
        message: issue.message,
      })),
    );
  const editable =
    init.lifecycle === 'active' &&
    state.phase !== 'unauthenticated' &&
    state.phase !== 'denied';
  const historyPath = cmsEditorialAppRevisionsPath(init.entryId);

  return (
    <div className="cms-editorial-editor" onClickCapture={guard.onClickCapture}>
      <CmsEditorialStatus
        regionId="cms-editorial-editor-status"
        message={state.alert ? '' : state.message}
      />
      <CmsEditorialEditorBanners
        init={init}
        state={state}
        signInHref={`/auth/sign-in?returnTo=${encodeURIComponent(
          typeof window === 'undefined' ? '' : here(),
        )}`}
        currentHref={typeof window === 'undefined' ? '' : here()}
        alertRef={alertRef}
        onDiscardAndLoad={() => void controller.discardUnsentAndLoadCurrent()}
      />
      {result === null ? null : <CmsEditorialResultPanel summary={result} />}
      <CmsEditorialDraftFacts
        init={init}
        state={state}
        descriptors={controller.descriptors}
      />
      {guard.pendingHref === null ? null : (
        <CmsEditorialLeaveConfirmation
          unsentCount={state.unsentCount}
          onSaveAndLeave={() => void guard.saveAndLeave()}
          onLeave={guard.leaveWithoutSaving}
          onStay={guard.stay}
        />
      )}
      <nav aria-label="Entry navigation">
        {historyPath === null ? null : (
          <a href={historyPath}>Revision history</a>
        )}{' '}
        <a href={CMS_EDITORIAL_APP_ENTRIES_PATH}>All entries</a>
      </nav>
      {summaryItems.length > 0 ? (
        <CmsFieldErrorSummary
          ref={summaryRef}
          id="cms-editorial-editor-summary"
          heading="Check these fields before saving again"
          items={summaryItems}
        />
      ) : null}
      <form
        noValidate
        data-cms-editorial-entry-editor=""
        onSubmit={(event) => {
          event.preventDefault();
          explicitSave.current = true;
          void controller.saveNow();
        }}
      >
        <fieldset disabled={!editable} className="cms-editorial-fields">
          <legend>Draft fields</legend>
          {controller.descriptors.map((descriptor) => (
            <CmsFieldEditor
              key={`${descriptor.fieldId}-${state.fieldRevisions[descriptor.fieldId] ?? 0}`}
              descriptor={descriptor}
              value={state.values[descriptor.fieldId] ?? null}
              issues={issuesFor(descriptor.fieldId)}
              readOnlyNotice={init.readOnlyNotices[descriptor.fieldId]}
              onChange={(value) =>
                controller.setValue(descriptor.fieldId, value)
              }
              onInputError={(message) =>
                controller.setInputError(descriptor.fieldId, message)
              }
            />
          ))}
        </fieldset>
        {/*
          Never disabled while a save is in flight: disabling the focused button
          makes the browser drop focus to <body>. The controller refuses a second
          save while one is in flight, so a repeated activation sends nothing.
        */}
        <button
          type="submit"
          disabled={init.lifecycle !== 'active' || state.phase === 'denied'}
          aria-busy={state.phase === 'saving' ? true : undefined}
        >
          Save draft
        </button>
        {state.needsManualRetry ? (
          <button
            type="button"
            onClick={() => void controller.retryReconcile()}
          >
            Retry save
          </button>
        ) : null}
      </form>
    </div>
  );
}
