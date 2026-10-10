-- Slice 11 data model (BE03b Database Schema "EditorialReviewAssignment",
-- Review scopes and reviewer assignment, DEC-136; tracker P2-S11-AC-119): the
-- private bounded reviewer assignment of one open editorial review.
--
-- An assignment is an access window, never a qualification: it confers only
-- `read` and `decide` on one frozen review (capability_key and actions are
-- fixed), lasts at most seven days, cannot be delegated and is created and
-- revoked only by the named assignment RPC (Slice 11 lane 3).  The qualification
-- to be counted comes from standing grants, not from this row.
--
-- The guard is defence in depth under that RPC: a row is created active at
-- version 1 on an OPEN review for a reviewer who is neither the review submitter
-- nor the revision author, with at most sixteen active assignments per review;
-- afterwards only active -> revoked (CAS version + 1, updated_at STRICTLY later than
-- the previous instant: the revoke advances `version` and `updated_at`, P2-S11-AC-119)
-- is possible, nothing else moves, and a row is never deleted.  The count and eligibility
-- reads take the review row lock (FOR UPDATE), the first lock of the review
-- position of the global order (BE03b "Write-path lock order"), so concurrent
-- assignments to one review serialize.  The function is SECURITY INVOKER.
-- Forward-only.
begin;

set local lock_timeout = '5s';

create table platform_private.cms_editorial_review_assignments (
  id uuid not null default extensions.gen_random_uuid() primary key,
  owner_id uuid not null,
  review_id uuid not null
    references platform_private.cms_editorial_reviews(id),
  reviewer_person_id uuid not null
    references platform_private.person_party(party_id),
  grantor_person_id uuid not null
    references platform_private.person_party(party_id),
  capability_key text not null,
  actions text[] not null,
  state text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text null,
  version bigint not null default 1,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint cms_editorial_review_assignments_capability_check
    check (capability_key = 'cms.editorial_review'),
  constraint cms_editorial_review_assignments_actions_check
    check (actions = array['read', 'decide']::text[]),
  constraint cms_editorial_review_assignments_state_check
    check (state in ('active', 'revoked')),
  constraint cms_editorial_review_assignments_reason_check
    check (reason is null or pg_catalog.octet_length(reason) between 1 and 256),
  constraint cms_editorial_review_assignments_version_check check (version > 0),
  constraint cms_editorial_review_assignments_window_check
    check (ends_at > starts_at),
  constraint cms_editorial_review_assignments_ceiling_check
    check (ends_at <= starts_at + interval '7 days'),
  constraint cms_editorial_review_assignments_review_owner_fkey
    foreign key (review_id, owner_id)
    references platform_private.cms_editorial_reviews(id, owner_id),
  -- A decision names (assignment, review, reviewer) as one key, so it can only
  -- reference the assignment of its own reviewer on its own review.
  constraint cms_editorial_review_assignments_id_review_reviewer_key
    unique (id, review_id, reviewer_person_id)
);

create unique index cms_editorial_review_assignments_active_reviewer_unique
  on platform_private.cms_editorial_review_assignments (review_id, reviewer_person_id)
  where state = 'active';
create index cms_editorial_review_assignments_review_reviewer_state_idx
  on platform_private.cms_editorial_review_assignments (review_id, reviewer_person_id, state);
create index cms_editorial_review_assignments_reviewer_state_ends_idx
  on platform_private.cms_editorial_review_assignments (reviewer_person_id, state, ends_at);
create index cms_editorial_review_assignments_owner_state_ends_idx
  on platform_private.cms_editorial_review_assignments (owner_id, state, ends_at);

create or replace function platform_private.cms_review_assignment_guard()
returns trigger
language plpgsql
set search_path = ''
as $body$
declare
  review_state text;
  review_submitter uuid;
  revision_author uuid;
  active_count integer;
begin
  if tg_op = 'DELETE' then
    raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' then
    -- The reviewer, grantor, scope, window, reason and creation never change;
    -- only state, version and updated_at move, and only active -> revoked; the revoke
    -- advances the CAS version by one and updated_at strictly past the previous instant.
    if (pg_catalog.to_jsonb(new) - 'state' - 'version' - 'updated_at')
       is distinct from
       (pg_catalog.to_jsonb(old) - 'state' - 'version' - 'updated_at') then
      raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
    end if;
    if old.state <> 'active'
       or new.state <> 'revoked'
       or new.version <> old.version + 1
       or new.updated_at <= old.updated_at then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if new.state <> 'active' or new.version <> 1 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  select review_row.state, review_row.submitted_by, revision_row.author_person_id
    into review_state, review_submitter, revision_author
    from platform_private.cms_editorial_reviews review_row
    join platform_private.cms_entry_revisions revision_row
      on revision_row.id = review_row.revision_id
   where review_row.id = new.review_id
     for update of review_row;
  if not found then
    -- The foreign key reports the absent review.
    return new;
  end if;
  if review_state <> 'open' then
    raise exception 'review_not_open' using errcode = 'P0001';
  end if;
  if new.reviewer_person_id = review_submitter
     or new.reviewer_person_id = revision_author then
    raise exception 'reviewer_not_eligible' using errcode = 'P0001';
  end if;
  select pg_catalog.count(*) into active_count
    from platform_private.cms_editorial_review_assignments assignment_row
   where assignment_row.review_id = new.review_id
     and assignment_row.state = 'active'
     and assignment_row.ends_at > new.starts_at;
  if active_count >= 16 then
    raise exception 'assignment_limit' using errcode = 'P0001';
  end if;
  return new;
end;
$body$;

create trigger cms_editorial_review_assignments_write_guard
before insert or update or delete on platform_private.cms_editorial_review_assignments
for each row execute function platform_private.cms_write_guard();
create trigger cms_editorial_review_assignments_z_state_guard
before insert or update or delete on platform_private.cms_editorial_review_assignments
for each row execute function platform_private.cms_review_assignment_guard();

alter table platform_private.cms_editorial_review_assignments enable row level security;
alter table platform_private.cms_editorial_review_assignments force row level security;
revoke all on table platform_private.cms_editorial_review_assignments
  from public, anon, authenticated, service_role;
create policy cms_editorial_review_assignments_rpc_policy
  on platform_private.cms_editorial_review_assignments
  for all to public
  using (platform_private.cms_rpc_context_valid())
  with check (platform_private.cms_rpc_context_valid());

revoke all on function platform_private.cms_review_assignment_guard()
  from public, anon, authenticated, service_role;

-- SEC-2: a function whose body names a forced-RLS CMS table is owned by the
-- NOLOGIN, non-BYPASSRLS definer role (the catalog guard in
-- supabase/tests/phase_02_slice_09_sec2_definer_rls.sql derives the set from the
-- live bodies), exactly as the Slice 09 schema-review guards are.  ALTER FUNCTION
-- ... OWNER TO needs CREATE on the function's schema for the new owner, held for
-- this transaction only.  The guard stays SECURITY INVOKER: it runs with the
-- privileges of the calling role, so the definer functions that write the table
-- (Slice 11 command migrations) are the ones that hold the table verbs.
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_review_assignment_guard() owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;

commit;
