# Reviewer queue and review detail pages

## Contents

`index.astro` is the CMS-03B-17 reviewer queue (assigned and submitted scopes,
state filter and signed cursor in the URL). `[reviewId].astro` is the CMS-03B-16
review detail with the decision form (CMS-03B-06) and, for the owner, the
reviewer assignment controls (CMS-03B-18).

## Ownership

Each page is a thin mapping of a tested loader outcome to a response; behavior
lives in `apps/web/src/components/cms-editorial-pages/` (loaders) and
`apps/web/src/components/cms-editorial-workflow/` (views, islands and forms).
Authorization and concealment stay in the Worker and the first-party proxies.

## Extension rules

A new page gets a loader and a test of every status first; the `.astro` file maps
the outcome and nothing else. A hidden, absent or cross-owner review is one
identical 404 state. Never put a decision reason, a reviewer or submitter
identifier or a person id in a URL or in markup outside the island's data.

## Conventions

One named main region, one focusable `h1`, `noindex`, `Cache-Control: no-store`
and the shared document shell. `*-route.test.tsx` compose the REAL loader with the
REAL view (only the proxy edge replaced) and read the Astro file for the response
invariants.

## Related links

- `apps/web/src/components/cms-editorial-workflow/README.md`
- `apps/web/src/pages/app/cms-content-modeling/entries/README.md`
- `.memory/wiki/specs/fe/03-cms-content-modeling.md`
