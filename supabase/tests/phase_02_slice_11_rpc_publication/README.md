# Slice 11 schedule / publication RPC pgTAP fragments (lane S11-3b)

Fragments (`*.sqlinc`) shared by the suites of `cms_schedule_publication` (CMS-03B-07),
`cms_publish_revision` (CMS-03B-09), `cms_claim_due_publication_schedules` and
`cms_execute_publication_schedule` (CMS-03B-20), and by the independent-session race fixture. They are
includes, not discovered tests: each executable `../phase_02_slice_11_rpc_publication_*.sql` opens one
transaction, includes the fragments with psql `\ir`, and rolls back.

| Fragment                  | Content                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `000-world.sqlinc`        | `p11_approved(tag)`: an entry with one draft revision (true projection hash), a review frozen from the REAL dependency manifest and approved by `rvA` (version 2); request builders `p11_sreq` (07), `p11_preq` (09), `p11_xreq` (execute); the call probes `p11_call`, `p11_claim`, `p11_exec`; schedule rows through the real guard (`p11_schedule_row`); the effect snapshot `p11_effects` and the state inspectors |
| `090-race-fixture.sqlinc` | the committed approved reviews and the pending schedules (dated 30 days ahead) of `../phase_02_slice_11_races/013..015` (included by `infra/database-races/publication-kit.mjs`, never by a pgTAP file)                                                                                                                                                                                                                |

| Entrypoint                                                   | Covers                                                                                                                                                        |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `../phase_02_slice_11_rpc_publication_schedule.sql`          | CMS-03B-07 contract, committed effects, replay, the four actions, duplicate identity, step-up edges                                                           |
| `../phase_02_slice_11_rpc_publication_schedule_refusals.sql` | CMS-03B-07 structure, step-up, concealment, 403, CAS/state, time rules, grant end, preflight, committed dependency refusal, revocation                        |
| `../phase_02_slice_11_rpc_publication_publish.sql`           | CMS-03B-09 contract, committed effects, lineage (supersession, audiences), replay, step-up edges                                                              |
| `../phase_02_slice_11_rpc_publication_publish_refusals.sql`  | CMS-03B-09 structure, step-up, concealment, 403, CAS/state, frozen hash and version set, preflight, committed dependency refusal                              |
| `../phase_02_slice_11_rpc_publication_claim.sql`             | CMS-03B-20 claim: batch bounds, due selection, lease recovery and the retry ladder, ordering, ClaimedSchedule privacy                                         |
| `../phase_02_slice_11_rpc_publication_execute.sql`           | CMS-03B-20 execute: completion, the four actions, replay (`already_completed`), the lease / version fence, late runs                                          |
| `../phase_02_slice_11_rpc_publication_execute_refusals.sql`  | CMS-03B-20 blocked reasons, DEC-120 authority, preflight failed / unavailable / stale proof, the retry ladder to `retries_exhausted`                          |
| `../phase_02_slice_11_rpc_publication_evidence_audit.sql`    | the accessibility audit summary (DEC-159 (5)) of 07, 09 and 20: one row per verified proof, never for refused / stale / absent proof, no second row on replay |

## Adding a test

Include the prelude in this order: `support/jwt-claims.sqlinc`, `phase_02_slice_10_rpc/000-helpers.sqlinc`,
`phase_02_slice_10_remaining_schema/000-helpers.sqlinc`, `phase_02_slice_10_rpc/001-fixtures.sqlinc`, the three
`phase_02_slice_11_schema` fragments, the three `phase_02_slice_11_helpers` fragments (`000-helpers`, `001-world`,
`002-reviews`), then `phase_02_slice_11_rpc_review/{000-world,020-decision,030-submit}.sqlinc` and `000-world.sqlinc` of this
directory.

## Conventions

- Insert every revision of an entry BEFORE its first review (a newer revision of an entry invalidates the older live
  reviews); `p11_approved` gives each tag its own entry.
- A claim is global: create the schedules a test needs first, then claim once; seed states a claim must recover with
  `pg_temp.h11_raw_exec` on the schedule table (the CHECKs still apply).
- Raised refusals are probed with `p_keep false` (rolled back); a committed refusal (dependency_changed) is probed with the
  default.
- The multi-session proofs (SKIP LOCKED, lease expiry, publish vs execute, outbox dedupe) are the race runners in
  `../phase_02_slice_11_races/`.
- Keep each file below 400 lines.

## Related paths

- `../../migrations/20261005017700_cms_publication_command_support.sql` .. `20261005017740_cms_execute_publication_schedule.sql`
- `../phase_02_slice_11_races/README.md`, `../../../infra/database-races/publication-kit.mjs`
