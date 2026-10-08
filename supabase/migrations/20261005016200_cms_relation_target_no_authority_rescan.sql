-- Slice 10 round 5 (lane H, Codex final review HIGH, same class as 20261005016000): the writers'
-- relation-target lock does not rescan the caller's authority rows after the active version.
--
-- cms_lock_relation_target locked the target entry row and then called cms_lock_entry_authority
-- for the target, which re-takes FOR SHARE locks on the caller's person, tenure and grant rows
-- (and then the assignments over the target).  The writers take those rows first, at the start
-- of the command, and the active version after them; the relation-target lock runs after the
-- version lock, so the rescan acquires authority rows AFTER the version, against the global
-- order, and a row committed after the first scan and held by a revocation could be waited for
-- while the activation waits for the version this writer holds.  The assignment part of
-- cms_lock_entry_authority is extracted as cms_lock_entry_assignments_shared; the relation-target
-- lock now takes the target entry row and the caller's assignments over it only.  The start-of-
-- command call (cms_require_entry_capability_locked -> cms_lock_entry_authority) is unchanged:
-- the same identity rows, then the assignments, in the same order.
-- Proof: ../tests/phase_02_slice_10_activation_lock_order.sql (structure) and the unchanged
-- race runner 012 (relation-target locks).  Forward-only.
begin;

create or replace function platform_private.cms_lock_entry_assignments_shared(
  p_actor_id uuid,
  p_acting_party_id uuid,
  p_entry_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $body$
declare
  resolved_person_id uuid;
begin
  if p_actor_id is null or p_acting_party_id is null or p_entry_id is null then
    return;
  end if;
  begin
    resolved_person_id := platform_private.identity_actor_person(p_actor_id);
  exception
    when others then
      resolved_person_id := null;
  end;
  if resolved_person_id is null then
    return;
  end if;
  perform 1
  from platform_private.cms_entry_assignments assignment
  where assignment.entry_id = p_entry_id
    and assignment.owner_id = p_acting_party_id
    and assignment.assignee_person_id = resolved_person_id
    and assignment.capability_key in ('cms.author', 'cms.editor')
  order by assignment.id
  for share;
end;
$body$;

comment on function platform_private.cms_lock_entry_assignments_shared(uuid, uuid, uuid) is
  'FOR SHARE on the server-resolved actor''s cms.author/cms.editor assignments over one entry (the assignment step of cms_lock_entry_authority), held to commit. Takes no person, tenure or grant row. Private.';

create or replace function platform_private.cms_lock_entry_authority(
  p_actor_id uuid,
  p_acting_party_id uuid,
  p_entry_id uuid
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
  exception
    when others then
      resolved_person_id := null;
  end;
  if resolved_person_id is null then
    -- No resolvable person has no authority; the capability check that follows
    -- refuses.
    return;
  end if;
  -- The revocation seams update exactly these rows (a grant, a tenure, an
  -- assignment) and then lock assignments and presence rows, so the share locks
  -- are taken in that order: person, tenure, grants, assignments.  No predicate
  -- narrows them: a row that is being revoked right now must be locked even though
  -- its committed state still proves authority.
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
    and actor_grant.capability_code in ('cms.author', 'cms.editor')
  order by actor_grant.capability_code
  for share;
  if p_entry_id is not null then
    perform platform_private.cms_lock_entry_assignments_shared(
      p_actor_id, p_acting_party_id, p_entry_id
    );
  end if;
end;
$body$;

create or replace function platform_private.cms_lock_relation_target(
  p_actor_id uuid,
  p_acting_party_id uuid,
  p_target_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $body$
begin
  -- The target entry row (version, lifecycle) and then the authority rows over the
  -- target (the caller's assignments on it), both FOR SHARE and held to commit.
  begin
    perform 1
    from platform_private.cms_content_entries target
    where target.id = p_target_id
    for share;
    -- Only the caller's assignments over the target: the caller's person, tenure and grant
    -- rows are already held since the command started (cms_require_entry_capability_locked),
    -- and rescanning them here, after the active version, would acquire authority rows late.
    perform platform_private.cms_lock_entry_assignments_shared(
      p_actor_id, p_acting_party_id, p_target_id
    );
  exception
    when deadlock_detected then
      raise exception 'CONFLICT' using errcode = 'P0001';
  end;
end;
$body$;

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_lock_entry_assignments_shared(uuid, uuid, uuid)
  owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_lock_entry_assignments_shared(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

commit;
