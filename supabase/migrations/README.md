# Database migrations

## Contents

Timestamped SQL files define the canonical PostgreSQL schema, RLS policies,
authority functions, audit records, and forward-only compatibility changes.
They run in filename order during local reset and CI verification.

## Ownership

This directory owns schema evolution only. Application orchestration belongs in
`packages/application`; generated TypeScript projections belong in
`packages/data-access/src/database.types.ts`.

## Extension

Add a new timestamped migration for every schema change. Never rewrite a
migration that has been applied to a shared environment. Use a forward fix and
pair it with pgTAP coverage in `../tests`.

## Conventions

- Qualify objects with their schema.
- Enable and force RLS on private authority tables.
- Revoke default access before granting the narrow executable boundary.
- Keep `security definer` functions on a fixed, empty `search_path`.
- Treat destructive rollback as prohibited production behavior.

## Slice 09 DEC-108 schema-review chain

`20261002120000` to `20261002137000` add the CMS-owned activation producers in
dependency order: capability and workflow-policy registries, the three private
review tables and their invalidation triggers, attempt-scoped dry-run reports and
plans, the versioned artifact compiler, shared review authority helpers, then
one command per migration (successor, dry-run, submit, assign, decide, review
read, template-compatibility resolver, activation, detail projection), the
state and edit-in-review fixes, and a final grant sweep. The `platform_api`
wrappers are service-role only and every `platform_private.cms_*` function stays
ungranted. pgTAP coverage is `../tests/phase_02_slice_09_dec108_*.sql`.

## Related links

- `../tests/README.md`
- `../../docs/runbooks/platform/release-recovery-gates.md`
- `../../.memory/wiki/specs/be/00-infrastructure.md`
