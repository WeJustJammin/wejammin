# Review `claude_s12_refute2_b` — refutation of re-citation round-2 lane `b` (AC-151 .. AC-296)

Reviewer: independent refutation population, did not author `b-proposals.json`. Worktree
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, branch `claude/phase2-slice12`, HEAD
`cd89d54cc84403e32699666c8d3710f45bbffce0`. Read-only except `recite2/b-refutation.json` and this report. No supabase, docker,
db, race, Vitest or Playwright command was run (root's `db:verify` is live); every verdict rests on the asserting lines and on
catalog/source reads. Scratch work lives in the session scratchpad under `claude_s12_refute2_b/` (not in the repo).

## 1. Verdict

**ACCEPT-WITH-DROPS.** 421 citations were checked (all of them, not a sample): **361 KEEP, 59 DROP, 1 FIX** (14.0% DROP).
The over-claiming is not systematic: 38 of the 59 DROPs are *sound* tests that cannot close their clause or tile (the lane's own
caveat cases, which root had already ruled on), 8 are database-share benches for "Tier N p95" clauses (DEC-226(1)), and only
13 are tests that do not prove what they are cited for. The lane's identities are accurate (see section 6). The lane also
mis-stated or missed things that matter more than its DROP count: one "BOUNDARY" that is closable (AC-261), a blind assertion
cited as proof (AC-289), a citation of the wrong test (AC-246), and four clauses whose universal was closed by one of several
cases (AC-190, AC-194, AC-219, AC-276).

| | pgTAP | vitest | total |
|---|---|---|---|
| KEEP | 342 | 19 | 361 |
| DROP | 58 | 1 | 59 |
| FIX | 1 | 0 | 1 |

Eleven of the KEEPs are real-stack latency apispecs the lane's author never ran (AC-162, 168, 174, 180, 186 x2, 279 x5); they
are KEEP conditional on a passing receipt from root's run. Splits: 15 verdicts, 9 OK and 6 REJECT (5 of the 6 are clauses the
lane did not split; the sixth is the lane's AC-194 split, re-cut). Missed tests proposed: 13. Missed gaps recorded: 58.

## 2. Statuses (recomputed from KEEP + FIX + missedTests + accepted/corrected splits)

| Transition | Criteria |
|---|---|
| ledger -> mine: partial -> verified | 30 |
| unverified -> verified | 8 |
| unverified -> partial | 6 |
| partial -> partial | 27 |
| unverified -> unverified | 3 (AC-210, 273, 276) |
| **final** | **38 verified, 33 partial, 3 unverified** (lane proposed 42 / 30 / 2) |

Differences from the lane's proposed status (7): AC-186, 190, 244, 289, 292 verified -> **partial**; AC-276 partial ->
**unverified**; AC-261 partial -> **verified** (the lane's BOUNDARY is closable, see finding 3). The status column of the JSON
is computed by a script that applies my splits and missedTests; AC-190, 194, 198, 244, 246, 248, 251, 261 and 219 depend on the
corrected splits / replacement / added citations being applied (the statuses above assume they are).

## 3. DROP classes (59)

| Class | n | Where |
|---|---|---|
| A. Sound, but cannot close the clause/tile (half-proof, unreachable sub-branch, universal not covered); root's "never verified-with-caveat" | 38 | AC-276 tile 3 (28), AC-186 clause 1 (3), AC-292 (4), AC-289 #1-#3 (3) |
| B. Database-share pgTAP bench cited for a "Tier N p95" clause (DEC-226(1); the apispec is the proof, the bench adds a host-load-sensitive assertion) | 8 | AC-162, 168, 174 (2), 180, 186 (2), 279 |
| C. Source-text proxy, controls or unrelated happy path for a behavioural negative claim | 4 | AC-295 |
| D. Blind assertion / positive control | 2 | AC-289 #4 (blind), #5 (control) |
| E. Scope narrower than the claim | 2 | AC-194 #4, #5 |
| F. Tangential no-effects assertion after a raised refusal (the clause states no effect rule; the harness rolls a raised exception back, so it cannot fail) | 4 | AC-199 #2, #4; AC-201 #2; AC-244 #5 |
| G. Other layer, stubbed binding | 1 | AC-246 web proxy |

Policy applied to "no effects after a refusal": dropped where the clause says nothing about effects and the refusal is a raised
exception inside a sub-transaction; kept where the clause states the rule (AC-233 "writes no variant") or the refusal is a
committed, non-raising body (AC-208/209 "no event / no schedule row"). Source scans (`prosrc ~`) were accepted only for
call-graph or "only X writes Y" claims and always beside a behavioural twin (AC-152, 194 #3, 195 #9, 251-255 writer lists,
248 #5, 278 #6); they were refused as the sole proof of a negative behavioural claim (AC-295) and as a scan narrower than its
claim (AC-194).

## 4. The ten most serious findings

1. **AC-276 tile 3 is closed by 28 citations that prove one half of it for a subset of writers.** Each injection test
   (`gaps_lock_conversion.sql:16-31`) replaces the private body by one raising 40P01/55P03 and checks the wrapper answers
   `P0001:CONFLICT`; V13-02 checked that handler. The tile also claims the *409 catalog code* (the Worker mapping is cited
   nowhere), "nothing committed" (the injected body raises before it writes) and "the same Idempotency-Key reusable" (observed
   for CMS-03C-01 only, `template_authority.sql:215-253`), for writers that include CMS-03C-04 and the recheck job (tests
   exist, not cited), the linked-update scan and the term-merge continuation (no conversion test exists). All 28 DROP (class
   A); AC-276 stays `unverified`. The three omitted sound tests are named in `missedGaps` for the limitation text, not as
   closers.
2. **AC-289 #4 is blind, and the rest of the set is a gate-level proxy for a public clause.** `gaps_entry_default.sql:171-205`
   compares store counts around a gate call that sits in a `BEGIN ... EXCEPTION WHEN OTHERS` block, so the counts are equal
   whatever the gate wrote. The other cites call `cms_entry_default_template_gate` directly because the public create cannot
   reach the branch (the file says so). Root's round-2 rule applies: AC-289 stays `partial`, clause 1 uncited. The absent /
   other-owner gate answers (#1-#3) are real corroboration for clause 0 (one optional missedTest).
3. **AC-261's "BOUNDARY" for the three job handlers is wrong.** Existing Worker production-entrypoint tests route the typed
   messages and the jobs row: `governed-recheck/production.test.ts` ("[P2-S12-AC-202] async entrypoint routing of the governed
   recheck job ..."), `linked-scan/production.test.ts` ("[P2-S12-AC-212] async entrypoint routing of the linked-update scan job
   ..."), `production-async-entrypoint-taxonomy-merge.test.ts` ("merge-converge job through the production async entrypoint
   converges ..."). All three identities are present and `passed` in the Oct-23 JSON. With them AC-261 is `verified`.
4. **AC-194 tile 0 joins a proven claim to an unproven one.** "Never registers, updates or deletes a block" is proven
   (#1 registry md5 image, #2 row sets, #3 writer scan). "Consumes only the safe projection (... no release principal, signature
   or raw manifest)" is not: the cited digest-reader scan covers three functions, while `cms_create_pattern_version` reads
   `registered.props_schema_snapshot` (migration `20261014020400:247`), a column the same regex names as unsafe, and the SQL
   readers emit no `resourceKind`. #4/#5 DROP; split REJECT with a three-tile re-cut (cited: the middle tile);
   `unverified -> partial`.
5. **AC-246 #12 cites the restore test for the encoder clause.** `028-active-ids.sqlinc:77-79` is tagged AC-244. The right
   assertion is five lines earlier (`:66-68`, "... records both active version ids once each, ascending bytewise
   [P2-S12-AC-246]"). FIX with that identity (checked: literal once, entrypoint `taxonomy_integrity.sql`).
6. **AC-219 clause 1 is a universal over four writers cited by one.** The three new tests prove the revision-append
   carry-over (invalidation `revision_superseded` in the same call). CMS-03C-02, CMS-03C-15 and the linked-update scan have
   tests for the same rule that are not cited under clause 1 (all three exist; identities verified). Added as missedTests; with
   them the clause is verified.
7. **AC-190 clause 1 leaves "selectors" unproven and omits the template latest read.** The only selector-scoping test
   (`gaps_db1_pattern_types.sql:100-115`, AC-108) uses a *draft* foreign clone that the selector's own `state = 'active'`
   predicate (`20261014140300:135`) excludes anyway, and `pageVersion` (`:157`) is not asserted; an active foreign version is
   not producible. Per root's rule the clause is re-cut (`every lookup by key (the latest reads, parents` | `selectors)` |
   `is scoped to the caller's owner party`) with the middle tile uncited. The template latest-read apispec and two
   taxonomy per-owner assertions (no 409) are added as missedTests; `verified -> partial`.
8. **AC-244 and AC-198 need root's unreachable-branch split, which the lane replaced by caveats.** AC-244: "unknown" cannot be
   constructed (foreign keys), re-cut into four tiles, `and an unknown` uncited (checked against the guard separator rule).
   AC-198: the middle sort key `policyVersion` is unobservable (every registry member is version 1, `g2_member` fixes 1), re-cut
   into three tiles with `policyVersion,` uncited.
9. **AC-186 / AC-292: half of a two-member scope.** "Acting context" and "scope" are actor + acting party; the lane proves the
   actor member (sound) and the party member is unreachable (AC-186) or undriven (AC-292). A two-word / one-phrase clause
   cannot be split verbatim, so both clauses stay uncited and the actor evidence goes into the limitation text.
10. **Eight database-share benches were cited under "Tier N p95" clauses** (class B), and the 512-row placement bench is
    host-load sensitive (V14 measured p95 267 ms; the lane saw 332 ms once). The apispec carries the clause; the RPC < 300 ms
    benches that are kept (AC-279) are the true RPC-half proof and should be run on a quiet host.

## 5. What holds

* The five governed persistence families (AC-251 to AC-255, 95 citations) are strong: catalog definitions read as exact literal
  sets or anchored index definitions, plus direct-write probes through `g2_try` (always rolled back, returns
  `sqlstate:message`), real `SET ROLE` denials (42501), writer inventories and controls. Only one clause element was missing
  (AC-251 `subject_kind` closed set; added as a missedTest, the test exists under AC-196).
* AC-193 numeric `blockVersion` (expected value built from stored rows, text-order `isnt`), AC-187 expired cursor (re-seal with
  controls), AC-233 successor chain, AC-240 missing-over-stale (controls for each alone), AC-242 resolver, AC-239 provider,
  AC-221/246 allowlists and the uniform `term_unavailable` (computed titles, loops reach the labels), AC-195 lifecycle guard,
  AC-189/191 reserved keys and lineage index, AC-173/190/216 owner scoping (the foreign key is a real owner key; the
  own-draft case discriminates concealment from the state refusal).
* The lane's clause tiling is mechanically correct for all 10 splits and all 74 clause texts (checked with the guard's
  separator rule); no `proposeRemoval` exists; no duplicate citation inside a clause; no citation is the sole proof of
  more than 3 criteria after my changes (7 are sole proof of 2 criteria).

## 6. Identity checks (static; root verifies mechanically)

* pgTAP: 401 citations; every non-computed title found as a *whole SQL string literal* in the cited file (whitespace
  collapsed, quotes doubled, same rule as `literalOwners`), exactly once per file and once per entrypoint closure; 0 absent, 0
  ambiguous. Every `.sqlinc` cite resolves to >= 1 top-level `.sql` entrypoint (none is a `populated-*.sql` witness).
  14 computed descriptions (AC-179, 181, 190, 221 x5, 246 x6 as listed) name the entrypoint `.sql`; for each I read the loop and
  the call site: `s12td_refusal` labels `read-not-curator` (070-versions-read.sqlinc:76-78) and `other-owner-parent`
  (050-authority.sqlinc:24-26); the `020-encoder.sqlinc:79-82` and `:127-130` label arrays contain `deprecated, merged, unknown,
  wrongfield, wrongtype, foreign` (entry) and the same six (revision), plus `allowlist_dropped` for the entry.
* vitest: 20 citation entries (19 distinct tests); all 19 verified as `describe` + `it` chains in the source (2 are `it.each`
  expansions whose pattern matches). `list-test-identities` against `vitest-all.json`: five of the files carry tests newer
  than the Oct-23 JSON (`preflight.test.ts` and `cms-editorial-production-error-tokens.test.ts` are `stale` there;
  `template.context-bounds.test.ts`, `taxonomy-definition-versions.refusals.test.ts` and
  `cms-editorial-platform-term-unavailable.test.ts` are absent), so those identities rest on the source and root's fresh
  JSON. The 11 apispec identities exist only in source.

## 7. Per-criterion table (ledger status -> lane status -> mine; KEEP / DROP / FIX / missedTests)

| AC | ledger | lane | mine | K | D | F | +T |
|---|---|---|---|---|---|---|---|
| 152 | partial | partial | partial | 5 | 0 | 0 | 0 |
| 155 | partial | partial | partial | 0 | 0 | 0 | 0 |
| 158 | partial | partial | partial | 0 | 0 | 0 | 0 |
| 159 | partial | verified | verified | 11 | 0 | 0 | 0 |
| 161 | partial | verified | verified | 12 | 0 | 0 | 0 |
| 162 | partial | verified | verified | 1 | 1 | 0 | 0 |
| 164 | partial | partial | partial | 0 | 0 | 0 | 0 |
| 168 | partial | verified | verified | 1 | 1 | 0 | 0 |
| 169 | partial | partial | partial | 0 | 0 | 0 | 0 |
| 173 | partial | verified | verified | 3 | 0 | 0 | 0 |
| 174 | partial | verified | verified | 1 | 2 | 0 | 0 |
| 176 | partial | partial | partial | 0 | 0 | 0 | 0 |
| 179 | partial | verified | verified | 2 | 0 | 0 | 0 |
| 180 | partial | verified | verified | 1 | 1 | 0 | 0 |
| 181 | partial | partial | partial | 2 | 0 | 0 | 0 |
| 182 | partial | partial | partial | 0 | 0 | 0 | 0 |
| 186 | partial | verified | partial | 2 | 5 | 0 | 0 |
| 187 | partial | verified | verified | 2 | 0 | 0 | 0 |
| 189 | partial | verified | verified | 4 | 0 | 0 | 0 |
| 190 | partial | verified | partial | 11 | 0 | 0 | 3 |
| 191 | partial | verified | verified | 4 | 0 | 0 | 0 |
| 193 | partial | verified | verified | 6 | 0 | 0 | 0 |
| 194 | unverified | partial | partial | 3 | 2 | 0 | 0 |
| 195 | partial | verified | verified | 13 | 0 | 0 | 0 |
| 196 | unverified | verified | verified | 13 | 0 | 0 | 0 |
| 197 | unverified | verified | verified | 3 | 0 | 0 | 0 |
| 198 | partial | partial | partial | 9 | 0 | 0 | 0 |
| 199 | partial | verified | verified | 4 | 2 | 0 | 0 |
| 200 | unverified | partial | partial | 4 | 0 | 0 | 0 |
| 201 | partial | verified | verified | 5 | 1 | 0 | 0 |
| 202 | partial | verified | verified | 5 | 0 | 0 | 0 |
| 205 | partial | partial | partial | 0 | 0 | 0 | 0 |
| 208 | unverified | partial | partial | 5 | 0 | 0 | 0 |
| 209 | unverified | verified | verified | 6 | 0 | 0 | 0 |
| 210 | unverified | unverified | unverified | 0 | 0 | 0 | 0 |
| 211 | partial | partial | partial | 0 | 0 | 0 | 0 |
| 216 | partial | verified | verified | 5 | 0 | 0 | 0 |
| 218 | partial | partial | partial | 0 | 0 | 0 | 0 |
| 219 | partial | verified | verified | 3 | 0 | 0 | 3 |
| 221 | partial | verified | verified | 6 | 0 | 0 | 0 |
| 223 | partial | partial | partial | 0 | 0 | 0 | 0 |
| 224 | partial | verified | verified | 4 | 0 | 0 | 0 |
| 225 | partial | partial | partial | 0 | 0 | 0 | 0 |
| 228 | partial | verified | verified | 3 | 0 | 0 | 0 |
| 233 | partial | verified | verified | 6 | 0 | 0 | 0 |
| 238 | partial | partial | partial | 0 | 0 | 0 | 0 |
| 239 | unverified | verified | verified | 9 | 0 | 0 | 0 |
| 240 | partial | verified | verified | 4 | 0 | 0 | 0 |
| 241 | partial | verified | verified | 7 | 0 | 0 | 0 |
| 242 | unverified | verified | verified | 8 | 0 | 0 | 0 |
| 244 | unverified | verified | partial | 6 | 1 | 0 | 0 |
| 246 | unverified | verified | verified | 12 | 1 | 1 | 0 |
| 248 | partial | partial | partial | 9 | 0 | 0 | 2 |
| 251 | unverified | verified | verified | 31 | 0 | 0 | 1 |
| 252 | partial | verified | verified | 14 | 0 | 0 | 0 |
| 253 | partial | verified | verified | 14 | 0 | 0 | 0 |
| 254 | unverified | verified | verified | 16 | 0 | 0 | 0 |
| 255 | partial | verified | verified | 20 | 0 | 0 | 0 |
| 256 | partial | partial | partial | 0 | 0 | 0 | 0 |
| 261 | partial | partial | verified | 13 | 0 | 0 | 3 |
| 265 | partial | partial | partial | 0 | 0 | 0 | 0 |
| 271 | partial | partial | partial | 0 | 0 | 0 | 0 |
| 272 | partial | partial | partial | 0 | 0 | 0 | 0 |
| 273 | unverified | unverified | unverified | 0 | 0 | 0 | 0 |
| 276 | unverified | partial | unverified | 0 | 28 | 0 | 0 |
| 277 | unverified | partial | partial | 8 | 0 | 0 | 0 |
| 278 | partial | verified | verified | 9 | 0 | 0 | 0 |
| 279 | unverified | partial | partial | 12 | 1 | 0 | 0 |
| 286 | partial | verified | verified | 1 | 0 | 0 | 0 |
| 287 | partial | partial | partial | 3 | 0 | 0 | 0 |
| 289 | partial | verified | partial | 0 | 5 | 0 | 1 |
| 292 | partial | verified | partial | 0 | 4 | 0 | 0 |
| 294 | partial | partial | partial | 0 | 0 | 0 | 0 |
| 295 | partial | partial | partial | 0 | 4 | 0 | 0 |

## 8. Gaps confirmed, gaps the lane mis-stated, tests it missed

* Confirmed real (nothing citable): AC-152 c1/c3, 155 c0/c2 (an `aclexplode` owner-only check of CMS-03C-21 is the missing
  catalog test), 158 c0/c1, 164 c3/c4/c6, 169 c10, 176 c0, 181 c3 (spec: no 422 bound), 182 c0, 205 c1, 211 c1, 218 c3,
  225 c0, 238 c3, 256 c0 (catalog suite for `cms_canonical_domain_registry`), 265 c2/c7/c9, 271, 272, 273, 277 (7 scenarios), 279
  tile 1, 287 tile 0, 294 c1, AC-248/198/200/208 uncited tiles (credible BOUNDARY).
* **Closable, not boundaries:** AC-261 job handlers (finding 3); AC-210 and AC-223 c0 (one pgTAP test: flip the role registry
  row to `unbuilt` after approval and drive CMS-03C-09 activate and schedule; the fire-time analogue
  `gaps_db1_schedule_fire.sql:151-158` shows the flip is constructible); AC-225 c0 (a source oracle on `cms_act_taxonomy_term`
  for `order by term.id for update` would also pin the replay used by AC-277).
* Missed tests (13): AC-190 x3, AC-219 x3, AC-248 x2, AC-251 x1, AC-261 x3, AC-289 x1 (optional).

## 9. Requests to root

1. Apply the corrected splits (AC-190 c1, 194 c0, 198 c2, 244 c0: tiles are in `splits[].fix.tiles`, cited/uncited tile
   indexes beside them) before adding the KEEP/FIX citations; AC-289 c1 and AC-292 c2 stay whole and uncited.
2. Apply the FIX (AC-246) and the 13 missedTests; AC-261 and AC-219 become `verified` only with them.
3. Run the six real-stack latency apispecs; 11 KEEPs depend on them. Run `gaps_perf_patterns.sql` #41 (512-row placement, p95 <
   300) and `taxonomy_integrity_concurrency.sql` (commits fixtures through dblink; not beside a row-counting lane) on a quiet
   host.
4. AC-197: the three KEEPs close the reject-audit gap only together with the 22 wave-1 KEEP/FIX citations (two need their full
   concatenated descriptions, see `c-refutation.json`).
5. The limitation texts for AC-186, 276, 289, 292, 295 should name the sound evidence this review dropped (listed in each
   criterion's reasons / `missedGaps`).

## Verification

Inputs read at their current bytes: `briefs/recite2-refutation.md`, `lane-rules.md`, `lane-recite2-b-report.md`,
`recite2/b-proposals.json` (74 criteria, 421 citations), the Slice 12 ledgers (dumped to scratch with the pinned Node 22.23.1),
`scripts/evidence/{README.md,ledger-guard-lib.mjs,receipts-lib.mjs}`, DEC-226 (`.memory/raw/events/2026-10-24.jsonl`),
BE03c (lock order, E14, SLOs), the reviews V12-V15 `## Verification` sections (no cited test is among the blind ones: V13-16's
`gaps_lock_position4.sql` is not cited by this lane), and every cited test's asserting statement and fixtures.
Commands run (all read-only): `git rev-parse`, `node` scripts for tiling / status / identity / sole-proof / duplicate checks,
`grep`, `sed`, `list-test-identities.mjs`. Nothing was staged, edited or run against a database.
