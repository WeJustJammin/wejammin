import * as React from 'react';
import type { TemplateDesignerContext } from '@wejammin/contracts';

import { warmCmsValidators } from '../../lib/cms-contract-validators';
import CmsRegistryChangeNotice from './CmsRegistryChangeNotice';
import CmsTemplateBindings from './CmsTemplateBindings';
import CmsTemplateExistingVersion from './CmsTemplateExistingVersion';
import CmsTemplateFields from './CmsTemplateFields';
import CmsTemplateLatestCheck from './CmsTemplateLatestCheck';
import CmsTemplateLeaveGuard from './CmsTemplateLeaveGuard';
import CmsTemplateSlots from './CmsTemplateSlots';
import CmsTemplateStatus, { templateKeyError } from './CmsTemplateStatus';
import { useCmsTemplateCreate } from './use-cms-template-create';
import { useCmsTemplateDraftFields } from './use-cms-template-draft-fields';
import { useCmsTemplateSentFields } from './use-cms-template-sent-fields';

interface Props {
  readonly context: TemplateDesignerContext;
  readonly csrfToken: string;
  /** Leaves this page for a destination the person confirmed (default: assign the location). */
  readonly navigate?: (href: string) => void;
}

/** One bounded island: only the draft form and its in-flight result hydrate. */
export default function CmsTemplateDesigner({
  context,
  csrfToken,
  navigate,
}: Props): React.ReactElement {
  const draft = useCmsTemplateDraftFields(context);
  const sent = useCmsTemplateSentFields();
  const create = useCmsTemplateCreate(context, csrfToken);
  const { status, reconcile } = create;
  // The block choices the registry offers now: they are replaced after a 409 `block_registry_digest_mismatch`.
  const offered = create.context;

  const submit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    await create.submit(draft.fields, () => sent.remember(draft.fields));
  };

  const reset = (): void => {
    draft.reset();
    create.reset();
  };

  const unsent = sent.unsent(
    draft.fields,
    status.kind === 'created',
    draft.dirty,
  );

  return (
    <CmsTemplateLeaveGuard
      dirty={unsent.dirty}
      lateEdits={unsent.late}
      navigate={navigate}
    >
      <h2 id="cms-template-designer-title">Define template draft</h2>
      <p>
        A draft is private until reviewed and activated. Content-type and block
        choices come from the protected registry; the server validates them
        again when you submit.
      </p>
      {offered.contentTypes.length === 0 ? (
        <p role="status">
          No active content types are available to this designer.
        </p>
      ) : null}
      {csrfToken.length === 0 ? (
        <p role="status">Reload to restore the protected form session.</p>
      ) : null}
      <CmsTemplateStatus status={status} summaryRef={create.summaryRef} />
      <CmsTemplateLatestCheck
        offered={create.offered}
        checking={reconcile.state.kind === 'checking'}
        waiting={reconcile.waiting}
        error={reconcile.state.kind === 'failed' ? reconcile.state.message : ''}
        rateLimited={
          reconcile.state.kind === 'failed' && reconcile.state.rateLimited
        }
        onCheck={create.check}
      />
      <CmsRegistryChangeNotice
        state={create.registry.state}
        waiting={create.registry.waiting}
        onRead={create.registry.check}
      />
      {reconcile.state.kind === 'absent' ? (
        <p role="status">
          No draft with this key exists, so nothing was saved. Saving again is
          safe: a retry of these unchanged values reuses the same idempotency
          key.
        </p>
      ) : null}
      {reconcile.state.kind === 'existing' ? (
        <CmsTemplateExistingVersion
          latest={reconcile.state.latest}
          unsentValues={draft.fields}
        />
      ) : null}
      <form
        onSubmit={(event) => void submit(event)}
        onFocus={warmCmsValidators}
        noValidate
      >
        {/* FE03 1048 `commandState` loading: only the commit control is withheld while pending. */}
        <fieldset disabled={status.kind === 'created'}>
          <legend>Template definition</legend>
          <CmsTemplateFields
            contentTypes={offered.contentTypes}
            templateKey={draft.templateKey}
            keyError={templateKeyError(status)}
            setTemplateKey={draft.setTemplateKey}
            compatibleTypeIds={draft.compatibleTypeIds}
            setCompatibleTypeIds={draft.setCompatibleTypeIds}
            locale={draft.locale}
            setLocale={draft.setLocale}
            audience={draft.audience}
            setAudience={draft.setAudience}
            extraRegions={draft.extraRegions}
            setExtraRegions={draft.setExtraRegions}
          />
          <CmsTemplateSlots
            registeredBlocks={offered.registeredBlocks}
            slots={draft.slots}
            setSlots={draft.setSlots}
          />
          <CmsTemplateBindings
            bindings={draft.bindings}
            setBindings={draft.setBindings}
          />
          <p>
            A successful create produces a private draft, not publication or
            activation.
          </p>
          <button
            type="submit"
            disabled={
              create.cannotSubmit || create.held || status.kind === 'pending'
            }
          >
            Create draft
          </button>
        </fieldset>
      </form>
      {status.kind === 'created' ? (
        <button type="button" onClick={reset}>
          Start another draft
        </button>
      ) : null}
    </CmsTemplateLeaveGuard>
  );
}
