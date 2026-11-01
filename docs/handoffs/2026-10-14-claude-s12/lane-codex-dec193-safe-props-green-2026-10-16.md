# DEC-193 selected effective props — forward GREEN candidate

Date: 2026-10-16. Author: native gpt-6.1-sol / ultra.

Status: source frozen, author **UNRUN**. This is a GREEN implementation
candidate against root-observed writer RED, not a passing-runtime receipt or a
Slice 12 completion claim. Root owns staging, SQL execution, regression/race
verification, and independent review.

## Exact released scope

- NEW `supabase/migrations-wip/dec193/20261016041600_cms_detached_tree_safe_props.sql`
- NEW this report.

No existing WIP, promoted migration, test, README, producer, public API, grant,
or preflight implementation was edited. The separate 415 author owns a disjoint
forward migration; root will integrate only after both sources freeze.

## Actual antecedent evidence, supplied by root

The completed security run emitted 369 assertions: 345 PASS, 24 FAIL, no SQL
abort. Root's TAP identifier is `093005-281219`; SHA-256:

`e1a81c2f203f5fc65f48301f3c28b7859c9b5cc91981205faea8657b986fce9a`

Twenty failures exercise real public-writer behavior: selected unsafe values
in four JSON forms and safe-first/unsafe-second mutation/no-effects oracles.
The old writer accepted those selected unsafe values. Safe arbitrary-JSON and
safe `theirs` choices that discard an unsafe alternative already passed.

The other four failures are preflight prerequisite failures with
`P0001 DEPENDENCY_UNAVAILABLE`. They do **not** establish a preflight-security
RED. Preflight GREEN remains HELD for separate diagnosis; 416 does not repair
or make an acceptance claim for that path.

These are root-observed pre-edit results, not an author rerun.

## Contract and existing-policy seam

- BE03b editorial publication line 1807 requires the database security
  category to rerun existing executable/unsafe-link rules over stored values
  and block props. Line 2056 supplies the write-time security boundary.
- BE03c composition line 1487 selects explicit choices simultaneously and
  refuses invalid selected effective props atomically. A discarded alternative
  is not the effective result. Line 1563 preserves exact arbitrary JSON in
  canonical detached-tree nodes, without object coercion.
- Existing `20261005017570_cms_preflight_evaluation.sql:133–187` defines the
  reusable `cms_text_is_executable(text)` and recursive
  `cms_json_executable_leaves(jsonb)` policy. It walks arbitrary JSON objects
  and arrays and checks string leaves; it does not invent reserved JSON keys,
  coerce values to objects, or classify ordinary SQL text as executable.
- Existing `20261016041100_cms_apply_pattern_update_dec193.sql:221–225`
  passes only the selected effective tree and its selected overrides into the
  registry helper. Its existing error mapping and append at line 250 remain
  unchanged. A refusal in a later selected item therefore uses the same
  enclosing RPC rollback boundary; actual rollback proof is root's next run.

## Implementation

416 replaces only `platform_private.cms_detached_tree_registry(uuid,jsonb,
uuid,jsonb)`, preserving its signature, volatility, SECURITY DEFINER mode, and
empty search path. Immediately after resolving `v_props` from the selected
override or selected tree node, lines 101–103 refuse a positive count from
the existing executable-leaf detector with `P0001 VALIDATION_FAILED`.

The old bounded-JSON, registered identity/lifecycle, compiler compatibility,
child topology, subtree depth/node limits, deterministic registry locking,
and registry-tuple digest logic are unchanged. The guard does not inspect
discarded B/T/local alternatives, introduce a new executable-content policy,
change null/scalar/array values, add an aggregate tree cap, or add a write.

`CREATE OR REPLACE` retains the established function owner and ACL. Existing
40800 assigns this function to `wejammin_cms_definer` and revokes API-role
execution. Existing 17570 lines 671–672 likewise assign the detector to the
CMS definer, with API-role revocations at 682–683.

Root's read-only privilege receipt
`/tmp/wejammin-native-receiving-proto-red-BkaHbW/dec193-detector-cms-privilege.log`
contains `t` for the necessary CMS-definer execution privilege. No grant,
schema CREATE permission, ownership change, or private/public API access
expansion is needed or included.

## Static fidelity and freeze

Read-only text comparison confirms exactly one added guard. Removing its
three lines and reversing only `create or replace function` to
`create function` reproduces the entire original 40800 function definition
byte-for-byte, including its existing validation and lock ordering.

The migration has 120 nontrailing-empty lines and no grant/revoke/ownership
statement or persistent write. The original 40800 file is untouched.

| Source | SHA-256 |
| --- | --- |
| Original 40800 registry migration | `348f294c75459b9d7602ddf91baf2cc60db06574e183d17c3f0c65a32421a46c` |
| New 41600 selected-safe-props override | `a3d9fb27976b0c1a68416bfb645542e22d411fd3528fbaf7248f3c28e33fabb2` |

## Validation boundary

Author performed source reading, the supplied boolean-receipt read, and pure
text/hash comparison only. No SQL collection/parser, import, formatter,
test, native database, service, Docker, network, or Git operation was run.

Root still must stage the exact integrated frozen sources, run the 369-case
security cluster and the planned 1315-case/race regression gate, and review
actual refusal/no-effects behavior. The preflight prerequisite and its
separate security proof remain explicitly open. No hosted, production,
publication, copied-snapshot, or complete-slice acceptance is asserted here.
