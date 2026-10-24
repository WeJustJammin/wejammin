# Independent review: lane `claude_s12_hardening_2`

Reviewer: independent (did not author). Read-only except this file. Target report
`lane-hardening-2-report.md`, SHA `a8355c3c259f53999024dfda870039c4d82188e17b443622b0082a491ee5109f` (verified).
Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, HEAD `b16edb54` (verified). Item 5 of the
template (re-hashing) skipped by root's instruction. Placement producer is still WIP
(`supabase/migrations-wip/placement/`, nothing under `supabase/migrations/20261014110*`).

## Clause map (BE03c / BE00 / contract -> implementation -> test)
| Clause | Implemented | Tested |
|---|---|---|
| BE00 172 `retryable: true` on 502/503/504, Worker | `taxonomy-responses.ts:77-79`, `locale-routes-support.ts:116`, `related-content-details.ts:95` | `phase-02-slice-12-dependency-unavailable.test.ts:312-347`, `related-content-errors.test.ts:233-247` |
| BE00 172, Web relays (relayed and relay-local) | `cms-composition-platform-dependency.ts`; `-mutation.ts:65-67,187-188`; `-pattern.ts:59-63,120-121`; `-locale.ts:51-53,119-120`; `-related.ts:52-54,111-112` | `mutation-error-relay.test.ts:111-115`; `pattern.test.ts:156-160`; `locale.test.ts:236-265`; `related.test.ts:246-275` |
| BE00 386/387 headers validated before authorization (locale, related) | `locale-routes.ts:135-145`; `related-content-routes.ts:127-136` | `locale-routes.test.ts:854`, `related-content-admission.test.ts:257` (`headersBeforeAuthorization`) |
| BE03c 1304 + `CMS_SLICE_12_OPERATION_REASONS['CMS-03C-02']`: seven tokens -> 403/409/422 with exactly `details.reasonCode` | `cms-composition-production-pattern-errors.ts:48-60`; `pattern-instance-details.ts:15-39` | `cms-composition-production-pattern-reasons.test.ts:70-82`; `pattern-instance-reasons.test.ts:39-57` |
| BE03c 1298-1302 unlisted token / prose / hint / non-raise 4xx -> scrubbed 500 | `pattern-errors.ts:51-57,62-65` | `...-reasons.test.ts:102-129`; `production-pattern.test.ts:133-154` (PGRST202 -> 500) |
| BE03c 1289 catalog codes `COMPOSITION_*` | `cms-composition-production-pattern.ts:63-68,183-184` | `production-pattern.test.ts:229-270` |
| BE03c 408 / BE00 172 response-contract failure = local 502 with dependency details | relays `-pattern.ts:246-262` etc. | `pattern.test.ts:50-66`, `locale.test.ts`/`related.test.ts` oversized rows |
| BE03c 1304 / FE03 1112: first-party browser receives the typed tokens | MISSING (finding 1) | none |
| R3 `COMPOSITION-POSITION-DDL` parity | `tests/contracts/phase-02-slice-12-pattern-placement-witness-parity.test.ts` | itself (3 tests; WIP path fallback identical to the lineage model) |

Producer tokens verified against the WIP: `capability_missing` (110300:88), `revision_not_editable` (:107),
`pattern_version_not_active` (:126,:141), `pattern_incompatible` (:147), `block_registry_digest_mismatch` (:156),
`nested_pattern_not_active` (110100:59), `pattern_cycle` (110100:62) = the seven listed by the contract. Also raised:
`pattern_depth_exceeded` (110100:35), `pattern_nodes_exceeded` (110250:43) -> 500 (see finding 6); bare `CONFLICT`
(110300:172,184; 110400:34) -> 409 `{}`; `NOT_FOUND` before `capability_missing` (110300:77-88) keeps 404-before-403.

## Findings
1. `apps/web/src/server/cms-composition-platform-pattern.ts:95-105` — **major** — the first-party CMS-03C-02 relay's
   `safeDetails` admits only `reasonCode: 'CAPABILITY_REQUIRED'` on 403, only the version pair on 409, and `{}` on 422,
   so every typed token the Worker now publishes is stripped before the browser; the oracle
   `cms-composition-platform-pattern.test.ts:112-118` pins only `CAPABILITY_REQUIRED`. — Why: FE03 1112 requires the insert
   form to distinguish 409 `revision_not_editable` and 422 `pattern_version_not_active`/`pattern_incompatible`; BE03c 1304.
   Brief item 3 is therefore correct at the Worker API but not end-to-end, the same shape as `review-worker-hardening.md`
   finding 1; the report says "DONE" without this caveat. — Fix: admit a `CMS_SLICE_12_OPERATION_REASONS['CMS-03C-02']`
   token at its `cmsSlice12ReasonStatus` (mirror `pattern-instance-details.ts`), RED tests for the seven tokens and the
   drop rules; the lane touched this file for item 2, so root should dispatch it as the hardening-3 lane.
2. `apps/worker/src/cms-composition/pattern-instance-routes.ts:144` (HEAD:132, untouched by the lane) with
   `apps/worker/src/cms-composition/pattern-instance-details.ts:36-37` — **major** — the route-local capability refusal
   goes out as `{reasonCode: 'CAPABILITY_REQUIRED'}` (passed through `sharedDetails`) while the producer's goes out as
   `capability_missing`: two tokens for one refusal on one operation. — Why: BE03c 1304 names `capability_missing`;
   `CmsCompositionRefusalDetailsSchema` rejects `CAPABILITY_REQUIRED` and `refusals.test.ts:203-212` asserts it is not an
   03c application token; brief item 3 named "capability 403". No Worker oracle pins the local token
   (`pattern-instance-routes.test.ts` has none). Same split pre-exists in `locale-routes.ts:154`,
   `related-content-routes.ts` and all four Web relays (other lanes). — Fix: line 144 -> `capability_missing` (the new
   details module then types it), RED test; root rules the cross-lane unification.
3. `apps/worker/src/cms-composition-production-pattern-errors.ts:47` — **minor** — every 5xx goes through
   `mapCmsCompositionRpcFailure`, so a 5xx whose `code` is a structured 03b token maps by token (500 `VERSION_MISMATCH`
   -> 409), whereas both named precedents (`cms-composition-production-related-rpc.ts:47`,
   `cms-composition-production-pattern-definition-latest.ts:62`) answer every 5xx `failure(503, {}, 15)`. Forced by the
   placement lane's oracle `pattern-placement.test.ts:185-225` (`placementErrorResponse` sends status 500 +
   `VERSION_MISMATCH`, expects 409; over budget expects 503 `cms_editorial`), which the report cites loosely but
   accurately. — Why: three 03c adapters now disagree on 5xx-with-token; no wire leak (the route re-derives dependency
   details). — Fix: root rules one 5xx policy for the 03c adapters and aligns the placement oracle or the precedents.
4. `apps/worker/src/cms-composition/README.md:22-24`, `apps/web/src/server/README.md:145-167` — **minor** — both
   enumerate the CMS-03C-02 / `cms-composition-platform-*` files but not the new `pattern-instance-details.ts` and
   `cms-composition-platform-dependency.ts` (extensibility rule). — Fix: one line each.
5. `cms-composition-platform-locale.test.ts:258`, `cms-composition-platform-related.test.ts:268` — **minor** — the new
   tests assert `[502, 503, 504].toContain(response.status)`, so a 502 relayed as 503 would pass; the member under test
   (`retryable: true`) is non-vacuous (RED seen). — Fix: pin the upstream status per row.
6. BE03c 378 (CMS-03C-02 field matrix: "no cycles; max protected depth/nodes" -> 409/422) — **minor / spec ruling** —
   names depth/nodes for this operation while the frozen `CMS_SLICE_12_OPERATION_REASONS['CMS-03C-02']` omits
   `pattern_depth_exceeded`/`pattern_nodes_exceeded`; the producer raises both and the adapter answers 500 (asserted).
   The author's open item is right; add BE03c 378 to root's ruling. No change by this lane is possible (contract frozen).

## Checks that passed
- Security: whole-message token selection only (`pattern-errors.ts:48-50`); producer DETAIL pointers never relayed for a
  typed token (asserted, `secret-pointer`); other-operation and other-domain reasons -> 500 (`:51-57`, `:65`); 5xx with a
  token stays 503 (asserted); 40001 CAS and `INTERNAL_ERROR` ordering match precedent; no PII/secret in any envelope.
- Web relays never fabricate a dependency class: upstream 500 -> `safeDetails(500)` = `{}` (`-pattern.ts:121`,
  `-mutation.ts:189`, locale/related same); unknown upstream status, non-JSON, off-catalog code/message, wrong 201 shape,
  oversized body -> local 502 with `cms_composition` (a Worker contract failure is this dependency, BE03c 408); missing
  binding or thrown fetch -> 503; `retry-after` kept only on 429/503/504; no explicit 5xx call passes non-default details.
- Item 5 is a stale oracle, not a production change: the relay rewrite to `PatternPlacementResourceSchema` + strong ETag
  is the Codex web-pattern lane's (`docs/handoffs/2026-10-12-claude-s12/lane-codex-web-pattern-red-report.md`); the route
  test at HEAD sent a bare resource; the fix (`{ items: [resource] }`, `position: 0`, `path: '/primary/hero0'`) matches
  BE03c 160 / DEC-175/185/186 and is minimal.
- Test corrections (two 502 rows false -> true, `related-content-errors.test.ts:233`) are spec-cited (BE00 172) and
  minimal; `STILL_NON_RETRYABLE_502` gone; no `retryable: status !== 502` or `retryable: false` remains in
  `apps/worker/src/cms-composition` or `apps/web/src/server`; `write-header-order*.test.ts` hold 0 `as unknown as`.
- Conventions: all touched source files <= 300 lines (`locale-routes.ts` 299, `production-locale.ts` 298); no `any`, no
  `TODO`; `placementRpcError` and `patternInstanceDetails` follow `relatedRpcError` / `related-content-details.ts`.
- Report claims re-verified: seven-token list, contract list, header-order helper use, item 6, item 1 edits all hold.

## Runs (allowed scope only)
- `pnpm vitest run` on the 25 touched/adjacent files (Worker 17, Web 6, contracts 2) under
  `flock -s /tmp/wejammin-quiet.lock`: 25 files, 462/462 tests pass, 12.1s.
- `astro check` (apps/web): first run 6 errors (transient, other lanes' files in flux, none in this lane's files); second
  run 0 errors, 0 warnings — the author's claim holds. Full Worker/Web suites, tsc, eslint, prettier not re-run (outside
  allowed execution).

VERDICT: PARTIAL
