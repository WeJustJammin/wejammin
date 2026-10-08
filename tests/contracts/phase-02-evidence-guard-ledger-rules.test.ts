import { describe, expect, it } from 'vitest';

import type { EvidenceLedgerEntry } from './phase-02-evidence-ledger';
import {
  CLAIMS,
  baseWorld,
  editEntry,
  problemsOf,
  run,
  some,
  type World,
} from './phase-02-evidence-guard-fixtures';

describe('evidence guard: a clean ledger', () => {
  it('accepts a consistent verified, partial, contract-only and unverified ledger and reports the counts', () => {
    const result = run(baseWorld());
    expect(result.problems).toEqual([]);
    expect(result.counts).toEqual({
      total: 4,
      verified: 1,
      partial: 1,
      unverified: 1,
      contractOnly: 1,
    });
  });

  it('accepts an all-unverified ledger with no receipts at all', () => {
    const world = baseWorld();
    const entries = world.entries.map((entry): EvidenceLedgerEntry => ({
      ...entry,
      clauses: [],
      status: 'unverified',
      limitation: 'No test is cited for this criterion yet.',
    }));
    const result = run({ ...world, entries, receipts: [] });
    expect(result.problems).toEqual([]);
    expect(result.counts).toMatchObject({
      total: 4,
      verified: 0,
      unverified: 4,
    });
  });

  it('keeps the tracker claim identical whether or not its checkbox is ticked', () => {
    const world = baseWorld();
    expect(
      problemsOf({
        ...world,
        tracker: world.tracker.map((c) => ({ ...c, checked: true })),
      }),
    ).toEqual([]);
  });
});

describe('evidence guard: ledger and tracker agree', () => {
  it('rejects a reworded criterion text, naming the criterion', () => {
    const world = editEntry(baseWorld(), 'P2-S10-AC-004', (entry) => ({
      ...entry,
      text: 'Zeta works well.',
    }));
    expect(
      some(problemsOf(world), 'P2-S10-AC-004', 'tracker', 'reworded'),
    ).toBe(true);
  });

  it('rejects a ledger that omits a criterion, adds one the tracker lacks, repeats one or reorders them', () => {
    const world = baseWorld();
    const [first, second, ...rest] = world.entries;
    const omitted = problemsOf({
      ...world,
      entries: [first, ...rest] as EvidenceLedgerEntry[],
    });
    expect(some(omitted, 'P2-S10-AC-002', 'missing from the ledger')).toBe(
      true,
    );
    const extra: EvidenceLedgerEntry = {
      ...(world.entries[3] as EvidenceLedgerEntry),
      criterion: 'P2-S10-AC-005',
    };
    expect(
      some(
        problemsOf({ ...world, entries: [...world.entries, extra] }),
        'P2-S10-AC-005',
        'not in the tracker',
      ),
    ).toBe(true);
    const repeated = problemsOf({
      ...world,
      entries: [...world.entries, first as EvidenceLedgerEntry],
    });
    expect(some(repeated, 'P2-S10-AC-001', 'more than once')).toBe(true);
    const reordered = problemsOf({
      ...world,
      entries: [second, first, ...rest] as EvidenceLedgerEntry[],
    });
    expect(some(reordered, 'order')).toBe(true);
  });

  it('rejects a tracker whose criteria are not contiguous from 1 or whose count differs from its header', () => {
    const world = baseWorld();
    const gap = {
      ...world,
      tracker: world.tracker.map((c) =>
        c.number === 3 ? { ...c, number: 7 } : c,
      ),
    };
    expect(some(problemsOf(gap), 'contiguous')).toBe(true);
    expect(
      some(problemsOf({ ...world, expectedCount: 105 }), 'header', '105'),
    ).toBe(true);
    expect(problemsOf({ ...world, expectedCount: null })).toEqual([]);
  });

  it('rejects an empty tracker', () => {
    expect(
      some(
        problemsOf({ ...baseWorld(), tracker: [], entries: [] }),
        'tracker',
        'no criteria',
      ),
    ).toBe(true);
  });
});

describe('evidence guard: entry shape and status rules', () => {
  const entry = (world: World, n: string): EvidenceLedgerEntry =>
    world.entries.find(
      (e) => e.criterion === `P2-S10-AC-${n}`,
    ) as EvidenceLedgerEntry;

  it('rejects an unknown status, an unknown key and a malformed field', () => {
    const base = baseWorld();
    const bad = (change: Record<string, unknown>): string[] =>
      problemsOf(
        editEntry(
          base,
          'P2-S10-AC-004',
          (e) => ({ ...e, ...change }) as EvidenceLedgerEntry,
        ),
      );
    expect(some(bad({ status: 'done' }), 'P2-S10-AC-004', 'status')).toBe(true);
    expect(some(bad({ extra: 1 }), 'P2-S10-AC-004', 'unknown key')).toBe(true);
    expect(some(bad({ clauses: 'none' }), 'P2-S10-AC-004', 'clauses')).toBe(
      true,
    );
    expect(some(bad({ limitation: 5 }), 'P2-S10-AC-004', 'limitation')).toBe(
      true,
    );
  });

  it('rejects a verified clause with no citation', () => {
    const world = editEntry(baseWorld(), 'P2-S10-AC-001', (e) => ({
      ...e,
      clauses: [
        e.clauses[0],
        { text: 'beta does another.', citations: [] },
      ] as EvidenceLedgerEntry['clauses'],
    }));
    expect(
      some(
        problemsOf(world),
        'P2-S10-AC-001',
        'verified',
        'no citation',
        'beta does another',
      ),
    ).toBe(true);
  });

  it('rejects a verified entry with no clauses and one that states a limitation', () => {
    const noClauses = editEntry(baseWorld(), 'P2-S10-AC-001', (e) => ({
      ...e,
      clauses: [],
    }));
    expect(
      some(problemsOf(noClauses), 'P2-S10-AC-001', 'verified', 'no clause'),
    ).toBe(true);
    const limited = editEntry(baseWorld(), 'P2-S10-AC-001', (e) => ({
      ...e,
      limitation: 'except the edge case',
    }));
    expect(
      some(problemsOf(limited), 'P2-S10-AC-001', 'verified', 'limitation'),
    ).toBe(true);
  });

  it('rejects an unverified entry that cites a test, or states no real limitation', () => {
    const cited = editEntry(baseWorld(), 'P2-S10-AC-004', (e) => ({
      ...e,
      clauses: [
        {
          text: CLAIMS.four,
          citations: [entry(baseWorld(), '001').clauses[0]?.citations[0]],
        },
      ] as EvidenceLedgerEntry['clauses'],
    }));
    expect(
      some(problemsOf(cited), 'P2-S10-AC-004', 'unverified', 'cites'),
    ).toBe(true);
    for (const limitation of ['', 'n/a', 'TODO', 'tbd', 'short']) {
      const world = editEntry(baseWorld(), 'P2-S10-AC-004', (e) => ({
        ...e,
        limitation,
      }));
      expect(
        some(problemsOf(world), 'P2-S10-AC-004', 'limitation'),
        limitation,
      ).toBe(true);
    }
  });

  it('rejects a partial entry whose clauses are all cited, none cited, or that has no limitation', () => {
    const allCited = editEntry(baseWorld(), 'P2-S10-AC-002', (e) => ({
      ...e,
      clauses: e.clauses.map((c) => ({
        ...c,
        citations: e.clauses[0]?.citations ?? [],
      })),
    }));
    expect(
      some(
        problemsOf(allCited),
        'P2-S10-AC-002',
        'partial',
        'every clause is cited',
      ),
    ).toBe(true);
    const none = editEntry(baseWorld(), 'P2-S10-AC-002', (e) => ({
      ...e,
      clauses: e.clauses.map((c) => ({ ...c, citations: [] })),
    }));
    expect(
      some(problemsOf(none), 'P2-S10-AC-002', 'partial', 'no clause is cited'),
    ).toBe(true);
    const silent = editEntry(baseWorld(), 'P2-S10-AC-002', (e) => ({
      ...e,
      limitation: '',
    }));
    expect(some(problemsOf(silent), 'P2-S10-AC-002', 'limitation')).toBe(true);
  });
});

describe('evidence guard: clauses are verbatim and tile the criterion text', () => {
  const withClauses = (texts: string[]): World =>
    editEntry(baseWorld(), 'P2-S10-AC-001', (e) => ({
      ...e,
      clauses: texts.map((text, index) => ({
        text,
        citations: e.clauses[index]?.citations ?? e.clauses[0]?.citations ?? [],
      })),
    }));

  it('rejects a clause that is not a verbatim part of the text (reworded to fit a test)', () => {
    const world = withClauses([
      'Alpha does a single thing;',
      'beta does another.',
    ]);
    expect(some(problemsOf(world), 'P2-S10-AC-001', 'clause', 'verbatim')).toBe(
      true,
    );
  });

  it('rejects clauses out of order or overlapping', () => {
    expect(
      some(
        problemsOf(
          withClauses(['beta does another.', 'Alpha does one thing;']),
        ),
        'clause',
        'verbatim',
      ),
    ).toBe(true);
    expect(
      some(
        problemsOf(withClauses([CLAIMS.one, 'beta does another.'])),
        'clause',
        'verbatim',
      ),
    ).toBe(true);
  });

  it('rejects clauses that drop part of the text, so a verified entry cannot prove less than it claims', () => {
    const dropped = withClauses(['Alpha does one thing;']);
    expect(
      some(
        problemsOf(dropped),
        'P2-S10-AC-001',
        'not covered',
        'beta does another',
      ),
    ).toBe(true);
    const middle = editEntry(baseWorld(), 'P2-S10-AC-002', (e) => ({
      ...e,
      clauses: [
        { text: 'delta is logged.', citations: e.clauses[0]?.citations ?? [] },
      ],
    }));
    expect(
      some(
        problemsOf(middle),
        'P2-S10-AC-002',
        'not covered',
        'Gamma is enforced',
      ),
    ).toBe(true);
  });

  it('allows only separators and the words and or between clauses', () => {
    const world = editEntry(baseWorld(), 'P2-S10-AC-004', (e) => ({
      ...e,
      text: 'Zeta works, and eta too.',
      clauses: [
        { text: 'Zeta works', citations: [] },
        { text: 'eta too.', citations: [] },
      ],
    }));
    const tracker = world.tracker.map((c) =>
      c.criterion === 'P2-S10-AC-004'
        ? { ...c, claim: 'Zeta works, and eta too.' }
        : c,
    );
    expect(problemsOf({ ...world, tracker })).toEqual([]);
    const gapWord = editEntry(world, 'P2-S10-AC-004', (e) => ({
      ...e,
      text: 'Zeta works, plainly eta too.',
      clauses: [e.clauses[0], e.clauses[1]] as EvidenceLedgerEntry['clauses'],
    }));
    const tracker2 = gapWord.tracker.map((c) =>
      c.criterion === 'P2-S10-AC-004'
        ? { ...c, claim: 'Zeta works, plainly eta too.' }
        : c,
    );
    expect(
      some(
        problemsOf({ ...gapWord, tracker: tracker2 }),
        'P2-S10-AC-004',
        'not covered',
        'plainly',
      ),
    ).toBe(true);
  });

  it('rejects an empty clause text', () => {
    expect(
      some(
        problemsOf(withClauses(['', 'beta does another.'])),
        'P2-S10-AC-001',
        'clause',
        'empty',
      ),
    ).toBe(true);
  });
});

describe('evidence guard: contract-only is narrow', () => {
  it('allows contract-only only inside the configured criterion range', () => {
    expect(problemsOf(baseWorld())).toEqual([]);
    expect(
      some(
        problemsOf(baseWorld(), {
          slice: '10',
          contractOnly: { from: 8, to: 9 },
        }),
        'P2-S10-AC-003',
        'contract-only',
        'not allowed',
      ),
    ).toBe(true);
    expect(
      some(
        problemsOf(baseWorld(), { slice: '10', contractOnly: null }),
        'P2-S10-AC-003',
        'contract-only',
        'not allowed',
      ),
    ).toBe(true);
  });

  it('rejects contract-only when the tracker text does not say so', () => {
    const world = editEntry(baseWorld(), 'P2-S10-AC-001', (e) => ({
      ...e,
      status: 'contract-only',
      limitation: 'Runtime behaviour is not proven here.',
    }));
    const options = { slice: '10', contractOnly: { from: 1, to: 3 } };
    expect(
      some(
        problemsOf(world, options),
        'P2-S10-AC-001',
        'contract-only',
        'tracker',
      ),
    ).toBe(true);
  });

  it('lets a policy drop the tracker-text requirement, but never the range', () => {
    const world = editEntry(baseWorld(), 'P2-S10-AC-001', (e) => ({
      ...e,
      status: 'contract-only',
      limitation: 'Runtime behaviour is not proven here.',
    }));
    const relaxed = {
      slice: '10',
      contractOnly: { from: 1, to: 3 },
      contractOnlyNeedsTrackerText: false,
    };
    expect(problemsOf(world, relaxed)).toEqual([]);
    const outside = { ...relaxed, contractOnly: { from: 2, to: 3 } };
    expect(
      some(problemsOf(world, outside), 'P2-S10-AC-001', 'not allowed'),
    ).toBe(true);
  });

  it('requires contract-only entries to cite every clause and to state what stays unproven', () => {
    const uncited = editEntry(baseWorld(), 'P2-S10-AC-003', (e) => ({
      ...e,
      clauses: [{ text: CLAIMS.three, citations: [] }],
    }));
    expect(
      some(
        problemsOf(uncited),
        'P2-S10-AC-003',
        'contract-only',
        'no citation',
      ),
    ).toBe(true);
    const silent = editEntry(baseWorld(), 'P2-S10-AC-003', (e) => ({
      ...e,
      limitation: '',
    }));
    expect(some(problemsOf(silent), 'P2-S10-AC-003', 'limitation')).toBe(true);
  });

  it('never counts contract-only as verified', () => {
    expect(run(baseWorld()).counts).toMatchObject({
      verified: 1,
      contractOnly: 1,
    });
  });
});
