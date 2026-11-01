# Lane claude_s12_v10_tests report

## Status
GREEN (2026-10-23T14:30Z). No DB, docker, supabase or Playwright was used. Non-DB Vitest, eslint and prettier only.
Scratch: /tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_v10_tests/
Backup tar of every edited pre-existing file: scratch/orig-20261023T141244Z.tar (before-hashes: scratch/before.sha).

## Scope
Review V10 Appendix A landed as two new test files (11 tests); 14 surviving mutants proven killed on a scratch world;
V10-04 id fix; V10-05 pure-wording fixes. No production module under `infra/` was edited (their hashes are unchanged).

## Files (SHA-256 before -> after, lines after)
| File | Before | After | Lines |
| --- | --- | --- | --- |
| tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-local-source.test.ts (new) | - | e23f97e32debc0fb608af2556f66f4b4f67cf65936691b8db7bd13a1f4712ac5 | 86 |
| tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-host-source.test.ts (new) | - | 15f1098254c9d3f35b0ac2f18316213eaed7e192367ed9befd3a75fb6a64112b | 119 |
| tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-plan.test.ts | c1e0b6f8d7d127c2a90bb53e49aa262563185cde16a6c90ed21830b4ba88fb11 | 60b7f5a2cf10addd239e6d91ff0b48c814efb279306d57f3df2d815aa0c5b0da | 324 |
| tests/contracts/phase-02-slice-11-delivery-receiving-witness-parity.test.ts | 14401082b392416e67b17bc4a0c2884fdfa2c7f2215d24e6b7b22986b4e36cd8 | 2df717f5261eaca877c365ef937a4c2a54dee64f0e620fb4950e8f79c424a6be | 150 |
| tests/contracts/phase-02-slice-11-sql-parity.test.ts | 57438e29a8a19d4e6b752dd28e9225fa83e01a6076774544deffc82a3ee29abc | 9213a06e20049901afb4ef1cbdf51294c3513afd6a19f7b24cf732319e00c1d1 | 291 |
| infra/database-upgrades/README.md | 1a414f7cde8732ff2df543ff0760f288b6ff003b61d6ed00f781f5845d842e12 | ffda07126abc28d3f236d35d19508843c027f8309d69ca8f2e80633590416226 | 210 |

Unchanged (verified by `sha256sum -c`): `delivery-receiving-upgrade-plan.mjs` 9316ca51..., `-host-source.mjs` f317b644..., `-local-inventory.mjs` 99583728....

## Fixes to the appendix for the repo's real shape
- Test ids: appendix used PROP-*. Renamed to a unique prefix `DR-UT-` (target source): R01, L01..L04, H00..H05. `DR-UL-S01..S15` and
  `DR-UR-S01..S03` already exist, so `DR-UT-*` was chosen after a grep of every `DR-U?-[A-Z]\d+` id in the tests.
- `promoted` means two different things: the target FILE path in `-fixtures.ts` (used by R01) and the migrations DIRECTORY in
  `-local-fixtures.ts` (used by the host test via `join(promoted, targetName)`). Both imports in the appendix were already right; no change needed.
- Host test: appendix cases PROP-H0, H1 (four cases) and H2 became DR-UT-H00, H01..H04 and H05; case-callback parameters got descriptive names.
  Formatting passes prettier; eslint --max-warnings=0 exit 0.
- PROP-1 stays in the new local-source file (as DR-UT-R01) instead of being folded into DR-UR-S03; S03 is untouched.
- Header comments added to both files stating unit-only (no DB/DDL proof), matching the other files.

## Mutation proof (method)
Scratch world `scratch/world/`: copy of `tests/contracts`, `infra/database-upgrades`, `infra/run-delivery-receiving-upgrade.mjs`, `supabase/migrations`,
`supabase/tests`, `supabase/seed.sql`, `supabase/config.toml`, configs, with symlinks to the repo `node_modules`, `packages`, `apps` (read-only use).
The repository was never written for mutation. Harness `scratch/mut/run.py`, mutant table `scratch/mut/mutants.py`; each mutant text occurs exactly
once in the pristine copy, is applied to the world copy, then restored from `scratch/pristine/`; `diff -rq` confirms the world was restored.
"New" run = the 2 new files only (11 tests). "Old" run = the 17 pre-existing DR files minus the new two (558 tests; baseline 558/558 green) to confirm
the mutant really survived before.

| Mutant | Edit (module) | Pre-existing 17 files (558 tests) | New tests: result | Killing test(s) |
| --- | --- | --- | --- | --- |
| P8 | add WIP fallback read in `resolveMigrationSource` (plan.mjs) | SURVIVED | KILLED | DR-UT-R01 |
| P9 | drop `migration missing` refusal (plan.mjs) | SURVIVED | KILLED | DR-UT-R01 |
| L1 | drop `foreign target source path` guard (local-inventory.mjs) | SURVIVED | KILLED | DR-UT-L02 |
| L2 | drop `target source missing` (local-inventory.mjs) | SURVIVED | KILLED | DR-UT-L03 |
| L3 | drop target bytes == `plan.source.bytes` drift guard | SURVIVED | KILLED | DR-UT-L01 |
| L4 | drop 080 copy == `plan.witness` | SURVIVED | KILLED | DR-UT-L04 |
| L5 | replace the actual target read by `plan.source.bytes` | SURVIVED | KILLED | DR-UT-L01, L03 |
| LC2 | drop read + missing + drift block | SURVIVED | KILLED | DR-UT-L01, L03 |
| LC3 | drop path guard + read + missing + drift | SURVIVED | KILLED | DR-UT-L01, L02, L03 |
| H1 | drop `actual migration source missing` (host-source.mjs) | SURVIVED | KILLED | DR-UT-H05 |
| H2 | drop `source.equals(witness)` | SURVIVED | KILLED | DR-UT-H02 |
| H3 | drop `sha256(source) === request.sourceSha256` | SURVIVED | KILLED | DR-UT-H03 |
| H4 | drop `sha256(witness) === request.witnessSha256` | SURVIVED | KILLED | DR-UT-H04 |
| HC | replace the whole parity condition by true | SURVIVED | KILLED | DR-UT-H01..H04 |

14/14 killed, 14/14 survived the existing set. Baseline of the new files in the world: 11/11 green.
Results: `scratch/mut/results-new.json`, `scratch/mut/results-old.json`, logs `new.log`, `old.log`. Note: V10 listed LC as a duplicate of L3 and
named 14 survivors (P8, P9, L1..L5, H1..H4, HC, LC2, LC3); exactly those were run.

## NIT fixes
- V10-04: `DR-UR-S02` (rewritten WIP-refusal test) renamed `DR-UR-S04` in `-upgrade-plan.test.ts` (no other reference to it exists in tests, infra or `.memory`;
  only the V10/lane handoff reports mention the old text). A one-line comment records "DR-UR-S04 replaces the retired DR-UR-S02".
  Added a tombstone comment in `-witness-parity.test.ts`: "DR-UP-P03..P06 were retired with the WIP fallback (2026-10-23); their ids are not reused."
- V10-05 test comment: `phase-02-slice-11-sql-parity.test.ts` line 231 "WIP 20261016044400" -> "promoted 20261016044400" (the migration
  `20261016044400_cms_preflight_pattern_provider.sql` is promoted).
- V10-05 cosmetic: `infra/database-upgrades/README.md` "API and safety boundary" paragraph rewrapped to 80 columns (no wording change).
- NOT done (outside the brief's files, they change commands/status not pure wording; listed under requests): the three `supabase/tests/*/README.md`
  items of V10-05 (placement, governed_fix3, dec193_resolution) and V10-03/V10-06/V10-07 (lane-report corrections and a test-pruning suggestion).

## Runs (real worktree, Node 22.23.1, Vitest 4.1.11, one worker)
| Command scope | Files | Tests | Result |
| --- | --- | --- | --- |
| `tests/contracts/phase-02-slice-11-delivery-receiving` (all DR files incl. the 2 new) | 19 | 569 (558 + 11) | all pass |
| `...-delivery-receiving-upgrade`, `...-delivery-receiving-witness-parity`, `...-sql-parity` | 20 | 591 | all pass |
Also: prettier --check clean on all 6 touched files; eslint --max-warnings=0 exit 0 on the 5 TS files.

## Test corrections
None to assertions. Only the id rename (DR-UR-S02 -> DR-UR-S04) and comments; assertions byte-identical.

## Requests to root
1. IMPORTANT: `tests/contracts/phase-02-slice-11-receipts.generated.jsonl` pins `fileSha256` of `phase-02-slice-11-sql-parity.test.ts`
   (57438e29... in the receipt for the `[P2-S12-AC-241]` test). The one-comment edit changed that file to 9213a06e.... Regenerate the Slice 11 receipts
   (or revert that one comment: replace "promoted 20261016044400" with "WIP 20261016044400") before the evidence guard runs. No receipt cites the other
   edited files (checked: 0 hits for upgrade-plan, witness-parity in either receipts file).
2. The three new/edited DR test files are untracked/modified in the working tree; nothing was staged or committed.
3. Remaining V10 items for root: V10-03 (wrong "before" hash for local-prefix in the lane-wip-paths report), V10-05 pgTAP README wording, V10-06 wording, V10-07 optional.
