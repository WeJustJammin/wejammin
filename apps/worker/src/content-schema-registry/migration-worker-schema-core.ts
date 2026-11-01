import {
  CmsHashSchema,
  CmsInstantSchema,
  CmsUuidSchema,
  CmsVersionSchema,
} from '@wejammin/contracts';
import { MAX_MIGRATION_QUEUE_BYTES } from './migration-worker-constants';

/** Small strict runtime-schema primitives shared by migration boundaries. */
type SchemaIssue = Readonly<{
  path: readonly (string | number)[];
  message: string;
}>;

export type RuntimeSchemaResult<T> =
  | Readonly<{ success: true; data: T }>
  | Readonly<{
      success: false;
      error: Readonly<{ issues: readonly SchemaIssue[] }>;
    }>;

export type RuntimeSchema<T> = Readonly<{
  safeParse: (value: unknown) => RuntimeSchemaResult<T>;
  parse: (value: unknown) => T;
}>;

export const failure = (
  path: readonly (string | number)[],
  message: string,
): RuntimeSchemaResult<never> => ({
  success: false,
  error: { issues: [{ path, message }] },
});

export const schema = <T>(
  validate: (value: unknown) => RuntimeSchemaResult<T>,
): RuntimeSchema<T> => ({
  safeParse: validate,
  parse: (value) => {
    const result = validate(value);
    if (result.success) return result.data;
    throw new Error(result.error.issues[0]?.message ?? 'Invalid value');
  },
});

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const ownKeys = (value: Record<string, unknown>): readonly string[] =>
  Object.keys(value);

export const hasExactKeys = (
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean => {
  const actual = [...ownKeys(value)].sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
};

export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && CmsUuidSchema.safeParse(value).success;

export const isVersion = (value: unknown): value is string =>
  typeof value === 'string' && CmsVersionSchema.safeParse(value).success;

export const isCounter = (value: unknown): value is string =>
  typeof value === 'string' && /^(?:0|[1-9][0-9]{0,18})$/u.test(value);

export const isHash = (value: unknown): value is string =>
  typeof value === 'string' && CmsHashSchema.safeParse(value).success;

export const isInstant = (value: unknown): value is string =>
  typeof value === 'string' && CmsInstantSchema.safeParse(value).success;

export const isSafeToken = (value: unknown, maxLength = 128): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= maxLength &&
  /^[A-Za-z][A-Za-z0-9_.:-]*$/u.test(value);

export const isMigrationLeaseToken = (value: unknown): value is string =>
  isUuid(value) || isSafeToken(value, 200);

export const withinJsonBudget = (value: unknown): boolean => {
  try {
    const encoded = new TextEncoder().encode(JSON.stringify(value));
    return encoded.byteLength <= MAX_MIGRATION_QUEUE_BYTES;
  } catch {
    return false;
  }
};

export const validateNullableUuid = (value: unknown): value is string | null =>
  value === null || isUuid(value);
