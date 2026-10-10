# Lane publication report (Slice 11, 2026-10-10)

Worktree `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`, branch `claude/phase2-slice11`. Nothing staged or committed by
this lane. Lane scratch (scripts, mutation SQL, copies of the logs below): the session scratchpad `pub-lane/`.

STATUS: see "Verification status" at the end (pgTAP done; races and real-API specs are queued behind the CI lock).

## Cross-ownership edits and out-of-lane follow-ups (read first)

1. **`20261005017640_cms_submit_review.sql` was edited (3 lines, outside my list).** Finding 10 keys the submit summary
   (`cms_record_command_accessibility_evidence`) to the exact audit event too, and the recorder's signature changed. The edit:
   `event_id := cms_emit_event(...)` became `emitted := cms_emit_event_ids(...)` and the recorder call passes
   `(emitted->>'auditEventId')::uuid, (emitted->>'outboxEventId')::uuid`. No other lane had touched that file
   (`git status` before the edit). Revert/redo if another lane owns it; the contract is the 7-argument recorder below.
2. **`packages/data-access/src/database.types.ts` needs `pnpm db:types` regeneration** (the summary table lost `event_id` and
   gained `audit_event_id`/`outbox_event_id`; new functions `cms_record_audit_event`, `cms_emit_event_ids`,
   `cms_lineage_head_observation`; changed signatures of `cms_record_command_accessibility_evidence`,
   `cms_publication_preflight_verdict`, new overloads of `cms_schedule_block/record_failure/blocked_result/retry_result`).
3. **Evidence-ledger citations**: the changed test titles listed under "Test titles" must be re-resolved by the ledger lanes.
4. I did not touch `infra/run-database-race-runners.mjs`: no new race file was added (finding 5 lives in 014, see below).
5. Tests of other lanes (`phase_02_slice_11_criteria_*`) were run against these migrations, see "Verification status".

## Findings, in the order of the brief

### 1. Finding 6 - stale / mis-bound proof consumed retry state (DEC-158(c), BE03b:1809)
- RED: `.lane-logs/alt-tap-153703-1987037.tap` (copy `pub-lane/red1.tap`), `phase_02_slice_11_rpc_publication_execute_refusals.sql`
  `not ok 30 - stale proof (over 60 s), proof bound to other rows and proof from another provider version each refuse the execution with the typed conflict preflight_evidence_stale ...`
  (have `00000:|00000:|00000:`, want `P0001:preflight_evidence_stale` x3) and `not ok 31 - a stale or mis-bound proof consumes no retry state ...`.
- Fix: `20261010162200_cms_execute_publication_schedule_conflicts.sql` removes the exception block that turned
  `preflight_evidence_stale`/`dependency_changed` into `cms_schedule_retry_result`; the typed conflict propagates, the execution
  rolls back and the schedule row (state, lease, version, attempt_count, updated_at), audit and every effect group stay as the claim
  left them (row md5 fingerprint + `p11_effects()` equality asserted). The ladder is only for unavailable checker outcomes (absent
  proof, failed run) - still asserted. DEC-120 creator-authority rule untouched.
- GREEN: `.lane-logs/alt-tap-160228-2112180.tap` (7 files, 285 tests, PASS).

### 2. Finding 2 - lazily detected approval lapse refused and rolled back (BE03b Review invalidation)
- RED: `..._schedule_refusals.sql` not ok 38-41 and `..._publish_refusals.sql` not ok 33-36 (same TAP): the command raised
  `preflight_failed` and rolled back, the review stayed approved, the pending schedule stayed pending, no reservation completed.
- Fix: `cms_publication_preflight_verdict` (17700, in place) gained `(p_actor_id, p_correlation_id)`; when the aggregated report
  has `revocation` failed with `reviewer_authority_changed` it calls `cms_invalidate_editorial_review(reviewer_authority_changed)`
  (which cancels the review's pending/retry schedules in the same transaction) and returns the committed-refusal envelope
  `{kind:'refusal', reasonCode:'preflight_failed', details:{preflight:[17 entries]}}`. `cms_publish_revision` (17720, in place)
  and `cms_schedule_publication` (new forward migration `20261010162100_...`) complete the reservation with status 422 and
  return it; replay returns it again. Design choice (implementation-level, wire-compatible): the refusal keeps the previous browser
  contract (422 `VALIDATION_FAILED` `preflight_failed` with the 17 entries) - only the commit semantics changed.
- Tests: schedule/publish refusals assert the envelope, review `invalidated`/v3/`reviewer_authority_changed`, the pending schedule
  `cancelled/2/approval_invalidated`, exactly one review-changed event, nothing scheduled/published, reservation `completed/422`,
  replay identical with no further effect. Real API: new `phase-02-slice-11-publish.apispec.ts` test (lapse via trigger-bypassing
  fixture, HTTP 200 on the wire, 422 for the browser, replay). Worker unit tests (`publication-committed-refusals.test.ts`) pin the
  mapping of the committed envelope for 07 and 09 (6 tests, green).

### 3. AC-090 - `version_set_stale` (BE03b:1773, E1)
- RED: `..._schedule_refusals.sql` not ok 33, `..._publish_refusals.sql` not ok 28 (committed `dependency_changed` + hash).
- Fix: `cms_publication_stale_refusal` (17700) still invalidates the review `dependency_changed` but answers
  `{kind:'refusal', reasonCode:'version_set_stale', details:{}}` (CMS-03B-07 and 09; no structured member: the contract's
  `version_set_stale` detail is plain and the Worker drops a stray hash, tested). CMS-03B-05 and CMS-03B-06 keep
  `dependency_changed` (BE03b:2166 and the Decision step 4). The executor keeps its contractual form of the same condition
  (`blocked approval_invalidated`, review invalidated `dependency_changed`; ScheduleExecutionResult has no 409). Mis-bound
  accessibility evidence at schedule/publish stays 409 `dependency_changed {dependencyHash}` (BE03b evidence binding), tests retained.
- The Worker needed no code change (`committedRefusal` is token-table driven and both tokens are registered for 07/09); web copy
  already maps both tokens to the same text.

### 4. AC-080 - executor review comparison
- Tests added (execute_refusals, 5 titles): version, dependency hash, activation-evidence hash, frozen hash, each forged alone on a
  claimed schedule (raw update, CHECKs on) -> `blocked/approval_invalidated`, no lineage row/event, review left `approved`.
- The implementation already compared all four: tests pass without a production change (coverage gap, not a defect).
- Mutation proof (executor compares only `state`): `pub-lane/mut-m1.tap` (`.lane-logs/alt-tap-155851-2091926.tap`): tests 15, 17,
  18, 19 fail. The dependency-hash case (16) still passes under that mutant because the lineage data-model guard
  (`approved review at the same dependency hash`) is a second line of defense mapped to the same `approval_invalidated`; the
  outcome is what AC-080 requires either way.

### 5. Finding 13 - failed preflight keeps an existing head
- Test: `xr-head` has a real active v1 head published through `cms_publish_revision`; its scheduled publish fails the preflight
  (media reference). The full lineage rows, `cms.publication.changed.v1` events, audit rows and evidence summaries of the entry are
  fingerprinted (md5 of `to_jsonb` images) before/after: equal; head still `publish/active/1`, one row.
- No production change needed (already preserved). Mutation proof (blocked branch appends an unpublish tombstone): `mut-m1.tap`
  test 26 fails.

### 6. Finding 10 - summary keyed to the exact audit event (DEC-159(5))
- RED: publication evidence file aborted at line 79 (`column summary.audit_event_id does not exist`), review evidence file
  `not ok 13, 14, 16` and abort at line 85 (`cms_record_audit_event ... does not exist`).
- Fix (17590, 17635, 17640 in place; 162000/162100/162200 forward):
  - `cms_record_audit_event(..., p_audit_event_id default null) returns uuid` and `cms_emit_event_ids(..., p_audit_event_id,
    p_outbox_event_id) returns jsonb {auditEventId, outboxEventId}`: owned by the CMS definer, same rows `cms_record_audit` /
    `cfg_emit_effects` write, ids chosen inside (the definer holds INSERT only on the audit table, so ids are generated, not read
    back). Shared audit table/payload untouched.
  - `cms_command_accessibility_evidence`: `event_id` replaced by `audit_event_id uuid NOT NULL UNIQUE REFERENCES audit_private.audit_events(id)` and a
    nullable `outbox_event_id` (partial unique index). Recorder is now 7-argument `(op, subject, revision, audit_event_id,
    outbox_event_id, correlation_id, evidence)`.
  - Callers: submit (emit ids), schedule (audit id chosen, no outbox), publish and execute (ids chosen, passed to the append, which
    accepts optional `auditEventId`/`outboxEventId`), execute blocked/retry (new audit-id overloads of
    `cms_schedule_block / record_failure / blocked_result / retry_result`, old signatures delegate).
- Tests assert the FK/unique/not-null shape, helper ids, exact audit id for submit, schedule, publish, completed/blocked/retried
  execution, and that two commands sharing a correlation id keep distinct audit keys.

### 7. Finding 8 - concurrent lineage appends both committed (BE03b E3)
- Fix: `cms_lineage_head_observation(entry, locale, audience) -> {id, version}` (unlocked read, null/null when absent).
  `cms_publish_revision` observes it right after target resolution (before the entry/authority/schema/review locks and before
  the reservation; not part of the request hash); `cms_execute_publication_schedule` observes it before position 0. The append
  (`expectedHead` optional on the helper so existing helper callers/tests are unchanged, always sent by the two commands) compares it
  under the lineage lock BEFORE `publication_not_active` and raises `publication_conflict` on any difference. Replay is answered
  before any comparison; execute maps the collision to its retry ladder (unchanged mapping).
- Unit proof (pgTAP, `helpers_lineage.sql`, +22 assertions): absent/present observation, wrong id, wrong version, tombstones,
  precedence over `publication_not_active`, malformed observations, chosen audit/outbox ids.
- Race proof (14, 16 rewritten with real barriers): E2a (execution parked before its insert, manual publish BLOCKED on the review
  row with `blockedBy` evidence -> manual `publication_conflict`), E2b (manual parked, execution blocked -> `failed_retryable`, its
  retry completes as version 2), E3 (two publishes parked at the ACTUAL reservation insert with the head unchanged -> exactly one
  commits, one `publication_conflict`, committed reservation count +1 only, one event/audit, winner key replays with no effect, a
  later new-key publish is version 2), 016 L1-L3 (helper level, shared observation). RED = mutation A (comparison deleted, i.e.
  the old behaviour) and mutation B (observation moved after the review lock) - see Verification status.

### 8. Finding 5 - settings advisory-lock inversion: premise already removed by 20261010130000
- The follow-up analysis (checkpoint `8b114e15`) predates the E7 repair `1f041a8d` (`20261010130000`). Since then
  `cms_settings_snapshot` is a read-only lookup (no insert, no lock) and the owner key `cms.settings_snapshot:<owner>` is taken
  only at the tail of the five ordinary writers, after `cms_complete`, followed by nothing but the snapshot insert. The decision
  rebuild, publish, schedule, execute, claim, invalidation and the manifest/preflight helpers never touch it, so the
  decision-vs-publication inversion cannot occur. No production fix was possible or needed; I did not invent one.
- Defined position (documented in the 17550 header, DEC-157-consistent): the key is a LEAF of an ordinary write transaction,
  after every canonical position (0,1,2,4) and never before 5/6/7.
- Proofs: static guard `phase_02_slice_11_rpc_publication_lock_order.sql` (6 assertions: only the five writers name the key, each
  after `cms_complete`, no row lock after it, lookup is read-only, no decision/publication/execute helper takes an advisory lock
  except the lineage lock) - passes. Race 014 E8 is the exact three-session interleaving with the real owner key HELD by a third
  session for the whole scenario: reviewer A's approval parked holding the review row (blockedBy = its own gate only), reviewer D
  and publisher P (expectedVersion 2) queue on that row (blockedBy includes A, never the settings holder); after release D is
  `review_not_open` (rolled back, key reusable: fingerprint unchanged on retry), P commits version 1, only A's decision remains
  (review `approved/2/1`), the settings holder was never waited on. The fixture is `lk-1` in `090-race-fixture.sqlinc`.
  Mutation C (re-introduce the inversion in `cms_frozen_dependencies_status`) must fail E8 - see Verification status.
  This finding has no RED (nothing to fix); the E8 witness assertions are what would have been RED before 130000.

## Files changed by this lane

Migrations (in place): `20261005017550` (header comment only; function bodies untouched, md5 pins of 130000 unaffected),
`17590`, `17635`, `17640` (cross-ownership, above), `17700`, `17720`. New forward migrations (md5-pinned, anchor-patch style with
source and `pg_get_functiondef` md5 of the installed bodies, metadata/ACL/owner preservation and exact inverse checks):
`20261010162000_cms_schedule_audit_event_ids.sql` (helper overloads), `20261010162100_cms_schedule_publication_lapse_and_audit.sql`,
`20261010162200_cms_execute_publication_schedule_conflicts.sql`. The pinned bodies were reconstructed offline (17710/17740 + the
140000/151000/153000 patches) and verified against the existing pins (`7e6119b1...`, `a11ba874...`, `e85fdaf1...`) before use.

Tests: `supabase/tests/phase_02_slice_11_rpc_publication_{execute,schedule,publish}_refusals.sql`, `..._evidence_audit.sql`,
`..._lock_order.sql` (new), `phase_02_slice_11_rpc_review_evidence_audit.sql`, `phase_02_slice_11_helpers_lineage.sql`,
`phase_02_slice_11_rpc_publication/090-race-fixture.sqlinc` (+READMEs), races `014`, `016` (+README rows),
`tests/postgrest/phase-02-slice-11-publish.apispec.ts`, `apps/worker/src/cms-editorial/publication-committed-refusals.test.ts` (new).

## Test titles (old -> new), for the evidence ledgers

execute_refusals: `control: twelve due schedules are claimed and executing` -> `control: eighteen due schedules are claimed and executing`;
`absent proof, a failed checker run, stale proof (over 60 s) and proof bound to other rows (DEC-158(c)) each make the schedule failed_retryable with attempt_count 1 and no reason, never a pass [P2-S11-AC-083]` ->
`absent proof and a failed checker run (unavailable accessibility) each make the schedule failed_retryable with attempt_count 1 and no reason, never a pass [P2-S11-AC-083]`
(the stale/bound cases moved to the two new `... typed conflict preflight_evidence_stale ...` / `... consumes no retry state ...` titles);
`the first retry waits 15 s ...` and `each retry is audited without an actor ...` keep their titles but now cover the two unavailable schedules;
`a blocked outcome appends no lineage row ...` keeps its title (event count narrowed to the three entries because the xr-head seed publishes once).
schedule_refusals: `a stale frozen manifest returns the committed-refusal envelope {kind, reasonCode, details} carrying only the CURRENT dependencyHash [AC-021]` ->
`... {kind, reasonCode version_set_stale, details {}} (BE03b E1: the command answers 409 version_set_stale) [AC-021]`;
`the invalidation committed (review invalidated at version 3, one review-changed event) and no schedule exists [AC-111]` -> `the invalidation committed with the reason dependency_changed (...) ...`;
`a counted approver whose standing cms.reviewer grant lapsed fails the revocation category: 422 preflight_failed (reviewer_authority_changed) [AC-096]` -> four titles beginning `a counted approver ... is found lazily ...`, `the reviewer-authority invalidation COMMITTED ...`, `the reservation is completed with the committed refusal (status 422) ...`, `an exact replay returns the same committed refusal ...`.
publish_refusals: the same three changes (AC-033 for the envelope title, "published nothing").
publication evidence_audit: `the row is owner-scoped, carries the proof's input hash and joins the command's audit record by correlation id` -> `... is keyed to the exact audit event of the schedule command and has no outbox event ...`;
`the row references the publication's outbox event and joins its audit record by correlation id` -> `... and is keyed to the exact audit event of the lineage row`;
`control: a completed, a blocked (...), a retried (failed run), an unproven, a stale-proof and a failed-category execution` -> `control: ... an unproven and a failed-category execution, and a stale-proof execution refused with the typed conflict (DEC-158(c))`;
`a completed execution's row names the publication event; the blocked and retried outcomes (no event) carry distinct effect ids, one summary per outcome` -> two titles (`... names the publication event and is keyed to the exact audit event ...`, `the blocked and retried outcomes (no event) carry no outbox id and each summary is keyed to the exact block or retry audit event ...`).
review evidence_audit: columns title (now lists `audit_event_id,outbox_event_id`); recorder title (now the recorder and the two audit helpers); `the row references the command's outbox event` -> `... in its own optional column`;
`the row carries the correlation id of the command's audit record, which is how the summary is joined to it` -> `the row is keyed to the exact audit event of the command (audit_event_id), not by a shared correlation id`;
`one summary per command event: the event id is unique` -> `one summary per audit event: the audit event id is unique`.
apispec: `[CMS-03B-09] a stale frozen manifest is the COMMITTED refusal: HTTP 200 on the wire, 409 dependency_changed with the current hash for the browser, the review stays invalidated and a replay answers the same 409` ->
`... 409 version_set_stale for the browser (BE03b E1), the review stays invalidated dependency_changed and a replay answers the same 409`.
Added: AC-080 x5, finding 13 x3, finding 6 x2, lapse x4 per command (+1 apispec), exact-audit helpers and FK x7, correlation reuse x2,
lineage observation x22, lock order x6, Worker committed refusals x6, races E2a/E2b/E3/E8 and 016 L1-L3 rewritten.

## Decisions for the orchestrator to log (not logged by me)

- AC-090: stale frozen set at 07/09 = committed 409 `version_set_stale` (details `{}`), review invalidated `dependency_changed`; 05/06 unchanged; executor keeps `blocked approval_invalidated`.
- Lapsed counted approver at 07/09 = committed refusal `preflight_failed` (422, 17-entry summary) + `reviewer_authority_changed` invalidation + schedule cancellation.
- Lineage head observation: optional `expectedHead` on the append helper, mandatory in the commands; a conflict outranks `publication_not_active`.
- Summary table keyed by `audit_event_id` (unique FK), `outbox_event_id` optional.
- Finding 5: premise removed by the E7 repair; leaf position documented; no code.

## Verification status

(updated below when the queued main-stack run completes)
