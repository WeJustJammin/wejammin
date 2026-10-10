-- Claimed preparation authority is a read, not a plan lease or a sealed scan.
-- The outer dispatcher validates grammar/service identity and opens RPC context.
-- Every query below, including STABLE helpers, shares this calling snapshot.
-- Forward-only; reversal requires removing the dependent claim dispatcher first.
begin;

create or replace function platform_private.cms_schema_dry_run_claim_snapshot(
  p_request jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  observed_at timestamptz := pg_catalog.statement_timestamp();
  resolved record;
  job_row platform_private.jobs%rowtype;
  event_row platform_private.outbox_events%rowtype;
  report_row platform_private.cms_schema_dry_run_reports%rowtype;
  plan_row platform_private.cms_schema_migration_plans%rowtype;
  candidate platform_private.cms_content_type_versions%rowtype;
  source_row platform_private.cms_content_type_versions%rowtype;
  type_row platform_private.cms_content_types%rowtype;
  artifact platform_private.cms_schema_artifacts%rowtype;
  stored_event jsonb;
  definition jsonb;
  source_hash text;
  transform_hash text;
  plan_json jsonb;
begin
  -- Keep the actual job as the root: a missing joined authority is CONFLICT,
  -- whereas an absent actual job alone is NOT_FOUND. Never choose caller IDs.
  select j as job_row, e as event_row, r as report_row, p as plan_row,
         c as candidate, s as source_row, t as type_row, a as artifact,
         pg_catalog.count(*) over () as matches
    into resolved
    from platform_private.jobs j
    left join platform_private.outbox_events e on e.id = j.originating_event_id
    left join platform_private.cms_schema_dry_run_reports r on r.job_id = j.id
    left join platform_private.cms_schema_migration_plans p on p.id = r.plan_id
    left join platform_private.cms_content_type_versions c on c.id = r.target_version_id
    left join platform_private.cms_content_type_versions s on s.id = p.from_version_id
    left join platform_private.cms_content_types t on t.id = p.content_type_id
    left join platform_private.cms_schema_artifacts a on a.id = c.schema_artifact_id
   where j.id = (p_request->'claimedJob'->>'jobId')::uuid;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  job_row := resolved.job_row;
  event_row := resolved.event_row;
  report_row := resolved.report_row;
  plan_row := resolved.plan_row;
  candidate := resolved.candidate;
  source_row := resolved.source_row;
  type_row := resolved.type_row;
  artifact := resolved.artifact;
  if resolved.matches <> 1 or event_row.id is null or report_row.id is null
     or plan_row.id is null or candidate.id is null or type_row.id is null
     or artifact.id is null
     or job_row.job_type is distinct from 'cms.schema.dry_run'
     or job_row.state is distinct from 'running'::platform_private.job_state
     or job_row.version is distinct from (p_request->'claimedJob'->>'version')::bigint
     or job_row.lease_token is distinct from (p_request->'claimedJob'->>'leaseToken')::uuid
     or job_row.lease_until is null or job_row.lease_until <= observed_at then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;

  stored_event := pg_catalog.jsonb_build_object(
    'eventId', event_row.id, 'eventType', event_row.event_type,
    'schemaVersion', event_row.schema_version, 'aggregateType', event_row.aggregate_type,
    'aggregateId', event_row.aggregate_id, 'aggregateVersion', event_row.aggregate_version::text,
    'correlationId', event_row.correlation_id, 'causationId', event_row.causation_id
  );
  if stored_event is distinct from p_request->'requestedEvent'
     or event_row.event_type is distinct from 'job.requested'
     or event_row.schema_version is distinct from 1
     or event_row.aggregate_type is distinct from 'job'
     or event_row.aggregate_id is distinct from job_row.id
     or event_row.correlation_id is distinct from job_row.correlation_id
     or event_row.causation_id is distinct from job_row.causation_id
     or event_row.payload->>'jobId' is distinct from job_row.id::text
     or event_row.payload->>'jobType' is distinct from job_row.job_type then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;

  if report_row.owner_id is distinct from job_row.acting_party_id
     or plan_row.owner_id is distinct from job_row.acting_party_id
     or candidate.owner_id is distinct from job_row.acting_party_id
     or type_row.owner_id is distinct from job_row.acting_party_id
     or artifact.owner_id is distinct from job_row.acting_party_id
     or report_row.created_by is distinct from job_row.actor_id
     or plan_row.created_by is distinct from job_row.actor_id
     or report_row.content_type_id is distinct from plan_row.content_type_id
     or candidate.content_type_id is distinct from plan_row.content_type_id
     or report_row.target_version_id is distinct from plan_row.to_version_id
     or report_row.source_version_id is distinct from plan_row.from_version_id
     or candidate.supersedes_id is distinct from plan_row.from_version_id
     or candidate.dry_run_id is distinct from report_row.id
     or plan_row.dry_run_report->>'dryRunId' is distinct from report_row.id::text
     or plan_row.superseded_at is not null
     or artifact.content_type_version_id is distinct from candidate.id
     or artifact.state is distinct from 'compiled'
     or report_row.classification is distinct from plan_row.classification
     or candidate.compatibility is distinct from plan_row.classification
     or report_row.transform_key is distinct from plan_row.transform_key
     or report_row.transform_version is distinct from plan_row.transform_version
     or report_row.compiler_version is distinct from artifact.compiler_version
     or (plan_row.from_version_id is not null and (
       source_row.id is null or source_row.owner_id is distinct from job_row.acting_party_id
       or source_row.content_type_id is distinct from plan_row.content_type_id
     )) then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;

  source_hash := coalesce(source_row.definition_hash, pg_catalog.repeat('0', 64));
  definition := platform_private.cms_candidate_definition_request(candidate.id);
  transform_hash := platform_private.cms_migration_transform_hash(
    plan_row.classification, plan_row.transform_key, plan_row.transform_version,
    source_hash, candidate.definition_hash, artifact.artifact_hash, artifact.compiler_version
  );
  if definition is null
     or platform_private.cms_valid_hash(source_hash) is not true
     or platform_private.cms_valid_hash(candidate.definition_hash) is not true
     or platform_private.cms_valid_hash(artifact.artifact_hash) is not true
     or artifact.artifact_hash is distinct from candidate.definition_hash
     or platform_private.cms_definition_artifact_hash(definition, candidate.version_no)
        is distinct from artifact.artifact_hash
     or artifact.editor_manifest is distinct from platform_private.cms_compiled_editor_manifest(definition)
     or artifact.renderer_manifest is distinct from platform_private.cms_compiled_renderer_manifest(definition)
     or artifact.zod_contract_ref is distinct from
        platform_private.cms_artifact_contract_ref(type_row.type_key, candidate.version_no)
     or platform_private.cms_compiler_registry_valid(artifact.compiler_version) is not true
     or plan_row.classification is distinct from
        platform_private.cms_derive_schema_classification(plan_row.from_version_id, candidate.id)
     or (plan_row.transform_key is not null and
       platform_private.cms_transform_registry_member_valid(
         plan_row.transform_key, plan_row.transform_version) is not true)
     or plan_row.dry_run_report->>'sourceHash' is distinct from source_hash
     or plan_row.dry_run_report->>'targetHash' is distinct from candidate.definition_hash
     or plan_row.dry_run_report->>'compilerHash' is distinct from artifact.artifact_hash
     or plan_row.dry_run_report->>'compilerVersion' is distinct from artifact.compiler_version
     or plan_row.dry_run_report->>'transformKey' is distinct from plan_row.transform_key
     or plan_row.dry_run_report->>'transformVersion' is distinct from plan_row.transform_version::text
     or plan_row.dry_run_report->>'transformHash' is distinct from transform_hash then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;

  -- Provisional fingerprints are admissible before any scan. In particular,
  -- source_count may be nonzero; no sealed report or per-row evidence is needed.
  if plan_row.dry_run_report->>'sourceCount' is distinct from plan_row.source_count::text
     or plan_row.dry_run_report->>'targetCount' is distinct from plan_row.target_count::text
     or plan_row.dry_run_report->>'rowErrorCount' is distinct from plan_row.row_error_count::text
     or plan_row.dry_run_report->>'migratedCount' is distinct from plan_row.migrated_count::text
     or plan_row.dry_run_report->>'failedCount' is distinct from plan_row.failed_count::text
     or (plan_row.state = 'draft' and (
       plan_row.cursor <> 0 or plan_row.progress <> 0 or plan_row.target_count <> 0
       or plan_row.row_error_count <> 0 or plan_row.migrated_count <> 0 or plan_row.failed_count <> 0
     )) then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;

  if plan_row.from_version_id is null then
    if plan_row.classification is distinct from 'additive'
       or plan_row.transform_key is not null or plan_row.transform_version is not null
       or plan_row.cursor <> 0 or plan_row.source_count <> 0 or plan_row.target_count <> 0
       or plan_row.row_error_count <> 0 or plan_row.migrated_count <> 0 or plan_row.failed_count <> 0 then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    -- Completed nullable-source replay can have no active, this target active,
    -- or a later active version. Firstness is only a pending-admission fence.
    if plan_row.state <> 'completed' then
      begin
        if platform_private.cms_schema_source_row_count(null, candidate.id) is distinct from 0::bigint then
          raise exception 'CONFLICT' using errcode = 'P0001';
        end if;
      exception when raise_exception then
        if sqlerrm = 'DEPENDENCY_UNAVAILABLE' then
          raise exception 'CONFLICT' using errcode = 'P0001';
        end if;
        raise;
      end;
    end if;
  end if;

  -- This existing STABLE projection sees the identical snapshot used above.
  plan_json := platform_private.cms_worker_plan_json(plan_row.id);
  return pg_catalog.jsonb_build_object(
    'job', pg_catalog.jsonb_build_object(
      'id', job_row.id, 'type', job_row.job_type, 'version', job_row.version::text,
      'actingPartyId', job_row.acting_party_id, 'originatingEventId', job_row.originating_event_id),
    'requestedEvent', stored_event,
    'report', pg_catalog.jsonb_build_object(
      'id', report_row.id, 'jobId', report_row.job_id, 'planId', report_row.plan_id,
      'ownerId', report_row.owner_id, 'contentTypeId', report_row.content_type_id,
      'sourceVersionId', report_row.source_version_id, 'targetVersionId', report_row.target_version_id),
    'candidate', pg_catalog.jsonb_build_object(
      'id', candidate.id, 'ownerId', candidate.owner_id, 'contentTypeId', candidate.content_type_id,
      'supersedesId', candidate.supersedes_id, 'dryRunId', candidate.dry_run_id),
    'planScope', pg_catalog.jsonb_build_object(
      'ownerId', plan_row.owner_id, 'dryRunId', plan_row.dry_run_report->>'dryRunId'),
    'plan', plan_json
  );
end;
$body$;

revoke all on function platform_private.cms_schema_dry_run_claim_snapshot(jsonb)
  from public, anon, authenticated, service_role;
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_schema_dry_run_claim_snapshot(jsonb)
  owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;

commit;
