import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  TemplateDesignerContext,
  TemplateVersionRequest,
  TemplateVersionResource,
} from '@wejammin/contracts';

import type { CmsTemplateFormStatus } from './CmsTemplateStatus';
import {
  buildCmsTemplateDraftRequest,
  type CmsTemplateDraftFields,
} from './cms-template-designer-request';
import { submitCmsTemplateDraft } from './cms-template-designer-submit';
import { useCmsTemplateRateWait } from './cms-template-rate-wait';
import { focusCmsTemplateResult } from './cms-template-result-focus';
import { useReconcileOnOutcome } from './use-reconcile-on-outcome';
import { useTemplateRegistry } from './use-template-registry';
import { useCmsTemplateCreateReconcile } from './use-cms-template-create-reconcile';
import {
  CMS_TEMPLATE_CHECK_UNAVAILABLE_MESSAGE,
  useCmsTemplateValidators,
} from './use-cms-template-validators';

interface Attempt {
  readonly body: string;
  readonly key: string;
  readonly request: TemplateVersionRequest;
}

/** All state and commands of the create designer; the component only renders. */
export const useCmsTemplateCreate = (
  initialContext: TemplateDesignerContext,
  csrfToken: string,
) => {
  const [status, setStatus] = useState<CmsTemplateFormStatus>({ kind: 'idle' });
  const result = status.kind === 'result' ? status.result : null;
  const registry = useTemplateRegistry(initialContext, status);
  const context = registry.context;
  const summaryRef = useRef<HTMLDivElement>(null);
  const attemptRef = useRef<Attempt | null>(null);
  const gate = useCmsTemplateValidators();
  const rateWait = useCmsTemplateRateWait();
  const created = useCallback((resource: TemplateVersionResource): void => {
    attemptRef.current = null;
    setStatus({ kind: 'created', resource });
  }, []);
  const reconcile = useCmsTemplateCreateReconcile({
    // A read is only ever started by an outcome of a send, which stored its attempt first.
    attempt: () => attemptRef.current!.request,
    onCreated: created,
  });
  const cannotSubmit =
    context.contentTypes.length === 0 ||
    csrfToken.length === 0 ||
    rateWait.waiting ||
    registry.holding;

  useEffect(() => {
    if (status.kind !== 'idle' && status.kind !== 'pending')
      focusCmsTemplateResult(summaryRef.current);
  }, [status]);

  const unknown = result?.kind === 'uncertain';
  const plainConflict =
    result?.kind === 'conflict' && result.reasonCode === undefined;
  // FE03 1048 `commandState` (DEC-242 item 3): a 409 "refetches" and an unknown outcome "reconciles by refetching
  // ... before any retry", both by themselves. The closed registry-digest 409 has no template to compare.
  useReconcileOnOutcome(
    unknown || plainConflict,
    () => void reconcile.check(unknown ? 'unknown' : 'conflict'),
  );
  // An unknown outcome holds every retry until a read verified it (a failed or running read is not a verdict).
  const held =
    unknown &&
    (reconcile.state.kind === 'none' ||
      reconcile.state.kind === 'checking' ||
      reconcile.state.kind === 'failed');

  const submit = async (
    fields: CmsTemplateDraftFields,
    remember: () => void,
  ): Promise<void> => {
    if (
      cannotSubmit ||
      held ||
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
    const prepared = buildCmsTemplateDraftRequest(validators, fields, context);
    if (!prepared.ok) {
      setStatus({ kind: 'validation', message: prepared.message });
      return;
    }
    const body = JSON.stringify(prepared.value);
    const key =
      attemptRef.current?.body === body
        ? attemptRef.current.key
        : crypto.randomUUID();
    attemptRef.current = { body, key, request: prepared.value };
    remember();
    reconcile.clear();
    setStatus({ kind: 'pending' });
    const answer = await submitCmsTemplateDraft(
      validators,
      prepared.value,
      csrfToken,
      key,
    );
    if (
      answer.kind === 'rejected' &&
      answer.status === 429 &&
      answer.retryAfterSeconds !== undefined
    )
      rateWait.start(answer.retryAfterSeconds);
    setStatus(
      answer.kind === 'created'
        ? { kind: 'created', resource: answer.resource }
        : { kind: 'result', result: answer },
    );
  };

  const reset = (): void => {
    attemptRef.current = null;
    reconcile.clear();
    setStatus({ kind: 'idle' });
  };

  return {
    status,
    summaryRef,
    cannotSubmit,
    held,
    submit,
    reset,
    reconcile,
    context,
    registry,
    /** The read control is offered after a plain 409 or an unknown outcome. */
    offered: unknown || plainConflict,
    check: () => void reconcile.check(unknown ? 'unknown' : 'conflict'),
  };
};
