# Review `claude_s12_refute2_a` - refutation of lane `a` re-citation round-2 proposals (P2-S12-AC-001 .. AC-150)

Reviewer: `claude_s12_refute2_a` (separate population, did not write the proposals). 2026-10-29T01:10Z. Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`,
HEAD `cd89d54c` (gap-wave files untracked/modified). Inputs: `recite2/a-proposals.json` (SHA-256 `50bd68a1...e418`), `lane-recite2-a-report.md`,
`briefs/recite2-refutation.md`, `2026-10-14-claude-s12/lane-rules.md`, `scripts/evidence/README.md` + `ledger-guard-lib.mjs`. Output:
`recite2/a-refutation.json` (150 entries, one per criterion, ascending) and this report. Read-only: no supabase, docker, db, race, Vitest or Playwright
run was started; the only reads of runs are the lane/review TAP files already in `.lane-logs/`. Scratch (builders and checkers):
`/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_refute2_a/`.

## 1. Verdict: ACCEPT-WITH-DROPS (mandatory conditions)

Apply the 31 DROPs, the 3 FIXes and the AC-050 re-split; add the 4 missed tests; correct the limitation texts in section 7. The numeric DROP rate
(31/192 = 16.1 %) is far above the 5 % ACCEPT band, so this is not an ACCEPT. I did not call it REJECT because the over-claiming is not systematic
across the lane:

* 18 of the 31 DROPs are class NOEFFECT padding (a "store unchanged" or "control" assertion filed as a citation next to the real proof). They cost
  no proof, only ledger noise; excluding them the substantive rate is 13/192 = 6.8 %.
* the lane tends to cite every tagged assertion of a db1 file in the clause (controls, no-effect checks, fixtures), which is where most DROPs come from;
* the lane's latency benches and apispecs (45 citations), its ACL and call-graph assertions (20) and its node-pointer pgTAP (3) have 0 DROP; its web work (28) has 2
  DROPs; its two lock-order oracles (6) lose only their mutated-source controls;
* the substantive over-claims are concentrated in the other `gaps_db1_*` files: 26 of the 31 DROPs and 1 FIX sit in their 75 citations (governed 10, schedule_fire 7,
  pattern_placement 3, locale_variant 3, template 1, recheck 1, pattern_types 1) and in the two clauses the lane itself named weak (AC-072 c5, AC-056 c9). Both flip
  `verified` -> `partial`.

Systematic risk that is NOT in the DROP count: 13 criteria cite five real-stack latency apispecs that nobody has run (section 5); 11 of them are `verified` only if root's run passes.

## 2. Counts

| | n | share |
|---|---|---|
| Proposed citations reviewed (every one: 131 pgTAP, 61 Vitest; 169 distinct identities) | 192 | |
| KEEP | 158 | 82.3 % |
| DROP | 31 | 16.1 % |
| FIX (kept for status, with a stated change) | 3 | 1.6 % |
| Criteria with at least one DROP / one FIX | 21 / 2 | |
| Missed tests found (identity-checked) | 4 | AC-026 c3, AC-105 c6, AC-141 c0 x2 |
| Splits judged | 4 | 3 OK (AC-023, AC-143 unsplit advised, AC-150), 1 REJECT (AC-050) |
| Gap-only criteria re-examined | 26 | all gaps confirmed; 0 criterion upgraded |

Status of the 150 criteria, lane vs. mine (recomputed from the KEPT and FIX citations): lane **114 verified / 35 partial / 1 unverified**, mine
**112 / 37 / 1**. Changes: **AC-056 verified -> partial** (c9 uncited), **AC-072 verified -> partial** (c5 uncited). Contingent (unchanged on paper):
11 further criteria are `verified` only if root's real-stack apispec run passes (section 5: AC-067, 073, 079, 091, 097, 103, 109, 115, 121, 127, 133); AC-026, AC-141 and AC-147
are `verified` only with the FIX/missed-test edits applied.

## 3. DROP classes (31) and FIX (3)

| Class | n | Where |
|---|---|---|
| NOEFFECT: a store-unchanged, cleanup, mutated-source or positive/negative control assertion filed under a clause that does not state it (class B of review-refute-a) | 18 | AC-023 c1; 026 c2; 033 c2; 043 c2; 065 c1; 066 c2; 072 c5; 073 c1; 079 c1; 083 c2; 084 c2; 088 c2; 107 c1; 143 c3 and c6; 144 c3; 147 c3 x2 |
| CONFOUNDED: the assertion does not isolate the clause's condition, or its title says more than its body | 6 | AC-043 c2 (count of the owned pattern's rows titled "no row names a foreign lineage"); 056 c9 (409 is the stale CAS, not the actor); 065 c1 (control that documents the test's blind spot); 072 c5 x2 (unassigned creator = any unassigned human; "identity-specific" control differs by assignment); 143 c3 (four disjuncts of one OR all true at once) |
| ADJACENT: asserts the neighbouring rule or mechanism | 5 | AC-048 c10 (key freshness on a changed request); 055 c2 (empty DETAIL belongs to c7); 056 c9 (actor-bound key mechanism); 072 c5 (assignment eligibility is 409); 110 c3 (restart loop bound) |
| PROOFGAP: passes because the clause is NOT satisfied | 1 | AC-050 part 0 (feature-ledger test pins 25.05.03/25.05.04 as unassigned drift) |
| SOURCE: negative text scan where a behavioural test exists | 1 | AC-144 c4 (`prosrc !~* '(step_up\|mfa)'`) |
| FIX identity: ambiguous Vitest identity (the guard rejects `occurrences > 1`) | 2 | AC-026 c3 (`pattern-instance-routes.malformed-ids.test.ts`: `it.each` of 4 cases yields 2 names, each twice) |
| FIX confounded: an aggregate meta-assertion standing for three tests | 1 | AC-147 c7 (`this suite drove the blocked reason codes ...`) |

## 4. Mechanical checks (scripts in the scratchpad)

| Check | Result |
|---|---|
| Guard simulation: ledger + my kept citations + the lane's splits (AC-050 re-split as Slice 11 did), synthetic passing receipts, real `evaluateLedger` | **0 problems** (clause tiling, status/limitation rules, citation shapes, duplicates inside a clause, sole-proof limit); recomputed statuses equal the statuses in the JSON (0 mismatches); ledger totals 184 verified / 94 partial / 18 unverified with lane a applied |
| Split tiling with the guard's own `CLAUSE_SEPARATOR` | AC-023 c1 (3 parts), AC-050 c0 (4 parts as proposed, 7 as advised), AC-143 c3 (2 parts), AC-150 c0 (3 parts): verbatim, ordered, non-overlapping, tile |
| pgTAP identities (109 distinct descriptions, 131 citations) | literal descriptions: owned by exactly one file of the closure, once; 6 computed `s12pl_refused` descriptions (label + token) match the entrypoint call and the helper `pattern_placement/010-oracles.sqlinc:96-104`; all `.sqlinc` owners are `\ir`-included by a top-level `.sql`; **every description is `ok` in the newest lane/review TAP** (`.lane-logs/alt-staged-*.tap`), none `not ok` |
| Vitest identities (61 citations) | 53 resolve statically; 8 `it.each` titles (AC-026 x2, 069, 105 x3, 117 x2) verified by reading the case tables; **AC-026 c3 x2 are ambiguous** (above); no `.skip/.todo/.only` in any cited Vitest file; no duplicate full name in a cited file (static) |
| Cited pgTAP files | no duplicated description literal in any of the 18 cited pgTAP owner files |
| Sole-proof limit | no test is the only citation of a clause for 3 or more criteria (ledger + lane a) |
| Apispec support imports | all 6 `tests/postgrest/phase-02-slice-12-latency-*.apispec.ts` imports resolve; `vitest.postgrest.config.ts` includes `tests/postgrest/**/*.apispec.ts` |
| Tag scan (66 tagged strings of AC <= 150 in 27 new/modified test files not cited anywhere) | all fixtures, deadline sweeps, contract tests or the controls dropped above; none is a missed proof except the four listed in section 6 |

## 5. Tier "p95" clauses (13 criteria): what stands and what does not

Cited by pair (round-2 brief, S11 precedent): a pgTAP RPC bench (DB share, `service_role`, n >= 24) plus a real-stack latency apispec. I read all six
apispecs (five are cited by lane a; `latency-templates` is outside its range) and the five bench assert files: they are sound measurements (3 warm-ups + 24 samples, `measure()` times only the request, every answer asserted in
`check()`, `percentile_cont`, bound-size worlds: 128 fields, 512 nodes, 32 instances, 128 diff paths, 64/64/6 taxonomy bounds, limit 50/100 pages). The proof
of each Tier clause is the apispec; the bench is a supplement (KEEP, but valid only together with it).

* The five cited apispecs (governed, patterns, compose, taxonomy, locale) have **never run**. If root's run does not produce passed receipts, these criteria revert to `partial`:
  AC-067, 073, 079, 091, 097, 103, 109, 115, 121, 127, 133 (11 `verified` ones); AC-056 and AC-085 are partial anyway but would lose their Tier clause.
* AC-079 c9: the apispec times assignment **create** only. **Revoke** is measured only by the DB-share bench (`revokeAssignment` is untimed setup in the detail
  test), and a bench alone never proves a Tier clause. Add a timed revoke to `latency-governed.apispec.ts` or accept create as representative.
* AC-103 c5 "(target < 2 s)": shown only at p95 (< 1,200 ms) by apispec and bench; the closing test asserts every sample under 15 s, nothing per request under 2 s.
  Soft target, kept.
* AC-061 c6 (no apispec authored, perf BOUNDARY B2): correctly left a gap.

## 6. The ten most serious findings

1. **AC-072 c5 "the subject creator) is 403": 4 DROP, verified -> partial.** The decision refusal of the creator is `capability_missing` because the creator is never
   assigned (the assignment was refused), i.e. the same answer every unassigned human gets (`gaps_db1_governed.sql:204-209`). The `separation_of_duties` branch is
   unreachable for a creator, which the lane's own report says; BE03c 1468 puts the creator's assignment refusal in the 409 list (`reviewer_not_eligible`). Round-2 rule:
   unreachable part left uncited with its BOUNDARY text, not verified-with-caveat. The "control" claims the refusal "was identity-specific" but the control differs by
   assignment. Consistency flag: the ledger's c4 (submitter) rests on the same outcome-only proof.
2. **AC-056 c9 "answers a changed actor ... with 409": 2 DROP, verified -> partial.** The editor gets `VERSION_MISMATCH` because the creator's write moved the entry version past the
   replayed body (`entry_version_now > sent_version`, `gaps_db1_locale_variant.sql:158-161`); reservations are keyed (actor, operation, key hash) (`cms_reserve`
   -> `identity_idempotency_reserve`), so another actor never collides. BE03c 150 says "changed actor ... returns 409"; with a current `expectedVersion` the
   same actor change is an independent request. The test cannot tell whether the actor clause is implemented. Needs the fresh-version variant and a spec decision.
3. **AC-050 part 0: the feature-ledger citation passes because the update was not made.** `phase-02-slice-12-closeout.test.ts:110-154` pins 25.05.03 and 25.05.04 as the
   plan-listed, unassigned remainder ("KNOWN DRIFT"). DROP; split REJECTED as too coarse (part 0 would count four artifacts proven); re-split as Slice 11 did, leave
   "feature-ledger assignments" uncited or have root assign the two rows (then the pinned assertion changes).
4. **AC-143 c3 "the subject (`scheduled` with an equal hash)".** The only cite (f5, `schedule_fire.sql:160-175`) invalidates the review and returns the subject to draft in one
   transaction; the executor ORs `review.state <> approved or version <> expected or subject state <> scheduled or subject hash differs` into one `approval_invalidated`
   (`20261014070600:155-157`), so deleting the subject disjunct keeps the test green. DROP (2); leave c3 as ONE gap (the proposed split adds nothing) and make the
   limitation name both halves, not only "with an equal hash)".
5. **AC-026 c3 "422/404": the 422 Vitest identities are ambiguous.** `it.each` over 4 cases produces two titles, each twice; the guard rejects `occurrences > 1`. Proof is sound.
   FIX: make the case titles unique, then cite. The 404 half is carried by the pgTAP `NOT_FOUND` tokens and the existing CMS-03C-02 adapter mapping test (missed test).
6. **AC-147 c7 "every `reasonCode`": an aggregate stands for three tests.** `schedule_fire.sql:203-206` (distinct blocked codes of this suite = three codes) is a coverage
   meta-assertion. FIX: cite the three individual assertions (lines 119, 158, 175) instead; `dependency_changed` and `retries_exhausted` stay on their existing tests.
7. **13 criteria cite five real-stack apispecs that have never run (11 of them `verified` only if the run passes); AC-079 revoke is unmeasured end to end** (section 5).
8. **AC-141 c0 "(create, rename and alias)": the lane's three cites prove the call chain and the preflight, not the action split.** Two existing assertions in
   `taxonomy_terms/090-overlap.sqlinc` (lines 61-63: create/rename/alias are 503 under a failing provider; 65-70: deprecate and merge run no overlap check) complete it.
   Added as missed tests; without them the clause is not fully proven.
9. **NOEFFECT padding (18) and two titles that over-claim.** AC-043 c2 "no row names a foreign or draft lineage" counts only the owned pattern's rows
   (`pattern_placement.sql:110-113`); AC-065 c1's control asserts the fixture whose own comment says lineage id = row id, i.e. why the case cannot be separated. No proof is
   lost by dropping them; keeping them would pin cleanup controls and the db1 lane's habit into the ledger.
10. **AC-105 c6 chain and AC-023 owner scope.** The DB pointer (pgTAP, needs the node-pointers WIP promoted first) and the designer rendering (component test with a stubbed `nodePath`)
    are cited but the Worker relay in between (root-written `node-pointer-refusal.test.ts`) is not (missed test). AC-023: the live check requires `owner_id = acting_party_id`
    (`20261013100200:120-130`) and the foreign fixture type `..0104` is built (`gaps_db1_template/000-fixtures.sqlinc:88`) but unused, so the most plausible reading of "/allowlisted"
    is untested while the part is declared "spec silent".

## 7. Limitation texts to correct before copying

* AC-072: replace with: "Unproven (uncited clause): "the subject creator) is 403": the decision RPC's separation_of_duties branch cannot be reached by a creator (a creator is
  refused at assignment with 409 reviewer_not_eligible and never holds an assignment); the 403 an unassigned creator receives is capability_missing, not SoD-specific (BOUNDARY)."
* AC-056: add c9: "'answers a changed actor': BE03c 150 vs the actor-scoped reservation (cms_reserve / identity_idempotency_reserve); the 409 observed for another actor is the stale
  entry version; needs a spec ruling and a fresh-version test."; c6 stays cited only with a passed apispec receipt.
* AC-143: name both halves of c3 ("the subject (`scheduled`" and "with an equal hash)") plus c4 "the policy basis".
* AC-050: keep "in the same change;" and add "feature-ledger assignments: 25.05.03 and 25.05.04 unassigned (DEC-114)".
* AC-061 c6: name the missing apispec (64 eligible targets over HTTP), not only the bench.

## 8. Missed tests and missed gaps (all in the JSON)

| Criterion / clause | Item | Evidence |
|---|---|---|
| AC-026 c3 | vitest `apps/worker/src/cms-composition-production-pattern.test.ts` "CMS-03C-02 production pattern adapter maps private domain failures and transport failures without exposing provider content" | `:229-299` NOT_FOUND -> 404 COMPOSITION_NOT_FOUND, VALIDATION_FAILED -> 422 |
| AC-105 c6 | vitest `apps/worker/src/cms-composition/node-pointer-refusal.test.ts` "nodePointerWireDetails (DEC-228) [P2-S12-AC-105] relays the first held pointer ..." | `:11-33` |
| AC-141 c0 | pgtap `taxonomy_terms/090-overlap.sqlinc` "with the role provider failing, create, rename and alias are 503 ..." | `:61-63` (newest TAP ok) |
| AC-141 c0 | pgtap `taxonomy_terms/090-overlap.sqlinc` "a failing provider does not touch an undeclared vocabulary, a deprecate or a merge ..." | `:65-70` (newest TAP ok) |
| AC-079 c9 | gap: timed revoke missing from the governed apispec | section 5 |
| AC-023 c1 | gap: foreign-owner type in `compatibleTypeIds` untested for templates | section 6 item 10 |
| AC-065 c1 | note: "exact version row id" vs lineage id is not separable for a first version; the resolver reads `item.id = p_id` (`20261013300300`) | accepted if row-id lookup is the definition |
| AC-083 c2 | note: cited via a labelled fault-injection seam at the pinned readers (production recheck unmodified, restored byte for byte); I kept it as a test double, root should say so | `gaps_db1_recheck.sql:98-141` |

## 9. The 26 gap-only criteria (no add proposed): all gaps confirmed

Confirmed by search (not by trusting the lane's re-check): AC-001 c3 (no `accessibility_contract` comparison in migrations, tests or Worker), AC-010 c2 (only
`latency-compose.apispec.ts` calls `/pattern-instances`, asserting 201 and counts), AC-013 c6 and AC-019 c7 / AC-047 c1 (no race module drives `cms_insert_pattern_instance` or two
competing `cms_act_taxonomy_term` calls; `dec194_outer.race.mjs` races one merge against authority changes), AC-039 c2 (`governed-review-headers.test.ts:61-72` is CMS-03C-06 only),
AC-042 c1/c5/c12 (no leave guard in `cms-composition`), AC-058 (the locale real-route spec opens the templates page), AC-075 c8, AC-086 c1/c4 (the unbuilt-provider token has no
CMS-03C-09 test), AC-093/111/129 page-level (no e2e opens those routes), AC-095 c2 (queue describe has no body/header case), AC-126/128 (only catalog messages are fed to
createVersion), AC-134 c4/c5, AC-145 c1. Accepted on the lane's evidence with a plausibility check: AC-044 c3 deletion, AC-046/040 meta clauses (cannot be removed; the guard
allows only separators between clauses), AC-049 (process), AC-061, AC-108 c3 (draft foreign row cannot isolate the owner predicate), AC-137 c3 (no whitespace facet code).
The 83 criteria with no proposal carry empty entries with a note; their existing citations were not re-argued.

## 10. Splits

* AC-023 c1: OK (verbatim tile; correct to leave "/allowlisted" uncited until the owner-scope test exists).
* AC-050 c0: **REJECT as proposed** (see finding 3); advised 7-part split (`Update slice tracking` | `feature-ledger assignments` | `applicable runbooks` | `and architecture graph` |
  `in the same change;` | `leave no unresolved implementation boundary` | `or undocumented drift.`), simulated against the guard: 0 problems.
* AC-143 c3: tiles, but with part 0 dropped neither part is cited: keep c3 unsplit as one gap.
* AC-150 c0: OK (tile includes the part's own leading "and"; Shard 04 part stays a BOUNDARY).

## 11. Requests to root (ordered)

1. Run the five cited latency apispecs (`pnpm db:reset` before each, quiet host) before applying any Tier citation; decide whether AC-079's create-only measurement suffices.
2. Rule on AC-056 c9 (BE03c 150 vs actor-scoped reservations) and on the unreachable-SoD policy for AC-072 c4/c5.
3. Assign or leave 25.05.03/25.05.04 (AC-050); apply the 7-part split.
4. Retitle the four `it.each` cases of `pattern-instance-routes.malformed-ids.test.ts` before citing (description-only test edit).
5. Apply the 4 missed tests and the AC-147 c7 replacement; keep the DROPped controls in their files (they are good tests, bad citations).
6. Promote the `node-pointers` WIP migrations before citing the three AC-105 c6 pgTAP node-pointer assertions.
7. Verify the 6 computed pgTAP identities (`s12pl_refused`, AC-026/043) and the 8 `it.each` Vitest names mechanically against the fresh full TAP and JSON.

## 12. Evidence index

Refutation JSON `docs/handoffs/2026-10-22-claude-s12/recite2/a-refutation.json`; per-criterion reasons carry `path:line`. Builders, simulation (`simulate.mjs`), identity and TAP checks,
tag scan and the DROP/FIX listing are in the scratchpad directory named above. Tests read in full: `gaps_db1_{template,locale_variant,pattern_placement,governed,recheck,
schedule_fire,acl,locale_gate,pattern_types}.sql`, `gaps_node_pointers.sql`, `gaps_lock_order.sql`, `gaps_perf_{locale.sql,governed/050,patterns/050,taxonomy/040}`, the six latency
apispecs, `phase-02-slice-12-closeout.test.ts`, and the 14 web/Worker Vitest files cited.
