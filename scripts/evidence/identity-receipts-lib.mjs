// Identity receipts (Slice 10 and later): one receipt per executed test, keyed by
// the test's identity and never by a criterion marker in its title.
//
//   { tool, granularity, file, title, [project], [entrypoint], status,
//     [occurrences], fileSha256, [closureSha256] }
//
// Identity per tool:
//   vitest      file + full title path (describe titles and test title, space joined)
//   pgtap       file holding the description + the exact `ok N - description` text
//               (whitespace collapsed); `entrypoint` is the .sql file pg_prove ran
//   playwright  file + full title path + project
//   race        runner file + the exact `ok - ...` assertion text
//
// A ledger citation (see ledger-lib.mjs) names exactly one identity. The
// collector writes a receipt for every cited test, and ALSO for every
// non-passing or duplicated test of a cited file, so a skipped, todo, flaky or
// failed sibling, or an ambiguous (duplicated) identity, is visible to the guard
// instead of hidden behind the passing test that was cited. Uncited passing
// tests produce no row.
//
// Nothing here reads a marker: a title that names a criterion earns it nothing.

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { pgtapClosure, sha256OfFile } from './receipts-lib.mjs';

/** The identity of one test as a string key; `project` is Playwright only. */
export const identityKey = (tool, file, title, project = '') =>
  [tool, file, title, project].join('\u0000');

const fileKey = (tool, file) => [tool, file].join('\u0000');

/**
 * SHA-256 over every file a pgTAP entrypoint runs (the entrypoint and each
 * `\ir` / `\i` include, transitively, in include order). An edit of any of them
 * changes it, even when the entrypoint itself is untouched. null when the
 * entrypoint does not exist.
 */
export const closureSha256 = (root, entrypoint) => {
  if (!existsSync(resolve(root, entrypoint))) return null;
  const hash = createHash('sha256');
  for (const file of pgtapClosure(root, entrypoint)) {
    hash.update(`${file}\u0000${sha256OfFile(root, file) ?? ''}\n`);
  }
  return hash.digest('hex');
};

const unique = (values) => [...new Set(values)];

/**
 * Receipts for the cited tests of `results` (see the header for what else is
 * written). `citations` are `{ tool, file, title, project? }`. Results that one
 * invocation produced more than once under one identity, or that a pgTAP
 * description present as a literal in several files of one entrypoint makes
 * ambiguous, carry `occurrences` (> 1): the guard refuses to cite them.
 */
export const buildIdentityReceipts = (results, root, citations) => {
  const citedKeys = new Set(
    citations.map((c) => identityKey(c.tool, c.file, c.title, c.project ?? '')),
  );
  const citedFiles = new Set(citations.map((c) => fileKey(c.tool, c.file)));
  const groups = new Map();
  for (const result of results) {
    const key = [
      result.invocation ?? '',
      result.tool,
      result.entrypoint ?? '',
      result.file,
      result.title,
      result.project ?? '',
    ].join('\u0000');
    const list = groups.get(key) ?? [];
    list.push(result);
    groups.set(key, list);
  }
  const receipts = new Map();
  for (const group of groups.values()) {
    const [first] = group;
    const occurrences =
      first.title === ''
        ? 1
        : Math.max(group.length, ...group.map((r) => r.ownerCount ?? 1));
    const cited = citedKeys.has(
      identityKey(first.tool, first.file, first.title, first.project ?? ''),
    );
    const inCitedFile = citedFiles.has(fileKey(first.tool, first.file));
    for (const status of unique(group.map((r) => r.status))) {
      if (!(cited || (inCitedFile && (status !== 'passed' || occurrences > 1))))
        continue;
      const receipt = {
        tool: first.tool,
        granularity: first.granularity,
        file: first.file,
        title: first.title,
        ...(first.tool === 'playwright'
          ? { project: first.project ?? '' }
          : {}),
        ...(first.entrypoint === undefined
          ? {}
          : { entrypoint: first.entrypoint }),
        status,
        ...(occurrences > 1 ? { occurrences } : {}),
        fileSha256: sha256OfFile(root, first.file),
        ...(first.entrypoint === undefined
          ? {}
          : { closureSha256: closureSha256(root, first.entrypoint) }),
      };
      receipts.set(JSON.stringify(receipt), receipt);
    }
  }
  const order = (r) =>
    [
      r.tool,
      r.file,
      r.title,
      r.project ?? '',
      r.entrypoint ?? '',
      r.status,
    ].join('\u0000');
  return [...receipts.values()].sort((a, b) =>
    order(a) < order(b) ? -1 : order(a) > order(b) ? 1 : 0,
  );
};
