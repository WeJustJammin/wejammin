# Governed review recheck

## Contents

The Worker half of BE03c "Governed review machinery / Invalidation" and "Job transport (DEC-166, DEC-180 G9)"
(tracker `P2-S12-AC-202`, `AC-203`): the producers of the typed platform-queue job `cms.governed_review.recheck`
and the job that runs `cms_recheck_governed_reviews`, which invalidates live governed reviews whose frozen
identities moved.

| Event                            | Resolved identity | Governed dependency kind |
| -------------------------------- | ----------------- | ------------------------ |
| `cms.block.lifecycle.changed.v1` | `block`           | `block`                  |
| `cms.schema.activated.v1`        | `schema`          | `content_type`           |
| `cms.pattern.activated.v1`       | `pattern`         | `pattern`                |

## How a message flows

1. The outbox relay places the identifier-only envelope of a source event on the platform jobs queue. The queue
   entrypoint hands it to the review recheck seam (`processReviewRecheck`), which is the processor in
   `production.ts`.
2. `processor.ts` lets the governed producer (`source-consumers.ts`) reread the committed event through the
   protected `platform_api.cms_governed_recheck_resolve_event` (it maps the Slice 11 event identity to the governed
   dependency kind; the editorial consumer keeps `cms_dependency_recheck_resolve_event`) and enqueue
   `{ jobType, schemaVersion, payload: { eventId, kind, refId }, cursor: null, correlationId }`. A retry returns
   at once; on an ack the same message goes on to the Slice 11 editorial recheck, which consumes the same event.
3. The governed job message (`isGovernedRecheckJobMessage`, routed by `../../async-entrypoint.ts`) runs
   `job.ts`: one bounded step through `cms_recheck_governed_reviews` (at most 500 live reviews after the cursor).
   A run that leaves reviews behind hands back a cursor and the job sends the continuation message before it
   acknowledges.
   One review never stops the others (DEC-218): the database handles each review in its own sub-transaction, so a
   review whose verdict or invalidation fails for a reason other than a lock failure is left live and counted
   `unavailable` in the run result. The run still succeeds, but `job.ts` logs it at warn level (outcome `success`,
   attribute `unavailable`, metric `cms.governed_recheck.unavailable.total`) so a systemic fault is visible; a lock
   timeout or deadlock is not isolated: the run fails as `CONFLICT` and the message is retried whole.
4. Everything is at least once and idempotent. A message that is not exactly a governed recheck message is never
   acknowledged, so the platform queue moves it to its dead-letter queue.

The revocation of a counted approver's capability is NOT a queue message: its invalidation runs inside the
revoking transaction (`cms_invalidate_governed_reviews_for_person`, AC-204).

## Files

- `contract.ts` - the strict message, run request and run result schemas, the job type and the 500 bound.
- `rpc-names.ts`, `rpc.ts` - the two protected `platform_api` RPC names (`cms_governed_recheck_resolve_event`,
  `cms_recheck_governed_reviews`) and the validated ports.
- `message.ts` - `isGovernedRecheckJobMessage` and the queue port type.
- `source-consumers.ts` - the three producers.
- `job.ts` - the job (one run, one continuation).
- `processor.ts` - routes a recognised message; keeps every other message with the Slice 11 recheck.
- `production.ts` - composition over the Supabase RPC transport and the `PLATFORM_JOBS` binding.
- `governed-recheck.test-support.ts` - fixtures shared by the tests.

## Ownership

Phase 2 Slice 12 (CMS composition, taxonomy and localization). The database half is
`platform_api.cms_recheck_governed_reviews` (migration `20261022030100_cms_recheck_governed_reviews.sql`);
the job decides nothing the database does not.

## Extension

A new source event: add its row to `GOVERNED_RECHECK_SOURCES` and to the family pattern in
`source-consumers.ts`, relay the event (the Slice 11 allowlist), and add a row to the table above.

## Conventions

- Identifiers only on the queue, in logs and in metrics labels; metric labels come from closed sets.
- The job never invalidates on the strength of an event; the database rebuilds every review.
- Tests carry the `[P2-S12-AC-202]` / `[P2-S12-AC-203]` criterion tags.

## Related links

- `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md` (Invalidation, Job transport)
- `../../cms-editorial/review-recheck/README.md` (the Slice 11 editorial recheck this composes with)
