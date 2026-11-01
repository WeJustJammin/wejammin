# CMS vocabulary first-party API routes

## Contents

One file per browser operation, at the path BE03c declares:
`versions.ts` (CMS-03C-16, the vocabulary version create and successor write),
`selector.ts` (CMS-03C-17, the author-facing term selector),
`[taxonomyId]/versions.ts` (`cmsTaxonomyVersionsRead`, the versions of one vocabulary, newest first),
`[taxonomyId]/terms.ts` (`cmsTaxonomyTermsRead`, one keyset page of the curator's terms) and
`[taxonomyId]/terms/actions.ts` (CMS-03C-03, create, rename, alias, deprecate and merge).
`taxonomies-routes.test.ts` guards every route. A browser never calls CMS-03C-18.

## Ownership

Each route is one call into `server/cms-taxonomy-platform-write.ts`,
`-term-action.ts` or `-read.ts`, which own transport hygiene (same-origin, CSRF double
submit, strict JSON, `Idempotency-Key` / `If-Match`, bounded bodies, the allowlisted
query), rebuild every error from the taxonomy catalog and bind a success to the request
that asked for it. No route grants `cms.taxonomy_curator` or claims that a vocabulary is
active; the Worker and database stay the authority.

## Extension rules

Add a route only after its BE03c row, a failing proxy test and a failing route test
exist. A read never authorizes a later mutation. Activation and retirement are
CMS-03C-09 and live under `governed-reviews/`, never here.

## Conventions

No browser-selected RPC, service secret or caller-named actor reaches the Worker. Every
response is `no-store`. A mutation whose outcome cannot be verified carries
`x-cms-editorial-outcome: unknown` so the browser replays the same `Idempotency-Key`.
`selector` is a static segment and wins over `[taxonomyId]`, which is always a lineage id.

## Related links

- `apps/web/src/server/cms-taxonomy-platform-write.ts`
- `apps/web/src/server/cms-taxonomy-platform-term-action.ts`
- `apps/web/src/server/cms-taxonomy-platform-read.ts`
- `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md` (CMS-03C-03, -16, -17)
