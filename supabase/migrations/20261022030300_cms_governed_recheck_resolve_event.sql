-- Slice 12 lane governed-recheck (BE03c "Job transport (DEC-166, DEC-180 G9)", "Event schemas"; tracker P2-S12-AC-202): the identity a
-- committed source event names, as a GOVERNED dependency lookup.
--
--   cms_governed_recheck_resolve_event(event_id)   platform_api, service role only.
--       { found: true, kind, refId } or { found: false }.  The queue envelope is identifier-only, so the producer rereads the outbox
--       row's published payload through the Slice 11 resolver (cms_dependency_recheck_event_ref) and maps its identity to the
--       governed kind (cms_governed_review_dependencies.kind):
--         cms.block.lifecycle.changed.v1  block         payload.blockDefinitionVersionId
--         cms.schema.activated.v1         content_type  payload.schemaVersionId
--         cms.pattern.activated.v1        pattern       payload.patternVersionId
--       Any other event type (template, taxonomy, localization, capability ...), an absent row or an unpublished identity is
--       { found: false }; the producer then leaves the envelope to the editorial consumer, which owns its dead letter.
-- Private SECURITY DEFINER of the CMS definer role with an empty search_path and a platform_api wrapper granted to service_role only.
begin;
set local lock_timeout = '5s';

create or replace function platform_private.cms_governed_recheck_event_ref(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  resolved jsonb;
  mapped_kind text;
begin
  resolved := platform_private.cms_dependency_recheck_event_ref(p_event_id);
  mapped_kind := case resolved->>'kind'
    when 'block' then 'block'
    when 'schema' then 'content_type'
    when 'pattern' then 'pattern'
  end;
  if (resolved->>'found') is distinct from 'true' or mapped_kind is null then
    return pg_catalog.jsonb_build_object('found', false);
  end if;
  return pg_catalog.jsonb_build_object('found', true, 'kind', mapped_kind, 'refId', resolved->>'refId');
end;
$body$;

comment on function platform_private.cms_governed_recheck_event_ref(uuid) is
  'BE03c governed recheck: the governed dependency lookup (kind block|content_type|pattern, refId) a committed block-lifecycle, schema-activated or pattern-activated event names; { found: false } for any other event, an absent row or an unpublished identity. Private.';

create or replace function platform_api.cms_governed_recheck_resolve_event(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  rpc_result jsonb;
begin
  rpc_result := platform_private.cms_governed_recheck_event_ref(p_event_id);
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

comment on function platform_api.cms_governed_recheck_resolve_event(uuid) is
  'Service-role wrapper of the governed recheck event resolver. Restores the RPC context.';

grant create on schema platform_private, platform_api to wejammin_cms_definer;
alter function platform_private.cms_governed_recheck_event_ref(uuid) owner to wejammin_cms_definer;
alter function platform_api.cms_governed_recheck_resolve_event(uuid) owner to wejammin_cms_definer;
revoke create on schema platform_private, platform_api from wejammin_cms_definer;

revoke all on function
  platform_private.cms_governed_recheck_event_ref(uuid),
  platform_api.cms_governed_recheck_resolve_event(uuid)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_governed_recheck_resolve_event(uuid) to service_role;

commit;
