# S11 E7 lookup RED sole-file amendment — counter isolation and two witnesses

Status: selected next native QA-only correction; author UNRUN until initial QA
canonical receipt and clean pushed checkpoint. Producer still UNRUN.

## Sole claim and execution ownership

ONLY supabase/tests/phase_02_slice_11_e7_settings_lookup.sql may change.
Root owns all commands/tests/DB/Git/format/canonical flush/compile/validation.
Author apply_patch only; no commands, scripts, DB, runtime, network or other edits.
QA hard400/target350. No migration/helper-ABI/production/grant/role changes.
Read original committed lookup RED brief and this amendment completely.

## Exact initial evidence and limitations

Initial file187/plan32 contains28 local L01–L28 plus four imported S10rpc001
assertions(189,338,375,493). Fresh mandatory gateSQL334files12796runnerassertions
110s: newfile32 alone8fails12–14,26–30 = L08–L10/L22–L26. Missing/noncurrent lookup
currently inserts/allocates snapshots; this is real initial DEC-163 boundary RED.

First focused SQL ran after persistent API11PASS without intervening reset and
failed10 including polluted baseline; not clean RED proof. Fresh reset cleared
those baseline failures. Do not change the legacy-empty baseline assertions.
Fullgate dbVerify1/API+races/dbtypes/validateUNRUN/postReset0/driverclosed.

Finish saysplanned32ran24 after rollback of noncurrent scope containing8 pgTAP
assertions. Runner still counts32. Bookkeeping mismatch observed; exact internal
counter mechanism not source-read. Do not reduce plan/drop assertions/reset the
pgTAP counter or claim QA complete from that broken finish.

Independent P3 gaps: every positive ordinal1 could pass hardcoded version1;
no foreign-owner matching-hash row could let removed owner predicate escape.

## Preserve original complete behavior assertions

Retain all28 original labels/title identities and their exact null/missing/
noncurrent/current-row error envelopes, owner/global complete-row fingerprints,
row counts/ordinal checks and repeat lookup comparisons. No weaker after-rollback
read substituted for pre-rollback effect observation. Null remains independently
baselined; strict exact two-member version/hash object and string types retained.
All seeds remain guarded fixtures, not writer/materialization/activation proof.
Empty registry version1 and JCS values/hash independent assertions remain.

## Counter-safe observation and assertion placement

For each rolled-back fixture/probe capture actual command outcome, complete owner/
global row images and needed counts/hash/ordinal scalars BEFORE rollback via
psql SELECT ... AS unique_name \\gset. After ROLLBACK TO / RELEASE, assert the
captured values with every pgTAP assertion OUTSIDE the rolled-back savepoint.
Use :'name' safe psql literals/casts; never raw unquoted substitution of JSON.
Do not expose auth secrets or add broad diagnostics.

Repo precedent for psql observation: S09evidence_paths:125, evidence_grants:26,
evidence_cms11_14:47. Alternatively existing S10atomicity64–94 illustrates local
subtransaction observations with variables surviving rollback, but this amendment
selects simple psql capture rather than introducing copied materializer logic.
No pgTAP assertion/plan mutation inside any subsequently rolled-back savepoint.
Capture successful old-helper insertion before rollback so no-effects assertions
still fail against old implementation; rollback isolates the next positive seed.

## New stored ordinal witness

Add isolated guarded historical row ordinal1 with valid independent JCS hash and
noncurrent effective_values; then matching current empty[] row ordinal2 for the
same real legacy organization. Existing BEFORE INSERT guard requires strict
max+1 and correct hash; never bypass it or alter registry/resolver.
Call actual cms_settings_snapshot twice; assert exact {version:'2',hash:emptyHash},
only two members/types, repeated exact result, unchanged complete owner/global
rows and no new ordinal. Keep old ordinal1 positive controls as well.
Do not hardcode a fake matching hash or seed synthetic unrelated UUID owner.

Also retain/reuse the ordinal1 positive scope, then append a distinct guarded
noncurrent ordinal2 row. Actual matching current hash must still return exact
version:'1', not MAX(owner.ordinal). Repeat and assert unchanged complete rows.
This mutation witness proves old matching-hash ordinal reuse; the ordinal2-current
case alone would not reject a MAX-ordinal substitution. No CFG/history producer
claim or registry activation follows from these controlled lookup fixtures.

## New foreign-owner matching-hash witness

Use EXISTING real bootstrap-created person party:
SELECT p.party_id FROM platform_private.person_party p
JOIN s10_ids i ON p.party_id=i.value::uuid WHERE i.key='strangerPerson'.
S10rpc001:104–106 derives identity.auth_user_bindings.person_id;
20260901010000:80–83 references person_party(party_id),327–335 inserts both.
Assert exactly one non-null existing party and <> requested h11e7_owner().
No new identity, membership, capability or grant.

Within isolated guarded fixture seed matching empty[] snapshot for foreign party,
while requested organization has no current snapshot. Require exact
DEPENDENCY_UNAVAILABLE/P0001 and unchanged requested-owner AND complete-global
row images, foreign stored row intact, no current requested row/new ordinal.
Actual old helper will insert for requested owner; observe this before rollback.
This is owner/hash lookup separation, not foreign-party command admission proof.

## Plan and delivery

Compute exact plan = four imported assertions + retained28 local assertions +
all new assertion declarations. Keep finish outside rollback scopes and outer
transaction cleanup. No ignore/skip/only or oracle relaxation.
List every changed original label/title (identities retained; observation source
relocated) and new labels, exact import/local totals, caps and source proof.
Return FROZEN/UNRUN and release sole claim. Root reruns isolated SQL from reset,
API11 regression, then full db:verify and conditional validate under CI0/flock.
No GREEN/acceptance/Phase2 claim before actual strengthened proof.
