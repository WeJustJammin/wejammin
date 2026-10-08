// The evidence ledger guard (pure): `evaluateLedger` returns every way a Phase 2
// slice ledger over-claims, as problem strings, plus the status counts.
//
// The ledger is the ONLY attribution of tests to criteria. A criterion marker in a
// test title earns nothing (it over-claimed about a third of the Slice 09
// criteria), so no rule here reads one. A clause is proven only by a citation
// that names one exact test and has a fresh passing receipt for that test's
// identity (identity-receipts-lib.mjs).

import { posix } from 'node:path';

import { identityKey } from './identity-receipts-lib.mjs';
import {
  STATUSES,
  TOOLS,
  UNATTRIBUTED_PGTAP_TITLE,
  normaliseSlice,
} from './receipts-lib.mjs';

export const LEDGER_STATUSES = Object.freeze([
  'verified',
  'partial',
  'unverified',
  'contract-only',
]);

/** Which files each tool can cite. */
const TOOL_FILES = Object.freeze({
  vitest: /\.(?:test\.tsx?|apispec\.ts|dbspec\.ts)$/u,
  pgtap: /\.(?:sql|sqlinc)$/u,
  playwright: /\.spec\.ts$/u,
  race: /^supabase\/tests\/.+\.mjs$/u,
});
const CITATION_PATH = /^[A-Za-z0-9_.@+/-]+$/u;
// What a file-level verdict looks like when someone pastes it as a "test title".
const FILE_VERDICT_TITLES = [
  /\S+\.(?:sql|sqlinc|mjs|tsx?)\s*\.{2,}\s*\S*/u,
  /^Result:\s*\w+$/u,
  /^All tests successful\.?$/u,
  /^Files=\d+,/u,
];
const MAX_TITLE_LENGTH = 1000;
const SHA256 = /^[0-9a-f]{64}$/u;
const NON_EVIDENCE =
  'skipped, todo, flaky, failed and stale are never evidence';
const DEFAULT_MAX_SOLE_PROOF = 3;
const LISTED = 5;

const ENTRY_KEYS = ['criterion', 'text', 'clauses', 'status', 'limitation'];
const CLAUSE_KEYS = ['text', 'citations'];
const CITATION_KEYS = ['tool', 'file', 'title'];
const MIN_LIMITATION_LENGTH = 20;
const PLACEHOLDER_LIMITATION = /^(?:n\/?a|none|todo|tbd|unknown|-+)\b/iu;
// Between two clauses only separators and the connectives "and" / "or" may remain.
const CLAUSE_SEPARATOR = /^(?:[\s;,.:—–-]|\band\b|\bor\b)*$/iu;

const numberOf = (criterion) => Number(/(\d{3,4})$/u.exec(criterion)?.[1]);
const isObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const excerpt = (text) => (text.length > 80 ? `${text.slice(0, 77)}...` : text);

/** Ledger against tracker: same criteria, same order, byte-identical texts. */
const trackerProblems = ({ entries, tracker, expectedCount, slice }) => {
  const problems = [];
  if (tracker.length === 0) {
    problems.push(`tracker lists no criteria of Slice ${slice}`);
    return problems;
  }
  if (!tracker.every((c, index) => c.number === index + 1)) {
    problems.push(
      `tracker criteria are not contiguous from 1 (found ${tracker.map((c) => String(c.number)).join(', ')})`,
    );
  }
  if (expectedCount !== null && tracker.length !== expectedCount) {
    problems.push(
      `tracker header declares ${String(expectedCount)} criteria but lists ${String(tracker.length)}`,
    );
  }
  const claims = new Map(tracker.map((c) => [c.criterion, c.claim]));
  const seen = new Set();
  let structural = false;
  for (const entry of entries) {
    const id = String(entry.criterion);
    if (!claims.has(id)) {
      problems.push(`${id}: not in the tracker`);
      structural = true;
    } else if (seen.has(id)) {
      problems.push(`${id}: listed more than once in the ledger`);
      structural = true;
    } else if (entry.text !== claims.get(id)) {
      problems.push(
        `${id}: criterion text differs from the tracker text (reworded); the ledger must copy the tracker claim byte for byte`,
      );
    }
    seen.add(id);
  }
  for (const { criterion } of tracker) {
    if (!seen.has(criterion)) {
      problems.push(`${criterion}: missing from the ledger`);
      structural = true;
    }
  }
  if (!structural) {
    const at = entries.findIndex(
      (e, i) => e.criterion !== tracker[i]?.criterion,
    );
    if (at !== -1) {
      problems.push(
        `ledger order differs from the tracker order (first difference at position ${String(at + 1)}: ${String(entries[at]?.criterion)}, tracker has ${String(tracker[at]?.criterion)})`,
      );
    }
  }
  return problems;
};

const keyProblems = (value, allowed, label) => {
  const problems = [];
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) problems.push(`${label}: unknown key "${key}"`);
  }
  for (const key of allowed) {
    if (!(key in value)) problems.push(`${label}: missing key "${key}"`);
  }
  return problems;
};

/** Clauses are verbatim, ordered, non-overlapping parts of the text that tile it. */
const clauseProblems = (entry, label) => {
  // No clauses is a status question (unverified), not a coverage one.
  if (entry.clauses.length === 0) return [];
  const problems = [];
  let cursor = 0;
  let ordered = true;
  for (const clause of entry.clauses) {
    if (clause.text.trim() === '') {
      problems.push(`${label}: clause text is empty`);
      ordered = false;
      continue;
    }
    const at = entry.text.indexOf(clause.text, cursor);
    if (at === -1) {
      problems.push(
        `${label}: clause "${excerpt(clause.text)}" is not a verbatim part of the criterion text in order (reworded, out of order or overlapping)`,
      );
      ordered = false;
      continue;
    }
    const gap = entry.text.slice(cursor, at);
    if (!CLAUSE_SEPARATOR.test(gap)) {
      problems.push(
        `${label}: criterion text not covered by any clause: "${excerpt(gap.trim())}"`,
      );
    }
    cursor = at + clause.text.length;
  }
  if (ordered) {
    const tail = entry.text.slice(cursor);
    if (!CLAUSE_SEPARATOR.test(tail)) {
      problems.push(
        `${label}: criterion text not covered by any clause: "${excerpt(tail.trim())}"`,
      );
    }
  }
  return problems;
};

const limitationProblems = (entry, label) => {
  const limitation = entry.limitation.trim();
  if (entry.status === 'verified') {
    return limitation === ''
      ? []
      : [
          `${label}: verified entry states a limitation; a criterion with a stated limitation is partial, not verified`,
        ];
  }
  return limitation.length >= MIN_LIMITATION_LENGTH &&
    !PLACEHOLDER_LIMITATION.test(limitation)
    ? []
    : [
        `${label}: ${entry.status} entry needs a limitation of at least ${String(MIN_LIMITATION_LENGTH)} characters saying what is not proven`,
      ];
};

const citationCount = (clauses) =>
  clauses.reduce((sum, clause) => sum + clause.citations.length, 0);

const statusProblems = (
  entry,
  label,
  { contractOnly, trackerClaim, needsTrackerText },
) => {
  const problems = [];
  const { clauses, status } = entry;
  const uncited = clauses.filter((c) => c.citations.length === 0);
  if (status === 'unverified' && citationCount(clauses) > 0) {
    problems.push(
      `${label}: unverified entry cites ${String(citationCount(clauses))} test(s); an entry with citations is partial or verified`,
    );
  }
  if (status === 'verified' || status === 'contract-only') {
    if (clauses.length === 0)
      problems.push(`${label}: ${status} entry has no clause`);
    for (const clause of uncited) {
      problems.push(
        `${label}: ${status} clause "${excerpt(clause.text)}" has no citation`,
      );
    }
  }
  if (status === 'partial' && clauses.length > 0) {
    if (uncited.length === 0) {
      problems.push(
        `${label}: partial entry: every clause is cited, so the entry is verified, not partial`,
      );
    }
    if (uncited.length === clauses.length) {
      problems.push(
        `${label}: partial entry: no clause is cited, so the entry is unverified`,
      );
    }
  }
  if (status === 'partial' && clauses.length === 0) {
    problems.push(`${label}: partial entry has no clause`);
  }
  if (status === 'contract-only') {
    const number = numberOf(entry.criterion);
    if (
      contractOnly === null ||
      number < contractOnly.from ||
      number > contractOnly.to
    ) {
      problems.push(
        `${label}: contract-only is not allowed for this criterion${contractOnly === null ? ' (this slice allows none)' : ` (allowed only for ${String(contractOnly.from)}..${String(contractOnly.to)})`}`,
      );
    }
    if (needsTrackerText && !/contract-only/iu.test(trackerClaim ?? '')) {
      problems.push(
        `${label}: contract-only requires the tracker text itself to say "contract-only"`,
      );
    }
  }
  return problems;
};

const citationLabel = (citation) =>
  isObject(citation)
    ? `${String(citation.tool)} ${String(citation.file)} :: ${String(citation.title)}${typeof citation.project === 'string' && citation.project !== '' ? ` [${citation.project}]` : ''}`
    : JSON.stringify(citation);

const who = (criteria) =>
  criteria.length <= LISTED
    ? criteria.join(', ')
    : `${criteria.slice(0, LISTED).join(', ')}, +${String(criteria.length - LISTED)} more`;

/** Reasons a citation is not exactly one well-formed test; empty when it is. */
const citationShape = (citation, fileSha) => {
  if (!isObject(citation)) return ['is not an object'];
  const reasons = [];
  const { tool, file, title, project } = citation;
  const allowed =
    tool === 'playwright' ? [...CITATION_KEYS, 'project'] : CITATION_KEYS;
  for (const key of Object.keys(citation)) {
    if (
      !allowed.includes(key) &&
      !(key === 'project' && tool !== 'playwright')
    ) {
      reasons.push(`unknown key "${key}"`);
    }
  }
  for (const key of CITATION_KEYS) {
    if (!(key in citation)) reasons.push(`missing key "${key}"`);
  }
  if (reasons.length > 0) return reasons;
  if (!TOOLS.includes(tool)) {
    return [`tool "${String(tool)}" is not one of ${TOOLS.join(', ')}`];
  }
  if (
    tool === 'playwright' &&
    (typeof project !== 'string' || project === '')
  ) {
    reasons.push('project is required for playwright');
  }
  if (tool !== 'playwright' && project !== undefined) {
    reasons.push('project is only for playwright');
  }
  if (
    typeof file !== 'string' ||
    file === '' ||
    !CITATION_PATH.test(file) ||
    file.startsWith('/') ||
    file.startsWith('./') ||
    file.split('/').includes('..')
  ) {
    reasons.push('file must be a repository-relative POSIX path');
  } else if (!TOOL_FILES[tool].test(file)) {
    reasons.push(`file extension does not match tool ${tool}`);
  } else if (fileSha(file) === null) {
    reasons.push('file does not exist');
  }
  if (typeof title !== 'string' || title === '') reasons.push('title is empty');
  else if (title !== title.trim()) reasons.push('title must be trimmed');
  else if (/[\r\n]/u.test(title)) reasons.push('title must be single-line');
  else if (title.length > MAX_TITLE_LENGTH) reasons.push('title is too long');
  else if (
    title === UNATTRIBUTED_PGTAP_TITLE ||
    title === file ||
    (typeof file === 'string' && title === posix.basename(file)) ||
    FILE_VERDICT_TITLES.some((pattern) => pattern.test(title))
  ) {
    reasons.push('title is a file-level verdict, not the name of one test');
  }
  return reasons;
};

/** One problem listing every malformed receipt row, or none. */
const receiptRowProblems = (receipts) => {
  const bad = [];
  receipts.forEach((row, index) => {
    const reasons = [];
    if (!isObject(row)) reasons.push('is not an object');
    else {
      for (const key of ['tool', 'granularity', 'file', 'title', 'status']) {
        if (typeof row[key] !== 'string')
          reasons.push(`${key} must be a string`);
      }
      if (!TOOLS.includes(row.tool))
        reasons.push(`tool "${String(row.tool)}" is not a known tool`);
      if (!STATUSES.includes(row.status))
        reasons.push(`status "${String(row.status)}" is not a known status`);
      if (row.fileSha256 !== null && !SHA256.test(String(row.fileSha256))) {
        reasons.push('fileSha256 must be a SHA-256 hex digest or null');
      }
      if ('criterion' in row) {
        reasons.push(
          'carries a criterion field (marker-mode receipts are not identity receipts)',
        );
      }
      if (row.tool === 'playwright' && typeof row.project !== 'string') {
        reasons.push('playwright receipt needs a project');
      }
      if (row.tool === 'pgtap' && typeof row.entrypoint !== 'string') {
        reasons.push('pgTAP receipt needs an entrypoint');
      }
      if (
        row.occurrences !== undefined &&
        !(Number.isInteger(row.occurrences) && row.occurrences > 1)
      ) {
        reasons.push('occurrences must be an integer above 1');
      }
    }
    if (reasons.length > 0) bad.push({ index, reasons });
  });
  if (bad.length === 0) return { problems: [], good: receipts };
  const first = bad[0];
  return {
    problems: [
      `${String(bad.length)} malformed receipt row(s); first (row ${String(first.index + 1)}): ${first.reasons.join('; ')}`,
    ],
    good: receipts.filter((_, index) => !bad.some((b) => b.index === index)),
  };
};

const expectedGranularity = (tool) =>
  tool === 'pgtap' || tool === 'race' ? 'assertion' : 'test';

/** What the receipts say about one cited test. */
const receiptProblems = (citation, rows, { fileSha, closureSha }) => {
  const reasons = [];
  if (rows.length === 0) {
    return [
      'no receipt: the test did not run, or its title does not match exactly (pgTAP titles are whitespace-collapsed)',
    ];
  }
  if (
    rows.some((row) => row.granularity !== expectedGranularity(citation.tool))
  ) {
    reasons.push('receipt is a file-level verdict, not the result of one test');
  }
  for (const status of [...new Set(rows.map((row) => row.status))]) {
    if (status !== 'passed')
      reasons.push(`has a ${status} receipt (${NON_EVIDENCE})`);
  }
  if (rows.some((row) => row.fileSha256 !== fileSha(citation.file))) {
    reasons.push(
      'stale receipt: the test file changed after the run (receipt hash does not match the file now)',
    );
  }
  if (
    citation.tool === 'pgtap' &&
    rows.some((row) => row.closureSha256 !== closureSha(row.entrypoint))
  ) {
    reasons.push(
      'stale receipt: a file included by the pgTAP entrypoint changed after the run (closure hash does not match)',
    );
  }
  const occurrences = Math.max(...rows.map((row) => row.occurrences ?? 1));
  if (occurrences > 1) {
    reasons.push(
      `identity is ambiguous: the run shows it ${String(occurrences)} times (occurrences ${String(occurrences)}); descriptions and titles must be unique within a file`,
    );
  }
  return reasons;
};

/** Non-passing or duplicated tests of a cited file that no citation names. */
const siblingProblems = (receipts, citedFiles, citedKeys) => {
  const problems = [];
  for (const row of receipts) {
    const criteria = citedFiles.get([row.tool, row.file].join('\u0000'));
    if (
      criteria === undefined ||
      citedKeys.has(
        identityKey(row.tool, row.file, row.title, row.project ?? ''),
      )
    ) {
      continue;
    }
    const where = `cited file ${row.file} (cited by ${who([...criteria])}): ${row.tool} "${row.title}"`;
    if (row.granularity === 'file' || row.status !== 'passed') {
      problems.push(
        `${where} is ${row.status}; ${NON_EVIDENCE}, and a cited file may not hide one`,
      );
    } else if ((row.occurrences ?? 1) > 1) {
      problems.push(
        `${where} is duplicated ${String(row.occurrences)} times (identity is ambiguous)`,
      );
    }
  }
  return problems;
};

/**
 * @param {object} input
 * @param {readonly object[]} input.entries ledger entries
 * @param {readonly {criterion: string, number: number, claim: string}[]} input.tracker
 * @param {number | null} input.expectedCount criteria count the tracker header declares
 * @param {readonly object[]} input.receipts identity receipts
 * @param {(file: string) => string | null} input.fileSha current SHA-256 of a file
 * @param {(entrypoint: string) => string | null} input.closureSha current pgTAP closure hash
 * @param {string} [input.slice]
 * @param {{from: number, to: number} | null} [input.contractOnly] criteria that may be contract-only
 * @param {boolean} [input.contractOnlyNeedsTrackerText] require the tracker text itself to say "contract-only" (default true)
 * @param {number} [input.maxSoleProof] most criteria one test may be the only proof of a clause for
 * @returns {{problems: string[], counts: object, soleProof: Map<string, string[]>}}
 */
export const evaluateLedger = ({
  entries,
  tracker,
  expectedCount,
  receipts,
  fileSha,
  closureSha,
  slice = '10',
  contractOnly = null,
  contractOnlyNeedsTrackerText = true,
  maxSoleProof = DEFAULT_MAX_SOLE_PROOF,
}) => {
  const digits = normaliseSlice(slice);
  const problems = trackerProblems({
    entries,
    tracker,
    expectedCount,
    slice: digits,
  });
  const claims = new Map(tracker.map((c) => [c.criterion, c.claim]));
  const counts = {
    total: entries.length,
    verified: 0,
    partial: 0,
    unverified: 0,
    contractOnly: 0,
  };
  const cited = new Map(); // identity key -> { citation, criteria: [] }
  const sole = new Map(); // citation label -> criteria
  for (const entry of entries) {
    const label = String(entry.criterion);
    if (!isObject(entry)) {
      problems.push(`ledger entry ${label} is not an object`);
      continue;
    }
    if (!new RegExp(`^P2-S${digits}-AC-\\d{3,4}$`, 'u').test(label)) {
      problems.push(`${label}: not a Slice ${digits} criterion ID`);
    }
    const shape = keyProblems(entry, ENTRY_KEYS, label);
    if (typeof entry.text !== 'string')
      shape.push(`${label}: text must be a string`);
    if (!Array.isArray(entry.clauses))
      shape.push(`${label}: clauses must be an array`);
    if (typeof entry.limitation !== 'string')
      shape.push(`${label}: limitation must be a string`);
    if (!LEDGER_STATUSES.includes(entry.status)) {
      shape.push(
        `${label}: status "${String(entry.status)}" is not one of ${LEDGER_STATUSES.join(', ')}`,
      );
    }
    if (Array.isArray(entry.clauses)) {
      for (const clause of entry.clauses) {
        if (
          !isObject(clause) ||
          typeof clause.text !== 'string' ||
          !Array.isArray(clause.citations)
        ) {
          shape.push(
            `${label}: every clause must be { text: string, citations: array }`,
          );
          break;
        }
        shape.push(...keyProblems(clause, CLAUSE_KEYS, `${label} clause`));
      }
    }
    problems.push(...shape);
    if (shape.length > 0) continue;
    if (entry.status === 'verified') counts.verified += 1;
    else if (entry.status === 'partial') counts.partial += 1;
    else if (entry.status === 'unverified') counts.unverified += 1;
    else counts.contractOnly += 1;
    problems.push(
      ...clauseProblems(entry, label),
      ...limitationProblems(entry, label),
      ...statusProblems(entry, label, {
        contractOnly,
        needsTrackerText: contractOnlyNeedsTrackerText,
        trackerClaim: claims.get(entry.criterion),
      }),
    );
    for (const clause of entry.clauses) {
      const seenInClause = new Set();
      for (const citation of clause.citations) {
        const reasons = citationShape(citation, fileSha);
        const key =
          reasons.length === 0
            ? identityKey(
                citation.tool,
                citation.file,
                citation.title,
                citation.project ?? '',
              )
            : null;
        if (key !== null && seenInClause.has(key))
          reasons.push('is cited twice in one clause');
        if (reasons.length > 0) {
          problems.push(
            ...reasons.map(
              (reason) =>
                `${label}: citation ${citationLabel(citation)}: ${reason}`,
            ),
          );
          continue;
        }
        seenInClause.add(key);
        const use = cited.get(key) ?? { citation, criteria: [] };
        if (!use.criteria.includes(label)) use.criteria.push(label);
        cited.set(key, use);
        if (clause.citations.length === 1) {
          const soleCriteria = sole.get(citationLabel(citation)) ?? [];
          if (!soleCriteria.includes(label)) soleCriteria.push(label);
          sole.set(citationLabel(citation), soleCriteria);
        }
      }
    }
  }
  const { problems: rowProblems, good } = receiptRowProblems(receipts);
  problems.push(...rowProblems);
  const byKey = new Map();
  for (const row of good) {
    const key = identityKey(row.tool, row.file, row.title, row.project ?? '');
    byKey.set(key, [...(byKey.get(key) ?? []), row]);
  }
  const citedFiles = new Map();
  for (const [key, { citation, criteria }] of cited) {
    for (const reason of receiptProblems(citation, byKey.get(key) ?? [], {
      fileSha,
      closureSha,
    })) {
      problems.push(
        `${citationLabel(citation)} (cited by ${who(criteria)}): ${reason}`,
      );
    }
    const fileKey = [citation.tool, citation.file].join('\u0000');
    const owners = citedFiles.get(fileKey) ?? new Set();
    for (const criterion of criteria) owners.add(criterion);
    citedFiles.set(fileKey, owners);
  }
  problems.push(...siblingProblems(good, citedFiles, new Set(cited.keys())));
  for (const [label, criteria] of sole) {
    if (criteria.length > maxSoleProof) {
      problems.push(
        `${label} is the only proof of a clause for ${String(criteria.length)} criteria (limit ${String(maxSoleProof)}): ${who(criteria)}; each criterion needs assertions of its own`,
      );
    }
  }
  return { problems, counts, soleProof: sole };
};
