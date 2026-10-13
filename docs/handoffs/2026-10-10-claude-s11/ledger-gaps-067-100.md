# Slice 11 evidence ledger gaps, lane C (P2-S11-AC-067 .. AC-100)

Worktree `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`, branch `claude/phase2-slice11`,
HEAD `618ec5c16585d295263770a9d79138f36bfa10dc`. Ledger fragment:
`tests/contracts/phase-02-slice-11-evidence-ledger-067-100.ts` (34 entries, 770 citations: 449 pgTAP, 303 vitest, 16 race, 2 Playwright).

Method: every citation title was resolved from the test source by script (vitest title paths
including `it.each` expansions, pgTAP description literals, race `check(...)` messages,
Playwright titles), then checked for existence, uniqueness inside its file and clause tiling.
Nothing was run (no tests, no database); no citation has a receipt yet. Evidence quality was
judged by reading the assertions, not the titles.

Titles produced by loops that could not be expanded mechanically were built by hand and checked
only against the template shape: `workflow-command-admission.test.ts`,
`workflow-command-quota.test.ts` (title tail = operation id `CMS-03B-18`),
`if-match-binding.test.ts` (title tail = schema name), the `phase-02-slice-11-preview-verifier.apispec.ts`
`it.each` (verified equal to the expansion), the parity-fixture describes of
`phase-02-slice-11-sql-parity.test.ts` (fixture names read from the shared `.sqlinc`) and the
catalog severity `it.each` over `Object.entries`. If a collector run reports "no receipt" for one
of these, fix that title first.

## Not verified

### P2-S11-AC-071 — partial
- Unproven clause(s): "retries the review event idempotently"
- Implementation: present at `supabase/migrations/20261005017620_cms_assign_editorial_reviewer.sql:317`
  (`cms_emit_event`); redelivery de-duplication belongs to the BE00 outbox consumer.
- Missing evidence: a test that delivers the `cms.entry.review-changed.v1` event of an assignment
  change twice (outbox redelivery, same event id) and shows one effect. Vitest/pgTAP over the
  outbox consumer seam, or a pgTAP that proves the event row's dedupe key is stable across a
  command replay and a re-dispatch. The existing pgTAP "replay adds no second event" proves
  command replay only.
- Size: S

### P2-S11-AC-072 — partial
- Unproven clause(s): "and returns focus to the assignment list heading after commit"
- Implementation: present at `apps/web/src/components/cms-editorial-workflow/CmsEditorialAssignmentCreate.tsx:67`
  (`onDone(REVIEW_DETAIL_HEADING_IDS.assignments)`) and
  `apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewDetailIsland.tsx:37` (`focusHeading`).
- Missing evidence: extend `CmsEditorialReviewDetailIsland.test.tsx` with an owner who creates an
  assignment (and one who revokes) and assert `document.activeElement?.id === 'review-assignments-title'`
  after the refetch, mirroring the existing decisions-heading focus test. Today the form test
  only asserts `onDone` is called with the id, and the detail test that the heading is focusable.
- Size: S

### P2-S11-AC-073 — partial
- Unproven clause(s): "and its shape equals the BE04c `Shard 03 preview-token verifier` seam."
- Implementation: present (contract `packages/contracts/src/cms-editorial/internal-rpc.ts:67-110`,
  SQL `supabase/migrations/20261005017850_cms_verify_preview_token.sql:33`, adapter
  `apps/worker/src/cms-editorial-production-preview-verifier.ts`). The Shard 04 consumer does not
  exist yet (the adapter has no importer until Slice 15).
- Missing evidence: a contracts test (precedent: `phase-02-slice-11-tzdb-pin.test.ts` reads
  `.memory/wiki/decisions.md`) that reads the seam row at
  `.memory/wiki/specs/be/04c-public-delivery-cache.md:88` and asserts the request member names/types,
  the two result branches, the 500 ms / 75 ms + 150 ms / 30 s timings equal
  `PreviewVerificationRequestSchema`, `PreviewVerificationResultSchema` and the
  `CMS_PREVIEW_VERIFIER_*` constants.
- Size: S

### P2-S11-AC-080 — partial
- Unproven clause(s): "`version` equal to the schedule's `expected_version`, frozen hash and
  dependency hash equal to the schedule's)"
- Implementation: present at `supabase/migrations/20261005017740_cms_execute_publication_schedule.sql:179-183`
  (compound guard: review state, version, dependency hash, activation-evidence hash, frozen hash
  versus the revision payload hash). The cited tests reach `approval_invalidated` only through an
  invalidated review and a drifted frozen manifest.
- Missing evidence: pgTAP in `phase_02_slice_11_rpc_publication_execute_refusals.sql` (or a new
  file) that claims a schedule, then forces (raw update, as the file already does for grants) an
  approved review whose `version`, `dependency_hash`, activation-evidence hash and frozen hash each
  differ from the schedule's, and asserts each executes as `blocked`/`approval_invalidated` with no
  lineage row and no event (four cases).
- Size: S

### P2-S11-AC-082 — partial
- Unproven clause(s): "runs claim and execute under the 15,000 ms job deadline"
- Implementation: present by default only: `apps/worker/src/async-runtime-rpc-transport.ts:27`
  (`ASYNC_RPC_DEADLINE_MS` = 15,000, `async-runtime-rpc-types.ts:63`) used through
  `createSupabaseRpc()` at `apps/worker/src/cms-publication-schedule-sweep.ts:225`. The constant
  `CMS_SCHEDULE_DEADLINE_MS` is asserted, the sweep never passes it.
- Missing evidence: vitest in `cms-publication-schedule-sweep.test.ts` that stubs a claim (and an
  execute) that never resolves, advances fake timers by 15,000 ms and asserts the sweep aborts the
  call and requests the platform retry; or an assertion that the RPC transport it builds carries
  `deadlineMs === CMS_SCHEDULE_DEADLINE_MS`.
- Size: S

### P2-S11-AC-087 — partial
- Unproven clause(s): "reads canonical state under RLS"
- Implementation: present at `supabase/migrations/20261005017560_cms_dependency_manifest.sql:105`
  (header: "callers run under the CMS RPC context"). Every pgTAP call sets `app.cms_rpc` first.
- Missing evidence: pgTAP in `phase_02_slice_11_helpers_manifest.sql` that calls the builder (a)
  without the CMS RPC context and (b) as a context whose RLS excludes the revision's owner, and
  asserts it returns nothing or refuses (the forced-RLS policy is the CMS RPC-context gate; the
  posture test already proves it exists on the nine tables).
- Size: S

### P2-S11-AC-090 — partial
- Unproven clause(s): "and a command that relies on a frozen set (CMS-03B-07, CMS-03B-09, the
  executor) and finds a non-current identity or a differing recomputed manifest returns 409
  `CONFLICT` `version_set_stale`"
- Implementation: present but different. A stale frozen manifest is the COMMITTED refusal 409
  `CONFLICT` `dependency_changed` with the current `dependencyHash`
  (`20261005017710_cms_schedule_publication.sql:30-33`, `20261005017720_cms_publish_revision.sql:24`,
  Worker `apps/worker/src/cms-editorial/workflow-error-details.ts:30`); the executor blocks the
  schedule `approval_invalidated`. `version_set_stale` is raised only when the caller's
  `expectedVersionSet` differs from the frozen or recomputed set. The tracker text (and BE03b line
  1773) therefore disagrees with the code and with every test that passes.
- Missing evidence: orchestrator decision first. Either amend the criterion/BE03b to
  `dependency_changed` (then this clause is cited by `phase_02_slice_11_rpc_publication_publish_refusals.sql`,
  `..._schedule_refusals.sql` and `phase-02-slice-11-publish.apispec.ts`, and the entry becomes
  verified), or change the implementation and tests. No test is missing under the first option.
- Size: S (text amendment) / M (code change)

### P2-S11-AC-092 — partial
- Unproven clause(s): "under the owner's advisory lock"
- Implementation: present at `supabase/migrations/20261010130000_cms_settings_write_tail_lookup.sql:73-76`
  (`pg_advisory_xact_lock`, then insert). The write-tail tests prove the result (ordinal = previous
  maximum + 1, first is 1, restore reuses the ordinal, whole-save rollback under a fault trigger)
  but nothing observes the lock; the lookup test only proves the read-only lookup retains no lock.
  The tail file itself notes "dynamic tail/lock-order source review remains a separate gate".
- Missing evidence: a race runner (new `supabase/tests/phase_02_slice_11_races/017-settings-snapshot-race.mjs`,
  registered in `infra/run-database-race-runners.mjs`) with two concurrent first saves of one owner
  that commit one ordinal 1 and one reuse, plus a held advisory lock that blocks a save. Or a
  pgTAP lock-observation (`pg_locks`) inside the save transaction.
- Size: M

### P2-S11-AC-098 — partial
- Unproven clause(s): "with no network provider, DOM or Browser Rendering provider" and ", targeting
  `cms.entry_revision` by revision id and `revision_number`, with exactly one current version per
  target type, older versions readable"
- Implementation: first clause present structurally (module has no I/O imports) but untested; the
  second appears missing in Slice 11 (searched `cms.entry_revision`, `quality_checker`,
  `target_type` in `apps/worker/src`, `packages/contracts/src`, `supabase/migrations`): the target
  type and checker-version registry are the BE05c request/registry model
  (`.memory/wiki/specs/be/05c-portability-quality-lifecycle.md:1000-1001`) that Slice 16 builds. The
  Slice 11 module only keys its input by `revisionId` and `revisionNumber`.
- Missing evidence: (1) an architecture vitest in `apps/worker/src/cms-editorial/a11y-structural/`
  that reads every non-test source of the directory and asserts no `fetch`, `document`, `window`,
  `puppeteer`, `Browser` binding or network import (precedent: `cms-editorial-principals.test.ts`
  `importersOf`) and a run of the gate with `fetch` stubbed to throw. (2) A criterion-text decision:
  either narrow AC-098 to what Slice 11 delivers (key, version, registry row, `timeoutMs`), or add a
  checker-version registry with a target type and a test of "one current version per target type,
  older versions readable".
- Size: S for (1), L for (2) unless the text is narrowed

## Notes on entries marked verified (judgement calls the orchestrator may want to revisit)

- "commits ... atomically" (AC-070, AC-084 and similar) was accepted on co-commit evidence: one
  RPC call leaves the row, the audit record, the single event and the completed reservation
  together, and refusals leave nothing. No fault-injection test exists for the assignment,
  claim/execute or lineage paths (the only one in the area is
  `phase_02_slice_11_e7_settings/002-review-atomicity.sqlinc` for the B01 save). If a stricter
  reading is wanted, a trigger-based fault test per command is S-M each.
- AC-069 "non-grantable" rests on `grants.contract.test.ts` "is the closed DEC-119 set" (the
  grantable list excludes `cms.editorial_review.assign`); there is no database-level test that a
  grant of that key is refused.
- AC-070 "locks the review row" is proven for create (race A4) only; revoke shares the code path.
- AC-072 verification list: the "grantor-authority bound" is shown at the form only through the
  server's `expiry_out_of_bounds` refusal copy; the bound itself is proven by pgTAP.
- AC-079/AC-081 "queue messages": no queue carries claims in this design (in-process Worker call);
  the claim and result payload tests were cited.
- AC-087 "only builder" is evidenced by single overload, definer posture and the server rebuild in
  submit; no test enumerates all functions returning a manifest.
- AC-089 "lowercase SHA-256 of the JCS manifest" uses the database function as its own oracle plus
  the independent RFC 8785 known answers of `phase_02_slice_09_r3_grants_misc.sql` and the `[]`
  constant; there is no TypeScript implementation of the manifest hash.
- AC-091 "evaluated at the command's server instant": tested with a passed instant; the registry
  is empty, so ordering and the `cfg_resolve_effective_value` call are source-shape assertions
  (`pg_get_functiondef` text) plus one injected-registry failure test.
- AC-096 text says the submit phase evaluates "categories 1-16"; every cited test shows all 17
  results in the submit report (accessibility via evidence). Treated as the same behaviour.
- AC-099 order "structure, heading, link, media, landmark": observable only through the
  cooperative-stop call counts and the final sorted output; media is inert.

## Totals

(a) verified 25, partial 9, unverified 0, contract-only 0 (34 criteria).
    Partial: AC-071, 072, 073, 080, 082, 087, 090, 092, 098.

(b) Implementation entirely missing: none for a whole criterion. Missing pieces: the BE05c
    checker-version registry / `cms.entry_revision` target type of AC-098 (Slice 16 scope); the
    `version_set_stale` outcome of AC-090 does not exist for stale frozen identities (the code
    answers `dependency_changed`).

(c) Cited tests believed failing or skipped: no `it.skip`, `todo`, `fails` or `skipIf` in any cited
    file (searched all 98 cited files; `phase-02-slice-11-tzdb-pin.test.ts` has a `skipIf` but is not
    cited). Tests touched by the uncommitted schedule-precision cascade and therefore at risk until a
    fresh full gate: `supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql`
    (modified, cited by AC-090 and AC-097), `supabase/tests/phase_02_slice_11_rpc_publication_execute.sql`
    (deviation rounding assertion, AC-083/084/079), `tests/postgrest/phase-02-slice-11-sweep*.apispec.ts`.
    The newest Codex handoff (`docs/handoffs/2026-10-09-phase2-claude-handoff.md`, top section)
    records 24 failing SQL assertions at the last full gate; they sit in the precision suite
    (`phase_02_slice_11_schedule_precision.sql`), which no entry here cites. Real-stack and race
    citations need the shared Supabase stack; `phase-02-slice-11-workflow-real-route.spec.ts`
    runs only under `playwright.s09-real.config.ts` (project `real-route-chrome`, used for the one
    Playwright citation); the default `playwright.config.ts` ignores it.

## Drift warning

Other lanes were editing cited files while this lane ran (`git status` at the end): the race runner
`supabase/tests/phase_02_slice_11_races/010-review-assignment-race.mjs` (new checks A5-A7, A2 rewritten;
cited messages A1 one-active-row, A2 sixteen-active, A3 revoked-at-version-2, A4 BLOCKS are unchanged),
`supabase/tests/phase_02_slice_11_rpc_review_assign_refusals.sql` (one assertion added),
`supabase/tests/phase_02_slice_11_helpers_preflight.sql` (version-2 row assertions reworded; the two cited
version-2 descriptions are unchanged) and `supabase/migrations/20261005017620_cms_assign_editorial_reviewer.sql`.
All 770 citations resolved against the working tree at the end of this lane. If a cited description is
renamed later, the guard reports "no receipt" for it; re-resolve that citation from the source.
