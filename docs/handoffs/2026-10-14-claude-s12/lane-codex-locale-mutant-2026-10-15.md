# Lane codex-locale-mutant — approval-order mutant diagnostic (WRITE-ONLY, UNRUN)

## Status

UNRUN. Authoring-only, write-only diagnostic. No runtime was released to this lane: no reset, no
pg_prove, no db:verify/validate, no docker, no network, no git state change. Status is a static
authoring claim, not a passing-run claim.

Root's follow-up added the staged runner as a writable path; this revision applies the explicit
.sqlinc entry fix (see "Runner change"). The mutant itself is unchanged and still UNRUN.

This revision also corrects the mutant header comment (comment only; body, guards, includes and
oracles are byte-identical): my earlier "exactly assertion 52 flips" prediction was wrong. Root's
valid run reports 57 PASS and 3 FAIL (assertions 50-52). This lane authored the mutant UNRUN; every
run recorded below is root's, never this lane's.

## Scope

Three writable paths. The first two are new; the third was added by root's follow-up claim (the
other two existing runner claims are retained):

1. supabase/tests/phase_02_slice_12_locale_gate.approval_order_mutant.sqlinc — the mutant test.
2. docs/handoffs/2026-10-14-claude-s12/lane-codex-locale-mutant-2026-10-15.md — this report.
3. docs/handoffs/2026-10-14-claude-s12/lanes/lane-db-alt-staged.sh — the staged runner, modified
   for explicit .sqlinc entry.

Everything else was read-only. The production gate source
(supabase/migrations-wip/locale-gate/20261014050600_cms_locale_no_fallback_gate.sql, lines 64-75),
the canonical entry, the eleven includes, the shared helpers and the tracker were not edited. The
protected checkout /home/rob/Projects/WeJammin was not touched.

## Files (path, lines, SHA-256)

Line counts are physical newline-terminated lines, excluding the final empty `split('\n')` item.

| Path                                                                       |       Lines | Bytes | SHA-256                                                          |
| -------------------------------------------------------------------------- | ----------: | ----: | ---------------------------------------------------------------- |
| supabase/tests/phase_02_slice_12_locale_gate.approval_order_mutant.sqlinc  |         181 |  8095 | fc1a14d674ddd8a041baeca416fd250cb375875be867330402a451902131d262 |
| docs/handoffs/2026-10-14-claude-s12/lane-codex-locale-mutant-2026-10-15.md | (this file) |     — | —                                                                |
| docs/handoffs/2026-10-14-claude-s12/lanes/lane-db-alt-staged.sh            |         106 |  6656 | e567542ef000e65780b1e8422d8229d0fcd370840b618640ac359e66ce54bb63 |

Earlier read-only input snapshots (historical hashes, before the separate QA fixture/header correction; not the current-input manifest):

| Path                                                                               | Lines | Bytes | SHA-256                                                          |
| ---------------------------------------------------------------------------------- | ----: | ----: | ---------------------------------------------------------------- |
| supabase/tests/phase_02_slice_12_locale_gate.sql                                   |    31 |  1377 | 4a6c261124877e9eb415409ea4208419582455199b89fa421457b645952a823f |
| supabase/tests/phase_02_slice_12_locale_gate/001-gate.sqlinc                       |   275 | 18396 | 5c1d0b764a3f6eb5ad43764be176295cc2b554c15ab59ea112b5cc9da13fce76 |
| supabase/migrations-wip/locale-gate/20261014050600_cms_locale_no_fallback_gate.sql |    94 |  5632 | d0fe7feac84b3772e4282b8b07750a94931d9da60c9169c692bc044853b1bbcd |
| docs/handoffs/2026-10-14-claude-s12/lane-rules.md                                  |    86 |  6201 | d9c37178bc569b5d0d8476b7f6bd438665733ce119c146de5ee264bac7ac25ab |

Worktree: /home/rob/.codex/worktrees/phase2-slice12/WeJammin, HEAD b16edb54a7a1b698ed8ca15b6085046d4270626e.

## What changed (the mutant)

The new file copies the canonical entry skeleton unchanged except for an explanatory header comment:
jwt-claims, the pgtap extension, plan(60), the same eleven include directives (the ten Slice 10/11/12
helper includes then phase_02_slice_12_locale_gate/001-gate.sqlinc), then finish() and rollback. No
fixture or assertion byte is changed. The plan stays 60.

Injected before the 001-gate include, inside the existing outer transaction:

1. Snapshot (transaction-local temp table l12m_gate_snapshot, on commit drop): gate OID, the exact
   pg_get_functiondef text, the full to_jsonb(pg_proc) row, obj_description(..., 'pg_proc'), and the
   original prosrc for platform_private.cms_locale_no_fallback_gate(uuid, text).
2. Guard: the exact before-fragment (the stale elsif block immediately followed by the approval
   elsif block) must occur exactly once in the saved definition, else raise.
3. CREATE OR REPLACE using the original full definition with ONLY the branch-order replacement: the
   entire approval branch is moved BEFORE the stale branch but AFTER the missing branch. No drop,
   no grant, no owner/security/search_path/config change.
4. Guards (fail-closed, raise on any mismatch): to_jsonb(pg_proc) minus prosrc is unchanged,
   obj_description is unchanged, and prosrc equals the exact expected mutated text and is a pure
   inversion (replace back yields the original source).

Injected after the 001-gate include and before finish()/rollback: restore the original full
functiondef from the snapshot, then compare full catalog JSON, pg_get_functiondef and comment against
the snapshot, raising if any differs.

Any guard exception aborts the run and is an invalid mutation proof, never a passing result. The
mutant affects the stale witnesses for NOT-approved variants: fr2 at publish (assertion 50) and at
execute (assertion 51), and fr3 (previously open, now invalidated) at execute (assertion 52). Root's valid run confirms
60 assertions with 57 PASS and 3 FAIL at 50-52 and no SQL abort (see "Valid staged run").

## Which assertions flip

The reorder changes a result only when the missing branch does not fire and both the stale branch and
the approval branch would apply: no no_fallback_missing, stale_count > 0, the phase in (schedule,
publish, execute), a cms_locale_variants row for the revision, and an effective state outside
(approved, scheduled, published).

An earlier UNRUN static pass of mine claimed this left assertion 52 alone. That was wrong: it treated
fr2 as approved at the stale assertions. fr2's approval is invalidated when fr3 is created (the
review supersession), so at the stale assertions fr2 is an unapproved stale variant and its publish
(assertion 50) and execute (assertion 51) witnesses flip too, alongside fr3 at execute (assertion
52; fr3's initially open review was invalidated by fr4 before the stale witness ran). Root's
run confirms 3 FAIL (50-52).

## Runs

The author ran no tests. Root's three invocations are recorded below: an invalid attempt (stamp
214604-432646, SQL never ran), a valid negative run (stamp 215752-509475, 57 PASS / 3 FAIL), and the
final joint run (stamp 221226-608425, mutant 57/3 followed by canonical 60 PASS).

## Invalid staged attempt (root, stamp 214604-432646)

Root ran the runner once against the mutant. The reset passed, but pg_prove read the .sqlinc target
as Perl: the runner passed a hardcoded --ext .sql, so the explicitly named .sqlinc source was never
matched as a pgTAP file. Result: zero tests and no TAP plan emitted; the Perl script exited 255 and
the runner exited 1. The SQL mutant never executed, so this is not a mutation proof and carries no
information about the gate. TAP: .lane-logs/alt-staged-locale-gate-214604-432646.tap. The ALT
migrations symlink was restored by the runner's EXIT trap. Root's diagnosis, from the cached
public.ecr.aws/supabase/pg_prove:3.36 source: options.extensions are forwarded as --pgtap-option
suffixes for the source handler, and the runner's existing --ext .sql excludes the .sqlinc source.

## Valid staged run (root, stamp 215752-509475)

After the runner fix, root ran the mutant through the fixed runner as an explicit .sqlinc entry. The
reset succeeded (exit 0) and pg_prove ran the mutant as pgTAP: plan 60, 57 PASS, 3 FAIL at assertions
50, 51 and 52, pg_prove exit 1, no SQL or guard abort, and the in-test restore passed with the ALT
migrations symlink restored. TAP: .lane-logs/alt-staged-locale-gate-215752-509475.tap. Assertions 50
and 51 are fr2 at publish and execute; assertion 52 is fr3 (previously open, now invalidated) at
execute. Root's
independent 6.1 source check confirms the mechanism: the old fr2 approved review is invalidated when
fr3 is created, and fr3's open review is invalidated when fr4 is created, so both are E2 draft at the
stale assertions. This is root's runtime evidence, not this lane's; this lane records it and asserts
no run outcome.

## Root final joint confirmation (TAP .lane-logs/alt-staged-locale-gate-221226-608425.tap)

Root's final joint run confirms the pair: the mutant reports 57 PASS / 3 FAIL at assertions 50-52,
then the canonical entry reports 60 PASS, with no SQL abort and the source function restored. TAP
SHA-256: 4ec9f573fd0661bcba959d194f6098b840da3d0dbee77187d35bf0da42dd6b02. This is root's runtime
evidence, not this lane's.

## Runner change (lane-db-alt-staged.sh)

Minimal, additive fix so an explicitly named .sqlinc target is run as pgTAP, with recursive .sql
behavior unchanged. Added after the lane-name check, before ALT/LOGS/staging/reset:

    PG_EXTENSIONS=(--ext .sql)
    SQLINC_TARGET=0
    for p in "$@"; do case "$p" in *.sqlinc) SQLINC_TARGET=1;; esac; done
    if [ "$SQLINC_TARGET" -eq 1 ]; then
      for p in "$@"; do
        [ -f "$WT/${p#./}" ] || { echo "[staged] explicit .sqlinc run requires every target to be an existing regular file: $p"; exit 64; }
      done
      PG_EXTENSIONS+=(--ext .sqlinc)
    fi

And the pg_prove invocation now expands the array instead of the hardcoded flag:

    ... pg_prove -v -r "${PG_EXTENSIONS[@]}" "${TARGETS[@]}" ...

It validates every named target as a regular file only when a named target ends .sqlinc; a
directory or non-file target is rejected there, before any lock, staging or reset work. The guard
resolves each relative target against the worktree root ("$WT/${p#./}"), matching the existing
mount and TARGETS semantics, so it is correct from any caller cwd; it does not broaden to absolute
paths. .sqlinc is never globbed or broadened for directory runs, and the .sqlinc extension is
appended at most once.
All other behavior is unchanged: CI/quiet/ALT/reset lock order, temp staging and EXIT-trap cleanup,
credentials handling, and the hardcoded .sql extension for ordinary recursive runs. No SQL mutant
change. The runner is untracked in git (status ??), so the change is shown as a hunk diff, not a git
diff.

## Test corrections

None. No existing test oracle, helper or production file was modified.

## Spec citations

- BE03c Locale preflight provider 1391, Preflight providers registered by Slice 12 1397.
- BE03b Publication preflight registry 1811-1818.
- DEC-121 (no_fallback is never resolved through fallback chains), DEC-138, DEC-192 (approval check
  in schedule/publish/execute, never submit; scheduled admitted).
- Criteria: P2-S12-AC-051, AC-052, AC-148, AC-152, AC-240, AC-241, AC-234.

## Open items / BOUNDARY

- BOUNDARY: the recorded joint run establishes the focused positive/negative check only, not
  promotion, broader regression, hosted or phase acceptance. Root owns validation and integration;
  the author ran no tests.
- The mutated prosrc must remain a pure branch reorder; if the frozen gate source changes, the
  anchor guards raise and the run aborts rather than producing a misleading FAIL.
- The separate QA edits are frozen: the gate include is
  `2ac0a415d2f52eabb3aa4ae1a58f7029d0890a1f71ec5f8d280feab497db1dda` and WIP050600 is
  `75ad1184e77d46dc723809e7c6dee09198dca115d4ce6fa471f12e8b07835dbd`. The final joint check above
  used these inputs. Earlier snapshot hashes are retained as history, not presented as current.

## Requests to root

- Nothing outstanding for the focused joint check or runner correction. Broader-regression,
  spec-consistency, promotion and phase gates remain separate and unclaimed.
- Keep the mutant as .sqlinc; never rename to .sql and never include it from the canonical entry. The
  runner fix preserves recursive .sql behavior and never picks up .sqlinc from a directory run.
