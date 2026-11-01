# Review V17: lane web7 product changes (FE03 state table, AC-271 and the DEC-241 web items)

Reviewer V17, a separate population from lane web7. Read-only except this file. Brief: `briefs/review-v17-web7.md`; lane rules read in full.

## Verdict

**ACCEPT-WITH-CONDITIONS.** Counts: BLOCKER 0, MAJOR 3, MINOR 5, NIT 5. (First-round verdict. Lane web7's "Fix round 2" answered it; the "Verification round" at the end of this file records which findings are now met, the new findings and the current verdict.)

About 80% of the work is sound: every cell fix below was reverted file by file and by targeted mutation, and each revert is killed by a test the lane wrote or rewrote (survivors are listed in section 5). Three MAJOR defects are regressions that the lane's own fixes introduced (B4 and A5 enable controls while a command is pending, and the code does not cope with what the author then does). I reproduced each one with a failing test and confirmed against the HEAD product that the defect did not exist before web7. Do not commit the B4 hunks (composition island: insert fields, diff answers, Review enabling) or the A5 hunks (`CmsRelatedRuleFields.tsx`, `CmsRelatedContentForm.tsx`) as they stand. Everything else may be committed once the MINOR items in section 3 are accepted or handled by root.

Conditions (section 8): C1 fix M1 to M3 with RED tests first (seeds in Appendix B) or carve those hunks out and re-open the cells; C2 refresh the lane report hashes after the 13:34 to 13:36 UTC edits; C3 close the coverage and mutation gaps of m4; C4 retitle the stale rows and the README text of m5; C5 run the real-route specs and the bundle check of section 7.

## 1. State reviewed, and drift during the review

- Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, HEAD `4f643787fa5ab300d953cd4b4ddbc2b6152d01a3`, dirty tree. 83 files under `apps/web` (79 modified, 4 new: `pattern-status-copy.ts`, `CmsTaxonomyTermListNotices.tsx`, `term-form-defaults.ts`, `use-term-action-focus.ts`).
- At about 13:19 UTC all 84 rows of the SHA-256 table in `lane-web7-report.md` matched the tree (hash and line count), and the set of changed files under `apps`, `packages` and `.memory/wiki` equalled the report's list plus the root FE03 amendment (DEC-242).
- **The tree then changed under me.** Between 13:34:34 and 13:36:12 UTC ten files were edited by someone other than me: nine `*.states.test.tsx` files (Bulk, InsertForm, UpdateDiff, TemplateDesigner, LocaleVariantForm, PatternVersionDesigner, RelatedContentForm, TaxonomyVersionDesigner, TaxonomyTermForm) gained a focus assertion on the 403 gate rows, and `CmsTemplateStatus.tsx` changed its gate from `headingId={CMS_TEMPLATE_RESULT_HEADING_ID}` plus `focusable` to the private id `cms-template-gate-heading`, not focusable. I reviewed that later state. The manifest I fixed at 13:40:35 UTC is Appendix A, and the 83 files were unchanged when I finished. **The report's hash table is therefore stale for those ten files** (condition C2).
- The edit was necessary. I re-created the earlier gate (result-heading id plus `focusable`) in a scratch copy: the current 403 rows then fail (`expected <h2> to be <div role=alert>`). The real-route row `phase-02-slice-12-template-states-real-route.spec.ts:207,230` (the 401/403/503 loop) asserts `getByRole('alert')` `toBeFocused()` for a 403, so the originally delivered gate would have failed it. The lane's jsdom suite could not see this: the pre-existing refusal row `CmsTemplateDesigner.result-focus.test.tsx:83` feeds `{code:'TEMPLATE_FORBIDDEN'}`, which is not an ApiError envelope (`readExpectedApiError` returns null, so the path is `uncertain`, not a 403), and it passes with either gate (NIT n5).

## 2. What I ran (every mutation in a scratch copy; the worktree was only read)

Scratch root: `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/review-v17/` (`repo` and `repo2` are copies with `node_modules`, `packages` and `supabase` symlinked; `out/` holds every JSON and log). The copies were byte-identical to the worktree for all 83 files when the final probes and coverage ran.

| Check | Result |
|---|---|
| Focused Vitest, 10 touched dirs plus `step-up-required.inventory.test.ts`, worktree, 13:29 UTC (before the delta) | 309 files, 3,354 tests, 0 failed |
| Same 10 dirs plus coverage, scratch copy of the final state | 308 files, 3,349 tests, 0 failed (3,349 = 3,354 minus the 5 inventory tests, which sit outside the 10 dirs) |
| Final run in the worktree: 10 dirs, `cms-editorial-workflow` (imports the gate), inventory test, 7 bundle-closure tests, `no-store-redirects.test.ts` (pwfix6 guard) | 377 files, 4,037 tests, 0 failed, exit 0 (14:05:17 to 14:08:33 UTC) |
| Bundle-closure and redirect guards alone (`browser-validator-import-boundaries`, `client-chunk-boundaries`, `client-chunk-time-authority`, `cms-island-static-closure`, `cms-lazy-forms-closure*`, `no-store-redirects`) | 8 files, 139 tests, 0 failed |
| `tsc --noEmit -p apps/web/tsconfig.json` (scratch copy, `.astro` and `worker-configuration.d.ts` present) | exit 0, no output, both before and after the delta |
| `prettier --check` on the 83 files, `eslint --max-warnings=0` on the 77 code files | clean, exit 0 |
| E2: the 30 changed test files at HEAD against the new product | 14 failures, all in the lane's list of corrections (inventory entry, panel prop `verified` x4, composition list busy row, taxonomy field loading x2, governed degraded x4, related fieldset, taxonomy late-edit) |
| E1: HEAD version of each of 43 product files against the current tests of its island | section 5 |
| E1b: 19 single-fix mutations (one expression each) | section 5 |
| Probes A, B, C, E (composition, related) and G (governed), each also run against the HEAD product as a control | M1 to M3, m2 |
| Coverage (v8) of the 47 product files, changed lines against uncovered statements, branches and functions | m4 |
| Proposals file: 36 rows (`recite7/web7-proposals.json`) | every `file` plus full title exists in the run and passes |
| Retitled tests against the evidence ledger | 33 old titles gone; none of their first 60 characters occurs in `tests/contracts/phase-02-slice-12-evidence-ledger-*.ts`; no duplicate titles in the changed files |
| Size and type rules | every touched `.tsx` component at most 200 lines (`CmsGovernedReviewDetail.tsx` is exactly 200); every hook or lib at most 294; changed tests at most 399; no `any` in the diff or the 4 new files; no import cycle added |

Not run (forbidden by the brief or out of scope for focused runs): Playwright, build, bundle check, the other roughly 380 files of `apps/web`. The lane's full-run figure (761 files, 8,813 tests) is therefore not independently verified; my worktree run covers every directory that imports a touched shared module.

Drift check at the end (14:08:43 UTC): the 83-file set and every SHA-256 equal the manifest fixed at 13:40:35 UTC (Appendix A).

## 3. Findings

### MAJOR

**M1. B4 leaves the review controls enabled while a command is in flight, and the page cannot cope: the pending label is erased and the review the author opened is closed by the earlier command's answer.**
- Where: `CmsCompositionInstanceRow.tsx:75` (`disabled={reviewOff}`), `CmsCompositionInstanceList.tsx:51,67,113` (`reviewBlocked = reading || disabled`: `busy` no longer gates Review), `use-composition-page.ts:88` (`reading: panel.kind === 'loading'`). The unguarded readers: `use-composition-updates.ts:87-88` (`review()` runs `setStatus(IDLE)` then `setPanel({kind:'loading'})` with no in-flight check; same for `bulk.review` at `use-composition-bulk.ts:54-55`) and `use-composition-updates.ts:159-160` (`applied()` closes the panel from the `panel` captured when the command was issued).
- Evidence (probe B, `probes/ZZProbe.review-during-command.test.tsx`): Accept in flight on row 1; "Review update for /main/row-2" is enabled; clicking it removes the status region entirely (`null`) while the accept is still pending; when the accept answers 200 the diff of row 2 is gone (`#cms-diff-heading` is `null`) although the accepted instance was row 1. Control with the HEAD product: `reviewEnabled:false`, the label stays "Accepting the update…".
- Spec: FE03 1046 commandState loading, "Stable pending label; only the commit control disabled; no success claim" (violated by the interaction that B4 made reachable); diffState "re-required on every open".
- Fix: (a) `review()` and `bulk.review()` must not touch `status` while a command is in flight (expose `inFlightRef` from the session); (b) decide what is open through a ref in `applied`, `afterRefusal`, `placeNewRoots` and `runSequence`; (c) tests: held Accept, review another instance, the label stays and the review survives the answer; the same for bulk review during bulk accept. Smaller alternative: keep Review disabled while a command is in flight and ratify "commit controls" in a DEC for this island (root's reading of FE03 1046 is needed either way).

**M2. The same change makes insert fields and diff answers editable while the command runs, and both completion paths overwrite what the author typed.**
- Where: `use-composition-insert.ts:155-157` (`const cleared = { ...fields, item: null, overridesText: '' }; setFields(cleared); setBaseline(cleared)` uses the dispatch-time `fields`), `CmsPatternInsertForm.tsx:113,121,154,171` (fields no longer disabled while pending); `use-composition-updates.ts:128-131` with `:63-83` (`afterRefusal(answer, heading, keep)` reloads the diff with `keep.choices`, the choices captured at dispatch), `CmsPatternUpdateDiff.tsx:90` (answers disabled only by `disabled`).
- Evidence: probe A: slot path, pattern and overrides typed after dispatch; after the 201 the form shows slot `/main`, pattern empty, overrides empty (the sent values, or cleared). Probe E: an answer flipped from yours to theirs after dispatch; the 409 reload restores yours while the status says "your choices are kept" (the author may then accept the wrong resolution). Control at HEAD: the controls are disabled, the edit cannot be made.
- Rule: FE03 927 (retain the scoped draft); unit5 V16-03 ("a value typed while the save is pending was neither sent nor kept honest"). `use-composition-insert.ts` also sets `baseline = cleared`, so the leave guard stays clean and does not warn about the lost input.
- Fix: clear only fields that still equal what was sent (functional `setFields`, baseline derived from the result); pass the current choices (ref) into `reloadDiff`; RED tests A and E are in Appendix B.

**M3. A5 is incomplete: choosing a derived rule while the save is in flight lifts the pending label and re-enables the commit control.**
- Where: `use-related-content-form.ts:172-180` (`chooseRule` sets `{kind:'idle'}` unless the status is a conflict). The lane fixed only `edited()` at `:117-128` (`current.kind === 'pending' ||`). The rule fieldset was disabled while pending before web7, so `chooseRule` was unreachable then; `CmsRelatedRuleFields.tsx:34` now leaves it enabled.
- Evidence (probe C): during the held save, clicking another rule radio turns the commit button back to "Save related content", enabled, and removes the status region; a click on it sends nothing (`inFlightRef`), so the button is dead and silent. Control at HEAD: label "Saving…", disabled, region unchanged. The lane's rewritten loading row edits through `Pin ...` only (`CmsRelatedContentForm.states.test.tsx`), which is why it is green.
- Spec: FE03 1046, the exact cell A5 was meant to close.
- Fix: the same `current.kind === 'pending' ||` guard in `chooseRule`, plus a rule-radio click in the loading row.

### MINOR

**m1. G-A1 is only partly done, and the degraded detail is a dead end.**
- The notice says "The review is not shown" (`CmsGovernedReviewDetail.tsx:65-67`), yet the Actions section still renders stale review data: `CmsGovernedReviewDetailIsland.tsx:147` mounts `GovernedAssignmentFormView review={review}` and `CmsGovernedAssignmentRevoke.tsx:73-98` lists `reviewerLabel` and `endsAt` of the stale assignments (probe D: the degraded text contains "Reviewer A, ends 2026-10-09T12:00:00Z Revoke Reviewer A"). DEC-241 item 1 says the stale review is not kept on screen.
- The notice promises "until the review is read again", but a non-429 degrade arms no re-read: `use-cms-workflow-canonical.ts:98-109` retries only for `rateLimit`, and the dump of every button in the degraded island shows only four disabled commit controls. Recovery needs a page reload and the screen shows nothing to read. Web6 reported the missing control; hiding the review makes it worse.
- Fix: hide the revoke list while `disabledReason` is the unverified reason, add a "Read the review again" button on `canonical.refetch`, make the notice a polite status; test both.

**m2. B1 clear-on-success discards text typed after dispatch (decision, assignment create, activation).** The fields stay editable while pending (the pending rows assert it), and `reset: () => setTyped({})` wipes everything on success. Probe G (decision form): a reason extended during the held request is `''` after success. Keep or flag late edits, as unit5 did for the template, vocabulary and locale forms; code at `CmsGovernedDecisionForm.tsx:83`, `CmsGovernedAssignmentCreate.tsx:68`, `use-governed-activation-form.ts:99`.

**m3. The taxonomy late-edit oracle was reduced.** `CmsTaxonomyVersionDesigner.late-edit.test.tsx:100-111` no longer sends the second attempt (correction 8, spec-forced by the new submit hold), so it cannot tell "snapshot bound to the confirmed save" from "bound to the latest attempt". Mutation E1b `tax-lateedit-bind` (set `sentRef` at attempt time) survives (0 of 3 fail). The describe comment at `:73-76` still describes the two-attempt scenario. Probably no longer reachable with the hold, but then say so: retitle and fix the comment, or rebuild a scenario that still discriminates.

**m4. Untested new behaviour; the report's coverage statement is false.** The report says every new web branch is exercised; v8 at changed lines says otherwise (apps/web is outside the repo coverage gate, but the brief asked for 100% of touched modules):
- `use-composition-updates.ts:257-268`: the refusal path of `placeNewRoots` (statement `:261`), including the new `answer.status === 403` gate flag at `:266`, is not run by any test.
- Mutation survivors (non-equivalent): reverting `CmsCompositionPage.tsx:58` (`reading=`) or `use-composition-page.ts:88` alone leaves all 320 tests green, so "review waits only for a running diff read" is proved only at list level; `CmsTaxonomyTermForm.tsx:165` (`|| list.refreshing` on the open action form; a conflict or unknown outcome keeps the form open during the refresh, `use-term-form.ts:264-279`) survives; `newer` computed from the kept comparison (`use-pattern-conflict.ts:214`, `use-taxonomy-conflict.ts:92`: adopt buttons now show while checking or failed) survives.
- Uncovered at changed lines: the three default no-ops `useRef(() => undefined)` (`CmsGovernedAssignmentCreate.tsx:68`, `CmsGovernedDecisionForm.tsx:83`, `use-governed-activation-form.ts:99`; use a null ref and `?.()`), `term-form-defaults.ts` (62.5% statements, 33% branches: both defaults are moved code; test them directly), `pattern-status-copy.ts:30` (moved branch, 429 without Retry-After).

**m5. Stale titles, tags and docs.**
- `CmsTemplateEditDesigner.latest-states.test.tsx:299` still reads "(kept half) ... the empty content-type prerequisite names no reason (DEFECT)" although L2 is fixed, and the row does not assert the successor's reason (the new assertion lives in the states file).
- `CmsGovernedAssignmentForm.states.test.tsx:378` "(C2)" and `CmsGovernedActivationForm.states.test.tsx:112` "(kept half) ... (C3)" keep defect tags; B2 is fixed at the island and DEC-241 item 2 ratified the lock.
- The B2 island test (`CmsGovernedReviewDetailIsland.test.tsx:118`) has no `[P2-S12-AC-271]` tag, so it cannot be cited and B2 is not in the proposals.
- `cms-governed-review/README.md:122-123` calls the queue cell an "open BOUNDARY"; DEC-242 settled it (closed notice with Retry, FE03 1050 amended). The report's "Still pinned" list also still treats the two queue rows as awaiting a decision; they are valid under the amended cell. The locale 422 row was retitled without its defect tag (acceptable only because CMS-03C-04 has no 422 reason token; say so in the report).

### NIT

- n1. Template L1 keeps the "Use version N as parent" button enabled during a re-read, but `useLatestAsParent` returns silently because `attempt.rebase()` refuses while reading (`cms-template-edit-reconcile-state.ts:161`; `CmsTemplateLatestVersionPanel.tsx:44` has no disabled state).
- n2. The gate renders `h2` where the sibling failure headings of the template, pattern, vocabulary and term status regions are `h3`; the template gate title ("Not available to you") differs from the other islands' failure headings.
- n3. Stale FE03 line citations in comments, READMEs and the report: the state table is lines 1043 to 1051 (loading is 1046, error 1049, degraded 1050), but code cites "FE03 1048" for loading and for the whole table.
- n4. L8 removes "Create a term" and the Actions column for the length of every refresh (`canAct`, `CmsTaxonomyTermTable.tsx:43,74`), a layout shift where "off" would be a disabled state; the test asserts removal.
- n5. `CmsTemplateDesigner.result-focus.test.tsx:83` (the web6 result-heading guard for refusals) is blind: its body is not an ApiError envelope, so it exercises the unknown-outcome path and passes with the earlier, focus-stealing gate. Use `refusal(403, 'TEMPLATE_FORBIDDEN')` as the new states row does.

## 4. FE03 cell by cell

| Cell | Result | Evidence |
|---|---|---|
| D1 selector submit after a failed Load more | OK | `selectorUnverified` covers loading, failed, rate_limited (`CmsPatternInsertForm.tsx:35-39,190`); reverting it fails `selector-states` degraded (E1b `ins-d1`) |
| D2 250 ms skeleton | OK | `useLoadingDelay` in `CmsTaxonomyFieldConnected.tsx`; fake-timer row 249/250 ms; revert fails it (`ef-connected`); the AC-135 row advances 250 ms |
| G-A1 degraded detail | Partly | review block hidden, `lastVerifiedAt` named, forms off, re-shown after a verified read; m1 for the residue |
| A1 403 gate: template, vocabulary, locale, related, term, pattern designers | OK | each `*Status.tsx` revert fails its gate row; `isCapabilityDenial` is correct per island (vocabulary `refused` is 403-only: CMS-03C-16 allows only `capability_missing`; related and term test the reason); focus rule: the template keeps the summary region (CMS-11 "focus summary/field"), the others focus the gate heading; both asserted since the delta |
| B6 composition 403 (insert, accept, detach, bulk) | OK but `placeNewRoots` untested | m4 |
| L1 template comparison kept | OK | `co-reconcile` revert fails the degraded row; n1 |
| L2 successor empty content-type reason | OK | identical markup to the create designer; `co-editdesigner` revert fails the successor row; m5 for the stale title |
| L3/L4 pattern, L5/L6 vocabulary | OK | submit off while checking or failed, comparison kept; E1b `pat-l3/l4`, `tax-l5/l6` killed; `newer` semantics untested (m4) |
| L7 terms picker commit off | OK | `term-l7` killed |
| L8 terms refresh | OK | skeleton at 250 ms, actions removed (n4); `term-l8a` killed, `term-l8b` survives (m4) |
| A5 related loading | **Not met** | M3; the fieldset lock revert (pair of files) is killed, `chooseRule` is not guarded |
| A6 template `key_reserved` at the field | OK | parsed from `details.reasonCode` (BE03c 226: 422 `TEMPLATE_VALIDATION_FAILED` at `/templateKey` with `reasonCode key_reserved`); `aria-invalid`, `aria-describedby`, summary link; `tmpl-keyerr`, `co-fields`, `co-submit` killed. The other A6 reasons are correctly left open (the pattern designer already links its reasons; the term and locale reasons name no field in FE03) |
| A7 term form reason | OK | `term-a7` killed |
| B1 clear on success | OK, with m2 | three files; each revert killed |
| B2 `assign_reviewer` reason | OK | shown only when neither `assign_reviewer` nor `revoke_assignment` is permitted, which is right for the owner-only copy; `isl-b2` killed; untagged test (m5) |
| B4 composition commit-only | **Not met** | M1, M2 |
| AC-042 c5 provenance | OK | the resource has no parent member (`resources-meta.ts`), so the browser-known `expectedVersion` parent is the only available provenance; text "..., version V, based on version P. This is not a published template." matches the real-route assertion `template-states-real-route.spec.ts:142` (that spec is modified against HEAD, last written 13:33:58 UTC, and expects ", based on version ${base}."); `tmpl-prov` killed |

Regression of earlier fixes: unit5 leave guard OK (unsaved and unsaved-guard rows green, document-level capture intact in the composition page and the template guard); unit5 late edits see m3 and M2; web6 commit-only disabling and result heading OK after the delta (the older refusal rows of locale and vocabulary depend on `focusable`: reverting it fails them); pwfix6 redirects OK (no `.astro` file touched, `no-store-redirects.test.ts` green).

## 5. Revert and mutation results

E1 (whole-file revert to HEAD, island tests): every one of the 43 product files is killed except four. `CmsCompositionPage.tsx` and `use-composition-page.ts` survive alone (m4). `CmsRelatedContentForm.tsx` and `CmsRelatedRuleFields.tsx` are equivalent mutants alone (the removed prop is inert); reverted as a pair they fail 2 tests (`CmsRelatedContentForm.save` fieldset row, the `states` loading row). Whole-file reverts of the two conflict panels, designers and hooks of pattern and vocabulary crash on the changed props; their behaviour is covered by the E1b mutations below. Failure counts: list 2, row 2, status 3, insertform 3, updatediff 1, compstatus 3, bulk 1, insert 1, updates 1, designer 1, editdesigner 3, fields 2, submit 4 (2 per surface), reconcile 1, connected 1, gate 13, assigncreate 1, decision 1, detail 4, island 1, activation 1, locale status 1, pattern status 1, pattern designer hook 2, related status 2, related hook 1, taxonomy status 2, taxonomy designer hook 3, term action 1, term form 2, term status 1.

E1b (one expression each): killed `tmpl-gate`, `tmpl-keyerr`, `tmpl-prov`, `ins-d1`, `ins-b4`, `term-l7`, `term-l8a`, `term-a7`, `pat-l3`, `pat-l4`, `tax-l5`, `tax-l6`, `rel-pending`, `isl-b2`, `act-b1`. Survivors: `term-l8b`, `pat-kept`, `tax-kept`, `tax-lateedit-bind` (m3, m4); `rel-fieldset` was an invalid mutation (inert prop), re-done as the pair above.

## 6. The 20 PINNED rows of refute5, the 15 corrections, the refactors

| Row (refute5) | Outcome |
|---|---|
| 86 D2 (0 ms loading) | rewritten, spec-true (249/250 ms), killed by revert |
| 142 G-A1 | rewritten (review absent while degraded, present after a verified read), killed; m1 residue not asserted |
| 15 successor empty content-type (proof gap) | now asserted on both surfaces |
| 159, 160 queue degraded | untouched, valid under DEC-242 |
| 180 locale FALLBACK_CHAIN_MISMATCH | retitled "(reading)" per DEC-242 item 2, plus `commit enabled` |
| 258, 259 term action Cancel and Back | untouched, valid under DEC-241 item 2 |
| 4, 12, 17, 31, 38, 60, 73, 83, 182, 191, 193, 212, 213 (A2, A3, A4, B5, B7) | still pin the defect, by design (DEC-242 item 3) |
| 55 selector 409 restart (proof gap), 85, 93 | untouched; 55 is not mentioned in the report, 85 and 93 are |

Corrections: 13 of 15 are spec-justified and strengthen or keep the assertion. Two reduce a guard: correction 8 (m3) and correction 12 (the list row now asserts Review enabled while busy, the reverse of the old assertion; justified by FE03 1046 but it hard-codes the M1 hazard). The refactors (`pattern-status-copy.ts`, term list notices, `term-form-defaults.ts`, `use-term-action-focus.ts`, label maps moved to `term-copy.ts`) preserve behaviour: the moved text is identical, `CmsTaxonomyTermAction` keeps the on-mount focus semantics, tests pass; coverage of the moved defaults is m4.

## 7. Real-route specs and gates root must run

Project `real-route-chrome` (`playwright.s09-real.config.ts`, `node tests/e2e/support/run-s09-real-suite.mjs`). jsdom cannot see these; none of them exercises M1 to M3.
1. `phase-02-slice-12-template-states-real-route.spec.ts` (must): AC-042 c5 line `Template ID ..., version ..., based on version ...`, the 403 row (`getByRole('alert')` focused with the gate inside; this verifies the 13:36 UTC edit), A7 sentence, disabled and focus rows.
2. `phase-02-slice-12-template-journey-real-route.spec.ts`, `-template-real-route.spec.ts`, `-template-uncertain-real-route.spec.ts`, `-template-edit.spec.ts` (axe): L1 kept comparison (`Latest version N` heading after a second check), successor save text.
3. `phase-02-slice-12-page-operations-real-route.spec.ts` (place a pattern from the instance-insert form: B4 fields enabled while pending, D1) and `-definition-pages-real-route.spec.ts` (pattern and vocabulary pages, L3 and L5 save buttons, healthy governed detail).
4. `phase-02-slice-12-governed-review-real-route.spec.ts`, `-protected-decision-real-route.spec.ts`, `-definition-journeys-real-route.spec.ts`: B1 clear on success with the step-up draft restore, B2 sentence, term actions.
5. `phase-02-slice-12-term-merge-journey-real-route.spec.ts`: L7 and L8 (Create and Rename disappear for the refresh).
6. `phase-02-slice-12-locale-related-journeys-real-route.spec.ts`, `-locale-real-route.spec.ts`: A5 (rule fieldset no longer disabled while saving) and the locale gate.
Not Playwright: `pnpm build && pnpm bundle:check`. `CmsTaxonomyFieldConnected.tsx` is statically imported by `CmsFieldEditor.tsx` (entry editor initial route) and now pulls `CmsLoadingRegion.tsx` plus `cms-loading-region.css`; the bundle-headroom lane just restored that route's headroom (initial budget 92,160 B gzip). The gate is added to seven forms.
Nothing real-route covers G-A1 degraded, the 250 ms selector skeleton, or any 403 outside the template; those stay jsdom-only evidence.

## 8. Conditions and requests to root

- C1 (blocks commit of the B4 and A5 hunks): fix M1, M2, M3 with RED tests first (Appendix B), or carve those hunks out and re-open the cells; root must read FE03 1046 for the Review control (M1 alternative).
- C2: refresh the report hash table and mention the 13:34 to 13:36 UTC edits; keep the new focus assertions.
- C3: close m4 (tests for `placeNewRoots` 403, page-level `reading`, form open during a refresh, adopt buttons; null-ref defaults; direct tests of `term-form-defaults.ts`) and correct the coverage sentence.
- C4: m5 retitles and README text; tag the B2 test `[P2-S12-AC-271] commandState disabled:` so it can be cited.
- C5: section 7.
- Ledger hygiene (DEC-226): do not cite as closing `loading` the rows `CmsPatternInsertForm.states`, `CmsPatternUpdateDiff.states`, `CmsBulkUpdatePanel.states` (B4) and `CmsRelatedContentForm.states` (A5) until M1 to M3 are fixed; their assertions pass but the cell is violated on an untested path. The other 32 proposed rows are sound as evidence for the cells they name, the `part` rule in the proposals (cite a part only when every island is closed) stands, and the open A2, A3, A4, A6 and B5/B7/B8 cells keep AC-271 partial.


## Appendix A: SHA-256 of the 83 files reviewed (fixed 13:40:35 UTC, unchanged at 14:08:43 UTC)

Files whose hash differs from `lane-web7-report.md` (edited 13:34 to 13:36 UTC): `cms-composition/CmsTemplateStatus.tsx` and the nine `*.states.test.tsx` files named in section 1.

```
ae36243c892a2ad2ada6b4a40a0091a5df1203617acf3595eeb89e75b41c1d0d    96  cms-composition/CmsLatestReadLoading.test.tsx
f360ffa894f608477dca7e1b7871aa48985fcfc3928f683b03d1d312ec7da3e3    91  cms-composition/CmsTemplateDesigner.result-focus.test.tsx
a61daf514507b6f6aaa9c17c8d1ecfb4cc054c1419940c05dbb8ce5d80fc1cd0   360  cms-composition/CmsTemplateDesigner.states.test.tsx
eff6ac56a919089cb6f849cb6c541422299484b2b1dbd6400a32504ae3259d44   195  cms-composition/cms-template-designer-submit.ts
117e1f7b36382f76b1e306abfc4cd1e5ead17f059b7cc1717649173b4df4b8fe   194  cms-composition/CmsTemplateDesigner.tsx
703c01db3a0d7ec59aa29bf9feef55b85c6da8cb9bdaf918c4323cfc9934ccd8   313  cms-composition/CmsTemplateEditDesigner.latest-states.test.tsx
59ccd2cb7d11356b59781ae8a775df8220440528792ea2888fb8bf2f71aff3bb   186  cms-composition/CmsTemplateEditDesigner.tsx
b9573ffea9deaf9dc32a1f6b4ebe953a806c5f919a75383817a8e1007f222648   205  cms-composition/cms-template-edit-reconcile-state.ts
8ffed478ee1dc6ab6612bcc6c5a3bfce475ee0fec10023ec305b606aa531c180   152  cms-composition/CmsTemplateFields.tsx
450ea1d2af68a7115356aecc658d83331ead04367dd363b569d7e526ea44993d   159  cms-composition/CmsTemplateStatus.tsx
6087f6c167c1c7277cf5d0ed6a2799868a516f2bbf70955e45c749fb9d1b81c1   301  cms-composition-instances/CmsBulkUpdatePanel.states.test.tsx
ab78baa5f7fa5edb330df35e2ce41c5b309446714bbc0c4535aef7fbd5ff12f8   233  cms-composition-instances/CmsCompositionInstanceList.test.tsx
1ae4cd20cec103513b0e3c45b1c55b73287a28f6e2285d22db8330af5dd6a8a5   126  cms-composition-instances/CmsCompositionInstanceList.tsx
59badacfcfc8bd9cf7402f24dcba16eb24af571e737347c7959f6492df5e2bea    95  cms-composition-instances/CmsCompositionInstanceRow.tsx
d0c12d3b77b8ca60dacfc8ffd6d4a086264458eb2ac65a1e49c738c4bbe882e6   176  cms-composition-instances/CmsCompositionPage.selector-states.test.tsx
6c9ba8acdaec50087dface1c8826753722aa611ac7788a87794ed091bd15df7a    98  cms-composition-instances/CmsCompositionPage.tsx
e4b9ee0845fef43b95d654dc51ebca7e5ac78e1f7512279c7df02723e5decc81    54  cms-composition-instances/CmsCompositionStatus.tsx
252ee715f18efb8e35eb3693662c63f82eafe5f8ec3a1f5ecce7c8763b446d07   290  cms-composition-instances/CmsPatternInsertForm.states.test.tsx
8ca61a637da147e4ff241fab761c4cc87cffb56886b74ac495b6f83724b24284   197  cms-composition-instances/CmsPatternInsertForm.tsx
2fe5b95dcb3b1be3c4be31525e6608d724c2a4c49f91b930ba309b59cff26937   391  cms-composition-instances/CmsPatternUpdateDiff.states.test.tsx
01a3f78ce909f40fdef4f237f3785744bcc5fefe8d35d534b647fbc650cf72b5   131  cms-composition-instances/CmsPatternUpdateDiff.tsx
43bc1696d85486bbbe3eba86f6733a24a7c46251095b3c3b25157877757a4b31    57  cms-composition-instances/composition-status.ts
85248bfda4ae1be6ca505a90d00b44364554cacd49316b91df13e1d052efb919    98  cms-composition-instances/README.md
e62ab7cee389267c9ff2bcc139d28546a88f41fabaf97e3ee1ac89926c5a3b2b   190  cms-composition-instances/use-composition-bulk.ts
71467d99319bb1b1c5f91005d24102690847d7f0edb4fb9b7dad1764e39dd7e7   237  cms-composition-instances/use-composition-insert.ts
36929d13e2b6797eb883d4edfed02c8bdea7af612f5ab929c7e4306fa6271773    92  cms-composition-instances/use-composition-page.ts
3881cc69941a116d570579cab3d87afd281e6b3676af22cd4656004176f02c9c   294  cms-composition-instances/use-composition-updates.ts
f067eced2c38beb258bfcd4692d4f93698e05d037cc6c388701f5ee1db5d4284   123  cms-composition/README.md
797a364160eb01bf88b8a6d8c5b3caf9e279ff600d971908210a93f22ff98bd9    40  cms-editorial/CmsEditorialCapabilityGate.tsx
de186d39e3e1e05b071e904800dec6d26b3649ce4dd6fe3d4fb15cfb23100b54   168  cms-editorial-fields/CmsTaxonomyFieldConnected.tsx
70bfb03091131b3cd76f0477f18c6ca18388799ac68a08d3ecc5ae03ba9de20b   187  cms-editorial-fields/CmsTaxonomyFieldEditor.connected-states.test.tsx
26ac0323c5dc776942f2b46f109a2e259fda20d022f167f2024b20b59f96b2d2   382  cms-editorial-fields/CmsTaxonomyFieldEditor.connected.test.tsx
ce6153f8417e56188d3e344992169a868f20b6f5f9c04fdc2241c924538cd8a9   138  cms-editorial/README.md
b9b09d00556a9ec9f8fa289ff53c19b4ba8fb5f2f2b7f50d125f48b6a0bdb0de   328  cms-governed-review/CmsGovernedActivationForm.states.test.tsx
2cb05760a9e09dea2281b1b212865c5f9bd09f7f01304dbdb0c6c51993bc48c9   195  cms-governed-review/CmsGovernedAssignmentCreate.tsx
feeb813f63a9b358477239e2178e7dbab3a31228d701b8836ee83341e6676921   399  cms-governed-review/CmsGovernedAssignmentForm.states.test.tsx
c6415052c098ff56d2d56738beec163679f8ee1ad2faebfeddb6910ab39665c3   325  cms-governed-review/CmsGovernedDecisionForm.states.test.tsx
471e06e11e7456fcb2d770665edfc82c6b740fdc9a6b790ace6aef218b94c41a   193  cms-governed-review/CmsGovernedDecisionForm.tsx
c434d065b4ce1fa272c7c541c6aebb6e28c9572716fa570d5bcf1aa72b66a53e   145  cms-governed-review/CmsGovernedReviewDetailIsland.rate-limit.test.tsx
5f82aa56d38efa05101e2139dfd9fb6de9701b568b2c4c59a3c439db1b50ad86   225  cms-governed-review/CmsGovernedReviewDetailIsland.states.failure.test.tsx
69f07f43e4586ac1feaefc38da21909dc1b10652ad5c053a2e440b810a24c36c   361  cms-governed-review/CmsGovernedReviewDetailIsland.test.tsx
597ae0dadad4d3141cb8ea15ee3ef8dc183c3bd8b92b6794cc3227f0c3fbbb3f   172  cms-governed-review/CmsGovernedReviewDetailIsland.tsx
21d9a6401364a9f99b19d9ac24b2a839c6ec312c65de18520baa42105df956f6   245  cms-governed-review/CmsGovernedReviewDetail.test.tsx
d329634cd2d61309aa6aea843d8adaaf6bd74c9b13d8bf24c28e8cbeaa28a558   200  cms-governed-review/CmsGovernedReviewDetail.tsx
b9d515539e2405d63ce4a7fd86d13e87f0fe89457d4b6d2e4826596dc142dcfc   135  cms-governed-review/README.md
0df9cab4471ebcc781462cc770182c77425703d5752f530ec5fb3a0cc60f62b0   232  cms-governed-review/use-governed-activation-form.ts
12ee6601a56886e12bf8f61101765add680ab7c34945af3803a40da73c6a85ca   116  cms-locale/CmsLocaleStatus.tsx
de57d98649332157227c483e5a4c5a8598bdaf3825f3a06e2be76a13051c28c6   246  cms-locale/CmsLocaleVariantForm.states.test.tsx
4f98aed6d87eb56e4fd1836d18b7dce7b04f63f3e96ab8d9d059b92e496b3c2f   119  cms-pattern-designer/CmsPatternConflictPanel.tsx
929b11ec5b7da4ca8c401f679a6f1e86bd915ba287ccb797d10e9227bf37bd47   174  cms-pattern-designer/CmsPatternStatus.tsx
1ca382b3f23cd86590d322f515291c360fa8016fdb8144616ea3429afbfc25da   272  cms-pattern-designer/CmsPatternVersionDesigner.latest-states.test.tsx
8c834a84e54447d17a91ed8384947554c38d1be207575f208e61c3c718d97aba   337  cms-pattern-designer/CmsPatternVersionDesigner.states.test.tsx
af8a83a66b74041cf8bde226187a6c41c4d91dcc44b09f320b4048794d29064a   199  cms-pattern-designer/CmsPatternVersionDesigner.tsx
037dd3852d64cc82050c739e5502a1aae85200da789a369a7a43a009a024f08a    46  cms-pattern-designer/pattern-status-copy.ts
5ce55cc302ba5f20a1a43afce9a4a1125ba8898be468801d60282db74e800965   100  cms-pattern-designer/README.md
6546be9589977057c4f84894d9457069d0c415fcb9128d0fc9e52daaeb0306ba   216  cms-pattern-designer/use-pattern-conflict.ts
d3f37472aff2b0bab2bcbf82c7c971c1085fec7ba650587badcc1506a52e6da9   210  cms-pattern-designer/use-pattern-designer.ts
91a31ce528d2e25f563bbf281ecb768ab7322d91315536c2d23f15a5ef219e50   276  cms-related-content/CmsRelatedContentForm.save.test.tsx
f30a48538ab18923deb1bcdc18e4f2a10aea24e60273052c0708f6f1580928b2   294  cms-related-content/CmsRelatedContentForm.states.test.tsx
fafcfbd4c1596bfad37e3ae152c12747658252182be00a8cdb154e6e887f6a27   150  cms-related-content/CmsRelatedContentForm.tsx
183cb8170f86f61d53e660efe12a6c075d249ad92f40e4b8857a62179c5c100b    98  cms-related-content/CmsRelatedRuleFields.tsx
edfc7d301581ed35d286a7125e806aa232691a71044fcf0a81349401dae7d32d   137  cms-related-content/CmsRelatedStatus.tsx
2baf48f3dc0a2933f98124317bc18914caf24c3be239d5acb0323533437b9bbf   289  cms-related-content/use-related-content-form.ts
6bd612233373f49c8a30a199d9d473ea175a4a9bb04e728eec7a091b6ba9cb38    68  cms-taxonomy-designer/CmsTaxonomyConflictPanel.loading.test.tsx
e52a4e8983c33347cce91578b60226519c876cefcc623c21be9510da691911c2   107  cms-taxonomy-designer/CmsTaxonomyConflictPanel.tsx
bcf6a6794dd28977232a807da51d7dfad56d2e147a389573660133c7ec1c03f0   184  cms-taxonomy-designer/CmsTaxonomyStatus.tsx
9b01f2ed9734ef3691cf04d04079c1d91e48a503c1cff5b10840dcf7b7f5397b   118  cms-taxonomy-designer/CmsTaxonomyVersionDesigner.late-edit.test.tsx
d4e92ea2901e7106f5271456020ae4605bb8497aff0f8a6890f0086e347dfff6   259  cms-taxonomy-designer/CmsTaxonomyVersionDesigner.latest-states.test.tsx
5298d231967e3d8f892a8a010203b594b3bdec0a68cd51b0abb6e1eee90d647e   258  cms-taxonomy-designer/CmsTaxonomyVersionDesigner.states.test.tsx
2b822ebe9e8c10fd5d430b48ee664de63d3fec198ff85a857c5b31fcccfe21ca   166  cms-taxonomy-designer/CmsTaxonomyVersionDesigner.tsx
965d2d76381673a6db287db22ed03a59351c2fa7325ad1ffebbe4a119997319c    94  cms-taxonomy-designer/use-taxonomy-conflict.ts
c7a3fbe00ecdf9b777d3480f724fe577c8bbede0f15022ec26c136fd192f120d   266  cms-taxonomy-designer/use-taxonomy-designer.ts
b85905f69aa8a71162c1c7bd5851e173b80591bf814e91e00a161d91bb680926   198  cms-taxonomy-terms/CmsTaxonomyTermAction.tsx
a1b71276e24aa0ad55bcf04ee5f2167d477fb1826e570dce8c4c25678776c344   340  cms-taxonomy-terms/CmsTaxonomyTermForm.latest-states.test.tsx
df4c1c60497e73569a9af2c0a018ea103ae0221c81ded101177a653dfe8ed686   267  cms-taxonomy-terms/CmsTaxonomyTermForm.states.test.tsx
d5b3036163d817ffd6322324560b299c9f6f2b1429fdc287afa98cc03e7bf30f   196  cms-taxonomy-terms/CmsTaxonomyTermForm.tsx
b61ed6fccb97ccb31a4fa33782a62ebb91eeb8d4827f73a551978e703624a369    34  cms-taxonomy-terms/CmsTaxonomyTermListNotices.tsx
3874f34813f1c69742fb6c1a62a2a9f13b1c7ee080b8148544e718c663872f35   163  cms-taxonomy-terms/CmsTaxonomyTermStatus.tsx
e66b12f68adf2f8d936c4108a97710c6a9ea18f9846161c1fe29cf34a748d024    84  cms-taxonomy-terms/README.md
3e0a3f7e86f16a82d5e022a2269ad71b0a3d8570354192aff28d7df0d0ef58bd    84  cms-taxonomy-terms/term-copy.ts
7d4734960ffb0822ccdf6917ac45805e7fb4cb3997486775490aa5f0a1a72faf    17  cms-taxonomy-terms/term-form-defaults.ts
8a331c9b31b4c4955dbedd95a7217346fbe5eef6c35b7fe669608cfe3e4272eb    21  cms-taxonomy-terms/use-term-action-focus.ts
db10d75c2501703f374ebd47c612790a3af6694c4203df91b130c646d530717f   225  step-up-required.inventory.test.ts
```

## Appendix B: RED seeds (failing on the reviewed state, green expected after the fix)

Each file is a complete Vitest file for the named directory under `apps/web/src/components/`, built from the existing harnesses (`mountPage`, `heldReply`, `heldWire`, `mount`). Probe A, B and E go to `cms-composition-instances/`, probe C to `cms-related-content/`, probe G to `cms-governed-review/`. Names and the unused locals are scratch quality: tidy and title them `[P2-S12-AC-271] commandState loading: ...` before committing. Controls at the HEAD product: A and E cannot type (disabled), B shows `reviewEnabled:false` and keeps the label, C passes (label stays "Saving…").

### M2 probe A (insert late edit): `ZZProbe.insert-late-edit.test.tsx`

```tsx
// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buttonNamed,
  byLabel,
  choose,
  click,
  disableReactAct,
  enableReactAct,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  answerHeld,
  heldReply,
  pattern,
  resultRegion,
} from './composition-command-states.test-support';
import { json, mountPage, PLACE, settle } from './composition-page.test-support';
import { row, selectorItem } from './composition.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

const hero = selectorItem('hero-block', 2);
const side = selectorItem('side-note', 1);
const place = (c: HTMLElement) => buttonNamed(c, 'Place pattern');
const placed = () =>
  json({ items: [row(1, { path: '/main/hero1', patternVersion: 2, state: 'draft' })] }, 201, '"10"');

describe('PROBE A insert form: edits typed while the placement is in flight', () => {
  it('keeps a field edited after dispatch when the placement succeeds', async () => {
    const held = heldReply();
    const page = mountPage({ [PLACE]: [held.reply] });
    const c = page.container;
    await choose(pattern(c), hero.patternVersionId);
    await click(byLabel<HTMLInputElement>(c, /^Linked/u));
    await typeInto(byLabel<HTMLInputElement>(c, 'Slot path'), '/main');
    await click(place(c));
    await settle();
    expect(resultRegion(c)?.textContent).toBe('Placing the pattern…');
    await typeInto(byLabel<HTMLInputElement>(c, 'Slot path'), '/late-slot');
    await choose(pattern(c), side.patternVersionId);
    await typeInto(byLabel<HTMLTextAreaElement>(c, 'Overrides (JSON, optional)'), '{"/x": {"a": 1}}');
    await answerHeld(held, placed());
    await settle();
    const after = {
      slot: byLabel<HTMLInputElement>(c, 'Slot path').value,
      pat: pattern(c).value,
      ov: byLabel<HTMLTextAreaElement>(c, 'Overrides (JSON, optional)').value,
    };
    expect(after).toEqual({ slot: '/late-slot', pat: side.patternVersionId, ov: '{"/x": {"a": 1}}' });
  });
});
```

### M1 probe B (review during command): `ZZProbe.review-during-command.test.tsx`

```tsx
// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { answerHeld, heldReply, resultRegion } from './composition-command-states.test-support';
import { UPDATE, diffPath, json, mountPage, settle } from './composition-page.test-support';
import { diffOf, id, plainPath, row } from './composition.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

const pending = (n: number) => row(n, { state: 'pending_diff', version: '3' });
const diff1 = diffOf(1, [plainPath('/a')]);
const diff2 = diffOf(2, [plainPath('/b')]);
const read = (value: typeof diff1) => json(value, 200, `"${value.instance.version}"`);
const updated = () =>
  json({ items: [row(1, { version: '4', patternVersion: 2, linkMode: 'detached', state: 'active' })] }, 200, '"10"');

describe('PROBE B composition: reviewing another instance while a command is in flight', () => {
  it('keeps the pending label and the newly opened review when the earlier accept answers', async () => {
    const held = heldReply();
    const page = mountPage(
      { [diffPath(id(1))]: [read(diff1)], [diffPath(id(2))]: [read(diff2)], [UPDATE]: [held.reply] },
      { instances: [pending(1), pending(2)] },
    );
    const c = page.container;
    await click(buttonNamed(c, 'Review update for /main/row-1'));
    await settle();
    await click(buttonNamed(c, 'Accept update'));
    await settle();
    const duringPending = resultRegion(c)?.textContent;
    const reviewTwo = buttonNamed(c, 'Review update for /main/row-2');
    const reviewEnabled = !reviewTwo.disabled;
    await click(reviewTwo);
    await settle();
    const afterReview = { status: resultRegion(c)?.textContent ?? null, heading: c.querySelector('#cms-diff-heading')?.textContent ?? null };
    await answerHeld(held, updated());
    await settle();
    const afterAnswer = { status: resultRegion(c)?.textContent ?? null, heading: c.querySelector('#cms-diff-heading')?.textContent ?? null };
    expect(afterReview.status).toBe('Accepting the update…');
    expect(afterAnswer.heading).toBe('Update for /main/row-2');
  });
});
```

### M2 probe E (answer flipped during accept, then 409): `ZZProbe.answers-during-command.test.tsx`

```tsx
// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { answerHeld, heldReply } from './composition-command-states.test-support';
import { ENTRY, UPDATE, diffPath, entryDetail, json, mountPage, refusal, settle } from './composition-page.test-support';
import { diffOf, id, propsPath, row } from './composition.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

const pending = (n: number) => row(n, { state: 'pending_diff', version: '3' });
const diff1 = diffOf(1, [propsPath('/a')]);
const read = () => json(diff1, 200, `"${diff1.instance.version}"`);
const radio = (c: HTMLElement, path: string, value: string) =>
  c.querySelector<HTMLInputElement>(`input[name="choice-${path}"][value="${value}"]`) as HTMLInputElement;

describe('PROBE E composition: an answer changed while the accept is in flight', () => {
  it('keeps the last answer when the accept is refused 409 and the diff is reloaded', async () => {
    const held = heldReply();
    const page = mountPage(
      { [diffPath(id(1))]: [read(), read()], [UPDATE]: [held.reply], [ENTRY]: [entryDetail('11')] },
      { instances: [pending(1)] },
    );
    const c = page.container;
    await click(buttonNamed(c, 'Review update for /main/row-1'));
    await settle();
    await click(radio(c, '/a', 'yours'));
    await click(buttonNamed(c, 'Accept update'));
    await settle();
    await click(radio(c, '/a', 'theirs'));
    const during = { yours: radio(c, '/a', 'yours').checked, theirs: radio(c, '/a', 'theirs').checked };
    await answerHeld(held, refusal(409, 'COMPOSITION_VERSION_CONFLICT', { currentVersion: '11' }));
    await settle();
    const after = { yours: radio(c, '/a', 'yours').checked, theirs: radio(c, '/a', 'theirs').checked };
    expect(after).toEqual({ yours: false, theirs: true });
  });
});
```

### M3 probe C (rule chosen during pending): `ZZProbe.rule-during-pending.test.tsx`

```tsx
// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
  flush,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import type { RelatedSubmitResult } from './related-content-submit';
import { id, mount, savedOf } from './related-content.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

const name = (n: number): string => `entry ${id(n).slice(-12)}`;
const regionOf = (c: HTMLElement) => c.querySelector<HTMLElement>('.cms-related-status');
const commit = (c: HTMLElement) => c.querySelector<HTMLButtonElement>('button[type="submit"]')!;

describe('PROBE C related content: choosing a derived rule while the save is in flight', () => {
  it('keeps the stable pending label and the commit control disabled', async () => {
    let answer: (r: RelatedSubmitResult) => void = () => undefined;
    const submit = vi.fn(() => new Promise<RelatedSubmitResult>((resolve) => { answer = resolve; }));
    const { container } = mount({ submit });
    await click(buttonNamed(container, `Exclude ${name(3)}`));
    await click(buttonNamed(container, 'Save related content'));
    await flush();
    const before = { label: commit(container).textContent, disabled: commit(container).disabled, region: regionOf(container)?.textContent };
    const radios = Array.from(container.querySelectorAll<HTMLInputElement>('.cms-related-rule input[type="radio"]'));
    await click(radios.find((r) => !r.checked && !r.disabled)!);
    await flush();
    const after = { label: commit(container).textContent, disabled: commit(container).disabled, region: regionOf(container)?.textContent ?? null, calls: submit.mock.calls.length };
    await click(commit(container));
    await flush();
    const afterClick = { calls: submit.mock.calls.length, label: commit(container).textContent };
    answer({ kind: 'saved', saved: savedOf() });
    await flush();
    expect(after).toEqual({ ...before, calls: 1 });
  });
});
```

### m2 probe G (decision reason typed during pending): `ZZProbe.decision-late-edit.test.tsx`

```tsx
// @vitest-environment jsdom
import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { preloadWorkflowAnswerMachinery } from '../cms-editorial-workflow/cms-workflow-answer-machinery.test-support';

import { loadCmsValidators } from '../../lib/cms-contract-validators';
import { MemoryStorage } from '../../lib/test-support/memory-storage';
import {
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  LATER,
  governedDetailFixture,
  governedReviewFixture,
  jsonResponse,
} from '../../server/cms-governed-review-fixtures.test-support';
import CmsGovernedDecisionForm from './CmsGovernedDecisionForm';
import { heldWire } from './governed-command-states.test-support';
import { flushUntil, governedEnvironment } from './governed-review-form-test-support';

beforeAll(preloadWorkflowAnswerMachinery);
beforeAll(enableReactAct);
beforeAll(async () => { await loadCmsValidators(); });
afterAll(disableReactAct);

const decided = () =>
  jsonResponse(200, governedReviewFixture({ version: '3', state: 'approved', recordedDecisionCount: 1, decidedAt: LATER }), { etag: '"3"' });
const reason = (c: HTMLElement) => byLabel<HTMLTextAreaElement>(c, 'Reason');
const radio = (c: HTMLElement, v: 'approve' | 'reject') => c.querySelector<HTMLInputElement>(`input[type="radio"][value="${v}"]`) as HTMLInputElement;
const record = (c: HTMLElement) => buttonNamed(c, /Record/u);

describe('PROBE G decision form: text typed while the decision is in flight', () => {
  it('does not silently discard a reason typed after dispatch when the decision succeeds', async () => {
    const wire = heldWire();
    const refetch = vi.fn(async () => true);
    const { container } = mountElement(
      <CmsGovernedDecisionForm
        review={governedDetailFixture({ version: '2' })}
        permitted
        disabledReason={null}
        refetch={refetch}
        onDone={vi.fn()}
        environment={governedEnvironment(wire.fetcher, new MemoryStorage(), vi.fn())}
      />,
    );
    await click(radio(container, 'approve'));
    await typeInto(reason(container), 'Fine.');
    await click(record(container));
    await flush();
    await typeInto(reason(container), 'Fine. And one more thought typed while saving.');
    wire.settle(decided());
    await flushUntil(() => refetch.mock.calls.length > 0);
    await flush();
    const after = { reason: reason(container).value, approve: radio(container, 'approve').checked };
    expect(after.reason).toBe('Fine. And one more thought typed while saving.');
  });
});
```

## Verification round (lane web7 "Fix round 2")

Same rules as before: read-only except this file; every mutation in a scratch copy. The section "Fix round 2 (review V17)" of `lane-web7-report.md` claims M1, M2, M3, m1, m3, m4 and the cheap part of m5, plus an extra change for m2 (`useDraftFields.clearSent`). Root's reading for M1 (extends DEC-241 item 2): a control that starts another command stays disabled while one is in flight; inputs stay editable and a value typed during the command survives its completion.

### Verdict of this round

**ACCEPT-WITH-CONDITIONS, narrowed.** M1, M2, M3, m1, m3 and m4 are met, the m2 change has no regression, and no earlier fix regressed. No BLOCKER and no MAJOR remains. Six new findings: **MINOR 5 (N1, N2, N3, N4, N6), NIT 1 (N5)**. The nits n1 to n5 of the first round are untouched by the lane and stay open. Two conditions block the commit because they are mechanical acceptance criteria of the brief: R1 (size limits, N3) and R2 (a README that states the withdrawn behaviour, N6). R3 (N2) must be fixed or the claim narrowed before the G-A1 degraded row is cited. N1 and N4 may follow.

### 1. State verified

- 88 files under `apps/web` (first round: 83). The lane's refreshed table (89 rows: 88 plus `recite7/web7-proposals.json`) matches the tree on hash and line count, 89 of 89. My manifest of the 88 files is Appendix C. At the end of this round the file set and every hash were unchanged (drift check 0 of 88).
- Newly in the diff since the state I reviewed: five new test files (`CmsCompositionPage.in-flight.test.tsx`, `use-composition-updates.completion.test.tsx`, `CmsGovernedDecisionForm.late-edit.test.tsx`, `pattern-status-copy.test.ts`, `term-form-defaults.test.ts`) and two existing files now modified (the test-support `CmsGovernedReviewDetailIsland.states.test-support.tsx` and the shared hook `cms-editorial-workflow/use-cms-workflow-draft-fields.ts`). `CmsCompositionPage.tsx` and `use-composition-page.ts` are byte-identical to HEAD again; `CmsCompositionInstanceList.tsx` and `CmsCompositionInstanceRow.tsx` differ from HEAD by one comment line each. `CmsTemplateStatus.tsx` (the gate) is unchanged since my first review.
- The system clock jumped between my tool calls (14:53, 16:49, 23:29, then 01:23 the next day), so I rely on hashes, not on times.

### 2. What I ran

| Check | Result |
|---|---|
| RED tests against the round-1 product (my reviewed state, product files swapped back one group at a time, current tests) | 12 failures in 7 groups, each the row the lane names; the same tests pass on the current product |
| Appendix B seeds A, C, E, G on the current product | 4 of 4 pass (late insert fields kept; rule click keeps label and disabled commit; answer kept after 409; late reason kept) |
| New seeds on the current product | B-prime (all command-starting controls off), J (leave guard), L (late reviewer): pass. I (selection), H (re-read window): fail, see N1 and N2 |
| Mutation of the round-2 code: 22 single-expression mutants against the current tests | 18 killed, 4 survive: `upd-fallback` (equivalent, see M2), `isl-429`, `act-reset`, `asg-person` (N4, N5) |
| Worktree: the 10 touched dirs, `cms-editorial-workflow`, `cms-editorial-pages`, the inventory test, 7 bundle-closure tests, `no-store-redirects.test.ts` | 402 files, 4,214 tests, 0 failed, exit 0 |
| Same dirs with v8 coverage (scratch copy, byte-identical) | 373 files, 3,912 tests, 0 failed; **0 uncovered statements, branches or functions at the changed lines** of the 47 product files |
| `tsc --noEmit -p apps/web/tsconfig.json`, `prettier --check` (82 code, 6 md), `eslint --max-warnings=0` (82 files) on the 88 files | exit 0, clean, exit 0 |
| Proposals (`recite7/web7-proposals.json`) | 50 rows (48 AC-271, 2 AC-042 c5): every file plus full title exists in the run and passes; no repeated pair |
| Retitled tests since my review | 7 titles renamed; none of their first 60 characters occurs in `tests/contracts/phase-02-slice-12-evidence-ledger-*.ts` |
| Size rule | three product files and two test files over their limit: N3 |

### 3. Per finding: met or not met

| Finding | Result | Evidence |
|---|---|---|
| **M1** Review enabled during a command; label erased; review closed by the answer | **Met** | The lane reverted the round-1 split: row Review and `Review selected updates` are disabled by `busy` again (`CmsCompositionInstanceRow.tsx:72`, list line 63), as at HEAD. Seed B-prime: with an accept in flight, Review row 2, Detach row 2, Review selected, Detach selected, Accept and Detach as a local copy are all disabled, a click starts 0 diff reads, the label stays "Accepting the update…", and the controls come back after the answer. RED: the in-flight row, the list row and the bulk loading row fail on the round-1 product (3 failures) and pass now. Mutants `list-bulk-review` and `row-review` (drop the disabling) are killed by 2 and 3 tests. Residual: the in-flight row title says "the open review survives the answer" but asserts the label and the re-enabled Review, not an open review (N5) |
| **M2** late edits lost: insert fields | **Met** | `use-composition-insert.ts:155-168` clears the pattern and overrides only if they still equal what was sent, keeps slot path and link mode as edited, and sets the baseline to the sent fields. RED fails on the round-1 product (slot `/main`, pattern empty); the control row (untouched fields still cleared) passes on both. Seed A passes. Mutants `ins-item`, `ins-overrides`, `ins-keepall` are killed. Seed J: the leave guard is armed after a late edit and not armed without one, so "keep the form dirty" is true (but unasserted, N5) |
| **M2** answers flipped during the accept, then 409 | **Met** | `choicesNow` reads the panel through a ref and falls back to the dispatch-time choices when no diff of that instance is open (`use-composition-updates.ts:48-62`, calls at `:145`, `:265`, `:275`). RED fails on the round-1 product (yours restored); seed E passes; mutant `upd-choices` killed; the fallback branch is covered by `use-composition-updates.completion.test.tsx`. Mutant `upd-fallback` (drop the same-instance check) survives and is equivalent: another instance's diff cannot be open while a command runs because Review is disabled |
| **M3** rule chosen during the save | **Met** | `use-related-content-form.ts:172-182` has the same pending guard as `edited`. RED fails on the round-1 product (region `undefined`); seed C passes (label "Saving…", commit disabled, one call, still true after a click on it); mutants `rel-rule` and `rel-rule-conflict` killed by the loading row and the 409 row |
| **m1** G-A1 leftovers | **Met**, with N2 and N4 | The island hands the assignment form `assignments: []` while degraded (`CmsGovernedReviewDetailIsland.tsx:155`), so the reviewer label and the Revoke frame are gone: RED fails on the round-1 product ("Reviewer A" present), mutant `isl-assign` killed. The notice is `role="status"` (mutant `det-status` killed) and, for a non-429 degrade only, offers "Read the review again" on `canonical.refetch`; the island row clicks it and the review and Revoke come back, the button gone. Not covered by the lane: what shows while that read runs (N2) and that a 429 shows no button (N4) |
| **m3** taxonomy late-edit oracle | **Met** | I re-derived reachability: `blocked` includes `checking` and `failed` (`use-taxonomy-designer.ts`), and attempt 1 is verified only inside the `await checkLatest()` of its own `onSubmit`, so attempt 2 cannot be dispatched in that window; the "snapshot is the confirmed save's" distinction cannot diverge. The test is retitled to what it proves (the late-edit flag), the comment says so, the unused second scripted answer is gone. Mutant `tax-lateedit-bind` still survives and is equivalent in reachable flows, as the comment states |
| **m4** untested new behaviour | **Met**, all sub-items | (a) `placeNewRoots`: three rows (403 gate, 409 refresh plus two diff reads, unknown outcome); mutant `upd-403-roots` killed. (b) the page-level `reading` is gone with the prop. (c) `|| list.refreshing` on the open action form: a conflict-kept-open row; mutant `term-l8b` killed. (d) adopt buttons are disabled only while `checking` (both panels) with rows for checking, failed and answered; RED fails on the round-1 product; mutants `pd-adopt`, `td-adopt`, `pat-kept`, `tax-kept` all killed. (e) the three `useRef(() => undefined)` defaults are gone (counter state plus effect); `term-form-defaults.test.ts` and `pattern-status-copy.test.ts` exist; 0 uncovered changed lines |
| **m5** cheap part | **Met** | L2 latest row, C2 and C3 rows retitled; the B2 island row now starts `[P2-S12-AC-271] commandState disabled:`; the governed README cites DEC-242 for the queue cell. Not met in docs: N6 |
| **m2** (extra change `clearSent`) | **Met, no regression** | Section 4 |

### 4. The extra m2 change: `useDraftFields.typedValues` and `clearSent`

- Decision form: seed G passes (the reason extended during the held request is kept; the sent decision radio is cleared). Lane row plus mutant `dec-reset` (go back to `reset()`) killed.
- Assignment create: seed L with two reviewers (mounted with intent, as the lane's rows are): a reviewer chosen after dispatch is kept, the sent expiry and reason are cleared; mutant `asg-reset` killed. Mutant `asg-person` (clear the reviewer unconditionally) survives because the lane's row only "chooses" the empty reviewer; the behaviour is right (probe) but unproven.
- Activation: no row types after dispatch, so mutant `act-reset` survives. Reasoned behaviour: after success a late reason is invisible (the sent action is cleared and the reason field belongs to Retire), a late action choice stays; `choose()` in the committed phase still calls `restart()`; the time authority stays loaded when `scheduleChosen` flips, so there is no broken state. Nothing regressed, and nothing proves the new behaviour (N5).
- The other users of the shared hook (`CmsEditorialDecisionForm`, `CmsEditorialPublishConfirmation`, `CmsEditorialScheduleForm`): the interface only gained two members; the `cms-editorial-workflow` dir and the pages dir are green in the 402-file run; the hook file is 100% covered.
- Step-up restore: a restored draft is an overlay, not `typed`; `clearSent({})` clears nothing and `reset()` never cleared it either, so behaviour is the same as before.

### 5. Earlier fixes

| Fix | Result |
|---|---|
| unit5 leave guard | green: template `unsaved` and `unsaved-guard`, `CmsCompositionPage.unsaved`, term form guard; seed J shows the insert guard follows late edits |
| unit5 late edits (template, vocabulary, locale) | green: `CmsTaxonomyVersionDesigner.late-edit` (retitled, m3), `CmsLocaleVariantForm.late-edit`, template unsaved-guard rows |
| web6 commit-only disabling and result heading | green: template `pending` and `result-focus`, insert, diff and bulk loading rows (the bulk row now also pins the disabled Review and Detach) |
| 403 gate focus fix | `CmsTemplateStatus.tsx` unchanged since my first review; the template row asserts the summary region, the other eight rows assert the gate heading; all green; the 403 rows were not edited in round 2 (the round-2 diff of the test files touches other rows only) |
| D1, D2, L1 to L8, A1, A6, A7, B2, AC-042 c5 | untouched by round 2 except the adopt buttons (m4); their tests pass |

### 6. May the B4 and A5 `loading` rows be cited?

**Yes, as evidence for what each asserts.** A5: `CmsRelatedContentForm.states.test.tsx` loading row (pending label stable, only the commit control disabled, the Derived rule fieldset enabled, a pin and a rule click keep the label). B4: `CmsPatternInsertForm.states` loading (fields editable), `CmsPatternUpdateDiff.states` loading (answers editable), `CmsBulkUpdatePanel.states` loading (selecting enabled; Review and Detach disabled) and `CmsCompositionPage.in-flight` rows 1 to 4. Each fails when its fix is reverted (sections 2 and 3). Three cautions: (1) in-flight row 2 says "keep the form dirty" but asserts values only, and row 1 says "the open review survives the answer" but asserts the label and the re-enabled controls; cite them for what they assert or fix the titles (N5, seeds in Appendix D). (2) N1: a row checkbox toggled during a command is lost at completion; if root counts checkboxes as inputs under its reading, hold the closure of the composition `loading` part until N1 is fixed (the rows themselves stay valid). (3) N2 concerns the governed detail, not these rows: do not cite the G-A1 degraded row (`CmsGovernedReviewDetailIsland.states.failure.test.tsx:139`) with its present wording, because it claims the review is re-shown "only after a later read verifies" and the product re-shows it when the read starts.

### 7. New findings

**N1 (MINOR). A row selection made during a command is overwritten when the command completes.** `prune` (`use-composition-updates.ts:68-73`) and `runSequence` (`use-composition-bulk.ts:131-133`) copy the `selected` set captured when the command was issued and `setSelected` it back. The row checkbox is never disabled (`CmsCompositionInstanceRow.tsx:53`), and the lane's bulk loading row asserts that checkboxes stay enabled during the command, so a toggle is possible and then lost. Seed I: row 1 selected, Detach row 1 held, row 2 ticked ("2 selected"), the answer arrives and the list reads "0 selected" with row 2 unticked. The same seed fails identically against the HEAD product, so this is not a web7 regression, but it is the late-edit class of M2 and falls under root's reading. Fix: `setSelected((current) => ...)` removing only the processed ids; seed I is the RED test.

**N2 (MINOR). While a re-read of a degraded governed detail is in flight, the unverified review is shown again and the commit controls are enabled for the first 250 ms.** `refetch` sets `status` to `refreshing` (`use-cms-workflow-canonical.ts:76`), the island's `degraded` is `status === 'degraded'` (`CmsGovernedReviewDetailIsland.tsx:83`), so the degraded branch ends when the read starts. Seed H (button path, held read): "Frozen version" and "Reviewer A" are on screen, the Record control has `aria-disabled="false"`, and only after the 250 ms delay does it turn `true` with "Loading the current review". The 429 auto-retry has the same window (second seed run): this is a gap in my first review (I only looked at the end states), now reachable by the user through the new button. A stale command is still refused by the version check, so the risk is the display of unverified data that DEC-241 item 1 says is not kept. Fix: keep the degraded branch until a read verifies (a `reverifying` flag), and assert the in-flight window; until then narrow the wording of the cited degraded row.

**N3 (MINOR). Round 2 broke the size limits that the brief and the first-round check require.** `CmsGovernedReviewDetail.tsx` 208 lines (component limit 200), `CmsGovernedAssignmentCreate.tsx` 204 (200), `use-composition-updates.ts` 311 (hook limit 300); tests `CmsGovernedAssignmentForm.states.test.tsx` 419 and `CmsGovernedReviewDetailIsland.test.tsx` 407 (limit 400). The lane's own report still says components are at most 200 and hooks under 300. Fix by extraction (the degraded notice into its own component, the assignment-create draft clearing into a hook, the panel-ref and `choicesNow` into a small hook, the new island row into its own test file).

**N4 (MINOR). Nothing asserts that a 429 degrade shows no "Read the review again" button.** Mutant `isl-429` (show the button for every degrade) survives all 19 island tests. The button reads at once and clears the Retry-After wait (`refetch` calls `clearWait`), so it would let a rate-limited reader bypass the stated wait. One assertion in the 429 rows.

**N5 (NIT). Titles and proofs that claim more than they assert.** In-flight row 1 ("the open review survives the answer"), row 2 ("keep the form dirty", seed J is the assertion), and the unproven mutants `asg-person` (a different reviewer chosen late; seed L is the assertion) and `act-reset` (activation late edit).

**N6 (MINOR). Documentation contradicts the product.** `cms-composition-instances/README.md:58-61` still says the review controls stay enabled during a command and "wait only for a running diff read", the behaviour M1 withdrew; the brief requires READMEs to be updated. The lane report's per-cell B4 row (line 32) says the same, its sentence "Components at most 200 lines, hooks under 300" (line 75) is now false (N3), its G-A1 row says the review is re-shown "only after a read verifies" (N2), and its Status, "Still pinned" and Open-items text still treat the queue cell as an open BOUNDARY although DEC-242 settled it (the Fix round 2 tail says so, the head does not). Also stale: "the clear-draft refs are assigned in an effect" (the refs are gone).

### 8. Conditions and requests to root

- R1 (blocks commit, N3): get the five files within the limits.
- R2 (blocks commit, N6): correct `cms-composition-instances/README.md:58-61` and the stale rows of the lane report.
- R3 (before citing the G-A1 degraded row, N2): fix the window or narrow the row's wording.
- R4 (follow-ups): N1 (selection), N4 (429 assertion), N5 (titles, two assertions).
- R5 (unchanged from the first round): the real-route specs and the bundle check below. Round 2 adds to the bundle question only the shared `cms-editorial-workflow/use-cms-workflow-draft-fields.ts` (about 20 added lines in a hook that Slice 11 and Slice 12 forms import); `pnpm build && pnpm bundle:check` should still run once.
- Real-route specs (project `real-route-chrome`): the list of section 7 of the first round stands. Round 2 changes what to look for: in `phase-02-slice-12-page-operations-real-route.spec.ts` the instance-insert form keeps late edits and the Review and Detach controls are disabled during any command (as at HEAD); in `-governed-review-`, `-protected-decision-` and `-definition-journeys-real-route.spec.ts` success clears only what was sent (a step-up restored draft is unaffected: lines 206 to 214 and 373 to 382 assert restored values, not post-success values). No real-route spec reads the "Read the review again" button, the degraded detail or the composition selection.

### Appendix C: SHA-256 of the 88 files verified in this round

```
ae36243c892a2ad2ada6b4a40a0091a5df1203617acf3595eeb89e75b41c1d0d    96  cms-composition/CmsLatestReadLoading.test.tsx
f360ffa894f608477dca7e1b7871aa48985fcfc3928f683b03d1d312ec7da3e3    91  cms-composition/CmsTemplateDesigner.result-focus.test.tsx
a61daf514507b6f6aaa9c17c8d1ecfb4cc054c1419940c05dbb8ce5d80fc1cd0   360  cms-composition/CmsTemplateDesigner.states.test.tsx
eff6ac56a919089cb6f849cb6c541422299484b2b1dbd6400a32504ae3259d44   195  cms-composition/cms-template-designer-submit.ts
117e1f7b36382f76b1e306abfc4cd1e5ead17f059b7cc1717649173b4df4b8fe   194  cms-composition/CmsTemplateDesigner.tsx
1c8f5ebe2d8b2246161c2eda143e4140dcf7fb66775fda68d06be727260f149c   313  cms-composition/CmsTemplateEditDesigner.latest-states.test.tsx
59ccd2cb7d11356b59781ae8a775df8220440528792ea2888fb8bf2f71aff3bb   186  cms-composition/CmsTemplateEditDesigner.tsx
b9573ffea9deaf9dc32a1f6b4ebe953a806c5f919a75383817a8e1007f222648   205  cms-composition/cms-template-edit-reconcile-state.ts
8ffed478ee1dc6ab6612bcc6c5a3bfce475ee0fec10023ec305b606aa531c180   152  cms-composition/CmsTemplateFields.tsx
450ea1d2af68a7115356aecc658d83331ead04367dd363b569d7e526ea44993d   159  cms-composition/CmsTemplateStatus.tsx
1eb085aa11a8faa00c21effd74cd35e41d10e886cc9d5b8bfae75dd83e0d38ee   308  cms-composition-instances/CmsBulkUpdatePanel.states.test.tsx
ed8ad343945a66ed8e30bdbb0ab6f3b7b986c7c657b097988076b9563b4a8093   232  cms-composition-instances/CmsCompositionInstanceList.test.tsx
d999ac56b3d8337f786b0d624111e482b38c919cee3e8e8ceb794a34ab2dd8a6   121  cms-composition-instances/CmsCompositionInstanceList.tsx
0c0c702870d6783d70cbad413d88f88daa8024d141fb77e8b9cfdaf539ec2556    92  cms-composition-instances/CmsCompositionInstanceRow.tsx
374864ce5566012bad4ea4ccd343a07fb690869c8943f2c9c689bff38ee95cab   263  cms-composition-instances/CmsCompositionPage.in-flight.test.tsx
d0c12d3b77b8ca60dacfc8ffd6d4a086264458eb2ac65a1e49c738c4bbe882e6   176  cms-composition-instances/CmsCompositionPage.selector-states.test.tsx
e4b9ee0845fef43b95d654dc51ebca7e5ac78e1f7512279c7df02723e5decc81    54  cms-composition-instances/CmsCompositionStatus.tsx
252ee715f18efb8e35eb3693662c63f82eafe5f8ec3a1f5ecce7c8763b446d07   290  cms-composition-instances/CmsPatternInsertForm.states.test.tsx
8ca61a637da147e4ff241fab761c4cc87cffb56886b74ac495b6f83724b24284   197  cms-composition-instances/CmsPatternInsertForm.tsx
2fe5b95dcb3b1be3c4be31525e6608d724c2a4c49f91b930ba309b59cff26937   391  cms-composition-instances/CmsPatternUpdateDiff.states.test.tsx
01a3f78ce909f40fdef4f237f3785744bcc5fefe8d35d534b647fbc650cf72b5   131  cms-composition-instances/CmsPatternUpdateDiff.tsx
43bc1696d85486bbbe3eba86f6733a24a7c46251095b3c3b25157877757a4b31    57  cms-composition-instances/composition-status.ts
85248bfda4ae1be6ca505a90d00b44364554cacd49316b91df13e1d052efb919    98  cms-composition-instances/README.md
e62ab7cee389267c9ff2bcc139d28546a88f41fabaf97e3ee1ac89926c5a3b2b   190  cms-composition-instances/use-composition-bulk.ts
74ae0ceb2da848b3bdedd0ba35d42eab9adc5173d91ae2f1781f5050ee8dde7d   248  cms-composition-instances/use-composition-insert.ts
31294559c00461a202528f3527f9b6b3fbb3dd11b85377b9df74a4bba8e35242    83  cms-composition-instances/use-composition-updates.completion.test.tsx
87009aabe2f129294b65a23fe3865df7b0d49b3371c88879c5ed82f336d4d208   311  cms-composition-instances/use-composition-updates.ts
f067eced2c38beb258bfcd4692d4f93698e05d037cc6c388701f5ee1db5d4284   123  cms-composition/README.md
797a364160eb01bf88b8a6d8c5b3caf9e279ff600d971908210a93f22ff98bd9    40  cms-editorial/CmsEditorialCapabilityGate.tsx
de186d39e3e1e05b071e904800dec6d26b3649ce4dd6fe3d4fb15cfb23100b54   168  cms-editorial-fields/CmsTaxonomyFieldConnected.tsx
70bfb03091131b3cd76f0477f18c6ca18388799ac68a08d3ecc5ae03ba9de20b   187  cms-editorial-fields/CmsTaxonomyFieldEditor.connected-states.test.tsx
26ac0323c5dc776942f2b46f109a2e259fda20d022f167f2024b20b59f96b2d2   382  cms-editorial-fields/CmsTaxonomyFieldEditor.connected.test.tsx
ce6153f8417e56188d3e344992169a868f20b6f5f9c04fdc2241c924538cd8a9   138  cms-editorial/README.md
65c44c10b5a7e204d55ea0008fc2674b5007c5d6bdc2d638d4ee9a827dc870f3    47  cms-editorial-workflow/use-cms-workflow-draft-fields.ts
1952a2f92d330834923bb1d78562d640219185c258e51ddbe2043472bd535a9b   328  cms-governed-review/CmsGovernedActivationForm.states.test.tsx
658ce1b586fd6a0eadae1e285a756b497aa0c9356a52198fcc359ccd781b305b   204  cms-governed-review/CmsGovernedAssignmentCreate.tsx
e76815ca24ff236cdf5d2bd39cd0363c79999614a690956990ea3e5591cf7bf3   419  cms-governed-review/CmsGovernedAssignmentForm.states.test.tsx
14e5bf87acad33d468b236b4fea9643578d42ae63d1cfb883115091ff3cc77c8    98  cms-governed-review/CmsGovernedDecisionForm.late-edit.test.tsx
c6415052c098ff56d2d56738beec163679f8ee1ad2faebfeddb6910ab39665c3   325  cms-governed-review/CmsGovernedDecisionForm.states.test.tsx
9583736b1ab68d4981c23e5eae9d33efb1b08d3ea6c0744f7a38c6a319ceabd1   197  cms-governed-review/CmsGovernedDecisionForm.tsx
c434d065b4ce1fa272c7c541c6aebb6e28c9572716fa570d5bcf1aa72b66a53e   145  cms-governed-review/CmsGovernedReviewDetailIsland.rate-limit.test.tsx
a0afc1b8c1b5b368f2a878084022d14b0123e2eb89db9ad78a4dd76361c882a3   224  cms-governed-review/CmsGovernedReviewDetailIsland.states.failure.test.tsx
7b9e5c747d4c6621088a3cf1f67af8b2270b075e795cffc8a0e6944a9dd5a6bc   115  cms-governed-review/CmsGovernedReviewDetailIsland.states.test-support.tsx
50aa80252e22f605b3674d2476eb0822e9fac31b9295c6ebce1575abea94297b   407  cms-governed-review/CmsGovernedReviewDetailIsland.test.tsx
bfa1626914381ddfb35332b4213d22c814bc74a38c2ffc6962a09ea2c17b6e50   178  cms-governed-review/CmsGovernedReviewDetailIsland.tsx
21d9a6401364a9f99b19d9ac24b2a839c6ec312c65de18520baa42105df956f6   245  cms-governed-review/CmsGovernedReviewDetail.test.tsx
8c7b126d757fb6c39316d5eadd7a9ce5275d2feecec7e7aee7cecc870a299403   208  cms-governed-review/CmsGovernedReviewDetail.tsx
511876dee1923adef8d8f6e8d76d8cad3d3e77a6b14b2ca6003dca2c5755881c   135  cms-governed-review/README.md
e754fcad30cefe57cdd1fd9dbe178735301977198484498e7897638f3e0a6f47   236  cms-governed-review/use-governed-activation-form.ts
12ee6601a56886e12bf8f61101765add680ab7c34945af3803a40da73c6a85ca   116  cms-locale/CmsLocaleStatus.tsx
de57d98649332157227c483e5a4c5a8598bdaf3825f3a06e2be76a13051c28c6   246  cms-locale/CmsLocaleVariantForm.states.test.tsx
1f0dcfbcff796826a01a709717efbd27db8180e80593ff05b54857f843ae7307   127  cms-pattern-designer/CmsPatternConflictPanel.tsx
929b11ec5b7da4ca8c401f679a6f1e86bd915ba287ccb797d10e9227bf37bd47   174  cms-pattern-designer/CmsPatternStatus.tsx
0b2ca9fdcf037b3b677d84f5ab29d4f8d32ed8e6e1f695b0c794063c7cb7eeb6   293  cms-pattern-designer/CmsPatternVersionDesigner.latest-states.test.tsx
8c834a84e54447d17a91ed8384947554c38d1be207575f208e61c3c718d97aba   337  cms-pattern-designer/CmsPatternVersionDesigner.states.test.tsx
af8a83a66b74041cf8bde226187a6c41c4d91dcc44b09f320b4048794d29064a   199  cms-pattern-designer/CmsPatternVersionDesigner.tsx
ed5dc572a3984be88fcc46c4cda4737fbc87250288b9ddc2dbb69d11f4fe5215    33  cms-pattern-designer/pattern-status-copy.test.ts
037dd3852d64cc82050c739e5502a1aae85200da789a369a7a43a009a024f08a    46  cms-pattern-designer/pattern-status-copy.ts
5ce55cc302ba5f20a1a43afce9a4a1125ba8898be468801d60282db74e800965   100  cms-pattern-designer/README.md
6546be9589977057c4f84894d9457069d0c415fcb9128d0fc9e52daaeb0306ba   216  cms-pattern-designer/use-pattern-conflict.ts
d3f37472aff2b0bab2bcbf82c7c971c1085fec7ba650587badcc1506a52e6da9   210  cms-pattern-designer/use-pattern-designer.ts
91a31ce528d2e25f563bbf281ecb768ab7322d91315536c2d23f15a5ef219e50   276  cms-related-content/CmsRelatedContentForm.save.test.tsx
f5029c922d4677d2cae17d603fb361d2664a938446bfcdb993158021c3e594ed   314  cms-related-content/CmsRelatedContentForm.states.test.tsx
fafcfbd4c1596bfad37e3ae152c12747658252182be00a8cdb154e6e887f6a27   150  cms-related-content/CmsRelatedContentForm.tsx
183cb8170f86f61d53e660efe12a6c075d249ad92f40e4b8857a62179c5c100b    98  cms-related-content/CmsRelatedRuleFields.tsx
edfc7d301581ed35d286a7125e806aa232691a71044fcf0a81349401dae7d32d   137  cms-related-content/CmsRelatedStatus.tsx
d9696aee8f5154e86775a49304d57f9d4d927312d54ed0d44c62149c8b59a731   291  cms-related-content/use-related-content-form.ts
6bd612233373f49c8a30a199d9d473ea175a4a9bb04e728eec7a091b6ba9cb38    68  cms-taxonomy-designer/CmsTaxonomyConflictPanel.loading.test.tsx
8651a17cbb675fa8c3187841674585cab37ee5569e989618fa8c76cf9cea7209   115  cms-taxonomy-designer/CmsTaxonomyConflictPanel.tsx
bcf6a6794dd28977232a807da51d7dfad56d2e147a389573660133c7ec1c03f0   184  cms-taxonomy-designer/CmsTaxonomyStatus.tsx
96a8fc000183f49a84611a62256c5ec9b99e516f21b36dada3a1728a3edeec35   117  cms-taxonomy-designer/CmsTaxonomyVersionDesigner.late-edit.test.tsx
52538a48520ae021951ec062923c20150364a22351abaabb056580922cade545   280  cms-taxonomy-designer/CmsTaxonomyVersionDesigner.latest-states.test.tsx
5298d231967e3d8f892a8a010203b594b3bdec0a68cd51b0abb6e1eee90d647e   258  cms-taxonomy-designer/CmsTaxonomyVersionDesigner.states.test.tsx
2b822ebe9e8c10fd5d430b48ee664de63d3fec198ff85a857c5b31fcccfe21ca   166  cms-taxonomy-designer/CmsTaxonomyVersionDesigner.tsx
965d2d76381673a6db287db22ed03a59351c2fa7325ad1ffebbe4a119997319c    94  cms-taxonomy-designer/use-taxonomy-conflict.ts
c7a3fbe00ecdf9b777d3480f724fe577c8bbede0f15022ec26c136fd192f120d   266  cms-taxonomy-designer/use-taxonomy-designer.ts
b85905f69aa8a71162c1c7bd5851e173b80591bf814e91e00a161d91bb680926   198  cms-taxonomy-terms/CmsTaxonomyTermAction.tsx
7fec25c2f18a9919c9cefa54e5db40ce4ab7d2d30a1700d1788e8af49d0afee8   360  cms-taxonomy-terms/CmsTaxonomyTermForm.latest-states.test.tsx
df4c1c60497e73569a9af2c0a018ea103ae0221c81ded101177a653dfe8ed686   267  cms-taxonomy-terms/CmsTaxonomyTermForm.states.test.tsx
d5b3036163d817ffd6322324560b299c9f6f2b1429fdc287afa98cc03e7bf30f   196  cms-taxonomy-terms/CmsTaxonomyTermForm.tsx
b61ed6fccb97ccb31a4fa33782a62ebb91eeb8d4827f73a551978e703624a369    34  cms-taxonomy-terms/CmsTaxonomyTermListNotices.tsx
3874f34813f1c69742fb6c1a62a2a9f13b1c7ee080b8148544e718c663872f35   163  cms-taxonomy-terms/CmsTaxonomyTermStatus.tsx
e66b12f68adf2f8d936c4108a97710c6a9ea18f9846161c1fe29cf34a748d024    84  cms-taxonomy-terms/README.md
3e0a3f7e86f16a82d5e022a2269ad71b0a3d8570354192aff28d7df0d0ef58bd    84  cms-taxonomy-terms/term-copy.ts
80133628f085faa9666e33d301489061714b487dfac6bd46b6c714a326febddc    31  cms-taxonomy-terms/term-form-defaults.test.ts
7d4734960ffb0822ccdf6917ac45805e7fb4cb3997486775490aa5f0a1a72faf    17  cms-taxonomy-terms/term-form-defaults.ts
8a331c9b31b4c4955dbedd95a7217346fbe5eef6c35b7fe669608cfe3e4272eb    21  cms-taxonomy-terms/use-term-action-focus.ts
db10d75c2501703f374ebd47c612790a3af6694c4203df91b130c646d530717f   225  step-up-required.inventory.test.ts
```

### Appendix D: seeds of the verification round

Complete Vitest files for the directory named, built from the existing harnesses. I and H fail on the reviewed state (N1, N2); J and L pass and are the missing assertions of N5; B-prime pins the new reading of M1. Scratch quality (unused locals): tidy and title them `[P2-S12-AC-271] ...` before committing.

#### N1 seed I (selection toggled during a detach), directory cms-composition-instances: `ZZProbe.selection-during-command.test.tsx`

```tsx
// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { answerHeld, heldReply } from './composition-command-states.test-support';
import { UPDATE, json, mountPage, settle } from './composition-page.test-support';
import { row } from './composition.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

const updated = () =>
  json({ items: [row(1, { version: '4', patternVersion: 2, linkMode: 'detached', state: 'active' })] }, 200, '"10"');
const selectedCount = (c: HTMLElement) => c.querySelector('.cms-instances .cms-composition-actions span')?.textContent ?? '';
const check = (c: HTMLElement, n: number) => c.querySelector<HTMLInputElement>(`#cms-instance-018f0c45-73fe-7dc2-9c09-${String(n).padStart(12, '0')}-select`) as HTMLInputElement;

describe('PROBE I composition: a row selected while a detach is in flight', () => {
  it('keeps the selection the author made while the command ran', async () => {
    const held = heldReply();
    const page = mountPage({ [UPDATE]: [held.reply] }, { instances: [row(1), row(2)] });
    const c = page.container;
    await click(check(c, 1));
    const before = selectedCount(c);
    await click(buttonNamed(c, 'Detach /main/row-1'));
    await settle();
    const checkboxEnabled = !check(c, 2).disabled;
    await click(check(c, 2));
    const during = selectedCount(c);
    await answerHeld(held, updated());
    await settle();
    const after = { text: selectedCount(c), row2: check(c, 2).checked };
    expect(after.row2).toBe(true);
  });
});
```

#### N2 seed H (what shows while the offered re-read is in flight), directory cms-governed-review: `ZZProbe.reread-in-flight.test.tsx`

```tsx
// @vitest-environment jsdom
import { act } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadCmsValidators } from '../../lib/cms-contract-validators';
import { buttonNamed, click, disableReactAct, enableReactAct, flush } from '../cms-editorial-fields/cms-editor-dom.test-support';
import { preloadWorkflowAnswerMachinery } from '../cms-editorial-workflow/cms-workflow-answer-machinery.test-support';
import { everyFormReview, mountDetail, provokeRefetch, type Read } from './CmsGovernedReviewDetailIsland.states.test-support';

beforeAll(preloadWorkflowAnswerMachinery);
beforeAll(enableReactAct);
beforeAll(async () => { await loadCmsValidators(); });
afterAll(disableReactAct);
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('PROBE H governed detail: the re-read offered by a degraded notice', () => {
  it('does not show the unverified review again while the re-read is in flight', async () => {
    const review = everyFormReview();
    let release: (r: Read) => void = () => undefined;
    const second = new Promise<Read>((resolve) => { release = resolve; });
    const reads: Array<Promise<Read> | Read> = [{ kind: 'degraded', requestId: null }, second];
    const readReview = vi.fn(async () => (await reads.shift()) as Read);
    const { container } = mountDetail(review, readReview);
    await flush();
    await provokeRefetch(container);
    const degraded = { notice: container.textContent?.includes('The review is not shown'), frozen: container.textContent?.includes('Frozen version') };
    await click(buttonNamed(container, 'Read the review again'));
    const early = { frozen: container.textContent?.includes('Frozen version'), label: container.textContent?.includes('Reviewer A'), notice: container.textContent?.includes('The review is not shown'), recordAria: buttonNamed(container, /^Record/u).getAttribute('aria-disabled') };
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    const late = { frozen: container.textContent?.includes('Frozen version'), notice: container.textContent?.includes('The review is not shown'), recordAria: buttonNamed(container, /^Record/u).getAttribute('aria-disabled'), loading: container.textContent?.includes('Loading the current review') };
    await act(async () => { release({ kind: 'ok', resource: review }); });
    await flush();
    const done = { frozen: container.textContent?.includes('Frozen version'), notice: container.textContent?.includes('The review is not shown') };
    expect(early.frozen).toBe(false);
  });
});
```

#### N5 seed J (insert leave guard after a late edit), directory cms-composition-instances: `ZZProbe.insert-dirty.test.tsx`

```tsx
// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buttonNamed,
  byLabel,
  choose,
  click,
  disableReactAct,
  enableReactAct,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { answerHeld, heldReply, pattern } from './composition-command-states.test-support';
import { PLACE, json, mountPage, settle } from './composition-page.test-support';
import { row, selectorItem } from './composition.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

const hero = selectorItem('hero-block', 2);
const placed = () =>
  json({ items: [row(1, { path: '/main/hero1', patternVersion: 2, state: 'draft' })] }, 201, '"10"');
const outsideClick = async (c: HTMLElement) => {
  const a = document.createElement('a');
  a.href = '/app/cms-content-modeling';
  a.textContent = 'elsewhere';
  document.body.appendChild(a);
  await click(a);
  a.remove();
  return document.body.textContent?.includes('Leaving this page discards them') ?? false;
};

describe('PROBE J insert form: the leave guard after a placement answered while the author kept typing', () => {
  const run = async (late: boolean) => {
    const held = heldReply();
    const page = mountPage({ [PLACE]: [held.reply] });
    const c = page.container;
    await choose(pattern(c), hero.patternVersionId);
    await click(byLabel<HTMLInputElement>(c, /^Linked/u));
    await typeInto(byLabel<HTMLInputElement>(c, 'Slot path'), '/main');
    await click(buttonNamed(c, 'Place pattern'));
    await settle();
    if (late) await typeInto(byLabel<HTMLInputElement>(c, 'Slot path'), '/late-slot');
    await answerHeld(held, placed());
    await settle();
    return outsideClick(c);
  };
  it('arms the guard only when something was typed after dispatch', async () => {
    const withLate = await run(true);
    document.body.replaceChildren();
    const withoutLate = await run(false);
    expect({ withLate, withoutLate }).toEqual({ withLate: true, withoutLate: false });
  });
});
```

#### N5 seed L (a different reviewer chosen after dispatch), directory cms-governed-review: `ZZProbe.assignment-late-reviewer.test.tsx`

```tsx
// @vitest-environment jsdom
import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { preloadWorkflowAnswerMachinery } from '../cms-editorial-workflow/cms-workflow-answer-machinery.test-support';

import { loadCmsValidators } from '../../lib/cms-contract-validators';
import { MemoryStorage } from '../../lib/test-support/memory-storage';
import {
  buttonNamed,
  byLabel,
  choose,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountWithIntent,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  governedAssignmentFixture,
  governedAssignmentSummaryFixture,
  governedDetailFixture,
  jsonResponse,
} from '../../server/cms-governed-review-fixtures.test-support';
import CmsGovernedAssignmentForm from './CmsGovernedAssignmentForm';
import { heldWire } from './governed-command-states.test-support';
import { flushUntil, governedEnvironment } from './governed-review-form-test-support';

beforeAll(preloadWorkflowAnswerMachinery);
beforeAll(enableReactAct);
beforeAll(async () => { await loadCmsValidators(); });
afterAll(disableReactAct);

const A = '0195b6f0-0000-7000-8000-00000000a001';
const B = '0195b6f0-0000-7000-8000-00000000a002';
const NOW = Date.parse('2026-10-15T12:00:00Z');
const DAY = 86_400_000;
const local = (ms: number) => new Date(ms).toISOString().slice(0, 16);

describe('PROBE L assignment form: a different reviewer chosen while the assignment is in flight', () => {
  it('keeps the reviewer chosen after dispatch and clears everything that was sent', async () => {
    const wire = heldWire();
    const refetch = vi.fn(async () => true);
    const { container } = mountWithIntent(
      <CmsGovernedAssignmentForm
        review={governedDetailFixture({ version: '2', permittedNextActions: ['assign_reviewer', 'revoke_assignment'], assignments: [governedAssignmentSummaryFixture()] })}
        disabledReason={null}
        refetch={refetch}
        onDone={vi.fn()}
        now={() => NOW}
        loadOptions={async () => ({ kind: 'ok', options: [
          { personId: A, endsAt: new Date(NOW + 30 * DAY).toISOString() },
          { personId: B, endsAt: new Date(NOW + 30 * DAY).toISOString() },
        ] })}
        environment={governedEnvironment(wire.fetcher, new MemoryStorage(), vi.fn())}
      />,
    );
    const reviewer = () => byLabel<HTMLSelectElement>(container, 'Reviewer');
    await flushUntil(() => reviewer().options.length >= 3);
    await choose(reviewer(), A);
    await typeInto(byLabel<HTMLInputElement>(container, 'Assignment ends'), local(NOW + DAY));
    await typeInto(byLabel<HTMLTextAreaElement>(container, 'Reason (optional)'), 'Legal slot.');
    const chosenBefore = reviewer().value;
    await click(buttonNamed(container, 'Assign reviewer'));
    await flushUntil(() => wire.fetcher.mock.calls.length > 0);
    await choose(reviewer(), B);
    wire.settle(jsonResponse(201, governedAssignmentFixture(), { etag: '"1"' }));
    await flushUntil(() => refetch.mock.calls.length > 0);
    await flush();
    const after = { chosenBefore, sent: wire.fetcher.mock.calls.length, reviewer: reviewer().value, ends: byLabel<HTMLInputElement>(container, 'Assignment ends').value, reason: byLabel<HTMLTextAreaElement>(container, 'Reason (optional)').value };
    expect(after).toEqual({ chosenBefore: A, sent: 1, reviewer: B, ends: '', reason: '' });
  });
});
```

#### M1 seed B-prime (every command-starting control off while an accept is in flight), directory cms-composition-instances: `ZZProbe.review-disabled.test.tsx`

```tsx
// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { answerHeld, heldReply, resultRegion } from './composition-command-states.test-support';
import { UPDATE, diffPath, json, mountPage, settle } from './composition-page.test-support';
import { diffOf, id, plainPath, row } from './composition.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

const pending = (n: number) => row(n, { state: 'pending_diff', version: '3' });
const diff1 = diffOf(1, [plainPath('/a')]);
const diff2 = diffOf(2, [plainPath('/b')]);
const read = (value: typeof diff1) => json(value, 200, `"${value.instance.version}"`);
const updated = () =>
  json({ items: [row(1, { version: '4', patternVersion: 2, linkMode: 'detached', state: 'active' })] }, 200, '"10"');

describe("PROBE B' composition: every command-starting control is off while a command is in flight", () => {
  it('keeps the pending label, starts no read and re-enables the controls after the answer', async () => {
    const held = heldReply();
    const page = mountPage(
      { [diffPath(id(1))]: [read(diff1)], [diffPath(id(2))]: [read(diff2)], [UPDATE]: [held.reply] },
      { instances: [pending(1), pending(2)] },
    );
    const c = page.container;
    await click(buttonNamed(c, 'Review update for /main/row-1'));
    await settle();
    await click(buttonNamed(c, 'Accept update'));
    await settle();
    const off = ['Review update for /main/row-2', 'Detach /main/row-2', 'Review selected updates', 'Detach selected', 'Accept update', 'Detach as a local copy'].map((n) => [n, buttonNamed(c, n).disabled]);
    await click(buttonNamed(c, 'Review update for /main/row-2'));
    await settle();
    const label = resultRegion(c)?.textContent ?? null;
    const reads = page.calls.filter((x) => `${x.method} ${x.path}` === diffPath(id(2))).length;
    await answerHeld(held, updated());
    await settle();
    const after = ['Review update for /main/row-2', 'Detach /main/row-2'].map((n) => [n, buttonNamed(c, n).disabled]);
    expect(off.every(([, d]) => d === true)).toBe(true);
    expect(label).toBe('Accepting the update…');
    expect(reads).toBe(0);
    expect(after.every(([, d]) => d === false)).toBe(true);
  });
});
```

Seed H also has a 429 variant (the Retry-After read held; `hasButton` is false and the same stale review shows); it differs from H only in the scripted degraded answer (`rateLimit: { retryAfterSeconds: 6 }`), the 6 s timer advance in place of the click, and the `hasButton` check.

## Verification round 2 (lane web7 "Fix round 3")

Same rules as before: read-only except this file; every mutation, differential run and probe ran in scratch copies of `apps/web` (`node_modules`, `packages` and `supabase` symlinked); focused Vitest and `tsc --noEmit` only; no Playwright, db, build or sub-agent. The section "Fix round 3 (review V17 verification round, 2026-10-29)" of `lane-web7-report.md` answers N2, N3, N4 and N6. By the lane's own statement N1 and N5 and the nits n1 to n5 stay open, and nothing in this round touched them.

### Verdict of this round

**ACCEPT-WITH-CONDITIONS, narrowed again.** N2, N3, N4 and N6 are **met**, no earlier fix regressed, and no BLOCKER and no MAJOR remains. Three new findings: **MINOR 2 (N7, N8), NIT 1 (N9, three small points)**. Still open from earlier rounds: N1 (MINOR), N5 (NIT), n1 to n5 (NIT).

**May the G-A1 degraded row be cited? Yes for the governed-detail cell, but not alone and not before N8 is repaired.** The product now matches FE03 1050 and DEC-241 item 1 for the governed detail (section 3, N2). The cited row itself, `CmsGovernedReviewDetailIsland.states.failure.test.tsx` "governedReviewState degraded: a failed read does not keep the stale review ... and re-shows the review and re-enables the forms only after a later read verifies", passes, but it cannot prove its own last clause: its second read resolves at once, and that file plus the six other detail and island suites (7 files, 58 tests) pass 58 of 58 against the round-2 island that showed the unverified review during the read (run E1). The words "only after a later read verifies" are proven by two new rows of `CmsGovernedReviewDetailIsland.reread.test.tsx` (revert-checked, section 2). Cite the cell with all three tests, or have the lane hold the second read in the cited row. Whether the whole `degraded` part of AC-271 can be closed is root's call under its "every island of that part" rule; the lane lists A3 (an unknown outcome is reconciled by a refetch before any retry, the `commandState` degraded cell) as still open, so cite the governed-detail cell, not the part.

Conditions: R1 (before citing the G-A1, m1 and m2 cells): N8. R2: N7. Everything else is follow-up.

### 1. State verified

- 94 files under `apps/web` (round 2: 88): 10 changed and 6 new since my manifest of the previous round. Changed: `cms-composition-instances/README.md`, `use-composition-updates.ts`; `cms-governed-review/` `README.md`, `CmsGovernedAssignmentCreate.tsx`, `CmsGovernedAssignmentForm.states.test.tsx`, `CmsGovernedDecisionForm.tsx`, `CmsGovernedReviewDetailIsland.test.tsx`, `CmsGovernedReviewDetailIsland.tsx`, `CmsGovernedReviewDetail.tsx`, `use-governed-activation-form.ts`. New: `use-composition-panel-now.ts`, `CmsGovernedReviewDegraded.tsx`, `use-governed-sent-draft.ts`, `CmsGovernedAssignmentForm.late-edit.test.tsx`, `CmsGovernedAssignmentForm.states.test-support.tsx`, `CmsGovernedReviewDetailIsland.reread.test.tsx`.
- The lane's refreshed Files table (95 rows: the 94 plus `recite7/web7-proposals.json`) matches the tree on hash and line count, 95 of 95. Two older hash rows in the "Fix round (root browser gate)" section (`CmsRelatedContentForm.states.test.tsx`, `CmsBulkUpdatePanel.states.test.tsx`) differ from the tree; the table heading says the refreshed table supersedes every earlier hash. My manifest of the 94 files is Appendix E; it was fixed at 01:48:47 UTC on the system clock and re-checked at 02:16:13 UTC: drift 0 of 94. The lane report's modification time is unchanged since my first look. The system clock is not reliable (it jumped several times in earlier rounds), so I rely on hashes.
- `recite7/web7-proposals.json` was last written in fix round 2 (hash `caef3985c53b592121df4f3ed596293453aa363baeac767c8803d9753b0a0326`, 50 rows); round 3 did not touch it. See N8.

### 2. What I ran

| Check | Result |
|---|---|
| A. The new `CmsGovernedReviewDetailIsland.reread.test.tsx` on the current island | 3 of 3 pass |
| B. The same file against the round-2 island (my verified state, island file swapped back) | row 1 (the moved m1 row) passes; **rows 2 and 3 fail**: `expected 'Back to definition reviewsTemplate pr…' not to contain 'Frozen version'`, in both the offered-re-read and the 429 path |
| C. Appendix D seed H and its 429 variant against the round-2 island | both fail. Observation in the window: `Frozen version` and `Reviewer A` on screen, notice absent, Record `aria-disabled="false"` in the first 250 ms (then `"true"` with the loading region) |
| D. Seed H and its 429 variant on the current island | both pass. In flight (at once and at +300 ms): review and label hidden, notice shown, Record `aria-disabled="true"`; after the release `Frozen version` is back and the notice is gone. 429 variant: no re-read button, the same hold through the 6 s wait and the automatic read |
| E1. Do the pre-existing island suites catch N2? Seven island files (including the cited G-A1 row) against the round-2 island | **58 of 58 pass**: none does. Only the two new rows discriminate |
| 31 single-expression mutants of the round-3 code against the current tests (table below) | **26 killed, 5 survive**: 2 equivalent (`sd-guard-removed`, `pn-no-id`), 3 are gaps (`n4-inflight-button`, `deg-since`, `sd-extra-always`) |
| D1. Current (round-3) product plus the 36 round-2 test and test-support files, 11 component directories | 375 files, 3,916 tests, **0 failed** |
| D2. Round-2 product (46 product files swapped back) plus the current tests, same directories | 375 files, 3,914 tests; **exactly the two N2 rows fail**, nothing else (the two moved tests pass on both products) |
| AST comparison of the moved tests (TypeScript compiler API: title, describe path, body text, `expect` count) | assignment states plus late-edit: 11 tests and 63 `expect`s before and after, **11 of 11 bodies byte-identical**. Island: 9 bodies identical; the m1 row (8 `expect`s) became reread row 1 (7), plus two new rows (6 and 10) |
| My earlier seeds on the current product | pass: A (insert late edit), C (rule during save), E (answer flipped, then 409), G (decision late reason), J (insert leave guard), L (late reviewer), B-prime (command-starting controls off), H and H429. Fail as before: I (N1, selection), B (its round-1 premise, Review enabled in flight, is withdrawn by M1), K (activation late reason: after success the field is gone; identical observation on the round-2 hook) |
| Worktree: the 10 touched dirs, `cms-editorial-workflow`, `cms-editorial-pages`, the inventory test, 7 bundle-closure tests, `no-store-redirects.test.ts` | 404 files, 4,216 tests, **0 failed**, exit 0 (round 2: 402 and 4,214; the only inventory changes are the two documented moves, +2 files, +2 tests) |
| v8 coverage over `cms-composition-instances` and `cms-governed-review` (scratch copy) | 90 files, 921 tests, 0 failed; **0 uncovered statements, branches or functions at the changed lines** of the 9 product files (all lines of the 3 new modules count as changed) |
| `tsc --noEmit -p apps/web/tsconfig.json`; `prettier --check` (88 code, 6 md); `eslint --max-warnings=0` (88 files) on the 94 files | exit 0; clean; exit 0 (scratch copy byte-identical to the worktree) |
| Size rule over the 94 files (components 200, hooks and lib 300, tests 400) | **0 over**. At the limit: `CmsGovernedReviewDetail.tsx` 200, `CmsGovernedAssignmentCreate.tsx` 199, `CmsPatternVersionDesigner.tsx` 199, `use-composition-updates.ts` 298 |
| Proposals file: every `file` plus full title against the passing run | 48 of 50 resolve, **2 do not** (N8) |
| Evidence ledger (`tests/contracts/phase-02-slice-12-evidence-ledger-*.ts`) | neither moved title appears there; the lane report and the proposals file are the only places that name them |

Mutants (scratch copy, the tests named in the third column; "only" means no pre-existing test kills it):

| Mutant | Change | Result |
|---|---|---|
| n2-drop-or | `degraded = status === 'degraded'` (the term after the two bars is removed) | killed, reread rows 2 and 3 only |
| n2-no-set | remove the set on `degraded` | killed, rows 2 and 3 only |
| n2-clear-on-refresh | clear `unverified` on any status but degraded | killed, rows 2 and 3 only |
| n2-never-clear | never clear on `ready` | killed (5 tests, among them the island rate-limit test and reread rows 1 and 2) |
| n2-disabled-reason | the forms' reason keyed to `status` instead of `degraded` | killed, rows 2 and 3 only |
| n2-assignments | blank the stale assignments only for `status === 'degraded'` | killed, rows 2 and 3 only |
| n2-since | the notice only for `status === 'degraded'` | killed, rows 2 and 3 only |
| n4-429-button | offer the re-read for every degrade | killed, row 3 only |
| **n4-inflight-button** | also offer the re-read while the read is in flight | **survives** (N7) |
| deg-role / deg-time-attr / deg-no-button / deg-no-attr / deg-text | notice role, `dateTime`, button, `data-cms-workflow-degraded`, wording | all killed |
| **deg-since** | visible last-verified text replaced, `dateTime` kept | **survives** (N9 c) |
| sd-commit-noop / sd-remember-noop / sd-clear-skip / sd-extra-never | the sent-draft hook does nothing / remembers nothing / never clears typed fields / never clears the reviewer | all killed |
| **sd-extra-always** | clear the chosen reviewer even if it was changed after dispatch | **survives**: this is N5 `asg-person`, now in the extracted hook; seed L is the assertion and passes |
| sd-guard-removed | drop the `committed === 0` guard | survives, equivalent (with nothing sent it clears nothing) |
| dec-remember / dec-commit / asg-person / asg-commit / asg-extra-dropped / act-remember / act-commit | the form wiring of the hook | all 7 killed |
| pn-kept-only / pn-no-refresh | `choicesNow` returns the dispatch-time answers / the ref is never refreshed | both killed |
| pn-no-id | drop the instance-id check in `choicesNow` | survives, equivalent (the round-2 `upd-fallback`: Review is disabled in flight, so no other instance's diff can be open) |

### 3. Per item: met or not met

| Item | Verdict | Evidence |
|---|---|---|
| **N2** a degraded governed detail shows the unverified review again while a re-read is in flight | **Met** | `CmsGovernedReviewDetailIsland.tsx:76-81` derives `unverified` during render (set when a read answers degraded, cleared only when a read verifies, i.e. status `ready`) and `degraded = status === 'degraded' \|\| unverified`; the review is hidden, the notice and `lastVerifiedAt` are shown (`:118`), the stale assignments are blanked (`:160`) and every form's reason is the unverified one (`:90-94`) for the whole window, including `refreshing` (the offered re-read and the automatic read after a 429's Retry-After). The hook call sits above the early return. RED: rows 2 and 3 fail on the round-2 island (B), seed H and H429 fail there (C) and pass now (D). Seven N2 mutants are killed, six of them only by the new rows. `gone` and `signed-out` still end in the closed state. |
| **N4** nothing asserts a 429 shows no re-read control | **Met** | Row 3 (`reread.test.tsx:123-160`) asserts `Read the review again` is absent right after the 429 (`:138`) and again after the automatic read starts (`:147`), asserts the message `rateLimitMessage(6)` (`:139-141`), a single read through +5,999 ms and the second at +6,000 ms (`:142-146`), the review hidden and the three commit controls disabled through the automatic read, and the review back when it verifies. Mutant `n4-429-button` is killed by this row alone. The matching statement for the non-429 window ("the button shows only while `status === 'degraded'`") is not pinned: see N7. |
| **N3** size limits | **Met**: behaviour unchanged; one subsumed assertion dropped from the m1 row, none elsewhere (N9 b) | Sizes: Detail 200, AssignmentCreate 199, `use-composition-updates.ts` 298, assignment states test 326, island test 361; 0 of 94 over. Behaviour: `CmsGovernedReviewDegraded.tsx` is the old inline notice (`<p data-cms-workflow-degraded role="status">`, the same words, `<time dateTime>`, the button only when `onReread` is given); the three forms differ from round 2 only by replacing the local `sentRef`/`committed`/effect with `useSentDraft`/`useClearSentOnCommit` (the assignment form merges `personId` into the remembered record and `clearSent` ignores keys that are not typed fields; the reviewer is still cleared only if it equals what was sent); `use-composition-panel-now.ts` is the ref, effect and `choicesNow` moved verbatim. Evidence: D1 (all round-2 tests pass on the round-3 product), D2 (the moved tests pass on both products; only the two N2 rows differ), 26 of 31 mutants killed with every survivor explained, 0 uncovered changed lines, the AST comparison. Moved tests: the assignment late-edit row keeps its describe, title and body; the m1 row keeps 7 of its 8 assertions (N9 b). |
| **N6** README states the withdrawn behaviour | **Met** | Every new sentence checked against the code (table below). The lane report's stale rows named in round 2 are corrected in place (Status pointer, G1, G-A1, B4, the size sentence, the clear-draft-refs sentence). |

N6, claim by claim:

| README sentence | Verified by |
|---|---|
| governed: `CmsGovernedReviewDegraded` shows only that the review is not shown and when it was last verified | the component renders the notice and the `time` only; mutants `deg-*` |
| governed: the stale assignment list is not shown; the review stays hidden with every commit control disabled until a read VERIFIES, including while a re-read is in flight (the island derives `unverified` during render) | island `:76-81`, `:160`; reread rows 2 and 3; mutants `n2-*` |
| governed: a non-429 degrade offers "Read the review again"; a 429 offers none because Retry-After governs and the automatic read follows it | island `:119-123`; reread rows 1 and 3; mutant `n4-429-button` |
| governed: a verified success clears only the fields that still hold what was sent; a value typed meanwhile is kept (`use-governed-sent-draft.ts`) | hook plus 7 wiring mutants killed; seeds G and L pass. (The reviewer half is unpinned by the lane's tests: N5.) |
| composition: while a command is in flight (or a diff is being read) every control that starts another command is disabled, Review update and Review selected updates included | round-2 M1 evidence; seed B-prime and `CmsCompositionPage.in-flight` pass on this state |
| composition: inputs stay editable (insert fields, diff answers, row selection); a typed value or a changed answer survives; a placement clears only the pattern and overrides that still equal what was sent; a 409 reload keeps the answers as they are now (`use-composition-panel-now.ts`) | seeds A and E pass; mutants `pn-kept-only`, `pn-no-refresh` killed. The sentence does not say the row selection survives, which is correct while N1 is open. |

### 4. Earlier fixes

No regression. D1 runs every round-2 test, including the unit5 leave guard and late edits, the web6 commit-only controls and result heading, and the 403 gate focus fix, against the round-3 product: 3,916 of 3,916 pass. The worktree run (404 files, 4,216 tests) is green. The extra m2 change keeps its behaviour: seeds G and L pass, and the activation hook gives the same observation as in round 2 (seed K).

### 5. New findings

**N7 (MINOR). The "Read the review again" control drops focus to the page body, and nothing announces the outcome.** The button is rendered only while `status === 'degraded'` (`CmsGovernedReviewDetailIsland.tsx:119-123`). Activating it starts the read, `status` becomes `refreshing`, the button unmounts, the notice stays, and when the read verifies the notice goes too. Seed F (Appendix F): the button is focused and clicked; `document.activeElement` is `BODY` at once, still `BODY` at +300 ms, and `BODY` after the review is back (`buttonConnected: false`). The notice is a static `role="status"` that does not change, and the loading region appears only after 250 ms, so a keyboard or screen-reader user who pressed the only control of the notice is returned to the top of the document and told nothing, then or when the review returns. FE03 has no sentence for this control, but the codebase keeps one button mounted so that focus survives a control switch (`CmsEditorialConflictResolveIsland.tsx:171`, `CmsEditorialEntryCreateIsland.tsx:113`), and its command rows keep focus until a named result heading (FE03 1118, 1121). The control comes from m1; I accepted it in round 2 without probing focus, which was a gap in that review. Mutant `n4-inflight-button` (keep the button during the read) survives, so the current "hidden while reading" behaviour is unpinned as well. Fix: keep the button mounted with `aria-disabled` and a stable label while `unverified` and a read is in flight; when the read verifies, move focus to the review summary heading (`onDone(GOVERNED_DETAIL_HEADING_IDS.summary)`, as the commands do) and say in the polite region that the review was read again; pin whichever behaviour is chosen. Seed F is the RED test. The read-retry controls of the sibling surfaces were not probed.

**N8 (MINOR). The proposals file was not refreshed after the lane's own moves: 2 of its 50 rows point at tests that no longer exist, and the new rows are not in it.** `recite7/web7-proposals.json` was last written in fix round 2; round 3 moved two tests. (a) The row "CMS-03C-08 late edit survives completion (m2)" names `CmsGovernedAssignmentForm.states.test.tsx`, but the test (same describe and title) now lives in `CmsGovernedAssignmentForm.late-edit.test.tsx`. (b) The row "CMS-03C-10 degraded: no stale assignments, polite status, re-read control (m1)" names `CmsGovernedReviewDetailIsland.test.tsx` and the title "CmsGovernedReviewDetailIsland (CMS-03C-10) shows no stale assignment while degraded, announces it politely and offers a re-read that restores the review"; that title exists nowhere now (moved and retitled). The lane report says of this test "It was never a ledger citation (it had no tag)": true of the ledger, not of the proposals, which carry it. Applying the file as it stands would cite a test that does not exist (a loud failure at best, or two dangling citations). The G-A1 cell also lacks the two rows that prove its "only after" clause. Fix (the resolver of Appendix F then reports 52 of 52): (a) change the `file` of row (a) to `.../CmsGovernedAssignmentForm.late-edit.test.tsx`, title unchanged; (b) replace row (b) with file `.../CmsGovernedReviewDetailIsland.reread.test.tsx` and title `CmsGovernedReviewDetailIsland: a degraded detail and its re-read [P2-S12-AC-271] governedReviewState degraded: no stale assignment, a polite notice and an offered re-read that restores the review once it verifies`; (c) add to the G-A1 cell, part `degraded`, the same file with titles `CmsGovernedReviewDetailIsland: a degraded detail and its re-read [P2-S12-AC-271] governedReviewState degraded: while the offered re-read is in flight the unverified review stays hidden and every commit control stays disabled` and `CmsGovernedReviewDetailIsland: a degraded detail and its re-read [P2-S12-AC-271] governedReviewState degraded: a 429 shows no re-read control, keeps the review hidden through the Retry-After wait and its automatic read, and re-shows it when that read verifies`.

**N9 (NIT). Three small points.** (a) `CmsGovernedAssignmentForm.states.test-support.tsx` lines 4, 6 and 26 are three empty imports (`import {} from ...`) left by the extraction; they only run the modules. (b) The moved m1 row has 7 of the 8 assertions of the round-2 row: the check before degrading that `Revoke ${label}` is on screen was dropped, and it runs on another fixture (`everyFormReview`) and mount. The assertion after verification subsumes it, so no power is lost, but the lane's "with the same assertions" and "none to existing assertions" are off by one. (c) No test asserts the visible last-verified text: the island row reads the `datetime` attribute and the `CmsGovernedReviewDetail.test.tsx` row checks that the HTML contains the timestamp, which the attribute alone satisfies (mutant `deg-since` survives), while the cited row's title says it "names lastVerifiedAt". Unchanged by the move.

### 6. Conditions and requests to root

- R1 (before citing the G-A1, m1 and m2 cells, N8): refresh `recite7/web7-proposals.json` as N8 states, then cite the G-A1 cell with the states.failure row plus the two reread rows.
- R2 (N7): keep focus through the re-read and pin it. Small, but it is a user-visible accessibility defect in a control this lane added.
- R3 (follow-ups, unchanged by this round): N1 (a row selection made during a command is lost at completion; seed I), N5 (two titles overstate what they assert; `asg-person` still survives, now as `sd-extra-always`; `act-reset`), N9, the nits n1 to n5, and the DEC-242 wave (A2, A3, A4, B5, B7, B8, `reviewer_not_eligible` refetch).
- R4 (unchanged): the real-route specs and the bundle check. This round adds three small modules inside already-lazy chunks (the sent-draft hook is imported by the three lazy governed forms, the degraded notice by the detail, the panel hook by the composition updates); the seven bundle-closure tests are green in the 404-file run, but `pnpm build && pnpm bundle:check` should still run once. The real-route list of section 7 of the first round stands. This round changes nothing a real-route spec reads: no spec drives a degraded governed detail or the "Read the review again" button.
- I did not re-run the whole `apps/web` suite (focused runs only, by rule); the lane's 768 files and 8,834 tests are its claim, and my 404-file run covers every directory it touched.

### Appendix E: SHA-256 of the 94 files verified in this round

Columns: SHA-256, lines, path relative to `apps/web/src/components/`. Fixed at 01:48:47 UTC on the system clock, unchanged at 02:16:13 UTC.

```
ae36243c892a2ad2ada6b4a40a0091a5df1203617acf3595eeb89e75b41c1d0d    96  cms-composition/CmsLatestReadLoading.test.tsx
f360ffa894f608477dca7e1b7871aa48985fcfc3928f683b03d1d312ec7da3e3    91  cms-composition/CmsTemplateDesigner.result-focus.test.tsx
a61daf514507b6f6aaa9c17c8d1ecfb4cc054c1419940c05dbb8ce5d80fc1cd0   360  cms-composition/CmsTemplateDesigner.states.test.tsx
eff6ac56a919089cb6f849cb6c541422299484b2b1dbd6400a32504ae3259d44   195  cms-composition/cms-template-designer-submit.ts
117e1f7b36382f76b1e306abfc4cd1e5ead17f059b7cc1717649173b4df4b8fe   194  cms-composition/CmsTemplateDesigner.tsx
1c8f5ebe2d8b2246161c2eda143e4140dcf7fb66775fda68d06be727260f149c   313  cms-composition/CmsTemplateEditDesigner.latest-states.test.tsx
59ccd2cb7d11356b59781ae8a775df8220440528792ea2888fb8bf2f71aff3bb   186  cms-composition/CmsTemplateEditDesigner.tsx
b9573ffea9deaf9dc32a1f6b4ebe953a806c5f919a75383817a8e1007f222648   205  cms-composition/cms-template-edit-reconcile-state.ts
8ffed478ee1dc6ab6612bcc6c5a3bfce475ee0fec10023ec305b606aa531c180   152  cms-composition/CmsTemplateFields.tsx
450ea1d2af68a7115356aecc658d83331ead04367dd363b569d7e526ea44993d   159  cms-composition/CmsTemplateStatus.tsx
1eb085aa11a8faa00c21effd74cd35e41d10e886cc9d5b8bfae75dd83e0d38ee   308  cms-composition-instances/CmsBulkUpdatePanel.states.test.tsx
ed8ad343945a66ed8e30bdbb0ab6f3b7b986c7c657b097988076b9563b4a8093   232  cms-composition-instances/CmsCompositionInstanceList.test.tsx
d999ac56b3d8337f786b0d624111e482b38c919cee3e8e8ceb794a34ab2dd8a6   121  cms-composition-instances/CmsCompositionInstanceList.tsx
0c0c702870d6783d70cbad413d88f88daa8024d141fb77e8b9cfdaf539ec2556    92  cms-composition-instances/CmsCompositionInstanceRow.tsx
374864ce5566012bad4ea4ccd343a07fb690869c8943f2c9c689bff38ee95cab   263  cms-composition-instances/CmsCompositionPage.in-flight.test.tsx
d0c12d3b77b8ca60dacfc8ffd6d4a086264458eb2ac65a1e49c738c4bbe882e6   176  cms-composition-instances/CmsCompositionPage.selector-states.test.tsx
e4b9ee0845fef43b95d654dc51ebca7e5ac78e1f7512279c7df02723e5decc81    54  cms-composition-instances/CmsCompositionStatus.tsx
252ee715f18efb8e35eb3693662c63f82eafe5f8ec3a1f5ecce7c8763b446d07   290  cms-composition-instances/CmsPatternInsertForm.states.test.tsx
8ca61a637da147e4ff241fab761c4cc87cffb56886b74ac495b6f83724b24284   197  cms-composition-instances/CmsPatternInsertForm.tsx
2fe5b95dcb3b1be3c4be31525e6608d724c2a4c49f91b930ba309b59cff26937   391  cms-composition-instances/CmsPatternUpdateDiff.states.test.tsx
01a3f78ce909f40fdef4f237f3785744bcc5fefe8d35d534b647fbc650cf72b5   131  cms-composition-instances/CmsPatternUpdateDiff.tsx
43bc1696d85486bbbe3eba86f6733a24a7c46251095b3c3b25157877757a4b31    57  cms-composition-instances/composition-status.ts
d56ffe0e67524cf8fefaf0c624d4070bbbcd601d0569481fae3ff5e0c0940e9d   102  cms-composition-instances/README.md
e62ab7cee389267c9ff2bcc139d28546a88f41fabaf97e3ee1ac89926c5a3b2b   190  cms-composition-instances/use-composition-bulk.ts
74ae0ceb2da848b3bdedd0ba35d42eab9adc5173d91ae2f1781f5050ee8dde7d   248  cms-composition-instances/use-composition-insert.ts
6928f5f399a144d4b3f8aa6baacf3027438663bbf79d62387322f5ba3e42d2f9    27  cms-composition-instances/use-composition-panel-now.ts
31294559c00461a202528f3527f9b6b3fbb3dd11b85377b9df74a4bba8e35242    83  cms-composition-instances/use-composition-updates.completion.test.tsx
20e8ccf6e78bd61c495a3364f2ec132938d1ee7cdf289187c339dbd754d8f60e   298  cms-composition-instances/use-composition-updates.ts
f067eced2c38beb258bfcd4692d4f93698e05d037cc6c388701f5ee1db5d4284   123  cms-composition/README.md
797a364160eb01bf88b8a6d8c5b3caf9e279ff600d971908210a93f22ff98bd9    40  cms-editorial/CmsEditorialCapabilityGate.tsx
de186d39e3e1e05b071e904800dec6d26b3649ce4dd6fe3d4fb15cfb23100b54   168  cms-editorial-fields/CmsTaxonomyFieldConnected.tsx
70bfb03091131b3cd76f0477f18c6ca18388799ac68a08d3ecc5ae03ba9de20b   187  cms-editorial-fields/CmsTaxonomyFieldEditor.connected-states.test.tsx
26ac0323c5dc776942f2b46f109a2e259fda20d022f167f2024b20b59f96b2d2   382  cms-editorial-fields/CmsTaxonomyFieldEditor.connected.test.tsx
ce6153f8417e56188d3e344992169a868f20b6f5f9c04fdc2241c924538cd8a9   138  cms-editorial/README.md
65c44c10b5a7e204d55ea0008fc2674b5007c5d6bdc2d638d4ee9a827dc870f3    47  cms-editorial-workflow/use-cms-workflow-draft-fields.ts
1952a2f92d330834923bb1d78562d640219185c258e51ddbe2043472bd535a9b   328  cms-governed-review/CmsGovernedActivationForm.states.test.tsx
bf7ee6a9fac416217d3cfe7940de6e34f4c9f6e829cca53cca7620d1c228e1e8   199  cms-governed-review/CmsGovernedAssignmentCreate.tsx
6b9328575d0328abb937df5d3e21c53d680173fe5ca4e367b7e40fc77b1e15eb    52  cms-governed-review/CmsGovernedAssignmentForm.late-edit.test.tsx
5336d191cdb6e33eacdd3a53de1f4292056b7b813c22e8cfeee1f4e35cf47247   101  cms-governed-review/CmsGovernedAssignmentForm.states.test-support.tsx
7b6116b0af90d36ea2e85390cfe2789d618c51e407a7ca6597375f27b6a72b62   326  cms-governed-review/CmsGovernedAssignmentForm.states.test.tsx
14e5bf87acad33d468b236b4fea9643578d42ae63d1cfb883115091ff3cc77c8    98  cms-governed-review/CmsGovernedDecisionForm.late-edit.test.tsx
c6415052c098ff56d2d56738beec163679f8ee1ad2faebfeddb6910ab39665c3   325  cms-governed-review/CmsGovernedDecisionForm.states.test.tsx
ea3172b166a1eca5577c77b51659135ba6138a9b7dc9be71b51e49ac62d0b0fe   193  cms-governed-review/CmsGovernedDecisionForm.tsx
7a5d716f5b351295594b6641a904db6937b21e5d337e18f0bb7444ae1a516aa0    30  cms-governed-review/CmsGovernedReviewDegraded.tsx
c434d065b4ce1fa272c7c541c6aebb6e28c9572716fa570d5bcf1aa72b66a53e   145  cms-governed-review/CmsGovernedReviewDetailIsland.rate-limit.test.tsx
6588ece259076a53b91338ac273a2a7b50bfa7317e677e28a42c41cd94959b21   161  cms-governed-review/CmsGovernedReviewDetailIsland.reread.test.tsx
a0afc1b8c1b5b368f2a878084022d14b0123e2eb89db9ad78a4dd76361c882a3   224  cms-governed-review/CmsGovernedReviewDetailIsland.states.failure.test.tsx
7b9e5c747d4c6621088a3cf1f67af8b2270b075e795cffc8a0e6944a9dd5a6bc   115  cms-governed-review/CmsGovernedReviewDetailIsland.states.test-support.tsx
53f6f0a0168b18e25feb1fd6b820d8886f62df32033a7605803a5543253d994f   361  cms-governed-review/CmsGovernedReviewDetailIsland.test.tsx
e0435b292bb156a7ccf55d4778a5c5d68e50b68bdafa5eaa67f3ed1adc1ba1b7   183  cms-governed-review/CmsGovernedReviewDetailIsland.tsx
21d9a6401364a9f99b19d9ac24b2a839c6ec312c65de18520baa42105df956f6   245  cms-governed-review/CmsGovernedReviewDetail.test.tsx
7bf38b77fcea72f19f6d6d10c8407ca65ce486af0372f414192fc52aef5c128b   200  cms-governed-review/CmsGovernedReviewDetail.tsx
5d4aedd5719e11fcc0807abebe71469d179e821c0934b9df06a8c59cc0a57c51   139  cms-governed-review/README.md
a19e8049384f569c1ff1ebd7fd7a6859710fb903b4c6421bb838d76bd5dd3ba7   232  cms-governed-review/use-governed-activation-form.ts
dba8df64ebc8510762845ee754d9be301ff213d8c6a79a7da11720681c9ad965    45  cms-governed-review/use-governed-sent-draft.ts
12ee6601a56886e12bf8f61101765add680ab7c34945af3803a40da73c6a85ca   116  cms-locale/CmsLocaleStatus.tsx
de57d98649332157227c483e5a4c5a8598bdaf3825f3a06e2be76a13051c28c6   246  cms-locale/CmsLocaleVariantForm.states.test.tsx
1f0dcfbcff796826a01a709717efbd27db8180e80593ff05b54857f843ae7307   127  cms-pattern-designer/CmsPatternConflictPanel.tsx
929b11ec5b7da4ca8c401f679a6f1e86bd915ba287ccb797d10e9227bf37bd47   174  cms-pattern-designer/CmsPatternStatus.tsx
0b2ca9fdcf037b3b677d84f5ab29d4f8d32ed8e6e1f695b0c794063c7cb7eeb6   293  cms-pattern-designer/CmsPatternVersionDesigner.latest-states.test.tsx
8c834a84e54447d17a91ed8384947554c38d1be207575f208e61c3c718d97aba   337  cms-pattern-designer/CmsPatternVersionDesigner.states.test.tsx
af8a83a66b74041cf8bde226187a6c41c4d91dcc44b09f320b4048794d29064a   199  cms-pattern-designer/CmsPatternVersionDesigner.tsx
ed5dc572a3984be88fcc46c4cda4737fbc87250288b9ddc2dbb69d11f4fe5215    33  cms-pattern-designer/pattern-status-copy.test.ts
037dd3852d64cc82050c739e5502a1aae85200da789a369a7a43a009a024f08a    46  cms-pattern-designer/pattern-status-copy.ts
5ce55cc302ba5f20a1a43afce9a4a1125ba8898be468801d60282db74e800965   100  cms-pattern-designer/README.md
6546be9589977057c4f84894d9457069d0c415fcb9128d0fc9e52daaeb0306ba   216  cms-pattern-designer/use-pattern-conflict.ts
d3f37472aff2b0bab2bcbf82c7c971c1085fec7ba650587badcc1506a52e6da9   210  cms-pattern-designer/use-pattern-designer.ts
91a31ce528d2e25f563bbf281ecb768ab7322d91315536c2d23f15a5ef219e50   276  cms-related-content/CmsRelatedContentForm.save.test.tsx
f5029c922d4677d2cae17d603fb361d2664a938446bfcdb993158021c3e594ed   314  cms-related-content/CmsRelatedContentForm.states.test.tsx
fafcfbd4c1596bfad37e3ae152c12747658252182be00a8cdb154e6e887f6a27   150  cms-related-content/CmsRelatedContentForm.tsx
183cb8170f86f61d53e660efe12a6c075d249ad92f40e4b8857a62179c5c100b    98  cms-related-content/CmsRelatedRuleFields.tsx
edfc7d301581ed35d286a7125e806aa232691a71044fcf0a81349401dae7d32d   137  cms-related-content/CmsRelatedStatus.tsx
d9696aee8f5154e86775a49304d57f9d4d927312d54ed0d44c62149c8b59a731   291  cms-related-content/use-related-content-form.ts
6bd612233373f49c8a30a199d9d473ea175a4a9bb04e728eec7a091b6ba9cb38    68  cms-taxonomy-designer/CmsTaxonomyConflictPanel.loading.test.tsx
8651a17cbb675fa8c3187841674585cab37ee5569e989618fa8c76cf9cea7209   115  cms-taxonomy-designer/CmsTaxonomyConflictPanel.tsx
bcf6a6794dd28977232a807da51d7dfad56d2e147a389573660133c7ec1c03f0   184  cms-taxonomy-designer/CmsTaxonomyStatus.tsx
96a8fc000183f49a84611a62256c5ec9b99e516f21b36dada3a1728a3edeec35   117  cms-taxonomy-designer/CmsTaxonomyVersionDesigner.late-edit.test.tsx
52538a48520ae021951ec062923c20150364a22351abaabb056580922cade545   280  cms-taxonomy-designer/CmsTaxonomyVersionDesigner.latest-states.test.tsx
5298d231967e3d8f892a8a010203b594b3bdec0a68cd51b0abb6e1eee90d647e   258  cms-taxonomy-designer/CmsTaxonomyVersionDesigner.states.test.tsx
2b822ebe9e8c10fd5d430b48ee664de63d3fec198ff85a857c5b31fcccfe21ca   166  cms-taxonomy-designer/CmsTaxonomyVersionDesigner.tsx
965d2d76381673a6db287db22ed03a59351c2fa7325ad1ffebbe4a119997319c    94  cms-taxonomy-designer/use-taxonomy-conflict.ts
c7a3fbe00ecdf9b777d3480f724fe577c8bbede0f15022ec26c136fd192f120d   266  cms-taxonomy-designer/use-taxonomy-designer.ts
b85905f69aa8a71162c1c7bd5851e173b80591bf814e91e00a161d91bb680926   198  cms-taxonomy-terms/CmsTaxonomyTermAction.tsx
7fec25c2f18a9919c9cefa54e5db40ce4ab7d2d30a1700d1788e8af49d0afee8   360  cms-taxonomy-terms/CmsTaxonomyTermForm.latest-states.test.tsx
df4c1c60497e73569a9af2c0a018ea103ae0221c81ded101177a653dfe8ed686   267  cms-taxonomy-terms/CmsTaxonomyTermForm.states.test.tsx
d5b3036163d817ffd6322324560b299c9f6f2b1429fdc287afa98cc03e7bf30f   196  cms-taxonomy-terms/CmsTaxonomyTermForm.tsx
b61ed6fccb97ccb31a4fa33782a62ebb91eeb8d4827f73a551978e703624a369    34  cms-taxonomy-terms/CmsTaxonomyTermListNotices.tsx
3874f34813f1c69742fb6c1a62a2a9f13b1c7ee080b8148544e718c663872f35   163  cms-taxonomy-terms/CmsTaxonomyTermStatus.tsx
e66b12f68adf2f8d936c4108a97710c6a9ea18f9846161c1fe29cf34a748d024    84  cms-taxonomy-terms/README.md
3e0a3f7e86f16a82d5e022a2269ad71b0a3d8570354192aff28d7df0d0ef58bd    84  cms-taxonomy-terms/term-copy.ts
80133628f085faa9666e33d301489061714b487dfac6bd46b6c714a326febddc    31  cms-taxonomy-terms/term-form-defaults.test.ts
7d4734960ffb0822ccdf6917ac45805e7fb4cb3997486775490aa5f0a1a72faf    17  cms-taxonomy-terms/term-form-defaults.ts
8a331c9b31b4c4955dbedd95a7217346fbe5eef6c35b7fe669608cfe3e4272eb    21  cms-taxonomy-terms/use-term-action-focus.ts
db10d75c2501703f374ebd47c612790a3af6694c4203df91b130c646d530717f   225  step-up-required.inventory.test.ts
```

### Appendix F: seeds of this round

Scratch quality (unused locals). Tidy and title them `[P2-S12-AC-271] ...` before committing them.

#### N7 seed F (focus after the offered re-read), directory cms-governed-review: `ZZProbe.reread-focus.test.tsx`

RED on the reviewed state (`expected false to be true` on `during.inside`); the observation file shows `isBody: true`, `buttonConnected: false` during the read and `isBody: true` after it.

```tsx
// @vitest-environment jsdom
import fs from 'node:fs';
import { act } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadCmsValidators } from '../../lib/cms-contract-validators';
import { buttonNamed, click, disableReactAct, enableReactAct, flush } from '../cms-editorial-fields/cms-editor-dom.test-support';
import { preloadWorkflowAnswerMachinery } from '../cms-editorial-workflow/cms-workflow-answer-machinery.test-support';
import { everyFormReview, mountDetail, provokeRefetch, type Read } from './CmsGovernedReviewDetailIsland.states.test-support';

beforeAll(preloadWorkflowAnswerMachinery);
beforeAll(enableReactAct);
beforeAll(async () => { await loadCmsValidators(); });
afterAll(disableReactAct);
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const where = (container: HTMLElement) => {
  const el = document.activeElement as HTMLElement | null;
  return {
    isBody: el === document.body,
    inside: el !== null && container.contains(el),
    tag: el?.tagName ?? null,
    text: (el?.textContent ?? '').slice(0, 40),
    id: el?.id ?? '',
  };
};

describe('PROBE F governed detail: where focus is after the offered re-read is activated', () => {
  it('keeps focus inside the detail while the re-read is in flight and after the review is verified again', async () => {
    const review = everyFormReview();
    let release: (r: Read) => void = () => undefined;
    const second = new Promise<Read>((resolve) => { release = resolve; });
    const reads: Array<Promise<Read> | Read> = [{ kind: 'degraded', requestId: null }, second];
    const readReview = vi.fn(async () => (await reads.shift()) as Read);
    const { container } = mountDetail(review, readReview);
    await flush();
    await provokeRefetch(container);
    const button = buttonNamed(container, 'Read the review again');
    button.focus();
    const before = { focusedIsButton: document.activeElement === button };
    await click(button);
    const during = { ...where(container), buttonConnected: button.isConnected };
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    const duringLate = { ...where(container), buttonConnected: button.isConnected };
    await act(async () => { release({ kind: 'ok', resource: review }); });
    await flush();
    const after = where(container);
    fs.writeFileSync(`${process.env.PROBE_OUT ?? '/tmp'}/probeFocus.obs.json`, JSON.stringify({ before, during, duringLate, after }, null, 1));
    expect(before.focusedIsButton).toBe(true);
    expect(during.inside).toBe(true);
    expect(after.inside).toBe(true);
  });
});
```

#### N8 resolver (every proposal row against the passing run)

Run `vitest run <dirs> --reporter=json --outputFile.json=run.json` over the directories of the rows, then:

```js
const fs = require('node:fs');
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const run = JSON.parse(fs.readFileSync('run.json', 'utf8'));
const passing = new Map(); // repo-relative file -> Set of passing full names
for (const f of run.testResults)
  passing.set(
    f.name.replace(/^.*WeJammin\//, ''),
    new Set(f.assertionResults.filter((a) => a.status === 'passed').map((a) => norm(a.fullName))),
  );
const proposals = JSON.parse(
  fs.readFileSync('docs/handoffs/2026-10-22-claude-s12/recite7/web7-proposals.json', 'utf8'),
);
let n = 0;
let ok = 0;
for (const r of proposals)
  for (const c of r.clauses)
    for (const a of c.add) {
      n += 1;
      if (passing.get(a.file)?.has(norm(a.title))) ok += 1;
      else console.log('UNRESOLVED', a.file.split('/').pop(), '|', a.title.slice(0, 120));
    }
console.log(`${ok} of ${n} rows resolve`);
```

Seeds H and H429 (N2) are in Appendix D; the H429 variant needs only the changes described there. They fail on the round-2 island and pass on the current one.
