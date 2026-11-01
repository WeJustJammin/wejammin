# DEC-193 typed update-diff tests

TEST ONLY; author runtime, SQL parser, formatter and database execution UNRUN.
Entry point: `../phase_02_slice_12_dec193_diff.sql`.

The existing signed-block, governed-pattern and placement fixtures establish real
registry receipts, active compatible pattern versions, assigned draft revisions
and CMS-03C-02 rows. Only the explicitly labelled scan/history, retired/draft/
superseded, detached-copy and standalone inputs are guarded fixtures. No trigger,
RLS rule, constraint or direct-write guard is disabled. The suite rolls back.

| File                     | Purpose                                                                                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `000-fixture.sqlinc`     | Independent typed node/path/envelope builders and real base/target placements.                                                                                   |
| `010-node-values.sqlinc` | Identity/ordered expanded children/props, collision precedence, subtree suppression, new roots/slot, newer empty diff, long addresses and 511 expanded children. |
| `020-diff.sqlinc`        | Current/history/provenance/no-pin/privacy controls, latest compatible active target, exact 128/129 paths and 262144/262145 bytes.                                |

Expected props, block identities, child addresses and collision kinds are built
from the declared trees, not the production plan/view/resolver or response.
Only immutable stored instance metadata supplies generated IDs and row versions.
The full response is compared, including strict fields, slotPath, newRoots and
bulk eligibility. Paths/newRoots are compared as sets without imposing an
unspecified order; each node's children array remains ordered and untouched.
Missing/malformed path or new-root arrays are not filled in by normalization.

Read-only calls use the existing real-role RPC harness. Every success/refusal
compares complete rows of every captured pattern/composition/registry/governance/
authority/receipt/audit/outbox store. Privacy checks require hidden and absent
responses to match and contain no resource; anon/authenticated probes use those
actual SQL roles. Source rows distinguish a positive provenance pin from a
standalone null pin, and an actual nonnull detached snapshot from legacy NULL.

The exact-byte pair is calibrated from the independent COMPLETE typed expected
resource, not the current props-only response. Canonical JSON of 262144 bytes is
admitted; one additional ASCII character creates 262145 bytes and must refuse.
The expanded-address control has 455/520-character addresses while its stored
root row path is only 65 characters. Sixteen authored references expand into
511 ordered child blocks; with their parent the real pattern totals 512 nodes.

Add cases by writing expected `s12df_node`/`s12df_path` values directly. Use real
governed pattern/placement helpers for positive inputs, label unavoidable
history fixtures, and retain exact response plus full-row no-mutation checks.
Do not reuse the legacy props-only `s12pdf_check` oracle. Keep every file <400
physical lines; claim a new fragment before writing if a split becomes necessary.

Root-only suggested RED command, AFTER independent review and the separate
231-case snapshot foundation GREEN. This resets only the existing ALT stack
through the runner's serialized locks; it is not author-executed:

```sh
bash docs/handoffs/2026-10-14-claude-s12/lanes/lane-db-alt-staged.sh \
  /home/rob/.codex/worktrees/phase2-slice12/WeJammin pattern-updates,dec193 \
  supabase/tests/phase_02_slice_12_dec193_diff.sql
```

Stage the existing ten `pattern-updates` WIPs plus the new snapshot foundation,
not a hypothetical diff/resolver implementation. All called production helpers
already exist in that staging set. Root owns actual RED identity, any GREEN
release, regressions and independent review. These tests do not prove accept/
detach resolution, producer mutation atomicity, scan scheduling, concurrency,
render/restore/carry-over, Worker/Web behavior or hosted acceptance.

Related: `../phase_02_slice_12_pattern_updates_common/`,
`../phase_02_slice_12_pattern_update_diff/`,
`../phase_02_slice_12_dec193_snapshot/`; BE03c 1487/1563 and
`packages/contracts/src/cms-composition/pattern-update-diff.ts`.
