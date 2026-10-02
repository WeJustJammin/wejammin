import * as React from 'react';
import type {
  TemplateDesignerContext,
  TemplateVersionDetail,
} from '@wejammin/contracts';

import CmsTemplateBindings from './CmsTemplateBindings';
import CmsTemplateFields from './CmsTemplateFields';
import CmsTemplateLatestVersionPanel from './CmsTemplateLatestVersionPanel';
import CmsTemplateSlots from './CmsTemplateSlots';
import CmsTemplateStatus from './CmsTemplateStatus';
import { useCmsTemplateEditState } from './cms-template-edit-reconcile-state';
import { buildCmsTemplateSuccessorRequest } from './cms-template-designer-request';
import { submitCmsTemplateSuccessorDraft } from './cms-template-designer-submit';
import { useCmsTemplateRateWait } from './cms-template-rate-wait';

interface Props {
  readonly context: TemplateDesignerContext;
  readonly detail: TemplateVersionDetail;
  readonly csrfToken: string;
}

/** Successor-draft island: edit state lives in the reconcile-state hook. */
export default function CmsTemplateEditDesigner({
  context,
  detail,
  csrfToken,
}: Props): React.ReactElement {
  const state = useCmsTemplateEditState(detail);
  const rateWait = useCmsTemplateRateWait();
  const fields = {
    templateKey: detail.templateKey,
    compatibleTypeIds: state.compatibleTypeIds,
    locale: state.locale,
    audience: state.audience,
    extraRegions: state.extraRegions,
    slots: state.slots,
    bindings: state.bindings,
  };
  const hasConflict =
    state.status.kind === 'result' && state.status.result.kind === 'conflict';
  const mayRetryConflict = state.latest?.version === state.baseDetail.version;
  const cannotSubmit =
    context.contentTypes.length === 0 ||
    csrfToken.length === 0 ||
    state.status.kind === 'pending' ||
    state.status.kind === 'created' ||
    rateWait.waiting ||
    (hasConflict && !mayRetryConflict);

  const submit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    if (cannotSubmit) return;
    const prepared = buildCmsTemplateSuccessorRequest(
      fields,
      context,
      state.baseDetail,
    );
    if (!prepared.ok) {
      state.setStatus({ kind: 'validation', message: prepared.message });
      return;
    }
    const key = state.beginAttempt(JSON.stringify(prepared.value));
    state.setStatus({ kind: 'pending' });
    const result = await submitCmsTemplateSuccessorDraft(
      prepared.value,
      csrfToken,
      key,
    );
    if (
      result.kind === 'rejected' &&
      result.status === 429 &&
      result.retryAfterSeconds !== undefined
    )
      rateWait.start(result.retryAfterSeconds);
    state.setStatus(
      result.kind === 'created'
        ? { kind: 'created', resource: result.resource }
        : { kind: 'result', result },
    );
  };

  return (
    <section
      className="cms-template-designer"
      aria-labelledby="cms-template-designer-title"
    >
      <h2 id="cms-template-designer-title">Edit template draft</h2>
      <p>
        Editing version {state.baseDetail.version}. Your values remain in this
        form until you explicitly choose a newer parent version.
      </p>
      {csrfToken.length === 0 ? (
        <p role="status">Reload to restore the protected form session.</p>
      ) : null}
      <CmsTemplateStatus
        status={state.status}
        summaryRef={state.summaryRef}
        mode="successor"
        returnTo={'/app/cms-content-modeling/templates/' + detail.templateKey}
      />
      {state.status.kind === 'result' &&
      (state.status.result.kind === 'conflict' ||
        state.status.result.kind === 'uncertain') ? (
        <button
          type="button"
          disabled={state.checkingLatest}
          onClick={() => void state.checkLatest()}
        >
          {state.checkingLatest
            ? 'Checking latest version…'
            : 'Check latest version'}
        </button>
      ) : null}
      {state.latestError ? <p role="alert">{state.latestError}</p> : null}
      {state.latest !== null ? (
        <CmsTemplateLatestVersionPanel
          latest={state.latest}
          baseVersion={state.baseDetail.version}
          unsentValues={fields}
          onUseAsParent={state.useLatestAsParent}
        />
      ) : null}
      <form onSubmit={(event) => void submit(event)} noValidate>
        <fieldset
          disabled={
            state.status.kind === 'pending' || state.status.kind === 'created'
          }
        >
          <legend>Template definition</legend>
          <CmsTemplateFields
            contentTypes={context.contentTypes}
            templateKey={detail.templateKey}
            setTemplateKey={() => undefined}
            templateKeyReadOnly
            compatibleTypeIds={state.compatibleTypeIds}
            setCompatibleTypeIds={state.setCompatibleTypeIds}
            locale={state.locale}
            setLocale={state.setLocale}
            audience={state.audience}
            setAudience={state.setAudience}
            extraRegions={state.extraRegions}
            setExtraRegions={state.setExtraRegions}
          />
          <CmsTemplateSlots
            registeredBlocks={context.registeredBlocks}
            slots={state.slots}
            setSlots={state.setSlots}
          />
          <CmsTemplateBindings
            bindings={state.bindings}
            setBindings={state.setBindings}
          />
          <p>
            A saved successor is a private draft, not publication or activation.
          </p>
          <button type="submit" disabled={cannotSubmit}>
            Save successor draft
          </button>
        </fieldset>
      </form>
    </section>
  );
}
