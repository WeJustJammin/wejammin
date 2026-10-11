# Lane preview-projection report (2026-10-10)

Worktree `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`, branch `claude/phase2-slice11`. HEAD when the lane started:
`41a46135dc4f7440c812e40598aa271179214b83`; HEAD at the end: `f29941fd9252fc02c09742f5e62824b824a528ea` (the orchestrator
committed in between; the lane itself never ran add, commit, stash, checkout, reset or restore). Nothing of this lane is committed
except one row of `supabase/tests/phase_02_slice_11_races/README.md`, swept into `4b7fe540`.

Logs: `docs/handoffs/2026-10-10-claude-s11/lane-preview-projection-logs/` (named below). Raw TAP of every pgTAP run is in
`.lane-logs/alt-tap-*.tap` of the worktree. Run scripts (not committed): the scratchpad `pp/` folder
(`lane-race-pp.sh`, `lane-api-pp.sh`, `lane-lint-pp.sh`, `mutate-*.mjs`).

## Summary

| Item                           | RED (right reason)                                                                                                                                     | GREEN                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| AC-118 service-role takedown   | pgTAP: function absent (`not ok 10..21`, `ERROR: function platform_api.cms_takedown_preview_tokens(jsonb) does not exist` at `..._preview_takedown.sql:156`); API spec 9 failed / 1 passed; Worker: `Cannot find module` | pgTAP 43/43; API spec 10/10; Worker vitest 40/40 (adapter 33 + principals 7), the new module at 100% statements, branches, functions, lines |
| AC-116 `projectionState` read  | pgTAP: table absent (`not ok 9-15, 18-19` in `..._projection_state.sql`, `not ok 10` in `..._projection_state_reads.sql`, then `relation ... does not exist`) | pgTAP 53/53 and 18/18                                                                                                           |
| AC-092 owner advisory lock     | Mutation RED: lock removed from `cms_create_entry`'s E7 tail, runner stops at `L1: the parked first writer holds the owner settings advisory lock`      | Runner 16 `ok -` lines, exit 0                                                                                                  |

Regression on the real stacks (all green): 150 pgTAP files / 6,032 assertions (all of Slice 11 except the other lanes' recheck/checker/read-hint
files, the S09 p240/r*/sec2/evidence guards, the S10 write-path/ev guards), races 014/016/020 (29/8/12 `ok -`), API specs publish-lineage,
read-workflow, preview, preview-verifier (14 tests), `supabase db lint --level warning` (exit 0, no finding in the new functions).

## Finding 1 - AC-118: service-role takedown RPC

**Built** (`20261010165200_cms_takedown_preview_tokens.sql`): `platform_api.cms_takedown_preview_tokens(p_request jsonb) returns jsonb`,
SECURITY DEFINER, owner `wejammin_cms_definer`, `search_path = ''`, EXECUTE for `service_role` only (ACL exactly definer + service_role).
Request `{ reasonCode: "takedown", correlationId, entryId?, personId? }` (closed; at least one target; both = AND). The typed reason is the
literal `takedown`: `authority_lost` and `entry_unavailable` belong to the DB-internal producers and are `INVALID_REQUEST` here. It delegates to the
existing private seam `platform_private.cms_revoke_preview_tokens` (CAS: state `revoked`, `revoked_at`, `version + 1`, rows `FOR UPDATE`
ordered by id), answers `{ revokedTokens }`, is idempotent, restores the previous `app.cms_rpc` flag (SEC-2 D), and writes no audit/event/reservation
of its own (the seam's design: the caller owns the audit of the cause; Shard 16 per BE03b). `20261005017870` got a header/comment edit only (in place).

**Worker boundary (DEC-156)**: `apps/worker/src/cms-editorial-production-preview-takedown.ts` is the only module that names the RPC; it holds the strict
request/result Zod schemas, `createPreviewTakedown`, and `PreviewTakedownError` (`invalid_request | not_permitted | unavailable | invalid_response`, only
`unavailable` retryable). A takedown is never assumed: every failure throws, one attempt, the caller owns the retry (the RPC is idempotent). The architecture
test pins "no Worker module imports it until the Shard 16 caller exists", "the RPC name appears in this file only", "the browser app never names it".

**Proof map for the AC-118 text**
- `capability_snapshot_hash` = BE04c `actingContextVersion` from `cms_acting_context_version`: `..._preview_takedown.sql` "the minted token's capability_snapshot_hash is the BE04c
  actingContextVersion ..." on a REAL minted token, and the verifier accepting it with that same version; plus the existing `helpers_acting_context.sql` suite and `rpc_preview_mint.sql`.
- Minting person loses capability/membership => revoked: existing `phase_02_slice_11_helpers_invalidation.sql` (titles ending "revokes the creator's token on that entry", "ending the publisher's tenure revokes ...", "deactivating the editor's standing grant ... revokes the editor's token") and race 020 M3.
- Entry leaves `active` => revoked: existing `helpers_invalidation.sql` "... and revokes the entry's unexpired preview token", "an entry with no live review still has its tokens revoked when it leaves active (held)", race 020 M5.
- Version-set movement does not revoke: existing `helpers_invalidation.sql` "a dependency change revokes no preview token (a version-set movement does not revoke it)".
- Takedown RPC revokes, as `service_role`: new `..._preview_takedown.sql` (43 assertions: shape/ACL, 9 refusals incl. the two other reasons, by entry / person / both, idempotence, flag restore, no side effects, anon and authenticated `42501`, mint -> verify -> takedown -> verifier `revoked true`), new `tests/postgrest/phase-02-slice-11-preview-takedown.apispec.ts` (10 tests over Kong/PostgREST with the real Worker adapter and the real verifier; 401/403 `42501` for missing/anon/authenticated), Worker unit tests.

New titles: `logs/new-pgtap-titles.txt` (AC-tagged TAP titles). New API titles all start `[P2-S11-AC-118]`.

## Finding 2 - AC-116: `projectionState` read from `projection_consumer_state`

**BE04c section implemented**: "Database Schema / PostgreSQL model registry", row `ProjectionConsumerState` (`projection_consumer_state`) and the
vocabulary of "State machines, concurrency, and transaction rules" (building -> ready | blocked | failed_retryable -> active -> superseded | revoked); the
`degraded` mapping uses "Error Handling and Failure Recovery", row "Required projection consumer blocked/failed".

`20261010165000_cms_projection_consumer_state.sql`: `platform_private.projection_consumer_state` with the ten BE04c columns, the five checks, the unique
`(publication_id, projection_id, consumer)`, the two indexes, forced RLS with the one `cms_rpc_context_valid()` policy, no API-role grant, the
`cms_write_guard` trigger, definer SELECT only (Slice 15 delivery RPCs add their own write grants). `platform_private.cms_publication_projection_state(uuid)`:
STABLE definer, a read, never touches canonical state; refuses outside a CMS RPC context (`INTERNAL_ERROR`) instead of answering a false `pending`.
`20261010165100_cms_publication_projection_state_reads.sql` replaces exactly the one literal `'projectionState', 'pending',` in the installed bodies of
`cms_get_entry_workflow` (`listed.id`) and `cms_append_publication_lineage` (`new_id`), aborting unless it occurs exactly once and proving every other pg_proc
column, ACL and comment unchanged (the pinned/anchored bodies of `schedule_precision` and the lineage tests still pass).

**Mapping decisions (mine; please ratify or override - see "Decisions")**
1. `publication.id` (BE04c) = the publication VERSION ROW `platform_private.cms_publication_versions(id)` (BE03b: "for the row id"; the change event carries it as `publicationVersionId`).
2. Registered consumers = the eight members of BE04c's consumer check. Only each consumer's NEWEST row counts (updated_at, then row version, then id).
3. `degraded` = a registered consumer's newest row is `blocked` ("terminal": BE04c retries `failed_retryable` and pages after dead-letter; no attempt ceiling exists in the row).
   `converged` = all eight newest rows are `active`, `superseded` or `revoked` (past the pointer switch). Otherwise `pending` (none reported, one missing, building, ready, or retrying).
4. Physical home `platform_private.projection_consumer_state` (BE04c's exact name; private schema like every CMS table).

**BOUNDARY (not stubbed silently)**: `projection_id` has no foreign key. BE04c makes it FK `PublicationProjection.id`; that table's own FK targets
`delivery.route_manifest_version`, a BE04a table that no specification defines beyond its name and the IA deep dive's column list, and neither table exists.
Implementing `publication_projection` would have meant inventing the manifest table. The constraint is a one-line `ALTER TABLE ... ADD CONSTRAINT` for the
delivery slice (Slice 13 P2-S13-AC-164 names both schemas). Sentinel assertion: `..._projection_state.sql` "BOUNDARY sentinel: projection_id has no foreign key yet ...". **No GitHub issue was opened** (not mine to publish): please open the tracking issue and put its number in the migration's `TRACKING:` line.

Tests (`..._projection_state.sql` 53, `..._projection_state_reads.sql` 18): exact columns/constraints/indexes/RLS/grants/trigger; every constraint refused with its exact message;
ten publication-row scenarios (none reported, 7/8 active, eight ready, retrying + building, all active, mixed active/superseded/revoked, one blocked, recovered, converged-then-blocked,
tie on updated_at); the append reads the table (a test-only probe makes every consumer report the appended row at once and the answer becomes `converged`, not a literal);
a degraded row's lineage still appends (tombstone v2, audit row, exactly one event per row); the workflow read serves each publication its own state, writes nothing, and the source
of both functions no longer contains the literal.

## Finding 3 - AC-092: owner advisory lock on settings-snapshot ordinals

`supabase/tests/phase_02_slice_11_races/030-settings-snapshot-race.mjs`, registered in `infra/run-database-race-runners.mjs` (the gate test that lists every `.mjs` still holds), row added to the races README.
Real `cms_create_entry` in independent sessions; a gate trigger on the snapshot table parks a session right before its insert (it holds the owner lock there).
- L1 two FIRST writes, same values: the parked writer holds the owner lock key (`pg_locks`), the second waits on exactly that key, nothing is inserted meanwhile, both commit, ONE snapshot ordinal 1, no error.
- L2 two FIRST writes, different values: first = ordinal 1, second (waited) = previous maximum + 1 = 2, no error.
- L3 four simultaneous writers of four new values: gapless ordinals 3..6, none refused.
- L4 a session holding the owner's lock key blocks a write of a new value until released; nothing inserted meanwhile; then ordinal 7.

Honest limits: registry version 1 has no members, so every real snapshot is `[]` and an owner has only ordinal 1; to give two first writes different snapshots the runner replaces
`cms_publication_settings_effective_values` in the disposable database with a variant-carrying stand-in (`s11race.variant`; unset = the production result `[]`). The writers, tail,
lock, ordinal allocation, ON CONFLICT and the snapshot guards are production code. Without the lock the loser would be refused by `cms_settings_snapshot_guard` (`VALIDATION_FAILED`), not by a raw unique violation. The RED is a mutation (lock statement removed from `cms_create_entry` in the disposable DB, scratch script not committed): the runner fails at the first lock assertion.

## Changed existing tests (no title changed; old -> new expectation)

- `supabase/tests/phase_02_slice_09_r8_api_surface.sql`: classified set `r8a_supporting` + `cms_takedown_preview_tokens`; header comment "thirteen" -> "fourteen". Titles unchanged.
- `supabase/tests/phase_02_slice_10_ev_eb_publication_scope.sql`: three expected strings gain `platform_api.cms_takedown_preview_tokens` (assertion 1), `cms_takedown_preview_tokens` (assertion 2), `platform_private.cms_publication_projection_state` (assertion 3). Titles unchanged.
- `supabase/tests/phase_02_slice_09_sec2_all_schema_definer_rls.sql`: the pinned set of forced tables definer-owned functions name gains `platform_private.projection_consumer_state`. Title unchanged.
- `apps/worker/src/cms-editorial-principals.test.ts`: two new `it`s ("lets no Worker module import the preview takedown port until its Shard 16 caller exists" and the extended RPC-name / browser lists). No old assertion touched.
- Stale wording (still true, left alone because evidence ledgers cite these titles): `rpc_reads_workflow.sql` "... projectionState pending (never converged) [P2-S11-AC-050]" and `helpers_lineage.sql` "... projectionState pending (no Shard 04 consumer, DEC-158e) [P2-S11-AC-116]". "Never converged" is no longer a property of the code, only of a database with no consumer rows.

## Files

Created: `supabase/migrations/20261010165000_cms_projection_consumer_state.sql`, `..165100_cms_publication_projection_state_reads.sql`, `..165200_cms_takedown_preview_tokens.sql`;
`supabase/tests/phase_02_slice_11_preview_takedown.sql`, `..._projection_state.sql`, `..._projection_state_reads.sql`, `phase_02_slice_11_races/030-settings-snapshot-race.mjs`;
`tests/postgrest/phase-02-slice-11-preview-takedown.apispec.ts`; `apps/worker/src/cms-editorial-production-preview-takedown.ts` and `.test.ts`; the logs folder.
Edited (owned): `supabase/migrations/20261005017870_cms_revoke_preview_tokens.sql` (comments only), `infra/run-database-race-runners.mjs` (one line).
Edited (SHARED, minimal, all list/doc appends, report to the integrator): `supabase/tests/phase_02_slice_09_r8_api_surface.sql`, `supabase/tests/phase_02_slice_10_ev_eb_publication_scope.sql`,
`supabase/tests/phase_02_slice_09_sec2_all_schema_definer_rls.sql` (these three pin function/table inventories; a new API function and table cannot exist without them),
`apps/worker/src/cms-editorial-principals.test.ts` (DEC-156 module-boundary test), `supabase/migrations/README.md` (one bullet), `supabase/tests/phase_02_slice_11_rpc_preview/README.md` (one row, prettier re-aligned the table),
`supabase/tests/phase_02_slice_11_races/README.md` (one row; already committed in `4b7fe540`). No publication command migration (17700/17720/17740/162xxx) was edited: the lineage append (17590) and the workflow read (17900, patched by 154000) changed only through the forward migration 165100.

## Decisions to log (memory-capture; I did not touch `.memory/`)

- **DEC (new)**: `projectionState` derivation = degraded / converged / pending from the newest row of each of the eight registered BE04c consumers; `degraded` = `blocked`; `converged` = `active | superseded | revoked`; `publication.id` = the publication version row id. Options not taken: (B) `converged` = every registered consumer has any row at or past `ready`; (C) only the required route/render/menu/media consumers gate `converged`; (D) `degraded` also on `failed_retryable` with `attempts` above a ceiling (BE04c gives no ceiling). Recommendation: A as built; reversible by one forward function replacement. Needs the owner's ratification because it fixes what Slice 13/15 writers must record.
- **DEC-158(e) amendment**: "pending until a Shard 04 consumer reports; Slice 11 never reports converged" now means: Slice 11 reads the state and never WRITES a consumer row; `converged`/`degraded` appear once Shard 04 writes. The tracker text and the decision no longer disagree.
- **Pattern**: two `supabase db reset` runs at once (alt stack + main stack) collided once with `LegacyDbSetupError: error running container: exit 1`; my wrappers take `/tmp/wejammin-altdb.lock` around the reset. `lane-db.sh`/`lane-api.sh` do not. Consider adding it there.

## Open items for the integrator

1. Open the tracking issue for the `projection_id` boundary; add its number to the migration's `TRACKING:` line.
2. `pnpm db:types` (generated `packages/data-access/src/database.types.ts` is now stale: new table, one private and one API function). Not run (shared file).
3. Evidence ledger (`tests/contracts/phase-02-slice-11-evidence-ledger-*.ts`): AC-116 and AC-118 now have implementation + tests (limitation text of both can be dropped); AC-092 cites the 030 runner assertions (`L1:`..`L4:` titles in `logs/green-race-settings-snapshot.log`); AC-118 clause "through the service-role takedown RPC" cites the new pgTAP/API/Worker titles. The 030 runner prints no `[P2-S09-AC-nnn]` marker, so it produces no race receipt line (it does not need one).
4. `docs/runbooks/platform/cms-publication.md` does not mention the takedown RPC (it is not a BE03b-numbered operation and has no caller until Shard 16); add a short note when the caller lands.
5. A takedown writes no audit record of its own by design (see Finding 1). If the owner wants the RPC itself audited, it needs an actor/acting-party rule for a service principal; that is a product/architecture decision, not made here.
6. The idempotent replay of a publish returns the stored original resource, so a replay can show `pending` after the row later converged. That is the existing idempotency contract, not changed.
7. Two assertions pin the exact mapping of the append literal to `new_id`; if another lane renames that variable in `cms_append_publication_lineage`, migration 165100 aborts loudly (shape check), by design.
