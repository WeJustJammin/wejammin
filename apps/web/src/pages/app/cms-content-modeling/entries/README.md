# CMS editorial entries pages

## Contents

The protected Astro surfaces of the CMS editorial workflow: `index.astro` (the
CMS-03B-13 entry list), `new.astro` (CMS-03B-10 create with CMS-03B-14 context),
`[entryId].astro` (the CMS-03B-11 draft editor with CMS-03B-01 autosave),
`[entryId]/conflicts/[conflictId].astro` (CMS-03B-12 / -02 resolution) and
`[entryId]/revisions.astro` (CMS-03B-03 history, comparison and CMS-03B-04
restore).

## Ownership

Each page is a thin mapping of a tested loader outcome to a response; behavior
lives in `apps/web/src/components/cms-editorial-pages/` (loaders),
`cms-editorial/` (islands, views and transports) and
`cms-editorial-fields/` (field editors). Authorization and concealment stay in
the worker/API and `apps/web/src/server/`.

## Files

- `index.astro` — list of native links (lifecycle, draft revision, state and
  update time as text), URL-owned filters and signed cursor, `no-records` and
  `filter-miss` as distinct empty states with one action each.
- `new.astro` — content-type selector (native GET) and the typed create island.
- `[entryId].astro` — the draft editor island; a readable draft whose field
  definitions are unavailable is a closed "Editing is unavailable" view.
- `[entryId]/conflicts/[conflictId].astro` — per divergent field the base, their
  version and your version with native radios and an explicit-value editor.
- `[entryId]/revisions.astro` — history list, domain-grouped comparison, typed
  refusals and the inline restore review.
- The document shell is
  `apps/web/src/components/cms-editorial/CmsEditorialDocument.astro`: processed
  Astro markup so the `route-heading-focus`, `auth-scope-sync` and
  `cms-editorial-page-actions` `<script src>` tags are bundled, plus the editorial
  stylesheet. Pages never write `<script>` or `new Response(html)`.
- `*-route.test.ts(x)` — compose the REAL loader with the REAL views (only the
  proxy edge replaced) and assert what a reader gets; `entries-route.test.ts`
  guards the response invariants no other test can (not prerendered, `no-store`,
  one shell, sign-in is only the allowlisted 303).

## Extension rules

A new page gets a loader and a test of every status first; the `.astro` file maps
the outcome and nothing else. A malformed id is a 400 invalid-request state, never
a not-found state. Never put a draft value, a preimage or an owner/assignee
identifier in a URL, a log line or markup outside the island's data.

## Conventions

One named main region, one focusable `h1`, an explicit `lang`, `noindex`,
`Cache-Control: no-store`, and an accessible skip link.

## Related links

- `apps/web/src/components/cms-editorial/README.md`
- `apps/web/src/components/cms-editorial-pages/README.md`
- `.memory/wiki/specs/fe/03-cms-content-modeling.md`
- `.memory/wiki/specs/be/03b-editorial-workflow-publication.md`
