# Supabase source

This directory is the reviewable source of truth for the WeJammin PostgreSQL foundation. Managed Supabase projects are deployment targets; their schema must be reproducible from the committed migrations and tests here.

## Schema boundaries

- `platform_private`: canonical operational records; never exposed through PostgREST.
- `audit_private`: append-only security and provenance evidence; never exposed through PostgREST.
- `platform_api`: narrow RPCs and views for authenticated application access.
- `public_api`: deliberately publishable projections only.
- `public`: not an API surface; anonymous and authenticated roles cannot create objects there.

The local API allowlist contains only `platform_api` and `public_api`. New objects remain inaccessible until their owning slice adds explicit grants and RLS or RPC authorization tests.

## Definer roles and row-level security

`postgres` has `BYPASSRLS`, so a SECURITY DEFINER function it owns is never filtered by a
policy. Every `platform_private` / `platform_api` function whose body reads or writes a forced
Slice 09 table is therefore owned by one of two dedicated roles, both `NOLOGIN NOSUPERUSER
NOBYPASSRLS`, with no membership in any other role (`postgres` is a member with INHERIT and SET so
migrations can still `CREATE OR REPLACE` and `ALTER` their functions):

- `wejammin_cms_definer` owns the CMS commands, their guards and projections, the MFA registry
  commands and the notification-intent writer. Its table access is the RPC-context gate
  (`app.cms_rpc`) plus the session-scope policies; its privileges are exactly those its bodies
  need (migration `20261003120100`), never CREATE, TRUNCATE, REFERENCES or TRIGGER.
- `wejammin_cms_authority_reader` owns the read-only authority lookups (the session-scope
  lookups the policies call, the MFA step-up capability lookup, the "known to the owner party"
  boolean). It holds SELECT only and is admitted by SELECT-only policies, so the policies that
  call it do not recurse into themselves.

To add a function that touches a forced Slice 09 table: create it, then in the same migration
`alter function ... owner to wejammin_cms_definer` (the role needs `CREATE` on the schema only for
that statement, so `grant create` before and `revoke create` after, as `20261003120500` does) and
grant the definer role the table privileges and `EXECUTE` it needs. The catalog guard in
`tests/phase_02_slice_09_sec2_definer_rls.sql` derives the table and function sets from the live
catalog and fails for a function that stays owned by a bypass role.

An RPC does not leave the RPC-context flag set: every `platform_api` function that sets it, or reaches
a command that does, restores the previous value before it returns (`20261003120400`), so a direct
write later in the same transaction is refused.

## Local verification

Docker must be running. The pinned Supabase CLI is installed through the workspace lockfile.

```sh
pnpm db:start
pnpm db:verify
pnpm db:stop
```

`db:verify` rebuilds the database from migrations, runs the database linter, executes every pgTAP test in `supabase/tests/`, then runs `pnpm db:api-test` (`tests/postgrest/`), which calls the local stack through the real Kong and PostgREST path with minted JWTs. `db:start` therefore runs `postgrest` and `kong` (the same pinned images the Supabase CLI uses); authority gates read `request.jwt.claims` through `platform_private.request_jwt_claim`, the only setting PostgREST publishes. CI uses `pnpm db:ci`, which serializes the shared self-hosted runner's local Supabase stack and always removes its data volume afterward.

Generated database types are committed at `packages/data-access/src/database.types.ts`. Run `pnpm db:types` after changing a migration; `pnpm db:types:check` proves the committed artifact matches the rebuilt schema.

## Migration policy

Create migrations with `pnpm exec supabase migration new <name>`. Migrations are immutable and forward-only after they reach a shared environment. Correct a released migration with a new compensating migration; never rewrite history or rely on a destructive rollback. Seeds contain synthetic, non-sensitive fixtures only.

Remote project references, access tokens, database passwords, and service-role keys never belong in this directory or Git history.
