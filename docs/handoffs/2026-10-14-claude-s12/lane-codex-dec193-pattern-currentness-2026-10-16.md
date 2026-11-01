# DEC-193 / DEC-199 pattern currentness TEST handoff

Status: **source-authored, frozen, UNRUN**. No RED/GREEN, SQL setup validity,
runtime behavior, acceptance criterion or Slice 12 completion is claimed.

Pre-RED source correction: the independent block oracle now emits `{id,hash}`,
not `{id,releaseDigest}`, matching BE03b:1778 and the existing builder's line 214.
Only that expected key changed; author execution remains UNRUN. The earlier
nonempty block-membership oracle was invalid and is superseded by this ledger.

Root-reported first complete diagnostic: 686 assertions, 527 PASS / 159 FAIL,
no SQL abort (log SHA256 `e3103d071e7aa00ec15a15ce87c3cd008e402312067b179782266b98cdbf4b6d`).
Its two withdrawal prerequisites incorrectly used CAS `2`: the promoted producer
checks immutable block version `1`, not the appended lifecycle-event count.
Only those two expectedVersion inputs were corrected to `1`; author execution
remains UNRUN. Other failures include separate consumer-dependency RED and must
not all be classified as isolated provider failures. Corrected runtime is pending.

## Exact release and execution boundary

This release owns eight NEW paths: the SQL driver, its three fragments and
README, this handoff, and the new contract/Web tests listed below. Existing
tests, consumer fixtures, private SQL helpers and migrations were not edited by
this TEST claim. The shared worktree contains separately owned production work;
its contract/copy integration is not evidence that these tests ran.

Authoring used `apply_patch` only. Read-only filesystem/text/hash analysis ran;
no project import, SQL/TypeScript parser, formatter, tests, native process, DB,
Docker, network, reset, service action or Git operation ran in this author lane.
Root owns normalization, independent review, isolated staging and actual RED.

## Canonical authority

- `.memory/wiki/decisions.md:5324–5334`, DEC-199: live pinned graphs recursively
  recheck active state and existing same-owner/all-parent-compatible-types
  compatibility. Missing/inactive/incompatible nested pins use the existing
  `nested_pattern_not_active` pattern-category reason. No new transport status,
  authorization or disclosure is introduced.
- BE03c `03c-composition-taxonomy-localization.md:1487,1536,1563`: a nonnull
  canonical detached tree validates its own reachable blocks/digest. Its pattern
  identity is retained provenance, never a graph to reopen. SQL-NULL linked or
  legacy detached rows retain pinned checks; mixed use still validates live use.
- BE03b `03b-editorial-workflow-publication.md:1772–1788,1818–1822`: preserve
  canonical manifest membership, frozen currentness, all seventeen actual
  results, closed reasons, statelessness and existing error boundaries.
- FE03 `03-cms-content-modeling.md:606` and the DEC-199 propagation scan require
  fixed safe copy and identical closed reason sets. AC211/238/241 are affected;
  no criterion is checked by this handoff.

## Test design

The driver includes the existing signed/governed prerequisites and only
`phase_02_slice_12_dec193_consumers/000-fixture.sqlinc`. No old consumer assertion
fragment or expected-result builder is edited or imported as a provider oracle.

| Test area | Discriminating source-authored oracle |
| --- | --- |
| Canonical provenance | Actual mixed B-root/T-leaf/local-tail tree remains current with superseded pin; exact pin identity stays in manifest; own reachable blocks remain exact. |
| Legacy/live | Real SQL-NULL detached placement retains its pin checks. The root-inactive fixture's nested child stays active, so reason precedence is not invented. |
| Same-pin mixed use | Real public multi-root placement/detach leaves one canonical head and one live head. Its live use still blocks; canonical-only use on another revision does not. |
| Independent canonical rows | Two materialized roots share a pin but have different root-version digests. One guarded wrong-digest row must fail; pin dedup cannot skip it. |
| Effective heads | Guarded append-only histories test live→canonical, canonical→live and latest-retired exclusion; newest selection must precede eligibility. |
| Frozen inputs | A well-shaped wrong pattern hash, SQL/JSON null, scalar, missing shape, malformed patterns and orphan identity fail actual frozen status closed. |
| DEC-199 recursion | A real governed child successor leaves root/intermediate patterns active. Direct and depth-two-only nested inactivity block all applicable phases; canonical-only provenance remains independent. |
| Retired provenance | Actual governed retirement must succeed before the canonical donor's retained retired pin is tested. |
| Registry digest | Real signed deprecate→withdraw transitions distinguish old unselected provenance leaf v1 from selected leaf v2. Deprecation isolates digest change without withdrawal; selected withdrawal is semantic failure. |
| Authority | Real service-role workflow calls conceal foreign-owner/wrong-entry/absent revisions. Actual anon/authenticated/service-role private calls must return SQLSTATE 42501. |
| Typed cascade | Main registry and composition provider agree on database active-digest v1 and exactly three reasons. Actual result/report/refusal/API schemas accept each and reject cross-category/unknown/outage misuse. |
| Fixed copy | Each registered reason has repeatable non-generic non-raw safe copy; unknown tokens retain generic copy. |

`pg_temp.s12pc_check` dynamically invokes the actual existing manifest builder,
frozen-status function and evaluator. Exact signature absence is explicit TAP
FAIL, not an unguarded setup abort or a substituted report. Exceptions from an
absent future provider dependency are captured as actual-call FAIL. Malformed
reports are asserted without assuming an array exists.

Every check asserts exact manifest pattern/block groups, status, seventeen
ordered result objects with six exact fields, the complete report envelope and
aggregate `passed`. Stable same-subject/same-phase repeats compare all sixteen
other full provider results; unrelated results are not compared across changed
history/phase/registry subjects. Counts are 0 or one isolated offender; plural
aggregation and combined-reason precedence remain undesigned here.

Whole-effect images include every persistent `platform_private.cms_*` table and
the inherited full audit/outbox/idempotency/grant/identity images. Target calls
must preserve rows, SQL role and prior `app.cms_rpc`. JWT test-session setup is
not claimed as a production authentication/session-restoration proof. Role
probe parameters are prepared before switching, so a temp-table denial cannot
masquerade as a private-function permission refusal.

## Explicit limits and root next step

The incompatible-active nested branch is **not runtime-proven**. Current create
checks (`20261014020400_cms_create_pattern_version.sql:186–204`) enforce nested
compatibility before INSERT; the lineage/lifecycle guard
(`20261014020200_cms_pattern_lineage_guard.sql:21–56`) admits only draft INSERTs
and prevents definition mutation. Current governed activation also rechecks the
graph. It is source-enforced unreachable through those current governed
producers, not established unreachable for every possible historical store.
No historical replay authority was granted; no fake active state, governed flag,
guard bypass, active-row mutation or masked inactive-root substitute was used.
Contract acceptance of its reason is not SQL execution proof of that cause.

Guarded row copies are read-fixture setup only, not ordinary carry/restore/writer
proof. Existing real signed/governed producer success is an asserted prerequisite
in the eventual run, not an author-observed result. Staged effective-manifest
integration is a separate prerequisite; these exact membership assertions may
also expose that lane's remaining defects. Root must separate fixture/setup
failures from meaningful provider/currentness RED and require complete TAP with
no abort. Production provider migrations remain reserved to root's future 440+
claim. Actual dependency outage/race/hosted transport proof remains outside this
eight-path authoring claim. Do not label all DEC-199 coverage complete.

## Frozen source ledger

SHA256 is over exact author bytes before root normalization. This report's own
hash is returned separately to avoid a self-referential hash ledger.

| New path | Lines | SHA256 |
| --- | ---: | --- |
| `supabase/tests/phase_02_slice_12_dec193_pattern_currentness.sql` | 23 | `55033009c0e8f1e2ed941567042e57181a0fdaf2ab550cddf4e10bfc7e91330d` |
| `supabase/tests/phase_02_slice_12_dec193_pattern_currentness/000-fixture.sqlinc` | 195 | `c2861f2965d92fc20ad7d25de78472e0a1142f60f18884931db180ff3c41c2cf` |
| `supabase/tests/phase_02_slice_12_dec193_pattern_currentness/010-provenance-currentness.sqlinc` | 144 | `8757c16d81246d2d12f9b950b488f4168915ae2b511c68900bf7e7c56231cbaa` |
| `supabase/tests/phase_02_slice_12_dec193_pattern_currentness/020-active-digest-provider.sqlinc` | 107 | `803b94f170ba770cdbf6e2ffecc570718afc318c2ab9e8a18dd74e8163c5efaf` |
| `supabase/tests/phase_02_slice_12_dec193_pattern_currentness/README.md` | 80 | `cbcd133dd29ed899d5a860e1563e2e7d07c86510276b466e36b9aa421537e1f4` |
| `packages/contracts/src/cms-editorial/preflight-pattern-provider.test.ts` | 267 | `1c69bf43827069db3b770775b1c8b8f7569e846a6f31edafa829520b6fc46821` |
| `apps/web/src/components/cms-editorial-workflow/cms-workflow-pattern-reasons.test.ts` | 46 | `eefe9f86fd10a42e32e5f5d01e668880c001c799f172ca3411ab46383798ec26` |
