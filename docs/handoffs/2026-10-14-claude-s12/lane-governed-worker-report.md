# Lane report: claude_s12_governed_worker (phase 1, CMS-03C-06)

## Status
GREEN (phase 1 only). CMS-03C-06 `POST /api/v1/cms/governed-reviews` Worker transport is implemented test-first
against `platform_api.cms_submit_governed_review(p_request jsonb)`. Phase 2 (07/08/10/11) is not started; no RPC was
guessed. 2026-10-14, worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, HEAD `b16edb54`.

## Scope
Route + ports + response projection + production RPC adapter + wiring (register/compose only). No SQL, contracts,
OpenAPI, Web, config or lockfile change. No git add/commit. Registry facts (rate 30/user, 60/party per 60s, 15,000ms,
`any_of` designer/curator, key required, no If-Match, no step-up, 201) come from `platform-registries.ts:1957` and BE03c
row 168; the rate-map entry lives in the frozen registry, so the only rate-related edit is the operation-id union.

## Files (path, lines, SHA-256)
New (all <=300 lines):
| path | lines | sha256 |
|---|--:|---|
| apps/worker/src/cms-composition/governed-review-ports.ts | 220 | a10cf4618769d1ed00432dea6af11fb679718b741e4db932c0efd451db0181e6 |
| apps/worker/src/cms-composition/governed-review-response.ts | 261 | 4a7bc11b1346fb0b1fd18933e022dd454f96c7e0f55a7e37b82172e838f8fa07 |
| apps/worker/src/cms-composition/governed-review-routes.ts | 143 | a32e124d69f840903b90bc75221bbe93006ce91110d928c5d16a1b0c9c9f08bf |
| apps/worker/src/cms-composition-production-governed-review.ts | 164 | 40f9418358f42918f3f6c27977ac2add869e7b215d86b670d50dc02bd565f434 |
| apps/worker/src/cms-composition-production-governed-review-rpc.ts | 192 | d1c537016bba971236065bfcd11af0a16ea2d9c3dd5dde26104fcfb8a5779b6c |
| .../cms-composition/governed-review-submit.test-support.ts | 284 | 1a2d3b3ff258a7568a4ef538cb5b1f3e770a57b720a4a1e33c514d89986f3a40 |
| .../governed-review-submit.test.ts | 272 | 5395e52517c1f0a3a0839479b4dcbc1584e2dfcc98ca3c19b6d67f386533fb6f |
| .../governed-review-admission.test.ts | 265 | df908654f40cb158b0b5f4fa43aa6fee4a1910adeb1bf8e54b5d9bf1db3df83f |
| .../governed-review-headers.test.ts | 107 | def54b53b53fe778b2bc09f6adc69cbf0b8926288304d164749cb3cf2b14a1ce |
| .../governed-review-production.test.ts | 169 | cb9718b1a2d7697c7ad33068294c7d8fe5e693b7f3135b1d2b1f2fb700d8511a |
| .../governed-review-refusals.test.ts | 181 | 775ce577e145ca1ec2e1f8f08eccf49e7f1edc39ef9f832cd6b56c8676af8fa8 |
| .../governed-review-provider-boundary.test.ts | 180 | 9c3a919cd35a7d9a4dd5fd9bb896dd56e5835672b8f5adb2409b39f2f64b576f |
| .../governed-review-refresh.test.ts | 162 | 5f06b6a8bb8e69c9ec4ccd9bef77299afe05dc39af890c99a10a3b2a00a8448b |

Shared files edited (additive register/wire only; every existing export, alias, constant, RPC mapping, operation id,
deadline untouched):
| path | lines | sha256 | change |
|---|--:|---|---|
| apps/worker/src/worker-route-composition.ts | 266 | 64707711a7a6c6ef110df35e9362750a2d6c9ca106dda218326d832112ab02a5 | `if (cmsGovernedReview) registerCmsGovernedReviewRoutes` |
| apps/worker/src/production-worker-runtime-cms.ts | 279 | 4f39866dedda48667319fba14f4a0533d57128ddbe8cb661e5b4e25563c29ffc | `cmsGovernedReview` in the composition bundle |
| apps/worker/src/production-worker-runtime.ts | 212 | 113139144ebb0181ec865876f6e995972ee2f57114222c53f3364550d06f1397 | positional param + destructure + spread |
| apps/worker/src/worker-types.ts | 124 | 2a32649528b243351502dfa866c5727f5da82969d66103e389c639f97a2819db | `cmsGovernedReview?` dependency |
| apps/worker/src/cms-editorial-production-boundary-types.ts | 93 | b9bf1311fc16634ca2fa7600474085f5aedb22566fdb72ce31ac30c9fa7bf00d | `'CMS-03C-06'` in the rate operation-id union |
`cms-editorial-production-types.ts` was not touched (still 289).

## Runs
Runner: `pnpm exec vitest run <paths>` from the worktree root (root `vitest.config.ts` includes `apps/**`; the
package-filtered form finds no files), under `flock -s /tmp/wejammin-quiet.lock`, PATH = pinned toolchain.
| time (UTC) | what | result |
|---|---|---|
| 06:04:13 | RED: 4 governed-review suites, production modules absent | 4 files fail "Cannot find module" (feature absent, not a harness defect), 0 tests ran |
| 06:06:25 | GREEN focused (4 files, pre-split) | 205 / 205 passed |
| 06:06-06:08 | mutation checks on the 205: drop If-Match refusal; drop subjectId binding; drop version==='1' binding; `some`->`every` capability | each produced failures (1, 1, 1, 164): tests are non-vacuous; sources restored byte-identical (cmp) |
| 06:07:27 | `pnpm --filter @wejammin/worker type-check` (tsc --noEmit) | exit 0 |
| 06:08:36 | GREEN focused after splitting to 7 files (all <=300 lines) | 7 files, 205 / 205 passed |
| 06:09:32 | existing joint set, the 11 files of lane-native-worker-integration-report.md:67 | 11 files, 345 / 345 passed (same as before my wiring) |
| 06:09:44 | full `apps/worker` suite | 593 files, 9905 / 9905 passed |
| final | `tsc --noEmit` 0; `eslint --max-warnings=0` on the 17 touched files 0; `prettier --check` clean; `git diff --check` 0 | |

## Status / code mapping (CMS-03C-06; catalog `cms.03c.governed-review.v1`)
| source | HTTP | code | details |
|---|---|---|---|
| foreign Origin / bad CSRF | 403 | GOVERNED_REVIEW_FORBIDDEN | {} (before auth) |
| non-JSON media | 415 | UNSUPPORTED_MEDIA_TYPE | {allowedMediaTypes:[application/json]} |
| malformed JSON, >256 KiB, query string, bad/missing Idempotency-Key, any If-Match, rpc envelope >256 KiB | 400 | INVALID_REQUEST | {} |
| no/invalid session | 401 | UNAUTHENTICATED | {recoveryAction:'reauthenticate'} |
| strict body schema failure (unknown/authority member, bad kind/id/hash, missing member) | 422 | GOVERNED_REVIEW_VALIDATION_FAILED | violations at /subjectKind, /subjectId, /subjectHash, else '/' (attacker member names never echoed) |
| no acting party or neither designer nor curator capability | 403 | GOVERNED_REVIEW_FORBIDDEN | {reasonCode:'capability_missing'} before both quotas |
| quota denied (user 30, party 60) | 429 | RATE_LIMITED | retry-after, ratelimit-* |
| SQL `NOT_FOUND` (hidden, absent, cross-owner, non-member: identical body) | 404 | GOVERNED_REVIEW_NOT_FOUND | {} |
| SQL `capability_missing` (visible subject, no kind capability), `separation_of_duties` | 403 | GOVERNED_REVIEW_FORBIDDEN | {reasonCode} |
| SQL `subject_not_submittable` | 409 | GOVERNED_REVIEW_VERSION_CONFLICT | {reasonCode} |
| SQL `IDEMPOTENCY_MISMATCH`, `CONFLICT`, 40001 `VERSION_MISMATCH` | 409 | GOVERNED_REVIEW_VERSION_CONFLICT | {} |
| SQL `canonical_source_unavailable` | 422 | GOVERNED_REVIEW_VALIDATION_FAILED | {reasonCode, domain?} domain only if the JSON DETAIL names a valid canonical domain |
| SQL `INVALID_REQUEST` | 400 | INVALID_REQUEST | {} |
| SQL `INTERNAL_ERROR`, unregistered raise, any slice-11/12 token not in `CMS_SLICE_12_OPERATION_REASONS['CMS-03C-06']` | 500 | INTERNAL_ERROR | {} (scrubbed) |
| provider HTTP 500/502/503/504 (any payload) | 503 | DEPENDENCY_UNAVAILABLE | {dependencyClass:'cms_composition',retryable:true}, retry-after 15 |
| malformed/oversize/non-JSON provider body, bad success shape, wrong subject/state/version binding, oversize response | 502 | DEPENDENCY_UNAVAILABLE | retryable:false |
| route/RPC/refresh deadline (15,000ms) or caller abort | 504 | DEPENDENCY_UNAVAILABLE | retry-after 15 |
| success | 201 | `GovernedReviewResource` (strict) | etag `"<review version>"`, no-store; bound to request: kind/id/hash equal, state open, version '1', 0 decisions, no decidedAt/activatedAt; replay returns the original body |

## Test corrections
none (no existing oracle changed).

## Spec citations
BE03c row 168 (registry), 215 (no If-Match, names subject by id+hash), 216 (no step-up), 389 (field matrix), 1259 and
1293 (error matrix/catalog; every governed 409 is GOVERNED_REVIEW_VERSION_CONFLICT with `details.reasonCode`), 1304 (typed
refusal statuses), 1375 (canonical_source_unavailable domain), 1467 (403 vs 404), 1502 (order: parse, authenticate, owner
capability, subject resolve, ..., reserve idempotency, 201). Registry `platform-registries.ts:1957`. Precedent:
pattern-definition transport (`pattern-definition-*`, 2026-10-13).

## Open items / BOUNDARY
1. SQL/contract mismatch, pattern submit: `20261013300820` raises `pattern_version_not_active` (a non-active nested
   pattern) for CMS-03C-06, but that token is not in the contract's `CMS_SLICE_12_OPERATION_REASONS['CMS-03C-06']`
   (spec 1259 lists only subject_not_submittable and canonical_source_unavailable for 06). Per the frozen contract and the
   pattern precedent the Worker answers a token outside the operation list as scrubbed 500. The Worker reads the contract
   list, so adding the token there (or having SQL raise a listed one) fixes it with no Worker change.
2. Spec 389 says a stored-hash mismatch is `422 at /subjectHash`; SQL (and its 60-case suite) raises
   `subject_not_submittable` (409). The Worker maps the token (409). Body-shape hash errors are 422 at /subjectHash.
3. `canonical_source_unavailable` is raised by SQL with no DETAIL, but the contract requires `details.domain`
   (spec 1375). The Worker forwards `domain` when a JSON DETAIL `{"domain": ...}` carries a valid canonical domain and
   otherwise emits `reasonCode` only. Needs a SQL change to be fully conformant (see requests).
4. Per-kind owner capability (designer for template/pattern, curator for taxonomy) is deliberately SQL's decision: a
   Worker-side kind check would turn a hidden-subject 404 into a 403 and break concealment (spec 1467). Worker gates the
   registry `any_of` only, and re-proves it on the refreshed session.
5. `apps/worker/src/cms-composition/README.md` (not in this lane's files) should gain one line naming the governed-review
   files when root reviews.
6. Phase 2 (CMS-03C-07/08/10/11) waits for root to add the governed-a `## RPC boundary` to the brief. The ports/response/
   RPC modules already name the operation union and RPC table in one place each (`GovernedOperation`,
   `GOVERNED_RPC`), but CMS-03C-07..11 need their own capability gates (reviewer / step-up), which are not assumed here.

## Requests to root
1. Decide item 1: add `pattern_version_not_active` to `CMS_SLICE_12_OPERATION_REASONS['CMS-03C-06']` (contracts are
   frozen for me) or have SQL emit a listed token.
2. Have the SQL lane emit `canonical_source_unavailable` with `DETAIL '{"domain":"<canonical domain>"}'` so `details.domain`
   reaches the browser; the Worker already consumes it (covered by test).
3. Confirm item 2 (spec 389 vs SQL 409) is intended.
4. Release phase 2 with the governed-a RPC boundary.

## Fix pass
Status: GREEN (fix pass). 2026-10-14, HEAD `b16edb54`, all review items closed except the root-owned ones listed below.

### Changes (each test-first; see Runs)
1. MAJOR (review finding 1): a provider 4xx that carries no product token is now a scrubbed 500 (BE03c 1298-1302), not a
   caller refusal. New shared predicate `cms-composition/provider-fault-guard.ts` `carriesProductToken(payload)`: true only
   for a record whose `code` (trim/upper, as `codeFromRpcError`) is `P0001`, `40001` or a `STRUCTURED_TOKENS` member.
   Applied immediately before the shared `mapCmsEditorialRpcFailure` fallback in: governed `governedRpcError`
   (`cms-composition-production-governed-review-rpc.ts`), pattern definition/latest `patternRpcError`
   (`cms-composition-production-pattern-definition-latest.ts`; one function serves CMS-03C-12 and the latest read) and
   taxonomy definition `taxonomyRpcFailure` (`cms-composition/taxonomy-definition-response.ts`; serves write and versions
   read). Provider 5xx -> 503 and the explicit INTERNAL_ERROR/40001 branches are untouched and still precede it.
   Traced cases now 500: `PGRST202`@404, `PGRST301`@401, `42702`@400, `23505`@409, `42501`@403, `PGRST116`@422,
   token-less 429, code-less/numeric-code payloads, unsupported 4xx (418, previously 503), array/string/null payloads.
   Controls kept: structured `NOT_FOUND`/`INVALID_REQUEST`, `P0001` tokens, `40001 VERSION_MISMATCH`.
2. Header validation order (finding 2): BE03c 1502 is "parse -> authenticate -> capability" and the 408 "All" row puts
   headers/body validation (400/415/422) first, so Idempotency-Key/If-Match checks now run before capability and both quota
   consumptions. Applied to governed `governed-review-routes.ts`, and to the same defect in the precedent write routes
   `pattern-definition-routes.ts` (Idempotency-Key, If-Match, If-Match/expectedVersion agreement) and
   `taxonomy-definition-write-route.ts` (header/transport parse). Body-422 still precedes header-400 as before.
3. Domain-less `canonical_source_unavailable` (finding 3): ruling = 502 `DEPENDENCY_UNAVAILABLE`, not 422 and not 500. Reasons:
   the contract (`refusals.ts:257-263`) and BE03c 1375/1314/1611 make `details.domain` mandatory, so a domain-less answer is
   a contacted dependency's invalid response, and BE00 592 assigns that to 502; it is a catalog-generated token (so not the
   1298-1302 "message not generated by the catalog" case); and `taxonomy-definition-response.ts:117` already answers the
   same token 502 on the taxonomy transport. Valid `{"domain": <canonical>}` DETAIL still yields 422 with `domain`.
   Absent/prose/non-JSON/array/empty/non-canonical/numeric DETAIL all -> 502 with no `reasonCode`/`domain` leaked.
4. Test gaps (finding 4a-e): added `governed-review-observability.test.ts` (13 tests): retry-after 15 on provider
   500/502/503/504 -> 503, no retry-after on local 502/500; 429 `retry-after`/`ratelimit-limit`/`-remaining`/`-reset` and
   `details {retryAfterSeconds, limit, resetAt}` for user (30) and party (60); SQL-side `VALIDATION_FAILED` + DETAIL
   `["/subjectHash"]` -> 422 at `/subjectHash` (BE03c 389) and unlisted pointer collapse to `/`; `x-correlation-id`
   honoured/invalid/absent on the wire header, `p_request.correlationId` and `context.correlationId`; telemetry event shape
   with no hash/key/user/party/provider text. Mutation-checked (retry 15->16: 4 fail; drop ratelimit-limit: 2; drop
   ratelimit-reset: 2; telemetry status: 1; sources restored byte-identical by cmp).
5. README (finding 5): `apps/worker/src/cms-composition/README.md` now names the governed-review, pattern-definition and
   taxonomy-definition files, the guard, and the extension step.

### Files (path, lines, SHA-256)
| path (under apps/worker/src/) | lines | sha256 |
|---|--:|---|
| cms-composition/provider-fault-guard.ts (new) | 21 | 3c586e86b90c6d62074297cb1b0739f32e2be324a4538b6bc5b95fa6238869cc |
| cms-composition/governed-review-routes.ts | 144 | e89292dcda37163eaf29961c0aed74312ed276c5f2eb5d5695d75e97998041d0 |
| cms-composition-production-governed-review-rpc.ts | 200 | 142131f55f0f157b19c5cfb22bf2dbff04a4902e69866a9162db7bbad17922b9 |
| cms-composition/governed-review-refusals.test.ts | 216 | 57da741cea0c68d0eab160190173c99071713248a2076d28ba37f34be4da65b9 |
| cms-composition/governed-review-headers.test.ts | 110 | db2719c8ca91d1fc23088ea88a989dfbd3b71e88620f1396bc9cfd1bc90b398c |
| cms-composition/governed-review-provider-fault.test.ts (new) | 133 | 8b83e63910f5f7910fdf3ccc9f022da8ee0ba7b61698970851206a68f2feba5d |
| cms-composition/governed-review-observability.test.ts (new) | 186 | de1537ee7a00b33096789ac1e034a21ea405d23a192005a4e348509ae5065a14 |
| cms-composition/pattern-definition-routes.ts | 151 | 3732ce740df8cf9b9a9d0cf4b24290f8d9aed7393f353ee370aa753893300d14 |
| cms-composition-production-pattern-definition-latest.ts | 207 | b09c79a9505a3b2de538e855c659cfea1886247da8276e70fa7f1d6294fb5a2b |
| cms-composition/pattern-definition-write.test.ts | 297 | d4ec8f908c006bb9120d2f475f1ba2cb9b689ff60c6ecc83c62fcaf362aa57d9 |
| cms-composition/pattern-definition-provider-fault.test.ts (new) | 70 | 66aa889bc028fef602aecd99337ce0f1c7426d0ad15c4039bd3f23ec05a9815e |
| cms-composition/taxonomy-definition-response.ts | 281 | 8f543957be7eff422600eeac38f2f2bfbd97ad6805a499145f11af0ff72a1cc0 |
| cms-composition/taxonomy-definition-write-route.ts | 103 | 9dc628043df3fd3cb385ad054afa1fa09591acfe0263b7ce7c867a0c572c4550 |
| cms-composition/taxonomy-definition-write.test.ts | 231 | bdb5d2377cd5d59d3bfcca0b1eb127a1348bfeb374a4b9e54b04ae6eba7afc56 |
| cms-composition/taxonomy-definition-provider-fault.test.ts (new) | 73 | 518b0495a4e36eccde824eccd1e09689156e144d15ccf7b79c7ae777b1931b92 |
| cms-composition/README.md | 89 | dd036979a8e4066dc3a99d042e01aca4bbf0488f99f211c6cf014d24222b5b18 |
Shared integration files and `cms-editorial-production-types.ts` were not touched in this pass. No file exceeds 300 lines.

### Runs (all `pnpm exec vitest run` from the worktree root under `flock -s /tmp/wejammin-quiet.lock`, pinned PATH)
| time (UTC) | what | result |
|---|---|---|
| 10:33 | RED #1: governed fault suite written, guard absent | 14 fail / 5 control pass (genuine missing behaviour) |
| 10:34 | GREEN governed fault suite after guard in governed adapter | 19/19 |
| 10:34 | RED #2 for precedents: pattern + taxonomy fault suites written after the same guard was added to them; RED proven by neutralising `carriesProductToken` to `true` (restored; cmp-verified) | failures in all three suites (the listing was truncated, exact per-suite counts not recorded); guard restored: 56/56 |
| 10:35 | RED #3 header order: `rateLimit not called` added to 2 governed tests | 4 fail; GREEN after moving the header parse (224 pass over 8 files) |
| 10:35 | RED #4 header order, precedents: same assertion added to pattern/taxonomy write tests | 15 fail (pattern 10, taxonomy 5); GREEN 69/69 after the move |
| 10:36 | RED #5 domain-less canonical_source_unavailable (new cases) | 6 fail; also 1 existing token-loop case needed a domain detail (see Test corrections); GREEN 231 over 8 governed files |
| 10:36 | observability/gap tests (13); one wrong test expectation of mine (pointer collapse) corrected before the recorded green run | 13/13; mutation checks above |
| 10:37:43 | existing joint set, the same 11 files | 345 / 345 passed (unchanged count) |
| 10:37-10:42 | full `apps/worker` suite | 597 files, 9981 / 9981 passed (was 593 / 9905: +4 files, +76 tests) |
| final | governed (9 files) + pattern/taxonomy fault suites | 11 files, 281 / 281 |
| final | `pnpm --filter @wejammin/worker type-check` 0; `eslint --max-warnings=0` on 24 touched .ts files 0; `prettier --check` on 25 touched files clean; `git diff --check` 0; no `any`/TODO/skip/only in new tests |

### Test corrections (for independent review)
1. `governed-review-refusals.test.ts`, former test "carries the canonical domain ... only when the DETAIL names a valid one":
   the second half asserted a lenient 422 `{reasonCode}` with no `domain` for DETAIL `{"domain":"private SQL"}`. That contradicts
   contract `refusals.ts:257-263` and BE03c 1375 (finding 3), so it was replaced by the 502 cases above; the first half
   (valid domain -> 422 with domain) is kept verbatim.
2. Same file, loop "handles reason token %s by the CMS-03C-06 contract list": `sqlRefusal(token)` now passes DETAIL
   `{"domain":"gear"}` for `canonical_source_unavailable` only (otherwise the domain-less case correctly became 502). All other
   tokens, statuses and assertions unchanged.
3. Added assertions only (no oracle changed): `expect(rateLimit).not.toHaveBeenCalled()` in
   `governed-review-headers.test.ts` (2 tests), `pattern-definition-write.test.ts` (2 tests),
   `taxonomy-definition-write.test.ts` (1 test).

### Spec citations
BE03c 408 (All: headers/body 400/415/422), 1298-1302 (unmapped status or non-catalog message -> INTERNAL_ERROR 500), 1314,
1375, 1611 (`canonical_source_unavailable` + `details.domain`), 1502 (parse -> authenticate -> capability order), 389
(`/subjectHash`); BE00 172/592 (502 = contacted dependency invalid response; 500 scrubbed); contract `refusals.ts:257-263`.

### Open items
- Not changed by design (outside my claim): the same unguarded `statusFallback` path remains in the other composition
  adapters that call `mapCmsEditorialRpcFailure` directly: `cms-composition-production.ts`, `-detail.ts`, `-locale.ts`,
  `-pattern.ts` (CMS-03C-02), `-template-errors.ts`, and the shared `cms-editorial-production-ports.ts`/`-quality-gate.ts`.
  Cleaner than seven local guards: add `carriesProductToken` to `mapCmsEditorialRpcFailure` itself (shared mapper, root's
  decision, needs its own regression pass over 03b editorial tests, which rely on code-less 4xx -> status fallback today).
- Same header-before-quota ordering exists in other write routes (template, locale, related-content, pattern-instance,
  taxonomy term action); not in my claim.
- Finding 6 and rulings 1-3 for the SQL lane (token for non-active nested pattern, SQL `detail.domain`, `/subjectHash` 422
  via `VALIDATION_FAILED`) are unchanged and root-owned; the Worker already handles the corrected SQL output (tested).

### Requests to root
1. Decide whether to move `carriesProductToken` into the shared mapper (preferred) for the remaining adapters.
2. Route SQL rulings 1-3 to the SQL lane (unchanged from the review).
3. Release phase 2 (07/08/10/11) with the governed-a RPC boundary.

## Phase 2
Status: GREEN (phase 2). 2026-10-14, HEAD `b16edb54`. CMS-03C-07 decision, -08 assignment, -10 detail and -11 queue
Worker transport is implemented test-first over the promoted SQL boundary (`20261014010000`-`010410`; RPC names, request
members, tokens and the committed-refusal envelope from `lane-governed-a-report.md ## RPC boundary`, reviewed CLEAR in
`review-governed-a.md`). The two phase-1 review minors are closed. No SQL, contract, OpenAPI, Web, config or lockfile change;
no git add/commit; of the shared integration files only `cms-editorial-production-boundary-types.ts` changed (four operation
ids added to the rate-input union). CMS-03C-09 is not a Worker route (still out of scope; a test pins that its path is 404).

### Design (one table, three route families)
- `governed-review-policy.ts` is the single per-operation table (path, quota, deadline, step-up, Worker gate, documented
  statuses, RPC, telemetry name, request pointers). `governed-review-registry.test.ts` pins every field to the frozen
  `platformRegistrySet` row, so a registry change fails a test.
- Commands 07/08 (`governed-review-command-routes.ts`) follow the BE00 order already used by 06 and put header validation
  before capability, MFA and quota (the phase-1 ruling, BE03c 408/1502): origin, media, size, CSRF, body bytes, session, no
  query, path UUID (400), strict body (422), path/body review agreement (422 at `/reviewId`), exact Idempotency-Key and strong
  If-Match equal to `expectedVersion` (400), coarse gate, recent MFA (401 `STEP_UP_REQUIRED`), user then party quota, port.
- Reads 10/11 (`governed-review-read-routes.ts`) follow the 03b read order: origin, request media (415 with an empty
  allowlist), session, no key/If-Match/body (400), strict path and query, quota, port. No CSRF.
- Success is bound to the request in `governed-review-validate.ts` (see table), in both the route and the production adapter.
- Production: `cms-composition-production-governed-review-ports.ts` (five RPC ports; each re-parses against the frozen
  transport schema and sends exactly the `p_request` members the SQL exact-key check accepts), `...-rpc.ts` (transport,
  per-operation deadline `min(configured, 15,000/8,000)`, no retry, the gate and MFA re-proven on the refreshed session),
  `...-errors.ts` (token mapping and the committed refusal envelope), `cms-composition-production-governed-review.ts` (wiring).

### Files (path under apps/worker/src/, lines, SHA-256)
New:
| path | lines | sha256 |
|---|--:|---|
| cms-composition/governed-review-policy.ts | 144 | 7cb40f86ac5ef6ec6dd7336b7691d4923341d0bf273bcedc0b92b4a98374cce1 |
| cms-composition/governed-review-validate.ts | 119 | ea6464b7a8d7cefc8ae2384d9712bcae2b6e6a9cf43a464450fef08e6cbc956b |
| cms-composition/governed-review-http.ts | 20 | 215f022305b6a6672ca5a6779ae94b436968f28dca303a600fa349a60bb9cbd3 |
| cms-composition/governed-review-errors.ts | 185 | a837ba960728e93d7c0e260d397a295e46e2a34f7840f707eaebdc9a2cbfdc02 |
| cms-composition/governed-review-command-routes.ts | 274 | ca1d3925bb7386a768534347c1881ed5fd761e14d52aa2c5c0aafbda7b3dbcd4 |
| cms-composition/governed-review-read-routes.ts | 251 | ca8683d2eda0deb5a3f1825796fbe9d2b60be522c82ecb1bfb6f1a6f51719663 |
| cms-composition-production-governed-review-ports.ts | 150 | 2656858dc33d5071231653f955af4ab7f939af2f88b4fa6ea554cd9adc9c000d |
| cms-composition-production-governed-review-errors.ts | 124 | 4da6dd833a898c0ff75aa7f6e9068dbcb931320c6c1810bb1db9291770227f31 |
| cms-composition/governed-review-ops.test-support.ts | 296 | 1d39590bb6152057a8546ad6364d76ad748274de6f126d8728ab30aa254f6ee0 |
| cms-composition/governed-review-ops-table.test-support.ts | 134 | 7124a2577daa08b2e820f45334f36e4cdd3e2925a97b630e2ebc394cec8f60e4 |
| cms-composition/governed-review-ops-tokens.test-support.ts | 274 | f4b1171d41d0e1f6bb111a029877368b1071e7badb102d7ef4f10a44d843e851 |
| cms-composition/governed-review-decision.test.ts | 196 | b3fb3997ba0ce9082a5dce3b0112697fd4713c06ab9da0a17e521ff71ea175bd |
| cms-composition/governed-review-decision-input.test.ts | 152 | 9b99f47efefc79b4b09d924cf172f2312fd6db2b5dbb8c5083f72bd058e21c55 |
| cms-composition/governed-review-decision-admission.test.ts | 204 | 723a2f843eff803faa97a637678a6b48184cd92ec983524478ed6af29a456b3a |
| cms-composition/governed-review-assignment.test.ts | 159 | cb07d6f01a4c8f717d8d20622806e9d39b437059404b31827cd1eb2747eed738 |
| cms-composition/governed-review-assignment-input.test.ts | 137 | 673949bc63fb70f91eebb92e9fc30c45d6665c9a35595578591337e7133ebb26 |
| cms-composition/governed-review-reads.test.ts | 256 | 0da0adb4d57d9028f1f773d0b9670808bbb6e508f43c01be6bb7f39bee8e3912 |
| cms-composition/governed-review-registry.test.ts | 79 | 6177e306275fedfce6eef71e88dae7184d90ba7484d506d7ccd7ec8ed67a878a |
| cms-composition/governed-review-ops-provider.test.ts | 282 | 5cfc64e390ed43f7700a74ed3d204a24fec4d217c9fca456235b74e02865cdf3 |
| cms-composition/governed-review-ops-refusals.test.ts | 60 | 2639d9bb4fa383a69ebb67d4ad30374bf3fe34306edba09ce7d521fe4ae397aa |
| cms-composition/governed-review-ops-telemetry.test.ts | 81 | a0565d66531e622b6e5ddcc094c4e28e2d4bb4ad8226f7d87a00a1dd0115aea3 |
| cms-composition/governed-review-ops-admission.test.ts | 78 | 58a9ff81845f67cfd4a29e0d822330372844814c37d6930c7f04387dd552eabe |
Changed (phase-1 files and shared):
| path | lines | sha256 | change |
|---|--:|---|---|
| cms-composition/governed-review-ports.ts | 287 | ccb5babade859fd10faa542d098f1a19491a1c566b82c8ba2128904219a6f4c7 | operation union from the policy, five ports, `governedGate`/`governedQuota`/`governedAdmission`, `stepUpRequired`; `validGovernedSubmission` moved to `-validate.ts` |
| cms-composition/governed-review-response.ts | 120 | 3ab34ee269fa130333d2260477abbe7191ae77ae3a88bc7e5e65f694b40d40ce | `governedSuccess` takes status/ETag/Location, deadline from the policy; headers and error projection split out |
| cms-composition/governed-review-routes.ts | 152 | 4fc98a710eec92ebc7996e627678b5cd66d899f40bcd818cb3581c66c4fbbe2c | submit unchanged in behaviour; composes the command and read registrars |
| cms-composition-production-governed-review.ts | 139 | 1d2080fc00ecf9f135d4dbff4e7667997501d5ea196c1e99232073efc03a050c | spreads `createGovernedPorts`, per-operation refresh gate and telemetry name |
| cms-composition-production-governed-review-rpc.ts | 126 | 663c66c2bdd20375c16b5dadd4bc174aa3db6ee8b6ec7b47034a07b86f36af6d | operation-generic transport; error mapping moved to `-errors.ts` |
| cms-composition/provider-fault-guard.ts | 32 | a2c53f25fe092854815475693c65d544f4e7d8b5fa7cb63553222fd8813b2cf4 | review minor 1 |
| cms-editorial-production-boundary-types.ts | 97 | da7ec6348873a436960da07d672c08e08ea262058f77ef05da5f663a85f976b2 | `CMS-03C-07/-08/-10/-11` in the rate operation-id union (only shared-file edit) |
| cms-composition/README.md | 101 | 317f665c9e771e0733a2934d7508fc250d1680f429af320542e0d17503727978 | governed-review file map and extension steps |
| cms-composition/governed-review-submit.test-support.ts | 286 | 8f2804f252dff01e51cc6172b410167d660f54a02a36b3d53285db81b58f4ef5 | harness option `stepUpAt` |
| cms-composition/governed-review-provider-fault.test.ts | 138 | e6fe0330b0cac60fc125392619f2c46fe6e564fa517cda7491f70f18be4d2889 | review minor 1 case |
| cms-composition/pattern-definition-provider-fault.test.ts | 84 | ad67831d4a8d9a092698578634f9a6cd84e3e31fcc68ed946be9cba3a6327405 | review minors 1 and 2 |
| cms-composition/taxonomy-definition-provider-fault.test.ts | 78 | 03ddd862dd6d1574a5547d95564acf96fd17f5adf31c82ec21483c0aa33b70af | review minor 1 case |
`worker-route-composition.ts`, `production-worker-runtime-cms.ts`, `production-worker-runtime.ts`, `worker-types.ts` and
`cms-editorial-production-types.ts` were not touched in phase 2 (registration and wiring flow through the existing
`registerCmsGovernedReviewRoutes` and the production factory). No file exceeds 300 lines (largest 296).

### Runs (`pnpm exec vitest run` from the worktree root under `flock -s /tmp/wejammin-quiet.lock`, pinned PATH)
| time (UTC) | what | result |
|---|---|---|
| 11:33 | baseline before edits, governed-review suites | 9 files, 244/244 |
| ~11:40 | RED minor 1: 40001 engine case in the three fault suites | 5 fail "expected 409 to be 500" (genuine defect); GREEN after the guard change, 20 pattern/taxonomy/governed files 619/619 |
| 11:45 | first run of the new suites after implementation | 575/578; 3 failures were my test defects (a spaced Idempotency-Key is valid per `IdempotencyKeySchema`; CMS-03C-11 does not document 404/403 so NOT_FOUND and the origin refusal were tested wrongly): tests corrected, plus the middleware-403 rule below |
| ~11:55 | RED reproduction: the two registrars (`registerGovernedCommandRoutes`, `registerGovernedReadRoutes`) commented out, new suites only | 8 files, 316 failed / 17 passed of 333 (feature absent; a reproduction after the fact, the first run above was already past the module-absent state); sources restored, `cmp` identical |
| mutation | 18 single-line mutants of the new code (step-up gate, committed refusal, version +1 binding, declared-status check, Location, reviewer gate, If-Match operand, read deadline, middleware 403, party-null skip, refresh re-proof, refusal replay, pointer allowlist, duplicate query key, assignment reason binding, assignedEnd-scope binding, envelope key check, 40001 token check, ...) | each killed by 1-18 tests; sources restored byte-identical (`cmp`) |
| 16:01:04 | final bytes, governed-review (22 files incl. pattern/taxonomy fault suites) | 22 files, 633/633 |
| 16:01 | final bytes, joint set (the 11 files of `lane-native-worker-integration-report.md:67`) | 11 files, 345/345 (unchanged count) |
| 16:01-16:06 | final bytes, full `apps/worker` excluding the two files named below | 606 files, 10,301/10,301 |
| ~15:50 | earlier full `apps/worker` (all files) | 608 files, 10,337 tests: 10,334 passed, 3 failed, all outside my claim (next paragraph) |
| final | `pnpm --filter @wejammin/worker type-check` (tsc --noEmit) 0; `eslint --max-warnings=0` on 41 touched .ts files 0; `prettier --check` clean on the same files and the README; `git diff --check` 0; no `any`, TODO, skip or only in new code |

The 3 failures are `async-runtime-outbox-poison.test.ts` (2) and `async-runtime-review-recheck-claim.test.ts` (1). Neither
imports any file I changed; the second asserts `AGGREGATE_FOR['cms.localization.changed.v1']`, and another lane has an
uncommitted edit of `cms-editorial/review-recheck/review-recheck.test-support.ts`
(`cms_content_entry` -> `cms_locale_variant`) and `packages/contracts/src/cms-editorial/review-recheck.ts` in the same
worktree. Root should re-run these two files after that lane's change is reconciled.

### Status / code mapping (catalog `cms.03c.governed-review.v1`; details after projection)
Shared by 07/08/10/11 (as phase 1 for 06): foreign Origin 403 `GOVERNED_REVIEW_FORBIDDEN` `{}` before the session (published on
every row, declared or not, BE00 middleware rule, so also on 11); non-JSON media on a command 415 with
`{allowedMediaTypes:['application/json']}`, any request media on a read 415 with `{allowedMediaTypes:[]}`; bad CSRF 403; malformed
JSON, >256 KiB, query on a command, non-UUID path, bad or missing Idempotency-Key or If-Match, If-Match not equal to
`expectedVersion`, Idempotency-Key or If-Match on a read 400 `INVALID_REQUEST`; no session 401 `UNAUTHENTICATED`
`{recoveryAction:'reauthenticate'}`; denied quota 429 `RATE_LIMITED` with retry-after and `ratelimit-limit/-remaining/-reset`;
provider 500/502/503/504 (any payload) 503 `DEPENDENCY_UNAVAILABLE` retryable, retry-after 15; malformed/oversize/non-JSON
provider body, success failing the strict schema or its request binding 502 non-retryable; deadline (15,000 ms commands,
8,000 ms reads) 504 retry-after 15; provider 4xx without a product token, INTERNAL_ERROR, any token outside the operation's
`CMS_SLICE_12_OPERATION_REASONS` list, and any status the operation does not document (OpenAPI) 500 `INTERNAL_ERROR` `{}`.

| op | source | HTTP | code | details |
|---|---|---|---|---|
| 07 | success | 200 | `GovernedReviewResource` | ETag `"<review.version>"`; id = path, version = expected+1, state open/approved for approve and rejected for reject, >=1 recorded decision |
| 07 | no `cms.reviewer` capability | 403 | GOVERNED_REVIEW_FORBIDDEN | `{reasonCode:'capability_missing'}` before MFA and quota |
| 07 | no/stale MFA (SQL token too) | 401 | STEP_UP_REQUIRED | `{recoveryAction:'step_up', allowedMethods:['totp']}`; before quota, reservation and RPC; re-proven on the refreshed session |
| 07 | body unknown key (`capability`, `stepUpAt`, ...), bad member | 422 | GOVERNED_REVIEW_VALIDATION_FAILED | violation at `/decision` `/reason` `/expectedVersion` `/reviewId`, else `/`; attacker names never echoed |
| 07 | path/body reviewId differ | 422 | same | `/reviewId` |
| 07 | SQL `NOT_FOUND` | 404 | GOVERNED_REVIEW_NOT_FOUND | `{}` |
| 07 | SQL `capability_missing`, `separation_of_duties` | 403 | FORBIDDEN | `{reasonCode}` |
| 07 | SQL `review_not_open`, `duplicate_decision`, `specialist_slot_unsatisfiable`, `dependency_changed` | 409 | VERSION_CONFLICT | `{reasonCode}` |
| 07 | committed envelope `{kind:'refusal', reasonCode: dependency_changed or review_not_open, details}` (HTTP 200, also on replay) | 409 | VERSION_CONFLICT | `{reasonCode}`; any other shape (unknown/403 token, extra member, non-object details) 502 |
| 07 | `VERSION_MISMATCH`, `IDEMPOTENCY_MISMATCH`, `CONFLICT` | 409 | VERSION_CONFLICT | `{}` (no `currentVersion`, no reason) |
| 07 | SQL `VALIDATION_FAILED` + pointer DETAIL, `INVALID_REQUEST` | 422 / 400 | VALIDATION_FAILED / INVALID_REQUEST | pointer if in the allowlist, else `/` |
| 08 | success create / revoke | 201 / 200 | `GovernedReviewAssignmentResource` | ETag `"<assignment.version>"`; Location `/api/v1/cms/governed-reviews/{reviewId}/assignments/{assignmentId}` on create only; create: state active, expiry equal to the request within 1 ms, reason equal; revoke: that assignment, state revoked |
| 08 | no/stale MFA (unconditional, SQL token too) | 401 | STEP_UP_REQUIRED | as 07; no Worker capability gate (owner is receipt-derived) |
| 08 | body bad (unknown action/member, create with `assignmentId`, revoke with `reviewerPersonId`, 257-code-point or non-NFC reason, bad instant) | 422 | VALIDATION_FAILED | `/action` `/expectedVersion` `/reviewerPersonId` `/expiresAt` `/assignmentId` `/reason` |
| 08 | SQL `NOT_FOUND` / `capability_missing` | 404 / 403 | NOT_FOUND / FORBIDDEN | `{}` / `{reasonCode}` |
| 08 | SQL `reviewer_not_eligible`, `assignment_exists`, `assignment_limit`, `review_not_open` | 409 | VERSION_CONFLICT | `{reasonCode}` |
| 08 | SQL `expiry_out_of_bounds` DETAIL `["/expiresAt"]` | 422 | VALIDATION_FAILED | `{reasonCode:'expiry_out_of_bounds', violations:[{path:'/expiresAt',...}]}` (no pointer: reasonCode only) |
| 08 | re-revoke bare `CONFLICT` (F-3), `VERSION_MISMATCH`, `IDEMPOTENCY_MISMATCH` | 409 | VERSION_CONFLICT | `{}` (BOUNDARY 1) |
| 10 | success | 200 | `GovernedReviewDetailResource` | ETag `"<review.version>"`, no-store; id = path |
| 10 | SQL `NOT_FOUND` (hidden, absent, cross-owner) | 404 | NOT_FOUND | `{}` |
| 10 | SQL `capability_missing` (visible, no read scope) | 403 | FORBIDDEN | `{reasonCode:'capability_missing'}` |
| 10 | SQL `CONFLICT`, `VALIDATION_FAILED`, `STEP_UP_REQUIRED`, foreign tokens | 500 | INTERNAL_ERROR | not documented for 10 (OpenAPI: 400 401 403 404 415 429 5xx) |
| 11 | success | 200 | `GovernedReviewQueuePage` | ETag `"<pageVersion>"`; at most `limit` unique rows, only the asked state/subjectKind, `assignmentEndsAt` only for scope assigned, non-empty `nextCursor` |
| 11 | unknown/duplicate key, empty or >512 cursor, non-integer/signed limit, SQL `INVALID_REQUEST` | 400 | INVALID_REQUEST | `{}` |
| 11 | limit 0 or >50, bad scope/state/subjectKind, SQL `VALIDATION_FAILED` | 422 | VALIDATION_FAILED | violation at `/limit` `/scope` `/state` `/subjectKind` |
| 11 | SQL `CONFLICT` (expired, tampered, foreign cursor) | 409 | VERSION_CONFLICT | `{}` (DEC-140: no reason token) |
| 11 | SQL `NOT_FOUND`, `capability_missing` | 500 | INTERNAL_ERROR | not documented for 11 (OpenAPI: 400 401 409 415 422 429 5xx) |

### Spec citations
BE03c rows 169-173; invariants 192-221 (review `version` CAS, assignment does not advance it, unconditional MFA before any
reservation, 10/11 protected no-store GETs); contract and error matrix 1250-1272 and catalog 1273-1305 (401 `STEP_UP_REQUIRED`
with `{recoveryAction:'step_up', allowedMethods}`, every governed 409 `GOVERNED_REVIEW_VERSION_CONFLICT` with one closed
reason, unmapped status or foreign message -> 500 at 1298-1302); field matrix 390-394; data flow 1496-1503 (parse ->
authenticate -> capability); testing 1611-1625; registry rows `platform-registries.ts` 1957-2078 and the generated OpenAPI
status sets (`tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts`); governed-a `## RPC boundary`; 03b precedents
`workflow-command.ts`, `workflow-read.ts`, `workflow-admission.ts` (MFA, middleware 403, rpc_scope), `committedRefusal` in
`cms-editorial-production-workflow.ts`.

### Test corrections
None to an existing oracle. Additions only: one engine `40001` row in each of `governed-review-provider-fault.test.ts`,
`pattern-definition-provider-fault.test.ts`, `taxonomy-definition-provider-fault.test.ts`; in the pattern suite the product-token
control now asserts `COMPOSITION_NOT_FOUND` and gained a `P0001 NOT_FOUND` row (review minor 2); the submit harness gained an
optional `stepUpAt`.

### Decisions (implementation level, stated so root can override)
1. No Worker capability gate on 08, 10, 11 (03b `rpc_scope` precedent): `cms.definition_review.assign` is receipt-derived and never a
   session capability, and an any_of gate on 10 would turn the hidden-review 404 into a 403 for the receipt-derived owner. 07 keeps
   the registry gate (`cms.reviewer`, 03b `gate: 'capability'`).
2. A missing acting party is not a Worker refusal on 07/08/10/11: the party quota is skipped and the database answers (06 keeps its
   owner-party 403 from phase 1).
3. CMS-03C-11 splits 400 (malformed: unknown/duplicate key, cursor shape, limit syntax) from 422 (in-grammar but out of bounds: limit 0
   or >50, closed enums), the BE03c matrix columns "malformed query/cursor" vs "query bounds"; SQL `VALIDATION_FAILED` pointers map to the
   same 422.
4. Undocumented statuses collapse to the scrubbed 500 per operation (OpenAPI sets), the generalisation of BE03c 1298-1302.
5. `VERSION_MISMATCH` drops `expectedVersion`/`currentVersion` (no governed contract member carries them; 409 details are the
   reason token only).

### Open items / BOUNDARY
1. BOUNDARY (F-3, inherited spec gap): re-revoking an already revoked assignment raises a bare `CONFLICT` with no closed reason in
   `CMS_SLICE_12_OPERATION_REASONS['CMS-03C-08']` and BE03c 1304 requires one reason per governed 409. The Worker answers the contract's
   generic 409 `GOVERNED_REVIEW_VERSION_CONFLICT` `{}` (tested). A spec decision (new token or an explicit reason-less 409 for this case,
   as DEC-140 allows for cursors) would let the Worker publish a reason; no Worker change needed beyond reading the contract list.
2. F-2 handled as the review said: unknown body key is 422 from the Worker's strict schema; SQL `INVALID_REQUEST` (400) is reachable only
   if the Worker forwarded an unknown key, which it cannot.
3. Carried from phase 1 (root-owned, unchanged): `pattern_version_not_active` for CMS-03C-06 outside the contract list; SQL
   `canonical_source_unavailable` DETAIL domain; spec 389 `/subjectHash` 422 vs SQL 409.
4. Not proven here (no race module, no DB): the lock order and idempotent same-key serialization are SQL's. Subject kinds other than
   `template_version` were not exercised end to end by governed-a (its own limit 1); the Worker is kind-agnostic.
5. Replay is observed only as an identical body/status; the `x-cms-idempotent-replay` GUC header is not exposed to the browser (as in
   03b and phase 1).
6. Contracts `GovernedReviewDetailResource` makes `assignments` `.default([])`: a missing member parses as `[]`, so the Worker cannot
   tell a SQL omission from an empty list; harmless for redaction (the strict parse still rejects any extra member).

### Requests to root
1. Reconcile the other lane's `review-recheck` edits and re-run `async-runtime-outbox-poison.test.ts` and
   `async-runtime-review-recheck-claim.test.ts` (3 failures not caused by this lane).
2. Record BOUNDARY 1 (re-revoke token) in the spec or accept the reason-less 409.
3. Independent review of phase 2, then a canonical gate; the changes are Worker-only (no `db:types` or OpenAPI regeneration needed).
4. Decide whether to move `carriesProductToken` into the shared `mapCmsEditorialRpcFailure` (phase-1 request, still open).

## Phase 3
Checkpoint 1 (2026-10-14, HEAD `b16edb54`): read lane rules, p3 brief, my phase 1-2 report, governed-b `## RPC boundary` (+ fix passes 1-2) and the hardening
report. Baseline before edits: governed-review suites 20 files, 608/608. Plan: (1) CMS-03C-09 as a third row family in the policy table
(`governed-activation-*`, reusing the command registrar with a `prepare` hook for the Time authority), production port + committed-refusal widening;
(2) CMS-03C-19 sweep `cms-composition/governed-activation-sweep*.ts`, wired as one more `Promise.allSettled` participant in `index.ts` (mirrors
`cms-publication-schedule-sweep`). Status: IN PROGRESS.

Checkpoint 2 (2026-10-14 21:40, resumed after predecessor was killed by the usage limit): predecessor left the CMS-03C-09 RED suites
(`cms-composition/governed-activation{,-admission,-time,-refusals}.test.ts`, `governed-activation{,-tokens}.test-support.ts`) and extended
`governed-review-{registry,ops-table,ops-refusals,ops-telemetry}`, plus `GovernedActivationInput` in `governed-review-inputs.ts`/`-ports.ts`.
No production code for 09 existed (policy/ports/routes/adapters unchanged). Resuming: confirm RED, then implement 09, then the sweep.

Checkpoint 3 (21:37): CMS-03C-09 route GREEN: governed-* 24 files 829/829 (the predecessor's 141 new activation cases + extended
registry/ops-table/refusals/telemetry). New: `governed-activation-routes.ts`, `governed-activation-time-details.ts`; changed: policy row 09,
`activateReview` port + `timeAuthority?` dependency, `validGovernedActivation`, `registerGovernedCommand` (+`prepare` hook), time-token and
committed-refusal mapping (`COMMITTED_ONLY`: 09 answers a committed `review_not_open`, absent from the frozen contract list, flagged for root),
production port + rate-input union `CMS-03C-09`. Test fixes in my own predecessor suite: `scheduleHarness` re-dates the session fixture
(it expired 2026-09-26), repeated-local-time case replies with the verified instant. Next: CMS-03C-19 sweep.

Checkpoint 4 (21:45): CMS-03C-19 sweep GREEN focused. New: `cms-governed-activation-rpc-names.ts`, `-rpc.ts`, `-sweep.ts`, `cms-schedule-sweep-support.ts`
(shared log helpers, used by the new sweep only), tests `cms-governed-activation-{rpc,sweep,sweep-deadline,sweep-wiring,import-graph}.test.ts`
+ `cms-governed-activation-sweep.test-support.ts`. Registration touched: `index.ts` (one more `Promise.allSettled` participant, surfaced after
the publication sweep and before the alerts), `async-runtime-rpc-types.ts` (union member). Existing tests updated for the new participant (not
weakened): `scheduled-manual-review-retry.test.ts`, `cms-publication-schedule-sweep-wiring.test.ts` (mock the new sweep like its siblings),
`index-scheduled.test.ts`, `production-idempotency-expiry-sweep.test.ts` (stub the governed claim; call counts 6->7, 7->8). 8 mutants killed.
Remaining: tsc/eslint/prettier, joint 345, full Worker suite, final report.

### Phase 3 final (2026-10-14 21:55, HEAD `b16edb54`): GREEN
CMS-03C-09 (activate 200, schedule 202, retire forwarded) and the CMS-03C-19 `scheduled` sweep are implemented test-first over the promoted SQL
(`20261014070000`-`070610`, governed-b `## RPC boundary` incl. fix passes 1-2). Worker-only: no SQL, contract, OpenAPI, Web, config, lockfile,
`database.types.ts` change; no git add/commit.

#### CMS-03C-09 design
One more row (`CMS-03C-09`) in `governed-review-policy.ts` (path `.../{reviewId}/activation`, class `cms-governed-activation` 20/min user, 40/min
party, 15,000 ms, recent MFA unconditional, strong If-Match, any-of `cms.template_designer`|`cms.taxonomy_curator`, no party requirement, RPC
`cms_activate_governed_subject`, telemetry `cms.composition.governed_review.activate`), pinned to the frozen registry row 2023 by
`governed-review-registry.test.ts` (method, path, quota, deadline, step-up, capabilities, OpenAPI statuses, request-schema pointers incl. the five
`activateAt/*` members). It rides the existing command registrar (`registerGovernedCommand`, now exported) with one new optional `prepare` hook that
runs after the gate and both quotas and before the port. The order is: origin/media/size/CSRF, bytes, session, no query, path UUID (400), strict
body (422), exact Idempotency-Key + strong If-Match equal to `expectedVersion` (400), capability gate (403), recent MFA (401 before quota and
reservation, for all three actions incl. `retire`), user then party quota, **Time authority for `schedule` only** (503 when the pinned snapshot yields
none, else the 03b refusal as 422 with the pointer prefixed `/activateAt`), port. Success is bound in `validGovernedActivation` (route and production
adapter): same review, same action, `activate`/`retire` review version = expected + 1, `schedule` review version = expected (unchanged) and
`scheduledForUtc` within 1 ms of the verified `activateAt.resolvedUtc`; ETag = `reviewVersion`; Location = the review; 200 (activate/retire), 202 (schedule).
`retire` goes through the identical path: the SQL holds it (`VALIDATION_FAILED ["/action"]`) and the Worker publishes exactly that 422 at `/action`; a
retirement the database one day accepts is published as 200 (no special case; tests pin both).

| source | HTTP | code | details |
|---|---|---|---|
| success activate / retire | 200 | `GovernedActivationResource` | ETag `"<reviewVersion>"`, Location `/api/v1/cms/governed-reviews/{reviewId}`, no-store |
| success schedule | 202 | `GovernedActivationResource` | ETag unchanged review version, same Location, no event |
| no/stale MFA (Worker or SQL `STEP_UP_REQUIRED`) | 401 | STEP_UP_REQUIRED | `{recoveryAction:'step_up', allowedMethods:['totp']}` |
| no owner capability (Worker or SQL `capability_missing`) | 403 | GOVERNED_REVIEW_FORBIDDEN | `{reasonCode:'capability_missing'}` |
| SQL `NOT_FOUND` | 404 | GOVERNED_REVIEW_NOT_FOUND | `{}` |
| `subject_not_activatable`, `subject_not_retirable`, `schedule_exists`, `activation_conflict`, raised `dependency_changed` | 409 | GOVERNED_REVIEW_VERSION_CONFLICT | `{reasonCode}` |
| committed envelope `{kind:'refusal', reasonCode: dependency_changed \| review_not_open}` (HTTP 200, replayed) | 409 | same | `{reasonCode}`; any other shape 502 |
| `VERSION_MISMATCH` (P0001 + JSON DETAIL or engine 40001), `IDEMPOTENCY_MISMATCH`, bare `CONFLICT` | 409 | same | `{}` (no versions on the wire) |
| `canonical_source_unavailable` DETAIL `{"domain"}` | 422 | GOVERNED_REVIEW_VALIDATION_FAILED | `{reasonCode, domain}`; without a valid domain 502 |
| `tzdb_version_mismatch` `{pinnedVersion}`, `resolved_utc_mismatch` `{expectedUtc}`, `schedule_out_of_horizon` `{minUtc,maxUtc}`, `nonexistent/ambiguous_local_time` `{alternatives}` | 422 | same | typed members rebuilt against `CmsGovernedTimeRefusalDetailsSchema`, extra members dropped; the SQL form with a mandatory member missing is 502 |
| `authority_ends_before_schedule`, `unknown_timezone`, `disambiguation_not_applicable` | 422 | same | `{reasonCode}` |
| Worker Time authority refusal | 422 | same | typed members + `violations:[{path:'/activateAt/<member>', code: reasonCode, message}]`, before any RPC |
| body faults (unknown member/action, `activateAt` on activate/retire, schedule without it, `reason` on activate, bad member, non-NFC reason) | 422 | same | one violation at the contract pointer (`/action` `/expectedVersion` `/activateAt` `/activateAt/<member>` `/reason`), else `/` |
| bad/missing key or If-Match, If-Match != `expectedVersion`, query, non-UUID path, SQL `INVALID_REQUEST` | 400 | INVALID_REQUEST | `{}` |
| `DEPENDENCY_UNAVAILABLE` token (NULL policy evidence), provider 5xx | 503 | DEPENDENCY_UNAVAILABLE | `{dependencyClass:'cms_composition', retryable:true}`, retry-after 15 |
| malformed/oversized/unbound success, strict-schema failure | 502 | DEPENDENCY_UNAVAILABLE | same members |
| raised `review_not_open`, other operations' tokens (`reviewer_not_eligible`, `separation_of_duties`, ...), provider 4xx without a token | 500 | INTERNAL_ERROR | `{}` |

#### CMS-03C-19 design
`cms-governed-activation-sweep.ts` (`runProductionCmsGovernedActivationSweep`, one more `Promise.allSettled` participant in `index.ts`, surfaced after
the publication sweep and before the alerts): one 15,000 ms job deadline (`CMS_SCHEDULE_DEADLINE_MS`) shared by the claim and every execute, claim of
`CMS_SCHEDULE_CLAIM_BATCH_DEFAULT` (25, port accepts 1-100), each claim executed in order with `{scheduleId, expectedVersion: claim.expectedVersion
(the immutable REVIEW version), leaseId}` and **no** evidence member; no schedule is started after the deadline (logged with `unstarted`); a claim
failure asks the platform to retry the tick (`CMS governed activation sweep requested retry`; manual-review faults are recorded and rethrown, so the
handler's `noRetry` rule applies); an execution failure is logged and never retried (unknown outcome, the lease and the ladder decide).
`cms-governed-activation-rpc.ts` is the only door (strict `ClaimedGovernedActivation` list: distinct, at most the batch, strict members; strict
`GovernedActivationExecutionResult` for the executed schedule, closed block reasons); `cms-governed-activation-rpc-names.ts` holds the two names;
`cms-schedule-sweep-support.ts` holds the log helpers (hash, retry, manual review). Telemetry: `cms_governed_activation_sweep.{executed,execute_failed,
failed,manual_review_required,deadline_exceeded,completed}`; metrics `cms_governed_activation_total{action="execute",outcome,subject_kind}` (outcome
is the closed result enum or `error`), `cms_governed_schedule_blocked_total{reason}` (closed reason, blocked only), `cms_governed_activation_claim_batch_size`,
`cms_governed_activation_deviation_seconds`; schedule/lease/review/subject ids appear only as `sha256:` hashes; the secret never logs.

#### Files (path under apps/worker/src/, lines, SHA-256 at report time)
New (phase 3): all of the `governed-activation-*`, `cms-governed-activation-*`, `cms-schedule-sweep-support.ts` rows below. Changed: the remaining rows.
| path | lines | sha256 |
|---|--:|---|
| cms-composition/governed-activation-routes.ts | 104 | 90e1b6c142a62bb25e62508d9883bd822e1b230af6bd250c06740d76d177a965 |
| cms-composition/governed-activation-time-details.ts | 50 | 221c676e613960d99132f047e4c1f9e5c210a9dbad8735a1cd8137c07fb9a13c |
| cms-composition/governed-activation.test-support.ts | 194 | 0913b6e8ac607aa2faf6c10c737b80a7c72a416097b4f76b412b603b8acd0612 |
| cms-composition/governed-activation-tokens.test-support.ts | 236 | c640c1d375d7c51b7e6fefdbc42aebfb3ed1ee1bdb931f59dd90d655cf68bacc |
| cms-composition/governed-activation.test.ts | 259 | 51debabff683611bf4ef6dd25588d06537e9feeaa3d12903e0315b196799a998 |
| cms-composition/governed-activation-admission.test.ts | 138 | 552227a4b41ea4496b69cc24238d772bb09d09cf3be40b2a9231bad64e9e918f |
| cms-composition/governed-activation-gate.test.ts | 215 | 41c12f3aec67664a4a148e3b99a3bd7f0256cc94586b268f25e97d692210da94 |
| cms-composition/governed-activation-time.test.ts | 277 | a5277e46e780ba04fe3eb4f9706c5d0ec6ea6f591fb50f4287c0d3274828bcb1 |
| cms-composition/governed-activation-refusals.test.ts | 110 | 43adbbc60fbe8aff1ffb8e6835306287dc9ca0d862112fe307833e361dcc8775 |
| cms-governed-activation-rpc-names.ts | 13 | 653f08c99512cff1e3843fa64bece96cb5754ef2ebf07b01ca426538f356620d |
| cms-governed-activation-rpc.ts | 101 | cbf262fe4742f7f9f857e2d4f0e2a498806b47869c0d591b1748d11ed8999182 |
| cms-governed-activation-sweep.ts | 225 | f3dfefb6b5b2ebbbebb523fab2614c79c7489eb475d924575e18fb50e0dd9641 |
| cms-schedule-sweep-support.ts | 54 | c8323cd7b2645a330b6a3662340a3e01244f2cffa23c2c40625439b28cd022ba |
| cms-governed-activation-rpc.test.ts | 187 | 0dfd7b1323bee62ac20e3778d48a9d2702ea333c2dad511423054f3e1141def1 |
| cms-governed-activation-sweep.test.ts | 272 | 93199682c5ca4eaf147cbdb18e381f36253a5fccc5c228b16a651be0d35f57fd |
| cms-governed-activation-sweep.test-support.ts | 78 | 12e7bb0f14c5ddc3f6038f0bd545e02cbe1f40e12c341b94c1ef9c9c79066f0e |
| cms-governed-activation-sweep-deadline.test.ts | 194 | 9c3460d0dd7e0ba0d3d5f9c8a7111ce2eb20a3e003bb2aff2fb7ca6dfe838fcf |
| cms-governed-activation-sweep-wiring.test.ts | 167 | 9684c46247e2a068d3e79d1e8ddc1e3931eff886ce72a23d67c94f5b32b035cd |
| cms-governed-activation-import-graph.test.ts | 149 | 835dd17564d664ae7e722ff660c1511a5b0fbc785ebb8fd2901704617a9d677d |
| cms-composition/governed-review-policy.ts | 179 | 8b46d543ebdf04817602b4d825c24a5cfd5a1e1c7cce45e3303b2472fec3f646 |
| cms-composition/governed-review-ports.ts | 267 | 349afa6dc6aba55c3c1ef422de1785740fee56058c9443a02c5ca26d208123cf |
| cms-composition/governed-review-inputs.ts | 65 | 782bbc96cf05a0e2b938f79c7575277107317c33b6d5b06b2293e6f814c94f36 |
| cms-composition/governed-review-validate.ts | 149 | 6f40fc54c3e6f091076cdcf428e9edf48eba380457aefe56d14175f93a9d033d |
| cms-composition/governed-review-command-routes.ts | 267 | 3dbc39d895e05b00aa58a0c69f59aa05aa2ccb0006efca139c1f0d06ff1869f9 |
| cms-composition/governed-review-routes.ts | 131 | 2fa9f1a5bb10ddd92adf82d56a233a39147613edfad2b84669747a77bcce11d9 |
| cms-composition/governed-review-response.ts | 120 | ea58e58aab1e138555db16e74b5d222d290efaf440959c660907d1db5bc73be3 |
| cms-composition/governed-review-errors.ts | 209 | 2f520e7a30f274cdb658d39af81136927be2a987830a53dadfec9b9955f93a8b |
| cms-composition-production-governed-review-ports.ts | 181 | f7749c8be35327bb4481de12a45373c46d70437ff1d895cd408d4f778c3694a3 |
| cms-composition-production-governed-review-errors.ts | 142 | 5665847aa0de29749b66d66e7acc66c81e5eb2ea3c4c2bbe3c7ae44f7b1969a9 |
| cms-editorial-production-boundary-types.ts | 98 | 93522d2d49e0724589009ed6e9aa2e03b45c3e8fc3ab472e5aa0fa75b78e4c83 |
| async-runtime-rpc-types.ts | 85 | 1c1de13a884022228ea203704753501e6590fcbb7ef016093e2bf9c17801f6a5 |
| index.ts | 270 | 1518f424597b8195d39db05044360d2a90072d2b0f134bb441658350738701a7 |
| cms-composition/governed-review-ops-refusals.test.ts | 69 | e20647bf7ace6653ec635c8aa9b99d1edf3ceb79c479308e28729566d095b2e5 |
| cms-composition/governed-review-ops-tokens.test-support.ts | 300 | 330f9104dc67213e13d89c2b61043a86c4c76d33e33a65241fa2da8b078ced7a |
| scheduled-manual-review-retry.test.ts | 203 | 7a3c9affaa2f13482fd581243ef8260736c09c903ba18b08f527cfbbb8671dfc |
| cms-publication-schedule-sweep-wiring.test.ts | 133 | 2690468aab35b68e05dba78aad52814a71e86054d9536e40a7c6a2187f32982e |
| index-scheduled.test.ts | 235 | e2fb39862a1722dcf497c5a759020ce4be81659134afe7cea2c8c80328f78210 |
| production-idempotency-expiry-sweep.test.ts | 359 (pre-existing size) | c3bae0e2e1c5202879386c32016a73db19d8e86b431698a1cd371031435478af |
| cms-composition/README.md | 113 | 9ce3de575f190ed4857e626089265f1a91ac7c84f33287ed356922e4343e5797 |
| README.md | 125 | 03b45cd841564e2eb842434fff11773acc0c63c7faa144b47364e9fb7061ac65 |
Also (predecessor-created, unchanged by me except where above): `governed-review-registry.test.ts`, `governed-review-ops-table.test-support.ts`, `governed-review-ops-telemetry.test.ts`.
Scheduled-job registration files touched: `index.ts`, `async-runtime-rpc-types.ts` (plus the new `cms-governed-activation-rpc-names.ts`). Every new file is <= 300 lines.

#### Runs (`pnpm exec vitest run` from the worktree root under `flock -s /tmp/wejammin-quiet.lock`, pinned PATH)
| time | what | result |
|---|---|---|
| 21:34 | RED: predecessor's four activation suites against the unchanged production code | 4 files, 141 failed / 0 passed (404 on every call: route absent) |
| 21:36 | after the route: governed-* | 24 files, 829/829 (after fixing two test defects of the predecessor's suites: expired session fixture on the schedule clock; reply not equal to the verified instant) |
| 21:37 | RED: `cms-governed-activation-rpc.test.ts` | module absent; GREEN 29/29 after `-rpc-names/-rpc` |
| 21:41 | sweep suites (sweep, deadline, wiring, import graph, rpc) | all pass; the three existing tests that exercise the real handler failed first (new participant), updated, then GREEN |
| mutation | 9 single-edit mutants (execute operand `scheduleVersion`; time rules skipped; schedule version binding; +1 binding; 09 committed refusal; deadline break; error metric; surfacing of the sweep failure in `index.ts`; a route-layer import of the sweep) | each killed by 1-11 tests; sources restored byte-identical |
| 21:49 | joint 345 set (11 files of `lane-native-worker-integration-report.md:67`) | 11 files, 345/345 (unchanged count) |
| 21:49-21:54 | full `apps/worker` | 627 files, 10,851/10,851, 0 failed |
| 21:54 | `tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts`, `tests/worker-wrangler-config.test.ts`, `tests/contracts/phase-02-slice-08-production-capability-composition.test.ts` | 3 files, 35/35 |
| final | `pnpm --filter @wejammin/worker type-check` 0; `eslint --max-warnings=0` and `prettier --check` on the 64 touched/new .ts files 0; `git diff --check -- apps/worker` 0; no `any`, TODO, skip or only in new code | |

#### Test corrections (for independent review; each adds, none weakens)
1. `scheduled-manual-review-retry.test.ts`, `cms-publication-schedule-sweep-wiring.test.ts`: mock `./cms-governed-activation-sweep` like the other sweeps (the new participant would otherwise run for real with `env = {}`); both files also resolve it to `undefined` in `beforeEach`. Same pattern as the Slice 11 cascade comment already in them.
2. `index-scheduled.test.ts`: fetch count 6 -> 7 (and 7 -> 8) and the sorted RPC list gains `cms_claim_due_governed_activations`; the failing-alert case stubs that claim as `[]`. Cite: CMS-03C-19 is one more RPC per tick.
3. `production-idempotency-expiry-sweep.test.ts`: `operationalResponse` stubs the governed claim as `[]`.
4. My own predecessor's suites (not independently reviewed oracles): `scheduleHarness` re-dates the session fixture; the repeated-local-time case replies with the verified instant; the 09 token table imports the shared token helpers from `governed-review-ops-tokens.test-support.ts` (exported `raise`, `reason`, `violation`, `internal` and the three code constants) instead of redefining them; `governed-review-ops-refusals.test.ts` types `TABLES` as `typeof BASE_TABLES` (tsc); the admission suite is split into admission and gate files (300-line rule).

#### Decisions (implementation level, stated so root can override)
1. `review_not_open` as a committed refusal envelope of 09 is published (409 `{reasonCode:'review_not_open'}`) although the frozen `CMS_SLICE_12_OPERATION_REASONS['CMS-03C-09']` omits it: governed-b's RPC boundary says the envelope carries it (a counted approval lost its authority and the review was invalidated). A RAISED `review_not_open` on 09 stays a scrubbed 500. The allowance (`COMMITTED_ONLY` in `governed-review-errors.ts`) is the only place it lives.
2. No Worker capability beyond the registry any-of; no party requirement (the database answers), same as 07/08/10/11.
3. Metric names follow BE03c 1597 (`cms_governed_activation_total{subject_kind,action,outcome}`, `cms_governed_schedule_blocked_total{reason}`); `action` is `execute` for the sweep (the spec does not list a value for a scheduled run); the claim-batch-size and deviation gauges are new names mirroring 03b's `cms_schedule_*` (not in the spec; closed, label-free).
4. The sweep reuses the 03b constants (`CMS_SCHEDULE_DEADLINE_MS`, `CMS_SCHEDULE_CLAIM_BATCH_DEFAULT`) because BE03c 188 says "same claim, lease, retry ladder and idempotency as CMS-03B-20".
5. The sweep and its port live beside the 03b ones in `apps/worker/src/` (the 03b import-graph precedent and the `scheduled` registration) rather than under `cms-composition/` (the HTTP route layer, which an architecture test now pins away from them).
6. `cms-schedule-sweep-support.ts` holds the three log helpers the new sweep needs; the identical private copies inside `cms-publication-schedule-sweep.ts` were not touched (outside this lane's claim). Request to root below.

#### Open items / BOUNDARY
1. OPEN OWNER DECISION (retirement policy): `retire` is forwarded unchanged and the database refuses it (`VALIDATION_FAILED ["/action"]`, published 422 at `/action`). The Worker needs no change when the owner decides; the tests that pin the held refusal (`governed-activation.test.ts` "retire is forwarded unchanged", the `retire` table rows) change with the SQL.
2. Spec gap (Decision 1): `review_not_open` is absent from the CMS-03C-09 reason list (BE03c catalog / `CMS_SLICE_12_OPERATION_REASONS`) though the committed invalidation envelope carries it.
3. Review `version` on `schedule` acceptance and terminal block does not advance (governed-b finding 5, owner decision): the 202 ETag is the unchanged version; the Worker binds exactly that.
4. Not proven here (no DB, no race module): the lineage advisory lock, `activation_conflict` under contention, the claim `SKIP LOCKED`, lease expiry, the ladder, replay of the stored envelope (the Worker only proves identical bytes + key reach the RPC), and event emission. The RPC-name allow-list in the import-graph test excludes `packages/data-access/src/database.types.ts` so a later `pnpm db:types` run (root) cannot break it.
5. Subject kinds other than `template_version` were exercised only at the Worker boundary through the response binding (kind-agnostic).

#### Requests to root
1. Independent review of phase 3, then the canonical gate (Worker-only; no `db:types`/OpenAPI regeneration needed for this lane; `database.types.ts` will gain the governed RPCs when you regenerate).
2. Decide the retirement policy (open item 1) and whether to amend BE03c 09's reason list for `review_not_open` (open item 2).
3. After review, migrate `cms-publication-schedule-sweep.ts` to the shared `cms-schedule-sweep-support.ts` helpers (removes the duplicate private `sha256Hex`/`retrySweep`/`recordManualReview`); not done here (outside the claim).
4. Add the governed sweep to any operational runbook/alert inventory (`docs/runbooks/platform/cms-publication.md` names the 03b metrics; BE03c 1597 asks to alert on activation blocked > 15 m).
5. Memory-capture candidates (root decides): "a wiring test that mocks every sibling sweep must learn the new one; the real handler tests (index-scheduled, idempotency-expiry) count fetches"; "a session fixture with a fixed `expiresAt` breaks any harness that moves the clock; re-date it".
