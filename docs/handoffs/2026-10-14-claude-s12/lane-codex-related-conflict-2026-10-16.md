# Lane report — DEC-195 canonical conflict review and explicit reapply

## Latest remaining-wait correction GREEN authoring — FROZEN / UNRUN (2026-10-16)

Claim: **Related remaining-rate-wait correction GREEN**, Dispatch :2307-2309, exact native
`gpt-6.1-sol` / `ultra`. Only `use-related-conflict-review.ts`, `related-status-copy.ts` and this report
were edited in this release. All tests/support and every other production path remain frozen.

Root observed actual RED in `/tmp/wejammin-native-related-review-red-JbGVEL/red-root.json`:
**54 tests / 53 PASS / one meaningful FAIL / zero setup failures**. Receipt SHA-256:
`fa9b045a332eebb1bec912a1c592eff1a5764ed1c1ad817564cf846827157072`.
The failure is the strengthened main conflict 429 case at :256: expected `4 seconds`, received stale
`5 seconds` after 1,000 ms. This author parsed that existing receipt; no test was rerun. The earlier
wrong-cwd `red.json` executed zero tests and is invalid evidence.

The correction preserves `useCmsTemplateRateWait` as the admission gate. A local display projection
updates remaining whole seconds with a mounted/sequence-guarded timer, cleared when the gate expires,
state changes, or the component unmounts. Displayed expiry is tied to the existing gate, so no countdown
can remain after Review changes becomes available. Expiry copy says input is kept and Review changes
is available again; an unknown wait keeps the existing nonspecific safe copy. No server deadline,
token or canonical state is inferred. Shared hooks, reads, schemas, review admission, Reapply CAS,
POST/idempotency behavior, authority and all request lifecycle logic were not changed.

| Claimed production file | Lines | SHA-256 at author freeze |
| --- | ---: | --- |
| `use-related-conflict-review.ts` | 119 | `a58492cbe11342935c00ad4f285c68cbfd5759be876100803727d4e0ecf7df1c` |
| `related-status-copy.ts` | 97 | `eb2cd19e1b78fc63d5c31fa0928e66397e816f53240695e1a24a65d4c60c3b35` |

The five frozen test/support hashes were re-read and match the preceding RED-author freeze exactly:
`46b5cc011aa015b29fc79ab210d7ffe89dc3e61b45c00bb589dcc6b2880ca3df`,
`09042c19c27a1cf25d2f76cd6c73e2c20fc09915bc995f463d90b4d8e223e6cb`,
`6a465c798e2d0edd30b2d01f45da7741673ca68477111c0f9b83a3e51a435df4`,
`346e259a600f84ac4cb565f0702182deccf34088e45f3a9164a9bbb28554e755`,
`be013af5fb2b07a42bd735c173d5c4052eafc3090baa68763d982e1ef547811c`
(same file order as the table below).

No author runtime, tests, formatter, lint, type-check, build, DB, network or git command was run.
No GREEN or acceptance is claimed. Root owns full-folder verification, proof negative controls,
independent correction review and canonical validation/tracking.

## Previous review-correction RED authoring — FROZEN / UNRUN (2026-10-16)

Author: `native_related_green_20261016`, exact owner-authorized native route. Claim:
**NativeRelated review correction RED**. This turn is TEST-ONLY: the two existing conflict suites,
three newly claimed test/support paths, and this report. All production remains frozen. No production fix,
other test, contract, proxy, SQL, spec or tracking path was edited. No runtime/test/lint/formatter/build/DB,
network or git command was run. Root must observe RED before the 429 implementation is released.

The independent review found one actual defect: the review 429 copy keeps its original five-second text,
including after expiry (`use-related-conflict-review.ts:66-69`, `related-status-copy.ts:84-85` at review).
The other requests are proof gaps, not additional observed production bugs. The new tests distinguish them.
No new test is represented as passed or failed until root runs it.

### Test matrix and expected discriminators

| Suite | Cases | Witness |
| --- | ---: | --- |
| Existing conflict suite | 9 retained | Existing identities/callback assertions kept; the 429 case now checks 5 seconds initially, 4 after 1 second, disabled through 4,999 ms, enabled at 5,000 ms with no expired countdown text. |
| Lifecycle suite | 3 retained + 8 new = 11 | Both read stages: mounted deadline with fetch really ignoring abort, failed/settled UI BEFORE late resolution, then no next GET/POST/navigation/snapshot or draft/token change. Declared-safe 503 retries occur at 0/250/1,000 ms; unsafe 503 does not retry. Unmount during either retry wait removes owned timers and produces no later request/POST/navigation. |
| New bindings suite | 1 + 16 = 17 | Server-only draft/rule tokens, ordered server pins/exclusions, derived key/version and unknown bound are asserted INSIDE the section named by `cms-related-server-heading`; local version 4, pins/exclusions, selected rule and bound 12 stay separate and unchanged. Both stages reject wrong entry, missing/weak/mismatched ETag, malformed or unknown-field strict payload, 403 and 404. |
| New admission suite | 2 | Native form submit cannot write before review, during either held stage or after verification; explicit Reapply is required. Another 409 removes snapshot/Reapply and requires another complete verified two-stage review with the fresh token/key. |
| Existing save suite | 15 unchanged | Outside this six-path claim; byte-identical retained non-conflict cases. |

Expected focused total: **54 cases** (39 across four conflict suites + 15 retained save cases).
Predicted actual RED: the existing 429 case fails at its new `4 seconds` assertion after 1,000 ms because
production still renders `5 seconds`. The expiry assertion is also present and becomes reachable after
the countdown behavior is corrected. No failures are predicted for the added proof witnesses against the
reviewed implementation; root's requested negative controls must establish their mutation sensitivity.

Fixture safety: pure read/response/DOM fixtures were extracted into `related-conflict.test-support.tsx`;
the nine old main case names and three old lifecycle case names remain. The old abort-rejecting deadline
and abort-ignoring unmount cases remain, with additional mounted ignoring-abort cases. Binding fixtures
start from the real draft/rule shapes. Valid-shaped wrong-entry and ETag fixtures are schema-checked;
the wrong-entry draft has its ETag rebound to that wrong entry, and the mismatched draft ETag remains
syntactically valid. Those fixture assertions execute BEFORE mocked fetch setup, so transport catch logic
cannot hide a broken fixture. No existing assertion was weakened; only the requested 429 assertions were
strengthened. No runtime or formatter was invoked.

### Frozen test/support hashes

Paths are relative to `apps/web/src/components/cms-related-content/` in the Slice 12 worktree.

| File | Lines | SHA-256 |
| --- | ---: | --- |
| `CmsRelatedContentForm.conflict.test.tsx` | 279 | `46b5cc011aa015b29fc79ab210d7ffe89dc3e61b45c00bb589dcc6b2880ca3df` |
| `CmsRelatedContentForm.conflict-lifecycle.test.tsx` | 289 | `09042c19c27a1cf25d2f76cd6c73e2c20fc09915bc995f463d90b4d8e223e6cb` |
| `CmsRelatedContentForm.conflict-bindings.test.tsx` (new) | 157 | `6a465c798e2d0edd30b2d01f45da7741673ca68477111c0f9b83a3e51a435df4` |
| `CmsRelatedContentForm.conflict-admission.test.tsx` (new) | 106 | `346e259a600f84ac4cb565f0702182deccf34088e45f3a9164a9bbb28554e755` |
| `related-conflict.test-support.tsx` (new) | 173 | `be013af5fb2b07a42bd735c173d5c4052eafc3090baa68763d982e1ef547811c` |

Current production freeze hashes (root formatted the prior GREEN after its author freeze; none were
changed by this test-only turn):

- `use-related-content-form.ts`: `24810f14b414b2bee592f32fbeeff9dcc1a45c9fa23a25f9c39706d527887a1e`.
- `CmsRelatedContentForm.tsx`: `42588c9a903f8806115d93436fa9b5ac4620298a4f2f95cd24cc776dd3a494b5`.
- `CmsRelatedStatus.tsx`: `b713437adad923740a23abee364e18b8e26b7b6d8a385570cdf8d4f046651771`.
- `related-status-copy.ts`: `0f5c3f2221774ec4ef82da48d2466c686e849658760678d261d8ecd308513b4c`.
- `related-content-types.ts`: `2a22150f554823641e6ee53867d5f893c1b9fe3f6f85a8477e215c9006a1489a`.
- `related-conflict-read.ts`: `cdc3681d6d4f87ee00e42457317667eac3107df8ce9d2e77d782b1f8d543b0f1`.
- `use-related-conflict-review.ts`: `f57ba48bed10e914046bf1dec13fc12462ba6f7a654b4fb5489cb1c80a53acf8`.
- `CmsRelatedConflictReview.tsx`: `476ef338929c18040889e0b4ec3813417c8e6d1fac89568c2684a1e0598586f9`.
- `README.md`: `6c173be32d697a53e2981bdaa13638c35e3c24b88760598519f80bdcafa11794`.
- Unchanged `CmsRelatedContentForm.save.test.tsx`: `0d8763d4b8dea3666ca27fa397e5727af3c022a92b8602802e1f4548e5a78786`.

Next: root observes focused RED, classifies any harness failure separately, then releases only the observed
429 correction. Root owns subsequent GREEN, mutation controls, independent review and canonical validation.

## Previous native GREEN checkpoint — FROZEN / UNRUN (2026-10-16)

Author: `native_related_green_20261016`, exact owner-authorized `gpt-6.1-sol` / `ultra`.
This resumes the transferred **Native takeover DEC-195 conflict GREEN** claim in the Slice 12 Dispatch.
Nine production/documentation paths below plus this report are the exact ten claimed paths. No other path
was edited. Protected primary `/home/rob/Projects/WeJammin` was not modified. No source/test/contract/proxy/SQL
or tracking path outside this claim was changed. No author test, runtime, lint, type-check, build, DB,
validation, network or git command was run. Static file reads, text searches, line counts and hashes only.

**Root's final revised RED was checked from its existing receipt, not rerun by this author:**
`/tmp/wejammin-codex-related-conflict-red-8Wl7eZ/red-lifecycle-final.json`, 27 total / 16 PASS / 11 FAIL,
SHA-256 `c5a50d5b7384d9195884e9160cc21d78080632cc21ed5083286b8083b9601fc5`.
The three frozen tests remain byte-identical to the root-observed RED revision (hashes below).
No GREEN, full validation, hosted acceptance or slice completion is claimed. Root owns focused verification,
independent native review, canonical gates and tracking.

### Implemented behavior

- Replaced blind adoption of the 409 `currentVersion` with an explicit review requirement. Neither a normal
  Save click nor native form submission can send while that requirement is held. A repeat 409 clears the
  reviewed snapshot and requires a new review. Editing local lists/rule/bound keeps the conflict.
- Review changes sends protected draft detail FIRST, saved rule SECOND. No query/body or conditional/mutation
  header is sent; both reads use `GET`, same-origin credentials, `no-store`, and `redirect: error`.
- Draft verification reuses the lazily loaded existing `EntryDraftDetailResourceSchema` and
  `entryDraftDetailEtagMatchesResource`; the related read lazily imports its existing strict
  `RelatedContentRuleReadSchema` and `relatedRuleReadAnswersEntry`. Requested-entry identity and the non-null
  rule's exact strong version ETag must match. No Zod/value contract import enters the static island closure.
  The related contract currently has no curated lazy-validator export, so its schema uses a dynamic contract
  import within the claimed helper; no contract export path was changed.
- Each read stage owns an 8,000 ms AbortSignal/deadline, covering safe retries, body parsing and lazy validation.
  A race against abort also ends the stage when fetch ignores cancellation. Every continuation checks its
  mounted/sequence/signal ownership before state, retry-timer creation or the next GET. Retry waits cancel on
  abort; safe dependency retries use the existing 250/750 ms policy. A verified 429 gates Review changes for
  the stated wait and keeps input. Failed, malformed, aborted, 403 and 404 reads offer no Reapply.
- The verified server snapshot renders beside the untouched local lists and controls: draft version, locale,
  lifecycle, revision state, rule token, ordered pins, exclusions, derived key/version and eligible count.
  The saved rule's unknown candidate bound is stated explicitly; no canonical bound is inferred or copied.
- Explicit Reapply passes the reviewed non-null rule's `version` directly into the request builder, or the
  EARLIER draft's `entry.version` for `rule: null`, with no later draft GET. The first Reapply gets a fresh
  idempotency key; unchanged uncertain attempts retain the existing key policy. The original token remains
  visible until the existing 201 handling adopts the saved version. Discard is an explicit reload link.
- Added a mounted/sequence guard to the form's post-submit continuation. The existing POST transport and its
  201/version/idempotency/refusal parsing were not changed; unrelated uncertain-POST/proxy F2 stays out of scope.
  Authority/concealment and the existing per-user/per-party read limits remain server-owned.

### Frozen production/documentation hashes

Paths below are relative to `/home/rob/.codex/worktrees/phase2-slice12/WeJammin/apps/web/src/components/cms-related-content/`.
Line counts exclude a trailing empty line; helpers remain at most 300 lines and components at most 200.

| File | Lines | SHA-256 |
| --- | ---: | --- |
| `use-related-content-form.ts` | 284 | `96b63165384af412fc043ab040c6fc145cb4778f668950f5cad1c5a8f0718397` |
| `CmsRelatedContentForm.tsx` | 154 | `cea13cc6b8a927c828d8d983f2096926073127546d0b80f71d176bad406dfc0f` |
| `CmsRelatedStatus.tsx` | 121 | `b713437adad923740a23abee364e18b8e26b7b6d8a385570cdf8d4f046651771` |
| `related-status-copy.ts` | 94 | `0f5c3f2221774ec4ef82da48d2466c686e849658760678d261d8ecd308513b4c` |
| `related-content-types.ts` | 48 | `86f355902faf5f398546dfd87716589f1cc8d6063b2c10416518b24a28843004` |
| `related-conflict-read.ts` (new) | 221 | `6942e0cfb323dae7d79cba816b83267072855a5f7937adc93b72bcfaa340c390` |
| `use-related-conflict-review.ts` (new) | 76 | `b120e27d78317fac2bf6ce12e02bb3cd7a756f371a572b9918ca2e4fba7dfb6b` |
| `CmsRelatedConflictReview.tsx` (new) | 108 | `0480df6e7ebee9dc14b30f1880100afe558105acb55ff4168fbe614f76d023ad` |
| `README.md` | 98 | `6c173be32d697a53e2981bdaa13638c35e3c24b88760598519f80bdcafa11794` |

Frozen tests, not edited by this author:

- `CmsRelatedContentForm.conflict.test.tsx` — 380 lines,
  `6ec64c282d82a5eda7cf4b4608501df9025d31fd94136173888ec281d9947db6`.
- `CmsRelatedContentForm.conflict-lifecycle.test.tsx` — 208 lines,
  `c609eb9063ed0f270115217b8b8f7f56da0622524a0fe7bc9198c51a4164549d`.
- `CmsRelatedContentForm.save.test.tsx` — 275 lines,
  `0d8763d4b8dea3666ca27fa397e5727af3c022a92b8602802e1f4548e5a78786`.

Source basis: FE03 form conflict :1224 and network/retry :1171-1176; BE03c saved-read/resource/ETag and
authority contracts; DEC-195; the frozen strict schemas, same-origin read proxy, existing safe-read retry
and rate-wait helpers; the three frozen component suites. Required AGENTS/rules/instructions and
implementation/TDD/React/TypeScript/Vitest/debugging/clean-code/context-mode skills were read. The README
now documents the implemented DEC-195 read and conflict flow rather than the obsolete SG-S12-03/04 stubs.

## Historical RED authoring record

## Status

TEST-ONLY RED authoring complete and FROZEN, then corrected in a same-file followup. No production, hook,
read-module, spec, contract or SQL file was changed. No validation, test, lint, type, build, DB, runtime, network
or git-mutation command was run by this lane (root owns all validation). No GREEN is claimed.

**Root focused RED observed (2026-10-16):** `/tmp/wejammin-codex-related-conflict-red-8Wl7eZ/red-root.json`,
24 tests = 16 PASS / 8 meaningful FAIL. The new suite's 9 cases: 8 FAIL (each on the missing "Review changes"
control) and the last preservation/reload case PASS. The retained old suite's 15 cases all PASS. An initial
wrong-cwd attempt (`red.json`) ran 0 tests and is NOT RED evidence. This matches the predicted oracle below; the
one initial prediction of "9 fail" was corrected to 8 FAIL + 1 PASS.

Model: `Phils-Charm/deepseek-v4.1-flash` / `high` (exact requested route; no fallback used).

## Test-only followup (after root RED; production still frozen)

Applied in the same two test files (no new file yet):

1. **Case 3 fixture corrected.** The reapply now answers `savedOf({ version: '11' })` — the reviewed rule version
   `10` + 1 — instead of the inconsistent `8`, and the case additionally asserts the success heading
   ("Related content saved") and "Entry version11".
2. **Case 2 strengthened.** Both GETs are now asserted (not the first only): the full request URL has no query
   (`new URL(call.url).search === ''`), the body is absent, `credentials: 'same-origin'`, `cache: 'no-store'`,
   and every prohibited mutation header is absent (`if-match`, `if-none-match`, `if-modified-since`,
   `idempotency-key`, `x-csrf-token`, `content-type`).
3. **Lifecycle tests** were subsequently written in the approved bounded file (see "Lifecycle followup" below).
   The conflict suite is 380 lines, near the 400-line test cap, which is why they live in a separate file.

The original callbacks are preserved. No production, runtime or reader/hook implementation was touched.

## Lifecycle followup (approved new file; TEST-ONLY; revised)

Root approved and claimed the new bounded file
`apps/web/src/components/cms-related-content/CmsRelatedContentForm.conflict-lifecycle.test.tsx`. It is TEST-ONLY;
production stayed frozen. Root's full read found one oracle gap in the first revision (below), now corrected.

**Oracle gap and correction.** The first revision's fake `fetch` ALWAYS rejected on abort, so after unmount the
held promise was already settled and the test's `releases[...]` calls could not deliver a late answer — the
"ignores a late answer" assertion was vacuous. The fake is now parameterized:

- `abort-rejects` (default; the deadline case): rejects on abort with a `DOMException` named `AbortError`,
  exactly like a real aborted fetch.
- `abort-ignores` (the two unmount cases): records the abort but keeps the promise PENDING, so the test itself
  resolves the held call AFTER the abort. The code must ignore that late answer — proven by asserting, after the
  `await`, that no subsequent GET/POST/navigation happened — rather than the test never delivering one.

Both unmount cases still assert `signal.aborted === true` on the owned signal. Current file: 208 lines,
`c609eb9063ed0f270115217b8b8f7f56da0622524a0fe7bc9198c51a4164549d`.

The suite drives the real component with the fake `fetch` and covers:

1. **8-second deadline (actual observable `AbortSignal`, `abort-rejects`).** The first review read (the draft
   GET) carries an `AbortSignal` that is not aborted at 7,999 ms and is aborted at 8,000 ms; the draft, its token
   and the entered bound are unchanged and no Reapply is offered.
2. **Unmount during the draft read (`abort-ignores`).** The owned signal aborts on unmount; a late draft answer
   is really delivered and starts no rule read, no POST and no navigation (asserted on `fetch`/submit call counts
   and `history.pushState`/`replaceState`).
3. **Unmount during the rule read (`abort-ignores`).** After the draft read resolves and the rule read is held,
   the second call's owned signal aborts on unmount; a late rule answer is really delivered and starts no POST and
   no navigation.

Absence of further requests is asserted directly after the awaited late resolution, not inferred from the absence
of React warnings. The fake `fetch` never infers authority from a client token.

Predicted RED (unrun): no "Review changes" control exists, so each case fails at
`buttonNamed(container, 'Review changes')`; if a control existed but the read carried no signal or did not abort,
the `signals[0] instanceof AbortSignal` / `.aborted` assertions would fail. Root's initial lifecycle RED ran
against the FIRST (unparameterized) revision; this revised version supersedes it and requires a rerun.

## Scope

The bounded TEST-ONLY authoring of the FE03 :1224 (form contract) conflict flow for `CmsRelatedContentForm`, plus
the move-and-strengthen of the three blind-adoption conflict cases out of the existing save suite. The current
defect is `use-related-content-form.ts:218-227` (`adoptVersion`): it copies the 409's `currentVersion` into
`version` blindly and invites a re-save over a saved rule it never showed, which FE03 :1224 forbids ("Show current
server version beside preserved draft. Actions: Review changes, Reapply when permitted, or Discard. Never overwrite
automatically.").

Locked sources read in full before authoring: AGENTS.md, the active `.agents/instructions/` and `.agents/rules/`
files, `implement-slice-tdd`, `tdd-workflow`, `react-best-practices`, `vitest`, `systematic-debugging`;
FE03 `03-cms-content-modeling.md` (:890, :1072, :1121, :1216-1225, :1601, :1794, :2665), BE03c
`03c-composition-taxonomy-localization.md` (:94, :164-165, :391, :986-995, :1367, :1401, :1595, :1825),
`DEC-195`, the frozen contracts `packages/contracts/src/cms-composition/related-content.ts`, the Worker read
route/proxy/port, the Slice 09 locale conflict precedent, and the three `review-web-related*` files.

## Selected design (root-selected, source-backed; encoded as the RED oracle)

1. **Review changes reads two protected GETs, in order.** The protected draft detail (CMS-03B-11,
   `GET /api/v1/cms/entries/{entryId}`) FIRST, then the saved rule (`cmsRelatedContentRead`, DEC-195,
   `GET /api/v1/cms/entries/{entryId}/related-content`). A verified server snapshot is shown beside the local draft.
2. **The reviewed token, never the 409's `currentVersion`.** Reapply re-sends the preserved draft on the reviewed
   rule's `version` when it is non-null; when the read answers `rule: null` it reuses the EARLIER draft
   `entry.version` the review read. There is no GET after an empty rule to fetch a newer CAS operand, because that
   could overwrite an unreviewed intervening rule.
3. **Explicit Reapply with a fresh key.** Reapply uses a fresh `Idempotency-Key` (not `setState(version)` then
   save through a stale closure).
4. **Fail closed.** A failed, aborted or malformed read preserves the draft and its original token and offers no
   Reapply; no automatic draft replacement. Discard is an explicit reload only after review.
5. **Read boundary.** GET only, same-origin credentials, `cache: no-store`, no query, no body, no CSRF / If-Match /
   idempotency header; 8 s deadline and safe-read retry. A 429 on the read keeps the input and disables Review
   changes until the stated wait elapses.
6. **Unknown saved bound preserved.** The read names the rule by `{key, version}` only, so `maxCandidates` is not
   known; the person's entered local bound is kept and used on Reapply, and no canonical bound is fabricated.

## Files (path, lines, SHA-256 at freeze)

New (untracked):

- `apps/web/src/components/cms-related-content/CmsRelatedContentForm.conflict.test.tsx` — 354 lines,
  `a3952316dee1fd580746d4030ec7b08dc086563a57560e5a5b5126feb4175617` (root-RED revision). After the
  same-file followup (corrections 1-2): 380 lines,
  `6ec64c282d82a5eda7cf4b4608501df9025d31fd94136173888ec281d9947db6`.
- `apps/web/src/components/cms-related-content/CmsRelatedContentForm.conflict-lifecycle.test.tsx` — 196 lines,
  `1ee204d53f4730c5cb8b4f72734d48c605575076a8306a22b77045404e731b73` (first revision, superseded). After the
  oracle-gap correction: 208 lines,
  `c609eb9063ed0f270115217b8b8f7f56da0622524a0fe7bc9198c51a4164549d`.

Modified:

- `apps/web/src/components/cms-related-content/CmsRelatedContentForm.save.test.tsx` — 275 lines,
  `0d8763d4b8dea3666ca27fa397e5727af3c022a92b8602802e1f4548e5a78786` (removed the three
  `describe('CmsRelatedContentForm: version conflict')` cases at former :278-328 and the now-unused `PAGE_PATH`
  import; all non-conflict cases retained).

Read-only at freeze (unchanged; these are the production surfaces the RED targets and the seams it uses):

- `apps/web/src/components/cms-related-content/use-related-content-form.ts` (defect; `adoptVersion` :218-227) —
  `0e8169e300fe4cc6beffe62224c9fdbfef7aef85a8650f88f33f756853d0c41a`
- `apps/web/src/components/cms-related-content/CmsRelatedContentForm.tsx` —
  `7191db04f491ea1c73e6d9d358ec2843f73f34083a20dc85eb62e99b7c089366`
- `apps/web/src/components/cms-related-content/CmsRelatedStatus.tsx` —
  `64d5a72d32593e922352475ffa9ad0ba9d1766c126f8bdfb29a04ca573280531`
- `apps/web/src/components/cms-related-content/related-content-types.ts` —
  `b4211ba324b4d9a2587cecff2be94125783dd73e3f2edaf29dbf5db590f62d04`
- `apps/web/src/components/cms-related-content/related-content.test-support.tsx` —
  `ff28c370cdf2e12b7333cb603e77d72379352485db7cfc18d6c5b3bb00867c9e`
- `apps/web/src/components/cms-related-content/related-status-copy.ts` —
  `c880787cc8d2f93796abcaed44603e31b2226c5840867e4dcb0074369fe0b9b0`
- `apps/web/src/components/cms-related-content/related-content-submit.ts` —
  `0d732584a306495411630a8ceeacb5a89c6dd68d2550bc7438a67cac2922fb2b`
- `apps/web/src/components/cms-related-content/related-content-page-reads.ts` —
  `e2125c2037da1bcf4017d4711437a941a9d18754db1babd9e8a3166924801e34`
- `apps/web/src/components/cms-related-content/load-related-content-page.ts` —
  `1e1df2376521c9624c9a1f235d3fe02f61d244573bdb1684cf20e7bb56c53067`
- `apps/web/src/lib/safe-read-retry.ts` —
  `41717f9c39aadc6cafb358ed588db41760616cd4bb41926f25861fcd00888991`
- `apps/web/src/components/cms-composition/cms-template-rate-wait.ts` —
  `c0771f23f5634afbc45bdcd8669ee7f14ec8cbdd7ee4b388f5bd1f99ac372c3e`

Checkout `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, branch `claude/phase2-slice12`, HEAD
`b16edb54a7a1b698ed8ca15b6085046d4270626e`. Protected primary `/home/rob/Projects/WeJammin` never touched.

## Runs

This lane ran nothing (TEST-ONLY authoring lane; root owns all validation, focused RED and GREEN). No `pnpm test`,
`lint`, `type-check`, `build`, `db:verify`, `validate`, network or git-mutation command was run by this lane.

Root's focused run: `/tmp/wejammin-codex-related-conflict-red-8Wl7eZ/red-root.json` — 24 tests, 16 PASS / 8
meaningful FAIL. New suite 9 cases: 8 FAIL (missing "Review changes") + 1 PASS (preservation/reload). Retained old
suite 15 cases: 15 PASS. The earlier wrong-cwd attempt `red.json` ran 0 tests and is NOT RED evidence.

## Predicted RED (exact case identities and assertion failures against current source)

**Observed by root: 8 FAIL + 1 PASS** — cases 1-8 failed exactly as predicted (each on the missing "Review
changes" control); case 9 PASSED because the reload-link and conflict-retention behavior it asserts already
exists. The corrected prediction (8 FAIL + 1 PASS, not 9 fail) is the accurate oracle.

Current source facts: `CmsRelatedContentForm.tsx:88-95` renders `CmsRelatedStatus` with `canAdopt` (a button
labelled "Keep my choices and use the current entry version") and never a "Review changes" control;
`CmsRelatedStatus.tsx:107-116` renders only the adopt button and the reload link for a conflict; the form issues
no read on a conflict. So every case that needs "Review changes" / "Reapply" fails on the missing control, and
every `fetch`-counting assertion fails because the current code performs no read.

In `CmsRelatedContentForm.conflict.test.tsx`:

1. `CmsRelatedContentForm: 409 review, reapply and discard > keeps the ordered pins, the rule and the entered bound, and offers Review changes` — RED at `buttonNamed(container, 'Review changes')`: no button with that name (current label is "Keep my choices and use the current entry version").
2. `... > reads the protected draft detail first and then the saved rule on Review changes, with no save and no mutation header` — RED at `buttonNamed(container, 'Review changes')` (missing control), and would also fail `expect(called.map(...)).toEqual([DRAFT_PATH, RULE_PATH])` because `fetch` is never called.
3. `... > offers no Reapply before a verified read; Reapply re-sends on the reviewed rule version with a fresh key and the entered bound` — RED at `buttonNamed(container, 'Review changes')` (missing control); `expect(() => buttonNamed(container, /^Reapply/u)).toThrow()` passes vacuously now, but the later `/^Reapply/u` click fails.
4. `... > reapplies on the earlier draft entry version when the reviewed read answers no rule, without a further read` — RED at `buttonNamed(container, 'Review changes')` (missing control).
5. `... > keeps the draft and its token and offers no Reapply when the review read fails` — RED at `buttonNamed(container, 'Review changes')` (missing control); the preservation assertions currently pass, so this case is only partly meaningful until the control exists.
6. `... > keeps the draft and offers no Reapply when the reviewed rule read is malformed` — RED at `buttonNamed(container, 'Review changes')` (missing control).
7. `... > offers Review changes without a current version and keeps the conflict when a reapply answers 409 again` — RED at `buttonNamed(container, 'Review changes')` (missing control).
8. `... > keeps the input and disables Review changes until the stated 429 wait elapses` — RED at `buttonNamed(container, 'Review changes')` (missing control).
9. `... > keeps the conflict while the person edits, and still offers the page reload` — **PASS (observed)**. It asserts only the reload link, the preserved pin and conflict retention, all of which already exist; the new control is the discriminator and is covered by cases 1-8.

The single decisive discriminator across all cases is the absence of a "Review changes" control and of the two
ordered protected GETs. The blind-adoption defect itself is pinned by case 3: the current adopt button would set
`version` to the 409's `currentVersion` (`9`), and case 3 asserts the reapply token is the reviewed rule version
(`10`), which no current code path produces.

The retained suite `CmsRelatedContentForm.save.test.tsx` loses the three moved conflict cases; its remaining 14
cases are unchanged in behavior.

## Test corrections

None to an existing oracle beyond the authorized move. The three `describe('CmsRelatedContentForm: version
conflict')` cases (former `:278-328`) are relocated and strengthened in the new file; the input-preservation
assertions (`Your choices are kept.`, the preserved pin, the reload link) are retained, and the blind-adoption
expectation (`expectedVersion === '9'` from the 409's `currentVersion`) is replaced by the reviewed-token
expectation. No other existing assertion was weakened or removed.

## Spec citations

- FE03 `03-cms-content-modeling.md:1224` (form contract conflict): "Show current server version beside preserved
  draft. Actions: Review changes, Reapply when permitted, or Discard. Never overwrite automatically."
- FE03 `:1216-1225` (the form contract table); FE03 `:890`, `:1121`, `:1601`, `:1794`, `:2665` (CMS-16 /
  CMS-03C-05 related-content surface, candidates from readable entries, one fixed refusal).
- BE03c `:164-165` (CMS-03C-05 route; source-edit authority; target projection recheck); BE03c `:94`, `:391`,
  `:1825` (the DEC-195 read, its path-only addressing and its authority); BE03c `:986-995`
  (`RelatedContentResource` / `RelatedContentRuleRead { rule: RelatedContentResource | null }`); BE03c `:1367`,
  `:1401`, `:1595` (read error matrix and authority rows).
- `packages/contracts/src/cms-composition/related-content.ts:83-96,121-151` (frozen `RelatedContentResourceSchema`,
  `RelatedContentRuleReadSchema`, `relatedRuleReadAnswersEntry`).
- FE03 `:1172-1175` (network and retry contract: 429 waits for `Retry-After`, keeps input; 502/503/504 retried
  twice when declared safe; reads are `no-store`); BE03c route registry (8,000 ms Tier 1 read deadline).

## Open items / BOUNDARY

- No new BOUNDARY. The read seam (`RelatedContentPageReads.savedRule`, `cmsRelatedContentRead`) already exists in
  production (DEC-195), so the Review-changes read is implementable now; the browser-side canonical read of the
  draft detail and rule (a reader/helper) and the hook/component conflict state do not exist yet and are the
  production work this RED gates.
- The review of the changed rule (the "verified server snapshot beside local") is asserted only to the extent the
  current DOM exposes it (the read happened, the draft is preserved). A dedicated server-snapshot view component
  does not exist yet; its exact copy is a production/component decision for root, not invented here.
- The retained 429 case uses fake timers to pin the wait boundary (0 / 4,999 / 5,000 ms); the production timer is
  expected to be the existing `useCmsTemplateRateWait` pattern, matching the candidate rate-limit suite.

## Requests to root

1. Rerun the focused RED over the corrected `CmsRelatedContentForm.conflict.test.tsx` (fixture 11 + both-GET
   boundary) and confirm the retained `CmsRelatedContentForm.save.test.tsx` non-conflict cases stay green.
2. **Lifecycle file written and frozen, revised** (approved filename, TEST-ONLY):
   `apps/web/src/components/cms-related-content/CmsRelatedContentForm.conflict-lifecycle.test.tsx` (208 lines,
   `c609eb9063ed0f270115217b8b8f7f56da0622524a0fe7bc9198c51a4164549d`). It holds the 8-second deadline/abort test
   and the two unmount-during-each-stage tests (draft GET and rule GET) described under "Lifecycle followup", with
   the parameterized fake that delivers a real late answer after the abort. Root's initial lifecycle RED ran
   against the first revision; this revised version requires a rerun. Keeping these separate holds the main
   conflict suite (380 lines) under the cap.
3. Separately claim/release the production pieces this RED gates: the browser canonical reader/helper for the two
   protected GETs, the extracted conflict hook, and the `CmsRelatedStatus` / form conflict component (Review
   changes, Reapply, Discard) with the reviewed-token reapply and the read boundary (GET-only, `no-store`,
   no mutation header, 8 s deadline, safe-read retry). Production remains frozen until then.
4. Note for the follow-up: the separate "uncertain POST behavior / proxy F2" work is explicitly out of this
   lane's scope and was not touched.
