import {
  CmsUuidSchema,
  ContentSchemaRegistryDetailSchema,
  ContentSchemaRegistryListPageSchema,
} from '@wejammin/contracts';

import { CONTENT_SCHEMA_REGISTRY_PROJECTION_KEYS } from './content-schema-registry-canonical-keys';
import type { ContentSchemaRegistryStepUpState } from './ContentSchemaRegistryConfirmationStep';
import type {
  ContentSchemaRegistryAccess,
  ContentSchemaRegistryDetailState,
  ContentSchemaRegistryListState,
  ContentSchemaRegistryVariant,
} from './content-schema-registry-types';

/**
 * Exact per-status structural validation for the canonical refetch projection.
 * Every wrapper is checked field-by-field (no unchecked casts); unknown keys or
 * unsupported reason variants fail closed. Successful payloads are validated by
 * the shared public team zod aggregates so no parallel contract is invented.
 */

export interface ContentSchemaRegistryWorkbenchProjection {
  readonly access: ContentSchemaRegistryAccess;
  readonly variant: ContentSchemaRegistryVariant;
  readonly actorId: string | null;
  readonly actingPartyId: string | null;
  readonly requestId: string;
  readonly initialList: ContentSchemaRegistryListState;
  readonly initialDetail: ContentSchemaRegistryDetailState | null;
  readonly actingContextLabel?: string;
  readonly stepUpState?: ContentSchemaRegistryStepUpState;
  readonly stepUpFreshUntil?: string;
}

export {
  applyProjection,
  initialProjectionState,
  toDisabledProjection,
} from './content-schema-registry-canonical-projection-state';
export type { ContentSchemaRegistryProjectionState } from './content-schema-registry-canonical-projection-state';

export class CanonicalStateError extends Error {}

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
  'forbiddenHidden',
  'disabledPrerequisite',
]);
const STEP_UP_VALUES = new Set(['required', 'pending', 'verified']);
const ERROR_CODES = new Set([
  'INVALID_REQUEST',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VALIDATION_FAILED',
  'RATE_LIMITED',
  'DEPENDENCY_INVALID_RESPONSE',
  'DEPENDENCY_UNAVAILABLE',
  'DEPENDENCY_DEADLINE_EXCEEDED',
  'INTERNAL_ERROR',
]);
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
  'requestId',
  'lastVerifiedAt',
  'retryable',
  'httpStatus',
  'retryAfterSeconds',
  'etag',
]);
const DISABLED_KEYS = new Set(['status', 'reason']);
const ERROR_DETAIL_KEYS = new Set(['code', 'message', 'requestId']);

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const requireString = (
  value: Record<string, unknown>,
  key: string,
): string => {
  const entry = value[key];
  if (typeof entry !== 'string' || entry.length === 0)
    throw new CanonicalStateError(key);
  return entry;
};

export const optionalString = (
  value: Record<string, unknown>,
  key: string,
): string | undefined => {
  const entry = value[key];
  if (entry === undefined) return undefined;
  if (typeof entry !== 'string') throw new CanonicalStateError(key);
  return entry;
};

export const rejectUnknownKeys = (
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
): void => {
  for (const key of Object.keys(value))
    if (!allowed.has(key)) throw new CanonicalStateError('unknown');
};

const validateError = (value: unknown): void => {
  if (!isRecord(value)) throw new CanonicalStateError('error');
  rejectUnknownKeys(value, ERROR_DETAIL_KEYS);
  if (!ERROR_CODES.has(requireString(value, 'code')))
    throw new CanonicalStateError('error code');
  requireString(value, 'message');
  requireString(value, 'requestId');
};

const validateRouteMeta = (value: Record<string, unknown>): void => {
  if (value.httpStatus !== undefined && !Number.isInteger(value.httpStatus))
    throw new CanonicalStateError('httpStatus');
  if (
    value.retryAfterSeconds !== undefined &&
    value.retryAfterSeconds !== null &&
    !Number.isInteger(value.retryAfterSeconds)
  )
    throw new CanonicalStateError('retryAfterSeconds');
};

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
    requireString(value, 'requestId');
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
    requireString(value, 'requestId');
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
  const actorId = props.actorId;
  if (
    actorId !== null &&
    (typeof actorId !== 'string' || !CmsUuidSchema.safeParse(actorId).success)
  )
    throw new CanonicalStateError('actorId');
  const actingPartyId = props.actingPartyId;
  if (
    actingPartyId !== null &&
    (typeof actingPartyId !== 'string' ||
      !CmsUuidSchema.safeParse(actingPartyId).success)
  )
    throw new CanonicalStateError('actingPartyId');
  const requestId = requireString(props, 'requestId');
  const actingContextLabel = optionalString(props, 'actingContextLabel');
  const stepUpState = optionalString(props, 'stepUpState');
  if (stepUpState !== undefined && !STEP_UP_VALUES.has(stepUpState))
    throw new CanonicalStateError('stepUp');
  const stepUpFreshUntil = optionalString(props, 'stepUpFreshUntil');
  return {
    access: access as ContentSchemaRegistryAccess,
    variant: variant as ContentSchemaRegistryVariant,
    actorId: (actorId ?? null) as string | null,
    actingPartyId: (actingPartyId ?? null) as string | null,
    requestId,
    initialList: validateListState(props.initialList),
    initialDetail: validateDetailState(props.initialDetail),
    ...(actingContextLabel === undefined ? {} : { actingContextLabel }),
    ...(stepUpState === undefined
      ? {}
      : { stepUpState: stepUpState as ContentSchemaRegistryStepUpState }),
    ...(stepUpFreshUntil === undefined ? {} : { stepUpFreshUntil }),
  };
};
