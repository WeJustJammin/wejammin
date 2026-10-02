import { SchemaReviewResourceSchema } from '@wejammin/contracts';

import {
  CanonicalStateError,
  isRecord,
  rejectUnknownKeys,
  requireString,
  validateError,
  validateRouteMeta,
} from './content-schema-registry-canonical-validate-primitives';
import type { ContentSchemaRegistryReviewState } from './content-schema-registry-review-types';

const IDLE_KEYS = new Set(['status']);
const SUCCESS_KEYS = new Set(['status', 'data', 'version', 'stale']);
const EMPTY_KEYS = new Set(['status', 'reason']);
const ERROR_KEYS = new Set([
  'status',
  'error',
  'retryable',
  'httpStatus',
  'retryAfterSeconds',
]);
const DEGRADED_KEYS = new Set([
  'status',
  'data',
  'requestId',
  'lastVerifiedAt',
  'retryable',
  'httpStatus',
  'retryAfterSeconds',
]);
const DISABLED_KEYS = new Set(['status', 'reason']);

const requireReview = (value: unknown, label: string): void => {
  if (!SchemaReviewResourceSchema.safeParse(value).success)
    throw new CanonicalStateError(label);
};

/**
 * Exact per-status validation of the `reviewState` projection. Successful
 * payloads are checked by the generated strict `SchemaReviewResource`
 * contract; any unknown key or status fails closed.
 */
export const validateReviewState = (
  value: unknown,
): ContentSchemaRegistryReviewState | null => {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) throw new CanonicalStateError('review');
  const status = requireString(value, 'status');
  if (status === 'idle' || status === 'loading') {
    rejectUnknownKeys(value, IDLE_KEYS);
  } else if (status === 'success') {
    rejectUnknownKeys(value, SUCCESS_KEYS);
    requireReview(value.data, 'review data');
    requireString(value, 'version');
    if (typeof value.stale !== 'boolean')
      throw new CanonicalStateError('review stale');
  } else if (status === 'empty') {
    rejectUnknownKeys(value, EMPTY_KEYS);
    if (value.reason !== 'not-disclosed')
      throw new CanonicalStateError('review reason');
  } else if (status === 'error') {
    rejectUnknownKeys(value, ERROR_KEYS);
    validateError(value.error);
    if (typeof value.retryable !== 'boolean')
      throw new CanonicalStateError('review retryable');
    validateRouteMeta(value);
  } else if (status === 'degraded') {
    rejectUnknownKeys(value, DEGRADED_KEYS);
    if (value.data !== null) requireReview(value.data, 'review degraded data');
    requireString(value, 'requestId');
    if (
      value.lastVerifiedAt !== null &&
      typeof value.lastVerifiedAt !== 'string'
    )
      throw new CanonicalStateError('lastVerifiedAt');
    if (value.retryable !== undefined && typeof value.retryable !== 'boolean')
      throw new CanonicalStateError('retryable');
    validateRouteMeta(value);
  } else if (status === 'disabled') {
    rejectUnknownKeys(value, DISABLED_KEYS);
    requireString(value, 'reason');
  } else {
    throw new CanonicalStateError('review status');
  }
  return value as unknown as ContentSchemaRegistryReviewState;
};
