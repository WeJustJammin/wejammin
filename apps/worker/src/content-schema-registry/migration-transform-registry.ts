/**
 * Code-owned migration transform registry (BE03a "transform registry").
 * Members are pure, deterministic and bounded; nothing is uploaded. Extending
 * the registry takes code plus a forward migration. Each `digest` is the
 * lowercase SHA-256 of the JCS JSON of
 * `{ key, version, sourceConstraints, targetConstraints, acceptedFieldKinds,
 * behavior }`; `TRANSFORM_BEHAVIOR` holds the `behavior` identifiers and the
 * registry test recomputes every digest.
 */
import { CmsFieldKindSchema } from '@wejammin/contracts';

import type {
  SourceDocument,
  TargetFieldSpec,
  TransformContext,
  TransformRegistry,
  TransformRegistryEntry,
} from './migration-transform-types';

export const IDENTITY_REVALIDATE_KEY = 'identity.revalidate';
export const DEFAULT_FILL_LITERAL_KEY = 'default.fill_literal';

export const TRANSFORM_BEHAVIOR = {
  [IDENTITY_REVALIDATE_KEY]:
    'carry-row-unchanged;require-present-when-target-required;check-scalar-kind',
  [DEFAULT_FILL_LITERAL_KEY]:
    'write-declared-literal-default-when-value-absent-or-null;pass-present-value-unchanged',
} as const;

export const IA_FIELD_KINDS: readonly string[] = CmsFieldKindSchema.options;

export const FILL_LITERAL_FIELD_KINDS = [
  'short_text',
  'long_text',
  'boolean',
  'integer',
  'decimal',
  'date',
  'datetime',
  'enum',
] as const;

export const TRANSFORM_ROW_ERROR = {
  targetViolation: 'TRANSFORM_TARGET_VIOLATION',
  defaultUnavailable: 'TRANSFORM_DEFAULT_UNAVAILABLE',
} as const;

const rowError = (code: string): Error =>
  Object.assign(new Error(code), { code });

const isAbsent = (value: unknown): boolean =>
  value === undefined || value === null;

const SCALAR_KIND_CHECKS: Readonly<
  Record<string, (value: unknown) => boolean>
> = {
  short_text: (value) => typeof value === 'string',
  long_text: (value) => typeof value === 'string',
  rich_text: (value) => typeof value === 'string',
  date: (value) => typeof value === 'string',
  datetime: (value) => typeof value === 'string',
  enum: (value) => typeof value === 'string',
  boolean: (value) => typeof value === 'boolean',
  integer: (value) => Number.isSafeInteger(value),
  decimal: (value) =>
    typeof value === 'string' ||
    (typeof value === 'number' && Number.isFinite(value)),
};

const valueOf = (document: SourceDocument, field: TargetFieldSpec): unknown =>
  Object.hasOwn(document, field.fieldKey)
    ? document[field.fieldKey]
    : undefined;

const identityRevalidate = (
  document: SourceDocument,
  context: TransformContext,
): unknown => {
  const field = context.targetField;
  if (field === null) return document;
  const value = valueOf(document, field);
  if (isAbsent(value)) {
    if (field.required) throw rowError(TRANSFORM_ROW_ERROR.targetViolation);
    return document;
  }
  const check = SCALAR_KIND_CHECKS[field.kind];
  if (check !== undefined && !check(value))
    throw rowError(TRANSFORM_ROW_ERROR.targetViolation);
  return document;
};

const defaultFillLiteral = (
  document: SourceDocument,
  context: TransformContext,
): unknown => {
  const field = context.targetField;
  if (
    field === null ||
    field.defaultMode !== 'literal' ||
    isAbsent(field.defaultValue)
  )
    throw rowError(TRANSFORM_ROW_ERROR.defaultUnavailable);
  if (!isAbsent(valueOf(document, field))) return document;
  return { ...document, [field.fieldKey]: field.defaultValue };
};

export const DEFAULT_TRANSFORM_REGISTRY: TransformRegistry = [
  {
    key: IDENTITY_REVALIDATE_KEY,
    version: 1,
    digest: 'b3482ec3e2ada8948bb876d2f37edef3883100a577fc474fec497b40f00ba103',
    sourceConstraints: {},
    targetConstraints: {},
    acceptedFieldKinds: IA_FIELD_KINDS,
    carriesSourceHash: true,
    apply: identityRevalidate,
  },
  {
    key: DEFAULT_FILL_LITERAL_KEY,
    version: 1,
    digest: 'b69bfde9fa248844245f8c19fb31b60d41f0fae850dd93e5c75c4c9a8979023e',
    sourceConstraints: {},
    targetConstraints: {},
    acceptedFieldKinds: FILL_LITERAL_FIELD_KINDS,
    apply: defaultFillLiteral,
  },
];

/** Digest preimage of one code-owned member; the registry test recomputes it. */
export const digestPreimage = (
  entry: TransformRegistryEntry,
  behavior: string,
): Readonly<Record<string, unknown>> => ({
  key: entry.key,
  version: entry.version,
  sourceConstraints: entry.sourceConstraints,
  targetConstraints: entry.targetConstraints,
  acceptedFieldKinds: entry.acceptedFieldKinds,
  behavior,
});

export type ResolvedTransform =
  | Readonly<{ kind: 'none' }>
  | Readonly<{ kind: 'entry'; entry: TransformRegistryEntry }>
  | Readonly<{ kind: 'unregistered' }>;

/**
 * Resolves the plan's `(transformKey, transformVersion)` pair. Both null means
 * no transform (additive). A half pair, a non-integer version or an unknown
 * member is `unregistered`; callers refuse it before reading any row.
 */
export const resolveTransform = (
  registry: TransformRegistry,
  transformKey: string | null,
  transformVersion: string | null,
): ResolvedTransform => {
  if (transformKey === null && transformVersion === null)
    return { kind: 'none' };
  if (
    transformKey === null ||
    transformVersion === null ||
    !/^[1-9][0-9]{0,8}$/u.test(transformVersion)
  )
    return { kind: 'unregistered' };
  const version = Number(transformVersion);
  const entry = registry.find(
    (candidate) =>
      candidate.key === transformKey && candidate.version === version,
  );
  return entry === undefined
    ? { kind: 'unregistered' }
    : { kind: 'entry', entry };
};
