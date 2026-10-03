import type {
  ContentSchemaRegistryError,
  ContentSchemaRegistryResult,
} from '../../../apps/worker/src/content-schema-registry/types';
import { ACTIVE_GRANT_CONFLICT_CODE } from '../../../apps/worker/src/content-schema-registry/error-detail-values';

export const ok = <T>(value: T): ContentSchemaRegistryResult<T> => ({
  ok: true,
  value,
});

export const fail = (
  status: ContentSchemaRegistryError['status'],
  code: string,
  message: string,
  details: Readonly<Record<string, unknown>> = {},
): ContentSchemaRegistryError => ({
  ok: false,
  status,
  code,
  message,
  details,
});

export const notFound = (): ContentSchemaRegistryError =>
  fail(404, 'NOT_FOUND', 'The requested CMS registry resource was not found.');

export const forbidden = (reasonCode: string): ContentSchemaRegistryError =>
  fail(403, 'FORBIDDEN', 'The action is not allowed.', { reasonCode });

export const versionMismatch = (): ContentSchemaRegistryError =>
  fail(
    409,
    'VERSION_MISMATCH',
    'The CMS registry resource changed; reload and try again.',
  );

export const conflict = (reasonCode: string): ContentSchemaRegistryError =>
  fail(
    409,
    'CONFLICT',
    'The CMS registry operation conflicts with current state.',
    {
      reasonCode,
    },
  );

/**
 * CMS-03A-15 against an existing active aggregate: the internal code the production
 * adapter derives from the database's DETAIL ACTIVE_GRANT_EXISTS, so the real route
 * answers 409 CONFLICT with recoveryAction `renew`, exactly as against the database.
 */
export const activeGrantConflict = (): ContentSchemaRegistryError =>
  fail(
    409,
    ACTIVE_GRANT_CONFLICT_CODE,
    'The CMS registry operation conflicts with current state.',
    { reasonCode: 'active_grant_exists' },
  );

export const invalid = (reasonCode: string): ContentSchemaRegistryError =>
  fail(
    422,
    'VALIDATION_FAILED',
    'The CMS registry request failed validation.',
    {
      reasonCode,
    },
  );

export const unavailable = (): ContentSchemaRegistryError =>
  fail(
    503,
    'DEPENDENCY_UNAVAILABLE',
    'CMS registry persistence is temporarily unavailable.',
    {
      dependencyClass: 'cms_registry',
      retryable: true,
    },
  );
