import { useCallback, useEffect, useRef, useState } from 'react';
import type { TemplateVersionDetail } from '@wejammin/contracts';

import type { CmsTemplateFormStatus } from './CmsTemplateStatus';
import type {
  EditableBinding,
  EditableSlot,
} from './cms-template-designer-form-types';
import { readLatestCmsTemplateVersion } from './cms-template-edit-reconcile';
import { templateDetailToDraftFields } from './cms-template-designer-request';

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
  const [checkingLatest, setCheckingLatest] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const attemptRef = useRef<{ body: string; key: string } | null>(null);
  const confirmedConflict =
    status.kind === 'result' && status.result.kind === 'conflict';

  useEffect(() => {
    if (status.kind !== 'idle' && status.kind !== 'pending')
      summaryRef.current?.focus();
  }, [status]);

  const checkLatest = useCallback(async (): Promise<void> => {
    if (checkingLatest) return;
    setCheckingLatest(true);
    setLatestError('');
    const result = await readLatestCmsTemplateVersion(detail.templateKey);
    setCheckingLatest(false);
    if (result.kind === 'loaded') {
      if (!cmsTemplateLatestIdentityValid(baseDetail, result.detail)) {
        setLatest(null);
        setLatestError('The latest version could not be verified. Reload.');
        return;
      }
      // A definite 409 ends this logical attempt. Once an explicit protected
      // read confirms the same parent, the next submit needs a new key; an
      // uncertain response must keep its key for safe replay.
      if (result.detail.version === baseDetail.version && confirmedConflict)
        attemptRef.current = null;
      setLatest(result.detail);
      return;
    }
    setLatest(null);
    setLatestError(
      result.kind === 'rejected' && result.status === 401
        ? 'Your session expired. Sign in again.'
        : result.kind === 'rejected' && result.status === 403
          ? 'Template designer access is required for this acting context.'
          : result.kind === 'rejected' && result.status === 404
            ? 'This template is unavailable to the current acting context.'
            : 'The latest version is unavailable. Wait and try again.',
    );
  }, [baseDetail, checkingLatest, confirmedConflict, detail.templateKey]);

  const useLatestAsParent = useCallback((): void => {
    if (latest === null || BigInt(latest.version) <= BigInt(baseDetail.version))
      return;
    setBaseDetail(latest);
    setLatest(null);
    setLatestError('');
    attemptRef.current = null;
    setStatus({ kind: 'idle' });
  }, [baseDetail.version, latest]);

  const beginAttempt = useCallback((serializedBody: string): string => {
    const existing = attemptRef.current;
    if (existing !== null && existing.body === serializedBody)
      return existing.key;
    const key = crypto.randomUUID();
    attemptRef.current = { body: serializedBody, key };
    return key;
  }, []);

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
    latestError,
    checkingLatest,
    checkLatest,
    useLatestAsParent,
    beginAttempt,
  };
};
