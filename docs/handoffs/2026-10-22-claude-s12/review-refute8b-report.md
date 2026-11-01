# Review `claude_s12_refute8b` - refutation of the fix-round proposal rows of lanes `web8a` and `web8b`

Reviewer: `claude_s12_refute8b` (separate population; I wrote none of the tests, product code or proposals). 2026-10-31. Worktree
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, HEAD `85ab5ff0` plus the uncommitted wave-8 tree. Tracked files changed by this review: none
(`git status` before and after identical; my only repository file besides this report is `recite8/refutation-8b.json`).

Read: `briefs/recite8b-refutation.md`, `briefs/recite3-refutation.md`, `briefs/recite8-refutation.md`, `lane-rules.md`, `review-refute8-report.md`, the current
`recite8/refutation.json` (4 entries), `recite8/web8a-proposals.json` (51 add, 11 staleExisting) and `recite8/web8b-proposals.json` (122 add, 2 staleExisting, 26
retitled), `lane-web8a-report.md` (round 1, fix round, bundle round) and `lane-web8b-report.md` (rounds 1, fix, fix 2), DEC-241 to DEC-245
(`.memory/raw/events/2026-10-29.jsonl`, `2026-10-30.jsonl`), FE03 1039-1053, 1223 and 1839, the current ledger
(`tests/contracts/phase-02-slice-12-evidence-ledger-*.ts`, loaded with node), the test bodies of all 70 new rows and of the carried rows in the 18 files touched
after refute8 started, and the product hooks behind them (`use-registry-context.ts`, `use-template-registry.ts`, `use-composition-session.ts`,
`use-composition-page.ts`, `use-locale-save-reconcile.ts`, `use-related-list-edits.ts`).

Executed: `node` scripts (ledger loading, title resolvers, an AST test extractor); three foreground `pnpm exec vitest run ... --reporter=json` invocations (47 files: every
proposal file, every modified or untracked ledger-cited file, every refute8 file; 34 files: every other AC-271-tagged or part-ruling file; 113 files: every remaining
ledger-cited apps/web test file) = **194 files, 2,065 tests, 2,062 passed, 3 failed, 0 skipped or todo, 0 duplicated identities** (JSON in the scratch directory), single-file
repeats of the failing file, a control and eight scratch runs of Vitest through a Vite `load` plugin that serves mutated COPIES of four product files (the tree was never
edited). All 150 ledger-cited apps/web test files were run. No supabase, docker, db, race or Playwright command; no sub-agent.
Scratch: `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_refute8b/`. Every test file hashes identically before and
after its run; the 81 files of the first two runs hash identically again at the end of the review.

## 1. Verdict

**ACCEPT-WITH-DROPS (mandatory conditions).** The two product fixes root ordered are real and proven: the registry-digest 409 context refetch (DEC-245(1)) and the
composition retry hold (DEC-245(4)) are each caught by a revert-mutant (MA fails 12 new KEEP rows, MB fails 8 new KEEP rows). But the wave is not applyable as it stands:

1. **BLOCKER - a LIVE ledger citation fails today.** `CmsTaxonomyVersionDesigner.latest-states.test.tsx`: the loading, success and "empty (not-disclosed)" tests fail
   (3 of 12), in five single-file runs and in the 47-file run, none passed. The ledger cites that file twice (AC-271 c3 `empty` FAILS, c0 `idle` passes) and two more
   of its rows are in refute8's `loading` and `success` lists. Cause and one-line fix in finding 1. Until it is fixed the guard rejects the whole Slice 12 ledger
   (`scripts/evidence/README.md`: "a cited file may not hide a skip, todo, failure or duplicate"), whatever else is cited.
2. **Ten dead ledger citations in seven criteria** (refute8 found nine; AC-045 c10 is new). The map is in section 4; one replacement (the related-content "keeps the ordered pins"
   test, used by AC-284 c0 and AC-285 c0) needs a title fix first.
3. **Do not apply the 35 DROP rows or the 5 FIX rows.** 35 of the 70 new rows prove no cell (34 ADJACENT, 1 BLIND). The 35 KEEP rows are additive evidence and the proof
   of DEC-245(1) and (4).
4. **AC-271 stays `partial`.** Parts `loading`, `success` and `disabled` are citable (after condition 1); `error`, `degraded` and the closing words are not (section 5).
   Clauses 10 and 11 stay uncited (DEC-245(5)); no proposal cites them.

## 2. Counts

| Set | rows | KEEP | DROP | FIX |
|---|---|---|---|---|
| New rows (file+title not in refute8's verdicts): web8a | 15 | 14 | 1 (ADJACENT) | 0 |
| New rows: web8b | 55 | 21 | 34 (ADJACENT 33, BLIND 1) | 0 |
| **New rows, total** | **70** | **35** | **35** (ADJACENT 34, BLIND 1) | **0** |
| Carried from refute8 (same file+title, re-proposed) | 103 | 73 | 25 (BLIND 5, ADJACENT 20) | 5 (PROOFGAP 4, PINNED-title 1) |
| **All proposal rows** | **173** | **108** | **60** | **5** |

Identity: all 173 titles (51 + 122) resolve to exactly one passing test in the fresh run (0 unresolved, 0 duplicated, 0 skipped); all 13 `staleExisting` titles and all 26
`retitled` old titles are gone, and 23 of the 26 `retitled` new titles resolve as written (the other three are `%s` templates that expand per case, as the lane says). Of
refute8's 77 KEEP rows, 73 resolve and pass;
**4 are dead** (web8a rows 14 and 22, web8b rows 24 and 49) plus 2 dead PINNED rows (web8a 1 and 13); section 4.

KEEP rows by ruled part (all 108): error 41, degraded 39, success 19, loading 9. New KEEP rows by part: error 12, degraded 14, loading 9, success 0, disabled 0.

The one carried DROP PINNED row that is not rewritten (web8a idx 43) becomes FIX, because its title is now false (finding 4).

## 3. The most serious findings

1. **BLOCKER, a failing cited test.** `CmsTaxonomyVersionDesigner.latest-states.test.tsx` (SHA `58823a4d...`, unchanged since 30 Oct 02:28): "latestReadState loading: ... a
   skeleton after 250 ms", "latestReadState success: ... a 200 page is compared", "latestReadState empty (not-disclosed)" fail ("undefined is not iterable" at :156,
   `fetch` called 0 times, concealing copy absent). `readTaxonomyVersionsOnDemand` (`taxonomy-versions-on-demand.ts`, web8b fix round 1) loads
   `taxonomy-versions-read.ts` with a dynamic import; web8b fix round 2 (the cycle break, 30 Oct 04:23) removed the last static importer from this test's graph; the file
   runs under `vi.useFakeTimers()` whose `settle()` cannot wait for a real module load, so the first three tests that read lose the race and the later ones pass once the
   chunk is in. Proof of cause: a scratch config whose setup file preloads the module makes the file pass 12 of 12. Fix, test side, one line:
   `beforeAll(async () => { await import('./taxonomy-versions-read'); })`, as the sibling suites preload `taxonomy-outcome-reconcile` and web8a's five digest suites preload
   `cms-registry-read`. Both lanes reported full green runs; those predate the cycle break or never covered this order. The affected identities: AC-271 c3 (ledger),
   refute8 `loading` row "web7 row 16", refute8 `success` row "refute5 row 223".
2. **Dead ledger identities (10).** Section 4. Neither lane listed AC-008 c5 / AC-042 c8 (web8a edited `CmsTemplateDesigner.interaction.test.tsx`); AC-045 c10 appeared after
   refute8 read the file (web8b fix round 2 renamed it). Apply the map before `collect-receipts`.
3. **No rewritten row exists for the BLIND and PROOFGAP findings.** web8a 12, web8b 39-42 (and the new web8b 83) are byte-for-byte what refute8 dropped; web8a 34, web8b 91,
   98, 104 are the same four held rows. Mutants prove the BLIND class: with the unmount guard removed (MF, MG2) none of the six BLIND rows fails.
4. **A false title survives (web8a idx 43).** `CmsPatternVersionDesigner.states.test.tsx:213` still says "the registry-digest refusal reads nothing"; its body asserts only
   that the latest-VERSION read is not made, never the context read, and it passes with the DEC-245(1) fix reverted (MA). The pattern designer got its refetch rows in a sibling
   file (39-41); this row must be retitled or left out.
5. **Half of the new rows prove nothing of the criterion.** 22 "refusal asks for no list" rows (`CmsCompositionPage.no-refetch.test.tsx`) assert only the absence of an unscripted
   read, never the 401 sign-in, the 403 gate, the 422 field or the 429 wait; 7 rows are hook or pure-function units (`use-composition-session.refresh.test.tsx`), one of them blind;
   the related focus rows and the monotonic-adoption guards (locale idx 33, related idx 110) are adjacent. Tags are not proof.
6. **Open cells that keep `error` and `degraded` shut** (unchanged unless noted): the submit form's plain 401; the queue's "kept half" titles; the selector's "first page, then
   503" test. Everything else that was open in refute8 is closed or ruled (section 5).
7. **Title over-claims in rows that stay KEEP** (refute8 "weak but kept", unchanged): web8b 14 and 49 say the entry is refetched/refreshed but count the list and diff reads;
   web8b 101 says "beside the server state the 409 read by itself" but asserts the kept values. 101 is also the title chosen as the replacement of AC-284/AC-285 c0:
   retitle it before the map is applied, or the ledger carries a claim the body does not assert.
8. **Smaller:** web8b's fix round 2 file table omits `use-composition-new-roots.ts` (modified 30 Oct 03:58; 104 lines now, 101 reported); 14 web8b rows carry no `part`
   (idx 63, 73-77, 80, 81, 115-120); `recite7/web7-proposals.json` still carries four titles that no longer resolve (two in-flight N5 rows, a governed assignment success row, a
   governed detail degraded row); the two root-owned template real-route specs keep their titles but, per web8a's open item 3, the digest 409's new
   `GET /api/v1/cms/templates/context` is scripted in no Playwright spec (not run here).

## 4. Moved rows and dead identities

### 4.1 refute8 verdict rows whose title no longer exists (6)

| refute8 row | was | now |
|---|---|---|
| web8a 1 (DROP PINNED) | create designer: "the closed registry-digest 409 reads no template ..." | **rewritten**, idx 1: "... reads the designer context, not a template (there is none to compare), and keeps its fixed copy" |
| web8a 13 (DROP PINNED) | states.test, create surface "... the digest token reads nothing" | **rewritten**, idx 19 (title now "... the digest token re-reads the designer context (D2, DEC-242, V19 M2) (CMS-03C-01 create designer)") |
| web8a 14 (KEEP) | same test, successor surface | **retitled**, idx 20 |
| web8a 22 (KEEP) | locale: "an entry that moved holds the save behind the review of the current source, and keeps the translation" | **no 1:1 replacement**: it pinned the M1 defect (V19); superseded by two it.each cases that assert the opposite, idx 28 and 29 |
| web8b 24 (KEEP) | detach: "when the entry moved ... and an unreadable entry is said not to be known" | **retitled** (DEC-245(4)), idx 47 |
| web8b 49 (KEEP) | related: "a reconciling read answered 429 holds Save and Check again ..." | **retitled** (V19 m6), idx 95 |

### 4.2 Live ledger vitest citations (693 of the 2,977, in all 150 ledger-cited apps/web test files)

682 resolve and pass, **10 are dead**, **1 FAILS** (finding 1); no other citation of any apps/web file is dead or failing. All 46 AC-271 citations (c0 22, c3 11, c8 2, c9 2,
c10 6, c11 2, c12 1) resolve; 45 pass. Of the 150 files, 21 are modified or untracked by wave 8 (where all the dead identities are). The ledger's Playwright citations of the two
template real-route specs keep their titles (checked statically, specs not run); pgTAP and race citations, and vitest citations outside apps/web, are outside this check.

| Criterion, clause | File | Old title (suffix) | Replacement (same file) | Note |
|---|---|---|---|---|
| AC-008 c5; AC-042 c8 | `CmsTemplateDesigner.interaction.test.tsx` | "... across an uncertain retry" | "... across an uncertain retry, **which waits for the read of the key**" | KEEP: same assertions plus the scripted key read (fetch 3) |
| AC-045 c10 (**new**) | `CmsCompositionPage.unsaved.test.tsx` | "insert: ... says the entry could not be checked when the read fails, **and the retry is still offered**" | "insert: ... [P2-S12-AC-271] test correction (FE03 1050, DEC-245(4)): says the entry could not be checked when the read fails, **and offers no retry, only Check again**" | KEEP, and a better proof of "reconcile unknown mutation before retry"; the old title pinned what DEC-245(4) reversed |
| AC-081 c4; c6 | `CmsGovernedAssignmentForm.test.tsx` | "... for an ineligible reviewer and names the other refusals" | "... for an ineligible reviewer, **refetching the review like the other 409 reasons**, and names the other refusals" | KEEP: same sentence asserted, refetches 0 to 1 (DEC-242(4)) |
| AC-282 c0 | `CmsLocaleVariantForm.refusals.test.tsx` | "... while the outcome is unknown, and changes it with the request" | "... while the outcome is unknown **(each unknown outcome read back first)**, and changes it with the request" | KEEP |
| AC-284 c0; AC-285 c0 | `CmsRelatedContentForm.conflict.test.tsx` | "409 review, reapply and discard keeps the ordered pins, the rule and the entered bound, and offers Review changes" | "... [P2-S12-AC-271] test correction (DEC-242): keeps the ordered pins, the rule and the entered bound **beside the server state the 409 read by itself**, and offers Review changes **to read again**" | **FIX the title first**: the body (:88-106) proves the cited claim but not "beside the server state", and carries process words |
| AC-285 c0 | same file | "... reads the protected draft detail first and then the saved rule on Review changes, with no save and no mutation header" | "... [P2-S12-AC-271] test correction (DEC-242): the 409 reads the protected draft detail first and then the saved rule **by itself, with no press**, no further save and no mutation header" | KEEP (:108-131: both reads asserted, GET, no-store, same-origin, no prohibited header) |
| AC-285 c0 | `CmsRelatedContentForm.save.test.tsx` | "idempotency replays the identical request with the same key after an unknown outcome" | "idempotency [P2-S12-AC-271] test correction (FE03 1050): replays the identical request with the same key after an unknown outcome **that the reconciling read found not recorded**" | KEEP |

No ledger citation is left without a replacement. Bodies were compared with HEAD for the 76 ledger citations that sit in the 21 modified or untracked cited files: 49 are
byte-equal, 11 changed body, 10 are the dead identities above, 6 are `it.each` names (`$label`, `%s`) that cannot be matched statically and were resolved in the Vitest JSON
instead. The 11 changed ones (`CmsTemplateEditDesigner.interaction` x2 tests, cited 8 times, and the three `latest-states` "empty (not-disclosed)" rows) only dropped the
explicit "Check latest version" press (the 409 now reads by itself) and adapted the fetch counts to that read; their other assertions are equal.

## 5. AC-271 part matrix after DEC-245

Rows named by file + title in `refutation-8b.json` `partRulings` (and `rowsToCite` / `rowsReady` / `rowsAdditive`). "refute8 list" = `recite8/refutation.json` `partRulings[].rowsToCite`,
re-resolved here against the fresh run.

| Part | Clause | Cite now? | Rows | What decides it |
|---|---|---|---|---|
| `idle` | c0 | already cited | 22 | all 22 resolve and pass |
| `loading` | c1 | **yes, after finding 1** | refute8 list (25; 24 pass, 1 is the failing vocabulary read row) + **additive: web8b idx 52-60** (9 rows) | No wave-8 loading cell was open. M3 (V19) extends the lock through the post-answer reads: idx 52-59 are killed by mutant MC (8 of 9); idx 60 (bulk window) passes without the M3 hold, because the bulk panel already locks that window, and stays KEEP for the cell only. N/A by DEC-241(3): governed queue loading, connected selector idle. Still absent and non-blocking: an island row for the create designer's 250 ms key-read skeleton |
| `success` | c2 | **yes, after finding 1** | refute8 list (38; 37 pass, 1 failing: the vocabulary `latestReadState` success row) | The five new success-labelled rows (web8a idx 33, web8b idx 16, 78, 79, 110) are guards: DROP ADJACENT, none needed. N/A by DEC-244: template and pattern designers show no list |
| `empty` | c3 | already cited | 11 | 10 pass; **1 FAILS** (finding 1) |
| `error` | c4 | **no** | **new KEEP (12):** web8a idx 1; 13-18 (template registry-context, create x3 and successor x3); 19-20 (states 409, create and successor); 39-41 (pattern registry-context). Plus 29 carried KEEP rows and the missed locale 422 row | **One cell open:** the governed submit form's plain 401 UNAUTHENTICATED (sign-in; CMS-03C-06 has no step-up, FE03 1839; its only 401 test is a STEP_UP_REQUIRED the operation cannot answer): one test, or a root ruling that the AC text (which names only STEP_UP_REQUIRED) does not require it. **Closed since refute8:** DEC-245(1) digest-409 context refetch (rows above); locale 422 copy (DEC-244 4: product fixed, and `CmsLocaleVariantForm.states.test.tsx:196-209` asserts the new sentence; neither lane proposed that row - add it); **ruled closed:** NEW vocabulary 409 / unknown outcome (DEC-245(2) BOUNDARY), vocabulary designer 422 with no reason or field (DEC-245(3) BOUNDARY), term action 422 reasons (DEC-244 BOUNDARY), locale chain mismatch (DEC-242(2)). Housekeeping: retitle or drop web8a idx 43 |
| `degraded` | c5 | **no** | **new KEEP (14):** web8a idx 28, 29 (locale, DEC-244(3)); web8b idx 47, 63, 64-69 (composition holds, DEC-245(4)), 95 (related 429), 107, 108, 109 (related edit cannot lift an unreconciled save). Plus 25 carried KEEP rows | **Two mechanical items open:** the governed queue's two degraded rows still carry "kept half of the cell, see DEFECT D1" titles (retitle, then KEEP); the connected selector still has no "first page, then a 503 keeps the last page" test. **Closed since refute8:** the composition reading is now a product fix (DEC-245(4), killed by MB), the related edit hole (MD), the locale M1 (ME). **Ruled:** NEW vocabulary unknown outcome BOUNDARY (DEC-245(2)) |
| `disabled` | c6 | **yes** | refute8 list (32; all 32 resolve and pass) | no wave-8 row adds a disabled cell; four "(kept half)" titles remain (hygiene) |
| closing words | c7 | **no** | none | no-store and never-optimistic are asserted per test, never as a family property; only the registry context read asserts `cache: 'no-store'` (idx 13, 39). Unchanged |

`c10` ("409 reasons ... refetch, 422 reasons ... at the field", 6 ledger citations) and `c11` ("unknown mutation outcome ... reconciles", 2 ledger citations): **no proposal cites
them.** Both files carry one clause (index 0, "the whole table") and rows carry only a state-part label; none of the 13 staleExisting/retitled titles is one of the 8 ledger
citations. All 8 still resolve and pass; DEC-245(5) tells root to uncite them until every cell of `error` and `degraded` is proven.

## 6. The rows that prove DEC-245(1) and (4), and the revert checks

Method: a scratch Vitest config adds a Vite `load` plugin that serves a mutated copy of one product file from the scratch directory for that file's id; relative imports
still resolve in the tree; a control run with an empty map passes (58 of 58). Each mutant reverts one fix. Product file hashes equal the lanes' reports. (A first MG, removing
only `mounted.current = false`, was equivalent to the original because `sequence.current += 1` still invalidates the read, and is not reported; MG2 removes both.)

| Mutant | Reverts | Tests run | Killed | Survived |
|---|---|---|---|---|
| MA `use-registry-context.ts` | the digest-409 read never starts (DEC-245(1), V19 M2) | 5 files, 58 | **12**: reconcile idx 1; registry-context idx 13-18 and 39-41; states idx 19, 20 | web8a idx 43 (pattern states digest row) |
| MB `use-composition-session.ts` | `setUnconfirmed(null)`: no hold after an unreadable read (DEC-245(4)) | 10 files, 87 | **9**: unverified-hold idx 64-69; reconcile idx 47; unsaved idx 63; refresh idx 83 (through its setup assertion) | every other test: no old row pins the retry after an unreadable read |
| MC `use-composition-session.ts` | `hold()` pass-through (V19 M3) | 6 files, 41 | **15**: refetch-lock idx 52-59; unverified-hold idx 64-68; reconcile idx 46, 50 | refetch-lock idx 60; unverified-hold idx 69 |
| MD `use-related-list-edits.ts` | an edit lifts reconciling/uncertain (R19) | 7 files, 57 | **2**: recheck idx 107, 108 | idx 109 (the complement: the hold ends once the read verified) |
| ME `use-locale-save-reconcile.ts` | a moved entry/source holds the retry behind the review (V19 M1) | 4 files, 39 | **2**: refetch idx 28, 29 | - |
| MF `use-composition-session.ts` | the unmount cleanup never clears `mountedRef` | 3 files, 20 | 1: bulk-edges idx 9 (carried ADJACENT) | reconcile-edges idx 39-42, refresh idx 83: **all five BLIND rows pass** |
| MG2 `use-cms-template-create-reconcile.ts` | the unmount cleanup sets neither flag | 1 file, 15 | 0 | web8a idx 12: **BLIND confirmed** |

DEC-245(1): rows web8a idx 1, 13-18, 19-20, 39-41 prove it (context GET only, `cache: 'no-store'`, new choices replace the old, "Added/Removed" named, unsent values kept, hold while
reading or after a failed read, repeatable, fixed copy). Coverage: create, successor, pattern. DEC-245(4): web8b idx 47, 63, 64-69 prove it for place pattern, detach,
accept, new blocks and bulk accept, with the single page-level mechanism `busy = ... || session.holding || session.unconfirmed` (`use-composition-page.ts:74-75`) covering bulk
detach, which has no row of its own. DEC-244(3): idx 28, 29 (identical retry, same key and If-Match, never adopted).

## 7. The rewritten rows that replaced PINNED and BLIND rows (brief item 5)

| refute8 finding | Now | Asserts the FE03 cell? | Fails with the fix reverted? |
|---|---|---|---|
| PINNED web8a 1 (template create reconcile) | idx 1 | yes: the only GET is the context URL, fixed copy shown | yes (MA) |
| PINNED web8a 13 (states, create surface) | idx 19 | yes: fixed copy, one key read, then exactly one context read | yes (MA) |
| web8a 14 (KEEP, successor surface) | idx 20 | yes, same body | yes (MA) |
| PINNED web8a 32 (pattern states digest row) | idx 43, **not rewritten** | no: asserts `readLatest` 0 times; title still "reads nothing" | **no, survives MA** -> FIX (title) |
| BLIND web8a 12 (unmount) | idx 12, unchanged | no (`textContent` of an emptied container) | n/a: passes with the guard gone (MG2) |
| BLIND web8b 16-19 | idx 39-42, unchanged | no | n/a: pass with the guard gone (MF) |
| PROOFGAP web8a 26, web8b 45, 52, 58 | idx 34, 91, 98, 104, unchanged | no read is asserted | n/a |

## 8. New rows (70): verdicts

| Rows | Verdict | Why (details and line ranges in the JSON) |
|---|---|---|
| web8a idx 1, 13-18, 19-20, 39-41 (12) | KEEP error | section 6, MA |
| web8a idx 28, 29 (2) | KEEP degraded | DEC-244(3); ME |
| web8a idx 33 (1) | DROP ADJACENT | older entry version never adopted: a monotonic guard, not a cell |
| web8b idx 52-60 (9) | KEEP loading | controls lock through every post-answer read, one POST per press; MC (idx 60 survives, by design) |
| web8b idx 47, 63, 64-69 (8) | KEEP degraded | DEC-245(4); MB |
| web8b idx 95, 107, 108, 109 (4) | KEEP degraded | 429 hold of the reconciling read; an edit cannot lift an unreconciled save (MD); the hold ends when the read verified |
| web8b idx 17-38 (22) | DROP ADJACENT | refusal makes no list read: absence-only assertions, the controls of the refetch rows; idx 38 is a harness self-test |
| web8b idx 16 | DROP ADJACENT | keepRetired local exception (DEC-193); title says accept, body is a detach |
| web8b idx 78-82, 84 (6) | DROP ADJACENT | hook sequence guards, pure functions `keepRetired` and `restated`, a hook guard |
| web8b idx 83 | DROP BLIND | "a page that goes away changes nothing": nothing asserted after unmount |
| web8b idx 105, 106 | DROP ADJACENT | focus of the Check again control; no FE03 sentence |
| web8b idx 110 | DROP ADJACENT | monotonic guard; the title also claims "an equal one adopts it", not asserted |
| web8b idx 121 | DROP ADJACENT | hook-level supersede guard |

## 9. What root must do

1. Fix `CmsTaxonomyVersionDesigner.latest-states.test.tsx` (preload `./taxonomy-versions-read` in `beforeAll`); rerun it and the full `apps/web` suite once more after the cycle break.
2. Retitle at source the AC-284/AC-285 "keeps the ordered pins" test (and, if desired, the "test correction" titles) FIRST, then apply the retitle map once, before `collect-receipts`
   (a second rename would re-break the identities).
3. Apply nothing from the DROP and FIX rows. Cite parts `loading` (refute8 list), `success` and `disabled` from `partRulings`; leave `error`, `degraded`, the closing words and clauses 10
   and 11 uncited; replace the limitation with `limitationAdvice`. The new KEEP rows are additive.
4. To close `error`: a submit-form 401 test (or a ruling), the locale 422 row added, web8a idx 43 retitled or left out. To close `degraded`: retitle the queue's two rows and add the
   selector "page, then 503" test.
5. Refresh `recite7/web7-proposals.json` (four dead titles). Update the two real-route template specs for the extra context GET (root-owned).

## 10. Files

| File | SHA-256 |
|---|---|
| `recite8/web8a-proposals.json` (input) | `95da1919381f0905c94fe7e12b87519474558ec004970cb319417abd3f77ade7` |
| `recite8/web8b-proposals.json` (input) | `c19c6240a11c6d6c151cf4d93cb805a019fb9528a75375e5c2fc6fcd790b5809` |
| `recite8/refutation.json` (refute8, input) | `0444cb38a9919be3988440ad8a2d8d4edbaeb2f549eb8e9597ed7f244d6d5321` |
| `lane-web8a-report.md` / `lane-web8b-report.md` (inputs) | `439214f8cb41a7fb35f7e4981a6e4d787553a09634cfe8390c25b2be25f55312` / `0d14356238d687ce8922c6eb17a74738048aa8c27d7e67905ca549d0d8a31f5c` |
| `CmsTaxonomyVersionDesigner.latest-states.test.tsx` | `58823a4d64cca86a5acd912fb219ea63f7d5c773d1f1b0347a6d1e6cfb7c0cef` |
| `recite8/refutation-8b.json` | see the final message (8 entries: AC-271 with 173 citations and the retitle map; AC-008, 042, 045, 081, 282, 284, 285 with their replacements) |
| `review-refute8b-report.md` | a file cannot name its own hash: it is in the final message |
