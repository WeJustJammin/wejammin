# Lane report: claude_s12_web_patterns (Web surface, FE03 pattern designer)

## Status
GREEN for the lane scope, with one root-owned item outside the claim (Requests to root 1: the AC1127 step-up inventory guard). Worktree
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, HEAD `b16edb54`, finished 2026-10-14 22:30 local.

## Scope
Delivered: protected pages `/app/cms-content-modeling/patterns/new` and `/patterns/:patternKey` (FE03 :1067); `CmsPatternVersionDesigner` (FE03 :883) over an
ordered nested `<ol>` of `PatternNode`s with explicit add / remove / move earlier / move later controls, `compatibleTypeIds` from the context selectors,
the server registry digest and `nodeCount`, cycle / depth / node-count refusals, successor `expectedVersion`; a latest-version comparison after a conflict
or an unknown outcome (rebase or discard, never an automatic overwrite); first-party proxies for CMS-03C-12 (`POST /api/v1/cms/patterns/versions`) and
`cmsPatternLatestRead` (`GET /api/v1/cms/patterns/{patternKey}`); `CmsGovernedPatternPanel` mounting the Submit-for-review action of
`CmsGovernedReviewPanel` on the saved-pattern page; nav entry "Pattern designer" in the `/app/cms-content-modeling` primary navigation. The selector
context is read through the existing `cmsTemplateContextRead` proxy. Nested-pattern picker: disabled control plus BOUNDARY (below).

## Design decisions
1. Zero zod in the browser (FE03 AC261), as the definition-reviews lane did. The tree rules (`pattern-tree-rules.ts`), the CMS-03C-12 reason vocabulary and
   catalog codes (`pattern-designer-reasons.ts`) and the lifecycle vocabulary are written out; each has a drift-guard test against the generated contract
   (`PatternBlockTreeSchema` accept/refuse parity over 25 cases plus the 512/513-node boundary, `CmsPatternKeySchema`, `CMS_SLICE_12_OPERATION_REASONS`, `cmsCompositionCatalogCode`,
   `CMS_DEFINITION_VERSION_STATES`). `pattern-designer-static-closure.test.ts` proves both islands reach no zod, barrel or lazy entry statically. The strict
   contract parse lives in the same-origin proxies, which only relay a bounded strict resource bound to the request.
2. The Worker projects 400/422 violations as `path: '/'` (`pattern-definition-response.ts`) and a typed refusal carries only `details.reasonCode`, so no server
   refusal names a node. Node paths therefore come from the designer's own pre-submit check (grammar, duplicate sibling key, depth, 512 written nodes,
   props bounds, unknown block, no block chosen), which names the node by number ("Node 1.2") and links the error summary to the control. A server tree
   refusal (cycle, expansion bounds, nested-pattern state) is shown at the tree, plus one honest "may be the cause" link per nested pattern node the tree
   holds. The form never invents a pointer. See BOUNDARY 2.
3. Key policy: the `Idempotency-Key` is bound to the serialized body and reused only while the outcome is unknown (network loss, an unverifiable 2xx, a 5xx the
   proxy marks `x-cms-editorial-outcome: unknown`); every definite answer drops it, so a later retry cannot replay a stale refusal. A second activation while a
   submit is in flight is ignored (Enter in a field included).
4. Proxy admission is strict (same-origin, CSRF double submit, JSON media, bounded `Idempotency-Key`, exact strong `If-Match` that names `expectedVersion`, no
   query, bounded body, strict parse) and every error is rebuilt from the composition catalog and the operation's reason list (`cms-pattern-platform-details.ts`),
   never forwarded. 5xx details are `{dependencyClass:'cms_composition', retryable:true}` (BE00 172), reusing hardening-2's `compositionDependencyDetails`. The
   reserved keys `context|versions|selector|new` are refused by the key-read proxy (400) and by the page loader before any read.
5. Pages are thin: `load-pattern-designer-page.ts` is a tested loader (redirect 303 on 401 even when the other read answered 404, 400 for bad/reserved key
   before any read, disclosure-safe 404, 403, 429 wait, unverified body => 502 notice) and only the selector context (active types, registered blocks), the CSRF token and,
   in edit mode, the verified latest detail reach the island. That detail is trimmed to exactly the members of `PatternLatestDetail` (id, version, contentHash,
   state, patternKey, patternVersion, compatibleTypeIds, nodeCount, blockRegistryDigest, blockTree); `id` and `contentHash` are the identity the conflict check
   uses (fix pass m4), so none is unused. Only five facts of the served version reach the panel island. (Earlier text said only types, blocks and the token
   reach the island; that was false in edit mode.)
6. Accessibility: persistent labels (every control names its node number), 44x44 targets (checked at 375 px: no horizontal scroll, 0 targets under 44),
   the tree is an `<ol>` with "Level n of 8" text, the result region is `role=alert|status` with a named result heading that takes focus, polite live
   announcements for add / move / remove, focus is returned to a usable control after a move and to the new node's key after an add.

## Files (path under apps/web/src, lines, SHA-256; recomputed at the end of the fix pass; edited existing files marked)
| path under apps/web/src | lines | sha256 |
|---|--:|---|
| components/cms-governed-review/CmsGovernedPatternPanel.test.tsx | 140 | 9ec73fb6ad16215aa83449ef105b157c06732287ab995f59b61919ce57b9cc9b |
| components/cms-governed-review/CmsGovernedPatternPanel.tsx | 71 | 8bf6f5137e806bca7f1447eb8dcdcb7b2ee655f754f27b2751453ab7051c1a47 |
| components/cms-pattern-designer/CmsPatternConflictPanel.tsx | 93 | da48f9c97b33ff36e70cfb8a765b7671895d17067ca03bd75c7face986bdb0c0 |
| components/cms-pattern-designer/CmsPatternFields.tsx | 111 | a243fa52f0e8f792c6652fe59d01b9dd2775eae4667a7a095521605653c566e6 |
| components/cms-pattern-designer/CmsPatternNestedPicker.tsx | 35 | 70748ec354ff318279ca69bd866597df1db63434e0c4a6d14beb5bb851ddfae7 |
| components/cms-pattern-designer/CmsPatternNode.tsx | 182 | a4f5f8af967afe09c013594ba6b25d948f92363da8073a83ff73b912b98b6965 |
| components/cms-pattern-designer/CmsPatternStatus.tsx | 201 | 248c4875fb34b39951d136ddfd04cf1c75ae744b1181a78ef1d8fe1a82b2c447 |
| components/cms-pattern-designer/CmsPatternTree.tsx | 54 | edcd827a0dea98d1d2f499bffcfad4064d5a1e55c5bc455eb21975e751b1f5d4 |
| components/cms-pattern-designer/CmsPatternVersionDesigner.results.test.tsx | 349 | 368a2f98403d2703873ceef98392e8891df31239799740e17a3933a18d2f80bf |
| components/cms-pattern-designer/CmsPatternVersionDesigner.test.tsx | 363 | 496d94d7c5d0053f85e3d6ecde9627b4747895e9b5b2ca15129e9346f7be697a |
| components/cms-pattern-designer/CmsPatternVersionDesigner.tsx | 175 | bb991e7075647f62591681345de93a9523a420ff5ce633cd2472bf1af18c227e |
| components/cms-pattern-designer/CmsPatternVersionFacts.tsx | 53 | 48b7dcb1697402a654fe304c69905e67627bfe283c421a13d68307c09b3ed302 |
| components/cms-pattern-designer/README.md | 81 | a353af86bbee23bfd602b08b25d772e0e84f747846788f94a0f145ca63d20020 |
| components/cms-pattern-designer/cms-pattern-designer.css | 131 | b2af84a7b87f362344efd63a8df0e307ce7435701f79bbf50d1fa49f033d78f3 |
| components/cms-pattern-designer/load-pattern-designer-page.test.ts | 234 | 368f84bd813412d53a0279157294de1a6712a76b38c268f111020e35a1213a97 |
| components/cms-pattern-designer/load-pattern-designer-page.ts | 233 | 286db75a5332676cb5f12ec4a97d37076a0b4dd1171df85735747ffff65decb5 |
| components/cms-pattern-designer/pattern-designer-copy.ts | 62 | 8490671d3fa4d2fe33d9b043834d6ed54c4fbb2693d0f2b82cb9ed3f6b7ef233 |
| components/cms-pattern-designer/pattern-designer-ids.ts | 40 | 664077180719144b7819da4af94826e4bd28920a26f54552cc6c49a77f453ecf |
| components/cms-pattern-designer/pattern-designer-issues.ts | 29 | d385ad3423b809863e0bb05f35d0392748a2d2b132cd7075f2481fc872d1a3f4 |
| components/cms-pattern-designer/pattern-designer-reasons.test.ts | 54 | 93f759cc0ff9b452e1f2c63ffc40e97529d7c9125c31c97e664e96c850024525 |
| components/cms-pattern-designer/pattern-designer-reasons.ts | 80 | 14243dc132af0a663f08f66199b1d6b50051fd4d6b69d7ba47c44b07531e6f4b |
| components/cms-pattern-designer/pattern-designer-refusal-items.test.ts | 103 | 692c159b7de2d9972fa411aa0336b8ec27545473f539db7d63fc03870e43161a |
| components/cms-pattern-designer/pattern-designer-refusal-items.ts | 46 | 8fde34f0802b4c14f9bffc55fec0fe58987086e0628b68b9f4314ac94d8c1ec2 |
| components/cms-pattern-designer/pattern-designer-request.test.ts | 237 | 5a7850eecd6d41cde0d3461ed58103494e37c4b5a7375e076ace649b2f7496c6 |
| components/cms-pattern-designer/pattern-designer-request.ts | 213 | be827d88d957cadc3a5f3733a2c6c9e9a768016da0367005b78f7a32be93c12d |
| components/cms-pattern-designer/pattern-designer-static-closure.test.ts | 53 | b2bdc8bf1184fd3dc8e5616dba658f00f29f533ecf976e356809c8ca34dcdde2 |
| components/cms-pattern-designer/pattern-designer-submit.test.ts | 264 | 494df7821596b873948f9cdae1b0e0b6e0736be900a739bb22e15633539e66c3 |
| components/cms-pattern-designer/pattern-designer-submit.ts | 203 | 6b7e578c957754bbccd2c60d0e6c44492eede17d6374346d58ce7b7a72ff8c25 |
| components/cms-pattern-designer/pattern-designer.test-support.ts | 90 | 4bcf394cebe83ffbb5b58341b5e6434f9a3bcea53b9fed138c3804bb8306dd49 |
| components/cms-pattern-designer/pattern-latest-read.test.ts | 129 | 9d9f3ad6bac89cdf36c1013bb3684486651b48eff0e196019fdfe46e61dd1aa7 |
| components/cms-pattern-designer/pattern-latest-read.ts | 145 | 4962495e4ae56259e69e2843740cb6b74608c241a0f14a0d34c993825f1ae01b |
| components/cms-pattern-designer/pattern-tree-rules.test.ts | 268 | 7f4579c230327023d551d396339fa6ebc69f969b2c797eaa86794d3afdb727ef |
| components/cms-pattern-designer/pattern-tree-rules.ts | 270 | 35d20fb78089f6ab9465206c5caa134edc34c88486abd472f2bf16af112e7674 |
| components/cms-pattern-designer/pattern-tree-state.test.ts | 237 | 5c6bdc116faa7fbb6b3d248ea7a3245f7b365de818ae02697392d8a3ce44e7c8 |
| components/cms-pattern-designer/pattern-tree-state.ts | 276 | 42802c6d3dc3f3cc2a0362984d0ef08197a64be4c79510e09589c125ba82cf65 |
| components/cms-pattern-designer/static-closure.test-support.ts | 50 | 93f1919c05fbbd15e0ae9983b98237380217c49c24902f7bda1f6070f4dd575f |
| components/cms-pattern-designer/use-pattern-conflict.ts | 81 | b297b2f0a730c16744e42879766f5006c976e5409f3aa90055eb4fb69695b43e |
| components/cms-pattern-designer/use-pattern-designer.ts | 234 | 797c97ed98ff1879524b431bf8aa112bbd260335b7e3606bd1261770fdcd3d16 |
| components/cms-pattern-designer/use-pattern-tree-editor.ts | 146 | 50cfa29c2e0788aa38fa27a2c5874490666c77906513a0a294dcc6be4f474fd2 |
| pages/api/v1/cms/patterns/README.md | 36 | 6a894cf43302724abad2682aeac33c15a0c8c031128cbc2b27a3ead3dee8edda |
| pages/api/v1/cms/patterns/[patternKey].ts | 14 | 7dfa50a3c0438c0931b93f9e63b651ed85c177f4d92a057c40c52df4f81282f9 |
| pages/api/v1/cms/patterns/patterns-routes.test.ts | 90 | d21d80b43c076735365acbc51e5d8c3fa916aff3bd6aeef97ece8fed663ad856 |
| pages/api/v1/cms/patterns/versions.ts | 10 | 27a3f6600efb149fedbc2bb0bc291402c8b208f48bcd402b94355567e4916cd0 |
| pages/app/cms-content-modeling/patterns/README.md | 37 | 1678b5e95d0e0f186a982b7da0ac286411897ba3981058ce41670dcdc11a024e |
| pages/app/cms-content-modeling/patterns/[patternKey].astro | 86 | e3c7dc8a9eb5bed9d01a49c528b97a51a398ff00ec12731d51e2910fa9688c9f |
| pages/app/cms-content-modeling/patterns/new.astro | 60 | 6cb91d55f3c097e0f5351439879d9a1364fffde3729166911d8cc1623a359846 |
| pages/app/cms-content-modeling/patterns/pattern-pages.test.ts | 75 | 99621ff3ed35f0e322798c8cbe0b29432061a3bdee17fdb2429221269528f4e6 |
| server/cms-pattern-platform-details.ts | 177 | 4d7ee1332057662ef37330a3d293e99efc1bc171f186253e1e4fe2ee6335b1b9 |
| server/cms-pattern-platform-errors.test.ts | 327 | 70411c123e550a56299ef7fc795f521aa409321d73eb67ab766a195c79564fa2 |
| server/cms-pattern-platform-errors.ts | 106 | 111f75b2616b655b500991698c0d706523abcf94905c30046138cded0b82a321 |
| server/cms-pattern-platform-latest.test.ts | 195 | 7e37d3531b8934029ecc863659f39b229b8dd927962a83359299b476cf8f75dc |
| server/cms-pattern-platform-latest.ts | 83 | 3dee68280f685bc85a900003954b45e226b702e0611fd652eaa9d2859234f3f8 |
| server/cms-pattern-platform-write.test.ts | 291 | 3ffeac68cbad9c2530477ec2f48bdc761c8cff629a18f93892f89a795e99e502 |
| server/cms-pattern-platform-write.ts | 162 | 3942f51c05aca83529a949546f9d5dcd532767828df0efb119c9607a8fc1fd69 |
| server/cms-pattern-platform.test-support.ts | 158 | 87708b8b9908cc65bb139bbc014aca73b1a964c15328fed812b522a3c7fe87bb |
| pages/app/cms-content-modeling/index.astro (edited) | 171 | d79b40e2f68988b0f2287dc03919efcffc900e8dd21b3fc2e517f5e80d7cfa5a |
| components/cms-governed-review/governed-review-mounts.test.ts (edited) | 121 | e2759c8eff2857e1acbf319e8c24bc643c05e5841d4438f965ea9f74b41516be |
| components/cms-pattern-designer/CmsPatternReview.tsx | 116 | 72ee189d4969611ee911e40f8954946087ce379a25d42fbf80a961f21b0872fe |
| components/cms-pattern-designer/CmsPatternVersionDesigner.reconcile.test.tsx | 262 | 64e4eceb69e4c2245abaaac9e33cc6801cabd62c695763f9590bc91a7c54a52d |
| components/cms-pattern-designer/CmsPatternVersionDesigner.review.test.tsx | 140 | ec436d570c59901bbf3c767073d852d6e6f48458a9e80262f6ddecbc199b9808 |
| components/cms-pattern-designer/CmsPatternVersionDesigner.stale-type.test.tsx | 111 | 7bcd5115cef65484730cd783fbbb27692b4612e438ed4e5645e1404d970ce4ff |
| components/cms-pattern-designer/pattern-outcome-reconcile.test.ts | 142 | 3bf3378c89a48aa59d8524f328349b8a6618be0ce69f5c9c429895c53a52cbf4 |
| components/cms-pattern-designer/pattern-outcome-reconcile.ts | 85 | 472794b8aa92c99e5c3e7c0f9d9886bda9138be64f2ce54be45b66c0462990b4 |
| components/cms-pattern-designer/pattern-review-outline.test.ts | 164 | b24c9633853ebf410cc78ed5c2e01e74ce9d427208626495a1bcbbe4d500c31a |
| components/cms-pattern-designer/pattern-review-outline.ts | 107 | cf55bff299c038ef438510498d71e5169a55247335b6a0298dd884734aa5361d |
| components/cms-pattern-designer/pattern-tree-rules.grammar.test.ts | 184 | 09fdcc6319ff43bf99531cf1407accb1ac7185b333e28ef1666130edd885a84d |
| components/cms-composition/CmsTemplateEditDesigner.stale-type.test.tsx | 142 | e1388b2edf4a079cbf692b43511bdc2dca90b55d42432c72885a063cad1ba491 |
| components/cms-composition/CmsTemplateEditDesigner.tsx (edited) | 197 | bcf343a4e17bd39ef3ce4b8c696b4b3d7df31f60a8e2fbebb1916e4a872eb82a |
| components/cms-composition/CmsTemplateFields.tsx (edited) | 140 | 83c1d631d5df1de6d320f559bf613a41ba3ef8e06f1c203f0622110c88cde988 |
| components/cms-composition/cms-template-designer-request.ts (edited) | 200 | e101170f1a03fda6313f1ab292f9d343e368c0a0987b20d3221d4d7d8adf5f47 |
| components/cms-composition/cms-template-designer-request.test.ts (edited) | 206 | f74f847ab9db7f354d71e2373053f2a366ae56916e0aa7d7c7b69583f0d298ef |
| components/cms-composition/README.md (edited) | 80 | 5689ae3127d5dc8c825bedd2d1424eb207020cdec23ce89acc805b7122ee7d01 |


All non-test files are within the size limits (components <= 200, libs <= 300); every test file is <= 400. No TODO, skip, only or `any` in the lane files.
Not edited (outside the claim): `apps/web/src/server/README.md`, `apps/web/src/pages/api/v1/cms/README.md`; the new directories carry their own READMEs.
Preexisting edits by other lanes (hardening-2's `cms-composition-platform-*`, definition-reviews' nav link and template panel) were not touched.

## Runs (all `pnpm exec vitest run` from the worktree root, pinned PATH, under `flock -s /tmp/wejammin-quiet.lock`)
- RED observed (module absent) before implementation for: pattern-tree-rules, pattern-tree-state, pattern-designer-request, the four server proxy modules,
  submit transport, latest read, loader, refusal items. Written together with their implementation (RED not separately run; covered by the mutation
  battery): reasons parity, route tests, components and their DOM tests, pages, panel, nav and mount guards, static closure.
- Focused set at the end (components/cms-pattern-designer, components/cms-governed-review, server/cms-pattern, pages): 63 files, 680/680 green (22:29).
- Mutation battery of the first pass (the script was in the author's scratchpad and is NOT in the repository, so this claim is historical and not reproducible; the
  fix pass below commits a reproducible script for its own changes): 79 targeted mutations over proxies, errors, details, rules, state, request builder, transport,
  latest read, hooks, components, loader, panel, nav, pages, closure and routes. First pass 74/79 killed; the 5 survivors were real gaps or redundant code:
  (a) a latest-read refusal status only the write declares (409/422) was not tested -> test added; (b) a session ended on one read while the other
  answered 404 was not tested -> test added; (c) the registry digest of the latest read was not tested -> test added; (d) the picker mutation was two controls ->
  split, both killed; (e) the attempt-key reset inside rebase/discard was redundant (the key is bound to the body, which carries `expectedVersion`) -> removed.
  Re-run of the 5: 5/5 killed. Final: 78 killed, 1 retired (the removed redundant line); every source restored byte-identical (sha256 verified after each pass).
- Full web suite (`vitest run apps/web`, 22:28): 468 files, 5334/5335 pass; the single failure is `components/step-up-required.inventory.test.ts` (AC1127 sweep
  guard, outside my claim): it lists every file that reads a 401 and this lane adds seven (Requests to root 1). An earlier full run also showed
  hardening-2's in-flight `cms-composition-platform-pattern.test.ts`; it is green in the final run.
- `astro check` (apps/web, 1788 files): 0 errors, 0 warnings (171 hints, same classes as the precedent: unused React import in tests). `tsc --noEmit -p apps/web`: no
  error in a lane file. eslint --max-warnings=0: 0. prettier --check: clean. `git diff --check` on the two edited files: 0.
- Visual check: SSR and jsdom-rendered states (edit with nested pattern, invalid summary) served from a scratch static page and viewed at desktop and 375 px width
  (no horizontal scroll, every button >= 44x44). One finding fixed: the facts list stacked vertically, now a wrapping row; the island heading duplicated the page
  h1, now "Edit {patternKey}".
- Bundle budget (`pnpm bundle:check`, FE03 :1736 island <= 35 KB gzip) needs a build and was not run; the closure test is the source-level guard.

## Test corrections
none (no existing oracle changed). Added only: three describe blocks to `components/cms-governed-review/governed-review-mounts.test.ts`
(pattern nav link, pattern panel mount) as the brief allows (minimal mount edits).

## Spec citations
FE03 :883 (CmsPatternVersionDesigner), :1036-1050 (states), :1066-1067 (routes), :1108 (interaction row, 400/401/403/404/409/415/422/429/5xx
mapping, "retain the unsent tree; no drag-only path"), :1171 (network/retry: preserved input, idempotency reuse, reconcile first), :1216 (form
contract: persistent labels, blur/submit validation, completion focus, conflict never auto-overwrites), :1380 (responsive, 44x44 on mobile),
:1403 (a11y inventory, error summary links to the node), :1466 (props), :1506, :1563, :1572, :1596, :1692, :1701, :1736 (zero zod, <=35 KB island),
:1749 (security), :1800, :1847; progress AC-105, AC-164, AC-176, AC-266. BE03c :396 (CMS-03C-12 row), :1304 (typed refusals), error catalog
(`error-catalog.ts`, `refusals.ts`), BE00 172 (retryable 5xx details). Vertical-slices rule: nav link and panel mount guarded by `governed-review-mounts.test.ts`.

## Open items / BOUNDARY
1. BOUNDARY: `CmsPatternSelector` (nested-pattern picker). Missing: Worker route and proxy for CMS-03C-13 (`GET /api/v1/cms/patterns/selector`, not built). The control
   is disabled, names its reason (`NESTED_PICKER_DISABLED_REASON`) and offers no hand-typed pattern id; a nested pattern already saved in a version is kept
   (movable, removable, not editable). The key `selector` is reserved and refused. When CMS-03C-13 lands, replace `CmsPatternNestedPicker.tsx` and add `patterns/selector.ts`
   plus its proxy; no other file changes.
2. BOUNDARY: node pointer of a server tree refusal. FE03 :883 and AC-105 want a cycle / depth / node-count refusal "inline with the node path", but BE03c :1304 gives
   these refusals only `details.reasonCode` (no pointer member) and the Worker flattens violations to `/`. The form shows the refusal at the tree and links every
   nested pattern node as a possible cause. If a pointer member is wanted, it needs a BE03c ruling and a contract member first.
3. The registry nav has no link to `/app/cms-content-modeling/templates/new` (pre-existing gap, not this lane's); I added only the pattern entry.
4. Browser E2E (later lane) must cover: create a pattern with nested blocks by keyboard only; the error summary link focusing the node; move/remove focus; a first
   version then a successor with `expectedVersion` and a real two-request conflict (409 `COMPOSITION_VERSION_CONFLICT`) with rebase and discard; a reserved key (422 at
   the key field); a concealed key (404) and a missing capability (403); submit-for-review from the saved page; 320 px reflow and 200% zoom; a session that ends mid-edit.
5. Two older copies of the static-closure walk exist (`cms-island-static-closure.test.ts`, `governed-review-static-closure.test.ts`); `static-closure.test-support.ts` in
   this lane is the extracted helper they can adopt.

## Requests to root
1. `apps/web/src/components/step-up-required.inventory.test.ts` (outside my claim) must classify seven files this lane added that read a 401. CMS-03C-12 and
   `cmsPatternLatestRead` list no `STEP_UP_REQUIRED` row (FE03 :1179 names only CMS-03C-07, -08, -09), so all seven are exempt with the `NO_STEP_UP_ROW` reason:
   `components/cms-pattern-designer/CmsPatternStatus.tsx`, `components/cms-pattern-designer/load-pattern-designer-page.ts`,
   `components/cms-pattern-designer/pattern-designer-reasons.ts`, `components/cms-pattern-designer/pattern-designer-submit.ts`,
   `components/cms-pattern-designer/pattern-latest-read.ts`, `components/cms-pattern-designer/use-pattern-conflict.ts`, `server/cms-pattern-platform-details.ts`.
   Nothing else is needed; this is the only failure attributable to the lane.
2. Optional, not blocking: export `CMS_RESERVED_PATTERN_KEYS`, `CMS_BLOCK_KEY_PATTERN` and the `CMS_PATTERN_MAX_*` constants from `packages/contracts/src/client.ts` so
   `pattern-tree-rules.ts` can import them instead of mirroring them (the drift-guard test would then become a re-export check).
3. Optional: fold the three static-closure walks into `static-closure.test-support.ts` (Open items 5).

## Fix pass
Finished 2026-10-15 03:15 local, worktree HEAD `b16edb54`. Status: GREEN for the fix-pass scope (every item below fixed test-first or explicitly dropped).
Spec basis: FE03 :1216 (conflict shows the server version beside the preserved draft, never overwrites), :1050 and :1173 (an unknown outcome is
reconciled with the server before any retry), :883 (server digest, `expectedVersion`), BE03c CMS-03C-12 (version rule `CmsVersionSchema`, int64).

### Findings and resolution
| Finding | Resolution | RED observed |
|---|---|---|
| M1 conflict shows no server content | New `CmsPatternReview.tsx` (116 lines) + `pattern-review-outline.ts` render the newer version beside "Your unsent draft" (tree as keyed `<ol>` outlines and content types), each node marked in words "(only in version N)", "(only in your draft)" or "(changed)", matched by key at the same position, placed before "Keep my edits" / "Discard my edits". Shown only when the latest is newer. | yes: `CmsPatternVersionDesigner.review.test.tsx` 3 of 4 failed before the component existed (the fourth, "no comparison when still the latest", passes by construction) |
| M2 stale type dead-end (pattern) | `unavailableTypeIds` (request module) + `unavailableTypeIds` in the hook (base version types union current choice, minus the context) feed `CmsPatternFields`, which lists each stale id as a checked, labelled "no longer available" checkbox that can be cleared, with an explanation. Copy `compatible_unavailable` now says "Clear the box marked "no longer available", then save." (no reload advice). | yes: `CmsPatternVersionDesigner.stale-type.test.tsx` 4 of 5 failed |
| M2 same defect (template designer) | `cmsTemplateUnavailableTypeIds` + `CmsTemplateEditDesigner` pass the stale ids to `CmsTemplateFields` (new optional `unavailableTypeIds`, same rendering); the builder now separates an empty choice from an unavailable type and the latter message is actionable (`CMS_TEMPLATE_TYPE_UNAVAILABLE_MESSAGE`). | yes: `CmsTemplateEditDesigner.stale-type.test.tsx` 3 of 3 failed; the new builder test failed on the old message |
| m3 unknown outcome not reconciled | `reconcileUnknownOutcome` (`pattern-outcome-reconcile.ts`): after `uncertain` the hook reads the latest by itself. A latest at base+1 holding exactly the attempted key, types and tree is shown as "Pattern draft saved" (no duplicate on rebase); a latest equal to the base version, or a 404 on a first version, shows "Nothing was saved" with the same-key retry; anything else keeps the unknown outcome and offers the comparison. A plain 409 still does not read by itself. | yes: `pattern-outcome-reconcile.test.ts` (module absent) and `CmsPatternVersionDesigner.reconcile.test.tsx` 9 of 11 failed |
| m4 no lineage identity | `patternLatestIdentityValid` (same rule as `cmsTemplateLatestIdentityValid`: newer, or the very row id + contentHash) applied inside `usePatternConflict`; an older or foreign same-numbered version reads "The latest version could not be verified. Reload." The base identity follows rebase/discard. The "newer" rule moved from `CmsPatternConflictPanel` into the hook (`isNewerThanBase`). Pattern key equality was already enforced by `verifiedPatternDetail`. | yes: 3 of 4 identity cases failed |
| m2 four copies of the version rule | `isCmsVersion` (browser-safe, int64) replaces `/^[1-9]\d{0,18}$/u` in `pattern-designer-request.ts`, `pattern-designer-submit.ts` (two places), `pattern-latest-read.ts` and the server `cms-pattern-platform-details.ts` (a fifth copy found by search). `pattern-latest-read.ts` has no distinguishing test: a version past 2^63-1 cannot also equal `String(patternVersion)` for a JS number, so that mutation is equivalent and is not claimed. | yes: request, conflict-hint and server-hint tests failed on 9223372036854775808 |
| m1 drift guards not exhaustive | `pattern-tree-rules.ts` now exports `PATTERN_KEY_REGEX`, `NODE_KEY_REGEX`, `BLOCK_KEY_REGEX`, `PATTERN_JSON_LIMITS`. `pattern-tree-rules.grammar.test.ts` compares each regex `.source` and flags to the contract's (pattern and node key through zod `_zod.bag.patterns`; block key to `CMS_BLOCK_KEY_PATTERN`), compares accept/refuse with the schema over 130 characters x 6 positions (including newline anchors traps and look-alikes) and every length 0 to limit+2, asserts the accept boundaries (64-char node key, 96-char dotted block key), and compares `JSON_VALUE_MAX_KEYS`, `_ARRAY_ITEMS`, `_BYTES`, `_DEPTH` and the 128-character prop key with accept/refuse at 128/129 nested keys, 128/129 items, the exact byte limit and one byte over (ASCII and multi-byte). | export part RED (2 failed); the behavioural cases agree with the contract today, so they are guards, not RED |
| report: edit-mode data claim, line counts | Design decision 5 corrected; Files table recomputed from the final bytes (lines and SHA-256). The loader was not trimmed: it already serializes exactly `PatternLatestDetail`, and `id`/`contentHash` are now used (m4). | n/a |
| report: mutation script | Script committed: `docs/handoffs/2026-10-14-claude-s12/lanes/lane-web-patterns-mutations.mjs` (104 lines, sha256 `6420d549...a3590`). The first-pass 79-mutation script was not recoverable, so that claim is marked historical above. | n/a |

Not in this fix pass (not asked): m5 (BOUNDARY `TRACKING: #` for CMS-03C-13, root opens the issue and asks for an FE03 :883 / BE03c ruling), m6 (disable only the commit
control while pending, blur validation, URL update after create; shared with the template designer). Both remain open.

### Runs (pinned PATH, `flock -s /tmp/wejammin-quiet.lock`)
- Mutation battery `node docs/handoffs/2026-10-14-claude-s12/lanes/lane-web-patterns-mutations.mjs` (36 mutations, suites: cms-pattern-designer, cms-composition, server/cms-pattern):
  first run 33 killed, 3 survived (draft content types not asserted per side; another key accepted as own commit; any rejection read as "not saved" for a first version);
  the three tests were added and the three re-run with `--only`: 3/3 killed. Final 36/36 killed, every source restored byte-identical (script verifies sha256 after each).
  Log of the first run sha256 `421d2b81...909ae` (scratchpad, not committed).
- Focused set at the end (cms-pattern-designer, cms-composition, server/cms-pattern, pages/api/v1/cms/patterns, pages/app/cms-content-modeling/patterns,
  cms-governed-review, step-up-required.inventory): 51 files, 643/643 green.
- Full web suite (`vitest run apps/web`, 03:07): 475 files, 5418/5418 green (includes the static zod closure of both islands and the AC1127 inventory guard).
- `astro check` (apps/web, 1800 files): 0 errors, 0 warnings, 175 hints. eslint `--max-warnings=0` on every touched directory/file: 0. prettier `--check`: clean.
- Not run: `pnpm bundle:check` (needs a build; the source-level closure test is the guard). No visual 320 px check this pass (new review layout is CSS-only:
  two columns above 48rem, one column below; unverified in a browser).

### Test corrections
No existing oracle was weakened. Existing test files edited (assertions added only, plus one extended test):
`components/cms-pattern-designer/pattern-designer-request.test.ts` ("refuses an unreadable parent version" now loops `'0'`, `'01'`, `9223372036854775808` and
adds the `9223372036854775807` acceptance), `pattern-designer-submit.test.ts` (conflict hint past int64 -> null), `server/cms-pattern-platform-errors.test.ts`
(server hint past int64 -> dropped), `components/cms-composition/cms-template-designer-request.test.ts` (new test: unavailable type vs empty choice).
Copy changed with it: `compatible_unavailable` and the template message (now actionable) and the unknown-outcome sentence ("The result is unknown. The latest version
could not settle it. ..."); the existing test asserting "The result is unknown." still holds.

### Process notes
`pattern-review-outline` unit tests were written together with the module (7 tests, RED not run separately); the component tests for it were RED first.
The grammar and JSON guards pass on their behaviour cases today by design (the code matches the contract); their export cases were RED.

### Requests to root
1. Optional (unchanged): export the grammar regexes and `CMS_PATTERN_MAX_*` from `packages/contracts/src/client.ts` so `pattern-tree-rules.ts` can import them; the guard
   then becomes a re-export check. The guard reads zod's `_zod.bag.patterns` today, which is zod-4 internal.
2. The mutation script lives in `docs/handoffs/.../lanes/`, outside the original claim; move or drop it as you prefer.
3. m5 and m6 above are open and need your decision (tracking issue; whether the form-contract deviations are in scope for this slice).
