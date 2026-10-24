# Lane brief — `claude_s12_fixture_repair` (Slice 10/11 fixtures broken by promoted Slice 12 migrations)

Source: `lane-pins-b-report.md` (sweep findings). ROOT AUTHORIZES this lane to edit the shared fixture helpers named
below (an explicit exception to the lane-rules "Never edit shared pgTAP helpers"), for exactly these breakages:
1. `cms_composition_instances.position` is NOT NULL with no default (DEC-185, promoted placement): fix the raw inserts at
   `phase_02_slice_11_helpers/001-world.sqlinc:345`, `phase_02_slice_11_helpers/003-registry.sqlinc:88`,
   `phase_02_slice_10_signed_read/002-compare-helpers.sqlinc:105`, `phase_02_slice_11_e2_composition_guard.sql:44`,
   `phase_02_slice_11_helpers_manifest.sql:363,368` — supply the position the spec's ordering rule gives (DEC-185;
   read BE03c), never a placeholder that could collide with a unique/ordering constraint.
2. `cms_terms.taxonomy_id` is NOT NULL and the raw insert helper disables the lineage fill trigger: fix the raw term
   rows in `phase_02_slice_11_helpers_manifest.sql`, `phase_02_slice_11_recheck_index.sql`,
   `phase_02_slice_11_recheck_run.sql` (supply a real taxonomy lineage consistent with the promoted taxonomy-terms
   model; never re-enable or bypass a trigger the suite intends to disable without saying why).
3. Re-run every affected suite and then the full list of suites that include those helpers (grep `\ir`) on lane
   `none`; suites that aborted part-way may reveal further reds: fix only fixture breakages caused by promoted Slice
   12 schema changes; anything else goes to Open items with classification.
4. The six "function plan(integer) does not exist" files fail only when no earlier file installed pgtap: determine
   how the canonical runner (`pnpm db:test` / db:verify scripts in `package.json`) orders/installs pgtap and say whether
   these are real canonical failures; do not change their behaviour unless the canonical runner is affected.
Every edit is a Test correction (fixture, not oracle) with the migration/spec citation; never weaken an assertion.
Report `docs/handoffs/2026-10-14-claude-s12/lane-fixture-repair-report.md`; staged runner lane `none`.
