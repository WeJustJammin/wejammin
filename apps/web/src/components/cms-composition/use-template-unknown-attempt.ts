import { useEffect, useRef, useState } from 'react';
import type {
  TemplateDesignerContext,
  TemplateVersionDetail,
  TemplateVersionRequest,
} from '@wejammin/contracts';

import type { CmsValidators } from '../../lib/cms-contract-validators';
import type { CmsTemplateFormStatus } from './CmsTemplateStatus';
import {
  buildCmsTemplateSuccessorRequest,
  type CmsTemplateDraftFields,
} from './cms-template-designer-request';
import {
  submitCmsTemplateSuccessorDraft,
  type CmsTemplateSubmitResult,
} from './cms-template-designer-submit';
import { CMS_TEMPLATE_CHECK_UNAVAILABLE_MESSAGE } from './use-cms-template-validators';

type Phase = 'ready' | 'sending' | 'unknown' | 'conflict' | 'created';
type Base = Pick<
  TemplateVersionDetail,
  'id' | 'version' | 'contentHash' | 'templateKey' | 'templateId'
>;
interface Attempt {
  readonly request: TemplateVersionRequest;
  readonly body: string;
  readonly key: string;
  readonly base: Base;
}
interface Submission {
  readonly fields: CmsTemplateDraftFields;
  readonly context: TemplateDesignerContext;
  readonly base: TemplateVersionDetail;
  readonly csrfToken: string;
  readonly obtain: () => Promise<CmsValidators | null>;
  readonly onRateLimit: (seconds: number) => void;
}

/** One immutable attempt owns admission until its protected canonical read resolves it. */
export const useTemplateUnknownAttempt = (
  detail: TemplateVersionDetail,
  onStatus: (status: CmsTemplateFormStatus) => void,
) => {
  const attempt = useRef<Attempt | null>(null);
  const phase = useRef<Phase>('ready');
  const submitting = useRef(false);
  const reading = useRef(false);
  const active = useRef(true);
  const generation = useRef(0);
  const writeRetryAt = useRef(0);
  const readRetryAt = useRef(0);
  const [blocked, setBlocked] = useState(false);
  const [checking, setChecking] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    active.current = true;
    // A changed detail invalidates completions, never the possibly sent attempt.
    if (phase.current === 'sending') {
      // The possibly sent attempt is now an unknown outcome: publish it so the
      // manual protected read is offered (FE03 :1214, no false success).
      phase.current = 'unknown';
      onStatus({ kind: 'result', result: { kind: 'uncertain' } });
    }
    submitting.current = false;
    reading.current = false;
    setBlocked(
      phase.current === 'unknown' ||
        phase.current === 'conflict' ||
        phase.current === 'created',
    );
    setChecking(false);
    setPending(false);
    return () => {
      active.current = false;
      generation.current += 1;
      submitting.current = false;
      reading.current = false;
    };
  }, [detail.id, detail.version, detail.contentHash, detail.templateKey]);

  const current = (token: number): boolean =>
    active.current && token === generation.current;
  const refreshBlocked = (): void =>
    setBlocked(
      submitting.current ||
        reading.current ||
        phase.current === 'unknown' ||
        phase.current === 'conflict' ||
        phase.current === 'created',
    );
  const transition = (next: Phase): void => {
    phase.current = next;
    refreshBlocked();
  };
  const snapshot = (
    request: TemplateVersionRequest,
    base: TemplateVersionDetail,
  ): Attempt => {
    const body = JSON.stringify(request);
    if (attempt.current?.body === body) return attempt.current;
    const next = Object.freeze({
      request: Object.freeze(structuredClone(request)),
      body,
      key: crypto.randomUUID(),
      base: Object.freeze({
        id: base.id,
        version: base.version,
        contentHash: base.contentHash,
        templateKey: base.templateKey,
        templateId: base.templateId,
      }),
    });
    attempt.current = next;
    return next;
  };
  const accept = (
    result: CmsTemplateSubmitResult,
    options: Submission,
  ): void => {
    transition(
      result.kind === 'uncertain'
        ? 'unknown'
        : result.kind === 'conflict'
          ? 'conflict'
          : result.kind === 'created'
            ? 'created'
            : 'ready',
    );
    if (
      result.kind === 'rejected' &&
      result.status === 429 &&
      result.retryAfterSeconds !== undefined
    ) {
      writeRetryAt.current = Date.now() + result.retryAfterSeconds * 1_000;
      options.onRateLimit(result.retryAfterSeconds);
    }
    onStatus(
      result.kind === 'created'
        ? { kind: 'created', resource: result.resource }
        : { kind: 'result', result },
    );
  };

  const submit = async (options: Submission): Promise<void> => {
    // This synchronous guard precedes lazy validation and every status change.
    if (
      !active.current ||
      submitting.current ||
      reading.current ||
      phase.current !== 'ready' ||
      Date.now() < writeRetryAt.current
    )
      return;
    const token = generation.current;
    submitting.current = true;
    setPending(true);
    refreshBlocked();
    try {
      const validators = await options.obtain();
      if (!current(token)) return;
      if (validators === null) {
        onStatus({
          kind: 'validation',
          message: CMS_TEMPLATE_CHECK_UNAVAILABLE_MESSAGE,
        });
        return;
      }
      const prepared = buildCmsTemplateSuccessorRequest(
        validators,
        options.fields,
        options.context,
        options.base,
      );
      if (!prepared.ok) {
        onStatus({ kind: 'validation', message: prepared.message });
        return;
      }
      const original = snapshot(prepared.value, options.base);
      transition('sending');
      onStatus({ kind: 'pending' });
      const result = await submitCmsTemplateSuccessorDraft(
        validators,
        original.request,
        options.csrfToken,
        original.key,
      );
      if (current(token)) accept(result, options);
    } finally {
      if (current(token)) {
        submitting.current = false;
        setPending(false);
        refreshBlocked();
      }
    }
  };

  return {
    blocked,
    pending,
    checking,
    submit,
    baseForRead: (fallback: TemplateVersionDetail): Base =>
      attempt.current?.base ?? fallback,
    beginRead: (): number | null => {
      if (
        !active.current ||
        submitting.current ||
        reading.current ||
        Date.now() < readRetryAt.current
      )
        return null;
      if (phase.current === 'ready')
        phase.current = attempt.current === null ? 'conflict' : 'unknown';
      reading.current = true;
      setChecking(true);
      refreshBlocked();
      return generation.current;
    },
    finishRead: (token: number): boolean => {
      if (!current(token)) return false;
      reading.current = false;
      setChecking(false);
      refreshBlocked();
      return true;
    },
    verified: (latest: TemplateVersionDetail): void => {
      const original = attempt.current;
      if (original !== null && latest.version !== original.base.version) return;
      if (phase.current === 'conflict') attempt.current = null;
      // An unknown attempt keeps its exact key/body after verified not-saved.
      transition('ready');
    },
    waitForRead: (seconds: number): void => {
      readRetryAt.current = Date.now() + seconds * 1_000;
    },
    rebase: (): boolean => {
      if (!active.current || submitting.current || reading.current)
        return false;
      attempt.current = null;
      transition('ready');
      return true;
    },
  };
};
