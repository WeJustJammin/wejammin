# Refutation report: lane `c` ledger re-citation proposals (P2-S12-AC-125 .. AC-214)

Reviewer: `claude_s12_refute_c` (independent population; did not author the proposals). Date: 2026-10-24.
Worktree: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, branch `claude/phase2-slice12`. The brief named HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e`; when I finished,
HEAD was `fc62deef` (root committed the Slice 12 tree in the meantime) and the working tree differed from it only in four Worker production files (1 to 5 lines each:
redundant `isRecord` checks replaced by a cast plus comments) and in handoff docs. No cited test file differs, so the identities below were not affected.
Read-only review: no supabase, docker, db, race module, Vitest or Playwright process was started; no repository file other than the two outputs was written.

Outputs: `docs/handoffs/2026-10-22-claude-s12/recite/c-refutation.json` (90 entries, one per criterion) and this report.
Inputs: `recite/c-proposals.json`, `lane-recite-c-report.md`, `briefs/recite-refutation.md`, `lane-rules.md`.

## 1. Verdict

**ACCEPT-WITH-DROPS.**

- The DROP rate is 31 of 1193 proposed citations (2.6%), under the 5% line of the brief. By that number alone the lane is an ACCEPT.
  I did not pick plain ACCEPT because the lane cannot be applied as proposed: 67 citations are mandatory FIXes (63 computed pgTAP descriptions that name
  the wrong file, 4 titles that are only the first half of a concatenated description), 11 of the 47 criteria the lane proposed `verified` are over-claims, and
  33 of 90 criteria change status once the corrections are applied.
- It is not a REJECT. The proof in the citations is sound: 1095 of 1193 (91.8%) are KEEP as written, 1162 (97.4%) are KEEP or a mechanical FIX, every
  vitest citation (516) resolves (484 to a passing test in the run JSON, 32 apispec titles as static identities), and the lane's own gaps were honest and mostly confirmed (the lane flagged 51 clauses; I confirmed the
  large majority and found that the gap for AC-207 does not exist). The over-claims are not a general habit of citing weak tests; they cluster in four
  recurring classes (a `Tier N` label offered as a latency target, route-level consumption, `every other role`, and cross-owner or Worker seams) that the lane
  applied inconsistently (it held the Tier 1 target uncited in AC-133 and cited the identical target in AC-180; it flagged `every other role` in AC-138 and
  AC-144 and proposed AC-150 and AC-155 clean; it recorded the missing Worker 403 as the blocking limit of AC-181 and proposed AC-179 verified).
- Net effect on statuses, after my recommended splits: lane `verified 47 / partial 15 / unverified 28` becomes `verified 37 / partial 46 / unverified 7`.
  Eleven criteria go verified to partial (real over-claims), 21 go unverified to partial (credit for proven parts through a verbatim split, not a downgrade),
  one goes partial to verified (AC-207). The `statusNote` of each entry says what the status is if root declines my split.

## 2. Counts

Proposed new citations: 1193 (pgTAP 677, vitest 516). Every one has a verdict; nothing was sampled. Computed pgTAP loop citations were checked by reading the
helper and the loop, and by confirming that the loop reaches the cited case (labels and value lists are quoted in the reasons).

| | KEEP | DROP | FIX | total |
|---|---:|---:|---:|---:|
| all new citations | 1095 (91.8%) | 31 (2.6%) | 67 (5.6%) | 1193 |
| pgTAP | 596 | 14 | 67 | 677 |
| vitest | 499 | 17 | 0 | 516 |

Existing (already in the ledger) citations I had to judge because a status depended on them: 9 judgements (KEEP 6, DROP 1, FIX 2). Total DROP verdicts: 32.
Splits recommended: 45 OK (177 verbatim parts, of which 82 are deliberately left uncited because they are the unproven parts) and 13 REJECT (no clean
tiling; the clause stays whole and uncited until a test exists). `missedGaps`: 84 entries. `missedTests`: 53 (vitest 8, pgTAP 45; 15 of the pgTAP ones are
one computed loop in the taxonomy suite).

### DROP, by reason class (32)

| class | n | criteria | what is wrong |
|---|---:|---|---|
| source-text test, not behaviour | 3 | 129 (2), 182 | `taxonomy-pages.test.ts` reads the `.astro` source and asserts it contains JSX text |
| `Tier N` class label offered as the latency target | 2 | 162, 168 | only `x-slo-tier` equality is asserted; BE00:655 defines the target as a p95; AC-279 is unverified |
| duplicate of an existing citation in the same clause | 3 | 128, 142, 170 | the guard rejects the same test twice in one clause |
| wrong operation or route | 2 | 128 (existing), 180 | the test drives the versions read or the create route, not the operation of the clause |
| pure copy helper offered for page behaviour | 3 | 164 (3 rows) | a function returning a fixed sentence; nothing shows submission disabled |
| asserts a different or weaker condition than the clause | 4 | 127, 137, 140, 161 | short key not absent key; `per former` no_match proves not-deleted, not collapse; built-but-unimplemented not unbuilt; a write refusal for a read-then-write claim |
| tangential (checks something the clause does not name) | 5 | 185, 191, 205, 208, 210 | grant posture; UUID syntax; response member set; fire-time authority; event and audit count |
| happy path offered for a requirement or refusal clause | 2 | 199, 210 | a positive activation or an equality that holds with no gate |
| setup control, not the behaviour | 1 | 204 | `control:` precondition tagged for another criterion |
| TypeScript reference with no production caller | 3 | 193, 194 (2) | `block-registry-digest.ts` is imported only by its own test (grep of apps and packages) |
| wrong test cited (evidence belongs to another test) | 1 | 190 | an E13 reserved-key assertion cited for E14 per-owner keys |
| fragment-only title | 1 | 200 | the cited string is the tail `: submission preserves ...` of a computed description |
| wrong subject kind or wrong command | 2 | 209 (2) | a template-subject fault injection and a recheck-job test cited for pattern activate and schedule |

### FIX (69)

| class | n | criteria |
|---|---:|---|
| computed description cited under the include or helper file; the entrypoint `.sql` owns it | 63 | 211 (27), 214 (23), 201 (5), 189 (4), 194 (3), 193 (1) |
| first literal of a `\|\|` concatenation (the cited string is not a description anything emits): full text and entrypoint given in `fix` | 4 | 197 (2), 204, 207 |
| existing citation kept only as corroboration (does not close the clause) | 2 | 128 (clauses 1 and 2) |

The 63 file fixes are the same defect: `s12pd_refused('label', ...)`, `s12pu_refused`, `s12rs_pure`, `s12rs_check`, `s12pc_check`, `brs_refused` or a
`label || ': ...'` loop emits the description, while the lane cited the `.sqlinc` that defines the helper or holds the call. For a computed description the
owner is the entrypoint `.sql` that runs the label (receipts owner rule: a whole SQL literal belongs to the file holding it, anything else to the entrypoint).
Each entry carries the replacement path in `fix`; the title is unchanged. A fifth fragment (AC-200) is a DROP.

### The lane's own five weakest citations and five doubtful existing citations (verdicts)

| item | verdict |
|---|---|
| 1. AC-137 `taxonomy_terms_canonical.sql:213` (`per former` no_match) | DROP. It holds with or without whitespace collapse, and collapse is unobservable in Phase 2 (`facet_code` has no space); the part is split off uncited |
| 2. `x-slo-tier` parity assertions (AC-162, 168, 174, 180) | DROP where the label is the only citation of the clause (162, 168); where the clause also holds proven parts (127, 174, 180, 186) the citations stay KEEP and the `Tier` fragment is split off uncited |
| 3. AC-142 `governed_schedule/010-setup.sqlinc:54-61` (four `has_function` checks for `exactly two RPCs`) | KEEP as existence evidence only. No inventory assertion proves `exactly two`. This entry is in the block written before the interruption and was left unchanged; treat it as a known residual |
| 4. `075-digest-locks.sqlinc` (AC-193, 208, 209) | KEEP in AC-193 (template activate reaches the digest recompute) and in AC-208 (supporting; invocation, not outcome); DROP in AC-209 (the case is a template review, the clause is about patterns) |
| 5. AC-126 `taxonomy-definition-write.test.ts:76-85` (null session is 401) | KEEP, narrow: only the null-session guard of the human-session check is exercised |
| also: AC-182 `taxonomy-pages.test.ts:80` (page wiring by source text) | DROP |
| AC-128 clause 1, `exact catalog code TAXONOMY_NOT_FOUND` (existing) | FIX: corroboration only. The token the SQL raises is `NOT_FOUND`; I also DROPped a worse existing citation in the same clause (it drives the versions route) |
| AC-128 clause 2, `exact catalog code TAXONOMY_VERSION_CONFLICT` (existing) | FIX: corroboration only (SQL raises `CONFLICT` and `IDEMPOTENCY_MISMATCH`) |
| AC-161 clause 0, tenure not yet started (existing) | KEEP, acknowledged as one membership failure mode of several (pending, ended and foreign-party states are untested) |
| AC-161 clause 3, generic no-direct-grant sweep (existing) | KEEP: the doubt is rejected, the sweep is the proof the clause asks for |
| AC-207 clause 1, preflight `template_not_active` versus `WITHDRAWN` (existing) | KEEP both existing citations: the literal `WITHDRAWN` belongs to the resolver; both consumer tests flip the state by labelled SQL rather than by the governed retire, a stronger end-to-end case is optional |

## 3. Criteria whose status changed (33)

### 3.1 Lane `verified`, now `partial` (11): real over-claims

| AC | uncited part after my split | why |
|---|---|---|
| 127 | `Tier 2` | only `x-slo-tier = tier_2` is asserted; no benchmark (BE00:655, AC-279) |
| 137 | `whitespace collapse` | unobservable in Phase 2 (`facet_code` grammar has no space); the lane's test passes with no collapse at all |
| 150 | `every other role` EXECUTE revoked; the stated caller set | four named roles are not an owner-only check; Shard 04 delivery projection and editorial read callers are unbuilt or unasserted |
| 162 | `Tier 2` (clause 4) | class label only |
| 168 | `Tier 2` (clause 5) | class label only |
| 173 | key resolution scoped to the caller's owner (pattern latest read) | no second real owner reads a key only the first owner holds; only the hidden-party case exists |
| 174 | `the Tier 2 target` | class label only |
| 176 | consumption `at /app/cms-content-modeling/patterns/:patternKey` | no render or real-route test; the lane's own limitation says so |
| 179 | `a caller without the capability is 403` | no Worker test for the versions read (the lane records the same gap as the blocking limit of AC-181) |
| 180 | `the Tier 1 p95 < 750 ms target` | class label only; held uncited in AC-133 by the lane; one add was also the wrong route |
| 182 | consumption `at /app/cms-content-modeling/taxonomies/:taxonomyId` | route-level; source-text test dropped |

If root decides that a declared tier class proves a bare `Tier N` label (question 1 in section 5), 127, 162, 168, 174 and 180 return to verified (the Tier fragment is
their only gap); 186 stays partial because of its acting-context part.

### 3.2 Lane `unverified`, now `partial` through a verbatim split (21)

Not downgrades: the lane could not credit these because the guard cannot represent a partly proven clause. `parts` and `partCitations` in the JSON give the exact
tiling; unsplit they stay `unverified`.

| AC | uncited part(s) |
|---|---|
| 143 | nine-condition fire-time monolith: subject hash, policy basis, canonical provider, grant end by `valid_through` have no test |
| 144 | `every other role` revoked; re-derived authority (`valid_through`, MFA) |
| 145 | `FOR UPDATE SKIP LOCKED` claim |
| 146 | `canonical_source_unavailable` at fire time; `prior active version intact` |
| 147 | atomicity under a fault; `canonical_source_unavailable`; `valid_through` and MFA |
| 148 | gate tied to the resolver; Shard 04 delivery projection (unbuilt) |
| 152 | Shard 04 delivery projection (unbuilt); gate-to-resolver tie |
| 155 | callers (Shard 04 projection, Slice 11 related recheck) unbuilt; `every other role` |
| 158 | callers unbuilt |
| 181 | Worker 403 on the versions read; the 422 member (undriven) |
| 186 | `acting context` binding of the cursor; `Tier 1 p95 < 750 ms` |
| 187 | `expired` cursor (only a forged expiry, a signature failure, is tested) |
| 189 | SQL CHECK on `cms_pattern_versions.pattern_key` for context, versions, new (only `selector` is inserted) |
| 190 | pattern lookups with a second real owner; selectors |
| 191 | pattern partial unique index predicate (existence only) |
| 195 | activation makes the definition immutable (active rows untested); lifecycle columns advance only through the RPCs (no direct-UPDATE refusal) |
| 198 | taxonomy and pattern policy bases; sort tie-breaks; first-appearance order and the 16 bound |
| 199 | compatibility resolver at template submit; stored-versus-recomputed digest |
| 201 | `content_type` dependency freeze for a taxonomy; draft gate |
| 202 | `canonical_domain` selection by the recheck |
| 205 | lost-race `activation_conflict` (needs a two-session schedule) |

### 3.3 Lane `partial`, now `verified` (1)

AC-207: the lane's gap (retire owner capability and concealment untested) does not exist. `095-retire.sqlinc:92-102` asserts, on the active `ga1`, STEP_UP_REQUIRED for
a missing, stale or future step-up, NOT_FOUND for a cross-owner caller, `capability_missing` for an assigned reviewer, VERSION_MISMATCH for stale and future
review versions, and the reason bounds, with all stores identical afterwards (`:103-104`). Cited in `missedTests`; with it clause 0 is complete.

### 3.4 Still `unverified` (7)

194 (safe-projection-only consumption and no-mutation on success are unasserted; duplicate and unreachable references only in the unused TypeScript
reference), 196 (no test asserts the five governed tables, the `(subject_kind, subject_id)` key, the closed subject kind set or the 03a/03b separation),
197 (the audit record of a rejection-driven return to draft is not asserted), 200 (pattern submit: draft gate, nested-pattern state, compatibility,
digest and the block and content_type dependency kinds are unasserted; the only guard is a source-text regex), 208 (template activate and schedule: no
failing compatibility resolver, no changed digest), 209 (pattern activate and schedule: no changed nested state or digest), 210 (taxonomy activate
and schedule: lost provider is only mapped by the Worker from a stubbed token).

## 4. The ten most serious findings

1. **68 citations would not resolve as written (mechanical, mandatory).** 63 computed pgTAP descriptions in criteria 189, 193, 194, 201, 211 and 214 name
   the `.sqlinc` that defines the helper or holds the call instead of the entrypoint that owns the description, and 5 titles in 197 (2), 200, 204 and 207
   are only the first literal of a `||` chain or the tail of a computed description (`... the subject back to draft,` stops before `one audit record and
   status 409 [P2-S12-AC-074]`). Replacements are in the JSON. Risk if ignored: the collector finds no receipt for them.
2. **Eleven of the 47 `verified` criteria are over-claims** (127, 137, 150, 162, 168, 173, 174, 176, 179, 180, 182): in each, one named obligation has no test
   (table 3.1). The same four patterns the lane treated as gaps elsewhere were proposed clean here.
3. **A bare `Tier N` label was cited as a latency target** (127, 162, 168, 174, 180, 186). The only assertion is `x-slo-tier` or a registry value equal to a
   fixture; BE00:655 makes Tier 2 an API p95 < 1,200 ms and Tier 1 p95 < 750 ms, and AC-279 (the benchmark) is unverified. The reviewed ledger left the identical
   Tier 2 clause uncited in AC-073, AC-079, AC-085 and AC-121, and the lane left the Tier 1 clause uncited in AC-133.
4. **Route-level consumption was cited with source-text, loader and component tests** (129, 176, 182). `taxonomy-pages.test.ts` reads the `.astro` file and
   asserts it contains JSX text (3 DROPs); no Playwright spec or render test exists for the taxonomy or pattern pages, so `consumed ... at /app/...:param`
   stays uncited. AC-188 names no route and is accepted at component level.
5. **Cross-owner concealment is untested for patterns and for selectors** (173, 190, 132). The `hidden-owner` and `latest-hidden-owner` cases have the actor
   of a non-member name the first owner's party; no case has a second real owner acting for its own party create, read or request a successor of a key only
   the first owner holds (`030-refusals.sqlinc:41-46`, `080-latest-read.sqlinc:47-49`). The only foreign-owner vocabulary in the selector world is a draft
   (`s12tt_vocab('vo', ..., false, ...)`). For templates and taxonomies the property is proven on the real stack; a pattern or selector lookup that forgot
   the owner would pass every test.
6. **`cmsTaxonomyTermsRead` cursor: query binding is proven, actor and party binding and natural expiry are not** (186, 187). The query hash includes `actorId`
   and `actingPartyId` (migration `20261014120600:95-96`), yet `030-terms-read-pages.sqlinc` varies only limit, filter, vocabulary, a forged key and a
   forged `expiresAt` (a signature failure). The selector has the other-actor case (`060-selector-pages-authority.sqlinc:33`); the terms read does not.
7. **Worker-level seams are missing for the versions read and the create route** (128, 179, 181). No Worker test answers a capability 403 for
   `cmsTaxonomyVersionsRead`; an existing citation of AC-128 (`preserves hidden 404 ...`) requests the versions path, not CMS-03C-16 (DROP); the
   catalog-code tests feed `P0001/TAXONOMY_NOT_FOUND`, which no migration raises (FIX: corroboration only). The lane proposed AC-179 verified while recording
   the same gap as the blocking limit of AC-181.
8. **Activation and scheduling refusals rest on adjacent evidence** (205, 208, 209, 210, and the fire-time family 143 to 147). Nothing exercises the lost-race
   `activation_conflict`; the template compatibility resolver and a really changed digest at activate or schedule; a pattern's nested state or digest at activate
   or schedule; a taxonomy provider lost before activate or schedule; or the fire-time re-reads (subject hash, policy basis, canonical provider, grant end by
   `valid_through`, MFA, `SKIP LOCKED`, atomicity under a fault). The lane's citations for 209 were a template-subject fault injection and a recheck-job test
   (both DROP).
9. **The lane's gap list is not reliable in either direction.** AC-207's gap does not exist (3.3). It missed positive evidence: the block-dependency freeze of
   AC-199 (`governed_recheck/050-block.sqlinc:25-30`), placement-level re-validation of cycle and node bounds for AC-211 (`pattern_placement/065-defensive.sqlinc`;
   its depth bound is 128 levels, not 8), the exhaustive 15-column immutability loop for taxonomies in AC-195 (`080-schema-guards.sqlinc:59-75`), the expanded-tree
   block rules in AC-211 (`030-nested.sqlinc`). It missed sub-obligations that no test covers: pattern CHECK and index predicate (189, 191), selector scoping
   (190), definition-field breadth and the lifecycle-column write path (195), policy-basis-only difference in the recheck (203, note), `again before publish` (211).
10. **Spec and implementation disagree in places that need an owner decision, not a test.** AC-132 and AC-134: an absent vocabulary is an empty 200 page, not
    a 404 (`050-selector.sqlinc:74-76`). AC-138 and AC-141: the activation preflight is not a caller of the canonical matcher (the only caller outside its
    migration is `cms_term_overlap_check`, `20261014120200:184`). AC-205: the clause says the subject `version` + 1, DEC-188 made the definition `version`
    immutable and advances `lifecycle_version`. The ledger limitation `Not built: ... has no route, RPC or contract yet` is stale for AC-184 to AC-192.

## 5. Policy questions for root (the lane's inconsistency is cross-lane)

1. **Tier labels.** Does a registry or OpenAPI declaration of `tier_N` prove a clause that says `the Tier N p95 target`? I said no (benchmarks are AC-279). A yes returns 127, 162, 168, 174 and 180 to verified
   (the Tier fragment is their only gap) and removes the Tier fragment from 186.
2. **`every other role has EXECUTE revoked`.** Four named roles (PUBLIC, anon, authenticated, service_role) versus an owner-only check through `proacl` and
   `aclexplode`. I said the named roles do not prove `every other role` (138, 144, 150, 155).
3. **Route-level consumption** (`consumed by X at /app/...`): component and loader tests with fake reads, or a render or Playwright test? I required the latter (129, 176, 182).
4. **HTTP-mapping seam.** A Worker test with a stubbed token proves the mapping, not that the real database token reaches that route. I kept stubbed rows as
   supporting evidence when a pgTAP test asserts the real token, and treated the missing real-token case as a gap where no such test exists (128, 179, 181, 210).
5. **Owner file for computed pgTAP descriptions.** The entrypoint `.sql`, never the include. Also note: `populated-*.sql` files are standalone `.sql` files, so
   `pg_prove -r --ext .sql supabase/tests` runs them (infra/run-pgtap-verbose.mjs); they are not an identity problem, but the collector must run the full tree or
   name them. `pattern_definition/050-nested.sqlinc` is included by three entrypoints (`dec191_pattern.sql`, `governed_retire_pattern.sql`,
   `pattern_definition.sql`), so its descriptions occur three times in a full run (three citations in AC-211 rely on it).
6. **Splits of one-sentence criteria.** I recommended a split only where the proven and unproven parts fall on separators or `and`/`or` and the cited part
   is substantial (45 splits). Where the only cited fragment would be a bare list item I REJECTED the split and left the clause uncited (13 cases, e.g.
   AC-129, 141, 194, 200, 208, 209, 210). Root may prefer to author the missing tests instead; closures are named in each entry.

## 6. How to read the JSON

- `citations[]`: first the lane's `add` entries in their order within each `clauseIndex`, then `existing: true` judgements of ledger citations.
  `verdict` KEEP, DROP or FIX. `fix` is a replacement file path (same title), or `<entrypoint> :: <full description>` when the title changes, or null
  (two AC-128 existing entries; see `reason`).
- `splits[]`: `OK` carries `parts` (verbatim substrings that tile the clause; the text between parts matches the guard's separator pattern, checked by script)
  and `partCitations` (part index to the indices of the lane's `add` list of that clause that belong on that part; a part with no entry stays uncited).
  `REJECT` means no clean tiling: keep the clause whole and uncited until the named test exists.
- `missedTests[]`: `file` is the `.sqlinc` for a whole-literal description, the entrypoint `.sql` for a computed or concatenated one. Root should still verify
  identities against a full verbose TAP, as the brief says.
- `status`: the honest status after applying my recommended splits and adding `missedTests` where the note says so. `statusNote` states the unsplit or
  alternative status. The first 28 entries (AC-125 to AC-152) were written before a usage-limit interruption and were kept byte for byte on resume.
- One correction of my own, recorded for transparency: I first read the `075-digest-locks.sqlinc` activation case as a content-type subject and dropped it in
  AC-193; it is an approved template review, so it shows that template activation reaches the digest recompute (AC-193 now cites it for `template activate`;
  it is still no evidence for pattern activate, AC-209).

## 7. Checks run (all read-only) and results

| check | result |
|---|---|
| clause text verbatim against the ledgers; every split tiles the clause with the guard's separator pattern | 45 OK splits pass; the 13 REJECT have no tiling to check |
| vitest identities: 516 new citations against `vitest-all.json` and `uniq8.json` (full name, passed, occurrence 1); 32 apispec files are static identities | 0 failures |
| pgTAP: description is a whole literal, or a concatenated chain, or computed; owner file; entrypoint exists; duplicate descriptions in one entrypoint | 677 checked; 63 + 4 FIX; 1 FRAGMENT DROP; 0 duplicates; every cited `.sqlinc` has an entrypoint |
| non-passing or duplicated sibling tests in cited vitest files | 93 files, 0 problems |
| same test cited twice in one clause after refutation | 0 (the 3 duplicates of existing citations are DROPped) |
| a test that is the sole proof of a clause for more than 3 criteria (my KEEP set plus lanes a, b, d raw) | 0 |
| `missedTests` identities: 8 vitest against the run JSON; 45 pgTAP as literal, chain or computed by reading the helper | all resolve |
| line references in reasons against the test spans and description lines | spot-corrected in AC-184, 187, 203, 206, 208, 211; remaining differences are `it.each` table rows |
| first 28 entries identical to the pre-interruption file | identical |

Not done, by rule: no test or suite was executed, so no verdict here is a pass or fail claim about runtime behaviour; pgTAP titles that are computed were
derived from the helper source and the loop values, not from TAP output.

## 8. Per-criterion table

Columns: AC; lane status (V verified, P partial, U unverified); my status (`*` changed); new citations; KEEP/DROP/FIX; splits; missed gaps; missed tests.

| AC | lane | mine | new | K/D/F | splits | gaps | missed |
|---|---|---|---:|---|---|---:|---:|
| 125 | V | V | 8 | 8/0/0 | - | 0 | 0 |
| 126 | P | P | 16 | 16/0/0 | 1 split (2 parts) | 0 | 2 |
| 127 | V | P * | 19 | 18/1/0 | 1 split (2 parts) | 1 | 0 |
| 128 | P | P | 30 | 29/1/0 | 2 rejected | 2 | 1 |
| 129 | P | P | 13 | 11/2/0 | 1 rejected | 0 | 0 |
| 130 | V | V | 8 | 8/0/0 | - | 0 | 0 |
| 131 | V | V | 16 | 16/0/0 | - | 0 | 0 |
| 132 | P | P | 12 | 12/0/0 | 1 split (2 parts) | 2 | 0 |
| 133 | P | P | 11 | 11/0/0 | 1 split (2 parts) | 0 | 0 |
| 134 | P | P | 13 | 13/0/0 | 2 splits (4+3 parts) | 0 | 0 |
| 135 | V | V | 4 | 4/0/0 | - | 0 | 0 |
| 136 | V | V | 13 | 13/0/0 | - | 0 | 0 |
| 137 | V | P * | 11 | 10/1/0 | 1 split (5 parts) | 1 | 0 |
| 138 | P | P | 10 | 10/0/0 | 1 split (3 parts) | 1 | 0 |
| 139 | V | V | 9 | 9/0/0 | - | 0 | 0 |
| 140 | V | V | 11 | 10/1/0 | - | 0 | 0 |
| 141 | P | P | 16 | 16/0/0 | 1 rejected | 1 | 0 |
| 142 | V | V | 19 | 18/1/0 | - | 2 | 0 |
| 143 | U | P * | 10 | 10/0/0 | 1 split (9 parts) | 1 | 0 |
| 144 | U | P * | 5 | 5/0/0 | 1 split (6 parts) | 1 | 0 |
| 145 | U | P * | 9 | 9/0/0 | 1 split (4 parts) | 1 | 0 |
| 146 | U | P * | 11 | 11/0/0 | 1 split (8 parts) | 1 | 0 |
| 147 | U | P * | 9 | 9/0/0 | 1 split (11 parts) | 1 | 1 |
| 148 | U | P * | 8 | 8/0/0 | 1 split (6 parts) | 1 | 0 |
| 149 | V | V | 10 | 10/0/0 | - | 1 | 0 |
| 150 | V | P * | 7 | 7/0/0 | 1 split (5 parts) | 1 | 0 |
| 151 | V | V | 3 | 3/0/0 | - | 0 | 0 |
| 152 | U | P * | 13 | 13/0/0 | 1 split (7 parts) | 1 | 0 |
| 153 | V | V | 15 | 15/0/0 | - | 0 | 0 |
| 154 | V | V | 17 | 17/0/0 | - | 1 | 0 |
| 155 | U | P * | 8 | 8/0/0 | 1 split (5 parts) | 1 | 0 |
| 156 | V | V | 7 | 7/0/0 | - | 0 | 0 |
| 157 | V | V | 8 | 8/0/0 | - | 0 | 0 |
| 158 | U | P * | 11 | 11/0/0 | 1 split (8 parts) | 1 | 0 |
| 159 | P | P | 8 | 8/0/0 | 1 split (3 parts), 1 rejected | 1 | 0 |
| 160 | V | V | 2 | 2/0/0 | - | 0 | 0 |
| 161 | P | P | 8 | 7/1/0 | 2 splits (3+2 parts), 1 rejected | 2 | 0 |
| 162 | V | P * | 7 | 6/1/0 | - | 1 | 0 |
| 163 | V | V | 5 | 5/0/0 | - | 0 | 0 |
| 164 | P | P | 14 | 11/3/0 | 2 splits (2+2 parts), 1 rejected | 1 | 0 |
| 165 | V | V | 6 | 6/0/0 | - | 0 | 0 |
| 166 | V | V | 8 | 8/0/0 | - | 0 | 0 |
| 167 | V | V | 7 | 7/0/0 | - | 0 | 0 |
| 168 | V | P * | 10 | 9/1/0 | - | 1 | 0 |
| 169 | P | P | 8 | 8/0/0 | 1 split (2 parts) | 1 | 0 |
| 170 | V | V | 5 | 4/1/0 | - | 0 | 0 |
| 171 | V | V | 22 | 22/0/0 | - | 0 | 0 |
| 172 | V | V | 18 | 18/0/0 | - | 0 | 1 |
| 173 | V | P * | 20 | 20/0/0 | 1 split (3 parts) | 1 | 0 |
| 174 | V | P * | 21 | 21/0/0 | 1 split (2 parts) | 1 | 0 |
| 175 | V | V | 36 | 36/0/0 | - | 0 | 1 |
| 176 | V | P * | 23 | 23/0/0 | 1 split (3 parts) | 1 | 0 |
| 177 | V | V | 20 | 20/0/0 | - | 0 | 0 |
| 178 | V | V | 26 | 26/0/0 | - | 1 | 0 |
| 179 | V | P * | 18 | 18/0/0 | 1 split (5 parts) | 1 | 0 |
| 180 | V | P * | 15 | 14/1/0 | 1 split (2 parts) | 2 | 1 |
| 181 | U | P * | 15 | 15/0/0 | 1 split (5 parts) | 1 | 0 |
| 182 | V | P * | 14 | 13/1/0 | 1 split (4 parts) | 1 | 0 |
| 183 | V | V | 18 | 18/0/0 | - | 1 | 0 |
| 184 | V | V | 15 | 15/0/0 | - | 0 | 0 |
| 185 | V | V | 15 | 14/1/0 | - | 0 | 0 |
| 186 | U | P * | 13 | 13/0/0 | 1 split (4 parts) | 2 | 2 |
| 187 | U | P * | 23 | 23/0/0 | 1 split (3 parts) | 2 | 2 |
| 188 | V | V | 15 | 15/0/0 | - | 0 | 0 |
| 189 | U | P * | 29 | 25/0/4 | 1 split (3 parts) | 1 | 1 |
| 190 | U | P * | 18 | 17/1/0 | 1 split (3 parts) | 2 | 2 |
| 191 | U | P * | 22 | 21/1/0 | 1 split (2 parts) | 1 | 1 |
| 192 | V | V | 20 | 20/0/0 | - | 0 | 1 |
| 193 | P | P | 14 | 12/1/1 | 2 splits (2+5 parts) | 3 | 0 |
| 194 | U | U | 14 | 9/2/3 | 1 rejected | 3 | 0 |
| 195 | U | P * | 8 | 8/0/0 | 1 split (3 parts) | 3 | 18 |
| 196 | U | U | 0 | 0/0/0 | - | 2 | 0 |
| 197 | U | U | 22 | 20/0/2 | 1 rejected | 1 | 0 |
| 198 | U | P * | 7 | 7/0/0 | 1 split (7 parts) | 4 | 0 |
| 199 | U | P * | 4 | 3/1/0 | 1 split (4 parts) | 2 | 1 |
| 200 | U | U | 2 | 1/1/0 | 1 rejected | 4 | 4 |
| 201 | U | P * | 10 | 5/0/5 | 1 split (4 parts) | 3 | 0 |
| 202 | U | P * | 21 | 21/0/0 | 1 split (2 parts) | 1 | 0 |
| 203 | V | V | 20 | 20/0/0 | - | 1 | 0 |
| 204 | V | V | 13 | 11/1/1 | - | 0 | 0 |
| 205 | U | P * | 10 | 9/1/0 | 1 split (2 parts) | 1 | 3 |
| 206 | V | V | 15 | 15/0/0 | - | 0 | 1 |
| 207 | P | V * | 11 | 10/0/1 | - | 1 | 2 |
| 208 | U | U | 4 | 3/1/0 | 1 rejected | 2 | 1 |
| 209 | U | U | 2 | 0/2/0 | 1 rejected | 1 | 2 |
| 210 | U | U | 4 | 2/2/0 | 1 rejected | 2 | 0 |
| 211 | P | P | 42 | 15/0/27 | 1 split (3 parts) | 1 | 5 |
| 212 | V | V | 17 | 17/0/0 | - | 0 | 0 |
| 213 | V | V | 13 | 13/0/0 | - | 0 | 0 |
| 214 | V | V | 26 | 3/0/23 | - | 2 | 0 |

Legend: `*` = status changed from the lane's proposal. `K/D/F` counts the lane's new citations only.

## 9. Files

- Refutation: `docs/handoffs/2026-10-22-claude-s12/recite/c-refutation.json`, SHA-256 `3e9ba53f786b0e0bb789c02482c7c07b3cdd95ec860cea78e1321ba7ecea35ae` (90 entries, AC-125 to AC-214).
- This report: `docs/handoffs/2026-10-22-claude-s12/review-refute-c-report.md` (its SHA-256 is given in the hand-off message, not inside the file).
- Scratch (not in the repository): `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_refute_c/`
  (per-criterion `decisions/NNN.json`, `build.mjs` that regenerates the JSON, and the check scripts `crosscheck.mjs`, `sole2.mjs`, `missed-check.mjs`,
  `vt-all.mjs`, `dupkeep.mjs`, `multi-ep.mjs`, `lineref.mjs`, `sqlref.mjs`).
