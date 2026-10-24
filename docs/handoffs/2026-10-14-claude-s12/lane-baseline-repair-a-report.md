# Lane baseline-repair-a report

## Status
PARTIAL: all four brief items done; the only remaining reds are the two pin suites the brief tells us NOT to update yet
(`r8_api_surface`, `sec2_all_schema_definer_rls`; exact needs listed under Pin requirements) and two suites that need the
unpromoted `locale-gate` pair (owner decision F4; PASS 226/226 with it).
Final lane-none-plus-mine run (run 7): 22 files, 1421 tests, 1413 ok, 8 not ok, every one classified below.

## Scope
briefs/baseline-repair-a.md. Lane name `baseline-repair`, WIP range 20261014130000-20261014139999.
Brief vs rules note: the lane rules forbid editing shared helpers under `phase_02_slice_11_helpers/`, but the brief
names `phase_02_slice_11_helpers/003-registry.sqlinc` explicitly; I edited only that file there (the brief governs a
named file) and flag it for root review.

## Files
- `supabase/migrations-wip/baseline-repair/20261014130000_cms_dependency_manifest_pattern_version_pin.sql` 82 lines `0e9aac7acd3bb9a9c86e4a8a53560847c419b642933fb4477789585469247445`
- `supabase/tests/phase_02_slice_09_dec108/06-trigger-probes.sqlinc` 227 lines `9fc2cd1accb26ac78d379cf4c559b56cd1ca79c545020f24de154bb4a7c50190`
- `supabase/tests/phase_02_slice_09_schema/012-trigger-catalog.sqlinc` 91 lines `8e1cc27a3b552be48cdad08fb6d8933c7824fcb8cf800fde0455b141f9eb5d00`
- `supabase/tests/phase_02_slice_09_evidence_trigger_catalog.sql` 152 lines `6c894fea28568282e9e855e3a06cbb54476df1478a8b88d51ddc629a793c12c7`
- `supabase/tests/phase_02_slice_09_p240_authority.sql` 335 lines `432cebdc291103d6b2fcd5d092c56d1e87fd635426bc501296dff356a3de3f26`
- `supabase/tests/phase_02_slice_10_ev_eb_publication_scope.sql` 81 lines `2bce54fa39318084b94596b04ac301481e3e345349af5dafff75a7f8791d04b4`
- `supabase/tests/phase_02_slice_11_helpers/003-registry.sqlinc` 112 lines `84265564fc90b36915d36a50f8f4ea3fc16549c1f7a46b1f39d7b4f7ee3fe861`
- `supabase/tests/phase_02_slice_11_criteria_publish_gates.sql` 366 lines `7451222ed037941589ec61a510d190fd8dbbc8656748d0062c4088f6d669f9ba`
- `supabase/tests/phase_02_slice_11_helpers_manifest.sql` 693 lines `07061426e324bd8847d0f8181fa4f5ef6cb49e47d9b78b9acf56e75814d2b82f`
- `supabase/tests/phase_02_slice_11_helpers_preflight.sql` 891 lines `2cae4edafeb6b670b8c29548fe8b18f8fc934ebfa3bc7c47ebb6468a6238fbc2`
- `supabase/tests/phase_02_slice_11_helpers_references.sql` 335 lines `26720bd856e2dfc5b2f9b45c861424d2179e4fc465acfd6ee02d5049bda2788f`
- `supabase/tests/phase_02_slice_11_recheck_run.sql` 386 lines `a2cba2498f1812117d6673776038041222caa3ab94bd0613ff56c602b98ee3de`
- `supabase/tests/phase_02_slice_12_composition_authority.sql` 187 lines `a0582f58146a82f582b7c43b461366b61d9c3fd6dc1acfac9fad3b772ffab0fa`
- `supabase/tests/phase_02_slice_12_composition_instance_guards.sql` 135 lines `aae964f32eeb9e54c888deaec6f0745bd224c1f350031e780255349316566000`
- `supabase/tests/phase_02_slice_12_composition_owner_integrity.sql` 156 lines `f65441af44a9164b4cea24aa4ed791419c250141973f0ebb8398efd92550a81c`
(`recheck_locale_source`, `recheck_relay`, `preflight_registry_schema`, `locale_fanout_branch`, the locale/taxonomy/template S12 suites carry the locale and other lanes' edits, not mine.)

## Runs
| # | time | stamp / lane | plan | result | TAP |
|---|------|--------------|------|--------|-----|
| 1 | 17:18 | baseline-repair, 11 files | - | harness: template raw row missing lifecycle_version (003-registry:111) after pattern rows fixed | alt-staged-baseline-repair-171802-1553325.tap |
| 2 | 17:19 | baseline-repair, 11 files | 492 run | 4 fail: #27/#55 helpers_manifest (new RED v2 pin, expected), preflight #14/#94 (locale-gate unpromoted), publish_gates abort (template raw row line 45) | alt-staged-baseline-repair-171851-1559856.tap |
| 3 | 17:20 | baseline-repair,locale-gate | 454 | manifest #27/#55 still RED (expected), preflight aborts :540 duplicate registry version 2 (locale gate now owns v2) | alt-staged-baseline-repair+locale-gate-172030-1570902.tap |
| 4 | 17:22 | baseline-repair,locale-gate (with 20261014130000) | 454 | all green except preflight harness error (column name) | alt-staged-baseline-repair+locale-gate-172232-1584310.tap |
| 5 | 17:23 | baseline-repair,locale-gate preflight only | 165 | PASS 165/165 | alt-staged-baseline-repair+locale-gate-172313-1589256.tap |
| 6 | 21:35 | baseline-repair: schema, evidence_trigger_catalog, p240_authority, ev_eb_publication_scope | 714 | 712 ok / 2 not ok: only the EMPTY-table list (schema #538, evidence_trigger_catalog #44) missing the five governed tables; p240 #76, schema #448 (trigger inventory), ev_eb #2 all PASS | alt-staged-baseline-repair-213433-2545651.tap sha 6b338a2f |
| 7 | 21:36 | baseline-repair, 22 files (all affected suites + r8/sec2 pin diagnostics) | 1421 | 8 not ok, classified: criteria_publish_gates #32/#33 and helpers_preflight #14/#94 (locale gate absent, see Open items); r8_api_surface #4/#13/#14 and sec2_all_schema_definer_rls #6 (pins deferred by brief). All other 14 suites fully green, incl. item 1, manifest v2 pin, schema #448/#538, evidence_trigger_catalog, p240 #76, ev_eb #2 | alt-staged-baseline-repair-213603-2555183.tap sha 0cdfa78c...d087b6 |
| 8 | 21:38 | baseline-repair,locale-gate: criteria_publish_gates, helpers_preflight, preflight_registry_schema | 226 | PASS 226/226 (proves the 4 locale-gate reds are exactly that dependency) | alt-staged-baseline-repair+locale-gate-213806-2569001.tap sha 48f37b33...a44d |

## Test corrections
All are fixture-shape repairs (no assertion weakened). Cause: Slice 12 changed `cms_pattern_versions`
(lineage columns, forest CHECK, node_count, compatible_type_ids; 20261014020100) and `cms_template_versions`
(lifecycle_version NOT NULL, 20261013300000); raw `jsonb_populate_record` inserts write NULL for absent keys.
- `phase_02_slice_11_helpers/003-registry.sqlinc`: new `pg_temp.h11m_pattern_row(...)` builds a valid PatternVersion
  row image (ordered forest, world typeId, node_count 1, lineage columns, lifecycle_version 1); the two pattern rows
  use it; template raw row gains `'lifecycle_version', 1`; `h11m_instance` gains trailing `p_pattern_version` (default 1,
  backward compatible).
- `phase_02_slice_11_criteria_publish_gates.sql:45` template raw row gains `'lifecycle_version', 1`.
- `phase_02_slice_11_recheck_run.sql:297`: v2 pattern row via `h11m_pattern_row` with lineage and supersedes ids; the
  predecessor is superseded BEFORE the successor is inserted (one active version per lineage, E14 index).
- `phase_02_slice_11_helpers_references.sql:89`, `phase_02_slice_12_composition_authority.sql:142`,
  `_composition_instance_guards.sql:27`, `_composition_owner_integrity.sql:51`: plain draft inserts gain
  `compatible_type_ids`, `node_count` and a valid forest block_tree (BE03c 1425).
- `phase_02_slice_11_helpers_preflight.sql` (locale lane had already edited :173 and :478 for the gate; not mine):
  the "version-2 row of every provider" seed now uses `registry_version + 1` and its cleanup deletes only rows owned
  by the DEC-134 seed owner with `version > 1`, because with `locale-gate` promoted the locale category already holds
  registry version 2 (unique `(category, version)`); behavior without the gate is identical.
- (checkpoint 3 additions, all pins/inventories of promoted Slice 12 work, none weakened)
  - `phase_02_slice_09_dec108/06-trigger-probes.sqlinc` (named by brief item 3): dropped `cms_entry_revisions_locale_stale`/5
    (retired by 20261014050310), added `cms_content_entries_locale_stale`/`cms_content_entry_locale_stale_trigger`/17 (ROW 1 +
    UPDATE 16, AFTER), and the 14 promoted governed triggers: `cms_canonical_domain_registry` immutable_guard/27 + write_guard/7;
    `cms_governed_{activation_schedules,review_assignments,review_decisions,review_dependencies,reviews}_write_guard` cms_write_guard
    (31 each; schedules 31); `..._decisions_immutable_guard` and `..._dependencies_immutable_guard` cms_immutable_guard/27;
    `cms_governed_reviews_z_state_guard`/31 cms_governed_review_guard; `cms_governed_review_assignments_z_state_guard`/31
    cms_governed_assignment_guard; `cms_governed_review_decisions_z_binding_guard`/7 cms_governed_decision_guard;
    `cms_governed_review_dependencies_z_review_guard`/7 cms_governed_dependency_guard; `cms_governed_activation_schedules_z_state_guard`/31
    cms_governed_schedule_guard (20261013300100:49-54, 300200:230-241, 300600:267-278, 300700:154-159). Schema #448 had exactly these
    14 outside the inventory. Spec: BE03c governed lifecycle storage (append-only decisions/dependencies, state guards).
    NOTE: the lane rules forbid editing `phase_02_slice_09_dec108/`; brief item 3 names this file, so the brief governs. Root review.
  - `phase_02_slice_09_schema/012-trigger-catalog.sqlinc`: pinned inventory count 134 -> 148 (134 - 0 + 14; the locale swap nets 0);
    the EMPTY-table list gains the five governed tables (`cms_governed_activation_schedules`, `..._review_assignments`, `..._review_decisions`,
    `..._review_dependencies`, `cms_governed_reviews`: no producer row in the schema fixture; their producers are proved by the governed suites).
    The canonical registry is seeded by its migration, so it is probed behaviourally, not EMPTY. Explicit listing, never skipped.
  - `phase_02_slice_09_evidence_trigger_catalog.sql`: same five tables added to its EMPTY list.
  - `phase_02_slice_09_p240_authority.sql:234` (#76): the version-column closure regex also accepts `version = 1`
    (`cms_governed_review_decisions`/`_dependencies` pin `version` to exactly 1, 20261013300200:160,199, which closes non-positive values
    strictly more tightly than `> 0`; the baseline had exactly that one class failing).
  - `phase_02_slice_10_ev_eb_publication_scope.sql` #2 (allow-list): adds the five governed-review commands/reads
    `cms_assign_governed_reviewer`, `cms_get_governed_review`, `cms_list_governed_reviews`, `cms_record_governed_decision`,
    `cms_submit_governed_review` (BE03c CMS-03C-06, -07, -08, -10, -11; migrations 300810, 010110, 010210, 010310, 010410), in collation
    order; label updated. CMS-03C-09 `cms_activate_governed_subject` does not match the `review|decision` pattern.
- New tests (RED first): `phase_02_slice_11_helpers_manifest.sql` plan 88 -> 92, four cases pinning version 2 vs
  version 1 of one lineage (build + current), tags P2-S11-AC-088 / AC-090.

## Spec citations
- BE03c :219 / :1426 (pattern_id lineage id, placement pins patternId+patternVersion), 1425 (forest, node_count,
  compatible types), E14; BE03b E1 (frozen manifest, version rows).

## Open items / BOUNDARY
- Preflight #14 and #94 are red without `locale-gate` (held for owner decision F4); they are green with it (run 5).

## Resume notes (checkpoint 3)
- Item 2 scope: only `20261005017560:234` joined a version row id to `instance.pattern_id`. `20261010164100:80-84`
  (`cms_dependency_recheck_lineage`) joins `named.id` (a version ROW id from a dependency index) to sibling rows of one
  `(owner_id, pattern_key)` - correct for lineages; no change needed there (grep of all promoted + WIP migrations for
  `.id = x.pattern_id` finds only the one fixed in 20261014130000).
- On disk from the predecessor, not yet run: `06-trigger-probes.sqlinc` (drop `cms_entry_revisions_locale_stale`, add
  `cms_content_entries_locale_stale`/17) and `phase_02_slice_09_p240_authority.sql:234` (regex also accepts `version = 1`;
  `cms_governed_review_decisions`/`_dependencies` are append-only rows pinned to exactly version 1 by
  `20261013300200:160,199`, which also closes non-positive values; the lane-none baseline had exactly 1 such table failing).
- #448 diagnosis (static): the 14 triggers outside the inventory are the promoted governed-review/registry/schedule triggers:
  `cms_canonical_domain_registry` write_guard/7 + immutable_guard/27; `cms_governed_{reviews,review_assignments,
  review_decisions,review_dependencies}_write_guard` cms_write_guard/31; `..._dependencies_immutable_guard` and
  `..._decisions_immutable_guard` cms_immutable_guard/27; `cms_governed_reviews_z_state_guard`/31 cms_governed_review_guard,
  `cms_governed_review_assignments_z_state_guard`/31 cms_governed_assignment_guard,
  `cms_governed_review_decisions_z_binding_guard`/7 cms_governed_decision_guard, `cms_governed_review_dependencies_z_review_guard`/7
  cms_governed_dependency_guard; `cms_governed_activation_schedules` write_guard/31 + z_state_guard/31 cms_governed_schedule_guard.
- ev_eb #2 diagnosis: new `platform_api` functions matching `review|decision` from promoted governed lanes.

## Item 2 status (production defect F12)
`20261014130000` (WIP, anchored patch of the live `cms_build_dependency_manifest` source, same pattern as 20261014050700): join becomes
`pattern.pattern_id = instance.pattern_id and pattern.version = instance.pattern_version and pattern.owner_id = instance.owner_id`
(the FK key of 20261014020100). RED first: the four new `helpers_manifest` cases (#27/#55 failed on the old join in run 2, expected);
GREEN in runs 4, 7. `20261010164100` `cms_dependency_recheck_lineage` joins version ROW ids to sibling rows of one (owner, key); it was
audited and is correct; `recheck_run` covers a v2 pattern row and is green. Placement R1 (`20261005017560:233-241`) is this same defect, fixed by the same migration.

## Pin requirements (NOT updated, per brief item 4)
- `r8_api_surface` #4/#13/#14: 13 promoted `platform_api` functions are unclassified: `cms_activate_governed_subject`,
  `cms_assign_governed_reviewer`, `cms_claim_due_governed_activations`, `cms_create_pattern_version`, `cms_create_taxonomy_version`,
  `cms_curate_related_content`, `cms_execute_governed_activation`, `cms_get_governed_review`, `cms_list_governed_reviews`,
  `cms_list_taxonomy_versions`, `cms_pattern_latest`, `cms_record_governed_decision`, `cms_submit_governed_review` (service-role only; the supporting set).
  Count pin `8 + 10 + 54` -> 72 + 13 = 85 now. Unpromoted WIP will add 4 more: `cms_insert_pattern_instance` (placement),
  `cms_act_taxonomy_term`, `cms_list_taxonomy_terms`, `cms_list_taxonomy_selector` (taxonomy-terms) -> 89.
- `sec2_all_schema_definer_rls` #6: forced-table set gains `platform_private.cms_canonical_domain_registry`,
  `cms_governed_activation_schedules`, `cms_governed_review_assignments`, `cms_governed_review_decisions`, `cms_governed_review_dependencies`,
  `cms_governed_reviews`, `cms_related_content_rules` (7). #12 and `sec2_definer_rls` #11 (least privilege, schedules) are GREEN now that
  the schedule functions are promoted. Unpromoted WIP `create table`s: none found, so the set is final unless terms/placement add tables.
- Schema trigger inventory: taxonomy-terms WIP adds `cms_terms_00_lineage_fill` (20261014120000:109) -> 149 and a row in the inventory.
- `db:types` and `r8` happen after terms/placement are promoted (root).

## Open items / BOUNDARY (updated)
- `criteria_publish_gates` #32/#33 and `helpers_preflight` #14/#94 require the `locale-gate` pair parked in `migrations-wip/locale-gate/`
  (owner decision F4). Green with it (run 8, 226/226). Not a defect of this lane.
- No BOUNDARY stubs.

## Requests to root
1. Review the two lane-rule exceptions (named-by-brief edits): `phase_02_slice_11_helpers/003-registry.sqlinc` and
   `phase_02_slice_09_dec108/06-trigger-probes.sqlinc` (+ its sibling includes `phase_02_slice_09_schema/012-trigger-catalog.sqlinc`).
2. Decide F4 (locale-gate) to clear the four reds above.
3. After placement and taxonomy-terms are promoted, a short second pass applies the Pin requirements above (r8 89 functions, sec2 7+ tables,
   trigger inventory 149).
