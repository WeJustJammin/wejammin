commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 R8 (re-audit AC1203 NOT-PROVEN): "The draft and successor RPCs run
-- the pure platform_api.cms_validate_locale_config function, which applies the
-- same rules and exact messages as the locale refusal table".  The previous
-- proof was a position() check on function source text, and the RPCs called the
-- private rule function directly, never the public validator.  This suite proves
-- the behaviour: a sentinel installed in place of the validator surfaces in the
-- refusal of both RPCs (so they do run it), and for a matrix of invalid
-- configurations the RPC refusal messages equal the validator's, in order.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc

create or replace function pg_temp.r8l_messages(p_detail text) returns jsonb language sql stable as $body$
  select coalesce(jsonb_agg(v->>'message'), '[]'::jsonb)
    from jsonb_array_elements(coalesce(p_detail::jsonb->'violations', '[]'::jsonb)) v $body$;
create or replace function pg_temp.r8l_validator(p_supported jsonb, p_chains jsonb) returns jsonb language sql stable as $body$
  select coalesce(jsonb_agg(i->>'message'), '[]'::jsonb)
    from jsonb_array_elements(platform_api.cms_validate_locale_config('en-US', 'en-US', p_supported, p_chains)) i $body$;

select pg_temp.s09d_create_type('src', 'r8l_source');
select pg_temp.s09d_to_active('src');
select is(pg_temp.s09d_outcome('src:activate'), 'OK', 'fixture: an active source version exists for CMS-03A-09 [P2-S09-AC-1203]');

create temp table r8l_matrix(n integer primary key, supported jsonb, chains jsonb) on commit drop;
insert into r8l_matrix values
  (1, '["fr-FR"]', '{}'),
  (2, '["en-US","fr-FR"]', '{"fr-FR":["de-DE"]}'),
  (3, '["en-US","en-US"]', '{}'),
  (4, '["en-US","fr-FR"]', '{"de-DE":["en-US"]}');
select ok(jsonb_array_length(pg_temp.r8l_validator(m.supported, m.chains)) > 0,
  'fixture: matrix row ' || m.n || ' is invalid for the pure validator, so the comparison below is not vacuous [P2-S09-AC-1203]')
  from r8l_matrix m order by m.n;

select pg_temp.s09d_create_type('d' || m.n, 'r8l_draft_' || m.n, 'editorial', 'owner', m.supported, m.chains)
  from r8l_matrix m order by m.n;
select is(pg_temp.r8l_messages(pg_temp.s09d_detail('d' || m.n || ':create')), pg_temp.r8l_validator(m.supported, m.chains),
  'draft RPC refusal ' || m.n || ' carries exactly the validator''s messages in the validator''s order [P2-S09-AC-1203]')
  from r8l_matrix m order by m.n;
select pg_temp.s09d_successor('s' || m.n, 'src', 'owner', 'r8l-successor-' || m.n || '-0001', m.supported, m.chains)
  from r8l_matrix m order by m.n;
select is(pg_temp.r8l_messages(pg_temp.s09d_detail('s' || m.n || ':successor')), pg_temp.r8l_validator(m.supported, m.chains),
  'successor RPC refusal ' || m.n || ' carries exactly the validator''s messages in the validator''s order [P2-S09-AC-1203]')
  from r8l_matrix m order by m.n;

-- Replace the validator with a sentinel inside this transaction: an RPC that
-- really runs it must surface the sentinel for an otherwise valid configuration.
create or replace function platform_api.cms_validate_locale_config(p_source text, p_default text, p_supported jsonb, p_chains jsonb)
returns jsonb language sql stable security definer set search_path = '' as $body$
  select pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
    'path', pg_catalog.jsonb_build_array('supportedLocales'), 'message', 'r8 validator sentinel'))
$body$;
select pg_temp.s09d_create_type('sd', 'r8l_sentinel_draft');
select is(pg_temp.r8l_messages(pg_temp.s09d_detail('sd:create')), '["r8 validator sentinel"]'::jsonb,
  'the draft RPC runs platform_api.cms_validate_locale_config: a sentinel validator refuses a valid draft [P2-S09-AC-1203]');
select pg_temp.s09d_successor('ss', 'src', 'owner', 'r8l-successor-sentinel-0001', '["en-US"]'::jsonb, '{}'::jsonb);
select is(pg_temp.r8l_messages(pg_temp.s09d_detail('ss:successor')), '["r8 validator sentinel"]'::jsonb,
  'the successor RPC runs platform_api.cms_validate_locale_config: a sentinel validator refuses a valid replacement [P2-S09-AC-1203]');
select is(pg_temp.s09d_outcome('sd:create') || '/' || pg_temp.s09d_outcome('ss:successor'), 'VALIDATION_FAILED/VALIDATION_FAILED',
  'both sentinel refusals are 422 VALIDATION_FAILED [P2-S09-AC-1203]');

select * from finish();
rollback;
