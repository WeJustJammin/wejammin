# Review `claude_s12_refute9db` - refutation of the wave-9 database proposals of lanes `db9a` and `db9b`

Reviewer: `claude_s12_refute9db` (separate population; I wrote none of the tests, product code or proposals). 2026-10-31. Worktree
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, HEAD `85ab5ff0` (wave-8 and wave-9 files untracked or modified; the ledger fragments are unchanged from HEAD).

Read: `briefs/recite9-db-refutation.md`, `briefs/recite3-refutation.md`, `briefs/recite8-refutation.md`, `briefs/gaps-wave9-db.md`, `2026-10-14-claude-s12/lane-rules.md`,
`scripts/evidence/README.md` and `ledger-guard-lib.mjs` (by running it), the CURRENT ledger (AC-294, AC-277, AC-108, AC-190, AC-146, AC-211, AC-044, AC-159), the two
lane reports and proposals, `recite8/refutation.json` and `apply8.mjs` (the AC-294 five-part split this review lands on), `review-refute8-report.md`, `review-v18-report.md`
(MINOR-2), DEC-243..247 (`.memory/raw/events/2026-10-29.jsonl`, `2026-10-30.jsonl`, `2026-10-31.jsonl`), BE03b 276, 1724-1760, 1891, 1980, BE03c 174-177, 184, 227, 388, 405-408,
1492, 1571, 1585, 1678, 1682, 1700, 1775, 1817, IA03 533, every SQL file and fragment the lanes list (eight db9a/db9b entrypoints, the `race7`/`race8`/`race9` harness fragments,
the db9b `legacy_forest/` and `support/` fragments), and the migrations the scenarios drive (`20261005012100` lock helpers, `20261005018040` + `20261022010100` + `20261022010000`
create and default template, `20261005011300` + `20261005010600` assignment revocation, `20261005017740` executor, `20261014060400` curation, `20261014140300` pattern selector,
`20261014120700` taxonomy selector, `20261014160100` retirement, `20261005017510`, `20261014020100`, `20261014040100`).

Output: `recite9/refutation-db9.json` (8 entries: the seven proposed criteria plus AC-159 for the brief's V18 MINOR-2 question; 76 citations judged) and this report. Read-only: no
supabase, docker, db, race, Vitest or Playwright run. What I executed: `node` scripts only (ledger loading; a replay of every TAP identity against the TAPs and the `.sql` sources;
SHA-256 of every lane file, TAP and the four run manifests against the current files; the repository's own `evaluateLedger` on synthetic passing receipts). Scratch:
`/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_refute9db/`. Mutation claims ("passes with the predicate removed") are
reasoned from the function bodies and fixtures, not run.

## 1. Verdict

**ACCEPT-WITH-DROPS (mandatory conditions).**

76 citations proposed (db9a 34, db9b 42). **32 KEEP (42.1 %), 27 DROP (35.5 %), 17 FIX (22.4 %).** Not a plain ACCEPT: the DROP and FIX rates are far above the 5 % band, two criteria
(AC-108, AC-190) are proposed `verified` on assertions that pass without the rule (the guard cannot see it: reproduced), one proposal is not guard-valid (AC-044), and the headline
AC-294 "definition lever" rows drive the wrong commands. Not a REJECT: every test file is sound as a test (all 76 identities resolve; every file hash, TAP hash and manifest equals the
lanes' reports; no harness defect found), AC-146 (18 rows, `verified`) and the AC-277 production-path scenario (10 rows) are strong, and the lanes labelled their BOUNDARY items
honestly. What fails is claim-fit: which clause a sound test credits.

Mandatory conditions (detail in sections 5-8; apply by clause TEXT, not by the proposals' indexes):

1. **AC-294: cite 4 rows, drop 12.** Rows 5, 6, 7, 9 (the real-revocation scenario U1) go to post-apply8 clause 1, part "authority/". U2 (rows 0-4), the holder-commit row 8 and the six
   lever rows (10-15) are not cited. Parts "visibility" and "with no invisible/foreign definition lock lever" stay uncited. The lever file never drives `cms_create_entry`, which DOES
   name a definition (`contentTypeId`, `contentTypeVersionId`); a missed test is specified.
2. **AC-277: cite 10 rows at clause 4 "related target unpublish,"**, by text: the proposal's index 2 and parent text are stale and a positional apply would credit "term merge versus assignment,".
3. **AC-108 and AC-190: no citation now.** AC-108 clause 3 is BLIND (the foreign rows are also incompatible with the requested type, so the owner predicate never decides); AC-190 clause 2
   is half proven (the taxonomy half is the first genuine isolation of a CMS-03C selector owner predicate I found; the pattern half is not). One matched-pair test closes both.
4. **AC-146: cite 18 rows at clause 5; `verified`.** All five reason codes, each against a real prior active version.
5. **AC-211: no adds (correct); AC-044: hold.** AC-044's proposal (clause cited, status partial) is rejected by `ledger-guard-lib.mjs:211-214`; "deletion" is one word and has branches no
   command can drive.
6. **Gate hazard:** `phase_02_slice_12_gaps_db9b_legacy_forest_red.sql` fails by design inside `supabase/tests`, which `pg_prove -r --ext .sql` runs whole. Keep it out of every canonical
   run until lane db10's migrations are promoted.
7. Rulings needed from root: section 9.

## 2. Counts

| Criterion | clause | lane | proposed | KEEP | DROP | FIX | lane status | my status |
|---|---|---|---|---|---|---|---|---|
| AC-294 | post-apply8 clause 1 (+ 2-5 judged) | db9a | 16 | 4 | 12 | 0 | partial | **partial** (parts "visibility" and "definition lever" uncited) |
| AC-277 | clause 4 "related target unpublish," | db9a | 18 | 10 | 8 | 0 | partial | partial (clauses 1, 5, 7 stay owner readings) |
| AC-108 | clause 3 | db9b | 4 | 0 | 4 | 0 | **verified** | **partial** |
| AC-190 | clause 2 (+ 4) | db9b | 6 | 0 | 1 | 5 | **verified** | **partial** (contingent) |
| AC-146 | clause 5 | db9b | 20 | 18 | 2 | 0 | verified | **verified** |
| AC-211 | clause 1 | db9b | 0 | - | - | - | partial | partial |
| AC-044 | clause 3 | db9b | 12 | 0 | 0 | 12 | partial (clause cited) | **partial** (contingent; proposal guard-invalid) |
| **Total** | | | **76** | **32** | **27** | **17** | | |
| AC-159 | clauses 6, 3, 7 (additive, not proposed) | db9b | 0 (+6 missed) | | | | verified | verified |

By lane: db9a 14 KEEP / 20 DROP / 0 FIX of 34; db9b 18 / 7 / 17 of 42.

## 3. Classes

| Verdict:class | n | Where |
|---|---|---|
| DROP MODEL | 5 | AC-294 U2 (rows 0-4): the wait is a hand-held UPDATE of one assignment row; no production writer revokes a single assignment (section 6.1) |
| DROP CONTROL | 12 | AC-294 U1 holder-commit (8); AC-277 executor-state restatements and tombstone commit (5, 6, 10) and the O3 FOR UPDATE control (13-17, row 17 also over-claims "every order"); AC-108 and AC-190 positive controls; AC-146 control e |
| DROP ADJACENT | 7 | AC-294 lever rows 10-15 (other commands: CMS-03A-04, CMS-03C-06); AC-146 retries successor-blocked row (clause 4, already cited by 010-ladder) |
| DROP BLIND | 3 | AC-108 rows 1-3: pass with the owner predicate removed |
| FIX WHOLECLAIM | 16 | AC-190 taxonomy rows 1-4 (one branch of a plural clause); AC-044 all 12 (one branch of an unsplittable one-word clause). Sound; `hold` |
| FIX ADJACENT (refile) | 1 | AC-190 row 5: type-ownership concealment is clause 4 content |

## 4. Method notes

- **Identity.** All 76 titles resolve to exactly ONE passing TAP test of their file. The 60 static titles are whole SQL string literals, once, at the stated `descriptionLine`; the 16
  AC-146 titles are computed (`p_tag || ': ...'` in `d9f_blocked`) and belong to the entrypoint, each unique in its file. No description is used twice in any of the eight files;
  `.sqlinc` owners: none. TAP replay: db9a 4 files / 78 tests / 0 not ok (`1a29d16e...`); db9b run A1 6 files / 345 tests, A2 21 tests, B (RED) 112 tests with exactly tests 106-112 failing.
- **Currency.** Every SQL file, fragment, proposal and TAP SHA-256 in the two lane reports equals the file now (0 of 27 differ). The four run manifests (570 promoted migrations, 0 WIP)
  equal the migration files now (570 of 570). The runs describe the current bytes.
- **Guard simulation** (`sim9.mjs`; `evaluateLedger`, synthetic passing receipts, apply8's AC-294 split and AC-277 rows applied first): baseline 0 problems, 257 verified / 36 partial / 3
  unverified. After apply8 (subset): 0 problems, same counts, AC-294 clauses `[0:7 1:3 2:0 3:6 4:0 5:3]`. After apply8 + my rulings: **0 problems, 258 / 35 / 3** (AC-146
  partial -> verified), AC-294 `[0:7 1:7 2:0 3:6 4:0 5:3]`, AC-277 clause 4 `7 -> 17`. If root accepts both contingent readings (AC-190, AC-044): 0 problems, 260 / 33 / 3.
  **db9b as proposed: 1 problem**, `P2-S12-AC-044: partial entry: every clause is cited, so the entry is verified, not partial`. The proposed `verified` of AC-108 and AC-190 is accepted
  with 0 problems: the guard cannot see the over-credit, so these two verdicts are manual rules, not guard rules.
- **Lane claims I re-derived independently.** Confirmed: no command revokes a single assignment (the only writer is the grant / tenure trigger helper); no function writes
  `cms_content_entries.lifecycle` to archived, held or deletion_pending (stronger than the lane's regex scan); `pattern_cycle` is not producible at publish time (three lines in 6.6); a
  second organization cannot hold the CMS owner scope (`20261013300500:92-99` needs a `cms_owner_initialization` receipt of that organization and `20260910023405:39-41` refuses a second
  initialization). Contradicted or narrowed: "AC-294 definition lock lever BUILT" (the lane drove commands other than the create, whose request does name a definition, 6.1.1); "AC-108 / AC-190
  proven in both directions" (6.3.1); "AC-044 partial with the clause cited" (6.5.1); "`cms_submit_governed_review` is CMS-03C-07" (it is CMS-03C-06).
- **What would fail without the rule.** For every KEEP I asked what the assertion does with the rule removed. Where the answer is "nothing" the row is BLIND (AC-108) or an aside
  (AC-294 row 7 survives without the position-2 recheck; it is kept for what it does prove, section 6.1.2).

## 5. Status changes

| Criterion | now | after | change |
|---|---|---|---|
| AC-294 | partial | partial | +4 rows at clause 1 "authority/" (7 in all); parts "visibility" and "definition lever" uncited |
| AC-277 | partial | partial | clause 4 cited (17 rows with refute8's); clauses 1, 5, 7 open |
| AC-108 | partial | partial | nothing cited; clause 3 open |
| AC-190 | partial | partial | nothing cited; clause 2 open (flips with the contingent reading); +1 refiled row at clause 4 |
| AC-146 | partial | **verified** | clause 5 cited (18 rows); limitation cleared |
| AC-211 | partial | partial | unchanged; limitation text updated (DEC-247 ratified) |
| AC-044 | partial | partial | nothing cited; clause 3 held (flips with the contingent reading) |
| AC-159 | verified | verified | optional +6 additive rows |

Totals after apply8 and wave 9: 258 verified / 35 partial / 3 unverified (260 / 33 / 3 under both contingent readings).

## 6. The most serious findings

### 6.1 AC-294 (db9a)

1. **`race9_definition_lever.sql` drives the wrong commands; the lever is reachable on the write path and untested.** The brief asked whether CMS-03B-10 can name another owner's content type
   or default template. It can name the content type and version: the request carries client-supplied `contentTypeId` and `contentTypeVersionId` (BE03b 276; exact-key check
   `20261005018040:81-90`), resolved by a plain SELECT scoped by `candidate.owner_id = acting_party_id` with no lock, a miss being the concealed NOT_FOUND (`:106-114`); the version lock
   (position 4) is taken only for a row that resolved. It cannot name a default template (no operand, BE03b 1726; the default comes from the owner-scoped version, and
   `cms_lock_default_template_shared(template, acting_party_id)` puts the owner predicate in the locking statement, `20261022010000:37-41`; a stored foreign default is the AC-289 BOUNDARY).
   The lane drove `cms_activate_schema` (CMS-03A-04, BE03b rule 3) and `cms_submit_governed_review` (CMS-03C-06, labelled CMS-03C-07 in the file header, README and report; BE03c 174-175),
   never `cms_create_entry`. The six rows are sound for those commands and say nothing about AC-294's subject, whose clause begins "CMS-03B-10 locks ...". DROP ADJACENT; part "with no
   invisible/foreign definition lock lever" stays uncited (DEC-245(6): "unless a definition lever is driven" - the lever of THIS command is not). Missed test (1): a caller of organization B
   (labelled `cms.author` grant, as db9b does) sends `cms_create_entry` naming A's `contentTypeId` and `contentTypeVersionId` while a session of A holds A's content type row and version rows
   FOR UPDATE: the concealed `P0001:NOT_FOUND`, identical to the answer for an absent pair, under a 1 s `lock_timeout`, holder still open (probe after); control: A's own create is observed
   blocked BY the same holder. Missed test (2), unit level, no forgery: with A's holder owning template T1 FOR UPDATE, a session calls `cms_lock_default_template_shared(T1, B)` under
   `lock_timeout` 1 s and returns at once; control `(T1, A)` waits.
2. **U1 proves the position-1 authority fence, not the position-2 recheck.** The real CMS-03A-17 revocation is held open; the real create is observed blocked BY it holding nothing at
   2, 3 or 4 (rows 5-6; the diag only prints "transactionid", so position 1 is inferred from "blocked" plus "nothing later held", which a position-2 wait would not show); after the commit it
   answers the uniform `VALIDATION_FAILED` and writes nothing (rows 7, 9). The create takes position 1 FOR SHARE before its first visibility pass (`20261005012100:160-175`, loops
   `:408-431`), so no real revoker can commit between "check" and "use", and the outcome would be identical if the second loop did not exist. U1 is therefore the real-command twin of A4's
   raw UPDATE under part **"authority/"** (post-split clause 1) - which is consistent with DEC-246(6) ("the create waits at position 1", part "visibility" stays uncited) - and it does not
   re-prove the creator's own capability (cms.author is kept, row 8; A4 carries that). Row 6 is BLIND for part "late position-2 acquisition" (a create that locked 3 before 2 would also read
   00000/00000/00000 while parked at position 1) and is kept for the fence only. Contingent: if root reads "authority/" strictly as the creator's own capability, U1 can be credited nowhere
   while "visibility" is open and goes into the limitation as sound partial evidence (the treatment refute8 gave A3).
3. **U2 is unreachable by any production writer.** Assignments are revoked only by `cms_revoke_edit_presence_without_authority` (`20261005011300:26-120`), called from the AFTER triggers on
   `organization_actor_grant` and `membership_tenure` (`20261005010600:334-348`) inside the transaction that already updated the grant or tenure row, which every create share-locks at
   position 1; the entry-scoped assignment trigger revokes nothing (`20261005011300:66-68`). DEC-245(7) / DEC-246(6) hold: U2 takes only the assignment row, not the position-1 locks the production revoker holds. Rows 0-4 DROP MODEL. U2 is
   the only test that reaches the second loop; that reach is simply not producible.
4. The lever rows' own assertions are weaker than their titles: row 10 is negative-form (not ok, not TIMEOUT, not `55P03%`; activation turns a lock failure into CONFLICT, so only row 11's
   identity with the absent-id outcome would catch a lock request); row 13 asserts only that the holder still owned A's rows afterwards, not elapsed time. Control row 15 is sound and
   proves the probe sees waits on those rows.

### 6.2 AC-277 (db9a)

1. **The production path is sound and "no wait" is observed, not assumed.** Sources: the CMS-03B-20 executor takes the target ENTRY row FOR SHARE at position 0 (`20261005017740:153-155`),
   the schedule creator's publisher authority rows FOR SHARE, the type version FOR SHARE, the review and schedule rows FOR UPDATE (`:16-18`, `62-67`); the CMS-03C-05 curation takes the SOURCE
   entry FOR UPDATE and the target entries FOR SHARE at position 2 (`20261014060400:125-164`). No row conflicts, so nobody waits in either order. The file observes it: the second command
   completes under `lock_timeout` 1 s while the first is demonstrably still open (a `FOR UPDATE NOWAIT` probe after the collect still reads `55P03`); a wait on anything the other holds could end
   only by the timeout, so the only way to pass is not to wait. O1 (executor first) and O2 (curation first) both end in the same state (tombstone, schedule completed, pin stored, target
   absent from the projection). Matches refute8's rulings for the stand-in U1 (rows 4, 7, 8, 12 are the same assertions on the production commands).
2. **The FOR UPDATE control (O3) is sound as a control** (both real commands blocked BY a hand-held FOR UPDATE of the target entry row, `pg_blocking_pids`, `transactionid`; so the probe is
   not blind) **and not citable as proof**: the holder is a revision writer, not an unpublish. Row 17's title claims "every order" but asserts O3's end state only.
3. Row 1 (lock footprint) is kept as supporting: the two probes cannot tell FOR SHARE from FOR KEY SHARE (the publication insert's foreign key takes the latter), so "FOR SHARE" rests on the
   migration line; neither mode conflicts with the curation. Row 0 (db8 U1 projection, now guarded `<> ''`) closes refute8's missed gap and is a new c4 row, not a duplicate.
4. **Hazard: apply by text.** The proposal files these rows at `index: 2` with a stale parent text; index 2 of the current ledger is "term merge versus assignment," (8 citations). The part
   field and the JSON's `clauseIndex: 4` are right. **Stale limitation:** refute8's AC-277 `limitationAdvice` ends "the executor itself is not driven"; after wave 9 it is. Use the text in 8.

### 6.3 AC-108 and AC-190 (db9b)

1. **AC-108 clause 3 is BLIND (rows 1-3).** The second organization's author asks for ITS type and gets an empty page, while the first owner's two real ACTIVE versions are absent. But those versions
   name only the first organization's type (CMS-03C-12 accepts only the caller's own active type ids, BE03c 407 - the lane's "honest limit 2"), so they ALSO fail the compatibility
   predicate; `cms_list_pattern_selector` filters `owner_id = v_party_id AND state = 'active' AND compatible_type_ids contains the type` (`20261014140300:135-137`) and would return the same empty
   page with the owner predicate removed. The positive control (the first owner lists its versions) is for another type, so it does not match the negative arm. The other arm (the second
   organization names the first owner's type) is the type-ownership check (`:111-113`), a different predicate. Row 3 is also tagged `[P2-S12-AC-109]` (the pageVersion rule) in its own title.
2. **The lane stopped one step short.** Its own technique builds the missing row: `legacy_forest/000-world.sqlinc:29-51` (`d9l_draft`) clones a real pattern row as a labelled DRAFT with arbitrary
   columns and makes it ACTIVE only through the real governed chain; the same file's pattern sibling forges the second organization's type (`:40-69`). Build the matched pair: a first-owner
   draft clone whose `compatible_type_ids` names the second organization's active type, run through the FIRST owner's real chain (it holds the owner scope); the second organization's author
   lists NOTHING of it; matched control: the same clone owned by the second organization is listed. If the chain refuses a foreign type id at submit or activation, that refusal (migration:line)
   is the BOUNDARY; the guarded lifecycle seam under a labelled forgery is the fallback. The same row closes the pattern half of AC-190 and the nestable read (`20261027100000`).
3. **AC-190 clause 2 "selectors)": the taxonomy half is a genuine isolation.** The same `typeKey/fieldKey/locale` query lists >= 10 of the first organization's real ACTIVE terms and an empty page
   to the second; the foreign allowlists name that very key, the allowlist is a plain string match with no content-type existence check, and `owner_id = acting_party_id`
   (`20261014120700:138-139`) is the sole difference. Rows 1-4 are sound. They are held (FIX WHOLECLAIM) because "selectors" is plural and DEC-245(5) read plural family claims as universal: citing
   them would make AC-190 `verified` and erase the unisolated pattern branch (the guard forbids a limitation on a verified entry). Contingent: if root reads E14's "lookup by key (the latest
   read, parents, selectors)" as the key-addressed taxonomy selector only, cite rows 1-4 now (AC-190 verified). Row 5 (cross-owner type outcome equals absent) is the type-concealment of
   clause 4: refiled there.

### 6.4 AC-146 (db9b)

All five reason codes are driven against a REAL prior active version 1 (CMS-03C-09 activate) with a real approved successor 2 that supersedes it by identity: activation_authority_ended,
approval_invalidated, canonical_source_unavailable (a taxonomy lineage), dependency_changed and retries_exhausted (the real 15/60/300 s ladder, about 7.5 minutes, attempt counts asserted).
Intactness is the whole row (`to_jsonb`) against an image taken before the claim, plus lineage membership, plus outbox and audit counts; control e makes the same image change when a fire
completes, so the assertions can fail. Fixtures: the calendar lapse and the append-only registry row change the INPUT of the decision, not the code; the one real seam (retries: one existing
function's source replaced and restored) passes the four seam points (substitutes only the failing read; the observed tokens failed_retryable x3 then retries_exhausted leave no other terminal
reason; restoration is asserted at `fire_prior_retries.sql:111`; the assertion is on the prior version). 18 KEEP; control e and the retries successor-blocked row (clause 4, already cited) DROP.
Notes: scenario b ends with the successor in `draft`, not blocked (the committed invalidation after the claim); `fire_prior_retries.sql` really waits about 445 s and `fire_prior_active.sql`
about 70 s inside `db:test`, which runs every `.sql` under `supabase/tests`: budget it.

### 6.5 AC-044 (db9b)

1. **The proposal is not guard-valid.** Citing clause 3 leaves every clause cited; the lane keeps status partial with a BOUNDARY limitation. `ledger-guard-lib.mjs:211-214` rejects it (reproduced),
   `:171-175` rejects the other way out (verified with a limitation), and apply8-style status logic would silently turn it into `verified` with the limitation cleared: the verified-with-caveat
   root's round-2 rule forbids. "deletion" is one word; there is no verbatim split.
2. **The BOUNDARY is true, with lines, and wider than stated.** Entry: `cms_content_entries.lifecycle` admits archived, deletion_pending and held (`20260926090000:33-34`; BE03b 1891, 1980, 2005) but
   no migration writes any of them to that table (a search of every migration for an assignment of those values finds only the party-alias and taxonomy-term lifecycle columns and the
   profile-portfolio state, `20260901062000:92`); held/deletion_pending are "the only representation of a legal hold or an erasure fence before Slice 16 registers the hold provider"
   (`20261005017510:15-19`; `20261014060100:8`), so the writer is Slice 16; BE03b 1980 names only "an authorized CAS RPC". The lane's regex catalog scan (`deletion.sql:200-205`) is a heuristic; the
   search is the stronger evidence. Composition instance: DELETE and UPDATE refused by the immutable guard (proved at `:222-228`). **Owner (organization) deletion, not mentioned by the lane:**
   `platform_api` has `rpc_create_organization`, `rpc_change_organization_type` and `identity_organization_read` only (`20260901040000:1778-1861`).
3. **The 12 rows are sound** for the one deleting command that exists, the real CMS-03C-09 retire (tombstone kept with every definition column, review evidence and composition pins
   byte-identical, selector / placement / provider stop serving the version with matched controls before, one more event at the new lifecycle counter, idempotent replay, the dependent
   in-flight review invalidated once and again as a no-op). Held with the clause (FIX WHOLECLAIM). Contingent: if root rules that "deletion" for CMS-12 Use reusable pattern (IA03 533, whose
   "source" is the pattern; DEC-190 "retirement removes exposure only") covers the pattern source only, cite all 12 and AC-044 is `verified`. The ledger's accepted limitation names
   "(pattern lineage, entry)", so the default here is to hold.
4. Not proposed but sound and additive if the clause is cited: `deletion.sql:135-136` (one audit record of the retirement).

### 6.6 AC-211 and the gate (db9b)

1. **No adds is correct.** Clause 1 is the provider and placement re-proving depth 8 / 512 nodes; both fail the RED suite (tests 106-112) and DEC-247 (option A) orders the fix (lane db10). The 121
   GREEN facts are fixtures, controls and BOUNDARY facts; none asserts the clause, and none pins the defect (nothing asserts the provider passes the deep pin or that placement places it).
   The `[RED]` titles are never cited while they fail.
2. **Gate hazard.** `supabase/tests/phase_02_slice_12_gaps_db9b_legacy_forest_red.sql` is an entrypoint under `supabase/tests` that fails by design; `infra/run-pgtap-verbose.mjs` and
   `supabase test db` run `pg_prove -r --ext .sql` over the directory, so `db:test`, `db:test:tap` and `db:verify` go red on it until db10 is promoted. The WIP README's "not applied by
   db:verify" covers the migrations, not this file.
3. **Stale limitation** ("root decision pending"): DEC-247 is ratified. BOUNDARY checked, true, with lines (8): mutual cycle -> `subject_not_submittable` (`20261013300820:154-158` reclassified by
   `20261014040100:24-30`); one active version per lineage (`20261014020100:101-102`), so any cycle through a lineage has a non-active member, reported `nested_pattern_not_active` (fact
   `010-facts.sqlinc:64-70`); literal trees over depth 8 / 512 nodes cannot be stored (`:79-86`). Minor: `010-facts.sqlinc:50-52` hard-codes `providerVersion "1"`.

### 6.7 V18 MINOR-2 (db9b item 1): which AC-159 clause?

AC-159 is `verified` (10 of 10 clauses cited) and the lane proposed nothing. `template_context.sql` (37 tests, all passing; a labelled second-organization designer grant with a FORBIDDEN control
before it) is additive evidence for **clause 6** ("registered, currently supported block selectors ... of the platform registry, whichever release registered them": the second designer's list
equals the first's, with the RPC flag leaked, and a later-registered block reaches both), **clause 3** ("owned": the second organization's `contentTypes` is empty beside the first's non-empty,
matched) and **clause 7** (exactly `{blockKey, blockVersion}`). Six `missedTests` rows are in the JSON; no status change.

## 7. Seam and reading rulings

- **Seams.** AC-146 retries: passes all four points (6.4). The lapse and registry-row fixtures substitute no read. AC-277's only stand-ins are db8's U1 (DEC-245(7): the production locks of the case)
  and O3's hand-held FOR UPDATE (a labelled control). AC-294 U2 fails point (a): it replaces the revoker's whole lock set, not just the write.
- **Readings.** AC-294 "authority/": U1 yes (6.1.2, contingent). AC-190 "selectors)": hold (6.3.3, contingent). AC-044 "deletion": hold (6.5.3, contingent). AC-146 clause 5 is universal over five
  reasons and all five are proven.

## 8. Limitation advice (per criterion; for the wave-9 limitations script)

**AC-294** (partial): `Unproven (uncited parts): "visibility" (BE03b rule 2: a relation target ARCHIVED or UNASSIGNED between check and use). Archived: no BE03b or BE03c command archives an entry (nothing writes cms_content_entries.lifecycle; DEC-245(6) keeps it open until an archive writer exists). Unassigned: a production revocation (the grant or tenure trigger, 20261005011300) holds position 1, so the create waits there and the position-2 recheck is unreachable through it (phase_02_slice_12_race9_entry_unassigned.sql U1, cited under "authority/"); the hand-held single-assignment revocation U2 has no production writer and is not cited (DEC-245(7), DEC-246(6)). A target bumped while the create waits at position 2 is proven (race8_entry_create.sql A3) but credits only a branch of the part. And "with no invisible/foreign definition lock lever": CMS-03B-10 names a content type and version by client-supplied contentTypeId and contentTypeVersionId (BE03b 276), resolved owner-scoped without a lock (20261005018040:106-114), so the lever is reachable on the write path, but phase_02_slice_12_race9_definition_lever.sql drives CMS-03A-04 and CMS-03C-06, not cms_create_entry. Missing test: a caller of organization B names organization A's contentTypeId and contentTypeVersionId in cms_create_entry while a session of A holds those rows FOR UPDATE; the create answers the concealed NOT_FOUND (identical to an absent pair) under a 1 s lock_timeout; control: A's own create is observed blocked by the same holder. The default template cannot be named (no operand) and a foreign stored default cannot exist (AC-289 BOUNDARY); its lock helper cms_lock_default_template_shared (20261022010000:37-41) puts the owner predicate in the locking statement and is unit-testable. Proven and cited: the position-1 authority fence with a raw grant update (capability re-proved, FORBIDDEN after the wait) and with the real CMS-03A-17 revocation, exact schema (VALIDATION_FAILED at /contentTypeVersionId) and exact default (CONFLICT) rechecked after waits, position 2 never acquired after 3 or 4 (A3, D2); the ascending-id lock order (A6) is cited under clause 0.`

**AC-277** (partial): `Unproven (uncited parts): "linked pattern update versus local override," (BE03c names no override-writing command other than the CMS-03C-02 placement and the CMS-03C-15 resolution; owner reading needed), "duplicate and out-of-order events," and "and restore-epoch fencing each have a deterministic tested outcome." (BE03c states no 03c consumer-ordering or restore-fence rule beyond the idempotent recheck job and the platform fence; owner reading needed). Proven by two-session pgTAP: template activation versus block withdrawal and worker lease expiry (phase_02_slice_12_race7_template_block.sql, _lease.sql), locale source edit versus translation (phase_02_slice_12_race8_locale.sql: both orders, the typed VERSION_MISMATCH of the loser, the retry, the stale row) and related target unpublish on the production path (phase_02_slice_12_race9_related_unpublish.sql: CMS-03B-07 schedule, the real claim and CMS-03B-20 execute against CMS-03C-05, both orders; both take the target entry row FOR SHARE, so nobody waits, observed under a 1 s lock_timeout with the other transaction verified open, and the end state is the same: unpublish tombstone, schedule completed, pin stored, target absent from the public projection; a FOR UPDATE holder control shows the probe sees a wait on that row) plus the lineage-producer stand-in of phase_02_slice_12_race8_related.sql (U1, which takes the production locks of the case, DEC-245(7); the U3 FOR UPDATE rows are not cited).`

**AC-108** (partial): `Unproven (uncited clause): "or other-owner version is never listed": the owner predicate of CMS-03C-13 (cms_list_pattern_selector, 20261014140300:135, version_row.owner_id = v_party_id) is still not isolated. phase_02_slice_12_gaps_db9b_pattern_selector_foreign.sql lists the first owner's real ACTIVE versions to nobody else, but every one of them also fails the compatibility predicate for the second organization's type (CMS-03C-12 accepts only the caller's own active type ids, BE03c 407), so the second organization's page is empty with or without the owner predicate. Missing test: a matched pair in which the other-owner ACTIVE version is compatible with the requested type, so only the owner predicate can exclude it (a first-owner draft clone naming the second organization's active type, activated through the first owner's real governed chain, as db9b legacy_forest d9l_draft builds legacy rows; or the guard that refuses it named as the BOUNDARY), with the same row owned by the caller as the listed control.`

**AC-190** (partial): `Unproven (uncited clause): "selectors)": the taxonomy selector's owner predicate is now isolated (phase_02_slice_12_gaps_db9b_taxonomy_selector_foreign.sql: the same query lists the first organization's active terms and an empty page to the second, 20261014120700:138-139), but the pattern selectors' version-list owner predicate (CMS-03C-13, 20261014140300:135, and the nestable read, 20261027100000) is not: no active other-owner version compatible with the caller's type is producible by the real path (CMS-03C-12 accepts only the caller's own active type ids, BE03c 407) and the db9b pattern file passes with the predicate removed. Missing test: the matched pair of AC-108 (a first-owner active clone naming the second organization's type, not listed to the second organization, listed to its owner).`

**AC-146** (verified): limitation `''` (cleared).

**AC-211** (partial): `Unproven (uncited clause): "again before publish": DEC-247 (option A, 2026-10-31) requires the cms.pattern.active_digest provider (cms_pattern_live_pin_reason) to fail a live pin whose expanded forest is over depth 8 or 512 nodes with pattern_depth_exceeded / pattern_nodes_exceeded (after nested_pattern_not_active) and CMS-03C-02 placement to refuse a ninth nested level with 422 pattern_depth_exceeded at /patternId; lane db10 implements it. Until db10's migrations are promoted, phase_02_slice_12_gaps_db9b_legacy_forest_red.sql (seven [RED] tests: a revision that pins an active legacy pattern nested ten levels deep or expanding to 544 block roots passes the provider, and the ten-level pattern is placed) fails by design and is never cited; it is the witness after the promotion (cite its provider and placement rows then). BOUNDARY: pattern_cycle is not producible at publish time (a mutual cycle cannot be submitted, 20261013300820:154-158 as reclassified by 20261014040100:24-30; one version of a lineage is active at most, 20261014020100:101-102, so the closest producible shape is classified nested_pattern_not_active; a literal tree over depth 8 or 512 nodes cannot be stored, 20261014020100:79-86, so only the expanded bounds can be).`

**AC-044** (partial): `Unproven (uncited clause): "deletion": proven and ready (phase_02_slice_12_gaps_db9b_deletion.sql, 12 rows: tombstone kept with every definition column, review evidence and composition pins byte-identical, selector, placement and publication provider stop serving the retired version, one more event at the new lifecycle counter, idempotent replay, the in-flight dependent review invalidated once and again as a no-op) for the one deleting command that exists, the CMS-03C-09 retirement of a pattern lineage (DEC-190). Not provable and therefore holding the clause open: entry deletion, archival and hold (cms_content_entries.lifecycle admits archived, deletion_pending and held, 20260926090000:33-34, but no function writes them; held and deletion_pending are the pre-Slice-16 legal-hold/erasure fence, 20261005017510:15-19; BE03b 1980 names only an authorized CAS RPC that no spec defines), owner (organization) deletion (platform_api has rpc_create_organization, rpc_change_organization_type and identity_organization_read only, 20260901040000:1778-1861) and composition-instance deletion (DELETE refused by the immutable guard, proved in the file; the only tombstone is the retired row CMS-03C-15 accept appends).`

## 9. Rulings needed from root

1. **AC-294 U1 filing.** Part "authority/" (my default; 4 rows) or credit nowhere while "visibility" is open (then the 4 rows go into the limitation).
2. **AC-190 "selectors)".** Both selector families (default: hold) or the key-addressed taxonomy selector only (cite rows 1-4 now; AC-190 verified).
3. **AC-044 "deletion".** The pattern source only (cite the 12 rows; AC-044 verified) or including entry/owner deletion (default: hold until Slice 16 supplies the writer).
4. **Definition lever scope.** Accept the two missed tests of 6.1.1 (command level and helper level) as what closes the part, and decide whether the lever rows should be re-homed to the Slice 10/11
   activation criteria (BE03b rule 3) rather than dropped silently.
5. **RED entrypoint.** Keep `legacy_forest_red.sql` out of every canonical run until db10 lands (or park it under a path `pg_prove` does not scan).

## 10. What root must do (apply by clause text)

1. AC-294 (after apply8's split): add rows 5, 6, 7, 9 to post-split clause 1 (`clauseIndex 1 + splitParts[0]`); cite nothing else; set the limitation of section 8.
2. AC-277: add the 10 KEEP rows to clause 4 by text; the limitation of section 8 replaces refute8's.
3. AC-146: add the 18 KEEP rows to clause 5; status `verified`, limitation `''`.
4. AC-108, AC-190, AC-211, AC-044: no citation (AC-190 row 5: refile to clause 4); set the limitations of section 8; follow the contingent flips if rulings 2-3 go the other way.
5. AC-159 (optional): add the six `missedTests` rows (clause 6: 3, clause 3: 2, clause 7: 1).
6. Follow-ups (not BOUNDARIES): the CMS-03B-10 lever tests of 6.1.1; the AC-108 matched pair of 6.3.2; fix the CMS-03C-07 / CMS-03C-06 label in `race9_definition_lever.sql:6`,
   `030-definition-world.sqlinc:3`, `race9/README.md` (which also says the file names A's "default template" through the create); add a `FOR NO KEY UPDATE NOWAIT` probe to
   `race9_related_unpublish.sql` if the title "FOR SHARE" should be proven rather than read.

## 11. Files

| File | SHA-256 |
|---|---|
| `recite9/db9a-proposals.json` / `recite9/db9b-proposals.json` (inputs) | `7c8c3c173657d064a0221139d681e1916c69d3e50cf0058c9731ce02a7b16a2a` / `f4880072917cebd4e283a8ac10496a8189e73851fbd2d6d278e8f570f7321ba2` |
| `recite9/db9a-race9-final-run.tap` (input) | `1a29d16e15eefbd3f43b6b5a31f374f0af84be6d724a3e783e9a55d7d0c1038c` |
| `.lane-logs/alt-staged-none-173525-1266705.tap` (A1) / `-173718-1273725.tap` (A2) / `-174519-1302112.tap` (B, RED) | `769aaf6e9d6f1da61045e77d2425e0fc6694c77b63f540769ef602a238314b38` / `6580fdec111c791a10a95f195d220ab179a67569dfcb4185658ad0ef0544e6e1` / `291b7f1d691c491ba7927be283f35241a0cdf0f16636887b452935ae28c81de2` |
| `lane-claude_s12_db9a-report.md` / `lane-db9b-report.md` (inputs) | `45c67bc3ac64c331...` / `3f6944870fc7a7a4...` (equal to LANES.md) |
| `recite8/refutation.json` / `recite8/apply8.mjs` (inputs) | `0444cb38a9919be3...` / `715dab89f1829549...` |
| `recite9/refutation-db9.json` | see the final message (8 entries, 76 citations: 32 KEEP, 27 DROP, 17 FIX) |
| `review-refute9db-report.md` | a file cannot name its own hash: it is in the final message |
