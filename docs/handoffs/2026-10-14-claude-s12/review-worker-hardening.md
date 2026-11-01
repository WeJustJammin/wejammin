# Independent review — lane `claude_s12_worker_hardening` (Worker 03c hardening)

Reviewer: independent, read-only, did not author the lane. Target: `lane-worker-hardening-report.md`
(SHA-256 `92f624311de16766bb07c90d248b65e3bb709122f52ab6c019b572952580d144`, verified), brief `briefs/worker-hardening.md`,
worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, HEAD `b16edb54`. Brief item 5 (re-hashing) skipped as
instructed. Paths are under `apps/worker/src/` unless stated; BE00/BE03c = `.memory/wiki/specs/be/00-*.md` / `03c-*.md`.

## Status
COMPLETE. No blocker. One major that is a root item outside the lane's claim (Web relay), two minors inside the lane's
files, six informational notes. All four brief items are implemented, spec-cited and tested; the seven oracle changes are
each cited and none weakens; 03b semantics are unchanged by construction and by run.

## Runs (allowed set, pinned PATH, `flock -s /tmp/wejammin-quiet.lock`, worktree root)
| what | result |
|---|---|
| `pnpm exec vitest run` on the 15 touched test files | 15 files, **518/518** passed, 0 skipped (17:14:15, 20.8 s); receipt SHA-256 `933946d416b4cd4e852735d7482148fc2948fa8960d8451051f44cf86b418c8d`. Per file: provider-fault 84, pattern 8, write-header-order 27, template-routes 36, pattern-instance-routes 17, taxonomy-routes 26, dependency-unavailable 42, decision 20, ops-provider 120, pattern-def fault 25, taxonomy-def fault 22, headers 12, reads 31, registry 36, assignment 12 |
| 03b confirmation (target item 6): `cms-editorial-production-errors-{branches,coverage}`, `-quality-gate`, `-preview-takedown`, `cms-composition-production-template-errors` tests | 5 files, **70/70** (17:17:37). `cms-editorial-production-errors.ts`, `-error-tokens.ts`, `-error-details.ts` are tracked and unmodified (`git status` clean), so `mapCmsEditorialRpcFailure` is byte-identical to HEAD |
| `pnpm --filter @wejammin/worker type-check` | 17:14: **failed** on `cms-composition-production-related-ids.test.ts(23,18)` — an untracked related-lane file (its report line 185) with mtime 17:15:08, i.e. written 12 min after the author's report (17:02:48). Re-run 17:19:01: **exit 0**. Not this lane's |
Not re-run (outside allowance): joint 345 set, full suite, eslint, prettier, mutation runs.

## Spec conformance (clause → implemented → tested)
| clause | implemented | tested |
|---|---|---|
| BE03c 1298-1302: token-less provider 4xx is the scrubbed 500 on CMS-03C-01, cmsTemplateContextRead, cmsTemplateLatestRead, CMS-03C-02; every 5xx keeps the 03b mapping | `cms-composition-production-failure.ts:20-26` (`status < 500 && !carriesProductToken` → `internalError()`, else the unchanged 03b mapper); wired `-template-errors.ts:45`, `-production.ts:140`, `-detail.ts:94`, `-pattern.ts:182` (the `PGRST202 → unavailable` pre-mapper is gone) | `cms-composition-production-provider-fault.test.ts` (4 adapters × 15 faults + prose case → 500 `{}` + no `PGRST|42702|actor_id|JWT|slow down|private` + one fetch; 4 token controls; 503 control); `-pattern.test.ts:150-155` |
| CMS-03C-03 term action | `cms-composition-production-taxonomy.ts:55` `actTerm: async () => unavailable(...)` — no RPC, nothing to guard (author's claim verified) | n/a |
| BE00 386 (step 6) before 387 (step 7); BE03c 408, 1502: Idempotency-Key / If-Match 400 before capability and both quotas on 01/02/03 | `template-version-routes.ts:123-137`, `pattern-instance-routes.ts:126-135`, `taxonomy-routes.ts:128-137`, each right after the strict body and before "step 7: capability, then quota" | `write-header-order.test.ts` (per route: valid → port after 2 quota calls; 4 malformed keys → 400, `rateLimit` 0, port 0; no-capability + bad key → 400; no-capability valid → 403, quota 0; bad body → 422; bad/non-agreeing If-Match → 400, quota 0); order suites via `headersBeforeAuthorization` (`be00-header-order.test-support.ts:10-18`, shared steps unchanged: body 131 → key → capability 137 → rate 143) |
| BE00 172: `DEPENDENCY_UNAVAILABLE` details `{ dependencyClass, retryable: true }` for 502/503/504; BE03c 1274 and every catalog retry column agree; BE00 592 only governs `Retry-After` | `template-respond.ts:91`, `taxonomy-responses.ts:79`, `pattern-definition-response.ts:47`, `taxonomy-definition-response.ts:85`, `governed-review-errors.ts:90`. Precedent: 03b `invalidResponse()` → `CMS_EDITORIAL_INVALID_ANSWER_DETAILS` `retryable: true` (`packages/contracts/src/cms-editorial/route-policy-errors.ts:21`); contract `cms-editorial/refusals.ts:292` types it `z.literal(true)` | `phase-02-slice-12-dependency-unavailable.test.ts:321,348` (5 surfaces), `governed-review-decision.test.ts:129-132`, `governed-review-ops-provider.test.ts:70,115`, `pattern-definition-provider-fault.test.ts:89-98`, `taxonomy-definition-provider-fault.test.ts:83-92` |
| BE00 step 2: `OPTIONS` exposes only registered methods/headers; one preflight per shared path (03b `cms-editorial/routes.ts:71`, verified at that line) | `governed-review-preflight.ts:49-95` (one handler per distinct `honoPath`, method/header union, origin refusal via `governedErrorResponse(..., owner, failure(403), true)` = `middleware`, `governed-review-errors.ts:127,133-134`); mounted `governed-review-routes.ts:50`; `grep app.options` → only `preflight.ts:70` | `governed-review-headers.test.ts:87-123` (`GET, POST, OPTIONS`, no If-Match, five-header allowlist, foreign 403); `governed-review-reads.test.ts:102-118` (10 path `GET, OPTIONS`), `:122-155` (shared path, allow-origin echo, foreign → 403 `GOVERNED_REVIEW_FORBIDDEN`, missing origin → 403, no fetch); 07/08 preflights still exercised in `decision-admission` / `assignment-input` suites |
| Registry pin claim (p2 finding 2) | `governed-review-policy.ts:1-10` comment now states exactly what is pinned | `governed-review-registry.test.ts:88-111`: `capabilities` = registry list, or `[]` for the three documented database-resolved gates (08 owner receipt, 10/11 read scope); `declared` = literal mirror, verified equal to `tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts` (06/07/08 ALL; 10 at :143-146; 11 at :176-179); `pointers` = contract request-schema members |
| `VERSION_MISMATCH` fixture (p2 finding 4) | — | `governed-review-ops-tokens.test-support.ts:16-39` (`P0001` + `{"expectedVersion":"3","currentVersion":"99"}` at 400; the `40001` form kept as a second row), rows `:83-90,191-198` → 409 `{}`; `ops-refusals.test.ts:17` asserts no `private|currentVersion|"99"` on the wire |
| Vacuous replay tests (p2 finding 5) | — | `governed-review-decision.test.ts:99-114,169-177`, `governed-review-assignment.test.ts:96-110`: both calls carry the same `x-idempotency-key` and byte-identical `p_request` (`calls[1].body === calls[0].body`) — a Worker-owned property, so the tests now discriminate |

## Findings (`file:line — severity — problem — why — fix`)
1. `apps/web/src/server/cms-composition-platform-mutation.ts:182` (also `-pattern.ts:113`, `-locale.ts:114`, `-related.ts:106`) —
   **major, root item outside this lane's claim (Web frozen)** — the Web API relay proxies the Worker (`binding.fetch`, `:286`) and
   then recomputes the 502 details as `retryable: status !== 502`, overriding the Worker's member; its own oracle
   (`cms-composition-platform-mutation-error-relay.test.ts:111-115`) asserts upstream `retryable: true` → relayed `false`. — Why:
   for CMS-03C-01/02/04/05 the browser still receives `retryable: false` on a 502, so brief item 3 is correct and cited but not
   end-to-end effective; the Web surface contradicts BE00 172 exactly as the Worker did. No client code reads the Worker's 03c
   `retryable` to drive retries (grep of `apps/web/src`: readers are jobs, offline-intent, content-schema-registry and the editorial
   relay only), so the Worker-side change breaks nothing. — Fix: root dispatches the author's requests 1-3 and 5 as one lane
   (two Worker one-liners, the related oracle, the four Web mirrors and their tests), then deletes `STILL_NON_RETRYABLE_502`.
2. `cms-composition/write-header-order.test.ts:153,216,262` — **minor** — the three route dependency objects are built with
   `as unknown as Cms*Dependencies` (`readContext: vi.fn()`, `readLatest: vi.fn()` untyped); the precedent suites
   (`template-routes.test.ts`, `pattern-instance-routes.test.ts`, `taxonomy-routes.test.ts`) build fully typed dependencies (0
   casts). — Why: `tdd-contract-first` ("type your mocks"); a renamed or re-typed port would not fail this suite at compile time.
   — Fix: reuse the precedent `deps()` builders or type the three objects; drop the casts.
3. `cms-composition/phase-02-slice-12-dependency-unavailable.test.ts:37-39` — **minor** — `STILL_NON_RETRYABLE_502` pins the
   spec-contradicting `retryable: false` for the `locale` and `related-content` 502s with a prose note but no dispatch/decision
   reference. — Why: it is the only oracle that encodes a known BE00 172 violation as expected; without a tracking pointer it can
   outlive the fix. Not a weakening (five surfaces strictly stronger, two unchanged). — Fix: cite the root dispatch in the comment;
   delete the set with finding 1.

## Informational (no change requested)
- Unknown `P0001` tokens already scrub to 500 in the unchanged 03b mapper (`cms-editorial-production-errors.ts:219-220`;
  `template-errors.test.ts:105-107`). After the guard, `statusFallback` (`:149-165`) is unreachable for a 4xx through
  `mapCmsCompositionRpcFailure`: the guard admits only `P0001`, serialization-`40001` and structured tokens, all of which map or scrub.
- Controls in `cms-composition-production-provider-fault.test.ts:174-197` assert `{ok:false, status}` only (fix-review finding 2
  class); three of four would also pass under a pure status fallback, only `P0001 NOT_FOUND`@400→404 proves token mapping. The
  guard property is still fully discriminated (64 cases); catalog codes are pinned by the retained route and template-errors suites.
- RED claims re-traced statically: provider-fault 64 fail / 20 pass (every fault case was 401/403/404/409/422/418 or 503 under the
  old code; all five controls pass unchanged); `write-header-order` 18/9 (per probe: 4 key cases + no-capability-400 + If-Match
  fail on `rateLimit` 2 or status 403; valid/403/422 pass); order suites 3 (key step answered 403). Consistent with the report.
- Preflight owner = first operation on the path (06 for the shared path): the 403 is attributed to 06 in telemetry and published
  via `middleware=true` whatever 11 declares. `Authorization` on the shared path (root request 6) follows the 03b read precedent
  `cms-editorial/detail-routes.ts:107` (`Authorization, X-Request-Id`): consistent, keep it.
- `capabilities` pin for 08/10/11 asserts the policy is `[]` but not what the registry row lists, so a registry change on those
  rows passes silently here (documented at `policy.ts:5-6`; the OpenAPI/registry tests hold the rows).
- `cms-composition-production-pattern.ts` carries concurrent placement-lane edits (`PatternPlacementResourceSchema`,
  `validPlacement`, response-byte clamp); this lane's edits there are exactly the mapper swap and the stop-gap removal
  (diff `:176-186`). The report's hash for that file is a shared snapshot.

## Security
Ordering: 401 (session) still precedes everything; the new header 400 compares only caller-supplied values (key grammar,
If-Match vs body `expectedVersion`) and so reveals nothing about any resource; the local 403 is session-capability-only;
404 and the SQL 403 arise only inside the RPC, after both. Body 422 still precedes header 400 (all three routes). The only
observable change is that an authenticated caller's malformed header no longer consumes a user and a party token.
Concealment of PGRST faults: a missing/unexposed RPC or bad service credential is now 500 `{}` instead of a 404/401 that
named the provider's state. PII/secrets: scrubbed `{}` on every fault; provider `message`/`details` never copied (asserted);
`VERSION_MISMATCH` DETAIL versions never reach the wire. Replay/CAS/MFA: unchanged production paths (07/08 only lost their
`app.options` blocks); replay tests now assert the Worker-owned invariants. Grants: no SQL touched.

## Test corrections 1-7 (each re-verified: spec-cited, non-weakening)
1 pattern `PGRST202` pin 503→500 `{}` + no `Could not find` (BE03c 1298-1302, root ruling): stricter. 2 order suites: one step
moved, same defects/statuses. 3 dependency-unavailable: 5 surfaces → `true`, 2 unchanged (finding 3). 4 decision 5 cases +
ops-provider 12 cases `false→true` (BE00 172). 5 headers preflight `POST, OPTIONS` → `GET, POST, OPTIONS` + allowlist: additive.
6 tokens fixture: `P0001` form added, `40001` kept: additive. 7 replay: additive assertions. Full suite `.skip`/`.only`: none.

## Conventions
No `any`, `TODO`, `.skip`, `.only`, `ts-ignore`, `eslint-disable`, `BOUNDARY` in the 35 lane files (sweep; only `expect.any`
matchers and prose). Production max 314 lines (`cms-composition-production.ts`, pre-existing size, disclosed); tests max 946/705
(pre-existing). New files: 18, 26, 96, 210, 352 lines, documented, typed (`unknown` narrowed). README updated (guard rule, the
composition wrapper, the merged preflight, the add-an-operation steps). Spec citations BE00 172/386-388/592, BE03c
408/1274/1288-1302/1502 and `cms-editorial/routes.ts:71` all point at the lines claimed.

## Requests to root
1. Dispatch finding 1 as one lane (requests 1-3 and 5 of the author's report) so the Worker and the Web relay agree on BE00 172.
2. Run the canonical Worker gates on a quiet host: the tsc failure seen at 17:14 was another lane's in-flight file.

VERDICT: CLEAR
