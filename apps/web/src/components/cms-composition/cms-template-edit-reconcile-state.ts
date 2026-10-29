import { useCallback, useEffect, useRef, useState } from 'react';
import type { TemplateVersionDetail } from '@wejammin/contracts';

import { rateLimitMessage } from '../../lib/rate-limit-message';
import type { CmsTemplateFormStatus } from './CmsTemplateStatus';
import type {
  EditableBinding,
  EditableSlot,
} from './cms-template-designer-form-types';
import { readLatestCmsTemplateVersion } from './cms-template-edit-reconcile';
import { templateDetailToDraftFields } from './cms-template-designer-request';
import { useCmsTemplateRateWait } from './cms-template-rate-wait';
import { focusCmsTemplateResult } from './cms-template-result-focus';
import { useTemplateUnknownAttempt } from './use-template-unknown-attempt';

/** A same-number parent is canonical only when its immutable identity matches. */
export const cmsTemplateLatestIdentityValid = (
  base: Pick<TemplateVersionDetail, 'id' | 'version' | 'contentHash'>,
  latest: Pick<TemplateVersionDetail, 'id' | 'version' | 'contentHash'>,
): boolean =>
  BigInt(latest.version) > BigInt(base.version) ||
  (latest.version === base.version &&
    latest.id === base.id &&
    latest.contentHash === base.contentHash);

/**
 * Local successor-draft state for CmsTemplateEditDesigner. The local form is
 * never overwritten by a concurrent canonical version: rebase is an explicit
 * user action and the idempotency key resets only when the parent changes.
 */
export const useCmsTemplateEditState = (detail: TemplateVersionDetail) => {
  const initial = templateDetailToDraftFields(detail);
  const [baseDetail, setBaseDetail] = useState(detail);
  const [compatibleTypeIds, setCompatibleTypeIds] = useState<string[]>([
    ...initial.compatibleTypeIds,
  ]);
  const [locale, setLocale] = useState(initial.locale);
  const [audience, setAudience] = useState(initial.audience);
  const [extraRegions, setExtraRegions] = useState(initial.extraRegions);
  const [slots, setSlots] = useState<EditableSlot[]>(
    initial.slots.map((slot, index) => ({
      ...slot,
      uiId: 'original-slot-' + String(index),
    })),
  );
  const [bindings, setBindings] = useState<EditableBinding[]>(
    initial.bindings.map((binding, index) => ({
      ...binding,
      uiId: 'original-binding-' + String(index),
    })),
  );
  const [status, setStatus] = useState<CmsTemplateFormStatus>({
    kind: 'idle',
  });
  const [latest, setLatest] = useState<TemplateVersionDetail | null>(null);
  const [latestError, setLatestError] = useState('');
  // FE03 :1172: a 429 of the read is announced politely, not as an alert, and keeps the check
  // off until the stated Retry-After has elapsed; the unsent values are never touched.
  const [latestRateLimited, setLatestRateLimited] = useState(false);
  const [latestRetryAt, setLatestRetryAt] = useState<number | null>(null);
  const [latestRemaining, setLatestRemaining] = useState<number | null>(null);
  const readWait = useCmsTemplateRateWait();
  const startReadWait = readWait.start;
  const summaryRef = useRef<HTMLDivElement>(null);
  const attempt = useTemplateUnknownAttempt(detail, setStatus);

  useEffect(() => {
    if (!latestRateLimited || latestRetryAt === null || !readWait.waiting)
      return;
    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    const update = (): void => {
      if (!active) return;
      const remaining = Math.max(
        0,
        Math.ceil((latestRetryAt - Date.now()) / 1_000),
      );
      setLatestRemaining(remaining);
      if (remaining === 0) {
        if (timer !== null) clearInterval(timer);
        window.removeEventListener('focus', update);
        document.removeEventListener('visibilitychange', update);
      }
    };
    timer = setInterval(update, 1_000);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      active = false;
      if (timer !== null) clearInterval(timer);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [latestRateLimited, latestRetryAt, readWait.waiting]);

  useEffect(() => {
    if (status.kind !== 'idle' && status.kind !== 'pending')
      focusCmsTemplateResult(summaryRef.current);
  }, [status]);

  const checkLatest = useCallback(async (): Promise<void> => {
    if (readWait.waiting) return;
    const token = attempt.beginRead();
    if (token === null) return;
    setLatestError('');
    setLatestRateLimited(false);
    setLatestRetryAt(null);
    setLatestRemaining(null);
    setLatest(null);
    const result = await readLatestCmsTemplateVersion(detail.templateKey);
    if (!attempt.finishRead(token)) return;
    if (result.kind === 'loaded') {
      const originalBase = attempt.baseForRead(baseDetail);
      if (
        !cmsTemplateLatestIdentityValid(originalBase, result.detail) ||
        result.detail.templateKey !== originalBase.templateKey ||
        result.detail.templateId !== originalBase.templateId
      ) {
        setLatest(null);
        setLatestError('The latest version could not be verified. Reload.');
        return;
      }
      attempt.verified(result.detail);
      setLatest(result.detail);
      return;
    }
    setLatest(null);
    if (result.kind === 'rejected' && result.status === 429) {
      const seconds = result.retryAfterSeconds;
      setLatestRemaining(seconds ?? null);
      setLatestRetryAt(
        seconds === undefined ? null : Date.now() + seconds * 1_000,
      );
      if (result.retryAfterSeconds !== undefined) {
        attempt.waitForRead(result.retryAfterSeconds);
        startReadWait(result.retryAfterSeconds);
      }
      setLatestRateLimited(true);
      setLatestError(rateLimitMessage(result.retryAfterSeconds ?? null));
      return;
    }
    setLatestError(
      result.kind === 'rejected' && result.status === 401
        ? 'Your session expired. Sign in again.'
        : result.kind === 'rejected' && result.status === 403
          ? 'Template designer access is required for this acting context.'
          : result.kind === 'rejected' && result.status === 404
            ? 'This template is unavailable to the current acting context.'
            : 'The latest version is unavailable. Wait and try again.',
    );
  }, [
    baseDetail,
    attempt,
    detail.templateKey,
    startReadWait,
    readWait.waiting,
  ]);

  const useLatestAsParent = useCallback((): void => {
    if (latest === null || BigInt(latest.version) <= BigInt(baseDetail.version))
      return;
    if (!attempt.rebase()) return;
    setBaseDetail(latest);
    setLatest(null);
    setLatestError('');
    setLatestRateLimited(false);
    setLatestRetryAt(null);
    setLatestRemaining(null);
    setStatus({ kind: 'idle' });
  }, [attempt, baseDetail.version, latest]);

  return {
    baseDetail,
    compatibleTypeIds,
    setCompatibleTypeIds,
    locale,
    setLocale,
    audience,
    setAudience,
    extraRegions,
    setExtraRegions,
    slots,
    setSlots,
    bindings,
    setBindings,
    status,
    setStatus,
    summaryRef,
    latest,
    latestError:
      latestRateLimited && latestRemaining !== null
        ? readWait.waiting && latestRemaining > 0
          ? rateLimitMessage(latestRemaining)
          : ''
        : latestError,
    latestRateLimited,
    /** True while a 429's stated wait has not elapsed: the check stays off. */
    latestWaiting: readWait.waiting,
    checkingLatest: attempt.checking,
    checkLatest,
    useLatestAsParent,
    submit: attempt.submit,
    writeBlocked: attempt.blocked,
    writePending: attempt.pending,
  };
};
