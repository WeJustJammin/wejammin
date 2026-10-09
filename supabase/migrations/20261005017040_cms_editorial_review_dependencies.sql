-- Slice 11 data model (BE03b Database Schema "ReviewDependency", Review
-- invalidation "Dependency recheck"; tracker P2-S11-AC-113): the immutable index
-- of the identities frozen into a review's dependency manifest, selected by
-- (kind, ref_id) when a schema, template, pattern, taxonomy, localization or
-- block event enqueues the cms.review.dependency_recheck job.
--
-- Rows are written only by the submission transaction, from the frozen manifest
-- (a `settings` row names the snapshot id, a `schema` row the schema version id),
-- are version 1 forever, persist after invalidation as history, and are never
-- updated or deleted.  The insert guard accepts a row only while its review is
-- still open at its submission version, so a later command cannot widen the index
-- of a review that has moved on.  The function is SECURITY INVOKER.
-- Forward-only.
begin;

set local lock_timeout = '5s';

create table platform_private.cms_editorial_review_dependencies (
  id uuid not null default extensions.gen_random_uuid() primary key,
  owner_id uuid not null,
  state text not null,
  version bigint not null default 1,
  review_id uuid not null
    references platform_private.cms_editorial_reviews(id),
  kind text not null,
  ref_id uuid not null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint cms_editorial_review_dependencies_state_check
    check (state = 'active'),
  constraint cms_editorial_review_dependencies_version_check
    check (version = 1 and version > 0),
  constraint cms_editorial_review_dependencies_kind_check check (
    kind in (
      'schema', 'template', 'block', 'pattern', 'term', 'taxonomy_version',
      'locale_source', 'relation_target', 'settings'
    )
  ),
  constraint cms_editorial_review_dependencies_time_check
    check (updated_at = created_at),
  constraint cms_editorial_review_dependencies_review_owner_fkey
    foreign key (review_id, owner_id)
    references platform_private.cms_editorial_reviews(id, owner_id),
  constraint cms_editorial_review_dependencies_review_kind_ref_key
    unique (review_id, kind, ref_id)
);

create index cms_editorial_review_dependencies_kind_ref_idx
  on platform_private.cms_editorial_review_dependencies (kind, ref_id);
create index cms_editorial_review_dependencies_review_idx
  on platform_private.cms_editorial_review_dependencies (review_id);

create or replace function platform_private.cms_review_dependency_guard()
returns trigger
language plpgsql
set search_path = ''
as $body$
declare
  review_state text;
  review_version bigint;
begin
  select review_row.state, review_row.version
    into review_state, review_version
    from platform_private.cms_editorial_reviews review_row
   where review_row.id = new.review_id
     for share;
  if not found then
    -- The foreign key reports the absent review.
    return new;
  end if;
  if review_state <> 'open' or review_version <> 1 then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  return new;
end;
$body$;

create trigger cms_editorial_review_dependencies_write_guard
before insert on platform_private.cms_editorial_review_dependencies
for each row execute function platform_private.cms_write_guard();
create trigger cms_editorial_review_dependencies_z_review_guard
before insert on platform_private.cms_editorial_review_dependencies
for each row execute function platform_private.cms_review_dependency_guard();
create trigger cms_editorial_review_dependencies_immutable_guard
before update or delete on platform_private.cms_editorial_review_dependencies
for each row execute function platform_private.cms_immutable_guard();

alter table platform_private.cms_editorial_review_dependencies enable row level security;
alter table platform_private.cms_editorial_review_dependencies force row level security;
revoke all on table platform_private.cms_editorial_review_dependencies
  from public, anon, authenticated, service_role;
create policy cms_editorial_review_dependencies_rpc_policy
  on platform_private.cms_editorial_review_dependencies
  for all to public
  using (platform_private.cms_rpc_context_valid())
  with check (platform_private.cms_rpc_context_valid());

revoke all on function platform_private.cms_review_dependency_guard()
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
alter function platform_private.cms_review_dependency_guard() owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;

commit;
