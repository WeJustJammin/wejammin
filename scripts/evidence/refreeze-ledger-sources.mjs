#!/usr/bin/env node
// Re-freeze the "Sources frozen" table of the Slice 09 depth-floor ledger (AC1148):
// recompute the SHA-256, line count and modification time of every named source
// from the current files. Run after any edit of a frozen spec, once the files'
// modification times have settled, then re-run the ledger guard.
//
//   node scripts/evidence/refreeze-ledger-sources.mjs [--check]
//
// --check prints the rows that are stale and exits 1 without writing.

import { createHash } from 'node:crypto';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const LEDGER =
  '.memory/pipeline/progress/verification/2026-10-02-slice-09-dec108-depth-floor.md';

export const frozenRow = (path) => {
  const bytes = readFileSync(resolve(root, path));
  const modified = statSync(resolve(root, path)).mtime.toISOString();
  return {
    sha: createHash('sha256').update(bytes).digest('hex'),
    lines: bytes.toString('utf8').split('\n').length - 1,
    modified: `${modified.slice(0, 10)} ${modified.slice(11, 16)}Z`,
  };
};

export const refreeze = (text) => {
  const stale = [];
  const out = text.split('\n').map((line) => {
    const cells = line.split('|').map((cell) => cell.trim());
    // | Source | `path` | `sha` | lines | modified |
    if (cells.length < 7 || !/^`[^`]+`$/u.test(cells[2] ?? '')) return line;
    if (!/^`[0-9a-f]{64}`$/u.test(cells[3] ?? '')) return line;
    const path = cells[2].slice(1, -1);
    const fresh = frozenRow(path);
    const same =
      cells[3] === `\`${fresh.sha}\`` && Number(cells[4]) === fresh.lines;
    if (same) return line;
    stale.push(path);
    return `| ${cells[1]} | \`${path}\` | \`${fresh.sha}\` | ${String(fresh.lines)} | ${fresh.modified} |`;
  });
  return { text: out.join('\n'), stale };
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const { text, stale } = refreeze(readFileSync(resolve(root, LEDGER), 'utf8'));
  if (process.argv.includes('--check')) {
    console.log(
      stale.length === 0 ? 'ledger sources are current' : stale.join('\n'),
    );
    process.exit(stale.length === 0 ? 0 : 1);
  }
  writeFileSync(resolve(root, LEDGER), text);
  console.log(
    `re-froze ${String(stale.length)} source row(s)${stale.length ? `: ${stale.join(', ')}` : ''}`,
  );
}
