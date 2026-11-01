import { CMS_BLOCK_RULES_POINTERS } from '@wejammin/contracts';

import { violationsFromDetailText } from '../cms-editorial-production-errors';

/**
 * DEC-228 (BE03c field matrix CMS-03C-12 `blockTree` row; P2-S12-AC-105): a cycle, depth or node-count refusal of a
 * pattern definition names the offending node of the request `blockTree`, `/blockTree/{i}(/children/{j})*`, like the
 * operation's other `blockTree` refusals (DEC-210). The producer raises the token as the message and the one pointer as
 * the DETAIL text. Only the pointer grammar the operation's own request owns (`CMS_BLOCK_RULES_POINTERS['CMS-03C-12']`)
 * is relayed, at most one pointer, rewritten to the fixed code and message; anything else leaves the bare reason.
 */
export const NODE_POINTER_REASONS = [
  'pattern_cycle',
  'pattern_depth_exceeded',
  'pattern_nodes_exceeded',
] as const;
export type NodePointerReason = (typeof NODE_POINTER_REASONS)[number];

export const isNodePointerReason = (
  value: unknown,
): value is NodePointerReason =>
  (NODE_POINTER_REASONS as readonly unknown[]).includes(value);

const POINTER = CMS_BLOCK_RULES_POINTERS['CMS-03C-12'];

const withPointer = (
  reason: NodePointerReason,
  path: string | undefined,
): Readonly<Record<string, unknown>> =>
  path === undefined
    ? { reasonCode: reason }
    : {
        reasonCode: reason,
        violations: [{ path, code: reason, message: 'The value is invalid.' }],
      };

/** The port refusal details of the producer's DETAIL text (the transport side). */
export const nodePointerDetails = (
  detail: unknown,
  reason: NodePointerReason,
): Readonly<Record<string, unknown>> =>
  withPointer(
    reason,
    violationsFromDetailText(detail, reason).find((violation) =>
      POINTER.test(violation.path),
    )?.path,
  );

/** The wire details of a port refusal that already carries a pointer (the response side). */
export const nodePointerWireDetails = (
  details: Readonly<Record<string, unknown>>,
  reason: NodePointerReason,
): Readonly<Record<string, unknown>> => {
  const held: readonly unknown[] = Array.isArray(details.violations)
    ? (details.violations as readonly unknown[])
    : [];
  const path = held
    .map((item) =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as { path?: unknown }).path === 'string'
        ? (item as { path: string }).path
        : '',
    )
    .find((candidate) => POINTER.test(candidate));
  return withPointer(reason, path);
};
