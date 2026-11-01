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
  `composition-guards.ts` (structural checks of already verified answers).
- State: `use-composition-session.ts` (entry facts, rows, the one result region, the key policy),
  `use-composition-insert.ts`, `use-composition-updates.ts`, `use-composition-bulk.ts`, composed by
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
- An unknown placement outcome reads the entry (`readEntryFacts`) before the retry is offered; the read is only shown, so
  the retry is the identical request with the same key. A read in flight (an update diff, a further selector page) shows
  a skeleton only after 250 ms (`../cms-editorial-workflow/CmsLoadingRegion.tsx`) and keeps the listed content.
- A key is reused only for the identical request while its outcome is unknown; a 429 blocks commands for its stated
  wait; a 409 `diff_has_collisions`/`revision_not_editable` refetches the entry facts and the diff and keeps the
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
