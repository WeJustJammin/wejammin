import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import type { TemplateDesignerContext } from '@wejammin/contracts';

import CmsTemplateBindings from './CmsTemplateBindings';
import CmsTemplateFields from './CmsTemplateFields';
import CmsTemplateSlots from './CmsTemplateSlots';
import CmsTemplateStatus, {
  type CmsTemplateFormStatus,
} from './CmsTemplateStatus';
import type {
  EditableBinding,
  EditableSlot,
} from './cms-template-designer-form-types';
import { buildCmsTemplateDraftRequest } from './cms-template-designer-request';
import { submitCmsTemplateDraft } from './cms-template-designer-submit';
import { useCmsTemplateRateWait } from './cms-template-rate-wait';

interface Props {
  readonly context: TemplateDesignerContext;
  readonly csrfToken: string;
}

/** One bounded island: only the draft form and its in-flight result hydrate. */
export default function CmsTemplateDesigner({
  context,
  csrfToken,
}: Props): React.ReactElement {
  const [templateKey, setTemplateKey] = useState('');
  const [compatibleTypeIds, setCompatibleTypeIds] = useState<string[]>([]);
  const [locale, setLocale] = useState(
    context.contentTypes[0]?.sourceLocale ?? '',
  );
  const [audience, setAudience] = useState('');
  const [extraRegions, setExtraRegions] = useState('');
  const [slots, setSlots] = useState<EditableSlot[]>([]);
  const [bindings, setBindings] = useState<EditableBinding[]>([]);
  const [status, setStatus] = useState<CmsTemplateFormStatus>({ kind: 'idle' });
  const summaryRef = useRef<HTMLDivElement>(null);
  const attemptRef = useRef<{ body: string; key: string } | null>(null);
  const rateWait = useCmsTemplateRateWait();
  const cannotSubmit =
    context.contentTypes.length === 0 ||
    csrfToken.length === 0 ||
    rateWait.waiting;

  useEffect(() => {
    if (status.kind !== 'idle' && status.kind !== 'pending')
      summaryRef.current?.focus();
  }, [status]);

  const submit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    if (cannotSubmit || status.kind === 'pending' || status.kind === 'created')
      return;
    const prepared = buildCmsTemplateDraftRequest(
      {
        templateKey,
        compatibleTypeIds,
        locale,
        audience,
        extraRegions,
        slots,
        bindings,
      },
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
    setStatus({ kind: 'pending' });
    const result = await submitCmsTemplateDraft(prepared.value, csrfToken, key);
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
    setTemplateKey('');
    setCompatibleTypeIds([]);
    setLocale(context.contentTypes[0]?.sourceLocale ?? '');
    setAudience('');
    setExtraRegions('');
    setSlots([]);
    setBindings([]);
    attemptRef.current = null;
    setStatus({ kind: 'idle' });
  };

  return (
    <section
      className="cms-template-designer"
      aria-labelledby="cms-template-designer-title"
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
      <form onSubmit={(event) => void submit(event)} noValidate>
        <fieldset
          disabled={status.kind === 'pending' || status.kind === 'created'}
        >
          <legend>Template definition</legend>
          <CmsTemplateFields
            contentTypes={context.contentTypes}
            templateKey={templateKey}
            setTemplateKey={setTemplateKey}
            compatibleTypeIds={compatibleTypeIds}
            setCompatibleTypeIds={setCompatibleTypeIds}
            locale={locale}
            setLocale={setLocale}
            audience={audience}
            setAudience={setAudience}
            extraRegions={extraRegions}
            setExtraRegions={setExtraRegions}
          />
          <CmsTemplateSlots
            registeredBlocks={context.registeredBlocks}
            slots={slots}
            setSlots={setSlots}
          />
          <CmsTemplateBindings bindings={bindings} setBindings={setBindings} />
          <p>
            A successful create produces a private draft, not publication or
            activation.
          </p>
          <button type="submit" disabled={cannotSubmit}>
            Create draft
          </button>
        </fieldset>
      </form>
      {status.kind === 'created' ? (
        <button type="button" onClick={reset}>
          Start another draft
        </button>
      ) : null}
    </section>
  );
}
