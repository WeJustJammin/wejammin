// Phase 2 evidence ledger: the tracker parser, the ledger loader and citation
// helpers shared by the collector, the runner, the generator and the guard.
// Pure except `loadLedger` (dynamic import).

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { normaliseSlice } from './receipts-lib.mjs';

const CRITERION_LINE =
  /^- \[([ xX])\] \*\*P2-S(\d\d)-AC-(\d{3,4})\*\* — (.*)$/u;
// The first markdown link to a relative spec path starts the source citation.
const SOURCE_LINK = / \[[^\]\n]+\]\((?:\.\.\/)+[^)\n]*\)/u;

/**
 * Every criterion line of one slice, in file order: its ID, number, checkbox and
 * claim. The claim is everything before the source citation links, so ticking a
 * checkbox or editing a source link never changes it.
 */
export const trackerCriteria = (markdown, slice) => {
  const digits = normaliseSlice(slice);
  const criteria = [];
  for (const line of markdown.split('\n')) {
    const match = CRITERION_LINE.exec(line);
    if (match === null || match[2] !== digits) continue;
    const rest = match[4] ?? '';
    const source = SOURCE_LINK.exec(rest);
    criteria.push({
      criterion: `P2-S${digits}-AC-${match[3]}`,
      number: Number(match[3]),
      checked: match[1] !== ' ',
      claim: source === null ? rest : rest.slice(0, source.index),
    });
  }
  return criteria;
};

/** The count the tracker header declares ("**Acceptance criteria**: 105"), or null. */
export const acceptanceCriteriaCount = (markdown) => {
  const match = /^\*\*Acceptance criteria\*\*:\s*(\d+)\s*$/mu.exec(markdown);
  return match === null ? null : Number(match[1]);
};

export const ledgerPathFor = (slice) =>
  `tests/contracts/phase-02-slice-${normaliseSlice(slice)}-evidence-ledger.ts`;

export const ledgerExportName = (slice) =>
  `S${normaliseSlice(slice)}_EVIDENCE_LEDGER`;

/**
 * The ledger entries of a slice, or null when the slice has no ledger file. The
 * file is TypeScript: Node strips its types on import, which is why a ledger file
 * may only use `import type` and erasable syntax.
 */
export const loadLedger = async (root, slice) => {
  const path = resolve(root, ledgerPathFor(slice));
  if (!existsSync(path)) return null;
  const module = await import(pathToFileURL(path).href);
  const entries = module[ledgerExportName(slice)];
  if (!Array.isArray(entries)) {
    throw new TypeError(
      `${ledgerPathFor(slice)} must export an array named ${ledgerExportName(slice)}`,
    );
  }
  return entries;
};

/** Every distinct citation of every clause of every entry, in first-seen order. */
export const citationsOf = (entries) => {
  const seen = new Set();
  const citations = [];
  for (const entry of entries) {
    for (const clause of entry.clauses ?? []) {
      for (const citation of clause.citations ?? []) {
        const key = [
          citation.tool,
          citation.file,
          citation.title,
          citation.project ?? '',
        ].join('\u0000');
        if (seen.has(key)) continue;
        seen.add(key);
        citations.push(citation);
      }
    }
  }
  return citations;
};

/**
 * Candidate clauses of a claim: split after `;` and `.` that are followed by
 * whitespace, outside backticks, parentheses and brackets. Each is a verbatim
 * trimmed part of the claim, in order, and together they tile it.
 */
export const proposeClauses = (claim) => {
  const clauses = [];
  let start = 0;
  let depth = 0;
  let inCode = false;
  for (let index = 0; index < claim.length; index += 1) {
    const char = claim[index];
    if (char === '`') inCode = !inCode;
    else if (inCode) continue;
    else if (char === '(' || char === '[') depth += 1;
    else if (char === ')' || char === ']') depth = Math.max(0, depth - 1);
    else if (
      (char === ';' || char === '.') &&
      depth === 0 &&
      (index + 1 === claim.length || /\s/u.test(claim[index + 1] ?? ''))
    ) {
      const clause = claim.slice(start, index + 1).trim();
      if (clause !== '') clauses.push(clause);
      start = index + 1;
    }
  }
  const tail = claim.slice(start).trim();
  if (tail !== '') clauses.push(tail);
  return clauses;
};
