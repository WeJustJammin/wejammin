-- DEC-119/DEC-120 owner CMS capability grants (BE03a "Persistence", CMS-03A-15
-- to CMS-03A-18): the closed code-owned grantable registry, the three platform
-- registry members it adds, the private CapabilityGrant aggregate and its
-- append-only event history, and the owner-initialization backfill.  Only the
-- named grant/renew/revoke RPCs write the aggregate; each write also upserts the
-- identity_private.organization_actor_grant projection that every CMS capability
-- predicate reads.  A standing grant spans at most 90 UTC days
-- (valid_through - valid_from <= 89).  Forward-only.
begin;

-- The platform capability registry gains the navigation and media members the
-- grantable set names (BE03a "Grantable capability registry consistency").
create or replace function platform_private.cms_capability_registry_valid(
  p_key text, p_version bigint default null
)
returns boolean
language sql
immutable
set search_path = ''
as $body$
  select exists (
    select 1 from (values
      ('cms.schema_designer', 1::bigint),
      ('cms.schema_registry.read', 1::bigint),
      ('cms.public_content.read', 1::bigint),
      ('cms.content.article', 1::bigint),
      ('cms.article.card', 1::bigint),
      ('cms.author', 1::bigint),
      ('cms.editor', 1::bigint),
      ('cms.reviewer', 1::bigint),
      ('cms.template_designer', 1::bigint),
      ('cms.schema_review', 1::bigint),
      ('cms.schema_review.assign', 1::bigint),
      ('cms.reviewer.policy', 1::bigint),
      ('cms.reviewer.legal', 1::bigint),
      ('cms.reviewer.security', 1::bigint),
      ('cms.reviewer.financial', 1::bigint),
      ('cms.publisher', 1::bigint),
      ('cms.taxonomy_curator', 1::bigint),
      ('cms.navigation_editor', 1::bigint),
      ('cms.media_contributor', 1::bigint),
      ('cms.media_curator', 1::bigint)
    ) as registry(key, version)
    where registry.key = p_key
      and (p_version is null or registry.version = p_version)
  )
$body$;

-- The closed GrantableCmsCapability set.  cms.schema_review and
-- cms.schema_review.assign (assignment-only / owner-only), the delivery-review
-- pair, cms.public_content.read, every admin.* key, wildcards and unregistered
-- keys are never members.  Extended only by code plus a forward migration.
create or replace function platform_private.cms_grantable_capability(p_key text)
returns boolean
language sql
immutable
set search_path = ''
as $body$
  select coalesce(p_key in (
    'cms.schema_registry.read', 'cms.schema_designer', 'cms.template_designer',
    'cms.taxonomy_curator', 'cms.author', 'cms.editor', 'cms.reviewer',
    'cms.reviewer.policy', 'cms.reviewer.legal', 'cms.reviewer.security',
    'cms.reviewer.financial', 'cms.publisher', 'cms.navigation_editor',
    'cms.media_contributor', 'cms.media_curator'
  ) and platform_private.cms_capability_registry_valid(p_key, 1), false)
$body$;

create table platform_private.cms_capability_grants (
  id uuid not null default extensions.gen_random_uuid() primary key,
  owner_id uuid not null references identity_private.organization_party(party_id),
  state text not null default 'active',
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  subject_person_ref uuid not null references platform_private.person_party(party_id),
  capability_code text not null,
  valid_from date not null,
  valid_through date not null,
  grantor_person_ref uuid not null references platform_private.person_party(party_id),
  last_action text not null,
  reason text,
  constraint cms_capability_grants_state_check check (state in ('active', 'revoked')),
  constraint cms_capability_grants_capability_check check (
    capability_code ~ '^[a-z][a-z0-9_.-]{0,127}$'
  ),
  constraint cms_capability_grants_last_action_check check (
    last_action in ('granted', 'renewed', 'revoked')
  ),
  constraint cms_capability_grants_reason_check check (
    reason is null or pg_catalog.octet_length(reason) between 1 and 256
  ),
  constraint cms_capability_grants_term_check check (
    valid_through >= valid_from and valid_through - valid_from <= 89
  ),
  constraint cms_capability_grants_revoked_action_check check (
    (state = 'revoked') = (last_action = 'revoked')
  ),
  constraint cms_capability_grants_key_unique unique (owner_id, subject_person_ref, capability_code)
);

create index cms_capability_grants_owner_state_through_idx
  on platform_private.cms_capability_grants (owner_id, state, valid_through);
create index cms_capability_grants_owner_updated_idx
  on platform_private.cms_capability_grants (owner_id, updated_at desc);

create table platform_private.cms_capability_grant_events (
  id uuid not null default extensions.gen_random_uuid() primary key,
  owner_id uuid not null,
  state text not null default 'recorded',
  version bigint not null default 1,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  grant_id uuid not null references platform_private.cms_capability_grants(id),
  aggregate_version bigint not null check (aggregate_version > 0),
  action text not null,
  subject_person_ref uuid not null,
  capability_code text not null,
  grantor_person_ref uuid not null,
  valid_from date not null,
  valid_through date not null,
  prior_valid_through date,
  reason text,
  binding_context_hash char(64) not null,
  mfa_verified_at timestamptz not null,
  constraint cms_capability_grant_events_state_check check (state = 'recorded'),
  constraint cms_capability_grant_events_version_check check (version = 1),
  constraint cms_capability_grant_events_action_check check (
    action in ('granted', 'renewed', 'revoked')
  ),
  constraint cms_capability_grant_events_reason_check check (
    reason is null or pg_catalog.octet_length(reason) between 1 and 256
  ),
  constraint cms_capability_grant_events_binding_hash_check check (
    binding_context_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint cms_capability_grant_events_immutable_check check (updated_at = created_at),
  constraint cms_capability_grant_events_aggregate_unique unique (grant_id, aggregate_version)
);

create index cms_capability_grant_events_owner_created_idx
  on platform_private.cms_capability_grant_events (owner_id, created_at desc);
create index cms_capability_grant_events_grant_created_idx
  on platform_private.cms_capability_grant_events (grant_id, created_at desc);

-- Aggregate guard: owner, subject, capability and creation never change, the
-- version advances by exactly one on every write, and DELETE is rejected.
create or replace function platform_private.cms_capability_grant_guard()
returns trigger
language plpgsql
set search_path = ''
as $body$
begin
  if tg_op = 'DELETE' then
    raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
  end if;
  if new.owner_id is distinct from old.owner_id
     or new.subject_person_ref is distinct from old.subject_person_ref
     or new.capability_code is distinct from old.capability_code
     or new.created_at is distinct from old.created_at
     or new.version <> old.version + 1 then
    raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
  end if;
  return new;
end;
$body$;

-- Event history is append-only.
create or replace function platform_private.cms_capability_grant_event_guard()
returns trigger
language plpgsql
set search_path = ''
as $body$
begin
  if tg_op <> 'INSERT' then
    raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
  end if;
  return new;
end;
$body$;

create trigger cms_capability_grants_write_guard
before insert or update or delete on platform_private.cms_capability_grants
for each row execute function platform_private.cms_write_guard();
create trigger cms_capability_grants_z_state_guard
before update or delete on platform_private.cms_capability_grants
for each row execute function platform_private.cms_capability_grant_guard();
create trigger cms_capability_grant_events_write_guard
before insert or update or delete on platform_private.cms_capability_grant_events
for each row execute function platform_private.cms_write_guard();
create trigger cms_capability_grant_events_z_append_guard
before insert or update or delete on platform_private.cms_capability_grant_events
for each row execute function platform_private.cms_capability_grant_event_guard();

do $body$
declare
  table_name text;
begin
  foreach table_name in array array['cms_capability_grants', 'cms_capability_grant_events'] loop
    execute format('alter table platform_private.%I enable row level security', table_name);
    execute format('alter table platform_private.%I force row level security', table_name);
    execute format('revoke all on table platform_private.%I from public, anon, authenticated, service_role', table_name);
    execute format('create policy %I on platform_private.%I for all to public using (platform_private.cms_rpc_context_valid()) with check (platform_private.cms_rpc_context_valid())', table_name || '_rpc_policy', table_name);
  end loop;
end;
$body$;

-- Owner-initialization backfill: one version-1 'granted' aggregate (grantor =
-- the initialization receipt person) for each existing grantable CMS-capability
-- actor-grant row of the owner's organization, so the initialization grants are
-- listable and renewable.  A row with no end date, an inverted or over-long term
-- cannot be an aggregate and is left to its projection untouched.
create or replace function platform_private.cms_backfill_owner_capability_grants(p_organization_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $body$
declare
  receipt_person uuid;
  previous_rpc text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  inserted integer;
begin
  select receipt.person_id into receipt_person
    from platform_private.cms_owner_initialization receipt
   where receipt.organization_id = p_organization_id;
  if receipt_person is null then
    return 0;
  end if;
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  insert into platform_private.cms_capability_grants(
    owner_id, state, version, created_at, updated_at, subject_person_ref,
    capability_code, valid_from, valid_through, grantor_person_ref, last_action
  )
  select actor_grant.organization_id,
         case when actor_grant.active then 'active' else 'revoked' end,
         1, actor_grant.created_at, actor_grant.created_at, actor_grant.person_id,
         actor_grant.capability_code, actor_grant.valid_from, actor_grant.valid_through,
         receipt_person,
         case when actor_grant.active then 'granted' else 'revoked' end
    from identity_private.organization_actor_grant actor_grant
   where actor_grant.organization_id = p_organization_id
     and platform_private.cms_grantable_capability(actor_grant.capability_code)
     and actor_grant.valid_through is not null
     and actor_grant.valid_through >= actor_grant.valid_from
     and actor_grant.valid_through - actor_grant.valid_from <= 89
  on conflict (owner_id, subject_person_ref, capability_code) do nothing;
  get diagnostics inserted = row_count;
  perform pg_catalog.set_config('app.cms_rpc', previous_rpc, true);
  return inserted;
end;
$body$;

create or replace function platform_private.cms_owner_initialization_backfill_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $body$
begin
  perform platform_private.cms_backfill_owner_capability_grants(new.organization_id);
  return new;
end;
$body$;

create trigger cms_owner_initialization_capability_grant_backfill
after insert on platform_private.cms_owner_initialization
for each row execute function platform_private.cms_owner_initialization_backfill_trigger();

select platform_private.cms_backfill_owner_capability_grants(receipt.organization_id)
  from platform_private.cms_owner_initialization receipt;

revoke all on function platform_private.cms_grantable_capability(text),
  platform_private.cms_capability_grant_guard(),
  platform_private.cms_capability_grant_event_guard(),
  platform_private.cms_backfill_owner_capability_grants(uuid),
  platform_private.cms_owner_initialization_backfill_trigger()
  from public, anon, authenticated, service_role;

commit;
