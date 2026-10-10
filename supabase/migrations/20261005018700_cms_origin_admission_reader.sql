-- Add immutable origin identity, not current-attempt or execution authority.
-- Reversal: restore the dispatcher body from 20261005018600 in a new migration.
begin;

create or replace function platform_private.cms_get_schema_migration_plan(
  p_request jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  plan_id uuid;
  schema_version_id uuid;
  expected_version bigint;
  plan_row platform_private.cms_schema_migration_plans%rowtype;
  event_keys constant text[] := array[
    'eventId', 'eventType', 'schemaVersion', 'aggregateType', 'aggregateId',
    'aggregateVersion', 'correlationId', 'causationId'
  ];
  event_uuid_pattern constant text :=
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  requested_event jsonb;
  key_name text;
  version_text text;
begin
  if platform_private.cms_exact_keys(
    p_request,
    array['requestedEvent']::text[],
    array['requestedEvent']::text[]
  ) then
    perform platform_private.cms_worker_require_request(
      p_request,
      array['requestedEvent']::text[],
      array['requestedEvent']::text[]
    );
    requested_event := p_request->'requestedEvent';
    if not platform_private.cms_exact_keys(requested_event, event_keys, event_keys) then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    foreach key_name in array array[
      'eventId', 'eventType', 'aggregateType', 'aggregateId',
      'aggregateVersion', 'correlationId'
    ]::text[] loop
      if pg_catalog.jsonb_typeof(requested_event->key_name) is distinct from 'string' then
        raise exception 'INVALID_REQUEST' using errcode = 'P0001';
      end if;
    end loop;
    if pg_catalog.jsonb_typeof(requested_event->'schemaVersion') is distinct from 'number'
       or pg_catalog.jsonb_typeof(requested_event->'causationId') not in ('null', 'string') then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    foreach key_name in array array['eventId', 'aggregateId', 'correlationId']::text[] loop
      if (requested_event->>key_name) !~ event_uuid_pattern then
        raise exception 'INVALID_REQUEST' using errcode = 'P0001';
      end if;
    end loop;
    if requested_event->'causationId' <> 'null'::jsonb
       and (requested_event->>'causationId') !~ event_uuid_pattern then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    version_text := requested_event->>'aggregateVersion';
    if version_text !~ '^[1-9][0-9]{0,18}$' then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    if pg_catalog.length(version_text) = 19
       and version_text collate pg_catalog."C" > '9223372036854775807' then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    if requested_event->>'eventType' <> 'job.requested'
       or requested_event->'schemaVersion' <> '1'::jsonb
       or requested_event->>'aggregateType' <> 'job' then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;

    -- One read snapshot; current Job version/state/lease and dispatch are irrelevant.
    return pg_catalog.to_jsonb(exists (
      select 1
        from platform_private.jobs j
        join platform_private.outbox_events e on e.id = j.originating_event_id
       where j.id = (requested_event->>'aggregateId')::uuid
         and j.job_type = 'cms.schema.dry_run'
         and e.event_type = 'job.requested'
         and e.schema_version = 1
         and e.aggregate_type = 'job'
         and e.aggregate_id = j.id
         and e.correlation_id = j.correlation_id
         and e.causation_id is not distinct from j.causation_id
         and e.payload->>'jobId' = j.id::text
         and e.payload->>'jobType' = j.job_type
         and pg_catalog.jsonb_build_object(
           'eventId', e.id, 'eventType', e.event_type,
           'schemaVersion', e.schema_version, 'aggregateType', e.aggregate_type,
           'aggregateId', e.aggregate_id, 'aggregateVersion', e.aggregate_version::text,
           'correlationId', e.correlation_id, 'causationId', e.causation_id
         ) = requested_event
    ));
  end if;
  if platform_private.cms_exact_keys(
    p_request,
    array['claimedJob', 'requestedEvent']::text[],
    array['claimedJob', 'requestedEvent']::text[]
  ) then
    perform platform_private.cms_worker_require_request(
      p_request,
      array['claimedJob', 'requestedEvent']::text[],
      array['claimedJob', 'requestedEvent']::text[]
    );
    perform platform_private.cms_schema_dry_run_claim_request(p_request);
    return platform_private.cms_schema_dry_run_claim_snapshot(p_request);
  end if;
  perform platform_private.cms_worker_require_request(
    p_request,
    array['migrationPlanId', 'schemaVersionId', 'expectedVersion']::text[],
    array['migrationPlanId', 'schemaVersionId', 'expectedVersion']::text[]
  );
  plan_id := platform_private.cms_worker_uuid(p_request->>'migrationPlanId');
  schema_version_id := platform_private.cms_worker_uuid(p_request->>'schemaVersionId');
  expected_version := platform_private.cms_worker_positive(p_request->>'expectedVersion');
  select * into plan_row
    from platform_private.cms_schema_migration_plans plan
   where plan.id = plan_id
   for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if plan_row.to_version_id <> schema_version_id then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if plan_row.version <> expected_version and plan_row.state <> 'completed' then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  return platform_private.cms_worker_plan_json(plan_id);
end;
$body$;

-- CREATE OR REPLACE preserves the existing definer owner and wrapper grants.
revoke all on function platform_private.cms_get_schema_migration_plan(jsonb)
  from public, anon, authenticated, service_role;

commit;
