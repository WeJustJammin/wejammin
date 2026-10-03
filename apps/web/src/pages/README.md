# Web pages

## Contents

The Astro route tree of `@wejammin/web`. Top-level files are `index.astro` (the
degraded workspace status page), `offline.astro` (the degraded service-status
page), `step-up.astro` (the step-up challenge) and
`astro-page-imports.test.ts` (the island default-import guard). Subdirectories
group `app/`, `auth/`, `claim/`, `profiles/`, `settings/`, `system/` pages and
the same-origin `api/v1/` transport routes.

## Ownership

Pages own server-rendered route composition: they resolve the request, call a
`src/server/` projection, set cache headers and hand serializable props to an
island. Authorization, eligibility and persistence stay in the API Worker and
database; pages never decide them.

## Extension

Add a page beside its feature group, keep the named Astro file under 200 lines
by moving presentation into `../components/`, set `export const prerender =
false` and `Cache-Control: no-store` for authenticated pages, and redirect a
missing session with `authPageRedirect`. Default-imported islands must export a
default; `astro-page-imports.test.ts` enforces it.

## Conventions

- One named main region and one h1 per page.
- Failures are disclosure-safe: no identifiers or internals in copy.
- Request IDs come from `x-request-id` through `createRequestId` or
  `RequestIdSchema`, falling back to a generated UUID.

## Related links

- `apps/web/src/server/`
