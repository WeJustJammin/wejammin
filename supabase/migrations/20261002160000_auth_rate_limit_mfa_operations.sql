-- DEC-111: AUTH-API-16..21 (MFA factors and step-up) share the identity abuse
-- limiter (BE01a "Observability and Abuse Controls": enrollment start and
-- removal 5/hour/user, step-up challenge creation 10/15m/IP+account, and one
-- shared 10/15m verification-failure bucket).  The operation vocabulary of
-- identity.auth_rate_limits and platform_api.auth_rate_limit widens from
-- AUTH-API-01..15 to AUTH-API-01..21; everything else is unchanged.
-- Forward-only.
begin;

alter table identity.auth_rate_limits
  drop constraint auth_rate_limits_operation_id_check;
alter table identity.auth_rate_limits
  add constraint auth_rate_limits_operation_id_check
  check (operation_id ~ '^AUTH-API-(0[1-9]|1[0-9]|2[01])$');

create or replace function platform_api.auth_rate_limit(
  p_operation_id text,
  p_bucket_digest text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  now_at timestamptz := clock_timestamp();
  window_at timestamptz;
  next_count integer;
begin
  if p_operation_id !~ '^AUTH-API-(0[1-9]|1[0-9]|2[01])$'
     or p_bucket_digest !~ '^[0-9a-f]{64}$'
     or p_limit < 1 or p_limit > 10000
     or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  window_at := pg_catalog.to_timestamp(
    pg_catalog.floor(extract(epoch from now_at) / p_window_seconds) * p_window_seconds
  );
  insert into identity.auth_rate_limits(operation_id, bucket_digest, window_started_at, request_count)
  values (p_operation_id, pg_catalog.decode(p_bucket_digest, 'hex'), window_at, 1)
  on conflict (operation_id, bucket_digest, window_started_at)
  do update set request_count = identity.auth_rate_limits.request_count + 1
  returning request_count into next_count;
  return pg_catalog.jsonb_build_object(
    'allowed', next_count <= p_limit,
    'limit', p_limit,
    'remaining', greatest(0, p_limit - next_count),
    'resetAt', extract(epoch from window_at + pg_catalog.make_interval(secs => p_window_seconds))::bigint
  );
end;
$$;

commit;
