# S11 native E7 settings lookup RED — test-only brief

State: selected normative QA; author claim UNRUN until root final gate receipt,
live handoff refresh and clean pushed exact HEAD/origin/live-remote checkpoint.
Native author: gpt-6-astra/high. Root runs every command, formatting and gate.
Read/write only selected new test; do not change SQL implementation or old QA.

## Exact write scope

- New `supabase/tests/phase_02_slice_11_e7_settings_lookup.sql` only.
- Physical hard400, target350 after root formatting. Stop before extra paths.
- Do not change existing settings/manifest/schema/private catalog tests, API
  no-effects test, canonical specs, production sources or any migration.

## Locked behavior and primary source

BE03b E7/DEC163 in
`.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1813–1819`:
normal authorized positive write tail materializes;
reads/preflight evaluate current registry and lookup an existing exact hash/ordinal
only; missing legacy owner/hash refuses existing DEPENDENCY_UNAVAILABLE; no inserts,
virtual ordinal or partial manifest. No new code or universal503 policy.

Keep current private ABI `platform_private.cms_settings_snapshot(uuid) -> jsonb`
as the read lookup seam. Existing implementation in
`20261005017550_cms_publication_settings_snapshot.sql:113–164` still records;
that is intentional current RED. Registry v1 stays empty array and exact JCS hash.
No assertion that readonly requires STABLE: preserve existing command-server
instant; prove durable nonmutation, not volatility syntax.

## Reuse / genuine fixtures

Use existing normal test prelude and include-only helpers from
`phase_02_slice_10_rpc/000-helpers.sqlinc`,
`phase_02_slice_10_rpc/001-fixtures.sqlinc`,
`phase_02_slice_11_helpers/000-helpers.sqlinc`.
The existing 001 fixture seeds actual organization/type/legacy entry/revision
without a normal CMS03B revision write. This is a legitimate missing-legacy
settings fixture, not a production backfill or deleted immutable row.
Confirm baseline snapshot count0; do not prewarm or call the recording helper.
The included 001 fixture emits four assertions (189/338/375/493); include those
four in the new test plan. Use the real s10_ids.organization for noncurrent seeds
too, isolated by savepoints, not the older helper's synthetic owner UUID.
Existing `h11_outcome` keeps successful effects and reports exact P0001 refusal,
so after-call fingerprints genuinely catch current insertion.
`phase_02_slice_11_helpers_settings.sql:29–61` provides seed/fingerprint
patterns; define narrowly prefixed pg_temp wrappers locally, no imported test plan.

## Required actual assertions

1. Valid legacy organization, no matching snapshot: exact
   `P0001:DEPENDENCY_UNAVAILABLE`, owner rows and global snapshot fingerprint
   unchanged/empty. Current helper must fail this by success/insertion.
2. Roll back that probe through a savepoint before the independent positive
   control so current wrong insertion cannot mask it; do not delete rows,
   disable guards or warm the helper.
3. Seed one exact valid stored empty-array snapshot using the existing trusted
   test write-context/insert pattern; seed is lookup fixture ONLY, not writer
   proof. Existing matching lookup returns exactly two members
   `{version:"1",hash:EMPTY_ARRAY_JCS_HASH}`, strict JSON member types,
   repeated lookup reuses same ordinal, entire stored row fingerprint unchanged.
4. Valid existing owner with only a valid noncurrent hash row (copy an existing
   typed seed from settings helper tests): exact DEPENDENCY_UNAVAILABLE and
   whole row fingerprint unchanged; no fabricated new ordinal/current row.
   Isolate this scenario through savepoints, never immutable-row deletion.
5. Null owner remains exact INVALID_REQUEST with all snapshot rows unchanged.
   Empty registry/version1/exact hash controls retained, no synthetic CFG key
   activation or resolver weakening. Existing resolver/no-partial test remains.

Labels identify E7/DEC163 and assertion boundary, not full API/production proof.
Use before/after full rows, not counts alone. Catalog/body checks can supplement,
not replace actual calls. Complete plan/finish/rollback; no loader errors as RED.

## Freeze / validation

No commands/tests/Git/network/DB/formatting; no grants/accounts/production changes.
Read primary source before choices. If fixture/helper cannot support the exact
boundary without extra scope or authority, report it; do not invent a weaker oracle.
On completion report selected path, physical lines, exact assertion labels and
source provenance; FROZEN/UNRUN, claim RELEASED. Root actual SQL RED/typed proof,
review, and full gates before producer selection. Existing acceptance remains0/122.
