# Re-review: claude_s12_web_taxonomies, fix pass 1 (independent, adversarial)

Reviewer: independent (did not author). 2026-10-15, worktree HEAD `b16edb54`. Read-only except this file.
Target `lane-web-taxonomies-report.md` SHA-256 `2767ceef…311979b`: matches. Brief `briefs/web-taxonomies-f1.md`,
BLOCK review `review-web-taxonomies.md`.

## Claims re-verified
- Focused Vitest (13:00Z, quiet lock, pinned PATH; taxonomy dirs, governed panel, `lib/safe-read-retry`, server
  taxonomy, API routes): 37 files, 622 tests, all pass. 13:08Z: step-up inventory, island static closure, taxonomy
  pages, retry tests: 5 files, 87 tests, pass. No skipped or todo tests.
- Loader split: 33 (`load-taxonomy-page.test.ts`) + 11 (`.new.test.ts`) = 44, as claimed. Title-level parity cannot be
  checked: no copy of the 474-line pre-split file was kept.
- `astro check` (13:02Z): 1 error, `cms-related-content/related-content-page-reads.test.ts:25` (another lane);
  0 errors, warnings or hints in lane files. The unused `React` import is gone.
- Fix-pass file table: 22/24 match on lines and SHA-256. `lib/safe-read-retry.ts` (now 113 lines) and its test
  (227 lines) were changed at 13:03Z, after this report, by another lane: rate-limit helpers were added, and
  `cms-editorial/*-transport.ts` now import the file. Lines 16-57 (the retry) are unchanged apart from the doc comment.
  Root: this is now a shared file, so review both lanes' changes together.
- 96 of the 98 pass-0 files are unchanged. `step-up-required.inventory.test.ts` and `server/README.md` changed, but
  the new rows belong to other lanes (pattern, related-content, governed-review). The 10 taxonomy `NO_STEP_UP_ROW`
  rows are intact.
- Quotas: versions read 60/user, 60/party; terms read 120/240 (BE03c 166-167, Worker `taxonomy-rpc-table.ts`).
  The report and `cms-taxonomy-pages/README.md` now say the same.

## Blocker B1: closed
- `TAXONOMY_PROBE_ID = 00000000-0000-4000-8000-000000000000` (`load-taxonomy-page.ts:47`) matches
  `cms_valid_uuid` `^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$` (`20260902080000…:195`,
  the only definition in `migrations/` and `migrations-wip/`). It also passes `CmsLineageIdSchema` (= `z.uuid()`).
- The guard really reads the migration (`.new.test.ts:17-34`: `readFileSync` of the SQL file, then extracts the
  `cms_valid_uuid` body and its `p_value ~ '…'`). No copy of the regex exists. The relative path resolves to the repo root.
- The literal pin is gone. `it.each([400, 500])` asserts a notice, and `loadNew:176` sends every non-404 to
  `failureOutcome`.
- Is the stub faithful? Partly. `curatorProducer` (`.new.test.ts:41-44`) models only the steps after the curator
  check: the grammar check, then 404 for an absent lineage. It returns 404 for any id that passes the grammar. It
  does not model the SQL's earlier steps (`cms_list_taxonomy_versions.sql:49-55`): an invisible tenant is NOT_FOUND
  before the capability check, then `capability_missing`. The doc comment at :37-38 claims "capability first", which
  the stub never performs. That gap is acceptable: the 403 path has its own test (`failure(403)`), and the Worker
  checks `cms.taxonomy_curator` on the session before the quota and the port (`taxonomy-definition-shared.ts:213-226`),
  so a 404 still implies a session curator. Not verified: the real composition (page reads → Web proxy → Worker → SQL)
  for this id. The Worker test is outside this lane's scope (the author recorded it as an open item).

## Earlier findings: status
| Finding | Status | Evidence |
| --- | --- | --- |
| Empty `lifecycle` ("All terms") | closed | `termListQuery:148-149`. Composed test `taxonomy-filter-roundtrip.test.tsx` serializes the real GET form with `FormData` and loads it. `?lifecycle=&lifecycle=active` is still 400 |
| Refusal rendering per kind | closed | `refusals.test.tsx`: canonical_overlap shows the domain, the copyable `<code>` id, no link, copy success and copy failure; `taxonomy_not_active` links `REVIEW_HREF`; also canonical_source_unavailable, capability_missing, conflict, uncertain, 401 with `returnTo`, 429 with and without a wait, 503. `term-status-copy.test.ts` pins the exact strings |
| 409 with no cursor | closed | `:233` adds `query.cursor !== null`. Tests cover `''`, `?lifecycle=merged` and `?lifecycle=` (notice 409) and the three cursor cases (redirect) |
| Survivor/parent picker | closed, with a new defect (N1) | `use-term-choices.ts` uses the same-origin terms proxy, limit 50, paging by cursor. 409 restarts the list; a failure offers "Try again". Nothing is read when the page is complete. Native named button |
| FE03 retry | closed | `lib/safe-read-retry.ts` retries only 502/503/504 that declare `details.retryable === true`, after 250 ms then 750 ms (same relative sleeps as the `content-schema-registry-runtime-read.ts:79` precedent), then returns the last answer, which shows the degraded state. Wired into both reads. Fake-timer tests check 249 ms (1 call), 250 ms (2), 999 ms (2) and 1000 ms (3) |
| Newest-50 message | closed | `versionsBounded` (`:279-281`, `>= 50`). The term form message cites BE03c 406 (verified: line 406 of the cmsTaxonomyVersionsRead row). Covered by loader tests at 50, 49 and active-inside, plus `.active.test.tsx` |
| README/report errors, unused import | closed | see above |

## Mutation sample (mine, 16 mutants; a scratch Vite `load` hook serves each mutant, so the worktree is untouched; baseline no-op passed 130/130)
All 16 were killed by the named new test:
- Loader: treat 400/500 as a curator pass; nil probe id (killed by both the guard test and the composed test); revert
  the empty-lifecycle change (killed by the round-trip test alone); drop the cursor guard on 409; change `>=50` to `>50`.
- Status: drop the canonical-id render; point the review link elsewhere.
- Retry: delays `[250,500]` (killed by the lib tests, and separately by the taxonomy read tests); change
  `retryable === true` to `!== false`; retry every `>= 500`; unwrap `retryingSafeRead` in the terms read.
- Picker: drop `pageComplete`; concatenate without de-duplicating; drop `query.lifecycle === null` from
  `pageComplete`; delete the focus return.

This agrees with the author's battery. No test oracle was weakened. The only edited assertion gained
`versionsBounded: false`.

## New findings
- `cms-taxonomy-terms/CmsTaxonomyTermChoice.tsx:41,56-63` — **major** — Pressing "Load more terms" on any page
  except the last drops keyboard focus to `<body>`. The button is unmounted while `status === 'loading'` and
  re-mounted after the load. Focus goes back to the select only when the last page loads (`:33-37`). The same
  happens to "Try again". I reproduced it with a scratch jsdom probe over 3 pages: after page 2,
  `document.activeElement` is `BODY`. This fails WCAG 2.4.3, which is inside the FE03 :28 WCAG 2.2 AA baseline, and
  it contradicts the `<ActionBar>` rule at FE03 :898 ("stable pending label … focus returns to trigger"). Brief
  item 5 asked for keyboard operability, but `choices.test.tsx:125` checks focus only for the last page. Fix
  direction: keep the button mounted with a stable pending label (use `aria-disabled`, not `disabled`). Otherwise,
  return focus to the button when more pages remain, and to "Try again" after a failure. Add a 3-page test that
  asserts `activeElement` after the intermediate page.
- `cms-taxonomy-terms/use-term-choices.ts:84-86,130` — **minor** — The scenario: a survivor is chosen from a loaded
  page that the page itself does not hold, then a later "Load more" gets a 409 restart. The chosen term drops out of
  the choices, because `eligibleTerms` keeps chosen terms only from the page's own list. `form.survivorId` keeps the
  hidden choice, so `survivor` becomes null, and `CmsTaxonomyTermConfirm:34` then shows the irreversible merge step
  without the "Merge X into Y" consequence. Fix direction: also keep chosen terms from the previously loaded items,
  or clear the choice on restart. Either way, refuse the confirm step while the survivor is unresolved.
- `load-taxonomy-page.ts:43`, `cms-taxonomy-pages/README.md` — **nit** — Both say the grammar guard is in
  `load-taxonomy-page.test.ts`. After the split it is in `load-taxonomy-page.new.test.ts`.
- `CmsTaxonomyTermForm.refusals.test.tsx` (503 "keeps the entries"; 429) — **nit** — The 503 test title promises
  more than it checks: neither test asserts that the typed inputs survive, although FE03 requires that a 429
  "preserves input".
- `lib/safe-read-retry.ts:16` — **nit** — `SAFE_READ_RETRY_DELAYS_MS` is also exported by
  `infrastructure/jobs/job-polling.ts:19`. Consolidate later. The `:1173` citations are correct against HEAD
  (uncommitted FE03 edits in the worktree move the line to 1175).

## Not verified
- The real Web → Worker → SQL composition of the probe (no services).
- Browser/E2E runs.
- eslint/prettier (outside the allowed execution).
- Title-level parity of the loader test split.

VERDICT: PARTIAL
