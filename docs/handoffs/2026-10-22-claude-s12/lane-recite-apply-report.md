# Lane claude_s12_recite_apply report

Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, HEAD `fc62deef`, 2026-10-24. Brief
`docs/handoffs/2026-10-22-claude-s12/briefs/recite-apply.md`. No sub-agent used. No supabase, docker, db, race or Playwright
command run; no pgTAP run.

## Status

GREEN for the delivered work, with three things only root can close (Requests 1 to 3): the receipts are not regenerated, the
pgTAP description edits have not met a database, and the SHA-pinned reconciliation fixture now disagrees with six records.

- `recite/apply.mjs` reads the baseline ledgers (git object `fc62deef`, so a rerun starts from the same bytes), the four
  proposals and refutations, the newest full vitest JSON and the full verbose TAP, and writes the five ledger fragments. Reruns
  (three, one after the code was reformatted) reproduced the same SHA-256 of all five files.
- Ledger result: **154 verified / 123 partial / 19 unverified of 296** (baseline 9 / 127 / 160).
- Simulated guard (the real `evaluateLedger`, sole-proof limit 3): **0 problems**. Receipts for the simulation come from the real run
  (pgTAP rows re-parsed against the renamed tree) and synthetic passing receipts for apispec, Playwright and race citations only.
- Identity verification, distinct final citations: **vitest 1,877 verified / 0 missing / 0 ambiguous; pgTAP 1,546 verified / 0
  missing / 0 ambiguous; vitest `*.apispec.ts` 21 listed (checked against the source); Playwright 7 listed; race 4 listed.** 3,455
  distinct citations. No citation was dropped by verification; no owner file needed correcting. Before the renames the guard found 17
  problems (15 duplicated-description problems in 9 cited pgTAP files, 2 for a Playwright citation without a project); both classes
  are fixed. No cited vitest or pgTAP file other than the nine edited ones is newer than its run (vitest JSON 2026-10-24T06:18Z,
  TAP 02:54Z; the brief names 06:03Z and 02:04Z).

## Scope

Applied the refuted proposals to `tests/contracts/phase-02-slice-12-evidence-ledger-*.ts`, renamed duplicated pgTAP descriptions,
and applied DEC-226 to clauses the reviewers had left cited. Rule 4 status and limitation are computed from the final citations.

## Files

| Path | Lines | SHA-256 |
|---|---|---|
| tests/contracts/phase-02-slice-12-evidence-ledger-001-071.ts | 9,309 | cba2824315301d300a2a265e4ae3f7c0ee3fe1dbf19d27d01d93aeed9ef7c206 |
| tests/contracts/phase-02-slice-12-evidence-ledger-072-142.ts | 11,547 | 787b436928f14594f9e565f2bd89e455517b96da4e016e97027a0283e3c2394e |
| tests/contracts/phase-02-slice-12-evidence-ledger-143-213.ts | 7,956 | 3d675c78a032a03210961ce798b5b625f2efebffdcbd6159af211fa2abc252ba |
| tests/contracts/phase-02-slice-12-evidence-ledger-214-285.ts | 8,460 | c9626dea57166ed40b58046f0fcbcc11b36e22a71dd69eab0bb32314e3fde17c |
| tests/contracts/phase-02-slice-12-evidence-ledger-286-296.ts | 561 | ca6a078fb4ee73915d55a259fadbc07ffb751356f0620284aaaac89071a31c9b |
| recite/apply.mjs | 689 | fb6a6bc27817082486a7a686d09a2ee2b0ae587c767b3f8421cb6b4ab302a91d |
| recite/apply-plan.mjs | 618 | 65960fc1e17ed052ac75cca3e5200fc03293c0644efae1f5a99a1976e2e8d8cb |
| recite/apply-identity.mjs | 405 | fea26cf01dceae62dfe2c007558243c356dc991b15317e6724d891baa897cd32 |
| recite/apply-data.mjs | 783 | 40175a90849db1819cd84fa2a39a37c60f50ab59d15e4c757c2fc9ad09f23ca5 |
| recite/apply-limit.mjs | 69 | abdeb15a4708250706697f7dcba849ed9102c19219c5b929c5b950d84e236186 |
| recite/apply-lib.mjs | 92 | c97ddb7ca4287bd8e16ac1c084e0e117ef8543486259aa848c418f13f75136d9 |
| recite/apply-simulate.mjs | 109 | b7f875c22365c74fb07edd366a1fa56d12c616da304bc5d5bedb4df61e5829c0 |

pgTAP files edited (description text only; the tar backups are in the lane scratch directory
`/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_recite_apply/backup/`,
`orig-pgtap-renames-20261024T073512Z.tar` SHA-256 `26ca2fb9...b025` holds the 8 files before the first edit,
`orig-pgtap-renames-20261024T074456Z.tar` SHA-256 `9fc33629...8a70` holds `dec193_consumers/010-comparison.sqlinc` and the
intermediate `dec193_pattern_currentness/000-fixture.sqlinc`). All files are tracked, so git also restores them.

| File | SHA-256 now |
|---|---|
| phase_02_slice_12_governed_activation/095-retire.sqlinc | 3645256a0964deee246fbd7c83c30748b5ee02a57b5f1c9e487742f58d87afdd |
| phase_02_slice_12_linked_scan/030-scan.sqlinc | 4eb8561c0180f9ac0a2675f5775b5d2b92ef88561a92812fa0d15b535bb8a3d7 |
| phase_02_slice_12_related_public_targets/001-projection.sqlinc | d3da3521563a52abf3dd56b44a09106d374055f1c0a7fcd64a45a751de659354 |
| phase_02_slice_12_taxonomy_terms/094-continuation-authority.sqlinc | 2687fbe207ffa57ed6750bd49ba6f383308b218d6c43d16b36d2344729f1f476 |
| phase_02_slice_12_taxonomy_terms/097-bulk-continuation.sqlinc | 86a37396c2d31f62a4515b5e19a8d3b7ec1f83e82e5823da3eb446009cff10a0 |
| phase_02_slice_12_block_rules/040-legacy-setup.sqlinc | c8acb28353313bcde339af3d3e8ee27aed479e5b9bd707a9acefa68f6447753c |
| phase_02_slice_12_block_rules/070-provider.sqlinc | 815b40c3933e9162c49000b14ec0e6a20bafb090ee93191385b80e7cd3f89a98 |
| phase_02_slice_12_dec193_pattern_currentness/000-fixture.sqlinc | b549f9b6eb608eab5c04359a8fc5d0a91e8d2ed32b67ab505fed50d9fb23fa60 |
| phase_02_slice_12_dec193_consumers/010-comparison.sqlinc | 3f45c85aec295042d1aefb0d89731420fca454e5d9db4b97174a752c2770c901 |

## Runs

- `node docs/handoffs/2026-10-22-claude-s12/recite/apply.mjs [--dry] --report <json> --backup-dir <dir>`: about 50 s (35 s of it
  parsing the TAP). `--dry` writes nothing and simulates the renames on a copy of the pristine pgTAP tree.
- `pnpm exec tsc --build --pretty false tsconfig.json`: clean (run after the first ledger write; the ledger bytes did not change
  afterwards). `prettier --check` on the five fragments and the scripts: clean. `eslint` on the scripts and fragments: clean.
- `pnpm exec vitest run` of `phase-02-slice-12-ledger-inventory`, `-evidence-guard`, `-unit-citation-reconciliation`,
  `phase-02-evidence-ledger-lib`, `phase-02-evidence-guard-ledger-rules`: 76 passed, 7 failed. The 7 failures, by class:
  - 1: the evidence guard test, **2,701 "no receipt" problems and no other class** (receipts are not regenerated; expected).
  - 6: the reconciliation fixture (below, Request 2).

### What the script did with the lanes' proposals (as applied)

| lane | proposed adds placed | KEEP | DROP omitted | FIX applied | existing judged | missed tests added / skipped | withheld |
|---|---|---|---|---|---|---|---|
| a | 698 | 661 | 24 | 13 | 0 | 61 / 0 | 14 |
| b | 786 | 766 | 6 | 14 | 0 | 19 / 2 | 14 |
| c | 1,126 | 1,047 | 17 | 62 | 218 | 45 / 1 | 102 |
| d | 678 | 655 | 13 | 10 | 52 | 492 / 0 | 0 |

Placed adds are lower than the reviewers' totals where a DEC-226 rule or a REJECTed split emptied a clause (their citations are
in "withheld"; `--report` lists all 130 with the reason). FIX applied includes the 13 lane b duplicate-description FIX, which keep
their citation text because the renames make the identity unique (rule 6). Verdicts are applied per citation; missed tests are
added after identity verification.

## Decisions and deviations (each deterministic, in `apply-data.mjs`)

1. **REJECTed splits.** Lane b AC-107 (corrected part 0 now starts at the clause start). Lane d AC-224, 261, 265, 278 and the
   new splits AC-240, 241, 286 are applied from the refutation's quoted re-split. Lane b new splits AC-084 and AC-108 (partial,
   as the review recommends). Lane c: the 13 REJECTs have no corrected split, so the clause stays whole and uncited and its
   citations (including 3 existing ledger citations on AC-128) are withheld, as the refutation states. Eight lane c OK splits name
   their parts in prose only; their part mapping is in `C_PART_CITATIONS` / `C_EXISTING_PARTS` / `C_MISSED`.
2. **FIX.** "Add the fix, never the original". Prose fixes (AC-029, 065, 066, 067, 068, 073, 113) are resolved to exact
   identities in `FIX_OVERRIDES`; AC-029 c2 and AC-068 c12 re-home the replacement to the clause the refutation names.
3. **Missed tests not added:** AC-086 c0 and c1 (HTTP halves of `activation_conflict` and `canonical_source_unavailable`: DEC-226(4),
   the database test never raises those tokens on that operation) and AC-189 c0 (the table CHECK proves one of four reserved
   pattern keys; the review says it does not make the part verified).
4. **AC-039** `heldBackAdd` and its 5 held-back existing citations are not applied (clause 2 stays uncited, status partial).
5. **DEC-226 on clauses the reviewers had left cited (4 criteria drop from verified to partial relative to the refutations):**
   AC-058, AC-093, AC-111 (clause 0, "consumed by ... at /app/...", cited by loader, composed React and source-text tests;
   uncited per DEC-226(3)), AC-121 (clause "and Tier 2", cited by a registry test; uncited per DEC-226(1)). AC-105 clause 0 (same
   rule, status stays partial), AC-085 c3 (split so only "Tier 2" is uncited), AC-069 c0 (split: the cited real-route spec drives
   the vocabulary page only; "template, pattern" is uncited).
6. **Statuses.** Computed status equals the refutation's status in 292 of 296 criteria; the 4 exceptions are the DEC-226 items
   above (AC-058, 093, 111, 121). Against the lanes' proposals: 20 verified to partial, 21 unverified to partial, 1 partial to
   verified (AC-207).
7. **Limitations.** Composed per uncited final clause from the lane's gap text for that clause, the dropped citations' reasons,
   or an explicit reason in `CLAUSE_REASONS` (13 clauses with no lane gap), identical reasons merged; `CAVEATS` adds the
   refutation's confirmed real limits of cited clauses and corrects the lane statements it found false (AC-044 race claim, AC-048
   alert claim, AC-065 canonical_source_unavailable and index, AC-066 per-kind map, AC-067 atomicity and digest, AC-069 focus
   heading and Playwright claims (dropped), AC-072 submitter case, AC-073 ordering, AC-075 Playwright claim (dropped), AC-079 counted
   approval exception, AC-105 page glue, AC-207 gap (cleared: now verified)).

## pgTAP description renames (rule 6)

Nine files, descriptions only, tar-backed up first. Literal renames (the first occurrence keeps its text):

| file | old | new | occurrence |
|---|---|---|---|
| governed_activation/095-retire.sqlinc | the completed idempotency record stores status 200 [P2-S12-AC-086] | ... stores status 200 for the retire [P2-S12-AC-086] | twin of 030-activate:48 |
| governed_activation/095-retire.sqlinc | an exact same-key replay returns the original response and writes no second event, audit record or state change [P2-S12-AC-086] | an exact same-key replay of the retire returns the original response ... [P2-S12-AC-086] | twin of 030-activate:55 |
| linked_scan/030-scan.sqlinc | and changes nothing | and changes nothing (scan r5) | 2nd |
| linked_scan/030-scan.sqlinc | and changes no row | and changes no row (scan r4c) / (scan r4e) | 2nd, 3rd |
| related_public_targets/001-projection.sqlinc | the projection satisfies the list contract [P2-S12-AC-231] | ... for the curated shared-terms source srcp [P2-S12-AC-231] | 2nd |
| taxonomy_terms/094-continuation-authority.sqlinc | SETUP the original curator authority is restored | ... restored for the continuation run | twin of 050:69 |
| taxonomy_terms/094-continuation-authority.sqlinc | fixture: the retired term is merged while it holds no assignment | ... (continuation authority) | twin of 096:9 |
| taxonomy_terms/097-bulk-continuation.sqlinc | and never by a Seq Scan of the assignment store [P2-S12-AC-226] | and the whole-party lookup is never a Seq Scan of the assignment store [P2-S12-AC-226] | 2nd |

Computed descriptions (a helper takes an optional label that ends the description; the first call keeps its text):

| helper | edit | descriptions affected |
|---|---|---|
| block_rules/040-legacy-setup.sqlinc `brt_restore(p_name, p_step default '')` + call sites in 040 and 070 | `|| case when p_step = '' then '' else ' (' || p_step || ')' end` | `BR-L: save ... restored ...` x2 (after brm-v2, after the provider fixtures), `BR-L: plan ...` x6 (case 3a, 3b, 5a, 5b, 6a, 6b) |
| dec193_pattern_currentness/000-fixture.sqlinc `s12pc_acl` | `... private call of ' ||p_identity|| ' refused ...`; `... unchanged (` p_role p_identity `)`; `... restored (` p_role p_identity `)` | 3 x 2 `PC-ACL: actual <role> private call refused ...`, 12 `refusal leaves all captured rows unchanged` / `caller role/context restored` |
| dec193_consumers/010-comparison.sqlinc `s12cs_seed_current(p_source, p_target, p_label default '')` | four `CS-D5-FIXTURE: ...` descriptions end `(<pair>-d5-left|right)` | 4 x 12 |

After the renames no duplicated description remains in any entrypoint that runs a cited pgTAP file (`remainingDuplicateDescriptions: 0`;
the guard only sees cited files, the other 6 groups were in `consumers/010-comparison` and `pattern_currentness/000-fixture`).
The edit routine is idempotent and a rerun reverses the edits in a copy to see the identities the TAP was produced from.

## Test corrections

None to tests or oracles. The pgTAP edits above change description text and add optional label parameters only; no assertion,
fixture or SQL logic changed. They need one `pnpm db:test:tap` to prove they parse (I could not run it).

## Spec citations

BE03c 173, 1644 (per-kind owner capability, AC-084), 1411 to 1501 (CMS-03C-09 steps and lock order, AC-083, 085), 1734
(`cms.publication.changed.v1`, AC-061 c9); FE03 879 (lifecycle text and icon, quoted copy, AC-069), 926 (scoped draft,
AC-045, 048), 1109 (CMS-11 row, AC-042); BE00 655 (Tier 1 and Tier 2 p95 targets, DEC-226(1)). Source of each: the refutation
reports of reviews a to d.

## Open items / BOUNDARY

- Owner decisions the reviews raised (no citation can close them): AC-061 c9 (consume the event or amend to recompute-on-read);
  AC-069 (icon and quoted copy, FE03:879); AC-072/074 (`separation_of_duties` has no producible path, the creator case needs a
  privileged fixture); AC-079 c3 (criterion text needs the counted-approval exception); AC-052 (counter
  `cms_locale_stale_total` versus the asserted gauge); AC-132/134 (an absent vocabulary is an empty 200 page, not 404); AC-138/141
  (activation preflight does not call the canonical matcher); AC-205 (`version` + 1 versus DEC-188 `lifecycle_version`);
  AC-271 (the 250 ms skeleton is neither built nor tested); AC-274 (timeout 503 versus 504, 500 versus 502 in the clause);
  AC-275 (five versus eight supporting reads); AC-277; AC-086 (a preflight failure 422), AC-105 (inline with the node path),
  AC-107/108 (other-owner id); AC-084/108 stay partial until a wrong-kind / other-owner fixture exists.
- DEC-226 was applied where the rule's phrase matches a clause (consumed ... at /app/..., Tier N). Not audited exhaustively:
  (3) AC-093 and AC-265 to 270 are page-behaviour clauses cited by loader, composed React and some `.astro` source-text tests
  (`definition-review-routes`, `composition-route`, `locale-route`, `pattern-pages`, `taxonomy-pages`, `template-designer-route`
  "response invariants" / "redirects an expired session" cases) that reviews b and d accepted; (4) PAT-031 (a stubbed-token
  Worker mapping test cited for a route clause the database never raises) beyond the cases the reviews named.
- The ledger fragments total 37,833 lines (largest 11,547), far over the extensibility limits for test files; splitting them is a
  root decision.

## Requests to root

1. **Regenerate receipts** (`node scripts/evidence/run-slice-evidence.mjs --slice 12`, fresh DB reset) and rerun the guard. The guard
   test now reports 2,701 "no receipt" problems and nothing else; the 9 edited pgTAP files change the closure hash of every entrypoint that includes them. The 4 race
   citations need `WEJAMMIN_CANONICAL_RACE=1` and have never been planned by the evidence runner (review d finding 3):
   `dec193_writer.race.mjs` (AC-044), `dec199_publication.race.mjs` (AC-249), `entry_default_template_lock/020-race.mjs` x2 (AC-294).
2. **Update the unit-citation reconciliation fixture** (SHA-pinned, outside my claim); 6 of its 26 records now fail by design:
   - retired `pattern.test.ts` (AC-014) and `taxonomy.test.ts` (AC-020): the "dependency" clause is now cited by 3 reviewed tests
     (AC-014) and both criteria are `verified`, while the fixture expects `partial` and the retained list;
   - 3 `template-context-routes` records bound to AC-161 clause 0, whose text the review split into three parts;
   - the `template-detail-routes` record "fails closed when 'unauthenticated'" (AC-169) is now also the citation of AC-265 part
     "the server verifies the Supabase session, expiry and acting context".
3. **Run `pnpm db:test:tap` once** (canonical runner) to prove the nine pgTAP files still parse and that the renamed
   descriptions exist; then compare with `apply.mjs --dry` (it expects 0 duplicates).
4. **Check with the real runners the identities I could only read from source (32):** 21 `tests/postgrest/*.apispec.ts`
   citations (AC-001, 004, 005, 006, 022, 025, 033, 054 to 057, 159, 161, 163 to 170, 189, 192, 280, 281), 7 Playwright citations
   (`governed-review-real-route` [T2] project `real-route-chrome` for AC-069, which I assigned from `playwright.s09-real.config.ts`;
   `template-edit` and `template-real-route` / `template-uncertain-real-route` specs for AC-041, 042, 164, 170, 265) and the 4
   races above.
5. **Decide the page-level evidence for the four DEC-226 demotions** (AC-058, 093, 111, plus AC-105 clause 0): the real-route specs
   `locale-real-route` (AC-058) and `governed-review-real-route` T1/T6 (AC-093) may qualify; I did not add citations the reviews
   did not name.
6. **Owner decisions** listed under Open items; and the criterion text for AC-079 clause 3.
7. **Doc:** `recite/README.md` should list the seven `apply*.mjs` files and the command above (it is root-owned; I left it).
8. Report-only: the lane reports should be corrected where the reviews found a false statement (lane a AC-065, 069, 075
   limitations; lane b AC-122 sentence and Request 1 line numbers), as the reviews asked.
