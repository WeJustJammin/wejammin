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
`entries/index.ts` owns the CMS-03B-10 initial-entry create and CMS-03B-13
entry-list transports, `entries/[entryId].ts` the CMS-03B-11 draft refetch and
`entries/authoring-context.ts` the CMS-03B-14 read (see `entries/README.md`).
They call server-only proxies; workflow-policy evidence and authority are
resolved by the Worker and the database, never supplied here.
`entries/[entryId]/revisions.ts` owns CMS-03B-01 revision-save transport. It
requires a matching strong If-Match, idempotency key, CSRF token, and bounded
contract body before forwarding to the private Worker binding. The CMS-03B-03
history read has no API route: the revisions page reads it server-side.
`entries/[entryId]/conflicts/[conflictId]/resolve.ts` owns CMS-03B-02 explicit
conflict-resolution transport. Its server proxy requires exact IDs, explicit
choices, a strong CAS tuple, and a two-parent result. It does not infer a
conflict choice. `entries/[entryId]/conflicts/[conflictId].ts` serves the
CMS-03B-12 open-conflict read and `entries/[entryId]/revisions/[revisionId]/restore.ts`
the CMS-03B-04 restore transport. The browser forms are under
`apps/web/src/components/cms-editorial/`.

The Slice 11 review, schedule, preview and publication endpoints are one file
each, at the path the generated registry declares: `entries/[entryId]/reviews.ts`
(CMS-03B-05), `entries/[entryId]/workflow.ts` (CMS-03B-15),
`reviews/index.ts` (CMS-03B-17), `reviews/[reviewId].ts` (CMS-03B-16),
`reviews/[reviewId]/decision.ts` (CMS-03B-06), `reviews/[reviewId]/assignments.ts`
(CMS-03B-18), `publication-schedules/index.ts` (CMS-03B-07), `previews/index.ts`
(CMS-03B-08) and `publications/index.ts` (CMS-03B-09). Every file is a single
call into `server/cms-workflow-platform-command.ts` or `-reads.ts`;
`slice-11-workflow-routes.test.ts` proves each module sits at its registry path.
CMS-03B-19 and CMS-03B-20 are internal RPCs with no browser route.

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
