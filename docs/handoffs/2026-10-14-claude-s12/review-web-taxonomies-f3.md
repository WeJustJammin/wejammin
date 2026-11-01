# Re-review: claude_s12_web_taxonomies, fix pass 3 (independent, adversarial)

Reviewer: independent (did not author). 2026-10-15, HEAD `b16edb54`. Read-only except this file. Target `lane-web-taxonomies-report.md`
`## Fix pass 3`, SHA-256 `340f6daf…60cd2dc`: matches. Brief `briefs/web-taxonomies-f3.md`; prior `review-web-taxonomies-f2.md`.

## Claims re-verified
- File table: 17/17 lines and SHA-256 match. Source mtimes end 14:10:21Z, so the 16:34-16:48Z mutants ran on the final code.
- Focused `cms-taxonomy-terms` (17:06:31Z, quiet lock, pinned PATH): 17 files, 196 tests pass. Matches.
- `astro check` (17:07-17:09Z): 1 error, 0 warnings, 182 hints. The error is `styles/cms-danger-action.test.ts:155` (another
  lane, rewritten 17:09:02Z mid-run). `cms-taxonomy-*` has 0 diagnostics, and the Confirm `@ts-expect-error` is used.
- Full Web run: the author's `full.log` shows 575 files, 4 failed, all in `cms-danger-action.test.ts`. I did not rerun it.
- RED: `red1.log` (14:01:56Z) does show 5 failed of 171 (focus 1, survivor 1, parent 3). See N3.
- Mutation: `mut3.log` holds 31 mutants (3+5+6+9+1+4+3). Its 4 survivors were re-killed in `mut4`/`mut5`, and 3 survivors
  from `mut1`/`mut2` were killed later, so "7 fixed" adds up. Caveats: `mutate.py` runs no no-op baseline, and tests were edited
  while `mut3` ran (75 → 80 tests mid-batch). "31 final, all killed" is pieced together from several runs, not one battery.
- `term-review.tsx` preserves behaviour: confirmed. I rebuilt the pre-F3 Action from the f2 reviewer's `m-X2` (reverting its
  one mutation). The old `confirming` (`step==='confirm' && target!==null && (deprecate || (merge && survivor!==null))`) is
  exactly when `termReview` returns non-null. Confirm props, Escape and Back are the same. The only difference: deprecate no
  longer gets `survivor`, which the old Confirm ignored anyway.
- Citations: FE03 :28/:887/:898 are correct. BE03c :407/:1396 drifted when another lane rewrote BE03c at 17:05Z (after this
  report); they are now :410 and :1403. Not this lane's fault.

## Brief items
| Item | Status | Evidence |
| --- | --- | --- |
| F1 held parent | closed for the current parent; residual N1 | `use-term-action-choices.ts:82-97`, `Fields.tsx:85-87`. Tests in `parent.test.tsx:82-202` cover: the value, one selected held option, an unchanged submit sends `parentId`, "No parent" sends `null`, undo, the named option replaces the held one after a load and stays selected, a merged parent named from either read, and no held option on create, at top level or when listed. No new read |
| Generic label | acceptable | `taxonomy-term-list.ts:29-31`: the query takes only lifecycle/cursor/limit, and items carry only `parentId`. There is no by-id or by-key read, and paging to find the parent would spend the read quota |
| F2 merged survivor | closed | `use-term-choices.ts:157-167`: `mergedIds` comes from both sources. `focus.test.tsx:307` uses `nextCursor:'page.2'` and was RED |
| F3 focus | closed | `Choice.tsx:42-48` moves focus only when `activeElement===body`. `focus.test.tsx:172` was RED; `:190` and 3 component cases add coverage |
| F4 confirm props | code closed; test weak (N2) | `CmsTaxonomyTermConfirm.tsx:15-23` is a discriminated union |

## Mutation sample (mine; scratch Vite `load` hook, no worktree edits; the author's 10 test files, 80 tests)
No-op baseline: 80/80 pass. 8 of 8 killed:
- From the author's list: Fields held → never; `hadButton && !paging` → `!paging`; `[...loaded, ...pageTerms]` → `[...loaded]`;
  term-review `=== 'deprecate'` → `!== 'merge'`.
- New ones: held keyed to `form.parentId`; drop `target === null`; `lost` without `merge`; focus check → `activeElement !== null`.
- R3 first printed "no tests" (a tail-parse artifact); a full-log rerun failed 2 tests, so it is genuinely killed.

## Findings
- N1 `use-term-action-choices.ts:82-89` with `CmsTaxonomyTermFields.tsx:84-92`. **Minor (residual of F1).**
  - What happens: the held option is keyed to `target.parentId`, not to the form value. Suppose the person chose a parent
    (create or rename), and a later read then reports it `merged`, for example the page refresh after "Load more" or a 409. F2's
    either-source rule (`use-term-choices.ts:160-166`) drops it from the options.
  - Result: React shows "No parent (top level)" while the request still sends the merged id. The server refuses it
    (VALIDATION_FAILED `/parentId`, `20261014120400_…:36`), and picking "No parent" fires no `change` event: the F1 mismatch
    (WCAG 4.1.2). It needs a concurrent merge of a parent with no children (`:172` allows that). There is no wrong write.
  - Fix: hold `form.parentId` whenever no option lists it. Use the current-parent copy when it equals `target.parentId`, and
    otherwise e.g. "Chosen parent (no longer available)". Or clear it like the survivor's `lost` path, with a note.
  - Test: choose `tuba` from the page, then "Load more" lists `tuba` merged. Assert `select.value` is the sent value (or the
    field is cleared and announced).
- N2 `CmsTaxonomyTermConfirm.test.tsx:46-49`. **Minor.** The `@ts-expect-error` does not tell the old types from the new.
  - Pre-F3 props required `survivor: TermFacts | null` (SHA `dd2f4bfb…`, report row :66, and two identical scratch mirrors),
    so omitting `survivor` was already an error. `f4/old.ts` models `survivor?:`, a shape the file never had, so the F4 RED was
    never observed.
  - The defect was `merge` with `survivor={null}`. Fix: put the directive on `action="merge" survivor={null}`.
- N3 report `## Fix pass 3`. **Minor (evidence).**
  - Parent RED #3 ("replaces the held option…") failed on the order oracle `['',SURVIVOR,PARENT,TUBA]` (`red1.log`, test :137).
    The oracle was later reversed to `['',SURVIVOR,TUBA,PARENT]` (`parent.test.tsx:132`), which is exactly the pre-fix
    output, so the final test passes on the pre-fix code. "Test corrections: none" does not mention this.
  - "8 then 9" parent tests: the file has 10.
  - The "No parent" request test (`:102`) also passes on the pre-fix code, because `choose` always dispatches `change`
    (`cms-editor-dom.test-support.ts:144-155`). The real guard is `select.value===PARENT_ID` (`:85`, RED); say so.
- N4 `use-term-action-choices.ts:95`. **Nit.** A current parent listed only by the page leaves `choices` once another parent is
  chosen. It is then held as "strings (Strings) (current parent, active)": raw lifecycle copy, the option moves, and no test covers it.

No blocker or major remains: F1 (as briefed), F2, F3 and the F4 code are fixed. PARTIAL is for N1 (the F1 mismatch through a
second path), N2 (a type test that guards nothing) and N3 (RED evidence that over-claims). Each is a small change.

## Not verified
- eslint and prettier (outside the allowed execution).
- A real browser. N1 is traced from the code and React's `updateOptions`; I did not probe it.

Scratch: `<scratchpad>/review_web_taxonomies_f3/` (`focused.log`, `astro.log`, `mut.py`, `mutants.json`, `mut.log`, `r3-full.log`, `pre-f3-Action.tsx`).

VERDICT: PARTIAL
