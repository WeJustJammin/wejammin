/**
 * The closed reason vocabulary of CMS-03C-12 (BE03c "Slice 12 typed refusals") and the
 * composition catalog codes, written out so the browser reads a refusal without loading
 * zod (FE03 AC261). `pattern-designer-reasons.test.ts` proves both equal the generated
 * contract. The copy is fixed here and never taken from a response.
 */
export type PatternWriteReason =
  | 'capability_missing'
  | 'pattern_cycle'
  | 'block_registry_digest_mismatch'
  | 'key_reserved'
  | 'pattern_depth_exceeded'
  | 'pattern_nodes_exceeded'
  | 'block_rules_violated'
  | 'pattern_version_not_active'
  | 'pattern_incompatible'
  | 'nested_pattern_not_active';

export const PATTERN_WRITE_REASONS: Readonly<
  Record<PatternWriteReason, 403 | 409 | 422>
> = {
  capability_missing: 403,
  pattern_cycle: 409,
  block_registry_digest_mismatch: 409,
  key_reserved: 422,
  pattern_depth_exceeded: 422,
  pattern_nodes_exceeded: 422,
  block_rules_violated: 422,
  pattern_version_not_active: 422,
  pattern_incompatible: 422,
  nested_pattern_not_active: 422,
};

/** The token if `value` is a CMS-03C-12 token that belongs to `status`, else null. */
export const patternWriteReason = (
  value: unknown,
  status: number,
): PatternWriteReason | null =>
  typeof value === 'string' &&
  Object.hasOwn(PATTERN_WRITE_REASONS, value) &&
  PATTERN_WRITE_REASONS[value as PatternWriteReason] === status
    ? (value as PatternWriteReason)
    : null;

export const PATTERN_REFUSAL_COPY: Readonly<
  Record<PatternWriteReason, string>
> = {
  capability_missing:
    'Template designer access is required for this acting context. Nothing was saved.',
  pattern_cycle:
    'A nested pattern leads back to this pattern, so the tree would contain itself. Remove the nested pattern that closes the loop. Nothing was saved.',
  block_registry_digest_mismatch:
    'The block registry changed while you were editing. Reload to refresh the block choices, then submit again. Nothing was saved.',
  key_reserved:
    'That pattern key is reserved because it names a page or a route. Choose another key. Nothing was saved.',
  pattern_depth_exceeded:
    'Once nested patterns are expanded a node sits deeper than 8 levels. Flatten the tree. Nothing was saved.',
  pattern_nodes_exceeded:
    'Once nested patterns are expanded the tree has more than 512 nodes. Remove nodes. Nothing was saved.',
  block_rules_violated:
    'A block in this tree breaks the composition rules of its block type: a child it does not allow, or more blocks or levels than it permits. Change the tree. Nothing was saved.',
  pattern_version_not_active:
    'A nested pattern version is not active. Remove it, or wait until it is active. Nothing was saved.',
  pattern_incompatible:
    'A nested pattern is not compatible with every content type chosen for this pattern. Nothing was saved.',
  nested_pattern_not_active:
    'A nested pattern is not active. Remove it, or wait until it is active. Nothing was saved.',
};

/** BE03c catalog: the one application code of each status of the composition catalog. */
export const PATTERN_CATALOG_CODES: Readonly<Record<number, string>> = {
  400: 'INVALID_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'COMPOSITION_FORBIDDEN',
  404: 'COMPOSITION_NOT_FOUND',
  409: 'COMPOSITION_VERSION_CONFLICT',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'COMPOSITION_VALIDATION_FAILED',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  502: 'DEPENDENCY_UNAVAILABLE',
  503: 'DEPENDENCY_UNAVAILABLE',
  504: 'DEPENDENCY_UNAVAILABLE',
};
