-- Slice 11 shared helpers (lane S11-3s, BE03b "Derived revision workflow state
-- (E2)"; tracker P2-S11-AC-085): the ONE derivation of EntryRevisionState.
--
-- The persisted cms_entry_revisions row is an immutable snapshot whose physical
-- `state` is the constant `draft` (20261005017000); every browser-visible state is
-- derived here from committed evidence, first match wins:
--
--   1 published  a cms_publication_versions row with action = 'publish' references the
--                revision (whether that publication is still the live head is carried by
--                the lineage, never by the revision: a revoked lineage stays `published`)
--   2 scheduled  a cms_publication_schedules row of the revision has action = 'publish'
--                and state pending | executing | failed_retryable
--   3 approved   the latest review of the revision (greatest submitted_at, then id) is approved
--   4 rejected   the latest review is rejected
--   5 submitted  the latest review is open
--   6 draft      otherwise: no review, or the latest review is invalidated
--
-- Only an effective `draft` revision may be submitted; a `rejected` one is terminal.
-- The set form is the batch primitive the entry/revision list reads adopt (one row
-- per distinct existing revision id, at most 1000 ids per call; an absent id yields
-- no row, so the helper conceals nothing).  Both forms are STABLE reads of
-- cms_editorial_reviews(revision_id, submitted_at, id), cms_publication_schedules
-- (revision_id, state) and cms_publication_versions(revision_id) through their
-- indexes, and the single place a future workflow stage is added.  The single form
-- answers NULL for an absent or null revision.  Forward-only.
begin;

create or replace function platform_private.cms_revision_effective_states(
  p_revision_ids uuid[]
)
returns table(revision_id uuid, state text)
language plpgsql
stable
security definer
set search_path = ''
as $body$
begin
  if p_revision_ids is not null and pg_catalog.cardinality(p_revision_ids) > 1000 then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  return query
  select revision.id,
         case
           when exists (
             select 1
               from platform_private.cms_publication_versions publication
              where publication.revision_id = revision.id
                and publication.action = 'publish'
           ) then 'published'
           when exists (
             select 1
               from platform_private.cms_publication_schedules schedule
              where schedule.revision_id = revision.id
                and schedule.action = 'publish'
                and schedule.state in ('pending', 'executing', 'failed_retryable')
           ) then 'scheduled'
           else coalesce((
             select case latest.state
                      when 'approved' then 'approved'
                      when 'rejected' then 'rejected'
                      when 'open' then 'submitted'
                      else 'draft'
                    end
               from platform_private.cms_editorial_reviews latest
              where latest.revision_id = revision.id
              order by latest.submitted_at desc, latest.id desc
              limit 1
           ), 'draft')
         end
    from platform_private.cms_entry_revisions revision
   where revision.id = any (coalesce(p_revision_ids, array[]::uuid[]))
   order by revision.id;
end;
$body$;

comment on function platform_private.cms_revision_effective_states(uuid[]) is
  'BE03b E2: derived EntryRevisionState (published, scheduled, approved, rejected, submitted, draft; first match wins) for up to 1000 revisions; one row per distinct existing id. Private; STABLE.';

create or replace function platform_private.cms_revision_effective_state(
  p_revision_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $body$
  select effective.state
    from platform_private.cms_revision_effective_states(array[p_revision_id]) effective
$body$;

comment on function platform_private.cms_revision_effective_state(uuid) is
  'BE03b E2: the derived EntryRevisionState of one revision (NULL for an absent or null id). Private; STABLE.';

grant select on table
  platform_private.cms_editorial_reviews,
  platform_private.cms_entry_revisions,
  platform_private.cms_publication_schedules,
  platform_private.cms_publication_versions
  to wejammin_cms_definer;

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_revision_effective_states(uuid[])
  owner to wejammin_cms_definer;
alter function platform_private.cms_revision_effective_state(uuid)
  owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_revision_effective_states(uuid[])
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_revision_effective_state(uuid)
  from public, anon, authenticated, service_role;

commit;
