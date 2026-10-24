# Native pattern-definition RED authoring

Status: ONE root-authorized ALT first-RED diagnostic completed on 2026-10-13;
see the receipt below. Missing pattern storage/producer RED was observed after
passing S09 setup controls. No GREEN, acceptance checkbox or completion claim.
Earlier authored/UNRUN statements below preserve the pre-release history; they
are not the current execution status. After this single diagnostic, only this
report changed. No retry, SQL repair, new migration, race or canonical gate ran.

## Source boundary

BE03c denotes `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`.

- BE03c:174,395–397,1361,1425,1447,1612: CMS-03C-12 request/resource,
  authority, graph, storage and named producer.
- BE03c:215–219: parent definition CAS, per-owner uniqueness and version-1
  lineage id; a successor carries its exact parent's `supersedes_id`.
- BE03c:1304 and 1425: typed refusal reasons and DEC-188's immutable definition
  version with a separate lifecycle counter.
- `packages/contracts/src/cms-composition/pattern-version.ts:38`:
  `expectedVersion` is a nullable decimal version string.
- `packages/contracts/src/cms-composition/pattern-node.ts:20`:
  literal forest bounds, sibling keys, props bounds; expansion is a server rule.
- Tracker `.memory/pipeline/progress/slices/phase-02-slice-12.md:930–934`
  identifies AC-100–104; :1023 identifies AC-193; :1041 identifies AC-211.
  Prior AC-014/186/247 tags were unrelated and were removed from this suite.

The producer name `cms_create_pattern_version` is explicitly normative at
BE03c:1447. Its public `jsonb` wrapper and flattened SQL request/If-Match
envelope are derived adapter choices, following `cms_define_template`
(`20260927200000_cms_template_authority.sql:360–521`). No private function
signature is asserted. Raw P0001/message pairs follow current CMS transport:
generic legacy tokens plus closed lowercase reasons, as used by
`20261013300800_cms_submit_governed_review.sql` and
`apps/worker/src/cms-composition-production-template-errors.ts:10–44`.
HTTP status/catalog/headers require their own adapter tests.

## Authoring changes

1. First-version helpers receive SQL NULL and emit JSON null; successors keep
   the required decimal string. Dedicated fixture controls assert both types.
   A literal `'null'` remains only as an intentional invalid-request case.
2. SQLSTATE, message, response and DETAIL are captured separately. Refusals
   compare SQLSTATE `P0001` and exact message tokens separately. Full no-effect
   assertions additionally require that exact refusal, so a missing RPC cannot
   earn a passing atomicity assertion merely by doing nothing.
3. Snapshots include complete rows from 20 stores: patterns, composition
   instances, governed reviews/dependencies/decisions/assignments/schedules,
   block definitions/lifecycle/release nonces, content types/versions/artifacts,
   capability grants/events, memberships/actor grants, audit, outbox and
   idempotency. The snapshot helper is volatile so the after-read obtains a
   fresh statement view. It does not hash or count away in-place mutations.
4. Removed synthetic block/type/artifact activation inserts and fixed evidence
   placeholders. Prerequisites use S09 owner initialization and context binding,
   real grants, signed CMS-03A-05 block registration, and genuine type
   create → dry-run → worker seal → submit → assign → decide → activate.
5. Sixty-five distinct active types separate accepted 64 from rejected 65;
   duplicates and an inactive type have separate refusals. This adds 65 real
   S09 activation chains to the eventual serialized run; setup is not proven.
6. First and successor outputs assert strict safe field membership, JSON
   numeric/string versions, state, actual tree, count, server digest, stored
   hash, derived owner/creator, one completed reservation, one audit append,
   no outbox event, stable lineage, exact parent and unchanged full prior row.
   Replay compares the identical captured request, exact resource and full
   unchanged effects. Resource equality, lineage, immutable-row and no-event
   checks require non-null resources or successful calls; NULL-equals-NULL and
   absent-producer no-ops cannot satisfy those invariants. Conflicting replay
   and corrected-key retry are authored.
7. Added CAS/header/required/unknown-key/reserved-key/digest refusals, and
   confirmed-actor wrong-capability, concealed-owner, anonymous and revoked-replay cases.
   Human-anonymous setup clears JWT subject and every identity/context GUC,
   while retaining the actual service-role transport boundary.
   A real grant/create/revoke/refuse/restore/replay sequence supplies authority
   controls and leaves setup restoration explicit.
8. Added 0/1/32/33 roots, depth 8/9, 512/513 literal nodes, duplicate siblings,
   malformed node/block keys, missing block/version and registered-props errors.
   Block slot depth is 16, isolating the pattern depth-8 cap.
9. A separately signed 65-field registry schema makes props 64 valid and props
   65 invalid specifically at the pattern cap. Mixed-block digest ordering and
   repeated-block deduplication use explicit sorted tuple oracles.
10. Nested positives have executable real governed submission, independent
    assignment/approval and activation prerequisites. Authored checks cover
    draft/incompatible children, direct and indirect lineage cycles, shared
    lineage on separate paths, 512/513 expanded nodes, nested digest and pins.
    Definition version/hash remain stable through lifecycle 1→2→3→4 and an
    activated parent at lifecycle 4 still takes definition 1 as successor CAS.
11. Withdrawn-block setup follows signed supported → deprecated → withdrawn
    transitions, after all other cases. No protected guard is disabled and no
    active pattern is inserted or updated by fixture SQL.
12. Split support files below 300 lines and added extension instructions.
    `s10_rpc_clear_actor` exists at the included S10 fixture's line 47; it was
    not a defect. The new suite uses S09 actor setup instead.

## Effective database-role oracle repair

Independent audit found a privilege-oracle fault in the original
`010-oracles.sqlinc:31–55`: `s09d_session` only sets JWT/session GUCs
(`phase_02_slice_09_dec108/00-helpers.sqlinc:116–132`), so the calls retained the
privileged test runner's effective role. The old anonymous case tested a JWT
marker, not the anon database ACL. The four governed operations in `050` also
inherited that fault through shared `s09d_rpc`. No earlier ACL or transport
acceptance claim is valid from those authored, unrun calls.

Root authorized only the main SQL, `010`, `030`, `050` and this report for repair.
The owned invoker-security helper now captures the prior role setting/user,
allowlists five exact command statements and three database roles, sets the
effective role transaction-locally, and records `current_user` at the call.
It captures only RPC exceptions as product outcomes; role setup/restoration
failures are harness failures. Both the prior role setting and effective user
must be restored before full-row after-snapshots or temp result writes.

The human-anonymous request remains an exact P0001/UNAUTHENTICATED refusal,
with identity cleared but real service-role transport. Separate anon and
authenticated database-role calls require 42501, the actual requested role,
null response and complete unchanged rows. Their no-effect assertion also
requires the named producer to exist and the existing service-role create
control to succeed, so an absent producer cannot count as ACL evidence.
All eight governed prerequisite calls now use the owned role-aware boundary;
all previous lifecycle/hash/pin and success assertions remain. The main suite
adds non-vacuous role/restoration, two ACL-call and eight governed-call controls.

Shared S09 setup helper files were not edited. They still call ordinary producers
as prerequisite fixtures but are not effective-service-role transport proof.
No identities, grants, guards, migrations or shared fixtures were edited.
The repaired suite remains authored and UNRUN, pending independent rereview
and separate root DB release; no GREEN, AC completion or runtime result follows.

## Prerequisites and proof limits

Before classifying any feature failure, the serialized run must establish:

- S09 owner initialization/context binding and both real capability grants.
- Signed block registration and verified props/release receipts.
- All 65 type activation chains, including compiled artifact and real approval
  evidence; the separate unactivated-type control.
- Real pattern create success before replay, successor or dependent graph
  results can be classified. The static migration search finds no pattern
  create implementation. Missing RPC `42883` is the expected initial feature
  failure, after setup passes.
- Required pattern columns and bounded-forest storage. Current foundation
  `20260927290000_cms_composition_authority.sql:43–65` still has the earlier
  object-tree/global-key structure. The later
  `20260927300000_cms_composition_path_and_tree_bounds.sql:38–39` guard
  still rejects array forests. BE03c:1425 and the locked PatternNode contract
  require the forest; these tests deliberately do not normalize it to the old
  shape. Definition JSON reads avoid undefined-column aborts; column and
  storage assertions remain expected RED until forward schema work.
- For nested positives: real CMS-03C-06/08/07/09 success, review approved,
  subject active, exact lifecycle increments. Those dependencies are authored,
  not supplied or proven by this lane.
- The signed deprecation and withdrawal controls must pass before treating
  withdrawn-block refusal as evidence.

Shared S09 actor fixtures explicitly document synthetic auth accounts,
test-human membership provisioning, the other owner's negative-control grant,
and operator release-key configuration where no ordinary producer exists.
This suite does not claim those provisions are production workflows. The existing
setup-only approval-ID SELECT uses `s09d_approval_ids` (`02-chain.sqlinc:208–213,228`)
through `s09d_scalar` (`00-helpers.sqlinc:79–93`). That privileged read helper sets
`app.cms_rpc=true` only around the RLS-projected SELECT, restores the previous
setting on return, and rolls it back with the protected subtransaction on error.
This is an explicitly allowed read-side setup helper, not a mutation guard bypass
or permission widening. The approval IDs still come from actual decision-issued
approvals. No trigger disabling, time-warp, raw review/approval/activation or
legacy receipt mutation is used, and no new write-side flag usage was introduced.
This clarification corrects the earlier blanket claim that no guard-toggle helper
was invoked; no shared source or fixture was changed for the correction.

Remaining coverage limits: no second-owner successful identical-key creation
(the available second-owner grant is explicitly a negative-control fixture);
no props-depth-8/9 producer pair, mixed numeric block-version digest ordering,
registry incompatibility pair, injected mid-write fault, true concurrent CAS/
authority race, or actual composition-placement pin. No HTTP status, request
content-type, rate/deadline, browser, provider, production or accessibility proof.
The authored subset cannot close AC-100–104/193/211.

## Static checks

Owned include targets exist; no owned direct private-table insert/update,
trigger disabling, combined P0001/message comparison or stale AC-014/186/247
tag remains. Parentheses and dollar-quote delimiters balance under a lexical
scan; this is not a PostgreSQL parser. Shared `/tmp/wejammin-quiet.lock`
`git diff --check` exited 0, but these lane files are untracked and that command
does not inspect their content. A separate byte-level whitespace/line-limit
scan covers the owned files. SQL compilation, pgTAP execution, `pnpm db:verify`
and `pnpm validate` remain UNRUN under the explicit lane boundary.

Role-repair readback: all include targets resolve; SQL parentheses/brackets
and dollar-quote delimiters balance lexically; no trailing whitespace. This
does not parse or execute SQL. Main and SQL includes total 703 physical lines;
the largest SQL include is 118 lines. Assertion source sites, not runtime TAP
counts, are main 10, `000` 8, `010` 3, `020` 33, `030` 11, `040` 8, `045` 5,
`050` 22 and `060` 2: 102 total versus 94 before repair. All prior assertion
sites remain; four governed success operands move from shared `OK` to owned
SQLSTATE `00000`. Three new ACL sites expand across two roles, plus five main
controls: 11 additional authored assertions if execution reaches them.
Unchanged SQL neighbors and README retain their pre-repair SHA-256 values.
The pinned Node 22.23.1 / pnpm 11.24.0 report-only formatter check passed; repository
Prettier configuration does not provide a SQL parser. Formatter execution and
the whitespace check use `/tmp/wejammin-quiet.lock`, not a DB-run release.

Independent read-only review completed (`pattern_static_review`, inherited
native `gpt-6-astra`/ultra). Reconciled points: expanded the full-row snapshot
to cover referenced registry/type/authority stores; explicitly cleared anonymous
identity GUCs; retained the locked array-forest assertions despite the old
object-only guard. The reviewer verified snapshot table names, custom helper
resolution, lexical balance and the signed props/lifecycle setup statically.
An initial incompatible-token concern was withdrawn: BE03c:396/1612 expressly
uses `nested_pattern_not_active` for inactive OR incompatible CMS-03C-12 input.
No runtime acceptance follows from this review. Root retains DB-release and
tracking decisions. The next authorized step is static integration review. A later root-released
DB run must use the canonical serialized runner and stop at its first failed
gate; authoring alone is not RED execution evidence.

## SHA-256 manifest

Hashes cover the authored SQL/README bytes, not runtime evidence. This report
is excluded from its own manifest.

| File                                       | SHA-256                                                            |
| ------------------------------------------ | ------------------------------------------------------------------ |
| `phase_02_slice_12_pattern_definition.sql` | `b49207ce069e32a950172f8187ce6691f8e6227516f2e102b576fcf2a4ad2061` |
| `000-fixtures.sqlinc`                      | `e0ca1fcb04ca725a01e2aac8c1b974c64d11cc29413ea22527281d46c1e7c544` |
| `010-oracles.sqlinc`                       | `39af6dd88a72f409f413c9bf59ec562cf4e5e37211f155e62e6fcb35916e8aa0` |
| `020-create-successor.sqlinc`              | `6801d7c3517e60472f9a401c7ded1d5ea1611dd0405cdbf2b2cd2df0942eaaf5` |
| `030-refusals.sqlinc`                      | `bbebc0e63d746be4b9f2582aa28dbbf971efe52ad82e4cc70057118f1d59ec26` |
| `040-graph.sqlinc`                         | `90a0feae0c9bf699e1e3b662b2dea610bfcbd6a7f4182932e9fc9e51b85ae06e` |
| `045-props-digest.sqlinc`                  | `246de71e7d96388d6e21bec9e2a8be7a9391106556a499c421113e935d2cd4e0` |
| `050-nested.sqlinc`                        | `23f6405391d77acd913bf4405bca5df617d97d367c86d3a5783a520b836c276d` |
| `060-block-lifecycle.sqlinc`               | `c82c777e57a8b91206c3bf02b4f6c7ac1d84e7edabe10ded49e595e23246f51c` |
| `README.md`                                | `d76ac146c0123f2a320894e644e4c66c447eb931410d2b76baab92e413866be5` |

## ONE first-RED ALT diagnostic receipt — 2026-10-13

Root separately released this exact command in the Slice 12 checkout, under
`/bin/bash` with login disabled; it was invoked once, with no retry:

```sh
PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH flock /tmp/wejammin-supabase-ci.lock bash docs/handoffs/2026-10-10-claude-s11/lanes/lane-db-alt.sh /home/rob/.codex/worktrees/phase2-slice12/WeJammin supabase/tests/phase_02_slice_12_pattern_definition.sql
```

- Verified Node `v22.23.1`, pnpm `11.24.0`; reset log reports Supabase CLI
  `v2.116.0`. Runner SHA-256:
  `a620fd88909796ad7f680b2ef2e69ff8819958f5f8a38a5a0024270aaac5498a`.
- Outer CI lock plus runner-owned shared quiet, ALT and reset locks; ALT acquired
  at 18:40:38 EDT, reset succeeded at 18:41:06. No lock/reset failure. The ALT
  stack link check passed; no main-stack/race/canonical invocation occurred.
- Runner/pg_prove exit **1**; SQL process Wstat **0**; complete TAP **1..249**,
  **23 passing / 226 failing**. No SQL ERROR/FATAL, bailout or missing-plan
  diagnostic. TAP ended at `2026-10-13T22:41:19.980Z` (log mtime).
- Tests **1–8 pass**: real designer/reviewer grant calls, signed block and
  release/props receipts, all **65** compiled/reviewed/activated type rows,
  successful chain outcomes and a genuine inactive-type control. Additional
  signed props setup **183**, deprecation **240** and withdrawal **241** pass.
  These are prerequisite/artifact controls, not service-role proof for shared S09.
- First failure **9** is missing required pattern storage; **10** is the absent
  named producer. First create **14** has SQLSTATE **42883**, not 00000; later
  diagnostics explicitly say `platform_api.cms_create_pattern_version(jsonb)`
  does not exist. This establishes initial missing-schema/producer RED only;
  dependent CAS, graph, replay, refusal, atomicity and lifecycle behavior is unproven.
- Actual anon/authenticated role controls **118–119** pass, but ACL refusals
  **116–117** receive **42883**, not 42501; guarded no-effect controls **120–121**
  fail. Thus no missing producer is counted as ACL success. Role/restoration
  controls **245–249** pass for invocation attempts only: the human-anonymous
  application refusal is not proven, nor are successful nested activations.
  Both governed submits return P0001 after missing create; assignment, decision
  and activation attempts return 42883. No observed missing-callee 42501 is
  exposed at this stop point; absent producers prevent deeper privilege proof.
- All **13** `202610133*` migration hashes and **10** source/README hashes are
  byte-identical before/after. Root code-freeze reference remains
  `920e252f53e119d735c2dae1128097dd01a1a0daa6037bc0d181955e43e0192b`.
  Before/after migration digest over sorted `sha256  relative-path` lines is
  `3f69b8faf195bebf1ff919fbbe2299aa23b5148affd9744e21f96389e8d370a4`.
  Report stayed `05e2c0a22c140440e6d37e111714ae0b552ef807a63180f6d0e5c0a0d3478c41`
  through the run, then received this authorized report-only receipt.

Artifacts: `.lane-logs/alt-tap-184038-294674.tap` (66,477 bytes), SHA-256
`9ae9e2c5af41fde712f963499d9260afd5b56a2e918f8ebe088cd4c707ae189b`;
`.lane-logs/alt-reset-184038-294674.log` (27,582 bytes), SHA-256
`023d53664ff75f6d0a62ad5e2432fc805937c7037e0aa0b024a2cc2106eaf01a`.
The ONE release is consumed. Hold for root's next decision; no retry, source fix,
additional runtime or acceptance is authorized by this receipt.
