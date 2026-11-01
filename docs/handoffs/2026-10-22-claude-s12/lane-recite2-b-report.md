# Lane claude_s12_recite2_b report

## Status
PARTIAL. All 74 criteria / 99 clause rows of `gaps/inventory-20261029.json` for AC-151..AC-296 have a proposal in
`docs/handoffs/2026-10-22-claude-s12/recite2/b-proposals.json` (schema of `recite/<x>-proposals.json`: `criterion, clauses[{index, text, add[], staleExisting, gap, needsSplit, proposedSplit[]}], proposedStatus, proposedLimitation`, plus optional `caveat` and `carryWave1`). HEAD of the worktree is `cd89d54cc84403e32699666c8d3710f45bbffce0` (the lane rules name another SHA; nothing was run, so it does not matter). Read-only: no ledger, test, spec, migration or tracker file was touched. No supabase, docker, db, race, Vitest or Playwright command was run.

## Scope
`inventory-20261029.json` rows with criterion AC-151..AC-296: 74 criteria (57 partial, 17 unverified), 99 clause rows. Sources read: `lane-gaps-db1/db2/perf`, `lane-taxonomy-integrity`, `lane-web-impl`, `lane-placement-perf`, `lane-bundle-headroom` reports (per-row tables), the current ledger (dumped to JSON from `tests/contracts/phase-02-slice-12-evidence-ledger.ts`), the wave-1 proposals and refutations (`recite/c-*.json`, `recite/d-*.json`) and, for every cited test, the asserting lines in the source file. Every lane claim was re-checked against the source; several lane "PROVEN" rows were narrowed or dropped (see below).

## Counts
- Criteria: 74 proposed. Status after, against the inventory: partial->verified 33, unverified->verified 9, unverified->partial 6, partial->partial 24, unverified->unverified 2 (AC-210, AC-273). So 42 criteria newly verified, 30 partial, 2 unverified.
- Clause rows (99): 60 fully closed with citations, 10 partly closed (a verbatim tile split with one tile cited, one a gap: AC-194, 198, 200, 208, 248, 261, 276, 277, 279, 287), 29 still gaps. Per class, rows closed / partly / gap: pgtap 37 / 6 / 6, other 8 / 2 / 0, impl 8 / 0 / 7, hosted 6 / 1 / 0, worker 1 / 0 / 1, race 0 / 1 / 4, playwright 0 / 0 / 8, web 0 / 0 / 3.
- Citations: 421 entries (407 distinct tests): 401 pgTAP, 20 vitest (11 of them citations of the unrun real-stack latency apispecs, repeated across criteria). 14 computed-description pgTAP citations name the entrypoint `.sql` (DEC-226 rule 5); sqlinc citations carry `entrypoints` found by grepping the `\ir` includes. The builder located every cited description in its source file (strict full-title match for all non-computed pgTAP titles; the 4 vitest `it.each`/describe-chain titles must be checked by root against the Vitest JSON).

## Remaining gaps by class (29 rows + 10 partly)
- Shard 04 delivery projection / Slice 11 recheck consumers unbuilt (AC-152 x3, AC-155 x2, AC-158 x2): `impl`/`pgtap`, BOUNDARY.
- Page-level (DEC-226 rule 3) and Playwright: AC-164 x3, AC-176, AC-182, AC-265 x3, AC-271, AC-272, AC-273 (no gap-wave lane wrote page or journey specs).
- Races: AC-205 (activation_conflict), AC-218 (placement revision/slot lock), AC-225 (merge FOR UPDATE id order), AC-294 (waits recheck), AC-277 (seven of eight scenarios).
- Spec / unreachable (BOUNDARY): AC-181 #3 (422 on a versions read), AC-211 #1 (publish-time depth/node/cycle has no provider reason), AC-238 #3 (nested compatibility branch), AC-169 #10 (DEC-211 server retry, no caller), AC-198 (16 bound, policyVersion order), AC-200 (cycle after creation), AC-208 (resolver at activation), AC-248 (insert-if-absent), AC-261 (job-handler registrations), AC-279 (API p95 for 64 related targets), AC-287 (nonempty bindings), AC-295 #0 (default change).
- Missing tests: AC-210 and AC-223 #0 (taxonomy activate/schedule over an unbuilt provider, one SQL test), AC-256 (canonical-domain registry persistence), AC-194 second half, AC-276 tiles 1 and 2, AC-164 #4 (auth-session resource not extended).

## Five weakest proposed citations
1. AC-276 tile 3 (deadlock/lock failure -> CONFLICT): the 13 writer-wrapper cites replace the private body inside a sub-transaction by a function raising 40P01/55P03, so they prove the wrapper's conversion, not that the real body's lock statements raise it; "same Idempotency-Key reusable" is shown only for the real advisory wait of CMS-03C-01 (`template_authority` #36/#37).
2. AC-289 #1: gate-level proof (`gaps_entry_default.sql`); the public `cms_create_entry` cannot reach that branch, so no byte comparison of the public response exists (carried as `caveat`).
3. AC-295 #2: a `prosrc` scan showing the carry writers never name `default_template_version_id`; structural, not a behavioural carry test.
4. AC-186 #1 ("acting context"): the actor replay is a proven CONFLICT but the acting-party replay is the concealment NOT_FOUND by design (lane BOUNDARY B1); cited with a `caveat`, root may keep it partial. AC-244 #0 carries the same kind of caveat ("unknown" term is an FK-unreachable shape).
5. AC-152 #0 ("consumed by the 03b locale provider"): the evidence is gate-versus-resolver agreement on one shared core and a callers inventory, not the provider calling CMS-03C-20 itself. Honourable mention: every `Tier 2 p95` cite on an apispec (AC-162, 168, 174, 180, 186, 279) comes from files the author did not run; the pgTAP database-share benches are host-load sensitive (place512 flipped once in the placement-perf lane).

## What was narrowed or dropped relative to the lane reports
- AC-176/182/265: no page or Playwright test exists; the `gaps-db1` "PROVEN" rows do not cover them.
- AC-276: not citable as a whole; split into three verbatim tiles (order, capability under locks, conversion) and only the conversion is cited.
- AC-225: the V12 concurrency file replays the merge worker's lock statement instead of calling `cms_act_taxonomy_term`, and `gaps_lock_sources.sql` does not assert `order by term.id`; left as a gap.
- AC-271: the 250 ms skeleton is tested for five islands only; no citation proposed (it would mark the whole seven-state clause proven).
- AC-194, 198, 200, 208, 248, 261, 277, 279, 287: partly closed through verbatim tiles so the guard sees an uncited remainder.
- Citation text: the builder strips any hand-typed line numbers and writes `path:line` from the located description line (the description line, i.e. the end of the assertion).

## Files
| Path | Role |
|---|---|
| `docs/handoffs/2026-10-22-claude-s12/recite2/b-proposals.json` | the proposals (see SHA-256 in the final message) |
| `docs/handoffs/2026-10-22-claude-s12/lane-recite2-b-report.md` | this report |
Scratch (not in the repo): `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/recite2b/` (props.mjs spec source, build.mjs, ledger.json dump, tags.txt, strict.mjs). `node build.mjs` there regenerates the JSON.

## Runs
None (static reading only).

## Test corrections
None.

## Spec citations
BE03c: Registry invariants, Governed review machinery (DEC-137), Governed policy basis, Canonical records / Persistence, Slice 12 lock order (rule 4), Receiving obligations (DEC-141), Preflight providers registered by Slice 12 (1574), E13, E14, route registry rows 161-185; BE03b CMS-03B-10 (DEC-202); FE03 877/885/912/927/1042-1048; DEC-166, DEC-192, DEC-199, DEC-210, DEC-226, DEC-229, DEC-233.

## Open items / BOUNDARY
Listed under "Remaining gaps by class". The BOUNDARY text recorded by a lane is kept as `proposedLimitation` (or on the uncited tile) wherever the clause can be split verbatim; where it cannot (AC-186, 244, 289, 292) the clause is cited and the text is in `caveat`.

## Requests to root
1. Apply order: new citations for AC-197 must be applied together with the wave-1 KEEP/FIX citations of `recite/c-proposals.json` for that criterion (`carryWave1` flag; the criterion stayed unverified, so none is in the ledger yet). For AC-194 the wave-1 sub-clause citations cannot be recorded on the second tile; re-split first if wanted.
2. Run the six real-stack latency apispecs (`tests/postgrest/phase-02-slice-12-latency-{templates,governed,taxonomy,patterns,compose,locale}.apispec.ts`); their authors did not. Citations to them are in AC-162, 168, 174, 180, 186, 279.
3. Verify the 4 vitest `it.each`/describe-chain identities (AC-241, 244, 246) against the Vitest JSON; the exact names are in the proposals.
4. Decide whether to keep AC-186, 244, 289, 292 as verified-with-caveat or reopen them with a verbatim split.
5. One SQL test would close AC-210 and AC-223 #0 together (governed_activation 080-taxonomy: unbuilt provider at activate and schedule); the AC-205/218/225/294 races need the race kit.
