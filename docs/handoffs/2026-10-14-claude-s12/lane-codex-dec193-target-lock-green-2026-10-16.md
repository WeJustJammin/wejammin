# DEC-193 locked target binding — GREEN author handoff

Native author `gpt-6.1-sol` / `ultra`; 2026-10-16. Status **UNRUN**.
Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin` only; protected primary
`/home/rob/Projects/WeJammin` read-only. No author collection, SQL parser, formatter,
tests, runtime, DB, Docker, process, network or Git execution.

## Exact scope and genuine RED

Root's S12 Dispatch releases only new
`supabase/migrations-wip/dec193/20261016041500_cms_pattern_update_locked_target.sql`
and this new report. The old41100 writer, every other WIP, README, tests and
separately owned41600 remain unchanged. No staging directory was created.

Root reports the genuine second race passed prerequisites with V2 active. Writer
backend453 waited on the exact B tuple/XID held by446; actual governed V3 activation
backend481 committed while the writer remained blocked. After B release, the
writer unexpectedly succeeded with V3 (`00000`), rather than refusing
`P0001:pattern_version_not_active` at `["/targetPatternVersion"]`.
Root log:
`/tmp/wejammin-native-receiving-proto-red-BkaHbW/dec193-writer-second-race-red.log`.
Root owns its final receipt hash. These are root-provided observations, not an
author-executed race or an independent regeneration of that receipt.

BE03c :1454–1475 fixes the global ascending lock order and requires a writer that
waited on a pinned/bound definition and then finds it superseded to refuse with
the operation's typed refusal. :404/:1386/:1422 require the latest active compatible
target and the existing422 `pattern_version_not_active`; :1487 defines linked
accept, choice resolution, provenance and all-or-nothing behavior.

Read complete source41100, current40900 writer planner, original140200 target
selector, promoted020300 graph helpers including the recursive nested closure,
and the frozen152-line090 race fixture. The closure is a stable read-only query
over pinned nested versions; it takes no row lock. The actual source exposes the
gap:41100 :139–145 collects a candidate into the lock union but does not preserve
which candidate each instance selected; after waiting, :161–163 accepts any replan
with the requested version. A new active candidate can therefore be adopted even
though it was not the initial lock-bound candidate.

## Minimal forward change

41500 copies the full41100 migration after three explanatory header lines.
Only four anchored changes are made:

1. Declare `v_candidate_ids uuid[]`, initially empty (new :43).
2. During the existing per-instance candidate collection, use
   `pg_catalog.array_append(v_candidate_ids, v_candidate.id)` (new :145).
   `array_append` retains a NULL candidate as a real array slot; later instance
   indices cannot shift, and an initially absent candidate cannot silently become
   a newly appeared target after waiting.
3. Extend the existing target guard with null-safe exact equality between the
   locked replan's `targetId` and `v_candidate_ids[v_i + 1]` (new :166–169).
   Membership in the global union is not used as a substitute for per-instance
   identity, so another instance's candidate cannot satisfy this binding.
4. Read that same target row and prove every nonnull nested closure row ID is
   already in original `v_lock_ids` (new :170–175), otherwise raise the same typed
   `pattern_version_not_active` with the same target pointer. Existing strict
   planner validation retains its earlier `nested_pattern_not_active` mapping.

No ID is appended to `v_lock_ids` after its one existing ascending FOR SHARE
statement. There is no late position3 lock, lock-order inversion, retry loop,
target switch or new refusal token. The added closure query reads the retained
target tree and checks membership only. The caller must start a new operation
against the current target rather than adopting a changed candidate mid-write.

All other bytes remain the41100 writer: envelope and actor/acting-party checks,
concealment, entry/authority fencing, capability, reservation/replay-before-CAS,
entry and instance CAS, draft/newest/link-mode checks, batch/collision/choice
refusals, selected registry and complete reference union, row assembly, props
bound, append, entry version, review invalidation, audit, completion and response.
The original transaction wrapper, SECURITY DEFINER/search-path declaration,
function comment and private API-role revocations are copied unchanged. No grant,
ownership, registry helper, snapshot grammar, stored bound or schema is added.

## Static proof and author manifest

Actual source readback stripped the three-line header and reversed only the four
exact edit anchors, each appearing once. Full resulting bytes equal original41100.
All lines containing explicit FOR SHARE/FOR UPDATE are identical and in the same
order; original and new each contain one ascending pattern lock-union statement.
These are source-byte checks, not SQL parsing, lock execution or runtime proof.

| File under `supabase/migrations-wip/dec193/` | Lines | Bytes | SHA-256 |
| --- | ---: | ---: | --- |
| New `20261016041500_cms_pattern_update_locked_target.sql` | 290 | 17594 | `b1839aa58d2d69282b21be874004349a5ffb61104f7c405815cacd458766474a` |
| Read-only `20261016041100_cms_apply_pattern_update_dec193.sql` | 278 | 16620 | `c3f44ef01dedf794fa900807a58d943c7110808ee11467422907c0e1331933d4` |

## Remaining root gates

TDD/minimal-surgical-development guidance keeps the fix limited to the genuine
race's initial-candidate fence. Author status remains **UNRUN**; no actual GREEN,
security outcome, real lock behavior, promotion or acceptance is claimed.

Root owns full read/reverse comparison, normal-size/source review, both41500 and
the separately owned41600 freeze before staging, the genuine race rerun and valid
current/fresh-target controls,1315 regression assertions, security checks and
independent SQL review. The current25-file staged diagnostic predates41500 and
must not be presented as evidence for this new override. Exact full-store/no-effect
and committed-activation race oracles remain frozen. Receiving and hosted gates
remain separate; this source-only fix does not broaden their evidence.
