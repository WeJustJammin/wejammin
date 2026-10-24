# Independent review: lane governed-b fix pass (delta after review-governed-b.md, root rulings briefs/governed-b-f1.md)

Reviewer: independent (Fable 5.1), static only; no DB, no test run, no source edit. Worktree
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e` (verified).
Author report `docs/handoffs/2026-10-14-claude-s12/lane-governed-b-report.md` `## Fix pass`; hashes not re-verified (brief excludes item 5).
Paths relative to the worktree. `WIP` = `supabase/migrations-wip/governed-b/`, `T-act` = `supabase/tests/phase_02_slice_12_governed_activation/`,
`T-sch` = `supabase/tests/phase_02_slice_12_governed_schedule/`, `T-lad` = `supabase/tests/phase_02_slice_12_governed_schedule_ladder/`,
BE03c = `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`, BE03b = `.memory/wiki/specs/be/03b-editorial-workflow-publication.md`.

## Status

Rulings 2, 3 and 4 are met exactly; ruling 1 is met in placement (the advisory lock is last, keyed as the executor's, RED-proven from
`pg_locks`) but the conflict re-read under it is a `FOR UPDATE`, i.e. a position-3 lock taken after the last position, which BE03c 1338
forbids and which deadlocks a stale and a fresh switcher of one lineage. One major (one-line fix in two files, before promotion makes the
bytes immutable), three minors. Everything else in the delta is faithful, deadlock-free by construction and non-vacuously tested.

## Findings

1. `WIP/20261014070400_cms_activate_governed_subject.sql:172-173` and its unchanged twin `WIP/20261014070600_cms_execute_governed_activation.sql:181-182`
   — **major** — the re-read under the advisory lock calls `cms_governed_lock_lineage_active`, whose every branch is `... for update`
   (`WIP/20261014070000:28-29,31-32,34-35`). Non-conflict branch: it re-locks the row this transaction already holds from step 5
   (`070400:101`, `070600:138-139`) or finds nothing, so it never waits — correct. Conflict branch (`v_active` NULL at step 5, a newer
   version V1 `active` now): it acquires a position-3 row lock after the last position. BE03c 1338: "never acquires an earlier position
   after a later one"; `070000:3-4` claims the helpers never do. Reachable cycle: A commits the lineage's first activation (V1); B, whose
   step-5 read predates A's commit, reaches step 9 and holds the advisory lock (`070400:170`); C, whose step-5 read postdates it, holds V1
   `FOR UPDATE` (`070400:101`) and waits at `:170`; B's re-read waits on V1 → `deadlock_detected` → the wrapper's `CONFLICT`
   (`070410:16-22`), not the spec's `activation_conflict` (BE03c 1326), and if the victim is C the legitimate winner retries for nothing.
   Executor variant (`070600:181`): the Worker gets a thrown `CONFLICT` instead of the retry result of `:183`, the lease stays
   `executing` and the claim recovers it only after the five-minute expiry — one ladder step lost. Nothing commits, the one-active
   invariant holds (partial unique), so availability, not corruption; needs three near-simultaneous switchers on a lineage that has no
   active version (its first activation), so narrow — but it is exactly the branch ruling 1 was to make deterministic. Fix: under the
   advisory lock no writer of the lineage's active row can be in flight (both switchers take the lock before `cms_governed_apply_activation`;
   nothing else leaves `active`: `20261014010000:56` state list, `070000:100-137`), so the re-read needs no lock: a plain
   `select id ... where state = 'active' and id <> subject` (a `stable` sibling of `cms_governed_lock_lineage_active`, or a `p_lock`
   flag) at both call sites; `cms_governed_supersede_lineage`'s own `FOR UPDATE` (`070000:109`) then only ever re-locks the step-5 row.
   Taking the advisory lock first instead would also be cycle-free but contradicts the 1348 row text and holds the lineage across the
   recheck. Unprovable in pgTAP; see finding 4.
2. `WIP/20261014070400:170-171`, `WIP/20261014070600:179-180`, `T-act/090-lineage-lock.sqlinc:10` — **minor, convention** — the key literal
   `'cms.governed.lineage:' || kind || ':' || lineage` is now written twice in production (`.claude/rules/extensibility.md`: "if you wrote
   it twice, extract it"); one `cms_governed_lineage_lock_key(kind, lineage)` helper is also the natural home of finding 1's non-locking
   re-read. Same function, two sources for one value: `070400:101` keys step 5 on `v_review.lineage_id`, `:171,173` on
   `v_subject->>'lineageId'` — equal by the review guard (`20261013300600:55`), but pick one.
3. `WIP/20261014070400:168` (Decision 3 of the author's report) — **minor, spec text** — `schedule` takes no advisory lock, while the BE03c
   1348 row covers "activation, scheduling and retirement ... last the lineage advisory lock" and 1326 has the command run "holding the
   review row and the lineage advisory lock". Harmless (scheduling switches nothing; one live schedule per subject is the partial unique
   at `070400:193-194`), but a literal deviation root must ratify in the DEC text or amend in the row.
4. `T-act/090-lineage-lock.sqlinc:7-22` — **minor, test scope** — the oracle proves a granted `ExclusiveLock` advisory lock with the key's
   `(classid, objid, objsubid = 1)` is held by the backend after a committed `activate` and not before (correct 64-bit split, `:13`); it
   cannot prove the lock is xact-scoped (a session `pg_advisory_lock` would pass), is taken last, or precedes `cms_governed_apply_activation`.
   Within one pgTAP session nothing more is provable and the RED is real (F1: 78 `not ok`, 77 `ok`, the only failure). Root: a two-session
   race check in the canonical gate (outside lane constraints) is the only proof of `activation_conflict` and would also expose finding 1.

## The brief's four questions

| Question | Answer | Evidence |
| --- | --- | --- |
| Advisory lock last, relative to BE03c 1336-1348? | Yes in both producers; no path takes it first | `070400:170` after positions 1 (`:82`), 3 (`:96,:101`), 3-4 (`:103`), 5 (`:104-105`) and the step-8 schedule rows via `cms_governed_invalidate_approved_review` (`070000:181-186`, returns before step 9); `070600:179` after 1 (`:132`), 3 (`:134,:138`), 3-4 (`:140`), 5 (`:141`), 6 (`:143-144`). grep: `pg_advisory` only at those two lines |
| Deadlock risk vs other paths? | Only the post-advisory `FOR UPDATE` re-read (finding 1). Claim never waits (`SKIP LOCKED` at `070500:49,52`; `cms_governed_move_subject` updates the subject row only, `20261014010000:62-73`); revocation (position 1 `FOR UPDATE`) vs activator (1 `FOR SHARE`) is acyclic; schedule (6) before advisory in the executor | `070100:110-118`, `070500:51-59`, `070600:143-144,179` |
| Re-read conflict check sound? | Yes, every case: NULL/NULL proceed; V0/V0 proceed (V0 held since step 5, so it cannot be superseded and the unique forbids a second active); NULL/V1 `activation_conflict`; V0/NULL and V0/V1 unreachable (V0 held). A step-5 wait on a row being superseded re-evaluates to NULL (V1 unseen), the re-read then sees V1 → conflict: a two-party race is deterministic; only the first-activation three-party case deadlocks | `070400:101,172-174`, `070000:17-41`, `is distinct from` handles NULL |
| Lease change exactly 03b's? | Yes. Both looks check only `state <> 'executing' or lease_id is distinct from` — identical to the 03b executor; 03b's recovery is `FOR UPDATE SKIP LOCKED` on schedule rows, as here, so an executor holding the row is skipped | `070600:123-125,149-151` = `supabase/migrations/20261005017740:144-146,166-168`; `070500:42-49` = `20261005017730:246-257`; BE03b 1896 "a lease that no longer matches is refused"; BE03c 188 "same claim, lease, retry ladder and idempotency as CMS-03B-20" |

## Delta conformance (rulings)

| Ruling / clause | Implemented | Tested |
| --- | --- | --- |
| 1 lineage advisory lock on `activate`, executor's key, `activation_conflict` on a changed active row, nothing commits | `070400:168-175` (lock OK; re-read lock = finding 1) | `T-act/090` (lock held); conflict branch unprovable |
| 2 claim takes the subject `FOR UPDATE SKIP LOCKED` only when the expired lease exhausts (`attempt_count >= 3`), blocks schedule `retries_exhausted` (no `attempt_count` increment, `070100:39-43`) and a `scheduled` subject only (`070100:134`); unavailable subject left for the next claim; ratification in the header | `070500:7-10,51-59` | `T-lad/010:155-170` (c5: schedule v9 blocked, subject blocked lifecycle 5, review approved v2, no event, one audit); `:171-175` late executor `CONFLICT`; mutant B kills test 22. `continue` branch untestable sequentially |
| 2 `blocked -> scheduled` after exhaustion | `070400:111-122` (blocked row not live; subject `blocked` allowed) | `T-lad/010:127-139` (`blocked:9,pending:1`, lifecycle 6, no event) |
| 2 fire-time `approval_invalidated` (live approvals short, review row still `approved`) | `070600:163,174-175` via `cms_governed_activation_verdict` `070200:66-77` | `T-sch/055:5-30` (exact result body, schedule v3, subject blocked lifecycle 5, review untouched, no event, one audit); `:31-42` next `schedule` commits `reviewer_authority_changed`, `blocked -> draft`, no second schedule |
| 3 expired-but-unrecovered lease honoured under the row lock | `070600:123-125,149-151` | `T-lad/010:85-96` (l4 runs, takes the 15 s step; control: l2 untouched with `lease_until <= now`); mutant A kills test 16 |
| 4 `expectedVersion` = immutable review version documented for the Worker | report `## RPC boundary` item 3 (bold) | `T-sch` AC-143 as before |

## Security

No new input surface. The advisory key is built from server-side values only (subject kind from the review row, lineage from the subject
row), never from the request, so a caller cannot choose a key and squat a lineage lock. Grant tails of the three files unchanged
(`070400:214-220`, `070500:106-110`, `070600:214-225`): wrappers `service_role` only, helpers revoked from every API role. Finding 1 is
availability only: a deadlock victim rolls back its subtransaction including the idempotency reservation (`070410:14-19`).

## Tests

Real fixtures throughout (real CMS-03A-17 revocation at `T-sch/055:9`, real waits: 64 s in `055`, about 746 s in the ladder). Oracles are
exact bodies, exact versions and lifecycle counters, append-only counts; `090` has a positive control (77) and the RED on old bytes (F1);
`055` and the ladder would pass against a mutated executor only if it still blocked with that exact reason and row state. Plans match the
drivers (83 = 81 + 2, 54 = 51 + 3, 24) and the TAPs. No skipped or filtered test. Composite `ok(a and b and ...)` oracles continue the
suite's precedent (declined minor 9 of the prior review; a failure still prints nothing but the description — root knows the trade).

## Conventions

Largest migration 227 lines, largest test 177. No TODO. READMEs list `090`, `055`, `l3`, `l4`. Private producer + `platform_api` wrapper
shape, definer ownership, `search_path = ''`, `P0001` tokens unchanged. Finding 2 is the only convention gap.

## Author claims re-verified (counts only)

Root run `.lane-logs/alt-staged-governed-b-123232-391744.tap`: 635 `ok`, 0 `not ok`, plans 343/83/54/45/36/74 (pattern_definition
343/343 now — the author's F2/F3 127 failures predate block-compat's promotion, as root said). F1 `...-115424-207256.tap`: exactly one
`not ok` (78), 77 `ok`. F4 `...-120423-264637.tap`: `1..24`, 24/0. F5 `...-mut-121737-327662.tap`: `not ok` 16 and 22 only, 22 `ok`.
`## RPC boundary` item 3 and `### Decisions` 1-3 present as the brief states. No stage copy of the old `070400`/`070600` bytes exists, so
"seven other files unchanged" rests on root's hash check.

## Observations for root

- Fix finding 1 before promotion (both producers; one non-locking read each). Everything else can promote as is.
- Decision 3 (finding 3) and the BE03c 1352 claim-row clarification both need DEC text; the author's suggested wording for the claim row
  is accurate.
- Prior-review observation stands: a scheduled execution of an older version still supersedes a newer immediately-activated one
  (`070600:186-188`), spec-literal.

VERDICT: PARTIAL
