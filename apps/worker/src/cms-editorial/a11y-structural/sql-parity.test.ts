import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { canonicalHash } from '../../content-schema-registry/migration-transform-jcs';
import { checkerInput } from './a11y-structural.test-support';
import { runAccessibilityChecker } from './checker';
import { AccessibilityCheckerInputSchema } from './input-schema';
import { renderIdentityOf } from './render-plan';

/**
 * The document PostgreSQL's `cms_load_quality_gate_input` answers for a
 * revision whose object field holds rich text (DEC-133), checked here in the
 * Worker. The single copy is the `$j$` literal of
 * `supabase/tests/phase_02_slice_11_checker_render_plan.sql`, which that pgTAP
 * file asserts equals the live database output, so the input schema, the
 * render-plan hash and the verdict below are checked against what the database
 * really produces and cannot drift from it.
 */

const FIXTURE_FILE = fileURLToPath(
  new URL(
    '../../../../../supabase/tests/phase_02_slice_11_checker_render_plan.sql',
    import.meta.url,
  ),
);

type SqlDocument = Readonly<{ renderPlanHash: string; nodes: unknown[] }>;

const readFixture = (): SqlDocument => {
  const source = readFileSync(FIXTURE_FILE, 'utf8');
  const start = source.indexOf('-- PARITY FIXTURE');
  const literal = /\$j\$([\s\S]*?)\$j\$/u.exec(source.slice(start));
  if (start < 0 || literal === null)
    throw new Error('the parity fixture literal is missing');
  return JSON.parse(literal[1] as string) as SqlDocument;
};

const META = 'a9200000-0000-4000-8000-000000000c35';

describe('the database document of an object field with rich text (SQL parity)', () => {
  const fixture = readFixture();
  const input = checkerInput(fixture.nodes as never, {
    renderPlanHash: fixture.renderPlanHash,
  });

  it('is accepted by the Worker input schema as is', () => {
    const parsed = AccessibilityCheckerInputSchema.safeParse(input);
    expect(parsed.success).toBe(true);
    expect(fixture.nodes).toHaveLength(3);
  });

  it('carries a render-plan hash that TypeScript reproduces from the node identities', async () => {
    const parsed = AccessibilityCheckerInputSchema.parse(input);
    expect(
      await canonicalHash({
        templateVersionId: null,
        nodes: parsed.nodes.map(renderIdentityOf),
      }),
    ).toBe(fixture.renderPlanHash);
  });

  it('is judged in the order the database gave it, nested links and headings included', async () => {
    const parsed = AccessibilityCheckerInputSchema.parse(input);
    const run = await runAccessibilityChecker(parsed);
    if (run.state === 'stopped') throw new Error('unexpected stop');
    expect(run.state).toBe('blocked');
    expect(
      run.findings.map((f) => `${f.ruleId} ${f.location.pointer}`),
    ).toEqual([`link.text_generic /fields/${META}/note/blocks/1/spans/0`]);
  });

  it('would be judged differently in another order: the order is the database’s, not the Worker’s', async () => {
    const [note, lead, body] =
      AccessibilityCheckerInputSchema.parse(input).nodes;
    const reordered = AccessibilityCheckerInputSchema.parse({
      ...input,
      nodes: [lead, note, body],
    });
    const run = await runAccessibilityChecker(reordered);
    if (run.state === 'stopped') throw new Error('unexpected stop');
    expect(run.findings.map((f) => f.ruleId)).toContain('heading.first_level');
  });
});
