-- Slice 11 lane preview-projection, BE03b E3 "Publication lineage" + BE04c "PostgreSQL model registry"
-- (ProjectionConsumerState); tracker P2-S11-AC-116: PublicationResource.projectionState "is read from Shard 04's
-- projection_consumer_state for the row id" instead of being the literal `pending` (DEC-158(e) fixed it at
-- `pending` only because no Shard 04 consumer table existed; this creates it).
--
-- BE04c section implemented: "Database Schema / PostgreSQL model registry", the `ProjectionConsumerState`
-- (`projection_consumer_state`) row, plus its "State machines, concurrency, and transaction rules" vocabulary
-- (building -> ready | blocked | failed_retryable -> active -> superseded | revoked).  Columns, checks, unique
-- key, indexes and the RLS posture are exactly the registry row:
--   id uuid PK; publication_id uuid NOT NULL FK publication.id; projection_id uuid NOT NULL FK PublicationProjection.id;
--   consumer text NOT NULL CHECK IN (route, render, menu, media, search, sitemap, cache, social);
--   expected_version bigint NOT NULL CHECK > 0; state text NOT NULL CHECK IN (building, ready, blocked,
--   failed_retryable, active, superseded, revoked); attempts integer NOT NULL DEFAULT 0 CHECK >= 0;
--   last_error_code varchar(96) NULL; updated_at timestamptz NOT NULL; version bigint NOT NULL CHECK > 0.
--   Unique (publication_id, projection_id, consumer); indexes (publication_id, state), (consumer, state, updated_at).
--   RLS: the delivery principal and the redacted publisher diagnostics; public clients cannot read.
--
-- Two mappings are stated here because BE04c names the target in its own vocabulary:
--   * publication.id is the PUBLICATION VERSION ROW: platform_private.cms_publication_versions(id).  BE03b reads the
--     state "for the row id" and the change event carries that id as publicationVersionId.
--   * the private-schema home and the RPC-context RLS posture follow every other CMS table (forced RLS, the one
--     policy cms_rpc_context_valid(), no API-role grant, the cms_write_guard trigger).  The "delivery principal" and
--     the "redacted publisher diagnostics" reach the table only through definer RPCs (DEC-156: the Worker service
--     credential at the module boundary); this migration grants the CMS definer SELECT only.  Every write belongs to
--     the Shard 04 delivery RPCs (Slice 15), which add their own INSERT/UPDATE grants.
--
-- BOUNDARY: projection_id is BE04c's FK to PublicationProjection (publication_projection), whose own FK is
-- delivery.route_manifest_version, a BE04a table that no specification defines beyond its name and the IA deep dive's
-- column list.  Neither table exists, so projection_id is a typed uuid with no constraint until the migration that
-- creates publication_projection adds it:
--   ALTER TABLE platform_private.projection_consumer_state ADD CONSTRAINT projection_consumer_state_projection_fk
--     FOREIGN KEY (projection_id) REFERENCES <publication_projection>(id);
-- TRACKING: #127 (Slice 13 P2-S13-AC-164; named source schemas PublicationProjection and ProjectionConsumerState).
-- SENTINEL: supabase/tests/phase_02_slice_11_projection_state.sql ("BOUNDARY sentinel") fails the day that
-- constraint lands.
--
-- platform_private.cms_publication_projection_state(publication version id) is the one derivation (see its comment):
-- degraded / converged / pending from the newest row of each of the eight registered consumers.  It is a read and
-- never touches canonical state.  Forward-only.
begin;

set local lock_timeout = '5s';

create table platform_private.projection_consumer_state (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null,
  projection_id uuid not null,
  consumer text not null,
  expected_version bigint not null,
  state text not null,
  attempts integer not null default 0,
  last_error_code varchar(96) null,
  updated_at timestamptz not null,
  version bigint not null,
  constraint projection_consumer_state_publication_fk
    foreign key (publication_id) references platform_private.cms_publication_versions (id),
  constraint projection_consumer_state_consumer_check
    check (consumer in ('route', 'render', 'menu', 'media', 'search', 'sitemap', 'cache', 'social')),
  constraint projection_consumer_state_expected_version_check
    check (expected_version > 0),
  constraint projection_consumer_state_state_check
    check (state in ('building', 'ready', 'blocked', 'failed_retryable', 'active', 'superseded', 'revoked')),
  constraint projection_consumer_state_attempts_check
    check (attempts >= 0),
  constraint projection_consumer_state_version_check
    check (version > 0),
  constraint projection_consumer_state_identity_unique
    unique (publication_id, projection_id, consumer)
);

create index projection_consumer_state_publication_state_idx
  on platform_private.projection_consumer_state (publication_id, state);
create index projection_consumer_state_consumer_state_updated_idx
  on platform_private.projection_consumer_state (consumer, state, updated_at);

create trigger projection_consumer_state_write_guard
before insert or update or delete on platform_private.projection_consumer_state
for each row execute function platform_private.cms_write_guard();

alter table platform_private.projection_consumer_state enable row level security;
alter table platform_private.projection_consumer_state force row level security;
revoke all on table platform_private.projection_consumer_state
  from public, anon, authenticated, service_role;
create policy projection_consumer_state_rpc_policy
  on platform_private.projection_consumer_state
  for all to public
  using (platform_private.cms_rpc_context_valid())
  with check (platform_private.cms_rpc_context_valid());

-- The derivation.  The registered consumers are the eight members of the table's consumer check.  A consumer
-- REPORTS the row when it has a row for it; only its NEWEST row counts (updated_at, then row version, then id),
-- so a consumer that recovered, or that failed after converging, is judged by where it is now.
--   degraded   a registered consumer's newest row is `blocked`: BE04c retries a `failed_retryable` consumer
--              (attempts counted in the row) and pages after dead-letter, so `blocked` is the terminal state;
--   converged  every registered consumer's newest row is `active`, `superseded` or `revoked` (past the pointer
--              switch);
--   pending    otherwise: no consumer has reported, or one is missing, building, ready or retrying.
-- It needs a CMS RPC context (the table's only policy): outside one it refuses instead of answering a false pending.
create or replace function platform_private.cms_publication_projection_state(p_publication_version_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  registered constant text[] := array['route', 'render', 'menu', 'media', 'search', 'sitemap', 'cache', 'social'];
  past_switch constant text[] := array['active', 'superseded', 'revoked'];
  blocked_count integer;
  settled_count integer;
begin
  if p_publication_version_id is null then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if not platform_private.cms_rpc_context_valid() then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  select pg_catalog.count(*) filter (where newest.state = 'blocked'),
         pg_catalog.count(*) filter (where newest.state = any (past_switch))
    into blocked_count, settled_count
    from (
      select distinct on (consumer_row.consumer) consumer_row.consumer, consumer_row.state
        from platform_private.projection_consumer_state consumer_row
       where consumer_row.publication_id = p_publication_version_id
         and consumer_row.consumer = any (registered)
       order by consumer_row.consumer, consumer_row.updated_at desc, consumer_row.version desc, consumer_row.id desc
    ) newest;
  if blocked_count > 0 then
    return 'degraded';
  end if;
  if settled_count = pg_catalog.cardinality(registered) then
    return 'converged';
  end if;
  return 'pending';
end;
$body$;

comment on function platform_private.cms_publication_projection_state(uuid) is
  'BE03b E3 / BE04c ProjectionConsumerState: the projectionState of one publication version row: degraded when a registered consumer''s newest row is blocked, converged when every one of the eight registered consumers'' newest row is active, superseded or revoked, else pending. A read; never changes canonical state. Needs a CMS RPC context. Private.';

grant select on table platform_private.projection_consumer_state to wejammin_cms_definer;
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_publication_projection_state(uuid) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_publication_projection_state(uuid)
  from public, anon, authenticated, service_role;

commit;
