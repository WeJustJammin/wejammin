# Independent review: lane `claude_s12_hardening_4`

Reviewer 2 (independent; read-only except this file). Report SHA `65bd7f6a…ee065dc` matches; HEAD `b16edb54`; all 26
Files-table hashes match. "Slice 12 typed refusals" is now BE03c 1323 (1299 at HEAD; "1304" drifted with spec edits): 403
tokens `capability_missing`, `separation_of_duties`; `refusals.ts:116-202` gives 03C-01/-04/-05 and the reads only the first.

## Clause map (spec -> implementation -> test)
| Clause | Implemented | Tested |
|---|---|---|
| Route-local 403 = `{reasonCode:'capability_missing'}` | `template-context-routes.ts:82`, `template-detail-routes.ts:95`, `template-version-routes.ts:143`, `locale-routes.ts:153`, `related-content-routes.ts:145` | `capability-missing-refusals.test.ts:231-247`; `locale-routes.test.ts:447`; `related-content-errors.test.ts:92`; `-envelope.test.ts:109` |
| Worker 403 filter: token only if 403-status AND on the operation list, else `{}` | `capability-details.ts:18-34` via `template-respond.ts:62`, `locale-routes-support.ts:72`; `related-content-details.ts:67-70` (own `typedReason`); `pattern-instance-details.ts:37-38`; shared `taxonomy-safe-details.ts:41` | `capability-missing-refusals.test.ts:249-270`; `pattern-instance-reasons.test.ts:105-135`; `taxonomy-term-details.test.ts:205-212` (status clause unpinned, F1) |
| Web relays, same rule | `cms-composition-platform-capability.ts:18-34` via `-mutation.ts:161` (also context/detail reads through `forwardedError`), `-locale.ts:87`, `-related.ts:88` | `-capability-missing.test.ts:147-178`; `-mutation-error-relay.test.ts:82-93` |
| BE00 step 7: capability before quota and port | unchanged | throwing ports, `capability-missing-refusals.test.ts:86-94,153-155,219-221` |
| No first-party consumer relies on the old token | browser maps 403 by status only: `cms-template-designer-submit.ts:38`, `templates/new.astro:56`, `templates/[templateKey].astro:105`, `load-pattern-designer-page.ts:90`; no locale/related browser consumer exists | grep of `apps/web/src` non-test sources (confirmed) |
| h3 F1: depth/nodes 422 pointer hardcoded | `cms-composition-production-pattern-errors.ts:21` | `-pattern-reasons.test.ts:128-158` |
| h3 F2: untyped 403 on CMS-03C-02 -> `{}` | `pattern-instance-details.ts:37-38` | `pattern-instance-reasons.test.ts:105-135` |
| h3 F5: composed seam | real adapter + real route | `-pattern-composed.test.ts:58-89` |

## Findings
1. `apps/worker/src/cms-composition/capability-missing-refusals.test.ts:252` and
   `apps/web/src/server/cms-composition-platform-capability-missing.test.ts:170` — minor — the `=== 403` status clause
   of `forbiddenDetails` is unpinned in both apps. The "409 token on a 403" row uses `revision_not_editable`, which is also
   off-list for CMS-03C-01/-04/-05, so the list check drops it either way; no other test imports either filter. Mutation
   "delete `cmsSlice12ReasonStatus(...) === 403`" survives every row. — Why: the mutant would publish contract-invalid
   pairs (`locale_limit_reached`, `key_reserved`, `block_registry_digest_mismatch`, `derived_rule_unknown` on a 403;
   `refusals.ts:94-102`, one status per token). — Fix: one on-list, off-status row per operation (03C-01
   `block_registry_digest_mismatch`, 03C-04 `locale_limit_reached`, 03C-05 `derived_rule_unknown`) expecting `{}`.
2. `apps/worker/src/cms-composition/README.md:28-29,122` — minor — two false pointers in a lane-hashed README. `:28` calls
   `capability-details.ts` "the one 403 filter of the template, locale and related-content routes", but related uses
   `related-content-details.ts` `typedReason`. `:122` says `pattern-update-details.ts` "403 goes through
   `capability-details.ts`", but it imports no such thing (typed reason, then `taxonomy-safe-details.ts`). — Why: misleads
   anyone editing `capability-details.ts` about which routes change (extensibility rule). — Fix: restate both sentences.
3. `apps/worker/src/cms-composition/template-respond.ts:62`, `apps/web/src/server/cms-composition-platform-mutation.ts:161`
   — minor — the template detail read (`cmsTemplateLatestRead`) is filtered by the CMS-03C-01 list, though
   `refusals.ts:199` gives it its own row. The comment (`capability-details.ts:13-14`, Web `:13-14`) only justifies the
   context read, which has no row (`error-catalog.ts:96-97`). Wire output is identical today: both 403 slices are
   `[capability_missing]`. — Why: a future 403 token added to CMS-03C-01 (e.g. `separation_of_duties`) would silently
   become relayable on both reads. — Fix: thread the operation id into the shared `errorResponse`, or pin equality of the
   two 403 slices in a test, then correct the comment.
4. `apps/worker/src/cms-composition/taxonomy-safe-details.ts:41` — minor (undisclosed side effect, test gap) — the
   403-only change also alters CMS-03C-13/14/15. `pattern-update-details.ts:43-45` falls back to this filter for any
   untyped 403, so a session-port 403 `{reasonCode:'CAPABILITY_REQUIRED'}` was relayed on those wires before this lane
   and is `{}` now. That is correct per BE03c 1323, but the report says the "other consumer was the pattern-instance
   fallback". Open item 3 also cites `pattern-update-details.test.ts:50` and `-pattern-update-failure.test.ts:77` as
   already dropping the token; those rows are a 409 and the production 500 mapping, not the 403 relay. The change is
   pinned only at the unit level (`taxonomy-term-details.test.ts:205-212`). — Fix: add a row
   `['CMS-03C-15', 403, 'CAPABILITY_REQUIRED'] -> {}` and correct the report.
5. Report/doc accuracy — minor — (a) the composed test injects `resolveSession` too (`-pattern-composed.test.ts:40-43`,
   honoured at `cms-editorial-production-session-resolver.ts:64`), not "rate limiter only"; the claimed seam stays real.
   (b) "every 03c operation gives its 403 exactly one token, `capability_missing`" (`capability-details.ts:8`, Web `:8`,
   report Scope) overstates: 03C-06/-07 also publish `separation_of_duties` (`refusals.ts:144-157`). The code is list-driven.
6. `capability-missing-refusals.test.ts:241-247` — nit — the null-party row's `cms.template_designer` is also absent for
   locale/related, so it does not isolate that branch there; pinned elsewhere (`locale-routes.test.ts:319-331`,
   `related-content-envelope.test.ts:93-109`).

## Test corrections (judged)
- `locale-routes.test.ts:421,448`, `related-content-errors.test.ts:92`, `related-content-envelope.test.ts:109`: token
  swap with the same matcher strength; spec-cited (BE03c 1323, `refusals.ts:134-143`, `refusals.test.ts` rejects the old
  token). The old token's drop is newly asserted in the new suites. Non-weakening.
- `taxonomy-term-details.test.ts:205-212`: the old pin "keeps CAPABILITY_REQUIRED" contradicts BE03c. It is replaced by
  three `{}` assertions plus `taxonomyTermDetails`. Strengthening.
- Web `-mutation-error-relay.test.ts:82-93`: split into a typed row (relayed) and the old token (`{}`); `{reasonCode:
  'private'}` row kept. Non-weakening. Its `502 retryable` change (`:119`) is not this lane's (not listed; other lane).

## RED claims, pins, vacuity
- Worker 19/35 reconciles with the pre-change filters in `git diff`: 10 route-local rows (2 x 5) + 5 port
  `CAPABILITY_REQUIRED` rows + 4 typed-port rows (3 template routes + locale; related already had `typedReason`).
  Web 10/35 = 5 typed + 5 `CAPABILITY_REQUIRED` rows (all three relays allowlisted only the old token). Plausible.
- `{}` rows not vacuous: each route/relay's typed row proves the same request reaches the port/upstream and the filter.
- Finding-1 DETAIL rows can fail (mental mutation; the lane honestly ran none): copying DETAIL pointers, or "safe DETAIL
  else `/patternId`", yields `/secret-pointer` or a two-element array; `toMatchObject` length/path and `not.toContain` fail.
- Composed test non-vacuous: fetch double called once (`:63`), adapter mapping and route filter real; case 2 omits the
  call assertion but shares the request and session of case 1.

## Other 403 producers (lane Open item 2: resolved, no gap)
- Every bare `failure(403)` in `apps/worker/src/cms-composition/` is a CORS-preflight origin refusal with `{}`
  (`taxonomy-routes.ts:63`, `template-*-routes.ts:42/46/74`, `locale-routes.ts:64`, `related-content-routes.ts:63`,
  `pattern-instance-routes.ts:64`, `pattern-definition*-routes.ts:51/57`, `pattern-update-response.ts:116`,
  `taxonomy-definition-routes.ts:50`, `governed-review-preflight.ts:84`); h3 precedent, not a capability refusal.
- Capability gates already emit `capability_missing`: `taxonomy-routes.ts:143` (CMS-03C-03 list filter),
  `taxonomy-definition-shared.ts:196,210` (+ `-response.ts:28`, reads covered), `governed-review-ports.ts:197,204`,
  `pattern-definition-ports.ts:160`, `pattern-update-ports.ts:154`. No `CAPABILITY_REQUIRED` in any 03c non-test source.
- Production adapters' re-check 403s are detail-less (`cms-composition-production.ts:110,201`, `-detail.ts:53`,
  `-locale.ts:192`, `-pattern.ts:137`): unreachable behind the identical route gate; inconsistency with related/pattern-def/
  pattern-update adapters (which emit the token) only.

## Checks that passed
- Security: relayed token only from `CmsSlice12ReasonCodeSchema`, no other member (`secret` rows); untyped/foreign 403 ->
  `{}`; no PII/provider text; other status branches untouched by this lane.
- Conventions: new files 34/34/271/179/89 lines; `locale-routes.ts` 297; `-mutation.ts` 321 and `locale-routes.test.ts`
  889 pre-existing (disclosed). No `any`/TODO; `as unknown as CmsTemplateDependencies` has two sibling precedents.
  Duplication (h3 F4) now Worker+Web copies plus four per-operation predicates; disclosed, contracts frozen.

## Runs (UTC 2026-10-15, pinned PATH, `flock -s /tmp/wejammin-quiet.lock`)
| time | what | result |
|---|---|---|
| 11:36 | Worker: lane's 8 test files + `pattern-update-details`, `template-routes`, `pattern-instance-routes`, `taxonomy-routes` | 12 files, 248/248 |
| 11:36 | Web: capability-missing, locale, related, 4 mutation suites, `components/cms-composition`, `pages/api/v1/cms/templates` | 19 files, 132/132 |
| 11:37 | `tsc --noEmit` apps/worker | exit 0 |
| 11:37 | `astro check` apps/web | 2 errors, 1897 files; file count moving (concurrent Web lane); lane's Web files hash-unchanged |
| ~11:40 | `astro check` apps/web rerun | 1902 files, 0 errors, 0 warnings, 178 hints |
| 11:43 | Worker shared-filter blast radius: `pattern-update*`, `template*`, `related-content*`, `locale*`, `taxonomy-term*`, `production-pattern*` | 31 files, 782/782 |
Not re-verified (outside allowed execution): full Worker/Web suites, eslint, prettier, step-up inventory attribution.

## Out-of-scope observation for root (not a lane finding; not verified in depth)
CMS-03C-01's list carries `block_registry_digest_mismatch` (409, DEC-186), but grep finds it only in pattern migrations
`20261014020400`/`110300`, and `template-respond.ts:63-71` relays only the version pair at 409: DEC-186 looks unimplemented
for templates.

VERDICT: CLEAR
