# review V11: lane claude_s12_web_realroute (web code-split, bundle gate, load-on-intent)

Reviewer: V11, independent (did not author the lane). Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, branch `claude/phase2-slice12`, HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e` plus a large uncommitted tree. Read-only except this file. No database, docker, supabase or real-route Playwright was used. Everything below was measured or read by me; nothing is copied from the lane report unless it says "lane".

## Bottom line

The gate machinery is sound and tested, the files table is exact, and request identity (idempotency key, `If-Match`, body) is unchanged on every path I drove, including the pre-hydration replay. What is not ready: (a) the new dynamic imports have no failure path, so one failed chunk fetch wedges a form or disables editor saving for the tab (H1); (b) the exemption list is false for `contracts`/`validators` (zod loads when an assignment form mounts) and silent about viewport-armed and landing-armed chunks, so "all 20 routes under budget" is a statement about the gate, not about Chrome (H2, M1, M4); (c) the pre-hydration lock is unexplained, drops keystrokes, and has a lossless replacement (M2). Do not close Slice 12 on this lane's evidence: fix H1 and H2, decide M1, resolve M2, add the tests of M3, and add the governed real-route spec of section 5 (AC-273).

## 1. Verdict

| # | Area | Verdict | Why (finding ids below) |
|---|---|---|---|
| 1 | Behaviour equivalence | FIX FIRST | Requests are identical and the pre-hydration replay is exactly once (proved in Chrome on the real components), but every lazily loaded answer module has no failure path: one failed chunk fetch wedges the form (H1). The core "no double submit" guard has no test that fails when it is removed (M3). |
| 2 | Accessibility of the lock | FIX FIRST (small) | Lock is unannounced and unexplained, silently discards keystrokes, and Tab skips the radios (M2). A cheaper, lossless alternative is proved (seed the controlled state from the DOM). |
| 3 | `CMS_ON_DEMAND_CHUNKS` exemptions | FIX FIRST | 21 of 29 exemptions are true. `contracts` and `validators` are false for the reviewer-options read that fires when an assignment form mounts (H2: the gate says 91,743 for an owner on the editorial review detail, the same route with that read charged is 146,667). Four governed form stems and two result stems are viewport/landing dependent and unmeasured (M1, M4). |
| 4 | Edited tests (timing) | ACCEPT | No assertion weakened, none vacuous: diffs, a pre-lane vs now title comparison over the whole web suite, and mutation probes agree. One deliberate polarity reversal is documented (L3). |
| 5 | Margins 373/417 B and Node sensitivity | ACCEPT (harden) | Deterministic in CI: `.node-version` 22.23.1 through `actions/setup-node`; two independent builds give identical bytes. System Node 26.11.1 adds 660 to 801 B per route and fails three routes (L1). Margins are real but thin. |
| 6 | Governed real-route spec | REQUIRED before Slice 12 closes | P2-S12-AC-273 is open and names these journeys; no existing real-route spec drives any governed review route. Concrete spec in section 5. |

Counts by severity: High 2 (H1, H2), Medium 4 (M1, M2, M3, M4), Low 7 (L1 to L7). Confirmations (what holds) are listed in section 7.

## 2. What I ran (evidence base)

All commands from `/home/rob/.codex/worktrees/phase2-slice12/WeJammin` with `PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH` (Node v22.23.1, pnpm 11.24.0) unless a different Node is named.

- Files table receipt: all 109 SHA-256 values and line counts in `lane-web-realroute-files.md` match the working tree now (0 mismatches, 0 missing).
- Pre-lane states: the lane backup tars (lane scratch `backup/`) extracted oldest-first into my scratchpad. 52 backed-up files differ from their backup; all 52 are in the files table; 0 differ and are unlisted. Tracked files diffed against `git HEAD`. Limitation: files edited before their backup (lane disclosed nine) have no recoverable before-state; I compensate with the title comparison in 4.
- Gate: `node scripts/verify-bundle-budget.mjs` against the existing production `apps/web/dist` (built 12:42, after the newest source edit 12:24): exit 0, `passed: true`, all 20 CMS routes equal the lane table byte for byte (entry editor 91,787 headroom 373; review detail 91,743 headroom 417). Same command under system Node v26.11.1: exit 1 (see L1).
- Gate variants: copies of the gate script in my scratchpad with named stems removed from the exemption list, run read-only against the same `dist` (no repo file touched). Static models, not Chrome measurements.
- Vitest, non-DB: targeted workflow + governed + closure + performance suites 103 files / 1,105 tests pass; the lane's full command `vitest run apps/web tests/performance tests/integration/phase-02-slice-10-ev-eb-web-focus.test.ts tests/integration/phase-02-slice-10-ev-eb-web-restore.test.ts` gives 688 files / 8,216 tests pass (identical to the lane's count). `eslint --max-warnings=0` and `prettier --check` on the lane's 109 files: exit 0.
- Chrome harness on the REAL components (esbuild bundle with code splitting, `import.meta.env` set as in the shipped client/server builds, server HTML from `renderToString`, hydrated with `hydrateRoot` in installed Google Chrome through Playwright; local loopback server; API stubbed with `page.route`): real `CmsGovernedReviewPanel`, `CmsGovernedReviewDetailIsland`, `CmsEditorialReviewDetailIsland`. Chunk names and byte sizes differ from the shipped Rolldown build; the point is WHAT is requested and WHEN. Sources and outputs are summarised in appendix B (scratch: `.../scratchpad/review_v11/h1`, `h2`).
- Ad-hoc Vitest probes run from my scratchpad through a config that imports the repo config (repo untouched): editor save-flow rejection, taxonomy designer wedge, mutation spot-checks (appendix C).

## 3. Findings

### H1 (High, area 1): lazily loaded answer machinery has no failure path; one failed chunk fetch wedges the form

The lane added dynamic imports in these places: the workflow transport, refusal classifier and canonical read (`cms-workflow-answer-machinery.ts`, `CmsEditorialWorkflowIsland.tsx:60`), the governed transport, refusal and canonical read (`governed-answer-machinery.ts`, `CmsGovernedReviewDetailIsland.tsx:61`), the editor save flow (`cms-editorial-entry-editor-controller.ts:71`), and the taxonomy, term and locale submit modules. None of these new imports has a failure path.

Code (exact lines):
- `use-cms-workflow-command.ts:73` `send: async (request) => (await loadWorkflowTransport()).sendWorkflowCommand(...)`; the controller sets `phase: 'pending'` before it awaits `options.send` (`cms-workflow-command-controller.ts:254-255`) and has no catch, so a rejected import leaves `pending` forever and `submit` ignores every later call (the "exactly once" guard at the top of `submit`). `settle` has the same shape for the refusal classifier (`:232`), and `use-governed-review-command.ts:81,88` for the governed pair.
- `use-cms-workflow-canonical.ts:27` documents "Resolves true when the read verified; never rejects", but the default `readWorkflow` / `readReview` are now `async () => (await import(...)).read...` (`CmsEditorialWorkflowIsland.tsx:60`, `CmsGovernedReviewDetailIsland.tsx:61`), so `refetch` can reject after it has already set `status` to `refreshing`.
- `cms-editorial-entry-editor-controller.ts:71-75` caches the import promise (`loadedFlow ??= import(...).then(...)`): a rejection is cached for the life of the page, so every later `saveNow()` and every autosave rejects and nothing is ever retried; the autosave `onFailure` path (`flow.reconcile()`, `:78-80`) adds an unhandled rejection of its own.
- `use-taxonomy-designer.ts:19,112-115`, `use-term-form.ts:15,186-189`, `use-locale-variant-form.ts:26,167-172`: `inFlightRef.current = true; setStatus({kind:'pending'}); const result = await submit(...)` where `submit` is now `import(...)` then the call; the `inFlightRef.current = false` line is never reached on a rejection.

The repo's own convention is the opposite, which makes this an omission rather than a style choice: `cms-workflow-command-transport.ts:216-218` turns a failed validators import into `{ kind: 'local', reason: 'validators_unavailable' }` ("nothing was sent"); `use-cms-editorial-entry-create.ts:206-208` and `cms-editorial-conflict-controller.ts:73,87,201` use `.catch(() => null)` and report; `cms-editorial-entry-editor-save.ts:35-46` maps an unreachable runtime to a replayable unknown outcome (`TRANSPORT_UNAVAILABLE`); `use-cms-template-validators.ts` returns `null` and sends nothing.

Evidence (all mine):
- Chrome, real governed panel, `governed-review-command-transport` chunk request destroyed by the server: after the first click `aria-busy="true"`, `aria-disabled="true"`, 0 POSTs, 0 `role=alert`, page error "Failed to fetch dynamically imported module". A forced second click, and a third click after the network was healed: still `aria-busy="true"`, 0 POSTs. Only a reload recovers (appendix B, scenario E).
- Vitest probe, editor controller with the first `createCmsEditorialSaveFlow` call throwing: three consecutive `saveNow()` calls reject with the same error, the factory ran once, 0 requests, phase stays `dirty`, no message; the autosave path produced an unhandled rejection.
- Vitest probe, `CmsTaxonomyVersionDesigner` with its submit chunk unavailable: the button reads "Saving…" after the click and after a second click, 0 alerts, unhandled rejection.

Why it matters: FE03 treats pending as a transient state ("Submission", :1257-1264: "expose pending text ... ignore duplicate activation"; unknown outcomes reconcile then retry, :2696). A pending that never ends and cannot be retried has no counterpart there. A stale tab after a deploy (hashed chunk names vanish) or a dropped connection hits exactly this. The typed input is not destroyed, but the form cannot be submitted again without a reload that discards it.

Fix: wrap each new dynamic import in the existing catch-and-report convention (transport: a `local` refusal with copy "nothing was sent, check your connection"; refusal classifier: fall back to the generic fixed copy; canonical read: `{ kind: 'degraded' }`; hooks: reset `inFlightRef`, set a visible status; editor: clear `loadedFlow` on rejection and route the failure into the existing unknown-outcome replay). Add one rejecting-loader test per module (the repo has none: `grep` for a rejecting `loadWorkflowTransport`/`loadGovernedTransport`/`import(` failure finds nothing in the lane's tests).

### H2 (High, area 3): the `contracts` and `validators` exemptions are false; the gate hides a 55 KB chunk that loads at mount

`CMS_ON_DEMAND_CHUNKS` (`scripts/verify-bundle-budget.mjs:815`) exempts `contracts` (`:817`) and `validators` (`:822`) with the reason "load on the first check that needs them (a form focus or a command send)". But `useReviewerOptions` (`use-reviewer-options.ts:21-27`) runs `loadOptions()` in a mount effect, `loadReviewerOptions` reads the capability grants list and then `loadedCmsValidators() ?? (await loadCmsValidators())` (`cms-workflow-reviewer-options.ts:82`). Both assignment forms use it (`CmsEditorialAssignmentCreate.tsx:61`, `CmsGovernedAssignmentCreate.tsx:59`). The editorial review detail mounts that form at hydration for an owner (`permitted.has('assign_reviewer')`, no intent gating: the lane left it on `loadView`), so zod is fetched in the cold load.

Evidence:
- Built output: `cms-workflow-reviewer-options.k0_MEgf1.js` contains the mount effect and imports the loader in `cms-contract-validators.uywOdkrD.js`, which dynamically imports `validators.DdBRgK2_.js` with `mapDeps` `[contracts-client-editor, contracts.B2yGpLTb.js (51,357 B gzip), contracts-client, contracts-client-rules, contracts-client-workflow]`.
- Chrome harness, real `CmsEditorialReviewDetailIsland` as owner, no interaction: JS requests include `CmsEditorialReviewAssignmentForm-*.js`, `validators-*.js` and the zod chunk, plus an API call `GET /api/v1/cms/capability-grants` at cold load.
- Gate variant with `contracts` and `validators` charged: CMS review detail 91,743 becomes 146,667. The other rows that jump (workflow 143,449, template create 129,613, template edit 136,824, capability grants 140,195, related content 135,778) are over-charges: those routes fetch zod on a form focus or a send (the workflow route is confirmed by the root real-route spec, which asserts no contract chunk before a form needs it; the template routes by `use-cms-template-validators.ts`).

So for an owner opening an editorial review the cold load is about 146.7 KB gzip while the gate reports 91.7 KB with 417 B headroom; the same read fires on the governed assignment form as soon as it hydrates (see M1).

Fix, in order of preference: (a) make the reviewer-options read wait for a sign of intent (focus or open of the reviewer select, or the region arm), so the exemption becomes true; (b) otherwise charge it (remove the stems from the list for the routes whose mount path fetches them, which needs a per-route list, see below). In both cases correct the reasons and `tests/performance/README.md` ("the modules the real islands load after hydration": mount effects run after hydration and are in the Chrome cold load). Structural weakness behind H2: the exemption is global by stem and the only check on a reason is `length > 20`. Per-route `onDemand` sets, or a Chrome-measured cold load per role for the routes that mount an effect-driven read, would stop this class of error.

### M1 (Medium, area 3): visibility-armed governed forms are exempt, so the headline budget claim holds only for viewports that hide the forms

Lane report "Status": "all 20 measured CMS routes are under the 92,160-byte initial-route budget". The lane also discloses ("Honest limit", README) that a region in the first viewport loads at hydration. I measured how common that is. Chrome harness, real components:

- Reviewer, decision form region at y=610: viewport 1280x900 loads `CmsGovernedDecisionForm` and its machinery at cold load (24 JS requests, 83.7 KB esbuild-minified gzip); viewport 1280x400 loads none (12 requests, 68.0 KB).
- Panel submit form at y=104: loads at cold load at 1280x900 (it sits at the top of the panel).
- Owner, assignment regions at y=732 and y=1035: at 1280x900 the assignment form, then (H2) zod and `GET capability-grants`, load at cold load; at a 700 px high viewport (1000x700) none do.

So the threshold sits at ordinary laptop heights. Gate variant charging the four governed form stems (static model): definition review detail 100,910, pattern edit 100,446, taxonomy edit 103,862 (template edit 91,662), against 92,160. FE03 :1784 says lazy chunks "load on explicit entry/visibility" (that reading puts them outside the 90 KB route figure) but :1790 also says "Budgets are hard acceptance criteria ... must split or obtain an originating architecture decision, not silently raise the number", and P2-S11-AC-106 is measured as everything fetched until idle. No decision defines which reading applies, and no real-route spec measures these routes. ENGINEERING-STANDARDS.md:82-90 gives a CMS editor/admin page 140 KB initial and 280 KB total, which these cases satisfy; the gate and AC-106 use 90 KB.

Fix: record a decision that fixes the definition (and, if intent/visibility-armed lazies are outside the route figure, say so in FE03 and phase-2.md AC-106), or add the Chrome measurement (section 5, T4). Until then the report should not state conformance for these routes without the qualifier.

### M2 (Medium, area 2): the pre-hydration lock is unexplained, unannounced and drops keystrokes silently

Mechanism (`cms-lazy-intent.ts`, `CmsWorkflowFields.tsx`, `cms-workflow-field-parts.tsx`): the server writes text controls `readonly` and select/radio controls `disabled` with `data-cms-prehydration-lock`, the frame removes them on mount. Evidence in Chrome on the real decision form while the chunk is held:

- Chrome accessibility tree (CDP `Accessibility.getFullAXTree`): `radio "Approve"` `disabled=true`, `radio "Reject"` `disabled=true`, `textbox "Reason"` `readonly=true`, `focusable=true`, `describedby=governed-decision-reason-counter` (the pre-existing counter only). No `aria-describedby`, `aria-busy` or visible text names the reason.
- Tab order: link, textarea, Record decision button; the disabled radios are skipped (a keyboard user meets the textarea first).
- 14 characters typed into the locked textarea: value after typing is `""` (dropped, no feedback).
- On release no live region changes (before and after identical), the unlock is silent; typing afterwards works.
- axe (`@axe-core/playwright`) on the locked owner markup: no serious or critical violations. So this is not a WCAG-failure finding; it is a rule-consistency and usability one: the project pattern is that a disabled control names why (FE03 Accessibility Inventory :1460 "a disabled create names the missing prerequisite"; P2-S09-AC-955 "the decision form names its missing prerequisite"; Interaction table "disabled is native when unavailable"), `2026-08-02-architecture-design.md:341` says "server-rendered semantics remain functional before hydration" (FE03 :146 "Renders useful semantic HTML before hydration"), and Testing Obligations require NVDA/VoiceOver smoke, which was never run for this state.

Is the lock needed? I tested the premise in Chrome with the production-shaped structure (server HTML wrapped in the Suspense boundary that `WhenOffered` emits). Typing before hydration into a controlled textarea leaves the typed text in the DOM and `""` in state, and the lane's replay then submits `""` for both Enter-in-field and click-Send (appendix B, h2). So the lane's reasoning is correct. But the alternative is lossless and removes the lock, the context and the attribute juggling: seed the controlled state from the DOM when the field mounts (a mount-only layout effect in `WorkflowTextField/TextArea/Select/RadioGroup`: if the DOM value differs from the state, call `onChange`). With that seeding the same Chrome run submits the typed text. It also keeps no-JS and screen-reader users on native, enabled controls.

Fix: prefer the seeding (drop the lock). If the lock stays: add `aria-busy="true"` and a described-by hint ("This form is loading") that the frame removes on mount, a visible cue for `[readonly]`, and keep Playwright specs honest (they currently cannot see the window because `fill`/`check` wait for editable/enabled).

### M3 (Medium, area 1/4): the "no double submit" guard and region isolation have no test that fails without them

Mutation spot-checks of `cms-lazy-intent.ts` against its own test file (17 tests, copy in scratch): removing `if (replayed.has(form)) continue;` survives (17 pass); replaying the held forms of other regions survives; dropping the `submitter` argument of `requestSubmit` survives. Killed: no `preventDefault`, no replay, not clearing `held`. The dedupe line is the code that makes three early clicks produce one request (proved in Chrome: three early clicks, exactly one POST), yet nothing pins it. Also: no test hydrates the REAL governed forms (server markup with lock, hydrate, release, submit); the synthetic `Gated` component and `GateForm` stand in. Fix: add a unit test with two held submits of one form expecting one `requestSubmit`, a cross-region test, and a hydration test over `CmsGovernedSubmitForm` and `CmsGovernedDecisionForm` markup.

### M4 (Medium, area 3/5): the result handoff and panel exemptions put the post-command editor landing over budget, on the tightest route

`cms-editorial-result-handoff` and `CmsEditorialResultPanel` are exempt ("only when a result is waiting"). A result is waiting exactly after create entry, resolve conflict and restore, which is the primary authoring flow. Gate variant charging them: CMS entry editor 94,455 (92,160 budget, headroom -2,295), conflict resolve 92,615. The gate row is 91,787 with 373 B headroom. The reason text is honest; the effect on the budget claim is not visible anywhere.

### L1 (Low, area 5): the gate does not assert or record the Node version

`node scripts/verify-bundle-budget.mjs` under `/usr/bin/node` v26.11.1 exits 1: CMS entry editor 92,588, CMS review detail 92,444 and the untouched Content schema registry 92,385 exceed 92,160; every CMS route grows 660 to 801 B (entry list +4). CI is pinned: `.github/actions/setup/action.yml` uses `actions/setup-node` with `node-version-file: .node-version` (22.23.1), `.npmrc engine-strict=true`, `package.json engines.node 22.23.1`, self-hosted runner on this host, and the `build` job runs `pnpm --silent bundle:check` after `build-immutable-artifacts.sh`. The script prints a `sourceRevision` but no `process.version`. Add `node: process.version` to the evidence JSON and fail on a mismatch with `.node-version`. The gate also reads whatever `apps/web/dist` holds and cannot tell which build that is: at 13:52:43, after my measurements, another process replaced the 12:42 production dist by a development-mode staging build (`dist/server/wrangler.json` `targetEnvironment: "staging"`, `jsx-dev-runtime` in the closure, a 353,990 B `client` chunk) and the gate then fails every route, including the untouched S09 routes (CMS entry editor 151,535, Infrastructure 138,952). CI is safe because `build-immutable-artifacts.sh` ends with the production build, but a check of `targetEnvironment` and for `jsx-dev-runtime` would stop a false failure or a stale pass elsewhere. Also raise the safety margin policy: 373 and 417 B are below the Node delta and below the lane's own observed ±0.5 KB chunk-split noise.

### L2 (Low, area 1): a click on a `type="button"` action before hydration is dropped, not replayed

Only `submit` is held. React stops propagation of discrete events on a dehydrated boundary, so "Revoke Reviewer A" (`CmsGovernedAssignmentRevoke.tsx:77`, `type="button"`, `onClick`) pressed before hydration does nothing; Chrome: 0 API calls after hydration, a second click after hydration produces the POST. Safe (no command), but there is no pending feedback either. A held submit shows no pressed/pending state between click and replay (FE03 Interaction table "Same-frame pressed/pending").

### L3 (Low, area 4): the closure guard changed polarity for the four entry-workflow forms

Lane start: `CmsEditorialWorkflowIsland` keeps Submit, Schedule, Preview and PublishConfirmation OUT of its static closure. Now: they must BE in it (`cms-lazy-forms-closure-answer.test.ts`), and a round-1 test ("loads the three entry-workflow forms from one chunk entry") was deleted. This is a documented design reversal forced by the Chrome measurement, not a weakening, but the guard now pins the design: a lane that re-lazies those forms to save bytes (FE03 :1787 "dynamic-import on selection") will fail a test that contradicts the FE03 row. Say so in the README.

### L4 (Low, area 4): negative assertions in `CmsEditorialEntryEditorIsland.facts.test.tsx` depend on a fixed 3-tick wait

`resultLoaded()` is three `setTimeout(0)` ticks. A negative `toBeNull()` can pass before an import finishes, so I mutated `takeCmsEditorialResult` (drop the entry match, drop the TTL, drop the shape check) and the hook (never set the summary; peek always false): all five mutants are killed by the edited tests (appendix C), so the negative cases are not vacuous on this host. The residual risk is a slower host where the import outlasts three ticks and the positive tests fail first (a false failure, not a false pass). Prefer `vi.waitFor` on a positive sentinel.

### L5 (Low, area 1): restore review draft store is loaded asynchronously without a catch

`cms-editorial-restore-review.ts` (`void import('./cms-editorial-restore-draft').then(...)` for `forgetRestoreDraft`) and `cms-editorial-page-actions-core.ts` (recovery) lose the forget or recovery silently if the chunk fails. Low: a kept confirmation can reappear.

### L6 (Low, area 3): README and report wording

`tests/performance/README.md` says the exemption list is "exactly the modules the real islands load after hydration". Mount effects are after hydration and in the Chrome cold load. Reword with the H2 and M1 qualifiers.

### L7 (Low, area 2): every locked region logs a React hydration-mismatch error in a development build

By design the client render differs from the server markup (no `readonly`/`disabled`). Development build of the real decision form in Chrome (React 19.2.8): `console.error` "A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up" naming `<input ... disabled>` under `WorkflowRadioGroup`, once per page load; the fieldless panel logs nothing. Production builds do not log it. It is noise that can hide a real mismatch and can fail a dev-mode check that treats `console.error` as failure. `suppressHydrationWarning` on the locked controls removes it; the DOM-seeding alternative of M2 removes the cause.

## 4. Area-by-area judgement

### 4.1 Behaviour equivalence (FIX FIRST because of H1 and M3)

Holds, with real components in Chrome (appendix B):
- Panel submit (CMS-03C-06): chunk held 1.5 s, three early clicks: no navigation, no request before hydration, exactly one POST afterwards to `/api/v1/cms/governed-reviews` with a valid `Idempotency-Key`, `X-CSRF-Token`, no `If-Match` (AC-067), body `{subjectKind, subjectId, subjectHash}`. A normal click after hydration sends the same shape. The lazily loaded refusal copy renders when the stub answers 403.
- Decision (CMS-03C-07): chunk held 1.5 s, Playwright waits for the lock to release, then approve + reason: POST `/api/v1/cms/governed-reviews/{id}/decision` with `If-Match: "2"` (the review version), valid key, body `{reviewId, decision, reason, expectedVersion:"2"}`; byte-for-byte the same shape as with an immediate chunk (AC-073, AC-075: no `capability` or `stepUpAt`).
- Assignment create (CMS-03C-08, select + datetime-local + textarea, all locked before hydration): chunk held 1.5 s versus immediate, then reviewer chosen, expiry and reason filled: POST `/api/v1/cms/governed-reviews/{id}/assignments`, `If-Match: "2"`, valid key, body `{"action":"create","expectedVersion":"2","reviewerPersonId":"...","expiresAt":"<iso>","reason":"Please review"}`, identical in both runs.
- Activation (CMS-03C-09, radios locked before hydration; choose Activate, Continue, "Activate this version"): POST `/api/v1/cms/governed-reviews/{id}/activation`, `If-Match: "2"`, valid key, body `{"action":"activate","expectedVersion":"2"}`, identical delayed versus immediate.
- Early submit of the decision form (radios locked) and early click on "Assign reviewer" with nothing chosen: no navigation; after hydration 0 POSTs and the normal inline errors ("Choose approve or reject", "Enter a reason", "Choose a reviewer", "Choose when the assignment ends"). Equivalent to submitting an untouched form.
- Controller code: the request (body, `ifMatch`, key) is built synchronously before `await options.send`, and `dispatch` sets `pending` first, so the added awaits cannot change the request or open a second send. The `inFlightRef` guards in the taxonomy, term and locale hooks are set before their awaits.

Does not hold: failure paths (H1); the unit-level guarantee behind exactly-once replay is untested (M3); a click that is not a submit is dropped (L2); input typed before hydration is lost under the lock (M2).

### 4.2 Accessibility (FIX FIRST, small)

See M2. The FE03 row that applies, "Review decision form: native approve/reject radios with a persistent group label" (Accessibility Inventory), is met: the locked radios are still native, grouped (`group "Decision"`) and labelled. FE03 does not contain a progressive-enhancement or no-JS rule for these forms ("native" in FE03 means native HTML controls, not native form posting; the commands need a CSRF header, an idempotency key and `If-Match`, so they never worked without JS). What the lock changes without JS is that the controls are now permanently locked on the server markup where they used to be usable-looking; the seeding alternative leaves them native. Keyboard: focus works, no trap, Tab skips locked radios, keystrokes dropped until release. Screen reader: AX tree gives disabled radios and a read-only textbox with no explanation.

### 4.3 Exemptions (FIX FIRST because of H2, M1, M4)

Verdict per stem (29): true for 21; false for 2 (`contracts`, `validators`, H2); viewport-dependent for 4 (`CmsGovernedSubmitForm`, `CmsGovernedDecisionForm`, `CmsGovernedAssignmentForm`, `CmsGovernedActivationForm`, M1); landing-dependent for 2 (`cms-editorial-result-handoff`, `CmsEditorialResultPanel`, M4). Table in appendix D. The pinned-membership test and the 20-character reason check cannot detect a false reason; only a measured cold load per role can.

### 4.4 Edited tests (ACCEPT)

- 26 test files now carry `beforeAll(preloadWorkflowAnswerMachinery)` (grep count, equal to the lane's 26). 12 tracked workflow tests: `git diff HEAD` is exactly +3 lines each (import plus the `beforeAll`).
- Five governed tests (`CmsGovernedPatternPanel`, `ReviewDetailIsland.rate-limit`, `ReviewPanel.submit-form`, `TaxonomyPanel`, `TemplatePanel`): +3 lines each against the round-2 backup (import plus preload). Eight governed tests (`ActivationForm.pending/recovery/schedule`, `AssignmentForm`, `DecisionForm`, `ReviewDetailIsland.activation`, `ReviewDetailIsland`, `ReviewPanel`) plus `cms-lazy-view.test.tsx` and `CmsWorkflowRateLimitNotice.test.tsx` were edited before their backup, so there is no recoverable before-state. Compensating evidence: I compared every test title and status of the whole web suite between the pre-lane full unit run (`.lane-logs/s12-claude-intake-20261022/unit-full.json`, 2026-10-22 17:36Z) and my run now (688 files). Titles present before and gone now: 7. Four are the deliberate polarity flip in `cms-lazy-forms-closure.test.ts` (L3). Three are renames by OTHER lanes (same counts, titles updated for DEC-199/DEC-210; `load-composition-page.test.ts`, `cms-workflow-pattern-reasons.test.ts`, `pattern-designer-refusal-items.test.ts`, none in the files table). No test is skipped or failing now; two baseline failures now pass (`cms-editorial-bundle-budget.test.ts` route-declaration, `step-up-required.inventory.test.ts`). New: 10 test files, 105 tests, plus 3 titles in `cms-lazy-view.test.tsx`.
- `facts.test.tsx` (+30/-7), `cms-editorial-page-actions-core.test.ts` (+5): assertions unchanged; async waits added (L4 for the negative cases).
- The preload makes tests exercise the "already loaded" path. The cold-first-send path is not unit-tested (the repo harness itself notes the fake clock cannot cover a cold module load) but its request shape is proved in Chrome above.
- Spec edit `phase-02-slice-12-template-real-route.spec.ts`: locator narrowed by text and a `toHaveCount(1)` added; stronger, not weaker.

### 4.5 Margins and determinism (ACCEPT, harden)

CI Node: `.node-version` = 22.23.1 (`actions/setup-node` `node-version-file`), pnpm 11.24.0, `engine-strict=true`. Two independent builds (the lane's last and root's 12:42) and my run give identical per-route bytes, so the gate is deterministic under the pinned toolchain on this host. Residual risks: the gate does not check its own Node (L1); a CPU-feature-dependent zlib path could move bytes on a different runner host (not verified; this host is both the dev box and the runner today); the margins are within one chunk-split's noise. Recommended floor: do not accept a route under 1 KiB headroom without an owner note.

### 4.6 Governed real-route spec (REQUIRED before Slice 12 closes)

The root STATE lists "governed real-route spec per V11" as a post-commit follow-up. It should instead be a closing gate: P2-S12-AC-273 (open) requires Playwright with the real routes and two people to create, submit, assign, decide (ordinary and protected) and activate/schedule/retire a template, pattern and vocabulary, "keyboard-only and at 200% zoom". None of the 8 specs root reran (log `.lane-logs/canonical/pw-realroute3-20261023T163504Z.log`) drives the definition review detail or the panel submit forms (the template spec loads the panel and never touches it), and the editorial review detail is driven only as a reviewer ("Record approval", `phase-02-slice-11-workflow-real-route.spec.ts:255,273`); the owner's assignment form, whose mount fires the reviewer read of H2, is never driven in a browser (assignments are made through the API, `:110`). Playwright `fill` and `check` wait for editable/enabled, so even a future happy-path spec would pass without ever observing the locked window; the spec needs deliberate chunk holds. Concrete design in section 5.

## 5. Recommended governed real-route spec (concrete)

File `tests/e2e/phase-02-slice-12-governed-review-real-route.spec.ts`, config `playwright.s09-real.config.ts`, helpers reused: `signInS11`, `prepareApprovedEntryCast`-style world builder (add `s12-governed-world.ts` for a draft template/pattern/vocabulary version plus owner, reviewer and scheduler principals), `collectBrowserErrors`. Serial, DB reset before each spec as in the lane's request list.

1. T1 lock window (reviewer): `page.route('**/_astro/CmsGovernedDecisionForm*.js', hold)`; assert server markup has `data-cms-lazy-region="governed-decision"`, radios `disabled`, textarea `readonly`; click the commit button early: no `framenavigated`, no POST; release the hold; exactly one decision POST (count `page.on('request')`) with `Idempotency-Key`, `If-Match` equal to the review version and no `capability`/`stepUpAt` (AC-073/075). Assert the chosen M2 behaviour (typed text preserved, or the lock announced).
2. T2 panel submit early click (owner, template/pattern/taxonomy pages): hold `CmsGovernedSubmitForm*.js`, click three times, one POST 201 with a key and no `If-Match` (AC-067/069), result heading focused.
3. T3 keyboard-only and 200% zoom on `/app/cms-content-modeling/definition-reviews/:reviewId` as reviewer and owner; Tab reaches the radios after release, Space selects, Enter submits, focus lands on the result heading; axe zero serious/critical in the locked and the released state (Testing Obligations).
4. T4 cold-load per role at 1280x720 and 1280x1000, same `recordScripts`/`gzipTotal` helpers as `phase-02-slice-11-bundle-budget-real-route.spec.ts`: reviewer, owner (assign + revoke), scheduler/activator, and the editorial review detail as owner. Assert the exact list of chunk stems fetched before any interaction equals what the gate models (this fails today for the editorial owner: zod, H2) and total gzip against `BUNDLE_BUDGETS.initialRouteGzipBytes` or the decided definition (M1).
5. T5 chunk failure: abort `governed-review-command-transport*.js` (and, separately, the refusal chunk); submit; assert a visible local refusal and that the form is usable after unblocking (fails today, drives H1).
6. T6 two-person AC-273 journey: owner assigns (CMS-03C-08, uniform refusal collapses), reviewer decides ordinary and protected (step-up round trip reusing the `Idempotency-Key`), owner activates, schedules, retires (inline `ConfirmationStep`, "Scheduled, not active"), with one lost-answer case (abort the response) to prove the same key is reused after reconcile.

## 6. Order of work I recommend

1. H1 (failure paths) with rejecting-loader tests, then re-run the Chrome scenario E.
2. H2: move the reviewer-options read to intent; fix the exemption reasons.
3. M2: replace the lock by DOM seeding (deletes `RegionLockContext`, `LOCK_ATTRIBUTE`, `useServerRegionLock`, `textLock` and `disabledLock`) or add the explanation; M3 tests.
4. Decide M1 (definition of initial route JS) and record it; M4 note.
5. Spec in section 5, then the final evidence regeneration (receipts pin file SHA-256: regenerate after these edits).

## 7. What holds (confirmed independently)

- 109 receipts match; the gate numbers, headroom and `passed: true` reproduce exactly; 688 files / 8,216 tests pass; eslint and prettier are clean on the lane's files.
- The gate rule itself is sound as built: static edges are never exempted, transitive promotion works, name-prefix matching cannot be gamed by a longer name (test at `cms-editorial-bundle-budget-mounted.test.ts:160`), and a new lazy chunk is charged until listed.
- Request identity (key, `If-Match`, body) is the same on every path I drove, including the pre-hydration replay.
- Moves such as `rate-limit-message.ts`, `taxonomy-vocabulary-core.ts`, `taxonomy-version-identity.ts` and `cms-rich-text-refusal-copy.ts` are pure moves with re-exports.

## Appendix A. Gate variants (static model, shipped `dist`, pinned Node)

| Route | gate now | + zod stems charged | + governed form stems charged | + handoff and result panel charged |
|---|---:|---:|---:|---:|
| CMS entry editor | 91,787 | 91,787 | 91,787 | 94,455 |
| CMS review detail (owner) | 91,743 | 146,667 | 91,743 | 91,743 |
| CMS definition review detail | 73,193 | 73,193 | 100,910 | 73,193 |
| CMS pattern edit | 87,528 | 87,528 | 100,446 | 87,528 |
| CMS taxonomy edit | 90,944 | 90,944 | 103,862 | 90,944 |
| CMS template edit | 78,815 | 136,824 | 91,662 | 78,815 |

Only the review detail value in the zod column is a real mount-time effect; the other zod-column jumps are over-charges. Budget 92,160. Charging both the four governed form stems and the zod stems models definition review detail at 155,445, pattern edit 154,981 and taxonomy edit 159,802: an upper bound, since the owner assignment read, the reviewer decision form and the activation form are held by different people and the panel pages never mount the reviewer read.

## Appendix B. Chrome harness results (real components, esbuild bundle, installed Chrome)

Setup: `h1/build.mjs` bundles `CmsGovernedReviewPanel`, `CmsGovernedReviewDetailIsland` and `CmsEditorialReviewDetailIsland` unmodified (esbuild, splitting, `import.meta.env` = `{SSR:false}` for the client and `{SSR:true}` for the `renderToString` server pass), with fixtures from the repo's own test-support (`governedDetailFixture`, `reviewDetailFixture`, `governedAssignmentSummaryFixture`). Pages: panel, governed reviewer, governed owner, editorial owner, each also with a 3,000 px spacer. A loopback server can delay or destroy a named chunk. Chrome via Playwright (`channel: 'chrome'`), cookie `wj_csrf`, `page.route('**/api/v1/**')` answers 403 (POST) or an empty valid page (GET) and records requests. Recorded output: `h1/drive-output.txt`, `h1/drive2-output.txt` (scratch).

A. Panel submit form (fieldless; the replay path)
```
A0 PASS server markup carries data-cms-lazy-region = governed-submit
A1 PASS three early clicks (chunk delayed 1.5 s): URL unchanged, no request before hydration
A1 PASS exactly ONE POST after hydration for three early clicks   posts=1
   request: POST /api/v1/cms/governed-reviews, Idempotency-Key present (valid shape), X-CSRF-Token ok, no If-Match
   body: {"subjectKind":"template_version","subjectId":"123e4567-...-426614174001","subjectHash":"aaaa..."}
   outcome: alert "Not available to you ... Your account does not have the capability for this action." (refusal chunk loaded lazily)
A2 PASS normal click after hydration: exactly one POST, same path, same body, key shape valid, no If-Match
```
B. Governed decision form, reviewer, chunk held (IntersectionObserver disabled so only intent can arm)
```
B1 ARIA (Playwright): radio "Approve" [disabled]; radio "Reject" [disabled]; textbox "Reason"; button "Record decision"
B1 Chrome AX (CDP): textbox "Reason" readonly=true focusable=true describedby=governed-decision-reason-counter;
                    radio "Approve" disabled=true; radio "Reject" disabled=true
B1 aria-describedby on locked controls: [null, null, "governed-decision-reason-counter"]  (no lock explanation)
B2 Tab order: a -> textarea#governed-decision-reason -> button[submit] -> body -> a -> textarea   (radios skipped)
B3 PASS (as a defect): 14 characters typed into the locked textarea, value after typing = ""
B4 lock released after hydration; live regions identical before and after (unlock not announced); typing after release works
B5 early click on Record decision: no navigation; after hydration 0 POSTs and the inline errors "Choose approve or reject." / "Enter a reason."
B6 chunk delayed 1.5 s vs immediate, then approve + reason:
   POST /api/v1/cms/governed-reviews/{id}/decision, If-Match "2", valid key, X-CSRF-Token,
   body {"reviewId":"...","decision":"approve","reason":"Looks good to me, approving.","expectedVersion":"2"}  (identical both runs)
```
C and D. Requests at cold load with no interaction (esbuild-minified gzip is indicative only)
```
editorial review detail, OWNER, 1280x900: 26 JS requests, 173,209 B
   includes CmsEditorialReviewAssignmentForm-*.js, validators-*.js (+ chunk of 64,984 B: contracts/zod), GET /api/v1/cms/capability-grants
governed owner 1280x900 (assignment regions y=732, y=1035, both hydrated): 30 requests, 175,378 B
   includes CmsGovernedAssignmentForm-*.js, validators-*.js, zod chunk, GET /api/v1/cms/capability-grants
governed owner 1000x700: assignment form not requested, no zod, no API call
governed reviewer 1280x900 (decision region y=610, hydrated): 24 requests, 83,693 B, includes CmsGovernedDecisionForm-*.js
governed reviewer 1280x400 (not hydrated): 12 requests, 68,049 B
panel 1280x900 (submit region y=104, hydrated): 19 requests, 78,600 B, includes CmsGovernedSubmitForm-*.js
transport / refusal chunks are NOT requested at cold load in any case (they wait for a focus or a send)
```
E. Lazy transport chunk unreachable (connection destroyed), real governed panel
```
E1 first click: aria-busy=true aria-disabled=true alerts=0 postsSent=0; page error "Failed to fetch dynamically imported module: .../governed-review-command-transport-*.js"
E2 second click: aria-busy=true postsSent=0
E3 network healed, third click: aria-busy=true postsSent=0   (wedged until reload)
```
G. axe-core on the locked governed owner markup: 0 violations of any impact.

H. Development build (React 19.2.8, `NODE_ENV=development`), governed reviewer page: `console.error` "A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up", component stack through `WorkflowRadioGroup` to `<input ... disabled>`; the fieldless panel page logs nothing (`h3/drive-dev.mjs`).

I. Assignment and activation forms, real island, chunk delayed 1.5 s versus immediate: the POST is identical (assignment: `/assignments`, `If-Match "2"`, body `{"action":"create","expectedVersion":"2","reviewerPersonId":...,"expiresAt":<iso>,"reason":...}`; activation: `/activation`, `If-Match "2"`, body `{"action":"activate","expectedVersion":"2"}`); the select, the radios and the datetime-local field were disabled/read-only before hydration (`select.disabled` true, radios `disabled`).

L2. "Revoke Reviewer A" (`type="button"`) clicked before hydration: 0 API calls after hydration; a second click after hydration sends the POST.

h2 premise check (production-shaped: server HTML wrapped in the Suspense boundary that `WhenOffered` emits)
```
plain controlled textarea, typed before hydration:  DOM="typed before hydration"  submitted state=[""]
same, state seeded from the DOM on mount:           DOM="typed before hydration"  submitted state=["typed before hydration"]
lane intent module without the lock, Enter in a single-line field:  replayed submit carried state=[""]
lane intent module without the lock, click Send:                    replayed submit carried state=[""]
```
(A first attempt without the Suspense markers in the server HTML hydrated differently and showed the typed text reaching state; that run was wrong and is discarded.)

## Appendix C. Mutation and probe results

Intent module, copy in scratch, against `cms-lazy-intent.test.tsx` (17 tests, baseline 17 pass):

| mutation | result |
|---|---|
| remove `event.preventDefault()` in `onSubmit` | killed (2 fail) |
| remove the `requestSubmit` replay | killed (2 fail) |
| keep `held` after the replay | killed (1 fail) |
| remove `if (replayed.has(form)) continue;` (dedupe) | SURVIVES (17 pass) |
| replay the held forms of all regions (`mine = held`) | SURVIVES |
| drop the `submitter` argument of `requestSubmit` | SURVIVES |

Repo sources mutated in memory through a Vite transform plugin (repo never written), run against the repo's own tests:

| mutation | test file | result |
|---|---|---|
| gate: `startsWith(stem.)` to `includes(stem)` | `cms-editorial-bundle-budget-mounted.test.ts` (14) | killed (1) |
| gate: single pass instead of transitive | same | killed (4) |
| gate: no promotion | same | killed (4) |
| gate: exempt everything | same | killed (4) |
| frame never calls `markRegionHydrated` | `CmsWorkflowCommandFrame.region.test.tsx` (5) | killed (1) |
| frame section without the region attribute | same | killed (1) |
| lock also on the client | `CmsWorkflowFields.lock.test.tsx` (5) | killed (1) |
| handoff: no entry match / no TTL / no shape check | `CmsEditorialEntryEditorIsland.facts.test.tsx` (13) | killed (1 each) |
| result peek always false | same | killed (4) |
| hook never sets the summary | same | killed (4) |
| page actions: recovery never runs | `cms-editorial-page-actions-core.test.ts` (23) | killed (1) |
| restore review: draft never forgotten | same | killed (1) |

Ad-hoc probes (scratch test files, repo untouched): editor controller with the first save-flow creation throwing: `saveNow()` x3 reject, factory called once, 0 requests, phase `dirty`, unhandled rejection from autosave; `CmsTaxonomyVersionDesigner` with its submit module throwing at import: button "Saving…" after the click and after a second click, 0 alerts, unhandled rejection.

Whole-suite title comparison (pre-lane `.lane-logs/s12-claude-intake-20261022/unit-full.json` vs my run, 688 web files): 7 titles gone (4 deliberate flip, 3 renames by other lanes), 32 titles added in existing files, 10 new test files with 105 tests, 0 skipped or failing, 2 baseline failures now passing.

## Appendix D. Exemption verdicts (29 stems)

| stem | trigger found in code | verdict |
|---|---|---|
| contracts | via `validators`; mount: `use-reviewer-options.ts:21-27` to `cms-workflow-reviewer-options.ts:82`; otherwise a focus or send | false (H2) |
| validators | same | false (H2) |
| contracts-time-authority | `useTimeAuthority(active)` loads when the form opens (`use-cms-schedule-time.ts:27-39`) | true |
| time-authority | same | true |
| cms-workflow-command-transport | send (`use-cms-workflow-command.ts:73`), warmed on focus (`CmsWorkflowCommandFrame.tsx:57-60`) | true (failure path: H1) |
| cms-workflow-refusal | refusal (`cms-workflow-command-controller.ts:232`), warmed on focus | true (H1) |
| cms-workflow-canonical-read | refetch only (`CmsEditorialWorkflowIsland.tsx:60`); no mount or event refetch in `use-cms-workflow-canonical.ts` | true (H1) |
| CmsGovernedSubmitForm | `loadViewOnIntent('governed-submit')`: intent or IntersectionObserver | viewport dependent (M1) |
| CmsGovernedDecisionForm | `'governed-decision'` | viewport dependent (M1) |
| CmsGovernedAssignmentForm | `'governed-assignment'`, then the H2 read at mount | viewport dependent (M1, H2) |
| CmsGovernedActivationForm | `'governed-activation'` | viewport dependent (M1) |
| governed-review-command-transport | send (`use-governed-review-command.ts:81`), warmed on focus | true (H1) |
| governed-review-refusal | `:88` | true (H1) |
| governed-review-canonical-read | `CmsGovernedReviewDetailIsland.tsx:61`, refetch only | true (H1) |
| cms-editorial-page-actions-restore | `toggle` open or restore submit (`cms-editorial-page-actions-core.ts:28,64-83`) | true |
| cms-editorial-entry-editor-save | first save (`cms-editorial-entry-editor-controller.ts:71-75`) | true (H1) |
| cms-editorial-runtime | first send (`cms-editorial-entry-editor-save.ts:35`) | true |
| locale-variant-submit | save (`use-locale-variant-form.ts:26`) | true (H1) |
| locale-source-refresh | after a 409 (`use-locale-source-review.ts:11`) | true |
| taxonomy-designer-submit | save (`use-taxonomy-designer.ts:19`) | true (H1) |
| term-action-submit | action (`use-term-form.ts:15`) | true (H1) |
| taxonomy-outcome-reconcile | after an uncertain write (`use-taxonomy-designer.ts:131-132`) | true |
| cms-editorial-restore-draft | page load only when `form[data-cms-editorial-restore]` exists (revision history), and on review close | true in effect (that route has 87,761 B headroom) |
| cms-editorial-result-handoff | mount effect when a result is waiting (`use-cms-editorial-result.ts:30-36`); commit paths in create and conflict hooks | landing dependent (M4) |
| CmsEditorialResultPanel | `React.lazy` when a result is present (`CmsEditorialEntryEditorIsland.tsx:30`) | landing dependent (M4) |
| cms-editorial-entry-draft-detail-transport | conflict or refetch (`cms-editorial-entry-editor-context.ts:169`, `cms-editorial-conflict-controller.ts:73`) | true |
| cms-editorial-entry-create-submit | first submit (`use-cms-editorial-entry-create.ts:206`, with a catch) | true |
| cms-editorial-conflict-resolve | first submit (`cms-editorial-conflict-controller.ts:201`) | true |
| cms-editorial-conflict-detail-transport | page re-read (`:87`) | true |

Totals: true 21, false 2, viewport dependent 4, landing dependent 2.

## Appendix E. Limitations

- The harness bundle is esbuild, not the shipped Rolldown build, and the API is stubbed; sizes are indicative, request order and timing are real. Chrome was the installed Google Chrome; no Firefox or WebKit run, no NVDA or VoiceOver run (the Testing Obligations smoke could not be done by me).
- Gate variants are static models over the shipped build, not Chrome measurements; the viewport figures are from the harness, not the shipped chunks.
- Files edited before their backup have no before-state diff (compensated by the title comparison).
- I did not rebuild `dist` (shared with root's runs); I relied on root's 12:42 production build, which postdates the last source edit. Every dist-derived number here (gate, variants, built-chunk reading) comes from that dist; it was overwritten at 13:52:43 (see L1), so a rerun needs a fresh production build. Saved outputs (scratch, SHA-256): gate run `bundle-check.json` `dcae47e32738a58bd3af2d9c16658ea9e2589aea7b5aeeca22a4d744fa766e25`, Node 26 run `bundle-check-node26.json` `ef54b1a66ba895324877ddc3e54849576e3a3c72779af641ec508cb90606249f`, whole-web vitest JSON `web-current.json` `cc6bccbe0432d7007e0e3bf07cc5f9b61f564d3e43d0e2b33231f4ba51c27b14`, harness `h1/drive-output.txt` `233f1e84ed4569dec9529ffdeea902d585c0064c1426613da74ed2d117e42400`, `h1/drive2-output.txt` `46e3c03fcf239bde09c06932ea5e9627fe1601acbbd1d389e10b2bdd875e9f1d`.
