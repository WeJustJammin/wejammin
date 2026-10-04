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
const PLAN_LINE = /^1\.\.(\d+)\b/u;
const TAP_LINE = /^(not ok|ok) (\d+)(?: - (.*?))?(?: # (SKIP|TODO)\b.*)?$/iu;

/** Marker-bearing descriptions in an entrypoint's source closure (for unattributable SKIP/TODO). */
const closureMarkerDescriptions = (root, entrypoint) => {
  const found = [];
  for (const file of pgtapClosure(root, entrypoint)) {
    const source = readFileSync(resolve(root, file), 'utf8');
    for (const [, description] of source.matchAll(
      /'((?:[^']|'')*\[P2-S09-AC-[^\]\n]{0,300}\](?:[^']|'')*)'/gu,
    )) {
      found.push({ file, title: compact(description ?? '') });
    }
  }
  return found;
};

/**
 * pg_prove -v output: one `ok N - description` per assertion. Receipts are
 * assertion-level only; a file verdict (what non-verbose `supabase test db`
 * prints) is not criterion evidence, so a file with a header and no assertion
 * lines produces no receipt and is listed in `unverified`.
 *
 * A file is COMPLETE only when its plan line (`1..N`) is present, N assertion
 * lines ran, and they are numbered 1..N. An incomplete file (died before
 * finish, fewer assertions than planned, gaps or repeats) fails every assertion
 * it did print: the assertions that never ran may be the ones a criterion
 * needs. SKIP and TODO assertions, whatever the harness verdict, are `skipped`:
 * never a passed receipt. A SKIP or TODO with no marker-bearing description
 * cannot be attributed to a criterion, so every marker description the file's
 * source holds gets a `skipped` file-level row, which the guard rejects.
 */
export const parsePgtapTap = (text, root) => {
  const results = [];
  const unverified = [];
  let current = null;
  let sawAssertions = false;
  const finishFile = () => {
    if (current === null) return;
    const { assertions } = current;
    if (assertions.length === 0) {
      unverified.push(current.file);
      current = null;
      return;
    }
    const complete =
      current.plan === assertions.length &&
      assertions.every((assertion, index) => assertion.number === index + 1);
    let unattributed = false;
    for (const assertion of assertions) {
      const status = complete
        ? assertion.status
        : assertion.status === 'passed'
          ? 'failed'
          : assertion.status;
      if (
        assertion.directive !== null &&
        markersIn(assertion.title).length === 0
      ) {
        unattributed = true;
      }
      for (const owner of pgtapOwners(root, current.file, assertion.title)) {
        results.push(row('pgtap', 'assertion', owner, assertion.title, status));
      }
    }
    if (unattributed) {
      for (const { file, title } of closureMarkerDescriptions(
        root,
        current.file,
      )) {
        results.push(row('pgtap', 'file', file, title, 'skipped'));
      }
    }
    current = null;
  };
  for (const line of text.split(/\r?\n/u)) {
    const header = FILE_HEADER.exec(line);
    if (header !== null) {
      finishFile();
      current = {
        file: relativise(root, header[1] ?? ''),
        assertions: [],
        plan: null,
      };
      continue;
    }
    if (current === null) continue;
    const plan = PLAN_LINE.exec(line);
    if (plan !== null) {
      current.plan = Number(plan[1]);
      continue;
    }
    const tap = TAP_LINE.exec(line);
    if (tap !== null) {
      sawAssertions = true;
      const directive = tap[4] === undefined ? null : tap[4].toUpperCase();
      const status =
        directive !== null ? 'skipped' : tap[1] === 'ok' ? 'passed' : 'failed';
      current.assertions.push({
        number: Number(tap[2]),
        title: compact(tap[3] ?? ''),
        status,
        directive,
      });
    }
  }
  finishFile();
  return { results, verbose: sawAssertions, unverified };
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

const EXECUTED = new Set(['passed', 'failed', 'flaky']);
const MERGEABLE_TOOLS = new Set(['vitest', 'playwright']);

/**
 * Combine the results of several reports (one per invocation). A test that one
 * invocation skipped but ANOTHER invocation executed (the dedicated gate a
 * test belongs to, or a `-t` filtered run's non-matching siblings) is counted
 * once, as its executed result. A skip is dropped only against an executed
 * result from a different report: two same-titled tests inside one report keep
 * their own statuses, and a test no report executed stays skipped (which the
 * guard rejects). pgTAP and race results are never merged: a SKIP there is
 * never evidence, whatever else passed.
 */
export const mergeReports = (reports) => {
  const key = (result) =>
    [result.tool, result.file, result.title].join('\u0000');
  const executedIn = new Map();
  reports.forEach((report, index) => {
    for (const result of report) {
      if (!EXECUTED.has(result.status)) continue;
      const set = executedIn.get(key(result)) ?? new Set();
      set.add(index);
      executedIn.set(key(result), set);
    }
  });
  return reports.flatMap((report, index) =>
    report.filter((result) => {
      if (result.status !== 'skipped' || !MERGEABLE_TOOLS.has(result.tool)) {
        return true;
      }
      const elsewhere = [...(executedIn.get(key(result)) ?? [])].some(
        (other) => other !== index,
      );
      return !elsewhere;
    }),
  );
};

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
      const coarse = rows.filter(
        (row) => row.tool === 'pgtap' && row.granularity !== 'assertion',
      );
      if (coarse.length > 0) {
        problems.push(
          `${entry.criterion} ${file}: ${coarse.length} file-level pgTAP receipt(s); a file verdict is not assertion-level evidence`,
        );
        continue;
      }
      const skipped = rows.filter((row) => row.status === 'skipped');
      if (skipped.length > 0) {
        problems.push(
          `${entry.criterion} ${file}: ${skipped.length} skipped ${skipped[0].tool === 'pgtap' ? 'pgTAP' : skipped[0].tool} receipt(s) (skipped, pending, todo or fixme is never evidence; every marker-bearing test in a cited file must execute and pass)`,
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
