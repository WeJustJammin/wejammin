# Review V10 report (lane `claude_s12_wip_paths`: WIP-path repointing and the DEC-197 upgrade-tooling logic change)

Status: FINAL (2026-10-23T13:11Z, reviewer V10). Independent: V10 did not author and had not reviewed any of this.
Read-only: no SQL, docker, supabase, pgTAP, race module or staged runner was started (a canonical `db:verify` was running; its
PostgREST api-test process was visible in `ps` and was left alone). Commands used: `sha256sum`, `diff`, `grep`, `tar -x` of two backup
archives into scratch, `python3` string work on scratch copies, `prettier --check`, `eslint`, and Vitest (Node only, `nice -n 19`,
`--maxWorkers=1`, console suppressed, JSON reports written to scratch). Nothing in the repository was edited except this report; the
`git status --short` listing (1,306 lines; this report sits inside the already-untracked `docs/handoffs/2026-10-22-claude-s12/` directory, so it
adds no line) was identical at the start and at my last check, no path is staged, and all 34 lane files still hash to the lane report's "after" column. One later
change is root's, not this review's: at 13:12Z `tests/contracts/phase-02-slice-12-receipts.generated.jsonl` appeared (root is regenerating evidence receipts;
`run-slice-evidence.mjs --slice 11` was running).
Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, branch `claude/phase2-slice12`, HEAD
`b16edb54a7a1b698ed8ca15b6085046d4270626e`. The DEC-197 upgrade tooling and its tests are untracked in git on every ref
(`git log --all` has no commit for them), so the "before" state exists only in two backups; both were used (see Evidence base).
Scratch (session-local, will not survive): `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/review_v10/`.

## Verdict

**ACCEPT every change in the lane. No change is rejected and nothing needs to be reverted.**

Counts by severity: **BLOCKER 0, MAJOR 0, MINOR 3, NIT 4** (plus 6 informational notes that are not counted).

| # | Change | Verdict | One-line reason |
| --- | --- | --- | --- |
| C1 | `infra/database-upgrades/delivery-receiving-upgrade-plan.mjs`: `sourcePaths()` becomes `sourcePath()`; `resolveMigrationSource` promoted-only; `buildUpgradePlan` refuses any other `source.path` | ACCEPT | Correct and complete for the post-promotion world; matches the original design brief; the new guard is killed by the rewritten DR-UR-S02 (it had no killer before). See V10-02 for one hardening gap |
| C2 | `delivery-receiving-upgrade-host-source.mjs`: WIP read and promoted/WIP divergence check removed | ACCEPT | Correct; the removed check was never exercised by a test (mutant OH1b survived before the lane). Adapter parity checks stay untested (V10-01) |
| C3 | `delivery-receiving-upgrade-local-inventory.mjs`: two-path list replaced by the promoted path | ACCEPT | Correct; the target source is now also inside the baseline listing, so post-preflight drift is double-guarded. Its explicit guards stay untested (V10-01) |
| C4 | `delivery-receiving-upgrade-catalog-relations-contract.mjs`: header comment "WIP SQL" to "promoted SQL" | ACCEPT | Comment only; hash reconstruction verified |
| C5 | `infra/database-upgrades/README.md` API paragraph | ACCEPT | Matches the code; none of the edited modules or the README is SHA-pinned by any receipt |
| T1 | `witness-parity.test.ts`: DR-UP-P03..P06 removed, `selectMigration` reduced, P01 now `toBe(PROMOTED)` | ACCEPT | P03..P06 tested a helper defined inside the test file that mirrored the removed behavior; none is cited anywhere. P01 (real files) kept and stricter |
| T2 | `upgrade-plan.test.ts`: DR-UR-S01 WIP and identical-dual variants removed | ACCEPT | Same reason; promoted variant kept |
| T3 | `upgrade-plan.test.ts`: DR-UR-S02 rewritten to "a source path outside the promoted directory is refused" | ACCEPT | Strictly stronger: kills a guard that no test killed before. The reused ID is a traceability nit (V10-04) |
| T4 | `local-prefix.test.ts` P08/P17: the two `promoteTarget(mock)` calls and the import removed; the function itself deleted from `local-fixtures.ts` | ACCEPT | The real directory now holds the target at its sorted position, which is exactly what `promoteTarget` simulated. Assertions are byte-identical to before |
| T5 | Fixtures (`fixtures`, `local-fixtures`, `renewal-fixtures`, `source-fixtures`): `wip` export removed, `source.path` bound to the promoted file | ACCEPT | Needed by C1; runs green (558/558 in the DR suites); these files are outside every `tsc` project (V10-06) |
| T6 | Five Slice 12 `*-parity.test.ts`: `existsSync(promoted) ? promoted : WIP` replaced by the promoted path | ACCEPT | Still compares witness region to migration region; verified by 1-byte mutations of either side and by removing the promoted file |
| T7 | Doc and comment repoints (worker `linked-scan/README.md`, `pattern-update.test-support.ts`, `closeout.test-support.ts`, 11 pgTAP READMEs) and the three `*-replay.sqlinc` left unedited | ACCEPT | Targets verified to exist; leaving the `.sqlinc` bytes alone is correct because `closureSha256` hashes every `\ir`-included file. Residual stale wording is V10-05 |

Disposition for root: safe to take into the local commit as it stands. Before the DEC-197 harness is used to produce any receipt, land the
tests of Appendix A (verified in scratch to kill all 14 surviving mutants) and correct the one wrong hash of V10-03.

## Evidence base

1. **Hash audit of the lane report.** All 34 rows of the "Files" table: "after" hash equals the current file for 34/34. "Before" hashes:
   32 verified against the lane's own pre-edit tar (`orig-20261023T110358Z.tar`, `sha256sum -c` clean); the `catalog-relations-contract.mjs`
   reconstruction (`e5d34eb9…`) verified against root's pre-promotion backup (`~/.local/share/wejammin-backups/s12-prepromotion-20261023T060731Z.tgz`,
   same hash) and by reversing the one-line edit; **the `local-prefix.test.ts` reconstruction is wrong** (V10-03).
2. **Independent pre-lane state.** Root's pre-promotion backup (the lane's own tar lacks these three) supplied the original `local-prefix.test.ts`,
   `catalog-relations-contract.mjs` and the original WIP `supabase/migrations-wip/dec197/20261016030000_delivery_receiving_contracts.sql`, whose SHA-256 is
   `1117a83f72496887c6b36d100b7fa2635aa4673d699841932291967b1516f3b6`. That is also the hash in the 2026-10-16 DEC-197 lane report, in
   `promotion-manifest-20261023.json`, of the current promoted file and of the current `080-forward-migration.sqlinc`.
3. **Old world and new world rebuilt in scratch.** "New" = current tree. "Old" = the 82 files promoted this session removed from
   `supabase/migrations/`, the WIP dec197 file restored, and the pre-lane infra and test files overlaid (every overlaid hash equals the
   lane's "before" hash, `local-prefix.test.ts` equals the true original). Baselines: old 17 files / 564 tests pass, new 17 files / 558 pass.
   The delta of 6 is exactly the removed tests (witness-parity 17 to 13, plan 35 to 33), and it equals the delta seen against the
   2026-10-22 intake log (`.lane-logs/s12-claude-intake-20261022/unit-full.json`, taken before promotion).
4. **Mutation analysis** (22 mutants on the new tree, 20 on the old tree, plus the proposed tests): method in Appendix B.

Reviewed files (current hash; "before" is the verified pre-lane hash):

| File | Before | After (current) |
| --- | --- | --- |
| `infra/database-upgrades/delivery-receiving-upgrade-plan.mjs` | 5688cd765ddb8a2bc397ad2c5c9755e33365ce5f0135ac8b39f5d5106aaaa1de | 9316ca5122c74b5ca479f859ef6fc03ea65cece940e1ab8af7d99cf494341d83 |
| `infra/database-upgrades/delivery-receiving-upgrade-host-source.mjs` | 0f36d4ba072b52698efed4013067882f320b295e34852633b4ffccb61d858b14 | f317b6449cef89913ef9c9fefe309e035e20378df93816c069894140395d86ef |
| `infra/database-upgrades/delivery-receiving-upgrade-local-inventory.mjs` | 2b03e60f2a0f71a43b641c66401983ba7ebd724bedf40dbf6226659d3c6452c8 | 99583728737026fa1491c4c22b5546ed7545eec51da712039b30ae3002ad90c0 |
| `infra/database-upgrades/delivery-receiving-upgrade-catalog-relations-contract.mjs` | e5d34eb9c797dbfff79faa2a60ee7d6d8a47e8b38f26c6ebd5858459a8a02391 | 58a0cf0b943f1d7290595904b125fea8d13860b58db8969c0514d167e14dfce1 |
| `infra/database-upgrades/README.md` | 84c4aba0ca9a187245da8fd5cac3ef6563e7d1699584e6cce8f77ecab9921b86 | 1a414f7cde8732ff2df543ff0760f288b6ff003b61d6ed00f781f5845d842e12 |
| `tests/contracts/phase-02-slice-11-delivery-receiving-witness-parity.test.ts` | 847b748f82e01b73f887130b6c89d063d6d8ee94b6f515bd770dc2bc7f2e4362 | 14401082b392416e67b17bc4a0c2884fdfa2c7f2215d24e6b7b22986b4e36cd8 |
| `tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-plan.test.ts` | df86831d4b3259cc3b40ba73fab1d26575c5bed2159fcb802b701b3d52003845 | c1e0b6f8d7d127c2a90bb53e49aa262563185cde16a6c90ed21830b4ba88fb11 |
| `tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-local-prefix.test.ts` | **df41321395024afaf4b9824e96ad4aa6aab69a3124427b7719667caa41c41389** (lane report says b5870e37…) | e318e19f6f926f7ebfc672435d62f360afc7ec4c6346012891e4969c1c088252 |
| `tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-local-fixtures.ts` | 02ece38f18fc0a39f96c2efd311d257d5e8be62bcbd3e0747125e721213268a8 | 14620f8242b2ad3a979d58e9bf18bf4fe90aea111431d9a5ffb8707325353421 |
| `tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-fixtures.ts` | f3e145f7fdc6706fb4f4ba6943d4a32cc001506e00a6bdcf9f452e34714f8ede | cabd88adb0670c6bb9bf39a68a3bab6fac6dca15b022b4a1f803ace62ad5210f |
| `tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-renewal-fixtures.ts` | 53128cd4a6eb19cfb8d8fb10c515cb1dc3f43837662b0819902dc074dc756cfc | 7edfd4354fc1befecdf7b641be02d9fab8818cdda6b14890ad851deb5a52cb74 |
| `tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-source-fixtures.ts` | aad1523b2047cd4a778b545b3a100c724a63ffe30482d7f3460273c695ed6495 | 2f3b17dd666b341a3068236f686872912d9256054b374b1883fd642952b88962 |
| `tests/contracts/phase-02-slice-12-pattern-lineage-witness-parity.test.ts` | 2c9ea0d2d1c4b854de985b3cbef736457563c27e1f59a9a3336565453bfaf892 | 9c98154cef79899ac331211740397685401f515038cd0eaf9601c2168433a037 |
| `tests/contracts/phase-02-slice-12-pattern-placement-witness-parity.test.ts` | 810f1db6e08e5adad186873a39e68e17c598ccf598921e25a1c2c370ea9183db | 312dc5fe7df75036d74cf5bda073b3538581d42f4f90b1ce88e551b936505b65 |
| `tests/contracts/phase-02-slice-12-pattern-updates-pending-parity.test.ts` | dadeabd01812b75f821581e53ae046cc8aab7b48e70e651e2d4bb6963303edb8 | d3d45bed2dbf5b5a06d4adfbf327f563e8d222df24d92aafba98382cbcf0e4d9 |
| `tests/contracts/phase-02-slice-12-taxonomy-lineage-witness-parity.test.ts` | a1051ddf612ad8af156232929778353ef1f06b7c74970e4f70c8118fb898b186 | c4f9fcc505579dedeede35cd1add4b0c5092b6fe169692f884ba0968f4d89372 |
| `tests/contracts/phase-02-slice-12-taxonomy-terms-witness-parity.test.ts` | 6670f9a46b3129d9e74407fa8cee3beab6589e5c86102be3766184d26bf92a6f | 70990d5c4eba195acf45f07f9d946dd8508a08846d480475fec1c63eee937319 |

The other 17 rows (worker README and test-support comment, closeout comment, 11 pgTAP READMEs, 3 unedited `.sqlinc`) were diffed against the tar and
checked for target existence; the three `.sqlinc` hashes are unchanged (`41f98e6d…`, `2b422689…`, `889db390…`).

## Question 1: is the logic change correct and complete for the post-promotion world?

**Purpose of the tooling** (README, DEC-197 and the briefs). `infra/database-upgrades/` is the injected decision layer of the DEC-197 receiving-upgrade
witness: reset a sealed ALT database to the predecessor prefix (every promoted migration whose name sorts before the target), build the 060/065 world,
replay the whole 080 copy of `20261016030000_delivery_receiving_contracts.sql` in a fresh client, compare 070 snapshots, then restore the ordinary promoted
baseline. There is no DEC-197 runbook under `docs/runbooks/` (`grep -rIliE "receiving.upgrade|dec-?197|upgrade witness"` over it: no match; the directory has no
receiving or upgrade page). The design sources are `docs/handoffs/2026-10-14-claude-s12/briefs/codex-dec197-upgrade-alt-reset.md` and
`lane-codex-dec197-upgrade-2026-10-16.md`. Two statements settle the post-promotion semantics:

- Brief, lines 73-76: after promotion the ordinary baseline digest "includes the target migration" and the prefix and baseline digests must never be
  equated. The lane's fixtures now satisfy this by construction (`attestation.baselineSha256` differs from `prefixSha256` without any splice).
- Original lane report, lines 48-49: dual-source rules (promoted wins only if WIP is absent or byte-equal; WIP is a fallback only while promoted is
  missing) were a promotion-transition design. `supabase/migrations-wip/README.md` and DEC-197 ("applied migrations remain immutable and any later schema
  correction is forward-only") say the WIP twin ends at promotion. Root deleted the WIP directories; no WIP twin of an already promoted, hard-coded
  `MIGRATION` is legitimate any more.

**Module-by-module (current code read in full).**

- `plan.mjs` (212 lines): `sourcePath(repository)` is the single path `supabase/migrations/<MIGRATION>`. `resolveMigrationSource` reads exactly that path;
  only `undefined` means absent, a thrown read error propagates, a non-Buffer or empty result refuses (`bytes()`), and the returned `path` is always
  the promoted path. `buildUpgradePlan` now requires `input.source.path === sourcePath(repository)` (`foreign source path`) and keeps the
  `sha256` and `content.equals(witness)` bindings. The runner calls `assertUpgradePlan` (which rebuilds the plan) at eight boundaries
  (`infra/run-delivery-receiving-upgrade.mjs` lines 98, 106, 124, 127, 136, 156, 171, 216), so a plan carrying the retired path is refused before any I/O.
  `resolveMigrationSource` has no production caller in the repository (an external adapter is not authored); it is exercised by tests only.
- `local-inventory.mjs` (205 lines): `discover` computes `baseline` (all promoted `.sql`) and `prefix` (names and versions below the target) exactly as before,
  then requires `plan.source.path === join(directory, MIGRATION)`, reads that one file, requires it present and byte-equal to `plan.source.bytes`, and still
  compares the mounted 080 copy with `plan.witness`. The "ambiguous migration inventory" guard (`version !== target version || name === MIGRATION`) is unchanged,
  so a same-version impostor file still refuses.
- `host-source.mjs` (159 lines): one read of the promoted file, presence required, then the unchanged parity condition
  (`source.equals(witness)`, request source hash, request witness hash).
- `catalog-relations-contract.mjs`: one comment word.
- All other modules that mention `baseline` or `source` (`local-prefix`, `local-staging`, `local-reset-state`, `host-request`, `host-boundary`, `run-...mjs`)
  contain no WIP or dual-source assumption; they were already generic over `prefix` and `baseline` entry lists.

**Facts about the world the code now meets.** `supabase/migrations/` holds 543 `.sql` files. Of the 82 files promoted this session, 18 sort before the target
(so the predecessor prefix grew from 460 to 478 files), the target itself, and 63 sort after it; the baseline grew from 461 to 543. The 18 newly inserted
predecessors are pattern-update, taxonomy-merge-recovery, related-content-read and locale-gate migrations (`20261014050600` to `20261014200010`); none
operates on `route_manifest_version`, `publication_projection` or `projection_consumer_state` (one comment in `20261014190020` names the last as an analogy).
The harness is UNRUN, so whether the 060/065 world replays cleanly on the larger prefix is a runtime fact this review cannot establish (informational note I3).

**Completeness.** Repository-wide `grep -rIn migrations-wip` outside `.git`, `.lane-logs`, `docs/handoffs`, `.memory`, `node_modules` returns exactly seven files:
the immutable promoted `20261016040800_cms_detached_tree_registry.sql` comment, `supabase/migrations/README.md:736` (historical sentence), `supabase/migrations-wip/README.md`,
the three `*-replay.sqlinc` line-1 comments (no code parses them), and the deliberate retired path in `upgrade-plan.test.ts` (DR-UR-S02). That equals the lane's
"by design" list; the race-fixes pgTAP comment the lane listed as open (`phase_02_slice_12_race_fixes_pattern_locks.sql:2`) already names
`supabase/migrations/20261023100000, 20261023100100`. No test, fixture or module still imports `wip` or `promoteTarget` (`grep` empty).

**Judgement.** Correct and complete. The only residual issues are test strength (V10-01, V10-02) and documentation (V10-03..V10-06).

## Question 2: does any removed or rewritten test carry acceptance evidence that is now lost?

**No.** Searched: all 21 ledger, receipt and evidence-map files for Slices 09 to 12 (`phase-02-slice-09-evidence-{cascade,map}.test.ts`, `-09-amendment-evidence.ts`,
`-09-receipts`, the five Slice 10 files (four ledger files plus receipts), the six Slice 11 files (five ledger files plus `-11-receipts`), the six Slice 12 ledger files;
`phase-02-slice-12-receipts.generated.jsonl` does not exist yet), the Slice 11 tracker
(503 lines), the Slice 12 tracker (4,216 lines), `.memory/**`, `tests/**`, `scripts/**`, `docs/**`. Ten patterns (`delivery-receiving`, `DR-U[PRL]-`,
`witness-parity`, `database-upgrades`, `run-delivery-receiving-upgrade`, and the five Slice 12 parity file stems) have **0 hits** in every ledger, every receipt
file and the Slice 11 tracker. In the Slice 12 tracker every line that names a touched module, test or fixture (17 stems checked, 16 lines: 3346, 3448, 3500, 3564,
3584, 3612, 3620, 3652, 3676, 3686, 3698, 3710, 3722, 3726, 3766, 3859) is a `- files:` ownership-claim line, none is a criterion or evidence line; the only test id
there is `DR-UR-O01/O02/O03` (line 3565), outcome tests the lane did not touch. The Slice 11 tracker and ledger mention no "upgrade" criterion at all.
`DR-U*` ids also occur in older handoff reports, the intake JSON log, and (as unrelated pgTAP titles) in `065-upgrade-empty-world.sqlinc:5,10,18,26,33`.
The Slice 12 receipts file that root generated at 13:12Z (636 lines) was checked after the fact with the same patterns: 0 hits.

| Test | File | What it asserted | Cited by a criterion, ledger, receipt or tracker line? | Disposition |
| --- | --- | --- | --- | --- |
| DR-UP-P03 | witness-parity | test-local `selectMigration` uses WIP only when promoted is absent | No | Retired with the behavior |
| DR-UP-P04 | witness-parity | identical dual sources choose promoted | No | Retired |
| DR-UP-P05 | witness-parity | divergent dual sources refuse | No | Retired |
| DR-UP-P06 | witness-parity | final-newline discrepancy between WIP and promoted refuses | No | Retired |
| DR-UR-S01 WIP variant | upgrade-plan | `resolveMigrationSource` returns the WIP source and path | No | Retired (OP12 mutant: only this test killed it) |
| DR-UR-S01 identical-dual variant | upgrade-plan | dual identical sources return promoted | No | Retired |
| DR-UR-S02 (old) | upgrade-plan | divergent promoted and WIP refuse | No | Replaced; old killer of OP11 |
| DR-UL-P08, DR-UL-P17 | local-prefix | not removed; only the `promoteTarget(mock)` call deleted | No | Assertions byte-identical (diff against the true original) |
| DR-UP-P02, P07, titles | witness-parity | wording only ("prefers promoted..." to "returns the promoted bytes...") | No | Ids unchanged |

Note on the lane report's wording ("Neither removed test id is cited..., grep found only the handoff note and the test files"): the conclusion holds, the grep
description does not (P08/P17 were not removed, and the repository has more hits than the two the report names). Informational note I6.

## Question 3: does any removal weaken a guarantee that still matters?

**What the removed machinery guarded.** Promotion integrity: while a WIP twin existed, "promoted bytes equal the author's WIP bytes" was enforced by dual-source rules in
four places (`resolveMigrationSource`: fallback and divergence refusal; `buildUpgradePlan`: two accepted paths; `observeSource`: divergence refusal; `discover`: both sources
compared with the plan bytes). That check has no subject once the twin is deleted. Its
subject, "the promoted bytes are the authored bytes", is anchored today by: (a) hash `1117a83f…` identical in the original lane report, root's backup of the WIP file,
the promotion manifest, the promoted file and the 080 copy; (b) `DR-UP-P01` comparing the real promoted file with the real 080 copy; (c) the runtime
comparisons that survive the lane.

**Is a stale or tampered promoted copy still detected?**

- Unit level, repository files: yes. In scratch, changing `version_no > 0` to `version_no > 1` in the promoted copy fails DR-UP-P01 and DR-UP-P09; appending a
  line to the 080 copy fails DR-UP-P01; restoring both returns 13/13 green.
- Runtime, local adapter: yes in code. `discover` refuses a foreign path, a missing file, promoted bytes that differ from `plan.source.bytes`, and a 080 copy that
  differs from `plan.witness`; a post-preflight edit additionally trips the baseline fingerprint. Observed in scratch: in the unmutated new tree the DR-UL-P07 "target source
  drift" scenario is rejected with `DEC197: actual target source drift/divergence` (the explicit guard fires first); with every explicit target-source guard removed (LC3) the same
  scenario is still rejected, now with `source/seed/config inventory drift` (the fingerprint, which includes `baselineSha256`, i.e. the target's bytes).
- Runtime, host adapter: yes in code (`complete source/080 parity drift`).
- **Test strength of those runtime guards is thin, and one killer was lost.** Mutation results (each mutant is one edit to the scratch copy of the production module):

| Guard | Old tree (pre-lane code and tests) | New tree (current) |
| --- | --- | --- |
| `buildUpgradePlan` source-path guard | SURVIVED (OP3, OP4): no test | KILLED by DR-UR-S02 (P3, P4) |
| `buildUpgradePlan` source bytes equal witness | KILLED, 5 tests (OP6) | KILLED, 5 tests (P6) |
| `buildUpgradePlan` declared source sha256 | KILLED, 2 tests (OP7) | KILLED, 2 tests (P7) |
| `resolveMigrationSource` dual-source divergence / WIP path | KILLED by old S02 / S01-WIP (OP11, OP12) | not applicable (behavior removed) |
| `resolveMigrationSource` absence refusal | SURVIVED, message-equivalent (OP13) | SURVIVED, message-equivalent (P9) |
| Re-introducing a WIP read in `resolveMigrationSource` | not applicable | **SURVIVED (P8)** |
| `sourcePath()` regressing to the WIP path | not run | KILLED, 195 tests (P5) |
| `discover` path guard | SURVIVED (OL1) | SURVIVED (L1) |
| `discover` missing-target refusal | SURVIVED (OL2) | SURVIVED (L2) |
| `discover` target-source read + drift block (all of it) | **KILLED by DR-UL-P07** (OL3, OL5, OLC, OLC3) | **SURVIVED (L3, L5, LC, LC2, LC3)** |
| `discover` 080 equals `plan.witness` | SURVIVED (OL4) | SURVIVED (L4) |
| `observeSource` missing refusal | SURVIVED (OH1) | SURVIVED (H1) |
| `observeSource` promoted/WIP divergence | SURVIVED (OH1b): never tested | not applicable |
| `observeSource` source/080/request parity (each clause and the whole condition) | SURVIVED (OH2, OH3, OH4, OHC) | SURVIVED (H2, H3, H4, HC) |
| `observeSource` reads the promoted location | not run | KILLED, 44 tests (H5) |

Reading: the lane removed only behavior whose tests it removed (the only guards that went from KILLED to not-applicable are OP11 and OP12, both behavior the lane
deleted). One guard gained a killer (the `buildUpgradePlan` path guard). One lost its only killer: DR-UL-P07 killed the old drift loop because the WIP source was outside the baseline listing; with the
promoted target now inside the baseline, the same edit also trips the fingerprint recheck, so removing the explicit guard no longer fails any test. That is a loss of
test power, not of runtime detection. Everything else on the adapters' target-source path was untested before the lane and stays untested (V10-01).

**Verdict for Q3:** no production guarantee is weaker. Two test-strength gaps are recorded as V10-01 and V10-02. A coordinated edit of both the promoted migration and the
080 copy would pass every test (true of any promoted migration once its WIP twin is gone, not something this lane introduced); no test pins the absolute migration hash
and immutability of promoted migrations is process-enforced (informational note I5).

## Question 4: do the five Slice 12 parity tests still compare what they were meant to compare?

Yes. Diff scope: each file loses `existsSync`, the fallback to `supabase/migrations-wip/<lane>/`, and the clause in its header comment; `migrationPath()` returns
`supabase/migrations/<MIGRATION>`. Each MIGRATION constant resolves to a present promoted file and each witness path to a present pgTAP file. On the current tree the
promoted file exists, so the old code already took its promoted branch and behavior is unchanged. Scratch mutation of the copies (all five tests, same four probes):

| Probe | Result in all five |
| --- | --- |
| +1 byte inside the promoted BEGIN/END region | `replays exactly the DDL of ...` fails (1 test) |
| +1 byte inside the witness region | same test fails (1 test) |
| promoted file removed | `ENOENT` and 3 failing tests: no silent skip, no WIP fallback |
| END marker removed from the promoted copy | 3 failing tests |
| restored | 3/3 pass |

## Question 5: affected non-DB Vitest files (Vitest 4.1.11, one worker)

| Run | Scope | Files | Tests | Result |
| --- | --- | --- | --- | --- |
| A | 17 Slice 11 `delivery-receiving-*` files, `phase-02-slice-11-closeout`, six Slice 12 witness/parity files | 24 | 590 | **590 pass**, exit 0. DR upgrade files 16 files 545 tests, witness-parity (S11) 13, five S12 parity 15 plus fix-template 1, closeout 16 |
| B | the lane's own command: `tests/contracts/phase-02-slice-11-delivery-receiving`, `...-11-closeout`, `tests/contracts/phase-02-slice-12`, `apps/worker/src/cms-composition` | 194 (193 pass, 1 fail) | 4,687 (4,685 pass, 2 fail) | The only failures: `phase-02-slice-12-evidence-guard.test.ts` ("759 evidence problem(s)" and "`phase-02-slice-12-receipts.generated.jsonl` is missing"). Buckets: S11 DR 17 files / 558, closeout 1 / 16, S12 contracts 26 / 621, worker `cms-composition*` 150 / 3,492 |
| C | importers of `pattern-update.test-support.ts` not in B (web server and API tests, two worker files) | 7 | 161 | all pass |
| D | `apps/web/src/pages/api/v1/cms/entries/[entryId]/compositions.test.ts` | 1 | 3 | all pass |

Run B was taken at about 12:58Z, before that receipts file existed, so its two failures describe that moment. It matches the lane report on every figure the lane gave (194 files / 193 pass; DR 545 + 13; closeout 16; worker `cms-composition*` 150 files / 3,492) and the two failures are
the ones the lane named. The total differs by +3 tests (4,687 against the lane's 4,684); with the other buckets equal, the three sit in the 26 `phase-02-slice-12-*` contract files,
consistent with other lanes adding tests there, and are not attributable to this lane. Also: `prettier --check` on the 20 edited TS, MJS and MD files: clean;
`eslint --max-warnings=0` on the 18 edited TS and MJS files: exit 0.

## Findings

### V10-01 (MINOR) Promoted-only target-source guards in the local and host adapters have no killing test; one test lost its discriminating power

Evidence: table in Question 3. In the new tree 12 distinct mutants of `discover` and `observeSource` survive every one of the 17 DR test files (L1..L5, LC, LC2, LC3 in
`local-inventory.mjs`; H1..H4, HC in `host-source.mjs`), including deletion of every target-source check in `discover` at once (LC3) and of the whole host parity condition (HC).
In the old tree the host side (OH1..OH4, OHC) and `discover`'s path, missing and 080 guards (OL1, OL2, OL4) also survived, so most of this predates the lane, but
(a) the lane rewrote exactly these lines, including one new equality guard (`plan.source.path === join(directory, MIGRATION)`) with no test, and (b) the only test that killed
the target-source block, DR-UL-P07, stopped discriminating because promotion put the target into the baseline listing.
Why it matters: these are the checks that refuse a stale or tampered promoted copy at the adapter boundary. A regression there would not be noticed by CI and the harness is the
instrument intended to produce DEC-197 upgrade evidence.
Fix (verified): Appendix A, two new test files, 11 tests (PROP-2..5 local, PROP-H0..H2 host) pass on the current code and kill all 14 re-tested surviving mutants (LC is a duplicate of L3).
Keep them out of `local-prefix.test.ts`: it is 369 lines and the cap is 400.

### V10-02 (MINOR) DR-UR-S03 cannot detect a re-introduced WIP read or a changed refusal reason

Evidence: mutant P8 (`readOptional(path) ?? readOptional(<wip path>)`) and P9 (drop `requireFact(read !== undefined, 'migration missing')`) both survive. The test's `reader()`
throws for any non-promoted path and S03 asserts a bare `toThrow()`, so a fallback read of the WIP path still "throws". The lane's stated reason for the change is that a plan
must not bind a source from an unreviewed untracked location; a silent fallback that returned WIP bytes under the promoted `path` would do exactly that.
Fix (verified): PROP-1 in Appendix A asserts `toThrow('migration missing')` and `calls` equals `[promoted]`; kills P8 and P9. Fold it into S03 (plan.test.ts is 323 lines).

### V10-03 (MINOR) The lane report's "before" hash for `local-prefix.test.ts` is wrong

Report: `b5870e3772defeed77f23ff52d61d47fe35a15a8273d65a916925ef1dfc12eea` "reconstructed by reversing the edit". True pre-lane bytes:
`df41321395024afaf4b9824e96ad4aa6aab69a3124427b7719667caa41c41389` (root's pre-promotion backup; member mtime 2026-10-22 13:57:16; `patch -R` of the three-hunk diff onto the current
file reproduces it exactly). The audit trail of a hash table is its value; this row cannot be verified by the method it states. Correct the row. No code consequence.

### V10-04 (NIT) Test-id hygiene

DR-UR-S02 now names a different assertion than in the pre-lane file and the 2026-10-22 intake log (the lane report and STATE.md record the rewrite); DR-UP-P03..P06
vanish with no tombstone; and DR-UP-P03, P04, P05 are also
pgTAP titles in `065-upgrade-empty-world.sqlinc:18,26,33` (different assertions), which already made searches by id ambiguous. Fix: give the rewritten test a fresh id
(for example DR-UR-S04) and add one comment line "DR-UP-P03..P06 retired with the WIP fallback; ids not reused" in `witness-parity.test.ts`.

### V10-05 (NIT) Residual stale WIP wording that a path-based grep cannot find

- `tests/contracts/phase-02-slice-11-sql-parity.test.ts:231` still says "WIP 20261016044400" for a promoted migration.
- `supabase/tests/phase_02_slice_12_pattern_placement/README.md:10` ("Run with the governed activation WIP staged: lane `governed-b,placement`") and
  `supabase/tests/phase_02_slice_12_governed_fix3/README.md:19` ("lane list `governed-b,governed-fix3`") give commands that now fail:
  `docs/handoffs/2026-10-14-claude-s12/lanes/lane-db-alt-staged.sh:76-77` exits 4 with "no WIP directory for lane" for any lane without a directory.
- `supabase/tests/phase_02_slice_12_dec193_resolution/README.md:9-12` now says the DEC-193 foundation is promoted and, in the next sentence, that the resolution helper is
  "intentionally absent at RED". The lane flagged this and did not verify it; verified stale: `platform_private.cms_pattern_update_resolve` is in promoted
  `20261016040600_cms_pattern_update_resolve.sql`. The RED-era README (including "Proposed private seam") needs a status line.
- Cosmetic: the new `infra/database-upgrades/README.md` sentence leaves one unwrapped 118-character line among 80-column prose.

### V10-06 (NIT) The "type-check exit 0" claim does not cover the edited tests

`pnpm type-check` is `tsc --build tsconfig.json` over the app and package projects. No tsconfig includes `tests/contracts/**` and the workspace has no `@types/node`, so the 13
edited `tests/contracts` files are not type-checked by that command (the worker comment edit is, via `apps/worker/tsconfig.json`). The edited tests are validated by Vitest and ESLint
only (both clean, above). The lane report's line should not be read as type coverage of the tests.

### V10-07 (NIT) Three witness-parity tests assert only a helper defined in the same file

After the lane, DR-UP-P02, P07 and P08 exercise a short `selectMigration` helper declared inside `witness-parity.test.ts`; none imports production code. This was equally true of the
removed P03..P06 and of the old P02/P07/P08, so it is not a regression, but the file's assurance is P01 (real files) plus P09..P17 (mutations of another in-file function).
Consider deleting P02/P07/P08; `plan.test.ts` S01/S03 already test the real `resolveMigrationSource`.

## Corrections to the lane report

1. Files table, row `local-prefix.test.ts`, "before": replace `b5870e37…` with `df41321395024afaf4b9824e96ad4aa6aab69a3124427b7719667caa41c41389` (V10-03).
2. "Test corrections", last bullet: P08 and P17 are edited, not removed; the citation search is wider than "the handoff note and the test files" (I6).
3. "Runs": `pnpm type-check` does not include `tests/contracts` (V10-06).
4. "Open items": the race-fixes comment is already repointed; the `dec193_resolution` README claim is verified stale (V10-05).

## Informational notes (not counted)

- I1. The upgrade tooling, its tests and fixtures, and 183 of the 543 promoted migrations are untracked; the lane's edits are recoverable only from the two backups until the local commit.
- I2. The local suites are not hermetic: `altTarget()` points at `/home/rob/.codex/worktrees/phase2-slice10/orchestration/altdb`, and `fixture()` reads that directory's real
  `supabase/config.toml` (and 12 MB of `supabase/tests`). They pass here; they would fail on any host without that path. Pre-existing.
- I3. The predecessor prefix the harness replays grew from 460 to 478 migrations (18 Slice 12 files inserted before the target). Fixture compatibility is a runtime fact (harness UNRUN).
- I4. Both tests of `phase-02-slice-12-evidence-guard.test.ts` fail (receipts file missing, 759 evidence problems); root-owned regeneration, unrelated to any WIP path.
- I5. No test pins an absolute migration hash; promoted-migration immutability is enforced by process (promotion manifest, migrations README), not by CI.
- I6. Lane report grep description inaccurate (Question 2 note).

## Limits of this review

No database, container, supabase CLI or race module was run, so nothing here speaks to PostgreSQL behavior, the 060/065/070/080 world on the 478-file prefix, lock or FD
ownership, or `db:verify`. Mutation results come from scratch copies of the tree (current, and a reconstructed pre-promotion tree whose DR tests pass 564/564); they
measure which unit tests would notice an edit, not production risk. "Old tree" fidelity rests on root's backup of 2026-10-23T06:07Z. The lane's whole-repository Vitest run (29,678 pass /
5 evidence-guard failures) was not repeated; the affected files above were.

## Reproduction

```sh
cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin
export PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH
# Run A
nice -n 19 pnpm exec vitest run --maxWorkers=1 --silent tests/contracts/phase-02-slice-11-delivery-receiving \
  tests/contracts/phase-02-slice-11-closeout.test.ts tests/contracts/phase-02-slice-12-pattern-lineage-witness-parity.test.ts \
  tests/contracts/phase-02-slice-12-pattern-placement-witness-parity.test.ts tests/contracts/phase-02-slice-12-pattern-updates-pending-parity.test.ts \
  tests/contracts/phase-02-slice-12-taxonomy-lineage-witness-parity.test.ts tests/contracts/phase-02-slice-12-taxonomy-terms-witness-parity.test.ts \
  tests/contracts/phase-02-slice-12-fix-template-witness-parity.test.ts
# Run B (lane command)
nice -n 19 pnpm exec vitest run --maxWorkers=1 --silent tests/contracts/phase-02-slice-11-delivery-receiving \
  tests/contracts/phase-02-slice-11-closeout tests/contracts/phase-02-slice-12 apps/worker/src/cms-composition
# Original pre-lane files
tar -xzf ~/.local/share/wejammin-backups/s12-prepromotion-20261023T060731Z.tgz -C <scratch> \
  tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-local-prefix.test.ts \
  infra/database-upgrades/delivery-receiving-upgrade-catalog-relations-contract.mjs \
  supabase/migrations-wip/dec197/20261016030000_delivery_receiving_contracts.sql
```

Scratch artifacts (hashes): `mut/results-new.json` 4251923040e0569f913503d01f016a001aef20e2fc234973f0e29fb144978ec5, `mut/results-new2.json`
f670fe7560f8bb014a00e908e84d4d178a54b87fecefd8016143b801a676184a, `mut/results-old.json` 3dee61d406595585e8a062745f84eb9ba0f5652da7c4ef19fddc175cb19fd43c,
`mut/results-old2.json` d07eabe2e5f83ea36278a99d0fd71242ea8717484114c1c030a88c0e24ed68a9, `mut/results-final.json`
39ee2c930f844a31ea2831fa219c4833aac3af3741ed85fc3f0e162491dc7199, `mut/harness.py` c8ed462d86d3274a2bbb0e73cd812867c816e98551a715b6d878c358453941f7,
`proposed/local-source.test.ts` b8ac1b878781197a7fb553f8ed30f756d76ebbaa185d33044e5f2be93ad1621e, `proposed/host-source.test.ts`
d41db9f9b3cb346da89e464617b68238ce6da11495a622340a3a40bf9f22b7f9, `run-a.json` fff31880a904ad6484350ee486f3df2a32258c3a6b6a1177614d7e03af7e603f,
`run-b.json` c2a141fe8addd4eeac5b0077710317e81639c038bb2d6668bf3bbe4eee914115.

## Appendix A: proposed tests (verified in scratch; not applied to the repository)

Both files pass on the current tree (11 tests) and kill P8, P9, L1, L2, L3, L4, L5, H1, H2, H3, H4, HC, LC2, LC3. Place them as new files
`tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-local-source.test.ts` and `...-host-source.test.ts`; move PROP-1 into DR-UR-S03 if preferred.
They import only existing exports (`fixture`, `localAdapter`, `noReset`, `receiving`, `targetName`, `promoted`, `apiCase`, `repository`).

```ts
// ...-local-source.test.ts
import { Buffer } from 'node:buffer';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  apiCase,
  promoted,
  repository,
} from './phase-02-slice-11-delivery-receiving-upgrade-fixtures';
import {
  fixture,
  localAdapter,
  noReset,
  receiving,
  targetName,
} from './phase-02-slice-11-delivery-receiving-upgrade-local-fixtures';

describe('DEC-197 promoted-only target-source guards', () => {
  apiCase(
    'PROP-1 absent promoted source refuses with the explicit message and nothing else is consulted',
    (api) => {
      const calls: string[] = [];
      expect(() =>
        api.resolveMigrationSource({
          repository,
          readOptional: (path) => {
            calls.push(path);
            return undefined;
          },
        }),
      ).toThrow('migration missing');
      expect(calls).toEqual([promoted]);
    },
  );

  it('PROP-2 preflight refuses promoted target bytes that differ from the plan source bytes', async () => {
    const mock = await fixture();
    mock.fs.put(mock.plan.source.path, {
      bytes: Buffer.from('-- stale promoted copy\n'),
    });
    const adapter = await localAdapter('prefix', mock);
    await expect(adapter.preparePrefix(mock.plan)).rejects.toThrow(
      'actual target source drift/divergence',
    );
    noReset(mock);
  });

  it('PROP-3 preflight refuses a plan source path outside the promoted directory', async () => {
    const mock = await fixture();
    mock.plan.source.path = join(
      repository,
      'supabase/migrations-wip/dec197',
      targetName,
    );
    const adapter = await localAdapter('prefix', mock);
    await expect(adapter.preparePrefix(mock.plan)).rejects.toThrow(
      'foreign target source path',
    );
    noReset(mock);
  });

  it('PROP-4 preflight refuses when the promoted target file is absent', async () => {
    const mock = await fixture();
    mock.fs.entries.delete(mock.plan.source.path);
    const adapter = await localAdapter('prefix', mock);
    await expect(adapter.preparePrefix(mock.plan)).rejects.toThrow(
      'target source missing',
    );
    noReset(mock);
  });

  it('PROP-5 preflight refuses a mounted 080 replay copy that differs from the plan witness', async () => {
    const mock = await fixture();
    mock.fs.put(join(receiving, '080-forward-migration.sqlinc'), {
      bytes: Buffer.from('-- stale replay copy\n'),
    });
    const adapter = await localAdapter('prefix', mock);
    await expect(adapter.preparePrefix(mock.plan)).rejects.toThrow(
      'actual complete 080 copy drift',
    );
    noReset(mock);
  });
});
```

```ts
// ...-host-source.test.ts
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  fixture,
  targetName,
  promoted,
  type Fixture,
} from './phase-02-slice-11-delivery-receiving-upgrade-local-fixtures';

const sha = (b: Buffer | string): string =>
  createHash('sha256').update(b).digest('hex');
const host = async () =>
  (await import(
    new URL(
      '../../infra/database-upgrades/delivery-receiving-upgrade-host-source.mjs',
      import.meta.url,
    ).href
  )) as {
    observeSource(
      fs: Fixture['fs'],
      request: Record<string, unknown>,
      raw: Record<string, unknown>,
      first: unknown,
    ): Promise<unknown>;
  };
const shape = (e: { path: string; bytes: Buffer; sha256: string }) => ({
  path: e.path,
  bytes: Buffer.from(e.bytes),
  sha256: e.sha256,
});
const manifest = (entries: Array<{ path: string; sha256: string }>) =>
  sha(
    entries.map((e) => `${e.path.split('/').at(-1)}\t${e.sha256}\n`).join(''),
  );

function build(mock: Fixture, purpose: 'prefix' | 'baseline') {
  const baseline = mock.entries.map(shape);
  const prefix = baseline.filter((e) => e.path.split('/').at(-1)! < targetName);
  const selected = purpose === 'prefix' ? prefix : baseline;
  return {
    request: {
      target: mock.plan.target,
      purpose,
      inventory: selected,
      inventorySha256: manifest(selected),
      sourceSha256: mock.plan.sourceSha256,
      witnessSha256: mock.plan.witnessSha256,
    } as Record<string, unknown>,
    raw: { promotedInventory: baseline, stagedInventory: selected },
  };
}

describe('DEC-197 host observeSource target-source parity', () => {
  it('PROP-H0 accepts the genuine promoted baseline (arrangement is real)', async () => {
    const mock = await fixture();
    const { request, raw } = build(mock, 'baseline');
    await expect(
      (await host()).observeSource(mock.fs, request, raw, undefined),
    ).resolves.toBeTruthy();
  });

  const stale = Buffer.from('-- stale promoted copy\n');
  const cases: Array<
    [string, (mock: Fixture, r: Record<string, unknown>) => void]
  > = [
    [
      'promoted bytes differ from 080 and from the request hashes',
      (mock) => mock.fs.put(join(promoted, targetName), { bytes: stale }),
    ],
    [
      'promoted differs from 080 although each file matches its own request hash',
      (mock, r) => {
        mock.fs.put(join(promoted, targetName), { bytes: stale });
        r.sourceSha256 = sha(stale);
      },
    ],
    [
      'request source hash is forged',
      (_mock, r) => {
        r.sourceSha256 = 'f'.repeat(64);
      },
    ],
    [
      'request witness hash is forged',
      (_mock, r) => {
        r.witnessSha256 = 'f'.repeat(64);
      },
    ],
  ];
  for (const [name, arrange] of cases) {
    it(`PROP-H1 refuses: ${name}`, async () => {
      const mock = await fixture();
      const { request, raw } = build(mock, 'prefix');
      arrange(mock, request);
      await expect(
        (await host()).observeSource(mock.fs, request, raw, undefined),
      ).rejects.toThrow('complete source/080 parity drift');
    });
  }

  it('PROP-H2 refuses when the promoted target file is absent', async () => {
    const mock = await fixture();
    const { request, raw } = build(mock, 'prefix');
    mock.fs.entries.delete(join(promoted, targetName));
    await expect(
      (await host()).observeSource(mock.fs, request, raw, undefined),
    ).rejects.toThrow('actual migration source missing');
  });
});
```

## Appendix B: mutation method

Harness `mut/harness.py` (scratch): for each mutant, require the quoted text to occur exactly once in the pristine copy of one production module, write the replacement into the
scratch tree only, run the 17 DR test files (`node node_modules/vitest/vitest.mjs run --silent --reporter=json`, one worker, `nice -n 19`), record failing tests, and restore the file
from the pristine copy. A mutant is KILLED if at least one test fails. The scratch trees contain copies of `tests/contracts/phase-02-slice-11-delivery-receiving*`, `infra/database-upgrades`,
`infra/run-delivery-receiving-upgrade.mjs`, `supabase/migrations`, `supabase/tests`, `supabase/seed.sql` and a symlink to the repository `node_modules`; the repository was never written.

New tree (22): P3 drop path guard; P4 accept any string path; P5 `sourcePath()` returns the WIP path; P6 drop `content.equals(witness)`; P7 drop declared sha256 check; P8 add a WIP
fallback read; P9 drop the `migration missing` refusal; P10 fabricate bytes for an absent source; L1 drop `discover` path guard; L2 drop `target source missing`; L3 drop target bytes
equal `plan.source.bytes`; L4 drop 080 equal `plan.witness`; L5 replace the actual read by `plan.source.bytes`; LC same as L3; LC2 drop the whole read + missing + drift block; LC3 drop
path guard + read + missing + drift; H1 drop `actual migration source missing`; H2 drop `source.equals(witness)`; H3 drop `sha256(source) === request.sourceSha256`; H4 drop
`sha256(witness) === request.witnessSha256`; H5 read the WIP location; HC replace the whole parity condition by `true`.
Old tree (20): OP3, OP4, OP6, OP7 as above on the two-path code; OP11 drop the divergence refusal; OP12 always report the promoted path; OP13 drop the absence refusal; OL1 drop
`paths.includes(plan.source.path)`; OL2 drop `target source missing`; OL3 drop the drift/divergence loop; OL4 drop 080 equal `plan.witness`; OL5 replace actual reads by plan bytes; OLC and
OLC3 combined variants; OH1 drop `promoted || wip`; OH1b drop the promoted/WIP divergence refusal; OH2, OH3, OH4, OHC as H2, H3, H4, HC.
Totals: new tree 7 killed / 15 survived; old tree 8 killed / 12 survived; the 14 re-tested new-tree survivors are all killed by Appendix A.

Harness source (scratch `mut/harness.py`, SHA-256 `c8ed462d86d3274a2bbb0e73cd812867c816e98551a715b6d878c358453941f7`); it only ever writes inside the scratch world it is given:

```py
#!/usr/bin/env python3
"""Mutation harness (scratch only). Usage: harness.py <world_root> <pristine_root> <mutants.json> <out.json>
Each mutant: {id, file (relative to world root), old, new, note}. Applies to the scratch copy only, runs vitest, restores."""
import json, os, shutil, subprocess, sys, time

world, pristine, mfile, out = sys.argv[1:5]
env = dict(os.environ)
env['PATH'] = '/home/rob/.local/share/wejammin-toolchain/bin:' + env['PATH']
mutants = json.load(open(mfile))
results = []

def run(tag):
    outfile = os.path.join(os.path.dirname(out), f'run-{tag}.json')
    if os.path.exists(outfile): os.remove(outfile)
    t = time.time()
    p = subprocess.run(['nice', '-n', '19', 'node', 'node_modules/vitest/vitest.mjs', 'run', '--silent',
                        '--reporter=json', f'--outputFile={outfile}'] + (sys.argv[5:] if len(sys.argv) > 5 else []),
                       cwd=world, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    d = json.load(open(outfile))
    failed = []
    for f in d['testResults']:
        for a in f['assertionResults']:
            if a['status'] != 'passed':
                failed.append((os.path.basename(f['name']), a['fullName']))
        if f['status'] != 'passed' and not f['assertionResults']:
            failed.append((os.path.basename(f['name']), '<file-level failure>'))
    return dict(exit=p.returncode, total=d['numTotalTests'], passed=d['numPassedTests'], failed=d['numFailedTests'],
                failed_tests=failed, secs=round(time.time() - t, 1))

for m in mutants:
    path = os.path.join(world, m['file'])
    src = open(os.path.join(pristine, m['file'])).read()
    n = src.count(m['old'])
    if n != 1:
        results.append(dict(id=m['id'], error=f'old text occurs {n} times'))
        continue
    open(path, 'w').write(src.replace(m['old'], m['new']))
    try:
        r = run(m['id'])
    finally:
        shutil.copyfile(os.path.join(pristine, m['file']), path)
    r.update(id=m['id'], note=m.get('note', ''), killed=(r['failed'] > 0 or r['exit'] != 0))
    results.append(r)
    print(m['id'], 'KILLED' if r['killed'] else 'SURVIVED', r['failed'], 'failing tests', flush=True)
json.dump(results, open(out, 'w'), indent=1)
```
