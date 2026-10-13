# S11 E7 grant-free existing-owned inline write-tail GREEN contract

Status: source-compatible alternative selected for bounded producer design only.
Author/implementation UNRUN; producer cannot start before new writer/lookup QA
actual RED, independent review, canonical receipt and clean pushed QA checkpoint.
Supersedes the DEFERRED new-CMS-helper shape. DEC-163 unchanged.

## Latest strengthened QA prerequisite

Lookup304/54 actual13FAIL41PASS. Writer17/239/120/172 now plan70,
actual10FAIL60PASS; added immediate pre/post-B01 witnesses, post-B05 image
equality, explicit existingHash and full canonical-row-derived completed201
receipt. Every original68 title retained; independent source review no bounded
mismatch. FreshCI0/flock/pre-middle-postReset0; three fixture APIs25PASS23.64s.
Mandatory full gate and clean pushed checkpoint still required before author.
Freeze all124 SQL assertions and three repaired API paths during production work.
Root owns actual baseline/changed-function catalog and functional fault proof.
Do not prewarm fixtures to evade legacy lookup refusal or soften existing tests;
root classifies any source-backed stale fixture after genuine producer execution.

## Exact author scope

Root owns execution, DB, formatting, Git, canonical flush/compile and validation.
Native author apply_patch only. Sole NEW forward migration:
supabase/migrations/20261010130000_cms_settings_write_tail_lookup.sql
Production hard300/target250 physical lines. Do not copy five large function bodies.
No other migration, source, test, docs, account, provider or authority changes.

## Verified local privilege seam, not production proof

FreshCI0/sharedflock root catalog: all five existing writers and settings ABI are
wejammin_cms_definer-owned, NOLOGIN/non-BYPASS/nonsuperuser, SECURITY DEFINER,
search_path='', VOLATILE, ACL only owner EXECUTE; API roles EXECUTE false.
CMS schema CREATE=false. A new helper ownership transfer failed42501 in rollback;
no new grants authorized. Do not retry or create a new production function.

Root rollback-only self-CREATE OR REPLACE of all six existing objects succeeded
with definition/owner/ACL/attributes/args/returns unchanged, then ROLLBACK.
Log: .lane-logs/parent-s11-e7-existing-owned-replace-probe-20261010.log.
This verifies replacement permission only, not the changed behavior.

## Existing ABI lookup-only

Replace EXISTING platform_private.cms_settings_snapshot(uuid)->jsonb, same owner/
ACL/signature/SECURITY DEFINER/search_path. Preserve null INVALID_REQUEST/P0001.
Retain existing app.cms_rpc context setup: FORCE RLS direct callers require it.
Evaluate existing cms_publication_settings_effective_values(owner,clock_timestamp)
and independent cms_jcs_sha256; SELECT matching stored owner/hash ordinal.
Missing matching row deliberately replaces the old post-insert INTERNAL_ERROR
branch with established DEPENDENCY_UNAVAILABLE/P0001 per DEC-163. Noncurrent
rows do not supply virtual ordinal. Return exact {version:storedOrdinalText,hash}.
No INSERT, advisory lock, replacement values, partial manifest or new public reason.
Do not impose STABLE or change current volatility attributes. Update current
function comment to lookup semantics; do not edit historical migrations.

## Exact five positive tails, generic completion unchanged

Query actual returned canonical resource.owner_id BEFORE the advisory leaf:
B10 entry_id from cms_content_entries; B01/B02/B04 new_revision_id from
cms_entry_revisions; C04 new_variant_id from cms_locale_variants.
Never derive from owner_party_id, response JSON, request/acting_party or stale entry.
Missing impossible canonical resource/owner fails closed with existing INTERNAL_ERROR.

Evaluate effective values at clock_timestamp, JCS hash and registry version before
leaf. Acquire existing owner advisory namespace cms.settings_snapshot:<owner>
hashtextextended(...,0) only AFTER all canonical/CAS/review/audit/outbox/idempotency
effects and before RETURN. No later canonical row locks or resolver reevaluation.
Always INSERT active/version1/maxOwnerOrdinal+1/existing registry/hash/values,
ON CONFLICT(owner_id,snapshot_hash) DO NOTHING, then plain matching read-back.
Reuse actual stored ordinal; missing after insert is existing INTERNAL_ERROR/P0001.
Do not skip INSERT for an existing hash: QA requires duplicate-hash tail faults.
Use nested DECLARE/BEGIN/END block so existing declarations/body remain unchanged.
All objects fully qualified; same transaction/GUC context, no new role/security seam.

Only exact positive201 complete→return anchors are changed:

- cms_create_entry: complete(reservation.id,entry_id,201,response),18040:431–432.
- cms_create_revision: complete(...new_revision_id...),18045:647–648.
- cms_resolve_conflict: complete(...new_revision_id...),18050:713–714.
- cms_restore_revision: complete(...new_revision_id...),18055:560–561.
- cms_author_locale_variant: complete(...new_variant_id...),20261002167000:326–327.

All earlier completed replays, failures, B01 conflict409 at464–465, authorization,
CAS/MFA, response construction, audit/outbox and generic cms_complete unchanged.
No initializer trigger, CFG hook, public operation, ordinal seed or backfill.

## Guarded transactional rewrite and fingerprints

Use project-local guarded dynamic rewrite precedent:
20260922162000_ac265_immutable_github_oidc_subject.sql1–96.
One compact fixed-map SQL tail template is permitted. pg_get_functiondef /
CREATE OR REPLACE never bypasses authorization or makes text proof runtime proof.

Resolve each exact regprocedure; assert expected CMS owner/ACL/SECURITY DEFINER/
search_path/args/return and baseline prosrc fingerprint before rewrite:

- cms_create_entry(jsonb): 4b3ff16fc36a2cf6e11353e3b2b313c6
- cms_create_revision(jsonb): f0bfdac1be9fee6f14873698bae2c953
- cms_resolve_conflict(jsonb): 26ede79aefc8a7fcb2ee5330dc617af1
- cms_restore_revision(jsonb): 551996cb945b4b09d634e19d39710a59
- cms_author_locale_variant(jsonb): 9521f3178fc52bc9cfe05dc57a9a3e2c

Require exactly one full positive201 anchor and zero new marker. Reject missing/
unexpected/mixed states rather than best-effort matching or blind replacements.
Fixed function→resource table/variable mapping only; no caller-controlled SQL.
Perform all replacements transactionally; re-read each actual definition and
assert old anchor0/new marker1, unchanged identity/owner/ACL/security/config/
return/volatility, unchanged409 and replay bodies. Lookup replacement metadata
must also be preserved. Never edit pg_catalog or function owner/security/grants.

If idempotent reapply is supported, accept only complete all-five expected marked
state plus exact lookup shape/metadata; any mixed or unexpected body fails closed.
Do not silently skip an unrecognized body. Fresh migration application is required.

## Source and acceptance constraints

Normative BE03b1813–1819 / global lock order1706–1726. Source:
20261005017550 effective-values64–107/current snapshot113–191;
20261005017050 snapshot schema/guards/unique/immutable/FORCE RLS25–98.
Current snapshot guard checks max+1 before conflict arbitration; healthy duplicate
attempt passes guard and preserves existing row. Snapshot fault is test-only.
Exact source checks cannot prove dynamic migration/runtime safety.

Actual all-five positive tails, replay/negative controls, duplicate reuse, genuine
submitted-review causal fault/whole-transaction rollback, lookup RED→GREEN and
metadata/catalog controls are mandatory. No claimed private helper mutation proof.
Canonical owner-field mutation sensitivity remains unproven (authorized divergent/
NULL public witness impossible); preserve exact source/resource-owner obligation.

Old manifest/preflight/settings QA embeds cold-read insertion and may become stale.
Author does not edit old QA. Root separately cascades only demonstrably stale
oracles against DEC-163 with changed titles listed, legacy missing fail-closed and
normal-write initialization proof retained. Existing read-noeffects API not stale
until normal public writer actually initializes a snapshot; no prewarming.

Delivery FROZEN/UNRUN, sole claim released, line cap, exact baseline/anchor mapping,
metadata strategy and proof limits. Root validates migration and all mandatory
gates under freshCI0/sharedflock; acceptance stays0/122 until genuinely proven.
