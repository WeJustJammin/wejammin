import type { GovernedActivationRequest } from '@wejammin/contracts';
import { isCmsVersion } from '@wejammin/contracts/client';

import {
  hasExactly,
  isRecord,
  type GovernedCommandSpec,
} from './governed-review-command-specs';
import { GOVERNED_ROUTE_BASE } from './governed-review-routes';

/**
 * CMS-03C-09 in the browser: activate, schedule or retire a definition version
 * (BE03c row 171, DEC-190). Like the other governed commands the request is
 * built by code from server-verified data and checked here only for its exact
 * member set; the same-origin proxy has already parsed the strict resource and
 * bound it to the request. What the browser repeats is the identity binding: the
 * review, the action, the version each action must be answered at (an
 * activation and a retirement advance the review by one, a scheduled acceptance
 * leaves it) and, for a schedule, the instant the person was shown.
 */

/** What a committed activation proves to the form that sent it. */
export interface GovernedActivationCommitted {
  /** The review version after the command: the new strong ETag and the next `expectedVersion`. */
  readonly version: string;
  readonly reviewId: string;
  readonly action: 'activate' | 'schedule' | 'retire';
  readonly subjectKind: string;
  readonly subjectVersion: number;
  /** DEC-191: the definition version this activation superseded; null for a schedule, a retirement and a first activation. */
  readonly supersededVersion: number | null;
  readonly subjectState: 'active' | 'scheduled' | 'retired';
  readonly activatedAt: string | null;
  readonly scheduledForUtc: string | null;
}

const INSTANT_TOLERANCE_MS = 1;
const TZDB_VERSION = /^[A-Za-z0-9._-]{1,32}$/u;
const DISAMBIGUATIONS: readonly string[] = ['none', 'earlier', 'later'];
const SUBJECT_STATE: Readonly<
  Record<
    GovernedActivationCommitted['action'],
    GovernedActivationCommitted['subjectState']
  >
> = { activate: 'active', schedule: 'scheduled', retire: 'retired' };

const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const instantValid = (value: unknown): boolean =>
  isRecord(value) &&
  hasExactly(value, [
    'localDateTime',
    'timezone',
    'resolvedUtc',
    'tzdbVersion',
    'disambiguation',
  ]) &&
  isText(value.localDateTime) &&
  isText(value.timezone) &&
  isText(value.resolvedUtc) &&
  !Number.isNaN(Date.parse(value.resolvedUtc)) &&
  typeof value.tzdbVersion === 'string' &&
  TZDB_VERSION.test(value.tzdbVersion) &&
  typeof value.disambiguation === 'string' &&
  DISAMBIGUATIONS.includes(value.disambiguation);

const requestValid = (body: GovernedActivationRequest): boolean => {
  if (!isCmsVersion(body.expectedVersion)) return false;
  switch (body.action) {
    case 'activate':
      return hasExactly(body, ['action', 'expectedVersion']);
    case 'schedule':
      return (
        hasExactly(body, ['action', 'expectedVersion', 'activateAt']) &&
        instantValid(body.activateAt)
      );
    case 'retire':
      return (
        hasExactly(body, ['action', 'expectedVersion'], ['reason']) &&
        (body.reason === undefined || isText(body.reason))
      );
    default:
      return false;
  }
};

/** The contract's `z.number().int().positive().nullable()`, and only an immediate activation names one. */
const supersededValid = (action: unknown, value: unknown): boolean =>
  value === null
    ? true
    : action === 'activate' &&
      typeof value === 'number' &&
      Number.isSafeInteger(value) &&
      value > 0;

const asCommitted = (value: unknown): GovernedActivationCommitted | null => {
  if (!isRecord(value)) return null;
  const { action, subjectState, reviewVersion, reviewId } = value;
  return (action === 'activate' ||
    action === 'schedule' ||
    action === 'retire') &&
    subjectState === SUBJECT_STATE[action] &&
    supersededValid(action, value.supersededVersion) &&
    typeof reviewVersion === 'string' &&
    typeof reviewId === 'string' &&
    typeof value.subjectKind === 'string' &&
    Number.isInteger(value.subjectVersion) &&
    (value.activatedAt === null || typeof value.activatedAt === 'string') &&
    (value.scheduledForUtc === null ||
      typeof value.scheduledForUtc === 'string')
    ? {
        version: reviewVersion,
        reviewId,
        action,
        subjectKind: value.subjectKind,
        subjectVersion: value.subjectVersion as number,
        supersededVersion: value.supersededVersion as number | null,
        subjectState: SUBJECT_STATE[action],
        activatedAt: value.activatedAt,
        scheduledForUtc: value.scheduledForUtc,
      }
    : null;
};

export const GOVERNED_ACTIVATION_SPEC: GovernedCommandSpec<
  GovernedActivationRequest,
  GovernedActivationCommitted
> = {
  operationId: 'CMS-03C-09',
  // The schedule time tokens and the 403 copy are the 03b schedule contract's.
  classifyAs: 'CMS-03B-07',
  hasIfMatch: true,
  requestValid,
  successStatus: (body) => (body.action === 'schedule' ? 202 : 200),
  bound: (ids, body, resource) => {
    const committed = asCommitted(resource);
    if (
      committed === null ||
      committed.reviewId !== ids.reviewId ||
      committed.action !== body.action
    )
      return null;
    if (body.action === 'schedule')
      return committed.version === body.expectedVersion &&
        committed.scheduledForUtc !== null &&
        committed.activatedAt === null &&
        Math.abs(
          Date.parse(committed.scheduledForUtc) -
            Date.parse(body.activateAt.resolvedUtc),
        ) <= INSTANT_TOLERANCE_MS
        ? committed
        : null;
    return committed.version === String(BigInt(body.expectedVersion) + 1n) &&
      committed.scheduledForUtc === null
      ? committed
      : null;
  },
  location: (ids) => `${GOVERNED_ROUTE_BASE}/${ids.reviewId}`,
};
