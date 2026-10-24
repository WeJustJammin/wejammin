# Slice 12 composition-instances read fragments (lane dec206)

Fragments (`*.sqlinc`) of `../phase_02_slice_12_composition_instances_read.sql`, the `cmsCompositionInstancesRead` suite (DEC-206;
BE03c route registry, validation row `cmsCompositionInstancesRead | entryId/cursor/limit`, schemas, error matrix, authority row, and the
BE00 signed-cursor rules of the 2026-10-22 alignment). They are
includes, not discovered tests: the executable suite opens one transaction, includes the DEC-108 prelude, the pattern-definition and
placement fixtures and the pattern-updates helpers, then these fragments with psql `\ir`, and rolls back. Stage the standard stack
`pattern-updates,dec193,dec194,dec195,locale-gate,dec197,dec202,dec205,dec206,governed-recheck,block-rules,fix-dec193`
(the effective-composition adapter, `pending_diff` and the render plan are unpromoted; the fixture's real detach calls a `block-rules`
function through the detach writer (`dec193/20261016040800` after the DEC-215 squash), so a stack without `block-rules` fails the detach setup).
The Vault cursor key is created in `002-shape-and-grants.sqlinc` after the no-key case, as in the CMS-03C-13 selector suite.

| Fragment                           | Content                                                                                                                                                                                                   |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `000-helpers.sqlinc`               | the call runner with full before/after images, request builders, refusal checker, resource and render-plan oracles                                                                                        |
| `001-world.sqlinc`                 | six real patterns, a real template, the entries (ordering, heads, detach, empty, no revision, 512 rows) and the labelled fixture writes                                                                   |
| `002-shape-and-grants.sqlinc`      | function shape (reader, signed wrapper, transport), ownership, search path, grants, no write or lock in the reader, the no-Vault-key case                                                                 |
| `003-order-and-heads.sqlinc`       | position-before-path order, slot ordinals, newest-per-path, pending_diff, detached, empty pages, render-plan parity                                                                                       |
| `004-paging.sqlinc`                | limit 1-50 default 25 over 512 rows, the sealed cursor envelope, every cursor fault (tampered, expired, over-lived, cross-context, foreign domain) as 400, positional stability, a changed draft revision |
| `005-authority-and-grammar.sqlinc` | 403 vs 404 vs 401, validation (including `limit`) before concealment, cross-actor cursor reuse, read leaves no trace                                                                                      |

## Adding a case

Place through `pg_temp.s12pu_place` or `pg_temp.s12pl_run(pg_temp.s12pl_request(...))`, read through `pg_temp.s12ci_read(label, tag, cursor, actor, role, limit)` and
compare with `pg_temp.s12ci_expect(tag, paths)`. A fixture write that no producer can make must be labelled in `001-world.sqlinc`.

## Related paths

- `../phase_02_slice_12_pattern_updates_common/` (shared helpers; never edited here)
- `../../migrations/20261022050000_cms_list_composition_instances.sql` and `20261022050010_cms_list_composition_instances_public.sql` (promoted)
- `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`
