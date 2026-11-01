-- Slice 11 lane preview-projection: the CMS-03B-15 workflow read serves each publication row's
-- projectionState from Shard 04's projection_consumer_state (BE03b E3 "projectionState is read ... for the
-- row id"; tracker P2-S11-AC-116, with AC-050 for the publications member).  pending while no consumer
-- has reported (or any registered consumer is still missing or in progress), converged when every registered
-- consumer reports the row, degraded when one failed terminally; the read writes nothing and never touches the
-- canonical lineage.  The derivation itself is phase_02_slice_11_projection_state.sql.  RED before
-- 20261010165100.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(18);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/001-world.sqlinc
\ir phase_02_slice_11_helpers/002-reviews.sqlinc
\ir phase_02_slice_11_rpc_review/000-world.sqlinc
\ir phase_02_slice_11_rpc_review/020-decision.sqlinc
\ir phase_02_slice_11_rpc_review/030-submit.sqlinc
\ir phase_02_slice_11_rpc_reads/000-world.sqlinc

select ok(
  position($lit$'projectionState', 'pending'$lit$ in (select prosrc from pg_proc where oid = to_regprocedure('platform_private.cms_get_entry_workflow(jsonb)'))) = 0
    and position($lit$'projectionState', 'pending'$lit$ in (select prosrc from pg_proc where oid = to_regprocedure('platform_private.cms_append_publication_lineage(jsonb)'))) = 0,
  'neither the workflow read nor the lineage append carries a literal pending projectionState any more [P2-S11-AC-116]');

select pg_temp.r11_entry('psr-1');
select pg_temp.r11_entry('psr-2');

-- psr-1 carries four one-row lineages (audiences ra..rd); psr-2 one row (re) with blocked consumers.
create or replace function pg_temp.psr_pub(p_n integer)
returns uuid language sql immutable as $body$
  select ('a9600000-0000-4000-8000-' || lpad(p_n::text, 12, '0'))::uuid
$body$;
select pg_temp.h11r_raw_insert('platform_private.cms_publication_versions', pg_temp.s11_publication_row(jsonb_build_object(
  'id', pg_temp.psr_pub(n), 'publication_id', pg_temp.psr_pub(n),
  'entry_id', pg_temp.h11w_uuid(case when n = 5 then 'psr-2' else 'psr-1' end || ':entry'),
  'revision_id', pg_temp.h11w_uuid(case when n = 5 then 'psr-2' else 'psr-1' end || ':revision'),
  'audience', 'r' || chr(96 + n), 'publication_hash', pg_temp.s11_hex('psr-' || n),
  'created_at', timestamptz '2026-10-05 12:00:00+00' + (n * interval '1 minute'),
  'updated_at', timestamptz '2026-10-05 12:00:00+00' + (n * interval '1 minute'))))
  from generate_series(1, 5) n;

create or replace function pg_temp.psr_row(p_pub integer, p_consumer text, p_state text)
returns void language plpgsql as $body$
begin
  perform set_config('app.cms_rpc', 'true', true);
  insert into platform_private.projection_consumer_state(
    publication_id, projection_id, consumer, expected_version, state, last_error_code, updated_at, version
  ) values (
    pg_temp.psr_pub(p_pub), pg_temp.h11w_uuid('psr-projection'), p_consumer, 1, p_state,
    case when p_state = 'blocked' then 'consumer_failed' end, clock_timestamp(), 1);
end;
$body$;
-- ra: no consumer has reported.  rb: all eight active.  rc: seven active, search blocked.  rd: three ready.
select pg_temp.psr_row(2, c, 'active') from unnest(array['route', 'render', 'menu', 'media', 'search', 'sitemap', 'cache', 'social']) c;
select pg_temp.psr_row(3, c, case when c = 'search' then 'blocked' else 'active' end)
  from unnest(array['route', 'render', 'menu', 'media', 'search', 'sitemap', 'cache', 'social']) c;
select pg_temp.psr_row(4, c, 'ready') from unnest(array['route', 'render', 'menu']) c;
select pg_temp.psr_row(5, c, 'blocked') from unnest(array['route', 'render']) c;

create or replace function pg_temp.psr_states(p_label text)
returns text language sql stable as $body$
  select string_agg((item->>'audience') || '=' || (item->>'projectionState'), ',' order by item->>'audience')
    from jsonb_array_elements(pg_temp.r11_resp(p_label)->'publications') item
$body$;
create or replace function pg_temp.psr_request(p_tag text)
returns jsonb language sql as $body$
  select jsonb_build_object('entryId', pg_temp.h11w_uuid(p_tag || ':entry'), 'context', pg_temp.r11_ctx())
$body$;
create temp table psr_snap(label text primary key, effects text not null) on commit drop;
create or replace function pg_temp.psr_effects()
returns text language sql stable security definer set search_path = '' as $body$
  select pg_temp.r11r_effects()
    || '/' || (select count(*) from platform_private.projection_consumer_state)::text
    || '/' || (select coalesce(sum(version), 0) from platform_private.projection_consumer_state)::text
$body$;

insert into psr_snap(label, effects) values ('before', pg_temp.psr_effects());
select pg_temp.r11r_call('wf', 'cms_get_entry_workflow', 'owner', pg_temp.psr_request('psr-1'));
select pg_temp.r11r_call('wf2', 'cms_get_entry_workflow', 'owner', pg_temp.psr_request('psr-2'));
select is(pg_temp.r11_out('wf') || ' ' || pg_temp.r11_out('wf2'), '00000: 00000:',
  'fixture: the entry assignee reads the workflow of both entries [P2-S11-AC-050]');
select is(jsonb_array_length(pg_temp.r11_resp('wf')->'publications'), 4,
  'only the entry''s own four publication rows are served (the other entry''s row is not) [P2-S11-AC-050]');
select is(pg_temp.psr_states('wf'), 'ra=pending,rb=converged,rc=degraded,rd=pending',
  'each publication carries the state derived from its own consumer rows: none reported pending, all eight active converged, one blocked degraded, three ready pending [P2-S11-AC-116]');
select is(pg_temp.r11_resp('wf')#>>'{publications,0,audience}' || '=' || (pg_temp.r11_resp('wf')#>>'{publications,0,projectionState}'),
  'rd=pending', 'the newest publication row is served first and carries its own state [P2-S11-AC-116]');
select is(pg_temp.psr_states('wf2'), 're=degraded',
  'another entry''s publication is degraded by its own two blocked consumers and shares nothing with the first [P2-S11-AC-116]');
select is(pg_temp.psr_effects(), (select effects from psr_snap where label = 'before'),
  'the reads write nothing: reviews, schedules, publications, tokens, entry versions and consumer rows are unchanged [P2-S11-AC-053]');

-- A consumer-state change is picked up by the next read; the canonical lineage is untouched either way.
select set_config('app.cms_rpc', 'true', true);
update platform_private.projection_consumer_state
   set state = 'active', version = version + 1, updated_at = clock_timestamp()
 where publication_id = pg_temp.psr_pub(4);
select pg_temp.psr_row(4, c, 'active') from unnest(array['media', 'search', 'sitemap', 'cache', 'social']) c;
select pg_temp.r11r_call('wf3', 'cms_get_entry_workflow', 'owner', pg_temp.psr_request('psr-1'));
select is(pg_temp.psr_states('wf3'), 'ra=pending,rb=converged,rc=degraded,rd=converged',
  'once the last consumers report, the next read serves rd as converged; the degraded and pending rows keep their states [P2-S11-AC-116]');
select is(
  (select count(*)::integer from platform_private.cms_publication_versions
    where entry_id = pg_temp.h11w_uuid('psr-1:entry') and state = 'active' and version = 1 and revoked_at is null),
  4, 'the canonical lineage rows are unchanged by every consumer state, degraded included [P2-S11-AC-116]');

select * from finish();
rollback;
