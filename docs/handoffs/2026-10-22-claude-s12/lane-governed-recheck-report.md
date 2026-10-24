# Lane `claude_s12_governed_recheck` report (AC-202 / AC-203 / AC-204)

## Status

GREEN. AC-202 / AC-203 / AC-204 are implemented and proven: new pgTAP suite 83/83; 14 existing governed/dec191 files green (including the five
corrected suites); Worker 116 files / 1,991 tests; `tsc --noEmit` exit 0. HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e`. Two root actions are open
(inventory suite, promotion): see Requests to root. No acceptance box is ticked (root owns tracking).

## Scope

P2-S12-AC-202 (producers enqueue the typed job `cms.governed_review.recheck`), AC-203 (`cms_recheck_governed_reviews`: 500/run, cursor, idempotent,
closed reasons, schedule cancel, no event), AC-204 (`cms_invalidate_governed_reviews_for_person` called by the revoking transaction; the
open-review assignment-revocation half already existed in `cms_assign_governed_reviewer` and is re-proven here).

## Design decisions (cited)

1. Reuse, not duplicate: `platform_private.cms_governed_frozen_status(review)` (20261013300400) is the hash/policy/identity currency test;
   `platform_private.cms_governed_invalidate_approved_review(review, reason, actor, party, correlation)` (20261014070000) is the single-review
   invalidation (subject FOR UPDATE before review FOR UPDATE, subject -> draft, pending/failed_retryable schedules -> cancelled
   `approval_invalidated`, audit, no event). BE03c 1482 (lock row), 1463, 1465.
2. `cms_recheck_governed_reviews(request)` request `{eventId, kind, refId, cursor}` + optional `batch` (1..500, default 500). Mirrors
   `cms_dependency_recheck_run` (20261010164100). kind in `block|pattern|content_type|canonical_domain`; `content_type` and `pattern` name a version that
   stands for its whole lineage (an activation names the new version, stale reviews froze its predecessor) via the promoted
   `cms_dependency_recheck_lineage('schema'|'pattern', ref)`. Reviews with `activated_at` set are not live and are never selected.
3. Verdict (`cms_governed_recheck_verdict`): `frozen_status` changed -> `dependency_changed`; else for an `approved` review a short live
   qualifying-approval count or unheld specialist slot (the recount `cms_governed_activation_verdict` uses) -> `reviewer_authority_changed`.
4. `cms_invalidate_governed_reviews_for_person(person, capability)` invalidates every open/approved review in which the person has an `approve`
   decision under that capability (NULL = any) that NO LONGER COUNTS (not in `cms_governed_review_qualifying_decisions`): mirror of 03b
   `cms_invalidate_reviews_for_person` (20261005017580) as BE03c 1465 says; returns the number transitioned.
5. Wiring into the revoking transaction: AFTER UPDATE|DELETE row trigger `cms_organization_actor_grant_governed_authority` on
   `identity_private.organization_actor_grant` (the seam 03b uses; the CMS-03A-17 revoke projects `active=false` into that table), passing
   `old.person_id, old.capability_code`. No promoted function is patched.
6. Worker: producers for `cms.block.lifecycle.changed.v1`, `cms.schema.activated.v1`, `cms.pattern.activated.v1` rereading the committed event through
   the new `cms_governed_recheck_resolve_event` and enqueueing `{jobType:'cms.governed_review.recheck', schemaVersion:1, payload:{eventId,kind,refId},
   cursor, correlationId}`; the job runs `cms_recheck_governed_reviews` and enqueues the continuation before it acks; composed in front of the Slice 11
   processor (a governed producer retry returns before the editorial recheck runs).
7. Design change (Worker): the first draft reused the Slice 11 resolver and imported the Slice 11 composition from the governed `production.ts`; the
   DEC-156 import-graph guard (`cms-editorial-principals*.test.ts`) failed 7 tests. Fixed by a governed resolver (migration `20261022030300`, wraps the
   promoted `cms_dependency_recheck_event_ref`, maps to governed kinds) and `createProductionGovernedRecheckProcessor(env, fetch, options, delegate)`
   taking the Slice 11 processor from `production-async-entrypoint.ts`, which stays its only importer. The guard is untouched and green.

## Behaviour decisions to review

- `batch` is an optional request key (a larger value is INVALID_REQUEST), so a run never exceeds 500 and the cursor is testable without 501 reviews.
- The result adds `dependencyChanged`, `reviewerAuthorityChanged` (sum = `invalidated`) and `unavailable`: the metric
  `cms_governed_review_invalidated_total{reason}` (BE03c 1751) needs the split; `unavailable` counts reviews whose policy evidence is NULL
  (DEPENDENCY_UNAVAILABLE), left live (fail closed at their own decision/activation) and never blocking the reviews behind them.
- The recheck covers `open` reviews for dependency change but recounts approvals only for `approved` reviews.
- Only the actor-grant projection is wired (spec: "revokes a standing capability grant"). A membership-tenure end is NOT wired for governed reviews
  (03b wires both); the recheck verdict catches that lag at the next recheck and decision/activation recount at use.

## Files (path | lines | SHA-256)

| path | lines | SHA-256 |
| --- | --- | --- |
| `supabase/migrations-wip/governed-recheck/20261022030000_cms_governed_recheck_verdict.sql` | 66 | `abc979f2cad6248f328d2b34ac47a43eb68baa23b4dfc22fc7dce55cd668db61` |
| `supabase/migrations-wip/governed-recheck/20261022030100_cms_recheck_governed_reviews.sql` | 206 | `3584619ea700e122935c978385c552880d731f8d9f17c7ac9210c4938d4ed682` |
| `supabase/migrations-wip/governed-recheck/20261022030200_cms_invalidate_governed_reviews_for_person.sql` | 117 | `7236f20e86f15199e23291c2ea1418d9c1555f3759e52c2d319e015fcd7ac409` |
| `supabase/migrations-wip/governed-recheck/20261022030300_cms_governed_recheck_resolve_event.sql` | 73 | `8731b987388c0ee14b52d7a7760b33af42fb1c035c00211a23eb89dd0ab3c8e9` |
| `supabase/tests/phase_02_slice_12_governed_recheck.sql` | 41 | `a736b45472c89fb7e4b65b3f06e1b8684448afd0297b533cf70b9c4b7490b4f1` |
| `supabase/tests/phase_02_slice_12_governed_recheck/005-helpers.sqlinc` | 86 | `a354df986cf386a461622e4287edc40179161a591ba65207bc6aab7b0346caec` |
| `supabase/tests/phase_02_slice_12_governed_recheck/010-setup.sqlinc` | 96 | `bf018bf5d5315b0c804139f58ff025f656a87c83f46409634a84c9338a97e97d` |
| `supabase/tests/phase_02_slice_12_governed_recheck/020-contract.sqlinc` | 84 | `03c902339fb57e6af43ef6ba4a7c10d629d0dae0e01c02e172fe65270f6d0f9d` |
| `supabase/tests/phase_02_slice_12_governed_recheck/030-person.sqlinc` | 140 | `6333b60516118ed2dddc2a5cfd0d705d17881dedd4c8693c75478c7e95888983` |
| `supabase/tests/phase_02_slice_12_governed_recheck/040-recheck.sqlinc` | 112 | `caae0f37533113af4df78dbaca505d89d3b5130a87110abd07eec02f462c816c` |
| `supabase/tests/phase_02_slice_12_governed_recheck/050-block.sqlinc` | 42 | `16ec16849967a9ad56fde4da3cf7a28f4c0d1a1eaf1f4d7e2ecefdac237dfddf` |
| `supabase/tests/phase_02_slice_12_governed_recheck/060-resolver.sqlinc` | 32 | `a8132331a477271327e173f4010627a26754dc1272a60f9c893d840f1a720ea8` |
| `supabase/tests/phase_02_slice_12_governed_recheck/README.md` | 18 | `2332bd07e887cfb6305af40fb0170f74f57fbad7d688655f7033b74b48a75fd1` |
| `apps/worker/src/cms-composition/governed-recheck/contract.test.ts` | 93 | `0c509be35e9866e97b786c4f544546ae65aebd3e0047bdda41702f98ef9d859f` |
| `apps/worker/src/cms-composition/governed-recheck/contract.ts` | 109 | `e586252750a6337fb8a1a78945cdd1616e852308b5f6b8828e67ca2dfa179fb9` |
| `apps/worker/src/cms-composition/governed-recheck/governed-recheck.test-support.ts` | 83 | `534219c93c5f32b6a0d5f00824ce73035d8f331cc019280f23fd4fbe62f337c6` |
| `apps/worker/src/cms-composition/governed-recheck/job.test.ts` | 193 | `fecd1355a7c9f843f0d39ee8b9a35400fda0e39f7e9c8e9a6792d98aacf89083` |
| `apps/worker/src/cms-composition/governed-recheck/job.ts` | 151 | `51c5077bdcd9a4bf0331246a7be836f35a6197c935fe4e3338df141a8e6fee9b` |
| `apps/worker/src/cms-composition/governed-recheck/message.ts` | 16 | `ff30ef45fe816cc03292ba30e1e91f5c047c5bded41d8798c07108616bff2a89` |
| `apps/worker/src/cms-composition/governed-recheck/processor.test.ts` | 76 | `f0457475d2dbf2da0bea7ff432e841baccee489fd35c0ae74f043a7ca2e75735` |
| `apps/worker/src/cms-composition/governed-recheck/processor.ts` | 57 | `ca5a533995a89735f4debb03097f016642026a7a850be5497a90a4113db46374` |
| `apps/worker/src/cms-composition/governed-recheck/production.test.ts` | 143 | `4286cb056d7cc146dc15ad9d29f208c15ceee98413afcf6a9705d79cce0d5a2f` |
| `apps/worker/src/cms-composition/governed-recheck/production.ts` | 60 | `bc2f418a736ef88ed3512d3779acaed0c7e1b0966cc810abc2e0b8670bdd4aa1` |
| `apps/worker/src/cms-composition/governed-recheck/README.md` | 66 | `957bd70d4c6decb55da4acb447aca4cf74f4b697352e43d4f21e4c98970ab337` |
| `apps/worker/src/cms-composition/governed-recheck/rpc-names.ts` | 15 | `6b6bf1d54d5b86ccc0bc3ad1c8728ab2e0a36e4e24b89028864cf26464bd0599` |
| `apps/worker/src/cms-composition/governed-recheck/rpc.test.ts` | 56 | `4e1aac1cd3688bb5e1cbacb54d4390e17289a279e16ee4a4fc44cf13b5b81eda` |
| `apps/worker/src/cms-composition/governed-recheck/rpc.ts` | 65 | `a3c9465e6fd56109d9ac343ec2c8ec218398e92885dd190e71f98ec82a5b7306` |
| `apps/worker/src/cms-composition/governed-recheck/source-consumers.test.ts` | 163 | `e29f28bd4419fdc81061eb9917fd3957a6c4c21a756d47e4496a6d597df35d5a` |
| `apps/worker/src/cms-composition/governed-recheck/source-consumers.ts` | 196 | `db1ceb59bdd1968b44908aeb62feca9f32570f2af494188efd8967756e726c6f` |
| `apps/worker/src/async-entrypoint.ts` | 307 | `13377dd390695c5fcb5fefa55c8216270740f9b73373626764f2b182f3bac7ff` |
| `apps/worker/src/async-runtime-rpc-types.ts` | 90 | `68caf7862657e0b0dd2d651a996ad22c9d57c4989639250860b8b5b0be6899c6` |
| `apps/worker/src/production-async-entrypoint.ts` | 190 | `8ee58a7281591af38b20a8c7813797f7e33f361a06a309bda589b353142efa21` |
| `apps/worker/src/production-async-entrypoint-review-recheck.test.ts` | 117 | `04556a5eae3198f815e859fb25e8a226ab0952bd3c4dd02321d926e8b9ed218c` |
| `supabase/tests/phase_02_slice_12_governed_activation/060-invalidation.sqlinc` | 123 | `16ce585ea82b6b74feb2c5d5374bfe1d7b42ed4397706e8fa4912dc0b1779927` |
| `supabase/tests/phase_02_slice_12_governed_activation/095-retire.sqlinc` | 266 | `f4a111630bee6a3ae45516a3110d0f93c38e66cc2e6e4e003a4a6378ba81d33c` |
| `supabase/tests/phase_02_slice_12_governed_decision/050-invalidation-gates.sqlinc` | 131 | `31af9dd1ecb384d04648ae5252aa2f2ab214958a49283ed822770b094335705b` |
| `supabase/tests/phase_02_slice_12_governed_decision.sql` | 35 | `ad6165ae850003ff22601bb5a695e02b4f99bf8fcb9d713d83f87e499719b047` |
| `supabase/tests/phase_02_slice_12_governed_schedule/055-fire-approval.sqlinc` | 54 | `1303d01c7a34387665d51b8e11e69a150ca525b304c064e90a48e903539a8b37` |
| `supabase/tests/phase_02_slice_12_dec191/040-detail.sqlinc` | 139 | `f15940c3e10f380650de4656d9fbc6b3ab3d541eaaac216f4dbac262e929b39c` |
| `supabase/tests/phase_02_slice_12_dec191/010-setup.sqlinc` | 53 | `d686cdaa3656bbf3882c1603a2535709e7825cc3fc0b7c047e3be5365a381038` |

Existing Worker files touched (additive): `async-entrypoint.ts` (queue message union + routes the governed job message to the existing
`processReviewRecheck` seam), `async-runtime-rpc-types.ts` (two RPC names in the union), `production-async-entrypoint.ts` (`recheckFor` composes the
governed processor around the Slice 11 one passed as `delegate`).

## Runs

- RED: 2026-10-22 03:15:17 EDT (queued from 02:50), stamp `025041-3294863`, lane `governed-recheck`, manifest `promoted=461 wip=0` (clean RED: no lane SQL
  staged). no_plan: 78 tests ran, 36 ok, 42 not ok, then a HARNESS abort at `060-resolver.sqlinc:18` (`column e.created_at does not exist`: outbox_events has
  `occurred_at`; test bug, fixed). The 42 failures are genuine missing feature (first failing test 14 "the recheck job has a named platform API RPC");
  fixtures and controls passed. TAP SHA-256 `5db4cab4b5fa8efaa89bfdd5a68dd0cac067aa7c65e85743a8582e8257fe3aa3`.
- GREEN 1: 2026-10-22 03:17:27, stamp `031614-3429364`, 4 WIP migrations, new suite alone: 83 tests, 82 ok, 1 not ok (#81, a TEST bug: I named the
  capability event type `cms.capability.grant.revoked`; the outbox type is `cms.capability.grant.changed.v1`, so the lookup returned a null id). Every
  030/040/050 behaviour test was green on the first GREEN run. TAP SHA-256 `a214ab1eede1e6f9ea9dee8a8c4e5065eeff88722dc6b2d0931ae51ad089ee9c`.
- REGRESSION 1: 2026-10-22 03:20:09, stamp `031838-3445858`, 15 files (new suite + 14 existing governed/dec191), 835 tests: new suite 83/83 ok (#81 fixed);
  13 existing files all ok; 2 not ok (#111 governed_activation, #49 governed_decision) = genuine consequence of G6 on two more grant-revoke call sites
  I had missed (my first grep filtered `governed_activation` wholesale), fixed as Test corrections 2. TAP SHA-256 `df075d7099a84360a5dc98a19513b99dc65a045b33881467bc479cfab3d578f7`.
- REGRESSION 2: 2026-10-22 03:47:04, stamp `034610-3579209`, `governed_activation` (124) + `governed_decision` (58): 182 tests, All tests successful.
  TAP SHA-256 `c9ef55639b5b750f496c6b9a93b1e1965eafad8e75a05b8a11651af8ca291038`.
- INVENTORY: 2026-10-22 03:50:11, stamp `034957-3602136`, `phase_02_slice_09_r8_api_surface.sql` (root-owned canonical inventory): 14 tests, 4 not ok
  (#4, #13, #14: `cms_recheck_governed_reviews` and `cms_governed_recheck_resolve_event` are not in its classified lists; #5 lists
  `cms_get_locale_variant, cms_get_related_content, cms_list_composition_instances` as stale names = other lanes' unpromoted WIP, not mine).
  TAP SHA-256 `83b7cc530bf6d6a6a29711de1c94a6ec42752cf9e361da3f245d16b5980cacf1`. Not edited (root file).
- Worker: RED `vitest run apps/worker/src/cms-composition/governed-recheck` failed (modules absent). GREEN: governed-recheck + `cms-editorial` + Slice 11
  entrypoint wiring + DEC-156 boundary guards = 116 files, 1,991 tests passed; `tsc --noEmit` in `apps/worker` exit 0. A full `apps/worker` run before the
  resolver redesign: 691 files passed, 2 failed (the DEC-156 boundary guards only; fixed, Design decision 7).

## Test corrections

1. `apps/worker/src/production-async-entrypoint-review-recheck.test.ts` (Slice 11, P2-S11-AC-113), first test. A `cms.schema.activated.v1` message is now
   also consumed by the governed producer, which rereads the event through its own resolver `cms_governed_recheck_resolve_event` (before the editorial
   consumer does) and enqueues its own job. Diff: the fetch mock answers the new operation; expected `operations` become governed-resolve,
   editorial-resolve, governed-resolve, editorial-resolve, run; `expect(send).toHaveBeenCalledTimes(2)` becomes `4`; a comment cites P2-S12-AC-202.
   No assertion weakened.
2. Five SQL suites (untracked directories, so no git baseline; exact before/after stated) proved the activation/decision/fire-time recount ("a stored
   approved state lags the loss of a counted approver") by revoking the approver's grant through the real CMS-03A-17 command. Spec BE03c 1465 (G6) now
   makes that same revocation invalidate the review in its own transaction, so that lag no longer exists for a grant loss. In each, the single control
   `select is(pg_temp.s09d_revoke_via_rpc('<actor>', '<capability>'), 'OK', '<text>')` is replaced by the labelled fixture
   `update identity_private.membership_tenure set state = 'ended', revoked_at = clock_timestamp(), updated_at = clock_timestamp() where organization_id =
   ownerOrg and person_id = <actor> and state = 'confirmed'` (a loss no trigger covers) plus one control `ok(...)` that the loss took effect. Every
   downstream assertion is unchanged.
   - `phase_02_slice_12_governed_activation/060-invalidation.sqlinc` (rev2, review gr7; control: snapshot unchanged and live recount 0)
   - `phase_02_slice_12_governed_activation/095-retire.sqlinc` (designer2 `cms.reviewer.policy`, review gq2; control: `cms_person_holds_capability` false
     and gq2 still approved; found by regression 1, test 111)
   - `phase_02_slice_12_governed_decision/050-invalidation-gates.sqlinc` (rev1, review r7; control: `cms_person_holds_capability` false). After the r7
     section the tenure of rev1 is re-confirmed (`state = 'confirmed', revoked_at = null`) and the ORIGINAL real CMS-03A-17 revoke control is kept before the
     R8 "assignee without the standing grant" test (regression 1, test 49: with the tenure ended rev1 is concealed 404 instead of 403 `capability_missing`);
     plan 57 -> 58 in `phase_02_slice_12_governed_decision.sql` for the added control; two comments reworded
   - `phase_02_slice_12_governed_schedule/055-fire-approval.sqlinc` (rev2, review eb; control: live recount 0 and schedule still pending); header comment updated
   - `phase_02_slice_12_dec191/040-detail.sqlinc` (rev2, review db, blocked `approval_invalidated`; control: live recount 0) and one-word comment in `010-setup.sqlinc`
   Coverage of the real-revocation behaviour itself moved to this lane's `phase_02_slice_12_governed_recheck` 030.

## Spec citations

BE03c `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`: 1439-1455 (Governed review machinery, subject state machine), 1463 (Invalidation:
closed reasons, producers, 500/run cursor, no event), 1465 (G6 `cms_invalidate_governed_reviews_for_person`), 1467 (Job transport, DEC-166 typed queue
message), 1482 (lock order row: subject FOR UPDATE before review FOR UPDATE; person invalidation inside the revoking transaction; invalidated reviews
skipped), 1599 (internal RPC names `cms_recheck_governed_reviews(kind, ref_id, batch)` and `cms_invalidate_governed_reviews_for_person`, job handler
`cms.governed_review.recheck`), 1751 (metric `cms_governed_review_invalidated_total{reason}`). BE03b Review invalidation (mirrored by
`20261005017580_cms_review_invalidation.sql`). Slice 11 precedent `20261010164100_cms_dependency_recheck.sql` and
`apps/worker/src/cms-editorial/review-recheck/`. DEC-166, DEC-156 (import-graph guard), DEC-180 G6/G9.

## Open items / BOUNDARY

- AC-202 says the capability-grant revocation transaction "enqueues" the job; the job selects by `(kind, ref_id)` of block/pattern/content_type/
  canonical_domain, which a person/capability revocation cannot express. The revocation is therefore handled synchronously in its own transaction
  (AC-204) and no queue message is produced from it. Flagged for root (Request 6).
- No spec BOUNDARY stubs were needed; nothing was invented beyond the decisions listed above.

## Requests to root

1. Promote `supabase/migrations-wip/governed-recheck/` (4 files, 20261022030000..030300) after review; then remove the directory.
2. `supabase/tests/phase_02_slice_09_r8_api_surface.sql` (root-owned inventory): add `cms_recheck_governed_reviews` and `cms_governed_recheck_resolve_event`
   to the classified lists (service-role platform_api RPCs; the 74-member supporting list becomes 76). Regenerate
   `packages/data-access/src/database.types.ts` (`db:types`).
3. Review and promote the five corrected existing SQL suites (Test corrections 2) and the Slice 11 wiring test (Test corrections 1).
4. Run the race module `phase_02_slice_12_governed_authority.race.mjs` (and any revoke-vs-activation module): the revocation now invalidates in its
   own transaction (BE03c 1482 rule 3), which the module's expectations may need to reflect. I authored no race module (the spec names none for the recheck).
5. Decide whether the typed message schemas (`contract.ts`) should move to `packages/contracts` like Slice 11's (they are Worker-local because contracts
   were not in this lane's claim). Optionally a postgrest apispec for the two new RPCs (cf. `tests/postgrest/phase-02-slice-11-recheck.apispec.ts`).
6. Confirm or amend the AC-202 wording: a revocation enqueues no message (synchronous AC-204 invalidation instead).
7. Ledger: AC-202/203/204 evidence = this report + the TAPs above; refutation audit before any tick.
