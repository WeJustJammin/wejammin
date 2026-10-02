-- G2b (P2-S09-AC-693): the protected operational snapshot also carries
-- reviewOpenAgeMs, the age in milliseconds of the oldest schema review that is
-- still open at the observation instant (absent when none is open).  The Worker
-- compares it to the review-open window and raises review_open_past_window.  No
-- review, person or actor identifier is serialized; the rest of the function is
-- unchanged and its service-role-only grant is preserved.  Forward-only.
begin;

CREATE OR REPLACE FUNCTION platform_api.cms_get_operational_state_snapshot(p_request jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  observed_at timestamptz;
  activation_blocked_ms numeric;
  outbox_age_ms numeric;
  review_open_age_ms numeric;
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

  return pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'activationBlockedMs', activation_blocked_ms,
    'outboxAgeMs', outbox_age_ms,
    'reviewOpenAgeMs', review_open_age_ms
  ));
end;
$function$;

commit;
