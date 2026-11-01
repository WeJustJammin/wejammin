# Review `claude_s12_refute5` - refutation of the wave-5 proposals of lanes `web6` and `gaps-pw5`

Reviewer: `claude_s12_refute5` (separate population; I wrote none of the tests, product code or proposals). 2026-10-29. Worktree
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, HEAD `cd89d54c` (gap-wave files untracked or modified).

Read: `briefs/recite5-refutation.md`, `briefs/recite3-refutation.md`, `2026-10-14-claude-s12/lane-rules.md`, `scripts/evidence/README.md` and
`ledger-guard-lib.mjs`, the current ledger `tests/contracts/phase-02-slice-12-evidence-ledger-*.ts`, `recite4/web6-proposals.json`
(SHA-256 `1d81eee151c221e9d76dd5049eab47452ad7d9bb16b4f3af0524b6383b17a4cf`), `recite4/pw5-proposals.json` (`e6b7a9a7f9d76369eb09ab5fe124e3c07d0659494590f06eba22620264fa0d71`), `lane-web6-report.md`, `lane-gaps-pw5-report.md`, every file under
`recite4/web6-probes/`, all 35 cited files (31 web6 vitest files, the four pw5 specs) with their support modules and the
product components they drive, FE03 state tables (1024-1050), command rows (1105-1140), step-up and conflict text (1220-1266), BE03c error catalog
(1408-1424) and internal operations (185-195, 1826-1830), IA03 AC-CMS-10, DEC-226 (`.memory/raw/events/2026-10-24.jsonl`), the pw5 run logs
`.lane-logs/canonical/pw5-run1-.../pw.log` and `pw5-run2-.../pw.log`, `review-refute4-report.md` and `recite4/refutation.json` (for the statuses these
rows land on).
Output: `recite5/refutation.json` (15 entries, one per proposed criterion; AC-042 is proposed by both lanes and is one merged entry) and this report.
Read-only: no supabase, docker, db, race, Vitest or Playwright run. What I executed: `node` scripts only - ledger loading, a TypeScript-AST comparison of
every proposed vitest title with the title literals of its file (including vitest's `$name` quoting, checked with `@vitest/utils` `objDisplay`), the
repository's own `evaluateLedger` on synthetic passing receipts (section 4), SHA-256 comparisons. Scratch:
`/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_refute5/`.

## 1. Verdict

**ACCEPT-WITH-DROPS (mandatory conditions).**

327 citations proposed (web6 300 in four criteria, pw5 27 in twelve; AC-042 appears in both). **284 KEEP (86.9 %), 33 DROP (10.1 %), 10 FIX (3.1 %).**
DROP is above the 5 % band, so this is not a plain ACCEPT; it is not a REJECT: the DROPs are concentrated (22 of 33 in AC-271, 6 in AC-164), they are
about clause shape and pinned defects rather than blind or mocked assertions, and 246 of the 272 AC-271 rows plus 38 others are sound per-cell proofs
(the KEEP assertions fail without the behaviour they name, within the weaknesses recorded per row).

Mandatory conditions (detail in sections 5-7):

1. **AC-271 cannot be applied as proposed.** The entry has one uncited clause (c0); citing it leaves every clause cited, and the repository guard rejects
   `partial` + limitation ("every clause is cited, so the entry is verified, not partial", reproduced with `evaluateLedger`). A verbatim split of c0 by state
   (8 parts, tiling checked) is required. Only 33 of the 246 KEEP rows are citable now (22 `idle`, 11 `empty`); the other 213 wait for their state part.
2. **Twenty AC-271 rows assert the absence of what the state table demands** (no refetch after a 409, after a success or before a retry; a 0 ms loading
   announcement; no last-verified queue; a kept stale review). 17 are DROP, 3 are FIX (readings). They are green only while the defect exists.
3. **AC-164: none of the six pw5 rows proves c3.** Three of them assert that submission stays *enabled*. c3 and c6 stay uncited (a fault seam is needed).
4. **AC-265: two proposed titles do not exist** ("an expired session ..." vs the real "a expired session ..."); no receipt can match them.
5. **AC-273 stays `unverified`.** J1 and J2 are sound partial evidence, but the entry has a single clause, so any citation forces `verified`.
6. **AC-272: apply by clause text.** web6's "clause 0" is the whole criterion text; its two diff-privacy rows belong to c0, the route-scan row to c1.
7. **Receipts**: the pw5 rows need the next real-route run; the AC-042 focus assertion was corrected by root after run 2 and has not run.
8. **Rewrite the AC-271 limitation** (the proposed text says "every other cell is cited", which is false) and correct the matrix (section 6.2).

## 2. Counts

| Criterion | clause(s) | lane | proposed | KEEP | DROP | FIX | lane status | my status |
|---|---|---|---|---|---|---|---|---|
| AC-042 | c1, c5 | web6 + pw5 | 6 | 4 | 2 | 0 | closed-clause / partial | **verified** (with refute4's 27 c12 rows) |
| AC-001 | c3 | web6 | 20 | 18 | 2 | 0 | closed-clause | **verified** (root's reading) |
| AC-271 | c0 | web6 | 272 | 246 | 22 | 4 | partial | partial (state split; 33 rows citable now) |
| AC-272 | c0 (+c1) | web6 | 4 | 2 | 1 | 1 | closed-clause | **verified** (refute4 path (a)) |
| AC-058 | c0 | pw5 | 1 | 1 | 0 | 0 | verified | **verified** (mount-level) |
| AC-075 | c8 | pw5 | 1 | 1 | 0 | 0 | verified | **verified** |
| AC-093 | c0 | pw5 | 1 | 1 | 0 | 0 | verified | **verified** |
| AC-105 | c0 | pw5 | 2 | 2 | 0 | 0 | verified | **verified** |
| AC-111 | c0 | pw5 | 1 | 1 | 0 | 0 | verified | **verified** (mount-level) |
| AC-129 | c0 | pw5 | 2 | 2 | 0 | 0 | verified | **verified** |
| AC-164 | c3 (+c6 gap) | pw5 | 6 | 0 | 6 | 0 | partial | partial (c3, c6 uncited, unchanged) |
| AC-176 | c0 | pw5 | 2 | 1 | 0 | 1 | verified | **verified** |
| AC-182 | c0 | pw5 | 1 | 1 | 0 | 0 | verified | **verified** |
| AC-265 | c2, c7, c9 | pw5 | 6 | 4 | 0 | 2 | verified | **verified** (after 2 title fixes) |
| AC-273 | c0 | pw5 | 2 | 0 | 0 | 2 | partial | unverified (unchanged) |
| **Total** | | | **327** | **284** | **33** | **10** | | |

By lane: web6 268 KEEP / 27 DROP / 5 FIX of 300; pw5 16 KEEP / 6 DROP / 5 FIX of 27.

Classes (the schema of the earlier rounds plus three new ones, defined here):

| Verdict:class | n | Where |
|---|---|---|
| DROP PINNED | 17 | AC-271 rows 4, 12, 17, 31, 38, 60, 73, 83, 86, 142, 159, 160, 180, 182, 193, 212, 213: the assertion needs the absence of what the table demands, so the product fix turns the row red. **New class.** |
| DROP ADJACENT | 9 | AC-164 x6 (commit refusals and the 404 page, not the context read); AC-042 x2 (the refusal rows prove c9, not c1); AC-271 row 165 (submit panel fed a STEP_UP_REQUIRED that CMS-03C-06 never raises) |
| DROP CONTROL | 3 | AC-001 x2 (the two "accepts the same definition without it" controls); AC-272 "reads real source files" |
| DROP PROOFGAP | 3 | AC-271 rows 15 (successor "reason is stated" asserted for create only; the product states none), 85 (titled idle, observes a read), 93 (degraded with no page to keep) |
| DROP SOURCE | 1 | AC-271 row 149 (queue loading "N/A": the proof is two `readFileSync` regexes) |
| FIX PINNED | 3 | AC-271 rows 191 (related 409, explicit-review reading), 258 and 259 (Cancel / Back locked while pending) - reading-dependent |
| FIX ADJACENT | 2 | AC-176 403 notice (belongs to c2); AC-272 route scan (belongs to c1) |
| FIX IDENTITY | 2 | AC-265 expired-session rows (wrong title) |
| FIX WHOLECLAIM | 2 | AC-273 J1, J2 (sound, but a single-clause entry can only credit the whole). **New class.** |
| FIX PROOFGAP | 1 | AC-271 row 55 (selector 409 "restarts from the first page": only the sentence is asserted) |

("IDENTITY" = a citation whose title is not the test's title; "WHOLECLAIM" = sound partial evidence that the clause structure cannot credit partially.)

## 3. Method notes that matter for reading the verdicts

- Every row was judged from the asserting lines, the fixtures and the product code the assertion exercises. For AC-271 I read all 26 files (about 6,700 lines, import blocks skipped) plus
  `composition-page.test-support.tsx` (the scripted fetch records an unscripted request as `unexpected` and throws, so an assertion `unexpected toEqual([])` *does*
  pin the absence of a refetch), `governed-command-states.test-support.tsx`, the connected-taxonomy fixtures (`settle` flushes microtasks only, no timers),
  and the product islands behind the pinned rows.
- jsdom component tests carry the PAT-031 caveat; I applied the same standard as AC-045/048 (accepted: real island, scripted wire, no mock of the rule itself).
- The 300 web6 titles: every title tail matches a title literal of its file (AST check); 280 describe prefixes match the same way and the 20 `describe.each(... $name)` prefixes follow vitest's formatTitle rule, which quotes a string property (checked with `objDisplay`) (`"template result focus: 'create designer' ..."`);
  no duplicates among the 300; no `skip`/`todo`/`only` in any of the 35 cited files. `CmsGovernedAssignmentForm.states.test.tsx` changed after the lane report
  (394 lines, SHA `a7bf5ba6...` vs the report's 399 lines `e3a927d1...`, edited 01:34:48 after the 01:30:19 report); I reviewed the current file, its 12 titles are unchanged,
  only the proposals' `descriptionLine` hints are 5 lines stale. The pw5 `template-states` spec is root's corrected version (`6a4c0be3...`, lane `73d4c083...`).
  The other 47 listed web6 files and the other pw5 specs match their reported hashes.
- pw5 titles: 25 of 27 equal the titles printed by run 2 (`pw5-run2-20261029T051459Z/pw.log`, 24 passed, 1 failed = the AC-042 focus row before root's correction); the two exceptions are the FIX IDENTITY rows.

## 4. Status changes (repository guard, synthetic passing receipts)

`evaluateLedger` on the real ledger and tracker, every cited identity given a passed receipt (it only tests the structural rules: tiling, status/limitation,
duplicates, sole proof):

| Ledger | Problems | verified / partial / unverified |
|---|---|---|
| current | 0 | 229 / 64 / 3 |
| + refute4's verdicts (AC-272 held partial, the proposal shape) | 1: `AC-272: partial entry: every clause is cited, so the entry is verified, not partial` | 237 / 56 / 3 |
| + refute4 and this review applied (AC-272 per path (a), AC-271 split, AC-164 and AC-273 unchanged) | **0** | **249 / 44 / 3** |

Twelve criteria move to `verified`: AC-001, 042, 058, 075, 093, 105, 111, 129, 176, 182, 265, 272. AC-164 stays partial (c3, c6 uncited), AC-271 stays partial
(uncited parts loading, success, error, degraded, disabled, tail), AC-273 stays unverified. The structural reproductions: AC-271 as proposed and AC-273 as proposed
both report the "every clause is cited" problem; the split AC-271 and the uncited AC-273 report none.
Conditions behind "verified": the pw5 rows need passed receipts from the next real-route run (the AC-042 focus row has never run in its corrected form);
AC-265 needs the two titles fixed; AC-042 needs refute4's 27 c12 rows applied; AC-272 needs refute4's 7 unit5 rows applied under c0.

## 5. The most serious findings

1. **AC-271 is mis-shaped, not mis-proved.** One clause carries the whole 7-state x 5-family table, and the lane's own defects make five of the seven states
   fail in at least one island. The only honest structures are (a) the state split below or (b) holding all 272 rows until the defect wave lands. With the split,
   `idle` (22 rows, all 22 islands) and `empty` (11 rows, 9 families) are fully proven and citable now; `loading`, `success`, `error`, `degraded`, `disabled` each contain an open cell.
2. **Twenty rows pin the defects.** Examples: `CmsTemplateDesigner.states.test.tsx:195-197` asserts zero GETs after a 409 (FE03 CMS-11: a 409 is reconciled by refetching the latest
   version); `CmsBulkUpdatePanel.states.test.tsx:156`, `CmsPatternInsertForm.states.test.tsx:114`, `CmsPatternUpdateDiff.states.test.tsx:196` assert `unexpected toEqual([])` after a success
   (the table: "the review, subject and lists are refetched"); five rows send the retry of an unknown outcome at once and expect success (the table: reconcile by refetch *before any retry*);
   `CmsTaxonomyFieldEditor.connected-states.test.tsx:74-85` requires the loading notice at 0 ms (the table: skeleton after 250 ms);
   `CmsGovernedReviewQueue.states.test.tsx:325-326` requires *no* rows and *no* `time` for a degraded queue (the table: last verified queue kept with `lastVerifiedAt`);
   `CmsGovernedReviewDetailIsland.states.failure.test.tsx:153-160` requires the stale review to stay on screen (the table: a review detail is re-required). Each fix of a lane defect would turn these red.
3. **The lane's matrix is wrong in five cells** (section 6.2): the review-detail degraded cell (G-A1) is a defect, not an ambiguity; the connected taxonomy selector has no idle and no proven degraded;
   the template successor states no reason for an empty content-type list; the submit panel's real 401 is untested; the term-action Cancel/Back lock is treated unlike activation's (B3).
4. **AC-164: six form-level rows were filed under a page-level clause.** c3 is about `cmsTemplateContextRead`, which the Astro pages read on the server and answer with a 303, or a
   403/429/5xx notice and no form. The rows fulfil the commit POST by `page.route`; three of them assert the commit control is *enabled* afterwards (`template-states:241-246`), the opposite of "disable submission".
   The lane's own BOUNDARY (no fault seam) is correct; citing under c3 would have hidden it behind a cited clause.
5. **AC-265 identity**: `a ${session} session` makes the real titles "a expired session ..." (run 2 prints them); the proposals say "an expired session ...". Two of four c2 rows have no receipt.
6. **AC-273**: the proposal (`partial`, c0 cited) cannot pass the guard; J1 and J2 cannot be credited in part (no verbatim split yields a part they prove completely).
7. **AC-272 proposal text**: web6's "clause 0" is the whole criterion text and matches no current clause; applying by position would put the route-scan rows under the privacy clause.
8. **AC-042**: the corrected pw5 focus assertion is untested; the pending-phase check is a negative that excludes `button`, so "focus stays" is not shown for the window in which the commit control becomes `disabled`.
9. **AC-001** is sound under root's reading; the immutability limb rests on a trigger and an existing pgTAP the new tests do not exercise.
10. Page-level pw5 tests that prove **only mounting** (plus static form state): AC-129 `/taxonomies/new`, AC-105 `/patterns/new`, AC-058, and AC-111 (the count regexp admits zero).

## 6. Rulings

### 6.1 "Consumed at /app/..." (DEC-226 rule 3): which pw5 page tests assert behaviour and which only mount

DEC-226 asks for page-level behaviour (an Astro render test or a real-route spec); the ledger limitations define the missing test as "the page mounts the island".
All eight tests open the production-built route, check status and `no-store`, wait for hydration, assert rendered content and an empty `browserErrors`; none is a hydration-only check, and all passed in run 2.
They differ in what the content depends on:

| Test (`definition-pages` spec) | Content that depends on a read or an interaction | Ruling |
|---|---|---|
| AC-129 `/taxonomies/new` (:86-103) | none: static form (editable key, enabled "Create draft", no panel, no term form) | KEEP, **mounting only** |
| AC-129 + AC-182 `/taxonomies/:id` (:105-145) | key, base version 1, version table "(1)", lifecycle: `cmsTaxonomyVersionsRead` | KEEP, consumes the read |
| AC-093 `/definition-reviews/:id` (:147-174) | subject heading, state, the *same content hash the API returned* | KEEP, consumes CMS-03C-10 |
| AC-105 `/patterns/new` (:176-192) | none: static form | KEEP, **mounting only** |
| AC-105 + AC-176 `/patterns/:key` (:194-223) | saved key, base version 1, node facts, lifecycle: `cmsPatternLatestRead` | KEEP, consumes the read |
| AC-176 403 (:225-245) | the denied branch of the loader | FIX: belongs to c2 (the 403/404 split); not "consumed" |
| AC-111 `/composition` (:247-267) | the CMS-03C-13 first page *succeeded* (the loader returns the island only then) but the count regexp admits 0 and no active pattern exists in this world; the select is disabled | KEEP, **mounting + read success; cannot tell empty from populated** |
| AC-058 `/locales/fr-FR` (:269-293) | the source text and title (entry read); not the variant read, not CMS-03C-04 | KEEP, **mounting + entry read only** |

For AC-129, AC-105 and AC-058 the clause subject is a *write* (CMS-03C-16, -12, -04); no page test saves through the form. J1 (`definition-journeys:238-261`) is the only browser
consumption of CMS-03C-16 at `/taxonomies/new` (recorded as an optional missed test on AC-129). If root means "consumed" as "used", AC-105, AC-058 and AC-111 remain mount-level.

### 6.2 AC-271 (web6 row 3)

**Structure.** `evaluateLedger` rejects the proposal (section 4). Required split of c0 (verbatim, in order, separated only by spaces and "and"; tiling checked with the guard's rule):
(0) the family list plus `idle`, (1) `loading` (a skeleton after 250 ms and only the commit control disabled), (2) `success`, (3) `empty`, (4) `error`, (5) `degraded`, (6) `disabled`, (7) "exactly as the state table
states, server-authoritative, no-store and never optimistic:". The exact strings are in the JSON (`splits[0].parts`). KEEP rows carry `splitParts`. Rows per part: idle 22, loading 19 (+2 FIX), success 21,
empty 11, error 122 (+2 FIX), degraded 19, disabled 32, dropped 22. Apply parts 0 and 3 now; hold the rest until the part's open cells close (or hold everything and cite whole c0 after the defect wave).

**Probe cross-check** (the brief's question): does any cited row claim a cell the probe shows failing?

| Defect (lane report) | Cited rows in that cell | Claims the failing half? | Pins it? |
|---|---|---|---|
| D1 selector13 degraded: submit stays enabled | 56 | no (list kept, retry offered; submit not asserted) | no |
| D2 selector17 loading: 0 ms announcement | 86, 87 | 86 asserts the 0 ms notice | **86 pinned** |
| G1 queue degraded: no last-verified queue | 159, 160 | no | **both pinned** (no rows, no `time`) |
| G-A1 detail degraded (lane: "ambiguity, not asserted") | 142 | asserts the kept review | **pinned**; cell is a defect |
| L1/L2 template latest degraded / disabled | 27, 28 | no | no |
| L3/L4, L5/L6 pattern, vocabulary loading / degraded | 197, 205, 222, 230 | no (submit state not asserted) | no |
| L7/L8 terms loading | 245 | picker half only | no |
| A1/B6 403 form-local copy instead of the CapabilityGate | 3, 11, 33, 62, 76, 177, 189, 190, 211, 236, 237, 263 | no (absence of the gate not asserted) | no |
| A2/B8 409 not refetched | 4, 12, 180, 212, 213 | no | **pinned** (GET / refresh / readLatest not called); 191 reading-pinned; 34, 35, 238 not pinned |
| A3/B7 unknown outcome not reconciled before a retry | 17, 38, 83, 182, 193 | no | **pinned** (the immediate retry is the assertion) |
| A4/B5 success refetches nothing | 31, 60, 73 | no | **pinned** (`unexpected toEqual([])`); 175, 234 not pinned |
| A5 related loading locks the rule fieldset | 186 | the helper excludes `.cms-related-rule` | no |
| A6, A7, B1, B2, B3, B4 | 5, 13, 181, 239, 266, 267; 270; 97, 114, 126; 123; 96 (helper queries input/textarea/select only); 30, 59, 72 | no | no |

So no cited row claims a failing *cell*; the problem is the opposite one: rows that assert the *defect* as expected behaviour. Rows labelled "(kept half)" that do not pin
are sound and are kept (42 "hold" rows), but they cannot be cited until their part closes, and their titles carry defect tags ("(D1)", "(DEFECT)", "(C5)") that will have to be renamed when the defect is fixed, which changes the ledger key.

**Matrix corrections** (limitation advice in the JSON replaces the proposed text, which says "every other cell is cited" and points at a handoff document):

- *G-A1 is a defect.* FE03 (Slice 12) "a review detail is re-required", the Slice 11 sibling cell "Last verified review is not kept: the read is re-required" and AC-271's last clause ("a degraded diff is never kept but re-required") use "re-required" for "not kept". The island keeps the stale review (`CmsGovernedReviewDetailIsland.tsx:111-114` renders `CmsGovernedReviewDetail` with `degradedSince` while degraded) and row 142 asserts it.
- *Connected taxonomy selector (CMS-03C-17).* It reads its first page at mount: row 85 "idle" observes a client read (a success), so idle is N/A for that island (recorded as a reading); row 93 "degraded" fails its first read, so there is no page to keep and no submit to hold: blind to both halves of the cell.
- *Template successor, empty content-type list.* `CmsTemplateEditDesigner.tsx` has no such sentence (the create designer has, `CmsTemplateDesigner.tsx:124-128`); row 15 claims it for both surfaces and asserts it only for create.
- *Submit panel 401.* Row 165 feeds `STEP_UP_REQUIRED`, which BE03c 1410 and FE03 1224 do not give CMS-03C-06 (its own title says so); the 401 it raises (plain UNAUTHENTICATED -> sign-in) is not asserted.
- *Term-action pending (rows 258-259)* asserts the exact disabled set `['Remove','Saving...','Cancel']` / `['Saving...','Back']`; the lane treats this as P "by my decision (FE03 silent)", activation's Continue/Cancel lock is defect B3. One reading must serve both.

**Readings to record, not defects of the rows**: a CLOSED (disabled-fieldset) form after success counts as "the form clears its draft" for template, pattern and vocabulary designers while decision, assignment and activation are marked K for not clearing; the queue's `loading` is N/A (server-rendered, no client read; row 149's proof is a source scan, so I do not accept it as a citation); `reviewer_not_eligible` is not refetched (row 120: FE03 884 gives it a "uniform" message and nothing changed); the stable pending label of bulk accept reads "Updates applied: request 1 of 1..." (row 30), a success-sounding label before any answer.

**Not proven by any row**: the new-vocabulary degraded cell (no id to refetch), `no-store` and `never optimistic` for every family (part 7).

### 6.3 AC-042

c1 ("focus stays until navigation or named result heading"): the two jsdom success rows (create, successor) assert the h3 result takes focus, is `tabindex -1`, sits in the polite status region, and keeps focus; they fail without the focus call or the h3.
The two refusal rows prove c9 ("focus summary/field") and are DROP for c1. The pw5 row is KEEP: it passed up to the region assertion in run 2 ("Received: inactive" on the `role=status` div, which is what a focused heading *inside* it produces);
root's corrected heading assertion is source-sound (`CmsTemplateStatus.tsx:86-98`, post-commit effect `cms-template-edit-reconcile-state.ts:95-98`) and has no receipt yet.
Weakness recorded: the pending-phase selector is `input:focus, select:focus, textarea:focus, a:focus` and excludes `button`; the commit control becomes `disabled` while pending (`CmsTemplateDesigner.tsx:169`; the successor's `disabled={cannotSubmit}` includes `writeBlocked`, set while sending, `CmsTemplateEditDesigner.tsx:56,160`, `use-template-unknown-attempt.ts:158-186`),
which can drop focus to `body` in a browser; the governed forms use `aria-disabled` for exactly this. The clause's alternative "named result heading" is proved; "stays" is shown only as a negative.
c5: KEEP. The row asserts the rendered id and version equal the intercepted response, the draft state, the "Open latest draft" link and that following it edits the saved version. Readings: "provenance" has no rendered parent version
(AC-045 c5 and AC-048 c5 are cited with state / pinned-version-in-words rows, so provenance is read as the resource facts); the CMS-11 row's "(submit for review)" is the panel of the reloaded page, reached by the link.

### 6.4 AC-164

No row proves c3 or c6; both stay uncited. The tests are sound for other clauses (AC-042 c7-c9 supplementary). The sign-in branch of c3 *is* proved at page level by the four AC-265 c2 redirect rows (the lane tagged them `[P2-S12-AC-164]`);
citing them under c3 would close the whole clause, so either split c3 by state first or name the credit in the limitation (text in the JSON). Seam for root: a fault answer for `GET /api/v1/cms/templates/context` in the real-route template port, or an extracted page loader with vitest cases (the ledger limitation's cheaper route).

### 6.5 AC-272 browser half and AC-001 against root's readings

*AC-272.* `CmsCompositionPage.diff-privacy.test.tsx` is a real sweep: sentinel base/theirs/yours values appear only inside `.cms-diff` (text), never in an attribute, title, URL, history, storage, cookie, console, BroadcastChannel/WebSocket/EventSource/beacon/Cache;
the requests are the diff GET and one POST that carries `{path, choice}`; the values are gone after accept and when another instance opens. KEEP x2 under c0. With refute4's seven unit5 rows c0 is covered at the Worker for every data class and in the browser for reason, policy basis,
assignment id and diff values: refute4's path (a) is open (cite all under c0, `verified`, empty limitation). Residuals carried from refute4 (not blocking): the 401 STEP_UP_REQUIRED detour, canonical ids in the browser sentinels, CMS-03C-09 at the Worker, the reading of "URL" for the 201 `Location`.
The route-scan file is a control (DROP) and a one-island source scan that belongs to c1 (FIX, re-file).

*AC-001.* Under root's reading (references to exact immutable block versions + a strict definition with no overriding member) the proof is sound and complete for the limbs it tests: three member names x four places refused as `unrecognized_keys` at the parent path;
422 `TEMPLATE_VALIDATION_FAILED` at the member's own JSON pointer before the port; the reference shape is exactly `{blockKey, blockVersion}`; the response schemas are closed. It agrees with IA03 AC-CMS-10 and BE03c 1828-1830. The immutability of the registered row is the trigger
`cms_block_definition_versions_immutable_guard` (`20260902080000:2173-2175`) and the pgTAP `a registered version cannot be mutated [P2-S09-AC-012]` (`phase_02_slice_09_p240_block_release.sql:165`), not exercised here (optional missed test). The two "accepts the same definition without it" controls are DROP.

### 6.6 AC-273

J1 and J2 are sound partial evidence and the lane did not over-claim in prose, but the proposal cites them under the only clause as `partial`, which the guard cannot accept. No verbatim split gives a part they prove: the object list "a template, a pattern and a vocabulary" shares one verb list
(create, submit, assign, decide (ordinary and protected), activate, schedule, retire), J1/J2 have no template, no protected decision, no pattern schedule, a pattern created and assigned through the API. Keep `unverified`; the corrected limitation names J1 and J2 as uncited partial evidence and says the 200% zoom is a 640x400 viewport.

## 7. What root must do (apply by clause text, not by position)

1. Apply the KEEP rows as follows: AC-042 web6 rows 0 and 2 under c1 and the two pw5 rows under c1 and c5; AC-001 18 rows under c3; AC-272 rows 0 and 1 under **c0** (with refute4's 7); AC-058/075/093/105/111/129/176/182 pw5 rows under their only open clause; AC-265 four rows under c2/c7/c9; AC-271: of its 246 KEEP rows only the 33 `splitParts` 0 and 3 rows now, the other 213 with their state part later.
2. Apply the FIX rows after the change: AC-176 403 row under **c2**; AC-272 route-scan row under **c1**; AC-265 expired rows with the titles in `correctedTitle` (or fix the grammar of the title template at `template-states:311` and cite the new titles); do not cite AC-273 J1/J2; AC-271 rows 55, 191, 258, 259 wait for the change named in `fix`.
3. Do not apply the 33 DROP rows. AC-164 gets no citation.
4. AC-271: split c0 into the 8 parts of `splits[0].parts`, cite parts 0 and 3, set `limitation` to `limitationAdvice`, or hold all 272 for the defect wave. Rewrite the 20 pinned rows in the same commit as the product fix that makes them wrong.
5. Replace the limitations of AC-164 and AC-273 by the `limitationAdvice` texts; clear the limitation of AC-042, 001, 272 and the eight pw5 criteria when they become `verified`.
6. Decisions needed (readings): G-A1 (is "re-required" "not kept"? my ruling: yes); Cancel/Back lock (one reading for term action and activation); idle N/A for the connected selector and loading N/A for the queue; `reviewer_not_eligible` without refetch; AC-042 c5 provenance and "next action"; whether a mount-level page test closes AC-058/105/111/129 c0.
7. Receipts: run `definition-pages`, `template-states`, `protected-decision` again under `real-route-chrome` after the harness fixes; the corrected AC-042 row is the one that matters.

## 8. Files

| File | SHA-256 |
|---|---|
| `docs/handoffs/2026-10-22-claude-s12/recite5/refutation.json` | `dca6ced493b9b8593db206cae0b5ecd1c38d77d8b47c6f88a93f701c212f6e73` (15 entries, 327 citations: 284 KEEP, 33 DROP, 10 FIX) |
| `docs/handoffs/2026-10-22-claude-s12/review-refute5-report.md` | a file cannot name its own hash: it is in the final message |
