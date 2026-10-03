// Slice 09 evidence receipts: pure parsers and the receipt builder.
//
// A receipt is one row per (criterion marker x executed test):
//   { criterion, tool, granularity, file, title, status, fileSha256 }
// Every field is derived from machine output (a vitest JSON report, pgTAP TAP
// output, Playwright JSON reports, db:races output) plus the SHA-256 of the test
// file as it is on disk. Nothing is typed by hand, and a receipt goes stale the
// moment its test file changes.
//
// Race-runner JSON lines (the format the db:races gate emits with --jsonl):
//   {"marker":"P2-S09-AC-052","title":"<assertion text>","status":"passed","file":"supabase/tests/.../x.mjs"}
// `marker` is one criterion ID, `status` is passed | failed, `file` is the runner
// path relative to the repository root. The plain-text `ok -` output of
// db:races is also accepted (assertions are attributed to the runner whose
// PASS/FAIL line follows them).

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, posix, relative, resolve, sep } from 'node:path';

export const TOOLS = ['vitest', 'pgtap', 'playwright', 'race'];
export const STATUSES = ['passed', 'failed', 'skipped', 'flaky', 'stale'];

/** Criterion IDs a title names, including grouped forms such as [P2-S09-AC-219, AC-242, 243]. */
export const markersIn = (text) => {
  const ids = new Set();
  const pad = (n) => `P2-S09-AC-${String(Number(n)).padStart(3, '0')}`;
  for (const [, id] of text.matchAll(/P2-S09-AC-(\d{3,4})(?!\d)/gu)) {
    ids.add(pad(id));
  }
  for (const [group] of text.matchAll(/\[P2-S09-AC-[^\]\n]{0,300}\]/gu)) {
    for (const [, id] of group.matchAll(/(?:AC-?|,\s*)(\d{3,4})(?!\d)/gu)) {
      ids.add(pad(id));
    }
  }
  return [...ids].sort();
};

export const sha256OfFile = (root, file) => {
  const path = resolve(root, file);
  return existsSync(path)
    ? createHash('sha256').update(readFileSync(path)).digest('hex')
    : null;
};

/** Repository-relative POSIX path; absolute paths inside the root are stripped. */
export const relativise = (root, path) => {
  let value = path.replace(/^\.\//u, '');
  const absoluteRoot = resolve(root);
  if (
    value.startsWith(absoluteRoot + sep) ||
    value.startsWith(absoluteRoot + '/')
  ) {
    value = relative(absoluteRoot, value);
  }
  return value.split(sep).join('/');
};

const row = (tool, granularity, file, title, status) => ({
  tool,
  granularity,
  file,
  title,
  status,
});

/** vitest --reporter=json output: one result per executed test. */
export const parseVitestJson = (json, root) => {
  const results = [];
  for (const suite of json.testResults ?? []) {
    const file = relativise(root, suite.name ?? '');
    for (const test of suite.assertionResults ?? []) {
      const title = test.fullName ?? test.title ?? '';
      const raw = test.status;
      const status =
        raw === 'passed' ? 'passed' : raw === 'failed' ? 'failed' : 'skipped';
      results.push(row('vitest', 'test', file, title, status));
    }
  }
  return results;
};

const playwrightStatus = (test) => {
  if (test.status === 'expected') return 'passed';
  if (test.status === 'flaky') return 'flaky';
  if (test.status === 'skipped') return 'skipped';
  return 'failed';
};

/** Playwright JSON report; spec.file is relative to the config testDir. */
export const parsePlaywrightJson = (json, testDir = 'tests/e2e') => {
  const results = [];
  const visit = (suite, titles) => {
    for (const spec of suite.specs ?? []) {
      const file = posix.join(testDir, spec.file ?? suite.file ?? '');
      const full = [...titles, spec.title].filter(Boolean).join(' > ');
      for (const test of spec.tests ?? []) {
        results.push(
          row('playwright', 'test', file, full, playwrightStatus(test)),
        );
      }
    }
    for (const child of suite.suites ?? []) {
      const own =
        child.title && child.title !== child.file ? [child.title] : [];
      visit(child, [...titles, ...own]);
    }
  };
  for (const suite of json.suites ?? []) {
    const own = suite.title && suite.title !== suite.file ? [suite.title] : [];
    visit(suite, own);
  }
  return results;
};

const SQL_QUOTE = /''/gu;
const compact = (text) =>
  text.replace(SQL_QUOTE, "'").replace(/\s+/gu, ' ').trim();

/** Files an entrypoint pulls in through psql \ir or \i, transitively. */
export const pgtapClosure = (root, entrypoint) => {
  const files = [];
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file) || !existsSync(resolve(root, file))) return;
    seen.add(file);
    files.push(file);
    const source = readFileSync(resolve(root, file), 'utf8');
    for (const [, target] of source.matchAll(/^\\ir?\s+(\S+)/gmu)) {
      visit(posix.normalize(posix.join(dirname(file), target ?? '')));
    }
  };
  visit(entrypoint);
  return files;
};

const FILE_HEADER = /^(?:psql:)?(\S+\.sql) \.\.+ ?(.*)$/u;
const TAP_LINE = /^(not ok|ok) (\d+)(?: - (.*?))?(?: # (SKIP|TODO)\b.*)?$/u;

/**
 * pg_prove output. Verbose output carries one `ok N - description` per assertion
 * and gives assertion-level receipts. Non-verbose output (what `supabase test db`
 * prints) only has a `<file> ..... ok` verdict per entrypoint; its receipts are
 * file-level: every marker description in the entrypoint's source closure takes
 * the file verdict.
 */
export const parsePgtapTap = (text, root) => {
  const results = [];
  let current = null;
  let sawAssertions = false;
  const finishFile = () => {
    if (current === null) return;
    if (current.assertions.length === 0 && current.verdict !== null) {
      for (const file of pgtapClosure(root, current.file)) {
        const source = readFileSync(resolve(root, file), 'utf8');
        for (const [, description] of source.matchAll(
          /'((?:[^']|'')*\[P2-S09-AC-[^\]\n]{0,300}\](?:[^']|'')*)'/gu,
        )) {
          const title = compact(description ?? '');
          results.push(
            row(
              'pgtap',
              'file',
              file,
              title,
              current.verdict === 'ok' ? 'passed' : 'failed',
            ),
          );
        }
      }
    }
    for (const assertion of current.assertions) {
      const owners = pgtapOwners(root, current.file, assertion.title);
      for (const owner of owners) {
        results.push(
          row('pgtap', 'assertion', owner, assertion.title, assertion.status),
        );
      }
    }
    current = null;
  };
  for (const line of text.split(/\r?\n/u)) {
    const header = FILE_HEADER.exec(line);
    if (header !== null) {
      finishFile();
      const rest = (header[2] ?? '').trim();
      current = {
        file: relativise(root, header[1] ?? ''),
        assertions: [],
        verdict:
          rest === 'ok'
            ? 'ok'
            : rest === '' || /^\d+\/\d+/u.test(rest)
              ? null
              : rest,
      };
      continue;
    }
    if (current === null) continue;
    const tap = TAP_LINE.exec(line);
    if (tap !== null) {
      sawAssertions = true;
      const status =
        tap[4] !== undefined
          ? 'skipped'
          : tap[1] === 'ok'
            ? 'passed'
            : 'failed';
      current.assertions.push({ title: compact(tap[3] ?? ''), status });
      continue;
    }
    if (line.trim() === 'ok') current.verdict = 'ok';
    else if (/^Result: /u.test(line) || /^(Failed|Dubious)/u.test(line)) {
      current.verdict = current.verdict ?? line.trim();
    }
  }
  finishFile();
  return { results, verbose: sawAssertions };
};

/** The closure file(s) whose source holds the assertion text; the entrypoint when none does. */
const pgtapOwners = (root, entrypoint, title) => {
  const closure = pgtapClosure(root, entrypoint);
  const owners = closure.filter((file) =>
    compact(readFileSync(resolve(root, file), 'utf8')).includes(title),
  );
  if (owners.length > 0) return owners;
  const ids = markersIn(title);
  const byMarker = closure.filter((file) => {
    const source = readFileSync(resolve(root, file), 'utf8');
    return ids.some((id) => source.includes(id));
  });
  return byMarker.length > 0 ? byMarker : [entrypoint];
};

/**
 * db:races output. JSON lines when a line starts with `{`; otherwise plain
 * runner output where `ok - ...` assertion lines precede that runner's
 * `PASS|FAIL <runner> exit=...` verdict line.
 */
export const parseRaceOutput = (text) => {
  const results = [];
  let pending = [];
  for (const line of text.split(/\r?\n/u)) {
    if (line.startsWith('{')) {
      const record = JSON.parse(line);
      const status = record.status === 'passed' ? 'passed' : 'failed';
      const title = String(record.title ?? '');
      results.push({
        ...row(
          'race',
          'assertion',
          String(record.file),
          `${record.marker} ${title}`.trim(),
          status,
        ),
      });
      continue;
    }
    const verdict = /^(PASS|FAIL) (\S+\.mjs) exit=/u.exec(line);
    if (verdict !== null) {
      for (const title of pending) {
        results.push(
          row(
            'race',
            'assertion',
            verdict[2] ?? '',
            title,
            verdict[1] === 'PASS' ? 'passed' : 'failed',
          ),
        );
      }
      pending = [];
      continue;
    }
    const ok = /^(ok|not ok) - (.*)$/u.exec(line);
    if (ok !== null) pending.push(ok[2] ?? '');
  }
  return results;
};

/**
 * A result is stale when its test file was modified after the report that
 * produced it was written: the report describes an older version of the file,
 * so the hash taken now would vouch for a run that never saw this content.
 * The file's modification time may not exceed the report's (1 s of clock slack).
 */
export const markStale = (results, root, reportMtimeMs) =>
  results.map((result) => {
    const path = resolve(root, result.file);
    if (!existsSync(path) || result.status === 'stale') return result;
    return statSync(path).mtimeMs > reportMtimeMs + 1000
      ? { ...result, status: 'stale' }
      : result;
  });

/** One receipt per (marker x test) with the SHA-256 of the test file. */
export const buildReceipts = (results, root) => {
  const receipts = [];
  for (const result of results) {
    for (const criterion of markersIn(result.title)) {
      receipts.push({
        criterion,
        tool: result.tool,
        granularity: result.granularity,
        file: result.file,
        title: result.title,
        status: result.status,
        fileSha256: sha256OfFile(root, result.file),
      });
    }
  }
  const key = (r) =>
    [r.criterion, r.tool, r.file, r.title, r.status].join('\u0000');
  const unique = new Map(receipts.map((r) => [key(r), r]));
  return [...unique.values()].sort((a, b) =>
    key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0,
  );
};

export const serialiseReceipts = (receipts) =>
  receipts.map((r) => JSON.stringify(r)).join('\n') +
  (receipts.length > 0 ? '\n' : '');

export const parseReceipts = (text) =>
  text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line));

/**
 * The receipts guard. For every verified entry and every test file it cites
 * (race runners listed as supplementary included) there must be at least one
 * passing receipt for that criterion and file, and every receipt for that pair
 * must carry the SHA-256 of the file as it is now and must not be a failure.
 * Returns problem strings; an empty list means the evidence is current.
 */
export const evaluateReceipts = ({ entries, receipts, shaOf }) => {
  const problems = [];
  const byPair = new Map();
  for (const receipt of receipts) {
    const key = `${receipt.criterion}\u0000${receipt.file}`;
    const list = byPair.get(key) ?? [];
    list.push(receipt);
    byPair.set(key, list);
  }
  for (const entry of entries) {
    const cited = [
      ...entry.testFiles,
      ...(entry.supplementary ?? []).filter((file) => file.endsWith('.mjs')),
    ];
    for (const file of cited) {
      const rows = byPair.get(`${entry.criterion}\u0000${file}`) ?? [];
      const current = shaOf(file);
      if (rows.length === 0) {
        problems.push(`${entry.criterion} ${file}: no receipt`);
        continue;
      }
      const stale = rows.filter(
        (row) => row.fileSha256 !== current || row.status === 'stale',
      );
      if (stale.length > 0) {
        problems.push(
          `${entry.criterion} ${file}: ${stale.length} stale receipt(s), the file changed after the run`,
        );
        continue;
      }
      const failing = rows.filter(
        (row) => row.status === 'failed' || row.status === 'flaky',
      );
      if (failing.length > 0) {
        problems.push(
          `${entry.criterion} ${file}: ${failing.length} ${failing[0].status} receipt(s)`,
        );
        continue;
      }
      if (!rows.some((row) => row.status === 'passed')) {
        problems.push(`${entry.criterion} ${file}: no passing receipt`);
      }
    }
  }
  return problems;
};
