# Lane report: claude_s12_web_related (Web surface, FE03 CMS-16 / CMS-03C-05 related-content page)

## Status
GREEN with one BOUNDARY (final, 2026-10-15 13:24Z). Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, HEAD `b16edb54`. The page, loader, read seam, island, tests, READMEs, step-up inventory classification and the entry-page link are done. The one thing the page cannot do is show the saved rule: no author-facing read of it is specified (BOUNDARY below). Nothing outside the brief's claim was touched (shared files edited: `step-up-required.inventory.test.ts` +4 lines, `entries/[entryId].astro` +7 lines, two READMEs).

## Scope
Brief `briefs/web-related.md`: protected server-first page `/app/cms-content-modeling/entries/:entryId/related-content` (FE03 :1072, :1601) with `CmsRelatedContentForm` (:890, :1473, :1121, :1508, :1718, :2678): ordered pins (max 32, Move up/Move down, no drag-only path), exclusions (max 64) with "exclusions win" stated beside the lists, candidates only from the CMS-03B-13 entry list, a derived rule from the registry (`shared-terms`, `same-type-recent`) with `maxCandidates`, `eligibleCount` after save, the uniform `related_target_ineligible` message at the offending row, exact `If-Match` = entry `version`, idempotency key, focus to the named result heading, 303 sign-in / 400 / disclosure-safe 404 / 403.

## Decisions
1. BOUNDARY (current rule). No read of a saved `RelatedContentResource` exists: BE03c has only the CMS-03C-05 POST for browsers (catalog rows 93, 163), CMS-03C-21 is an internal RPC with no browser route, and CMS-03B-11 / CMS-03B-13 carry no rule (draft `relations` are EntryRelation field values). Missing spec: a CMS-03C related-content read operation (route, `RelatedContentResource` read, ETag). The page passes `rule = null`; the form starts empty and says that saving replaces the whole saved set (BE03c 1417). `RELATED_CONTENT_RULE_BOUNDARY` states the gap in code, `load-related-content-page.test.ts` has the sentinel, the README repeats it, `RelatedRuleSnapshot` is the shape the read plugs into. TRACKING: no network here; root to file the issue.
2. No step-up. BE03c 216 lists recent MFA only for CMS-03C-07/-08/-09; the CMS-03C-05 catalog (1311) has `401 UNAUTHENTICATED` only and the proxy maps 401 to `reauthenticate`. FE03 :1601 "step-up gates the commits" cannot apply to an operation that never answers `STEP_UP_REQUIRED`; a 401 is sign-in. The four files that read a 401 are classified `NO_STEP_UP_ROW`.
3. Any query on the page is a 400 (":entryId only; pins and exclusions are form state and never URL state").
4. Edit authority is proven by the write (403 `capability_missing`), not by a read; the page proves read access to the entry (CMS-03B-11) before the picker's list read (CMS-03B-13).
5. Candidates: first page (limit 50) server-side, "Load more entries" in the browser through the same-origin list route with a structural verifier; a 409 cursor restarts from the first page and keeps the chosen pins with their facts. The list has no titles, so entries show by id plus locale, revision state, lifecycle and update time. A pin is offered only for an `active` entry (BE03c 1417 b); any listed entry can be excluded. The source entry is never offered.
6. Unavailable choices use `aria-disabled` and a live-region reason, not `disabled`, so focus is not lost when a Pin button is used. Version conflict offers an explicit "Keep my choices and use the current entry version" when the 409 names a valid `currentVersion`, else only a reload link.
7. Props follow the repo precedent (`submit`, `csrfToken` seams, key held inside the hook) rather than the abstract `onSubmit, idempotencyKey` of the FE03 props table.
8. Process note: the lib modules were written RED-first; the React components were written before their RTL tests (not RED-first). The mutation battery below is the compensating evidence.

## Files
Created (all new unless marked modified), path, lines, SHA-256:

| Path | Lines | SHA-256 |
| --- | --- | --- |
| `apps/web/src/components/cms-related-content/CmsRelatedCandidates.tsx` | 151 | `68db847c52b564912d8b3010c9459f7219dda2794432ee9d427a5470921c403d` |
| `apps/web/src/components/cms-related-content/cms-related-content.css` | 196 | `ba1a3a6208f01442e2e50c71a96963f1911dda985b21ad719d78d0f9247fc6ba` |
| `apps/web/src/components/cms-related-content/CmsRelatedContentForm.candidates.test.tsx` | 156 | `cdc0e5b349c257e07cb5d44ecb1d32e57b801cd9b054e0ebf5b2dd7604a7fde2` |
| `apps/web/src/components/cms-related-content/CmsRelatedContentForm.lists.test.tsx` | 256 | `ab791b0e20c7ddcdb97c71ce6d62eb24b512510569aa7f2def31347835eff583` |
| `apps/web/src/components/cms-related-content/CmsRelatedContentForm.refusals.test.tsx` | 235 | `768c3a77fce08c3a5b5f5e29c446788c69235dc5d6baf539438d7539cc2d67a4` |
| `apps/web/src/components/cms-related-content/CmsRelatedContentForm.save.test.tsx` | 329 | `d74ac116436e6056dcedde51f62eda2da35e1fa6ea25fd38cb578853e87044c1` |
| `apps/web/src/components/cms-related-content/CmsRelatedContentForm.tsx` | 145 | `586adebf7710fed98799b2a70b8ce513e3139e7cf22e338a56e02b67ee8d553a` |
| `apps/web/src/components/cms-related-content/CmsRelatedEntryLabel.tsx` | 30 | `87c4fa84dc6c3f689b154d92abff1fc3f8e757dd18e1d9eca72a02aae51890d4` |
| `apps/web/src/components/cms-related-content/CmsRelatedExclusionList.tsx` | 86 | `a6798d5c1a03f7abdacc781d7dd8f64263846c9ae28f3a8d3bba1653ce4fb120` |
| `apps/web/src/components/cms-related-content/CmsRelatedPinList.tsx` | 129 | `5303990fe819230b3cf1e4c495285fc3e5635eb66cc4eca9ee469542b6f341b2` |
| `apps/web/src/components/cms-related-content/CmsRelatedRuleFields.tsx` | 86 | `d05a18a3bf8d2a4cb68474528d4c759bd06844b393ee159dd56fb4845880646c` |
| `apps/web/src/components/cms-related-content/CmsRelatedStatus.tsx` | 130 | `64d5a72d32593e922352475ffa9ad0ba9d1766c126f8bdfb29a04ca573280531` |
| `apps/web/src/components/cms-related-content/load-related-content-page.test.ts` | 253 | `823dd74b75b1f9bfc44b2246fe536ed428cdc4e5913001b9070eaa02947f5531` |
| `apps/web/src/components/cms-related-content/load-related-content-page.ts` | 126 | `5cd2b210775dabe0a85e2f1334f88d21b694c262c4e738737b85c6f0b1dc881a` |
| `apps/web/src/components/cms-related-content/README.md` | 73 | `78e7c712b32b802400708b5baf9a3f1d95d5d11d5c089377febd4a21fecefe3d` |
| `apps/web/src/components/cms-related-content/related-candidates.test.ts` | 202 | `aea0274ba2f62f3ac1a8fd5f256547194193510377606547bca52c8d7417f8fa` |
| `apps/web/src/components/cms-related-content/related-candidates.ts` | 173 | `95f1ec830ea05fc1e24cec27540fd6db71b7913413af3ff65f7409cc2fee4317` |
| `apps/web/src/components/cms-related-content/related-content-copy.ts` | 46 | `6025e4e0521cc3ecf776029f99edf3db705b4a7224d9eaf5ea48cd7aa50ecd49` |
| `apps/web/src/components/cms-related-content/related-content-lists.test.ts` | 118 | `7d6f7f4132fc3068a7f8462730c2bb80829fe223424831ffc76887e56f7d650b` |
| `apps/web/src/components/cms-related-content/related-content-lists.ts` | 94 | `21cafa12ceef0c51cdaa2dbf8eb25faf12cd047b313922f6cd7449f54f8c04ee` |
| `apps/web/src/components/cms-related-content/related-content-page-reads.test.ts` | 72 | `b9117dddd83306adb60e4d5e8872a8405c428b952b12204a8487f11ca79bf4bd` |
| `apps/web/src/components/cms-related-content/related-content-page-reads.ts` | 50 | `c2f65f272cc5f3b16a4a842ab33a4a2f3ff3d5cade32a3ee8eec0139d16927e6` |
| `apps/web/src/components/cms-related-content/related-content-path.ts` | 7 | `b80deda76c774862a6dbd3473ab28b9efd74a2301418a2b36984bcd1a57400ff` |
| `apps/web/src/components/cms-related-content/related-content-request.test.ts` | 207 | `0fca5644c66d6fff4241d2b5696742361013e2e072d4e528a1f1233e2459c0d0` |
| `apps/web/src/components/cms-related-content/related-content-request.ts` | 111 | `d3fa6b7cf20dea34ba78c8cd0e2bf777f4edf7139322a810ab4b47052578816e` |
| `apps/web/src/components/cms-related-content/related-content-static-closure.test.ts` | 58 | `6c309d73d7d908af67cee19b44cf08c2e3483d59b02736dd5e80f763009a56b8` |
| `apps/web/src/components/cms-related-content/related-content-submit.proxy.test.ts` | 61 | `7b470fd007c74e61eb4d6732c3a85100c6dd589186bb443b3e85c6d3875f2a1f` |
| `apps/web/src/components/cms-related-content/related-content-submit.test-support.ts` | 67 | `d142812ebd61a71bb67f76cafdab898a933f82172f1f8d05faac24e5bee740e4` |
| `apps/web/src/components/cms-related-content/related-content-submit.test.ts` | 388 | `b84a9119b04d216333c1094f37bc0a98040b0adbb2a74477f042dc9fd67bfe31` |
| `apps/web/src/components/cms-related-content/related-content-submit.ts` | 256 | `0d732584a306495411630a8ceeacb5a89c6dd68d2550bc7438a67cac2922fb2b` |
| `apps/web/src/components/cms-related-content/related-content.test-support.tsx` | 91 | `232e5a44eca55f9e1aea228137f6d6884b3432cdf7061bfa8d27bd7c60848a34` |
| `apps/web/src/components/cms-related-content/related-content-types.ts` | 24 | `b6a567ec309f7ee38e8d513a33036abc8e39d11f288f05ea88b94e5735fc7824` |
| `apps/web/src/components/cms-related-content/related-format.ts` | 13 | `902fc5f5677a4369a5a890f31163765dc8948d01ce32624e27c3dbb975dce93d` |
| `apps/web/src/components/cms-related-content/related-rules.test.ts` | 49 | `5c3bc37c0822794a6969a93b920a4a9d845a927d28ec9f1dd2ca3123ae0c81ce` |
| `apps/web/src/components/cms-related-content/related-rules.ts` | 41 | `f07da305fd188d1c8819bced148ea6a711b38745144ba63262221a32beaeaa97` |
| `apps/web/src/components/cms-related-content/related-status-copy.ts` | 78 | `c880787cc8d2f93796abcaed44603e31b2226c5840867e4dcb0074369fe0b9b0` |
| `apps/web/src/components/cms-related-content/use-related-content-form.ts` | 279 | `ff66f81f24093b758a80c6b66e7335580cfaf51279981413cdd48ad30ccd6d18` |
| `apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/related-content-route.test.tsx` | 211 | `a7980aa2689dfa9812aa967a82e5bc04daf1f104876bfacc3461366321c18c26` |
| `apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/related-content.astro` | 70 | `876813faa8dc700f3255b8710854b5e764cf8eb15ce6c992bfb868bb0dcf91c3` |
| `apps/web/src/pages/app/cms-content-modeling/entries/[entryId].astro` | 66 | `bd4afab80ef30af9780e5d4018c100df104e8cc937795723d511c55c5813ff6f` |
| `apps/web/src/pages/app/cms-content-modeling/entries/README.md` | 65 | `a2a93fcefd390ee14ef0d4848b3f875037e759b5b190ea3be0d104f5784fb333` |
| `apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/README.md` | 35 | `7046cf3d58dcae61c9365f5ee917a7a5aa1738a4c3f8fbad77932f87ef50d232` |
| `apps/web/src/components/step-up-required.inventory.test.ts` | 205 | `aaaa954a893366a1709438161789ac6e980ca5af186d72917f7142687419ab0d` |

Modified shared files are the last five rows above (`[entryId].astro` +7 lines, the two READMEs +2 and +3, `step-up-required.inventory.test.ts` +4 lines of mine; the 26-line total diff of that file includes other lanes' earlier entries). Component files are at most 200 lines; the largest test is `related-content-submit.test.ts` (388 lines).

## Runs
Pinned PATH, all Vitest under `flock -s /tmp/wejammin-quiet.lock`. No DB runner.
- RED then GREEN per module (rules 5, lists 12, request, submit, candidates, loader 23, route 10 at first green).
- 13:15Z full `vitest run apps/web --maxWorkers=4`: 548 files, 6734 tests, all green. (Two earlier full runs without the worker cap were killed by SIGTERM / exit 143 with no test output, memory pressure on the shared host; not a failure of any test.)
- Focused: `cms-related-content` 13 files, 197 tests; plus `entries` pages, step-up inventory (5/5).
- eslint `--max-warnings=0` clean on the lane directory, `entries` pages and the inventory test; prettier check clean.
- `astro check`: 0 errors (an earlier run showed 2 errors in `taxonomy-filter-roundtrip.test.tsx` / `CmsTaxonomyTermForm.choices.test.tsx`, another lane, since fixed).
- Mutation battery (scratchpad `claude_s12_web_related/`, `mutate.mjs`, in-place with SHA-verified restore after every mutant; the literal "scratch copy" form was not possible because the tests resolve siblings by relative import and the workspace by node_modules). 170 mutants across rules, lists, request, submit, candidates, hook, nine components, copy, loader, reads, path, the page and the entry page: first pass 140 killed, 29 survivors, 1 mis-targeted (corrected in fix pass 1 from 28; `run.out` and the independent review agree). Survivors were triaged: 22 got new tests and were re-run (19 killed at once, 3 more after fixing two weak tests: a double-submit test whose first release was lost, a stale-row-mark test whose mark vanished anyway); the `facts forgotten` survivor was a stale-closure variant, re-targeted and killed; 2 were redundant code removed (zod UUID check duplicated `isCmsUuid`, verified identical on 5 ids; conditional-header strip duplicated the read proxies' header allowlist). 6 equivalent mutants remain: `typeof count !== 'number'` (the `Number.isInteger` after it covers it), a missing `Retry-After` (the regex rejects `null`), the unreachable `currentVersion === null` guard of adopt (the button only exists for a version), the loading guard of Load more (the button is disabled), restart-uses-cursor (the cursor is already null), and the draft path encoding (a UUID needs none).

## Test corrections
none (no existing oracle changed). The shared inventory test gained four `NO_STEP_UP_ROW` entries.

## Spec citations
FE03 :890, :1072, :1121, :1473, :1508, :1561, :1601, :1718, :1794, :2665, :2678; BE03c 93, 163, 215, 216, 385-387, 1311, 1323, 1417, 1421, 1646; contracts `RelatedContentRuleRequestSchema`, `RelatedContentResourceSchema`, `CmsCompositionRefusalDetailsSchema`, `CMS_RELATED_RULES`, `EntryDraftDetailResourceSchema`, `EntryListPageSchema`.

## Open items / BOUNDARY
- BOUNDARY: saved rule read (see Decisions 1).
- Browser (Playwright) E2E and screenshots not run: no hosted/staging services; the FE03 :2678 journey "related content pinned and excluded" is covered only by jsdom tests plus the composed route test.
- 200%-zoom and 320 px layout are by CSS only (no visual run).
- The rule-set replacement is unguarded by design until the read exists: an author who saves from the empty form replaces a rule they cannot see. The page says so, but a product owner may want the page to refuse writes until the read exists.

## Requests to root
1. Proxy gap: `apps/web/src/server/cms-composition-platform-related.ts` `safeErrorDetails` relays `{}` for a 422, so `details.reasonCode` (`related_target_ineligible`, `derived_rule_unknown`) and `details.violations` (`/pins/{n}`, `/exclusions/{n}`; contract `CmsCompositionRefusalDetailsSchema`) never reach the browser. The form already reads both; until the proxy relays them (allowlisted to the CMS-03C-05 tokens, at most 50 violations, pointer pattern only), a 422 is a plain "Could not save" and no row is marked. `related-content-submit.proxy.test.ts` pins today's behavior and must be updated when the proxy changes.
2. File a tracking issue for the saved-rule read BOUNDARY (and decide whether the page should refuse writes until it exists).
3. The 409 `currentVersion` is relayed by the proxy only when well formed; no change needed, noted for the conflict affordance.

## Fix pass 1
Lane `claude_s12_web_related_f1`, brief `briefs/web-related-f1.md`, review `review-web-related.md`. Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, HEAD `b16edb54`. Started 13:42Z 2026-10-15, final 14:10Z. No DB runner, no `apps/worker`, `supabase`, contracts or `safe-read-retry.ts` touched.

### Status
GREEN with two BOUNDARY items (SG-S12-03 saved-rule read, SG-S12-04 edit-capability signal). All nine review findings are addressed (finding 7 by instruction: follow BE03c; finding 8 recorded as accepted). The page no longer saves while the saved rule cannot be read.

### What changed, by review finding
1. BLOCKER save while `rule === null`. The loader passes `rule = null` while the read is a boundary; `CmsRelatedContentForm` then renders only the entry facts and the fixed copy `SAVING_UNAVAILABLE` ("Saving related content is unavailable until the current rule for this entry can be shown ... Nothing is sent from this page."): no submit button, no pin/exclude/rule control, no candidate table. `useRelatedContentForm.save` and the new `useRelatedCandidates.loadMore` are inert without a rule (defense in depth, tested by a direct hook probe and by a dispatched form `submit` event, with `fetch`, `submit` and `loadPage` all asserted uncalled). The conflict "Keep my choices" path is unreachable (no save, so no 409). Boundary stub per `boundary-not-placeholder`: typed seam `readSavedRelatedRule(entryId): Promise<SavedRuleRead>` in `related-content-boundaries.ts` returning a structured `BoundaryResult` (`gap: SG-S12-03`, `missing: BE03c author read of the saved RelatedContentRule ...`, `safeDefault`), a `BOUNDARY:` comment, `TRACKING: pending owner authorization to open a GitHub issue (SG-S12-03)`, sentinel `related-content-boundaries.test.ts` plus the loader sentinel. The seam is on `RelatedContentPageReads.savedRule`; a `known` result carries a `RelatedRuleSnapshot` and makes the form editable (loader and route tests drive that path). All submit-path tests run through a non-null known empty rule (`EMPTY_RULE` in the test support, now the default of `formProps`), and a new test proves the form starts from a known rule's pins in order, exclusions and bound.
2. MAJOR proxy 422 relay. `cms-composition-platform-related.ts` `safeErrorDetails` now relays, for 422 only, the single `reasonCode` that `cmsSlice12ReasonStatus` maps to 422 and `CMS_SLICE_12_OPERATION_REASONS['CMS-03C-05']` lists (`related_target_ineligible`, `derived_rule_unknown`), plus at most 16 violations rebuilt through the existing `patternInstanceViolations` (contract `CmsViolationSchema`, fixed message "The value is invalid.", pointers `/pins/n`, `/exclusions/n`, `/derivedRule/...`), exactly the Worker's `related-content-details.ts` shape. Violations are relayed only together with a valid token; a token of another operation or status, a 400's token, any other member and any private text are dropped. Composed test: `CmsRelatedContentForm.proxy.test.tsx` (form -> `submitRelatedContent` -> the REAL `forwardCmsRelatedContentMutation` -> stubbed Worker answer) marks the pin and exclusion rows from the real relay, shows "That rule is not available" for `derived_rule_unknown`, and shows the plain failure with no mark for an untyped 422.
3. MAJOR page-level 403. Investigation (no read invented): CMS-03B-11 (BE03b 163, 2041) is "read capability/assignment", 403 only without read scope, and its draft-read predicate admits owner-party scope (BE03c 1417 d; BE03b 1858: owner-party publisher is "a visibility scope ... never an edit assignment"); `EntryDraftDetailResourceSchema` has no capability member; CMS-03B-15 (BE03b 167, 2045) serves the same read scopes and its `permittedNextActions` is a list of workflow actions, not an edit signal. So no existing read proves edit authority. Recorded as BOUNDARY SG-S12-04 with the same stub discipline: `readEditCapability(entryId): Promise<EditCapabilityRead>` (`boundary | granted | denied`) in `related-content-boundaries.ts`, `BOUNDARY:` comment, `TRACKING: pending owner authorization to open a GitHub issue (SG-S12-04)`, sentinel test. The loader asks after the entry is proven readable (so 401/404 stay first) and before the list read; only `denied` closes the page with the fixed 403 "This account cannot edit related content for this entry."; a boundary value changes nothing (the write still answers 403 `capability_missing`, FE03 :1072 stays open as a spec gap for root).
4. MAJOR Load more retry contract. `fetchCandidatePage` runs the GET through `retryingSafeRead` (250 ms and 750 ms on a retryable 502/503/504, at most two retries, then `failed`); a 429 is not retried and returns `rate_limited` with `rateLimitWaitSeconds` (header, else body, disagreement or an unbelievable value gives null). The picker logic moved to `use-related-candidates.ts` (the form hook was near the 300-line limit): a 429 keeps pins and exclusions, starts `useCmsTemplateRateWait`, disables the button and ignores direct calls until the wait elapses, and announces `rateLimitMessage(seconds)` in the polite `role="status"` region. Fake-timer tests: `related-candidates-retry.test.ts` (250/750 boundaries at 249/1 ms, three attempts max, non-retryable answers, network failure, 401/409 unretried, 429 variants) and `CmsRelatedContentForm.candidates-rate-limit.test.tsx`.
5a. Minor sign-in link: the candidate list's link now returns to this page (`returnTo`), test updated; RED confirmed by temporarily restoring the old target (restored, SHA identical).
5b. Minor unknown outcome: every success the proxy cannot verify (non-201 success status, unreadable or oversized body, next version outside the contract, resource/ETag not bound to the request) is `502` with `x-cms-editorial-outcome: unknown` (`cmsEditorialOutcomeUnknown`, as the taxonomy and pattern write proxies do), so the browser keeps its Idempotency-Key. Not changed, noted: an upstream error relay (including a 5xx the Worker returned) and a transport loss are not marked here; the taxonomy proxies mark both, a follow-up for the proxy owner if root wants parity.
5c. Props vs FE03 :1473: unchanged on purpose (Decision 7 above: the precedent `submit`/`csrfToken`/`returnTo` seams, key held in the hook). Root may cascade the FE03 props wording or accept the precedent.
5d. Mutant counts corrected in the original `## Runs` text: first pass 140 killed, 29 survivors, 1 mis-targeted; 22 re-runs (19 killed at once, 3 after fixing two weak tests).
7. FE03 :1601 "step-up gates the commits" versus BE03c 216: the page keeps following BE03c (no step-up for CMS-03C-05); root handles the FE03 wording.

### Runs (pinned PATH, Vitest under `flock -s /tmp/wejammin-quiet.lock`)
- RED before each fix, GREEN after: proxy 422 relay (5 RED), unknown-outcome marker (RED), boundary sentinels (module missing), loader (3 RED), form read-only (5 RED), retry (7 RED), rate-limit UI (3 RED), sign-in link (1 RED).
- 13:59Z focused `cms-related-content` + proxy + route: all pass.
- 14:02Z-14:07Z full `vitest run apps/web --maxWorkers=4`: 569 files, 6913 tests, all pass, exit 0 (raw output `<scratchpad>/claude_s12_web_related_f1/full.out`). The only edit after the run started is a doc comment in `related-content-types.ts` and this report.
- 14:08Z `astro check` (apps/web): 2006 files, 0 errors, 0 warnings, 182 hints, none in lane files. `eslint --max-warnings=0` clean over `cms-related-content/`, the proxy and its test, and `entries/[entryId]/`; `prettier --check` clean.
- Mutation checks, in memory (a Vite `transform` hook substitutes the mutant; no worktree byte is written; config and runner in `<scratchpad>/claude_s12_web_related_f1/`): 40 mutants over the proxy relay and marker, the read-only gate, the loader seams, the retry, the wait and the sign-in link. First pass: 34 killed, 4 survivors (P3 operation-list check, P12 400 relaying the token, W16 wait guard in the hook, W28 restart condition), 2 mis-targeted finds (prettier had reformatted the text). Tests added for P3 (a 422 token of another operation), P12 (a 400 with a token), W16 (a direct hook probe) and P9 (the marker on the version bound); with the two finds corrected, the 5 re-runs were all killed (`mutation-rerun-results.txt`). W28 is equivalent: after a restart the item list is empty, so replacing and merging agree, and a null cursor is sent either way. Result: 39 killed, 1 equivalent, 0 unexplained survivors.

### Test corrections
`related-content-submit.proxy.test.ts`: the test `today reads the proxy 422 as a plain rejection because the proxy drops the token and the pointer` pinned the defect (`{ kind: 'rejected', status: 422 }`). Replaced, citing BE03c 385-387 and 1417 and the contract list (`CmsCompositionRefusalDetailsSchema`: `related_target_ineligible`, `derived_rule_unknown`): it now expects `{ kind: 'refused', status: 422, reason: 'related_target_ineligible', rows: [{ list: 'pins', index: 0 }] }`. Four tests added beside it (both lists, `derived_rule_unknown`, a foreign token stays a plain rejection, unknown-outcome marker keeps the key). Also `load-related-content-page.test.ts`: the old sentinel `passes no saved rule and names the missing spec` (which asserted the removed `RELATED_CONTENT_RULE_BOUNDARY` constant) is replaced by the SG-S12-03 sentinel and the known-rule test; `CmsRelatedContentForm.lists.test.tsx` `starts empty, says the saved rule is not shown ...` now starts from a known empty rule; the route test's first test is split into the read-only page (real loader) and the editable page (injected known rule). The shared `related-candidates.test.ts` list `[400, 403, 404, 429, 500, 503]` of `failed` statuses lost 429, which is now `rate_limited` (FE03 :1172).

### Files (this pass)
| Path | Lines | Change | SHA-256 |
| --- | --- | --- | --- |
| `apps/web/src/components/cms-related-content/related-content-boundaries.ts` | 64 | new | `ce1482ec61a16157fc30cb3276f29bcb31c40c612276f8f15a3737605cdb907a` |
| `apps/web/src/components/cms-related-content/related-content-boundaries.test.ts` | 38 | new | `85a5b96f47960b9d185883e73025b8e1a027ac4f417966a80d41208874680ae0` |
| `apps/web/src/components/cms-related-content/use-related-candidates.ts` | 84 | new | `159e75e7c5114a407e4672904c9883071c9eed5a526c635a12caaa72926dccbb` |
| `apps/web/src/components/cms-related-content/related-candidates-retry.test.ts` | 164 | new | `59f8988fb33cf8cbf7635829ee50f038118ae404d55d46714b31bad486d4ce9b` |
| `apps/web/src/components/cms-related-content/CmsRelatedContentForm.readonly.test.tsx` | 156 | new | `025a47fa0efc48d7463a3e55da0ff6e4373f9c25583a329b4205595cdc9506a8` |
| `apps/web/src/components/cms-related-content/CmsRelatedContentForm.proxy.test.tsx` | 86 | new | `9790aef4344241030c4120316735913decc7fbeb7a33b3f16bdbdd04af7c575f` |
| `apps/web/src/components/cms-related-content/CmsRelatedContentForm.candidates-rate-limit.test.tsx` | 157 | new | `a8d5ac21587ee9a871a0978dfbb638b602f34b1b75df5bd58fd4807be7731132` |
| `apps/web/src/components/cms-related-content/CmsRelatedContentForm.tsx` | 152 | modified | `21b62ea52da6de77c7729110b9be4e4977ece27a358bb9d9d443ad9d66bfdafe` |
| `apps/web/src/components/cms-related-content/CmsRelatedCandidates.tsx` | 166 | modified | `1ac305c52a05c7ebdd977062225ac184ec63065cff2fc2780c6655fadf253909` |
| `apps/web/src/components/cms-related-content/use-related-content-form.ts` | 245 | modified | `e5f189a3d0c8a9c8d12bce3e754c831de69d22185a69f7f5a4f99486ab41de5f` |
| `apps/web/src/components/cms-related-content/load-related-content-page.ts` | 134 | modified | `d6a1cb00879e5a87f58c5d8b4a450281d1d5ca73f1c261271fb62a7c0696c48d` |
| `apps/web/src/components/cms-related-content/related-content-page-reads.ts` | 62 | modified | `c221896b892d2a5b105abce3b1bd4198545640d8deebb8dff6539bc9f0a48019` |
| `apps/web/src/components/cms-related-content/related-candidates.ts` | 191 | modified | `741ee6f0226d91a07a5e15d5e2dc7f854edd50752ffdbcd5ebde74f667456900` |
| `apps/web/src/components/cms-related-content/related-content-copy.ts` | 47 | modified | `2223f25fc80bb63b381ad9ec831cd0dc6b0201259f989761f95c7f3b16c7e1f7` |
| `apps/web/src/components/cms-related-content/related-content-types.ts` | 25 | modified | `3e3b184263ea4f19f6b8fe8bb3de08457c32479c27ce803bc33a98fc2285d6d8` |
| `apps/web/src/components/cms-related-content/README.md` | 88 | modified | `63bd2b7e6cfbfcd70c47ff4f30bace4c5c4d9248e818cf0c516e347ecd3f71b5` |
| `apps/web/src/components/cms-related-content/load-related-content-page.test.ts` | 311 | modified | `4b4594821a7b4fa3cab6fa07dd0c2ee544ae6e7b3dccf1cf0044b9e88ac72509` |
| `apps/web/src/components/cms-related-content/related-content-page-reads.test.ts` | 80 | modified | `c254a39192142427df9d6347a03edd68c17a7dca289cbfe1314f3bb5117e818d` |
| `apps/web/src/components/cms-related-content/related-candidates.test.ts` | 202 | modified | `d9107774ad37b32766a54ab34ad8d4a5a66c848f9776ffc8b447f703e67d019f` |
| `apps/web/src/components/cms-related-content/CmsRelatedContentForm.lists.test.tsx` | 254 | modified | `751b229a24f47a038aec3de0d47092297325f9ef2692f635408b1ea5970e85c1` |
| `apps/web/src/components/cms-related-content/CmsRelatedContentForm.candidates.test.tsx` | 167 | modified | `129039b084076b718cbbcf5454ce1d6e359231719d6cf038c5ba82d58a7e9b3e` |
| `apps/web/src/components/cms-related-content/related-content.test-support.tsx` | 99 | modified | `ff28c370cdf2e12b7333cb603e77d72379352485db7cfc18d6c5b3bb00867c9e` |
| `apps/web/src/components/cms-related-content/related-content-submit.proxy.test.ts` | 114 | modified | `161de6a7cc4471d11e3dd74495a88c536998cad6220667a57f5e534c3e8176de` |
| `apps/web/src/components/cms-related-content/related-content-submit.test-support.ts` | 86 | modified | `7640eb87e53076751333e07a0147e4b9e51182d29311e4af6f38c78d94a14ffe` |
| `apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/related-content-route.test.tsx` | 245 | modified | `d916fb197490140c2ee8fd81ce8cdd7d6d8da3df18e2fc28d6363968dc3a69e3` |
| `apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/README.md` | 35 | modified | `92dff2a76b86bd7837fd4815026ce7e2b4e12c28437fa6e0e4cd62bd6819741f` |
| `apps/web/src/server/cms-composition-platform-related.ts` | 270 | modified | `2e0e8add4cc9925ccc1b9817dac7177afc91f1684339d0ca7cb3b3b068d30393` |
| `apps/web/src/server/cms-composition-platform-related.test.ts` | 541 | modified | `43e8a8838856f85aca4ba4393ed7b2420c0bd938b9a733d127a68d0c0610a5d1` |

### Spec citations
FE03 :890, :1072, :1172-1175, :1473, :1601, :2665, :2678; BE03c 215, 216, 385-387, 1304, 1311, 1323, 1417, 1502; BE03b 163, 167, 1427, 1858, 2041, 2045; `.claude/rules/boundary-not-placeholder.md`; contracts `CmsCompositionRefusalDetailsSchema`, `CmsViolationSchema`, `CMS_SLICE_12_OPERATION_REASONS`, `cmsSlice12ReasonStatus`.

### Open items / BOUNDARY
- BOUNDARY SG-S12-03: BE03c author read of the saved RelatedContentRule (route, resource read, ETag). Until it exists the page is read-only for everyone, so the related-content authoring journey (FE03 :2678 "related content pinned and excluded") cannot complete in production; only the refusal and read-only states are reachable. Root should schedule the BE03c read or ratify a different shape.
- BOUNDARY SG-S12-04: an edit-capability signal for the related-content page (FE03 :1072 page-level 403).
- TRACKING for both: pending owner authorization to open a GitHub issue (no network here).
- Playwright E2E not run (no hosted services); the 200% zoom and 320 px layout remain CSS-only.

### Requests to root
1. Rule on SG-S12-03 (schedule the BE03c saved-rule read) and SG-S12-04 (an edit-capability signal, or amend FE03 :1072 to ratify the write-time 403), and authorize the two tracking issues named in the stubs.
2. FE03 :1601 "step-up gates the commits" wording against BE03c 216 (unchanged request).
3. Optional proxy parity: mark a transport loss and an upstream 5xx on CMS-03C-05 with the unknown-outcome marker like the taxonomy proxies (not done; outside the finding).
4. Accept FE03 :1473 props as built (`submit`, `csrfToken`, `returnTo`) or cascade the spec.
