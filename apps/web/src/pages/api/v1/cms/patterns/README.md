# CMS pattern first-party API routes

## Contents

`versions.ts` forwards CMS-03C-12, the pattern version create and successor write.
`[patternKey].ts` forwards `cmsPatternLatestRead`, the owner's latest version of a
pattern key in any state. `selector.ts` forwards CMS-03C-13, the nested-pattern picker, through
`server/cms-composition-instances-selector.ts`. `patterns-routes.test.ts` guards the routes.

## Ownership

The routes only call the server proxies in
`apps/web/src/server/cms-pattern-platform-*.ts`, which own transport hygiene
(same-origin, CSRF double submit, strict JSON, `Idempotency-Key` / `If-Match`,
bounded bodies), rebuild every error from the composition catalog and bind a success
to the request that asked for it. Neither route grants `cms.template_designer` or
claims that a pattern is active; the Worker and database stay the authority.

## Extension rules

`selector.ts` (`GET /api/v1/cms/patterns/selector`, CMS-03C-13) is its own static route
with its own proxy; `selector` stays a reserved key, so `[patternKey]` still answers it 400. A detail read never authorizes a later mutation. Keep any activation command in a
separately tested route with its own locked contract.

## Conventions

No browser-selected RPC, service secret or caller-named actor reaches the Worker.
Every response is `no-store`. A mutation whose outcome cannot be verified carries
`x-cms-editorial-outcome: unknown` so the browser replays the same `Idempotency-Key`.

## Related links

- `apps/web/src/server/cms-pattern-platform-write.ts`
- `apps/web/src/server/cms-pattern-platform-latest.ts`
- `apps/web/src/server/cms-composition-instances-selector.ts`
- `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md` (CMS-03C-12)
