# CMS composition first-party API routes

## Contents

`pattern-instances.ts` forwards CMS-03C-02 (insert a pattern into a draft revision, `POST`).
`pattern-updates.ts` forwards CMS-03C-15 (accept or detach pattern updates for 1-32 instances, `POST`).
`instances/[instanceId]/update-diff.ts` forwards CMS-03C-14 (the three-way diff of one pattern instance, `GET`).
`composition-instances-endpoints.test.ts` proves the routes sit at their registry paths and export only their
method; `pattern-instances.test.ts` guards the insert route. The read of the instance list is
`../entries/[entryId]/compositions.ts` (`cmsCompositionInstancesRead`, DEC-206), not a file here.

## Ownership

Each file is a thin call into a server proxy under `apps/web/src/server/cms-composition-*.ts`, which perform
transport hygiene only (same-origin, CSRF double submit, strict JSON, `Idempotency-Key`, `If-Match`, bounded bodies)
and rebuild every error from the composition catalog. The API Worker owns the session, the assignment and edit
authority, the collision coverage and the all-or-nothing write.

## Extension

A new operation gets its own proxy under `apps/web/src/server/`, a failing proxy test, a one-call route file at the
path BE03c declares, and an endpoint test entry. A read never authorizes a later mutation.

## Conventions

No browser-supplied authority, actor or RPC target reaches the Worker. Every response is `Cache-Control: no-store`.
A mutation whose outcome cannot be verified carries `x-cms-editorial-outcome: unknown` so the browser replays the
same `Idempotency-Key`.

## Related links

- `apps/web/src/server/README.md` (the CMS composition map)
- `../patterns/README.md` (the selector and pattern versions)
- `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md` (CMS-03C-02, -14, -15; 175-179)
