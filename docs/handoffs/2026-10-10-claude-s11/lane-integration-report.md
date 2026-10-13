# Lane integration report (Slice 11, 2026-10-10)

Worktree `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`, branch `claude/phase2-slice11`. Started at `222f5725`; HEAD moved to
`2c55d937` while I worked (docs, memory, database types and lane scripts only; no migration changed). Nothing staged, committed,
stashed or reset. Logs and the measurement scripts are in `docs/handoffs/2026-10-10-claude-s11/lane-integration-logs/`
(`bench/` holds the raw TAP of every bench run, the probe SQL and the wrapper scripts).

Summary: item 1 is NOT a Slice 11 regression (origin/main fails the same assertion 7 of 7 runs; stopped, measurements below).
Item 2 fixed (test only). Item 3 bound derived and set to 12,288; the derived maximum cannot be evaluated within 2,000 ms (numbers
below, decision needed). Item 4 added and proven.

## Files changed

Modified:

- `apps/worker/src/production-composition.test.ts` (item 2; 397 lines)
- `apps/worker/src/cms-editorial/a11y-structural/input-schema.ts` (item 3: derivation comment, four maxima constants, derived `ACCESSIBILITY_NODES_MAX`)
- `apps/worker/src/cms-editorial/a11y-structural/input-schema.test.ts` (item 3)
- `apps/worker/src/cms-editorial/a11y-structural/README.md` (item 3: one bullet)
- `infra/run-database-race-runners.mjs` (item 4: registers `031`)
- `supabase/tests/phase_02_slice_11_races/README.md` (item 4: one table row)

New:

- `apps/worker/src/cms-editorial/a11y-structural/max-input.test.ts` (item 3)
- `infra/database-races/recheck-kit.mjs` (item 4: fixture build, run starter, readers)
- `supabase/tests/phase_02_slice_11_races/031-dependency-recheck-race.mjs` (item 4)
- `supabase/tests/phase_02_slice_11_recheck_race/090-race-fixture.sqlinc` (item 4: committed fixture)
- `docs/handoffs/2026-10-10-claude-s11/lane-integration-logs/**` and this report

Not touched: migrations, evidence ledgers, trackers, specs, `async-runtime-parsing.ts` (mutated once for the item 2 proof and restored
byte-identical, sha256 `3caa4c78...0c5`, `git diff` empty). No migration was needed. Temporary files `zz-red-production-composition.test.ts` and
`zz-scratch-max-nodes.test.ts` were created and deleted.

## Item 1: P2-S09-AC-217 create128 p95 (stopped: not from Slice 11)

What the bench calls: `platform_api.cms_create_type_draft` (CMS-03A-01), not `cms_create_entry`. `20261010130000` amends `cms_create_entry` and
`cms_settings_snapshot`, which the bench never calls (its timed ops are create128, dry_run, submit, assign, decide, activate).

What Slice 11 changed on the path: nothing. `git diff origin/main...HEAD -- supabase/migrations/` adds 71 migration files. The only
pre-existing tables they alter are `cms_editorial_decisions`, `cms_editorial_reviews`, `cms_entry_revisions`, `cms_preview_tokens`,
`cms_publication_schedules` and `cms_publication_versions`, none of which `cms_create_type_draft` writes; no trigger, index, constraint or
policy is added to any table it does write (`cms_content_types`, `cms_content_type_versions`, `cms_schema_artifacts`,
`cms_field_definition_versions`, relation and capability bindings, `idempotency_records`, `outbox_events`, `audit_events`); they redefine 13
pre-existing functions (`cms_create_entry`, `cms_create_revision`, `cms_resolve_conflict`, `cms_restore_revision`,
`cms_get_entry_draft`, `cms_list_entries`, `cms_list_revisions`, `cms_list_revisions_signed`, `cms_revision_page_disposition`,
`cms_composition_instance_guards`, `cms_schema_source_row_count`, `cms_get_schema_migration_plan`, `claim_outbox_batch`), none called by
`cms_create_type_draft`. The bench and its include files are byte-identical to main (only an unused `06-trigger-probes.sqlinc` was added).

Measurement (`flock -x /tmp/wejammin-quiet.lock` held for every bench run, a fresh `supabase db reset` of the tree under test before each
set, wait for 1-minute load below 2.0 where noted; 25 samples per run; TAP in `bench/`):

| Tree / set                       | Runs | create128 p50 (ms)    | create128 p95 (ms)         | max (ms) | host load (1 min)     | p95 < 300 ms |
| -------------------------------- | ---- | --------------------- | -------------------------- | -------- | --------------------- | ------------ |
| HEAD, just after reset           | 3    | 302 / 306 / 280       | 373 / 404 / 443            | 420-477  | 4.7 -> 3.9 (settling) | 0 of 3       |
| HEAD, same DB, no reset          | 3    | 313 / 279 / 323       | 425 / 371 / 384            | 403-474  | 1.5-1.9               | 0 of 3       |
| HEAD, fresh reset                | 4    | 278 / 299 / 289 / 287 | 336 / 350 / 335 / 337      | 339-447  | 1.8-2.4               | 0 of 4       |
| origin/main, fresh reset         | 3    | 291 / 278 / 267       | 337 / 387 / 333            | 361-493  | 1.9-2.6               | 0 of 3       |
| origin/main, fresh reset (again) | 4    | 286 / 302 / 283 / 267 | 401 / 358 / 370 / 377      | 400-525  | 1.9-2.6               | 0 of 4       |
| **HEAD total**                   | 10   | mean 295.5            | mean 375.8 (range 335-443) |          |                       | **0 of 10**  |
| **origin/main total**            | 7    | mean 281.8            | mean 366.0 (range 333-401) |          |                       | **0 of 7**   |

origin/main fails `create128 on a 128-field definition: RPC p95 under the 300 ms budget [P2-S09-AC-217]` in 7 of 7 runs, HEAD in 10 of 10, and
the HEAD runs on a fresh reset (p95 335-350) are no slower than main's (333-401). `activate` p95 is 239-326 ms on both trees (the earlier
253 ms is in range). The brief's 325.8 ms at load 1.47 is one sample of the same distribution. Per the brief I stopped here.

Where the time goes (instrumented copy of the installed function, same text plus a clock stamp before each statement, rolled back; 15
creates per tree, `bench/probe_create_timing.sql`; p50 ms):

| Step in `cms_create_type_draft`                                               | origin/main | HEAD  |
| ----------------------------------------------------------------------------- | ----------- | ----- |
| total (as the bench times it)                                                 | 308.1       | 331.0 |
| `cms_definition_artifact_hash` (builds both compiled manifests, JCS, SHA-256) | 78.3        | 84.9  |
| `insert into cms_schema_artifacts` (builds both manifests again)              | 56.2        | 57.7  |
| `cms_valid_field_input` x 128                                                 | 64.9        | 69.0  |
| `insert` 128 `cms_field_definition_versions` rows (row triggers)              | 83.2        | 90.9  |
| everything else (reserve, locale checks, emit_event, resource, complete)      | 25.5        | 28.5  |

Those four steps are Slice 09 code, identical on both trees; the ~7 percent HEAD-over-main gap in that single probe is uniform across pure
functions and inside the run-to-run spread above. If the budget has to be met on this host the candidates are all in Slice 09 files: the
compiled editor and renderer manifests are computed twice per create (once inside the artifact hash, once for the artifact row; keeping
them in locals would save about the 56 ms of the second step), the 128 per-field validations (about 0.5 ms each) and the 128-row insert
(about 0.65 ms per row). That is a Slice 09 owner decision; I changed nothing.

## Item 2: `production-composition.test.ts > executes approved internal object verification through the queue seam`

Cause: `18abd65c` made `parseLease` reject a claim whose `leaseToken` differs from the one the Worker generated (`crypto.randomUUID()` per
message). The real `platform_api.claim_job` returns `job_id, version, state, lease_until, attempt_count` and no token
(`20260830110000_persistence_service_api.sql:66`), so the Worker's request token is the receipt. The test's mocked `claim_job` returned a
static `leaseToken: LEASE_TOKEN` and `expectedVersion`, which the binding correctly refuses (the same defect that the Codex amendment
`lane-s11-native-legacy-claim-token-fixture-amendment-2026-10-09.md` fixed in two other fixtures). The queue message (a `job.requested`
envelope) was already correct.

- RED: `lane-integration-logs/red-items-2-3.log`, run on a verbatim copy of the HEAD test:
  `AssertionError: expected "vi.fn()" to be called once, but got 0 times` at `expect(verifyObject).toHaveBeenCalledOnce()` (line 121).
- Fix (test only): the mock now answers the real claim row shape; the body moved into a local helper `runObjectVerification(claim)` used
  by two tests. Production parsing untouched.
- New test proving the binding: `refuses a claim receipt that does not bind the lease the Worker requested, running no effect and writing
no outcome` sends the same row with a foreign `lease_token`; it expects `verifyObject` not called, no ack, one retry, no
  `apply_job_outcome`.
- Mutation proof: with the `throw` of the binding check removed from `parseLease` the new test fails
  (`expected "vi.fn()" to not be called at all, but actually been called 1 times`, `mutation-item-2-binding-removed.log`); the file was restored
  and its sha256 re-verified.
- GREEN: `green-items-2-3-4.log` (below). Titles: `executes approved internal object verification through the queue seam` unchanged; one test added
  (the refusal above).

## Item 3: checker node bound

Derivation (comment in `input-schema.ts`, constants exported there): fields 128 (BE03a:210 `fields` 0 to 128; the BE03b:2039 `values`
object is bounded at 128 keys) x object properties 32 (DEC-133; BE03a:216; BE03b:1542) = 4,096 field nodes (a field is one whole value
or an object of at most 32 properties, so at most 32 nodes); template slots 64 (BE03c:362) x slot `maxCount` 128 (BE03c:472) = 8,192 block
nodes; total 12,288 = `ACCESSIBILITY_NODES_MAX` (was 256). SQL has no node-count bound (`cms_revision_render_plan` and
`cms_load_quality_gate_input` have none), so there was no SQL constant to change; the SQL limit that interacts is the 1 MiB document cap
(see below), which I left alone.

Spec gap, flagged: the locked specs set no per-revision cap on composition instances for an entry WITHOUT a template (one per
(revision, path), paths unbounded); the dependency manifest caps distinct block versions (128), not instances. I used the template
maximum for every revision.

- RED: `red-item-3.log` (constants added, bound still 256): `expected 256 to be 12288`; `expected [...] to have a length of 256 but got
12288` (the exactly-max test); `expected false to be true` (257 nodes refused).
- Change: `ACCESSIBILITY_NODES_MAX = FIELDS * PROPERTIES + SLOTS * INSTANCES`.
- Tests (all GREEN, `green-items-2-3-4.log`). Old title `bounds the node list at 256 entries` (`input-schema.test.ts`, not cited by any ledger)
  replaced by:
  - `derives the node bound from the locked maxima: 128 fields x 32 properties + 64 slots x 128 instances`
  - `accepts a revision at exactly the maximum node count and refuses one node more` (4,096 property nodes + 8,192 blocks accepted; one block more refused)
  - `accepts 257 nodes, which the former 256-node bound refused although a valid revision carries up to 4,096 property nodes`

  New `max-input.test.ts`: `evaluates exactly ACCESSIBILITY_NODES_MAX nodes healthy inside the 2,000 ms budget` (real gate, JSON round trip) and
  `refuses one node more as an unreadable target without evaluating it` (`TARGET_UNREADABLE`).

Timing at the derived maximum (host load 0.8-1.7, `flock -x` held, 3 rounds; `worker-max-nodes-timing.txt`, `bench/probe_load_max.sql`
and `bench/probe-loadmax.out`):

| Revision                                               | Nodes  | JSON bytes | SQL load (`cms_accessibility_checker_input`) | Worker: JSON parse + zod + checker (gate) |
| ------------------------------------------------------ | ------ | ---------- | -------------------------------------------- | ----------------------------------------- |
| former bound                                           | 256    | 91 KB      | 49-59 ms                                     | 20-40 ms                                  |
| 128 x 32 property nodes (280-byte values, 4-char keys) | 4,096  | 1.6 MB     | 562-795 ms                                   | 259-266 ms                                |
| same, 64-character property keys                       | 4,096  | 1.84 MB    | 451-559 ms                                   |                                           |
| 8,192 block nodes only                                 | 8,192  | 2.82 MB    | 1,123-1,296 ms                               |                                           |
| exact maximum (4,096 property + 8,192 block)           | 12,288 | 4.41 MB    | 1,665-1,791 ms                               | 321-483 ms (4.3 MB parse 177-212 ms)      |

`cms_revision_render_plan` alone is 234-243 ms at 12,288 rows. So the derived maximum is NOT evaluable inside 2,000 ms: the load alone is
1.67-1.79 s, and the 0.3-0.5 s of Worker work comes on top (2.0-2.3 s before PostgREST encoding and transport of 4.4 MB, which I did not measure). It also
cannot arrive: the load returns the uniform `NOT_FOUND` for a document above 1 MiB, which binds at about 3,050 block nodes (344 bytes
each) or 2,700-5,500 property nodes (190-390 bytes each); `QUALITY_GATE_MAX_RESPONSE_BYTES` is the same 1 MiB on the Worker. Both end as an
unavailable check, never a pass, exactly as the 256 bound did, so this is strictly better than before (revisions from 257 nodes up to the
1 MiB document cap, about 3,050 block nodes with a SQL load near 0.4 s, now evaluate where they were refused) and nothing regressed. I did not lower the bound to fit and did not touch the 1 MiB caps or the 2,000 ms deadline: raising the
caps to about 5 MiB and cutting the load (for example reading block registry facts once per distinct block version, at most 128, instead of
once per instance) are architecture decisions with a cost, for you. The Worker side alone (`max-input.test.ts`) holds at the maximum with
4-6x headroom.

## Item 4: concurrent dependency recheck

`supabase/tests/phase_02_slice_11_races/031-dependency-recheck-race.mjs`, kit `infra/database-races/recheck-kit.mjs`, fixture
`supabase/tests/phase_02_slice_11_recheck_race/090-race-fixture.sqlinc` (reviews frozen from the real manifest of their own revision, one
composed block each, the block then WITHDRAWN so the rebuilt manifest is equal and the identity not current; one source outbox event per
withdrawn block; control reviews on a supported block). Registered in `RACE_RUNNERS` (the gate test
`phase-02-slice-09-race-runner-gate.test.ts` passes) and in the races README.

Scenarios (26 `ok -` lines): R1 two runs, four stale reviews (three open, one approved), both observed waiting on a session holding the
lowest review row `FOR UPDATE`, nothing committed; released: exactly one run invalidates all four (`4/0`), each review
`invalidated`/`dependency_changed` once (open v2, approved v3), one `cms.entry.review-changed.v1` and one audit record per review with the
source event's correlation id, dependency rows retained, no error or deadlock. R2 four runs behind the same holder over eight reviews: the
invalidated counts sum to eight (`8+0+0+0`), one event and one audit record each, controls untouched. R3 two more concurrent runs per event
answer `examined 0, invalidated 0`, nothing emitted. R4 two concurrent runs naming the supported block examine two reviews, invalidate none.

- GREEN: `race-green3.log` (26 ok, exit 0, after a `supabase db reset`). Two earlier runs failed on my own test bugs and were fixed:
  `race-green1.log` (`kit.value` missing in the `finally`), `race-green2.log` (R3 compared JSON member order).
- It is red for the right reason when the production guarantee is removed (mutation applied to the disposable database only):
  `race-mut-noguard.log` (the idempotent no-op `if review_row.state not in ('open','approved')` removed) and `race-mut-nolock.log` (the
  `FOR UPDATE` removed) both stop at R1 with `ASSERTION FAILED: R1: both runs commit and no error or deadlock surfaces (... ERROR: CONFLICT ...)`;
  the table state guard turns the double invalidation into a visible CONFLICT, so the runner also proves that second line of defence.
- Finding about behaviour, not a defect: ascending lock order serializes the runs, so the run that wins the first review invalidates
  everything and the other reports `invalidated: 0`; the sum equals the number of affected reviews.

## Verification

- `green-items-2-3-4.log`: `vitest run` on `a11y-structural`, `production-composition`, `async-runtime*`, `cms-editorial-production-quality-gate`,
  `index.test` and `tests/contracts/phase-02-slice-09-race-runner-gate`: 36 files, 643 tests passed.
- `tsc --build apps/worker/tsconfig.json`: exit 0. `eslint --max-warnings=0` on every touched `.ts`/`.mjs`: exit 0. Prettier clean on my files.
- Not run: `pnpm db:verify`, `pnpm validate`, evidence collectors (orchestrator's).
- The main stack was reset to the worktree's migrations at the end (mutated functions are gone).

## Open items for you

1. Item 1: decide whether the Slice 09 owners tune `cms_create_type_draft` (compute the manifests once, validate and insert set-based) or whether
   AC-217's 300 ms p95 must be treated as host-dependent: on this host it fails on origin/main 7 of 7.
2. Item 3: decide on the 1 MiB caps and the load cost if revisions beyond about 3,000 nodes must be checkable; decide the per-revision
   instance cap for template-less entries (spec gap).
3. Pre-existing, not mine: `apps/worker/src/production-job-effect-dispatcher-cms-lease-control.test.ts` fails 34 of 39 at HEAD (frozen RED
   from `9700b672 test: freeze typed CMS receiving and lease70 RED`; `preexisting-lease-control.log`). I did not run the other worker suites
   beyond the list above (a full `apps/worker` run did not finish in 10 minutes and was stopped).
4. Ledger: AC-113 can cite the `031` assertion titles (`race-green3.log`); AC-100/101 can cite the three new `input-schema.test.ts` titles and
   `max-input.test.ts`. The tracker and `supabase/migrations/README.md` need no entry from this lane.
