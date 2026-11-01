-- Slice 11 lane preview-projection: platform_private.projection_consumer_state (BE04c "PostgreSQL model
-- registry", ProjectionConsumerState) and platform_private.cms_publication_projection_state(publication
-- version id), the derivation of PublicationResource.projectionState that BE03b E3 reads "from Shard 04's
-- projection_consumer_state for the row id" (tracker P2-S11-AC-116; DEC-158(e)).  The derived value is
--   degraded   when a registered consumer's newest row is `blocked` (the terminal state: BE04c retries a
--              `failed_retryable` consumer and pages after dead-letter),
--   converged  when every one of the eight registered consumers' newest row is `active`, `superseded` or
--              `revoked` (the states after the pointer switch), else
--   pending    (no consumer has reported, or some consumer is still building, ready, retrying or missing),
-- and it is a read: it never touches canonical state.  RED before 20261010165000 (table + function) and
-- 20261010165100 (the lineage append and the workflow read call it).
--
-- TRACKING: #127
-- BOUNDARY: projection_id keeps no foreign key until publication_projection exists (BE04c names it,
-- BE04a's delivery.route_manifest_version, which it references, is defined nowhere; Slice 13 P2-S13-AC-164).
-- The sentinel assertion below fails the day that constraint lands, so this test is replaced with it.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(53);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/001-world.sqlinc
\ir phase_02_slice_11_helpers/002-reviews.sqlinc

select pg_temp.h11r_member('reviewer01', array['cms.reviewer']);

\ir phase_02_slice_11_helpers/004-lineage.sqlinc

-- ---------------------------------------------------------------------------
-- The table is exactly the BE04c ProjectionConsumerState (minus the one boundary below).
-- ---------------------------------------------------------------------------
select ok(to_regclass('platform_private.projection_consumer_state') is not null,
  'projection_consumer_state exists in the private schema [P2-S11-AC-116]');
select is(
  (select string_agg(a.attname || ':' || format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull::text || ':'
                     || coalesce(pg_get_expr(d.adbin, d.adrelid), '-'), ',' order by a.attnum)
     from pg_attribute a
     left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
    where a.attrelid = to_regclass('platform_private.projection_consumer_state') and a.attnum > 0 and not a.attisdropped),
  'id:uuid:true:gen_random_uuid(),publication_id:uuid:true:-,projection_id:uuid:true:-,consumer:text:true:-,expected_version:bigint:true:-,state:text:true:-,attempts:integer:true:0,last_error_code:character varying(96):false:-,updated_at:timestamp with time zone:true:-,version:bigint:true:-',
  'the columns are the BE04c ten: id, publication_id, projection_id, consumer, expected_version, state, attempts (default 0), last_error_code varchar(96) null, updated_at, version [P2-S11-AC-116]');
select is(
  (select string_agg(c.conname || ':' || c.contype::text, ',' order by c.conname)
     from pg_constraint c where c.conrelid = to_regclass('platform_private.projection_consumer_state')),
  'projection_consumer_state_attempts_check:c,projection_consumer_state_consumer_check:c,projection_consumer_state_expected_version_check:c,projection_consumer_state_identity_unique:u,projection_consumer_state_pkey:p,projection_consumer_state_publication_fk:f,projection_consumer_state_state_check:c,projection_consumer_state_version_check:c',
  'the constraints are the primary key, the five checks, the unique (publication_id, projection_id, consumer) and the publication foreign key [P2-S11-AC-116]');
select is(
  (select string_agg(i.indexname || ':' || regexp_replace(i.indexdef, '^.* USING btree ', ''), ',' order by i.indexname)
     from pg_indexes i where i.schemaname = 'platform_private' and i.tablename = 'projection_consumer_state'),
  'projection_consumer_state_consumer_state_updated_idx:(consumer, state, updated_at),projection_consumer_state_identity_unique:(publication_id, projection_id, consumer),projection_consumer_state_pkey:(id),projection_consumer_state_publication_state_idx:(publication_id, state)',
  'the indexes are (publication_id, state), (consumer, state, updated_at) and the unique identity [P2-S11-AC-116]');
select is(
  (select pg_get_constraintdef(c.oid) from pg_constraint c
    where c.conrelid = to_regclass('platform_private.projection_consumer_state') and c.conname = 'projection_consumer_state_publication_fk'),
  'FOREIGN KEY (publication_id) REFERENCES platform_private.cms_publication_versions(id)',
  'publication_id references the publication version row (BE04c publication.id; BE03b reads the state for the row id) [P2-S11-AC-116]');
select is(
  (select case when to_regclass('platform_private.projection_consumer_state') is null then -1 else
            (select count(*)::integer from pg_constraint c
              where c.conrelid = to_regclass('platform_private.projection_consumer_state') and c.contype = 'f'
                and (select a.attnum from pg_attribute a where a.attrelid = c.conrelid and a.attname = 'projection_id') = any (c.conkey))
          end),
  0,
  'BOUNDARY sentinel: projection_id has no foreign key yet (publication_projection and delivery.route_manifest_version are not defined anywhere); replace this with the constraint test when the delivery slice creates them [P2-S11-AC-116]');

-- RLS posture and grants: private, forced RLS, RPC-only writes, no API role.
select is(pg_temp.s11_rls_forced('platform_private.projection_consumer_state'), true,
  'row-level security is enabled and forced [P2-S11-AC-116]');
select is(pg_temp.s11_api_privileges('platform_private.projection_consumer_state'), '',
  'anon, authenticated and service_role hold no privilege on the table: public clients cannot read it [P2-S11-AC-116]');
select ok(
  not exists (select 1 from pg_class c, aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) acl
               where c.oid = to_regclass('platform_private.projection_consumer_state') and acl.grantee = 0),
  'PUBLIC holds no privilege on the table [P2-S11-AC-116]');
select is(pg_temp.s11_policies('platform_private.projection_consumer_state'), 'projection_consumer_state_rpc_policy',
  'one policy admits a row only inside a verified CMS RPC context [P2-S11-AC-116]');
select is(pg_temp.s11_triggers('platform_private.projection_consumer_state'), 'projection_consumer_state_write_guard:cms_write_guard:31',
  'every write passes the RPC-context write guard [P2-S11-AC-116]');
select ok(
  has_table_privilege('wejammin_cms_definer', 'platform_private.projection_consumer_state', 'SELECT')
    and not has_table_privilege('wejammin_cms_definer', 'platform_private.projection_consumer_state', 'INSERT')
    and not has_table_privilege('wejammin_cms_definer', 'platform_private.projection_consumer_state', 'UPDATE')
    and not has_table_privilege('wejammin_cms_definer', 'platform_private.projection_consumer_state', 'DELETE'),
  'the CMS definer can read the table and nothing else: Shard 04 delivery owns every write [P2-S11-AC-116]');

-- ---------------------------------------------------------------------------
-- Ten publication rows and the rows the constraints are exercised on.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.q_pub(p_n integer)
returns uuid language sql immutable as $body$
  select ('a9500000-0000-4000-8000-' || lpad(p_n::text, 12, '0'))::uuid
$body$;
select pg_temp.h11r_raw_insert('platform_private.cms_publication_versions', pg_temp.s11_publication_row(jsonb_build_object(
  'id', pg_temp.q_pub(n), 'publication_id', pg_temp.q_pub(n),
  'audience', 'ps' || lpad(n::text, 2, '0'), 'publication_hash', pg_temp.s11_hex('ps-' || n))))
  from generate_series(1, 10) n;

create or replace function pg_temp.q_row(
  p_pub integer, p_consumer text, p_state text,
  p_projection text default 'p1', p_at timestamptz default null, p_version bigint default 1, p_attempts integer default 0
)
returns void language plpgsql as $body$
begin
  perform set_config('app.cms_rpc', 'true', true);
  insert into platform_private.projection_consumer_state(
    publication_id, projection_id, consumer, expected_version, state, attempts, last_error_code, updated_at, version
  ) values (
    pg_temp.q_pub(p_pub), pg_temp.h11w_uuid('proj-' || p_projection), p_consumer, 1, p_state, p_attempts,
    case when p_state in ('blocked', 'failed_retryable') then 'consumer_failed' end,
    coalesce(p_at, clock_timestamp()), p_version);
end;
$body$;
create or replace function pg_temp.q_all(p_pub integer, p_state text, p_skip text default null)
returns void language sql as $body$
  select pg_temp.q_row(p_pub, c, p_state) from unnest(array['route', 'render', 'menu', 'media', 'search', 'sitemap', 'cache', 'social']) c
   where c is distinct from p_skip
$body$;

select pg_temp.q_all(1, 'active');
select is((select count(*)::integer from platform_private.projection_consumer_state where publication_id = pg_temp.q_pub(1)), 8,
  'all eight BE04c consumers (route, render, menu, media, search, sitemap, cache, social) are accepted [P2-S11-AC-116]');
select set_config('app.cms_rpc', 'true', true);
select throws_ok($$select pg_temp.q_row(2, 'other', 'active')$$, '23514',
  'new row for relation "projection_consumer_state" violates check constraint "projection_consumer_state_consumer_check"',
  'a consumer outside the eight is refused by the check [P2-S11-AC-116]');
select throws_ok($$select pg_temp.q_row(2, 'route', 'done')$$, '23514',
  'new row for relation "projection_consumer_state" violates check constraint "projection_consumer_state_state_check"',
  'a state outside building, ready, blocked, failed_retryable, active, superseded, revoked is refused [P2-S11-AC-116]');
select throws_ok($$select pg_temp.q_row(2, 'route', 'building', 'p1', null, 0)$$, '23514',
  'new row for relation "projection_consumer_state" violates check constraint "projection_consumer_state_version_check"',
  'version must be positive [P2-S11-AC-116]');
select throws_ok($$select pg_temp.q_row(2, 'route', 'building', 'p1', null, 1, -1)$$, '23514',
  'new row for relation "projection_consumer_state" violates check constraint "projection_consumer_state_attempts_check"',
  'attempts cannot be negative [P2-S11-AC-116]');
select throws_ok($$insert into platform_private.projection_consumer_state(publication_id, projection_id, consumer, expected_version, state, updated_at, version)
  values (pg_temp.q_pub(2), pg_temp.h11w_uuid('proj-p1'), 'route', 0, 'building', clock_timestamp(), 1)$$, '23514',
  'new row for relation "projection_consumer_state" violates check constraint "projection_consumer_state_expected_version_check"',
  'expected_version must be positive [P2-S11-AC-116]');
select throws_ok($$insert into platform_private.projection_consumer_state(publication_id, projection_id, consumer, expected_version, state, last_error_code, updated_at, version)
  values (pg_temp.q_pub(2), pg_temp.h11w_uuid('proj-p1'), 'route', 1, 'blocked', repeat('e', 97), clock_timestamp(), 1)$$, '22001',
  'value too long for type character varying(96)',
  'last_error_code is at most 96 characters [P2-S11-AC-116]');
select throws_ok($$select pg_temp.q_row(1, 'route', 'building')$$, '23505',
  'duplicate key value violates unique constraint "projection_consumer_state_identity_unique"',
  'one consumer reports a publication once per projection (unique publication, projection, consumer) [P2-S11-AC-116]');
select throws_ok($$insert into platform_private.projection_consumer_state(publication_id, projection_id, consumer, expected_version, state, updated_at, version)
  values (extensions.gen_random_uuid(), pg_temp.h11w_uuid('proj-p1'), 'route', 1, 'building', clock_timestamp(), 1)$$, '23503',
  'insert or update on table "projection_consumer_state" violates foreign key constraint "projection_consumer_state_publication_fk"',
  'a consumer state reports an existing publication version row only [P2-S11-AC-116]');
select set_config('app.cms_rpc', '', true);
select throws_ok($$insert into platform_private.projection_consumer_state(publication_id, projection_id, consumer, expected_version, state, updated_at, version)
  values (pg_temp.q_pub(2), pg_temp.h11w_uuid('proj-p1'), 'route', 1, 'building', clock_timestamp(), 1)$$, 'P0001',
  'DIRECT_CMS_TABLE_WRITE', 'a direct write outside a CMS RPC context is refused by the write guard [P2-S11-AC-116]');

-- ---------------------------------------------------------------------------
-- The derivation.
-- ---------------------------------------------------------------------------
select ok(pg_temp.h11_private_definer('cms_publication_projection_state(uuid)')
    and pg_temp.h11_rettype('cms_publication_projection_state(uuid)') = 'text'
    and pg_temp.h11_volatility('cms_publication_projection_state(uuid)') = 's',
  'cms_publication_projection_state is a private STABLE SECURITY DEFINER of the CMS definer (empty search_path, no API-role execute) returning text [P2-S11-AC-116]');
select set_config('app.cms_rpc', 'true', true);
select throws_ok($$select platform_private.cms_publication_projection_state(null)$$, 'P0001', 'INVALID_REQUEST',
  'a null publication version id is a malformed call [P2-S11-AC-116]');
select set_config('app.cms_rpc', '', true);
select throws_ok($$select platform_private.cms_publication_projection_state(pg_temp.q_pub(1))$$, 'P0001', 'INTERNAL_ERROR',
  'outside a CMS RPC context the table is invisible, so the function refuses instead of answering a false pending [P2-S11-AC-116]');
select set_config('app.cms_rpc', 'true', true);

-- 1: eight active (above).  2: seven active, social missing.  3: eight ready.  4: eight active (no history).
select pg_temp.q_all(2, 'active', 'social');
select pg_temp.q_all(3, 'ready');
select pg_temp.q_all(4, 'active');
-- 5: a mix of the three post-pointer states.
select pg_temp.q_row(5, 'route', 'active');
select pg_temp.q_row(5, 'render', 'superseded');
select pg_temp.q_row(5, 'menu', 'revoked');
select pg_temp.q_row(5, 'media', 'active');
select pg_temp.q_row(5, 'search', 'active');
select pg_temp.q_row(5, 'sitemap', 'superseded');
select pg_temp.q_row(5, 'cache', 'revoked');
select pg_temp.q_row(5, 'social', 'active');
-- 6: seven active and media blocked.  7: media retrying (attempts 3) and search building.
select pg_temp.q_all(6, 'active', 'media');
select pg_temp.q_row(6, 'media', 'blocked');
select pg_temp.q_row(7, c, 'active') from unnest(array['route', 'render', 'menu', 'sitemap', 'cache', 'social']) c;
select pg_temp.q_row(7, 'media', 'failed_retryable', 'p1', null, 1, 3);
select pg_temp.q_row(7, 'search', 'building');
-- 8: route blocked two hours ago on projection p0, active now on p1 (a recovered consumer).
select pg_temp.q_all(8, 'active');
select pg_temp.q_row(8, 'route', 'blocked', 'p0', clock_timestamp() - interval '2 hours');
-- 9: route active two hours ago, blocked now (a consumer that failed after converging).
select pg_temp.q_all(9, 'active', 'route');
select pg_temp.q_row(9, 'route', 'active', 'p0', clock_timestamp() - interval '2 hours');
select pg_temp.q_row(9, 'route', 'blocked', 'p1');
-- 10: the newest row ties on updated_at; the higher row version wins.
select pg_temp.q_all(10, 'active', 'route');
select pg_temp.q_row(10, 'route', 'blocked', 'p0', timestamptz '2026-10-10 10:00:00+00', 1);
select pg_temp.q_row(10, 'route', 'active', 'p1', timestamptz '2026-10-10 10:00:00+00', 2);

create or replace function pg_temp.q_state(p_n integer)
returns text language sql stable as $body$ select platform_private.cms_publication_projection_state(pg_temp.q_pub(p_n)) $body$;

select is(platform_private.cms_publication_projection_state(extensions.gen_random_uuid()), 'pending',
  'a row id no consumer has reported (no row at all) is pending [P2-S11-AC-116]');
select is(pg_temp.q_state(2), 'pending',
  'seven registered consumers reporting `active` while the eighth has not reported is still pending: converged needs every registered consumer [P2-S11-AC-116]');
select is(pg_temp.q_state(3), 'pending',
  'all eight consumers `ready` is pending: ready is built but not yet switched in [P2-S11-AC-116]');
select is(pg_temp.q_state(7), 'pending',
  'a consumer retrying (`failed_retryable`, three attempts) and one still `building` keep the row pending: BE04c retries before it pages [P2-S11-AC-116]');
select is(pg_temp.q_state(1), 'converged',
  'every registered consumer `active` is converged [P2-S11-AC-116]');
select is(pg_temp.q_state(4), 'converged',
  'a second row with all eight `active` is converged: the state is read per row id [P2-S11-AC-116]');
select is(pg_temp.q_state(5), 'converged',
  'active, superseded and revoked consumers are all past the pointer switch: converged [P2-S11-AC-116]');
select is(pg_temp.q_state(6), 'degraded',
  'one registered consumer `blocked` (terminal) is degraded although seven are active [P2-S11-AC-116]');
select is(pg_temp.q_state(8), 'converged',
  'a consumer that was blocked and has since reported `active` is converged: only the newest row of a consumer counts [P2-S11-AC-116]');
select is(pg_temp.q_state(9), 'degraded',
  'a consumer that converged and later became `blocked` is degraded [P2-S11-AC-116]');
select is(pg_temp.q_state(10), 'converged',
  'rows of one consumer tied on updated_at are ordered by their row version: the newer one decides [P2-S11-AC-116]');

-- Reading never changes canonical state.
select is(
  (select count(*)::integer from platform_private.cms_publication_versions where audience like 'ps%'
     and state = 'active' and version = 1 and revoked_at is null),
  10, 'a degraded or converged consumer state leaves every publication row as published: the read never rolls canonical state back [P2-S11-AC-116]');

-- ---------------------------------------------------------------------------
-- The lineage append reads it: a probe that makes every consumer report the appended row at once
-- (a test-only stand-in for the Shard 04 writers) turns the answer from pending into converged.
-- ---------------------------------------------------------------------------
select pg_temp.h11w_revision('pj');
select pg_temp.h11l_review('pj');
create function public.s11_ps_probe() returns trigger language plpgsql security definer set search_path = '' as $f$
begin
  insert into platform_private.projection_consumer_state(
    publication_id, projection_id, consumer, expected_version, state, updated_at, version)
  select new.id, new.id, consumer_name, 1, 'active', pg_catalog.clock_timestamp(), 1
    from pg_catalog.unnest(array['route', 'render', 'menu', 'media', 'search', 'sitemap', 'cache', 'social']) consumer_name;
  return new;
end;
$f$;
create trigger s11_ps_probe after insert on platform_private.cms_publication_versions
  for each row execute function public.s11_ps_probe();
create temp table q_probed on commit drop as select pg_temp.h11l_append(pg_temp.h11l_publish('pj')) as resource;
drop trigger s11_ps_probe on platform_private.cms_publication_versions;
drop function public.s11_ps_probe();

select is((select resource->>'projectionState' from q_probed), 'converged',
  'the appended row''s projectionState is read from projection_consumer_state: with every consumer reporting it is converged, not a literal pending [P2-S11-AC-116]');
select is((select resource->>'projectionState' from q_probed),
  platform_private.cms_publication_projection_state((select (resource->>'publicationVersionId')::uuid from q_probed)),
  'the append answer equals the derivation for the appended row id [P2-S11-AC-116]');
select pg_temp.h11w_revision('pk');
select pg_temp.h11l_review('pk');
select is((select pg_temp.h11l_append(pg_temp.h11l_publish('pk'))->>'projectionState'), 'pending',
  'control: a row no consumer has reported is pending in the append answer [P2-S11-AC-116]');

-- A degraded consumer never rolls canonical state back: the lineage keeps appending, with its event and audit record.
select set_config('app.cms_rpc', 'true', true);
update platform_private.projection_consumer_state
   set state = 'blocked', last_error_code = 'consumer_failed', version = version + 1, updated_at = clock_timestamp()
 where publication_id = (select (resource->>'publicationVersionId')::uuid from q_probed) and consumer = 'route';
select is(platform_private.cms_publication_projection_state((select (resource->>'publicationVersionId')::uuid from q_probed)), 'degraded',
  'fixture: one blocked consumer makes the appended row degraded [P2-S11-AC-116]');
create temp table q_tombstone on commit drop as select pg_temp.h11l_append(pg_temp.h11l_tombstone('pj', 'unpublish')) as resource;
select is(
  (select resource->>'state' || '/' || (resource->>'action') || '/' || (resource->>'version') || '/' || (resource->>'projectionState') from q_tombstone),
  'revoked/unpublish/2/pending',
  'the lineage of a degraded row still appends: the unpublish tombstone is version 2, revoked, and its own state is pending [P2-S11-AC-116]');
select is(
  (select count(*)::integer from audit_private.audit_events where action = 'cms.publication.unpublish'
     and target_id = (select (resource->>'publicationVersionId')::uuid from q_tombstone)),
  1, 'and writes its audit record [P2-S11-AC-116]');
select is(
  (select count(*)::integer from platform_private.outbox_events where event_type = 'cms.publication.changed.v1'), 3,
  'and exactly one cms.publication.changed.v1 per appended row (three rows, three events): the projection read adds no event and a degraded consumer removes none [P2-S11-AC-116]');
select is(pg_temp.h11l_rows('pj'), '1:publish:active:-,2:unpublish:revoked:S',
  'the canonical lineage of the degraded row is intact: the published row is untouched and the tombstone is its successor [P2-S11-AC-116]');

select * from finish();
rollback;
