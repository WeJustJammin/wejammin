# CMS entry sub-pages

## Contents

The protected Astro pages that hang below one entry, `/app/cms-content-modeling/entries/{entryId}/`:

- `revisions.astro` - CMS-03B-03 revision history, domain-grouped comparison, typed refusals and the CMS-03B-04 inline restore review.
- `workflow.astro` - CMS-03B-15 entry workflow: the revision, the 17 checks, the review, schedules and publications, and exactly the command forms `permittedNextActions` allows (CMS-03B-05 submit, -07 schedule, -08 preview, -09 publish).
- `workflow-route.test.tsx` - composes the real workflow loader with the real island and asserts what a reader gets (only the proxy edge is replaced).
- `conflicts/[conflictId].astro` - CMS-03B-12 conflict detail and CMS-03B-02 resolution (documented in the parent README).

## Ownership

The Phase 2 CMS editorial authoring and workflow surface owns these pages (Slice 10 for revisions and conflicts, Slice 11 for the workflow). A page is a thin mapping of a tested loader outcome to a response; the behavior lives in `apps/web/src/components/cms-editorial-pages/` (loaders), `cms-editorial-workflow/` and `cms-editorial/` (islands, views, transports). Authorization and concealment stay in the Worker and `apps/web/src/server/`.

## Extension

A new sub-page gets a loader and a test of every status first; the `.astro` file maps the outcome and nothing else. Give it a route test beside it. Update the parent `../README.md` file list and this list in the same change. A malformed `entryId` is a 400 invalid-request state, never a not-found state.

## Conventions

- `export const prerender = false` and `Cache-Control: no-store` on every page; one named main region, one focusable `h1`, an explicit `lang`, `noindex` and a skip link, all supplied by `CmsEditorialDocument.astro`.
- Never put a draft value, a preimage, a frozen manifest, a version set or an owner or assignee identifier in a URL or a log line. The workflow's manifest and version set exist only in the island data of its no-store document.
- Pages never write a `<script>` tag or `new Response(html)`.

## Related links

- `../README.md` (the entries pages and their invariants)
- `apps/web/src/components/cms-editorial-pages/README.md`
- `apps/web/src/components/cms-editorial-workflow/README.md`
- `.memory/wiki/specs/fe/03-cms-content-modeling.md`
- `.memory/wiki/specs/be/03b-editorial-workflow-publication.md`
