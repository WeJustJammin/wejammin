import type { PatternWriteReason } from './pattern-designer-reasons';

/*
 * DEC-228 (BE03c field matrix CMS-03C-12 `blockTree` row; FE03 885): a cycle, depth or node-count refusal names the
 * offending request node, `/blockTree/{i}(/children/{j})*` (a root index, then at most eight child indices). The proxy has
 * already rebuilt the violation from this grammar; the browser repeats the check and turns the pointer into child indices.
 */
export type NodePointerReason = Extract<
  PatternWriteReason,
  'pattern_cycle' | 'pattern_depth_exceeded' | 'pattern_nodes_exceeded'
>;

export const isNodePointerReason = (
  reason: PatternWriteReason,
): reason is NodePointerReason =>
  reason === 'pattern_cycle' ||
  reason === 'pattern_depth_exceeded' ||
  reason === 'pattern_nodes_exceeded';

const NODE_POINTER = /^\/blockTree\/(\d{1,2})((?:\/children\/\d{1,2}){0,8})$/u;

/** The child indices of the first violation that names a node of the request tree, else null (the root is not a node). */
export const nodePathOf = (
  details: Readonly<Record<string, unknown>>,
): readonly number[] | null => {
  const violations = details.violations;
  if (!Array.isArray(violations)) return null;
  for (const violation of violations as readonly unknown[]) {
    const path =
      typeof violation === 'object' && violation !== null
        ? (violation as { path?: unknown }).path
        : undefined;
    const match = typeof path === 'string' ? NODE_POINTER.exec(path) : null;
    if (match !== null)
      return [
        Number(match[1]),
        ...(match[2] ?? '')
          .split('/children/')
          .filter((part) => part !== '')
          .map(Number),
      ];
  }
  return null;
};
