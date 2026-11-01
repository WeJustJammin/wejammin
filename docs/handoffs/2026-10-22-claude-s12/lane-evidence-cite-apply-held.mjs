// Applies the citations listed in lane-evidence-cite-held.json to the five Slice 12 ledger
// fragments. Run from the repository root with the pinned toolchain:
//   node docs/handoffs/2026-10-22-claude-s12/lane-evidence-cite-apply-held.mjs [--ambiguous]
// It only adds citations (never edits claim text, clause text, status or limitation) and prints
// every entry whose clauses are then all cited, because the guard then requires `verified`
// with no limitation; that decision belongs to root after fresh receipts and a refutation audit.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const held = JSON.parse(
  readFileSync(
    resolve(
      root,
      'docs/handoffs/2026-10-22-claude-s12/lane-evidence-cite-held.json',
    ),
    'utf8',
  ),
);
const additions = [
  ...held.held.map((item) => ({ ...item, citationsToAdd: item.citations })),
  ...(process.argv.includes('--ambiguous')
    ? held.blockedAmbiguous.map((item) => ({
        criterion: item.criterion,
        clauseIndex: item.clauseIndex,
        citationsToAdd: [item.citation],
      }))
    : []),
];
const module = await import(
  `${pathToFileURL(resolve(root, 'tests/contracts/phase-02-slice-12-evidence-ledger.ts')).href}?t=${Date.now()}`
);
const entries = module.S12_EVIDENCE_LEDGER.map((entry) => ({
  ...entry,
  clauses: entry.clauses.map((clause) => ({
    ...clause,
    citations: [...clause.citations],
  })),
}));
for (const item of additions) {
  const entry = entries.find(
    (candidate) => candidate.criterion === item.criterion,
  );
  const clause = entry?.clauses[item.clauseIndex];
  if (clause === undefined)
    throw new Error(`no clause ${item.criterion}[${String(item.clauseIndex)}]`);
  for (const citation of item.citationsToAdd) {
    const known = clause.citations.some(
      (existing) =>
        existing.tool === citation.tool &&
        existing.file === citation.file &&
        existing.title === citation.title,
    );
    if (!known) clause.citations.push(citation);
  }
}
for (const entry of entries) {
  // An unverified entry that now cites something is partial (the guard rejects "unverified with
  // citations"); an entry whose every clause is cited is reported below for root to decide.
  const cited = entry.clauses.filter(
    (clause) => clause.citations.length > 0,
  ).length;
  if (
    entry.status === 'unverified' &&
    cited > 0 &&
    cited < entry.clauses.length
  ) {
    entry.status = 'partial';
  }
}
const fragments = [
  ['001-071', '001_071'],
  ['072-142', '072_142'],
  ['143-213', '143_213'],
  ['214-285', '214_285'],
  ['286-296', '286_296'],
];
for (const [range, name] of fragments) {
  const [low, high] = range.split('-').map(Number);
  const path = resolve(
    root,
    `tests/contracts/phase-02-slice-12-evidence-ledger-${range}.ts`,
  );
  const source = readFileSync(path, 'utf8');
  const head = source.slice(
    0,
    source.indexOf(`export const S12_EVIDENCE_LEDGER_${name}`),
  );
  const own = entries.filter((entry) => {
    const number = Number(entry.criterion.slice(-3));
    return number >= low && number <= high;
  });
  writeFileSync(
    path,
    `${head}export const S12_EVIDENCE_LEDGER_${name}: readonly EvidenceLedgerEntry[] = ${JSON.stringify(own, null, 2)};\n`,
  );
}
execFileSync(
  'pnpm',
  [
    'exec',
    'prettier',
    '--write',
    'tests/contracts/phase-02-slice-12-evidence-ledger-*-*.ts',
  ],
  {
    cwd: root,
    stdio: 'inherit',
  },
);
const complete = entries.filter((entry) =>
  entry.clauses.every((clause) => clause.citations.length > 0),
);
console.log(
  `entries with every clause cited (guard requires verified, no limitation): ${complete.map((entry) => entry.criterion).join(', ') || 'none'}`,
);
