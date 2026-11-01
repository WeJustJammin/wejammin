-- Slice 11 predicate RLS (BE03b "Permission, RLS and grants": "RLS predicates use verified session, acting
-- party, relationship/assignment, capability ..." and "positive/negative RLS tests"; tracker P2-S11-AC-007,
-- AC-013, AC-019, AC-025, AC-031, AC-119; review finding A-M2): the nine Slice 11 tables of BE03b (and the DEC-159
-- accessibility audit summary the same commands write) carried exactly one policy each, the CMS RPC-context gate
-- `using (platform_private.cms_rpc_context_valid())`.  That gate proves a transaction is inside a named CMS RPC,
-- never WHO is calling.  This migration adds, to every one of those tables and IN ADDITION TO the gate
-- (restrictive policies AND with it; the gate is never replaced), the same kind of verified-session predicate the
-- Slice 09 tables carry since 20261002192000 (BE03a AC181).  projection_consumer_state (BE04c, no tenant column, no
-- writer yet) is left to the Slice 15 consumer that will own it.
--
-- THE SESSION.  Every human CMS command resolves its caller through platform_private.cms_acting_party(), which
-- publishes the verified actor (auth user) and acting party in the transaction-local settings
-- app.cms_session_actor / app.cms_session_party (20261002192000).  The predicate never trusts those two ids: it
-- re-resolves, on every statement, the live person and the confirmed, unexpired membership tenure of that
-- person in that party (platform_private.cms_entry_tenant_visible), so a forged setting reaches no more than the
-- scope of a real, currently authorized member of the acting party.
--
-- THE PREDICATES (evaluated once per statement through uncorrelated sub-selects, the 20261003120380 pattern):
--   tenant   a row is in scope iff its owner_id is the acting party of a published session whose actor is a live
--            member of that party.  A transaction with NO published session (the service paths: the scheduled
--            sweep, the dependency recheck, the preview verifier and the takedown, migrations, the identity
--            triggers of a non-CMS command) is admitted by the RPC-context gate alone, exactly as before; a
--            session published for only one of the two settings, or by a non-member, or for another party, sees
--            and writes nothing.
--   person   (INSERT only) the row names the session person where the row's writer is exclusive: a review's
--            submitted_by, a decision's reviewer_person_id, an assignment's grantor_person_id, a schedule's
--            created_by, a preview token's person_id.  A command can no longer write a row on behalf of another
--            person, whatever its own checks concluded.
--   owner    (INSERT and UPDATE of the reviewer assignments) the session holds the immutable owner
--            initialization receipt of the acting party: CMS-03B-18 is owner-only and no other command writes an
--            assignment.
--   system   the preflight registry is a code-owned, release-seeded registry: every session reads it (the gate
--            admits it); its writes need the Slice 09 system scope (no human session published, verified
--            service-role JWT).  No command writes it.
--
-- WHAT THE ROW PREDICATES DO NOT DO, ON PURPOSE.  BE03b says EditorialReview SELECT "requires one of the five
-- scopes" (owner, submitter, reviewer assignee, entry assignee, owner-party publisher).  That relationship
-- filter stays in the SECURITY DEFINER read and command bodies (cms_editorial_review_scopes,
-- cms_workflow_read_scopes), where it selects 404 versus 403 and is proven per role by their suites.  It is NOT
-- a row predicate, because the same rows are read and written by definer code under a session that holds none
-- of the five scopes: the qualifying-decision recount a decision or an invalidation runs, the review and
-- schedule invalidation the entry-revision, entry-lifecycle and authority-loss triggers run in the transaction
-- of whoever changed the entry or the grant, the preview-token revocation of those same triggers.  A relationship
-- filter on SELECT would silently hide a review from the very statement that must invalidate it (an UPDATE that
-- matches no visible row is not an error), which would let an approval survive a changed dependency.  The
-- tenant predicate and the person/owner write predicates are the strongest row predicates every definer path
-- satisfies by construction.
--
-- The helpers read no Slice 11 table (they read the identity authority tables through the existing
-- cms_entry_tenant_visible / identity_actor_person / cms_owner_initialization), so a policy never recurses.
-- They are STABLE SECURITY DEFINER functions of the CMS definer role with an empty search_path and no API-role
-- EXECUTE.  Forward-only.
begin;

set local lock_timeout = '5s';

create or replace function platform_private.cms_s11_session_unbound()
returns boolean
language sql
stable
security definer
set search_path = ''
as $body$
  select nullif(pg_catalog.current_setting('app.cms_session_actor', true), '') is null
     and nullif(pg_catalog.current_setting('app.cms_session_party', true), '') is null
$body$;

comment on function platform_private.cms_s11_session_unbound() is
  'Slice 11 predicate RLS: true when NO human CMS session is published in this transaction (both app.cms_session_actor and app.cms_session_party are unset or empty): a service or system path, admitted by the CMS RPC-context gate alone. A half-published or malformed session is NOT unbound. Private; STABLE.';

create or replace function platform_private.cms_s11_session_owner()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  actor uuid := platform_private.cms_session_uuid('app.cms_session_actor');
  party uuid := platform_private.cms_session_uuid('app.cms_session_party');
begin
  if actor is null or party is null then
    return null;
  end if;
  -- The published ids are never trusted: the actor must be a live member of the party it acts in.
  if not platform_private.cms_entry_tenant_visible(actor, party) then
    return null;
  end if;
  return party;
end;
$body$;

comment on function platform_private.cms_s11_session_owner() is
  'Slice 11 predicate RLS: the acting party of the published CMS session when its actor is, right now, a live (claimed or active) person with a confirmed, unexpired membership tenure in that party; otherwise NULL (no row is in scope). Private; STABLE.';

create or replace function platform_private.cms_s11_session_person()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  actor uuid := platform_private.cms_session_uuid('app.cms_session_actor');
  person uuid;
begin
  if actor is null or platform_private.cms_s11_session_owner() is null then
    return null;
  end if;
  begin
    person := platform_private.identity_actor_person(actor);
  exception when others then
    return null;
  end;
  return person;
end;
$body$;

comment on function platform_private.cms_s11_session_person() is
  'Slice 11 predicate RLS: the person of the published CMS session actor when cms_s11_session_owner() holds, else NULL. The attribution an exclusive-writer INSERT must carry. Private; STABLE.';

create or replace function platform_private.cms_s11_session_is_owner()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  actor uuid := platform_private.cms_session_uuid('app.cms_session_actor');
  party uuid := platform_private.cms_session_uuid('app.cms_session_party');
  person uuid := platform_private.cms_s11_session_person();
begin
  if actor is null or party is null or person is null then
    return false;
  end if;
  return exists (
    select 1
      from platform_private.cms_owner_initialization receipt
     where receipt.auth_user_id = actor
       and receipt.person_id = person
       and receipt.organization_id = party
  );
end;
$body$;

comment on function platform_private.cms_s11_session_is_owner() is
  'Slice 11 predicate RLS: true when the published CMS session actor is a live member of the acting party AND holds the immutable owner initialization receipt of that party (the receipt-derived owner of BE03b "Review scopes"). Private; STABLE.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_s11_session_unbound() owner to wejammin_cms_definer;
alter function platform_private.cms_s11_session_owner() owner to wejammin_cms_definer;
alter function platform_private.cms_s11_session_person() owner to wejammin_cms_definer;
alter function platform_private.cms_s11_session_is_owner() owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function
  platform_private.cms_s11_session_unbound(),
  platform_private.cms_s11_session_owner(),
  platform_private.cms_s11_session_person(),
  platform_private.cms_s11_session_is_owner()
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------- tenant --
-- RESTRICTIVE, FOR ALL: they AND with the existing <table>_rpc_policy gate and also bind the new row of every
-- INSERT and UPDATE (WITH CHECK), so a row can neither be read nor written outside the session's party.
create policy cms_editorial_reviews_session_scope on platform_private.cms_editorial_reviews
  as restrictive for all to public
  using ((select platform_private.cms_s11_session_unbound())
         or owner_id = (select platform_private.cms_s11_session_owner()))
  with check ((select platform_private.cms_s11_session_unbound())
         or owner_id = (select platform_private.cms_s11_session_owner()));
create policy cms_editorial_review_assignments_session_scope on platform_private.cms_editorial_review_assignments
  as restrictive for all to public
  using ((select platform_private.cms_s11_session_unbound())
         or owner_id = (select platform_private.cms_s11_session_owner()))
  with check ((select platform_private.cms_s11_session_unbound())
         or owner_id = (select platform_private.cms_s11_session_owner()));
create policy cms_editorial_decisions_session_scope on platform_private.cms_editorial_decisions
  as restrictive for all to public
  using ((select platform_private.cms_s11_session_unbound())
         or owner_id = (select platform_private.cms_s11_session_owner()))
  with check ((select platform_private.cms_s11_session_unbound())
         or owner_id = (select platform_private.cms_s11_session_owner()));
create policy cms_editorial_review_dependencies_session_scope on platform_private.cms_editorial_review_dependencies
  as restrictive for all to public
  using ((select platform_private.cms_s11_session_unbound())
         or owner_id = (select platform_private.cms_s11_session_owner()))
  with check ((select platform_private.cms_s11_session_unbound())
         or owner_id = (select platform_private.cms_s11_session_owner()));
create policy cms_publication_settings_snapshots_session_scope on platform_private.cms_publication_settings_snapshots
  as restrictive for all to public
  using ((select platform_private.cms_s11_session_unbound())
         or owner_id = (select platform_private.cms_s11_session_owner()))
  with check ((select platform_private.cms_s11_session_unbound())
         or owner_id = (select platform_private.cms_s11_session_owner()));
create policy cms_publication_schedules_session_scope on platform_private.cms_publication_schedules
  as restrictive for all to public
  using ((select platform_private.cms_s11_session_unbound())
         or owner_id = (select platform_private.cms_s11_session_owner()))
  with check ((select platform_private.cms_s11_session_unbound())
         or owner_id = (select platform_private.cms_s11_session_owner()));
create policy cms_publication_versions_session_scope on platform_private.cms_publication_versions
  as restrictive for all to public
  using ((select platform_private.cms_s11_session_unbound())
         or owner_id = (select platform_private.cms_s11_session_owner()))
  with check ((select platform_private.cms_s11_session_unbound())
         or owner_id = (select platform_private.cms_s11_session_owner()));
create policy cms_preview_tokens_session_scope on platform_private.cms_preview_tokens
  as restrictive for all to public
  using ((select platform_private.cms_s11_session_unbound())
         or owner_id = (select platform_private.cms_s11_session_owner()))
  with check ((select platform_private.cms_s11_session_unbound())
         or owner_id = (select platform_private.cms_s11_session_owner()));
-- The accessibility audit summary (DEC-159 (5)) is written by the same commands (CMS-03B-05, -07, -09, -20).
create policy cms_command_accessibility_evidence_session_scope on platform_private.cms_command_accessibility_evidence
  as restrictive for all to public
  using ((select platform_private.cms_s11_session_unbound())
         or owner_id = (select platform_private.cms_s11_session_owner()))
  with check ((select platform_private.cms_s11_session_unbound())
         or owner_id = (select platform_private.cms_s11_session_owner()));

-- ---------------------------------------------------------------------------------------------- person --
-- INSERT only: the exclusive writer of each row attributes it to the session person.
create policy cms_editorial_reviews_session_submitter on platform_private.cms_editorial_reviews
  as restrictive for insert to public
  with check ((select platform_private.cms_s11_session_unbound())
              or submitted_by = (select platform_private.cms_s11_session_person()));
create policy cms_editorial_decisions_session_decider on platform_private.cms_editorial_decisions
  as restrictive for insert to public
  with check ((select platform_private.cms_s11_session_unbound())
              or reviewer_person_id = (select platform_private.cms_s11_session_person()));
create policy cms_publication_schedules_session_creator on platform_private.cms_publication_schedules
  as restrictive for insert to public
  with check ((select platform_private.cms_s11_session_unbound())
              or created_by = (select platform_private.cms_s11_session_person()));
create policy cms_preview_tokens_session_minter on platform_private.cms_preview_tokens
  as restrictive for insert to public
  with check ((select platform_private.cms_s11_session_unbound())
              or person_id = (select platform_private.cms_s11_session_person()));

-- ----------------------------------------------------------------------------------------------- owner --
-- CMS-03B-18 is owner-only and no other command writes an assignment: the grantor is the session person and
-- holds the owner receipt on create; a revoke (the only UPDATE) needs the owner receipt.
create policy cms_editorial_review_assignments_session_grantor on platform_private.cms_editorial_review_assignments
  as restrictive for insert to public
  with check ((select platform_private.cms_s11_session_unbound())
              or (grantor_person_id = (select platform_private.cms_s11_session_person())
                  and (select platform_private.cms_s11_session_is_owner())));
create policy cms_editorial_review_assignments_session_owner_update on platform_private.cms_editorial_review_assignments
  as restrictive for update to public
  using ((select platform_private.cms_s11_session_unbound())
         or (select platform_private.cms_s11_session_is_owner()))
  with check ((select platform_private.cms_s11_session_unbound())
         or (select platform_private.cms_s11_session_is_owner()));

-- ----------------------------------------------------------------------------------------------- system --
-- The release-seeded registry: readable under the gate by every session, written only under the system scope.
create policy cms_preflight_registry_session_scope_insert on platform_private.cms_preflight_registry
  as restrictive for insert to public
  with check ((select platform_private.cms_session_scope_ok_system()));
create policy cms_preflight_registry_session_scope_update on platform_private.cms_preflight_registry
  as restrictive for update to public
  using ((select platform_private.cms_session_scope_ok_system()))
  with check ((select platform_private.cms_session_scope_ok_system()));
create policy cms_preflight_registry_session_scope_delete on platform_private.cms_preflight_registry
  as restrictive for delete to public
  using ((select platform_private.cms_session_scope_ok_system()));

commit;
