import {
  ContentSchemaRegistryDetailSchema,
  ContentSchemaRegistryListPageSchema,
} from '@wejammin/contracts';

import { CONTENT_SCHEMA_REGISTRY_PROJECTION_KEYS } from './content-schema-registry-canonical-keys';
import type { ContentSchemaRegistryStepUpState } from './ContentSchemaRegistryConfirmationStep';
import type {
  ContentSchemaRegistryAccess,
  ContentSchemaRegistryDetailState,
  ContentSchemaRegistryListState,
  ContentSchemaRegistryReviewState,
  ContentSchemaRegistryVariant,
} from './content-schema-registry-types';
import {
  CanonicalStateError,
  isRecord,
  validateError,
  validateRouteMeta,
  optionalString,
  rejectUnknownKeys,
  requireString,
} from './content-schema-registry-canonical-validate-primitives';
import { validateReviewState } from './content-schema-registry-canonical-review-validate';

/**
 * Exact per-status structural validation for the canonical refetch projection.
 * Every wrapper is checked field-by-field (no unchecked casts); unknown keys or
 * unsupported reason variants fail closed. Successful payloads are validated by
 * the shared public team zod aggregates so no parallel contract is invented.
 */

export interface ContentSchemaRegistryWorkbenchProjection {
  readonly access: ContentSchemaRegistryAccess;
  readonly variant: ContentSchemaRegistryVariant;
  readonly initialList: ContentSchemaRegistryListState;
  readonly initialDetail: ContentSchemaRegistryDetailState | null;
  readonly initialReview: ContentSchemaRegistryReviewState | null;
  readonly actingContextLabel?: string;
  readonly stepUpState?: ContentSchemaRegistryStepUpState;
  readonly stepUpFreshUntil?: string;
}

export { CanonicalStateError } from './content-schema-registry-canonical-validate-primitives';
export {
  applyProjection,
  initialProjectionState,
  toDisabledProjection,
} from './content-schema-registry-canonical-projection-state';
export type { ContentSchemaRegistryProjectionState } from './content-schema-registry-canonical-projection-state';

const ACCESS_VALUES = new Set([
  'full',
  'read-only',
  'disabled',
  'not-rendered',
]);
const VARIANT_VALUES = new Set([
  'degradedPage',
  'entitledRead',
  'ownerFull',
  'guardianMandate',
  'juniorRestricted',
  'businessMandate',
  'staffCaseScoped',
  'adminStepUp',
  'schemaReviewAssigned',
  'forbiddenHidden',
  'disabledPrerequisite',
]);
const STEP_UP_VALUES = new Set(['required', 'pending', 'verified']);
const DEGRADED_CODES = new Set([
  'DEPENDENCY_INVALID_RESPONSE',
  'DEPENDENCY_UNAVAILABLE',
  'DEPENDENCY_DEADLINE_EXCEEDED',
]);
const IDLE_KEYS = new Set(['status', 'preserveSafePriorContent']);
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
  'code',
  'lastVerifiedAt',
  'retryable',
  'httpStatus',
  'retryAfterSeconds',
  'etag',
]);
const DISABLED_KEYS = new Set(['status', 'reason']);
const validateListState = (value: unknown): ContentSchemaRegistryListState => {
  if (!isRecord(value)) throw new CanonicalStateError('list');
  const status = requireString(value, 'status');
  if (status === 'idle' || status === 'loading') {
    rejectUnknownKeys(value, IDLE_KEYS);
  } else if (status === 'success') {
    rejectUnknownKeys(value, SUCCESS_KEYS);
    if (!ContentSchemaRegistryListPageSchema.safeParse(value.data).success)
      throw new CanonicalStateError('list data');
    requireString(value, 'version');
    if (typeof value.stale !== 'boolean')
      throw new CanonicalStateError('list stale');
  } else if (status === 'empty') {
    rejectUnknownKeys(value, EMPTY_KEYS);
    if (value.reason !== 'no-records' && value.reason !== 'filter-miss')
      throw new CanonicalStateError('list reason');
  } else if (status === 'error') {
    rejectUnknownKeys(value, ERROR_KEYS);
    validateError(value.error);
    if (typeof value.retryable !== 'boolean')
      throw new CanonicalStateError('list retryable');
    validateRouteMeta(value);
  } else if (status === 'degraded') {
    rejectUnknownKeys(value, DEGRADED_KEYS);
    if (
      value.data !== null &&
      !ContentSchemaRegistryListPageSchema.safeParse(value.data).success
    )
      throw new CanonicalStateError('list degraded data');
    if (value.code !== undefined && !DEGRADED_CODES.has(String(value.code)))
      throw new CanonicalStateError('list degraded code');
    if (typeof value.lastVerifiedAt !== 'string')
      throw new CanonicalStateError('lastVerifiedAt');
    if (value.retryable !== undefined && typeof value.retryable !== 'boolean')
      throw new CanonicalStateError('retryable');
    validateRouteMeta(value);
  } else if (status === 'disabled') {
    rejectUnknownKeys(value, DISABLED_KEYS);
    requireString(value, 'reason');
  } else {
    throw new CanonicalStateError('list status');
  }
  return value as unknown as ContentSchemaRegistryListState;
};

const validateDetailState = (
  value: unknown,
): ContentSchemaRegistryDetailState | null => {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) throw new CanonicalStateError('detail');
  const status = requireString(value, 'status');
  if (status === 'idle' || status === 'loading') {
    rejectUnknownKeys(value, IDLE_KEYS);
  } else if (status === 'success') {
    rejectUnknownKeys(value, SUCCESS_KEYS);
    if (!ContentSchemaRegistryDetailSchema.safeParse(value.data).success)
      throw new CanonicalStateError('detail data');
    requireString(value, 'version');
    if (typeof value.stale !== 'boolean')
      throw new CanonicalStateError('detail stale');
  } else if (status === 'empty') {
    rejectUnknownKeys(value, EMPTY_KEYS);
    if (value.reason !== 'not-selected' && value.reason !== 'not-found')
      throw new CanonicalStateError('detail reason');
  } else if (status === 'error') {
    rejectUnknownKeys(value, ERROR_KEYS);
    validateError(value.error);
    if (typeof value.retryable !== 'boolean')
      throw new CanonicalStateError('detail retryable');
    validateRouteMeta(value);
  } else if (status === 'degraded') {
    rejectUnknownKeys(value, DEGRADED_KEYS);
    if (
      value.data !== null &&
      !ContentSchemaRegistryDetailSchema.safeParse(value.data).success
    )
      throw new CanonicalStateError('detail degraded data');
    if (value.code !== undefined && !DEGRADED_CODES.has(String(value.code)))
      throw new CanonicalStateError('detail degraded code');
    if (typeof value.lastVerifiedAt !== 'string')
      throw new CanonicalStateError('lastVerifiedAt');
    if (value.retryable !== undefined && typeof value.retryable !== 'boolean')
      throw new CanonicalStateError('retryable');
    validateRouteMeta(value);
  } else if (status === 'disabled') {
    rejectUnknownKeys(value, DISABLED_KEYS);
    requireString(value, 'reason');
  } else {
    throw new CanonicalStateError('detail status');
  }
  return value as unknown as ContentSchemaRegistryDetailState;
};

export const buildProjection = (
  props: unknown,
): ContentSchemaRegistryWorkbenchProjection => {
  if (!isRecord(props)) throw new CanonicalStateError('props');
  rejectUnknownKeys(props, CONTENT_SCHEMA_REGISTRY_PROJECTION_KEYS);
  const access = requireString(props, 'access');
  if (!ACCESS_VALUES.has(access)) throw new CanonicalStateError('access');
  const variant = requireString(props, 'variant');
  if (!VARIANT_VALUES.has(variant)) throw new CanonicalStateError('variant');
  const actingContextLabel = optionalString(props, 'actingContextLabel');
  const stepUpState = optionalString(props, 'stepUpState');
  if (stepUpState !== undefined && !STEP_UP_VALUES.has(stepUpState))
    throw new CanonicalStateError('stepUp');
  const stepUpFreshUntil = optionalString(props, 'stepUpFreshUntil');
  return {
    access: access as ContentSchemaRegistryAccess,
    variant: variant as ContentSchemaRegistryVariant,
    initialList: validateListState(props.initialList),
    initialDetail: validateDetailState(props.initialDetail),
    initialReview: validateReviewState(props.initialReview),
    ...(actingContextLabel === undefined ? {} : { actingContextLabel }),
    ...(stepUpState === undefined
      ? {}
      : { stepUpState: stepUpState as ContentSchemaRegistryStepUpState }),
    ...(stepUpFreshUntil === undefined ? {} : { stepUpFreshUntil }),
  };
};
