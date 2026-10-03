commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 F1 closure: the database bucket refusal behind the 429 RATE_LIMITED
-- rows of BE03a CMS-03A-09..18.  The Worker maps every CMS operation onto the
-- shared platform_api.auth_rate_limit under the fallback operation id
-- AUTH-API-15 (apps/worker/src/authentication/production-rate-limit.ts), with a
-- per-operation, per-scope bucket digest, the route's per-user limit and
-- per-party limit, and a 60-second window.  This file exhausts each of those
-- real buckets through the real RPC and asserts the refusal shape the Worker
-- turns into 429.  The Worker half (the same limits exhausted through the real
-- Hono app and limiter adapter) is
-- apps/worker/src/content-schema-registry/phase-02-slice-09-f1-429-502-rows.test.ts.
--
--   CMS-03A-01, 09, 10, 11  cms-definition-write  30 per user, 60 per party / 60 s
--   CMS-03A-12          cms-activation        30 per user, 60 per party / 60 s
--   CMS-03A-13, 18      cms-definition-read   120 per user, 240 per party / 60 s
--   CMS-03A-14..17      cms-activation        10 per user, 20 per party / 60 s

create or replace function pg_temp.f1_wait_window(p_window integer) returns void language plpgsql as $body$
declare remaining numeric;
begin
  remaining := p_window - mod(extract(epoch from clock_timestamp())::numeric, p_window);
  if remaining < 8 then
    perform pg_sleep(remaining + 0.2);
  end if;
end;
$body$;
create or replace function pg_temp.f1_digest(p_label text) returns text language sql immutable as $body$
  select encode(extensions.digest('f1-cms-rate-' || p_label, 'sha256'), 'hex') $body$;

-- (operation, marker, per-user limit, per-party limit)
create temp table f1_cases(op text, marker text, user_limit integer, party_limit integer) on commit drop;
insert into f1_cases values
  ('CMS-03A-01', '[P2-S09-AC-193]', 30, 60),
  ('CMS-03A-09', '[P2-S09-AC-311] [P2-S09-AC-303]', 30, 60),
  ('CMS-03A-10', '[P2-S09-AC-357]', 30, 60),
  ('CMS-03A-11', '[P2-S09-AC-399]', 30, 60),
  ('CMS-03A-12', '[P2-S09-AC-436]', 30, 60),
  ('CMS-03A-13', '[P2-S09-AC-459] [P2-S09-AC-454]', 120, 240),
  ('CMS-03A-14', '[P2-S09-AC-498]', 10, 20),
  ('CMS-03A-15', '[P2-S09-AC-540]', 10, 20),
  ('CMS-03A-16', '[P2-S09-AC-569]', 10, 20),
  ('CMS-03A-17', '[P2-S09-AC-597]', 10, 20),
  ('CMS-03A-18', '[P2-S09-AC-623]', 120, 240);

create temp table f1_results(op text, scope text, n integer, decision jsonb) on commit drop;
create or replace function pg_temp.f1_run() returns void language plpgsql as $body$
declare c record; i integer;
begin
  perform pg_temp.f1_wait_window(60);
  for c in select * from f1_cases loop
    for i in 1..c.user_limit + 2 loop
      insert into f1_results values (c.op, 'user', i,
        platform_api.auth_rate_limit('AUTH-API-15', pg_temp.f1_digest(c.op || '-user'), c.user_limit, 60));
    end loop;
    for i in 1..c.party_limit + 2 loop
      insert into f1_results values (c.op, 'party', i,
        platform_api.auth_rate_limit('AUTH-API-15', pg_temp.f1_digest(c.op || '-party'), c.party_limit, 60));
    end loop;
  end loop;
end;
$body$;
select pg_temp.f1_run();

-- One assertion per operation and clause, each titled with the operation's 429 row.
select is(
  (select count(*) from f1_results r where r.op = c.op and r.scope = 'user' and r.n <= c.user_limit and not (r.decision->>'allowed')::boolean),
  0::bigint,
  c.op || ' user bucket: the first ' || c.user_limit || ' requests in the window are allowed ' || c.marker)
from f1_cases c order by c.op;

select ok(
  (select r.decision->>'allowed' = 'false' from f1_results r where r.op = c.op and r.scope = 'user' and r.n = c.user_limit + 1),
  c.op || ' user bucket: request ' || (c.user_limit + 1) || ' is refused (allowed false), the 429 condition ' || c.marker)
from f1_cases c order by c.op;

select is(
  (select r.decision->>'remaining' from f1_results r where r.op = c.op and r.scope = 'user' and r.n = c.user_limit + 1),
  '0',
  c.op || ' user bucket: the refusal reports remaining 0 ' || c.marker)
from f1_cases c order by c.op;

select is(
  (select r.decision->>'limit' from f1_results r where r.op = c.op and r.scope = 'user' and r.n = c.user_limit + 1),
  c.user_limit::text,
  c.op || ' user bucket: the refusal reports the declared per-user limit ' || c.marker)
from f1_cases c order by c.op;

select ok(
  (select r.decision->>'allowed' = 'false' from f1_results r where r.op = c.op and r.scope = 'user' and r.n = c.user_limit + 2),
  c.op || ' user bucket: every later request in the window stays refused ' || c.marker)
from f1_cases c order by c.op;

select ok(
  (select r.decision->>'allowed' = 'true' and r.decision->>'remaining' = '0' from f1_results r where r.op = c.op and r.scope = 'user' and r.n = c.user_limit),
  c.op || ' user bucket: the request at the limit is the last allowed one with remaining 0 ' || c.marker)
from f1_cases c order by c.op;

select ok(
  (select r.decision->>'allowed' = 'false' from f1_results r where r.op = c.op and r.scope = 'party' and r.n = c.party_limit + 1)
  and (select r.decision->>'allowed' = 'true' from f1_results r where r.op = c.op and r.scope = 'party' and r.n = c.party_limit),
  c.op || ' party bucket: ' || c.party_limit || ' allowed then the next is refused (429 per party) ' || c.marker)
from f1_cases c order by c.op;

select ok(
  (select (r.decision ? 'allowed') and (r.decision ? 'limit') and (r.decision ? 'remaining') and (r.decision ? 'resetAt')
     and (select count(*) = 4 from jsonb_object_keys(r.decision))
     and (r.decision->>'resetAt')::bigint > extract(epoch from clock_timestamp())::bigint - 1
     and (r.decision->>'resetAt')::bigint <= extract(epoch from clock_timestamp())::bigint + 60
   from f1_results r where r.op = c.op and r.scope = 'user' and r.n = c.user_limit + 1),
  c.op || ' refusal carries exactly allowed, limit, remaining and a resetAt epoch inside the 60-second window ' || c.marker)
from f1_cases c order by c.op;

-- Buckets are independent: the exhausted user bucket of one operation does not
-- refuse another operation's user bucket or this operation's party bucket.
select pg_temp.f1_wait_window(60);
select is(
  platform_api.auth_rate_limit('AUTH-API-15', pg_temp.f1_digest('CMS-03A-09-user-other'), 30, 60)->>'allowed', 'true',
  'a different bucket digest under the same fallback operation id is not refused by an exhausted CMS bucket [P2-S09-AC-311]');
select is(
  (select count(*) from identity.auth_rate_limits where operation_id = 'AUTH-API-15' and bucket_digest = decode(pg_temp.f1_digest('CMS-03A-14-user'), 'hex')),
  1::bigint,
  'one counter row per bucket and window holds the whole count of an exhausted CMS bucket [P2-S09-AC-498]');
select is(
  (select request_count from identity.auth_rate_limits where operation_id = 'AUTH-API-15' and bucket_digest = decode(pg_temp.f1_digest('CMS-03A-14-user'), 'hex')),
  12,
  'the counter keeps counting past the limit (limit 10, 12 requests) so refusals are decided by count, not by a reset [P2-S09-AC-498]');

select * from finish();
rollback;
