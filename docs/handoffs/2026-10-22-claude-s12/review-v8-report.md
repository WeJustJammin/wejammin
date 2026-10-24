# Review V8 — lane `claude_s12_linked_scan`, V6 follow-ups (P2-S12-AC-212, AC-213)

Reviewer V8 (independent, read-only). Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, HEAD
`b16edb54a7a1b698ed8ca15b6085046d4270626e`. Review time 2026-10-23 05:39-06:10Z. I edited no repository file except this report. I ran no
SQL, docker, supabase, pgTAP, race module or staged runner; every database fact below is read from the lane's final TAP, reset log and
manifest (hash-verified against the current bytes) or from the source. I ran read-only Vitest, ESLint, Prettier `--check` and
`tsc --noEmit`; all outputs, my offline anchor emulation and a scratch mutation copy of the Worker sources live under
`/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/review_v8/`.

## Status

**VERDICT: PROMOTE** for lane `claude_s12_linked_scan` (`supabase/migrations-wip/linked-scan/20261022110000`, `110050`, `110100`, `110200`,
`110300`; promote all five together, with or after batch 1: the stamps order them). **BLOCKER 0, MAJOR 0, MINOR 1, NIT 5.**

Nothing has to change before the files freeze. Three cheap polish items exist only while the files are unpromoted (V8-02 helper comment, V8-03
vestigial closure entry, V8-06 closure guard); the other three findings (V8-01, V8-04, V8-05) are test strengthening that can follow promotion
because tests are not immutable. The V6-01 decision (one row writer) is implemented correctly; the anchors match the only definer of the helper;
no later patch anchors on the helper; the new tests can each fail.

## Scope (files and SHA-256 at review time; "V6" = the bytes reviewed in review V6)

| Path | Lines | SHA-256 | Since V6 |
| --- | --- | --- | --- |
| `supabase/migrations-wip/linked-scan/20261022110000_cms_linked_scan_request.sql` | 112 | `97dcfdd1d815e3f052b517a5ab04bfe043f5a162ed097a9b8c60d9fedec9eab0` | unchanged |
| `supabase/migrations-wip/linked-scan/20261022110050_cms_pattern_update_next_row_pending.sql` | 111 | `414364cfd35751bd658bf1e47543ddfe81d8806adfffd5659ed0e892e0680215` | NEW |
| `supabase/migrations-wip/linked-scan/20261022110100_cms_scan_linked_pattern_updates.sql` | 219 | `95ba04652a19b46d1e00a5911c97526976d95dbdfb40898c21529dc8a982e182` | changed (V6: `1f40c6c6...`) |
| `supabase/migrations-wip/linked-scan/20261022110200_cms_scan_linked_pattern_updates_api.sql` | 54 | `a8e6ad0e5373d968ea0c7cf172030e946f0c54c3ebe8faa59a5c3ee7ecb6802b` | unchanged |
| `supabase/migrations-wip/linked-scan/20261022110300_cms_linked_scan_resolve_event.sql` | 98 | `729b39f3f9f78ca6eb145cc96b1d719053fd3aec26f447b49f1552bce848f81e` | unchanged |
| `supabase/migrations-wip/linked-scan/README.md` | 19 | `19320700f51fbc66dca405e743f232f64f97c36ef4bb7e2734ad3f7c3b8df6a7` | changed |
| `supabase/migrations-wip/pattern-updates/20261014140550_cms_pattern_update_next_row.sql` (the helper's only definer; read, not in scope) | 105 | `f2f89049bdc4a142240b4a442b52c8f59a8dbc09f9b7e7bfe48beeff14b7aa5f` | unchanged (equals the squash report and the staged manifest) |
| `supabase/tests/phase_02_slice_12_linked_scan.sql` | 34 | `c49e9f64683caa04c1c5521e2cc7c220e2cdf35e005ed60012fdf6fdb3e118ab` | changed (+1 `\ir`) |
| `supabase/tests/phase_02_slice_12_linked_scan/000-helpers.sqlinc` | 174 | `73361a84c46b6812c5f9f7d74091c3f1e294476b9b3731f374df9d98e903be5b` | unchanged |
| `.../010-world.sqlinc` | 85 | `7a1b4c51bae66538c4ff986bc505da4395f28db82826fa0b493836d9d59832dc` | changed (+15) |
| `.../020-contract.sqlinc` | 100 | `476218440b2842d8127280f1f0bb2cdb378bf93fcdde69d435958aa4e122f59a` | changed |
| `.../030-scan.sqlinc` | 175 | `8e5d15e77fb7d428865a22724f1cf0be431aacf236e8b2e4f136de585c0ce80f` | changed (+59, -1) |
| `.../040-bounds.sqlinc`, `.../050-resolver.sqlinc` | 94, 31 | `2577168c...`, `12aa3b9f...` | unchanged |
| `.../060-helper.sqlinc` | 109 | `769084ff6d3b221af708e2965bd2aa96ac37249fbc29291d87d6ccfa822a5f58` | NEW |
| `.../README.md` | 26 | `5e9b984461f2e1d9070c8ebcc13a6dcd0cce12e8e5df2397bfd4ef3628c39ef1` | changed |
| `apps/worker/src/cms-composition/linked-scan/job.test.ts` | 367 | `f43cb5dce606d1821335c2b8a1931e28d9fd5beb8ffdc7475ae80b1e29fd699f` | changed (additions only) |
| `apps/worker/src/cms-composition/linked-scan/source-consumer.test.ts` | 261 | `480a606a10b6722815119e604a60bf8d781a3966cea014d30e29d2d7365c1e21` | changed (one import line, additions) |
| the other 16 Worker files of the directory, the three shared Worker files, `observability-registry.ts` and `.test.ts` | | every hash equals the lane report and review V6 | unchanged (no production Worker file changed in the follow-up) |

"Since V6" was established by `cmp`/`diff` against the lane's own pre-follow-up tar (`claude_s12_linked_scan/v6/orig-v6-start-011505.tar`,
extracted to `review_v8/orig-v6/`; its hashes equal the ones review V6 recorded) and by the hash lists of both reports.

Inputs read: the promotion brief, lane rules, review V6, the lane report (V6 section, runs 15-23); BE03c "Linked update" paragraph (incl. the
DEC-222 sentence), CompositionInstance row (line 1600) and its state-machine bullet (1715); DEC-222 raw record (`.memory/raw/events/2026-10-23.jsonl`,
id `dec-222`); `pattern-updates/20261014140000`, `140500`, `140550`, `140600`, `140605`; `block-rules/20261022080400`; `governed-v4/20261022120000`
header; promoted `20260927500000` and `20261005018060` (the insert guard); the lane's final TAP, reset log and manifest under `.lane-logs/`, the
nine V6 SQL mutant TAPs, the seven Worker mutant JSON files, the clean snapshots `clean-sql/`, `clean-sql2/`, `clean-worker/`.

## Evidence I produced

| What | Result |
| --- | --- |
| Offline emulation of `110050`'s anchor and inverse logic on the helper's `$body$` text (`review_v8/anchor_check.mjs`) | `$old$` anchor occurs exactly 1 time, `$new$` text 0 times in the installed text; the `$new$` text occurs exactly 1 time in the patched text; inverse restores the installed text byte for byte; the patched text equals the installed text outside the anchor (198 leading and 2,613 trailing characters identical). Installed prosrc 2,918 characters, SHA-256 `3057771414238b77b63a35afe2c4bba7dbb6321eed7c2fdac170b4df028afcba`; patched 3,962 characters, `44153b7f75a7271ee62a3a2f4c549a2a750a16231e5a7748d80506029b893fa2` |
| In-database proof of the same | the lane's final staged reset applied `110050` between `110000` and `110100` without error (`.lane-logs/...013108-807601.reset.log:541`); its `DO` block raises `55000` on any anchor count other than 1 or any non-anchored change, so the exact-once match held in the real catalog |
| Final lane TAP re-read (`.lane-logs/alt-staged-pattern-updates+...+linked-scan-013108-807601.tap`, SHA-256 `77ff7b0af2ed62f927aed47523507f0db56adc5a74d77c4e8258c2f72e57cf64`, equals the lane report) | 23 plans, 10,387 `ok`, 0 `not ok`; the lane suite is `1..347` (TAP line 7745); every new test name I looked up is present and `ok` (#100, #101, #193-#196, #214-#223, #237-#240, #327-#347) |
| Staged manifest of that run (`...013108-807601.manifest`, SHA-256 `8b837b7855cb9116c2f56f13640ea2f7bd155c36e4c58e76ee645b916997e7f6`) | lists the current bytes of all five migrations (lines 537-541) and of the helper's definer `140550` (`f2f89049...`, line 461), of `140600`, `140605` and `block-rules/080400`; so no mutant leaked into the final run; the run started 01:31:08, after the last edit of every file (`060-helper` 01:30:19, `110050` restored 01:31:05) |
| Second staged run `014741-884281` (integration-pins lane, 14-lane stack incl. governed-v4, 80 WIP migrations; TAP SHA-256 `f08e9094...`, manifest `34ba10f6...`) | applies the same five linked-scan bytes and the same helper definer in order (reset log lines 540-544) and governed-v4 `120000` right after (545) without error; 118 plans, 6,412 `ok`, 0 `not ok`. It does not contain the linked-scan suite, so it adds only the apply-order evidence |
| The nine V6 SQL mutant TAPs re-counted (`claude_s12_linked_scan/v6/mut2-*.tap`) | not-ok counts and first/failing test names equal the lane report: `tgt-draft` 10 (#96-#98, #214-#216, #218, #221-#223), `bump` 2 (#193, #194), `audit` 1 (#195), `corr` 2 (#238, #239), `submitted` 1 (#100), `inline` 1 (#101), `h-actor` 2 (#331, #332), `h-guard` 1 (#334), `h-carry` 1 (#335, plan 1..347: the re-run after the `pend-carried` assertion was added) |
| Vitest `apps/worker/src/cms-composition/linked-scan` (my run) | 112 / 112, 8 files, 18 suites |
| Vitest related suites (`async-entrypoint`, `production-async-entrypoint`, `governed-recheck`, `linked-scan`, `cms-composition/observability`, `cms-editorial/review-recheck`, `event-consumers`; my run) | 708 / 708, 59 files |
| ESLint `--max-warnings=0 --no-cache` on the lane directory; Prettier `--check` on both lane READMEs and the Worker directory; `tsc -p apps/worker/tsconfig.json --noEmit` | exit 0; "All matched files use Prettier code style"; exit 0 (`apps/worker/tsconfig.tsbuildinfo` untouched) |
| Independent Worker mutation sweep, 17 mutants in a scratch copy (`review_v8/mutate_worker.py`, results `review_v8/mutres-*.json`) | 17 / 17 killed (table in answer 3); baseline in the copy 112 / 112 |
| Timestamp uniqueness: `find` over `supabase/migrations` and every `supabase/migrations-wip` directory except `*-red` and `*mutant*` (541 `.sql` files) | 0 duplicate 14-digit stamps (the only duplicates are the four `governed-recheck-red` copies); `20261022110000..110300` follow the promoted tip `20261020203606` and dec208 `100000..100020`, precede governed-v4 `120000` |
| Repo-wide search for the helper (`grep -rIl cms_pattern_update_next_row`, excluding `node_modules`, `.git`, `.lane-logs`) | 24 files (this report included): the definer `140550`, its caller `140600` and closure `140605`, the two `linked-scan` migrations, the lane tests and READMEs, handoff documents; nothing else |
| Search for generic rewriters (`prosrc`, `pg_get_functiondef`, `proname`) | 39 promoted and 19 WIP migrations rewrite named functions; only `110050` names the helper; the two name-pattern sweeps (`proname like 'cms_%'`, promoted `20261002137000` and `20261002145000`) run on 2026-10-02, before the helper exists |
| Diff of every changed test file against the pre-follow-up snapshot | removed lines are exactly: `020-contract` (count 4 -> 5 and wording for the fifth function; the substring check of the derived-state function replaced by the stricter one), `030-scan` (the `r3` call, now also carrying `correlationId`), `source-consumer.test.ts` (import line gaining `vi`); everything else is addition |

## Answers to the four checks

### (1) `110050`, the anchored patch of the shared writer

**Anchors.** The only definer of `platform_private.cms_pattern_update_next_row` anywhere in `supabase/migrations` or `supabase/migrations-wip` is
`pattern-updates/20261014140550` (the squashed single definition; `dec193/041000` and `fix-dec193/090000` were deleted by the squash and
`fix-dec193/` holds only a README). The `$old$` anchor (`  if p_action = 'detach' then` and the next line, `140550:33-34`) occurs exactly once in
its body and the `$new$` text occurs nowhere in it (table above); the staged reset confirms it in the catalog.

**Inverse and the installed bytes.** The patch is the same machine as `block-rules/080400` and `governed-v4/120000`: baseline attributes asserted
(owner `wejammin_cms_definer`, SECURITY DEFINER, `prokind f`, volatile, `search_path=""`, plpgsql, return type
`platform_private.cms_composition_instances`, `110050:67-73`), anchor count 1 and "already patched" refused (`:75-82`), inverse count 1 and
`inverse = installed` (`:83-93`), definition occurs once (`:94-99`), then `execute replace(definition, old, new)` (`:100`) and a post-check that
`to_jsonb(pg_proc row) - 'prosrc'` and the function comment are unchanged (`:101-107`). Because `replace` touches only the single anchor occurrence,
the accept and detach branches are the installed bytes; the `pending` block (`:36-55`) opens with `if p_action = 'pending' then` and ends with
`return v_row; end if;`, so every other `p_action` (including NULL and an unknown value) falls through to the unchanged
`if p_action = 'detach' ... elsif p_action = 'accept' ... else raise INVALID_REQUEST` dispatch. Its `if` / `end if` pairs balance (9 / 9 in the patched
body). Accept and detach output is also pinned from outside by #338-#345.

**The row against the spec** (BE03c "Linked update" paragraph incl. the DEC-222 sentence; CompositionInstance row; column CHECK `140000`):

| Member | `pending` output (`110050:46-54`) | Requirement |
| --- | --- | --- |
| `state` | `'pending_diff'` | "appends a new `pending_diff` row" |
| `pattern_id`, `pattern_version` | the head's (unchanged) | "pinned to the unchanged version" |
| `pending_pattern_version` | `(p_plan->>'target')::integer`; target refused unless a JSON number matching `^[1-9][0-9]{0,9}$`, at most 2147483647 and above the pin | column CHECK `(state = 'pending_diff') = (pending_pattern_version is not null)` and 1..2147483647 (`140000:33-36`) |
| `position`, slot, `path`, block, props, bindings, `block_registry_digest`, parent, `link_mode`, `detached_tree` | the head's (`v_row := p_head`) | "carrying ... the instance's `position` unchanged (DEC-185)"; "every other append ... copies the position of the row it follows" |
| `created_by` | the head's | DEC-222 "keeps the head's `created_by` (a system job has no actor)" |
| `id`, `version` | fresh `extensions.gen_random_uuid()`, head `version + 1` | append-only, `UNIQUE(revision_id,path,version)` |
| `carried_from_id` | null | R1-006 (`140550:62-63`); BE03c names it as "revision-append and restore carry-over provenance" only; only the carry and restore writers ever set it to a source and no function reads it (grep) |
| `created_at`, `updated_at` | both `p_now` | "Each instance version is append-only with updated_at=created_at" |
| entry `version`, audit, outbox | untouched (the branch reads and writes no table) | DEC-222 "changes no entry `version` and writes no audit or event of its own" |

**Actor.** The branch uses none of `p_actor`, `p_choices`, `p_digest`. Accept and detach still set `v_row.created_by := p_actor` (`140550:68`) and the
digest (`:72`). Pinned by #332 (a different actor is ignored by `pending`), #340 and #345 (accept and detach take the actor given); the mutant that
reads the actor on `pending` (`h-actor`) fails #331 and #332.

**No privilege widening.** `110050` contains no GRANT, REVOKE or ALTER statement (grep: the only hits are two comment/attribute-check lines). The
post-check pins owner, SECURITY DEFINER, volatility, `search_path`, ACL, return type and comment. The new branch is schema-qualified
(`extensions.gen_random_uuid`, `pg_catalog.jsonb_typeof`), reads no table and builds no dynamic SQL from input. It is not reachable from the public
command: `cms_apply_pattern_update` runs `cms_pattern_update_check` first (`140600:63`), which refuses any action other than `accept`/`detach` with
`VALIDATION_FAILED` at `/action` (`140500:56-58`). The helper stays closed to `public, anon, authenticated, service_role` (#346 posture, #347 ACL).

**Later patches.** Which body each patch near the helper sees (B0 = the `140550` body, B1 = B0 plus the `pending` block):

| Patch (stamp, dir) | What it rewrites | Helper body it would see | Result |
| --- | --- | --- | --- |
| `20261014140550` `pattern-updates` | defines the helper | creates B0 | the only definer |
| `20261014140600`, `140605` `pattern-updates` | the caller `cms_apply_pattern_update` (call at `140600:219`) and its privilege closure (`140605:36` lists the helper) | B0 | no body edit of the helper |
| `20261022080400` `block-rules` (sorts before `110050`) | anchored patch of `cms_apply_pattern_update(jsonb)` only (anchors at its `get stacked diagnostics` handler) | the helper is never named; it would see B0 | cannot break or skip; the helper's signature is unchanged |
| `block-rules/080000..080300, 080500`, `dec193/*`, `dec208/*`, `locale-gate`, `dec202` | other functions | none names the helper | none |
| `20261022120000` `governed-v4` (sorts after `110050`) | `cms_governed_frozen_status(uuid)` only | none | none |
| `20261022110050` `linked-scan` | the helper | B0 -> B1 | the only patch of the helper |

No migration, promoted or WIP, patches the helper before or after `110050`, so nothing can lose the `pending` branch by re-creating the helper. A
future `create or replace` of the helper from the `140550` text would drop the branch, and #327-#336 would then fail. Conversely, any edit of the `140550` body before
batch 1 is promoted makes `110050` abort with `55000` at apply time (fail-closed), which is the right direction.

### (2) The scan calls the helper; the inline copy is gone

`110100:162-164` is the only write path: `v_new := platform_private.cms_pattern_update_next_row(v_head, 'pending', jsonb_build_object('target', v_target.version), null, null, null, v_now);`
then `insert into platform_private.cms_composition_instances select (v_new).*;`. `grep -n v_new` on the file returns exactly the declaration (`:55`),
the call (`:162`) and the insert (`:164`); the function body contains no `gen_random_uuid`, `created_at`, `carried_from_id` or `v_new.` member
assignment. The remaining `pending_diff` literals in the body are the four predicates at `:89`, `:91`, `:145` and `:147`. The helper call receives only heads the scan already selected
(`state in ('active','pending_diff')`, `link_mode = 'linked'`, `pattern_version < target`, `:144-147`), exactly what the helper re-checks, so the helper
cannot refuse a row the scan offers (a refusal would abort the run; none occurs in 347 tests). The execute-privilege closure gained the helper
(`:205`; a no-op for the owner definer, no widening). Diff against the V6-reviewed file: header +3 lines, comment reword (V6-07), the eight-line
inline copy replaced by the three-line call, one closure entry (checked line by line).

### (3) The new tests can fail

| Test | Where | Can it fail? | Evidence |
| --- | --- | --- | --- |
| V6-02 scan of a SUPERSEDED version with a qualifying draft instance (`r4c`), its control (`r4d`), scan of a RETIRED version via the real governed retire producer (`r4e`) | `030-scan.sqlinc:116-137`, `010-world.sqlinc:72-85` | yes | `tgt-draft` mutant (guard narrowed to `= 'draft'`, lock-time recheck dropped): #214, #215, #216, #218 and #221, #222, #223 fail, control #217 passes. #222/#223 also prove `rt1` really qualifies by every other predicate. The early guard is detectable single-session through `examined` (a mutant with only the lock-time guard would answer `1/0/end`); the lock-time guard needs the race module (RS-2) |
| V6-03 a writing run changes no entry `version`, writes no audit record and no event of its own | `030-scan.sqlinc:73-90` | yes | `bump` fails #193, #194; `audit` fails #195; #196 (exactly one event, the invalidation's) has no dedicated mutant but its `count(*)` fails by construction if the scan emitted anything |
| V6-04 the request `correlationId` reaches the invalidation's event and audit row | `030-scan.sqlinc:139-172` | yes | `corr` fails #238, #239; #237 (the third live review is invalidated) was not run against a mutant of the final suite, but fails by construction if the scan does not invalidate (the first-pass `inval` mutant failed its earlier equivalents #155, #157); #240 (fallback branch) is satisfied by any non-matching value, so it documents rather than discriminates |
| V6-05 the derived-state predicate is exactly `= 'draft'` in the candidate query and `is distinct from 'draft'` under the lock | `020-contract.sqlinc:63-65` | yes, statically only | `submitted` fails #100. No runtime case for approved, rejected, scheduled, published: see V8-01 |
| V6-01 the helper: pending output member by member, 11 refusals, head carrying a source, accept/detach output, posture, closed ACL | `060-helper.sqlinc:39-109` | yes | `h-actor` #331/#332, `h-guard` #334, `h-carry` #335 (this one survived the first sweep and was killed only after `pend-carried` was added, which is the right outcome); `inline` is caught by the static #101 (see V8-04) |
| Worker V6-13 survivors: J1 (continue on a full run), J2 (jitter on the continuation retry), J3/J13 (`highRisk`), J10/S10 (deadline signal), producer `highRisk` | `job.test.ts:278-366`, `source-consumer.test.ts:181-261` | yes | lane: 7 mutants, each exactly one failing test. Mine, independent: |

My 17 Worker mutants, all killed (each row is one mutant; test names abbreviated): J1 (`examined >= 500` instead of `nextCursor !== null`) -> "does not continue on a full run that ends the list"; J2 (no jitter on
the continuation retry) -> "adds the bounded jitter to the retry of a failed continuation"; J3 (`highRisk: true` always) and J3b (`false` always) and J13 (admission `highRisk: false`)
-> "writes every event with the always-sample class, high-risk exactly when the outcome is not a success"; J3c and J13b (`samplingClass: 'sampled'`) -> the same test (J3c also a production test); J10 (foreign
signal to the run) -> "runs the database call under the BE00 deadline"; S3 and S3b (producer `highRisk` / sampling class) and S10 (foreign signal to the event read) -> the producer's matching tests;
X1 (continuation resends the same cursor) -> "enqueues the continuation message with the new cursor" and a production test; X2 (`continued` attribute false) -> same; X3 (jitter fraction 0.2) -> 9 tests;
X4 (producer retry without jitter) -> "adds the bounded jitter to the ladder"; X5 (fire-and-forget continuation, ack first) -> 3 tests; X6 (counter uses `examined`) -> "increments
cms_pattern_linked_update_pending_total by the rows the run appended". The two fake-timer tests restore real timers in `finally` and pin both "not aborted at 14,999 ms" and "aborted at 15,000 ms".

### (4) Promotability of the five files

| Check | Result |
| --- | --- |
| lines per file | 112, 111, 219, 54, 98 (all at most 300) |
| timestamps | `110000 < 110050 < 110100 < 110200 < 110300`; each stamp occurs in exactly one file of `supabase/`; all after the promoted tip `20261020203606` and after every batch-1 stamp (74 WIP stamps below `110000`, latest `dec208 100020`); before governed-v4 `120000` |
| dependencies sit in older stamps | helper definer `20261014140550`; `pending_pattern_version` `20261014140000`; `carried_from_id` `dec193/20261016042000`; `cms_invalidate_editorial_review` promoted `20261005017580`; the first of the five (`110000`) needs only promoted helpers |
| forward-only | no `drop`, `truncate`, `delete`, `alter table`, table DDL or backfill in any of the five (grep); the only DML is inside the scan function's runtime body |
| patches of live functions reproduce the live body | `110050` is an anchored replacement (full body kept, outside-anchor text identical, proven offline and in the catalog); `110100`, `110200`, `110300` create new functions (no earlier definition exists) |
| populated database | function-body changes only; no NOT NULL, constraint validation or data rewrite |
| `lock_timeout` / `statement_timeout` | each file sets a local `lock_timeout` of 5 s; `110050` and `110100` also a `statement_timeout` (30 s, 60 s), as in the precedents |
| format | `prettier --check` clean on both READMEs |

## Checklist against the review brief

1. **Security** - pass. See "No privilege widening" and the posture/ACL tests; the only event the scan causes is the existing `{ reviewId, revisionId }`
   `cms.entry.review-changed.v1` (#196); the scan is a system job, so BE03c authority rows and 404/403 disclosure do not apply.
2. **Spec correctness** - pass. The row equals the BE03c "Linked update" paragraph and DEC-222 member by member (table above); nothing invented
   (the helper's refusals protect its own contract and are unreachable from a public route); nothing missing.
3. **Promotability** - pass (table above).
4. **Locks** - pass. The helper takes no lock; the scan's static lock order is unchanged and still pinned (#96-#98: 0 < 3 < 4 < 5, each clause
   exactly once). Multi-session behaviour (V6 RS-1..RS-6) still needs root's race module.

## Findings

| ID | Severity | Where | Evidence | Spec | Proposed fix |
| --- | --- | --- | --- | --- | --- |
| V8-01 | MINOR | `supabase/tests/phase_02_slice_12_linked_scan/020-contract.sqlinc:63-65` (#100); no case in `030-scan.sqlinc` | Carried from V6-05, only partly closed. The derived states `approved`, `rejected`, `scheduled`, `published` are still never exercised; `030` covers `draft` and `submitted` only. The only guard for them is a source-text check that the scan holds `... = 'draft'` (candidate query) and `is distinct from 'draft'` (under the lock). A predicate such as `= 'draft' or ... = 'rejected'` still contains the fragment and no runtime test would fail. Bounded, verified: `cms_composition_instances_target_revision_guard` (BEFORE INSERT, `20260927500000:51-53`, body `20261005018060:32-40`) raises `VALIDATION_FAILED` for any non-draft effective state, so the failure mode is a whole-run abort (retried, then dead-lettered), never a write to a frozen revision. The lane's reason for stopping is right: the only repository route to those states, `phase_02_slice_11_e2/000-derived-evidence.sqlinc`, attaches synthetic evidence with `alter table ... disable trigger user`, which lane rules forbid | BE03c Linked update ("instances on reviewed or published revisions keep their pin as history"); Testing Strategy ("none on reviewed or published revisions") | Root decides, not the lane: (a) allow the S11 labelled E2 evidence fixture for four extra heads and one scan (tests are mutable, so this can follow promotion), or (b) record the gap as accepted because of the insert guard. Does not gate promotion |
| V8-02 | NIT | `pattern-updates/20261014140550:94-96` (COMMENT); `110050:66, 101-107` | The helper's function comment still describes accept, detach and the retired tombstone only, and `110050` pins the comment unchanged by design (`comment_text` captured at `:66`, compared at `:105`). After promotion `\df+` and `pg_description` say nothing of `pending`; only the patch header (`110050:1-14`) documents it | `.claude/rules/extensibility.md` (extend from the docs next to the code) | While unpromoted: add one `comment on function ... is '<current text> The pending action (BE03c Linked update, DEC-222) is the linked-update scan''s row: ...'` after the `execute` and make the post-check compare against that text; or accept |
| V8-03 | NIT | `110100:206` | `extensions.gen_random_uuid()` is still a callee of the scan's privilege closure, but the scan no longer calls it (the helper does; the definer's privilege on it is the helper's concern). The grant is conditional and `PUBLIC` already holds EXECUTE, so it is a harmless vestige that misdescribes the dependency | `.claude/rules/extensibility.md` (the code states what it uses) | Delete the entry (one line) while unpromoted, or leave |
| V8-04 | NIT | `020-contract.sqlinc:66-68` (#101) | The "no second copy of the head copy" check is name-based (`v_new.state`, `v_new := v_head`, `v_new.pending_pattern_version`); the lane's own `inline` mutant reused exactly those names. A copy with other names (`v_row.state := 'pending_diff'`) would pass. Row content stays pinned by `s12ls_conforming` over 650+ rows, so this is a maintenance guard only. Measured on the current prosrc (7,801 characters): `gen_random_uuid`, `carried_from_id`, `created_at`, `updated_at` occur 0 times | `.claude/rules/extensibility.md` ("if you wrote it twice, extract it") | Extend #101 with `position('gen_random_uuid' in src) = 0 and position('carried_from_id' in src) = 0 and position('created_at' in src) = 0` |
| V8-05 | NIT | `060-helper.sqlinc:61-77`; `000-helpers.sqlinc:125-134` | By reading (no SQL run), two helper mutants survive: adding `'superseded'` to the allowed head states (no refusal label uses a superseded head; `st3 /hero` is one, `010-world.sqlinc:50`) and `> 2147483647` -> `>= 2147483647` (no case at the maximum target, which the column CHECK admits). Related: the integration oracle `s12ls_conforming` requires `carried_from_id` equal to the head's, which holds only because no world head carries a source; a carried-head scenario through the scan would need that member excluded (the helper-level `pend-carried`, #334-#335, already pins the behavior) | BE03c Linked update (head states `active`/`pending_diff`); `140000` CHECK (1..2147483647) | Add `pend-superseded` (`'st3', '/hero'`, expect refusal) and `pend-max` (`'lk3', '/main/hero'`, target 2147483647, expect `wrote`) to the label block and to the expected aggregate string (sorted `collate "C"`: `pend-frac`, `pend-max=wrote`, `pend-null`, ..., `pend-standalone`, `pend-superseded`, `pend-text`) |
| V8-06 | NIT | `110100:196-217` (closure) | The closure proves the helper exists (`to_regprocedure`) but not that it has the `pending` action. Promoting `110100` without `110050` (README says "all five files together"; root's plan does) would pass the closure and then fail every writing run with `INVALID_REQUEST`, retried and dead-lettered | promotion order (README) | Optional guard in the closure: raise `55000` unless `position('''pending''' in (select prosrc from pg_proc where oid = to_regprocedure(<helper>))) > 0`; cheap only while unpromoted |

INFO (not findings):

- **INFO-1, patch versus in-place edit.** Batch 1 is not promoted yet, so the `pending` branch could live in `140550` directly with no anchor machinery. Root chose the forward patch to leave the reviewed batch untouched (V6-01 decision), and STATE.md now plans to promote batch 1 and batch 2 together, so the patch no longer separates two release steps; folding the branch into `140550` and dropping `110050` would be a pure simplification but changes reviewed batch-1 bytes and so needs the batch-1 gates repeated. The consequence of keeping the patch is exact-text coupling: `110050` is fail-closed (`55000`) if `140550` changes, which is the safe direction. Root's call; nothing to do.
- **INFO-2, the helper does not refuse a target at or below the head's own `pending_pattern_version`.** The scan guards it (`110100:91, 147`), the helper is private with one caller, and refusing it would be new behavior the spec does not state. No action.
- **INFO-3, V6 items not asked of the lane and not re-scored here, status unchanged (files byte-identical):** V6-09 (`as never` casts in `processor.test.ts`, `rpc.test.ts`, `observability.test.ts`), V6-10 (keep the `missing.length` loop in `observability-registry.test.ts`), V6-11 (shared compatibility predicate), V6-14 (candidate-query cost), V6-15 (scan runs before the integrity rechecks). The follow-up also did what V6 recommended for V6-06, V6-07, V6-08, V6-12 and V6-13 (verified above).
- **INFO-4, `carried_from_id` null on a scan row** is consistent with R1-006 and with BE03c's definition of the column; no function reads the column.

## Test-correction verdicts

| Correction | Verdict | Reason |
| --- | --- | --- |
| `apps/worker/src/cms-composition/observability-registry.test.ts`, last `describe` (the lane's one declared correction; file hash unchanged since review V6, `e85bd826...`) | **ACCEPT** (re-confirmed) | The old assertion pinned `cms_pattern_linked_update_pending_total` as unemitted with "the consumer does not exist yet"; the job now increments it (`job.ts:112`, pinned by `job.test.ts:93-101` and `observability.test.ts`), and AC-263 requires counters "emitted at the events they name". The counter stays required in `CMS_SLICE_12_METRICS` (`observability-registry.ts:62`, test `:30, :138`). Original text preserved in `claude_s12_linked_scan/orig-registry-sections.txt`. V6-10 (keep the length loop over the now empty list) stays a NIT |
| `020-contract.sqlinc` posture list 4 -> 5 functions and the matching count and wording of the file's first eight assertions | **ACCEPT** | Adds `cms_linked_scan_request(jsonb)` (V6-12b); strengthening, no assertion removed |
| `020-contract.sqlinc:63-65` derived-state check made exact | **ACCEPT** | The new fragments contain the old substring, so anything the old check rejected is still rejected; mutant `submitted` is killed by it (#100) |
| `030-scan.sqlinc` `r3` now supplies `correlationId` (and a third live review of `iv1` is created before it) | **ACCEPT** | Expectations of `r3` (`15/15/end`, 15 conforming rows, all head summaries) are unchanged; the addition is the V6-04 witness; the `s12ls_mark()` that scopes `s12ls_appended()` still sits immediately before `r3` (`030:143`) so the 15-row count excludes the control scan `r4d` |
| `source-consumer.test.ts` import gains `vi` | **ACCEPT** | needed for fake timers; no assertion changed |
| New fixtures (`ls-s`, `ls-r`, the retire of `lr2`, the third review of `iv1`) | **ACCEPT** | Lineages are created by CMS-03C-12 and activated through the governed chain (`s12pl_pattern`), placements by CMS-03C-02 (`s12pu_place`), the retirement by the real governed retire producer (`s12pd_run('lr2:retire')`, setup assertions #219-#220). The third review reuses the labelled, precedent-backed `s12pl_review` (guarded `open` insert, as `rv1`/`iv1`). No trigger is disabled (grep for `disable trigger`, `session_replication_role`: none), and no new direct DML on composition rows was added (the remaining direct DML is the pre-existing labelled `s12ls_staterow`, `s12ls_extra_revision` and the archive of `arch1`) |

## For root at integration (not findings)

1. **Apply order is the proof.** `110050` needs the batch-1 helper text exactly as `140550` has it (`f2f89049...`). Any edit of that body before batch 1 freezes, even whitespace, makes `110050` abort with `55000` at the first reset. After promoting batch 1 and batch 2, the canonical `db:verify` is the one run that applies the real order; I did not run it.
2. **Counts in STATE.md.** The dry-run line says "batch 2 = linked-scan 4"; it is five files (`110000, 110050, 110100, 110200, 110300`). The stamp check I repeated finds no clash (541 files).
3. **Race module.** V6's RS-1..RS-6 are still required for the scan (two concurrent scans, scan versus activation of the next version, versus accept/detach, versus submit, versus revision append, versus person invalidation). The follow-up adds no lock; the helper takes none.
4. **V6 integration list, status now.** Done by the integration-pins lane: the r8 API-surface pins for `cms_scan_linked_pattern_updates` and `cms_linked_scan_resolve_event` (`phase_02_slice_09_r8_api_surface.sql:186, 188`). Still open (checked): `database.types.ts` and the PostgREST allowlist after promotion, the evidence ledger entries for AC-212/AC-213 (`tests/contracts/phase-02-slice-12-evidence-ledger-143-213.ts:2029-2051` still say "Not built" with no citations), the tracker boxes, and deploying the Worker after the batch-2 migrations.
5. **Decide V8-01** (allow the S11 evidence fixture for a follow-up test, or accept). Take V8-02, V8-03, V8-06 now only if the files are being edited anyway.
6. `supabase/migrations-wip/fix-dec193/README.md:10` still documents the deleted `20261022090000_cms_pattern_update_next_row_carry_provenance.sql`; the directory is transient (STATE.md says delete before promotion).
7. DEC-222 is "High until promotion"; promotion of the scan freezes its six choices (V6 INFO-1, unchanged).

## Promotion verdict per lane

| Lane | Verdict | Counts |
| --- | --- | --- |
| `claude_s12_linked_scan` (`supabase/migrations-wip/linked-scan/20261022110000 .. 110300`, five files, promote together with or after batch 1; the Worker half needs no promotion step) | **PROMOTE** | BLOCKER 0, MAJOR 0, MINOR 1, NIT 5 |
