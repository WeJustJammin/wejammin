-- Add the private claimed-job envelope without changing the legacy reader.
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
begin
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
