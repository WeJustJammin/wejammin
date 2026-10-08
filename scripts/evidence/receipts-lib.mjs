// Phase 2 evidence receipts: pure parsers and the receipt builder.
//
// Slice 09 mode (the default, and the only mode `evaluateReceipts` reads): a
// receipt is one row per (criterion marker x executed test):
//   { criterion, tool, granularity, file, title, status, fileSha256 }
// Every field is derived from machine output (a vitest JSON report, pgTAP TAP
// output, Playwright JSON reports, db:races output) plus the SHA-256 of the test
// file as it is on disk. Nothing is typed by hand, and a receipt goes stale the
// moment its test file changes.
//
// The marker grammar is generic: P2-S(\d\d)-AC-(\d{3,4}). `markersIn`,
// `buildReceipts` and `parsePgtapTap` take the slice whose markers they read
// (default `09`, so Slice 09 behaviour and output are unchanged). Slice 10 and
// later do NOT use markers as evidence: see identity-receipts-lib.mjs, where a
// ledger citation names one exact test and a receipt is keyed by that test's
// identity, never by a marker in its title.
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

/** Phase 2 has slices 01..17. */
const FIRST_SLICE = 1;
const LAST_SLICE = 17;

/** A slice as two digits ("9" and 9 become "09"); anything outside 01..17 throws. */
export const normaliseSlice = (slice) => {
  const text = String(slice);
  if (!/^\d{1,2}$/u.test(text)) {
    throw new RangeError(`slice must be one or two digits, got "${text}"`);
  }
  const number = Number(text);
  if (number < FIRST_SLICE || number > LAST_SLICE) {
    throw new RangeError(
      `slice must be within 01..${String(LAST_SLICE)}, got "${text}"`,
    );
  }
  return String(number).padStart(2, '0');
};

/** The generated receipts file of a slice, relative to the repository root. */
export const receiptsPathFor = (slice) =>
  `tests/contracts/phase-02-slice-${normaliseSlice(slice)}-receipts.generated.jsonl`;

const MARKER = /P2-S(\d\d)-AC-(\d{3,4})(?!\d)/gu;
const GROUPED_MARKER = /\[P2-S(\d\d)-AC-[^\]\n]{0,300}\]/gu;

/**
 * Criterion IDs of ONE slice (default 09) a title names, including grouped forms
 * such as [P2-S09-AC-219, AC-242, 243]. A marker of another slice is ignored.
 */
export const markersIn = (text, slice = '09') => {
  const digits = normaliseSlice(slice);
  const ids = new Set();
  const pad = (n) => `P2-S${digits}-AC-${String(Number(n)).padStart(3, '0')}`;
  for (const [, owner, id] of text.matchAll(MARKER)) {
    if (owner === digits) ids.add(pad(id));
  }
  for (const [group, owner] of text.matchAll(GROUPED_MARKER)) {
    if (owner !== digits) continue;
    for (const [, id] of group.matchAll(/(?:AC-?|,\s*)(\d{3,4})(?!\d)/gu)) {
      ids.add(pad(id));
    }
  }
  return [...ids].sort();
};

/** Every criterion ID of every slice a title names, once and sorted. */
export const allMarkersIn = (text) => {
  const ids = new Set();
  for (const [, owner] of text.matchAll(MARKER)) {
    for (const id of markersIn(text, owner)) ids.add(id);
  }
  for (const [, owner] of text.matchAll(GROUPED_MARKER)) {
    for (const id of markersIn(text, owner)) ids.add(id);
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

/**
 * `invocation` is the stable identity of the run that produced the result (a
 * vitest report or gate id; a Playwright config file and project). It is kept
 * on the in-memory result only, so merging can tell two runs of one test apart,
 * and is never written into a receipt.
 */
const row = (
  tool,
  granularity,
  file,
  title,
  status,
  invocation = '',
  extra = {},
) => ({
  tool,
  granularity,
  file,
  title,
  status,
  ...(invocation === '' ? {} : { invocation }),
  ...extra,
});

/**
 * vitest --reporter=json output: one result per executed test. `invocation` is
 * the report or gate id (the collector passes the report file name).
 */
export const parseVitestJson = (json, root, invocation = '') => {
  const results = [];
  for (const suite of json.testResults ?? []) {
    const file = relativise(root, suite.name ?? '');
    for (const test of suite.assertionResults ?? []) {
      const title = test.fullName ?? test.title ?? '';
      const raw = test.status;
      const status =
        raw === 'passed' ? 'passed' : raw === 'failed' ? 'failed' : 'skipped';
      results.push(row('vitest', 'test', file, title, status, invocation));
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

/**
 * Playwright JSON report; spec.file is relative to the config testDir. A
 * result's invocation is the config file name plus the Playwright project that
 * ran it (`config` names the report when the JSON carries no config file).
 */
export const parsePlaywrightJson = (
  json,
  testDir = 'tests/e2e',
  config = '',
) => {
  const results = [];
  const configName =
    typeof json.config?.configFile === 'string' && json.config.configFile !== ''
      ? posix.basename(json.config.configFile.split(sep).join('/'))
      : config;
  const invocationOf = (test) => {
    const project =
      typeof test.projectName === 'string' ? test.projectName : '';
    return configName === '' && project === ''
      ? ''
      : `${configName}#${project}`;
  };
  const visit = (suite, titles) => {
    for (const spec of suite.specs ?? []) {
      const file = posix.join(testDir, spec.file ?? suite.file ?? '');
      const full = [...titles, spec.title].filter(Boolean).join(' > ');
      for (const test of spec.tests ?? []) {
        results.push(
          row(
            'playwright',
            'test',
            file,
            full,
            playwrightStatus(test),
            invocationOf(test),
            {
              project:
                typeof test.projectName === 'string' ? test.projectName : '',
            },
          ),
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
const closureMarkerDescriptions = (root, entrypoint, slice) => {
  const found = [];
  const description = new RegExp(
    `'((?:[^']|'')*\\[P2-S${slice}-AC-[^\\]\\n]{0,300}\\](?:[^']|'')*)'`,
    'gu',
  );
  for (const file of pgtapClosure(root, entrypoint)) {
    const source = readFileSync(resolve(root, file), 'utf8');
    for (const [, text] of source.matchAll(description)) {
      found.push({ file, title: compact(text ?? '') });
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
 *
 * `options.identity` (Slice 10 and later) keys results by test identity instead
 * of markers: an assertion belongs to the closure file whose source holds its
 * description as a whole SQL string literal (the entrypoint when none does, and
 * for an undescribed assertion); each result carries its `entrypoint`; and a
 * SKIP or TODO with no description yields a skipped file-level row for every
 * file of the closure, because the file it came from cannot be told.
 */
export const parsePgtapTap = (text, root, options = {}) => {
  const slice = normaliseSlice(options.slice ?? '09');
  const byIdentity = options.identity === true;
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
        (byIdentity
          ? assertion.title === ''
          : markersIn(assertion.title, slice).length === 0)
      ) {
        unattributed = true;
      }
      if (byIdentity) {
        const owners = literalOwners(root, current.file, assertion.title);
        for (const owner of owners) {
          results.push(
            row('pgtap', 'assertion', owner, assertion.title, status, '', {
              entrypoint: current.file,
              ownerCount: owners.length,
            }),
          );
        }
        continue;
      }
      for (const owner of pgtapOwners(
        root,
        current.file,
        assertion.title,
        slice,
      )) {
        results.push(row('pgtap', 'assertion', owner, assertion.title, status));
      }
    }
    if (unattributed && byIdentity) {
      for (const file of pgtapClosure(root, current.file)) {
        results.push(
          row('pgtap', 'file', file, UNATTRIBUTED_PGTAP_TITLE, 'skipped', '', {
            entrypoint: current.file,
          }),
        );
      }
    } else if (unattributed) {
      for (const { file, title } of closureMarkerDescriptions(
        root,
        current.file,
        slice,
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

/** Title of the file-level row an undescribed SKIP or TODO assertion produces in identity mode. */
export const UNATTRIBUTED_PGTAP_TITLE =
  'SKIP or TODO assertion without a description';

/**
 * Identity mode owner: the closure file(s) whose source holds `title` as a whole
 * SQL string literal (whitespace-collapsed, quotes doubled); the entrypoint when
 * no file does (a computed description) and for an undescribed assertion.
 */
const literalOwners = (root, entrypoint, title) => {
  if (title === '') return [entrypoint];
  const needle = `'${title.replaceAll("'", "''")}'`;
  const owners = pgtapClosure(root, entrypoint).filter((file) =>
    readFileSync(resolve(root, file), 'utf8')
      .replace(/\s+/gu, ' ')
      .includes(needle),
  );
  return owners.length > 0 ? owners : [entrypoint];
};

/** The closure file(s) whose source holds the assertion text; the entrypoint when none does. */
const pgtapOwners = (root, entrypoint, title, slice) => {
  const closure = pgtapClosure(root, entrypoint);
  const owners = closure.filter((file) =>
    compact(readFileSync(resolve(root, file), 'utf8')).includes(title),
  );
  if (owners.length > 0) return owners;
  const ids = markersIn(title, slice);
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
export const parseRaceOutput = (text, options = {}) => {
  const byIdentity = options.identity === true;
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
          byIdentity ? title : `${record.marker} ${title}`.trim(),
          status,
        ),
      });
      continue;
    }
    const verdict = /^(PASS|FAIL) (\S+\.mjs) exit=/u.exec(line);
    if (verdict !== null) {
      for (const { title, ok } of pending) {
        results.push(
          row(
            'race',
            'assertion',
            verdict[2] ?? '',
            title,
            verdict[1] === 'PASS' && (ok || !byIdentity) ? 'passed' : 'failed',
          ),
        );
      }
      pending = [];
      continue;
    }
    const assertion = /^(ok|not ok) - (.*)$/u.exec(line);
    if (assertion !== null) {
      pending.push({ title: assertion[2] ?? '', ok: assertion[1] === 'ok' });
    }
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
    if (result.status === 'stale') return result;
    // A pgTAP result that names its entrypoint depends on the whole closure.
    const files =
      typeof result.entrypoint === 'string'
        ? [result.file, ...pgtapClosure(root, result.entrypoint)]
        : [result.file];
    return files.some((file) => {
      const path = resolve(root, file);
      return existsSync(path) && statSync(path).mtimeMs > reportMtimeMs + 1000;
    })
      ? { ...result, status: 'stale' }
      : result;
  });

const EXECUTED = new Set(['passed', 'failed', 'flaky']);

/**
 * The only cross-invocation skip replacements the merge allows. Each entry
 * pairs an ordinary run with the dedicated gate that executes what the ordinary
 * run skips:
 *
 * - `executedByGate`: a test whose title `executedTitle` identifies exactly
 *   (the complete full test name, not a suffix or substring of one) is skipped in
 *   every ordinary run (it is gated on its own npm lifecycle) and executed in
 *   `gate`'s report, so the ordinary skip is dropped against the gate's result;
 * - `filteredByGate`: `gate` runs `file` with a `-t` filter, so every other test
 *   in that file is skipped there; those filter skips are dropped against the
 *   ordinary run that executed them. The designated test (`executedTitle`) is
 *   the one the filter selects, so a skip of it inside the gate's own report is
 *   never a filter skip: it is retained.
 *
 * `gate` is the report file name (the collector's vitest invocation id). Any
 * other pairing, any other file or tool, and any Playwright project or config
 * stays a skip, which the guard rejects.
 */
export const SKIP_REPLACEMENTS = Object.freeze([
  Object.freeze({
    tool: 'vitest',
    gate: 'vitest-evidence-s09.json',
    file: 'tests/contracts/phase-02-slice-09-evidence-map.test.ts',
    executedTitle: (title) =>
      title ===
      '[P2-S09-AC-269] executable S09 evidence map [P2-S09-AC-269] executes every declared nonbrowser command',
  }),
]);

const replaceableSkip = (skipped, executed, replacements) =>
  replacements.some(
    (entry) =>
      entry.tool === skipped.tool &&
      entry.file === skipped.file &&
      ((skipped.invocation !== undefined &&
        skipped.invocation !== entry.gate &&
        executed.invocation === entry.gate &&
        entry.executedTitle(skipped.title)) ||
        (skipped.invocation === entry.gate &&
          executed.invocation !== undefined &&
          executed.invocation !== entry.gate &&
          !entry.executedTitle(skipped.title))),
  );

/**
 * Combine the results of several reports (one per invocation). A skipped result
 * is dropped only when a DIFFERENT report executed the same test (tool, file and
 * title) AND the skipped and executing invocations form an allowlisted
 * ordinary-run / dedicated-gate pair (`SKIP_REPLACEMENTS`). A result with no
 * invocation identity, a different Playwright project or config, a gate other
 * than the designated one, or a second run of a test inside one report never
 * hides a skip. pgTAP and race results are never merged: a SKIP there is never
 * evidence, whatever else passed.
 */
export const mergeReports = (reports, replacements = SKIP_REPLACEMENTS) => {
  const key = (result) =>
    [result.tool, result.file, result.title].join('\u0000');
  const executedIn = new Map();
  reports.forEach((report, index) => {
    for (const result of report) {
      if (!EXECUTED.has(result.status)) continue;
      const list = executedIn.get(key(result)) ?? [];
      list.push({ index, result });
      executedIn.set(key(result), list);
    }
  });
  return reports.flatMap((report, index) =>
    report.filter((result) => {
      if (result.status !== 'skipped') return true;
      return !(executedIn.get(key(result)) ?? []).some(
        (other) =>
          other.index !== index &&
          replaceableSkip(result, other.result, replacements),
      );
    }),
  );
};

/**
 * One receipt per (marker of `slice` x test) with the SHA-256 of the test file.
 * `slice` defaults to 09: the Slice 09 output is byte-identical to before.
 */
export const buildReceipts = (results, root, slice = '09') => {
  const receipts = [];
  for (const result of results) {
    for (const criterion of markersIn(result.title, slice)) {
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
