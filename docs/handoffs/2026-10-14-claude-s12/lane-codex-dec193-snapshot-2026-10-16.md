# DEC-193 detached snapshot storage — authored GREEN, execution UNRUN

Native author: `gpt-6.1-sol` / `ultra`, agent
`native_registry_green_20261016`. Worktree:
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.
Primary checkout remained read-only. Exact five-path claim precedes release in
`.memory/pipeline/progress/slices/phase-02-slice-12.md:2413-2415`.
The follow-up three-path witness correction is claimed at 2473-2475: only
`000-fixture.sqlinc`, `010-storage.sqlinc` and this report. Driver/README and all
other files remain frozen for this correction.
The two-path guard-isolation correction was claimed at 2509-2511:
`010-storage.sqlinc` and this report only; the fixture is also now frozen.
That correction is complete. The current three-path GREEN claim at 2525-2527
permits only new `supabase/migrations-wip/dec193/20261016040000_cms_detached_tree_storage.sql`,
new `supabase/migrations-wip/dec193/README.md`, and this report. All tests and
other production/migration paths are frozen.

Status: authored and frozen, **UNRUN**. No SQL parser, test, formatter, build,
DB, Docker, network or Git mutation performed by author. Only the new unpromoted
storage migration below is authored; existing production/migrations stay frozen.
Current correction execution is UNRUN; prior root diagnostics below do not clear
it and no author-run or GREEN receipt is claimed. Static source
inventory: eleven positive storage probes, 71 malformed/row-inconsistent
candidates, existing producer prerequisites and guard/catalog controls. Each
file is below 400 physical lines. Root owns migration GREEN and independent review.

## Exact owned paths

- `supabase/tests/phase_02_slice_12_dec193_snapshot.sql`
- `supabase/tests/phase_02_slice_12_dec193_snapshot/000-fixture.sqlinc`
- `supabase/tests/phase_02_slice_12_dec193_snapshot/010-storage.sqlinc`
- `supabase/tests/phase_02_slice_12_dec193_snapshot/README.md`
- This report.

All existing tests/helpers, production, migrations, trackers and other lanes were
read-only. The reused fixtures remain byte-unedited by this author release.

## Normative and actual-source basis

BE03c `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md:1563`
locks the exact envelope/node keys, 1–512 preorder nodes, active-parent stack,
complete anchored ASCII segments, namespace/address uniqueness and consistent
ancestry/order, canonical block identity/version, exact effective props, nullable
storage and row-mode/props/root-identity CHECK. It expressly excludes aggregate
128-key/256-KiB/depth limits. Line 1487 requires complete effective content,
whole-node overrides and provenance-only treatment only for nonnull snapshots;
1536 preserves the plain detached NULL pin/checker distinction. Lines 1545/1563
confirm later `carried_from_id` and snapshot carry-over; neither is required by
this first storage lane, per root's narrowed release.

Per-value bounds come from actual code, not a new snapshot policy:
`supabase/migrations/20261014020000_cms_pattern_forest_validators.sql:74-79`,
`20261014110200_cms_pattern_placement_request.sql:91-99`, and
`20261003130100_cms_json_bounded_typed_expansion.sql:17-71`.
`packages/contracts/src/api-error.ts:13-59` independently retains 262144 bytes,
eight containers, 128 object members and 128 array items, including scalars/null.
The authored-pattern 64-prop cap cannot become a snapshot-wide/object-only rule:
whole-node overrides admit the bounded JsonValue shape.

Actual source prerequisites are reused, not replaced: signed block registration
in `phase_02_slice_12_pattern_definition/000-fixtures.sqlinc:11-20`; guarded,
assigned draft entry in `phase_02_slice_12_pattern_placement/000-fixtures.sqlinc:30-65`;
governed creation/activation at 158-214; real CMS-03C-02 request/runner and
persisted-response oracles. The existing derived-draft admission trigger remains
enabled (`20261005018060_cms_composition_instance_guards_derived_state.sql:21-42`),
as do table FKs, write guard and immutable guards
(`20260927290000_cms_composition_authority.sql:72-132`).

## Mutation-sensitive boundaries

`000-fixture.sqlinc:3-38` creates/activates a leaf and its referencing parent,
places the actual `/shared1/hero` root in detached mode with a legacy override,
and witnesses its positive lineage pin and signed block receipts. The source's
NULL snapshot and existing props are retained without requiring future storage.

`000-fixture.sqlinc:86-147` makes guarded INSERT candidates from that full row
using `jsonb_populate_record`, observes `to_jsonb(stored row)`, and compares the
complete expected row. Its catalog-ordered typed projection assigns the raw
`$2::jsonb` argument to a real `detached_tree` field, bypassing JSON-to-record
conversion for that field only. The actual typed row then feeds INSERT directly,
so JSONB null stays distinct from SQL NULL. The pre-CHECK field's `IS NULL` and
`jsonb_typeof` are captured for an explicit, non-skipped premise at
`010-storage.sqlinc:166-170`, contrasting the JSON-null negative and legacy
SQL-NULL positive. Missing-column projection reads only existing fields and
avoids the dynamic future-field read; the distinction premise fails rather than
silently passing or aborting. Missing `detached_tree` is ignored on input, so minimal
and large positives fail the persistence assertion rather than aborting setup.
Before storage exists, malformed snapshots are expected to append and fail their
exact `23514`/no-effects assertions; this is a static RED prediction, not a run.
Database exceptions are captured; invalid INSERTs roll back in a subtransaction.
Success also requires exactly one append,
byte-identical prior rows and unchanged other full-row stores.

`010-storage.sqlinc:19-67` covers minimal/root-JSON-null and legacy SQL-NULL
cases; 512 complete ordered nodes with scalar/null/array props, namespaces and
aggregate size above 256 KiB; a valid closed-branch preorder; 11 block levels
and descendant addresses over 512 characters with 64-character segments; and
the existing per-value maximum member/item/depth/byte limits. Exact row equality
holds node order and every effective value; it does not accept a summary/hash
in place of the tree. Synthetic child identity upper bounds exercise pure
storage grammar only, not registry admission.

`010-storage.sqlinc:69-160` separates child key/block/version/required-field
negatives from root-row mismatch negatives so root identity cannot mask those
checks. Other candidates isolate strict outer keys, JSON null versus SQL NULL,
missing props versus null, zero/513 nodes, root/parent types and ordering,
closed-parent reopening, duplicate addresses, ancestry conflict and a closed
reference namespace reopened between siblings. Adjacent common namespaces are
positive. The final controls require the actual `DIRECT_CMS_TABLE_WRITE` guard
and unchanged full legacy source row.

## Witness correction after independent BLOCK

Root reported the initial promoted-only diagnostic as INVALID/incomplete:
81 assertions, 13 failures, then a polymorphic unknown-literal abort. Those
counts are not a complete RED receipt and are not author-reproduced evidence.
Independent review additionally found that JSON-to-record conversion could
collapse outer JSONB null to SQL NULL, and root-only malformed-node probes could
be masked by the independent root-identity check.

The exact correction preserves raw JSONB/SQL NULL as described above, casts only
the former `010-storage.sqlinc:112` `to_jsonb(E's12pd.block\n'::text)` literal
(now 116), and retains the original root probes while adding null and array
children after a fully valid matching root at 85-88. All other bounds, cases,
real-producer prerequisites and no-effects assertions are unchanged. This
correction was frozen author-UNRUN; subsequent root diagnostics are recorded below.

## Guard-oracle isolation after the complete diagnostic

The existing root-run [TAP](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.lane-logs/alt-staged-none-021725-2227554.tap)
SHA-256 `bfa97a5ccbbc561afb3700f598982e811c5e5793595ffcaf033adb4a31baf285`
contains 228 tests, 71 PASS, 157 FAIL, Wstat 0, no setup abort. Static readback
confirms signed/governed/placement prerequisites 1-42 PASS. Missing-storage
assertions fail, but test 227 is a false exact-token oracle: the real-target,
gate-disabled probe receives `VALIDATION_FAILED`, not `DIRECT_CMS_TABLE_WRITE`.
This complete diagnostic is therefore limited by that one oracle; it is not
the final corrected RED and does not authorize production GREEN.

Actual `20261005018060_cms_composition_instance_guards_derived_state.sql:32-39`
judges an existing target's derived state before the later write guard. Its
effective-state SECURITY DEFINER/RLS context with the write gate disabled is
not an appropriate isolation fixture for that later guard. Production behavior
and both exact tokens remain unchanged.

`010-storage.sqlinc:171-187` now creates one labelled missing-revision UUID and
proves that no revision row has that ID. The same otherwise-valid snapshot and
the same `revision_id` patch must reach `23503` with the gate enabled, then
`P0001`/`DIRECT_CMS_TABLE_WRITE` with the gate disabled. Both helper calls retain
the full-store no-effects oracle. The absent-parent case naturally bypasses
only the admission guard's target-exists branch: no guard is disabled, no token
is relaxed, and every valid-target positive and other snapshot probe is intact.
This two-file correction was frozen author-UNRUN; the subsequent root RED and
independent correction readback are recorded below.

## Final corrected RED and bounded storage GREEN

Root's final promoted-only [TAP](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.lane-logs/alt-staged-none-022531-2276279.tap)
SHA-256 `bb1e7aa6f37ad30f1eb31c5d0b5958d7c9e0faaa92153ce9f6577ecbefad012e`
contains 231 tests, 75 PASS, 156 attributable missing-storage failures, Wstat 0,
no setup abort. Static readback verifies all prerequisites 1-42 and isolated
write-guard controls 225-231 PASS. Root reports independent final correction
CLEAR. This supersedes the earlier incomplete and false-oracle-limited runs as
the GREEN prerequisite; the author did not execute any of these runs.

New migration `20261016040000_cms_detached_tree_storage.sql:10-156` defines one
pure `IMMUTABLE SECURITY INVOKER` boolean predicate, empty search path, with no
table/registry/authority reads. Existing pure `cms_exact_keys` and per-value
`cms_json_bounded(...262144,8,128,128)` are reused. Explicit type guards precede
array operations and numeric casts; numeric integer fields never coerce strings.
ASCII length/initial/forbidden-character checks reject partial or newline keys.
Only numeric representation/range exceptions map to false; no blanket exception
handler hides unrelated permission/infrastructure faults.

The open block-index stack closes completed subtrees. Reconstructed address
prefixes reject duplicate blocks, crossing an undeclared block ancestor,
claiming an already-used namespace as a later block, and reopening a closed
reference namespace. Active adjacent namespaces and the original array order
are preserved. No whole-snapshot key/byte/depth, authored 32-child or private
descendant-address cap is imposed. Each props value alone uses existing bounds,
with scalar/null/array/object values copied unchanged.

Lines 158-176 transfer only the new predicate to the existing CMS definer,
revoke API-role/public EXECUTE, and assert its existing helper EXECUTE closure
without changing helper ACLs. The temporary schema-CREATE grant is revoked in
the same transaction, following the existing pattern-validator ownership seam.
Lines 179-188 add the nullable, no-default column and validated CHECK: SQL NULL
passes as legacy; JSONB null fails the predicate; nonnull trees require detached
mode, empty row props and exact JSONB root/row identity equality with no unsafe
root numeric cast. No existing row is backfilled or updated.

The new README documents isolated `dec193` staging and exclusions. The predicate
is available to future producers but only the CHECK calls it in this release;
actual producer sharing, registry admission and effective-tree generation are
not implemented or proved here. No other WIP/promoted migration, producer,
render, copy, digest, public API, fixture, test or tracker changed. Migration
syntax, application, 231-case GREEN and security/independent review are UNRUN by
author and remain root gates before promotion or the next producer claim.

TDD/testing/adversarial review shaped assertion-first boundaries and isolated
negative probes. Migration-management/minimal-surgical guidance kept GREEN to
one forward nullable storage addition and pure shared predicate; clean-code
guidance kept validation stages and intent explicit without extra helpers.

## Root next step and limitations

Current isolated GREEN command; not executed by author:

```sh
bash docs/handoffs/2026-10-14-claude-s12/lanes/lane-db-alt-staged.sh \
  /home/rob/.codex/worktrees/phase2-slice12/WeJammin dec193 \
  supabase/tests/phase_02_slice_12_dec193_snapshot.sql
```

The existing runner serializes CI/quiet/ALT/reset locks. Root owns actual 231-case
GREEN and independent migration/security review before promotion or later
producer work. No promotion is performed here. Current migration SQL syntax and
storage behavior remain unverified; the final RED does not prove shared
producer use, registry admission of synthetic
values, resolution choices, render/preflight, carry-over, rollback under injected
producer faults, concurrency, hosted behavior or full-slice acceptance.

## Frozen source fingerprints

SHA-256 of authored files; counts are static physical lines, not runtime tests.

| Path under `supabase/tests/` | Lines | SHA-256 |
| --- | ---: | --- |
| `phase_02_slice_12_dec193_snapshot.sql` | 23 | `c5a824c32019c81a979b2725a1251988d44186b631b518a19e5e5c1d5c1fe62d` |
| `phase_02_slice_12_dec193_snapshot/000-fixture.sqlinc` | 147 | `18dac919b01aeda7b3eda497b592bfe60d7d7e977ce5d5d2f0dc6e0c77ce1378` |
| `phase_02_slice_12_dec193_snapshot/010-storage.sqlinc` | 191 | `7e5b61804fb3790c60e1c5f8034098071f56f79ecdd01115381b8203b6584498` |
| `phase_02_slice_12_dec193_snapshot/README.md` | 54 | `c04f3988f609aac9fde796db3e887dcf7de580c8afbfdbee086ddebb68dc12f8` |

New unpromoted GREEN sources (tests above remain frozen):

| Path under `supabase/migrations-wip/dec193/` | Lines | SHA-256 |
| --- | ---: | --- |
| `20261016040000_cms_detached_tree_storage.sql` | 194 | `ac3ec91d42b72fee2e5b4420c15c8cda8a33990483d5dfad3500448d343d3371` |
| `README.md` | 35 | `1655efdb71f449e2e6ded72d5e03a17993baff08c4c2dcd415315e677752e7e7` |

This report's final hash is supplied to root separately (no self-referential hash).
