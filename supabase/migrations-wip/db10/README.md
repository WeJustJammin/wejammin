# Lane claude_s12_db10 WIP (timestamps 20261031110000 .. 20261031119999)

Round 1: provider and placement (110000-110200). Round 2 (sweep of every expander of a pattern forest): 110300-110700.

DEC-247: the CMS-03C-12 depth and node bounds are re-proved before publish (the `cms.pattern.active_digest` provider) and at CMS-03C-02 placement.
Three anchored replacements of installed private functions (each anchor occurs exactly once, the inverse restores the installed source byte for byte,
every `pg_proc` attribute except the source is unchanged, the comment is restated). Forward-only; root promotes them in this order.

| File | Function | Change |
| ---- | -------- | ------ |
| `20261031110000_cms_pattern_placement_nodes_depth.sql` | `cms_pattern_placement_nodes` | outermost call: `cms_pattern_nested_closure` depth >= 9 raises `pattern_depth_exceeded` at `/patternId` (covers `cms_pattern_placement_plan` and `cms_pattern_placement_selected_plan`) |
| `20261031110100_cms_pattern_live_pin_reason_bounds.sql` | `cms_pattern_live_pin_reason` | after nested activity, before the digest check: `pattern_depth_exceeded`, then `pattern_nodes_exceeded` (more than 512 expanded block roots) |
| `20261031110200_cms_pattern_active_digest_bounds.sql` | `cms_pattern_active_digest` | category precedence: not_active, nested_not_active, depth_exceeded, nodes_exceeded, digest_changed, block_rules_violated |
| `20261031110300_cms_pattern_expanded_root_count.sql` | `cms_pattern_expanded_root_count` (new) | cheap probe: block roots after top-level expansion, counted without expanding, capped at 513 |
| `20261031110400_cms_pattern_update_nodes_bounds.sql` | `cms_pattern_update_nodes` | outermost call: closure depth >= 9 raises `pattern_depth_exceeded`, more than 512 expanded roots `pattern_nodes_exceeded`, both at `/patternId` (covers CMS-03C-14 diff, CMS-03C-15 accept/detach, restore, DEC-210 rules, read adapters) |
| `20261031110500_cms_apply_pattern_update_bounds.sql` | `cms_apply_pattern_update` | CMS-03C-15 accept names `/targetPatternVersion` for the two bound tokens (as for `nested_pattern_not_active`) |
| `20261031110600_cms_restore_composition_refs_bounds.sql` | `cms_restore_composition_refs` | `pattern_nodes_exceeded` joins the tokens mapped to the restore's `migration_chain_incomplete` |
| `20261031110700_cms_composition_effective_nodes_bounds.sql` | `cms_composition_effective_nodes` | the read adapter under manifest builder, render plan, checker input and list stays total: an over-bound pin reads as its root block, the provider fails the revision |

Tests: `../../tests/phase_02_slice_12_gaps_db9b_legacy_forest_bounds.sql` (db9b, seven former RED assertions, retitled as regression assertions),
`../../tests/phase_02_slice_12_gaps_db10_bounds.sql` (at-bound still passes, aggregation) and
`../../tests/phase_02_slice_12_gaps_db10_update_bounds.sql` (sweep: update expander, accept, detach, render plan, restore).
Nothing in this directory is applied by `supabase db reset`, `pnpm db:verify` or CI until root promotes it.
