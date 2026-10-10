# S11 workflow read no-effects ordinary-write baseline fixture cascade

Status: selected only AFTER actual E7 producer initialization; next author UNRUN
until first producer full gate, canonical receipt and clean pushed checkpoint.
Root commands/tests/DB/format/Git/canonical only. Native apply_patch/source reads
only; no execution/network/DB. Sole claim:
tests/postgrest/phase-02-slice-11-read-workflow-noeffects.apispec.ts
Hard400/target350. All other QA/production frozen.

Actual producer first focus: lookup54PASS/writer70 68PASS2observerfail, metadata7
exact/no grants. This API fixture now stops at its pre-read count assertion:
expected0, observed1. BEFORE the read, seedDraft already uses normal production
B10/B01 saved-resource writes; DEC163 BE03b1813-1819 now correctly initialize the
canonical owner snapshot. Old baseline ABSENT and after ABSENT oracles are stale.
Do not preseed/backfill/warm lookup, delete snapshots or weaken a guard.

Change only that original leaf's two .toBe(0) expected snapshot counts to .toBe(1),
with accurate assertion messages/comments and header describing the existing
ordinary-write-initialized single owner snapshot. Keep same title:
[CMS-03B-15] a first eligible draft workflow read on a fresh isolated assignee org writes no effect
Retain actual canonical owner-row derivation, fresh isolated assignee (no owner
receipt), status200, strict workflow resource parse/non-null preparation and
ENTIRE unfiltered14-group before/after exact equality unchanged. Keep both count
assertions (one before AND after), no dropped oracle/partial match/count filtering.
The first eligible read must preserve every existing settings row field and all
other durable effects; full snapshotDigest already compares whole row groups.
Legacy missing/current/noncurrent/foreign lookup semantics stay proven separately
by frozen54; do not turn an absent legacy lookup into a successful read.

Return FROZEN/UNRUN/released, exact changed title (retained), count/message/comment
edit list and source-backed normal setup mapping. Root actual no-effects runtime
required; do not claim old blocked read passed before this repair.
