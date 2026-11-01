import type { GovernedReviewDetailResource } from '@wejammin/contracts';

import { addClientBindingIdHeader } from '../../lib/client-binding';
import {
  rateLimitWaitSeconds,
  retryingSafeRead,
} from '../../lib/safe-read-retry';
import type { CanonicalReadResult } from '../cms-editorial-workflow/cms-workflow-canonical-read';
import { GOVERNED_ROUTE_BASE } from './governed-review-routes';
import {
  GOVERNED_ACTIVATION_SCHEDULE_REASON_COPY,
  GOVERNED_ACTIVATION_SCHEDULE_STATE_COPY,
  GOVERNED_SUBJECT_KIND_LABEL,
} from './governed-review-labels';
import {
  GOVERNED_REVIEW_STATE_LABEL,
  GOVERNED_SUBJECT_STATE_LABEL,
} from './governed-state-labels';

/**
 * The browser's canonical refetch of a definition review (FE03 Slice 12 states:
 * "the review, subject and lists are refetched" after every command and before
 * any retry of an unknown outcome). A read is no-store, carries no mutation header
 * and is never cached. The same-origin proxy has already parsed the strict
 * resource and bound it to this review and its validator; this check repeats the
 * binding structurally (the island ships no zod, FE03 AC261), so a body that is
 * not this review, or that the page cannot render, leaves the surface `degraded`
 * with its last verified content and every command disabled.
 */
type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

const STRONG_ETAG = /^"[\x21\x23-\x7e]{1,256}"$/u;
const REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/u;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasKey = (table: object, value: unknown): boolean =>
  typeof value === 'string' && Object.hasOwn(table, value);

const ARRAYS = [
  'decisions',
  'assignments',
  'policyBasis',
  'requiredCapabilities',
  'permittedNextActions',
] as const;
const NUMBERS = [
  'subjectVersion',
  'requiredDecisionCount',
  'recordedDecisionCount',
  'distinctApprovalCount',
] as const;
const STRINGS = [
  'subjectKey',
  'subjectHash',
  'policyBasisHash',
  'riskClass',
  'submittedAt',
  'version',
] as const;

/**
 * DEC-191: the schedule is null or exactly `{state, reasonCode}` with a state and
 * a reason the page can word, and a reason exactly for a blocked or cancelled one.
 */
const scheduleSound = (value: unknown): boolean => {
  if (value === null) return true;
  if (!isRecord(value) || Object.keys(value).length !== 2) return false;
  const { state, reasonCode } = value;
  const closed = state === 'blocked' || state === 'cancelled';
  return (
    hasKey(GOVERNED_ACTIVATION_SCHEDULE_STATE_COPY, state) &&
    (reasonCode === null
      ? !closed
      : closed && hasKey(GOVERNED_ACTIVATION_SCHEDULE_REASON_COPY, reasonCode))
  );
};

const verified = (
  body: unknown,
  etag: string,
  reviewId: string,
): GovernedReviewDetailResource | null => {
  if (!isRecord(body) || body.id !== reviewId) return null;
  const sound =
    ARRAYS.every((key) => Array.isArray(body[key])) &&
    NUMBERS.every((key) => Number.isInteger(body[key])) &&
    STRINGS.every((key) => typeof body[key] === 'string') &&
    hasKey(GOVERNED_REVIEW_STATE_LABEL, body.state) &&
    hasKey(GOVERNED_SUBJECT_KIND_LABEL, body.subjectKind) &&
    hasKey(GOVERNED_SUBJECT_STATE_LABEL, body.subjectState) &&
    scheduleSound(body.activationSchedule);
  return sound && etag === `"${String(body.version)}"`
    ? (body as unknown as GovernedReviewDetailResource)
    : null;
};

/** CMS-03C-10 through the first-party proxy. */
export const readCanonicalGovernedReview = async (
  reviewId: string,
  fetcher: Fetcher = fetch,
): Promise<CanonicalReadResult<GovernedReviewDetailResource>> => {
  const path = `${GOVERNED_ROUTE_BASE}/${encodeURIComponent(reviewId)}`;
  let response: Response;
  try {
    // FE03 :1173: a 502/503/504 the BE declares safe is retried twice (250 ms, 750 ms).
    response = await retryingSafeRead(async () =>
      fetcher(
        path,
        await addClientBindingIdHeader(path, {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          redirect: 'manual',
          headers: { accept: 'application/json' },
        }),
      ),
    );
  } catch {
    return { kind: 'degraded', requestId: null };
  }
  if (response.status === 401) return { kind: 'signed-out' };
  if (response.status === 403 || response.status === 404)
    return { kind: 'gone' };
  let body: unknown = null;
  try {
    body = await response.clone().json();
  } catch {
    // An unreadable body is degraded below.
  }
  if (response.status === 200) {
    const etag = response.headers.get('etag');
    const resource =
      etag !== null && STRONG_ETAG.test(etag)
        ? verified(body, etag, reviewId)
        : null;
    if (resource !== null) return { kind: 'ok', resource };
  }
  const stated = isRecord(body) ? body.requestId : undefined;
  const requestId =
    typeof stated === 'string' && REQUEST_ID.test(stated) ? stated : null;
  // FE03 :1172: a 429 waits for Retry-After; the surface announces it and keeps its content.
  if (response.status === 429)
    return {
      kind: 'degraded',
      requestId,
      rateLimit: { retryAfterSeconds: await rateLimitWaitSeconds(response) },
    };
  return { kind: 'degraded', requestId };
};
