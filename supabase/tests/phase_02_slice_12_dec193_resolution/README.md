# DEC-193 each-choice resolution — test-only RED

Author execution: **UNRUN**. Root owns staging, review and the first actual RED.
No production function, migration, existing test, contract or shared tracker was
changed by this lane. Each file is below 400 lines.

The driver is `../phase_02_slice_12_dec193_resolution.sql`. Its ordinary setup
reuses the signed registry, governed review/activation and real placement helpers.
The pattern-update migrations (`supabase/migrations/20261014140000` through
`20261014140610`) and the DEC-193 detached-tree foundation are promoted, so the
ordinary reset stages them in filename order. The new resolution helper is
intentionally absent at RED; do not create a test substitute or skip its cases.

## Normative sources

BE03c `03c-composition-taxonomy-localization.md:1487` requires every explicit
answer to hold simultaneously under the selected topology; noncollisions still
adopt target changes, highest added/removed frontiers suppress descendant diff
entries, inconsistent complete answers refuse atomically at
`/instances/0/choices`, structural/removed-root `yours` detaches the resolved tree,
and removed-root `theirs` retires with the prior positive pin. Ordinary detach
copies L and admits a newest linked retired pattern-origin row. BE03c:1563 fixes
the canonical parent-indexed 1–512-node snapshot and exact effective JSON values,
without a whole-snapshot key/depth/byte cap. BE03c:303–330 fixes the deduplicated
safe-registry tuple digest. BE03b:1709 requires detached content to affect D5.
The approved DEC-193 propagation scan, items 24–26 and 32–36, forbids whole-L
shortcutting, invented retired-detach refusal, public snapshots and aggregate
materialization refusal. No new product choice is asserted here.

## Proposed private seam

`platform_private.cms_pattern_update_resolve(p_base jsonb, p_target jsonb,
p_overrides jsonb, p_choices jsonb) RETURNS jsonb`, immutable, security invoker,
empty search path, owned by `wejammin_cms_definer`; not executable by
PUBLIC/anon/authenticated/service_role.

- B and T are canonical `cms.detached_tree.v1` snapshots of one expanded root.
  JSONB `null` is explicit absence of that root from an otherwise eligible newer
  target. SQL NULL is invalid, not absence or no-update.
- O is the authoritative address-to-JSON-value map. Missing key and present JSON
  null cannot be inferred from the nullable public `yours` carrier.
- C contains exactly one answer for each actual collision, none for noncolliding
  or suppressed paths. Select all node presence/identity/children/props before
  validating reachability. Do not sequentially patch T or copy L wholesale.
- Output is exactly `{disposition, tree, overrides}`. `linked` returns the resolved
  effective canonical tree and retained target-reachable override map; `detached`
  returns the selected tree and `{}`; `retired` returns JSON null tree and `{}`.
  Caller stores linked content by target pin/overrides, not `detached_tree`.
- No `noop` disposition: identical content from an eligible newer version still
  advances its linked pin. No eligible newer target is rejected by the command
  as `pattern_version_not_active` at `/targetPatternVersion` before this seam.
- Invalid pure inputs/topology use `P0001:VALIDATION_FAILED`. API translation keeps
  established pointers; infrastructure errors are not accepted as semantic RED.
  Authorization, registry authority, pin eligibility, locks, CAS and atomic append
  remain the caller's responsibilities, not facts a pure snapshot can establish.

Every pure case resolves the exact four-jsonb scalar signature and checks its
jsonb return type before a dynamic invocation. Missing signature, wrong return
type or SETOF/procedure mismatch emits an explicit TAP failure inside the case.
There are no skipped cases, setup-time future-function calls or fake outputs.
Current public API calls use the existing capturing harness and are not gated
away merely because the future private helper is missing.

## Files and mutation-sensitive controls

| File                        | Boundary                                                                                                                                                                                                                                  |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `000-fixture.sqlinc`        | Independent literal B/T/L/hybrid snapshots; real signed blocks, governed versions and pre-successor placements.                                                                                                                           |
| `010-pure-resolver.sqlinc`  | Ancestor/descendant selectors; both answer orders and all 24 four-choice permutations; suppressed subtrees; absent/null/equal O; unchanged-props structural choice; 156 changes; >256 KiB; 512/513 hybrid; SQL NULL invalidity.           |
| `020-accept-results.sqlinc` | Actual append/pins/snapshots/retained O; other roots untouched; no implicit added-root placement; exact non-hash public projection; ETag/CAS/history; retired detach; identical newer content; 156-path command.                          |
| `030-inconsistent.sqlinc`   | Two contradictory complete sets and consistent controls; full-store atomicity; exact missing/unknown choice pointers; entry/instance CAS, If-Match, target, authority, concealment, no-update provenance.                                 |
| `040-digests.sqlinc`        | Literal safe-registry tuple JCS assembled independently; hybrid hash differs from both B/T; linked whole-target digest includes an unrelated signed /badge block absent from /panel; D5 sensitivity/order equivalence; idempotent replay. |

The sole direct composition seed is explicitly labelled retired-history input,
copied from a real placed row under the normal write guard with the prior pin.
No trigger, RLS policy, guard or lifecycle proof is disabled. Real inconsistent
API refusals compare every full row in the shared persistent-store snapshot,
including audit/outbox/idempotency and governed/review stores. Retirement does
not prescribe a new tombstone-props representation; its visibility, prior pin,
identity, position and append-only resource are asserted instead.

Expected trees do not read the typed-diff lane or its builders, and no legacy
flat-props/content-hash oracle is loaded. The public response's complete non-hash
projection is checked independently; hash syntax plus equal-content/permutation
and different-effective-content controls avoid inventing a new D5 byte format.
Registry digest hashes are exact independently assembled bytes, not product
hash/closure/resolver calls. Target `/badge` uses already signed compatible
`s12pd.wide@1`; its distinct tuple makes whole-target versus selected `/panel`
hashes observably different without changing any selected tree or choice oracle.
No hosted, concurrency or compiler claim is made.
