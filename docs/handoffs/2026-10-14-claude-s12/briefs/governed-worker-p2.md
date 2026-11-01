# Lane brief — `claude_s12_governed_worker` phase 2 (CMS-03C-07/08/10/11 transport)

Build, test-first, the Worker HTTP transport for:
- CMS-03C-07 POST /api/v1/cms/governed-reviews/{reviewId}/decision
- CMS-03C-08 POST /api/v1/cms/governed-reviews/{reviewId}/assignments
- CMS-03C-10 GET  /api/v1/cms/governed-reviews/{reviewId}
- CMS-03C-11 GET  /api/v1/cms/governed-reviews
over the PROMOTED SQL boundary (`supabase/migrations/20261014010000`–`010410`): exact RPC names, request
JSON, MFA step-up, tokens/DETAILs, the committed `{kind:'refusal', reasonCode, details}` envelope stored
as a replayable 409, and the queue's signed cursor (Vault key `cms_editorial_history_cursor_active`) are
in `docs/handoffs/2026-10-14-claude-s12/lane-governed-a-report.md` `## RPC boundary`, reviewed CLEAR in
`review-governed-a.md` (read its F-2: unknown body key is SQL `INVALID_REQUEST` but the spec's 422 comes
from Worker zod; F-3: re-revoke raises bare `CONFLICT` with no closed reason token — map it to the
contract's generic conflict and record it as a BOUNDARY citing the inherited spec gap).

Same files, rules, precedent and commands as `briefs/governed-worker.md` and your phase-1/fix-pass
report. Also close the two minors from `review-governed-worker-fix.md`: `provider-fault-guard.ts` should
admit `40001` only with the expected serialization semantics (or document why any message is safe), and
add a P0001 control to `pattern-definition-provider-fault.test.ts`. Spec: BE03c rows ~169–173,
invariants 192–221 (review `version` CAS; assignment create/revoke do not advance it; recent MFA
unconditional for 07/08 with 401 `STEP_UP_REQUIRED` before any idempotency reservation; 10/11 are
protected no-store GETs with no mutation headers), error catalog ~1250–1305, testing ~1611; contracts
`governed-{assignment,decision,review-read}.ts`, registry rows `platform-registries.ts` ~1979–2067; the
03b editorial review/decision/assignment Worker routes are the closest precedent for MFA step-up and the
committed-refusal replay (find them under `apps/worker/src/cms-editorial*`).

Append `## Phase 2` to your report: files (path/lines/SHA-256), focused + joint + full Worker counts,
tsc/eslint/prettier, status/code mapping table per operation, BOUNDARY items.
