# Lane report — `phils_taxonomy_parent_20261015` (Codex author, test-first)

Model: `Phils-Charm/deepseek-v4.1-flash` / `high` (as requested; no substitution, no fallback).
Worktree: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, branch `claude/phase2-slice12`,
HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e`.
Release: WRITE-ONLY TEST-FIRST authoring. Root owns all planning, validation, review and integration.
No git-state writes, no commits, no tests/lint/typecheck/build/DB/runtime/network/mutant runs, no subagents.

## Claimed paths (exactly five, from the Dispatch Log)

1. `apps/web/src/components/cms-taxonomy-terms/use-term-action-choices.ts` (production hook — READ ONLY until a root follow-up after observed RED)
2. `apps/web/src/components/cms-taxonomy-terms/use-term-action-choices.test.tsx`
3. `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.parent.test.tsx`
4. `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermConfirm.test.tsx`
5. `docs/handoffs/2026-10-14-claude-s12/lane-codex-taxonomy-parent-2026-10-15.md` (this file)

Everything else, including tracked progress/specs/config/contracts and older reports, is READ ONLY.

## Status

Root-observed RED (first), then a minimal production GREEN edit that regressed an EXISTING parent test, then a
second root RED for the undo/coexist behaviour; the GREEN for that second RED is written and root validation is
PENDING. This author still ran nothing (no test, lint, typecheck, build, DB, runtime, network or mutation command)
and wrote no git state.

- Observed RED is ROOT'S receipt, not this author's run: pinned/shared-quiet Vitest exit 1, 29 cases, 24 passed,
  exactly 5 failed — the create and rename `select.value`-empty-vs-`TUBA` component cases plus the three hook
  actual-parent guards — with no other failures. Receipt: `/tmp/wejammin-codex-taxonomy-red-LTQ0lZ/red.json`.
- Root broad GREEN attempt is ROOT's receipt, not this author's run: pinned/shared-quiet Vitest exit 1, 203 cases,
  202 passed, exactly 1 failed — the EXISTING `CmsTaxonomyTermForm.parent.test.tsx:117-126` "keeps the held parent
  on offer after another parent was chosen, so the choice can be undone". Receipt:
  `/tmp/wejammin-codex-taxonomy-green-UeeQya/green.json`. Independent review (gpt-6.1-sol) BLOCK agrees.
- Second RED (undo/coexist) is ROOT's receipt, not this author's run: pinned/shared-quiet Vitest exit 1, 30 cases,
  28 passed, exactly 2 failed — the EXISTING undo case plus the new coexist-undo case. Receipt:
  `/tmp/wejammin-codex-taxonomy-undo-red-HklyoV/red.json`.
- `astro check` on the Confirm type test is ROOT's receipt, not this author's run: exit 1 with TS2322 at line 53
  plus TS2578 at line 51, from the directive not being immediately adjacent to the invalid JSX line. Receipt:
  `/tmp/wejammin-codex-web-types-Vt5byM/astro-check.log`.
- Root's SECOND broad taxonomy run PASSED (ROOT's receipt, not this author's run): pinned/shared-quiet Vitest exit
  0, 17 files, 204/204 passed. Receipt: `/tmp/wejammin-codex-taxonomy-green2-d6OmyU/green.json`. Root retains
  final validation.
- Root's Prettier check (ROOT's receipt) exited 1 on ONLY the two owned test files
  (`use-term-action-choices.test.tsx`, `CmsTaxonomyTermForm.parent.test.tsx`); all four production files and the
  Confirm test were format-clean. Under root's narrow formatting release this author then ran
  `pnpm exec prettier --write` on exactly those two absolute paths (exit 0, format-only, no semantic or oracle
  change). This was the only command this author has executed.
- Cause (this author's GREEN, now superseded): keying the single held option to `form.parentId` made it the chosen
  parent and dropped the term's stored current parent from the choices, so the undo path lost its option.
- Root's design, now implemented: `heldParent` is the actual selected parent when it is missing as an option, and a
  SEPARATE `undoParent` holds the distinct stored current parent only when `hasParent`, `currentParent !== null`,
  `currentParent !== form.parentId` and it is not eligible; its copy uses a truthful current-parent lookup. The
  native choice's `held` prop is now a readonly `HeldChoice[]` (default `[]`); `CmsTaxonomyTermAction` passes the
  distinct non-null `[heldParent, undoParent]`; `CmsTaxonomyTermFields` maps them with `key`; `CmsTaxonomyTermChoice`
  forwards. No other `held` consumer exists (root's ripgrep).
- The `@ts-expect-error` in `CmsTaxonomyTermConfirm.test.tsx` was moved immediately above the invalid JSX line
  (the only line TypeScript applies it to); the invalid `merge`/`null` shape and its assertion are unchanged, and
  no `as any` or `@ts-ignore` was used.
- Status is root GREEN pending for the second RED; this author cannot run Vitest or `astro check`, so nothing here
  is claimed green. All test files are frozen except the Confirm directive placement.

## What the task asks for (root's decision, with FE input preservation)

- Hold the actual `form.parentId` whenever no eligible choice lists it, so the native control never falls to
  "No parent (top level)" while the form still sends the id (the F1 WCAG 4.1.2 mismatch through a second path).
- Distinguish the two reasons a parent is held: the term's own current parent that no page has listed yet (the
  existing generic copy) versus a parent the person chose that a later read reports merged (copy that names the
  chosen parent as no longer available).
- Leave production types unchanged; correct only the N2 type test.

## Hypothesis being tested (root's, from the F3 review N1)

`use-term-action-choices.ts:82-97` keys the held option to `target.parentId` only. A newly chosen parent (create
or rename) that a later read marks `merged` is dropped by `eligibleTerms` (F2's either-source rule,
`use-term-choices.ts:160-166`), so React renders "No parent (top level)" while the form still submits the merged
id; the server then refuses `VALIDATION_FAILED /parentId`, and choosing "No parent" fires no `change` event. The
new component regressions assert the real `select.value` equals the draft parent id, which is the mutation-sensitive
boundary. No owned hook is mocked; the existing real-DOM harness (`cms-editor-dom.test-support`) is used.

## Tests added (names exact)

### `CmsTaxonomyTermForm.parent.test.tsx` — new describe "a chosen parent a later read reports merged stays the value the control shows and the form sends (FE03 :887, WCAG 4.1.2)"

1. `keeps a rename's chosen parent selected and sent after "Load more terms" reports it merged`
2. `keeps a new term's chosen parent selected and sent after "Load more terms" reports it merged`
3. `clears both the shown and the sent parent when "No parent" is chosen instead`
3a. `keeps both the chosen parent and the stored current parent on offer after a restart reports the chosen parent merged, so either can be sent` (TEST-ONLY follow-up: asserts `select.value === TUBA_ID` and that both `PARENT_ID` and `TUBA_ID` remain options, then chooses `PARENT_ID` and asserts the shown and sent value)

Fixture: the form page lists `[guitar, organ]` with `nextCursor: 'page.2'`; the picker's read answers
`termsPage([guitar, organ, tuba], 'page.2')`, then a 409, then a restart page
`termsPage([guitar, organ, mergedTuba], null)` that reports the chosen `tuba` merged into `organ`. "Load more
terms" is pressed to reach the restart. Assertions: `select.value === TUBA_ID`, `selectedOptions[0].value ===
TUBA_ID`, the selected copy is not `HELD_PARENT_LABEL` and matches /no longer available/i, and the submitted
`parentId` is `TUBA_ID` (rename) / `TUBA_ID` (create) / `null` after choosing "No parent".

### `use-term-action-choices.test.tsx` — new describe "useTermActionChoices: the held option is the form's actual parent, never an unrelated current parent (FE03 :887)"

4. `holds it labelled as no longer available, not as the current parent`
5. `holds an unlisted chosen parent as the chosen parent, under the no-longer-available copy`
6. `holds no option once a read offers the chosen parent again`
7. `still holds a current parent the page lists as merged under its own name`

These are hook-level (the production hook is imported directly, not mocked). The expected copy for the chosen
parent is a file-local constant in the test (`'Chosen parent (no longer available)'`, matching root's example),
so the test does not force a specific production export name. Per root's static oracle review, the held option is
always the form's ACTUAL `form.parentId`: an unlisted chosen parent is held as the chosen parent (test 5, not the
term's own current parent), and once a read offers the chosen parent no option is held at all (test 6, `null`).
The actual-current-parent semantics stay only when `form.parentId === target.parentId`, which test 7 pins.
Pre-fix the hook keys the held option to `target.parentId`, so tests 4 and 5 fail on the returned `heldParent`
(test 6 fails too: pre-fix it returns the current-parent pseudo-option instead of `null`) with no compile error.
`choicesOf` gained an optional fourth `pageTerms` parameter (default unchanged) so a case can mount the hook on a
chosen page.

### `CmsTaxonomyTermConfirm.test.tsx` — corrected N2 type test

8. `does not type-check a merge review whose survivor is null` (replaces `does not type-check a merge review
without a survivor`)

The directive now sits on `action="merge" survivor={null}`, the shape the F4 defect actually had. Omitting the
prop was already an error under the pre-fix `survivor: TermFacts | null`, so the old test guarded nothing.
Production types are unchanged.

## N3 correction (historical evidence in `lane-web-taxonomies-report.md` `## Fix pass 3`)

The old parent RED #3 ("replaces the held option…") failed on an option-order oracle
`['', SURVIVOR, PARENT, TUBA]` (`red1.log`, test :137). That oracle was later reversed to
`['', SURVIVOR, TUBA, PARENT]` (`parent.test.tsx:132`), which is exactly the pre-fix output, so the final test
passes on the pre-fix code: it is not a guard. The "No parent" request test (`:102`) also passes pre-fix, because
`choose` always dispatches `change` (`cms-editor-dom.test-support.ts:144-155`). The only parent case that was a
real guard was the `select.value === PARENT_ID` assertion (`:85`). No fictional RED receipts are claimed here;
this author has produced no RED receipt.

## Type-test status

The N2 shape is a `@ts-expect-error` enforced by `astro check`, which this author is not permitted to run. The
current production types already form the discriminated union, so no new type-level RED is claimed by this author.
Root must prove the old shape (props with `survivor: TermFacts | null` making omission an error and `survivor={null}`
the real error) before any type RED is asserted.

## Files (exact; author's four written paths + the read-only hook)

| Path | Lines | SHA-256 | State |
| --- | --- | --- | --- |
| `apps/web/src/components/cms-taxonomy-terms/use-term-action-choices.ts` | 135 | `75c962c69e15fb691012552f84db0f6fd538b637359be0582fa4fa3df15d4323` | edited for GREEN (pre-edit `c0b1df2f…`) |
| `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermAction.tsx` | 193 | `92b31a9f4c20bddc427f4a4d19cdb4978cc08e66481f396cf3783163832fc61d` | edited for GREEN |
| `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermChoice.tsx` | 74 | `54e4ca854e155942d489c603282ac26b4bba4dc1a008b2e73a5beb3af57725f5` | edited for GREEN |
| `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermFields.tsx` | 100 | `b19853dfa3931ca10906a1865b4ac12135a7adee049d3b5ba50930211db609b8` | edited for GREEN |
| `apps/web/src/components/cms-taxonomy-terms/use-term-action-choices.test.tsx` | 191 | `1828e187e1496d9d604d5d40598eb331a7cf655d9658daac8a0c34e837503ea0` | edited (was 117 lines, `0cf2b45d…`; prettier-formatted) |
| `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.parent.test.tsx` | 319 | `e8c61cf01f099510b64f673aefbd4a343b5bcb8d6e853c14a8babd19535fc52a` | edited (was 203 lines, `fc949b87…`; + undo regression; prettier-formatted) |
| `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermConfirm.test.tsx` | 58 | `bbeeaf5cde8ddf2d86ac509f71dc4690f67a87368f65f18b31f739889f5dfea2` | edited (was 51 lines, `5690c1d8…`; directive moved) |
| `docs/handoffs/2026-10-14-claude-s12/lane-codex-taxonomy-parent-2026-10-15.md` | — | — | this report |

Existing tests preserved: the 10 pre-existing parent tests, the 6 pre-existing hook tests, and the 2 pre-existing
Confirm tests are unchanged in name and intent; the only Confirm change is the corrected N2 case.

## Which new tests are RED guards (confirmed by root's observed RED)

- True guards on the pre-fix hook (root observed these FAIL): parent tests 1 and 2 (the
  `select.value === TUBA_ID` boundary — pre-fix the control falls to `''` because no option holds `TUBA_ID`),
  and hook tests 4, 5 and 6 (pre-fix `heldParent` is the `{PARENT_ID, HELD_PARENT_LABEL}` current-parent
  pseudo-option for every chosen-parent case: test 4 wants the chosen-parent copy, test 5 wants `TUBA_ID`, test 6
  wants `null`).
- Behavior-documenting complements that are expected to PASS pre-fix (no new guard; they pin the surrounding
  contract so the fix cannot regress it): parent test 3 (the "No parent" clearing already happens pre-fix because
  the control had already fallen to `''`) and hook test 7 (the term's own current parent, held under its merged
  name).

Root's observed RED matched the prediction exactly: parent tests 1-2 and hook tests 4-6 failed, and nothing else
newly failed (24 of 29 passed). The five failures are root's evidence; this author produced no RED receipt.

## Production edit (minimal GREEN; `use-term-action-choices.ts` only)

First pass (superseded): keyed the single held option to `form.parentId` and added
`CHOSEN_PARENT_UNAVAILABLE_LABEL`. That dropped the stored current parent from the choices, regressing the undo
case (root GREEN 202/203).

Second pass (current; four files, per root's released design):

- `use-term-action-choices.ts`: `heldParent` is the form's ACTUAL `form.parentId` when it is missing as an
  option (`hasParent && parentId !== '' && !offers(parentId)`), labelled with the current-parent copy only when
  `form.parentId === target.parentId` (known name + `(current parent, <lifecycle>)`, else `HELD_PARENT_LABEL`),
  otherwise `CHOSEN_PARENT_UNAVAILABLE_LABEL`. New `undoParent` holds the distinct stored current parent when
  `hasParent && currentParent !== null && currentParent !== form.parentId && !offers(currentParent)`, labelled
  from a truthful current-parent lookup. Both return `null` otherwise. Exported `TermActionChoices.undoParent`.
- `CmsTaxonomyTermAction.tsx`: reads `undoParent`, passes the distinct non-null `[heldParent, undoParent]` as
  `held`.
- `CmsTaxonomyTermChoice.tsx` and `CmsTaxonomyTermFields.tsx`: `held?: readonly HeldChoice[]` (default `[]`);
  Fields maps the options with `key={choice.termId}`.

No helper file, mock, capability change, or type-shape change beyond the new `undoParent` field.

Diff summary: four files. `use-term-action-choices.ts` 99 → 135 lines; `CmsTaxonomyTermAction.tsx`,
`CmsTaxonomyTermChoice.tsx` and `CmsTaxonomyTermFields.tsx` each a small edit. No other file touched.

## Blocker to report exactly

One `apply_patch` call carried a relative `docs/...` path (the host resolved it against the session working
directory, the primary checkout, not the worktree) and created the report file under the PROTECTED primary checkout
`/home/rob/Projects/WeJammin/docs/handoffs/2026-10-14-claude-s12/lane-codex-taxonomy-parent-2026-10-15.md`
instead of the worktree. (A following absolute-path patch created the intended worktree copy.) Detected
immediately. Remediation: the stray file was removed, the empty `docs/handoffs` directories it created were
removed, and the primary checkout's `git status --porcelain` is back
to its pre-task two pre-existing untracked paths (`apps/worker/src/cms-editorial/`,
`packages/contracts/src/cms-editorial/`); `HEAD` is unchanged at `37c0a86e…`. No tracked file in the primary
checkout was modified, and no git state was written. The report was then re-created in the worktree with an
absolute path. The primary checkout must be re-verified by root.
