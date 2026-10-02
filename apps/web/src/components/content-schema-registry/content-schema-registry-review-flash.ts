import type { SchemaReviewResource } from './content-schema-registry-types';

/**
 * FE03 CMS-03A-12 / CMS-03A-14: a successful decision or assignment ends in a
 * redirect back to the review route, so the 201/200 body is unreadable to the
 * browser. The runtime leaves a one-shot, tab-scoped, identifier-free note and
 * the refreshed review announces it with the counts it was just rendered with.
 */

const KEY = 'wj:cms-review-flash';

export type ReviewFlash =
  | { readonly kind: 'decision'; readonly decision: 'approve' | 'reject' }
  | {
      readonly kind: 'assignment';
      readonly action: 'create';
      readonly expiresAt: string;
    }
  | { readonly kind: 'assignment'; readonly action: 'revoke' };

type FlashStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u;

/** Build the flash for a submitted native form, or null for other operations. */
export const reviewFlashFor = (
  operationId: string,
  formData: FormData,
): ReviewFlash | null => {
  if (operationId === 'CMS-03A-12') {
    const decision = formData.get('decision');
    return decision === 'approve' || decision === 'reject'
      ? { kind: 'decision', decision }
      : null;
  }
  if (operationId === 'CMS-03A-14') {
    if (formData.get('action') === 'revoke')
      return { kind: 'assignment', action: 'revoke' };
    const expiresAt = formData.get('expiresAt');
    return typeof expiresAt === 'string' && INSTANT.test(expiresAt)
      ? { kind: 'assignment', action: 'create', expiresAt }
      : null;
  }
  return null;
};

export const writeReviewFlash = (
  storage: FlashStorage | null,
  flash: ReviewFlash,
): void => {
  try {
    storage?.setItem(KEY, JSON.stringify(flash));
  } catch {
    // Storage may be blocked; the refreshed counts still render.
  }
};

const isFlash = (value: unknown): value is ReviewFlash => {
  if (typeof value !== 'object' || value === null) return false;
  const flash = value as Record<string, unknown>;
  if (flash.kind === 'decision')
    return flash.decision === 'approve' || flash.decision === 'reject';
  if (flash.kind !== 'assignment') return false;
  if (flash.action === 'revoke') return true;
  return (
    flash.action === 'create' &&
    typeof flash.expiresAt === 'string' &&
    INSTANT.test(flash.expiresAt)
  );
};

/** Read and consume the note; a malformed value is dropped. */
export const takeReviewFlash = (
  storage: FlashStorage | null,
): ReviewFlash | null => {
  if (storage === null) return null;
  try {
    const raw = storage.getItem(KEY);
    if (raw === null) return null;
    storage.removeItem(KEY);
    const parsed: unknown = JSON.parse(raw);
    return isFlash(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

/** The polite announcement for the review as it was just rendered. */
export const reviewFlashMessage = (
  flash: ReviewFlash,
  review: SchemaReviewResource,
): string => {
  if (flash.kind === 'decision')
    return `Your ${flash.decision} decision was recorded. ${review.recordedDecisionCount} of ${review.requiredDecisionCount} required decisions are recorded.`;
  return flash.action === 'revoke'
    ? 'Reviewer assignment revoked.'
    : `Reviewer assignment is active. Access ends ${flash.expiresAt}.`;
};
