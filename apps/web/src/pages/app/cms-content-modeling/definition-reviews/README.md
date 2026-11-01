# Definition review queue and detail pages

## Contents

`index.astro` is the CMS-03C-11 definition-review queue (assigned, submitted and
owned scopes; state and kind filters, limit and the signed cursor in the URL).
`[reviewId].astro` is the CMS-03C-10 review detail with the decision form
(CMS-03C-07) and, for the owner, the reviewer assignment controls (CMS-03C-08) and
the activation form (CMS-03C-09: activate or schedule an approved or blocked version,
retire an active one, as the server's `permittedNextActions` permits).
`definition-review-routes.test.tsx` composes each page's real loader and view.

## Ownership

Each page is a thin mapping of a tested loader outcome to a response; behavior lives
in `apps/web/src/components/cms-governed-review/` (loaders, views, island and forms).
Authorization and concealment stay in the Worker and the first-party proxies. The
activation form is offered only for an action the server lists; the page never decides
who owns a version.

## Extension rules

A new page gets a loader and a test of every status first; the `.astro` file maps the
outcome and nothing else. A hidden, absent or cross-owner review is one identical 404
state. Never put a decision reason, a reviewer or submitter identifier or a person id
in a URL or in markup outside the island's data.

## Conventions

One named main region, one focusable `h1`, `noindex`, `Cache-Control: no-store` and
the shared `CmsEditorialDocument` shell. The queue is reachable from the primary
navigation of `/app/cms-content-modeling`.

## Related links

- `apps/web/src/components/cms-governed-review/README.md`
- `apps/web/src/pages/app/cms-content-modeling/reviews/README.md`
- `.memory/wiki/specs/fe/03-cms-content-modeling.md`
