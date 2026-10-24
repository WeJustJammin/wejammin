# Independent review — `claude_s12_governed_worker` phase 2 (CMS-03C-07/08/10/11 Worker transport)

Reviewer: independent, read-only, did not author the lane. Target: `lane-governed-worker-report.md` `## Phase 2`
(SHA `de4e32c031f035298a77ddde3e2da3617b561a4c1f6292e2f41b0c910fd44798`, verified), worktree HEAD `b16edb54`.
Brief item 5 (re-hashing) skipped as instructed. Paths below are under `apps/worker/src/` unless stated.

## Status
COMPLETE. No blocker, no major. Five minors (one latent transport defect, one over-claim, one mis-filed spec gap,
two test-quality items) and eight informational notes. The author's run claims re-verified.

## Runs (allowed set only, pinned PATH, `flock -s /tmp/wejammin-quiet.lock`, from the worktree root)
| what | result |
|---|---|
| `pnpm exec vitest run` on the 22 files (`cms-composition/governed-review-*.test.ts` ×20, `pattern-definition-provider-fault.test.ts`, `taxonomy-definition-provider-fault.test.ts`) | 22 files, 633/633 passed, 11.55 s (matches the report's 633/633) |
| `pnpm --filter @wejammin/worker type-check` (tsc --noEmit) | exit 0 |
Static: no `any`, `TODO`, `.skip`, `.only`, `ts-ignore` in the lane's files; largest file 296 lines (`governed-review-ops.test-support.ts`), production max 287 (`governed-review-ports.ts`).

## Spec conformance — route-registry clauses (BE03c rows 169-173, 215-216, 390-394, 1260-1263, 1270-1305, BE00 377-396)
| clause | implemented | tested |
|---|---|---|
| 07 POST path, CSRF, strict JSON (unknown `capability`/`stepUpAt` 422, BE03c 390), key + If-Match = review `version`, 30/60/min, 15,000 ms, no-store | `governed-review-policy.ts:88-101`; `governed-review-command-routes.ts:141-178` | `governed-review-decision-input.test.ts:15-151`; `governed-review-registry.test.ts:24-43`; `governed-review-ops-provider.test.ts:165-221` |
| 07/08 order: body 422 → path/body `/reviewId` 422 → key/If-Match 400 → gate 403 → recent MFA 401 `STEP_UP_REQUIRED` → user then party quota → RPC (BE00 steps 6→7→8; BE03c 216; 03b `workflow-command.ts:205-209`) | `command-routes.ts:150-178`; `governed-review-ports.ts:196-214,278-287` | `decision-admission.test.ts:23-63,118-157`; `assignment-input.test.ts:70-122`; `expectNoWork` on every pre-admission refusal |
| MFA re-proved on the refreshed session before the RPC (BE03c 216 "before any idempotency reservation") | `cms-composition-production-governed-review.ts:95-97`; `…-rpc.ts:58-59` | `decision-admission.test.ts:65-91` (resolver called twice, fetch never) |
| 07 success 200, ETag `"<review.version>"`, bound: id = path, `version` = expected+1, state per decision, ≥1 decision (BE03c 215: a decision advances the CAS) | `command-routes.ts:236-239`; `governed-review-validate.ts:47-63` | `governed-review-decision.test.ts:36-54,107-144` (stale/skipped version, other id, invalidated, wrong state → 502) |
| 07 committed `{kind:'refusal'}` → 409 `{reasonCode}`, only `dependency_changed`/`review_not_open`, else 502 | `…-production-governed-review-errors.ts:96-124` | `decision.test.ts:147-196` |
| 07 token map: NOT_FOUND 404 `{}`; `capability_missing`/`separation_of_duties` 403; the four 409 reasons; `VERSION_MISMATCH`/`IDEMPOTENCY_MISMATCH`/`CONFLICT` 409 `{}`; foreign tokens 500 | `…-errors.ts:38-93`; `governed-review-errors.ts:49-113` | `governed-review-ops-tokens.test-support.ts:41-125`; `ops-refusals.test.ts:7-60` |
| 08 POST, create 201 + `Location` / revoke 200, ETag `"<assignment.version>"`, no review-version change (BE03c 215), 10/20/min | `command-routes.ts:241-273`; `validate.ts:68-88`; `policy.ts:102-124` | `governed-review-assignment.test.ts:31-158`; `assignment-input.test.ts:18-136` |
| 08 token map incl. `expiry_out_of_bounds` 422 at `/expiresAt`, re-revoke bare `CONFLICT` 409 `{}` (F-3) | `…-errors.ts:66-72`; tokens table | `ops-tokens.test-support.ts:126-209` |
| 10 GET, no CSRF, 415 on any request media, 400 on key/If-Match/body/query/non-UUID, 300/600/min, 8,000 ms, ETag `"<review.version>"`, id bound | `governed-review-read-routes.ts:100-158,212-227`; `template-shared.ts:140-162` | `governed-review-reads.test.ts:31-117` |
| 10 404 hidden / 403 no read scope / undeclared statuses 500 | tokens table; `policy.ts:130` | `ops-tokens.test-support.ts:210-226` |
| 11 GET, allowlist `scope/state/subjectKind/cursor/limit`, 400 malformed vs 422 bounds (BE03c 1263), limit 1-50 default 25, scope default `assigned`, ETag `"<pageVersion>"`, page bound to the query | `read-routes.ts:164-198,228-250`; `validate.ts:99-119` | `reads.test.ts:121-255` |
| 11 409 cursor conflict `{}` (DEC-140), `DEPENDENCY_UNAVAILABLE` 503, undeclared 500 | tokens table; `policy.ts:138` | `ops-tokens.test-support.ts:227-273` |
| Reads carry no step-up: a SQL `STEP_UP_REQUIRED` on 10/11 → 500 | `governed-review-errors.ts:129-138` | `ops-tokens.test-support.ts:224` |
| Provider faults (PGRST*, raw SQLSTATE, engine 40001 prose) → 500; 5xx → 503 retry-after 15; malformed/oversize/non-JSON success → 502; deadline 504 | `provider-fault-guard.ts:23-32`; `…-rpc.ts:97-114` | `ops-provider.test.ts:60-193`; `*-provider-fault.test.ts` |
| Telemetry one scrubbed event; correlation forwarded | `…-governed-review.ts:121-137` | `ops-telemetry.test.ts` |
| Missing: a preflight on the shared queue path; a `P0001 VERSION_MISMATCH` + JSON DETAIL row | — | see findings 1 and 4 |

Wire contract re-checked against the promoted SQL: 07/08 `p_request` member sets equal the producers' exact-key arrays
(`20261014010200:67-68`, `010100:72-82`); 10/11 accept the Worker's top-level `correlationId` (`010300:36-37`,
`010400:54-58`). The only `kind:'refusal'` producers are `010200:149,213` (exactly the two tokens the Worker admits).
Every token 07 can raise (`INVALID_REQUEST`, `VALIDATION_FAILED`+pointer, `STEP_UP_REQUIRED`, `NOT_FOUND`,
`capability_missing`, `review_not_open`, `VERSION_MISMATCH`, `separation_of_duties`, `duplicate_decision`,
`specialist_slot_unsatisfiable`, `IDEMPOTENCY_MISMATCH`, `INTERNAL_ERROR`, wrapper `CONFLICT`, `DEPENDENCY_UNAVAILABLE`)
maps to a declared 07 status; 08 likewise plus `reviewer_not_eligible`/`assignment_exists`/`assignment_limit`/
`expiry_out_of_bounds`/re-revoke `CONFLICT`. Nothing the producers raise reaches the scrubbed 500 on 07/08.

## Findings (`file:line — severity — problem — why — fix`)
1. `cms-composition/governed-review-read-routes.ts:66-86` — **minor** — the CMS-03C-11 OPTIONS handler on
   `/api/v1/cms/governed-reviews` is dead: CMS-03C-06 registers OPTIONS on the same path first
   (`governed-review-routes.ts:50-73,150-151`), and Hono stops at the first handler that returns a Response.
   Empirical proof: `governed-review-headers.test.ts:91-97` passes with both registrars mounted and expects
   `access-control-allow-methods: POST, OPTIONS` on that path. Consequences: the queue preflight never advertises
   `GET` (harmless, GET is CORS-safelisted) nor `Authorization`; and the read OPTIONS origin refusal passes `failure(403)`
   without the `middleware` flag (`read-routes.ts:71-81` vs `governedErrorResponse` `governed-review-errors.ts:131-138`),
   which on 11 (403 undeclared, `policy.ts:138`) would be the scrubbed 500 if the handler were ever reached. Precedent for
   a shared path is one merged preflight (`cms-editorial/routes.ts:71`: `GET, POST, OPTIONS`). Fix: register one OPTIONS
   for the shared path with the method and header union, pass `middleware=true` for the origin refusal in read OPTIONS,
   and add a queue-path preflight test (the only preflight test for reads, `reads.test.ts:107-116`, uses the 10 path).
2. `cms-composition/governed-review-policy.ts:3-4` and report "pins every field" — **minor** — over-claim.
   `governed-review-registry.test.ts:24-43` pins method, path, quota, deadline, step-up, CSRF, idempotency, If-Match only.
   Not pinned: `capabilities` (08: registry `all_of ['cms.definition_review.assign']` vs policy `[]`, `policy.ts:112`;
   10: registry `any_of` of four vs policy `[]`), `declared` (vs the generated OpenAPI sets, 07/08 ALL at
   `tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts:63,88`, 10 at `:145`, 11 at `:178`) and `pointers`.
   The capability divergences are deliberate and precedent-backed (03b `rpc_scope` rows CMS-03B-15/16/17/18,
   `packages/contracts/src/cms-editorial/routes-review-publication.ts:223-289`), but the slice-12 registry rows carry no
   `gate` field, so nothing records them. Fix: pin `declared` to the OpenAPI sets, assert the intentional `capabilities`
   divergence explicitly (or root adds a `gate` marker to the 03c rows), and correct the comment and report wording.
3. `cms-composition/governed-review-errors.ts:78-113`, report "Decisions 5" — **minor** — the reason-less governed 409 is
   broader than BOUNDARY 1. Stale-CAS `VERSION_MISMATCH` (`20261014010200:132,161,254`, `010100:181`, raised `P0001` with a
   JSON DETAIL by `20261002202000:34`) and `IDEMPOTENCY_MISMATCH` answer `GOVERNED_REVIEW_VERSION_CONFLICT {}`: the
   projection drops BE00 166's `{conflict, recoveryAction, expectedVersion?, currentVersion?}`. BE03c 1304 requires one closed
   reason on every governed 409, 1260-1261 document "stale review" and "idempotency" with no token, 1270 permits "safe
   version/conflict metadata only when authorized", FE03 1116-1117 list "stale version" as its own outcome. This is the same
   inherited spec-gap class as F-3, filed as an implementation decision. No security impact (dropping is the safe direction).
   Fix: move it under `## Open items / BOUNDARY` for root (keep `{}` or carry BE00's `conflict` member); no code change now.
4. `cms-composition/governed-review-ops-tokens.test-support.ts:24-31` — **minor** — test realism: `VERSION_MISMATCH` is
   modelled as SQLSTATE `40001`, but every promoted producer raises it as `P0001` with the DETAIL
   `{"expectedVersion","currentVersion"}`. The P0001 path (`…-errors.ts:88-92` → `mapCmsEditorialRpcFailure` →
   `mappedDetails` structured members → projection) still ends at `{}`, but the production discriminator is unexercised.
   Fix: add `raise('VERSION_MISMATCH', '{"expectedVersion":"3","currentVersion":"99"}')` rows for 07 and 08 expecting
   409 `{}` and no `"99"` on the wire.
5. `cms-composition/governed-review-decision.test.ts:99-105,160-163`, `governed-review-assignment.test.ts:96-102` —
   **minor** — vacuous replay tests: the scripted RPC returns the same body on every call and the Worker owns no replay
   logic, so they cannot fail for any Worker behaviour (the report's open item 5 concedes this). Fix: drop them or assert
   something the Worker owns (identical `p_request` bytes and `X-Idempotency-Key` on the second call).

## Informational (no change requested)
- 07 Worker gate `cms.reviewer` (`policy.ts:96`; registry any_of; 03b CMS-03B-06 `gate:'capability'`
  `routes-review-publication.ts:93-106`): a session without `cms.reviewer` answers 403 even where BE03c 1467 says a hidden
  review is 404; the 403 is independent of the target, so no existence oracle. Consistent with registry and precedent.
- No Worker gate on 08/10/11 and party quota skipped without an acting party (`governed-review-ports.ts:229`): the
  producers decide (`010200:98-111`, `010100:138-149`, `010300:49-56`); BE03c rows give per-party limits and a session
  without a party has no bucket. Reasonable; BE03c 1467-1468 columns are met by the SQL.
- Undocumented statuses → scrubbed 500 (`governed-review-errors.ts:132-138`): the BE03c 1298-1302 generalisation; the
  declared sets equal the OpenAPI sets (checked, see finding 2).
- 400 on key/If-Match faults carries `{}` (`command-routes.ts:169-170`); the 03b precedent names `/expectedVersion`
  (`workflow-admission.ts:67-77`) and BE03c 1270 calls 400 details pointer violations. Same as phase 1 (06), reviewed CLEAR.
- 08 `Location` and ETag follow 03b `review-assignment-routes.ts:62-71`; the ETag is the assignment's own version and the
  review version is untouched, as BE03c 215 requires. "expected+1" is applied only to 07, where it is exact
  (`010200:249-255` updates `version + 1` under the CAS predicate checked at `:161`).
- Read order origin → media → session → headers → path/query → quota → port equals 03b `workflow-read.ts:159-184`.
- F-2 handled as ruled (strict zod 422 before any RPC; SQL `INVALID_REQUEST` mapped 400 but unreachable for unknown keys).
- Fix-review minors closed: `provider-fault-guard.ts:26-30` admits `40001` only with a `SERIALIZATION_TOKENS` message
  (engine prose row in all three fault suites); `pattern-definition-provider-fault.test.ts:58-73` asserts
  `COMPOSITION_NOT_FOUND` and gained the `P0001` control.

## Security
Ordering and concealment as above. No PII in errors or logs (`ops-telemetry.test.ts:50-80` scrubs key/user/party/review);
attacker member names never echoed (`safeViolations` allowlist, `decision-input.test.ts:15-28`); caller-supplied
actor/party/capability/step-up headers never forwarded (`ops-admission.test.ts:58-78`); request body ≤256 KiB before
authentication; response ≤256 KiB; no retry on commands; the RPC is `service_role`-only per the promoted wrappers.
Committed-refusal envelope accepted only with the exact key set and the two SQL-emitted tokens.

## TDD method
The author implemented first and reproduced RED afterwards (registrars disabled: 316/333 failing) plus 18 single-line
mutants. Reading the suites: oracles are exact (`toEqual` on status/code/details, `expectNoWork` on every pre-admission
refusal, 502 on every binding mismatch, 500 on every undeclared status or foreign token); the scripted boundary is the
PostgREST fetch and the session resolver, never the unit under test. The method deviates from RED-first, but the tests
are discriminating; the vacuous exceptions are finding 5, the realism gap finding 4.

## Requests to root
1. Decide finding 3 together with BOUNDARY 1 (one spec ruling for every reason-less governed 409).
2. Finding 1 is a one-registrar change plus a test; the rest are test/report edits. All inside the lane's files.

VERDICT: CLEAR
