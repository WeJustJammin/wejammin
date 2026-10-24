-- Slice 12 lane linked-scan (BE03c "Job transport (DEC-166, DEC-180 G9)", "Event schemas" cms.pattern.activated.v1; tracker P2-S12-AC-212):
-- the identity a committed pattern-activation event names, as the payload of the linked-update scan.
--
--   platform_api.cms_linked_scan_resolve_event(event_id)   service role only.
--       { found: true, patternId, patternVersionId } or { found: false }.  The queue envelope is identifier-only, so the producer rereads
--       the outbox row's published payload { patternId (the lineage), patternVersionId (the version row) } and answers it when the row
--       is a version-1 cms.pattern.activated.v1 whose pair names a real version of that lineage.  Any other event type, an absent row,
--       an unpublished identity or a pair that names no stored version is { found: false }: the producer then leaves the envelope to
--       the editorial consumer, which owns its dead letter.  The same event type also announces a retirement; the scan of a retired
--       version is a no-op, so no distinction is made here.
-- Private SECURITY DEFINER of the CMS definer role with an empty search_path and a platform_api wrapper granted to service_role only.
begin;
set local lock_timeout = '5s';

create or replace function platform_private.cms_linked_scan_event_ref(p_event_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  event_row platform_private.outbox_events%rowtype;
begin
  if p_event_id is null then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  -- the pattern version table is readable by the definer only inside the RPC context (PAT-031): the caller holds none
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  select outbox.* into event_row from platform_private.outbox_events outbox where outbox.id = p_event_id;
  if not found or event_row.schema_version <> 1 or event_row.event_type <> 'cms.pattern.activated.v1' then
    return pg_catalog.jsonb_build_object('found', false);
  end if;
  if pg_catalog.jsonb_typeof(event_row.payload->'patternId') is distinct from 'string'
     or platform_private.cms_valid_uuid(event_row.payload->>'patternId') is not true
     or pg_catalog.jsonb_typeof(event_row.payload->'patternVersionId') is distinct from 'string'
     or platform_private.cms_valid_uuid(event_row.payload->>'patternVersionId') is not true
     or not exists (
       select 1 from platform_private.cms_pattern_versions version_row
        where version_row.id = (event_row.payload->>'patternVersionId')::uuid
          and version_row.pattern_id = (event_row.payload->>'patternId')::uuid) then
    return pg_catalog.jsonb_build_object('found', false);
  end if;
  return pg_catalog.jsonb_build_object(
    'found', true, 'patternId', event_row.payload->>'patternId', 'patternVersionId', event_row.payload->>'patternVersionId');
end;
$body$;

comment on function platform_private.cms_linked_scan_event_ref(uuid) is
  'BE03c linked-update scan: the job payload { patternId, patternVersionId } a committed cms.pattern.activated.v1 event names; { found: false } for any other event, an absent row, an unpublished identity or a pair that names no stored version. Private.';

create or replace function platform_api.cms_linked_scan_resolve_event(p_event_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  rpc_result jsonb;
begin
  rpc_result := platform_private.cms_linked_scan_event_ref(p_event_id);
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

comment on function platform_api.cms_linked_scan_resolve_event(uuid) is
  'Service-role wrapper of the linked-update scan event resolver. Restores the RPC context.';

grant select on table platform_private.outbox_events, platform_private.cms_pattern_versions to wejammin_cms_definer;
grant create on schema platform_private, platform_api to wejammin_cms_definer;
alter function platform_private.cms_linked_scan_event_ref(uuid) owner to wejammin_cms_definer;
alter function platform_api.cms_linked_scan_resolve_event(uuid) owner to wejammin_cms_definer;
revoke create on schema platform_private, platform_api from wejammin_cms_definer;

revoke all on function
  platform_private.cms_linked_scan_event_ref(uuid),
  platform_api.cms_linked_scan_resolve_event(uuid)
  from public, anon, authenticated, service_role;
grant usage on schema platform_api to service_role;
grant execute on function platform_api.cms_linked_scan_resolve_event(uuid) to service_role;

do $closure$
begin
  if not pg_catalog.has_function_privilege('wejammin_cms_definer',
       pg_catalog.to_regprocedure('platform_private.cms_linked_scan_event_ref(uuid)'), 'EXECUTE') then
    execute 'grant execute on function platform_private.cms_linked_scan_event_ref(uuid) to wejammin_cms_definer';
  end if;
  if not pg_catalog.has_function_privilege('wejammin_cms_definer',
       pg_catalog.to_regprocedure('platform_private.cms_valid_uuid(text)'), 'EXECUTE') then
    execute 'grant execute on function platform_private.cms_valid_uuid(text) to wejammin_cms_definer';
  end if;
end;
$closure$;

commit;
