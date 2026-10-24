# Lane claude_s12_sec1_manifest report

## Status
GREEN (awaiting root run). The 21 `platform_api` claim readers reported by the canonical run
(`.lane-logs/canonical/db-verify-20261023T060745Z.log`, 8039-8210; the same 21 names appear in the drift list, the
synthetic-catalog diff, and both mutation-suite failures; no other name) are now manifest entries, with a family and
a fixture each. No security finding: every function is service_role-only and every body gates on `cms_actor`.
Nothing was run against the database (not permitted). Static checks run: prettier, eslint, a DB-free
structural check (manifest == family == fixture, 127 entries) and a DB-free simulation of `probesFor` for the 21.

## Scope
Edited only: manifest, fixtures index, two NEW fixture modules, support README. Read-only checked (no change needed):
`claim-gate-mutation.apispec.ts`, `claim-gate-manifest.apispec.ts`, `claim-gate-mutants.ts`, `claim-gate-probes.ts`,
`claim-gate-check.ts`, `claim-gate-restore.ts`, `claim-gate-world.ts`, `claim-gate-success.ts`.

## Files (path, lines, SHA-256 before -> after)
| File | Lines | Before | After |
|---|---|---|---|
| tests/postgrest/support/claim-gate-manifest.ts | 307 -> 352 | 7b339a0b5a9660fa1862bbf8da08c40efd4a8920c8651d9f26bd19891ea36303 | fde425a8257bada8a99d5cb55796416992718bf11d029c3109efb78fe3e75c68 |
| tests/postgrest/support/claim-gate-fixtures.ts | 51 -> 55 | bb256488a7b5be629fc6405786e8052ac968c8fe41a45aacd7676b82c3ec98e1 | 6ff2dc49ae0702bdb86d8417f77f152024271319b5475e5181f6b8398890f657 |
| tests/postgrest/support/claim-gate-fixtures-governed.ts (new) | 84 | none | dd3319a57d6e7d0ad2b864d0e675db311a5e041c8ceb5fed5992643104fd791c |
| tests/postgrest/support/claim-gate-fixtures-composition.ts (new) | 154 | none | 3dd5e71ed24427d8ded1e3ea7aaf89349d9f8192623d3b29aea11d1b33ae1cd1 |
| tests/postgrest/support/README.md | 164 -> 180 | e91d399e9d4d7bb76eef605ea220a8c668c1eda6628cdb3073c3337d8a316153 | e440a70f01605cb9f7eac7912e325f6e828cfe7f342d40786bd38d5d09461e1b |

Unchanged (verified SHA before == after): claim-gate-manifest.apispec.ts 0ef97abe..., claim-gate-mutation.apispec.ts
44213318..., claim-gate-mutants.ts 310c1d93..., claim-gate-fixtures-cms.ts e8ee6356....
The README file was already modified (uncommitted) by another lane before this lane started; my before-hash is the
state at lane start, the diff is a 2-hunk edit (fixtures bullet; a "Slice 12 BE03c operations" paragraph).
`claim-gate-fixtures-cms.ts` was NOT extended (250 lines; +21 fixtures would pass the 400-line cap), so the fixtures
follow the existing per-family split: new `-governed` (6) and `-composition` (15) modules merged in
`claim-gate-fixtures.ts`. `claim-gate-manifest.ts` now has 352 lines (was already 307 over the 300-line utility limit;
no max-lines lint rule exists). Splitting a type-bearing oracle file was out of scope; root may decide.

## Per-function table
All 21: `platform_api.<name>(p_request jsonb)`, defined once, `revoke all ... from public, anon, authenticated,
service_role` then `grant execute ... to service_role` (grant file:line below); schema default privileges
(20260830044317_operational_foundation.sql:39-44) revoke execute from public/anon/authenticated; no later migration
re-grants. Gate class therefore `service-role` for every one (the only class a service_role-only matrix implies per
`gateFromGrants`). Family `cfg-actor` for every one: each private body starts `cms_actor(p_request)` ->
`cfg_actor`, which is also the oracle's claim reader. Probes (all `service-role`/`cfg-actor`): anon 401 permission
denied; authenticated token 403 permission denied; service_role + ghost actor `400:UNAUTHENTICATED`; service_role +
real actor (a real auth user with no person) = the `real` column.

| Function | Grant (migration:line) | Request (beyond harness `context`) | Real outcome | Reasoning (first authority step after the gate) |
|---|---|---|---|---|
| cms_submit_governed_review (CMS-03C-06) | 20261013300810:39 | subjectKind pattern_version, subjectId, subjectHash HEX64, idempotencyKey | 400:NOT_FOUND | 20261013300800: actor, exact keys/kind/UUID/hash pass, then `cms_governed_subject_resolve` returns null for an unknown id -> NOT_FOUND BEFORE the person lookup and before any reservation. Later patches (300820, 040100) only touch locals and post-state refusals |
| cms_record_governed_decision (CMS-03C-07) | 20261014010210:37 | reviewId, decision approve, reason 'api gate probe', expectedVersion/ifMatch '1', idempotencyKey | 400:STEP_UP_REQUIRED | 20261014010200: structure (CAS pair via `cms_governed_cas_operand`, decision, SafeText reason) then `cms_editorial_step_up_instant` BEFORE the review is read; harness context carries no stepUp proof. Same shape as Slice 11 `cms_record_review_decision` |
| cms_assign_governed_reviewer (CMS-03C-08) | 20261014010110:37 | action create, reviewId, reviewerPersonId, expiresAt FUTURE, CAS pair, idempotencyKey | 400:STEP_UP_REQUIRED | 20261014010100: exact create keys, UUIDs, offset-ISO expiry pass; step-up at step 2 "before the review is read and before the reservation". Mirrors `cms_assign_editorial_reviewer` |
| cms_activate_governed_subject (CMS-03C-09) | 20261014070410:36 | reviewId, action activate, CAS pair, idempotencyKey | 400:STEP_UP_REQUIRED | 20261014070400 (patched 150000/160200/170100 downstream only): `cms_governed_activation_request` (live body from 160000 admits activate) then step-up before the review read. activate takes no activateAt/reason |
| cms_get_governed_review (CMS-03C-10) | 20261014010310:30 | reviewId | 400:NOT_FOUND | 20261014010300: exact keys, UUID, person lookup wrapped (null), review absent / no person -> NOT_FOUND. 170200 patch only adds a member inside the document statement |
| cms_list_governed_reviews (CMS-03C-11) | 20261014010410:28 | {} (all optional) | 200: (empty page) | 20261014010400 via `_signed`: exact keys, Vault key (seeded by `claim-gate-world`), actor, then `v_person is null` skips every scope branch -> empty page, same pattern as `cms_list_editorial_reviews` fixture |
| cms_act_taxonomy_term (CMS-03C-03) | 20261014120510:38 | eight-member action body (create, termKey, labels, aliases, CAS pair, key) | 400:NOT_FOUND | 20261014190030 (live): object check, actor, then person null / tenant-invisible -> NOT_FOUND before capability, reservation and member validation |
| cms_create_taxonomy_version (CMS-03C-16) | 20261014030300:40 | first-version body, expectedVersion null | 400:NOT_FOUND | 20261014030200: same concealment step 3 before reservation and member checks |
| cms_list_taxonomy_versions (cmsTaxonomyVersionsRead) | 20261014030400:132 | taxonomyId | 400:NOT_FOUND | 20261014030400: object, actor, person null -> NOT_FOUND before capability and key checks |
| cms_list_taxonomy_terms (cmsTaxonomyTermsRead) | 20261014120610:65 | taxonomyId | 400:NOT_FOUND | 20261014120600: exact-key envelope + UUID BEFORE the actor (fixture satisfies), then person null -> NOT_FOUND. Signed wrapper needs the Vault key |
| cms_list_taxonomy_selector (CMS-03C-17) | 20261014120710:62 | typeKey, fieldKey, locale | 400:NOT_FOUND | 20261014120700: exact keys pre-actor, then person null -> NOT_FOUND before the value checks |
| cms_curate_related_content (CMS-03C-05) | 20261014060500:50 | entryId, pins [], exclusions [], derivedRule null, CAS pair, key | 400:NOT_FOUND | 20261014060400: actor, then envelope + `cms_related_content_pointers` ([] / null are valid) pass, entry row absent -> NOT_FOUND before authority locks and reservation |
| cms_get_related_content (cmsRelatedContentRead, DEC-195) | 20261014200010:32 | entryId | 400:NOT_FOUND | 20261014200000: exact keys, actor, UUID, entry absent -> NOT_FOUND |
| cms_create_pattern_version (CMS-03C-12) | 20261014020500:124 | patternKey, compatibleTypeIds, blockTree [], expectedVersion null, key | 400:NOT_FOUND | 20261014020400 (block-rules patch 080200 is downstream of the head): actor, person null -> NOT_FOUND at step 1, before reservation and exact-key check |
| cms_pattern_latest (cmsPatternLatestRead) | 20261014020500:125 | patternKey | 400:NOT_FOUND | same file: exact `{patternKey, context}` envelope + context object BEFORE the actor (the harness supplies context), then person null -> NOT_FOUND |
| cms_insert_pattern_instance (CMS-03C-02) | 20261014110400:52 | revisionId, patternId, patternVersion 1, linkMode detached, slotPath '/', overrides {}, CAS pair, key | 400:NOT_FOUND | live body 20261016040400 (patched 043700, 080300 downstream): actor, `cms_pattern_placement_check` (exact envelope, all values valid) then revision lookup absent -> NOT_FOUND before entry lock and reservation |
| cms_list_pattern_selector (CMS-03C-13) | 20261014140310:63 | contentTypeId | 400:NOT_FOUND | 20261014140300: exact keys, actor, contentTypeId UUID check pass, then person null -> NOT_FOUND |
| cms_get_instance_update_diff (CMS-03C-14) | 20261014140410:32 | instanceId | 400:NOT_FOUND | 20261016040300 (live): exact keys pre-actor, actor, UUID, instance row absent -> NOT_FOUND |
| cms_apply_pattern_update (CMS-03C-15) | 20261014140610:50 | action accept, targetPatternVersion 2, one instance {instanceId, expectedVersion '1'}, CAS pair, key | 400:NOT_FOUND | 20261014140600: `cms_pattern_update_check` runs BEFORE the actor (fixture satisfies the whole envelope), actor, then first instance absent -> NOT_FOUND before entry lock and reservation |
| cms_get_locale_variant (cmsLocaleVariantRead, DEC-205) | 20261022020010:32 | entryId, locale 'fr' | 400:NOT_FOUND | 20261022020000: exact keys, actor, UUID + BCP 47 locale pass, entry absent -> NOT_FOUND |
| cms_list_composition_instances (cmsCompositionInstancesRead, DEC-206) | 20261022050010:75 | entryId | 400:NOT_FOUND | 20261022050000: exact keys, actor, UUID/limit/cursor structure pass, entry absent -> NOT_FOUND. Signed wrapper needs the Vault key |

No `svcReal` override is needed anywhere: the real attacker is a person-less auth user on both the user and the
service_role path, and no gated function here answers a service-role actor differently (unlike `cms_list_entries`).
No `successKeys` (the one 200 fixture, `cms_list_governed_reviews`, is covered like `cms_list_editorial_reviews`: the
gate-less stub is caught by the ghost probe, which expects UNAUTHENTICATED). No new SUCCESS_CONTROLS entry (a success
needs domain rows the suite does not own). None of the 21 reaches the idempotency reservation on its probe path, so no
fixture needs a per-call request builder and a repeat answers identically.

## Mutation-suite coverage check (no edit needed)
- ENTRY mutation iterates `Object.keys(CLAIM_GATED_API_FUNCTIONS)`: it will mutate all 127 entries (title string is
  computed). Each of the 21 has exactly one `platform_api` overload (needed by `apiTarget`); the stub keeps owner/ACL.
- The only per-entry special cases are the `service-principal` family (DEC-156 actorless list: `cms_dependency_recheck_run`,
  `cms_execute_publication_schedule`) and the `ungranted` class; none of the 21 belongs: all resolve an actor.
- HELPER mutants compute their expected sets from the manifest by family/gate: "cfg_actor no longer requires a real auth
  user" now expects all cfg-actor entries including the 21 (ghost probe stops answering UNAUTHENTICATED; the next
  outcome is NOT_FOUND/STEP_UP/200, never UNAUTHENTICATED). The cfg_actor-trusts-named-actor and legacy-GUC mutants
  expect only `subject-or-service` cfg-actor entries, so the service-role 21 are correctly not expected to fail.
  No post-2026-10-03 migration reads JWT claims directly, so the 21 reach claims only through `cfg_actor`.
- "covers every actor family" and the entries-count identity are family-based and unchanged.

## Security findings
None. Observations (informational, not defects):
1. Five signed-cursor wrappers (`cms_list_governed_reviews`, `cms_list_taxonomy_terms`, `cms_list_taxonomy_selector`,
   `cms_list_pattern_selector`, `cms_list_composition_instances`) intentionally stay owned by the migration owner so they
   can reach the Vault cursor helpers (migration comments; same as the Slice 11 `cms_list_editorial_reviews`). They are
   still service_role-only with a claims gate in the private reader.
2. Pre-gate structural validation exists in `cms_apply_pattern_update`, `cms_pattern_latest`, `cms_get_instance_update_diff`,
   `cms_list_taxonomy_terms`, `cms_list_taxonomy_selector`, `cms_list_governed_reviews` (envelope checked before
   `cms_actor`). This leaks only INVALID_REQUEST for a malformed body to a caller who already holds an EXECUTE grant
   (service_role); it does not bypass the gate. Fixtures satisfy it so ghost probes still reach UNAUTHENTICATED.

## Runs
None (DB commands forbidden). Static: `pnpm exec prettier --check` (4 TS files + README) clean; `pnpm exec eslint` on the 4
TS files clean; `tsc --strict` on manifest + fixtures: only an unrelated `node:crypto` types error from the
pre-existing worker-fixtures module (no @types/node in the scratch tsconfig); esbuild-bundled check: 127 manifest
entries, family keys == manifest == fixture keys, no duplicate fixture names, all 21 are service-role/cfg-actor with
a fixture; bundled `probesFor` simulation for the 21 produced exactly the four probes above with the expected
outcomes (scratch in `<scratchpad>/claude_s12_sec1_manifest/`).

## Requests to root (exact commands, canonical stack)
1. `cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin && pnpm db:reset`
2. `pnpm exec vitest run --config vitest.postgrest.config.ts tests/postgrest/claim-gate-manifest.apispec.ts tests/postgrest/claim-gate-mutation.apispec.ts`
   (expect: drift [] , all `real` outcomes as tabulated, mutation suite mutates 127 entries.)
3. If any single `real` outcome differs from the table, the likely cause is a live-body difference from the migration
   reading above (the live private body is the result of anchored patches; I read heads only). Correct the one
   `real` string from the reported `expected X, got Y`; do not touch the gate class. Reset again afterwards (the suites
   require a fresh `pnpm db:reset`).
4. Optional: decide whether to split `claim-gate-manifest.ts` (352 lines) for the 300-line utility guidance.
