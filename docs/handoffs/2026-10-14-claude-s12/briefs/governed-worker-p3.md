# Lane brief — `claude_s12_governed_worker` phase 3 (CMS-03C-09 route + CMS-03C-19 sweep)

Build, test-first, over the PROMOTED SQL (`supabase/migrations/20261014070000`–`070610`, RPC boundary in
`docs/handoffs/2026-10-14-claude-s12/lane-governed-b-report.md` `## RPC boundary`, incl. fix-pass amendments):
1. CMS-03C-09 POST /api/v1/cms/governed-reviews/{reviewId}/activation — `activate` 200 and `schedule` 202
   (`GovernedActivationResource`), strong If-Match = review `version`, Idempotency-Key, unconditional recent
   MFA before quota/reservation (same order as CMS-03C-07/08 in your phase 2), committed refusals,
   `canonical_source_unavailable` + `details.domain` 422, time tokens for schedule. `retire`: the SQL refuses
   it with `VALIDATION_FAILED ["/action"]` pending the owner's retirement-policy decision — the Worker must
   forward it unchanged and map the refusal exactly as SQL emits it (no special-casing), and the report
   records it as an open owner decision. Registry row `packages/contracts/src/platform-registries.ts:2023`.
2. CMS-03C-19 Worker `scheduled` sweep running BE00 job type `cms.governed_activation.execute`: claim
   (`cms_claim_due_governed_activations`, batch 1–100) then execute each
   (`cms_execute_governed_activation(schedule_id, expected_version, lease_id)` — NOTE `expectedVersion` is the
   immutable review version from the claim, NOT 03b's `scheduleVersion`), with the same lease, retry ladder,
   idempotency and observability as the CMS-03B-20 sweep (find it under `apps/worker/src/` — search
   `cms.publication` scheduled/ `scheduled-publication` / `claim_due`). Contracts `governed-activation-job.ts`.
Spec: BE03c rows ~171, ~188, invariants ~208–216, ~1324 (governed activation/scheduled activation, OD-6),
error catalog, testing ~1611; BE00 job framework sections for the scheduled handler.
Files: `apps/worker/src/cms-composition/governed-review-*.ts` and `governed-activation-*.ts` (new), production
adapters `apps/worker/src/cms-composition-production-governed-*.ts`, the scheduled-job registration files you
must touch (list them in the report), shared integration files for wiring only, tests. Precedent and commands:
`briefs/governed-worker.md`, your `lane-governed-worker-report.md`. Run focused + joint 345 + full Worker
suite; tsc/eslint/prettier on touched files. Append `## Phase 3` to `lane-governed-worker-report.md`.
