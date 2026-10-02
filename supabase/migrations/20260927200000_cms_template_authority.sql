-- Slice 12 CMS-03C-01: private template candidate authority.
-- Forward-only. No browser role receives direct table or RPC write access.
begin;

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
      ('cms.template_designer', 1::bigint)
    ) as registry(key, version)
    where registry.key = p_key
      and (p_version is null or registry.version = p_version)
  )
$body$;

comment on function platform_private.cms_capability_registry_valid(text, bigint) is
  'Closed CMS capability registry; Slice 12 adds only cms.template_designer v1.';

-- This validator is intentionally independent of mutable registry state so it
-- can be used by a CHECK constraint. Current block/type authority is checked
-- separately inside cms_define_template under row locks.
create or replace function platform_private.cms_template_manifest_valid(
  p_definition jsonb
)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $body$
declare
  type_id jsonb;
  slot jsonb;
  block_ref jsonb;
  binding record;
  region jsonb;
  seen_types text[] := array[]::text[];
  seen_slots text[] := array[]::text[];
  seen_regions text[] := array[]::text[];
  seen_blocks text[];
  block_identity text;
begin
  if not platform_private.cms_exact_keys(
    p_definition,
    array['templateKey','compatibleTypeIds','slots','reservedRegions',
      'bindings','locale','audience']::text[],
    array['templateKey','compatibleTypeIds','slots','reservedRegions',
      'bindings','locale','audience']::text[]
  ) or not platform_private.cms_json_bounded(p_definition, 262144, 8, 128, 128)
     or coalesce(p_definition->>'templateKey','') !~ '^[a-z][a-z0-9-]{1,63}$'
     or coalesce(p_definition->>'locale','') !~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$'
     or pg_catalog.jsonb_typeof(p_definition->'audience') <> 'string'
     or pg_catalog.octet_length(p_definition->>'audience') not between 1 and 64
     or p_definition->>'audience' ~ '[<>{}]'
     or pg_catalog.jsonb_typeof(p_definition->'compatibleTypeIds') <> 'array'
     or pg_catalog.jsonb_array_length(p_definition->'compatibleTypeIds') not between 1 and 64
     or pg_catalog.jsonb_typeof(p_definition->'slots') <> 'array'
     or pg_catalog.jsonb_array_length(p_definition->'slots') > 64
     or pg_catalog.jsonb_typeof(p_definition->'reservedRegions') <> 'array'
     or pg_catalog.jsonb_array_length(p_definition->'reservedRegions') not between 5 and 32
     or pg_catalog.jsonb_typeof(p_definition->'bindings') <> 'object' then
    return false;
  end if;

  for type_id in select value from pg_catalog.jsonb_array_elements(p_definition->'compatibleTypeIds') as value loop
    if pg_catalog.jsonb_typeof(type_id) <> 'string'
       or (type_id #>> '{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or (type_id #>> '{}') = any(seen_types) then return false; end if;
    seen_types := pg_catalog.array_append(seen_types, type_id #>> '{}');
  end loop;

  -- The Shard 02 code-owned spine and provenance cannot be removed or moved.
  if p_definition->'reservedRegions'->>0 <> 'header'
     or p_definition->'reservedRegions'->>1 <> 'now'
     or p_definition->'reservedRegions'->>2 <> 'record'
     or p_definition->'reservedRegions'->>3 <> 'detail'
     or p_definition->'reservedRegions'->>4 <> 'provenance' then return false; end if;
  for region in select value from pg_catalog.jsonb_array_elements(p_definition->'reservedRegions') as value loop
    if pg_catalog.jsonb_typeof(region) <> 'string'
       or (region #>> '{}') !~ '^[a-z][a-z0-9_-]{1,63}$'
       or (region #>> '{}') = any(seen_regions) then return false; end if;
    seen_regions := pg_catalog.array_append(seen_regions, region #>> '{}');
  end loop;

  for slot in select value from pg_catalog.jsonb_array_elements(p_definition->'slots') as value loop
    if not platform_private.cms_exact_keys(
      slot, array['key','required','allowedBlocks','maxCount']::text[],
      array['key','required','allowedBlocks','maxCount']::text[]
    ) or coalesce(slot->>'key','') !~ '^[a-z][a-z0-9_-]{1,63}$'
       or slot->>'key' = any(seen_slots)
       or pg_catalog.jsonb_typeof(slot->'required') <> 'boolean'
       or pg_catalog.jsonb_typeof(slot->'allowedBlocks') <> 'array'
       or pg_catalog.jsonb_array_length(slot->'allowedBlocks') > 32
       or pg_catalog.jsonb_typeof(slot->'maxCount') <> 'number'
       or coalesce(slot->>'maxCount','') !~ '^[1-9][0-9]{0,2}$'
       or (slot->>'maxCount')::integer > 128 then return false; end if;
    seen_slots := pg_catalog.array_append(seen_slots, slot->>'key');
    seen_blocks := array[]::text[];
    for block_ref in select value from pg_catalog.jsonb_array_elements(slot->'allowedBlocks') as value loop
      if not platform_private.cms_exact_keys(
        block_ref, array['blockKey','blockVersion']::text[],
        array['blockKey','blockVersion']::text[]
      ) or coalesce(block_ref->>'blockKey','') !~ '^[a-z][a-z0-9._-]{0,95}$'
         or pg_catalog.jsonb_typeof(block_ref->'blockVersion') <> 'number'
         or coalesce(block_ref->>'blockVersion','') !~ '^[1-9][0-9]{0,9}$'
         or (block_ref->>'blockVersion')::bigint > 2147483647 then return false; end if;
      block_identity := block_ref->>'blockKey' || ':' || block_ref->>'blockVersion';
      if block_identity = any(seen_blocks) then return false; end if;
      seen_blocks := pg_catalog.array_append(seen_blocks, block_identity);
    end loop;
  end loop;

  if (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(p_definition->'bindings')) > 128 then
    return false;
  end if;
  for binding in select key, value from pg_catalog.jsonb_each(p_definition->'bindings') loop
    if pg_catalog.octet_length(binding.key) not between 1 and 128
       or binding.key ~ '[<>{}]'
       or not platform_private.cms_exact_keys(
         binding.value, array['projection','required']::text[],
         array['projection','required']::text[]
       ) or coalesce(binding.value->>'projection','') !~ '^[a-z][a-z0-9._-]{0,127}$'
       or pg_catalog.jsonb_typeof(binding.value->'required') <> 'boolean' then
      return false;
    end if;
  end loop;
  return true;
exception when others then
  return false;
end;
$body$;

create table platform_private.cms_template_versions (
  id uuid not null default extensions.gen_random_uuid() primary key,
  owner_id uuid not null references platform_private.party(id),
  state text not null default 'draft' check (state in (
    'draft','review','approved','scheduled','active','superseded','retired','blocked'
  )),
  version bigint not null check (version between 1 and 2147483647),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  template_key text not null check (template_key ~ '^[a-z][a-z0-9-]{1,63}$'),
  compatible_type_ids jsonb not null,
  slots jsonb not null,
  reserved_regions jsonb not null,
  bindings jsonb not null,
  locale text not null,
  audience text not null,
  content_hash char(64) not null check (content_hash ~ '^[a-f0-9]{64}$'),
  block_registry_digest char(64) not null check (block_registry_digest ~ '^[a-f0-9]{64}$'),
  supersedes_id uuid references platform_private.cms_template_versions(id),
  created_by uuid not null references auth.users(id),
  constraint cms_template_versions_definition_valid check (
    platform_private.cms_template_manifest_valid(pg_catalog.jsonb_build_object(
      'templateKey', template_key,
      'compatibleTypeIds', compatible_type_ids,
      'slots', slots,
      'reservedRegions', reserved_regions,
      'bindings', bindings,
      'locale', locale,
      'audience', audience
    ))
  ),
  constraint cms_template_versions_key_version_unique unique (template_key, version)
);

create index cms_template_versions_key_state_version_idx
  on platform_private.cms_template_versions(template_key, state, version desc);
create index cms_template_versions_owner_state_updated_idx
  on platform_private.cms_template_versions(owner_id, state, updated_at desc);

alter table platform_private.cms_template_versions enable row level security;
alter table platform_private.cms_template_versions force row level security;
revoke all on platform_private.cms_template_versions from public, anon, authenticated, service_role;

create or replace function platform_private.cms_template_versions_guard()
returns trigger
language plpgsql
set search_path = ''
as $body$
begin
  if pg_catalog.current_setting('app.cms_rpc', true) is distinct from 'true' then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' then
    if new.state <> 'draft' or new.updated_at <> new.created_at then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' or old.state in ('active','superseded','retired','blocked') then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if new.id <> old.id or new.owner_id <> old.owner_id
     or new.template_key <> old.template_key or new.version <> old.version
     or new.compatible_type_ids <> old.compatible_type_ids
     or new.slots <> old.slots or new.reserved_regions <> old.reserved_regions
     or new.bindings <> old.bindings or new.locale <> old.locale
     or new.audience <> old.audience or new.content_hash <> old.content_hash
     or new.block_registry_digest <> old.block_registry_digest
     or new.supersedes_id is distinct from old.supersedes_id
     or new.created_by <> old.created_by or new.created_at <> old.created_at
     or new.updated_at < old.updated_at then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  return new;
end;
$body$;

create trigger cms_template_versions_guard_trigger
before insert or update or delete on platform_private.cms_template_versions
for each row execute function platform_private.cms_template_versions_guard();

create or replace function platform_private.cms_template_designer_authorized(
  p_actor_id uuid, p_acting_party_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  resolved_person_id uuid;
begin
  if p_actor_id is null or p_acting_party_id is null
     or not platform_private.cms_capability_registry_valid('cms.template_designer', 1) then
    return false;
  end if;
  begin
    resolved_person_id := platform_private.identity_actor_person(p_actor_id);
  exception when others then
    return false;
  end;
  if resolved_person_id is null then return false; end if;
  return exists (
    select 1
      from identity_private.membership_tenure tenure
      join identity_private.organization_actor_grant actor_grant
        on actor_grant.organization_id = tenure.organization_id
       and actor_grant.person_id = tenure.person_id
     where tenure.organization_id = p_acting_party_id
       and tenure.person_id = resolved_person_id
       and tenure.state = 'confirmed'
       and (tenure.ends_on is null or tenure.ends_on >= current_date)
       and actor_grant.capability_code = 'cms.template_designer'
       and actor_grant.active
       and actor_grant.valid_from <= current_date
       and (actor_grant.valid_through is null or actor_grant.valid_through >= current_date)
  );
end;
$body$;

-- Locks each exact 03a row in key/version order. Signed lifecycle advance uses
-- FOR UPDATE on that row, so the digest and draft commit share one current
-- supported lifecycle snapshot. The renderer manifest is the active type's
-- explicit block compatibility evidence, not a caller-supplied assertion.
create or replace function platform_private.cms_template_block_digest(
  p_slots jsonb, p_type_ids jsonb, p_owner_id uuid
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  reference record;
  block_row platform_private.cms_block_definition_versions%rowtype;
  current_lifecycle text;
  type_id jsonb;
  compatible boolean;
  tuples jsonb := '[]'::jsonb;
begin
  for reference in
    select distinct
      block_ref.value->>'blockKey' as block_key,
      (block_ref.value->>'blockVersion')::integer as block_version
    from pg_catalog.jsonb_array_elements(p_slots) as slot(value)
    cross join lateral pg_catalog.jsonb_array_elements(
      slot.value->'allowedBlocks'
    ) as block_ref(value)
    order by block_key collate "C", block_version
  loop
    select * into block_row
      from platform_private.cms_block_definition_versions candidate
     where candidate.block_key = reference.block_key
       and candidate.block_version = reference.block_version
       and candidate.state = 'registered'
     for share;
    if not found then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    select lifecycle_event.to_lifecycle into current_lifecycle
      from platform_private.cms_block_definition_lifecycle_events lifecycle_event
     where lifecycle_event.block_definition_version_id = block_row.id
     order by lifecycle_event.created_at desc, lifecycle_event.id desc
     limit 1;
    if coalesce(current_lifecycle, 'supported') <> 'supported' then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    for type_id in select value from pg_catalog.jsonb_array_elements(p_type_ids) as value loop
      select exists (
        select 1
          from platform_private.cms_content_types content_type
          join platform_private.cms_content_type_versions version_row
            on version_row.content_type_id = content_type.id
          join platform_private.cms_schema_artifacts artifact
            on artifact.id = version_row.schema_artifact_id
           and artifact.content_type_version_id = version_row.id
         where content_type.id = (type_id #>> '{}')::uuid
           and content_type.owner_id = p_owner_id
           and content_type.state = 'active'
           and version_row.state = 'active'
           and exists (
             select 1 from (
               select value from pg_catalog.jsonb_array_elements(
                 coalesce(artifact.renderer_manifest->'blocks','[]'::jsonb)
               ) as value
               union all
               select value from pg_catalog.jsonb_array_elements(
                 coalesce(artifact.renderer_manifest->'blockDefinitions','[]'::jsonb)
               ) as value
             ) manifest_block
             where manifest_block.value->>'blockKey' = reference.block_key
               and manifest_block.value->>'blockVersion' = reference.block_version::text
           )
      ) into compatible;
      if not compatible then
        raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
      end if;
    end loop;
    tuples := tuples || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'blockKey', block_row.block_key,
      'blockVersion', block_row.block_version,
      'releaseDigest', pg_catalog.btrim(block_row.release_digest::text),
      'propsSchemaHash', pg_catalog.btrim(block_row.props_schema_hash::text),
      'rendererRef', block_row.renderer_ref,
      'lifecycle', current_lifecycle
    ));
  end loop;
  return platform_private.cms_jcs_sha256(tuples);
end;
$body$;

create or replace function platform_private.cms_define_template(p_request jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  actor_id uuid;
  acting_party_id uuid;
  correlation_id uuid;
  reservation platform_private.idempotency_records;
  definition jsonb;
  type_id jsonb;
  previous_row platform_private.cms_template_versions%rowtype;
  has_previous boolean;
  next_version bigint;
  template_id uuid;
  block_digest text;
  content_hash text;
  snapshot_time timestamptz;
  response jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  if not platform_private.cms_template_designer_authorized(actor_id, acting_party_id) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  correlation_id := platform_private.cms_correlation(p_request);
  reservation := platform_private.cms_reserve(p_request, actor_id, 'CMS-03C-01');
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  if not platform_private.cms_exact_keys(
    p_request,
    array['templateKey','compatibleTypeIds','slots','reservedRegions',
      'bindings','locale','audience','expectedVersion','idempotencyKey','context']::text[],
    array['templateKey','compatibleTypeIds','slots','reservedRegions',
      'bindings','locale','audience','expectedVersion','blockRegistryDigest',
      'ifMatch','idempotencyKey','context','correlationId']::text[]
  ) then raise exception 'INVALID_REQUEST' using errcode = 'P0001'; end if;
  definition := p_request - 'expectedVersion' - 'blockRegistryDigest'
    - 'ifMatch' - 'idempotencyKey' - 'context' - 'correlationId';
  if not platform_private.cms_template_manifest_valid(definition) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if p_request->'expectedVersion' = 'null'::jsonb then
    if p_request ? 'ifMatch' then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
  elsif not platform_private.cms_valid_version(p_request->>'expectedVersion')
     or not platform_private.cms_valid_version(p_request->>'ifMatch')
     or p_request->>'expectedVersion' <> p_request->>'ifMatch' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if p_request ? 'blockRegistryDigest'
     and coalesce(p_request->>'blockRegistryDigest','') !~ '^[a-f0-9]{64}$' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;

  for type_id in select value from pg_catalog.jsonb_array_elements(definition->'compatibleTypeIds') as value loop
    perform 1
      from platform_private.cms_content_types content_type
     where content_type.id = (type_id #>> '{}')::uuid
       and content_type.owner_id = acting_party_id
       and content_type.state = 'active'
       and exists (
         select 1 from platform_private.cms_content_type_versions version_row
          where version_row.content_type_id = content_type.id
            and version_row.state = 'active'
       );
    if not found then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
  end loop;
  block_digest := platform_private.cms_template_block_digest(
    definition->'slots', definition->'compatibleTypeIds', acting_party_id
  );
  if p_request ? 'blockRegistryDigest'
     and p_request->>'blockRegistryDigest' <> block_digest then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;

  select * into previous_row
    from platform_private.cms_template_versions candidate
   where candidate.template_key = definition->>'templateKey'
   order by candidate.version desc limit 1 for update;
  has_previous := found;
  if p_request->'expectedVersion' = 'null'::jsonb then
    if has_previous then raise exception 'CONFLICT' using errcode = 'P0001'; end if;
    next_version := 1;
  else
    if not has_previous or previous_row.owner_id <> acting_party_id then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;
    if previous_row.version::text <> p_request->>'expectedVersion' then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    next_version := previous_row.version + 1;
  end if;
  if next_version > 2147483647 then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  template_id := extensions.gen_random_uuid();
  snapshot_time := pg_catalog.clock_timestamp();
  content_hash := platform_private.cms_jcs_sha256(
    definition || pg_catalog.jsonb_build_object('blockRegistryDigest', block_digest)
  );
  insert into platform_private.cms_template_versions (
    id, owner_id, state, version, created_at, updated_at, template_key,
    compatible_type_ids, slots, reserved_regions, bindings, locale, audience,
    content_hash, block_registry_digest, supersedes_id, created_by
  ) values (
    template_id, acting_party_id, 'draft', next_version, snapshot_time,
    snapshot_time, definition->>'templateKey', definition->'compatibleTypeIds',
    definition->'slots', definition->'reservedRegions', definition->'bindings',
    definition->>'locale', definition->>'audience', content_hash::char(64),
    block_digest::char(64), case when has_previous then previous_row.id else null end,
    actor_id
  );
  perform platform_private.cms_record_audit(
    'cms.template.define', actor_id, acting_party_id,
    'cms_template_version', template_id, 'CMS_TEMPLATE_DRAFT_DEFINED',
    correlation_id
  );
  response := pg_catalog.jsonb_build_object(
    'id', template_id,
    'version', next_version::text,
    'contentHash', content_hash,
    'createdAt', platform_private.auth_iso_time(snapshot_time),
    'updatedAt', platform_private.auth_iso_time(snapshot_time),
    'state', 'draft',
    'templateKey', definition->>'templateKey',
    'templateVersion', next_version,
    'compatibleTypeIds', definition->'compatibleTypeIds',
    'reservedRegions', definition->'reservedRegions',
    'blockRegistryDigest', block_digest
  );
  perform platform_private.cms_complete(reservation.id, template_id, 201, response);
  return response;
end;
$body$;

create or replace function platform_api.cms_define_template(p_request jsonb)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $body$
  select platform_private.cms_define_template(p_request)
$body$;

revoke all on function platform_api.cms_define_template(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_define_template(jsonb) to service_role;
revoke all on function platform_private.cms_define_template(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_template_designer_authorized(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_template_block_digest(jsonb, jsonb, uuid)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_template_manifest_valid(jsonb)
  from public, anon, authenticated, service_role;

commit;
