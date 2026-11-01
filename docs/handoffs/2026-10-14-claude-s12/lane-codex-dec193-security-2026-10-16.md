# DEC-193 selected effective-content security — test author freeze

Author: native `gpt-6.1-sol` / `ultra`, 2026-10-16.
Worktree: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.
Status: **initial four-path test freeze; approved three-path E7 fixture correction, author UNRUN**.

Root claimed/released exactly the driver, `010-effective-content.sqlinc`, its
folder README and this report in S12 Dispatch. No production, promoted/WIP SQL,
old test/fixture, contract, grant, guard, tracker or previous two-cast DEC-194
ownership fragment was edited. No parser, formatter, module import, test, native
DB, Docker, runtime, Git or network execution occurred. Context-mode source reads
and literal/hash analysis only; all edits used `apply_patch`.

## Authority and actual source read

- [BE03b:1807](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1807)
  requires `preflight.security` to re-run write-time executable-content and unsafe
  link rules over stored values/block props, with `unsafe_content`.
- [BE03b:2056](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.memory/wiki/specs/be/03b-editorial-workflow-publication.md:2056)
  supplies the existing write-time security boundary. This test does not invent a
  new SQL lexical policy, reserved JSON-key rule or object-only props contract.
- Fully read the existing arbitrary-JSON detector bodies and comments at
  [17570:133–187](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/supabase/migrations/20261005017570_cms_preflight_evaluation.sql:133).
  Only `cms_json_executable_leaves`/`cms_text_is_executable` define safety here.
  Independent fixtures assert one unsafe string leaf versus zero safe leaves.
- [40800:96](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/supabase/migrations-wip/dec193/20261016040800_cms_detached_tree_registry.sql:96)
  chooses effective props and checks JSON bounds, not executable leaves. The
  actual 41100 writer resolves complete choices, validates the selected tree and
  appends each instance within one RPC transaction; existing pointers are kept.
- [17570:510](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/supabase/migrations/20261005017570_cms_preflight_evaluation.sql:510)
  currently scans ordinary instance props/bindings but not effective detached-tree
  props. The new actual preflight case isolates that omission.
- Read the existing resolution fixture, common public-call/refusal/request
  helpers, signed/governed placement setup, full-row snapshot oracles, actual
  resolver/next-row/registry/writer/storage functions and public wrapper shape.
  The wrapper returns exactly `{items}` and puts entry CAS in the strong ETag.
  Private signatures/roles were inspected before choosing any direct call.

TDD, migration/Supabase security, adversarial-review and verification guidance
kept expected values independent, fixtures honestly labelled, guards/ACLs intact,
failure tokens exact and source observations separate from runtime evidence.

## New boundary coverage

Driver reuses `phase_02_slice_12_dec193_resolution/000-fixture.sqlinc`: real signed
registry registration, governed pattern chains and pre-successor placements.
None of that suite's subsequent assertion/mutation fragments is included. New
cases have independent labels and use only the existing public update wrapper.

1. Nested whitespace-obfuscated executable URL, scalar template expression,
   iframe-array and HTML event attribute are explicit detector-premised unsafe
   alternatives. Accept `yours`/detach must refuse VALIDATION_FAILED at the exact
   existing choices/instance pointer; every captured full mutation-store image,
   including audit/outbox/idempotency/governed/review rows, must remain unchanged.
2. A two-root detach orders a safe first root before an unsafe second root. The
   failure pointer must identify index 1 and the whole transaction must roll back,
   including any tentative first append or reservation/effect.
3. The identical unsafe local root alternative is discarded by safe `theirs`.
   The public command must succeed, adopt target pin 2, store `{}` overrides and
   no detached tree. Validating discarded alternatives would falsely refuse.
4. Present JSON null, number, boolean, string and array succeed through both
   accept and detach without coercion. Exact linked O and detached root-props
   equality discriminate null absence, `{}` substitution and scalar/array loss.
   Safe arrays contain harmless values under `script`/`style`/`onload` keys to
   reject an invented key-based sanitizer. Historical full rows/revisions,
   append/CAS, public envelope/private-field exclusion and ETag are checked.
5. Existing missing-assignment and hidden-owner refusals retain exact tokens and
   no effects. Actual public calls record service_role execution/restoration;
   service-only public execute and private helper denial are checked, not granted.
6. Separate legacy rs-same/rs-wide worlds have `{}` ordinary props, safe bindings,
   no unsafe stored field values and no unsafe superseded tree. Exactly one
   unsafe leaf exists only in the current rs-same detached tree; its paired safe
   arbitrary-JSON tree has zero. The real private preflight must return the exact
   security category/provider/version/outcome/reason/count: unsafe_content/1
   versus passed/null/0. No whole-report pass or other-category closure is claimed.

## Fixture honesty and abort safety

Unsafe O and tree-only worlds are explicitly labelled legacy append fixtures,
copied from real placed rows under the existing normal `app.cms_rpc` write guard.
They retain actual positive pattern provenance; no unsafe producer acceptance,
scan-history production or pin fabrication is claimed. No guard/RLS/trigger is
disabled, no private execution grant is added and no production helper is mocked.
Seeded exact props/tree and enabled guard have explicit premises.

Preflight checks its exact existing scalar-jsonb signature before dynamic
invocation. Missing/wrong signature emits TAP FAIL, not skip/setup abort. Actual
SQL errors are separate state/message fields; the nullable answer is never
replaced with a fake provider result. Diagnostic CMS context is saved/restored,
including a raised call. Shared captured CMS mutation stores and all full stored
field-value images are compared around the call.

Source read found `cms_build_dependency_manifest` calls `cms_settings_snapshot`.
The effective E7 definition is lookup-only, not a settings writer. The test does
not assert an all-pass report: its security category and named captured-store
comparisons are bounded claims; public unsafe refusals retain full-store checks.

An inherited-native child independently read the new SQL and actual dependencies
read-only, returning static CLEAR for oracle completeness, safe-theirs discard,
five JSON classes, second-item atomicity and real preflight isolation. That is
not a parser/test/DB result. Root must independently read before actual staging.

## Approved E7 lookup-fixture correction — author UNRUN

Root reported the first actual staged security run: 369 assertions, 345 PASS,
24 FAIL, no SQL abort. Twenty failures exercised unsafe public writer behavior;
the four paired preflight failures were `P0001:DEPENDENCY_UNAVAILABLE` for both
unsafe and safe worlds, not meaningful preflight-security RED.

The real call chain is [17570:308](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/supabase/migrations/20261005017570_cms_preflight_evaluation.sql:308)
to manifest [17560:274](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/supabase/migrations/20261005017560_cms_dependency_manifest.sql:274),
then E7 [130000:35–44](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/supabase/migrations/20261010130000_cms_settings_write_tail_lookup.sql:35).
The missing snapshot raises before the provider loop. The legacy fixture's direct
guarded placement rows did not execute an ordinary successful write tail.

Root separately claimed/released only `010-effective-content.sqlinc`, its README
and this report. The correction follows the existing guarded
[S11 E7 seed:40–55](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/supabase/tests/phase_02_slice_11_e7_settings_lookup.sql:40):
ownerOrg, active, version/ordinal/registry 1, literal `[]` and literal JCS hash
`4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`.
Count-only exact missing/present premises surround the guarded insert before
preflight before-images; the prior `app.cms_rpc` is restored on success/error.
This is lookup-fixture-only, not writer/materializer/provider proof. Existing
tree-only isolation, paired real provider assertions, mutation images and all
ACL/role witnesses are unchanged. No production, driver or other file was edited.
Static removal of only the new prerequisite block reproduces the prior complete
SQL SHA `bec05f1ada41ee76c6fa6964e97895875e67e140eba1b7f3be1714a06aab6896`;
the only added TAP identities are `SEC-E7-01` and `SEC-E7-02`.

## Frozen source manifest — current correction author UNRUN

| File | LF lines | SHA-256 |
| --- | ---: | --- |
| `supabase/tests/phase_02_slice_12_dec193_security.sql` | 25 | `6adf27d96580ff62c7000961450e7d2ec5571a0fdbf9d1446c111334c7aea15d` |
| `supabase/tests/phase_02_slice_12_dec193_security/010-effective-content.sqlinc` | 274 | `56ab73053794292d0542c7301aba0a89606a8f237d9364e95b88f2bade515893` |
| `supabase/tests/phase_02_slice_12_dec193_security/README.md` | 87 | `63c927f0e9ccafa9ff307eb8c81ceda75e7e8d1f5dc716ebcda66265256ea8a4` |

Root must rerun the corrected fixture to distinguish a genuine tree-only
preflight-security RED from dependency failure; no corrected-fixture runtime
result is claimed. Root owns staged execution, review and follow-up. Historical
root counts above are not author execution or hosted/slice acceptance evidence.
