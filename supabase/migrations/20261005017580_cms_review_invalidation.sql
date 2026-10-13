-- Slice 11 shared helpers (lane S11-3s, BE03b "Review invalidation", "Preview token
-- and verification (CMS-03B-08, CMS-03B-19)", Write-path lock order rule 5/7;
-- tracker P2-S11-AC-111, AC-112, AC-113, AC-118): the review invalidation core, its
-- producers and the preview-token revocation primitives.
--
-- cms_invalidate_editorial_review(request)  the ONE invalidation core.  Request (server-built,
--   exact keys): { reviewId, reasonCode revision_superseded|dependency_changed|
--   reviewer_authority_changed|entry_unavailable, correlationId, actorId? (null = system) }.
--   Locks the review row FOR UPDATE (lock position 5); a review that is not open|approved is an
--   idempotent no-op.  Otherwise, in the caller's transaction: review -> invalidated (reason
--   stored, decided_at cleared, version + 1), the review's pending and failed_retryable schedules
--   -> cancelled (approval_invalidated, or entry_unavailable for that reason; version + 1; an
--   executing schedule is left to finish and re-read the approval), for entry_unavailable the
--   entry's unexpired active preview tokens -> revoked, and one audit row plus one
--   cms.entry.review-changed.v1 { reviewId, revisionId } at the new review version.  Result:
--   { reviewId, invalidated, cancelledSchedules, revokedPreviewTokens }.
-- cms_invalidate_reviews_for_person(person, capability)  the authority-loss entry point BE03b names:
--   invalidates (reviewer_authority_changed) every live review in which the person has a recorded
--   approve (for that slot capability when given) that no longer COUNTS (cms_editorial_review_
--   qualifying_decisions); returns the number transitioned; safe to repeat.
-- cms_revoke_active_preview_tokens(entry, person)  revokes (CAS: state revoked, revoked_at,
--   version + 1) the unexpired active tokens of an entry and/or a minting person.
-- cms_preview_scope_holds(person, party, entry, revision)  BE03b preview scope: entry assignee
--   (active cms.author/cms.editor assignment + the standing grant), active reviewer assignee of a
--   review of the revision (+ confirmed tenure), or owner-party cms.publisher.
-- cms_revoke_tokens_without_scope(party, person)  revokes the person's active tokens whose scope no
--   longer holds (the DEC-143 pattern, run in the transaction of the loss).
--
-- Producers wired here as NEW AFTER ROW triggers (no old migration is edited):
--   cms_entry_revisions            INSERT  -> older live reviews of the same entry and locale are
--                                  invalidated revision_superseded (the chain is per locale)
--   cms_content_entries            lifecycle leaves active -> live reviews invalidated entry_unavailable
--                                  and the entry's tokens revoked (also with no live review)
--   organization_actor_grant /
--   membership_tenure              UPDATE|DELETE -> cms_invalidate_reviews_for_person(person, null)
--                                  and cms_revoke_tokens_without_scope(party, person)
--   cms_entry_assignments /
--   cms_editorial_review_assignments  UPDATE|DELETE -> cms_revoke_tokens_without_scope
-- NOT wired (spec contradiction, see NOTES): the revocation of a counted approver's reviewer
-- assignment on an open review, which BE03b CMS-03B-18 defines as a recount without a review
-- version bump.  Lock order: every producer runs inside a command that already holds the earlier
-- positions; this migration takes review rows (5) in ascending id, then schedule and token rows (6).
-- Private; forward-only.
begin;

create or replace function platform_private.cms_trigger_correlation()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  configured text := pg_catalog.current_setting('app.correlation_id', true);
begin
  if configured ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return configured::uuid;
  end if;
  return extensions.gen_random_uuid();
end;
$body$;

comment on function platform_private.cms_trigger_correlation() is
  'Correlation id for a trigger-driven effect: the request correlation (app.correlation_id) when the session carries a valid one, else a fresh uuid. Private.';

create or replace function platform_private.cms_revoke_active_preview_tokens(
  p_entry_id uuid,
  p_person_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $body$
declare
  revoked_count integer;
begin
  if p_entry_id is null and p_person_id is null then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  with candidates as (
    select token.id
      from platform_private.cms_preview_tokens token
     where token.state = 'active'
       and token.expires_at > pg_catalog.clock_timestamp()
       and (p_entry_id is null or token.entry_id = p_entry_id)
       and (p_person_id is null or token.person_id = p_person_id)
     order by token.id
       for update
  ), revoked as (
    update platform_private.cms_preview_tokens token
       set state = 'revoked',
           revoked_at = pg_catalog.clock_timestamp(),
           version = token.version + 1,
           updated_at = pg_catalog.clock_timestamp()
      from candidates
     where token.id = candidates.id
    returning token.id
  )
  select pg_catalog.count(*)::integer into revoked_count from revoked;
  return revoked_count;
end;
$body$;

comment on function platform_private.cms_revoke_active_preview_tokens(uuid, uuid) is
  'BE03b: revokes (CAS: state revoked, revoked_at, version + 1) the unexpired active preview tokens of an entry and/or of a minting person; idempotent; returns the number revoked. Private.';

create or replace function platform_private.cms_preview_scope_holds(
  p_person_id uuid,
  p_acting_party_id uuid,
  p_entry_id uuid,
  p_revision_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $body$
  select p_person_id is not null and p_acting_party_id is not null
    and p_entry_id is not null and p_revision_id is not null
    and exists (
      select 1
        from platform_private.cms_entry_revisions revision
        join platform_private.cms_content_entries entry on entry.id = revision.entry_id
       where revision.id = p_revision_id
         and entry.id = p_entry_id
         and entry.owner_party_id = p_acting_party_id
    )
    and (
      exists (
        select 1
          from platform_private.cms_entry_assignments assignment
         where assignment.entry_id = p_entry_id
           and assignment.owner_id = p_acting_party_id
           and assignment.assignee_person_id = p_person_id
           and assignment.state = 'active'
           and assignment.capability_key in ('cms.author', 'cms.editor')
           and platform_private.cms_person_holds_capability(
             p_acting_party_id, p_person_id, assignment.capability_key
           )
      )
      or exists (
        select 1
          from platform_private.cms_editorial_review_assignments reviewer_assignment
          join platform_private.cms_editorial_reviews review on review.id = reviewer_assignment.review_id
          join identity_private.membership_tenure tenure
            on tenure.organization_id = p_acting_party_id and tenure.person_id = p_person_id
         where reviewer_assignment.reviewer_person_id = p_person_id
           and reviewer_assignment.state = 'active'
           and review.revision_id = p_revision_id
           and review.owner_id = p_acting_party_id
           and tenure.state = 'confirmed'
           and tenure.starts_on <= current_date
           and (tenure.ends_on is null or tenure.ends_on >= current_date)
      )
      or platform_private.cms_person_holds_capability(p_acting_party_id, p_person_id, 'cms.publisher')
    )
$body$;

comment on function platform_private.cms_preview_scope_holds(uuid, uuid, uuid, uuid) is
  'BE03b CMS-03B-08/19 preview scope of a person on a revision: entry assignee (active cms.author/cms.editor assignment with the standing grant), active reviewer assignee of a review of the revision (confirmed tenure), or owner-party cms.publisher. False for any null argument or a revision that is not of the entry. Private; STABLE.';

create or replace function platform_private.cms_revoke_tokens_without_scope(
  p_acting_party_id uuid,
  p_person_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $body$
declare
  revoked_count integer;
begin
  if p_acting_party_id is null or p_person_id is null then
    return 0;
  end if;
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  with candidates as (
    select token.id
      from platform_private.cms_preview_tokens token
     where token.owner_id = p_acting_party_id
       and token.person_id = p_person_id
       and token.state = 'active'
       and token.expires_at > pg_catalog.clock_timestamp()
       and not platform_private.cms_preview_scope_holds(
         p_person_id, p_acting_party_id, token.entry_id, token.revision_id
       )
     order by token.id
       for update
  ), revoked as (
    update platform_private.cms_preview_tokens token
       set state = 'revoked',
           revoked_at = pg_catalog.clock_timestamp(),
           version = token.version + 1,
           updated_at = pg_catalog.clock_timestamp()
      from candidates
     where token.id = candidates.id
    returning token.id
  )
  select pg_catalog.count(*)::integer into revoked_count from revoked;
  return revoked_count;
end;
$body$;

comment on function platform_private.cms_revoke_tokens_without_scope(uuid, uuid) is
  'BE03b (DEC-143 pattern): revokes the person''s unexpired active preview tokens in the party whose preview scope no longer holds; run in the transaction of the authority loss. Returns the number revoked. Private.';

create or replace function platform_private.cms_invalidate_editorial_review(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  review_row platform_private.cms_editorial_reviews%rowtype;
  reason text;
  actor uuid;
  correlation uuid;
  schedule_reason text;
  cancelled integer := 0;
  revoked integer := 0;
  next_version bigint;
begin
  if p_request is null or pg_catalog.jsonb_typeof(p_request) is distinct from 'object'
     or not platform_private.cms_exact_keys(
       p_request,
       array['reviewId', 'reasonCode', 'correlationId']::text[],
       array['reviewId', 'reasonCode', 'correlationId', 'actorId']::text[]
     )
     or pg_catalog.jsonb_typeof(p_request->'reviewId') is distinct from 'string'
     or not platform_private.cms_valid_uuid(p_request->>'reviewId')
     or pg_catalog.jsonb_typeof(p_request->'reasonCode') is distinct from 'string'
     or (p_request->>'reasonCode') not in
        ('revision_superseded', 'dependency_changed', 'reviewer_authority_changed', 'entry_unavailable')
     or pg_catalog.jsonb_typeof(p_request->'correlationId') is distinct from 'string'
     or not platform_private.cms_valid_uuid(p_request->>'correlationId')
     or (p_request ? 'actorId' and p_request->'actorId' <> 'null'::jsonb
         and (pg_catalog.jsonb_typeof(p_request->'actorId') is distinct from 'string'
              or not platform_private.cms_valid_uuid(p_request->>'actorId'))) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  reason := p_request->>'reasonCode';
  correlation := (p_request->>'correlationId')::uuid;
  if p_request ? 'actorId' and p_request->'actorId' <> 'null'::jsonb then
    actor := (p_request->>'actorId')::uuid;
  end if;
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);

  select review.* into review_row
    from platform_private.cms_editorial_reviews review
   where review.id = (p_request->>'reviewId')::uuid
     for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if review_row.state not in ('open', 'approved') then
    return pg_catalog.jsonb_build_object(
      'reviewId', review_row.id, 'invalidated', false,
      'cancelledSchedules', 0, 'revokedPreviewTokens', 0
    );
  end if;

  next_version := review_row.version + 1;
  update platform_private.cms_editorial_reviews review
     set state = 'invalidated',
         invalidated_reason = reason,
         decided_at = null,
         version = next_version,
         updated_at = pg_catalog.clock_timestamp()
   where review.id = review_row.id;

  schedule_reason := case when reason = 'entry_unavailable' then 'entry_unavailable' else 'approval_invalidated' end;
  with candidates as (
    select schedule.id
      from platform_private.cms_publication_schedules schedule
     where schedule.review_id = review_row.id
       and schedule.state in ('pending', 'failed_retryable')
     order by schedule.id
       for update
  ), cancelled_rows as (
    update platform_private.cms_publication_schedules schedule
       set state = 'cancelled',
           reason_code = schedule_reason,
           next_attempt_at = null,
           version = schedule.version + 1,
           updated_at = pg_catalog.clock_timestamp()
      from candidates
     where schedule.id = candidates.id
    returning schedule.id
  )
  select pg_catalog.count(*)::integer into cancelled from cancelled_rows;

  if reason = 'entry_unavailable' then
    revoked := platform_private.cms_revoke_active_preview_tokens(review_row.entry_id, null);
  end if;

  perform platform_private.cms_emit_event(
    'cms.entry.review.invalidate', actor, review_row.owner_id,
    'cms_editorial_review', review_row.id, 'CMS_REVIEW_INVALIDATED',
    'cms.entry.review-changed.v1', 'cms_editorial_review', review_row.id, next_version,
    pg_catalog.jsonb_build_object('reviewId', review_row.id, 'revisionId', review_row.revision_id),
    correlation
  );
  return pg_catalog.jsonb_build_object(
    'reviewId', review_row.id, 'invalidated', true,
    'cancelledSchedules', cancelled, 'revokedPreviewTokens', revoked
  );
end;
$body$;

comment on function platform_private.cms_invalidate_editorial_review(jsonb) is
  'BE03b "Review invalidation": the one core. A live review (open|approved) -> invalidated with a closed reason under CAS, its pending|failed_retryable schedules -> cancelled, for entry_unavailable the entry''s unexpired preview tokens revoked, audit + one cms.entry.review-changed.v1; a review that is not live is an idempotent no-op. Private.';

create or replace function platform_private.cms_invalidate_reviews_for_person(
  p_person_id uuid,
  p_capability text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $body$
declare
  candidate record;
  transitioned integer := 0;
  correlation uuid := platform_private.cms_trigger_correlation();
begin
  if p_person_id is null then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  for candidate in
    select distinct review.id
      from platform_private.cms_editorial_decisions decision
      join platform_private.cms_editorial_reviews review on review.id = decision.review_id
     where decision.reviewer_person_id = p_person_id
       and decision.decision = 'approve'
       and (p_capability is null or decision.capability = p_capability)
       and review.state in ('open', 'approved')
       and not exists (
         select 1
           from platform_private.cms_editorial_review_qualifying_decisions(review.id) qualifying
          where qualifying.decision_id = decision.id
       )
     order by review.id
  loop
    if (platform_private.cms_invalidate_editorial_review(pg_catalog.jsonb_build_object(
          'reviewId', candidate.id, 'reasonCode', 'reviewer_authority_changed',
          'correlationId', correlation
        ))->>'invalidated')::boolean then
      transitioned := transitioned + 1;
    end if;
  end loop;
  return transitioned;
end;
$body$;

comment on function platform_private.cms_invalidate_reviews_for_person(uuid, text) is
  'BE03b "Review invalidation": invalidates (reviewer_authority_changed) every live review in which the person has a recorded approve (for the slot capability when given) that no longer counts; returns the number transitioned; idempotent. Called by the authority-loss triggers and by CMS-03A-17. Private.';

-- ---- producers ---------------------------------------------------------------
create or replace function platform_private.cms_review_invalidation_revision_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $body$
declare
  candidate record;
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  correlation uuid := platform_private.cms_trigger_correlation();
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  for candidate in
    select review.id
      from platform_private.cms_editorial_reviews review
      join platform_private.cms_entry_revisions older on older.id = review.revision_id
     where review.entry_id = new.entry_id
       and review.state in ('open', 'approved')
       and older.locale = new.locale
       and older.revision_number < new.revision_number
     order by review.id
  loop
    perform platform_private.cms_invalidate_editorial_review(pg_catalog.jsonb_build_object(
      'reviewId', candidate.id, 'reasonCode', 'revision_superseded', 'correlationId', correlation
    ));
  end loop;
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return null;
end;
$body$;

create or replace function platform_private.cms_review_invalidation_entry_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $body$
declare
  candidate record;
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  correlation uuid := platform_private.cms_trigger_correlation();
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  for candidate in
    select review.id
      from platform_private.cms_editorial_reviews review
     where review.entry_id = new.id
       and review.state in ('open', 'approved')
     order by review.id
  loop
    perform platform_private.cms_invalidate_editorial_review(pg_catalog.jsonb_build_object(
      'reviewId', candidate.id, 'reasonCode', 'entry_unavailable', 'correlationId', correlation
    ));
  end loop;
  perform platform_private.cms_revoke_active_preview_tokens(new.id, null);
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return null;
end;
$body$;

create or replace function platform_private.cms_review_authority_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  perform platform_private.cms_invalidate_reviews_for_person(old.person_id, null);
  perform platform_private.cms_revoke_tokens_without_scope(old.organization_id, old.person_id);
  if tg_op = 'UPDATE'
     and (new.organization_id, new.person_id) is distinct from (old.organization_id, old.person_id) then
    perform platform_private.cms_invalidate_reviews_for_person(new.person_id, null);
    perform platform_private.cms_revoke_tokens_without_scope(new.organization_id, new.person_id);
  end if;
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return null;
end;
$body$;

create or replace function platform_private.cms_preview_scope_entry_assignment_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  perform platform_private.cms_revoke_tokens_without_scope(old.owner_id, old.assignee_person_id);
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return null;
end;
$body$;

create or replace function platform_private.cms_preview_scope_review_assignment_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  perform platform_private.cms_revoke_tokens_without_scope(old.owner_id, old.reviewer_person_id);
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return null;
end;
$body$;

comment on function platform_private.cms_review_invalidation_revision_trigger() is
  'AFTER INSERT on cms_entry_revisions: every live review of an older revision of the same entry and locale becomes invalidated revision_superseded in the appending transaction (BE03b Review invalidation).';
comment on function platform_private.cms_review_invalidation_entry_trigger() is
  'AFTER UPDATE of lifecycle on cms_content_entries when the entry leaves active: its live reviews become invalidated entry_unavailable and its unexpired preview tokens are revoked (BE03b Review invalidation).';
comment on function platform_private.cms_review_authority_trigger() is
  'AFTER UPDATE|DELETE on the actor grant and the membership tenure: a counted approver who no longer qualifies invalidates the reviews they counted in (reviewer_authority_changed) and the person''s tokens that lost preview scope are revoked, in the transaction of the loss.';

drop trigger if exists cms_entry_revisions_review_invalidation on platform_private.cms_entry_revisions;
create trigger cms_entry_revisions_review_invalidation
after insert on platform_private.cms_entry_revisions
for each row execute function platform_private.cms_review_invalidation_revision_trigger();

drop trigger if exists cms_content_entries_review_invalidation on platform_private.cms_content_entries;
create trigger cms_content_entries_review_invalidation
after update of lifecycle on platform_private.cms_content_entries
for each row
when (old.lifecycle = 'active' and new.lifecycle is distinct from 'active')
execute function platform_private.cms_review_invalidation_entry_trigger();

drop trigger if exists cms_organization_actor_grant_review_authority on identity_private.organization_actor_grant;
create trigger cms_organization_actor_grant_review_authority
after update or delete on identity_private.organization_actor_grant
for each row execute function platform_private.cms_review_authority_trigger();

drop trigger if exists cms_membership_tenure_review_authority on identity_private.membership_tenure;
create trigger cms_membership_tenure_review_authority
after update or delete on identity_private.membership_tenure
for each row execute function platform_private.cms_review_authority_trigger();

drop trigger if exists cms_entry_assignments_preview_scope on platform_private.cms_entry_assignments;
create trigger cms_entry_assignments_preview_scope
after update or delete on platform_private.cms_entry_assignments
for each row execute function platform_private.cms_preview_scope_entry_assignment_trigger();

drop trigger if exists cms_editorial_review_assignments_preview_scope on platform_private.cms_editorial_review_assignments;
create trigger cms_editorial_review_assignments_preview_scope
after update or delete on platform_private.cms_editorial_review_assignments
for each row execute function platform_private.cms_preview_scope_review_assignment_trigger();

grant select on table
  identity_private.membership_tenure,
  platform_private.cms_editorial_decisions,
  platform_private.cms_editorial_review_assignments,
  platform_private.cms_entry_assignments,
  platform_private.cms_entry_revisions,
  platform_private.cms_content_entries
  to wejammin_cms_definer;
grant select, update on table
  platform_private.cms_editorial_reviews,
  platform_private.cms_preview_tokens,
  platform_private.cms_publication_schedules
  to wejammin_cms_definer;

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_trigger_correlation() owner to wejammin_cms_definer;
alter function platform_private.cms_revoke_active_preview_tokens(uuid, uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_preview_scope_holds(uuid, uuid, uuid, uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_revoke_tokens_without_scope(uuid, uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_invalidate_editorial_review(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_invalidate_reviews_for_person(uuid, text) owner to wejammin_cms_definer;
alter function platform_private.cms_review_invalidation_revision_trigger() owner to wejammin_cms_definer;
alter function platform_private.cms_review_invalidation_entry_trigger() owner to wejammin_cms_definer;
alter function platform_private.cms_review_authority_trigger() owner to wejammin_cms_definer;
alter function platform_private.cms_preview_scope_entry_assignment_trigger() owner to wejammin_cms_definer;
alter function platform_private.cms_preview_scope_review_assignment_trigger() owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_trigger_correlation() from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_revoke_active_preview_tokens(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_preview_scope_holds(uuid, uuid, uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_revoke_tokens_without_scope(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_invalidate_editorial_review(jsonb) from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_invalidate_reviews_for_person(uuid, text) from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_review_invalidation_revision_trigger() from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_review_invalidation_entry_trigger() from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_review_authority_trigger() from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_preview_scope_entry_assignment_trigger() from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_preview_scope_review_assignment_trigger() from public, anon, authenticated, service_role;

commit;
