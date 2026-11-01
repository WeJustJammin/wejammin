# Governed definition-review first-party API routes

## Contents

One file per browser operation, at the path BE03c declares:
`index.ts` (CMS-03C-11 queue `GET` and CMS-03C-06 submit `POST`),
`[reviewId].ts` (CMS-03C-10 detail `GET`),
`[reviewId]/decision.ts` (CMS-03C-07), `[reviewId]/assignments.ts` (CMS-03C-08) and
`[reviewId]/activation.ts` (CMS-03C-09: activate and retire answer 200, schedule 202;
the review is the path, the body names none). A browser never calls CMS-03C-18
through CMS-03C-21.

## Ownership

Each file is a single call into `server/cms-governed-review-platform-reads.ts` or
`-command.ts`, which perform transport hygiene only. The API Worker owns the
session, the capability, the owner scope and the step-up decision.

## Extension

Add a route only after its BE03c row, a failing proxy test and a failing route
test exist. `governed-reviews-routes.test.ts` proves every module sits at its
registry path and exports only its method.

## Conventions

No browser-supplied authority, person, party or capability member reaches the
Worker. Protected responses are `Cache-Control: no-store`; the review `version`
is the strong `ETag` and the `If-Match` operand.

## Related links

- `apps/web/src/server/cms-governed-review-platform-command.ts`
- `apps/web/src/server/cms-governed-review-platform-reads.ts`
- `apps/worker/src/cms-composition/governed-review-routes.ts`
- `.memory/wiki/specs/fe/03-cms-content-modeling.md` (CMS-03C-06 to CMS-03C-11)
