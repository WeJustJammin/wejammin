# Independent review: lane `claude_s12_hardening_3`

Reviewer: independent (did not author); read-only except this file. Report `lane-hardening-3-report.md` SHA
`97346d4a…f1c2b` (matches). HEAD `b16edb54` (verified). Template item 5 (re-hash) skipped per root; line counts
spot-checked and all match. Producer is promoted (`supabase/migrations/20261014110000..110400`).

## Clause map (spec -> implementation -> test)
| Clause | Implemented | Tested |
|---|---|---|
| BE03c 1304 + `CMS_SLICE_12_OPERATION_REASONS['CMS-03C-02']` (7 tokens), one status each, `{reasonCode}` only | Worker `production-pattern-errors.ts:73-81`, `pattern-instance-details.ts:15-38`; Web `-pattern-details.ts:24-39`, `-pattern.ts:100-101` | prod `-reasons.test.ts:70-82`; route `pattern-instance-reasons.test.ts:39-57`; Web `-pattern-reasons.test.ts:45-60` (all three also parse `CmsCompositionRefusalDetailsSchema`) |
| Off-status / off-list / case-variant token dropped | same | Web `:62-77`; route `:59-72`; prod 500 `:137-148` |
| Route-local 403 = `capability_missing` (BE03c 1304; `refusals.test.ts` rejects `CAPABILITY_REQUIRED`) | `pattern-instance-routes.ts:144` | route `:74-103` (port throws if reached: capability before port) |
| Web drops `CAPABILITY_REQUIRED` | `-pattern.ts:102` | Web reasons `:70` |
| Root ruling / BE03c 378: depth/nodes -> 422 `COMPOSITION_VALIDATION_FAILED`, one violation at hardcoded `/patternId`, no reasonCode | `production-pattern-errors.ts:16-21,63-72` | prod `:102-135`; route `:105-124`; Web `:88-114` |
| `pattern_cycle` stays 409 + reasonCode | list membership | TYPED rows in all three layers |
| FE03 1112: 409 `revision_not_editable`, 422 `pattern_version_not_active`/`pattern_incompatible`, 422 at `/slotPath`/`/overrides` reach the browser | Web relay above + `patternInstanceViolations` (<=50, `CmsViolationSchema`, fixed message) | Web `:45-60,88-125` |
| Stale-CAS 409 keeps only the version pair | Web `-pattern.ts:107-113`; Worker `sharedDetails` | Web `:79-86`; route `:126-132`; prod `:84-100` |
| BE03c 1298-1302 prose/hint/non-P0001 -> scrubbed 500 | `production-pattern-errors.ts:57-59,83` | prod `:150-161` |

Producer verified: `pattern_depth_exceeded` `20261014110100:38`, `nested_pattern_not_active` `:62`, `pattern_cycle`
`:65`, `pattern_nodes_exceeded` `20261014110250:43`, all `P0001` + whole-message token + `detail '["/patternId"]'`;
PostgREST answers P0001 as 4xx, so the `status < 500` token branch is the live path. Contract check: depth/nodes are
422 tokens globally but absent from the CMS-03C-02 list (present only on CMS-03C-12), so "no invented reasonCode" is
the only contract-valid 422; `pattern_cycle` is a 409 token on that list and BE03c 1304 says the 409 of these
operations is "a stale CAS operand, a cycle or a collision", so keeping it 409 is correct, not a ruling deviation.
Worker -> Web seam: Worker emits `{reasonCode}` alone, or <=16 violations with regex-checked path/code and the fixed
message, or the version pair; the Web allowlist accepts each shape and is no looser (SafePointer `~[01]`, max 50).
Web message/code check is unchanged; `retry-after` handling untouched.

## Findings
1. `apps/worker/src/cms-composition-production-pattern-reasons.test.ts:108,129-135` — minor — the "hardcoded,
   never copied from DETAIL" property is unpinned: both fixtures carry `/patternId` in DETAIL, so a mutation that
   copies safe DETAIL pointers (`violationsFromDetailText`) passes both tests; `:133` is vacuous under hardcoding. —
   Why: the ruling names a hardcoded pointer; a future refactor to "reuse the producer pointer" would go unnoticed and
   could relay an arbitrary producer pointer. — Fix: add DETAIL `'["/secret-pointer"]'` and `null` rows expecting
   exactly `[{path:'/patternId',…}]` and no `secret-pointer`.
2. `apps/worker/src/cms-composition/pattern-instance-details.ts:36-37` — minor — a 403 without a typed reason falls
   back to `sharedDetails` (`taxonomy-responses.ts:47-50`), which still allowlists `CAPABILITY_REQUIRED` on the
   CMS-03C-02 wire. Not reachable in production today (route-local is now `capability_missing`; the production session
   resolver's 403 carries `{}`, `cms-editorial-production-session-resolver.ts:87`), and the Web relay now drops it,
   so end-to-end it is sealed. — Why: the Worker allowlist itself still admits a non-03c token for this operation;
   brief item 2 fixed the producer of the split, not the filter. — Fix: return `{}` for an untyped 403 in
   `patternInstanceDetails`; route test with a session port answering 403 `{reasonCode:'CAPABILITY_REQUIRED'}`.
3. `apps/web/src/server/README.md:170-171` — minor — the paragraph this lane extended still says "the named private
   insertion RPC is not yet implemented"; `cms_insert_pattern_instance` is promoted (`20261014110300`). — Fix: drop or
   restate the sentence.
4. `apps/worker/src/cms-composition/pattern-instance-details.ts:15-29` and
   `apps/web/src/server/cms-composition-platform-pattern-details.ts:24-39` — minor (extensibility) — the same
   token/status/operation-list predicate is written twice (a third copy of the list check is in
   `production-pattern-errors.ts:73-78`). Contracts are frozen, so the lane could not extract it. — Fix (root, when
   contracts open): one contract helper `cmsSlice12OperationReason(operationId, status, value)`.
5. Seams — minor — no test drives the production adapter through `createCmsPatternInstanceApp` (and none through the
   Web relay) for a typed refusal or the depth/nodes 422; each layer is tested with the neighbour's exact shape, and I
   confirmed by reading that `validPlacementResult` and `failure(statusOf(...), details)` pass details unchanged. —
   Fix: one composed Worker test (fetch double -> production deps -> route) for `revision_not_editable` and
   `pattern_nodes_exceeded`.

Spec note (not a lane defect; author's open item 2 is accurate): depth/nodes 422 `{/patternId, invalid}` is
byte-identical to the producer's generic `VALIDATION_FAILED` at `/patternId` (`20261014110250:46`, zero roots), so the
FE03 form cannot tell "too many roots" from "no roots". Only a contract change (add the two tokens to the CMS-03C-02
list) can distinguish them; root ruling.

## Test corrections (judged)
- Web `cms-composition-platform-pattern.test.ts:110-113` 403 oracle `CAPABILITY_REQUIRED` -> `capability_missing`:
  spec-cited (BE03c 1304, `refusals.test.ts`), same strength, and the drop of the old token is newly asserted
  (reasons `:70`). Non-weakening.
- Worker prod reasons: depth/nodes 500 -> 422 is mandated by the root ruling and asserts more (status, code, exact
  violation, absence of reasonCode) than the old `{500, details:{}}`; the remaining 500 loop keeps every other row
  and adds `diff_too_large` (CMS-03C-14 only). Non-weakening; see finding 1 for the one property not re-pinned.
- Locale/related `toContain([502,503,504])` -> per-row exact status: strengthening (closes review-hardening-2 #5).

## Checks that passed
- Security: Web typed reason comes only from the `CmsSlice12ReasonCodeSchema` enum; violations are rebuilt member by
  member with a fixed message, pointer and code schema-checked, capped at 50; untyped 403 -> `{}`; no PII/secret path
  (`secret` members asserted absent). Capability gate precedes rate limit and port (BE00 step 7), test proves port
  not called. Whole-message token selection kept.
- Conventions: all touched sources <=300 lines (routes 291, Web relay 276); no `any`, no `TODO`; READMEs now name
  `pattern-instance-details.ts`, `-pattern-details.ts`, `-dependency.ts` (closes review-hardening-2 #4).
- Browser mapper/copy: confirmed no CMS-03C-02 browser form/mapper exists in `apps/web/src` (only the API route,
  relay and tests reference `pattern-instances`), so item 1's "if the form consumes it" had nothing to update.
- Not re-verified (outside allowed execution): full Worker/Web suites, tsc, astro check, eslint, prettier, and the
  claimed step-up inventory failure belonging to the Web patterns lane.

## Runs
`pnpm vitest run` under `flock -s /tmp/wejammin-quiet.lock` on the 6 touched test files plus
`pattern-instance-routes.test.ts` (test of the touched route): 7 files, 79/79 passed, 6.8 s.

VERDICT: CLEAR
