-- BE03a "transform registry": the typed, code-owned registry resolved by the
-- dry-run scan and the backfill executor.  One immutable seeded row per member
-- replaces the hard-coded key/version list of
-- cms_transform_registry_member_valid.  A member is
-- { key, version, sourceConstraints, targetConstraints, acceptedFieldKinds,
-- behavior }; its digest is the lowercase SHA-256 hex of the RFC 8785/JCS
-- canonical JSON of exactly that object.  Nothing here accepts an uploaded
-- expression, SQL or code: the registry is extended only by shipping a member
-- in code plus a forward migration.  The two initial members are version 1 and
-- their digests equal the Worker's code-owned registry literals.  Forward-only.
begin;

create table platform_private.cms_schema_transform_registry (
  id uuid not null default extensions.gen_random_uuid() primary key,
  owner_id uuid not null,
  state text not null default 'seeded',
  version bigint not null check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  transform_key text not null,
  transform_version bigint not null check (transform_version > 0),
  digest char(64) not null,
  source_constraints jsonb not null,
  target_constraints jsonb not null,
  accepted_field_kinds jsonb not null,
  behavior text not null,
  constraint cms_schema_transform_registry_state_check check (state = 'seeded'),
  constraint cms_schema_transform_registry_key_check check (transform_key ~ '^[a-z][a-z0-9._-]{0,127}$'),
  constraint cms_schema_transform_registry_digest_check check (digest ~ '^[a-f0-9]{64}$'),
  constraint cms_schema_transform_registry_constraints_check check (
    pg_catalog.jsonb_typeof(source_constraints) = 'object'
    and pg_catalog.jsonb_typeof(target_constraints) = 'object'
  ),
  constraint cms_schema_transform_registry_kinds_check check (
    pg_catalog.jsonb_typeof(accepted_field_kinds) = 'array'
    and pg_catalog.jsonb_array_length(accepted_field_kinds) between 1 and 14
  ),
  constraint cms_schema_transform_registry_behavior_check check (
    pg_catalog.octet_length(behavior) between 1 and 512
  ),
  constraint cms_schema_transform_registry_version_match_check check (version = transform_version),
  constraint cms_schema_transform_registry_created_immutable_check check (updated_at = created_at),
  constraint cms_schema_transform_registry_member_unique unique (transform_key, transform_version)
);

-- The one place the member digest is defined, shared by the seed, the resolver
-- and CI so a drifted row can never validate itself.
create or replace function platform_private.cms_transform_registry_digest(
  p_key text, p_version bigint, p_source_constraints jsonb, p_target_constraints jsonb,
  p_accepted_field_kinds jsonb, p_behavior text
)
returns text
language sql
immutable
set search_path = ''
as $body$
  select platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
    'key', p_key,
    'version', p_version,
    'sourceConstraints', p_source_constraints,
    'targetConstraints', p_target_constraints,
    'acceptedFieldKinds', p_accepted_field_kinds,
    'behavior', p_behavior
  ))
$body$;

-- The seeded members.  The owner is the release record carrying this migration
-- (a fixed namespaced id), as for the workflow policy registry.
select pg_catalog.set_config('app.cms_rpc', 'true', true);
insert into platform_private.cms_schema_transform_registry(
  owner_id, version, transform_key, transform_version, digest,
  source_constraints, target_constraints, accepted_field_kinds, behavior
)
select '0d6a0d6a-0000-4000-8000-000000000108'::uuid, member.version, member.key, member.version,
       platform_private.cms_transform_registry_digest(
         member.key, member.version, '{}'::jsonb, '{}'::jsonb,
         member.accepted_field_kinds, member.behavior),
       '{}'::jsonb, '{}'::jsonb, member.accepted_field_kinds, member.behavior
from (values
  ('identity.revalidate', 1::bigint,
   '["short_text","long_text","rich_text","boolean","integer","decimal","date","datetime","enum","taxonomy","relation","media","object","list"]'::jsonb,
   'carry-row-unchanged;validate-target-constraints-per-ia-field-kind;refuse-unsupported-kind-validator-or-missing-constraints'),
  ('default.fill_literal', 1::bigint,
   '["short_text","long_text","boolean","integer","decimal","date","datetime","enum"]'::jsonb,
   'write-declared-literal-default-when-value-absent-or-null;pass-present-value-unchanged')
) as member(key, version, accepted_field_kinds, behavior);

create trigger cms_schema_transform_registry_write_guard
before insert on platform_private.cms_schema_transform_registry
for each row execute function platform_private.cms_write_guard();
create trigger cms_schema_transform_registry_immutable_guard
before update or delete on platform_private.cms_schema_transform_registry
for each row execute function platform_private.cms_immutable_guard();

alter table platform_private.cms_schema_transform_registry enable row level security;
alter table platform_private.cms_schema_transform_registry force row level security;
revoke all on table platform_private.cms_schema_transform_registry
  from public, anon, authenticated, service_role;
create policy cms_schema_transform_registry_read_policy
  on platform_private.cms_schema_transform_registry
  for select to public using (true);
create policy cms_schema_transform_registry_seed_policy
  on platform_private.cms_schema_transform_registry
  for insert to public with check (platform_private.cms_rpc_context_valid());

-- Fail-closed resolver: exactly one seeded row whose stored digest equals the
-- recomputation of the row's own columns, else NULL (absence, ambiguity or a
-- digest mismatch never resolves).
create or replace function platform_private.cms_transform_registry_member(
  p_key text, p_version bigint
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  member_row platform_private.cms_schema_transform_registry%rowtype;
  member_count integer;
begin
  if p_key is null or p_version is null then
    return null;
  end if;
  select count(*) into member_count
    from platform_private.cms_schema_transform_registry member
   where member.transform_key = p_key and member.transform_version = p_version;
  if member_count <> 1 then
    return null;
  end if;
  select * into member_row
    from platform_private.cms_schema_transform_registry member
   where member.transform_key = p_key and member.transform_version = p_version;
  if member_row.digest is distinct from platform_private.cms_transform_registry_digest(
       member_row.transform_key, member_row.transform_version,
       member_row.source_constraints, member_row.target_constraints,
       member_row.accepted_field_kinds, member_row.behavior) then
    return null;
  end if;
  return pg_catalog.jsonb_build_object(
    'key', member_row.transform_key,
    'version', member_row.transform_version,
    'digest', member_row.digest,
    'sourceConstraints', member_row.source_constraints,
    'targetConstraints', member_row.target_constraints,
    'acceptedFieldKinds', member_row.accepted_field_kinds,
    'behavior', member_row.behavior
  );
end;
$body$;

-- A transform pair is valid exactly when the seeded, digest-verified registry
-- resolves it (the hard-coded allowlist semantics are replaced).
create or replace function platform_private.cms_transform_registry_member_valid(
  p_key text, p_version bigint
)
returns boolean
language sql
stable
set search_path = ''
as $body$
  select platform_private.cms_transform_registry_member(p_key, p_version) is not null
$body$;

revoke all on function platform_private.cms_transform_registry_digest(text, bigint, jsonb, jsonb, jsonb, text),
  platform_private.cms_transform_registry_member(text, bigint),
  platform_private.cms_transform_registry_member_valid(text, bigint)
  from public, anon, authenticated, service_role;

commit;
