commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 audit remediation (R3): the database count boundary of
-- platform_api.auth_rate_limit that the Worker rate rows (429 at the limit)
-- rely on.  The Worker supplies the per-route limit and window; this proves the
-- RPC allows exactly `limit` requests per (operation id, bucket digest, window),
-- refuses the next one, keeps separate counters per operation id and bucket
-- digest, and reports remaining and resetAt.  Limits are the BE01a/BE05b values:
--   AUTH-API-16 300/60 s per user        AUTH-API-17, 19 5/3600 s per user
--   AUTH-API-20 10/900 s per IP+account  AUTH-API-21 10/900 s shared failure bucket
--   CFG-05B-06  5/3600 s per user and 10/3600 s per party (fallback id AUTH-API-15)

create or replace function pg_temp.r3_wait_window(p_window integer) returns void language plpgsql as $body$
declare remaining numeric;
begin
  remaining := p_window - mod(extract(epoch from clock_timestamp())::numeric, p_window);
  if remaining < 3 then
    perform pg_sleep(remaining + 0.2);
  end if;
end;
$body$;
create or replace function pg_temp.r3_digest(p_label text) returns text language sql immutable as $body$
  select encode(extensions.digest('r3-rate-' || p_label, 'sha256'), 'hex') $body$;
create or replace function pg_temp.r3_call(p_op text, p_label text, p_limit integer, p_window integer) returns jsonb language sql as $body$
  select platform_api.auth_rate_limit(p_op, pg_temp.r3_digest(p_label), p_limit, p_window) $body$;
create temp table r3_rate_results(op text, label text, n integer, allowed boolean, remaining integer) on commit drop;
create or replace function pg_temp.r3_run(p_op text, p_label text, p_limit integer, p_window integer, p_calls integer) returns void language plpgsql as $body$
declare i integer; r jsonb;
begin
  perform pg_temp.r3_wait_window(p_window);
  for i in 1..p_calls loop
    r := pg_temp.r3_call(p_op, p_label, p_limit, p_window);
    insert into r3_rate_results values (p_op, p_label, i, (r->>'allowed')::boolean, (r->>'remaining')::integer);
  end loop;
end;
$body$;

-- (operation, bucket label, limit, window seconds, criteria)
create temp table r3_rate_cases(op text, label text, lim integer, win integer, marks text) on commit drop;
insert into r3_rate_cases values
  ('AUTH-API-16', 'user-a', 300, 60,   '[P2-S09-AC-725] [P2-S09-AC-728]'),
  ('AUTH-API-17', 'user-a', 5, 3600,   '[P2-S09-AC-751] [P2-S09-AC-759]'),
  ('AUTH-API-18', 'user-a', 10, 900,   '[P2-S09-AC-787]'),
  ('AUTH-API-19', 'user-a', 5, 3600,   '[P2-S09-AC-809] [P2-S09-AC-818]'),
  ('AUTH-API-20', 'ip-account-a', 10, 900, '[P2-S09-AC-839] [P2-S09-AC-848]'),
  ('AUTH-API-21', 'ip-account-a', 10, 900, '[P2-S09-AC-874]'),
  ('AUTH-API-15', 'cfg-user-a', 5, 3600, '[P2-S09-AC-934] [P2-S09-AC-943]'),
  ('AUTH-API-15', 'cfg-party-a', 10, 3600, '[P2-S09-AC-934] [P2-S09-AC-943]');
select pg_temp.r3_run(op, label, lim, win, lim + 2) from r3_rate_cases;

select is((select count(*) from r3_rate_results r join r3_rate_cases c using (op, label) where r.n <= c.lim and not r.allowed), 0::bigint,
  'every one of the first `limit` requests of every bucket is allowed');
select is((select count(*) from r3_rate_results r join r3_rate_cases c using (op, label) where r.n = c.lim + 1 and r.allowed), 0::bigint,
  'the request after the limit is refused in every bucket');
select is((select count(*) from r3_rate_results r join r3_rate_cases c using (op, label) where r.n = c.lim + 2 and r.allowed), 0::bigint,
  'and so is every later request in the window');
select ok((select r.allowed and r.remaining = 0 from r3_rate_results r where r.op = 'AUTH-API-16' and r.n = 300),
  'AUTH-API-16: request 300 is allowed with remaining 0 [P2-S09-AC-725]');
select ok((select not r.allowed and r.remaining = 0 from r3_rate_results r where r.op = 'AUTH-API-16' and r.n = 301),
  'AUTH-API-16: request 301 is refused (429 at the limit) with remaining 0 [P2-S09-AC-725] [P2-S09-AC-728]');
select is((select array_agg(r.remaining order by r.n) from r3_rate_results r where r.op = 'AUTH-API-17' and r.n <= 5), array[4, 3, 2, 1, 0],
  'AUTH-API-17: remaining counts 4,3,2,1,0 across the five allowed enrollment starts [P2-S09-AC-751]');
select ok((select not r.allowed from r3_rate_results r where r.op = 'AUTH-API-17' and r.n = 6),
  'AUTH-API-17: the sixth start in the hour is refused (429) [P2-S09-AC-751] [P2-S09-AC-759]');
select ok((select r.allowed from r3_rate_results r where r.op = 'AUTH-API-19' and r.n = 5) and (select not r.allowed from r3_rate_results r where r.op = 'AUTH-API-19' and r.n = 6),
  'AUTH-API-19: the fifth removal in the hour is allowed and the sixth is refused (429) [P2-S09-AC-809] [P2-S09-AC-818]');
select ok((select r.allowed from r3_rate_results r where r.op = 'AUTH-API-20' and r.n = 10) and (select not r.allowed from r3_rate_results r where r.op = 'AUTH-API-20' and r.n = 11),
  'AUTH-API-20: the tenth challenge in 15 minutes is allowed and the eleventh is refused (429) [P2-S09-AC-839] [P2-S09-AC-848]');
select ok((select r.allowed from r3_rate_results r where r.op = 'AUTH-API-21' and r.n = 10) and (select not r.allowed from r3_rate_results r where r.op = 'AUTH-API-21' and r.n = 11),
  'AUTH-API-21: the tenth verification attempt in 15 minutes is allowed and the eleventh is refused (429) [P2-S09-AC-874]');
select ok((select r.allowed from r3_rate_results r where r.op = 'AUTH-API-18' and r.n = 10) and (select not r.allowed from r3_rate_results r where r.op = 'AUTH-API-18' and r.n = 11),
  'AUTH-API-18: the tenth shared-bucket verification is allowed and the eleventh is refused (429) [P2-S09-AC-787]');
select ok((select r.allowed from r3_rate_results r where r.label = 'cfg-user-a' and r.n = 5) and (select not r.allowed from r3_rate_results r where r.label = 'cfg-user-a' and r.n = 6),
  'CFG-05B-06 user bucket: the fifth reset in the hour is allowed and the sixth is refused (429) [P2-S09-AC-934] [P2-S09-AC-943]');
select ok((select r.allowed from r3_rate_results r where r.label = 'cfg-party-a' and r.n = 10) and (select not r.allowed from r3_rate_results r where r.label = 'cfg-party-a' and r.n = 11),
  'CFG-05B-06 party bucket: the tenth reset in the hour is allowed and the eleventh is refused (429) [P2-S09-AC-934] [P2-S09-AC-943]');

-- A refused bucket does not affect another bucket digest or another operation id.
select pg_temp.r3_wait_window(3600);
select is(pg_temp.r3_call('AUTH-API-17', 'user-b', 5, 3600)->>'remaining', '4',
  'a second user bucket of the same operation starts at count 1 (per user, not per operation) [P2-S09-AC-751]');
select is(pg_temp.r3_call('AUTH-API-19', 'user-a', 5, 3600)->>'allowed', 'false',
  'the same user digest on AUTH-API-19 keeps its own exhausted counter [P2-S09-AC-809]');
select is(pg_temp.r3_call('AUTH-API-20', 'ip-account-b', 10, 900)->>'remaining', '9',
  'a second IP+account bucket starts at count 1 (per IP and account) [P2-S09-AC-839]');
select is(pg_temp.r3_call('AUTH-API-16', 'user-a', 300, 60)->>'allowed', 'false',
  'AUTH-API-16 stays refused for the exhausted user within its window [P2-S09-AC-728]');
select is(pg_temp.r3_call('AUTH-API-17', 'cfg-user-a', 5, 3600)->>'remaining', '4',
  'the same digest under another operation id starts at count 1: counters are per operation id [P2-S09-AC-934]');

-- Response shape and window arithmetic.
select ok((select (r ? 'allowed') and (r ? 'limit') and (r ? 'remaining') and (r ? 'resetAt') and (select count(*) = 4 from jsonb_object_keys(r))
             and (r->>'limit')::integer = 5
             and (r->>'resetAt')::bigint > extract(epoch from clock_timestamp())::bigint
             and (r->>'resetAt')::bigint <= extract(epoch from clock_timestamp())::bigint + 3600
             from (select pg_temp.r3_call('AUTH-API-17', 'user-c', 5, 3600) r) s),
  'the decision carries exactly allowed, limit, remaining and a resetAt epoch inside the window [P2-S09-AC-759]');
select is((select count(*) from identity.auth_rate_limits where bucket_digest = decode(pg_temp.r3_digest('user-a'), 'hex') and operation_id = 'AUTH-API-17'),
  1::bigint, 'one counter row per (operation, bucket, window) holds the count');
select throws_ok($$select platform_api.auth_rate_limit('AUTH-API-17', repeat('z', 64), 5, 3600)$$, 'P0001', 'INVALID_REQUEST',
  'a non-hex bucket digest is INVALID_REQUEST');
select throws_ok($$select platform_api.auth_rate_limit('AUTH-API-17', repeat('a', 64), 0, 3600)$$, 'P0001', 'INVALID_REQUEST', 'a zero limit is INVALID_REQUEST');
select throws_ok($$select platform_api.auth_rate_limit('AUTH-API-17', repeat('a', 64), 5, 86401)$$, 'P0001', 'INVALID_REQUEST', 'a window above one day is INVALID_REQUEST');

select * from finish();
rollback;
