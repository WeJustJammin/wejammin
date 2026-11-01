# Lane `claude_s12_race7` report (wave 7: the 14 `class: race` rows)

## Status

PARTIAL. HEAD `4f643787`. Seven new pgTAP files with a shared harness run GREEN on the ALT stack: **171 / 171 tests, 7 files, exit 0** (final run
`alt-staged-none-090552-3909549`, lane `none` = promoted migrations only; no WIP migration was needed and no product defect was found).
Ten of the fourteen rows are closed by real two-session evidence; AC-276 (x2) and AC-277 (x2) are proven for the writers listed below and keep named BOUNDARY
remainders; AC-044 "deletion" is a BOUNDARY (no 03c deletion operation exists); AC-294 is **not built** (reachable, plan below). No sub-agent was spawned; no race
module (`*.race.mjs`) was written or run; nothing in a ledger, receipt, spec, tracker, promoted migration or another lane's file was touched.

## Scope

The 14 `class: race` rows of `gaps/inventory-20261029c.json`: AC-013, AC-019, AC-044, AC-047, AC-085, AC-086, AC-145, AC-205, AC-218, AC-276 (clause 1 and 2), AC-277
(clause 0 and 2), AC-294. Method: dblink two-session pgTAP (`supabase/tests/phase_02_slice_12_race7_*.sql`). The real `platform_api` command under test is the lock holder
(an open dblink transaction) wherever it can be; the contender is sent asynchronously and observed blocked in the live lock manager (`pg_blocking_pids`, the lock type in
`pg_locks`), never by a sleep; the holder commits or aborts and the contender's exact outcome is asserted. The world is built by the real producers, committed, and removed
again by the harness (snapshot of every user table before, deletion of every added row after; the final run reports `added_where` empty and `missing_where` empty in all
seven files, so the database is left as found).

## Per-row outcome

| Criterion | Clause | Outcome | Identity (file : scenarios) |
| --- | --- | --- | --- |
| P2-S12-AC-013 | 6 "and concurrency rules." | CLOSED (8 titles) | `race7_placement.sql` P1 (two placements, one slot, positions 0,1,2 in commit order, no duplicate path) and P2 (same paths: one winner, loser `P0001:CONFLICT` at `/slotPath`, stores equal the winner's) |
| P2-S12-AC-218 | 3 "under the revision/slot lock (DEC-185)," | CLOSED (8 titles) | `race7_placement.sql` P1 (blocked BY the first on `transactionid`, the entry row = position 0), P2, P3 (holder on the entry row: later positions free), P4 (holder on the pattern row: entry row and authority rows already held, content type row not yet) |
| P2-S12-AC-019 | 7 "and concurrency rules." | CLOSED (11 titles) | `race7_taxonomy_term.sql` T1 (duplicate stable key), T3 (position 3 holder, position 1 held, position 6 free), T4, T5 (activation of the successor vs a term write) |
| P2-S12-AC-047 | 1 "concurrency" | CLOSED (5 titles) | `race7_taxonomy_term.sql` T1 (one winner, loser typed `CONFLICT`, no duplicate term/label/audit/outbox/idempotency row) and T2 (two deprecations of one term) |
| P2-S12-AC-085 | 1 "runs in one transaction that takes its locks in the Slice 12 lock order" | CLOSED (10 titles) | `race7_activation.sql` S2 (blocked at the review row, position 5: positions 1, 3, 4 held, advisory lock not held) and S3 (blocked at the advisory lock: positions 1, 3, 4, 5 all held) |
| P2-S12-AC-086 | 1 "`activation_conflict`" | CLOSED (6 titles) | `race7_activation.sql` S1 (two approved versions of a lineage with no active one race; loser waits on the lineage ADVISORY lock, answers `P0001:activation_conflict`, lineage keeps one active version) |
| P2-S12-AC-205 | 1 "an activation that loses a race ... is 409 `activation_conflict` and nothing commits." | CLOSED (5 titles) | `race7_activation.sql` S1 (loser's subject, review, decisions byte-identical; audit/outbox/idempotency stores equal the winner's; the same Idempotency-Key then succeeds and supersedes) |
| P2-S12-AC-145 | 1 "claims under `FOR UPDATE SKIP LOCKED`" | CLOSED (8 titles) | `race7_claim.sql` C1 (a claim returns without waiting for another claim's open row lock and without that schedule; leases distinct) and C2 (holder on the only due row: empty claim at once, row untouched) |
| P2-S12-AC-276 | 1 "re-prove their capability under the locks," | PARTIAL (18 titles) | revocation first wins (`capability_missing`, nothing written) and a later revocation waits then commits, for CMS-03C-09 (activation S4), CMS-03C-02 (placement P5), CMS-03C-03 (term T6); lock-position observation in S2/S3/P3/P4/T3/T4 |
| P2-S12-AC-276 | 2 "map `deadlock_detected` and a lock-acquisition failure to the 409 code ..." | PARTIAL (21 titles) | SQL layer: lock_timeout is `P0001:CONFLICT`, nothing committed, same Idempotency-Key succeeds afterwards (CMS-03C-09 S2, CMS-03C-02 P3, CMS-03C-03 T3); a REAL `deadlock_detected` is the same CONFLICT for CMS-03C-09 (S5) |
| P2-S12-AC-277 | 0 template activation vs block withdrawal; linked pattern update vs local override | PARTIAL (5 titles) | `race7_template_block.sql`: signed CMS-03A-08 deprecate + withdraw commit while the activation waits; the activation answers the committed `dependency_changed` refusal, review `invalidated:3`, subject `draft`, no event. Linked update vs local override: BOUNDARY (below) |
| P2-S12-AC-277 | 2 locale source edit vs translation, related target unpublish, duplicate/out-of-order events, worker lease expiry, restore-epoch fencing | PARTIAL (10 titles) | `race7_lease.sql`: worker lease expiry (an expired-lease executor still in flight is skipped by the sweep and then completes; a replaced lease is refused `P0001:CONFLICT`, nothing changed). The other four items: BOUNDARY (below) |
| P2-S12-AC-044 | 3 "deletion" | BOUNDARY | BE03c defines no deletion/tombstone operation (below); nothing invented |
| P2-S12-AC-294 | 1 authority/visibility and exact schema/default rechecked after waits | NOT BUILT | plan below; the existing `entry_default_template_lock/020-race.mjs` assertions are unchanged |

Proposals (per row, `recite2` schema, 12 criteria / 14 clause entries) are in `docs/handoffs/2026-10-22-claude-s12/recite7/race7-proposals.json`; every `add` is a
`pgtap` citation by the exact assertion description with its line; the infrastructure assertions (harness ran, world built, fixture, cleanup) are deliberately not cited.

## Files (new files only; path, lines, SHA-256)

| Path | Lines | SHA-256 |
| --- | --- | --- |
| `supabase/tests/phase_02_slice_12_race7/000-harness.sqlinc` | 260 | `6108d35d79901da9c8e478bb715bc05c1655e5c28f95175e7650d29dca649410` |
| `supabase/tests/phase_02_slice_12_race7/005-snapshot.sqlinc` | 196 | `8ac97b6a34cf4e0be2c3e65d17f0fd007a5f18433f4ebe9423d561bd3f3193f5` |
| `supabase/tests/phase_02_slice_12_race7/010-governed-world.sqlinc` | 37 | `f1b372a94ffa5ca259a794f972717e068e27a128b2acb87e64fa9c5a08939233` |
| `supabase/tests/phase_02_slice_12_race7/020-sys.sqlinc` | 5 | `754a1524d1d9d1b02ecb1cae683533e67170663c7cbeb2a75e68edafabad98cc` |
| `supabase/tests/phase_02_slice_12_race7/090-restore.sqlinc` | 11 | `07db4f852aa75e298d1e945a799b52ba53151cb66d0945e34c53b98763a6569d` |
| `supabase/tests/phase_02_slice_12_race7/README.md` | 44 | `764bebada8a571c475ac47f6545c70e93963e63a2032fbf9f968113f47e66919` |
| `supabase/tests/phase_02_slice_12_race7_harness.sql` (17 tests) | 95 | `1e6c9533e05855cfebc577b04f754b2caea60bd40e81cbd0d0c428c9a7266cfe` |
| `supabase/tests/phase_02_slice_12_race7_activation.sql` (44) | 277 | `6d593adf920c755c318d4cb109b2a9754a92b5ecec06899d72a3e904b434b061` |
| `supabase/tests/phase_02_slice_12_race7_claim.sql` (14) | 112 | `793b108a2a42d793d4cb8aa236ebb60ed6d090126710482c63eec44dd5b482d7` |
| `supabase/tests/phase_02_slice_12_race7_placement.sql` (33) | 248 | `189c1ec7d6b2958846213a0c7e73e3b73556784c5ebf66007ab78d153e21b867` |
| `supabase/tests/phase_02_slice_12_race7_taxonomy_term.sql` (37) | 273 | `0d67f031963db950acd2d88023f6c058aa645b12378198bfb585d50ece184a0a` |
| `supabase/tests/phase_02_slice_12_race7_template_block.sql` (10) | 111 | `725bd41c7c6806759fd19e6b9326877d9b677dbb69c65cafe2d5c984433fbecd` |
| `supabase/tests/phase_02_slice_12_race7_lease.sql` (16) | 147 | `8649c1a20151f3cb36beed5f532467393b0510d82fa6ebe6b5b7146217b30ede` |
| `docs/handoffs/2026-10-22-claude-s12/recite7/race7-proposals.json` | 1346 | `3cb93331014c6f15509e8a1b532ea18ca6fdda3889fcb44eeb99ab5961d2f71b` |
| `docs/handoffs/2026-10-22-claude-s12/recite7/race7-final-run.tap` (copy of the final TAP) | 208 | `7ced07bdeb039901aabd085708096521bf5aa735f71da01206099031ca0ca037` |
| `docs/handoffs/2026-10-22-claude-s12/recite7/race7-final-run.manifest` (staged migrations of the final run) | - | - |
| `docs/handoffs/2026-10-22-claude-s12/lane-race7-report.md` | this file | (see the final message) |

No existing file was edited, so there is no `orig-*.tar`. `supabase/migrations-wip/race7/` was not created.

## Runs

All through the staged ALT runner, lane `none`, never wrapped in `timeout`. Earlier runs were harness / world RED-to-GREEN iterations (classified below); only the last counts as evidence.

| Stamp | Files | Result | Classification |
| --- | --- | --- | --- |
| 082815 | harness, activation | harness: `pg_temp.s12ga_ctx` missing in the small world; activation: `You tried to plan twice` | harness (pgTAP allows one plan per session; TAP now emitted by `r7_is`/`r7_ok`/`r7_finish`) |
| 082941 | harness, activation | harness 16/17 not ok (`schema_migrations` unreadable; notes lost on a handler rollback) | harness (scope limited to readable tables; notes moved to a remote temp table over dblink) |
| 083123 | harness, activation | activation 42/44, the cleanup failed `55006` (pending trigger events) | harness (restore split into three transactions, `090-restore.sqlinc`) |
| 083309 | harness, activation, claim | activation 42/44 (same cleanup), claim aborted by the leftover world | harness |
| 083513 | harness, activation, claim, placement | harness 17, activation 44, claim 14 green; placement aborted at the restore | harness (cyclic foreign keys) |
| 083905 | placement, taxonomy | placement: command `INVALID_REQUEST` | my request: the Idempotency-Key was 7 characters (the bound is 8); fixed |
| 084149 / 084405 | placement, taxonomy | placement 26/27, cleanup blocked by the entry <-> current-draft-revision foreign key cycle | harness (every foreign key of the scope is deferred for the removal and restored exactly) |
| 084514 | placement, taxonomy, template_block | placement 27, template_block 10, taxonomy 29/30 | taxonomy T5 expectation was mine and wrong (see Spec notes) |
| 084843 | lease, taxonomy | 47 green (lease 16, taxonomy 31) | - |
| 085641 | all seven | 171 / 171 green | - (before the harness was split into `000` + `005` for the file-size rule) |
| **090552** | **all seven** | **171 / 171 ok, exit 0, 471 s** | **FINAL on the bytes listed above** - TAP `.lane-logs/alt-staged-none-090552-3909549.tap`, SHA-256 `7ced07bdeb039901aabd085708096521bf5aa735f71da01206099031ca0ca037` (copy in `recite7/race7-final-run.tap`); manifest SHA-256 `6df2ee163314fe44a9404fe79bc27fb8a675801c671cebd49eb1a10b638d7d86`; per-file plans harness 17, activation 44, claim 14, placement 33, taxonomy_term 37, template_block 10, lease 16 |

Negative controls inside the final run: every probe is shown in both polarities (`55P03` for a held position and `00000` for a position not yet taken, e.g. S2 vs S3 for the
advisory lock, P3 vs P4 for positions 1/3/4, T3 vs T4), the uncontended claim and the first activator succeed, and the wrong T5 expectation of an earlier run failed as it
should (the assertions are sensitive).

## Test corrections

None: no existing oracle was touched. (One expectation of this lane's own new test, T5, was corrected after reading the spec - see below.)

## Spec citations

BE03c "Slice 12 lock order (DEC-157, DEC-180)" 1500-1530 (writer rows CMS-03C-02, -03, -09/-19, the claim row; rules 1 lock before write / capability re-proved, 2 pinned
definitions, 3 revocation versus activation, 4 typed deadlock); governed activation steps 1490 (activation_conflict 1494 "an activation that loses a race on the lineage is
409 `activation_conflict` and nothing commits", step (4) recheck, DEC-227); scheduled activation 1475 (claim `FOR UPDATE SKIP LOCKED`, five-minute lease, 15/60/300 s ladder);
pattern placement 1519 (`cms_insert_pattern_instance`, "computed under the revision/slot lock", DEC-185) and the migration header 20261014110300; term actions 165/1696,
`taxonomy_not_active` 389; tests 1816-1820. BE03b "Write-path lock order" 1729-1755 (positions 0-6). IA03 line 533 (generic deletion row). Decisions DEC-157, DEC-176,
DEC-180, DEC-185, DEC-190, DEC-202, DEC-224, DEC-226, DEC-227.

Spec notes (no defect, no RED test):

- **T5 (taxonomy):** a term write that waited on the vocabulary's active row while its successor was being activated is refused `P0001:taxonomy_not_active`, not `CONFLICT`.
  Reading: rule 2 of the Slice 12 lock order (a writer that waited on a bound definition row and finds it superseded is refused with the typed refusal) and BE03c 389
  (`taxonomy_not_active`) fit, so the test asserts it; a stale operand that ARRIVES after the activation is the typed `CONFLICT`. The wording is not obviously
  intended (the vocabulary is active, at version 2, when the refusal is sent): root may want the spec to say which of the two a post-wait supersession answers.
- **AC-205 / AC-086:** the test uses a lineage with NO active version (two approved versions, neither active), the state in which neither activator holds a lineage active row, so
  the loser reaches the advisory lock (the last position) and re-reads the active version there. Whether a lineage that already has an active row can also end in
  `activation_conflict` was not exercised.

## Open items / BOUNDARY

1. **AC-044 "deletion"** - BE03c has no deletion or tombstone operation for a pattern lineage, composition source or entry (a pattern version has only `retire`, DEC-190, an entry
   only the 03b archive); IA03 line 533 states the row generically for every CMS-nn operation. Needed: an owner ruling whether the CMS-12 deletion row means retire/archive of the
   pinned source; then pgTAP: composition rows and pattern version retained, placement refused `pattern_version_not_active`, one idempotent governed-review recheck queued.
   (The concurrency half of AC-044 - two competing writers on the placement entry - is shown by the placement P1/P2 titles; root may cite them under that clause.)
2. **AC-277 "linked pattern update versus local override"** - BE03c names no command that edits a local override other than CMS-03C-02 placement and the CMS-03C-15 resolution
   itself, so the two commands of the race are not identified. Needed: the owner names the override writer; then a race module on the dec193 world (neighbour:
   `phase_02_slice_12_dec193_writer.race.mjs`, accept versus target activation). Shared serialization is shown (the entry row is position 0 of both CMS-03C-02 and CMS-03C-15; P1/P2).
3. **AC-277 locale source edit vs translation, related target unpublish** - each needs a committed Slice 11 world (the 03b revision-append / unpublish commands beside CMS-03C-04 /
   CMS-03C-05) that no 03c fixture builds; **duplicate and out-of-order events** - BE03c states no 03c consumer-ordering rule beyond the idempotent recheck job (governed_recheck
   suites cover its single-session forms); **restore-epoch fencing** - the platform restore fence (migrations 20260830130000, 20260830135000) is outside 03c and BE03c states no
   03c-specific fence (neighbour: `restore_relation_visibility/020-race.mjs`).
4. **AC-276** - proven by two-session tests for CMS-03C-09, CMS-03C-02 and CMS-03C-03 only. Not shown: CMS-03C-01/-04/-05/-06/-07/-08/-12/-15/-16/-19, the linked-update scan, the
   recheck job, the term merge and the revision-append carry-over (their own suites cover the single-writer forms); the Worker mapping of `CONFLICT` to each operation's
   `*_VERSION_CONFLICT` code (an `apps/worker` test, outside this SQL lane); the conversion evidence for the scan and the merge continuation. Clause 0 (the lock-order tile) is not a race row.
5. **AC-294 NOT BUILT (reachable).** The world is a committed pgTAP fragment (`phase_02_slice_12_entry_default_template_lock/000-world.sqlinc`: three producer-built types, an
   active default T1, a relation field, an article target, the exact create request `s12edtl_request`). Plan with this harness: (a) hold the target entry row FOR UPDATE, archive the
   target through the real command, release, assert the create is the uniform `VALIDATION_FAILED` at `/fields/{id}`; (b) hold the template row, activate a successor schema through the
   real chain steps stashed from the world, release, assert the create is refused at `/contentTypeVersionId` and stores no unlocked replacement pin; (c) a create naming a concealed foreign
   target returns at once while a holder owns that foreign entry row (no lock lever) and probes show position 2 is never taken after position 3. It needs the 30-step schema chain plus a
   mid-scenario activation and an entry archive; not attempted in this run.

## Defects

None found in product code; every behaviour under test conformed to the spec. No RED test is open, no WIP migration is proposed.

## Requests to root

1. **Runtime in the canonical gate.** `race7_claim.sql` waits about 70 s and `race7_lease.sql` about 6.5 minutes for real schedules and five-minute leases (no clock is forged, as in
   `governed_schedule_ladder.sql`); the seven files together took 471 s. They are plain pgTAP files, so `pnpm db:test` picks them up. If that is too slow for the gate, run the two
   slow files separately (as the ladder suite is) - they are self-contained.
2. **Self-restoring committed worlds.** Each file commits a real world and removes it again (verified by the file's own assertions `added_after_restore = 0` and
   `missing_after_restore = 0`). A file that dies in the middle (a psql abort) leaves the world behind and the next file fails with duplicate keys; a DB reset clears it.
3. Race modules root must run: **none new** (this lane wrote no `*.race.mjs`). The existing modules are unaffected.
4. Review/apply the proposals file; the refutation population should check in particular the two partial rows (AC-276, AC-277) and the BOUNDARY gaps.
5. Decide the T5 wording question (post-wait supersession of the active vocabulary version: `taxonomy_not_active` vs `CONFLICT`), the AC-044 deletion meaning, and who the
   "local override" writer is (AC-277); each blocks one remaining sub-clause.
