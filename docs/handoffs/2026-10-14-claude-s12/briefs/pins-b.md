# Lane brief — `claude_s12_pins_b` (Slice 09/10/11 inventory pins for the promoted Slice 12 set)

Source: `lane-baseline-repair-a-report.md` "Pin requirements" (:120-146) and the template-digest lane's finding:
`r8_api_surface` counts 91 executable `platform_api` RPCs against 72 enumerated on the CURRENT promoted set (460
migrations; pattern-updates 14/15 and the locale gate pair are still WIP and are NOT part of this pass).
Do, RED first (run the pin suites on lane `none`, record exactly which pins fail and why):
1. `r8_api_surface`: classify every promoted, unclassified `platform_api` function per the suite's existing categories
   (read the suite header and the Slice 09 R8 rules; each classification cites the function's migration and BE row).
2. `sec2_all_schema_definer_rls` (and `sec2_definer_rls`): forced-table / definer sets gain the promoted Slice 12 tables
   per the report's list; verify each table's RLS/force state from the migrations, never by loosening the suite.
3. Schema trigger inventory: add promoted Slice 12 triggers (e.g. `cms_terms_00_lineage_fill`) with exact counts.
4. Any other inventory pin that fails on lane `none` for a promoted Slice 12 object (`schema` EMPTY-table list,
   `evidence_trigger_catalog`, `p240_authority`, `ev_eb_publication_scope`): fix the pin, not the object.
Rules: these are shared pre-Slice-12 suites (lane-rules "Never edit shared helpers" does not cover pin suites; editing
their expected lists IS this lane's job) — every change is a Test correction with the migration/BE citation, additive
only (never drop an existing expectation). Never `pnpm db:verify`/`validate`. Report
`docs/handoffs/2026-10-14-claude-s12/lane-pins-b-report.md` with before/after counts per suite, and a "pass C" list of
pins the WIP pattern-updates 14/15 and locale gate will need when they promote.
