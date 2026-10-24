# phase_02_slice_12_block_rules

DEC-210 (BE03c "Block composition rules (DEC-210)"): a registered block version's `allowedChildren` and `slotRules` are
enforced wherever a composition tree is written or published.

| Entry file                                    | Covers                                                                                                                       |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `../phase_02_slice_12_block_rules.sql`        | the pure rule check, the registry rules map, CMS-03C-12 save, nested-reference expansion                                     |
| `../phase_02_slice_12_block_rules_legacy.sql` | CMS-03C-02 placement, CMS-03C-15 accept/detach and the `cms.pattern.active_digest` provider over trees saved before the rule |

| Fragment                  | Purpose                                                                                                                                                                                                                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `000-fixture.sqlinc`      | nine signed block registrations with distinct rules; `brb`/`brr` tree builders; `brs_ok`/`brs_refused` save helpers                                                                                                                                                                                                |
| `010-pure.sqlinc`         | `cms_block_rules_violation` and `cms_block_rules_registry`: allowed/disallowed child, empty allow-list, maxNodes/maxDepth at and over, ordering, parent resolution, fail-closed cases                                                                                                                              |
| `020-save.sqlinc`         | CMS-03C-12: acceptance at each limit; refusals with the offending node's `/blockTree/...` pointer                                                                                                                                                                                                                  |
| `030-nested.sqlinc`       | nested pattern references expanded across each boundary; the reference node is the pointer                                                                                                                                                                                                                         |
| `040-legacy-setup.sqlinc` | pre-rule state written by the real producers while one enforcement function is a no-op in this rolled-back transaction, then restored and asserted identical                                                                                                                                                       |
| `050-placement.sqlinc`    | `/roots` and `/patternVersion` pointers (node count, empty allow-list, depth); only the written roots are checked                                                                                                                                                                                                  |
| `060-updates.sqlinc`      | `/instances/{i}/choices` (accept) and `/instances/{i}` (detach), including instance index 1; mixed ancestor/descendant answers; pre-rule target trees; empty allow-list and depth through the wrappers                                                                                                             |
| `070-provider.sqlinc`     | `pattern_block_rules_violated` (live pin, canonical tree, empty allow-list, depth), precedence of `pattern_not_active`, frozen status; multi-pin reason precedence (BE03c "Preflight providers registered by Slice 12"): every ordered pair of the four reasons, in both pin orders, with one unit per failing pin |

Add a rule case by registering a block in `000-fixture.sqlinc` (never insert into the registry) and a tree in the matching
fragment. The pre-rule state is produced only through `brt_stub` / `brt_restore`; every refusal assertion runs on the restored function.
