# Native QA amendment — recovery fixture models canonical reclaim

Root `/home/rob/.codex/worktrees/phase2-slice11/WeJammin` only. Native author
gpt-6-astra/high, parent/review6.1/ultra. Parent checkpoint/push/remote verification
before dispatch. Edit ONLY
`apps/worker/src/content-schema-registry/migration-worker-recovery.test.ts`
(<=400 formatted lines). Existing two literal titles and all assertions retained,
including full ordered RPC equality; strengthen the changed transition, never
delete/loosen its oracle. No producer/other test/support/README/tracking edits.
PURE ctx JavaScript fs/path/native apply_patch ONLY; NO commands/exec/write_stdin/
shell/child_process/scripts/tests/DB/network/format/lint/TSC/git/packages/commits/
nested agents. Source UNRUN, freeze; root executes.

Parent new191/191 GREEN, independent6.1 handoff no bounded gap. Broader registry
149 suites2512: one failure/2511 passed, only recovery AC-188 full history now
has the required second claim after seal, while old expected history omits it.
Old claim handler always returns dry_running version4/cursor42 even for backfill.
This is an inconsistent controlled fixture, NOT evidence that skipping reclaim
is correct. Real SQL seal clears the token; real next claim returns running with
fresh lease, incremented canonical version and reset cursor/progress.

Preserve first expired dry-run claim/resumed cursor42 and its canonical version4
after original version3. Keep successful finalization ready version5/cursor100,
with canonical sealed counts and no held lease. Model second claim explicitly:
acquired fresh lease, running version6, reset cursor0/progress0, then verification
version7 and completion version8. Keep existing activation/result assertions
and untouched cursor-regression case. Add second claim to full expected RPC
history at its exact post-seal position. Assert both complete claim request
bodies (first version3/cursor42, second sealed version5/cursor100, fingerprints,
worker/lease duration/time and exact signal) so stale job versions/cursors or
failure to adopt the reset cannot hide. Retain/strengthen ensuing correct lease/
version/cursor assertions where needed; do not merely accept an extra call.

Controlled response fixtures remain unit recovery behavior, NOT SQL authority,
real100-row scan, approval, activation, races or S09 acceptance evidence. No
new fake approval or disabled guard. Root performs full frozen regression and
independent bounded review before any completion claim.
