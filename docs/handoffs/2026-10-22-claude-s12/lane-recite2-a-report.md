# Lane claude_s12_recite2_a report (AC-001..AC-150, gap-wave re-citation PROPOSALS)

## Status
GREEN for the work asked: proposals written for all 150 criteria; no ledger, receipt, spec, test or product file edited; nothing run
(no supabase, docker, db, race, Vitest or Playwright). Worktree HEAD is `cd89d54c` (the lane rules name `b16edb54`; the tree is the
live one with the gap-wave files untracked/modified). Proposals: `docs/handoffs/2026-10-22-claude-s12/recite2/a-proposals.json`
(schema of `recite/<x>-proposals.json`; a clause cited by a split carries `split: [{ text, keepExisting, add, gap }]`, as lane b used).
Scratch (builders, checkers): `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_recite2_a/`.

## Method
Rows = the 98 clause rows of `gaps/inventory-20261029.json` with AC-001..AC-150 (67 criteria); the other 83 criteria are verified in the
current ledger and appear with `add: []`. New tests were located by the `[P2-S12-AC-NNN]` tags in every untracked/modified test file
plus the lane reports; each cited test body was read at its asserting line. Identities: pgTAP descriptions copied from source and
checked by a script against the file text (collapsed whitespace); computed `s12pl_refused` descriptions marked `computed` with the
derivation checked in both the entrypoint call and the helper in `pattern_placement/010-oracles.sqlinc`; Vitest titles
(describe chain + title, `%s` substituted) reconstructed from the file's string literals by a script (61/61 matched). All are
`identitySource: "static"` (the gap-wave tests post-date every Vitest JSON). Every add also carries `descriptionLine`.

## Counts
- Criteria in range 150: proposed **verified 114**, **partial 35**, **unverified 1** (AC-049). Of the 67 criteria that carry an inventory
  row: 31 become verified, 35 stay partial, 1 stays unverified.
- Inventory clause rows 98: 56 newly cited whole, 4 split (partly cited: AC-023 c1, AC-050 c0, AC-143 c3, AC-150 c0), 38 left as named gaps.
  192 citations proposed (many tests serve two clauses of one criterion; no test is the only citation of a clause in more than 3 criteria:
  the maximum is 3, the AC-144 grant-end test).
- Remaining gaps by class (42 row-clauses incl. the 4 splits): race 7 (AC-013 c6, 019 c7, 044 c3 deletion, 047 c1, 085 c1 lock order of
  CMS-03C-09, 086 c1, 145 c1 SKIP LOCKED); worker 10 (039 c2, 095 c2, 126 c3, 128 c1+c2, 134 c4+c5, and the three meta clauses 040 c3,
  043 c4, 046 c5 which no single test proves); playwright/page-level 9 (042 c1+c5, 058 c0, 069 c0, 075 c8, 093 c0, 111 c0, 129 c0,
  150 c0 Shard 04 part); web 1 (042 c12); pgtap/composed 5 (001 c3 spec silent, 010 c2, 016 c1 composed apispecs never written,
  023 c1 "/allowlisted", 143 c3 "with an equal hash"); impl 5 (086 c4, 105 c0, 143 c4, 146 c5, 148 c3); hosted 2 (049 c0 process,
  061 c6 end-to-end p95); other 3 (050 c0 "in the same change", 108 c3, 137 c3).
- Stale EXISTING citations in range: none found (no cited test lacks its title in source). Checks against the 2026-10-24
  `pass2/vitest-all.json`: 1,317 of 1,471 existing Vitest citations are `passed`; 138 are present with status `stale` (files edited
  since; 10 of them are template-literal titles of `phase-02-slice-12-pattern-openapi.test.ts` that a static scan cannot match, the
  rest match their source); 16 are absent from that unit run because they run elsewhere (15 real-stack apispec cites in
  `phase-02-slice-12-template-version.apispec.ts` / `phase-02-slice-12-locale-variant.apispec.ts`, and the root-written
  `cms-composition-production-locale-unsupported.test.ts`, which post-dates it). 427 existing pgTAP descriptions are computed/dynamic and
  cannot be checked statically; every other pgTAP, race and Playwright existing citation resolves in source.

## Clauses newly cited, by source
db1 (`gaps_db1_*`): AC-023, 026, 033, 043, 055, 056 c9, 065, 066, 072, 083, 084, 088, 101, 107, 138, 141, 143, 144, 146 c3, 147, 148, 150.
perf (`gaps_perf_*`, `gaps_lock_order`, latency apispecs): AC-056 c6, 067, 073, 079, 085 c4, 091, 097, 103, 109, 115, 121, 127, 133.
web-impl / web tests: AC-045, 048, 069 c3/c6/c11, 105 c2/c6, 110, 117. closeout test: AC-050. Nothing in range came from
`lane-nestable-read`, `lane-taxonomy-integrity`, `lane-bundle-headroom`, `lane-placement-perf` except through AC-105 c2/c6.

## The five weakest proposed citations (start the refutation here)
1. **All "Tier N p95" clauses** (AC-056 c6, 067 c4, 073 c8, 079 c9, 085 c4, 091 c3, 097 c5, 103 c5/c7, 109 c5, 115 c4, 121 c5, 127 c4,
   133 c5): each cites a pgTAP RPC bench (DB share of the p95, `service_role`, n >= 24, host-dependent; AC-103 c5 "(target < 2 s)" is
   shown only by p95 < 1,200 ms) plus a real-stack latency apispec that the perf lane never ran (`tests/postgrest/phase-02-slice-12-latency-*.apispec.ts`).
   The `evidence` of each apispec says so. If root does not accept DB-share + unrun apispec, the pgTAP bench is the only part that has run.
   AC-061 c6 (no apispec, perf BOUNDARY B2) is left a gap for that reason; the bench is named in the gap text.
2. **AC-073 c1 and AC-079 c1** (`gaps_lock_order.sql`): a static source-order oracle with a mutated-source control. It proves the stored
   function takes the locks in the BE03c order; it does not show two simultaneous decisions/assignments serialise (the perf lane's
   recorded race BOUNDARY, request B3). Cited because the clause text names the order, not serialisation.
3. **AC-072 c5** ("the subject creator) is 403"): the creator is refused at assignment (`reviewer_not_eligible`) and at decision with
   `capability_missing`; the `separation_of_duties` branch of the decision RPC is unreachable by any lawful state (db1 BOUNDARY).
4. **AC-083 c2** (`gaps_db1_recheck.sql`): the CURRENT-side readers `cms_governed_subject_resolve` / `cms_governed_policy_basis` are
   renamed aside and wrapped to alter one member (restored byte for byte, asserted); the recheck function and commands are unmodified.
   A labelled seam, not a natural state.
5. **AC-056 c9** ("answers a changed actor ... 409"): another actor replaying the creator's key gets 409 `VERSION_MISMATCH` and reserves
   nothing, because reservations are keyed (actor, operation, key hash) so `IDEMPOTENCY_MISMATCH` cannot occur for a changed actor.
   Also weak: AC-141 c0 (the chain `overlap_check <- term_apply_write <- cms_act_taxonomy_term` is asserted, not the per-action
   create/rename/alias split) and AC-105 c6's three pgTAP node-pointer cites (need the unpromoted `node-pointers` WIP migrations).

## Judgement calls root should know
- **Splits** (4): AC-023 c1 ("each active" / "/allowlisted" / "ContentTypeVersion family"), AC-050 c0 (tracking.. graph / "in the same
  change;" / "leave no unresolved implementation boundary" / "or undocumented drift."), AC-143 c3 and AC-150 c0. Tiling holds
  modulo whitespace; parts are not guaranteed to be substrings with the clause's exact spacing: the apply script should anchor them.
- **Gaps kept where a lane recorded a BOUNDARY**, with its text as the limitation: AC-001 c3, 023 "/allowlisted", 061 c6, 108 c3, 137 c3,
  143 c3/c4, 148 c3, 150 c0 Shard 04. Not cited as weak: `gaps_lock_sources.sql` CMS-03C-09 (no review-row or position-4 anchor, AC-085 c1);
  db1 `schedule_fire` canonical_source_unavailable (the executor CMS-03C-19, not the CMS-03C-09 activation, AC-086 c4);
  `taxonomy_integrity_concurrency.sql` (a replica of the merge steps against assignments, not two term actions, AC-019 c7/AC-047 c1);
  `latency-compose.apispec.ts` place32 (asserts 201 and item count only, AC-010 c2); `taxonomy-definition.coverage.test.ts` (feeds the
  catalog message, not the SQL token, AC-126/128).
- **Existing tests cited that the db1 report named**: AC-147 c7 uses `governed_schedule/050-blocked.sqlinc` (dependency_changed) and
  `governed_schedule_ladder/010-ladder.sqlinc` (retries_exhausted; a 12-minute suite) next to the new `schedule_fire` cites; AC-147 c4
  uses `governed_schedule/030-execute.sqlinc` for the revocation recheck.
- Duplicate Vitest titles: `pattern-instance-routes.malformed-ids.test.ts` `it.each` yields the same title twice for `revisionId`
  (not-a-uuid, 42) and `patternId`; the identity cited is the shared title.
- AC-045 c12 "scoped draft before commit": cited as retain-in-memory + inline leave confirmation + beforeunload only while dirty + cleared
  on success/discard + never in URL/storage (FE03 927 wording as the web-impl lane implemented it); no persistent scoped store exists.

## Open items / BOUNDARY
Unchanged from the lane reports: AC-001 c3 spec silent; AC-055/061/069 owner decisions already ruled by root (DEC-230/231, AC-069 copy);
AC-105 c0 page-level; composed apispecs for AC-010 c2 and AC-016 c1; races for AC-013 c6, 019 c7, 047 c1, 085 c1, 086 c1, 145 c1;
page-level specs for AC-058, 093, 111, 129; AC-042 (template designer success path) and AC-075 (protected decision path) untouched by
the gap wave.

## Requests to root
1. Decide whether DB-share bench + unrun apispec counts for the 16 "Tier" clauses (weakest #1); run the six latency apispecs before applying.
2. The pgTAP cites in `gaps_node_pointers.sql` (AC-105 c6) need the `node-pointers` WIP migrations promoted first.
3. The apply step must support the 4 `split` clauses (lane b precedent) and the `computed` pgTAP entries (AC-026, AC-043).
4. Verify every identity against the fresh TAP and Vitest JSON; the 61 Vitest identities are static.
