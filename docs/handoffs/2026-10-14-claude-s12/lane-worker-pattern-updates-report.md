# Lane worker-pattern-updates report (claude_s12_worker_pattern_updates)

## Status
GREEN (final 2026-10-15T11:51Z). The Worker transport for CMS-03C-13/14/15 is built, test-first, over the unpromoted SQL RPCs; all gates green.
History: checkpoint 1 (08:55Z estimate, spec/SQL/precedent read) -> predecessor wrote the transport (files dated 08:53-09:10Z) and was killed at its usage limit before recording it -> checkpoint 2/3 (resume inventory, 11:33Z/11:36Z) -> finish pass (this report).
HEAD verified `b16edb54a7a1b698ed8ca15b6085046d4270626e`. Nothing under supabase/**, packages/contracts or apps/web touched.

## Scope
Worker HTTP transport for CMS-03C-13 (GET /api/v1/cms/patterns/selector), CMS-03C-14 (GET .../instances/{instanceId}/update-diff), CMS-03C-15
(POST /api/v1/cms/compositions/pattern-updates) over `platform_api.cms_list_pattern_selector`, `cms_get_instance_update_diff`, `cms_apply_pattern_update`
(WIP `supabase/migrations-wip/pattern-updates/2026101414*`; re-read at 11:50Z, last SQL change 07:32 local = R7 selector reorder, no answer-shape change).

## Design (as built)
- One dependency bundle `cmsPatternUpdate` (`CmsPatternUpdateDependencies`: `readSelector`, `readUpdateDiff`, `applyUpdate`, rate, session, telemetry) wired through `WorkerDependencies`, `createRuntimeDependencies` (last positional argument) and `ProductionCmsCompositionDependencies`.
- Table `pattern-update-operations.ts`: RPC name, write flag, registry deadline (reads 8,000 ms, command 15,000 ms), rate class, user/party ceilings (300/600, 300/600, 60/120), answer-size ceiling (diff reads up to 524,288 B of jsonb text because PostgreSQL relays jsonb with spaces; strict schema re-enforces 262,144 compact).
- GET order: origin, request media, verified human session, strict path+query (400/422 before authority), no write headers/body, capability (author|editor in an acting party), user then party quota, port, response contract + request binding, strong ETag (page version / instance version).
- POST order = CMS-03C-02 placement: origin, body ceiling/media, session-bound CSRF, bytes (262,144 cap), verified session, empty query, strict body, Idempotency-Key + strong If-Match == body.expectedVersion (before authorization), capability, quota, port, response binding (one row per instance in order, version+1, shared revision, entry ETag = expectedVersion+1).
- Production adapter: request-bound context re-proved from a fresh session resolution (401 on drift, 403 capability_missing on revoked grant, before any network), one call, no retry, one deadline, byte ceiling per operation; `X-Idempotency-Key`/`If-Match` forwarded for the command; ETag read from the PostgREST response header.
- Selector route registered before `/api/v1/cms/patterns/:patternKey` (route precedence pinned in `production-worker-runtime-pattern-update.test.ts`).
- 403 details: `patternUpdateDetails` delegates to hardening-4's `forbiddenDetails` (`capability-details.ts`); `CAPABILITY_REQUIRED` never relayed.

## Status / code mapping per operation
Catalog codes are the BE03c composition catalog (`error-catalog.ts`): 400 INVALID_REQUEST, 401 UNAUTHENTICATED, 403 COMPOSITION_FORBIDDEN, 404 COMPOSITION_NOT_FOUND, 409 COMPOSITION_VERSION_CONFLICT, 415 UNSUPPORTED_MEDIA_TYPE, 422 COMPOSITION_VALIDATION_FAILED, 429 RATE_LIMITED, 500 INTERNAL_ERROR, 502/503/504 DEPENDENCY_UNAVAILABLE (retryable true).

| Condition | 13 selector | 14 update-diff | 15 pattern-updates |
|---|---|---|---|
| Disallowed origin | 403 (no reason) | 403 | 403 |
| Wrong media / CSRF / oversize body / bad bytes | 415 media on a sent body / 400 | same | 415 non-JSON, 400 CSRF/oversize/malformed |
| No / unverified / non-human session | 401 | 401 | 401 |
| Unknown/duplicate/empty key, bad contentTypeId, cursor >512 or bad limit syntax | 400 | n/a | n/a |
| Limit integer outside 1-50 | 422 `/limit` | n/a | n/a |
| Bad instanceId / any query key | n/a | 400 | n/a |
| Non-empty query, bad key/If-Match, If-Match != expectedVersion, body grammar | n/a | n/a | 400 (422 where SQL points at a pointer) |
| No author/editor capability or no acting party | 403 `capability_missing` | 403 `capability_missing` | 403 `capability_missing` (no quota consumed) |
| Quota denied (user, then party) | 429 + Retry-After + RateLimit-* | same | same |
| Hidden / absent content type, instance, entry | 404 | 404 | 404 |
| Cursor foreign/tampered/expired | 409 (no member) | n/a | n/a |
| Stale entry or instance version | n/a | n/a | 409 `expectedVersion`/`currentVersion` only |
| `revision_not_editable`, `diff_has_collisions` | n/a | n/a | 409 `reasonCode` only |
| IDEMPOTENCY_MISMATCH / IDEMPOTENCY_CONFLICT / CONFLICT (lock) | n/a | n/a | 409 plain |
| `diff_too_large` | n/a | 422 `reasonCode` only, no pointer | n/a |
| `pattern_version_not_active`, `pattern_incompatible`, `nested_pattern_not_active` | n/a | n/a | 422 `reasonCode` only (pointer dropped) |
| Pointer-shaped VALIDATION_FAILED | 422 `/limit` | n/a | 422 allowlisted `/instances/N/...`, `/targetPatternVersion`, `/action`, `/expectedVersion` pointers |
| Replay of a completed key | n/a | n/a | stored body + ETag identical |
| Malformed/oversized/foreign/mismatched answer or ETag | local 502 retryable | local 502 | local 502 |
| Provider 500/502/503/504, fetch reject, verifier throw | 503 DEPENDENCY_UNAVAILABLE retryable | same | same |
| Deadline (8,000 / 8,000 / 15,000 ms) or client abort | 504 | 504 | 504 |
| INTERNAL_ERROR token, PGRST*, raw SQLSTATE, unknown token, a Slice 12 reason of another operation, `CAPABILITY_REQUIRED` | scrubbed 500 | scrubbed 500 | scrubbed 500 (also `pattern_cycle`/`pattern_depth_exceeded`/`pattern_nodes_exceeded`, which 15 does not publish) |

## Files (path under apps/worker/src, lines, SHA-256 at 11:51Z)
All new/untracked except the six tracked shared files (worker-route-composition, production-worker-runtime-cms, production-worker-runtime, worker-types, cms-editorial-production-types: register/wire only; `cms-editorial-production-boundary-types.ts` is the new split-out of the shared boundary types to stay under 300 lines) and README.md (paragraph appended).
Resume-session edits: `pattern-update-details.ts` (403 via `forbiddenDetails`); `cms-composition/README.md` paragraph; prettier on all lane files; test files over 400 lines split with identical test count (552) into `pattern-update-admission.test.ts`/`-admission.test-support.ts`/`pattern-update-faults.test.ts`, `pattern-update-routes.test.ts`/`pattern-update-refusals.test.ts`/`pattern-update-post.test-support.ts`, `cms-composition-production-pattern-update-rpc.test.ts`/`-context.test.ts`/`-rpc.test-support.ts`.

| File | Lines | SHA-256 |
|---|---:|---|
| cms-composition-production-pattern-update-apply.test.ts | 326 | e6e80d2c669780f0aa6b33bfc4b51641478cc1840a4adc2caacfbb1504cfc98c |
| cms-composition-production-pattern-update-config.test.ts | 252 | 90d2f0cb32acbebf0e6b27f6d7cc6e5bd3bf16c4fc93e6fe3712d9e28071b184 |
| cms-composition-production-pattern-update-context.test.ts | 218 | 4def1e6533a2297a57278aa922f6aaa368f6aa7646b582e0c203462dbdee24f9 |
| cms-composition-production-pattern-update-failure.test.ts | 366 | 7fa6e498271c9a6d2cd2bef3a700f904521c7a19ad5830bcfdab52734f413b72 |
| cms-composition-production-pattern-update-failure.ts | 126 | d166d3d4a8b4991242f90bd29131b06da83c6f973af0dc33cf97c305e2de0cd1 |
| cms-composition-production-pattern-update-rpc.test-support.ts | 33 | ada97c174448824841df007740d140837a4ca9e04c9c278c2e803b82bcb63cd2 |
| cms-composition-production-pattern-update-rpc.test.ts | 247 | f42f3293f82d85c0a8de97653c1a1eddd9afabc48a19b01a83f9570a7cb309a8 |
| cms-composition-production-pattern-update-rpc.ts | 224 | 1dbb1f2e2bdc2b7cbd30fd1a214aa75e945e8e4f3b07a24dd24d822802e1329f |
| cms-composition-production-pattern-update.test-support.ts | 117 | cfb3cf390155831e07733a0b09d68529e59ed7d8d3763d4cc21e2eeec3e4b3e7 |
| cms-composition-production-pattern-update.test.ts | 242 | f163f7a43e748889c0aef8a6658cc33ae4a84d82275d15a11d96439a0b7f2c94 |
| cms-composition-production-pattern-update.ts | 172 | 9d1bade19aff5329416a4b6dd486cec7abbd951a47e21454ba749e390b99d05b |
| cms-composition/pattern-selector-query.test.ts | 103 | 5dbec581eed273f9aa2a4fdb59e7a158af6c40925590decbc81d435d6f3c67ba |
| cms-composition/pattern-selector-query.ts | 63 | 8c7a4b4dbb18105dc44b07d11b990fa54c8068efe0fe92d8279d1bb0edf8ebe3 |
| cms-composition/pattern-selector-routes.test.ts | 222 | 0573d2002a2eee07224a767992d806faea936558c0e1244d79b061e30594d7ec |
| cms-composition/pattern-selector-routes.ts | 56 | 598044776dc8991b9f0547e7a642692d03ef313db86f640832d6afca23e1aa22 |
| cms-composition/pattern-update-admission.test-support.ts | 65 | f172563151b760e9068c55313136c3499a3ffbc44ee0e534b36f09b7eae4fa10 |
| cms-composition/pattern-update-admission.test.ts | 248 | 0568bd07619ff5760ef38d5231c9f2ff27893ec5ed351a36dba18e6e3db8fe95 |
| cms-composition/pattern-update-answers.test.ts | 273 | 883d9471968d26139f93eea97cafe4b4af396b7e5a42bb9007837eff4548fa4b |
| cms-composition/pattern-update-answers.ts | 101 | 2d872390d9ce70d7438a1441c788762c003d1c49131caeb4686d0b26f02b9e54 |
| cms-composition/pattern-update-details.test.ts | 147 | 66e145ec5ed0e60f524bd3c15abde3486ff6eb01a0a8027b7e2b9341f42e9c02 |
| cms-composition/pattern-update-details.ts | 49 | 974cd548cdee829b309ef5d98c13d292718d0816baed81df966ab07097ca8c49 |
| cms-composition/pattern-update-diff-routes.test.ts | 166 | d49f6fd4743e2e461d8ceafb502b3d4c148a3201c4bb95f9921f41c49827292b |
| cms-composition/pattern-update-diff-routes.ts | 83 | c36f4f6919bf7761f01f57e0578dccd9c5e95c31742af894a50115830f616c1e |
| cms-composition/pattern-update-faults.test.ts | 228 | bae7c7c3e8c34f4bfa6b4b4711176b1126e7f389553f7ae6557e2367c43c981c |
| cms-composition/pattern-update-operations.ts | 62 | d91d4256b303b2e16b86ce428454d396b078fdc870a0095e71cbbff923791804 |
| cms-composition/pattern-update-order.test.ts | 163 | c20394be26b3df12007a733b883b99f1f2bce064d1295adc1c40b201970772c5 |
| cms-composition/pattern-update-ports.ts | 196 | 0c14c291ab1b7ebdc997de8912e105697d45e548d63df2e6d94461932550aafc |
| cms-composition/pattern-update-post.test-support.ts | 25 | dac995ce61a1d829356589ab4952f8a52ba5da9fb877dafb27d7974ebe121c34 |
| cms-composition/pattern-update-read.ts | 111 | 2c7ab0d3b3e1aad32fd6cc680db64ed1ee7519941a00dcbe4663d98b4a3dd18a |
| cms-composition/pattern-update-refusals.test.ts | 194 | 3aa08d47ab7f6713c42be0468fbe58a77d12c06f3ca0e8b4f2cd1f1de0fd3175 |
| cms-composition/pattern-update-registry.test.ts | 113 | 374c8063c236f2ed3a9285f7f0a2310a869c90901a2474911b8d0d179b9926ce |
| cms-composition/pattern-update-response.ts | 203 | b11e1c7c40ff118b0a240eb5cae18eb7f65d187e3c3f9f3c9bffe47eca2d2b4e |
| cms-composition/pattern-update-routes.test-support.ts | 90 | 37689efe21ce0435383019cedf90c9c2086a77af1aa606664a9366a0acff6133 |
| cms-composition/pattern-update-routes.test.ts | 274 | e0a3db586ae78699267d34793483683f6ad9b192f86f2dda877dc6a5ccba817b |
| cms-composition/pattern-update-routes.ts | 152 | 5ecbd55fc4c7216934edefffaa0e5ee31dafd3966810e8be17ce818b32f865a6 |
| cms-composition/pattern-update.test-support.ts | 153 | 46c5eedb91e4da27598f8b8dcf2041867e767671bcab897eb56a9d858aaa1787 |
| cms-editorial-production-boundary-types.ts | 103 | f727e235d9e738ca924fe9142f6b54332be2a30a3c68bd0ea6b155597269c985 |
| production-worker-runtime-pattern-update.test.ts | 224 | 8b128e47e959ee6588217b2bd8faf89f2496e37775b36784ab615e77156d9266 |
| worker-route-composition.ts | 271 | 7eb35e2b49f2f7f117b1d71f0ff7d40a6230270ddbc91dd9307f5232e952f17c |
| production-worker-runtime-cms.ts | 284 | 257a6d036d8287a1722a671aaa9a18b1e5ac0857cb69176f37366f5931ad0462 |
| production-worker-runtime.ts | 217 | 2fbf2bf51a63571b1faf3b70fce9463435b495ac4c65b3dcd93f610a862b0cba |
| worker-types.ts | 126 | 50cda74df9e97582ee0dbfd44f62bb8307cc8f71707a7b852d1111e9c898d154 |
| cms-editorial-production-types.ts | 289 | bc248fd9017abf6edb037424854f904551ae6f18889d636275869af6cde1aa33 |
| cms-composition/README.md | 153 | 455cb3861263256968f7fc7ce09da9a80ea776f75d8bd99ae2cd3d1b45e00f3a |

## Runs (all under flock -s /tmp/wejammin-quiet.lock, pinned PATH; no DB runner used)
| Time (Z) | Gate | Result |
|---|---|---|
| 11:33:20 | Focused Vitest (15 lane files, on resume, before edits) | 15 files / 552 tests passed |
| 11:33:36 | worker `tsc --noEmit` | exit 0 |
| 11:37-11:38 | Focused Vitest after test-file splits (18 files) | 18 files / 552 tests passed |
| 11:38-11:49 | Full `vitest run apps/worker` (JSON receipt `/tmp/claude-1000/-home-rob-Projects-WeJammin/5e403708-915a-4cd3-958f-4ebc866d0c82/scratchpad/claude_s12_worker_pattern_updates/worker-full.json`, SHA-256 b085440bcca991823d3f451023cae63035f7f8f9cb6733b9d11cc007d84ff610) | 1954 suites ok; 11887 tests, 11887 passed, 0 failed, 0 pending |
| 11:49 | 345-test joint set (lane-native-worker-integration-report.md:55-90, 11 files) after touching shared files | 11 files / 345 passed |
| 11:50 | prettier --check (43 lane + shared files) | clean |
| 11:50 | eslint --max-warnings=0 (same) | clean |
| 11:50 | worker tsc --noEmit | exit 0 |
| 11:50 | git diff --check (same) | clean |
RED evidence: the transport tests were written test-first by the predecessor (it died before recording runs); the resume session found no red-by-design state, so no RED/GREEN pair is claimed for those. The only behavior edit this session (403 via `forbiddenDetails`) is a behavior-preserving refactor pinned by the existing 403 tests in `pattern-update-details.test.ts` and `cms-composition-production-pattern-update-failure.test.ts`.

## Test corrections
None. No existing oracle was changed; split-outs preserved every test (552 before and after).

## Spec citations
BE03c 175-177 (route registry), 215 (If-Match operands), 398-400 (validation), 1266-1268 (error matrix), 1287/1294-1304 (typed refusals), 1342-1348 (lock order is SQL's), 1474-1476 (authority); BE00 172 (502/503/504 retryable true); registry rows `packages/contracts/src/platform-registries.ts:2123-2160` pinned by `pattern-update-registry.test.ts`; contracts `pattern-selector.ts`, `pattern-update.ts`, `pattern-update-diff`, `refusals.ts`.

## Open items / BOUNDARY
- Stale sentence in `cms-composition/README.md` (about line 29-31): "Pattern source creation, activation, selector read, and linked-update authority still await locked contract decisions" is now false; brief limited me to appending, so it is left for root/hardening-4 to reword.
- SQL fix pass 2 in flight (R1 detach whitelist, R2 dropping the `/targetPatternVersion` re-raise, R4 offer scope, R7 selector reorder): none changes an answer shape; the Worker already treats `pattern_cycle`/`pattern_depth_exceeded` on 15 as the scrubbed 500 (not published by 15) and any pointer as allowlisted-or-dropped. If R2 lands the raw `/patternId` pointer on `nested_pattern_not_active`, it is dropped by the typed-reason path (no change needed).
- Known owner-pending semantics (override replaces whole node props; removed-root keep-yours; target-added root; detach over 128 keys; retired-head detach) are SQL behaviors the Worker relays as 200/422 unchanged; no BOUNDARY is needed because the Worker validates only shape and request binding, never those semantics.
- Hosted/production claims: none. SQL not promoted, so no live PostgREST exercise of these three RPCs was possible from this lane.

## Requests to root
- Promote the pattern-updates SQL before any live wiring claim; this lane's tests use a stubbed fetch.
- Reword the stale README sentence above.
- Independent review requested for: request-bound context re-proof (`createPatternUpdateContextVerifier`), the refusal-by-token mapper, and the response-binding validators in `pattern-update-answers.ts`.
