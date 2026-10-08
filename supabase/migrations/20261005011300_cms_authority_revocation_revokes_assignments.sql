-- Slice 10 gap resolution DEC-143 (P2-S10-AC-051, audit D-6): authority
-- revocation revokes the affected person's active entry assignments.
--
-- IA03 "Authority revoked during autosave/review ... remove the presence lease
-- and assignment".  20261005010600 released the advisory presence lease in the
-- revoking transaction but nothing ever retired the entry assignment, so a
-- person whose grant was revoked and later re-granted silently regained the
-- entry.  The release helper below (called by the actor-grant and membership-
-- tenure triggers with a null entry, and by the assignment trigger with the
-- entry) now also revokes, for the org-level triggers, every active
-- author/editor/reviewer assignment the person holds in that party whose
-- capability the canonical resolver no longer proves at grant level.  The
-- revocation is state = revoked with version + 1 in the same statement as the
-- loss, before the presence re-proof, so a lease relying only on the lost
-- capability is released and a lease still backed by another held capability is
-- kept.  Re-granting never resurrects an assignment.  The helper keeps its
-- signature, returns the same released-lease count, and keeps its owner and
-- revoke-all discipline (CREATE OR REPLACE).  The helper is owned by the NOLOGIN
-- definer role (SEC-2), which held INSERT and SELECT on the assignment table
-- only, so it also receives the one UPDATE verb the revocation needs.  No API
-- role gains anything.  Forward-only.
begin;

grant update on table platform_private.cms_entry_assignments to wejammin_cms_definer;

create or replace function platform_private.cms_revoke_edit_presence_without_authority(
  p_acting_party_id uuid,
  p_person_id uuid,
  p_entry_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $body$
#variable_conflict use_variable
declare
  actor_id uuid;
  candidate record;
  assignment_candidate record;
  revoked_count integer := 0;
  revoke_time timestamptz := pg_catalog.clock_timestamp();
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
begin
  if p_acting_party_id is null or p_person_id is null then
    return 0;
  end if;
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);

  -- The person's authenticated principal.  A person with no usable principal
  -- (unclaimed or suspended) has no authority at all, so every lease releases.
  select person.auth_user_id into actor_id
  from platform_private.person_party person
  where person.party_id = p_person_id
    and person.account_state in ('claimed', 'active');

  -- DEC-143 (P2-S10-AC-051, audit D-6): authority revocation also revokes the
  -- affected person's active entry assignments, in this same transaction as the
  -- presence release below.  Authority over an entry is a registered grant AND
  -- an active assignment for the same capability, so when the grant-level
  -- authority for an assigned capability is gone (the actor grant was
  -- deactivated, deleted or lapsed, the membership tenure ended, or the person
  -- has no usable principal) the assignment that capability carried is revoked
  -- (state revoked, version + 1, never deleted).  A capability whose grant the
  -- person still holds keeps its assignment, so a partial revocation revokes
  -- only the lost capability.  An entry-scoped change (p_entry_id is set, the
  -- assignment trigger) revokes nothing here: the assignment is itself the
  -- change.  Re-granting a capability never resurrects a revoked assignment; a
  -- fresh assignment is required.  Only the three capabilities the canonical
  -- resolver proves are considered, so an assignment of any other capability is
  -- never touched.  No audit or outbox row is written, like the release.
  if p_entry_id is null then
    for assignment_candidate in
      select assignment.id, assignment.capability_key
      from platform_private.cms_entry_assignments assignment
      where assignment.owner_id = p_acting_party_id
        and assignment.assignee_person_id = p_person_id
        and assignment.state = 'active'
        and assignment.capability_key in ('cms.author', 'cms.editor', 'cms.reviewer')
      order by assignment.id
      for update of assignment
    loop
      if platform_private.cms_authority_origin(
           actor_id, p_acting_party_id, assignment_candidate.capability_key, null
         ) is null then
        update platform_private.cms_entry_assignments assignment
        set state = 'revoked',
            version = assignment.version + 1,
            updated_at = revoke_time
        where assignment.id = assignment_candidate.id;
      end if;
    end loop;
  end if;

  for candidate in
    select presence.id, presence.entry_id
    from platform_private.cms_edit_presence presence
    where presence.person_id = p_person_id
      and presence.acting_party_id = p_acting_party_id
      and presence.state = 'active'
      and (p_entry_id is null or presence.entry_id = p_entry_id)
    order by presence.id
    for update of presence
  loop
    if platform_private.cms_authority_origin(
         actor_id, p_acting_party_id, 'cms.editor', candidate.entry_id
       ) is null
       and platform_private.cms_authority_origin(
         actor_id, p_acting_party_id, 'cms.author', candidate.entry_id
       ) is null then
      update platform_private.cms_edit_presence presence
      set state = 'revoked',
          version = presence.version + 1,
          updated_at = revoke_time
      where presence.id = candidate.id;
      revoked_count := revoked_count + 1;
    end if;
  end loop;

  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return revoked_count;
end;
$body$;

commit;
