/**
 * The closed BE03b error vocabulary shared by the route boundary and the
 * production RPC mapper: the typed reason tokens a 409/422 may publish, the
 * recovery actions and conflict kinds, and the safe JSON-pointer grammar of a
 * violation. Anything outside these sets is dropped before it reaches a client,
 * so a database or a port can name a reason only by one of these tokens.
 */

/** BE03b:1049-1054 typed 422 value reasons and :1211 comparison refusals. */
export const TYPED_VALIDATION_REASONS = [
  'rich_text_not_canonical',
  'object_kind_unspecified',
  'object_property_invalid',
  'relation_target_unavailable',
  'taxonomy_source_unavailable',
  'media_source_unavailable',
  'comparison_too_large',
  'comparison_unavailable',
] as const;

/** BE03b:1213 and :1345 restore refusals: 409 with nothing fabricated. */
export const TYPED_CONFLICT_REASONS = [
  'migration_chain_mismatch',
  'migration_chain_unavailable',
  'migration_chain_incomplete',
  'template_incompatible',
] as const;

/** Reasons a 409/422 may publish; anything else is dropped at every boundary. */
export const REGISTERED_REASON_CODES: ReadonlySet<string> = new Set([
  ...TYPED_VALIDATION_REASONS,
  ...TYPED_CONFLICT_REASONS,
]);

/** BE00 CONFLICT `details.conflict` is exactly one of these three values. */
export const REGISTERED_CONFLICT_KINDS: ReadonlySet<string> = new Set([
  'VERSION_MISMATCH',
  'IDEMPOTENCY_MISMATCH',
  'INVALID_TRANSITION',
]);

/** Closed `recoveryAction` vocabulary the editorial surface may publish. */
export const REGISTERED_RECOVERY_ACTIONS: ReadonlySet<string> = new Set([
  'reload',
  'refresh',
  'reauthenticate',
  'use_new_idempotency_key',
]);

/** RFC 6901 pointer over a bounded safe alphabet, at most 32 segments. */
const SAFE_POINTER = /^(?:\/(?:[A-Za-z0-9_.-]|~[01])*){1,32}$/u;
export const MAX_POINTER_LENGTH = 256;

export const isSafePointer = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length <= MAX_POINTER_LENGTH &&
  SAFE_POINTER.test(value);

/** A violation code is a lowercase machine token, never prose. */
export const VIOLATION_CODE = /^[a-z][a-z0-9_]{0,63}$/u;
