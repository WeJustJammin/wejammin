# Lane codex-preparation-lease-red report — 2026-10-13 (rev 3)

Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, branch `claude/phase2-slice12`,
HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e`. Lane: QA-RED for the DEC-184 preparation
exhaustion over an expired `verifying` lease. No production, simulator, spec, config, migration,
tracker, staging or commit changes. No forward migration created.

## Authority distinction (unchanged)

- **Current locked exception (BE03a:2488-2491).** "a `verifying` plan cannot be re-leased"; a plan
  that cannot be rolled back "is left as it was: the Job is `failed` all the same and the
  `migration retry >3` and DLQ alerts are the operator signal." The current `unavailable` result is
  therefore an **allowed exception, not an unconditional violation.**
- **Proposed improvement (DEC-184:2659 / b08 §5).** The private fresh-CAS-lease extension. **Pending
  owner approval**; the new tests are **proposed fix witnesses, not approved acceptance proof.**

## Files changed (exclusive ownership)

- `apps/worker/src/content-schema-registry/claimed-schema-migration-preparation-exhaustion.test.ts`
- `supabase/tests/phase_02_slice_12_preparation_exhaustion.sql`
- `supabase/tests/phase_02_slice_12_preparation_exhaustion/{010-fixtures,020-recovery,030-security}.sqlinc`
- `supabase/tests/phase_02_slice_12_preparation_exhaustion/README.md`
- `docs/handoffs/2026-10-12-claude-s12/lane-logs/s12-exhaustion-unit-red.log`

Line counts (<=300 cap): 010=209, 020=210, 030=105.

## Corrections applied in rev 4 (final precision, per root review)

1. `s12_plan_preserved` no longer strips `created_at` (only `version`/`updated_at` and the
   report's lease object), so a lease renewal that changed the creation timestamp would fail.
2. `s12_row_evidence` now hashes the WHOLE `to_jsonb(evidence)` row (id, report_id,
   source_table, source_row_id, source_hash, output_hash, error_code, recorded_at) in a
   deterministic order, so a replacement or a timestamp-only mutation is caught.
3. The positive-row deleteRows=false witness now hashes the FULL source revision rows
   (`s12_source_rows`: every column, ordered by id) in addition to the explicit two-row count
   control, so a delete-plus-replace that keeps the count is caught.

## Unit RED (executed)

`20 tests, 1 failed | 19 passed`; line 170 `expect(await f.exhaust()).toBe('rolled_back')` received
`'unavailable'`. Log: `lane-logs/s12-exhaustion-unit-red.log`.

## Corrections applied in rev 3 (per root review)

1. **Column-scope defect fixed.** The zero-row block's fingerprint assertions no longer read
   `held_version/content` from the wrong temp table. `s12_ex`/`s12_px` carry `held_version`,
   `held_token`, `preserved` (plan), `report` (report row) and `source_rows`; assertions reference
   them with explicit scalar subqueries.
2. **No-effects oracle is now whole-row, not stripped.** `s12_effects` uses `s12_plan_row` (the
   **whole** plan row incl. version, timestamps and the lease object) and `s12_report_row` (the
   **whole** report row), plus `s12_row_evidence` (deterministic md5 of every row-evidence row's
   fields) and the full content of `audit_events`, `outbox_events`, `idempotency_records` (single
   transaction, so deterministic). The stripped helper is kept separately as `s12_plan_preserved`
   and is used ONLY to prove that a re-lease changes nothing but the lease metadata and CAS version.
   A token/owner/expiry-only or version-only mutation is now caught.
3. **Corrected hash source.** The plan table has **no** `source_hash/target_hash/compiler_hash`
   columns; those live on `cms_schema_dry_run_reports` and are echoed in the claim response. The
   assertions now compare the claim response hashes against the sealed report row's
   `source_hash/target_hash/compiler_hash`.
4. **Positive case matches the zero-row proof.** `s12_px` now captures plan-preserved, report row,
   source-row count, held version/token. The positive block asserts: fresh token != old; version+1;
   exact cursor and every derived count (source/target/migrated/row-error); all three fingerprints;
   full plan and full report preservation; old-token refusal; old active preserved; **source rows not
   deleted** (`deleteRows` false); and the original terminal plan retained as a distinct row while the
   new attempt supersedes it.
5. **Field-name / reason-code / reference static review.** Claim refusal for a live owner returns
   `LEASE_UNAVAILABLE` (the live-lease check precedes the state gate in
   `cms_claim_schema_migration_lease`); the rollback path is a typed raise (`LEASE_EXPIRED`,
   `CONFLICT`, `VALIDATION_FAILED`, `INVALID_REQUEST`). Plan JSON field names
   (`sourceCount/targetCount/migratedCount/rowErrorCount/sourceHash/targetHash/compilerHash/cursor/
   version/state`) were checked against `cms_worker_plan_json` (20261002127000 supersedes
   20260902080000). Temp tables/helpers are all defined before use.

## Producer chain / control expectations

- Zero-row: `CMS-03A-10 -> claim -> dry-run batch -> finalize -> run claim -> batch -> begin`.
- Positive-row: same, with CMS-03B-10 entries and DEC-108 worker evidence pages
  (`phase_02_slice_09_dec108/04-worker.sqlinc`) and DEC-119 grant helpers
  (`phase_02_slice_09_dec119/00-support.sqlinc`); the entrypoint includes both.
- Controls assert each plan is genuinely `verifying` (or `running`), the sealed report is present
  with hashes, and the stored lease really expired on server time before recovery.

## Proposed RED assertions

**020 (DEC-184 witness; expected RED now):** expired verifying re-lease -> acquired, stays
`verifying`, fresh token, full plan+report preserved, version+1, cursor/counts/fingerprints preserved;
lapsed token `LEASE_EXPIRED`; terminal rollback -> `failed_terminal`, old active preserved, no source
rows deleted; new CMS-03A-10 admitted; original plan retained. Repeated for the positive-row plan.
Current behaviour: the first re-lease fails (`MIGRATION_STATE_UNAVAILABLE`), so the rest cannot run.

**030 (fence + no-effects):** live owner's **VERIFYING** (positive rows) lease not taken with forged
`now=+1 day` -> `LEASE_UNAVAILABLE`, whole-row no-effects; stale CAS -> `CONFLICT`; wrong
`sourceHash` -> `VALIDATION_FAILED`; stale rollback token -> `LEASE_EXPIRED`; wrong
`fallbackVersionId` -> `CONFLICT` — each with the whole-row snapshot unchanged; **BASELINE
(separate)** live owner's **RUNNING** lease with forged `now` -> `LEASE_UNAVAILABLE`, unchanged.

## Remaining limits (accurate)

- SQL RED is **not yet executed**: the canonical S11 `db:verify` session holds
  `/tmp/wejammin-quiet.lock` and `/tmp/wejammin-supabase-ci.lock`. No DB run queued.
- The full-content audit/outbox/idempotency hash assumes a single-transaction suite (no writer
  between snapshot and assertion); that is the case here.
- `[P2-S12-AC-050]` markers are witness labels only; a marker is not proof.
- Green/implementation/spec correction awaits owner approval and root's authority reconciliation.

## Rev 6 — scoped QA correction (locked fallback preserved; extension separated)

Authorized scoped changes (no production/contract/spec edits):

1. **Preserved the unapproved proposal verbatim** at
   `docs/handoffs/2026-10-12-claude-s12/proposals/expired-verifying-recovery.test.ts.txt`
   (labelled UNAPPROVED PROPOSAL, citing locked BE03a 2484-2491). Removed only that case from the
   active exhaustion suite; its header now cites the fallback and "a `verifying` plan cannot be
   re-leased". Exhaustion suite: 299 lines, 12 `it` cases.
2. **New fallback suite** `apps/worker/src/content-schema-registry/claimed-schema-migration-preparation-fallback.test.ts`
   (129 lines) against the real worker + existing `createPlanSimulator`, with 3 cases: (a) an expired
   `verifying` plan returns `unavailable`, no `claimLease` is issued, and the terminal rollback IS
   attempted with the stored lapsed token and refused (whole plan snapshot unchanged); (b) a LIVE
   `verifying` lease (clock not advanced) with a lost checkpoint reaches the checkpoint (counter > 0)
   and issues only `readPlan` (no rollback, plan unchanged); (c) the positive `current`-checkpoint case
   reaches `rolled_back` (`readPlan`, `rollback`), proving the fence is not vacuous. It does NOT assert
   the Job is failed or that an alert fires (no actual Job handler is exercised) and does not mock a
   claim success.
3. **SQL entry renamed** `supabase/tests/phase_02_slice_12_preparation_exhaustion.sql` ->
   `supabase/tests/phase_02_slice_12_preparation_exhaustion.proposal.sqlinc` (labelled UNAPPROVED
   DIAGNOSTIC; 44 assertions / 21 failures incl. 4 oracle defects; not auto-collected as a required DB
   test). Relative `\ir` includes/support unchanged. No recoverable test work deleted.

### Focused unit run (rev 6)

**Superseded (historical) log.** An earlier rev-6 focused log `lane-logs/s12-unit-focused.log`
(header 2026-10-13T09:28:46Z) is retained unchanged for history; its actual SHA256 is
`8d85b068e41f948d972c62cae710ea00182ff468fa9fafb03e7f9aa8c232b287`. The value previously quoted
here was a transient pre-write read and is corrected.

**Fence correction.** The prior fallback second case used an EXPIRED verifying lease with a lost
checkpoint, which did not prove the fence (the expired-lease guard alone explained the missing
rollback). It now uses a LIVE verifying lease (clock not advanced), asserts the checkpoint was
actually reached (counter), and adds a positive `current`-checkpoint case proving the path reaches
the rollback. The first expired case now asserts the accurate behaviour: no `claimLease`, and the
terminal rollback IS attempted with the stored (lapsed) token and refused by the RPC.

### Final focused unit run (rev 6, fresh immutable log)

Command (native exec, login:false, shell:bash, pinned PATH, shared quiet lock):
`pnpm exec vitest run <exhaustion> <fallback>` then `prettier --check` on both files.

Version proof: node v22.23.1, pnpm 11.24.0. Terminal rc: vitest 0, prettier 0.
Result: 2 files, **22 tests passed** (fallback 3 cases; exhaustion 12 cases plus the `it.each` block).

Title correction: the expired-verifying case title is now "reports an expired verifying plan
unavailable: no fresh claim, refused rollback leaves the plan unchanged" (matching its assertions).

Final closed logs (each unique, none overwritten):
- `lane-logs/s12-unit-focused-final.log`, SHA256 `8e6ecdc600e1d5392dadd61569bf0cf147a09a832469904420e45ef9d324072c`
- `lane-logs/s12-unit-focused-final-20261013T093505Z.log`, SHA256 `1a9f007a2e09b489c4d76d4cd3082948bd18978dbe711762d2601fb7438303c2`

No SQL/reset/full-validation run. `[P2-S12-AC-050]` is a witness label only.


## Authorized SQL RED run (rev 5) — 2026-10-13T09:16Z

Command (native exec, login:false, shell:bash, pinned PATH):
`bash docs/handoffs/2026-10-10-claude-s11/lanes/lane-db-alt.sh <S12 checkout> supabase/tests/phase_02_slice_12_preparation_exhaustion.sql`

Version proof (in the lane log): node v22.23.1, pnpm 11.24.0 (pinned bin). Runner owned
quiet/altdb/reset locks (no bypass). Reset OK. Terminal rc = 1.

Logs (SHA256):
- `lane-logs/s12-exhaustion-sql-red.log` = `6f93dae1542d55873ec962e8b3505a20365e61ac1074a70489e044f3e605b349`
- `.lane-logs/alt-tap-051615-942536.tap` = `28d25eaa34e66953b8e766e61f70448f546e553b4f1412bb9794ae64d6a95c7e`
- `lane-logs/s12-exhaustion-unit-red.log` = `1ddf925c9f501c0aa14d6ed1fb7a589ca039f95bb45cc8ffddfe2d53d02e1ffa`

Result: 44 assertions, 21 failed, 0 setup/parse errors (no `psql: ERROR:`, no missing relation).
No fixture/setup abort — the whole suite ran.

### Classification

**Proposal RED (17) — the locked-authority refusal of the unapproved extension, and its cascade:**
- 5 (expired verifying re-lease acquired): NULL — the claim refused. NOT a defect: locked BE03a 2488
  explicitly prohibits re-leasing a `verifying` plan; the proposal would extend it. Core witness.
- 8, 9 (response version/hash/cursor + fresh token): depend on the refused claim response.
- 11, 12, 14, 15 (terminal rollback, durable failed_terminal, new CMS-03A-10 admitted, original
  retained): cascade — the plan never leaves `verifying`.
- 19, 22, 23, 25, 29, 30 (positive-row cascade of the same defect).
- 24 (positive old-token rollback): CONFLICT instead of LEASE_EXPIRED — cascade of 19.
- 32 (live VERIFYING forged-clock no-takeover): NULL — depends on the verifying claim's
  `acquired`; the same locked refusal. **Control 33 PASSED**: the refused takeover left the whole
  plan/report/audit/outbox/idempotency content unchanged.
- 43, 44 (RUNNING forged-clock): the live `running` claim **succeeded** (`acquired:true`) because the
  claim request defines the required `now` = +1 day > the live expiry and the private grant is revoked
  from service_role. This is a **trusted-private-RPC caller-clock characterization pending authority
  review**, NOT an external/security acceptance defect: the actual worker server-owned clock flow must
  still be checked.

  Boundary citations (root): the latest private claim
  `20261002149000_cms_schema_migration_plan_source_count.sql` **parses `now`** (302), **compares it to
  the stored lease expiry** (323) and **assigns the new lease from that `now`** (343); the private
  execute is **revoked from `service_role`** (377). The production caller
  `migration-worker-lease.ts:33-40` builds the request with `runtime.now()`, and
  `migration-worker-results.ts:112-132` serializes `now: new Date(nowMs).toISOString()`. Forging the
  private helper's request therefore does **not** alone prove public-caller control; the real worker
  server-owned clock flow must still be checked. Characterization retained; **no accepted clock-security
  claim** is made.

**Run classification correction (root):** of the 21 failures, NOT all are intended RED. The 17
proposal failures are the locked-authority refusal of the unapproved extension (not a defect);
43/44 are the trusted-clock characterization (not an external defect); the 4 fixture/oracle defects
(3, 17, 36, 38) are this harness.

**Fixture/oracle defects (4) — my harness, not the proposal:**
- 3, 17 (sealed-report control): the sealed-report predicate (`sealed_at` set, `result='pass'`,
  hashes present) did not hold on the persisted row; needs root diagnosis of the actual sealed
  report shape. Does not affect the core witness.
- 36 (wrong `sourceHash`): refused `CONFLICT` not `VALIDATION_FAILED` — in this state the
  version/cursor CAS fires before fingerprint validation.
- 38 (stale rollback token): refused `CONFLICT` not `LEASE_EXPIRED` — the rollback's version CAS
  fires before the lease check.

### Passing control limits (honest)

The whole-row no-effects oracle (`s12_effects`) was validated: controls 33, 35, 37, 39, 41 passed
(every refusal that was actually issued left the full plan/report/row-evidence/audit/outbox/
idempotency content unchanged), plus 6/7/20/21 (plan+report preservation), 13/26 (old active),
27/28 (source rows by count and content), 34/40 (stale version / wrong fallback CONFLICT). The
oracle was NOT exercised for the core recovery scenario, because the re-lease itself is refused —
so the recovery no-effect proof remains unproven (the proposal RED). `[P2-S12-AC-050]` is a witness
label only.

No runtime/spec/migration/GREEN edits. Stopped for root review.
