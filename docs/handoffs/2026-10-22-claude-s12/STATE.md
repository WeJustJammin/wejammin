# Claude Phase 2 resume — live state (2026-10-22)

Resume here after any interruption or compaction. Predecessor: Codex handoff
`docs/handoffs/2026-10-22-claude-phase2-s12-handoff.md` (Codex goal BLOCKED on native-finality gate).

## CURRENT POSITION (2026-10-23 ~16:45Z, root session `[6bca89]` — read this before "RESUME FIRST", which is history)

- ALL Slice 12 WIP is PROMOTED into `supabase/migrations/` (80 files 2026-10-23 06:08Z + race-fixes `20261023100000/100100`;
  manifest `evidence/promotion-manifest-20261023.json`). `supabase/migrations-wip/` holds only its README. NOTHING COMMITTED YET.
- Canonical gates on current DB bytes: db:test PASS, db:api-test PASS, all 29 races PASS (S12 converted to canonical mode),
  db:types regenerated + check PASS. Real-route Playwright: 8 specs / 27 tests PASS (`.lane-logs/canonical/pw-realroute3-*`).
- Review V11 (report SHA `e742fa48…`): FIX FIRST — H1 dynamic imports have no failure path (a failed chunk wedges forms; editor
  caches the rejected import), H2 `contracts`/`validators` exemption false (reviewer-options read at mount → owner editorial
  review detail really 146,667), M1 visibility loads are initial in the first viewport (~100–104 KB on 3 routes), M2 lock drops
  typed keystrokes / Tab skips radios (a11y regression; V11's lossless DOM-seeded state works), M3 replay dedupe unpinned, M4
  post-command landing 94,455; area 6: governed real-route spec (V11 §5 T1–T6) REQUIRED before S12 close (AC-273). Caveat: a
  dev-mode staging build overwrote `dist` at 13:52 — `bundle:check` must run on a fresh production build. All sent to the web
  lane (resumed, agent `abebc741f8310d0cf`).
- web lane V11 round DONE (report SHA `89c9af11…`, files table `f35a5b5d…`): H1 failure paths + retry boundary; intent-only
  loads (no visibility); M2 lock removed (DOM-seeded state); M3 dedupe pinned; M4 landing in-island; gate refuses non-pinned
  Node / non-production dist and records `measuredWith.node`; 2 false exemptions removed, 27 proven; all 20 routes under
  92,160 (entry editor 91,828 = 332 B headroom). NEW governed real-route spec (never run; launcher wiring added in
  `tests/e2e/support/s12-real-governed.ts`). Root run RUNNING: fresh production build → bundle:check → 9 real-route specs
  (`.lane-logs/canonical/pw-realroute4-*.log`). Note: its last full-suite Vitest predates a 3-test regex fix — the final
  validate covers it.
- Root run pw-realroute4: build OK, bundle:check EXIT 0 (Node 22.23.1); 7/9 specs PASS; FAIL S11-RR-06 ("Record approval"
  never operable — round-2 intent loading regressed a native control; passed in round 1) and governed spec T1 (fixture
  `taxonomyKey` invalid → 422). Sent back to web lane.
- Web lane fixed pre-hydration choice loss for ALL command frames (S11-RR-06 root cause) + governed fixture key. Root rerun:
  build OK, bundle:check 0, 8/9 suites PASS incl. S11-RR-06; governed spec T1 still fails (no "Record approval" in the
  governed-decision region) → back to web lane with the error-context snapshot.
- Governed spec after label fix: T1–T4 PASS; T5 FAIL (after the chunk route is restored, the retry click sends 0 —
  suspected real-browser cache of a failed dynamic import; jsdom tests pass = PAT-031 class); T6 not reached. Web lane told to
  confirm in real Chrome and fix the retry for every added dynamic import (cache-busted retry or FE03 reload guidance).
- CONFIRMED in real Chrome: a failed dynamic import is cached in the module map (plain retry = 0 requests). Fix:
  `apps/web/src/lib/retryable-import.ts` retries the exact failed URL with `wj_retry=N` (one module instance; Safari falls back
  to the same specifier + "nothing was sent"); applied to every dynamic import with a failure path; gate meta-test fails on an
  unwrapped exempt call site. Headroom now 79–80 B (entry editor 92,081; review detail 92,080). Root full rerun (build +
  bundle:check + 9 specs): build OK, bundle 0, 8/9 PASS; governed T5 now fails earlier (spec's route blocks only the plain
  chunk URL, so the automatic `wj_retry=1` attempt succeeds) → spec fix + cross-click marker proof sent to web lane. PAT-031
  (later) T5 spec fixed (RegExp route incl. `?wj_retry=N`; cross-click counter proven in real Chrome); governed rerun: T1–T5
  PASS, T6 FAIL — deferred reviewer-options read never fires (selectOption waits) and a person's first click would open an
  empty dropdown → web lane: region-level intent trigger + FE03 pending state + T6 acts like a person. PAT-031
  (later) reviewer list got loading/failed/retry states; editorial assignment forms intent-loaded (review detail headroom
  3,493 B). Root full rerun: build OK, bundle 0, 8/9 PASS; governed T1–T5 PASS, T6 FAIL — snapshot shows "Reviewer choices
  could not be loaded." for the OWNER (CMS-03A-18 read fails on the real stack; harness wiring vs product vs fixture) → web
  lane diagnosing with a captured response. Launcher registry wrapper added; rerun: S09 capability-grants specs 22 + 7 PASS;
  governed T6 still FAIL, probe captured 401 UNAUTHENTICATED (reauthenticate) on the owner's CMS-03A-18 read → web lane
  finding which resolver rejects the S11/12 session. Cause: the owner session had no acting-context binding (the DB's
  `cms_review_binding` refuses binding-less sessions — designed); world now binds via `identity_context_bind`. Rerun: read
  200 but `items: []` (reviewer grant was written to the identity table, not issued as an owner aggregate) → T6 now issues it via
  CMS-03A-15; rerun: items 1, assignment OK; lost-answer UI is a polite status by design (spec fixed); next rerun: T6 fails at
  :463 (Reason field gone after reconciliation — likely the aborted POST committed; check the status text vs decided state) →
  web lane → PRODUCT DEFECT confirmed + fixed RED-first: a committed-but-unanswered decision was shown as retryable;
  `CmsWorkflowCommandFrame` now takes a `settled` sentence ("Decision recorded." / "no longer takes your decision"), no retry
  drawn; T6 proves idempotency by an API same-key replay (exactly 1 decision). Root full rerun: build OK, bundle 0, 8/9 PASS;
  T6 passes the decision steps, fails at owner activation (:519; snapshot shows the taxonomy edit page) → web lane. S09 grant
  specs 22 + 7 PASS. PAT-031
  recurrence #4 (jsdom import model) — record when closing.
- 2026-10-23 22:45Z: ALL GREEN before evidence — governed review real-route spec 6/6 (T6 activation fixed: radio → Continue →
  commit; spec defect), the other 8 real-route suites green on the prior full run, fresh production build + bundle:check 0,
  canonical DB gates green. Web lane `abebc741f8310d0cf` done (report SHA `6f29a8f6…`, files table `7e3506e8…`; it found and
  fixed 2 PRODUCT defects: pre-hydration choice loss in every command frame; committed-but-unanswered decision shown as
  retryable). Final evidence script STARTED next.
- FINAL EVIDENCE SCRIPT READY: `docs/handoffs/2026-10-22-claude-s12/evidence/run-final-evidence.sh` (S12/S11/S10 ledger runs + all S09
  marker inputs + collect; summary in `.lane-logs/canonical/final-evidence-<stamp>/summary.txt`). Run it ONLY after the web lane is
  green on root's real-route rerun (governed T6 pending).
- NEXT (in order): (1) act on V11; (2) FINAL evidence regeneration — `pnpm db:start` under the CI lock FIRST, then
  `node scripts/evidence/run-slice-evidence.mjs --slice 12`, `--slice 11`, `--slice 10` (receipts pin file SHA-256 — must be
  last), then S09 marker receipts: full `vitest run --reporter=json`, `pnpm test:evidence:s09`, `pnpm db:test:tap`,
  Playwright JSON per config, `pnpm db:races` → `pnpm evidence:collect --slice 09 --vitest … --pgtap … --playwright … --races …`;
  (3) `pnpm validate` green; (4) local commit(s) with explicit file lists (authorized at reviewed checkpoints; never push/PR);
  (5) then the queue: S12 ledger re-citation (AC-275 parity, AC-212/213, AC-052/263/264, race clauses) + refutation audit →
  ticks → Slice 12 close; post-commit follow-ups (V7-01, V8-01, V9-02/04, governed real-route spec per V11, evidence runner
  "stack stopped" message, B2 CMS preflight owner, V2/V6/V8 NITs).
- 2026-10-24 ~01:05Z: final evidence run `final-evidence-20261023T224619Z`: SLICE12 778, SLICE11 2,309, SLICE10 2,057
  receipts, every step PASS. S09 collect FAILED (exit 2, ENOENT vitest-all.json): every Playwright run EMPTIES
  `test-results/` at start, deleting the Vitest/pgTAP/race inputs the script wrote there (only `e2e-s09-real.json`
  survived). Also `VITEST_ALL` exited 1 (failures unknown — JSON-only reporter). Fix: NEW
  `evidence/run-s09-evidence.sh <out-dir> [vitest-all.json]` writes every input under `.lane-logs/…/s09/` and copies the
  gate report keeping its name `vitest-evidence-s09.json`. Full Vitest rerun (default+json) into
  `final-evidence-20261023T224619Z/s09/` running to read the exit-1 cause.
- 2026-10-24 ~01:15Z: full Vitest (diagnosis) failures so far: documentation-boundaries (root fixed: `evidence/README.md`
  added, harness README sections), S09 receipts guard (expected until S09 collect), S11 + S12 evidence guards. Root
  re-cited S11 AC-093/094 (Slice 12 retitled the preflight tests: pattern + locale now have newer registry rows) and the
  2 renamed S12 template_authority pgTAP titles. Lane unique-titles GREEN (21 duplicated `it.each` names fixed, 254/254).
  NEXT: finish diagnosis run → `run-slice-evidence --slice 12`, `--slice 11` → run BOTH guards → `run-s09-evidence.sh`
  → S09 receipts guard → `pnpm validate` → commits (`scratchpad/claude_root/commit-groups.py`: 0-upgrades … 7-docs).
- 2026-10-24 01:21Z: diagnosis run complete: 30,024 tests, exactly 4 failures (documentation-boundaries — now 5/5 after the
  README fix; S09 receipts guard; S11 + S12 guards). Lint 0, type-check 0, contracts:check 0, progress:check 0,
  format:check 0. STARTED `evidence/run-s12-s11-evidence.sh .lane-logs/canonical/s12-s11-evidence-<stamp>` (S12 ~65 min,
  S11 ~40 min, each followed by its guard). Then `run-s09-evidence.sh`, then `pnpm validate`, then commits.
- 2026-10-24 ~02:00Z: S12 evidence rerun PASS (759 receipts) + GUARD12 5/5. Recite proposal lanes a–d DONE
  (`recite/{a,b,c,d}-proposals.json`); refutation reviews a–d running (`recite/<x>-refutation.json`). Spec-vs-code /
  reading questions collected (research each against specs before asking the owner, one at a time):
  AC-026#3 malformed body UUID 400 (BE03c) vs 422 (Worker); AC-055#4 absent locale 404 vs RPC 422; AC-062 hidden target
  404 vs uniform 422 (AC-036/060); CMS-03C-17 absent vocabulary 404 vs empty 200 (AC-132/134); CMS-03C-18 match function
  called only by `cms_term_overlap_check` (AC-138/141); AC-086 "preflight failure"; AC-105 "node path"; AC-207#1
  `template_not_active` vs `WITHDRAWN`; AC-128#1-2 tokens no migration raises. Apply order after refutation: commit the
  green checkpoint FIRST, then apply KEEP/FIX citations + accepted splits, rerun S12 evidence, guard.
- 2026-10-24 02:04Z: `run-s12-s11-evidence.sh` (logs `.lane-logs/canonical/s12-s11-evidence-20261024T012047Z/`): SLICE12 0
  (759 receipts) GUARD12 5/5; SLICE11 0 (2,318 receipts incl. 63 race) GUARD11 5/5. S10 guard already green. STARTED
  `run-s09-evidence.sh .lane-logs/canonical/s09-evidence-<stamp>` + S09 receipts guard. Then `pnpm validate`, commits.
  Spec questions research: `recite/spec-questions.md`.
- 2026-10-24 06:05Z (after a usage-limit reset): S09 pass 1 (`.lane-logs/canonical/s09-evidence-20261024T020357Z/`) every
  step 0, COLLECT 10,171 receipts; GUARD09 failed on its OWN receipt only (AC-1144 cites the guard file; it ran while the
  receipts were stale) + documentation-boundaries (new `recite/` dir, README now added). Pass 2 STARTED
  (`evidence/run-s09-pass2.sh`, the S11 closure bootstrap: swap the guard's failed rows for the committed passing rows
  only because the guard file SHA equals HEAD's `62bbb3c7…`, full Vitest again, recollect from real runs, all guards).
  Refutation reviews a–d died at the limit after 158/296 criteria (1,707 citations: KEEP 1,650 / FIX 25 / DROP 32) and
  were RESUMED via SendMessage to finish the rest.
- 2026-10-24 06:43Z: S09 pass 2 green (VITEST_ALL 0, 10,171 receipts, all 5 guard files 26/26). `evidence/gate-validate.sh`
  (`.lane-logs/canonical/validate-20261024T061954Z.log`): contracts, types, progress, format, lint, type-check PASS; test
  run 2,134 files / 30,023 passed / 1 skipped; FAILED only the 100% coverage threshold (statements 99.48%, branches
  99.18%, functions 99.55%, lines 99.69%; 47 Slice 12 Worker files, list
  `scratchpad/claude_root/coverage-gaps.txt`). Steps after it (test:evidence:s09, test:e2e, build, bundle, perf smoke)
  did not run in this validate (they ran green separately earlier). Root decision: commit the checkpoint now (8 local
  commits by layer, messages state the coverage gap), then coverage lanes, then validate again.
- 2026-10-24 06:50Z: COMMITTED 8 local commits `be6ac447..fc62deef` (no push; HEAD `fc62deef`; docs commit message carries
  the coverage status). Coverage lane 1 released; lane 2 pending a slot (cap 4: refutations a/c/d live). Then: validate
  again → commit coverage → apply refuted re-citations (rename the 2 duplicated `governed_activation` descriptions first)
  → S12 evidence → guard → gap lanes → Slice 12 close. Spec questions: `recite/spec-questions.md`.
- 2026-10-24 ~07:40Z: all four refutations DONE (a 3.6% / b 1.1% / c 2.6% / d 1.9% DROP). DEC-226 (raw record): strict
  evidence policy on review c's five calls. Spec questions all researched (`recite/spec-questions.md` Q1–Q9): 8 root
  decisions/propagations to apply AFTER the apply lane (texts of AC-026, 062, 079, 086, 132, 134, 138, 141, 274 + BE03c
  lines); OWNER question asked: Q2 AC-055 (unsupported locale on the CMS-03C-04 write: A 422 recommended / B 404).
  Live: coverage 1, coverage 2, recite-apply. Next: root runs S12 evidence (export WEJAMMIN_CANONICAL_RACE=1 if race
  citations need it) → guard → spec text changes → gap lanes (missing tests/impl per refutations, Q7 node pointers,
  AC-110 restart, AC-105 nested picker, AC-271 skeleton, AC-239/242/244/246/248).
- 2026-10-24 08:30Z: coverage lanes 1+2 GREEN (46 files 100%; 20 new test files; 10 reviewed dead-branch removals);
  recite-apply GREEN; root refreshed the reconciliation fixture; S12 evidence (canonical race mode) PASS 3,461 receipts,
  all 7 guard/contract files 70/70. DEC-227 texts applied by `recite/dec227-texts.mjs` (run AFTER apply.mjs; trackers +
  ledger; AC-132 → verified); ledger now 155 verified / 122 partial / 19 unverified; one new citation needs a receipt →
  S12 rerun RUNNING (`.lane-logs/canonical/s12-dec227-evidence-*`). Then `evidence/gate-validate.sh` → commit (coverage +
  re-citation + DEC-226/227). Gap inventory: `gaps/inventory.json` (199 uncited clauses: pgtap 73, impl 27, hosted/p95
  25 = local latency apispec + pgTAP bench per the S11 precedent, other 25, playwright 17, worker 13, race 12, web 7).
  Gap waves after the commit (cap 4): W1 taxonomy assignment integrity (DEC-141: AC-239/241/242/244/246/221/224), pgTAP
  gaps ×2, p95 benches; W2 web impl (AC-105 picker, AC-110 restart, AC-271 skeleton, Q7 node pointers), Playwright,
  races, AC-248 relay narrowing, "other" triage. Boundary: CMS-03C-21 consumers are Shard 04 (AC-148/155/158).
  OWNER question still open: Q2 AC-055.
- Shell traps here: zsh does not word-split and `(N)` globs are disabled — put multi-file commands in a bash script
  (`scratchpad/claude_root/run-*.sh` are examples). Never `pnpm db:stop` at the end of a script before the evidence runner.

## RESUME FIRST (session handed to a new chat, 2026-10-22)

The previous root session ended while four Sonnet fix lanes were still running (brief
`briefs/prepromo-fixes.md`): F1 `claude_s12_fix_dec193`, F2 `claude_s12_block_rules`, F4a
`claude_s12_fix_dec206`, F4b `claude_s12_fix_recheck`. Their reports (`lane-fix-dec193-report.md`,
`lane-block-rules-report.md`, `lane-fix-dec206-report.md`, `lane-fix-recheck-report.md`) are the only
record a new session receives — no task notifications carry over.

1. For each of the four: read its report. A report whose Status line reads GREEN/PARTIAL/BLOCKED with a final
   run is finished. Otherwise check liveness before relaunching: newest mtime of its report and claimed files,
   newest `.lane-logs/alt-staged-*<lane>*` stamp, and whether `/tmp/wejammin-altdb.lock` is held
   (`flock -n /tmp/wejammin-altdb.lock true || echo held`). Only if clearly dead (no change for 30+ min, no
   held lock from its run) relaunch it as `wejammin-executor` with `model: sonnet`, its brief section, and
   "a predecessor was killed mid-work; first read your report and every file in your claim, run
   `git status --porcelain -- <paths>`, resume from the last recorded run; do not redo finished work and do
   not rerun identical bytes". Never run two agents on one claim.
2. Release F3 (`briefs/prepromo-fixes.md` F3, DEC-212 rename) when a slot frees (cap ~4 agents).
3. Then continue the Remaining queue below from step 2.

### Root handoff record (2026-10-22 19:50Z)

- New root session "WeJammin Phase 2 resume" (cross-session name `[6bca89]`) took over. The four fix lanes were
  ALIVE at takeover (reports touched 19:41–19:47Z, ALT lock held by F1's run) — not relaunched. They are background
  subagents hosted in the OLD root session "WeJammin Phase 2 implementation" (`local_c23c5173…`, `[845dab]`), which
  acked a stand-down: it stays idle, releases nothing, and relays each lane's final Status line to `[6bca89]`.
  Agent ids: F1 `a9aade4db142f63a0`, F2 `a4433afd7104246ed`, F4a `a8ab0c45863211b2b`, F4b `a7194bcff401c02bc`.
  Do NOT stop the old session while any of them runs (it would kill the lanes); a lane whose report goes stale for 30+
  min with no held lock is dead — relaunch only then, from this root.
- DEC-210 closed-list cascade (root, F2 request): BE03c "Slice 12 typed refusals" 422 list + `block_rules_violated`;
  `cms.pattern.active_digest` reasons + `pattern_block_rules_violated`; FE03 rows CMS-03C-12/02/14-15 + preflight copy
  row; P2-S12-AC-211 (new last sentence = new uncited ledger clause), AC-238 (reason list, in place — its clause 4
  citations only hold once F2 updates the closed provider reason set; re-verify at re-citation), AC-274 (token) in
  phase-2.md, the S12 tracker and the S12 ledger; changelog rows in BE03c and FE03. SHA-256 after: BE03c `751b42b7…`,
  FE03 `6dc19ea1…`, phase-2 `d513e636…`, tracker `d6268411…`, ledger-143-213 `3533d3b0…`, ledger-214-285 `da333ca7…`.
  Guard tiling verified (only non-receipt problem left: the known `[`/`]` path charset, AC-059).
- DEC-208 spec written (root): BE03c Observability paragraph "Database-side locale observability (DEC-208)",
  mechanism DEC-213 (root implementation decision, raw record; owner may override): per-minute window read
  `platform_api.cms_locale_observability_read`, gauge `cms_locale_stale_legal_fields`, `{locale}` label dropped
  (2 places), changelog row. No AC text change needed (AC-052/263/264 never named the label). BE03c SHA after
  `49e79ae9…`. Brief ready: `briefs/dec208-observability.md` (lane `claude_s12_dec208_obs`, WIP `dec208`,
  `20261022100000`–`109999`). R2-02 status: BE03c 1500/1547/1587 + runbook already done by the previous root;
  only the AC-261 / BE03c named-RPC inventory remains (queue step 5; add `cms_locale_observability_read` too).
- Release order when a slot frees (cap 4): F3 dec194 → dec208-obs → guard path charset fix (small, scripts/evidence).
- Raw records added this session: DEC-213, PAT-030 (compile still NOT run).
- Mid-wave backup (19:56Z, F-wave running): `~/.local/share/wejammin-backups/s12-dirty-20261022T195653Z.tgz`
  (2,454 dirty/untracked files excl. `.lane-logs`, SHA-256 `31e61a6f…37e5`). 5-hour window was 86% at 19:57Z
  (reset 22:30Z): a cutoff may kill F1/F2/F4a/F4b mid-run — on resume, a lane whose report is not final is
  relaunched (from this root) with "predecessor killed mid-work" instructions per step 1 above.
- Snapshot 20:25Z (5-hour window 95%): F1 checkpoint 1 (report 20:17Z); F2 checkpoint 3 (contracts/Worker/Web
  green, SQL+pgTAP written, RED run 2 + GREEN pending); F4a checkpoint 2 (SQL GREEN run 3 332/332, unit suites green,
  remainder pending); F4b checkpoint 2 (RED/harness run queued). Six staged runs queued on the ALT lock (detached
  shells survive a cutoff; their TAP lands in `.lane-logs/` — a successor reads it instead of rerunning identical bytes).
- 22:30Z: all four F-lanes died on the 6:30pm 429 (old session confirms; told not to resume them). 22:35Z root relaunched
  successors from THIS session (Sonnet `wejammin-executor`): F1 `abb06fd7196a118a0`, F2 `a7285169e7f5a7c52`, F4a
  `a3f3c8091503792a4`, F4b `af89fd4089da5be19`; each told to reconcile disk vs report and record the unrecorded post-death
  TAPs before any edit. Old ids are dead — never message them.
- F1 DONE GREEN (successor; report SHA `443e6750…`; final TAP `183502-3089762` `8bf378a0…`: 91 files / 14,820 / 69 fail,
  root-verified all 69 in F2 `block_rules_legacy` (38) and F4b governed*/dec191 (31)). Promotion-ready: NEW `dec193/20261017044705`,
  `fix-dec193/20261022090000`, `090100`; edited in place `dec193/20261016041500`, `042200`, `044700`. Stack rule from now on:
  any stack with `dec193` must include `block-rules` (`dec193/041600` calls `block-rules/20261022080100`); F4a/F4b told.
  F3 `claude_s12_fix_dec194` released 22:45Z (agent `a678da2c0e8a475e4`).
- R1-008 → DEC-214 (root; raw record): BE03c "Render plan and checker pointers (DEC-214)" + parenthetical + changelog;
  P2-S12-AC-247 updated in phase-2, tracker, ledger (tiling re-verified). BE03c SHA `d2713ab8…`.
- R1-004 → DEC-215 (root; raw record): SQUASH the superseded pairs (040700/041800, 040800/041600, 041100/041500,
  041900/042900, 044500/044710, 044600/044720, pattern-updates 140200..140600) and drop the digest pins, as its own lane
  AFTER F2 finishes (041600 is F2's) and BEFORE joint promotion; full S12 + S10/S11 rerun. Brief to write when F2 lands.
- Promotion notes (F1): promote `block-rules` with `dec193`; any DB that already applied `20261020203606` needs
  `--include-all`; R1-010 needs no data migration (nothing from `20261013300000` on ever reached a shared DB).
- F4a DONE GREEN (successor; report SHA `c9c412f2…`; TAP `190808-3239262` `fb0c4d90…`: composition_instances_read 332/332
  root-verified; other failures = live lanes or missing `fix-dec193` in its stack — `dec193_carry` #374 and `pattern_updates`
  #251 pass with it, per F1's 183502). Vitest contracts 440 / Worker 3,324 / Web 539 green; OpenAPI `--check` 0. SQL + TS
  mutation witnesses recorded (one equivalent cursor-hash mutant explained). Requests: promote `dec206/20261022050000`
  (`42727530…`), `050010` (`08c5b0fc…`) after dec193/pattern-updates/block-rules; delete empty `fix-dec206/`; carried-over
  DEC-206 read requests (step-up inventory exemptions, AC-269 bookkeeping, race modules) remain root's.
- STANDARD STACK from 23:20Z: `pattern-updates,dec193,dec194,dec195,locale-gate,dec197,dec202,dec205,dec206,governed-recheck,
  block-rules,fix-dec193,<own>`; F2/F3/F4b/dec208 told. dec208-obs released 23:20Z (agent `ab6e10788a031cb33`).
- Live after 23:20Z: F2 `a7285169e7f5a7c52`, F3 `a678da2c0e8a475e4`, F4b `af89fd4089da5be19`, dec208-obs `ab6e10788a031cb33`.
  Next on a free slot: evidence-path charset (`briefs/evidence-path-charset.md`); DEC-215 squash lane after F2
  (`briefs/squash-dec215.md`, catalog-snapshot equality proof before/after).
- F2 DONE GREEN (successor; report SHA `28711252…`; TAP `195257-3453719` `11405bc1…` root-verified: 86 files / 14,903; only
  F4b governed*/dec191 aborts ("unexpected function metadata", F4b lapse fixture, fix-recheck not staged) and
  `locale_observability` (dec208 WIP not staged) fail). block_rules 124/124, block_rules_legacy 198/198; Vitest contracts+Worker
  4,479, web 2,807 green; no oracle changed. Promote `block-rules` with `fix-dec193` and `dec193/041600`.
  F2 found latent defect: `dec193/044200` active-digest provider passing path falls through (two rows) → Step 0 of the squash lane.
- Squash lane `claude_s12_squash` released (agent `a4142d3417c679240`) with Step 0 + DEC-215 squash.
- Live: F3 `a678da2c0e8a475e4`, F4b `af89fd4089da5be19`, dec208-obs `ab6e10788a031cb33`, squash `a4142d3417c679240`.
- dec208-obs GREEN (report SHA `a644d2e2…`; TAP `205634-3726889` `3da2e625…` root-verified: 14 locale files / 528, PASS;
  Vitest 12,646 green; 18/18 Worker mutants killed). Shared Worker edits RATIFIED by root (additive hook in
  `async-entrypoint.ts` mirroring reconciling-age, wiring line, probe, RPC name, registry) + 3 count-only test corrections.
  Spec defect found via its observation: a function-level `statement_timeout` cannot bound its calling statement → root
  corrected BE03c (5 s bound = Worker 5,000 ms call deadline; changelog row; BE03c SHA `01df2b24…`) and RESUMED the lane
  (same agent) to add the 5,000 ms deadline RED→GREEN and fix the SQL comments. Promote `dec208/` (3 files) after its re-run.
  S09 pins need `cms_locale_observability_read` (both schemas) at integration.
- F3 DONE GREEN (report SHA `3a5fc25d…`; TAP `205837-3737452` `a196e653…` root-verified: 13 files / 2,982, only root-owned
  S09 pins fail). Rename to `platform_private.taxonomy_merge_recoveries` done; `190000` folded into `190050` (promote exactly
  `dec194/20261022190010..190050`, five files); R2-03 pre-filter + 3 mutants killed; R2-04/05/09 done. evidence-path lane
  released (agent `abec405acf5370f8e`).
- INTEGRATION TODO (root, after F4b + squash + dec208 re-run, i.e. when the function set is final):
  S09 `sec2_all_schema_definer_rls` #6 (+ `platform_private.taxonomy_merge_recoveries`); `r8_api_surface` #4/#13/#14 (classify
  `cms_reconcile_taxonomy_merge_converge`, `cms_apply_pattern_update`, `cms_get_instance_update_diff`,
  `cms_governed_recheck_resolve_event`, `cms_recheck_governed_reviews`, `cms_list_composition_instances`,
  `cms_locale_observability_read` ×2, + whatever F4b/squash add; recount); `database.types.ts`; AC-261 + BE03c named-RPC /
  table inventory ("fifteen" → sixteen? — check: recovery table is outside `cms_`, so the 03c `cms_` table count may stay);
  dec194 race modules + Worker HTTP isolation composite; DEC-202 race module; dec206 step-up inventory exemptions, AC-269.
  Leave the Codex handoff inventory JSON (historical record) unchanged.
- Live: F4b `af89fd4089da5be19`, squash `a4142d3417c679240`, dec208-obs (resumed) `ab6e10788a031cb33`, evidence-path `abec405acf5370f8e`.
- evidence-path DONE GREEN (report SHA `170e8530…`; root reran the two files: 30/30). `CITATION_PATH` admits `[`/`]`;
  real defect fixed in `run-plan-lib.mjs` (Playwright positional filters are regexes → `playwrightFilter` escapes them) —
  RATIFIED by root with its test. S12 guard now has zero non-receipt problems.
- Verify review V1 released (read-only `wejammin-reviewer`, Sonnet; agent `adf0ae3c9a96396bc`): F3 dec194 + F4a dec206 fixes
  vs R2/R3 findings → `review-v1-report.md`. V2 (dec193/pattern-updates/block-rules/fix-dec193 after squash) and V3
  (governed-recheck after F4b; dec208) to follow.
- Live: F4b `af89fd4089da5be19`, squash `a4142d3417c679240`, dec208-obs (resumed) `ab6e10788a031cb33`, V1 `adf0ae3c9a96396bc`.
- dec208-obs DONE GREEN after the deadline fix (report SHA `f01b0068…`; TAP `210446-3769325` `03a5ba81…` 78/78 PASS;
  root reran the 4 locale Worker test files: 52/52). `LOCALE_OBSERVABILITY_READ_DEADLINE_MS = 5_000`; SQL comments corrected.
  Promote `dec208/20261022100000`, `100010` (`57ebe9aa…`), `100020` (`df0b6b71…`) after review V3.
- Review V3 (dec208, read-only Sonnet) released: agent `a38527d7d13fdf4db` → `review-v3-report.md`. Governed-recheck review
  becomes V4 after F4b.
- Live: F4b `af89fd4089da5be19`, squash `a4142d3417c679240`, V1 `adf0ae3c9a96396bc`, dec208-obs (resumed for V3) `ab6e10788a031cb33`.
- Review V3 (dec208): FIX FIRST — 1 BLOCKER (F-1: reader/wrapper never set `app.cms_rpc`; forced RLS → always zeros; lane
  tests hid it because fixtures held the flag all transaction; root verified on disk), 2 MAJOR (F-2 test blind spot, F-3 S09
  pin = root), 4 MINOR, 4 NIT. Report `review-v3-report.md` SHA `d8bab98a…`. Root DEC-216 (raw record): gauge counts only
  `lifecycle = 'active'` entries; read sets/restores RPC context; BE03c SHA `8305d889…`. dec208 lane RESUMED with F-1/F-2
  (RED first), DEC-216, F-4/F-6/F-7/F-8 (drop inert statement_timeout)/F-11; F-5 cost note only.
- Class scan (root): every WIP `service_role`/`platform_api` entry point and the governed-recheck triggers set+restore
  `app.cms_rpc`; dec208 was the only miss. Leftover WIP dir `supabase/migrations-wip/governed-recheck-red/` (F4b RED copy)
  must NOT be promoted — delete at integration once F4b is final.
- Review V1 (report SHA `1e9f11a5…`): dec194 PROMOTE, dec206 PROMOTE; 9/10 originals RESOLVED, R3-03 PARTIAL (root residue);
  new 0 BLOCKER / 0 MAJOR / 3 MINOR / 4 NIT. Root did V1-02 (raw record DEC-217 amends DEC-206 paging), V1-03 (BE03c row 182
  cursor/limit; `region` dropped) and V1-07 (support-table columns + CMS-03C-03 mutex in lock order); BE03c SHA `850d9ddb…`.
  Resumed F3 (V1-01 sweep lock-order pin + mutant; V1-05 README/typo — tests only) and F4a (V1-04 `::numeric::integer` RED→GREEN;
  V1-06 README stack). Inventory JSON naming `190000` is a historical Codex record — left unchanged by decision.
- Live (5, two are small resumes): F4b `af89fd4089da5be19`, squash `a4142d3417c679240`, dec208 (V3 fixes) `ab6e10788a031cb33`,
  F3 (V1) `a678da2c0e8a475e4`, F4a (V1) `a3f3c8091503792a4`. 5-hour window 75% at 01:42Z (reset 03:30Z).
- F4b DONE GREEN (successor; report SHA `a097c883…`; TAP `210911-3790157` `ac4f7576…` root-verified: 81 files / 18,376;
  governed_recheck 116, activation 124, decision 58, schedule 56, dec191 53 all green; only root S09 pins + mid-fix
  locale_observability fail). Predecessor's 44 RED failures were a harness defect (TimeZone shift → 22009); new lag fixture
  swaps `cms_person_holds_capability` inside the test transaction (restored byte-for-byte, owner/ACL checked) — REVIEW V4 must
  judge it against PAT-031. R3-07 tenure trigger added; R3-20 subject-before-verdict (source-order test only); R3-13/14 done.
  Root: R3-08 BOUNDARY → DEC-218 (per-review isolation; raw record) + BE03c tenure/trigger sentence + changelog; BE03c SHA
  `06c92a1a…`. Delete `governed-recheck-red/` and empty `fix-recheck/` at integration. Promote `governed-recheck` after V4.
- Live: squash `a4142d3417c679240`, dec208 (V3 fixes) `ab6e10788a031cb33`, F3 (V1) `a678da2c0e8a475e4`, F4a (V1)
  `a3f3c8091503792a4`. Next: V4 review (governed-recheck) on the next free slot; V2 (dec193 family) after squash.
- F4a V1 follow-up DONE GREEN (report SHA `b9d753f4…`): V1-04 RED `214211-3935850` (1 fail, 22P02) → GREEN `214400-3948147`
  333/333 PASS (root-verified); `dec206/20261022050000` SHA `7c5b313c…`. dec206 = PROMOTE-ready.
- Review V4 (governed-recheck, incl. lag-fixture vs PAT-031, tenure semantics, lock-order proof, DEC-218) released:
  agent `abbed19f135385343` → `review-v4-report.md`.
- Live: squash `a4142d3417c679240`, dec208 (V3 fixes) `ab6e10788a031cb33`, F3 (V1) `a678da2c0e8a475e4`, V4 `abbed19f135385343`.
- F3 V1 follow-up DONE GREEN (report SHA `37f40a8c…`; GREEN `214422-3950629` 161/161; mutant `dec194mut4` 214218 failed exactly
  the new pin) — root-verified. dec194 PROMOTE-ready (exactly `190010..190050`).
- Squash DONE GREEN (report SHA `57190134…`). Root-verified catalog snapshot: baseline `211637-3825685` (originals staged:
  041600/041800/042900/044710 present) vs after `214227-3937275` (absent): 3,656 objects, exactly 1 differs
  (`cms_list_composition_instances`, F4a's concurrent V1-04 edit). Step 0 provider double-row fixed (RED #197 → 198/198).
  13 files deleted, 11 edited; `fix-dec193/` now README-only (drop from stack at promotion). Root decisions on its requests:
  KEEP the `044800` pin (it guards a promoted body); leave the other anchored amendment chains (not superseded defective bodies;
  DEC-215 scope was R1-004's list); historical records (raw jsonl, 2026-10-15 scan audit, Codex inventory) unchanged; tracker
  `files:` blocks refreshed at tick time; fixed `composition_instances_read/README.md` reference; lane-rules now require a tar
  backup before editing untracked WIP (PAT-032).
- dec208 round 2 GREEN (report SHA `87cea1d7…`; RED `214320-3944326` 13 genuine fails → final `221800-4090127` 14 files / 561
  PASS, root-verified; `app.cms_rpc` set/restored; DEC-216 active-only). F-5 cost model exposed unbounded per-minute scan →
  root DEC-219 (skip scan from active entries; `cms_locale_observability_read_failed_total` + alert
  `locale_observability_unavailable` at 5 failures/10 min) in BE03c (SHA `c9bbea77…`); lane resumed for round 3.
- Released: registry-parity lane (AC-275; agent `a79d307e4d3e9bfa2`, brief `briefs/registry-parity.md`); review V2
  (dec193 family + squash; agent `a7b28b0c1b1413b49`).
- Live: dec208 r3 `ab6e10788a031cb33`, V4 `abbed19f135385343`, registry-parity `a79d307e4d3e9bfa2`, V2 `a7b28b0c1b1413b49`.
- Backup 02:23Z (5-hour window 93%, reset 03:30Z): `/home/rob/.local/share/wejammin-backups/s12-dirty-20261023T022244Z.tgz` (2496 files). IF A CUTOFF KILLS THE LIVE FOUR: reviewers V2/V4
  are read-only — relaunch fresh with the same prompt (their briefs are in this file's history: review-promotion.md + the
  scope paragraphs recorded above); dec208 r3 and registry-parity relaunch as successors ("predecessor killed mid-work; read
  your report and claim, reconcile disk vs report, record unrecorded `.lane-logs` TAPs, resume; never rerun identical bytes").
- 03:30Z: the 11:30pm cutoff (429) killed all four. 03:32Z root resumed dec208 r3 (`ab6e10788a031cb33`; 3 unrecorded TAPs
  222608/222709/222916) and registry-parity (`a79d307e4d3e9bfa2`) via SendMessage, and relaunched V2 fresh
  (`a5ac4881c87ff2fc0`) and V4 fresh (`a8571463c6a7d5632`) — neither had written a report. Old V2/V4 ids are dead.
- registry-parity GREEN (report SHA `5ca1efd8…`; root reran: 5 files / 413 pass, OpenAPI `--check` 0). Genuine defect fixed:
  `cmsCompositionInstancesRead` OpenAPI declared an ETag (BE03c 182 "no entity tag"). BOUNDARY (template reads 415) resolved by
  root: BE03c matrix rows for `cmsTemplateContextRead`/`cmsTemplateLatestRead`, catalog row for the context read, 415 sentence
  (BE03c SHA `343a2434…`); lane resumed to declare 415 in OpenAPI + fix the template OpenAPI test. Noted: the content-schema
  registry's blanket `OPTIONS /api/v1/cms/*` shadows per-route Slice 12 OPTIONS handlers (dead code) — integration item.
- registry-parity DONE GREEN (report SHA `430bc2ea…`; root reran 6 files / 440 pass). D1 ETag + D2 template-read 415 fixed
  (`infra/openapi-definitions.mjs`, `infra/openapi-definitions-cms-composition.mjs`, regenerated `docs/openapi/openapi.json`).
  B2 (blanket CMS preflight in `content-schema-registry/routes.ts:39-71` answers a header/method superset before every
  per-route OPTIONS handler): pre-existing since S09/S10, not a browser defect → QUEUED as a cross-slice cleanup (single
  preflight owner, per-route allow lists) after Slice 12 close; not a promotion blocker. AC-275 re-citation at ledger step.
- linked-update scan lane released (AC-212/213; agent `afa1f5d29142cd62a`; brief `briefs/linked-update-scan.md`; WIP
  `linked-scan` `20261022110000`–`119999`; stack WITHOUT dec208 until dec208 r3 lands).
- dec208 r3 GREEN (report SHA `3606e644…`; final `233710-238690` 14 files / 577 PASS). Gauge split into
  `platform_private.cms_locale_stale_legal_field_count()` (`20261022100005`; 4 dec208 files now); 200-version volume test
  proves no stale-history scan via scan counters. Root DEC-220 (raw record; BE03c SHA `48b1556b…`): RATIFY third index
  `(entry_id, locale, …)` (`lower()` not leakproof under forced RLS); CHANGE failure alert to per-firing (in-process window
  cannot accumulate across isolates). Lane resumed for round 4 (Worker/observability only, no DB). S09 pins also need
  `cms_locale_stale_legal_field_count`.
- dec208 r4 DONE GREEN (report SHA `78f1e059…`; root reran 4 files / 65 pass; no window code remains). SQL unchanged since
  `233710-238690`. Verification review V5 (dec208 final) released: agent `ac8547e7421ba31ad` → `review-v5-report.md`.
- Review V2 (report SHA `0e7e9ee1…`): pattern-updates, dec193, block-rules PROMOTE together (cross-file call-time deps — never a
  subset); `fix-dec193` README-only → delete dir; 0 BLOCKER/0 MAJOR/3 MINOR/4 NIT; R1-001..010 all resolved; squash integrity
  independently re-verified (snapshot recomputed, folded bodies byte-equal, anchors re-simulated, 044800 pin correct). Root:
  V2-02 BE03c wording (`/blockTree/{i}(/children/{j})*`; SHA `75aa3c42…`); V2-03 snapshot proof moved to
  `evidence/squash-catalog-snapshot.sql` (not a test); V2-06 left (reviewer: none required). V2-01/04/05/07 → nits lane
  `claude_s12_v2_nits` (agent `a776a44e7a210b733`, brief `briefs/prepromo-nits-v2.md`).
- PROMOTION READINESS (batch 1): PROMOTE — dec195, locale-gate, dec197, dec202, dec205 (R1–R3); dec194 + dec206 (V1);
  pattern-updates + dec193 + block-rules (V2; after nits lane). PENDING — governed-recheck (V4), dec208 (V5). Batch 2 —
  linked-scan (in progress; needs its own review). Delete before promotion: `governed-recheck-red/`, `fix-dec193/`,
  `fix-recheck/`, `fix-dec206/` (empty), and every other empty historical WIP dir. Promote with original timestamps in one
  commit; local DBs that applied `20261020203606` need `--include-all`; populated-DB migration witness after.
- Review V4 (report SHA `87b3349c…`): governed-recheck PROMOTE with conditions; 0 BLOCKER/0 MAJOR/7 MINOR/6 NIT; R3: 5
  resolved, 2 partial (R3-12 header-only, R3-20 textual proof). Root DEC-221 (raw record; BE03c SHA `58978f2e…`): V4-02 lock
  failures inside the frozen-digest recompute stay retryable CONFLICT (forward patch of promoted `20261013300400`); V4-05
  revocation skips reviews no longer live. Lane `claude_s12_governed_v4` (agent `acfa6ad6b84aafe4b`, brief
  `briefs/governed-v4.md`, NEW WIP `governed-v4` `20261022120000`–`129999`) does V4-01/02/04/05/06/07/08/09/10/11.
  Root keeps: V4-03 race modules (recheck vs activation vs CMS-03A-08; revocation vs governed activation; models
  `phase_02_slice_10_races/014`, `phase_02_slice_11_races/031`, `011` B6) after promotion; V4-12 (delete red dir, r8
  inventory, `database.types.ts`, BE03c + AC-203 signature `cms_recheck_governed_reviews(p_request jsonb)` with request/result
  members, name `cms_governed_recheck_resolve_event`/`cms_governed_recheck_event_ref`, lock row "subject of every examined
  review") at integration; V4-13 note.
- PROMOTION READINESS update: governed-recheck → after governed-v4 lane (then promote `governed-recheck` + `governed-v4`).
- Review V5 (dec208 final; report SHA `2ab2c441…`): PROMOTE (4 files `20261022100000/100005/100010/100020`); V3 9/11 resolved,
  F-3/F-9 root-owned; 0 BLOCKER / 1 MAJOR (= F-3: r8 pin, root) / 3 MINOR / 4 NIT. DEC-220 case-insensitive head selection
  model-checked (300k random worlds, 0 mismatches). V5-2 (007 scan proof blind to 6 of 8 indexes) + V5-3 (immutable comment)
  + V5-5 sent back to the dec208 lane (resumed) before promotion.
- Inventory scan (root, 07:xxZ): WIP creates 69 new function names (8 platform_api + private helpers). BE03c named-RPC
  list ("Permission, RLS and grants") is missing the entry points `cms_get_locale_variant`, `cms_get_related_content`,
  `cms_governed_recheck_resolve_event`, `cms_list_composition_instances` (+ linked-scan `cms_scan_linked_pattern_updates`,
  `cms_linked_scan_resolve_event` when final) — add with AC-261 at integration; S09 `r8_api_surface` must list every new
  `platform_api` name, `sec2_all_schema_definer_rls` every new definer + `taxonomy_merge_recoveries`. Transient WIP dirs to
  delete before promotion: `governed-recheck-red/`, `v2-nits-mutant/` (and any `*mut*`/`*-red` copy), `fix-dec193/`,
  `fix-recheck/`, `fix-dec206/`, and the empty historical dirs.
- dec208 DONE (V5 follow-ups; report SHA `8c92b2eb…`): final `001620-445372` 127/127 PASS; mutant `002359-482591` 5 fails as
  designed (root-verified). `007-volume` now bounds tuples across ALL indexes + seq/heap with no planner overrides and a
  positive control. Files: `100000` `db067815…`, `100005` `ae851c8f…`, `100010` `7e013e1f…`, `100020` `5f186430…` →
  PROMOTE-ready (whole dir). V5-6 (A,B,A case) skipped as not a nit — optional post-promotion test.
  Transient dirs seen now: `governed-v4-red/` (live governed-v4 lane), `v2-nits-mutant/` (live v2-nits lane).
- linked-scan DONE GREEN (report SHA `a9a58bad…`; final `003535-548400` 21 files / 9,878 PASS root-verified; suite 272/272;
  Worker 106 + 696; 14 SQL + 5 Worker mutants killed; PAT-031 test caught a real resolver bug, fixed). Root DEC-222 ratifies its
  spec-silent choices (BE03c SHA `862f0f0f…`). Promote `linked-scan/20261022110000..110300` (batch 2 after review V6).
  Requests for integration: r8 pin + `database.types.ts` + PostgREST allowlists; race modules (scan vs author write, vs next
  activation, vs submit/decision, two scans); `apps/worker/src/cms-composition/README.md` still calls the counter unemitted.
- Review V6 (linked-scan) released: agent `ae6d03df0d4453c14` → `review-v6-report.md`.
- v2-nits DONE GREEN (report SHA `c23d4cb8…`; H `003631-554570` 21 files / 10,032 PASS; mutant B `001544-440893` 6 fails as
  designed — root-verified). V2-01 restore test (`085-rpc-context.sqlinc`), V2-04(a)(c), V2-05 (`140410` after `b4d47156…`),
  V2-07 done; `v2-nits-mutant/` removed. V2-04(b) BOUNDARY → root spec: provider reason precedence = code order (BE03c +
  changelog); precedence TEST queued for the integration lane. pattern-updates/dec193/block-rules = PROMOTE-ready.
- Root inventory cascade done (R2-02/R3-10/V4-12): BE03c named-RPC bullet (+3 supporting reads, +5 internal RPCs, real
  `cms_recheck_governed_reviews(p_request jsonb)` request/result, support table) + changelog; AC-203 and AC-261 updated in
  phase-2, tracker, ledger (tiling re-verified: zero non-receipt guard problems). BE03c SHA `94816d47…`.
- Promotion dry run (root): no WIP-vs-promoted timestamp clash; only duplicates = `governed-recheck-red` (delete); batch 1 =
  74 SQL in 12 dirs (+ governed-v4), batch 2 = linked-scan 4; 54 WIP files sort before the promoted tip `20261020203606`.
- Review V6 (linked-scan; report SHA `a9e08704…`): PROMOTE (0/0/6 MINOR/9 NIT); promote after batch 1. Root decision V6-01:
  no inline row copy — forward-patch `cms_pattern_update_next_row` with a `pending` action inside `linked-scan/` (batch 1
  untouched) and call it; lane resumed with V6-01..06 + surviving Worker mutants. Owner may still override DEC-222 before
  batch 2 freezes.
- governed-v4 DONE GREEN (report SHA `7b8ac66e…`; final `004900-611571` 45 files / 12,204 PASS root-verified). V4-02 forward
  patch `governed-v4/20261022120000` (re-raises 40P01/55P03); V4-05 new private `cms_governed_invalidate_review_if_live`
  (skips non-live reviews); V4-01/04/06-11 closed; mutants killed. Raw record DEC-223 (tenure trigger = 03b rule). Review V7
  (fix verification) released before batch-1 promotion.
- linked-scan V6 follow-ups DONE GREEN (report SHA `9d475f70…`; final `013108-807601` 23 files / 10,387 PASS root-verified;
  suite 347; Worker 112 + 708; 9 SQL mutants killed). V6-01: shared helper `cms_pattern_update_next_row` gains a `pending`
  action via anchored forward patch `linked-scan/20261022110050`; inline copy deleted. Batch 2 = `linked-scan/110000,110050,
  110100,110200,110300`. Verification review V8 (helper patch) released.
- Integration pins lane released (agent `ac04da829e2bce417`, brief `briefs/integration-pins.md`): S09 inventory pins for the final
  object set, provider precedence test, Worker README line.
- Review V7 (report SHA `0f14c84e…`): governed-recheck + governed-v4 PROMOTE (governed-v4 last); 0/0/1 MINOR/4 NIT; V4 10/10
  resolved. V7-01 (person invalidation's routing through the new step is pinned by no test) + V7-02..05 → post-promotion
  test lane together with race R-3 (revocation vs activation, both orders).
- BATCH 1 REVIEW-COMPLETE: pattern-updates, dec193, block-rules, dec194, dec195, locale-gate, dec197, dec202, dec205, dec206,
  governed-recheck, governed-v4, dec208. Batch 2: linked-scan (awaiting V8). Promotion waits only on the integration-pins lane
  (so the canonical `db:verify` is green) — then: delete transient dirs → move WIP SQL → canonical `pnpm db:verify` (quiet
  host, CI flock `/tmp/wejammin-supabase-ci.lock`) → `pnpm validate` → `db:types` → populated-DB witness → race modules →
  local commit (explicit list).
- integration-pins DONE GREEN (report SHA `02aa64ed…`; final `014741-884281` 118 files / 6,412 PASS on the full 14-lane stack,
  root-verified). r8 `r8a_supporting` +8 names (count label now computed: 8+10+84=102); sec2_all #6 + taxonomy_merge_recoveries
  (collate "C"); provider precedence BR-M1a..M6b (mutant killed); Worker README fixed. r8 pins the linked-scan names →
  PROMOTE BATCH 1 + BATCH 2 TOGETHER (after V8). Remaining root: `database.types.ts` (db:types after promotion), PostgREST
  allowlists for the 8 names.
- Review V8 (report SHA `e1582788…`): linked-scan PROMOTE (5 files 110000/110050/110100/110200/110300; 0/0/1 MINOR/5 NIT).
  V8-01 (derived states beyond submitted only source-pinned) + V8-02..06 → post-promotion follow-up.
- PROMOTED 2026-10-23 06:08Z (root): 80 WIP migrations from 14 dirs moved into `supabase/migrations/` (hash-verified;
  manifest `evidence/promotion-manifest-20261023.json` SHA `3beec7ce…`); deleted `governed-recheck-red/` + 20 empty/README-only
  dirs. Pre-promotion backup `~/.local/share/wejammin-backups/s12-prepromotion-20261023T060731Z.tgz` (`2d5055d9…`, 2,570
  files). Canonical `infra/verify-database.sh` (db:reset → lint → test → api-test → races → types:check) RUNNING, log
  `.lane-logs/canonical/db-verify-*.log`. Docs lane `claude_s12_promotion_docs` writing migrations README sections.
- NEXT after db:verify: `pnpm db:types` (database.types.ts) → `pnpm validate` → populated-DB witness lane → post-promotion
  follow-ups (V7-01, V8-01, race R-1..R-4, V6/V8 NITs) → evidence receipts regeneration → ledger re-citation → refutation audit.
- Promotion docs DONE (report SHA `faad056d…`): `supabase/migrations/README.md` "Slice 12 joint promotion of 2026-10-23 (80
  migrations)" with 14 sections, 80/80 listed once (script-checked); WIP lane dirs removed; `migrations-wip/README.md` now says
  empty. Historical docs citing old WIP README paths left unchanged.
- CANONICAL db:verify #1 (log `.lane-logs/canonical/db-verify-20261023T060745Z.log`): db:reset applied 1,082 migrations;
  db:lint ok; db:test PASS 441 files / 29,665 tests; db:api-test FAIL 6 files / 11 tests (899 passed); races + types:check
  not reached. Root triage: (A) ALT-only `phase-02-slice-12-dec194-isolation.apispec.ts` collected by the canonical glob;
  (B) SEC-1 claim-gate manifest lacks 21 Slice 12 claim-reading `platform_api` functions (manifest + mutation suites);
  (C) S11 sweep "real 60/300-second retries": tick claimed ≠ [retry.id] — suspected cross-file fixture interference
  (db:api-test commits fixtures, no reset between files) — root running it isolated; (D) S12 template/locale apispecs expect
  `CAPABILITY_REQUIRED`, Worker/BE03c say `capability_missing`; AC-008/AC-057 503 failures are a cascade (session restore on
  the failed test's last line). Lanes: `claude_s12_apispec_fixes` (A+D, `a01e67466e82f914c`), `claude_s12_sec1_manifest`
  (B, `a93c299b002b70c4c`). Lanes cannot run apispecs; root runs them on the canonical stack under the CI lock.
- apispec-fixes DONE (report SHA `5a8ff2c3…`): DEC-194 suite renamed `*.alt-apispec.ts` + `vitest.postgrest-alt.config.ts` +
  `db:api-test:dec194-alt` (canonical list now 0 dec194 files — root-verified); template/locale apispecs expect
  `capability_missing` + `afterEach` session restore. sec1-manifest DONE (report SHA `78db0559…`): 21 entries, all
  `service-role` / `cfg-actor`; two new fixture modules; no security finding. Root focused runs queued behind the isolated S11
  run (log `.lane-logs/canonical/focused-D-B-*.log`). Tracker `files:` lines naming the old dec194 path: refresh at tick time.
- Root focused runs: S11 sweep-outcomes ALONE on fresh reset PASS 3/3 → (C) is cross-file interference: the third tick at
  06:57:37 also executed other suites' publication schedules that became due during the 300 s sleep (sweep claims all due
  schedules globally — correct behaviour; the test's "only mine is due" assumption is wrong). D PASS 20/20; SEC-1 manifest +
  mutation PASS 22/22 (lane's predicted outcomes all correct). Lane `claude_s12_s11_sweep_isolation` scoping the S11 (and
  sibling) sweep tests to their own world. Then canonical db:verify #2.
- s11-sweep-isolation DONE (report SHA `06d5bf90…`): culprits = `schedule-precision` + `schedule-precision-legacy` apispecs
  (schedules due now+300 s, never waited out). New `expectWorldClaims` + `scopedSnapshotDigest(worldIds)`; sweep-outcomes and
  sweep-composition scoped; README "Shared database: judge your own world". Root combined run (culprits then sweeps after a
  fresh reset): culprits 5/5 then sweeps 7/7 PASS (root-verified). Canonical db:verify #2 RUNNING (log `.lane-logs/canonical/
  db-verify-<stamp>.log`, newest).
- CANONICAL db:verify #2 (`db-verify-20261023T090009Z.log`): db:test PASS 441/29,665; db:api-test PASS 79 files/910;
  races: 22 S09–S11 PASS, all 7 S12 modules FAIL at setup — they were authored as root-only ALT diagnostics (explicit
  `S12_*_ROOT_RELEASE`, primary container forbidden, runtime UNRUN) yet listed in the canonical `RACE_RUNNERS`; governed
  fixture also lacks step-up. Root decision: convert them to a canonical mode (explicit runner opt-in, real-producer fixtures,
  S10/S11 pattern) so every db:verify proves them — lane `claude_s12_races_canonical` (`a875ff03f325bca0c`), root runs.
- `pnpm db:types` regenerated `packages/data-access/src/database.types.ts` (+1,995/−142); `db:types:check` PASS.
  `pnpm validate` #1 stopped at format:check (46 files: ~34 test READMEs + 12 TS, mostly governed-recheck Worker) → root
  `prettier --write` on exactly those (backup `scratchpad/claude_root/pre-prettier.tar`). #2 stopped at lint: 4 unused params
  in `apps/web/src/components/cms-related-content/load-related-content-page.test.ts` → root moved the mock typing into the
  `vi.fn<…>` generic (36/36 pass). Full `pnpm lint` 0, `pnpm type-check` 0. `pnpm validate` #3 RUNNING.
- races-canonical lane READY (report SHA `bd56f0ea…`): `WEJAMMIN_CANONICAL_RACE=1` opt-in set by the runner
  (`infra/database-races/canonical-mode.mjs`, contract test 24 + gate 36/36), governed fixture step-up via real grant proof,
  `ok - <name>` receipts for the two node:test modules; ALT path untouched; protected-primary assert kept (so a canonical run
  from the PRIMARY checkout would fail 4 modules — worktree/CI fine). Root formatted 2 race files. Root runs the 7 modules
  (fresh reset each) after validate #3 finishes; resume the lane (`a875ff03f325bca0c`) with failing output.
- validate #3: through types/progress/format/lint/type-check; test:coverage FAIL 10 files / 100 tests (29,589 pass):
  (1) ~92 S11 delivery-receiving-upgrade-local tests read moved `migrations-wip/dec197/*` paths → lane `claude_s12_wip_paths`
  (`a6fc395c302531be6`) repoints all 34 live `migrations-wip` references; (2) race-canonical-mode regex broken by root's
  prettier rewrap → root made it whitespace-tolerant (24/24); (3) S11 process-record Z94 cited the old typed r8 title →
  root updated the fragment in `.memory/pipeline/progress/verification/2026-10-12-slice-11-red-green-record.md` (14/14);
  (4) S11/S12 evidence guards = receipts (expected).
- S12 races, first canonical run (`.lane-logs/canonical/races-s12-20261023T105902Z.log`): PASS dec193_writer 4,
  dec194_outer 5, entry_default_template_lock 3, governed_authority 15, restore_relation_visibility 4. FAIL dec194_sweep
  (20 ok, then "recovery waits on continuation-held party advisory mutex: producer statement completed while the required
  blocker still held its transaction") and dec199_publication ("actual publish returned before first transaction
  committed"). Sent to races lane for product-vs-test diagnosis; product fixes go FORWARD in new WIP `race-fixes/`.
- Race diagnosis (races lane, report SHA `a040f39f…`): dec194_sweep = TEST PREMISE (the claimed continuation Job is running,
  so the spec's routing pre-filter makes the sweep skip the party; the continuation takes the mutex at `190040:43-44`) →
  module now asserts the mutex via `pg_locks` + sweep completes (test correction — needs independent review). dec199 = REAL
  PRODUCT GAP: publish/schedule/execute never lock pinned PatternVersion rows → forward fix `migrations-wip/race-fixes/
  20261023100000` (FOR SHARE helper) + `100100` (anchored patch of `cms_publication_lock_review`/`cms_schedule_lock_review`)
  + pgTAP `phase_02_slice_12_race_fixes_pattern_locks.sql`. Root DEC-224 (raw record) + BE03c lock-order row. Submit/decision
  same gap but fail-safe (publication rechecks) → not changed; "decision lacks an entry fence" noted for S11 follow-up review.
  Root ALT pgTAP of race-fixes + publication suites RUNNING; then promote race-fixes → reset → rerun dec199 + dec194_sweep +
  S11 races 013/014/015 (or full db:races).
- race-fixes ALT pgTAP: first two runs were ROOT harness errors (zsh no word-split → 1 arg / `NOTESTS`; `(N)` glob qualifier
  disabled) — use a bash script for file lists. Third run: 15 files / 1,319, 2 fails = test literal (`proconfig::text` quoting)
  → root fixed the 2 expected strings → PASS 1,319/0. Root corrected its own BE03c DEC-224 row ids (schedule CMS-03B-07,
  publish CMS-03B-09, execute CMS-03B-20). PROMOTED race-fixes `20261023100000` (`d105b23e…`), `100100` (`e659f421…`) +
  migrations README section; manifest updated; `migrations-wip/` now README-only. Rerun of dec199, dec194_sweep, S11
  013/014/015 run (`.lane-logs/canonical/races-rerun-*.log`): dec194_sweep 27 PASS; S11 013 22 / 014 35 / 015 8 PASS (no
  regression from the new lock); dec199: wait now happens (change-first witness ok) then `activationEffects` id mismatch at
  `093-publication-race-effects.mjs:118` → back to races lane for diagnosis.
- dec199 effects mismatch = TEST expectation (audit correlation id comes from `context.correlationId`, not the request's
  top-level field) → races lane fixed `093-publication-race-effects.mjs`. Root rerun `race-dec199-*.log`: change-first and
  publish-first both PASS (4 ok). ALL 7 S12 RACE MODULES NOW PASS CANONICALLY. Review V9 released (race-fixes product fix +
  the race test corrections) before commit.
- wip-paths DONE (report SHA `e8f38868…`): all live `migrations-wip` refs repointed; DEC-197 upgrade tooling now
  promoted-only (`buildUpgradePlan` refuses any other source; WIP fallback removed) — test REMOVALS DR-UP-P03..P06 and a
  rewritten DR-UR-S02 need independent review (queue with V9 follow-up / V10). 92 S11 upgrade tests PASS; whole-repo Vitest
  now 29,678 pass / 5 fail = the S09–S12 evidence receipt guards only (S12 receipts file missing). Comment-only stale refs left:
  3 replay sqlinc line-1 comments + `phase_02_slice_12_race_fixes_pattern_locks.sql:2` (later pgTAP pass).
- Canonical db:verify #3 RUNNING. Then: receipts regeneration S09–S12 (`node scripts/evidence/run-slice-evidence.mjs
  --slice N`) → validate → V9/V10 verdicts → local commit.
- Review V9 (report SHA `f7174fa5…`): race-fixes KEEP; all race test corrections ACCEPT; 0 BLOCKER / 1 MAJOR / 3 MINOR / 4 NIT.
  V9-01 MAJOR: `database.types.ts` predates race-fixes → regenerate after db:verify #3 frees the DB (only one new
  `platform_private` entry expected). V9-03 → root DEC-225 (raw record): canonical mode drops the primary-checkout assert, ALT
  keeps it — races lane resumed (also V9-05/06 NITs). V9-02 (schedule/execute waiting witnesses, root-pin arm, detached
  exclusion, mixed use) + V9-04 → post-commit test follow-up.
- races lane DEC-225 done (report SHA `2305af92…`; `assertRaceCheckout` helper; contract tests 39/39; V9-05/06 closed, V9-07
  recorded). CANONICAL db:verify #3 (`db-verify-20261023T113036Z.log`): db:test PASS, db:api-test PASS, races 29/29 PASS,
  only types:check stale (V9-01, expected). Root then: `pnpm db:types` + `db:types:check` PASS; reran the 4 DEC-225 modules
  canonically: dec193_writer 4, dec194_outer 5, dec194_sweep 27, dec199 4 — all PASS. => every canonical stage green on the
  current bytes (split across #3 + the follow-up run).
- Evidence receipts regeneration RUNNING: `run-slice-evidence.mjs --slice 12/11/10` (logs `.lane-logs/canonical/
  evidence-sNN-*.log`); S09 (marker design) next.
- Review V10 (report SHA `1cdc82af…`): ACCEPT every wip-paths change; 0/0/3 MINOR/4 NIT; no evidence lost (no ledger cited the
  removed tests); tamper detection intact. Its Appendix A has 2 test files / 11 tests killing 14 mutants (V10-01 target-source
  guards, V10-02 DR-UR-S03) → land via a small lane AFTER the receipt regeneration (quiet host). V10-03: the lane report's
  before-hash for `local-prefix.test.ts` is wrong (true `df413213…`) — note only.
- Evidence regen attempt 1: every DB step ABORTED ("database reset failed") — ROOT error: the preceding root script ended
  with `pnpm db:stop` and the evidence runner resets but never starts the stack. Non-DB steps PASSED (S12 vitest +
  functional playwright). Attempt 2 RUNNING with `pnpm db:start` under the lock first. Note for the runner: a stopped stack
  should be a precondition error with that message, not a generic reset failure (small follow-up).
- Evidence regen attempt 2: S10 ALL PASS (2,057 receipts); S11 all PASS except real-route Playwright (2,309 receipts; 1
  failed + 1 skipped); S12 all PASS except real-route Playwright (778 receipts; 1 failed). Root ran the two specs:
  (1) S11 bundle budget AC-106: workflow route initial JS 96,593 gzip > 92,160 (Slice 12 code on the initial path);
  (2) S12 template real-route: "Draft version saved." missing + `getByRole('status')` matches 4. Lane
  `claude_s12_web_realroute` released; root reruns real-route specs + the S11/S12 evidence afterwards. S09 receipts
  (marker design, `pnpm evidence:collect`/test:evidence:s09) still to do.
- FINAL EVIDENCE ORDER (receipts pin file SHA-256, so they go LAST): after the web-realroute lane is green on root's real-route
  rerun → rerun `run-slice-evidence.mjs --slice 12/11/10` → S09: full `vitest run --reporter=json`, `pnpm test:evidence:s09`,
  `pnpm db:test:tap`, Playwright JSON per config, `pnpm db:races` → `pnpm evidence:collect --slice 09 …` → `pnpm validate`.
  V10 appendix tests lane `claude_s12_v10_tests` released in parallel (infra tests only).
- v10-tests DONE GREEN (report SHA `eb973962…`): `…-upgrade-local-source.test.ts` (5) + `…-upgrade-host-source.test.ts` (6),
  ids DR-UT-*; 14/14 mutants killed on scratch copies; delivery-receiving set 19 files / 569 pass; DR-UR-S02 → S04; S11
  sql-parity comment edit makes one S11 receipt stale (covered by the final regeneration). V10-05 supabase/tests README items
  left (not pure wording).
- web-realroute lane round 1 (report SHA `32876f59…`): template real-route PASS (locator scoped by text + count 1; 4 status
  regions are legitimate per FE03); workflow real-route PASS 6; AC-106 cold load now PASS (~90,050) BUT the lazy-chunk test
  now FAILS (schedule-form open fetches 96,235 > 81,920) — merge moved bytes to first use. Also found: `bundle:check` fails
  entry editor 95,933 + locale variant 93,791 (> 90 KiB `BUNDLE_BUDGETS.initialRouteGzipBytes`), and the static-closure
  gate misses mount-time lazy loads (governed review detail 103,692, taxonomy edit 108,507 in Chrome). Root decision: fix ALL
  budget breaches now and close the measurement gap (prefer bundle:check charging hydration-mounted chunks) — lane resumed.
- Live: V5 `ac8547e7421ba31ad`, linked-scan `afa1f5d29142cd62a`, v2-nits `a776a44e7a210b733` (waiting on its run),
  governed-v4 `acfa6ad6b84aafe4b`.
- Live: dec208 r3 `ab6e10788a031cb33`, V2 `a5ac4881c87ff2fc0`, V4 `a8571463c6a7d5632`, linked-scan `afa1f5d29142cd62a`.

## Fixed facts

- Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, branch `claude/phase2-slice12`,
  HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e`. Primary `/home/rob/Projects/WeJammin` read-only.
- Intake backup: `~/.local/share/wejammin-backups/s12-dirty-20261022T052758Z.tgz`
  (SHA-256 `e9c584b459fb51e88c2f11637e328c21de0ae4fdd1897d8ca6a7d961f5cec395`, 2,129 files).
- Model routing (owner 2026-10-22): root `claude-opus-5-5` orchestrates/researches; EVERY subagent
  (executors and reviewers) runs Sonnet 5.5 (`model: sonnet`). Cap ~4 concurrent agents.
- DEC-204 (owner 2026-10-22, raw record only; compile NOT run): ALT pgTAP lanes via
  `docs/handoffs/2026-10-14-claude-s12/lanes/lane-db-alt-staged.sh` + canonical `pnpm db:verify` →
  `pnpm validate` at reviewed checkpoints, lanes paused, CI flock. DEC-203 native tracing, the
  native-finality metadata audit window, privileged commands, lock deletion: still HELD.
- Lane rules: `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` (still binding). Briefs for this
  resume live in `docs/handoffs/2026-10-22-claude-s12/briefs/`.
- Local commits authorized at reviewed checkpoints (owner 2026-10-15): explicit file lists, conventional
  messages, never push/PR without a fresh ask.

## Intake evidence (`.lane-logs/s12-claude-intake-20261022/`)

- Ledger: 296 criteria — 9 verified, 66 partial, 221 unverified; 943 clauses, 682 uncited;
  citations pgtap 222 / vitest 409 / playwright 16.
- Classification of every uncited clause: `classify-001-099.*`, `classify-100-199.*`, `classify-200-296.*`.
  Most uncited clauses have an existing high-confidence test (re-citation work); ledger limitations stale.
- Baseline promoted-only pgTAP (69 S12 files): 9,029 tests, FAIL, 23 failing files, mostly WIP-dependent.
  TAP `.lane-logs/alt-staged-none-012859-2826876.tap`.
- All-WIP diagnostic (pattern-updates,dec193,dec194,dec195,locale-gate,dec197; 65 WIP migrations): see
  `baseline-allwip.out`.

## Implementation gaps (from classification)

Backend: AC-286–296 default template (DEC-202, tests authored, `cms_create_entry` still NULL);
AC-202/203/204 governed-review recheck job + revocation invalidation; AC-212/213 linked-update scan
consumer; AC-239/241/242/244/246 taxonomy provider/resolve/restore-carry/encoder; AC-248 aggregate
relays; AC-051/052/263/264 metrics/alerts/trace. Frontend: composition page + `CmsCompositionInstanceList`,
`CmsPatternSelector`, `CmsPatternUpdateDiff` (AC-045/111/117/123/269); locale page +
`CmsLocaleVariantForm` (AC-058/270/282). Tests: postgrest apispecs CMS-03C-02/03/05/06–11; Playwright
for governed/related/taxonomy/pattern/composition/locale; race modules 03C-02/03/05/07/08/09; Hono
mount vs registry; p95 bench. Evidence: ledger re-citation, missing
`tests/contracts/phase-02-slice-12-evidence-guard.test.ts`, canonical receipts.
Drift to resolve: AC-169#9 retry 15/60/300 s vs code 250/750 ms; AC-141#3 Shard 02 vs 01.
- AC-169#9 research (root, 2026-10-22): BE03c error matrix row CMS-03C-01 (line 1406) gives caller
  retry "502/503/504: at most 3 times at 15s/60s/300s with jitter, circuit open 60s" (mirrors BE00
  line 550, the Queue-consumer schedule); FE03 line 1216 gives the browser rule "retry at most twice
  after 250 ms and 750 ms only when BE declares safe". Web code follows FE03. Genuine cross-layer spec
  conflict for interactive protected reads → owner question (queued; one at a time), not a code fix.

## Owner decisions this resume (raw records in `.memory/raw/events/2026-10-22.jsonl`; compile NOT run)

- DEC-204 local DB authority; DEC-205 locale-variant read (`cmsLocaleVariantRead`); DEC-206 composition
  instance list read (`cmsCompositionInstancesRead`); DEC-207 AC-202 amended (revocation never enqueues).
- DEC-208 locale observability via periodic service-role aggregate read (no `locale` label); DEC-209
  `cms_resolve_conflict` carries composition from `theirs` (AC-245 amended); DEC-210 block
  allowedChildren/slotRules enforced at save/place/accept/detach/provider (root wrote BE03c paragraph).
- Root corrections (no owner needed): FE03 step-up wording on 6 route rows (BE03c Recent MFA ~222);
  DEC-206 BE03c rows aligned to BE00 cursor rules (limit 1–50/25, signed cursor, items ≤50).
- DEC-211 retry split by caller (browser 2x 250/750 ms; server/queue/job 3x 15/60/300 s); AC-169 amended.
- DEC-212 (root implementation decision, owner may override): DEC-194 recovery table renamed out of the `cms_`
  namespace to `platform_private.taxonomy_merge_recoveries`; BE03c sweep/table/lock-order text and runbook updated.
- Review verdicts (R1/R2/R3 reports in this dir): PROMOTE dec195, locale-gate, dec197, dec202, dec205;
  PROMOTE governed-recheck after F4b; FIX FIRST pattern-updates+dec193 (F1, F2), dec194 (F3), dec206 (F4a).
  All repair-a / repair-b test corrections ACCEPTED.
- Wave results so far: dec202 141/141; dec205 119/119; dec206 246/246; governed-recheck 83/83; repair-a S12
  72 files 13,987/13,988 (related_perf #17 p95 under load 13.6 — recheck on quiet host); repair-b S10+S11 177 files
  6,277/0 fail; integ-contracts, integ-web-worker (merge-converge wiring restored), docs-readmes GREEN;
  observability PARTIAL (resolved by DEC-208, lane not yet released); evidence-cite PARTIAL (457 citations added,
  171 held; S12 guard exists, red until receipts).
- Queued: R2-02 dec194 spec text (table count, sweep writes recovery table, mutex in lock order, AC-261 RPC list,
  runbook) — root writes after F3 renames the recovery table; DEC-208 implementation lane; evidence-cite held
  citations (171) applied only with receipts + refutation; guard path charset `[`/`]`; 21 duplicate titles;
  separator-clause re-tiling; promotion timestamp ordering (WIP before promoted `20261020203606`, R1-010/R2-06).

## Evidence so far

- Full all-WIP pgTAP (7 lanes): 426 files / 27,178 tests / 22 failing files → repair-a (S12), repair-b (S10/S11);
  S09 inventory pins (r8_api_surface, schema, sec2 definer RLS, p240, evidence_misc) left for root after repairs.
- Full unit baseline: 28,700 / 21 failed → integ-contracts, integ-web-worker; S09/S10/S11 receipt guards need
  regenerated receipts after promotion + canonical runs (never hand-edit).

## Remaining queue (dependency order)

1. Wave 2 lanes finish (repair-a, repair-b, integ-contracts, integ-web-worker).
2. S09 pgTAP inventory pins + `database.types.ts` (after the function set is final for this wave).
3. Independent Sonnet review of every WIP lane (security/authority focus), then joint promotion of WIP
   (`pattern-updates, dec193, dec194, dec195, locale-gate, dec197, dec202, dec205, dec206, governed-recheck,
   repair-a, repair-b`) into `supabase/migrations/` in timestamp order; populated-DB migration witness.
4. Root race modules: dec202 `entry_default_template_lock/020-race.mjs`, governed authority race (expectations
   may change after revocation trigger), others per `phase-02-slice-09-race-runner-gate`.
5. Post-promotion lanes: DEC-208 locale observability aggregate RPC + Worker tick + gauge (finishes AC-052/263/264;
   write the BE03c Observability rows first); AC-261 RPC/table inventory cascade once the function set is final
   (adds DEC-194/195/196/205/206/208/210 RPCs; owner-approved by those decisions); runbook
   `docs/runbooks/platform/cms-composition.md` named by the new alerts;
   taxonomy receiving AC-239/241/242/244/246 (touches `cms_restore_revision`, encoder);
   linked-update scan AC-212/213; event relay AC-248; observability AC-051/052/263/264; postgrest apispecs
   CMS-03C-02/03/05/06–11 (+ new reads); Playwright Slice 12 journeys (AC-273 two-person, AC-045 etc.);
   p95 benches (AC-279); Hono mount vs registry test.
6. Canonical `pnpm db:verify` → `pnpm validate` (quiet host, CI flock) → evidence receipts regeneration
   (S09–S12) → Slice 12 ledger re-citation + `phase-02-slice-12-evidence-guard.test.ts` → separate-population
   refutation audit → ticks → Slice 12 close → Slice 10/11 open criteria → Slices 13–17 → `/validate-phase`.

## Lanes

See `LANES.md`.
