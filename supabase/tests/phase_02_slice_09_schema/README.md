# Slice 09 pgTAP fragments

The executable `../phase_02_slice_09_schema.sql` is the single Supabase
discovery entrypoint. It opens one transaction, establishes the pgTAP plan,
then includes these fragments in numeric order with psql `\\ir` directives.
The final fragment returns control to the entrypoint for `finish()` and
`rollback()`, so fixtures and assertion state remain shared across the suite.

Keep fragments ordered and below the repository's 400-line test cap. The
fragments are includes, not independently discovered Supabase test files.

| Fragment                                  | Coverage                                                                                                   |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `000b-activation-lock.sqlinc`             | Graph -> authority lock order, synchronized authority -> graph inverse probe, bounded timeout, and cleanup |
| `005-migration-worker.sqlinc`             | Real zero-row worker protocol over a producer-created successor plan (claim, scan, seal, review, backfill, complete) |
| `005c-worker-nonzero.sqlinc`              | Conditional non-zero scan over real entries: derived counters, per-row evidence, blocked plan              |
| `005d-worker-breaking.sqlinc`             | Breaking non-zero scan, bounded pages, retryable rollback, durable-cursor resume and completion            |
| `005f-worker-event-claim-lease.sqlinc`    | Event lease release, expiry takeover, stale-owner fencing, and terminal ACK                                |
| `010-operational-alerts.sqlinc`           | Alert claim/delivery integrity plus service-only AC209 cooldown and exact receipt verification RPCs        |
| `010b-provider-message-boundaries.sqlinc` | Opaque provider message identifier write/read boundary validation                                          |

`009c-independent-sessions.mjs` is the committed-session AC217 supplement.
Run it only after checking that no database reset/test is active:

```sh
node supabase/tests/phase_02_slice_09_schema/009c-independent-sessions.mjs
```

It opens a fresh Docker `psql` session for every worker/RPC call, including a
two-process activation race. The recovery proof uses truthful zero-row content
counts with a producer-created 128-field schema artifact, takes over an expired worker
lease, then races two independently fenced event replay claims. Exactly one
replay owner may ACK while durable DLQ identity and reason remain intact. The
runner never edits `platform_private.outbox_events` directly.
