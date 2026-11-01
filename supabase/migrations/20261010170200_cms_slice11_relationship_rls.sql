-- Slice 11 predicate RLS, part two: the RELATIONSHIP / ASSIGNMENT / CAPABILITY predicates on SELECT (BE03b "Permission,
-- RLS and grants": "EditorialReview SELECT requires one of the five scopes ...; EditorialDecision SELECT returns only safe
-- decision metadata to eligible participants ...; EditorialReviewAssignment SELECT is available only through the review
-- projection, the owner receives the assignment summaries and an assigned reviewer receives only the own assignment's id
-- and end ...; PreviewToken is never directly selectable"; "RLS predicates use verified session, acting party,
-- relationship/assignment, capability, risk, lifecycle, locale, and target authorization"; tracker P2-S11-AC-007, AC-013,
-- AC-019, AC-025, AC-031, AC-119; review finding A-M2; orchestrator ruling 2026-10-11).  20261010169000 added the tenant
-- (verified session party) and the exclusive-writer predicates; this migration adds the missing relationship scope to
-- every SELECT, so that a row read directly under a verified session is exactly a row the read RPCs would show that
-- session.  The tenant policies and the RPC-context gate stay (restrictive policies AND with them).
--
-- THE RELATIONSHIP, per table (a restrictive FOR SELECT policy named <table>_session_relationship):
--   cms_editorial_reviews               one of the five review scopes of CMS-03B-16 (owner receipt, submitter, non-revoked
--                                       reviewer assignee, entry assignee, owner-party publisher): the SAME function the
--                                       RPC uses (cms_editorial_review_scopes), so the row filter cannot drift from the 403
--   cms_editorial_decisions             the decision's review is readable (safe decision metadata to eligible participants;
--   cms_editorial_review_dependencies   the decider-only `reason` is a column of the projection, not a row predicate)
--   cms_editorial_review_assignments    the owner (all assignment summaries) and the assigned reviewer (its own assignment
--                                       while it is not revoked)
--   cms_publication_schedules           a workflow read scope of CMS-03B-15 on the schedule's revision (entry assignee,
--                                       owner-party publisher, active reviewer assignee of a review of the revision) over
--                                       an entry that is active or held: the SAME function the RPC uses
--                                       (cms_workflow_read_scopes)
--   cms_publication_versions            the same workflow read scope on the row's entry (a reviewer assigned to a review of
--                                       ANY revision of the entry, as CMS-03B-15 serves the entry's publications)
--   cms_command_accessibility_evidence  the same workflow read scope on the summary's revision
--   cms_publication_settings_snapshots  a workflow participant of the acting party (the owner, a holder of the standing
--                                       cms.author / cms.editor / cms.publisher / cms.reviewer capability, or a non-revoked
--                                       reviewer assignee of any review): the snapshot is party-level evidence of the
--                                       settings version a manifest names, with no entry or review of its own
--   cms_preview_tokens                  nobody: a preview token is never directly selectable (the open recheck is the
--                                       definer verifier of CMS-03B-19)
-- A transaction with NO published session (the service paths) is admitted by the gate and the tenant policy alone, as
-- before, except for tokens.  The code-owned preflight registry has no relationship (every gated session reads it).
--
-- WHO THE RELATIONSHIP BINDS.  Every policy admits the CMS definer role (`current_user` = wejammin_cms_definer, which is
-- the owner of every SECURITY DEFINER body) without the relationship test and holds it to the tenant policy only.  This is
-- not a convenience: those bodies are the authority that DECIDES 404 versus 403 (they must read a review the caller holds
-- no scope on to answer 403 instead of a concealed 404, BE03b CMS-03B-16) and they run the cascades in the transaction
-- of whoever caused them - the qualifying-decision recount, the review and schedule invalidation the entry-revision,
-- entry-lifecycle and authority-loss triggers fire under a session that holds no scope on the review, the preview-token
-- revocation, the schedule sweep.  PostgreSQL applies a SELECT policy to every UPDATE or DELETE that reads a column, and
-- an UPDATE that matches no visible row is not an error: a relationship filter on the definer would let an approval
-- survive a changed dependency.  The predicates bind every other role that is ever granted a table (the table ACL today is
-- the platform owner, which bypasses row-level security, and the definer): any future grantee, and the probe role of the
-- positive / negative tests, reads exactly what the RPCs would show it.  The test file proves both halves.
--
-- The helpers read the identity authority tables and, through the two existing scope functions, the Slice 11 tables AS THE
-- DEFINER (exempt from the relationship predicate, tenant-scoped), so a policy never recurses.  They are STABLE SECURITY
-- DEFINER functions of the CMS definer role with an empty search_path and no API-role EXECUTE.  Forward-only.
begin;

set local lock_timeout = '5s';

create or replace function platform_private.cms_s11_review_readable(p_review_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  actor uuid := platform_private.cms_session_uuid('app.cms_session_actor');
  party uuid := platform_private.cms_s11_session_owner();
begin
  if actor is null or party is null or p_review_id is null then
    return false;
  end if;
  return pg_catalog.cardinality(platform_private.cms_editorial_review_scopes(p_review_id, actor, party)) > 0;
end;
$body$;

comment on function platform_private.cms_s11_review_readable(uuid) is
  'Slice 11 relationship RLS: true when the published CMS session actor, a live member of the acting party, holds at least one of the five review scopes (owner, submitter, reviewer, assignee, publisher) on the review - the verdict cms_editorial_review_scopes gives the CMS-03B-16 read. Private; STABLE.';

create or replace function platform_private.cms_s11_assignment_readable(p_reviewer_person_id uuid, p_state text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $body$
begin
  -- The owner receives the assignment summaries; an assigned reviewer receives only its own assignment, while it is
  -- not revoked (BE03b "Review scopes": a reviewer may read for as long as the assignment is not revoked).
  return platform_private.cms_s11_session_is_owner()
      or (p_state is distinct from 'revoked'
          and p_reviewer_person_id is not null
          and p_reviewer_person_id = platform_private.cms_s11_session_person());
end;
$body$;

comment on function platform_private.cms_s11_assignment_readable(uuid, text) is
  'Slice 11 relationship RLS: true for the owner of the acting party (every assignment) and for the assigned reviewer (its own assignment while not revoked). Private; STABLE.';

create or replace function platform_private.cms_s11_workflow_readable(p_entry_id uuid, p_revision_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  actor uuid := platform_private.cms_session_uuid('app.cms_session_actor');
  party uuid := platform_private.cms_s11_session_owner();
  target_entry uuid := p_entry_id;
  person uuid;
begin
  if actor is null or party is null then
    return false;
  end if;
  if target_entry is null and p_revision_id is not null then
    select revision_item.entry_id into target_entry
      from platform_private.cms_entry_revisions revision_item
     where revision_item.id = p_revision_id;
  end if;
  if target_entry is null then
    return false;
  end if;
  -- CMS-03B-15 conceals an entry of another party and one that is neither active nor held.
  if not exists (
    select 1 from platform_private.cms_content_entries entry_item
     where entry_item.id = target_entry
       and entry_item.owner_party_id = party
       and entry_item.lifecycle in ('active', 'held')
  ) then
    return false;
  end if;
  if pg_catalog.cardinality(platform_private.cms_workflow_read_scopes(actor, party, target_entry, p_revision_id)) > 0 then
    return true;
  end if;
  if p_revision_id is null then
    -- An entry-level row (a publication): CMS-03B-15 serves the entry's publications to a reviewer assigned to a review
    -- of the revision it reads, i.e. of any revision of the entry.
    begin
      person := platform_private.identity_actor_person(actor);
    exception when others then
      return false;
    end;
    return exists (
      select 1
        from platform_private.cms_editorial_review_assignments assignment_item
        join platform_private.cms_editorial_reviews review_item on review_item.id = assignment_item.review_id
       where assignment_item.reviewer_person_id = person
         and assignment_item.state = 'active'
         and review_item.entry_id = target_entry
         and review_item.owner_id = party
    );
  end if;
  return false;
end;
$body$;

comment on function platform_private.cms_s11_workflow_readable(uuid, uuid) is
  'Slice 11 relationship RLS: true when the published CMS session actor holds a CMS-03B-15 workflow read scope (entry assignee, owner-party publisher, active reviewer assignee) on the entry (derived from the revision when the entry is null) and revision, over an entry of the acting party that is active or held; with a null revision the reviewer scope is any review of the entry. The verdict cms_workflow_read_scopes gives the read. Private; STABLE.';

create or replace function platform_private.cms_s11_snapshot_readable()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  party uuid := platform_private.cms_s11_session_owner();
  person uuid := platform_private.cms_s11_session_person();
begin
  if party is null or person is null then
    return false;
  end if;
  return platform_private.cms_s11_session_is_owner()
      or platform_private.cms_person_holds_capability(party, person, 'cms.author')
      or platform_private.cms_person_holds_capability(party, person, 'cms.editor')
      or platform_private.cms_person_holds_capability(party, person, 'cms.publisher')
      or platform_private.cms_person_holds_capability(party, person, 'cms.reviewer')
      or exists (
        select 1 from platform_private.cms_editorial_review_assignments assignment_item
         where assignment_item.owner_id = party
           and assignment_item.reviewer_person_id = person
           and assignment_item.state <> 'revoked'
      );
end;
$body$;

comment on function platform_private.cms_s11_snapshot_readable() is
  'Slice 11 relationship RLS: true for a workflow participant of the acting party - the owner, a holder of the standing cms.author, cms.editor, cms.publisher or cms.reviewer capability, or a non-revoked reviewer assignee - the readers of party-level settings-snapshot evidence. Private; STABLE.';

create or replace function platform_private.cms_s11_token_readable()
returns boolean
language sql
stable
security definer
set search_path = ''
as $body$
  select false
$body$;

comment on function platform_private.cms_s11_token_readable() is
  'Slice 11 relationship RLS: a PreviewToken is never directly selectable (BE03b "Permission, RLS and grants"); the open recheck is the definer verifier cms_verify_preview_token (CMS-03B-19). Always false. Private; STABLE.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_s11_review_readable(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_s11_assignment_readable(uuid, text) owner to wejammin_cms_definer;
alter function platform_private.cms_s11_workflow_readable(uuid, uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_s11_snapshot_readable() owner to wejammin_cms_definer;
alter function platform_private.cms_s11_token_readable() owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function
  platform_private.cms_s11_review_readable(uuid),
  platform_private.cms_s11_assignment_readable(uuid, text),
  platform_private.cms_s11_workflow_readable(uuid, uuid),
  platform_private.cms_s11_snapshot_readable(),
  platform_private.cms_s11_token_readable()
  from public, anon, authenticated, service_role;

-- ----------------------------------------------------------------------------------------------- policies --
-- RESTRICTIVE, FOR SELECT only: they AND with the RPC-context gate and the tenant policy.  `case` fixes the order, so the
-- definer role never evaluates a relationship helper (no recursion through the scope functions it owns).
create policy cms_editorial_reviews_session_relationship on platform_private.cms_editorial_reviews
  as restrictive for select to public
  using (case when current_user = 'wejammin_cms_definer' then true
              else (select platform_private.cms_s11_session_unbound())
                   or platform_private.cms_s11_review_readable(id) end);
create policy cms_editorial_decisions_session_relationship on platform_private.cms_editorial_decisions
  as restrictive for select to public
  using (case when current_user = 'wejammin_cms_definer' then true
              else (select platform_private.cms_s11_session_unbound())
                   or platform_private.cms_s11_review_readable(review_id) end);
create policy cms_editorial_review_dependencies_session_relationship on platform_private.cms_editorial_review_dependencies
  as restrictive for select to public
  using (case when current_user = 'wejammin_cms_definer' then true
              else (select platform_private.cms_s11_session_unbound())
                   or platform_private.cms_s11_review_readable(review_id) end);
create policy cms_editorial_review_assignments_session_relationship on platform_private.cms_editorial_review_assignments
  as restrictive for select to public
  using (case when current_user = 'wejammin_cms_definer' then true
              else (select platform_private.cms_s11_session_unbound())
                   or platform_private.cms_s11_assignment_readable(reviewer_person_id, state) end);
create policy cms_publication_schedules_session_relationship on platform_private.cms_publication_schedules
  as restrictive for select to public
  using (case when current_user = 'wejammin_cms_definer' then true
              else (select platform_private.cms_s11_session_unbound())
                   or platform_private.cms_s11_workflow_readable(entry_id, revision_id) end);
create policy cms_publication_versions_session_relationship on platform_private.cms_publication_versions
  as restrictive for select to public
  using (case when current_user = 'wejammin_cms_definer' then true
              else (select platform_private.cms_s11_session_unbound())
                   or platform_private.cms_s11_workflow_readable(entry_id, null::uuid) end);
create policy cms_command_accessibility_evidence_session_relationship on platform_private.cms_command_accessibility_evidence
  as restrictive for select to public
  using (case when current_user = 'wejammin_cms_definer' then true
              else (select platform_private.cms_s11_session_unbound())
                   or platform_private.cms_s11_workflow_readable(null::uuid, revision_id) end);
create policy cms_publication_settings_snapshots_session_relationship on platform_private.cms_publication_settings_snapshots
  as restrictive for select to public
  using (case when current_user = 'wejammin_cms_definer' then true
              else (select platform_private.cms_s11_session_unbound())
                   or (select platform_private.cms_s11_snapshot_readable()) end);
-- A preview token is never directly selectable: not by its minter, the owner, the publisher, or a service path.
create policy cms_preview_tokens_session_relationship on platform_private.cms_preview_tokens
  as restrictive for select to public
  using (case when current_user = 'wejammin_cms_definer' then true
              else (select platform_private.cms_s11_token_readable()) end);

commit;
