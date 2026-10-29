#!/usr/bin/env node
// Apply the refuted round-2 re-citation (lanes recite2 a/b, refutations refute2 a/b) to the CURRENT Slice 12 ledger.
//
//   node --experimental-strip-types docs/handoffs/2026-10-22-claude-s12/recite2/apply2.mjs [--dry] [--report FILE]
//
// Order: AFTER recite/apply.mjs, recite/dec227-texts.mjs, dec230-ac055.mjs, dec231-ac061.mjs, dec232-ac105-ac275.mjs and
// dec232b-ac172.mjs (it reads the ledger those wrote); BEFORE recite2/dec235-ac056.mjs. Rerunning it on its own output
// adds nothing twice (citations are de-duplicated by identity) but the order above is the reproducible one.
//
// Rules (brief recite2-refutation.md, DEC-226, round-2 root rule): KEEP adds; DROP omits; FIX adds the root-resolved
// replacement (FIXES below); missedTests are added; a split the refutation passed (OK) replaces the clause with the
// lane's verbatim parts; a REJECTed split is replaced by the refutation's re-cut (RECUTS below, citations mapped to
// tiles by title) or the clause stays whole and uncited; an unreachable sub-branch is an uncited tile with its BOUNDARY
// text, never verified-with-caveat. Status is computed from the final citations; every uncited clause is named in the
// limitation with a reason (manual text, the lane's gap, or the clause's segment of the current limitation).
// AC-197 also carries its 22 wave-1 KEEP/FIX citations (recite/c-refutation.json), withheld in round 1 while the
// reject-audit part had no proof.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../../..');
const DRY = process.argv.includes('--dry');
const REPORT = (() => {
  const i = process.argv.indexOf('--report');
  return i < 0 ? null : process.argv[i + 1];
})();
const FRAGMENTS = ['001-071', '072-142', '143-213', '214-285', '286-296'].map(
  (range) => `tests/contracts/phase-02-slice-12-evidence-ledger-${range}.ts`,
);
const CLAUSE_SEPARATOR = /^(?:[\s;,.:—–-]|\band\b|\bor\b)*$/iu;
const json = (path) => JSON.parse(readFileSync(resolve(HERE, path), 'utf8'));
const LANES = ['a', 'b'].map((lane) => ({
  lane,
  proposals: json(`${lane}-proposals.json`),
  refutation: json(`${lane}-refutation.json`),
}));
const problems = [];
const log = [];

/* ---- root resolutions of the FIX verdicts --------------------------------------------------------------------- */
const MALFORMED = 'apps/worker/src/cms-composition/pattern-instance-routes.malformed-ids.test.ts';
const FIRE = 'supabase/tests/phase_02_slice_12_gaps_db1_schedule_fire.sql';
const FIXES = {
  // refute2-a FIX (IDENTITY): it.each titles retitled by root so each case has one full name.
  'P2-S12-AC-026|3|[P2-S12-AC-026] CMS-03C-02 malformed body ids a malformed revisionId is 422 COMPOSITION_VALIDATION_FAILED at that member and never reaches the port':
    ['not-a-uuid', 'a number'].map((label) => ({
      tool: 'vitest',
      file: MALFORMED,
      title: `[P2-S12-AC-026] CMS-03C-02 malformed body ids a malformed revisionId (${label}) is 422 COMPOSITION_VALIDATION_FAILED at that member and never reaches the port`,
    })),
  'P2-S12-AC-026|3|[P2-S12-AC-026] CMS-03C-02 malformed body ids a malformed patternId is 422 COMPOSITION_VALIDATION_FAILED at that member and never reaches the port':
    ['not-a-uuid', 'a 37-character uuid'].map((label) => ({
      tool: 'vitest',
      file: MALFORMED,
      title: `[P2-S12-AC-026] CMS-03C-02 malformed body ids a malformed patternId (${label}) is 422 COMPOSITION_VALIDATION_FAILED at that member and never reaches the port`,
    })),
  // refute2-a FIX (aggregate): the three individual blocked-code assertions instead of the suite meta-assertion.
  'P2-S12-AC-147|7|this suite drove the blocked reason codes activation_authority_ended, approval_invalidated and canonical_source_unavailable [P2-S12-AC-147]':
    [
      'a creator grant that ENDED (term passed, not revoked) before the fire instant blocks the schedule activation_authority_ended: subject blocked, review untouched, no event, one audit record [P2-S12-AC-144]',
      'a declared canonical domain with an unbuilt provider at fire time blocks the schedule canonical_source_unavailable: subject blocked, no event, one audit record [P2-S12-AC-143]',
      'a subject that is no longer scheduled / an approval that is no longer approved at fire blocks the schedule approval_invalidated with no event [P2-S12-AC-143]',
    ].map((title) => ({ tool: 'pgtap', file: FIRE, title })),
};

/* ---- re-cuts of the REJECTed splits (verbatim tiles; tile citations chosen by title) --------------------------- */
// each: { tiles: [{ text, cite: [title substrings] | 'all', gap }] }; 'all' = every kept citation of the clause.
const RECUTS = {
  'P2-S12-AC-050|0': [
    { text: 'Update slice tracking', cite: ['tracking: the tracker status agrees', 'tracking: the progress checker report'] },
    {
      text: 'feature-ledger assignments',
      gap: 'BOUNDARY until slice close: 25.05.03 and 25.05.04 are plan-listed for Slice 12 (DEC-114) but still unassigned ("—") in the feature ledger, and the closeout test pins that drift; the assignment and the changed closeout assertion land in the slice-close change.',
    },
    { text: 'applicable runbooks', cite: ['runbook: every runbook the slice cites exists'] },
    { text: 'and architecture graph', cite: ['architecture graph: th'] },
    {
      text: 'in the same change;',
      gap: 'a property of the slice-close commit, not of repository state; no test can prove it (the commit itself shows it).',
    },
    { text: 'leave no unresolved implementation boundary', cite: ['boundaries: '] },
    { text: 'or undocumented drift.', cite: ['contracts: the committ', 'tracking: the progress checker report'] },
  ],
  'P2-S12-AC-190|1': [
    { text: 'every lookup by key (the latest reads, parents', cite: 'all' },
    {
      text: 'selectors)',
      gap: 'BOUNDARY: the owner predicate of cms_list_pattern_selector (and the taxonomy selector) is not isolated by any test; an ACTIVE foreign row is not producible in the fixtures, and the AC-108 control uses a draft clone that the active filter excludes anyway.',
    },
    { text: "is scoped to the caller's owner party", cite: 'all' },
  ],
  'P2-S12-AC-194|0': [
    {
      text: 'Block registry consumption: 03c consumes only the safe `BlockDefinitionRegistryRecord` projection (`id`, `version`, `blockKey`, `blockVersion`, `propsSchemaRef`, `propsSchemaHash`, `rendererRef`, `releaseDigest`, `lifecycle`, with the literal `resourceKind` `block_definition_registry_record` and no release principal, signature or raw manifest)',
      gap: 'missing test or spec ruling: no test shows that every 03c reader of the block registry reads only the nine-member projection; CMS-03C-12 reads props_schema_snapshot and the production SQL carries no resourceKind.',
    },
    { text: 'never registers, updates or deletes a block,', cite: 'all' },
    {
      text: 'and before every template or pattern validation refetches the record or consumes the latest `cms.block.lifecycle.changed.v1`, so that a missing, withdrawn, incompatible, duplicate or unreachable block fails closed before mutation and a deprecated block follows the fixed compatibility policy.',
      gap: 'missing test: refetch-or-consume before every template and pattern validation, and the duplicate and unreachable block outcomes, through the production path.',
    },
  ],
  'P2-S12-AC-198|2': [
    { text: 'the basis is the array of `{ contentTypeId, policyKey, policyVersion, policyHash }` sorted by `(policyKey,', cite: 'all' },
    {
      text: 'policyVersion,',
      gap: 'BOUNDARY: the policy registry holds only version 1 members (CMS_GOVERNED_DEFAULT_POLICY and the DEC-110 seeds), so the middle sort key cannot be exercised through any producer.',
    },
    { text: 'contentTypeId)`', cite: 'all' },
  ],
  'P2-S12-AC-244|0': [
    {
      text: 'Restore of term assignments (DEC-141): each `active` TermAssignment of the source revision is carried to the new revision, an assignment to an `active` or `deprecated` term carrying unchanged, a `merged` term re-pointed to its surviving successor,',
      cite: ['an active and a deprecated term carry unchanged, a merged term is re-pointed'],
    },
    {
      text: 'and an unknown',
      gap: 'BOUNDARY: an assignment to an unknown term (or a term of another owner) is not a reachable shape: cms_term_assignments carries foreign keys to cms_terms, so no honest or forged row names an unknown term; the restore plan still refuses it but no test can construct it.',
    },
    {
      text: 'other-vocabulary term failing the restore 409 `migration_chain_incomplete`,',
      cite: ['an assignment to a term of a vocabulary whose active version does not list this content type', 'restore 409 reason tokens'],
    },
    {
      text: "and the new revision's `taxonomy_version_ids` are the vocabularies' current `active` version ids.",
      cite: ["the new revision records the vocabulary's current active version id", 'a restore of that revision records the CURRENT active ids'],
    },
  ],
};
// Proposed splits the refutation passed but root keeps whole (refute2-a: with part 0 dropped neither part is cited).
const KEEP_WHOLE = new Set(['P2-S12-AC-143|3']);
// Missed tests the refutation filed against a clause whose split it passed: the part (index) they prove.
const MISSED_PART = { 'P2-S12-AC-248|2': 1, 'P2-S12-AC-261|1': 1 };

/* ---- limitation reasons root states (refute2 reports section 7 and per-criterion reasons) ---------------------- */
const REASONS = {
  'P2-S12-AC-186|acting context':
    'BOUNDARY: the actor member of the cursor binding is shown (a page-1 cursor replayed by another actor of the same party is CONFLICT), but the acting-party member is unreachable: the owner-scope concealment answers NOT_FOUND before the cursor hash is compared (migration 20261014120600:95-96; lane BOUNDARY B1).',
  "P2-S12-AC-276|and map `deadlock_detected` and a lock-acquisition failure to the 409 code of the operation's catalog (`*_VERSION_CONFLICT`) with nothing committed and the same `Idempotency-Key` reusable.":
    "missing tests: the single-writer injection tests prove only the SQL wrapper's typed CONFLICT token for a subset of writers; no cited test shows the Worker maps it to each operation's *_VERSION_CONFLICT code, the linked-update scan and the term-merge continuation have no conversion evidence, and 'nothing committed, same Idempotency-Key reusable' is shown for CMS-03C-01 only (template_authority #36/#37). Sound single-writer evidence that does not close the clause: locale_variant/004-relay-source-race-grants.sqlinc (CMS-03C-04 deadlock and lock-acquisition conversions) and governed_recheck/070-isolation.sqlinc (the recheck job).",
  'P2-S12-AC-072|the subject creator) is 403':
    "BOUNDARY: the decision RPC's separation_of_duties branch cannot be reached by a creator (a creator is refused at assignment with 409 reviewer_not_eligible and never holds an assignment); the 403 an unassigned creator receives is capability_missing, not SoD-specific.",
  'P2-S12-AC-143|3':
    'the fire executor folds review state, review version, subject state and subject hash into one approval_invalidated (migration 20261014070600:155-157); no test changes only the subject state ("the subject (`scheduled`") or only its hash ("with an equal hash)"), so the subject re-read is not isolated.',
};

/* ---- load the current ledger ---------------------------------------------------------------------------------- */
const fragments = [];
for (const path of FRAGMENTS) {
  const mod = await import(resolve(ROOT, path));
  const name = Object.keys(mod).find((key) => key.startsWith('S12_EVIDENCE_LEDGER'));
  fragments.push({ path, name, entries: structuredClone(mod[name]) });
}
const entryOf = new Map(fragments.flatMap((f) => f.entries.map((e) => [e.criterion, e])));
const identity = (c) => `${c.tool}|${c.file}|${c.title}|${c.project ?? ''}`;
const citation = (c) => ({
  tool: c.tool,
  file: c.file,
  title: c.title,
  ...(c.project ? { project: c.project } : {}),
});

/* ---- verdict lookup ------------------------------------------------------------------------------------------- */
const verdictOf = new Map(); // criterion|clauseIndex|title -> refutation citation
for (const { refutation } of LANES)
  for (const r of refutation)
    for (const c of r.citations ?? []) verdictOf.set(`${r.criterion}|${c.clauseIndex}|${c.title}`, c);
const resolveAdd = (criterion, index, add) => {
  const v = verdictOf.get(`${criterion}|${index}|${add.title}`);
  if (!v) {
    problems.push(`${criterion} c${index}: no refutation verdict for "${add.title.slice(0, 80)}"`);
    return [];
  }
  if (v.verdict === 'KEEP') return [citation(add)];
  if (v.verdict === 'DROP') return [];
  if (v.verdict === 'FIX') {
    const fixed = FIXES[`${criterion}|${index}|${add.title}`] ?? (typeof v.fix === 'object' && v.fix?.title ? [v.fix] : null);
    if (!fixed) problems.push(`${criterion} c${index}: FIX without a root resolution: "${add.title.slice(0, 80)}"`);
    return (fixed ?? []).map(citation);
  }
  problems.push(`${criterion} c${index}: unknown verdict ${v.verdict}`);
  return [];
};

/* ---- the merge ------------------------------------------------------------------------------------------------ */
const segmentOf = (limitation, text, allTexts) => {
  // the clause's segment of the current limitation: from `"<text>":` to the next `"<other uncited text>":` or the end
  const marker = `"${text}":`;
  const at = limitation.indexOf(marker);
  if (at < 0) return null;
  let end = limitation.length;
  for (const other of allTexts) {
    if (other === text) continue;
    const next = limitation.indexOf(`"${other}":`, at + marker.length);
    if (next >= 0 && next < end) end = next;
  }
  return limitation.slice(at + marker.length, end).trim();
};
const tiles = (text, parts) => {
  let pos = 0;
  for (const part of parts) {
    const at = text.indexOf(part, pos);
    if (at < 0 || !CLAUSE_SEPARATOR.test(text.slice(pos, at))) return false;
    pos = at + part.length;
  }
  return CLAUSE_SEPARATOR.test(text.slice(pos));
};

const changed = new Map(); // criterion -> { before, after }
const plans = new Map(); // criterion -> [{ lane, proposal, refutation }]
for (const { lane, proposals, refutation } of LANES)
  for (const p of proposals)
    plans.set(p.criterion, { lane, proposal: p, refutation: refutation.find((r) => r.criterion === p.criterion) });

for (const [criterion, { proposal, refutation }] of plans) {
  const entry = entryOf.get(criterion);
  if (!entry) {
    problems.push(`${criterion}: not in the ledger`);
    continue;
  }
  const before = { status: entry.status, clauses: entry.clauses.length, cited: entry.clauses.filter((c) => c.citations.length).length };
  const oldLimitation = entry.limitation;
  const oldTexts = entry.clauses.map((c) => c.text);
  const oldClauses = structuredClone(entry.clauses);
  const gapOf = new Map(); // final clause text -> reason
  const addCitations = (clause, list) => {
    const seen = new Set(clause.citations.map(identity));
    for (const c of list) if (!seen.has(identity(c))) (seen.add(identity(c)), clause.citations.push(c));
  };
  const out = [];
  entry.clauses.forEach((clause, index) => {
    const p = proposal.clauses.find((c) => c.index === index);
    if (p && p.text !== clause.text) problems.push(`${criterion} c${index}: proposal text differs from the ledger clause`);
    const missed = (refutation?.missedTests ?? []).filter((m) => m.clauseIndex === index).map((m) => citation(m.citation));
    const key = `${criterion}|${index}`;
    const parts = p?.split ?? (p?.needsSplit ? p.proposedSplit : null);
    const splitVerdict = (refutation?.splits ?? []).find((s) => s.clauseIndex === index);
    if (RECUTS[key]) {
      if (clause.citations.length > 0) problems.push(`${key}: re-cut clause already carries citations`);
      const kept = [
        ...(p?.add ?? []).flatMap((a) => resolveAdd(criterion, index, a)),
        ...(parts ?? []).flatMap((part) => (part.add ?? []).flatMap((a) => resolveAdd(criterion, index, a))),
        ...missed,
      ];
      const used = new Set();
      for (const tile of RECUTS[key]) {
        const mine = tile.cite === 'all' ? kept : kept.filter((c) => (tile.cite ?? []).some((s) => c.title.includes(s)));
        mine.forEach((c) => used.add(identity(c)));
        const next = { text: tile.text, citations: [] };
        addCitations(next, mine);
        if (tile.gap) gapOf.set(tile.text, tile.gap);
        out.push(next);
      }
      for (const c of kept) if (!used.has(identity(c))) log.push(`${key}: KEEP not mapped to any tile, not cited: ${c.title.slice(0, 100)}`);
      return;
    }
    if (parts && splitVerdict?.verdict === 'OK' && !KEEP_WHOLE.has(key)) {
      if (clause.citations.length > 0) problems.push(`${key}: split clause already carries citations`);
      if (missed.length > 0 && MISSED_PART[key] === undefined) problems.push(`${key}: missed tests on a split clause need a tile`);
      parts.forEach((part, k) => {
        const next = { text: part.text, citations: [] };
        addCitations(next, (part.add ?? []).flatMap((a) => resolveAdd(criterion, index, a)));
        if (MISSED_PART[key] === k) addCitations(next, missed);
        if (part.gap) gapOf.set(part.text, part.gap);
        out.push(next);
      });
      return;
    }
    if (parts && !KEEP_WHOLE.has(key) && splitVerdict?.verdict !== 'REJECT')
      problems.push(`${key}: proposed split without an OK or REJECT verdict`);
    // whole clause: KEEP/FIX adds of the clause (and of a REJECTed or kept-whole split's parts only if the
    // refutation left no re-cut: those parts' citations do not prove the whole clause, so they are not added)
    const next = { text: clause.text, citations: [...clause.citations] };
    if (!parts) addCitations(next, [...(p?.add ?? []).flatMap((a) => resolveAdd(criterion, index, a)), ...missed]);
    else {
      for (const part of parts) for (const a of part.add ?? []) resolveAdd(criterion, index, a); // verdict presence check
      if (missed.length) addCitations(next, missed);
      log.push(`${key}: split ${KEEP_WHOLE.has(key) ? 'kept whole by root' : 'REJECTed without re-cut'}; clause stays ${next.citations.length ? 'cited' : 'uncited'}`);
    }
    if (p?.gap) gapOf.set(clause.text, p.gap);
    out.push(next);
  });
  if (!tiles(entry.text, out.map((c) => c.text))) problems.push(`${criterion}: final clauses do not tile the criterion text`);
  entry.clauses = out;
  const cited = out.filter((c) => c.citations.length > 0).length;
  entry.status = cited === out.length ? 'verified' : cited === 0 ? 'unverified' : 'partial';
  const unchanged =
    JSON.stringify(out.map((c) => [c.text, c.citations.map(identity)])) ===
    JSON.stringify(oldClauses.map((c) => [c.text, c.citations.map(identity)]));
  if (entry.status === 'verified') entry.limitation = '';
  else if (unchanged) entry.limitation = oldLimitation;
  else {
    const uncited = out.filter((c) => c.citations.length === 0);
    const segments = uncited.map((c) => {
      const reason =
        REASONS[`${criterion}|${c.text}`] ??
        REASONS[`${criterion}|${oldTexts.indexOf(c.text)}`] ??
        gapOf.get(c.text) ??
        segmentOf(oldLimitation, c.text, oldTexts);
      if (!reason) problems.push(`${criterion}: no reason for uncited clause "${c.text.slice(0, 80)}"`);
      return `"${c.text}": ${String(reason ?? '').replace(/\s+$/u, '')}`;
    });
    entry.limitation = `Unproven (uncited clause${uncited.length > 1 ? 's' : ''}): ${segments.join(' ')}`;
  }
  const after = { status: entry.status, clauses: out.length, cited };
  if (JSON.stringify(before) !== JSON.stringify(after) || entry.limitation !== oldLimitation) changed.set(criterion, { before, after });
}

/* ---- AC-197 wave-1 carry --------------------------------------------------------------------------------------- */
{
  const criterion = 'P2-S12-AC-197';
  const wave1 = JSON.parse(readFileSync(resolve(HERE, '../recite/c-refutation.json'), 'utf8')).find((r) => r.criterion === criterion);
  const entry = entryOf.get(criterion);
  const list = [];
  for (const c of wave1.citations) {
    if (c.clauseIndex !== 0) problems.push(`AC-197 wave-1 clause ${c.clauseIndex}`);
    if (c.verdict === 'KEEP') list.push(citation(c));
    else if (c.verdict === 'FIX') {
      const [file, title] = String(c.fix).split(' :: ');
      if (!file || !title) problems.push(`AC-197 wave-1 FIX unparsable: ${String(c.fix).slice(0, 80)}`);
      else list.push({ tool: c.tool, file: file.trim(), title: title.trim() });
    }
  }
  const seen = new Set(entry.clauses[0].citations.map(identity));
  for (const c of list) if (!seen.has(identity(c))) (seen.add(identity(c)), entry.clauses[0].citations.push(c));
  log.push(`AC-197: wave-1 carried ${list.length} (${wave1.citations.length} judged), clause 0 now ${entry.clauses[0].citations.length}`);
}

/* ---- summary, write ------------------------------------------------------------------------------------------- */
const all = fragments.flatMap((f) => f.entries);
const count = (s) => all.filter((e) => e.status === s).length;
const summary = {
  problems,
  totals: { verified: count('verified'), partial: count('partial'), unverified: count('unverified') },
  changed: changed.size,
  transitions: [...changed].filter(([, v]) => v.before.status !== v.after.status).map(([c, v]) => `${c.slice(6)} ${v.before.status}->${v.after.status}`),
  citations: all.reduce((n, e) => n + e.clauses.reduce((m, c) => m + c.citations.length, 0), 0),
  log,
  final: Object.fromEntries([...plans.keys()].map((c) => [c, entryOf.get(c)?.status])),
};
console.log(JSON.stringify(summary, null, 1));
if (REPORT) writeFileSync(resolve(ROOT, REPORT), `${JSON.stringify(summary, null, 1)}\n`);
if (DRY || problems.length > 0) process.exit(problems.length > 0 ? 1 : 0);
for (const { path, name, entries } of fragments) {
  const file = resolve(ROOT, path);
  const old = readFileSync(file, 'utf8');
  writeFileSync(file, `${old.slice(0, old.indexOf(`export const ${name}`))}export const ${name}: readonly EvidenceLedgerEntry[] = ${JSON.stringify(entries, null, 2)};\n`);
}
execFileSync('pnpm', ['exec', 'prettier', '--write', ...FRAGMENTS], { cwd: ROOT, stdio: 'inherit' });
