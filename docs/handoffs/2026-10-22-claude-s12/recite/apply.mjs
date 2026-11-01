#!/usr/bin/env node
// Apply the refuted re-citation proposals of lanes a-d to the Slice 12 evidence ledger.
//
//   node docs/handoffs/2026-10-22-claude-s12/recite/apply.mjs [--dry] [--out-dir DIR] [--report FILE]
//
// Inputs (all read, none edited): the baseline ledgers (git object BASELINE_COMMIT), recite/{a,b,c,d}-proposals.json
// and -refutation.json, the newest full vitest JSON and the full verbose pgTAP TAP (paths below), the tracker.
// Output: the five ledger fragments tests/contracts/phase-02-slice-12-evidence-ledger-*.ts (then prettier), and the
// pgTAP description renames of apply-data.mjs RENAMES. A rerun on the same inputs reproduces the same bytes.
//
// Rules (brief recite-apply.md, DEC-226): KEEP adds; FIX adds the refutation's fix; DROP omits; missedTests are added;
// a REJECTed split is replaced by the refutation's corrected split or the clause stays whole and uncited; status and
// limitation are computed from the final citations; every citation is identity-checked against the real run.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  citation,
  keyOf,
  label,
  partsFromAnchors,
  tilingProblems,
} from './apply-lib.mjs';
import {
  applyEdits,
  classify,
  makePostTree,
  postRenameRows,
  cleanup,
  indexReceipts,
  loadIdentity,
  pgtapOwnersOf,
  receiptsFor,
} from './apply-identity.mjs';
import {
  newUnit as newUnitLike,
  planA,
  planB,
  planC,
  planD,
} from './apply-plan.mjs';
import { composeLimitation } from './apply-limit.mjs';
import { simulateGuard } from './apply-simulate.mjs';
import { pgtapClosure } from '../../../../scripts/evidence/receipts-lib.mjs';
import { FIX_OVERRIDES, POST_RULES, RENAMES } from './apply-data.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../../..');
const BASELINE_COMMIT = 'fc62deef';
const RUN = '.lane-logs/canonical/s09-evidence-20261024T020357Z';
const VITEST_JSON = resolve(ROOT, RUN, 'pass2/vitest-all.json');
const PGTAP_TAP = resolve(ROOT, RUN, 'db-test.tap');
const FRAGMENTS = [
  ['001-071', 'S12_EVIDENCE_LEDGER_001_071', 1, 71],
  ['072-142', 'S12_EVIDENCE_LEDGER_072_142', 72, 142],
  ['143-213', 'S12_EVIDENCE_LEDGER_143_213', 143, 213],
  ['214-285', 'S12_EVIDENCE_LEDGER_214_285', 214, 285],
  ['286-296', 'S12_EVIDENCE_LEDGER_286_296', 286, 296],
];
const fragmentPath = (name) =>
  `tests/contracts/phase-02-slice-12-evidence-ledger-${name}.ts`;
const LANES = { a: planA, b: planB, c: planC, d: planD };

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const DRY = flag('--dry');
const OUT_DIR = resolve(ROOT, option('--out-dir', '.'));
const REPORT_JSON = option('--report', null);
const CACHE = option('--cache', null);
const BACKUP_DIR = option('--backup-dir', null);
const RENAME_ROWS = RENAMES.flatMap((rename) => rename.rows);

const readJson = (name) =>
  JSON.parse(readFileSync(resolve(HERE, name), 'utf8'));

/** Baseline ledger entries from the immutable git object (so a rerun starts from the same ledger). */
const loadBaseline = async () => {
  const entries = [];
  const dir = resolve(
    process.env.TMPDIR ?? '/tmp',
    `recite-apply-baseline-${process.pid}`,
  );
  mkdirSync(dir, { recursive: true });
  for (const [name, exportName] of FRAGMENTS) {
    const path = fragmentPath(name);
    const text = execFileSync('git', ['show', `${BASELINE_COMMIT}:${path}`], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 1 << 28,
    });
    const file = resolve(dir, `baseline-${name}.ts`);
    writeFileSync(file, text);
    const module = await import(pathToFileURL(file).href);
    entries.push(...module[exportName]);
  }
  rmSync(dir, { recursive: true, force: true });
  return entries;
};

const main = async () => {
  const problems = []; // anomalies the plan builders / resolution found (printed, never silent)
  const log = []; // per-citation drop/fix decisions for the report
  const baseline = await loadBaseline();
  const baseById = new Map(baseline.map((e) => [e.criterion, e]));
  const lane = {};
  for (const x of ['a', 'b', 'c', 'd']) {
    lane[x] = {
      proposals: readJson(`${x}-proposals.json`),
      refutations: readJson(`${x}-refutation.json`),
    };
  }

  /* ---- plan -------------------------------------------------------------------------------- */
  const plans = new Map();
  for (const x of ['a', 'b', 'c', 'd']) {
    for (const prop of lane[x].proposals) {
      const ref = lane[x].refutations.find(
        (r) => r.criterion === prop.criterion,
      );
      if (ref === undefined) {
        problems.push(`${prop.criterion}: no refutation entry`);
        continue;
      }
      const base = baseById.get(prop.criterion);
      const plan = LANES[x](base, prop, ref, problems);
      plans.set(prop.criterion, { lane: x, prop, ref, base, ...plan });
    }
  }
  for (const entry of baseline)
    if (!plans.has(entry.criterion))
      problems.push(`${entry.criterion}: no lane proposal`);

  /* ---- post rules (DEC-226 and review-a splits) on clauses the reviewers left cited ---------------------------------------------- */
  for (const rule of POST_RULES) {
    const plan = plans.get(rule.criterion);
    const at = plan.units.findIndex((u) =>
      u.text.startsWith(rule.clauseStarts),
    );
    if (at === -1) {
      problems.push(
        `${rule.criterion}: DEC-226 rule found no clause starting ${rule.clauseStarts}`,
      );
      continue;
    }
    const unit = plan.units[at];
    const everything = [
      ...unit.existing,
      ...unit.adds.filter((a) => a.verdict !== 'DROP').map((a) => a.cit),
      ...unit.missed.map((m) => m.cit),
    ];
    if (rule.uncite !== undefined) {
      unit.withheld.push(...everything);
      unit.existing = [];
      unit.adds = [];
      unit.missed = [];
      unit.gaps.push(rule.uncite);
      unit.notes.push(`DEC-226: ${everything.length} citation(s) withheld`);
    } else {
      const texts = partsFromAnchors(unit.text, rule.split.anchors);
      const parts = texts.map((text) => newUnitLike(text));
      rule.split.citeParts.forEach((p) => {
        parts[p].existing = unit.existing;
        parts[p].adds = unit.adds;
        parts[p].missed = unit.missed;
      });
      Object.entries(rule.split.gaps).forEach(([p, text]) =>
        parts[Number(p)].gaps.push(text),
      );
      plan.units.splice(at, 1, ...parts);
    }
  }

  /* ---- candidate citations per unit (existing + KEEP + FIX + missed, DROP omitted) -------------- */
  const moves = []; // { criterion, toClause, cit } re-homed citations
  const candidatesOf = (criterion, unit) => {
    const out = [];
    const push = (cit, how) => out.push({ cit, how });
    for (const cit of unit.existing) push(cit, 'existing');
    for (const add of unit.adds) {
      if (add.verdict === 'KEEP')
        push(add.cit, add.tag?.startsWith('x') ? 'existing' : 'add');
      else if (add.verdict === 'DROP')
        log.push({ criterion, kind: 'DROP', cit: add.cit, reason: add.reason });
      else {
        const override = FIX_OVERRIDES.find(
          (f) =>
            f.criterion === criterion &&
            add.cit.title.startsWith(f.titlePrefix),
        );
        let fixed;
        if (override !== undefined) {
          fixed =
            override.cits === 'ORIGINAL'
              ? [add.cit]
              : override.cits.map(citation);
          if (override.toClause !== undefined) {
            fixed.forEach((cit) =>
              moves.push({ criterion, toClause: override.toClause, cit }),
            );
            log.push({
              criterion,
              kind: 'FIX-moved',
              cit: add.cit,
              to: fixed,
              reason: add.reason,
            });
            continue;
          }
        } else fixed = expandFix(add, criterion, problems);
        if (fixed === null) {
          log.push({
            criterion,
            kind: 'FIX-dropped',
            cit: add.cit,
            reason: add.reason,
          });
        } else {
          log.push({
            criterion,
            kind: 'FIX',
            cit: add.cit,
            to: fixed,
            reason: add.reason,
          });
          for (const f of fixed) push(f, 'fix');
        }
      }
    }
    for (const m of unit.missed) push(m.cit, 'missed');
    return out;
  };

  /* ---- identity ------------------------------------------------------------------------------- */
  const identity = loadIdentity({
    root: ROOT,
    vitestJson: VITEST_JSON,
    tap: PGTAP_TAP,
    renames: RENAMES,
    cache: CACHE,
  });
  const owners = pgtapOwnersOf(identity);
  const collapse = (t) => t.replace(/\s+/gu, ' ').trim();

  // Normalise each candidate: apply renames of the working tree; correct a wrong pgTAP owner file.
  const renameKey = new Map(
    RENAME_ROWS.filter((r) => r.nth === 0).map((r) => [
      `${r.file}\u0000${r.from}`,
      r,
    ]),
  );
  const normalise = (cit, criterion) => {
    let out = cit;
    if (out.tool === 'pgtap') {
      const direct = identity.rows.some(
        (row) =>
          row.tool === 'pgtap' &&
          row.file === out.file &&
          collapse(row.title) === collapse(out.title),
      );
      if (!direct) {
        const where = [
          ...new Set(
            (owners.get(collapse(out.title)) ?? []).map((row) => row.file),
          ),
        ];
        if (where.length === 1) {
          log.push({
            criterion,
            kind: 'OWNER-CORRECTED',
            cit: out,
            to: [{ ...out, file: where[0] }],
          });
          out = { ...out, file: where[0] };
        }
      }
      const rename = renameKey.get(`${out.file}\u0000${out.title}`);
      if (rename !== undefined) {
        log.push({
          criterion,
          kind: 'RENAMED',
          cit: out,
          to: [{ ...out, title: rename.to }],
        });
        out = { ...out, title: rename.to };
      }
    }
    return out;
  };

  const unitsFinal = new Map();
  const allCandidates = [];
  for (const [criterion, plan] of plans) {
    const finals = plan.units.map((unit) => {
      const cands = candidatesOf(criterion, unit).map((c) => ({
        ...c,
        cit: normalise(c.cit, criterion),
      }));
      const seen = new Set();
      const unique = [];
      for (const c of cands) {
        const k = keyOf(c.cit);
        if (seen.has(k)) {
          log.push({ criterion, kind: 'DEDUPED', cit: c.cit });
          continue;
        }
        seen.add(k);
        unique.push(c);
      }
      unique.forEach((c) => allCandidates.push(c.cit));
      return { unit, candidates: unique };
    });
    for (const move of moves.filter((m) => m.criterion === criterion)) {
      const target = finals[move.toClause];
      const cit = normalise(move.cit, criterion);
      if (target === undefined)
        problems.push(
          `${criterion}: move target clause ${move.toClause} does not exist`,
        );
      else if (!target.candidates.some((c) => keyOf(c.cit) === keyOf(cit))) {
        target.candidates.push({ cit, how: 'moved' });
        allCandidates.push(cit);
      }
    }
    unitsFinal.set(criterion, finals);
  }

  const receipts = receiptsFor(
    identity,
    allCandidates.filter((c) => c.tool === 'vitest' || c.tool === 'pgtap'),
  );
  const receiptIndex = indexReceipts(receipts);
  const verdicts = new Map();
  const counts = {};
  const tally = (tool, state) => {
    counts[tool] ??= {};
    counts[tool][state] = (counts[tool][state] ?? 0) + 1;
  };
  const verify = (cit) => {
    const k = keyOf(cit);
    if (!verdicts.has(k))
      verdicts.set(k, classify(identity, cit, receiptIndex));
    return verdicts.get(k);
  };

  /* ---- dispositions of the lanes' proposed adds (for the report) ---------------------------------- */
  const stats = {};
  const withheldList = []; // citations the refutations or DEC-226 keep out of the ledger (not DROP verdicts)
  for (const [criterion, plan] of plans) {
    const s = (stats[plan.lane] ??= {
      adds: 0,
      KEEP: 0,
      DROP: 0,
      FIX: 0,
      existingJudged: 0,
      missedAdded: 0,
      missedSkipped: 0,
      withheld: 0,
    });
    const seenWithheld = new Set();
    for (const unit of plan.units) {
      for (const add of unit.adds) {
        if (add.tag?.startsWith('x')) {
          s.existingJudged += 1;
          if (add.verdict !== 'KEEP') s[add.verdict] += 1;
          continue;
        }
        s.adds += 1;
        s[add.verdict] += 1;
      }
      s.missedAdded += unit.missed.length;
      s.missedSkipped += unit.notes.filter((n) =>
        n.startsWith('missed test not added'),
      ).length;
      for (const cit of unit.withheld) {
        const k = `${criterion}|${keyOf(cit)}`;
        if (!seenWithheld.has(k)) {
          seenWithheld.add(k);
          s.withheld += 1;
          withheldList.push({
            criterion,
            tool: cit.tool,
            file: cit.file,
            title: cit.title,
            note: unit.notes.find((n) => !n.startsWith('missed')) ?? '',
          });
        }
      }
    }
  }

  /* ---- final entries -------------------------------------------------------------------------- */
  const entries = [];
  const dropped = []; // citations that failed verification
  const info = new Map(); // criterion -> { laneStatus, ... } for the report
  const uncited = []; // every uncited final clause with how its limitation reason was found
  for (const base of baseline) {
    const criterion = base.criterion;
    const plan = plans.get(criterion);
    const finals = unitsFinal.get(criterion);
    const clauses = finals.map(({ unit, candidates }) => {
      const citations = [];
      for (const c of candidates) {
        const v = verify(c.cit);
        if (v.state === 'verified' || v.state === 'listed')
          citations.push(citation(c.cit));
        else
          dropped.push({
            criterion,
            cit: c.cit,
            state: v.state,
            note: v.note,
            how: c.how,
          });
      }
      return { text: unit.text, citations, unit };
    });
    const problemsHere = tilingProblems(
      base.text,
      clauses.map((c) => c.text),
    );
    if (problemsHere.length > 0)
      problems.push(
        `${criterion}: final clauses do not tile: ${problemsHere.join('; ')}`,
      );
    const cited = clauses.filter((c) => c.citations.length > 0).length;
    const status =
      cited === clauses.length
        ? 'verified'
        : cited === 0
          ? 'unverified'
          : 'partial';
    const limitation =
      status === 'verified'
        ? ''
        : composeLimitation({
            criterion,
            status,
            clauses,
            plan,
            dropped: dropped.filter((d) => d.criterion === criterion),
            log: log.filter((l) => l.criterion === criterion),
          });
    entries.push({
      criterion,
      text: base.text,
      clauses: clauses.map(({ text, citations }) => ({ text, citations })),
      status,
      limitation,
    });
    info.set(criterion, { lane: plan.lane, clauses });
    clauses.forEach((c, k) => {
      if (c.citations.length === 0)
        uncited.push({
          criterion,
          clause: k,
          text: c.text,
          gaps: c.unit.gaps.length,
          dropped: c.unit.adds.filter((x) => x.verdict === 'DROP').length,
          withheld: c.unit.withheld.length,
          rejected: c.unit.rejected,
        });
    });
  }
  // Verification tallies over the DISTINCT final citations.
  const finalCitations = new Map();
  for (const entry of entries)
    for (const clause of entry.clauses)
      for (const cit of clause.citations) finalCitations.set(keyOf(cit), cit);
  for (const cit of finalCitations.values())
    tally(
      cit.tool + (/\.(?:apispec|dbspec)\.ts$/u.test(cit.file) ? '(spec)' : ''),
      verify(cit).state,
    );

  /* ---- pgTAP description renames in the working tree (tar backup first), then the guard simulation ---- */
  const renamed = [];
  if (!DRY) {
    const files = [
      ...new Set(RENAMES.flatMap((rename) => rename.edits.map((e) => e.file))),
    ].sort();
    const stamp = new Date().toISOString().replace(/[-:]/gu, '').slice(0, 15);
    const tar = resolve(
      BACKUP_DIR ?? process.env.TMPDIR ?? '/tmp',
      `orig-pgtap-renames-${stamp}Z.tar`,
    );
    mkdirSync(dirname(tar), { recursive: true });
    const pending = files.filter((file) =>
      RENAMES.some((r) =>
        r.edits.some(
          (e) =>
            e.file === file &&
            !readFileSync(resolve(ROOT, file), 'utf8').includes(e.replace),
        ),
      ),
    );
    if (pending.length > 0) {
      execFileSync('tar', ['-cf', tar, ...pending], { cwd: ROOT });
      console.log(`tar backup of ${pending.length} pgTAP files: ${tar}`);
    }
    for (const file of files) {
      const source = readFileSync(resolve(ROOT, file), 'utf8');
      const { text, applied, skipped } = applyEdits(
        source,
        RENAMES.flatMap((r) => r.edits).filter((e) => e.file === file),
      );
      if (applied.length > 0) writeFileSync(resolve(ROOT, file), text);
      renamed.push({
        file,
        applied: applied.length,
        alreadyApplied: skipped.length,
      });
    }
  }
  // The tree after the renames: the working tree itself, or (dry run) a copy of the pristine tree with the edits.
  const postRoot = DRY ? makePostTree(identity.pristine, RENAMES) : ROOT;
  const postRows = postRenameRows({
    identity,
    root: ROOT,
    postRoot,
    renameRows: RENAME_ROWS,
    closureOf: pgtapClosure,
  });
  const guard = simulateGuard({
    entries,
    rows: postRows,
    root: ROOT,
    hashRoot: postRoot,
  });
  // Duplicated descriptions left inside any entrypoint that runs a cited pgTAP file (the guard only sees cited files).
  const citedPgFiles = new Set(
    entries.flatMap((e) =>
      e.clauses.flatMap((c) =>
        c.citations.filter((x) => x.tool === 'pgtap').map((x) => x.file),
      ),
    ),
  );
  const citedEntrypoints = new Set(
    postRows
      .filter((r) => r.tool === 'pgtap' && citedPgFiles.has(r.file))
      .map((r) => r.entrypoint),
  );
  const dupCount = new Map();
  for (const r of postRows) {
    if (
      r.tool !== 'pgtap' ||
      r.granularity === 'file' ||
      !citedEntrypoints.has(r.entrypoint)
    )
      continue;
    const k = [r.entrypoint, r.title].join('\u0000');
    const v = dupCount.get(k) ?? {
      entrypoint: r.entrypoint,
      title: r.title,
      files: new Set(),
      n: 0,
    };
    v.files.add(r.file);
    v.n += 1;
    dupCount.set(k, v);
  }
  const remainingDuplicates = [...dupCount.values()]
    .map((v) => ({
      entrypoint: v.entrypoint,
      title: v.title,
      files: [...v.files],
      assertions: v.n / Math.max(1, v.files.size),
    }))
    .filter((v) => v.assertions > 1 || v.files.length > 1);
  const summary = {
    entries: entries.length,
    status: entries.reduce(
      (m, e) => ({ ...m, [e.status]: (m[e.status] ?? 0) + 1 }),
      {},
    ),
    distinctCitations: finalCitations.size,
    verification: counts,
    dropped: dropped.length,
    laneDispositions: stats,
    problems: problems.length,
    guardProblems: guard.problems.length,
    remainingDuplicateDescriptions: remainingDuplicates.length,
    guardCounts: guard.counts,
  };
  const written = DRY ? [] : await writeFragments(entries);
  console.log(JSON.stringify({ ...summary, renamed, written }, null, 1));
  if (REPORT_JSON !== null) {
    writeFileSync(
      resolve(ROOT, REPORT_JSON),
      JSON.stringify(
        {
          summary,
          problems,
          dropped,
          log,
          uncited,
          remainingDuplicates,
          withheldList,
          entries,
        },
        null,
        1,
      ),
    );
  }
  for (const p of problems) console.log('PROBLEM', p);
  for (const p of guard.problems) console.log('GUARD', p);
  for (const d of dropped)
    console.log(
      'DROPPED-BY-VERIFY',
      d.criterion,
      d.state,
      d.note,
      label(d.cit),
    );
  cleanup(identity);
  if (DRY) rmSync(postRoot, { recursive: true, force: true });
};

/** Emit the five ledger fragments (header comments from the baseline file), then prettier. */
const writeFragments = async (entries) => {
  const written = [];
  const byId = new Map(entries.map((e) => [e.criterion, e]));
  for (const [name, exportName, from, to] of FRAGMENTS) {
    const old = execFileSync(
      'git',
      ['show', `${BASELINE_COMMIT}:${fragmentPath(name)}`],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 },
    );
    const header = old.slice(0, old.indexOf(`export const ${exportName}`));
    const body = [];
    for (let n = from; n <= to; n += 1)
      body.push(byId.get(`P2-S12-AC-${String(n).padStart(3, '0')}`));
    const note =
      '// Re-cited 2026-10-24 from the refuted proposals by docs/handoffs/2026-10-22-claude-s12/recite/apply.mjs (a rerun reproduces it).\n';
    const text = `${header}${note}export const ${exportName}: readonly EvidenceLedgerEntry[] = ${JSON.stringify(body, null, 2)};\n`;
    writeFileSync(resolve(OUT_DIR, fragmentPath(name)), text);
    written.push(fragmentPath(name));
  }
  execFileSync(
    resolve(ROOT, 'node_modules/.bin/prettier'),
    ['--write', ...written],
    { cwd: OUT_DIR === ROOT ? ROOT : OUT_DIR, stdio: 'inherit' },
  );
  return written.map((path) => ({
    path,
    sha256: createHash('sha256')
      .update(readFileSync(resolve(OUT_DIR, path)))
      .digest('hex'),
    lines: readFileSync(resolve(OUT_DIR, path), 'utf8').split('\n').length - 1,
  }));
};

/** FIX handling: structured objects, `file :: title`, a replacement path; prose needs FIX_OVERRIDES. */
const expandFix = (add, criterion, problems) => {
  const fix = add.fix;
  if (fix === null || fix === undefined) return [add.cit];
  if (typeof fix === 'object' && !Array.isArray(fix)) {
    if (typeof fix.tool === 'string') return [citation({ ...add.cit, ...fix })];
    if (Array.isArray(fix.add))
      return fix.add.map((f) => citation({ ...add.cit, ...f }));
    if (typeof fix.replaceWith === 'object' && fix.replaceWith !== null)
      return [citation({ ...add.cit, ...fix.replaceWith })];
  }
  if (typeof fix === 'string') {
    const m = /^(\S+\.sql(?:inc)?)\s*::\s*(.+)$/su.exec(fix.trim());
    if (m !== null)
      return [citation({ ...add.cit, file: m[1], title: m[2].trim() })];
    if (/^supabase\/tests\/\S+\.sql(?:inc)?$/u.test(fix.trim()))
      return [citation({ ...add.cit, file: fix.trim() })];
    if (
      /Do not apply until root renames the two duplicated descriptions/u.test(
        fix,
      )
    )
      return [add.cit];
  }
  problems.push(
    `${criterion}: unresolved FIX for ${add.cit.title.slice(0, 70)}: ${JSON.stringify(fix).slice(0, 160)}`,
  );
  return null;
};

await main();
