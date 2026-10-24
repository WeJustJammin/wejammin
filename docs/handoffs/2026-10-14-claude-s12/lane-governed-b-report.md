# Lane governed-b report (claude_s12_governed_b_sql)

Lane `claude_s12_governed_b_sql` (staged-runner lane `governed-b`), Sonnet 5.5. Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`,
branch `claude/phase2-slice12`, HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e`. Timestamp range 20261014070000-070999 (used 070000-070610).

## Status

**GREEN** (2026-10-14). CMS-03C-09 `activate` and `schedule` and CMS-03C-19 claim and execute are built contract-first and test-first.
Final-bytes runs: activation 81/81 and schedule 51/51 (and the pattern-definition suite, 341 assertions, which drives real pattern
activation through the new producer) all pass in one run (473/473); the retry-ladder suite passes 21/21 in its own run; a seven-mutant
run kills every mutant. `retire` is HELD (open owner decision). No applied migration, shared helper, existing oracle or other lane file was
touched; no trigger was disabled and no clock forged.

## Scope

- CMS-03C-09 POST /api/v1/cms/governed-reviews/{reviewId}/activation: `activate` (200) and `schedule` (202) for template, pattern and taxonomy subjects.
- CMS-03C-19: `platform_private.cms_claim_due_governed_activations` and `cms_execute_governed_activation` (+ `platform_api` wrappers).
- HELD: `retire` (propagation scan `.memory/wiki/specs/audits/propagation-scan-governed-lifecycle-2026-10-13.md` section R).
- OUT: the Worker `scheduled` sweep and transport, G6 `cms_invalidate_governed_reviews_for_person`, `cms_recheck_governed_reviews`.

## Design decisions (implementation tier, mine)

1. Names fixed by existing RED suites: `platform_api.cms_activate_governed_subject(jsonb)` (BE03c 1447; request shape of `phase_02_slice_12_pattern_definition/050-nested.sqlinc`).
   CMS-03C-19 takes jsonb request objects (`{batch}`, `{scheduleId, expectedVersion, leaseId}`) exactly like CMS-03B-20 and the frozen `governed-activation-job.ts` request schemas, not positional arguments.
2. Execute `expectedVersion` = the approved REVIEW version the schedule relied on (contract test `governed-activation-job.test.ts`: the claimed `expectedVersion` is the request member); the `executing` state, the unexpired lease and the schedule CAS are the fence. `scheduleVersion` is informational.
3. `retire` is refused `VALIDATION_FAILED` `["/action"]` in the structure step, before step-up: no state change, no reservation, no event.
4. Order inside CMS-03C-09: structure, step-up, concealment, owner capability, position 1 lock + capability re-proof, reservation, subject (+ lineage active row) + graph, review, CAS, `approved`, live schedule (`schedule_exists`), subject `approved|blocked` (`subject_not_activatable`), time rules + grant day (schedule), recheck, switch or schedule. A non-`approved` review is `subject_not_activatable` (the catalog has no other 409 token for it).
5. Recheck verdicts: `canonical_source_unavailable` (taxonomy, 422 with `details.domain`, nothing commits), `dependency_changed` (commits the invalidation, committed refusal envelope `{kind:'refusal',reasonCode:'dependency_changed',details:{}}`, status 409), `approval_invalidated` = the live qualifying approvals fell short (commits `reviewer_authority_changed`, envelope `review_not_open`, as governed-a's decision does).
6. Execute failure classes: retryable = NULL workflow-policy evidence (`DEPENDENCY_UNAVAILABLE`) and an `activation_conflict` on the lineage (15/60/300 s, the fourth failure blocks `retries_exhausted`); terminal = `approval_invalidated`, `activation_authority_ended`, `dependency_changed`, `canonical_source_unavailable` (schedule blocked AND subject scheduled -> blocked; the review is untouched so a new CMS-03C-09 command can re-activate it or its recheck invalidates it).
7. The claim never waits on position 3 while it holds a position 6 schedule row: an expired lease that would exhaust (`retries_exhausted` blocks the subject) is recovered only if the subject row can be taken `FOR UPDATE SKIP LOCKED`; otherwise it is left for the next claim. (BE03c says the claim takes "schedule rows only"; this is the deadlock-free way to keep a `scheduled` subject from being stranded.)
8. Sub-microsecond digits of `localDateTime`/`resolvedUtc` are accepted and floored to the microsecond of the schedule columns (the table has no remainder column); `scheduledForUtc`, `activatedAt` and `actualUtc` are millisecond ISO strings (`auth_iso_time`).
9. The governed-a helper `cms_governed_move_subject` cannot stamp `activated_at` or reach `superseded`, so activation, supersession and a cancelling/invalidating helper are new (`cms_governed_activate_subject`, `cms_governed_supersede_lineage`, `cms_governed_invalidate_approved_review`).

## Files

### Migrations (WIP, 20261014070000-070610; function-only, no DDL on tables, no grant widened: idempotent restatements held by the definer)

| `supabase/migrations-wip/governed-b/20261014070000_cms_governed_activation_helpers.sql` | 228 | `ab9d776c35885d09b10b2fe16e2724005d0971c14bb513c3193d9586e6d7b890` |
| `supabase/migrations-wip/governed-b/20261014070100_cms_governed_schedule_state.sql` | 158 | `c208d55047ef13518fd478f935f3f319841bcd566016c2f1507cf28773040d6c` |
| `supabase/migrations-wip/governed-b/20261014070200_cms_governed_activation_core.sql` | 164 | `620792e1dd6b71aa22dc4de0fecd342cfe6944bbcd9ad015cee3ca254f18c0f8` |
| `supabase/migrations-wip/governed-b/20261014070300_cms_governed_activation_request.sql` | 138 | `8c23ac8206b3b48617de858eaa47fc92d0347173725e9793edb756cae318cf58` |
| `supabase/migrations-wip/governed-b/20261014070400_cms_activate_governed_subject.sql` | 212 | `5c86c7df57028260cecab73a7dc3c375fa475ec9aa639e7296d92b1149d7fefe` |
| `supabase/migrations-wip/governed-b/20261014070410_cms_activate_governed_subject_public.sql` | 38 | `5450832c11149bcd1ca5771e1f63849fe5959ccfbe47b374ae4d232daf864e20` |
| `supabase/migrations-wip/governed-b/20261014070500_cms_claim_due_governed_activations.sql` | 110 | `cded63389ad32f2bcde19f9d95adc20533656d02119244e607a26ba83b7e5ac6` |
| `supabase/migrations-wip/governed-b/20261014070510_cms_claim_due_governed_activations_public.sql` | 38 | `65489d15e7f462c20db15166554d204ee4587af4f09b31ecb409023c0550cc70` |
| `supabase/migrations-wip/governed-b/20261014070600_cms_execute_governed_activation.sql` | 228 | `a3cfc4d38e694de10154b3b4a658c383ab20e72a2e4da92041a73be06aa223f0` |
| `supabase/migrations-wip/governed-b/20261014070610_cms_execute_governed_activation_public.sql` | 38 | `a849bb542e64e69cddfd6ec0988ea6b538e30eb5012d26e774a8a23507cb35a7` |

### pgTAP suites and fixtures (all new; shared helpers only `\ir`-included read-only)

| `supabase/tests/phase_02_slice_12_governed_activation.sql` | 39 | `3931107239e0da553bf72a328f977d5a02f7014d5a7f9bc237bf31501db8dcec` |
| `supabase/tests/phase_02_slice_12_governed_schedule.sql` | 38 | `c54b00dadba05f67b28f94a7612845cebed45ea5e8e02824952709390588688d` |
| `supabase/tests/phase_02_slice_12_governed_schedule_ladder.sql` | 26 | `8993d43fe55a06b9c6e1ee48ad11effaef922c15b6e5789e7cbb899606eaa6c0` |
| `supabase/tests/phase_02_slice_12_governed_activation/000-world.sqlinc` | 267 | `772da3ea47d46968c04d16980bed972b622a2d4882d8309a37752fc06fe86a9b` |
| `supabase/tests/phase_02_slice_12_governed_activation/010-setup.sqlinc` | 65 | `504304e9496b9b5e9603d13c895368a63627dd8fcc3f655134a93eba57dfa9a5` |
| `supabase/tests/phase_02_slice_12_governed_activation/020-gates.sqlinc` | 123 | `2461e8a652ba3f17928992036a46eb9a1da52df5d812cd376cba14c4a72b5d7f` |
| `supabase/tests/phase_02_slice_12_governed_activation/030-activate.sqlinc` | 76 | `0c71444759b11be8fb67d28f607eeb1410122a9dcee586916a69499866f025d7` |
| `supabase/tests/phase_02_slice_12_governed_activation/040-supersession.sqlinc` | 66 | `68bbba32ca90c713e61cc32849694d04a69c609c278623d812af1b289131c602` |
| `supabase/tests/phase_02_slice_12_governed_activation/050-schedule-accept.sqlinc` | 102 | `a59a117830103d8d3f51cd1cd0d0ac1ab6d680685b3ec7c7a073aa39d3122c1f` |
| `supabase/tests/phase_02_slice_12_governed_activation/060-invalidation.sqlinc` | 117 | `af86e99e5f134719d50719b4af259c56493fab8c807f881da7fd487f5edaa750` |
| `supabase/tests/phase_02_slice_12_governed_activation/070-privileges.sqlinc` | 42 | `9dd9e3162efa845b6e5948398504395beb1dd71a94811bd4b3d824a30d184c27` |
| `supabase/tests/phase_02_slice_12_governed_activation/080-taxonomy.sqlinc` | 50 | `51cc918450821a9d6760d4fe15130c7251bcc56ad6f3e9d70564e38941bc6fc0` |
| `supabase/tests/phase_02_slice_12_governed_activation/README.md` | 21 | `5f247e9518190d941b953283c52d75b93d1e96a7b563dfd92775b93fa64c6377` |
| `supabase/tests/phase_02_slice_12_governed_schedule/010-setup.sqlinc` | 61 | `2c8dd6d746ae55cdf6d51487a43dcba2e898bfe96bc1fc9de8bad2c31cdb4f5b` |
| `supabase/tests/phase_02_slice_12_governed_schedule/020-claim.sqlinc` | 72 | `626bef5520fec0af48b336d94faed4dc4aa1e2480c744f8e5e7759b981b9113a` |
| `supabase/tests/phase_02_slice_12_governed_schedule/030-execute.sqlinc` | 128 | `11ca4acc5ba8faca73f664d97a43d6faa86a4d6ee1a3d194871d73cd6e654fd0` |
| `supabase/tests/phase_02_slice_12_governed_schedule/040-retry.sqlinc` | 45 | `dfa5b6969b80a599eb608754f9177b6cb5377b86b2c07fc2bcaefa7da6fee2d1` |
| `supabase/tests/phase_02_slice_12_governed_schedule/050-blocked.sqlinc` | 38 | `a56bde84ac8b8f26e468534fa6f7cd5dac3874e66bfedd31977a10d33381f433` |
| `supabase/tests/phase_02_slice_12_governed_schedule/060-privileges.sqlinc` | 39 | `b636ac2a9f29166e3b9fe995fd9518ddb5cd7fcd91962d71f63e93a7a4d4899a` |
| `supabase/tests/phase_02_slice_12_governed_schedule/README.md` | 16 | `707e8d42264483f3271b39ee2860e16d0548e635b43888cc6dba7ac005840fba` |
| `supabase/tests/phase_02_slice_12_governed_schedule_ladder/010-ladder.sqlinc` | 101 | `81951ab8ca2c428219b8983b84b7294ad5b9ffc4f57e5f70bb381ef178d70c16` |
| `supabase/tests/phase_02_slice_12_governed_schedule_ladder/README.md` | 6 | `7773ef85befd77495b636e47eca78147bcd4db00ded1e0872e04a2ed26b50c23` |

Largest migration 228 lines, largest test file 267 lines. Table header: path | lines | SHA-256.

## Runs

All through `docs/handoffs/2026-10-14-claude-s12/lanes/lane-db-alt-staged.sh ... <lane> <suites>` (one invocation = one run). TAPs in `.lane-logs/`.

| # | time (local) | stamp | stage | files / plan | result | first failing test | TAP SHA-256 |
|---|---|---|---|---|---|---|---|
| 1 | 07:05:41 | governed-fix+governed-b-070534-3260285 | wip 0 (governed-fix already promoted; 389 promoted) | activation 77 (ran 53), schedule 51 (ran 26) | RED: 52 genuine missing feature (the four platform_api functions absent); both files then aborted on HARNESS defects (empty `pg_exception_detail` cast to jsonb), fixed with `nullif` | activation 14 (has_function cms_activate_governed_subject) | `60d868bf027c1df1f60b5f332c2a8b2f0ba9b3abdd29187948e1c5c1a63770c5` |
| 2 | 07:14:11 | governed-fix+governed-b-071411-3307460 | wip 10 | activation 77, schedule 51 | 126/128; schedule 51/51; activation 18 and 28 failed, both HARNESS (test expectations): 18 sorted `st-noat` after `st-nokey` in my expected string (C collation puts `st-noat` first); 28 compared a microsecond `decided_at` with the millisecond ISO string. No product defect | activation 18 | `c63f4ab5109ad5c84f3a01c9f4fd727f5a918107ec39a59080036f0ca1f10533` |
| 3 | 07:17:32 | pattern-def+governed-b-071732-3324269 | wip 16 (10 mine + 6 pattern-def), FINAL BYTES | activation 81, schedule 51, pattern_definition (no_plan, 341) | **473/473 PASS** | none | `e0126f33377fe83df8a7923ed6b659b9e5a34fc441228cfc23b2e3e7d64de875` |
| 4 | 07:19:57 | governed-b-071957-3335260 | wip 10, FINAL BYTES | ladder 21 | **21/21 PASS** (461 s of real waiting) | none | `6568f3eef885254432e4261f3a1089b2e1b7aa94f4e8fd1550bae6504009e936` |
| 5 | 07:28:37 | governed-b-mut-072837-3371935 | seven mutants in a scratch lane dir `governed-b-mut` (removed afterwards; `governed-b` untouched) | activation 81, schedule 51 | 26 not ok, every mutant killed | activation 16 | `bec8d6d52dd9180efac7cc4a31ce7eefb239a9f7d70f65299c2e9ea2b95706ac` |

Final-bytes confirmation: runs 3 and 4 used the files listed above unchanged (no edit after run 3; the mutant lane copied, never edited, the real files).

Failure classification. Run 1: genuine missing feature (plus the harness abort). Run 2: harness only. Nothing else failed.

Mutants (run 5, applied to copies only): M1 supersession dropped (activation 39-42, schedule 30-32), M2 step-up skipped (activation 16, 17), M6 concealment scope dropped
(activation 21, 24, 60), M7 creator authority recheck at fire time dropped (schedule 36, 37), M9 horizon floor of 60 s dropped (activation 53-55), M11 live approvals recount dropped
(activation 63, 64), M12 scheduled subject not blocked on a terminal block (schedule 36, 37, 45, 46). Several failures are cascades of the same mutant; each mutant has at least one assertion written to catch it.

Contract conformance (offline, throwaway `node --experimental-strip-types` script reading the `EVIDENCE` rows of run 3): the exact bodies the suites produce parse
against the frozen `GovernedActivationResourceSchema`, `ClaimedGovernedActivationSchema` and `GovernedActivationExecutionResultSchema` (13 of 13; the `dependency_changed` refusal envelope is the governed-a envelope).

## What the suites prove (non-vacuously)

Activation (81): step-up before concealment for activate and schedule (missing, stale 11 min, future +2 min), no reservation on any refusal; strict shape (unknown keys, mismatched
members, bad ids, If-Match disagreement); the HELD retire (before and after activation); the five-member `activateAt` with every pointer; concealment 404 vs capability 403; CAS
`VERSION_MISMATCH {expectedVersion, currentVersion}`; an open review is `subject_not_activatable`; the exact 11-member resource; subject approved -> active at lifecycle +1 with the definition
version untouched; review `activated_at` + version +1; exactly one `cms.template.activated.v1` (aggregate = the subject row at its lifecycle counter, payload `{templateId, templateVersionId}`) and one audit
record; replay and `IDEMPOTENCY_MISMATCH`; supersession (previous version superseded, lifecycle +1, one active per lineage, no extra event); a protected two-approval review; schedule acceptance (202, pending row, subject scheduled,
no event, one audit), replay, `schedule_exists`, the 03b time tokens and `authority_ends_before_schedule`, nanosecond flooring; a non-owner designer activating via the capability scope, a revoked capability (403), a dead approval
(committed refusal, `reviewer_authority_changed`), schedule cancellation by invalidation, a changed dependency (committed `dependency_changed` for activate AND schedule, DEC-108 successor), a taxonomy subject end to end
(`cms.taxonomy.changed.v1`), privileges. Pattern subjects: the pattern-definition suite (run 3) activates real pattern versions through the new producer (nested pattern fixtures, lifecycle 4, definition pin 1).
Schedule (51): claim structure, nothing due, ordered batches under a five-minute lease, the cancelled schedule never claimed; execute fence (lease, version, absent, pending), a completed activation with supersession and a
signed late deviation, `already_completed`, the creator's authority ending (blocked, subject blocked, re-activation `blocked -> active`), a negative-fault retry (15 s, new lease, completion), `dependency_changed` block and `blocked -> draft`.
Ladder (21): failure 1/2/3 -> 15/60/300 s, the fourth -> `retries_exhausted` (subject blocked, no event), expired-lease execute refused CONFLICT, expired lease spends one retry at the next claim, recovered schedule completes.

## Test corrections

None. No existing test, oracle or shared helper changed.

## Spec citations

BE03c = `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`.

| Behavior | Source |
|---|---|
| Route row, If-Match = review `version`, unconditional recent MFA before any reservation, events only on committed immediate activation/execution | BE03c 171, 216, 1324, 1546-1562; AC-082, 086 |
| Ordered steps, recheck commits invalidation, `activate` requires approved or blocked subject, supersession in one transaction, `schedule` 202 / no event / `schedule_exists` | BE03c 1324 (steps 1-6), 392, 1304 |
| Time authority (pinned tzdb, -12..+14 h, 60 s..366 d) and grant day | BE03c 392, 1324; BE03b CMS-03B-07 (`20261005017710`) |
| Lifecycle counter +1 per transition, outbox identity (aggregate = switched subject row, lifecycle counter) | BE03c 208, 1548 (DEC-180 G3, DEC-188) |
| Lock order | BE03c 1336-1357 (CMS-03C-09 row, rule 3) |
| CMS-03C-19 claim/lease/ladder/idempotency, terminal reason codes, `already_completed`, late deviation | BE03c 188, 1328; BE03b `20261005017730/740`; contracts `governed-activation-job.ts` |
| Review invalidation cancels the schedule and returns the subject to draft | BE03c 1328, 1334 |
| Typed refusals and committed envelopes | BE03c 1304 (R5); governed-a decision |

## Open items / BOUNDARY

1. **OWNER DECISION OPEN (not a spec BOUNDARY): `retire`.** Held per propagation scan section R. When the owner confirms, add the action to `cms_governed_activation_request` and a retirement branch (state `active` -> `retired`, `retired_at`, lifecycle +1, same event type, no review needed, `subject_not_retirable`); the lifecycle seam, `outbox` identity and audit pattern are in place.
2. **Race behavior is unproven** (race modules forbidden): the lineage advisory lock + `activation_conflict` on a lost race, the unique-race `schedule_exists`, claim `SKIP LOCKED` disjointness, the SKIP LOCKED subject take, the deadlock -> `CONFLICT` wrapper mapping. The lock order is implemented by construction (documented in each header).
3. `canonical_source_unavailable` at activation/execute is implemented (422 with `details.domain`; terminal block at fire) but not reachable in a sequential suite: submit already refuses an unbuilt domain and the registry changes only by forward migration. The taxonomy path is exercised with the built `role` domain.
4. The `permittedNextActions` hint (governed-a) already offers `activate`/`schedule` for `approved|blocked` and `retire` for `active`; `retire` is not accepted yet.
5. G6 `cms_invalidate_governed_reviews_for_person` and `cms_recheck_governed_reviews` do not exist; both should call `cms_governed_invalidate_approved_review` (open or approved, cancels schedules, audit) in the revoking transaction / job.
6. Sub-microsecond flooring and millisecond response instants (decisions 8) - flag if the Worker Time authority compares nanoseconds.
7. The suites take real time: activation ~35 s, schedule ~90 s, ladder ~460 s. Run the ladder separately.

## Requests to root

1. Independent review of the ten WIP migrations; promote in timestamp order. They are function-only (no populated-DB witness needed). They depend on promoted governed-a, taxonomy-def and governed-fix; `pattern-def` is needed only for pattern subjects.
2. After promotion: canonical `db:verify`, `db:types` refresh (three new `platform_api` functions), and a pass over inventory pins (API surface, definer/RLS allowlists) for `cms_activate_governed_subject`, `cms_claim_due_governed_activations`, `cms_execute_governed_activation` and the private helpers.
3. Owner decision on `retire` (item 1), then a small follow-up lane.
4. Hand the `## RPC boundary` section to the Worker lane (routes CMS-03C-09 and the `scheduled` sweep).
5. Tell the G6 / recheck owner about `cms_governed_invalidate_approved_review` (open item 5).
6. Memory capture candidates (root decides): harness lesson "an empty `pg_exception_detail` breaks `::jsonb` casts: nullif first"; the 8-minute ladder suite must be run separately from the routine run.

## RPC boundary (for the Worker lane)

All are `returns jsonb`, callable by `service_role` only through `platform_api.*`; `context` is the verified Worker envelope used by CMS-03C-07/08 (`{ authUserId, actorPersonId, actingPartyId, sessionId?, requestId?, correlationId?, stepUpVerified, stepUpAt }`). A replay of a completed idempotency record sets GUC `response.headers` to `[{"x-cms-idempotent-replay": "true"}]`.

1. **`platform_api.cms_activate_governed_subject`** (CMS-03C-09). `activate`: `{ reviewId, action:'activate', expectedVersion, ifMatch, idempotencyKey, context }`; `schedule`: the same plus
   `activateAt: { localDateTime, timezone, resolvedUtc, tzdbVersion, disambiguation }` (the Worker has already verified the tz rules; the RPC rechecks the pinned `tzdbVersion`, the local/UTC offset window and the 60 s..366 d horizon).
   `expectedVersion` and `ifMatch` are equal decimal strings. Returns `GovernedActivationResource` (200 for activate, 202 for schedule) **or** a committed refusal envelope
   `{ "kind":"refusal", "reasonCode":"dependency_changed" | "review_not_open", "details":{} }` (stored with status 409; the state change - invalidation - is committed). The Worker answers the envelope as 409
   `GOVERNED_REVIEW_VERSION_CONFLICT` with `details.reasonCode` = `reasonCode` (`review_not_open` here means a recorded approval no longer counts and the review was invalidated `reviewer_authority_changed`).
   `retire` is HELD: `VALIDATION_FAILED` `["/action"]`.
   Refusals (`P0001`, whole message = token): `INVALID_REQUEST`; `VALIDATION_FAILED` DETAIL `["/action"]`, `["/expectedVersion"]`, `["/ifMatch"]`, `["/activateAt"]`, `["/activateAt/<member>", ...]`; `STEP_UP_REQUIRED` (401, no reservation); `NOT_FOUND` (404);
   `capability_missing` (403); `VERSION_MISMATCH` DETAIL `{"expectedVersion","currentVersion"}`, `subject_not_activatable`, `schedule_exists`, `IDEMPOTENCY_MISMATCH` (409); `tzdb_version_mismatch` DETAIL `{"pinnedVersion"}`,
   `resolved_utc_mismatch`, `schedule_out_of_horizon` DETAIL `{"minUtc","maxUtc"}`, `authority_ends_before_schedule`, `canonical_source_unavailable` DETAIL `{"domain"}` (422); `activation_conflict` (409, lost race: `activate` takes the lineage advisory lock, re-reads the lineage's active version under it and refuses when it changed); `DEPENDENCY_UNAVAILABLE` (503, NULL policy evidence).
   Events: `cms.template.activated.v1` / `cms.pattern.activated.v1` / `cms.taxonomy.changed.v1` exactly once on a committed `activate`, none on `schedule`. Audit `cms.governed.activate` / `cms.governed.schedule` (target = the subject version).
2. **`platform_api.cms_claim_due_governed_activations`** (CMS-03C-19). `{ batch: 1..100 }` (JSON number) -> `ClaimedGovernedActivation[]` `{ scheduleId, reviewId, subjectKind, subjectId, scheduleVersion, expectedVersion, leaseId, correlationId }`.
   Five-minute lease; expired leases are recovered first (a lease that exhausts the ladder at the claim also blocks the scheduled subject, see `## Fix pass` Decisions). `INVALID_REQUEST` for any other shape.
3. **`platform_api.cms_execute_governed_activation`** (CMS-03C-19). `{ scheduleId, expectedVersion (the claimed expectedVersion), leaseId }` -> `GovernedActivationExecutionResult`
   `{ scheduleId, outcome: completed|blocked|failed_retryable|already_completed, reasonCode, actualUtc, deviationSeconds }`. Refusals: `INVALID_REQUEST`, `NOT_FOUND`, `CONFLICT` (not executing / lease id not the claim's), `VERSION_MISMATCH`.
   **`expectedVersion` is the IMMUTABLE REVIEW version the schedule relied on (the claim's `expectedVersion`, constant for the life of the schedule), NOT CMS-03B-20's `scheduleVersion`** (which advances on every claim). The Worker sweep must pass `claim.expectedVersion` here; copying the 03b sweep (`expectedVersion: claim.scheduleVersion`) would answer `VERSION_MISMATCH` on every execution. The fence is the `executing` state plus the claim's lease id re-proved under the schedule row lock; as in 03b an expired-but-unrecovered lease still matches (the claim's recovery skips a row an executor holds), so the Worker need not race the lease instant.
   No evidence member (unlike CMS-03B-20). The Worker job type is `cms.governed_activation.execute`.

## Fix pass

Status of this pass (2026-10-14, HEAD `b16edb54`): **GREEN for governed-b.** Review `review-governed-b.md` (PARTIAL) addressed: major 1 fixed, major 2 tested (decision recorded for root),
minor 3 fixed, minor 4 documented, minors 5, 6, 7, 9 declined with reasons, minor 8 closed except two sequentially unreachable paths. Migrations edited in place (unpromoted):
`070400`, `070500` (comment only), `070600`. No applied migration, shared helper, other lane's file or existing oracle changed; no trigger disabled, no clock forged.

### Findings and disposition

| Finding | Disposition |
| --- | --- |
| 1 major: no lineage advisory lock on `activate` | FIXED. `070400` step 9: for `activate`, after every refusal/recheck and immediately before `cms_governed_apply_activation`, `pg_advisory_xact_lock(hashtextextended('cms.governed.lineage:'||kind||':'||lineageId, 0))` (the CMS-03C-19 key of `070600`), then the lineage's active row is re-read (`cms_governed_lock_lineage_active`) and a result different from the step-5 read is `activation_conflict` (409, nothing commits). Step-5 read is now kept in `v_active`. The lock is the last position of the BE03c CMS-03C-09 lock-order row; `schedule` takes none (it switches nothing). The lost-race refusal itself still needs two sessions (unprovable in pgTAP, as before). |
| 2 major: claim writes subject transition outside the lock-order row; untested | RATIFIED by root (see Decisions). Header of `070500` now says so. TESTED: ladder schedule `l3` (see Runs): the claim that finds a fourth attempt's lease expired blocks the schedule `retries_exhausted` and the scheduled subject `blocked` (lifecycle 5), no event, one audit; the late executor is `CONFLICT`. Mutant kill (claim without the subject block) proves the assertion is not vacuous. |
| 3 minor: executor refused an expired-but-unrecovered lease | FIXED to mirror 03b. `070600` dropped both `lease_until` clauses (unlocked look and under the row lock). The row lock is the fence: the claim's recovery is `SKIP LOCKED`, so it cannot touch a row an executor holds, and an executor that loses to the claim sees `state <> executing` or a different lease id and gets `CONFLICT`. RED first: ladder `l4` (expired, unrecovered, executor presents the claim's lease) is the old behaviour's `CONFLICT`; the lease mutant fails exactly that assertion. |
| 4 minor: execute `expectedVersion` is the immutable review version | DOCUMENTED in `## RPC boundary` item 3 (bold paragraph). |
| 5 minor: review `version` unchanged on 202 / terminal block, so conditional GET staleness | DECLINED, spec-owner decision: BE03c 216 advances the version only on a decision, an invalidation and an activation, and `expected_version` is stored at acceptance and compared by the executor; changing it needs the owner to resolve the L1 guard comment vs BE03c 216 disagreement. Open item for root. |
| 6 minor: time rules before the recheck | DECLINED, reason: harmless (an out-of-horizon and dependency-stale request answers 422 and the next well-formed request commits the invalidation); reordering would re-key every schedule test for no behavioural gain. |
| 7 minor: sub-microsecond digits floored | UNCHANGED, as the review concluded (contract admits 1-9 digits; column is microsecond). Already flagged for the Worker Time authority. |
| 8 minor: untested paths | CLOSED: fire-time `approval_invalidated` (schedule suite `055`, plus the committed `review_not_open` invalidation of the blocked subject, blocked -> draft); `blocked -> scheduled` after `retries_exhausted` (ladder, review still approved, new pending row beside the blocked evidence row, lifecycle 6, no event); claim-side exhaustion (above). STILL UNREACHABLE sequentially: `canonical_source_unavailable` (submit refuses an unbuilt domain; registry moves forward only), `activation_conflict` and the `SKIP LOCKED` contention (need two sessions). The advisory lock itself is now proven from `pg_locks` (activation `090`). |
| 9 minor: composite `is(string_agg())` oracles | DECLINED: governed-a precedent; a failure prints the whole expected/actual string so the clause stays identifiable. New assertions follow the same style. |

### Decisions (for root to record)

1. **Claim takes the subject row `FOR UPDATE SKIP LOCKED` when a lease exhausts the ladder** (root ratified as an implementation decision). Deviates from the BE03c Slice 12 lock-order row "the claim RPC of CMS-03C-19 | schedule rows only (`FOR UPDATE SKIP LOCKED`), committed before execution starts" (BE03c ~1356). Deadlock-free: every lock the claim adds is `SKIP LOCKED` and it never waits on position 3 while holding position 6; an unavailable subject leaves the schedule for the next claim; the executor (3 -> 5 -> 6) blocks on the claim's schedule row and then sees a changed state or lease (`CONFLICT`), so no double execution. Closes the stranding gap: without it a lease that exhausts the ladder at the claim would leave the subject `scheduled` with no live schedule and CMS-03C-09 refusing both `activate` and `schedule`. Suggested spec clarification: "plus the subject version row `FOR UPDATE SKIP LOCKED` when an expired lease exhausts the retry ladder".
2. **Execute honours an expired-but-unrecovered lease under the schedule row lock**, as CMS-03B-20 does (`20261005017740:144-146,166-168`; BE03b 1896 "a lease that no longer matches is refused"): the fence is the lease id plus the row lock, not the lease instant. Spec-silent on the instant; chosen to mirror 03b ("mirrors CMS-03B-20 exactly", BE03c 188).
3. **Lineage advisory lock only on `activate`** (the switch); `schedule` accepts a pending row and switches nothing.

### Files changed in this pass (final bytes of every run below)

| path | lines | SHA-256 |
| --- | --- | --- |
| `supabase/migrations-wip/governed-b/20261014070400_cms_activate_governed_subject.sql` | 222 | `6c9a984e3ebe687f978a5788167ddf6e052f4f1eb6aea97f084d3df8b5157b0f` |
| `supabase/migrations-wip/governed-b/20261014070500_cms_claim_due_governed_activations.sql` | 112 | `1538d221b8285b8d42ca600ed4877e9da0b2e1e0f61c948fc3cd8e9dd841960a` |
| `supabase/migrations-wip/governed-b/20261014070600_cms_execute_governed_activation.sql` | 227 | `8adfc9a1fe64e68695cfcd1ca723593f462948c95c88c55ff60affe242fceaf1` |
| `supabase/tests/phase_02_slice_12_governed_activation.sql` (plan 83) | 40 | `e725f11486e183a0791ae57cf348c4084610d57ac419a5ea45a6387b5e67927d` |
| `supabase/tests/phase_02_slice_12_governed_activation/090-lineage-lock.sqlinc` (new) | 22 | `6795d8da459b7ac58dfc0a36ef3acad80deb77cae862557cebbbbd75a5b8f692` |
| `supabase/tests/phase_02_slice_12_governed_activation/README.md` | 22 | `12ac9404394b7ab62840b25df22b315457ec0a2528d22a8473c3eb29ed38c533` |
| `supabase/tests/phase_02_slice_12_governed_schedule.sql` (plan 54) | 39 | `8ff2219cb24c34a85627db59a1092da2e9fb29e9a830550e54c7ad3ea1f45710` |
| `supabase/tests/phase_02_slice_12_governed_schedule/055-fire-approval.sqlinc` (new) | 42 | `de79055a269a5415bbac44749324cbe8133554511c3602be3cf9c4561ad21378` |
| `supabase/tests/phase_02_slice_12_governed_schedule/README.md` | 17 | `2df5e11bee7fe33fc43381eda7af24883b0d57ba9471c945712795f8c920323e` |
| `supabase/tests/phase_02_slice_12_governed_schedule_ladder.sql` (plan 24) | 26 | `ea783762494447cbaa09869fc5807b821406ddf3b32d3e744feb76ee7f84f0bc` |
| `supabase/tests/phase_02_slice_12_governed_schedule_ladder/010-ladder.sqlinc` (rewritten, four schedules) | 177 | `133b49c37a5d7e500931ffe89c832b9f0c8b771e01bc7e2e1be5e99325a89b5b` |
| `supabase/tests/phase_02_slice_12_governed_schedule_ladder/README.md` | 9 | `e6668cae8c45d9d0cbfe8cb5b577025214877d4d81d0c98a4eb817c3ca0768f2` |

The other seven migrations (`070000`-`070300`, `070410`, `070510`, `070610`) and the three activation / schedule helper-and-fixture files not listed are unchanged from the table above.

### Runs (staged runner, one invocation each; TAPs in `.lane-logs/`)

| # | time | stamp | stage | files / plan | result | first failing / classification | TAP SHA-256 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F1 | 11:54 | governed-b-115424-207256 | wip 10 (OLD 070400/070600 bytes; fix not yet staged) | activation 83, schedule 54 | RED: 136 ok / 1 not ok | activation 78 (`a committed immediate activation holds the lineage advisory lock`): genuine missing feature (no advisory lock); control 77 ok. Schedule 54/54 ok (the new `055` fire-time `approval_invalidated`, blocked -> draft assertions pass: closed coverage gaps, not defects) | `d72701e5155b07b847d8579d6432b0647ee583e8eaffe5371950044a20092072` |
| F2 | 11:58 | governed-b-115831-230328 | wip 10, FINAL BYTES | activation 83, schedule 54, pattern_definition 343 | activation 83/83 PASS, schedule 54/54 PASS; pattern_definition 127 not ok (17-37, 39-55, ..., 337-338) | pattern_definition fails at test 17 (`first definition succeeds`, state P0001, a producer of another lane); see F3 | `9e3a9393cb793748651d2b925e4c6125346e2864927f738ad95f2a259604fccc` |
| F3 | 12:02 | none-120254-255162 | promoted migrations only, no governed-b | pattern_definition 343 | the SAME 127 not ok at the same test numbers | classification: NOT attributable to governed-b (identical with no governed-b migration staged); the promoted pattern-def set is not self-sufficient for this suite (likely needs the block-compat lane, which stages with governed-b per the brief; its WIP dir is empty now). Pattern activation through `cms_activate_governed_subject` could not be re-exercised in this pass for that reason | `148dc339b85ad2e4ea01d968e1c67a8458046bee852786297e3c5d99b9c179db` |
| F4 | 12:04 | governed-b-120423-264637 | wip 10, FINAL BYTES | ladder 24 (746 s of real waiting) | **24/24 PASS** | none | `4eb140b3a7a94849dcf8e001df7ec6d6938039269269673e8db3a5881a821d03` |
| F5 | 12:17 | governed-b-mut-121737-327662 | scratch lane `governed-b-mut` (removed afterwards; real lane untouched): mutant A = both `lease_until` clauses restored in `070600`; mutant B = the claim no longer blocks the subject when it exhausts a lease | ladder 24 | 22 ok / 2 not ok: both mutants killed | ladder 16 (mutant A: l4 executed with its unrecovered lease -> `CONFLICT`) and 22 (mutant B: l3 claim-side exhaustion leaves the subject `scheduled`); no other assertion fails | `f806c3c5f3b464e32aa88bad32d0033936e8a9bec4c6eb385f4e9bbe9262372e` |

Counts at final bytes: activation 83/83, schedule 54/54, ladder 24/24, all green; pattern_definition 216/343 on the current promoted baseline, identical with and without governed-b.
Mutant coverage of the new lock test: its RED (F1) is the proof (no lock -> test 78 fails, control 77 passes).

### What the new assertions prove

- Activation 090: the producer's own transaction holds an `ExclusiveLock` advisory lock whose (classid, objid) are the high and low 32 bits of `hashtextextended('cms.governed.lineage:template_version:<lineage>', 0)` after a committed `activate`, and holds none before it (fresh lineage).
- Schedule 055: a counted approver's `cms.reviewer` grant revoked after acceptance blocks the schedule `approval_invalidated` at fire time (schedule `blocked` v3, subject `blocked` lifecycle 5, review untouched, no event, one audit); a new `schedule` command then commits the invalidation (`review_not_open` envelope, review `invalidated reviewer_authority_changed` v3, subject `draft` lifecycle 6) and creates no second schedule.
- Ladder: l1 fails four times through execute (as before) and is then scheduled again (`blocked:9,pending:1`, lifecycle 6, no event); l3 is blocked `retries_exhausted` by the claim itself (version 9, subject `blocked` lifecycle 5, no event, one audit) and its late executor is `CONFLICT` with no effect; l4 runs with an expired-but-unrecovered lease and takes the 15 s step, then completes with l2 (recovered by the claim) once the policy fault is removed.

### Open items / Requests to root

1. Record DEC for Decisions 1 and 2 and the BE03c clarification (lock-order row of the claim; expired-lease semantics of the executor) as you planned.
2. pattern_definition: 127 failures identical on promoted-only baseline (F3). Not governed-b. Needs whoever owns pattern-def/block-compat; until fixed, pattern subjects through `cms_activate_governed_subject` are unexercised in this pass (the previous pass exercised them: 341 assertions green with the pattern-def WIP then staged).
3. Finding 5 (review `version` on schedule acceptance / terminal block vs the 304 on CMS-03C-10) remains a spec-owner decision.
4. Promote `070400`, `070500`, `070600` in place of the earlier bytes (the other seven files are unchanged). The ladder suite is now about 12.5 minutes of real waiting: run it separately.
5. Hand the amended `## RPC boundary` item 3 (execute `expectedVersion` = immutable review version) to the Worker sweep lane.
6. Memory capture candidates (root decides): "an `until`-poll plus a pending staged run: install fixed WIP bytes only after the runner's stage dir shows the old bytes copied (RED needs the old bytes)".

## Fix pass 2

Checkpoint 1 (start, HEAD `b16edb54`): read `review-governed-b-f1.md` (PARTIAL: one major, three minors) and brief `governed-b-f2.md` (rulings binding).
Plan: (1) tests first (activation `090`: non-locking helper xmax oracle + positive control, call-site source oracles; schedule `055`: lineage
advisory lock held after a committed `schedule`), RED run on the current bytes; (2) `070000` gains `cms_governed_lineage_lock_key`,
`cms_governed_take_lineage_advisory` (the one place the key is spelled) and the non-locking `cms_governed_read_lineage_active`; (3) `070400` and `070600`
use them (re-read without a row lock), `schedule` takes the advisory lock last; (4) GREEN run (activation, schedule, pattern_definition), ladder run.

### Fix pass 2 status (2026-10-14, HEAD `b16edb54`): **GREEN**

Review `review-governed-b-f1.md` (PARTIAL: major 1, minors 2-4) addressed under root rulings 1-4. Unpromoted WIP only: new `070010`, edited `070400`, `070600`.
No applied migration, shared helper, existing oracle, other lane's file or `070500` touched; no trigger disabled, no clock forged. `070000` is unchanged.
Final bytes: activation 90/90, schedule 56/56, pattern_definition 343/343 (one run, 489/489); ladder 24/24 (own run).

| Finding / ruling | Disposition |
| --- | --- |
| 1 major (ruling 1): re-read under the advisory lock was `FOR UPDATE` (position 3 after the last position, deadlock with a fresh switcher) | FIXED at both call sites. New `cms_governed_read_lineage_active(kind, lineage, except)` (`070010`): the same query as `cms_governed_lock_lineage_active` without `FOR UPDATE`, `volatile` so every query takes a fresh snapshot (a version committed while the caller waited for the advisory lock is seen). `070400` step 9 and `070600` step 4 call it after the lock. Sound because every writer of a lineage's active row (both switchers) takes the advisory lock before `cms_governed_apply_activation`; nothing else leaves `active`. `cms_governed_supersede_lineage`'s own `FOR UPDATE` then only re-locks the row step 5 already holds (or finds none). |
| 2 minor (ruling 2): key literal written twice; `v_review.lineage_id` vs `v_subject->>'lineageId'` | FIXED. `cms_governed_lineage_lock_key(kind, lineage)` is the only place `'cms.governed.lineage:'` is spelled; `cms_governed_take_lineage_advisory(kind, lineage)` (NULL key -> `VALIDATION_FAILED`, never a silent no-op lock) is the only caller of `pg_advisory_xact_lock`. Activate, schedule and execute all use it with `v_review.lineage_id` (equal to the subject's lineage by the review guard). |
| 3 minor (ruling 3): `schedule` took no advisory lock | FIXED. `070400` step 9 takes the lock for both actions, last (after the step-8 recheck, which returns before step 9 when it commits an invalidation), then only `activate` does the conflict re-read. Decision 3 of Fix pass is withdrawn. |
| 4 minor / ruling 4: oracle | See "Oracles" below. |

### Deadlock reasoning (every producer that takes the advisory lock)

Takers: `cms_activate_governed_subject` for `activate` and for `schedule` (`070400`), `cms_execute_governed_activation` (`070600`). Nothing else takes it (grep: `pg_advisory_xact_lock` only in `cms_governed_take_lineage_advisory`; callers `070400`, `070600`).
Each takes it AFTER every row lock of its command: activate/schedule after positions 1 (authority rows), 3 (subject; for activate also the lineage active row), 3-4 (graph and content types), 5 (review); the step-8 invalidation path commits and returns before it; the executor after 1, 3, 3-4, 5 and 6 (schedule row).
After the lock a command touches only rows it already holds (subject, review, the executor's schedule row, the superseded active row locked at step 5/2) plus inserts: audit and outbox rows, and for `schedule` the new schedule row, whose unique index contends only with schedule rows of the same subject, which the subject row lock (step 5) already serializes. The conflict re-read now takes no lock. So no advisory holder ever waits on a row that an advisory waiter holds: a cycle needs a holder waiting on a waiter's row, and holders wait on nothing after the lock. Advisory waiters themselves wait only on holders. The claim (`070500`) takes `SKIP LOCKED` locks only and never takes the advisory lock, so it cannot be in a cycle. The first-activation deadlock of finding 1 (waiter C holds V1 `FOR UPDATE`, holder B re-reads V1 `FOR UPDATE`) is gone because B's re-read no longer locks V1. Residual: a lineage whose switchers are blocked at step 5 by a row the other holds is ordered by the lock-order table, unchanged.

### Oracles (ruling 4)

A row lock is not observable from the one pgTAP session: `pg_locks` shows tuple locks only under contention, and the tuple `xmax` of these rows is already marked by the foreign-key key-share locks the producers' own inserts take (the first xmax-based oracle, with a `FOR UPDATE` positive control, failed its CONTROL in run R1: classified harness, so xmax cannot see the lock; replaced). Two real sessions are required for a lock-level proof and are outside the lane (race modules forbidden); that is the only proof of `activation_conflict` too. The oracles therefore read the function bodies (activation `090`, helpers in `005-lineage-helpers.sqlinc`):
- `cms_governed_read_lineage_active` returns the lineage's active version when another subject is excluded and NULL when only the excluded subject is active (real fixture, inside the CMS rpc context the version tables' RLS needs), and its body contains no row-locking clause; positive control: the same pattern matches `cms_governed_lock_lineage_active` (`FOR UPDATE`).
- `cms_activate_governed_subject` and `cms_execute_governed_activation`: the body from the advisory-lock call on (the `cms_governed_take_lineage_advisory` call or a raw `pg_advisory_xact_lock`, whichever comes first) is non-empty and does not mention `cms_governed_lock_lineage_active`.
- The key literal appears only in `cms_governed_lineage_lock_key`; both producers reach it through `cms_governed_take_lineage_advisory` and re-read through `cms_governed_read_lineage_active`.
- Schedule `055`: a fresh lineage holds no advisory lock (control), and a committed `schedule` holds the lineage advisory lock from `pg_locks` (the existing `s12gb_lineage_lock_held`, now in `005`).
RED on the current (old) bytes, run R1: `FOR UPDATE` re-read oracles (activate, execute) fail because the old bodies call `cms_governed_lock_lineage_active` after `pg_advisory_xact_lock`; key-helper oracle fails (literal in both producers); schedule lock-held oracle fails (old `schedule` took no lock). All for the right reason (genuine defect / missing feature), not harness.

### Files changed in this pass (final bytes of runs G3 and L1)

| path | lines | SHA-256 |
| --- | --- | --- |
| `supabase/migrations-wip/governed-b/20261014070010_cms_governed_lineage_lock.sql` (new) | 86 | `9ae0f6258db7f2cf49bb2d22e598d2d7962df747a754cce4ed7abf9bcb388320` |
| `supabase/migrations-wip/governed-b/20261014070400_cms_activate_governed_subject.sql` | 226 | `143e4971ef0717cb6ad738590278ba230c23acc238f44f74f02210044131e3de` |
| `supabase/migrations-wip/governed-b/20261014070600_cms_execute_governed_activation.sql` | 226 | `1279cfcd965d0c8440b49104195991cfe350702814f6767a5a998420933b5cd5` |
| `supabase/tests/phase_02_slice_12_governed_activation.sql` (plan 90) | 41 | `495ffeeb5d3c16851c56aca407c06693aa2f4d6c21b10b42db83e5a81cf9941d` |
| `supabase/tests/phase_02_slice_12_governed_activation/005-lineage-helpers.sqlinc` (new) | 48 | `185b45c3f00c55ef81c97e8e4b97f007e2c84821870d3c30ae1a8c9d9307f3b7` |
| `supabase/tests/phase_02_slice_12_governed_activation/090-lineage-lock.sqlinc` | 43 | `ebd249b81962a108a704145190e92ff8ea53c6f5a175d60131b92be28aba7e1b` |
| `supabase/tests/phase_02_slice_12_governed_activation/README.md` | 23 | `34a41df6d0fe79ecd639f8795c3bc65492f66901781876dbc57c9cd74e70fc27` |
| `supabase/tests/phase_02_slice_12_governed_schedule.sql` (plan 56) | 40 | `82d8a297a8d4194fdeda742af8fccb1366f656484c1a8d88abebd49c7a152f12` |
| `supabase/tests/phase_02_slice_12_governed_schedule/055-fire-approval.sqlinc` | 46 | `d1fcf731165fc91f1ba67e84f22aa447b792191cae3ae93fa6e4a6ad1eb8e325` |
| `supabase/tests/phase_02_slice_12_governed_schedule/README.md` | 17 | `c8ac7e26621f9fd61a0c043bca8f9f7a613b841f24ca8ddd95c4ade1c0c754a7` |

Unchanged: `070000`, `070100`-`070300`, `070410`, `070500` (`1538d221...`), `070510`, `070610`. Promotion: add `070010` (new) and replace `070400`, `070600`; the other files stay as they are.
There are no new `platform_api` functions; the three new private functions are revoked from `public, anon, authenticated, service_role` (inventory pins for private helpers).

### Runs (staged runner, lane `governed-b`, one invocation each; TAPs in `.lane-logs/`)

| # | time | stamp | stage / bytes | files / plan | result | first failing / classification | TAP SHA-256 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | 16:43 | governed-b-164330-1353754 | wip 10, OLD `070400`/`070600` bytes, new tests | activation 88, schedule 56 | RED: 138 ok / 6 not ok | activation 79 (helper absent, oracle written as xmax), 80 (xmax CONTROL failed: harness, technique cannot see the lock), 81 and 82 (genuine defect: row-locking read after the advisory lock in activate and execute), 83 (genuine: key spelled twice, no helper); schedule 49 (genuine missing feature: `schedule` takes no advisory lock) | `4d4b9649598f3cf5d86dc0414cbdf227348d0a0baff13086f24f225fe2aa7a5a` |
| G1 | 16:47 | governed-b-164754-1381847 | wip 11, new bytes; tests 79/80 still xmax-style | activation 88, schedule 56, pattern_definition 343 | 486 of 487 ok; only activation 79 fails | oracle defect (harness): test 79 read the helper outside the CMS rpc context, so the version tables' RLS hid the row; not a producer defect (81-83 and schedule 49 now pass) | `3805cae5380cfb2c25fd5e6168776d0e0903d36796ef960c8a32f09e9436b50b` |
| G2 | 16:52 | governed-b-165208-1407133 | wip 11; oracle split into three `is`/`ok` tests, helper still called outside the context | activation 90 | 89 of 90 ok; activation 79 (`have NULL, want <subject>`) | same harness defect, now diagnosed from `have`/`want`: row-level security needs `app.cms_rpc = 'true'` | `b2ebf014112dc05f5a8d5811fddc773d9bcb7e47d33d62ca372b4e030d397659` |
| G3 | 16:53 | governed-b-165326-1415219 | wip 11, FINAL BYTES | activation 90, schedule 56, pattern_definition 343 | **489/489 PASS** | none | `ba832be543100cee84176ad60d03d43af0cb9c9208fa1488c06cddad71be6b96` |
| L1 | 16:57 | governed-b-165735-1438553 | wip 11, FINAL BYTES | ladder 24 (747 s of real waiting) | **24/24 PASS** | none | `07c12e4d860d5cf13100d7ed3e68ec3b32bd539859a65cdcb734af9bdacfdf05` |

Ladder rerun rationale: `070600` changed (executor step 4: the advisory call and the re-read). The changed lines are on the executor's completion path, which the ladder's l2 and l4 schedules (and the schedule suite `030`) run; the retry-conflict branch (`is distinct from v_active`) stays unreachable sequentially. `070500` (claim) is unchanged, so the claim-side ladder behaviour is untouched. Mutants were not rerun (no behavior the existing mutants cover changed).

### Open items / Requests to root

1. Promote `070010` (new), `070400`, `070600` in place of the earlier bytes. A two-session race check in the canonical gate (outside this lane) is the only proof of `activation_conflict` and of the deadlock-free first-activation case; its expected result after this fix: one session activates, the other gets `activation_conflict` (activate) or the executor's retry result, no `deadlock_detected`.
2. DEC text: BE03c 1326/1348 literal now holds for `schedule` (Decision 3 withdrawn); the earlier claim-row clarification and the expired-lease Decisions 1-2 still need DEC text.
3. Memory capture candidate (root decides): "a row lock cannot be asserted from one pgTAP session: tuples already carry FK key-share xmax; assert on function bodies plus a pattern positive control; definer helpers that read RLS tables need `app.cms_rpc = 'true'` when called from a test".
