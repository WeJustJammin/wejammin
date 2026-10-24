# Lane claude_s12_recite_b report

## Status
GREEN (proposals only). Read-only lane: no ledger, receipt, tracker, spec, test or product file was edited, and no supabase,
docker, db, race, Vitest or Playwright process was run. Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, HEAD
`b16edb54a7a1b698ed8ca15b6085046d4270626e` (read at the start; nothing committed or staged by this lane).

## Scope
Re-citation PROPOSALS for P2-S12-AC-080 .. AC-124 (45 criteria, 225 clauses) in
`docs/handoffs/2026-10-22-claude-s12/recite/b-proposals.json`, per `briefs/recite-proposals.md`.

## Files
| path | role |
|---|---|
| `docs/handoffs/2026-10-22-claude-s12/recite/b-proposals.json` | the proposals (45 entries, valid JSON, ~533 KB) |
| `docs/handoffs/2026-10-22-claude-s12/lane-recite-b-report.md` | this report |

Generators (scratch, not deliverables): `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_recite_b/`
(`lib.mjs` identity resolvers that COPY identities from the vitest JSONs and the pgTAP sources, `c/c0NN.mjs` one script per
criterion, `pgcat.mjs` pgTAP description catalog, `dupcheck.mjs`, `dupall.mjs`). Re-run `node c/c080.mjs` etc. to regenerate.

## Method (what was checked)
- All 276 EXISTING citations in the range were looked up in the merged vitest identities (`vitest-all.json`, with the eight
  late-changed files taken from `uniq8.json`): every one exists, passed, and is unique in its file. Stale existing: 0.
- Every proposed vitest citation was resolved by exact substring to ONE passed identity (copied, never typed).
- Every proposed pgTAP citation was taken from the `.sql`/`.sqlinc` source. A description that is one string literal is cited
  at the closure file that holds it (`computed:false`); a description built with `||` or by a helper at run time (the
  `s12pd_refused`, `s12pu_refused`, `s12pdf_check`, `s12df_check`, `s12puc_check`, `s12rs_pure`, `s12td_*` helpers, and
  `'...' || '...'` concatenations) is cited at the owning entrypoint `.sql` with `computed:true` and the derived title.
  Each computed title was checked against the helper template and the call label in the source.
- Checks run on the whole proposal set: no duplicate identity inside a clause; no test is the only citation of a clause in
  more than one criterion; no `#`, tab or newline inside a cited title; no cited vitest file hides a non-passing or
  duplicate test; no duplicated helper label inside a cited entrypoint (see Request 1 for the one duplicate pair found).
- Playwright and race citations: none proposed (no spec or race module proves a clause in this range).
- All pgTAP identities are `identitySource: static`; no verbose TAP exists yet, so none is proven passing.

## Counts
- Criteria by proposed status: **verified 30, partial 15, unverified 0** (current ledger status of the same 45: partial 36, unverified 9).
- Clauses: 225 original (16 are bare separator fragments, see below), 110 had no citation; **123 clauses or sub-clauses newly cited**.
- New citations proposed: **313 vitest, 483 pgTAP** (222 literal, 261 computed), 0 Playwright, 0 race (counted per clause).
- Gaps (named missing tests): **20 sub-clauses** in 15 criteria. By layer: pgTAP or race (database) 8; vitest/jsdom/Worker 4
  (+2 that are missing implementation as well as test); hosted performance measurement 6.
- Stale existing citations: **0**.
- Clause splits proposed: 20 clauses in 20 places (a sub-clause with no test needed its own clause so the guard can show
  it as uncited; see "Splits and separators").

### Per criterion (current status -> proposed; new cites; gap sub-clauses; notes)
| AC | now | proposed | new cites | gaps | notes |
|---|---|---|---|---|---|
| 080 | partial | verified | 21 | 0 |  |
| 081 | partial | verified | 13 | 0 |  |
| 082 | unverified | verified | 23 | 0 |  |
| 083 | partial | partial | 21 | 1 | 1 split 1 sep |
| 084 | partial | verified | 9 | 0 |  |
| 085 | partial | partial | 13 | 1 |  |
| 086 | partial | partial | 38 | 3 | 2 split |
| 087 | partial | verified | 15 | 0 |  |
| 088 | unverified | partial | 21 | 1 | 1 split |
| 089 | partial | verified | 6 | 0 |  |
| 090 | partial | verified | 9 | 0 |  |
| 091 | partial | partial | 4 | 1 | 1 split |
| 092 | partial | verified | 2 | 0 |  |
| 093 | partial | verified | 11 | 0 |  |
| 094 | unverified | verified | 15 | 0 |  |
| 095 | partial | partial | 15 | 1 | 1 split |
| 096 | partial | verified | 8 | 0 |  |
| 097 | partial | partial | 10 | 1 | 1 split |
| 098 | partial | verified | 10 | 0 |  |
| 099 | partial | verified | 12 | 0 |  |
| 100 | unverified | verified | 24 | 0 |  |
| 101 | partial | partial | 34 | 1 | 1 split |
| 102 | partial | verified | 17 | 0 |  |
| 103 | partial | partial | 18 | 2 | 1 split |
| 104 | partial | verified | 33 | 0 |  |
| 105 | partial | partial | 20 | 2 | 2 split |
| 106 | partial | verified | 12 | 0 |  |
| 107 | partial | partial | 16 | 2 | 2 split |
| 108 | partial | verified | 14 | 0 |  |
| 109 | partial | partial | 12 | 1 | 1 split |
| 110 | partial | partial | 10 | 1 |  |
| 111 | partial | verified | 9 | 0 |  |
| 112 | unverified | verified | 25 | 0 |  |
| 113 | partial | verified | 24 | 0 |  1 sep |
| 114 | unverified | verified | 33 | 0 | 1 split |
| 115 | partial | partial | 12 | 1 | 1 split |
| 116 | partial | verified | 6 | 0 |  |
| 117 | partial | partial | 23 | 1 | 2 split 4 sep |
| 118 | unverified | verified | 17 | 0 |  |
| 119 | partial | verified | 28 | 0 |  3 sep |
| 120 | unverified | verified | 27 | 0 |  2 sep |
| 121 | partial | verified | 21 | 0 | 1 split |
| 122 | partial | verified | 32 | 0 | 1 split 1 sep |
| 123 | partial | verified | 13 | 0 |  4 sep |
| 124 | unverified | verified | 40 | 0 |  |

## Gaps (every uncited sub-clause, with the missing test)
Database (pgTAP / race), 8:
- AC-083 "a recheck of the subject hash, the policy basis": no pgTAP drives activate/schedule with a changed subject hash or workflow-policy basis (only a superseded content-type dependency, `governed_activation/060:87-100`, and a faulted digest in the recheck JOB, `governed_recheck/075:69`). Needed in `governed_activation/060-invalidation.sqlinc`.
- AC-085 "takes its locks in the Slice 12 lock order": only the LAST position is source-oracled (`governed_activation/090`); no test observes positions 1,3,4,5 (BE03c 1501). pgTAP lock probe or a race module.
- AC-086 `activation_conflict`: the lost-race branch needs two sessions (file `090-lineage-lock.sqlinc` says so); only the Worker token mapping exists. Race module needed.
- AC-086 "a preflight failure" (422): the producer folds step-5 preflight differences into the `dependency_changed` invalidation; no 422 preflight branch exists or is tested at activation (owner reading of BE03c row 1410 vs the producer may be needed).
- AC-086 `canonical_source_unavailable` with `details.domain`: only the Worker mapping row; no pgTAP activates a taxonomy whose declared domain has no built provider (`governed_activation/080`).
- AC-101 "of the caller's owner scope" (compatibleTypeIds) and AC-107 "of a content type in the caller's owner scope" + "hidden" content type: no cross-owner content-type id case (`pattern_definition/040`, `pattern_selector/020`).
Vitest / jsdom / Worker, 4 (+2 implementation gaps):
- AC-088 "sorted by label then policy key" (policyBasis order): not enforced by the contract; the pgTAP re-sorts it itself.
- AC-095 "a body and any mutation header": no CMS-03C-11 queue case sends a body, Idempotency-Key or If-Match (the CMS-03C-10 detail route has them).
- AC-117 "never keeps a diff when degraded": no web test degrades a held diff.
- AC-105 "a cycle, depth or node-count refusal inline with the node path": the designer links the tree and candidate nested patterns because the server names no node (FE03 885 needs an owner reading or the SQL needs a node pointer).
- AC-105 "nested pattern nodes from CmsPatternSelector": `CmsPatternNestedPicker.tsx` is a permanently disabled placeholder (implementation + test missing).
- AC-110 "a client restarts from the first page after a cursor conflict": `use-composition-insert.ts` `loadMore` has no 409 branch (implementation + test missing).
Hosted performance measurement, 6 (same treatment as the Tier 2 targets of AC-056, no local test can prove a p95):
AC-091 (Tier 1 p95 < 750 ms), AC-097, AC-109, AC-115 (same), AC-103 twice ("target < 2 s", Tier 2 p95 < 1,200 ms).

## Splits and separators
- 16 bare separator clauses carry no assertion; they are marked `proposeRemoval` (the guard allows separators between clauses):
  AC-083#3, AC-113#3, AC-117#3/#5/#7/#9, AC-119#1/#3/#7, AC-120#1/#3, AC-122#3, AC-123#1/#3/#5/#7.
- 20 clauses are proposed as splits (`split` array; each sub-clause text is a verbatim in-order part of the clause, existing
  citations attach where `keepExisting` is true). Reason: a sub-condition without a test would otherwise hide inside a cited
  clause (the guard marks a clause cited when it has one citation): AC-083#2, 086#0, 086#1, 088#1, 091#2, 095#1, 097#4,
  101#1, 103#4, 105#1, 105#3, 107#0, 107#2, 109#4, 114#1, 115#3, 117#6, 117#10, 121#3, 122#0. Root may instead keep the
  original clause and set the status by hand; if so, clauses with a gap sub-part must NOT be marked verified.

## Weakest citations I still proposed (reviewers start here)
1. AC-087 clause 7 and AC-093 clause 5 / AC-099 clause 6 (meta "verification covers ..." clauses): carried by jsdom component tests plus database tests; no real-browser spec drives these pages or the step-up round trip.
2. AC-105 clause 0: `pattern-pages.test.ts` asserts the Astro source TEXT (`<CmsPatternVersionDesigner`, `client:load`), not a rendered route.
3. AC-085 clauses 2 and 4: `090-lineage-lock` shows the advisory lock held after a commit; the review-row lock is invisible from one session and "commits atomically" is shown only by switch, event and audit being present together (no fault injection).
4. AC-122 sub-clause "and an idempotency conflict": SQL `IDEMPOTENCY_MISMATCH` only (`060-effects` `i-mismatch`); no Worker test maps that token for CMS-03C-15. AC-089 clause 3 (existing, kept): composition of a contract bound test and a generic "fails strict schema -> 502" test; no oversized-array route test.
5. AC-084 clause 1 ("subject kind's owner capability"): positives for template designer and taxonomy curator, negatives for a reviewer and a revoked designer, but no wrong-kind capability negative (e.g. a designer on a taxonomy review).
Also: AC-106 clause 2 (`patternVersion DESC` cannot be told from ASC: one active version per key), AC-119 clause 5 `structure` kind (shown through the RESOLVE-01 resolver case and `rs-api-missing`, not a dedicated per-kind refusal).

## Spec citations
BE03c `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`: rows 168-185, 391-414, 1262-1268, 1410, 1457, 1479, 1501;
FE03 `.memory/wiki/specs/fe/03-cms-content-modeling.md`: 885, 1110, 1547. Migrations read for behaviour:
`20261014070400_cms_activate_governed_subject.sql`, `20261022030000_cms_governed_recheck_verdict.sql`,
`20261014020400_cms_create_pattern_version.sql`.

## Runs
None (read-only lane). No TAP, Vitest, Playwright or race output was produced by this lane.

## Test corrections
None.

## Open items / BOUNDARY
- Stale statements in the CURRENT ledger limitations that the proposals supersede: AC-110 ("CmsPatternSelector does not exist": it does, in `apps/web/src/components/cms-composition-instances/`); AC-111 ("composed route test under a bracketed [entryId] path the guard cannot cite": bracketed Astro paths are allowed, README); AC-082/088/094/100/112/118/124 ("held until root regenerates receipts": proposals cite them now).
- `CmsPatternNestedPicker.tsx` carries a stale BOUNDARY comment ("CMS-03C-13 Worker route and proxy are not built"); the route and the web selector exist. Not edited (read-only).

## Requests to root
1. **Duplicate descriptions in `governed_activation.sql`**: `the completed idempotency record stores status 200 [P2-S12-AC-086]` (030-activate.sqlinc:45 and 095-retire.sqlinc:150) and `an exact same-key replay returns the original response and writes no second event, audit record or state change [P2-S12-AC-086]` (030:53 and 095:163) are literal in two files of one entrypoint, so both become ambiguous receipts (occurrences 2) and the guard will flag every cited `governed_activation/030` and `/095` citation. Rename the 095 descriptions (test edit, outside this lane) or avoid citing those two files.
2. Run the pgTAP entrypoints in the proposals through `infra/run-pgtap-verbose.mjs` (`governed_assignment`, `governed_activation`, `governed_reads`, `pattern_definition`, `pattern_selector`, `pattern_update_diff`, `pattern_updates`, `dec193_diff`, `dec193_resolution`, `taxonomy_definition`) before applying: every computed title (helper label + suffix) must be matched against real TAP; a mismatch means a missing receipt, not a failed test.
3. Decide the split/removal policy (above) before applying; the guard needs the clause texts to tile the claim.
4. Owner readings for AC-086 "a preflight failure" (422) and AC-105 "inline with the node path" (the server names no node).
