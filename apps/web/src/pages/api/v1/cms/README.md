# CMS first-party API boundary

## Contents

`templates/` owns the browser-facing template mutation and detail endpoints.
`capability-grants/` owns the owner-only DEC-119/DEC-120 grant transport:
`index.ts` (CMS-03A-18 list read and CMS-03A-15 grant), `[grantId]/renewals.ts`
(CMS-03A-16) and `[grantId]/revocations.ts` (CMS-03A-17). The grant id comes
from the route, ownership and step-up stay with the API Worker.
`schema-reviews/[reviewId]/decisions.ts` and `assignments.ts` carry CMS-03A-12
(reviewer decision) and CMS-03A-14 (owner assignment create or revoke) with the
review id bound from the route.
`entries/index.ts` owns the CMS-03B-10 initial-entry create transport. It
calls the server-only proxy; it does not enable the create form or supply a
workflow policy.
`entries/[entryId]/revisions.ts` owns CMS-03B-01 revision-save transport. It
requires a matching strong If-Match, idempotency key, CSRF token, and bounded
contract body before forwarding to the private Worker binding.
`entries/[entryId]/conflicts/[conflictId]/resolve.ts` owns CMS-03B-02 explicit
conflict-resolution transport. Its server proxy requires exact IDs, explicit
choices, a strong CAS tuple, and a two-parent result. It does not infer a
conflict choice or provide a browser form.

## Ownership

These routes validate and forward first-party browser requests through the
private `PLATFORM_API` binding. The API Worker owns session, capability, and
domain authorization.

## Extension

Add a route only after its exact BE/FE contract and failing boundary tests exist.

## Conventions

Do not forward browser-supplied authority fields or release secrets. Keep
response bodies bounded and `Cache-Control: no-store` for protected content.

## Related links

See `apps/web/src/server/cms-composition-platform-mutation.ts`,
`apps/web/src/server/cms-editorial-platform-mutation.ts`, and
`.memory/wiki/specs/fe/03-cms-content-modeling.md`.
