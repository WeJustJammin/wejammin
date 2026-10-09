# Slice 11 data-model pgTAP fragments

The executables `../phase_02_slice_11_*_schema.sql`, `../phase_02_slice_11_*_guard.sql` and
`../phase_02_slice_11_schema_posture.sql` are the Supabase discovery entrypoints
for the Slice 11 data model (lane S11-2): the forward migrations
`20261005017000` to `20261005017090` (E2, the constant `draft` physical revision state, ships with the derived-state helper in lane S11-3) reconcile the Slice 10 foundation tables to
the locked BE03b shapes (`EditorialReview`,
`EditorialReviewAssignment`, `EditorialDecision`, `ReviewDependency`,
`SettingsSnapshot` E7, `PreflightRegistry` D19, `PublicationSchedule`,
`PublicationVersion` lineage E3 and `PreviewToken`). Each entrypoint opens one
transaction, establishes the pgTAP plan, includes the fragments below with psql
`\ir`, and rolls back. The fragments are includes, not discovered tests.

| Fragment                  | Content                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `000-helpers.sqlinc`      | `pg_temp` probes: statement outcome (`00000`, `P0001:<token>` or the SQLSTATE), bare-constraint probe with every user trigger disabled, INSERT builder from a jsonb image, structural inspectors (closed labels, constraint and index fragments, trigger inventory, grants, RLS, policies) that answer false or empty for an absent object so a RED run reports every gap |
| `001-fixture.sqlinc`      | builds on the Slice 10 RPC fixture: revision A2 (second author), entry B with revision B1, seventeen shadow reviewer persons                                                                                                                                                                                                                                              |
| `002-row-builders.sqlinc` | complete valid jsonb row images per table; a test overrides one member to build a violating row                                                                                                                                                                                                                                                                           |

| Entrypoint                                         | Covers                                                                                                                                          |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `phase_02_slice_11_reviews_schema.sql`             | revision (id, entry_id) key, `EditorialReview` columns, closed invalidation reasons, owner and revision-of-entry keys, constraints in isolation |
| `phase_02_slice_11_reviews_guard.sql`              | review insert guard, frozen evidence, CAS and the transition machine                                                                            |
| `phase_02_slice_11_review_assignments_schema.sql`  | assignment shape, bounded read/decide window, constraints in isolation                                                                          |
| `phase_02_slice_11_review_assignments_guard.sql`   | eligibility, open-review and sixteen-assignment limits, revoke-only update                                                                      |
| `phase_02_slice_11_review_decisions_schema.sql`    | assignment binding, MFA window, separation of duties, decision/count sequencing                                                                 |
| `phase_02_slice_11_review_dependencies_schema.sql` | frozen-manifest index written at submission only                                                                                                |
| `phase_02_slice_11_settings_snapshots_schema.sql`  | settings snapshot hash and gapless ordinals, insert-if-absent                                                                                   |
| `phase_02_slice_11_preflight_registry_schema.sql`  | the seeded seventeen-category registry and newer-row registration                                                                               |
| `phase_02_slice_11_schedules_schema.sql`           | lease, retry, completion and reason rules, transition machine                                                                                   |
| `phase_02_slice_11_publication_lineage_schema.sql` | append-only lineage, tombstones, head, hash, separation of duties                                                                               |
| `phase_02_slice_11_preview_tokens_schema.sql`      | derived-token storage, exact 15-minute expiry, CAS revocation                                                                                   |
| `phase_02_slice_11_schema_posture.sql`             | forced RLS, grants, policies, guard inventory and guard-function posture of all nine tables                                                     |

## Adding tests

Add a row builder to `002-row-builders.sqlinc` for a new table, then an
entrypoint that includes the prelude in this order: `support/jwt-claims.sqlinc`,
`../phase_02_slice_10_rpc/000-helpers.sqlinc`,
`../phase_02_slice_10_remaining_schema/000-helpers.sqlinc`,
`../phase_02_slice_10_rpc/001-fixtures.sqlinc`, then the three fragments here. Probe
a CHECK, NOT NULL, unique or foreign key with `pg_temp.s11_bare_outcome` (guards
disabled), and a guard with `pg_temp.s11_outcome` (guards enabled). Keep every
file below 400 lines.

## Conventions

- A guard refusal is a `P0001` with the token as the whole message:
  `IMMUTABLE_RECORD`, `CONFLICT`, `VALIDATION_FAILED`, `FORBIDDEN`,
  `DIRECT_CMS_TABLE_WRITE`, or the BE03b reason token the named RPC raises
  (`separation_of_duties`, `review_not_open`, `reviewer_not_eligible`,
  `assignment_limit`, `publication_conflict`, `publication_not_active`,
  `entry_unavailable`).
- Row timestamps in the builders are fixed in the past (2026-10-01) so a guard
  that requires `updated_at` to be monotonic accepts `clock_timestamp()`.

## Related paths

- `../../migrations/20261005017000_cms_revision_state_constant.sql` through
  `../../migrations/20261005017090_cms_preview_tokens_reconcile.sql`
- `.memory/wiki/specs/be/03b-editorial-workflow-publication.md` (Database Schema,
  Persisted model envelope, Review invalidation, Publication lineage)

## Local run

```sh
node_modules/.bin/supabase test db --local supabase/tests/phase_02_slice_11_reviews_schema.sql
```
