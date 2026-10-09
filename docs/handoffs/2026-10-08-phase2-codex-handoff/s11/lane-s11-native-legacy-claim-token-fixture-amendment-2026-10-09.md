# Native legacy claim fixture amendment — omit unreturned token

Root source evidence: actual claim RPC returns job_id/version/state/lease_until/
attempt_count, not token or requestedversion (persistence_runtime_authority.sql
198–225). async-runtime.ts76 uses crypto.randomUUID by default. Two old fixtures
return static444… token, now correctly refused by explicit binding guard. New
QA63/63; broader475:473passed/2failed at these fixtures. No production waiver.

Checkpoint/push/exact-origin BEFORE native gpt6astra/high continuation. Only root
`/home/rob/.codex/worktrees/phase2-slice11/WeJammin`. PURE ctx JavaScript fs/path
reads plus native apply_patch ONLY. NO commands/exec/shell/child_process/scripts/
tests/DB/network/format/lint/TSC/Git/packages/nestedagents.

SOLE existing files:

- apps/worker/src/async-runtime-decisions.test.ts
- apps/worker/src/async-runtime-manual-review.test.ts

Read both complete tests, parseLease, runtime defaults and actual SQL claim
response. Delete ONLY `leaseToken: LEASE_TOKEN,` in each top-level `lease` claim
response object. This response-field omission exercises unchanged request-token
fallback, matching actual SQL. DO NOT delete outbox leaseToken or constants,
inject a token generator, replace mocked RPC, rename titles or change assertions.
All other bytes preserved. No producer/other QA/support/contract change.

Freeze/report UNRUN two-line diff/counts. Parent owns format/ESLint, QA63 and full
related jobs/async/production/core including preparation factory16, static gates,
independent6.1 review and isolated receipt/binding mutation/exact restoration.
No receiving retry/heartbeat, claimed-job resolver, SQL job fences or acceptance
proof. GenuineAPI7RED/0of122/full/owner/external gates remain open.
