import { ApiErrorSchema } from '@wejammin/contracts';

/**
 * What a protected CMS editorial page does with a non-200 answer from its
 * first-party read. Every status becomes one fixed, non-disclosing state: the
 * copy is written here, never taken from the response, so a hidden entry and an
 * absent one read identically and no provider detail can reach the page
 * (FE03 "Error and Recovery").
 */
export type CmsEditorialPageSubject =
  | 'entry'
  | 'entries'
  | 'conflict'
  | 'history'
  | 'workflow'
  | 'review'
  | 'reviews';

export interface CmsEditorialPageNotice {
  readonly status: number;
  readonly title: string;
  readonly heading: string;
  readonly message: string;
  /** Where Retry goes (the page itself or its safe starting point), or null. */
  readonly retryHref: string | null;
  /** The support reference of a degraded read, from a verified ApiError. */
  readonly requestId: string | null;
}

export type CmsEditorialPageRedirect = {
  readonly kind: 'redirect';
  readonly location: string;
};

export type CmsEditorialPageNoticeOutcome =
  | { readonly kind: 'notice'; readonly notice: CmsEditorialPageNotice }
  | CmsEditorialPageRedirect;

export const cmsEditorialSignInRedirect = (
  returnTo: string,
): CmsEditorialPageRedirect => ({
  kind: 'redirect',
  location: `/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`,
});

const NOT_FOUND_COPY: Readonly<Record<CmsEditorialPageSubject, string>> = {
  entry: 'This entry is not available.',
  entries: 'The entry list is not available.',
  conflict: 'This conflict is not open.',
  history: 'This entry is not available.',
  workflow: 'This entry or revision is not available.',
  review: 'This review is not available.',
  reviews: 'The review list is not available.',
};

const FORBIDDEN_COPY: Readonly<Record<CmsEditorialPageSubject, string>> = {
  entry: 'This account cannot read this entry.',
  entries: 'This account cannot read the entry list.',
  conflict: 'This account cannot read this conflict.',
  history: 'This account cannot read this entry history.',
  workflow: 'This account cannot read this entry workflow.',
  review: 'This account cannot read this review.',
  reviews: 'This account cannot read the review list.',
};

const requestIdFrom = async (response: Response): Promise<string | null> => {
  try {
    const parsed = ApiErrorSchema.safeParse(await response.clone().json());
    return parsed.success ? parsed.data.requestId : null;
  } catch {
    return null;
  }
};

const retryAfterSeconds = (response: Response): number | null => {
  const raw = response.headers.get('retry-after')?.trim() ?? '';
  if (!/^\d+$/u.test(raw)) return null;
  const seconds = Number(raw);
  return Number.isSafeInteger(seconds) && seconds >= 1 && seconds <= 86_400
    ? seconds
    : null;
};

export interface CmsEditorialNoticeContext {
  readonly subject: CmsEditorialPageSubject;
  /** The page's own address (with its URL-owned state) for sign-in return. */
  readonly returnTo: string;
  /** Where Retry or Start again goes. */
  readonly retryHref: string;
}

/**
 * Maps a non-200 read to a redirect (401) or one fixed notice. The status is
 * the page's own status, so a hidden, absent or closed resource is one 404.
 */
export const cmsEditorialNoticeFor = async (
  response: Response,
  context: CmsEditorialNoticeContext,
): Promise<CmsEditorialPageNoticeOutcome> => {
  const status = response.status;
  if (status === 401) return cmsEditorialSignInRedirect(context.returnTo);
  const make = (
    title: string,
    heading: string,
    message: string,
    retryHref: string | null = null,
    requestId: string | null = null,
  ): CmsEditorialPageNoticeOutcome => ({
    kind: 'notice',
    notice: { status, title, heading, message, retryHref, requestId },
  });
  if (status === 403)
    return make(
      'Access denied',
      'Access denied',
      FORBIDDEN_COPY[context.subject],
    );
  if (status === 404)
    return make('Not found', 'Not found', NOT_FOUND_COPY[context.subject]);
  if (status === 400 || status === 422)
    return make(
      'Invalid request',
      'Invalid request',
      'This request could not be read. Check the address and try again.',
      context.retryHref,
    );
  if (status === 409)
    return make(
      'List position is no longer valid',
      'List position is no longer valid',
      'This position can no longer be reopened. Start again from the first page.',
      context.retryHref,
    );
  if (status === 429) {
    const seconds = retryAfterSeconds(response);
    return make(
      'Too many requests',
      'Too many requests',
      seconds === null
        ? 'Too many requests. Try again shortly.'
        : `Too many requests. Try again in ${seconds} seconds.`,
      context.retryHref,
    );
  }
  return make(
    'Temporarily unavailable',
    'Temporarily unavailable',
    'The editorial service is not responding. Nothing was loaded; try again shortly.',
    context.retryHref,
    await requestIdFrom(response),
  );
};

/** A 200 whose body is not the strict contract: nothing is rendered from it. */
export const cmsEditorialUnverifiedNotice = (
  title: string,
): CmsEditorialPageNoticeOutcome => ({
  kind: 'notice',
  notice: {
    status: 502,
    title,
    heading: 'Temporarily unavailable',
    message:
      'The editorial service returned data that could not be verified. Nothing was loaded.',
    retryHref: null,
    requestId: null,
  },
});
