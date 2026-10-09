import {
  CMS_A11Y_CHECKER_KEY,
  CMS_A11Y_CHECKER_VERSION,
} from '@wejammin/contracts';

import { createFindingCollector, type AccessibilityFinding } from './findings';
import { accessibilityInputHash } from './hashes';
import type {
  AccessibilityCheckerInput,
  AccessibilityNode,
  BlockNode,
} from './input-schema';
import { createHeadingRule } from './rules-heading';
import { createLandmarkRule } from './rules-landmark';
import { createLinkRule } from './rules-link';
import { evaluateStructure, type ParsedField } from './rules-structure';

/*
 * `cms.a11y.structural` version 1 (BE05c, D25, DEC-134): a pure, in-process
 * TypeScript module. It has no network provider, no DOM and no Browser
 * Rendering provider, and Slice 16 reuses it unchanged.
 *
 * Evaluation order is structure, heading, link, media, landmark. The media
 * group is inert in Phase 2: no media reference can exist before Slice 14, and
 * the input schema refuses a media node, so there is nothing to evaluate. The
 * nodes arrive in render order and the checker never re-derives it.
 */

export type AccessibilityCheckerRun = Readonly<{
  checkerKey: typeof CMS_A11Y_CHECKER_KEY;
  checkerVersion: typeof CMS_A11Y_CHECKER_VERSION;
  /** `healthy` when blockingCount is 0, else `blocked`. */
  state: 'healthy' | 'blocked';
  /** At most FINDINGS_STORED_MAX findings; the counts below are true totals. */
  findings: readonly AccessibilityFinding[];
  blockingCount: number;
  warningCount: number;
  truncated: boolean;
  inputHash: string;
}>;

/** The cooperative deadline fired between nodes: the gate maps it to CHECKER_TIMEOUT. */
export type AccessibilityCheckerStopped = Readonly<{ state: 'stopped' }>;

export type AccessibilityCheckerOptions = Readonly<{
  /** Polled between nodes; returning true abandons the run. */
  shouldStop?: () => boolean;
}>;

const NEVER_STOP = (): boolean => false;
const STOPPED: AccessibilityCheckerStopped = { state: 'stopped' };

type IndexedNode<T> = Readonly<{ node: T; index: number }>;

/** Visits every item, asking `shouldStop` before each; false means the run was stopped. */
const visitAll = <T>(
  items: readonly T[],
  shouldStop: () => boolean,
  visit: (item: T) => void,
): boolean => {
  for (const item of items) {
    if (shouldStop()) return false;
    visit(item);
  }
  return true;
};

export const runAccessibilityChecker = async (
  input: AccessibilityCheckerInput,
  options: AccessibilityCheckerOptions = {},
): Promise<AccessibilityCheckerRun | AccessibilityCheckerStopped> => {
  const shouldStop = options.shouldStop ?? NEVER_STOP;
  const collector = createFindingCollector();
  const headingRule = createHeadingRule(collector);
  const linkRule = createLinkRule(collector, input.locale);
  const landmarkRule = createLandmarkRule(collector);

  const nodes: IndexedNode<AccessibilityNode>[] = input.nodes.map(
    (node, index) => ({ node, index }),
  );
  const blocks = nodes.flatMap(({ node, index }) =>
    node.kind === 'block' ? [{ node, index }] : [],
  ) satisfies IndexedNode<BlockNode>[];
  const fields: ParsedField[] = [];

  // 1. structure
  if (
    !visitAll(nodes, shouldStop, ({ node, index }) => {
      const field = evaluateStructure(node, index, collector);
      if (field !== null) fields.push(field);
    })
  )
    return STOPPED;
  // 2. heading
  if (!visitAll(fields, shouldStop, headingRule.evaluate)) return STOPPED;
  // 3. link
  if (!visitAll(fields, shouldStop, linkRule.evaluate)) return STOPPED;
  linkRule.finish();
  // 4. media: inert in Phase 2 (see the module comment).
  // 5. landmark
  if (
    !visitAll(blocks, shouldStop, ({ node, index }) =>
      landmarkRule.evaluate(node, index),
    )
  )
    return STOPPED;
  landmarkRule.finish();

  const { findings, blockingCount, warningCount, truncated } =
    collector.result();
  return {
    checkerKey: CMS_A11Y_CHECKER_KEY,
    checkerVersion: CMS_A11Y_CHECKER_VERSION,
    state: blockingCount === 0 ? 'healthy' : 'blocked',
    findings,
    blockingCount,
    warningCount,
    truncated,
    inputHash: await accessibilityInputHash(input),
  };
};
