-- Slice 12 lane L1 (BE03c "CanonicalDomainRegistry / cms_canonical_domain_registry", Canonical taxonomy
-- projection (D10), DEC-135; tracker P2-S12-AC-256): the code-owned, release-seeded, immutable registry of the
-- closed canonical overlap domains and whether their owning shard has registered a provider.
--
-- Rows are inserted by forward migration only (an owning shard registers its provider by inserting a NEWER row
-- of the domain), are version-stamped, never updated or deleted, and are readable by no browser or service role:
-- only the pinned definer functions (governed submit and activation, the canonical match) read them.  The
-- current row of a domain is the one with the greatest `version`.  Phase 2 seeds `role` as built (its provider
-- reads the Shard 02 role facet assertion projection) and the other five as unbuilt (DEC-135).  The owner is the
-- seeding release record, a fixed namespaced id, as the workflow policy registry does.  Forward-only.
begin;
set local lock_timeout = '5s';

create table platform_private.cms_canonical_domain_registry (
  id uuid not null default extensions.gen_random_uuid() primary key,
  owner_id uuid not null,
  state text not null default 'seeded',
  version bigint not null,
  domain text not null,
  provider_state text not null,
  provider_key text null,
  provider_version bigint null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint cms_canonical_domain_registry_state_check check (state = 'seeded'),
  constraint cms_canonical_domain_registry_version_check check (version > 0),
  constraint cms_canonical_domain_registry_domain_check check (
    domain in ('role', 'instrument', 'gear', 'place', 'rights', 'jurisdiction')
  ),
  constraint cms_canonical_domain_registry_provider_state_check check (
    provider_state in ('built', 'unbuilt')
  ),
  constraint cms_canonical_domain_registry_provider_check check (
    (provider_state = 'built') = (provider_key is not null and provider_version is not null)
  ),
  constraint cms_canonical_domain_registry_provider_key_check check (
    provider_key is null or provider_key ~ '^[a-z][a-z0-9._-]{0,95}$'
  ),
  constraint cms_canonical_domain_registry_provider_version_check check (
    provider_version is null or provider_version > 0
  ),
  constraint cms_canonical_domain_registry_time_check check (updated_at = created_at),
  constraint cms_canonical_domain_registry_domain_version_key unique (domain, version)
);

create index cms_canonical_domain_registry_current_idx
  on platform_private.cms_canonical_domain_registry (domain, version desc);

create trigger cms_canonical_domain_registry_write_guard
before insert on platform_private.cms_canonical_domain_registry
for each row execute function platform_private.cms_write_guard();
create trigger cms_canonical_domain_registry_immutable_guard
before update or delete on platform_private.cms_canonical_domain_registry
for each row execute function platform_private.cms_immutable_guard();

alter table platform_private.cms_canonical_domain_registry enable row level security;
alter table platform_private.cms_canonical_domain_registry force row level security;
revoke all on table platform_private.cms_canonical_domain_registry
  from public, anon, authenticated, service_role;
create policy cms_canonical_domain_registry_rpc_policy
  on platform_private.cms_canonical_domain_registry
  for all to public
  using (platform_private.cms_rpc_context_valid())
  with check (platform_private.cms_rpc_context_valid());

select pg_catalog.set_config('app.cms_rpc', 'true', true);
insert into platform_private.cms_canonical_domain_registry(
  owner_id, version, domain, provider_state, provider_key, provider_version
)
select '0d6a0d6a-0000-4000-8000-000000000135'::uuid, 1, seed.domain, seed.provider_state,
       seed.provider_key, seed.provider_version
  from (values
    ('role', 'built', 'shard02.role_facet_assertion', 1::bigint),
    ('instrument', 'unbuilt', null, null),
    ('gear', 'unbuilt', null, null),
    ('place', 'unbuilt', null, null),
    ('rights', 'unbuilt', null, null),
    ('jurisdiction', 'unbuilt', null, null)
  ) as seed(domain, provider_state, provider_key, provider_version);

-- The current row of every domain, as the pinned definer functions read it.
create or replace function platform_private.cms_canonical_domain_current(p_domain text)
returns table(registry_id uuid, provider_state text, provider_key text, provider_version bigint)
language sql
stable
security definer
set search_path = ''
as $body$
  select registry.id, registry.provider_state, registry.provider_key, registry.provider_version
    from platform_private.cms_canonical_domain_registry registry
   where registry.domain = p_domain
   order by registry.version desc
   limit 1
$body$;

comment on function platform_private.cms_canonical_domain_current(text) is
  'BE03c D10: the current (greatest version) registry row of a canonical overlap domain: its id, whether the owning shard registered a provider and the provider key and version. Empty for a domain outside the closed set. Private; STABLE.';

grant select on table platform_private.cms_canonical_domain_registry to wejammin_cms_definer;
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_canonical_domain_current(text) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_canonical_domain_current(text)
  from public, anon, authenticated, service_role;

commit;
