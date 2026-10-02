-- The owner-authority and review-scope helpers resolve the verified actor
-- through a volatile accessor, so they are volatile rather than stable.
-- Forward-only.
begin;

CREATE OR REPLACE FUNCTION platform_private.cms_review_owner_authority_end(p_actor_id uuid, p_acting_party_id uuid)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  owner_person uuid;
  grant_through date;
begin
  owner_person := platform_private.identity_actor_person(p_actor_id);
  if not exists (
    select 1 from platform_private.cms_owner_initialization receipt
     where receipt.auth_user_id = p_actor_id
       and receipt.person_id = owner_person
       and receipt.organization_id = p_acting_party_id
  ) or not platform_private.cms_person_holds_capability(
    p_acting_party_id, owner_person, 'cms.schema_designer'
  ) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  select actor_grant.valid_through into grant_through
    from identity_private.organization_actor_grant actor_grant
   where actor_grant.organization_id = p_acting_party_id
     and actor_grant.person_id = owner_person
     and actor_grant.capability_code = 'cms.schema_designer';
  if grant_through is null then
    return 'infinity'::timestamptz;
  end if;
  return ((grant_through + 1)::timestamp at time zone 'UTC');
end;
$function$;

CREATE OR REPLACE FUNCTION platform_private.cms_review_scope(p_review_id uuid, p_actor_id uuid, p_acting_party_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  review_row platform_private.cms_schema_reviews%rowtype;
  person uuid;
begin
  select * into review_row from platform_private.cms_schema_reviews where id = p_review_id;
  if not found then
    return null;
  end if;
  person := platform_private.identity_actor_person(p_actor_id);
  if review_row.owner_id = p_acting_party_id
     and platform_private.cms_person_holds_capability(
       p_acting_party_id, person, 'cms.schema_designer') then
    return 'designer';
  end if;
  if exists (
    select 1 from platform_private.cms_schema_review_assignments assignment
     where assignment.review_id = review_row.id
       and assignment.reviewer_person_ref = person
       and platform_private.cms_review_assignment_effective(
         assignment.state, assignment.starts_at, assignment.ends_at)
  ) then
    return 'assigned';
  end if;
  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION platform_private.cms_review_is_owner(p_actor_id uuid, p_acting_party_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform platform_private.cms_review_owner_authority_end(p_actor_id, p_acting_party_id);
  return true;
exception when raise_exception then
  return false;
end;
$function$;


revoke all on function platform_private.cms_review_owner_authority_end(uuid, uuid),
  platform_private.cms_review_scope(uuid, uuid, uuid),
  platform_private.cms_review_is_owner(uuid, uuid)
  from public, anon, authenticated, service_role;

commit;
