# Lane bundle report (2026-10-12)

Worktree `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`, branch `claude/phase2-slice11`, HEAD `68f51a4b` plus this lane's uncommitted files (the tree was clean at the start).
I ran no `git add/commit/stash/restore/reset`. I typed one `git checkout -- /dev/null` by mistake: it matched no path and changed nothing (`git status` and HEAD identical before and after). The primary checkout was not touched.
Every heavy command ran under `flock -s /tmp/wejammin-quiet.lock`; builds additionally under `/tmp/wejammin-bundle-build.lock` (they write `apps/web/dist`); the browser runs went through `lane-e2e.sh` (CI lock, reset to the worktree's migrations). Logs: `lane-bundle-logs/` (README inside; `*.log` is git-ignored).
**Measure with the pinned toolchain.** gzip sizes depend on the Node version: Node 26 (the system `node`) gzips the same bytes about 0.8 KB larger than the pinned Node 22.23.1 that CI, the gate and the Playwright runner use. Every number below is Node 22.
One sub-agent did the capability-grant and template islands (A and B below); I read its diff, re-ran its suites and the build myself.

## Result in one table

| Item | Outcome |
| ---- | ------- |
| 1. Gate | `scripts/verify-bundle-budget.mjs` now measures the eleven CMS editorial routes that no other measurement owns (table `CMS_EDITORIAL_ROUTES`, 14 pages) against the unchanged thresholds. RED on the unmodified build: `bundle-check-red-1.log` (eight islands and eight routes over, exit 1). |
| 2. Product | Every CMS editorial island and route fits. GREEN: `pnpm build && pnpm bundle:check` exit 0 (`build-final.log`, `bundle-check-green-final.log`). |
| 3. Tests | Whole-repo vitest (minus `tests/postgrest`, `tests/e2e`): 20,056 passed, 4 failed; the 4 are the three receipt guards (below). Real-route Chrome project: **151 of 151 passed** on a quiet host (`e2e-real-route-full-3.log`), including the new route-budget test; mutation-proven. |
| 4. Ledger | Only P2-S11-AC-106 changed: the budget clause cites the new route test and two gate tests; `partial` -> `verified`, limitation empty, `text` byte-identical, clauses tile. |
| 5. READMEs | `documentation-boundaries` green: 12 `lane-*-logs` directories (9 new READMEs, 3 completed). |

## The defect and its cause (measured)

`bundle:check` measured only Infrastructure, Platform configuration and the registry. Every other CMS editorial route was unmeasured and over: the workflow route loaded 144,220 gzip bytes of initial JavaScript (limit 92,160) and its island closure was 79,484 (limit 35,840).
Cause, shared by every CMS island: (1) the islands imported the zod contract barrel as a value (`@wejammin/contracts`, one 53 KB gzip `contracts` chunk); (2) the document shell's page-actions script imported the restore command's schemas, so even routes with no island (entry list, history, queue) carried that chunk (64,377 bytes). The registry already solved this (AC261: a zod-free `client.ts` entry plus a lazily loaded validators entry); the CMS islands never followed it.
Astro client runtime share: `client.js` (React DOM client) 56,517 + `react-dom` 1,358 + `react` 3,131 + `jsx-runtime` 320 + `preload-helper` 753 = **62,079 gzip bytes, 67.4% of the 92,160 route threshold**. That floor is fixed for any React island route; the CMS code of a route has about 30 KB.

## Measured, before -> after (route / island closure, gzip bytes; limits 92,160 / 35,840)

| Route | Before | After |
| ----- | ------ | ----- |
| CMS entry workflow | 144,220 / 79,484 | 89,484 / 28,141 |
| CMS review detail | 142,415 / 77,679 | 87,668 / 26,325 |
| CMS entry editor | 149,445 / 85,987 | 90,160 / 28,817 |
| CMS entry create | 142,686 / 79,735 | 84,324 / 23,488 |
| CMS conflict resolve | 146,653 / 83,702 | 86,341 / 25,505 |
| CMS capability grants | 135,729 / 76,477 | 83,066 / 23,814 |
| CMS template create / edit | 123,978 / 64,149 and 125,282 / 65,453 | 70,244 / 10,415 and 71,554 / 11,725 |
| entry list, revision history, review queue (no island) | 64,377 / 0 | 5,465 / 0 |
| content schema registry (existing measurement) | 90,911 / 33,887 | 90,989 / 33,965 |

The lazy `contracts` chunk is 51,795 (limit 81,920) and appears in no route's initial assets. The tightest margin is the entry editor, 2,000 bytes; the workflow route has 2,676. No threshold was raised or touched (`BUNDLE_BUDGETS` is asserted unchanged by a test).

## What changed and why

**Gate (`scripts/verify-bundle-budget.mjs`).** `CMS_EDITORIAL_ROUTES` lists all 14 pages of `apps/web/src/pages/app/cms-content-modeling` with their island, the shell scripts they load (`cms-editorial-document`: the three bundled scripts of `CmsEditorialDocument.astro`; `page-shell`: the page's own route-heading and auth-scope scripts) and, for the three registry pages, `measuredBy` (the existing registry measurement). `measureCmsEditorialRoute(s)` charges island + Astro/React runtime + shell scripts to the route and the island's static closure to the island; a route with no island is charged its shell scripts alone; a missing island or script fails closed; `main()` prints one evidence entry per route (`cmsEditorial`) and fails with every failing route named. A vitest test fails when a page or hydrated island of the route tree is missing from the table.

**Contracts.** `client.ts` (zod-free) gained the constants and pure rules the islands need at hydration: `isCmsUuid`, `CMS_PREFLIGHT_CATEGORIES`, `PUBLICATION_ACTIONS`, `cmsJsonEqual`, the review-assignment bounds, `CMS_TZDB_VERSION`, `parseLocalDateTime`, `fieldIdOfPointer`, `isWellFormedAuthoredString` and the rich-text/object walkers. Each lives once in a zod-free module and the schema is built from it (`preflight-categories.ts`, `publication-vocabulary.ts`, `json-equal.ts`, `review-assignment-rules.ts`, `field-pointer.ts`). The editors need the rich_text.v1 grammar synchronously, so `structured-values-rules.ts` holds the leaf rules (bounds, patterns, NFC, marks order, merge equivalence; the zod schema now imports them) and a zod-free structure walker; `structured-values-rules.test.ts` proves it equal to `RichTextV1Schema` over a hand corpus and a deterministic 6,000-document mutation sweep (it detects strictness, list-depth, empty-heading and merge mutations of the walker), and a type-level check (`RichTextMirrorAgrees`) fails to compile if the two document types diverge. `cms-editorial/validators.ts` is the curated, lazily loaded schema list (package export `./cms-editorial/validators`, vitest alias, coverage exclusion as for the registry's). The zod-free modules own three chunks (`contracts-client` core, `-workflow`, `-editor`) so a route loads only the rules it uses; the registry routes load the core chunk only (their route grew 78 bytes, not 1.3 KB, because of this split).

**Web, common.** `lib/cms-contract-validators.ts` loads the validators on first need (`loadedCmsValidators() ?? (await loadCmsValidators())`, `withCmsValidators(use, unavailable)` for form handlers, `warmCmsValidators` on intent). A control receiving focus warms them, so submit is usually synchronous; a cold load fetches none of it (asserted in Chrome). Validators that cannot be fetched send nothing and say so.

**A. Slice 11 workflow and review islands.** The command table is zod-free (`schemas(validators)`); the transport, canonical reads, reviewer options and every form check obtain the validators lazily; a new local refusal `validators_unavailable`. The server proxy (`apps/web/src/server/cms-workflow-platform-command.ts`) reads the schemas statically from the same validators module, so client and server still validate with the same Zod schemas (security-first).

**B. Editor, create, conflict islands and the document shell.** The page loaders (edit, conflict) and the Astro create form decode the field definitions into descriptors on the server (`cms-field-descriptor-decode.ts`); the islands receive `descriptors` in `init`. The write and read transports (`cms-editorial-runtime`, create submit, draft-detail transport, conflict resolve and detail transport) are imported dynamically at the call site, reported as a lost answer if the chunk cannot be fetched; the zod-free helpers they share moved to `cms-editorial-request-support.ts`. The rich-text editors validate with the zod-free guard (`cms-rich-text-contracts.ts`; the zod schemas stay in `cms-rich-text-schemas.ts` for the parity tests). The document shell's page actions keep the type selector, the review's focus/Escape/Cancel handling and draft recovery eager (they must work before any chunk arrives; a first lazy version broke the Slice 10 keyboard spec and was reshaped), and import only the restore command (`cms-editorial-page-actions-restore.ts`, which brings the schemas) on the first restore submit and when the review opens.

**C. Capability-grant and template islands (sub-agent).** `validate*Fields`, the request builders and the submit transport take `validators`; the forms use `withCmsValidators`; `cms-capability-grant-console-url.ts` is the zod-free half of the address rules (the server keeps the static `cms-capability-grant-url.ts`); new `use-cms-template-validators.ts` refuses a second cold submit. Failure to load degrades the list or sends nothing.

**Guards added.** `apps/web/src/cms-island-static-closure.test.ts` walks every island's and shell script's static closure and fails with the module that reaches zod, the barrel or a lazy entry (mutation-checked). Chunk-boundary tests prove each list equals the closure of `client.ts` and keep the groups ordered.

## RED and GREEN evidence

- Gate RED: `gate-red-1-unit.log` (13 unit tests, import-level RED), `bundle-check-red-1.log` (the real RED: exit 1 on the current build). Gate GREEN: `gate-unit-4.log`, `bundle-check-green-final.log`.
- Route assertion in Chrome (the new test): GREEN `e2e-bundle-workflow-1.log` (9 of 9), `e2e-real-route-full-3.log` (151 of 151). Mutations (`bundle-mutations*.sh`, `bundle-mutation-*.log`, files restored byte-identical): p3b a static barrel import called in a workflow module -> 142,122 > 92,160, test fails; p4 validators warmed on mount -> 143,635 > 92,160, test fails; p5 threshold lowered to 80 KiB -> 88,296 > 81,920, test fails. A first p3 (`void` use of an import) was dropped by the bundler and proved nothing: kept as `...-NOT-DETECTED-ineffective-mutation.log`.
- Rich-text walker mutation checks (run inline, not logged; the walker file was restored from a byte copy and `cmp` was identical): a heading allowed to be empty, the list-depth rule dropped, the merge check ignoring links and unknown keys allowed each fail the differential test; a first unknown-key mutation (an extra allowed key the sweep never generates) was ineffective and was replaced. The baseline run is `rules-diff-1.log`.
- Suites: `workflow-vitest-2.log`, `editor-vitest-2.log`, `richtext-1.log`, `structured-values-1.log`, `suite-web-contracts-1.log`, `suite-all-final.log`, `astro-check-1.log` (0 errors), `eslint-final.log`.

## Changed existing tests (titles unchanged unless stated)

- Signatures: `cms-workflow-command-specs.test.ts` (`spec.schemas(validators)`, `verifyCommandSuccess(spec, validators, ...)`), `cms-workflow-command-transport.test.ts` (`workflowCommandPath(validators, ...)`), `cms-workflow-reason.test.ts` (`validate*Reason(validators, ...)`), and the capability/template validation, request, submit and reconcile tests of the sub-agent (a `validators` argument). Every assertion is kept.
- Preloading (`beforeAll(loadCmsValidators)` or `preloadCmsEditorialTransports()`, new `cms-editorial-lazy-transports.test-support.ts`): the 7 workflow form tests, `CmsWorkflowCommandFrame.test.tsx`, the 12 capability DOM tests and 2 designer tests, nine editor/create/conflict island tests, and `tests/integration/phase-02-slice-10-ev-eb-web-{focus,restore}.test.ts`. The page-actions tests warm the lazy restore module in `beforeEach`; the self-install test waits with `vi.waitFor` instead of a fixed tick count.
- Descriptors: the editor/conflict/create fixtures and tests pass `descriptors: describeCmsAuthoringFields(fields)` (import moved to `cms-field-descriptor-decode`): ~18 files in `apps/web`, `tests/accessibility/phase-02-slice-10-editorial-axe.test.ts`, `...-ev-ec-r2-create-controls.test.ts` and the apispec `tests/postgrest/phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts` (import only; not run, needs the real stack).
- Two source guards in `phase-02-slice-10-ev-ec-source-guards.test.ts`: "only parses a document through the shared canonical schema before it builds an element" now matches `/isCanonicalRichText\(value\)/u` (was `/RichTextV1DocumentSchema\.safeParse\(value\)/u`; the renderer still validates through the shared grammar, now by its zod-free walker), and "passes the selected type and the projected fields to the island, with no field of its own" now requires the `descriptors={descriptors}` prop between `fields` and `client:load`.
- `cms-rich-text-contracts.test.ts`: the dynamic import specifier `./cms-rich-text-contracts` -> `./cms-rich-text-schemas` (the module that kept the zod schemas); assertions unchanged.
- `client-chunk-boundaries.test.ts` "[P2-S09-AC-261] declares the zod-free groups before the dependency group, rules first, with falling priority": three groups -> five (rules, core, workflow, editor, dependency), same ordering and priority assertions.
- `field-rules.test.ts` "[P2-S09-AC-248] uuid": one assertion added (`isCmsUuid` agrees with `CmsUuidSchema`).
- Ledger: `tests/contracts/phase-02-slice-11-evidence-ledger-101-122.ts`, AC-106 only.

## New tests (title)

- `tests/performance/cms-editorial-bundle-budget.test.ts` (13): "CMS editorial bundle-budget route declaration" declares every page of the CMS content-modeling route tree exactly once | names, for each page, exactly the island it hydrates (the registry routes stay with the registry measurement) | charges the document-shell scripts to exactly the pages that render the shell | leaves the registry routes to the existing registry measurement and measures the rest | keeps the declared thresholds unchanged; "CMS editorial bundle-budget measurement" charges the document-shell scripts and their imports to the route but not to the island | fails a route whose island statically pulls a heavy module, naming the route, the island and both thresholds | passes the same payload when the island reaches it only through a dynamic import, and measures it as a lazy chunk | fails a lazy chunk over the lazy-chunk threshold | measures a route that hydrates no island from the document-shell scripts alone | charges the shared route-heading and auth-scope scripts to a page that owns its script tags | reports every failing route together instead of stopping at the first | fails closed when a declared island is missing from the build.
- `tests/e2e/phase-02-slice-11-bundle-budget-real-route.spec.ts` (real-route-chrome): `[P2-S11-AC-106] a cold load of the production workflow route stays within the initial-route JavaScript threshold and fetches no contract schema`.
- `packages/contracts/src/cms-client-entry.test.ts` (5): "zod-free CMS editorial client entry" re-exports exactly the barrel values, so no vocabulary or rule can drift | builds each closed schema from the zod-free vocabulary the browser lists | reads a schedule local date and time exactly as the contract schema accepts it | imports no zod anywhere in its static closure | exposes the lazily loaded validators as the barrel objects, importing only zod.
- `packages/contracts/src/content-schema-registry/structured-values-rules.test.ts` (5): "zod-free rich_text.v1 rules" accept the same documents as the schema, and count the same characters | refuse every non-document the schema refuses | agree on the span, link, mark, merge and list-depth rules | agree on a deterministic mutation sweep of valid documents; "zod-free object value rules" agree with the schema-backed contract over objects of every shape.
- `apps/web/src/lib/cms-contract-validators.test.ts` (5): "lazy CMS editorial validators" loads nothing until a need, then loads the module once for every caller | retries a failed load on the next need instead of caching the failure | warms on intent without reporting a failure, and starts at most one load | runs a form check synchronously once the validators are loaded, and as soon as they load otherwise | reports the validators as unavailable, and runs no check, when they cannot be fetched.
- `apps/web/src/cms-island-static-closure.test.ts` (14): "CMS editorial islands: static import closure" names real entries | `<entry> never reaches zod, the contract barrel or a lazy entry statically` (11 entries) | keeps the zod-free browser entry as the only contracts import of an island | keeps the lazy validators behind the lazy loader only.
- `CmsWorkflowCommandFrame.test.tsx`: loads no validator until a control of the form takes focus, then loads them once. `client-chunk-boundaries.test.ts`: "[P2-S09-AC-261] keeps the editor walkers out of the workflow and core chunks" and "[P2-S09-AC-261] keeps the workflow-only zod-free modules out of the core chunk the registry routes load". `cms-rich-text-contracts.test.ts`: "the zod-free guard agrees with the shared schema: <probe>" (12).
- Sub-agent: `CmsCapabilityGrantConsole.validators-unavailable.dom.test.tsx` (7: sends nothing from the grant form, says so, and sends after the connection returns | shows no field error from a blur check that could not run | sends nothing from the renew form and says so | sends nothing from the revoke confirmation and says so | keeps the last verified rows and offers a retry when Back cannot parse the address | says the list was not filtered when the capability filter cannot be checked | Back with the validators loaded restores the list position from the address and re-reads the list), `cms-capability-grant-console-url.test.ts` (2), `cms-capability-grant-client.test.ts` (3 added), `CmsTemplateDesigner.validators-unavailable.test.tsx` (4), `cms-template-edit-reconcile.test.ts` (1 added).

## Spec lines satisfied

FE03 "Performance budgets and loading strategy" (the thresholds are hard acceptance criteria; a feature over a budget must split), AC261/P2-S09 (islands ship no zod; the registry precedent), P2-S11-AC-106 (both clauses now cited), security-first (client and server Zod; nothing is sent unvalidated).

## Open items

1. **Receipts.** The three receipt guards fail, as before this lane (S11: "no receipt", 2,287 problems now against 2,284: my three new citations; S10: 593, of which stale receipts for files this lane changed are `cms-editorial-conflict-controller.test.ts`, `CmsEditorialConflictResolveIsland.test.tsx`, `CmsEditorialEntryEditorIsland.leave.test.tsx` and `CmsEditorialEntryEditorIsland.test.tsx`; S09: 99 stale receipts, none for a file of this lane). Regenerate with `node scripts/evidence/run-slice-evidence.mjs --slice 10|11` (and S09); the new Playwright test and the two gate tests must run in it.
2. **S11-RR-07 intermittent.** In the first full real-route run `[S11-RR-07] a schedule resolves the local time...` failed once (`That local time does not exist` not shown; the snapshot shows the Time zone input holding `America/New_YorkAmerica/New_York`). It passed 12 of 12 repeats in isolation and in the next two full runs. Mechanism: the spec fills the zone right after opening the form; when the Time authority arrives between Playwright's select and insert, the default zone is appended (a race in the existing spec/hook, not in this lane's files). A focus warm-up of the validators adds main-thread work at that moment, so I cannot rule out that it makes the race slightly likelier; the fix belongs to the spec (wait for the zone default before filling).
3. The second full run failed the Slice 10 keyboard spec ("history: compare with Enter, open the restore review with Enter ..."): a real regression of my first page-actions split (review handlers lazy). Fixed by keeping the review behavior eager; run 3 is green.
4. Margins: entry editor 2,000 bytes, workflow 2,676. A new editor feature must be lazy.
5. `pnpm test:coverage` (100% thresholds) was not run whole. The contracts-only run shows no uncovered line in the new zod-free modules; `structured-values.ts` had two uncovered functions in a first version of the type check, replaced by a type-only assertion.
6. The READMEs I added for other lanes' log directories (a11y-status, dep502, e2e, e2e/probe, evidence-gaps, evidence-gaps/latency-exclusive, reviewB-1, lanes) are written from the file names and the lane reports; their owners should read them.
7. The apispec `phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts` only had its import path updated; it was not run (real stack).

## Files

New and changed files (git status; `lane-bundle-logs/` holds the READMEs, the mutation scripts `bundle-mutations.sh`/`bundle-mutations-2.sh` and the git-ignored logs):

### Gate and its tests (4)

- changed `scripts/verify-bundle-budget.mjs`
- new `tests/performance/bundle-fixture.test-support.ts`
- new `tests/performance/cms-editorial-bundle-budget.test.ts`
- changed `tests/performance/README.md`

### Contracts (zod-free entry, lazy validators, rules) (21)

- changed `packages/contracts/package.json`
- changed `packages/contracts/src/client.ts`
- new `packages/contracts/src/cms-client-entry.test.ts`
- new `packages/contracts/src/cms-editorial/field-pointer.ts`
- new `packages/contracts/src/cms-editorial/json-equal.ts`
- new `packages/contracts/src/cms-editorial/preflight-categories.ts`
- changed `packages/contracts/src/cms-editorial/preflight.ts`
- changed `packages/contracts/src/cms-editorial/primitives.ts`
- new `packages/contracts/src/cms-editorial/publication-vocabulary.ts`
- changed `packages/contracts/src/cms-editorial/README.md`
- new `packages/contracts/src/cms-editorial/review-assignment-rules.ts`
- changed `packages/contracts/src/cms-editorial/review-assignment.ts`
- new `packages/contracts/src/cms-editorial/validators.ts`
- changed `packages/contracts/src/cms-editorial/version-set.ts`
- changed `packages/contracts/src/cms-editorial/workflow-models.ts`
- changed `packages/contracts/src/content-schema-registry/field-rules.test.ts`
- changed `packages/contracts/src/content-schema-registry/field-rules.ts`
- new `packages/contracts/src/content-schema-registry/structured-values-rules.test.ts`
- new `packages/contracts/src/content-schema-registry/structured-values-rules.ts`
- changed `packages/contracts/src/content-schema-registry/structured-values.ts`
- changed `packages/contracts/src/README.md`

### Web: lazy loader, page actions, chunk boundaries (17)

- changed `apps/web/client-chunk-boundaries.d.mts`
- changed `apps/web/client-chunk-boundaries.mjs`
- changed `apps/web/README.md`
- changed `apps/web/src/client-chunk-boundaries.test.ts`
- new `apps/web/src/cms-island-static-closure.test.ts`
- new `apps/web/src/lib/cms-contract-validators.test.ts`
- new `apps/web/src/lib/cms-contract-validators.ts`
- changed `apps/web/src/lib/cms-editorial-page-actions-core.test.ts`
- changed `apps/web/src/lib/cms-editorial-page-actions-core.ts`
- new `apps/web/src/lib/cms-editorial-page-actions-dom.ts`
- new `apps/web/src/lib/cms-editorial-page-actions-restore.ts`
- changed `apps/web/src/lib/cms-editorial-page-actions.test.ts`
- changed `apps/web/src/lib/cms-editorial-restore-feedback.ts`
- changed `apps/web/src/lib/cms-editorial-restore-review.ts`
- new `apps/web/src/lib/cms-editorial-restore-summary.ts`
- changed `apps/web/src/lib/README.md`
- changed `apps/web/src/server/cms-workflow-platform-command.ts`

### Web: workflow and review islands (cms-editorial-workflow) (30)

- changed `apps/web/src/components/cms-editorial-workflow/CmsEditorialAssignmentCreate.tsx`
- changed `apps/web/src/components/cms-editorial-workflow/CmsEditorialDecisionForm.test.tsx`
- changed `apps/web/src/components/cms-editorial-workflow/CmsEditorialDecisionForm.tsx`
- changed `apps/web/src/components/cms-editorial-workflow/CmsEditorialPreviewForm.test.tsx`
- changed `apps/web/src/components/cms-editorial-workflow/CmsEditorialPreviewForm.tsx`
- changed `apps/web/src/components/cms-editorial-workflow/CmsEditorialPublishConfirmation.test.tsx`
- changed `apps/web/src/components/cms-editorial-workflow/CmsEditorialPublishConfirmation.tsx`
- changed `apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewAssignmentForm.test.tsx`
- changed `apps/web/src/components/cms-editorial-workflow/CmsEditorialScheduleForm.choices.test.tsx`
- changed `apps/web/src/components/cms-editorial-workflow/CmsEditorialScheduleForm.tsx`
- changed `apps/web/src/components/cms-editorial-workflow/CmsEditorialScheduleResolution.tsx`
- changed `apps/web/src/components/cms-editorial-workflow/cms-workflow-canonical-read.ts`
- changed `apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.ts`
- changed `apps/web/src/components/cms-editorial-workflow/CmsWorkflowCommandFrame.test.tsx`
- changed `apps/web/src/components/cms-editorial-workflow/CmsWorkflowCommandFrame.tsx`
- changed `apps/web/src/components/cms-editorial-workflow/cms-workflow-command-specs.test.ts`
- changed `apps/web/src/components/cms-editorial-workflow/cms-workflow-command-specs.ts`
- changed `apps/web/src/components/cms-editorial-workflow/cms-workflow-command-transport.test.ts`
- changed `apps/web/src/components/cms-editorial-workflow/cms-workflow-command-transport.ts`
- changed `apps/web/src/components/cms-editorial-workflow/cms-workflow-expiry.ts`
- changed `apps/web/src/components/cms-editorial-workflow/cms-workflow-form-state.ts`
- changed `apps/web/src/components/cms-editorial-workflow/cms-workflow-input-retention.test.tsx`
- changed `apps/web/src/components/cms-editorial-workflow/cms-workflow-input-retention-time.test.tsx`
- changed `apps/web/src/components/cms-editorial-workflow/cms-workflow-reason.test.ts`
- changed `apps/web/src/components/cms-editorial-workflow/cms-workflow-reason.ts`
- changed `apps/web/src/components/cms-editorial-workflow/cms-workflow-reviewer-options.ts`
- changed `apps/web/src/components/cms-editorial-workflow/cms-workflow-schedule-actions.ts`
- changed `apps/web/src/components/cms-editorial-workflow/cms-workflow-schedule-form-model.ts`
- changed `apps/web/src/components/cms-editorial-workflow/cms-workflow-schedule-resolution.ts`
- changed `apps/web/src/components/cms-editorial-workflow/README.md`

### Web: editor, create and conflict islands (cms-editorial, -fields, -pages, cms-rich-text) (52)

- changed `apps/web/src/components/cms-editorial/cms-editor-dom-teardown.test.tsx`
- changed `apps/web/src/components/cms-editorial/cms-editorial-app-routes.ts`
- changed `apps/web/src/components/cms-editorial/cms-editorial-conflict-controller.test.ts`
- changed `apps/web/src/components/cms-editorial/cms-editorial-conflict-controller.ts`
- changed `apps/web/src/components/cms-editorial/CmsEditorialConflictPath.provenance.test.tsx`
- changed `apps/web/src/components/cms-editorial/CmsEditorialConflictResolveIsland.test.tsx`
- changed `apps/web/src/components/cms-editorial/cms-editorial-conflict-state.ts`
- changed `apps/web/src/components/cms-editorial/cms-editorial-draft-values.test.ts`
- changed `apps/web/src/components/cms-editorial/cms-editorial-editor-fixtures.test-support.ts`
- changed `apps/web/src/components/cms-editorial/CmsEditorialEntryCreateForm.astro`
- changed `apps/web/src/components/cms-editorial/CmsEditorialEntryCreateIsland.test.tsx`
- changed `apps/web/src/components/cms-editorial/cms-editorial-entry-create-submit.ts`
- changed `apps/web/src/components/cms-editorial/cms-editorial-entry-editor-context.ts`
- changed `apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland.facts.test.tsx`
- changed `apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland.focus.test.tsx`
- changed `apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland.leave.test.tsx`
- changed `apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland.test.tsx`
- changed `apps/web/src/components/cms-editorial/cms-editorial-entry-editor-outcomes.ts`
- changed `apps/web/src/components/cms-editorial/cms-editorial-entry-editor-save.ts`
- changed `apps/web/src/components/cms-editorial/cms-editorial-entry-editor-state.ts`
- new `apps/web/src/components/cms-editorial/cms-editorial-lazy-transports.test-support.ts`
- new `apps/web/src/components/cms-editorial/cms-editorial-request-support.ts`
- changed `apps/web/src/components/cms-editorial/cms-editorial-result-handoff.ts`
- changed `apps/web/src/components/cms-editorial/cms-editorial-submit-focus.test.tsx`
- changed `apps/web/src/components/cms-editorial/ev-ea-conflict-recovery.test.ts`
- changed `apps/web/src/components/cms-editorial/ev-eb-focus-gaps.test.tsx`
- new `apps/web/src/components/cms-editorial-fields/cms-field-descriptor-decode.ts`
- changed `apps/web/src/components/cms-editorial-fields/cms-field-descriptor.test.ts`
- changed `apps/web/src/components/cms-editorial-fields/cms-field-descriptor.ts`
- changed `apps/web/src/components/cms-editorial-fields/CmsFieldEditor.test.tsx`
- changed `apps/web/src/components/cms-editorial-fields/cms-field-value-scalar.ts`
- changed `apps/web/src/components/cms-editorial-fields/cms-field-value-structured.ts`
- changed `apps/web/src/components/cms-editorial-fields/cms-field-value.test.ts`
- changed `apps/web/src/components/cms-editorial-fields/CmsFieldValueView.test.tsx`
- changed `apps/web/src/components/cms-editorial-fields/README.md`
- changed `apps/web/src/components/cms-editorial-pages/load-conflict-page.ts`
- changed `apps/web/src/components/cms-editorial-pages/load-entry-edit-page.test.ts`
- changed `apps/web/src/components/cms-editorial-pages/load-entry-edit-page.ts`
- changed `apps/web/src/components/cms-editorial-pages/phase-02-slice-10-ev-ec-r1-object-editor-wiring.test.tsx`
- changed `apps/web/src/components/cms-editorial-pages/README.md`
- changed `apps/web/src/components/cms-editorial/phase-02-slice-10-ev-ec-object-recovery.test.tsx`
- changed `apps/web/src/components/cms-editorial/phase-02-slice-10-ev-ec-source-guards.test.ts`
- changed `apps/web/src/components/cms-editorial/README.md`
- changed `apps/web/src/components/cms-editorial/use-cms-editorial-entry-create.ts`
- changed `apps/web/src/components/cms-rich-text/cms-rich-text-blocks.ts`
- changed `apps/web/src/components/cms-rich-text/cms-rich-text-contracts.test.ts`
- changed `apps/web/src/components/cms-rich-text/cms-rich-text-contracts.ts`
- changed `apps/web/src/components/cms-rich-text/cms-rich-text-links.ts`
- changed `apps/web/src/components/cms-rich-text/CmsRichTextRenderer.tsx`
- new `apps/web/src/components/cms-rich-text/cms-rich-text-schemas.ts`
- changed `apps/web/src/components/cms-rich-text/README.md`
- changed `apps/web/src/components/cms-rich-text/use-cms-rich-text-blocks.ts`

### Web: capability-grant and template islands (sub-agent) (41)

- new `apps/web/src/components/cms-capability-grants/CmsCapabilityGrantCheckNotice.tsx`
- changed `apps/web/src/components/cms-capability-grants/cms-capability-grant-client.test.ts`
- changed `apps/web/src/components/cms-capability-grants/cms-capability-grant-client.ts`
- changed `apps/web/src/components/cms-capability-grants/cms-capability-grant-commands.ts`
- changed `apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.controls.dom.test.tsx`
- changed `apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.facts.dom.test.tsx`
- changed `apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.grant.dom.test.tsx`
- changed `apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.ia-edges.dom.test.tsx`
- changed `apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.privacy.dom.test.tsx`
- changed `apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.r12-step-up-key.dom.test.tsx`
- changed `apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.r4.dom.test.tsx`
- changed `apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.r8.dom.test.tsx`
- changed `apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.rows.dom.test.tsx`
- changed `apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.s09-criteria.dom.test.tsx`
- changed `apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.step-up.dom.test.tsx`
- changed `apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.step-up-envelope.dom.test.tsx`
- changed `apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.tsx`
- new `apps/web/src/components/cms-capability-grants/cms-capability-grant-console-url.test.ts`
- new `apps/web/src/components/cms-capability-grants/cms-capability-grant-console-url.ts`
- new `apps/web/src/components/cms-capability-grants/CmsCapabilityGrantConsole.validators-unavailable.dom.test.tsx`
- changed `apps/web/src/components/cms-capability-grants/CmsCapabilityGrantForm.tsx`
- changed `apps/web/src/components/cms-capability-grants/CmsCapabilityGrantRenewForm.tsx`
- changed `apps/web/src/components/cms-capability-grants/CmsCapabilityGrantRevokeConfirmation.tsx`
- changed `apps/web/src/components/cms-capability-grants/cms-capability-grant-url.ts`
- changed `apps/web/src/components/cms-capability-grants/cms-capability-grant-validation.test.ts`
- changed `apps/web/src/components/cms-capability-grants/cms-capability-grant-validation.ts`
- changed `apps/web/src/components/cms-capability-grants/README.md`
- changed `apps/web/src/components/cms-capability-grants/use-cms-capability-grants.ts`
- changed `apps/web/src/components/cms-composition/CmsTemplateDesigner.interaction.test.tsx`
- changed `apps/web/src/components/cms-composition/cms-template-designer-request.test.ts`
- changed `apps/web/src/components/cms-composition/cms-template-designer-request.ts`
- changed `apps/web/src/components/cms-composition/cms-template-designer-submit.test.ts`
- changed `apps/web/src/components/cms-composition/cms-template-designer-submit.ts`
- changed `apps/web/src/components/cms-composition/CmsTemplateDesigner.tsx`
- new `apps/web/src/components/cms-composition/CmsTemplateDesigner.validators-unavailable.test.tsx`
- changed `apps/web/src/components/cms-composition/CmsTemplateEditDesigner.interaction.test.tsx`
- changed `apps/web/src/components/cms-composition/CmsTemplateEditDesigner.tsx`
- changed `apps/web/src/components/cms-composition/cms-template-edit-reconcile.test.ts`
- changed `apps/web/src/components/cms-composition/cms-template-edit-reconcile.ts`
- changed `apps/web/src/components/cms-composition/README.md`
- new `apps/web/src/components/cms-composition/use-cms-template-validators.ts`

### Tests outside the web app (7)

- changed `tests/accessibility/phase-02-slice-10-editorial-axe.test.ts`
- changed `tests/accessibility/phase-02-slice-10-ev-ec-r2-create-controls.test.ts`
- changed `tests/contracts/phase-02-slice-11-evidence-ledger-101-122.ts`
- changed `tests/e2e/phase-02-slice-11-bundle-budget-real-route.spec.ts`
- changed `tests/integration/phase-02-slice-10-ev-eb-web-focus.test.ts`
- changed `tests/integration/phase-02-slice-10-ev-eb-web-restore.test.ts`
- changed `tests/postgrest/phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts`

### Repository config (1)

- changed `vitest.config.ts`

### Documentation (READMEs for the log directories) (11)

- new `docs/handoffs/2026-10-10-claude-s11/lane-a11y-status-logs/README.md`
- new `docs/handoffs/2026-10-10-claude-s11/lane-dep502-logs/README.md`
- new `docs/handoffs/2026-10-10-claude-s11/lane-e2e-logs/probe/README.md`
- new `docs/handoffs/2026-10-10-claude-s11/lane-e2e-logs/README.md`
- new `docs/handoffs/2026-10-10-claude-s11/lane-evidence-gaps-logs/latency-exclusive/README.md`
- new `docs/handoffs/2026-10-10-claude-s11/lane-evidence-gaps-logs/README.md`
- changed `docs/handoffs/2026-10-10-claude-s11/lane-queue-perf-logs/README.md`
- changed `docs/handoffs/2026-10-10-claude-s11/lane-reviewA-2-logs/README.md`
- new `docs/handoffs/2026-10-10-claude-s11/lane-reviewB-1-logs/README.md`
- changed `docs/handoffs/2026-10-10-claude-s11/lane-reviewB-2-logs/README.md`
- new `docs/handoffs/2026-10-10-claude-s11/lanes/README.md`

