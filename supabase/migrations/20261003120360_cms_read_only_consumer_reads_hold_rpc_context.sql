-- SEC-2: the two read-only consumer reads hold the RPC context for their read.
--
-- cms_capability_grant_read_current (the DEC-119 consumer boundary) and
-- cms_get_operational_state_snapshot (the operational gauges) read forced Slice 09
-- tables for the service-role consumer, outside any CMS command.  As functions of
-- the NOLOGIN definer role they pass the same policies as every CMS read command:
-- they hold the RPC context for the read (exactly as cms_get_schema_review and the
-- other CMS reads do) and restore the previous value before returning.  The
-- service-role caller publishes no human session, so the session-scope policy
-- admits it as the system scope.  Behaviour, result shape and ACLs are unchanged.
-- Forward-only.
begin;

create or replace function platform_api.cms_capability_grant_read_current(p_grant_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  previous_rpc text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  result jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  select coalesce(
    (select pg_catalog.jsonb_build_object(
        'found', true, 'grantId', g.id, 'subjectPersonId', g.subject_person_ref,
        'version', g.version::text,
        'state', case when g.state = 'revoked' then 'revoked'
                      when g.valid_through < (pg_catalog.clock_timestamp() at time zone 'UTC')::date then 'lapsed'
                      else 'active' end,
        'capabilityCode', g.capability_code)
       from platform_private.cms_capability_grants g where g.id = p_grant_id),
    pg_catalog.jsonb_build_object('found', false))
    into result;
  perform pg_catalog.set_config('app.cms_rpc', previous_rpc, true);
  return result;
end;
$body$;

create or replace function platform_api.cms_get_operational_state_snapshot(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  observed_at timestamptz;
  activation_blocked_ms numeric;
  outbox_age_ms numeric;
  review_open_age_ms numeric;
  previous_rpc text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
begin
  if p_request is null
    or pg_catalog.jsonb_typeof(p_request) <> 'object'
    or p_request - array['observedAt']::text[] <> '{}'::jsonb
    or not (p_request ? 'observedAt')
  then
    raise exception using errcode = '22023', message = 'invalid operational snapshot request';
  end if;
  begin
    observed_at := (p_request->>'observedAt')::timestamptz;
  exception when others then
    raise exception using errcode = '22023', message = 'invalid operational snapshot request';
  end;
  if observed_at < now() - interval '2 days' or observed_at > now() + interval '5 minutes' then
    raise exception using errcode = '22023', message = 'invalid operational snapshot time';
  end if;

  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  select max(greatest(0, extract(epoch from (observed_at - plan.updated_at)) * 1000))
    into activation_blocked_ms
    from platform_private.cms_schema_migration_plans plan
   where plan.state = 'blocked'
     and plan.updated_at <= observed_at;

  select max(greatest(0, extract(epoch from (observed_at - event.occurred_at)) * 1000))
    into outbox_age_ms
    from platform_private.outbox_events event
   where event.dispatched_at is null
     and event.dead_lettered_at is null
     and event.occurred_at <= observed_at;

  select max(greatest(0, extract(epoch from (observed_at - review.submitted_at)) * 1000))
    into review_open_age_ms
    from platform_private.cms_schema_reviews review
   where review.state = 'open'
     and review.submitted_at <= observed_at;
  perform pg_catalog.set_config('app.cms_rpc', previous_rpc, true);

  return pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'activationBlockedMs', activation_blocked_ms,
    'outboxAgeMs', outbox_age_ms,
    'reviewOpenAgeMs', review_open_age_ms
  ));
end;
$body$;

commit;
