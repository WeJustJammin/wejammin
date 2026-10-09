import { cmsReviewAssignmentExpiryCeiling } from '@wejammin/contracts';

/**
 * The client-side bound of a reviewer assignment's expiry (BE03b, DEC-136): after
 * now, at most seven days from now and no later than the end of the chosen
 * reviewer's `cms.reviewer` grant. The grantor's own authority end is known only
 * to the server, which stays authoritative (422 `expiry_out_of_bounds`).
 */
export type ExpiryResult =
  | { readonly ok: true; readonly instant: string }
  | { readonly ok: false; readonly message: string };

const MINUTE_MS = 60_000;

/** `YYYY-MM-DDTHH:mm` in the browser's zone, the `datetime-local` value format. */
export const localInputValue = (ms: number): string => {
  const date = new Date(Math.floor(ms / MINUTE_MS) * MINUTE_MS);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const parseAssignmentExpiry = (
  localValue: string,
  nowMs: number,
  reviewerEndsAt: string | null,
): ExpiryResult => {
  if (localValue === '')
    return { ok: false, message: 'Choose when the assignment ends.' };
  const ms = new Date(localValue).getTime();
  if (Number.isNaN(ms))
    return { ok: false, message: 'Choose a valid date and time.' };
  if (ms <= nowMs)
    return { ok: false, message: 'Choose a time in the future.' };
  const ceiling = cmsReviewAssignmentExpiryCeiling(
    nowMs,
    reviewerEndsAt === null
      ? Number.POSITIVE_INFINITY
      : Date.parse(reviewerEndsAt),
    Number.POSITIVE_INFINITY,
  );
  if (ms > ceiling)
    return {
      ok: false,
      message:
        'Choose a time within seven days that ends before the reviewer’s access ends.',
    };
  return { ok: true, instant: new Date(ms).toISOString() };
};
