# Lane report: claude_s12_worker_taxonomy_terms

## Status
GREEN for the lane scope. Worktree HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e` (verified at start and at the end); no SQL, no contracts, no Web, no shared pgTAP touched; no git mutation.
Full Worker suite `apps/worker`: 645 files, 11,236 / 11,236. Joint 345 set (the 11 files of `lane-native-worker-integration-report.md:67`): 11 files, 345 / 345.
`tsc --noEmit` (worker) exit 0; eslint `--max-warnings=0` and `prettier --check` clean on every touched file; `git diff --check` clean.
Coverage (vitest v8, repo threshold 100 %): every file I created is 100 % statements / branches / functions / lines (measured on the 126-file CMS/job subset and on the full Worker run). The only remaining uncovered lines in files I edited are the defensive branches of the CMS-03C-16 lane's code that predate this lane (listed under Open items).

## Scope
Brief `briefs/worker-taxonomy-terms.md`: (1) CMS-03C-03 production port; (2) `cmsTaxonomyTermsRead` and CMS-03C-17 routes and adapters; (3) the `cms.taxonomy.merge_converge` job effect. SQL boundary: `lane-taxonomy-terms-report.md` `## RPC boundary` and `## Follow-up f2` (promoted migrations `20261014120000`-`120820`).

## What was built
### 1. CMS-03C-03 over `platform_api.cms_act_taxonomy_term`
- `cms-composition-production-taxonomy.ts`: the fail-closed `actTerm` is gone. The port repeats the strict transport contract (`TaxonomyTermActionApiRequestSchema`, path, body vs path vocabulary, exact `Idempotency-Key` and quoted `If-Match` equal to `expectedVersion`, curator authority), then sends ONE named call (no retry) with `{ ...body, ifMatch (decimal), idempotencyKey, context, correlationId }` and `X-Idempotency-Key` / `If-Match` headers. The answer must pass `validTerm`.
- One transport for every taxonomy RPC: `cms-composition-production-taxonomy-context.ts` (`createTaxonomyTransport`, `createTaxonomyContextVerifier`, extracted from the CMS-03C-16 production file): the RPC context is rebuilt from a FRESH resolution of the same Request (same session, user, party, person else 401) and the operation capability is proved again (403 before any network). `taxonomy-rpc-table.ts` is the one table of RPC names, deadlines and rate rows.
- Errors: `taxonomyRpcFailure(status, payload, operation)` (existing definition mapper, through `mapCmsCompositionRpcFailure`'s provider-fault guard) gains the CMS-03C-03 typed tokens in `taxonomy-term-failure.ts`: `taxonomy_not_active` 409; `canonical_overlap` 422 `{domain, canonicalId}`; `canonical_source_unavailable` 422 `{domain}`; a missing/invalid DETAIL member is an invalid dependency answer (502, retryable). `capability_missing` 403. PostgREST puts the SQL DETAIL in `payload.details` as JSON text. Other operations' tokens, prose and PGRST/SQLSTATE faults are the scrubbed 500; every 5xx the unchanged 03b mapping.
- Route: `taxonomy-term-details.ts` publishes only the operation's own BE03c 1304 reason on its one status with only its members; the route's own capability gate now answers the contract token `capability_missing` (was the pre-contract `CAPABILITY_REQUIRED`). `taxonomy-safe-details.ts` was split out of `taxonomy-responses.ts` (re-exported, so pattern-instance is unchanged).
- `validTerm` rewritten (see Decisions D-W1).
### 2. Reads
- `taxonomy-read-routes.ts` (`taxonomyTermsRead`, `taxonomySelectorRead`) registered by `taxonomy-definition-routes.ts` (also OPTIONS `GET, OPTIONS` with `X-Request-Id` only). BE00 order: origin, media, session, human identity, strict path+query, no body/precondition headers, capability + user then party quota (`TAXONOMY_RATES`: terms 120/240 `cms-taxonomy-terms-read`; selector 300/600 `cms-taxonomy-selector-read`, `cms.author` or `cms.editor`), port, response contract. ETag = quoted `pageVersion`; `no-store`; deadline 8,000 ms; telemetry operation ids `cmsTaxonomyTermsRead` / `CMS-03C-17`.
- `taxonomy-read-query.ts`: unknown, duplicated, missing or empty key, cursor over 512 characters or empty, non-canonical-integer limit = bare 400. Terms: lifecycle outside the enum or limit outside 1-50 also 400 (BE03c 407 has no 422 row). Selector: typeKey/fieldKey/locale outside their grammar and limit outside 1-100 = 422 with the member pointer (as the SQL reader). The signed cursor is passed through byte for byte.
- `taxonomy-read-pages.ts`: a page is accepted only when it honours the request: strict schema (256 KiB for the list), at most `limit` rows, unique rows, the lifecycle filter, the keyset order. Otherwise 502 retryable.
- `cms-composition-production-taxonomy-reads.ts`: `cms_list_taxonomy_terms` (witness `{taxonomyId, page}` unwrapped only when the lineage matches; 404 stays 404, an empty visible page is 200) and `cms_list_taxonomy_selector` (strict page, no witness). `limit` default applied by the Worker so the SQL cursor hash is stable across pages.
- `cms-composition-production-taxonomy-definition.ts` composes both readers; `CmsTaxonomyDefinitionDependencies` gained `readTerms`/`readSelector`; `CmsEditorialRateLimitInput.operationId` gained the two ids (`cms-editorial-production-boundary-types.ts`).
### 3. Merge-converge job
Registration points: `production-async-entrypoint.ts` (dispatcher dependency `convergeTaxonomyMerge`), `production-job-effect-dispatcher.ts` (new family branch), `async-runtime-job-delivery.ts` (`CONTEXT_JOB_TYPES`: the delivery context, i.e. `env`, reaches this family and the dry-run only), `async-runtime-rpc-types.ts` (RPC name).
- `cms-taxonomy-merge-converge-names.ts` (job type, RPC name, error codes), `-rpc.ts` (the one door: request exactly `{claimedJob:{jobId,version,leaseToken}}`, never `batch`; strict answer `{converged, remaining, continuationJobId}` with `remaining>0 <=> continuation named`), `-effect.ts`, `-telemetry.ts`.
- The effect fences on the claim receipt (`claimedLease` of THIS delivery: same job and token, int64 decimal version that advances the canonical one) and calls the RPC with the CLAIMED version. Outcomes: `succeeded` with resultRef `{type:'cms.taxonomy.merge_converge', id: continuationJobId ?? jobId}` (see D-W3); `failed` otherwise. NEVER `queued`, never manual review (see D-W2).
- Telemetry per delivery: scrubbed event `cms_taxonomy_merge_converge.settled` (job id, correlation id, delivery number, counts, error code, duration) and metric `cms_taxonomy_merge_total{outcome=converged|continued|failed}` (BE03c 1597). No token, claim version, continuation id or credential is logged.

## Decisions (implementation tier, stated so root can override)
- D-W1 `validTerm` bound the 200 to `version === expectedVersion + 1`, `lifecycle active` for rename/alias and the requested `parentId` on every action. The real answer (`cms_term_resource`) is the TERM row: its own version (1 on create, later after every other action), the stored parent (only create and rename apply the requested one, D3) and the stored lifecycle (a deprecated term can still be renamed/aliased, BE03c 1377). The old binding would have answered 502 to nearly every real success. New binding: create = version 1, active, requested parent, no successor; rename = version >= 2, active|deprecated, requested parent; alias = version >= 2, active|deprecated; deprecate = version >= 2, deprecated; merge = version >= 2, merged, successor = survivor; vocabulary, ids and key always bound. No spec line gives the old binding (BE03c 161 only says `200 TaxonomyTermResource`).
- D-W2 The job is never answered `queued`. `apply_job_outcome` to `queued` writes NO new outbox event, and the redelivered envelope keeps `aggregateVersion` of creation; once the claim advanced the job version, `decideJobDispatch` skips the envelope as stale (the CMS dry run escapes this only through its verified immutable origin, DEC-183). A re-queued ordinary job would therefore never run again. A transient fault (CONFLICT lock failure, timeout, provider fault, invalid answer) is retried inside the invocation (3 attempts, pauses 250 / 1,000 ms, abort-aware); `capability_missing`, `NOT_FOUND`, `INVALID_REQUEST` fail the job at once. Codes: `CAPABILITY_MISSING`, `MERGE_CONVERGE_JOB_UNKNOWN`, `MERGE_CONVERGE_REQUEST_INVALID`, `MERGE_CONVERGE_CONFLICT`, `DEPENDENCY_UNAVAILABLE`, `DEPENDENCY_INVALID_RESPONSE`, `MERGE_CONVERGE_CLAIM_INVALID`. A CONFLICT from the lease fence of a stale delivery is retried twice and then fails the job; the consumer's own CAS at the claimed version/token then refuses it harmlessly.
- D-W3 `platform_private.apply_job_outcome` REFUSES `succeeded` with a null `result_ref` (`20260830120000:245`), and `JobStatusSchema.resultRef` must be `{type, id: UUID}`. The f2 report's "answer as resultRef" cannot be stored. BE00 defines no result type for this job; chosen: `{type:'cms.taxonomy.merge_converge', id: <continuation job>}` when work remains, else the job itself.
- D-W4 A foreign Slice 11 reason token on the CMS-03C-16 / versions-read mapper is now a scrubbed 500 (was 502), BE03c 1298-1302. No test pinned the 502. Behaviour change of the sibling lane's mapper, flagged for review.
- D-W5 Selector 422 pointers are `/typeKey /fieldKey /locale /limit`; terms-read never answers 422 (BE03c 407). Missing required selector key = 400.

## Files (path, lines, SHA-256)
| `apps/worker/src/async-runtime-job-delivery.ts` | 96 | `cb37d543a4f575ac360a074fecbf007afbbc647890602af455ef085306075907` |
| `apps/worker/src/async-runtime-rpc-types.ts` | 87 | `82cb25c685260c469aa43141975321fef5dfdbf531ce31f72d907843a26d7692` |
| `apps/worker/src/cms-composition-production-taxonomy-act.test-support.ts` | 120 | `fa69b5db89e8c01b91d16f88882b4cb22042a67faf7a8efde8da879e47580fc1` |
| `apps/worker/src/cms-composition-production-taxonomy-act.test.ts` | 256 | `316bf8d5140e868df44de871c65fa1e06555e820098479b63b68b95bcd7d473c` |
| `apps/worker/src/cms-composition-production-taxonomy-act-tokens.test.ts` | 222 | `e3125fefe5bd512cdcf93ad920bc6ca28217d9c72a169e3da85238fb923f75cf` |
| `apps/worker/src/cms-composition-production-taxonomy-context.test.ts` | 276 | `591c01ee51a3a76d45419300bb86cc61e2de1458409127fc80ff139db267f9f0` |
| `apps/worker/src/cms-composition-production-taxonomy-context.ts` | 136 | `d2fea99fde017ec06d8ff5afd0c926671b4cb8dff15fcc50de4f4d9ab386bf4b` |
| `apps/worker/src/cms-composition-production-taxonomy-definition.ts` | 114 | `2770f35f5d953d0bb80c3590d28a0f8d3d9654e74c6551b9cc8e687472117184` |
| `apps/worker/src/cms-composition-production-taxonomy-definition-versions.ts` | 174 | `5aaae62356709bdc1db0a05929e590f269e512c89b11574a9ed1ab4ef03d7423` |
| `apps/worker/src/cms-composition-production-taxonomy-guards.test.ts` | 200 | `7940229dcf59861e94a904bb8b986f9580a095709606678190caf093060d6ad6` |
| `apps/worker/src/cms-composition-production-taxonomy-reads.test.ts` | 368 | `cf2b1c7a15676d124db3db335b716e740db8b55ef4de4332361073256c1edadb` |
| `apps/worker/src/cms-composition-production-taxonomy-reads.ts` | 93 | `199098e6a361e96c805b8fe05a6456e2e5d7c5e1c3a50a06d4ac40fab0e89396` |
| `apps/worker/src/cms-composition-production-taxonomy.test.ts` | 106 | `c20f7b1b4c953092abad92bbc1ebdfaab9a6d68cbb9947ab7e08bc1282475b48` |
| `apps/worker/src/cms-composition-production-taxonomy.ts` | 97 | `4d414d4af06ecfe424ad7689b50ac054dc1c0d289ed6c5064329f43fd8a8f193` |
| `apps/worker/src/cms-composition/taxonomy-contracts.ts` | 173 | `2aedb86abc91b97d3f19d2f1b8e1cfb5752bcb5588da61fd9cf3414c7837f300` |
| `apps/worker/src/cms-composition/taxonomy-definition-response.ts` | 297 | `b8c96b4cea8706640d35ec9502c23d1408457dba491fd12933ff0ff738929bc8` |
| `apps/worker/src/cms-composition/taxonomy-definition-routes.ts` | 91 | `817b5f5e7681c16c0d765bada61052e171829bafa242306e1b44356541150037` |
| `apps/worker/src/cms-composition/taxonomy-definition-shared.ts` | 268 | `927d803e4771337bef3e7b91e2b30b08bb5331b8aa1f1246de15d28fe5d28dee` |
| `apps/worker/src/cms-composition/taxonomy-definition.test-support.ts` | 262 | `b975490f4073d71ef8578fb112d5dbb8dc5e43bb1e6306ffb6784c6eccdf13d7` |
| `apps/worker/src/cms-composition/taxonomy-read-pages.ts` | 61 | `a8c8873463617abc4affacc4d0cb522e37776f7414279f66be962cc458ba4b09` |
| `apps/worker/src/cms-composition/taxonomy-read-query.ts` | 131 | `b1d89ecf84edabe7f8cec29950f8ec408f4a769d43dbb11bccb48c9a3bf6efb7` |
| `apps/worker/src/cms-composition/taxonomy-read-routes.ts` | 158 | `a72128063839d1d694a4c1008e1d8eb0c38f32e589768ddd85cc661df89320a8` |
| `apps/worker/src/cms-composition/taxonomy-reads-admission.test.ts` | 69 | `4497351c5425b3b345fafbaf8c2e7c712f21a427c80171f9ec6c4058af65d2a8` |
| `apps/worker/src/cms-composition/taxonomy-reads-guards.test.ts` | 152 | `b7e3d0e0a0074f4aa5175246e61e820142ed157f33ed6848422cb5feb19d392d` |
| `apps/worker/src/cms-composition/taxonomy-reads.test-support.ts` | 136 | `20b4c379ebeb5284b8f7ab640339122de4c38acf6a7a7c616491cd10cc752579` |
| `apps/worker/src/cms-composition/taxonomy-registry.test.ts` | 134 | `49b42ca6a733aaf1b2b424fbfce7a6fd71586a3477ed760bd099dd56fde8a14c` |
| `apps/worker/src/cms-composition/taxonomy-responses.ts` | 61 | `a3847cbcbcde118f15b776ced3712ec7c6506d9c1a7d0495c7a09974d27c5435` |
| `apps/worker/src/cms-composition/taxonomy-routes.ts` | 287 | `ed0baca023e7feb95d83e62a284f5b48343de715a6ccbb9f7dfcbbc5716f10da` |
| `apps/worker/src/cms-composition/taxonomy-rpc-table.ts` | 86 | `68ff0198e96589f5f7ae817dd5eaae085b53880577c2c549c31c835d5b9541e5` |
| `apps/worker/src/cms-composition/taxonomy-safe-details.ts` | 74 | `8d46d5734e764aaadbcaff9b6cb53f9614e4127c2b9a500040494b0a622a7eb3` |
| `apps/worker/src/cms-composition/taxonomy-selector-read.test.ts` | 291 | `f9bb2b7fa3009f653dd6b1f24260f7841b12e3a28bfdc32bdfeaad9d0d4cec54` |
| `apps/worker/src/cms-composition/taxonomy-term-binding.test.ts` | 146 | `eeaada04c04cca48d3506b838ece1b8f82efb8d3cd3ca31d0bbecbd0a734a1e1` |
| `apps/worker/src/cms-composition/taxonomy-term-details.test.ts` | 215 | `17d7d140360dd054c410b61ee9987bd4de632eb13cf04184fd3e970b984baad3` |
| `apps/worker/src/cms-composition/taxonomy-term-details.ts` | 63 | `c1e7a642426104a3da3dfe84578e11a793a89de64eebd11153489d42f91603b0` |
| `apps/worker/src/cms-composition/taxonomy-term-failure.ts` | 50 | `cf5c68dda63c07568996af790c601016937d290f62ac81a7f5b9e7a1e982a3ff` |
| `apps/worker/src/cms-composition/taxonomy-terms-read.test.ts` | 333 | `2ecb3a0497ebf1a6cbcc189d846c8d18a500d1e224d6f89a70182c5cb4536918` |
| `apps/worker/src/cms-composition/template-shared.ts` | 201 | `30e9e75a101d67e7509bbce887a117b71e0f374ea3a930e53084583be1a89afd` |
| `apps/worker/src/cms-editorial-production-boundary-types.ts` | 100 | `0a83c9f5c2d099414cc1dff4a90afe528b8add8bc9fe6fb3f6d83264219722b1` |
| `apps/worker/src/cms-taxonomy-merge-converge-claim.test.ts` | 111 | `943406bf5a3f5ab2e7ac0921c2cb93b50792f6e182e52015a54d371c86781310` |
| `apps/worker/src/cms-taxonomy-merge-converge-effect.test.ts` | 246 | `50d72ead431bcd6e343ecc82ca50a7f9a3d8a662087290437ddfcc0dd1388cbd` |
| `apps/worker/src/cms-taxonomy-merge-converge-effect.ts` | 182 | `529bf04ad8263c9256ba3d5e01116cf49f3f66b80470b59a1460d08f066acb45` |
| `apps/worker/src/cms-taxonomy-merge-converge-names.ts` | 34 | `83c4da16aa6b370d957dfafeac1dd9f8675ee951fb3d369aaf4e89d8bf5d365c` |
| `apps/worker/src/cms-taxonomy-merge-converge-rpc.ts` | 67 | `a3bdf79f6b574931b7127710295bceaa0ec00d568780337c6f0d73b3ad1179f5` |
| `apps/worker/src/cms-taxonomy-merge-converge-telemetry.test.ts` | 172 | `c8bbd45e97fddb0eea952b7090fa5606a1acf7e33b9231611c892e0191cee8af` |
| `apps/worker/src/cms-taxonomy-merge-converge-telemetry.ts` | 91 | `85e523622f8489aab035fbbaaf0c4a140592d145069034163245ec319ed3649f` |
| `apps/worker/src/cms-taxonomy-merge-converge.test-support.ts` | 78 | `05532b33259abc8ba499e1174359a31e88621bff074c4f03f26600f1e10d1445` |
| `apps/worker/src/production-async-entrypoint-taxonomy-merge.test.ts` | 227 | `9553aa3e163afcac5c6ff53dd186c93869099fa164295e0d285a32125ed250c1` |
| `apps/worker/src/production-async-entrypoint.ts` | 188 | `c83b244429a2c13cd0c937c0d8f200f3b38d76f6fb773b63a1ff74f3b1ee7325` |
| `apps/worker/src/production-job-effect-dispatcher-taxonomy-merge.test.ts` | 195 | `c3318f50eac4b432cb5c1bf733f9cbec134f2eccb63d292c904021405917e31b` |
| `apps/worker/src/production-job-effect-dispatcher.ts` | 235 | `fd698d23506c6a042f80a273ff2719a2921d83068311ce0e56807de4b145f50e` |
| `apps/worker/src/README.md` | 136 | `217d80235109e1172d369eb2986e26f9a82f039145f2b8d6d5f5b24ca68dc729` |
| `apps/worker/src/cms-composition/README.md` | 131 | `4ef502b00aad6749d6af423ed5f32c97bab37b272e9ada36a9012d6622fbf43d` |

(Also edited, SHA in the table: both READMEs. `cms-editorial-production-boundary-types.ts` is an untracked file of another lane; only two union members were added.)

## Runs (all `pnpm exec vitest run` from the worktree root under `flock -s /tmp/wejammin-quiet.lock`, pinned PATH)
| time | what | result |
| --- | --- | --- |
| 03:19 | baseline `cms-composition-production-taxonomy.test.ts`, `taxonomy-routes.test.ts` | 28 / 28 |
| 03:2x | RED: `taxonomy-term-binding.test.ts`, `taxonomy-term-details.test.ts` | 11 failed / 13 passed (validTerm binding, `capability_missing`, typed details); GREEN after `taxonomy-contracts.ts`, `taxonomy-term-details.ts` |
| 03:2x | RED: `cms-composition-production-taxonomy-act.test.ts` | 58 failed (stub answered 503, no RPC); GREEN after the adapter, after 4 test-defect fixes of mine (parent in the fixture, request headers, `apikey` header, foreign-reason 500) |
| 03:3x | RED: `taxonomy-terms-read.test.ts` (route absent, 404); GREEN `taxonomy-selector-read.test.ts` 291 lines, terms 333 |
| 03:3x | `cms-composition-production-taxonomy-reads.test.ts` 62 (written after the readers; verified by mutants M4, M5, M6, M15) | pass |
| 03:3x | `cms-taxonomy-merge-converge-effect.test.ts` (written before the module existed: absent module = RED, not run), dispatcher RED: 16 failed / 1 passed; integration RED: 4 failed / 1 passed; GREEN after wiring |
| 03:5x | joint 345 set | 11 files, 345 / 345 |
| 03:5x | full Worker (first) | 639 files, 11,171 / 11,171 |
| 04:0x | coverage run on the 126-file subset: before the guard tests 38 uncovered spots in my files, after: none in my files | 2,670 tests |
| 04:1x | mutation sweep: 17 single-edit mutants (validTerm, 403 details, ifMatch operand, lifecycle filter, selector limit bound, selector authority, resultRef id, claim version, dispatcher queued, delivery context, rate drift, overlap member, attempts, terminal retry, witness id, metric label, port path id) | 17 / 17 killed; sources restored byte-identical |
| final | full Worker `apps/worker` | 645 files, 11,236 / 11,236, 0 skipped |
| final | joint 345 set; `tests/contracts/phase-02-slice-12-taxonomy-version-openapi.test.ts` + `tests/worker-wrangler-config.test.ts` + `taxonomy-terms-witness-parity` | 345 / 345; 19 / 19 |
| final | `pnpm --filter @wejammin/worker type-check` 0; eslint + prettier on all touched files 0; `git diff --check` 0 | |

## Test corrections (for independent review)
1. `cms-composition-production-taxonomy.test.ts` (the CMS-03C-03 fail-closed stub oracle): "admits a valid curator but refuses mutation while canonical source and RPC are absent" 503 -> "fails closed before the RPC when the session was hand-supplied" 401 (a resolver override never recorded a server context; fetch not called); "has no implicit allow" 503 `ok:false` -> `ok:false` plus `fetch` never called (a GET on the port is now a bare 400). Cite: the brief (wire the port to the named RPC), BE03c 1447, 1506, 1478.
2. `cms-composition/taxonomy-definition.test-support.ts`: additive `readTerms` / `readSelector` stubs in `createTaxonomyRouteHarness` (the dependency type gained them). No assertion touched.
3. No other existing oracle changed. `taxonomy-routes.test.ts` is byte-identical and still passes (its version-advance case is consistent with D-W1).

## Spec citations
BE03c 161, 166-167, 179, 187, 366-410 (371/373/403 rows, 406-407), 1290-1306, 1334, 1351, 1354, 1371-1377, 1447, 1478-1480, 1502-1506, 1595-1597; BE00 172, 386-388, 592; `20260830120000:245` (succeeded needs a result_ref); `refusals.ts` / `error-catalog.ts` (taxonomy catalog and operation reasons).

## Open items / BOUNDARY
1. **SUPERSEDED by `## Fix pass` Open item 1 and `## Fix pass 2` (m-f1): the "immutable-origin bypass" and "next continuation of the acting party" wording below is NOT the current position; the true statement is in the runbook "Mitigation and the open gap" (a later merge of the same acting party above 5,000 assignments, or a still-running chain of that party; nothing guarantees one). Do not act on this item as written (review f1 n-f2).** BOUNDARY (job retry, missing mechanism): an ordinary BE00 job cannot be redelivered after a `queued` outcome (stale envelope skip, D-W2). Persistent transient faults therefore settle the job `failed` and the unconverged assignments wait (still resolved through the retired term's redirect, BE03c 1377) for the next continuation of the acting party. Needs either an immutable-origin bypass for this job type in `packages/application` dispatch (outside this lane) or a spec'd re-request command (same gap as f2 R13).
2. The converge RPC runs under the generic 15,000 ms async RPC ceiling (`ASYNC_RPC_DEADLINE_MS`); a 5,000-assignment batch on a cold database is unmeasured here (no DB). A timeout is retried then fails the job; if it proves too slow, root may ask for a smaller server-side default batch (the optional `batch` stays unsent: not spec surface).
3. `CAPABILITY_REQUIRED` is still emitted by the template, locale and related-content routes (and shared `safeDetails` keeps allowlisting it for pattern-instance's fallback); the 03c contract token is `capability_missing` (BE03c 1304). Only CMS-03C-03 was corrected here.
4. Pre-existing uncovered defensive branches (not from this lane, seen when measuring): `cms-composition-production-taxonomy-definition.ts` (createVersion port guards), `...-definition-versions.ts` (transport abort/parse guards) and `taxonomy-definition-response.ts` (oversize/abort mapping). They were moved or touched only mechanically.
5. Not proven here (no DB, no race module): SQL behaviour, lock order, replay of the stored envelope (the Worker only proves identical bytes + key reach the RPC), the continuation request itself.
6. Method note: the act-reads production-adapter and effect suites were written after the production code (tests first only for the routes, `validTerm`, details, dispatcher and integration); non-vacuity of those suites is shown by the mutation sweep above.

## Requests to root
1. Independent review (Codex per the memory rule), then the canonical gate (Worker-only; no `db:types`/OpenAPI regeneration needed).
2. Ratify or reject D-W2 (job never re-queued; in-invocation retry) and D-W3 (resultRef), and decide Open item 1.
3. Decide Open item 3 (`CAPABILITY_REQUIRED` -> `capability_missing` on the other 03c routes) and D-W4.
4. Web relay for the three routes (`apps/web/src/server/...`) is not part of this lane; FE03 consumers need it.
5. Memory-capture candidates (root decides): "a job outcome of `succeeded` needs a non-null result_ref (DB refuses it); `queued` cannot be redelivered for ordinary jobs because the envelope version is stale"; "pgrep -f in a Bash tool call matches the calling shell: use the [x] trick"; "shared scratchpad files get deleted by other lanes: keep private dirs".

## Fix pass
HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e` (verified at start and at the end). Brief `briefs/worker-taxonomy-terms-f1.md`; review `review-worker-taxonomy-terms.md` (VERDICT PARTIAL). No SQL, no `supabase/**`, no contracts, no git mutation. Status: GREEN for everything the Worker can do; the M2 recovery mechanism is a BOUNDARY that needs a BE03c ruling and SQL (see Requests to root).

### Results per finding
- **M1 (fixed).** BE00 548-556 (`platform.job.execute` retry delays 15 s, 60 s, 300 s) is now the in-invocation schedule: `MERGE_RETRY_PAUSES_MS = [15_000, 60_000]`, `MERGE_MAX_ATTEMPTS = 3` (exported from `cms-taxonomy-merge-converge-effect.ts`). The third step (300 s) cannot fit `invocationBudgetMs` (`min(240000, lease remaining - 60000)`), so two pauses are used. Worst case is 2 pauses (75 s) + 3 calls at the 15,000 ms RPC deadline (45 s) = 120 s: inside 240 s and before the 200 s heartbeat point of the 300 s lease. The pause stays abort-aware. RED: the new duration oracle failed on `[250, 1000]` and the exports were absent. Oracles added in `...-effect.test.ts`: exact pause lengths and the abort signal passed to `sleep`; the worst case `== 120_000`, `<= INVOCATION_BUDGET_CAP_MS`, `< 200 s`. The integration test `production-async-entrypoint-taxonomy-merge.test.ts` (real delay under fake timers) failed by timeout (15,001 ms) until it advanced the real pause total: see Test corrections #2.
- **M2 (fixed what the spec supports; recovery is a BOUNDARY).**
  - BE00 233, 554, 571 and BE03c 1334, 1351-1354, 1377 define the terminal path: exhausted or non-retryable is `failed` with a registered safe code and a domain recovery reference, and a job-type runbook is required. They define no command or schedule that re-requests a convergence job, so no recovery was implemented (it needs a spec rule and SQL; the Worker cannot call an RPC that does not exist).
  - The dispatch bypass option is dropped (BE00 547: other job types retain the stale/future event-version rules; and the SQL already requests a fresh continuation job).
  - Runbook and code registry: new `docs/runbooks/platform/cms-taxonomy-merge-converge.md` (job-type runbook, consumer/lease/delivery facts, the eight registered terminal codes with their dispositions, log event, metric `cms_taxonomy_merge_total`, alert route `platform.on_call` on any `outcome="failed"`, safe checks, the open gap). Indexed in `docs/runbooks/platform/README.md` and as item 7 of `jobs-outbox-reconciliation.md`. This is the runbook/alert inventory the repo uses (the existing job runbooks are `jobs-outbox-reconciliation.md`, `cms-publication.md` and `cms-editorial.md`; there is no separate machine alert inventory: the editorial runbooks say the repository deploys no alert rule, and this one repeats that).
  - Eight codes, not seven: `MERGE_CONVERGE_CLAIM_INVALID`, `CAPABILITY_MISSING`, `MERGE_CONVERGE_JOB_UNKNOWN`, `MERGE_CONVERGE_REQUEST_INVALID`, `MERGE_CONVERGE_CONFLICT`, `DEPENDENCY_UNAVAILABLE`, `DEPENDENCY_INVALID_RESPONSE` and the dispatcher guard `MERGE_CONVERGE_OUTCOME_UNMAPPED` (`production-job-effect-dispatcher.ts:189`). I first dropped the last as dead; `tsc` showed the dispatcher emits it, so it was restored and registered. New sync test `cms-taxonomy-merge-converge-runbook.test.ts` keeps the table and `TAXONOMY_MERGE_JOB_ERROR` identical (parsed from the errorCode column), checks the operational facts and the links.
  - The overstated claim (names comment, report Open item 1) that "the next continuation of the acting party drains them" is removed: a merge requests a job only for its own term and only above 5,000 assignments, so nothing drains the tail by itself.
  - Where BE00 requires registration of the error codes: BE00 233 says "owning-domain or platform registered error code". The owning-domain registration is a BE03c table (precedent: BE03a "Preparation Job disposition"). BE03c is a spec file outside my claim, so the ready-to-paste table is in Requests to root #2; the runbook is the repository registry until then.
- **m1 (fixed).** `cms-composition-production-taxonomy.test.ts` now sends a valid POST (key, quoted If-Match, body) and asserts `status 401`, `code UNAUTHENTICATED`, `ok false`, and no fetch. A header-less GET (400) would now fail it.
- **m2 (fixed).** `taxonomy-definition-response.ts`: the foreign `canonical_source_unavailable` branch returning 502 is removed; on every operation but CMS-03C-03 (BE03c 1375: generated only there) it is a scrubbed 500 (BE03c 1298-1302, D-W4). CMS-03C-03 still answers the typed 422 with `domain`. RED: new `taxonomy-foreign-source-token.test.ts` (5 failed, 502 vs 500) then GREEN. See Test corrections #1.
- **m3 (fixed).** `taxonomy-read-query.ts`: `LIMIT_SYNTAX` is a canonical decimal integer of any magnitude (`0` or `-?[1-9][0-9]*`). Selector: every canonical integer outside 1-100 is the same 422 `/limit` (1000000, a 23-digit value and -1 were 400, 400 and 400 and are now 422; 999999 stays 422). Non-canonical syntax (`abc`, `1.5`, empty, `+5`, `007`, `-0`) stays a bare 400. Terms read: still 400 for any bad limit (BE03c 407), pinned for 1000000, a 400-digit value and -1. RED first (3 selector cases failed).
- **n1 (fixed).** `async-runtime-job-delivery.ts` comment now says the context reaches the dry run and the merge effect only.
- **n2 (fixed).** Every delivery now logs exactly one event: a refused claim receipt (`MERGE_CONVERGE_CLAIM_INVALID`) and a delivery without Worker context (`DEPENDENCY_UNAVAILABLE`, through the injected logger; with none the disposition is unchanged) log a failed event with the failed metric. `mergeLoggerFor` accepts an undefined environment. RED: two new telemetry tests failed (0 events) then GREEN; a third pins the no-logger path.
- **README.** `apps/worker/src/README.md` merge paragraph states the 15 s/60 s pauses, the one event per delivery and the runbook.

### Runs (`pnpm exec vitest run`, from the worktree root, `flock -s /tmp/wejammin-quiet.lock`, pinned PATH)
| time | what | result |
| --- | --- | --- |
| 04:25 | RED `cms-taxonomy-merge-converge-effect.test.ts` | 2 failed / 26 passed (durations `[250,1000]`; exports absent): feature RED |
| 04:25 | GREEN same | 28 / 28 |
| 04:26 | RED runbook sync test | 4 failed / 1 passed (8 vs 7 codes; links absent; case of `never edit`) |
| 04:27 | GREEN runbook sync test + effect | 33 / 33 |
| 04:28 | m1 test (strengthened, runs green on the existing behaviour by design) | first assertion form failed on the extra ApiError members, adjusted to `toMatchObject`; 2 / 2 |
| 04:2x | RED `taxonomy-foreign-source-token.test.ts` | 5 failed / 1 passed (502 vs 500) |
| 04:2x | GREEN same + `taxonomy-definition-production.test.ts` | 22 / 22 |
| 04:2x | RED selector (`limit=1000000`, 23 digits, `-1`) | 3 failed / 44 passed; GREEN after `LIMIT_SYNTAX`: selector + terms 87 / 87, then terms 43 / 43 with 3 added cases |
| 04:3x | RED telemetry (claim refused, no context) | 2 failed / 7 passed; GREEN 50 / 50 across `cms-taxonomy-merge*` |
| 04:4x | integration `production-async-entrypoint-taxonomy-merge.test.ts` | 1 failed (timeout 15,001 ms on the real 15 s pause) -> 5 / 5 after Test corrections #2 |
| 04:4x | joint 345 set (11 files of `lane-native-worker-integration-report.md:67`) | 11 files, 345 / 345 |
| 04:5x | full Worker `vitest run apps/worker` | 647 files, 11,262 / 11,262, exit 0 (645 / 11,236 before; +2 files, +26 tests) |
| final | `pnpm --filter @wejammin/worker type-check` | 0 errors (it caught the restored `unmapped` use and an exactOptional test type) |
| final | eslint `--max-warnings=0` on 15 TS files; prettier `--check` on those and 4 docs; `git diff --check` | all 0 |
Coverage: the lane's merge files and `taxonomy-read-query.ts` are fully covered in the subset run; the three uncovered lines of `taxonomy-definition-response.ts` (151 is covered by the act-tokens suite in the full run; 271 and 293 are the pre-existing abort/oversize guards of Open item 4).

### Files changed in the fix pass (path, lines, SHA-256)
| `apps/worker/src/cms-taxonomy-merge-converge-effect.ts` | 191 | `d4c34774f4281854d1d871ea91fea5e0552a86fe149e2941eecdd4d5c177a09a` |
| `apps/worker/src/cms-taxonomy-merge-converge-effect.test.ts` | 281 | `14e19cd52098ab4268fcd5fee850449dac390ed8434914e8b859f3c80b0c8483` |
| `apps/worker/src/cms-taxonomy-merge-converge-names.ts` | 36 | `02cd6da568669469f51d209038627b733c4479d9a90c9d31eedc6327f3b4cc14` |
| `apps/worker/src/cms-taxonomy-merge-converge-telemetry.ts` | 95 | `eb61e3df4a90914933fd772e2b08234c98bcf00caeffc06c1aa6ae4a50e40850` |
| `apps/worker/src/cms-taxonomy-merge-converge-telemetry.test.ts` | 234 | `bfed050910f9a6723eac85f31ca7e61cdc4276740f03da2d5187dd6ed85e7736` |
| `apps/worker/src/cms-taxonomy-merge-converge-runbook.test.ts` (new) | 84 | `5ca73c48b89a638bcd76ab693c625e4604bbe5eea6421e6d4d86218cbc898182` |
| `apps/worker/src/async-runtime-job-delivery.ts` | 96 | `a48efc10c567ca26f3a1d929935c83ba26b3322bdf8065d23606daad15b66925` |
| `apps/worker/src/production-async-entrypoint-taxonomy-merge.test.ts` | 231 | `505baff54d731c6fc940690918893c9e8e78c15ed01a857b6ed3ae907b68bfac` |
| `apps/worker/src/cms-composition-production-taxonomy.test.ts` | 120 | `6ae44b1eebd03fd87846f352f4b15db9f9de05c2d5205a125671d18e9e0ec9d7` |
| `apps/worker/src/cms-composition/taxonomy-definition-response.ts` | 298 | `c28326a2bc5eecdca9df387e2bafcb4358de3eef551a8559ce49b578c22fefd4` |
| `apps/worker/src/cms-composition/taxonomy-definition-production.test.ts` | 239 | `498cd99e7b7a4c69899beb1a7bc1bb19872a9bf155118c34c96c274f7fb6d676` |
| `apps/worker/src/cms-composition/taxonomy-foreign-source-token.test.ts` (new) | 42 | `aa94d971402570e7cc6b56952993fd4e8d89204a22f7d1b931a457e5146fa847` |
| `apps/worker/src/cms-composition/taxonomy-read-query.ts` | 133 | `69b249c1071d261a522c65a5ab458d0ff9fb58d25a799f5c9c5280e9a7a32063` |
| `apps/worker/src/cms-composition/taxonomy-selector-read.test.ts` | 299 | `c5d7bd087fe9a03b63844febf2468cf1ab9c08ed8df497ad4e5a942fccf777e1` |
| `apps/worker/src/cms-composition/taxonomy-terms-read.test.ts` | 336 | `72f9941f734a9ba4197ae6f81e5f42c72e7f65e4b16141974fb44f1cfd3a2f3a` |
| `docs/runbooks/platform/cms-taxonomy-merge-converge.md` (new) | 79 | `107b4b88042d74562180c816df31569492da06af425c17096f7b85396e324b28` |
| `docs/runbooks/platform/README.md` | 27 | `ff125fc42245e23c191511b5b3601be09ee080c6e465b5a4d1b6688a6a0a9591` |
| `docs/runbooks/platform/jobs-outbox-reconciliation.md` | 57 | `1566867cefa1123512fd3ebd9f574605d7b0a65c30f4cf52344e63561182504f` |
| `apps/worker/src/README.md` | 139 | `3eabdd47d9f528a32421327aa132e9b54b8726a4be6459bbdffcec6edef2b01e` |
The docs files outside the original claim are the runbook/alert inventory files the brief asked me to name (the three `docs/runbooks/platform` files). `git status` shows the Worker files as untracked or modified; the SHAs above are the final bytes.

### Test corrections (for independent review)
1. `cms-composition/taxonomy-definition-production.test.ts` (the CMS-03C-16 oracle, an earlier lane's file): in "scrubs a valid capability token ..." the pair `['canonical_source_unavailable', 502]` -> `500`, and the test title `... never accepts a create canonical-source refusal` -> `... answers a create canonical-source refusal as a foreign reason (500)`. Cite BE03c 1298-1302 (a message not generated by the operation's catalog is a scrubbed 500) and 1375 (the token is generated only by CMS-03C-03). Not weakened: it still asserts the exact status and that the body never contains the token or the private text. I changed this oracle in the same step as the production fix, after the new `taxonomy-foreign-source-token.test.ts` had been run RED; the oracle's own RED was not run separately.
2. `production-async-entrypoint-taxonomy-merge.test.ts` "a persistent dependency fault is retried ...": the fake-timer advance `5_000` -> the sum of `MERGE_RETRY_PAUSES_MS` (75,000 ms) through the real abort-aware delay. Same assertions (3 RPC calls, `failed` `DEPENDENCY_UNAVAILABLE`, `p_retryable false`, one ack). The old figure encoded the uncited 250/1,000 ms pauses; the test is a lane-authored oracle.
3. Prior correction #2 of the first report (the `actTerm` "no implicit allow" case) is strengthened as m1 above (a valid POST, exact 401, `UNAUTHENTICATED`, no fetch); no weaker than before.

### Decisions (implementation tier)
- D-F1 The in-invocation retry follows the BE00 548-556 schedule truncated to what the budget allows (15 s, 60 s), not the 300 s step.
- D-F2 The eight terminal codes are the job type's registered vocabulary, kept in the runbook (repository registry) until BE03c adds the table.
- D-F3 Selector limit: any canonical integer outside 1-100 is 422 `/limit`; non-canonical limit syntax is 400.
- D-F4 Every delivery logs exactly one event, including claim-refused and no-context deliveries.

### Open items / BOUNDARY
1. BOUNDARY (recovery of a failed convergence job, owner: BE03c). Missing spec: BE03c defines no command or scheduled reconciliation that requests a fresh `cms.taxonomy.merge_converge` job for a retired term with unconverged assignments and no live job. Three-part test: (1) no spec; (2) writing it is an owner/architecture decision (retry bounds, who may trigger); (3) it blocks no slice test, but a failed job strands the tail permanently. Current behaviour: the job settles `failed` (alert, runbook), data stays correct through the redirect, no product recovery. Tracking: the runbook section "Mitigation and the open gap" and this report; root to open the GitHub issue (stubs need a tracking issue; there is no stub code here, only an absent mechanism). The exact SQL requirement is in Requests to root #1.
2. The job-chain false negative (an attempt times out but later commits, retries hit its held locks, the job records `failed` although the batch converged and the continuation exists) remains; the runbook says not to infer convergence from the status.
3. Unchanged from the first report: the 15,000 ms async RPC ceiling against a cold 5,000-row batch is unmeasured; `CAPABILITY_REQUIRED` still emitted by the template, locale and related-content routes; no DB behaviour proven here; the BE03c 1597 metrics other than `cms_taxonomy_merge_total` are not emitted anywhere in the Worker (a pre-existing family gap).

### Requests to root
1. **SQL requirement for the recovery (needs BE03c ratification first; no SQL written).** If BE03c adopts a reconciliation, it needs, in a forward migration owned by the taxonomy-terms SQL lane:
   - `platform_private.cms_reconcile_taxonomy_merge_converge()` (SECURITY DEFINER, owned by the CMS definer, `search_path = ''`, executable by no API role) and a `platform_api` wrapper executable by `service_role` only, called from a scheduled Worker tick (CMS-03B-20 sweep precedent). Answer `{ requested: integer }`, no ids.
   - Candidate set: every `platform_private.jobs` row of `job_type = 'cms.taxonomy.merge_converge'` in state `failed` whose acting party still has work (`platform_private.cms_taxonomy_merge_work(owner_id, null)` returns a row) and for whose party there is no job of the type in state `queued` or `running`.
   - Request through `platform_private.accept_job_with_outbox(actor, party, 'cms.taxonomy.merge_converge', correlation, ...)` bound to the failed job's actor and acting party, with an idempotency key namespace NEW per failed job: `digest('cms.taxonomy.merge_converge.reconcile:' || failed_job.id, 'sha256')`. The existing keys cannot be reused: the first request is keyed `cms.taxonomy.merge_converge:<retired term id>` (a 7-day replay window returns the failed job itself) and a continuation is keyed `...continuation:<job id>` (a false-negative job already has one). Each failed job is therefore reconciled at most once.
   - Bound (proposal for the BE03c owner to ratify or change): at most one reconciliation per party per 15 minutes and at most three consecutive failed generations before it stops and leaves the alert to `platform.on_call`.
   - pgTAP: no job, no work, live job, failed job with work, replay of the same tick, grants (`service_role` only), the 15-minute and three-generation bounds, the false-negative case (a continuation already exists).
   Worker work after that: a scheduled-handler adapter and its registration; none is possible today.
2. **BE03c spec registration (outside my claim).** Add a "Merge convergence Job disposition" section as BE03a did for the dry run, with the eight-code table of `docs/runbooks/platform/cms-taxonomy-merge-converge.md` "Registered error codes" (claim refused -> `MERGE_CONVERGE_CLAIM_INVALID`; capability_missing -> `CAPABILITY_MISSING`; NOT_FOUND -> `MERGE_CONVERGE_JOB_UNKNOWN`; INVALID_REQUEST -> `MERGE_CONVERGE_REQUEST_INVALID`; conflict x3 -> `MERGE_CONVERGE_CONFLICT`; fault x3, no budget, no context, dispatcher unavailable -> `DEPENDENCY_UNAVAILABLE`; contract drift x3 -> `DEPENDENCY_INVALID_RESPONSE`; dispatcher guard -> `MERGE_CONVERGE_OUTCOME_UNMAPPED`; converged -> `succeeded`, `resultRef { cms.taxonomy.merge_converge, <continuation or job id> }`), the 15 s/60 s in-invocation retry and the never-`queued` rule (BE00 547), and the recovery rule of #1.
3. Ratify D-W1, D-W3, D-W4, D-W5 (review judged them correct) and D-F1 to D-F4; ratify Test corrections #1 to #3 above.
4. Independent re-review of this fix pass, then the canonical gate (Worker-only; no `db:types` or OpenAPI regeneration). Remaining requests of the first report stand (Web relay; `CAPABILITY_REQUIRED` on the other routes).
5. Memory candidates (root decides): "a dead-looking export can be used by a sibling file in the same family: grep the whole app, not the lane's file prefix, before dropping a code" (the dispatcher used `unmapped`; zsh also does not word-split `$FILES`, use arrays).

## Fix pass 2
Brief `briefs/worker-taxonomy-terms-f2.md`; review `review-worker-taxonomy-terms-f1.md` (VERDICT CLEAR). Started 09:09 UTC 2026-10-15,
HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e`. Scratch only under `<scratchpad>/claude_s12_worker_taxonomy_terms_f2/`.
Baseline SHAs of my files at start equal the fix-pass table above (checked).

### Status
GREEN. All six items done; HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e` unchanged. No SQL, no `supabase/**`, no contracts, no `apps/web`, no spec edit, no git mutation. Resumed 11:32Z after a usage limit killed the first attempt at about 09:10Z; the predecessor's jitter edits (effect + effect test + integration test) were found on disk, verified and kept (item 2).

### Progress (final, 11:51Z)
| item | state |
| --- | --- |
| 1 m-f1 | done |
| 2 m-f2 jitter | done |
| 3 n-f1 guard telemetry | done |
| 4 BE03c <-> runbook <-> code sync | done |
| 5 mutation battery | done (51 / 52 killed, 1 equivalent) |
| 6 m-f3 | done (report) |

### Results per item
1. **m-f1 (fixed).** `cms-taxonomy-merge-converge-names.ts` comment and runbook "Mitigation and the open gap" now say: only a later merge of the same acting party above 5,000 assignments requests a job (which drains all of the party's merged-term work); nothing guarantees one. Pinned by a runbook test (mutant R9).
2. **m-f2 (fixed, decision D-F5).** BE00 550 and BE03c 1302 say "bounded jitter" and state no number, so the bound is an implementation decision: each in-invocation pause gains 0 to 10 % of its base (`MERGE_RETRY_JITTER_FRACTION = 0.1`), floor to whole milliseconds, from the injectable seam `options.random` (default `Math.random`). Reason: never earlier than the schedule, so a held lock keeps its full time to clear, while parties' retries stop running in lockstep; 10 % keeps the worst case small (pauses 16.5 s + 66 s, plus 3 calls at the 15,000 ms RPC deadline = 127.5 s: under the 240 s budget and the 200 s heartbeat point). A broken seam (NaN, negative, 1 or more, infinite) adds nothing. A sample is drawn only for a pause actually taken. Tests: bound, lower and upper edge, linear scaling with one sample per pause, floor to whole ms, broken-seam table, default `Math.random`, 50 real draws in range, the jittered worst case (`> 120,000`, `<= 127,500`, inside the 240 s budget and under the 200 s heartbeat point), integration test advances the upper edge. Runbook and README state the 0-10 % jitter and 127.5 s.
3. **n-f1 (fixed).** The dispatcher guard (effect not wired, effect threw, answer outside the closed set `MERGE_CONVERGE_OUTCOME_UNMAPPED`) now logs the same `cms_taxonomy_merge_converge.settled` error event with `cms_taxonomy_merge_total{outcome="failed"}` through the existing telemetry module (`logMergeSettled`, `mergeLoggerFor`); the logger is the Worker-environment one or the new optional dependency `taxonomyMergeLogger` (test seam). No event for a valid effect answer (the effect logged its own) and none for other job types. A conforming effect never reaches these paths after logging, so there is no double event. Runbook and README updated. The thrown message is never logged.
4. **BE03c registry sync (done).** `cms-taxonomy-merge-converge-runbook.test.ts` now parses the BE03c section "Merge convergence Job disposition" (errorCode and state columns), the runbook table and `TAXONOMY_MERGE_JOB_ERROR`: the same eight codes, the same `(code, state)` pairs in the BE03c and runbook tables, every registry row `failed`, the `succeeded`/null row present, and the runbook cites the BE03c section as the registry. The runbook text and the `names.ts` comment name BE03c as the registry.
5. **Mutation battery (done, private mirror).** See below.
6. **m-f3 (report only).** P2-S12-AC-226 (`phase-02-slice-12.md:2213` at the 2026-10-15 hygiene pass; the line drifts as root edits the tracker, so find it by the id `P2-S12-AC-226`; "re-points **every** `active` TermAssignment") depends on the recovery BOUNDARY (Open item 1 of `## Fix pass`): under a persistent fault past 5,000 assignments the job settles `failed` and the tail stays unconverged until BE03c defines a re-request rule, so "every" does not hold in that case. The Q3 answer "blocks no slice test" is true only for the tests, not for this acceptance criterion. Root must decide whether AC-226 can close with the BOUNDARY open (Requests to root #1) and open the tracking issue (#2).

### Runs (`pnpm exec vitest run`, worktree root, `flock -s /tmp/wejammin-quiet.lock`, pinned PATH; times UTC)
| time | what | result |
| --- | --- | --- |
| 11:33 | resume check: effect test (jitter edits left by the predecessor, no RED run recorded) | 41 / 41 |
| 11:33 | integration + dispatcher merge | 23 / 23 |
| 11:33 | RED runbook sync (BE03c test added) | 1 failed / 6 passed: runbook did not cite BE03c (the code sets already agreed): feature RED for the right reason |
| 11:33 | GREEN runbook test (+ jitter and m-f1 assertions) | 8 / 8 |
| 11:34 | RED `production-job-effect-dispatcher-taxonomy-merge-telemetry.test.ts` | 8 failed / 4 passed (no event emitted): feature RED |
| 11:34 | GREEN same + dispatcher + merge + integration | 218 / 218 |
| 11:38 | after the J7 test and the `Number.isFinite` simplification (equivalent mutant J6) | 11 files, 219 / 219 |
| 11:38-11:40 | mutation battery, run 2 (final bytes) | 52 mutants: 51 killed, 1 equivalent survivor (M2), all 52 restored SHA-identical |
| 11:41-11:49 | full Worker `vitest run apps/worker` | 668 files, 11,887 / 11,887, exit 0 |
| 11:50 | `pnpm --filter @wejammin/worker exec tsc --noEmit -p .` | 0 errors |
| 11:50 | eslint `--max-warnings=0` on 7 TS files; prettier `--check` on those, README and the runbook; `git diff --check` | all 0 |

### Mutation battery (item 5)
- Method: a private mirror `<scratchpad>/claude_s12_worker_taxonomy_terms_f2/mirror/` (copy of `apps/worker/src`, `docs/runbooks`, the BE03c spec, root vitest config; `node_modules` and `packages` symlinked read-only to the real tree). The script `mutate_f2.py` in the same directory mutates ONLY the mirror, runs the killing tests with the real vitest binary, restores the file and compares SHA-256 before and after every mutant; after the run the whole mirror tree hash list (1315 files) was identical to the pre-run list (`mirror-before2.sha` = `mirror-after2.sha`), and the lane files in the real worktree were byte-identical to the mirror. The shared worktree was never mutated, so no other lane could see a mutant. Run 1 (before the J7 test and the `isFinite` simplification) had 4 survivors (M2, J6, J7, G4): J6 was redundant code (removed), J7 a missing test (added), G4 an equivalent mutant (`?? 0` is clamped by `Math.max(1, attempt)`; replaced by `?? 7`).
- Unchanged-count note: the first-pass battery (17 mutants M1-M17) is re-run on the current bytes; M18-M21 cover the fix pass 1 behaviours.

| mutant | verdict | tests (failed / total) | killing file | first killing test |
| --- | --- | --- | --- | --- |
| M1 validTerm create version | KILLED | 4 failed | 3 passed (7) | `taxonomy-term-binding.test.ts` | create: version 1 whatever the vocabulary ve |
| M2 term details 403 shared | SURVIVED | 18 passed (18) | `-` | - |
| M3 act drops ifMatch | KILLED | 1 failed | 16 passed (17) | `cms-composition-production-taxonomy-act.test.ts` | calls platform_api.cms_act_ta |
| M4 lifecycle filter ignored | KILLED | 2 failed | 41 passed (43) | `taxonomy-terms-read.test.ts` | applies the limit default, passes lifecycle and the opaque cursor t |
| M5 selector limit bound | KILLED | 6 failed | 41 passed (47) | `taxonomy-selector-read.test.ts` | refuses a limit outside its grammar with a 422 pointer, before qu |
| M6 selector authority curator | KILLED | 3 failed | 44 passed (47) | `taxonomy-selector-read.test.ts` | a caller holding only cms.author may read |
| M7 resultRef id nil | KILLED | 1 failed | 41 passed (42) | `cms-taxonomy-merge-converge-effect.test.ts` | a drained tail records the job succeeded with itsel |
| M8 claim version from canonical | KILLED | 3 failed | 44 passed (47) | `cms-taxonomy-merge-converge-effect.test.ts` | calls the named RPC once with exactly the claimed jo |
| M9 dispatcher lets queued | KILLED | 1 failed | 17 passed (18) | `production-job-effect-dispatcher-taxonomy-merge.test.ts` | queued is settled as the unmapped failure |
| M10 no delivery context | KILLED | 4 failed | 1 passed (5) | `production-async-entrypoint-taxonomy-merge.test.ts` | converges with the claimed v |
| M11 rate drift | KILLED | 2 failed | 11 passed (13) | `taxonomy-registry.test.ts` | rate class, user and party ceilings and a 60-s |
| M12 overlap w/o canonicalId | KILLED | 1 failed | 43 passed (44) | `cms-composition-production-taxonomy-act-tokens.test.ts` | a canonical |
| M13 one attempt | KILLED | 27 failed | 15 passed (42) | `cms-taxonomy-merge-converge-effect.test.ts` | work remains but no continuation was named is an in |
| M14 terminal retried | KILLED | 3 failed | 39 passed (42) | `cms-taxonomy-merge-converge-effect.test.ts` | capability_missing fails the job CAPABILITY_MISSING after one c |
| M15 witness id unchecked | KILLED | 1 failed | 61 passed (62) | `cms-composition-production-taxonomy-reads.test.ts` | cmsTaxonomyTermsRead production port: platform_api.cms_list_taxonomy_terms (BE03c 167, 144 |
| M16 metric label drift | KILLED | 1 failed | 8 passed (9) | `cms-taxonomy-merge-converge-telemetry.test.ts` | a continued merge logs one success event with counts and the contin |
| M17 port body/path id unchecked | KILLED | 1 failed | 11 passed (12) | `cms-composition-production-taxonomy-guards.test.ts` | a body for another vocabulary is a bare |
| M18 pauses back to uncited 250/1000 | KILLED | 11 failed | 31 passed (42) | `cms-taxonomy-merge-converge-effect.test.ts` | pauses 15 s then 60 s between attempts (BE00 platform.job.execu |
| M19 pause ignores abort signal | KILLED | 1 failed | 41 passed (42) | `cms-taxonomy-merge-converge-effect.test.ts` | pauses 15 s then 60 s between attempts (BE00 platform.job.execu |
| M20 foreign canonical_source_unavailable 502 | KILLED | 5 failed | 1 passed (6) | `taxonomy-foreign-source-token.test.ts` | is a scrubbed 500 on CMS-03C-16 |
| M21 limit syntax non-canonical accepted | KILLED | 2 failed | 45 passed (47) | `taxonomy-selector-read.test.ts` | refuses a zero-padded limit with a bare 400 before capability, qu |
| J1 jitter fraction 0.1 -> 0.2 | KILLED | 7 failed | 35 passed (42) | `cms-taxonomy-merge-converge-effect.test.ts` | the worst case with every pause at its jitter upper edge stays |
| J2 jitter subtracts (pause shorter than schedule) | KILLED | 6 failed | 36 passed (42) | `cms-taxonomy-merge-converge-effect.test.ts` | the worst case with every pause at its jitter upper edge stays |
| J3 jitter removed | KILLED | 5 failed | 37 passed (42) | `cms-taxonomy-merge-converge-effect.test.ts` | the worst case with every pause at its jitter upper edge stays |
| J4 sample == 1 accepted (range check <= 1) | KILLED | 1 failed | 41 passed (42) | `cms-taxonomy-merge-converge-effect.test.ts` | a sample that is exactly one |
| J5 negative sample accepted | KILLED | 1 failed | 41 passed (42) | `cms-taxonomy-merge-converge-effect.test.ts` | a sample that is negative fro |
| J6 NaN sample accepted (negated comparisons) | KILLED | 1 failed | 41 passed (42) | `cms-taxonomy-merge-converge-effect.test.ts` | a sample that is NaN from a b |
| J12 infinite/large sample clamped instead of ignored | KILLED | 3 failed | 39 passed (42) | `cms-taxonomy-merge-converge-effect.test.ts` | a sample that is exactly one |
| J7 jitter not floored (fractional ms) | KILLED | 1 failed | 41 passed (42) | `cms-taxonomy-merge-converge-effect.test.ts` | rounds the added time down to |
| J8 Math.random seam ignored (constant 0.5) | KILLED | 1 failed | 41 passed (42) | `cms-taxonomy-merge-converge-effect.test.ts` | defaults to Math.random |
| J9 injected random ignored | KILLED | 8 failed | 34 passed (42) | `cms-taxonomy-merge-converge-effect.test.ts` | pauses 15 s then 60 s between attempts (BE00 platform.job.execu |
| J10 one sample reused for both pauses | KILLED | 9 failed | 33 passed (42) | `cms-taxonomy-merge-converge-effect.test.ts` | pauses 15 s then 60 s between attempts (BE00 platform.job.execu |
| J11 integration advance without jitter headroom | KILLED | 1 failed | 4 passed (5) | `production-async-entrypoint-taxonomy-merge.test.ts` | a persistent dependency faul |
| G1 not-wired path silent | KILLED | 3 failed | 9 passed (12) | `production-job-effect-dispatcher-taxonomy-merge-telemetry.test.ts` | an effect that is not wired lo |
| G2 unmapped path silent | KILLED | 4 failed | 8 passed (12) | `production-job-effect-dispatcher-taxonomy-merge-telemetry.test.ts` | an answer outside the disposit |
| G3 thrown path silent | KILLED | 1 failed | 11 passed (12) | `production-job-effect-dispatcher-taxonomy-merge-telemetry.test.ts` | an effect that throws logs one |
| G4 attempt defaults to 7 | KILLED | 1 failed | 11 passed (12) | `production-job-effect-dispatcher-taxonomy-merge-telemetry.test.ts` | no Worker context: the deliver |
| G5 guard logs a success outcome | KILLED | 7 failed | 5 passed (12) | `production-job-effect-dispatcher-taxonomy-merge-telemetry.test.ts` | an effect that is not wired lo |
| G6 guard logs a wrong code | KILLED | 7 failed | 5 passed (12) | `production-job-effect-dispatcher-taxonomy-merge-telemetry.test.ts` | an effect that is not wired lo |
| G7 guard ignores injected logger | KILLED | 8 failed | 4 passed (12) | `production-job-effect-dispatcher-taxonomy-merge-telemetry.test.ts` | an effect that is not wired lo |
| G8 guard also logs on valid effect answer | KILLED | 1 failed | 11 passed (12) | `production-job-effect-dispatcher-taxonomy-merge-telemetry.test.ts` | a valid answer from the effect |
| G9 guard logs for every job type | KILLED | 1 failed | 11 passed (12) | `production-job-effect-dispatcher-taxonomy-merge-telemetry.test.ts` | other job types never log a me |
| R1 runbook drops a code | KILLED | 2 failed | 6 passed (8) | `cms-taxonomy-merge-converge-runbook.test.ts` | lists exactly the error codes the effect can write, each i |
| R2 BE03c table drops a code row | KILLED | 1 failed | 7 passed (8) | `cms-taxonomy-merge-converge-runbook.test.ts` | agrees with the BE03c registry: the same codes, and the sa |
| R3 BE03c table renames a code | KILLED | 1 failed | 7 passed (8) | `cms-taxonomy-merge-converge-runbook.test.ts` | agrees with the BE03c registry: the same codes, and the sa |
| R4 BE03c table state differs (succeeded code) | KILLED | 1 failed | 7 passed (8) | `cms-taxonomy-merge-converge-runbook.test.ts` | agrees with the BE03c registry: the same codes, and the sa |
| R5 BE03c adds a ninth code | KILLED | 1 failed | 7 passed (8) | `cms-taxonomy-merge-converge-runbook.test.ts` | agrees with the BE03c registry: the same codes, and the sa |
| R6 runbook stops citing BE03c | KILLED | 1 failed | 7 passed (8) | `cms-taxonomy-merge-converge-runbook.test.ts` | cites the BE03c section as the registry of the codes |
| R7 code constant renamed | KILLED | 2 failed | 6 passed (8) | `cms-taxonomy-merge-converge-runbook.test.ts` | lists exactly the error codes the effect can write, each i |
| R8 code constant added (ninth) | KILLED | 2 failed | 6 passed (8) | `cms-taxonomy-merge-converge-runbook.test.ts` | lists exactly the error codes the effect can write, each i |
| R9 runbook reverts m-f1 text | KILLED | 1 failed | 7 passed (8) | `cms-taxonomy-merge-converge-runbook.test.ts` | states what really drains an unconverged tail: only a late |
| R10 runbook worst case stale (120 s) | KILLED | 1 failed | 7 passed (8) | `cms-taxonomy-merge-converge-runbook.test.ts` | states the retry pauses the effect really uses and records |

M2 (`taxonomy-term-details.ts`: drop the 403 `{}` branch) survives and is an EQUIVALENT mutant now: lane hardening_4 moved the same rule into `taxonomy-safe-details.ts` (403 returns `{}`, line 41), so the branch in `taxonomy-term-details.ts` is redundant; it was killed in the first pass only because the shared helper still published `CAPABILITY_REQUIRED`. The redundant branch is in a file outside this brief (hardening_4 and its oracle are another lane's); root may remove it.

### Files changed in fix pass 2 (path, lines, SHA-256)
| path | lines | SHA-256 |
| --- | --- | --- |
| `apps/worker/src/cms-taxonomy-merge-converge-effect.ts` | 212 | `06329e4ff54ff6ba5711899305f65022c53cf48c4d21009cc23c7337a91911b2` |
| `apps/worker/src/cms-taxonomy-merge-converge-effect.test.ts` | 397 | `ac2dcbaa70fe2b42e9f2d45678c4bc2709e03b26c1399690658abf8a5b2062cd` |
| `apps/worker/src/cms-taxonomy-merge-converge-names.ts` | 38 | `07c8d114e48b0f8192ceb3d39316e768bd38927ad7c0622e5e9bde4c6a2c394f` |
| `apps/worker/src/cms-taxonomy-merge-converge-runbook.test.ts` | 143 | `7f1cd09de6207f804987f1a015bbb3adce4d2f0f7d6177c645dab53265a97b6c` |
| `apps/worker/src/production-job-effect-dispatcher.ts` | 259 | `ddb63cd76cd1697d52524dae9a9b33bdf593efa7b64b053f099a17e8838eb44b` |
| `apps/worker/src/production-job-effect-dispatcher-taxonomy-merge-telemetry.test.ts` | 195 | `45e7bbb71b9aa8a4186e5170aea24d390621af75a1a80c7e3653c5078ffa41a2` |
| `apps/worker/src/production-async-entrypoint-taxonomy-merge.test.ts` | 238 | `380801cab4e64b3799971f40b7c3a8e7c39ecfcfdd7f6cf1a680a2574e88c7f5` |
| `docs/runbooks/platform/cms-taxonomy-merge-converge.md` | 86 | `6da29bce32635d9a855fcfd5455909d271185d0d7f5a5771756a8e978b051fed` |
| `apps/worker/src/README.md` | 141 | `767f67408d7e340e668fcaa335e8bf0378adea110c99111a47501df9fbf79f98` |
(`cms-taxonomy-merge-converge-claim.test.ts`, `-rpc.ts`, `-telemetry*.ts`, and the other dispatcher tests are unchanged from the fix-pass table.) The new file is `production-job-effect-dispatcher-taxonomy-merge-telemetry.test.ts`.

### Test corrections (for independent review)
1. `cms-taxonomy-merge-converge-effect.test.ts` "pauses 15 s then 60 s ...": the call now passes `random: () => 0` (the jitter-free lower edge) so the exact base pauses are still asserted; the jitter itself has its own suite. Same assertions, no weakening.
2. `production-async-entrypoint-taxonomy-merge.test.ts` "a persistent dependency fault is retried ...": the fake-timer advance (75,000 ms) is now the pause sum times `1 + MERGE_RETRY_JITTER_FRACTION` (82,500 ms), because the real pauses carry up to 10 % jitter from `Math.random`. Same assertions (3 RPC calls, `failed` `DEPENDENCY_UNAVAILABLE`, `p_retryable false`, one ack); mutant J11 shows the headroom is load-bearing.
3. `cms-taxonomy-merge-converge-runbook.test.ts`: the `lists exactly the error codes` test now reuses a shared column parser; assertions equal (the set of the runbook errorCode column equals the constants), with the BE03c registry test added.

### Decisions (implementation tier)
- D-F5 Jitter bound +0-10 % of each base pause (BE00 550 states none), see item 2; reversible by changing `MERGE_RETRY_JITTER_FRACTION` (the tests pin 0.1, 127.5 s and the runbook text).
- D-F6 The dispatcher guard logs through the same telemetry module with an optional `taxonomyMergeLogger` seam; the guard logs only for the three guard failures.

### Open items / BOUNDARY
Unchanged from `## Fix pass`: the recovery BOUNDARY (BE03c has no re-request rule; see item 6 for the AC-226 dependency) and the job-chain false negative. The 15,000 ms RPC ceiling against a cold 5,000-row batch is still unmeasured. A guard-path double event is possible only for a non-conforming effect.

### Requests to root
1. Decide whether P2-S12-AC-226 can close while the recovery BOUNDARY is open (it says "every active TermAssignment"; a persistent fault past 5,000 assignments leaves a tail until BE03c adds a re-request rule). If not, the BE03c recovery rule and SQL of `## Fix pass` Requests #1 are a prerequisite.
2. Open a tracking issue for the recovery BOUNDARY (spec gap: BE03c has no command or schedule that re-requests `cms.taxonomy.merge_converge` for a retired term with unconverged assignments and no live job; current behaviour: job `failed`, alert, runbook, no recovery; desired: the reconciliation of `## Fix pass` Requests #1). Quote the issue number into the runbook "Mitigation and the open gap" section.
3. BE03c registration (`## Fix pass` Requests #2) is now present in the spec and is checked by the new sync test; the BE03c table is therefore binding: any change to a code must change the spec, the runbook and `TAXONOMY_MERGE_JOB_ERROR` together.
4. Ratify D-F5, D-F6 and Test corrections #1-#3 above. Independent re-review of this pass, then the canonical Worker gate.
5. Optional: remove the now-redundant 403 branch in `taxonomy-term-details.ts` (equivalent mutant M2; hardening_4's file).
