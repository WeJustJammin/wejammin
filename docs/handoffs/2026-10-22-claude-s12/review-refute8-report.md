# Review `claude_s12_refute8` - refutation of the wave-8 proposals of lanes `web8a`, `web8b` and `db8`

Reviewer: `claude_s12_refute8` (separate population; I wrote none of the tests, product code or proposals). 2026-10-30. Worktree
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, HEAD `85ab5ff0` (wave-8 files modified or untracked; root's e2e / bundle-budget edits present).

Read: `briefs/recite8-refutation.md`, `briefs/recite3-refutation.md`, `2026-10-14-claude-s12/lane-rules.md`, `scripts/evidence/README.md`, `ledger-guard-lib.mjs`
(by running it), the CURRENT ledger (`tests/contracts/phase-02-slice-12-evidence-ledger-*.ts`: AC-085, AC-271, AC-277, AC-294, and every vitest citation resolved
against the final runs), the three proposal files and the three lane reports (SHA-256 in section 10), `recite5/refutation.json` (the 272 refute5 verdicts the AC-271
matrix rests on), `recite7/refutation.json` partRulings and `recite7/web7-proposals.json`, `review-refute7-report.md`, `review-v17-report.md` (N5, N7, N8), DEC-240..244
(`.memory/raw/events/2026-10-29.jsonl`, `2026-10-30.jsonl`), FE03 884, 890, 1039-1053, 1266, 2701-2713, BE03c 1500-1530 and 1814-1819, BE03b 1724-1760, the test
bodies of all 109 web rows (about 30 test files) with the product hooks behind the key rows (`use-cms-template-create*.ts`, `use-reconcile-on-outcome.ts`,
`use-locale-save-reconcile.ts`, `use-composition-session.ts`, `composition-instance-list.ts`, `governed-review-refusal.ts`), the five db8 pgTAP files in full with their
fragments (`phase_02_slice_12_race8/*.sqlinc`), the race7 harness, the final TAP and its manifest, and the migrations the db8 scenarios drive
(`20261005012100` relation target locking, `20261005011600` target visibility, `20261005017740` / `20261005017590` the publication executor and the lineage producer,
`20261005011300` assignment revocation).

Output: `recite8/refutation.json` (4 entries, one per proposed criterion, 159 citations; AC-271 is ONE merged entry for web8a and web8b, every row keeps its `lane` and
`rowIndex`) and this report. Read-only: no supabase, docker, db, race, Vitest or Playwright run. What I executed: `node` scripts only (ledger loading, a resolver of
every proposed and every ledger vitest title against the lanes' final passing JSON runs, hash checks of lane files and migrations, a replay of TAP identities against
the `.sql` sources, a scan of assertion lines removed by the test corrections, and the repository's own `evaluateLedger` on synthetic passing receipts).
Scratch: `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_refute8/`.

## 1. Verdict

**ACCEPT-WITH-DROPS (mandatory conditions).**

159 citations proposed (web8a 40, web8b 69, db8 50). **115 KEEP (72.3 %), 34 DROP (21.4 %), 10 FIX (6.3 %).** Not a plain ACCEPT: the DROP rate is far above the 5 % band, the AC-294
proposal would be over-credited by a guard that accepts it (reproduced), the wave leaves nine live ledger citations unresolvable, and AC-271 cannot be cited as a whole.
Not a REJECT: every db8 KEEP row is a live two-session observation (`pg_blocking_pids`, third-session `NOWAIT` probes) followed by the exact outcome in files that restore the
database; the web KEEP rows assert corrected FE03 cells with counted reads; the DROPs are pins, controls, blind assertions and unit tests, not mocks of the rule.

Mandatory conditions (detail in sections 6-9):

1. **Retitle nine ledger citations of six OTHER criteria before anything runs** (finding 2): wave 8 rewrote tests the ledger already cites; neither lane listed them.
2. **AC-294: do not apply as proposed.** The guard accepts the whole-clause citation as `verified` (reproduced); the "archived / unassigned between check and use" branch is undriven.
   Split c1 into the five verbatim parts in the JSON, cite parts 0, 2, 3, 4, leave part 1 (`visibility`) uncited, refile the four A6 rows to c0, keep the A3 outcome rows out (WHOLECLAIM).
3. **AC-277: apply 15 KEEP rows and 3 missed rows** to the current clauses 3 and 4 (the ledger is already split); do not apply the U3 wait rows (MODEL).
4. **AC-271: cite only the parts `loading` (25 rows), `success` (38) and `disabled` (32)** from `partRulings`; `error`, `degraded` and the closing words stay uncited. Hold the 3 PINNED and 4
   PROOFGAP rows; do not apply the 5 BLIND and 20 ADJACENT rows.
5. Rulings needed from root (section 9): the unruled BOUNDARY readings that keep `error` / `degraded` open, the composition retry policy, and the universal-versus-sample rule for the
   already-cited clauses c10 and c11.

## 2. Counts

| Criterion | clause | lane | proposed | KEEP | DROP | FIX | lane status | my status |
|---|---|---|---|---|---|---|---|---|
| AC-085 | c1 | db8 | 8 | 8 | 0 | 0 | verified | **verified** (already verified; additive) |
| AC-294 | c1 -> 5 parts (+ c0 refile) | db8 | 23 | 15 | 2 | 6 | verified | **partial** (part `visibility` uncited) |
| AC-277 | c3 "locale ...," and c4 "related target unpublish," | db8 | 19 (+3 missed) | 15 | 4 | 0 | partial | partial (two more parts cited) |
| AC-271 | parts -> loading, success, disabled | web8a | 40 | 35 | 4 | 1 | partial | partial (3 more parts citable) |
| AC-271 | idem | web8b | 69 | 42 | 24 | 3 | partial | idem |
| **Total** | | | **159** | **115** | **34** | **10** | | |

By lane: web8a 35 / 4 / 1 of 40; web8b 42 / 24 / 3 of 69; db8 38 / 6 / 6 of 50. The 10 FIX are: 4 refiles (AC-294 A6 to clause 0, they ARE cited there), 2 WHOLECLAIM (AC-294 A3, named in the
limitation), 4 PROOFGAP (`hold`, one assertion short of KEEP).

## 3. Classes

| Verdict:class | n | Where |
|---|---|---|
| DROP PINNED | 3 | web8a rows 1, 13, 32: the closed `block_registry_digest_mismatch` 409 asserts "reads nothing" (template create reconcile.test:99-118; template states.test:169-228, create surface; pattern states.test:196-227). FE03 1049 wants fixed copy AND refetch; DEC-242(3) keeps the missing refetch a defect; the assertion turns red when it is built (the refute5 rows 4, 12, 212, 213 class). `hold` |
| DROP BLIND | 6 | web8a row 12 and web8b rows 16-19 (a page that goes away: after `unmount()` the container is empty so `textContent` cannot contain anything; POST counts cannot move because no answer path sends a POST); db8 A1 positions row (the position-2 half probes a create that names NO relation target) |
| DROP ADJACENT | 21 | web8b: bulk sequencing edges (3), `readInstanceList` helper (3), new-roots hook guards (2), governed re-read focus rows V17 N7 (3), `classifyGovernedRefusal` unit (1), `recordedSave` / `reconcileSave` helpers (2), `useRelatedContentForm` guards (4), related page-gone (1), idempotency-key rotation (1); db8 U3 source-row lock order (1). The lanes tagged every test `[P2-S12-AC-271]`; the tag is not proof |
| DROP CONTROL | 2 | db8 A1 "the activation committed" and U1 "the unpublish commits as a tombstone": the holder's own commit |
| DROP MODEL | 2 | db8 U3 "curation blocked BY the unpublishing writer" and "nothing stored while waiting": the wait exists only because the holder takes the target entry row `FOR UPDATE` by hand (section 7.2) |
| FIX PROOFGAP | 4 | web8a row 26 (locale failed refetch), web8b rows 45, 52, 58 (related automatic read fails; related refetch unverifiable; related offline): one assertion that the read was attempted is missing, each passes without the rule. `hold` |
| FIX WHOLECLAIM | 2 | db8 A3 outcome and effect: sound, but they prove the PIN branch of the uncited part `visibility` |
| FIX ADJACENT (refile) | 4 | db8 A6 ascending order: clause 0 content filed under clause 1 |

## 4. Method notes that matter for reading the verdicts

- **Identity (web).** Every one of the 109 proposed titles resolves to exactly one passing test in the lanes' final JSON runs (`claude_s12_web8a/vitest-final.json`, 128 files; `claude_s12_web8b/run2.json`,
  122 files; `full.json`, 787 files / 8,957 tests, all passed). The hashes of every file the lane reports list equal the files now (0 of 122 differ), so the runs describe the current bytes. None of the 109
  identities is already cited. The 13 `staleExisting` titles no longer exist (correct), and none is cited in the ledger except web8a's untagged AC-282 row (finding 2).
- **Identity (db8).** I replayed the TAP: 5 files, 101 tests, 0 not ok, no description used twice in a file; all 50 proposed titles map to exactly ONE passing test and ONE whole SQL string literal
  of their own `.sql` entrypoint (no `.sqlinc` owner, no computed title), and the lane's `descriptionLine` equals the source line for every row. The TAP SHA-256 equals the lane's, the manifest
  (570 promoted migrations, 0 WIP) hashes equal the files now, the five test files equal the lane report. Every uncited test of a cited file is `ok`.
- **Wait evidence (the brief's standard).** Every db8 KEEP wait row rests on `pg_blocking_pids(waiter)` containing the holder's pid, polled up to 20 s, plus third-session `FOR UPDATE NOWAIT` probes read WHILE
  the waiter is blocked (`55P03` held, `00000` free). Caveat I checked: `NOWAIT` on zero rows also reads `00000`, so a "free" reading is only meaningful with a valid id; the ids are the harness
  notes, and the same probe forms read `55P03` positively elsewhere in the same file (W3, W3b, W4, D2) or in refute7's race7 activation rows S2/S3 (review row, advisory key).
- **Passing the rule or not.** For every KEEP I asked what the assertion does when the rule is removed. Where the answer is "nothing" the row is BLIND / PROOFGAP.
  A scan of the assertion lines the test corrections removed (36 modified tracked test files) found 16 lines, all deliberate (the "not refetched" pins the wave turned into reads; variable renames);
  no silent weakening.
- **Guard simulation** (`evaluateLedger`, synthetic passing receipts): baseline 0 problems, 257 verified / 36 partial / 3 unverified. With every ruling applied (AC-085 +8, AC-294 split and parts, AC-277 +18,
  AC-271 parts 1, 2, 6) still 0 problems and 257 / 36 / 3: no criterion changes status, uncited clauses shrink (AC-271 6 -> 3 of the 8 parts, AC-277 5 -> 3, AC-294 1 of 5 parts).
  The lane's AC-294 as proposed (c1 whole, `verified`) is also accepted with 0 problems: the over-credit is invisible to the guard.

## 5. Status changes

| Criterion | now | after | change |
|---|---|---|---|
| AC-085 | verified | verified | +8 rows, closes refute7 finding 4 (behavioural waits at positions 1, 3, 3b, 4) |
| AC-294 | partial | partial | c1 split in 5 parts: parts 0, 2, 3, 4 cited (14 rows) + 4 rows refiled to c0; part 1 `visibility` uncited |
| AC-277 | partial | partial | clauses 3 (9 + 2 rows) and 4 (6 + 1 rows) cited; clauses 1, 5, 7 stay open (owner readings) |
| AC-271 | partial | partial | parts loading, success, disabled cited; error, degraded, closing words open |

Totals unchanged by the guard: 257 / 36 / 3. Nothing becomes `verified` in this wave; what changes is how much of the three `partial` entries is proven.

## 6. The most serious findings

1. **AC-294 would be over-credited, and the guard cannot see it.** The lane files all 23 rows under the whole clause c1 and proposes `verified`. c1 names "authority/visibility ... rechecked after waits". BE03b rule 2
   makes the visibility recheck cover "a target bumped, ARCHIVED or UNASSIGNED between check and use". The bump is tested (A3); the other two are not: no BE03b / BE03c command archives an entry (nothing sets
   `lifecycle = 'archived'`), and an assignment is revoked only as a side effect of an authority revocation (`20261005011300`, DEC-143). Root's round-2 rule is a split with the unreachable part uncited, never
   verified-with-caveat. My split is minimal and verbatim (tiling checked by `evaluateLedger`): `Deterministic concurrent tests prove authority/` | `visibility` | `and exact schema/default are rechecked after waits,` |
   `with no invisible/foreign definition lock lever` | `or late position-2 acquisition.` Correction to the lane's BOUNDARY: **"unassigned" IS reachable through a real command**. Because a grant revocation revokes the
   person's assignments in the same transaction, a create whose own capability is `cms.author` and whose relation target is backed only by a `cms.editor` assignment can be raced against the revocation of the editor
   grant (the A4 mechanism): the create waits at position 2, the target becomes invisible, the second loop of `cms_resolve_relation_targets` must refuse it uniformly. That is a missed test, not a BOUNDARY. "Archived" has no
   writer and stays one.
2. **Nine live ledger citations of six other criteria are dead after wave 8.** The corrections retitled tests the ledger already cites (AC-008 c5, AC-042 c8, AC-081 c4 and c6, AC-282 c0, AC-284 c0, AC-285 c0 x3);
   the guard would report their receipts missing. Old -> current (same file) is in `refutation.json` AC-271 `missedGaps`: the template interaction test now ends ", which waits for the read of the key"; the assignment test
   "... for an ineligible reviewer, refetching the review like the other 409 reasons, and names the other refusals"; the locale refusals test "... while the outcome is unknown (each unknown outcome read back first), and
   changes it ..."; and the three related-content tests are now the "[P2-S12-AC-271] test correction" titles. Retitle BEFORE the collector runs. `recite7/web7-proposals.json` also has 4 rows that no longer resolve
   (rows 34, 35 = web8b V17 N5; rows 42, 43 = V17 N8; web8b names only the first two).
3. **The unpublish stand-in is wrong about the production writer, and U3's wait is an artifact.** The lane says "no `platform_api` unpublish command exists". It does: CMS-03B-07 schedules an unpublish / expire /
   archive and CMS-03B-20 `platform_api.cms_execute_publication_schedule` (`20261005017740`) applies it through the same `cms_append_publication_lineage` the stand-in calls. That executor takes the target ENTRY
   ROW `FOR SHARE` (position 0, lines 153-155), which does not conflict with the curation's `FOR SHARE` at position 2: with the real writer the curation never waits at the target. U3 takes the entry row `FOR UPDATE`
   by hand (`race8_related.sql:57-59`), so rows 45 and 47 describe an interleaving that cannot occur (DROP MODEL). U1 is faithful (section 7.2); the end-states of U3 hold for the real order "unpublish committed, then
   curation".
4. **The lane's own generator dropped the scenario outcomes.** `gen_proposals.py` excludes every title starting "once the" as a control. Four of those are the outcomes: locale E1 and E2 "answers the typed 409
   VERSION_MISMATCH", related U3 "the curation proceeds and commits the pin", related U1 "the public projection no longer lists the target". Three are added as `missedTests`; the U1 projection row needs a non-empty
   guard first (U3's twin has one) and is a `missedGaps` item because the apply script adds `missedTests` blindly.
5. **AC-271: three parts close, three stay open** (section 7.1). The open cells that keep `error` and `degraded` shut are mostly BOUNDARY readings root has not made (new vocabulary, registry-digest 409,
   vocabulary 422) plus mechanical items (queue retitle, selector test, locale copy).
6. **Three tests pin the absence of a refetch FE03 requires** (the digest 409 rows). They are the refute5 PINNED class; the plain-409 half of the same tests is sound and cited through other rows.
7. **Ten assertions pass without the rule.** The unmount test asserts `container.textContent` after the root is gone (web8a row 12; web8b 16-19 count POSTs that no code path can send); four "the automatic read fails" /
   "the refetch cannot be verified" rows assert only what the pre-wave form already showed (no call is asserted); A1's position-2 probe names no target. Each is one line from sound (`fix` in the JSON).
8. **A policy inconsistency between islands.** The template, locale and related islands hold the retry until a reconciling read verifies; DEC-244(4) accepts related "Check again" as "the only non-dead-end way to keep
   reconciled before any retry". The composition islands (accept, detach, place-new-roots, bulk) offer the same-key retry after a read that FAILED, and web8b row 24 pins it. Root must pick one rule (the retry is idempotent,
   so it is safe either way).
9. **Already-cited clauses c10 and c11 contradict the `error` and `degraded` rulings.** c10 ("409 reasons render fixed copy and refetch, 422 reasons render fixed copy at the field") is cited by 6 rows and c11 ("an unknown
   mutation outcome renders pending and reconciles ... before any retry") by 2 governed-form rows. Both are universal over the command islands; with the open cells of section 7.1 they are not proven for every island.
   Either the clause tiling is a SAMPLE claim (then `error` and `degraded` could be cited from samples too) or it is UNIVERSAL (then c10 and c11 must be uncited until the cells close). This predates wave 8 but wave 8
   makes it visible. I read them as universal, the standard refute5 and refute7 applied to the state parts (every island); neither reviewed c10 and c11 themselves, so this is my reading for root to confirm.
10. **Twenty-one proposed tests are not cells of the criterion they are filed under** (20 of AC-271, 1 of AC-277). Unit tests of helpers, hook guards, focus / announcement rows (V17 N7: FE03 says "focus moves to the heading on navigation only" and "has no sentence for this control"),
    bulk sequencing and cancellation robustness belong to other criteria.
11. **Smaller:** `composition-page.test-support.tsx` now answers an unscripted instance-list read with 503 and records it in `lists`, so `unexpected` no longer covers that read; `reconcileUnknown` issues the list read after
    an unmount (`use-composition-session.ts:117`, row 16 pins it while its title says "sends nothing more"); titles with "test correction (DEC-242)" document a process, and web8b C1 claims a server state its body does not assert;
    `recite8/` has more than two files and no `README.md` (the earlier `recite*/` directories have one).

## 7. Rulings

### 7.1 AC-271 per part (ledger clauses 0-7; merging web7's refute7 KEEP rows, refute5's surviving KEEP rows and the wave-8 KEEP rows)

| Part | Clause | Citable now? | Rows | What decides it |
|---|---|---|---|---|
| `idle` | c0 | already cited | 22 | unchanged; all 22 ledger citations still resolve |
| `loading` | c1 | **yes** | 25 | refute7's list with two titles replaced (activation: the "(kept half) ... (C3)" title is gone, current "Continue and Cancel stay aria-disabled ... (DEC-241 item 2)"; bulk: web7 round 2 retitled it) plus its additions (CmsTemplateDesigner.pending x2, term pending x2 under DEC-241(2)). N/A by DEC-241(3): governed queue loading, connected selector idle. Wave 8 changes no loading cell (its pending / checking labels are degraded cells). Recommended, non-blocking: the create designer is now a second host of `cmsTemplateLatestRead`; no ISLAND row asserts the 250 ms skeleton for it, but the shared `CmsTemplateLatestCheck` has a direct 249 / 250 ms test (`CmsLatestReadLoading.test.tsx`, untagged), `CmsLoadingRegion` is the one implementation, and the island only wires `checking` (`CmsTemplateDesigner.tsx:78`); a one-row island test would close the wiring |
| `success` | c2 | **yes** | 38 | every island has a current success row: the six wave-8 islands by KEEP rows (vocabulary 4, locale 4, related 1, place 1, accept/detach 1, bulk 1, list refetch 3, production wire 1, two new blocks 1, selection 2), governed forms by web7 rows 23-25, the rest by 16 surviving refute5 rows. N/A by DEC-244: template and pattern designers show no list. Closes refute7's A4 and B5 |
| `empty` | c3 | already cited | 11 | unchanged |
| `error` | c4 | **no** | KEEP rows ready: web8a 13, web8b 17 | open: (1) locale 422 copy (DEC-244 / DEC-230: must say the locale is not supported for the content type; the form still says "Check each value against the limit shown beside its field", pinned at states.test:196-208); (2) the registry-digest 409 of the template create designer and the pattern designer refetches no context (web8a BOUNDARY 3, unruled); (3) a NEW vocabulary's 409 has no id / key to read (BOUNDARY 2, unruled); (4) the vocabulary designer's 422 names no reason and no field (unruled; DEC-244 rules only the TERM action's 422 reasons summary-level BOUNDARY); (5) the submit form's plain 401 untested. Closed: 409 refetch for template create / successor, vocabulary, pattern, related, bulk, place, accept, detach, new blocks, `reviewer_not_eligible`; 403 gate and `key_reserved` |
| `degraded` | c5 | **no** | KEEP rows ready: web8a 14, web8b 14 | open: (1) the governed queue's two degraded rows (refute5 159, 160) assert the DEC-242(1) reading but still carry "(kept half of the cell, see DEFECT D1)" titles: retitle and they are KEEP; today the queue has NO citable degraded row; (2) the connected selector has no "first page, then 503 keeps the last page" test; (3) a NEW vocabulary's unknown outcome cannot be read back (unruled); (4) READING: composition retry after a failed read (finding 8). Closed: unknown outcome read before any retry for template create / successor, locale, related, place-new-roots, accept, detach, bulk |
| `disabled` | c6 | **yes** | 32 | refute7's 32 with its B2 island row replaced by the current-title web7 row 47; web8 adds no disabled cell. Hygiene: four cited titles still say "(kept half)" (bulk, insert, update diff, submit); they name the permittedNextActions half the island cannot have |
| closing words | c7 | **no** | - | unchanged: no-store and never-optimistic are asserted for no family as a whole; wave 8 adds three reads (key read, instance list, rule / draft pair) and asserts no-store for the related pair only (web8b C2) |

`partRulings` in the JSON carries the row lists with the current titles and each row's source. Web7 rows 34-47 of `web7-proposals.json` (added after refute7's file) are outside this review and not used.

### 7.2 db8

**AC-085 c1 (8 KEEP).** W1 (position 1), W3 (subject row), W3b (the lineage's ACTIVE row, taken after the subject), W4 (content type version row): each a wait observed BY the raw holder plus a third-session probe of
the other positions while the REAL `cms_activate_governed_subject` is blocked. Together with refute7's AC-085 KEEP rows (race7 activation S2/S3) they order 1 < 3 (subject, then active row) < 4 < 5 < advisory behaviourally. Residual gaps (dependency graph
beyond the type row, the `schedule` action, the order inside position 1) do not block: AC-085 is already verified.

**A5, concealed versus absent.** The concealed create (a raw holder owns the target's entry row `FOR UPDATE`) answers `P0001:VALIDATION_FAILED|["/fields/<relation>"]` inside an 8 s window, and the absent-id create returns exactly
the same string; both strings are built by the same `sqlstate:message|detail` formatter, so SQLSTATE, message and DETAIL are identical and the Worker mapping follows. `cms_resolve_relation_targets` decides visibility
before the lock (`20261005012100:405-420`), so a lock-first regression would TIME OUT (row 12 fails). Weakness, not a defect: the "concealed" target is the owner's own entry of ANOTHER content type, hidden by the
`type_key` conjunct of `cms_relation_target_visible`; an unassigned or other-party target is the stronger fixture (and with finding 1's missed test both are covered). Rows 12-14 are KEEP under part 3 and contingent
on a reading (section 9): the clause says "invisible/foreign **definition**", BE03b rule 2 is about relation TARGETS, and a foreign default template cannot be stored (AC-289's BOUNDARY).

**D2, the single assertion.** `d2_pos2_before || '/' || d2_pos2 = '00000/55P03'`: the target entry row is free before the create is sent and held by the create while it waits. That is adequate for one claim only: position 2
precedes the blocking position. It cannot place the wait at 3 versus 4, because the real retire also owns the bound content type version row (the file's own diag: `d2_pos4_before=55P03`); the title of the wait row ("the position 3
lock") over-claims. 3 before 4 is carried by c0's EDTL-B. With A3 (3 and 4 free while waiting at 2) it closes "no late position-2 acquisition". Not exercised: a SUPERSEDED default accepted after a wait.

**The unpublish model** (finding 3), the four seam points: (a) the stand-in replaces only the OTHER party of the race (the unpublisher); the command under test, `cms_curate_related_content`, is real; (b) its conflict
footprint with the curation equals the production writer's for U1: the executor holds the target entry row `FOR SHARE`, authority `FOR SHARE`, the schedule's review and schedule row `FOR UPDATE` and the same lineage advisory lock,
and the curation (source entry `FOR UPDATE`, target entries `FOR SHARE`) waits for none of them; (c) the added rows are removed and asserted (`added_after_restore` 0); (d) the behaviour asserted is the curation's. U1 is
therefore a faithful model of "an unpublish in flight" and rows 40-42, 44 are KEEP; U3's hand-made `FOR UPDATE` is not a footprint of any unpublish writer (DROP MODEL), but its end-state rows 48, 49 and the missed commit row
describe the order "unpublish committed, then curation" and hold.

**AC-277.** Clause 3 "locale source edit versus translation,": E1 and E2 are two REAL commands, each order, the loser's typed `VERSION_MISMATCH` (missed rows), nothing written, the retry converging, the honest stale row with its
field ids and its own event: 9 KEEP + 2 missed. Clause 4 "related target unpublish,": 6 KEEP + 1 missed. The U1 "projection no longer lists the target" row needs `and u1_projection_after <> ''` before it is cited. Clauses 1, 5, 7
(override writer, duplicate / out-of-order events, restore-epoch fencing) stay BOUNDARY readings for the owner, unchanged from refute7.

**AC-294.** Parts: 0 `authority/` <- A4 (3 rows: wait, FORBIDDEN after the wait, nothing written); 1 `visibility` <- none; 2 `exact schema/default ...` <- A1 (3 rows) and D2 (3 rows); 3 `invisible/foreign definition lock lever`
<- A5 (3 rows, contingent); 4 `late position-2 acquisition` <- A3 wait and free probes (2) and D2 position 2 (1). A6 (4 rows) goes to c0, where "ascending target UUID order" had only a source-order row and two race-module rows.

### 7.3 Web rows

- **Sound and discriminating (KEEP 77):** the three template reconciliation hooks (create key read: 404 = nothing saved, version 1 of the attempt = created, another definition shown, no retry before a verified read, 429 hold; successor:
  automatic 409 and unknown read), the locale form (read after an unknown outcome, after a success, moved source proposed never adopted), the pattern and vocabulary 409 reads and the versions-table refetch, the related-content form
  (draft then rule read by itself, pending label, identical retry under the same key, 429 hold, success refetch, admission of native submits), the composition islands (list refetch after success and 409, unknown outcome
  pending until entry AND list are read, bulk 409 counts of every refetch, selection survives completion, production wire without a test seam) and `reviewer_not_eligible` (one uniform sentence at the field plus a counted refetch).
- **Mixed titles:** `CmsTemplateDesigner.states` 409 and the pattern `states` 409 `it.each` cover the version conflict (KEEP) and the digest token (PINNED) in one test body: the successor surface of the former and the conflict row of the
  latter are KEEP, the create surface and the digest row are DROP.
- **Weak but kept:** web8b C1 (title claims a server state it does not assert; the refetch is proven by rows 44 and 56), the bulk 409 rows whose title says "refreshes the entry" while only the list refetch is counted (row 6, 14),
  the "(kept half)" and "test correction" title hygiene.

### 7.4 Seams

No AC-143 row is in this wave. The only labelled stand-ins are db8's: the unpublish by the lineage producer (ruled above), raw lock holders (the established technique of race7) and A4's raw grant `UPDATE` (the precedent of
race7 S4b; the real revocation command also ends tenure, so it models the grant effect only). The web seams are injected readers (`refresh`, `readLatest`, `readVersions`) used by every earlier wave; the pattern, vocabulary
and locale automatic reads are proven through them (the default readers are the ones the explicit control already used), while the template reads and the composition list / entry reads are proven through the global fetch
(web8b rows 20, 21 are the production-wire pair).

## 8. What root must do (apply by clause text, not by position)

1. Run the nine retitles of finding 2 (and refresh `recite7/web7-proposals.json` rows 34, 35, 42, 43) before `collect-receipts`.
2. AC-085: add the 8 KEEP rows to c1.
3. AC-294: split c1 into the five parts of `splits[0]` (the guard tiles them), cite parts 0, 2, 3, 4 with their rows (`splitParts`), refile the 4 `refile:P2-S12-AC-294:0` rows to c0, do not cite the 2 WHOLECLAIM rows, replace the
   limitation with `limitationAdvice`. Drop rows 12-14 from part 3 if root reads "definition" strictly.
4. AC-277: add the 9 locale rows and the 2 missed locale rows to clause 3, the 6 KEEP rows and the missed commit row to clause 4; replace the limitation. `splits` is empty on purpose: re-running apply7's split logic would fail.
5. AC-271: cite `partRulings` 1, 2 and 6 (95 rows in all), nothing for the others; replace the limitation with `limitationAdvice`. Do not apply the `hold` rows or the DROP rows. Before citing, optionally retitle the four "(kept half)" disabled
   rows and the "test correction" titles.
6. Follow-ups (not BOUNDARIES): the real-revocation test for "unassigned" (finding 1); re-point U1 / U3 at the CMS-03B-20 executor; add `<> ''` to the U1 projection row; the one-line assertions of the four PROOFGAP rows; a create-designer
   key-read loading row (wiring only); the queue retitle and the selector "page then 503" test; the locale 422 copy (DEC-244).

## 9. Rulings needed from root

1. Registry-digest 409 of the template create designer and the pattern designer: build a context refetch, or rule the refetch N/A for this reason (then the three PINNED rows become KEEP).
2. A NEW vocabulary: rule its 409 and unknown outcome BOUNDARY (no read by key) or add a read by key.
3. The vocabulary designer's 422 (no reason, no field): the same BOUNDARY as the term action's (DEC-244), or not.
4. Composition retry after an unreadable reconciling read (finding 8): hold it like the other islands, or accept it and say the cell means "read attempted".
5. Already-cited universal clauses c10 and c11 (finding 9): universal (uncite until the cells close) or sample (then cite `error` and `degraded` from samples as well).
6. AC-294: does "invisible/foreign definition lock lever" cover the relation-target lever (cite part 3 with A5) or only the default template (leave part 3 uncited, and for consistency with AC-289 split "foreign definition")? And is
   "archived" out of scope for `visibility`, or does the part stay open until an archive writer exists?
7. Whether a stand-in unpublish (producer call) is acceptable evidence for "related target unpublish" or the CMS-03B-20 executor must be driven.

## 10. Files

| File | SHA-256 |
|---|---|
| `recite8/web8a-proposals.json` (input) | `f9fbbd5ab36dfafec851ec1093623cd4cba967974e25869075766418b1d196dc` |
| `recite8/web8b-proposals.json` (input) | `aec79773df8c457badec7b981f4b27f82170fc36d61aabc5b4b7b8e9108fdcf2` |
| `recite8/db8-proposals.json` (input) | `1f086053b0622206b853639c840e617f82945d4189158706c223dad74ed5df91` |
| `recite8/db8-race8-final-run.tap` (input) | `a96eddf6236d57fbbfd8a8c0c455a588ba154785bfe6480476a6515e96358508` |
| `recite8/db8-race8-final-run.manifest` (input) | `7e992cfe261b9fc3187c98ba25314804d266b57ae0c744474e5d8cc01d46067b` |
| `lane-web8a-report.md` / `lane-web8b-report.md` / `lane-db8-report.md` (inputs) | `6745cfa4ec30...` / `6376b3ebb53f...` / `780db95575b9...` (equal to the hashes in LANES.md) |
| `recite7/refutation.json` / `recite7/web7-proposals.json` / `recite5/refutation.json` (inputs) | `c92d2a2c29dc...` / `caef3985c53b...` / `dca6ced493b9...` |
| `recite8/refutation.json` | see the final message (4 entries, 159 citations: 115 KEEP, 34 DROP, 10 FIX) |
| `review-refute8-report.md` | a file cannot name its own hash: it is in the final message |
