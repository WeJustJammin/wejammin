# Linked-update scan

## Contents

The Worker half of BE03c "Linked update (diff, accept, detach)" and "Job transport (DEC-166, DEC-180 G9)" (tracker `P2-S12-AC-212`,
`AC-213`): the producer of the typed platform-queue job `cms.pattern.linked_update_scan` and the job that runs
`cms_scan_linked_pattern_updates`, which appends a `pending_diff` row (pinned to the unchanged version, `pending_pattern_version` set,
`position` unchanged) for each `linked` instance on a draft revision whose pinned version is older than the activated one and whose entry type
is compatible with it.

| Event                      | Resolved identity                 | Job payload                       |
| -------------------------- | --------------------------------- | --------------------------------- |
| `cms.pattern.activated.v1` | `{ patternId, patternVersionId }` | `{ patternId, patternVersionId }` |

## How a message flows

1. The outbox relay places the identifier-only envelope of `cms.pattern.activated.v1` on the platform jobs queue. The queue entrypoint hands it
   to the review recheck seam, which is the processor composed in `production.ts`.
2. `processor.ts` lets the producer (`source-consumer.ts`) reread the committed event through `cms_linked_scan_resolve_event` and enqueue
   `{ jobType, schemaVersion, payload: { patternId, patternVersionId }, cursor: null, correlationId }`. A retry returns at once; on an ack the
   same message goes on to the governed recheck family (`../governed-recheck/`), which in turn hands it to the Slice 11 editorial recheck.
3. The scan job message (`isLinkedScanJobMessage`, routed by `../../async-entrypoint.ts`) runs `job.ts`: one bounded step through
   `cms_scan_linked_pattern_updates` (at most 500 instances after the cursor, in ascending entry id then path). A run that leaves instances behind
   hands back a cursor and the job sends the continuation message before it acknowledges. The rows a run appended increment
   `cms_pattern_linked_update_pending_total`, even when the continuation then fails to enqueue (the rows are committed either way).
4. Everything is at least once and idempotent: an instance already waiting for the version (or a newer one) is no candidate, so a redelivery
   appends nothing. A message that is not exactly a scan message is never acknowledged, so the platform queue moves it to its dead-letter queue.
5. Retries follow BE00: 15, 60 and 300 seconds, each gaining 0 to 10 % of its base as jitter (`retry.ts`); beyond the ladder the message has no
   delay and the platform queue's `max_retries` moves it to the DLQ.

## Files

- `contract.ts` - the strict message, run request and result, event resolution and cursor schemas, the job type and the 500 bound.
- `rpc-names.ts`, `rpc.ts` - the two protected `platform_api` RPC names and the validated ports.
- `message.ts` - `isLinkedScanJobMessage` and the queue port type.
- `retry.ts` - the BE00 ladder with bounded jitter.
- `source-consumer.ts` - the producer for `cms.pattern.activated.v1`.
- `job.ts` - the job (one run, one continuation, the counter).
- `processor.ts` - routes a recognised message; keeps every other message with the recheck family.
- `production.ts` - composition over the Supabase RPC transport and the `PLATFORM_JOBS` binding.
- `linked-scan.test-support.ts` - fixtures shared by the tests.

## Ownership

Phase 2 Slice 12 (CMS composition, taxonomy and localization). The database half is `platform_api.cms_scan_linked_pattern_updates` and
`platform_api.cms_linked_scan_resolve_event` (migrations `supabase/migrations/20261022110000` through `20261022110300`); the job decides nothing the database does not.

## Extension

The cursor is opaque to the Worker: never build or parse one. A new bound or a new candidate predicate belongs in the SQL function and its pgTAP
suite (`supabase/tests/phase_02_slice_12_linked_scan.sql`), not here.

## Conventions

- Identifiers only on the queue; logs and metric labels carry no pattern, entry, path or cursor value.
- The only metric key outside the `cms.linked_scan.*` job counters is `cms_pattern_linked_update_pending_total`, label-free, registered in
  `../observability-registry.ts`.
- Tests carry the `[P2-S12-AC-212]` / `[P2-S12-AC-213]` criterion tags.

## Related links

- `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md` (Linked update, Job transport, Slice 12 lock order)
- `../governed-recheck/README.md` (the recheck family this composes in front of)
