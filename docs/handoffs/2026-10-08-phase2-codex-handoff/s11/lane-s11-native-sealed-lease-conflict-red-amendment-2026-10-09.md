# Native QA amendment — post-seal reclaim CONFLICT propagation

Root `/home/rob/.codex/worktrees/phase2-slice11/WeJammin` only. Retained native
author gpt-6-astra/high; parent/review6.1/ultra. Parent checkpoint/push/remote
verification precedes dispatch. Exact write scope ONLY:

- `apps/worker/src/content-schema-registry/migration-worker-sealed-lease-handoff.test.ts`
  (<=400 formatted lines, now249).
- `apps/worker/src/content-schema-registry/migration-worker-sealed-lease-test-support.ts`
  (<=300 formatted lines, now233).

PURE ctx JavaScript fs/path reads and native apply_patch writes ONLY. NO commands/
exec/write_stdin/shell/child_process/scripts/tests/DB/network/format/lint/TSC/git/
packages/commits/nested agents. No producer/other test/README/tracking changes.
All existing7 cases/titles/assertions/full RPC oracles remain unchanged.

Parent frozen7 RED:5 failed/2 passed, intended stale-token/full call-history
assertions; format/ESLint0. Independent6.1 found no false oracle or extraction
weakening, but a mutation normalizing every thrown reclaim failure to
DEPENDENCY_UNAVAILABLE could evade all7. Actual SQL021490:310–313 checks CAS and
returns CONFLICT before the unavailable lease branch in a competing-claim path.
Existing unavailable fixture remains a valid controlled response, NOT this race.

Add one controlled nonretryable CONFLICT reclaim scenario through the actual
factory. Assert exact CONFLICT reason, terminal result/null retry delay, canonical
sealed ready metadata, and complete RPC history ending at canonical reclaim;
no subsequent heartbeat/backfill/verification/activation. Expand the existing
reclaim table without weakening its three old rows, or add an exact separate
case. Preserve first claim, scan/seal and fingerprints/cursor/version operands.
Eight cases total. This proves Worker propagation, NOT SQL concurrent claims or
authority. Freeze source UNRUN; root formats/executes RED before sole-producer
handoff GREEN. The independent UUID producer author owns a disjoint3-file scope.
