# Lane S11-4a report: cms.a11y.structural v1 checker (D25 / DEC-134)

LANE = /home/rob/.codex/worktrees/phase2-slice11/WeJammin, dir = apps/worker/src/cms-editorial/a11y-structural/**

## Baseline (before my first file)
- `tsc --noEmit -p apps/worker/tsconfig.json` already fails in OTHER lanes' in-flight files (not mine):
  cms-editorial-production-composition-coverage.test.ts, cms-editorial-production-detail.test.ts,
  cms-editorial-production-history.test.ts, production-worker-runtime-cms.ts (contracts widened CMS-03B operationId union).
- BLOCKER found: `zod` is NOT resolvable from apps/worker (no dependency in apps/worker/package.json, not hoisted; no other worker
  file imports zod). Stopgap seam: `zod-runtime.ts` re-exports `z` from the contracts package's own node_modules by relative path
  (same zod 4.4.3 instance; verified in vitest and tsc). ORCHESTRATOR ACTION: add `"zod": "4.4.3"` to apps/worker/package.json
  (+ lockfile / `pnpm install`) and change the single line in zod-runtime.ts to `export { z } from 'zod';`.
- Zod 4 fact: `z.unknown()` object members are REQUIRED keys (missing key fails, explicit undefined passes).

## Checkpoints

### 1. Rule catalog (catalog.ts, catalog.test.ts)
- Files: catalog.ts (11-rule catalog, severities per BE05c, FINDINGS_STORED_MAX 500, catalogEntry), catalog.test.ts, zod-runtime.ts (seam).
- RED: `Cannot find module './catalog'` (module absent). GREEN: 26 tests pass (rule set, per-rule severity, message bound/static, no media rules).
- Remaining: input schema, structure, heading, link, landmark, checker orchestration, hashes, gate, evidence, README, lint/prettier/coverage/tsc.

### 2. Input schema (input-schema.ts, input-schema.test.ts, a11y-structural.test-support.ts)
- Strict Zod: nodes (max 256) = discriminated union of field{rich_text,value:unknown} | block{...}; lowercase-uuid ids, safe RFC 6901 pointer
  (<=256 chars, 1..32 segments, [A-Za-z0-9_.-] and ~0/~1), duplicate fieldId / pointer refused; any other node kind (media) refused.
- RED: `Cannot find module './input-schema'`. GREEN: 55 tests pass.
- Decisions: blockKey uses the registry CmsBlockKeySchema; ids must be lowercase uuids (so pointers and the SQL binding hash are canonical);
  accessibleName raw bound 4096 UTF-16 units (longer = TARGET_UNREADABLE, the 160-character judgement stays a landmark rule).

### 3. Finding collector (findings.ts, findings.test.ts)
- Total order blocking > render position [node,block,span] > ruleId > pointer; bounded top-500 compaction (O(500) memory) with TRUE blocking/warning totals + truncated.
- RED: `Cannot find module './findings'`. GREEN: 10 tests (shape, order table, insertion-order independence, exactly-500, 2507 findings reversed insertion, blocking-ahead-of-warnings truncation).

### 4. Structure rules (rules-structure.ts, locations.ts, rules-structure.test.ts)
- structure.rich_text_invalid via shared validateRichTextV1 (field skipped downstream), structure.block_unregistered for withdrawn|unregistered (deprecated/supported clean).
- Locations: field `/fields/{id}`; rich-text block `/fields/{id}/blocks/{i}` (blockPath `/blocks/{i}`); span adds `/spans/{j}`; block node = its composition pointer (blockPath = same pointer, fieldId null).
- RED: `Cannot find module './rules-structure'`. GREEN: 16 tests.

(Resumed 2026-10-08 after host reboot: zod is now a worker dependency, zod-runtime.ts is `export { z } from 'zod'`; files on disk intact.)

### 5. Heading rules (rules-heading.ts, text.ts [hasNonWhitespace], rules-heading.test.ts)
- heading.empty (no non-whitespace text over all spans, JS \s Unicode-aware), heading.first_level (first heading in document order across fields, not level 2),
  heading.level_skipped (level > previous + 1; decreases ok; state carries across fields and over non-heading blocks; empty heading still counts).
- RED: `Cannot find module './rules-heading'` (before implementation); GREEN 22 tests after one fixture fix (a tab is a control char refused by rich_text.v1, so the
  "mixed whitespace" fixture uses U+2003 + newline; production code unchanged by that).

### 6. Text normalizers (text.ts, text.test.ts)
- normalizeLinkText (NFKC, lowercase, trim, collapse, trailing \p{P}+whitespace), normalizeAccessibleName, primaryLanguageOf, genericLinkPhrases (Map; `en` only, 10 phrases, prototype-safe).
- RED: 29 of 37 failed (`normalizeLinkText is not a function` etc., exports absent). GREEN 37 tests.

### 7. Link rules (rules-link.ts, rules-link.test.ts; text.ts: normalizeAccessibleName renamed normalizeIdentity, also used for URL compare)
- link.text_empty / link.text_generic (en list, normalized) / link.text_is_url (warning; text == target [https href, bare mailto address, internal route] or starts https:// | mailto:) /
  link.text_unchecked_language (warning once, at the FIRST link, when a link exists and the primary language has no list; `de`, `fr-CA`... warn, `en`, `en-US`, `EN-gb` silent).
- DECISION (ratify): a "link" is the run of ADJACENT spans with the same link target (rich_text.v1 only merges adjacent spans with equal marks AND link, so one styled link is several
  spans); text is the concatenation, the finding addresses the run's first span. Per-span judging would wrongly block "More"+"about jamming" as generic "more". Brief said "per span".
- RED: `Cannot find module './rules-link'`. GREEN: rules-link + text = 93 tests.

### 8. Landmark rules (rules-landmark.ts, rules-landmark.test.ts)
- landmark.name_missing (nameRequired && [!accessibleNameFieldDefined || null/blank/>160 code points after trim]; fail closed), landmark.name_duplicate (warning; same blockKey + equal
  NFKC/lowercase/trim/collapse name, usable names only).
- DECISION (ratify): name_duplicate flags EVERY member of a duplicate group (order-independent), and applies to every block instance with a usable name (input has no separate landmark flag),
  whether or not its manifest requires a name. Landmark rules also run for withdrawn/unregistered blocks (their structure finding is separate).
- RED: `Cannot find module './rules-landmark'`; one wrong expectation of mine (warnings sort after blocking) corrected BEFORE implementing. GREEN 16 tests.
- Remaining: hashes, checker orchestration, gate, evidence, README, index.ts, lint/prettier/coverage/tsc.

### 9. Hashes (hashes.ts, hashes.test.ts)
- accessibilityInputHash (JCS of checkerKey, checkerVersion, revisionContentHash, blockRecordHashes in node order, accessibilityRows [], renderPlanHash) and
  accessibilityBindingHash (JCS of checkerKey, checkerVersion, revisionId, revisionContentHash, dependencyHash); both via the existing canonicalHash.
- Pinned vectors computed independently with `sha256sum` over hand-written JCS text (inputHash 2 blocks e881c996..., no blocks 98ebefa6..., binding 1199f04e59a554a5...c2171289 for
  revisionId 11111111-1111-4111-8111-111111111111, content 'a'*64, dependency 'e'*64). PG cms_accessibility_binding_hash must reproduce the binding vector.
- RED: `Cannot find module './hashes'`. GREEN 14 tests (code matched the independently computed digests first time).

### 10. Checker orchestration (checker.ts, checker.test.ts, checker-limits.test.ts)
- runAccessibilityChecker(input, {shouldStop?}) -> run {checkerKey, checkerVersion, state, findings(<=500), blockingCount, warningCount, truncated, inputHash} | {state:'stopped'}.
  Passes: structure, heading, link, (media inert: no code), landmark; shouldStop polled before every node of every pass.
- Tests: states, full cross-group order (hand-computed before implementing), cross-field heading state, invalid field skipped, en-US vs de, determinism (byte-identical, structuredClone, no mutation),
  truncation (exactly 500, 1280 blocking true total, 640 warnings healthy+truncated, late blocker ahead of 500 warnings), privacy canary, stop in each of the 4 groups.
- RED: `Cannot find module './checker'`. GREEN: 25 tests.

### 11. Gate budget (gate-budget.ts, gate-budget.test.ts)
- openGateBudget(timeoutMs, parent) -> {signal, expired, close}; defaultGateSleep(ms, signal) (abort-aware, clears its timer). Parent abort or timer abort the same internal signal.
- RED: `Cannot find module './gate-budget'`; then one of MY test bugs (captured signal.reason before aborting) fixed in the test. GREEN 7 tests.

### 12. Gate, functional part (gate.ts, gate.test.ts)
- evaluateAccessibilityGate({load, timeoutMs?, now?, sleep?, signal?}) -> {state healthy|blocked, result, input, durationMs, evaluatedAt} | {state failed, failureCode, durationMs, evaluatedAt}.
  One budget covers load+validate+evaluate; retry once after 250 ms only if now()+250 < deadline and the load says retryable; throwing load/sleep = dependency_unavailable (never propagates);
  schema-invalid input (incl. any media node) = TARGET_UNREADABLE; anything at/after the deadline = CHECKER_TIMEOUT; timeoutMs outside integer 100..2000 = RangeError (programmer error).
- RED: `Cannot find module './gate'`. GREEN: 32 tests (outcomes, fresh per call, every retry edge incl. 399/400 boundary, throwing load/retry/sleep, 9 unreadable shapes, arg validation).
- Next: gate-timeout tests (fake timers, parent abort, cooperative stop), then evidence, README, index.

### 13. Gate, deadline part (gate-timeout.test.ts; gate.ts one-line fix)
- fake-timer tests: hung load abandoned at 2000 ms default / 100 ms custom, signal aborted, load-rejecting-on-abort = CHECKER_TIMEOUT (not dependency), no armed timer afterwards,
  real 250 ms default sleep; cooperative stop via stepping clock, load that eats the budget, at-deadline finish with no poll (zero nodes) = timeout, 1999 ms still ok; late load failure = timeout;
  parent abort (pre-aborted, during load, during sleep, sleep ending with abort).
- RED (behavioural): 2 tests failed for the right reason: load was still invoked with an already-aborted budget (pre-aborted parent; pause that ended with the abort). Fix: attemptLoad returns
  dependency_unavailable without calling load when the budget signal is aborted (outer check reports CHECKER_TIMEOUT). GREEN: gate*.test = 54 tests.
- DECISION (ratify): any parent abort is reported as CHECKER_TIMEOUT (the gate did not finish inside the time available); a thrown load is non-retryable.

### 14. Evidence + audit record (evidence.ts, evidence.test.ts)
- toPreflightEvidence(run): healthy|blocked -> PreflightEvidence validated by PreflightEvidenceSchema (blockingCount = min(true total, 1000), bindingHash from the run input);
  failed run -> null (README documents: DB maps absent evidence to unavailable/checker_failed, DEC-150). auditRecordOf(run) -> exactly {checkerKey, checkerVersion, outcome, blockingCount, inputHash}.
- Tests: field-for-field evidence, DEC-150 mapping through preflightResultForAccessibilityEvidence (healthy->passed, blocked->failed/blocking_finding), binding changes with dependencyHash,
  null for each failure code, 60 s freshness helper, 1280 blockers -> 1000 in evidence/audit while the run keeps 1280, inconsistent run refused by the schema.
- RED: `Cannot find module './evidence'`. GREEN 13 tests.
- Remaining: index.ts (+surface test), README, then narrow coverage / eslint / prettier / tsc.

### 15. Barrel, README, SECURITY FIX, final gates (index.ts, index.test.ts, README.md, text.ts)
- index.ts exports the public surface (guarded by index.test.ts); README.md documents contents, behaviours, how to add a rule, conventions, links, and the failed-run => no-evidence rule.
- SECURITY (found in self-review, fixed test-first): normalizeLinkText used `/[\s\p{P}]+$/u`, which backtracks quadratically: a 100,000-character "!" run took 8.8 s (RED, assertion < 1 s),
  and a link run can be 128 spans x 10,000 chars. Replaced with a backwards code-point walk (linear). Regression test + astral punctuation cases added. GREEN.
- FINAL: 16 test files, 352 tests pass. Narrow coverage of apps/worker/src/cms-editorial/a11y-structural/**: 100% statements (310/310), branches (154/154), functions (72/72), lines (283/283).
  (Coverage run used --coverage.reportsDirectory in the session scratchpad so it cannot collide with another lane's repo-level coverage/.tmp; thresholds left at the repo 100%.)
  eslint --max-warnings=0 clean; prettier --check clean; `tsc --noEmit -p apps/worker/tsconfig.json`: 0 errors in my directory; the 5 remaining errors are other lanes' in-flight files
  (cms-editorial-production-{composition-coverage,detail,history}.test.ts, cms-editorial/workflow-command-operations.test.ts, production-worker-runtime-cms.ts).
- No TODO/FIXME/any; max source file 173 lines (gate.ts), max test file 302 lines.
- Decisions to ratify: (1) link = run of adjacent same-target spans (brief said per span); (2) name_duplicate flags every member of a group and covers all blocks with a usable name;
  (3) parent abort => CHECKER_TIMEOUT, throwing load non-retryable; (4) blockKey validated with CmsBlockKeySchema, ids must be lowercase uuids, accessibleName raw bound 4096 units;
  (5) out-of-range timeoutMs throws RangeError (programmer error) rather than returning a failed run; (6) block locations: pointer = blockPath = the node's composition pointer, fieldId null;
  field locations: blockPath = `/blocks/{i}` for heading/link findings, null for structure.rich_text_invalid; (7) findings omit evidenceRef (Slice 16 adds `evidenceRef: null` when persisting).
- Remaining: nothing in scope. PG side must reproduce binding vector 1199f04e59a554a54cd0ffc893eebeba79f75a4833882ea4d5ff027ce2171289
  (revisionId 11111111-1111-4111-8111-111111111111, revisionContentHash 'a'*64, dependencyHash 'e'*64, JCS of {checkerKey, checkerVersion, dependencyHash, revisionContentHash, revisionId}).
