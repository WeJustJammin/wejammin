# CMS entry collection API routes

## Contents

The collection-level first-party routes for CMS entries: `index.ts` serves the
CMS-03B-10 initial create (`POST`) and the CMS-03B-13 authorized entry list
(`GET`), and `authoring-context.ts` serves the CMS-03B-14 authoring context
read (`GET`). `[entryId].ts` serves the CMS-03B-11 draft detail (`GET`) the
editor refetches after a created revision or a 409. `index.test.ts` covers the
create transport. Routes for one entry (revisions, conflicts, locales, related
content) live in `[entryId]/`.

## Ownership

Each route is a first-party transport proxy through the private `PLATFORM_API`
binding, delegating to `apps/web/src/server/cms-editorial-platform-mutation.ts`
or `cms-editorial-platform-reads.ts`. The protected API Worker derives session,
capability, and domain authority; no browser-supplied actor, owner, assignee,
acting party, or capability reaches upstream. The list and authoring-context
reads are safe reads that carry no body, no `Idempotency-Key`, and no
`If-Match`, and the authoring-context read never grants schema-registry read.

## Extension

Add a route here only after its exact BE03b/FE03 contract and a failing
boundary test exist, and register the Worker operation before the proxy. A new
verb on an existing path needs its own export (`GET`, `POST`) and its own
test; keep `export const prerender = false` and delegate to a server module
rather than inlining forwarding logic.

## Conventions

Keep response bodies bounded and `Cache-Control: no-store` for protected
content, and answer exactly the status the upstream authority returns. Routes
here do not claim hosted deployment success; hosted acceptance remains a
separate owner-controlled gate.

## Related links

- `apps/web/src/pages/api/v1/cms/entries/[entryId]/README.md`
- `apps/web/src/server/cms-editorial-platform-reads.ts`
- `apps/web/src/server/cms-editorial-platform-mutation.ts`
- `.memory/wiki/specs/be/03b-editorial-workflow-publication.md`
- `.memory/wiki/specs/fe/03-cms-content-modeling.md`
