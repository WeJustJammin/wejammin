# Independent review: claude_s12_web_patterns (FE03 pattern designer)

## Status
Complete, 2026-10-15. Reviewer did not author this work. Read: review template, lane rules, brief `briefs/web-patterns.md`,
lane report (SHA `9a678d5d…e9750b`, matches), FE03 :883/:1036–1050/:1067/:1108/:1171–1185/:1216–1223/:1380–1420/:1736–1765/
:1814–1916/:2668–2680, BE03c :175/:396/:1304, contracts `pattern-node.ts`, `pattern-version.ts`, `key-grammar.ts`, `refusals.ts`,
`error-catalog.ts`, SQL `20261014020400_cms_create_pattern_version.sql`, Worker `pattern-definition-response.ts`, and every lane
source/test file listed in the report (current bytes; item 5 hashing skipped per instruction).

## Runs (pinned PATH, `flock -s /tmp/wejammin-quiet.lock`)
- `pnpm exec vitest run` on cms-pattern-designer/, CmsGovernedPatternPanel.test.tsx, governed-review-mounts.test.ts,
  server/cms-pattern-platform*, pages/api/v1/cms/patterns, pages/app/cms-content-modeling/patterns,
  step-up-required.inventory.test.ts: 19 files, 352/352 pass, exit 0 (log sha256 `4d61de3b…bd0de`). Inventory guard now green with
  root's seven `NO_STEP_UP_ROW` rows (correct: FE03 :1181 lists no CMS-03C-12 / cmsPatternLatestRead step-up).
- `astro check` (apps/web, 1791 files): 3 errors, 0 warnings, 171 hints, exit 1 (log sha256 `a8f9045b…2ebe5`). All 3 errors are in
  `cms-governed-review/CmsGovernedReviewPanel.tsx:97,101` and `governed-review-labels.ts:5`, files the concurrent Web fix lane is
  editing; 0 errors in lane files. Lane's "0 errors" was true for its moment; not reproducible now.

## Clause conformance (FE03; where implemented / where tested)
| Clause | Implemented | Tested | Verdict |
|---|---|---|---|
| :883 ordered `<ol>` + level text | CmsPatternTree.tsx:27, CmsPatternNode.tsx:63-67 | Designer.test :162 | OK |
| :883 add/remove/move, no drag-only | CmsPatternNode.tsx:143-176, use-pattern-tree-editor.ts | Designer.test :254-329, tree-state.test | OK |
| :883 props ≤64 keys / depth 8 | pattern-tree-rules.ts:120-137 | tree-rules.test :127-144 | OK |
| :883 `compatibleTypeIds` from context | CmsPatternFields.tsx:59-88 | Designer.test :356, request.test :135 | Gap (M2) |
| :883 server digest + `nodeCount` | CmsPatternVersionFacts, submit.ts:120-125 | submit.test :77-126 | OK |
| :883 cycle/depth/node refusal at node path | local rules name node; server refusal at tree + "may be the cause" links | refusal-items.test | BOUNDARY 2 valid (BE03c :1304 has no pointer; Worker flattens to `/`) |
| :883 successor `expectedVersion` + If-Match | use-pattern-designer.ts:55,87; submit.ts:157-159; write proxy :109-114 | results.test :50, write.test :48,:131-152 | OK |
| :883 nested picker from CmsPatternSelector | disabled control CmsPatternNestedPicker.tsx | Designer.test :63 | BOUNDARY (m5) |
| :1067 reserved `context|versions|selector|new`, 400 before read | loader :131-141, latest proxy :43, browser rules :24-29 | loader.test :160, routes.test :76, tree-rules.test :70 | OK |
| :1067 303 sign-in / 404 conceal / 403 | loader :152-161, :90-101 | loader.test :70,:175-211 | OK |
| :1043 loading: only commit disabled | whole fieldset disabled (Designer.tsx:96) | — | Deviation (m6, shared w/ template) |
| :1047 409 → fixed copy + refetch; :1050 unknown → reconcile before retry | manual "Check latest" only | results.test :266 asserts no auto read | Deviation (m3) |
| :1108 status map 400…504 | submit.ts:182-200, details.ts:28-35 | submit.test :166-250, errors.test | OK |
| :1171 429 wait; 5xx reuse key | use-pattern-designer.ts:111-117; write proxy :139-141 marks 5xx unknown | results.test :169,:190-221 | OK |
| :1216 conflict: server version beside draft, Review changes / Reapply / Discard | panel shows version/nodeCount/state only | results.test :266-333 | Gap (M1) |
| :1216 blur validation; completion updates URL | not implemented | — | Deviation (m6, shared) |
| :1403 error summary links to node; labels; live region | CmsPatternStatus.tsx:131-153, ids.ts:15-36 | Designer.test :178-240 | OK |
| :1380 44×44 mobile | cms-editorial.css + css:100-109 | author's 375 px visual check only | Unverified here (no 320 px check) |
| :1736 zero zod, island ≤35 KB | static closure test | closure.test (real walker) | Closure OK; bundle size not measured |
| :1749 CSRF, same-origin, strict body, no-store, catalog-only errors | write.ts:70-114,:139-161; errors.ts; details.ts | write.test :74-224, latest.test :45-191, errors.test | OK |
| :1847 latest-read statuses exclude 409/422 | details.ts:32-34 | errors.test :195-207 | OK |

## Scrutiny answers
- Drift guards: real for limits (`PATTERN_LIMITS` toEqual contract constants), reserved keys, reason set+status
  (`CMS_SLICE_12_OPERATION_REASONS`, `cmsSlice12ReasonStatus`), catalog codes, lifecycle states, UUID (imported). Partial for
  grammars and JSON bounds (m1) and absent for the version rule (m2): a contract change there passes the guard.
- Idempotency key: bound to serialized body, reused only after `uncertain`, dropped on every definite answer
  (use-pattern-designer.ts:102-111); in-flight re-entry ignored (ref + test :223). Correct. Every upstream 5xx and transport loss
  is marked unknown by the proxy; local no-binding 503 is not (nothing sent). Correct.
- Conflict: rebase/discard are explicit; rebase keeps tree and changes `expectedVersion` (new key); never auto-overwrites. But
  no server content shown (M1) and no identity check (m4).
- Proxies: CSRF double submit before media/body; exact strong If-Match ⇔ expectedVersion; strict re-serialized body; 2xx bound
  to request (key, parent+1, types, nodeCount, ETag); errors rebuilt from catalog code+message, details from closed vocabularies;
  no-store on every path. No PII/secret leakage found. No `dangerouslySetInnerHTML`, storage, or console use.
- Size/logic: components ≤186 lines, libs ≤276, tests ≤363; no TODO/`any`/skip. Small rule in a component
  (CmsPatternConflictPanel.tsx:23-25 rebase eligibility) belongs in the hook (fold into m4).
- Mutation battery: script lives in the author's scratchpad, not reproducible from repo. Mental check: narrowing `NODE_KEY` to
  `{0,31}` or dropping `_` survives every lane test (m1), so the battery did not cover grammar drift. Report also states several
  suites were written with their implementation and RED was not run separately (TDD rule: process gap, noted).

## Findings
- apps/web/src/components/cms-pattern-designer/CmsPatternConflictPanel.tsx:42-73 — major — after a 409/unknown outcome the
  panel shows only the latest's version, node count and state; the latest tree and compatible types are never shown beside the
  preserved draft, so "Keep my edits and base them on version N" discards another author's N changes unseen. FE03 :1216
  requires "Show current server version beside preserved draft … Review changes"; the template precedent
  (CmsTemplateLatestVersionPanel.tsx) shows both values. — Fix: render the latest's tree/types read-only beside the unsent
  tree (or a structural diff) before Reapply/Discard; add a DOM test asserting the latest's node keys are visible.
- apps/web/src/components/cms-pattern-designer/pattern-designer-request.ts:108-109 + CmsPatternFields.tsx:70-80 +
  pattern-designer-copy.ts:55-56 — major — a successor whose latest `compatibleTypeIds` contains a type no longer active in
  `cmsTemplateContextRead` can never be saved: only context types render as checkboxes, so the stale id cannot be unchecked,
  and the copy "Reload to refresh the choices" cannot help (SQL 20261014020400:173-184 requires every type active; Worker
  flattens that 422 to `/`). Dead-end form; untested. Same defect exists in cms-template-designer-request.ts:94. — Fix: render
  stale ids as checked, labelled "no longer available" checkboxes that can be unchecked (as CmsPatternNode.tsx:98-102 does for
  retired blocks); copy "Remove it"; test with a latest containing an inactive type.
- apps/web/src/components/cms-pattern-designer/pattern-tree-rules.test.ts:100-145 — minor — grammar parity is sampled with
  refusals only: no accepted 64-char node key, no `_`/`-`/digit node key, no 96-char or dotted block key; `JSON_VALUE_MAX_KEYS`
  (nested object >128 keys) and `JSON_VALUE_MAX_BYTES` untested; regex constants not compared to `CMS_BLOCK_KEY_PATTERN`
  etc. A contract grammar change passes the guard and the user then gets an unpointed 422. — Fix: compare `.source` of mirrored
  regexes to exported contract patterns, compare `JSON_VALUE_MAX_*`, add accept-boundary cases.
- pattern-designer-request.ts:65, pattern-designer-submit.ts:110,195, pattern-latest-read.ts:71 — minor — the version rule is
  copied four times as `/^[1-9]\d{0,18}$/u` without the int64 bound, with no drift guard, although zod-free `isCmsVersion` is
  exported from `@wejammin/contracts/client`. Copy-paste rule + drift. — Fix: use `isCmsVersion`.
- apps/web/src/components/cms-pattern-designer/use-pattern-designer.ts:111,145-151; use-pattern-conflict.ts:15-25 — minor —
  unknown outcome does not reconcile before retry (FE03 :1050, :1173); refetch is manual. When the person's own write committed,
  the latest (base+1) is offered as "newer" and rebase creates a duplicate successor; on a first version a 404 check (nothing
  saved) reads "This pattern is unavailable to the current acting context". No overwrite, but duplicate drafts and misleading
  copy. — Fix: auto-read latest on `uncertain`; treat latest equal to the attempted body at base+1 as created; 404 after an
  unknown first version means "not saved, retry".
- apps/web/src/components/cms-pattern-designer/use-pattern-conflict.ts:39-47, CmsPatternConflictPanel.tsx:23-25 — minor — no
  latest identity check; precedent `cmsTemplateLatestIdentityValid` refuses same-version-different-id/hash and older versions.
  Here an older or foreign same-number version renders "still the latest". — Fix: port the identity rule into the hook.
- apps/web/src/components/cms-pattern-designer/CmsPatternNestedPicker.tsx:6-11 — minor — BOUNDARY has no `TRACKING: #`
  (boundary-not-placeholder.md §2). Its stated cause ("route not built", "no other file changes") understates the gap: CMS-03C-13
  (BE03c :175, contracts pattern-selector.ts:19) lists patterns for one `contentTypeId` to `cms.author|cms.editor`, not to a
  `cms.template_designer` choosing a nested pattern compatible with all `compatibleTypeIds`. Root-sanctioned by the brief, so
  acceptable as a boundary. — Fix: root opens the tracking issue and asks for an FE03 :883 / BE03c ruling on the designer's
  nested-pattern selector.
- apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.tsx:96 — minor — whole fieldset disabled while
  pending (FE03 :1043/:1220 "only the commit control disabled"); no blur validation (:1219); no URL/version update after create
  (:1221). Shared with CmsTemplateDesigner.tsx:159. Report's spec citation of ":1216 (… blur/submit validation …)" overclaims.
  — Fix: disable only the submit button; add blur checks for key/props; replaceState to `/patterns/{key}` after create.
- docs/handoffs/2026-10-14-claude-s12/lane-web-patterns-report.md (Design decision 5, Files table) — minor — "only the active
  types, registered blocks and the CSRF token reach the island" is false in edit mode: the full latest detail (incl. `id`,
  `contentHash`, unused by the designer) is serialized (load-pattern-designer-page.ts:211-222). File table is stale:
  `[patternKey].astro` is now 86 lines (report 67) and `CmsGovernedPatternPanel.tsx` 71 (report 66) after the governed-review
  lane added `review`/`panelReview`; this review covers current bytes. — Fix: correct the report; trim `latest` to used members.

## Report-claim checks (no re-hash)
- Focused counts: lane's 63 files/680 included all of cms-governed-review (out of my scope now); my 19-file subset is green.
- "0 TODO/skip/only/any": confirmed. Size limits: confirmed. Inventory request to root: applied and correct.
- "astro check 0 errors": now 3, all outside lane claim (concurrent lane). Bundle ≤35 KB: not measured (author says so).
- Mutation battery 78/79: not reproducible from repo artifacts; at least one surviving class identified (m1).

## Verdict rationale
Security, proxy hygiene, idempotency lifecycle, reserved keys, page guards and the zod-free closure are sound and well tested.
Two majors remain in the user-facing conflict and successor paths (M1 conflict review missing, M2 stale-type dead-end); neither
leaks data or overwrites automatically, so not a block, but the lane is not CLEAR until both are fixed with tests.

VERDICT: PARTIAL
