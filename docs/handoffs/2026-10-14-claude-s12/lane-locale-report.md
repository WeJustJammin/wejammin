# Lane report: claude_s12_locale (staged lane `locale`)

## Status
GREEN. The three new suites pass 156/156 (staged run 9) and every existing locale, fan-out, recheck, relay and registry suite passes in staged run 6; the only
reds are the baseline test numbers recorded in `CLAUDE-STATE.md` (r8_api_surface #4/13/14, sec2_all_schema_definer_rls #6/12, sec2_definer_rls #11); for the one file I ran on both stages the diagnostics are byte-identical (runs 7 and 8). One unexplained `deadlock detected` abort in a 33-file sequence is open (`## Open items / BOUNDARY` item 1).
Written 2026-10-14 against HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e`, uncommitted by design.

## Scope
Backend of CMS-03C-04 (POST /api/v1/cms/entries/{entryId}/locales/{locale}/variants) completed test-first, and
CMS-03C-20 (`platform_private.cms_resolve_locale_field` plus the registered preflight provider
`cms.locale.no_fallback_gate`) built. Criteria served: AC054-057 (AC058 is the Web form, out of scope, not touched),
AC148-152, receiving AC051-052, and the cascade rows AC233-237, AC240-241, AC248 (locale tuple only), AC260,
AC261 (locale functions), AC276 (locale writer), AC277, AC278, AC279 (locale part), AC280-281 (server side).

## What was built (ten forward migrations, all in `supabase/migrations-wip/locale/`, range 20261014050000-050900)
| Migration | Content |
| --- | --- |
| 050000 `cms_locale_variant_field_hashes` | `field_source_hashes` / `stale_field_ids` columns + CHECKs (AC260), physical state restricted to `draft`/`stale`, draft rows carry no stale ids |
| 050100 `cms_locale_aggregate_helpers` | `cms_uuid_v5`, `cms_locale_aggregate_id`, `cms_locale_source_field_hash`, `cms_locale_stale_fields` (live per-field staleness) |
| 050200 `cms_author_locale_variant_slice12` | guarded anchored amendment of the LIVE author command: records `field_source_hashes`, 32-locale ceiling (`locale_limit_reached`), content-type version row `FOR SHARE` (lock position 4), event identity `(cms.locale_variant, UUIDv5(entry, locale), variant version)` |
| 050300 `cms_stale_locale_dependents_slice12` | the fan-out writer: records stale ids, same event identity |
| 050400 `cms_locale_variant_state` | derived `untranslated`/`draft`/`review`/`approved`/`stale` (AC234) |
| 050500 `cms_resolve_locale_field` | resolver core `cms_locale_resolutions` + CMS-03C-20 `cms_resolve_locale_field` |
| 050600 `cms_locale_no_fallback_gate` | provider body, one statement over all no_fallback fields |
| 050700 `cms_preflight_locale_provider` | dispatch branch in `cms_evaluate_preflight` FIRST (AC241), then the registry row version 2 |
| 050800 `cms_relay_locale_variant_aggregate` | adds the `(cms.localization.changed.v1, cms.locale_variant)` claim tuple (old tuple kept) |
| 050900 `cms_author_locale_variant_deadlock` | `deadlock_detected` / `lock_not_available` in the author command become the typed retryable `CONFLICT` (AC276) |

Worker (only where the SQL boundary changed): the 409 of the 33rd locale carries `{reasonCode: 'locale_limit_reached'}` in
`apps/worker/src/cms-composition-production-locale.ts` and `locale-routes-support.ts`; no other Worker behaviour changed
(the 502/504 mapping was already fixed by 32faf5fd).

## Design decisions to ratify (implementation level, no owner decision exists)
1. UUIDv5 namespace: BE03c names the namespace `cms.locale.aggregate.v1` but gives no UUID. Chosen: namespace UUID =
   UUIDv5(RFC 4122 DNS namespace, `cms.locale.aggregate.v1`); name = lowercase entry id + `:` + lowercase locale.
2. `locale_variant_not_approved` is phase-aware: only the `schedule` and `publish` phases check approval (`approved` or
   `published`). At `submit` the revision must be an effective draft (CMS-03B-05) and at `execute` it is `scheduled` by
   construction (CMS-03B-20), so the literal rule (no phase) would make a locale revision unsubmittable and unexecutable.
3. A field "holds a value" iff a value row exists whose JSON is not `null` (an explicit null is no value).
4. Derived variant state: latest row stale -> `stale`; else effective state submitted -> `review`; approved, scheduled or
   published -> `approved`; otherwise `draft`; no row -> `untranslated`.
5. The 32-locale ceiling is taken before the supported-locale check (a configuration admits at most 32 supported
   locales, i.e. 31 targets, so the ceiling is only reachable by a locale outside the configuration).
6. Deadlock token: the typed retryable `CONFLICT` of every other CMS writer wrapper (20261005013100), mapped by the Worker to
   409 `LOCALE_VERSION_CONFLICT`; the 409 for a stale hash/version stays `VERSION_MISMATCH`.
7. A legacy stale row (no recorded `field_source_hashes`, written before 050000) is stale in every field of its revision
   (conservative); no backfill, the table is append-only.

## Files
Migrations (`supabase/migrations-wip/locale/`, forward-only, none applied to the promoted directory):
- `supabase/migrations-wip/locale/20261014050000_cms_locale_variant_field_hashes.sql` 96 lines `73550a578a6d8aa600b62756f85a72096840b32cc8a12513175e298ba46ac1e0`
- `supabase/migrations-wip/locale/20261014050100_cms_locale_aggregate_helpers.sql` 141 lines `2750acbf317029f288d6a18dc03ed352540677ae0d1ef6d2474b65e5c65aed53`
- `supabase/migrations-wip/locale/20261014050200_cms_author_locale_variant_slice12.sql` 131 lines `fb55548c585eb0b6658bbe16b9206025a7bd0bd99e8a14b4f3d2e75c6db666fb`
- `supabase/migrations-wip/locale/20261014050300_cms_stale_locale_dependents_slice12.sql` 126 lines `dce3df7c9672c1c6f929f2a9cfda646d11a6259097eda4bc7e8c3705a8fc1831`
- `supabase/migrations-wip/locale/20261014050400_cms_locale_variant_state.sql` 55 lines `fed2842732e739446b17fedd9353cf5c8d37e9968995c340005e56b3400fd3cd`
- `supabase/migrations-wip/locale/20261014050500_cms_resolve_locale_field.sql` 213 lines `bc1bcb3c7838c5cb4f5459d967029ac5855e643aa213331e7dfbd4968facef14`
- `supabase/migrations-wip/locale/20261014050600_cms_locale_no_fallback_gate.sql` 91 lines `915e00d1c1bc6b1f039cfbc90fc7e1db3564074699e09de6b616ce4cd352f5c9`
- `supabase/migrations-wip/locale/20261014050700_cms_preflight_locale_provider.sql` 91 lines `2718715bdd09381f892631fc933d53ccc623460aabc00af24667f029b6a95254`
- `supabase/migrations-wip/locale/20261014050800_cms_relay_locale_variant_aggregate.sql` 67 lines `bbfe03c7b05a5c0a2f014b5347a284bb2c5f81e0a9bf5c924d2d8aa733bc799b`
- `supabase/migrations-wip/locale/20261014050900_cms_author_locale_variant_deadlock.sql` 76 lines `1616c333b4eea46d2550d64309ae93abef73fbe21eb05975ceb2bfcd6d97a1f2`

New pgTAP suites and fragments (`supabase/tests/`):
- `supabase/tests/phase_02_slice_12_locale_variant.sql` 35 lines `5748b3124e47820f76aa6b277ade71cf88f8f04fbc8cc52a1c27d4b12937413b`
- `supabase/tests/phase_02_slice_12_locale_variant/000-helpers.sqlinc` 212 lines `be422f298f5b8d9a13ab0f052825c3f0888021a6ed9ebefa903f54b39eee814a`
- `supabase/tests/phase_02_slice_12_locale_variant/001-persistence-and-write.sqlinc` 207 lines `2f873915f18ed635cbfc05d658dbd3f38449416fbcecb7ee2695316e72afbc46`
- `supabase/tests/phase_02_slice_12_locale_variant/002-limit-and-fanout.sqlinc` 198 lines `9011e9f2d3ebdb7b442b8abb3a32a9e2d334d9eef4665bb857bbbd807dc94075`
- `supabase/tests/phase_02_slice_12_locale_variant/003-contract-and-idempotency.sqlinc` 94 lines `7d131ef40a232fd5e67b4d81f8341a160776fa0e05c36ee3ea56997a33517d5b`
- `supabase/tests/phase_02_slice_12_locale_variant/004-relay-source-race-grants.sqlinc` 98 lines `a8a98366fb10d3859c9ceb05596b2224133cde725a9c18868f559dee6a9bdee0`
- `supabase/tests/phase_02_slice_12_locale_variant/README.md` 28 lines `64a2480adbf93b79feea737074bf6e9802fb50244949410b40bd738b29655069`
- `supabase/tests/phase_02_slice_12_locale_resolution.sql` 26 lines `2cca661b16f15dce66caba736fbd797fb9b6f584b8fa64c4c9b5fe92327e3df6`
- `supabase/tests/phase_02_slice_12_locale_resolution/001-world.sqlinc` 159 lines `e952a70a6cafa166b450140b2645dfc3659b5864c5438bb13b936ca2c1de828e`
- `supabase/tests/phase_02_slice_12_locale_resolution/002-resolver.sqlinc` 156 lines `8eebd74f4f89ede628711f83cf0009b742af13df9abcb295cfbecd4e4de0e650`
- `supabase/tests/phase_02_slice_12_locale_resolution/010-bench.sqlinc` 145 lines `976ca098f4044a1afd5b4e6e3e6035f46f07f60a1d9e36b4965dd9d0da2eac4f`
- `supabase/tests/phase_02_slice_12_locale_resolution/README.md` 19 lines `481aeafb86cda7eef9f6407d20d3c00cf31e3acb1ede1ca1a572e66a139d6f88`
- `supabase/tests/phase_02_slice_12_locale_gate.sql` 31 lines `75a621dc772b084e9efc59c1f4f64702a0e88caa3900e3e5dedc5466b7e552cd`
- `supabase/tests/phase_02_slice_12_locale_gate/001-gate.sqlinc` 199 lines `66c4b985d94a66c2433c2af7c6bd73b9bb2b8f3c49140bffef71fd8785ccc50c`

Worker (only where the SQL boundary changed):
- `apps/worker/src/cms-composition-production-locale.ts` 298 lines `cd642e4e699b290445d89650138107000bb4810db303be074ea29fe52d8597fb`
- `apps/worker/src/cms-composition-production-locale.test.ts` 600 lines `314416a8b8e5d8f255660c66dfa0e0f5f96213dfe7e4dc857229631427b3af7a`
- `apps/worker/src/cms-composition/locale-routes-support.ts` 158 lines `f5bbc28ed2bd82c6d61c738947d2cd4d454c97607a7eb373d134f7b6d26021a7`
- `apps/worker/src/cms-composition/locale-routes.test.ts` 886 lines `fe752289235beb9032c91736e8611fe9e34792ec971cd654a7663e4bcdd15e44`

Existing suites edited (see `## Per-criterion evidence (staged run 9, TAP `b3809f18...`, the three new suites; `variant`/`resolution`/`gate` = `supabase/tests/phase_02_slice_12_locale_<name>.sql`, numbers are TAP assertion numbers)
| Criterion | Evidence |
| --- | --- |
| AC054 (201 resource, one transaction) | variant #6 (strict draft resource, empty `staleFieldIds`), #29 (draft rows carry no stale ids), and the pre-existing `locale_author_rpc` #1-9 (RPC shape, hash, entry CAS, one audit, one outbox). OpenAPI/Hono parity is the pre-existing Worker route tests. |
| AC055 (authority, no borrowing, no identifiers) | variant #7 (exact 13-member resource, no owner/party/person id), #10 (target revision holds only the requested fields), #36-37 (absent entry/source concealed as NOT_FOUND); pre-existing `locale_author_rpc` FORBIDDEN/NOT_FOUND split |
| AC056 (idempotency, CAS, unique key) | variant #32-35 (replay, mismatch on body/locale/version, malformed key), #38 (no record left), #40 (unique entry/locale/source/version), #66-67 (superseded source refused, nothing written); Worker 60/120 buckets, no-store, 15,000 ms are the pre-existing route tests |
| AC057 (error mapping) | variant #36-38 (404/409/400 tokens, no record), #45 (`locale_limit_reached` 409), #70-71 (deadlock/lock failure -> typed CONFLICT); Worker: `[P2-S12-AC-236]` x2 and `[P2-S12-AC-276]` Vitest cases, plus the pre-existing 502/503/504 `DEPENDENCY_UNAVAILABLE` cases |
| AC058 | not in scope (Web form) |
| AC148 (contract, provider) | resolution #8 (exactly the nine members, no text), gate #9 (registered provider), gate #11 (private definer) |
| AC149 (modes, chain walk) | resolution #9-15, #21 |
| AC150 (no browser route, grants, no text) | resolution #39-41; variant #68-69 (ten functions unreachable to every API role); Worker `[P2-S12-AC-150]` Vitest case (route inventory and 404 probes) |
| AC151 (read-only, deterministic) | resolution #36-38 (48 calls write no row, STABLE definer, 24 pairs identical twice) |
| AC152 (one resolver for gate and reads) | gate #11-36 (the gate runs the same core as the resolver, in one statement per revision); resolution #44-47 (performance) |
| AC051 (no_fallback never borrows, blocks) | resolution #16-20, #24, #29-30; gate #12, #15, #28-29 |
| AC052 (stale keeps serving, exposed, never blocks) | resolution #22-23, #25-27, #31; gate #31-32 |
| AC233 | pre-existing `locale_config_enforcement` (12 assertions) re-run green; the successor clause is open (Open item 4) |
| AC234 (derived state) | variant #55-56, #59 (stale, untranslated, draft after revalidation); gate #23 (approved), #25 (review), #27 (rejected review shows draft), #30 (a revalidation row shows draft, not approved) |
| AC235 (per-field staleness) | variant #8-9, #53-54, #57, #60, #62 |
| AC236 (ceiling) | variant #42-46, #48 |
| AC237 (event identity) | variant #11-16, #49-52, #58, #64; resolution #28 |
| AC240 (provider, newer row) | gate #9-10, #13-14, #16-22, #24, #26 |
| AC241 (dispatch before registration) | gate #33-36 (the deployed evaluator dispatches `locale` to the gate; never `unavailable`); the migration order inside 050700 (branch, then row) |
| AC248 (locale tuple) | variant #63 |
| AC260 (persistence) | variant #5, #18-28, #30-31 |
| AC261 (locale RPC inventory) | variant #68-69 |
| AC276 (locale writer lock order, typed deadlock) | variant #69-72 |
| AC277 (locale source edit versus translation) | variant #65-66 (sequential, deterministic outcome; race modules are not run) |
| AC278 (no leakage) | variant #17; resolution #41 |
| AC279 (128 locale fields) | resolution #44-47 |

## Test corrections`):
- `supabase/tests/phase_02_slice_12_locale_author_rpc.sql` 405 lines `6e8db610b7e61520fd8d7539e5c8a7b3535f3b23dfea3c495c0f32f20feeaf5d`
- `supabase/tests/phase_02_slice_12_locale_source_stale.sql` 213 lines `5209ea91da7a399ccbb40a42c9a0bb73a0234deae22e676f0dc8601311ff2f35`
- `supabase/tests/phase_02_slice_12_locale_stale_backfill.sql` 133 lines `206bec859dc7222cafd93e1ac1cac333ff86d3511065a8056228584f746fa932`
- `supabase/tests/phase_02_slice_10_locale_fanout_branch.sql` 203 lines `1dcd1981c9bd0712c24596661c5ac27f310fa63728738ec604980c9dedbff080`
- `supabase/tests/phase_02_slice_11_recheck_locale_source.sql` 322 lines `eb214a5f4bc3f1e0a078c40c96a4e55600d7f4f8468f5bf7baba7b4527bd2ca2`
- `supabase/tests/phase_02_slice_11_preflight_registry_schema.sql` 247 lines `3f6d77b53d6ff5cd363e82f90dcd09168c3a4ba369eac1958ede2fe7bc434f42`

Report: this file.

## Runs
All runs through `docs/handoffs/2026-10-14-claude-s12/lanes/lane-db-alt-staged.sh`, lane `locale` unless noted
(two diagnostic runs used lane `none`/`locale` on one baseline file). TAP and manifest paths are under
`.lane-logs/`. "promoted" is the count of promoted migrations the stage held at that time.

| # | Stamp (TAP name) | Plan | WIP | Result | Classification / first failure | TAP SHA-256 |
| - | --- | --- | --- | --- | --- | --- |
| 1 | `alt-staged-locale-065436-3205042` | the three new suites | 0 (promoted 387) | RED: 21 ok, 31 not ok, 3 psql aborts | genuine missing feature: variant #5 (no `field_source_hashes` column) then abort; resolution: `cms_resolve_locale_field` absent (47 assertions fail or abort); gate: absent. One harness defect of mine found here: the gate fixture lacked `h11r_member('reviewer01')` (CONFLICT), fixed before run 2 | `cb081102188cab83f76599fe07ecd779b14a17c53055bdf76c15dbc6e8b45e69` |
| 2 | `alt-staged-locale-070220-3240206` | 21 files (new suites, every existing locale suite, Slice 10 fan-out, Slice 11 recheck/relay/poison/preflight/publish gates/references) | 9 | 476 ok, 0 not ok; exit 1 only because `phase_02_slice_11_helpers_preflight.sql` and `phase_02_slice_11_criteria_publish_gates.sql` aborted at `phase_02_slice_11_helpers/003-registry.sqlinc:55` (`cms_pattern_versions.lifecycle_version` NOT NULL) | the known baseline fixture defect of root's baseline-repair lane, not caused by this lane (the abort is in the shared fixture before any preflight assertion) | `ae28306aee662ff1503e41e5cb349edaae3a83fb244d86260acfa537cf56bb4f` |
| 3 | `alt-staged-locale-070603-3263529` | the three new suites (after adding the bench, relay, race, grants and deadlock cases and migration 050900) | 10 | PASS, 155 ok, 0 not ok | GREEN | `6379293f5e4b2b1457d1ffb1ee86421daaa421c14c0dfc87a69b76b73ac06de4` |
| 4 | `alt-staged-locale-070928-3281695` | 33 files | 10 | NOTESTS, exit 255 | HARNESS (mine): zsh did not word-split the file list, pg_prove received one argument. No verdict, no feature signal | `7a78fd34fc079f294851b8357959b8ca3e44c9b6698a67cb38cd5bb3efe9d6e3` |
| 5 | `alt-staged-locale-071027-3287453` | 33 files | 10 | 994 ok, 8 not ok | baseline known: r8_api_surface #4/13/14, sec2_all #6/12, sec2_definer #11 (the numbers `CLAUDE-STATE.md` records for the lane-none baseline); genuine defect found: `phase_02_slice_11_preflight_registry_schema.sql` #4/#5 counted rows without a version filter and my registry row (version 2) is a strictly newer row by design: oracle corrected (see Test corrections); plus the deadlock abort of item 1 under Open items | `98f64fe4b2f1468eefcf8544fb1296abbd48763ac80d5e82a3f98ef31b0618c9` |
| 6 | `alt-staged-locale-071226-3297204` | the same 33 files after the correction | 10 | 997 ok, 6 not ok, `sec2_definer_rls` aborted at line 490 (deadlock) | every locale-related file green (all of the three new suites, the eight existing Slice 12 locale suites, both Slice 10 fan-out suites, all Slice 11 recheck/relay/poison/e7/registry/posture suites). Remaining not ok are exactly the baseline numbers: r8_api_surface #4,13,14; sec2_all_schema_definer_rls #6,12; sec2_definer_rls #11 | `53f9000b614cbda111974621d9a8f4ccb2b50848e61bf3b8384fdec31c802890` |
| 7 | `alt-staged-none-071332-3303401` | `phase_02_slice_09_sec2_definer_rls.sql` alone | none (promoted 389) | 53 ok, 1 not ok (#11) | diagnostic: the baseline of that file on the promoted set | `65b96391f7cd613030550718d34c722842950b06bcbcfabd025823941e1b21ab` |
| 8 | `alt-staged-locale-071436-3310376` | `phase_02_slice_09_sec2_definer_rls.sql` alone | 10 | 53 ok, 1 not ok (#11), no deadlock | diagnostic: same result with the ten WIP migrations as without them; diagnostics of #11 byte-identical to run 7 | `f175fea70246f018f2a612dc39b3ad72454f3eb9008e270e31bebeec1c21833b` |
| 9 | `alt-staged-locale-072019-3337901` | the three new suites after adding the direct AC234 state assertions to the gate suite | 10 | PASS, 156 ok, 0 not ok | GREEN: variant 73/73, resolution 47/47, gate 36/36 | `b3809f1884dbec7081cff6a31bc823157bf50142d5261fb5cadfc9fe785ac01f` |

Final suite counts (run 9, TAP `b3809f18...`): `phase_02_slice_12_locale_variant.sql` 73/73, `phase_02_slice_12_locale_resolution.sql`
47/47, `phase_02_slice_12_locale_gate.sql` 36/36 (156 assertions, 0 failing, no skips). Run 6 (33 files) holds the same variant and resolution suites and the gate suite at 32/32, before the four AC234 assertions were added.

Worker: focused Vitest `apps/worker/src/cms-composition/locale-routes.test.ts` + `cms-composition-production-locale.test.ts`
first RED (2 failing: the `locale_limit_reached` pass-through, right reason), then GREEN; final focused set
(+ `phase-02-slice-12-dependency-unavailable.test.ts`, `production-worker-runtime-cms-composition.test.ts`,
`apps/web/src/server/cms-composition-platform-locale.test.ts`) 5 files / 105 tests passed; `tsc -p apps/worker`, ESLint and Prettier clean on the four touched files.

128-field benchmark (inside run 3 and run 6): a 128-field CMS-03C-04 write 33-36 ms (five runs, target < 300), resolving all 128 fields
in one statement p95 25.6 ms, the gate over 64 no_fallback fields p95 19.7 ms, one `cms_resolve_locale_field` p95 3.4 ms.

## Test corrections
Each edit is minimal, cites the spec line that makes the old oracle contradict it, and weakens nothing. Independent review requested.

1. `supabase/tests/phase_02_slice_12_locale_author_rpc.sql` (BE03c 1395/1555, AC237: the localization event is no longer
   `(cms_content_entry, entryId, entryVersion)`): the two assertions that located the event by `aggregate_id = entryId`
   through `pg_temp.s10_outbox_count` / `s10_outbox_payload` (shared helper, untouched) now locate it by
   `payload->>'entryId'`. Same counts (1) and same payload-shape assertion.
2. `supabase/tests/phase_02_slice_12_locale_source_stale.sql` (same spec): the count (4) and the payload-disclosure
   assertion locate events by `payload->>'entryId'` instead of `aggregate_id = entryId`.
3. `supabase/tests/phase_02_slice_12_locale_stale_backfill.sql` (same spec): `event.aggregate_id = entryId` becomes
   `event.aggregate_type = 'cms.locale_variant' and event.payload->>'entryId' = entryId` (the version-2 assertion is
   unchanged and still holds: it is now the stale row version), and the final count (2) locates by payload.
4. `supabase/tests/phase_02_slice_10_locale_fanout_branch.sql:72` and `supabase/tests/phase_02_slice_11_recheck_locale_source.sql:70`
   (BE03c 1431 / AC260: the physical state is `draft` or `stale`; `approved` is derived, never stored): fixture variant rows inserted with state
   `approved` are inserted as `draft`. Nothing in either suite reads that state.
5. `supabase/tests/phase_02_slice_11_preflight_registry_schema.sql:69,75` (BE03c 1397, the registry migration's own rule that a later
   slice registers a provider by a strictly newer row): "exactly one row per category" and "each category once" counted the whole
   table; they now count `where version = 1` (the DEC-134 seed), which is what the assertion text says.

Test corrections still required at promotion, NOT edited by me (outside my claim and masked today by the baseline
`lifecycle_version` fixture abort, so unprovable now): `phase_02_slice_11_helpers_preflight.sql:173` (pinned registry list names the
reference gate for `locale`), `:477-483` (a no_fallback schema is `provider_unbuilt_reference`; now a source-locale revision without the
value is `locale:failed/no_fallback_missing`), and `phase_02_slice_11_criteria_publish_gates.sql:347-353` (same locale gate cases), plus
`phase_02_slice_11_recheck_relay.sql:46,72` / `phase_02_slice_11_outbox_relay_poison.sql` when the root narrows the relay allowlist (AC248).

## Spec citations
BE03c: route row 162; internal op 189; validation matrix 382-388; error catalog 1257/1291/1304; locale resolution and fan-out
1387-1395; providers 1397-1399; LocaleVariant table 1431; RLS 1452/1465; events 1555; lock order 1335-1357; testing 1609/1614/1633;
BE03b 1811-1818 (registry, phases). DEC-121, DEC-122, DEC-138. Tracker AC051-052, AC054-057, AC148-152, AC233-237, AC240-241, AC248, AC260-261, AC276-279.

## Open items / BOUNDARY
1. **Deadlock abort in a 33-file sequence (unexplained, not caused by the migrations' semantics as far as tested).**
   `phase_02_slice_09_sec2_definer_rls.sql:490` (`alter table platform_private.cms_content_types disable trigger user`) died with
   `deadlock detected` in runs 5 and 6 (process 292 waited for ShareRowExclusiveLock on relation 21671, blocked by process 293,
   which waited for the ShareLock on transaction 2956). The same file alone completes with the ten WIP migrations (run 8, 53 ok, only the
   baseline #11) and without them (run 7), with byte-identical #11 diagnostics. Hypothesis, unproven: an autovacuum/analyze of
   `cms_content_types` colliding with the test's in-transaction DDL after my first three suites left dead tuples; in the canonical
   alphabetical order the slice_12 suites run after the slice_09 ones, so the canonical `db:verify` should not meet it. Root's canonical run is the proof;
   I did not rerun identical bytes.
2. **BOUNDARY AC263/AC264 (locale metrics and alert).** `cms_locale_fanout_total`, `cms_locale_limit_reached_total`, `cms_locale_stale_total{locale}`,
   `cms_no_fallback_block_total` and the "stale locale legal-field count above 0" alert have no emission seam: they are incremented inside
   database transactions (fan-out trigger, preflight gate) and no spec names the path from a DB-internal event to a Worker metric (missing:
   a BE00/BE03c Observability paragraph naming it). Nothing was invented. The Worker already sees the 409 `locale_limit_reached` and the
   preflight report, so a Worker-side counter for those two is possible once the contracts observability allowlist (`packages/contracts/src/cms-editorial/observability.ts`) is opened.
3. **Over-approximated `stale_field_ids` snapshot.** The staleness trigger fires AFTER INSERT on the revision row and the revision writers
   (`cms_create_revision`, `cms_resolve_conflict`, `cms_restore_revision`) insert the field values afterwards, so the fan-out cannot yet see the new
   values: a recorded field then compares against an absent value and is listed. The live truth (`cms_locale_stale_fields`, the resolver, the gate) is exact and
   tested. To make the stored snapshot exact the writers (shared, outside my claim) must call the producer after their values, or accept the snapshot as a superset.
4. **AC233 successor clause not added.** "After a successor changes the chain the new chain applies and the old chain is refused" needs a real 03a successor plus activation chain as fixture;
   the existing config suite already pins membership, mismatch and the unchanged-on-refusal rule. `[]` for the default locale is unreachable through CMS-03C-04 (a target equal to the source locale is refused earlier).
5. **AC056 "changed actor under the same key".** The idempotency record is scoped per actor (BE00 `identity_idempotency_reserve`): another actor reserves its own record rather than meeting a mismatch. Not tested here; BE00 owns it.
6. **Composed tests not written.** No `tests/postgrest/phase-02-slice-12-locale-variant.apispec.ts` (Worker to PostgREST to database) and no route-level Tier 2 p95 < 1,200 ms measurement: composed stacks are root-run. The RPC < 300 ms target is proved for 128 fields.
7. **AC058** (`CmsLocaleVariantForm`) and the FE/Web recovery path of AC281 are the Web lane's. **AC248**: only the locale tuple was added (old tuple kept); narrowing is the root's closing migration. **Token-less provider 4xx as a scrubbed 500** for the locale adapter is the hardening lane's (root ruling 2026-10-14T11:30Z), untouched here.
8. **Contracts closed reason sets (AC241 contract half).** The closed per-category reason set and fixed copy for `locale` live in frozen contracts files, not edited (see Requests).

## Requests to root
1. **Review and promote** the ten migrations of `supabase/migrations-wip/locale/` in timestamp order. Four are guarded anchored amendments of installed
   source (050200 author command, 050700 `cms_evaluate_preflight`, 050800 `claim_outbox_batch`, 050900 `platform_api.cms_author_locale_variant`): each aborts with SQLSTATE 55000 unless its anchor occurs exactly once
   in the installed source, so a lane that amends the same function first needs a re-check, not a rewrite. 050700 inserts its branch in front of the unchanged `elsif registry_row.provider_key <> 'preflight.' ...`
   line, which the pattern and taxonomy providers can also use; the AC248 narrowing of `claim_outbox_batch` must come after 050800.
2. **Populated-DB witness for 050000** (it alters `cms_locale_variants`: two NOT NULL DEFAULT columns, three CHECKs, the state CHECK replaced) and a canonical `pnpm db:verify` on a quiet host (see Open item 1).
3. **Contracts mirrors outside my claim:** `packages/contracts/src/cms-editorial/preflight.ts` (`CMS_PREFLIGHT_REGISTRY`, the `locale` row: provider `cms.locale.no_fallback_gate`, database, reasons
   `CMS_LOCALE_NO_FALLBACK_REASONS`, registry version 2, and the parity test); `packages/contracts/src/cms-editorial/review-recheck.ts:67` and `apps/worker/src/cms-editorial/review-recheck/review-recheck.test-support.ts:32`
   (aggregate type of `cms.localization.changed.v1` becomes `cms.locale_variant`); every consumer-side aggregate-type pattern `^[a-z][a-z0-9_]{0,63}$` (for example `platform_private.consumer_dead_letters.aggregate_type`)
   rejects the dot of `cms.locale_variant`. Until these change the recheck consumer dead-letters locale events.
4. **Slice 11 oracles at promotion** (listed in `## Test corrections`) and the Slice 9 inventory pins, which are baseline-red with identical diagnostics (my ten functions are private and name only tables already in the pinned set).
5. **Ratify or override** the seven design decisions, above all (1) the UUIDv5 namespace recipe, (2) the phase-aware `locale_variant_not_approved`, and (6) the CONFLICT token.
6. **Decide** the metric seam for AC263/AC264 (Open item 2) and the writer-ordering question of Open item 3.
7. `supabase/migrations/README.md` per-migration notes on promotion (not touched). No `pnpm db:types` refresh is needed: no `platform_api` signature changed.
8. Scope note: I added a third suite pair beyond the brief's two (`phase_02_slice_12_locale_gate.sql` + dir, for the registered provider) and edited five existing suites listed under Test corrections (three locale suites, one Slice 10 fan-out fixture, one Slice 11 recheck fixture, one Slice 11 registry oracle).

## Fix pass
Status: GREEN for the lane's own scope (brief `briefs/locale-f1.md`). Staged run 11 (`alt-staged-locale-122018-342319`, 74 files, lane `locale`, 11 WIP migrations, promoted 399): the four lane suites pass in full (variant 97/97, resolution 41/41, gate 36/36, perf 10/10), and so does every other locale, fan-out, recheck, relay, registry, evidence-trigger-catalog and revision-writer suite in the set. The only reds are the unchanged baseline: `r8_api_surface` #4/13/14, `sec2_all_schema_definer_rls` #6/12, `sec2_definer_rls` #11 plus its `deadlock detected` abort at line 490 (third occurrence, Open item 1 stands), and three suites that abort in a shared fixture on the `cms_pattern_versions` columns (`helpers_references`, `helpers_preflight`, `criteria_publish_gates`). Vitest: contracts + web workflow + worker editorial + the SQL parity test, 320 files / 4,403 tests pass; ESLint, Prettier and `tsc` clean on the touched TypeScript.

### F1, aggregate type `cms_locale_variant` (root ruling 1)
- Spec defect to correct at cascade: BE03c 388 and 1395 and the AC237 tracker row (`phase-02-slice-12.md` ~2054) name the dotted `cms.locale_variant`; the deployed grammar `^[a-z][a-z0-9_]{0,63}$` (`consumer_dead_letters.aggregate_type` CHECK, 20261002184000:86; `AggregateKeySchema`) rejects the dot, and the other Slice 12 aggregates are underscored.
- Changed: 050100 comment, 050200, 050300, 050800 (claim tuple and its guard) and every locale suite literal. Contracts: `review-recheck.ts:67` and `review-recheck.test.ts:27` (`cms_locale_variant`), worker `review-recheck.test-support.ts:32`. `phase_02_slice_11_recheck_relay.sql:53`: its negative control used `cms_locale_variant` as a WRONG aggregate; the lane's tuple makes it a claimed one, so the control is now `cms_locale` (see Test corrections).
- Proof the consumer accepts the envelope: contracts test `[P2-S12-AC-237]` (RED first: `expected "cms_content_entry"`; GREEN after the literal) admits a UUIDv5 aggregate id under `cms_locale_variant` and refuses `cms_content_entry`, `cms.locale_variant`, `cms_locale_variants`. The worker `source-consumers.test.ts` parameterised case for `cms.localization.changed.v1` (ack, one job enqueued, `deadLetter.records == []`) now runs on the new aggregate and passes. SQL: variant #78-81 read the grammar from the deployed dead-letter CHECK (not restated) and assert every localization event the lane produced matches it and is under the single aggregate type, non-vacuously.
- The recheck SQL resolver reads `payload.{entryId, locale, revisionId}` and never the aggregate type, so no SQL consumer change.

### F2, contracts and Slice 11 pins (root ruling 2)
- `preflight.ts`: `registryVersion: '1' | '2'`; the `locale` row is now `{registryVersion '2', ownerSlice '03c', providerKey cms.locale.no_fallback_gate, providerVersion '1', providerKind database, referenceKind null, reasonCodes CMS_LOCALE_NO_FALLBACK_REASONS}` (imported from `cms-composition/locale-resolution.ts`, no cycle). `preflight.test.ts`: RED first (3 failures), then GREEN; new tests `[P2-S12-AC-240][P2-S12-AC-241]` pin the row, the three closed failed reasons, `provider_unavailable`, and that `PreflightRefusalEntrySchema`/`PreflightResultSchema` accept the three locale tokens and refuse `provider_unbuilt_reference` for `locale` (so a gate refusal is 422 `preflight_failed`, not a scrubbed 500).
- Copies touched, beyond the literal file list (ratify): `tests/contracts/phase-02-slice-11-sql-parity.test.ts` (the DEC-134 seed parity compared every row with the registry and asserted registry version 1; it now compares the seed with the registry as a version-1 view in which a newer row stands for the reference gate it replaced, and pins that only `locale` is newer) and `apps/web/src/components/cms-editorial-workflow/cms-workflow-labels.ts` (three fixed copy strings; its own suite "has copy for every registered reason" went red otherwise). When the pattern and taxonomy lanes land their rows these two tests extend by one category each.
- Slice 11 pins edited (UNPROVEN: both suites abort in the shared `cms_pattern_versions` fixture before any preflight assertion, as in the baseline): `phase_02_slice_11_helpers_preflight.sql` registry list (`locale=cms.locale.no_fallback_gate@1/database/-`) and the `gate-loc` case (`locale:failed/no_fallback_missing`: that revision is value-less, and the same fixture style is proved by gate #12 of the lane suite); `phase_02_slice_11_criteria_publish_gates.sql` three `locale:failed:no_fallback_missing` strings (the delta set is unchanged because the gate is read-only, as the reference gate was). These must be re-proven once the baseline fixture is repaired.

### F3, exact `stale_field_ids` (root ruling 3)
Choice: migration `20261014050310` retires the AFTER INSERT revision trigger and attaches the fan-out to an immediate AFTER UPDATE OF `current_draft_revision_id` row trigger on `cms_content_entries` (same transaction as the writer, WHEN the head changes to a non-null revision). `cms_create_revision`, `cms_resolve_conflict` and `cms_restore_revision` all insert the revision, its values and relations, and move the head last; `cms_author_locale_variant` never moves the head, so 050200 gains an explicit `cms_stale_locale_dependents(new_revision_id,false)` after its values. Justification: exact by construction, immediate (no suite or wrapper observes a timing change), and no edit of three large shared writers (AC245 will extend them). Rejected: a DEFERRABLE INITIALLY DEFERRED constraint trigger (moves the fan-out to commit, any ALTER TABLE on the revision table after a revision write fails with "pending trigger events" as Slice 11 `e2_state_check` and `reads_plan_stability` do, and a fan-out error surfaces past the wrappers); explicit calls inside the three writers (invasive).
- RED (`alt-staged-locale-red-121049-299840`, variant suite without 050310): #66 (fan-out must wait for the head move), #69/#70 (stored `[title]` versus truth `[date]`, the review's flow) and the real-writer #72-74; #72-74 first failed for a harness reason (the Slice 10 world pins a placeholder editorial policy; fixed by the same labelled pin `phase_02_slice_10_locale_fanout_regression.sql` applies), the fragment `005` aborted on a missing function (made robust with `to_regprocedure`). GREEN in run 11: #58 (first edit, equality instead of containment), #66, #69-70, #73-75 (production `cms_create_revision`: stored `[date]`, never the unchanged title, equals the live truth), and #91-97 (trigger catalog, retired trigger and function dropped, definer posture, writer inventory guard: exactly five functions write revision rows, the three source writers order revision, values, head move; the author command orders values, fan-out, variant row).
- Consequence for root: the Slice 9 trigger inventory (`06-trigger-probes.sqlinc`, `cms_entry_revisions_locale_stale`/5) lists the retired trigger; `evidence_trigger_catalog` still passed in run 11, but the inventory pins (and `schema` #448 style lists) must drop that row and add `cms_content_entries`/`cms_content_entries_locale_stale`/`cms_content_entry_locale_stale_trigger`/29 in the baseline-repair pass.
- Suites adapted (test corrections below): the source-edit builders now write like a writer (values, then head move); `recheck_locale_source` runs the real producer directly after its raw, value-less source revision.

### F4, `locale_variant_not_approved` timing (root ruling 4, behavior NOT changed)
Gate `cms_locale_no_fallback_gate(revision, phase)` (050600:65-69). Order: `no_fallback_missing` wins over `no_fallback_stale`, which wins over the approval check. The approval check applies only when the phase is `schedule` or `publish`, only when a `cms_locale_variants` row names the revision as its translation revision, and fails when `cms_revision_effective_state(revision)` is not `approved` or `published`. `submit` never checks approval (the revision is an effective draft by construction, CMS-03B-05), `execute` never checks it either (the revision is `scheduled`). So admitted without failing: submit and execute in any state; schedule and publish in `approved` or `published`. Failing: schedule and publish in `draft`, `submitted`, `rejected`, `scheduled`, or invalidated-review states. Note `cms_locale_variant_state` maps `scheduled` to `approved`, so the two functions disagree about `scheduled` at publish (a scheduled locale revision fails the gate at publish but shows approved). Options for the owner: (A) as is; (B) BE03c 1391 amended to the three phases schedule, publish, execute and states `approved`, `scheduled`, `published` (defence in depth at execute); (C) approval at submit with the review itself as the approval (not coherent with CMS-03B-05).

### AC233 `[]` clause and minors (root ruling 5)
- `[]` is accepted exactly for the default locale: variant #41-44 (rolled-back probes: `[]` accepted for en-US sourced from a locale revision; `["fr-FR"]` for en-US is 409 `FALLBACK_CHAIN_MISMATCH` with `activeFallbackChain []`; `[]` for fr-FR is refused with `["en-US"]`; nothing persisted). Open item 4 is corrected: `[]` is reachable. The successor-chain clause stays open (needs a real 03a successor activation fixture; disclosed).
- `no_plan()` replaced by `plan(97)`, `plan(41)`, `plan(36)`, `plan(10)`; the 128-field wall-clock bench moved out of the functional resolution suite into its own `phase_02_slice_12_locale_perf.sql` (quiet host, hard `< 300 ms` bounds kept there); idempotency record counts added to the AC057 snapshots (variant #39, #49); AC276 lock position 4 stays a textual pin (race modules are root-run), stated here.
- Not done: the Worker test files keep their size (pre-existing >400 lines, F10).

### Test corrections (fix pass)
1. `phase_02_slice_11_recheck_relay.sql:53` negative control aggregate `cms_locale_variant` -> `cms_locale` (BE03c: the localization event is produced under `cms_locale_variant`, root ruling 1; the control must stay a wrong aggregate).
2. `phase_02_slice_12_locale_source_stale.sql`: `s12_append_source_revision` ends with the draft head move; the trigger-existence assertion names the head-move trigger.
3. `phase_02_slice_12_locale_stale_backfill.sql`: the `disable/enable trigger cms_entry_revisions_locale_stale` pair removed (the trigger no longer exists; the raw revision insert moves no head, which is the pre-migration state the case models).
4. `phase_02_slice_11_recheck_locale_source.sql` `lr_source_revision`: calls `cms_stale_locale_dependents(revision, false)` after its raw insert (the revision-insert trigger it relied on is retired; entry version must stay as the reviews froze it).
5. `phase_02_slice_10_locale_fanout_branch.sql`: comment only (the fixture's raw revision moves no head).
6. Slice 11 pins in `helpers_preflight` and `criteria_publish_gates` and the parity test, as in F2.

### Files changed in the fix pass (lines, SHA-256)
Migrations: 050100 141 `ab29d125...5f04`; 050200 142 `0fd9cf17...65df`; 050300 125 `9d8344ab...038b`; 050310 98 (new) `975d8110...c9ee`; 050800 67 `a3fc230e...8aa7` (the other migrations unchanged: 050000 `73550a57...`, 050400 `fed28427...`, 050500 `bc1bcb3c...`, 050600 `915e00d1...`, 050700 `2718715b...`, 050900 `1616c333...`). Full hashes: see the table printed by `sha256sum` over `supabase/migrations-wip/locale/*.sql`.
Tests: `phase_02_slice_12_locale_variant.sql` 36 `619feb04...`; fragments `000` 270, `001` 207, `002` 293, `003` 147, `004` 126, `005` 74 (new); `phase_02_slice_12_locale_resolution.sql` 25; `phase_02_slice_12_locale_perf.sql` 21 and `phase_02_slice_12_locale_perf/001-bench.sqlinc` 146 (new, moved); gate suite plan(36) only; README files of the variant and resolution suites.
TypeScript: `preflight.ts` 466, `preflight.test.ts` 702, `review-recheck.ts` 229, `review-recheck.test.ts` 320, `review-recheck.test-support.ts` 117, `cms-workflow-labels.ts` 216, `tests/contracts/phase-02-slice-11-sql-parity.test.ts` 263.
Runs: RED `alt-staged-locale-red-121049-299840` (1 file; 90 of 97 planned, 6 not ok + abort; a temporary `locale-red` WIP directory, removed). GREEN run 11 `alt-staged-locale-122018-342319`, TAP SHA-256 `0b61cc35055351f5f00655906cc647341a00167c6c15b1792a5583178757f901`.

### Requests to root (fix pass)
1. Ratify the scope notes: I edited `review-recheck.ts:67` and its test and the worker test-support (F1 consumer literals, needed for the proof), `tests/contracts/phase-02-slice-11-sql-parity.test.ts` and `cms-workflow-labels.ts` (F2 mirrors), and `phase_02_slice_11_recheck_relay.sql` (the control contradicted F1).
2. Correct BE03c 388/1395 and the AC237 tracker row to `cms_locale_variant`; put F4 options to the owner.
3. Baseline-repair pass: Slice 9 trigger inventory (one row out, one in, see F3) and re-prove the two Slice 11 pins and the `helpers_references` suite once the `cms_pattern_versions` fixture is repaired.
4. Promotion order: 050310 after 050300 and before any lane that amends the three writers; 050200 now has six anchors (still guarded, 55000 on drift). AC248 narrowing of `claim_outbox_batch` keeps both tuples until Slice 11's `cms_content_entry` events drain.
5. Pull the `supabase_db_wejammin_ev` log for the `sec2_definer_rls.sql:490` deadlock (reproduced a third time in a 74-file sequence; byte-identical baseline #11).

## Fix pass 2
Status: GREEN for the claim of `briefs/locale-f2.md`. Root rulings applied: the five out-of-claim edits are ratified.

### D1, D2 (Worker oracles), test-first
RED (before any edit): `pnpm vitest run` on the two files: 3 failures, 33 pass (`async-runtime-review-recheck-claim` "refuses cms.localization.changed.v1 on an aggregate other than the producer uses (cms_locale_variant)" expected null; `async-runtime-outbox-poison` "records the poison row..." and "relays a batch with no poison exactly as before", `send:${id(4)}`/`send:${id(2)}` missing). Cause as the review states: `parseOutboxClaim` (`async-runtime-parsing.ts:195-204`) validates through `ReviewRecheckSourceEnvelopeSchema`, whose localization aggregate is now `cms_locale_variant`.
- `async-runtime-review-recheck-claim.test.ts`: the wrong-aggregate example for `cms.localization.changed.v1` is now `cms_content_entry` (it pins that the former aggregate is refused at the relay). The positive `it.each(SOURCES)` already follows `AGGREGATE_FOR`.
- `async-runtime-outbox-poison.test.ts`: `validLocalization` builds its row under `AGGREGATE_FOR['cms.localization.changed.v1']` (import from `review-recheck.test-support`); new `legacyLocalization` plus a new test "drains a legacy cms_content_entry localization row through the poison path, never to the queue" (dead letter, complete, no send, a valid row behind it still relays). `poisonLocalization` and the dead-letter echo are unchanged (the dead letter echoes the raw row).
- GREEN: the two files 37 pass (36 + 1 new); full Worker suite `pnpm vitest run apps/worker` under `flock -s /tmp/wejammin-quiet.lock`: 612 files / 10,495 tests pass.

### D3 apispec edits (static; NOT run, the main stack is root's gate)
Root proves these at the canonical `pnpm db:api-test`:
- (a) `tests/postgrest/support/phase-02-slice-11-recheck-fixtures.ts` `localeVariantFixture`: variant row state `'approved'` -> `'draft'` (050000:93-94 restricts the physical state to `draft|stale`; BE03c LocaleVariant 1431 and the pgTAP corrections `recheck_locale_source.sql:70`). The variant stays a fixture INSERT: its content type supports only the default locale, so CMS-03C-04 cannot author it (the existing docstring); everything the suite asserts about it is production code.
- (b) same file, `editedSourceFixture`: now written like a revision writer (cms_create_revision, cms_resolve_conflict, cms_restore_revision): revision row, copy of the source field values, then `update cms_content_entries set current_draft_revision_id = <edited>, version = version + 1` last. The real fan-out (trigger of 050310 on the head move) then produces the stale row and event through the production producer; no direct call. `app.cms_rpc` is already set in the fixture transaction. Head move does not touch the review invalidation trigger (it fires on `lifecycle` only, 20261005017580:492) and the manifest freezes no entry version.
- (c) `phase-02-slice-11-recheck.apispec.ts` ~:477-478: envelope pin is `aggregateType 'cms_locale_variant'`, `aggregateId localeAggregateId(entryId, 'fr-FR')`, a new TS helper in the fixtures file (UUIDv5 of `lower(entry):lower(locale)` under UUIDv5(DNS, `cms.locale.aggregate.v1`)), an independent oracle rather than reading `cms_locale_aggregate_id` back. Checked here: the same SHA-1 recipe reproduces the RFC 4122 vector (`python.org` -> `886313e1-3b8a-5372-9b90-0c9aee199e5d`) that variant suite #63/#68 pins for the SQL; the SQL helper's recipe (050100:43-53) is the one implemented.
- (d) `phase-02-slice-12-locale-variant.apispec.ts:124-126`: the event is counted by `payload->>'entryId' = entryId` (aggregate id is now the locale aggregate), as the lane's pgTAP suites do.
- Swept for other readers: `cms_locale_variants`, `localization.changed` and `aggregate_id = entryId` in `tests/postgrest` and Worker/Web tests: `phase-02-slice-11-claimed-preparation.apispec.ts:49` only counts rows; `cms-editorial-world.ts:120,188` and `phase-02-slice-11-world.ts:208` count entry events on worlds that author no locale variant. Static checks: prettier and ESLint (`--max-warnings=0`) clean on the five files; `tests/` has no tsconfig project (type-aware ESLint passed; a tsc probe only reports missing node/workspace type setup).

### Minors
- D4: `20261014050800` header now says legacy `cms_content_entry` rows are still claimed but refused by `parseOutboxClaim` and drain through the relay's poison path (dead letter INVALID_QUEUE_PAYLOAD, then complete); none on a fresh database.
- D5: `p_backfill` cannot be dropped in this forward migration: the two-argument signature is pinned by the installed ownership migration (20261003120500:133) and called by `cms_backfill_locale_stale` (20261005010900:77, passes true) and several suites. `20261014050300` header and COMMENT ON now say it is retained and ignored; retiring it needs the backfill caller redefined in the same migration (not done; the review offered exactly this alternative).
- D8 correction of this report: the head-move trigger's `tgtype` is 17 (ROW 1 + UPDATE 16, AFTER = bit 2 clear), not 29 as F3 stated above. The catalogue inventory row for root's baseline pass is `('cms_content_entries', 'cms_content_entries_locale_stale', 'cms_content_entry_locale_stale_trigger', 17)`; the trigger-probe line `06-trigger-probes.sqlinc:70` is to be dropped.
- Not touched (outside this pass's claim): D6 (promote-time assertion over the 050700 seed text), D7 (re-prove after the `cms_pattern_versions` fixture repair), D9 (stale comment, `phase_02_slice_11_recheck_relay.sql:31-33`); all root's, none gates promotion.

### Run (comment-only migration edits)
Staged run `alt-staged-locale-164757-1382544`, lane `locale`, 11 WIP migrations, suite `phase_02_slice_12_locale_variant.sql`: pg_prove exit 0, 97/97, 0 `not ok`; TAP `.lane-logs/alt-staged-locale-164757-1382544.tap` SHA-256 `bd73cd2113d942738c206b443c20f6953f3135d1ae4daf054f0466476ad9dc4b`. Purpose: prove the edited 050300/050800 still apply; no behavior changed.

### Files (lines, SHA-256)
- `apps/worker/src/async-runtime-review-recheck-claim.test.ts` `237e2d7a...ae13c`
- `apps/worker/src/async-runtime-outbox-poison.test.ts` `172c529e...07e3d`
- `tests/postgrest/support/phase-02-slice-11-recheck-fixtures.ts` 176 `c764c159...4553`
- `tests/postgrest/phase-02-slice-11-recheck.apispec.ts` `ad424234...b9f0`
- `tests/postgrest/phase-02-slice-12-locale-variant.apispec.ts` `a8544052...a83e`
- `supabase/migrations-wip/locale/20261014050300_cms_stale_locale_dependents_slice12.sql` 132 `a7a7930e82e81391de0de052e10ec22fd630ec72800c71a759e7216ecae6b2a5`
- `supabase/migrations-wip/locale/20261014050800_cms_relay_locale_variant_aggregate.sql` 70 `d4d3671003fa711a95ac89c7d3ad456c6b6a92620d70aed67b2d04feb0fd403b`

### Requests to root (fix pass 2)
1. At the canonical `pnpm db:api-test` on a quiet host, prove the four D3 edits: Slice 11 recheck apispec (fixture state, edited-source fan-out, envelope pin) and the Slice 12 locale-variant apispec (event count). A red there is a fixture mistake in this pass, not a production defect, unless the stale row or event is missing after the head move.
2. Baseline pass: Slice 9 trigger inventory with tgtype 17; D6/D7/D9 as above; correct BE03c 388/1395 and the AC237 tracker row to `cms_locale_variant`; F4 owner options.
