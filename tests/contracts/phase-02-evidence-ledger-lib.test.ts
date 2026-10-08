import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import type {
  EvidenceCitation,
  EvidenceLedgerEntry,
} from './phase-02-evidence-ledger';

type TrackerCriterion = {
  criterion: string;
  number: number;
  checked: boolean;
  claim: string;
};
type LedgerLib = {
  trackerCriteria: (markdown: string, slice: string) => TrackerCriterion[];
  acceptanceCriteriaCount: (markdown: string) => number | null;
  ledgerPathFor: (slice: string) => string;
  ledgerExportName: (slice: string) => string;
  loadLedger: (
    root: string,
    slice: string,
  ) => Promise<EvidenceLedgerEntry[] | null>;
  citationsOf: (entries: readonly EvidenceLedgerEntry[]) => EvidenceCitation[];
  proposeClauses: (claim: string) => string[];
};
const lib =
  (await import('../../scripts/evidence/ledger-lib.mjs')) as LedgerLib;

const root = mkdtempSync(join(tmpdir(), 'evidence-ledger-lib-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));
const put = (file: string, text: string): void => {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), text);
};

// Markers are assembled at run time so this fixture file is not itself a marker-bearing test.
const id = (slice: string, n: string): string => `P2-S${slice}-AC-${n}`;
const line = (
  slice: string,
  n: string,
  checked: boolean,
  text: string,
): string => `- [${checked ? 'x' : ' '}] **${id(slice, n)}** — ${text}`;
const link = ' [BE03b](../../../wiki/specs/be/03b.md) §§API Endpoints, Errors';

const tracker = [
  '# Phase 2 / Slice 10',
  '**Acceptance criteria**: 3',
  '## Acceptance Criteria',
  line('10', '001', false, `First claim; second part.${link}`),
  line('10', '002', true, `Only claim, no source links at all`),
  line('09', '003', false, `Another slice.${link}`),
  line(
    '10',
    '003',
    false,
    `Third claim with \`code\` and [inline](x) text. [Arch §P](../../x.md#p) §Phasing`,
  ),
  '- [ ] a plain checklist item that is not a criterion',
  line('10', '1004', false, `Four digits.${link}`),
].join('\n');

describe('phase 2 ledger library: tracker parsing', () => {
  it('reads every criterion of one slice in file order, with its checkbox and claim without the source links', () => {
    expect(lib.trackerCriteria(tracker, '10')).toEqual([
      {
        criterion: id('10', '001'),
        number: 1,
        checked: false,
        claim: 'First claim; second part.',
      },
      {
        criterion: id('10', '002'),
        number: 2,
        checked: true,
        claim: 'Only claim, no source links at all',
      },
      {
        criterion: id('10', '003'),
        number: 3,
        checked: false,
        claim: 'Third claim with `code` and [inline](x) text.',
      },
      {
        criterion: id('10', '1004'),
        number: 1004,
        checked: false,
        claim: 'Four digits.',
      },
    ]);
  });

  it('keeps the claim identical whether or not the checkbox is ticked, so a tick never rewords it', () => {
    const a = lib.trackerCriteria(
      line('10', '001', false, `Claim.${link}`),
      '10',
    );
    const b = lib.trackerCriteria(
      line('10', '001', true, `Claim.${link}`),
      '10',
    );
    expect(a[0]?.claim).toBe(b[0]?.claim);
  });

  it('reads another slice only when asked and rejects an invalid slice', () => {
    expect(lib.trackerCriteria(tracker, '09').map((c) => c.criterion)).toEqual([
      id('09', '003'),
    ]);
    expect(() => lib.trackerCriteria(tracker, '99')).toThrow(/slice/u);
  });

  it('reads the declared criteria count from the header, or null when absent', () => {
    expect(lib.acceptanceCriteriaCount(tracker)).toBe(3);
    expect(lib.acceptanceCriteriaCount('# no header')).toBeNull();
  });
});

describe('phase 2 ledger library: paths, loading and citations', () => {
  it('names the ledger file and its export by slice', () => {
    expect(lib.ledgerPathFor('10')).toBe(
      'tests/contracts/phase-02-slice-10-evidence-ledger.ts',
    );
    expect(lib.ledgerExportName('10')).toBe('S10_EVIDENCE_LEDGER');
    expect(lib.ledgerExportName('9')).toBe('S09_EVIDENCE_LEDGER');
  });

  it('loads a TypeScript ledger through its named export and returns null when the slice has no ledger', async () => {
    expect(await lib.loadLedger(root, '11')).toBeNull();
    put(
      'tests/contracts/phase-02-slice-11-evidence-ledger.ts',
      [
        "import type { EvidenceLedgerEntry } from './phase-02-evidence-ledger';",
        'export const S11_EVIDENCE_LEDGER: readonly EvidenceLedgerEntry[] = [',
        "  { criterion: 'P2-S11-AC-001', text: 'x', clauses: [], status: 'unverified', limitation: 'none yet' },",
        '];',
        '',
      ].join('\n'),
    );
    const entries = await lib.loadLedger(root, '11');
    expect(entries?.map((e) => e.criterion)).toEqual(['P2-S11-AC-001']);
  });

  it('throws when the ledger file lacks its named array export', async () => {
    put(
      'tests/contracts/phase-02-slice-12-evidence-ledger.ts',
      'export const other = [];\n',
    );
    await expect(lib.loadLedger(root, '12')).rejects.toThrow(
      /S12_EVIDENCE_LEDGER/u,
    );
  });

  it('flattens the citations of every clause once, in first-seen order, keeping Playwright projects apart', () => {
    const c = (title: string, project?: string): EvidenceCitation =>
      project === undefined
        ? { tool: 'vitest', file: 'a.test.ts', title }
        : { tool: 'playwright', file: 'a.spec.ts', title, project };
    const entry = (clauses: EvidenceCitation[][]): EvidenceLedgerEntry => ({
      criterion: id('10', '001'),
      text: 't',
      clauses: clauses.map((citations) => ({ text: 't', citations })),
      status: 'partial',
      limitation: 'x',
    });
    expect(
      lib.citationsOf([
        entry([[c('a'), c('b')], [c('a')]]),
        entry([[c('r', 'chrome'), c('r', 'mobile')]]),
      ]),
    ).toEqual([c('a'), c('b'), c('r', 'chrome'), c('r', 'mobile')]);
  });
});

describe('phase 2 ledger library: clause proposals and skeleton generator', () => {
  it('proposes clauses that are verbatim, in order, and tile the claim', () => {
    const claim =
      'Autosave changed paths; same-field divergence conflicts. Second sentence here.';
    const clauses = lib.proposeClauses(claim);
    expect(clauses).toEqual([
      'Autosave changed paths;',
      'same-field divergence conflicts.',
      'Second sentence here.',
    ]);
    let cursor = 0;
    for (const clause of clauses) {
      const at = claim.indexOf(clause, cursor);
      expect(at).toBeGreaterThanOrEqual(cursor);
      expect(claim.slice(cursor, at).trim()).toBe('');
      cursor = at + clause.length;
    }
    expect(claim.slice(cursor).trim()).toBe('');
  });

  it('does not split inside backticks or parentheses', () => {
    expect(
      lib.proposeClauses('Uses `a; b` and (c. d) together; then ends.'),
    ).toEqual(['Uses `a; b` and (c. d) together;', 'then ends.']);
  });

  const generator = resolve(
    import.meta.dirname,
    '../../scripts/evidence/new-ledger.mjs',
  );
  it('generates a loadable all-unverified ledger skeleton whose text equals the tracker claims', async () => {
    put('docs/tracker.md', tracker);
    const run = spawnSync(
      process.execPath,
      [generator, '--slice', '10', '--tracker', join(root, 'docs/tracker.md')],
      { encoding: 'utf8' },
    );
    expect(run.status, run.stderr).toBe(0);
    put('tests/contracts/phase-02-slice-10-evidence-ledger.ts', run.stdout);
    const entries = (await lib.loadLedger(root, '10')) ?? [];
    expect(
      entries.map((e) => [e.criterion, e.status, e.clauses.length]),
    ).toEqual([
      [id('10', '001'), 'unverified', 0],
      [id('10', '002'), 'unverified', 0],
      [id('10', '003'), 'unverified', 0],
      [id('10', '1004'), 'unverified', 0],
    ]);
    expect(entries.map((e) => e.text)).toEqual(
      lib.trackerCriteria(tracker, '10').map((c) => c.claim),
    );
    expect(entries.every((e) => e.limitation.length >= 20)).toBe(true);
  });

  it('proposes unverified clauses with --clauses and refuses an unreadable tracker', () => {
    const withClauses = spawnSync(
      process.execPath,
      [
        generator,
        '--slice',
        '10',
        '--tracker',
        join(root, 'docs/tracker.md'),
        '--clauses',
      ],
      { encoding: 'utf8' },
    );
    expect(withClauses.status, withClauses.stderr).toBe(0);
    expect(withClauses.stdout).toContain("text: 'First claim;'");
    const missing = spawnSync(
      process.execPath,
      [generator, '--slice', '10', '--tracker', join(root, 'docs/none.md')],
      { encoding: 'utf8' },
    );
    expect(missing.status).toBe(2);
  });
});
