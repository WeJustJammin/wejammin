# Slice 12 pattern update diff (CMS-03C-14) pgTAP support

Fragments of `supabase/tests/phase_02_slice_12_pattern_update_diff.sql`: `GET .../compositions/instances/{instanceId}/update-diff` ->
`platform_api.cms_get_instance_update_diff` -> `platform_private.cms_get_instance_update_diff` (BE03c 176, 399, 1267, 1367, 1475; tracker
P2-S12-AC-112 .. AC-117, AC-258).

| File                   | Contents                                                                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `000-schema.sqlinc`    | catalog and grants, the `pending_pattern_version` column rule                                                                                      |
| `010-diff.sqlinc`      | the three-way diff by hand-written expected documents: theirs-only, collisions, equal-to-base, null override, removed root, nested chains, targets |
| `020-states.sqlinc`    | a `pending_diff` row, a non-head (history) version row answered with no update, a non-pattern row, a labelled retired fixture row                  |
| `030-bounds.sqlinc`    | 128 changed paths (each side) and the 256 KiB byte bound (262144 answered, 262145 refused, the length computed from a measured probe)              |
| `040-authority.sqlinc` | assigned author/editor, concealment, request grammar, privileges                                                                                   |

The shared world is in `../phase_02_slice_12_pattern_updates_common/`. Add a diff case with `s12pu_diff_head(label, tag, path)` and
`s12pdf_check(...)`, writing the expected `paths` document by hand from the trees in `010-world.sqlinc`.
