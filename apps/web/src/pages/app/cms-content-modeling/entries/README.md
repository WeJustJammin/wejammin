# CMS editorial entries pages

## Contents

Astro surfaces for the CMS-05 entry workbench: `new.astro` for the CMS-03B-10
initial create, `[entryId].astro` for the CMS-03B-11 protected draft read,
and `[entryId]/revisions.astro` for CMS-03B-03 revision summaries. The two
reads use protected first-party proxies; create stays fail-closed.

## Ownership

This directory owns the two entry-workbench route shells and their structural
route test. It does not own create or draft transport, draft state, autosave,
or authorization; those stay in
`apps/web/src/components/cms-editorial/`, `apps/web/src/server/`, and the
worker/API contracts.

## Files

- `new.astro` - CMS-03B-10 create surface. Answers one honest `503` for every
  method: no form, no input, and no idempotency key is rendered. The web proxy
  and protected Worker route exist, but the locked request needs a
  `workflowPolicy` evidence object no protected served response exposes, so a form
  would collect a draft that cannot be committed. It never implies that an
  entry exists.
- `[entryId].astro` - CMS-03B-11 draft-detail surface. A non-UUID id is a
  plain `404` addressing no entry, answered without an upstream call. A
  well-formed id is forwarded through
  `apps/web/src/server/cms-editorial-platform-reads.ts`: `401` redirects to
  sign-in, visible-but-unassigned `403` renders an access-denied document
  without draft values, concealed/absent `404` renders not-found, and any
  other status renders a degraded document at that status. A `200` is
  re-verified against the shared resource schema
  before rendering. The requested id is resolved but never echoed.
- `[entryId]/revisions.astro` - read-only SSR history with a native GET filter,
  safe revision summaries and hash-free comparison status, and a URL-owned
  signed-cursor continuation. Native fragment targets move focus to the list
  after filtering/pagination and to the named result after comparison. It never
  renders draft field values or a restore mutation. Visible-but-unassigned reads
  retain `403`; concealed/absent entries retain `404`. A missing Vault signing
  key leaves the page degraded.
- `../../../../components/cms-editorial/CmsEditorialDocument.astro` - the one
  document shell all three routes render through. It is processed Astro markup
  so its `route-heading-focus` and `auth-scope-sync` `<script src>` tags are
  bundled; a page that rebuilt the shell as a runtime HTML string would ship
  unbuilt `.ts` URLs. Pages compute a view model and set
  `Astro.response.status`; they never write `<script>` or `new Response(html)`.
  `apps/web/built-route-scripts.mjs` (tested by `tests/web-built-route-scripts.test.ts`) re-checks this against every production
  build.
- `entries-route.test.ts` and `revision-history-route.test.ts` - read the
  `.astro` files as text and assert the
  no-store, non-prerendered shell, the accessible heading and skip link, the
  exact status codes, the absence of a mutation form, and the boundary
  traceability. Production-built Chrome coverage also exercises `403` and
  `404` through the protected Worker and first-party proxies.

## Extension rules

Keep each page's denied and degraded states on `CmsEditorialDocument` so
`403`, `404`, and `503` cannot drift apart, and keep blocker copy sourced from the owning component
module. Do not add a create form or an id echo until a protected
`workflowPolicy` evidence source is defined; the served route alone cannot
supply that required evidence.

## Conventions

One named main region, one focusable `h1`, an explicit `lang`, `noindex`,
`Cache-Control: no-store`, and an accessible skip link. Raw interpolations go
through `escapeHtml` before entering the document.

## Related links

- `apps/web/src/components/cms-editorial/README.md`
- `.memory/wiki/specs/fe/03-cms-content-modeling.md`
- `.memory/wiki/specs/be/03b-editorial-workflow-publication.md`
