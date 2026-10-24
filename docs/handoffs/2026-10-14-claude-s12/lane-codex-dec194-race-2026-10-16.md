# DEC-194 deterministic producer race — author freeze, UNRUN

Native lane `native_dec194_race_red_20261016`, assigned `gpt-6.1-sol` / `ultra`.
Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`; protected primary untouched.
Only the three originally claimed new paths and the root-approved/claimed `091` helper were written.
No production/WIP/schema/spec/tracker/old-test/helper/registry edits. No runtime, parser, test,
database, Docker, lock, network or Git command was run by this author. Context-mode performed
source/skill reads and text/hash analysis; every file edit used absolute-path `apply_patch`.

## Frozen files

Physical counts below precede root formatting; root owns formatting and the <=400-line check.

| File | Lines | SHA-256 |
| --- | ---: | --- |
| `supabase/tests/phase_02_slice_12_dec194_sweep/090-race-fixture.sqlinc` | 179 | `26131d66cfdfbec1a77dfaeb7262773a42614c868449fa0883c44f861db2e383` |
| `supabase/tests/phase_02_slice_12_dec194_sweep/091-race-session-kit.mjs` | 221 | `7cf9c43ea560a2f4fe70325eb7419ed68336a0fc139bb883526b0773cba095ee` |
| `supabase/tests/phase_02_slice_12_dec194_sweep.race.mjs` | 239 | `612d11bc358e7cbe4980b7a77dcd2ed080353a0e01c7adf81590dd532f8a402c` |

The report's own hash is returned separately; no self-hash is embedded.

## Contract and source

BE03c `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md:1497` preserves the ordinary
merge's idempotent continuation request. Its `:1514` recovery rule alone requires no queued/running
Job, remaining work, the 15-minute bound and fewer than three consecutive failed generations.
Root clarified that an ordinary request AFTER recovery may legitimately accept its own Job.
The oracle therefore requires one recovery acceptance plus serialized existing producer behavior;
it never imposes a global one-Job invariant or new ordinary coalescing semantics.

The current ordinary producer is
`supabase/migrations/20261014120300_cms_taxonomy_merge_convergence.sql:123-142`.
The fenced continuation is
`supabase/migrations/20261014120810_cms_taxonomy_merge_handler_fenced.sql:58-122` and its real
service-role transport is `20261014120820_cms_run_taxonomy_merge_converge_claimed.sql:15-66`.
The current recovery WIP's eligibility checks and acceptance are
`supabase/migrations-wip/dec194/20261014190000_cms_reconcile_taxonomy_merge_converge.sql:40-77`;
its `now_at` is captured before any proposed party-mutex wait (`:34`).

The actual BE00 acceptance boundary is
`supabase/migrations/20260830120000_persistence_runtime_authority.sql:126-135`:
INSERT ON CONFLICT, then the reserved receipt SELECT FOR UPDATE. Its Job/outbox/audit/receipt
completion is `:159-191`. No replacement acceptance implementation or test trigger is installed.

## Deterministic boundary

`090` seeds ONLY the exact RESERVED receipt under Q's recovery key, with its real request hash.
An owned interactive psql transaction locks that row FOR UPDATE and waits for more stdin.
The real sweep must then be observed blocked by that holder's ACTUAL PID. One probe requires
`pg_blocking_pids`, matching waiting/granted transaction-id locks in `pg_locks`, and a granted
RowShareLock on `idempotency_records`. RowShareLock distinguishes SELECT FOR UPDATE from merely
waiting in INSERT. The holder owns only this receipt row and changes nothing.

While the sweep is paused after eligibility, the other producer must be observed waiting on
the SAME advisory key held by the sweep: matching database/classid/objid/objsubid, actual PIDs,
and ExclusiveLock on both sides. A producer reaching its ready marker instead fails immediately
with `producer statement completed while the required blocker still held its transaction`.
That is the predicted meaningful S1 RED on the current WIP, after all eligibility controls pass;
an absent future helper/table is not needed to produce it.

Release is explicit COMMIT, acknowledged before disconnect. The same backend must still be idle,
connected, outside a transaction, and hold no advisory lock. Thus transaction scope is checked
independently of connection termination. No `pg_sleep` or elapsed sleep is race proof; JS's 100ms
delay is polling cadence only. Every barrier uses observed database state and a finite deadline.

## Scenarios

| Case | Ordering and decisive result |
| --- | --- |
| S1 | Sweep receipt barrier first; ordinary request waits; recovery commits exactly one R and Q→R; ordinary then legitimately commits its own Job. Each acceptance has exactly one correctly bound outbox/audit/receipt. |
| S2 | Same sweep barrier; a genuinely old terminal claim waits, then refuses P0001 CONFLICT after release with no result or other effect. |
| S3 | Ordinary Job accepted but uncommitted first and aged through the existing labelled option; sweep waits; after commit live=1, idle>=20m, work=3, streak=0 and the expected failed head are asserted before requested=0. Only the live-Job guard can refuse. |
| S4 | New producer Job fails just now; sweep waits; no live Job, work=3, streak=2, but fresh activity alone means requested=0. |
| S5 | New producer Job fails and is independently aged; post-wait latest failed Q is reselected; exactly one R derives its key/correlation from the NEW Q, never the stale candidate. |
| S6 | Two old failed generations plus the new aged failure; post-wait streak=3 alone refuses recovery. |
| S7 | Producer cancels its Job, drains work and is aged; no live Job, idle>=20m, streak=0, but work=0 alone refuses recovery. |
| S8 | Producer failure is 14m52s old; sweep is proven waiting BEFORE its 15m cutoff; the actual DB clock crosses that cutoff before producer COMMIT; fresh post-wait time must admit one recovery. A cached pre-wait now_at refuses incorrectly. |
| S9 | Real claimed continuation reaches its own receipt barrier after converging exactly 1/3 assignments; recovery waits on its mutex, then sees the live committed chain and requests zero. |
| S10–S12 | A claim valid at the observed mutex wait becomes terminal, expires by the actual DB clock, or is re-claimed through BE00. After release its stale delivery must refuse CONFLICT with no changed existing acceptance row, taxonomy store or association. |

Producer-first cases assert each live/work/streak/activity/head conjunct separately after the wait.
Snapshots contain FULL existing Job/outbox/audit/receipt rows, so removal, replacement or changes
are detected, not just counts. New acceptances assert actor, acting party, correlation, queued v1
where applicable, originating event, exact event payload, audit target/decision/reason, derived
key AND request hash, and exact completed response_ref. The sweep answer is exactly `{ requested }`.
An open recovery transaction's entire snapshot must remain invisible to another session.
TTL/durable-repeat proof remains in the existing, frozen `060-idempotency-expiry.sqlinc`.

## Fixtures and limits

Bootstrap reuses the existing real S09/CMS governance and taxonomy setup. Terms and their merges
come through CMS-03C-03. The ordinary race calls the ACTUAL private enqueue helper used by that
command, deliberately isolating enqueue serialization from outer merge/version/term locks; this
is not an outer-CMS-command lock-order proof. Continuation uses the actual service-role RPC and
real BE00 claim receipts, and terminal outcomes/reclaims use real BE00 commands.

Labelled fixtures remain explicit: existing identity/tenure and entry/assignment scaffolding;
BE00 accepts/claims/outcomes modelling earlier delivery history; a RESERVED receipt modelling
unfinished acceptance; created_at/updated_at shifts modelling time passage. No state, token,
version, lease, completed receipt, recovery association or producer result is forged.
`090` functions are pg_temp. Four private-to-the-test public scratch tables persist identifiers
between sessions; preflight proves ALL absent before this lane owns them. Cleanup rolls back
owned open transactions, terminates only exact owned PID+application pairs if necessary, proves
owned backends absent, and removes those four tables even if bootstrap committed then failed.
Committed synthetic application fixtures remain for root's mandatory ALT reset.

The main module has active top-level DB work: NEVER import it or use a checker that might execute
it. Root owns non-executing parsing, formatting, independent readback and actual runtime.

## Isolation hazard — NOT cleared

The shared mutex only fixes the stale eligibility/fence race when the reads AFTER its wait get
a fresh snapshot. These direct sessions explicitly BEGIN READ COMMITTED, and a default-isolation
control is asserted. They do not prove the actual Worker/PostgREST RPC transaction isolation.
REPEATABLE READ or SERIALIZABLE retains its transaction snapshot across an advisory-lock wait;
mutex acquisition alone does not refresh visible Jobs, failed-head ordering or authority/fencing.
Root must prove isolation on the actual RPC path and confirm the fresh SQL reads/fencing occur
after its mutex acquisition. No hosted/canonical acceptance or production release is claimed here.

## Independent-review S3 correction

Review blocked S3 because its fresh ordinary Job also activated the 15-minute refusal, hiding a
missing no-live guard. This correction changes only the runner and this report: the `live` mode
now uses the existing `p_old=true` option, and its activity assertion requires idle>=20m instead
of bypassing that conjunct. The existing live=1/work=3/streak=0/failed-head checks still precede
the requested=0 assertion. All 12 case counts and every other oracle are unchanged; no fixture
or session-helper edit. Correction remains author-UNRUN; root owns readback and the ALT release.

## Root continuation

1. Read all four files, format/check line bounds without executing the runner, and obtain independent review.
2. Release one explicit ALT race diagnostic only after valid fixtures and the intended S1 RED are reviewable.
3. Launch requires `S10_RACE_DB_CONTAINER` and `S12_DEC194_RACE_ALT_CONTAINER` to identify the SAME explicit
   non-default local container, plus `S12_DEC194_RACE_ROOT_RELEASE=2026-10-16-native-red`. The primary
   `/home/rob/Projects/WeJammin` checkout and `supabase_db_wejammin` are rejected before any DB process.
4. Preserve real failure identities, PID/lock evidence and cleanup proof; reset ALT before reuse.
5. Only root may release producer GREEN or register this runner in `infra/run-database-race-runners.mjs`.

No blocker; this checkpoint is AUTHORED/UNRUN, not RED observed, GREEN, validation passed or slice acceptance.
