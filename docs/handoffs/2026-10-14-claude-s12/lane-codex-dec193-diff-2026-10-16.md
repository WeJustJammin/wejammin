# DEC-193 typed update-diff — authored GET GREEN, execution UNRUN

Native author `native_dec194_race_red_20261016`, `gpt-6.1-sol` / `ultra`.
Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`; protected primary
read-only. The exact six-path Dispatch claim precedes release in
`.memory/pipeline/progress/slices/phase-02-slice-12.md:2534`.
The later diagnostic-context correction is claimed at 2566 and permits only
`010-node-values.sqlinc` plus this report; all other files remain frozen.
The current GET GREEN claim at 2594 permits only new 40100/40200/40300 WIPs,
`supabase/migrations-wip/dec193/README.md` and this report. All tests, the old ten
WIPs, public wrapper, writers and snapshot foundation are frozen for this release.

The original TEST-ONLY release authored these NEW paths:

- `supabase/tests/phase_02_slice_12_dec193_diff.sql`
- `supabase/tests/phase_02_slice_12_dec193_diff/000-fixture.sqlinc`
- `supabase/tests/phase_02_slice_12_dec193_diff/010-node-values.sqlinc`
- `supabase/tests/phase_02_slice_12_dec193_diff/020-diff.sqlinc`
- `supabase/tests/phase_02_slice_12_dec193_diff/README.md`
- This report.

Every old test/helper, WIP, promoted migration, producer, resolver, contract,
transport, tracker and other lane remains unedited by this release. No runtime,
parser, formatter, tests, DB, Docker, locks, network, Git or promotion command
was run. Source/hash/count analysis uses context-mode; edits use absolute-path
apply_patch. All results below are static design/readback, not actual RED/GREEN.

## Authority and actual-source basis

DEC-193 in `.memory/wiki/decisions.md` selects author-decided structural changes,
explicit added-root placement, removed-root retire/local-copy outcomes and full
detached materialization. The owner-approved scan
`.memory/wiki/specs/audits/propagation-scan-2026-10-15-codex-dec193-choice.md`
preserves every explicit choice, admits representable positive provenance
no-update rows and retains standalone null-pin refusal without fabricating pins.

BE03c `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md:1487`
defines props + block identity + ordered expanded child addresses, highest added/
removed nodes once with descendants suppressed, collision precedence
removed_root -> structure -> props, slot/new roots, history/provenance and
newer-empty-path bulk eligibility. Line 1563 defines append-only row states,
positive pattern provenance and nullable detached-tree storage. Public contract
`packages/contracts/src/cms-composition/pattern-update-diff.ts:30` defines strict
NodeValue; path/resource members are at 38/88, and newer-empty-path bulk at 154.
The contract retains 128 paths, 262144 bytes, up to 512 child
addresses/new roots, positive int32 block version and no fabricated public pin.

Actual staged RPCs are already defined, not future identifiers:
`pattern-updates/20261014140100_cms_pattern_update_nodes.sql`,
`20261014140200_cms_pattern_update_plan.sql`,
`20261014140400_cms_get_instance_update_diff.sql` and its `140410` public wrapper.
The legacy plan constructs chain -> props values at 75 and computes props-only
collisions around 139-148; the reader resource at 75-83 omits
slotPath/newRoots/collisionKind and requires at least
one changed path for bulk eligibility. These are predicted meaningful DEC-193
assertion failures, not authority to change those production files.

The real pattern producer's expanded count excludes reference wrappers and sums
nested block counts (`20261014020400_cms_create_pattern_version.sql:219-230`).
Thus 15 references to 32 leaves plus one to 31, under one parent, legally yields
512 block nodes and 511 actual children; the case is not a 513-node invalid input.

## Fixture and oracle design

The driver reuses existing Slice 09 identities/chain/signed registry and Slice
12 governed pattern/placement fixtures with two real compatible types. It
includes shared RPC helpers, NOT the large legacy shared world or its stale
props-only expected-response helpers. Positive pattern versions are created,
submitted, independently reviewed, approved and activated through actual RPCs.
Placements use CMS-03C-02 before/after activation so their distinct pins are real.
The additional block version is registered through the signed producer; both
compared versions must retain release and props-attestation receipts.

`000-fixture.sqlinc` builds independent complete NodeValue/path/envelope values
from literal declared topology. Only immutable row metadata supplies generated
IDs and instance versions; expected pins and targets are explicit operands.
The comparison retains every strict field and ordered child array. It sorts
only paths/newRoots sets, since their iteration order is not a new requirement;
it never fills a missing/malformed array. Actual response values are never used
to construct expected props, identities, topology, collisions or byte length.

`010-node-values.sqlinc` checks typed base/theirs (including null absence), local
override `yours`, equal-to-base versus JSON-null override, block version and key
changes without silent adoption, changed/reordered/nested expanded children,
structure over props and removed_root over both. Added and removed two-node
subtrees each appear only at their highest changed-presence path. A removed
instance root suppresses its descendants. Added top-level/nested roots are listed
separately with the actual /main slot. A newer target changing none of /quiet's
paths remains bulk eligible and still lists new roots.

The depth-eight real pattern has a 65-character stored row root but 455/520
character expanded diff/child addresses. A second real pattern reaches the
512-block cap and returns all 511 children from sixteen authored references,
in numeric forest order, not bytewise path order and not truncated to 32.

`020-diff.sqlinc` uses explicitly labelled guarded append-only scan/history,
retired/draft/superseded and detached-copy outputs. It checks historical active
AND pending rows against a live pending head, legacy detached NULL versus valid
materialized detached copy, retired/non-live states and current pin. Every such
no-update response retains real positive provenance. A separate labelled
standalone row proves the null-pin refusal has no fabricated response. Real v3
activation proves newest active targeting without changing the unanswered v1
pin; incompatible active v2 and unactivated draft v2 are separate no-update
controls. No production guard, RLS, constraint or trigger is disabled.

Actual role harness calls compare complete before/after rows of every captured
pattern/composition/registry/governance/authority/idempotency/audit/outbox store
for every read and refusal. Hidden and absent instances must produce identical
refusals with no metadata; visible unassigned actor is denied. Anon/authenticated
ACL probes run as those SQL roles, not claims alone. Every recorded call must
restore its prior SQL role and leave full stores unchanged.

## Exact size controls

Four changed branch props plus 124 changed leaves produce exactly 128 complete
typed paths and succeed. A subsequent actual target also changes the root props,
producing exactly 129 and requiring P0001 diff_too_large with /instanceId DETAIL
and unchanged full stores. Children remain structurally unchanged in this pair.

The byte pair uses one node with a 130000-character base title. Calibration is
from the independent COMPLETE expected typed resource plus immutable instance
metadata, not a provider response (which currently lacks the new fields).
An ASCII target title fixes the expected resource at exactly 262144 canonical
UTF-8 bytes; the actual successful resource must match that full object and
measure exactly 262144. One more character makes the complete expected object
262145, requiring the exact typed refusal/no-effects result. The small 1000-
character target is a separate positive control. No whole-snapshot limit is
introduced; these are public diff wire bounds only.

## Root execution and limits

### Incomplete first diagnostic and scoped RLS-context correction

Root's first staged [TAP](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.lane-logs/alt-staged-pattern-updates+dec193-025355-2446040.tap)
was read and SHA-256 verified:
`0f233bf8ec0af145b1b1e39045d2f19d13f04f9ca2fc7901bcdb55b461098d8f`.
It contains 104 assertions, 92 PASS and 12 typed-diff assertion failures, then
an abort at the direct expansion premise (former `010-node-values.sqlinc:98`):
`nested_pattern_not_active`, Wstat 768/exit 3. All df-fan2 real create/governed
submit/assign/decide/activate prerequisites 99-104 passed. This is an INVALID/
incomplete baseline, not the complete corrected RED or a GREEN release.

Static cause: `20260927290000_cms_composition_authority.sql:163-170` forces RLS
and uses `cms_rpc_context_valid()` on pattern-version SELECT. Its definition in
`20260902080000_content_schema_registry_authority.sql` tests the CMS RPC flag.
The CMS-owned SECURITY DEFINER expander reads nested rows at
`20261014140100_cms_pattern_update_nodes.sql:53-59`; `strict=false` relaxes the
nested ACTIVE condition but never bypasses RLS. A direct diagnostic outside the
RPC gate therefore sees no nested row and emits that existing refusal. This is
not evidence of an invalid owner UUID, failed activation or production resolver.

The new pg_temp `s12df_expanded_count` saves the prior app.cms_rpc value, enables
it ONLY around that existing direct count, then restores it on success and in
the rethrow path. The exact owner/forest/visited/strict=false query, expected
512 and every existing assertion/expected value are unchanged. Actual RPC calls
are untouched and keep their own authority/context boundary. No RLS policy,
predicate, guard, trigger or production function is relaxed or changed.

That two-file correction was author-UNRUN. The earlier diagnostic identifies the
old 107-line node test SHA
`d93b1773d7d759d7724d1c9ef36e7063ec6286aa95e01ffbd865b61d73eaa58c`;
it does not execute or clear the corrected 125-line source below. Root's later
complete corrected RED and independent correction review are recorded below.

### Root-only next run

Root reports the separate 231-case snapshot storage GREEN and its independent
review CLEAR at author freeze; this is root-supplied status, not an author-run
result or a runtime receipt for this new diff suite. Then stage
the existing ten pattern-updates WIPs and that snapshot foundation, with no new
resolver/producer implementation, after independent source review:

```sh
bash docs/handoffs/2026-10-14-claude-s12/lanes/lane-db-alt-staged.sh \
  /home/rob/.codex/worktrees/phase2-slice12/WeJammin pattern-updates,dec193 \
  supabase/tests/phase_02_slice_12_dec193_diff.sql
```

The existing runner serializes CI/quiet/ALT/reset locks and records the staged
manifest/TAP. The author did not execute it. Root must distinguish fixture or
SQL errors from meaningful DEC-193 assertion failures before any GREEN release.
All called production functions exist in the proposed staging set; no undefined
future resolver helper is referenced. The complete root RED below is not an
execution receipt for the subsequently authored GET GREEN WIPs.

The long-address control proves actual 520-character expansion, not every
72-segment/4680-character extreme. No accept/detach mutation or mixed-choice resolver, scan scheduling, injected
producer-fault atomicity, race/isolation, render/checker/restore/carry-over,
Worker/Web/HTTP coverage or hosted/full-slice acceptance is proved. Those remain
separate released lanes and gates. TDD/testing guidance shaped independent
oracles and adjacent controls; Supabase guidance retained real authority,
signed/governed producers, default-deny roles and unchanged database safeguards.

## Static freeze manifest

SHA-256 after static readback; counts are physical lines, not runtime assertions.

| Path under `supabase/tests/` | Lines | SHA-256 |
| --- | ---: | --- |
| `phase_02_slice_12_dec193_diff.sql` | 25 | `124a402a90f8ef2e1b97ecd04f34c88345866ae06a817b91f8331bc65e5f5c8f` |
| `phase_02_slice_12_dec193_diff/000-fixture.sqlinc` | 145 | `87b99f8ea34bda7110704ab2f25d64d3843f112b3f0227a9df474659f497f3bb` |
| `phase_02_slice_12_dec193_diff/010-node-values.sqlinc` | 125 | `f3f3af2939830845480982c16400d779303efe9555df98adb7adae5427aea6a7` |
| `phase_02_slice_12_dec193_diff/020-diff.sqlinc` | 183 | `2eca5fb8d92b489cf4d92f40f93561f86980495655f7d6258c657af6b0969cfe` |
| `phase_02_slice_12_dec193_diff/README.md` | 66 | `ec9ae5a56c84b9197efc49ce3f4e00aaffe138b2ad9ab49d0bbc00b7c64417c4` |

This report's final hash is supplied to root separately, without a self-reference.
Every claimed file remains below 400 physical lines. UNRUN remains explicit.

## Complete corrected RED and bounded GET GREEN

Root's corrected [TAP](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.lane-logs/alt-staged-pattern-updates+dec193-025926-2480779.tap)
was read and SHA-256 verified:
`43eedf33ebc59af0a1c645d500cd648779d06ea048732a85d61f44ff25bf8d30`.
It completes 259 assertions: 226 PASS, 33 meaningful typed-node/read-envelope/
whole-byte failures, Wstat 0, no SQL abort. Root reports independent diagnostic
correction CLEAR. This supersedes the incomplete 104-assertion run as the GET
GREEN prerequisite; it is not execution of the new GREEN files below.

The current five-path release at tracker 2594 adds only these three forward
WIPs, updates the already-existing dec193 README and this report. Every test,
original pattern-updates WIP/public wrapper/writer and snapshot foundation stays
frozen. All new SQL parsing/application/runtime/GREEN/review is author-UNRUN.

### Exact source authority and anchoring

BE03c 1483's slotPath must exist in the revision's template, whose slots are
flat. Original root brief `briefs/placement-f1.md:3-6` requires an exact template
slot, or only `/` without a template. The later first-segment exception was an
agent report, not an owner exception; DEC-186 describes root namespaces, not a
new nested slot. Actual placement parser `20261014110200:80` stores only the
first segment, and `20261014110300:119-124` checks that segment only. This separate
placement admission defect is not changed or certified here.

`40200` therefore uses `/` and the complete stored path as root without a
template; with a template it looks up the exact declared `/<slot.key>` through
the revision's actual template FK, requires that prefix plus `/`, and removes
only that prefix. It never selects a root by matching block identity or shortest
prefix, and never admits an empty template prefix. Conforming roots `/a/b` and
`/main/a/b` with identical block identities remain distinct when placed at
`/main`; the root's identity is validated only after its canonical chain is fixed.
Root's independent test author owns the separate actual slot-binding RED witness
and the `/main/more` placement negative; no such test is edited by this author.

The no-update path derives canonical slot metadata and retains the row's actual
positive pattern pin BEFORE resolving any pinned content. Detached/materialized
copies, retired/non-live rows and noncurrent active/pending history never need
their pin's forest or root identity to render a no-update answer. A snapshot
root may therefore differ from its provenance pin, and a legacy retired row's
missing target root does not introduce a content-resolution refusal. No pin,
slot, receipt or instance is written. Invalid legacy nested-slot histories are
not reconstructed or claimed closed by interpreting them as new permissions.

### Function boundaries, ownership and preserved writers

`40100` creates only
`platform_private.cms_pattern_diff_delta(jsonb,jsonb,text,jsonb) returns jsonb`:
IMMUTABLE SECURITY INVOKER, empty search_path, no table/registry/authority reads.
Ordered expanded block arrays are private trusted inputs from the existing
expander. The nearest block ancestor within each expanded root determines
immediate children; reference namespace segments are not mistaken for nodes.
The helper retains all props/identities and children in expansion order, filters
the instance subtree by its exact expanded root, emits only highest added/
removed-presence nodes, and does not suppress other descendants merely because
an ancestor is structural. Collision kinds have the approved precedence,
including presence-sensitive JSON-null overrides. New roots compare global
expanded block-root chains. No 32-child, 512-character or snapshot-wide cap is
introduced, and no unfinished resolver/choice API is used.

`40200` creates only
`platform_private.cms_pattern_diff_plan(cms_composition_instances,uuid) returns jsonb`:
STABLE SECURITY DEFINER, empty search_path. It returns the separate GET shape
`pinned/target/slotPath/paths/newRoots/collisionCount`, uses the unchanged
latest-active-compatible selector, and expands live base/target non-strictly as
the former GET did, allowing superseded nested pins to remain readable.

`40300` replaces only
`platform_private.cms_get_instance_update_diff(jsonb) returns jsonb`. Static
comparison confirms the original function prefix through request validation,
actor/party, UUID, instance/tenant concealment, assignment proof and standalone
refusal is byte-identical before the planner call. It assembles the complete
strict resource, permits newer empty-path bulk eligibility and checks >128 paths
then >262144 canonical UTF-8 octets, retaining P0001 diff_too_large and exact
`["/instanceId"]` DETAIL. No resource is measured before new fields are included.

All three functions are owned by the existing CMS definer; private EXECUTE is
revoked from PUBLIC/anon/authenticated/service_role, temporary schema CREATE is
revoked in each transaction, and dependency function/SELECT rights are asserted
rather than widened. No DML grant, role, row lock, CAS, receipt, transport,
audit/outbox or provider change occurs. The public wrapper remains service-role
only and unchanged. The old view/plan/effective_props/check/next_row/apply bodies
and their private plan shape remain untouched; accept/detach DEC-193 gaps remain
separate and no end-to-end update acceptance follows from GET GREEN.

### Current author freeze and root gates

| Path under `supabase/migrations-wip/dec193/` | Lines | SHA-256 |
| --- | ---: | --- |
| `20261016040100_cms_pattern_diff_delta.sql` | 95 | `f9065f20e67db4bfef6390d42b211f2c4cad0c9f6c5e76f4f49b432bb9e81288` |
| `20261016040200_cms_pattern_diff_plan.sql` | 122 | `8c6dcb56a60175b5d14467ea6895bb89ac605752efe8f62be21dbd908c1b5b35` |
| `20261016040300_cms_get_instance_update_diff_dec193.sql` | 109 | `ab38c5fae9445daa9ef8165c28a02cacedf38128f3df7509b035840f4a68f5ac` |
| `README.md` | 84 | `52bf4810a8f3c336e043204a6879b968501565d1bb4fa4237e342d4b6b106976` |

Root alone reads/reviews all final SQL, stages old pattern-updates plus dec193,
runs the frozen 259-case suite for actual GREEN, obtains the separate slot RED/
GREEN, and checks ACLs/RLS/security and writer regressions. The command above
now stages these three new files too; its older RED receipt cannot clear them.
No author SQL parser, runtime, formatter, DB, Docker, lock, network or Git command
was run. No promotion, hosted evidence or acceptance checkbox is authorized.
Migration/Supabase guidance kept changes forward-only/private/read-only;
minimal-surgical/TDD guidance preserved writer contracts and frozen oracles.
