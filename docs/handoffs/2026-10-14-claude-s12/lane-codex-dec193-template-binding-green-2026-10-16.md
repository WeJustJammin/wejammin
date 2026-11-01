# DEC-193 template-bound root snapshot — GREEN author handoff

Native author `gpt-6.1-sol` / `ultra`; 2026-10-16. Status **UNRUN**.
Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin` only; protected primary
`/home/rob/Projects/WeJammin` read-only. No author formatter, SQL parser, collection,
tests, runtime, DB, Docker, process, network or Git execution.

## Exact scope and antecedent

Root's durable two-path GREEN claim releases only:

- NEW `supabase/migrations-wip/dec193/20261016041800_cms_pattern_root_snapshot_template_binding.sql`
- NEW this report.

The old40700, tests, README, other migrations and revision-carry production remain
frozen/unreleased. No staging directory was created.

Root observed actual template-bound detach fail with SQLSTATE42702 and the exact
diagnostic `column reference template_id is ambiguous`. This is a real earlier
helper failure, not evidence that revision carry itself is implemented or GREEN.
Root owns the diagnostic receipt and subsequent integration run.

Complete original source read:
`supabase/migrations-wip/dec193/20261016040700_cms_pattern_root_snapshot.sql`.
Its local `template_id` is declared at15, assigned at31, tested at35, and referenced
unqualified in the template-table query at41. Promoted
`20261013100000_cms_template_per_owner_keys_lineage.sql:23` adds the table's own
`template_id` column, explaining the ambiguous unqualified identifier in that SQL.

## Precise forward fix

The new CREATE OR REPLACE retains the exact signature:

```text
platform_private.cms_pattern_root_snapshot(
  cms_composition_instances, cms_pattern_versions, boolean) returns jsonb
```

Only the four local identifier occurrences change to `v_template_id`, at new
lines16/32/36/42. No table column, query predicate, slot comparison, return value,
exception or other body byte changes. Exact flat-slot/root extraction, caller
strictness, real ordered expansion, base identity proof, canonical preorder and
namespace construction, absent-target JSONB null, shared validator and bounds all
remain the original implementation.

STABLE, SECURITY DEFINER and empty search path remain exact. The original function
comment is repeated byte-identically. CREATE OR REPLACE retains the established
OID/owner/ACL; original40700:99–106 sets CMS ownership and closes API execution.
The new file emits no GRANT, REVOKE or ownership statement and needs no privilege
expansion. It depends on the existing40700 foundation, not a standalone new API.

## Static fidelity and delivery image

Actual source readback finds exactly four renamed identifier sites. Reversing
only `CREATE OR REPLACE` to `CREATE` and `v_template_id` to `template_id` reproduces
the full original function definition byte-for-byte, including its signature,
attributes and complete body. The comment text is separately identical. These
are text/byte checks, not SQL parsing or execution.

| File under `supabase/migrations-wip/dec193/` | Lines | Bytes | SHA-256 |
| --- | ---: | ---: | --- |
| New `20261016041800_cms_pattern_root_snapshot_template_binding.sql` | 100 | 4639 | `c43b9b3a935791b1c791176079b7249e4f2293874c184892e1021c35d7029bde` |
| Read-only `20261016040700_cms_pattern_root_snapshot.sql` | 107 | 5079 | `af5e6e2b6a3d1d7b853b308130b118f79eb62882f087cfa4eca06cb4f76e75c8` |

TDD/debug-by-test and minimal-surgical-development guidance keep this patch at the
observed ambiguity, with no unrelated source or test relaxation. Author remains
**UNRUN**. Root owns normal-size/source review, actual template-bound detach and
carry-fixture rerun, regression and independent review after freeze. No runtime
GREEN, revision-carry acceptance, migration promotion or complete-slice claim is
made from this source delivery.
