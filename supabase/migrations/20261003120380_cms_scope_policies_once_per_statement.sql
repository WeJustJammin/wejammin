-- SEC-2: evaluate the session scope once per statement, not once per row.
--
-- Once the policies bite (the definer role is not BYPASSRLS), a restrictive policy
-- that calls cms_session_scope_ok(owner_id, review_id) runs that plpgsql helper for
-- every row any statement of a CMS command reads or writes.  The activation-review
-- invalidation triggers fire per field row and scan the owner's reviews, so a
-- 128-field create called the helper thousands of times and its latency grew with
-- the owner's review count (the AC217 create budget is what caught it).
--
-- The decision a session can make does not depend on the row, only on which owners
-- and reviews the session reaches.  Three read-only lookups (owned by the
-- authority-reader role) now return exactly that, and the policies use them through
-- uncorrelated sub-selects, which PostgreSQL evaluates once per statement:
--   cms_session_owner_scope()     the acting party when the verified session is its
--                                 owner-receipt holder or holds cms.schema_designer /
--                                 cms.schema_registry.read there, else NULL;
--   cms_session_reviewer_scope()  the (owner, review) pairs of the session person's
--                                 effective review assignments;
--   cms_session_report_scope()    the dry-run reports of the owner scope.
-- A row is in scope when the verified service-role system scope applies, its owner
-- is the owner scope, or its (owner, review) pair is a reviewer pair: exactly the
-- decision of cms_session_scope_ok, which stays as the single-row oracle (the
-- behavioural test compares both on every table).  Writes are re-resolved by the
-- same expression in WITH CHECK.  Forward-only.
begin;

create function platform_private.cms_session_owner_scope()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  actor uuid := platform_private.cms_session_uuid('app.cms_session_actor');
  party uuid := platform_private.cms_session_uuid('app.cms_session_party');
  person uuid;
begin
  if actor is null or party is null then
    return null;
  end if;
  select person_row.party_id into person
    from platform_private.person_party person_row
   where person_row.auth_user_id = actor
     and person_row.account_state in (
       'claimed'::platform_private.person_account_state,
       'active'::platform_private.person_account_state);
  if person is null then
    return null;
  end if;
  if exists (
       select 1 from platform_private.cms_owner_initialization receipt
        where receipt.auth_user_id = actor and receipt.person_id = person
          and receipt.organization_id = party)
     or platform_private.cms_person_holds_capability(party, person, 'cms.schema_designer')
     or platform_private.cms_person_holds_capability(party, person, 'cms.schema_registry.read') then
    return party;
  end if;
  return null;
end;
$body$;

create function platform_private.cms_session_reviewer_scope()
returns table(owner_id uuid, review_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  actor uuid := platform_private.cms_session_uuid('app.cms_session_actor');
  party uuid := platform_private.cms_session_uuid('app.cms_session_party');
  person uuid;
begin
  if actor is null or party is null then
    return;
  end if;
  select person_row.party_id into person
    from platform_private.person_party person_row
   where person_row.auth_user_id = actor
     and person_row.account_state in (
       'claimed'::platform_private.person_account_state,
       'active'::platform_private.person_account_state);
  if person is null then
    return;
  end if;
  return query
    select assignment.owner_id, assignment.review_id
      from platform_private.cms_schema_review_assignments assignment
      join platform_private.cms_schema_reviews review on review.id = assignment.review_id
     where assignment.reviewer_person_ref = person
       and assignment.owner_id = review.owner_id
       and platform_private.cms_review_assignment_effective(
         assignment.state, assignment.starts_at, assignment.ends_at);
end;
$body$;

create function platform_private.cms_session_report_scope()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $body$
  select report.id
    from platform_private.cms_schema_dry_run_reports report
   where report.owner_id = platform_private.cms_session_owner_scope()
$body$;

revoke all on function
  platform_private.cms_session_owner_scope(),
  platform_private.cms_session_reviewer_scope(),
  platform_private.cms_session_report_scope()
  from public, anon, authenticated, service_role;
grant create on schema platform_private to wejammin_cms_authority_reader;
alter function platform_private.cms_session_owner_scope() owner to wejammin_cms_authority_reader;
alter function platform_private.cms_session_reviewer_scope() owner to wejammin_cms_authority_reader;
alter function platform_private.cms_session_report_scope() owner to wejammin_cms_authority_reader;
revoke create on schema platform_private from wejammin_cms_authority_reader;
grant execute on function
  platform_private.cms_session_owner_scope(),
  platform_private.cms_session_reviewer_scope(),
  platform_private.cms_session_report_scope()
  to wejammin_cms_definer;

-- Owner-and-review scoped tables.
alter policy cms_schema_reviews_session_scope on platform_private.cms_schema_reviews
  using (current_user = 'wejammin_cms_authority_reader'
         or (select platform_private.cms_session_system_scope())
         or owner_id = (select platform_private.cms_session_owner_scope())
         or (owner_id, id) in (select s.owner_id, s.review_id from platform_private.cms_session_reviewer_scope() s))
  with check (current_user = 'wejammin_cms_authority_reader'
         or (select platform_private.cms_session_system_scope())
         or owner_id = (select platform_private.cms_session_owner_scope())
         or (owner_id, id) in (select s.owner_id, s.review_id from platform_private.cms_session_reviewer_scope() s));
alter policy cms_schema_review_decisions_session_scope on platform_private.cms_schema_review_decisions
  using ((select platform_private.cms_session_system_scope())
         or owner_id = (select platform_private.cms_session_owner_scope())
         or (owner_id, review_id) in (select s.owner_id, s.review_id from platform_private.cms_session_reviewer_scope() s))
  with check ((select platform_private.cms_session_system_scope())
         or owner_id = (select platform_private.cms_session_owner_scope())
         or (owner_id, review_id) in (select s.owner_id, s.review_id from platform_private.cms_session_reviewer_scope() s));
alter policy cms_schema_review_assignments_session_scope on platform_private.cms_schema_review_assignments
  using (current_user = 'wejammin_cms_authority_reader'
         or (select platform_private.cms_session_system_scope())
         or owner_id = (select platform_private.cms_session_owner_scope())
         or (owner_id, review_id) in (select s.owner_id, s.review_id from platform_private.cms_session_reviewer_scope() s))
  with check (current_user = 'wejammin_cms_authority_reader'
         or (select platform_private.cms_session_system_scope())
         or owner_id = (select platform_private.cms_session_owner_scope())
         or (owner_id, review_id) in (select s.owner_id, s.review_id from platform_private.cms_session_reviewer_scope() s));

-- Owner scoped tables.
alter policy cms_schema_dry_run_reports_session_scope on platform_private.cms_schema_dry_run_reports
  using (current_user = 'wejammin_cms_authority_reader'
         or (select platform_private.cms_session_system_scope())
         or owner_id = (select platform_private.cms_session_owner_scope()))
  with check (current_user = 'wejammin_cms_authority_reader'
         or (select platform_private.cms_session_system_scope())
         or owner_id = (select platform_private.cms_session_owner_scope()));
alter policy cms_schema_migration_target_rows_session_scope on platform_private.cms_schema_migration_target_rows
  using ((select platform_private.cms_session_system_scope())
         or owner_id = (select platform_private.cms_session_owner_scope()))
  with check ((select platform_private.cms_session_system_scope())
         or owner_id = (select platform_private.cms_session_owner_scope()));
alter policy cms_schema_migration_plans_session_scope on platform_private.cms_schema_migration_plans
  using ((select platform_private.cms_session_system_scope())
         or owner_id = (select platform_private.cms_session_owner_scope()))
  with check ((select platform_private.cms_session_system_scope())
         or owner_id = (select platform_private.cms_session_owner_scope()));
alter policy cms_capability_grants_session_scope on platform_private.cms_capability_grants
  using ((select platform_private.cms_session_system_scope())
         or owner_id = (select platform_private.cms_session_owner_scope()))
  with check ((select platform_private.cms_session_system_scope())
         or owner_id = (select platform_private.cms_session_owner_scope()));
alter policy cms_capability_grant_events_session_scope on platform_private.cms_capability_grant_events
  using ((select platform_private.cms_session_system_scope())
         or owner_id = (select platform_private.cms_session_owner_scope()))
  with check ((select platform_private.cms_session_system_scope())
         or owner_id = (select platform_private.cms_session_owner_scope()));

-- Rows keyed by a dry-run report: the scope is the report's owner scope.
alter policy cms_schema_dry_run_row_evidence_session_scope on platform_private.cms_schema_dry_run_row_evidence
  using ((select platform_private.cms_session_system_scope())
         or report_id in (select platform_private.cms_session_report_scope()))
  with check ((select platform_private.cms_session_system_scope())
         or report_id in (select platform_private.cms_session_report_scope()));

commit;
