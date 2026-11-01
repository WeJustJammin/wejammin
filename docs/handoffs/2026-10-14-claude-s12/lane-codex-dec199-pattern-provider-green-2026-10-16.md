# DEC-199 pattern provider GREEN implementation handoff

Author status: UNRUN. This lane authored source only; no SQL, parser, runtime,
formatter, database, Docker, network, or Git command was run. Root owns the
first staged reset and execution. The external currentness RED log remains the
root-reported 501-test run (`061e58c3...`, 877/752 pass and 125 fail, no
abort); the later transactional candidate run was 927/852 pass and 75 fail,
with three concrete 031 SQL-NULL failures and no abort. These are root-observed
runtime findings, not this author lane's acceptance evidence; seven late
PC-D02--08 failures remain dependency-unavailable diagnosis, not isolated
provider acceptance.

## Normative derivation

DEC-199 requires recursive live nested-pattern activity and the existing
case-insensitive immediate parent-to-child compatible-type rule. Missing,
inactive, or incompatible nested pins use `nested_pattern_not_active`; root
activity remains `pattern_not_active`; content or registry drift remains
`pattern_digest_changed`. A non-null canonical `detached_tree` owns its local
block identities and digest and never reopens retained pattern provenance.
SQL-NULL linked and legacy detached rows retain live pin checks. Manifest
provenance includes direct canonical/live pins, never nested IDs.

## Authored paths

* `supabase/migrations-wip/dec193/20261016044000_cms_pattern_registry_digest_readonly.sql`
  creates the exact `(uuid,jsonb) -> text` SQL/STABLE/SECURITY INVOKER private
  tuple fold. It deduplicates reachable blocks, sorts by C-collated key and
  numeric version, uses the latest lifecycle, and performs no lock or write.
* `supabase/migrations-wip/dec193/20261016044100_cms_pattern_live_pin_reason.sql`
  checks owner/lineage/version/root activity, recursive nested activity and
  type containment, then root content hash and full registry digest.
* `supabase/migrations-wip/dec193/20261016044200_cms_pattern_active_digest.sql`
  selects newest heads before filtering live states, enforces exact direct
  manifest membership by pinned version-row identity, keeps canonical trees
  provenance-blind, deduplicates live pins, counts canonical bad rows, merges
  frozen-hash drift, clamps at 1000, applies root/nested/digest precedence, and
  converts unexpected faults to `unavailable/provider_unavailable/0`.
* `supabase/migrations-wip/dec193/20261016044300_cms_revision_manifest_currentness.sql`
  adds revision-aware currentness, requiring the provider pass and delegating
  unchanged strict one-argument manifest currentness with only a local empty
  `patterns` projection. The wrapper is VOLATILE SECURITY INVOKER under the
  existing CMS permission closure. It amends only the unique frozen-status call
  with full source, inverse, OID, pg_proc-attribute, and comment guards.
* `supabase/migrations-wip/dec193/20261016044400_cms_preflight_pattern_provider.sql`
  inserts registry version 2 (`pattern`, owner slice `slice-12`, database,
  `cms.pattern.active_digest`, v1) and inserts one guarded evaluator dispatch
  branch before the shared generic-key guard, then installs and guards the row
  in the same transaction. Other categories/branches are untouched.

All five SQL paths verify CMS ownership, empty search path, expected language,
volatility/security mode, return shape, and denied EXECUTE for anon,
authenticated, and service_role without broadening grants. Existing caller
permission closure is required; no late pattern/block locks or new transport
errors are introduced.

## Frozen source ledger (author lane)

| Path | Lines | SHA-256 |
| --- | ---: | --- |
| `20261016044000_cms_pattern_registry_digest_readonly.sql` | 90 | `9f19f42e1ef91c5913aa306614ddc2a9c77543b89be2c9e896358c8905105a42` |
| `20261016044100_cms_pattern_live_pin_reason.sql` | 116 | `5793e3e4841cc086cad2f6ccf9ecc68e83751f2b3c5b73b3d9a69d479ba3be0c` |
| `20261016044200_cms_pattern_active_digest.sql` | 170 | `db89e9880b7d4a2271cd7579f7f74ddc0abcf866aca60aea9c26e6704022b8d8` |
| `20261016044300_cms_revision_manifest_currentness.sql` | 96 | `25cf8a81d1ac6010fd5de1f82dc21d3bab87dfc9728a3cf76cd61c8428817d58` |
| `20261016044400_cms_preflight_pattern_provider.sql` | 89 | `0303359a136fc58d688fdac076b25e818494d4504e343673ad33e67c865d3c23` |

No acceptance, hosted, concurrency, race-linearization, or external-gate
claim is made by this author lane. The staged SQL runner, currentness suite,
dependency-fault substitution, and downstream contract/fixture cascades remain
root verification work.
