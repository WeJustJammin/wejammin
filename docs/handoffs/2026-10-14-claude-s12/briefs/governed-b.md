# Lane brief — `claude_s12_governed_b_sql` (staged-runner lane `governed-b`)

Build, contract-first and test-first, the SQL for:
- CMS-03C-09 POST /api/v1/cms/governed-reviews/{reviewId}/activation — actions `activate` (200) and
  `schedule` (202) ONLY. The `retire` action is HELD: the owner has not yet confirmed the retirement
  policy (`.memory/wiki/specs/audits/propagation-scan-governed-lifecycle-2026-10-13.md` §R). Do not
  implement, stub, or test retire behavior beyond asserting that your producer does not silently accept
  it; record it as an open owner decision in your report.
- CMS-03C-19 scheduled activation: `platform_private.cms_claim_due_governed_activations(batch)` and
  `platform_private.cms_execute_governed_activation(schedule_id, expected_version, lease_id)`
  (same claim, lease, retry ladder and idempotency as CMS-03B-20). The Worker `scheduled` sweep is a
  later Worker lane; you build and test the SQL boundary.

## Your files (exclusive)
- `supabase/migrations-wip/governed-b/` — forward migrations ONLY in 20261014070000–20261014079999.
- New suites `supabase/tests/phase_02_slice_12_governed_activation.sql` + dir and
  `supabase/tests/phase_02_slice_12_governed_schedule.sql` + dir.
- Report `docs/handoffs/2026-10-14-claude-s12/lane-governed-b-report.md` with a `## RPC boundary` section.

## Staged runs
Your producers depend on unpromoted governed-a helpers (`cms_governed_move_subject`,
`cms_governed_invalidate_open_review`, `cms_governed_cas_operand`) and the governed-fix patches. Stage
them with a comma list: lane argument `governed-a,governed-fix,governed-b` (add `pattern-def,taxonomy-def`
when you drive pattern/taxonomy subjects). Never copy another lane's files; never edit their WIP.

## Read before designing
1. BE03c `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`: route row CMS-03C-09 (~171;
   If-Match = review `version`; atomic CAS switch of subject and supersession of the previous active
   version of the lineage; unconditional recent MFA, 401 `STEP_UP_REQUIRED` before any idempotency
   reservation; pinned-tzdb time authority for schedule; events `cms.template.activated.v1`,
   `cms.pattern.activated.v1` or `cms.taxonomy.changed.v1` only on committed immediate activation or
   execution), validation row ~392 (`activate` requires an approved review, unchanged subject hash and
   every dependency current; `schedule` resolves `activateAt` through the 03b Time authority, E8),
   internal op CMS-03C-19 (~188), "Governed activation, retirement and scheduled activation (DEC-113,
   OD-6)" (~1324), lock order (~1336), DEC-188 lifecycle counter (~208), events (~1546), state machine
   (~1535), error catalog, testing (~1611). 03b CMS-03B-20 scheduled publication for the claim/lease/retry
   pattern (BE03b `.memory/wiki/specs/be/03b-editorial-workflow-publication.md` and its SQL in
   `supabase/migrations`). Contracts (frozen): `governed-activation.ts`, `governed-activation-job.ts`,
   `refusals.ts`, `error-catalog.ts`.
2. governed-a's report `docs/handoffs/2026-10-14-claude-s12/lane-governed-a-report.md` (`## RPC boundary`,
   helpers, MFA via `cms_editorial_step_up_instant`, lock order) and its suites for the real-foundation
   fixture approach; `supabase/migrations/20261013300700_cms_governed_activation_schedules.sql` (schedule
   table and guard, applied).
3. For taxonomy activation: declared canonical domains without a provider block activation with 422
   `canonical_source_unavailable` + `details.domain` (FE03 882, BE03c 1375).

## Done
activate + schedule + CMS-03C-19 claim/execute GREEN on real fixtures (template subjects at minimum; pattern
and taxonomy subjects via the comma-staged producers), non-vacuous assertions incl. supersession, lifecycle
+1 exactly once, events exactly once on commit and none on schedule acceptance, idempotent replay, CAS,
MFA ordering, concealment, anon/authenticated 42501, lease expiry/retry ladder. Report with RPC boundary.
