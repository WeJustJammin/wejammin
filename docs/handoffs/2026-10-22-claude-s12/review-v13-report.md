# Review V13 report (claude_s12_review_v13): gaps-db2, node-pointers and the web-impl Worker/web changes

Reviewer: claude_s12_review_v13 (independent; wrote none of the reviewed work). Read-only except this file and one scratch pgTAP probe that I
created, ran and deleted again (copy and SHA-256 in row R4 below). Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, HEAD `cd89d54c`
(lane-rules name b16edb54; the worktree is at cd89d54c). Spec line numbers are those of the working-tree files (BE03c/FE03/decisions are modified
and uncommitted). Reviewed lane reports: `lane-gaps-db2-report.md` sha256 `8f63afc9...`, `lane-web-impl-report.md` sha256 `02b723b7...`
(both equal the SHAs root recorded in LANES.md).

## 1. Verdicts

| WIP dir / item | Verdict | Conditions (finding ids) |
| --- | --- | --- |
| `supabase/migrations-wip/gaps-db2/` (4 files) | **PROMOTE-WITH-CONDITIONS** | V13-01 and V13-02 are fixed in the untracked files before promotion (or each is an explicit, recorded deferral); V13-04 at promotion |
| - `20261024130000` lifecycle columns (AC-195) | PROMOTE-WITH-CONDITIONS | V13-01 (`updated_at`) |
| - `20261024130100` relay claim exact aggregates (AC-248) | **PROMOTE** | none |
| - `20261024130200` CMS-03C-01 lock position 1 (AC-276) | **PROMOTE** | residual V13-05 noted, not a condition |
| - `20261024130300` wrapper lock-failure conversion (AC-276) | PROMOTE-WITH-CONDITIONS | V13-02 (four deadlock-only wrappers left), V13-06 |
| `supabase/migrations-wip/node-pointers/` (2 files, SQL) | **PROMOTE** | none (V13-07 is an optimisation note) |
| web-impl Worker / web changes | **PROMOTE-WITH-CONDITIONS** | V13-03 (coverage gate) before; V13-04, V13-08, V13-09 are tracked follow-ups |

Test corrections: all four **ACCEPT** (section 5).

Counts: **0 BLOCKER, 3 MAJOR, 6 MINOR, 6 NIT.** Positive result: with all four sibling WIP dirs staged (20 files), 80 pgTAP entrypoints (8,581 assertions, including every suite that moves
state, every relay suite and both taxonomy-integrity drivers) pass on the final bytes (R1). Nothing found corrupts data or blocks a legitimate state move today; every MAJOR is a completeness
gap against a spec sentence or a repository gate, and each is cheap to close while the SQL is still an editable untracked file.

Top findings:
1. **V13-01 MAJOR** - 130000 guards four of the five lifecycle columns; `updated_at` stays directly writable (BE03c names all five), and a future-dated
   `updated_at` wedges every later governed transition (probe C7/C8).
2. **V13-02 MAJOR** - 130300 converts lock timeouts for define/append/resolve/restore but leaves `platform_api.cms_create_entry` (a writer Slice 12 itself
   amended with a position-3 lock, and V12-01 will give a position-6 lock) and the three Slice 9/10 activation/revocation wrappers on deadlock-only
   (probe B listing and probe D injection: raw `55P03`).
3. **V13-03 MAJOR** - `apps/worker/src/cms-composition/node-pointer-refusal.ts:57-65` has one uncovered branch (183/184 on the three touched Worker
   files); `vitest.config.ts` demands 100% branches, so `pnpm test:coverage` (a `pnpm validate` step) goes red.

## 2. Method and runs

Every run below is mine. ALT = the staged runner `lane-db-alt-staged.sh`; the lane list is the sibling-WIP overlay
`taxonomy-integrity,gaps-db2,node-pointers,placement-perf` (20 WIP files on 543 promoted; they apply in timestamp order 100000..100800, 130000..130300,
140000..140100, 150000..150400). `nestable-read/` holds no SQL yet.

| # | Time (2026-10-27) | Stamp | What | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| R1 | 20:10:32 lock, reset ok 20:11:04, pg_prove done 20:32:46 | 200730-267191 | 80 pgTAP entrypoints: the 18 gaps-db2 files, the node-pointers file, the 29 regression files of the lane's last run, plus 32 more (S09 p241/dec108/p240/g1/sec2/r8/trigger catalog/persistence_runtime, S11 helpers_manifest/criteria_publish_gates/recheck_run/recheck_relay/outbox_relay_poison/assign_event_delivery, S12 governed_*/gaps_db1_*/block_*/pattern_updates/linked_scan/taxonomy_definition/taxonomy_integrity (+provider)/placement_perf_*/gaps_lock_order) | **PASS: Files=80, Tests=8581, 0 not ok** | TAP `.lane-logs/alt-staged-taxonomy-integrity+gaps-db2+node-pointers+placement-perf-200730-267191.tap` sha256 `c6f5b3e2027827b9f387a41bd170a86567d84b1047593e28488095d9c8757923`; manifest sha256 `b1c3a5dd54919b7b2fe93af49df897b100eecfc15292fdd667a0e46e765bfc28` (staged hashes of the six reviewed migrations equal the bytes I reviewed: 130000 `3fd2325f`, 130100 `67f2e06f`, 130200 `9cd2c159`, 130300 `779992a1`, 140000 `36b3db2f`, 140100 `d6b778af`) |
| R2 | 20:35:00 | 203252-323357 | probe file, first version | harness abort: `operator is not unique: text \|\| "char"` (my probe, line 22). Not a feature result | TAP sha256 `4a7610df5c05d0ea14a647eb1a31d92ffcf0884c0617e16675402c92b4b24c85` |
| R3 | 20:42:14 | 203517-333638 | probe, second version | 10 tests, 1 not ok: #6, my own precondition (person and tenure rows already carried a fixture lock, xmax 2859); C4/C5 were contaminated by my own C1 (a future-dated `updated_at`). Diagnostics usable for A, B, D | TAP sha256 `060e02d0223a9894ef632fa351106eb6009ea952810a006a070a692eb8fb9b0a` |
| R4 | 20:49:23 | 204333-353829 | probe, final (A grant/position-4 xmax, B wrapper and trigger listing, C guard behaviours in a clean order, D wrapper injections, E helper fallbacks) | **PASS 11/11** (the diagnostics are quoted in section 3) | TAP sha256 `2c8e154e868f2d8feaeab2239c2bf46da2291bf6c3ac842fb8843930503cf1bf`; probe copy `scratchpad/claude_s12_review_v13/probe.sqlinc` sha256 `e1ece6297feddbbda961ac3e45e373cad5c8d80374884d9e5b25626e5b2ca27a` |

Process note (mine): R1 held the ALT lock for about 22 minutes because I put the 12-minute real-wait suite `phase_02_slice_12_governed_schedule_ladder.sql` and the
75-second `gaps_db1_schedule_fire.sql` in the list. I should have left them out; every other lane queued behind it. The probe file lived at
`supabase/tests/zz_review_v13/probe.sqlinc` (an `.sqlinc`, so no recursive `.sql` run could pick it up) for 14 minutes and is deleted (`git status` shows no
`zz_review` path). I touched no other worktree file; coverage output went to my scratch directory.

Non-ALT checks:

| What | Result |
| --- | --- |
| Vitest, web (designer, composition-instances, editorial-workflow, governed-review, composition, proxy node-pointer test) + Worker node-pointer test | 178 files / 1847 tests passed |
| Vitest, Worker `cms-composition`, `cms-composition-production*`, `production-worker-runtime*` with coverage on the three touched Worker files | 182 files / 3930 tests passed; coverage 100% statements/functions/lines, **183/184 branches** (V13-03) |
| `eslint --max-warnings=0`, `prettier --check` on the 36 TS/TSX files of the web-impl report | clean |
| `tsc --noEmit -p apps/worker/tsconfig.json`, `-p apps/web/tsconfig.json` | exit 0 both |
| `node scripts/verify-bundle-budget.mjs` on the existing `apps/web/dist` (built 19:39, no rebuild by me) | reproduces the lane's "after" bytes exactly for 8 routes; CMS entry editor 92,386 > 92,160 FAIL (section 4.7) |
| SHA-256 of the lane reports' file tables against disk | web-impl 44/45 equal (`CmsPatternNestedPicker.tsx` drifted: the nestable-read lane now owns it, 155 lines vs the reported 37); gaps-db2 41/43 equal (130300 and its README: the table is stale, the final run's manifest shows the final bytes were tested) |

## 3. Findings

### MAJOR

#### V13-01 (MAJOR): 130000 leaves `updated_at` writable outside the governed RPCs (and a poisoned `updated_at` wedges the lifecycle)

- Spec. BE03c:357-358 "lifecycle columns of a version row (`state`, `lifecycle_version`, `activated_at`, `retired_at`, `updated_at`) advance only through the
  governed RPCs"; BE03c:1610 (template) "so `updated_at` moves only with such a transition (DEC-188)"; 1611 (pattern) and 1613 (taxonomy) list the same five
  columns; 1727. The lane's own header (130000:1-2) and its test header (`040-lifecycle.sqlinc:1-2`) quote all five.
- Code. `supabase/migrations-wip/gaps-db2/20261024130000_cms_version_lifecycle_columns_governed_only.sql:29` (the `insertion` constant) tests
  `state`, `lifecycle_version`, `activated_at` and `retired_at` only. The template guard (`20261013100000:178-188`) refuses only a *decreasing* `updated_at`
  (`new.updated_at < old.updated_at`, line 188); the pattern and taxonomy guards exclude `state` and `updated_at` from their whole-row comparison
  (`20261014020200:54-55`, `20261014030100:69-70`). No test updates `updated_at` alone: `040-lifecycle.sqlinc:14-27` and
  `phase_02_slice_12_gaps_pattern/010-storage-and-registry.sqlinc:44-55` cover the other four columns.
- Evidence (probe R4, a draft template, RPC context, no governed flag):
  `C1 updated_at-only bump to clock_timestamp(): 00000 rows=1`; `C7 ... one hour into the future: 00000 rows=1`;
  `C8 governed flag, legal pair review -> approved with lifecycle+1 AFTER the poisoned updated_at: P0001:CONFLICT`. Controls: `C2 state only: CONFLICT`,
  `C3 illegal pair with the governed flag: CONFLICT`, `C5 legal pair without lifecycle+1: CONFLICT`, `C4 legal pair draft->review with lifecycle+1: 00000 rows=1`,
  `C6 DELETE: CONFLICT`. So the guard works for the four columns and the governed path is not blocked, but a direct write can set `updated_at` into the
  future, after which `cms_governed_lifecycle_update` (`20261013300000:86`, `new.updated_at >= old.updated_at`) refuses every governed transition of
  that row, and the guard's fall-through then answers CONFLICT.
- Impact. Needs the same in-RPC-context write that the lane set out to close, so it is not an external attack path; but it is the same defect class on the
  fifth column and the spec names it. Low blast radius, trivial fix.
- Fix (in the untracked file, then rerun the lane): add `or new.updated_at is distinct from old.updated_at` to the condition at line 29 (the governed path
  returns before the insertion, and no promoted writer updates `updated_at` alone: the 20 `update ... cms_(template|pattern|taxonomy)_versions` statements
  in `supabase/migrations/` are all governed helpers or migration backfills, and no test or non-SQL code does either). Add RED rows to
  `040-lifecycle.sqlinc` and the pattern file: a direct `set updated_at = clock_timestamp()` is `P0001:CONFLICT` on a draft template, pattern and taxonomy
  version. Reword the stored comment (see V13-10).

#### V13-02 (MAJOR): 130300 leaves four deadlock-only wrappers, one of them a writer Slice 12 amended

- Spec. BE03b:1754 rule 6: "`deadlock_detected` (and a lock-acquisition failure) is converted to 409 `CONFLICT` in the four writers, both activation commands and
  CMS-03A-17, at the lock steps and at the wrapper"; BE03c:1522 rule 4; AC-276 (tracker line 4196) lists the revision-append carry-over, and V12-01
  (`review-v12-report.md`) is adding position-6 `FOR SHARE` term locks to the same four assigning writers.
- Code. `20261024130300:30-39` converts `platform_api.cms_define_template`, `cms_create_revision`, `cms_resolve_conflict`, `cms_restore_revision`. The
  seven deadlock-only wrappers of `20261005013100_cms_deadlock_typed_conflict.sql` are at lines 32 (`cms_create_entry`), 53, 74, 95, 116
  (`cms_activate_schema`), 137 (`cms_activate_schema_migration`), 158 (`cms_revoke_capability_grant`); the lane converted three of the seven and the header
  (130300:1-9) presents "four wrappers do not" as the whole set.
- Evidence (probe R4, the lane's own `g2_inject` technique). Listing of every `platform_api.cms_*` function that converts `deadlock_detected`: all also
  convert `lock_not_available` **except** `cms_activate_schema`, `cms_activate_schema_migration`, `cms_create_entry`, `cms_revoke_capability_grant`.
  Injection: `D cms_create_entry 55P03 -> 55P03:injected`, `D cms_activate_schema 55P03 -> 55P03:injected`, `D cms_activate_schema_migration 55P03 ->
  55P03:injected`, `D cms_revoke_capability_grant 55P03 -> 55P03:injected`; controls `D cms_create_entry 40P01 -> P0001:CONFLICT`,
  `D cms_create_revision 55P03 -> P0001:CONFLICT`, `D cms_define_template 55P03 -> P0001:CONFLICT`.
- Why `cms_create_entry` is MAJOR: DEC-202 (`20261022010100`, header lines 14-19) added a `FOR SHARE` on the exact default template row (BE03b position 3) to this
  producer, and `20261022010000:7-8` records that "a deadlock is converted ... by the platform_api.cms_create_entry wrapper": a lock timeout on that new
  lock, or on V12-01's position-6 lock, leaves as a raw SQLSTATE. The other three are Slice 9/10 scope (BE03b rule 6) and are MINOR in isolation, but the
  fix is the same four rows.
- Fix. Add the four identities to the `values` list of 130300 with the same anchor pair used for the three revision wrappers
  (`    when deadlock_detected then\n      raise exception 'CONFLICT' using errcode = 'P0001';`; each occurs once), add four `g2_inject` rows (40P01 and 55P03)
  to `phase_02_slice_12_gaps_lock_conversion.sql`, and keep the deadlock handler text byte for byte
  (`phase_02_slice_10_activation_lock_order.sql` pins it). Or record an explicit deferral against BE03b rule 6 and AC-276 with a decision id.

#### V13-03 (MAJOR): the new Worker file breaks the repository's 100% branch-coverage gate

- Gate. `vitest.config.ts` (`coverage.thresholds`: branches/functions/lines/statements 100; `include: apps/worker/src/**/*.ts`; `pnpm validate` runs
  `pnpm test:coverage`). Commit bde7275c closed this threshold for the Worker, so it is live.
- Evidence. Coverage of the three touched Worker files (182 files, 3930 tests): `node-pointer-refusal.ts` 88.88% branches, uncovered line 59; JSON coverage
  of the node-pointer test alone: `cond-expr` loc 59:6-63, counts `[15, 0]`, i.e. the alternate `''` of the `held.map` callback at
  `apps/worker/src/cms-composition/node-pointer-refusal.ts:57-65` (an entry that is not a record with a string `path`) never runs. The two importers
  (`pattern-definition-response.ts`, `cms-composition-production-pattern-definition-latest.ts`) only ever feed it the port's own well-formed output. The lane
  never ran coverage (its report lists vitest, tsc, eslint, prettier only).
- Fix. A direct unit test of `nodePointerWireDetails` with `details.violations = [null, 'x', { path: 3 }, { path: '/blockTree/2' }]` (and one without
  `violations`), or delete the dead alternative by reusing the contracts' `cmsBlockRulesDetails` shape once the helper moves to contracts (V13-08). Rerun
  `pnpm test:coverage`.

### MINOR

#### V13-04: the retitled assertion invalidates an exact-title ledger citation; receipts for the corrected files are stale

`tests/contracts/phase-02-slice-12-evidence-ledger-001-071.ts:823` cites `template_authority.sql` #36 as
`'CMS-03C-01 waits for the same-key transaction lock before first-create read'`. The correction retitles it to
`'... before first-create read, and the lock timeout is the retryable CONFLICT'`. `scripts/evidence/ledger-guard-lib.mjs:372` matches titles exactly ("pgTAP
titles are whitespace-collapsed", otherwise "no receipt"), and any edited file also makes its receipts stale (`fileSha` line 386, `closureSha` line 394).
Condition at promotion: change the citation text at ledger line 823 and re-record receipts for `phase_02_slice_12_template_authority.sql`,
`phase_02_slice_12_fix_template_per_owner.sql` (+1 new passing sibling assertion, the control) and the 18 new gaps entrypoints. The lane rules forbade the lane to edit
the ledger; this is root's step.

#### V13-05: CMS-03C-01 still takes no position-4 lock; position 1 is proven dynamically only by my probe

- Spec. BE03c:1507, row "CMS-03C-01, CMS-03C-12, CMS-03C-16": position 1 grant rows `FOR SHARE`, position 3 parent row `FOR UPDATE`, **position 4 the content-type
  version rows the definition names `FOR SHARE`**. `cms_define_template` (`20261013100200:120-133`) reads the named types and their active versions with plain
  SELECTs; the only `for update` is the parent row (`:147`) and the digest locks block definition rows (`cms_template_block_digest`), not content-type versions.
  Probe A: `CTV xmax before: 2859`, `CTV xmax after: 2859` (a taken lock would have turned it into a multixact, as it did for the person and tenure rows).
  A concurrent schema activation can therefore switch the type between the compatibility read and the commit; the draft records a stale compatibility that
  submit/activation later rechecks, so this is a bounded anomaly, not a lost write. 130200's header cites the whole CMS-03C-01 row and rule 1 but implements and tests position 1 only (`gaps_lock_sources` asserts 1 before 3), and the lane's AC-276 outcome row records the writer as order-proven.
- Position 1 itself (what 130200 adds) is real: probe A, `XMAX before: grant:0,othertenure:0,person:2859,tenure:2859` and `XMAX after:
  grant:2862,othertenure:0,person:1,tenure:1`: the designer grant row goes from unlocked to locked by the define call, person/tenure rows gain a second
  locker (multixact), another member's tenure row stays unlocked. That is the PAT-031 check the lane's static `gaps_lock_sources` test cannot make (a
  `FOR SHARE` that silently locks zero rows under forced RLS would pass a source scan). I attribute the new grant lock to 130200 by code: nothing else in
  the define path touches `organization_actor_grant` (`cms_template_designer_authorized` is a plain read); I did not run a promoted-only control.
- Still missing: a race pair "template define versus designer-grant revocation" (BE03c:1519 rule 1; BE03c:1816 lists other pairs). Recommend adding it to
  root's race set; no lane may run `*.race.mjs`. Also add `FOR SHARE` on the active content-type version rows named by `compatibleTypeIds` (ascending id,
  after position 1, before or with position 3 per the table) as a forward migration, or record the deferral.

#### V13-06: 130300 claims byte-for-byte invertibility but does not check it

130300:11-12 and the README say "inverse restores the installed source byte for byte". The other five migrations enforce it (130000:53, 130100:45,
130200:42, 140100:69-79); 130300 only counts each anchor (`:57`) and compares pg_proc attributes (`:68-70`), with no `replace(new_source, anchors_new[i],
anchors_old[i])` comparison. The property does hold for the four wrappers (each new anchor contains its old anchor), so this is an unenforced claim. Add
the reverse loop of 140100 or drop the sentence.

#### V13-07: the cycle and chain offenders re-run the nested closure once per request pattern node

`20261024140000:54-71` and `:105-122` evaluate `cms_pattern_nested_closure(owner, jsonb_build_array(scanned.node))` for every `kind = 'pattern'` node and
`order by node_path limit 1` cannot short-circuit it. The function is `stable security definer`, so it is not inlined. The producer already computes the closure
for the whole tree several times; on the refusal path this adds up to 512 closure evaluations (a forest holds at most 512 literal nodes). Bounded, refusal path
only, authorized designer only, and I did not measure it (it needs a lattice of governed-activated patterns). Cheap fix: `select distinct` the request's
(patternId, patternVersion) pairs before the per-node closure, or seed one recursive CTE with the origin node path.

#### V13-08: the pointer grammar helper exists three times (extensibility rule)

`apps/worker/src/cms-composition/node-pointer-refusal.ts:50-67` and `apps/web/src/server/cms-pattern-node-pointer.ts:17-42` are the same function
(`NODE_POINTER_REASONS` is also declared twice), and `pattern-designer-node-pointer.ts` repeats the grammar. `.claude/rules/extensibility.md` rejects copy-paste, and
DEC-210 set the precedent of keeping this in contracts (`cmsBlockRulesDetails`, `CMS_BLOCK_RULES_POINTERS`). The lane was told contracts were frozen and filed it as
request 5; `briefs/bundle-headroom.md` already assigns the consolidation. Keep it a condition of closing the web work; it also removes V13-03's dead branch.

#### V13-09: AC-271 is wired into 5 of 8 surfaces, and the route-budget state is red

Implemented: governed review detail island, composition diff read, pattern selector further-page read, template latest check, pattern latest check
(`CmsLoadingRegion.tsx`, 249/250 ms fake-timer tests). Not wired, by the lane's own admission: `CmsGovernedReviewPanel` subject re-read,
`CmsTaxonomyConflictPanel` and `CmsTaxonomyTermChoice`, although FE03:1046 requires the skeleton for `cmsTaxonomyVersionsRead` and `cmsTaxonomyTermsRead`. A
route budget is a real constraint but not one of the `boundary-not-placeholder` reasons; it is tracked by `briefs/bundle-headroom.md`. Bundle facts
(section 4.7): `pnpm bundle:check` fails today on the CMS entry editor (92,386 > 92,160, over before this lane's change per its measurements), and the taxonomy
edit route has 119 B of headroom, so the three remaining wirings cannot land until headroom is restored.

### NIT

- **V13-10** 130000:29 comment: "(outside it the write guard answers DIRECT_CMS_TABLE_WRITE first)". Probe B lists `cms_pattern_versions_lifecycle_guard` and
  `cms_taxonomy_versions_lifecycle_guard` ahead of their `*_write_guard` triggers (same BEFORE ROW type 31); Postgres fires them alphabetically, so the lifecycle guard
  runs first and the write guard still refuses afterwards, and the template has one trigger that answers `FORBIDDEN`. The outcome is unchanged; the comment is not.
- **V13-11** `lane-gaps-db2-report.md`: the file table still carries the pre-rework `ee033b5a...` (75 lines) for 130300 and `4ea4fb5e...` for its README (disk:
  `779992a1...`, 77 lines; `036f09cf...`), although `## Follow-ups` says "File sha256 in the table above". The final run's manifest proves the final bytes
  were tested. The `## Test corrections` section still reads "none" while two corrections are listed under `## Follow-ups`. The backup tar named there
  (`scratchpad/claude_s12_gaps_db2/orig-234845.tar`) was wiped with the scratch directory, so the pre-rework 130300 cannot be restored.
- **V13-12** `use-composition-insert.ts` `loadMore`: the restart decides `stale` from `fields.item` captured when the callback was built; a choice made while the
  two reads are in flight is cleared if the older choice is not on page one. Low probability, clearing is the safe side.
- **V13-13** FE03:1046 says "Skeleton after 250 ms; forms disabled": the island disables forms only once `canonical.loading` (after 250 ms) is true, so a
  command can still be submitted in the first 250 ms of a refetch (server CAS still protects it; same as before the lane). The status line is also inserted
  already filled; the repository elsewhere mounts live regions empty first (the lane's own `CmsPatternConflictPanel.tsx:60` comment: "Mounted empty with the panel so a 429 is announced when its text arrives"). Real-route specs filter the status regions by text
  (`phase-02-slice-12-template-real-route.spec.ts:75`), so the additional `role="status"` lines do not break them.
- **V13-14** `CmsPatternNestedPicker.tsx` (reported 37 lines, sha a292b18e) is now 155 lines owned by the nestable-read lane; the web-impl BOUNDARY edit no longer
  exists on disk. `tests/contracts/phase-02-slice-12-closeout.test.ts` pins that marker; that is the nestable-read promotion's business, noted so it is not
  attributed to this lane.
- **V13-15** `phase_02_slice_12_gaps_lock_conversion.sql` replaces the private body, so it cannot show the "same `Idempotency-Key` reusable" clause for a converted
  body failure (the reservation lives in the replaced function); it holds by construction (the nested block rolls the reservation back). The advisory path is
  observed for real by `template_authority` #36, whose second call with the same key succeeds.

## 4. The brief's checks, one by one

### 4.1 Spec conformity and the guards against legitimate paths
- 130000 refuses a non-governed move of `state`, `lifecycle_version`, `activated_at`, `retired_at` inside the RPC context (probe C2, C3, C5 CONFLICT) and keeps
  the governed path (probe C4 `00000 rows=1`). Every promoted writer is governed: `submit` (draft->review), `move` (review/approved/scheduled/draft/blocked),
  `activate`, `supersede`, `retire`; the lane's `g2_writers_of_versions()` oracle pins that list. All suites that exercise submission, decision, activation,
  scheduled execution (+ the 12-minute retry ladder), blocked recovery, invalidation (recheck and person invalidation), supersession and retirement ran in R1
  against the **final** 130000 bytes and passed: `governed_submit` 74, `governed_decision` 58, `governed_activation` 124 (incl. `095-retire`), `governed_schedule` 56,
  `governed_schedule_ladder` 24, `governed_recheck` 157, `governed_recheck_pattern` 21, `governed_retire_pattern` 69, `governed_assignment` 68, `governed_fix` 36,
  `governed_fix3` 42, `gaps_db1_governed` 33, `gaps_db1_schedule_fire` 28, `gaps_db1_recheck` 18, `pattern_definition` 343, `pattern_updates` 1490, `linked_scan` 347.
  The lane's regression of the suites whose fixtures write lifecycle columns directly (`helpers_manifest`, `criteria_publish_gates`, `recheck_run`, S09 `dec108_resolver`,
  `p241_dec123_successor_binding`) ran only against an **earlier** 130000 (run 070752, manifest `alt-staged-gaps-db2-070752`: `bb9ad9f8...`, not the final `3fd2325f...`) and
  are absent from its final 47-file run; I reran all five against the final bytes (R1: 92, 35, 52, 17 and 46 tests) - green.
- 130100 matches BE03c:1751 exactly. The promoted producers emit `cms_template_version` / `cms_pattern_version` / `cms_taxonomy_version`
  (`20261014070200:109-117`, `20261014160100:98-106`) and `cms_term` (`20261014120500:132`, `20261014190030:145`); no WIP producer exists. No stranded
  rows are possible on a fresh database, and Slice 12 is not deployed anywhere. Relay-related suites in R1 (S09 `p240`, `g1_consumer_boundary`, `persistence_runtime`,
  S11 `recheck_relay`, `outbox_relay_poison`, `assign_event_delivery`) all pass.
- 130200 inserts `cms_lock_governed_authority(actor_id, acting_party_id, 'cms.template_designer')` before the capability check, the same call CMS-03C-12 and -16 use;
  it returns silently for an unresolvable actor so the refusals are unchanged; it can only lock the caller's own person/tenure/grant rows (no lock lever on
  others; probe A `othertenure:0`). See V13-05 for position 4 and the missing race.

### 4.2 Anchored patches, inverse checks, newest live definitions

| Migration | Function | Newest promoted definition (anchor) | Anchors / inverse |
| --- | --- | --- | --- |
| 130000 | `cms_template_versions_guard()` | `20261013100000:138-196`, early return added by `20261013300000:109-152`; anchor `:175` | 1 each; inverse `:53`; attributes `:62-67` |
| 130000 | `cms_pattern_versions_lifecycle_guard()` | `20261014020200:13-60`; anchor `:51` | same |
| 130000 | `cms_taxonomy_versions_lifecycle_guard()` | `20261014030100:21-75`; anchor `:66` | same |
| 130100 | `claim_outbox_batch(uuid,integer,integer)` | `20261010164000:40-...` (regex alternative `:78-80`) + `20261014050800:30-32` | 1; inverse `:45`; attributes `:55-57` |
| 130200 | `platform_private.cms_define_template(jsonb)` | `20261013100200:37-...` (authority check `:64`), digest token `20261014180000` | 1; inverse `:42` |
| 130300 | `platform_api.cms_define_template(jsonb)` | `20261003120410:66-91` | 2 anchors, **no inverse** (V13-06) |
| 130300 | `cms_create_revision`, `cms_resolve_conflict`, `cms_restore_revision` | `20261005013100:40-101` (handlers `:53`, `:74`, `:95`) | 1 each, **no inverse** |
| 140100 | `platform_private.cms_create_pattern_version(jsonb)` | `20261014020400:27-...` anchors `:124`, `:211`, `:217`, `:230`, after `20261022080200` | 4; inverse loop `:69-79`; attributes `:89-93` |

All anchors matched the live sources in the combined reset (R1, 20 WIP files). Idempotency markers are present in 130000-130300; 140100 is not idempotent (it
raises when re-run), like its precedent 20261022080200, and runs once.

### 4.3 Overlap and ordering with sibling WIP dirs
A grep of every promoted and WIP migration for the patched identities finds no second patcher: taxonomy-integrity amends the **private** bodies
`cms_create_entry`, `cms_create_revision`, `cms_resolve_conflict`, `cms_restore_revision` (100600, 100800), not the `platform_api` wrappers 130300 amends;
placement-perf replaces `cms_pattern_placement_path_allocation`, `cms_block_rules_violation`, `cms_revision_effective_state`,
`cms_composition_instance_resource`, `cms_insert_pattern_instance`; nestable-read has no SQL. R1 applies all 20 together and 80 files pass, including both
taxonomy-integrity drivers (139 and 49 tests) and the placement-perf equivalence suites (50 and 16). The 8 oracle files that taxonomy-integrity contradicts by
design were excluded (`phase_02_slice_11_helpers_preflight.sql` among them); the previous combined run (19:05) had staged an older 130300 (`7eb3b8db`).

### 4.4 Lock order and SQLSTATE coverage
- Order: 130200 yields 1 (grant rows) -> 3 (parent `FOR UPDATE`) as `lock_sources` asserts and as probe A shows dynamically; the wrapper takes the same-key advisory
  lock before position 1. I found no cycle: the revoker takes 1 `FOR UPDATE` and then the subject and review rows; the define call holds only the advisory key while it waits
  for 1, so it holds nothing the revoker needs. The governed lineage advisory lock lives in another key space (`cms.governed.lineage:` vs `cms.template:`).
  Position 4 is the open item (V13-05).
- SQLSTATE: converting exactly `40P01` and `55P03` is right. **57014 is not meant to convert**: BE03c:1522 and BE03b:1754 name deadlock and a lock-acquisition failure;
  `lock_timeout` expiry and `NOWAIT` failure are `55P03`; the 30 other wrappers that convert lock failures (probe B) and DEC-221's `20261022120000:12` ("57014 ... deliberately NOT named") leave it out;
  PL/pgSQL `WHEN OTHERS` does not trap it, trapping it by name would hide a statement timeout behind a retryable conflict and let the command continue past its
  deadline; the Worker maps an unconverted 5xx to a retryable 503 (`cms-composition-production-pattern-definition-latest.ts:70`). I found nothing in the migrations
  or the config/TS/MJS/JSON/YAML files that sets a role-level `lock_timeout`, so in production a blocked writer ends at the deadlock detector or the statement timeout unless
  operations configure one; that is a setting outside these files.

### 4.5 PAT-031 (context-cleared entry points) and the trigger-disabling helper
- `phase_02_slice_12_gaps_lock_conversion.sql` clears `app.cms_rpc` before every wrapper call (`g2_inject`: `set_config('app.cms_rpc','',true)`); the guards are triggers, not
  entry points; the node-pointer helpers run inside the producer, whose first statement sets `app.cms_rpc` (`20261014020400:55`). Gap closed by probe A for the one
  entry point whose proof was static.
- `pg_temp.s12fix_priv` (`fix_template_per_owner.sql:256-271`) disables `user` triggers of `platform_private.cms_template_versions` for one statement inside a
  sub-transaction; on error the sub-transaction rollback reverts the `disable` (DDL is transactional), on success the next statement re-enables. It is a
  `pg_temp` function of that file, called twice (lines 274 and 280), not an include, so it has no reach beyond that test's transaction; foreign keys, CHECKs and the
  partial unique index still apply; no `ENABLE ALWAYS`/`REPLICA` trigger exists in the migrations (so `enable trigger user` restores the exact prior state); the
  precedents `s09d_timewarp` (`phase_02_slice_09_dec108/00-helpers.sqlinc:183`) and `h11_raw_exec` (`phase_02_slice_11_helpers/000-helpers.sqlinc:126`) use the same
  technique. It cannot hide a defect of 130000: the refusal of a direct state move is proven separately by the new `040-lifecycle` rows and probe C2.

### 4.6 Web changes against FE03 (working-tree line numbers)
| FE03 requirement | Implementation | Verdict |
| --- | --- | --- |
| 886: cycle, depth, node-count refusal "render inline with the node path"; summary "links to the node" | SQL pointer -> Worker (one pointer, grammar `CMS_BLOCK_RULES_POINTERS['CMS-03C-12']`) -> proxy -> `nodePathOf` -> `nodeAt`; falls back to the tree link; tests: pgTAP 122, Worker (11 cases x 3 reasons), proxy, designer unit + component | conforms; V13-08 |
| 927: unsaved changes: retain draft, inline confirmation, `beforeunload` only while dirty, clear after success or discard | `use-composition-page.ts` guard on the document, `CmsCompositionLeaveConfirm`, `dirty` against a baseline reset after success; `CmsCompositionPage.unsaved.test.tsx` (252 lines) | conforms |
| 1049: a 409 cursor conflict restarts from the first page | `use-composition-insert.ts` `loadMore` restart once, stale pin cleared and said; `selector-restart.test.tsx` (5 tests incl. second conflict is a plain failure) | conforms; V13-12 nit |
| 1050: degraded diff is never kept; unknown outcome reconciles by refetching the entry before any retry | `readEntryFacts` before the retry copy, key and request unchanged; degraded-diff test (503 and unverifiable); insert test corrected | conforms |
| 46, 1046: skeleton after 250 ms, forms disabled | `useLoadingDelay` (249/250 ms tests) in 5 islands; `useCanonicalResource().loading` | partial: V13-09, V13-13 |
| 880: "Needs an independent reviewer's approval" | `governed-state-labels.ts` | conforms |

Contracts accept the new wire output: `CmsCompositionRefusalDetailsSchema` allows `violations` on `pattern_cycle`, `pattern_depth_exceeded`, `pattern_nodes_exceeded`
(`packages/contracts/src/cms-composition/refusals.ts:242-270`) and `CmsViolationSchema` fits `{ path, code, message }`. Specs the lane lists for root to rerun
(`template-real-route`, `template-edit`, `template-uncertain-real-route`, `governed-review-real-route`) are right; none is run by me.

### 4.7 Bundle impact (named, and corroborated)
The existing dist (built 19:39) reproduces the lane's "after" column exactly: composition 80,862; pattern create/edit 82,214 / 87,826; template create/edit 71,959 /
80,341; review detail 89,140; entry workflow 88,723; taxonomy edit 92,041 (budget 92,160, 119 B headroom). **CMS entry editor 92,386: FAIL**, which the lane
measured as unchanged by its work; `use-cms-workflow-canonical.ts` (modified) is the only touched module that could reach more islands, and the lane's before/after
bytes for the editor are identical. I did not rebuild and did not measure a baseline; the bundle-headroom brief is the authoritative remeasurement.

## 5. Test corrections

| # | File / assertion | Verdict | Reason |
| --- | --- | --- | --- |
| 1 | `phase_02_slice_12_fix_template_per_owner.sql` (before `259189d8...` = HEAD, after `08e7521a...`): two `update ... set state = 'active'` run through `pg_temp.s12fix_priv`; +1 control assertion | **ACCEPT** | Assertion text and expected `23505` unchanged; the direct move is now refused by design (AC-195), so the partial unique index (AC-191) can only be reached with the user triggers off for one statement; helper scope and technique in 4.5; the added control makes the 23505 non-vacuous. A stronger fixture would drive `cms_governed_move_subject`/`cms_governed_activate_subject` with triggers on, but the latter converts the violation to `activation_conflict`, which would change the asserted SQLSTATE. |
| 2 | `phase_02_slice_12_template_authority.sql` #36 (before `0cdd943b...` = HEAD, after `8d848013...`): raw `55P03` -> `P0001:CONFLICT`, title extended | **ACCEPT** (+ V13-04) | BE03c:1522 rule 4. Still proves the call waits: with no wait the call would succeed (`00000`) or hit `23505`, and `P0001:CONFLICT` cannot arise on a first create otherwise; strictly more specific (state and message). The title extension is the only side effect (ledger). |
| 3 | `CmsGovernedReviewPanel.test.tsx` `review` row copy | **ACCEPT** | FE03:880 quotes the sentence; production label changed with it. |
| 4 | `CmsCompositionPage.insert.test.tsx` "reuses the Idempotency-Key" | **ACCEPT** | The entry read FE03:1050 now requires is scripted; the key assertions are unchanged and read from POST calls only. |

## 6. Not verified

Canonical `db:verify`/`validate`, every `*.race.mjs` (none exists for define-vs-revocation), Playwright real-route specs, the full Worker and web suites, a bundle
rebuild, the ledger guard itself (I read its matching rule), the closure amplification of V13-07 (unmeasured), the other ~500 pgTAP entrypoints, and the eight oracle
files taxonomy-integrity contradicts. Probe A has no promoted-only control run.

## 7. Requests to root (ordered)

1. Promote as they are: gaps-db2 130100 (`67f2e06f...`), 130200 (`9cd2c159...`) and node-pointers 140000 (`36b3db2f...`), 140100 (`d6b778af...`). Fix V13-01 and V13-02 in the
   untracked 130000/130300 first (or record deferral decisions), rerun the lane through the staged runner with the overlay above; their hashes (`3fd2325f...`, `779992a1...`) then change.
2. Close V13-03 before the web/Worker promotion (unit test or move the helper to contracts) and run `pnpm test:coverage`.
3. At promotion edit `tests/contracts/phase-02-slice-12-evidence-ledger-001-071.ts:823` to the new #36 title and re-record receipts (V13-04).
4. Fold V13-08 into the bundle-headroom lane; keep AC-271 open for the three taxonomy components until `pnpm bundle:check` is green.
5. Add a race pair define-vs-designer-revocation and decide the CMS-03C-01 position-4 lock (V13-05).
6. Memory candidates for root (I write none): "a claimed full sweep must be a catalog query, not a recollection (V13-02)"; "a header that claims an invariant must carry its
   check (V13-06)"; "a retitled assertion breaks an exact-title ledger citation (V13-04)"; "a gate that was green at HEAD (100% Worker coverage) needs a run per lane (V13-03)".

## Verification

Reviewer: claude_s12_review_v13, round 2, 2026-10-28 (EDT). Instruction (root): verify V13-01, V13-02 and the MINOR/NIT dispositions against the current bytes
(`## V13 follow-ups` of `lane-gaps-db2-report.md`, sha256 `f8fe48b52f817e3dd6fd2f7da52039de6b152272dd786cf93d5be865b6fd6b3a`, the SHA root quoted) and review the new
`20261024130400_cms_definition_writers_lock_position4.sql` with its two tests. Everything below was read from the working tree (HEAD `cd89d54c`) or produced by my own
runs of the staged ALT runner. I edited nothing but this file; the probe and the four scratch mutant lanes were created and deleted again (`git status` shows no `zz`
path, `supabase/migrations-wip/` holds only the five real lane directories). The lane report's Files table equals disk: **46/46 rows** equal on sha256 and line count.

### V.1 Verdicts

| Item | Verdict | Condition |
| --- | --- | --- |
| `gaps-db2/` as a directory (5 SQL files) | **PROMOTE-WITH-CONDITIONS** | root/ledger steps only, no SQL change: V13-04 (ledger line 823 + receipts) and V13-16 (fix the static helper, or do not cite static #5/#6); see V.7 |
| - `20261024130000` lifecycle columns, sha `33b73ee9a1b3448c` | **PROMOTE** | V13-01 and V13-10 closed |
| - `20261024130100` relay claim aggregates, sha `67f2e06f99f6cba4` | **PROMOTE** | unchanged since round 1 |
| - `20261024130200` CMS-03C-01 position 1, sha `9cd2c1596925b366` | **PROMOTE** | unchanged since round 1 |
| - `20261024130300` wrapper lock-failure conversion, sha `db3f675269c5d5ea` | **PROMOTE** | V13-02 and V13-06 closed; V13-04 is a ledger edit made in the promotion commit |
| - `20261024130400` position 4 for CMS-03C-01 and CMS-03C-16, sha `91993604cf0147e6` | **PROMOTE** | none on the SQL; its static test has V13-16 |
| `node-pointers/` (140000 `36b3db2f`, 140100 `d6b778af`) | unchanged, **PROMOTE** | not re-reviewed; bytes equal round 1 (staged manifest); composes with 130400 (V.3) |
| web-impl Worker / web changes | not part of this round | V13-03, 07, 08, 09, 12, 13, 14 keep their round-1 status |

New in this round: **0 BLOCKER, 0 MAJOR, 1 MINOR (V13-16), 3 NIT (V13-17, V13-18, V13-19)**. Round-1 MAJORs V13-01 and V13-02 are CLOSED.

### V.2 Closure of the round-1 findings that concern gaps-db2

| Id | Status | Evidence against the current bytes |
| --- | --- | --- |
| V13-01 (MAJOR) `updated_at` guard | **CLOSED** | 130000:31 adds `or new.updated_at is distinct from old.updated_at` to the condition (all five BE03c columns), inside `tg_op = 'UPDATE' and app.cms_rpc is not distinct from 'true'`, after the governed early return and before the terminal-state test (anchor `:29`), for all three guards in the one loop (`:33-70`); marker `:30/:43`, inverse check `:54-57`, whole-`pg_proc`-row comparison except `prosrc` plus comment `:64-69`. Probe A1: all three installed guards carry the five-column text (3/3). Probe A2 (template guard, `app.cms_rpc=true`): direct `state` write, `updated_at` now / +1 h / -1 s: `P0001:CONFLICT`; an UPDATE that changes no lifecycle column: accepted (control); governed flag with illegal pair, or legal pair without `lifecycle_version + 1`: CONFLICT; legal draft->review then review->approved: accepted (the lifecycle is not wedged); DELETE: CONFLICT (10/10). Lane tests for the other two guards pass: `gaps_governed_basis` #44-#48 (taxonomy poisoning persisted then governed approval still moves it), `gaps_pattern_governed` #24-#26. No auto-`updated_at` trigger exists (no `moddatetime`/`new.updated_at :=` in any migration); the promoted functions that UPDATE the three tables are the governed submit, close, activation-helper and retire-apply functions (`20261013300800`, `20261013300820`, `20261014010000`, `20261014070000`, `20261014160100`), and the only other UPDATEs are two migration-time lineage backfills (`20261013100000:42`, `20261014030000:104`). |
| V13-02 (MAJOR) four deadlock-only wrappers | **CLOSED** | 130300:36-49 lists eight wrappers (define, create_revision, resolve_conflict, restore_revision, **create_entry, activate_schema, activate_schema_migration, revoke_capability_grant**). The seven non-define live wrappers are 15-line bodies (`20261005013100`) whose only locking statement is the private call inside `begin ... exception when deadlock_detected`; none has an advisory wait (checked by extracting each last live definition), so the added `when lock_not_available then raise exception 'CONFLICT' using errcode = 'P0001'` is the whole conversion. Catalog sweep (probe B1, not a recollection): 34 `platform_api` functions mention `deadlock_detected`, **0** lack `lock_not_available`, N of N. Injection (probe B2, the private body replaced to raise a chosen SQLSTATE; the Worker activation command by its private name `cms_worker_activate_schema`): 8 wrappers x {40P01, 55P03 -> `P0001:CONFLICT`; 57014 -> `57014:injected` (DEC-221, not converted); XX000 -> `XX000:injected`} = **32/32 ok**. Lane `gaps_lock_conversion` 62/62, `template_authority` 70/70 (#36 expects the conflict), `phase_02_slice_10_activation_lock_order` ok (the byte-for-byte deadlock text it matches is preserved). Residual, informational: six `platform_private` lock helpers still handle deadlock only (`cms_lock_activation_identity_authority`, `cms_lock_activation_review_rows`, `cms_lock_entry_rows_shared`, `cms_lock_relation_target`, `cms_worker_human_approval_evidence_valid`, `cms_worker_human_approval_valid`); a `lock_not_available` from them propagates to the wrapper above, which now converts it. |
| V13-06 (MINOR) unenforced invertibility | **CLOSED** | 130300:72-78 computes the inverse per wrapper (new anchors back to old, reverse order) and raises 55000 unless it equals the installed source. Proved by mutation, not by reading (mut6): with the `cms_create_entry` new anchor replaced by the single word `begin` (non-injective), the reset stops at 130300 with `wrapper: non-anchored change in platform_api.cms_create_entry(jsonb) (SQLSTATE 55000)`. |
| V13-10 (NIT) comment | **CLOSED** | the inserted source comment (130000:31) and the header (`:1-15`) no longer say which guard answers first; they say only that outside the RPC context the write guard of the table refuses the write. |
| V13-11 (NIT) stale lane report | **CLOSED** | Files table 46/46 equal to disk (sha256 and lines); `## Test corrections` now names the two corrections with before/after hashes; the pre-rework tar is gone and cannot be restored (disclosed by the lane). Residue: V13-18. |
| V13-15 (NIT) key reuse | **ACCEPTED** | by construction: the wrapper's sub-transaction rolls the reservation back; the advisory path is observed for real by `template_authority` #36 whose second call with the same key succeeds. The same construction covers the new position-4 timeout (the taxonomy wrapper `20261014030300:22-26` already handles `deadlock_detected or lock_not_available`). |
| V13-04 (MINOR) ledger | **OPEN, root step** | `tests/contracts/phase-02-slice-12-evidence-ledger-001-071.ts:823` still carries `'CMS-03C-01 waits for the same-key transaction lock before first-create read'`; the test title (`template_authority.sql:242`) is `... first-create read, and the lock timeout is the retryable CONFLICT`. The exact-title guard fails at promotion until root edits line 823 and re-records receipts for the two corrected files and the 20 gaps-db2 entrypoints (hashes in the lane report). The lane cannot do this (lane rules). |
| V13-05 (MINOR) position 4 | **CLOSED for CMS-03C-01 and CMS-03C-16** | implemented by 130400, reviewed in V.3, proved by the race file and by mutants (V.4). Two of my own round-1 statements about it are corrected in V.6. |
| V13-03, 07, 08, 09, 12, 13, 14 | not in this round | web-impl / other lanes (the lane report says "not my files"); status as in round 1. |

### V.3 Review of 130400

**What it does.** Two anchored insertions (`:32-39`), each `perform 1 from platform_private.cms_content_type_versions version_row where version_row.id in (select bound.version_id from platform_private.cms_governed_bound_versions(...) bound) order by version_row.id for share of version_row;`:
CMS-03C-01 (`:35`) before `new_row_id := extensions.gen_random_uuid();` (promoted `20261013100200:164`; after the parent `for update` `:147` and the CAS), followed by a re-proof (count of distinct bound content types <> count of distinct named uuids -> `VALIDATION_FAILED`, `P0001`); CMS-03C-16 (`:38`) before the comment `-- 9 the draft, its audit record ...` (promoted `20261014030200:186`, after `-- 8 position 3 and the CAS` `:167`), lock only.

**Spec.** BE03c:1507 row "CMS-03C-01, CMS-03C-12, CMS-03C-16": 1 grant rows FOR SHARE, 3 parent row FOR UPDATE, 4 the content-type version rows the definition names FOR SHARE; "within one position a command locks rows in ascending `id` order" (`order by version_row.id`); rule 1 (BE03c:1519) lock before write and capability re-proved under the position-1 locks (130200, S4a/S4b); rule 4 (:1522) deadlock and lock failure -> the operation's 409 (130300 for define, `20261014030300` for taxonomy). Placement is after 1 and 3 and before the first write in both writers; the statement is the same shape as the governed machinery's own position 4 (`cms_governed_lock_graph`, `20261013300400:156-163`) and as CMS-03C-12's (`20261014020400:162-172`), so a definition and its review serialize on the same rows (verified in the sources, not only in the lane's header).

**Helper.** `cms_governed_bound_versions` (`20261013300300:212`) is STABLE SECURITY DEFINER plpgsql: template kind joins `typeIds` to the owner's ACTIVE types and their ACTIVE version; taxonomy kind joins `typeKeys` by `type_key` inside the owner scope. The template predicate is exactly the unlocked loop's (`20261013100200:120-133`: owner, type active, an active version exists) and the refusal is that loop's own (`:132`, plain `VALIDATION_FAILED`, no detail), so the claim "no new refusal" is true. A STABLE function sees the calling statement's snapshot, and (PostgreSQL EvalPlanQual rules, my reasoning, not separately tested) `FOR SHARE ... WHERE id IN (subquery)` keeps the original snapshot's id set after a wait, so the locked row set is the pre-wait one; the re-proof is a separate statement with a fresh READ COMMITTED snapshot and sees the committed outcome. S3 is consistent with that and mut5 shows it needs the re-proof.

**CMS-03C-16 never refuses an unknown type key.** By construction the insertion is a `perform` with no `if`/`raise`; unknown, inactive or foreign keys simply bind no row. Dynamic proof (my probe, transactional world): a taxonomy naming only unknown keys, one known and one unknown key, and the known key are all `00000` (tests #42-#45); the promoted taxonomy-definition suite creates one with 64 `type_i` keys that bind nothing and still passes in v1. A define naming an unknown type id is still `P0001:VALIDATION_FAILED` and writes nothing (#46-#47).

**Deadlock paths.** (1) The writers take 1 (S) -> 3 (X on their own parent row) -> 4 (S); the governed machinery (3 -> 4 -> 5), CMS-03C-12 (3 -> 4) and the entry writers (3 -> 4 -> 5) use the same order, so no writer takes a type version row before a template/pattern/taxonomy row. (2) The writers that UPDATE or `FOR UPDATE`-lock a type version row are the schema-lifecycle commands (activation, review decision, migration switch, drift recovery, dry run, locale producers): grep finds 28 promoted migrations that `update platform_private.cms_content_type_versions` and 22 older ones that row-lock it; none of those mentions `cms_template_versions`, `cms_pattern_versions` or `cms_taxonomy_versions`, except one `to_regclass` existence check (`20260902080000:627-628`, no row access). So there is no edge from "type version held" back to a definition parent row, which a deadlock cycle needs. (3) A real activation takes `FOR UPDATE` on every tenure and grant row of the owner organisation first (`cms_lock_activation_identity_authority`, `20261005013000:50-104`), which conflicts with the definition writers' position-1 FOR SHARE on the same rows, so activation and definition already serialize at position 1 and position 4 can only block against a locker that bypassed position 1 (S1 forges one). Production contention added by 130400 is therefore close to nil; its value is the BE03c order and the re-proof. (4) Same-key defines serialize on the wrapper's advisory lock; different keys share only S locks. (5) If a wait does exceed `lock_timeout`, or a deadlock is chosen, the wrappers answer the typed 409 with the sub-transaction (and the idempotency reservation) rolled back.

**Anchors, inverse, composition.** Anchor counted exactly once (`:54-56`), inverse replacement must restore the installed source (`:57-60`), `pg_get_functiondef` occurrence once (`:61-64`), `pg_proc` row except `prosrc` and the comment unchanged (`:66-71`), attributes checked first (`:50-53`), marker `BE03c lock order position 4` (`:30`, `:46`). Timestamp order is 20261024100000-100800, 20261024130000-130400, 20261024140000-140100, 20261024150000-150400, 20261027100000-100020. 140100 and 100020 anchor only on `cms_create_pattern_version(jsonb)` and `cms_pattern_latest(jsonb)`; 130400 anchors only on `cms_define_template(jsonb)` and `cms_create_taxonomy_version(jsonb)`; nothing shares anchor text. Evidence: the two overlay resets with the real files (v1, v2) applied the 24 WIP migrations in that order (`reset ok`; the three mutant resets applied 24 as well), the staged manifest of v1 shows 130000 `33b73ee9`, 130100 `67f2e06f`, 130200 `9cd2c159`, 130300 `db3f6752`, 130400 `91993604`, 140000 `36b3db2f`, 140100 `d6b778af`, 100020 `54ba1b2d`, and the static oracle sees CMS-03C-12 with position 4 intact on the overlay where 140100 and 100020 have rewritten it (#7-#9 ok). Only timestamp order was run; independence in the other order is by anchor analysis. The stored comments of the two writers are preserved on purpose (`:49`, `:69`) and do not mention position 4 (V13-18).

### V.4 The two new tests, and the mutants that show what they catch

Race file (`phase_02_slice_12_gaps_lock_position4_race.sql`, 347 lines, sha `48204e91c8440fa6`), run alone: **18/18 PASS, 9 s** (S0 control; S1 holder owns FOR UPDATE on the active type version row: define and taxonomy `P0001:CONFLICT` after the 1 s timeout and the define spent it waiting; S2 holder releases after 2 s: the define waited >= 1 s and wrote one draft; S3 holder supersedes and commits after 2 s: the waiting define is `VALIDATION_FAILED` with nothing written; S4a define holds the grant rows FOR SHARE so a revocation times out `55P03`; S4b a committing revocation: the waiting define is `FORBIDDEN`; cleanup leaves no forged row and no disabled trigger). Static oracle (85 lines, sha `3fc66441ae5e38db`): 13/13 PASS on the overlay.

| Mutant (scratch lane, deleted) | Edit | Static 13 | Race 18 |
| --- | --- | --- | --- |
| **mut1** | remove the position-4 `perform ... for share` from **both** writers (define keeps its re-proof; taxonomy keeps two comment lines) | **7 fail** (1, 3, 4, 5, 10, 12, 13) | **6 fail**: #5 define waits and answers CONFLICT, #6 define spent its lock_timeout, #7 taxonomy waits, #9 define waited >= 1 s, **#11 the define that waited is VALIDATION_FAILED (have `00000:rows=1`: the mutant commits a draft naming a type whose version the holder then superseded)**, #12 waited for the superseding transaction (have `false`); #5 and #7 have `00000:rows=1` (no wait, no conflict), #6 and #9 have `false`; the other 12 stay ok (harness, fixtures, control, S4a/S4b which are position 1, cleanup) |
| **mut4** | define's lock statement names `typeIds => []` (locks nothing); re-proof intact | **0 fail, 13/13 PASS (blind, V13-16)** | **5 fail** (5, 6, 9, 11, 12) |
| **mut5** | define re-proof deleted; lock intact | 1 fail (#4) | 1 fail (#11: the waiting define commits against the superseded version); #12 stays ok because the wait still happens |
| **mut6** | 130300 non-invertible anchor pair (V13-06) | n/a | the reset fails with 55000, see V13-06 |

So the race file discriminates exactly as intended: removing the lock fails it (the root's request), a lock over the wrong set fails it, and a missing re-proof fails it. The static file catches missing locks, wrong order and a missing re-proof, but not a lock over the wrong set (V13-16).

### V.5 Runs (2026-10-28, staged ALT runner, background, no timeout wrapper; `governed_schedule_ladder` skipped as instructed)

| Run | Time | Lanes | Targets | Result | TAP sha256 |
| --- | --- | --- | --- | --- | --- |
| v1 broad regression + probe | 19:53:21 lock, reset ok 19:53:54, done 20:02:14 (500 s) | `taxonomy-integrity,gaps-db2,node-pointers,nestable-read,placement-perf` (24 WIP on 543 promoted) | 81 files: my probe, the lane's 19 non-race entrypoints (18 earlier + the static position-4 test) and 61 existing suites (every state-moving, lock, relay, catalog, taxonomy, pattern, block-rule and placement suite named in round 1) | 8,659 assertions: **8,658 ok, 1 not ok = my probe #41** (V.6). The lane's 19 non-race entrypoints: 19 files, 833 assertions, 0 failures. Stamp `195321-139898` | `add32736088ed5fcb504bc9769a940799315f6d0475c1cc69cac20a88b765df0` |
| v2 race alone | 20:02:14, done 20:02:56 | same overlay | the race file | **18/18 PASS**, stamp `200214-170326` | `1ccd5140321dfd2c165f28d046c5436bdd781dccd7babd666ad41d68a91d5e9a` |
| mut1 | 20:02:56-20:03:35 | `taxonomy-integrity,zz-review-v13-mut1,node-pointers,nestable-read,placement-perf` | static + race | static 7 fail, race 6 fail, stamp `200256-173880` | `150fdf83b4eaa9eac7b48e8cd089d7df1f58d17e343b06ca385df66b281cc69b` |
| mut4 | 20:03:35-20:04:18 | `...mut4...` | static + race | static 0 fail, race 5 fail, stamp `200335-177657` | `a3b1a49e33fd4d5efa0ac05b4dd3b48173bc83b41e6465f468a20e325a498f83` |
| mut5 | 20:04:18-20:05:04 | `...mut5...` | static + race | static 1 fail, race 1 fail, stamp `200418-181595` | `d31aecfb6a9f6f23e2f4583c2300ac27bce1917461ee1bb7898cb175e0a82b33` |
| mut6 | 20:05:11-20:05:51 | `taxonomy-integrity,zz-review-v13-mut6` | static | `RESET FAILED`, 55000 at 130300 (no TAP) | n/a |
| restore | 20:06:15-20:06:56 | `none` | `fix_template_per_owner` | reset only (repairs the half-migrated DB mut6 left); 41/41 | `3cdb17b4b5ca678b204c972aeded821a202ced7fde127a403cfcced933a322fb` |
| attribution A | 20:07:01-20:07:45 | `taxonomy-integrity` alone | `phase_02_slice_11_helpers_preflight.sql` | 167 tests, **#14 and #90 not ok** | `2e1360c8ad3de35767903041e3a325d75be14a2a416699ad523630665d162c7b` |
| attribution B | 20:07:45-20:08:20 | `gaps-db2` alone (5 WIP) | same file | **167/167 PASS** | `ddb3a27b14a4fa1b87ce31188bca3ac5dbdd60800abe0f177236d3118cc7b443` |

Attribution A/B confirm the lane's claim: the two `helpers_preflight` failures on the overlay belong to the taxonomy-integrity lane (they fail with that lane alone and pass with gaps-db2 alone); root applies that lane's corrected-oracle diff. The probe (`zz_review_v13/verify.sqlinc`, sha256 `eadc3f7b05a1eb6e7e9e89be72bbbfc00210a7b40dde7e28999d8be5d0240c0c`, 149 lines, in session scratch) held sections A (V13-01), B (V13-02 sweep and injection) and C (position 4, unknown keys); the mutant files differed from the real 130400 only as described in the table (sha prefixes `6c696aef`, `664b8a47`, `89a4c70e`). Process notes: v1 held the ALT lock for about 9 minutes (the 12-minute ladder suite was left out this time); the ALT database now holds the overlay of the last attribution run (`gaps-db2` only), which the next staged run resets; no process of mine is still running and no scratch path remains in the worktree.

### V.6 Corrections to my own round-1 report, and one invalid probe check

- **Probe test #41 (`C: the define took a row lock on the active content type version row`) is invalid, not a defect of 130400.** It compared `xmax` of the fixture's active type version row before and after a define: 2871 before, 2871 after. The Slice 10 fixture writes and activates that row inside the same transaction and the row already carries this transaction's xid in `xmax` before the define runs, so it was already locked by the fixture (most likely at an equal or stronger strength, which makes a second request a no-op; I did not establish the mode); the comparison cannot discriminate. Position 4 is proven by the race file and by mut1/mut4 instead. I considered a pageinspect/pgrowlocks variant and dropped it: the two-session proof is stronger.
- **That also withdraws my round-1 inference in V13-05**: "`CTV xmax before: 2859`, `after: 2859` (a taken lock would have turned it into a multixact)". The same unchanged value appears now that the lock exists, so it never showed anything. The round-1 conclusion (no position-4 lock in `cms_define_template`) was right, but it rests on the source (plain SELECTs, `20261013100200:120-133`), not on that probe. The position-1 evidence in the same finding (grant row xmax 0 -> locked, other member's tenure row stays 0) is unaffected: those rows were not already locked.
- **V13-05 said "before or with position 3 per the table"; that was wrong.** The table puts 4 after 3, and the lane placed it after 3 (and after the CAS), which is the spec order.
- A STATIC-oracle remark of mine that held in round 1 still holds: a source scan cannot show that a lock locks anything; that is why V.4's mutants matter.

### V.7 New findings

- **V13-16 (MINOR)** `phase_02_slice_12_gaps_lock_position4.sql:37-43, 57, 59` - `g2_lock_names` measures the span from the FIRST `from platform_private.cms_content_type_versions version_row` to the first `for share of version_row`. In `cms_define_template` the first occurrence is the unlocked compatibility loop's `exists (select 1 from ... version_row ...)`, so the span also covers `cms_template_block_digest(definition->'slots', definition->'compatibleTypeIds', ...)` and contains the needle whatever the lock statement names. Assertion #5 ("locks the version rows of the types the definition names") therefore cannot fail, and control #6 is only half a control (it fails to find `allowedTypeKeys`, which the span does not contain). **mut4 proves it: the lock statement names `[]` and the static file passes 13/13**; the race file does catch it (5 failures). The migration is correct; the defect is a hollow citation if the ledger cites #5 as the evidence for "locks the named types" (the marker-evidence pattern). Fix (untested by me, the lane must rerun mut4 and see #5 fail): start the span at `perform 1 from platform_private.cms_content_type_versions version_row` (the lock statement's own head; the loop uses `select 1`, the pattern writer's lock reads `perform 1 from ... version_row join`, the taxonomy's is the only occurrence), or assert on the statement between that head and `for share of version_row`. Until then cite race #5, #6, #9, #11 and #12, not static #5/#6.
- **V13-17 (NIT)** `130400:11-12` header and race S3 - the header says "a version superseded while the writer waited is refused and never pinned". That is true when the type is left with no active version (what S3 does: `state = 'superseded'` with no successor). A real activation supersedes V1 and activates V2 in one transaction; the define that waited on V1 then sees V2 active, the type-level re-proof passes, and the draft commits. This is the same strength as CMS-03C-12's existing re-check (`20261014020400:173-184`) and a draft is only a draft (governed submit recomputes `blockRegistryDigest` and refuses a mismatch, `20261013300800:178-196`; the unlocked `cms_template_block_digest` also checks each block's compiler range against the type's active artifact, a check the re-proof does not repeat). BE03c rule 2 (:1520) names only pattern pins for the "waited and then finds it superseded" refusal, so I do not call it a gap. If root reads rule 2 strictly for bound type versions, capture the locked ids before the lock and refuse when any is no longer `active` after it; otherwise reword the header and the S3 title to "no longer has an active version".
- **V13-18 (NIT)** documentation residue: `lane-gaps-db2-report.md` `## Requests to root` item 1 still says "The four WIP migrations ... (20261024130000 .. 20261024130300)" (five exist; the later section's request 1 is right); the stored comment of `platform_private.cms_create_taxonomy_version` (`20261014030200:227-228`) lists the writer's steps without position 4 (no contradiction; the migration preserves comments by design).
- **V13-19 (NIT)** race file notes: it commits forged rows (auth user, parties, tenure, grants, types, version, artifact) and disables user triggers on four tables between two committed statements; a hard kill between them leaves the shared ALT database dirty until the next reset (the staged runner and `db:verify` reset first), so it must run alone behind the ALT lock as the lane states. The taxonomy S1 asserts the outcome only (the define has a `waited` assertion; mut1 flips #7, so the taxonomy assertion does discriminate). The dblink string is the same default local-stack string as `ac265_*_concurrency.sql`.

### V.8 Not verified

`governed_schedule_ladder` (skipped as instructed); the canonical `db:verify`/`validate`, real PostgREST and `*.race.mjs` modules (not permitted to me); re-application of 130000/130300/130400 (the marker `continue` branches are not exercised by any test, reasoning only); promotion in an order other than timestamp order; whether the six `platform_private` deadlock-only helpers are reached only through converted wrappers (not traced transitively); the web-impl findings; the ledger guard itself.

### V.9 Requests to root (ordered)

1. Promote 130000, 130100, 130200, 130300 and 130400 in timestamp order together with the corrected tests; node-pointers 140000/140100 are unchanged.
2. In the same commit edit `tests/contracts/phase-02-slice-12-evidence-ledger-001-071.ts:823` to the new #36 title and record citations and receipts for the two corrected files and the 20 gaps-db2 entrypoints (V13-04).
3. Ask the lane to fix the static helper before the ledger cites #5/#6, then rerun mut4 and see #5 fail (V13-16). Everything else is optional (V13-17 decision, V13-18, V13-19).
4. Apply the taxonomy-integrity lane's corrected oracles for `phase_02_slice_11_helpers_preflight.sql` #14/#90 (attribution confirmed above).
5. Memory candidates for root (I write none): "an xmax comparison inside a fixture transaction cannot show that a lock was taken; prove a lock with two sessions plus a mutant that removes it"; "a static source oracle that scans from the first occurrence of an alias can be satisfied by an earlier unrelated statement: mutate the operand and see whether the static test notices".
