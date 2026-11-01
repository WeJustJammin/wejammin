# DEC-193 exact slot/root binding — forward GREEN authored, author UNRUN

Native author `gpt-6.1-sol` / `ultra`, task `native_web_b_review_20261016`.
Root first released these two NEW TEST-only paths through S12 Dispatch:

- `supabase/tests/phase_02_slice_12_dec193_slot_binding.sql`
- This report.

After the root RED receipts below, the current exact three-path GREEN release
permits only new `supabase/migrations-wip/dec193/20261016040400_cms_pattern_slot_exact.sql`,
that directory's existing README, and this report. The test remains frozen.

Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`; protected primary
read-only. Every old test, helper, promoted migration, other WIP, shared
tracker, contract and generator remains untouched by this release. Author ran
only source reads, static filesystem/hash/count analysis and apply_patch edits.
No runtime, test, SQL parser, formatter, DB, Docker, lock, network or Git command
was executed. Status: **UNRUN / FROZEN FOR ROOT REVIEW AND EXACT-SLOT GREEN**.

## Authority and the conforming counterexample

BE03c `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md:1483`
requires a placement slotPath to exist in the revision's template, or `/` on a
template-less entry. Template slots are flat key records
(`packages/contracts/src/cms-composition/template.ts:52-72`; FE03:1790).
The original `briefs/placement-f1.md:3-6` requires naming one of those slots;
the later `lane-placement-report.md:161-167` introduces first-segment matching.
No locked DEC or direct-owner exception authorizing arbitrary nested slot
prefixes was found. DEC-186:2687 in decisions.md specifies concatenation and the
248-octet bound, not such an exception. A normalized request shape alone does
not establish semantic slot existence.

This does NOT make the old GET's shortest-prefix inference safe for conforming
placements. Root identified the stronger counterexample below; it supersedes
the earlier research inference that only invalid nested slot input could be
ambiguous. No new private anchor column is presumed by this test.

| Declared expanded root | Real exact slotPath | Persisted row path | Block identity |
| --- | --- | --- | --- |
| `/a/b` | `/main` | `/main/a/b` | `s12pd.block`, version 1 |
| `/main/a/b` | `/main` | `/main/main/a/b` | `s12pd.block`, version 1 |

The old `pattern-updates/20261014140200_cms_pattern_update_plan.sql:51-69`
accepts an empty inferred slot prefix even for a template-bound row and chooses
the shortest prefix. For the first persisted row it can therefore choose the
SECOND forest root `/main/a/b` with slot `""`, rather than `/a/b` with `/main`.
The target deliberately changes only `/a/b` from title B to title T and leaves
the second root unchanged. Wrong binding consequently loses the real change;
the case does not depend on differing block identities or an invalid slotPath.

BE03c:1242-1249 defines the diff slotPath as the placement slot, while
1485/1487 require exact expanded root addresses, typed B/T values, new roots and
newer-target bulk eligibility even with no changed paths. Those are the public
expected outcomes; implementation storage of an anchor is not prescribed here.

## Fixture and assertion boundary

The 165-line driver includes only OLD Slice 09 signed-registry/identity and
Slice 12 pattern-definition, placement and pattern-updates RPC helpers. It does
not include the new typed-diff fixture or any `s12df_*` expected-value builder.
Existing guarded entry/revision/assignment provisioning remains fixture setup,
not a claim that CMS entry authoring produced those records. The inherited
membership and release-principal seams retain their existing fixture labels.

- Lines 26-37 create and independently govern active leaf-B, leaf-T, nested-A
  and base versions. Nested references expand to exactly the two roots above.
- Lines 41-56 create real templates and assert that the main template stores
  exactly one flat `main` slot. Lines 58-68 place through actual CMS-03C-02 and
  compare the two real persisted same-identity rows, pins and forest positions.
- Lines 72-75 use a fresh assigned entry, still-active base pattern, fresh key
  and current CAS to require `VALIDATION_FAILED` with exact `/slotPath` DETAIL
  for `/main/more`. The existing refusal helper compares all captured full
  stores. The case has no collision with the conforming placement's revision.
- Lines 77-98 distinguish template-less `/` from templated `/root`, with real
  positive placements and reciprocal `/root`/`/` refusals. This prevents using
  `slot_key = root` alone to invent the GET's actual placement prefix.
- Lines 103-111 activate a real v2 target: only the first expanded root changes
  B to T; every placed row remains pinned to its real v1 provenance.
- Lines 116-143 build four independent complete expected public bodies. Root
  addresses, props, child arrays, slot, pin, target and eligibility are literals.
  Only generated source instance/revision IDs come from fixture metadata; no
  actual response or production view/plan supplies expected values. LEFT JOIN
  plus an explicit four-source premise prevents missing fixtures skipping cases.
- Lines 145-162 call the actual public GET as service_role and compare strict
  full bodies plus full-store immutability. Targeted assertions require `/main`
  and typed `/a/b` B-to-T for the first row, with the second row unchanged.
  Actual requested/call role and restoration are also checked for all four GETs.

The four read cases are conforming main-first, main-second, template-less-first
and templated-root-first. Their expected no-new-root list is empty; none of
this target's root key chains is new. The unchanged second root remains bulk
eligible because the target is newer, without inventing a changed path.

## Root receipts before the exact-slot correction

Root reports the actual OLD-GET slot run: 119 assertions, 109 PASS, 10 FAIL,
Wstat 0 and no SQL abort. Supplied TAP SHA-256:
`ee150f305e8716672ba92085cc2fe7816127a2dfae185bd908c27a8efe9962e4`.
This is root execution evidence, not an author-run result. It supersedes the
initial author-only static predictions and preserves the old-GET RED boundary.

The root [three-suite integration TAP](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.lane-logs/alt-staged-pattern-updates+dec193-032647-2632118.tap)
was subsequently read as data and its SHA-256 verified:
`17af29b32a812c18bafe330e34c8da3274228be918816a0bd284eb9bf3e7a1fc`.
It contains 609 assertions, 605 PASS and exactly four FAIL, no SQL ERROR/FATAL:
storage 231 PASS; typed diff 259 PASS; slot binding 119 with only 56-59 failing.
Those four are the `/main/more` SQLSTATE, exact VALIDATION_FAILED token, exact
DETAIL and full-store no-effects assertions. The new three-file GET lane fixes
the conforming read binding, while promoted placement still admits a path
which the flat template does not declare. This receipt does NOT execute the
new exact-slot migration below, and is not claimed as 609 GREEN.

## Minimal exact-slot forward migration

`20261016040400_cms_pattern_slot_exact.sql` clones the function definition from
current promoted `20261014110300_cms_insert_pattern_instance.sql:33-246`.
The promoted file remains byte-unedited, SHA-256
`a9a8942a0d0391382c277f9b7ec18efba15f5690a35d8415f0352d9d918fbce6`.
Within that complete function, exactly one predicate is replaced:

```sql
-- Before:
slot.value->>'key' = v_slot_key
-- After:
v_slot_path = '/' || (slot.value->>'key')
```

The old/new predicate each occurs exactly once. Replacing the new expression
back with the old one yields the ENTIRE promoted function definition byte for
byte, not merely an equivalent parsed body. The extracted original definition
SHA-256 is `f799950c58d995c8801a20217a8dced882ce4e4d691d79d337a1d89782ad0d16`;
the new definition is `8fab1b1b3fc55cae94a6dba29e9e41a62a5708a64aa0ffc0fcc618646ec07cf3`.
This static assertion was computed from the saved files without importing or
parsing/executing SQL.

The identity/ACL precondition at lines 10-29 requires the existing CMS-owned
SECURITY DEFINER, VOLATILE private identity, its empty search path, and no
anon/authenticated/service_role execution. CREATE OR REPLACE retains owner and
ACL. The file contains no GRANT, REVOKE, ALTER FUNCTION owner or helper change.
The unchanged definition retains first-segment `slot_key` storage, every
validation step/order, lock, authority check, CAS, reservation/replay, registry
digest, row allocation, entry/review/audit effects and response. Template-less
`/` and templated `/root` behavior are untouched. No new metadata, selected-root
placement, copy or mixed-choice resolver is introduced.

The 246-line migration and README are author-UNRUN. Root owns full source and
independent security review, actual application and a new 609-case GREEN under
the existing ALT lock order before any promotion. Existing permissive nested-
slot positive tests are frozen; an oracle correction cascade requires its own
root review and separately released claim. No author validation is implied by
the pre-correction root receipts. The SQL test itself ends with rollback and
disables no trigger, RLS policy or constraint.

## Remaining limits

These tests do not implement or prove selected-root placement, retired-path
reuse, arbitrary legacy nested-slot recovery, accept/detach resolution, carry
or restore copying, carried_from_id, detached-tree render/digest/checker
receiving, race/isolation, Worker/Web/HTTP behavior or full-slice acceptance.
The actual read binding can be corrected without this test deciding whether
the implementation uses metadata or reconstructs from the exact admitted slot.

TDD/adversarial-review guidance shaped the independent conflicting-root
counterexample and adjacent controls. Supabase/migration/security guidance
kept real protected RPCs, real governed patterns, unchanged guards and explicit
fixture-only seams. Minimal-surgical guidance confines the forward producer
change to one predicate; normal runtime verification is held by root's restrictions.

## Static freeze fingerprint

| Frozen/new file | Physical lines | SHA-256 |
| --- | ---: | --- |
| `phase_02_slice_12_dec193_slot_binding.sql` | 165 | `504d80e87d5d598105161e55c76ef46e6380dc5096b523a7bcbd6245d612d795` |
| `20261016040400_cms_pattern_slot_exact.sql` | 246 | `1e53c53a565bbb1009c0b6255e2d4b80884a1cb1aca8a9bf5508c4926bb4b0c0` |
| `migrations-wip/dec193/README.md` | 109 | `bde1047ff2d83a3cc4b6d4797b9fc0be8e6912a079e683649b194ac56fd1d7d6` |

This report's final hash is supplied separately, without a self-reference.
