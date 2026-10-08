# Slice 10 independent-session race runners

Two-session (and N-session) evidence for the write-path locks of the Slice 10 editorial
commands (`cms_create_entry`, `cms_create_revision`, `cms_resolve_conflict`,
`cms_restore_revision`). A single pgTAP transaction cannot interleave two sessions, so each
runner drives fresh committed `psql` sessions inside the disposable local database and proves
an ordering or lock guarantee. They are **not** Supabase-discovered tests: `pnpm db:test` never
runs them. `infra/run-database-race-runners.mjs` (`pnpm db:races`, part of `pnpm db:verify`)
executes every runner, resetting the database before each one and once more at the end.

| Runner                             | Proves                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `010-activation-serialization.mjs` | The REAL schema activation commands (the human CMS-03A-04 switch and the Worker's second switch) against each of the four writers over a type and an approved candidate built through the named commands: a writer parked between its authority locks and its version lock never deadlocks with the activation (S1: the writer commits, the activation is refused `CONFLICT` / `MIGRATION_SOURCE_DRIFT`); an in-flight activation blocks a starting writer, which is then refused with a typed error and writes nothing (S2); the Slice 09 insert-time guard stays the backstop (S3); a deadlock outside the lock order is the typed retryable `CONFLICT` for every wrapper and a retry succeeds (S4).                           |
| `011-authority-revocation.mjs`     | A committed revocation (actor grant, membership tenure or entry assignment) wins over an in-flight write; a later one waits for the write to commit.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `014-revocation-vs-activation.mjs` | The real CMS-03A-17 revocation of a counted specialist approver's grant, and the end of the approver's membership, against both activation commands over a protected-policy candidate: paused mid-activation neither side is aborted by a deadlock (the activation, which holds the authority rows first, commits and the revocation then commits); a revocation committed first wins (the activation is refused, the review is `invalidated`, the candidate is back to `draft`). A reviewer-class grant row committed after the activation's early authority scan is revoked while the activation is paused and neither side waits for the other: the activation never rescans authority rows once it holds the candidate (R3). |
| `012-relation-target-race.mjs`     | The external content targets of a relation value (set, carried or restored) are locked `FOR SHARE` in ascending id order before they are checked, so a target bump, archive or assignment revocation blocks behind an in-flight write and a write that meets a committed change is refused; two writers that reference each other deadlock into a typed `CONFLICT`.                                                                                                                                                                                                                                                                                                                                                              |
| `013-revision-concurrency-cap.mjs` | Concurrent revision writes cap at three per actor in the database transaction (three per-actor advisory slots held to transaction end): a fourth is `RATE_LIMITED` before any insert, an exact replay is still answered, another actor is not limited, and the slots free on commit.                                                                                                                                                                                                                                                                                                                                                                                                                                             |

Shared machinery lives in `infra/database-races/race-kit.mjs` (fixture, gate, session helpers) and, for the
runners that need REAL schema activation, `infra/database-races/chain-kit.mjs`: it builds the Slice 09 world
(owner organization, reviewers) and takes types through the named commands (draft, dry-run, worker seal, submit,
assign, decide, activate; then successor, worker scan, decide, worker backfill). The pgTAP state those fragments keep
is carried between committed scripts in two scratch tables (`public.s10chain_actor`, `public.s10chain_ids`) of the
disposable race database.
A writer is held deterministically between its validation and its first revision insert by a
gate trigger the kit installs (a BEFORE INSERT probe on `cms_entry_revisions` that blocks on a
shared advisory lock keyed by the session `application_name`); the probes write nothing and
claim no producer path.

## Adding a runner

1. Create `NNN-name.mjs` here, import the kit, call `buildFixture()` and `installGateTrigger()`.
2. Drive producers only through the named commands (`callCommand`, `prepareWrite`,
   `startGatedWrite`); use explicit row locks or the documented revocation updates as probes.
3. Print one `ok - ...` line per assertion (`check`); exit non-zero on the first failure and
   always open every gate in `finally`. A runner that needs a real activation uses `chain-kit.mjs`
   (`buildWorld`, `buildSources`, `buildCandidates`, `activationScript`).
4. Add the path to `RACE_RUNNERS` in `infra/run-database-race-runners.mjs` (the gate test
   requires every `.mjs` under `supabase/tests` to be listed).

Related: `../phase_02_slice_09_scan/README.md` (the Slice 09 entry-lock race), `../phase_02_slice_10_write_path_locks.sql` (the single-session catalog and behavior checks).
