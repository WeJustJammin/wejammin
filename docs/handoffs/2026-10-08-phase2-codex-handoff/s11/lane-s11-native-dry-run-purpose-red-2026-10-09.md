# Native QA-RED — trusted dry-run execution boundary

Root `/home/rob/.codex/worktrees/phase2-slice11/WeJammin` only. Native author
gpt-6-astra/high; parent/review6.1/ultra. Parent checkpoint/push/remote verification
before dispatch. Exact write scope ONLY new files:

- `apps/worker/src/content-schema-registry/migration-worker-dry-run-purpose.test.ts`
  (<=400 formatted lines).
- Optional `apps/worker/src/content-schema-registry/migration-worker-dry-run-purpose-test-support.ts`
  (<=300 formatted lines).

PURE ctx JavaScript fs/path reads and native apply_patch writes ONLY. NO commands/
exec/write_stdin/shell/child_process/scripts/tests/DB/network/format/lint/TSC/git/
packages/commits/nested agents. No producer/old-test/old-support/README/tracking
changes. Source UNRUN; parent witnesses RED before any implementation.

Locked BE03a2272 separates CMS03A10 dry-run scanning from CMS03A04 backfill;
2497–2517 requires sealed passed report before human review/decision/public
activation. Public SQL0220201121–1153 persists BE00 job type cms.schema.dry_run
and dry_run.requested.v1. Actual full engine currently falls through seal→ready→
backfill→verification→private activation before review. Parent genuine lifecycle
freshCI0/flock/main reset0:7/7 RED at preserved no-refused-RPC assertion; every
case activate/reconcile/rollback400. Status-only receipt does not prove SQL reason
or bypass. Closing reset0. Existing approval guards remain intact.

Prepare behavioral tests through existing actual createSchemaMigrationWorker
and real scanner/stages, using clearly controlled typed ports. Proposed private
dependency configuration is executionPurpose:'dry_run'|'activation', default
activation for existing behavior; configuration is trusted process wiring, NEVER
a job/browser/event payload flag. To exercise currently ignored dry_run wiring
without casts, construct a dependency object variable with the literal purpose
then pass it to the existing factory. Old constructor currently ignores it,
yielding an intended behavior RED, not a missing-import/setup failure.

Required boundaries:

- Successful nonzero dry-run seals canonical ready/report evidence, returns job
  completed with state ready, truthful cursor/progress, activationSwitched:false,
  exact identity and null reason/delay; complete ordered RPC bodies stop at seal.
  No reclaim/backfill/beginVerification/verify/complete/privateactivate/reconcile.
  Use actual bounded source scanning and sealed canonical token removal.
- A ready retry under the same trusted purpose is read-only, uses newer canonical
  plan version rather than original job, never reclaims/scans/reopens/activates.
- Partial dry-running yields existing exact progress with held lease, no seal or
  phase crossing; failed/invalid finalize preserves actual retry/failure semantics
  and allowed failure cleanup, rather than suppressing a failure.
- Blocked dry-run remains blocked, not success/activation. Default/explicit
  activation purpose retains existing canonical reclaim/backfill behavior; reuse
  frozen sealed support or existing helpers read-only where appropriate.
- Constructor rejects unsupported/malformed purpose before effects, without
  normalization; malformed private-config fixtures may use Object.defineProperty
  on otherwise typed config, no any/cast bypass. Wire executionPurpose remains
  rejected by existing strict5-field job input. A valid activation queue envelope
  must not execute through dry-run-purpose wiring; distinguish wrong-purpose
  refusal from ordinary scan failure and require no migration effects.

Read complete relevant engine/runtime/types/admission/result and actual SQL seal/
claim source before selecting exact existing safe failure codes and fixtures.
Do not invent approvals or disable guards. New tests prove core Worker behavior,
NOT production factory/BE00 dispatcher/event-family wiring, SQL sealing races,
real approval/activation or hosted acceptance. A named production seal-only
factory and trusted persisted-job dispatch remain subsequent scoped wiring.
Zero-source ready→approved public activation has an existing legal SQL advance;
nonzero activation-job handoff remains independently missing. No completion claim.
