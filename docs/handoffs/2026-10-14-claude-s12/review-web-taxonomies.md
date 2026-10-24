# Review: claude_s12_web_taxonomies (independent, adversarial)

Reviewer: independent (did not author). Date 2026-10-15. Worktree HEAD `b16edb54`. Read-only except this file.
Target report `lane-web-taxonomies-report.md` SHA-256 `65c9bf06…e3fc`: matches.

## Claims re-verified
- 98/98 files in the report: line counts and SHA-256 match. No lane file is missing from the report.
- Focused Vitest (my run, quiet lock, pinned PATH): 32 lane test files, 564 tests, all pass.
- `astro check` (my run): 1 error, in `src/components/cms-related-content/related-content-request.test.ts:8`
  (another lane's RED test, not the file the author named). 0 errors in lane files. One hint: unused `React`
  import in `CmsGovernedTaxonomyPanel.test.tsx:2`.
- Step-up inventory: all 10 `NO_STEP_UP_ROW` entries are correct. BE03c 216 says the create (CMS-03C-16),
  selector (-17) and term (-03) commands need no recent MFA, and BE03c 1314 has no `STEP_UP_REQUIRED` for
  those operations or the two reads. An upstream 401 `STEP_UP_REQUIRED` fails the catalog code check and
  becomes a 502 (`cms-taxonomy-platform-errors.ts:66-73`).
- Test-file splits: I compared the 3 server originals kept in the author's scratchpad against their splits.
  Test titles are identical (22/13/14) and so are the `expect(` counts (56/54/40). The designer and term-form
  splits kept no original copy, so I could not verify them.
- Mutation claim: `mutate.py` holds exactly 36 mutants, all in the loader, the panel and the two pages; none
  touch the proxies, transports, designer or term form. Mutant #1 (probe id changed to a valid v4 id) was
  "killed" only by the literal pin at `load-taxonomy-page.test.ts:75`. That mutant is the fix for B1 below,
  so the test currently protects the defect.
- Zero zod in islands: I walked the static import closure of the 3 islands myself: 73 files. The only
  contract import is `@wejammin/contracts/client`. The lazy validators are reached only through dynamic
  `import()` in the shared governed-review components (existing precedent). Drift guards:
  `taxonomy-vocabulary.test.ts`, `taxonomy-static-closure.test.ts`.
- Proxies: same-origin check, CSRF double submit, strict read admission, `no-store`, catalog-only relay
  (code and message must both match, else 502), and `retryable: true` on 502/503/504 (BE00 172) are all
  present and tested. A 403 publishes only the operation's own 403 token, which is `capability_missing` for
  every taxonomy operation. `CAPABILITY_REQUIRED`, `separation_of_duties` and untyped 403s relay `{}`
  (errors.test :113-125), the same as the hardening-4 precedent.
- Components ≤200 lines; lib ≤300 lines; tests ≤400 lines; a README exists in every directory with more than 2 files.

## Route registry / spec clauses
| Clause | Implemented | Tested |
| --- | --- | --- |
| CMS-03C-16 POST versions | `server/cms-taxonomy-platform-write.ts`, `api/.../taxonomies/versions.ts` | write.test, routes.test, designer tests |
| CMS-03C-17 GET selector | `cms-taxonomy-platform-read.ts:207` | read-selector.test (no browser consumer; out of scope) |
| cmsTaxonomyVersionsRead | `cms-taxonomy-platform-read.ts:122` | read-versions.test |
| cmsTaxonomyTermsRead | `cms-taxonomy-platform-read.ts:155` | read-terms.test (no test of the 256 KiB response bound, BE03c 407) |
| CMS-03C-03 term actions | `cms-taxonomy-platform-term-action.ts` | term-action(+upstream).test |
| FE03 :1068 `/new` curator gate | `load-taxonomy-page.ts:154` | mocked only. **Broken against the real producer (B1)** |
| FE03 :1068 `/:id` 303/400/404/403, active-only actions | loader + term form | loader.test (mocked edge), TermForm.test :119 |
| FE03 :886 designer | designer dir | designer tests |
| FE03 :887 term list, merge redirect | term-terms dir | TermForm tests :66, actions :189 |
| FE03 :887 `canonical_overlap` copy + copyable id; `taxonomy_not_active` review link after a refusal | `CmsTaxonomyTermStatus.tsx:115-133`, `term-status-copy.ts` | **none (M2)** |

## Findings
- `components/cms-taxonomy-pages/load-taxonomy-page.ts:41,158-163` — **blocker** — `/taxonomies/new` never
  renders the form for a verified curator. The nil id `00000000-0000-0000-0000-000000000000` passes zod 4.4.3
  `z.uuid()` (checked: true), so the Web proxy and Worker forward it. The SQL producer
  (`20261014030400_cms_list_taxonomy_versions.sql:52-60`) checks curator capability first, then rejects the
  id with `cms_valid_uuid`, whose regex requires version nibble `[1-8]`
  (`20260902080000_content_schema_registry_authority.sql:195`), and raises `INVALID_REQUEST`. A curator
  therefore gets 400 (or 500), never 404. The loader turns any non-404 into a notice, so every curator sees
  "Invalid request". The only nav entry ("Vocabularies") points at `/new`, and `/:taxonomyId` is reachable
  only from a create result, so the whole vocabulary surface is unreachable. The pgTAP versions-read tests
  (070-versions-read) cover absence only with a v4 id. The loader test stubs `failure(404)`
  (`load-taxonomy-page.test.ts:56`): the mock returns the answer the code hopes for. Fix direction: see
  "Request 1" below. Also add a guard that checks the probe id against the `cms_valid_uuid` grammar read
  from the migration, and delete the literal pin at test :75.
- `components/cms-taxonomy-terms/CmsTaxonomyTermForm.tsx:131-147` vs `load-taxonomy-page.ts:136-143` —
  **major** — The filter is a native GET form. Choosing "All terms" (`value=""`, pinned by TermForm.test
  :150-154) and pressing "Apply filter" submits `?lifecycle=`. The loader rejects an empty lifecycle as a
  400 "address could not be read". Every user who widens the filter back to all terms hits an error page.
  Fix direction: either have the loader treat an empty `lifecycle` as absent, or drop the name on the empty
  option. Add a composed test (form serialization → loader).
- `components/cms-taxonomy-terms/CmsTaxonomyTermStatus.tsx:115-133`, `term-status-copy.ts` — **major (test)**
  — Two FE03 :887 clauses named in the brief have no rendering test: the `canonical_overlap` copy with the
  copyable canonical id (`CmsTaxonomyCanonicalId`), and the `taxonomy_not_active` refusal linking to the
  governed review. `failureCopy`/`failureHeading` have zero tests. Deleting the canonical-id render, the
  review link or any copy line survives the suite (only `term-action-submit.test.ts` covers parsing).
  Fix direction: one TermForm test per refusal kind (`refused` ×4, `conflict`, `uncertain`, 401, 429).
- `lane-web-taxonomies-report.md` "Open items" and `components/cms-taxonomy-pages/README.md:21-23` —
  **minor** — Both state facts that are false. The probe "costs one read from the 120/240 per minute versions
  quota": the versions read is 60/user and 60/party (BE03c 166, `taxonomy-rpc-table.ts:76-79`). 120/240 is
  the terms read. The README also says a verified curator is answered 404, which B1 disproves. Fix direction:
  correct both.
- `load-taxonomy-page.ts:218-225` — **minor** — A terms 409 always redirects to `basePath[?lifecycle=]`.
  If an upstream 409 ever arrives on a request with no cursor, the redirect target is the same URL, so the
  page loops on 303s. Fix direction: redirect only when `query.cursor !== null`; otherwise show the failure.
- `CmsTaxonomyTermAction` survivor picker (`terms={list.page.items}`) — **minor** — A merge survivor can be
  chosen only from the loaded page (≤25 terms), so merging into a term on another page is impossible.
- `taxonomy-terms-read.ts`, `taxonomy-versions-read.ts` — **minor** — No automatic 502/503/504 retry
  (FE03 :1173, at 250 ms and 750 ms). The Slice 12 designers (precedent) also lack it; the degraded state
  plus a manual refresh exists.
- `load-taxonomy-page.ts:247` — **minor** — The `active` version is searched only in the newest 50 versions
  (BE03c 406). A vocabulary with more than 50 newer versions would show "no active version" and block term
  actions. This is an edge case; note it in the README or cite the spec bound.
- `CmsGovernedTaxonomyPanel.test.tsx:2` — **nit** — unused `React` import (astro check hint ts6133).

## Request 1: nil-lineage probe for the `/new` curator gate
- **No spec-named curator read exists.** The curator-gated reads are `cmsTaxonomyVersionsRead` and
  `cmsTaxonomyTermsRead`; both need a lineage id. CMS-03C-17 checks a different capability (author/editor),
  and CMS-03C-16 has side effects. A probe read is precedented: `probeCmsCapabilityGrantOwner` gates the
  owner nav in `index.astro`.
- **Side effects:** SQL "writes and locks nothing". Only the rate counters move.
- **Concealment:** an absent id discloses nothing, so the probe is concealment-safe.
- **Rate budget:** the probe takes 1 of 60/min per user and 1 of 60/min per **party**. That party budget is
  shared with every `/:id` view and every in-page versions re-read (conflict check, panel re-read, term-list
  refresh). Several curators in one party can reach a 429.
- **What 404 means:** the Worker checks curator capability on the session before the port
  (`taxonomy-definition-shared.ts:213-226`), so 404 means "session curator". SQL can also answer NOT_FOUND
  for a non-visible tenant (line 49-51). The CMS-03C-16 write still authorizes, so rendering the empty form
  in that case is harmless.
- **As written the probe does not work (B1).**
- **Option A (recommend now):** keep the probe and use a reserved RFC 4122 v4-shaped id such as
  `00000000-0000-4000-8000-000000000000`. It passes `cms_valid_uuid`, `gen_random_uuid()` never produces it
  in practice, and a curator gets 404. Add the grammar drift guard and a Worker-level test that a curator
  gets 404 for that id.
- **Option B (follow-up, owner/root decision):** ask BE03c for a `cmsTaxonomyContextRead` (curator-gated, no
  id), on the model of `cmsTemplateContextRead`. It would also serve canonical provider availability, which
  today is a code-owned mirror (`taxonomy-vocabulary.ts:37-53`, FE03 :886).
- **Option C (reject):** check the session only and let CMS-03C-16 answer 403. This contradicts FE03 :1068,
  which requires `cms.taxonomy_curator`.

## Not verified
Designer and term-form test-split parity (no originals were kept); a browser or E2E run; the composition
through a real Worker.

VERDICT: BLOCK
