# Re-review: claude_s12_web_taxonomies, fix pass 2 (independent, adversarial)

Reviewer: independent (did not author). 2026-10-15, worktree HEAD `b16edb54`. Read-only except this file.
Target `lane-web-taxonomies-report.md` `## Fix pass 2`, SHA-256 `a6525e7e…0a3d24`: matches. Brief
`briefs/web-taxonomies-f2.md`, prior review `review-web-taxonomies-f1.md` (PARTIAL).

## Claims re-verified
- File table: 15/15 lines and SHA-256 match. `lib/safe-read-retry.ts` was last written at 13:03:13Z (by Web polish A) and its SHA is `9c8c7bf4…`: this lane did not touch it.
- Focused Vitest on the final bytes (13:47:43-13:48:58Z, quiet lock, pinned PATH): taxonomy terms, pages and designer,
  `cms-governed-review`, `lib/safe-read-retry`, the island static closure and the step-up inventory: 61 files, 901 tests,
  all pass. The author's 66/948 used a different file set, so I did not compare the counts 1:1. I did not repeat the full
  Web run, eslint or prettier (outside the allowed execution).
- `astro check` (13:51-13:53Z): 1 error, at `cms-related-content/CmsRelatedContentForm.readonly.test.tsx:115`. That file
  belongs to another lane, which rewrote it at 13:53:06Z. The `cms-taxonomy-*` files have no diagnostics. The author's
  "0 errors" was true at 13:42Z.
- The extraction preserves behaviour. No pre-extraction copy was kept, so I rebuilt one: I took the author's 13:24Z
  scratch `mutant-3-CmsTaxonomyTermAction.tsx` and reverted its single mutation. The rebuilt file matches `mutant-5` apart
  from `mutant-5`'s own mutation. The hook keeps the same `chosenIds`, `eligibleTerms` arguments, `lost` and effect, in
  the same order. The only JSX change is `hasParent` → `hasParent && (action === 'create' || action === 'rename')`, which
  `hasParent`'s definition already implies. It only narrows the type for `PARENT_HELP[action]`.
- Citations: FE03 :28, :887 and :898 are correct against the worktree spec.

## Brief items
| Item | Status | Evidence |
| --- | --- | --- |
| Focus | closed (one minor, F3) | One `type=button` stays mounted while `more \|\| retry` (`Choice.tsx:57-65`). It has `aria-disabled` and keeps its label while a page loads, and turns into "Try again" in place. Tests assert node identity (`toBe(more)`) and `document.activeElement`: over 3 pages, through failure → retry → failure → success, after a failed first read (to a middle page and to the last page), and during a 409 restart in flight. A double press makes one read (`toHaveBeenCalledTimes(2)`) |
| Survivor | closed for the restart; partial when the survivor is merged away (F2) | Restart: `useTermChoices` keeps the chosen terms it had read before (`:97-108`). The test checks the options, `select.value`, the confirm sentence and `sent.survivorId`. Lost survivor: cleared, with a `role=status` note, and the review is guarded (`Action.tsx:78-81`). This is tested on a complete page only |
| Nits | closed | Loader `:43` and `pages/README.md:8-9,30` name `.new.test.ts`. The 503 and both 429 tests assert `typed`. `taxonomy-read-retry.test.ts:10,15` takes its timings from the imported constant, and `lib/safe-read-retry.test.ts:34` pins `[250,750]` |

## Mutation sample (mine; a scratch Vite `load` hook, no worktree edits; each run covers the whole `cms-taxonomy-terms` dir, 12 files / 158 tests; the baseline no-op passed)
Killed, 15 of 16:
- Choice: drop `aria-disabled`; `paging = more`; `paging && !loading`; flip the label to "Load more" during a retry.
- `use-term-choices`: drop `setRetry(false)`; retention filter → `false`; drop `'restarted'`; drop the busy guard; drop the `chosen` ref update.
- `use-term-action-choices`: `if (!lost) return` → `return`; drop `survivorId` from `chosenIds`.
- Action: drop `survivor !== null` from `confirming`; drop `survivorLost: false`; always show the note.
- `use-term-form`: close the form on a refusal (killed by both the refusals tests and the focus tests).

Survived (C4): `hadButton.current && !paging` → `!paging`. It is equivalent in practice: on mount, the form heading focus
(`use-term-form.ts:116-119`) runs after the child effect and overrides it. No action needed. The author's two
"equivalent" survivors are plausible.

## Findings
- F1 `CmsTaxonomyTermFields.tsx:74-86` (TermSelect) with `use-term-form.ts:77` and `use-term-action-choices.ts:60-65`. **Major. It predates fix pass 2. It is an implementation defect, not a product decision: confirmed.**
  - What happens: on `rename`, the form holds `parentId = target.parentId`. When no page read so far contains that parent, the select has no option with that value. React then selects the first enabled option, "No parent (top level)".
  - Probe P2 (scratch jsdom, the real `CmsTaxonomyTermForm`): `select.value === ""`, the select shows "No parent (top level)", and the request sends `parentId = PARENT_ID`.
  - Consequence in a browser: picking the option that already shows as selected fires no `change` event. So a curator who chooses "No parent" to move the term to the top level has that choice silently dropped. Rename applies `parentId` (`20261014120400_cms_term_action_apply.sql:7,16`).
  - It also fails WCAG 4.1.2: the value the select exposes is not the held value (FE03 :28 baseline).
  - It is not a product decision: the value is already decided (keep the current parent, `PARENT_HELP.rename`). Only how the select represents it is wrong, and clearing the value is not acceptable.
  - Fix: in `TermSelect` (or `CmsTaxonomyTermChoice`), when `value !== ''` and no choice has that id, render a held option `<option value={value}>` labelled e.g. "Current parent (not among the terms loaded yet)". When a later page brings the real term, its named option replaces the held one. This needs no new read: BE03c 407 has no by-id read, and paging until the parent is found would spend the 120/240 read quota.
  - Test: rename a term whose `parentId` is on no read page. Assert:
    - `select.value === PARENT_ID`, with exactly one option for that id, labelled with the held copy;
    - submit unchanged → `parentId: PARENT_ID`; choose `''` → `parentId: null`;
    - after "Load more terms" brings `strings`, that option reads "strings (Strings)" and is still selected;
    - a create form shows no held option.
- F2 `use-term-choices.ts:157-158` (`appended(loaded, kept)`). **Minor.**
  - What happens: when the page is not complete, the picker's earlier read (stale facts) wins over the refreshed page facts.
  - Probe P1: the survivor `organ` is chosen from the picker's read; the submit returns a 409; the refresh lists `organ` as `merged`. `organ` is still offered, no note appears, and the review says "Merge guitar (Guitar) into organ (Organ)".
  - The sentence still matches the id sent. But the server refuses a merged survivor (`20261014120050_…lineage.sql:91`), and the `use-term-action-choices.ts:34-37` claim ("a refresh found it merged away … is cleared") holds only on a complete page. The test (`focus.test.tsx:244`) uses a complete page.
  - Fix: `merged` is terminal (BE03c 1396), so exclude an id that either source reports as merged. Add the `:244` test with `nextCursor: 'page.2'`.
- F3 `CmsTaxonomyTermChoice.tsx:38-42`. **Minor.**
  - What happens: focus moves to the select whenever the button leaves, even if the person has moved focus elsewhere during the read.
  - Probe P3: on a rename form, press "Load more terms", focus "Label 1", then release the last page: focus jumps from "Label 1" to `cms-term-parent` (WCAG 2.4.3).
  - Fix: move focus to the select only when `document.activeElement` is `body` or null (focus fell with the button). Test: the P3 sequence, asserting that the label input keeps focus.
- F4 `CmsTaxonomyTermConfirm.tsx:34-46`. **Nit.** A `merge` with `survivor === null` renders the *Deprecate* sentence. The new Action guard makes this unreachable. Fix: make the props a discriminated union so a merge requires a survivor.

## Not verified
- The RED runs the author reports (they cannot be reproduced afterwards).
- The full Web run, eslint, prettier, and browsers (the native-select no-`change` behaviour is per the HTML spec and React's `updateOptions`, not run in a browser).

Scratch files (probes, mutants, logs): `<scratchpad>/review_web_taxonomies_f2/` (`f2.probe.test.ts`, `probe.out`, `mut.log`).

VERDICT: PARTIAL
