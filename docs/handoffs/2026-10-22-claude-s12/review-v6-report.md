# Review V6 — lane `claude_s12_linked_scan` (P2-S12-AC-212, AC-213)

Reviewer V6 (independent, read-only). Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, HEAD
`b16edb54a7a1b698ed8ca15b6085046d4270626e`. Review time 2026-10-23 ~04:55-05:25Z. I edited no repository file except this report.
I ran no SQL, docker, supabase, pgTAP, race module or staged runner; the database evidence below is read from the lane's TAP and
mutation logs. I ran read-only Vitest, ESLint, Prettier `--check` and `tsc --noEmit` (all outputs and one scratch mutation copy of the
Worker directory live under `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/v6/`).

## Status

**VERDICT: PROMOTE.** Lane `claude_s12_linked_scan`: 0 BLOCKER, 0 MAJOR, 6 MINOR, 9 NIT (plus 3 INFO items that are not findings).
Nothing in the four migrations must change before they freeze. Three optional decisions are cheap only now, while the files are unpromoted
(V6-01 helper decision or one header sentence, V6-07 one comment, V6-12(a) one header sentence or column guard); everything else is test
strengthening or integration housekeeping that can follow promotion because tests and READMEs are not immutable.

## Scope (files and SHA-256, unchanged since the lane report)

Every hash below was recomputed by me and equals the lane report's table (no drift since the lane finished).

| Path | Lines | SHA-256 |
| --- | --- | --- |
| `supabase/migrations-wip/linked-scan/20261022110000_cms_linked_scan_request.sql` | 112 | `97dcfdd1d815e3f052b517a5ab04bfe043f5a162ed097a9b8c60d9fedec9eab0` |
| `supabase/migrations-wip/linked-scan/20261022110100_cms_scan_linked_pattern_updates.sql` | 220 | `1f40c6c6ddb2123b4b8e65d895de11bb62acc06506164c01b622e1755a3f5f90` |
| `supabase/migrations-wip/linked-scan/20261022110200_cms_scan_linked_pattern_updates_api.sql` | 54 | `a8e6ad0e5373d968ea0c7cf172030e946f0c54c3ebe8faa59a5c3ee7ecb6802b` |
| `supabase/migrations-wip/linked-scan/20261022110300_cms_linked_scan_resolve_event.sql` | 98 | `729b39f3f9f78ca6eb145cc96b1d719053fd3aec26f447b49f1552bce848f81e` |
| `supabase/migrations-wip/linked-scan/README.md` | 18 | `5554dbe94e0f152d4930f2f73bce3dedd25c70f6d4f0f1536db93ea1c81fa0d5` |
| `supabase/tests/phase_02_slice_12_linked_scan.sql` | 33 | `c440723b553ae1c8628a4e0066cd51f01a5dee9531722b21daf578d963f25072` |
| `supabase/tests/phase_02_slice_12_linked_scan/000-helpers.sqlinc` | 174 | `73361a84c46b6812c5f9f7d74091c3f1e294476b9b3731f374df9d98e903be5b` |
| `.../010-world.sqlinc` | 70 | `4259c656533a33d559349e9fb065adf81f5b7d5701514ff86eaa079238cdac0f` |
| `.../020-contract.sqlinc` | 95 | `487b6ad932465f9acad48374f76ae8580db4e732761a428a14679fa17c99f757` |
| `.../030-scan.sqlinc` | 117 | `1016bfa44e5f23a9566fd55cf3fbbf510d533eea0302cfea7c080ce91da06b0a` |
| `.../040-bounds.sqlinc` | 94 | `2577168cfd78ef708f21bf6d32b2d7b135c4e38126c4b14f73a5c25f33e3d9bf` |
| `.../050-resolver.sqlinc` | 31 | `12aa3b9f363f1248b2e55b19c6480081540656690a2b3e4a9496d58090ab7ce3` |
| `.../README.md` | 25 | `503adb8c8a9a7466ef98ecb3f6d44f2bc7c881356d8412b41f35783f5afd4a9e` |
| `apps/worker/src/cms-composition/linked-scan/` (19 files; every hash equals the lane report, e.g. `job.ts` `26ee13c5dce6039629846e24ba012d457e6fe6240cd60acc7d6f4afb358a618f`, `source-consumer.ts` `8d43ce15ac20679c23e31812a567b2b944f82d99cb6fe2c81694bb07bdd83c8a`, `processor.ts` `5858876306c00557b38cfe3262b4fc3bfb23f1d49c9c1cc7b2c91359f063db04`, `retry.ts` `0d888a3ddf7ef39a7ee95fe06c48c70691bca0c4e6e1ed0e1dd9fbcefff43f24`) | | |
| `apps/worker/src/async-entrypoint.ts` (3 scan lines among other lanes' edits) | 326 | `9e49300b75b323dfd72b8b67ec6ae512ae35586a4fdc0c763eb275571c71b6ee` |
| `apps/worker/src/production-async-entrypoint.ts` (scan composition) | 205 | `ed6d0bdfedac231f620e61e72367035ca47c5bffa89fa2bf90937f1f52446e74` |
| `apps/worker/src/async-runtime-rpc-types.ts` (2 scan lines) | 92 | `0752350c02da14a27068100727aafb9e8873240a93c966e3d8a911be73885807` |
| `apps/worker/src/cms-composition/observability-registry.ts` | 220 | `02edc81bbfcce0243fa8707f92eea942552a255423065ece9e2045ce8d935a9c` |
| `apps/worker/src/cms-composition/observability-registry.test.ts` | 187 | `e85bd8264709f92b65315adab336c8cd955dfd7cab045f991fd81b8716b9c46f` |

Inputs read: BE03c `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md` (SHA-256 at review time `94816d47b5ade281...`):
"Linked update" paragraph (line 1522, incl. the DEC-222 sentence), "Job transport (DEC-166, DEC-180 G9)" (1487), "Slice 12 lock order"
(1489-1510; scan row 1503; "Within one position a command locks rows in ascending `id` order" 1491), CompositionInstance row (1600), RPC
inventory (1621), Event schemas (1730), Observability (1774), Testing Strategy (1791), changelog 2026-10-23 (1898); BE03b "Write-path lock order and
authority fencing" (1734-1755) and "Derived revision workflow state (E2)" (1768); BE00 line 550 (queue consumers); `phase-2.md` AC-212/213
(3316-3317), AC-219 (3323), AC-263 (3367); DEC-222 (`.memory/raw/events/2026-10-23.jsonl`, id `dec-222`) and DEC-211 (`2026-10-22.jsonl`).
Lane report `lane-linked-scan-report.md` (SHA-256 `a9a58bad0302d80a...`), brief `briefs/linked-update-scan.md`.

## Evidence I produced

| What | Result |
| --- | --- |
| Timestamp uniqueness: `find` over `supabase/migrations` + every `supabase/migrations-wip` dir except `*mutant*`/`*-red` (540 `.sql` files) | 0 duplicate 14-digit stamps; `20261022110000..110300` sort after the promoted tip `20261020203606` and the dec208 stamps `20261022100000..100020`, before governed-v4 `20261022120000` |
| Lane pgTAP evidence re-read (not re-run): `g5.tap` SHA-256 `7439953e329a2f8e435d97d4a465205735b09459a9a25d22326648e63232781f`, `final2.tap` SHA-256 `da2cfc145e39d2d0289e1398b7fde266e9422fc41b5dc8d76aa8fb85d48dc184`, both equal the report | lane suite 272 ok / 0 not ok; final 9,878 ok / 0 not ok; per-file plans (`1..272` etc.) equal the report |
| Lane SQL mutation TAPs re-counted (15 files `mut-*.tap`; the lane report says "14" but names 15) | not-ok counts equal the report: eff 25, compat 5, life 7, cur 5, older 5, limit 4, inval 2, pend 5, pos 7, target 6, states 9, detached 8, lineage 11, order 11, idemp 12; `clean-sql/` hashes equal the live migrations |
| Vitest `apps/worker/src/cms-composition/linked-scan` | 106 / 106, 8 files, 18 suites |
| Vitest related suites (`async-entrypoint*`, `production-async-entrypoint*`, `governed-recheck`, `linked-scan`, `cms-composition/observability*`, `cms-editorial/review-recheck`, `event-consumers`) | 702 / 702, 59 files (the lane reported 696 on the same set of suites) |
| Coverage of the lane's Worker files (v8, scratch reports dir) | 100 % lines (121/121), statements (127/127), functions (24/24), branches (67/67); satisfies the repo's 100 % thresholds in `vitest.config.ts` |
| ESLint `--max-warnings=0` on the lane directory, the three shared files and the registry + test | exit 0 |
| `tsc -p apps/worker/tsconfig.json --noEmit` | exit 0; `apps/worker/tsconfig.tsbuildinfo` untouched |
| Prettier `--check` | all `.ts` pass; the two lane `README.md` under `supabase/` fail (V6-06) |
| Extra Worker mutation sweep, 9 mutants in a scratch copy (`v6/mut/`, driver `v6/mutate_worker.py`, results `v6/mutres-summary.json`) | 3 killed (J16, S12, P5), 6 survive (J1, J2, J3, J10, S10, J13); see V6-13 |

## Answers to the nine specific checks

### (1) Every predicate of AC-212 both ways, and the compatibility rule

| Predicate | Appends | Does not append | Evidence |
| --- | --- | --- | --- |
| linked vs detached / standalone | `lk1`, `lk2`, `lk3` | `dt1` (detached placement), `lk1:/standalone` (no pattern) | `030-scan.sqlinc:28-38`; lane mutants `detached`, `lineage` killed |
| head state | `active`, `pending_diff` for an older version | heads `retired`, `draft`, `superseded` (`st1-3`) | `030:55-58`; mutant `states` killed |
| draft vs reviewed / published | draft (`lk*`), draft with an older live review beside a newer invalidated one (`iv1`) | `rv1` (open review: submitted), `old1` (revision no longer current draft), `arch1` (archived entry) | `030:39-47, 63-71`. `approved`, `rejected`, `scheduled`, `published` are never exercised (V6-05); the E2 insert trigger is the backstop |
| older vs same / newer pin | pins v1 offered v2 and v3 | `same1` (pin = target) | `030:51-52, 108`; mutant `older` killed. A newer-than-target pin cannot be built with the real producers (one active version per lineage; placements pin the active one) |
| compatible vs incompatible type | type 1 for v2; type 2 (`ty2`) for v3 | `ty2` for v2 (v2 lists type 1 only) | `030:48-50, 106-107`; mutant `compat` killed |
| older pending head | `pending_diff` for v2 gets a newer row for v3 | | `030:99-105`; mutant `pend` killed |
| inactive target | | draft v4 scan appends nothing | `030:90-95`; the superseded case is not discriminated (V6-02) |

The scan's compatibility predicate (`110100:92-93` pick, `:128-129` re-check) is textually the one every composition path uses:
`exists (select 1 from jsonb_array_elements_text(compatible_type_ids) listed(value) where lower(listed.value) = lower(<content_type_id>::text))`
in CMS-03C-02 (`supabase/migrations/20261014110300_cms_insert_pattern_instance.sql:152-156`), the CMS-03C-13 selector
(`20261014140300:136, 158`), and `cms_pattern_update_target` (`pattern-updates/20261014140200:28-30`), which CMS-03C-14
(`dec193/20261016040200:61`) and CMS-03C-15 (`pattern-updates/20261014140600:152`) both call. "Draft revision" is the same triple CMS-03C-15
admits (`140600:110-114`): entry `lifecycle = 'active'`, `current_draft_revision_id = revision`, `cms_revision_effective_state = 'draft'`;
this is now spec text (BE03c 1522, DEC-222).

### (2) Idempotency under re-delivery and under two concurrent scans

Re-delivery: an instance whose newest row is `pending_diff` with `pending_pattern_version >= target` is no candidate (`110100:88`), and the
newest-row guard (`:89-90`) stops older rows of a path from qualifying; r2, r2b, r5 and `big3` assert 0/0/end and unchanged stores
(`030:73-79, 115-117`; `040:69-72`). Two concurrent scans of one version (assuming the PostgREST / database default READ COMMITTED; under a stricter level the second scan would fail
`40001` and the Worker would retry it): both pick from separate snapshots (the functions are `volatile`, so every inner statement takes a fresh snapshot), both then take entry rows `FOR UPDATE` in ascending entry id (`:107-113`), so the
second waits at the first shared entry; after the first commits, the second's `FOR UPDATE` re-reads the entry, and its next statement (`:139-140`,
`order by version desc limit 1`) sees the first run's committed pending row, whose `pending_pattern_version` equals the target, so
`v_heads` is empty and the entry is skipped (`:141-150`). `UNIQUE (revision_id, path, version)` (`20260927290000:115-116`) is the last backstop. Both runs
lock in ascending entry id, so they cannot deadlock each other. The re-reads under the lock (`:114`, `:120-123`, `:127-131`, `:141-144`) are
what make this safe; **no single-session test can reach them** (every mutant of them is equivalent to the pick), so the scenarios below need
root's race module. Scenarios, with the assertion each should make:

- RS-1 two scans of one version, cursor null (also: one from a continuation cursor): exactly one `pending_diff` row per (revision, path); no deadlock;
  `sum(appended)` equals the candidate count.
- RS-2 scan(v2) versus activation of v3 with a writer holding an entry mid-list: the per-entry `locked.state = 'active'` re-check (`:120`) skips the rest after
  v3 commits; no `pending_pattern_version = 2` row is ever written over a `3` row; the continuation is the quiet `{0,0,null}`.
- RS-3 scan versus CMS-03C-15 accept / detach on one instance: one outcome per instance; the loser is `VERSION_MISMATCH` or a skip; never two rows at one `version`.
- RS-4 scan versus CMS-03B-05 submit on a draft revision: either the scan lands first (submit's manifest includes the pending rows) or submit lands
  first and the E2 insert guard (`20261005018060:33-40`) aborts the whole run `VALIDATION_FAILED` (a transient the Worker retries and then skips);
  never a pending row on a submitted revision.
- RS-5 scan versus revision append / carry-over (`dec193/042100:125-137`, which copies pending state) on the same entry: pending rows end up on the current
  draft exactly once.
- RS-6 (only constructible in the `iv1` shape) scan versus `cms_invalidate_reviews_for_person` over two or more entries: the person invalidation locks
  review rows in ascending *review* id across entries (`20261005017580:335-349`), the scan in ascending *entry* id, so a cycle is possible. It is practically
  moot (a draft-derived revision has no live review outside the defense-in-depth shape, so the scan's position-5 lock set is normally empty) and both sides
  already map `deadlock_detected` to `CONFLICT` (BE03b rule 6; wrapper `110200:25-29`).

### (3) The cursor

`nextCursor` is `<entry uuid>.<hex of the path octets>` of the last instance taken, non-null only when a 501st candidate existed (`110100:101-105`). The
next run selects strictly after it (`:95-96`, both columns `collate "C"`, the order key of `:97`). The scan cannot re-process its own append: the
appended row is the new newest row of its path and carries `pending_pattern_version = target`, which fails `:88`, and its path is at or before the cursor
in any case. It cannot skip: candidates not reached stay candidates; ones reached are excluded by `:88-90`; an instance skipped under the lock is
passed deliberately (its predicates failed; a later activation's scan covers it). `(entry, path)` is unique per run because the join pins one current draft
revision per entry (`:91`). Tests: 546 rows in two runs (500 + 46, none repeated, none skipped, `040:44-72`), a cursor splitting an entry (25/25/25/3 over 78 rows,
`040:76-95`), request refusals for every malformed cursor (`020:74-78`), order test (mutant `order` killed by #241). The decoder bounds hex length 2..1024 and
even (`110000:56-62`), re-validates the decoded path against the table's grammar (`:69`), and cannot be built or parsed by the Worker (`contract.ts:28-32`).

### (4) The row append: helper not reused (V6-01)

The scan inlines the copy: `110100:157-166` (`v_new := v_head`, new `id`, `version + 1`, `state := 'pending_diff'`, `pending_pattern_version := v_target.version::integer`,
`carried_from_id := null`, one `created_at = updated_at`, then `insert ... select (v_new).*`). The only append helper in `pattern-updates/` + `dec193/` is
`cms_pattern_update_next_row` (`pattern-updates/20261014140550:16`); it accepts only `accept` and `detach` and raises `INVALID_REQUEST` for anything else (`:42`), so it cannot
write a `pending_diff` row, and the dec193 carry-over uses the same inline composite copy. The brief's "REUSE it" cannot be met without editing unpromoted
`pattern-updates` SQL (forbidden to the lane), but the report never says so. Position, pin and `pending_pattern_version` are kept and proven: `s12ls_conforming`
(`000-helpers:125-134`) compares every member of every appended row with the marked head, 11 + 15 + 546 + 78 rows; mutants `pos` and `target` killed.

### (5) Review invalidation in the same transaction

Matches the other composition writers: the live reviews (`open`, `approved`) of the revision are locked at position 5 in ascending id before the insert
(`110100:152-155`; CMS-03C-15 `140600:210-213`), rows are inserted, then each review is invalidated with reason `dependency_changed`
(`:169-176`; CMS-03C-02 `20261014110300:229-238`; CMS-03C-15 `140600:277-285`) through the one core `cms_invalidate_editorial_review`, which audits and emits
`cms.entry.review-changed.v1` itself (`20261005017580:211-312`). Differences are exactly DEC-222's: no `actorId` (the core accepts it absent), no entry
`version` bump (CMS-03C-15 `140600:273-275`), no audit of the scan's own. Test: `030:63-71` (older live review invalidated `dependency_changed`, version 2; the
newer invalidated one untouched; the event exists; mutant `inval` killed). Gaps: V6-03, V6-04.

### (6) PAT-031

Both entry points set and restore the flag. Private scan: `set_config('app.cms_rpc','true',true)` at `110100:58`; wrapper restores `rpc_previous` at
`110200:21, 30`. Private resolver sets it at `110300:29` (with the comment naming PAT-031) and its wrapper restores at `:60, :65`. The fix the lane
reports is real: before it the resolver read `cms_pattern_versions` (forced RLS, `cms_rpc_context_valid()`) with no flag. Tests: `s12ls_call`
(`000-helpers:14-61`) empties `app.cms_rpc` and every actor setting, switches to the real `service_role`, records the flag before and after and asserts
the effective role; assertions #129-#131 (scan), #260 and #262 (resolver) are in `g5.tap`; the private scan function is refused to `service_role` with 42501 (`020:94-95`).
The pure `cms_linked_scan_request` touches no table (no flag needed) but is outside the posture test (V6-12).

### (7) Worker

Retry: `linkedScanRetry` (`retry.ts:17-33`) is the shared ladder 15/60/300 s (`retry-schedule.ts`) plus `floor(base * 0.1 * sample)`, sample outside `[0,1)` adds nothing; beyond
the ladder no delay, `max_retries = 3` moves it to the DLQ (BE00 550; DEC-211: "server, queue and job callers ... three at 15s/60s/300s with jitter").
Used on a failed run (`job.ts:134-137`), a failed continuation (`:141-144`) and both source-consumer failures (`source-consumer.ts:117, 137`). The precedent
governed job has no jitter; the scan does, as the brief asks. Continuation: `{ ...job, cursor: run.nextCursor }` is sent before `ack` (`job.ts:138-147`); a failed send retries
the same message and still counts the committed rows. A retried message re-runs from the same cursor, but the run's own rows no longer qualify, so it takes
the next window: nothing is lost or repeated (reasoned; no test). Counter: `cms_pattern_linked_update_pending_total: run.appended` (`job.ts:112`), also on the
continuation-failure path, label-free, registered (`observability-registry.ts:62`). Failure handling: any thrown RPC error is retryable
(`LINKED_SCAN_RUN_FAILED`), invalid payload is `INVALID_QUEUE_PAYLOAD` with plain `retry` (DLQ after the queue limit, same as the governed job), the
resolver `found:false` is acked without a dead letter (the editorial consumer owns it, as the governed producer does). Logs carry no pattern, entry, path or cursor value
(`job.test.ts:265-271`). Routing: the three shared lines add `LinkedScanMessage` to the queue union, route `isLinkedScanJobMessage` to the review-recheck seam and add the RPC-name type;
`production-async-entrypoint.ts` composes scan -> governed recheck -> Slice 11 recheck; proven end to end by `production.test.ts`. Note the report's "ADD-only" label is loose: the
WeakMap value type, `recheckFor`'s return type and the processor assignment are rewritten, not added (harmless; structural types).

### (8) Worker tests without a RED run: adequate

Disclosed deviation from `.claude/rules/tdd-contract-first.md` (tests were authored first but first executed with the code). Compensating evidence I verified: 100 % line,
statement, function and branch coverage of every Worker file, and mutation sensitivity. The lane's five mutants (drop counter, no jitter, any event type, no continuation, ack an
invalid payload) hit the headline behaviours. My nine further mutants: killed J16 (continuation-failure log loses the run counts), S12 (no `SOURCE_RECORD_NOT_FOUND` log), P5 (scan retry
no longer blocks the delegate); **survived** J1 (continue on `examined === 500` instead of `nextCursor !== null`), J2 (no jitter on the continuation-failure retry), J3 and J13 (`highRisk` flags),
J10 and S10 (the run / resolve call receives a foreign `AbortSignal`, the tests only assert `expect.any(AbortSignal)`). Untested branches that matter in kind: a run of exactly 500 with
no cursor (the shape the SQL returns when the list ends on the bound; `contract.test.ts:153-157` accepts it, no job test uses it; J1 is benign by idempotency, one extra empty run), the identity of
the deadline signal, jitter on the secondary retry path. None changes durable state. I do not require a retrospective RED.

### (9) Promotability

| Check | Result |
| --- | --- |
| lines per file | 112, 220, 54, 98 (all <= 300) |
| timestamps | unique and ordered across 540 files (see Evidence); dependencies sit in older stamps (`pending_pattern_version` `pattern-updates/20261014140000`, `carried_from_id` `dec193/20261016042000`, `detached_tree` `dec193/20261016040000`, `position` promoted) |
| patches of live functions | none: five new functions (two `platform_api` wrappers, three private); no `create or replace` of an existing body; no table DDL, no backfill, no populated-DB hazard |
| definer posture | `SECURITY DEFINER`, `set search_path = ''`, owner `wejammin_cms_definer`, every reference schema-qualified (`extensions.gen_random_uuid()` included); private functions `revoke all ... from public, anon, authenticated, service_role`; wrappers revoked then `execute` to `service_role` only (`110200:41-43`, `110300:78-83`) |
| table privileges | `select, insert` on `cms_composition_instances`; `select, update` (needed for `FOR UPDATE`) on entries and editorial reviews; `select` on revisions, pattern versions, content-type versions, outbox events: to the definer only, byte-identical to the CMS-03C-15 closure (`pattern-updates/20261014140605:13-17`); no grant to a browser role; RLS untouched |
| dynamic SQL | only `execute format('grant execute ...', callee_oid::text)` over a fixed array in the closure blocks |
| wrapper / error mapping | `deadlock_detected or lock_not_available` -> `CONFLICT` (`110200:25-29`), identical to the governed recheck wrapper |
| format | `prettier --check` fails on two READMEs (V6-06) |

## Checklist against the review brief

1. **Security** — pass. Posture and grants as above and asserted for four of the five functions (`020:4-32`); no browser grant; no PII or content in audit or outbox payloads
   (the only event is the existing `{ reviewId, revisionId }`); the scan is a system job, so no authority, assignment or 404/403 disclosure rules apply and the pair check returns
   `NOT_FOUND` only to the service role.
2. **Spec correctness** — pass. Behaviour equals BE03c 1522 incl. DEC-222; no invented behaviour beyond the spec-silent items DEC-222 ratified plus implementation shape (`batch`,
   `correlationId`, `{examined, appended, nextCursor}`, the resolver, the cursor format, the jitter bound), which BE03c does not state (INFO-3). Nothing in the spec is missing.
3. **Promotability** — pass (table above).
4. **Locks** — pass with a documentation note. The code takes positions 0, 3, 4, 5 in order per entry, entries ascending (`110100:107-155`), which is what BE03c 1503 states.
   The comment at `:112` says position 0 is "taken for every entry of the run" (V6-07). Positions 1 and 2 do not apply (no caller, no pin or exclusion target). The static check (`020:41-63`)
   proves source order of four clause strings only; multi-entry behaviour needs RS-1..RS-6.

## Findings

| ID | Severity | Where | Evidence | Spec | Proposed fix |
| --- | --- | --- | --- | --- | --- |
| V6-01 | MINOR | `110100:157-166` | The row append is re-implemented inline; the brief's "REUSE the dec193 append helper" is unmet and the lane report does not mention the helper. The only helper, `cms_pattern_update_next_row` (`pattern-updates/20261014140550:16`), supports `accept`/`detach` only (`:42`) and carries the same 6-line head copy (`:61-66`); dec193 carry-over repeats the idiom. Behaviour is fully proven (`s12ls_conforming`, 650 rows). | BE03c CompositionInstance row ("every other append ... copies the position of the row it follows"); `.claude/rules/extensibility.md` (no copy-paste); brief Precedent paragraph | Root decides before the files freeze: (a) accept and add one header sentence ("no shared helper writes `pending_diff`") plus a line in the report; or (b) add a `'pending'` action to the unpromoted helper (about 10 lines, `created_by` stays the head's), call it from the scan, re-run the five pattern-update suites and this suite |
| V6-02 | MINOR | `030-scan.sqlinc:87-89` | The "late scan of a superseded version" (r4) cannot fail: it runs after r1, when all 11 older-pinned compatible draft instances already wait for v2, so with the guard `110100:71` and the lock-time `locked.state = 'active'` (`:120`) deleted it still returns 0/0/end. Only r4b (draft v4, `:90-95`) has candidates and discriminates the guard; a guard narrowed to `= 'draft'` passes all 272 tests; `retired` is untested. | BE03c 1522 "a target version that is no longer `active` when the job runs is a no-op" (DEC-222) | Activate v3 before r1 and scan v2 while 11+ instances still qualify (keep r4b); add a retired-version case through the governed retire flow |
| V6-03 | MINOR | `030-scan.sqlinc:15-71, 98-114` | DEC-222's negative clauses are asserted nowhere for a writing run: no comparison of `cms_content_entries.version`, `audit_events` or `outbox_events` across r1 or r3 (`s12ls_unchanged` is used only for refusals and idempotent re-runs, `:76, 79, 89, 95, 117`); r1 only checks that the review-changed event exists (`:69-71`). Adding `update ... set version = version + 1` (as CMS-03C-15 does, `140600:273-275`) or a `cms_record_audit` would keep 272/272 green. | BE03c 1522 "changes no entry `version` and writes no audit or event of its own, while the review invalidation it causes is audited as every composition write's is (DEC-222)" | After r1, compare the already captured `s12ls_out` before/after rows: entries identical; audit and outbox deltas are exactly the iv1 invalidation (one `cms.entry.review-changed.v1`, its audit row) and nothing else |
| V6-04 | MINOR | `110100:74, 174-175`; `030:77-79` | The request `correlationId` feeds the invalidation (`coalesce(request, cms_trigger_correlation())`) but the only run that supplies one (r2b) appends nothing, so neither the supplied-id branch nor its arrival in the outbox / audit correlation is tested; the Worker always supplies it (`job.ts:126-132`). A mutant using only the fallback survives. | BE03c Observability (structured logs, traces and audit keyed by correlationId; "traces cover ... audit/outbox") | A writing run with a supplied `correlationId`, then assert the invalidation's `outbox_events.correlation_id` and audit row carry it |
| V6-05 | MINOR | `110100:94, 127`; `030` | Derived states `approved`, `rejected`, `scheduled`, `published` are never exercised (lane open item 7); only draft and submitted are. A mutant `<> 'submitted'` survives (static check #66 looks for the substring only). Mitigation: the E2 insert guard (`20261005018060:33-40`) makes the INSERT fail `VALIDATION_FAILED` for every non-draft state, so a wrong predicate aborts the run instead of corrupting a frozen revision, and the shared function has its own E2 suite (`phase_02_slice_11_e2_composition_guard.sql`, all eight states). | BE03c 1522 "instances on reviewed or published revisions keep their pin as history"; Testing Strategy 1791 "none on reviewed or published revisions" | If root permits the S11 labelled E2 evidence fixture (`phase_02_slice_11_e2/000-derived-evidence.sqlinc`), add approved / rejected / scheduled / published heads; otherwise record the gap as accepted because of the trigger |
| V6-06 | MINOR | `supabase/migrations-wip/linked-scan/README.md`, `supabase/tests/phase_02_slice_12_linked_scan/README.md` | `prettier --check` exits 1 on both (table column alignment); `package.json` `format:check` includes `'supabase/**/*.md'`, so `pnpm validate` fails. The report claims prettier clean on every touched file. Precedent READMEs (governed-recheck, pattern-updates) fail identically. | repo `format:check` | `prettier --write` both (the WIP README is deleted at promotion; the tests README stays) |
| V6-07 | NIT | `110100:112` | Comment "position 0: the entry row, taken for every entry of the run in ascending id" reads as all entry locks first; the loop takes 0, 3, 4, 5 per entry (`:113-155`). Interleaving adds no cycle beyond the entry-pair cycle BE03b rule 6 already accepts (RS-6 is moot, see (2)). | BE03c 1503, 1491; BE03b 1736 | Reword to "per entry, in ascending entry id" while the file is still unpromoted |
| V6-08 | NIT | `supabase/tests/phase_02_slice_12_linked_scan/README.md` | "`s12ls_staterow` (no CMS-03C producer writes them)" is false for `retired`: CMS-03C-15 accept appends a `retired` row for a removed root answered `theirs`. The fixture itself is acceptable (non-active, a copy of a real head under `app.cms_rpc`, precedent `s12pu_staterow`; no active row forged, no trigger disabled). | BE03c 1522 (`retired` row) | Say "no cheap producer" |
| V6-09 | NIT | `processor.test.ts:24-28`; `rpc.test.ts:32, 49, 66, 73, 86`; `observability.test.ts:69` | `as never` casts bypass mock typing ("type your mocks"); ESLint passes. | `.claude/rules/tdd-contract-first.md` | Type the mocks |
| V6-10 | NIT | `observability-registry.test.ts:177-187` | The corrected test drops the `entry.missing.length > 40` loop. Vacuous today, but the loop would hold the next unemitted entry to a real description. | BE03c Observability | Keep the loop over the (empty) list |
| V6-11 | NIT | `110100:92-93, 128-129` | The compatibility predicate is now the fifth textual copy (placement, selector, `cms_pattern_update_target`, restore, scan) and appears twice inside the scan. Verified identical, so no drift today. | `.claude/rules/extensibility.md` | A shared helper later; not before promotion |
| V6-12 | NIT | `110100:199-218`; `README.md`; `020:5-10` | (a) plpgsql resolves record fields at run time, so promoting the scan before `pending_pattern_version` / `carried_from_id` / `detached_tree` exist would succeed and fail at the first run; the closure block checks functions only and the README does not name these dependencies (root's batch plan covers it). (b) The posture test covers four functions; `platform_private.cms_linked_scan_request(jsonb)` (owner, definer, search_path, ACL; verified by me at `110000:88-91`) is not in `s12ls_fn`. | repo promotion order | A header sentence in `110100` (optionally a column-existence guard) while it is unpromoted; add the fifth function to `s12ls_fn` |
| V6-13 | NIT | `job.ts:134-145`; `source-consumer.ts:115`; `job.test.ts:71, 116`; `source-consumer.test.ts:50` | Six surviving Worker mutants (see (8)): no test pins jitter on the continuation retry, the `highRisk` options, the identity of the deadline signal passed to `run` / `resolveEvent`, or the (500, no cursor) job outcome. Same assertion style as the governed precedent. | BE00 550, DEC-211, BE00 deadline | Add the four assertions (fake timers for the signal) |
| V6-14 | NIT | `110100:77-99, 133-147` | The candidate query evaluates every qualifying row (including `cms_revision_effective_state` per row) before `limit 501`, because no index gives the (entry, path) cursor order: per-run cost grows with the lineage, O(N^2/500) per activation. `v_heads` buffers all heads of an entry (up to 500 rows, props up to 256 KiB each). Fine at the suite's scale (546-instance world, 272 tests in 9 s); no function-level timeout exists (the migration's `set local statement_timeout` is inert at run time). | BE03c 1503 (500 per run) | A post-promotion volume witness like dec208's `007-volume`; no migration change now |
| V6-15 | NIT | `processor.ts:36-44`; `production-async-entrypoint.ts` composition | A failing scan resolver (for example the Worker deployed before the batch-2 migrations: `cms_linked_scan_resolve_event` absent) returns `retry` before the governed and Slice 11 rechecks run, so for every `cms.pattern.activated.v1` the integrity rechecks wait behind the advisory scan until the DLQ. It is the ordering the governed producer already uses in front of the Slice 11 recheck; publication-time digests and activation recounts backstop a delayed invalidation, and `DLQ > 0` alerts. | BE03c Event schemas; BE03b "Stale reviews never activate" | Deploy the batch-2 migrations before the Worker; optionally run the scan after the rechecks |

INFO (not findings): (INFO-1) DEC-222 states "Reversibility: High until promotion"; promotion freezes it, so confirm the owner does not override the six choices first. (INFO-2) A
revision that returns to `draft` after the scan passed (a review invalidated later) is never flagged until another activation or re-delivery; inherent in DEC-222, harmless because CMS-03C-14/15
accept `active` rows. (INFO-3) BE03c now names `cms_scan_linked_pattern_updates` and `cms_linked_scan_resolve_event` (1621) but not their request / result, unlike
`cms_recheck_governed_reviews`; add `{ patternId, patternVersionId, cursor, batch?, correlationId? }` -> `{ examined, appended, nextCursor }` at integration.

## Test-correction verdicts

| Correction | Verdict | Reason |
| --- | --- | --- |
| `observability-registry.test.ts`, last `describe`: the unemitted list was pinned to exactly `['cms_pattern_linked_update_pending_total']` with each `missing` text longer than 40 characters; now `toEqual([])` and `not.toContain(...)` | **ACCEPT** | The original assertion said the consumer "does not exist yet"; the job now increments the counter (`job.ts:112`, pinned by `observability.test.ts` and `job.test.ts`), and AC-263 requires the counters be "emitted at the events they name". The counter stays required in `CMS_SLICE_12_METRICS` and conforms (`metricKeyConforms`). Not a weakening; keep the length loop (V6-10). I checked the preserved original in `claude_s12_linked_scan/orig-registry-sections.txt`. |

Fixtures: no trigger is disabled, no approval or evidence is forged, no active row is inserted directly. The three direct DML fixtures (`010-world:44` archive an entry; `s12ls_staterow` retired /
draft / superseded copies; `s12ls_extra_revision` an extra revision and the draft pointer) are labelled and precedent-backed (placement and pattern-updates suites).

## For root at integration (not findings)

1. Add `cms_scan_linked_pattern_updates(jsonb)` and `cms_linked_scan_resolve_event(uuid)` to the `platform_api` classification in `supabase/tests/phase_02_slice_09_r8_api_surface.sql` (supporting set; the file enumerates every `cms_` function and is exact), then `database.types.ts` and the PostgREST allowlist; the governed pair is not in r8 either, so both pairs go in together.
2. The evidence ledger `tests/contracts/phase-02-slice-12-evidence-ledger-143-213.ts:2029-2051` still says "Not built" with `citations: []` for AC-212 and AC-213; cite the TAP and Vitest files and update the limitation. Tick the tracker boxes (the lane ticked none).
3. Run the race module for RS-1..RS-5 (RS-6 optional) after promotion; deploy the Worker after the batch-2 migrations (V6-15).
4. Run `prettier --write` over the lane READMEs (V6-06); decide V6-01 and, if wanted, reword V6-07 and add the V6-12(a) header sentence before the files freeze.

## Promotion verdict per lane

| Lane | Verdict | Counts |
| --- | --- | --- |
| `claude_s12_linked_scan` (`supabase/migrations-wip/linked-scan/20261022110000 .. 110300`, promote all four together, after batch 1 which holds the columns they copy) | **PROMOTE** | BLOCKER 0, MAJOR 0, MINOR 6, NIT 9 |
