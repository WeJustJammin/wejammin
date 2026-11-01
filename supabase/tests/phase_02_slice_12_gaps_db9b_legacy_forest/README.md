# Slice 12 legacy-forest suites (lane claude_s12_db9b, item 4)

P2-S12-AC-211 "refused before save and again before publish" (BE03c 1678): what the publication-side pattern provider
(`cms.pattern.active_digest`) and CMS-03C-02 placement do with an ACTIVE legacy stored forest the producer would refuse today.

| File | Contents |
| ---- | -------- |
| `000-world.sqlinc` | the real nested chain p1..p9 and `roots32`; the hand-built legacy rows `l-deep` (nested ten levels) and `l-wide` (17 pins of a 32-root pattern, 544 block roots) made active by the real governed chain; the cycle shapes; the pinned revisions and the provider/placement recordings |
| `010-facts.sqlinc` | everything that passes today, including the BOUNDARY facts showing a `pattern_cycle` is not producible |
| `020-red.sqlinc` | the bound re-checks (DEC-247): written RED by lane db9b, regression assertions since lane db10's migrations |

Entry points: `../phase_02_slice_12_gaps_db9b_legacy_forest.sql` (world + facts, GREEN) and
`../phase_02_slice_12_gaps_db9b_legacy_forest_bounds.sql` (world + bound re-checks; green with supabase/migrations-wip/db10, DEC-247/DEC-248).

To add a shape: hand-build a draft with `pg_temp.d9l_draft`, activate it with `pg_temp.s12pl_activate`, pin a revision with `pg_temp.s12pc_seed` and
read the provider with `pg_temp.d9l_provider`.
