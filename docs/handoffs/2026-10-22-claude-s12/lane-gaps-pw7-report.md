# Lane claude_s12_pw7 report

## Status
PARTIAL (nothing run). Four Playwright specs (6 tests for AC-058/105/111 operations and the AC-273 journeys J3-J6) and three support
modules written; prettier --check clean, eslint exit 0 on all seven files, ad hoc tsc reports no error in them except the known
`Cannot find module 'node:crypto'` (no `@types/node` in this worktree; identical for every existing spec). Playwright, the stack and db
are not permitted to this lane, so every proposal citation is "pending root run". The four specs are NOT registered in the Playwright
configs (not in this lane's claim): see Requests to root. AC-273 stays partial (below). HEAD at start: 4f643787.

## Scope
pw7 of gaps-wave7: DEC-241 reading 6 (a mount-only page test does not close "consumed by ... at /app/..."): perform the operation from the
page for AC-058, AC-105, AC-111; then the AC-273 journeys pw5 could not drive: template, term merge, locale variant with `no_fallback`,
related content pinned and excluded.

## Per-row table (outcome: written = spec exists, pending root run)
| Criterion | Clause | Outcome | Identity (file > title) |
|---|---|---|---|
| AC-058 | 0: CMS-03C-04 consumed by CmsLocaleVariantForm at /entries/:entryId/locales/:locale | written: types a fr-FR title, presses Save translation, asserts the page's own POST (201, If-Match = entry version, next strong ETag), the result heading and row note, one committed `draft` variant (psql), and a fresh load starting from the stored translation | page-operations > `[P2-S12-AC-058] saves a translation from /entries/:entryId/locales/:locale: the command is sent, one draft variant is committed, and a fresh load shows the stored translation` |
| AC-105 | 0: CMS-03C-12 consumed by CmsPatternVersionDesigner at /patterns/new and /patterns/:patternKey | written (2 tests): /patterns/new (key, content type, block, props, Create draft: 201, ETag "1", DB `1:draft`, the page's link opens the successor page from version 1); /patterns/:patternKey (edit props, Save successor draft: If-Match "1", ETag "2", DB `1:draft,2:draft`, fresh load edits from version 2) | page-operations > `[P2-S12-AC-105] saves a first pattern version from /patterns/new: ...` ; `[P2-S12-AC-105] saves a successor version from /patterns/:patternKey: ...` |
| AC-111 | 0: CMS-03C-13 consumed by CmsPatternSelector in the instance-insert form at /entries/:entryId/composition | written: a pattern taken to `active` through the governed chain (first-party routes) is listed by the selector (the test pages the list until it appears), chosen, linked + slot `/`, Place pattern: POST 201 (If-Match = entry version, next ETag), heading "Pattern placed", row `/root1`, DB one linked active placement, fresh load lists the row | page-operations > `[P2-S12-AC-111] lists an active compatible pattern in the instance-insert form of /entries/:entryId/composition and places the pattern chosen there` |
| AC-273 | 0: end-to-end journeys (template) | written J3: template defined in the browser form (201, ETag "1"), submitted from its page, assigned, decided and scheduled in the browser by three people; a second template decided then activated and retired in the browser; identifier scan (person ids, content hash) over URLs, console, storage | template-journey > `[P2-S12-AC-273] J3 a template is defined, submitted, assigned, decided and scheduled in the browser by three people, and a second one is activated and retired` |
| AC-273 | 0 (locale variant with no_fallback) | written J4: page words the fallback-allowed rule vs the no-fallback rule, no source text for the legal field, "Missing ... publishing this language is blocked"; title-only save leaves it missing (DB variant holds the no_fallback field id); second save translates it | locale-related-journeys > `[P2-S12-AC-273] J4 a locale variant with a no_fallback block: ...` |
| AC-273 | 0 (related content pinned and excluded) | written J5: two pins reordered in the page and one exclusion saved (If-Match = entry version); DB pins in order + exclusion; a fresh load shows them | locale-related-journeys > `[P2-S12-AC-273] J5 related content is pinned and excluded from the entry page: ...` |
| AC-273 | 0 (term merged with convergence) | written J6: terms created in the browser form; an entry carries `brass` (assignment active); `brass` merged into `wind` in the browser (action, survivor, review, permanent confirmation); DB: merged + successor, retired assignment superseded, survivor assignment active, `cms_taxonomy_merge_work` = 0 | term-merge-journey > `[P2-S12-AC-273] J6 a term is merged into another in the browser and the entry that carried it converges: ...` |

Full titles are in `recite7/pw7-proposals.json` (extracted from the files). AC-273 proposal is `partial`; see Open items 1.

## Files (path, lines, SHA-256)
- tests/e2e/phase-02-slice-12-page-operations-real-route.spec.ts, 318, 775a29b83413e5db8b7212ddeaec65df27df8fd151f64f62769925ad5c4ea18a
- tests/e2e/phase-02-slice-12-template-journey-real-route.spec.ts, 161, 6903cf8b9fb9128af312585952a11a2853d22ef3720e7e26ba488e86156b4c5d
- tests/e2e/phase-02-slice-12-locale-related-journeys-real-route.spec.ts, 243, 1596e0598577bc763d1ad8011f94bdba45021336f06e71c94d2286ce1687c13d
- tests/e2e/phase-02-slice-12-term-merge-journey-real-route.spec.ts, 166, 441f252071a0d8ae6182611a02e4b0f8e997cac2299b9b03885a0d62619d5872
- tests/e2e/support/s12-pw7-world.ts, 164, 5c5c2efb52f4dc1840d14edcba9b5a502afc8e7fe1224684878fd54ffb76a013
- tests/e2e/support/s12-pw7-flow.ts, 270, a62cacc91c75fe75411d697205c586e3cd9a78c4a2e540d5ca1500ee1f385801
- tests/e2e/support/s12-pw7-tagged.ts, 180, 71a5de4601ede4d0abe7bf5e985dbc7fafd80440339ed3687e268418f56b2d38
- docs/handoffs/2026-10-22-claude-s12/recite7/pw7-proposals.json (final hash in the final message)
No existing file was edited. Scratch: `<scratchpad>/pw7/` (tsconfig + check script only).

## Runs
None (Playwright / stack / db not permitted). Static: prettier --check clean; eslint exit 0; ad hoc `tsc --noEmit` over the seven files: only TS2307 `node:crypto` in two support files.

## Test corrections
None. No existing assertion was touched; web7's concurrent edits (CapabilityGate for 403 in the locale/pattern/template status components,
`selectorUnverified` in the insert form) change denial paths and the submit-disabled rule only; every control and heading these specs use
is on a success path and is addressed by role and accessible name.

## Spec citations
FE03 :891 and :1073 (locale page), :883 and :1067 (pattern pages), :886, :1072, :1114, :1508 (composition insert form and selector),
:887 and :1071 (term actions, merge review), :890 (related content), :877/:1066/:1069 (governed panels, template pages); BE03c "Term actions
and merge convergence" (line 1546: up to 5,000 assignments converge in the merge transaction; retired id redirects), CMS-03C-04 etag rule
(old locale spec: first write ETag = entry version + 1), CMS-03C-12 (first version ETag "1", successor If-Match), CMS-03C-05
(`related-content` POST with If-Match = entry version), DEC-241 reading 6, DEC-226 rule 3.

## Open items / BOUNDARY
1. AC-273 is NOT closed. Still undriven (unchanged from pw5, none of it in the pw7 brief): a dependency invalidation returning a subject to
   draft, a linked pattern update accepted and detached, the protected decision inside a journey, a pattern scheduled, a pattern created
   and assigned in the browser, the "diff value" scan and telemetry capture beyond browser requests/URLs/console/storage. The proposal
   keeps `partial` and names these.
2. First-run risk (written blind, selectors follow component sources): (a) AC-058 asserts the initial status text "Untranslated" and J4
   asserts the exact resolution sentences ("Not translated yet. Readers see the en-US version ...", "Missing. This field never uses
   another language ...") which hold only if `cmsLocaleVariantRead` returns `localized_fallback` / `no_fallback_missing` for an entry with
   no variant; (b) J3's template form assumes CMS-03C-01 accepts the five fixed regions, no slots and no bindings from the browser (the
   API suite does) and that the template page carries the shared governed panel (`data-governed-lifecycle`); (c) J6 assumes CMS-03B-10
   commits the term assignment of a `tags` taxonomy value and that the merge select's option text contains the term key; (d) AC-111 relies
   on CMS-03C-02 accepting slot path `/` (the API placement suite does) and on the selector listing the freshly activated pattern.
   Each is an exact-label or exact-sentence adjustment, not a design problem.
3. J6 needs the content type's `tags` field to be a `taxonomy` kind with empty constraints and the vocabulary allowlist (`allowedTypeKeys`,
   `allowedFieldKeys: ['tags']`) to name it; written from `tests/postgrest/support/ev-ea-typed-support.ts`.
4. The convergence proof reads `platform_private.cms_taxonomy_merge_work(owner, term)` and `cms_term_assignments` through psql (local stack
   superuser). It proves the same-transaction convergence only; the `cms.taxonomy.merge_converge` job path beyond 5,000 assignments and the
   DEC-194 recovery sweep are database/worker concerns (race7 / existing pgTAP), not browser journeys.
5. Duplication to retire later: `s12-pw7-flow.ts` repeats the journey steps of `phase-02-slice-12-definition-journeys-real-route.spec.ts`
   (that file belongs to a finished lane) and `s12-pw7-world.ts` repeats the unexported `activateWithPolicy` of `s12-pw5-world.ts`. Root may
   point the older files at the new modules.

## Requests to root
1. Register the four new specs in `playwright.s09-real.config.ts` `testMatch` AND `playwright.config.ts` `testIgnore`:
   `phase-02-slice-12-page-operations-real-route.spec.ts`, `phase-02-slice-12-template-journey-real-route.spec.ts`,
   `phase-02-slice-12-locale-related-journeys-real-route.spec.ts`, `phase-02-slice-12-term-merge-journey-real-route.spec.ts`. They are
   order-independent (each makes its own types, patterns, vocabularies and entries); none relies on fixture state of another spec.
2. Run (project `real-route-chrome`, one worker, stack up and reset, `pnpm db:start && pnpm db:reset` first):
   - page-operations: `[P2-S12-AC-058] saves a translation from /entries/:entryId/locales/:locale ...`; `[P2-S12-AC-105] saves a first pattern version from /patterns/new ...`; `[P2-S12-AC-105] saves a successor version from /patterns/:patternKey ...`; `[P2-S12-AC-111] lists an active compatible pattern in the instance-insert form of /entries/:entryId/composition and places the pattern chosen there`
   - template-journey: `[P2-S12-AC-273] J3 ...`
   - locale-related-journeys: `[P2-S12-AC-273] J4 ...`, `[P2-S12-AC-273] J5 ...`
   - term-merge-journey: `[P2-S12-AC-273] J6 ...`
   Exact titles: `recite7/pw7-proposals.json` (`add[].title`).
3. Add module-map lines to `tests/e2e/support/README.md` for `s12-pw7-world.ts` (subject submit, mixed-locale type), `s12-pw7-tagged.ts` (tagged type, tag
   vocabulary, tagged entry, template via API) and `s12-pw7-flow.ts` (journey cast and the browser steps of a governed review). Existing file, outside claim.
4. After a run, cite per `pw7-proposals.json`; keep AC-273 `partial` (Open items 1).

## Proposals
docs/handoffs/2026-10-22-claude-s12/recite7/pw7-proposals.json (status "pending root run" on every citation).

## Fix round
Root's gate (`.lane-logs/canonical/e2e-20261029T130804Z/e2e.log`): 6 of my 8 tests passed (AC-058, AC-111, J3, J4, J5, J6); the two AC-105
page-operation tests failed. The other two failures in that log (`template-states` AC-042 render: status text now reads "version 5, based on
version 4"; AC-164 403: the alert is no longer focused, web7's CapabilityGate) are pw5 specs, not mine, and look like web7 product changes
that the pw5 oracles must follow; I did not touch them.

**Cause: my world, not a product regression.**
1. Failure 1 (`/patterns/new`, `Node 1 block` never selectable, "did not find some options") and failure 2 (`/patterns/:patternKey`, the Save POST
   never sent) share one cause: the designer's block chooser is `context.registeredBlocks` (`load-pattern-designer-page.ts:172`, listed in
   `CmsPatternNode.tsx:52-57`), and that comes from `platform_private.cms_template_context`, which lists only blocks with
   `block_row.owner_id = acting_party_id` (`supabase/migrations/20261013100500_cms_template_context_rpc_flag.sql` lines 99-111). The block
   registry is unique globally by (block_key, block_version) (`20260902080000_content_schema_registry_authority.sql:1463`) and
   `registerLatencyBlock` registers the fixed pair `s12lat.block@1` once per database, returning early when ANY owner holds it
   (`tests/postgrest/support/phase-02-slice-12-latency-blocks.ts:42-47`; its comment "no 03c reader scopes a block by owner" is wrong for this
   read). In the gate's database the pair was held by another owner, so CMS-03C-12 still accepted my API-defined pattern (it resolves blocks
   globally; test 2's setup passed), but this world's chooser listed no block: test 1 had no option to select, and in test 2 the loaded node's
   block showed as "no longer registered" (`CmsPatternNode.tsx:94-98`), so the form's validation withheld the POST and `waitForResponse` waited
   out the test.
2. Not web7's changes: the pattern-designer diffs (`use-pattern-conflict.ts`, `use-pattern-designer.ts`, `CmsPatternVersionDesigner.tsx`)
   concern the conflict/latest re-read state (`blocked` also while `checking`/`failed`); at first load the conflict state is idle and the select
   is never gated by it. The error context in `test-results/...` is a stale page from an earlier test and carries no designer snapshot, so the
   diagnosis rests on the source and the log, not on a snapshot; root can confirm with
   `select owner_id from platform_private.cms_block_definition_versions where block_key = 's12lat.block'` (expected: not the S10 world owner).

**Fix (my files only).** New `tests/e2e/support/s12-pw7-block.ts`: registers, through the production signed release route as the world owner, a
block with a key unique to the run (`s12pw7.b<8 hex>`), cached per acting party, plus `definePatternWithBlock` (CMS-03C-12 over that block). The
two AC-105 tests now use it: the page-operations spec registers the block in `beforeAll`; test 1 asserts the chooser option is present
(`option[value="<key>@1"]`, count 1) before selecting, so an owner-scoping miss fails in seconds with a named cause; test 2 builds its
pattern with the owned block, asserts the `Node 1 block` select holds it, and edits the `pw7 successor base` props. AC-111 (which passed) still uses
`definePatternViaApi` (the selector read is not owner-scoped) and is unchanged. `registerLatencyBlock` and the latency imports are gone from the
spec's `beforeAll`.

Files changed (prettier clean, eslint 0, ad hoc tsc: only the missing Node typings `node:crypto`/`Buffer`):
- tests/e2e/phase-02-slice-12-page-operations-real-route.spec.ts, 329, ed3c39fe859cba88b8dd02591cf3df8d49d688b17824a0e0cca4483a8ecc1181
- tests/e2e/support/s12-pw7-block.ts (new), 217, 7839fad94febfae9a25425f9661f5543c021535c773a36844ee1eaca5016dacb
- docs/handoffs/2026-10-22-claude-s12/recite7/pw7-proposals.json (line references and evidence text for AC-105 successor and AC-111 updated)
Unchanged since the first report: the other three specs and `s12-pw7-world.ts`, `s12-pw7-flow.ts`, `s12-pw7-tagged.ts`.

Rerun: only `phase-02-slice-12-page-operations-real-route.spec.ts` (the two AC-105 tests are the changed ones; the other three of its tests are
unchanged apart from the `beforeAll`). Register nothing new. The same wrong assumption is latent in
`s12-pw5-world.ts definePatternViaApi` for any pw5 test that SELECTS a block in the form; none of the passing pw5 tests does.
