# Lane claude_s12_db9b WIP (timestamps 20261031105000 .. 20261031109999)

No migration yet. STOP FOR ROOT (debug-by-test): the RED suite `supabase/tests/phase_02_slice_12_gaps_db9b_legacy_forest_red.sql`
(seven `[RED]` tests, shared fixtures in `supabase/tests/phase_02_slice_12_gaps_db9b_legacy_forest/`) shows that

1. the publication pattern provider (`cms.pattern.active_digest`, `platform_private.cms_pattern_live_pin_reason`) answers `passed` for a revision that
   pins an ACTIVE stored pattern nested ten levels deep, and for one that expands to 544 block roots;
2. CMS-03C-02 placement (`platform_private.cms_pattern_placement_nodes` / `cms_pattern_placement_plan`) places the ten-level pattern; it refuses the 544-root
   one with `pattern_nodes_exceeded`.

Spec: BE03c 1678 ("enforce protected depth/node/slot counts before save and again before publish"), 388 and 1694 (placement "max protected depth/nodes",
"expand graph with cycle/depth/node checks"); ledger P2-S12-AC-211 clause "again before publish".  BE03c 1585 lists only `pattern_not_active`,
`nested_pattern_not_active`, `pattern_digest_changed` and `pattern_block_rules_violated` as provider reasons, so the fix needs a root decision first:

| Option | What changes | Cost |
| ------ | ------------ | ---- |
| A (recommended) | placement refuses nesting >= 9 with `pattern_depth_exceeded` (the producer's own rule, `cms_pattern_nested_closure` depth >= 9, at `/patternId`, 422); the provider fails the category with `pattern_depth_exceeded` / `pattern_nodes_exceeded` | BE03c 1585 reason list and precedence amended; preflight reason tokens in packages/contracts and the web copy; anchored-replacement migrations for `cms_pattern_live_pin_reason`, `cms_pattern_active_digest`, `cms_pattern_placement_plan` |
| B | provider only; placement keeps its documented 128-level runaway guard | smaller; leaves the BE03c 388/1694 placement wording unmet for depth |
| C | accept as designed: no producible production row has these shapes (the table CHECK bounds a literal tree, CMS-03C-12 bounds the expanded graph); amend BE03c 1678 to say the bounds are re-proved at placement for the node count only | spec edit only; the RED suite becomes a BOUNDARY note |

`pattern_cycle` needs no change: it is not producible (see the BOUNDARY facts in `010-facts.sqlinc`).
Nothing in this directory is applied by `supabase db reset`, `pnpm db:verify` or CI.
