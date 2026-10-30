# Review `claude_s12_refute7` - refutation of the wave-7 proposals of lanes `race7`, `web7` and `pw7`

Reviewer: `claude_s12_refute7` (separate population; I wrote none of the tests, product code or proposals). 2026-10-29, 09:37-10:20 EDT. Worktree
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, HEAD `4f643787` (wave-7 files untracked or modified).

Read: `briefs/recite7-refutation.md`, `briefs/recite3-refutation.md`, `2026-10-14-claude-s12/lane-rules.md`, `scripts/evidence/README.md`, `receipts-lib.mjs`,
`identity-receipts-lib.mjs`, `ledger-guard-lib.mjs`, the CURRENT ledger `tests/contracts/phase-02-slice-12-evidence-ledger-*.ts` (clause texts, citations), the three proposal files
(SHA-256 in section 9), the reports `lane-race7-report.md`, `lane-web7-report.md` (incl. its "Fix round"), `lane-gaps-pw7-report.md` (incl. its "Fix round"), `review-refute5-report.md`
and `recite5/refutation.json` (the 272 web6 verdicts the AC-271 parts rest on), `LANES.md` (to 557), DEC-235..243 (`.memory/raw/events/2026-10-29.jsonl`), BE03c 150-196,
380-410, 1408-1532, 1796-1830 (route rows, lock order, concurrency tests), BE03b 1907-1912 and 2218 (lease), IA03 525-540, FE03 1036-1054 and 1108-1112, the six cited pgTAP
files in full (activation, claim, lease, placement, taxonomy_term, template_block; the seventh, the harness self-test, is uncited) and the `phase_02_slice_12_race7/*.sqlinc` harness, the migrations they
drive (placement `20261014110300`, activation `20261014070400/070410/170100`, claim `20261014070500`, term action `20261014120400/120500/120510`, lineage lock `20261014070010`), the final TAP and
its manifest, the test bodies of all 36 cited web7 rows (about twenty test files) with the product components behind the key rows, the four pw7 specs (page-operations and template-journey in full,
the two journey specs by their asserting lines), the support modules `s12-pw7-flow.ts` and `s12-pw7-block.ts` in full (`s12-pw7-world.ts` and `s12-pw7-tagged.ts` by their exports), root's e2e logs
(`.lane-logs/canonical/e2e-20261029T130804Z`, `pw-rerun-20261029T134805Z`).
Output: `recite7/refutation.json` (18 entries, one per proposed criterion, 159 citations) and this report.
Read-only: no supabase, docker, db, race, Vitest or Playwright run. What I executed: `node` scripts only (ledger loading, a replay of the collector's own `parsePgtapTap` identity mode over the
race7 TAP, a TypeScript-AST extraction of the Playwright titles, a comparison of every web7 title with the file sources and with the lane's captured title list, the repository's
own `evaluateLedger` on synthetic passing receipts, SHA-256 checks). Scratch: `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_refute7/`.

## 1. Verdict

**ACCEPT-WITH-DROPS (mandatory conditions).**

159 citations proposed (race7 115 in 12 criteria, web7 36 in 2, pw7 8 in 4). **99 KEEP (62.3 %), 20 DROP (12.6 %), 40 FIX (25.2 %).**
Not a plain ACCEPT: DROP is above the 5 % band, the proposals for AC-277 and AC-273 are structurally rejected by the repository guard as filed, and the AC-276 proposal would credit two
clauses for 3 of the 17 writer groups the clause names. Not a REJECT: the race7 evidence is real two-session evidence (every KEEP row is a live observation from
`pg_blocking_pids` / `pg_locks` or a probe from a third session, followed by the exact outcome, in a file that restores the database), the DROPs are controls and four blind
assertions rather than mocks, the 34 web7 rows all assert corrected FE03 cells and none pins a defect, and the pw7 pass rows are sound. After the KEEPs, eight criteria become `verified`
at once, AC-058 and AC-111 follow with their receipts, and AC-105 once DEC-243 lands.

Mandatory conditions (detail in sections 5-8):

1. **AC-276 is not applied.** All 39 rows are either partial-writer evidence under a clause that quantifies over 17 writer groups (28 WHOLECLAIM) or lock-order observations
   filed under the wrong clause (7 re-file), or controls (4 DROP). Keep the three clauses uncited and replace the limitation (text in the JSON).
2. **AC-277 cannot be applied as proposed** ("partial" with all three clauses cited: reproduced with `evaluateLedger`, 1 problem). Split c0 and c2 verbatim (parts in the JSON, tiling checked
   by the guard), cite rows 100-104 under part "template activation versus block withdrawal," and rows 106-114 under part "worker lease expiry". Two of the lane's BOUNDARY reasons are
   work volume, not missing spec (locale source edit versus translation; related target unpublish), and AC-294 is reachable and unbuilt: neither is a BOUNDARY.
3. **Apply the 59 race7 KEEP rows** by clause text; **do not apply the 20 DROPs**; re-file the 8 ADJACENT rows (AC-013 c6, AC-019 c7); add the Worker mapping row to AC-086 c1 / AC-205 c1
   so that the "409" is proved, not only the database token (section 7.4).
4. **AC-271: no whole-table citation.** All 34 rows are KEEP, but only the parts `loading` and `disabled` close, and only after rows are added or retitled (section 7.5). `success`, `error`,
   `degraded` and the closing words stay uncited.
5. **pw7**: AC-058 and AC-111 passed on the current bytes (receipts exist in `pw-rerun-20261029T134805Z`). AC-105 fails twice for a PRODUCT reason (DEC-243, migration not promoted): cite
   only after promotion and a green run. AC-273 J3-J6 are sound but cannot be cited (single clause): they go in the limitation.
6. Residual gaps recorded per criterion (section 6, 7); none blocks the KEEPs.

## 2. Counts

| Criterion | clause(s) | lane | proposed | KEEP | DROP | FIX | lane status | my status |
|---|---|---|---|---|---|---|---|---|
| AC-013 | c6 | race7 | 8 | 6 | 2 | 0 | verified | **verified** |
| AC-019 | c7 | race7 | 11 | 8 | 3 | 0 | verified | **verified** |
| AC-044 | c3 (gap only) | race7 | 0 | 0 | 0 | 0 | partial | partial (BOUNDARY agreed) |
| AC-047 | c1 | race7 | 5 | 5 | 0 | 0 | verified | **verified** |
| AC-085 | c1 | race7 | 10 | 9 | 1 | 0 | verified | **verified** (residual order gap) |
| AC-086 | c1 | race7 | 6 | 5 | 1 | 0 | verified | **verified** (+ Worker row) |
| AC-145 | c1 | race7 | 8 | 4 | 4 | 0 | verified | **verified** |
| AC-205 | c1 | race7 | 5 | 4 | 1 | 0 | verified | **verified** (+ Worker row) |
| AC-218 | c3 | race7 | 8 | 4 | 3 | 1 | verified | **verified** |
| AC-276 | c1, c2 | race7 | 39 | 0 | 4 | 35 | partial | **unverified** (unchanged) |
| AC-277 | c0, c2 | race7 | 15 | 14 | 1 | 0 | partial | partial (after two splits) |
| AC-294 | c1 (gap only) | race7 | 0 | 0 | 0 | 0 | partial | partial (not a BOUNDARY) |
| AC-271 | c0 -> parts | web7 | 34 | 34 | 0 | 0 | partial | partial (parts 1 and 6 citable after additions) |
| AC-042 | c5 | web7 | 2 | 2 | 0 | 0 | verified | **verified** (unchanged) |
| AC-058 | c0 | pw7 | 1 | 1 | 0 | 0 | verified | **verified** (receipt: rerun) |
| AC-105 | c0 | pw7 | 2 | 2 | 0 | 0 | verified | partial until DEC-243 lands |
| AC-111 | c0 | pw7 | 1 | 1 | 0 | 0 | verified | **verified** (receipt: rerun) |
| AC-273 | c0 | pw7 | 4 | 0 | 0 | 4 | partial | unverified (unchanged) |
| **Total** | | | **159** | **99** | **20** | **40** | | |

By lane: race7 59 KEEP / 20 DROP / 36 FIX of 115; web7 34 / 0 / 0 of 34 (+2 AC-042 KEEP); pw7 4 / 0 / 4 of 8.

## 3. Classes

| Verdict:class | n | Where |
|---|---|---|
| DROP CONTROL | 13 | the holder's own command returned (race7 rows 0, 8, 13, 34, 40, 67, 74), positive or outcome controls after a release or a rollback (rows 18, 33, 60, 85, 98), the lease precondition (row 105). They pass whether or not the rule exists |
| DROP BLIND | 4 | claim.sql:98-99 (`pg_blocking_pids` read AFTER the claim finished), claim.sql:105-106 (a state read while the contender is blocked or skipped, identical with and without SKIP LOCKED), placement.sql:202 (duplicate-path count over disjoint paths), placement.sql:212-214 (identical with or without the entry lock: the unique index is the backstop) |
| DROP ADJACENT | 3 | claim.sql:109 (final states, clause 2), activation.sql:215-216 (the retry's supersession, clause 0), placement.sql:228 (a wait observation of the lock-order scenario) |
| FIX WHOLECLAIM | 32 | AC-276 c1/c2 x28 (sound evidence for CMS-03C-09/-02/-03 under clauses quantifying over 17 writer groups) and AC-273 J3-J6 x4 (single clause) |
| FIX ADJACENT (re-file) | 8 | lock-order observations filed under the wrong clause: placement :219, :230, :232 -> AC-013 c6; taxonomy :233, :232, :234, :243, :245 -> AC-019 c7 |

New class used here: **WHOLECLAIM** (refute5): sound partial evidence that the clause structure cannot credit partially.

## 4. Method notes that matter for reading the verdicts

- **Identity (race7).** I replayed the collector's own `parsePgtapTap(..., { identity: true })` over `race7-final-run.tap`: 171 results, 171 distinct identities, 0 duplicates, 0 ambiguous owners, 0 not-passed, every
  description a whole SQL string literal of its own `.sql` entrypoint (no `.sqlinc` owner, no computed title among the 115 cited). The uncited computed cleanup titles carry an empty list; a failing cleanup would surface as a
  non-passing uncited test of a cited file. All 115 proposed titles map to exactly one passed receipt. The TAP SHA-256, the manifest (569 promoted migrations, 0 WIP; every migration hash equals the file now) and the 13 test
  file hashes equal the lane's report. No proposed identity is already cited in the ledger.
- **Wait evidence (the brief's standard).** Every KEEP concurrency row rests on `pg_blocking_pids(waiter)` containing the holder's pid, polled until true, plus `pg_locks` for the waited lock type (`transactionid`,
  `advisory`), and on a third-session probe (`FOR UPDATE NOWAIT` for rows, `pg_try_advisory_xact_lock` for the lineage key) read WHILE the waiter is blocked. No sleep is evidence: the `pg_sleep` loops wait for real
  time to pass (due dates, five-minute leases, the 15 s retry delay), nothing more. Probes are shown in both polarities (`55P03` held / `00000` free) for the grant rows, the advisory key and the content-type row; the
  pattern-version row is only ever probed free (placement :218-219) - noted, not blocking.
- **Exact outcome and restore.** Every scenario asserts the loser's exact `sqlstate:message[|detail]` after the winner commits or aborts, and the unchanged stores. Each file snapshots `md5(row::text)` of every
  readable user table before the world, removes every added row with user triggers off and foreign keys deferred, re-enables both, and asserts `added_after_restore = 0` and `missing_after_restore = 0`; the final TAP's
  diag lines show `added_where=` and `missing_where=` empty in all seven files. The restore assertions are uncited by the lane; I agree (file-level fixtures guarded by the "cited files may hide nothing" rule).
- **Real producers.** The governed, taxonomy, claim and lease worlds are built by the real producers; the placement entries are the guarded direct inserts of the existing placement suite (disclosed by the
  lane). No trigger is disabled during a scenario, no row is forged, the command under test is the lock holder wherever it can be.
- **web7.** Every title tail was found in its file; the lane's JSON-reporter title list (326 tests) contains all 36 titles; none of the 69 existing ledger vitest citations in the touched files points at a missing
  title. Nine `.states.test.tsx` files and `CmsTemplateStatus.tsx` changed AFTER that list and after the first report (the web7 "Fix round", 09:34-09:36): the focus conjunct of the 403 rows and the gate heading id; the
  titles did not change. For AC-271 I rebuilt the island x state matrix from refute5's 272 verdicts and the current titles (33 refute5 titles no longer exist: the "(kept half)" retitles; the web7 rows replace them).
- **pw7.** Playwright titles are static, unique and exact (AST). The four specs are registered in both Playwright configs (root). Proof is judged from source; receipts come from root's runs
  (section 7.7).
- **Structural check.** `evaluateLedger` on the real ledger and tracker with synthetic passing receipts: baseline 0 problems, 246 verified / 47 partial / 3 unverified. See section 5.

## 5. Status changes (repository guard, synthetic passing receipts)

| Ledger | Problems | verified / partial / unverified |
|---|---|---|
| current | 0 | 246 / 47 / 3 |
| + the 59 race7 KEEP rows (AC-277 split, AC-276 left uncited) | **0** | **254 / 39 / 3** |
| + AC-058 and AC-111 (receipts exist) | 0 | 256 / 37 / 3 |
| + AC-105 (after DEC-243 and a green run) and the refile / missed rows | 0 | **257 / 36 / 3** |

Eight criteria move to `verified` on the race7 rows alone: AC-013, 019, 047, 085, 086, 145, 205, 218. AC-058 and AC-111 follow with their receipts, AC-105 with the product fix. AC-277, AC-271, AC-044 and AC-294 stay
`partial`; AC-276 and AC-273 stay `unverified`.
Structural reproductions: AC-277 as proposed (c0 and c2 cited, status partial) -> "partial entry: every clause is cited, so the entry is verified, not partial"; AC-273 as proposed (c0 cited, status partial) -> the same
problem; the split AC-277 and AC-271 with parts 1 and 6 report none.

## 6. The most serious findings

1. **AC-276 would be over-credited (rejected).** The two clauses "re-prove their capability under the locks" and "map `deadlock_detected` and a lock-acquisition failure to the 409 code of the operation's catalog ... same
   `Idempotency-Key` reusable" quantify over the 17 writer groups of clause 0. race7 proves capability re-proof for three (CMS-03C-09, -02, -03; with gaps_lock_position4_race S4b, CMS-03C-01) and a real lock failure for
   three, and only at the SQL layer: the Worker's mapping of the typed `CONFLICT` to each `*_VERSION_CONFLICT` code, which the clause names, is shown by no row. The ledger itself already ruled the equivalent CMS-03C-01 race "partly proven,
   not citable as the whole tile". Citing 39 rows under two clauses would hide 14 unproven groups behind cited clauses.
2. **The lane's AC-277 and AC-273 proposals cannot pass the guard**, and the BOUNDARY reasons are partly invalid. "locale source edit versus translation" and "related target unpublish" are specified (CMS-03C-04 source hash and
   stale transition; CMS-03C-05 pins, exclusions and target unpublish; the BE03c test list names both); the lane's reason ("needs a committed Slice 11 world that no 03c fixture builds") is work volume, which
   `boundary-not-placeholder` excludes. AC-294 "NOT BUILT (reachable)" is likewise an unfinished item, not a BOUNDARY. Valid BOUNDARIES (owner reading needed): "linked pattern update versus local override" (no override-writing
   command named), "restore-epoch fencing" and "duplicate and out-of-order events" (no 03c rule beyond the idempotent recheck job and the platform fence).
3. **Four blind assertions inside otherwise sound scenarios** (DROP BLIND): `pg_blocking_pids` evaluated after the claim finished (claim.sql:98-99), a skipped row's state read while the contender is blocked or skipped
   (claim.sql:105-106), a duplicate-path count over disjoint paths (placement.sql:202), and a P2 post-state that is identical without the entry lock (placement.sql:212-214). A fifth, in a KEEP row, is a conjunct that cannot
   fail (`lc1_blocked_by_b = false` read after the command finished, template_block.sql:101-102): the row stays because its other conjunct (two commands completed while the activation was still open) carries the proof.
4. **AC-085 closes at the accepted standard, not at the strongest one.** Live probes order {1, 3, 4} < 5 < advisory in both polarities. The order INSIDE {1, 3, 4}, the dependency-graph rows, the lineage active row and the
   `schedule` action are not observed. The siblings AC-073 c1 / AC-079 c1 are cited with source-order oracles only, so this is stronger than the standard, but a behavioural wait at position 3 and at 4 would make it complete.
5. **Competing expected revisions are never raced on placement.** P1 and P2 send the second writer with the successor `expectedVersion` (v0+1) so the CAS passes; the loser's conflict in P2 is the occupied path. IA03 533 and the
   AC-044 limitation want two writers with the SAME If-Match (loser `VERSION_MISMATCH`, no duplicate effect). The lane's remark that root may cite P1/P2 under AC-044 c1 is declined. (For AC-047 the term-action rows DO use one
   operand for both writers.) A second placement-race gap: BE03c lock-order rule 2 for CMS-03C-02 (a placement that waited on the pattern row and finds it superseded is refused `pattern_version_not_active`) has no two-session test.
6. **AC-105 fails for a product reason, and the lane's diagnosis was wrong.** Both tests failed in the first full run and again in the targeted rerun on the current bytes: the designer chooser lists no block. The pw7 lane blamed a
   test-side world problem and added a world-owned block; root's diagnosis (`ac105-diag-20261029T135422Z`, LANES.md) shows the block is registered and supported but owned by the signed release principal while
   `cms_template_context` lists only `owner_id = acting_party_id`: no organization designer can see any released block. DEC-243 (option A) fixes it; the migration (`block-owner/20261029150000`) is WIP. The spec rows are the right proof.
7. **web7 regressed two real-route rows (found by root's run, both fixed).** The "based on version N" copy broke the cited AC-042 c5 row; the A1 CapabilityGate heading took the result-heading id so a 403 moved focus off the summary
   region. Both pass in `pw-rerun-20261029T134805Z`. The second was invisible to jsdom until the fix round added a focus assertion (PAT-031 again); the other eight 403 rows pin the existing gate-heading focus with no browser
   counterpart.
8. **A cross-criterion inconsistency: "deletion".** The siblings of AC-044 c3 are cited with immutability facts (AC-041 c3 "a template version cannot be deleted", AC-047 c3 "an assignment version cannot be deleted" + "a merged id
   never reactivates", AC-281 c3 a 404). I agree with the lane (and with root's ruling in LANES.md) that BE03c has no deletion command for a pattern lineage, composition source or entry (nothing in 03b or 03c writes `deletion_pending`), so AC-044 c3 stays a
   BOUNDARY - but root must rule once for all CMS-nn "deletion" clauses: either the sibling reading (then AC-044 c3 is citable now) or the strict one (then AC-041/047/281 c3 are over-cited).
9. **Title hygiene for AC-271** (not defects of the 34 rows): refute5 rows 28 and 123 (disabled part) still carry titles that name defects fixed since ("the empty content-type prerequisite names no reason (DEFECT)", "no reason names
   the missing assign_reviewer entry (C2)"); rows 159/160 (queue degraded) carry "see DEFECT D1" although DEC-242(1) amended the cell to match them; row 96 (activation loading) says "(kept half) ... (C3)" and its body does not assert the
   Continue/Cancel lock its title names. A ledger that cites a test titled "(DEFECT)" documents the opposite of what it claims.

## 7. Rulings

### 7.1 Lock order against BE03c "Slice 12 lock order" (1504-1517)

| Writer | Positions (spec) | Observed live | Not observed |
|---|---|---|---|
| CMS-03C-02 placement (1506) | 0 entry; 1 authority (capability re-proved); 3 pattern version rows; 4 content-type version row; 5 live review rows | P3: waiting at 0, positions 1, 3, 4 free. P4: waiting at 3, positions 0 and 1 held, position 4 free. P1: waiters serialize on the entry row (`transactionid`) and the second placement takes position 2 | position 5 (the six entries have no live review); the pattern-row probe has no positive polarity in the file |
| CMS-03C-03 term action (1508) | 1 grants; (merge mutex); 3 vocabulary active row; 6 term rows | T3: waiting at 3, grants held, term row free. T4: waiting at 6, grants and active row held | merge mutex and merge itself |
| CMS-03C-09 activate (1512) | 1 grants; 3 subject (+graph, +lineage active row); 4 type versions; 5 review row; schedule row; advisory last | S2: waiting at 5, positions 1, 3, 4 held, advisory free. S3: waiting at the advisory lock, 1, 3, 4, 5 held. S1: the advisory probe is 55P03 while the loser waits | order inside {1, 3, 4}; graph rows; lineage active row; `schedule` |
| CMS-03C-19 claim (1516) | schedule rows only, `FOR UPDATE SKIP LOCKED` | C1, C2, LE1 (the expiry sweep skips an executing row) | - |
| rules 1, 2, 3, 4 (1519-1522) | capability under the lock; pinned definition superseded after a wait; revocation vs activation; typed deadlock | rule 1: -09, -02, -03; rule 2: CMS-03C-03 only (T5, taxonomy_not_active); rule 4: lock_timeout for -09, -02, -03 and a real deadlock for -09 | rule 2 for -02 and -15; rule 3 with a counted APPROVER's revocation (the lane tests the activator: rule 1); the Worker mapping of rule 4 |

### 7.2 AC-276 (all 39 rows; section 6 item 1)

Verdict per row in the JSON. The 28 WHOLECLAIM rows are sound: the revocation tests (S4a/S4b, P5a/P5b, T6a/T6b: a later revocation waits, a revocation committed first wins with `capability_missing` and nothing written) and the
lock-failure tests (S2/S5, P3, T3: `lock_timeout` and a real `deadlock_detected` become `P0001:CONFLICT`, nothing committed, the same key succeeds). The 7 ADJACENT rows are lock-order observations and are re-filed; the 4
CONTROL rows are holder preconditions. Replacement limitation in the JSON (`limitationAdvice`). If root prefers the AC-044 precedent (partial evidence cited with a limitation), the credit is the 28 rows, and the Worker mapping must
be added to c2 first.

### 7.3 AC-277 splits and BOUNDARY rulings

Verbatim splits (tiling accepted by the guard):
c0 -> `Concurrency scenarios: template activation versus block withdrawal,` | `linked pattern update versus local override,`;
c2 -> `locale source edit versus translation,` | `related target unpublish,` | `duplicate and out-of-order events,` | `worker lease expiry` | `and restore-epoch fencing each have a deterministic tested outcome.`
Rows 100-104 prove part 0 of c0 (a signed CMS-03A-08 deprecate and withdraw commit while the activation waits at the review row; the activation answers the committed `dependency_changed` refusal, review `invalidated:3`, subject `draft`,
no event, no active version). Rows 106-114 prove "worker lease expiry" (an expired-lease executor still in flight is skipped by the sweep and completes; the idle expired schedules go `failed_retryable` attempt 1; after the 15 s delay they are
re-leased; a worker presenting the replaced lease is refused `P0001:CONFLICT` with no effect; BE03b 1907-1909). The unproved parts stay uncited; the shared predicate stays with the last part, so the entry cannot reach `verified`.

### 7.4 `activation_conflict` (AC-086 c1, AC-205 c1)

S1 is a true lost race on a lineage with no active version: the loser waits for the advisory lock (lock type `advisory`, probe `55P03` on the single key helper), answers `P0001:activation_conflict`, its review/subject/decisions are
byte-identical (md5 of the row images), the audit/outbox/idempotency counts equal the winner's, and the same key later succeeds. The clauses say "409 `activation_conflict`": the 409 is the Worker's mapping
(`governed-activation-tokens.test-support.ts:145`), which the other tokens of the same sentence cite with their pgTAP rows. Add `'CMS-03C-09' SQL refusal transport maps activation_conflict (a lost race on the lineage)`
(`governed-review-ops-refusals.test.ts`) to both clauses. The variant with an active predecessor (loser waits at position 3, then meets the advisory lock) reaches the same token by another path and is not exercised.

### 7.5 AC-271 (web7 proposal rows 0-33: all 34 KEEP)

No row pins a defect; each asserts a corrected FE03 cell (read against FE03 1042-1050 as amended by DEC-242(1), DEC-241(1)-(3), DEC-242(2)-(4)). Notes on individual rows are in the JSON (title over-claims: row 0 "until a read
verifies", row 1 "polite", row 18 "no-store GET" - none changes a verdict). Row 20 has the identity of refute5 row 7 (apply once); row 21 makes refute5 row 15 (DROP) true; row 31 closes refute5 row 270.

Part rulings (the ledger already carries the eight-part split):

| Part | Clause | Citable now? | What decides it |
|---|---|---|---|
| `loading` | c1 | **yes, after two additions** | 25 rows listed in the JSON: 12 current refute5 KEEP rows, rows 258/259 (FIX -> KEEP: DEC-241(2) ratified the Cancel/Back lock), 9 web7 rows (D2, L3, L5, L7, L8, A5, B4 x3) and **`CmsTemplateDesigner.pending.test.tsx` x2**: the template create/successor loading cell has no row anywhere in the AC-271 set (that file is tagged, passing, and cited by nothing). The governed queue has no loading state (N/A, DEC-241(3)); 7 refute5 loading rows are stale (replaced) |
| `success` | c2 | no | A4 (vocabulary designer, locale form do not refetch the lists they show) and B5 (place, accept, detach, bulk refetch nothing; no browser instance-list read route) are open; web7 rows 23-25 close only the three governed forms |
| `error` | c4 | no | 409 auto-refetch is still a DEFECT in the template (both), vocabulary, pattern, related-content and bulk islands (DEC-242(3)); `reviewer_not_eligible` must refetch (DEC-242(4)); 422 reasons are not at the field for the term action, the locale form and related content; the submit form's plain 401 is untested. Closed: the 403 CapabilityGate for every island (12 rows) and `key_reserved` (rows 29-30); the locale 409 `FALLBACK_CHAIN_MISMATCH` by DEC-242(2) |
| `degraded` | c5 | no | an unknown outcome is not reconciled before a retry (template create, locale, related, accept, detach, place-new-roots, bulk; not covered for a new vocabulary), and the connected selector has no "page 1 then 503" test. Closed: detail (G-A1, row 2), the three latest reads (rows 13, 15, 17), the pattern selector (row 0). The queue's cell is now the closed notice with Retry (DEC-242(1)): refute5 rows 159/160 flip to KEEP once retitled |
| `disabled` | c6 | **yes, after retitling and one addition** | 32 rows listed: 29 current refute5 KEEP rows, web7 rows 21 and 31, and the island row `CmsGovernedReviewDetailIsland (CMS-03C-10) states why no assignment form is offered on an open review for a reader who is not the owner` (B2: the assignment's "reason names the missing `permittedNextActions` entry" is proved there). **Retitle refute5 rows 28 and 123 first** (their titles still name the fixed defects) or leave them out; row 270 is stale (replaced by row 31) |
| tail | c7 | no | "exactly as the state table states, server-authoritative, no-store and never optimistic" is asserted for no family as a whole |

AC-271 stays `partial`; the limitation replacement is in the JSON (`limitationAdvice`).

### 7.6 AC-042 c5 (web7 rows 34-35)

KEEP both. Row 35 (successor: "version 3, based on version 2") fails without the product change; row 34 (create) passes before and after. READING for root: DEC-241(5) asked for "the provenance the resource carries"; `TemplateVersionResource` has no
parent member (BE03c 920-930), so "based on version N" is the CAS-verified `expectedVersion` the form sent, not a resource member; if a server-sourced provenance is wanted, the contract would have to carry it. The cited real-route row (the only
other c5 citation) asserts the same text since root's 09:33:58 edit and passed in `pw-rerun-20261029T134805Z` (test 6/18). AC-042 was already `verified`; the rows are additive.

### 7.7 pw7

- **AC-058 / AC-111: KEEP.** Both perform the operation from the page (DEC-241(6)): AC-058 types a translation, presses "Save translation" and asserts the page's own POST (201, If-Match = the entry version, ETag = version + 1), the result heading, the
  database (`1|draft`) and a fresh load; AC-111 takes a pattern to `active` through the governed chain, finds it in the insert form's selector (paged), places it and asserts the POST, the heading, the row and the database. Both passed on the CURRENT
  bytes of the spec (SHA `ed3c39fe...`, last written 09:36:18) in `pw-rerun-20261029T134805Z`; the earlier pass in `e2e-20261029T130804Z` was on previous bytes and does not count.
- **AC-105 x2: KEEP as proof, not citable yet** (section 6 item 6): source-sound, failing today because of the product defect fixed by DEC-243.
- **AC-273 J3-J6: FIX (WHOLECLAIM).** One clause; no verbatim split yields a part they prove completely; the guard rejects `partial` with the clause cited (reproduced). They passed in `e2e-20261029T130804Z` on bytes unchanged since the lane report
  (`6903cf8b...`, `1596e059...`, `441f2520...`). Corrected limitation in the JSON. J3 drives the template journey with the second template defined, submitted, assigned and decided through the first-party API and only
  activated and retired in the browser; its identifier scan lists the second template's content hash, not the first's.

## 8. What root must do (apply by clause text, not by position)

1. Apply the 59 race7 KEEP rows: AC-013 c6 (6), AC-019 c7 (8), AC-047 c1 (5), AC-085 c1 (9), AC-086 c1 (5), AC-145 c1 (4), AC-205 c1 (4), AC-218 c3 (4); AC-277 after the two splits (14). Add the re-file rows: AC-013 c6 gets placement :219, :230, :232;
   AC-019 c7 gets taxonomy :232, :234, :243, :245 (and :233, :225, :227 as optional); AC-086 c1 and AC-205 c1 get the Worker mapping row; AC-085 c1 may add the CMS-03C-09 source-order oracle (`gaps_lock_sources.sql:65`) as supplementary.
2. Do not apply the 20 DROP rows. Do not apply AC-276 or AC-273 rows; replace their limitations (`limitationAdvice`). Replace the AC-277, AC-044 limitations as advised; keep AC-294's.
3. AC-271: cite parts `loading` and `disabled` with the lists in `partRulings` after adding the three missed rows and retitling refute5 rows 28, 123 (and, recommended, 96); apply nothing for the other parts; replace the limitation.
4. pw7: cite AC-058 and AC-111 with the receipts of `pw-rerun-20261029T134805Z`; hold AC-105 until the DEC-243 migration is promoted and both tests pass.
5. Rulings needed: the cross-criterion meaning of "deletion" (finding 8); whether a CAS-verified "based on version N" satisfies AC-042 c5 provenance (7.6); owner readings for "linked pattern update versus local override", "restore-epoch fencing"
   and "duplicate and out-of-order events"; whether partial evidence may be cited with a limitation (AC-276) or only through splits (this review: only through splits, as refute5).
6. Follow-up lanes (not BOUNDARIES): AC-294 (the three scenarios, with the roles of scenario (a) reversed: the archive command is the holder); "locale source edit versus translation" and "related target unpublish"; a placement race with two identical
   If-Match values; rule 2 for CMS-03C-02 (superseded pattern row after a wait); a wait at positions 3 and 4 of CMS-03C-09; the merge mutex and a merge race for CMS-03C-03; the two missing writer-group families of AC-276.
7. Runtime for the canonical gate (lane request 1): `race7_lease.sql` waits ~6.5 min and `race7_claim.sql` ~70 s of real time; the seven files took 471 s. They are plain pgTAP files, so `pnpm db:test` runs them; the dblink connection string
   (`host=db port=5432 ... password=postgres`) is the repository's existing precedent (`000b-activation-lock.sqlinc`, `ac265_*_concurrency.sql`, `gaps_lock_position4_race.sql`).
8. NIT: `recite7/` has more than two files and no `README.md` (the earlier `recite*/` directories have one).

## 9. Files

| File | SHA-256 |
|---|---|
| `docs/handoffs/2026-10-22-claude-s12/recite7/race7-proposals.json` (input) | `3cb93331014c6f15509e8a1b532ea18ca6fdda3889fcb44eeb99ab5961d2f71b` |
| `docs/handoffs/2026-10-22-claude-s12/recite7/web7-proposals.json` (input) | `786b0638f70e58bb01b45c3ffaebf2013e082deb82e6da04f44c24488e5c1873` |
| `docs/handoffs/2026-10-22-claude-s12/recite7/pw7-proposals.json` (input; it changed at 09:36:55 during the pw7 fix round, I read both versions; hash at the end of my review) | `5054b3dcd4da016535cf770cd1bdad858797ab12013bab9d16fbb7e05a3c2240` (first read: `f79bcf97637a573730cc23020b4414c4c9dea760713ba59290ca11e18d486b68`) |
| `docs/handoffs/2026-10-22-claude-s12/recite7/race7-final-run.tap` (input) | `7ced07bdeb039901aabd085708096521bf5aa735f71da01206099031ca0ca037` |
| `docs/handoffs/2026-10-22-claude-s12/recite7/race7-final-run.manifest` (input) | `6df2ee163314fe44a9404fe79bc27fb8a675801c671cebd49eb1a10b638d7d86` |
| `tests/e2e/phase-02-slice-12-page-operations-real-route.spec.ts` (current) | `ed3c39fe859cba88b8dd02591cf3df8d49d688b17824a0e0cca4483a8ecc1181` (the first lane report: `775a29b8...`) |
| `docs/handoffs/2026-10-22-claude-s12/recite7/refutation.json` | see the final message (18 entries, 159 citations: 99 KEEP, 20 DROP, 40 FIX) |
| `docs/handoffs/2026-10-22-claude-s12/review-refute7-report.md` | a file cannot name its own hash: it is in the final message |
