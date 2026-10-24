# Native Web B RED checkpoint — 2026-10-16

Status: minimal phase-offset expiry GREEN checkpoint; current author bytes UNRUN. All paths frozen.

Dispatch: `Native template/announcer RED takeover`, agent
`native_web_b_red_20261016`; assigned native `gpt-6.1-sol` / `ultra`.
Worktree: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.
Protected primary: `/home/rob/Projects/WeJammin` (no writes).

## Exact scope

The initial RED task authored these four new files:

- `apps/web/src/components/cms-composition/CmsTemplateEditDesigner.uncertain-pending.test.tsx`
- `apps/web/src/components/cms-composition/CmsTemplateLatestCheck.announcer.test.tsx`
- `apps/web/src/components/cms-editorial-workflow/CmsReviewerOptionsNotice.announcer.test.tsx`
- `docs/handoffs/2026-10-14-claude-s12/lane-codex-web-b-red-2026-10-16.md`

Root then released seven GREEN paths: `CmsTemplateEditDesigner.tsx`,
`cms-template-edit-reconcile-state.ts`, new `use-template-unknown-attempt.ts`,
`CmsTemplateLatestCheck.tsx`, and `README.md` under `cms-composition`;
`cms-editorial-workflow/CmsReviewerOptionsNotice.tsx`; and this report.
Historical and new frozen tests remain outside this author's GREEN write scope.
No runtime, tests, lint, build, formatter, Git, database, or network commands
were run. Filesystem inspection and hash/count derivation used context-mode;
edits used absolute-path `apply_patch`.

Loaded project rules/instructions, engineering standards, and TDD, Vitest,
testing-strategist, React, accessibility, systematic-debugging guidance, with
the required TypeScript and canonical React references. The dispatch's explicit
runtime prohibition controls author work. Root's initial observed RED and the
fixture correction requiring a fresh run are recorded below.

## Contract and static cause

- FE03 `03-cms-content-modeling.md:1173-1175`: safe retry, 429 preservation,
  and mutation reconciliation before retry.
- FE03 `03-cms-content-modeling.md:1223-1225`: only commit disabled, pending
  text, duplicate activation ignored, explicit conflict reconciliation.
- `CmsTemplateEditDesigner.tsx:53-65`: admission excludes pending/created,
  rate wait, and unresolved conflict, but excludes neither uncertain state
  nor an in-progress manual canonical read.
- `cms-template-edit-reconcile-state.ts:128-135`: changed serialized draft
  replaces the retained key/body. The unknown original attempt is therefore
  lost when admission permits a changed submit.
- `CmsTemplateEditDesigner.tsx:150-153`: pending disables the whole fieldset.
  Lines 189-191 keep idle text on the pending commit button.
- `CmsTemplateLatestCheck.tsx:34-38` and
  `CmsReviewerOptionsNotice.tsx:18-26`: 429 live regions are inserted already
  populated. There is no pre-existing empty region to witness text mutation.

The tests use actual React DOM components and only mock the fetch boundary.
Native form events deliberately bypass disabled-button behavior. No source
tokens, private hook state, or imported implementation helpers serve as oracles.
The announcer tests use MutationObserver records and node identity, including
a layout-effect witness of the initial commit for an already limited result.

## Concrete cases and initial predictions

| ID | Cases | Observable oracle | Prediction on frozen production |
| --- | ---: | --- | --- |
| B-TPL-001 | 1 | Held POST disables only commit; fields remain operable; later edits survive; duplicate native submit emits no POST | FAIL: inherited fieldset disabled |
| B-TPL-002 | 1 | Held commit itself exposes saving text | FAIL: idle button text |
| B-TPL-003 | 2 | Unchanged/changed native submit before any canonical GET leaves POST count at one | FAIL: second POST admitted |
| B-TPL-004 | 1 | Changed native submit during a held manual GET leaves POST count at one | FAIL: read does not gate submit |
| B-TPL-005 | 4 | Unavailable, malformed body, identity mismatch, or 429 GET never establishes not-saved; same after wait elapses | FAIL: unresolved attempt admits POST |
| B-TPL-006 | 1 | Manual verified same-parent read, restored original body, exact original key/body/If-Match replay | PASS control: retained existing behavior |
| B-TPL-007 | 1 | Newer canonical parent cannot admit native submit until explicit rebase; rebase preserves edited values and rotates key/If-Match | FAIL before explicit rebase |
| B-ANN-TPL-001 | 2 | Stated/unstated wait mutates one initially empty, already mounted polite node | FAIL: no initial node |
| B-ANN-TPL-002 | 1 | Already limited mount first commits empty, then mutates that same node | FAIL: first commit prefilled |
| B-ANN-REV-001 | 2 | Stated/unstated wait mutates one initially empty, already mounted polite node | FAIL: no initial node |
| B-ANN-REV-002 | 1 | Already limited mount first commits empty, then mutates that same node | FAIL: first commit prefilled |

Root observed 17 cases, 16 meaningful failures, and one preservation-control
pass, with no setup abort, in `/tmp/wejammin-native-web-b-red-NusrJj/red.json`.
That run used the previous template test hash
`5b01dcfce75987d91fc7aaa42f78ffa327e3c45f4cc0193a24622c2f9c642a79`.

Before production release, root identified one success-fixture defect:
`created()` always returned version 4, although B-TPL-006 retries parent 2 and
must receive successor 3. The fixture now defaults to successor 3; B-TPL-007
explicitly requests successor 4 after rebasing onto parent 3. Every assertion
and behavioral expectation remains unchanged. No response guard was weakened.
Root corrected and formatted the fixture, then observed another 17 cases /
16 meaningful FAIL / one PASS with no setup abort in
`/tmp/wejammin-native-web-b-red-NusrJj/red-corrected.json`, SHA-256
`0804b4410b43af0956b70fbba5f020319f2ff0b8467147ec19b8dab3167cf6a6`.
That corrected RED released the seven GREEN paths above. The author ran no
runtime checks and made no subsequent oracle changes.

## Earlier test manifests (later checkpoints supersede)

SHA-256 covers exact file bytes, including final newline. Counts are physical
lines; each file is below the 400-line cap.

| Test | Lines | SHA-256 |
| --- | ---: | --- |
| `CmsTemplateEditDesigner.uncertain-pending.test.tsx` | 367 | `d03936fa3a32e73cfe60c49064d8579ddf1e0401114cacae7be2f3c4250c9697` |
| `CmsTemplateLatestCheck.announcer.test.tsx` | 129 | `ac4d3785bd9ea4ce97b96cacd9ed2b30eab37da272a91926780935e0cdeab4ff` |
| `CmsReviewerOptionsNotice.announcer.test.tsx` | 124 | `00f97e305678d7c3081152e1da0ad4b6d676d947051c9fe560840f3bb7f9fc3b` |

Historical production hashes at the RED freeze:

- `CmsTemplateEditDesigner.tsx`: `cc02fd120e80584f24e7f8875c05274c0f99102535b5f898b4fb5d5d73f72c3d`
- `cms-template-edit-reconcile-state.ts`: `66392d1c33518962c6e010d2620d8adcdd7caea3c3a9ee4b259aa1e23d239f06`
- `CmsTemplateLatestCheck.tsx`: `bde0c20c9ea674ee76e5afa381dc423f8073fba0bf4aa3ba563851b6d3008581`
- `CmsReviewerOptionsNotice.tsx`: `374877dc5a29ba917ceda87b24e825a56cf8d0847515947f9d8ba9ec96287727`

## Initial GREEN implementation and then-open limits

`use-template-unknown-attempt.ts` retains a cloned request, exact serialized
body, key, and parent identity. Its synchronous refs claim admission before
lazy validation; duplicate/native activation therefore cannot replace pending
status with validation failure. Unknown/conflict outcomes and canonical reads
hold admission. Only a verified same parent permits retry; unknown replay keeps
the original body/key, whereas a definite conflict ends that key. A newer
verified parent remains blocked until the existing explicit rebase action.
Local fields stay editable and are never overwritten by pending work or reads.

Submission and read generations reject obsolete completions after unmount or
detail changes. A changed detail does not discard a possibly sent attempt.
Synchronous deadline refs preserve stated POST/GET rate waits even before the
next render; existing rate timers retain their cleanup. The protected read
transport, its deadline/retry policy, same-origin CSRF transport, and lazy Zod
boundary were not modified. No timeout from a different route was imported.

Only commit is disabled during preparation or POST. It exposes pending text,
`aria-busy`, and a stable accessible action label. At this initial checkpoint,
stable visible width remained incomplete: root held the CSS proposal until a
bounded browser/layout witness. No CSS was written in that release; no source
token or jsdom geometry replaced layout proof. The later RED/GREEN release below
records that proof and the bounded width implementation.

Both polite announcers now commit an empty persistent node and populate it in
an effect, including an initially limited result. Latest-read non-rate errors
retain their alert. The live node remains mounted when its text is cleared.

Root released one later TEST-ONLY cascade for the two obsolete absence oracles
in `CmsTemplateEditDesigner.latest-rate-limit.test.tsx` and this report only.
The successful-read case and non-rate 403 case now each capture the existing
notice before pressing Check, assert initially empty text plus `role=status`
and `aria-live=polite`, then require that same node with empty text after the
read. Only the former line-172 and line-191 null-notice expectations were
replaced. All existing wait timing, button controls, draft values, request
counts, and non-rate alert assertions remain unchanged. No production, CSS,
new RED case, or opaque marker-history flag changed in this cascade.
The author ran no tests or formatting. The updated historical test is frozen,
206 physical lines, SHA-256
`600c77c9a3de19ea85fe930119e6dc7fafde30707e10b84ea2106e6dfdd2deeb`.

At the initial checkpoint, an inherited 429 sentence still described its
original static seconds after expiry. Empty-first mutation tests did not prove
remaining-wait accuracy; the later countdown RED/GREEN release below addresses
that separate limitation.

Pre-format GREEN checkpoint hashes (root formatting supersedes these bytes):

| File | Lines | SHA-256 |
| --- | ---: | --- |
| `CmsTemplateEditDesigner.tsx` | 152 | `a5554588ab3c7e597a737944a789a3ece1bd7b169a1f91365cd5fabdd992b498` |
| `cms-template-edit-reconcile-state.ts` | 157 | `a20a277ecbdc503833bb650a865ecee7715fae8ba84774bb56c948440af8885a` |
| `use-template-unknown-attempt.ts` | 169 | `4289ab3a915bdca5d0e7b9d8611ff18b1eea8f26f1ba31f581aca6ea4f2b7a16` |
| `CmsTemplateLatestCheck.tsx` | 44 | `745f257d933cefa6820de042ede708285625576ae3f1cdf0c6570bc7d73f278a` |
| `CmsReviewerOptionsNotice.tsx` | 33 | `38b02e4694fcc77003715acf1f1bd9126aaccc28247f3e1fae3dddcf1a4f2690` |
| `README.md` | 97 | `02e20dab795decfc46e587f8ad528b099964cc4addafdb8281f5df7bd7784aec` |

## Root continuation gate

Root observed 15 files / 91 PASS in
`/tmp/wejammin-native-web-b-green-g08Ftx/green.json`, SHA-256
`053a985937d0899a2977661daae50b8141e524eae1da160a660cebaa2866db87`.
Scoped ESLint then found six errors: two synchronous effect-state updates in
the announcers and four unused fixture bindings. Root released only those two
announcer files, the pure success fixture construction, and this report.

The announcers now render one empty paragraph with no React-managed children.
A ref-bound passive effect exclusively updates that node's safe `textContent`
after commit, and cleanup clears its text. There is no effect state setter,
render-time DOM write, lint exception, deferred timer, or changed oracle.
The success fixture now lists its exact resource fields directly, retaining
successor 3 by default and successor 4 for the explicit rebase case.
The whole template test `describe` block through EOF has identical pre/post
SHA-256 `6fee6ba65582186cb5254b26ded2d2cfe6301a4904c573df1e2cdc0688f98744`;
all 17 case callbacks, assertions, and controls remain unchanged.

Current pre-format lint-correction checkpoint:

| File | Lines | SHA-256 |
| --- | ---: | --- |
| `CmsTemplateLatestCheck.tsx` | 46 | `7e28f34f7823c1d0dd1a636e8b3e4b12aba4d9dd2f47b0bb4b390ba95dbd488b` |
| `CmsReviewerOptionsNotice.tsx` | 37 | `c8817461aed2e93658e421a9563221dbd8a476c54096b49a01a3959d982dac33` |
| `CmsTemplateEditDesigner.uncertain-pending.test.tsx` | 367 | `d03936fa3a32e73cfe60c49064d8579ddf1e0401114cacae7be2f3c4250c9697` |

Root owns formatting, cap/type/lint/Astro checks, focused and historical test
runs, and independent native review. Root's 91 PASS predates this lint
correction; the corrected bytes remain author UNRUN and require root rerun.
All tests remain frozen for root observation; the author
will make no further edits without a bounded release.
No production, hosted, real-device, screen-reader, or externally owned
acceptance criterion is cleared by this checkpoint. No acceptance boxes or
shared tracker state were modified by this author.

## Later bounded TEST-ONLY RED release

Root reported combined normalization checks of 38 files / 532 PASS, including
Web B 91, Related 281, and Receiving 160, with scoped lint and contracts types
clear. Independent bounded Web B production review was CLEAR; width,
remaining-wait copy, and a syntactically invalid JSON proof gap remained open.
Root then released exactly the existing uncertain real-route spec, latest-read
rate-limit unit test, uncertain-pending unit test, and this report. No production,
CSS, configuration, server harness, or new support path was written.

Read the Playwright skill and existing Chrome configuration, local signed-session
helper, server launcher, template fixture, and built-Astro Worker bridge before
authoring. The existing `real-route-chrome` project already includes this spec.
It exercises the actual Astro/Worker routes with test-owned in-memory template
persistence. It does not prove database RPC/RLS or hosted acceptance.

New/updated concrete witnesses, author UNRUN:

- `B-WIDTH-001` at 375 and 1280 pixels: waits for document fonts, measures actual
  idle and pending `boundingBox()` width, holds the intercepted POST unresolved,
  and requires a difference of at most one pixel. It also verifies one disabled
  control (commit), enabled native fields, `aria-busy`, visible pending text,
  a posted preimage, and a real field edit preserved during the held POST. Route
  release/fulfilment cleanup runs even when an assertion fails. Prediction:
  two meaningful width failures on current intrinsic button sizing.
- Existing real-route unknown-outcome case: explicit Check latest waits for a
  real protected GET before both the second lost-response retry and third real
  POST. Two resets, identical key and If-Match, retained audience, Axe results,
  and browser-error assertions remain. Saved status is selected by its role
  and saved text, avoiding the new empty status node. Prediction: PASS.
- Existing stated-wait unit case: retains all timing/control/value checks and
  requires 5 to become 4 seconds at 1,000 ms; the prior 4,999-ms boundary is
  preserved as 1,000 + 3,999 ms. At 5,000 ms the notice may not state numeric
  seconds. Prediction: one meaningful countdown failure on current static copy.
- `B-TPL-005`: adds `new Response('{', ...)` to the existing `it.each` matrix.
  The old schema-invalid `{ unknown: true }` input remains. Both use the unchanged
  native-submit/post-wait blocking callback and assertions. There are now 18
  new admission/announcement unit cases. Prediction: added case PASS through
  the existing invalid-JSON read guard.

Historical pre-format TEST-ONLY freeze (before root normalization and RED):

| File | Lines | SHA-256 |
| --- | ---: | --- |
| `tests/e2e/phase-02-slice-12-template-uncertain-real-route.spec.ts` | 217 | `beeb21fa9294ab12d887476830f7b7b33ea5d518d3c7195e96909353f642b019` |
| `CmsTemplateEditDesigner.latest-rate-limit.test.tsx` | 210 | `72ea2ab367aec824f1027508d3f884375a514e11af0a50924de2e555c8ba3270` |
| `CmsTemplateEditDesigner.uncertain-pending.test.tsx` | 368 | `3b63e9020e534ccf941bedfffee621db24872552a3a4a2fc9cc446ffa5ce9a7c` |

At that TEST-ONLY checkpoint the author ran no runtime, formatting, tests,
browser, Git, or network commands. Root then observed RED as recorded below.

## Width/countdown GREEN release and freeze

Root's actual Chrome RED exercised both 375 and 1280 pixel viewports. Hydration,
held POST, all enabled fields, and only-commit-disabled assertions passed before
each width assertion failed: delta 29.421875 pixels, required at most one.
Receipt: `/tmp/wejammin-native-web-b-width-red-LtrZy6/browser-red.json`, SHA-256
`22a2132e32559c655db9d678f17e4e1d025fb648f4b89c9b7faa597aace39f19`.
Root also observed unit RED: 15 cases / 14 PASS / one stale-429 FAIL / zero setup
failures, SHA-256 `d50c3c5303de50788ab2b87a2af55fdb6b47d873a0481e188fe89eb36eca8846`.

Those results released exactly `CmsTemplateEditDesigner.tsx`,
`cms-template-edit-reconcile-state.ts`, `cms-template-designer.css`, and this
report. Every test remains frozen. The successor action now alone carries
`cms-template-successor-commit`; its scoped CSS uses border-box sizing and
`inline-size: min(100%, 18rem)`. Create and other button widths are unaffected.

The reconciliation hook owns the stated read deadline and remaining-seconds
projection. A one-second interval and focus/visibility listeners calculate
`ceil((deadline - now) / 1000)`, bounded at zero. The polite sentence therefore
uses 4 at the one-second boundary of a five-second wait and clears at expiry.
An unstated wait keeps generic copy with no fabricated countdown. Read/rebase
clear the projection; expiry and cleanup cancel the timer and remove listeners,
and an active guard ignores obsolete callbacks after cleanup. No state update
runs synchronously in the effect body. The immutable attempt guard, shared
wait, protected transport, inputs, CSRF and security boundaries were untouched.

Pre-format GREEN freeze:

| File | Lines | SHA-256 |
| --- | ---: | --- |
| `CmsTemplateEditDesigner.tsx` | 158 | `cb8558748671c1346aad34ee33cf96411ad23bf5393431119a022ba588efa84c` |
| `cms-template-edit-reconcile-state.ts` | 196 | `6663ddf962ecaa6d33cd6cbeebb01eb2d46ea426798fb990599751487093080f` |
| `cms-template-designer.css` | 204 | `2bf0a56ec57b762e6bc1672296b6aef3eb5c223eee3b0d4d80f2f717ea8748fa` |

Author UNRUN: no formatting, runtime, tests, browser, Git, or network commands.
Root owns real Chrome, focused unit, lint/type/format, cap checks, and independent
review before accepting these bytes. Width/countdown implementation is authored;
verified GREEN and externally owned acceptance remain unclaimed.

## Phase-offset expiry review and TEST-ONLY release

Independent bounded review blocked one countdown issue while clearing the other
Web B production items. The shared wait uses an absolute deadline, but the
countdown interval begins in a later passive effect. With effects delayed by
100 ms, a five-second wait can reopen Check at 5,000 ms while the notice still
says one second until its 5,100-ms interval tick.

Root released only the existing latest-rate-limit unit test and this report.
`B-RATE-OFFSET-001` mounts the real designer inside React.Profiler. Its commit
callback advances the fake clock by 100 ms only for the terminal 429 commit:
the button says Check latest version, is disabled, and no longer says Checking.
This precedes passive timer setup and preserves the real React/read lifecycle;
no hook result, source token, or production timer is mocked.

The new case verifies the 100-ms offset, disabled Check at absolute 4,999 ms,
and enabled Check at 5,000 ms. At that same deadline it requires the persistent
notice to be empty with no numeric wait, preserved audience and fetch count,
zero remaining timers, and removal of every registered focus/visibility
listener while the designer is still mounted. Finally unmounts and restores
the listener spies, including after an intended RED failure.

The entire old helper/three-case prefix remains byte-identical: pre/post SHA-256
`5c5d4add87e6df02cdc461461a2cace1aa635db95d69a92d01f7374ab7e1295b`.
The zero-offset case and all prior assertions remain unchanged. Current test:
280 pre-format physical lines, SHA-256
`9131db8e43f44c2e782e350cb94cd8e485083a3c030ac4416797dbc0898f0532`.

Prediction, not observed evidence: prior cases PASS; the new case meaningfully
fails on stale numeric copy at the absolute deadline, with timer/listener
cleanup assertions ready to check the fix. Author UNRUN; no production, CSS,
other test, runtime, format, Git, or network changes. Root must observe RED
before releasing the minimal shared-wait projection/dependency correction.
Root's separate two type errors remain outside this author's claim.

## Minimal phase-offset GREEN release

Root observed the offset test RED: four cases / three PASS / one meaningful
FAIL / zero setup failures. The exact 100-ms shift, disabled Check at 4,999 ms,
enabled Check at 5,000 ms, and same-node/control checks passed before the notice
still said one second. Receipt:
`/tmp/wejammin-native-web-b-width-red-LtrZy6/offset-red.json`, SHA-256
`0dcfb05503ba85bea3c3ffe383b13c7afcef43548b6fbe169b5281de84f3fbf3`.

Root then released only `cms-template-edit-reconcile-state.ts` and this report.
The three-line production correction uses authoritative `readWait.waiting`
both to guard numeric copy and to guard/depend the countdown effect. When the
shared wait expires, the notice clears immediately and the effect cleanup
cancels the offset interval and removes its listeners. Unknown/null waits keep
their generic copy. Inputs, admission, attempts, transport, CSS, and every test
remain unchanged. Hook: 204 pre-format lines, SHA-256
`6574d0fcd02b67ed80f56003d720a45b5b2c8882a6b45ddbd6c456b949b34612`.

Root separately reported the preceding full Web typecheck: 2,049 files, zero
errors, zero warnings, 189 hints; scoped Web B ESLint was also clear before
this fix. Those checks do not validate these corrected bytes. Author UNRUN;
no runtime/format/tests/browser/Git/network commands. Frozen for root's full
unit/lint/type/browser checks and independent readback. No external acceptance
or verified completion is claimed.
