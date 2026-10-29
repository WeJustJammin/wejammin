# Lane claude_s12_gaps_perf report

## Status

PARTIAL (2026-10-24, HEAD cd89d54c, branch claude/phase2-slice12; ALT lane name `none`, no WIP migration: perf has none).
- pgTAP side: 7 new entrypoints, all green except ONE genuine RED: **CMS-03C-02 placement of 512 rows misses the RPC < 300 ms target**
  (p95 661.3 ms, median 627.5 ms, n=24; `[P2-S12-AC-279]`). Kept failing, not weakened (a spec-versus-behaviour defect; fix belongs to a lane with a WIP range, see Open items).
- Real-stack side: 6 apispecs + 5 support modules written, prettier/eslint clean, tsc clean in my files (this worktree has no `@types/node`, so only the node-module errors remain). **UNRUN: root runs them.**
- Two clauses are not latency and stay partly open: AC-073/AC-079 lock order (static oracle done, race half BOUNDARY), AC-049 (process criterion, BOUNDARY).

## Scope

The 25 `class = hosted` rows of `gaps/inventory.json` (21 criteria). Latency clauses ("Tier N p95 < X ms", "(target < 2 s)", "RPC < 300 ms") are proven at the two levels of the Slice 11 precedent
(`phase_02_slice_11_reads_bench128.sql` + `phase-02-slice-11-read-latency.apispec.ts`): (A) a pgTAP bench of the real `platform_api` RPC at the spec's data bound, under the real
`service_role`, timing only the RPC statement, every sample required to succeed, `percentile_cont(0.95)` over >= 20 samples; (B) an apispec through Worker + PostgREST (the API p95, BE00:655).
DEC-226 honoured: a tier label proves nothing; only measurements are cited. The database share is necessary, not sufficient, for an API p95, so every row below names both levels.

## Per-row table

| Criterion | Clause idx | Outcome | Identity |
|---|---|---|---|
| AC-049 | 0 | BOUNDARY | process criterion (Contract -> RED -> GREEN -> refactor + canonical validate); needs a root-authored Slice 12 red-green record under `.memory/pipeline/progress/verification/` and the canonical validate log; a test that reads a record that does not exist yet would be a permanent RED, so none was added (Requests 1) |
| AC-056 | 6 (Tier 2) | proven (DB share) + apispec | `gaps_perf_locale.sql` #12 (p95 36.4 ms, n=24, 128 fields) and #13 (RPC < 300); `phase-02-slice-12-latency-locale.apispec.ts` `[CMS-03C-04] writing a 128-field fr-FR variant` |
| AC-061 | 6 (Tier 2) | proven (DB share); e2e BOUNDARY | `gaps_perf_related.sql` #14 (p95 39.2 ms, n=24, 64 targets) and #15; end-to-end needs 64 eligible published targets (the Slice 11 publication chain over HTTP): not authored (Requests 2) |
| AC-067 | 4 (Tier 2) | proven + apispec | `gaps_perf_governed` 050-assert:7 (submit p95 4.4 ms, n=110); apispec governed `[CMS-03C-06] submit` |
| AC-073 | 1 (lock order) | static oracle proven; race BOUNDARY | `gaps_lock_order.sql` #2-#10 (anchors in order 1 -> subject row -> graph -> review row, helpers checked, mutated-source control #6); the "two simultaneous decisions serialize" half is a race module (Requests 3) |
| AC-073 | 8 (Tier 2) | proven + apispec | `gaps_perf_governed` 050-assert:13 (decision p95 7.5 ms, n=50); apispec governed `[CMS-03C-07] approval` |
| AC-079 | 1 (locks review row) | static oracle proven; race BOUNDARY | `gaps_lock_order.sql` #11-#15 (review row FOR UPDATE once, after authority rows and the revoke-path subject lock, before insert / assignment-row lock; limit of 16 checked under it; control #15) |
| AC-079 | 9 (Tier 2) | proven + apispec | `gaps_perf_governed` 050-assert:9 and :11 (create p95 2.9 ms n=146, revoke p95 2.5 ms n=20); apispec governed `[CMS-03C-08] assignment` |
| AC-085 | 4 (Tier 2) | proven + apispec | 050-assert:15, :17, :19 (activate 4.9 / schedule 4.7 / retire 2.8 ms, n=24 each); apispec governed `[CMS-03C-09]` x3 |
| AC-091 | 3 (Tier 1) | proven + apispec | 050-assert:21, :23 (detail p95 4.6 ms at 36 assignment rows / 2 decisions; reviewer view 2.5 ms); apispec governed `[CMS-03C-10]` |
| AC-097 | 5 (Tier 1) | proven + apispec | 050-assert:25, :27, :29 (queue p95 4.7 / 5.1 / 3.9 ms, limit 50 of 111); apispec governed `[CMS-03C-11]` x2 |
| AC-103 | 5 (< 2 s) and 7 (Tier 2) | proven + apispec | `gaps_perf_patterns` 050-assert:7, :11, :15 (512-node save p95 294.4 ms, nested 198.5 ms, successor 234.1 ms; every p95 < 1,200 ms, so also < 2 s); apispec patterns `[CMS-03C-12]` x3 |
| AC-109 | 5 (Tier 1) | proven + apispec | 050-assert:17, :19 (selector p95 3.3 / 2.5 ms, limit 50 of 65); apispec patterns `[CMS-03C-13]` x2 |
| AC-115 | 4 (Tier 1) | proven + apispec | 050-assert:21 (update diff at 128 paths p95 45.7 ms); apispec compose `[CMS-03C-14]` |
| AC-121 | 5 (Tier 2) | proven + apispec | 050-assert:23, :25 (accept 430.4 ms, detach 265.6 ms, n=24, 32 instances); apispec compose `[CMS-03C-15]` x2 |
| AC-127 | 4 (Tier 2) | proven + apispec | `gaps_perf_taxonomy` 040-assert:5 (64 type keys, 64 field keys, 6 domains: p95 3.5 ms, n=24); apispec taxonomy `[CMS-03C-16]` |
| AC-133 | 5 (Tier 1) | proven + apispec | 040-assert:15, :17 (selector limit 100 of 120 terms: p95 5.9 / 2.5 ms); apispec taxonomy `[CMS-03C-17]` x2 |
| AC-162 | 4 (Tier 2) | proven + apispec | `gaps_perf_templates` :68 (context p95 1.5 ms, n=30); apispec templates `[cmsTemplateContextRead]` |
| AC-168 | 5 (Tier 2) | proven + apispec | :70 (64-slot latest p95 0.7 ms); apispec templates `[cmsTemplateLatestRead]` |
| AC-174 | 1 (Tier 2) | proven + apispec | `gaps_perf_patterns` 050-assert:27, :29 (latest of a 512-node version p95 1.4 / 0.8 ms); apispec patterns `[cmsPatternLatestRead]` |
| AC-180 | 1 (Tier 1) | proven + apispec | 040-assert:7 (50-version lineage p95 2.9 ms); apispec taxonomy `[cmsTaxonomyVersionsRead]` |
| AC-186 | 1 ("acting context") | proven (actor), pinned (party) | `gaps_perf_taxonomy/030-cursor-context.sqlinc`:24 (page-1 cursor replayed by a different actor of the same party = P0001:CONFLICT), :26 (replayed under a different acting party = P0001:NOT_FOUND, see BOUNDARY B1), :28 control (other limit = CONFLICT) |
| AC-186 | 3 (Tier 1) | proven + apispec | 040-assert:9, :11 (50-term pages p95 4.6 / 4.8 ms); apispec taxonomy `[cmsTaxonomyTermsRead]` x2 |
| AC-279 | 0 | PARTIAL: one RED | five sizes + locale + related: 64-slot template define p95 18.5 ms / read 0.7 ms (templates :72, :74: ok); 512-node save 294.4 ms (patterns 050-assert:9: ok, margin 5.6 ms); 512-row **placement 661.3 ms (050-assert:33: NOT OK)**; update diff 128 paths 45.7 ms; 50-term pages 4.6 / 4.8 ms (taxonomy 040-assert:13); 128 locale fields 36.4 ms (locale :44); 64 related targets 39.2 ms (related :70); the Tier 2 p95 < 1,200 ms half holds for all (placement 661 ms) |

## Files

Every file below is NEW (no existing file edited; no tar backup needed). SHA-256 at the time of writing.

| Path | Lines | SHA-256 |
|---|---|---|
| `supabase/tests/phase_02_slice_12_gaps_lock_order.sql` | 103 | `fefd4d284a4904bd297d4a1b0d8c964a37c7eab0cbad696900c06f778b605349` |
| `supabase/tests/phase_02_slice_12_gaps_perf_governed.sql` | 44 | `336af403c3f2c3a2284e7bcc4edf40fa15c114edb03d2c1d7d93f90fb0fb410a` |
| `supabase/tests/phase_02_slice_12_gaps_perf_locale.sql` | 47 | `9c70f95eca8278bd2b1fe40647e03d254fdf586b42a672b48049e46394cf68ac` |
| `supabase/tests/phase_02_slice_12_gaps_perf_patterns.sql` | 42 | `36d88c544ce6e8860bdbc3af435f8b3f309046dbdbbe06c0cb9f4c56091f356d` |
| `supabase/tests/phase_02_slice_12_gaps_perf_related.sql` | 73 | `72c7033e6bfb8e6af7def14641a9cba407bcb63a572ce0b124ec654852bd60fa` |
| `supabase/tests/phase_02_slice_12_gaps_perf_taxonomy.sql` | 41 | `0d8c0cadc76cf9cb80f50c367b8b434b72b627de6b2b8487c67e7c904eed74d4` |
| `supabase/tests/phase_02_slice_12_gaps_perf_templates.sql` | 78 | `954802b6925c6b18e59cdc4d87966ec3ef8ac4147208fb8dd8b74fe7bdbf2db0` |
| `supabase/tests/phase_02_slice_12_gaps_perf_common/000-timing.sqlinc` | 92 | `8171c0ca21b0f58ee21f4d048d3c9c68abbb2eefcae7e832690605856c735c8a` |
| `supabase/tests/phase_02_slice_12_gaps_perf_governed/010-world.sqlinc` | 22 | `9906ee0ef8db05142b9f8d67a8f562fbdf1de874936be1f46ba5c1e4ab6ec777` |
| `supabase/tests/phase_02_slice_12_gaps_perf_governed/020-writes.sqlinc` | 98 | `8834caf607a7cea87106bad8c750f5a4fb6b8c0803105f194a69752b2d31d8c0` |
| `supabase/tests/phase_02_slice_12_gaps_perf_governed/030-detail-bound.sqlinc` | 52 | `9fa878729aa557945fd9789b962a69980a563983a6c433d8cf600527688a2d07` |
| `supabase/tests/phase_02_slice_12_gaps_perf_governed/040-reads.sqlinc` | 39 | `e1270b28c3dfc118ee9799ab762f2bb21a96f1b5d2bfab48f7fd099e67fad7e7` |
| `supabase/tests/phase_02_slice_12_gaps_perf_governed/050-assert.sqlinc` | 33 | `fdbe6828a2f0c9ffade7ce3a71cda29a8c1cc7afced53e0738bcd7af474bd299` |
| `supabase/tests/phase_02_slice_12_gaps_perf_governed/README.md` | 11 | `3450919439d1171e3710ade0ee7b599981a91e8efd8104215d5fd925d796c17e` |
| `supabase/tests/phase_02_slice_12_gaps_perf_patterns/010-lean.sqlinc` | 90 | `5e1e34b27c74dd92ef6d20d3759397a488a08347afc82a1324c16290b0fb35c4` |
| `supabase/tests/phase_02_slice_12_gaps_perf_patterns/020-define.sqlinc` | 56 | `48a102b2f78694fe60b05f7acae7d5af6431e13a9976ee045f946dcc3f9599e0` |
| `supabase/tests/phase_02_slice_12_gaps_perf_patterns/030-place-update.sqlinc` | 84 | `b6ca32c905ed40839ab20bdceeca59726d1fb62e552a513ad9eb6c859be0810a` |
| `supabase/tests/phase_02_slice_12_gaps_perf_patterns/040-reads.sqlinc` | 50 | `45d12295e4a34abd73afb6b762ffff16f013b51f24fcaf22472d101fbceca21d` |
| `supabase/tests/phase_02_slice_12_gaps_perf_patterns/050-assert.sqlinc` | 39 | `fbe04974e6a39972fdcb826a8015df14d3e2ada41afb4431a2c791c6307757c8` |
| `supabase/tests/phase_02_slice_12_gaps_perf_patterns/README.md` | 11 | `cf92757612a05332df1574980d37957fcbc27e3dae7777e381e9ce9099e4d8ae` |
| `supabase/tests/phase_02_slice_12_gaps_perf_taxonomy/010-world.sqlinc` | 25 | `bc27dc2b1a91d668b6328cf5dcc36d86860b94c855c8a1e2fd8d284fab71d726` |
| `supabase/tests/phase_02_slice_12_gaps_perf_taxonomy/020-measure.sqlinc` | 66 | `8b60155880026d43312c952a3a2d44a0010eb3d28c2eacc6121764eea815c21e` |
| `supabase/tests/phase_02_slice_12_gaps_perf_taxonomy/030-cursor-context.sqlinc` | 28 | `61c1a437bc73a98a96d4065ef193021ee80b9095da34e74db33a08bfc13bad80` |
| `supabase/tests/phase_02_slice_12_gaps_perf_taxonomy/040-assert.sqlinc` | 19 | `88c82e075a604d0bd783aee6fb3b7f6492919f30d5070e04df929b9058414c2d` |
| `supabase/tests/phase_02_slice_12_gaps_perf_taxonomy/README.md` | 11 | `9422e006946c7047617c4770fb6873173cb0c73604e2aacc1b2f829cdd9d4643` |
| `tests/postgrest/phase-02-slice-12-latency-compose.apispec.ts` | 348 | `a0e5b984c274ba4f6a7c822011be0ce06e9739f3e5f83fc5f8691fb6932195a3` |
| `tests/postgrest/phase-02-slice-12-latency-governed.apispec.ts` | 366 | `801f8a7306ac3cca11f81569bbbfe57b8a940988aa856c708c6fb2b19580a3a4` |
| `tests/postgrest/phase-02-slice-12-latency-locale.apispec.ts` | 184 | `70b55520bfe67728aeab226c1170b4db50d7fe42d2659b89fa84cc2806784307` |
| `tests/postgrest/phase-02-slice-12-latency-patterns.apispec.ts` | 219 | `b3fc1b628f18733155ba91ba205cc62ed43c75eb2c6f69abce7b4c7d38960a85` |
| `tests/postgrest/phase-02-slice-12-latency-taxonomy.apispec.ts` | 283 | `86b92cc9f6b315bdd2109eefe06e68fb4ef15f06c5d6c21d7944b83a0e2beb6a` |
| `tests/postgrest/phase-02-slice-12-latency-templates.apispec.ts` | 128 | `b947540a517233e9565b522b46be2e68b99aee67db4207d8b755b33b70ac43f1` |
| `tests/postgrest/support/phase-02-slice-12-latency-blocks.ts` | 144 | `1873b70cf601b989325a93a981ef6a7a353bf569ee7abb471e627cd6f780c249` |
| `tests/postgrest/support/phase-02-slice-12-latency-pattern-world.ts` | 203 | `58bf8340c869f2eaec7691cff74c6ad189b655e0fb3d5970c824c51ad5bf0a3e` |
| `tests/postgrest/support/phase-02-slice-12-latency-stack.ts` | 239 | `3a3eb137f68fddf1eee877130502476a7897fe689aa709d2203b4e4d4deb31ba` |
| `tests/postgrest/support/phase-02-slice-12-latency-world.ts` | 290 | `e0783e4a5c20e2301481302f21b288b05096bf4ffce09bf0874ba574a8dbb434` |
| `supabase/tests/phase_02_slice_12_gaps_perf_governed/README.md` | 11 | `3450919439d1171e3710ade0ee7b599981a91e8efd8104215d5fd925d796c17e` |
| `supabase/tests/phase_02_slice_12_gaps_perf_patterns/README.md` | 11 | `cf92757612a05332df1574980d37957fcbc27e3dae7777e381e9ce9099e4d8ae` |
| `supabase/tests/phase_02_slice_12_gaps_perf_taxonomy/README.md` | 11 | `9422e006946c7047617c4770fb6873173cb0c73604e2aacc1b2f829cdd9d4643` |

## Runs (ALT staged runner, lane `none`, all in the background, none wrapped in timeout)

| # | Stamp | Plan | Result | TAP sha256 |
|---|---|---|---|---|
| 1 | 053916-1796726 | gaps_lock_order.sql | 15/15 ok | be9979c5e9483f03125d8fa63904ad4b573430192688564524bc2af55504c6a4 |
| 2 | 054132-1812636 | gaps_perf_governed.sql (first form) | 29/29 ok (superseded) | n/a |
| 3 | 054318-1821673 | gaps_perf_governed.sql (self-contained kit) | 30/30 ok (superseded) | 15c0f54bc2a3089924cd6ba06aa9a569b699e1f43e51ccc793e52d02b478203d |
| 4 | (patterns 1) | gaps_perf_patterns.sql | HARNESS abort: `s12pd_body` missing (placement fixtures need pattern_definition/010-oracles) | n/a |
| 5 | (patterns 2) | gaps_perf_patterns.sql | HARNESS abort: gp-w1 `VALIDATION_FAILED` (a root with 127 children breaks the 32-children rule; rebuilt as 5 x 25) | n/a |
| 6 | 070410-2146303 | patterns + templates + taxonomy | patterns 44 tests, 1 FAIL (#41 place512 RPC < 300, genuine); templates and taxonomy HARNESS (unterminated `$bench$`; slot count read from a response member that does not exist) | 7c16e71a1ff1789b9b68a1cf9fb16d12a6939df3e01a1f53d8884fc4ba72832d |
| 7 | 070737-2167391 | templates + taxonomy | templates 20/20 ok; taxonomy HARNESS (type/field keys use underscores, not hyphens) | 8b03398678a0934d947eefd92b201a04b604f769b169b652a9a489ff47d8827d |
| 8 | 070821-2170579 | locale + related | 13/13 + 15/15 ok | 304daf844d195222b054d466323876fe0fd0dc03e45d1fc4556440ee9865374c |
| 9 | 071128-2189624 | taxonomy | 35 tests, 3 FAIL: the selector is the author-facing read (called as the curator = capability_missing) | 88e74267ab89306c540e798f77e3ccac0c32026ec224adfb6d8f486a3961b605 |
| 10 | 071522-2209678 | gaps_perf_governed.sql (FINAL bytes) | 30/30 ok | d3c32dd84497a286639b313bf3d9e69c412e833aca86663cc4a6826250789edf |
| 11 | 071821-2226625 | gaps_perf_taxonomy.sql (FINAL bytes) | 35/35 ok | f2aa72c17bfcdb68612fea2a24bd84c37be6808883bc18d88c4fe3b2c9edc81d |

Final-bytes status: lock_order 15/15 (run 1), governed 30/30 (run 10), patterns 44 with 1 genuine RED (run 6), templates 20/20 (run 7), taxonomy 35/35 (run 11), locale 13/13 and related 15/15 (run 8). Total 172 tests, 171 ok, 1 RED.
Every failure before the final bytes was classified: harness (runs 4, 5-part, 6-part, 7-part, 9) or genuine (place512). Host note: the staged runner holds the shared quiet lock, so other lanes may have run concurrently; the numbers are 1-3 orders under every Tier target except the two noted, but root should repeat `gaps_perf_patterns.sql` on a quiet host before the place512 miss is treated as final.
The apispec figures are NOT measured here.

## Test corrections
none (no existing file touched).

## Spec citations
BE03c Route Registry rows 161-185 (Tier and RPC targets), "Security, performance, and recovery tests" 1813 (representative sizes), "Slice 12 lock order (DEC-157, DEC-180)" table rows CMS-03C-07 and CMS-03C-08, route field validation matrix 412-414 (type/field key bounds), 418 (terms page), BE00:655 (Tier definitions); DEC-226 / DEC-227 (root events).

## Open items / BOUNDARY

- **RED defect D1 (AC-279, CMS-03C-02):** `gaps_perf_patterns.sql` 050-assert:33 `CMS-03C-02 placement of 512 rows meets the RPC < 300 ms target (p95 of 24)`: p50 627.5 ms, p95 661.3 ms, max 674.4 ms; 32-row placement p95 35.2 ms. The 512-row response is also the 1 MiB-class body. Perf has no WIP range, so no fix was authored. Hint only (unverified): `platform_private.cms_pattern_placement_plan` and the per-root correlated rescans of `v_nodes` (the join of `existing.path` with `jsonb_array_elements(v_nodes)` and the override sub-select) in `20261016040400_cms_pattern_slot_exact.sql` lines 163-215 scale with 512 x 512. Owner choices: optimise the placement, or amend BE03c 1813 for placement (the Tier 2 p95 < 1,200 ms half holds at 661 ms).
- **Marginal:** 512-node save p95 294.4 ms against RPC < 300 ms (5.6 ms margin, flat forest); successor 234.1 ms. A loaded host will flip it.
- **B1 (AC-186 "acting context"):** the acting-party member of the cursor query hash is unreachable as a CONFLICT: the vocabulary lookup `owner_id = acting_party_id` answers the concealment NOT_FOUND first (migration 20261014120600). The test pins that order; the spec text "bound to the query and acting context" holds for the actor, and the party member is defence in depth. If the owner wants a CONFLICT for a party replay the lookup order must change.
- **B2 (AC-061 e2e):** the end-to-end p95 of CMS-03C-05 with 64 eligible targets needs 64 published entries over HTTP; not authored. DB share is proven (p95 39.2 ms).
- **B3 (AC-073 / AC-079 races):** "two simultaneous decisions on one review serialize" and "two simultaneous assignments never exceed 16 active" need a race module on the authority-race kit (`phase_02_slice_12_governed_authority/`); not authored by this lane (needs a root-run schedule).
- **B4 (AC-049):** process criterion, root-owned evidence.
- **B5 (CMS-03C-10 decisions bound):** the detail is measured with 2 decisions (protected review) and 36 assignment rows (32 summarized); the schema bound of 8 decisions is not producible by any command (the seeded policies require at most two).
- AC-061 clause 6b ("consumes cms.publication.changed.v1") is the owner decision already recorded in the inventory limitation; untouched.

## Requests to root

1. Author the Slice 12 red-green record (and canonical validate evidence) for AC-049; I will add the closeout test once the record exists.
2. Decide D1 (optimise `cms_insert_pattern_instance` for the 512-row bound, or amend the target) and assign it to a lane with a WIP range; the failing assertion is already in place as the acceptance test.
3. Run the real-stack latency apispecs, each file on its own right after `pnpm db:reset` (they commit fixtures into the shared bootstrap owner and reset again afterwards), on a quiet host; `S11_LATENCY_LOG=<file>` records the raw samples:
   `tests/postgrest/phase-02-slice-12-latency-templates.apispec.ts`, `...-governed.apispec.ts`, `...-taxonomy.apispec.ts`, `...-patterns.apispec.ts`, `...-compose.apispec.ts`, `...-locale.apispec.ts`.
   Each failure there is classified harness vs product by the first failing `expect*` message (the response text is in it). The governed, taxonomy, patterns and compose files share the bootstrap owner's organization: do not run them in one reset.
4. Commission a race module for AC-073/AC-079 serialization (B3) and the AC-061 end-to-end world (B2) if the owner wants those rows closed.
5. Optionally re-run `gaps_perf_patterns.sql` alone on a quiet host to confirm D1.
