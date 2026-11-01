# Slice 12 pattern-updates shared support (CMS-03C-13, -14, -15)

Support fragments shared by the three pgTAP suites of lane `claude_s12_pattern_updates_sql`:
`supabase/tests/phase_02_slice_12_pattern_selector.sql`, `phase_02_slice_12_pattern_update_diff.sql` and
`phase_02_slice_12_pattern_updates.sql` (BE03c route rows 175-177, "Pattern versions and linked updates (D9, OD-2)",
DEC-181/185/186; tracker P2-S12-AC-106 .. AC-123, AC-219, AC-258, AC-261).

| File                        | Contents                                                                                                                                                                                                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `000-helpers.sqlinc`        | the call runner (role, response headers, full before/after images, the `app.cms_rpc` value before and after each call, optional caller flag), `s12pu_refused`, head-row finders, request builders, the `pending_diff` fixture of a scan output, entry assignment |
| `010-world.sqlinc`          | the real world: nine pattern lineages with successors, a real template and ~50 real placements (all three suites)                                                                                                                                                |
| `020-world-adoption.sqlinc` | the CMS-03C-15 suite's extra world only: block version 2, `pu-v` (block-version adoption), `pu-nn`/`pu-dd` (superseded nested version), two labelled draft-state heads                                                                                           |

Every pattern is created by CMS-03C-12 and activated through the governed chain; every composition row is written by the real CMS-03C-02
producer. The only fixture writes are the `pending_diff` rows the (separate) linked-update scan would append, the two labelled `draft`-state
heads of `020-world-adoption.sqlinc`, the labelled `retired` row of the diff suite (`020-states.sqlinc`) and the constructed live review of AC-219. Run with `pattern-updates` staged (placement, pattern definition and governed activation are promoted).

## How to extend the world

1. A new lineage: `select * from pg_temp.s12pl_pattern('label', 'key', tree, types, activate, parent_version)`. A placement pins the version
   that is active when it runs, so place v1 BEFORE activating v2 (activation supersedes v1).
2. A new placement: `select * from pg_temp.s12pu_place('tag', 'pattern-label', overrides, 'linked' | 'detached', slotPath, templated)`.
3. A new scenario uses its own tag: an update appends rows to the tag's entry, so never reuse a tag across scenarios.
