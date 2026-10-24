-- Slice 12 lane s12_governed_red GREEN: the position-1 authority fence for the CMS-03C-06 governed
-- submit (BE03c "Slice 12 lock order" at 1345).  cms_person_holds_capability is a read, not a fence; this
-- helper locks the exact authority rows that read and the revocation seams use -- the submitter person,
-- every acting-party membership tenure (ordered by id) and the exact owner-capability grant -- so a
-- concurrent revocation serializes against the submit.  The predicate is narrowed to the subject kind's
-- owner capability (cms.template_designer or cms.taxonomy_curator), never author/editor.  It does NOT read
-- or lock cms_owner_initialization: the capability predicate derives authority from membership_tenure plus
-- organization_actor_grant only.  Scoped to CMS-03C-06 for now; CMS-03C-07/09 fence different authority
-- rows and will add their own helper.  Private; SECURITY DEFINER; owned by the CMS definer.  Forward-only.

begin;
set local lock_timeout = '5s';

create or replace function platform_private.cms_lock_governed_authority(
  p_actor_id uuid,
  p_acting_party_id uuid,
  p_capability text
)
returns void
language plpgsql
security definer
set search_path = ''
as $body$
declare
  resolved_person_id uuid;
begin
  if p_actor_id is null or p_acting_party_id is null then
    return;
  end if;
  begin
    resolved_person_id := platform_private.identity_actor_person(p_actor_id);
  exception when others then
    resolved_person_id := null;
  end;
  if resolved_person_id is null then
    -- No resolvable person has no authority; the capability recheck that follows refuses.
    return;
  end if;
  -- The revocation seams update exactly these rows (a person, a tenure, a grant) and then lock the review
  -- rows; the share locks are taken in that order.  No predicate narrows them beyond the owner capability:
  -- a grant being revoked right now must be locked even though its committed state still proves authority.
  perform 1
    from platform_private.person_party person
   where person.party_id = resolved_person_id
     for share;
  perform 1
    from identity_private.membership_tenure tenure
   where tenure.organization_id = p_acting_party_id
     and tenure.person_id = resolved_person_id
   order by tenure.id
     for share;
  perform 1
    from identity_private.organization_actor_grant actor_grant
   where actor_grant.organization_id = p_acting_party_id
     and actor_grant.person_id = resolved_person_id
     and actor_grant.capability_code = p_capability
   order by actor_grant.capability_code
     for share;
end;
$body$;

comment on function platform_private.cms_lock_governed_authority(uuid, uuid, text) is
  'BE03c Slice 12 lock order position 1 for CMS-03C-06: FOR SHARE the submitter person, every acting-party membership tenure (ordered by id) and the exact owner-capability (cms.template_designer or cms.taxonomy_curator) grant, so the capability recheck under the locks is fenced. Does not read cms_owner_initialization. Private.';

grant select on table platform_private.person_party to wejammin_cms_definer;
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_lock_governed_authority(uuid, uuid, text) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_lock_governed_authority(uuid, uuid, text)
  from public, anon, authenticated, service_role;

commit;

