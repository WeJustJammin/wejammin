-- BE03a CMS-03A-13 (P2-S09-AC-452): the review detail denies a known readable
-- review to a caller lacking the required capability with 403 FORBIDDEN, while
-- an absent, cross-owner or out-of-party review stays an indistinguishable 404.
-- A "known readable" review is one of the caller's own acting party that the
-- caller (a confirmed, started, unbanned member of that party) cannot read for
-- want of cms.schema_designer or an effective assignment.  Forward-only.
begin;

CREATE OR REPLACE FUNCTION platform_private.cms_get_schema_review(p_request jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    -- A review of the caller's own acting party that the caller cannot read for
    -- want of the capability (a confirmed member acting as the owner party) is
    -- known and readable in the party scope: 403.  Every other caller, an
    -- absent review and a cross-owner review are the same concealed 404.
    if exists (
      select 1 from platform_private.cms_schema_reviews review
       where review.id = review_id and review.owner_id = acting_party_id
    ) and platform_private.cms_grant_subject_eligible(acting_party_id, person_id) then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  return platform_private.cms_schema_review_resource(
    review_id, person_id, scope = 'designer',
    scope = 'designer' and platform_private.cms_review_is_owner(actor_id, acting_party_id));
end;
$function$;

revoke all on function platform_private.cms_get_schema_review(jsonb)
  from public, anon, authenticated, service_role;

commit;
