# Governed review command routes

## Contents

`decision.ts` forwards CMS-03C-07 (the reviewer's decision), `assignments.ts` CMS-03C-08 (assignment create or
revoke) and `activation.ts` CMS-03C-09 (activate and retire answer 200, schedule 202). The review is the path
`[reviewId]`; the detail read CMS-03C-10 is `../[reviewId].ts`. `../governed-reviews-routes.test.ts` proves each
module sits at its registry path and exports only its method.

## Ownership

Each file is a single call into `server/cms-governed-review-platform-command.ts`, which performs transport hygiene
only. The API Worker owns the session, the capability, the owner scope and the recent-MFA decision: CMS-03C-07, -08
and -09 are the only 03c operations that answer 401 `STEP_UP_REQUIRED` (BE03c 1439).

## Extension

A new command needs its BE03c row, a failing proxy test and a failing route test first, then one route file that
calls its proxy spec. Update `../README.md` in the same change.

## Conventions

The review `version` is the strong `ETag` and the `If-Match` operand. No browser-supplied authority, person, party
or capability reaches the Worker; responses are `Cache-Control: no-store`.

## Related links

- `../README.md`
- `apps/web/src/server/cms-governed-review-platform-command-specs.ts`
- `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md` (CMS-03C-06 to -11)
