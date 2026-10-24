# Lane report: claude_s12_evidence_cite (2026-10-22)

## Status

PARTIAL. The Slice 12 guard exists and is red for the expected reason (no receipts). 457 Vitest and
Playwright citations were added across 105 entries, 184 clauses are newly cited, and 61 entries moved
from `unverified` to `partial`. A further 171 citations that would make 39 entries fully cited are
held in `lane-evidence-cite-held.json` (the lane may not set `verified`, and the guard rejects a
`partial` entry whose every clause is cited). No status was set to `verified`, no claim or clause text
was changed, no pgTAP or race citation was added, no receipt was created or edited.

Result: 9 verified, 127 partial, 0 contract-only, 160 unverified of 296 (before: 9 / 66 / 0 / 221).
Cited clauses 261 -> 445 of 943; citation occurrences 647 -> 1,104; distinct cited tests 353 -> 759.

## Scope

- Created `tests/contracts/phase-02-slice-12-evidence-guard.test.ts` (same `defineSliceEvidenceGuard`
  call as Slice 11, slice `12`, `contractOnly: null`, 296 criteria, `maxSoleProof: 3`).
- Re-cited Vitest and Playwright layer clauses in the five fragments, with updated limitations on every
  entry that gained or holds a citation. Fragments keep their five-file split and exact ID order; the
  existing fragments were already 1.4k-4.9k lines and no size test covers them, so no split was made.
- Method: for each of the 682 uncited clauses, every vitest/playwright candidate of the intake
  classification was opened (assertion read, not the title), its exact identity was matched against a
  current run (`report1`: 263 files, 4,266 tests, regenerated for the candidate files and every test file
  newer than the classification) or, for `.apispec.ts`, against `vitest list --config
vitest.postgrest.config.ts` (collected, not executed), and for Playwright against `playwright test
--list`. Tests added by today's lanes (web locale and composition, DEC-205/206 reads, governed-recheck
  Worker) were swept by test title and AC tag; observability files were not touched.
- Rules applied (consistent across all 105 entries): a clause is cited only when the cited tests assert
  the clause at their layer; a Worker/adapter test that relays a stubbed refusal proves a MAPPING clause
  but not a DECISION clause (scope, concealment, owner rules); a clause that bundles pgTAP-only facts, a
  Tier 1/Tier 2 latency target without a benchmark, or a signed cursor is left uncited; monolithic
  single-clause entries are cited only when Vitest proves the whole sentence.

## Files

| Path                                                                    | Lines | SHA-256                                                            |
| ----------------------------------------------------------------------- | ----: | ------------------------------------------------------------------ |
| `tests/contracts/phase-02-slice-12-evidence-guard.test.ts`              |    12 | `629bf0680fda0d97d9936904a2a8950ecc366d8327053b4302a50e85174a72f5` |
| `tests/contracts/phase-02-slice-12-evidence-ledger-001-071.ts`          |  5011 | `8dc58f88fba82c92c64be6534817d8adf10690618ba51a73af18ae41cc86c064` |
| `tests/contracts/phase-02-slice-12-evidence-ledger-072-142.ts`          |  4709 | `ede6934a42df7e7411ff852b2f4a5e8fcb740aef6d4f53faea7cc4c98b01c31e` |
| `tests/contracts/phase-02-slice-12-evidence-ledger-143-213.ts`          |  2050 | `b75699af042326d65b6d36165ade371b7d20976b7e264306270540f25e0ca972` |
| `tests/contracts/phase-02-slice-12-evidence-ledger-214-285.ts`          |  1469 | `58dfcb0a8da400fb5785523b925576f6b48ab951cb47905d0010aa6a5c8c39cb` |
| `tests/contracts/phase-02-slice-12-evidence-ledger-286-296.ts`          |   190 | `31aacb73383415c01ff58d7a3f8303bffb986de3e25633cefea2ce3d0c50355b` |
| `docs/handoffs/2026-10-22-claude-s12/lane-evidence-cite-held.json`      |  1368 | `cb4526d6eedc85d9b1fb16c2a2b20a06d3e77ce465c08e6bb99deaf297a05977` |
| `docs/handoffs/2026-10-22-claude-s12/lane-evidence-cite-apply-held.mjs` |   118 | (see final message)                                                |
| `docs/handoffs/2026-10-22-claude-s12/lane-evidence-cite-rejections.md`  |  1434 | `d9f5135ad5c7ddeef48c3b79067b60b79575885d2273e52370681d2a611ecd3a` |

## Counts

- Citations added: 457 (vitest 450, of which 5 are `.apispec.ts` real-stack cases; playwright 2), spread over 105 entries; 184 clauses newly cited.
- Entries moved unverified -> partial: 61 (AC-072..075, 077, 079..081, 083..087, 089..093, 095..099,
  101..111, 113, 115..117, 119, 121..123, 125..137, 140..142, 238, 240, 291).
- Citations held (not applied): 171 across 53 clauses in 30 entries, plus 9 ambiguous-identity
  citations withheld (listed in `blockedAmbiguous`).
- Candidates: 923 vitest/playwright candidate rows were dispositioned: 321 cited, 141 held, 430
  rejected with a reason, 31 not selected (full list: `lane-evidence-cite-rejections.md`).
- Sole-proof rule: no citation is the only proof of a clause for more than 3 criteria (checked with the
  guard library; zero such problems).

### Per-criterion

| Criterion | Status before -> after | Citations added | Clauses newly cited | Citations held | Withheld (ambiguous) |
| --------- | ---------------------- | --------------: | ------------------: | -------------: | -------------------: |
| AC-004    | partial                |               0 |                   0 |              2 |                    0 |
| AC-005    | partial                |               0 |                   0 |              4 |                    0 |
| AC-006    | partial                |               0 |                   0 |              1 |                    0 |
| AC-008    | partial                |               0 |                   0 |              2 |                    0 |
| AC-010    | partial                |               5 |                   2 |              0 |                    0 |
| AC-011    | partial                |               0 |                   0 |              3 |                    0 |
| AC-013    | partial                |               1 |                   1 |              0 |                    0 |
| AC-014    | partial                |               0 |                   0 |              6 |                    0 |
| AC-017    | partial                |               1 |                   1 |              0 |                    0 |
| AC-019    | partial                |               1 |                   1 |              0 |                    0 |
| AC-020    | partial                |               0 |                   0 |              6 |                    0 |
| AC-022    | partial                |               0 |                   0 |              3 |                    0 |
| AC-025    | partial                |               0 |                   0 |              3 |                    0 |
| AC-027    | partial                |               2 |                   1 |              0 |                    0 |
| AC-028    | partial                |               2 |                   1 |              0 |                    0 |
| AC-033    | partial                |               0 |                   0 |              1 |                    0 |
| AC-037    | partial                |               2 |                   1 |              0 |                    0 |
| AC-054    | partial                |               0 |                   0 |              3 |                    0 |
| AC-055    | partial                |               1 |                   1 |              0 |                    0 |
| AC-057    | partial                |               0 |                   0 |              4 |                    0 |
| AC-059    | partial                |               0 |                   0 |              2 |                    0 |
| AC-062    | partial                |               5 |                   1 |              0 |                    0 |
| AC-070    | unverified             |               0 |                   0 |              9 |                    0 |
| AC-071    | unverified             |               0 |                   0 |              8 |                    0 |
| AC-072    | unverified -> partial  |               6 |                   3 |              0 |                    0 |
| AC-073    | unverified -> partial  |               3 |                   1 |              0 |                    0 |
| AC-074    | unverified -> partial  |              26 |                   9 |              0 |                    0 |
| AC-075    | unverified -> partial  |              10 |                   5 |              0 |                    0 |
| AC-076    | unverified             |               0 |                   0 |              7 |                    0 |
| AC-077    | unverified -> partial  |               2 |                   2 |              0 |                    0 |
| AC-079    | unverified -> partial  |               2 |                   1 |              0 |                    0 |
| AC-080    | unverified -> partial  |               8 |                   2 |              0 |                    0 |
| AC-081    | unverified -> partial  |               8 |                   6 |              0 |                    0 |
| AC-082    | unverified             |               0 |                   0 |             13 |                    0 |
| AC-083    | unverified -> partial  |               1 |                   1 |              0 |                    0 |
| AC-084    | unverified -> partial  |               5 |                   2 |              0 |                    0 |
| AC-085    | unverified -> partial  |               1 |                   1 |              0 |                    0 |
| AC-086    | unverified -> partial  |               9 |                   2 |              0 |                    0 |
| AC-087    | unverified -> partial  |              17 |                   7 |              0 |                    0 |
| AC-088    | unverified             |               0 |                   0 |              9 |                    0 |
| AC-089    | unverified -> partial  |               6 |                   3 |              0 |                    0 |
| AC-090    | unverified -> partial  |               1 |                   1 |              0 |                    0 |
| AC-091    | unverified -> partial  |               6 |                   2 |              0 |                    0 |
| AC-092    | unverified -> partial  |              15 |                   3 |              0 |                    0 |
| AC-093    | unverified -> partial  |              15 |                   5 |              0 |                    0 |
| AC-094    | unverified             |               0 |                   0 |              5 |                    0 |
| AC-095    | unverified -> partial  |               3 |                   1 |              0 |                    0 |
| AC-096    | unverified -> partial  |               1 |                   1 |              0 |                    0 |
| AC-097    | unverified -> partial  |               4 |                   2 |              0 |                    0 |
| AC-098    | unverified -> partial  |               5 |                   1 |              0 |                    0 |
| AC-099    | unverified -> partial  |              13 |                   6 |              0 |                    0 |
| AC-100    | unverified             |               0 |                   0 |             11 |                    0 |
| AC-101    | unverified -> partial  |              11 |                   4 |              0 |                    0 |
| AC-102    | unverified -> partial  |               5 |                   3 |              0 |                    2 |
| AC-103    | unverified -> partial  |               6 |                   2 |              0 |                    0 |
| AC-104    | unverified -> partial  |              14 |                   4 |              0 |                    2 |
| AC-105    | unverified -> partial  |               5 |                   2 |              0 |                    0 |
| AC-106    | unverified -> partial  |               7 |                   2 |              0 |                    0 |
| AC-107    | unverified -> partial  |               6 |                   1 |              0 |                    0 |
| AC-108    | unverified -> partial  |               5 |                   2 |              0 |                    1 |
| AC-109    | unverified -> partial  |               6 |                   3 |              0 |                    0 |
| AC-110    | unverified -> partial  |              12 |                   3 |              0 |                    0 |
| AC-111    | unverified -> partial  |               6 |                   4 |              0 |                    0 |
| AC-112    | unverified             |               0 |                   0 |              9 |                    0 |
| AC-113    | unverified -> partial  |               4 |                   2 |              0 |                    0 |
| AC-115    | unverified -> partial  |               5 |                   3 |              0 |                    0 |
| AC-116    | unverified -> partial  |              13 |                   2 |              0 |                    0 |
| AC-117    | unverified -> partial  |              10 |                   5 |              0 |                    0 |
| AC-118    | unverified             |               0 |                   0 |              8 |                    0 |
| AC-119    | unverified -> partial  |              12 |                   3 |              0 |                    0 |
| AC-121    | unverified -> partial  |               4 |                   1 |              0 |                    0 |
| AC-122    | unverified -> partial  |              11 |                   1 |              0 |                    0 |
| AC-123    | unverified -> partial  |              16 |                   6 |              0 |                    0 |
| AC-124    | unverified             |               0 |                   0 |              7 |                    0 |
| AC-125    | unverified -> partial  |               8 |                   6 |              0 |                    0 |
| AC-126    | unverified -> partial  |               5 |                   3 |              0 |                    1 |
| AC-127    | unverified -> partial  |               7 |                   1 |              0 |                    0 |
| AC-128    | unverified -> partial  |               7 |                   4 |              0 |                    1 |
| AC-129    | unverified -> partial  |               7 |                   3 |              0 |                    0 |
| AC-130    | unverified -> partial  |               6 |                   2 |              0 |                    0 |
| AC-131    | unverified -> partial  |               5 |                   2 |              0 |                    0 |
| AC-132    | unverified -> partial  |               4 |                   2 |              0 |                    0 |
| AC-133    | unverified -> partial  |               4 |                   3 |              0 |                    0 |
| AC-134    | unverified -> partial  |               8 |                   2 |              0 |                    2 |
| AC-135    | unverified -> partial  |              13 |                   6 |              0 |                    0 |
| AC-136    | unverified -> partial  |               4 |                   3 |              0 |                    0 |
| AC-137    | unverified -> partial  |               2 |                   1 |              0 |                    0 |
| AC-140    | unverified -> partial  |               1 |                   1 |              0 |                    0 |
| AC-141    | unverified -> partial  |               1 |                   1 |              0 |                    0 |
| AC-142    | unverified -> partial  |               7 |                   3 |              0 |                    0 |
| AC-159    | partial                |               2 |                   1 |              0 |                    0 |
| AC-164    | partial                |               2 |                   1 |              0 |                    0 |
| AC-165    | partial                |               0 |                   0 |              2 |                    0 |
| AC-166    | partial                |               0 |                   0 |              6 |                    0 |
| AC-167    | partial                |               0 |                   0 |              2 |                    0 |
| AC-169    | partial                |               7 |                   3 |              0 |                    0 |
| AC-170    | partial                |               3 |                   1 |              0 |                    0 |
| AC-171    | unverified             |               0 |                   0 |             11 |                    0 |
| AC-175    | unverified             |               0 |                   0 |              9 |                    0 |
| AC-176    | unverified             |               0 |                   0 |             10 |                    0 |
| AC-177    | unverified             |               0 |                   0 |              5 |                    0 |
| AC-238    | unverified -> partial  |               5 |                   2 |              0 |                    0 |
| AC-240    | unverified -> partial  |               2 |                   1 |              0 |                    0 |
| AC-281    | partial                |               1 |                   1 |              0 |                    0 |
| AC-291    | unverified -> partial  |               1 |                   1 |              0 |                    0 |
| **Total** |                        |         **457** |             **184** |        **171** |                **9** |

## Guard: current failure classes (`phase-02-slice-12-evidence-guard.test.ts`)

Run: `pnpm exec vitest run tests/contracts/phase-02-slice-12-evidence-guard.test.ts --reporter=verbose`.
3 of 5 tests pass (criteria order and count, count report, contract-only range). Two fail:

1. `backs every claim with a fresh passing receipt ...`: 759 problems, all in four classes:
   a. **No receipt** (758): 616 vitest, 137 pgTAP (pre-existing citations), 5 playwright. Cleared by
   `node scripts/evidence/run-slice-evidence.mjs --slice 12` (root, shared stack) then the collector.
   b. **Citation path charset** (1, pre-existing): AC-059 cites
   `apps/web/src/pages/api/v1/cms/entries/[entryId]/related-content.test.ts`; `[` and `]` are outside
   the guard's path charset, so no file under a bracketed Astro directory can be cited. See request 2.
   c. Not yet visible, will appear once receipts exist: **duplicated identities** in 8 cited files (21
   identities, listed below) and the flaky test noted below.
   d. No sole-proof, shape, tiling, status or limitation problems.
2. `has receipts only when the ledger cites tests`: `tests/contracts/phase-02-slice-12-receipts.generated.jsonl`
   is missing (expected until root generates receipts).

Meta suites run and green: `phase-02-slice-12-ledger-inventory`, `phase-02-slice-12-unit-citation-reconciliation`,
`tests/documentation-boundaries.test.ts`, `node scripts/check-progress-consistency.mjs --quiet` (exit 0),
`prettier --check` and `eslint` on the guard and all five fragments, and an isolated `tsc` of the ledger
(no ledger errors). The Slice 10 and Slice 11 guards are red only on stale pgTAP closure hashes from
the repair-b lane, unrelated to this lane.

## Findings that need a decision

1. **Spec/code drift, AC-169 clause 9.** The clause says a safe read "retries at most three times at
   15 s, 60 s and 300 s with jitter"; the client retries twice at 250 ms then 750 ms (FE03 :1173).
   Left uncited.
2. **Clauses that cannot be proven as tiled.** The bare separators `;`, `,` and `, and` are clauses in
   AC-028, 083, 113, 117, 119, 120, 123, 238 and others; no test can carry them. Re-tiling is allowed
   ("only separators and the words and/or may sit between clauses") and would let those entries close.
3. **Monolithic UI clauses** (one clause for a whole sentence of ~14 obligations): AC-045, 048, 063,
   069, 075 (partly split), 285 and the page criteria 265-270. jsdom tests cover most obligations but a
   single citation set cannot be held to the whole sentence; per-obligation clauses (as AC-042 and
   AC-087 have) would let them be cited honestly.
4. **Stale limitations on untouched entries.** Only entries that gained or hold a citation had their
   limitation rewritten. Many untouched `unverified` entries still say "not built" for behaviour that
   now exists (see the intake report headline finding).
5. **Observability and recheck.** AC-051, 052, 263, 264 (metrics, owned by the observability lane) and
   AC-202/203 (governed recheck; Vitest proves the producers and the strict job contract, but the
   clause also names synchronous revocation invalidation and the RPC) were not cited.

### Duplicated identities in cited files (must be made unique before receipts can pass)

A receipt for a title that occurs more than once in a file is ambiguous, and a cited file may not hide a
duplicate. These come from `it.each` rows whose parameters share a title:

- `apps/web/src/components/cms-governed-review/CmsGovernedActivationForm.recovery.test.tsx`
  - x2: retirement refuses an invalid reason inline, sending nothing
- `apps/web/src/components/cms-governed-review/governed-review-command-failures.test.ts`
  - x3: sendGovernedCommand failures carries the registered 409 reason GOVERNED_REVIEW_VERSION_CONFLICT
- `apps/worker/src/cms-composition/governed-review-decision-input.test.ts`
  - x4: CMS-03C-07 strict input (422 body, 400 transport) before any quota names /reason for an invalid member
  - x2: CMS-03C-07 strict input (422 body, 400 transport) before any quota names /expectedVersion for an invalid member
- `apps/worker/src/cms-composition/governed-review-reads.test.ts`
  - x2: CMS-03C-11 review queue (BE03c row 173) names /limit for an out-of-bounds value with 422
- `apps/worker/src/cms-composition/pattern-definition-admission.test.ts`
  - x2: CMS-03C-12 and cmsPatternLatestRead Worker admission uses real resolver authority bound to the original Request
  - x2: CMS-03C-12 and cmsPatternLatestRead Worker admission refuses a foreign Origin before authentication
  - x2: CMS-03C-12 and cmsPatternLatestRead Worker admission requires an acting party even for a designer
  - x2: CMS-03C-12 and cmsPatternLatestRead Worker admission scrubs a thrown session dependency failure
  - x2: CMS-03C-12 and cmsPatternLatestRead Worker admission rejects a malformed successful session
  - x2: CMS-03C-12 and cmsPatternLatestRead Worker admission refuses malformed quota output before RPC
  - x2: CMS-03C-12 and cmsPatternLatestRead Worker admission rejects unsupported request media before the session
  - x2: CMS-03C-12 and cmsPatternLatestRead Worker admission requires a designer capability before rate admission
- `apps/worker/src/cms-composition/pattern-update-admission.test.ts`
  - x2: 'CMS-03C-13' admission a caller holding cms.author may use it
  - x2: 'CMS-03C-14' admission a caller holding cms.author may use it
  - x2: 'CMS-03C-15' admission a caller holding cms.author may use it
- `apps/worker/src/cms-composition/taxonomy-definition-write.test.ts`
  - x2: taxonomy definition write isolated boundary denies absent curator before quotas and mutation
- `apps/worker/src/cms-composition/taxonomy-selector-read.test.ts`
  - x2: CMS-03C-17 selector route refuses a typeKey outside its grammar with a 422 pointer, before quota and port
  - x2: CMS-03C-17 selector route refuses a fieldKey outside its grammar with a 422 pointer, before quota and port
  - x2: CMS-03C-17 selector route refuses a locale outside its grammar with a 422 pointer, before quota and port
  - x6: CMS-03C-17 selector route refuses a limit outside its grammar with a 422 pointer, before quota and port

### Flaky test in a cited file

`apps/web/src/components/cms-governed-review/CmsGovernedActivationForm.schedule.test.tsx` >
"schedule commit keeps the schedule entries across the step-up detour" failed once in the 263-file run
(`TypeError: Cannot read properties of null (reading 'values')` at line 277) and passed twice alone and
in the earlier full run. The file is cited under AC-087. Run the receipts on a quiet host or fix the
wait.

### Unusable identity

`CMS-03C-15 pattern-update route 33 instances is 422 naming { ... }` expands to 3,170 characters,
over the guard's 1,000-character title limit, so it cannot be cited (the contract bound of 1 to 32
instances is cited instead).

## Runs

| What                  | Command / result                                                                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused Vitest report | 263 test files, 4,266 tests: 4,263 passed, 3 failed (2 = the new guard, expected; 1 = the flaky schedule case above); JSON in the lane scratch directory              |
| Postgrest collection  | `vitest list --config vitest.postgrest.config.ts` for the three S12 `.apispec.ts` files (27 tests listed, not executed)                                               |
| Playwright collection | `playwright test --list` (default config: 4 template-edit tests, project `chrome`; `playwright.s09-real.config.ts`: template-real-route, project `real-route-chrome`) |
| Identity check        | all 873 distinct vitest citations in the ledger resolve to a passed or listed test; 0 missing                                                                         |
| Guard                 | red as above                                                                                                                                                          |

## Test corrections

None. No existing test was edited.

## Spec citations

Clause-level evidence rests on BE03c rows cited in each test title; no spec file was read for a new
decision. Spec drift is listed under Findings.

## Open items / BOUNDARY

- No BOUNDARY markers or stubs were written (docs/tests only).
- Held citations (30 entries) await receipts and refutation audit; ambiguous citations (9) await unique
  titles.

## Requests to root

1. Regenerate receipts only after applying the held citations you accept:
   `node docs/handoffs/2026-10-22-claude-s12/lane-evidence-cite-apply-held.mjs` (add `--ambiguous` once
   the duplicate titles are unique). The script only adds citations, flips `unverified` to `partial` where
   that is valid, and prints the entries whose every clause is then cited; those need `verified` with an
   empty limitation (your call) or the held citation left out. Note `run-slice-evidence` plans from the
   ledger, so held citations are not run until applied.
2. Decide the bracket-path question: either widen the guard's path charset to allow `[` and `]` (Astro
   dynamic routes: `composition-route.test.tsx`, `locale-route.test.tsx`, `related-content-route.test.tsx`,
   `[locale].test.ts`, `compositions.test.ts` all live under bracketed directories and are uncitable) or
   move those tests. AC-059 already carries one invalid citation.
3. Have the owners of the 8 files above make the 21 duplicate titles unique.
4. Re-tile separator-only and monolithic UI clauses (Findings 2 and 3) if those criteria are to close.
5. Run the S12 receipts on a quiet host (shared Supabase lock) so the apispec citations (5 applied, more
   held) and the Playwright citations (18, project `chrome` for the new ones) execute.
6. After the observability lane lands, a follow-up pass can cite AC-051, 052, 263, 264.
