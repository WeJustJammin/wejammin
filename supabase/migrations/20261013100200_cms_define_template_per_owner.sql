-- Slice 12 FIX (BE03c E13, E14, E4 and the lineage id; P2-S12-AC-005, AC-006, AC-022, AC-025,
-- AC-189 to AC-192): the CMS-03C-01 command body.
--
-- Replaces platform_private.cms_define_template.  Against the body of 20260927200000 it
--   * looks the previous version up WITHIN THE CALLER'S OWNER SCOPE (E14): an owner defining a key
--     another owner holds neither conflicts nor learns anything (the global lookup answered CONFLICT
--     to the second owner), and a successor of a key the caller does not hold is NOT_FOUND exactly as
--     for an unused key;
--   * refuses the reserved keys context, versions and new with the typed token key_reserved at
--     /templateKey (E13) and an audience outside ^[a-z0-9_-]{1,48}$ with VALIDATION_FAILED at
--     /audience (E4), before any lookup, so neither refusal depends on stored data;
--   * writes the lineage id (the id of the version-1 row of (owner, key)) and answers it as
--     templateId; the variable that held the new row id is renamed new_row_id because template_id is
--     now a column of the table the body reads;
--   * completes a stored idempotent response that predates templateId from the stored row, so a
--     replay across this deploy still answers a valid resource.
-- Language, volatility, SECURITY DEFINER, search_path, owner and ACL are checked unchanged.
-- platform_api.cms_define_template (the advisory key lock and RPC flag restore) is untouched.
-- Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $before$
declare
  target regprocedure := pg_catalog.to_regprocedure('platform_private.cms_define_template(jsonb)');
begin
  if target is null then
    raise exception 'platform_private.cms_define_template(jsonb) is missing' using errcode = '55000';
  end if;
  perform pg_catalog.set_config('wejammin.fix_define_attrs', (
    select (pg_catalog.to_jsonb(proc) - 'prosrc')::text
      from pg_catalog.pg_proc proc where proc.oid = target), true);
end;
$before$;

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
  new_row_id uuid;
  lineage_id uuid;
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
      response := reservation.response_ref->'safeHeaders'->'response';
      -- A response stored before the lineage id existed is completed from the stored row.
      if not (response ? 'templateId') then
        response := response || pg_catalog.jsonb_build_object('templateId', (
          select stored.template_id
            from platform_private.cms_template_versions stored
           where stored.id = (response->>'id')::uuid));
      end if;
      return response;
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
  -- E13: the keys of the fixed route segments are reserved (typed 422 at /templateKey).
  if definition->>'templateKey' in ('context', 'versions', 'new') then
    raise exception 'key_reserved' using errcode = 'P0001', detail = '["/templateKey"]';
  end if;
  -- E4: the audience matches ^[a-z0-9_-]{1,48}$ as submitted (422 at /audience).
  if pg_catalog.jsonb_typeof(definition->'audience') = 'string'
     and definition->>'audience' !~ '^[a-z0-9_-]{1,48}$' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/audience"]';
  end if;
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
   where candidate.owner_id = acting_party_id
     and candidate.template_key = definition->>'templateKey'
   order by candidate.version desc limit 1 for update;
  has_previous := found;
  if p_request->'expectedVersion' = 'null'::jsonb then
    if has_previous then raise exception 'CONFLICT' using errcode = 'P0001'; end if;
    next_version := 1;
  else
    if not has_previous then
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
  new_row_id := extensions.gen_random_uuid();
  lineage_id := case when has_previous then previous_row.template_id else new_row_id end;
  snapshot_time := pg_catalog.clock_timestamp();
  content_hash := platform_private.cms_jcs_sha256(
    definition || pg_catalog.jsonb_build_object('blockRegistryDigest', block_digest)
  );
  insert into platform_private.cms_template_versions (
    id, owner_id, state, version, created_at, updated_at, template_key,
    compatible_type_ids, slots, reserved_regions, bindings, locale, audience,
    content_hash, block_registry_digest, supersedes_id, created_by, template_id
  ) values (
    new_row_id, acting_party_id, 'draft', next_version, snapshot_time,
    snapshot_time, definition->>'templateKey', definition->'compatibleTypeIds',
    definition->'slots', definition->'reservedRegions', definition->'bindings',
    definition->>'locale', definition->>'audience', content_hash::char(64),
    block_digest::char(64), case when has_previous then previous_row.id else null end,
    actor_id, lineage_id
  );
  perform platform_private.cms_record_audit(
    'cms.template.define', actor_id, acting_party_id,
    'cms_template_version', new_row_id, 'CMS_TEMPLATE_DRAFT_DEFINED',
    correlation_id
  );
  response := pg_catalog.jsonb_build_object(
    'id', new_row_id,
    'version', next_version::text,
    'contentHash', content_hash,
    'createdAt', platform_private.auth_iso_time(snapshot_time),
    'updatedAt', platform_private.auth_iso_time(snapshot_time),
    'state', 'draft',
    'templateId', lineage_id,
    'templateKey', definition->>'templateKey',
    'templateVersion', next_version,
    'compatibleTypeIds', definition->'compatibleTypeIds',
    'reservedRegions', definition->'reservedRegions',
    'blockRegistryDigest', block_digest
  );
  perform platform_private.cms_complete(reservation.id, new_row_id, 201, response);
  return response;
end;
$body$;

do $after$
declare
  target regprocedure := pg_catalog.to_regprocedure('platform_private.cms_define_template(jsonb)');
begin
  if (select (pg_catalog.to_jsonb(proc) - 'prosrc')::text
        from pg_catalog.pg_proc proc where proc.oid = target)
     is distinct from pg_catalog.current_setting('wejammin.fix_define_attrs', true) then
    raise exception 'platform_private.cms_define_template(jsonb): owner, ACL, security, volatility or config changed'
      using errcode = '55000';
  end if;
end;
$after$;

commit;
