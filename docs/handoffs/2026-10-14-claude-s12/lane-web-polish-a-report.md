# Lane report: claude_s12_web_polish_a (Web: FE03 network/retry sweep, pattern form contract, frame hook, Danger style, bundle)

## Status
GREEN for the lane scope (2026-10-15T13:57Z). Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, HEAD `b16edb54`. Web only; no
`apps/worker`, `supabase`, contract, `cms-governed-review`, `cms-related-content`, `cms-taxonomy*` or template designer/relay file touched. Every
behavioural change was RED first (failing run seen). Held read paths are inventoried and left (Requests to root).

## Scope
Brief `briefs/web-polish-a.md`: (1) FE03 :1172-1173 sweep, (2) pattern designer form contract (FE03 :1223, review m6), (3) frame hook, (4) Danger style,
(5) bundle budget check.

## 1. Sweep result: N/N (13 browser read paths)
Mechanism: `retryingSafeRead` (a 502/503/504 whose ApiError body declares `details.retryable: true` is retried twice, 250 ms and 750 ms; the Worker
declares it for 503/504 and never for 502, `cms-editorial/route-errors.ts:143`, so a non-retryable 502 is correctly not retried) and the new
`rateLimitWaitSeconds` / `rateLimitMessage` (429: header or `details.retryAfterSeconds`, 1..86400 whole seconds, disagreeing pair = unstated; the
sentence names the wait and says the input is kept). Retries are never added to commands (idempotency reuse and reconcile are unchanged).

| # | Browser read path | 5xx retry | 429 wait + announce + input kept | Status |
|---|---|---|---|---|
| 1 | CMS-03B-11 draft detail `cms-editorial-entry-draft-detail-transport.ts` | fixed | fixed: editor re-read after a 409 waits Retry-After (phase `waiting`, edits kept, then re-sends); "load current" names the wait | done |
| 2 | CMS-03B-12 conflict detail `cms-editorial-conflict-detail-transport.ts` | fixed | fixed: conflict form names the wait, keeps every choice | done |
| 3 | CMS-03B-15 workflow canonical `cms-workflow-canonical-read.ts` | fixed | fixed: `degraded` + `rateLimit`; hook reads again after the wait (5 s default); `CmsWorkflowRateLimitNotice` (polite status) | done |
| 4 | CMS-03B-16 review canonical (same module) | fixed | fixed (same) | done |
| 5 | reviewer options `cms-workflow-reviewer-options.ts` | fixed | fixed: `unavailable` + `rateLimit`; `useReviewerOptions` reads again after the wait | done |
| 6 | grant list `readGrantList` (CMS-03A-18) | fixed | already conforming (Retry-After + `Countdown`) | done |
| 7 | `cmsPatternLatestRead` `pattern-latest-read.ts` | fixed | fixed: `retryAfterSeconds`; polite notice, check button off until the wait elapsed, tree kept | done |
| 8 | CMS-03A registry reads `content-schema-registry-runtime-read.ts` | conforming (private 250/750, header-declared) | conforming (countdown) | unchanged |
| 9 | template latest `cms-composition/cms-template-edit-reconcile.ts` | MISSING | status only, no seconds | HELD (template lane) |
| 10 | governed canonical `cms-governed-review/governed-review-canonical-read.ts` | MISSING | collapsed to degraded | HELD (DEC-191) |
| 11 | related candidates `cms-related-content/related-candidates.ts` | MISSING | collapsed to `failed` | HELD (related lane) |
| 12 | taxonomy terms read | conforming (prior lane) | status only, no seconds | HELD (taxonomy lane) |
| 13 | taxonomy versions read | conforming (prior lane) | status only, no seconds | HELD (taxonomy lane) |

Retry: 10/13 conform (all 3 gaps are held files). 429 wait: 8/13 conform (the 5 gaps are held files). Server-rendered page loaders (`load-*-page.ts`,
`*-page-reads.ts`, `cms-editorial-page-outcome.ts`) are not browser fetches: their 429 notice already names the wait ("Try again in N seconds") and the
Worker owns upstream retries (BE03c 1314); classified out of the contract, not edited. The Web relays (`server/cms-*-platform-*.ts`) forward `retryable: true` and
`Retry-After` for 429/503/504 and do not retry (a second retry layer would multiply attempts). Manual controls follow the repo precedent (message with
seconds, no gate) except the pattern "Check latest", which is gated for the wait.

## 2. Pattern designer form contract (FE03 :1223)
- Blur validation (`use-pattern-blur-validation.ts`, delegated `onBlur` on the form): pattern key syntax, node key syntax, node props (JSON, object, limits). A
  control is judged only after it was left, and again on each change after that; cross-field rules (duplicate sibling key, block registry, types, empty tree)
  stay with submit. No pre-visit error. Equivalent mutant noted: a node key never left cannot be invalid in a browser (default `node-1` is valid).
- Submission: only the commit button is disabled while pending (`designer.blocked || designer.pending`); its label and width are unchanged ("Save successor
  draft" / "Create draft"), `aria-busy`, the pending sentence stays in the polite status region; duplicate activation was already ignored. A committed form
  (`done`) stays closed.
- Completion: `showSavedPatternAddress` replaces `/patterns/new` with `/patterns/{key}` (server-returned key, `replaceState`, no history entry) on a created answer and on
  an unknown outcome settled as saved. The committed draft needs no clearing (nothing is persisted; the form is closed). "Update version": the result region shows the
  saved version and the next-action link; the open form is closed rather than rebased because the created resource carries no content hash.
- Latest-version read: retry + 429 (row 7).

## 3. Frame hook
`CmsWorkflowCommandFrame` "Check the current state" now has `id="{headingId}-check"` and `data-cms-workflow-check`. `cms-governed-review/**` is held, so the switch is
for root (Requests 1).

## 4. Danger style
Class `cms-danger-action`, in `apps/web/src/styles/cms-editorial.css`, selector `#cms-editorial-main button[type].cms-danger-action` (+ `:hover:not(:disabled)`), CMS-wide, not
scoped to `.platform-configuration-page`. Danger border and text on the panel colour, danger fill with panel text on hover; keeps the 44px target, focus ring and disabled look.
`styles/cms-danger-action.test.ts` pins the rules and computes WCAG contrast from the OKLCH tokens (>= 4.5:1 both states) and the DESIGN.md Danger hue. Not applied to Retire.

## 5. Bundle budget (FE03 :1736-1745: island <= 35 KB, app route <= 90 KB initial, lazy <= 80 KB)
`astro build` (scratch log, `apps/web/dist` removed after), gzip via `scripts/verify-bundle-budget.mjs` measurement functions:
| Surface | island | initial route | |
|---|--:|--:|---|
| CMS entry workflow (my hook/notice are in it) | 29.9 KB | 89.8 KB | ok, 0.2 KB headroom |
| CMS entry editor | 28.9 KB | 88.8 KB | ok, 1.2 KB headroom |
| CMS review detail | 28.2 KB | 88.1 KB | ok |
| conflict resolve / entry create / grants / template create+edit | 25.6 / 22.9 / 23.9 / 11.4 / 12.9 KB | 85.0 / 82.3 / 81.8 / 69.8 / 71.3 KB | ok |
| pattern designer (`CmsPatternVersionDesigner`) | 19.6 KB | 81.4 KB | ok |
| taxonomy term form / version designer | 17.4 / 14.8 KB | 79.2 / 76.6 KB | ok |
| related content form | 13.0 KB | 74.8 KB | ok |
| governed pattern panel (mounted on the pattern page) | 30.4 KB | 90.3 KB (92463 B) | route over 92160 B |
| governed review detail island | 38.9 KB | 98.8 KB | island over 35 KB AND route over 90 KB |
Lazy max 51.3 KB (<= 80). Findings: the governed review detail island and the governed pattern panel route breach the budget (held lane; `use-governed-review-command` and the shared workflow code
are in that island). `CMS_EDITORIAL_ROUTES` in `scripts/verify-bundle-budget.mjs` omits the pattern, taxonomy, related and definition-review pages, and the existing
`tests/performance/cms-editorial-bundle-budget.test.ts` already fails 2 tests (`templates/[templateKey].astro` now hydrates `CmsGovernedTemplatePanel` too): outside my claim, root decides.

## Files (lines, SHA-256 at 13:57Z; paths under apps/web/src; new files are untracked)
| path | lines | sha256 |
|---|--:|---|
| `lib/safe-read-retry.ts` | 113 | `9c8c7bf4d66fe43849bae8b1d1df7c3a21d0461bda91b1974ff620c607028d43` |
| `lib/safe-read-retry.test.ts` | 230 | `fe29c7d2939bd3ec602c966ffeee78ce7596de4de9cfefb5b27a23748f920aea` |
| `lib/README.md` | 82 | `0819a9f6761bbcdcab3bc941f79c1f7157ea508bafe1ad894a32f602d1260a2a` |
| `components/cms-editorial/cms-editorial-entry-draft-detail-transport.ts` | 233 | `51ad11844b27d336e2787a00f622b9f80a18fc6e1ed9b0262560e5c7223544cf` |
| `components/cms-editorial/cms-editorial-conflict-detail-transport.ts` | 103 | `4dd79c9792417825ac742030eb16d18031047af420ff6021280b65df08322538` |
| `components/cms-editorial/cms-editorial-entry-editor-context.ts` | 210 | `900fbab1ba9e0c8a0157ed7f2e0b124d65aee795a02471d8ff4b0e6bb24cd925` |
| `components/cms-editorial/cms-editorial-entry-editor-save.ts` | 280 | `132ffc21457cae0233d760d5cf44ea7f134c5fb9269c0294b30e6fd5390124ef` |
| `components/cms-editorial/cms-editorial-entry-editor-controller.ts` | 185 | `b684194f8e0c6f522108471b275cac32bcbd5f93c6068737e52338fbf088807d` |
| `components/cms-editorial/cms-editorial-entry-editor-stale-base.ts` | 126 | `7e1f96e317c72c5e0ce5543ddd4c3a680e92e6912c9728b7c9863413c3eee309` |
| `components/cms-editorial/cms-editorial-conflict-controller.ts` | 323 | `822b095289fd26c949bf576a8e4bbf88cdb95ce3100a8c34f34cefac39119eff` |
| `components/cms-editorial/cms-editorial-conflict-controller.test.ts` | 298 | `e4e4f641d483f34521cd2aa28381b34156fd345272dc31f02feef4c7e2d365ca` |
| `components/cms-editorial/cms-editorial-conflict-controller.test-support.ts` | 104 | `d414bd96cec2800f3d298cc3aa128c2f79181a4d7a43b9857aae06b246b4935e` |
| `components/cms-editorial/cms-editorial-conflict-controller.rate-limit.test.ts` | 65 | `0a9eac6c1453616c6b2d651061dc18077d115e9c7bbd6be220a34957436deea9` |
| `components/cms-editorial/cms-editorial-entry-editor-rate-limit.test.ts` | 101 | `547bde1a2ac80323de522e19245df04c5ccacac28fcaea52003938aaea8dc676` |
| `components/cms-editorial/cms-editorial-read-retry.test.ts` | 165 | `572a24a4390b755bab5eebb2f082ad81f83ed3b6006ef38349fbda180a6e1946` |
| `components/cms-editorial/README.md` | 112 | `63cecc2ec3d477bb10860b05f9a3b542f7f61d1456c2bb211ab1d2ca66912922` |
| `components/cms-editorial-workflow/cms-workflow-canonical-read.ts` | 144 | `58da4cd02258cc3daa7c4a0661b1fbf9d83e1fb545a46922456405809b714f6b` |
| `components/cms-editorial-workflow/cms-workflow-canonical-read.retry.test.ts` | 155 | `db21554e3e503c4913bb77badf780b76584e5847619387c0ae4f2bd910fd8b2e` |
| `components/cms-editorial-workflow/use-cms-workflow-canonical.ts` | 107 | `066c18419472f1dc0cb945ea49849860bb69905d687d8f96c5d195ffab273910` |
| `components/cms-editorial-workflow/use-cms-workflow-canonical.test.tsx` | 180 | `a555efba388f15a41040fc2249f0d308ad55cd3bd802515f9f76cb52ac26de76` |
| `components/cms-editorial-workflow/CmsWorkflowRateLimitNotice.tsx` | 30 | `51d9cbd06d4dfbd8c5a7586ea5a320b6eae39b8ec06fdc3786119550883f622d` |
| `components/cms-editorial-workflow/CmsWorkflowRateLimitNotice.test.tsx` | 122 | `9886f4ae3e7d13383a19b7cf43a9c4ca801df7255aa39c6d47808607effce9b3` |
| `components/cms-editorial-workflow/CmsEditorialWorkflowIsland.tsx` | 158 | `a163cf60c1ad69ffabdfa1999fb3fc0bd3a5acb7a832a640e370c9f2e90f30c2` |
| `components/cms-editorial-workflow/CmsEditorialReviewDetailIsland.tsx` | 114 | `8e2f7ec3616e291fdf756a5f8ba790a89a439d5aed935f5bb915a061265333df` |
| `components/cms-editorial-workflow/cms-workflow-reviewer-options.ts` | 126 | `9694e7a828568d7b0d796b26326d955f2e7b8a20bc96e1480819f5500ff32175` |
| `components/cms-editorial-workflow/cms-workflow-reviewer-options.retry.test.ts` | 131 | `d409846e35c2ade7076a282fe24e7792783b773dfe91f5adfb2f6450d36d4403` |
| `components/cms-editorial-workflow/use-reviewer-options.ts` | 40 | `84ca7e2b7e1fe98f86c778682f8e4fe5ea05467d750c03cbedfcd59c79815b85` |
| `components/cms-editorial-workflow/CmsEditorialAssignmentCreate.tsx` | 244 | `663a7ee750453a592a3b48e4da26182cce6a43470f59a3cb86ed7f0fcad3180a` |
| `components/cms-editorial-workflow/CmsEditorialAssignmentCreate.rate-limit.test.tsx` | 146 | `7acc3e05b0ec53f0ae47338ea124c2d776bcdcaa122f6ec4d29420659eaba545` |
| `components/cms-editorial-workflow/CmsWorkflowCommandFrame.tsx` | 196 | `46ba5d5fe7c5544a597d6b370634bc7004a7c7bf5ee247a976bdaf7cdcec7c70` |
| `components/cms-editorial-workflow/CmsWorkflowCommandFrame.test.tsx` | 361 | `9ce91aaab41b6a7d2df346d8f052be91b29ed56c6d12ed0f496ed20a7214a52f` |
| `components/cms-editorial-workflow/README.md` | 141 | `7fcc404073816bf94555139227c897295bc7b37d48ccf19f5c557c6701f63b9b` |
| `components/cms-capability-grants/cms-capability-grant-client.ts` | 249 | `9f4ab05d51ba8a088c26420da0a328a8ca3e12c5dc2d1d18a4e6923e6e738e23` |
| `components/cms-capability-grants/cms-capability-grant-client.retry.test.ts` | 114 | `60a3f121606969fec51c2cd82afc882c86bc54f29e1bdb684f43b6d5897df4d1` |
| `components/cms-pattern-designer/pattern-latest-read.ts` | 161 | `d1be5a894924053b53839e797805e16ca672fdd8c792470ec2f7b1927dd997a4` |
| `components/cms-pattern-designer/pattern-latest-read.retry.test.ts` | 147 | `474d8adfdeedaae70446d964a44eddd9b92583b585f605bdbc73c63d2c687756` |
| `components/cms-pattern-designer/use-pattern-conflict.ts` | 104 | `98f6b72b1287422ecf0c72b5cdbffb6a2153fdc7aeac6d5573fc77a43cf56ff8` |
| `components/cms-pattern-designer/CmsPatternConflictPanel.tsx` | 103 | `b7b4ac9724449dc2f78b77013fa52cb7d07c97647286f5744351ece578fad6a9` |
| `components/cms-pattern-designer/CmsPatternVersionDesigner.tsx` | 192 | `cc74f73935bb00667c18c8524f6b0031e2e4621c7e05d07d5415c16d883c70eb` |
| `components/cms-pattern-designer/CmsPatternVersionDesigner.latest-rate-limit.test.tsx` | 138 | `14995ec68a1b4c310262a21226fa925909435a50f3a2e4dc1200fd78de5f9d14` |
| `components/cms-pattern-designer/CmsPatternVersionDesigner.form-contract.test.tsx` | 372 | `0ffdd32d5a2855d5deab371e648a486562b83b14bf45e14664e80af050807f45` |
| `components/cms-pattern-designer/CmsPatternVersionDesigner.results.test.tsx` | 350 | `a15af49e49c9a52d8b1a6741f968b5b1c056169d3759f0fa2812f427fe717e38` |
| `components/cms-pattern-designer/use-pattern-designer.ts` | 241 | `2146b284a0ffa4db82259d4470325d97522068056c77ffc8286089923b95d88a` |
| `components/cms-pattern-designer/use-pattern-blur-validation.ts` | 89 | `762be16f8fd8329ab57dc841b1c2d094a3f104998eeb7b11fecd0dbe9488fff4` |
| `components/cms-pattern-designer/pattern-designer-location.ts` | 16 | `8ab9bff754035f52e2ae7273dc3bca337f11dc3a5a8c6cdb07c612b888343a32` |
| `components/cms-pattern-designer/pattern-tree-state.ts` | 276 | `4f179ee192afaea36137c389184a12bf4b127345ce5f2546157caa2033f38817` |
| `components/cms-pattern-designer/pattern-tree-rules.ts` | 270 | `b42da4f832322cd1be7bf76bd10562ea2afece9266440433e85b576e9506f8f5` |
| `components/cms-pattern-designer/README.md` | 88 | `84d5b693cfda1bc8f44e5831ac4a83a77b6bfb845f43530493c1d29a8be41c54` |
| `styles/cms-editorial.css` | 309 | `28cf05cc84cd898facfc6c91b4c61f9581d589d512706b55a66caf1fc43b8a66` |
| `styles/cms-danger-action.test.ts` | 124 | `94bdafe1f840352726b67458acb42fe3f95f7f6a529487fa583d6a366fe6a42d` |
| `styles/README.md` | 35 | `8940d152acdafdc4ac9191028e452bbbde11b6fe557aa97bf8fd991b7569a59b` |

## Runs (pinned PATH, `flock -s /tmp/wejammin-quiet.lock`)
- RED seen before each fix (right reason): `safe-read-retry` 26 failed (functions absent); transports 8 failed; editor 429 3 failed; conflict form 2 failed; canonical read 12 failed; hook 7 failed;
  islands 2 failed; reviewer options 7 failed; assignment form 2 failed; grant list 4 failed; pattern latest read 6 failed; designer latest 429 3 failed; frame hook 1 failed; form contract 9 failed; danger CSS 3 failed.
- Mutation batteries (own harness: `<scratchpad>/claude_s12_web_polish_a/{vitest.mut.config.ts,mutate.py,battery*.sh}`; the mutant is served from the scratchpad, the worktree is
  never modified, sha256 checked after each group): 72 mutants over 24 files. First pass 66 killed, 6 survived; three were real gaps (props limit on blur, address encoding, address after a reconciled unknown outcome) and are killed by 3 added tests (re-run, 3/3); one
  (`editableKey` guard) was dead code and is deleted; two are equivalent: `visited.has(node key)` -> true (a node key never left cannot be invalid in a browser) and the `clearTimeout` cleanup in `use-reviewer-options` (a state update after unmount is a no-op). Logs: `battery-1/2/3.log`.
- Full `vitest run apps/web` (13:46Z): 558 files, 6835 tests, 6834 passed, 1 failed: `cms-governed-review/CmsGovernedReviewDetail.test.tsx` "retries_exhausted" (held lane, in-flight copy work; not mine). Earlier full run (13:28Z): 557/557 files, 6813/6813.
- `astro check` (apps/web, 1991 files): 3 errors, 0 in my files; all 3 in `cms-related-content/*.test.tsx` (related lane: `SAVING_UNAVAILABLE`, `status` on `never`). An earlier run found 4 errors in my two new tests
  (typings of `node:path`/`choose`); fixed.
- eslint `--max-warnings=0` and prettier `--check` clean on lib, styles, cms-editorial, cms-editorial-workflow, cms-pattern-designer, cms-capability-grants.
- Zero zod in the islands: `pattern-designer-static-closure.test.ts` and the island static-closure tests green (the new modules import no zod).

## Test corrections
1. `cms-pattern-designer/CmsPatternVersionDesigner.results.test.tsx` "ignores a second activation while a submit is in flight": the pending button was found by the name `Saving…` and asserted
   disabled; now found by `Save successor draft` and asserted disabled. FE03 :1223 "disable only commit action, preserve width/label, expose pending text" contradicts the label change.
2. `cms-editorial/cms-editorial-conflict-controller.test.ts`: `setup`, `init`, `resolved`, `twoPaths`, `bodyOf` moved verbatim into `cms-editorial-conflict-controller.test-support.ts` so the new
   rate-limit file can share them (the file would exceed 400 lines otherwise); no assertion changed (14/14 before and after).
No `degraded` oracle of the canonical read changed (the 429 is a `rateLimit` member on `degraded`).

## Spec citations
FE03 :1172-1173 (network and retry), :1223 (form contract), :1736-1745 (bundle budgets), :883; DESIGN.md Components > Buttons; BE00 172 (retryable); BE03c 1314 (server retry).

## Open items / BOUNDARY
None new. Held items below are inventory, not stubs.

## Requests to root
1. `cms-governed-review/CmsGovernedActivationForm.tsx:41-51`: replace the text lookup with `document.getElementById(`${FRAME_HEADING_ID}-check`)?.focus()` and drop `CHECK_STATE_LABEL` (the existing pending test stays valid).
2. Adopt the sweep in the held files (same code as here): governed canonical read (wrap in `retryingSafeRead`, add `rateLimit` on the `degraded` result for a 429) and mount
   `<CmsWorkflowRateLimitNotice rateLimit={canonical.rateLimit} />` in `CmsGovernedReviewDetailIsland`; `CmsGovernedAssignmentForm` use `useReviewerOptions` and render the `rateLimit` notice
   (the shared `loadReviewerOptions` already retries and now returns `unavailable` + `rateLimit`, which that form ignores today); `cms-template-edit-reconcile.ts`, `related-candidates.ts` retry; taxonomy
   terms/versions and template reconcile carry `retryAfterSeconds` like `pattern-latest-read.ts`.
3. Apply `cms-danger-action` to Retire (DEC-191 phase 2).
4. Bundle: governed review detail island (38.9 KB) and the pattern page route (92463 B) breach FE03 budgets; add the pattern/taxonomy/related/definition-review pages to `CMS_EDITORIAL_ROUTES` and fix the
   2 failing `tests/performance/cms-editorial-bundle-budget.test.ts` cases (templates page hydrates two islands). The workflow route has 0.2 KB headroom.
5. Not mine, seen: `CmsGovernedReviewDetail.test.tsx` retries_exhausted failure; 3 astro check errors in `cms-related-content` tests.

## Fix pass 1 (lane `claude_s12_web_polish_a_f1`)
Started 2026-10-15T16:44Z, finished 2026-10-15T17:35Z. HEAD `b16edb54`. Brief `briefs/web-polish-a-f1.md` (review VERDICT PARTIAL, F1-F8). Scratch (logs, harness, mutants): `/tmp/claude-1000/-home-rob-Projects-WeJammin/5e403708-915a-4cd3-958f-4ebc866d0c82/scratchpad/claude_s12_web_polish_a_f1/`.

### Status
GREEN. F1-F8 fixed, each RED first (failing run seen, right reason). Full `apps/web` Vitest 581 files / 7041 tests passed (17:15-17:29Z, log `full-web-1.log`; this includes the previously failing held `CmsGovernedReviewDetail` test, now passing in the shared tree); `astro check` 0 errors / 0 warnings (log `astro-check-2.log`); eslint `--max-warnings=0` and prettier `--check` clean on lib, styles, cms-editorial, cms-editorial-workflow, cms-pattern-designer, cms-capability-grants and the CMS pages. Only `lib/safe-read-retry.ts` is shared with Web polish B: I re-read it right before editing (SHA unchanged `9c8c7bf4...`) and changed only the `WHOLE_SECONDS` regex.

### Findings fixed
- **F1 (major)** editor draft re-read 429 after a 409. `cms-editorial-entry-editor-stale-base.ts`: the wait now runs the READ again (`handleConflict`), never `resend()`. Each limited read spends one unit of `ctx.rebases` (same budget as the rebase, M2), so a read that keeps answering 429 ends in `sync-conflict` with a new copy (`SAVE_COPY.readLimit`, "Reading the current version is still rate limited ..."). The wait is announced as a read limit (`readWaitingMessage`: "Too many requests while checking the current version. Retrying in N seconds. Your unsent edits are kept."). New `ctx.readWait` (context) gates `attempt()` during the wait, and the timer holds `ctx.inFlight` during the re-read, so autosave cannot write a stale save meanwhile (found by RED: edits typed during the wait did POST). "Load current" cancels the wait (controller). RED: 4 failed (stale POST re-sent; edits wrote during the wait). Spec: FE03 :1172-1173 ("429 waits for Retry-After"; commands never get added retries; "Mutations reuse idempotency and reconcile status first"), brief ("do NOT add retries to commands").
- **F2 (major)** pattern designer commit control. Test correction 1 of the first pass is reverted. New `CmsPatternCommitButton.tsx` shows `Saving…` while pending (FE03 :1043, :898, :974, :1257; DESIGN.md :187), only it is disabled, `aria-busy`, status text kept, and the idle width is kept as inline `min-inline-size` (measured in a layout effect from the last idle render, so no visible shrink; cleared on settle). RED: 4 failed. FE03 :1223 "preserve width/label" is satisfied for width and read together with :1043/:1257 for the label; no conflict was left for root.
- **F3** node-key blur: the "equivalent mutant" claim is withdrawn; killing test "does not judge a node key being typed into before it was left, even after another control was left". Production code was already correct.
- **F4** `cms-danger-action` was only effective under `#cms-editorial-main`. Now `styles/cms-danger-action.css` (unlayered; own `--cms-danger` and `--cms-danger-surface` with a UI `--color-panel` fallback, because registry and template pages load no UI tokens), scoped by `:is(#cms-editorial-main, #content-schema-registry-main, #cms-template-main) button[type].cms-danger-action`. Loaded by `CmsEditorialDocument.astro` (15 pages) and by import in the 6 pages with their own shell (capability-grants, index, versions/[versionId], schema-reviews/[reviewId], templates/new, templates/[templateKey]; one added import line each, files re-read before editing). `cms-editorial.css` lost its copy of the rule and the token. The commit button of `CmsCapabilityGrantRevokeConfirmation` carries the class (new test), so the grants page really shows it; Retire (polish B file) already does. `cms-danger-action.test.ts` now checks, per page of all 21: it loads the sheet and its `<main>` id is in the scope; the scope selector as written in the CSS matches a button in each of the three mains (jsdom `matches`) and nothing outside; the sheet is unlayered while the editorial sheet is layered; the registry, grant and template sheets use no id selector, no `!important`, no layer; contrast >= 4.5:1 both states; the fallback equals the UI panel token. RED: 9 failed.
- **F5** `cms-editorial-conflict-controller.ts` 323 -> 296 lines by pure extraction to `cms-editorial-conflict-request.ts` (`unresolvedConflictFieldIds`, `conflictResolveRequest`, `attemptsWaitingMessage`), with a unit test; the 14 controller tests are unchanged and green.
- **F6** `use-cms-workflow-canonical.ts`: unmount cleanup bumps `sequence` before clearing the wait, so an in-flight read answering 429 arms no timer. RED: read called twice.
- **F7** both rate-limit notices are live regions mounted empty (`role=status`, `aria-live=polite`, `aria-atomic=true`) and updated: `CmsEditorialAssignmentCreate.tsx`, `CmsPatternConflictPanel.tsx`. RED: 4 failed. Not done (not in the brief): a countdown or gate on the manual paths.
- **F8** `lib/safe-read-retry.ts`: `WHOLE_SECONDS = /^\d+$/u` (RFC 9110 `1*DIGIT`), the 1..86400 range check is unchanged; `007` -> 7. RED: 4 failed. Every other behaviour is unchanged (117 lib tests green).

### Files (lines, SHA-256 at 17:34Z; paths under apps/web/src; new files are untracked)
| path | lines | sha256 |
|---|--:|---|
| `components/cms-editorial/cms-editorial-entry-editor-stale-base.ts` | 157 | `9a60891c627518168674ac33e27fbe46efe01f42f5dff9fd73a9d8f73894a2b8` |
| `components/cms-editorial/cms-editorial-entry-editor-context.ts` | 217 | `77c80344a4008a3d7090058302fb56cc89d1f9a44997f37dcffc73980b333ee1` |
| `components/cms-editorial/cms-editorial-entry-editor-save.ts` | 286 | `52f58309ba34f5e608efb4b46a2c6e31d72d604d6b53512a643341a2a7890011` |
| `components/cms-editorial/cms-editorial-entry-editor-outcomes.ts` | 88 | `4524e7db531e3dee84f479b302594b2063a9fb2be88219d0624c6b40c03057c8` |
| `components/cms-editorial/cms-editorial-entry-editor-controller.ts` | 188 | `d20796532e4d52e955aaafe56e94ab934b726a3a8f70ecc6ec965399d1e72aba` |
| `components/cms-editorial/cms-editorial-entry-editor-rate-limit.test.ts` | 245 | `1975d3ba888021cb1eb4979725f829d81115eb8fc1eb5de4d139cd15211bdff9` |
| `components/cms-editorial/cms-editorial-conflict-controller.ts` | 296 | `57114ef5602d156c4668016e730cc6f9960cf295c610ca69b12d4454b18955d6` |
| `components/cms-editorial/cms-editorial-conflict-request.ts` | 59 | `3d62ba8774edc94a0e03a38e26bc8cf80493c91cfc4e57bf628805ad62110a84` |
| `components/cms-editorial/cms-editorial-conflict-request.test.ts` | 100 | `af2b38af955a5f5973616b0a69b2c52a255ffd558cfaa72b6aefb7914c57ed53` |
| `components/cms-editorial/CmsEditorialDocument.astro` | 56 | `fc3141df33c4a5a4b882b5596d3b895f08d2168b51e9082bac0d57133e1d54d3` |
| `components/cms-editorial/README.md` | 115 | `af3131e0fb274a16dddb62b6a8e36b74dbfa85448915464ceade85ddbb8c42d1` |
| `components/cms-editorial-workflow/use-cms-workflow-canonical.ts` | 114 | `8bfd811e2798b2929469e2b5d4574427a6a6bdc9766cca30863ecf618be9d7be` |
| `components/cms-editorial-workflow/use-cms-workflow-canonical.test.tsx` | 198 | `bb2754d6b5631015deb5b6076a4c76c7cdfc90f6dc982f637ca107e8b9881405` |
| `components/cms-editorial-workflow/CmsEditorialAssignmentCreate.tsx` | 250 | `074b98cb58921e830e9dd5111c16656d6e30bf933cc73b7efcac7c344c353c37` |
| `components/cms-editorial-workflow/CmsEditorialAssignmentCreate.rate-limit.test.tsx` | 153 | `ec491a43bae54d305afdffad0c9d7ce76e4d37cf4d28342fd7d9b372629df241` |
| `components/cms-pattern-designer/CmsPatternCommitButton.tsx` | 43 | `92cfa0f1074846b4b894a824234bc33b1588f1f0554e7aeff6f55377ff801855` |
| `components/cms-pattern-designer/CmsPatternVersionDesigner.tsx` | 191 | `c59bb667f793e2bbcfceb04a397bfdda4939370486f78e1782751db3423f3b23` |
| `components/cms-pattern-designer/CmsPatternVersionDesigner.form-contract.test.tsx` | 307 | `7ce45ae9d2988c041c7a196d6b46be55be7ff21fb8d24e113236bd765c65d8fc` |
| `components/cms-pattern-designer/CmsPatternVersionDesigner.submission.test.tsx` | 153 | `1c677585f30a17b9e0ad518f93f2a47d8263b55f195ea9069d96cfc2752f92ed` |
| `components/cms-pattern-designer/CmsPatternVersionDesigner.results.test.tsx` | 350 | `15e672ab326e399c6faf4d86a2087d11db70ccfbee088ff7b560d2396dd227e3` |
| `components/cms-pattern-designer/CmsPatternConflictPanel.tsx` | 109 | `f5c849ef5532e22ab7a697c27cf1cd47d738ba7493c0fe01511cf443098db7cd` |
| `components/cms-pattern-designer/CmsPatternVersionDesigner.latest-rate-limit.test.tsx` | 147 | `bc049b54a5fe9dfcd28ab0507a8dcf8781b04e0c935008c9f8f92abb161bbb2d` |
| `components/cms-pattern-designer/README.md` | 89 | `98bd698ca2bbafdb5338199b2952ea9ae748cc0d5867f0ef6ac954c58186e2ec` |
| `components/cms-capability-grants/CmsCapabilityGrantRevokeConfirmation.tsx` | 143 | `bbcc9c8798276012d97276c0d94466e2fd2eccc77de66d0e9ba6ee11b75e6863` |
| `components/cms-capability-grants/CmsCapabilityGrantRevokeConfirmation.danger.test.tsx` | 43 | `794b1e31de0ebc7711a7d96ee86e4ddde761ffcd93aa08cdbf42dc304b2f2f2b` |
| `components/cms-capability-grants/README.md` | 97 | `2799f312da8bc7931c1cf23a6de5b5e375789b7ccce0cf7939ae954e594158c3` |
| `lib/safe-read-retry.ts` | 114 | `41717f9c39aadc6cafb358ed588db41760616cd4bb41926f25861fcd00888991` |
| `lib/safe-read-retry.test.ts` | 247 | `cb515c3062a75b8eb1f1c9e7ff4d602a1d767eeefa207370ab24b34277b86c3d` |
| `lib/README.md` | 82 | `cf297985b804b540d5a8794920e53da688bed2b85977cff67fb0e62d58a03afe` |
| `styles/cms-danger-action.css` | 30 | `df03623593a594e78a185e7913257bb221bcffff1c1c4d69b45a1184fd04a1fc` |
| `styles/cms-danger-action.test.ts` | 230 | `e308d77eb0d1705e7f6ea637241f4a21ff59f12d0e3207a48ac4f21300d920b7` |
| `styles/cms-editorial.css` | 293 | `ffcafd5d5f08547b401db540a7e96e81925fdbbb9a18252f1c9958701722847f` |
| `styles/README.md` | 39 | `d69d23445e2baaf25cc0eba1b324045c6e87a1e30f765826ee1895b643e74dde` |
| `pages/app/cms-content-modeling/capability-grants.astro` | 136 | `0180d58eb0d48e0096036991b3cc8f1f7a24dd37ce64adad3a13efc4e1599ccb` |
| `pages/app/cms-content-modeling/index.astro` | 173 | `b386ce171614f3ee9f0b2bdd3a9f2b802f8a6af10dd10195ec80c090b52470cd` |
| `pages/app/cms-content-modeling/[contentTypeId]/versions/[versionId].astro` | 183 | `6150107370ffa87e74ae6bf1e0679429b16fe0872d8040505f12cdafe16381d4` |
| `pages/app/cms-content-modeling/schema-reviews/[reviewId].astro` | 157 | `e5fb30247f2ac6761e246c2a7e7175a4d42fcde6c5f2acda7e991f798bbf7e0c` |
| `pages/app/cms-content-modeling/templates/new.astro` | 124 | `d0c16b1ecc823e2f408c143f1e0df3869e709fe680f33b8761a796ad1839df0c` |
| `pages/app/cms-content-modeling/templates/[templateKey].astro` | 204 | `2ab50fb3d4470667384065c185cc3ab216974513ff89b91763793a83e2a56e7a` |

`styles/cms-danger-action.css`, `...CmsPatternCommitButton.tsx`, `...conflict-request.ts` (+test), `...submission.test.tsx`, `...RevokeConfirmation.danger.test.tsx` are new.

### Runs (pinned PATH, `flock -s /tmp/wejammin-quiet.lock`)
- RED logs: `red-f1.log` (4 failed), `red-f2.log` (4), `red-f4.log` (9), `red-f4b.log` (2), `red-f6.log` (1), `red-f7.log` (4), `red-f8.log` (4). F3 and F5 have no behaviour change (killing test / pure extraction).
- Mutation checks on scratch copies (the worktree files were never modified; SHA verified unchanged after every group; logs `battery-1.log` ... `battery-6.log`): harness `vitest.mut.config.ts` + `mutate.py` serve the mutant from the scratchpad; `mutate_mirror.py` mutates a scratch mirror (`mirror/`, with the CSS, pages and test copied) for the test that reads files as text. 79 mutants ran in batteries 1, 2 and 4 (plus 1 pattern that did not match), then re-runs in 5 and 6: first pass 71 killed, 8 survived (5 handled, 3 equivalent). Handled: (a) `ctx.inFlight = true` on the re-read: survived, new test "writes nothing for edits typed while the second read is in flight either", re-run killed; (b) controller discard without `readWait = false`: survived, test extended (a later edit must save), re-run killed; (c) `descriptor === undefined` guard in the request helper: survived, unit test added, re-run killed; (d) `if (idleWidth.current > 0)` -> true: survived, test "sets no minimum width when the idle width could not be measured", re-run killed; (e) the stylesheet fallback colour mutant did not match its text (fixed pattern), and the `<CmsEditorialDocument` page check was too weak (matched the word anywhere): detection now requires the opening tag; both re-run killed. Equivalent, left: `entry?.choice ?? 'base'` in `conflictResolveRequest` (unreachable: submit refuses a path without a choice first; kept verbatim from the original code) , `visited.size === 0` early return in `use-pattern-blur-validation.ts` (a performance shortcut: with nothing visited no item is produced either way), and `/^\d+$/` -> `/^\d*$/` in `safe-read-retry.ts` (an empty value is 0 and the range check rejects it).
- Full `vitest run apps/web`: 581 files, 7041 tests, all passed (819 s). Focused groups were green after every change.

## Test corrections (fix pass 1)
1. `cms-editorial-entry-editor-rate-limit.test.ts`, first describe (3 tests replaced by 7). The old oracle answered the re-sent *stale* POST with 201 `revisionCreated`, a reply the server cannot give for a stale base (409 for a stale `expectedVersion`), and so hid an extra write. Now the sequence is POST 409, GET 429, wait, GET 200 (`draftDetail`), then the one bounded rebase POST with the new base; the tests assert the exact call methods (`['POST','GET','GET','POST']`), that exactly one POST precedes the rebase, the rebase budget, and no write while waiting. The "failed read ends in sync-conflict" test is unchanged. Cites FE03 :1172-1173 and the brief ("do NOT add retries to commands").
2. `CmsPatternVersionDesigner.results.test.tsx` "ignores a second activation...": reverted to the original oracle (the pending button found by `Saving…`), the diff is the one line `buttonNamed(container, 'Saving…')` plus its comment (FE03 :1043, :898, :1257).
3. `CmsPatternVersionDesigner.form-contract.test.tsx`: the three first-pass pending-label oracles (`changed` controls textContent, "keeps the commit control name ...", "is not busy") now expect `Saving…` while pending and the idle label after; the file was 415 lines after the F3 test, so the whole `submission` describe moved verbatim, with these changes and two added tests (width kept; no width when unmeasured), to `CmsPatternVersionDesigner.submission.test.tsx`; the `completion` and `validation` describes did not change.
4. `CmsEditorialAssignmentCreate.rate-limit.test.tsx` and `CmsPatternVersionDesigner.latest-rate-limit.test.tsx`: `expect(container.querySelector('[data-cms-...-rate-limit]')).toBeNull()` (3 places) became "the region exists and its text is ''", because the region is now mounted empty (the brief: update an existing empty live region instead of inserting a pre-filled one). Two tests also assert that the same element receives the text.
5. `safe-read-retry.test.ts`: `'01'` moved from the refused to the accepted headers (RFC 9110 delay-seconds `1*DIGIT`); added accepted `007`, `0086400`, 30 zeros + 7; refused `00`, `0086401`, `+7`, `1e2`, `0x10`, 40 nines.
6. `styles/cms-danger-action.test.ts` rewritten around the new stylesheet (the old "CMS-wide" string-absence test is removed as vacuous, per F4); the contrast, hue and rule oracles are kept.

## Spec citations
FE03 :1172-1173 (network and retry), :1043, :898, :974, :1257, :1223 (pending label and form contract), :1736-1745 (budgets, untouched); DESIGN.md :14 (Danger), :187 (stable loading state); RFC 9110 5.6.1 / 10.2.3 (delay-seconds); BE00 :172 (retryable).

## Open items / BOUNDARY
None new. Not measured: bundle sizes after this pass (the new button adds about 0.4 KB gzip to the pattern island, the editor gains the read-wait branch; the workflow route had 0.2 KB headroom and this pass changed `CmsEditorialAssignmentCreate.tsx` in that island by a few bytes). Root re-measures after polish B with a persisted log, as the review asked.

## Requests to root
1. Re-measure the bundle budgets (workflow route headroom was 0.2 KB; `CmsEditorialAssignmentCreate` and the editor changed).
2. Retire (`CmsGovernedActivationConfirm.tsx`, polish B) needs no change: its `cms-danger-action` class is now effective on definition-review, pattern and template pages. `CmsReviewerOptionsNotice.tsx` (not mine) still inserts its 429 paragraph pre-filled; give it the same empty live region if polish B wants F7 parity.
3. `docs/` tracking of this pass is not updated by the lane.

## Root independent readback and negative-control correction — 2026-10-16

Independent `gpt-6.1-sol` / `ultra` review clears F1–F8 and verifies all 39 final fix-pass manifest hashes. It separately finds an inherited unknown-outcome admission race in `use-pattern-designer.ts`: pending/in-flight ends before the canonical GET settles. That source still matches the original report hash; this is not a refutation of the eight fixes. Root has released new test-only RED coverage under `phils_pattern_pending_20261016`; production correction and fresh review remain required. No slice or phase acceptance follows from the bounded CLEAR categories.

The earlier initial-battery total of 71 KILLED / eight SURVIVED is a count of harness labels, not 71 assertion-backed kills. `battery-2.log` labels the width-reset mutant KILLED with `Tests no tests`; the harness counted any nonzero exit. Of those initial 71 labels, only 70 show failed assertions. The zero-test attempt is invalid mutation evidence, not a successful kill. Existing later re-run receipts retain their historical scope; this correction does not invent a new aggregate unique-mutant total.

Root now supplies the missing meaningful negative control. A temporary Vite pre-transform removes only `button.style.minInlineSize = '';` from `CmsPatternCommitButton.tsx` in memory, leaving repository bytes unchanged. The transform loads exactly once. The existing submission suite runs six tests: five PASS / one assertion FAIL at `CmsPatternVersionDesigner.submission.test.tsx:122`, where the settled width incorrectly remains `168px` rather than empty. No import/setup abort or zero-test surrogate. Exit 1 is the intended negative result. The subsequent unmodified run exits 0 with six PASS / zero FAIL. Source SHA-256 remains `92cfa0f1074846b4b894a824234bc33b1588f1f0554e7aeff6f55377ff801855`, matching the final manifest.

- Negative receipt: `/tmp/wejammin-codex-pattern-width-KlTnK2/mutant.json`, SHA-256 `8b3567ff7a56e050ed064278ed286a57650a5047e642808ce61e0fb82ef5864a`.
- Restored receipt: `/tmp/wejammin-codex-pattern-width-KlTnK2/restored.json`, SHA-256 `602fcc417de7611f2e9348fef89065dd92453c2301e423c65a443a9baf04cbf0`.
- Diagnostic config: `/tmp/wejammin-codex-pattern-width-KlTnK2/vitest.width-mutant.config.mts`, SHA-256 `2b6f36898c35a354863690b286b75f7f08763e06bfa5c269c4ead438b3d8d23a`.

Bundle remeasurement, the inherited race correction, canonical gates and hosted evidence remain outstanding. This note records validation evidence; it changes no executable source or assertion.
