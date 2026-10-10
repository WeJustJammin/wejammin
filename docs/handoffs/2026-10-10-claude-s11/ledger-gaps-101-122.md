# Slice 11 evidence ledger lane D: gaps for P2-S11-AC-101 .. AC-122

Verified against worktree `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`, branch `claude/phase2-slice11`, starting HEAD
`618ec5c16585d295263770a9d79138f36bfa10dc` (HEAD advanced to `9b9b588e` while I worked; I re-indexed every test source against the current tree
before writing the final ledger file, and every citation resolves).

Fragment: `tests/contracts/phase-02-slice-11-evidence-ledger-101-122.ts` (22 entries, texts untouched, clauses tile the texts, 528 citations on 477
distinct tests, no clause is the sole proof of more than one criterion). Written by a generator that looked each title up in a text index of the test
sources (nothing was run), then checked clause tiling, file existence, literal presence of every pgTAP description and race message, and
duplicate identities in cited files. It is not prettier-formatted; run `pnpm exec prettier --write` on it.

## Counts

verified 12 (101, 102, 104, 105, 107, 109, 110, 111, 114, 115, 117, 122), partial 10 (103, 106, 108, 112, 113, 116, 118, 119, 120, 121),
unverified 0.

## Gaps

### P2-S11-AC-103 — partial
- Unproven clause(s): "with stored schedules keeping the version and instant they were accepted with and recording the tag only"
- Implementation: present at supabase/migrations/20260927090000_cms_editorial_support_authority.sql:212-213 (`cms_publication_schedules_tzdb_version_check`, octet_length 1..32), supabase/migrations/20261005017070_cms_publication_schedules_reconcile.sql:146-156 (every column except the named ones is immutable), supabase/migrations/20261005017710_cms_schedule_publication.sql:207 (stores `cms_tzdb_version()` at acceptance).
- Missing evidence: extend `supabase/tests/phase_02_slice_11_schedules_schema.sql` with (1) `update ... set tzdb_version = ...` on an accepted schedule expecting `P0001:IMMUTABLE_RECORD`, (2) tag-grammar CHECK refusals (empty, 33 bytes), and extend `supabase/tests/phase_02_slice_11_rpc_publication_execute.sql` with a schedule accepted under an older tag (the row builder already uses `2026b`, `supabase/tests/phase_02_slice_11_schema/002-row-builders.sqlinc:124`) that is claimed and executed while `cms_tzdb_version()` is `2026e`, asserting the resource and row keep the old tag and the instant. The accepted-instant immutability and the stored-at-acceptance tag are already cited.
- Size: S

### P2-S11-AC-106 — partial
- Unproven clause(s): "stays within the bundle-budget thresholds"; "reproduces the spring-forward gap, fall-back fold, `UTC` and three-segment zone cases"
- Implementation: present. Form `apps/web/src/components/cms-editorial-workflow/CmsEditorialScheduleForm.tsx`, resolver `cms-workflow-schedule-resolution.ts`, lazy hook `use-cms-schedule-time.ts`, chunk carve-out `apps/web/client-chunk-boundaries.mjs`, budget gate `scripts/verify-bundle-budget.mjs` (`BUNDLE_BUDGETS`: workbench 35 KiB, initial route 90 KiB, lazy chunk 80 KiB gzip).
- Missing evidence: (a) bundle budget: the only gate is the build script (`pnpm bundle:check`), which is not a citable tool and never names the `contracts-time-authority` chunk. Add a vitest in `apps/web/src/client-chunk-time-authority.test.ts` (or a build-output test under tests/) that feeds the built `contracts-time-authority` chunk (about 26 KB gzip) and the initial route through the budget evaluator and asserts they stay under `lazyChunkGzipBytes` and `initialRouteGzipBytes`, or a Playwright real-route check that the snapshot chunk is fetched only when the form opens. (b) three-segment zone: add to `cms-workflow-schedule-resolution.test.ts` a case `resolve('2026-12-01T09:00', 'America/Argentina/Buenos_Aires')` expecting `2026-12-01T12:00:00Z` and offset -10800, and a `CmsEditorialScheduleForm.test.tsx` case that sends it. Gap, fold and UTC are cited.
- Size: M (a), S (b)

### P2-S11-AC-108 — partial
- Unproven clause(s): "in this order"
- Implementation: present at supabase/migrations/20261005017630_cms_record_review_decision.sql:14-36 (documented sequence; reservation and content-type lock sit inside it).
- Missing evidence: pgTAP in `supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql` with callers who fail two steps at once, one assertion per adjacent pair, so reordering fails a test: hidden review plus stale `If-Match` (404 beats 409); stale `If-Match` plus drifted manifest (VERSION_MISMATCH, no invalidation committed); drifted manifest plus submitter/author (dependency_changed commits the invalidation, no separation error); submitter plus lapsed `cms.reviewer` grant (`separation_of_duties`, not `capability_missing`); duplicate decision plus lapsed grant (`duplicate_decision`). Only step-up before concealment, state before CAS and state before rebuild are asserted today.
- Size: M

### P2-S11-AC-112 — partial
- Unproven clause(s): "the entry lifecycle leaving `active` (`archived`, `deletion_pending`, `held`) yields `entry_unavailable`"
- Implementation: present at supabase/migrations/20261005017580_cms_review_invalidation.sql:493-495 (trigger fires when `old.lifecycle = 'active'` and the new value differs).
- Missing evidence: extend `supabase/tests/phase_02_slice_11_helpers_invalidation.sql` (Producer 2 block, lines 305-325) with `deletion_pending` and `held` while a live approved review, a pending schedule and an unexpired token exist: review `invalidated/entry_unavailable`, schedule `cancelled/entry_unavailable`, token revoked. Today only `archived` is asserted for the review and `held` only for tokens of an entry with no live review.
- Size: S

### P2-S11-AC-113 — partial
- Unproven clause(s): "the consumers of `cms.schema.activated.v1`, `cms.template.activated.v1`, `cms.pattern.activated.v1`, `cms.taxonomy.changed.v1`, `cms.localization.changed.v1` and `cms.block.lifecycle.changed.v1` enqueue the job `cms.review.dependency_recheck` with `{ eventId, kind, refId }`"; "which selects live reviews through the index, rebuilds each manifest, invalidates on inequality or a non-current identity"; "is idempotent (an `invalidated` review is skipped)"; "handles at most 500 reviews per run with a continuation cursor"
- Implementation: appears missing (searched: apps/worker/src for the job name and the six event types, supabase/migrations for `recheck` and for functions selecting reviews through `cms_editorial_review_dependencies`, packages/contracts, infra/). Only the payload contract exists (`packages/contracts/src/cms-editorial/jobs.ts`: job type token, nine kinds, strict `{ eventId, kind, refId }`, `CMS_REVIEW_RECHECK_BATCH_MAX = 500`) and the index/guard table (`supabase/migrations/20261005017040_cms_editorial_review_dependencies.sql`). The per-review primitive `cms_invalidate_editorial_review` is idempotent (helpers_invalidation.sql "already invalidated review is an idempotent no-op") but is not the job. `apps/worker/src/production-cms-review-authority-sweep.ts` is the authority-expiry sweep, a different job.
- Missing evidence: build the six event consumers and the recheck handler, then: vitest per consumer asserting the enqueued payload for each event type; pgTAP selecting live reviews through the `(kind, ref_id)` index, rebuilding each manifest and invalidating on inequality and on a non-current identity (reason `dependency_changed`); an invalidated review skipped with no second event; a 501-review fixture proving 500 per run and a continuation cursor that finishes the 501st; a race runner for two concurrent runs. Remove or keep the already cited schema/index clauses unchanged.
- Size: L

### P2-S11-AC-116 — partial
- Unproven clause(s): "`projectionState` is read from Shard 04 `projection_consumer_state` for the row id (`pending` while no consumer has reported, `converged` when every registered consumer reports the row, `degraded` when a consumer failed terminally) without ever rolling back canonical state"
- Implementation: appears missing by decision (searched: supabase/migrations for `projection_consumer_state`, `converged`, `degraded`). `projectionState` is the literal `'pending'` at supabase/migrations/20261005017590_cms_publication_lineage_append.sql:326 and supabase/migrations/20261005017900_cms_get_entry_workflow.sql:205; DEC-158(e) fixes it at `pending` until a Shard 04 consumer reports (Slice 15). Criterion text and DEC-158(e) disagree.
- Missing evidence: either the owner amends the criterion text to the DEC-158(e) behavior (then cite helpers_lineage.sql "the first publish is active, version 1, projectionState pending ..."), or Slice 15's table lands and the lineage append and workflow read call it, with pgTAP for pending (no consumer row), converged (every registered consumer reports the row id) and degraded (one terminal failure) plus a test that a degraded state leaves the lineage row, event and audit intact.
- Size: L (implement) / S (amend text)

### P2-S11-AC-118 — partial
- Unproven clause(s): "through the service-role takedown RPC"
- Implementation: present only as a seam. `platform_private.cms_revoke_preview_tokens` (supabase/migrations/20261005017870_cms_revoke_preview_tokens.sql, accepts `reasonCode` `takedown`) has no `platform_api` wrapper and no API grant by design; the service-role takedown RPC that calls it is Shard 16.
- Missing evidence: the seam is exercised with `reasonCode: 'takedown'` by entry (supabase/tests/phase_02_slice_11_rpc_preview_revoke.sql:77-86) but never as a service_role caller and there is nothing service-role callable to test. Either the owner amends the criterion to "through the database-internal takedown seam" (then cite rpc_preview_revoke.sql "revoking an entry answers { revokedTokens } ..." and "each revoked token is CAS-revoked ..."), or a `platform_api` wrapper executable by service_role only is added, with pgTAP in `rpc_preview_revoke.sql` calling it as service_role with `reasonCode: 'takedown'` and asserting CAS revocation (state `revoked`, `revoked_at`, `version + 1`), no effect on other tokens, and no execute for anon/authenticated.
- Size: M

### P2-S11-AC-119 — partial
- Unproven clause(s): "(advancing `version` and `updated_at`)"
- Implementation: present at supabase/migrations/20261005017020_cms_editorial_review_assignments.sql:90-99 (guard rejects only `updated_at` moving backwards) and supabase/migrations/20261005017620_cms_assign_editorial_reviewer.sql (revoke action).
- Missing evidence: pgTAP in `supabase/tests/phase_02_slice_11_review_assignments_guard.sql` that a revoke leaving `updated_at` unchanged (or older) is refused, and an assertion in `supabase/tests/phase_02_slice_11_rpc_review_assign.sql` that the revoke response's `updatedAt` is later than the creation's. `version + 1` on revoke is cited.
- Size: S

### P2-S11-AC-120 — partial
- Unproven clause(s): "(1 to 8)"; "a non-empty `required_capabilities`"
- Implementation: present at supabase/migrations/20260927090000_cms_editorial_support_authority.sql:105-108 (`required_capabilities` array of 1 to 16), :110-111 (`required_decision_count between 1 and 8`), :119-123 (protected: count >= 2 and at least one capability).
- Missing evidence: in `supabase/tests/phase_02_slice_11_reviews_schema.sql` add `23514` refusals for `required_decision_count` 0, 9 and -1 with 1 and 8 accepted, a review (ordinary and protected) with `required_capabilities = []` refused, and a protected review with count 1 and a non-empty list refused. The row builder always supplies `["cms.reviewer"]` (supabase/tests/phase_02_slice_11_schema/002-row-builders.sqlinc:42), so the only existing protected-review refusal ("a protected review needs at least two decisions") fires the count rule alone and no empty-list case exists.
- Size: S

### P2-S11-AC-121 — partial
- Unproven clause(s): "`updated_at = created_at`"
- Implementation: present at supabase/migrations/20260927090000_cms_editorial_support_authority.sql:168 (`cms_editorial_decisions_snapshot_time_check CHECK (updated_at = created_at)`) plus the append-only guard in supabase/migrations/20261005017030_cms_editorial_decisions_reconcile.sql.
- Missing evidence: pgTAP in `supabase/tests/phase_02_slice_11_review_decisions_schema.sql` inserting a decision with `updated_at <> created_at` and expecting `23514`, and an assertion that a recorded decision has the two equal (the dependency table already asserts this for its rows in `phase_02_slice_11_review_dependencies_schema.sql`). UPDATE and DELETE refusals are cited.
- Size: S

## Cited clauses that are thin (not gaps, flagged so nobody reads "verified" as stronger than it is)

- AC-105 "the Worker passes only the verified time members to the RPC": proven indirectly (refusal before any RPC, response-invariant test, DB echo test); no test captures the RPC request body and asserts its time members.
- AC-106 "the same pinned snapshot and resolver the Worker uses": structural (both import `@wejammin/contracts/time-authority`); no web-versus-Worker differential test.
- AC-112 "CMS-03B-01, CMS-03B-02 and CMS-03B-04 invalidate ... in the same transaction as the append": proven by the revision-table producer trigger (direct appends) and by the CMS-03B-01 append race; no per-command test for CMS-03B-02 (conflict resolve) or CMS-03B-04 (restore).
- AC-109 "in `requiredCapabilities` order": every protected class has one specialist slot (DEC-110), so multi-specialist ordering is untested but unreachable today.
- AC-120 "frozen revision, dependency, activation ... evidence is immutable": tests change `frozen_hash`, `dependency_manifest` and `required_capabilities`; the activation-evidence columns are covered only by the column-generic guard.
- AC-119 decide window: tests use windows clearly over or not started; the exclusive-end boundary `now < ends_at` is not asserted.
- AC-107 scheduling: the 403 `separation_of_duties` for a scheduled publish is DB-level plus a Worker mapping unit test; the real-stack HTTP 403 is asserted only for publish.
- AC-101 "within 2,000 ms": proven with fake timers; no real-stack timing test.
- AC-103 "one release tarball": the pin uses two (tzdata and tzcode); the tests assert the two-tarball pin.

## Summary

(a) Counts: verified 12, partial 10, unverified 0.

(b) Criteria whose implementation appears entirely missing: none whole. Missing parts: AC-113 (the dependency-recheck job and its six event consumers: four of six clauses), AC-116 (`projection_consumer_state` read, deferred by DEC-158(e)), AC-118 (a service-role takedown RPC; only a private seam exists, Shard 16 owns the caller).

(c) Cited tests I have reason to believe fail or skip, or that are in flux:
- `tests/contracts/phase-02-slice-11-tzdb-pin.test.ts:151` has `it.skipIf(!existsSync('/usr/share/zoneinfo/America/New_York'))` ("reads a real TZif file down to offsets, transitions and the POSIX footer"). The file is cited (AC-103) and that test is not; on a runner without tzdata the guard reports a hidden skip.
- Uncommitted work by other lanes touches cited files: `supabase/tests/phase_02_slice_11_helpers_preflight.sql` (plan 157 to 162, DEC-160 changes, with `supabase/migrations/20261005017570_cms_preflight_evaluation.sql`) and `supabase/tests/phase_02_slice_11_rpc_review_assign_refusals.sql` (with `20261005017620_cms_assign_editorial_reviewer.sql`). Their receipts must be collected after those lanes land; the titles I cite from them are unchanged in the modified copies.
- No cited vitest file carries `.skip`, `.todo` or `.fails`; no cited pgTAP file contains `skip()` or `todo()`; no cited file has a duplicate test identity. The race runners I cite (`011`, `012`, `015`, `016`, `020`) must run under the database lock like all runners; only messages without runtime interpolation are cited.
