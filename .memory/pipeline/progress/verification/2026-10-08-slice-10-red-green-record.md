# Slice 10 RED to GREEN record (P2-S10-AC-059)

Date: 2026-10-08. Criterion: "Execute Contract → QA-RED → data, API, SSR and island implementation → QA-GREEN → refactor; retain failing-test evidence and run canonical validation."

This file retains the failing-test evidence of Slice 10: for each work package, the contract that was written first, the failing test (RED) with the failure that was observed, the fix and the passing result (GREEN), and any refactor. It is guarded by `tests/contracts/phase-02-slice-10-process-record.test.ts`.

## Sources and limits

- Compiled ONLY from the lane reports `lane-ea-report.md`, `lane-eb-report.md`, `lane-ec-report.md`, `lane-h-report.md`, `lane-l-report.md`, `lane-n-report.md`, `lane-p-report.md` and `lane-q-report.md` (orchestration `lanes/` directory, outside the repository; this record is the retained copy). No entry was added from memory, from commit history or from a re-run.
- Lanes with no report file in that directory (A to G, I to K, M) appear here only where a present report cites their work (for example lane G's parked RED file in H01). Their own RED/GREEN evidence is not in this record.
- The order of work (contract, RED, GREEN, refactor) is what each lane reported. No test can prove the chronology. What the guard proves is that every record entry is complete and that every RED identity named here still exists in the repository.
- Identity convention: `RED: <file> :: <identity>` names a test title that is a whole string literal in that file (pgTAP description, Vitest title or Playwright title). `RED (fragment)` is used for race-runner assertions whose title is built from a template (`${op}/${path}`): the identity is the fixed part of the title.
- Where a lane report gave TAP positions (`not ok 4-8`) instead of titles, the identity is the assertion in the current file that carries the behaviour the report describes; the lane's own wording stays in the observed text. Where an assertion was later renamed (H11, H19) the current title is named and the earlier wording is quoted in the observed text.
- Per-package counts (for example "47/47") are the lane's own reported result at the time.

## Data layer (lane H: migrations and pgTAP, race runners)

Source report: lane-h-report.md. Every RED was observed before the fix, in the lane's private mirror or the integration checkout, and every DB run started from a runner reset.

### H01: Protected rich_text.v1 validator descriptor frozen into compiled artifacts
- Layer: data
- Source: lane-h-report.md (Item 7, DEC-146 / AC085)
- Contract first: lane G's parked RED file adopted as `supabase/tests/phase_02_slice_10_protected_validator_freeze.sql`; descriptor body and JCS SHA-256 4fe960667baa6d616e9fe00527d3e1a1d5740013b37f548eec74e20a244f2d15 from DEC-146; spec `.memory/wiki/specs/be/03b-editorial-workflow-publication.md`
- RED: `supabase/tests/phase_02_slice_10_protected_validator_freeze.sql` :: `the registry resolves rich_text.v1 version 1 to its artifact reference and descriptor hash [DEC-146]` => the file aborted at its first assertion: `function platform_private.cms_protected_validator_descriptor(unknown, integer) does not exist`; an intermediate RED with IMMUTABLE functions failed `not ok 33,34,35` (registry drift undetected in the same session)
- GREEN: migrations 20261005012000 (registry), 012300 and 012400 (create/append/resolve/restore call `cms_validators_frozen_current`); the freeze file passed 40/40; the descriptor functions were made STABLE, not IMMUTABLE, after the intermediate RED
- Refactor: none reported (a harness repair renamed the drift-probe tags `d001`/`d002` so they stopped reusing idempotency keys)

### H02: Writes serialize with schema activation and a committed authority revocation wins
- Layer: data
- Source: lane-h-report.md (Items 1 + 2, H1/H2)
- Contract first: spec `.memory/wiki/specs/be/03b-editorial-workflow-publication.md` (entry and revision writes serialize with schema activation; IA03 authority fence); race kit `infra/database-races/race-kit.mjs` written with the runners
- RED (fragment): `supabase/tests/phase_02_slice_10_races/011-authority-revocation.mjs` :: `a revocation of the writer's authority is blocked behind a writer held after its authority check` => against the tree before the fix: `S1 create/grant: a revocation of the writer's authority is blocked behind a writer held after its authority check` failed (the revocation committed while the writer was held and the writer then committed on authority already gone); runner 010 failed `S1 create: the activation switch's lock on the version row is blocked behind a writer held between validation and its first revision insert` (that round-1 wording was later replaced when 010 was rewritten over the real RPCs, see H14)
- GREEN: migrations 20261005012100 (lock helpers), 012300 and 012400; runner 010 (27 ok) and 011 (66 ok) exit 0; pgTAP `phase_02_slice_10_write_path_locks.sql` 27 assertions
- Refactor: none reported

### H03: Relation target check-then-use race
- Layer: data
- Source: lane-h-report.md (Item 3, H3)
- Contract first: spec `.memory/wiki/specs/be/03b-editorial-workflow-publication.md` (relation-target share locks); runner `supabase/tests/phase_02_slice_10_races/012-relation-target-race.mjs` written first
- RED (fragment): `supabase/tests/phase_02_slice_10_races/012-relation-target-race.mjs` :: `a change of the relation target is blocked behind a writer held after its relation check` => RED `S1 create/bump: a change of the relation target is blocked behind a writer held after its relation check`, and with only the resolver fixed `S1 carried append/bump ...`
- GREEN: migrations 20261005012100 (`cms_lock_entry_rows_shared`, `cms_lock_relation_target`, resolver lock pass), 012300, 012400; runner 012 exit 0 (93 ok); a mutual-reference deadlock aborts exactly one writer with the typed CONFLICT
- Refactor: harness repair: kit `seedArticleTarget` used one `now()` instead of two `clock_timestamp()` calls (tripped `cms_entry_revisions_snapshot_time_check`)

### H04: Database per-actor concurrent revision cap (three slots)
- Layer: data
- Source: lane-h-report.md (Item 5)
- Contract first: spec `.memory/wiki/specs/be/03b-editorial-workflow-publication.md` (per-actor concurrent revision cap); runner `supabase/tests/phase_02_slice_10_races/013-revision-concurrency-cap.mjs`
- RED (fragment): `supabase/tests/phase_02_slice_10_races/013-revision-concurrency-cap.mjs` :: `a fourth concurrent revision write of one actor is refused with RATE_LIMITED` => `ASSERTION FAILED: C1: a fourth concurrent revision write of one actor is refused with RATE_LIMITED (no error)` (only the Worker per-isolate Map existed)
- GREEN: migrations 20261005012100 (`cms_acquire_revision_write_slot`) and 012300; runner 013 exit 0 (6 ok): the 4th write is RATE_LIMITED with counts unchanged, an exact replay is still answered, the refused command succeeds after the held writers commit
- Refactor: none reported

### H05: CMS-03B-13 entry list reads only the caller's authorized rows
- Layer: data
- Source: lane-h-report.md (Item 4, H4)
- Contract first: spec `.memory/wiki/specs/be/03b-editorial-workflow-publication.md` (CMS-03B-13 keyset); test `supabase/tests/phase_02_slice_10_entry_list_authorized_keyset.sql` written first
- RED: `supabase/tests/phase_02_slice_10_entry_list_authorized_keyset.sql` :: `a two-row page next to 4000 hidden entries reads only tuples proportional to the authorized rows` => lane report: reads per call `4008` (the whole table) against bounds 12/60/60/11/15, `not ok 16-20`
- GREEN: migration 20261005012200 (page driven from a MATERIALIZED CTE of the caller's active assignments); authorized calls read 7 tuples, zero-visible calls read 0; 23/23
- Refactor: none reported (`#variable_conflict use_variable` added after the test caught a column/variable collision)

### H06: create_entry binds scalar values to the active version's definition row
- Layer: data
- Source: lane-h-report.md (Item 6a)
- Contract first: test `supabase/tests/phase_02_slice_10_successor_create.sql` (successor produced through the real Slice 09 chain) written first
- RED: `supabase/tests/phase_02_slice_10_successor_create.sql` :: `an append succeeds on the entry created on the successor version (it was DEPENDENCY_UNAVAILABLE before) [P2-S10-AC-061]` => `not ok 4-8` (every later append on an entry created on a successor version failed DEPENDENCY_UNAVAILABLE)
- GREEN: migration 20261005012300 resolves the active version's definition row; 8/8
- Refactor: none reported

### H07: Restore stale CAS is the typed VERSION_MISMATCH and restore commits chain evidence
- Layer: data
- Source: lane-h-report.md (Items 6b + 6d, AC025 / AC027)
- Contract first: spec `.memory/wiki/specs/be/03b-editorial-workflow-publication.md` (restore chain evidence, `cms.entry.revision-restored.v1`); test `supabase/tests/phase_02_slice_10_restore_evidence.sql` replaced the vacuous AC027 assertions
- RED: `supabase/tests/phase_02_slice_10_restore_evidence.sql` :: `the restore commits exactly one chain-evidence outbox event [P2-S10-AC-027]` => lane report: `RED not ok 7, 11-14` (no chain-evidence audit row or outbox event existed; the stale CAS raised SQLSTATE 40001)
- GREEN: migration 20261005012400 (stale CAS now `P0001 VERSION_MISMATCH`; audit row `cms.entry.revision.restore.chain`; outbox `cms.entry.revision-restored.v1`); 19/19
- Refactor: cascade: the restore CAS state `40001` -> `P0001` in `phase_02_slice_10_restore_chain.sql`, `phase_02_slice_10_restore_chain_rebind.sql` and `phase_02_slice_10_restore_transform/002-typed-refusals.sqlinc`

### H08: Conflict lifecycle: an advancing append or restore supersedes open conflicts
- Layer: data
- Source: lane-h-report.md (Item 6c)
- Contract first: spec `.memory/wiki/specs/be/03b-editorial-workflow-publication.md` (ConflictRecord open -> resolved|superseded); test `supabase/tests/phase_02_slice_10_conflict_lifecycle.sql`
- RED: `supabase/tests/phase_02_slice_10_conflict_lifecycle.sql` :: `the append that advanced the draft superseded C1 in the same transaction (version + 1, no resolution evidence) [P2-S10-AC-053]` => lane report: `RED not ok 9-11,13-15,17-18` (C1 stayed open and wedged the entry)
- GREEN: migrations 20261005012300 and 012400; 27/27; resolving a closed or superseded conflict stays the typed INVALID_TRANSITION
- Refactor: none reported

### H09: Semantic refusals carry bounded safe RFC 6901 violation pointers
- Layer: data
- Source: lane-h-report.md (Item 6e)
- Contract first: spec `.memory/wiki/specs/be/03b-editorial-workflow-publication.md` (DB refusal convention: DETAIL = JSON array of RFC 6901 pointers); test `supabase/tests/phase_02_slice_10_validation_pointers.sql`
- RED: `supabase/tests/phase_02_slice_10_validation_pointers.sql` :: `create: a malformed locale is pointed at /locale` => lane report: 39 of 47 assertions failed (bare VALIDATION_FAILED with no pointer)
- GREEN: migrations 20261005012100, 012300, 012400 (53 `detail =` sites); 47/47 including the hygiene check that every captured DETAIL matches the safe pointer grammar
- Refactor: none reported (two expectations were corrected to the actual, more precise pointers after observation)

### H10: entryVersion, list item fields, replay header and presence sweep gauge
- Layer: data
- Source: lane-h-report.md (Item 9)
- Contract first: spec `.memory/wiki/specs/be/03b-editorial-workflow-publication.md` and DEC-145 (response contracts); test `supabase/tests/phase_02_slice_10_response_contracts.sql`
- RED: `supabase/tests/phase_02_slice_10_response_contracts.sql` :: `each replay marks the response with the x-cms-idempotent-replay response header` => lane report: `RED not ok 6, 9, 10, 16, 18, 19`
- RED: `supabase/tests/phase_02_slice_10_response_contracts.sql` :: `the sweep answers exactly { expiredLeases, activeLeases }` => lane report: sweep assertions `not ok 21-23`
- GREEN: migrations 20261005012200, 012300, 012400, 012500 (`cms_expire_edit_presence_leases` answers `{expiredLeases, activeLeases}`); 24/24
- Refactor: cascade: `phase_02_slice_10_cursor_signature.sql` exact item key set, `phase_02_slice_10_presence_lease.sql` exact sweep object (`plan(66)` -> `plan(67)`)

### H11: Slice 09 entry-lock race cascade after the authority locks
- Layer: data
- Source: lane-h-report.md (Regression found by the final `pnpm db:races`)
- Contract first: spec `.memory/wiki/specs/be/03b-editorial-workflow-publication.md` (entry and revision writes serialize with schema activation); runner `supabase/tests/phase_02_slice_09_scan/010-entry-lock-race.mjs` is the Slice 09 contract
- RED (fragment): `supabase/tests/phase_02_slice_09_scan/010-entry-lock-race.mjs` :: `S2: the waiting entry was refused after the switch committed` => the first full `pnpm db:races` failed this assertion (its pre-cascade wording was "the waiting entry was refused with CONFLICT by the version-lock guard"): the entry was refused with `VALIDATION_FAILED ["/contentTypeVersionId"]`
- GREEN: the assertion now accepts the refusal from either layer (CONFLICT from the version lock or guard, or the stale-version VALIDATION_FAILED) and still asserts refusal and that no revision exists on the switched-away version; `pnpm db:races` All 10 race runners passed
- Refactor: none reported

### H12: cms_localization_fanout ambiguous column reference
- Layer: data
- Source: lane-h-report.md (Round 2, db:lint 42702)
- Contract first: test `supabase/tests/phase_02_slice_10_locale_fanout_branch.sql` (real translation revisions and three locale variants) written first
- RED: `supabase/tests/phase_02_slice_10_locale_fanout_branch.sql` :: `three dependent locales over a limit of two are refused, never truncated` => the first call raised `ERROR: column reference "source_locale" is ambiguous ... line 38 at SQL statement` (the finding `db:lint` reported)
- GREEN: variables renamed `v_source_entry_id / v_source_locale / v_source_hash / v_dependent_count` in the unreleased 20261005010900; 15/15; `db:lint` 0 error-level findings
- Refactor: the rename above, done in place (the older regression file still matches `dependent_count > p_limit`)

### H13: CMS-03B-13 keyset skip on mutable updated_at: collection-epoch cursor
- Layer: data
- Source: lane-h-report.md (Round 2, item 3, migration 20261005013200)
- Contract first: spec `.memory/wiki/specs/be/03b-editorial-workflow-publication.md` (CMS-03B-13 signed keyset, DEC-140 restart); test `supabase/tests/phase_02_slice_10_entry_list_epoch_cursor.sql`
- RED: `supabase/tests/phase_02_slice_10_entry_list_epoch_cursor.sql` :: `A: the conflicted page lists nothing` => against the old reader: `have: NULL`, items `E3,E7` (E4, updated ahead of the cursor, was listed on no later page)
- RED: `supabase/tests/phase_02_slice_10_entry_list_epoch_cursor.sql` :: `A: an unseen entry updated ahead of the cursor between two pages is a 409 CONFLICT, never a silent skip` => same run: the silent skip returned a page instead of the 409
- GREEN: migration 20261005013200 (`aheadDigest` bound into the signed cursor, `cms_entry_list_epoch`); 33 assertions; cursor payload 6 -> 7 keys cascaded into `phase_02_slice_10_cursor_signature.sql`
- Refactor: the helpers of `phase_02_slice_10_entry_list_authorized_keyset.sql` moved to `phase_02_slice_10_entry_list_keyset/000-helpers.sqlinc` and shared by the new suite

### H14: One global lock order and typed deadlock CONFLICT, proved with the real RPCs
- Layer: data
- Source: lane-h-report.md (Round 2, items 1, 2 and 4, migrations 20261005013000 and 013100)
- Contract first: spec `.memory/wiki/specs/be/03b-editorial-workflow-publication.md` (write-path lock order and authority fencing); runners `supabase/tests/phase_02_slice_10_races/010-activation-serialization.mjs` and `supabase/tests/phase_02_slice_10_races/014-revocation-vs-activation.mjs` rewritten over a world built only through the named commands (`infra/database-races/chain-kit.mjs`)
- RED (fragment): `supabase/tests/phase_02_slice_10_races/010-activation-serialization.mjs` :: `neither the writer nor the` => real-RPC reproduction before any fix: `S1 create/human ... activation: deadlock detected / Process 615 waits for ShareLock on transaction 2596; blocked by process 588.` (activation aborted with raw 40P01)
- RED (fragment): `supabase/tests/phase_02_slice_10_races/010-activation-serialization.mjs` :: `answers the typed retryable CONFLICT, not a raw 40P01` => without 013100: `S4 create ... deadlock detected`
- GREEN: migrations 20261005013000 (lock order) and 013100 (`deadlock_detected` -> typed retryable CONFLICT); runner 010 107 assertions, runner 014 48; catalog guard `phase_02_slice_10_activation_lock_order.sql` 30 assertions
- Refactor: `cms_lock_activation_authority` split into `cms_lock_activation_identity_authority` and `cms_lock_activation_review_rows` (the old function kept as the composite)

### H15: Creator assignment carries the capability the creator proved
- Layer: data
- Source: lane-h-report.md (Round 2, extra: EB-AC063, migration 20261005013300)
- Contract first: test `supabase/tests/phase_02_slice_10_create_entry_capability.sql` (real Slice 09 producers); the evidence lane's probe `EB-AC063` was the report that opened it
- RED: `supabase/tests/phase_02_slice_10_create_entry_capability.sql` :: `the creator's initial assignment carries the capability they exercised: cms.editor` => `not ok 2 - the creator's initial assignment carries the capability they exercised: cms.editor`, `not ok 3 - the editor-only creator holds authority (grant + assignment) on the entry they just created`
- GREEN: migration 20261005013300; 12/12 (editor-only -> cms.editor, author-only -> cms.author, both -> cms.author, exactly one initial assignment, neither -> FORBIDDEN)
- Refactor: lane EB's TODO-wrapped probes were unwrapped into ordinary assertions

### H16: Compare resolves recorded taxonomy and template versions (EA-AC002, EB-AC056)
- Layer: data
- Source: lane-h-report.md (Round 3, items 1 + 4, migration 20261005014100)
- Contract first: spec `.memory/wiki/specs/be/03b-editorial-workflow-publication.md` (DEC-141, recorded taxonomy and composition references in comparison and restore); evidence-lane probe `supabase/tests/phase_02_slice_10_ev_ea_gaps.sql`
- RED: `supabase/tests/phase_02_slice_10_ev_ea_gaps.sql` :: `GAP EA-AC002 a compared revision whose recorded taxonomy version does not resolve is comparison_unavailable` => `not ok 5 - GAP EA-AC002 a compared revision whose recorded taxonomy version does not resolve is comparison_unavailable`; the new `phase_02_slice_10_compare_lineage.sql` had 11 `not ok` (every taxonomy and template-vanished case answered 200)
- GREEN: migration 20261005014100 (`cms_compare_revision_resolvable`: a non-empty recorded taxonomy list fails closed, a vanished template pin is comparison_unavailable); `phase_02_slice_10_compare_lineage.sql` 23/23; `ev_ea_gaps.sql` 5/5 with its TODO wrapper removed
- Refactor: none reported

### H17: Unreadable baseRevision is the 422 VALIDATION_FAILED at /baseRevision (EA-AC029)
- Layer: data
- Source: lane-h-report.md (Round 3, item 2, migration 20261005014000)
- Contract first: spec `.memory/wiki/specs/be/03b-editorial-workflow-publication.md` (validation matrix, CMS-03B-01 baseRevision); test `supabase/tests/phase_02_slice_10_write_refusal_contract.sql`
- RED: `supabase/tests/phase_02_slice_10_write_refusal_contract.sql` :: `AC-029: a baseRevision that names no revision of the entry is the 422 VALIDATION_FAILED, not a 404` => `not ok 7 - AC-029 ... 422 VALIDATION_FAILED, not a 404`, then 8 (pointer), 10 (retry) and 11
- GREEN: migration 20261005014000; 18/18; Worker mapping needed no change (new cases in `apps/worker/src/cms-editorial-production-error-tokens.test.ts` 29/29)
- Refactor: none reported

### H18: An entry that is not active is the policy-safe 404 NOT_FOUND (EA-AC028)
- Layer: data
- Source: lane-h-report.md (Round 3, item 3, migration 20261005014000)
- Contract first: spec `.memory/wiki/specs/be/03b-editorial-workflow-publication.md` (matrix row CMS-03B-01 entryId; D-11 / DEC-145); test `supabase/tests/phase_02_slice_10_write_refusal_contract.sql`
- RED: `supabase/tests/phase_02_slice_10_write_refusal_contract.sql` :: `AC-028: an append to an entry that is not active is the policy-safe 404 NOT_FOUND, not a 409` => `not ok 14 - AC-028 ... policy-safe 404`, `not ok 16 - ... indistinguishable from an absent one` (it answered 409 INVALID_TRANSITION)
- GREEN: migration 20261005014000 (only `cms_create_revision` changed); 18/18 including outsider archived == outsider active and a nothing-written check
- Refactor: none reported

### H19: The create path binds the stored artifact hash to the definition hash (EC-079-a)
- Layer: data
- Source: lane-h-report.md (Round 4, 079-a, migration 20261005015000)
- Contract first: spec `.memory/wiki/specs/be/03b-editorial-workflow-publication.md` (artifact hash = definition hash); evidence-lane probe `supabase/tests/phase_02_slice_10_ev_ec_r1_gaps.sql`
- RED: `supabase/tests/phase_02_slice_10_ev_ec_r1_gaps.sql` :: `EC-079-a a create that echoes a drifted artifact hash is refused: the stored binding, not the request, decides` => `not ok 6 - GAP EC-079-a ...` (this assertion's title before the later rename): the command COMMITTED an entry over a stored artifact whose hash had drifted, `want: ERR DEPENDENCY_UNAVAILABLE`
- GREEN: migration 20261005015000 (`artifact_row.id = version_row.schema_artifact_id`, hash equality, non-null compiler/contract); the probe and `phase_02_slice_10_activation_structure_binding.sql` (21 assertions) pass
- Refactor: none reported (079-b was NOT a production defect: the probe mutation was a no-op; see the characterization section)

### H20: Activation re-acquired authority rows after the candidate and active locks
- Layer: data
- Source: lane-h-report.md (Round 5, HIGH, migrations 20261005016000 and 016200)
- Contract first: spec `.memory/wiki/specs/be/03b-editorial-workflow-publication.md` (one lock order, authority rows first); block R3 added to runner `supabase/tests/phase_02_slice_10_races/014-revocation-vs-activation.mjs`
- RED (fragment): `supabase/tests/phase_02_slice_10_races/014-revocation-vs-activation.mjs` :: `a reviewer-class grant row of a counted approver is committed after the activation's early scan` => unfixed code, human path: `R3 late-row/human: no deadlock ... revocation: deadlock detected / Process 1626 waits for ShareLock on transaction 2527; blocked by process 1597.`; worker path the same (`Process 411 waits for ShareLock`)
- GREEN: migrations 20261005016000 (human switch calls `cms_lock_activation_review_rows` only; new `cms_worker_human_approval_evidence_valid`) and 016200; runner 014 60 assertions, 010 107, 012 93, 011 66; `phase_02_slice_10_activation_lock_order.sql` 38 assertions
- Refactor: `cms_lock_entry_assignments_shared` extracted so the relation-target lock no longer rescans identity rows

### H21: JSON null bypassed the create-entry SchemaArtifact comparison
- Layer: data
- Source: lane-h-report.md (Round 5, MEDIUM, migration 20261005016100)
- Contract first: test `supabase/tests/phase_02_slice_10_create_artifact_evidence_nulls.sql` written first
- RED: `supabase/tests/phase_02_slice_10_create_artifact_evidence_nulls.sql` :: `no refused create wrote an entry (every refused probe sees none after its call)` => first run: a valid artifact id with JSON null for `contentTypeVersionId`, `artifactHash`, `compilerVersion`, `zodContractRef` COMMITTED an entry (`not ok 7-12`, `not ok 22`)
- GREEN: migration 20261005016100 (members must be JSON strings; `IS DISTINCT FROM` comparisons); 22 assertions
- Refactor: none reported

## API, SSR and island layers (lane N: contracts, Worker, web)

Source report: lane-n-report.md.

### N01: Well-formed Unicode in the shared rich-text and structured-value contracts
- Layer: api
- Source: lane-n-report.md (checkpoint 1, M3 + L1)
- Contract first: `packages/contracts/src/content-schema-registry/structured-values-text.ts` (`isWellFormedAuthoredString`, written with its RED test) and `packages/contracts/src/content-schema-registry/structured-values-unicode.test.ts`
- RED: `packages/contracts/src/content-schema-registry/structured-values-unicode.test.ts` :: `refuses a lone surrogate in an https href, a mailto address and an internal route` => M3 RED: 22 of 47 tests failing for the right reason (schemas accepted lone surrogates and NUL in span text, link targets, object scalar and enum strings)
- RED: `apps/web/src/components/cms-rich-text/cms-rich-text-markup.test.ts` :: `L1: admits a mailto address of 202 characters (402 UTF-16 units), as the shared schema does` => L1 RED: failed with `ok:false` (a valid 202-character emoji mailto was refused as an unsafe link by a second copy of the grammar)
- GREEN: structured-values-unicode 47/47; `vitest run packages/contracts` 105 files / 1418 tests; rich-text and registry 49 files / 722 tests; L1 fixed by reusing `RichTextLinkSchema` / `RichTextSpanSchema` / `RICH_TEXT_MARKS` from the package, not by patching the copy
- Refactor: the web `cms-rich-text-contracts.ts` now re-exports the package schemas (one grammar instead of two)

### N02: Draft-detail and history routes project port failures through the route policy
- Layer: api
- Source: lane-n-report.md (checkpoint 2, M1)
- Contract first: `apps/worker/src/cms-editorial/detail-routes.test.ts` and `history-routes.test.ts` (describe "Codex s10-ts-2 M1") written first; reuses the existing `normalizedReadError` allowlist
- RED: `apps/worker/src/cms-editorial/detail-routes.test.ts` :: `keeps only a registered read reasonCode on a visible 403 and drops every write-path member` => 5 failing for the right reason: a detail 403 relayed `expectedVersion`/`currentVersion`/`dependencyClass`/`conflict`/`recoveryAction`
- RED: `apps/worker/src/cms-editorial/detail-routes.test.ts` :: `fails closed as a scrubbed 500 on a 409, which the bounded read does not declare` => a detail 409 (not declared by CMS-03B-11) was published as 409 instead of a scrubbed 500
- GREEN: `vitest run apps/worker/src/cms-editorial` 43 files / 596 tests; both routes pass `policy` to `errorResponse`/`publishedError` and run port failures through `sanitizeReadError(result, policy)`
- Refactor: none reported

### N03: Editor reconcile keeps unsent edits and the rebase loop is bounded
- Layer: island
- Source: lane-n-report.md (checkpoint 3, H1 + M2)
- Contract first: `apps/web/src/components/cms-editorial/cms-editorial-entry-editor-reconcile.test.ts` (new, RED) written first; spec FE03 SyncConflict contract
- RED: `apps/web/src/components/cms-editorial/cms-editorial-entry-editor-reconcile.test.ts` :: `keeps a field edited while the save was pending and still adopts the merged-in fields` => 8 failing for the right reason: the unsent field was overwritten with null in three merged-save variants, same-field divergence adopted `Theirs`, and the rebase chain sent 5 writes immediately with no pause
- GREEN: reconcile test 8/8; `vitest run apps/web/src/components/cms-editorial apps/web/src/components/cms-rich-text` green; rebase #1 immediate, #2 after 1 s, #3 after 2 s, the 4th consecutive stale base stops in `sync-conflict`
- Refactor: new `cms-editorial-entry-editor-stale-base.ts` extracted from `save.ts` (which stays under 300 lines) and `cms-editorial-entry-editor-rebase.ts`

### N04: Controlled rich-text editor adopts a later canonical value
- Layer: island
- Source: lane-n-report.md (checkpoint 4, H4)
- Contract first: `apps/web/src/components/cms-rich-text/CmsRichTextEditor.reconcile.test.tsx` (new) written first
- RED: `apps/web/src/components/cms-rich-text/CmsRichTextEditor.reconcile.test.tsx` :: `shows the adopted document and builds the next edit from it` => 4 failing: the editor still showed Document A after the parent adopted B; the next edit emitted from A; invalid -> valid did not recover; no notice
- GREEN: reconcile test 5/5 (including an echo with reordered keys that keeps the same textarea); `vitest run apps/web/src/components/cms-rich-text` 5 files / 32 tests
- Refactor: new hook `use-cms-rich-text-blocks.ts` and `richTextKey` (key-order independent identity)

### N05: Rich-text markup is a lossless view of the spans
- Layer: island
- Source: lane-n-report.md (checkpoint 5, H3)
- Contract first: `apps/web/src/components/cms-rich-text/cms-rich-text-roundtrip.test.ts` (new) written first; FE03:578 ("parsed deterministically to canonical spans")
- RED: `apps/web/src/components/cms-rich-text/cms-rich-text-roundtrip.test.ts` :: `parse(serialize(spans)) is the identity for 400 seeded random span lists` => 22 failing (a_b, snake_case, brackets, backticks, `**`, backslashes, parentheses, mixed marks, marked links, random corpora; `serializeSpans` absent)
- GREEN: roundtrip 28/28 plus the component test "editing one block never rewrites another"; web cms-rich-text + cms-editorial + cms-editorial-fields 55 files / 600 tests
- Refactor: `cms-rich-text-markup.ts` rewritten with toggling markers and escapes; new `cms-rich-text-links.ts`; flagged decision: the old [P2-S10-AC-2221] expectation of sticky markers now asserts toggling markers

### N06: Leave guard: inline confirmation, beforeunload only while dirty, flush on Save and leave
- Layer: island
- Source: lane-n-report.md (checkpoint 6, H2)
- Contract first: `apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland.leave.test.tsx` (new) written first; FE03:921, :1089, :2640 (`.memory/wiki/specs/fe/03-cms-content-modeling.md`)
- RED: `apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland.leave.test.tsx` :: `takes over a link click while dirty, shows an inline confirmation with heading focus and keeps the draft` => 11 failing (no confirmation, no beforeunload, sign-in link same-tab, no resume)
- GREEN: leave test 14/14 (3 negative controls); web cms-editorial + cms-rich-text + cms-editorial-fields + cms-editorial-pages 56 files / 615 tests
- Refactor: shared `CmsEditorialEntryEditorIsland.test-support.tsx` extracted from the island test (plus `unmountAll`)

### N07: The nine Slice 10 routes name the cms-editorial runbook
- Layer: api
- Source: lane-n-report.md (checkpoint 7, runbook repoint)
- Contract first: `packages/contracts/src/platform-registries-editorial-runbook.test.ts` (new) written first; `registry-primitives.ts` `CANONICAL_RUNBOOK_PATHS`
- RED: `packages/contracts/src/platform-registries-editorial-runbook.test.ts` :: `accepts the cms-editorial runbook as a canonical path` => 10 failing (path not canonical; all nine routes on operational-endpoints.md)
- GREEN: runbook test 12/12; `registries.test.ts` pins unchanged (27/27 together); `pnpm contracts:generate` changed exactly 9 `x-runbook` lines; `pnpm contracts:check` exit 0
- Refactor: the nine routes use `slice10EditorialRoute` (= `editorialRouteDefaults` + the runbook)

### N08: Field editors refuse text PostgreSQL cannot store before anything is sent
- Layer: island
- Source: lane-n-report.md (checkpoint 8, client-side well-formed Unicode)
- Contract first: `apps/web/src/components/cms-editorial-fields/cms-field-value.test.ts` (new block) written first
- RED: `apps/web/src/components/cms-editorial-fields/cms-field-value.test.ts` :: `reports the unstorable character before any length rule` => 17 failing at the validator (short/long text, enum, date, datetime, list items, object scalar and enum properties); rich-text, relation and taxonomy/media cases were characterization tests, already green
- GREEN: `vitest run apps/web packages/contracts` 455 files / 5181 tests; `validateCmsScalarValue` calls the shared `isWellFormedAuthoredString`; integration guards were observed RED with the one-line fix disabled, then restored
- Refactor: none reported

### N09: SSR-hydrated rich-text typing and Save draft focus
- Layer: island
- Source: lane-n-report.md (checkpoint 9, lane P real-browser defects)
- Contract first: `apps/web/src/components/cms-rich-text/CmsRichTextEditor.hydration.test.tsx` and `apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland.focus.test.tsx` (new) written first
- RED: `apps/web/src/components/cms-rich-text/CmsRichTextEditor.hydration.test.tsx` :: `renders identical HTML on every server render of the same props, so ids do not depend on module state` => two server renders of the same props produced different HTML and ids (module id counter); with onChange silenced the typed text never reached state
- RED: `apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland.focus.test.tsx` :: `keeps the Save draft button enabled (aria-busy, not disabled) while the save is in flight` => the button was disabled during saving (Chrome drops focus from a disabled focused control to <body>)
- GREEN: hydration 4/4, focus 3/3; lane P's real specs went green with no spec change (rich-text + keyboard 7/7; all Slice 10 real specs 29/29)
- Refactor: no module state: `toEditorBlocks(value, idFor)` takes a pure id function; the native listener moved into `CmsRichTextEditorBlock` and is bound by closure

### N10: Create, resolve and restore keep the activated control enabled and focused
- Layer: island
- Source: lane-n-report.md (checkpoint 10, lane EB focus defect in three more forms)
- Contract first: `apps/web/src/components/cms-editorial/ev-eb-focus-gaps.test.tsx` (lane EB's three `it.fails` probes, converted to ordinary tests) and `cms-editorial-submit-focus.test.tsx` (new, 10 tests)
- RED: `apps/web/src/components/cms-editorial/ev-eb-focus-gaps.test.tsx` :: `AC-052: the Create entry button is not disabled while the create is in flight` => failed with `disabled === true`
- RED: `apps/web/src/components/cms-editorial/ev-eb-focus-gaps.test.tsx` :: `AC-055: the Resolve conflict button is not disabled while the resolve is in flight` => failed with `disabled === true`
- RED: `apps/web/src/components/cms-editorial/ev-eb-focus-gaps.test.tsx` :: `AC-058: the restore confirmation button is not disabled while the restore is in flight` => failed with `disabled === true`
- GREEN: `vitest run apps/web/src/components/cms-editorial apps/web/src/lib` 61 files / 657 tests; 7 of the 10 new submit-focus tests failed before the fix; all Slice 10 real specs 29/29
- Refactor: one pattern in all three forms: the activated control stays enabled with `aria-busy`; restore `withFormLock(form, event.submitter, ...)` keeps the submitter enabled

### N11: CMS-03B-12 serves only open conflicts
- Layer: api
- Source: lane-n-report.md (checkpoint 11 part 2, DEC-139)
- Contract first: `packages/contracts/src/cms-editorial/conflict-detail.ts` (`ConflictDetailResourceSchema`); spec `.memory/wiki/specs/be/03b-editorial-workflow-publication.md` :1139-1142, :1686, :2038; test block "open-only rule (DEC-139)" written first
- RED: `packages/contracts/src/cms-editorial/conflict-detail.test.ts` :: `refuses a resolved or superseded conflict, with or without paths` => new "open-only rule (DEC-139)" block, 3 failing (closed state with and without paths, a resolved revision on an open conflict, an open conflict with no paths)
- GREEN: packages/contracts 106 files / 1432 tests; `pnpm contracts:check` exit 0; Worker route -> 502, web proxy -> 502, browser client never `success`, SSR loader unverified notice
- Refactor: the route's own `open && paths.length` check removed in favour of the shared schema

### N12: Canonical facts, provenance and one-shot result panel on the entry page
- Layer: ssr
- Source: lane-n-report.md (checkpoint 11 part 1 and checkpoint 12, canonical facts and result handoff)
- Contract first: `apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland.facts.test.tsx` (new) written first; FE03:910 and :1219 (`.memory/wiki/specs/fe/03-cms-content-modeling.md`)
- RED: `apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland.facts.test.tsx` :: `lists the per-field provenance the server reported, in words, for every authored field` => 10 failing (no facts section, no provenance, no result panel)
- RED: `apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland.facts.test.tsx` :: `moves focus to the result heading (FE03 Completion, :1219), even when the route heading took it first` => checkpoint 12: focus stayed on the route h1 `#page-title`
- RED: `apps/web/src/components/cms-editorial/cms-editorial-result-handoff.test.ts` :: `clears a FRESH record that belongs to another entry, without showing it` => checkpoint 12: a fresh foreign record and a malformed record were left in storage
- GREEN: `vitest run apps/web packages/contracts apps/worker/src/cms-editorial tests/contracts/slice-03-openapi-contract.test.ts` 509 files / 5867 tests; real specs 30/30 including lane P's result-heading assertions
- Refactor: new `CmsEditorialDraftFacts.tsx` replaces the bare `dl`; `load-entry-edit-page.ts` (SSR loader) passes `provenance` into the island init; both new blocks use lists so lane P's `page.locator('dl')` stays unambiguous

### N13: Restore confirmation: failure summary with focus and scoped draft
- Layer: island
- Source: lane-n-report.md (checkpoint 12, AC-058 typed failure focus and scoped draft)
- Contract first: FE03 :2599, :2600, :2602, :2604, :582, :921, :1178, :2640 (`.memory/wiki/specs/fe/03-cms-content-modeling.md`); tests in `apps/web/src/lib/cms-editorial-page-actions-core.test.ts` written first
- RED: `apps/web/src/lib/cms-editorial-page-actions-core.test.ts` :: `an unconfirmed attempt keeps the idempotency key and a scoped draft, and says the retry cannot restore twice` => 14 failing across page-actions-core (summary and focus for 409/422/403/404/503, single summary, sign-in in a new tab, kept key and draft, recovery after navigation, cancel forgets) and the handoff/facts tests
- GREEN: real specs 30/30 (n-logs/e2e-6.log); `vitest run apps/web packages/contracts apps/worker/src/cms-editorial` 513 files / 5909 passed
- Refactor: new `lib/cms-editorial-restore-feedback.ts` and `lib/cms-editorial-restore-draft.ts`; the earlier submit-focus test "keeps focus on the button after a refused restore" now expects focus on the failure summary (FE03:2599)

### N14: Entry list cursor 409 restarts from the first page keeping the filters
- Layer: ssr
- Source: lane-n-report.md (checkpoint 13 part 1, AC-098)
- Contract first: FE03:574 and DEC-140 (`.memory/wiki/specs/fe/03-cms-content-modeling.md`); the evidence lane's probe `apps/web/src/components/cms-editorial-pages/phase-02-slice-10-ev-ec-r1-list-restart.test.ts` was converted to positive tests first
- RED: `apps/web/src/components/cms-editorial-pages/phase-02-slice-10-ev-ec-r1-list-restart.test.ts` :: `redirects to the same list without the cursor, keeping state, type and limit` => 4 failing in the converted probe (redirect, announcement, none-by-default, 409-without-cursor keeps filters); `loadEntryListPage` answered with a retry link to the bare route
- GREEN: `vitest run apps/web packages/contracts apps/worker/src/cms-editorial` 516 files / 5975 tests; all Slice 10 real specs 30/30 (n-logs/e2e-7.log)
- Refactor: none reported (cascade: `tests/e2e/phase-02-slice-10-entry-list-real-route.spec.ts` now asserts the restart)

### N15: TypeScript validators answer the PostgreSQL rich-text reason token
- Layer: api
- Source: lane-n-report.md (checkpoint 13 part 3, AC-084)
- Contract first: `packages/contracts/src/content-schema-registry/structured-values-rich-text-reason.test.ts` (the 11 shapes lane EC drove through Worker -> PostgREST -> SQL, plus 3 accepted shapes) written first
- RED: `packages/contracts/src/content-schema-registry/structured-values-rich-text-reason.test.ts` :: `exports the token PostgreSQL emits` => failed first (`validateRichTextV1` and `RICH_TEXT_NOT_CANONICAL` absent: the validators answered a boolean or the client code `invalid_rich_text`), then 18/18
- GREEN: `validateCmsFieldValue` returns issue code `rich_text_not_canonical` with the one fixed reason copy; web field-value and editor tests assert the token and copy
- Refactor: none reported

### N16: Semantic mark and link controls in the rich-text editor
- Layer: island
- Source: lane-n-report.md (checkpoint 13 part 2, AC-086)
- Contract first: `apps/web/src/components/cms-rich-text/CmsRichTextEditor.controls.test.tsx` and `cms-rich-text-selection.test.ts` (new) written first
- RED: `apps/web/src/components/cms-rich-text/CmsRichTextEditor.controls.test.tsx` :: `offers Bold, Italic and Code toggles and a Link control in a labelled toolbar for every block` => 18 failing DOM tests plus the pure-function selection suite (24)
- GREEN: both suites green; Playwright toolbar spec added later by lane P (4/4 first run); `vitest run apps/web packages/contracts apps/worker/src/cms-editorial` 516 files / 5975 tests
- Refactor: `cms-rich-text-tokens.ts` split out of the markup module; cascade: lane EC's two assertions in `phase-02-slice-10-ev-ec-rich-text-ui.test.tsx` now expect Bold, Italic, Code, Link, then move/remove

### N17: Closeout hygiene: no BOUNDARY marker, route constants pinned to the route policy
- Layer: island
- Source: lane-n-report.md (checkpoint 14, AC-060 boundary markers and stale constants)
- Contract first: `apps/web/src/components/cms-editorial/cms-editorial-route-constants.test.ts` (new) and lane EB's marker probe in `tests/integration/phase-02-slice-10-ev-eb-closeout.test.ts`
- RED: `apps/web/src/components/cms-editorial/cms-editorial-route-constants.test.ts` :: `states no open blocker, unavailable status or unwired loader` => failed (the constants were absent)
- RED: `tests/integration/phase-02-slice-10-ev-eb-closeout.test.ts` :: `EB closeout: no unresolved implementation boundary marker remains in the Slice 10 production sources` => the marker probe failed with the one offender (`cms-editorial-entry-loader-boundary.ts`, a `BOUNDARY:` marker nothing imported)
- GREEN: `grep -rn "BOUNDARY:" apps packages` -> no match; `vitest run apps/web tests/integration/phase-02-slice-10-ev-eb-closeout-gaps.test.ts` 366 files / 3925 passed
- Refactor: the dead loader-boundary module, its test, the disabled-surface constants and the create-boundary test deleted; stale constants renamed `CMS_EDITORIAL_ENTRY_CREATE_ROUTE` / `CMS_EDITORIAL_ENTRY_DRAFT_DETAIL_ROUTE`

### N18: Result handoff bound to the auth subject; conflict provenance, paths, https links and astral selection
- Layer: api
- Source: lane-n-report.md (checkpoint 15, Codex final review s10-final-4)
- Contract first: `apps/web/src/components/cms-editorial/cms-editorial-result-handoff-auth.test.ts` (new) and the refinements added to `ConflictDetailSideSchema` / `ConflictDetailResourceSchema` with their tests
- RED: `apps/web/src/components/cms-editorial/cms-editorial-result-handoff-auth.test.ts` :: `never shows it to another subject on the same entry, and clears it` => 3 failing (another subject saw the record, a signed-out record was shown after sign-in, cleanup left it)
- RED: `apps/web/src/components/cms-rich-text/cms-rich-text-selection.test.ts` :: `keeps a link on a whole astral character` => 4 failing for the astral finding, including an exhaustive start/end sweep (a selection between the halves sliced a lone surrogate)
- GREEN: `vitest run apps/web packages/contracts apps/worker/src/cms-editorial` 517 files / 6007 tests; real specs 30/30 (e2e-9.log; e2e-8.log had the one expected failure from the old storage key)
- Refactor: result handoff moved to the subject-bound detour store `step-up-draft.ts`; https toolbar links now go through `RichTextLinkSchema.safeParse`; `wholeCharacters` widens selection ranges

## End-to-end (lane P), integration guards (lane Q) and the evidence-lane mutation proof

Source reports: lane-p-report.md, lane-q-report.md, lane-ea-report.md.

### P01: Real-composition end-to-end replaces the stub editorial port
- Layer: e2e
- Source: lane-p-report.md (Baseline, Design, Per-spec RED -> GREEN)
- Contract first: `tests/e2e/support/s10-real-editorial.ts`, `tests/e2e/support/s10-session-claims.ts`, `tests/e2e/support/s10-real-world.ts` and `tests/e2e/support/s10-real-api.ts` (new) with the specs under `playwright.s09-real.config.ts`; the stub history fixture (tests/e2e/support/cms-editorial-history-fixture.ts, since deleted) was replaced
- RED: `tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts` :: `create: the preparation loads, local validation sends nothing, and one create commits one entry with one revision, audit and outbox event` => baseline before any lane-P edit: 8 tests, 3 passed, 5 failed (503 from the stub history-only port); the create spec also failed first because the body was read after navigation
- RED: `tests/e2e/phase-02-slice-10-entry-list-real-route.spec.ts` :: `paginates exactly the author entries with a URL-owned signed cursor` => RED 503/500 (workerd detached fetch "Illegal invocation"), then the tampered-cursor 400
- RED: `tests/e2e/phase-02-slice-10-revision-history-real-route.spec.ts` :: `compare names the changed field with side hashes only, and restore recreates the LEFT revision under the served chain id` => RED: no browser JSON route for CMS-03B-03 (404) and the compare focus
- GREEN: first checkpoint run-5 (29 tests, DB reset first): 27 passed, 2 failed (the two genuine app defects reported to lane N, see P02 and P03); later whole Slice 10 real-route set 34/34 passed (run-12, 1.5 min)
- Refactor: none reported (the specs were corrected where the real stack taught a behaviour, e.g. a stale If-Match is a sync-conflict with no durable record, so the authoring conflict test was split into two)

### P02: Keyboard focus is kept after Save draft (app defect found by the real browser)
- Layer: e2e
- Source: lane-p-report.md (keyboard-real-route; Final run summaries)
- Contract first: `tests/e2e/phase-02-slice-10-keyboard-real-route.spec.ts` (new); FE03 focus rules
- RED: `tests/e2e/phase-02-slice-10-keyboard-real-route.spec.ts` :: `edit: Tab to the title, type, and Tab to Save draft with Enter saves under If-Match` => "edit ... Save draft" RED = app defect: focus lost to <body> after Save draft (reported to lane N in NOTES.md, specs left RED on purpose)
- GREEN: after lane N checkpoint 9 (N09): rich-text and keyboard specs 7/7, all Slice 10 real specs 29/29 with no spec change
- Refactor: none reported

### P03: Rich-text typing survives SSR hydration (app defect found by the real browser)
- Layer: e2e
- Source: lane-p-report.md (rich-text-real-route; Final run summaries)
- Contract first: `tests/e2e/phase-02-slice-10-rich-text-real-route.spec.ts`
- RED: `tests/e2e/phase-02-slice-10-rich-text-real-route.spec.ts` :: `authors a canonical rich_text.v1 value, refuses unsafe links inline, and round-trips the stored AST through the real database` => RED = app defect: typed characters reverted in the SSR-hydrated editor (module id counter -> `data-block-id` mismatch, proven by setting the id in the page)
- GREEN: after lane N checkpoint 9 (N09) the spec went green with no spec change; the DB-refusal test (422 + `rich_text_not_canonical`, nothing mutated) was green throughout
- Refactor: none reported

### P04: Result heading focus and canonical result panel asserted on the real route
- Layer: e2e
- Source: lane-p-report.md (Addendum: canonical facts and one-shot result panel)
- Contract first: `tests/e2e/support/s10-real-result.ts` (facts, panel, focus, one-shot and no-leak assertions) and `revisionLineage` in `tests/e2e/support/s10-real-world.ts` (reads the stored parent_revision_ids)
- RED: `tests/e2e/phase-02-slice-10-keyboard-real-route.spec.ts` :: `list -> create -> type -> Enter creates one entry without a pointer` => run-9 was the first RED run; run-10: 30 tests, 26 passed, 4 failed, all the same soft assertion `expectFocusOnResultHeading` (focus stayed on the route h1 `#page-title`)
- GREEN: run-12: 34/34 passed, including lane N's result-heading focus (the 4 soft failures are gone) and the toolbar spec
- Refactor: none reported

### Q01: Documentation boundary: tests/integration/support needs a README
- Layer: guard
- Source: lane-q-report.md (Item 1)
- Contract first: `tests/documentation-boundaries.test.ts` (existing guard)
- RED: `tests/documentation-boundaries.test.ts` :: `documents every non-generated directory with more than two direct files` => ENOENT `tests/integration/support/README.md` (only one directory missing; a scripted scan of all roots found no other)
- GREEN: added `tests/integration/support/README.md` (Contents, Ownership, Extension, Conventions, Related links for the ev-ea and ev-eb support modules); 5/5; prettier clean
- Refactor: none reported

### Q02: Marker citations: no Slice 09 marker in a Slice 10 pgTAP title
- Layer: guard
- Source: lane-q-report.md (Item 2)
- Contract first: `tests/contracts/phase-02-slice-09-marker-citations.test.ts` (existing guard)
- RED: `tests/contracts/phase-02-slice-09-marker-citations.test.ts` :: `[P2-S09-AC-1149] every test file that carries a verified criterion marker in a title is cited by that criterion, and every cited file carries it` => 3 findings in one file: `supabase/tests/phase_02_slice_10_field_kind_default.sql` carried `[P2-S09-AC-064]`/`[-061]`/`[-047]` in pgTAP descriptions that no S09 criterion cites
- GREEN: three title-only retitles to neutral descriptions plus one header comment (assertion bodies untouched); marker-citations 6/6; `lane-db.sh` on the file 78 tests PASS
- Refactor: none reported

### Q03: Cross-surface traceability: the S09 migration source stops before the first Slice 10 migration
- Layer: guard
- Source: lane-q-report.md (Item 3)
- Contract first: `tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts` (existing guard); `SLICE_10_FIRST_MIGRATION = 20261005010000`
- RED: `tests/contracts/phase-02-slice-09-cross-surface-traceability.test.ts` :: `[P2-S09-AC-165, P2-S09-AC-180] keeps the twelve original canonical tables and eight original named RPCs in the S09 migration` => the closed-world RPC check reported `cms_create_entry`, `cms_create_revision`, `cms_resolve_conflict`, `cms_restore_revision` as unexpected: the content filter `/CMS-03A|P2-S09|cms_create_type_draft/` swept `20261005013100_cms_deadlock_typed_conflict.sql` (names "CMS-03A-17" in a comment) into the S09 set
- GREEN: the S09 source is bounded to migrations before the first S10 forward migration; expected table/RPC lists untouched, no assertion weakened; 10/10
- Refactor: none reported

### E01: Autosave delta tests flip when the delta is removed (mutation RED)
- Layer: evidence
- Source: lane-ea-report.md (Remediation R1, mutation proof)
- Contract first: `apps/web/src/components/cms-editorial/ev-ea-autosave-rollback.test.ts` (new evidence tests for AC-001 / AC-003)
- RED: `apps/web/src/components/cms-editorial/ev-ea-autosave-rollback.test.ts` :: `one edited field is the whole request: changedPaths and values name only it, with the loaded base revision and entry version` => mutation: forcing `changedCmsFieldIds` to return every editable field flips all 3 delta tests
- GREEN: mutation reverted; the three delta tests and the rollback tests pass (12 + 5 in the two new web files)
- Refactor: none reported

## Evidence-lane probes that became the RED of the packages above

The evidence lanes wrote known-defect probes (TODO-wrapped pgTAP assertions, `it.fails` tests) first; each one is the RED of a package above and was turned into an ordinary assertion once the defect was fixed:

- `GAP EA-AC002` (lane EA, `supabase/tests/phase_02_slice_10_ev_ea_gaps.sql`): H16. Closed by lane H round 3.
- `EB-AC063` editor-only creator probes (lane EB): H15. Closed by lane H round 2.
- `ev-eb-focus-gaps.test.tsx` three `it.fails` probes (lane EB): N10. Closed by lane N checkpoint 10.
- `EC-079-a` and `EC-079-b` (lane EC, `supabase/tests/phase_02_slice_10_ev_ec_r1_gaps.sql`): H19 (079-a). 079-b was not a production defect (see below).
- `phase-02-slice-10-ev-ec-r1-list-restart.test.ts` (lane EC, `it.fails`): N14. Closed by lane N checkpoint 13.
- the EB marker probe (`EB closeout: no unresolved implementation boundary marker ...`): N17.

## Characterization and spec-only work (no RED reported)

- Lane L (`lane-l-report.md`): the Slice 11 and Slice 12 specification cascade (BE03b, BE03c, BE03a, IA03, FE03 and their indexes) and follow-up 2. No test was written or run; verification was an operation-ID consistency scan (0 orphans), a table-integrity check and `pnpm format:check`.
- Lane H, `phase_02_slice_10_write_path_catalog.sql` (10): pins definer and grant discipline of the functions the migrations create or redefine; it passed with the migrations (no separate RED reported).
- Lane H, `phase_02_slice_10_jsonb_unicode_parity.sql` (12): documents the PostgreSQL surrogate/NUL rule; it passed on the first run because no production code was involved.
- Lane H round 4, 079-b: NOT a production defect. Lane EC's probe set `required` to `true` on a property that already was `true`; the check `cms_activation_references_valid` already compared every stored definition with the frozen structure. The probe mutation was corrected to `required -> false` and `phase_02_slice_10_activation_structure_binding.sql` (21 assertions) now pins the drift family.
- Lane EA (`lane-ea-report.md`): all new evidence tests (pgTAP, PostgREST real stack, Worker error mapping) assert behaviour that already existed and were green on the first run; the exceptions are the gap probes listed above and the mutation proof in E01.
- Lane EB (`lane-eb-report.md`): "these are evidence tests of behaviour that already exists, so they were GREEN on first run"; the bite was checked per probe (controls in every file, fault-injection triggers, `it.fails` probes failing on the intended assertion). Four wrong expectations of its own were corrected without production changes. The round-2 atomicity assertions (`EB create atomicity rollback: ...`) pin the fault shape and the unchanged committed state in one statement; no production mutation was run for them.
- Lane EC (`lane-ec-report.md`): the first-wave tests were green on the first run (one run failed only in its own helper); the R1 gap probes are covered by H19; the R2 boundary pairs (32/33 types, 128/129 fields) are green characterization with the stated flip behaviour.
- Lane P: the toolbar spec `tests/e2e/phase-02-slice-10-rich-text-toolbar-real-route.spec.ts` (4 tests) and the surfaces spec (3 tests) passed on their first run (run-11: 4/4; surfaces 3/3).

## Open at the time of the lane reports

- Lane Q item 4, `[P2-S09-AC-268] later-only behaviour stays in S10 to S17` (`tests/contracts/phase-02-slice-09-pre-traceability.test.ts`): RED with 22 operations unowned (CMS-03B-15..20 and CMS-03C-06..21). The lane report records a text-only plan-ownership proposal and no GREEN. It is not a required package of this record.
- Lane P hand-off 1: `.github/workflows/ci.yml` `quality` job runs `pnpm test:e2e` without a Supabase stack, which the Slice 10 real-route specs now need.

## Canonical validation

Runs reported by the lanes and by the orchestrator (counts as reported at the time):

- `pnpm db:verify` PASS 2026-10-08 ~06:55Z (reported by the orchestrator): pgTAP 273 files / 10,710 tests, PostgREST 27 files / 456 tests, race runners, types.
- Lane H final (round 5): pgTAP `Files=272, Tests=10694` PASS; `pnpm db:races` "All 11 race runners passed" (014: 60, 010: 107, 011: 66, 012: 93, 013: 6); composition apispecs 19/19; `pnpm db:lint` exit 0 with 0 errors; `pnpm lint` and `pnpm type-check` exit 0.
- Lane N final: `vitest run apps/web packages/contracts apps/worker/src/cms-editorial` 517 files / 6007 tests; all Slice 10 real-route specs 30/30; `pnpm type-check`, eslint, prettier and `pnpm contracts:check` clean.
- Lane P: whole Slice 10 real-route set 34/34 (run-12); `pnpm test:e2e:functional` 109 passed; the official runner `pnpm test:e2e:s09-real` ran 137 tests, 135 passed, 2 failed (the two app defects fixed by N09).
- Lane Q: `vitest run tests/contracts tests/documentation-boundaries.test.ts` 167/170 files (the 3 failures were the receipts guards and Q04); `pnpm type-check`, `pnpm lint` and `pnpm format:check` exit 0.
- Lane EA (R2): main vitest 16,004 tests (the only failure the evidence guard awaiting receipts); pgTAP 75 files / 2,752 assertions; full PostgREST suite 27 files / 456 tests.
- Lane EC (R2): vitest 2,778 (2,777 passed); pgTAP 89 files / 3,552 assertions; type-check, eslint and prettier clean.
- Lane EB (R2): vitest 15,988 tests (15,986 passed, the evidence guard failing on stale receipts); pgTAP 272 files / 10,697 tests; Playwright 34/34 under project `real-route-chrome`; eslint, prettier and `pnpm type-check` clean.

`pnpm validate` runs: `pnpm contracts:check`, `pnpm db:types:check`, `pnpm progress:check`, `pnpm format:check`, `pnpm lint`, `pnpm type-check`, `pnpm test:coverage`, `pnpm test:evidence:s09`, `pnpm test:e2e`, `pnpm build`, `pnpm bundle:check`, `pnpm performance:smoke`. The Slice 10 evidence guard is part of `pnpm test:coverage`.

- canonical validate: `pnpm validate` exit 0 on 2026-10-08 (09:53 UTC) on the integration checkout — vitest coverage 1,384 files / 16,069 tests at 100% thresholds, Slice 09 evidence gate, functional Playwright 109 passed, real-route Playwright 141 passed, build, bundle budgets, local API p95 smoke 1.03 ms; preceded by `pnpm db:verify` PASS (pgTAP 273 files / 10,710; PostgREST 27 / 456; races; types). See Completion Signature in the Slice 10 tracker.
