-- CMS-03B-11 / BE03b: an entry-scoped grant and assignment must derive from
-- the same owner.  The assignment-to-entry owner FK proves the stored chain;
-- this resolver also binds that owner to the actor's current acting party.
-- Otherwise a grant held in tenant B can combine with an assignment on an
-- entry owned by tenant A and expose A's protected draft through a B context.
begin;

create or replace function platform_private.cms_authority_origin(
  p_actor_id uuid,
  p_acting_party_id uuid,
  p_capability_key text,
  p_entry_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $body$
declare
  resolved_person_id uuid;
  grant_present boolean;
  assignment_present boolean;
begin
  if p_capability_key is null
     or p_capability_key not in ('cms.author', 'cms.editor', 'cms.reviewer')
     or not platform_private.cms_capability_registry_valid(p_capability_key, 1) then
    return null;
  end if;
  if p_actor_id is null or p_acting_party_id is null then
    return null;
  end if;
  begin
    resolved_person_id := platform_private.identity_actor_person(p_actor_id);
  exception
    when others then
      resolved_person_id := null;
  end;
  if resolved_person_id is null then
    return null;
  end if;
  select exists (
    select 1
    from identity_private.membership_tenure tenure
    join identity_private.organization_actor_grant actor_grant
      on actor_grant.organization_id = tenure.organization_id
     and actor_grant.person_id = tenure.person_id
    where tenure.organization_id = p_acting_party_id
      and tenure.person_id = resolved_person_id
      and tenure.state = 'confirmed'
      and (tenure.ends_on is null or tenure.ends_on >= current_date)
      and actor_grant.capability_code = p_capability_key
      and actor_grant.active
      and actor_grant.valid_from <= current_date
      and (actor_grant.valid_through is null or actor_grant.valid_through >= current_date)
  ) into grant_present;
  if not grant_present then
    return null;
  end if;
  if p_entry_id is null then
    return 'grant';
  end if;
  select exists (
    select 1
    from platform_private.cms_entry_assignments assignment
    where assignment.entry_id = p_entry_id
      and assignment.owner_id = p_acting_party_id
      and assignment.assignee_person_id = resolved_person_id
      and assignment.capability_key = p_capability_key
      and assignment.state = 'active'
  ) into assignment_present;
  if not assignment_present then
    return null;
  end if;
  return 'assignment';
end;
$body$;

comment on function platform_private.cms_authority_origin(uuid, uuid, text, uuid) is
  'Fail-closed resolver: registered capability, confirmed tenure and active grant in the acting party, plus an active assignment owned by that same party for existing entries. No caller-presented key confers authority.';

revoke all on function platform_private.cms_authority_origin(uuid, uuid, text, uuid)
  from public, anon, authenticated, service_role;

commit;
