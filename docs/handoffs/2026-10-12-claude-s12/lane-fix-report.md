# Slice 12 lane FIX (shipped-route drift) report

Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, branch `claude/phase2-slice12`, HEAD at start `d616ebbb`
(nothing committed by this lane). Logs are under `.lane-logs/` of the worktree (`alt-tap-*.tap` are the pgTAP TAP files,
`fix-*.log` are vitest, Playwright and lane-runner logs).

## Summary

| Item | Result |
| --- | --- |
| 1. Template keys per owner (E13, E14, E4) | migrations `20261013100000` to `100200`, pgTAP 93 tests + 24-test populated witness, GREEN |
| 2. Error mapping to `DEPENDENCY_UNAVAILABLE` | 5 Worker modules, 4 web relays, 1 browser mapper, 42 new tests, GREEN |
| 3. Template page 400 | `[templateKey].astro`, Playwright 4/4 GREEN (3 were RED) |
| 4. Real-composition apispecs | 3 files, 27 tests, GREEN; they found a real defect (both template reads were broken over the real API, fixed by `100300`/`100500`) |
| Extra (forced by the L0 contract) | `templateId` (CMS-03C-01 and latest read), `staleFieldIds` (CMS-03C-04), proxy local 422 pointers |
| Full pgTAP suite, final migrations | 375 files, 14185 tests, PASS (`.lane-logs/alt-tap-003554-3593551.tap`) |

## Files changed

Migrations (new, range `20261013100000`-`20261013109999`):
`supabase/migrations/20261013100000_cms_template_per_owner_keys_lineage.sql`,
`20261013100100_cms_template_manifest_audience_grammar.sql`, `20261013100200_cms_define_template_per_owner.sql`,
`20261013100300_cms_template_latest_lineage.sql`, `20261013100400_cms_locale_variant_stale_field_ids.sql`,
`20261013100500_cms_template_context_rpc_flag.sql` (section added to `supabase/migrations/README.md`).

pgTAP (new): `supabase/tests/phase_02_slice_12_fix_template_per_owner.sql`, `..._fix_template_key_audience.sql`,
`..._fix_template_populated.sql`, `..._fix_locale_stale_field_ids.sql`, `..._fix_template_reads_rpc_context.sql`,
`supabase/tests/phase_02_slice_12_fix/{000-owners.sqlinc,README.md}`.

Worker: `apps/worker/src/cms-composition/{template-shared,pattern-instance-contracts,taxonomy-contracts,locale-routes-support,related-content-response,template-respond}.ts`,
new `apps/worker/src/cms-composition-production-template-errors.ts`, `apps/worker/src/cms-composition-production.ts` (one call site).

Web: `apps/web/src/server/cms-composition-platform-{mutation,locale,related,pattern}.ts` (code table), `cms-composition-platform-mutation.ts`
(typed reason, local 422 pointers), `apps/web/src/components/cms-composition/cms-template-designer-submit.ts` (code table),
`apps/web/src/pages/app/cms-content-modeling/templates/[templateKey].astro` and its `README.md`.

New tests: `apps/worker/src/cms-composition/phase-02-slice-12-dependency-unavailable.test.ts`,
`apps/worker/src/cms-composition/phase-02-slice-12-template-key-audience.test.ts`,
`apps/worker/src/cms-composition-production-template-errors.test.ts`,
`apps/web/src/server/cms-composition-platform-mutation-key-reserved.test.ts`,
`tests/contracts/phase-02-slice-12-fix-template-witness-parity.test.ts`,
`tests/postgrest/phase-02-slice-12-{template-version,template-reads,locale-variant}.apispec.ts`,
`tests/postgrest/support/phase-02-slice-12-{composition-stack,locale-world}.ts` (README entries in `tests/postgrest/README.md`, `support/README.md`).

## Item 1: template keys per owner (BE03c E13, E14, E4; DEC-186 item 6)

Spec lines: BE03c "Reserved keys (E13)", "Per-owner uniqueness (E14)", the TemplateVersion row (`template_id`, `UNIQUE(owner_id, template_key,
version)`, `UNIQUE(template_id) WHERE state='active'`, audience CHECK, key CHECK), CMS-03C-01 row, FE03/IA03 via the ledger gaps AC-005,
AC-006, AC-022, AC-025, AC-166, AC-167, AC-189 to AC-192.

RED (before any migration): `.lane-logs/alt-tap-235254-3348164.tap` (key/audience file: 53 tests, 35 failed) and
`.lane-logs/alt-tap-235345-3352148.tap` (per-owner file: 40 tests, 19 failed). Right reasons, e.g. `E14: owner B defines version 1 of the SAME
key without a conflict` have `P0001` want `00000` (the live cross-owner CONFLICT signal), the reserved-key and audience RPC cases wrote rows,
the catalog assertions found the global unique and no `template_id`.

Change: see "Migrations" in the file list. Design points:
- the key is unique per owner; the previous-version lookup in `cms_define_template` is owner-scoped, so a key another owner holds is neither
  a CONFLICT (first create) nor distinguishable from an unused key (successor: NOT_FOUND with identical SQLSTATE, message, DETAIL);
- E13: dedicated CHECK `cms_template_versions_template_key_not_reserved` + RPC token `key_reserved` (DETAIL `["/templateKey"]`), raised before any
  lookup; E4: dedicated CHECK `cms_template_versions_audience_grammar` + `cms_template_manifest_valid` + RPC `VALIDATION_FAILED` (DETAIL
  `["/audience"]`);
- lineage: `template_id` backfilled (recursive CTE over `supersedes_id`) then NOT NULL, folded into the existing `cms_template_versions_guard()`
  (no new trigger, so the AC215 trigger inventory of 134 is unchanged); the response and the latest read answer `templateId`; a stored idempotent
  response from before this deploy is completed on replay;
- populated tables: both CHECKs are `NOT VALID`, validated only when no row violates them; the definition CHECK is paused around the backfill
  UPDATE (it is re-evaluated on updated rows) and restored; the guard function moves to the definer role (SEC-2 catalog test).

GREEN: `.lane-logs/alt-tap-235507-3357805.tap` (93 tests, both files) on the first migration shape; after folding the lineage trigger into the
guard (the AC215 inventory test failed with a 135th trigger, `alt-tap-235751-3369880.tap` test 448) the final shape is covered by the full-suite run
below. Populated witness: RED `.lane-logs/alt-tap-000719-3416816.tap` (`ERROR: new row for relation "cms_template_versions" violates check
constraint "cms_template_versions_definition_valid"` during the backfill UPDATE of a legacy row: a defect the fresh-reset gates cannot see),
GREEN `.lane-logs/alt-tap-000924-3430640.tap` (24 tests: 7 legacy rows in 4 lifecycle states, two legacy violators stay NOT VALID, new rows are still
refused, legacy violators cannot advance). The witness replays the text between `BEGIN/END FIX-TEMPLATE-LINEAGE-DDL` verbatim; the vitest
`tests/contracts/phase-02-slice-12-fix-template-witness-parity.test.ts` (`.lane-logs/fix-green-parity.log`, 1 test) fails if the copies differ. I could not
run `supabase migration up` against a populated database (forbidden outside the runners); the replay is the witness.

Full suite after the final shape: see "Full pgTAP" below.

## Item 2: DEPENDENCY_UNAVAILABLE (BE03c catalog, DEC-186 item 7, DEC-172 pattern)

RED: `.lane-logs/fix-red-dep-2.log` (new `phase-02-slice-12-dependency-unavailable.test.ts`: 42 tests, 28 failed; every failure
`code: DEPENDENCY_INVALID_RESPONSE` (502) or `DEPENDENCY_DEADLINE_EXCEEDED` (504) where `DEPENDENCY_UNAVAILABLE` is required, on all seven
surfaces: CMS-03C-01, context read, latest read, CMS-03C-02, -03, -04, -05; 503 and the thrown port already passed).
Change: `ERROR_CODES[502]` and `[504]` are `DEPENDENCY_UNAVAILABLE` in the five Worker modules, the four web relays and the browser submit mapper.
Message stays `{CODE}: {operation} operation rejected or unavailable.`; details stay `{dependencyClass: cms_composition, retryable}`.
GREEN: `.lane-logs/fix-green-final-unit.log`: 546 passed, 9 failed; the 9 are all CMS-03C-02 success-resource tests (the L0
`PatternPlacementResource` contract change, lanes that build CMS-03C-02), none involves this item.

Existing tests changed only to the spec value (old -> new):
- `template-routes.test.ts` `normalizes a %i port failure to %s without leaking dependency prose`: rows `[502, DEPENDENCY_INVALID_RESPONSE]` ->
  `[502, DEPENDENCY_UNAVAILABLE]`, `[504, DEPENDENCY_DEADLINE_EXCEEDED]` -> `[504, DEPENDENCY_UNAVAILABLE]` (titles render with the new code);
  `refuses a malformed success resource ...`, and the 502/504 expectations at the former lines 527 to 578, 600, 699, 746.
- `cms-template-designer-submit.test.ts` `accepts only BE03c %i %s as a typed refusal`: same two rows.
- `template-context-routes.test.ts`, `template-detail-routes.test.ts`, `pattern-instance-routes.test.ts`, `locale-routes.test.ts`,
  `related-content-envelope.test.ts` (3 expectations), `related-content-errors.test.ts` (1): `DEPENDENCY_INVALID_RESPONSE` -> `DEPENDENCY_UNAVAILABLE`.
- `cms-composition-platform-mutation-error-relay.test.ts` (502 and 504 rows, the `[504, ..., '9', '9']` retry case),
  `cms-composition-platform-mutation-fail-closed.test.ts`, `cms-composition-platform-pattern.test.ts`, `cms-composition-platform-related.test.ts`,
  `cms-composition-platform-locale.test.ts`: the same replacement.

## Item 3: template pages (FE03, P2-S12-AC-265)

RED: `.lane-logs/fix-red-pw-2.log`: 3 failed, 1 passed (`Expected: 400 Received: 404` for `not_a_valid_key`, `context`, `versions`).
Change: a malformed key (and the reserved `context`, `versions` that `CmsTemplateKeySchema` refuses) answers 400 before any protected read;
every other branch (401 redirect, 403, 404 for an absent or concealed key, degraded 502/503/429) is untouched.
GREEN: `.lane-logs/fix-green-pw-1.log` (4 passed). Run with `GITHUB_RUN_ID=912012` so the dev servers take non-colliding ports.
Playwright test changed: `a malformed template key is a no-store, accessible 404 without disclosure` ->
`[P2-S12-AC-265] a malformed template key is a no-store, accessible 400 without disclosure` (expected status 404 -> 400);
added `[P2-S12-AC-265] [P2-S12-AC-189] the reserved key context|versions never resolves as a template key`.

## Item 4: real composition (apispec)

Files: `tests/postgrest/phase-02-slice-12-template-version.apispec.ts` (CMS-03C-01: 201 shape with strong ETag, one audit event and no outbox event,
successor in the same lineage with `supersedes_id`, exact replay also after a lost response, changed body under the same key 409, stale If-Match
409, repeated first version 409, absent key 404, reserved key 422 with `reasonCode` and pointer, audience 422 at `/audience`, a value the contract
accepts and the database refuses 422, unknown member 422, malformed JSON 400, cross-owner create without conflict, cross-owner successor 404
identical to an unused key and `NOT_FOUND` from the database for both, 401/403 (route and database) and a 503 outage),
`phase-02-slice-12-template-reads.apispec.ts` (cmsTemplateContextRead and cmsTemplateLatestRead: 200 strict resources with ETag, owner scoping,
403 route and database, 404 identical for another owner's key and an unused key, 400 for malformed and reserved keys without touching the
database, 401, 503) and `phase-02-slice-12-locale-variant.apispec.ts` (CMS-03C-04: 201 strict draft with the aggregate ETag, immutable target
revision, one audit and one outbox event, replay also after a lost response, 409 for a stale version, stale source hash and wrong fallback chain
with `FALLBACK_CHAIN_MISMATCH` + active chain, 422 for an unsupported locale, an unlocalized field, an invalid value and an unknown field, 404
`LOCALE_SOURCE_NOT_FOUND` identical for an absent entry and another owner's entry, 401/403 route and database, 503).
Support: `support/phase-02-slice-12-composition-stack.ts`, `support/phase-02-slice-12-locale-world.ts`.

First run (`.lane-logs/api-001200.log`) failed to import (`hono` is not resolvable from `tests/postgrest`; fixed by reusing the Worker's own
`createCmsTemplateApp`). Second run (`.lane-logs/api-002816.log`): 24 passed, 3 failed, and the 3 are a real defect:
over the real API `cmsTemplateContextRead` listed no content type (`expected [] to deeply equal [ <typeId> ]`) and `cmsTemplateLatestRead`
answered 404 for the caller's own, just-defined template. Cause: both private reads select from forced-RLS CMS tables through definer-owned
functions (SEC-2), whose policies admit a row only while `app.cms_rpc = 'true'`, and neither read ever set the flag. A real request starts
without it; every pgTAP suite runs in a transaction whose fixtures leave it set, so nothing saw it (the Slice 12 template detail and context
suites pass on the broken code). RED in SQL: `.lane-logs/alt-tap-003420-3584954.tap` (`phase_02_slice_12_fix_template_reads_rpc_context.sql`, tests
5, 6, 10, 12, 13 of 14 failed). Fix: `100300` (latest read) and `100500` (context read) set the flag first, and the `platform_api` wrappers become
the flag-restoring wrappers of the other CMS reads. GREEN SQL: `.lane-logs/alt-tap-003516-3589908.tap` (77 tests across the four template suites);
GREEN real stack: **`.lane-logs/api-003554.log`: 3 files, 27 tests passed** (run through `docs/handoffs/2026-10-08-phase2-codex-handoff/lanes/lane-api.sh`).

RED provenance for the apispec files: they were written after the unit and pgTAP RED evidence above and were first run on the fixed code; I did not
run them against the pre-fix migrations (other lanes share the worktree's migration directory). Their new-rule assertions (cross-owner create,
`templateId`, `key_reserved`, the DEPENDENCY_UNAVAILABLE 503) are the same conditions as the RED logs of items 1 and 2; the defect above is the one
RED the apispecs produced themselves.

## Extra work forced by the L0 contract (needed for the shipped routes to keep working)

- `templateId` is now required on `TemplateVersionResource` / `TemplateVersionDetail`: without the lineage id every CMS-03C-01 response failed the
  Worker's strict resource check (502). Delivered by `100000`, `100200`, `100300`; every template fixture gained `templateId`.
- `staleFieldIds` is now required on `LocaleVariantResource`: delivered by `100400`, a guarded amendment of the LIVE
  `cms_author_locale_variant` source. The live body is not the text of any one migration: `20261010130000` (BE03b E7 / DEC-163) amended it in
  place with the settings-snapshot tail. My first attempt rewrote the function from the last textual definition and dropped that tail; the Slice 11
  suite `phase_02_slice_11_e7_settings_writer_tail.sql` caught it (test 40, `.lane-logs/alt-tap-002529-3524424.tap`), so the migration now replaces
  two anchors (each exactly once), proves the inverse replacement restores the installed source byte for byte, and proves every other pg_proc
  attribute unchanged. The member is stored in the idempotency receipt exactly as returned (the E7 test pins stored == returned), and a receipt
  stored before the member existed is completed on replay. RED `.lane-logs/alt-tap-001532-3460126.tap` (tests 5 and 7 of 10 failed), GREEN
  `.lane-logs/alt-tap-002706-3538641.tap` (119 tests: the E7 writer-tail suite, the new test and the existing locale RPC suite). Derived
  `review`/`approved`/`stale` states and a producer of non-empty `staleFieldIds` are NOT built (L2 / later).
- The web relay answered a body the contract refused with a bare `422 {}`. It now answers the same bounded JSON-pointer violations as the Worker
  (and `reasonCode: key_reserved`): RED `.lane-logs/fix-red-local422.log` (6 failed of 8), GREEN `.lane-logs/fix-green-local422.log`.
- The Worker/relay pass `details.reasonCode: key_reserved` with the `/templateKey` violation (RED `fix-red-keyaud-1.log` 6 of 24 failed, GREEN
  `fix-green-keyaud-1.log` 24/24; web RED `fix-red-keyres-web.log`, GREEN `fix-green-keyres-web.log`).

## Edits outside the named ownership (each minimal; please confirm)

- `apps/web/src/server/cms-composition-platform-{mutation,locale,related,pattern}.ts` and `apps/worker/src/cms-composition-production.ts`
  (+ new `cms-composition-production-template-errors.ts`): the relay checks the Worker's code per status, so changing only the Worker would have
  made the relay turn every 502/504 into a local 502 with the old name.
- `supabase/tests/phase_02_slice_11_helpers/003-registry.sqlinc` and `supabase/tests/phase_02_slice_11_criteria_publish_gates.sql`: two raw
  `cms_template_versions` inserts (triggers skipped) gained `'template_id'` (= the row id), now NOT NULL per the locked table text. Nothing else.
- `tests/e2e/support/cms-template-fixture.ts`, `cms-locale-fixture.ts` and the template/locale unit fixtures: `templateId` / `staleFieldIds: []`.

## Full pgTAP

`.lane-logs/alt-tap-003554-3593551.tap`: `lane-db-alt.sh` over the whole `supabase/tests` directory with the final migration set (including the other
lanes' files present at that moment): 375 files, 14185 tests, `Result: PASS`. Two earlier whole-suite runs found real problems that are fixed:
the AC215 trigger inventory (a separate lineage trigger; now folded into the existing guard) and the Slice 11 E7 writer-tail suite (the locale
rewrite from stale text). I did not run the race runners, `pnpm db:lint`, `pnpm db:types:check`, `pnpm validate` or the whole vitest suite.

## Open items / hand-offs

1. `packages/data-access/src/database.types.ts` is generated: run `pnpm db:types` (new column `cms_template_versions.template_id`). `pnpm db:types:check`
   will fail until then. Not done here (needs the local database outside the runners).
2. `pnpm db:lint` (plpgsql warnings) was not run; the new function bodies declare only variables they use.
3. Lineage scope: this lane added `template_id` (and `UNIQUE(template_id, version)`, one active version per lineage) for TEMPLATES only, because the
   locked resource and the L0 contract require `templateId`. `pattern_id` / `taxonomy_id`, the per-owner uniqueness of `cms_pattern_versions` /
   `cms_taxonomy_versions` and `E13` for pattern keys are untouched (wave 2, L1). They should extend the guard-based lineage rule rather than add triggers
   (each new `cms_` trigger needs the AC215 inventory in `phase_02_slice_09_dec108/06-trigger-probes.sqlinc` and its count of 134 updated).
4. A legacy template row that breaks E13 or E4 stays readable but cannot be updated again (NOT VALID CHECKs): the governed submit/activate RPCs of
   CMS-03C-06..09 will meet a raw `23514` for such a row unless they map it. In a database where none exists the CHECKs are validated.
5. `100100` and the `cms_define_template` body (`100200`) were rebuilt from the last textual definitions after a search found no migration that amends
   them in place; the Slice 11 E7 amendment touches five other functions (it is why `100400` is a guarded amendment). Whoever replaces
   `cms_define_template` or `cms_author_locale_variant` again must start from the live source.
6. The CMS-03C-02 success-path tests (9 across `pattern-instance-*.test.ts`, `cms-composition-production-pattern.test.ts`,
   `cms-composition-platform-pattern.test.ts`, the web `pattern-instances.test.ts`) fail on the L0 `PatternPlacementResource` contract and belong to the
   lanes that build CMS-03C-02. Everything else under `apps/worker/src/cms-composition*`, `apps/web/src/server/cms-composition*`,
   `apps/web/src/components/cms-composition`, `apps/web/src/pages/api/v1/cms` and `.../cms-content-modeling` passes (546 tests,
   `.lane-logs/fix-green-final-unit.log`).
7. The web relay for CMS-03C-04 / -02 / -05 answers its own local refusals with bare `details: {}` for a body the contract refuses (only CMS-03C-01 got
   the pointer mapping here); the same AC-005 gap exists on those relays. Not changed (no spec text decided it for them in this lane).
8. The platform_api wrapper of `cms_define_template` still takes a global advisory lock keyed by the template key alone (it serializes unrelated owners
   writing the same key; it discloses nothing). Left as is.
9. The Playwright run used `GITHUB_RUN_ID=912012` so the dev servers listen on 34024/34025 and cannot collide with another lane; the profile API on
   8787 is fixed by the config.
10. Memory/capture: decisions worth recording as DEC (orchestrator): NOT VALID + conditional validation for legacy rows; the lineage guard folded into
    the existing trigger; the guarded amendment style for `cms_author_locale_variant`; the SEC-2 flag defect class (any read RPC added later must set
    `app.cms_rpc`, and a pgTAP test must start from an empty flag).
