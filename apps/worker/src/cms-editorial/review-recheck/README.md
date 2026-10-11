# Review dependency recheck

## Contents

The Worker half of the BE03b "Review invalidation / Dependency recheck" (tracker
`P2-S11-AC-113`): the consumers of six events and the BE00 job
`cms.review.dependency_recheck` that invalidates live editorial reviews whose frozen
dependencies moved.

| Event                            | Dependency index kind | Owner of the identity              |
| -------------------------------- | --------------------- | ---------------------------------- |
| `cms.schema.activated.v1`        | `schema`              | the activated content type version |
| `cms.template.activated.v1`      | `template`            | the template version (Slice 12)    |
| `cms.pattern.activated.v1`       | `pattern`             | the pattern version (Slice 12)     |
| `cms.taxonomy.changed.v1`        | `taxonomy_version`    | the taxonomy version (Slice 12)    |
| `cms.localization.changed.v1`    | `locale_source`       | the SOURCE revision of the variant |
| `cms.block.lifecycle.changed.v1` | `block`               | the block definition version       |

## How a message flows

1. The outbox relay (`claim_outbox_batch`, the scheduled sweep) places the identifier-only
   envelope of a source event on the platform jobs queue. The queue entrypoint
   (`../../async-entrypoint.ts`) recognises it with `classifyReviewRecheckMessage` before the
   schema-migration branch: a `cms.schema.activated.v1` message that carries a `payload` is the
   full activation envelope of the schema migration worker and stays with that worker.
2. `source-consumers.ts` (one consumer per event type) admits the strict envelope, rereads the
   committed event through `cms_dependency_recheck_resolve_event` (the queue never carries the
   payload), checks the identity is of the kind the event owns and sends the job message
   `{ jobType, schemaVersion, payload: { eventId, kind, refId }, cursor: null, correlationId }`.
   An event the database cannot resolve is durably dead-lettered (`SOURCE_RECORD_NOT_FOUND`)
   and acknowledged; an unknown version is dead-lettered `UNKNOWN_EVENT_VERSION`.
3. `job.ts` runs one bounded step through `cms_dependency_recheck_run`: at most 500 live
   reviews after the cursor, selected through the `(kind, ref_id)` index, each manifest rebuilt
   from canonical state and the review invalidated `dependency_changed` when it no longer
   holds. A run that leaves reviews behind hands back a cursor and the job sends the
   continuation message before it acknowledges.
4. Everything is at-least-once and idempotent: an invalidated review is no longer selected, a
   repeated run invalidates nothing twice, and a duplicate continuation walks nothing new.
   A message that is not exactly a recheck message is never acknowledged, so the platform queue
   moves it to its dead-letter queue.

## Files

- `rpc-names.ts`, `rpc.ts` - the two protected `platform_api` RPC names and the validated ports.
- `message.ts` - `classifyReviewRecheckMessage` and the queue port type.
- `source-consumers.ts` - the six consumers.
- `job.ts` - the job (one run, one continuation).
- `processor.ts` - routes a recognised message to a consumer or the job.
- `production.ts` - composition over the Supabase RPC transport and the `PLATFORM_JOBS` binding;
  `../../production-async-entrypoint.ts` calls it.
- `review-recheck.test-support.ts` - fixtures shared by the tests.

## Ownership

The Phase 2 CMS editorial workflow owns this directory (Slice 11, `P2-S11-AC-113`).
The database half is `platform_api.cms_dependency_recheck_resolve_event` and
`cms_dependency_recheck_run` (migration `20261010164100_cms_dependency_recheck.sql`);
the job decides nothing the database does not. The producers of the six source events
are Slices 09, 12 and 13.

## Extension

A new source event: add its type to `REVIEW_RECHECK_SOURCES` in
`packages/contracts/src/cms-editorial/review-recheck.ts`, relay it (the allowlist in
`claim_outbox_batch` and the producer prefix), resolve it in
`platform_private.cms_dependency_recheck_event_ref`, and add a row to the table above. The
consumer, router and relay parsing follow from the table.

## Conventions

- Identifiers only on the queue, in logs and in dead letters: no content, comment, token or
  authority.
- The job decides nothing the database does not: it never invalidates on the strength of an
  event, and the database invalidates only a review whose rebuilt manifest differs or whose
  frozen identity is no longer current.
- A frozen locale-source identity is current only while its source revision is still served at the
  frozen hash and no variant sourced from that revision and hash is `stale` (DEC-170,
  `cms_manifest_identities_current`). The stale producer copies the source revision and hash into
  the row it appends, so the rebuilt manifest alone never tells: without that rule the
  `cms.localization.changed.v1` consumer could not invalidate anything.
- The relay records an envelope it cannot build as a dead letter and completes its claim, so one
  poison outbox row never blocks the rows behind it (`async-runtime-outbox-poison.ts`).
- Tests carry the `[P2-S11-AC-113]` criterion tag.

## Related links

- `.memory/wiki/specs/be/03b-editorial-workflow-publication.md` (Review invalidation)
- `packages/contracts/src/cms-editorial/review-recheck.ts`, `jobs.ts`
- `supabase/migrations/20261010164000_cms_review_recheck_relay.sql`,
  `20261010164100_cms_dependency_recheck.sql`
- `../../event-consumers/README.md` (the platform consumer vocabulary)
