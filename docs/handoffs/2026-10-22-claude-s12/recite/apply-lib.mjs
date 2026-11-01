// Small pure helpers for recite/apply.mjs (citation keys, fix parsing, clause tiling).

// Same grammar as scripts/evidence/ledger-guard-lib.mjs CLAUSE_SEPARATOR: between two clauses only
// separators and the connectives "and" / "or" may remain.
export const CLAUSE_SEPARATOR = /^(?:[\s;,.:—–-]|\band\b|\bor\b)*$/iu;

export const keyOf = (c) =>
  [c.tool, c.file, c.title, c.project ?? ''].join('\u0000');

// The Playwright project that runs a spec (playwright.s09-real.config.ts testMatch selects these specs).
const PLAYWRIGHT_PROJECT_BY_SPEC = {
  'tests/e2e/phase-02-slice-12-governed-review-real-route.spec.ts':
    'real-route-chrome',
};

/** A ledger citation object from any lane's citation record. */
export const citation = (c) => {
  const out = { tool: c.tool, file: c.file, title: c.title };
  if (c.tool === 'playwright')
    out.project = c.project ?? PLAYWRIGHT_PROJECT_BY_SPEC[c.file] ?? '';
  return out;
};

export const label = (c) =>
  `${c.tool} ${c.file.split('/').slice(-2).join('/')} :: ${c.title}`;

/** Problems tiling `parts` over `text` (empty when they tile it verbatim, in order). */
export const tilingProblems = (text, parts) => {
  const problems = [];
  let cursor = 0;
  for (const part of parts) {
    const at = text.indexOf(part, cursor);
    if (at === -1) {
      problems.push(
        `part not verbatim/in order: ${JSON.stringify(part.slice(0, 80))}`,
      );
      return problems;
    }
    const gap = text.slice(cursor, at);
    if (!CLAUSE_SEPARATOR.test(gap)) {
      problems.push(
        `uncovered text before part: ${JSON.stringify(gap.slice(0, 80))}`,
      );
    }
    cursor = at + part.length;
  }
  const tail = text.slice(cursor);
  if (!CLAUSE_SEPARATOR.test(tail)) {
    problems.push(`uncovered tail: ${JSON.stringify(tail.slice(0, 80))}`);
  }
  return problems;
};

/**
 * Parts of a clause from anchors. An anchor is a verbatim part string, or
 * { until: s } (from the cursor through the end of the first s) or { rest: true } (to the end).
 */
export const partsFromAnchors = (text, anchors) => {
  const parts = [];
  let cursor = 0;
  for (const anchor of anchors) {
    if (typeof anchor === 'string') {
      const at = text.indexOf(anchor, cursor);
      if (at === -1)
        throw new Error(`anchor not found: ${anchor.slice(0, 60)}`);
      parts.push(anchor);
      cursor = at + anchor.length;
    } else if (anchor.until !== undefined) {
      const at = text.indexOf(anchor.until, cursor);
      if (at === -1)
        throw new Error(`until-anchor not found: ${anchor.until.slice(0, 60)}`);
      const start = text.slice(cursor).search(/\S/u) + cursor;
      parts.push(text.slice(start, at + anchor.until.length));
      cursor = at + anchor.until.length;
    } else if (anchor.rest === true) {
      const start = text.slice(cursor).search(/\S/u) + cursor;
      parts.push(text.slice(start));
      cursor = text.length;
    }
  }
  return parts;
};

export const excerpt = (text, n = 90) => {
  const t = text.replace(/\s+/gu, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 3)}...` : t;
};

export const sha256Hex = async (text) => {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(text).digest('hex');
};
