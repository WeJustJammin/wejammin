-- Forward-only: the service-role session projection carries the validated
-- private acting-context binding ID as `actingContextId`. The field is an
-- explicit JSON null when the request has no client binding selector or the
-- selector is globally unseen; it is populated only after the binding row is
-- resolved for the session's own person and re-validated through
-- platform_private.identity_context_candidate. Public projection fields, the
-- fail-closed selector errors, and the service-role-only boundary are
-- unchanged.

create or replace function platform_api.auth_session_read(
  p_auth_user_id uuid,
  p_session_id uuid
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $fn$
#variable_conflict use_variable
declare
  session_row identity.auth_session_index%rowtype;
  auth_binding identity.auth_user_bindings%rowtype;
  context_binding platform_private.acting_context_binding%rowtype;
  candidate record;
  headers jsonb := '{}'::jsonb;
  header_text text;
  client_binding_id text;
  now_at timestamptz := pg_catalog.clock_timestamp();
  acting_party_id uuid;
begin
  select * into session_row
    from identity.auth_session_index session_index
   where session_index.session_id = p_session_id
     and session_index.auth_user_id = p_auth_user_id
     and session_index.state = 'active'
   for update;
  if not found then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;
  select * into auth_binding
    from identity.auth_user_bindings user_binding
   where user_binding.id = session_row.binding_id;
  acting_party_id := auth_binding.person_id;

  begin
    header_text := nullif(pg_catalog.current_setting('request.headers', true), '');
    if header_text is not null then
      headers := header_text::jsonb;
    end if;
  exception when others then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end;
  if pg_catalog.jsonb_typeof(headers) <> 'object' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;

  if headers ? 'x-client-binding-id' then
    if pg_catalog.jsonb_typeof(headers->'x-client-binding-id') <> 'string' then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    client_binding_id := headers->>'x-client-binding-id';
    if client_binding_id is null
       or pg_catalog.char_length(client_binding_id) not between 1 and 128
       or client_binding_id !~ '^[A-Za-z0-9._:-]+$' then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;

    if acting_party_id is null then
      raise exception 'CONTEXT_NOT_FOUND' using errcode = 'P0001';
    end if;
    select * into context_binding
      from platform_private.acting_context_binding binding_row
     where binding_row.person_id = acting_party_id
       and binding_row.client_binding_id = client_binding_id
     order by (binding_row.state = 'active') desc,
              binding_row.created_at desc, binding_row.id desc
     limit 1
     for update;
    if found then
      if context_binding.state = 'revoked' then
        raise exception 'CONTEXT_REVOKED' using errcode = 'P0001';
      elsif context_binding.state = 'expired' then
        raise exception 'CONTEXT_RECONFIRM_REQUIRED' using errcode = 'P0001';
      elsif context_binding.state <> 'active' then
        raise exception 'CONTEXT_NOT_FOUND' using errcode = 'P0001';
      end if;

      if context_binding.client_binding_id <> 'self'
         and (context_binding.expires_at <= now_at
           or context_binding.last_seen_at <= now_at - interval '12 hours') then
        raise exception 'CONTEXT_RECONFIRM_REQUIRED' using errcode = 'P0001';
      end if;
      select * into candidate
        from platform_private.identity_context_candidate(
          acting_party_id, context_binding.acting_party_id, true
        );
      if not found
         or candidate.context_kind <> context_binding.context_kind then
        raise exception 'CONTEXT_REVOKED' using errcode = 'P0001';
      end if;
      update platform_private.acting_context_binding binding_row
         set last_seen_at = now_at, updated_at = now_at
       where binding_row.id = context_binding.id
         and binding_row.state = 'active';
      acting_party_id := candidate.acting_party_id;
    elsif exists (
      select 1 from platform_private.acting_context_binding binding_row
       where binding_row.client_binding_id = client_binding_id
         and binding_row.person_id <> acting_party_id
    ) then
      raise exception 'CONTEXT_NOT_FOUND' using errcode = 'P0001';
    end if;
    -- A globally unseen sessionStorage UUID is an unbound tab, not an
    -- authority selector. Keep the safe self context until deliberate POST.
  end if;

  update identity.auth_session_index session_index
     set last_seen_at = now_at
   where session_index.session_id = p_session_id;

  return pg_catalog.jsonb_build_object(
    'accountState', case when auth_binding.id is null then null else auth_binding.state::text end,
    'bootstrapState', case when auth_binding.id is null then 'required' else 'complete' end,
    'personId', auth_binding.person_id,
    'actingPartyId', acting_party_id,
    'actingContextId', context_binding.id::text
  );
end;
$fn$;

revoke all on function platform_api.auth_session_read(uuid, uuid)
from public, anon, authenticated;
grant execute on function platform_api.auth_session_read(uuid, uuid)
to service_role;
