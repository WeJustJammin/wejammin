import type { CmsViolation } from '../cms-editorial/refusals.ts';

/*
 * DEC-210 (BE03c "Block composition rules (DEC-210)"): a tree that breaks a pinned block version's `allowedChildren` or
 * `slotRules` is a 422 `COMPOSITION_VALIDATION_FAILED` whose `details.reasonCode` is `block_rules_violated`, with one
 * violation at the location the operation owns. The pointer grammar of each operation lives here once, so the Worker
 * mapper, the Worker response projection and the web proxy cannot drift.
 */
export const CMS_BLOCK_RULES_REASON = 'block_rules_violated' as const;

/**
 * The only pointers a `block_rules_violated` violation may name.
 *  - CMS-03C-12: the offending node of the request `blockTree` (up to 32 roots, depth 8; a node reached through a nested
 *    pattern reference is named by the reference node).
 *  - CMS-03C-02: `/roots` when roots are named, else `/patternVersion`.
 *  - CMS-03C-15: `/instances/{i}/choices` for accept, `/instances/{i}` for detach.
 */
export const CMS_BLOCK_RULES_POINTERS = {
  'CMS-03C-12': /^\/blockTree(?:\/\d{1,2}(?:\/children\/\d{1,2}){0,8})?$/u,
  'CMS-03C-02': /^\/(?:roots|patternVersion)$/u,
  'CMS-03C-15': /^\/instances\/\d{1,2}(?:\/choices)?$/u,
} as const;

export type CmsBlockRulesOperation = keyof typeof CMS_BLOCK_RULES_POINTERS;

const MAX_VIOLATIONS = 50;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The `details` of a `block_rules_violated` refusal: the reason, and the violations of `source` whose pointer fits the
 * operation's grammar, each rewritten to the fixed code and the fixed safe message. Everything else `source` carried is
 * dropped; no violation leaves the bare reason.
 */
export const cmsBlockRulesDetails = (
  source: unknown,
  operation: CmsBlockRulesOperation,
): Readonly<{
  reasonCode: typeof CMS_BLOCK_RULES_REASON;
  violations?: readonly CmsViolation[];
}> => {
  const held =
    isRecord(source) && Array.isArray(source.violations)
      ? (source.violations as readonly unknown[])
      : [];
  const pointer = CMS_BLOCK_RULES_POINTERS[operation];
  const violations = held
    .flatMap((item): CmsViolation[] =>
      isRecord(item) && typeof item.path === 'string' && pointer.test(item.path)
        ? [
            {
              path: item.path,
              code: CMS_BLOCK_RULES_REASON,
              message: 'The value is invalid.',
            },
          ]
        : [],
    )
    .slice(0, MAX_VIOLATIONS);
  return violations.length === 0
    ? { reasonCode: CMS_BLOCK_RULES_REASON }
    : { reasonCode: CMS_BLOCK_RULES_REASON, violations };
};
