# Slice 11 review-authority RPC pgTAP fragments (lane S11-3a)

Fragments (`*.sqlinc`) shared by the review-authority suites of `cms_assign_editorial_reviewer`
(CMS-03B-18), `cms_record_review_decision` (CMS-03B-06) and `cms_submit_review` (CMS-03B-05), and by the
independent-session race fixture. They are includes, not discovered tests: each executable
`../phase_02_slice_11_rpc_review_*.sql` opens one transaction, includes the fragments with psql `\ir`, and
rolls back.

| Fragment                  | Content                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `000-world.sqlinc`        | five real accounts (rvA, rvB, rvS, pub, rvX) with memberships and standing grants, the receipt-derived owner (a labelled fixture forgery: `initialize_cms_owner` refuses once a `cms.%` grant exists), the probe (`r11_try`: state, message token, PostgreSQL DETAIL, response), posture, key-list and leak inspectors, the effects snapshot (`r11_effects`) |
| `010-assign.sqlinc`       | CMS-03B-18 request builder (`r11_areq`) and call probe (`r11_acall`)                                                                                                                                                                                                                                                                                         |
| `020-decision.sqlinc`     | CMS-03B-06 builders: a review frozen from the REAL dependency manifest (`r11_frozen_review`), the protected policy overrides, now-window assignments, now-stamped decision rows (`r11_decide_now`), request builder and call probe                                                                                                                           |
| `030-submit.sqlinc`       | CMS-03B-05 builders: entries with a revision whose payload hash is the true projection hash (`r11_entry`), the manifest, the accessibility evidence (binding hash from the literal JCS), request builder and call probe                                                                                                                                      |
| `090-race-fixture.sqlinc` | the committed reviews, assignments and entries of `../phase_02_slice_11_races/` (included by `infra/database-races/review-kit.mjs`, never by a pgTAP file)                                                                                                                                                                                                   |

| Entrypoint                                                  | Covers                                                                                                  |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `../phase_02_slice_11_rpc_review_scopes.sql`                | `cms_editorial_review_scopes`: owner, submitter, reviewer, assignee, publisher and concealment          |
| `../phase_02_slice_11_rpc_review_assign.sql`                | CMS-03B-18 contract, committed effects, replay, revoke, reason, step-up                                 |
| `../phase_02_slice_11_rpc_review_assign_refusals.sql`       | CMS-03B-18 concealment, 403, state, CAS, eligibility, duplicate, capacity, expiry bounds, structure     |
| `../phase_02_slice_11_rpc_review_decision.sql`              | CMS-03B-06 contract, committed effects, replay, reject, two-decision flow, specialist slots             |
| `../phase_02_slice_11_rpc_review_decision_refusals.sql`     | CMS-03B-06 AC-108 order: step-up, concealment, state, CAS, separation, duplicates, grant, request rules |
| `../phase_02_slice_11_rpc_review_decision_invalidation.sql` | CMS-03B-06 committed invalidation outcomes (dependency drift, authority drift)                          |
| `../phase_02_slice_11_rpc_review_submit.sql`                | CMS-03B-05 contract, committed effects, dependency index, replay, resubmission                          |
| `../phase_02_slice_11_rpc_review_submit_refusals.sql`       | CMS-03B-05 structure, concealment, 403, CAS, not-submittable, hash, manifest, preflight, evidence       |

## Adding a test

Include the prelude in this order: `support/jwt-claims.sqlinc`, `phase_02_slice_10_rpc/000-helpers.sqlinc`,
`phase_02_slice_10_remaining_schema/000-helpers.sqlinc`, `phase_02_slice_10_rpc/001-fixtures.sqlinc`, the three
`phase_02_slice_11_schema` fragments, `phase_02_slice_11_helpers/000-helpers.sqlinc` (and `001-world`,
`002-reviews` when the suite needs the h11doc type or the review builders), then `000-world.sqlinc` and the
builder fragment of the command.

## Conventions

- Insert every revision of an entry BEFORE its first review: a newer revision of an entry invalidates the
  older live reviews (`revision_superseded`, the Slice 11 producer trigger).
- A grant or membership toggle that a test does not mean to be an authority-loss event goes through
  `pg_temp.h11_raw_exec` (the eager `cms_invalidate_reviews_for_person` trigger would otherwise run); the
  calendar lapse of a grant has no UPDATE event, which is the path `cms_record_review_decision` detects.
- Deactivating a grant revokes the person's entry assignments for the capabilities no longer held (DEC-143).
- Keep each file below 400 lines.

## Related paths

- `../../migrations/20261005017600_cms_editorial_review_support.sql` .. `20261005017640_cms_submit_review.sql`
- `../phase_02_slice_11_races/README.md`, `../../../infra/database-races/review-kit.mjs`
