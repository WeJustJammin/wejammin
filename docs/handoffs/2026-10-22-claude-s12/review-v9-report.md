# Review V9 report (race-fixes migrations, race-module test corrections, canonical evidence)

Status: FINAL (2026-10-23, reviewer V9). Independent: V9 did not author and had not reviewed any of this.
Read-only: no SQL, docker, supabase, pgTAP, race module or staged runner was run by the reviewer. Non-DB commands used: `sha256sum`,
`grep`, `diff`, `node -e` (pure string work on migration text), `prettier` on scratch copies of the originals, one Vitest run of two contract
files (output kept in scratch), eslint on three infra/test files. Every database fact below comes from the root logs listed under Evidence.
Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, branch `claude/phase2-slice12`, HEAD
`b16edb54a7a1b698ed8ca15b6085046d4270626e` (the Slice 12 tree is uncommitted; every file below is untracked or modified in the working tree).

## Verdicts (summary)

| Item | Verdict |
| --- | --- |
| Race-fixes migrations `20261023100000`, `20261023100100` (+ pgTAP) | KEEP as promoted. No forward migration is needed. One companion artifact outside the migrations MUST be regenerated before the local commit: `packages/data-access/src/database.types.ts` (V9-01, MAJOR). |
| Test correction 1: `dec194_sweep.race.mjs` scenario S9 (continuation) | ACCEPT |
| Test correction 2: `093-publication-race-effects.mjs` correlation oracle | ACCEPT |
| Test correction 3: governed fixture step-up grant context | ACCEPT |
| Test correction 4: `ok - <name>` receipts in `entry_default_template_lock/020-race.mjs` and `restore_relation_visibility/020-race.mjs` | ACCEPT |
| Test correction 5: canonical-mode opt-in (`canonical-mode.mjs`, runner, kits) | ACCEPT (see V9-03 for the one operational consequence) |
| Root's own pgTAP fix (two `proconfig::text` literals) | ACCEPT |

Counts by severity: BLOCKER 0, MAJOR 1, MINOR 3, NIT 4 (plus 4 informational notes that are not counted).

## Scope

### 1. Product fix (promoted into `supabase/migrations/`, uncommitted)

| File | Lines | SHA-256 |
| --- | --- | --- |
| supabase/migrations/20261023100000_cms_lock_revision_pattern_dependencies.sql | 110 | d105b23e1625f2d9fa7755003aeec52f5ee7a4ac37ef0bc61f3fcaf4235d9018 |
| supabase/migrations/20261023100100_cms_publication_pattern_dependency_locks.sql | 95 | e659f4210a5cc63390b900bb58bb3777af180b82eec54aadb9d747c7e7e61bf8 |
| supabase/tests/phase_02_slice_12_race_fixes_pattern_locks.sql | 82 | 7af462e1c0d97d1fab12339d39b8b06b73df09bba90b7917af841bbf8451a78d |

Both migration hashes equal the hashes in the staged-runner manifests of the PASS pgTAP run (`.lane-logs/alt-staged-race-fixes-071845-2924839.manifest`)
and in `docs/handoffs/2026-10-22-claude-s12/evidence/promotion-manifest-20261023.json` (`promoted_race_fixes`): the bytes that were tested are the
bytes that were promoted. `supabase/migrations/` holds 543 files = the 541 promoted + 2 WIP of that manifest; `supabase/migrations-wip/` is README-only.

### 2. Test corrections and canonical-mode plumbing

| File | SHA-256 |
| --- | --- |
| supabase/tests/phase_02_slice_12_dec194_sweep.race.mjs | a085dd3929db766a481b9b4afe5ee15f3829b047fe8c38ed6856c8e36933a8f7 |
| supabase/tests/phase_02_slice_12_dec193_pattern_currentness/093-publication-race-effects.mjs | 16b43401995c3b620b8dbecb888a7d127ec005485e2850f11b11256d3463073c |
| supabase/tests/phase_02_slice_12_governed_authority/governed-authority-kit.mjs | 993b1421fb92b2a7d6001f073477ed9f799eeaf366643e22fd106b9f4a67525f |
| supabase/tests/phase_02_slice_12_entry_default_template_lock/020-race.mjs | 68b8d4d180da116b9119f539ba748609ab51e4efc5c9dc5c33b4419ec519d6cd |
| supabase/tests/phase_02_slice_12_entry_default_template_lock/040-race-session.mjs | 0cbe810c0d1a02e5fe25ecd87022472be985bea69292b5c2efe882369a75662e |
| supabase/tests/phase_02_slice_12_restore_relation_visibility/020-race.mjs | ddd9a6cfaf7e31774874523ae0695b011b52ff7d4e5c8a84e48b69c7bb1a4c5e |
| supabase/tests/phase_02_slice_12_restore_relation_visibility/040-race-session.mjs | d83312b201a518c93cc95ca271c609c666b0d7e8dedeab54cccf03ff66bbe5e7 |
| supabase/tests/phase_02_slice_12_dec194_outer.race.mjs | a61fa09c9aa25f2813d52f97c7987e4b7900051232eed8a28ad809546da35d8b |
| supabase/tests/phase_02_slice_12_dec193_writer_boundaries/091-race-session-kit.mjs | bac30a9e9987bf74c720469bdb96b59a7c5c3b0f726089a8773a3a4b09d6f857 |
| supabase/tests/phase_02_slice_12_dec193_pattern_currentness/091-publication-race-session-kit.mjs | 1e0267dc2967a7695e563839b2817ed6f65eb1eb75d0a810ecd3002e16de8076 |
| infra/database-races/canonical-mode.mjs | 19df07eb9da7aff01d30c63867e893051077bfc7a6b6b7f6d0670859c02d84ad |
| infra/run-database-race-runners.mjs | 94626a93ae630f8bf2a817438e0517bb5842b025de348356a88865348b63873e |
| tests/contracts/phase-02-slice-12-race-canonical-mode.test.ts | 4f97b109ca8122bca9233168800052ca3beaa90b84ca52eb67af19c0b3c52ccc |

Unchanged by this cycle (hash equals the lane backup): `dec193_writer.race.mjs`, `dec199_publication.race.mjs`, `governed_authority.race.mjs`,
`dec194_sweep/091-race-session-kit.mjs`. The lane report's "Files" table carries delivery-time hashes; three current hashes differ from it (the sweep
module because of the follow-up 1 edit; the outer module and the contract test because of root's prettier rewrap), so V9 diffed everything against the pre-lane originals.

Method for the diffs: the pre-lane originals were extracted from the lane backup tars (`orig-20261023T103239Z.tar`, SHA-256
649533f4197d40d3d99c8c61623485c2161f7bb0d6da6a4d91b958f52de438f0, matches the lane report; `orig-093-20261023T112728Z.tar`, SHA-256
eafda67c16950e1343e49b7f2c3dd54e05231ab48b438b502377eef9afa399b2) into reviewer scratch
`/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/review_v9/`, formatted with the repo's prettier
settings (the originals of three files were not prettier-formatted) and diffed, so formatting churn does not hide substantive edits. Every file
hash in the lane report's "Before" column was reproduced from the tar.

### 3. Evidence

| File | SHA-256 |
| --- | --- |
| .lane-logs/canonical/races-s12-20261023T105902Z.log | 0ae139c47a862692f06c098a83d7fda72ef98fc01ea21d6d6a2b8487eba81d86 |
| .lane-logs/canonical/races-rerun-20261023T112122Z.log | e8a245efe204be1239d89c77892c1bcb57e30c0e4eb82e822fc4b707f8174fd2 |
| .lane-logs/canonical/race-dec199-20261023T112811Z.log | 55597539118b92c309b5d7b788b9a901c4950f6de5ac56f7d7996de6d6647dd4 |
| .lane-logs/alt-staged-race-fixes-071845-2924839.tap (newest: PASS, 15 files, 1,319 tests, 0 not ok) | 783fb6bbdddd2b88f0b33f128779ce4988ac7a51944f0dc9999bf15bfcd523a0 |
| .lane-logs/alt-staged-race-fixes-071618-2912018.tap (FAIL 2 of 8: expected literals, since fixed) | bfd3ea4fade19fdb2d5e98084616345f3f106cfcecd85625a36a0e207ceac87d |
| .lane-logs/alt-staged-race-fixes-071505-2904707.tap (NOTESTS: pg_prove could not detect the file source; harness) | a144013ede2317db61e64e9199533c2529564af7ded8c1b521b94fcdd3934148 |

## Findings

Severity: BLOCKER (must change before the work is relied on), MAJOR, MINOR, NIT.

| ID | Sev | Where | Evidence | Spec / rule | Proposed fix |
| --- | --- | --- | --- | --- | --- |
| V9-01 | MAJOR | packages/data-access/src/database.types.ts (generated, byte-pinned by `.prettierignore`) | The generator covers `platform_private` (`infra/sync-database-types.mjs:11`, schemas `public,platform_private,audit_private,platform_api,public_api`); the committed file lists the sibling private void lock helpers, which have no API grant either and appear with `Returns: undefined` (`cms_lock_entry_rows_shared` :11788, `cms_lock_governed_authority` :11792, `cms_lock_person_authority` :11800, `cms_lock_relation_target` :11808, `cms_lock_schema_version_shared` :11816, `cms_publication_lock_review` :12350) but has 0 occurrences of `cms_lock_revision_pattern_dependencies`. The file was last written 06:30:21 local (`.lane-logs/canonical/db-types-20261023T102905Z.log`; its applied chain ends at `20261022120000`); the two migrations were promoted at 07:12. `db:types:check` is the last step of `db:verify` (package.json:40) and a member of `validate` (:48) and compares byte for byte. Canonical `db:verify` #3 (`.lane-logs/canonical/db-verify-20261023T113036Z.log`) applies both migrations (lines 547-548) and was still in its `db:test` phase at 11:55Z, so its final `db:types:check` will fail with "Generated database types are stale" unless the file is regenerated before that step. | Repo gate "Generated database types match the migrated local schema" | After the final `pnpm db:reset`, run `pnpm db:types` and keep the regenerated file; the only expected delta is one new `platform_private` entry `cms_lock_revision_pattern_dependencies: { Args: { p_revision_id: string }; Returns: undefined }` between `cms_lock_relation_target` and `cms_lock_schema_version_shared`. Re-run `pnpm db:types:check`. No migration change. |
| V9-02 | MINOR | supabase/tests/phase_02_slice_12_race_fixes_pattern_locks.sql:1-5; dec199 race coverage | The behavioural proof covers CMS-03B-09 publish only (`dec199_publication.race.mjs` witnesses the waiter on the exact nested-V1 tuple and XID, tuple lock mode `RowShareLock` vs `AccessExclusiveLock`, and that no relation lock beyond AccessShare on `cms_content_type_versions` or `cms_editorial_reviews` is held yet: `092-publication-race-oracles.sqlinc:64-88`). CMS-03B-07 schedule and CMS-03B-20 execute are proven only by source-order text assertions on the two helpers (pgTAP 5 and 6) plus the unchanged S11 013/014/015 regression races (PASS in the rerun). Not witnessed anywhere: the root arm of the lock set (the race witnesses the nested child only), the exclusion of a nonnull `detached_tree` pin, mixed live/detached use, nested depth. The pgTAP header's reason ("a row lock is not observable from the locking transaction") is not accurate: the locker sees its own row locks in the `xmax` system column. | `.claude/rules/tdd-contract-first.md` (tests are the spec); lane report coverage statement "publication family 3/3 covered" | Add a single-session pgTAP over the existing `dec193_pattern_currentness` fixture (live root + nested, a canonical detached tree, a mixed pin): inside `savepoint s;` call the helper, then assert `select array_agg(id order by id) from platform_private.cms_pattern_versions where xmax = pg_current_xact_id()::xid` equals the expected ids (locks taken in a subtransaction carry the subxid, so earlier fixture locks do not pollute it), then `rollback to s`. Add schedule and execute variants to the dec199 race or one CMS-03B-20 witness. Not blocking the commit. |
| V9-03 | MINOR | supabase/tests/phase_02_slice_12_dec193_writer_boundaries/091-race-session-kit.mjs:30-40; ..._pattern_currentness/091-publication-race-session-kit.mjs:30-42; dec194_outer/sweep.race.mjs (unconditional assert above the mode branch) | Canonical mode keeps `assert.notEqual(root, '/home/rob/Projects/WeJammin')` for the four modules that had it in ALT mode. Consequence: a canonical `pnpm db:verify` or `pnpm db:races` run from the owner's own checkout `/home/rob/Projects/WeJammin` fails those four modules by design, although canonical mode targets the shared `supabase_db_wejammin` container whichever checkout starts it. The brief and the lane both require the assert to stay; this records the operational cost the lane left as "root decision" (lane report, Open items 2). | Brief item 2 (keep the protected-primary assert) | Decide before the merge: either keep (document that `db:verify` must be started from a worktree) or drop the assert in canonical mode only (the helper's `root` argument is optional, so this is one argument per kit). No change needed for the commit. |
| V9-04 | MINOR | supabase/migrations/20261023100000_cms_lock_revision_pattern_dependencies.sql:58-71 | The nested closure is computed once per live head row (`cross join lateral cms_pattern_nested_closure(v_owner_id, root.block_tree)`), not once per distinct pin; a revision with many placements of the same pattern repeats the recursive CTE per placement. Both arms also carry `instance.*` through the `distinct on` (including the `props` and `detached_tree` jsonb columns) although only path, version, id, state, `pattern_id`, `pattern_version` and `detached_tree is null` are used. The provider (`cms_pattern_active_digest`, 20261016044200) dedupes live pins via `seen_live`. Correct, only slower. | DEC-199 (provider dedupes live pins) | Optional: project only the used columns in the head sub-select and `select distinct head.pattern_id, head.pattern_version` before the lateral join (forward migration only if latency shows up; do not edit the promoted file). |
| V9-05 | NIT | supabase/tests/phase_02_slice_12_race_fixes_pattern_locks.sql:2 and the headers of dec193_writer, dec194_outer, dec194_sweep, dec199_publication, governed_authority `.race.mjs` | Stale prose: pgTAP line 2 still cites `supabase/migrations-wip/race-fixes/...` (root's STATE.md already tracks it); the module headers still say "Root-only ALT diagnostic", "authoring is UNRUN", "Root alone stages, locks, runs and resets the ALT" although all seven modules now run in the canonical gate. | `.claude/rules/extensibility.md` (READMEs and comments must not mislead) | Comment-only edits in the next test pass. |
| V9-06 | NIT | supabase/tests/phase_02_slice_12_dec193_pattern_currentness/092-publication-race-oracles.sqlinc:44-47 | `s12pr_facts` selects `audits` and `events` by `(item->'publish'->>'correlationId')::uuid`, the top-level key the product never reads (the same error class as the corrected JS oracle). No JS assertion consumes those two fields (`093-publication-race-effects.mjs` and the race module use none of `facts.audits/events`), so they are dead and would silently return `[]` if anyone started asserting on them. | cfg_correlation reads `context.correlationId` (20260901070000:496-509) | Delete the two fields or key them by `item->'publish'->'context'->>'correlationId'`. |
| V9-07 | NIT | supabase/migrations/20261023100100_cms_publication_pattern_dependency_locks.sql:23-25; supabase/migrations/README.md:1052 | The `spec` array carries a third element (`'p_revision_id'`) that is never read; the README section repeats the boilerplate sentence about `20261020203606` / `--include-all`, which does not apply to two migrations newer than every other file. Promoted files are immutable, so this is recorded only. | | None; do not edit the promoted file. README sentence may be trimmed. |
| V9-08 | NIT | .memory/wiki/specs/be/03b-editorial-workflow-publication.md:1734-1744 (global lock-order table) | The 03b table names who takes position 3 (activation, review invalidation, initial entry creation). The three 03b publication commands now take position 3 too, but the only statement is the BE03c row (03c:1506) and its changelog row (03c:1902). A reader of 03b alone does not learn it. | DEC-224; propagate-decision | One sentence or a pointer in the 03b table's "Taken by" column. |

### Informational notes (not counted)

- N-1 Evidence not yet on the final chain: root's canonical `db:verify` #3 is the first full run (pgTAP, API tests, all 28 race modules, types check) with both migrations in the chain. Before it, only 15 pgTAP files plus the S11 races 013/014/015, dec194_sweep and dec199 ran on the new chain. S11 016 and 032 (they use the publication kit) and the five S12 modules that passed in run 1 (they never call the amended helpers) have not been rerun on it; `db:verify` #3 covers them.
- N-2 `governed_authority.race.mjs` has no ALT/canonical gate at all (its `governed-authority-processes.mjs:6-9` resolves the S10 chain, default `supabase_db_wejammin`): a by-hand run targets the shared database. Pre-existing, not introduced here.
- N-3 Open product items that DEC-224 deliberately leaves, unchanged by this review: no position-3 pattern lock in CMS-03B-05 submit and CMS-03B-06 decision (fail-safe, see 1.4); no block-definition row locks (plan step 2 of `lane-codex-dec199-lock-dependency-plan-2026-10-16.md` proposed them; DEC-224 and the BE03c row name PatternVersion rows only); per the lane report and plan steps 5-6, nested pins are not recorded in the review dependency index (V9 confirmed only that the manifest `patterns` group names the direct pins, `20261005017560:15,225-234`, and did not re-trace the later DEC-193 manifest migrations), so the event-driven recheck would not invalidate a review that reaches a changed pattern only through a nested pin; the publication gate (provider plus the new lock) still refuses it.
- N-4 The DEC-224 raw record is in `.memory/raw/events/2026-10-23.jsonl` (id `dec-224`), not `2026-10-22.jsonl` as the review prompt says. `.memory/wiki/decisions.md` stops at DEC-203 (compile deliberately not run), so BE03c cites a decision that exists only as a raw record; this is the repo-wide state for DEC-204 to DEC-224, not specific to this change.

## 1. Product fix: detailed review

### 1.1 Helper `platform_private.cms_lock_revision_pattern_dependencies(uuid)` (20261023100000)

Checks of the brief, in order.

| Check | Result | Evidence |
| --- | --- | --- |
| Locks exactly the live roots | PASS | Arm 1 (:46-56): newest row per `path collate "C"` (`distinct on ... order by path, version desc, id desc`, selected BEFORE the state filter), then `state in ('draft','active','pending_diff')`, `pattern_id is not null`, `detached_tree is null`, joined to the root by `(owner_id of the revision, pattern_id, version)`. This is the head selection of `cms_revision_effective_composition` (20261016042300:6-19) and of the provider (`cms_pattern_active_digest` `latest` CTE and `for item` loop, 20261016044200:41-47 and :61-73) clause for clause. |
| Locks the nested versions reached through live uses | PASS | Arm 2 (:58-71): `cms_pattern_nested_closure(owner, root.block_tree)` (20261014020300:25-51), `nested_row_id is not null`. The provider reads nested state through `cms_governed_pattern_closure(owner, root_row.block_tree)` (depth <= 9) and the type-containment graph through `cms_pattern_refs` (depth < 9); the helper's closure reaches the same references (`cms_pattern_refs` = kind `pattern` nodes of the validated forest, 20261014020000:167-175; `cms_governed_pattern_closure` iterates the same `kind = 'pattern'` nodes) to depth 10, so the lock set is a superset of every row the provider reads. Pattern nodes carry no children (exact keys `kind,key,patternId,patternVersion`, 20261014020000:82-90), so the two traversals cannot diverge on a valid forest. |
| Mode and order | PASS | `order by locked.id for share` at the top query level (:72-73). A locking clause is allowed here because the UNION is inside the `IN (...)` sub-select; LockRows sits above the Sort, so rows are locked in ascending id (same idiom as `cms_insert_pattern_instance`, 20261014110300:139-148, and `cms_apply_pattern_update`, 20261014140600:161). FOR SHARE (not KEY SHARE) is required: the activation `UPDATE` is a NO KEY UPDATE, which KEY SHARE would not block. |
| None for a nonnull `detached_tree` | PASS | `head.detached_tree is null` in both arms (:56, :70). The provider's canonical branch reads only `root_pattern.content_hash` (immutable) and the local tree's own digest (20261016044200:108-120), so nothing mutable is reopened. Mixed use keeps the live pin and therefore locks (DEC-199 "Detached boundary": `decisions.md:5391+`). |
| Missing revision | PASS | `select ... into v_owner_id; if not found then return` (:36-41); the caller raises its own NOT_FOUND before the call (20261005017700:185-190 in `cms_publication_lock_review`; `cms_schedule_lock_review` the same, 20261005017740:41-56). |
| Revision scope equals the judged revision | PASS | `cms_publication_lock_review` returns the review of `p_revision_id` (`review_item.revision_id = p_revision_id`), `cms_schedule_lock_review` the review `p_review_id` with `revision_id = p_revision_id`; both then call `cms_frozen_dependencies_status(review_row.revision_id, ...)`. Same id. |
| Security | PASS | SECURITY DEFINER, `set search_path = ''`, every relation and function schema-qualified, no dynamic SQL, no writes, no audit/outbox/log payload (:26-31). Owner set through the repo's `grant create` / `alter function ... owner to wejammin_cms_definer` / `revoke create` sequence (:84-86); `revoke all ... from public, anon, authenticated, service_role` (:87-88); a `do $guard$` asserts owner, SECURITY DEFINER, volatility, `proconfig = {search_path=""}`, plpgsql, and that anon, authenticated and service_role cannot execute (:90-108). pgTAP 1-3 re-assert owner, role ACLs and that PUBLIC holds no EXECUTE (acl `grantee = 0` count 0). |
| No privilege change | PASS | The only grant (:81-82, `select` on `cms_entry_revisions`, `cms_composition_instances`, `cms_pattern_versions` to the definer) already existed (20261014110300:258-260). FOR SHARE needs UPDATE on `cms_pattern_versions`, which the definer holds (20261014070000 `grant select, update`). The race runs under the real definer and the helper executes. |
| Promotability | PASS | Timestamps `20261023100000`/`100100` follow the last promoted file (`20261022120000`) and are unique; no promoted file edited (`git diff --name-only HEAD -- supabase/migrations` = README only); forward-only; no backfill; no NOT NULL or constraint work; 110 and 95 lines (limit 300); both set `lock_timeout 5s` / `statement_timeout 30s` like the repo's patch migrations. |
| Placeholders | PASS | No TODO, FIXME or `not implemented` in any in-scope file. |

Residual cost note: V9-04 (closure per head row).

### 1.2 Anchored patch of the two lock-review helpers (20261023100100)

Re-derived offline: the anchor text `  -- Position 4 (DEC-157): the content-type version before the review row.\n` occurs exactly once in the live body of
`cms_publication_lock_review(uuid)` (20261005017700:191) and exactly once in `cms_schedule_lock_review(uuid,uuid)` (20261005017740:57). Applying the
migration's replacement to each body (a Node script over the file text) adds exactly three lines (two comment lines and
`perform platform_private.cms_lock_revision_pattern_dependencies(p_revision_id);`) and the inverse replacement returns the original byte for byte.
Those two files hold the newest definitions of the helpers: `grep` finds no other migration that names either function, and none of the anchored-patch
migrations that amended the callers (`20261010140000`, `151000`, `153000`, `162100`, `162200`, `170100`, ...) touches either helper.

The migration's own guards cover what an offline read cannot: baseline attributes of both functions (owner, SECURITY DEFINER, volatile,
`search_path=""`, argument count, return type `platform_private.cms_editorial_reviews`, plpgsql), refusal when already amended, the
definition-contains-source-once check, anchor uniqueness, exact inverse, and after the `CREATE OR REPLACE` that `to_jsonb(pg_proc row) - 'prosrc'`
is identical before and after (this includes `proowner`, `proacl`, `proconfig`, `prosecdef`, `provolatile`), the comment is unchanged and the call
precedes the content-type lock which precedes the review lock. The migration applied cleanly on four separate fresh resets (the pgTAP stage reset, the
rerun, the dec199 rerun and canonical `db:verify` #3: `Applying migration 20261023100100...` in each log), so every guard held on the real chain; the pgTAP run proves the final state
(assertions 5-8: order in both helpers, attributes of the amended publication helper, the executor helper still not executable by service_role).

Call-site order, verified in the final bodies (original file lines; the later anchored patches only add the lineage-head observation, the entry
lifecycle read and the cancelled-result branch and do not move any dependency judgement above the lock helper):

| Command | Locks before the helper | Helper call | First dependency judgement |
| --- | --- | --- | --- |
| CMS-03B-07 `cms_schedule_publication` | entry S + authority S (`cms_publication_lock_authority` :187), reservation | 20261005017710:202 | `cms_frozen_dependencies_status` :235, preflight :243 |
| CMS-03B-09 `cms_publish_revision` | same (`cms_publication_lock_authority` :160) | 20261005017720:175 | status :188, preflight :196 |
| CMS-03B-20 `cms_execute_publication_schedule` | entry S, creator authority (:151-157) | 20261005017740:158, then schedule row X | status :185, `cms_evaluate_preflight` :199 |

The idempotency replay returns before the helper in schedule and publish, and a completed schedule returns before it in the executor, so exact
replays are unaffected. The helper is called at the top level of each private command body (no inner `begin ... exception` block encloses it); the only
enclosing exception block is the `platform_api` wrapper's (20261005017710:313, 17720:247, 17740:311), which converts `deadlock_detected` and
`lock_not_available` into the typed 409 CONFLICT and otherwise ends with the row locks retained by the committed subtransaction.

### 1.3 Deadlock safety and global-order acyclicity

New wait edges: a publication command P that holds {entry row FOR SHARE (position 0), authority rows FOR SHARE (position 1), its idempotency
reservation} now waits at position 3 for any transaction H that holds a conflicting row lock (FOR UPDATE / NO KEY UPDATE) on a pattern row of
its set. A cycle needs H, directly or through others, to wait for something P holds. Every transaction that locks or updates PatternVersion rows,
by source:

| Writer | Pattern-row modes | Takes before the pattern rows | Takes after | Can it wait on P's set? |
| --- | --- | --- | --- | --- |
| CMS-03C-09 activate / schedule (`cms_activate_governed_subject` 20261014070400; `cms_governed_lock_lineage_active`, `cms_governed_apply_activation` 20261014070000/070200) | subject X, lineage active row X, graph S | authority S (pos 1), reservation | content-type S, governed review X, lineage advisory (last), audit/outbox inserts | No: needs no entry, editorial-review or authority X/NKU |
| CMS-03C-09 retire (20261014160100) | subject (the active row) X | same | same | No |
| CMS-03C-19 executor (20261014070600; claim = `FOR UPDATE SKIP LOCKED`) | subject X, graph S | schedule creator's authority S | governed review X, governed schedule X, advisory | No |
| CMS-03C-06 submit, CMS-03C-07/08 decision and assignment, review close (20261013300800/820, 20261014010000/010100/010200) | subject X, graph S | authority S | content-type S, governed review X, assignments | No |
| governed recheck job and person invalidation (20261022030100/030200) | subject X | for person invalidation: the revoker's own authority X (pos 1) | governed review X | No: the revoker's authority X is taken before any pattern lock, so it either already conflicts with P's authority S at position 1 (neither holds a pattern lock yet) or does not overlap |
| CMS-03C-12 `cms_create_pattern_version` (20261014020400) | parent (latest) row X, nested S | designer grant S | content-type S, insert | No |
| CMS-03C-02 placement (20261014110300, 20261016040400, 20261022080300), CMS-03C-15 apply (20261014140600, one entry), linked scan (20261022110100, one iteration per entry in ascending entry id), restore lock plan (20261017044510) | S only (ascending id) | entry X at position 0 (the scan: per entry) | content-type S, editorial review X | S does not conflict with P's S. They conflict with P at the entry row (X vs S) before either holds a pattern lock, so one waits at position 0 holding nothing (the scan: see the note below the table) |
| editorial dependency recheck job (20261010164100), editorial submit / decision (20261005017640, 20261005017630) | none (plain reads for status) | | editorial review X (position 5) | cannot join a cycle through pattern rows |

No writer that holds a pattern row in a mode that conflicts with P's (X / NKU) takes an entry, authority, editorial-review or idempotency lock in a
conflicting mode afterwards; the person revocation holds its authority X before any pattern lock. The one transaction that takes an entry lock after a
pattern lock is the linked-update scan, which loops over its entries in ascending id inside one run (20261022110100:110-116; BE03c row
`cms.pattern.linked_update_scan`): from the second entry on it takes entry X while holding the previous iteration's pattern S, content-type S and
review X. It holds pattern rows only in S mode, so it can wait on P (at an entry row) but P never waits on it: P's remaining needs (pattern S,
content-type S, its own revision's review row) are not held by the scan in a conflicting mode, and the scan's own waiters (a later activation wanting
X on the version the scan holds S on) wait on the scan and on P, never the reverse. Hence no wait path leads from H back to P, and the global order
0 < 1 < 2 < 3 < 4 < 5 < (6 schedule) < (7 lineage advisory) stays acyclic with the new position-3 lock in the publication commands (the helper is
called after positions 0-1 and before 4-5 in all three; the executor takes its schedule row (position 6) after it). Row-level S locks do not
conflict with each other, so concurrent publications and the S-only writers never block one another. The pivotal pair
(activation X on the lineage active row versus P's S on the same row) is witnessed by the race in both orders. The one non-ascending X
sequence (activation: subject, then lineage active row) cannot form a cycle with P because the subject is `approved`/`blocked`/`scheduled`, never
active, and so is never a live pin of any composition (placement re-reads `active` under the lock: 20261014110300:148-150).
Residual deadlocks (a lock timeout or `deadlock_detected` inside the helper) surface as the typed 409 CONFLICT of the wrappers with nothing committed (BE03b rule 6; BE03c rule 4).

### 1.4 Submit and decision (deliberately unchanged)

CMS-03B-05 submit and CMS-03B-06 decision take no PatternVersion row lock (they only run the status read after the schema position:
20261005017630:188-214, submit :182-185). They therefore never join the new P -> H edge and cannot form a cycle with publication; their relative
order with P on entry S, authority S, content-type S and the review row is unchanged by this change. They remain exposed to the same
TOCTOU the lock closes (a review can be approved against a pin whose successor activation is in flight), which is fail-safe as DEC-224 states:
publication, schedule and execute now serialize with the activation and refuse or invalidate a stale pin through the provider, so a stale pin is
never published. Tracked as N-3.

### 1.5 Spec conformance

- BE03c "Slice 12 lock order" row (03c:1506): "revision's live pattern dependencies ... FOR SHARE in ascending id ... a row that carries a nonnull `detached_tree` pins none" = helper arms 1 and 2 with the `detached_tree is null` predicate. Changelog row 03c:1902. CMS-03B ids in the row (07 schedule, 09 publish, 20 execute) match the three commands patched.
- BE03b "Write-path lock order and authority fencing" (03b:1734-1747): position 3 before 4 and 5, "a command may skip a position but never acquires an earlier position after a later one": satisfied by the three publication commands (the linked scan's per-entry loop is a pre-existing, spec'd exception, see 1.3). Pointer gap recorded as V9-08.
- DEC-199 (`decisions.md:5391`): live pins reopen nested state, mixed use stays live, nonnull canonical `detached_tree` never reopens provenance: matched exactly by the predicate. DEC-224 (raw record `dec-224`, option A): matched; invented behaviour: none (no new refusal, no new token, no new authority path); missing behaviour: only what DEC-224 explicitly leaves (N-3).

## 2. Test corrections

The lane report lists the sweep and 093 corrections under `## Test corrections` and the `ok -` lines and step-up context in its delivery
notes; root's literal fix is in the cumulative addendum. All were judged against the spec and for loss of proof.

### 2.1 `dec194_sweep.race.mjs` scenario S9 (continuation first): ACCEPT

Diff (formatting normalized): removed `await blocked('recovery waits on continuation-held party advisory mutex', recovery, continuation, true);`; added (a) a
`pg_locks` assertion that the continuation backend holds the advisory key `hashtextextended('cms.taxonomy.merge.enqueue:' || party, 0)`
(`classid`/`objid` split of the bigint, `objsubid = 1`, `ExclusiveLock`, granted), (b) `await ready(recovery)` plus
`assert.ok(!continuation.settled)`, (c) an `ok - ` line. Every later S9 assertion (`{ requested: 0 }`, exactly one continuation Job, no recovery
Job, `association(Q) = 'none'`) is unchanged.

Premise verification:
- The claim is a committed `running` Job: `claimed(ids)` -> `stage` -> `query(body, true)` = fixture transaction + `commit;`
  (`091-race-session-kit.mjs:106-110`); `s12dcr_claim` calls the real `platform_api.claim_job` for the party (`090-race-fixture.sqlinc:120-128`).
- The sweep's routing scan excludes every party that has a `queued` or `running` Job of the type before it takes any mutex
  (`20261014190050:53-69`, "R2-03"; header lines 15-18). BE03c "Merge convergence recovery" (03c:1552): "has no `queued` or `running` Job of the type".
  So a sweep that starts after the claim completes at once with `{ requested: 0 }`; the old `blocked(...)` could never be satisfied. The first
  root run shows exactly that failure (`races-s12-...log:1700-1727`: "producer statement completed while the required blocker still held its transaction").
- The continuation does take the mutex at the specified position, after position 1 and before the claim reread (`20261014190040:43-44`;
  `cms_taxonomy_merge_enqueue_lock` = `pg_advisory_xact_lock(hashtextextended('cms.taxonomy.merge.enqueue:' || party::text, 0))`,
  `20261014190020:50-52`). The new `pg_locks` assertion pins that order (it would fail if the continuation took the mutex after the receipt).

Coverage: not weakened. The deleted wait is not constructible for a valid continuation (its own running Job makes the party ineligible
before the mutex). Mutex exclusion of a sweep against the other producers stays proven by S1 (ordinary producer waits on the sweep-held mutex),
S2 (stale continuation waits on it, then CONFLICT), S3-S8 (sweep waits on an ordinary producer's mutex and re-reads the live Job) and S10-S12
(a valid continuation waits on an ordinary producer). The new assertions are not vacuous: the sweep session runs with `lock_timeout=15000`, so a
regression that makes the sweep block on the mutex fails within 15 s with the session's stderr, and `!continuation.settled` fails if the
continuation had ended. The rerun log shows both new receipts (`races-rerun-...log:1165-1166`).

### 2.2 `093-publication-race-effects.mjs` correlation oracle: ACCEPT

Diff: lines 118-119 (`item.activation.correlationId` -> `item.activation.context.correlationId`), 164-165 and 267 (`item.publish.correlationId` -> `item.publish.context.correlationId`),
one comment line. The compared values are unchanged (audit row `correlation_id`, outbox event `correlation_id`, evidence `correlation_id`); only the
expected id changed.

Verification: `cms_correlation(p_request)` = `cfg_correlation`, which reads `p_request->'context'->>'correlationId'` first
(`cfg_context_value`, `20260901070000:350-359`), then the `app.correlation_id` GUC, else a fresh uuid (`:496-509`). `cms_activate_governed_subject`
(`20261014070400:68`) and `cms_publish_revision` (`20261005017720:77`) call it and pass the result to the audit, the event and the accessibility
evidence. The fixture sends a random top-level `correlationId` and a `context` from `s09d_context`, which carries its own random `correlationId`
(`00-helpers.sqlinc:98-109`; fixture `090-publication-race-fixture.sqlinc:106,187`), so the old expected value was an id the product never uses.
The executed requests are the stored objects (`item.activation`; `s12pr_request` = stored `item.publish` plus evidence), so `context.correlationId`
is the id the product saw. Strength is unchanged (an audit that ignored the request context would still fail the assertion). No other consumer of
the top-level key remains in the JS (V9-06 notes the dead SQL fields).

### 2.3 Governed fixture step-up grant context: ACCEPT

`governed-authority-kit.mjs`: new `stepUpContext(ids)` = `context(ids)` + `stepUpVerified: true` + `stepUpAt: now - 60 s`, used only for the
`cms_grant_capability` fixture command. The command requires the recent binding-bound proof (`cms_review_binding(..., p_recent=true)`:
`context.stepUpVerified === true`, `stepUpAt` within -30 s..600 s; `20261002188000`, grant `20261002141000`), and the first run failed with
`P0001: STEP_UP_REQUIRED` without it. The same fields are what the chain and review kits send (`s09d_context` :104). The grant is created through
the real command: no trigger is disabled, no row is inserted (scan of the governed-authority tree: no `disable trigger`, `session_replication_role`
or direct active-row insert; the vitest guard asserts the same on the kit). The module then passed with 15 receipts including "revoker blocked BY
writer while writer is blocked BY subject holder", the capability_missing refusal and the grant restore. The revocation seam
(`grantRevokeScript`, a direct `update ... set active` as the administrative fixture so the AFTER UPDATE trigger path runs) is pre-existing and
unchanged by this cycle (N-2 notes the module's ungated target).

### 2.4 `ok - <name>` receipts in the two node:test modules: ACCEPT

Additions only. `entry_default_template_lock/020-race.mjs`: `console.log(`ok - ${child.name}`)` after the awaited body of each of the three subtests
(control, order A, order B), i.e. only when no assertion threw. `restore_relation_visibility/020-race.mjs`: after the owned cleanup and after
`if (primary) throw primary;`, i.e. only when the scenario and its cleanup both succeeded (4 scenarios). The gate counts `line.startsWith('ok - ')`
(`infra/run-database-race-runners.mjs`, `countOkLines`, `runnerVerdict`: exit 0 and at least one), and node:test's own TAP lines are `ok 1 - name`,
which never match, so without the additions a green module would fail the gate with `ok=0`. First-run receipts: entry 3, restore 4. No assertion,
timeout or scenario was removed or altered (diff against the formatted originals).

### 2.5 Canonical-mode opt-in: ACCEPT

- Trigger: `isCanonicalRace` is true only for `WEJAMMIN_CANONICAL_RACE === '1'` (`canonical-mode.mjs:20-21`). The only setter in the repo is
  `raceEnvironment` in the gate (`run-database-race-runners.mjs:160-163`, applied to the spawn at :192); the other occurrences are comments,
  README text and tests. `'0'`, `'true'`, `''`, `' 1'` do not select it (contract test). A module started by hand keeps its explicit ALT release asserts
  unchanged (the ALT asserts moved verbatim into the `else` branch, diff-verified for sweep and outer).
- Mutual exclusion: canonical mode plus any exported ALT release variable of that module is a loud failure (`assertCanonicalTarget`, `altEnvNames`;
  covered by the contract test for all four kit/session groups).
- Target: `canonicalContainer()` is `S10_RACE_DB_CONTAINER ?? AC217_DB_CONTAINER ?? 'supabase_db_wejammin'`, identical to `race-kit.mjs:26-29`, and
  must match `^supabase_db_[a-z0-9_-]+$`. The sweep and outer modules additionally assert their kit container equals it.
- Protected primary: the unconditional `assert.notEqual(root, '/home/rob/Projects/WeJammin')` stays above the branch in outer and sweep, and
  `assertCanonicalTarget({ root })` repeats it in the writer and publication kits. The entry-default and restore modules never had a primary
  assert in ALT mode, so none was dropped. Operational consequence: V9-03.
- Verified by me: Vitest `phase-02-slice-12-race-canonical-mode.test.ts` (24) + `phase-02-slice-09-race-runner-gate.test.ts` (12) = 36/36 PASS (scratch
  output `review_v9/vitest-canonical.out`, exit 0); eslint `--max-warnings 0` and `prettier --check` clean on the two infra files and the test.
- Slice 9-11 modules ignore the variable (the runner now sets it for all 28, which is harmless).

### 2.6 Root's pgTAP literals: ACCEPT

`race_fixes_pattern_locks.sql` lines 18 and 71: `{search_path=""}` -> `{"search_path=\"\""}` (diff against root's `.orig`). PostgreSQL quotes an array element that
contains a double quote, so the second form is the exact `proconfig::text`; both are exact-string comparisons, so strictness is unchanged. The
third run passes all 8.

## 3. Evidence review

| Run | Result | Verdict of V9 |
| --- | --- | --- |
| races-s12-20261023T105902Z (chain without the race fixes) | dec193_writer 4 ok, dec194_outer 5, entry_default 3, governed_authority 15, restore 4: EXIT 0. dec194_sweep: EXIT 1 at S9 (premise). dec199: EXIT 1, publish returned `00000` with the activation uncommitted (product gap). | Consistent with the lane's diagnosis. Both failures were classified (test premise; real product gap) by reading, not by editing until green. |
| alt-staged-race-fixes 071505 / 071618 / 071845 | NOTESTS (harness: file not found by pg_prove) / FAIL 2 of 8 (literals) / PASS 15 files, 1,319 tests | Failures were harness and test-literal errors, correctly classified; the PASS run contains the race-fixes file plus `dec193_pattern_currentness`, `criteria_publish_gates`, 11 `rpc_publication*` files and `publication_lineage_schema`. Staged migration hashes equal the promoted files. |
| races-rerun-20261023T112122Z (fresh `db:reset` before each, chain with both migrations) | dec199: the wait now happens (`ok - change-first: exact nested-V1 tuple/XID witness`), then the correlation oracle fails (test); dec194_sweep 27 ok EXIT 0 (includes both new S9 receipts); S11 013: 22, 014: 35, 015: 8, all EXIT 0 | Product fix effective; S11 schedule/execute races show no regression. |
| race-dec199-20261023T112811Z (after the 093 fix) | 4 ok (both orders: exact tuple/XID witness; commit order, full effects, unchanged same-key replay), EXIT 0 | PASS. The witness requires the waiter to hold the tuple lock of the exact nested row on the activator's XID and to hold no relation lock beyond AccessShare on the content-type and editorial-review tables, which proves the lock sits before positions 4-5. |

Not covered by any run to date: see N-1.

## 4. Verdicts

- Lane race-fixes (product): KEEP. The two migrations are correct against DEC-199, DEC-224, BE03c and BE03b, safe on a populated database, free of
  privilege change, and the lock order stays acyclic; no forward migration is required. Required companion before the local commit: V9-01
  (`pnpm db:types`). Recommended follow-ups: V9-02 (lock-set membership test, schedule/execute witness), V9-03 decision.
- Lane races-canonical (test corrections): ACCEPT all six items (sweep S9, 093 oracle, step-up grant context, `ok -` receipts, canonical-mode
  opt-in, root's literals). No correction weakens proof; V9-05, V9-06 are comment/dead-field cleanups.
- Counts: BLOCKER 0, MAJOR 1 (V9-01), MINOR 3 (V9-02, V9-03, V9-04), NIT 4 (V9-05 to V9-08).

## 5. Requests to root

1. Before the local commit: after the final `pnpm db:reset` (the end of `db:verify` leaves a reset database), run `pnpm db:types`, then `pnpm db:types:check`;
   expect exactly one new `platform_private` function entry (V9-01). If `db:verify` #3 stops at `db:types:check`, this is the cause.
2. Decide V9-03 (protected-primary assert in canonical mode) before the merge to the owner's checkout.
3. Queue V9-02 (single-session lock-set membership pgTAP; schedule and execute witnesses) for the next test pass; none of it blocks the commit.
4. No change to the two promoted migrations is requested; do not edit them (V9-04, V9-07 are recorded only).
