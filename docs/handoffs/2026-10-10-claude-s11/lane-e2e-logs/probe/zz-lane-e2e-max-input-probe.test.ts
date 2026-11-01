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
import { appendFileSync } from 'node:fs';
import { loadavg } from 'node:os';
import { runAccessibilityChecker } from './checker';
import { evaluateAccessibilityGate } from './gate';
import {
  ACCESSIBILITY_FIELDS_MAX,
  ACCESSIBILITY_NODES_MAX,
  ACCESSIBILITY_OBJECT_PROPERTIES_MAX,
  ACCESSIBILITY_SLOT_INSTANCES_MAX,
  ACCESSIBILITY_TEMPLATE_SLOTS_MAX,
  AccessibilityCheckerInputSchema,
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

/**
 * What the database load hands the gate: the input after a JSON round trip. The wire text is built once, before the
 * gate opens its budget: the database writes it, so only parsing it (what `response.json()` does in the load) is the
 * Worker's work inside the 2,000 ms.
 */
const loaded = (input: AccessibilityCheckerInput) => {
  const wire = JSON.stringify(input);
  return async () => ({
    ok: true as const,
    input: JSON.parse(wire) as unknown,
  });
};


const OUT = process.env['PROBE_OUT'] ?? '/dev/null';
const ms = (value: number): number => Math.round(value * 10) / 10;

describe('lane e2e probe: the maximum-node gate split into phases (temporary)', () => {
  it('records JSON parse, schema validation, checker and whole-gate wall and CPU time', async () => {
    const input = checkerInput(maximumNodes());
    const wire = JSON.stringify(input);
    for (let round = 1; round <= 8; round += 1) {
      const cpuStart = process.cpuUsage();
      const t0 = performance.now();
      const json = JSON.parse(wire) as unknown;
      const t1 = performance.now();
      const parsed = AccessibilityCheckerInputSchema.safeParse(json);
      const t2 = performance.now();
      if (!parsed.success) throw new Error('schema refused the maximum input');
      await runAccessibilityChecker(parsed.data, { shouldStop: () => false });
      const t3 = performance.now();
      const cpu = process.cpuUsage(cpuStart);
      const gateStart = performance.now();
      const gateCpuStart = process.cpuUsage();
      const run = await evaluateAccessibilityGate({ load: loaded(input) });
      const gateWall = performance.now() - gateStart;
      const gateCpu = process.cpuUsage(gateCpuStart);
      appendFileSync(
        OUT,
        `round=${round} wireBytes=${wire.length} jsonParse=${ms(t1 - t0)}ms zod=${ms(t2 - t1)}ms checker=${ms(t3 - t2)}ms phasesWall=${ms(t3 - t0)}ms phasesCpu=${ms((cpu.user + cpu.system) / 1000)}ms | gate state=${run.state} gateWall=${ms(gateWall)}ms gate.durationMs=${run.durationMs} gateCpu=${ms((gateCpu.user + gateCpu.system) / 1000)}ms loadavg=${loadavg().map((n) => n.toFixed(2)).join('/')}\n`,
      );
    }
  }, 120_000);
});
