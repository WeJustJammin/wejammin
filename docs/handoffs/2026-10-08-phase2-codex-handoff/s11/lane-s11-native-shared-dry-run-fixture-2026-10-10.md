# Slice 11 shared dry-run fixture factory correction

Status: selected two-token fixture-only repair; author UNRUN until root final
full-gate receipt and clean pushed exact-origin checkpoint. Native gpt-6-astra/high;
root gpt-6.1-sol/ultra owns commands, verification and checkpointing.

## Exact scope and source contract

Only tests/postgrest/support/phase-02-slice-11-schema-lifecycle.ts. Read complete
file, relevant active rules and factory source before editing. Change its import
and sealDryRun construction from createProductionSchemaMigrationWorker to existing
createProductionSchemaMigrationPreparationWorker. Exactly two identifier replacements;
no other semantic edit or extraction. Root formatting may mechanically reflow.

Current sealDryRun explicitly asserts actual dry-run batch/finalize RPCs, no refused
RPCs, activationSwitched false, candidate draft and sealed pass. Existing production
factory at apps/worker/src/production-worker-runtime-cms.ts207–217 fixes activation
purpose; named preparation factory219–230 fixes dry_run purpose. These are different
trusted factories, not a caller-controlled purpose flag. The shared fixture must
prepare before review rather than attempt activation/reconcile/rollback.

Historical actual RED parent-s11-lifecycle-fresh-red-20261009.log18–27 proves only
two observed RPCs and missing dry-run batch/finalize. Current full-gate seven
lifecycle failure titles are captured, but until final failure sections HTTP400
and exact refusal reason are not inferred. Root must record current final verdict
before author launch. This correction does not replace production receiving/
claimed-Job integration or genuine current/enduring lease authority.

## Preserve and verify

Keep every test title, fixture assertion, request/hash/serverversion chronology,
no-effect oracle, real transport, diagnostics and activation guard unchanged.
No tests disabled; no unconditional success or synthetic CMS evidence. No leaf
test body/title changes selected. QA helper hard400; report if cap prevents exact
scope. No production, SQL, schemas, grants, package/lock or other fixture edits.

Author filesystem reads/apply_patch only; no commands/scripts/tests/format/Git/
DB/runtime/network/docs/memory/settings. Return two changed identifiers and release
claim. Root freezes source, proves inverse token stream exact apart from two names,
independently refutes, runs targeted actual API regressions and pnpm db:verify then
pnpm validate under freshCI0/sharedflock, repairs first failure, records titles and
canonical/handoff checkpoint. Acceptance0/122 stays open; focused fixture GREEN is
not genuine public receiving lifecycle, hosted evidence or phase completion.
