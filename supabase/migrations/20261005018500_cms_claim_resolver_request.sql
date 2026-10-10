-- Private request grammar for claimed CMS dry-run resolution. No row authority.
begin;

create function platform_private.cms_schema_dry_run_claim_request(p_request jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $body$
declare
  root_keys constant text[] := array['claimedJob', 'requestedEvent'];
  claim_keys constant text[] := array['jobId', 'version', 'leaseToken'];
  event_keys constant text[] := array[
    'eventId', 'eventType', 'schemaVersion', 'aggregateType', 'aggregateId',
    'aggregateVersion', 'correlationId', 'causationId'
  ];
  -- Match installed Zod 4 UUID syntax, including its lowercase max exception.
  claim_uuid_pattern constant text :=
    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$';
  event_uuid_pattern constant text :=
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  claim jsonb;
  event jsonb;
  key_name text;
  version_text text;
begin
  if not platform_private.cms_exact_keys(p_request, root_keys, root_keys) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  claim := p_request->'claimedJob';
  event := p_request->'requestedEvent';
  if not platform_private.cms_exact_keys(claim, claim_keys, claim_keys)
     or not platform_private.cms_exact_keys(event, event_keys, event_keys) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;

  -- Prove JSON scalar types before text extraction can normalize them.
  foreach key_name in array claim_keys loop
    if pg_catalog.jsonb_typeof(claim->key_name) is distinct from 'string' then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
  end loop;
  foreach key_name in array array[
    'eventId', 'eventType', 'aggregateType', 'aggregateId',
    'aggregateVersion', 'correlationId'
  ]::text[] loop
    if pg_catalog.jsonb_typeof(event->key_name) is distinct from 'string' then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
  end loop;
  if pg_catalog.jsonb_typeof(event->'schemaVersion') is distinct from 'number'
     or pg_catalog.jsonb_typeof(event->'causationId') not in ('null', 'string') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;

  foreach key_name in array array['jobId', 'leaseToken']::text[] loop
    if (claim->>key_name) !~ claim_uuid_pattern then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
  end loop;
  foreach key_name in array array['eventId', 'aggregateId', 'correlationId']::text[] loop
    if (event->>key_name) !~ event_uuid_pattern then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
  end loop;
  if event->'causationId' <> 'null'::jsonb
     and (event->>'causationId') !~ event_uuid_pattern then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;

  -- Text range checks precede every downstream bigint cast, including overflow.
  foreach version_text in array array[
    claim->>'version', event->>'aggregateVersion'
  ]::text[] loop
    if version_text !~ '^[1-9][0-9]{0,18}$' then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    if pg_catalog.length(version_text) = 19
       and version_text collate pg_catalog."C" > '9223372036854775807' then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
  end loop;

  if event->>'eventType' <> 'job.requested'
     or event->'schemaVersion' <> '1'::jsonb
     or event->>'aggregateType' <> 'job'
     -- Preserve raw identity equality; UUID casts would erase spelling changes.
     or claim->>'jobId' is distinct from event->>'aggregateId' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
end;
$body$;

revoke all on function platform_private.cms_schema_dry_run_claim_request(jsonb)
  from public, anon, authenticated, service_role;
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_schema_dry_run_claim_request(jsonb)
  owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;

commit;
