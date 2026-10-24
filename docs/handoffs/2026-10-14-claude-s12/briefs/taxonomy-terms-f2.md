# Lane brief — `claude_s12_taxonomy_terms_sql` follow-up f2 (staged-runner lane `taxonomy-terms`)

The thirteen taxonomy-terms migrations are PROMOTED (`supabase/migrations/20261014120000`–`120710`); fixes are
now FORWARD migrations in `supabase/migrations-wip/taxonomy-terms/` with new timestamps in
20261014120800–20261014129999. Read `docs/handoffs/2026-10-14-claude-s12/review-taxonomy-terms-f1.md`. Test-first:
1. TC1: apply the two-hunk correction (in your report) to `supabase/tests/phase_02_slice_12_taxonomy_definition/populated-lineage.sql`,
   rerun it plus its parity test, then delete `supabase/tests/phase_02_slice_12_taxonomy_terms_populated_witness.sql`
   (your verification copy) — if the parity test `tests/contracts/phase-02-slice-12-taxonomy-lineage-witness-parity.test.ts`
   needs the DDL region unchanged, keep it unchanged.
2. F1: the merge-converge handler must check the job's lease/state like `20261005018400` / `20261014070600`.
3. F2: BE00 caps a job at 32 claims; a long merge must not strand. Make each continuation a fresh job (or
   equivalent spec-conformant mechanism, cite BE00/BE03c 1334) and test that a >32-batch merge converges
   (use the real command; you may lower only the batch size via the production parameter's spec-allowed
   range, never a test-only path).
4. F3: BE03c 1354 requires a capability re-check in the handler — implement it (and define what happens to
   remaining rows when the curator lost authority, citing spec) or cite the spec text that exempts the job.
5. F4: add an index supporting the remaining-work predicate (leading `term_id`), with a plan-shape assertion.
6. Fix the citation nits (read row BE03c 407; DEC-100 usage).
Lane `taxonomy-terms`. Rerun terms/reads/canonical + taxonomy_definition (+ populated-lineage) suites. Append
`## Follow-up f2` to your report.
