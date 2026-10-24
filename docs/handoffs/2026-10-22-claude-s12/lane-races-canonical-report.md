# Lane claude_s12_races_canonical report

## Status

FOLLOW-UP 3 (DEC-225 / review V9): protected-primary assert moved behind one helper, ALT-only; V9-05/06 closed; V9-07 recorded. See `## Follow-up 3`.

FOLLOW-UP 2 (root rerun `.lane-logs/canonical/races-rerun-20261023T112122Z.log`): sweep, S11 013/014/015 PASS; the dec199 wait now happens; the next failure is a TEST oracle error in
`093-publication-race-effects.mjs` (fixed; see `## Follow-up 2`).

FOLLOW-UP 1 (2026-10-23, root run `.lane-logs/canonical/races-s12-20261023T105902Z.log`): root passed 5 of 7 modules; the two failures are
diagnosed in `## Follow-up 1` below: dec194_sweep = TEST premise error (fixed in the module); dec199_publication = PRODUCT locking gap
(forward WIP migration + pgTAP delivered, needs promotion). Rerun list is at the end of that section.

Original delivery: READY-FOR-ROOT-RUN (2026-10-23). Static work complete; NO race, DB, docker or runner command was executed (lane rules).
Non-DB checks green: `node --check` on every touched `.mjs`; eslint (infra + tests) 0 warnings; Vitest
`tests/contracts/phase-02-slice-12-race-canonical-mode.test.ts` (new, 24 tests, written RED first: module missing) +
`tests/contracts/phase-02-slice-09-race-runner-gate.test.ts` = 36/36 passed. Every module's runtime behaviour in
canonical mode is UNRUN; root's output will classify any remaining failure.

## Scope

Make the 7 Slice 12 modules in `RACE_RUNNERS` run in every canonical `db:verify` like S10/S11, keep the root ALT path.

Design: one explicit opt-in, `WEJAMMIN_CANONICAL_RACE=1` (exact value `1`), set ONLY by
`infra/run-database-race-runners.mjs` (`raceEnvironment(process.env)` on the spawn). Shared helper
`infra/database-races/canonical-mode.mjs` (`isCanonicalRace`, `canonicalContainer`, `assertCanonicalTarget`).
Canonical mode: container = `S10_RACE_DB_CONTAINER ?? AC217_DB_CONTAINER ?? supabase_db_wejammin` (race-kit's chain,
verbatim); protected primary checkout still refused (same assert, both modes, for every module that had it);
canonical + any ALT release variable together = loud failure ("mutually exclusive"). ALT asserts are untouched in the
non-canonical branch (still FORBID `supabase_db_wejammin`, still require the explicit releases).

Module changes:
- `dec193_writer`, `dec199_publication`: kits' `container` and `assertTarget()` are mode-aware. Publication kit's
  ALT-only pin to the `phase2-slice12` worktree path applies only in ALT mode (canonical runs from whichever
  checkout runs db:verify, never the protected primary).
- `dec194_outer`, `dec194_sweep`: top-level ALT asserts moved into the non-canonical branch; unconditional
  protected-primary assert kept above the branch.
- `entry_default_template_lock`, `restore_relation_visibility`: `requireAltRelease()` (name kept for importers) is mode-aware;
  entry lock's hard-coded `supabase_db_wejammin_ev` in `args()` is now `targetContainer()`. These two are node:test
  files whose TAP prints `ok 1 - name`, which the gate's `^ok - ` verdict never counts (would FAIL with ok=0 even
  when green): each passed subtest/scenario now also logs `ok - <name>`. No assertion changed.
- `governed_authority`: the `cms_grant_capability` fixture command failed `P0001: STEP_UP_REQUIRED` because its context
  lacked the recent-MFA proof that `platform_private.cms_review_binding(..., p_recent=true)` requires
  (migration 20261002188000: `context.stepUpVerified === true`, `context.stepUpAt` ISO instant within -30s..600s).
  Grant context now carries `stepUpVerified: true` + `stepUpAt: now-60s` (same proof as chain-kit / review-kit; the
  governed submit and `cms_define_template` take no step-up, verified by grep, so only the grant uses it). No trigger
  disabled, no row inserted; real producer path unchanged. Container resolution of this module was already the S10 chain.

Cleanup / ordering: unchanged. The gate runs `pnpm db:reset` before each module and once at the end (S10/S11 contract);
modules with scratch tables still drop them in their own cleanup; committed fixture rows rely on that reset.

## Files

Before/after SHA-256 (full list in scratch `before.sha256` / `after.sha256`):

| Path | Before | After |
| --- | --- | --- |
| infra/run-database-race-runners.mjs | 3e3855b02f561327c2e859d9c3ca431128e4925d268fa5c00cd11766ee050db7 | 94626a93ae630f8bf2a817438e0517bb5842b025de348356a88865348b63873e |
| infra/database-races/README.md | 789491ee0792a3f52ba4a65a723c23f94ef197bc633a9e73fd1be268a0b48b37 | 97583f7efed9352a74ed695c62f3e4e28db004784c8d80a5bfdd94b026fcd12d |
| infra/database-races/canonical-mode.mjs (new) | - | 19df07eb9da7aff01d30c63867e893051077bfc7a6b6b7f6d0670859c02d84ad |
| tests/contracts/phase-02-slice-12-race-canonical-mode.test.ts (new) | - | f4a45fe17b6a50d976e103302e84e3bfd6c2ea9b65218bfc6ce5f4eb12180c16 |
| supabase/tests/phase_02_slice_12_dec194_outer.race.mjs | a5544783138cd490cec9e33e74ebe234f3dfb2dcba5993a88e6cbde197577922 | c4c6aed20baeb176044c53926cb8bf2bbb484bcce719ceac1468b3e08e0a5941 |
| supabase/tests/phase_02_slice_12_dec194_sweep.race.mjs | 612d11bc358e7cbe4980b7a77dcd2ed080353a0e01c7adf81590dd532f8a402c | b640dac7f5df91af265b1ea1040abfb71c3a50fd5deb1a9700151a1b646ba40b |
| supabase/tests/phase_02_slice_12_dec193_writer_boundaries/091-race-session-kit.mjs | 2bd08779b6cb2439873a5181b180ffeab0afffdc04cde5b6891e11e805baadc4 | bac30a9e9987bf74c720469bdb96b59a7c5c3b0f726089a8773a3a4b09d6f857 |
| supabase/tests/phase_02_slice_12_dec193_pattern_currentness/091-publication-race-session-kit.mjs | 1f1564ce5ca37058c3ad2064944869c581823e94890a17434ba4cd4c147c28c3 | 1e0267dc2967a7695e563839b2817ed6f65eb1eb75d0a810ecd3002e16de8076 |
| supabase/tests/phase_02_slice_12_entry_default_template_lock/020-race.mjs | 638cf169713bc2f146a147860d8a8767ca27f3ce6e0aa1de5d1137d27352ddb8 | 68b8d4d180da116b9119f539ba748609ab51e4efc5c9dc5c33b4419ec519d6cd |
| supabase/tests/phase_02_slice_12_entry_default_template_lock/040-race-session.mjs | d3b1776dd93da1afc9820fb3048843dd45d6c514e671a55af75d878c48dc09db | 0cbe810c0d1a02e5fe25ecd87022472be985bea69292b5c2efe882369a75662e |
| supabase/tests/phase_02_slice_12_restore_relation_visibility/020-race.mjs | 1abb98e32b46424612462b729c7a3d113c3dc353b63c2cf2bec4e2d45704d695 | ddd9a6cfaf7e31774874523ae0695b011b52ff7d4e5c8a84e48b69c7bb1a4c5e |
| supabase/tests/phase_02_slice_12_restore_relation_visibility/040-race-session.mjs | 62a28809785f045d933dbc304ac4cf9691387b55431dca7f2124ac95c00acaee | d83312b201a518c93cc95ca271c609c666b0d7e8dedeab54cccf03ff66bbe5e7 |
| supabase/tests/phase_02_slice_12_governed_authority/governed-authority-kit.mjs | f06539ebe1fb08fdebfba3ec93dbd1a245612d5ce42df679d427de7c7a609036 | 993b1421fb92b2a7d6001f073477ed9f799eeaf366643e22fd106b9f4a67525f |

`RACE_RUNNERS` / `RACE_SUPPORT_MODULES` lists unchanged (the new helper lives under `infra/`, not `supabase/tests`).
Backups: `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_races_canonical/orig-20261023T103239Z.tar`
(SHA-256 649533f4197d40d3d99c8c61623485c2161f7bb0d6da6a4d91b958f52de438f0): pre-edit copy of every edited file.

## Runs

None (lane forbids race/DB runs). Non-DB: the Vitest, eslint and `node --check` results in Status.

## Test corrections

Original delivery: none (additions only: canonical branch, `ok - ` receipt lines, step-up proof).

Follow-up 1 (needs independent review): `supabase/tests/phase_02_slice_12_dec194_sweep.race.mjs` scenario S9 (`cfirst`). Removed
`await blocked('recovery waits on continuation-held party advisory mutex', recovery, continuation, true);` (premise contradicts
BE03c `:1551` and migration `20261014190050:53-68`: a committed running continuation Job makes the party ineligible, so the sweep never
reaches the mutex). Added: exact pg_locks assertion that the continuation holds `hashtextextended('cms.taxonomy.merge.enqueue:'||party,0)`;
`await ready(recovery)` + `assert.ok(!continuation.settled)`; an `ok - ` line. All later S9 assertions (`{requested:0}`, one continuation Job,
no recovery Job, `association(Q)='none'`) are unchanged.

## Spec citations

- Step-up: `supabase/migrations/20261002188000_cms_review_binding_step_up_proof.sql` (BE01a -30 s <= now - stepUpAt <= 600 s);
  `20261002141000_cms_grant_capability.sql` (CMS-03A-15, `cms_review_binding(..., true)`).
- Lock order the races prove: BE03c "Slice 12 lock order" and each module's cited DEC/CMS-03C sections (unchanged, not exercised here).

## Open items / BOUNDARY

1. `governed_authority`: only the first failure (step-up) is fixed. The fixture continues through `cms_define_template`
   (twice) and the S1/S2 schedule, never run past the grant. Direct `update identity_private.organization_actor_grant` is
   the module's existing revocation seam (postgres, `app.cms_rpc`); if it is refused, switch to the real revoke/grant
   commands (both need the same step-up) - not done speculatively because it changes the race's lock participants.
2. Protected-primary assert is kept in canonical mode (4 modules). A canonical `db:verify` run from
   `/home/rob/Projects/WeJammin` itself will therefore fail those 4 modules by design; CI and worktree runs are unaffected.
   Root decision if primary-checkout canonical runs are wanted (I did not weaken it).
3. Canonical + stale exported ALT release variables fails loudly (mutual exclusion). Unset them before `pnpm db:races`.
4. All seven fixtures were authored against the staged ALT and are first executed on the canonical stack by this change.

## Requests to root

Run each module in canonical mode and return output (resume me with it):

Prereq for each: local stack up (canonical `supabase_db_wejammin`), and a fresh `pnpm db:reset` immediately before the module
(no `db:api-test` needed; fixtures commit rows the gate resets).

    cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin && export PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH
    for m in \
      supabase/tests/phase_02_slice_12_dec193_writer.race.mjs \
      supabase/tests/phase_02_slice_12_dec194_outer.race.mjs \
      supabase/tests/phase_02_slice_12_dec194_sweep.race.mjs \
      supabase/tests/phase_02_slice_12_dec199_publication.race.mjs \
      supabase/tests/phase_02_slice_12_entry_default_template_lock/020-race.mjs \
      supabase/tests/phase_02_slice_12_governed_authority.race.mjs \
      supabase/tests/phase_02_slice_12_restore_relation_visibility/020-race.mjs; do
      pnpm db:reset && WEJAMMIN_CANONICAL_RACE=1 node "$m" ; echo "EXIT $? $m"
    done

One module: `pnpm db:reset && WEJAMMIN_CANONICAL_RACE=1 node <module>`. Full list (all 28, resets between, receipts in
`test-results/db-races.jsonl`): `pnpm db:races`. Expected on pass: exit 0 and >= 1 `ok - ` line per module
(entry lock 3, restore 4, governed >= 2, others per their own checks).


## Follow-up 1 (systematic debugging of the two canonical failures)

Reproduction understanding came from the log sections and source reads only (no DB, no race run).

### (1) `phase_02_slice_12_dec194_sweep.race.mjs` - (b) TEST premise error, not a product defect

Observed (log lines 1129-1727): 20 ok, scenario S9 `cfirst`; `ok - continuation reaches its real receipt FOR UPDATE; waiter PID 1357,
blocker PID 1350`; then `blocked('recovery waits on continuation-held party advisory mutex', ...)` threw "producer statement completed
while the required blocker still held its transaction" (kit `091-race-session-kit.mjs:157-159`, `ready:` seen on the sweep).

Evidence:
- The scenario claims a continuation Job through the REAL BE00 `platform_api.claim_job` (`supabase/tests/phase_02_slice_12_taxonomy_terms/000-world.sqlinc:257-269`,
  called by `090-race-fixture.sqlinc:120-128` `s12dcr_claim`), so a COMMITTED Job of type `cms.taxonomy.merge_converge` in state `running` exists
  for the party before the sweep starts.
- The promoted sweep body (`supabase/migrations/20261014190050_cms_taxonomy_merge_recovery_serialized.sql:53-68`) routes a party to the mutex
  only if "no queued or running job of the type exists" (a lock-free necessary condition, header lines 15-18, review R2-03). With a committed
  `running` Job the party is skipped and the sweep answers `{requested: 0}` without ever taking the mutex. BE03c "Merge convergence recovery"
  states the same eligibility ("has no queued or running Job of the type", `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md:1551`).
- The continuation DOES take the mutex at the specified position: `20261014190040_cms_taxonomy_merge_handler_serialized.sql:43-44` (authority,
  then `cms_taxonomy_merge_enqueue_lock`, before the claim reread and position 3); BE03c "Slice 12 lock order" `:1504`.
- Every sweep scenario that DID pass waits because the competing producer's Job is not yet visible (uncommitted ordinary producer: `live`, `fresh`,
  `latest`, `third`, `no-work`, `cooldown`) or the sweep goes first (`s1`, `s2`). A claimed continuation can never be contended by a sweep that
  routes the party: its own Job is live. Not canonical-mode specific (same on the ALT).

Fix (module only, nothing weakened that the product guarantees): replaced the impossible `blocked(...)` wait with (i) a positive pg_locks assertion
that the continuation backend holds the exact advisory key `hashtextextended('cms.taxonomy.merge.enqueue:' || party, 0)` at its receipt wait,
(ii) `ready(recovery)` while the continuation has not settled (the sweep completes at once), and the existing tail still asserts `{requested: 0}`,
exactly one continuation Job, no recovery Job and `association(Q) = 'none'`. See `## Test corrections`.
Coverage note for review: continuation-held-mutex-versus-contending-sweep is not constructible (the continuation's claim makes the party ineligible
before the mutex); continuation versus sweep serialization remains proven in the sweep-first direction (`s1`, `s2`, `terminal/expired/reclaimed`).

### (2) `phase_02_slice_12_dec199_publication.race.mjs` - (a) PRODUCT locking gap (spec-underspecified; owner-approved intent)

Observed (log lines 1727-2304): 0 ok; after the positive controls, with the nested-V2 activation held uncommitted, the real
`cms_publish_revision` returned `00000` and a published resource (`state active, projectionState pending`) instead of waiting
(module `:214-217`, kit `until` `091-publication-race-session-kit.mjs:149`). The earlier native ALT run produced the identical symptom
(`docs/handoffs/2026-10-14-claude-s12/CODEX-NATIVE-VALIDATION-2026-10-16.md:10`, "genuine missing-serialization/protocol RED"), so canonical
mode is not the cause; the bug is old and was never fixed.

Evidence:
- `cms_publish_revision` locks entry (0), authority (1), then `cms_publication_lock_review` = content-type version (4) and review (5)
  (`supabase/migrations/20261005017720_cms_publish_revision.sql:160,175`; `20261005017700_cms_publication_command_support.sql:174-218`). It takes NO lock
  on any pattern version row; steps 7-8 read the pins with plain statements. The DEC-199 provider/status are read-only
  (`20261016044200_cms_pattern_active_digest.sql` is `STABLE`, no `FOR SHARE`; `20261016044100` likewise).
- The conflicting producer takes the lineage's current `active` row FOR UPDATE (`20261014070000_cms_governed_activation_helpers.sql:17-44`,
  `20261014070400_cms_activate_governed_subject.sql:100-110`). Nothing on the publication side conflicts with it, so neither waits.
- Spec: BE03b "Write-path lock order" position 3 (`.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1734-1744`) puts the dependency graph before
  the schema (4) and review (5); BE03c "Slice 12 lock order" (`03c...md:1488-1505`) requires pinned pattern rows FOR SHARE before positions 4/5 for every
  Slice 12 writer and, for submit, "its dependency graph (nested pattern versions, FOR SHARE)". The DEC-199 text and `03c:1571` demand the nested recheck
  but state no lock for the three publication commands: THAT row is missing from the spec table (the precedent writer
  `20261014110300_cms_insert_pattern_instance.sql:139-148` already locks root + nested FOR SHARE ascending). The lane plan
  (`docs/handoffs/2026-10-14-claude-s12/lane-codex-dec199-lock-dependency-plan-2026-10-16.md` steps 2-3) proposed exactly this and was never released.
  Verdict: a real TOCTOU in the product (publication judges a nested pin current while its successor activation is in flight), and the race
  module's expectation (wait on the old nested-V1 tuple before the schema/review locks; change-first ends in the committed `version_set_stale`
  refusal with `dependency_changed` invalidation; publish-first makes the activation wait on the publisher's FOR SHARE) is the right contract.

Fix delivered (FORWARD, unpromoted, nothing in `supabase/migrations/` touched), `supabase/migrations-wip/race-fixes/`:
- `20261023100000_cms_lock_revision_pattern_dependencies.sql`: `platform_private.cms_lock_revision_pattern_dependencies(uuid) returns void`,
  FOR SHARE ascending id on the root version row and every nested row (`cms_pattern_nested_closure`) of the newest composition heads of the revision
  that are draft/active/pending_diff, have a pin and a SQL-NULL `detached_tree` (live use; canonical detached trees lock nothing, mixed use locks);
  missing revision = no-op; definer-owned, private, no API grant. Same privileges and idiom as the placement producer.
- `20261023100100_cms_publication_pattern_dependency_locks.sql`: guarded anchored amendment (unique anchor, inverse byte-for-byte check, pg_proc
  attributes/comment unchanged, post-edit ordering check) of `cms_publication_lock_review(uuid)` (CMS-03B-07 schedule, CMS-03B-09 publish) and
  `cms_schedule_lock_review(uuid,uuid)` (CMS-03B-20 execute): helper call inserted immediately before the position-4 comment/lock.
- pgTAP `supabase/tests/phase_02_slice_12_race_fixes_pattern_locks.sql` (8 assertions: helper attributes/ACL, missing revision, source order in both
  helpers, attributes of the amended helpers). A row lock is invisible to its own transaction, so the wait itself is only provable by the race.
- Coverage statement (N/M): publication family 3/3 commands (schedule, publish, execute) covered; CMS-03B-05 submit and CMS-03B-06 decision still lack the
  position-3 lock (plan step 3 rows 1 and 5; decision also lacks its entry fence). The race module covers publish only. Dependency receiving (plan steps
  5-6: nested pins missing from `cms_review_dependency_refs`, live-review backfill) is a separate, still-open product gap that this migration does not touch.
- UNRUN: I could not execute SQL. Deadlock analysis: the helper runs after positions 0-1 and before 4-5 in all three commands, the same relative order as the
  placement writer and the activation (3 before 4 before 5); no inversion introduced.
- Spec action for root/owner: add a `CMS-03B-07 / CMS-03B-09 / CMS-03B-20` row to BE03c "Slice 12 lock order" (position 3: the live pattern dependencies of the
  revision, FOR SHARE, ascending id), and decide whether submit/decision follow now.

### Rerun list for root (in this order)

1. pgTAP of the new migration set through the staged ALT runner, lane name `race-fixes`:
   `cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin && PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH bash docs/handoffs/2026-10-14-claude-s12/lanes/lane-db-alt-staged.sh /home/rob/.codex/worktrees/phase2-slice12/WeJammin race-fixes supabase/tests/phase_02_slice_12_race_fixes_pattern_locks.sql`
2. Regression pgTAP that exercise the amended helpers (schedule, publish, execute): `supabase/tests/phase_02_slice_11_rpc_publication/*`, `phase_02_slice_11_criteria_publish_gates.sql`,
   and the S12 currentness/preflight suites (`phase_02_slice_12_dec193_pattern_currentness.sql`).
3. After promoting the two migrations into `supabase/migrations/` and `pnpm db:reset`, the two failed modules (fresh reset each):
   `WEJAMMIN_CANONICAL_RACE=1 node supabase/tests/phase_02_slice_12_dec199_publication.race.mjs` (expects 2 scenarios x full effects) and
   `WEJAMMIN_CANONICAL_RACE=1 node supabase/tests/phase_02_slice_12_dec194_sweep.race.mjs`.
4. Because the amended helpers sit under S11 publication/schedule races, rerun `supabase/tests/phase_02_slice_11_races/013-schedule-claim-race.mjs`,
   `014-publication-execute-race.mjs`, `015-schedule-accept-race.mjs` (or the full `pnpm db:races`).


## Follow-up 2 (dec199 publication: assertion at 093:118)

Root rerun after promoting `20261023100000/100100`: `ok - change-first: exact nested-V1 tuple/XID witness; first PID 405, waiter PID 419` (the publisher now waits on
the activator's old nested-V1 tuple: the product fix works), then `activationEffects` failed `strictEqual` actual `936ac5ba-...` vs expected `29d15cb5-...`.

- Line `093-publication-race-effects.mjs:118` is `assert.equal(audit.correlation_id, item.activation.correlationId)`: the compared ids are the audit row's
  `correlation_id` (actual) and the request's TOP-LEVEL `correlationId` (expected). Not a version, superseded row, event or audit id. The preceding assertions
  (`:114-117` actor, acting party, `target_id = item.next`) passed, so the activation updated the right rows (child V1 superseded, next V3... active).
- Cause: TEST oracle error. The product derives the effective correlation with `cms_correlation(p_request)` -> `cfg_correlation`, which reads
  `context.correlationId` FIRST, then `app.correlation_id`, else generates one (`supabase/migrations/20260901070000_platform_configuration_authority.sql:496-509`;
  used by `cms_activate_governed_subject` `20261014070400:68` and `cms_publish_revision` `20261005017720:77`). The fixture builds requests with BOTH a random top-level
  `correlationId` (`090-publication-race-fixture.sqlinc:106,187`, allowed but never read) and a `context` from `s09d_context` carrying a different random
  `correlationId`; the audit/event use the context one. All other kits (`review-kit.mjs`, `chain-kit.mjs`) put `correlationId` inside `context`.
- Not caused by the new lock: in change-first the activation is the FIRST transaction (it holds the old tuple, nothing waits on it), so the FOR SHARE lock does not alter which row it
  updates or which version is current; in publish-first the activation merely waits for the publisher's FOR SHARE and then updates the same rows.
- Spec expectation in change-first: activation commits one audit (`cms.governed.activate`), one `cms.pattern.activated.v1` event, one CMS-03C-09 receipt (200, resource = next);
  the waiting publish then returns the committed `version_set_stale` refusal with the `dependency_changed` invalidation and schedule cancellation (BE03b E1; module header
  and `publicationEffects(..., refused=true)`). Unchanged.
- Fix (module support only, strength unchanged: same two ids compared, but against the id the product actually uses): `093-publication-race-effects.mjs` lines 118, 119, 164, 165, 266
  `item.activation.correlationId` -> `item.activation.context.correlationId` and `item.publish.correlationId` -> `item.publish.context.correlationId` (the publish
  oracles would have failed identically next); one explanatory comment line added at line 2. Listed under Test corrections for review.

### Test corrections (cumulative addendum)
- Root fixed two `proconfig::text` expected literals in `supabase/tests/phase_02_slice_12_race_fixes_pattern_locks.sql` (lines 18 and 71) after the first pgTAP run (my literals did not match
  the array's text form); the file passes 15 files / 1,319 per root.
- `093-publication-race-effects.mjs`: correlation oracle as above (before SHA-256 `93778420bdbef41e35b0827305e03fd40e8a077962569e2b90b764c9c50a3d63`,
  after `16b43401995c3b620b8dbecb888a7d127ec005485e2850f11b11256d3463073c`; backup tar in the scratch dir `orig-093-*.tar`).

### Rerun
`pnpm db:reset && WEJAMMIN_CANONICAL_RACE=1 node supabase/tests/phase_02_slice_12_dec199_publication.race.mjs` (expect two scenarios; later effect oracles in
`publicationEffects` / `activationEffects` are first exercised by this run and may surface further oracle findings: send the output back).


## Follow-up 3 (root DEC-225 and review V9 NITs; non-DB checks only)

Backup before editing: scratch `orig-v9-20261023T120425Z.tar` (SHA-256 `7276c0c4b3cecd42275ef09402a3769b0369f65a1491282106a19ad075290bdb`).

- **V9-03 / DEC-225.** The protected-primary-checkout rule now lives ONLY in `infra/database-races/canonical-mode.mjs` as
  `assertRaceCheckout({ root, env })`: canonical mode (`WEJAMMIN_CANONICAL_RACE=1`) allows any checkout including `/home/rob/Projects/WeJammin`;
  ALT mode (no opt-in, or any value other than exactly `1`) refuses it with the unchanged message "protected primary checkout is forbidden".
  `assertCanonicalTarget` no longer takes `root`. The four modules that carried the assert (`dec193_writer` kit, `dec199_publication` kit, `dec194_outer`,
  `dec194_sweep`) replaced their raw `assert.notEqual(root, '/home/rob/Projects/WeJammin', ...)` with one `assertRaceCheckout({ root })`; no raw primary path remains
  in them. The publication kit's ALT-only pin to the phase2-slice12 worktree path is unchanged (still ALT only). README updated.
- **RED first** (`tests/contracts/phase-02-slice-12-race-canonical-mode.test.ts`): new test "DEC-225: canonical mode may run from the primary checkout; ALT mode may not"
  (primary allowed under canonical; refused with no opt-in and with `WEJAMMIN_CANONICAL_RACE=0`; other path allowed) plus source tests that the four files call
  `assertRaceCheckout({ root })` and contain no raw primary path. 5 failed before the change; now 27 + gate 12 = 39/39 PASS. node --check on all touched `.mjs`, eslint
  `--max-warnings=0` and prettier `--check` on infra and the test: clean.
- **V9-05** (stale comments): headers of `dec193_writer`, `dec194_outer`, `dec194_sweep`, `dec199_publication`, `governed_authority` `.race.mjs` now describe the canonical gate / ALT-by-hand
  modes instead of "Root-only ALT diagnostic / authoring UNRUN"; the five closing `# ... root must reset the ALT ...` log lines reworded; pgTAP
  `phase_02_slice_12_race_fixes_pattern_locks.sql:2` names `supabase/migrations/20261023100000, 20261023100100`. Left as is: a few assertion LABELS that still say "fresh ALT"
  (e.g. `dec199 :73`, `dec194_outer :136`): they are assertion messages, not comments, and still describe a freshly reset database.
- **V9-06** (dead oracle fields): `092-publication-race-oracles.sqlinc:44-47` `audits` and `events` are now keyed by `item->'publish'->'context'->>'correlationId'`
  (the id the product uses), so they would no longer silently return `[]`. The top-level `correlationId` in the fixture requests (`090...:106,187`) is accepted by the commands but never read; left in place.
- **V9-07**: recorded only. `supabase/migrations/20261023100100` keeps its unused third `spec` array element; nothing under `supabase/migrations/` was touched.

### Hashes after this follow-up
| File | SHA-256 |
| --- | --- |
| infra/database-races/canonical-mode.mjs | `e6900f806a1cda394f7e7a70937908376bcdc6e9523215a42c878dd533a08083` |
| infra/database-races/README.md | `de5fedc2f16ee4f0ffddbe79569dd8681b2ed290eee70420c8abf4918a87f90e` |
| tests/contracts/phase-02-slice-12-race-canonical-mode.test.ts | `76e3f27f5a803440910ff065370708ef24eeb500f2db7264484fe2e44134b511` |
| supabase/tests/phase_02_slice_12_dec193_writer_boundaries/091-race-session-kit.mjs | `d800d1110a97428ff367fef76eab43d38957c9e977afe79a08111a0a5bfe8eb3` |
| supabase/tests/phase_02_slice_12_dec193_pattern_currentness/091-publication-race-session-kit.mjs | `3a9afbbced88599ceab8649a7794e75597ab6d8d47bbac77470a069e5c2e9148` |
| supabase/tests/phase_02_slice_12_dec193_pattern_currentness/092-publication-race-oracles.sqlinc | `5ec922b486d870d961c872a9949b0d0aa6345def28674b638194a915c03fb293` |
| supabase/tests/phase_02_slice_12_dec194_outer.race.mjs | `1d549a000c0f7c7bb97233b7023d0fa8653403350516622fd67bfb27d9940122` |
| supabase/tests/phase_02_slice_12_dec194_sweep.race.mjs | `03ccae2e5ac70339db1469c7c651cc302bdf132fbc7e176c5f1b85bad46f0cff` |
| supabase/tests/phase_02_slice_12_dec193_writer.race.mjs | `6646af8d55da7b102898948bc78c090f1c20c5e9d36e25b8df2e1d3d873548ff` |
| supabase/tests/phase_02_slice_12_dec199_publication.race.mjs | `dac10f4da40f421b88f759be72fc1f6265012716d07f6b26b4ce9e92882267c4` |
| supabase/tests/phase_02_slice_12_governed_authority.race.mjs | `629c6eaf78f8d7afd7cd02080edbf58aba0cb4ba76dcc7853187b58272330f52` |
| supabase/tests/phase_02_slice_12_race_fixes_pattern_locks.sql | `b5e6efb8b027728a5af8f70482d07f244ffc277722c4500c02c82aa2570a388a` |

### Rerun
The four modules once, canonical, fresh `pnpm db:reset` each: `dec193_writer`, `dec194_outer`, `dec194_sweep`, `dec199_publication` with `WEJAMMIN_CANONICAL_RACE=1 node <module>`
(behaviour change: none in canonical mode from a worktree; the edits are the checkout assert plus comments). The pgTAP change is comment-only
(`race_fixes_pattern_locks.sql:2`) and the 092 sqlinc change only affects two read fields of `s12pr_facts` (rerun `dec199_publication` covers it).
