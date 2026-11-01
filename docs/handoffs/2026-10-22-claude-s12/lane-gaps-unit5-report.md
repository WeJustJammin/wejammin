# Lane claude_s12_gaps_unit5 report

## Status
PARTIAL (2026-10-29). Closed with tests: AC-039, AC-095, AC-126, AC-128 (both), AC-134 (both), AC-042 "scoped draft before commit" (RED, product fix, green), AC-164 "neither extend the general auth-session resource nor". BOUNDARY: AC-169 server retry. Partial: AC-271 (commandState loading proved for CMS-03C-01 only, with a product fix; the seven-state enumeration per island is not written), AC-272 (Worker sweep plus governed detail island sweep; the pattern-diff browser surface is not swept).

## Product fixes (named first)
1. AC-042 "scoped draft before commit": FE03 927 "Unsaved changes: retain scoped draft, show inline leave confirmation, use beforeunload only while dirty, clear only after success or explicit discard" and the CMS-11 row (FE03 1109, "Retain unsent values") bound both template designers; neither had a leave guard (the term form AC-048 and the composition page do). RED: `CmsTemplateDesigner.unsaved.test.tsx` failed 9 of 11 (`expected false to be true`). Fix: new `CmsTemplateLeaveGuard.tsx` (root section around the shared `useCmsEditorialLeaveGuard`), `CmsTemplateLeaveConfirm.tsx`, `cms-template-draft-dirty.ts`, `use-cms-template-draft-fields.ts` (create-designer field state extracted to keep the component under 200 lines); `CmsTemplateDesigner.tsx` and `CmsTemplateEditDesigner.tsx` render inside the guard and take an optional `navigate` prop; README updated.
2. AC-271 `commandState` loading, FE03 1048 "Stable pending label; only the commit control disabled": RED `CmsTemplateDesigner.pending.test.tsx` (create designer: key, locale, audience, extra regions, Add slot, Add binding and the commit control were all disabled while pending, and the commit control stayed enabled by itself otherwise). Fix in `CmsTemplateDesigner.tsx`: `<fieldset disabled={status.kind === 'created'}>` and `disabled={cannotSubmit || status.kind === 'pending'}` on the submit button. The successor designer already satisfied the clause (its test passes unchanged).

## Rows
| criterion | clause | outcome | identity |
|---|---|---|---|
| AC-039 | Idempotency-Key 8-128 printable ASCII | green | idempotency-key-boundary.test.ts (CMS-03C-08 and -16: missing, 7, 129, control, DEL, non-ASCII = 400 INVALID_REQUEST before capability, quota and port; 8 and 128 accepted) and idempotency-key-boundary-governed.test.ts (CMS-03C-06, -07, -09, -12: 129 characters and a control character; 128 accepted on -07). CMS-03C-01 to -05 and -15 already carry the four malformed values in write-header-order*.test.ts and pattern-update-order.test.ts (not re-cited here) |
| AC-095 | a body and any mutation header | green | governed-review-queue-no-body.test.ts (415 allowedMediaTypes [], 400 for content-length, transfer-encoding, Idempotency-Key, If-Match; none charges quota) |
| AC-126 | is 404 | green | taxonomy-definition-real-tokens.test.ts (P0001 NOT_FOUND, SQL 20261014030200_cms_create_taxonomy_version.sql:81,180) |
| AC-128 | hidden scope 404; stale/idempotency 409 | green | same file: NOT_FOUND 404; CONFLICT (SQL :177,:181,:184,:203, public wrapper :25) and IDEMPOTENCY_MISMATCH (cms_reserve 20260930150000:67 -> identity_idempotency_reserve 20260901030000_party_identity_aliases.sql:377, reached :98) 409 TAXONOMY_VERSION_CONFLICT |
| AC-134 | read limit 429; 502/503/504 | green | taxonomy-selector-faults.test.ts (user 300 and party 600 buckets, Retry-After, RATE_LIMITED; production port 503 and 504 at 8,000 ms, not before). 502 for the selector already exists (cms-composition-production-taxonomy-reads.test.ts "answers %s as a retryable 502") |
| AC-169 | server/queue/job retry 3x 15/60/300 s jitter | BOUNDARY, no test | below |
| AC-042 | scoped draft before commit | RED -> fix -> green | CmsTemplateDesigner.unsaved.test.tsx (12), cms-template-draft-dirty.test.ts (15) |
| AC-164 | neither extend the general auth-session resource nor | green | tests/contracts/phase-02-slice-12-template-context-session-isolation.test.ts (14: SessionResource is exactly six auth members, strict, in the generated OpenAPI; TemplateDesignerContext exactly two members, strict; no shared member; only the context route carries cms.template_designer), apps/worker/src/cms-composition/template-context-session-isolation.test.ts (2: the real GET /api/v1/auth/session answers six members for a designer-capable caller and never serves a widened reader). The other AC-164 clauses (pages, playwright) belong to pw5/others |
| AC-271 | seven governance states | PARTIAL | CmsTemplateDesigner.pending.test.tsx (2) proves CMS-03C-01 `commandState` loading/success only; see Open items |
| AC-272 | governed surface privacy | PARTIAL | apps/worker/src/cms-composition/governed-surface-privacy.test.ts (7), apps/web/src/components/cms-governed-review/governed-privacy.test.tsx (1) |

## BOUNDARY: AC-169 server retry (DEC-211)
- No queue or job caller of `cmsTemplateLatestRead` exists in apps/worker.
- The only server caller is the Astro SSR page `apps/web/src/pages/app/cms-content-modeling/templates/[templateKey].astro:40` -> `readCmsTemplateDetail` (apps/web/src/server/cms-composition-platform-detail.ts:20-65), one pass-through fetch that forwards the refusal; a 15/60/300 s retry inside a page render would exceed the 8,000 ms read ceiling (BE03c 1419).
- No shared retry-policy constant exists for CMS-03C reads; the only 15/60/300 s jitter implementation is apps/worker/src/cms-composition/linked-scan/retry.ts (queue consumers, BE00 550).
- Missing spec: a line naming the server/queue/job caller of cmsTemplateLatestRead and the retry-versus-request-deadline rule (BE03c changelog line 1898 only splits the matrix cells).

## Files (new unless marked; SHA-256, lines)
Tests:
- 0a01d4022607b0bad321be0941db065885da8b5d89666b1cf47729a8c7c473e0 127 apps/worker/src/cms-composition/idempotency-key-boundary.test.ts
- 089ccf459afa55e3957d4444e6d79d8735f9788a010e8d783300e66ea514a886 115 apps/worker/src/cms-composition/idempotency-key-boundary-governed.test.ts
- 8bc13a2786db67fcf0d2d8386375078a8b376325d4fb697aa7cbecec7418f87c 62 apps/worker/src/cms-composition/governed-review-queue-no-body.test.ts
- 1c309fe38b37b33d9612efc874ce8ea4be93b6773caa383160620cb69bbf5b2d 95 apps/worker/src/cms-composition/taxonomy-definition-real-tokens.test.ts
- ac7c2c425f2bf71a31377d6aa0465d394705efadf99ac32ac17f8bfc2feb0f9c 96 apps/worker/src/cms-composition/taxonomy-selector-faults.test.ts
- fa1c8086b3d3ee0737f36c32a17e10895480900e8c68f51ffeffc0ef0ce3ba10 63 apps/worker/src/cms-composition/template-context-session-isolation.test.ts
- b42d56de1c5b7cea8bea120a47bac3efd304c8905c577e37369db6e05bf5c25e 224 apps/worker/src/cms-composition/governed-surface-privacy.test.ts
- 3829b461f8f4455855dfd250aa15ec6acf888a1a1c98393aefdb3655ba904e87 373 apps/web/src/components/cms-composition/CmsTemplateDesigner.unsaved.test.tsx
- 81ba3d22e3d2cecfa87885cec0c0085103f315109760d26f1b17a02327546e1b 188 apps/web/src/components/cms-composition/CmsTemplateDesigner.pending.test.tsx
- 6df1e16e6e9c820110610e42f27541f509ba84ea099f10e38647f81ae188c4ef 66 apps/web/src/components/cms-composition/cms-template-draft-dirty.test.ts
- 7dc02580de48d9fe3e146a26a28d51ca6654725fd4ded7b95fd5b6e980a3bfd5 177 apps/web/src/components/cms-governed-review/governed-privacy.test.tsx
- e65b9078e2ed9b117cc4a702f1485e976c9bf71cac5378ded14f6eaee2625968 151 tests/contracts/phase-02-slice-12-template-context-session-isolation.test.ts
Product (new):
- be49cc4359992624d0859de1999c4140d104c088beeb89e29b06ea48e2984bdc 56 apps/web/src/components/cms-composition/CmsTemplateLeaveGuard.tsx
- 788a1865ff554daa573f1e3c2416f26eb3fc2699e97b4f3de37406c6840ae676 31 apps/web/src/components/cms-composition/CmsTemplateLeaveConfirm.tsx
- 6c2f7f6ca66715a891229c7144f0de1c756caafe23585d5d15d41e42748bc9c3 32 apps/web/src/components/cms-composition/cms-template-draft-dirty.ts
- 1091d206cd061e6e2633c8923b19238a68eea0c6b0328b7343f9e897a29f7408 61 apps/web/src/components/cms-composition/use-cms-template-draft-fields.ts
Product (edited): CmsTemplateDesigner.tsx b25dd57792e801262a00c8fac8a3a73b4c8589e4481e4fc5cd61bbf52b3f4c8b (181), CmsTemplateEditDesigner.tsx 39789974cca7eff5ba38951dcdbf56c49bdb185684f6acfb3157fb50dc674276 (172), README.md d7b8d599de87a75525f3f928d1f05eb8130c2c1c814b0d33fe8f193b48cf536b (113), all under apps/web/src/components/cms-composition/.
Proposals: b99cb31efde3ab6ce1e294eecb2f6d8874e991f81b67b80684d08590857d153d docs/handoffs/2026-10-22-claude-s12/recite4/unit5-proposals.json.

## Runs
- New tests: 96 tests in 12 files, all green; no duplicate titles.
- Regression: `vitest run apps/worker/src/cms-composition apps/web/src/components/cms-composition apps/web/src/components/cms-governed-review apps/web/src/pages` plus the contract file: 314 files, 5,150 tests green.
- `eslint --max-warnings=0` on apps/web cms-composition, apps/worker cms-composition and the new files: clean. `tsc --noEmit` in apps/worker and apps/web: clean. Prettier applied.
- tests/contracts/phase-02-slice-12-evidence-guard.test.ts fails today on other lanes' uncited-receipt entries; none names a unit5 file.
- Coverage of the new product files from the cms-composition run: LeaveGuard, LeaveConfirm, draft-dirty, draft-fields at 100%; the two uncovered lines of the edited designers (77-78, 127) are existing lines covered by other suites.

## Test corrections
Every existing test file changed in the fix rounds (each is an inversion forced by DEC-239 / BE03c row 176, none weakens an assertion; V16 reviewed them). Exact diffs:
- `apps/worker/src/cms-composition/governed-review-assignment.test.ts` (round 1): title "answers 201 with Location and the assignment version ETag for a create" -> "answers 201 with the assignment version ETag and no Location for a create"; `expect(response.headers.get('location')).toBe(\`/api/v1/cms/governed-reviews/${REVIEW_ID}/assignments/${ASSIGNMENT_ID}\`)` -> `.toBeNull()`.
- `tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts` (round 1), AC-076 case: title "... answers 201 with a Location for a created assignment and 200 for a revoked one" -> "... answers 201 with an ETag and no Location for a created assignment and 200 for a revoked one (DEC-239)"; `toEqual(expect.arrayContaining(['ETag','Location']))` on the 201 headers -> `toContain('ETag')` plus `expect(201 headers).not.toHaveProperty('Location')`.
- `apps/web/src/components/cms-governed-review/governed-review-command-transport.test.ts` (round 1): the "assignment create" success fixture and the "assignment of another review" fixture lose `location: .../assignments/${ASSIGNMENT_ID}`; the unknown-outcome case "a create without its Location" (response without Location) became "a create that still names the assignment in a Location (DEC-239: none is defined)" (response now carries the Location).
- `apps/web/src/components/cms-governed-review/CmsGovernedAssignmentForm.test.tsx` (round 1): `created()` fixture loses `location`.
- `apps/web/src/components/cms-governed-review/CmsGovernedAssignmentForm.states.test.tsx` (round 1; web6's new file): `created()` loses `location`; unused imports `ASSIGNMENT_ID`, `REVIEW_ID` removed. Its SHA-256 `a7bf5ba6...` (394 lines) at that time is the one to cite for web6's rows; re-hash before citing.
- `apps/web/src/server/cms-governed-review-platform-command.test-support.ts` (round 1): the CMS-03C-08 create case `location: \`/api/v1/...assignments/${ASSIGNMENT_ID}\`` -> `location: null`.
- `apps/web/src/server/cms-governed-review-platform-command.test.ts` (round 1): imports `ASSIGNMENT_ID`, `REVIEW_ID` added; one extra upstream variant for CMS-03C-08 (a response that still carries the old Location) in the list that must answer 502 unverified.
- `apps/web/src/pages/api/v1/cms/governed-reviews/governed-reviews-routes.test.ts` (round 2, V16-01), "CMS-03C-08 binds the review id from the route": the mocked upstream `jsonResponse(201, governedAssignmentFixture(), { etag: '"1"', location: .../assignments/${ASSIGNMENT_ID} })` -> `jsonResponse(201, governedAssignmentFixture(), { etag: '"1"' })`; unused import `ASSIGNMENT_ID` removed.
Also rewritten, though lane-owned (not an existing oracle): `apps/worker/src/cms-composition/template-context-session-isolation.test.ts` (round 1) and `CmsTemplateDesigner.unsaved.test.tsx` (round 2: fixtures and helpers moved to `cms-template-designer.test-support.tsx`; test titles unchanged).

## Open items / BOUNDARY
- AC-169: BOUNDARY above.
- AC-271 (PARTIAL): no test enumerates idle/loading/success/empty/error/degraded/disabled for governed queue/detail, selectors, latest reads, diff and every command form. Existing: 250 ms skeleton tests (CmsLoadingRegion, CmsLatestReadLoading, CmsGovernedReviewDetailIsland.loading, CmsGovernedReviewPanel.loading, CmsTaxonomyTermChoice.loading, CmsTaxonomyConflictPanel.loading, CmsCompositionPage.loading) whose titles carry no AC tag. Same pending deviation (whole fieldset disabled while pending, FE03 1048 says only the commit control) is still present in CmsTaxonomyVersionDesigner.tsx:108, CmsTaxonomyTermAction.tsx:121, CmsLocaleVariantForm.tsx:128: no RED test or fix written here.
- AC-272 (PARTIAL): pattern-diff values are swept at the Worker (CMS-03C-14) only; the browser diff surface (CmsDiffPath) is not swept; no Realtime emitter exists (the web test asserts no WebSocket/EventSource is created). The Worker `Location` header of CMS-03C-08 carries the assignment id (an API response header, not the page URL); the spec's "URL" is read as the browser URL.
- Bundle: the guard adds a few hundred bytes to the template routes (about 11 KB headroom before this lane).

## Requests to root
- `pnpm build && pnpm bundle:check` after the AC-042 and AC-271 product edits.
- Cite from `recite4/unit5-proposals.json` after the refutation pass; AC-169 and AC-271 stay open as written.
- Decide whether the FE03 1048 "only the commit control disabled" deviation in the three other command forms is to be fixed (a second wave) or the spec cell relaxed.

## Fix round (refutation 4, 2026-10-29)
Status: GREEN for both items. (The report above stands; AC-169 BOUNDARY, AC-271 and AC-272 residuals are unchanged and owned by root/web6.)

### 1. AC-164 blind Worker test
`template-context-session-isolation.test.ts` first test was blind: `GET /api/v1/auth/session` builds its body from `readSession(resolvedSession)` and the harness mock returned a constant. It now uses the real production reader (`createProductionAuthenticationDependencies(...).readSession`, the pure mapper in `production-session.ts:244`) wrapped in a spy, with the capability-carrying session on `resolveSession`. It asserts the spy was called with that session (`capabilities: ['cms.template_designer']`) and that the body equals exactly the six authentication members derived from it (a mapper that spread the session would fail the strict `SessionResourceSchema.parse`). New title: "[P2-S12-AC-164] renders a designer-capable session through the production session reader as exactly the six authentication members and no capability". In `unit5-proposals.json` the six "picker context refuses an authority or session member %s" rows moved from c4 to c5 ("grant designer authority in the browser"); c4 now holds 10 rows, c5 holds 6.

### 2. DEC-239: CMS-03C-08 answers 201 without Location
RED first: `governed-review-assignment-no-location.test.ts` (create: `Location` was `/api/v1/cms/governed-reviews/{reviewId}/assignments/{assignmentId}`; revoke already none). Fix:
- `apps/worker/src/cms-composition/governed-review-command-routes.ts`: the `location` member of the CMS-03C-08 `accept` result is gone (the shared `governedSuccess` `location` option stays; CMS-03C-09 still uses it).
- The OpenAPI also declared a Location on the 201 (`infra/openapi-definitions-cms-composition.mjs`, CMS-03C-08 201 headers `mutation` -> `entity`); `docs/openapi/openapi.json` regenerated with `node infra/generate-openapi.mjs` (diff: only that header block); `--check` exits 0.
- The web proxy and the browser transport both required the Location to equal the assignment URL, so every real create would have become an "unknown outcome": `apps/web/src/server/cms-governed-review-platform-command-specs.ts` and `apps/web/src/components/cms-governed-review/governed-review-command-specs.ts` now declare `location: () => null` for CMS-03C-08. A stale upstream still sending a Location is rejected as unverified (new cases in the proxy and transport tests). These two files are in `cms-governed-review`, not web6's directories.
- Existing tests updated in the same change: `governed-review-assignment.test.ts:31-38` (title and expectation), `tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts` AC-076 case, web `cms-governed-review-platform-command.test.ts` / `.test-support.ts`, `governed-review-command-transport.test.ts` ("a create without its Location" became "a create that still names the assignment in a Location"), `CmsGovernedAssignmentForm.test.tsx`, `CmsGovernedAssignmentForm.states.test.tsx` (also dropped two now-unused imports).

### Renamed identities root must re-point in the ledger (old -> new, also in `unit5-proposals.json` `staleExisting`)
- AC-076 and AC-079: `governed-review-assignment.test.ts` "CMS-03C-08 contract (BE03c row 170, field matrix 391) answers 201 with Location and the assignment version ETag for a create" -> "... answers 201 with the assignment version ETag and no Location for a create".
- AC-076: `phase-02-slice-12-governed-review-openapi.test.ts` "... [P2-S12-AC-076] answers 201 with a Location for a created assignment and 200 for a revoked one" -> "... [P2-S12-AC-076] answers 201 with an ETag and no Location for a created assignment and 200 for a revoked one (DEC-239)".
- New AC-272 rows (`splitParts: [2]`): the two `governed-review-assignment-no-location.test.ts` tests.

### Runs
- RED: no-Location create failed (`expected '/api/v1/cms/governed-reviews/...' to be null`); the OpenAPI case failed (`to not have property "Location"`); 7 web tests failed after their fixtures dropped the Location.
- GREEN: `vitest run apps/worker/src/cms-composition apps/web/src/server apps/web/src/components/cms-governed-review` plus the governed-review OpenAPI, openapi-reference-integrity, slice-03-openapi and session-isolation contract files: 338 files, 6,467 tests passed.
- Coverage of the touched modules (`governed-review-command-routes.ts`, `cms-governed-review-platform-command-specs.ts`): 100%; `governed-review-command-specs.ts` 100% statements/lines, with two branch lines (191, 234) in `asAssignment`/`bound` that this subset run does not reach and the edit did not touch.
- eslint `--max-warnings=0` (worker cms-composition, web server, cms-governed-review, infra definition, contract test) clean; prettier clean (the generated `docs/openapi/openapi.json` is outside the repo's prettier set); `tsc --noEmit` clean in apps/worker and apps/web; `generate-openapi.mjs --check` exit 0.

### Changed files (SHA-256)
- 307f0478d60fcee7a12a74a58baf9720a0bcfe3e641330e35ea5796fd35817bc apps/worker/src/cms-composition/template-context-session-isolation.test.ts
- cf3a8c1f66185032f72f3cf51479f152d33cea4d0a98d2fa6b00797109d04c45 apps/worker/src/cms-composition/governed-review-assignment-no-location.test.ts
- f7e98ddbf0f52343ddfdb6423d6e6c114ac947d65f747abc29f3aa14e94dacd2 apps/worker/src/cms-composition/governed-review-assignment.test.ts
- c98c239608a55d775dfe64fbdc8d19c787aabedbacd70e995cecb5604afbe257 apps/worker/src/cms-composition/governed-review-command-routes.ts
- 993f01a2043eb3b870d6c0e8c4d101055411fb222beb00b085e62980df582f4d apps/web/src/server/cms-governed-review-platform-command-specs.ts
- bca26d92090f651a34c4efce158dc78927143835ec0a68935f769ab170a38789 apps/web/src/components/cms-governed-review/governed-review-command-specs.ts
- b9f6d31525960b7ec1b24b7c70372ab9944e75b3d89d8d4243686db04de66024 apps/web/src/server/cms-governed-review-platform-command.test.ts
- 07cb9cfa0ae24c1156f9aebb730b9f300b9aca90277f32c862849f567ba165c3 apps/web/src/server/cms-governed-review-platform-command.test-support.ts
- afd53c0ae256227982c3867956b8f63a1e977da7d8c2a65a163a18a0c1d8b4e0 apps/web/src/components/cms-governed-review/governed-review-command-transport.test.ts
- 7267a1d99333de3a219a6d036502c18a21461d173cba50a184172ec415b34785 apps/web/src/components/cms-governed-review/CmsGovernedAssignmentForm.test.tsx
- a7bf5ba6dd9dc0bfc3aaf2052c3bc7424ca076a0715977b1590501b6f65b6332 apps/web/src/components/cms-governed-review/CmsGovernedAssignmentForm.states.test.tsx
- d521e0fb8a0e740f2ae24b9fad5da7de9bd0c023d78ae3ef3152651f1182cca1 infra/openapi-definitions-cms-composition.mjs
- 184c099f9cb3dd3f87e797687fba52c095a24dd23f911a8f09357f86e05f91ee docs/openapi/openapi.json
- 4f9673d569c91d19290f7872333fd16260efde38fe2239319652151291d2d82c tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts
- fbf79c3e4c46463240466e59f91ca934203b8b68d3c7681d6260cf26265be572 docs/handoffs/2026-10-22-claude-s12/recite4/unit5-proposals.json

## Fix round 2 (review V16, 2026-10-29)
Status: GREEN for V16-01, -02, -03, -06, -07. Claim widened for V16-03 only: `use-taxonomy-designer.ts`, `CmsTaxonomyVersionDesigner.tsx`, `use-locale-variant-form.ts`, `CmsLocaleVariantForm.tsx` (web6's finished files); the redirect helper and no-store guard (pwfix6) are untouched.

- **V16-01 (BLOCKER)**: `governed-reviews-routes.test.ts` mock lost the old Location (listed under Test corrections). Re-ran everything: `vitest run apps/web apps/worker tests/e2e/support` plus the governed-review OpenAPI and session-isolation contract files: 1,525 files, 22,093 tests, all passed (this includes `apps/web/src/pages`).
- **V16-02 (MAJOR)**: RED `CmsTemplateDesigner.unsaved-guard.test.tsx` "a dirty form opens the inline confirmation for a page link outside the island" (both designers; failed `expected false to be true`). Fix: `CmsTemplateLeaveGuard.tsx` registers the capture on the document (a `capture` ref refreshed in an effect plus a `click` listener with `capture=true`, as `use-composition-page.ts:60-67`; the ref is written in an effect because the React ref lint rule forbids render-time writes). The confirmation still renders in the section. README updated (no longer "in-island link"). A clean form still lets the outside link navigate (test).
- **V16-03 (MINOR)**: a value typed while the save is pending was neither sent nor kept honest. RED in all four forms (`unsaved-guard` late-edit tests for both template designers, `CmsTaxonomyVersionDesigner.late-edit.test.tsx`, `CmsLocaleVariantForm.late-edit.test.tsx`). Fix: the snapshot of what a submit sent is remembered (`use-cms-template-sent-fields.ts` for the template designers; a `sentRef` in `use-taxonomy-designer.ts`; `sentValuesRef` in `use-locale-variant-form.ts`); after the verified success the form is unsent exactly when it differs from that snapshot. Template designers: the guard stays armed (`beforeunload`, confirmation), the late value stays in the field. All four show the new `CmsTemplateLateEditNotice` ("You changed this form while this was saving ... not part of the saved draft"); the locale form also drops the "Saved in this draft." mark from a field changed after the send. A form with no late edit shows no notice and disarms as before. Note: the vocabulary designer and the locale form have no leave guard at all (the term form and composition page do); the guard half of V16-03 therefore does not apply to them, and adding one is a separate gap (FE03 927) not covered by any criterion I own.
- **V16-07 (MINOR)**: three mutants now killed, each verified by applying the mutation and watching the new assertion fail, then restoring the file: (a) origin union: new `tests/e2e/support/s12-real-template-locale.origins.test.ts` (fixture origin `http://127.0.0.1:4324` vs production origin `https://platform-api.internal`; dropping the production side fails both tests); (b) "Keep editing" auto-focus: `unsaved-guard` asserts `document.activeElement` is the button as the confirmation opens (removing the focus effect fails both designers); (c) rebased-parent baseline: `unsaved-guard` rebases to version 3 and asserts a form equal to the new parent is clean, one that differs (including the first parent's value) is dirty (measuring against the first `detail` fails). The meaning pinned is the README's: the successor is measured against the parent it was rebased onto.
- **V16-06**: "## Test corrections" above now lists every changed existing test with its diff; the cross-lane edit to web6's `CmsGovernedAssignmentForm.states.test.tsx` is recorded there.
- Not done: nits V16-08 to V16-13 (V16-08 `CMS_TEMPLATE_NO_AUTOSAVE` export kept; V16-12 stale comment in `packages/contracts/src/cms-composition/governed-assignment.ts:49` is outside my claim).

### Runs
- RED before each fix: outside-link (2 failed), late-edit template (2), vocabulary (1), locale (1); the rebase/focus mutants failed their assertions as described.
- Full run: `vitest run apps/web apps/worker tests/e2e/support tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts tests/contracts/phase-02-slice-12-template-context-session-isolation.test.ts`: 1,525 files, 22,093 tests passed.
- Worker coverage (`apps/worker`, include `apps/worker/src/cms-composition/**`): 13,222 tests passed; statements, functions and lines 100%, branches 99.92%: the two uncovered branches are `composition-instances-routes.ts:38` and `pattern-update-diff-routes.ts:33`, files this lane has not touched (my touched Worker module `governed-review-command-routes.ts` is 100%). `apps/web` is outside the repo coverage `include`.
- eslint `--max-warnings=0` on `apps/web`, `apps/worker` and the new e2e support test: clean. prettier `--check` on `apps/web/src`, `apps/worker/src`: clean. `tsc --noEmit` in `apps/worker` and `apps/web`: clean.

### Changed files (SHA-256)
- 00410198c58b2a86a39f5f0abfcb7c81d78ab0bfad0011de2642fc30d3280089 apps/web/src/pages/api/v1/cms/governed-reviews/governed-reviews-routes.test.ts
- 280a2f2cdee0aaf69c1f301c5c55138267c1036bbbdc9993a32b2082cf84625f apps/web/src/components/cms-composition/CmsTemplateLeaveGuard.tsx
- 67626d3f0b61d3b40032bbc78e735e911808d4010be2daad36a77430e02e55d2 apps/web/src/components/cms-composition/CmsTemplateLateEditNotice.tsx
- 2e7e271afa2724505e572ebd1cb9a03f1e1aed940a5714ed022cebe49c0af80b apps/web/src/components/cms-composition/use-cms-template-sent-fields.ts
- a3b5f146c26b999e8081184548cae10d2a5faff6556ba65120cfc57240b371a8 apps/web/src/components/cms-composition/CmsTemplateDesigner.tsx
- f514e4e9a490b9ca10d19f5f67eb7348e924c4c56b2695bbe2c08184cf776291 apps/web/src/components/cms-composition/CmsTemplateEditDesigner.tsx
- 5406c0fa6eeeca6dd3b70573c63f4b398ad9ff06fde064dd5edbde2ecbd41d2d apps/web/src/components/cms-composition/README.md
- 2e40db2fdc2dec179f153fa85f6a5dbfdc1f0137c909f343e7ce990fde64290f apps/web/src/components/cms-composition/cms-template-designer.test-support.tsx
- 256a5713e197829fad10fd19e965e45f5c2c34b411dab350e8375b21e3197710 apps/web/src/components/cms-composition/CmsTemplateDesigner.unsaved.test.tsx
- 950aa5efefb761859d2cbaa7cae66a8769f35d768476e022580928fbee48a51b apps/web/src/components/cms-composition/CmsTemplateDesigner.unsaved-guard.test.tsx
- 2c4fbd78f3a319f6cce8794c20a5732367f9298a6bb4d7b56fed122f44aff0f8 apps/web/src/components/cms-taxonomy-designer/use-taxonomy-designer.ts
- fb2f92210635fc62a2fed43fcffdc783228b2598412ff0a7025e7326d717ca3f apps/web/src/components/cms-taxonomy-designer/CmsTaxonomyVersionDesigner.tsx
- 1fe00f5c85694a03bc38e15df9dbfca667dc9ccfd95520d9d8c32f3d2b7e3526 apps/web/src/components/cms-taxonomy-designer/CmsTaxonomyVersionDesigner.late-edit.test.tsx
- 91cc74793059286bed84b337bd62a21c5af1b4f9784eb08cd746202bbea5d0c4 apps/web/src/components/cms-locale/use-locale-variant-form.ts
- 62d8deb9429888865077001ca1af9889a0474717721530cb35eb3ccf432c83c1 apps/web/src/components/cms-locale/CmsLocaleVariantForm.tsx
- a8349e17cddb235b18a555e485041f14e935d57d83fa0ee0d93aa72090f5a5c3 apps/web/src/components/cms-locale/CmsLocaleVariantForm.late-edit.test.tsx
- 9f2c9ad0f6ec663109294a1ed017c362172bdd393c887125484fca36dc7702fc tests/e2e/support/s12-real-template-locale.origins.test.ts
- 74af9a293734fa91c98376754f00c79dc8b752926b16a645bde05d9c8e2aa9c2 docs/handoffs/2026-10-22-claude-s12/recite4/unit5-proposals.json

## Fix round 3 (review V16 verification, V16-14, 2026-10-29)
Status: GREEN. The "sent" snapshot of the locale form and the vocabulary designer was bound to the latest ATTEMPT; it is now bound to the CONFIRMED save.

- **Locale form, RED**: `CmsLocaleVariantForm.late-edit.test.tsx` "carries no \"Saved in this draft.\" mark for the new value while the second save is pending or after it fails": save "v1" (one mark), edit to "v2" (none), save again held: the mark was back (`expected 1 to be 0`) and stayed after the 503 ("Nothing was confirmed"). Fix in `use-locale-variant-form.ts`: `sentValuesRef.current = values` removed from the send and set in the `saved` branch next to `setSavedIds(...)` (the `values` of that save's closure are what the confirmed request carried).
- **Vocabulary designer, RED**: `CmsTaxonomyVersionDesigner.late-edit.test.tsx` "flags the edit made after the verified attempt as not part of the saved draft": attempt 1 unknown with its check held, an edit, attempt 2 refused, then the check verifies attempt 1: banner "Vocabulary draft saved" with no late-edit notice (`expected ... to contain 'while this was saving'`). Fix in `use-taxonomy-designer.ts`: `sentRef.current = snapshot` removed from the send and set immediately before each of the two `setStatus({ kind: 'created', ... })` calls (the direct result and the reconcile verdict); the `snapshot` of the closure is the attempt that was confirmed.
- Not changed (by reading only, per V16): the template successor stores its snapshot at submit start; its `cannotSubmit` guard keeps a refused second call from overwriting it, so no reproduction exists; storing it on `created` would remove the dependence and is left as a follow-up.
- The existing late-edit tests of fix round 2 (locale mark kept on the sent field, notice on a late edit, no notice otherwise; vocabulary notice and no-notice) stayed green unchanged.

### Test corrections
none in this round: two tests were added to files this lane created in fix round 2 (`CmsLocaleVariantForm.late-edit.test.tsx`, `CmsTaxonomyVersionDesigner.late-edit.test.tsx`; the latter gained a `beforeAll` import of `taxonomy-outcome-reconcile` and more fixture imports); no existing oracle changed.

### Runs
- RED: both new tests failed before the fix for the reasons above; GREEN after (6 tests in the two files).
- `vitest run apps/web` (whole app, including `apps/web/src/pages`): 761 files, 8,807 tests, all passed. `cms-locale` and `cms-taxonomy-designer` directories: 367 tests passed.
- eslint `--max-warnings=0` on `apps/web`: clean; prettier `--check apps/web/src`: clean; `tsc --noEmit` in `apps/web`: clean.
- `use-locale-variant-form.ts` is exactly 300 lines (the utility cap).
- `recite4/unit5-proposals.json`: only the AC-271 c0 gap text changed (names the two new tests as late-edit evidence, not cited as the clause).

### Changed files (SHA-256)
- ee8236c15b99d43e55a7d05508928cd6337a25bee057d7692e3560791b676ec0 apps/web/src/components/cms-locale/use-locale-variant-form.ts
- 5054994c95e5e717757075a0d9c27cd3d4ed7848d9ca5a82e4de00f86481ab6e apps/web/src/components/cms-locale/CmsLocaleVariantForm.late-edit.test.tsx
- 5db6ae60668e4b8dda3158ce13b5afd0475f9d0b2b0b076003877f91e5c6e685 apps/web/src/components/cms-taxonomy-designer/use-taxonomy-designer.ts
- 21592f23f6c3fbe1c47bd99a194c8fdfc17e866a428cfaf591564d086a1368bd apps/web/src/components/cms-taxonomy-designer/CmsTaxonomyVersionDesigner.late-edit.test.tsx
- e55a2f154d95ecb373cc91e109e8caaf4e761fd6e114a74edd215c8b9a45ba20 docs/handoffs/2026-10-22-claude-s12/recite4/unit5-proposals.json
