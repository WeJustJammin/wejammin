# DEC-193 expanded choice checker — GREEN author handoff

Native author `gpt-6.1-sol` / `ultra`; 2026-10-16. Status **UNRUN**.
Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin` only; protected primary
`/home/rob/Projects/WeJammin` read-only. No author parser, formatter, tests, DB,
Docker, process, network or Git execution. Source inspection is not SQL execution.

## Exact scope and source

Root's S12 Dispatch heading `DEC-193 expanded choice request validator`
(:2795–2797 at author read) releases exactly three paths: new41400 SQL,
append-only `supabase/migrations-wip/dec193/README.md`, and this new report.
All original ten pattern-updates WIPs, tests, other migrations and runtime sources
are frozen. No files outside this claim were changed.

Read the actual original checker in
`supabase/migrations-wip/pattern-updates/20261014140500_cms_pattern_update_check.sql`
completely, the current dec193 README, the new227-line frozen
`phase_02_slice_12_dec193_writer_boundaries/010-expanded-choice.sqlinc`, its README,
BE03c1483/1485/1487/1563 and DEC-193 (`decisions.md` :5302–5308).
BE03c1487 requires every public `choices` path to use the expanded grammar, at
most72 key segments and4680 ASCII characters. The512-character stored override
grammar and248-octet placement-row bound stay separate (BE03c1483/1485).

Root-observed genuine RED:
`.lane-logs/alt-staged-pattern-updates+dec193-051156-3315597.tap`, SHA-256
`2b70502f86bb6d89ddb16fc7da0768641618b5c5d8fd988c0311ff0e791f1ba8`.
154 assertions:128 PASS,26 meaningful FAIL, no abort. Root reports exact526 and
4680 choices wrongly refused,73 short segments wrongly admitted, and real public
long-choice accept/authority-after-valid-input failures. This is root-provided RED
evidence; author did not rerun or independently regenerate the receipt.

## Precise forward change

New file:
`supabase/migrations-wip/dec193/20261016041400_cms_pattern_update_check_expanded.sql`.
It clones the complete original migration, with four explanatory header lines.
Only the two path-predicate literals differ inside the existing
`platform_private.cms_pattern_update_check(jsonb)` CREATE OR REPLACE:

```text
(/[a-z][a-z0-9_-]{0,63})*       → (/[a-z][a-z0-9_-]{0,63}){0,71}
char_length(choice.path) >512  → char_length(choice.path) >4680
```

The unmodified first segment plus at most71 following segments gives1–72 anchored
ASCII segments of1–64 characters. With a slash for each segment, the maximum is
72×65=4680 characters. No Unicode, uppercase, empty segment, control character or
65-character segment is admitted by the unchanged key character classes.

All other function and transaction bytes remain unchanged: request envelope,
expectedVersion/If-Match/idempotency validation, target version,1–32 unique UUID
instances,128 choices, exact choice members/action, duplicate paths, restriction
to single-instance accept, error tokens and offending JSON pointers. The same
STABLE SECURITY DEFINER, empty search path, CMS owner and private role revocations
are retained. No table reads/writes, authorization-order changes, public API,
stored override cap, row/slot cap, writer/resolver or new grant is introduced.

Static source readback strips only the four header lines, reverses only the exact
new two-line predicate to the original, and compares full bytes against the old
file. Exact match is required; body, comments, transaction wrapper and ownership /
ACL tail are therefore covered, not merely a selected function substring.
Actual author readback found one old predicate, one new predicate, one function
definition and `fullReverseBytesEqual: true`. This was text/byte comparison only,
not a SQL parser or runtime invocation. New predicate lines are116–117.

## Author-freeze manifest

| Path | Lines | Bytes | SHA-256 |
| --- | ---: | ---: | --- |
| New `dec193/20261016041400_cms_pattern_update_check_expanded.sql` | 150 | 9403 | `2e216de635a067490ecbd7c6bdf0bb32b39f0962ec5c5580fca0fd3676d50acf` |
| Append-only `dec193/README.md` | 199 | 12393 | `f5bb77625f85f11c0e433376424d1fe73baa62e165e6406ea5d97f087b502f25` |
| Read-only original `pattern-updates/20261014140500_cms_pattern_update_check.sql` | 146 | 9098 | `885de34d8cbc19c571d3049cf9ad759317ee538b775ce16a3f8bce28a6ccf713` |

Migration/README paths in this table are under `supabase/migrations-wip/`.

## Verification boundary

TDD/minimal-surgical-development guidance keeps the fix at the genuine failing
public input boundary; the frozen tests and existing function semantics remain
the oracle. Verification-before-completion requires the explicit **UNRUN** status.
No actual PostgreSQL regex behavior,154/1161 GREEN, live permission outcome,
promotion or acceptance is claimed from this source-only delivery.

Root next: independently repeat full reverse-predicate comparison, normal-size /
source review, stage the complete released cohort only after this freeze, run the
154 boundary and1161 regression suites, and perform independent SQL/security
review. The already-staged24-file candidate race run does not include this new
file and must not be reported as evidence for41400. Existing tests retain real
guarded signed registry, pattern/placement producers, exact long structural
collision and no-effect/authority/role controls. Other receiving, race and hosted
acceptance gates remain separate.
