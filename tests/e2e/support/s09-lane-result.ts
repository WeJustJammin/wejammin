import type {
  ContentSchemaRegistryError,
  ContentSchemaRegistryResult,
} from '../../../apps/worker/src/content-schema-registry/types';

export const ok = <T>(value: T): ContentSchemaRegistryResult<T> => ({
  ok: true,
  value,
});

export const fail = (
  status: ContentSchemaRegistryError['status'],
  code: string,
  message: string,
  details: Readonly<Record<string, unknown>> = {},
): ContentSchemaRegistryError => ({ ok: false, status, code, message, details });

export const notFound = (): ContentSchemaRegistryError =>
  fail(404, 'NOT_FOUND', 'The requested CMS registry resource was not found.');

export const forbidden = (reasonCode: string): ContentSchemaRegistryError =>
  fail(403, 'FORBIDDEN', 'The action is not allowed.', { reasonCode });

export const versionMismatch = (): ContentSchemaRegistryError =>
  fail(409, 'VERSION_MISMATCH', 'The CMS registry resource changed; reload and try again.');

export const conflict = (reasonCode: string): ContentSchemaRegistryError =>
  fail(409, 'CONFLICT', 'The CMS registry operation conflicts with current state.', {
    reasonCode,
  });

export const invalid = (reasonCode: string): ContentSchemaRegistryError =>
  fail(422, 'VALIDATION_FAILED', 'The CMS registry request failed validation.', {
    reasonCode,
  });

export const unavailable = (): ContentSchemaRegistryError =>
  fail(503, 'DEPENDENCY_UNAVAILABLE', 'CMS registry persistence is temporarily unavailable.', {
    dependencyClass: 'cms_registry',
    retryable: true,
  });
