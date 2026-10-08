# Slice 10 restore transform/revalidation pgTAP fragments

The executable `../phase_02_slice_10_restore_transform_revalidation.sql` is the
single Supabase discovery entrypoint. It opens one transaction, declares the
exact pgTAP plan, includes the shared Slice 10 fixture and then these
fragments in numeric order with psql `\ir` directives. The fragments are
includes, not independently discovered Supabase test files, and the entrypoint
returns control for `finish()` and `rollback()`.

| Fragment                                 | Coverage                                                                                                                                                                |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `000-restore-fixtures.sqlinc`            | A second content type (rich_text, DEC-133 object, relation, literal default, taxonomy), `pg_temp.s10_sql_bool`, and the rolled-back forgery and request helpers         |
| `001-seams-and-validators.sqlinc`        | The read-back observation helper, the real template seam, the restore function ownership/privilege posture and the `cms_restore_source_side_valid` seam per field kind  |
| `002-typed-refusals.sqlinc`              | Every typed refusal end to end: incomplete chain, relation re-resolution, template, request admission, authority, concealment, lineage, chain mismatch, stale version   |
| `003-translation-and-idempotency.sqlinc` | Positive translation (rebinding, recomputed hashes, defaults, relations, audit/outbox), replay, business-hash binding and the reserved/failed_retryable/completed paths |

## How a forged source works

`pg_temp.s10r_forge(values, relations, template, stored_hashes, slot)` inserts
one entry whose SOURCE revision (number 1) carries the given values and relation
rows beside a distinct CURRENT draft (number 2). It runs inside the probe that
needs it (`pg_temp.s10_rpc_probe` rolls the subtransaction back), so no forged
row reaches another assertion. Every forged row uses one stable snapshot
timestamp because every snapshot table checks `updated_at = created_at`.

`pg_temp.s10r_observe(request, replays, replay_request)` calls the command and
reads the new draft back inside the same probe, so a probe can assert persisted
effects (hashes, rebinding, outbox, audit, reservation state) without mutating
the shared fixture.

## Adding tests

Append a numbered fragment, register it in the entrypoint and update its
`plan(N)`. Build reservation fixtures with `cms_reserve` / `cms_complete` (never
a hand-inserted `idempotency_records` row: its constraints reject an inadmissible
row before the producer is reached) and pair every refusal with a positive
control.

## Related paths

- `../phase_02_slice_10_restore_chain.sql` — manifest, chain derivation and the
  real multi-edge producer chain
- `../phase_02_slice_10_restore_chain_rebind.sql` — rebinding across a real chain
- `../../migrations/20261005010500_cms_restore_chain_manifest.sql` — the command
- `.memory/wiki/specs/be/03b-editorial-workflow-publication.md` — CMS-03B-04
