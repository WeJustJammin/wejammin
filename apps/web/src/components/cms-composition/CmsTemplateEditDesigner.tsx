import * as React from 'react';
import type {
  TemplateDesignerContext,
  TemplateVersionDetail,
} from '@wejammin/contracts';

import { warmCmsValidators } from '../../lib/cms-contract-validators';
import CmsRegistryChangeNotice from './CmsRegistryChangeNotice';
import CmsTemplateBindings from './CmsTemplateBindings';
import CmsTemplateFields from './CmsTemplateFields';
import CmsTemplateLatestCheck from './CmsTemplateLatestCheck';
import CmsTemplateLatestVersionPanel from './CmsTemplateLatestVersionPanel';
import CmsTemplateLeaveGuard from './CmsTemplateLeaveGuard';
import CmsTemplateSlots from './CmsTemplateSlots';
import CmsTemplateStatus, { templateKeyError } from './CmsTemplateStatus';
import { useCmsTemplateEditState } from './cms-template-edit-reconcile-state';
import {
  cmsTemplateUnavailableTypeIds,
  templateDetailToDraftFields,
} from './cms-template-designer-request';
import { cmsTemplateDraftDirty } from './cms-template-draft-dirty';
import { useCmsTemplateRateWait } from './cms-template-rate-wait';
import { useCmsTemplateSentFields } from './use-cms-template-sent-fields';
import { useTemplateRegistry } from './use-template-registry';
import { useCmsTemplateValidators } from './use-cms-template-validators';

interface Props {
  readonly context: TemplateDesignerContext;
  readonly detail: TemplateVersionDetail;
  readonly csrfToken: string;
  /** Leaves this page for a destination the person confirmed (default: assign the location). */
  readonly navigate?: (href: string) => void;
}

/** Successor-draft island: edit state lives in the reconcile-state hook. */
export default function CmsTemplateEditDesigner({
  context: initialContext,
  detail,
  csrfToken,
  navigate,
}: Props): React.ReactElement {
  const state = useCmsTemplateEditState(detail);
  const registry = useTemplateRegistry(initialContext, state.status);
  const context = registry.context;
  const rateWait = useCmsTemplateRateWait();
  const gate = useCmsTemplateValidators();
  const sent = useCmsTemplateSentFields();
  const fields = {
    templateKey: detail.templateKey,
    compatibleTypeIds: state.compatibleTypeIds,
    locale: state.locale,
    audience: state.audience,
    extraRegions: state.extraRegions,
    slots: state.slots,
    bindings: state.bindings,
  };
  const cannotSubmit =
    context.contentTypes.length === 0 ||
    csrfToken.length === 0 ||
    state.writeBlocked ||
    rateWait.waiting ||
    registry.holding;

  const submit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    if (cannotSubmit) return;
    sent.remember(fields);
    await state.submit({
      fields,
      context,
      base: state.baseDetail,
      csrfToken,
      obtain: gate.obtain,
      onRateLimit: rateWait.start,
    });
  };

  const unsent = sent.unsent(
    fields,
    state.status.kind === 'created',
    cmsTemplateDraftDirty(
      fields,
      templateDetailToDraftFields(state.baseDetail),
    ),
  );

  return (
    <CmsTemplateLeaveGuard
      dirty={unsent.dirty}
      lateEdits={unsent.late}
      navigate={navigate}
    >
      <h2 id="cms-template-designer-title">Edit template draft</h2>
      <p>
        Editing version {state.baseDetail.version}. Your values remain in this
        form until you explicitly choose a newer parent version.
      </p>
      {context.contentTypes.length === 0 ? (
        <p role="status">
          No active content types are available to this designer.
        </p>
      ) : null}
      {csrfToken.length === 0 ? (
        <p role="status">Reload to restore the protected form session.</p>
      ) : null}
      <CmsTemplateStatus
        status={state.status}
        summaryRef={state.summaryRef}
        mode="successor"
        parentVersion={state.baseDetail.version}
        returnTo={'/app/cms-content-modeling/templates/' + detail.templateKey}
      />
      <CmsRegistryChangeNotice
        state={registry.state}
        waiting={registry.waiting}
        onRead={registry.check}
      />
      <CmsTemplateLatestCheck
        offered={
          state.status.kind === 'result' &&
          (state.status.result.kind === 'conflict' ||
            state.status.result.kind === 'uncertain')
        }
        checking={state.checkingLatest}
        waiting={state.latestWaiting}
        error={state.latestError}
        rateLimited={state.latestRateLimited}
        onCheck={() => void state.checkLatest()}
      />
      {state.latest !== null ? (
        <CmsTemplateLatestVersionPanel
          latest={state.latest}
          baseVersion={state.baseDetail.version}
          unsentValues={fields}
          onUseAsParent={state.useLatestAsParent}
        />
      ) : null}
      <form
        onSubmit={(event) => void submit(event)}
        onFocus={warmCmsValidators}
        noValidate
      >
        <fieldset>
          <legend>Template definition</legend>
          <CmsTemplateFields
            contentTypes={context.contentTypes}
            templateKey={detail.templateKey}
            keyError={templateKeyError(state.status)}
            setTemplateKey={() => undefined}
            templateKeyReadOnly
            compatibleTypeIds={state.compatibleTypeIds}
            unavailableTypeIds={cmsTemplateUnavailableTypeIds(
              [
                ...state.baseDetail.compatibleTypeIds,
                ...state.compatibleTypeIds,
              ],
              context,
            )}
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
          <button
            className="cms-template-successor-commit"
            type="submit"
            disabled={cannotSubmit}
            aria-label="Save successor draft"
            aria-busy={state.writePending}
          >
            {state.writePending
              ? 'Saving successor draft…'
              : 'Save successor draft'}
          </button>
        </fieldset>
      </form>
    </CmsTemplateLeaveGuard>
  );
}
