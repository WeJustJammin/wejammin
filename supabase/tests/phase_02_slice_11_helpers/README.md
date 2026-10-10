# Slice 11 shared-helper pgTAP fragments (lane S11-3s)

Fragments (`*.sqlinc`) for the Slice 11 shared SQL helpers that the review, publication, preview and read
commands call: the acting-context hash, the revision reference counter, the version-set projection, the
qualifying-approver counters, the derived revision state (E2), the settings snapshot (E7), the frozen dependency
manifest, the D19 preflight registry evaluation, the review invalidation core, the publication lineage append (E3)
and the pinned tzdb release. They are includes, not discovered tests: each executable
`../phase_02_slice_11_helpers_*.sql` opens one transaction, includes the fragments with psql `\ir`, and rolls back.

| Fragment                                    | Content                                                                                                                                                                                                                            |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `000-helpers.sqlinc`                        | `pg_temp` probes: statement outcome (`00000`, `P0001:<message>` or the SQLSTATE), scalar and JSON readers, definer/return-type/volatility inspectors that answer false or empty for an absent object, SHA-256 and raw table writes |
| `001-world.sqlinc`                          | the `h11doc` content type created by the real `cms_create_type_draft` RPC, with one field of every kind the manifest, the reference counter and the preflight providers read, activated with the seeded editorial workflow policy  |
| `002-reviews.sqlinc`                        | review builders written through the real data-model guards: members with standing grants, reviews, assignments and decisions (decision row first, then the review CAS)                                                             |
| `003-registry.sqlinc`                       | block, lifecycle, template, pattern and taxonomy registry fixtures (`h11m_block`, `h11m_lifecycle`, `h11m_instance`)                                                                                                               |
| `004-lineage.sqlinc`                        | publication-lineage builders shared by the two lineage entrypoints (`h11l_review`, `h11l_publish`, `h11l_tombstone`, `h11l_append`, `h11l_rows`)                                                                                   |
| `005-schedule-precision-expressions.sqlinc` | SELECT-only projections of complete installed schedule arithmetic expressions, with unique extraction and a closed lexical vocabulary; no RPC, persistent fixture, clock override or imported TAP assertions                       |
| `version-set-parity.sqlinc`                 | one JSON fixture file read by BOTH the SQL projection test and the TypeScript `versionSetOf` / `versionSetMatchesManifest` test, so the two implementations cannot drift                                                           |

| Entrypoint                                             | Covers                                                                                                                                                                                                            |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `../phase_02_slice_11_helpers_acting_context.sql`      | `cms_acting_context_version`: the capability snapshot hash                                                                                                                                                        |
| `../phase_02_slice_11_helpers_references.sql`          | `cms_revision_references`: the reference counts the generic reference gate consumes                                                                                                                               |
| `../phase_02_slice_11_helpers_version_set.sql`         | `cms_version_set_of` and `cms_version_set_matches_manifest` (canonical lists, parity fixture)                                                                                                                     |
| `../phase_02_slice_11_helpers_approvers.sql`           | qualifying decisions and distinct approvals (DEC-136)                                                                                                                                                             |
| `../phase_02_slice_11_helpers_effective_state.sql`     | `cms_revision_effective_state(s)`: the derived `EntryRevisionState` (E2)                                                                                                                                          |
| `../phase_02_slice_11_helpers_settings.sql`            | settings keys, registry version, effective values and the settings snapshot (E7)                                                                                                                                  |
| `../phase_02_slice_11_helpers_manifest.sql`            | `cms_build_dependency_manifest`, its bounds and the strict structure validator (E1)                                                                                                                               |
| `../phase_02_slice_11_helpers_preflight.sql`           | the seventeen-category preflight registry and `cms_evaluate_preflight` (D19, DEC-134)                                                                                                                             |
| `../phase_02_slice_11_helpers_invalidation.sql`        | `cms_invalidate_editorial_review`: the one invalidation core and its schedule cancellation                                                                                                                        |
| `../phase_02_slice_11_helpers_lineage.sql`             | `cms_append_publication_lineage`: append-only lineage, tombstones, head and lineage lock (E3)                                                                                                                     |
| `../phase_02_slice_11_helpers_lineage_append_only.sql` | the lineage is append-only, observed: competing writer refused as publication_conflict, earlier rows unchanged, no UPDATE/DELETE privilege, table guard refuses the owner (E3)                                    |
| `../phase_02_slice_11_helpers_tzdb.sql`                | `cms_tzdb_version`: the pinned IANA release equals the contract constant                                                                                                                                          |
| `../phase_02_slice_11_schedule_precision.sql`          | Installed offset/horizon/DETAIL, pending/retry due, both claim orderings, deviation and workflow formatting expressions; ancillary column/guard metadata, not persistence, locks, RLS, CAS or genuine sweep proof |

## Adding a test

Include the prelude in this order: `support/jwt-claims.sqlinc` (before the first `begin`),
`phase_02_slice_10_rpc/000-helpers.sqlinc`, `phase_02_slice_10_rpc/001-fixtures.sqlinc`, then
`000-helpers.sqlinc` here and, when the suite needs the `h11doc` type, `001-world.sqlinc`. The review builders also
need the `phase_02_slice_11_schema` prelude (`000-helpers`, `001-fixture`, `002-row-builders`); the registry fixtures
need `001-world.sqlinc`. Probe a refusal with `pg_temp.h11_outcome`. A helper that does not exist yet must answer
false or empty so a RED run reports every gap. Keep every file below 400 lines.

The isolated schedule-precision entrypoint needs only the JWT prelude, pgTAP and
`005-schedule-precision-expressions.sqlinc`. It supplies typed scalar operands to
unchanged expressions extracted from this database; it does not build the RPC world.

## Conventions

- Everything created here lives in `pg_temp` and dies with the test session.
- Write through the real guards in the RPC context, as the named command writes; a hand-written write to a guarded
  table is labelled and never claims a producer path.
- The data-model fixtures use fixed 2026-10-01 instants; a decision recorded inside its assignment window keeps
  counting after the window ends.
- The version-set parity fixture has one source: edit `version-set-parity.sqlinc` and run both sides.

## Related paths

- `../../migrations/20261005017500_cms_acting_context_version.sql` through
  `../../migrations/20261005017595_cms_tzdb_version.sql`
- `../phase_02_slice_11_schema/README.md` (the data-model prelude)
- `.memory/wiki/specs/be/03b-editorial-workflow-publication.md` (E1-E8, Preflight registry, Review invalidation,
  Publication lineage)

## Local run

```sh
node_modules/.bin/supabase test db --local supabase/tests/phase_02_slice_11_helpers_manifest.sql
```
