# DEC-194 RPC probe OID JSON producer — author freeze

Author: native `gpt-6.1-sol` / `ultra`, 2026-10-16.
Worktree: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.
Status: **UNRUN harness correction, not actual RPC isolation proof.**

Root claimed/released exactly the probe ownership SQL fragment and this new
report in S12 Dispatch. No other file was edited. No formatter, parser, import,
test, process, DB, Docker, network, Git or runtime cleanup was run by this author.
Read the full fragment and relevant unchanged TypeScript ownership assertions;
source/hash analysis used context-mode, edits used `apply_patch`. Migration,
Supabase/security and verification guidance preserve the strict producer/consumer
and evidence boundary here.

## Actual failing boundary and narrow correction

Root reports the actual HTTP suite failed in `beforeAll` at
`Number.isSafeInteger(binding.oid)`. The test case was skipped; no actual RPC
isolation result follows. Root's separately authorized read-only PostgreSQL check
observed `jsonb_build_object` emitting the OID values as JSON strings: trigger
`28926`, function `28916`. These are root-reported observations, not author DB
execution or reusable ownership authority.

The unchanged consumer in
[`phase-02-slice-12-dec194-alt-stack.ts:171`](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/tests/postgrest/support/phase-02-slice-12-dec194-alt-stack.ts:171)
requires positive safe integer trigger/function OIDs, exact function schema and
name, then records the acquired binding. Those checks remain intact; there is no
string coercion, adopted cleanup binding or relaxed ownership assertion.

Only the ACTIVATE JSON producer changed:

```sql
'oid', t.oid::bigint, 'functionOid', t.tgfoid::bigint
```

Both catalog OIDs are uint32 values; converting them to bigint produces JSON
numbers without losing identity because the full uint32 range is below the
JavaScript safe-integer limit. Existing positivity/type/ownership validation stays
responsible for admission. No query predicate, trigger/function identity, lock,
transaction, role, grant, assertion or cleanup behavior changed.

## Static byte proof and freeze

The SQL fragment is 46 LF-terminated lines, with exactly two `::bigint` casts:

- Before SHA-256:
  `33de400702d9616b893ef3213f20c9fbc1dca940405965478ce0897b1f6f484c`.
- Corrected SHA-256:
  `ca288ea4cdd778745ecbbba33d92563212104ed19c9575924d6434fd75b76470`.
- Reversing only those two casts reproduces the complete before SHA-256 exactly.
- The entire `-- DEC194_CLEANUP` section is byte-identical, SHA-256
  `0a23dc1ab8d025fd6fe238136d3bcd84e1e9dd0661fdff35a3e8a5dd64601859`.

Root's manual residual cleanup is separately claimed and must use its exact
observed ownership binding plus unchanged RESTRICT operations. This correction
does not authorize cleanup, adoption of a pre-existing object, role changes,
service control or any database operation by the author.

Root owns the pending 19-case safety regression and actual HTTP rerun. The new
producer remains author UNRUN; no passed hook, test, real Worker→Kong→PostgREST
isolation, migration or slice-completion claim is made. The separate DEC-197
314-case result/lint receipt does not verify this DEC-194 correction.
