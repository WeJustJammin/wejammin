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

type Dec193Document = SqlDocument & Readonly<{ name: string }>;

const readDec193Fixture = (): readonly Dec193Document[] => {
  const source = readFileSync(
    fileURLToPath(
      new URL(
        '../../../../../supabase/tests/phase_02_slice_12_dec193_consumers/040-checker-boundaries.sqlinc',
        import.meta.url,
      ),
    ),
    'utf8',
  );
  const start = source.indexOf('-- DEC193 PARITY FIXTURE');
  const literal = /\$j\$([\s\S]*?)\$j\$/u.exec(source.slice(start));
  if (start < 0 || literal === null)
    throw new Error('the DEC-193 SQL parity fixture literal is missing');
  return (
    JSON.parse(literal[1] as string) as {
      cases: readonly Dec193Document[];
    }
  ).cases;
};

// SQL CB-X01/X02 require the actual public/private documents to equal this
// independent literal. Fixed anchors are guarded copies of real detach donors;
// the private ordinal projection does not publish a descendant-address API.
describe('DEC-193 actual SQL documents (shared literal parity)', () => {
  const fixtures = readDec193Fixture();

  it.each(fixtures)(
    'accepts the complete $name descendant document unchanged',
    (fixture) => {
      const input = checkerInput(fixture.nodes as never, {
        renderPlanHash: fixture.renderPlanHash,
      });
      const parsed = AccessibilityCheckerInputSchema.safeParse(input);
      expect(parsed.success).toBe(true);
      if (!parsed.success)
        throw new Error('actual SQL parity input was refused');
      expect(parsed.data.nodes).toHaveLength(
        fixture.name === 'repeated' ? 3 : 2,
      );
      expect(parsed.data.nodes.every((node) => node.kind === 'block')).toBe(
        true,
      );
      const pointers = parsed.data.nodes.map((node) => {
        if (node.kind !== 'block')
          throw new Error('unexpected field in block fixture');
        return node.pointer;
      });
      expect(new Set(pointers).size).toBe(pointers.length);
      expect(pointers.every((pointer) => pointer.length <= 256)).toBe(true);
      expect(
        pointers
          .slice(1)
          .every((pointer) => pointer.startsWith(`${pointers[0]}/`)),
      ).toBe(true);
    },
  );

  it.each(fixtures)(
    'reproduces the independent $name render hash in the Worker',
    async (fixture) => {
      const parsed = AccessibilityCheckerInputSchema.parse(
        checkerInput(fixture.nodes as never, {
          renderPlanHash: fixture.renderPlanHash,
        }),
      );
      expect(
        await canonicalHash({
          templateVersionId: null,
          nodes: parsed.nodes.map(renderIdentityOf),
        }),
      ).toBe(fixture.renderPlanHash);
      const run = await runAccessibilityChecker(parsed);
      if (run.state === 'stopped') throw new Error('unexpected stop');
      expect(run.state).toBe('healthy');
      expect(run.findings).toEqual([]);
    },
  );

  it('accepts repeated registry tuples at distinct locations but refuses an actual duplicate location', () => {
    const fixture = fixtures.find((item) => item.name === 'repeated');
    if (fixture === undefined) throw new Error('repeated SQL fixture missing');
    const parsed = AccessibilityCheckerInputSchema.parse(
      checkerInput(fixture.nodes as never),
    );
    const first = parsed.nodes[1];
    const second = parsed.nodes[2];
    if (first?.kind !== 'block' || second?.kind !== 'block')
      throw new Error('SQL descendant pair missing');
    expect([first.blockKey, first.blockVersion]).toEqual([
      second.blockKey,
      second.blockVersion,
    ]);
    expect(first.pointer).not.toBe(second.pointer);
    expect(
      AccessibilityCheckerInputSchema.safeParse({
        ...parsed,
        nodes: [parsed.nodes[0], first, { ...second, pointer: first.pointer }],
      }).success,
    ).toBe(false);
  });

  it('reports a withdrawn descendant at its own SQL location without changing the root', async () => {
    const fixture = fixtures.find((item) => item.name === 'long');
    if (fixture === undefined)
      throw new Error('long-namespace SQL fixture missing');
    const parsed = AccessibilityCheckerInputSchema.parse(
      checkerInput(fixture.nodes as never),
    );
    const child = parsed.nodes[1];
    if (child?.kind !== 'block') throw new Error('SQL child missing');
    const run = await runAccessibilityChecker({
      ...parsed,
      nodes: parsed.nodes.map((node, index) =>
        index === 1 && node.kind === 'block'
          ? { ...node, lifecycle: 'withdrawn' as const }
          : node,
      ),
    });
    if (run.state === 'stopped') throw new Error('unexpected stop');
    expect(run.state).toBe('blocked');
    expect(
      run.findings.map((finding) => [finding.ruleId, finding.location.pointer]),
    ).toEqual([['structure.block_unregistered', child.pointer]]);
  });
});
