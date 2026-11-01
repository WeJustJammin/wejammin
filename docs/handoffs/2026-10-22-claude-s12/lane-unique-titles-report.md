# Lane claude_s12_unique_titles report

## Status
GREEN (2026-10-24). All 21 duplicated full names in the eight files are gone; every file runs the same number of tests, all passing.
No ledger edit was needed: not one ledger citation names an old duplicated title or any title that changed (see Ledger re-citation).

## Scope
Make each full Vitest name (describe chain + title) unique in eight Slice 12 test files without changing any assertion, setup or case set.
Titles only (plus the minimum case-shape change needed to carry a distinguishing label into the title). Receipts, trackers, specs, product code untouched.

## Backups
Tar of the eight test files and every S12 ledger file before any edit:
`/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_unique_titles/orig-20261023.tar` (SHA-256 b02cf2a73064970a55c1801b13c7c69ef5b3019161cb6799f5842e3df9744591).
Scratch dir: `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_unique_titles/`.

## Files (path, lines, SHA-256 before -> after)

| file | lines | tests before -> after | SHA-256 before | SHA-256 after |
|---|---|---|---|---|
| `apps/web/src/components/cms-governed-review/CmsGovernedActivationForm.recovery.test.tsx` | 354 | 18 -> 18 | `72cb331e687fa3c070bb5ca4322c7a87e3cc8e5bb94b867b12b8525e2b7f4750` | `68765f2608691744986fa3da03c157f1220d321687ca03da49d9f74abc3824aa` |
| `apps/web/src/components/cms-governed-review/governed-review-command-failures.test.ts` | 141 | 11 -> 11 | `c0e4afda1901dbbc0717f745b1d3350d698b0c46d203f2e3cd79a2c3411bda5d` | `ea34bccc286567d62e6147cb8280315caa25949490959561128f522f6babe2bb` |
| `apps/worker/src/cms-composition/governed-review-decision-input.test.ts` | 180 | 22 -> 22 | `9b99f47efefc79b4b09d924cf172f2312fd6db2b5dbb8c5083f72bd058e21c55` | `a9dd3a783bda714fd12d270420073c454e27b90c6f0959d8f3646e732df67b4d` |
| `apps/worker/src/cms-composition/governed-review-reads.test.ts` | 296 | 31 -> 31 | `ab088f9d0f01f0b4eec2409743551bdd8f44874ef4efc3a70fdb27febed1cb79` | `417808ed58f70de6b9be822320943131f67450928c5738a5a33eb5a7bb27bb53` |
| `apps/worker/src/cms-composition/pattern-definition-admission.test.ts` | 302 | 28 -> 28 | `c11aa434f25252cea6a152051d096b8a6c67f8525b4c8904b88ea8d8bd222723` | `324715647a1b1f7fd8b66db3c85cfb13eef3602c236e0ed5fc7da6c330d63853` |
| `apps/worker/src/cms-composition/pattern-update-admission.test.ts` | 249 | 66 -> 66 | `6a053d74f7938b79c03e79c28144f518e026266f27903e73da66fd4ec58e5fd3` | `83e44e39a6c148f2ae99f81e0652ecd570acd3d3ceace23bf8c20f565b2ca860` |
| `apps/worker/src/cms-composition/taxonomy-definition-write.test.ts` | 234 | 31 -> 31 | `bdb5d2377cd5d59d3bfcca0b1eb127a1348bfeb374a4b9e54b04ae6eba7afc56` | `8762df00503b4428683ac3b287fa5768a6b88dd00f75b36303eadd8d22e5b3c8` |
| `apps/worker/src/cms-composition/taxonomy-selector-read.test.ts` | 327 | 47 -> 47 | `c5d7bd087fe9a03b63844febf2468cf1ab9c08ed8df497ad4e5a942fccf777e1` | `de9149a8b630173438dd0e8868a56446896d3f28aa65e403902825a6fe391cef` |

Total 254 tests before, 254 after, all passed in both runs. Ledger files: no change (still the pre-lane bytes).

## Title changes (old duplicated name -> new case titles)
Old names are the full names from `before.json`; the new names are the full names from `after.json`.
Technique per file: `%s` / extra `%s` for primitive cases, a named label column for tuple cases, `$name` with named object cases where the case is a function (`writeRequest` / `readRequest`).

### `apps/worker/src/cms-composition/governed-review-decision-input.test.ts`
removed (4):
- `CMS-03C-07 strict input (422 body, 400 transport) before any quota names /decision for an invalid member`
- `CMS-03C-07 strict input (422 body, 400 transport) before any quota names /reason for an invalid member`
- `CMS-03C-07 strict input (422 body, 400 transport) before any quota names /expectedVersion for an invalid member`
- `CMS-03C-07 strict input (422 body, 400 transport) before any quota names /reviewId for an invalid member`
added (8):
- `CMS-03C-07 strict input (422 body, 400 transport) before any quota names /decision for an invalid member (a decision outside the closed set)`
- `CMS-03C-07 strict input (422 body, 400 transport) before any quota names /reason for an invalid member (an empty reason)`
- `CMS-03C-07 strict input (422 body, 400 transport) before any quota names /reason for an invalid member (a 2001-character reason)`
- `CMS-03C-07 strict input (422 body, 400 transport) before any quota names /reason for an invalid member (a reason with a control character)`
- `CMS-03C-07 strict input (422 body, 400 transport) before any quota names /reason for an invalid member (a reason with markup)`
- `CMS-03C-07 strict input (422 body, 400 transport) before any quota names /expectedVersion for an invalid member (an expectedVersion of zero)`
- `CMS-03C-07 strict input (422 body, 400 transport) before any quota names /expectedVersion for an invalid member (an expectedVersion with a leading zero)`
- `CMS-03C-07 strict input (422 body, 400 transport) before any quota names /reviewId for an invalid member (a reviewId that is not a UUID)`

### `apps/worker/src/cms-composition/governed-review-reads.test.ts`
removed (4):
- `CMS-03C-11 review queue (BE03c row 173) names /limit for an out-of-bounds value with 422`
- `CMS-03C-11 review queue (BE03c row 173) names /scope for an out-of-bounds value with 422`
- `CMS-03C-11 review queue (BE03c row 173) names /state for an out-of-bounds value with 422`
- `CMS-03C-11 review queue (BE03c row 173) names /subjectKind for an out-of-bounds value with 422`
added (5):
- `CMS-03C-11 review queue (BE03c row 173) names /limit for an out-of-bounds value with 422 (limit=0)`
- `CMS-03C-11 review queue (BE03c row 173) names /limit for an out-of-bounds value with 422 (limit=51)`
- `CMS-03C-11 review queue (BE03c row 173) names /scope for an out-of-bounds value with 422 (scope=everyone)`
- `CMS-03C-11 review queue (BE03c row 173) names /state for an out-of-bounds value with 422 (state=pending)`
- `CMS-03C-11 review queue (BE03c row 173) names /subjectKind for an out-of-bounds value with 422 (subjectKind=route_version)`

### `apps/worker/src/cms-composition/pattern-definition-admission.test.ts`
removed (8):
- `CMS-03C-12 and cmsPatternLatestRead Worker admission uses real resolver authority bound to the original Request`
- `CMS-03C-12 and cmsPatternLatestRead Worker admission refuses a foreign Origin before authentication`
- `CMS-03C-12 and cmsPatternLatestRead Worker admission requires an acting party even for a designer`
- `CMS-03C-12 and cmsPatternLatestRead Worker admission scrubs a thrown session dependency failure`
- `CMS-03C-12 and cmsPatternLatestRead Worker admission rejects a malformed successful session`
- `CMS-03C-12 and cmsPatternLatestRead Worker admission refuses malformed quota output before RPC`
- `CMS-03C-12 and cmsPatternLatestRead Worker admission rejects unsupported request media before the session`
- `CMS-03C-12 and cmsPatternLatestRead Worker admission requires a designer capability before rate admission`
added (16):
- `CMS-03C-12 and cmsPatternLatestRead Worker admission uses real resolver authority bound to the original Request ('the CMS-03C-12 write')`
- `CMS-03C-12 and cmsPatternLatestRead Worker admission uses real resolver authority bound to the original Request ('the cmsPatternLatestRead read')`
- `CMS-03C-12 and cmsPatternLatestRead Worker admission refuses a foreign Origin before authentication ('the CMS-03C-12 write')`
- `CMS-03C-12 and cmsPatternLatestRead Worker admission refuses a foreign Origin before authentication ('the cmsPatternLatestRead read')`
- `CMS-03C-12 and cmsPatternLatestRead Worker admission requires an acting party even for a designer ('the CMS-03C-12 write')`
- `CMS-03C-12 and cmsPatternLatestRead Worker admission requires an acting party even for a designer ('the cmsPatternLatestRead read')`
- `CMS-03C-12 and cmsPatternLatestRead Worker admission scrubs a thrown session dependency failure ('the CMS-03C-12 write')`
- `CMS-03C-12 and cmsPatternLatestRead Worker admission scrubs a thrown session dependency failure ('the cmsPatternLatestRead read')`
- `CMS-03C-12 and cmsPatternLatestRead Worker admission rejects a malformed successful session ('the CMS-03C-12 write')`
- `CMS-03C-12 and cmsPatternLatestRead Worker admission rejects a malformed successful session ('the cmsPatternLatestRead read')`
- `CMS-03C-12 and cmsPatternLatestRead Worker admission refuses malformed quota output before RPC ('the CMS-03C-12 write')`
- `CMS-03C-12 and cmsPatternLatestRead Worker admission refuses malformed quota output before RPC ('the cmsPatternLatestRead read')`
- `CMS-03C-12 and cmsPatternLatestRead Worker admission rejects unsupported request media before the session ('the CMS-03C-12 write')`
- `CMS-03C-12 and cmsPatternLatestRead Worker admission rejects unsupported request media before the session ('the cmsPatternLatestRead read')`
- `CMS-03C-12 and cmsPatternLatestRead Worker admission requires a designer capability before rate admission ('the CMS-03C-12 write')`
- `CMS-03C-12 and cmsPatternLatestRead Worker admission requires a designer capability before rate admission ('the cmsPatternLatestRead read')`

### `apps/worker/src/cms-composition/pattern-update-admission.test.ts`
removed (0):
added (3):
- `'CMS-03C-13' admission a caller holding cms.author and cms.editor may use it`
- `'CMS-03C-14' admission a caller holding cms.author and cms.editor may use it`
- `'CMS-03C-15' admission a caller holding cms.author and cms.editor may use it`

### `apps/worker/src/cms-composition/taxonomy-definition-write.test.ts`
removed (1):
- `taxonomy definition write isolated boundary denies absent curator before quotas and mutation`
added (2):
- `taxonomy definition write isolated boundary denies absent curator before quotas and mutation (caller holds 'no capability')`
- `taxonomy definition write isolated boundary denies absent curator before quotas and mutation (caller holds 'only cms.author')`

### `apps/worker/src/cms-composition/taxonomy-selector-read.test.ts`
removed (4):
- `CMS-03C-17 selector route refuses a typeKey outside its grammar with a 422 pointer, before quota and port`
- `CMS-03C-17 selector route refuses a fieldKey outside its grammar with a 422 pointer, before quota and port`
- `CMS-03C-17 selector route refuses a locale outside its grammar with a 422 pointer, before quota and port`
- `CMS-03C-17 selector route refuses a limit outside its grammar with a 422 pointer, before quota and port`
added (12):
- `CMS-03C-17 selector route refuses a typeKey outside its grammar with a 422 pointer, before quota and port (an uppercase typeKey)`
- `CMS-03C-17 selector route refuses a typeKey outside its grammar with a 422 pointer, before quota and port (a typeKey starting with a digit)`
- `CMS-03C-17 selector route refuses a fieldKey outside its grammar with a 422 pointer, before quota and port (a fieldKey containing a space)`
- `CMS-03C-17 selector route refuses a fieldKey outside its grammar with a 422 pointer, before quota and port (a 65-character fieldKey)`
- `CMS-03C-17 selector route refuses a locale outside its grammar with a 422 pointer, before quota and port (a locale with an underscore)`
- `CMS-03C-17 selector route refuses a locale outside its grammar with a 422 pointer, before quota and port (a one-letter locale)`
- `CMS-03C-17 selector route refuses a limit outside its grammar with a 422 pointer, before quota and port (a limit of 0)`
- `CMS-03C-17 selector route refuses a limit outside its grammar with a 422 pointer, before quota and port (a limit of 101)`
- `CMS-03C-17 selector route refuses a limit outside its grammar with a 422 pointer, before quota and port (a six-digit limit)`
- `CMS-03C-17 selector route refuses a limit outside its grammar with a 422 pointer, before quota and port (a seven-digit limit)`
- `CMS-03C-17 selector route refuses a limit outside its grammar with a 422 pointer, before quota and port (a 23-digit limit)`
- `CMS-03C-17 selector route refuses a limit outside its grammar with a 422 pointer, before quota and port (a negative limit)`

### `apps/web/src/components/cms-governed-review/CmsGovernedActivationForm.recovery.test.tsx`
removed (1):
- `retirement refuses an invalid reason inline, sending nothing`
added (2):
- `retirement refuses an invalid reason inline, sending nothing ('a 257-character reason')`
- `retirement refuses an invalid reason inline, sending nothing ('a decomposed accent (not NFC)')`

### `apps/web/src/components/cms-governed-review/governed-review-command-failures.test.ts`
removed (2):
- `sendGovernedCommand failures carries the registered 403 reason GOVERNED_REVIEW_FORBIDDEN`
- `sendGovernedCommand failures carries the registered 409 reason GOVERNED_REVIEW_VERSION_CONFLICT`
added (4):
- `sendGovernedCommand failures carries the registered 403 reason GOVERNED_REVIEW_FORBIDDEN with reasonCode separation_of_duties`
- `sendGovernedCommand failures carries the registered 409 reason GOVERNED_REVIEW_VERSION_CONFLICT with reasonCode duplicate_decision`
- `sendGovernedCommand failures carries the registered 409 reason GOVERNED_REVIEW_VERSION_CONFLICT with reasonCode specialist_slot_unsatisfiable`
- `sendGovernedCommand failures carries the registered 409 reason GOVERNED_REVIEW_VERSION_CONFLICT with reasonCode dependency_changed`

Case sets are unchanged. Per-file mechanics:
- `CmsGovernedActivationForm.recovery.test.tsx`: tuple cases became `{ name, reason, sentence }`, title suffix ` ($name)`; callback destructures `{ reason, sentence }`.
- `governed-review-command-failures.test.ts`: title `... reason %s with reasonCode %s`; the callback already received the third argument.
- `governed-review-decision-input.test.ts`: label column inserted as second tuple element, title `names /%s for an invalid member (%s)`, callback `(member, _name, body)`.
- `governed-review-reads.test.ts`: title suffix ` (%s)` takes the existing second tuple element (the query).
- `pattern-definition-admission.test.ts`: `[writeRequest, readRequest]` became a shared `OPERATIONS` const of `{ name, request }` and all eight `it.each` use ` ($name)`; the callbacks destructure `{ request }`.
- `pattern-update-admission.test.ts`: name label as first tuple element (`cms.author`, `cms.editor`, `cms.author and cms.editor`), title unchanged `a caller holding %s may use it`, callback `(_name, capabilities)`. The first two titles are byte-identical to before; only the third (previously a duplicate of the first) is new.
- `taxonomy-definition-write.test.ts`: cases `{ name, capabilities }`, title suffix `(caller holds $name)`.
- `taxonomy-selector-read.test.ts`: label column inserted as second tuple element for the 422 grammar table, title suffix ` (%s)`, callback `(member, _name, query)`.
Prettier reformatted the edited blocks (`--write` on the eight files); no other lines changed.

## Ledger re-citation
Script `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_unique_titles/cites.mjs` (TypeScript AST over `tests/contracts/phase-02-slice-12-evidence-ledger-*.ts`) found 61 citations whose `file` is one of the eight. None cites an old duplicated name: the guard's "duplicated" problem comes from its sibling check (a cited file may not hide a duplicated test that no citation names), not from the cited titles. Check: citations whose (file, title) is in the removed-name set: 0. Therefore no ledger line was edited. Old -> new mapping for cited titles: none required.
An earlier draft of `pattern-update-admission.test.ts` (object cases, `$name` quoting) renamed the cited `... a caller holding cms.editor may use it` title; I replaced it with the tuple form above so that cited title stays byte-identical and no ledger churn is needed.

## Verification
- Before/after JSON: `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_unique_titles/before.json`, `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_unique_titles/after.json`; script `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_unique_titles/dups.mjs` prints per-file test count and duplicated names (before 21 duplicated full names across all 8 files, after 0).
- Citation check: `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_unique_titles/verify.mjs /tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_unique_titles/after.json /tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_unique_titles/cites.json` printed `citations 61/61 match exactly one passing test; files with duplicate names: 0/8`. Identity = JSON `fullName` (the field `parseVitestJson` in `scripts/evidence/receipts-lib.mjs` reads: describe chain and title, space joined).
- `pnpm exec prettier --check` on the eight files: clean. `pnpm exec eslint` on the eight files: exit 0. `apps/worker: pnpm exec tsc --noEmit`: exit 0 (worker tsconfig includes `src/**/*.ts`, tests included). `apps/web: pnpm exec tsc -p tsconfig.json --noEmit`: exit 0.
- `vitest run tests/contracts/phase-02-slice-12-evidence-guard.test.ts` still prints the same 21 `duplicated` problems because the guard reads the generated receipts file `tests/contracts/phase-02-slice-12-receipts.generated.jsonl` (written by the evidence runner), which was produced before this change. Root must regenerate receipts for the eight files via the evidence runner; I did not touch receipts.

## Runs
No database, race, Playwright, supabase or docker runs. Vitest only: before (254/254 pass), after (254/254 pass, several times as edits progressed; last one after the final byte change).

## Test corrections
None to assertions. Case shape changes only where listed above (tuple -> object or extra label column); no input, expected value or setup changed.

## Spec citations
n/a (no behavior change).

## Open items / BOUNDARY
None.

## Requests to root
1. Regenerate the Slice 12 receipts for the eight files (evidence runner) so the guard stops reporting the 21 stale `duplicated` problems.
