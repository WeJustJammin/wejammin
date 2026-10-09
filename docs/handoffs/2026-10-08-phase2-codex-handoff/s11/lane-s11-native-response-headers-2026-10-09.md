# Native Slice11 response-header unit RED preparation

Use actual `gpt-6-astra`/`high`, fork-none; parent/review6.1/ultra. Approved worktree `/home/rob/.codex/worktrees/phase2-slice11/WeJammin` only. Read applicable project rules/instructions and implement-slice TDD/verification skills fully. Source-only pure context-mode fs/path reads and native apply_patch. NO commands/scripts/tests/DB/network/child_process/module execution/formatting/commits/nested agents. Parent runs fresh RED, owns docs/tracker, and separately authorizes any subsequent producer changes.

Only write new `apps/worker/src/cms-editorial-production-response-headers.test.ts` (<=400 lines); all existing harnesses/tests/production/contracts/fixtures read-only. Preserve existing tests. Derive tests from locked BE03b, FE03, actual public Worker route composition and existing production-app test support, not standalone header helper snapshots or broad mocks that bypass admission/serialization.

Two source-identified unrun candidates:

1. Preview responses require `X-Robots-Tag: noindex` (BE03b preview evidence around2019/2167, FE03 around1104); route-errors commonHeaders/workflow-command may omit. Verify full exact locked statuses/scope before writing cases.
2. Retryable publication503 carries numeric Retry-After and RateLimit headers (BE03b universal response around136). Actual workflow-command retryable response/route-errors may drop successful admission quota metadata. Assert exact numeric values, all required quota fields, own-null wire evidence and request IDs at actual public response boundary.

Include paired positive/negative controls as required by locked contract, not invented universal requirements. Tests must become RED if these headers are absent/malformed and not pass from mocked response assembly. No production edits until parent observed fresh RED. Report exact source/spec citations, intended focused command, paths/caps and no-execution confirmation; freeze file after report. Do not claim API coverage, acceptance, or full gates from unit preparation.
