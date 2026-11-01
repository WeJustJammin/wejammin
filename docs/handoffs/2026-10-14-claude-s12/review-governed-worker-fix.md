# Independent review: lane `claude_s12_governed_worker` fix pass (delta on phase 1)

Reviewer: independent (did not author). Read-only except this file. Worktree
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e`, 2026-10-14.
Baseline: phase-1 review `review-governed-worker-p1.md` SHA-256 `857bb358f9d645d178b67cd8d7f157f55c082a36ad46de589b6f5351232f548f`
(matches; its Files hashes are the baseline). Author report `lane-governed-worker-report.md` SHA-256
`4e2152a771e95c33f992230379ad610922f05a75bf0255ca444e02a544b6f6a7` (matches), section `## Fix pass`; brief
`briefs/governed-worker-fix.md` (`b8894d37…`). Paths below are under the worktree; BE03c =
`.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`, BE00 = `.memory/wiki/specs/be/00-infrastructure.md`,
SQL = `supabase/migrations/20261013300820_cms_submit_governed_review_binding_fix.sql` (live governed producer),
WIP = `supabase/migrations-wip/governed-fix/20261014040100_cms_submit_governed_review_refusals.sql`.

## Status
COMPLETE. No blocker, no major. Two minors, both small and both inside this lane's files; four informational notes.
All five phase-1 findings are closed (map below). The two rulings the author requested are given at the end.

## Findings

1. `apps/worker/src/cms-composition/provider-fault-guard.ts:5,20` — **minor** — `'40001'` is admitted as a product
   SQLSTATE whatever the message, so `{code:'40001', message:<engine prose>}` at a 4xx passes the guard; then
   `codeFromRpcError` returns `''` (`cms-editorial-production-errors.ts:144-145`), `mapped` is null, the P0001 guard
   at `errors.ts:219` does not fire, and `statusFallback` (`errors.ts:149-165`) publishes it as the caller's refusal
   (@409 → `GOVERNED_REVIEW_VERSION_CONFLICT {}` on the governed transport, `COMPOSITION_VERSION_CONFLICT` /
   `TAXONOMY_VERSION_CONFLICT` on the precedents). The legitimate 40001 case is already taken by the first branch of
   every adapter (`cms-composition-production-governed-review-rpc.ts:71-76`,
   `cms-composition-production-pattern-definition-latest.ts:50-55`, `taxonomy-definition-response.ts:98-106`), which
   requires a `SERIALIZATION_TOKENS` message. — Why it matters: the module's own contract (lines 8-10, "true only when
   a provider error payload can be a product answer") does not hold for an engine `serialization_failure`, which is
   transient, not a stale operand. Exposure is low: `errors.ts:100-104` records that PostgREST reports class-40 as
   HTTP 500, which the `status >= 500 → 503` branch catches before the guard, so only a synthetic/proxied 4xx reaches
   it; no regression versus phase 1 (the same payload reached `statusFallback` then too). — Fix: in
   `carriesProductToken`, `code === '40001'` → `SERIALIZATION_TOKENS.has(trimmed message)`; one case
   `{code:'40001', message:'could not serialize access'}`@409 → 500 in each of the three fault suites.

2. `apps/worker/src/cms-composition/pattern-definition-provider-fault.test.ts:53-59` — **minor** — the "keeps a
   structured product token answer" control asserts `status === 404` only (no catalog code, no `details`, no
   provider-text check), unlike the governed control (`governed-review-provider-fault.test.ts:88-132`, `expectError`
   with `GOVERNED_REVIEW_NOT_FOUND`, plus `P0001 NOT_FOUND`, `P0001 subject_not_submittable`, `40001 VERSION_MISMATCH`)
   and the taxonomy control (`taxonomy-definition-provider-fault.test.ts:61-71`, `TAXONOMY_NOT_FOUND`). The pattern
   suite has no P0001 control at all. — Why it matters: on its own the suite would pass against a guard that let a
   structured token through to the wrong catalog code; the property is covered only by the retained suites
   (`pattern-definition-write.test.ts:41-68`, P0001 `key_reserved` → 422; `pattern-definition-provider-boundary.test.ts`).
   — Fix: `expectError(response, 404, 'COMPOSITION_NOT_FOUND')` and one `P0001` control per operation (`create`,
   `latest`).

3. `apps/worker/src/cms-composition-production-governed-review-rpc.ts:98-106` and `governed-review-response.ts:73-74` —
   **informational** — the domain-less `canonical_source_unavailable` → 502 ruling is spec-consistent (checked below),
   but three things root should know: (a) it rests on BE00 592 ("502 when a contacted dependency returns an invalid
   response") and BE03c 410 (response-contract failure → 502), not on 1298-1302 as the phase-1 review suggested — the
   message *is* catalog-generated, so 1298-1302 does not literally apply; (b) the author's precedent citation
   (`taxonomy-definition-response.ts:117`, actually line 118) is a different rule: the taxonomy transport answers that
   token 502 unconditionally because CMS-03C-16 never emits it (its create accepts an unbuilt declared domain,
   `taxonomy-definition-write.test.ts:86-104`), i.e. it is the taxonomy transport's *foreign-token* status, whereas the
   governed and pattern transports answer a foreign token 500 (`rpc.ts:88-93`, `latest.ts:67-72`) — a pre-existing
   500-vs-502 disagreement between the Slice 12 transports, not introduced here; (c) the new 502 inherits the
   transport's `retryable: false` for 502 (`governed-review-response.ts:74`), while BE00 172 types the member as
   `retryable: true` and the shared `CMS_EDITORIAL_INVALID_ANSWER_DETAILS` (`packages/contracts/src/cms-editorial/route-policy-errors.ts:19-22`)
   says `true`; no cms-composition contract pins it (grep). Pre-existing since phase 1 (accepted there), listed for
   one rule.

4. `docs/handoffs/2026-10-14-claude-s12/lane-governed-worker-report.md:179` — **informational** — the RED evidence for
   the two precedent guards is "failures in all three suites (the listing was truncated, exact per-suite counts not
   recorded)". Weaker than the governed RED (#1: 14 fail / 5 control). My static trace supplies the proof instead:
   every `PROVIDER_FAULTS` case in `pattern-definition-provider-fault.test.ts:16-29` and
   `taxonomy-definition-provider-fault.test.ts:15-28` reached `statusFallback` under the pre-guard code and was
   answered 404/401/400/403/404/503/400/404 respectively, never 500, so each case fails with the guard removed. Not a
   defect; recorded because the report asserts a run it cannot show.

5. `apps/worker/src/cms-composition/governed-review-observability.test.ts:101-118` — **informational** — "never
   echoes a pointer outside the request allowlist" expects the unlisted pointer to survive as `/` (`['/', '/subjectHash']`)
   rather than be dropped. That is the documented allowlist projection (`governed-review-response.ts:39-64`, phase-1
   clause map) and the test does assert the private path text is absent; noted only so the oracle is not later read
   as a leak.

6. SQL side of the three phase-1 rulings — **informational, SQL lane, not reviewed here** — the WIP migration emits
   exactly what the Worker consumes (`WIP:31-33` `jsonb_build_object('domain', …)::text` → parsed by `rpc.ts:51-63`,
   which requires one of the six `CanonicalDomainSchema` values; `WIP:41` `detail = '["/subjectHash"]'` →
   `violationsFromDetailText` → `response.ts:107-110`; `WIP:30` `subject_not_submittable` for an inactive nested
   pattern). Since phase 1 the SQL lane has added untracked pgTAP material that names all three:
   `supabase/tests/phase_02_slice_12_governed_fix.sql` + `phase_02_slice_12_governed_fix/{000-blocks,005-submit-source,010-digest}.sqlinc`
   (`pattern_version`, `/subjectHash`, the `domain` DETAIL) and `phase_02_slice_12_governed_submit/030-hash-refusal.sqlinc`
   (the submit suite is now a directory of `.sqlinc` parts). I did not review those files (outside this delta's
   files and outside my execution allowance); root should route them to the SQL review together with the WIP
   migration.

Nothing found for: PII/secret leakage (guard → `failure(500)` → `{}`; 502 → `{dependencyClass, retryable}`; provider
`message`/`details` text never copied — asserted at `governed-review-provider-fault.test.ts:64`,
`taxonomy-definition-provider-fault.test.ts:56`, `governed-review-refusals.test.ts:95,135-136`), 403/404 concealment
(below), replay/CAS/MFA (unchanged files), grants (unchanged SQL), `any` (sweep of the 16 files: only the test labels
"payload without any code"), TODO/BOUNDARY/`.skip`/`.only`/lint suppressions (none), file size (max 297,
`pattern-definition-write.test.ts`), non-additive shared edits (the five integration files, `cms-editorial-production-types.ts`,
`-errors.ts`, `-error-tokens.ts`, `-error-details.ts` are byte-identical to phase 1 / tracked-unmodified).

## Phase-1 findings → closure

| Phase-1 finding | Closed by | Verified at |
|---|---|---|
| 1 major: token-less provider 4xx → caller refusal | `provider-fault-guard.ts:17-21`; `rpc.ts:108-109`; `latest.ts:77-78` (one `patternRpcError` serves CMS-03C-12 and `cmsPatternLatestRead`, `latest.ts:120-123,166-167`); `taxonomy-definition-response.ts:129-130` (one `taxonomyRpcFailure` serves write and versions read: `cms-composition-production-taxonomy-definition-versions.ts:33,110,134`, composed by `-taxonomy-definition.ts:112,168`) | `governed-review-provider-fault.test.ts` 19; `pattern-definition-provider-fault.test.ts` 19 (2 ops); `taxonomy-definition-provider-fault.test.ts` 18 (2 ops, production harness) |
| 2 minor: header validation after capability/quota | `governed-review-routes.ts:97-104` now before `governedAdmission` 105-111; `pattern-definition-routes.ts:97-109` before `patternAdmission` 110-117; `taxonomy-definition-write-route.ts:67-78` before `quota` 79-80 (`taxonomy-definition-shared.ts:171-201`: curator check, then user, then party) | `governed-review-headers.test.ts:57,70`; `pattern-definition-write.test.ts:109,220`; `taxonomy-definition-write.test.ts:156` (all `rateLimit` not called) |
| 3 minor: lenient domain-less 422 | `rpc.ts:98-106` → 502 | `governed-review-refusals.test.ts:99-153` (valid domain → 422 with `domain`; prose/non-canonical/`{}`/non-JSON/array/numeric/absent → 502 with no `reasonCode`/`domain`) |
| 4a-e minor: untested retry-after 15, 429 members, `/subjectHash`, correlation, telemetry | — | `governed-review-observability.test.ts:21-31` (500/502/503/504 → 503 + `retry-after: 15`; local 502/500 → none, 33-46), 48-79 (user 30 / party 60: `retry-after`, `ratelimit-limit/-remaining/-reset`, `details {retryAfterSeconds, limit, resetAt}`), 81-99 (`VALIDATION_FAILED` + `["/subjectHash"]` → 422 at `/subjectHash`, BE03c 389), 122-149 (valid/invalid/absent `x-correlation-id` on the wire header, `p_request.correlationId`, `context.correlationId`), 151-185 (one `cms.composition.governed_review.request` event with route facts; no hash/key/user/party/`private`) |
| 5 minor: README | `apps/worker/src/cms-composition/README.md:45-65` (+22 lines, tracked diff; names the pattern-definition, taxonomy-definition and governed-review files, the guard and the extension step) | n/a |

## Proof: the guard cannot swallow a legitimate product refusal

`carriesProductToken` admits a record whose `code` (trim/upper) is `P0001`, `40001` or a `STRUCTURED_TOKENS` member
(`cms-editorial-production-error-tokens.ts:199-201`: the uppercase keys of the token table). It sits after the 40001,
INTERNAL_ERROR, 5xx and typed-reason branches in all three adapters, so it only decides payloads those branches
declined. Every RPC-time token each producer and its callees can emit was enumerated (`grep` of every
`raise exception` / `errcode` / `exception when` in the files below; the only non-`P0001` errcodes are the
`'55000'` migration-time DO-block self-checks, e.g. SQL:252-262, WIP:45+, which never run at RPC time):

- **CMS-03C-06** (`platform_api.cms_submit_governed_review` 300810 → `platform_private` SQL as amended by WIP):
  `INVALID_REQUEST` ×4, `NOT_FOUND` ×3, `capability_missing`, `subject_not_submittable` ×6 (+1 from WIP:30 replacing
  `pattern_version_not_active`), `canonical_source_unavailable` (WIP:31-33 with the domain DETAIL),
  `VALIDATION_FAILED '["/subjectHash"]'` (WIP:41), `IDEMPOTENCY_MISMATCH` (SQL:116), `INTERNAL_ERROR` ×2
  (SQL:122,188); wrapper 300810:21-27 converts `deadlock_detected`/`lock_not_available` → `CONFLICT`. All
  `errcode = 'P0001'`. Engine unique violations cannot escape: the review insert is wrapped (SQL:207-208 →
  `subject_not_submittable`); the reservation goes through `cms_reserve` (SQL:183 →
  `20260930150000_cms_idempotency_business_hash.sql:67-102` → `identity_idempotency_reserve`,
  `20260901030000_party_identity_aliases.sql`: `on conflict (actor_id, operation, key_hash) do nothing`, `for update`,
  `IDEMPOTENCY_MISMATCH` P0001); the lifecycle update's `when others … raise;` (SQL:234-236) only re-raises the
  P0001 trigger-guard tokens of `20261013300000`/`300600` (`CONFLICT`, `VALIDATION_FAILED`, `IMMUTABLE_RECORD`,
  `FORBIDDEN`) or engine errors PostgREST reports as 5xx (→ the untouched `status >= 500 → 503` branch). Callees
  `cfg_actor`/`cfg_acting_party`/identity helpers (`20260901070000`: `UNAUTHENTICATED`, `FORBIDDEN`,
  `STEP_UP_REQUIRED`, `INVALID_REQUEST`), `cms_exact_keys` (`20260902080000`), `cms_governed_subject_helpers`
  (`300300`: `DEPENDENCY_UNAVAILABLE` P0001 with DETAIL, `when others` → structured return): all P0001.
- **CMS-03C-12 / cmsPatternLatestRead** (`migrations-wip/pattern-def/20261014020400`, `020500`, helpers `020000`,
  `020200`, `020300`): `CONFLICT` ×5(+1 wrapper 020500:84-87, +2 guard), `INVALID_REQUEST` ×3(+1), `NOT_FOUND`
  ×2(+2; the `when others` at 020400:63-67 and 020500:46-50 only null the identity lookup → `NOT_FOUND`),
  `VALIDATION_FAILED` (+pointer DETAIL; `cms_pattern_forest_check` at 020400:121 returns a text token, its
  `when others` at 020000:135-136 returns `'VALIDATION_FAILED'`), `key_reserved`, `pattern_cycle`,
  `nested_pattern_not_active`, `pattern_depth_exceeded`, `pattern_nodes_exceeded`, `block_registry_digest_mismatch`,
  `capability_missing` (×2), `INTERNAL_ERROR`; `unique_violation` → `CONFLICT` (020400:267-269). All P0001.
- **CMS-03C-16 / cmsTaxonomyVersionsRead** (`supabase/migrations/20261014030200`, `030300`, `030400`, guard `030100`;
  promoted during this review): `INVALID_REQUEST` ×6(+3 list), `CONFLICT` ×4(+1 wrapper 030300:21-27, +2 guard),
  `VALIDATION_FAILED` (+DETAIL) ×6(+4 guard), `NOT_FOUND` ×2(+2 list; `when others` 030200:76-81, 030400:46-50 →
  `NOT_FOUND`), `capability_missing` (030200:85-86 under the lock; 030400:52-53), `INTERNAL_ERROR`;
  `unique_violation` → `CONFLICT` (030200:202-203). All P0001.

Hence every catalog raise carries `code: 'P0001'` and passes the guard unchanged into the same mapping phase 1
reviewed; the structured-token path (`{code:'NOT_FOUND'}` etc.) passes by `STRUCTURED_TOKENS`; the only payloads the
guard rejects are non-catalog codes (`PGRST*`, raw SQLSTATEs, code-less, non-object), which 1298-1302 assigns to 500.
Controls asserting this: `governed-review-provider-fault.test.ts:88-132` (structured `NOT_FOUND`/`INVALID_REQUEST`,
`P0001 NOT_FOUND`, `P0001 subject_not_submittable`, `40001 VERSION_MISMATCH`), the retained refusals suite (99 tests,
every `CmsSlice12ReasonCodeSchema` option and every Slice 11 reason through `sqlRefusal` = `P0001`), the pattern/taxonomy
`keeps a structured product token answer` controls (finding 2 on the pattern one), and the retained precedent suites.

## No regression in the precedent transports

The frozen Codex receipt `/tmp/wejammin-s12-worker-final-KOvCtX/vitest.json` (SHA-256
`067ada0a527399532f487d094cd7a877f63cc34ed1a6751b0fa8cd75e7cb4216`, the value cited in
`docs/handoffs/2026-10-12-claude-s12/lane-native-worker-integration-report.md`; 345/345, 11 files) lists 38 names for
`pattern-definition-write.test.ts` and 31 for `taxonomy-definition-write.test.ts`. The current files reproduce all 69
titles with the same `it`/`it.each` arities (pattern 4+1+2+8+7+1+1+6+1+1+2+1+1+2 = 38; taxonomy
1+2+2+1+1+1+2+1+5+9+4+1+1 = 31); the only edits are the three additive `expect(…rateLimit).not.toHaveBeenCalled()`
lines (pattern 109, 220; taxonomy 156). No test removed, renamed, skipped or weakened. The other nine frozen suites
were not touched by this pass (their files are not in the fix-pass table and `pattern-definition-latest-routes.ts`,
`-ports.ts`, `-response.ts`, `taxonomy-definition-routes.ts`, `-shared.ts`, `-versions-route.ts` still carry the
frozen hashes `b00f5d2d…`, `33d559d9…`, `532c0d09…`, `9fae16c4…`, `4b39a9b1…`, `6931e3cb…`). I did not re-run the
345 joint set (outside the allowance); the author reports 345/345 unchanged.

## Ordering and concealment

Governed `routes.ts`: origin/media/CSRF 82-86 → bytes 87-88 → session 401 89-90 → query 91 → body 422 92-96 →
headers 400 97-104 → `governedAdmission` (acting party, `any_of` 403, user quota, party quota; `ports.ts:161-214`,
unchanged) 105-111 → abort → port. Pattern `routes.ts`: same shape with the If-Match/expectedVersion agreement at
104-109 before `patternAdmission` 110-117. Taxonomy `write-route.ts`: session 49-54 → query 55 → body 56-60 →
transport (headers + body) 67-78 → `quota` (curator 403, then rate) 79-80. Spec: BE00 386 (step 6 "strict Zod
validation of path/query/headers/body … before resource authorization") precedes 387 (step 7 capability … "domain
quota"); BE03c 408 ("All | headers/body | … Idempotency-Key 8–128 printable ASCII … | 400/415/422"); 1502
(parse → authenticate → capability). The author's citation is correct; BE00 386 is the stronger one.
Concealment unchanged: 401 still precedes everything else; the local 403 (`capability_missing` /
`CAPABILITY_REQUIRED`) derives from session capabilities only, so a 400 now preceding it reveals nothing about any
resource; 404 and the SQL-side 403 arise only inside the RPC, after both. The only observable change is that an
authenticated caller's malformed header no longer consumes one user and one party token. Body-422 still precedes
header-400 (as in phase 1).

## Domain-less `canonical_source_unavailable` → 502 (ruling check)

Contract `packages/contracts/src/cms-composition/refusals.ts:257-263` makes `domain` required; BE03c 1314, 1375, 1611
and FE03 1115 say "with `details.domain`". A refusal lacking it cannot be published as 422 (the typed parser rejects
it, phase-1 finding 3). Between 500 and 502: BE03c 1298-1302 covers "an unmapped status or a message not generated by
its operation catalog" — not this case (the message is catalog-generated); BE00 592 assigns "a contacted dependency
returns an invalid response" to 502, BE03c 410 assigns a response-contract failure to 502, and the Worker already
answers a malformed provider *success* envelope 502 (`governed-review-provider-boundary.test.ts`, phase-1 clause map).
502 is therefore the consistent reading; the implementation (`rpc.ts:98-106`) leaks neither `reasonCode` nor the
DETAIL text (refusals.test 135-136). Accepted. See informational 3 for the two caveats root should record.

## Tests

Non-vacuous: each fault case scripts a payload the pre-guard code answered with a different status (phase-1 finding 1
traced three of them; the rest follow `statusFallback`), asserts 500/`INTERNAL_ERROR`, `details {}` and exactly one
fetch (`governed-review-provider-fault.test.ts:56-66`; taxonomy additionally asserts no `PGRST|42702|actor_id` text);
the prose test (69-86) proves the message/DETAIL never select a refusal; the observability suite's mutation counts
(retry 15→16: 4; drop `ratelimit-limit`: 2; drop `-reset`: 2; telemetry status: 1) are consistent with one oracle per
clause as read. No mock returns the expected error (every expected value is produced by the route under test from a
scripted provider reply); no skipped/filtered tests; no weakened oracle.

Test corrections (author's §Test corrections 1-3) re-verified: (1) the removed half asserted a lenient 422 without
`domain` that the frozen contract forbids — the replacement (`refusals.test.ts:115-153`) is stricter, and the kept
half (99-113) is the phase-1 text verbatim; (2) the loop (75-97) now supplies `{"domain":"gear"}` for
`canonical_source_unavailable` only; every other token keeps its 500/403/409/422 oracle, so the loop still proves the
operation-list boundary for all `CmsSlice12ReasonCodeSchema.options`; (3) the three added `rateLimit` assertions are
additive. All three are justified by `refusals.ts:257-263`, BE03c 1375 and BE00 386/BE03c 408 respectively.

## Conventions

`provider-fault-guard.ts` (21 lines) is documented, typed (`unknown` narrowed by `isRecord`), imports the shared
token/detail modules the same way its siblings do; applied identically in the three adapters immediately before the
shared-mapper fallback (comment text identical). README updated. Files ≤300 lines. No `any`, TODO, BOUNDARY,
`.skip`/`.only`.

## Claims re-verified

- 16/16 SHA-256 and line counts in the fix-pass Files table match (`sha256sum`/`wc -l`). The nine governed files not
  in that table (`governed-review-ports.ts`, `-response.ts`, `cms-composition-production-governed-review.ts`,
  `-submit.test-support.ts`, `-submit`, `-admission`, `-production`, `-provider-boundary`, `-refresh` tests) and the
  five shared integration files still carry the phase-1 hashes; `cms-editorial-production-types.ts` is the frozen
  `bc248fd9…`; `cms-editorial-production-errors.ts` (`738ddbf7…`, 250 lines), `-error-tokens.ts`, `-error-details.ts`
  are tracked and unmodified (`git status` clean).
- Focused run (allowed set: the nine governed suites + the two new precedent fault suites), `pnpm exec vitest run
  <11 files> --reporter=json` from the worktree root under `flock -s /tmp/wejammin-quiet.lock`, pinned toolchain,
  10:49:53-10:50:01 UTC: **281/281 passed**, 0 failed/pending/todo; per file admission 19, headers 12, observability
  13, production 10, provider-boundary 28, provider-fault 19, refresh 6, refusals 99, submit 38, pattern fault 19,
  taxonomy fault 18 (phase 1: 205 over 7 files; refusals 92 → 99 = +6 `it.each` cases +1 no-DETAIL case). Receipt
  SHA-256 `2984e63e7b6e00b2fc2da41a639a5a12a9467fbfa3715cdd8d38fb88e85648d6` (scratchpad `governed-fix-vitest.json`).
  Equals the author's "11 files, 281 / 281".
- `pnpm --filter @wejammin/worker type-check` (`tsc --noEmit`) under the same lock, 10:55:47-10:55:58 UTC: exit 0.
- Not re-run (outside the allowance): the 345-test joint set, the 9,981-test full Worker suite, eslint, prettier,
  `git diff --check`, the author's mutation runs.
- Spec citations 408, 1298-1302, 1314, 1375, 1502, 1611, 389, BE00 172/592, `refusals.ts:257-263`: all point at the
  lines claimed. `taxonomy-definition-response.ts:117` is line 118 (one-line drift; see informational 3b for why it
  is not the same rule).
- The "Traced cases now 500" list and "Controls kept" list in Fix pass §1 match the three fault suites exactly.

## Rulings on the author's root requests

**(1) Move `carriesProductToken` into `mapCmsEditorialRpcFailure`? — Yes for the 03c adapters, as its own lane; not
for the 03b callers without a decision; and one prior decision is needed.** BE03c 1298-1302 follows the per-operation
code tables (1288-1297, "The application code lists above are exhaustive per operation") and binds every 03c
transport, so the remaining callers that reach `statusFallback` with a non-catalog code — `cms-composition-production.ts:140`
(CMS-03C-01), `-detail.ts:94`, `-locale.ts:234` (04), `-pattern.ts:189` (02), `-template-errors.ts:48` — carry the
phase-1 major today. BE00's cascade (582 "Supabase Auth/session → 401", 589 "Provider adapter → 502 invalid upstream")
also says the Worker's own `PGRST301` must never become the browser's 401, so the class is real for the 03b callers
(`cms-editorial-production-ports.ts:282`, `-quality-gate.ts:96`) too — but 03b has no 1298-1302 sentence (grep of
`be/03b-*.md`: none), the mapper documents status fallback as the 03b contract (`errors.ts:121-123`), and reviewed
oracles encode it: `cms-editorial-production-quality-gate.test.ts:78-88` (`{code:'PGRST'}`@400 and `{}`@404 →
`target_unreadable`, non-retryable; a guard turns these into the "retryable outage" class of 90-100, a publication
preflight behaviour change), `cms-editorial-production-preview-takedown.test.ts:150-162` (`42501`@401/403 →
`not_permitted`; `{}`@404 → `invalid_request`), and fallback assertions in `cms-editorial-production-errors-branches.test.ts`,
`-errors-coverage.test.ts`, `cms-composition-production-template-errors.test.ts` (grep; not re-read line by line).
One more conflict must be settled first: `cms-composition-production-pattern.test.ts:133-156` pins `PGRST202`@404 →
**503** `DEPENDENCY_UNAVAILABLE {retryable:true}` through a pre-mapper check (`-pattern.ts:184-188`; README 25-27,
written while that RPC was undeployed), whereas the new guard answers the identical payload **500**
(`governed-review-provider-fault.test.ts:16-25`). Recommendation: (a) root decides "RPC missing" = 500 (1298-1302;
recommended for 03c, retiring the stop-gap) or 503 (BE00 584); (b) apply the guard through a composition-scoped
wrapper (`mapCmsCompositionRpcFailure` = guard, then delegate) to the five 03c adapters, RED per adapter, keeping
`mapCmsEditorialRpcFailure`'s signature and 03b semantics; (c) extend to 03b only via `/propagate-decision` adding the
1298-1302 sentence to BE03b and re-ruling the quality-gate and takedown oracles above. The author's choice to stop at
the three Slice 12 transports was correct for this pass.

**(2) Header-before-quota in the template, locale, related-content, pattern-instance and taxonomy term-action
routes? — Yes.** BE00 386 (step 6, "strict Zod validation of path/query/headers/body … before resource
authorization") precedes 387 (step 7, capability and "domain quota"); BE03c 408 puts the Idempotency-Key grammar in
the validation matrix with 400; 1502 orders CMS-03C-01 "parse → authenticate/acting context → template capability →
reserve idempotency". The five routes' comments "BE00 step 8: exact Idempotency-Key and optional quoted If-Match"
(`template-version-routes.ts:177-181`, `locale-routes.ts:206-210`, `related-content-routes.ts:188-192`,
`pattern-instance-routes.ts:195-199`, `taxonomy-routes.ts:195-199`, each after "step 7: capability, then quota" at
123-137 / 135-151 / 127-139 / 126-141 / 128-140) read 388 as the grammar check, but step 8 is the *use* of the
validated values ("hash normalized request and idempotency key; reserve/replay atomically with the domain mutation"),
which happens inside the RPC. Concealment is unaffected for the reason given above (401 at step 4 precedes; the local
403 `CAPABILITY_REQUIRED` is session-only; 404 only from the RPC); the sole effect is that an authenticated caller's
malformed or missing Idempotency-Key / bad If-Match stops consuming one user and one party token. Fix per route: move
the `*HeadersSchema.safeParse` and the If-Match/`expectedVersion` agreement check above the capability check; add
`expect(rateLimit).not.toHaveBeenCalled()` to each route's existing header-refusal tests. These files are tracked
Codex precedents outside this lane's claim, so this is a root-dispatched lane, not a request to this author.

## Requests to root
1. Record the domain-less → 502 ruling as a decision (it departs from the phase-1 recommendation of 500); optionally
   fold in one rule for foreign-token status (500 on governed/pattern vs 502 on taxonomy) and for 502 `retryable`
   (`false` here vs BE00 172 `true`) — informational 3.
2. Dispatch ruling (2) as a lane over the five precedent routes.
3. Decide `PGRST202` 500-vs-503, then dispatch ruling (1) as a lane over the five 03c adapters.
4. Findings 1-2 are small and in this lane's files: fold them into the phase-2 (07/08/10/11) dispatch rather than a
   separate pass.
5. The WIP migration's DETAIL formats match the Worker parsers (verified); its pgTAP suites now exist but are
   unreviewed (informational 6) — route the WIP migration and `phase_02_slice_12_governed_fix*` /
   `governed_submit/030-hash-refusal.sqlinc` to the SQL reviewer before promotion.

VERDICT: CLEAR
