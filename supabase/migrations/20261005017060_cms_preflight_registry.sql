-- Slice 11 data model (BE03b D19 "Publication preflight registry", DEC-134, D25,
-- Database Schema "PreflightRegistry"; tracker P2-S11-AC-093 .. AC-098): the
-- code-owned, immutable registry of the seventeen publication preflight
-- categories and their providers.
--
-- Review submission, schedule acceptance, schedule execution and publication
-- evaluate one closed set of categories (PreflightCategory) through this
-- registry.  Rows are seeded by forward migration only, are never writable by a
-- caller and never updated or deleted; the CURRENT row of a category is the one
-- with the greatest registry version, and a later slice registers its provider
-- by a forward migration that inserts a strictly newer row for its category (the
-- insert guard refuses a row that is not newer).  CI asserts the registry
-- categories equal the contracts PreflightCategory enum.
--
-- Registry version 1 (this migration):
--   * ten `database` providers, keyed preflight.<category>, version 1:
--     contract, schema, template, block, settings, relation, security,
--     migration, domain_binding, revocation;
--   * one `worker` provider: accessibility = cms.a11y.structural version 1
--     (DEC-134: the BE05c structural checker, the first worker provider);
--   * six categories whose owning domain has no provider yet are served by the
--     generic `reference_gate` provider (D19): pattern and taxonomy and locale
--     (Slice 12), route (Slice 13), media (Slice 14), privacy (Slice 16).  The
--     gate passes only when the revision holds no reference of that kind and
--     otherwise fails closed with provider_unbuilt_reference; the owning slice
--     replaces the row with a newer one.
-- owner_slice names the slice that owns the category's provider: the delivering
-- slice for a built provider (slice-11) and the registering slice for a gated
-- category.  The seeding release record is the fixed namespaced id
-- 0d6a0d6a-0000-4000-8000-000000000134 (DEC-134).  The function is SECURITY
-- INVOKER.  Forward-only.
begin;

set local lock_timeout = '5s';

create table platform_private.cms_preflight_registry (
  id uuid not null default extensions.gen_random_uuid() primary key,
  owner_id uuid not null,
  state text not null,
  version bigint not null,
  category text not null,
  owner_slice text not null,
  provider_key text not null,
  provider_version bigint not null,
  provider_kind text not null,
  reference_kind text null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint cms_preflight_registry_state_check check (state = 'seeded'),
  constraint cms_preflight_registry_version_check check (version > 0),
  constraint cms_preflight_registry_category_check check (
    category in (
      'contract', 'schema', 'template', 'block', 'pattern', 'taxonomy',
      'settings', 'relation', 'privacy', 'security', 'accessibility', 'media',
      'route', 'locale', 'migration', 'domain_binding', 'revocation'
    )
  ),
  constraint cms_preflight_registry_owner_slice_check
    check (owner_slice ~ '^[a-z0-9._-]{1,32}$'),
  constraint cms_preflight_registry_provider_key_check
    check (provider_key ~ '^[a-z][a-z0-9._-]{0,127}$'),
  constraint cms_preflight_registry_provider_version_check
    check (provider_version > 0),
  constraint cms_preflight_registry_provider_kind_check
    check (provider_kind in ('database', 'worker', 'reference_gate')),
  constraint cms_preflight_registry_reference_kind_check check (
    reference_kind is null
    or reference_kind in ('pattern', 'taxonomy', 'privacy', 'media', 'route', 'locale')
  ),
  constraint cms_preflight_registry_gate_kind_check check (
    (provider_kind = 'reference_gate') = (reference_kind is not null)
  ),
  -- The reference gate is one generic provider and checks the references of the
  -- category it stands in for.
  constraint cms_preflight_registry_gate_provider_check check (
    (provider_kind = 'reference_gate') = (provider_key = 'preflight.reference_gate')
  ),
  constraint cms_preflight_registry_gate_category_check check (
    reference_kind is null or reference_kind = category
  ),
  constraint cms_preflight_registry_time_check check (updated_at = created_at),
  constraint cms_preflight_registry_category_version_key unique (category, version)
);

create or replace function platform_private.cms_preflight_registry_guard()
returns trigger
language plpgsql
set search_path = ''
as $body$
declare
  current_version bigint;
begin
  select pg_catalog.max(registry_row.version) into current_version
    from platform_private.cms_preflight_registry registry_row
   where registry_row.category = new.category;
  if current_version is not null and new.version <= current_version then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  return new;
end;
$body$;

-- The seed runs inside a CMS migration context, exactly like the workflow policy
-- registry; the guard order is write guard, then the newer-row guard.
select pg_catalog.set_config('app.cms_rpc', 'true', true);

create trigger cms_preflight_registry_write_guard
before insert on platform_private.cms_preflight_registry
for each row execute function platform_private.cms_write_guard();
create trigger cms_preflight_registry_z_newer_guard
before insert on platform_private.cms_preflight_registry
for each row execute function platform_private.cms_preflight_registry_guard();
create trigger cms_preflight_registry_immutable_guard
before update or delete on platform_private.cms_preflight_registry
for each row execute function platform_private.cms_immutable_guard();

insert into platform_private.cms_preflight_registry(
  owner_id, state, version, category, owner_slice, provider_key,
  provider_version, provider_kind, reference_kind
)
select '0d6a0d6a-0000-4000-8000-000000000134'::uuid, 'seeded', 1,
       member.category, member.owner_slice, member.provider_key, 1,
       member.provider_kind, member.reference_kind
from (values
  ('contract',       'slice-11', 'preflight.contract',       'database',       null),
  ('schema',         'slice-11', 'preflight.schema',         'database',       null),
  ('template',       'slice-11', 'preflight.template',       'database',       null),
  ('block',          'slice-11', 'preflight.block',          'database',       null),
  ('pattern',        'slice-12', 'preflight.reference_gate', 'reference_gate', 'pattern'),
  ('taxonomy',       'slice-12', 'preflight.reference_gate', 'reference_gate', 'taxonomy'),
  ('settings',       'slice-11', 'preflight.settings',       'database',       null),
  ('relation',       'slice-11', 'preflight.relation',       'database',       null),
  ('privacy',        'slice-16', 'preflight.reference_gate', 'reference_gate', 'privacy'),
  ('security',       'slice-11', 'preflight.security',       'database',       null),
  ('accessibility',  'slice-11', 'cms.a11y.structural',      'worker',         null),
  ('media',          'slice-14', 'preflight.reference_gate', 'reference_gate', 'media'),
  ('route',          'slice-13', 'preflight.reference_gate', 'reference_gate', 'route'),
  ('locale',         'slice-12', 'preflight.reference_gate', 'reference_gate', 'locale'),
  ('migration',      'slice-11', 'preflight.migration',      'database',       null),
  ('domain_binding', 'slice-11', 'preflight.domain_binding', 'database',       null),
  ('revocation',     'slice-11', 'preflight.revocation',     'database',       null)
) as member(category, owner_slice, provider_key, provider_kind, reference_kind);

alter table platform_private.cms_preflight_registry enable row level security;
alter table platform_private.cms_preflight_registry force row level security;
revoke all on table platform_private.cms_preflight_registry
  from public, anon, authenticated, service_role;
-- Rows are code-owned constants: no role holds a table grant, the CMS definer
-- functions read them inside their RPC context, and an insert is admitted only
-- inside a CMS migration/RPC context (the one gate every cms_ table uses).
create policy cms_preflight_registry_rpc_policy
  on platform_private.cms_preflight_registry
  for all to public
  using (platform_private.cms_rpc_context_valid())
  with check (platform_private.cms_rpc_context_valid());

revoke all on function platform_private.cms_preflight_registry_guard()
  from public, anon, authenticated, service_role;

-- SEC-2: a function whose body names a forced-RLS CMS table is owned by the
-- NOLOGIN, non-BYPASSRLS definer role (the catalog guard in
-- supabase/tests/phase_02_slice_09_sec2_definer_rls.sql derives the set from the
-- live bodies), exactly as the Slice 09 schema-review guards are.  ALTER FUNCTION
-- ... OWNER TO needs CREATE on the function's schema for the new owner, held for
-- this transaction only.  The guard stays SECURITY INVOKER: it runs with the
-- privileges of the calling role, so the definer functions that write the table
-- (Slice 11 command migrations) are the ones that hold the table verbs.
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_preflight_registry_guard() owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;

commit;
