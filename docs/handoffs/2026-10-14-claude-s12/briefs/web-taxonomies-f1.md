# Lane brief — `claude_s12_web_taxonomies_f1` (Web taxonomies fix pass; review VERDICT BLOCK)

Review `review-web-taxonomies.md` (SHA `7879d828…`). Fix every finding, each RED first where behaviour is involved
(run the failing test, see it fail for the right reason, then fix). Report: append `## Fix pass 1` to
`lane-web-taxonomies-report.md`.

1. BLOCKER — `/taxonomies/new` curator gate (`load-taxonomy-page.ts:41,158-163`): root rules Option A. Probe
   `cmsTaxonomyVersionsRead` with a fixed reserved id that passes the SQL `cms_valid_uuid` grammar (version nibble
   1-8, variant 8/9/a/b), e.g. `00000000-0000-4000-8000-000000000000`. Add a guard test that READS the regex from
   `supabase/migrations/20260902080000_content_schema_registry_authority.sql` (~:195) and asserts the probe id
   matches it (so a future change of either fails the test), delete the literal pin at test :75, and make the
   loader test drive the real classification instead of stubbing the hoped-for 404 (assert 400/500 from the probe
   is NOT treated as a curator pass). Name the probe id as a constant with a comment citing BE03c (no spec-named
   curator read exists; BE00 checks session and capability before lookup).
2. MAJOR — "All terms" filter: an empty `lifecycle` is treated as absent (or the empty option carries no name);
   add a composed test (form serialization → loader).
3. MAJOR test gap — one TermForm rendering test per refusal kind (`refused` ×4 incl. `canonical_overlap` with the
   copyable canonical id and `taxonomy_not_active` linking to the governed review, `conflict`, `uncertain`, 401,
   429), and unit tests for `failureCopy` / `failureHeading`. Show by mutation (scratch copy) that deleting the
   canonical-id render or the review link now fails.
4. Terms 409 without a cursor must not redirect to the same URL: redirect only when `query.cursor !== null`,
   otherwise show the failure; test both.
5. Merge survivor picker must reach every term of the vocabulary, not only the loaded page: page through
   `cmsTaxonomyTermsRead` (cursor) from the picker via the existing same-origin terms proxy; keyboard operable;
   test.
6. FE03 :1173 automatic retry of a 502/503/504 read at 250 ms and 750 ms (then the degraded state) for the
   taxonomy reads (`taxonomy-terms-read.ts`, `taxonomy-versions-read.ts`); test with fake timers. If a shared
   retry helper exists in `apps/web/src`, reuse it; otherwise put one in `apps/web/src/lib/` for the next lane to
   reuse (the pattern/template designers have the same gap: report it, do not edit them).
7. The newest-50 bound on finding the `active` version: cite BE03c 406 in the README and render an explicit
   message when no active version is among them.
8. Minors: correct the quota (versions read 60/user, 60/party; terms read 120/240) and the 404 statement in the
   report and `components/cms-taxonomy-pages/README.md`; remove the unused `React` import in
   `CmsGovernedTaxonomyPanel.test.tsx`.
Files: the lane's own files (`components/cms-taxonomy-*/**`, `pages/app/cms-content-modeling/taxonomies/**`,
`server/cms-taxonomy-platform-*.ts`, `pages/api/v1/cms/taxonomies/**`), a new `apps/web/src/lib/` retry helper
(+test, README line) if none exists. NOT `components/cms-governed-review/**` (DEC-191 phase 2 lane), NOT related
content files, no Worker/SQL/contracts. Gates: focused + full `apps/web` Vitest, `astro check`, eslint
`--max-warnings=0` + prettier, mutation checks on scratch copies under `<scratchpad>/claude_s12_web_taxonomies_f1/`,
under `flock -s /tmp/wejammin-quiet.lock`.
