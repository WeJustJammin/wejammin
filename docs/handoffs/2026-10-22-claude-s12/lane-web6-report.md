# Lane claude_s12_web6 report

## Status
PARTIAL (2026-10-29). Rows 1, 2, 4 and 5 are DONE (rows 1 and 2 with RED tests, product fixes, green). Row 3 (AC-271) is a complete seven-state matrix over every island the clause names with 272 tagged tests, but the individual clauses listed under Defects fail in product code that is outside this lane's claim (Defects section): they are reported, not fixed, and their tests keep only the passing half, titled "(kept half)". AC-271 therefore stays `partial`. Nothing is marked done in any ledger.

## Scope
Brief briefs/web6-fixes.md, rows 1-5. Model note: row 3 was authored by four Sonnet sub-agents (gov, latest, cmd-a, cmd-b) under a common brief (scratchpad/claude_s12_web6/matrix-brief-common.md); I re-ran, formatted, linted and type-checked every file they produced and read their defect evidence. Their probe outputs are kept in `recite4/web6-probes/`.

## Per-row result
| Row | Result | Evidence |
|---|---|---|
| 1 FE03 1048 in three forms | DONE. RED then fixed: vocabulary designer, term action, locale form no longer disable their fieldset while pending; only the commit control is disabled. The locale hook also had a defect the new test exposed: `edited()` reset a `pending` status to `idle` on any edit (fixed). The vocabulary designer still locks its fields after a verified success (unit5 pattern) | CmsTaxonomyVersionDesigner.pending.test.tsx, CmsTaxonomyTermForm.pending.test.tsx (2), CmsLocaleVariantForm.pending.test.tsx |
| 2 AC-042 named result heading | DONE. RED (no heading) then fixed: a verified success is `h3#cms-template-result-heading` (tabindex -1, accessible name "Draft created." / "Draft version saved.") inside the polite status region; it takes focus and keeps it. A refusal keeps focus on the summary region ("focus summary/field"). Both designers (successor shares `focusCmsTemplateResult`) | CmsTemplateDesigner.result-focus.test.tsx (4) |
| 3 AC-271 | PARTIAL, see matrix and Defects | 31 files / 300 tagged tests incl. rows 1-2, 4-5 files |
| 4 AC-272 browser half | DONE, no defect. Sentinel base/theirs/yours values appear only inside `.cms-diff`; never in an attribute, title, URL, history, storage, cookie, console, BroadcastChannel/WebSocket/EventSource/beacon/Cache; the accept body carries a choice, never a value; values are gone after accept and when another instance opens; every `/api/v1/` literal of the island is a route it owns and none is a CMS-03C-18 to -21 operation | CmsCompositionPage.diff-privacy.test.tsx (2), composition-browser-routes.test.ts (2) |
| 5 AC-001 accessibility contracts | DONE, no defect. The contract is strict at the definition, a slot, an allowed block reference and a binding: an `accessibility` (or any unknown) member is `unrecognized_keys`; the Worker answers 422 TEMPLATE_VALIDATION_FAILED with the violation at the member's own pointer (`/slots/0/allowedBlocks/0/accessibility`, code `invalid`) before the port; resource and detail schemas are closed too; a block reference is exactly `{blockKey, blockVersion}`. The DB function behind the route was not exercised (no db runs) | template-accessibility-contract.test.ts (15), template-accessibility-member.test.ts (5) |

pw5 spec impact (row 2): in `tests/e2e/phase-02-slice-12-template-states-real-route.spec.ts` the test `[P2-S12-AC-042] a successful successor save keeps focus off every other control while pending, then moves it to the named result` asserts `savedStatus(page)` (the status region) `toBeFocused` twice: that now FAILS. It must assert `page.getByRole('heading', { level: 3, name: 'Draft version saved.' })` is focused (and stays focused). The render test (`toContainText`, the link inside `savedStatus`) and the `Draft version saved.` `toContainText` assertions in template-real-route and template-uncertain-real-route still hold. The CMS-11 row also says "announce the version and the next action (submit for review)"; the page announces "Open latest draft" as the next action (not changed).

## Row 3 matrix (outcome per island and state; test = `[P2-S12-AC-271] <family>State <state>: ...`)
Legend: P proven, K kept half (the failing half is a DEFECT), N/A the spec cell says "Not applicable" or the island has no such path (evidence test where stated).

| Island (operation) | idle | loading | success | empty | error | degraded | disabled |
|---|---|---|---|---|---|---|---|
| governed review detail (CMS-03C-10) | P | P | P | P | P | P (see A1) | P |
| governed queue (CMS-03C-11) | P | N/A evidence test (server rendered, no client read) | P | P (no-records x2 scopes, filter-miss) | P (403/404/429/503, 409 restart) | K (G1) | P (303 sign-in redirect) |
| pattern selector (CMS-03C-13) | P | P | P | P | P (503/403/409 restart) | K (D1) | P |
| taxonomy selector (CMS-03C-17) | P | K (D2) | P | P | P | P | P |
| template latest read | P | P | P | P (not-disclosed; no-records N/A) | P | K (L1) | K (L2) |
| pattern latest read | P | K (L3) | P | P | P | K (L4) | P |
| vocabulary versions read | P | K (L5) | P | P | P | K (L6) | P |
| terms read | P | K (L7, L8) | P | P | P | P | P |
| update diff (CMS-03C-14) | P | P | P | P (no-update) | P | P | P |
| template create/successor (CMS-03C-01) | P | P | P | N/A | K (A1x, A2, A6) | K create (A3); P successor | P |
| vocabulary designer (CMS-03C-16) | P | P | K (A4) | N/A | K (A1x, A2) | P edit; new vocabulary NOT-PROVEN (no id to refetch) | P |
| locale variant (CMS-03C-04) | P | P | K (A4) | N/A | K (A1x, A2 chain mismatch, A6) | K (A3) | P |
| related content (CMS-03C-05) | P | K (A5) | P | N/A | K (A1x, A2) | K (A3) | P |
| term action (CMS-03C-03) | P | P | P | N/A | K (A1x, A6) | P | K (A7) |
| pattern designer (CMS-03C-12) | P | P | P | N/A | K (A1x, A2) | P | P |
| submit for review (CMS-03C-06) | P | P | P | N/A | P | P | P (kept; spec names no permittedNextActions input) |
| decision (CMS-03C-07) | P | P | K (B1) | N/A | P | P | P |
| assignment (CMS-03C-08) | P | P | K (B1) | N/A | P | P | K (B2) |
| activation (CMS-03C-09) | P | K (B3) | K (B1) | N/A | P | P | P |
| insert/place (CMS-03C-02) | P | K (B4) | K (B5) | N/A | K (B6 403) | P | P (kept) |
| accept/detach (CMS-03C-15) | P | K (B4) | K (B5) | N/A | K (B6) | K (B7) | P (kept) |
| bulk accept/detach (CMS-03C-15) | P | K (B4) | K (B5) | N/A | K (B6, B8) | K (B7) | P (kept) |

(A1x = defect A1, the missing 403 CapabilityGate; K cells list each failing clause below.)

## Defects (product code outside this lane's claim: NOT fixed; root decides fix or relax the spec cell; probe evidence in recite4/web6-probes/)
Spec words are FE03 1042-1048 ("Slice 12 definition governance states") and AC-271.
- **D1 selector CMS-03C-13 degraded** "Last verified page kept; submit stays disabled": after a failed or rate-limited Load more, "Place pattern" is enabled (CmsPatternInsertForm.tsx submit `disabled` ignores `failed`/`rate_limited`). Probe selector13-degraded.snippet.txt (`expected false to be true`).
- **D2 selector CMS-03C-17 loading** "Skeleton after 250 ms": the connected taxonomy field announces "Loading terms..." at 0 ms (cms-taxonomy-field-connection.ts / CmsTaxonomyFieldConnected.tsx). Probe selector17-loading.probe.tsx.txt (fails at 249 ms).
- **G1 queue degraded** "Last verified queue kept with lastVerifiedAt": not implemented; load-governed-queue-page.ts:56-86 returns a closed notice on any failure, CmsGovernedReviewQueue.tsx has no kept-page/lastVerifiedAt prop. Probe gov-*.
- **G-A1 (ambiguity, not asserted) detail degraded**: spec says "a review detail is re-required"; the island keeps the stale review on screen with lastVerifiedAt and forms off (CmsGovernedReviewDetailIsland.tsx:99-115); a non-429 degrade has no re-read control, only a reload recovers. If "re-required" means "not shown", that is a defect.
- **L1 template degraded**: cms-template-edit-reconcile-state.ts:109 `setLatest(null)` before each read drops the verified "Latest version N" panel after a failed re-read. **L2 template disabled (weak, my wording was borrowed from the pattern designer)**: no sentence says no active content type exists (CmsTemplateEditDesigner.tsx:51).
- **L3 pattern loading**: "Save successor draft" stays enabled while the latest check runs (use-pattern-designer.ts:106-111 `blocked`). **L4 pattern degraded**: use-pattern-conflict.ts:131 replaces `loaded` with `checking`; submit not held off.
- **L5 vocabulary loading**: submit enabled during the versions read (use-taxonomy-designer.ts:102, CmsTaxonomyVersionDesigner.tsx). **L6 vocabulary degraded**: use-taxonomy-conflict.ts:57 same as L4.
- **L7 terms picker loading**: commit controls not disabled while the picker skeleton shows (CmsTaxonomyTermForm.tsx:182, use-term-form.ts:203). **L8 terms list refresh**: no skeleton and nothing disabled after an action while the list refreshes (use-term-list.ts:83).
- **A1 no 403 CapabilityGate** in the six form islands (template, vocabulary designer, locale, related, term, pattern designer): each renders form-local copy (CmsTemplateStatus.tsx:53, CmsTaxonomyStatus.tsx:21, locale-variant-copy.ts:57, related-status-copy.ts:63, term-status-copy.ts:21, CmsPatternStatus.tsx:57); the governed forms do render `[data-cms-editorial-capability-gate]`. **B6** the same for insert/accept/detach/bulk (composition-copy.ts:75; lower confidence, BE03c 403 reasons differ).
- **A2 409 not refetched automatically** in template (both), vocabulary, pattern, related designers (manual "Check latest version"/"Review changes" button; related follows FE03 1224 "never overwrites automatically") and locale FALLBACK_CHAIN_MISMATCH (adopts the 409 body chain). **B8** bulk 409 does not refetch the entry (use-composition-bulk.ts:115-125) and shows copy saying it did.
- **A3 unknown outcome not refetched before retry** in template create (CmsTemplateDesigner.tsx:78-90), locale (use-locale-variant-form.ts ~212) and related; retry reuses the key at once. **B7** accept, detach, new-roots place and bulk show "Result not known" with no pending state and no entry read (use-composition-updates.ts:124,251; use-composition-bulk.ts:115-125).
- **A4 success does not refetch the lists shown**: vocabulary designer (versions table), locale form (source). **B5** insert/accept/detach/bulk merge the answer and refetch nothing (no browser instance-list read route exists: a design question).
- **A5 related-content loading**: CmsRelatedContentForm.tsx:129 `disabled={form.pending}` disables the whole rule fieldset, and `edited()` in use-related-content-form.ts resets `pending` to idle (same defect I fixed in the locale hook). CmsRelatedContentForm.save.test.tsx:162 pins the whole-fieldset lock.
- **A6 422 not at the field**: template create `key_reserved` (cms-template-designer-submit.ts), term form canonical_overlap/canonical_source_unavailable, locale 422 generic. **A7** term form with an empty security token is disabled with no stated reason (use-term-form.ts:203).
- **B1 success does not clear the form**: decision (CmsGovernedDecisionForm.tsx:96), assignment create (CmsGovernedAssignmentCreate.tsx:83), activation (use-governed-activation-form.ts:105,123); visible only before the re-read hides the frame. **B2** the `assign_reviewer` disabled reason (governed-review-labels.ts:58) is never rendered (CmsGovernedReviewDetailIsland.tsx:126-149). **B3** activation pending also disables Continue and Cancel (CmsGovernedActivationFields.tsx:141, CmsGovernedActivationConfirm.tsx:78; code comment cites FE03 1118/1216: possibly deliberate). **B4** composition `busy` (use-composition-page.ts:71) disables every control of the page while any command is pending (pattern select, link mode, slot path, overrides, row buttons, diff answers) instead of only the commit control.
- Related to row 1: the same "only the commit control" rule is therefore still violated in related content (A5), activation (B3) and the composition island (B4). Cancel/Back of the term action and the source-review buttons of the locale form keep their pending lock by my decision (FE03 silent; closing/adopting with a command in flight is new behaviour).

Spec/brief note: the brief and I first mapped CMS-03C-05/-06/-07 wrongly; per FE03 line 869 and the transport the vocabulary designer is CMS-03C-16 and the term action is CMS-03C-03 (tests and comments use the spec's ids).

## Decisions
- Row 1: Cancel, Back and the locale source-review buttons keep their pending lock (see above).
- Row 2: the heading text is the existing result sentence ("Draft created." / "Draft version saved."), the details stay in the status region below it.
- Row 3: a cell is cited only if every clause of it is asserted; otherwise the repo test is "(kept half)" and the failing half is a defect with a probe.

## Test corrections
none (no existing test changed).

## Files (path, lines, SHA-256; paths prefixed W/ are under apps/web/src/components/)
- `apps/web/src/components/cms-composition/cms-template-designer.css` 210 lines, abeed6a2ef5a98d7faee564ed1d22d4af3d7805e280283dee1580837a9549610
- `apps/web/src/components/cms-composition/CmsTemplateDesigner.result-focus.test.tsx` 80 lines, 030a002c7768f7a4ab00014187dc16c6662b39c19a45560b447be24a8b7e6e30
- `apps/web/src/components/cms-composition/CmsTemplateDesigner.states.test.tsx` 328 lines, 9b12eb6c2978677322963d3338523992938af8182558688c4e962b2e0b39740c
- `apps/web/src/components/cms-composition/CmsTemplateDesigner.tsx` 182 lines, f6c86adc03a9778be80028509dfd854c567291b0bb7089f311b4750800663554
- `apps/web/src/components/cms-composition/CmsTemplateEditDesigner.latest-states.test.tsx` 312 lines, c5d82bc7de4c1b4bfa47935f8e4a561d20a0058dd4e92f159536e0fe60e5aa5b
- `apps/web/src/components/cms-composition/cms-template-edit-reconcile-state.ts` 206 lines, 1ae4880db3a9b6d378fff56338b95be50185bf37d27cf543b1b95565cf685413
- `apps/web/src/components/cms-composition/cms-template-result-focus.ts` 10 lines, e2ff643df6f1840e3eee3b1114ca27cb0dd1e281c8765bdf10d854dc3408fea4
- `apps/web/src/components/cms-composition/cms-template-result-heading.test-support.tsx` 115 lines, 6c88293463da57ae0c07f29b0e2e2e846795e60e533eba3145d93621a6d34ef2
- `apps/web/src/components/cms-composition/CmsTemplateStatus.tsx` 109 lines, 0ed900cd7130fe78c18fce1f402c2e11857c9a5af2e90358e54d3a612ff4d324
- `apps/web/src/components/cms-composition-instances/CmsBulkUpdatePanel.states.test.tsx` 283 lines, 4112c6d6e3681377d23489d4e6c3f209ffcaa9d4060151fb26deca9fea692482
- `apps/web/src/components/cms-composition-instances/CmsCompositionPage.diff-privacy.test.tsx` 213 lines, 5a3980a92ba5dae9e7b46de2b537fe17ee217841959a2c105989985a325b2db7
- `apps/web/src/components/cms-composition-instances/CmsCompositionPage.diff-states.test.tsx` 221 lines, 8fabd827fa3724c3611c2fe64fc7540661dd92bb9031a58425a49090d9497b2d
- `apps/web/src/components/cms-composition-instances/CmsCompositionPage.selector-states.test.tsx` 175 lines, 77ed5bfcb52fc1bf3563cb8aa856e0c51838c1c983730f0ddb4e252e05b01e24
- `apps/web/src/components/cms-composition-instances/CmsPatternInsertForm.states.test.tsx` 267 lines, e6bb8908ffa586349f4a8e568cbcc5d7e97e893884562fa50cf0ba753b5aadfe
- `apps/web/src/components/cms-composition-instances/CmsPatternUpdateDiff.states.test.tsx` 378 lines, 4e2ba848baf4ce140129ceb7d48eb162cd880b46dcbc507f96dc9916e175f5cb
- `apps/web/src/components/cms-composition-instances/composition-browser-routes.test.ts` 57 lines, 01097efbfc8c7425da70f45c4de0c77e2c6d4a74b2b3951c60e704585237224d
- `apps/web/src/components/cms-composition-instances/composition-command-states.test-support.tsx` 71 lines, 812b1ac0bc9f9300235c2d7f1234f88ee62ece5ae4fcd830ce52f13b70e8166c
- `apps/web/src/components/cms-composition/README.md` 113 lines, 958de6cba390e9ade54754b15bb7e1d98fda7a1a73bc0a372a75d41a4c57e87a
- `apps/web/src/components/cms-editorial-fields/CmsTaxonomyFieldEditor.connected-states.test.tsx` 177 lines, 110c7e3420eeca18956c1cce56648a981cddc0fef38dbe37d10f2f454ca74ad6
- `apps/web/src/components/cms-governed-review/CmsGovernedActivationForm.states.test.tsx` 325 lines, 2657ef2d6cc5991ca8991d70b6a42136b3c6b7db438319d831d77ccb6dedfb22
- `apps/web/src/components/cms-governed-review/CmsGovernedAssignmentForm.states.test.tsx` 399 lines, e3a927d1d33c017aa06837467ab57ca764bec46de912f8abb08f039c77b106fb
- `apps/web/src/components/cms-governed-review/CmsGovernedDecisionForm.states.test.tsx` 323 lines, e43d83bddef6f5a78dfc1e34bf024cbc3f0b6f4d5e56088efa6b74e12fe6409d
- `apps/web/src/components/cms-governed-review/CmsGovernedReviewDetailIsland.states.failure.test.tsx` 226 lines, e2293b53cb173b3f6e2c214e60ef070125c93a09ec1d4780f5fe176cb9e65807
- `apps/web/src/components/cms-governed-review/CmsGovernedReviewDetailIsland.states.test-support.tsx` 106 lines, ad91ab297474ff3c9ab3f895d7b09e1e0c969a1ea0952a1981143f2a3656d49b
- `apps/web/src/components/cms-governed-review/CmsGovernedReviewDetailIsland.states.test.tsx` 216 lines, 073d1134c972a404770e1049a63d0051cc93f9e98dbb2d9697741e2c68164800
- `apps/web/src/components/cms-governed-review/CmsGovernedReviewQueue.states.test.tsx` 355 lines, 9b745f35497921a640d5ffc8dd79d129eb888efb8592c8857d3ef8ee28a042e2
- `apps/web/src/components/cms-governed-review/CmsGovernedSubmitForm.states.test.tsx` 253 lines, e986ce39f533d4dfc1f0584e27d7231c2d70a1580cd14e0690d7ae5ef2b5f148
- `apps/web/src/components/cms-governed-review/governed-command-states.test-support.tsx` 125 lines, 8c4bfd513ba88e9741887fb96e224ac9712771f716e879b9f7903759c1ee1bbb
- `apps/web/src/components/cms-locale/CmsLocaleVariantForm.pending.test.tsx` 72 lines, d5974423609618ba0ff2ced24e19495b4da38e96cdcff8ddf45cd5808b48436b
- `apps/web/src/components/cms-locale/CmsLocaleVariantForm.states.test.tsx` 236 lines, ba26662d25cefc6ea2bb8a1a283874c20052ea1fdc26e184a37bf7032c009456
- `apps/web/src/components/cms-locale/CmsLocaleVariantForm.tsx` 177 lines, 51f7e821276766a792a54ce51a9870431e3d4050bcddcef6faf9cf437926d563
- `apps/web/src/components/cms-locale/README.md` 87 lines, 31b77417bb7e16b5f5c33723ec8d8710f5894108730b97e36a8765df802042ef
- `apps/web/src/components/cms-locale/use-locale-variant-form.ts` 290 lines, 0d9c72b16118cd3ef8761da16c872dcbcb9428d7e43c3c04616905a07b545678
- `apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.latest-states.test.tsx` 269 lines, a388c4282d7ee7d98015b1de0ae659e80ef092a14139a59fd3ceb84ed7c1bdd5
- `apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.states.test.tsx` 330 lines, e1e9964f1f6af620a0bf6548bb1700c3919997502f1d8f166bae513d2b6cda7b
- `apps/web/src/components/cms-related-content/CmsRelatedContentForm.states.test.tsx` 281 lines, c269c69d0d6e887fa83bf72e7e1668056f6f1ca3e6ea1b6175279bf0dfaf7b9e
- `apps/web/src/components/cms-taxonomy-designer/CmsTaxonomyVersionDesigner.latest-states.test.tsx` 256 lines, 37710f5dc59eaf5ffb400065e42cd5f867ce8afb894009f6d3d1cbbc13c4db60
- `apps/web/src/components/cms-taxonomy-designer/CmsTaxonomyVersionDesigner.pending.test.tsx` 75 lines, 8b3b547857625b9e61d1b83f72780d21f569946da0fb559a01a667d718b5af93
- `apps/web/src/components/cms-taxonomy-designer/CmsTaxonomyVersionDesigner.states.test.tsx` 251 lines, 2c409c9f2841af8a8cbd4e2c6ae209c75185d4765b55ec010409e1d1088ab9b7
- `apps/web/src/components/cms-taxonomy-designer/CmsTaxonomyVersionDesigner.tsx` 163 lines, 8ea1ab0d80cd0b5d40dcfec37b7cec2d299743f5559cd45437b3d38202e4b813
- `apps/web/src/components/cms-taxonomy-designer/README.md` 65 lines, 85f452505bf255b078beb6224d8660f2143153fd045aaaa5dad7d3c7c8928c13
- `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermAction.tsx` 209 lines, 213e9e28b8f3667a7ca650ab6ebc1725086c1653ace8ebffc36953382b6a71d3
- `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.latest-states.test.tsx` 306 lines, 2ed8cd59140428d62a04927bff532fa88b3ff79a034168690917e3a8c43a517c
- `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.pending.test.tsx` 105 lines, f03a1137f1ef23ef54edc023fbf1b22fa90433788ba32541ec71dfd83f91aedc
- `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.states.test.tsx` 255 lines, 820a26ab848fbd62c06fef208fd5be973a8da7238288e3e4b990cb0b489b2c0f
- `apps/web/src/components/cms-taxonomy-terms/README.md` 80 lines, 3041aa09702094486d2b2dc61dd9212fd355ddbac3fa9a06cdf4033dd7957345
- `apps/worker/src/cms-composition/template-accessibility-member.test.ts` 154 lines, f6a944345cfbb43f4befaf47e0fe583967f0e772abca00272f9df06d50886f8e
- `docs/handoffs/2026-10-22-claude-s12/recite4/web6-proposals.json` 3058 lines, 1d81eee151c221e9d76dd5049eab47452ad7d9bb16b4f3af0524b6383b17a4cf
- `packages/contracts/src/cms-composition/template-accessibility-contract.test.ts` 173 lines, 302e718f62d67d1f11490d12f0d5a258d6b7fb507cb4bcee7372b4c4a6111941

## Runs
- Lane files: `vitest run` on the 31 new test files: 31 passed, 300 tests passed.
- Regression: `vitest run apps/web/src/components apps/worker/src/cms-composition packages/contracts/src/cms-composition`: 827 files, 10,764 tests passed (01:22-01:29).
- `prettier --check` clean on every lane file and the CSS; `eslint --max-warnings=0` clean; `tsc --noEmit` clean in apps/web (the only errors are in `src/pages/app/cms-content-modeling/no-store-redirects.test.ts`, another lane's untracked file, Node typings), apps/worker and packages/contracts.
- No Playwright, db, supabase, docker, race or git-writing command was run.
- Coverage: every new product branch is exercised (`edited()` pending branch, `focusCmsTemplateResult` heading and summary paths, the unchanged fieldset/commit lines). I did not run the repo-wide coverage gate.

## Bundle-relevant files changed (root: `pnpm build && pnpm bundle:check`)
CmsTaxonomyVersionDesigner.tsx, CmsTaxonomyTermAction.tsx, CmsLocaleVariantForm.tsx, use-locale-variant-form.ts, CmsTemplateStatus.tsx, CmsTemplateDesigner.tsx, cms-template-edit-reconcile-state.ts, cms-template-result-focus.ts (new), cms-template-designer.css. About a hundred bytes each; the heading adds a few lines of markup.

## Spec citations
FE03 1048 (commandState loading), 1042-1048 (state table), 1110 (CMS-11 row, "named result heading"), 895/1845/2713 (diff privacy and re-required diff), 869 (operation map); IA03 AC-CMS-10 (block accessibility contract registered with the signed block version); BE03c 191 (CMS-03C-18..21 internal only).

## Open items / BOUNDARY
- All defects above. Each fix touches product files outside this claim; none is a missing-spec BOUNDARY except: G-A1 ("re-required" wording), B3 (possibly deliberate per code comment), B5 (needs an instance-list browser read that has no spec), A2 related (FE03 1224 says never overwrites automatically) and L2 (my wording).
- AC-272: the Realtime emitter does not exist (unit5); not applicable. AC-001: the DB function was not run.
- Proposals: recite4/web6-proposals.json (AC-042 clause 1 closed-clause pending the pw5 assertion change; AC-001 clause 3 closed-clause; AC-272 closed-clause; AC-271 partial with the limitation text).

## Requests to root
1. Run `pnpm build && pnpm bundle:check`.
2. Update the pw5 AC-042 focus assertion (above) before running that spec.
3. Decide per defect group whether to fix (a second wave, test files already carry the passing halves; the failing assertions are in recite4/web6-probes/) or relax the spec cell; AC-271 cannot close until then.
4. Cite from recite4/web6-proposals.json after the refutation pass.
