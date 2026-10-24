# Lane report (CHECKPOINT 1): DEC-194 durable recovery RED witnesses

Lane `phils_dec194_red_20261016`. Model `Phils-Charm/deepseek-v4.1-flash` / `high` (the exact selected route; no
substitution, no fallback). Active worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin` (branch
`claude/phase2-slice12`, HEAD `b16edb54`). Protected primary `/home/rob/Projects/WeJammin` never opened for write.

## Status: SQL-only expiry + atomicity RED AUTHORED and **root-run once**; corrected to a second freeze; race harness NOT started

Root ran ONE staged ALT diagnostic: `.lane-logs/alt-staged-dec194-232558-1162115.tap` SHA-256
`879b98595234e8a4f4b1a66ad83cbe676361da5b044903b1cd3acede02de7ceb` — 115 tests, 98 PASS / 17 FAIL, Wstat 0, no
SQL abort, restored link. Root found it was **not yet a meaningful expiry RED**: prerequisite assertions 87 (R's
real binding) and 96 (Q's independent eligibility) failed, so the decisive 97 (`{requested: 0}`) and 98 passed
for the WRONG reason (j6 was not actually eligible; the sweep skipped it on the 15-minute guard, not on any
durable association). This checkpoint diagnoses that and corrects the fixture chronology. I ran no runtime
myself; every hash below is the frozen on-disk bytes. Root owns the next runtime gate.

## Root receipt (actual, from the TAP)

Failed tests: 87, 91-92, 95-96, 102-104, 106-112, 114-115. The two diagnostic failures:

- **87** — R was accepted with `correlation = s12dc_corr(8)`, but j6 is a *sweep-requested* job (created via the
  derived-key lookup in `040`), so its correlation is inherited from j4 (`corr(4)`), not 8. The binding conjunct
  therefore failed.
- **96** — R was accepted *after* the last `s12dc_elapse(20)`, so R's fresh `updated_at` reset the party's
  "last job activity of the type" to now. The sweep's 15-minute guard (`updated_at > now - 15 minutes`) then
  excluded the party, so `idle_minutes >= 15` was false and 96 failed; the sweep answered `{requested: 0}` for
  the wrong reason and 97/98 passed vacuously.

## Root diagnosis applied (fixture chronology corrected, no oracle weakened)

- **R now binds to j6's OWN row.** New helper `s12dc_accept_for(tag, failed_job)` reads the failed job's real
  `actor_id`, `acting_party_id` and `correlation_id` and accepts R through the real
  `accept_job_with_outbox` with exactly that binding — the same binding the sweep's own request carries (D4).
- **R is settled BEFORE the clock shifts.** R is accepted and settled `succeeded` first, then the tail is seeded
  and `s12dc_elapse(20)` runs, so R no longer resets the activity clock. j6 is then genuinely idle 15+ minutes.
- **Per-conjunct diagnostics** replace the two combined prerequisites: `060` now has separate assertions for the
  failed head (`s12dc_failed_head`), no live job, streak = 0, idle >= 20, work = 2, and j6 failed; and R's state,
  actor, acting party and correlation each get their own assertion via `s12dc_job_col`. Any single failing
  conjunct is now visible in the local TAP by name.
- **070 drains any live recovery job** the earlier tick left queued (real BE00 claim/outcome via
  `s12dc_cancel_live`), and its fault assertions are explicitly labelled `CONDITIONAL (requires the association
  table)` — atomicity cannot be proven while the table is absent, so those assertions fail rather than pass.

## Root second-round correction applied (GREEN-viability of the expiry witness)

Root blocked the second runtime: the previous edit had removed the only production sweep call, so nothing ever
materialized the association. `s12dc_accept_for` calls `accept_job_with_outbox` DIRECTLY (a raw BE00 accept, not
the recovery producer), so the association assertions would have failed even on the fixed design. Restored and
labelled correctly:

- A REAL production sweep `x1` now runs AFTER the corrected eligibility recheck and AFTER the present expired
  completed receipt is inserted, but BEFORE the TTL cleanup. Source proof that an expired-but-present receipt
  still replays: `platform_private.accept_job_with_outbox`
  (`supabase/migrations/20260830120000_persistence_runtime_authority.sql:132-135`) selects the receipt by
  `(actor_id, operation, key_hash)` `FOR UPDATE` with NO `expires_at` filter; the `completed` branch
  (`:139-153`) returns the cached `jobRef` with `replayed := true`. So the receipt is PRESENT and expired, not
  live and unexpired — the labels say exactly that.
- `x1` asserts `{requested: 0}` and unchanged acceptance stores (jobs/outbox/audit/idempotency byte-identical),
  and asserts the association j6 -> R materializes on the REPLAY path (the approved root design writes it on a
  replay too). Those two association assertions are labelled `CONDITIONAL` because the table is absent on the WIP.
- Then the real TTL sweep deletes the receipt and `x2` must not repeat — the decisive behavioural RED.
- Full eligibility is rechecked conjunct-by-conjunct before BOTH `x1` and `x2` (head, live, streak, idle, work,
  state), so a single wrong conjunct is visible by name. No fabricated direct association INSERT anywhere.

## DONE (frozen on disk, additive to the pre-existing suite)

Two new fragments turn the DEC-194 independent-review findings into RED, plus the helpers they need. All
access to the proposed association table is dynamic and guarded, so its absence yields TAP failures, not a SQL
abort. Existing assertions and oracles are untouched (the five pre-existing fragments are byte-identical to the
lane-report hashes).

| Path | Lines | SHA-256 | Note |
| --- | --- | --- | --- |
| `supabase/tests/phase_02_slice_12_dec194_sweep/060-idempotency-expiry.sqlinc` | 165 | `a4b6b3f5eba2ca7d5df94fc9862cd386e94672cb884c71331577d188432300d7` | NEW — the expiry RED witness (35 assertions) |
| `supabase/tests/phase_02_slice_12_dec194_sweep/070-atomicity.sqlinc` | 75 | `910643d161cd3f9da89fdce14b2c4bc1ec20307279894bbb2f636b956efad5a3` | NEW — the marker-insert atomicity witness (17 assertions) |
| `supabase/tests/phase_02_slice_12_dec194_sweep/000-helpers.sqlinc` | 377 | `a7ebf7d83848cb8bab1114c79b3f22758bc386b47c90ada705afc2b2e36ffe13` | APPEND-ONLY: new `pg_temp` helpers + 2 mark tables below the original `s12dc_rcpt_body` |
| `supabase/tests/phase_02_slice_12_dec194_sweep.sql` | 39 | `4bb780bd676603ccd2e3b4fba1bc9f0152378c55748a029e8f122b9c5dfd7d12` | two `\ir` includes appended after `050-generations.sqlinc` |
| `supabase/tests/phase_02_slice_12_dec194_sweep/README.md` | 35 | `5d51ca76cfe66db791b4e729c70c2a0dd8becc3b0ca3bb599d5a9ade5f3cdf8c` | fragment rows + the two labelled forgeries |

Unchanged (byte-identical to `lane-dec194-sweep-report.md`): `010-surface` `e8071389…`, `020-no-work` `2f21444a…`,
`030-gates` `ac68402f…`, `040-request` `03fcd7bf…`, `050-generations` `c50b0bef…`.

## REMAINING (not started)

1. **Race harness** — `supabase/tests/phase_02_slice_12_dec194_sweep/090-race-fixture.sqlinc` and
   `supabase/tests/phase_02_slice_12_dec194_sweep.race.mjs`. Deferred per root: no race work in this checkpoint.
   Design already researched statically (real `pg_stat_activity`/`pg_locks` barriers, explicit release/commit, no
   `pg_sleep`, producer-first ordering, lease/capability refusals after waits).
2. ~~Party-count brittleness fix~~ **DONE this checkpoint** — `060` and `070` previously asserted the acting
   party's job count with literal `9::bigint` / `10::bigint`. That count differs between the current WIP and the
   fixed design (the WIP's RED tick in `060` adds a job), so the literals were brittle. Both now use
   `s12dc_party_mark`/`s12dc_party_same` (relative: the party's history is unchanged by the refused call).
3. **Root runtime gate** — one staged ALT diagnostic of the whole suite, then feedback of the observed failure
   identities before the race harness is authored.

## Independent findings this RED encodes (source-backed)

**Finding 1 — expiring deduplication.** The recovery sweep deduplicates a failed `cms.taxonomy.merge_converge` Job
only through the BE00 idempotency receipt. Source: `platform_private.accept_job_with_outbox`
(`supabase/migrations/20260830120000_persistence_runtime_authority.sql:99-196`) reserves it with `expires_at`
supplied by the caller (the sweep passes `now_at + interval '7 days'`, WIP
`supabase/migrations-wip/dec194/20261014190000_cms_reconcile_taxonomy_merge_converge.sql:73`). The audited TTL
sweep `platform_api.idempotency_expiry_sweep` (`supabase/migrations/20260912020000_idempotency_expiry_sweep.sql:63-148`)
deletes that receipt once `expires_at <= now`. The guard `platform_private.guard_idempotency`
(`20260912020000:8-56`) makes `expires_at` immutable and refuses direct DELETE, so a test can only seed an expired
receipt by INSERT (precedent `phase_02_slice_03_idempotency_expiry.sql:56-70`). After deletion the sweep re-derives
the same key `cms.taxonomy.merge_converge.reconcile:<failed job id>` and requests a SECOND recovery Job for work
the first already owns. `lane-dec194-sweep-report.md` open item 5 already flagged this as unspecified.

**Finding 2 — atomicity of the durable marker.** The selected design inserts the failed→recovery association
inside the acceptance transaction, after `accept_job_with_outbox` returns, on a fresh acceptance AND on a replay.
A failure at that insert must leave no accepted job, outbox event, audit row or receipt behind. Root design
(recorded in `CODEX-RESUME-2026-10-15.md` finding 5, not implemented here):
`platform_private.cms_taxonomy_merge_recoveries(failed_job_id uuid primary key references platform_private.jobs(id)
on delete cascade, recovery_job_id uuid not null, requested_at timestamptz)` — no reverse FK, no TTL, FORCE RLS,
private. This checkpoint asserts only the association half; the shared party enqueue mutex is the race harness.

## Labelled fixture forgeries (nothing else is forged)

1. The completed receipt under a failed Job's derived key, **inserted** with an already-past `expires_at`, exactly
   the way `phase_02_slice_03_idempotency_expiry.sql:56-70` seeds its expired receipt. Nothing is updated, no guard
   is disabled, no production trigger is added.
2. One BE00 outcome carrying a result payload (`s12dc_settle_result`), because the real `apply_job_outcome`
   (`20260830120000:229-269`) demands a non-null result for `succeeded`.

The recovery Job R of the history is NOT forged: it is accepted through the real
`platform_private.accept_job_with_outbox`, so its row, its `job.requested` outbox event and its `job.accepted`
audit row are real.

## Revised predicted failure identities (UNVERIFIED — for the next root run)

Assertion count after both corrections: **35 in `060` + 17 in `070` = 52 new** (suite is `no_plan`). The prior run
emitted 115 total (83 existing + 32), so the next run is predicted to emit **~135**. Root's receipt confirms the
existing 83 and the pre-existing fragments are untouched.

Predicted on the current WIP (no association table, no post-acceptance insert), assuming the corrected fixture
now makes j6 genuinely eligible (head j6, no live job, streak 0, idle >= 20, work 2):

- `060` **x1 now PASSES on both WIP and fixed design**: the present expired receipt replays (no `expires_at`
  filter in BE00), so `{requested: 0}` and the unchanged acceptance stores hold; only the two CONDITIONAL
  association assertions (table exists; j6 -> R materialized on the replay path) fail on the WIP and pass on the
  fixed design.
- `060` **x2 is the MEANINGFUL expiry RED**: after the real TTL sweep deletes the receipt, the WIP sweep
  re-derives the key, finds no receipt and requests a SECOND recovery job, so the `{requested: 0}` witness fails
  on real eligibility. The next assertion (no counted effect) fails with it. All the new per-conjunct
  prerequisites before x1 and x2 (head, live, streak, idle, work, state, and R state/actor/party/correlation) are
  predicted to PASS.
- `060` table-dependent failures (pass on the fixed design, fail on the WIP), by name: "the association table
  exists", "the association of j6 to R exists independently of the receipt", "the association still names R after
  the receipt was deleted", "no new job exists and exactly one association row exists", "j6 names only R".
- `070` table-dependent failures, by name: "the association table exists" (CONDITIONAL), "the marker-insert fault
  is installed" (CONDITIONAL), "the acceptance is refused (P0001)" (CONDITIONAL), the no-effect and byte-identical
  assertions, "no association row was committed", "the party history is unchanged", "the fault is removed and the
  table definition is restored", the restored `{requested: 1}`, and "j8 is associated with the new recovery job".
- Intentionally conditional and may pass while the table is absent: `060` "the durable association is unchanged
  by the refused repeat" (the `{requested: 0}` path is already caught by the RED WITNESS) and `070` "no fault
  constraint remains".

Net: the next run is predicted to be a genuine behavioural RED — the witness fails because the WIP truly
re-requests, not because j6 was ineligible. If the per-conjunct prerequisites still fail, the fixture chronology
is still wrong and must be re-diagnosed before any implementation. No production, WIP or migration change was
made; the fix is entirely within the two test-only fragments and their helpers.

## Constraints honoured

- `receipt.expires_at` never updated; `guard_idempotency` never disabled or replaced; expired receipt INSERTED.
- Marker fault is a transaction-local `check (false) not valid` constraint added by the test-admin and removed
  before rollback; the table's column+constraint definition is captured first and must restore byte for byte.
- No sleeps: the 15-minute bound is cleared with the existing `s12dc_elapse` timestamp shift; the deferred race
  harness will use real lock observation.
- All proposed-table access is dynamic and guarded (sentinel on absence) → TAP failures, not `undefined_table` abort.

## Explicitly NOT claimed

No acceptance, no promotion, no GREEN, no mutation proof, no canonical/hosted evidence, no depth-ratio change, no
tracker or AC edit, no `090-race-fixture.sqlinc`, no `.race.mjs`. No spec change is requested (the association
table is a private implementation detail with no public contract).

## Blocker

None. This is a bounded, self-contained authoring checkpoint that is UNRUN by design and awaits the root runtime
gate. No model or tool availability problem was encountered on the selected route.

## Requested root gate

1. Inspect the freeze. If a DDL-only staging of the proposed association table is useful, stage only the table
   (private, FORCE RLS, FK to `jobs` on delete cascade) so the contract RED is observed separately from the
   behavioural RED, as root proposed.
2. Release one staged ALT diagnostic of `supabase/tests/phase_02_slice_12_dec194_sweep.sql` (lane `dec194`) after the
   WIP `20261014190000`/`190010` pair; record the real TAP.
3. Feed back the observed identities and post-wait recheck ordering; the race harness is the next checkpoint.

This report is a self-describing manifest; its own SHA-256 is recorded by root when the checkpoint is frozen (a
self-hash cannot be stated inside the file it describes).
