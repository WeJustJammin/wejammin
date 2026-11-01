# S11 E7 grant-free inline writer-tail RED — amended QA contract

Status: selected next QA design; author UNRUN until current lookup/fixture gate,
canonical receipt and clean pushed checkpoint. Supersedes the DEFERRED new-helper
writer brief, not locked DEC-163. Producer remains UNRUN; no acceptance closure.

## Ownership and scope

Root owns all commands, tests, DB, formatting, canonical memory, Git and validation.
Native author uses apply_patch only; no commands, scripts, network, DB or execution.
Only these NEW QA paths, each400 hard/350 target:

- supabase/tests/phase_02_slice_11_e7_settings_writer_tail.sql
- supabase/tests/phase_02_slice_11_e7_settings/000-writer-helpers.sqlinc
- supabase/tests/phase_02_slice_11_e7_settings/001-writer-requests.sqlinc
- supabase/tests/phase_02_slice_11_e7_settings/002-review-atomicity.sqlinc

Existing lookup RED, all old tests, migrations and production sources are frozen.
Do not create a private materializer helper or test its existence/body.

## Locked behavior and production seam

BE03b03b-editorial-workflow-publication.md1813–1819 is normative:
only normal authorized saved-resource positive write tails materialize settings,
after canonical/CAS/review invalidation/audit/outbox/idempotency and before RETURN.
Exact completed replay and failed commands never materialize; errors roll back all
effects. Reads/preflight look up exact current hash and stored ordinal only.
No migration seed, backfill, trigger initializer, CFG hook, new operation or grant.

Five genuine existing private writer commands / resource tables:

| Operation | Function                         | Canonical returned resource          |
| --------- | -------------------------------- | ------------------------------------ |
| B10       | cms_create_entry(jsonb)          | cms_content_entries: entry_id        |
| B01       | cms_create_revision(jsonb)       | cms_entry_revisions: new_revision_id |
| B02       | cms_resolve_conflict(jsonb)      | cms_entry_revisions: new_revision_id |
| B04       | cms_restore_revision(jsonb)      | cms_entry_revisions: new_revision_id |
| C04       | cms_author_locale_variant(jsonb) | cms_locale_variants: new_variant_id  |

Generic cms_complete stays unchanged. Selected grant-free producer design is a
nested materialization block only after each positive201 completion/before return.
The block always attempts valid next ordinal INSERT, ON CONFLICT(owner_id,
snapshot_hash) DO NOTHING, then reads the existing stored ordinal. Existing hash
therefore still reaches BEFORE INSERT faults, but gains no durable row/ordinal.

## Source-backed world and requests

Use actual existing helper/request conventions, minimal imports/builders, and
count every assertion emitted by imports in plan. S10rpc001 supplies real legacy
organization/resources without an ordinary revision writer. S11helpers001 emits
three assertions (98,124,284) and105–128 binds a real registered editorial descriptor/hash;
this guarded active fixture is not genuine schema-activation proof.

Do not reuse forged repeat(ab/cd) policy binding in S10 fixture/EB requests.
Do not rename/replace cms_editorial_workflow_policy_evidence or weaken a guard.
Use existing real policy-member fixture pattern and applicable checker bindings.
Minimal alternative: real CMS03A01 creation of a schema without no_fallback legal
field is permitted, followed by the same guarded real-policy active fixture binding.
Do not import review000 new actors/grants/forged owner receipt; actual submit uses
existing assigned author/editor authority. Source-read supported fields/locales.
The minimal guarded schema is not actual schema activation or checker E2E proof.
Reuse latest active C04 request/locale configuration conventions; do not activate
settings or invent unsupported locales/accounts/grants.

B02 open-conflict predecessor must be a legitimate guarded legacy fixture, then
actual B01 conflict409, not successful append/create warming settings first.
B04 restore must satisfy actual policy/transform/preflight constraints.
Schema-only CMS03A01 control must be a genuine non-entry/revision command.

## Required actual producer assertions

For each of the five commands, isolate a genuinely absent legacy owner snapshot
using a SAVEPOINT and rollback between positive cases, never immutable DELETE.
Call actual production writer with normal authorized current request. Assert201,
returned canonical row/resource, exactly one canonical owner snapshot, registry1,
effective_values[], ordinal1, independent JCS hash. Other owners unchanged.

Repeat exact request/key: compare complete response/resource JSON and every
snapshot row image including IDs/timestamps/versions/ordinals. No new snapshot.
Separate legacy completed replay: real reserve+cms_complete with canonical
matching response_ref, safeHeaders and request hash, while owner remains absent.
This is controlled receipt provenance, not historical successful-writer proof.
Actual writer replay must not initialize settings; generic completion is not hooked.

Assert B01 conflict409 and unrelated schema command do not initialize settings.
Preserve strict existing typed response/refusal grammar and error code identities.
Do not substitute direct guarded INSERT for normal positive-writer proof.

## Genuine submitted review and causal rollback witness

Use normal successful save, then actual cms_submit_review and real manifest/
checker prerequisites. h11r_review direct INSERT is not submit proof. The normal
save may already initialize settings after GREEN; keep that existing hash.
Install a test-only snapshot BEFORE INSERT fault after genuine open review exists.
Do not rewrite any producer body or add/modify grants, security roles or policies.

The fault must still fire on existing-hash normal append/save under the new
unconditional INSERT. Capture safe Boolean causal checkpoint facts before raising:
canonical/CAS successor exists, prior review is invalidated as required, exact
audit/outbox event exists, and this request's idempotency receipt is completed201
with the actual canonical response_ref. A local exception probe can capture an
exact test-only SQLSTATE/message/Boolean DETAIL, not raw rows/PII or copied logic.
The invoker trigger cannot directly SELECT audit_private.audit_events as CMS.
Reuse existing imported pg_temp.s10_audit_count(action,target), SECURITY DEFINER
with empty search_path (S10rpc000:182–195), rather than a new grant, owner change,
production observer or direct audit read. Verify the actual observer checkpoint;
the source-compatible helper is not yet runtime visibility proof.
This is a causal ordering witness, not just a static source-token assertion.

Assert exact fault identity/checkpoint Boolean facts plus complete before/after
canonical rows/values/relations/review state/audit/outbox/idempotency/snapshot row
fingerprints equal. Positive healthy control must prove fixture is admissible.
After rolled-back fault remove only test-owned trigger/function through transaction
rollback or exact test fixture cleanup, never production trigger disabling.
Initial old implementation may reach genuine submit/recording snapshot yet fail
the injected duplicate-hash tail fault: report that precise RED, not warm submit
as writer initialization. Setup policy/locale/manifest failures are not E7 RED.

## Metadata and honest proof limits

Check five existing writer owners/ACL/SECURITY DEFINER/search_path remain identical;
no new private production helper or API execute privileges. Pure settings ABI
lookup is covered by separate lookup RED; do not reimplement lookup in QA.
CMS role NOLOGIN/nonbypass; anonymous/authenticated/service EXECUTE remain false.

Authorized NULL/divergent owner_party_id versus owner_id witness is impossible:
tenant admission requires owner_party_id=acting_party, authority assignment FK
forces acting_party=canonical owner_id; B10 inserts both equal. Do not bypass
admission, invent a grant/seam or count copied-block/private-helper proof.
Assert actual returned canonical resource owner and exact snapshot owner;
canonical-field mutation sensitivity remains UNPROVEN and source/catalog-bound.
Row rollback equality alone does not prove tail position or lock order; require
the causal checkpoint above and keep global lock-order source checks separate.

## Delivery

Return FROZEN/UNRUN, release all four claims, exact cases/assertion plan/import
counts, source mapping, physical caps and known setup/proof limits. Root executes
actual RED under freshCI0/sharedflock/reset, then mandatory db:verify/validate.
No skip/only, guard weakening, API activation or acceptance/Phase2 closure.
