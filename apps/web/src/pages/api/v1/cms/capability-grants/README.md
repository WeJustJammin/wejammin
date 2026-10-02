# CMS capability grant API routes

## Contents

`index.ts` forwards CMS-03A-18 (owner grant list read) and CMS-03A-15 (grant).
`[grantId]/renewals.ts` forwards CMS-03A-16 and `[grantId]/revocations.ts`
forwards CMS-03A-17. `capability-grants.test.ts` covers the transport.

## Ownership

Same-origin transport only. The API Worker derives the receipt-bound owner,
checks step-up and the 90-day term ceiling, and answers 401 `STEP_UP_REQUIRED`,
403, 404, 409 or 422. These routes validate shape through the generated
contracts and never accept an actor, party or grantor from the browser.

## Extension

Add a route only after its BE03a contract and failing boundary tests exist, and
bind any path identifier from the route parameter, never from the body.

## Related

`apps/web/src/server/content-schema-registry-platform-mutation.ts`,
`apps/web/src/server/cms-capability-grant-platform-api.ts` and
`apps/web/src/components/cms-capability-grants/README.md`.
