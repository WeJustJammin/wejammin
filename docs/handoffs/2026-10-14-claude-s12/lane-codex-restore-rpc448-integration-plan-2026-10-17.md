# Restore448 integration plan — HELD, source only

Native root `gpt-6.1-sol` / `ultra`. No448 author or runtime release here.
445–447 authoring and seven-path relation QA are separate bounded claims.
Locked BE03b1723–1741 covers every relation target created OR carried, target
entry+caller assignments at2 before definition3/schema4. The old race012
comment that carried relations are not reauthorized is not the contract.

## Actual baseline and guarded amendment

Actual509 post-E7 private restore body SHA256
`a8e0b1e886c5ba79e33965224e4938f9fbbecc702082bb6de8915679b7528a81`,
MD5 `b326ae0f547874039e8f410861f27554`,27517 bytes. Native source inventory
reconstructed this by applying130000's E7 tail to18055; root live catalog
already confirms the body SHA. Root independently reconstructed the exact
27517-byte body from those two immutable files: SHA/MD5 match live baseline,
and the textual inverse recovers the complete pre-E7 body. All integration
anchors must still be checked before amendment. Do not use an older
12400/pre-E7 body or rewrite the complete public/private RPC from a stale file.

Exact unique anchors in the reconstructed E7 body:

- Declarations: `  response jsonb;\nbegin\n` (18055:65–66).
- Early pass: comment `-- A restore needs exactly one active schema version`
  (18055:212), AFTER authority/source lineage, reservation/exact replay, CAS,
  current-draft and source payload-hash checks119–210; BEFORE schema selection
  and lock214–228. Relation2 precedes composition planner3.
- Remove the complete OLD late entry-only target lock pass365–374; retaining
  it after schema4 is not an acceptable duplicate safety check.
- Copy: between revision INSERT and first field-value INSERT, unique
  `  );\n  insert into platform_private.cms_entry_field_values(` (417–418).
  Use source_row.id, new_revision_id and EXISTING snapshot_time, not a new clock.

Real locals: actor_id is AUTH UUID, acting_party_id is owner organization;
author_person_id is NOT the lock-helper actor parameter. Existing plan_row is
a schema migration-plan row, not the new composition planner's result.
Planner/copy must remain outside the template-only raise_exception catch at
338–349. That catch maps failures to template_incompatible and would wrongly
swallow an injected copy failure. Private restore has no outer exception catch;
preserve unexpected faults and existing public deadlock/CONFLICT behavior.

Capture OID, complete pg_proc metadata except permitted prosrc change, exact
definition, ACL and separately captured comment. Require expected body digest,
unique anchors and exact inverse; preserve metadata/OID/comment after patch.
Retain E7 tail, replay-before-CAS, concealment/authority, schema/chain/translation,
source-bound template, taxonomy, review/head/conflict handling and both existing
event/audit effects. No extra per-copy events/review invalidation or broad catch.

## Position2 target visibility: implementation choice under review

Only target IDs from the VERIFIED immutable source relations are candidates;
no request-supplied target can gain a lock. Self target is already entry0.
Precheck every external target before locking any, then process sorted unique
UUIDs using final16200 cms_lock_relation_target(actor_id,acting_party_id,id),
which takes entry FOR SHARE then the caller's target assignments, without a
late general authority rescan. Recheck visibility after each actual wait.
Use existing migration_chain_incomplete for refusal; no new reason/status.

Alternatives considered:

1. Source schema's declared target-type lookup before2.
2. Actual target entry's real content-type key passed to the existing visibility
   helper11600, leaving destination-schema translation/projection/type/count/
   expected-version checks with existing cms_restore_relations_resolvable
   after4 (10500:558–641).
3. Early unlocked active-destination-schema lookup to derive target-type rules,
   followed by later schema recheck.

Root selects2 after the independent source-backed challenge STATIC CLEAR:
IDs originate only in real verified source rows,
the helper still proves actual same-owner active target/type and caller's real
author/editor read authority, and no new stale-source-field restriction or
early schema read is introduced. Destination validation remains unchanged.
Source rows do not store a target type, and10500:443–451 deliberately leaves
relations to the destination resolver. The source-declared-type alternative
would impose a new stale-source restriction. Conditions of clearance:

- Reread the actual target content_type_id→type_key AFTER each final162 lock
  wait; do not reuse the unlocked key. Entry content_type_id is not immutable,
  even though the type key is. A stale key could incorrectly refuse restore.
- Retain the existing10500:577–582 total-source-relation count bound BEFORE
  any target lock: more than512 is migration_chain_incomplete. Per-field or
  position bounds do not establish a revision-wide bound. This moves the
  existing refusal earlier; it does not invent a new cap or public reason.

Independent review was source-only; it does not prove actual concurrency.

## Gates still open

Real service-role public create/append/restore positive and unreadable-target
refusal; exact no-partial-store oracle; invisible target cannot be a lock lever;
assignment/lifecycle loss across actual target wait; caller-first target and
assignment writers wait until restore commit; target-first schema NOWAIT
discriminator proves position2 rather than old late locking. QA must establish
fixture readability/visibility premises, exact PID/blocker/row ownership and
actual commit effects. No sleep or generic wait-event acceptance.

After genuine TEST RED and independent TEST/design review, root may release a
new monotonic448 amendment. Production source review, strict contracts/808+
behavioral tests, affected regressions and real races still precede canonical
`pnpm db:verify` → `pnpm validate` and tracking completion.
