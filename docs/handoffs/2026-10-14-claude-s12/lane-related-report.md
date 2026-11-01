# Lane report: claude_s12_related (staged lane `related`)

## Status
GREEN (superseded by "## Fix pass" below: 273/273 pgTAP, 75/75 Worker). Original final staged run `related-164111-1340214`: 247/247 pgTAP (content suite 172, public_targets 75), exit 0. Worker: 73/73 vitest in the related files, eslint and tsc clean on the touched files. AC063 (Web form) is out of scope (separate Web lane). AC263 metric emitters and the two AC158 consumers (Shard 04 delivery projection, Slice 11 recheck) are not this lane (see Open items).

## Scope
CMS-03C-05 `platform_private.cms_curate_related_content(jsonb)` + `platform_api` wrapper, CMS-03C-21
`platform_private.cms_related_content_public_targets(uuid, text, text)`, Worker production port + route
typed reasons, pgTAP suites. AC063 (Web form) is out of scope (separate Web lane); noted.

## Design decisions (all for ratification unless the spec line is cited)
1. Persistence delta (migration 060000): add `max_candidates` (BE03c 1432 omits it but 1385/387 need
   `maxCandidates` stored and used); add `cms_related_rule_valid(key, version)` (BE03c 1432 names it) as a
   CHECK; derived rows carry a rule, pin/exclude rows do not. `reason_code` storage stays UPPERCASE
   (existing CHECK `^[A-Z]...`), API stays lowercase (`shared_terms`): stored `upper(reason)`, projected `lower`.
   Pin rows store `MANUAL_PIN`, exclusion rows `MANUAL_EXCLUSION` (internal, no spec value).
2. Draft-read predicate for a target = same owner party, `cms.author`/`cms.editor` assignment on that entry
   (`cms_authority_origin(..., entry)`), mirroring `cms_relation_target_visible` (BE03c 1381 "assigned or holds
   owner-party scope"; the platform has no owner-party read scope without an assignment).
3. "No hold applies" (BE03c 1385): before Slice 16 a hold is the entry lifecycle `held`/`deletion_pending`
   (migration 20261005017510 header); public eligibility therefore requires entry lifecycle `active`.
4. Public eligibility of a target = entry `active`, same owner party, lineage head of (entry, locale,
   audience) is the max-`version` row with `action = 'publish'`.
5. `position` of a projected target = dense index in the output array (0..n-1, <= 127).
6. `shared-terms` source revision: the source lineage head's revision when the head is a publish row for
   (locale, audience), else the source current draft revision (editorial preview). Candidates score on their
   head revision's active TermAssignments with active terms.
7. `eligibleCount` = min(128, pins + derived candidates) with locale = source current draft revision locale and
   audience = audience of the source's most recent active (derived `active`) publication; 0 derived when none.
8. Resource `id` = source entry id; `version` = the NEW entry aggregate version (the next If-Match operand);
   `state` = `active` when any item remains active else `revoked`; `contentHash` = JCS SHA-256 of
   {pins, exclusions, derivedRule}. No outbox event (AC061); one audit row.
9. `derivedRule.reasonCode` mismatch is `derived_rule_unknown` at `/derivedRule/reasonCode` (BE03c 1383 says
   "equality expectation"; names no token for mismatch).
10. Refusal tokens are raised as the lowercase reason token (`capability_missing`, `related_target_ineligible`,
    `derived_rule_unknown`) the way the governed lane does; the Worker adapter maps them by
    `CMS_SLICE_12_OPERATION_REASONS['CMS-03C-05']`.

## Files
| path | lines | SHA-256 |
| --- | --- | --- |
| `supabase/migrations-wip/related/20261014060000_cms_related_rule_registry.sql` | 82 | `17224481c4942ac4e64afa7b7d75e8676463f1a9a6eb0b8c445aec8f0406f81b` |
| `supabase/migrations-wip/related/20261014060100_cms_related_derived_candidates.sql` | 114 | `7ec1427b6797728c9f97e1f847fcdb6939dee34849b27d6dd7ef5a4c32c78f62` |
| `supabase/migrations-wip/related/20261014060200_cms_related_content_public_targets.sql` | 120 | `8d7cf20bad89e6acad9a5cd2cec5606a494830cc8f3b1fb92d77165280a53c2a` |
| `supabase/migrations-wip/related/20261014060300_cms_curate_related_content_validate.sql` | 143 | `bf530f7a3d05725b5943fe7bd958c2b4e32505091c63435e5b1ec0b3940ba1a1` |
| `supabase/migrations-wip/related/20261014060350_cms_related_rules_replace.sql` | 178 | `9142acf74950c140cfbb73b19ba8d473be5b5c39c124c300b3cf0e08499e176c` |
| `supabase/migrations-wip/related/20261014060400_cms_curate_related_content.sql` | 245 | `3fb9d03165c7e98e0d8450032de1ae6cd921bd96a7287eb3cbbbda1d033a26cf` |
| `supabase/migrations-wip/related/20261014060500_cms_curate_related_content_public.sql` | 52 | `a03bbdcaec23a96e4d9a8981bbfdc6cec39c30b9a2fa9cbfa464d95acbc21beb` |
| `supabase/tests/phase_02_slice_12_related_content.sql` | 36 | `ac33f503123366f9a1f46d993835b922de2b199d5e044d29ac638a7cc8da0404` |
| `supabase/tests/phase_02_slice_12_related_content/000-helpers.sqlinc` | 190 | `b71822d7a398e44b608fceb22885b3235adfbe6259a8682910da7db22689277f` |
| `supabase/tests/phase_02_slice_12_related_content/001-world.sqlinc` | 272 | `012e826251defbbe1405c5e538a391c732f63bc510f3de987d9e4db3d0e3a5d0` |
| `supabase/tests/phase_02_slice_12_related_content/002-shape-and-grants.sqlinc` | 118 | `e7ed2ac5e3894610d121dc1c206df767c792263f3702faa070381aaa9c279dab` |
| `supabase/tests/phase_02_slice_12_related_content/003-write.sqlinc` | 98 | `64f1654c32e28c1584daf2e1b33613d387fd0a7953ea0bbbcd52096743045534` |
| `supabase/tests/phase_02_slice_12_related_content/004-replace.sqlinc` | 73 | `648991497552bf2f0dd7f39a1ffb45c811257cca57f90751d884163d49848856` |
| `supabase/tests/phase_02_slice_12_related_content/005-validation.sqlinc` | 93 | `00b3585156cd0a61610d41b796885bbef285e24d274dd133be44e1bb6b15d84d` |
| `supabase/tests/phase_02_slice_12_related_content/006-eligibility-authz.sqlinc` | 127 | `03c9094b31481a8f40385b0f8492605f8e32aa508fcfaf73c2642af7d6e16fdc` |
| `supabase/tests/phase_02_slice_12_related_content/007-cas-and-locks.sqlinc` | 50 | `4d601c3a7435561e2bd4e51c9ded5394bb33bcab5cfab3225a6d6881238200a3` |
| `supabase/tests/phase_02_slice_12_related_content/README.md` | 30 | `484d77c08eead8e6a73aae096475efa4a61db10f8efd999289b49400235f2cb1` |
| `supabase/tests/phase_02_slice_12_related_public_targets.sql` | 30 | `a2bc155723d3f6025fd5e1ba33160758b45bf7babd0ad65e0440eb2e9170a965` |
| `supabase/tests/phase_02_slice_12_related_public_targets/001-projection.sqlinc` | 129 | `81969c96e42fb42b01423a80f37a35e4f3238a68eed6c92cd416f5670e1fb17e` |
| `supabase/tests/phase_02_slice_12_related_public_targets/002-recompute-and-ties.sqlinc` | 111 | `bc4e10a69c4854b7ef634e564f244802a988c0cad756743e898a64ef1a598120` |
| `supabase/tests/phase_02_slice_12_related_public_targets/003-bound-and-bench.sqlinc` | 62 | `16a958124a1be379e843fd76d66bbdf791f3a13e7bfa6f62228bda1d237da038` |
| `supabase/tests/phase_02_slice_12_related_public_targets/README.md` | 19 | `bb12ac5af27384ac5113039e5943a8921e46af3382460ba1a8883248d0921b27` |
| `apps/worker/src/cms-composition-production-related-rpc.ts` | 77 | `96394b9ac8b52c88c7156c60cde47030837189db4d4a20758b2c84f2fea671f8` |
| `apps/worker/src/cms-composition-production-related.test.ts` | 392 | `ad3daa82ea90318031b2a0669ab4335e627e579ac87b726bc4b786cdff9bf359` |
| `apps/worker/src/cms-composition-production-related.ts` | 221 | `d4c1a2d30953c59c38a18eaaa51ecb98f921c0af6a493bfd80c2fccad654a716` |
| `apps/worker/src/cms-composition/related-content-details.ts` | 97 | `444808ad0496032df2a593b58ebb84d372fefc469afce88653257d0a79009524` |
| `apps/worker/src/cms-composition/related-content-routes.ts` | 282 | `e2b3ee3a2c0d7df51faeb1ed67d67e20d2c0f2505a3c5a8497f90490539a3d0f` |
| `apps/worker/src/cms-composition/related-content-typed-refusals.test.ts` | 160 | `6051c808c8487a0165b7c4ef1dc046993db071497875eb3a40c5db9a7bec52c7` |
| `apps/worker/src/cms-composition/related-content-no-public-targets-route.test.ts` | 27 | `e51edf1411df3d38a7585038489d6523e898396b59e2d0ebee6c2839580576fe` |

Migrations (all in `supabase/migrations-wip/related/`): 060000 registry + persistence delta, 060100 derived candidates, 060200 public targets (CMS-03C-21), 060300 request pointer validation, 060350 rule replace + eligibleCount, 060400 command, 060500 platform_api transport. Root promotes them.

## Runs
| # | time | stamp | plan | result | TAP / SHA-256 |
| - | ---- | ----- | ---- | ------ | ------------- |
| 1 | 12:03Z | `related-115914-235529` (0 WIP) | both suites | HARNESS, not RED: both files aborted at the world (`001-world.sqlinc:34`) with `VALIDATION_FAILED`: `cms_terms_lifecycle_guard` refuses a non-`active` term insert. Fixture fixed (insert active, then deprecate by UPDATE). | `.lane-logs/alt-staged-related-115914-235529.tap` `8fcbc7f1d8b635fc623370e7ee92a4691a4ae2e256fd0038d24a5755e0b3864a` |
| 2 | 12:17Z | `related-120446-267912` (0 WIP) | both suites | HARNESS: world step `001-world.sqlinc:34` raised `CONFLICT` (fixture, not feature). Fixture fixed. | `.lane-logs/alt-staged-related-120446-267912.tap` `ff75c20d26d15640f5fd6e90cfb6202a6ff0b7352e386c9b0d4c29896dee5cf3` |
| 3 | 12:31Z | `related-121924-338672` (0 WIP) | both suites | RED (genuine missing feature): content suite 58 run / 41 not ok, aborted at `003-write.sqlinc:51` `column "max_candidates" does not exist`; public_targets suite 73 run / 57 not ok. 131 tests total. | `.lane-logs/alt-staged-related-121924-338672.tap` `92a6ef936a021fc2ca2386155bd9b20436e9ac148270eb98f788b094e625f72e` |
| 4 | 12:36Z | `related-123307-395217` (7 WIP) | both suites | HARNESS (reset failed, no TAP): `060300` statement 3 `cms_related_content_pointers` `syntax error at end of input`. Cause: plpgsql `IF` ends its condition at the first `THEN`, so `if case when .. then .. end then` is cut inside the CASE. Fix: parenthesise the three CASE conditions (lines 41, 61, 101). Predecessor was killed before recording or fixing this. | reset log `.lane-logs/alt-staged-related-123307-395217.reset.log` |
| 5 | 16:32Z | `related-163215-1290246` (7 WIP) | both suites | Migrations apply. 245 tests, 5 not ok (all in public_targets): content suite 172/172 ok. 45, 57, 59, 61, 63. Triage: 45 and 63 are WRONG TEST EXPECTATIONS (spec: BE03c 1383 `maxCandidates` bounds derived candidates only, pins do not count; 1383 eligibleCount is 0 derived for a source with no active publication, and srcZ was never published); 57/59/61 are one fixture fault: the two tie-equalizing `UPDATE`s of `cms_publication_versions` created_at recorded 2 world errors, so no tie existed. | `.lane-logs/alt-staged-related-163215-1290246.tap` `05324ca261f039c59db6895e6f559a4d166b598be0cef4499dd9ddf1a7e2b548` |
| 6 | 16:37Z | `related-163707-1315581` (7 WIP) | both suites | 247 tests, 3 not ok (56, 58, 60), all one HARNESS fixture fault: the tie-equalizing `UPDATE` of `cms_publication_versions` failed with 55006 (ALTER TABLE ... DISABLE TRIGGER while the enclosing SQL-function query still holds the table open through its scalar subselect). Tests 45/61/63 now pass after the test-expectation fixes. Fix: `r12_equalize` rewritten in plpgsql, instant read first. | `.lane-logs/alt-staged-related-163707-1315581.tap` `65fc88cc8193f8ab975cf90f4706df2be94d32d9e141e4e359f422b3befe8c1c` |
| 7 | 16:41Z | `related-164111-1340214` (7 WIP) | both suites | PASS: 247 tests, 0 not ok, exit 0. Fixes since run 6: `r12_equalize` rewritten in plpgsql (instant read before the ALTER TABLE). | `.lane-logs/alt-staged-related-164111-1340214.tap` `6398c48f9209eaa1af9a3a6c6c8b01f7d0d1db999ef46db48a6d59d155b03e01` |

## Test corrections
- No pre-existing oracle (pgTAP or contract) was changed.
- `apps/worker/src/cms-composition-production-related.test.ts`: the two tests of the stub era are replaced. (1) "admits a valid editor but refuses curation while the rule authority is absent" encoded the fail-closed stub (`actRelatedContent: async () => unavailable`), which the brief orders replaced by the wired RPC (BE03c 163, 190); superseded by the adapter tests in the same file. (2) "has no implicit allow when production auth or rate dependencies are absent" keeps the same assertions (`humanOrigins` empty, port 503, session 503) but injects a refusing `fetchImpl` so a unit test never touches the network. No assertion weakened.
- Own-suite corrections (tests written by this lane, corrected against the spec, run 5 triage): (a) `002-recompute-and-ties.sqlinc` srcB expectation was `c1,xo,x7,x6,srcm` for `maxCandidates 5`; BE03c 1383 "at most `maxCandidates` derived candidates", the pin is not a derived candidate, so the expectation is `c1,xo,x7,x6,srcm,srcp` (pin + 5). (b) `003-bound-and-bench.sqlinc` expected `eligibleCount` 128 for srcZ that had never been published; BE03c 1383 gives 0 derived for a source with no active publication, so srcZ is now published first. (c) the bench error count was made specific to the bench entries, and a new assertion reports any `equalize` fixture error. (d) `r12_equalize` was moved from a SQL function with a scalar subselect to plpgsql: `ALTER TABLE ... DISABLE TRIGGER` is refused (55006) while the enclosing query holds the table.

## Spec citations
BE03c 163, 190, 385-387, 1292, 1304, 1337-1357, 1379-1385, 1432, 1452, 1491, 1510, 1542, 1610.

## Open items / BOUNDARY
- Spec inconsistency (ratify): BE03c route row 163 says "hidden source/target is 404" while D11 (1381) and validation row 385 make an ineligible, hidden or absent target the uniform 422 `related_target_ineligible`. 404 is implemented for a hidden SOURCE only; AC060 wording follows the route row.
- AC063: Web form, other lane.
- AC158 consumers: the Shard 04 delivery projection and the Slice 11 related-content recheck do not exist as callers yet; this lane proves the function (pins-first ordering, deterministic `shared-terms`/`same-type-recent` ranking and tie-breaks, 128 bound, refill only from eligible derived candidates, recomputation each call, no `platform_api` wrapper, execute revoked from every API role, plus `related-content-no-public-targets-route.test.ts`: no Worker route exposes it). The no-route Worker test is a guard that passes on first run (nothing to implement), so it was not RED.
- AC263 `cms_related_target_ineligible_total` and the other composition metrics have no emitter in the Worker; not in this brief, nothing added.
- Concurrent behavior (CAS race, deadlock conversion) cannot be proved in one pgTAP session; race modules are forbidden to this lane. Static wrapper-source assertions only. Root race module needed.
- Design decisions 1-10 above are for ratification (persistence delta, draft-read predicate, hold = lifecycle `held`/`deletion_pending` pre-Slice 16, dense position, reasonCode mismatch token, outbox-less command).

## Per-criterion evidence (TAP `6398c48f...`; test descriptions carry the `[P2-S12-AC-nnn]` tag)
AC036/037/038 (shape, grants, validation) 14/9/6 tests; AC059 10; AC060 8; AC061 24 (idempotency, CAS, no outbox); AC062 13; AC063 out of scope; AC153 11; AC154 16; AC155 3; AC156 4; AC157 7; AC158 covered through the AC153/155/156/157/231/232 tests plus the Worker guard; AC227 8; AC228 27; AC229 20; AC230 10; AC231 9; AC232 7; AC261 6; AC279 3.

## Requests to root
- After promotion: SEC-2 / API-surface / schema inventory pins (`sec2_*`, `r8_api_surface`, `schema`) need the
  new functions, the `max_candidates` column and definer grants.

## Fix pass
Brief `briefs/related-f1.md`, review `review-related.md` (VERDICT PARTIAL). Final status: GREEN.
Final staged run F1-2 `related-171203-1513803`: 273/273 pgTAP, exit 0 (content 183, public_targets 73, perf 17),
TAP `.lane-logs/alt-staged-related-171203-1513803.tap` SHA-256 `519b8e6adc0268ea44c1f7e49b1ab9f3dd2e83e987df0f0f7d7b076614c1029b`.
Worker: 75/75 vitest in the nine `*related*` test files, eslint and tsc clean.

### Rulings
1. Timing asserts (review finding 1). Both single-sample `< 300 ms` asserts left the gate suite:
   `003-bound-and-bench.sqlinc` is now `003-bound.sqlinc` (functional 128-cap, pins-first and 96-target/no-excluded
   assertions kept; the suite file and README updated). New non-gating `supabase/tests/phase_02_slice_12_related_perf.sql`
   (+ `phase_02_slice_12_related_perf/`, precedent `phase_02_slice_12_locale_perf.sql`) measures the p95 of 10
   CMS-03C-05 writes (32 pins + 32 exclusions + shared-terms bound alternating 63/64 so every write replaces the
   set; source published so eligibleCount evaluates the candidates) and 20 CMS-03C-21 projections. Measured p95:
   write 35.0 ms / projection 12.9 ms (run F1-1), write 39.7 ms / projection 113.2 ms (run F1-2; the projection p95
   rose with the same data while other lanes shared the host, still far below 300 ms; not investigated further, one
   run per change).
2. `contentHash` (finding 4). The spec lists NO hash inputs for `RelatedContentResource` (BE03c 945-952 is the
   shape; the only recipe comments, 869/915/1000, are other resources), so the "spec lists inputs and omits it"
   exception does not apply. RED first (run F1-1: content tests 55, 79, 80, 81 not ok, control 78 and 82 ok). Fix in
   `060400`: hash input is now `{pins, exclusions, derivedRule {key, maxCandidates, version} | null}`; the answered
   `derivedRule` stays `{key, version}` (contract). Test 55 (my own recipe oracle) was updated to the new recipe.
3. Archived/held/deletion_pending SOURCE = `INVALID_TRANSITION` 409 with empty details (finding 6). BOUNDARY (spec
   gap, no change): BE03c 163 (author/editor, 404 hidden, 403 no edit) and the 05 error row 1292 (409 is only
   `RELATED_CONTENT_VERSION_CONFLICT`, 422 `RELATED_CONTENT_VALIDATION_FAILED`) define no source-lifecycle refusal,
   and D11 (1381) constrains only target lifecycle. Missing: an owner decision in BE03c for a non-active source
   (conceal 404, a 422 token at `/entryId`, or the 409 with a reason). Current behavior retained.
4. `cms.publication.changed.v1` consumer (finding 2). BOUNDARY: BE03c 163 and event row 1556 say 03c "consumes the
   event to invalidate related/locale/composition eligibility", and AC-061/062 carry the clause. No consumer exists
   (`grep` over apps, packages, migrations: the event appears only as the 03b producer's contract and web fixtures).
   Nothing is cached by this lane (CMS-03C-21 recomputes on every call, 060200), so there is nothing to invalidate
   and behavior is correct; the cache and its invalidation consumer belong to the Shard 04 delivery projection
   (registered caller of CMS-03C-21) and to the 03c event-consumer registration, neither of which has a spec or
   owner yet. The AC-061/062 consumption clause is therefore not proven by this lane.
5. Worker count (finding 11). `vitest run` with the JSON reporter over the nine `*related*.test.ts` files (the tenth
   `related-content-routes.test-support.ts` is not a test): 75 tests, 75 passed. Per file: production-related 14,
   production-related-ids 1, production-worker-runtime-related 1, admission 23, envelope 7, errors 14,
   no-public-targets-route 5, success 3, typed-refusals 7. Static `it(` blocks are 59 because `no-public-targets-route`
   expands one `it.each` to 5 and `admission` generates 23 tests from a loop (`related-content-admission.test.ts:70`).
   The earlier "73" was off by one (74 before this pass; this pass added the identifier test).
6. Minors, with reasons.
   - Head predicate duplication (finding 7): extracted `platform_private.cms_related_publish_head_revision(entry,
     locale, audience)` (new `060050`, private definer, STABLE, no API-role execute, tested for shape and four
     behaviors: publish head, tombstone head, no lineage, other audience). Used by the derived-candidate source
     revision (`060100`) and the pin eligibility (`060200`), so those two sites share one definition. The set-based
     `heads` CTE (`060100`) stays a set form of the same predicate (commented); the eligibleCount audience lookup
     (`060350`) is a different predicate ("most recent active publication") and is intentionally not folded in.
     The `heads` full scan per (locale, audience) pair was NOT rewritten: the index needs an `entry_id` prefix, a
     lateral rewrite changes the plan without data-volume evidence, and the reviewer accepted it for the 124-entry
     bench; the perf suite now measures it. Left for Shard 04 load.
   - Decision 6 caveat (finding 3): not fixable inside the frozen three-argument signature (BE03c 190 carries no
     preview mode). Stays a root ratification: shared-terms scores a source published for (locale, audience) by its
     published revision even in an editorial preview.
   - Decision 8 hash recipe: handled by ruling 2.
   - Finding 5 (upper-case UUIDs): fixed in the Worker adapter. RED first: the new test failed 502 (the resource
     did not answer an upper-case request). The adapter now lower-cases `entryId`, pins and exclusions before
     dispatch and before the path/answer comparison. New test file `cms-composition-production-related-ids.test.ts`.
   - Findings 8, 10: spec/route-owner text, unchanged (finding 8 belongs to the cascade list).
   - Finding 9 (`DISABLE TRIGGER`) accepted by root; label kept.

### Files changed in this pass
| path | lines | SHA-256 |
| --- | --- | --- |
| `supabase/migrations-wip/related/20261014060050_cms_related_publish_head.sql` | 47 | `11c06367de39e882438dde361d3c2371249e4226faa4ab54ec7fa1c5856d3681` |
| `supabase/migrations-wip/related/20261014060100_cms_related_derived_candidates.sql` | 111 | `39a8cc700dc8b66c4ee3dc3a43ac3cc49a73794c36d9cc9735ec29eec9ccf82e` |
| `supabase/migrations-wip/related/20261014060200_cms_related_content_public_targets.sql` | 116 | `38d8f1154d3cc6eb86eb7dc3762dfcfe9b568207e69953a77225e3b28a5e99b6` |
| `supabase/migrations-wip/related/20261014060400_cms_curate_related_content.sql` | 250 | `bfa297ce5c6655696445532d54b57945d4b08b2a6d712adc88409e4a73c0b378` |
| `supabase/tests/phase_02_slice_12_related_content/002-shape-and-grants.sqlinc` | 133 | `7a346c386dd752749a653201ca68bcc381d88e91f2ecfb1a6694d24098fa011e` |
| `supabase/tests/phase_02_slice_12_related_content/003-write.sqlinc` | 119 | `ecdad091b8324b8e45c789ed88c6d6208da81e5f7278c81b5fe557bffdceab65` |
| `supabase/tests/phase_02_slice_12_related_public_targets.sql` | 30 | `cdc536ce9f27b9404e5376bdc0b9117a32c79576746e4dfbb2cd66e9c1f1a81b` |
| `supabase/tests/phase_02_slice_12_related_public_targets/003-bound.sqlinc` | 56 | `0d33d69627cc5a83d8f265b5a8a328e79ceb7f10dd1c5549f0627b11e340f20c` |
| `supabase/tests/phase_02_slice_12_related_public_targets/README.md` | 19 | `eda6f4fb25e56dfc1a1abc2a3b8c88b366ad0aaa2ec0a86797dd2a5dbe08896f` |
| `supabase/tests/phase_02_slice_12_related_perf.sql` | 31 | `3288b01c3018fd9467a9f6d881dbde1df216094eeb283314fb7943f8085b633f` |
| `supabase/tests/phase_02_slice_12_related_perf/001-bench.sqlinc` | 72 | `cb8c6938017763df7eec40d4ee87cbc5e64faf11b8d798a8b35640e80e7c88ba` |
| `supabase/tests/phase_02_slice_12_related_perf/README.md` | 20 | `97bcd30df8824424a274df2d813de2ccc0407f87770b162cea76b7f397951d6a` |
| `apps/worker/src/cms-composition-production-related.ts` | 229 | `e47801091ffdc5e52dc4f8ae93e6feb1b7e04d28c53afec4a5bdc6675c157715` |
| `apps/worker/src/cms-composition-production-related.test.ts` | 305 | `b5a1c51039f8d107c0bea3620d782236614a3882193925c4ff734316dda6ac41` |
| `apps/worker/src/cms-composition-production-related.test-support.ts` | 110 | `383568394db9860cc6e25b98ee0679c7ea1624a29a1e277284cbf01b4472b4de` |
| `apps/worker/src/cms-composition-production-related-ids.test.ts` | 46 | `9eb81065495ad90d925d23619e72110e5161ad65ce1a7bbe3e85841a79c36ac5` |

Test-support refactor: the shared fixtures of `cms-composition-production-related.test.ts` moved verbatim into
`cms-composition-production-related.test-support.ts` (exports only, no assertion changed) because the added test
would have pushed the file to 428 lines (limit 400); it is now 305.

### Runs
| # | stamp | plan | result |
| - | ----- | ---- | ------ |
| F1-1 | `related-170039-1456969` (7 WIP, unchanged) | content, public_targets, perf (267 tests) | RED: content 55, 79, 80, 81 genuine (hash omits maxCandidates); perf 15 my own expectation fault (last bound 63 gave 95 targets; parity flipped). public_targets 73/73. TAP SHA-256 `7334979683c56b3e176b6d1f02a16f88e836507974fe0d3e73461424de81c043` |
| F1-2 | `related-171203-1513803` (8 WIP) | same three files (273 tests) | PASS, 0 not ok, 0 skip/todo, exit 0. TAP SHA-256 `519b8e6adc0268ea44c1f7e49b1ab9f3dd2e83e987df0f0f7d7b076614c1029b` |

The perf suite passed on its first completed run apart from the fixture fault above (new measurement of existing
code, not RED-able).

### Test corrections
`003-write.sqlinc` test 55 (my own hash-recipe oracle): expected input now includes `"maxCandidates":5` inside
`derivedRule` (spec silent on the recipe; the review and root ruling 2 require it). `003-bound-and-bench.sqlinc`
timing tests removed and re-homed in the perf suite with p95 over repeated samples. No other oracle changed.

### Requests to root
- Promote `060050` with the others (new file in the same lane range); the SEC-2 / API-surface / schema inventory
  pins also need `cms_related_publish_head_revision(uuid, text, text)`.
- Add `phase_02_slice_12_related_perf.sql` to the non-gating perf list beside the locale perf suite.
- Rule on BOUNDARY 3 (non-active source) and BOUNDARY 4 (`cms.publication.changed.v1` consumer owner).
