# phase_02_slice_12_nestable_read

pgTAP suite of `cmsPatternNestableRead` (DEC-196, DEC-232; BE03c route row 184, validation row 413, `PatternNestableQuery`,
error row 1427, authority row 1665). The entry file `../phase_02_slice_12_nestable_read.sql` includes the shared fixtures
(never edited here) and these parts in order:

| File                      | Proves                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------ |
| `000-helpers.sqlinc`      | the call harness (real role, flag before/after, full store snapshots), the request and oracle builders |
| `001-world.sqlinc`        | real active, superseded, draft and (later) retired patterns over three content types                   |
| `010-lists.sqlinc`        | shape and grants; every-type compatibility both ways; the item oracle; pageVersion                     |
| `020-paging.sqlinc`       | keyset paging, the signed cursor bound to type set, limit, actor and domain                            |
| `030-grammar.sqlinc`      | strict query, validation before authority, hidden/absent types                                         |
| `040-authority.sqlinc`    | designer-only, concealment, real database roles, context-cleared call with negative control            |
| `050-follows-data.sqlinc` | activation widening a version, then a governed retirement                                              |
| `060-reserved-key.sqlinc` | `nestable` is a reserved pattern key (DEC-232): save, latest read, storage constraint                  |

To add a case: add the pattern to `001-world.sqlinc` with its types, extend the expectation arrays in `010-lists.sqlinc`.
Related: `../phase_02_slice_12_pattern_selector/` (the author-facing CMS-03C-13 precedent).
