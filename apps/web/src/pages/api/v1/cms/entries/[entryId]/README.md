# CMS entry first-party API routes

## Contents

`revisions.ts` owns CMS-03B-01 revision-save transport with a strong
`If-Match`, idempotency key, CSRF token, and bounded contract body.
`conflicts/[conflictId]/resolve.ts` owns CMS-03B-02 explicit
conflict-resolution transport.
`related-content.ts` owns CMS-03C related-content create transport for a
bounded entry target and relation payload.

## Ownership

Each route is a first-party transport proxy through the private `PLATFORM_API`
binding. The API Worker derives session, capability, and domain authority; no
browser-supplied actor, service secret, or RPC target reaches upstream, and
fail-closed forwarding rejects missing or invalid inputs before the Worker is
called.

## Extension

Add a route only after its exact BE/FE contract and failing boundary tests
exist. A read endpoint never authorizes a later mutation.

## Conventions

Keep response bodies bounded and `Cache-Control: no-store` for protected
content. These routes do not claim or assert hosted deployment success; hosted
acceptance remains a separate owner-controlled gate.

## Related links

See `apps/web/src/server/cms-composition-platform-related.ts`,
`apps/web/src/server/cms-editorial-platform-mutation.ts`, and
`.memory/wiki/specs/fe/03-cms-content-modeling.md`.
