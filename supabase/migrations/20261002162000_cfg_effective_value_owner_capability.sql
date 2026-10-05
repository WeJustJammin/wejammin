-- Platform configuration CFG-05A-02: the effective-value read returns the owner
-- capability of the resolved definition version so consumers can authorize
-- against the capability that owns the setting.  Forward-only; the function
-- body is unchanged apart from the added key.
begin;

create or replace function platform_private.cfg_resolve_effective_value(
  p_request jsonb
)
returns jsonb
language plpgsql security definer set search_path = ''
as $body$
declare
  actor record;
  is_service_consumer boolean := false;
  definition platform_private.cfg_setting_definition_versions%rowtype;
  selected_definition_id uuid;
  at_time timestamptz;
  supported bigint[];
  supported_text text;
  candidate_values jsonb[];
  candidate_ids uuid[];
  candidate_scopes text[];
  candidate_subjects uuid[];
  candidate_from timestamptz[];
  candidate_to timestamptz[];
  selected_value jsonb;
  selected_scope text;
  selected_subject uuid;
  selected_value_id uuid;
  selected_from timestamptz;
  selected_to timestamptz;
  merged jsonb;
  item jsonb;
  source_default boolean := false;
  compatibility text := 'exact';
  party_id uuid;
  site_id uuid;
  user_id uuid;
  evaluator_version bigint;
  response jsonb;
  correlation_id uuid;
begin
  perform platform_private.cfg_require_keys(
    p_request,
    array['key','environment','partyId','siteId','route','feature','userId',
      'consumerKey','supportedDefinitionVersions','at','context']::text[],
    array['key','consumerKey','supportedDefinitionVersions']::text[]
  );
  if not platform_private.cfg_valid_key(p_request->>'key')
     or not platform_private.cfg_valid_key(p_request->>'consumerKey')
     or pg_catalog.jsonb_typeof(p_request->'supportedDefinitionVersions') <> 'array'
     or pg_catalog.jsonb_array_length(p_request->'supportedDefinitionVersions') not between 1 and 8 then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  for supported_text in select value from jsonb_array_elements_text(p_request->'supportedDefinitionVersions') value loop
    supported := array_append(supported, platform_private.cfg_parse_version(supported_text));
  end loop;
  if p_request ? 'environment' and pg_catalog.length(p_request->>'environment') not between 1 and 64 then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if p_request ? 'partyId' then party_id := platform_private.cfg_parse_uuid(p_request->>'partyId'); end if;
  if p_request ? 'siteId' then site_id := platform_private.cfg_parse_uuid(p_request->>'siteId'); end if;
  if p_request ? 'userId' then user_id := platform_private.cfg_parse_uuid(p_request->>'userId'); end if;
  if p_request ? 'route' and p_request->>'route' !~ '^/[A-Za-z0-9/_-]{0,255}$' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if p_request ? 'feature' and not platform_private.cfg_valid_key(p_request->>'feature') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  begin
    at_time := case when p_request ? 'at' then (p_request->>'at')::timestamptz else pg_catalog.clock_timestamp() end;
  exception when others then raise exception 'INVALID_REQUEST' using errcode = 'P0001'; end;

  is_service_consumer := platform_private.cfg_context_value(p_request, 'serviceConsumerKey') is not null;
  if is_service_consumer then
    if platform_private.cfg_context_value(p_request, 'serviceConsumerKey') <> p_request->>'consumerKey'
       or not platform_private.cfg_valid_key(
         platform_private.cfg_context_value(p_request, 'servicePrincipalId')
       ) then
      raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
    end if;
  else
    select * into actor from platform_private.cfg_request_actor(p_request, true);
    if party_id is not null and party_id is distinct from actor.acting_party_id then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
    if user_id is not null
       and user_id is distinct from actor.actor_id
       and user_id is distinct from platform_private.identity_actor_person(actor.actor_id) then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
    if site_id is not null then
      -- Site authority needs an explicit registered consumer/grant.  A human
      -- may not select an arbitrary site identifier through this resolver.
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
  end if;

  -- Select an explicitly compatible definition first.  A known key with no
  -- readable consumer is deliberately indistinguishable from a missing key.
  select definition_version.* into definition
    from platform_private.cfg_setting_definition_versions definition_version
   where definition_version.key = p_request->>'key'
     and definition_version.lifecycle = 'active'
     and p_request->>'consumerKey' = any(definition_version.consumer_keys)
   order by case when definition_version.version_no = any(supported) then 0 else 1 end,
            definition_version.version_no desc
   limit 1;
  if not found then raise exception 'DEFINITION_NOT_FOUND' using errcode = 'P0001'; end if;
  if not is_service_consumer then
    perform platform_private.cfg_require_capability(
      actor.actor_id,
      actor.acting_party_id,
      definition.owner_capability
    );
    if definition.sensitivity = 'restricted' then
      raise exception 'DEFINITION_NOT_FOUND' using errcode = 'P0001';
    end if;
  end if;
  evaluator_version := definition.version_no;
  if not evaluator_version = any(supported) then
    compatibility := 'contract_fallback';
  elsif evaluator_version <> (select max(value) from unnest(supported) value where value <= evaluator_version) then
    compatibility := 'last_compatible';
  end if;
  selected_definition_id := definition.definition_id;
  correlation_id := platform_private.cfg_correlation(p_request);

  select array_agg(value_version.typed_value order by array_position(definition.precedence, value_version.scope_type), value_version.effective_from desc, value_version.id desc),
         array_agg(value_version.id order by array_position(definition.precedence, value_version.scope_type), value_version.effective_from desc, value_version.id desc),
         array_agg(value_version.scope_type order by array_position(definition.precedence, value_version.scope_type), value_version.effective_from desc, value_version.id desc),
         array_agg(value_version.scope_id order by array_position(definition.precedence, value_version.scope_type), value_version.effective_from desc, value_version.id desc),
         array_agg(value_version.effective_from order by array_position(definition.precedence, value_version.scope_type), value_version.effective_from desc, value_version.id desc),
         array_agg(value_version.effective_to order by array_position(definition.precedence, value_version.scope_type), value_version.effective_from desc, value_version.id desc)
    into candidate_values, candidate_ids, candidate_scopes, candidate_subjects, candidate_from, candidate_to
    from platform_private.cfg_setting_value_versions value_version
   where value_version.definition_id = selected_definition_id
     and value_version.definition_version_id = definition.id
     and value_version.state = 'active'
     and value_version.effective_from <= at_time
     and (value_version.effective_to is null or value_version.effective_to > at_time)
     and value_version.scope_type = any(definition.allowed_scopes)
     and (
       (value_version.scope_type = 'platform' and value_version.scope_id is null and value_version.environment is null)
       or (value_version.scope_type = 'environment' and p_request ? 'environment'
           and value_version.scope_id is null and value_version.environment = p_request->>'environment')
       or (value_version.scope_type = 'party' and party_id is not null
           and value_version.scope_id = party_id
           and (value_version.environment is null or value_version.environment = p_request->>'environment'))
       or (value_version.scope_type = 'site' and site_id is not null
           and value_version.scope_id = site_id
           and (value_version.environment is null or value_version.environment = p_request->>'environment'))
       or (value_version.scope_type = 'user' and user_id is not null
           and value_version.scope_id = user_id
           and (value_version.environment is null or value_version.environment = p_request->>'environment'))
       or (value_version.scope_type = 'route' and p_request ? 'route'
           and value_version.scope_id is null
           and (value_version.environment is null or value_version.environment = p_request->>'environment'))
       or (value_version.scope_type = 'feature' and p_request ? 'feature'
           and value_version.scope_id is null
           and (value_version.environment is null or value_version.environment = p_request->>'environment'))
     );

  if candidate_values is null or cardinality(candidate_values) = 0 then
    source_default := true;
    selected_value := definition.default_value;
    selected_scope := 'platform';
    selected_subject := null;
    selected_value_id := null;
    selected_from := null;
    selected_to := null;
    if definition.default_source = 'required' then
      raise exception 'VALUE_UNAVAILABLE' using errcode = 'P0001';
    elsif definition.default_source = 'contract' then
      selected_value := 'null'::jsonb;
      compatibility := 'contract_fallback';
    end if;
  elsif definition.merge_mode = 'replace' then
    selected_value := candidate_values[1];
    selected_scope := candidate_scopes[1];
    selected_subject := candidate_subjects[1];
    selected_value_id := candidate_ids[1];
    selected_from := candidate_from[1];
    selected_to := candidate_to[1];
  elsif definition.merge_mode = 'append_unique' then
    merged := '[]'::jsonb;
    for index_no in 1..cardinality(candidate_values) loop
      if pg_catalog.jsonb_typeof(candidate_values[index_no]) <> 'array' then
        raise exception 'VALUE_UNAVAILABLE' using errcode = 'P0001';
      end if;
      for item in select value from jsonb_array_elements(candidate_values[index_no]) value loop
        if not exists (
          select 1 from jsonb_array_elements(merged) existing where existing = item
        ) then
          merged := merged || jsonb_build_array(item);
        end if;
      end loop;
    end loop;
    selected_value := merged;
    selected_scope := candidate_scopes[1];
    selected_subject := candidate_subjects[1];
    selected_value_id := candidate_ids[1];
    selected_from := candidate_from[1];
    selected_to := candidate_to[1];
  else
    merged := '{}'::jsonb;
    for index_no in reverse 1..cardinality(candidate_values) loop
      if pg_catalog.jsonb_typeof(candidate_values[index_no]) <> 'object' then
        raise exception 'VALUE_UNAVAILABLE' using errcode = 'P0001';
      end if;
      merged := merged || candidate_values[index_no];
    end loop;
    selected_value := merged;
    selected_scope := candidate_scopes[1];
    selected_subject := candidate_subjects[1];
    selected_value_id := candidate_ids[1];
    selected_from := candidate_from[1];
    selected_to := candidate_to[1];
  end if;
  if not platform_private.cfg_json_bounded(selected_value, 8, 65536) then
    raise exception 'VALUE_UNAVAILABLE' using errcode = 'P0001';
  end if;
  response := pg_catalog.jsonb_build_object(
    'definitionId', definition.definition_id,
    'definitionVersionId', definition.id,
    'key', definition.key,
    'valueKind', definition.value_kind,
    'typedValue', selected_value,
    'sourceScope', selected_scope,
    'sourceSubjectId', selected_subject,
    'sourceValueVersionId', selected_value_id,
    'isDefault', source_default,
    'effectiveFrom', selected_from,
    'effectiveTo', selected_to,
    'evaluatedAt', at_time,
    'evaluatorVersion', evaluator_version::text,
    'correlationId', correlation_id,
    'compatibility', compatibility,
    'ownerCapability', definition.owner_capability
  );
  return response;
end;
$body$;

commit;
