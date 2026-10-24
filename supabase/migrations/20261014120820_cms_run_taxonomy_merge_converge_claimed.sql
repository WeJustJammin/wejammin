-- Slice 12 lane taxonomy-terms, follow-up f2: the Worker transport of the fenced merge continuation handler (20261014120810).
-- Replaces platform_api.cms_run_taxonomy_merge_converge(jsonb) of 20261014120310 in place (same name, same ACL: SECURITY DEFINER, owned by the CMS
-- definer, EXECUTE to service_role only; create or replace keeps owner and grants), changing only the request grammar to the claimed-job shape of the
-- dry-run claim (20261005018500) and the CMS-03C-19 executor:
--   request  { claimedJob: { jobId: uuid, version: decimal bigint string, leaseToken: uuid }, batch?: integer 1 .. 5000 (default 5000) } - nothing else
--   answer   { converged: integer, remaining: integer, continuationJobId: uuid | null }
--   errors   P0001 INVALID_REQUEST (malformed request), NOT_FOUND (no such job, or a job of another type), CONFLICT (the lease or state fence, or a
--            lock failure), capability_missing (the job actor no longer holds cms.taxonomy_curator; 403)
-- The caller is the BE00 job runtime / Worker queue consumer: platform_api.claim_job, then this with the claimed version and lease token, then
-- platform_api.apply_job_outcome `succeeded` with the answer as resultRef (the continuation, when named, is its own queued job) or `failed`
-- CAPABILITY_MISSING / retryable CONFLICT for the refusals.  The previous unfenced private handler (uuid, integer) is dropped here.  Forward-only.
begin;
set local lock_timeout = '5s';

create or replace function platform_api.cms_run_taxonomy_merge_converge(p_request jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  rpc_result jsonb;
  claim jsonb;
  version_text text;
  batch_value integer := 5000;
begin
  if p_request is null or pg_catalog.jsonb_typeof(p_request) is distinct from 'object'
     or not platform_private.cms_exact_keys(p_request, array['claimedJob']::text[], array['claimedJob', 'batch']::text[]) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  claim := p_request->'claimedJob';
  if pg_catalog.jsonb_typeof(claim) is distinct from 'object'
     or not platform_private.cms_exact_keys(claim, array['jobId', 'version', 'leaseToken']::text[], array['jobId', 'version', 'leaseToken']::text[])
     or pg_catalog.jsonb_typeof(claim->'jobId') is distinct from 'string'
     or pg_catalog.jsonb_typeof(claim->'version') is distinct from 'string'
     or pg_catalog.jsonb_typeof(claim->'leaseToken') is distinct from 'string'
     or platform_private.cms_valid_uuid(claim->>'jobId') is not true
     or platform_private.cms_valid_uuid(claim->>'leaseToken') is not true then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  version_text := claim->>'version';
  if version_text !~ '^[1-9][0-9]{0,18}$'
     or (pg_catalog.length(version_text) = 19 and version_text collate pg_catalog."C" > '9223372036854775807') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if p_request ? 'batch' then
    if pg_catalog.jsonb_typeof(p_request->'batch') is distinct from 'number'
       or p_request->>'batch' !~ '^[1-9][0-9]{0,3}$'
       or (p_request->>'batch')::integer > 5000 then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    batch_value := (p_request->>'batch')::integer;
  end if;
  begin
    rpc_result := platform_private.cms_run_taxonomy_merge_converge(
      (claim->>'jobId')::uuid, version_text::bigint, (claim->>'leaseToken')::uuid, batch_value);
  exception
    when deadlock_detected or lock_not_available then
      raise exception 'CONFLICT' using errcode = 'P0001';
  end;
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

comment on function platform_api.cms_run_taxonomy_merge_converge(jsonb) is
  'BE03c 1334 Worker transport of the cms.taxonomy.merge_converge job handler: { claimedJob: { jobId, version, leaseToken }, batch? } -> { converged, remaining, continuationJobId }. Executable by service_role only.';

drop function platform_private.cms_run_taxonomy_merge_converge(uuid, integer);

commit;
