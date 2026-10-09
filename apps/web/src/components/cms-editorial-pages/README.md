# CMS editorial page loaders and views

## Contents

The tested behavior behind the protected CMS editorial Astro pages: one loader
per page that reads through the first-party proxies and returns a verified view,
one closed state, or a sign-in redirect, plus the small server-rendered views the
pages share. The `.astro` files only map an outcome to a response.

## Ownership

Loaders own addressing and verification, never data or authority. A page never
echoes an id or a value into the document outside its island's data, never
renders a message taken from a response, and never trusts a body that is not the
strict contract. Authorization, concealment and the signed cursors stay in the
Worker and the proxies.

## Module map

- `cms-editorial-page-outcome.ts` — every non-200 becomes a 401 redirect to the
  allowlisted sign-in route (safe `returnTo`) or one fixed notice (400/422 invalid
  request, 403, 404, 409 stale list position, 429 with a coarse wait, 5xx
  degraded with the verified request id). Hidden, absent and closed are one 404.
- `cms-editorial-page-reads.ts` — the one seam over the proxies
  (`createCmsEditorialPageReads(binding)`); tests inject fakes.
- `load-entry-list-page.ts`, `load-entry-create-page.ts`,
  `load-entry-edit-page.ts`, `load-conflict-page.ts`,
  `load-revision-history-page.ts` — one per route.
- `load-workflow-page.ts`, `load-review-detail-page.ts`,
  `load-review-queue-page.ts` — the Slice 11 routes (CMS-03B-15, -16, -17); the
  queue restarts from the first page after a refused cursor like the entry list.
- `CmsEditorialPageNotice.tsx`, `CmsEditorialEntryEditUnavailable.tsx` — the
  shared closed views.

## Extension rules

A new page gets a loader with its own test (every status, a malformed id without
an upstream call, a body that is not the strict contract) before an `.astro`
file; the page stays thin. Add the loader's literal-401 readers to the AC1127
guard in `apps/web/src/components/step-up-required.inventory.test.ts`.

## Conventions

Malformed ids are 400 "Invalid request" (DEC-145), never a not-found state.
A refusal the page can recover from restarts at a safe position (first page,
unfiltered list) instead of repeating the same request.

## Related links

- `apps/web/src/pages/app/cms-content-modeling/entries/README.md`
- `apps/web/src/server/README.md`
- `.memory/wiki/specs/fe/03-cms-content-modeling.md`
