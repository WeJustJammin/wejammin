import { describe, expect, it } from 'vitest';

import type {
  EvidenceCitation,
  EvidenceLedgerEntry,
} from './phase-02-evidence-ledger';
import {
  FILES,
  baseWorld,
  closureSha,
  e2eCite,
  editEntry,
  fileSha,
  pgtapCite,
  problemsOf,
  receiptFor,
  run,
  some,
  vitestCite,
  type Receipt,
  type World,
} from './phase-02-evidence-guard-fixtures';

const ALPHA = vitestCite('suite alpha works');
const BETA = pgtapCite('beta is rejected with 409');
const withReceipts = (change: (receipts: Receipt[]) => Receipt[]): World => {
  const world = baseWorld();
  return { ...world, receipts: change(world.receipts) };
};
const replaceReceipt = (title: string, over: Partial<Receipt>): World =>
  withReceipts((rs) =>
    rs.map((r) => (r.title === title ? { ...r, ...over } : r)),
  );

describe('evidence guard: every citation needs a fresh passing receipt for that exact test', () => {
  it('rejects a citation with no receipt: wrong title, tool, file or Playwright project', () => {
    const none = withReceipts((rs) =>
      rs.filter((r) => r.title !== ALPHA.title),
    );
    expect(some(problemsOf(none), 'suite alpha works', 'no receipt')).toBe(
      true,
    );
    for (const wrong of [
      { title: 'suite alpha work' },
      { tool: 'race' },
      { file: FILES.vitestB },
    ]) {
      const world = replaceReceipt(ALPHA.title, wrong);
      expect(
        some(problemsOf(world), 'suite alpha works', 'no receipt'),
        JSON.stringify(wrong),
      ).toBe(true);
    }
    const pw = editEntry(baseWorld(), 'P2-S10-AC-001', (e) => ({
      ...e,
      clauses: [
        {
          ...(e.clauses[0] as EvidenceLedgerEntry['clauses'][number]),
          citations: [e2eCite('renders', 'chrome')],
        },
        e.clauses[1] as EvidenceLedgerEntry['clauses'][number],
      ],
    }));
    const mobileOnly = {
      ...pw,
      receipts: [...pw.receipts, receiptFor(e2eCite('renders', 'mobile'))],
    };
    expect(
      some(problemsOf(mobileOnly), 'renders', 'chrome', 'no receipt'),
    ).toBe(true);
  });

  it('rejects a skipped, flaky, failed or stale receipt and names the status', () => {
    for (const status of ['skipped', 'flaky', 'failed', 'stale']) {
      const world = replaceReceipt(ALPHA.title, { status });
      expect(
        some(problemsOf(world), 'suite alpha works', `${status} receipt`),
        status,
      ).toBe(true);
    }
  });

  it('rejects the identity when any of several receipts for it is not a pass', () => {
    const world = withReceipts((rs) => [
      ...rs,
      receiptFor(ALPHA, { status: 'failed' }),
    ]);
    expect(some(problemsOf(world), 'suite alpha works', 'failed receipt')).toBe(
      true,
    );
    const twice = withReceipts((rs) => [...rs, receiptFor(ALPHA)]);
    expect(problemsOf(twice)).toEqual([]);
  });

  it('rejects a receipt whose file hash differs from the file now, or whose hash is missing', () => {
    expect(
      some(
        problemsOf(replaceReceipt(ALPHA.title, { fileSha256: 'f'.repeat(64) })),
        'suite alpha works',
        'file changed after the run',
      ),
    ).toBe(true);
    expect(
      some(
        problemsOf(replaceReceipt(ALPHA.title, { fileSha256: null })),
        'suite alpha works',
        'file changed after the run',
      ),
    ).toBe(true);
  });

  it('rejects a pgTAP receipt whose closure hash differs, though its own file is unchanged', () => {
    const world = replaceReceipt(BETA.title, { closureSha256: 'e'.repeat(64) });
    expect(
      some(problemsOf(world), BETA.title, 'closure', 'changed after the run'),
    ).toBe(true);
    const missing = replaceReceipt(BETA.title, { closureSha256: undefined });
    expect(some(problemsOf(missing), BETA.title, 'closure')).toBe(true);
    expect(closureSha(FILES.pgtap)).toMatch(/^[0-9a-f]{64}$/u);
  });

  it('rejects a file-level receipt standing in for a test', () => {
    const world = replaceReceipt(BETA.title, { granularity: 'file' });
    expect(some(problemsOf(world), BETA.title, 'file-level')).toBe(true);
  });

  it('rejects a cited identity the receipts show more than once in one run (ambiguous)', () => {
    const world = replaceReceipt(BETA.title, { occurrences: 2 });
    expect(
      some(problemsOf(world), BETA.title, 'occurrences', 'ambiguous'),
    ).toBe(true);
  });

  it('reports a shared citation once, naming every criterion that cites it', () => {
    const shared = baseWorld();
    const world = editEntry(shared, 'P2-S10-AC-002', (e) => ({
      ...e,
      clauses: [
        {
          ...(e.clauses[0] as EvidenceLedgerEntry['clauses'][number]),
          citations: [ALPHA],
        },
        e.clauses[1] as EvidenceLedgerEntry['clauses'][number],
      ],
    }));
    const broken = {
      ...world,
      receipts: world.receipts.filter((r) => r.title !== ALPHA.title),
    };
    const hits = problemsOf(broken).filter((p) => p.includes('no receipt'));
    expect(hits).toHaveLength(1);
    expect(hits[0]).toContain('P2-S10-AC-001');
    expect(hits[0]).toContain('P2-S10-AC-002');
  });

  it('keeps fileSha and the fixture hashes consistent', () => {
    expect(fileSha(FILES.vitestA)).not.toBe(fileSha(FILES.vitestB));
    expect(fileSha('apps/x/missing.test.ts')).toBeNull();
  });
});

describe('evidence guard: a cited file may not hide a skip, a failure or a duplicate', () => {
  const sibling = (over: Partial<Receipt>): World =>
    withReceipts((rs) => [
      ...rs,
      { ...receiptFor(vitestCite('uncited sibling')), ...over },
    ]);

  it('rejects a skipped, todo, failed or flaky sibling in a cited file', () => {
    for (const status of ['skipped', 'failed', 'flaky', 'stale']) {
      expect(
        some(
          problemsOf(sibling({ status })),
          'cited file',
          FILES.vitestA,
          'uncited sibling',
          status,
        ),
        status,
      ).toBe(true);
    }
  });

  it('ignores a passing sibling, a non-passing test of an uncited file and an uncited tool with the same path', () => {
    expect(problemsOf(sibling({}))).toEqual([]);
    expect(
      problemsOf(sibling({ status: 'skipped', file: 'apps/x/other.test.ts' })),
    ).toEqual([]);
    expect(problemsOf(sibling({ status: 'skipped', tool: 'race' }))).toEqual(
      [],
    );
  });

  it('rejects a duplicated sibling and a pgTAP file-level SKIP row of a cited file', () => {
    expect(
      some(
        problemsOf(sibling({ occurrences: 3 })),
        'cited file',
        'uncited sibling',
        'duplicated 3 times',
      ),
    ).toBe(true);
    const skipRow: Receipt = {
      tool: 'pgtap',
      granularity: 'file',
      file: FILES.pgtapInclude,
      title: 'SKIP or TODO assertion without a description',
      entrypoint: FILES.pgtap,
      status: 'skipped',
      fileSha256: fileSha(FILES.pgtapInclude),
      closureSha256: closureSha(FILES.pgtap),
    };
    const direct = withReceipts((rs) => [
      ...rs,
      { ...skipRow, file: FILES.pgtap },
    ]);
    expect(some(problemsOf(direct), 'cited file', FILES.pgtap, 'skipped')).toBe(
      true,
    );
    // an included file nobody cites is not blamed
    const included = withReceipts((rs) => [...rs, skipRow]);
    expect(problemsOf(included)).toEqual([]);
  });

  it('judges sibling hazards once per file even when several criteria cite it', () => {
    const hits = problemsOf(sibling({ status: 'skipped' })).filter((p) =>
      p.includes('uncited sibling'),
    );
    expect(hits).toHaveLength(1);
    expect(hits[0]).toContain('P2-S10-AC-001');
  });
});

describe('evidence guard: one test may not be the only proof for many criteria', () => {
  const GENERIC: EvidenceCitation = vitestCite('suite everything works');
  const soleWorld = (count: number, extraFor: number[] = []): World => {
    const entries: EvidenceLedgerEntry[] = [];
    for (let n = 1; n <= count; n += 1) {
      const claim = `Claim number ${String(n)} holds.`;
      entries.push({
        criterion: `P2-S10-AC-${String(n).padStart(3, '0')}`,
        text: claim,
        clauses: [
          {
            text: claim,
            citations: extraFor.includes(n)
              ? [
                  GENERIC,
                  vitestCite(`suite own test ${String(n)}`, FILES.vitestB),
                ]
              : [GENERIC],
          },
        ],
        status: 'verified',
        limitation: '',
      });
    }
    const receipts = [
      receiptFor(GENERIC),
      ...entries
        .flatMap((e) => e.clauses[0]?.citations.slice(1) ?? [])
        .map((c) => receiptFor(c)),
    ];
    return {
      entries,
      tracker: entries.map((e, index) => ({
        criterion: e.criterion,
        number: index + 1,
        checked: false,
        claim: e.text,
      })),
      receipts,
      expectedCount: count,
    };
  };

  it('allows one citation to be the sole proof of up to three criteria by default', () => {
    expect(problemsOf(soleWorld(3))).toEqual([]);
  });

  it('rejects a fourth criterion that leans on the same single citation, naming them all', () => {
    const problems = problemsOf(soleWorld(4));
    expect(
      some(
        problems,
        'suite everything works',
        'only proof',
        '4 criteria',
        'P2-S10-AC-004',
        'assertions of its own',
      ),
    ).toBe(true);
  });

  it('does not count a criterion whose clause has another citation beside it', () => {
    expect(problemsOf(soleWorld(4, [4]))).toEqual([]);
    expect(problemsOf(soleWorld(5, [4, 5]))).toEqual([]);
  });

  it('counts criteria, not clauses, and honours a configured limit', () => {
    expect(
      some(
        problemsOf(soleWorld(2), { slice: '10', maxSoleProof: 1 }),
        'only proof',
        '2 criteria',
      ),
    ).toBe(true);
    expect(problemsOf(soleWorld(2), { slice: '10', maxSoleProof: 2 })).toEqual(
      [],
    );
    expect(problemsOf(soleWorld(8), { slice: '10', maxSoleProof: 8 })).toEqual(
      [],
    );
  });

  it('returns the criteria each sole-proof citation carries', () => {
    const result = run(soleWorld(2));
    const [criteria] = [...result.soleProof.values()];
    expect(criteria).toEqual(['P2-S10-AC-001', 'P2-S10-AC-002']);
  });
});

describe('evidence guard: malformed receipts', () => {
  const bad = (row: unknown): string[] =>
    problemsOf(withReceipts((rs) => [...rs, row as Receipt]));

  it('rejects a receipt missing a field, with an unknown tool, status or hash, or not an object', () => {
    expect(some(bad({ tool: 'vitest' }), 'malformed receipt')).toBe(true);
    expect(
      some(
        bad({ ...receiptFor(ALPHA), tool: 'jest' }),
        'malformed receipt',
        'tool',
      ),
    ).toBe(true);
    expect(
      some(
        bad({ ...receiptFor(ALPHA), status: 'ok' }),
        'malformed receipt',
        'status',
      ),
    ).toBe(true);
    expect(
      some(
        bad({ ...receiptFor(ALPHA), fileSha256: 'abc' }),
        'malformed receipt',
        'fileSha256',
      ),
    ).toBe(true);
    expect(some(bad('row'), 'malformed receipt')).toBe(true);
  });

  it('summarises many malformed receipts in one problem', () => {
    const rows = Array.from({ length: 12 }, () => ({ tool: 'x' }));
    const problems = problemsOf(
      withReceipts((rs) => [...rs, ...(rows as unknown as Receipt[])]),
    );
    expect(
      problems.filter((p) => p.includes('malformed receipt')),
    ).toHaveLength(1);
    expect(problems.join('\n')).toContain('12 malformed receipt');
  });
});
