import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../..');
const LEDGER_PATH =
  '.memory/pipeline/progress/verification/2026-10-02-slice-09-dec108-depth-floor.md';
const RAW_DECISIONS = '.memory/raw/events/2026-10-02.jsonl';

const read = (relativePath: string): string =>
  readFileSync(resolve(ROOT, relativePath), 'utf8');
const sha256 = (relativePath: string): string =>
  createHash('sha256')
    .update(readFileSync(resolve(ROOT, relativePath)))
    .digest('hex');
const lineCount = (relativePath: string): number =>
  read(relativePath).split('\n').length - 1;
const squash = (text: string): string => text.replace(/\s+/gu, ' ');

const ledger = read(LEDGER_PATH);

// While Slice 09 is open the frozen sources must still be the files the ledger
// counted. Once the tracker says complete, later slices legitimately edit shared
// specs, so the recorded digests become history: they must stay well-formed and
// the files they name must still exist, but they are no longer compared.
const TRACKER_PATH = '.memory/pipeline/progress/slices/phase-02-slice-09.md';
const sliceIsOpen = (): boolean => {
  const status = /^\*\*Status\*\*:\s*(\S+)/mu.exec(read(TRACKER_PATH))?.[1];
  expect(status, 'tracker Status line').toBeDefined();
  return status !== 'complete';
};
const SHA256_HEX = /^[0-9a-f]{64}$/u;

const section = (heading: string): string => {
  const start = ledger.indexOf(`\n## ${heading}`);
  expect(start, `ledger section "${heading}"`).toBeGreaterThanOrEqual(0);
  const rest = ledger.slice(start + 1);
  const end = rest.slice(3).search(/\n## /u);
  return end < 0 ? rest : rest.slice(0, end + 3);
};

const tableRows = (body: string): string[][] =>
  body
    .split('\n')
    .filter((line) => line.startsWith('| ') && !line.startsWith('| ---'))
    .slice(1)
    .map((line) =>
      line
        .slice(1, line.endsWith('|') ? -1 : undefined)
        .split(/(?<!\\)\|/u)
        .map((cell) => cell.trim()),
    );

const unwrap = (cell: string): string => cell.replace(/^`|`$/gu, '');

const EXPECTED_SOURCES = [
  'IA03',
  'IA03 deep dive',
  'BE03a',
  'BE03b',
  'BE03c',
  'BE01a',
  'BE00',
  'BE01c',
  'BE05b',
  'FE00',
  'FE01',
  'FE03',
  'FE05',
  'IA01',
  'IA01 deep dive',
  'Approved proposal',
  'Approval record',
];

const anchorHolds = (anchor: string, quote: string): boolean => {
  const [path, line] = [
    anchor.slice(0, anchor.lastIndexOf(':')),
    Number(anchor.slice(anchor.lastIndexOf(':') + 1)),
  ];
  if (!existsSync(resolve(ROOT, path)) || !Number.isInteger(line)) {
    return false;
  }
  const lines = read(path).split('\n');
  return (
    line >= 1 &&
    line <= lines.length &&
    squash(lines[line - 1] ?? '').includes(squash(quote))
  );
};

// While the slice is open the anchored line must still carry the quote. After
// completion a later slice may move lines, so the anchor only has to name an
// existing file and a positive line number.
const anchorResolves = (
  anchor: string,
  quote: string,
  open: boolean,
): boolean => {
  if (open) return anchorHolds(anchor, quote);
  const path = anchor.slice(0, anchor.lastIndexOf(':'));
  const line = Number(anchor.slice(anchor.lastIndexOf(':') + 1));
  return existsSync(resolve(ROOT, path)) && Number.isInteger(line) && line >= 1;
};

describe('Slice 09 depth-floor ledger guard', () => {
  it('[P2-S09-AC-1148] freezes every named source with the digest and line count of the current file', () => {
    const rows = tableRows(
      section('Sources frozen').split('Owner decisions')[0] ?? '',
    );
    expect(rows.map(([label]) => label)).toEqual(EXPECTED_SOURCES);
    const open = sliceIsOpen();
    for (const [label, path, digest, lines] of rows) {
      const file = unwrap(path ?? '');
      expect(existsSync(resolve(ROOT, file)), `${label} exists`).toBe(true);
      expect(unwrap(digest ?? ''), `${label} SHA-256 is well-formed`).toMatch(
        SHA256_HEX,
      );
      expect(
        Number.isInteger(Number(lines)) && Number(lines) > 0,
        `${label} line count is recorded`,
      ).toBe(true);
      if (open) {
        expect(unwrap(digest ?? ''), `${label} SHA-256`).toBe(sha256(file));
        expect(Number(lines), `${label} line count`).toBe(lineCount(file));
      }
    }
  });

  it('[P2-S09-AC-1148] records the approval-record proposal digest and each owner decision line digest', () => {
    const approval = read(
      '.memory/pipeline/progress/verification/2026-10-02-slice-09-activation-amendment-approval.md',
    );
    const recorded = /[0-9a-f]{64}/u.exec(approval)?.[0];
    expect(recorded).toBeDefined();
    expect(ledger).toContain(
      `approved-proposal digest recorded in the approval record is \`${recorded}\``,
    );

    const decisionStart = ledger.indexOf('Owner decisions read from');
    const decisionBody = ledger.slice(decisionStart);
    const rows = tableRows(
      decisionBody.slice(0, decisionBody.indexOf('\n## ')),
    );
    expect(rows.map(([id]) => id)).toEqual([
      'DEC-108',
      'DEC-109',
      'DEC-110',
      'DEC-111',
      'DEC-119',
      'DEC-120',
    ]);
    const byId = new Map<string, string>();
    for (const line of read(RAW_DECISIONS).split('\n')) {
      try {
        const record = JSON.parse(line) as {
          metadata?: { canonicalId?: string };
        };
        const id = record.metadata?.canonicalId;
        if (id !== undefined) {
          byId.set(id, createHash('sha256').update(`${line}\n`).digest('hex'));
        }
      } catch {
        // non-record line
      }
    }
    for (const [id, digest] of rows) {
      expect(unwrap(digest ?? ''), `${id} line digest`).toBe(
        byId.get(id ?? ''),
      );
    }
  });

  it('[P2-S09-AC-273] gives every warning and gap a resolving source anchor and a recorded owner decision or resolution', () => {
    const rows = tableRows(section('Gaps and observations'));
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const open = sliceIsOpen();
    for (const [
      gap,
      status,
      source,
      quote,
      resolution,
      record,
      recordQuote,
    ] of rows) {
      const label = (gap ?? '').slice(0, 60);
      expect(
        ['resolved', 'resolved by ruling', 'observation'],
        `${label} status`,
      ).toContain(status);
      expect(
        anchorResolves(unwrap(source ?? ''), unwrap(quote ?? ''), open),
        `${label} source anchor ${source}`,
      ).toBe(true);
      expect(
        anchorResolves(unwrap(record ?? ''), unwrap(recordQuote ?? ''), open),
        `${label} record anchor ${record}`,
      ).toBe(true);
      expect((resolution ?? '').length, `${label} resolution`).toBeGreaterThan(
        40,
      );
    }
    expect(ledger).not.toMatch(
      /the owner must settle|registry owner must name/iu,
    );
  });

  it('[P2-S09-AC-273] keeps the ledger free of unresolved ambiguity markers', () => {
    expect(ledger).not.toMatch(/\bunresolved gaps\b/iu);
    expect(ledger).not.toMatch(/\bTBD\b|\bTODO\b|\bopen question\b/u);
  });
});
