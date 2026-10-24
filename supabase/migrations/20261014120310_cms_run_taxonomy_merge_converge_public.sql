-- Slice 12 lane taxonomy-terms, the merge continuation Worker transport (BE03c 1334 "Job transport", 1351, 1377, 1447; P2-S12-AC-021): the
-- platform_api wrapper of the cms.taxonomy.merge_converge job handler.  It mirrors the CMS-03C-19 pair (20261014070510 claim, 20261014070610
-- execute): SECURITY DEFINER, owned by the CMS definer, EXECUTE granted to service_role only (never public, anon or authenticated), the residual
-- deadlock or lock failure mapped to the typed retryable CONFLICT with nothing committed (BE03c 1357), and the RPC-context flag the handler sets
-- restored for the rest of the caller's transaction.
--   request  { jobId: uuid, batch?: integer 1 .. 5000 (default 5000, the in-transaction ceiling of BE03c 1377) }  - nothing else
--   answer   { converged: integer, remaining: integer }  (remaining = 0: the merges of the job's acting party are fully converged)
--   errors   P0001 INVALID_REQUEST (malformed request), NOT_FOUND (no such job, or a job of another type), CONFLICT (lock failure)
-- The caller is the BE00 job runtime / Worker queue consumer: it claims the job (platform_api.claim_job), calls this with the job id, then records
-- the outcome (platform_api.apply_job_outcome: succeeded with the answer when remaining = 0, retryable otherwise).  Forward-only.
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
  batch_value integer := 5000;
begin
  if p_request is null or pg_catalog.jsonb_typeof(p_request) is distinct from 'object'
     or not platform_private.cms_exact_keys(p_request, array['jobId']::text[], array['jobId', 'batch']::text[])
     or pg_catalog.jsonb_typeof(p_request->'jobId') is distinct from 'string'
     or platform_private.cms_valid_uuid(p_request->>'jobId') is not true then
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
    rpc_result := platform_private.cms_run_taxonomy_merge_converge((p_request->>'jobId')::uuid, batch_value);
  exception
    when deadlock_detected or lock_not_available then
      raise exception 'CONFLICT' using errcode = 'P0001';
  end;
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

comment on function platform_api.cms_run_taxonomy_merge_converge(jsonb) is
  'BE03c 1334 Worker transport of the cms.taxonomy.merge_converge job handler: { jobId, batch? } -> { converged, remaining }. Executable by service_role only.';

grant create on schema platform_api to wejammin_cms_definer;
alter function platform_api.cms_run_taxonomy_merge_converge(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_api from wejammin_cms_definer;
revoke all on function platform_api.cms_run_taxonomy_merge_converge(jsonb) from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_run_taxonomy_merge_converge(jsonb) to service_role;

commit;
