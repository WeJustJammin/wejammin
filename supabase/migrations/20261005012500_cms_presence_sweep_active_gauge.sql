-- Slice 10 presence sweep gauge (lane H, wave 2; lane I request in NOTES): the
-- service-role expiry sweep cms_expire_edit_presence_leases (20261005010600) answers
-- { expiredLeases, activeLeases }.  activeLeases is the number of presence leases still
-- `active` after the sweep, capped at 10,000,000, so the Worker can emit the BE03b
-- cms_presence_active gauge.  The body is the 20261005010600 definition with only the
-- count and the second member added; signature, SECURITY DEFINER attributes, owner and
-- grants (service-role wrapper platform_api.cms_expire_edit_presence_leases forwards the
-- result unchanged) are unchanged (CREATE OR REPLACE).  Forward-only.
begin;

create or replace function platform_private.cms_expire_edit_presence_leases(
  p_batch integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
#variable_conflict use_variable
declare
  expired_count integer;
  active_count bigint;
  sweep_time timestamptz := pg_catalog.clock_timestamp();
begin
  if p_batch is null or p_batch not between 1 and 5000 then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);

  with lapsed as materialized (
    select presence.id
    from platform_private.cms_edit_presence presence
    where presence.state = 'active'
      and presence.lease_until < sweep_time
    order by presence.lease_until, presence.id
    limit p_batch
    for update of presence skip locked
  )
  update platform_private.cms_edit_presence presence
  set state = 'expired',
      version = presence.version + 1,
      updated_at = sweep_time
  from lapsed
  where presence.id = lapsed.id;

  get diagnostics expired_count = row_count;
  -- BE03b cms_presence_active gauge (lane I request): the leases still `active`
  -- after this sweep, capped at the contract bound of 10,000,000.
  select pg_catalog.count(*) into active_count
  from platform_private.cms_edit_presence presence
  where presence.state = 'active';
  return pg_catalog.jsonb_build_object(
    'expiredLeases', expired_count,
    'activeLeases', least(active_count, 10000000)
  );
end;
$body$;

commit;
