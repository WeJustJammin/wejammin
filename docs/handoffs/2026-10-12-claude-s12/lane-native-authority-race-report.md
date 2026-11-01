# Native authority-race static correction report

Date: 2026-10-13. Lane: `native_s12_authority_race`. Model: `gpt-6-astra`, requested effort `ultra`.
Worktree: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.

Status: static changes authored; **runtime UNRUN**. Zero acceptance ticks; no completion signature.
No database, Docker, network, service, runner import, reset, full canonical validation, migration,
runner-registration, or protected-primary-checkout change was performed. No staging or commit.

## Owned patch

- `supabase/tests/phase_02_slice_12_governed_authority.race.mjs`
- `supabase/tests/phase_02_slice_12_governed_authority/governed-authority-kit.mjs`
- `supabase/tests/phase_02_slice_12_governed_authority/governed-authority-sessions.mjs` (new)
- `supabase/tests/phase_02_slice_12_governed_authority/governed-authority-assertions.mjs` (new)
- `supabase/tests/phase_02_slice_12_governed_authority/governed-authority-processes.mjs` (new)
- `supabase/tests/phase_02_slice_12_governed_authority/governed-authority-execution.mjs` (new)
- `supabase/tests/phase_02_slice_12_governed_authority/governed-authority-fixture.mjs` (new)
- `supabase/tests/phase_02_slice_12_governed_authority/README.md`
- This report.

The former support file had 309 content lines (310 split-array entries including the terminal
newline), exceeding the utility limit. It is now split by fixture/request, process execution,
cleanup, barrier and assertion responsibilities. Every module is at most 300 lines. Existing user
work outside these owned files was preserved. Shared helpers and SQL fragments remain read-only.

## Static findings corrected

1. The prior fixture imported the h11 world and governed-submit fixtures, which directly changed
   type versions to `active`. The owned fixture now selectively executes the audited SQL fragments
   underlying S09 `buildWorld`, `buildSources(['govrace'])`, and `bindOwner`, then grants
   `cms.template_designer` through CMS-03A-15 and mints both templates through CMS-03C-01. No fake
   active pattern, direct active-type mutation, or disabled guard is used by this lane.
2. The writer preserves actual `SET LOCAL ROLE service_role` and now emits/asserts `current_user`.
   Worker-style claims carry the human auth/person/organization and a real acting-context binding.
   Administrative fixture/probe/subject-lock/revocation sessions are separately identified.
3. Separate barrier observations could leave the second assertion detached from the first wait.
   S1 now requires `revoker → writer → subject holder` in one `pg_blocking_pids` probe. The holder
   verifies the exact subject exists before its real `FOR UPDATE` and sleep readiness marker.
4. The first correction still had a P1 cleanup gap: shared `race-kit.mjs` synchronous
   `runScript`/`runValue` killed only the Docker client after 300/60 seconds; fixture, probe,
   snapshot and restore backends were not in the owned registry. Independent native review
   blocked that revision. The bounded second correction replaces **all** execution with the
   owned asynchronous facade described below; every call site now awaits its actual result.
5. S1 previously counted dependencies without checking their identity. It now requires exactly
   one added immutable dependency: this review, owner, `content_type`, and the real active type
   **version** ID. Pre-existing dependency rows must remain unchanged.
6. S1 previously counted all completed CMS-03C-06 reservations. It now requires exactly one new
   row with this actor, operation, key hash, actor-party-scoped request fingerprint, completed
   state, review resource reference, 201 status, and exact persisted response body. Existing rows
   must remain unchanged.
7. S1 now compares all subject fields; only state, lifecycle counter (+1), and update time may
   change. Exactly one ordinary open review freezes the subject version/hash/lineage/key. Exactly
   one audit identifies this actor/party/review/correlation; the complete outbox is unchanged.
8. S2 now rejects both a fresh submission and the exact successful S1 request/key after revocation
   commits. Both require SQLSTATE `P0001`, token `capability_missing`, no successful/cached body,
   and full ordered rows of reviews, dependencies, template versions, audit, outbox, and
   idempotency unchanged. The raw PostgreSQL JSON serialization is retained as well as parsed
   values so numeric precision loss cannot make the refusal snapshot falsely equal.

## Selective S09 reuse audit

The invoked SQL chain is `s09d_create_type → s09d_to_active → s09d_to_approved → dry_run / seal / submit /
assign / decide / activate`; the type state is produced by the activation RPC. `insertGrantRow`,
`s09d_timewarp`, `s09g_warp`, and trigger-disabling paths are not invoked. `chain-kit.mjs` is not
wholesale trusted: its unused `insertGrantRow` helper explicitly bypasses triggers and is excluded.
No shared JavaScript execution helper is now imported or called. The owned fixture reads the
existing S09 helper/actor/chain/support/worker and grant SQL fragments; runs the real author/editor
grants, type producer and fresh binding in one committed transaction; and checks producer outcomes.

The shared S09 actor setup contains labeled, unrelated negative-control direct membership/grant
fixtures. Its ordinary schema reviewer uses a real identity, binding and effective assignment;
the schema review helper treats later required capabilities as specialist slots. This is fixture
provenance, not a new claim that S09 authorization or the entire producer chain passed today.
The racing submitter's designer grant is produced explicitly through CMS-03A-15 with guards active.

The revoker intentionally updates the exact `identity_private.organization_actor_grant` projection
row. This proves that lock seam only after execution; it does not claim the full CMS-03A-17
revocation command, governed invalidation job, or aggregate/event behavior. The SQL token test does
not establish the Worker's HTTP 403 mapping.

## P1 cleanup remediation — authored, UNRUN

`governed-authority-processes.mjs` is the sole process-spawning boundary. Every fixture command,
probe, snapshot, restoration, holder, writer, revoker and cleanup controller registers a unique
exact `PGAPPNAME` before SQL is sent. No broad PID/name-prefix termination is used. Startup settings
are passed to `psql` through `PGOPTIONS`, not deferred to SQL after connection:

- Ordinary sessions: statement 60s, lock 30s, idle-in-transaction 60s and idle-session 60s.
- Cleanup controllers: statement 5s, lock 1s, idle-in-transaction 5s and idle-session 5s.
- All sessions: `PGCONNECT_TIMEOUT=5`; outcome deadlines are 45s ordinary / 8s cleanup.

The owned asynchronous `queryValue`/`queryScript` facade replaces shared execution throughout
the fixture, kit, barriers, assertions and runner. Snapshot/refusal/success assertions are async
and awaited; no Promise can satisfy an intended boolean/string assertion accidentally.

Cleanup performs two finite tracked-controller passes. Each uses only registered exact names,
terminates matching backends, clears PostgreSQL's statistics snapshot while checking absence,
and emits an absence marker. It then terminates its own backend; success requires that marker
and the verbose SQLSTATE `57P01` self-termination acknowledgement. This closes the final verifier
without recursively spawning another cleanup verifier. Later passes include earlier controllers.
Each corresponding local child is reaped with 0.5s/1s/1s bounded waits and exact-child TERM/KILL
fallback. The second pass follows reaping to cover startup/reap ordering. Any failed pass remains
an error even if the second succeeds. Controller/reap errors and the original race failure are
retained together. Readiness failures use this same tracked release path.

These are static lifecycle corrections, **not runtime cleanup proof**. SQL parsing, timeout
enforcement, final self-termination acknowledgement and post-failure backend absence remain UNRUN.

## Static verification

Pinned binary `/home/rob/.local/share/wejammin-toolchain/bin/node` reported `v22.23.1`.
Each module passed `node --check` with exit 0 under shared `/tmp/wejammin-quiet.lock`.
Focused Prettier formatting/check completed with exit 0; no module was imported or executed.

| File                                            | Content lines | SHA-256                                                            |
| ----------------------------------------------- | ------------: | ------------------------------------------------------------------ |
| `phase_02_slice_12_governed_authority.race.mjs` |           167 | `e0e91c5c86f36c1b9747e6b6e04bb6ef0c14a524f152e32dda5552d340257830` |
| `governed-authority-kit.mjs`                    |            97 | `f06539ebe1fb08fdebfba3ec93dbd1a245612d5ce42df679d427de7c7a609036` |
| `governed-authority-sessions.mjs`               |            81 | `3a7377cb78ad23fe2facf88d6ee52acef79c9d006faf29f00d301d1faca7f457` |
| `governed-authority-assertions.mjs`             |           291 | `eeba431f5f45763a5d54e59d87d12712a87260cec7ec0d31366b8012fc2da60f` |
| `governed-authority-processes.mjs`              |           133 | `6d39a94860ec59c878c69a43bf8deb6f88cef02438f44b41fc5fba4561826dc0` |
| `governed-authority-execution.mjs`              |           137 | `8ae5551900202a78a20c4bf43397e7518a16d09b4469dac240d2705224d74b71` |
| `governed-authority-fixture.mjs`                |            64 | `77028babcfee8f9491fcadb021e88c4d1269ca95fcf77c6c114389f53bd50b17` |

The source hashes describe authored bytes, not runtime acceptance. Node syntax cannot validate
embedded SQL, role ACLs, fixture producer success, lock ordering, or teardown behavior.

## Remaining prerequisites and next step

Root must first establish governed-submit GREEN, obtain independent native static re-review,
and separately explicitly release a focused database race run. Then
run against a freshly reset disposable local database with pinned Node 22.23.1/pnpm 11.24.0 and
the quiet/database/reset locks. Confirm real S09 type production and the new designer/template
fixture commands before interpreting any race assertion. Execute S1 and both S2 refusals, verify
all exact backends are gone on success and deliberately induced fixture/probe/restore timeout
and barrier/assertion failure. Verify cleanup-controller acknowledgement and child reaping, then
reset afterward. Root owns any registration in the canonical race runner and all broader gates.

Implementation/TDD, testing-strategist, systematic-debugging and migration-management skills
guided the assertion depth, failure analysis and lifecycle separation. Their runtime/validation
completion gates remain pending under the explicit static-only lane assignment. This report is
a partial Slice 12 handoff, not a RED/GREEN receipt or slice completion.
