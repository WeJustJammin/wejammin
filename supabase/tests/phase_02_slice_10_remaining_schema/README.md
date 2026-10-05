# Slice 10 remaining support-table pgTAP fragments

The executable `../phase_02_slice_10_remaining_schema.sql` is the single
Supabase discovery entrypoint. It opens one transaction, establishes the pgTAP
plan, then includes these fragments in numeric order with psql `\ir`
directives. The final fragment returns control to the entrypoint for
`finish()` and `rollback()`. These assertions mirror the BE03b canonical
records for the six editorial support tables and are written so an absent
forward migration (`20260927090000_cms_editorial_support_authority.sql`)
produces evidence-backed RED rather than a silent pass.

Keep fragments ordered and below the repository's 400-line test cap. The
fragments are includes, not independently discovered Supabase test files.

| Fragment                                      | Coverage                                                                                               |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `000-helpers.sqlinc`                          | OID-resolving read-only inspectors for columns, CHECK unions, FKs, triggers, indexes and grant posture |
| `001-presence-and-reviews.sqlinc`             | `EditPresence` and `EditorialReview` canonical records: columns, unions, defaults and guard rails      |
| `002-decisions-schedules-publications.sqlinc` | `EditorialDecision`, `PublicationSchedule` and `PublicationVersion` canonical records                  |
| `003-tokens-security-indexes.sqlinc`          | `PreviewToken` canonical record plus RLS, grant, guard and index posture across all six support tables |

## Adding tests

Append a new numbered fragment, then register it in the entrypoint's `\ir`
list in numeric order. Reuse the `000-helpers.sqlinc` OID inspectors so a
missing table yields `false` or an empty result instead of aborting the run;
that keeps RED evidence complete across every absent object. Assert exact
column sets, closed unions and enforcement posture rather than existence alone.

## Conventions

- One BE03b canonical-record group per fragment; keep table coverage in the
  fragment whose name names it.
- Inspect by OID and treat absence as RED evidence; never raise past a missing
  object before later fragments can report.
- Everything runs inside the entrypoint's rolled-back transaction.

## Related paths

- `../phase_02_slice_10_remaining_schema.sql` — executable entrypoint
- `../phase_02_slice_10_schema/` — Slice 10 table foundation suite
- `../phase_02_slice_10_rpc/` — CMS-03B RPC suite
- `../phase_02_slice_10_conflict_schema/` — DEC-107 conflict-record suite
- `.memory/wiki/specs/be/03b-editorial-workflow-publication.md` — canonical
  record definitions these fragments mirror

## Local run

```sh
node_modules/.bin/supabase test db --local supabase/tests/phase_02_slice_10_remaining_schema.sql
```

This suite is local-only evidence. It makes no hosted or acceptance claims.
