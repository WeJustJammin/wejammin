# Lane brief — `claude_s12_taxonomy_terms_sql` fix pass (staged-runner lane `taxonomy-terms`)

Read `docs/handoffs/2026-10-14-claude-s12/review-taxonomy-terms.md` fully. Fix test-first (edit WIP in place):
1. Major 1: make the spec-mandated merge continuation (`cms_run_taxonomy_merge_converge`) reachable by its
   registered non-browser caller exactly like the CMS-03C-19 precedent (`supabase/migrations/20261014070500`/
   `070510`, `070600`/`070610`): a `platform_api` wrapper executable by `service_role` only, RPC context set
   so forced-RLS tables answer, documented in `## RPC boundary` for the Worker job lane; replace the
   `020-surface.sqlinc:34-36` absence assertion with the correct surface assertion.
2. Major 2: test the `remaining > 0 → enqueue` branch (`120400:160-163`) and the continuation run to
   convergence. If 5,001 real assignments are impractical, introduce a bounded batch-size parameter with the
   spec default (cite BE03c for 5,000) used by production, and drive the branch in tests with a small
   batch — never a test-only code path that production skips.
3. Minors: job path lock order ascending id (BE03c 1338); handler takes positions 1/3/6 (1351) and keeps a
   job-state cursor (1334); locale case handling consistent with the contract (dedupe AND store/match);
   populated-DB witness for the `120000` backfill (pattern: `phase_02_slice_12_taxonomy_definition/populated-lineage.sql`
   with BEGIN/END markers + a parity test like `tests/contracts/phase-02-slice-12-taxonomy-lineage-witness-parity.test.ts`)
   and confirm the old successor guard does not misfire during it; reads `/limit` out of range → 400 per
   matrix row 406; strengthen the DEC-100 oracle; the new RLS policy on a Shard 01 table — justify with
   spec citations (BE03c canonical role provider; Shard 01 ownership) or replace it with a definer read that
   needs no cross-shard policy; D3 `parentId` narrowing: cite FE03/BE03c or align to the frozen contract.
   Fix the citation errors the review lists.
Lane `taxonomy-terms`. Rerun your three suites + taxonomy_definition + link_integrity + authority.
Append `## Fix pass` to your report.
