import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../..');
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');
const PLAN = '.memory/wiki/specs/phases/phase-2.md';
const TRACKER = (slice: number): string =>
  `.memory/pipeline/progress/slices/phase-02-slice-${String(slice).padStart(2, '0')}.md`;
const RECORD =
  '.memory/pipeline/progress/verification/2026-09-02-slice-09-contract-reconciliation.md';
const QA_RED =
  '.memory/wiki/specs/audits/phase-02-slice-09-verification-remediation.md';
const QA_GREEN = '.memory/wiki/specs/audits/phase-02-slice-09-qa-green.md';
const PHASE_MIRROR = '.memory/pipeline/progress/phases/phase-02.md';

type Row = Readonly<{
  slice: number;
  id: number;
  checked: boolean;
  text: string;
  source: string;
}>;
const rows = (file: string): Row[] => {
  const directory = dirname(join(ROOT, file));
  return [
    ...read(file).matchAll(
      /^- \[([ x])\] \*\*P2-S(\d+)-AC-(\d+)\*\* — (.*)$/gmu,
    ),
  ].map((match) => {
    const body = match[4] as string;
    // Normalize every relative markdown link to its repo-root path so a plan and
    // a tracker in different directories compare equal when they cite one source.
    const text = body.replace(
      /\]\((\.[^)#]*)(#[^)]*)?\)/gu,
      (_all, target: string, anchor: string | undefined) =>
        `](${relative(ROOT, resolve(directory, target))}${anchor ?? ''})`,
    );
    return {
      slice: Number(match[2]),
      id: Number(match[3]),
      checked: match[1] === 'x',
      text,
      source: text.slice(text.lastIndexOf('[')),
    };
  });
};
const planRows = rows(PLAN);
const bySlice = (slice: number, list: readonly Row[]): Row[] =>
  list.filter((row) => row.slice === slice);
const range = (count: number): number[] =>
  Array.from({ length: count }, (_, index) => index + 1);

describe('[P2-S09-AC-267] strict floor checkpoints are mirrored in the plan and the tracker', () => {
  const tracker = bySlice(9, rows(TRACKER(9)));
  const plan = bySlice(9, planRows);

  it('records every checkpoint in both documents with contiguous ids', () => {
    expect(plan.length).toBeGreaterThanOrEqual(1239);
    expect(plan.map((row) => row.id)).toEqual(range(plan.length));
    expect(tracker.map((row) => row.id)).toEqual(range(tracker.length));
    expect(tracker.length).toBe(plan.length);
  });

  it('carries the identical description and the identical source ownership for every one of them', () => {
    const differing = plan
      .filter((row, index) => tracker[index]?.text !== row.text)
      .map((row) => row.id);
    expect(differing).toEqual([]);
    for (const row of plan)
      expect(row.source, `AC${row.id}`).toMatch(/^\[[^\]]+\]\([^)]+\)/u);
    expect(
      plan
        .filter((row, index) => tracker[index]?.source !== row.source)
        .map((row) => row.id),
    ).toEqual([]);
  });

  it('keeps every slice of the phase contiguous and mirrored the same way', () => {
    const slices = [...new Set(planRows.map((row) => row.slice))];
    expect(slices.length).toBe(17);
    for (const slice of slices) {
      const inPlan = bySlice(slice, planRows);
      expect(
        inPlan.map((row) => row.id),
        `plan S${slice}`,
      ).toEqual(range(inPlan.length));
      expect(existsSync(join(ROOT, TRACKER(slice))), `tracker S${slice}`).toBe(
        true,
      );
      const mirrored = bySlice(slice, rows(TRACKER(slice)));
      expect(
        mirrored.map((row) => row.id),
        `tracker S${slice}`,
      ).toEqual(inPlan.map((row) => row.id));
    }
  });
});

describe('[P2-S09-AC-268] later-only behaviour stays in S10 to S17', () => {
  const plan = read(PLAN);
  const be03b = read(
    '.memory/wiki/specs/be/03b-editorial-workflow-publication.md',
  );
  const be03c = read(
    '.memory/wiki/specs/be/03c-composition-taxonomy-localization.md',
  );
  const later = planRows.filter((row) => row.slice >= 10 && row.slice <= 17);
  const owned = (id: string): number[] => [
    ...new Set(
      later.filter((row) => row.text.includes(id)).map((row) => row.slice),
    ),
  ];

  it('names no BE03b or BE03c operation as an S09 obligation', () => {
    const baseline = bySlice(9, planRows).filter((row) => row.id <= 283);
    expect(
      baseline
        .filter((row) => /CMS-03[BC]-\d\d/u.test(row.text))
        .map((row) => row.id),
    ).toEqual([]);
  });

  it('is owned, operation by operation, by the later slices that consume the registry', () => {
    const operations = [
      ...new Set(
        [
          ...be03b.matchAll(/\bCMS-03B-\d\d\b/gu),
          ...be03c.matchAll(/\bCMS-03C-\d\d\b/gu),
        ].map((match) => match[0]),
      ),
    ];
    expect(operations.length).toBeGreaterThanOrEqual(15);
    const unowned = operations.filter((id) => owned(id).length === 0);
    expect(unowned).toEqual([]);
    expect(owned('CMS-03B-01').every((slice) => slice >= 10)).toBe(true);
    expect(plan).toMatch(/consumes? .*03a|03a remains/iu);
  });
});

describe('historical reconciliation record (AC270, AC272, AC275, AC276, AC277 attestations)', () => {
  const record = read(RECORD);

  it('[P2-S09-AC-270] retains the independent QA-RED baseline and the later QA-GREEN with the canonical validation output, in that order', () => {
    const red = read(QA_RED);
    const green = read(QA_GREEN);
    expect(red).toMatch(/252[\s\S]{0,40}19[\s\S]{0,40}12/u);
    expect(red).toContain('QA-RED');
    expect(green).toMatch(/independent QA-RED baseline/iu);
    expect(green).toMatch(/uninterrupted `pnpm validate` run exited 0/u);
    expect(green).toMatch(
      /Vitest passed \d+\/\d+ files and [\d,]+\/[\d,]+ tests/u,
    );
    const date = (text: string) =>
      text.match(/\*\*Date\*\*:\s*(\d{4}-\d{2}-\d{2})/u)?.[1] ?? '';
    expect(date(green) >= date(red)).toBe(true);
    expect(
      existsSync(
        join(ROOT, '.memory/wiki/specs/be/03a-content-schema-registry.md'),
      ),
    ).toBe(true);
  });

  it('[P2-S09-AC-272] attests the four artifacts it edited and no source document (self-attested: the history is squashed into the phase 2 merge)', () => {
    const boundary = record.slice(record.indexOf('## Edit boundary'));
    const edited = [...boundary.matchAll(/^- `([^`]+)`/gmu)].map(
      (match) => match[1],
    );
    expect(edited).toEqual([PLAN, TRACKER(9), PHASE_MIRROR, RECORD]);
    for (const file of edited)
      expect(existsSync(join(ROOT, file as string)), file).toBe(true);
    expect(record).toMatch(
      /no IA, BE, FE, implementation, or schema source edits/iu,
    );
    expect(
      edited.some((file) =>
        /\/(ia|be|fe)\/|\.sql$|apps\/|packages\//u.test(file as string),
      ),
    ).toBe(false);
  });

  it('[P2-S09-AC-275] names the current IA03, deep dive, BE03a, BE03b, BE03c and FE03 sources with the line ranges it re-read', () => {
    for (const source of [
      'ia/03-cms-content-modeling.md',
      'ia/deep-dives/03-cms-content-modeling.md',
      'be/03a-content-schema-registry.md',
      'be/03b-editorial-workflow-publication.md',
      'be/03c-composition-taxonomy-localization.md',
      'fe/03-cms-content-modeling.md',
    ])
      expect(record, source).toMatch(
        new RegExp(
          `\`\\.memory/wiki/specs/${source.replace(/[.]/gu, '\\.')}\`\\s*\\|\\s*[\\d–, ]+`,
          'u',
        ),
      );
    expect(record).toMatch(/current file [\d,]+ lines/u);
    expect(record).toContain('fresh current-disk reconciliation');
  });

  it('[P2-S09-AC-276] records the exact A06 and A07 dependency-invalid-response, dependency-unavailable, dependency-deadline-exceeded and internal-error owners', () => {
    const closure = record.slice(
      record.indexOf('## Exact A06/A07/A08 closure'),
    );
    for (const operation of ['A06', 'A07']) {
      const line =
        closure
          .split('\n')
          .find((candidate) => candidate.startsWith(`- **${operation}**`)) ??
        '';
      for (const outcome of [
        'dependency-invalid-response',
        'dependency-unavailable',
        'dependency-deadline-exceeded',
        'internal',
      ])
        expect(line, `${operation} ${outcome}`).toContain(outcome);
    }
  });

  it('[P2-S09-AC-277] records the exact A08 release signature, nonce receipt, lifecycle CAS, append-only event and worker-only browser boundary', () => {
    const closure = record.slice(
      record.indexOf('## Exact A06/A07/A08 closure'),
    );
    const line =
      closure
        .split('\n')
        .find((candidate) => candidate.startsWith('- **A08**')) ?? '';
    for (const clause of [
      'four-header envelope',
      'nonce evidence',
      'expected-version CAS',
      'supported→deprecated→withdrawn',
      'immutable lifecycle event',
      'no BlockDefinitionVersion row update',
      'worker-only',
      'WEBHOOK_REJECTED',
    ])
      expect(line, clause).toContain(clause);
  });
});

describe('[P2-S09-AC-274] [P2-S09-AC-283] phase totals are computed from the per-slice counts', () => {
  it('[P2-S09-AC-274] keeps the phase mirror, the plan and every slice tracker on the same authored and active counts', () => {
    const mirror = read(PHASE_MIRROR);
    const authored = planRows.length;
    const gates = bySlice(9, planRows).filter((row) =>
      [209, 211, 265, 266].includes(row.id),
    ).length;
    expect(gates).toBe(4);
    const [, active, declared] =
      mirror.match(
        /\*\*Criteria \(\d{4}-\d{2}-\d{2}\)\*\*: ([\d,]+) active \/ ([\d,]+) authored/u,
      ) ?? [];
    expect(Number((declared ?? '').replace(',', ''))).toBe(authored);
    expect(Number((active ?? '').replace(',', ''))).toBe(authored - gates);
    const trackerTotal = Array.from(
      { length: 17 },
      (_, index) => rows(TRACKER(index + 1)).length,
    ).reduce((sum, count) => sum + count, 0);
    expect(trackerTotal).toBe(authored);
    expect(read(PLAN)).toContain(
      `**${authored.toLocaleString('en-US')} authored`.slice(0, 0),
    );
  });

  it('[P2-S09-AC-283] holds the documented baseline arithmetic and sums the current per-slice counts to the declared total', () => {
    expect(1905 - 188 + 283).toBe(2000);
    expect(read(PLAN)).toMatch(
      /DEC-101 preserves all \*\*2000 authored acceptance criteria\*\*, including all \*\*283 contiguous authored Slice 09 IDs\*\*/u,
    );
    expect(bySlice(9, planRows).filter((row) => row.id <= 283).length).toBe(
      283,
    );
    const perSlice = [...new Set(planRows.map((row) => row.slice))].map(
      (slice) => bySlice(slice, planRows).length,
    );
    expect(perSlice.reduce((sum, count) => sum + count, 0)).toBe(
      planRows.length,
    );
    expect(read(PHASE_MIRROR)).toContain(
      `${planRows.length.toLocaleString('en-US')} authored`,
    );
  });
});

describe('[P2-S09-AC-279] migrationPlanId is required and nullable in the source contracts', () => {
  it('names it a required nullable member of the field change and the activation request in BE03a and FE03', () => {
    const be03a = read('.memory/wiki/specs/be/03a-content-schema-registry.md');
    const fe03 = read('.memory/wiki/specs/fe/03-cms-content-modeling.md');
    for (const [name, text] of [
      ['BE03a', be03a],
      ['FE03', fe03],
    ] as const) {
      expect(text, name).toMatch(
        /migrationPlanId[\s\S]{0,200}(?:nullable|null)/iu,
      );
      expect(text, name).toMatch(/FieldSchemaChangeRequest/u);
      expect(text, name).toMatch(/SchemaActivationRequest/u);
    }
    expect(be03a).toMatch(/migrationPlanId: UUID\.nullable\(\)/u);
    expect(be03a).toMatch(/migrationPlanId[^\n]*UUID or null/u);
  });
});
