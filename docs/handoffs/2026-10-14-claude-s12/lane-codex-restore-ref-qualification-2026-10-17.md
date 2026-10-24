# Restore refs qualification — source author freeze, UNRUN

Native `gpt-6.1-sol` / ultra. Exact two-path claim is recorded in the S12
tracker Root513 checkpoint. Author changed ONLY the two NEW paths below. No
parser, formatter, project runtime, tests, database, Docker, Git, network or
child delegation. Root owns candidate compilation, rollback, catalog checks,
strict TAP, independent review and canonical validation.

All paths are relative to `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.

| New artifact | Physical lines | SHA256 |
| --- | ---: | --- |
| `supabase/migrations-wip/dec193/20261017044710_cms_restore_composition_ref_qualification.sql` | 148 | `4a38cd2e91d96f155477ef08f594e4672ce75bbc75af819fd2a328fd1cc974ff` |
| `docs/handoffs/2026-10-14-claude-s12/lane-codex-restore-ref-qualification-2026-10-17.md` | external freeze receipt | self-hash reported to root |

## Exact forward amendment

The migration targets only the executed `platform_private.cms_restore_composition_refs(platform_private.cms_composition_instances)` definition from 44500. It does not edit 44500 or any earlier migration and is ordered before the unexecuted 448 integration.

The guarded source change is limited to two local-name collisions:

1. All six exact `template_id` local declaration/reference occurrences become
   `restore_template_id`.
2. Five exact `root_chain` local/usage anchors become `restore_root_chain`.
   The real persisted record field `block_node.root_chain` remains unchanged;
   only its comparison RHS is renamed.

No query, persisted field, value, helper call, error policy, lock behavior or
other source token is intentionally changed.

## Baseline and digest guards

The migration requires the current function owner, invoker/stable/plpgsql
shape, table return metadata, argument names/modes/types, empty search path,
single overload and API-role execute denial. It then requires the exact old
`prosrc`: 7,777 bytes, MD5
`419e2a3b56ecae64e2f30ece708c5122`, SHA256
`ce8bbb4148d541afaa751b19cfa0e041fdb164a65bde152b5a2008f59567f3e3`.

Forward substitution requires every local anchor exactly once and requires the
new source to be 7,865 bytes, MD5 `ca0b59041fad0e8554ef63c945e44b75`, SHA256
`ac9965f2e4703f4ec597489a28a6c972661050f3c4dd35643d20037da60e0862`.
Reverse anchor substitution and both identifier substitutions must recover the
complete old source byte-for-byte. The full `pg_get_functiondef` replacement is
also required to be exactly text-invertible before execution.

Independent source review caught and corrected the inverse-loop bound before any
44710 candidate execution; no actual SQL run has occurred.

After `CREATE OR REPLACE` through the captured definition, the migration checks
the same function OID, complete `pg_proc` row except `prosrc`, ACL, separately
captured comment and exact new definition. Any mismatch aborts the transaction.
The migration changes no owner, grant or comment and leaves no at-rest schema
privilege change.

## Validation boundary

Static source hashing and anchor reconstruction only; author did not execute
SQL, compile the DO block, run a parser, invoke tests, or exercise the live
catalog. Root must candidate-compile 44710 with 448 under forced rollback,
prove the pre/post catalog and row state, then run independent review and the
actual restore gates. No acceptance or production claim is made here.
