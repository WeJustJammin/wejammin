import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import type { TemplateDesignerContext } from '@wejammin/contracts';

import { warmCmsValidators } from '../../lib/cms-contract-validators';
import CmsTemplateBindings from './CmsTemplateBindings';
import CmsTemplateFields from './CmsTemplateFields';
import CmsTemplateLeaveGuard from './CmsTemplateLeaveGuard';
import CmsTemplateSlots from './CmsTemplateSlots';
import CmsTemplateStatus, {
  type CmsTemplateFormStatus,
} from './CmsTemplateStatus';
import { buildCmsTemplateDraftRequest } from './cms-template-designer-request';
import { submitCmsTemplateDraft } from './cms-template-designer-submit';
import { useCmsTemplateRateWait } from './cms-template-rate-wait';
import { focusCmsTemplateResult } from './cms-template-result-focus';
import { useCmsTemplateDraftFields } from './use-cms-template-draft-fields';
import { useCmsTemplateSentFields } from './use-cms-template-sent-fields';
import {
  CMS_TEMPLATE_CHECK_UNAVAILABLE_MESSAGE,
  useCmsTemplateValidators,
} from './use-cms-template-validators';

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
  const [status, setStatus] = useState<CmsTemplateFormStatus>({ kind: 'idle' });
  const summaryRef = useRef<HTMLDivElement>(null);
  const attemptRef = useRef<{ body: string; key: string } | null>(null);
  const gate = useCmsTemplateValidators();
  const rateWait = useCmsTemplateRateWait();
  const cannotSubmit =
    context.contentTypes.length === 0 ||
    csrfToken.length === 0 ||
    rateWait.waiting;

  useEffect(() => {
    if (status.kind !== 'idle' && status.kind !== 'pending')
      focusCmsTemplateResult(summaryRef.current);
  }, [status]);

  const submit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    if (
      cannotSubmit ||
      gate.isChecking() ||
      status.kind === 'pending' ||
      status.kind === 'created'
    )
      return;
    // If the lazily loaded schemas cannot be fetched the draft is unchecked.
    const validators = await gate.obtain();
    if (validators === null) {
      setStatus({
        kind: 'validation',
        message: CMS_TEMPLATE_CHECK_UNAVAILABLE_MESSAGE,
      });
      return;
    }
    const prepared = buildCmsTemplateDraftRequest(
      validators,
      draft.fields,
      context,
    );
    if (!prepared.ok) {
      setStatus({ kind: 'validation', message: prepared.message });
      return;
    }
    const serialized = JSON.stringify(prepared.value);
    const key =
      attemptRef.current?.body === serialized
        ? attemptRef.current.key
        : crypto.randomUUID();
    attemptRef.current = { body: serialized, key };
    sent.remember(draft.fields);
    setStatus({ kind: 'pending' });
    const result = await submitCmsTemplateDraft(
      validators,
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
    setStatus(
      result.kind === 'created'
        ? { kind: 'created', resource: result.resource }
        : { kind: 'result', result },
    );
  };

  const reset = (): void => {
    draft.reset();
    attemptRef.current = null;
    setStatus({ kind: 'idle' });
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
      {context.contentTypes.length === 0 ? (
        <p role="status">
          No active content types are available to this designer.
        </p>
      ) : null}
      {csrfToken.length === 0 ? (
        <p role="status">Reload to restore the protected form session.</p>
      ) : null}
      <CmsTemplateStatus status={status} summaryRef={summaryRef} />
      <form
        onSubmit={(event) => void submit(event)}
        onFocus={warmCmsValidators}
        noValidate
      >
        {/* FE03 1048 `commandState` loading: only the commit control is withheld while pending. */}
        <fieldset disabled={status.kind === 'created'}>
          <legend>Template definition</legend>
          <CmsTemplateFields
            contentTypes={context.contentTypes}
            templateKey={draft.templateKey}
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
            registeredBlocks={context.registeredBlocks}
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
            disabled={cannotSubmit || status.kind === 'pending'}
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
