-- BE03a "Database invariants and grants" / AC181 review fix: the reviewer
-- branch of the RLS scope helper accepted ANY assignment row on the review.
-- A revoked, expired or not-yet-started assignment, or an assignment stamped
-- with a different organization's owner_id, therefore still satisfied every
-- restrictive session policy in USING and WITH CHECK.
--
-- The branch now demands the EFFECTIVE assignment, resolved the same way the
-- decision RPC resolves it (state active and starts_at <= now < ends_at, via
-- cms_review_assignment_effective), and owner consistency: the assignment, the
-- review and the row being touched must all carry the same owner_id.  The
-- owner/capability branch and the system scope are unchanged.
-- Forward-only: replaces the function body only (same signature, grants and
-- policies stay in place).
begin;

create or replace function platform_private.cms_session_scope_ok(p_owner_id uuid, p_review_id uuid default null)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  actor uuid;
  party uuid;
  person uuid;
begin
  if platform_private.cms_session_system_scope() then
    return true;
  end if;
  actor := platform_private.cms_session_uuid('app.cms_session_actor');
  party := platform_private.cms_session_uuid('app.cms_session_party');
  if actor is null or party is null or p_owner_id is null then
    return false;
  end if;
  select person_row.party_id into person
    from platform_private.person_party person_row
   where person_row.auth_user_id = actor
     and person_row.account_state in (
       'claimed'::platform_private.person_account_state,
       'active'::platform_private.person_account_state);
  if person is null then
    return false;
  end if;
  if party = p_owner_id and (
       exists (
         select 1 from platform_private.cms_owner_initialization receipt
          where receipt.auth_user_id = actor and receipt.person_id = person
            and receipt.organization_id = party)
       or platform_private.cms_person_holds_capability(party, person, 'cms.schema_designer')
       or platform_private.cms_person_holds_capability(party, person, 'cms.schema_registry.read')
     ) then
    return true;
  end if;
  if p_review_id is not null and exists (
       select 1
         from platform_private.cms_schema_review_assignments assignment
         join platform_private.cms_schema_reviews review on review.id = assignment.review_id
        where assignment.review_id = p_review_id
          and assignment.reviewer_person_ref = person
          and assignment.owner_id = p_owner_id
          and review.owner_id = p_owner_id
          and platform_private.cms_review_assignment_effective(
            assignment.state, assignment.starts_at, assignment.ends_at)) then
    return true;
  end if;
  return false;
end;
$body$;

revoke all on function platform_private.cms_session_scope_ok(uuid, uuid)
  from public, anon, authenticated, service_role;

commit;
