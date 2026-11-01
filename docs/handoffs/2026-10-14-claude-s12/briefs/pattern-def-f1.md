# Lane brief — `claude_s12_pattern_def_sql` fix pass (staged-runner lane `pattern-def`)

Your previous pass was reviewed PARTIAL: `docs/handoffs/2026-10-14-claude-s12/review-pattern-def.md`
(SHA `b3d9e177…`). Read it fully. Root rulings (binding; all follow BE03c):

1. F4/F5 — `020100` backfill: add a pre-check that refuses, with SQLSTATE 55000 and a clear message,
   any populated legacy state it cannot convert deterministically (mirror the promoted taxonomy
   convention in `supabase/migrations/20261014030000_cms_taxonomy_lineage_columns.sql`). A lineage must
   root at its version-1 row (BE03c :217); never silently root at another version. Author a populated
   witness suite (like `supabase/tests/phase_02_slice_12_taxonomy_definition/populated-lineage.sql`) with
   BEGIN/END PATTERN-LINEAGE-DDL parity markers, and a Vitest parity test modelled on
   `tests/contracts/phase-02-slice-12-taxonomy-lineage-witness-parity.test.ts`.
2. F6 — no grandfathering. The forest/compatible-type/node-count CHECKs apply to every row (BE03c
   :1425). Legacy rows are converted by 020100 or refused by its pre-check. Frozen fixture suites that
   raw-insert legacy pattern shapes are NOT yours: list each (file:line) in your report under
   `## Requests to root`; the baseline-repair lane updates them.
3. F2 — deprecated (non-withdrawn) blocks are admitted, withdrawn blocks refused (BE03c :396, :1361).
   If a frozen helper you call refuses deprecated blocks, do not edit it: add your own forward helper or
   report the conflict.
4. F3 — reject an incompatible block (renderer-manifest compatibility) as templates do (BE03c :1361;
   find the template implementation in `supabase/migrations/2026092723*`/`2026092724*`), with RED first.
5. F1 — your report must name both digest defects in applied `300400` (ORDER BY 42P10 and the NULL
   lifecycle for event-less blocks) and that governed-fix `supabase/migrations-wip/governed-fix/20261014040000_*`
   patches both.
6. Governed calls in your suite (assign/decide, e.g. `050-nested.sqlinc` ~:30–45) were written before the
   real boundary existed. CMS-03C-07/08/10/11 are now PROMOTED (`supabase/migrations/20261014010000`–`010410`);
   their exact request shapes, MFA step-up and tokens are in `docs/handoffs/2026-10-14-claude-s12/lane-governed-a-report.md`
   `## RPC boundary` and their suites `supabase/tests/phase_02_slice_12_governed_{assignment,decision}.sql`.
   Align your helper calls to that boundary (test correction, reported with citations). Activation
   (CMS-03C-09) is being built by lane governed-b in `supabase/migrations-wip/governed-b/`; stage with
   `governed-fix,governed-b,pattern-def` once its files exist and say which nested positives then pass.
7. Remaining minors F7–F12 at your discretion with reasons.
Files and rules as in `briefs/pattern-def.md` (WIP still unpromoted — edit in place). Always stage
`governed-fix,pattern-def` (plus `governed-b` when present). Append `## Fix pass` to your report.
