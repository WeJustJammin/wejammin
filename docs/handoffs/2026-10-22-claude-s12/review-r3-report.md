# Review R3 report (`claude_s12_review_r3`) — dec205, dec206, governed-recheck WIP, repair-b corrections, root DEC-205/206 BE03c rows

Status: FINAL (2026-10-22). Reviewer: independent, read-only. No SQL, docker, supabase, pgTAP or race module was run. Three read-only
Vitest invocations on focused files and one python3 recomputation were run (see Evidence). `git status --short` listed 1,158 entries before
and after (no repository file other than this report was touched).
HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e`, worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.

## Promotion verdict per lane (details below)

| Lane | Verdict | Why (one line) |
| --- | --- | --- |
| `dec205` (2 migrations) | **PROMOTE** | No security, spec or promotability defect. One cheap hardening (R3-15) is worth making while the file is still editable; the rest is BE03c wording. |
| `dec206` (2 migrations) | **FIX FIRST** | R3-01 (MAJOR): the cursor is unauthenticated, never expires and is not bound to the acting context. That contradicts BE00:491, the sibling paged reads and DEC-206's own "PatternSelectorPage convention". Either seal it with the shared helper or record an owner waiver in BE03c before the file becomes immutable. |
| `governed-recheck` (4 migrations) | **PROMOTE** (conditions) | Trigger, person invalidation, recheck and resolver are sound. Conditions: S09 r8 inventory and `database.types.ts` updated in the same step (R3-09); root records the tenure-end decision (R3-07). R3-08, R3-13 and the header/lock note R3-20 are cheap to take now. |
| `repair-b` (no migrations, 11 edited tests + 1 new include) | **ACCEPT** all corrections | Each is required by a cited decision, no downstream assertion is weakened, the one new hash vector was reproduced independently. Green only on the joint stack. |

Counts by severity (20 findings): BLOCKER 0, MAJOR 1, MINOR 11, NIT 8 (plus the cross-lane observations below).

## Scope (SHA-256 of the bytes read)

Eight WIP migrations (all hashes equal the lane reports and the `.manifest` of every GREEN ALT run, see Evidence):

```
42568a645b5a70b1d6c8a1ba70752bd0e3c02d18fdd59515331cc1c0475be503  supabase/migrations-wip/dec205/20261022020000_cms_get_locale_variant.sql                          (193 lines)
f2a23d1280e94baf13983c2bdf6cbbbdcb8386c28c6608329e597027d82e8ee3  supabase/migrations-wip/dec205/20261022020010_cms_get_locale_variant_public.sql                   (43)
2f088d52d744110985a33c30350e27d3119e054bacd0bb02f0ebb3e26709c0e0  supabase/migrations-wip/dec206/20261022050000_cms_list_composition_instances.sql                  (201)
88fb1a9c5e1ce31c03697c432255dfbf76165938858e444f581e9610bf305be7  supabase/migrations-wip/dec206/20261022050010_cms_list_composition_instances_public.sql           (43)
abc979f2cad6248f328d2b34ac47a43eb68baa23b4dfc22fc7dce55cd668db61  supabase/migrations-wip/governed-recheck/20261022030000_cms_governed_recheck_verdict.sql           (66)
3584619ea700e122935c978385c552880d731f8d9f17c7ac9210c4938d4ed682  supabase/migrations-wip/governed-recheck/20261022030100_cms_recheck_governed_reviews.sql           (206)
7236f20e86f15199e23291c2ea1418d9c1555f3759e52c2d319e015fcd7ac409  supabase/migrations-wip/governed-recheck/20261022030200_cms_invalidate_governed_reviews_for_person.sql (117)
8731b987388c0ee14b52d7a7760b33af42fb1c035c00211a23eb89dd0ab3c8e9  supabase/migrations-wip/governed-recheck/20261022030300_cms_governed_recheck_resolve_event.sql      (73)
```

Lane pgTAP suites read in full:

```
029a51f0887f083f61d3d0f560b00c6e50bd41232503d0baf927e3470fab757f  supabase/tests/phase_02_slice_12_locale_variant_read.sql
1b3a0c5638b18d8b588796757146a6fd6679ccbc341d519650906d05973df88a  .../phase_02_slice_12_locale_variant_read/000-helpers.sqlinc
f81ce4b697c6ac3e7bf265844e99d67da867f5a8d3d34e55fd39d11da0328872  .../001-shape-and-grants.sqlinc
15a84f9c82fefec78c577e0fef20770c4d0fdd4848aade38fc109489aa15020e  .../002-read.sqlinc
239a6cf414d4d3d8abe8ac9fbd81290f9bfd6fc1cdf41a07a39a35a31945e360  .../003-authority.sqlinc
8493b2ef4ddd508017770a7317915d769548092c0dbef3a92586819cb3e14683  supabase/tests/phase_02_slice_12_composition_instances_read.sql
066782d7a4722fbc91e478474530f988f01699e25b82d04ac4dbd9a25febb545  .../phase_02_slice_12_composition_instances_read/000-helpers.sqlinc
7d785db79a41720efd037a2598fdf76c196a89941139a39b65316f978347df46  .../001-world.sqlinc
e98df8c2ad3c897e559414207e110d688d6181cb3c8ade18aada07fa67b7dce0  .../002-shape-and-grants.sqlinc
84cf8ac241afd6e2732821ca8fa510df819e2103caa712900367acaf9f8e184c  .../003-order-and-heads.sqlinc
8e07870591860853796e391ec4d1752524e33f1f2b329bcc8e3c62558e7a6114  .../004-paging.sqlinc
b081d2337d906472b94aa628b98e8f25f42c9263012716c494e1e1998e69f097  .../005-authority-and-grammar.sqlinc
a736b45472c89fb7e4b65b3f06e1b8684448afd0297b533cf70b9c4b7490b4f1  supabase/tests/phase_02_slice_12_governed_recheck.sql
a354df986cf386a461622e4287edc40179161a591ba65207bc6aab7b0346caec  .../phase_02_slice_12_governed_recheck/005-helpers.sqlinc
bf018bf5d5315b0c804139f58ff025f656a87c83f46409634a84c9338a97e97d  .../010-setup.sqlinc
03c902339fb57e6af43ef6ba4a7c10d629d0dae0e01c02e172fe65270f6d0f9d  .../020-contract.sqlinc
6333b60516118ed2dddc2a5cfd0d705d17881dedd4c8693c75478c7e95888983  .../030-person.sqlinc
caae0f37533113af4df78dbaca505d89d3b5130a87110abd07eec02f462c816c  .../040-recheck.sqlinc
16ec16849967a9ad56fde4da3cf7a28f4c0d1a1eaf1f4d7e2ecefdac237dfddf  .../050-block.sqlinc
a8132331a477271327e173f4010627a26754dc1272a60f9c893d840f1a720ea8  .../060-resolver.sqlinc
```

Test corrections diffed (before/after; baseline = the intake backup `~/.local/share/wejammin-backups/s12-dirty-20261022T052758Z.tgz` extracted into the
reviewer scratchpad for files that were dirty at intake, otherwise `git show HEAD:`):

```
1bd328d8c2a957c08515f11582822b7a90f06b95c72352a99f9f2810056c7b9b  supabase/tests/phase_02_slice_10_compare_lineage_domains.sql
bff09456c507eff276badb9c20267f974fabb76c960aa5c193035c7bb6cedeba  supabase/tests/phase_02_slice_10_comparison_domains.sql
338ccdffae0fe206a823d75337e0b8e903a5040aabcc6ff9e4ef63c472515f01  supabase/tests/phase_02_slice_10_ev_eb_publication_scope.sql
7c2dff093bff05e02973ef9bc747897d9ffac1358885a11b61469a0c6395a626  supabase/tests/phase_02_slice_10_write_path_locks.sql
2b10b6814f95c1e86a1f4ca7e515af573c7bcc9d5ad1fa57796dd4a8828f1e17  supabase/tests/phase_02_slice_10_restore_transform/001-seams-and-validators.sqlinc
3ac6965077555d49b896e434529c0e3b0e045e6d8adf95a94ba1cbef795573c3  supabase/tests/phase_02_slice_11_checker_render_plan.sql
0bb5811ff23ee16b093b380dd19a410d57df5fcb0d4cb2668ac2d73c94e166bc  supabase/tests/phase_02_slice_11_helpers_manifest.sql
cb6eb51f5259706e906bf0a9e4d6552c2b7c72e868cd167310822722a9afb3e1  supabase/tests/phase_02_slice_11_preflight_registry_schema.sql
0ad2fa17be2d91a2a021796e649376e40d78ccbfda1af0ff2896b442a24b3469  supabase/tests/phase_02_slice_11_recheck_index.sql
9da801bfe42807c95c77d0056e72c8489a2a45900ce5fd61494a914e3378a6ab  supabase/tests/phase_02_slice_11_recheck_run.sql
1d0e00f4189167f8c4812eabc5df0dfbb19428bd746bc3c1c96dd5a69efd416e  supabase/tests/phase_02_slice_11_rpc_reads_gate.sql
ed843eacd98a4cf1754c0fbae5d8524d0a8384889aaec94aab7b7f88ed65d25c  supabase/tests/phase_02_slice_11_pattern_forest.sqlinc               (new)
16ce585ea82b6b74feb2c5d5374bfe1d7b42ed4397706e8fa4912dc0b1779927  supabase/tests/phase_02_slice_12_governed_activation/060-invalidation.sqlinc
f4a111630bee6a3ae45516a3110d0f93c38e66cc2e6e4e003a4a6378ba81d33c  supabase/tests/phase_02_slice_12_governed_activation/095-retire.sqlinc
31af9dd1ecb384d04648ae5252aa2f2ab214958a49283ed822770b094335705b  supabase/tests/phase_02_slice_12_governed_decision/050-invalidation-gates.sqlinc
ad6165ae850003ff22601bb5a695e02b4f99bf8fcb9d713d83f87e499719b047  supabase/tests/phase_02_slice_12_governed_decision.sql
1303d01c7a34387665d51b8e11e69a150ca525b304c064e90a48e903539a8b37  supabase/tests/phase_02_slice_12_governed_schedule/055-fire-approval.sqlinc
f15940c3e10f380650de4656d9fbc6b3ab3d541eaaac216f4dbac262e929b39c  supabase/tests/phase_02_slice_12_dec191/040-detail.sqlinc
d686cdaa3656bbf3882c1603a2535709e7825cc3fc0b7c047e3be5365a381038  supabase/tests/phase_02_slice_12_dec191/010-setup.sqlinc
04556a5eae3198f815e859fb25e8a226ab0952bd3c4dd02321d926e8b9ed218c  apps/worker/src/production-async-entrypoint-review-recheck.test.ts
f928aabdb0417765e04f545ae98ad8015aa3c3d00d84ceec7e641f5ade064e93  supabase/tests/phase_02_slice_09_r8_api_surface.sql
f1e71aeefd1487b48774625e83e34801fa5ad1cf29006581054e50a009b55132  apps/worker/src/cms-composition/locale-routes-refusals.test.ts
056ebcb1b86d98cfbdbd625949f56d0d2f02dc709b99b9e34a81d15a8d7b551f  apps/worker/src/cms-composition/locale-routes.test-support.ts
ebf0761f426564f449ab32a6f7d9aff112d8d0f05880af245a7a23afe692b57c  apps/worker/src/cms-composition/capability-missing-refusals.test.ts
ad7b51234490f0a292fa6ee73613515e94d3d1e5bd21f9a18d6c510ad5ab8379  apps/worker/src/cms-composition/write-header-order-locale-related.test.ts
0f9c7d266ae9ad51426bb45375fec49ceaad44614cd91cad19e71ccddfcac477  apps/worker/src/cms-composition/pattern-update-order.test.ts
1ddb0241bcf1aed2bf1346af93f793aa9eeb51dc1017fbe75bf943ef9d11b072  apps/worker/src/production-worker-runtime-pattern-update.test.ts
74d38be907eca24436271c0e81b9fa901ca6b5c81a1f8bed13a15a53df8c94f5  apps/worker/src/cms-composition/pattern-update-routes.test-support.ts
2a367f5016ffc69d2f0c7eaf3c1e651972663298468efbbb8e6ff914f3e5c8ba  apps/worker/src/cms-composition/phase-02-slice-12-dependency-unavailable.test.ts   (stub only; carries other lanes' edits)
```

Sources: lane reports `lane-dec205-read-report.md` (`50ad951b…`), `lane-dec206-read-report.md` (`db262be8…`), `lane-governed-recheck-report.md`
(`a05f2840…`), `lane-repair-b-report.md` (`828d12d3…`); BE03c `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`
(`b47b0567c3f9f6b1445283c835f675102d1f00fb77ba7470c184aa2c0728766c`), BE03b (`f65889b0…`), BE00 `00-infrastructure.md` (`f11da5b7…`);
DEC-205, DEC-206 and DEC-207 exist only as raw records in `.memory/raw/events/2026-10-22.jsonl` (`6f359294…`; compile not run, so
`.memory/wiki/decisions.md` does not contain them); DEC-140 (`decisions.md:4625`), DEC-166 (`:4938`), DEC-180 G6 (`:2603`).

## Brief checks, per lane

1. **Security** (all 11 functions: dec205 2, dec206 2, governed-recheck 7). Every function is `security definer`, `set search_path = ''`, owned by
   `wejammin_cms_definer` through the `grant create … / alter … owner / revoke create` bracket, `revoke all … from public, anon, authenticated, service_role`,
   and `execute` is granted only on the four `platform_api` wrappers, to `service_role` (the private functions and the trigger function have no API
   grant). No grant to a browser role, RLS untouched (still forced; the policy is `cms_rpc_context_valid()`), the only dynamic SQL is the closure
   `do` block over a fixed callee list resolved through `regprocedure` (no user input). The reads write and lock nothing (the suites assert it on
   the function bodies). Authority is the helper CMS-03C-04 uses (`cms_require_entry_capability`, dec205, BE03c 1633) and the `cms_authority_origin`
   pair CMS-03C-02 uses (`capability_missing`, dec206, BE03c 1643); hidden/absent/foreign-owner entries are one uniform `NOT_FOUND` before any
   authority answer; no content or identifier leaks into an error. Governed-recheck is service-role only (BE03c 1612).
2. **Spec correctness**: see the findings. dec205/dec206 answers match the BE03c schemas member for member (13-member resource, five-member
   `LocaleVariantRead`, `{revisionId, items, nextCursor}`), the order check (envelope 400, session 401, grammar 400, concealment 404, authority 403)
   matches BE00:377-390 (authentication, acting context, boundary validation, authorization), and the render order is the render plan's own
   (region is the constant 1 for every composition row, so `(slot ordinal, position, path bytewise, id)` is the plan restricted to blocks; the
   three-shape parity test is in `003-order-and-heads.sqlinc`).
3. **Promotability**: timestamps unique across the 461 promoted migrations and all WIP files (python scan); all eight are newer than the newest promoted
   file (`20261020203606`) and inside their assigned lane ranges; no `create or replace` of a live function (every name is new, so there is no lost-tail
   risk), no backfill, no constraint validation, forward-only, 193/43/201/43/66/206/117/73 lines (all under 300), dollar quoting balanced,
   `begin … commit` framed. dec206 requires dec193 first (its closure raises `55000` without `cms_revision_effective_composition`; its suite also needs `pattern-updates` for
   `pending_diff` fixtures): their timestamps (2026-10-14 and 2026-10-16/17) are earlier, so the timestamp order holds. dec205 and governed-recheck depend only on promoted objects.
4. **Locks**: dec205/dec206 take none. Governed-recheck follows BE03c 1495 per review (subject FOR UPDATE through
   `cms_governed_subject_resolve(…, true)`, then the review FOR UPDATE, in `cms_governed_invalidate_approved_review`), the person invalidation runs
   inside the revoking transaction after the revoker's own position-1 `UPDATE` (the trigger is AFTER ROW on the row the revoker just updated). Two deviations: the recheck verdict takes `FOR SHARE` on block rows before the subject lock (R3-20), and multi-review runs interleave subject and review locks (R3-12).

## Findings

Severity: BLOCKER (must not promote), MAJOR (fix or record an owner decision before promotion), MINOR (fix or decide, not promotion-stopping), NIT.

| Id | Sev | File:line | Evidence | Spec / decision | Proposed fix |
| --- | --- | --- | --- | --- | --- |
| R3-01 | **MAJOR** | `supabase/migrations-wip/dec206/20261022050000_cms_list_composition_instances.sql:19-23, 62-80, 110-125, 157-160`; `supabase/tests/phase_02_slice_12_composition_instances_read/004-paging.sqlinc:46-62` | The cursor is `base64(JCS({h,i}))`, `h = sha256(JCS({entryId, revisionId}))`, `i` = last row id. Both inputs of `h` are known to the caller, so any principal who may read the entry can mint a valid cursor; the same cursor is accepted from every principal, with no `expiresAt`, for ever, and no contract version. The suite builds cursors by hand (`s12ci_cursor_make`) and only a wrong `h` is rejected, the header calls this "unsigned on purpose". The security impact today is nil (a forged cursor only repositions inside the caller's already authorized result set), but the shared sealed-cursor mechanism exists and is what every sibling paged read of this slice uses: `cms_signed_cursor_open/seal_page` (HMAC under the Vault key, domain separator, 24 h cap, `20261005010400_cms_revision_comparison_domains.sql:95-290`) wrapped as `20261014140310_cms_list_pattern_selector_public.sql`. | BE00 `00-infrastructure.md:491` ("opaque authenticated cursors … expires within 24 hours and binds route, normalized filters, sort, deterministic unique tie-breaker, audience, user/acting context, and contract version. Tamper or cross-context reuse returns 400"); BE03c registry rows 172, 178, 180, 185 (`cmsTaxonomyTermsRead`, CMS-03C-11/13/17: "signed keyset cursor") and matrix rows 1408, 1410, 1415, 1417 (409 "cursor/context mismatch"); DEC-140 (`decisions.md:4625`); DEC-206 raw record ("opaque nextCursor (PatternSelectorPage convention)"); BE03c 409 ("issued by this read" is not enforceable by an unkeyed hash). | **A (recommended)**: keep the keyset reader, add `cms_list_composition_instances_signed` exactly like CMS-03C-13 (domain label such as `cms-03c-02r`, payload `{queryHash, lastInstanceId, expiresAt}` with `queryHash` over actor, acting party, entry id, revision id and page size; `cms_signed_cursor_require_key`, `_open`, `_seal_page`), keep 400 for a structurally malformed envelope, and take the sibling mapping (409 `COMPOSITION_VERSION_CONFLICT` for unverifiable/expired/foreign-bound) or the BE00:491 literal 400 as ONE recorded decision; update BE03c 182/409/1412, the Worker (`composition-instances-routes.ts:76` today treats 409 from the port as a contract failure) and contracts. **B**: an owner waiver of BE00:491 for this read recorded as a DEC and written into BE03c 182/409 ("unauthenticated positional cursor, no expiry, any principal with edit authority may reuse it"). |
| R3-02 | MINOR | `…/dec206/20261022050000…sql:35` (`c_page constant integer := 100`); BE03c 1188-1196 (`.max(100)`); `packages/contracts/src/cms-composition/composition-instances-read.ts:29` | Page size is fixed at 100 with no `limit`. BE00:491 allows `limit` 1..50, default 25 (CMS-03C-13: `limit` 1..50, default 25). The 100 is in the root detail of the DEC-206 record, next to the "PatternSelectorPage convention" it contradicts. | BE00:491; DEC-206 record | Record the exception in BE03c 182/1188 (owner-visible), or use 50 (11 pages for the 512-row placement, the Web loader follows cursors server-side anyway). |
| R3-03 | MINOR | BE03c 182, 409, 1188-1190, 1412 (root rows) | (a) Row 182 omits the cursor discipline every sibling paged row states ("signed keyset cursor", cursor/context binding). (b) Matrix row 1412 puts 409 as "not applicable to bounded read" for a paged collection; the siblings say "cursor/context mismatch". (c) The order text "region, slot ordinal, `position`, `path`, `id`" (1190, the DEC-206 record, the header of `composition-instances-read.ts`) names `region`, which in the render plan is 0 for fields and the constant 1 for every block row, so it never discriminates among composition rows; the SQL correctly omits it. (d) The validation row "issued by this read" cannot hold for an unkeyed cursor (R3-01). | BE03c sibling rows 172/178/180/185 and 1408/1410/1415/1417; DEC-206 | After R3-01 is decided: state the cursor policy in 182/409, make 1412 match, say "slot ordinal, position, path, id". |
| R3-04 | MINOR | `apps/web/src/components/cms-composition-instances/load-composition-instances.ts:14` (`MAX_INSTANCE_PAGES = 20`); FE03 changelog row 2899 ("at most 2,000 rows") | The cap is invented. Neither BE03c nor DEC-206 bounds the heads of a revision; each placement may write 512 rows and the number of placements is not bounded, so a legitimate revision above 2,000 heads makes the composition page permanently `unverified`. | BE03c 1511 (512 per placement, no per-revision cap), DEC-206 | Bound heads per revision in BE03c/BE03b and enforce it in CMS-03C-02/15/carry/restore, or replace the page count by a deadline-bound loop; do not publish "at most 2,000 rows" as a spec fact until one of the two exists. |
| R3-05 | MINOR | `…/dec205/20261022020000_cms_get_locale_variant.sql:78-79` (authority) before `:86-88` (supported locale) | A visible entry without edit authority gets `FORBIDDEN` (403) even for a locale outside `supportedLocales`; BE03c 397 reads "else the same policy-safe 404 as a hidden entry" for any caller. The implemented precedence is the safer one (a caller without edit learns nothing about the configured locales) and the suite asserts it (`003-authority.sqlinc`, "authority is answered before the locale"), but the spec does not say so. | BE03c 168, 397, 1633; DEC-205 | One sentence in BE03c 168/397/1633: "authority is answered before the locale check; an unsupported locale is 404 only for a caller with edit authority". SQL unchanged. |
| R3-06 | MINOR | `…/dec205/20261022020000…sql:118-128, 131-139`; write bound `20261002167000_cms_locale_author_active_configuration.sql:82` (`cms_json_bounded(p_request, 262144, …)`) | The write accepts up to 262,144 bytes of request, the read echoes the stored values (plus a 60-byte wrapper per field) and adds up to 128 resolutions (about 200 bytes each, 25 KiB) and the resource, so a variant written near the bound cannot be read back inside the 256 KiB response ceiling; the Worker then answers a response-contract failure and the translation page cannot load it. | BE00:486; BE03c 1402 ("response-contract failure") | Lower the translate request bound so values plus resolutions fit (for example 192 KiB of `fields`), or specify and test the over-ceiling outcome. No SQL change needed for the second option. |
| R3-07 | MINOR (decision) | `…/governed-recheck/20261022030200…sql:99-102`; five suites listed under Test-correction verdicts | The trigger covers `organization_actor_grant` only; the 03b mirror also wires `membership_tenure` (`20261005017580_cms_review_invalidation.sql`, trigger `cms_membership_tenure_review_authority`). A governed reviewer who leaves the organization keeps the review `approved` and the schedule `pending` until the next recheck, decision or fire (the activation recount makes it safe, tested). Five existing governed suites now use "a tenure end, a loss no trigger covers" as their lag fixture, so they encode the gap. | BE03b 1736 (authority revocation includes "the membership tenure end"), 1755 rule 7; BE03c 1478 and AC-204 name only the grant revocation. | Root records the decision in BE03c 1478 and a DEC: keep ("tenure end is found lazily") or add a second AFTER UPDATE\|DELETE trigger on `membership_tenure` passing `(old.person_id, null)`; if added, the five suites need another lag source. |
| R3-08 | MINOR | `…/governed-recheck/20261022030100…sql:122-130, 132-145` | Only `DEPENDENCY_UNAVAILABLE` (verdict) and `review_not_open` (invalidation) are tolerated; any other error re-raises, the Worker retries (`job.ts` `RECHECK_RUN_FAILED`) and finally dead-letters while the cursor cannot advance past that review, so one poisoned review stops every review behind it. The header only promises non-blocking for `unavailable`. | BE03c 1476 ("idempotent", "500 per run with a continuation cursor") | Isolate any non-lock error per review (count it as `unavailable` or a new `failed` member, keep `deadlock_detected`/`lock_not_available` retryable) and report the review id in telemetry. |
| R3-09 | MINOR | `supabase/tests/phase_02_slice_09_r8_api_surface.sql:160-167, 235`; `packages/data-access/src/database.types.ts` | The inventory classifies `cms_get_locale_variant` and `cms_list_composition_instances` but not `cms_recheck_governed_reviews` and `cms_governed_recheck_resolve_event` (lane run: #4/#13/#14 red); the label reads "8 + 10 + 74" while 75 are enumerated (77 with the two); `database.types.ts` has none of the four RPCs. | BE03c 1612 | Root: add both names to the supporting list, fix the label, run `db:types`, in the same promotion step. |
| R3-10 | MINOR | BE03c 1612 | The closed RPC list names `cms_recheck_governed_reviews` but not `cms_governed_recheck_resolve_event` (platform_api, service_role) or the private `cms_governed_recheck_event_ref`. The Slice 11 resolver is equally unnamed, so the pattern is accepted, but the closed list has no anchor for the new RPC. | BE03c 1612; DEC-166 | Add both names to 1612. |
| R3-11 | MINOR (test gap) | `supabase/tests/phase_02_slice_12_governed_recheck/030-person.sqlinc` | Not covered: (a) a renewal/re-grant through CMS-03A-15 (the `ON CONFLICT DO UPDATE` path of `cms_capability_grant_project` fires the trigger) leaves live reviews untouched; (b) the same person holding the capability in two organizations, revocation in one leaves the other's reviews live (cross-party reach rests on `cms_person_holds_capability(review.owner_id, …)` inside `cms_governed_review_qualifying_decisions`, not exercised here); (c) the DELETE branch of the trigger (`new` is null); (d) base capability revoked while the decision was recorded under the specialist capability (documented: stays counted). | BE03c 1478; AC-204 | Add the four cases. |
| R3-20 | MINOR | `…/governed-recheck/20261022030100…sql:22-24, 113-148` (header claim, loop); callee `20261013300400_cms_governed_frozen_status.sql:96-110` (`cms_governed_current_digest`, live body `20261014040000_cms_governed_digest_pattern_order.sql`) and `20260927240000_cms_template_digest_supported_lifecycle.sql:41` (`cms_template_block_digest`) | The header says the verdict "is decided from plain reads; only a review that no longer holds is locked". It is not: `cms_governed_frozen_status` computes the block digest through functions that take `FOR SHARE` on the reachable `cms_block_definition_versions` rows, for every one of up to 500 reviews, before the invalidation takes the position-3 subject lock, and holds them to the end of the run. Activation takes the opposite order (subject, then blocks) and CMS-03A-08 `cms_advance_block_lifecycle` takes `FOR UPDATE` on the same rows (`20261002208000_cms_advance_block_lifecycle_typed_transition.sql:59`). Block rows are not a BE03c position. Cycle: the run holds block B (share) and waits for subject S; an activation holds S and queues for B (share) behind a pending lifecycle `FOR UPDATE`; the lifecycle waits for the run. PostgreSQL detects it and the wrappers type it (`CONFLICT`), so it is noise, not corruption; also the verdict is not re-evaluated under the subject lock before the CAS update. | BE03c 1484-1495 ("never acquires an earlier position after a later one"); BE03b 1736 | Compute the verdict with a lock-free digest (the DEC-199 `cms_pattern_registry_digest_readonly` pattern, plus a template equivalent) and re-run `cms_governed_frozen_status` after the subject lock, or take the subject lock first; correct the header. |
| R3-12 | NIT | `…/030100…sql:113-148`, `…/030200…sql:41-67` | Multi-review runs lock subject then review per review in ascending REVIEW id (S1,R1,S2,R2…). BE03c says "never acquires an earlier position after a later one" and "ascending id within a position", which strictly means all subject locks (by subject id) before the review locks. Practically safe: every multi-review writer uses the same order, a live review has a unique subject (`cms_governed_reviews_live_subject_unique`), and deadlocks become `CONFLICT` in the wrapper and in CMS-03A-17. | BE03c 1484-1495; BE03b 1736 | Say so in BE03c, or pre-lock the subjects ascending. |
| R3-13 | NIT | `…/030200…sql:99-102` | `drop trigger if exists …` takes ACCESS EXCLUSIVE on `identity_private.organization_actor_grant`, a table read by every CMS authority check, so the migration queues all readers behind in-flight ones until `lock_timeout` (5 s). The trigger is new, plain `create trigger` takes only SHARE ROW EXCLUSIVE. The trigger has no `WHEN`, so every renewal runs the person scan (index `cms_governed_review_decisions_reviewer_decided_idx`, cheap and correct). | – | Drop the `drop trigger if exists`. |
| R3-14 | NIT | `…/030100…sql:2, 22`; governed-recheck tests; WIP dir | Migration comments cite BE03c "1482" for the lock-order row (now 1495; 1482 is the heading) and the tests cite 1463 (Invalidation, now 1476), 1465/1466 (G6, now 1478) and 1599 (RPC list, now 1612); the dir has four files and no README (extensibility rule). The comments become immutable on promotion. | `.claude/rules/extensibility.md` | Cite section names; add a README. |
| R3-15 | NIT | `…/dec205/20261022020000…sql:118-128` | `fields` is not filtered by `value_row.locale`; the table key `(revision_id, field_id, locale)` permits several locales per revision in principle (an S11 fixture forges one) and the contract refuses duplicate field ids. Unreachable by producers; the invariant "never another locale's value" is by convention only. | BE03c 1633 | Add `and pg_catalog.lower(value_row.locale) = pg_catalog.lower(v_variant.locale)`. |
| R3-16 | NIT | `…/dec205/20261022020000…sql:78-79` vs `…/dec206/…sql:88-90`, DEC-195 | dec205 raises the helper's `FORBIDDEN`, DEC-195 and dec206 raise `capability_missing`; the Worker keeps two mappings. Deliberate (read and write refuse identically, suite `l205_pair`) and harmless. | BE03c 1450 | Note it, or normalize in the wrapper. |
| R3-17 | NIT | BE03c 195 | Names `cms_resolve_locale_field` as the editorial reads' resolver; the read calls the core `cms_locale_resolutions` (one statement, same semantics, tested equal per field). | BE03c 195, 1554 | Name the core in 195. |
| R3-18 | NIT | `…/dec206/…sql:121-124, 135-139` and header | The slot-rank expression is a copy of the render plan's (live body `20261016042500_cms_revision_render_plan_dec193.sql` in WIP), not shared; parity is guarded by `s12ci_plan_paths` for three shapes only; the header cites `20261005017910`, which the dec193 plan supersedes. | lane brief ("reuse its ordering logic") | Extract a shared rank helper when the plan is next touched; fix the comment. |
| R3-19 | NIT | `supabase/tests/phase_02_slice_11_pattern_forest.sqlinc` | `h11x_forest` updates pattern definition rows through `h11_raw_exec`, which disables user triggers on the table for the statement. It is the existing S11 harness mechanism (the rows are already forged raw), not a new bypass class, but the producer CMS-03C-12 exists. | brief check "no disabled triggers" | Track as harness debt; replace with the producer when the S11 helpers are next unfrozen. |

Note on hash drift: governed-recheck Worker files `job.ts`, `source-consumers.ts` and `production-async-entrypoint.ts` differ from the hashes in the lane report (later edits by another lane, they now import `observability-registry`); the focused Worker tests still pass (82/82). Not a migration matter.

## Verdicts on root's four ratification asks (dec206)

| Ask | Verdict | Reason |
| --- | --- | --- |
| Unsigned cursor, every cursor fault 400 | **REJECT unsigned; ACCEPT 400 for structural faults** | BE00:491 requires authenticated, expiring, context-bound cursors; the shared helper exists; DEC-206 cites the PatternSelectorPage convention, which is sealed. For unverifiable/expired/foreign-bound the sibling family and DEC-140 answer 409 while BE00:491 says 400: root must choose one rule and write it down (R3-01, R3-03). |
| No ETag | **ACCEPT** | BE03c 182 names none; the write operands are the entry aggregate version (from CMS-03B-11) and each instance's own `version`, both obtainable without a list ETag; `pageVersion` exists on selector reads only because they have no per-item version. Add "no entity tag" to row 182. |
| Entry lifecycle unconstrained | **ACCEPT** | CMS-03B-11 returns the entry `lifecycle` to the same principals, DEC-195 reads the same way, the write refuses with `revision_not_editable`, and no authority row (1633, 1643) conditions the read. The same holds for dec205. Add one sentence to 1633/1643. |
| Loader cap 20 pages | **ACCEPT as a fail-closed guard only; REJECT as a recorded spec fact** | It never truncates (it refuses), which is right, but the 2,000-row figure has no BE-level bound behind it (R3-04). |

## Test-correction verdicts

Fixture rule applied: no direct active-row insert that skips authority, no disabled trigger, labelled forgeries only where no producer exists.

| Lane | Change | Verdict | Reason |
| --- | --- | --- | --- |
| governed-recheck | `production-async-entrypoint-review-recheck.test.ts` (Slice 11 wiring): operations list now governed-resolve, editorial-resolve twice, one run; `send` 2 → 4 | **ACCEPT** | A schema event is now also consumed by the governed producer (AC-202, DEC-166 shape). The editorial assertions (`cms_dependency_recheck_resolve_event`, `cms_dependency_recheck_run`, the `cms.review.dependency_recheck` message) are intact. Focused run: 8 files / 82 tests pass. NIT: also assert the governed message in `toHaveBeenCalledWith`. |
| governed-recheck | `governed_activation/060-invalidation` (gr7), `095-retire` (gq2), `governed_schedule/055-fire-approval` (eb), `dec191/040-detail` + `010-setup` comment (db), `governed_decision/050-invalidation-gates` (r7) + `governed_decision.sql` `plan(57)` → `plan(58)` | **ACCEPT** (condition R3-07) | The original comments say "G6 does not exist yet, so the review row itself still reads approved". BE03c 1478/AC-204 now make a real CMS-03A-17 revocation invalidate in its own transaction, so the lag these suites prove (activation/fire/decision recount refuses a short count) can only be made by a loss no trigger covers. Diff-verified: every downstream assertion is unchanged; each swap adds a control that the live recount is 0 and the stored state still lags. The persisting `ended` tenures are never reused later in the same driver (grep of the following fragments). In `050` the tenure is re-confirmed by a labelled `ended → confirmed` update (not a production transition) before the original real-revoke control is kept for R8, so R8 still proves the grant. The real-revoke path is covered by `governed_recheck/030-person.sqlinc` (pa1, pa2 scheduled, po1 open, pm1 specialist) and the pending race module. The forgery is a direct `UPDATE identity_private.membership_tenure` (labelled, fires the existing 03b trigger, no trigger disabled, no governed row written). |
| repair-b | `compare_lineage_domains` #12 | **ACCEPT** | Two active versions of one path are one history (BE03c 1511, DEC-193); asserts exactly one block change at `/blocks//hero`. The 256-character pointer refusal is kept. |
| repair-b | `comparison_domains` #8 | **ACCEPT** | Same strength (source-text pin): the compare body must call `cms_composition_instance_content`, whose definition must carry `blockRegistryDigest`, `bindings`, plus the added `blockKey`, `patternRef` (BE03b 1712). The exact hash is still asserted by #11. |
| repair-b | `ev_eb_publication_scope` #2, #5 | **ACCEPT** | Closed-list pins extended with `cms_recheck_governed_reviews` (BE03c 1495/1612) and `publication_projection` (BE04c 345, DEC-197). Valid only with governed-recheck and dec197 promoted. |
| repair-b | `write_path_locks` #11 | **ACCEPT** | The WIP restore (`dec193/20261017044800`) replaces the batch `cms_lock_entry_rows_shared` by per-target `cms_lock_relation_target` (BE03b position 2, DEC-201); append and resolve keep the batch pin. |
| repair-b | `restore_transform/001` fixture `s10r_forge_target` | **ACCEPT** | A same-party target gets the creator/editor assignments exactly like the forged source entry; the foreign target stays unassigned so the tenant rule is still tested alone. Without it the over-bound and full-translation cases are refused first for the wrong reason (BE03b 1750 rule 2). Direct `cms_entry_assignments` inserts are the established fixture in 20 test files (no entry-assignment producer exists). |
| repair-b | `checker_render_plan` #24, #25 | **ACCEPT** | Order i1 then i2 by authored position (the harness helper `h11m_instance` assigns position 0 and 1, BE03c 1511, DEC-185). The new vector `1cf797d0…` was reproduced independently (python: `rp1` `f3d27279…` unchanged, old order `2cb8fc5d…`, new order `1cf797d0…`). |
| repair-b | `rpc_reads_gate` #17, #24, #25 | **ACCEPT** | `pending_diff` rows need `pending_pattern_version` (BE03c 1426), render their pinned version (1515), order by position (DEC-185); the superseded head stays excluded; the fixture is labelled raw. |
| repair-b | `preflight_registry_schema` fixture version 2 → 99 | **ACCEPT** | Slice 12 registers registry version 2 of pattern, taxonomy and locale (BE03c 1564); the guard asks only for a strictly newer version. |
| repair-b | `helpers_manifest`, `recheck_index`, `recheck_run` + new `phase_02_slice_11_pattern_forest.sqlinc` | **ACCEPT** (NIT R3-19) | Pinned rows must sit at a block-root key chain of the pattern version, below the template slot when the revision has a template (DEC-186, BE03c 1511) and a live pin is current only while the stored digest equals the recomputed one (DEC-199, BE03c 1564). The deprecation case (test 72/73) keeps its meaning through a standalone `h11.second`; the pattern-reaches-deprecated-block behaviour is now owned by `dec193_pattern_currentness/020` (`pattern_digest_changed`, PC-D06/D07). |
| dec205 | Worker `locale-routes-refusals.test.ts` (route inventory gains the GET), four stub additions for the new port (`locale-routes.test-support.ts`, `capability-missing-refusals.test.ts`, `write-header-order-locale-related.test.ts`, `phase-02-slice-12-dependency-unavailable.test.ts`) | **ACCEPT** | BE03c 93/167; the resolver still has no route (probes unchanged); stubs throw or answer 500 so no write suite can reach the read. The fourth file also carries edits of other lanes (for example `retryable: true` for 502) that were not reviewed here (`2a367f50…`). |
| dec205 | `phase_02_slice_09_r8_api_surface.sql` +1 row | **ACCEPT** | A service-role RPC must be classified. Label stale (R3-09). |
| dec205 | pgTAP hardening after RED (14 vacuous passes) | **ACCEPT** | Non-vacuity controls added; the TAP of the final run is 119/119. |
| dec205 | Web rewrites replacing the SG-S12-05/06/07 sentinels | **ACCEPT in principle** (not read line by line) | The boundary-not-placeholder rule says a sentinel is replaced by behavioural tests when the spec exists. |
| dec206 | Worker `readInstances` stubs (3 files) | **ACCEPT** | Mechanical, one member. |
| dec206 | `r8_api_surface` +1 row | **ACCEPT** | Same as dec205. |
| dec206 | Web oracle changes (list shows rows as given, BOUNDARY sentinel replaced, four reads) | **ACCEPT** | FE03 887 and DEC-206 make the server order the order; the slot ordinal is not a row member, so a client re-sort would be wrong. The pre-edit files have no baseline (created in this resume). |

## Evidence

- **GREEN runs corroborated from `.lane-logs`**: dec205 `alt-staged-dec205-031554-3426511` (119 ok / 0 not ok, `lane=dec205 wip=2`); dec206 `alt-staged-pattern-updates+dec193+dec206-034556-3577587` (246 ok / 0 not ok, ends with the final end-of-file test); governed-recheck `…031838-3445858` (835 tests, the 2 failures are the two suites fixed afterwards) and `…034610-3579209` (182 ok); repair-b `…143013-2012254` (Files 177, Tests 6,277, 0 not ok, `wip=75`). Each manifest records the SHA-256 of the staged WIP files and every in-scope migration matches the bytes reviewed (dec205 2/2, dec206 2/2, governed-recheck 4/4 in both runs, 8/8 in the final run).
- Focused read-only Vitest: `apps/worker/src/production-async-entrypoint-review-recheck.test.ts` + `apps/worker/src/cms-composition/governed-recheck` = 8 files / 82 tests pass; the two read contracts, their OpenAPI tests, `registries`, `error-catalog`, `refusals-operations` = 7 files / 79 tests pass.
- The Worker adapters that map the two reads' SQL tokens: `cms-composition-production-locale-read.test.ts`, `locale-read-refusals.test.ts`, `locale-read-routes.test.ts`, `composition-instances-routes.test.ts`, `cms-composition-production-pattern-update-instances.test.ts` = 5 files / 110 tests pass.
- python3 (scratchpad): reproduced the three render-plan hash vectors (above).
- Not run (not permitted): pgTAP, race modules, `db:verify`. The governed authority race module `phase_02_slice_12_governed_authority.race.mjs` is the CMS-03C-06 submit fence (its revoker-writer-subject chain is unaffected by the trigger: no candidate review exists for the submitter's designer capability), but root should still run it after promotion as the lane asked.

## Cross-lane observations (not counted)

- 65 WIP migrations of other lanes (dec193, pattern-updates, dec195, locale-gate, dec194, dec197…) have timestamps older than the newest promoted migration `20261020203606`. Promoting them "in timestamp order" is fine for `supabase db reset`, but `supabase db push` on an already migrated database refuses migrations inserted before the last applied one unless `--include-all`; root should decide on re-timestamping before the joint promotion.
- repair-b's corrected oracles are green only on the joint stack (dec193, pattern-updates, dec197, governed-recheck, dec205/206 registries); none is green on promoted-only, so they must land in the same change as the migrations.
- BE03c 945 admits `conflictState` `'pending_diff'`, but the resource builder (`20261014110250…sql:91`, dec193 `20261016041300…sql:21`) emits `'none'` for every linked row, including the `pending_diff` rows the new list read is the first to list. Harmless today (the page keys on `state`), but the enum and the builder disagree; R1/dec193 owns it.
- The lane reports and the governed-recheck comments cite BE03c line numbers from before root added the DEC-205/206/207 rows (offset +13); only section names stay valid.

## What root must do before promotion

1. `dec206`: decide R3-01 (sealed cursor, or owner waiver of BE00:491 written into BE03c 182/409). Nothing else blocks it.
2. Joint step: classify `cms_recheck_governed_reviews` and `cms_governed_recheck_resolve_event` in `phase_02_slice_09_r8_api_surface.sql`, fix its label, run `db:types` (R3-09); promote repair-b's test corrections in the same change.
3. Record the tenure-end decision (R3-07) and the BE03c wording items (R3-03, R3-05, R3-10, R3-17).
4. Optional while the files are still editable (each is one small edit): R3-08 (per-review error isolation), R3-13 (drop the `drop trigger if exists`), R3-15 (locale filter), R3-20 (lock-free verdict or subject-first, header text).

## Open questions for root (one per line, decision owner in brackets)

1. dec206 cursor: option A (sealed, 409/400 rule chosen) or B (owner waiver of BE00:491)? [owner/root]
2. Governed reviews and membership tenure end: keep lazy or add the second trigger? [owner/root]
3. Per-revision bound on composition heads (R3-04) and translate request bound (R3-06)? [root, BE03c/BE03b]
