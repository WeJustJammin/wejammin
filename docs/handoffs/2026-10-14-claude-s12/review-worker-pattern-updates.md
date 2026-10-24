# Review — lane `claude_s12_worker_pattern_updates` (Worker transport CMS-03C-13/14/15)

## Status
COMPLETE (2026-10-15 ~12:40Z). Independent, adversarial reviewer; read-only except this file. HEAD `b16edb54`.
Target report SHA-256 `8012b1df…e372f` verified. Template `briefs/review-template.md` followed.
Result: no blocker, no major. 51/54 targeted mutants killed; the 3 survivors are masked or defense-in-depth gaps (minor).

## Method and evidence (scratch only; worktree untouched except this report)
- Scratch tree `<scratchpad>/review-worker-pattern-updates/tree/`: a COPY of `apps/worker/src` (snapshot 11:54Z) plus
  root/worker configs; `packages/` and `node_modules` symlinked read-only (never mutated). Pristine copy in `pristine/`;
  the driver restored every mutant and ended `TREE RESTORED IDENTICAL` (tree == pristine).
- All runs under `flock -s /tmp/wejammin-quiet.lock`, pinned PATH. Catalogue `mutations.js` (SHA-256 fe6ec138…f751),
  results `mutation-results.jsonl` (SHA-256 4f983ac3…3562), driver `driver.js`, runner `run.sh`.
- Baseline on the copy: 18 files / 552 tests passed. Live worktree re-run at 12:04Z (after hardening-4 touched
  `capability-details.ts`, comment-only): 18 files / 552 passed, 0 failed.
- Worker `tsc --noEmit` on a second pristine copy (`tree2`): 0 errors under `apps/worker/src`; the 1,242 reported errors
  are all scratch-layout artefacts inside the symlinked `packages/` (TS5097 `.ts` import extension, TS2339 `globalThis.crypto`),
  not lane code. The author's in-worktree `tsc` exit 0 is therefore corroborated for the worker sources only.
- Author claims re-verified: 44/44 file line counts and SHA-256 match the report table; all lane code files last
  modified 11:37:27Z, before the full run (11:38:27Z); full-run receipt `worker-full.json` SHA-256 b085440b…f610 matches and
  reads 668 files, 11,887 tests, 11,887 passed, 0 failed, 0 pending. eslint/prettier/345-joint-set not re-run (outside my
  allowed execution); the full-run receipt includes the joint-set files.
- Splits lost nothing: against the author's pre-split copies (`admission.orig.ts`, `routes.orig.ts`, `rpc.orig.ts`) test
  titles 21→21, 18→18, 26→26 (identical sets) and `expect(` calls 62→62, 46→46, 37→37.
- Types split: `cms-editorial-production-types.ts` 23 exports at HEAD, 23 now; 79/80 removed lines moved verbatim to
  `cms-editorial-production-boundary-types.ts` (the 80th is the rate-input operation union, extended with 03C-06..17 ids).
- Shared wiring (`worker-route-composition.ts`, `production-worker-runtime{,-cms}.ts`, `worker-types.ts`): additions only,
  no removed export, constant or rate entry (diff read in full). Production files ≤289 lines; test files ≤366 (≤400 rule).
  No `any`, TODO, `.skip/.only`, ts-ignore in lane files.

## Non-vacuity (mutation results; each mutant run against all 18 lane test files)
| # | Clause | Mutant | Result (tests failed) |
|---|---|---|---|
| M01 | 262,144-byte body cap | cap ×2 | KILLED (3) |
| M02/03 | 13 unknown / duplicate query key 400 | filter removed | KILLED (3/3) |
| M04 | 15 non-empty query 400 | check disabled | KILLED (2) |
| M05 | 15 If-Match == body.expectedVersion | check disabled | KILLED (2) |
| M06 | 15 Idempotency-Key required | default key injected | KILLED (1) |
| M07/M54 | author/editor gate; no capability ⇒ no quota | designer admitted / gate removed | KILLED (3/14) |
| M08 | 404 concealment (NOT_FOUND) | → 403 | KILLED (12) |
| M09 | 403 relays only `capability_missing` | relay source | KILLED (8) |
| M10 | `revision_not_editable` 409 | → 422 | KILLED (2) |
| M11-13 | `pattern_incompatible` / `nested_pattern_not_active` / `pattern_version_not_active` 422 | each dropped | KILLED (1/2/2) |
| M14/M16 | foreign Slice 12 reason → scrubbed 500 (adapter / route) | admitted | KILLED (32/10) |
| M15 | 14 `diff_too_large` 422 reasonCode survives route | 422 untyped | KILLED (11) |
| M17-19 | provider 500 / 502 / 504 → 503 | class excluded | KILLED (3/5/3) |
| M20 | malformed answer → local 502 | → 503 | KILLED (6) |
| M21-27 | 15 binding: route re-check, ETag=v+1, row count, one revision, target pin, detached, row v+1 | each weakened | KILLED (7/8/1/1/3/1/3) |
| M28-31 | 13 binding: keyset order, ≤limit, cursor only on full page, no dup | each weakened | KILLED (1/3/2/2) |
| M32 | 14 binding: instance id | removed | KILLED (3) |
| M33/34/35 | 13 cursor ≤512; limit 422 `/limit`; default 25 sent | 513 / 400 / limit omitted | KILLED (2/7/2) |
| M36/37 | registry deadline 15,000; route deadline → 504 | 8,000 / ×4 | KILLED (2/3) |
| M38 | adapter narrows to registry deadline | `Math.min` removed | **SURVIVED** (masked, F3) |
| M39-41/53 | context re-proof: sessionId, capability, party; 403 before network | each removed | KILLED (1/1/1/2) |
| M42 | selector registered before `/patterns/:patternKey` | order swapped | KILLED (1) |
| M43 | per-operation response byte ceiling | ceiling = config max | KILLED (1) |
| M44 | user quota before party | order swapped | KILLED (6) |
| M45 | 409 relays only expected/current version | relay all members | **SURVIVED** (route strips, F2) |
| M46/M52 | 15 lock `CONFLICT` 409; 13 cursor `CONFLICT` 409 | → 503 / 400 | KILLED (2/2) |
| M47 | 15 422 pointer allowlist | any pointer | **SURVIVED** (F1) |
| M48 | 14 any query key 400 | ignored | KILLED (2) |
| M49 | adapter forwards If-Match | removed | KILLED (1) |
| M50 | GET refuses If-Match/key/body | check removed | KILLED (7) |
| M51 | 15 session-bound CSRF | removed | KILLED (2) |

## Spec conformance (BE03c rows 175-177, If-Match operands, validation 398-400, error matrix 1285-1287, typed refusals 1323, authority 1510-1512; BE00 172)
- 13: GET path + precedence `pattern-selector-routes.ts:13`, `worker-route-composition.ts:245-252` (M42); author|editor
  `pattern-update-ports.ts:148-155` + re-proof `…-rpc.ts:96-103` (M07/M40); strict query, cursor ≤512, limit 1-50 default 25
  `pattern-selector-query.ts` (M02/03/33/34/35); no key/If-Match/body `pattern-update-read.ts:76` (M50); keyset binding
  `pattern-update-answers.ts:26-50` (M28-31); ETag = pageVersion; 409 cursor `…-failure.ts:87` (M52); 300/600, 8,000 ms pinned
  by `pattern-update-registry.test.ts` against `platformRegistrySet` (M36 class).
- 14: UUID path, no query `pattern-update-diff-routes.ts:34-38` (M48); 404/403 via SQL tokens (M08/M09); strong ETag
  `"{instance.version}"`; `diff_too_large` 422 reasonCode only (M15); 512 KiB wire / 256 KiB compact ceiling (M43; the
  JSONB-spacing case has its own test). Answer binding to the asked instance (M32).
- 15: CSRF, strict JSON, key + strong If-Match == entry `expectedVersion` before authorization (M04-06, M51); per-instance
  CAS and 1-32 all-or-nothing are contract + SQL; typed tokens 409 `revision_not_editable`/`diff_has_collisions`, 422 the three
  pattern tokens (M10-13); 60/120, 15,000 ms (M36); response binding (M21-27); provider 5xx → 503, malformed → 502, deadline → 504.
- Integration cross-check by reading the WIP SQL (no live PostgREST possible): Worker `p_request` keys ⊆ each RPC's exact-key
  set (selector `cms_exact_keys` 140300:53-57; diff 140400:38-41; apply `cms_pattern_update_check` 140500:40-44, incl. defaulted
  `choices: []`, accepted at 140500:100-133); answer shapes match (`version`/`pageVersion` as text, `{items}` + `etag`
  response header set by 140610 on first run and replay). Every SQL raise token maps: INVALID_REQUEST 400, NOT_FOUND 404,
  `capability_missing` 403, VERSION_MISMATCH 409 (pair), CONFLICT 409, IDEMPOTENCY_MISMATCH 409, VALIDATION_FAILED 422
  (allowlisted pointer), typed reasons per list, INTERNAL_ERROR 500, `pattern_cycle`/`pattern_depth_exceeded` on 14/15 → 500.

## Security
- AuthN/Z order: origin → media → session (401) → strict input (400/422) → headers → capability (403, no quota) → user then
  party quota → port; the adapter re-resolves the same Request, requires identical session/user/party/person and re-proves
  author|editor before any network (M39-41, M53). Body never names actor/party/capability (M02 test). Concealment is SQL's
  (all instances resolved before judging); Worker relays 404 uniformly (M08).
- Leakage: error message is catalog-bound; details allowlisted twice (adapter + route `taxonomy-safe-details.ts`); telemetry
  logs op/status/requestId only; service secret only in RPC headers. Response-size budget per operation enforced (M43).
- Idempotency/replay: key + If-Match forwarded as headers and `p_request` members (M49); no retry anywhere (test present).

## Findings
- F1 `apps/worker/src/cms-composition-production-pattern-update-failure.test.ts:338-358` — minor — the "pointer outside the
  request grammar is dropped" oracle is `toMatchObject({ status: 422, details: {} })`, which matches any `details`; M47 (allow
  every pointer) survived. `UPDATE_POINTER` (`…-failure.ts:53-54`) is the ONLY guard: the route allowlist admits any
  `/[A-Za-z0-9_~/-]*` path. No current exposure (every SQL VALIDATION_FAILED pointer is in-grammar). Fix: assert
  `expect(result.details).toEqual({})`; same for lines 254-266 and 278-286 (`details: {}` under `toMatchObject`).
- F2 `…-failure.test.ts:226-251` — minor — "version pair only" asserts `not.toHaveProperty('instanceId')` on a DETAIL that never
  carried `instanceId`; the payload that does is checked with subset `toMatchObject`. M45 survived (benign today: the route 409
  allowlist strips it). Fix: `toEqual({ expectedVersion: '7', currentVersion: '9' })` on the first payload's `details`.
- F3 `apps/worker/src/cms-composition-production-pattern-update-rpc.ts:128-131` — minor — the adapter's narrowing of the
  configured deadline to the registry row (`Math.min(deadlineMs, spec.deadlineMs)`) is untested; M38 survived because the
  route deadline aborts the parent signal first. Fix: an rpc-level test with a 15,000 ms configuration, a CMS-03C-13/14 call
  that never answers, expecting 504 at 8,000 ms.
- F4 `cms-composition/pattern-selector-routes.test.ts:84,108`, `pattern-update-diff-routes.test.ts:56,72`, `…-apply.test.ts:200` (`%s is %i`) — minor —
  `it.each` titles format a string into `%i` and print "is NaN"; oracles are correct. Fix: `$2`/`%s` placeholders.
- F5 `…-rpc.ts:60-112` — minor — near-verbatim copy of the pattern-definition verifier
  (`cms-composition-production-pattern-definition.ts:69-112`), differing only in the capability predicate; extensibility rule
  "no copy-paste". Fix direction: one shared verifier taking the capability predicate.
- F6 report/code citations — minor — "BE03c 1266-1268", "1298-1304", "1304" have drifted (spec edited in place; error matrix
  now 1285-1287, typed refusals 1323). Cite by section name or refresh.
- F7 (info) report open item "stale README sentence" is already resolved by another lane (`cms-composition/README.md:43-45`).
- Info: `pattern_incompatible` is published for 15 but no current SQL path raises it; the Worker maps it correctly anyway.

## Requests to root
- Optional before promotion: land the three test-oracle fixes (F1-F3) as test-only changes; no production change needed.
- Live PostgREST exercise of the three RPCs remains outstanding until the SQL is promoted (author's request stands).

VERDICT: CLEAR
