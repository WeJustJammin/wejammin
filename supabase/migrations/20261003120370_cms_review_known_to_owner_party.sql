-- SEC-2: "known readable review" without reading the review through the caller's scope.
--
-- CMS-03A-13 answers a confirmed member of the owner organization who lacks the
-- designer capability with 403 CAPABILITY_REQUIRED, and every other caller with the
-- concealed 404.  The 403 branch used to read the review row directly, which only
-- worked because the function's owner bypassed RLS: under the session-scope policy
-- a caller without scope (the very caller that must get the 403) sees no row.  The
-- existence-and-owner fact is now answered by a read-only helper owned by the
-- authority-reader role (SELECT only, exempt from the scope policy) that returns a
-- boolean and nothing else, so the 403 and the concealed 404 stay exactly as
-- specified and no review field is exposed.  Forward-only.
begin;

create function platform_private.cms_review_owned_by(p_review_id uuid, p_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $body$
  select exists (
    select 1 from platform_private.cms_schema_reviews review
     where review.id = p_review_id and review.owner_id = p_owner_id)
$body$;
revoke all on function platform_private.cms_review_owned_by(uuid, uuid) from public, anon, authenticated, service_role;
grant create on schema platform_private to wejammin_cms_authority_reader;
alter function platform_private.cms_review_owned_by(uuid, uuid) owner to wejammin_cms_authority_reader;
revoke create on schema platform_private from wejammin_cms_authority_reader;
grant execute on function platform_private.cms_review_owned_by(uuid, uuid) to wejammin_cms_definer;

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
    -- A review of the caller's own acting party that the caller cannot read for
    -- want of the capability (a confirmed member acting as the owner party) is
    -- known and readable in the party scope: 403.  Every other caller, an
    -- absent review and a cross-owner review are the same concealed 404.
    if platform_private.cms_review_owned_by(review_id, acting_party_id)
       and platform_private.cms_grant_subject_eligible(acting_party_id, person_id) then
      perform platform_private.cms_raise_forbidden('CAPABILITY_REQUIRED');
    end if;
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  return platform_private.cms_schema_review_resource(
    review_id, person_id, scope = 'designer',
    scope = 'designer' and platform_private.cms_review_is_owner(actor_id, acting_party_id));
end;
$body$;

commit;
