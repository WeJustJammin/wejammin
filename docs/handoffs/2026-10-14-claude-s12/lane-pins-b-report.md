# Lane claude_s12_pins_b report

## Status
GREEN for the brief's scope (the seven inventory-pin suites are 815/815 on lane `none`, 2026-10-15 16:36Z). A 146-file catalog-touching sweep on lane `none`
found no other pin failure; it did find six FIXTURE breakages caused by the promoted placement and taxonomy-terms migrations in Slice 11/10 helper
files and suites that this lane may not edit (see Open items and Requests to root). Clock: all times `date -u`; the runner prints local EDT (-4h).
Base: HEAD b16edb54, `supabase/migrations/` as promoted at 16:33Z (the brief's 460 plus DEC-191 and template-digest promotions), lane `none`, WIP lanes pattern-updates 14/15 and locale-gate excluded.

## Scope
`briefs/pins-b.md`. Additive pin repairs only, every one a Test correction with its migration/BE citation. No migration, contract, Worker or Web file touched.

## Files
| path | lines | SHA-256 |
|---|---|---|
| `supabase/tests/phase_02_slice_09_r8_api_surface.sql` | 233 | `0cd135ecfbc299660b8f11c70c63ec2363994bbeb9018d018252e8829fd97109` |
| `supabase/tests/phase_02_slice_09_sec2_all_schema_definer_rls.sql` | 300 | `8a69a9d580ab16ebf19bc7e2d71455b073bb4fe6eea1a1f7ddb6d00e3a1621f8` |
| `supabase/tests/phase_02_slice_09_dec108/06-trigger-probes.sqlinc` | 228 | `b4af3b16195ef233a61c60b1baff5adb6c2cc00a61d9824099eacc838744a134` |
| `supabase/tests/phase_02_slice_09_schema/012-trigger-catalog.sqlinc` | 91 | `63f786f9082f96b1598b601a49bb699acb858d6ec992157c44322f4b69c73243` |
These four files also carry the baseline-repair lane's earlier edits (not mine). `06-trigger-probes.sqlinc` sits in a directory lane-rules list as shared
helpers; it is the trigger-inventory pin list that brief item 3 names, so the brief governs (same exception baseline-repair recorded). Root review.

## Runs
| # | time (Z) | lane | files | plan / result | TAP sha256 |
|---|---|---|---|---|---|
| 1 | 16:33 | none | r8_api_surface, sec2_all_schema_definer_rls, sec2_definer_rls, schema, evidence_trigger_catalog, p240_authority, ev_eb_publication_scope | 815 tests, 5 not ok (RED baseline, all genuine missing pin): r8 #4/#13/#14, sec2_all #6, schema #448. Everything else (incl. schema #538, evidence_trigger_catalog, p240 #76, ev_eb #2, sec2_definer_rls) already green. `alt-staged-none-123315-2274924.tap` | `ce5cd4ad5d32016ae0f07d7c96183c51b8f2b97391c8ef5a456f2b0210d0da7b` |
| 2 | 16:36 | none | same seven | 815/815 PASS (after the four edits below). `alt-staged-none-123621-2296087.tap` | `6f1df04a0c00bd90fd9ddfc0f4a158344c628048a3faf414dcfb10b037288db5` |
| 3 | 16:38 | none | 146 files: every non-Slice-12 suite that reads pg_proc/pg_class/pg_policy/pg_trigger/information_schema plus every schema/posture/catalog/grant/classification/tables/policy/rls/boundary/surface/definer named suite | 6380 tests; 12 files red, all classified below. `alt-staged-none-123829-2307518.tap` | `357e7c7376082e4f1771c6673602c5bceaff1cfbce531721f1b34b254fdbc5f5` |
| 4 | 16:44 | none | r8_api_surface (leads, installs pgtap) + the six `plan(integer)` files of run 3 | 299/299 PASS: proves those six are run-order harness artifacts. `alt-staged-none-124400-2337554.tap` | `68dc633496c8091f7f3eff3f11bd3df59786b8ebb2a267813f3387c3693f2475` |

Before/after per suite (run 1 -> run 2): r8_api_surface 14 tests, 3 fail -> 0; sec2_all_schema_definer_rls 33, 1 -> 0; schema 567, 1 -> 0; sec2_definer_rls, evidence_trigger_catalog,
p240_authority, ev_eb_publication_scope 0 -> 0 (no change needed).

Run 3 classification (12 red files):
- Harness, run order (6): `authentication_foundation`, `login_methods_account_merge`, `phase_02_slice_03_context_projection`, `..._context_switching_01_candidates`, `..._idempotency_expiry`, `..._person_facets`:
  `function plan(integer) does not exist`; those files do not install pgtap and sort before any file that does. Run 4 (a pgtap-installing file first) is 299/299.
- Fixture breakage by promoted Slice 12 schema (5 files, aborts or failures, no assertion wrong): see Open items.
- Known dependency (1 failure): `helpers_preflight` #14 (registry vs TypeScript registry) needs the unpromoted locale-gate pair (baseline-repair run 8: 226/226 with it); not touched.

## Test corrections
All additive; no expectation dropped or weakened.
1. `phase_02_slice_09_r8_api_surface.sql` (AC180): `r8a_supporting` gains 19 service-role-only, Worker-called RPCs; counts 54 -> 73 supporting, message `8 + 10 + 73`, derived total 72 -> 91.
   Each entry cites its promoted migration; BE03c rows from the route registry (BE03c 158-179, 187-188):
   - `cms_submit_governed_review` (20261013300810, CMS-03C-06), `cms_record_governed_decision` (20261014010210, -07), `cms_assign_governed_reviewer` (20261014010110, -08),
     `cms_get_governed_review` (20261014010310, -10), `cms_list_governed_reviews` (20261014010410, -11), `cms_activate_governed_subject` (20261014070410, -09);
   - `cms_claim_due_governed_activations` (20261014070510), `cms_execute_governed_activation` (20261014070610): CMS-03C-19 scheduled sweep;
   - `cms_create_pattern_version` (20261014020500, CMS-03C-12), `cms_pattern_latest` (20261014020500, cmsPatternLatestRead), `cms_insert_pattern_instance` (20261014110400, -02),
     `cms_list_pattern_selector` (20261014140310, -13);
   - `cms_create_taxonomy_version` (20261014030300, -16), `cms_list_taxonomy_versions` (20261014030400, cmsTaxonomyVersionsRead), `cms_act_taxonomy_term` (20261014120510, -03),
     `cms_list_taxonomy_terms` (20261014120610, cmsTaxonomyTermsRead), `cms_list_taxonomy_selector` (20261014120710, -17),
     `cms_run_taxonomy_merge_converge` (20261014120310, BE00 job `cms.taxonomy.merge_converge`, BE03c 1370);
   - `cms_curate_related_content` (20261014060500, -05).
   Every one is `service_role` execute only (grep of the migrations; tests 10, 12 pass in run 2), and every one is called by the Worker (grep `apps/worker/src`), so none is `internal`.
   Header comment gains a Slice 12 paragraph.
2. `phase_02_slice_09_sec2_all_schema_definer_rls.sql` #6: the pinned forced-table set gains nine tables (76 -> 85), replaced from the live `have` list of run 1 and verified as exactly those nine additions:
   `cms_canonical_domain_registry` (force RLS 20261013300100:57), `cms_governed_{activation_schedules (20261013300700:145), review_assignments, review_decisions, review_dependencies, reviews}`
   (dynamic force loop 20261013300200:223), `cms_related_content_rules` (loop 20260927310000:109; read by `cms_related_content_public_targets`, 20261014060200), `cms_term_labels`
   (20260927260000; written by `cms_act_taxonomy_term`), `role_facet_assertion` (force 20260901030000:494; a Slice 02 table, named only by `cms_canonical_taxonomy_match`
   20261014120100:146 through the column grant `(facet_code, state)`, BE03c CMS-03C-18). The same suite's tests 10-12 (covering privilege, permissive policy, least privilege) were green in run 1 for
   all nine, so no grant is dead; forced-RLS state is read from the live catalog by the suite itself. A comment block above the assertion names each source.
   (`role_facet_assertion` and `cms_term_labels` were absent from the baseline-repair report's list of seven; they appear only now that taxonomy-terms is promoted.)
3. `phase_02_slice_09_dec108/06-trigger-probes.sqlinc`: one row `('cms_terms', 'cms_terms_00_lineage_fill', 'cms_terms_lineage_fill', 7)` (BEFORE INSERT FOR EACH ROW = tgtype 7;
   20261014120000:117, BE03c 1371 lineage fill). `012-trigger-catalog.sqlinc`: inventory count 148 -> 149 (message updated). Schema #448 had exactly this trigger outside the inventory; #451 count agrees.
   The generic-guard behavioural probes need no entry (this is neither `cms_write_guard` nor `cms_immutable_guard`).

## Spec citations
BE03c route registry 158-179 (CMS-03C-01..17, cmsPatternLatestRead 165, cmsTaxonomyVersionsRead 166, cmsTaxonomyTermsRead 167), 187-188 (CMS-03C-18/-19), 1370 (merge-converge job),
1371 and 1428 (term lineage), 1425 (instance position, DEC-185); BE03a/b R8 rules in the suite header (AC180 exact-set guard); SEC-2 AC181 (definer-role forced tables).

## Open items / BOUNDARY
Fixture breakages found by run 3, NOT fixed (outside this lane: they are not pin lists, and four of the sites are the shared helper files lane-rules forbid editing). All are one-line shape repairs
caused by promoted Slice 12 migrations; none is a defect of the objects:
1. `cms_composition_instances.position integer NOT NULL` (20261014110000, DEC-185) and no default. Plain/raw instance INSERTs omit it (23502). Add `position` (0 is valid: `check (position >= 0)`, non-unique index) at:
   `supabase/tests/phase_02_slice_11_helpers/001-world.sqlinc:345` (h11w_instance), `.../003-registry.sqlinc:88` (h11m_instance), `supabase/tests/phase_02_slice_10_signed_read/002-compare-helpers.sqlinc:105`,
   `supabase/tests/phase_02_slice_11_e2_composition_guard.sql:44` (fails #5 and #7, 23502 instead of ok / 23503), `supabase/tests/phase_02_slice_11_helpers_manifest.sql:363,368`.
   Fallout: `helpers_references` aborts at :101 (16 of its tests run), `helpers_preflight` aborts at :421 (82 of 165), e2_composition_guard #5/#7.
2. `cms_terms.taxonomy_id uuid NOT NULL` (20261014120000). `h11_raw_exec` disables user triggers, so the lineage-fill trigger does not run for raw term rows; the rows need `'taxonomy_id', pg_temp.h11w_uuid('tax1')`
   (the version-1 row's id is its lineage id, 20261014030000) at `phase_02_slice_11_helpers_manifest.sql:47-52` (aborts at :56, 7 of 92 tests run), `phase_02_slice_11_recheck_index.sql:105-110` (aborts, 15 of 17),
   `phase_02_slice_11_recheck_run.sql:38-45` (aborts, 8 tests). `helpers_references.sql:126` uses a plain insert and is unaffected.
After those fixes helpers_manifest's four DEC-186 version-2 cases and the rest of those files have not run on promoted-only migrations since placement/terms were promoted, so further latent reds behind the aborts are possible.
- `helpers_preflight` #14 and `criteria_publish_gates` #32/#33: need locale-gate (owner decision F4), unchanged from the baseline-repair report.
- No BOUNDARY stubs.

## Pass C (pins the WIP pattern-updates 14/15 and locale-gate will need when they promote; static read of the WIP files, to be confirmed by the first run on promotion)
- `r8_api_surface`: `r8a_supporting` + `cms_get_instance_update_diff` (20261014140410, CMS-03C-14) and `cms_apply_pattern_update` (20261014140610, CMS-03C-15) -> 75 supporting, total 93; message `8 + 10 + 75`.
  Both are `grant execute ... to service_role` only (`140410:32`, `140610:50`).
- `sec2_all_schema_definer_rls` #6: pattern-updates adds no `create table`; its definer functions name `cms_composition_instances` and `cms_pattern_versions`, both already pinned, so no table is expected. Confirm on the first run.
- Trigger inventory: pattern-updates and locale-gate create no trigger (grep of both directories), so 149 stays. The one DDL change is column `cms_composition_instances.pending_pattern_version` (20261014140000): the column
  is not pinned by any suite found in the sweep; the `schema`/`composition_*` suites will show it if it is.
- locale-gate (050600, 050700) replaces `create or replace` functions only: no table, trigger or platform_api function; the only known consumer is `helpers_preflight` #14 / `criteria_publish_gates` #32/#33.
- `db:types` and a final r8 count happen at promotion (root).

## Requests to root
1. Review the exception: `phase_02_slice_09_dec108/06-trigger-probes.sqlinc` (+ `012-trigger-catalog.sqlinc`) edited under brief item 3, same as baseline-repair.
2. Authorize or dispatch the fixture repairs in Open items 1-2 (they include four files in directories lane-rules mark as shared helpers). Mechanical; I can do them in a follow-up lane.
3. Decide F4 (locale-gate) to clear preflight #14 and publish_gates #32/#33.
