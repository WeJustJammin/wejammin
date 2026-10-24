# Review `claude_s12_refute_a` — refutation of lane `a` re-citation proposals (P2-S12-AC-001 .. AC-079)

Reviewer: `claude_s12_refute_a` (separate population; did not write the proposals). Inputs: `recite/a-proposals.json`,
`lane-recite-a-report.md`, `briefs/recite-refutation.md`, `2026-10-14-claude-s12/lane-rules.md`. Output:
`recite/a-refutation.json` (79 entries, one per criterion, ascending, written incrementally) and this report.
Everything below is read-only analysis: no test, supabase, docker, db, race module, Vitest suite or Playwright run was
started. Playwright evidence quoted here is read from root's existing logs.

## Verdict: ACCEPT-WITH-DROPS

Apply the 25 DROPs and the 13 FIX adjustments, correct the limitation texts listed in section 6, and take the missed
tests in the JSON (61) at root's discretion. The DROP rate is 3.6 % (25 / 700), inside the numeric ACCEPT band
(<= 5 %); the verdict carries the instruction to apply the removals because three of the lane's own limitation
statements are false and one criterion text is contradicted by its own suite (findings 1, 2, 4). There is no systematic
over-claiming: the over-claims are five small classes (section 3), every one a handful of citations.

## 1. Counts

| | n | share |
|---|---|---|
| Proposed additions reviewed (every one; 326 Vitest, 374 pgTAP) | 700 | |
| KEEP | 662 | 94.6 % |
| DROP | 25 | 3.6 % |
| FIX (kept for status, with a stated replacement or narrowing) | 13 | 1.9 % |
| Criteria with at least one DROP / one FIX | 18 / 10 | |
| Missed tests I found (all identity-checked) | 61 | 33 Vitest, 25 pgTAP, 1 race, 2 Playwright, in 23 criteria |
| Gap entries recorded (new, mis-stated, or confirmed with detail) | 76 | in 45 criteria |
| Restructured criteria (splits) | 29 | all 29 tile; 0 REJECT |

Status of the 79 criteria, lane vs. mine (recomputed from the KEPT citations): verified 49 / partial 28 / unverified 2
in both. **No criterion changes status.** Only two clauses lost their last citation to a DROP (AC-061 cl 9 and AC-069
cl 0) and both criteria were already partial; every clause the lane left uncited is genuinely uncited. The status
line therefore understates the findings: see section 5 for the `verified` criteria that are complete only if listed
tests are added.

## 2. Mechanical checks (scripts in the scratchpad `claude_s12_refute_a/`)

| Check | Result |
|---|---|
| Clause tiling of all 79 proposals with the guard's own `CLAUSE_SEPARATOR` (`ledger-guard-lib.mjs:57,129-165`) | 0 problems; the 29 restructured splits are all verbatim, ordered, non-overlapping |
| Vitest identity of the 311 non-apispec Vitest additions (fullName, `passed`, unique, in `vitest-all.json` / `uniq8.json`) | all resolve |
| pgTAP identity of the 374 pgTAP additions: literal title owned by exactly one closure file, or computed title cited under the `.sql` entrypoint; present once and `ok` in the latest complete TAP; every cited file is `\ir`-included by a top-level `.sql` | all resolve; no `populated-*.sql` is cited |
| Existing ledger citations of AC-001..079 (554: 387 Vitest, 160 pgTAP, 7 Playwright) | all Vitest/pgTAP resolve passed and unique; 7 Playwright read from source; 1 apispec (AC-055 cl 4) has no JSON identity |
| Missed tests I propose (61) | all Vitest/pgTAP identities verified by script (3 Playwright/race read from source) |
| Sole-proof rule inside lane a (a test that is the only citation of a clause for > 3 criteria) | 0 tests; cross-lane is root's guard (lanes b/c/d encode `staleExisting`/gap carry differently, so I did not trust a merged recomputation) |
| TAP freshness: no closure file newer than the newest TAP for the 24 entrypoints behind the proposals and missed tests | none stale |
| Non-passing or duplicate siblings in the 124 cited Vitest files that run in the JSON (2 more are apispec) | none |

Identity hazards root must handle when applying:

* **15 apispec citations in 12 criteria** (AC-001, 004, 005, 006, 008, 022, 025, 033, 054, 055, 056, 057) cite
  `tests/postgrest/*.apispec.ts`, which are not in `vitest-all.json`. Titles exist in source; passing receipts need
  the apispec run (the 2026-10-23 validate log already reports "no receipt" for two of them). One (AC-008 cl 2) is a DROP on
  merit.
* **Six uncited duplicate-description siblings inside cited pgTAP files**, which the guard's sibling rule rejects
  (`ledger-guard-lib.mjs` `siblingProblems`): `taxonomy_terms/097-bulk-continuation.sqlinc` ("and never by a Seq Scan
  ..." [AC-226], x2; cited by AC-003, 047), `taxonomy_terms/050-authority.sqlinc` ("SETUP the original curator authority
  is restored", x2; AC-018, 019, 030, 046, 047), `taxonomy_terms/096-job-fence.sqlinc` ("fixture: the retired term is
  merged while it holds no assignment", x2; AC-021, 047), `related_public_targets/001-projection.sqlinc` ("the projection
  satisfies the list contract [AC-231]", x2; AC-036, 038, 060), `linked_scan/030-scan.sqlinc` ("and changes nothing" x2,
  "and changes no row" x3; AC-044). Give them unique descriptions or the cited files fail the guard.
* **The newest TAP of `phase_02_slice_12_locale_observability.sql` is a mutation run** (`...dec208mut-002359...tap`,
  5 expected NOT OK). Cited titles are `ok` in the clean runs (`...dec208-001448`, `-001620`, 0 NOT OK); a mechanical
  check against the newest file would raise false alarms.
* **AC-039 encoding**: clause 2 carries `carryExistingFromOriginalClauses: [3]` and is also marked `gap`. Applied
  literally it cites the clause (guard: verified with a limitation, rejected). The lane's intent is "hold those five
  citations back". I encoded that as `noCarry` in my status recomputation; root must drop the carried citations from
  that clause (status partial) or keep them and drop the limitation.
* Computed pgTAP titles (AC-070..079 matrices and others) must be cited under the top-level `.sql` entrypoint, not the
  `.sqlinc`; titles that are literals must be cited under the `.sqlinc` that holds them. I fixed four of my own missed
  tests that had this backwards (script `verify-missed.mjs`).

## 3. DROP classes (25)

| Class | n | Where |
|---|---|---|
| A. Source-text or document assertion (`readFileSync` of an `.astro` page or a runbook) | 6 | AC-045 cl 11; AC-047 cl 4 (runbook); AC-058 cl 0; AC-069 cl 0 x3 (`governed-review-mounts.test.ts`) |
| B. Control, precondition or no-effect assertion filed under a clause that does not state it | 6 | AC-044 cl 2 (happy-path control before a revoke); AC-065 cl 6 (live count after the single accepted submit); AC-072 cl 1 (recount control); AC-067 cl 5 (a refusal before any write cited for an atomic commit); AC-077 cl 0 and AC-078 cl 0 (store-identical after a refusal cited for bounds / MFA) |
| C. Adjacent rule or wrong layer (asserts a neighbouring bound, gate or mechanism) | 11 | AC-008 cl 2 (`failNextRpc` is an immediate TypeError, not a timeout); AC-012 cl 2 (Worker session gate is not the entry-assignment scope); AC-028 cl 2 x2 (512/513-char key length is not the 64-key / 8-depth bound); AC-036 cl 3 (generic P0001, not the token or the 422); AC-041 cl 4 (an ordinary activation is not the cascade); AC-045 cl 13 (a plain 409 is not the conflict flow); AC-048 cl 1 (focus restoration on cancel is not "focus stays"); AC-048 cl 2 (only `status < 300` and the forwarded URL); AC-061 cl 9 x2 (read-time recompute is not consuming `cms.publication.changed.v1`) |
| D. Existence / setup only | 2 | AC-076 cl 0 x2 (`has_function` for the wrapper and the private implementation) |

FIX (13): AC-022 cl 1 x2 (one row of a three-row `it.each` / loop cited as if it were all three); AC-029 cl 2
(digest mismatch is the DEC-186 409, not the clause); AC-045 cl 2 (session gating is not "context is server-derived");
AC-051 cl 2 x2 (pure metric helper, cite the wired publish case); AC-052 cl 2 (gauge `staleLegalFields`, clause names the
counter `cms_locale_stale_total`); AC-065 cl 0 (null `subjectKind` reaches only the typeof arm of the RPC guard);
AC-066 cl 5 (relational registry-vs-policy step-up check); AC-067 cl 5 (title claims the policy-basis and block-digest
freeze, body checks only the response); AC-068 cl 11 (live-review count where a full-image assertion exists) and cl 12
(no-effect assertion misfiled under the 503 clause); AC-073 cl 2 (no-effect assertion filed under "evaluates the ten
ordered checks").

## 4. The lane's five weakest citations (its section "Weakest"), resolved

1. AC-056 duplicate INSERT probe (`l12_duplicate_probe`): KEEP, weak. It duplicates every key column including
   `version`, so it cannot say which unique key fired; it is the only direct unique-key probe.
2. AC-061 "(consumes `cms.publication.changed.v1`)": DROP x2. No consumer exists in the related-content code; the two
   tests prove recompute-on-read. Root must decide whether recompute-on-read is the intended mechanism (spec disagreement).
3. AC-066 "no step-up is required": FIX. The cited test is `expect(row.stepUp === 'required').toBe(policy.stepUp)`, which
   passes if both flip. Replace with the registry assertion `stepUp: 'none'` in
   `phase-02-slice-12-governed-review-openapi.test.ts` and the 201 with a session that has `stepUpAt: null`.
4. AC-060 inferential clauses: KEEP with a note; no single assertion states the rule, the pieces are individually sound.
5. AC-041 / AC-044 "cascade": AC-041 supersession DROP (normal activation); the block-withdrawal-to-review
   invalidation KEEP; AC-044 linked-scan cascade KEEP. AC-015 "reconcile lost responses" (DB replay only) and AC-052
   `cms_locale_stale_total` (gauge cited, FIX) were the lane's soft extras.

## 5. Status: nothing changed, but read this

Mechanically no status moves. Two further statements are needed.

**`verified` criteria that are complete only if listed tests are added** (the cited set proves one layer; the other
half is in the `missedTests` of the JSON): AC-064 cl 1 (the "as 201" half is only at the Worker), AC-068 cl 8 (the RPC
deadline test exists, the lane cites only the session stall) and cl 12 (the SQL token is cited, the 503 mapping is
inferred; no CMS-03C-06 Worker test drives it), AC-070 cl 1 ("as 200"), AC-074 cl 4 (the Worker 409 mapping is cited for
1 of 5 tokens), AC-076 cl 0 (strict + discriminated rests on an acceptance test; the refusal test is AC-077) and cl 1
(revoke 200 route test).

**`partial` criteria whose limitation text is wrong or incomplete** and must be rewritten before it is copied into the
ledger: AC-044 (race claim half wrong), AC-048 (false claim), AC-065, AC-066, AC-067, AC-069, AC-072, AC-073, AC-075,
AC-079 (details in section 6).

## 6. Ten most serious findings

1. **AC-069 limitation is wrong three ways, and three citations are source text.** (a) The hosting of the panel on the
   template, pattern and vocabulary pages is proven only by `governed-review-mounts.test.ts:40-163`, which
   `readFileSync`s the `.astro` pages ("Read as text"); the lane says it is "asserted in jsdom against stubbed proxies".
   DROP x3; clause 0 is now uncited. (b) The lane's gap "no test asserts `document.activeElement` is the result heading"
   is false: `CmsGovernedReviewPanel.test.tsx:245-247` asserts exactly that, in the test the lane itself cites under
   clause 3. (c) "No Playwright spec exists for the panel" is false: `tests/e2e/phase-02-slice-12-governed-review-real-route.spec.ts`
   T2 drives the vocabulary-page panel (one create, no If-Match, `h3:focus, h2:focus` count 1) and root's run
   `.lane-logs/canonical/pw-realroute-governed-20261023T224506Z.log` shows 6 passed. Real gaps remain: the lifecycle
   icon (`CmsGovernedReviewPanel.tsx` renders text only; FE03:879 says "text and icon"), the quoted copy, the 404 half of
   the 403/404 split, template and pattern page hosting.
2. **AC-065 cl 4: the lane's "no test" gap is false.** `taxonomy_definition/060-review-successor.sqlinc:4-17` submits a
   real taxonomy draft declaring each of five unbuilt domains and asserts P0001 `canonical_source_unavailable`, an
   unchanged snapshot and a DETAIL naming the domain (TAP ok 1037..1065), plus a built-domain control (ok 1066). The
   `dec191/040-detail.sqlinc:7` comment the lane cites concerns the blocked activation-schedule reason, a different
   behaviour. Cite these; clause 1 (subjectId in the caller's owner scope: no foreign-owner, lineage-id or absent case
   at the RPC) remains a real gap, so AC-065 stays partial.
3. **`separation_of_duties` is never exercised** (AC-072 cl 4 / 5, AC-074 cl 2). The decision RPC raises it at
   `20261014010200_cms_record_governed_decision.sql:164-167`, but `governed_decision/README.md:15` records that it is
   "defense in depth ... no public path reaches it" (an assignment of the submitter or creator is refused
   `reviewer_not_eligible`). The lane's "submitter case asserted" is the unassigned submitter getting
   `capability_missing` from the assignment gate: outcome evidence only (KEEP, noted). The creator case cannot be set up
   through producers in the decision suite (owner is creator and submitter of every review); it is separable only in the
   assignment suite (`governed_assignment/030-refusals.sqlinc:74`, R3).
4. **AC-079 cl 3 is contradicted by its own suite.** The clause says assignment create and revoke leave the review
   `version` unchanged. `governed_assignment/040-bounds-revoke.sqlinc:112-133` proves a revoke of an assignment that
   authorized a counted approval invalidates the review (`reviewer_authority_changed`, version 3, subject back to
   draft). The cited test says "authorized no counted approval". The lane states no limitation for this. The criterion
   text needs the exception, or the ledger a limitation.
5. **AC-067: three claims are weaker than worded.** "In one transaction" has no fault-injection test (every no-effect
   refusal fires before the first write; the lane's `the hash refusal commits no review` is DROPped for it). The freeze
   citation's title promises the policy-basis hash and block digest but its body checks only the response (FIX; the
   stored-row test AC-197 does assert them). The no-event assertion keys on the review id only, while activation emits
   keyed on the subject id (`20261014070200_cms_governed_activation_core.sql:128`).
6. **AC-066: per-kind authority is untested.** The Worker gate is any-of designer/curator and "leaves per-kind
   authority to SQL" (`governed-review-headers.test.ts:29-46`); no pgTAP drives a curator onto a template, a designer
   onto a taxonomy version or a cross-party caller, and `cms_governed_owner_capability` has no test. The lane lists only
   the 404 gap (which is real: no RPC-level hidden/absent test for submit).
7. **The partial unique index is never asserted** (AC-064/065 cl 6). No file under `supabase/tests`, `tests`, `apps` or
   `packages` names `cms_governed_reviews_live_subject_unique`; every duplicate-submit test is refused by the non-draft
   state guard because the first submit already moved the subject to `review`, so removing the index would not fail
   any test, and the `unique_violation` branch (`20261013300820_...binding_fix.sql:205-209`) and the "draft with a
   live review" arm (131-137) are never reached. Outcome evidence kept; mechanism recorded as a gap the lane omitted.
8. **Mis-targeted bounds and timeouts on `verified` criteria.** AC-028 cl 2 cites 512/513-character key-length tests for
   the 64-key / 8-depth bound (DROP x2; the depth test remains, the 64-key cap has no citation of its own). AC-008 cl 2
   cites an apispec whose `failNextRpc` throws immediately (DROP); a real timeout test remains.
9. **AC-061 cl 9: spec/mechanism disagreement.** The clause says related content consumes `cms.publication.changed.v1`;
   the code recomputes on read and no consumer exists. The lane flagged it; my DROP x2 keeps it uncited. Root decides:
   amend the clause to recompute-on-read, or build the consumer.
10. **Identity and evidence hazards** (section 2): 15 apispec citations without receipts, six duplicate-description
    siblings in cited pgTAP files, a mutant TAP as the newest locale_observability run, and the AC-039 carry encoding.

## 7. Lane statements that a test contradicts

| Criterion | Lane statement | What the repository shows |
|---|---|---|
| AC-044 cl 1 | no race module covers the pattern-update command | `dec193_writer.race.mjs` races the CMS-03C-15 writer against a governed activation (half wrong) |
| AC-048 cl 6 | no live-region or alert assertion in the term tests | `CmsTaxonomyTermForm.refusals.test.tsx:79` asserts `role="alert"` for a refusal |
| AC-065 cl 4 | no test of `canonical_source_unavailable` at the RPC | taxonomy_definition 060 (finding 2) |
| AC-069 cl 11 / limitation | no assertion of focus; no Playwright spec; hosting asserted in jsdom | finding 1 |
| AC-075 limitation | no Playwright spec drives the form | spec T1, T3, T6 drive `CmsGovernedDecisionForm` against the real stack and passed in the root run above (ordinary path only; the protected path gap, cl 8, is real) |
| AC-072 limitation | submitter case asserted | finding 3 |

Every other named gap that I checked was real, including: AC-065 cl 1; AC-066 cl 2; AC-067 cl 4 (Tier 2, hosted
evidence); AC-069 cl 2, 5 and 10; AC-072 cl 5; AC-073 cl 1 (no lock-order oracle or race module for CMS-03C-07) and cl 8;
AC-075 cl 8; AC-079 cl 1 and cl 8. Per-criterion detail, including the gaps the lane did not name, is in
`missedGaps` / `notes` of the JSON.

## 8. Spec / code / test disagreements for root (not citation errors)

* FE03:879 quotes "Needs an independent reviewer's approval" and "lifecycle is text and icon"; the panel says "An
  independent reviewer must approve it before it can be activated." and renders no icon (AC-069 cl 2, 5).
* BE03c / FE03 name `separation_of_duties` for the decision refusal; the producible refusal for the submitter is
  `capability_missing` (finding 3).
* AC-079 cl 3 wording versus the counted-approval invalidation (finding 4).
* AC-061 cl 9 event consumption versus recompute-on-read (finding 9).
* AC-052: the counter `cms_locale_stale_total` (BE03c) versus the gauge `cms_locale_stale_legal_fields` that the
  pgTAP asserts (FIX).
* From earlier criteria: malformed UUIDs answer 422 at the Worker where BE03c row text says 400; a hidden or absent
  locale source is 404 while an unsupported locale is 422; "exclusions win" is realised as refusal of a pin and
  exclusion overlap plus projection omission.

## 9. Method and limits

* Every one of the 700 additions was opened at the asserting lines (Vitest bodies through a TypeScript AST locator,
  `describe.each`/`it.each` rows by their expanded names; pgTAP bodies, helper definitions and the migration being
  tested). Verdicts carry `path:line` reasons.
* Not done: any execution. Cross-lane sole-proof and the guard's receipts are root's; Playwright and apispec evidence
  was read from logs and source only. One unrelated failing test is in `vitest-all.json`
  (`tests/documentation-boundaries.test.ts`, a README requirement for new directories); it is outside lane a.
* The first 45 criteria (AC-001..006, 008, 011..048) in the JSON are regenerated from their unmodified verdict files
  (last edited before the usage-limit cut-off); no verdict in them was changed after the resume. The three no-addition
  criteria (007, 009, 010) and AC-049..079 were added afterwards.
* The JSON adds `tool`, `file`, `proposedStatus` and `notes` to the briefed shape; `fix` is `null` or an object
  (`replaceWith` / `add` / `moveToClause`).

## 10. Files

* `docs/handoffs/2026-10-22-claude-s12/recite/a-refutation.json`
* `docs/handoffs/2026-10-22-claude-s12/review-refute-a-report.md` (this file)
* Scratch (not deliverables): `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_refute_a/`
