# CMS composition instances (Slice 12)

## Contents

The author's composition surface for one entry (BE03c CMS-03C-02, -13, -14, -15; FE03 `CmsCompositionInstanceList`,
`CmsPatternSelector`, `CmsPatternUpdateDiff`, :886, :887, :1072, :1114, :1115, :1508, :1509): the protected page
`/app/cms-content-modeling/entries/:entryId/composition` and its island. An author inserts a pattern version on the
entry's current draft, sees the placed rows, and resolves a pattern update (accept with a choice for every collision,
or detach) one instance or a selection at a time. The page loader (`load-composition-page.ts`,
`composition-page-reads.ts`) and the island live together here; the Astro file under
`pages/app/cms-content-modeling/entries/[entryId]/` only maps the loader outcome to a response. The three first-party
proxies (selector, diff, update) are `apps/web/src/server/cms-composition-instances-*.ts`; the placement proxy
(CMS-03C-02) is `cms-composition-platform-pattern.ts`.

## Ownership

These modules render server-verified data and send exact requests. They own the form state, the explicit controls, the
`Idempotency-Key` policy and the fixed copy. Authority (assignment with edit authority on the current draft), pattern
eligibility, collisions, bulk eligibility and the all-or-nothing write are the Worker's and the database's. The proxies
verify every success against the strict contracts and the request that asked for it, so the island carries no zod
(`composition-static-closure.test.ts`, FE03 AC261).

## The instance list read (DEC-206)

`cmsCompositionInstancesRead` (`GET /api/v1/cms/entries/{entryId}/compositions`) lists the newest `draft`, `active` or
`pending_diff` row of each path of the entry's current draft revision in render order (template slot, `position`, path),
at most `limit` (1-50, default 25) per page with a signed opaque cursor (BE00), and is the page's edit-authority gate.
`load-composition-instances.ts` asks for 50 rows a page and follows the cursor server-side until it ends, with no page
cap (no spec bounds the heads of a revision) and two fail-closed guards: a cursor the read already offered, and a 20 s
time budget (`INSTANCE_LOAD_BUDGET_MS`, a resource bound, not a spec fact). A walk that trips a guard is the explicit
degraded state (503, "Composition list unavailable", a reload link): nothing is shown, never a prefix. The loader hands
the island every row in that order; a 403 is the page-level 403, a page of another revision than the draft or a page
that does not honour its request is an unverified 502. The page never re-sorts rows (the slot ordinal
is not a row member): `composition-rows.ts` keeps the listed order, replaces an updated path in place and appends a new
path by position then path. The first-party proxy is `../../server/cms-composition-instances-list.ts` behind
`pages/api/v1/cms/entries/[entryId]/compositions.ts`; it relays no entity tag (the page carries no version).

## Module map

- Copy: `composition-copy.ts` (one sentence per reason token or status; no server text is ever shown).
- Pure rules: `composition-rows.ts` (newest row per path, listed order kept, labels, 32-per-request chunks),
  `composition-choices.ts` (collision kinds and copy, first unanswered, retained choices),
  `composition-update-request.ts` (accept, bulk plan, detach), `composition-insert-fields.ts` (form bounds),
  `composition-windowing.ts` (virtualization above 100 rows).
- Server loading: `load-composition-page.ts` (the page loader), `load-composition-instances.ts` (the paged list walk),
  `composition-page-reads.ts` (the four protected reads behind one seam).
- Transport: `composition-transport.ts` (`sendJson`, `readJson`), `composition-reads.ts`, `composition-commands.ts`,
  `composition-instance-list.ts` (the browser read of the instance list, cursor walk),
  `composition-guards.ts` (structural checks of already verified answers).
- State: `use-composition-session.ts` (entry facts, rows, the one result region, the key policy),
  `use-composition-insert.ts`, `use-composition-updates.ts`, `use-composition-new-roots.ts`, `use-composition-bulk.ts`, composed by
  `use-composition-page.ts`.
- Views: `CmsCompositionPage` over `CmsPatternInsertForm` (with `CmsPatternSelector`), `CmsCompositionInstanceList`
  (with `CmsCompositionInstanceRow`), `CmsPatternUpdateDiff` (with `CmsDiffPath`, `CmsDiffNewRoots`),
  `CmsBulkUpdatePanel` and `CmsCompositionStatus` (the one focusable result region). `use-composition-panel-now.ts` gives a
  command's completion the panel as it is now.

## Conventions

- FE03 1046 and DEC-241 (extended by root): while a command is in flight (or a diff is being read) every control that
  starts another command is disabled: Place pattern, Accept update, Detach, Accept all selected updates, Detach
  selected, place new roots, and Review update / Review selected updates. Inputs stay editable: the insert fields, the
  diff answers and the row selection. A value typed or an answer changed while the command runs survives its
  completion: a verified placement clears only the pattern and overrides that still equal what was sent, and a 409
  reload keeps the answers as they are now (`use-composition-panel-now.ts`). A 403 is rendered as the shared
  `CmsEditorialCapabilityGate` in the result region; the failed pattern read keeps the listed page and holds submit off.
- `:entryId` is the only URL state: any query is a 400. Instance ids are row-local; a diff is read on every open and
  never cached; choices live in component state only. No diff value, canonical id or person id reaches a URL, storage,
  a log or telemetry (`CmsCompositionPage.privacy.test.tsx`).
- The strong `If-Match` is the entry `version`; each instance carries its own `version`. After a success the next
  version is the committed one (placement: the response ETag; update: the entry version plus one). A selection above
  32 instances is sent as successive requests of at most 32 and the entry version is read again between them.
- A selector read answered 409 (cursor conflict, BE03c 1414) drops the cursor and restarts from the first page once
  (`use-composition-insert.ts`); a pin the first page no longer lists is cleared and the author is told.
- Unsaved changes (FE03 927): the insert form is dirty when its pattern, link mode, slot path or overrides differ from
  the last sent (or first shown) values; while dirty `beforeunload` is armed and a click on any link of the page (the
  island holds none, so the listener is on the document) shows `CmsCompositionLeaveConfirm`. No draft is stored anywhere.
- An unknown outcome of any command (placement, accept, detach, new blocks, bulk) renders the pending label "Checking the
  entry before any retry…" while the session reads the entry (`readEntryFacts`) and the instance list
  (`reconcileUnknown`) and only then offers the retry; the entry read is only shown, so the retry is the identical request
  with the same key (FE03 1050).
- The instance list is refetched through the browser proxy of `cmsCompositionInstancesRead`
  (`composition-instance-list.ts`, `GET /api/v1/cms/entries/{entryId}/compositions`, DEC-206) after a verified command and
  after a 409 (FE03 1047, 1049), replacing the rows with the server's render order; a list that cannot be read keeps the
  rows the island holds, and a read a newer command overtook is dropped. A 409 on a bulk request also re-reads the
  unapplied diffs and keeps the selection; a row ticked while a command ran stays ticked (only the applied ids leave it).
- A read in flight (an update diff, a further selector page) shows
  a skeleton only after 250 ms (`../cms-editorial-workflow/CmsLoadingRegion.tsx`) and keeps the listed content.
- A key is reused only for the identical request while its outcome is unknown; a 429 blocks commands for its stated
  wait; a 409 `diff_has_collisions`/`revision_not_editable` refetches the entry facts, the instance list and the diff and keeps the
  choices for every path whose base, theirs and yours did not change.
- Link mode is an explicit choice (nothing is preselected); a collision answer is never preselected; keeping mine on a
  `structure` or `removed_root` collision names its consequence (a local copy that no longer receives updates).
- Above 100 rows the list is a fixed-height scroll region with one fixed row height; rows keep stable ids and
  `aria-posinset`/`aria-setsize`. A virtualized row is a single line.
- Components stay at most 200 lines and tests at most 400.

## Extension rules

A new reason token goes in `composition-copy.ts` after it is in `CMS_SLICE_12_OPERATION_REASONS` for its operation. A new
collision kind goes in `COLLISION_COPY` only after it is in `CompositionUpdateDiffPathSchema`. Add a failing test first;
the page suites (`CmsCompositionPage.*.test.tsx`) drive the real island against a scripted browser.

## Related links

- `../cms-related-content/README.md` (the precedent page, loader and transport)
- `../cms-pattern-designer/README.md` (the pattern definition surface, CMS-03C-12)
- `../../pages/app/cms-content-modeling/entries/[entryId]/README.md`
- `../../server/README.md` (the same-origin proxies)
- `.memory/wiki/specs/fe/03-cms-content-modeling.md`
- `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md` (CMS-03C-02, 1477)

- The whole of a command is in flight (`session.hold`): its answer, and the reads that follow it (entry, instance list,
  diffs), keep every control that starts another command disabled, so a second press cannot send a second request
  (review V19 M3). An unknown outcome whose reconciling read could not read the entry holds the retry: the commands stay
  off and "Check again" (`session.recheck`) is the only way on; it stays mounted and focused while it reads, a still
  unverified read says so again without moving focus, and a verified one moves focus to the result heading (DEC-245(4)).
  A list refetch keeps the `retired` rows the island holds (the DEC-206 read never lists them, DEC-193 lets them be
  detached) and only the latest list answer may replace the rows.

Wave 9 (review V20 m3, m5, m9, m10, n4; DEC-246):

- Every composition read (`readJson`, so the selector page, the diff, the entry facts and the instance list) ends at the
  shared 8,000 ms deadline (`../../lib/run-read-under-deadline.ts`) and answers `failed`; the hold of a command
  (`session.hold`) ends with it, so a read that never settles cannot freeze the island (`CmsCompositionPage.read-deadline.test.tsx`).
- `keepRetired(listed, held, revisionId)` keeps only the retired rows of the draft revision the read answered.
- A repeated failed "Check again" names its attempt (`reconciliationLine(…, attempt)`), so the sentence differs and the
  live region is written again.
- A placement refused for a changed block registry (`block_registry_digest_mismatch`) reads the selector's first page again
  (`composition-selector-reread.ts`, `use-composition-selector-reread.ts`) and carries the chosen pattern over with its
  current digest; if the read fails the selector is `stale`, the placement stays off and "Read the patterns again" is the
  way on (`CmsCompositionPage.registry-digest.test.tsx`).
- Tests: a list read nobody scripted is answered by the server model (`composition-list-model.test-support.ts`: the rows
  the page was given plus every mutation answer) and the test must assert the refetch through `page.lists`
  (`expectListRefetches`); `composition-page.test-support.tsx` fails a test that left one unasserted.
  `CmsCompositionPage.closing-words.test.tsx` pins "no-store and never optimistic" for the composition requests.
  `use-composition-insert.load-more.test.tsx` pins the guards of `loadMore` the button cannot reach and the browser's own
  `fetch` path of the selector re-read; `composition-update-diff.test-support.tsx` holds the fixtures and drivers shared by
  the accept and detach suites of the update diff (`CmsPatternUpdateDiff.states.test.tsx`).
