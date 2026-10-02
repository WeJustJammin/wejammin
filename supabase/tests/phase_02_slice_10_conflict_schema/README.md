# Slice 10 conflict-record pgTAP fragments

The executable `../phase_02_slice_10_conflict_schema.sql` is the single
Supabase discovery entrypoint. It opens one transaction, establishes the pgTAP
plan, then includes these fragments in numeric order with psql `\ir`
directives. The final fragment returns control to the entrypoint for
`finish()` and `rollback()`. These assertions mirror the frozen BE03b row 12
for `ConflictRecord` / `cms_conflict_records` (DEC-107) and the
`proposed_values` bound hardening in forward migration
`20260927110000`, so an absent migration produces evidence-backed RED rather
than a silent pass.

Keep fragments ordered and below the repository's 400-line test cap. The
fragments are includes, not independently discovered Supabase test files.

| Fragment                            | Coverage                                                                                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `000-helpers.sqlinc`                | OID-resolving inspectors for columns, CHECK unions and constraints; the union check is distinct from the envelope-coupling `state` literal check  |
| `001-conflict-record-schema.sqlinc` | `cms_conflict_records` exact columns, version semantics, closed label unions, hash-shape checks, partial and ordinary indexes                     |
| `002-proposed-values-bounds.sqlinc` | `proposed_values` 256 KiB / depth-8 / 128-key / 128-array ceiling via `platform_private.cms_json_bounded`, proven by CHECK-before-FK differential |

## Adding tests

Append a new numbered fragment, then register it in the entrypoint's `\ir`
list in numeric order. Reuse the `000-helpers.sqlinc` OID inspectors so a
missing table yields `false` or an empty result instead of aborting the run.
For payload-bound work, prefer the CHECK-before-FK differential (23514 on the
named constraint versus 23503 past the bound) instead of standing up the full
entry/revision fixture graph.

## Conventions

- One canonical-record concern per fragment: record shape first, then
  value-bound hardening.
- Assert closed unions and named constraints; treat absence as RED evidence,
  never as a silent pass.
- Everything runs inside the entrypoint's rolled-back transaction.

## Related paths

- `../phase_02_slice_10_conflict_schema.sql` — executable entrypoint
- `../phase_02_slice_10_rpc/` — CMS-03B suite whose revision-write and
  resolver fragments consume this record
- `../phase_02_slice_10_schema/` — Slice 10 table foundation suite
- `../phase_02_slice_10_remaining_schema/` — editorial support-table suite
- `.memory/wiki/specs/be/03b-editorial-workflow-publication.md` — the frozen
  ConflictRecord definition and DEC-107 decision these fragments mirror

## Local run

```sh
node_modules/.bin/supabase test db --local supabase/tests/phase_02_slice_10_conflict_schema.sql
```

This suite is local-only evidence. It makes no hosted or acceptance claims.
