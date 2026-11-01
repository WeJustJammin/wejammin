# Lane brief — `claude_s12_governed_fix4` (SQL + Worker, staged-runner lane `governed-fix4`)

Read `docs/handoffs/2026-10-14-claude-s12/review-governed-worker-p3.md` fully. Root rulings (binding), test-first:
1. Option A: CMS-03C-09's committed invalidation answers `dependency_changed` (BE03c row 1262, 1326 step 4),
   never `review_not_open`. Forward migration (anchored patch, exactly-once anchor, every non-body
   `pg_proc` attribute compared, idempotent — precedent `supabase/migrations/20261014080000_*`) on the
   promoted activation producer (`supabase/migrations/20261014070*`); RED first in the governed activation
   suite (add cases only). Worker: remove the `COMMITTED_ONLY` path that admits `review_not_open` for 09.
2. `resolved_utc_mismatch` must carry the contract's `expectedUtc` DETAIL (`packages/contracts/src/cms-composition/governed-activation.ts`);
   fix in the same SQL change set; Worker maps it (test).
3. Metrics: the 09 route emits `cms_governed_activation_total` with the spec's labels and the sweep's label
   values conform (find the metric definition in BE03c Observability ~1593 and BE00); test.
4. Remove the `retire` success check that requires review version = expected + 1 (unsupported by BE03c 215);
   retire stays forwarded unchanged pending the owner.
Files: `supabase/migrations-wip/governed-fix4/` (range 20261014150000–20261014159999), add-only cases in
`supabase/tests/phase_02_slice_12_governed_activation.sql` + dir, `apps/worker/src/cms-composition/governed-*.ts`,
`apps/worker/src/cms-composition-production-governed-*.ts`, `apps/worker/src/cms-governed-activation-sweep*.ts`
(+tests). Lane `governed-fix4`. Run governed activation/schedule suites and the governed Worker + sweep tests,
full Worker suite, tsc/eslint/prettier. Report `docs/handoffs/2026-10-14-claude-s12/lane-governed-fix4-report.md`.
