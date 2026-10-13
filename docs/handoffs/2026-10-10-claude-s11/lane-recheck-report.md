# Lane recheck report (Slice 11, P2-S11-AC-113, 2026-10-10)

Worktree `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`, branch `claude/phase2-slice11`, base HEAD
`41a46135dc4f7440c812e40598aa271179214b83`. Nothing staged or committed. Logs: `docs/handoffs/2026-10-10-claude-s11/lane-recheck-logs/`
(the raw TAP files are in `.lane-logs/`, named below).

## What was built

The dependency recheck of BE03b "Review invalidation / Dependency recheck": the consumers of the six events, the BE00 job
`cms.review.dependency_recheck`, and the database side that selects live reviews through the index, rebuilds each manifest and invalidates.

```
outbox row ──claim_outbox_batch (relay)──▶ platform queue ──▶ source consumer (one per event type)
   cms.schema.activated.v1 ┐                                      rereads the event (cms_dependency_recheck_resolve_event),
   cms.template.activated.v1│ identifier-only envelope            checks the kind it owns, sends the job message
   cms.pattern.activated.v1 │                                       { jobType, payload: { eventId, kind, refId }, cursor: null, correlationId }
   cms.taxonomy.changed.v1  │                                 ──▶ job (cms_dependency_recheck_run, <= 500 reviews per run)
   cms.localization.changed.v1│                                      cursor in the answer ⇒ the job sends the continuation message, then acks
   cms.block.lifecycle.changed.v1┘
```

### Decisions you should ratify (none touches the locked ideation; all are implementation-level but have ripple effects)

1. **"BE00 job" is a typed message on the existing platform jobs queue, not a `platform_private.jobs` row.** A `jobs` row needs an actor and
   an acting party (`jobs.actor_id`/`acting_party_id` are NOT NULL) and the recheck is system-initiated; `cms.publication_schedule.execute`
   is the precedent of a named Worker job with no `jobs` row. No new table, queue or mechanism: the queue, the consumer admission/dead-letter
   vocabulary (`admitConsumerEvent`, `consumer_dead_letter_event`) and the 15/60/300 s retry ladder are the existing ones. The continuation
   cursor travels in the next queue message.
2. **A versioned kind stands for its lineage.** `cms.schema.activated.v1` names the version that *became* active, while the stale reviews
   froze its predecessor. `cms_dependency_recheck_lineage(kind, ref)` expands `schema`/`template`/`pattern`/`taxonomy_version` to every version of
   the same content type / template key / pattern key / taxonomy key (owner scoped); every other kind is the exact identity. Without this the
   schema consumer could never select a review.
3. **`cms.localization.changed.v1` resolves to the SOURCE revision** of the latest locale variant of `{entryId, locale, revisionId}` (the index's
   `locale_source` rows name the source revision a review froze, not the variant revision the event carries).
4. **The three Slice 12 events (`template`, `pattern`, `taxonomy`) have no producer yet.** The BE03c table fixes their payload members
   (`templateVersionId`, `patternVersionId`, `taxonomyVersionId`) and I used them; it does **not** fix their outbox aggregate type, so the relay and the
   consumer accept any registry-key aggregate for these three until Slice 12 narrows it. I also registered the producer prefixes
   `cms.pattern.` and `cms.taxonomy.` (`cms.composition`), because a claimed row with no registered producer parses to null in the Worker and wedges
   the sweep. Insert is `on conflict do nothing`; **Slice 12 must not plain-insert those two prefixes**. No event contract was missing, so I did not stop.

## Files

### New
- `supabase/migrations/20261010164000_cms_review_recheck_relay.sql` (104 lines): widens the `claim_outbox_batch` allowlist with the six tuples
  (CREATE OR REPLACE, signature/owner/grants/volatility unchanged) and registers the two missing producer prefixes.
- `supabase/migrations/20261010164100_cms_dependency_recheck.sql` (339 lines): `platform_private.cms_dependency_recheck_lineage`,
  `cms_dependency_recheck_event_ref`, `cms_dependency_recheck_run`, and the service-role-only wrappers
  `platform_api.cms_dependency_recheck_resolve_event(uuid)` and `platform_api.cms_dependency_recheck_run(jsonb)`; owned by `wejammin_cms_definer`,
  empty search_path, EXECUTE revoked from PUBLIC/anon/authenticated/service_role then granted to service_role on the two wrappers.
- `supabase/tests/phase_02_slice_11_recheck_{relay,event_resolve,run,cap,index}.sql`.
- `packages/contracts/src/cms-editorial/review-recheck.ts` (+ `.test.ts`): the six source events with their relay envelopes, the job message, the two RPC shapes.
- `apps/worker/src/cms-editorial/review-recheck/` (`README.md`, `rpc-names.ts`, `rpc.ts`, `message.ts`, `source-consumers.ts`, `job.ts`, `processor.ts`, `production.ts`,
  `review-recheck.test-support.ts` and a test file per module).
- `apps/worker/src/async-entrypoint-review-recheck.test.ts`, `async-runtime-review-recheck-claim.test.ts`, `production-async-entrypoint-review-recheck.test.ts`.
- `tests/postgrest/phase-02-slice-11-recheck.apispec.ts` (the real-composition test).

### Shared registration files I touched (all minimal, additive)
| File | Change |
| --- | --- |
| `apps/worker/src/async-entrypoint.ts` | `PlatformJobsQueue` widened with the two new message types; new optional dependency `processReviewRecheck`; one branch **before** the schema-migration branch (a `cms.schema.activated.v1` message with a `payload` is still the migration worker's, an identifier-only one is the recheck's). |
| `apps/worker/src/production-async-entrypoint.ts` | lazy per-env composition (`recheckFor`) wired to `processReviewRecheck`; reuses `eventConsumerOptions.logger` when given. |
| `apps/worker/src/async-runtime-parsing.ts` | `parseOutboxClaim` relays the six event types (own envelope schema; aggregate rules live there); `ClaimedOutbox.envelope` widened. |
| `apps/worker/src/async-runtime-rpc-types.ts` | `AsyncRpcOperation` gains `CmsReviewRecheckRpcName`. |
| `apps/worker/src/event-consumers/admit.ts` | optional `isKnownFamily` on `AdmitInput` (defaults to `isConsumerEventType`), so an unknown version of a recheck family is dead-lettered `UNKNOWN_EVENT_VERSION` instead of `INVALID_QUEUE_PAYLOAD`. Existing behaviour unchanged. |
| `packages/contracts/src/cms-editorial/index.ts`, `README.md` | export line; one table row. |
| `supabase/tests/phase_02_slice_09_r8_api_surface.sql` | the two new wrappers added to the *supporting* set (comment block too). Another lane (preview takedown) edited the same file concurrently: the supporting set is now **54**. |

I did **not** edit `20261005017640_cms_submit_review.sql`: the index write was present and correct (see finding 0). No publication/schedule migration, checker or `apps/web` file was touched.

## Findings and evidence

Test-first status, stated plainly: the contracts and all pgTAP files were written and shown RED before any production code existed. The Worker modules were written
**before** their unit tests (not test-first); to compensate, seven behavioural mutants of the Worker code and seven of the SQL were applied and each is caught (below).

### 0. Dependency index (bullet 1 of the brief)
- `phase_02_slice_11_recheck_index.sql` (10 assertions + 7 fixture assertions): no API role and not PUBLIC holds any privilege; `wejammin_cms_definer` holds exactly INSERT, SELECT;
  `cms_submit_review` is the only function whose body inserts into the table and none updates/deletes; `service_role` and `authenticated` direct inserts are `42501`; the owner outside the
  RPC context is `DIRECT_CMS_TABLE_WRITE`; one frozen manifest yields all nine kinds, each `(kind, ref_id)` once.
- All 17 assertions were `ok` in the very first run, before any migration of mine existed (`.lane-logs/alt-tap-194710-3214166.tap`, file 5 of 5; the file only looked red because I had planned 10 and the fixtures add 7), and 17/17 in the final GREEN run. **No rule was absent; no fix needed.** Already-cited tests still carry immutability, retention after invalidation and `UNIQUE`.

### 1. Consumers (clause 3 of AC-113)
- RED contracts: `lane-recheck-logs/red-contracts.log` — `TypeError: Cannot read properties of undefined (reading 'every')` at `review-recheck.test.ts:86` (`REVIEW_RECHECK_SOURCE_EVENT_TYPES` undefined). GREEN: 15 tests (`review-recheck.test.ts`).
- Worker (131 new vitest tests, 0 failed; `lane-recheck-logs/unit-2.log`, `cov-final.summary.txt`: every lane file 100% statements/branches/functions):
  `source-consumers.test.ts` (24; `it.each` over the six event types asserts the enqueued payload `{ eventId, kind, refId }`, the resolver call, dead-letter on not-found and on a kind of another family, the 15/60/300 ladder, enqueue failure, unknown version, Slice 12 aggregates), `job.test.ts` (15), `message.test.ts` (18), `processor.test.ts` (9), `rpc.test.ts` (15), `production.test.ts` (5), `async-entrypoint-review-recheck.test.ts` (12), `async-runtime-review-recheck-claim.test.ts` (16), `production-async-entrypoint-review-recheck.test.ts` (2).
- pgTAP relay: RED `.lane-logs/alt-tap-194710-3214166.tap` (copy `lane-recheck-logs/red-pgtap.tap`): `phase_02_slice_11_recheck_relay.sql` not ok 3, 4 (`cms.pattern.activated.v1`/`cms.taxonomy.changed.v1` resolve no producer), 7 (the relay claims none of the six), 10 (no lease), 15 (new prefixes absent). GREEN 15/15.

### 2. Selection, rebuild, invalidate, idempotency, 500 + cursor (clauses 4-6)
- RED (same TAP): `phase_02_slice_11_recheck_event_resolve.sql` stops at `function platform_api.cms_..._resolve_event(uuid) does not exist` (not ok 8), `phase_02_slice_11_recheck_run.sql` at `function platform_private.cms_..._lineage(unknown, unknown) does not exist` (not ok 9-11).
  The `recheck_cap.sql` RED is *not* clean (psql read it while I rewrote it: `syntax error at or near "drop"`); its sensitivity is shown by the mutant run instead.
- GREEN: `.lane-logs/alt-tap-204100-3447106.tap` (summary `green-pgtap-final.summary.txt`): **20 files, 797 tests, PASS** = the five recheck files (relay 15, event_resolve 35, run 52, cap 25, index 17) plus neighbours
  `r8_api_surface`, `sec2_definer_rls`, `sec2_all_schema_definer_rls`, `g1_consumer_boundary`, `p240_outbox_producer`, `p240_authority`, `ev_eb_publication_scope`, `schema_posture`, `review_dependencies_schema`, `rpc_review_submit`, `helpers_invalidation`, `helpers_manifest`, `criteria_manifest_rls`, `persistence_runtime`, `r3_grants_misc`.
- The run never invalidates a review that still holds: it decides from `cms_frozen_dependencies_status` (rebuilt manifest equal to the frozen one, every identity current, recorded taxonomy versions active) and only then calls the one invalidation core with `dependency_changed`. Both paths are proven: a withdrawn block (rebuilt manifest *equal*, identity not current) and a changed term (rebuilt manifest *differs*, every identity current).
- Cap: 501 live reviews → `{examined: 500, invalidated: 0, nextCursor: ids[500]}`, continuation `{1, 0, null}`, a start with exactly 500 left `{500, 0, null}`; after superseding the schema version `{500, 500, cursor}` then (through the platform_api wrapper) `{1, 1, null}`; 501 events, 501 audit rows, then `{0, 0, null}` twice.
- **Timing (diagnostic, `green-pgtap-2.summary.txt`)**: a full 500-review run took 5.9 s (all hold) and 6.8 s (500 invalidated) on a host at load ~15; the Worker RPC deadline is 15 s. If production manifests are much larger the batch (a "at most 500" bound) or the deadline for this RPC will need tuning.

### 3. Real composition (`tests/postgrest/phase-02-slice-11-recheck.apispec.ts`, 6 tests)
- `lane-api.sh` run (`.lane-logs/api-201820.log`, copy `lane-recheck-logs/api-1.log`): **1 file, 6 tests passed**. Real PostgREST + real Worker (`createProductionAsyncEntrypoint`) over the real database; only Cloudflare Queues is an in-memory loopback.
  A genuine successor schema activation (public CMS routes) supersedes the version of two live reviews (one open, one approved) and one control review on another content type; the **real scheduled outbox sweep** relays `cms.schema.activated.v1`; the consumer calls the real resolver RPC and enqueues the job; the job calls the real run RPC.
  Asserts: reviews still live until the job runs; envelope identifier-only with producer `cms.schema_registry`; RPC traces (`{found:true, kind:'schema', refId: <new version>}`, `{examined:2, invalidated:2, nextCursor:null}`); both reviews `invalidated/dependency_changed` at version + 1; control untouched; one `cms.entry.review-changed.v1` and one audit row per invalidation carrying the activation's correlation id; dependency rows retained; redelivery of the same event changes nothing.

### Mutation proof (the tests have teeth)
- Worker, `lane-recheck-logs/mutants-worker.log` (mutated copies, deleted afterwards): M1 job drops the continuation (3 tests fail), M2 consumer ignores the kind (1), M3 job acks a failed continuation (2), M4 classifier loses the schema-payload exclusion (1), M5 RPC port skips run validation (5), M6 continuation carries the old cursor (2), M7 job carries the wrong correlation id (7). All caught.
- SQL, one combined run, `lane-recheck-logs/mutants-sql.summary.txt` (`.lane-logs/alt-tap-203552-mut.tap`; the mutated migrations were installed only while the alt lock was held and byte-compared back afterwards). Seven mutants: lineage expansion off, 500 cap off, status check removed (every stale-looking review invalidated), non-live reviews selected, localization resolving the variant revision, block lifecycle dropped from the allowlist, producer prefixes unregistered. Failing groups: run 21-23, 26-32, 34, 39, 41, 43-49; cap 11, 14-19, 23, 25; event_resolve 16-18; relay 3-4, 7, 9-10, 15 (all four files fail, the plan counts stay intact, so nothing aborted). The mutants were applied together, so attribution of a failing test to one mutant is by design, not by isolation.

## Changed test titles (old → new)
Only one existing title changed (the title carries the supporting-set size):
- `supabase/tests/phase_02_slice_09_r8_api_surface.sql`: `... executable by an API role and nothing else is: 8 + 10 + 51 [P2-S09-AC-180]` → `... 8 + 10 + 54 [P2-S09-AC-180]` (+2 mine, +1 from the preview-takedown lane that added `cms_takedown_preview_tokens` without bumping the title). Reconcile at integration.
No assertion was weakened, skipped or loosened.

## Spec lines satisfied
BE03b "Review invalidation" §Dependency recheck (table + the `dependency_changed` producer row, `.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1861-1865`), "Frozen dependency manifest build" (current-identity rule, 1773), "Support records" ReviewDependency row (1963, 1994); BE03a/BE03c "Event schemas" payload members for the six events; BE00 consumer registry (at-least-once, 15/60/300, unknown version → DLQ).
Per-clause evidence titles for the ledger (all end `[P2-S11-AC-113]`): clause 1 (index) `recheck_index.sql` ("no API role holds any privilege...", "cms_submit_review is the only function whose body inserts...", "one frozen manifest yields a dependency row of each of the nine kinds"); clause 3 (consumers) `source-consumers.test.ts` ("%s: rereads the committed event and enqueues cms.review.dependency_recheck with { eventId, kind, refId }" ×6) and `recheck_relay.sql`; clauses 4-6 `recheck_run.sql`, `recheck_cap.sql` ("a run handles at most 500 of the 501 live reviews and returns the 500th review id as its continuation cursor", "the run that continues after the cursor handles the 501st review...", "idempotent: ..."), `recheck.apispec.ts` ("runs the job: both live reviews of the superseded version are invalidated dependency_changed...").

## Open items / things for the orchestrator
1. **`packages/data-access/src/database.types.ts` needs `pnpm db:types` regeneration** (two new `platform_api` functions; the relay/claim function is unchanged in signature).
2. **Pre-existing failure, not from this lane:** `apps/worker/src/production-composition.test.ts > executes approved internal object verification through the queue seam` fails at the lane base: commit `18abd65c` ("convey and bind actual job claim receipts") made `parseLease` reject a claim whose `leaseToken` differs from the one the Worker generated, and that test's mocked `claim_job` returns a fixed token. Reproduced with the Date faked as well, so it is not a time bomb. Owner: whoever owns claim receipts.
3. **No race runner** for two concurrent runs (the gap report suggested one). Not added: it needs a new `supabase/tests/phase_02_slice_11_races/` file and a registration in `infra/run-database-race-runners.mjs`, outside my ownership. The design relies on the invalidation core's `FOR UPDATE` on the review row (second run waits, re-reads, sees `invalidated`, emits nothing) and on ascending-id locking; sequential idempotency is proven, the concurrent interleaving is not.
4. **First sweep after deploy** relays every historical undispatched `cms.schema.activated.v1`, `cms.block.lifecycle.changed.v1` and `cms.localization.changed.v1` row (they were never on the allowlist), 25 per tick; each becomes an idempotent recheck. A one-time burst, harmless.
5. Docs not updated (outside ownership): `docs/runbooks/platform/cms-publication.md` (operations section for the recheck), `supabase/migrations/README.md`, `apps/worker/src/README.md`.
6. The evidence ledger (`tests/contracts/phase-02-slice-11-evidence-ledger-101-122.ts`, AC-113) still says "partial / no implementation"; the three uncited clauses can now cite the titles above. The slice tracker `.memory/pipeline/progress/slices/phase-02-slice-11.md` (AC-113 box) and the memory records (DEC candidates 1-4 above) are for the integrator.
7. `tsc --build tsconfig.json` exits 0 (`lane-recheck-logs/tsc-build-2.log`); eslint `--max-warnings=0` and prettier clean on the lane files. The shared worktree has other lanes' in-flight files; none of them interacts with mine except `phase_02_slice_09_r8_api_surface.sql` (above).
