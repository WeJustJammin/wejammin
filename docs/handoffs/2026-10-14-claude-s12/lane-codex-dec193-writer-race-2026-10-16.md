# DEC193 writer candidate-target race — TEST-only author freeze

Author: native gpt-6.1-sol / ultra. Date: 2026-10-16.
Status: **AUTHOR UNRUN. Root source review, parsing and actual RED remain required.**
Worktree: /home/rob/.codex/worktrees/phase2-slice12/WeJammin.

## Exact claim

Only these four NEW paths were authored under the S12 Dispatch claim:

- supabase/tests/phase_02_slice_12_dec193_writer.race.mjs
- supabase/tests/phase_02_slice_12_dec193_writer_boundaries/090-race-fixture.sqlinc
- supabase/tests/phase_02_slice_12_dec193_writer_boundaries/091-race-session-kit.mjs
- This report.

No old fixture, test, production/WIP SQL, specification, tracker, runner registry,
package/configuration or protected primary file was changed. Source reads,
absolute apply_patch edits and static counts/hashes only. No author imports,
parser, formatter, runtime, tests, DB, Docker, locks, network or Git execution.
TDD/testing-strategist and condition-based-waiting guidance shaped the real
boundary, exact refusal/effect assertions and explicit release protocol.

## Source and normative boundary

BE03c .memory/wiki/specs/be/03c-composition-taxonomy-localization.md:1460 gives
CMS-03C-15 definition locks at position3, :1472 lock-before-write, and :1473 the
typed pattern_version_not_active refusal after a superseded definition wait.

Current 20261016041100_cms_apply_pattern_update_dec193.sql:140-148 collects the
then-current active candidate and its nested closure before the ordered FOR SHARE.
Its :153 calls the planner again; 20261016040900_cms_pattern_update_plan_dec193.sql:
29-30 selects the newest active target again. The requested-number check at
41100:161-162 does not bind this newly selected target to the original locked set.
Source hashes at author freeze:

- 41100: c3f44ef01dedf794fa900807a58d943c7110808ee11467422907c0e1331933d4
- 40900: c605b0f4beb660c89934d59285ba9cf4fdb329ac4ddb65cf859386bdb739e577

No production test gate, trigger, helper replacement, disabled guard, UUID
override, sleep gate or grant is added. This test drives the actual public writer
and governed activation RPCs under their effective service_role using the existing
labelled SQL actor/session fixtures. It is not actual gateway/JWT isolation proof.

## Deterministic schedule

1. Real signed block and reviewed/compiled compatible type use the existing
   pattern-definition fixture. Real CMS-03C-12 V1 activates, real CMS-03C-02 places
   its /hero root, V2 activates, and V3 reaches approved through real submit,
   assignment and independent reviewer approval, but is not active.
2. Verify V1 superseded, V2 sole active, V3 approved; entry2/instance1/pin1; all
   three forests have one block root and no children/nested pins. V1 being
   superseded already is legitimate: a positive target2 control must still work.
3. Prove the same real writer accepts target2 inside SAVEPOINT, then rolls every
   effect back. Before V3 activation a separate target3 control must return the
   exact P0001/token/pointer and leave all full-row store digests unchanged.
4. Holder locks the actual V1/B row FOR UPDATE. It reports its real backend PID,
   transaction ID and B CTID page/offset. Writer requests target3 in another client.
   Observe writer waiting on holder's exact transaction ID and its granted
   FOR SHARE tuple lock on that exact B CTID/relation, plus the actual blocking PID
   edge and names. Both remain live; the holder is idle in its open transaction.
5. B sorts before V2. Since no nested pin exists, observing this B wait places the
   writer at 41100:148 AFTER candidate collection, while V2 is still sole active.
   This is source-bound lock evidence, not a delay-based guess about selection.
6. Third client executes real V3 activation and commits while B remains held.
   Activation locks V3 and current-active V2, not superseded B
   (20261014070400:100-108; 20261014070000:17-39).
   Verify V2 superseded/V3 active and re-observe the SAME writer/B tuple-XID wait
   after activation completed. Snapshot all stores now, including legitimate
   activation effects. Then explicitly COMMIT B in the same still-connected backend.
7. Require exact P0001 pattern_version_not_active and /targetPatternVersion, null
   result, effective service_role/restoration, unchanged instance rows and ALL
   post-activation store digests. A fresh target3 SAVEPOINT control must then
   succeed and roll back, preventing an always-refuse-version3 implementation.

Current defect prediction, not an execution result: the raced writer can return
success, pin3 and entryVersion3 after replanning to the unlocked V3. The harness
prints only that safe outcome summary before the decisive exact-refusal assertion.
An unrelated setup/activation/TAP/lock failure is NOT meaningful RED.

## UUID order without forged identities

CMS-03C-12 chooses its own UUID. B drafts are accepted only below 4000... and V2
drafts only at/above 8000..., proving PostgreSQL UUID order B < V2. Other generated
drafts raise the test-only Z1201 sentinel inside a subtransaction; the COMPLETE
real draft call, receipt/audit and captured helper row roll back before retry.
Each has at most128 samples; exhaustion fails fixture setup. No UUID/state is
edited, no failed producer is swallowed, and activation/placement remain real.

## Ownership, privacy and root execution

No default stack import or container fallback. The runner rejects the protected
primary path, requires the exact root token and exact supabase_db_wejammin_ev,
and rejects a conflicting S10_RACE_DB_CONTAINER. Root must separately stage the
old pattern-updates plus current dec193 WIPs on a freshly reset ALT, and hold
CI exclusive -> quiet shared -> ALT exclusive -> reset exclusive locks.

Root alone may syntax-check with node --check, NEVER import the standalone runner.
After full protocol readback and separate explicit runtime release:

    S12_DEC193_WRITER_RACE_ROOT_RELEASE=2026-10-16-native-writer-red \
    S12_DEC193_WRITER_RACE_ALT_CONTAINER=supabase_db_wejammin_ev \
    node supabase/tests/phase_02_slice_12_dec193_writer.race.mjs

Every psql process is tracked with an unpredictable run application prefix, PID,
bounded connection/statement/lock/idle timeouts and awaited close. Polling100ms is
cadence only; actual pg_stat_activity/pg_locks predicates prove the schedule.
Finally sends ROLLBACK to held sessions, drains children, and if needed terminates
only exact owned application/PID/postgres backends before awaiting TERM/KILL close.
All owned backends must be absent and children reaped before metadata deletion.

Three closed public metadata tables carry actor/base IDs and requests across
sessions. Their post-COMMIT OIDs are captured; cleanup locks all three, rechecks
those identities, then drops only them with RESTRICT in one transaction. A setup
failure without acknowledged ownership leaves ambiguous state for root inspection.
Canonical labelled fixture rows remain; root must reset before another suite.
Snapshots hash complete existing pattern/entry/review/registry/authority/receipt/
audit/outbox row images, plus person_party. No credentials or full private row
images are printed. Actual PostgreSQL barriers, cleanup, valid fixtures, normalized
caps and RED/GREEN sensitivity remain unverified until root supplies receipts.

## Author source manifest

LF lines / SHA256 before root formatting; not parser or runtime evidence:

| Path suffix | Lines | SHA256 |
| --- | ---: | --- |
| writer.race.mjs | 214 | 110a80fbadd6c5026233091f239b22f60f2fa85f573257a093dfcebbeff027db |
| 090-race-fixture.sqlinc | 151 | 2a94dc32ff30e434dd9e01c5636e791da1d683921baeacbbc8821958a556fdda |
| 091-race-session-kit.mjs | 210 | 0f0ae0370b722a3c508efdd2ba34d90b55b0aab6aa06602daffd55f1ed6ab227 |
