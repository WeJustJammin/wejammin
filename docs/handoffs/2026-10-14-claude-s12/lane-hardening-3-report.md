# Lane report: claude_s12_hardening_3

## Status
GREEN for this lane's scope. Items 1-4 done. One full-Web-suite failure belongs to another lane (see Open items).

## Scope
Brief `briefs/hardening-3.md` items 1-4, root ruling 3 binding.

## Progress
- Item 1 (Web relay typed tokens) DONE. RED first (new `cms-composition-platform-pattern-reasons.test.ts`: 9 failed,
  plus the corrected CAPABILITY oracle). New `apps/web/src/server/cms-composition-platform-pattern-details.ts`
  (`patternInstanceReason`: exactly one `CMS_SLICE_12_OPERATION_REASONS['CMS-03C-02']` token on `cmsSlice12ReasonStatus`;
  `patternInstanceViolations`: <=50 `CmsViolationSchema`-valid pointers, message rebuilt as 'The value is invalid.').
  `cms-composition-platform-pattern.ts` `safeDetails` uses it: typed 403/409/422 -> `{reasonCode}` only; 422 without a token
  -> violations (FE03 1112 `/slotPath`, `/overrides`, and the item-3 `/patternId`); the pre-contract `CAPABILITY_REQUIRED`
  is dropped. Browser mapper/copy: no first-party pattern-instance form or mapper exists in `apps/web/src` yet
  (grep `pattern-instances` hits only the relay and its tests; the form belongs to the Web patterns lane), so nothing to change.
- Item 2 (Worker route-local 403) DONE. RED: `pattern-instance-reasons.test.ts` "answers its own capability refusal with
  capability_missing" (got `CAPABILITY_REQUIRED`). `pattern-instance-routes.ts:144` now `capability_missing`; the response is
  accepted by `CmsCompositionRefusalDetailsSchema`.
- Item 3 (ROOT RULING 3) DONE. RED: production reasons test (3 failures, got scrubbed 500). `placementRpcError` now answers
  `pattern_depth_exceeded` and `pattern_nodes_exceeded` as 422 `COMPOSITION_VALIDATION_FAILED` with one violation
  `{path:'/patternId', code:'invalid', message:'The value is invalid.'}` and NO `reasonCode`. The pointer is the producer's own
  (`20261014110100:38`, `110250:43` both raise `detail = '["/patternId"]'`) and is hardcoded, never copied from DETAIL.
  Interpretation: `pattern_cycle` is already in the closed CMS-03C-02 list (BE03c 1304, 409 `reasonCode`) and the ruling
  forbids inventing reason codes, so it stays a 409 with `reasonCode: 'pattern_cycle'` (existing oracles unchanged). Only
  the two tokens previously asserted as 500 changed; the old 500 assertion was replaced (see Test corrections).
- Item 4 DONE. READMEs: `apps/worker/src/cms-composition/README.md` names `pattern-instance-details.ts`;
  `apps/web/src/server/README.md` names `-pattern-details.ts` and `-dependency.ts`. Locale/related relay tests now pin the
  status per row (upstream 502/503/504 keep theirs, oversized 201 = local 502) instead of `toContain`.

## Files
| path | lines | SHA-256 |
|---|---|---|
| `apps/web/src/server/cms-composition-platform-pattern.ts` | 276 | `ed40a9a0feecaaf5a8d5cd75daf0156423d03799fbbbee39af93c06bd46e8100` |
| `apps/web/src/server/cms-composition-platform-pattern-details.ts` | 59 | `95e2f8d55b00c8caa58a5efce3379fec0a7832c978ef75b5aaf4a679169cc75b` |
| `apps/web/src/server/cms-composition-platform-pattern-reasons.test.ts` | 126 | `f74353d20335d4da48d14ca3b77c9b838299b031e5a3dafbc83ad0236dd256ba` |
| `apps/web/src/server/cms-composition-platform-pattern.test.ts` | 245 | `916286505c6d750ba41be7d3b8b7e21a84d59989413ba8b82f98d8f2f617be57` |
| `apps/web/src/server/cms-composition-platform-locale.test.ts` | 361 | `15dd9392c757851569af6456f7470422505c42a0d4461fce102d8134711dd877` |
| `apps/web/src/server/cms-composition-platform-related.test.ts` | 346 | `32a899f6933d975830b33f7430091a8dfed96be8b41ae212a6deadf529cad51b` |
| `apps/worker/src/cms-composition-production-pattern-errors.ts` | 88 | `4b33c88540947c952a4bfcadd4369d664da3010ee3dd37562b13d101309eb006` |
| `apps/worker/src/cms-composition-production-pattern-reasons.test.ts` | 170 | `deabb8e0d60b7c3994b9ed0ce027a835591bce54781455f58e334c6b40f6aabc` |
| `apps/worker/src/cms-composition/pattern-instance-routes.ts` | 291 | `c99db3395a86a3cb7608f1368fa50b66bc3a63b2de2ee277a0254260c757dfe8` |
| `apps/worker/src/cms-composition/pattern-instance-reasons.test.ts` | 133 | `c60ca9eecaaf64c1776a04c973e1b4232e766ddc433a6a5ddba56c45e34fd361` |
| `apps/web/src/server/README.md` | 221 | `ae5b5be8308ca8eebeaf18786bb8a96904a3a36b9361292717af0650b824b228` |
| `apps/worker/src/cms-composition/README.md` | 116 | `d2931b2c7c44064be110c49d3a037c70b51c5e7d5e41eba7a2fa36c8e22e5785` |

(`apps/worker/src/cms-composition/README.md` also carries other lanes' uncommitted edits; this lane added only the `pattern-instance-details.ts` sentence.)

## Runs
| what | result |
|---|---|
| RED web reasons + corrected pattern oracle | 11 failed / 23 passed before GREEN; 34/34 after |
| RED worker production reasons + route reasons | 4 failed / 21 passed before GREEN; 94/94 across 8 pattern files after |
| focused set (24 files: worker pattern production/route, web composition relays, `pages/api/v1/cms/compositions`) | 24 files, 389/389 |
| full Worker (`vitest run apps/worker`) | 627 files, 10,856/10,856 |
| full Web (`vitest run apps/web`) | 467 passed / 1 failed file of 468; 5,330 / 5,331 tests. Failure: `components/step-up-required.inventory.test.ts` lists `server/cms-pattern-platform-details.ts` (Web patterns lane's new file, reads `401`, not classified). Not this lane's file. |
| `tsc --noEmit` apps/worker | 0 errors |
| `astro check` apps/web | 0 errors, 0 warnings |
| eslint --max-warnings=0, prettier --check, `git diff --check` on all touched files | clean |

## Test corrections
- `apps/web/src/server/cms-composition-platform-pattern.test.ts` (403 row): upstream/expected `{ reasonCode: 'CAPABILITY_REQUIRED' }`
  -> `{ reasonCode: 'capability_missing' }` (BE03c 1304 token; `refusals.test.ts:203-212` says `CAPABILITY_REQUIRED` is not a 03c
  application token). The dropped-`CAPABILITY_REQUIRED` case is asserted in the new reasons test.
- `apps/worker/src/cms-composition-production-pattern-reasons.test.ts`: the loop asserting `pattern_depth_exceeded` and
  `pattern_nodes_exceeded` -> 500 now asserts them as 422 with the `/patternId` violation (root ruling 3, BE03c 378). The other
  tokens in that loop (`review_not_open`, `locale_limit_reached`, `separation_of_duties`, `not_a_token`) still assert 500; I added
  `diff_too_large`.
- `cms-composition-platform-locale.test.ts`, `-related.test.ts` (hardening-2 tests): `toContain([502,503,504])` -> per-row status.
- Added: `cms-composition-platform-pattern-reasons.test.ts` (new), plus 2 tests in `cms-composition/pattern-instance-reasons.test.ts`
  and 3 in the production reasons test.

## Spec citations
BE03c 378 (graph validation 409/422), 408, 1298-1302, 1304; FE03 1112; BE00 172; DEC-186; root ruling 3.

## Open items / BOUNDARY
1. Step-up inventory failure above: the Web patterns lane must classify `server/cms-pattern-platform-details.ts` in
   `step-up-required.inventory.test.ts` (or avoid the literal `401`).
2. Depth/nodes violations carry violation `code: 'invalid'`, so the browser cannot tell depth from node-count; the BE03c 1304 list
   gives CMS-03C-02 no reason token for them. If root wants the distinction, the contract operation list needs the two tokens first.
3. The same `CAPABILITY_REQUIRED` split remains in `locale-routes.ts`, `related-content-routes.ts` and the Web locale/related/mutation relays
   (other lanes, review finding 2); unchanged here.
4. Review finding 3 (5xx policy across the 03c adapters) not in this brief; untouched.
5. No first-party browser form/mapper for CMS-03C-02 exists in `apps/web/src` to update; the Web patterns lane owns that UI and can
   now rely on the relayed `details.reasonCode` / `details.violations`.

## Requests to root
- Dispatch an independent review of this lane.
- Tell the Web patterns lane about Open item 1.
