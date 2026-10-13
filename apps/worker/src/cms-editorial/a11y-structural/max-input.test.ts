import { describe, expect, it } from 'vitest';

import {
  blockNode,
  checkerInput,
  fieldNode,
  heading,
  httpsLink,
  linkParagraph,
  paragraph,
  richText,
  span,
} from './a11y-structural.test-support';
import { evaluateAccessibilityGate } from './gate';
import {
  ACCESSIBILITY_FIELDS_MAX,
  ACCESSIBILITY_NODES_MAX,
  ACCESSIBILITY_OBJECT_PROPERTIES_MAX,
  ACCESSIBILITY_SLOT_INSTANCES_MAX,
  ACCESSIBILITY_TEMPLATE_SLOTS_MAX,
  type AccessibilityCheckerInput,
} from './input-schema';

/*
 * The largest revision the locked schemas admit (see ACCESSIBILITY_NODES_MAX): 128 `object` fields of 32 rich_text
 * properties and a template of 64 slots holding 128 instances each, 12,288 nodes. These tests run the real gate on it,
 * through a JSON round trip like the one the database load makes, with the default 2,000 ms budget: the Worker side of
 * the maximum (parse, validation, evaluation, hashing) completes inside the deadline, and one node more is refused as
 * an unreadable target instead of being evaluated. The load itself is PostgreSQL's (see the pgTAP node-bound suite).
 */

const RICH_VALUE = richText(
  heading(2, span('Section')),
  linkParagraph('Read the full guide', httpsLink()),
  paragraph(span('Body text of the section')),
);

const propertyKey = (index: number): string =>
  `p${String(index + 1).padStart(2, '0')}`;

const maximumNodes = (extraBlocks = 0): AccessibilityCheckerInput['nodes'] => [
  ...Array.from({ length: ACCESSIBILITY_FIELDS_MAX }, (_field, field) =>
    Array.from(
      { length: ACCESSIBILITY_OBJECT_PROPERTIES_MAX },
      (_property, property) =>
        fieldNode(field + 1, RICH_VALUE, propertyKey(property)),
    ),
  ).flat(),
  ...Array.from(
    {
      length:
        ACCESSIBILITY_TEMPLATE_SLOTS_MAX * ACCESSIBILITY_SLOT_INSTANCES_MAX +
        extraBlocks,
    },
    (_block, index) =>
      blockNode(index + 1, {
        nameRequired: true,
        accessibleName: `Region ${index + 1}`,
      }),
  ),
];

/** What the database load hands the gate: the input after a JSON round trip. */
const loaded = (input: AccessibilityCheckerInput) => async () => ({
  ok: true as const,
  input: JSON.parse(JSON.stringify(input)) as unknown,
});

describe('cms.a11y.structural at the maximum node count', () => {
  it('evaluates exactly ACCESSIBILITY_NODES_MAX nodes healthy inside the 2,000 ms budget', async () => {
    const input = checkerInput(maximumNodes());
    expect(input.nodes).toHaveLength(ACCESSIBILITY_NODES_MAX);

    const run = await evaluateAccessibilityGate({ load: loaded(input) });

    expect(run.state).toBe('healthy');
    if (run.state === 'failed') throw new Error('unexpected failure');
    expect(run.result).toMatchObject({
      blockingCount: 0,
      warningCount: 0,
      truncated: false,
    });
    expect(run.input.nodes).toHaveLength(ACCESSIBILITY_NODES_MAX);
    expect(run.durationMs).toBeLessThan(2_000);
  }, 15_000);

  it('refuses one node more as an unreadable target without evaluating it', async () => {
    const input = checkerInput(maximumNodes(1));
    expect(input.nodes).toHaveLength(ACCESSIBILITY_NODES_MAX + 1);

    const run = await evaluateAccessibilityGate({ load: loaded(input) });

    expect(run).toMatchObject({
      state: 'failed',
      failureCode: 'TARGET_UNREADABLE',
    });
  }, 15_000);
});
