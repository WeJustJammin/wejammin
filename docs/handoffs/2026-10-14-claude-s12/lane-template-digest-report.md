# Lane report: claude_s12_template_digest (CMS-03C-01 block_registry_digest_mismatch, full stack)

## Status
GREEN for my scope (SQL, Worker, Web all RED first, then GREEN); full Worker and Web Vitest results are in Runs. Joint-landing: SQL (WIP, unpromoted) and Worker/Web
must land together. No contracts, no `supabase/migrations/` edit, no git action.

## Scope
Brief `briefs/template-digest.md`; investigation `lane-hardening-5-report.md` item 6. CMS-03C-01 now refuses a well-formed caller `blockRegistryDigest` that differs
from the recomputed one with the closed token `block_registry_digest_mismatch` (P0001, DETAIL `["/blockRegistryDigest"]`, the pattern producers' convention) instead of the
generic `CONFLICT`; the Worker maps the exact pair to 409 with `details.reasonCode`; the template routes and the Web relay keep it on CMS-03C-01 only; the template designer
shows fixed copy.
- Latest definition of the producer: `20261013100200_cms_define_template_per_owner.sql` (`20261003120500` only changes the owner; `platform_api.cms_define_template`, last in
  `20261003120410`, only takes the key lock and restores the RPC flag, re-raises nothing, untouched).
- SQL: one anchored patch (`supabase/migrations-wip/template-digest/20261014180000_...`), exactly-once anchor, idempotent skip, 55000 on any other count, every non-body
  `pg_proc` attribute compared before/after. Stale `expectedVersion`, taken first-version key and version ceiling keep the generic `CONFLICT`.
- Worker: `mapTemplateRpcFailure` (`cms-composition-production-template-errors.ts`) maps `status < 500` + `code === 'P0001'` + `message === 'block_registry_digest_mismatch'` to
  `errorResult(409, 'VERSION_CONFLICT', ..., { reasonCode })`. The wire code stays `TEMPLATE_VERSION_CONFLICT` (route `ERROR_CODES`). New `cms-composition/conflict-details.ts`
  (`conflictReasonDetails`, list-driven by `CMS_SLICE_12_OPERATION_REASONS[operationId]` and `cmsSlice12ReasonStatus === 409`); `template-respond.ts` 409 branch relays
  `{ reasonCode }` alone when it applies, else the version pair as before.
- Web: new `server/cms-composition-platform-conflict.ts` (same helper), `cms-composition-platform-mutation.ts` `safeDetails` 409 uses it (file stays 298 lines).
  Designer: `cms-template-designer-submit.ts` returns `{kind:'conflict', status:409, reasonCode}` only for the exact token (state machine and reconcile path unchanged, still a
  definite conflict); `CmsTemplateStatus.tsx` shows `PATTERN_REFUSAL_COPY.block_registry_digest_mismatch`. FE03 names no template-designer copy for the token (FE03:883 names it
  on the sibling CMS-03C-12 pattern designer row), so the pattern designer's fixed copy is reused by import and the test pins equality. Copy is never taken from a response.

## Files
| path | lines | SHA-256 |
|---|---|---|
| `supabase/migrations-wip/template-digest/20261014180000_cms_define_template_digest_mismatch.sql` | 60 | `554e654c6f1a89aab06c741a794b28c272bca624acf9fe6015f9e19031307664` |
| `supabase/tests/phase_02_slice_12_template_digest.sql` | 29 | `23475da360a97744a105b8b6c8dc233947b5df33b4519ebf22d0ca5f193abaae` |
| `supabase/tests/phase_02_slice_12_template_digest/010-refusals.sqlinc` | 103 | `192d50df254850d38809483847ed729fed9bdae7fcc45bf8793270740ea83160` |
| `supabase/tests/phase_02_slice_12_template_digest/020-identity.sqlinc` | 34 | `30b0ce48e6d9b906d1551c4a396204a226fbf24131f56a3c8471e32b2cc87106` |
| `supabase/tests/phase_02_slice_12_template_digest/030-replay.sqlinc` | 201 | `889db390899ce99ddaf84228b99833079048ad131d9ac282eeafdc38d8cdd1fa` |
| `supabase/tests/phase_02_slice_12_template_digest/README.md` | 19 | `2de56399aade1da340b9e4f9d6cb5555a32d1ce16961fbcd8a096f1cbf9e4426` |
| `supabase/tests/phase_02_slice_12_template_authority.sql` (oracle, 1 assertion; the file also carries other lanes' uncommitted edits) | 718 | `0cdd943b6e68b63aeb2c05b7d7dfa34fa34416fa06f0638d799e8dc7b83eed8b` |
| `apps/worker/src/cms-composition-production-template-errors.ts` | 65 | `d2ef2915b34d8cbd476cbf7816d3c2373447086de09c3ef9eef83288595b556b` |
| `apps/worker/src/cms-composition-production-template-errors.test.ts` | 193 | `54d1dfc7f3e065425a7472f421f56350c6e4919292322b3dc04ae38f697ce99a` |
| `apps/worker/src/cms-composition/conflict-details.ts` (new) | 28 | `d81e1bc04a7cea672556290a9eb20bd29d1cf5dbf2117fed635c72f470890cda` |
| `apps/worker/src/cms-composition/template-respond.ts` | 155 | `ce0f01d5309442e2b8d5e5a2d12ef5c0bd3af23d17ace22a6943ca23453ff3bd` |
| `apps/worker/src/cms-composition/template-digest-mismatch.test.ts` (new) | 172 | `e41bebe5da19b3efa2ce3a2c95435b64854208f56af06c81e1dfc3cba8191219` |
| `apps/worker/src/cms-composition/README.md` (+3 lines; file also edited by other lanes) | 170 | `de8249c043e4a644f7e6e35e4a52c5c6f75ec24a4c418f501c0169517d6f53be` |
| `apps/web/src/server/cms-composition-platform-conflict.ts` (new) | 28 | `830984d94eed9e8429a7acf3230a79807c977dfd3314cad6a77c0ecafe4c1cdd` |
| `apps/web/src/server/cms-composition-platform-mutation.ts` | 298 | `376fd768916ab73843affe0b0edc2a9f02762b2db19797ccfb4072a977dbacbb` |
| `apps/web/src/server/cms-composition-platform-mutation-digest-mismatch.test.ts` (new) | 113 | `0423c550cddceba1e3ab8080866822c077009e051431ba48cb1cdb250408f0af` |
| `apps/web/src/server/README.md` (+3 lines; file also edited by other lanes) | 249 | `4db8346d27967506087a44323e08e89a765fc8443e7d7a893177207b6695f58e` |
| `apps/web/src/components/cms-composition/cms-template-designer-submit.ts` | 186 | `43a77fb81e2fc34a7c00f2352b22ac21d7af3ff9d810006a32b9693a06dcba8d` |
| `apps/web/src/components/cms-composition/CmsTemplateStatus.tsx` | 108 | `4e3f10a809add433b9a922dea5f7acd3a3e9c0c27425b33c5c9043f25fab08c4` |
| `apps/web/src/components/cms-composition/cms-template-digest-conflict.test.tsx` (new) | 128 | `14a5e5ed8d5fafbfe76ebfba73c202ab14abcc508f8911ff66d5649e6a66c4f6` |

## Runs
Clock `date -u`, 2026-10-15. DB only through the staged runner, lane `template-digest` (`none` for the one baseline). Vitest under `flock -s /tmp/wejammin-quiet.lock`, pinned PATH.
| time (Z) | stamp | what | result |
|---|---|---|---|
| 12:27-12:28 | `082719-1202327` | RED: template_authority (oracle corrected) + new template_digest, empty WIP | 99 tests, 12 failed. Genuine missing feature: authority #55, digest #6 (`have: CONFLICT`), #7 (no DETAIL), #24 (token not in body). Harness (my helper, fixed): #12-18 and #20 (`pg_exception_detail` is `''`, not NULL: now `nullif`). TAP `.lane-logs/alt-staged-template-digest-082719-1202327.tap` sha256 `f9ad6e2f3a126fc14113cec1f00a4c45fb5f800b8de4f3dd25b307739ce19fc0` |
| 12:29-12:30 | `082922-1214597` | GREEN attempt 1 | harness: my shell passed 25 files as one argument (zsh does not word-split), `Files=0, NOTESTS`, reset ok with the WIP migration applied. Not a result |
| 12:30-12:35 | `083034-1221992` | GREEN 25 files (list below), WIP migration staged | 2461 tests, 12 failed, all 12 baseline (below). template_authority 70/70, template_digest 33/33. TAP sha256 `9e6af347af554aea4f43a3bee24bc0cfbdcd4c45cb77fda49df1eea850ce66fe` |
| 12:36-12:37 | `none 083605-1252617` | baseline, promoted migrations only, the 3 files with failures | the identical 12 failures (r8_api_surface #4, #13, #14; governed_activation #27, #47, #96, #97, #108, #112, #113, #117; governed_reads #18): not mine. TAP sha256 `3ebafc31b89590f3db648573a043f2e5580aa0f92515288da35f818864f104fc` |
| 12:37-12:42 | `083742-1261791` | FINAL GREEN, same 25 files, after relaxing the malformed-digest assertion to message only (spec 373 puts the 422 pointer at the contract layer) | 2461 tests, the same 12 baseline failures only; template_digest 33/33, template_authority 70/70. TAP `.lane-logs/alt-staged-template-digest-083742-1261791.tap` sha256 `28cf1a14af3c9707f6185985be0c0229525bbf9d820aa2f4f93591cd8592b498` |
Files in the GREEN run (`phase_02_slice_`): 12_template_authority, 12_template_digest, 12_template_detail, 12_fix_template_{per_owner,reads_rpc_context,key_audience,populated},
12_block_compatibility, 09_template_compat_guard, 09_r8_api_surface, 09_dec108_resolver, 09_evidence_paths, 09_p240_{a01_aggregate,a01_grammar,identity}, 12_governed_{submit,fix,fix3,activation,assignment,decision,reads,schedule}, 12_pattern_{definition,placement}.
Baseline classification (genuine, pre-existing, same bytes with and without my WIP): `r8_api_surface` 72 enumerated vs 91 executable cms_ RPCs (Slice 12 RPCs unenumerated, P2-S09-AC-180); `governed_activation`/`governed_reads` need the unpromoted DEC-191 WIP (`supersededVersion`, `activationSchedule`) and the retire work.
Not run (need other lanes' unpromoted WIP, not affected by this change): dec191*, pattern_updates, pattern_selector, pattern_update_diff, taxonomy_terms*.

| time (Z) | what | result |
|---|---|---|
| ~12:31 | Worker RED: `template-digest-mismatch.test.ts` + 5 new rows in `cms-composition-production-template-errors.test.ts` | 7 failed / 24 passed, each for the missing relay/mapping |
| ~12:31 | Worker GREEN same files | 31/31 |
| ~12:31 | Web RED `cms-composition-platform-mutation-digest-mismatch.test.ts` | 2 failed / 17 passed (the two relay rows) |
| ~12:32 | Web GREEN | 19/19 |
| ~12:33 | Web designer RED `cms-template-digest-conflict.test.tsx` | 4 failed / 7 passed (2 submit, 2 copy) |
| ~12:34 | Web designer GREEN, whole `components/cms-composition` | 10 files, 58/58 |
| 12:37-12:38 | `tsc --noEmit -p apps/worker` | exit 0 |
| 12:38-12:40 | `astro check` apps/web | 3 errors, 0 warnings, 176 hints. None in my files: `components/cms-governed-review/governed-activation-command-transport.test.ts:330,331` (TS2345) and `components/cms-related-content/related-content-page-reads.test.ts:25` (TS2493), other lanes |
| ~12:35 | eslint `--max-warnings=0`, `prettier --check`, `git diff --check` on all touched code/test files and READMEs | clean |
| 12:40-12:57 | full Worker `vitest run apps/worker` | 673 files, 11,972/11,972 |
| 12:58-13:07 | full Web `vitest run apps/web` | 539 passed / 1 failed of 540 files; 6,613 / 6,614 tests. The failure is `components/cms-related-content/load-related-content-page.test.ts:75` (the related-content Web lane's files, in flux); none of mine |

## Test corrections
`supabase/tests/phase_02_slice_12_template_authority.sql:426-427` (CMS-03C-01 "refuses caller digest that differs"): expected message `'CONFLICT'` -> `'block_registry_digest_mismatch'`, title
now cites `[BE03c 323-327, 1273; DEC-186]`. Spec: BE03c 323-327 ("a well-formed digest that differs from the recomputed one writes nothing and is 409 with the closed
`details.reasonCode` `block_registry_digest_mismatch` on CMS-03C-01"), 373, 1273, DEC-186 item 2. Strengthening only (a distinct, more specific token); the same request, the
same no-effect position. Exact diff:
```
-select is(pg_temp.s10_last_error_message(), 'CONFLICT',
-  'CMS-03C-01 refuses caller digest that differs from current registry');
+select is(pg_temp.s10_last_error_message(), 'block_registry_digest_mismatch',
+  'CMS-03C-01 refuses caller digest that differs from current registry with the typed token [BE03c 323-327, 1273; DEC-186]');
```
No other existing test was edited. Other assertions in that file (509, 682, 705 `CONFLICT`) are version conflicts and still pass.

## Spec citations
BE03c 323-327, 373 (malformed: 422 at `/blockRegistryDigest`; well-formed but different: 409 token), 1273 (CMS-03C-01 conflict column), 1323 (closed token list); DEC-186 item 2
(`decisions.md:2677`); `refusals.ts` `CMS_SLICE_12_OPERATION_REASONS['CMS-03C-01']`; precedent `20261014020400:251-252`, `20261014110300` (token + DETAIL), `20261014150000` (anchored-patch
shape); FE03:883 (token on the sibling pattern designer row); `pattern-designer-reasons.ts` copy.

## Open items / BOUNDARY
1. No BOUNDARY. The 409 `details` is `{ reasonCode }` alone: the contract (`CmsCompositionRefusalDetailsSchema`) permits optional `violations`, but the pattern relay already sends the token alone
   and BE03c 1323 says "plus only the members named here" (none named), so the DETAIL pointer is not relayed.
2. The context read (`cmsTemplateContextRead`) has no contract row and follows `CMS-03C-01`, so its default row would also relay the token on a 409. A context read cannot raise it (it computes
   no digest), so nothing observable changes; only `cmsTemplateLatestRead` is tested to drop it. If strictness is wanted the context route must pass an operation id with its own row (contracts).
3. The first-party template designer never sends `blockRegistryDigest` (no non-test reference in `components/cms-composition`), so the closed 409 is reachable today only by a direct API caller. The
   copy and result field are in place for when the designer starts sending an expectation.
4. SQL malformed-digest refusal is `VALIDATION_FAILED` with no pointer (unchanged); BE03c 373's 422 pointer `/blockRegistryDigest` comes from the contract layer (CmsHashSchema), so I did not pin a DETAIL at SQL.
5. Populated-DB `migration up` witness not run: body-only change, no DDL or data. Root should include the usual canonical idempotent re-apply witness at promotion.
6. astro check's 3 errors, the 1 full-Web failure and the 12 baseline pgTAP failures are other lanes' (see Runs).

## Requests to root
- Promote `supabase/migrations-wip/template-digest/20261014180000_cms_define_template_digest_mismatch.sql` together with the Worker/Web changes above (joint landing) after independent review; promote the test dir `supabase/tests/phase_02_slice_12_template_digest*` with it, and add `phase_02_slice_12_template_digest.sql` to the canonical db:test list if it is enumerated.
- The `030-replay.sqlinc` copies the migration's DO block byte for byte (regenerate it by extracting the migration's DO block if the migration changes).
