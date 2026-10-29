import { CMS_BLOCK_RULES_POINTERS } from '@wejammin/contracts';

/**
 * DEC-228 (BE03c field matrix CMS-03C-12 `blockTree` row; P2-S12-AC-105): a cycle, depth or node-count refusal of a
 * pattern definition names the offending node of the request `blockTree`, `/blockTree/{i}(/children/{j})*`. The proxy keeps
 * at most one upstream violation, the first whose pointer fits the operation's own request grammar, rewritten to the
 * fixed code and message; anything else the upstream carried is dropped.
 */
export const NODE_POINTER_REASONS: ReadonlySet<string> = new Set([
  'pattern_cycle',
  'pattern_depth_exceeded',
  'pattern_nodes_exceeded',
]);

const POINTER = CMS_BLOCK_RULES_POINTERS['CMS-03C-12'];

export const nodePointerDetails = (
  upstream: unknown,
  reason: string,
): Record<string, unknown> => {
  const held: readonly unknown[] =
    typeof upstream === 'object' &&
    upstream !== null &&
    Array.isArray((upstream as { violations?: unknown }).violations)
      ? (upstream as { violations: readonly unknown[] }).violations
      : [];
  const path = held
    .map((entry) =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as { path?: unknown }).path === 'string'
        ? (entry as { path: string }).path
        : '',
    )
    .find((candidate) => POINTER.test(candidate));
  return path === undefined
    ? { reasonCode: reason }
    : {
        reasonCode: reason,
        violations: [{ path, code: reason, message: 'The value is invalid.' }],
      };
};
