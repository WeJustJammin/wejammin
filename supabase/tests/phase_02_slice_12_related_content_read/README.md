# Slice 12 related-content read fragments (lane dec195)

Fragments (`*.sqlinc`) of `../phase_02_slice_12_related_content_read.sql`, the `cmsRelatedContentRead` suite (DEC-195;
BE03c route registry, `cmsRelatedContentRead | entryId`, error matrix, catalog and authority rows). They are includes,
not discovered tests: the executable suite opens one transaction, includes the Slice 10 and Slice 11 preludes, the
CMS-03C-05 world (`../phase_02_slice_12_related_content/000-helpers.sqlinc` and `001-world.sqlinc`) and then these
fragments with psql `\ir`, and rolls back.

| Fragment                      | Content                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------- |
| `000-helpers.sqlinc`          | `pg_temp.r195_*` callers (by tag, by raw id, by raw request), caller switch, the evidence counter       |
| `001-shape-and-grants.sqlinc` | function shape, ownership, search path, grants, no write or lock in the reader                          |
| `002-read.sqlinc`             | null, read-equals-write, derived rule, replacement, exclusion order, revoked => null, stored as written |
| `003-authority.sqlinc`        | editor/author access, 403 vs 404, parity with CMS-03C-05, validation-first order, no session            |

## Adding a case

Write through `pg_temp.r12_curate(pg_temp.r12_req(tag, pins, exclusions, rule, key))` and read through
`pg_temp.r195_read(tag)`. Each group owns its own `src*` entry so versions never couple groups. Fixture changes made
by hand must say so in a comment and go through `pg_temp.r12_safe` / `pg_temp.h11_raw_exec`.

## Related paths

- `../phase_02_slice_12_related_content/` (the CMS-03C-05 world these fragments reuse; never edited here)
- `../../migrations/20261014200000_cms_get_related_content.sql` and `20261014200010_cms_get_related_content_public.sql` (promoted)
- `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`
