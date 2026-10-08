import { describe, expect, it } from 'vitest';

import type {
  EvidenceCitation,
  EvidenceLedgerEntry,
} from './phase-02-evidence-ledger';
import {
  FILES,
  baseWorld,
  e2eCite,
  editEntry,
  pgtapCite,
  problemsOf,
  raceCite,
  receiptFor,
  some,
  vitestCite,
  type World,
} from './phase-02-evidence-guard-fixtures';

const ALPHA = vitestCite('suite alpha works');
// Replace the alpha citation of AC-001 (clause 1) with `citation`.
const withAlpha = (citation: unknown): World =>
  editEntry(baseWorld(), 'P2-S10-AC-001', (entry): EvidenceLedgerEntry => ({
    ...entry,
    clauses: [
      {
        ...(entry.clauses[0] as EvidenceLedgerEntry['clauses'][number]),
        citations: [citation as EvidenceCitation],
      },
      entry.clauses[1] as EvidenceLedgerEntry['clauses'][number],
    ],
  }));
const AC = 'P2-S10-AC-001';

describe('evidence guard: a citation names exactly one well-formed test', () => {
  it('rejects an unknown key, an unknown tool and a non-object citation', () => {
    expect(
      some(
        problemsOf(withAlpha({ ...ALPHA, note: 'x' })),
        AC,
        'unknown key "note"',
      ),
    ).toBe(true);
    expect(
      some(
        problemsOf(withAlpha({ ...ALPHA, tool: 'jest' })),
        AC,
        'tool "jest"',
      ),
    ).toBe(true);
    expect(
      some(problemsOf(withAlpha('apps/x/a.test.ts')), AC, 'not an object'),
    ).toBe(true);
    expect(
      some(problemsOf(withAlpha({ tool: 'vitest' })), AC, 'missing key "file"'),
    ).toBe(true);
  });

  it('rejects a file that is not a repository-relative POSIX path', () => {
    for (const file of [
      '/apps/x/a.test.ts',
      '../a.test.ts',
      'apps/x/../x/a.test.ts',
      'apps\\x\\a.test.ts',
      './apps/x/a.test.ts',
      '',
      'apps/x/a b.test.ts',
    ]) {
      expect(
        some(
          problemsOf(withAlpha({ ...ALPHA, file })),
          AC,
          'repository-relative',
        ),
        file,
      ).toBe(true);
    }
  });

  it('rejects a file that does not exist', () => {
    expect(
      some(
        problemsOf(withAlpha({ ...ALPHA, file: 'apps/x/missing.test.ts' })),
        AC,
        'does not exist',
      ),
    ).toBe(true);
  });

  it('rejects a file whose kind does not match the tool', () => {
    const cases: [string, string][] = [
      ['vitest', FILES.pgtap],
      ['pgtap', FILES.vitestA],
      ['playwright', FILES.vitestA],
      ['race', FILES.pgtap],
    ];
    for (const [tool, file] of cases) {
      expect(
        some(
          problemsOf(
            withAlpha({
              ...ALPHA,
              tool,
              file,
              ...(tool === 'playwright' ? { project: 'chrome' } : {}),
            }),
          ),
          AC,
          'does not match tool',
          tool,
        ),
        tool,
      ).toBe(true);
    }
  });

  it('rejects an empty, padded or multi-line title', () => {
    expect(
      some(
        problemsOf(withAlpha({ ...ALPHA, title: '' })),
        AC,
        'title is empty',
      ),
    ).toBe(true);
    expect(
      some(
        problemsOf(withAlpha({ ...ALPHA, title: ' suite alpha works ' })),
        AC,
        'trimmed',
      ),
    ).toBe(true);
    expect(
      some(
        problemsOf(withAlpha({ ...ALPHA, title: 'suite\nalpha' })),
        AC,
        'single-line',
      ),
    ).toBe(true);
  });

  it('rejects a title that is a file-level verdict rather than one test', () => {
    const verdicts = [
      FILES.vitestA,
      'a.test.ts',
      'supabase/tests/p.sql .......... ok',
      'p.sql .. Dubious, test returned 3',
      'Result: PASS',
      'All tests successful.',
      'Files=1, Tests=12, 3 wallclock secs',
      'SKIP or TODO assertion without a description',
    ];
    for (const title of verdicts) {
      expect(
        some(
          problemsOf(withAlpha({ ...ALPHA, title })),
          AC,
          'file-level verdict',
        ),
        title,
      ).toBe(true);
    }
  });

  it('requires a project for Playwright and forbids it for every other tool', () => {
    const e2e = { tool: 'playwright', file: FILES.e2e, title: 'renders' };
    expect(some(problemsOf(withAlpha(e2e)), AC, 'project is required')).toBe(
      true,
    );
    expect(
      some(
        problemsOf(withAlpha({ ...e2e, project: '' })),
        AC,
        'project is required',
      ),
    ).toBe(true);
    expect(
      some(
        problemsOf(withAlpha({ ...ALPHA, project: 'chrome' })),
        AC,
        'project is only for playwright',
      ),
    ).toBe(true);
  });

  it('rejects the same citation twice in one clause (padding)', () => {
    const world = editEntry(baseWorld(), AC, (entry) => ({
      ...entry,
      clauses: [
        {
          ...(entry.clauses[0] as EvidenceLedgerEntry['clauses'][number]),
          citations: [ALPHA, ALPHA],
        },
        entry.clauses[1] as EvidenceLedgerEntry['clauses'][number],
      ],
    }));
    expect(some(problemsOf(world), AC, 'cited twice')).toBe(true);
  });

  it('accepts one citation of each tool when every field is right', () => {
    const world = editEntry(baseWorld(), AC, (entry) => ({
      ...entry,
      clauses: [
        {
          ...(entry.clauses[0] as EvidenceLedgerEntry['clauses'][number]),
          citations: [
            ALPHA,
            pgtapCite('p one'),
            e2eCite('renders'),
            raceCite('serialized'),
          ],
        },
        entry.clauses[1] as EvidenceLedgerEntry['clauses'][number],
      ],
    }));
    const receipts = [
      ...world.receipts,
      receiptFor(pgtapCite('p one')),
      receiptFor(e2eCite('renders')),
      receiptFor(raceCite('serialized')),
    ];
    expect(problemsOf({ ...world, receipts })).toEqual([]);
  });
});

describe('evidence guard: a marker in a title is never evidence', () => {
  it('does not accept a receipt whose title merely names the criterion', () => {
    const world = baseWorld();
    const receipts = world.receipts.filter((r) => r.title !== ALPHA.title);
    receipts.push(receiptFor(vitestCite(`[${AC}] suite alpha works`)));
    expect(
      some(
        problemsOf({ ...world, receipts }),
        'suite alpha works',
        'no receipt',
      ),
    ).toBe(true);
  });

  it('rejects marker-mode receipts (rows carrying a criterion field) as not identity receipts', () => {
    const world = baseWorld();
    const receipts = [
      ...world.receipts,
      { ...receiptFor(ALPHA), criterion: AC },
    ];
    expect(
      some(
        problemsOf({ ...world, receipts }),
        'criterion',
        'identity receipts',
      ),
    ).toBe(true);
  });

  it('judges a cited test by its own receipt, never by the receipts of a sibling that carries the marker', () => {
    const world = baseWorld();
    const receipts = world.receipts.map((r) =>
      r.title === ALPHA.title ? { ...r, status: 'failed' } : r,
    );
    receipts.push(receiptFor(vitestCite(`[${AC}] sibling passes`)));
    expect(
      some(problemsOf({ ...world, receipts }), 'suite alpha works', 'failed'),
    ).toBe(true);
  });
});
