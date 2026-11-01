# Lane report — s12_pattern_sql_red (CMS-03C-02 SQL QA-RED)

Worktree: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin` (branch `claude/phase2-slice12`, HEAD
`b16edb54a7a1b698ed8ca15b6085046d4270626e`). Root: `gpt-6.1-sol`, `ultra`.

**Status: UNRUN SKELETON / SETUP-BLOCKED.** This lane is a QA draft and dependency report only. Nothing has
been executed, so it claims no verified behaviour, no row-order proof, no atomicity and no verified fixture
control. No production, spec, contract, config, type, manifest, lock or migration edit. No stage/commit. No
test, DB, docker, psql, format, lint or build command run (heavy-command HOLD respected).

## Exclusive files written

- NEW `supabase/tests/phase_02_slice_12_pattern_placement.sql` (127 lines)
- NEW `supabase/tests/phase_02_slice_12_pattern_placement/000-fixtures.sqlinc` (150 lines)
- NEW `supabase/tests/phase_02_slice_12_pattern_placement/README.md` (74 lines)
- NEW `docs/handoffs/2026-10-12-claude-s12/lane-codex-pattern-sql-red-report.md` (this file)

All within the <=300-line cap and inside the lane's exclusive ownership. No file outside ownership was
touched.

## The command under test

`platform_api.cms_insert_pattern_instance(jsonb)` -> `platform_private.cms_insert_pattern_instance(jsonb)`
(BE03c Route Registry row 160, "Pattern versions and linked updates (D9, OD-2)"). Root verified by `rg`
across `supabase/migrations` that the producer name is absent. The production adapter
(`apps/worker/src/cms-composition-production-pattern.ts:144`) posts to
`/rest/v1/rpc/cms_insert_pattern_instance` with `p_request` = the `PatternInstanceRequestSchema` members plus
`idempotencyKey`/`ifMatch`/`context`/`correlationId`; the SQL RED mirrors that request exactly.

## Intended RED (authored, not executed)

The file is authored so the command must EXIST and its REAL outputs succeed; it does not treat absence as the
desired behavior. Nothing has run. A missing function would be captured as SQLSTATE `42883`
(undefined_function) through `pg_temp.s10_rpc_exec`, which runs in a subtransaction, so a future run would
keep the whole pgTAP harness alive and report every assertion. No positive, order or atomicity proof is
claimed from this draft.

## Assertion inventory (authored; UNRUN)

Controls (expected to pass, not verified):
1. the harness executor is healthy and the base fixture include ran without error;
2. the placement target is the entry's current draft revision;
3. the target revision already holds one composition row (so a placement must append).

Command existence (expected to fail while the command is absent):
4. `has_function('platform_api','cms_insert_pattern_instance',array['jsonb'])`;
5. `has_function('platform_private','cms_insert_pattern_instance',array['jsonb'])`;
6. exact-signature existence check `s10_fn_exists('platform_private','cms_insert_pattern_instance','jsonb')`.

Schema shape (expected to fail; read dynamically so an absent column is an assertion and not a parse abort):
7. `cms_composition_instances.position` exists and is `NOT NULL` (DEC-185).

Refusals (expected to fail while the command is absent):
8. a stale entry `If-Match` -> `COMPOSITION_VERSION_CONFLICT`;
9. a caller without edit authority -> `COMPOSITION_FORBIDDEN`;
10. a row `path` over 248 octets -> `COMPOSITION_VALIDATION_FAILED` at `/slotPath` (DEC-186);
11. an override key naming no node -> `COMPOSITION_VALIDATION_FAILED` at `/overrides`.

Positive matrix (an authored OUTLINE, not executable assertions; UNRUN — see setup block): a two-block-root
forest on the genuine no-template draft revision (expected items paths `/hero,/cta`, positions `0,1`,
per-row pins and `linked` link mode with a 64-hex digest); a nested-reference forest expanding to
`/shared/a,/tail` (DEC-181); an append into the occupied `primary` slot starting one above the existing row
(DEC-185); and an unchanged revision content hash on success (AC-219). These are unrun skeleton lines, not
replaced by a static positive.

## Oracle gaps (honest limits)

- Boundary isolation: the refusal cases cannot isolate their intended boundary while no real active
  compatible pattern exists. Once the RPC exists, a missing or inactive `patternA` may refuse before the
  version, authority, overlong-path or override check, so each refusal is labelled BLOCKED until the
  guarded create/activate producers exist.
- Overlong value: the row `path` is the request `slotPath` joined with the root's key chain. `slotPath` `/`
  + 250 `x` (251 octets) yields a row path of 256 octets, over the 248-octet bound; the earlier 240-`x`
  value was 247 octets and did not exceed the bound. The case remains BLOCKED (unrun) for the reason above.
- Atomicity: the whole-effects snapshot hashes the composition, revision, live-review and entry rows by full
  content but only counts the append-only audit/outbox/idempotency rows; the counts are not full-row proof.
  It is not asserted by this draft, which therefore makes no atomicity claim.

## Static versus runtime limits

- Static (catalog) assertions: 4-7.
- Runtime assertions requiring the command: 8-11 and the positive matrix.
- `pg_temp.s12pat_snapshot` (whole-effects digest: composition rows, revision row, live editorial review,
  entry row, and append-only audit/outbox/idempotency counts) is prepared for the GREEN run and is NOT
  asserted now, because with no command a "snapshot unchanged" comparison passes vacuously and proves no
  runtime atomicity.

## Exact missing dependencies (setup blocked; reported, not fabricated)

- `cms_insert_pattern_instance` (CMS-03C-02) — the command under test, absent in both schemas.
- `cms_create_pattern_version` (CMS-03C-12) — the guarded producer that creates a pattern version; absent,
  so no real command creates a pattern version.
- `cms_activate_governed_subject` (CMS-03C-09) — the guarded producer that reaches `active`; absent, so no
  real command reaches `active`.
- no real active-template producer (CMS-03C-01 creates a draft only), needed for any template-bound slot.
- the DEC-185 `position` migration — the column is absent, so the append/no-renumber clause is
  unimplementable.
- the server block-registry-digest recompute RPC — absent, so a real pinned forest with a server digest
  cannot be exercised.

Because of these, a guard-preserving POSITIVE placement fixture cannot be built, and the positive matrix is
UNRUN. The Slice 11 registry's `pg_temp.h11_raw_insert` active-pattern seed is deliberately NOT reused:
it executes `ALTER TABLE ... DISABLE TRIGGER USER` (`phase_02_slice_11_helpers/000-helpers.sqlinc:126-159`)
and writes a fabricated `block_tree`/digest, so it is a data-model seam, not a real active-compatible pinned
pattern or a command effect. No trigger was disabled and no digest was fabricated by this lane.

## Fixture provenance (genuine rows only)

The base fixture uses `pg_temp.h11w_revision` (a direct insert under `app.cms_rpc`; no trigger disabled) to
mint a draft entry + current draft revision of the active `h11doc` content type, and one direct
`cms_composition_instances` insert (guards active) as the pre-existing row. `h11w_revision` derives the
entry/revision identity from a tag and sets `current_draft_revision_id`, so the row is exactly a current
draft revision. The request builder reproduces the production adapter's `p_request`.

## Pending owner choices respected

Independent of the immutable-definition-version vs separate-lifecycle-counter choice (the fixture never
touches `lifecycle_version`), of the private expired-verifying fresh CAS recovery proposal, and of the
response-only 1 MiB vs 256 KiB transport choice (a 1-3 row positive forest is used, not 512). None of those
contracts is changed.

## Planned command (each takes the quiet lock; pending root release)

```
flock -s /tmp/wejammin-quiet.lock env PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH \
  pnpm exec supabase test db --local supabase/tests/phase_02_slice_12_pattern_placement.sql
```

The exact lane runner is root's to authorize. Predicted RED (prediction, not a gate): the 3 controls pass;
the 4 command-existence/column assertions fail; the 4 refusals fail as `42883`. Node `22.23.1` / pnpm
`11.24.0`. Actual counts will be reported from the run, never forced to match.

## Scope honesty

No GREEN implementation, no acceptance claim, no whole-285-criteria claim. Governed activation is not
claimed from any seed. This lane produced the SQL RED and its support files only.
