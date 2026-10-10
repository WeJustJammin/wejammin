# Slice 11 criteria pgTAP fragments (lane sql-small)

Fragments (`*.sqlinc`) shared by the `../phase_02_slice_11_criteria_*.sql` entrypoints. They are includes, not
discovered tests: each entrypoint opens one transaction, includes the fragments with psql `\ir`, and rolls back.

| Fragment                | Content                                                                                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `000-effect-digest.sqlinc` | `c11_snapshot()` / `c11_take(label)` / `c11_delta(label)`: a whole-row sha256 digest of the fourteen durable-effect tables (no filter), the SQL twin of the real-stack `snapshotDigest` |

| Entrypoint                                              | Covers                                                                                                              |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `../phase_02_slice_11_criteria_publish_gates.sql`       | P2-S11-AC-004: CMS-03B-09 and the CMS-03B-20 executor with each template, block, relation, route, locale, privacy, settings and schema gate failing |
| `../phase_02_slice_11_criteria_decision_order.sql`      | P2-S11-AC-108: the CMS-03B-06 evaluation order, one assertion per adjacent pair, with callers failing two steps at once |
| `../phase_02_slice_11_criteria_manifest_rls.sql`        | P2-S11-AC-087: the dependency-manifest builder reads canonical state under the CMS RPC context's forced RLS            |
| `../phase_02_slice_11_criteria_schedule_tzdb_tag.sql`   | P2-S11-AC-103: a stored schedule keeps the tzdb tag and instant it was accepted with                                  |
| `../phase_02_slice_11_criteria_invalidation_states.sql` | P2-S11-AC-112: the entry leaving `active` as `deletion_pending` or `held` invalidates a live review                    |
| `../phase_02_slice_11_criteria_assignment_revoke.sql`   | P2-S11-AC-119: a revoke advances `version` and `updated_at`                                                            |
| `../phase_02_slice_11_criteria_review_ranges.sql`       | P2-S11-AC-120: 1..8 decision count, non-empty required capabilities, immutable frozen evidence                          |
| `../phase_02_slice_11_criteria_decision_snapshot_time.sql` | P2-S11-AC-121: `updated_at = created_at` on every decision                                                           |
| `../phase_02_slice_11_criteria_safe_read_effects.sql`   | CMS-03B-15/16/17 safe reads leave every durable-effect table byte-identical (complete row digests)                     |

## Adding a test

Include the prelude of the suite you extend (see `../phase_02_slice_11_rpc_publication/README.md` and
`../phase_02_slice_11_rpc_reads/README.md`), then `000-effect-digest.sqlinc` here when the test needs a no-effect proof.

## Conventions

- Existing world fixtures are included read-only; a criteria suite never edits another suite's file or helper.
- A no-effect proof uses `c11_take` / `c11_delta`, not a row counter.
- Keep each file below 400 lines.

## Related paths

- `../phase_02_slice_11_rpc_publication/`, `../phase_02_slice_11_rpc_reads/`, `../phase_02_slice_11_rpc_review/`
- `../../../tests/postgrest/support/phase-02-slice-11-effect.ts` (the real-stack digest this mirrors)
