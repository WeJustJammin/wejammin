-- CMS-03A-13: the capability-scoped safe review projection.  Projection-only:
-- no INSERT, UPDATE, DELETE, idempotency reservation, audit or outbox write on
-- success or failure.  A review outside the caller's submitter/schema-designer
-- scope or assigned review-only scope is concealed as NOT_FOUND.  Forward-only.
begin;

create or replace function platform_private.cms_get_schema_review(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  actor_id uuid;
  acting_party_id uuid;
  person_id uuid;
  scope text;
  review_id uuid;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  if not platform_private.cms_exact_keys(
    p_request, array['reviewId']::text[], array['reviewId','context','correlationId']::text[]
  ) or not platform_private.cms_valid_uuid(p_request->>'reviewId') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  review_id := (p_request->>'reviewId')::uuid;
  person_id := platform_private.identity_actor_person(actor_id);
  scope := platform_private.cms_review_scope(review_id, actor_id, acting_party_id);
  if scope is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  return platform_private.cms_schema_review_resource(
    review_id, person_id, scope = 'designer',
    scope = 'designer' and platform_private.cms_review_is_owner(actor_id, acting_party_id));
end;
$body$;

create or replace function platform_api.cms_get_schema_review(p_request jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $body$
  select platform_private.cms_get_schema_review(p_request)
$body$;

revoke all on function platform_private.cms_get_schema_review(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_private.cms_get_schema_review(jsonb) to service_role;
revoke all on function platform_api.cms_get_schema_review(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_get_schema_review(jsonb) to service_role;

commit;
