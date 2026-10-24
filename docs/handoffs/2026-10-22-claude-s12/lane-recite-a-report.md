# Lane report: claude_s12_recite_a (P2-S12-AC-001 .. AC-079)

## Status

GREEN for the brief: proposals for all 79 criteria are written and validated; nothing was edited outside the two
claimed files; nothing was run (no Vitest, Playwright, pgTAP, race, docker or supabase). HEAD
`b16edb54a7a1b698ed8ca15b6085046d4270626e`, worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`,
finished 2026-10-23. Proposals are PROPOSALS: root applies them after the next commit, reruns the evidence and a
separate reviewer population refutes them first.

Result in one line: 7 / 50 / 22 (verified / partial / unverified, before) becomes 49 / 28 / 2 (after), with 700 new
citations, 212 previously uncited clauses newly cited, 46 clauses left as named gaps, 0 stale existing citations.

## Scope

Criteria AC-001 .. AC-079 of `tests/contracts/phase-02-slice-12-evidence-ledger-001-071.ts` and the AC-072..079
part of `-072-142.ts`. Read-only everywhere except the two files below. Starting hints
(`.lane-logs/s12-claude-intake-20261022/classify-*.json`) were used only as candidate lists; they were stale in many
places and every title was re-derived from the current sources (see Method).

## Files

| Path | Lines | SHA-256 |
|---|---:|---|
| `docs/handoffs/2026-10-22-claude-s12/recite/a-proposals.json` | 11386 | `1db0aec045783d96aa2a5ee74ec5795e7bb0a58e7ddffdd3619d9efd64be195a` |
| `docs/handoffs/2026-10-22-claude-s12/lane-recite-a-report.md` | this file | (given in the final message) |

Scratch (not in the repo, session-scoped): `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_recite_a/`
(`b/NNN.mjs` is the per-criterion source of every proposal, `dsl.mjs` the verifying builder).

## Method (what was checked by machine, what by reading)

- Every Vitest identity was copied from `.lane-logs/canonical/final-evidence-20261023T224619Z/s09/vitest-all.json`
  (the eight files from `claude_root/uniq8.json`), through a builder that REFUSES a title that is not present with
  status `passed` (so a mistyped or stale title cannot be written). Duplicate identities among all cited tests: 0.
- Every pgTAP literal was checked to occur exactly once, as a whole quoted SQL string, in the cited owner file (a
  `.sqlinc` owner is cited as such; no cited `.sqlinc` is included by more than one entrypoint: no warning was emitted).
  Descriptions that are built (`||`, `format`, helper labels such as `s12pl_refused`) are marked `"computed": true`,
  cite the entrypoint `.sql`, and were each confirmed verbatim against a past passing `ok N - ...` line of an ALT-runner TAP
  in `.lane-logs/*.tap`. None of those TAPs is the current full run, so root's evidence run is the real confirmation.
  (This also showed two hint titles were stale: AC-072 "after the revocation" is now "after the grant lapsed";
  `describe.each` names carry quotes in the real identity.)
- apispec identities (not in vitest-all.json) are composed from `describe` + `it` text checked against the file
  (`identitySource: "static"`). Existing Playwright citations were checked against the spec sources and
  `playwright.s09-real.config.ts` (project `real-route-chrome`).
- The proposal JSON was validated: clause texts are verbatim, ordered and tile each criterion text under the guard's
  separator rule (re-implemented from `ledger-guard-lib.mjs`), status equals the guard rule for the proposed clauses, and no
  clause cites the same test twice. Sole-proof rule (a test that alone proves a clause for more than 3 criteria): 0
  violations against the current ledger with my range replaced by the proposals (other lanes' proposals not known).
- Semantic correctness (does the assertion prove the clause) was decided by reading the assertion for: all pgTAP
  and apispec citations (quoted line numbers are in each `evidence` field), all contract tests of the decision/
  assignment/pattern/taxonomy/related/locale families and the Worker tests that carry the clause (rate buckets,
  deadlines, no-store, 415, ceilings). For jsdom component suites and for the large `it.each` Worker families I read
  the test list and sampled bodies (focus, key reuse, step-up, refusals, radio pair) rather than every body; reviewers
  should start there (see Weakest).

## Proposal format (extends the brief; all extras are additive)

Array of `{criterion, clauses[], proposedStatus, proposedLimitation}`; clause = `{index, text, add[], staleExisting[], gap, existingCitations}`.
Extra fields:

- `restructured: true` on 29 criteria (AC-028, 029, 033, 039, 044, 045, 047, 048, 051, 052, 055, 056, 058, 060, 061, 063..073,
  075, 078, 079) whose ledger clauses cannot carry citations or are too coarse. A restructured entry lists the NEW clauses in
  order; each has `text` (verbatim part of the criterion text) and either `fromIndexes` (merged ledger clauses; AC-028) or
  `carryExistingFromOriginalClauses` (existing citations to carry over; the rest). Root should replace the entry's `clauses`
  with these (keeping carried citations). Reasons: label fragments such as "Enforce CMS-03C-02: slotPath/overrides/roots;" and
  bare ";" clauses (AC-028) or "Enforce All" (AC-039) cannot be cited; one-sentence criteria with 4 to 14 independent
  obligations are split on their own commas (AC-029, 044, 045, 047, 048, 051, 052, 058, 060, 061, 063..073, 078, 079);
  "A and B" clauses where only A is asserted are split (AC-033, 055, 056, 069, 075). The guard allows ";" "," "and" "or"
  between clauses, so every split is tiling-valid (checked).
- `heldBackAdd` / `heldBackNote` (AC-039 clause 2 only): citations that are valid but must NOT be applied until the
  named gap closes, because the ledger cannot express "cited but incomplete".
- `evidence` of each citation: `file:line` of the asserting statement plus what it asserts; computed pgTAP evidence also
  names the call site. `identitySource` is `vitest-all.json`, `uniq8.json` or `static`.

## Counts

| Measure | Value |
|---|---|
| Criteria by proposed status | verified 49, partial 28, unverified 2 (before: 7 / 50 / 22) |
| Criteria that change status | 50 up; 0 down; 29 unchanged (7 of them already verified) |
| New citations proposed | 700: pgTAP 374 (270 literal, 104 computed), Vitest 311, apispec 15; 0 Playwright, 0 race |
| Previously uncited clauses newly cited | 212 |
| Criteria restructured (clause split/merge) | 29 |
| Clauses left as gaps | 46 (below) |
| Stale existing citations | 0 (all existing identities in the range still exist and pass) |

Gaps by layer (46 clauses):

| Layer | n | Clauses |
|---|---:|---|
| pgTAP case missing | 13 | AC-001#3 (also needs a spec line), 023#1, 026#2, 033#2, 043#2, 044#3, 055#2, 055#4 (spec/code disagree), 056#9, 065#1, 065#4, 066#2, 072#5 |
| race module / lock-order oracle missing | 6 | AC-013#6, 019#7, 044#1, 047#1, 073#1, 079#1 |
| composed Worker -> Kong/PostgREST -> DB (apispec) missing | 2 | AC-010#2, 016#1 |
| Worker-route test missing | 2 | AC-026#3 (400 vs 422, spec/code disagree), 039#2 (Idempotency-Key at CMS-03C-08 and -16) |
| web component / browser test missing | 13 | AC-042#1,#5,#12; 045#10,#12; 048#6,#10,#12; 069#2 (icon), #5 (quoted copy), #10, #11; 075#8 |
| hosted / staging evidence (Tier 2 p95) | 5 | AC-056#6, 061#6, 067#4, 073#8, 079#8 |
| closeout / process (no test can attest) | 2 | AC-049#0, 050#0 |
| meta clause, derived from other criteria | 3 | AC-040#3, 043#4, 046#5 |

Per criterion (before, proposed, structure, new citations, newly cited clauses, gap clause indexes):

| Criterion | Before | Proposed | Structure | New citations | Newly cited clauses | Gap clauses |
|---|---|---|---|---:|---:|---|
| 001 | partial | partial | as ledger (4) | 4 | 0 | #3 |
| 002 | partial | verified | as ledger (2) | 7 | 1 | - |
| 003 | partial | verified | as ledger (5) | 4 | 1 | - |
| 004 | partial | verified | as ledger (3) | 2 | 1 | - |
| 005 | partial | verified | as ledger (5) | 8 | 1 | - |
| 006 | partial | verified | as ledger (4) | 4 | 1 | - |
| 007 | verified | verified | as ledger (7) | 0 | 0 | - |
| 008 | partial | verified | as ledger (6) | 2 | 1 | - |
| 009 | verified | verified | as ledger (3) | 0 | 0 | - |
| 010 | partial | partial | as ledger (4) | 0 | 0 | #2 |
| 011 | partial | verified | as ledger (5) | 15 | 2 | - |
| 012 | partial | verified | as ledger (6) | 8 | 2 | - |
| 013 | partial | partial | as ledger (7) | 11 | 2 | #6 |
| 014 | partial | verified | as ledger (6) | 6 | 2 | - |
| 015 | partial | verified | as ledger (3) | 8 | 2 | - |
| 016 | partial | partial | as ledger (3) | 0 | 0 | #1 |
| 017 | partial | verified | as ledger (5) | 12 | 1 | - |
| 018 | partial | verified | as ledger (6) | 7 | 2 | - |
| 019 | partial | partial | as ledger (8) | 11 | 2 | #7 |
| 020 | partial | verified | as ledger (6) | 5 | 2 | - |
| 021 | partial | verified | as ledger (3) | 9 | 2 | - |
| 022 | partial | verified | as ledger (6) | 6 | 1 | - |
| 023 | partial | partial | as ledger (3) | 0 | 0 | #1 |
| 024 | verified | verified | as ledger (4) | 0 | 0 | - |
| 025 | partial | verified | as ledger (4) | 7 | 1 | - |
| 026 | partial | partial | as ledger (4) | 6 | 1 | #2 #3 |
| 027 | partial | verified | as ledger (4) | 6 | 1 | - |
| 028 | partial | verified | restructured (5) | 18 | 1 | - |
| 029 | unverified | verified | restructured (4) | 16 | 4 | - |
| 030 | partial | verified | as ledger (5) | 7 | 2 | - |
| 031 | verified | verified | as ledger (4) | 0 | 0 | - |
| 032 | partial | verified | as ledger (4) | 8 | 1 | - |
| 033 | partial | partial | restructured (4) | 2 | 1 | #2 |
| 034 | verified | verified | as ledger (6) | 0 | 0 | - |
| 035 | verified | verified | as ledger (3) | 0 | 0 | - |
| 036 | partial | verified | as ledger (5) | 13 | 3 | - |
| 037 | partial | verified | as ledger (6) | 10 | 1 | - |
| 038 | partial | verified | as ledger (3) | 11 | 2 | - |
| 039 | partial | partial | restructured (5) | 20 | 0 | #2 |
| 040 | partial | partial | as ledger (4) | 0 | 0 | #3 |
| 041 | partial | verified | as ledger (5) | 3 | 1 | - |
| 042 | partial | partial | as ledger (14) | 0 | 0 | #1 #5 #12 |
| 043 | partial | partial | as ledger (5) | 8 | 2 | #2 #4 |
| 044 | unverified | partial | restructured (5) | 9 | 3 | #1 #3 |
| 045 | unverified | partial | restructured (14) | 27 | 12 | #10 #12 |
| 046 | partial | partial | as ledger (6) | 10 | 2 | #5 |
| 047 | unverified | partial | restructured (5) | 13 | 4 | #1 |
| 048 | unverified | partial | restructured (14) | 23 | 11 | #6 #10 #12 |
| 049 | unverified | unverified | as ledger (1) | 0 | 0 | #0 |
| 050 | unverified | unverified | as ledger (1) | 0 | 0 | #0 |
| 051 | unverified | verified | restructured (4) | 12 | 4 | - |
| 052 | unverified | verified | restructured (4) | 9 | 4 | - |
| 053 | verified | verified | as ledger (8) | 0 | 0 | - |
| 054 | partial | verified | as ledger (5) | 5 | 1 | - |
| 055 | partial | partial | restructured (9) | 6 | 1 | #2 #4 |
| 056 | partial | partial | restructured (11) | 6 | 3 | #6 #9 |
| 057 | partial | verified | as ledger (13) | 5 | 1 | - |
| 058 | unverified | verified | restructured (9) | 27 | 9 | - |
| 059 | partial | verified | as ledger (4) | 6 | 1 | - |
| 060 | unverified | verified | restructured (6) | 17 | 6 | - |
| 061 | partial | partial | restructured (10) | 11 | 4 | #6 |
| 062 | partial | verified | as ledger (13) | 7 | 2 | - |
| 063 | unverified | verified | restructured (8) | 24 | 8 | - |
| 064 | unverified | verified | restructured (4) | 12 | 4 | - |
| 065 | unverified | partial | restructured (7) | 12 | 5 | #1 #4 |
| 066 | unverified | partial | restructured (7) | 10 | 6 | #2 |
| 067 | unverified | partial | restructured (9) | 15 | 8 | #4 |
| 068 | unverified | verified | restructured (13) | 28 | 13 | - |
| 069 | unverified | partial | restructured (12) | 22 | 8 | #2 #5 #10 #11 |
| 070 | unverified | verified | restructured (4) | 13 | 4 | - |
| 071 | unverified | verified | restructured (5) | 17 | 5 | - |
| 072 | partial | partial | restructured (8) | 13 | 4 | #5 |
| 073 | partial | partial | restructured (10) | 15 | 7 | #1 #8 |
| 074 | partial | verified | as ledger (10) | 7 | 1 | - |
| 075 | partial | partial | restructured (10) | 9 | 4 | #8 |
| 076 | unverified | verified | as ledger (3) | 13 | 3 | - |
| 077 | partial | verified | as ledger (4) | 8 | 2 | - |
| 078 | unverified | verified | restructured (6) | 12 | 6 | - |
| 079 | partial | partial | restructured (12) | 13 | 9 | #1 #8 |

## Gap list (named missing tests)

Each gap names layer, file to put it in, what it must assert and the spec line; the full text is in the `gap`
field of the JSON. Heads:

- AC-001 #3 `and accessibility contracts in templates.`: missing test (and a spec decision): BE03c "Accessibility handoff tests" (lines 1816-1818) reduces template accessibility to stable JSON Pointer paths for template/slot validation errors and reserved profile/provenance regions that...
- AC-010 #2 `and complete the declared happy path`: missing test: composed Worker->Kong/PostgREST->database case in a new tests/postgrest/phase-02-slice-12-pattern-placement.apispec.ts (model: phase-02-slice-12-template-version.apispec.ts) asserting POST /api/v1/cms/compositions/pa...
- AC-013 #6 `and concurrency rules.`: missing test: race (tool race) under supabase/tests (new phase_02_slice_12_pattern_placement.race.mjs, runner infra/database-races) driving two simultaneous cms_insert_pattern_instance calls into one (revision, slot) from independ...
- AC-016 #1 `and complete the declared happy path`: missing test: composed Worker->Kong/PostgREST->database case, new tests/postgrest/phase-02-slice-12-taxonomy-term-action.apispec.ts (model: phase-02-slice-12-template-version.apispec.ts), asserting POST /api/v1/cms/taxonomies/{tax...
- AC-019 #7 `and concurrency rules.`: missing test: race (tool race) under supabase/tests (new phase_02_slice_12_taxonomy_term_action.race.mjs, runner infra/database-races) driving two simultaneous cms_act_taxonomy_term calls on one vocabulary/term from independent se...
- AC-023 #1 `each active/allowlisted ContentTypeVersion family`: missing tests: (1) pgTAP in supabase/tests/phase_02_slice_12_template_authority.sql: cms_define_template with a compatibleTypeIds member that exists and is owned by the caller but whose cms_content_types.state is not active, and o...
- AC-026 #2 `'patternId' a lineage id of the caller's owner scope`: missing test: pgTAP in supabase/tests/phase_02_slice_12_pattern_placement/050-refusals.sqlinc: the owner party places on its own readable current draft revision with a patternId (lineage) owned by a DIFFERENT organization, expecti...
- AC-026 #3 `400/404.`: missing test: Worker route test in apps/worker/src/cms-composition/pattern-instance-routes.test.ts (and adapter) with a non-UUID revisionId/patternId asserting the status BE03c names, 400 INVALID_REQUEST (lines 382 and 1440). The ...
- AC-033 #2 `be readable`: missing test: pgTAP in supabase/tests/phase_02_slice_12_locale_variant/003-contract-and-idempotency.sqlinc (and the real-stack apispec) where sourceRevisionId names a revision that EXISTS but the caller cannot read (a revision of ...
- AC-039 #2 `Idempotency-Key 8–128 printable ASCII`: missing tests: Worker-route-level Idempotency-Key boundary tests (missing, 7 chars, 129 chars, non-printable: 400 before authorization, no quota consumed) for CMS-03C-08 (apps/worker/src/cms-composition/governed-review-assignment-...
- AC-040 #3 `implement locked behavior and completion exactly. Operations: CMS-03C-...`: meta clause, no single test can prove it: "implement locked behavior and completion exactly. Operations: CMS-03C-06 ... CMS-03C-11 and CMS-03C-19" is discharged exactly when the per-operation criteria of those operations are verif...
- AC-042 #1 `focus stays until navigation or named result heading`: missing test: (a) jsdom case in apps/web/src/components/cms-composition/CmsTemplateDesigner.interaction.test.tsx (and the edit designer) asserting that after a SUCCESSFUL create/successor the focus stays on the commit control unti...
- AC-042 #5 `Render authoritative response/version/provenance/next action`: missing test: web component test (CmsTemplateDesigner/CmsTemplateEditDesigner interaction) and/or the real-route spec asserting that a successful definition renders the authoritative version AND its provenance (parent version / su...
- AC-042 #12 `scoped draft before commit`: missing test: web component test asserting the scoped draft store the FE03 line 1109 CMS-11 row requires (unsent values written to a per-form scoped draft before commit and cleared after server success). Today only in-memory reten...
- AC-043 #2 `and readable`: missing test: pgTAP in supabase/tests/phase_02_slice_12_pattern_placement/050-refusals.sqlinc where the readable, editable revision of the caller references a pattern lineage owned by ANOTHER organization, expecting the concealed ...
- AC-043 #4 `implement locked behavior and completion exactly. Operations: CMS-03C-...`: meta clause, no single test can prove it: "implement locked behavior and completion exactly. Operations: CMS-03C-12 (pattern version create), CMS-03C-13 (selector), CMS-03C-14 (update diff) and CMS-03C-15 (pattern update)" is disc...
- AC-044 #1 `concurrency`: missing test: race (tool race) for CMS-03C-02 and CMS-03C-15 asserting two competing expected revisions serialize one winner and return the typed conflict (VERSION_MISMATCH / CONFLICT) to the loser with no duplicate row, audit or ...
- AC-044 #3 `deletion`: missing test: pgTAP asserting the IA03 line 533 deletion rule for a pattern / composition source: an owner or source (pattern lineage, entry) deleted or tombstoned keeps the immutable evidence (pattern version and composition rows...
- AC-045 #10 `reconcile unknown mutation before retry`: missing test: apps/web/src/components/cms-composition-instances/CmsCompositionPage.insert.test.tsx asserting that after an unknown placement outcome (502/503/504 or a network fault) the page reconciles with an authoritative read (...
- AC-045 #12 `scoped draft before commit`: missing test: FE03 line 926 ("retain scoped draft, show inline leave confirmation, use beforeunload only while dirty, and clear only after success or explicit discard") for the composition page: a dirty insert form (chosen pattern...
- AC-046 #5 `implement locked behavior and completion exactly. Operations: CMS-03C-...`: meta clause, no single test can prove it: "implement locked behavior and completion exactly. Operations: CMS-03C-16 (taxonomy version create), CMS-03C-17 (taxonomy selector) and CMS-03C-18 (canonical-taxonomy overlap provider)" is...
- AC-047 #1 `concurrency`: missing test: race (tool race) for cms_act_taxonomy_term asserting two competing writers on one vocabulary/term serialize one winner and return the typed conflict (CONFLICT / TAXONOMY_VERSION_CONFLICT) to the loser without duplica...
- AC-048 #6 `announce status`: missing test: web component test asserting that the term form result/refusal status is announced (a role="status" / aria-live="polite" region for a result and role="alert" for a refusal, FE03 interaction row CMS-14) - CmsTaxonomyT...
- AC-048 #10 `reconcile unknown mutation before retry`: missing test: CmsTaxonomyTermForm test where an uncertain outcome is followed by a retry and the same Idempotency-Key is sent (or an authoritative reconcile read precedes it), per FE03 interaction row CMS-14. Today CmsTaxonomyTerm...
- AC-048 #12 `scoped draft before commit`: missing test: FE03 line 926 ("retain scoped draft, show inline leave confirmation, use beforeunload only while dirty, clear only after success or explicit discard") for the term form: a dirty create/rename/alias form must keep its...
- AC-049 #0 `Execute Contract → QA-RED → data, API, SSR and island implementation →...`: missing test: a Slice 12 closeout test in tests/contracts/phase-02-slice-12-closeout.test.ts (model: tests/contracts/phase-02-slice-11-closeout.test.ts) that asserts the retained RED record (the failing-test evidence under .memory...
- AC-050 #0 `Update slice tracking, feature-ledger assignments, applicable runbooks...`: missing test: tests/contracts/phase-02-slice-12-closeout.test.ts (model: phase-02-slice-11-closeout.test.ts) asserting, for Slice 12: the tracker gate lines, the feature-ledger assignments (25.03.02, 25.03.03, 25.05.01 to 25.05.04...
- AC-055 #2 `on a source revision the caller can read`: missing test: pgTAP in supabase/tests/phase_02_slice_12_locale_variant/003-contract-and-idempotency.sqlinc (and the real-stack apispec) where sourceRevisionId names a revision that EXISTS but the caller cannot read (a revision of ...
- AC-055 #4 `locale`: missing test or spec reconciliation: BE03c says a hidden or absent locale is 404 LOCALE_SOURCE_NOT_FOUND, but the RPC refuses a locale outside the active version's supportedLocales as a 422 validation failure (supabase/tests/phase...
- AC-056 #6 `the Tier 2 p95 < 1,200 ms`: missing test: staging/hosted performance evidence for POST /api/v1/cms/entries/{entryId}/locales/{locale}/variants p95 < 1,200 ms (Tier 2 end-to-end budget); tests/performance/api-p95-smoke.test.ts does not cover CMS-03C-04 and no...
- AC-056 #9 `answers a changed actor`: missing test: pgTAP in supabase/tests/phase_02_slice_12_locale_variant/003-contract-and-idempotency.sqlinc (and the real-stack apispec) replaying a stored key as a DIFFERENT server-resolved actor / acting party and expecting the 4...
- AC-061 #6 `Tier 2`: missing test: staging/hosted performance evidence that POST /api/v1/cms/entries/{entryId}/related-content meets the Tier 2 p95 < 1,200 ms end-to-end budget (tests/performance/api-p95-smoke.test.ts does not cover CMS-03C-05). Only ...
- AC-065 #1 `a 'subjectId' that is the exact version row id in the caller's owner s...`: missing test: pgTAP in supabase/tests/phase_02_slice_12_governed_submit/ where subjectId names (a) a lineage id rather than the exact version row id, (b) a version row owned by another organization, (c) an absent id, each expectin...
- AC-065 #4 `and, for a taxonomy version, a registered provider for every declared ...`: missing test: pgTAP in supabase/tests/phase_02_slice_12_governed_submit/ submitting a draft taxonomy version that declares a canonical domain with no registered provider, expecting P0001 canonical_source_unavailable with DETAIL {"...
- AC-066 #2 `a hidden or absent subject is 404`: missing test: pgTAP in supabase/tests/phase_02_slice_12_governed_submit/ where the subject is absent, or a version row of another organization, expecting the concealed NOT_FOUND from platform_api.cms_submit_governed_review and unc...
- AC-067 #4 `the Tier 2 p95 < 1,200 ms target`: missing test: staging/hosted performance evidence for POST /api/v1/cms/governed-reviews p95 < 1,200 ms (Tier 2 end-to-end budget); no local assertion can attest an end-to-end p95 (hosted/native evidence, root-owned).
- AC-069 #2 `icon`: missing test (and implementation): FE03 line 879 says "Lifecycle is text and icon". CmsGovernedReviewPanel.tsx renders the lifecycle as text only (no icon element in the panel source) and no test asserts an icon; either an icon wi...
- AC-069 #5 `states why a version cannot yet be activated ("Needs an independent re...`: wording discrepancy, no test for the quoted string: FE03 line 879 quotes "Needs an independent reviewer's approval" for a version that cannot yet be activated; the panel (CmsGovernedReviewPanel.test.tsx:95) asserts "An independent...
- AC-069 #10 `the 403/404 split`: missing test: a panel/submit-flow case asserting the 404 half of the split (a hidden or absent subject at submit time shows the concealed not-found copy, distinct from the capability gate). Only the 403 half is asserted in the pan...
- AC-069 #11 `the focused result heading.`: missing test: CmsGovernedReviewPanel / submit-form test asserting document.activeElement is the result heading after a submit (FE03 line 879 and the focus rule); the submit-form test only asserts that the frame is titled with "the...
- AC-072 #5 `the subject creator) is 403`: missing test: pgTAP in supabase/tests/phase_02_slice_12_governed_decision/ where the subject creator is a DIFFERENT person from the submitter, holds an effective assignment and the standing cms.reviewer grant, and is refused the d...
- AC-073 #1 `runs in one transaction that takes its locks in the Slice 12 lock orde...`: missing test: a lock-order oracle (static, as pattern_updates/080-lock-order.sqlinc does for CMS-03C-15) and a race module (tool race) for platform_api.cms_record_governed_decision asserting it takes the subject, dependency and co...
- AC-073 #8 `and Tier 2`: missing test: staging/hosted performance evidence for POST /api/v1/cms/governed-reviews/{reviewId}/decision p95 < 1,200 ms (Tier 2 end-to-end budget); no local assertion can attest an end-to-end p95 (hosted/native evidence, root-o...
- AC-075 #8 `protected decision paths`: missing test: apps/web/src/components/cms-governed-review/CmsGovernedDecisionForm.test.tsx (or the detail island suite) driving the protected (two-decision, specialist-slot) path: a base-slot approval leaves the review open and sh...
- AC-079 #1 `locks the review row`: missing test: a lock-position source oracle (as pattern_updates/080-lock-order.sqlinc does for CMS-03C-15) or a race module (tool race) for platform_api.cms_assign_governed_reviewer asserting it locks the review row FOR UPDATE at ...
- AC-079 #8 `and Tier 2`: missing test: staging/hosted performance evidence for POST /api/v1/cms/governed-reviews/{reviewId}/assignments p95 < 1,200 ms (Tier 2 end-to-end budget); no local assertion can attest an end-to-end p95 (hosted/native evidence, roo...

## Weakest citations still proposed (reviewers start here)

1. AC-056 clause "enforces a unique entry, locale and source revision": a direct duplicate INSERT raises 23505
   (`locale_variant/003-contract-and-idempotency.sqlinc` `l12_duplicate_probe`). Table-level only; the RPC-level
   duplicate answer is not asserted.
2. AC-061 parenthetical "(it consumes `cms.publication.changed.v1` for invalidation)": cited through two read-time
   recompute tests (`related_public_targets`: an unpublished entry disappears; a later publication appears). No event
   consumer exists in the related-content code; root should confirm recompute-on-read is the intended mechanism.
3. AC-066 clause "no step-up is required": cited via `governed-review-registry.test.ts` "agrees on method, path, quota,
   deadline and step-up" (policy equals registry row), not a request that succeeds without MFA.
4. AC-060 clauses "a recommendation never grants access to a target the caller could not already read" and "the stored
   rule carries no authority": inferential (hidden pins refused at write, public projection drops foreign and
   unpublished targets, closed resource, no direct grants), no single assertion states the rule.
5. AC-041 "cascade" (and AC-044 "cascade"): the dependent-invalidation evidence is the recheck over a withdrawn block
   (AC-041) and the linked-scan pending_diff cascade (AC-044); both are real, neither is the CMS-11/CMS-12 flow end to end.
   Also soft: AC-015 clause "reconcile lost responses without duplicate effects" (DB replay only, no composed case) and
   AC-052 "`cms_locale_stale_total` until revalidation" (probe test + gauge pgTAP, not one assertion).

## Findings that are not test gaps (decisions for root)

- Spec vs code, 400 vs 422 for a malformed UUID in the body: BE03c 382/1440 say 400 INVALID_REQUEST for CMS-03C-02
  `revisionId`/`patternId`; the Worker answers every body schema failure 422 (`cms-editorial/admission-body.ts` `decodeJson`).
  Affects AC-026#3 (and by the same helper possibly other 400 clauses). No test can pass until one side is reconciled.
- Spec vs code, locale 404: BE03c says a hidden or absent locale is 404 `LOCALE_SOURCE_NOT_FOUND`; the RPC refuses a locale
  outside `supportedLocales` as 422 (`locale_config_enforcement.sql`). AC-055#4.
- Spec inconsistency: AC-062 clause 3 says a hidden target is 404 `RELATED_CONTENT_NOT_FOUND`, AC-036 and AC-060 say a
  hidden/absent/ineligible target is the uniform 422 `related_target_ineligible`. The existing AC-062 citation only
  proves the Worker maps NOT_FOUND to 404 for a hidden SOURCE.
- FE03 line 879 (AC-069): "Lifecycle is text and icon" has no icon in `apps/web/src/components/cms-governed-review/`;
  the quoted copy "Needs an independent reviewer's approval" is implemented as "An independent reviewer must approve it".
- AC-050: two Slice 12 migrations still carry `-- BOUNDARY:` markers (`20261014070300_cms_governed_activation_request.sql:55`,
  `20261014160000_cms_governed_retire_request.sql:21`, retirement-policy confirmation); a closeout test must decide whether
  they are tracked boundaries or stale comments after DEC-190.
- Meta clauses (AC-040#3, AC-043#4, AC-046#5: "implement locked behavior and completion exactly. Operations: ...") are
  discharged only by the per-operation criteria; I left them as gaps rather than cite one representative test per
  operation. Suggest root treats them as derived (verified iff the named criteria are verified) or drops them from the ledger.
- Systemic: no composed Worker -> PostgREST -> DB apispec exists for CMS-03C-02, -03, -05..-12, -15, -16. I treated
  "complete the declared happy path" as needing one (AC-010, AC-016) because the RPC half and the stubbed-port half are
  each tested but nothing joins them (the glue is where the mock-masked defects of earlier slices lived). Layered
  candidates are listed inside the AC-016 gap text so root can instead accept layering; the same call-out applies to AC-014/015
  (verified at the Worker and DB layers without a composed case).
- Several `[P2-S12-AC-nnn]` tags in titles do not match the current criterion numbers; they were ignored, all matching was
  by clause text.

## Runs

None. No test, build, supabase, docker or Playwright invocation (the root's evidence runner owns `test-results/`).
Node scripts only read sources and the existing vitest JSON/TAP logs.

## Test corrections

None.

## Spec citations

BE03c `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md` lines 163-179 (registry), 372-410 (field matrix),
1304, 1338-1351, 1361-1383, 1401, 1440, 1447, 1457, 1519, 1612, 1816-1818; IA03 `.memory/wiki/specs/ia/03-cms-content-modeling.md`
lines 39-69, 520-540 (flow failure columns: concurrent / invalid input / deletion-revocation-cascade); FE03
`.memory/wiki/specs/fe/03-cms-content-modeling.md` lines 877-879, 926, 1109, 1534; DEC-121, 175-176, 181, 185-186, 188-196, 205, 208, 210, 216.

## Open items / BOUNDARY

No BOUNDARY needed: every gap above is a missing test (or a spec/code disagreement) not a missing spec, except AC-001#3
(accessibility contracts in templates has no operational definition beyond stable error pointers and protected regions).

## Requests to root

1. Apply `a-proposals.json` after the next commit; handle `restructured` entries by replacing the ledger clauses with the
   listed ones (verbatim and tiling-valid) and carrying the listed existing citations; do not apply `heldBackAdd` of AC-039.
2. Decide the 400-vs-422 and locale-404 spec/code disagreements (AC-026#3, AC-055#4) and the AC-062 hidden-target wording.
3. Decide how to treat the three meta clauses and the five Tier 2 clauses (hosted evidence is root-owned).
4. Rerun the evidence so the computed pgTAP descriptions (marked `computed`) and the apispec identities get receipts; a
   computed description that differs by one character from the real TAP line will fail the guard and needs the TAP text.
5. A reviewer should open the jsdom/Worker bodies of the families named under "Method" before the proposals are applied.
