# Independent review: lane governed-b (CMS-03C-09 activate/schedule, CMS-03C-19 claim/execute)

Reviewer: independent (Fable 5.1), static only; no DB, no test run, no source edit. Worktree
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e`.
Author report `docs/handoffs/2026-10-14-claude-s12/lane-governed-b-report.md`, SHA-256
`f65d5830e314d634665b99169a16c05d08b3ca2648ba292d29eda1988e458d1c` (verified). File hashes not re-hashed (root did).

Paths below are relative to the worktree. `WIP` = `supabase/migrations-wip/governed-b/`, `T-act` =
`supabase/tests/phase_02_slice_12_governed_activation/`, `T-sch` = `supabase/tests/phase_02_slice_12_governed_schedule/`,
`T-lad` = `supabase/tests/phase_02_slice_12_governed_schedule_ladder/`. BE03c = `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`.

## Status

No blocker. Two majors (a spec-mandated lock missing on the immediate path; the claim writing a subject transition outside the
lock-order row, on a path no suite exercises), seven minors/observations. The work is otherwise faithful to BE03c, the frozen
contracts and the 03b/governed-a precedents; the suites are real-fixture, non-vacuous and the mutant run supports that. Retire is
HELD and confirmed inert (see clause 3).

## Findings

1. `WIP/20261014070400_cms_activate_governed_subject.sql:92-175` — **major** — the immediate `activate` path never takes the lineage
   advisory lock (grep: `pg_advisory_xact_lock` appears only in `20261014070600:180`). BE03c 1326 requires the switch "in one
   transaction holding the review row and the lineage advisory lock", and the lock-order row (BE03c 1348, CMS-03C-09) ends
   "then the schedule row ... and last the lineage advisory lock". Consequence: with no `active` version in the lineage, two racing
   immediate activators (or an immediate activator against the executor, which does lock) serialize only on the partial unique index.
   Reading the code: B's step-5 `cms_governed_lock_lineage_active` returns NULL; if A commits before B's `cms_governed_apply_activation`
   -> `cms_governed_supersede_lineage` re-query (`20261014070000:109`), B silently supersedes A's just-activated row; if A commits after,
   B gets `unique_violation` -> `activation_conflict` (`20261014070000:85-87`). The outcome the spec mandates ("an activation that loses a
   race on the lineage is 409 `activation_conflict` and nothing commits", 1326; test clause 1611 "activation_conflict under two racing
   activators") is therefore non-deterministic. The one-active-per-lineage invariant holds in every interleaving (unique index + row
   locks), so this is conformance, not corruption. Secondary: the supersede re-query inside `cms_governed_apply_activation`
   (`20261014070200:118` after the review lock at `:100-101`) can take a position-3 row (a different version) after position 5, which
   the header of `20261014070000:3-4` claims never happens; no deadlock cycle exists today because no other writer holds that row and
   waits on this review, but it is order-by-luck. Fix: after the review lock at `20261014070400:101-102` and before step 9, take
   `pg_advisory_xact_lock(hashtextextended('cms.governed.lineage:'||kind||':'||lineage_id, 0))` (the executor's key, `070600:180-181`),
   re-run `cms_governed_lock_lineage_active` and raise `activation_conflict` when it differs from the step-5 result (the executor's
   pattern at `070600:182-185`, with `activation_conflict` instead of retry). Six lines; the race itself stays unprovable here.

2. `WIP/20261014070500_cms_claim_due_governed_activations.sql:49-57` with `WIP/20261014070100_cms_governed_schedule_state.sql:100-138`
   — **major** — the claim takes the subject version row (position 3) `FOR UPDATE SKIP LOCKED` while holding schedule rows (position
   6) and writes `scheduled -> blocked` (`cms_governed_block_scheduled_subject` -> `cms_governed_move_subject`) from the claim
   transaction. BE03c 1356 says the claim RPC locks "schedule rows only (FOR UPDATE SKIP LOCKED)"; the 03b precedent
   (`supabase/migrations/20261005017730_...:245-257`) touches nothing but schedule rows. The author's reason is real: a lease that
   exhausts the ladder at the claim would otherwise strand the subject in `scheduled` with no live schedule, and CMS-03C-09 then refuses
   both `activate` and `schedule` (`070400:117-119` requires approved|blocked) until an invalidation. Deadlock analysis: every lock the
   claim takes is SKIP LOCKED or already held, so it never waits and cannot be a cycle member; the executor (3 -> 5 -> 6) blocks on the
   claim's schedule row and then sees `lease_until <= now` or `state <> executing` -> CONFLICT, so no double execution. The deviation
   is safe by construction but (a) contradicts the spec row text and (b) is **untested**: no suite drives an `executing` schedule with
   `attempt_count = 3` and an expired lease. The ladder (`T-lad/010-ladder.sqlinc:65-73`) recovers l2 at `attempt_count 0 -> 1` (the
   `else` branch, `:58-62`); l1 is exhausted through `execute` (`:75-86`), never through the claim. The `continue` branch (`:50-52`) is
   untestable sequentially. Fix: (i) add a ladder step (claim l1's 300 s retry, do not execute it, wait 301 s, claim again: schedule
   `blocked retries_exhausted`, subject `blocked`, lifecycle +1, no event, one audit) — about five more minutes of real waiting; and
   (ii) have root ratify the deviation as a DEC or a one-line amendment to the BE03c 1356 row ("plus the subject version row
   `FOR UPDATE SKIP LOCKED` when an expired lease exhausts the ladder; an unavailable subject leaves the schedule for the next claim"),
   or move the exhaustion block into the executor (which needs a guard change on the promoted table — `attempt_count` is capped at 3 and
   `executing -> failed_retryable` must increment, `20261013300700:52,120`).

3. `WIP/20261014070600_cms_execute_governed_activation.sql:122-125,149-152` — **minor** — the executor refuses an `executing` schedule
   whose `lease_until` has passed (CONFLICT), both unlocked and under the row lock. The 03b executor it must mirror ("same claim, lease,
   retry ladder and idempotency as CMS-03B-20", BE03c 188; BE03b 1896 "a lease that no longer matches is refused") checks only
   `lease_id` (`20261005017740:144-146,166-168`): under the schedule row lock an expired-but-unrecovered lease still executes, because
   the row lock is the real fence and the claim's recovery SKIP LOCKED cannot touch a row the executor holds. The governed version costs
   one ladder step per executor that reaches the lock a few seconds late, and `T-lad/010-ladder.sqlinc:60-64` enshrines it. Not unsafe.
   Fix: drop the two `lease_until` clauses to mirror 03b, or have the spec say expiry is refused; either way one line in the ladder test.

4. `WIP/20261014070600_cms_execute_governed_activation.sql:126-128` — **minor, cross-lane** — the execute fence compares the request's
   `expectedVersion` to the schedule's immutable `expected_version` (the review version at acceptance), so it is a constant check; the
   03b executor compares it to the claim-produced schedule version (`20261005017740:147-149,169-171`) and the 03b Worker passes
   `expectedVersion: claim.scheduleVersion` (`apps/worker/src/cms-publication-schedule-rpc.ts:81`). The author follows the frozen 03c
   contract (`packages/contracts/src/cms-composition/governed-activation-job.ts:30` comment; test AC-143 uses the claimed
   `expectedVersion`) and documents it in the RPC boundary, and the lease alone is a sufficient fence (a fresh UUID per claim, cleared on
   release; `T-sch/040-retry.sqlinc:24-27` proves a released lease is refused). Risk is integration: a Worker lane copying the 03b sweep
   will get `VERSION_MISMATCH` on every execution. Fix: none in SQL; root must flag the 03b/03c divergence to the Worker lane explicitly.

5. `WIP/20261014070400_cms_activate_governed_subject.sql:176-197` and `WIP/20261014070600:155-177` — **minor, spec-level** — a schedule
   acceptance (202) and a fire-time terminal block leave the review `version` unchanged while the subject moves to `scheduled` / `blocked`.
   CMS-03C-10 serializes `subjectState` (`supabase/migrations/20261014010300_cms_get_governed_review.sql:129`) and its strong ETag is the
   review version (BE03c 171, 216), so a conditional GET after either returns 304 with a stale `subjectState`. The author is inside BE03c
   216 (only a decision, an invalidation and an activation advance the version), and the L1 guard already allows `approved -> approved`
   "to record the activation, schedule or retirement" (`20261013300600:13-14,114-123`), i.e. two upstream sources disagree. The same
   staleness exists for the superseded version's review by spec design. Fix: spec-owner decision; if the version is advanced on
   acceptance, `expected_version` must be stored post-advance (the executor compares `review.version` to it, `070600:156`).

6. `WIP/20261014070400_cms_activate_governed_subject.sql:121-146` before `:148-162` — **minor** — the time rules and the grant day (step 7)
   run before the recheck (step 8); BE03c 1326 orders the recheck (4, committing the invalidation) before the action-specific time
   resolution (6). A request that is both out of horizon and dependency-stale answers 422 without committing the invalidation the spec
   order would commit; the next well-formed request commits it. Harmless; note for the author.

7. `WIP/20261014070300_cms_governed_activation_request.sql:84-91,99-107` — **minor, observation** — fractions of 7-9 digits are accepted
   and floored to the microsecond; 03b's DB refuses more than 6 (`20261005017710:119,135`). The frozen contract admits 1-9 digits
   (`packages/contracts/src/cms-editorial/publication-schedule-contracts.ts:70-71`; `CmsInstantSchema = z.iso.datetime` is unbounded), so
   the DB is contract-consistent and 03b is stricter than its own contract; the column is µs anyway and the response instant is ms
   (`auth_iso_time`). `T-act/050-schedule-accept.sqlinc:90-102` pins the flooring. Acceptable; the Worker Time authority must never
   compare its nanosecond value to the stored/returned instant for equality.

8. Tests — **minor** — fire-time `approval_invalidated` is reachable (revoke the counted approver's `cms.reviewer` after acceptance, as
   `T-act/060-invalidation.sqlinc:26-34` does for the immediate path) but untested; `blocked -> scheduled` (re-schedule after a block,
   `070400:111-119` plus the partial unique) untested; `canonical_source_unavailable` untested on both paths (author: unreachable
   sequentially — agreed: submit refuses an unbuilt domain and the registry moves forward only). `activation_conflict` untested (race).

9. Convention — **minor** — composite `is(string_agg(...))` oracles bundle up to 11 clauses in one assertion
   (`T-act/020-gates.sqlinc:42-51,79-92`; `T-sch/030-execute.sqlinc:25-31`), against the template's "one assertion per clause"; it is
   the governed-a precedent and a failure prints the whole expected/actual string, so the diagnosing clause is still identifiable.

## Spec conformance (route row BE03c 171, validation 392, 1326/1328/1336/1546, contracts)

| Clause | Implemented | Tested |
| --- | --- | --- |
| `activate` -> 200 `GovernedActivationResource` (11 members, `eventType` set) | `070400:165-174` | `T-act/030:5-23` |
| `schedule` -> 202, `subjectState scheduled`, `activatedAt null`, `eventType null`, `scheduledForUtc` | `070400:176-197` | `T-act/050:3-43` |
| `retire` -> 200 | **HELD** by owner; refused `VALIDATION_FAILED ["/action"]` before step-up and before any reservation (`070300:53-58`); nothing written, nothing reserved | `T-act/020:54-58`, `030:69-76` (snapshot identical, 0 idempotency rows, 1 event) |
| step-up MFA unconditional, before any read and before the reservation (171, 216, 1326 step 1) | `070400:66` (after structure `:63`, as governed-a `010200:90`) | `T-act/020:8-28` |
| hidden/absent/cross-owner/no-scope review 404; visible without capability 403 | `070400:69-74`, `:80-82` | `T-act/020:95-110`, `060:14-24` |
| strict JSON, unknown keys, action-member discrimination, `activateAt` five-member shape with per-member pointers | `070300` | `T-act/020:31-51,61-92` |
| key + If-Match = review `version`; CAS `VERSION_MISMATCH {expectedVersion,currentVersion}`; activation advances the version | `070300:63`, `070400:105-107`, `070200:121-127` | `T-act/020:111-115`, `030:66-68`, `040:45-58` |
| atomic CAS switch: subject -> active, lifecycle +1, `activated_at`, definition `version` untouched (DEC-188) | `070000:46-95`, `070200:82-140` | `T-act/030:24-34`, `040:24-34`, `080:39-50` |
| supersession of the previous active version in the same transaction, lifecycle +1, emits nothing, one active per lineage | `070000:100-137`, `070200:117-119` | `T-act/040:16-44`; `T-sch/030:36-80` |
| exactly one event on committed immediate activation or execution; aggregate = switched row at its lifecycle counter; payload per kind | `070200:128-136` | `T-act/030:35-44`, `080:39-50`; `T-sch/030:66-80`; none on schedule `T-act/050:33-43` |
| events contain ids only; no event on any refusal | payload `070200:131-135`; snapshots include outbox count | every refusal block asserts `s12gb_same` |
| step 4 recheck: hash/basis/deps -> committed invalidation, envelope `dependency_changed` 409; live approvals short -> `reviewer_authority_changed`, envelope `review_not_open` (governed-a precedent `010200:212-214`) | `070200:37-80`, `070400:148-162`, `070000:142-203` | `T-act/060:26-53,79-117`; `T-sch/050:24-33` |
| step 5 taxonomy provider -> 422 `canonical_source_unavailable` + `details.domain` (nothing commits); at fire time a terminal block | `070200:20-35,59-62`, `070400:150-152`, `070600:175-177` | not testable sequentially (finding 8) |
| step 5 template/pattern preflight (digest, nested states, bound types) | inside `cms_governed_frozen_status` (`20261013300400:167-252`) -> `dependency_changed` | `T-act/060:79-111` (bound type successor) |
| `activate` requires subject approved\|blocked else `subject_not_activatable`; non-approved review the same token | `070400:108-110,117-119` | `T-act/020:116-120`, `030:59-65`, `050:51-57`; blocked -> active `T-sch/030:118-128` |
| `activation_conflict` on a lost race, nothing commits; transaction holds the lineage advisory lock | partial: unique_violation only (`070000:85-87`); **advisory lock missing** (finding 1) | untestable here |
| `schedule`: pinned tzdb (`tzdb_version_mismatch {pinnedVersion}`), -12..+14 h offset (`resolved_utc_mismatch`), 60 s..366 d (`schedule_out_of_horizon {minUtc,maxUtc}`), grant day (`authority_ends_before_schedule`) — the 03b rules of `20261005017710:207-231` | `070400:121-146` | `T-act/050:59-88` |
| one live schedule per subject -> `schedule_exists` (check + unique_violation) | `070400:111-116,183-185` | `T-act/050:51-57` |
| pending row (version 1, expected_version = review version, creator = person), subject -> scheduled, one audit, 202 stored | `070400:176-196` | `T-act/050:19-43` |
| replay returns stored body with `x-cms-idempotent-replay`; different body -> `IDEMPOTENCY_MISMATCH`; refusals reserve nothing; committed refusal replays | `070400:83-90,160,173,196` | `T-act/030:50-58`, `050:45-50`, `060:48-53,112-117`, `020:26-28,121-123` |
| lock order CMS-03C-09: 1 authority FOR SHARE + capability re-proof; 3 subject FOR UPDATE, lineage active FOR UPDATE after it (activate), graph; 4 bound types; 5 review FOR UPDATE; last advisory | `070400:79-82,93-102` — all but the advisory lock | by construction; mutant M2/M6 |
| CMS-03C-19 claim `{batch 1..100}` -> `ClaimedGovernedActivation[]`, due pending/failed_retryable, SKIP LOCKED, version CAS, 5-min lease, expired leases first | `070500` | `T-sch/020` (structure, order, lease window, cancelled never claimed, executing not reclaimed) |
| claim: schedule rows only | **deviates** (finding 2) | claim-side exhaustion untested |
| execute `{scheduleId, expectedVersion, leaseId}` -> `GovernedActivationExecutionResult`; `already_completed` idempotent; lease fence CONFLICT; `VERSION_MISMATCH` | `070600:94-152` | `T-sch/030:8-34,83-97`; `040:24-27` |
| execute re-reads review approved at `expected_version`, subject scheduled + hash, basis/deps/providers, creator's grant (DEC-120, no MFA) | `070600:155-177` | `T-sch/030:99-117`, `050:9-23` |
| lock order CMS-03C-19: 1 creator authority; 3 subject + lineage active; graph; 5 review; 6 schedule (lease re-proved); advisory last | `070600:131-152,180-181` | by construction |
| completed: `actual_at_utc`, signed `deviation_seconds`, late run activates, schedule CAS, one event + audit atomically | `070600:186-208` | `T-sch/030:40-80` |
| ladder 15/60/300 s, three attempts, fourth failure `blocked retries_exhausted`, subject blocked | `070100:18-59`, `070600:53-69` | `T-lad/010:29-86` |
| terminal reasons `approval_invalidated`, `dependency_changed`, `activation_authority_ended`, `canonical_source_unavailable` -> schedule blocked + subject blocked, review untouched | `070100:64-98,124-138`, `070600:37-51` | `activation_authority_ended` `T-sch/030:99-117`; `dependency_changed` `T-sch/050`; `approval_invalidated`, `canonical_source_unavailable` untested (finding 8) |
| retryable class: NULL policy evidence (`DEPENDENCY_UNAVAILABLE`), `activation_conflict` | `070600:163-177,187-198` | policy fault `T-sch/040`, `T-lad`; conflict untestable |
| invalidation while scheduled cancels pending/failed_retryable (`cancelled`, `approval_invalidated`), subject -> draft, same transaction, audit each | `070000:142-203` | `T-act/060:55-77`; `T-sch/020:24-29` |
| typed deadlock/lock failure -> CONFLICT in the `platform_api` wrappers | `070410/070510/070610:16-22` | untestable |
| grants: wrappers `service_role` only; private helpers executable by no API role; definer-owned; empty search_path | all ten files' tails | `T-act/070`, `T-sch/060` |

## Security

authN/authZ order (structure -> step-up -> 404 concealment -> 403 capability -> position-1 lock + re-proof -> reservation) matches
governed-a `010200:90-119`; the capability is tested in the review's owner party, which the concealment step forces equal to the acting
party (`070400:71`). No PII or secret in any response, DETAIL or audit row: ids, versions, instants, enums, the pinned tzdb label and the
domain name (spec-mandated) only. Input bounds: exact keys everywhere, `batch` as a JSON number 1..100, versions <= 19 digits,
UUID-validated ids, timezone 1..64 with `.`/`..` segments refused (the contract additionally refuses a segment of three or more dots;
unreachable, the DB never resolves the zone). Idempotency: reservation after step-up, bound to actor + body + acting party; refusals
roll the reservation back (asserted). Execute/claim have no human actor and are reachable only through `service_role` wrappers; the
private helpers (including `cms_governed_invalidate_approved_review`, which takes no scope and invalidates any live review by id) are
revoked from every API role. Grants in the ten files are restatements of `20261013300000:168-172`, `20261014010000:142-147`,
`20261013300700:161`, `20261013300600:280-284`; nothing widened. Lifecycle writes go through the `app.cms_governed_lifecycle` seam with
the prior value restored on every exit path, and the guard's legal-transition table (`20261013300000:53-61`) covers every move the lane
makes. `decided_at` is cleared on invalidation because the table CHECK requires it (`20261013300200` `decided_state_check`), not by choice.

## Tests

Real fixtures throughout (S09 receipts, CMS-03A-15/17 grants and revocations, CMS-03C-01/06/08/07 producers, a DEC-108 successor for the
changed dependency, the real taxonomy producer, real waits of 72-461 s). Oracles compare exact key lists, exact JSON bodies, exact
lifecycle/version numbers, exact event payloads and append-only store counts; snapshots cover subject, review, schedules, idempotency
digest, audit and outbox counts. The negative fault (`T-act/000-world.sqlinc:239-267`) replaces one resolver's source with `return null`
inside the rolled-back transaction and verifies byte-for-byte restoration; twenty earlier suites use the same `pg_get_functiondef`
technique, it produces only a failure (NULL -> `DEPENDENCY_UNAVAILABLE` raised by the real policy seam), and the executor's catch,
`record_failure` and the ladder it drives are all production code. Mutant run (`.lane-logs/alt-staged-governed-b-mut-072837-3371935.tap`,
106 ok / 26 not ok) is consistent with the seven mutants claimed; the scratch lane was removed, so which lines were mutated cannot be
re-verified. Coverage gaps: findings 2 and 8. No skipped or filtered tests; plans 81/51/21 match the drivers.

## Conventions

Private producer + `platform_api` wrapper shape, SECURITY DEFINER, `search_path = ''`, definer ownership, `revoke all ... from public,
anon, authenticated, service_role`, `P0001` + token + DETAIL json: all as `20261005017630/730/740` and `20261013300800/820`. Largest
migration 228 lines, largest test file 267 lines. No TODO/FIXME. No README in `migrations-wip/governed-b/` — no WIP lane has one and
the parent `migrations-wip/README.md` exists (convention). Test directories have READMEs.

## Author claims re-verified (static)

Report SHA matches. TAP counts: run 1 `60d868bf…` 27 ok / 52 not ok; run 2 `c63f4ab5…` 126/2; run 3 `e0126f33…` 473/0; run 4
`6568f3ee…` 21/0; run 5 `bec8d6d5…` 106/26 — all as reported. Governed-b bytes unchanged since 07:13; four later runs (11:34-11:38,
`pattern-def+governed-b+governed-fix2`) stage these files from another lane and their failures are deprecated-block assertions of
pattern-def/fix2, none in a governed-b suite. `git status`: every governed-b artifact is a new file; no governed-b-attributable
modification of an applied migration, shared helper or other lane's oracle. "No grant widened" verified. "Retire writes nothing and
reserves nothing" verified by code (refused in the STABLE structure step before any lock, reservation or read) and by
`T-act/020:54-58`, `030:69-76`.

## Observations for root / spec owner (not lane findings)

- BE03c 1328's fire-time recheck has no "a newer version of the lineage is already active" condition, so a scheduled execution of an
  older version supersedes a newer immediately-activated one (`070600:186-188` -> supersede). Spec-literal; worth an owner glance.
- BE03c 1262 lists "preflight failure" under 422 for CMS-03C-09 while 1326 folds a changed block/nested pattern into the committed
  `dependency_changed`; the lane follows 1326 (`frozen_status`), which is the stricter reading.
- Open item 5 of the author's report (G6 and the recheck job should call `cms_governed_invalidate_approved_review`) is correct: the
  governed-a helper refuses approved reviews (`20261014010000:115-117`).

VERDICT: PARTIAL
