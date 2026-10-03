commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 R8 (re-audit AC898, AC904): the registry's state vocabulary, the
-- "pending_expires_at only while pending or reconciling" rule, and the whole
-- factor state machine.  The earlier proofs sampled five refused edges; here
-- every ordered pair of the five states is attempted on a REAL row in the
-- source state (made through the named RPCs) and each attempt must be accepted
-- exactly when BE01a names the edge, so "removed and expired terminal" and
-- every other omission are each asserted, not inferred.  Every attempt is
-- rolled back.

\ir phase_02_slice_09_dec111/00-support.sqlinc

-- Runs one statement and always rolls its effects back: ACCEPTED, or SQLSTATE:message.
create or replace function pg_temp.r8m_probe(p_sql text) returns text language plpgsql as $body$
begin
  begin
    execute p_sql;
    raise exception 'r8m rollback' using errcode = 'RB999';
  exception when others then
    if sqlstate = 'RB999' then return 'ACCEPTED'; end if;
    return sqlstate || ':' || sqlerrm;
  end;
end;
$body$;

-- ---------------------------------------------- the five-state vocabulary ----
select is((select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e
            where e.enumtypid = 'identity.mfa_factor_state'::regtype),
  array['pending', 'verified', 'reconciling', 'removed', 'expired'],
  'the factor state vocabulary is exactly pending, verified, reconciling, removed, expired [P2-S09-AC-898]');
select pg_temp.m_user(1);
select is(pg_temp.r8m_probe($q$insert into identity.mfa_factor_registry(auth_user_id, method, provider_factor_id, friendly_name, state)
    values ('b1110000-0000-4000-8000-000000000001', 'totp', extensions.gen_random_uuid(), 'bogus', 'archived')$q$),
  '22P02:invalid input value for enum identity.mfa_factor_state: "archived"', 'a state outside the vocabulary is refused (invalid enum input) [P2-S09-AC-898]');

-- pending_expires_at is nullable only while pending or reconciling.
select ok(pg_temp.r8m_probe(format($q$insert into identity.mfa_factor_registry(auth_user_id, method, provider_factor_id, friendly_name, state, pending_expires_at, verified_at, removed_at)
    values ('b1110000-0000-4000-8000-000000000001', 'totp', extensions.gen_random_uuid(), 'v-%1$s', %1$L, clock_timestamp() + interval '5 minutes',
            case when %1$L = 'verified' then clock_timestamp() end, case when %1$L = 'removed' then clock_timestamp() end)$q$, s.state))
    like '23514:%mfa_factor_registry_check%',
  'a ' || s.state || ' row carrying pending_expires_at is refused by the CHECK constraint [P2-S09-AC-898]')
from (values ('verified'), ('removed'), ('expired')) s(state);
select is(pg_temp.r8m_probe(format($q$insert into identity.mfa_factor_registry(auth_user_id, method, provider_factor_id, friendly_name, state, pending_expires_at)
    values ('b1110000-0000-4000-8000-000000000001', 'totp', extensions.gen_random_uuid(), 'c-%1$s', %1$L, clock_timestamp() + interval '5 minutes')$q$, s.state)),
  'ACCEPTED', 'control: a ' || s.state || ' row may carry pending_expires_at [P2-S09-AC-898]')
from (values ('pending'), ('reconciling')) s(state);
select is(pg_temp.r8m_probe($q$insert into identity.mfa_factor_registry(auth_user_id, method, provider_factor_id, friendly_name, state)
    values ('b1110000-0000-4000-8000-000000000001', 'totp', extensions.gen_random_uuid(), 'c-reconciling-null', 'reconciling')$q$),
  'ACCEPTED', 'control: a reconciling row may have no pending_expires_at (nullable) [P2-S09-AC-898]');

-- --------------------------------------- one real row in each source state ----
-- user 2: verified (enrolled); user 3: pending; user 4: reconciling;
-- user 5: removed (reconciling -> removed); user 6: expired (sweep).
select pg_temp.m_user(n) from generate_series(2, 6) n;
select pg_temp.m_enroll(2, 'Phone');
select pg_temp.m_pending(3, 'Phone');
select pg_temp.m_pending(4, 'Phone');
select pg_temp.m('mk4', 'auth_mfa_factor_mark_reconciling', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(4), 'p_factor_id', pg_temp.m_fid(4)));
select pg_temp.m_pending(5, 'Phone');
select pg_temp.m('mk5', 'auth_mfa_factor_mark_reconciling', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(5), 'p_factor_id', pg_temp.m_fid(5)));
select pg_temp.m('rc5', 'auth_mfa_factor_reconcile', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(5), 'p_factor_id', pg_temp.m_fid(5),
  'p_outcome', 'removed', 'p_expected_version', pg_temp.m_fv(pg_temp.m_fid(5))));
select pg_temp.m_pending(6, 'Phone');
select pg_temp.m_warp('mfa_factor_registry', $$pending_expires_at = clock_timestamp() - interval '1 second'$$, format('id = %L', pg_temp.m_fid(6)));
select pg_temp.m('sw6', 'auth_mfa_registry_sweep', jsonb_build_object('p_batch', 100, '_notrace', true));
create temp table r8m_rows(state text primary key, factor uuid not null) on commit drop;
insert into r8m_rows values ('verified', pg_temp.m_fid(2)), ('pending', pg_temp.m_fid(3)), ('reconciling', pg_temp.m_fid(4)),
  ('removed', pg_temp.m_fid(5)), ('expired', pg_temp.m_fid(6));
select is((select string_agg(r.state || '=' || pg_temp.m_fstate(r.factor), ',' order by r.state) from r8m_rows r),
  'expired=expired,pending=pending,reconciling=reconciling,removed=removed,verified=verified',
  'fixture: one real factor sits in each of the five states, produced by the named RPCs and the sweep [P2-S09-AC-904]');

-- The edges BE01a names: pending -> verified | expired | reconciling;
-- verified -> reconciling; reconciling -> verified | pending | removed.
create temp table r8m_allowed(src text, dst text, primary key (src, dst)) on commit drop;
insert into r8m_allowed values
  ('pending', 'verified'), ('pending', 'expired'), ('pending', 'reconciling'),
  ('verified', 'reconciling'),
  ('reconciling', 'verified'), ('reconciling', 'pending'), ('reconciling', 'removed');
create or replace function pg_temp.r8m_set(p_dst text) returns text language sql immutable as $body$
  select case p_dst
    when 'verified' then 'version = version + 1, state = ''verified'', verified_at = coalesce(verified_at, clock_timestamp()), pending_expires_at = null, removed_at = null'
    when 'pending' then 'version = version + 1, state = ''pending'', pending_expires_at = coalesce(pending_expires_at, clock_timestamp() + interval ''5 minutes''), verified_at = null, removed_at = null'
    when 'reconciling' then 'version = version + 1, state = ''reconciling'', removed_at = null'
    when 'removed' then 'version = version + 1, state = ''removed'', removed_at = clock_timestamp(), pending_expires_at = null'
    else 'version = version + 1, state = ''expired'', pending_expires_at = null, removed_at = null' end $body$;
create temp table r8m_matrix on commit drop as
select s.state as src, d.state as dst,
       pg_temp.r8m_probe(format('update identity.mfa_factor_registry set %s where id = %L', pg_temp.r8m_set(d.state), s.factor)) as outcome,
       exists (select 1 from r8m_allowed a where a.src = s.state and a.dst = d.state) as allowed
  from r8m_rows s cross join (values ('pending'), ('verified'), ('reconciling'), ('removed'), ('expired')) d(state)
 where s.state <> d.state;
select is((select count(*)::integer from r8m_matrix), 20, 'the matrix covers every ordered pair of distinct states [P2-S09-AC-904]');
select is((select count(*)::integer from r8m_matrix where allowed), 7, 'BE01a names exactly seven edges [P2-S09-AC-904]');
select is(m.outcome,
  case when m.allowed then 'ACCEPTED'
       when m.src in ('removed', 'expired') then 'P0001:MFA_FACTOR_TERMINAL'
       else 'P0001:MFA_FACTOR_TRANSITION' end,
  m.src || ' -> ' || m.dst || (case when m.allowed then ' is permitted' else ' is refused' end) || ' by the registry state guard [P2-S09-AC-904]')
  from r8m_matrix m order by m.src, m.dst;
select is((select string_agg(m.src || '->' || m.dst, ',' order by m.src, m.dst) from r8m_matrix m where m.src in ('removed', 'expired') and m.outcome = 'ACCEPTED'),
  null, 'removed and expired are terminal: no transition leaves either state [P2-S09-AC-904]');

select * from finish();
rollback;
