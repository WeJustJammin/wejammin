# Lane claude_s12_s11_sweep_isolation report (2026-10-23)

## Status
GREEN (awaiting root run). Pure controls, eslint and prettier pass; no DB-bearing run was made (forbidden for this lane).
The scoped SQL has been read but never executed against Postgres: the first DB run is root's.

## Scope
Fix the TEST, not the product: sweep-outcomes "[CMS-03B-20] real 60-second and 300-second retries ..." passes alone, fails
in the full `db:api-test` (assertion `'one real due retry'`). Debug-by-test evidence already existed (isolated 3/3 green
`.lane-logs/canonical/s11-sweep-isolated-20261023T071725Z.log`; full-run failure `db-verify-20261023T060745Z.log`, line ~8252).

## Diagnosis (code-verified)
- `claimsOf(trace)` (support/phase-02-slice-11-sweep-support.ts:124) returns the ONE global batch from
  `cms_claim_due_publication_schedules` (batch 25). `tick(ids)` only names schedule ids that receive a load/execute 503 fault;
  it never limits what is claimed.
- The test compared the whole batch to `[retry.id]` and bracketed every tick with `snapshotDigest()` /
  `expectScheduleEffects` / `expectUnchanged`. Those hash EVERY row of EVERY one of the 14 `EFFECT_TABLES` (global), so
  foreign claims broke the claim assertion AND would have moved every digest/delta (audit +N, versions, outbox, evidence).
- Culprits that leave schedules due: `phase-02-slice-11-schedule-precision.apispec.ts` and
  `phase-02-slice-11-schedule-precision-legacy.apispec.ts` create `SECOND = now + 300 s` publish schedules (fractional
  nanoseconds) and never wait or tick them. The outcomes ladder (tick ~T+80, +15 s, +60 s, +300 s) crosses T+300 at the third
  tick, exactly the trace in the failing log (third tick at 06:57:37 executed other suites' schedules).
  Checked and NOT culprits: schedule.apispec / -actions / -time (lead 172_800_000 ms = 2 days, or fixed future dates),
  -precision-authority (next-day / validThrough dates), claim-gate-manifest (fixture request, no real schedule).
- All Slice 11 suites share one owner (`world.owner`), so an owner filter cannot isolate a world: scope by schedule id.

## Fix
1. `support/phase-02-slice-11-world-scope-core.ts` (PURE, new): `claimsInWorld`, `expectWorldClaims(claims, worldIds,
   expectedIds, label)` (compares only claims whose id is in the world, so it also proves none of the world's OTHER schedules
   was claimed; expected ids outside the world are refused so a typo cannot pass vacuously), `scopedSnapshotSql(worldIds)`.
   Scoped digest = the same 14 groups, same whole-row SQL-side hashing, filtered to rows reachable from the world's schedules:
   schedules by entry; revisions/entries by entry; reviews/evidence by revision; decisions/assignments/dependencies by
   review; versions/preview tokens by entry; audit `target_id` and outbox `aggregate_id` by the set {entries, revisions,
   reviews, publication versions, publication ids, schedules}. `idempotency_records` and `cms_publication_settings_snapshots`
   have no world key and stay whole-table (the sweep never writes them; own-schedule execution already asserts delta 0 there).
2. `support/phase-02-slice-11-world-scope.ts` (DB-bearing, new): `scopedSnapshotDigest(worldIds)`; throws when a world id is
   not an existing schedule (no vacuous all-empty digest). Re-exports the claim helpers.
3. `snapshot-core.ts` / `effect.ts`: moved `tableDigestSql` (+ `DEFAULT_ROW_TEXT`) into the pure core and exported it, so the
   global and scoped digests share ONE builder (no copy-paste). `snapshotDigest` behaviour byte-identical (SQL text unchanged).
4. `sweep-outcomes.apispec.ts`, `sweep-composition.apispec.ts`: use the world helpers (see Test corrections).
5. `tests/postgrest/README.md` "Shared database: judge your own world" (rule + procedure); `support/README.md` rows.
6. Pure controls `tests/contracts/phase-02-slice-11-world-scope.test.ts` (11 tests): foreign claim ignored; missing own claim,
   unexpected own claim, duplicate own claim and non-empty "none due" all rejected; ids outside the world refused; SQL covers
   each of the 14 tables exactly once, filters the sweep-written tables, leaves the two unkeyed tables whole, rejects empty or
   non-uuid worlds (no SQL injection path). RED first: module absent -> suite failed to load; GREEN after implementation.

## Files (before -> after SHA-256)
| File | Lines | Before | After |
|---|---|---|---|
| tests/postgrest/phase-02-slice-11-sweep-outcomes.apispec.ts | 386 | c3781a1fe083cc9e1379102f419e84fc5a648e6f73be2e23b365e983fe4c3f9c | d4910f19de4cce6da88f1555bca2513f4db115d048c57811305c6130128ad2bf |
| tests/postgrest/phase-02-slice-11-sweep-composition.apispec.ts | 370 | bedf868d5f68b75f70cf99577d42c6c536c8ac7696624f4e96e3b4ffacc58e2e | 37eaaed88343625b467cd6064d2ac69bd952876b2c0d99c04bbbc65ce39f303a |
| tests/postgrest/support/phase-02-slice-11-snapshot-core.ts | 125 | 5c8aa952b91196623d2ba87eb2293c1966bfd451a2158632f7a0331ecb937d90 | f7ec5b48dbe8dbe45afd6b518014799f97bca756038b34d827054671432aa17f |
| tests/postgrest/support/phase-02-slice-11-effect.ts | 104 | 887c3f554d00bf53bc23cbe393bf64ff1c9ff0b08b466ac2d9371022479f7e18 | 42ac6db7a3f24ed9e4ce4bdd4abdc083f40539ded9d8c68b556a0874c5997264 |
| tests/postgrest/README.md | 196 | 4e50bebef2c690d932599da159c80ebad69ee2f9e4ea8770b6cb39a2b25bab2b | 1a1796cb4302214411d5d9b9a745c9e31c2c75e56c46460b7661ab224960e652 |
| tests/postgrest/support/README.md | 187 | e440a70f01605cb9f7eac7912e325f6e828cfe7f342d40786bd38d5d09461e1b | 756038eefb8d140e02c37a4be98dafbf903635416ad732901b040649ac60c085 |
| tests/postgrest/support/phase-02-slice-11-world-scope-core.ts (new) | 138 | - | ab11872c39e009f45face2d07764194a7017b0a145a1782d457ae722d87ed7b3 |
| tests/postgrest/support/phase-02-slice-11-world-scope.ts (new) | 35 | - | 5a34d04ce7f623caa40240be7a12ce4b31e88109563ff383e30922ae18927712 |
| tests/contracts/phase-02-slice-11-world-scope.test.ts (new) | 107 | - | 4f1145f49cb5e6022519e233811509b4c4d4394a2a712d63d6c7da4d722a3eb1 |

Note: both READMEs were already modified (uncommitted) by other lanes; the SHA-256 "before" is the on-disk state at 08:36Z.
Backups (tracked files, but tarred per rules): scratch `.../scratchpad/claude_s12_s11_sweep_isolation/orig-20261023T083623Z.tar`
(+ an earlier empty-name attempt orig-20261023T083618Z.tar), `before.sha256`, `after.sha256` in the same directory.

## Test corrections (every changed assertion; none weakened beyond scoping)
sweep-outcomes.apispec.ts (`worldIds` = retry, noHead, then expired + fresh when test 3 creates them):
1. T1 claim set: `expectSafeEqual(all claims sorted, [retry,noHead])` -> `expectWorldClaims(claims, worldIds, [retry,noHead])`.
   Reason: foreign due schedules are legitimately claimed. Still exact over the world; also proves no other world schedule claimed.
2. T1 `before`/`after`/`expectScheduleEffects`/`expectUnchanged`: `snapshotDigest()` -> `scopedSnapshotDigest(worldIds)`; same
   deltas (schedules 0, evidence +1, audit +2). Reason: global groups include foreign executions.
3. T1 "tick before first retry deadline": `claims.length === 0` -> `expectWorldClaims(..., [])` (no world schedule claimed) +
   scoped unchanged digest. Reason: a foreign schedule may be due and claimed; this world must not be.
4. T2 ladder (3 iterations): `claims == [retry]` -> `expectWorldClaims(..., [retry])`; scoped before/after deltas (schedules 0,
   audit +1); the post-tick `claims.length === 0` -> `expectWorldClaims(..., [])`; scoped unchanged digest. Same reasons.
   The prior-publication-active and per-row CAS/delay/attempt oracles are untouched.
5. T3 lease witness: `claims == subjects` -> `expectWorldClaims(claims, worldIds, subjects)`. Reason as 1.
   The final `before`/resend/`expectUnchanged` pair intentionally stays on the GLOBAL `snapshotDigest()`: no tick or sleep can
   intervene between the two digests (only `waitForLeaseExpiry` precedes `before`), so it is race-free and strictly stronger.
sweep-composition.apispec.ts (`worldIds` = the 4 lineage schedules, then each of T3/T4's schedule):
6. T1 exact set -> `expectWorldClaims`; `before`/`expectScheduleEffects` -> scoped; audit delta `4 + recoveredCount`
   -> `4 + ownRecovered` where `ownRecovered` = the recovery-proof candidates that are this world's schedules.
   `assertScheduleRecoveryProof(recoveryBefore)` is still called on the GLOBAL proof (its oracle is unchanged); only the
   audit-row delta attributable to this world feeds the scoped digest. Reason: recovery audits of foreign expired leases now
   land outside the scoped audit group.
7. T3 and T4: mid-tick barrier digest and post-tick digest `snapshotDigest()` -> scoped (foreign claims executed after the
   barrier in the same tick moved the global digest). T2 (replay, no tick) stays global.
Not changed: `sweep.apispec.ts` and `sweep-stale-evidence.apispec.ts` already assert per schedule id (`find`/`executionOf`) and
take no global digest; `expectOperandChain` stays global (it passed with foreign claims in the failing run, line 205 precedes 206).

## Runs
| Time | Command | Result |
|---|---|---|
| 08:37Z | vitest run tests/contracts/phase-02-slice-11-world-scope.test.ts (before implementation) | RED: module not found (suite fails to load) |
| 08:37Z | same (after implementation) | 11/11 pass |
| 08:39Z | vitest run world-scope + claim-resolver-snapshot controls | 217/217 pass |
| 08:39Z | eslint + prettier --check on all 9 files | clean |
No DB run (forbidden). The pre-fix failure itself is the existing canonical log, not a rerun.

## Root commands (run in this order; the first alone is the regression, the second reproduces the failing interleaving)
Isolated (must stay green):
`cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin && PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH pnpm exec vitest run --config vitest.postgrest.config.ts tests/postgrest/phase-02-slice-11-sweep-outcomes.apispec.ts`
Combined (culprits first, then outcomes + composition within 300 s, no reset between; fresh `pnpm db:reset` before the pair):
`cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin && export PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH && pnpm exec vitest run --config vitest.postgrest.config.ts tests/postgrest/phase-02-slice-11-schedule-precision.apispec.ts tests/postgrest/phase-02-slice-11-schedule-precision-legacy.apispec.ts && pnpm exec vitest run --config vitest.postgrest.config.ts tests/postgrest/phase-02-slice-11-sweep-outcomes.apispec.ts tests/postgrest/phase-02-slice-11-sweep-composition.apispec.ts`
(Two invocations because vitest orders files by its cache, not argv; the precision schedules are due at precision-beforeAll+300 s and
are claimed by the outcomes ladder's 300 s tick. Both must be green; before the fix the second invocation fails at 'one real due retry'.)
Then the canonical `pnpm db:verify` as usual.

## Spec citations
BE03b CMS-03B-20 (sweep claims all due schedules; execute/claim/lease semantics), `.memory/wiki/specs/be/03b-editorial-workflow-publication.md`;
unchanged product SQL `20261005017740_cms_execute_publication_schedule.sql`, `20261010162200_*conflicts.sql`.

## Open items / residual risk
- Scoped SQL never executed here. If it errors, root sees a psql error from `scopedSnapshotDigest` (fixed text, no id echo). Ids/tables
  used were checked against migrations: `cms_entry_revisions.entry_id`, `cms_editorial_reviews.revision_id`, `*_decisions|assignments|
  dependencies.review_id`, `cms_publication_versions.entry_id/publication_id`, `cms_preview_tokens.entry_id`,
  `cms_command_accessibility_evidence.revision_id`, `audit_events.target_id`, `outbox_events.aggregate_id`.
- Audit/outbox scoping assumes sweep audit/outbox rows target one of {schedule, entry, revision, review, publication version/id}
  (schedule audits target `cms_publication_schedule` ids; publication lineage targets the version/publication). If an execution
  audits another target class the delta assertion would show a missing row in the isolated run first.
- `idempotency_records` and `settings_snapshots` stay global; correct only while the sweep never writes them (current product).
- The same fragility exists in principle for any future sweep suite; the README rule now states it.

## Requests to root
None blocking. Optional: run the combined pair above once after `db:reset` to confirm the interleaving, then the canonical gate.
