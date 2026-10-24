# Lane brief — `claude_s12_baseline_repair_a` (staged-runner lane `baseline-repair`)

Promoted Slice 12 work (pattern lineage/forest storage, governed lifecycle, locale fan-out) broke older
suites. Repair them with debug-by-test discipline (`.claude/rules/debug-by-test.md`): each failing test
already exists — diagnose, classify (stale test fixture vs production defect), fix the RIGHT layer.

Targets (from `docs/handoffs/2026-10-14-claude-s12/CLAUDE-STATE.md` baseline notes and lane reports):
1. Seven Slice 11 suites aborting early on raw-inserted legacy `cms_pattern_versions` rows (missing
   `lifecycle_version`, and now `pattern_id`, `compatible_type_ids`, `node_count`, forest CHECKs):
   `phase_02_slice_11_checker_render_plan.sql`, `_criteria_publish_gates.sql`, `_helpers_manifest.sql`,
   `_helpers_preflight.sql`, `_recheck_index.sql`, `_recheck_run.sql`, `_rpc_reads_gate.sql`; shared fixture
   `phase_02_slice_11_helpers/003-registry.sqlinc:50,56`, `phase_02_slice_11_recheck_run.sql:297,303`,
   `phase_02_slice_11_helpers_references.sql:89`; Slice 12 `phase_02_slice_12_composition_authority.sql:142`,
   `_composition_instance_guards.sql:27`, `_composition_owner_integrity.sql:51`. Prefer real producers
   (`cms_create_pattern_version` + governed activation now exist); where a raw fixture state is producer-
   unreachable but needed, keep it raw, valid under the new CHECKs, and labelled.
2. Production defect (pattern-def review F12): joins in `supabase/migrations/20261005017560_*` and
   `20261010164100_*` (dependency manifest and dependency recheck) treat `pattern.id = instance.pattern_id`
   as a version-row id — correct only for version 1 (BE03c :219 lineage ids). Fix forward with a new
   migration, RED first with a version-2 pattern case.
3. S09 trigger inventory (locale lane): drop `phase_02_slice_09_*/06-trigger-probes.sqlinc:70`
   `cms_entry_revisions_locale_stale`; add `('cms_content_entries','cms_content_entries_locale_stale','cms_content_entry_locale_stale_trigger',17)`.
4. Diagnose and fix (or classify precisely with evidence) the other baseline reds: S09 `p240_authority` #76,
   `schema` #448, S10 `ev_eb_publication_scope` #2. Do NOT update the API-surface / SEC-2 definer-RLS /
   schema inventory pins for new Slice 12 functions yet (`r8_api_surface`, `sec2_*`) — related, placement
   and taxonomy-terms are still landing; list exactly what each pin will need.
Never weaken an assertion; every test correction spec-cited and listed. Files: the suites/fixtures named
above, `supabase/migrations-wip/baseline-repair/` (range 20261014130000–20261014139999), report
`docs/handoffs/2026-10-14-claude-s12/lane-baseline-repair-a-report.md`. Lane list `baseline-repair` (all
other relevant work is promoted). Finish with one lane-none-plus-yours run of every affected suite.
