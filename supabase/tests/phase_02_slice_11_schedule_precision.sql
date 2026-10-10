-- Slice 11 E8 / CMS-03B-20 installed arithmetic UNIT projections (BE03b 266-267,
-- 1823-1834, 1885). No production function is replaced or invoked. No schedule
-- rows, leases, grants, or clocks are changed. These tests do NOT prove INSERT
-- plumbing, branch reachability, lock/RLS/CAS behavior, or a genuine 1 ns sweep.
-- Sources/metadata are captured from this database, never from migration files.
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;
begin;
set local timezone = 'UTC';
select plan(95); -- 95 local; JWT helper and expression include each emit 0 TAP.
\ir phase_02_slice_11_helpers/005-schedule-precision-expressions.sqlinc

select diag(metadata::text) from h11p_catalog order by signature;
select is((select count(*)::integer from h11p_catalog where oid is not null), 5,
  'catalog resolves all five exact live signatures and records full metadata');

-- Ancillary catalog evidence only: no real INSERT/UPDATE or immutable-row proof.
select ok(exists (
  select 1 from pg_catalog.pg_attribute a
  join pg_catalog.pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  where a.attrelid = 'platform_private.cms_publication_schedules'::regclass
    and a.attname = column_name and not a.attisdropped and a.attnotnull
    and a.atttypid = 'smallint'::regtype
    and pg_catalog.pg_get_expr(d.adbin, d.adrelid) in ('0', '0::smallint')
    and exists (select 1 from pg_catalog.pg_constraint c
      where c.conrelid = a.attrelid and c.contype = 'c' and c.convalidated
        and lower(regexp_replace(pg_catalog.pg_get_expr(c.conbin, c.conrelid),
          '[[:space:]()]', '', 'g')) = column_name || '>=0and' || column_name || '<=999')
), 'metadata: ' || column_name || ' is smallint not null default zero bounded 0..999')
from (values ('local_datetime_submicro_ns'), ('resolved_utc_submicro_ns')) columns(column_name);
-- Exact hashes from root's captured PostgreSQL 17.6 baseline receipt named in
-- schedule-nanosecond-implementation-contract-2026-10-10.md (not a runtime cache).
select ok((select md5(prosrc) = 'be0cf18d76840b6722c28d7f85170dfb'
    and md5(definition) = '904d575199e4e15058531f7ba5065e43'
  from h11p_catalog where signature = 'platform_private.cms_schedule_state_guard()'),
  'metadata: immutable schedule guard source and definition remain byte-exact');

select ok(valid, 'extraction is unique complete and SELECT-only: ' || key)
from h11p_expressions order by key; -- 8 validity assertions, never substitutes for values.

select is(pg_temp.h11p_safe('local_value()'), false,
  'lexical safety rejects operand call local_value()');
select is(pg_temp.h11p_safe('pg_catalog.local_value()'), false,
  'lexical safety rejects qualified operand call pg_catalog.local_value()');
select is(pg_temp.h11p_safe('é()'), false,
  'lexical safety rejects non-ASCII identifier call é()');
select is(pg_temp.h11p_safe('pg_catalog.and()'), false,
  'lexical safety rejects qualified syntax-keyword call pg_catalog.and()');
select is(pg_temp.h11p_safe('pg_catalog.or()'), false,
  'lexical safety rejects qualified syntax-keyword call pg_catalog.or()');
select is(pg_temp.h11p_safe('pg_catalog.abs.pg_catalog.round(0)'), false,
  'lexical safety rejects longer qualified call pg_catalog.abs.pg_catalog.round(0)');
select is(pg_temp.h11p_safe('extract(epoch from (stamp))'), true,
  'lexical safety accepts grouped EXTRACT operand without relation reads');
select is(pg_temp.h11p_safe('resolved_value not between (accepted_at) and (stamp)'), true,
  'lexical safety accepts grouped BETWEEN operands');
select is(pg_temp.h11p_safe('pg_catalog.from()'), false,
  'lexical safety rejects qualified syntax-keyword call pg_catalog.from()');
select is(pg_temp.h11p_safe('pg_catalog.between()'), false,
  'lexical safety rejects qualified syntax-keyword call pg_catalog.between()');
select is(pg_temp.h11p_safe('pg_catalog.div(5::numeric, 2::numeric)'), true,
  'lexical safety accepts reviewed pure numeric integral quotient');
select is(pg_temp.h11p_safe('abs . round(0)'), false,
  'lexical safety rejects whitespace-qualified unreviewed call abs . round(0)');
select is(pg_temp.h11p_safe('local_value . abs(0)'), false,
  'lexical safety rejects whitespace-qualified operand call local_value . abs(0)');
select is(pg_temp.h11p_safe('pg_catalog . abs(0)'), true,
  'lexical safety accepts whitespace-qualified reviewed pure call pg_catalog . abs(0)');

-- Both inclusive offset endpoints, with each operand independently carrying ns.
-- Microsecond components agree at the boundary; fixed numeric remainders decide.
select is(pg_temp.h11p_value('offset', jsonb_build_object(
  'local_value', timestamp '2028-01-01 00:00:00.123456' + boundary,
  'resolved_value', '2028-01-01T00:00:00.123456Z',
  'local_submicro_ns', local_ns, 'resolved_submicro_ns', resolved_ns)),
  refused::text, 'offset refusal: ' || title)
from (values
  (1, '-12h -1ns local operand', interval '-12 hours', 499, 500, true),
  (2, '-12h equal local operand', interval '-12 hours', 500, 500, false),
  (3, '-12h +1ns local operand', interval '-12 hours', 501, 500, false),
  (4, '+14h -1ns local operand', interval '14 hours', 499, 500, false),
  (5, '+14h equal local operand', interval '14 hours', 500, 500, false),
  (6, '+14h +1ns local operand', interval '14 hours', 501, 500, true),
  (7, '-12h -1ns resolved operand', interval '-12 hours', 500, 501, true),
  (8, '-12h equal resolved operand', interval '-12 hours', 500, 500, false),
  (9, '-12h +1ns resolved operand', interval '-12 hours', 500, 499, false),
  (10, '+14h -1ns resolved operand', interval '14 hours', 500, 501, false),
  (11, '+14h equal resolved operand', interval '14 hours', 500, 500, false),
  (12, '+14h +1ns resolved operand', interval '14 hours', 500, 499, true)
) cases(ord, title, boundary, local_ns, resolved_ns, refused) order by ord;

-- Legal four-digit years can overflow BIGINT epoch nanoseconds; both operands
-- must stay NUMERIC even when their actual offset is only a boundary plus 1 ns.
select is(pg_temp.h11p_value('offset', jsonb_build_object(
  'local_value', '9999-01-01T14:00:00.123456',
  'resolved_value', '9999-01-01T00:00:00.123456Z',
  'local_submicro_ns', 501, 'resolved_submicro_ns', 500)), 'true',
  'offset refusal: year9999 +14h plus1ns uses complete numeric operands');
select is(pg_temp.h11p_value('offset', jsonb_build_object(
  'local_value', '0001-01-01T00:00:00.123456',
  'resolved_value', '0001-01-01T12:00:00.123456Z',
  'local_submicro_ns', 500, 'resolved_submicro_ns', 501)), 'true',
  'offset refusal: year0001 -12h minus1ns uses complete numeric operands');

-- Deterministic accepted_at T has nonzero submillisecond precision. No wall clock
-- sampling or cast of nine-digit fractions is used to construct boundary inputs.
select is(pg_temp.h11p_value('horizon', jsonb_build_object(
  'accepted_at', '2028-01-01T00:00:00.123456Z',
  'resolved_value', resolved, 'resolved_submicro_ns', ns)),
  refused::text, 'horizon refusal: ' || title)
from (values
  (1, 'minimum -1ns', '2028-01-01T00:01:00.123455Z', 999, true),
  (2, 'minimum equal', '2028-01-01T00:01:00.123456Z', 0, false),
  (3, 'minimum +1ns', '2028-01-01T00:01:00.123456Z', 1, false),
  (4, 'maximum -1ns', '2029-01-01T00:00:00.123455Z', 999, false),
  (5, 'maximum equal', '2029-01-01T00:00:00.123456Z', 0, false),
  (6, 'maximum +1ns', '2029-01-01T00:00:00.123456Z', 1, true)
) cases(ord, title, resolved, ns, refused) order by ord;

-- Compare the COMPLETE exact two-key JSON envelope; permit six or nine canonical
-- digits independently. auth_iso_time remains whitelisted but loses .000456 here.
select ok(pg_temp.h11p_value('detail',
  '{"accepted_at":"2028-01-01T00:00:00.123456Z"}'::jsonb) in (
    select jsonb_build_object('minUtc', minimum, 'maxUtc', maximum)::text
    from (values ('2028-01-01T00:01:00.123456Z'),
                 ('2028-01-01T00:01:00.123456000Z')) mins(minimum)
    cross join (values ('2029-01-01T00:00:00.123456Z'),
                       ('2029-01-01T00:00:00.123456000Z')) maxs(maximum)),
  'horizon DETAIL preserves exact microseconds and only minUtc/maxUtc');

-- The WHOLE pending OR retry predicate is projected, including disallowed states.
-- Retry due time deliberately contradicts the original scheduled instant.
select is(pg_temp.h11p_value('due', jsonb_build_object(
  'stamp', '2028-01-01T00:00:00Z', 'state', state,
  'resolved_at_utc', resolved, 'resolved_utc_submicro_ns', ns,
  'next_attempt_at', retry)), expected::text, 'claim due: ' || title)
from (values
  (1, 'pending T exact', 'pending', '2028-01-01T00:00:00Z', 0, null, true),
  (2, 'pending T plus 1ns', 'pending', '2028-01-01T00:00:00Z', 1, null, false),
  (3, 'pending T minus 1ns', 'pending', '2027-12-31T23:59:59.999999Z', 999, null, true),
  (4, 'retry below T ignores future original', 'failed_retryable', '2028-01-02T00:00:00Z', 1, '2027-12-31T23:59:59.999999Z', true),
  (5, 'retry equal T ignores future original', 'failed_retryable', '2028-01-02T00:00:00Z', 1, '2028-01-01T00:00:00Z', true),
  (6, 'retry above T ignores past original', 'failed_retryable', '2027-12-31T00:00:00Z', 0, '2028-01-01T00:00:00.000001Z', false),
  (7, 'executing never claimable', 'executing', '2027-12-31T00:00:00Z', 0, '2027-12-31T00:00:00Z', false),
  (8, 'completed never claimable', 'completed', '2027-12-31T00:00:00Z', 0, '2027-12-31T00:00:00Z', false),
  (9, 'blocked never claimable', 'blocked', '2027-12-31T00:00:00Z', 0, '2027-12-31T00:00:00Z', false),
  (10, 'cancelled never claimable', 'cancelled', '2027-12-31T00:00:00Z', 0, '2027-12-31T00:00:00Z', false)
) cases(ord, title, state, resolved, ns, retry, expected) order by ord;

-- Both complete ORDER BY lists run unchanged: selection's schedule_item AND
-- returned aggregation's moved aliases exist, with the new remainder column.
select is(pg_temp.h11p_order(key, rows), expected::jsonb::text,
  key || ': ' || title)
from (values ('claim_order'), ('return_order')) expressions(key)
cross join (values
  (1, 'nanoseconds precede reversed UUID order',
   '[{"id":"00000000-0000-0000-0000-000000000001","resolved_at_utc":"2028-01-01T00:00:00Z","resolved_utc_submicro_ns":501},
     {"id":"00000000-0000-0000-0000-000000000002","resolved_at_utc":"2028-01-01T00:00:00Z","resolved_utc_submicro_ns":500}]'::jsonb,
   '["00000000-0000-0000-0000-000000000002","00000000-0000-0000-0000-000000000001"]'),
  (2, 'equal exact instants retain UUID order',
   '[{"id":"00000000-0000-0000-0000-000000000002","resolved_at_utc":"2028-01-01T00:00:00Z","resolved_utc_submicro_ns":500},
     {"id":"00000000-0000-0000-0000-000000000001","resolved_at_utc":"2028-01-01T00:00:00Z","resolved_utc_submicro_ns":500}]'::jsonb,
   '["00000000-0000-0000-0000-000000000001","00000000-0000-0000-0000-000000000002"]'),
  (3, 'timestamp component precedes opposing remainder and UUID order',
   '[{"id":"00000000-0000-0000-0000-000000000001","resolved_at_utc":"2028-01-01T00:00:00.000001Z","resolved_utc_submicro_ns":0},
     {"id":"00000000-0000-0000-0000-000000000002","resolved_at_utc":"2028-01-01T00:00:00Z","resolved_utc_submicro_ns":999}]'::jsonb,
   '["00000000-0000-0000-0000-000000000002","00000000-0000-0000-0000-000000000001"]')
) cases(ord, title, rows, expected) order by key, ord;

-- Root's live PostgreSQL 17.6 baseline double ties were [0,2,2,0,-2,-2].
-- This calibration is not the deviation oracle: every expected answer below is
-- a fixed NUMERIC literal. Near ties never use floating point as a reference.
select is(jsonb_agg(pg_catalog.round(tie::double precision) order by ord),
  '[0,2,2,0,-2,-2]'::jsonb, 'live double half ties retain captured nearest-even baseline')
from (values (1, 0.5::numeric), (2, 1.5), (3, 2.5),
             (4, -0.5), (5, -1.5), (6, -2.5)) ties(ord, tie);

select is(pg_temp.h11p_value('deviation', jsonb_build_object(
  'actual_at', actual, 'resolved_at_utc', scheduled, 'resolved_utc_submicro_ns', ns)),
  expected::text, 'deviation: ' || title)
from (values
  (1, 'actual T+1 scheduled T+.499999999 => 1', '2028-01-01T00:00:01Z', '2028-01-01T00:00:00.499999Z', 999, 1::numeric),
  (2, 'actual T+1 scheduled T+.500000000 => 0', '2028-01-01T00:00:01Z', '2028-01-01T00:00:00.500000Z', 0, 0),
  (3, 'actual T+1 scheduled T+.500000001 => 0', '2028-01-01T00:00:01Z', '2028-01-01T00:00:00.500000Z', 1, 0),
  (4, 'actual T scheduled T+.499999999 => 0', '2028-01-01T00:00:00Z', '2028-01-01T00:00:00.499999Z', 999, 0),
  (5, 'actual T scheduled T+.500000000 => 0', '2028-01-01T00:00:00Z', '2028-01-01T00:00:00.500000Z', 0, 0),
  (6, 'actual T scheduled T+.500000001 => -1', '2028-01-01T00:00:00Z', '2028-01-01T00:00:00.500000Z', 1, -1),
  (7, '+1.5 minus 1ns => 1', '2028-01-01T00:00:00Z', '2027-12-31T23:59:58.500000Z', 1, 1),
  (8, '+1.5 exact => 2', '2028-01-01T00:00:00Z', '2027-12-31T23:59:58.500000Z', 0, 2),
  (9, '+1.5 plus 1ns => 2', '2028-01-01T00:00:00Z', '2027-12-31T23:59:58.499999Z', 999, 2),
  (10, '-1.5 plus 1ns => -1', '2028-01-01T00:00:00Z', '2028-01-01T00:00:01.499999Z', 999, -1),
  (11, '-1.5 exact => -2', '2028-01-01T00:00:00Z', '2028-01-01T00:00:01.500000Z', 0, -2),
  (12, '-1.5 minus 1ns => -2', '2028-01-01T00:00:00Z', '2028-01-01T00:00:01.500000Z', 1, -2),
  (13, '+2.5 minus 1ns => 2', '2028-01-01T00:00:00Z', '2027-12-31T23:59:57.500000Z', 1, 2),
  (14, '+2.5 exact => 2', '2028-01-01T00:00:00Z', '2027-12-31T23:59:57.500000Z', 0, 2),
  (15, '+2.5 plus 1ns => 3', '2028-01-01T00:00:00Z', '2027-12-31T23:59:57.499999Z', 999, 3),
  (16, '-2.5 plus 1ns => -2', '2028-01-01T00:00:00Z', '2028-01-01T00:00:02.499999Z', 999, -2),
  (17, '-2.5 exact => -2', '2028-01-01T00:00:00Z', '2028-01-01T00:00:02.500000Z', 0, -2),
  (18, '-2.5 minus 1ns => -3', '2028-01-01T00:00:00Z', '2028-01-01T00:00:02.500000Z', 1, -3),
  (19, 'zero => 0', '2028-01-01T00:00:00Z', '2028-01-01T00:00:00Z', 0, 0),
  (20, 'positive whole second => 1', '2028-01-01T00:00:01Z', '2028-01-01T00:00:00Z', 0, 1),
  (21, 'negative whole second => -1', '2028-01-01T00:00:00Z', '2028-01-01T00:00:01Z', 0, -1)
) cases(ord, title, actual, scheduled, ns, expected) order by ord;

-- Large valid second deltas make a 1 ns neighbor smaller than a double ULP.
-- Literal integer answers are independent of the installed expression.
select is(pg_temp.h11p_value('deviation', jsonb_build_object(
  'actual_at', timestamptz '2028-01-01T00:00:00Z' + actual_delta,
  'resolved_at_utc', '2028-01-01T00:00:00Z',
  'resolved_utc_submicro_ns', ns)), expected::text, 'deviation: ' || title)
from (values
  (1, '+30000001.5 minus1ns => 30000001', interval '30000001.5 seconds', 1, 30000001::numeric),
  (2, '+30000000.5 plus1ns => 30000001', interval '30000000.500001 seconds', 999, 30000001),
  (3, '-30000001.5 plus1ns => -30000001', interval '-30000001.499999 seconds', 999, -30000001),
  (4, '-30000000.5 minus1ns => -30000001', interval '-30000000.5 seconds', 1, -30000001)
) cases(ord, title, actual_delta, ns, expected) order by ord;

-- Exact canonical text, never a timestamptz cast which would lose the remainder.
select ok(pg_temp.h11p_value('workflow', jsonb_build_object(
  'resolved_at_utc', stored, 'resolved_utc_submicro_ns', ns)) in (expected, six_digits),
  'workflow resolvedUtc: ' || title)
from (values
  (1, '.000000001', '2028-01-01T12:00:00Z', 1, '2028-01-01T12:00:00.000000001Z', '2028-01-01T12:00:00.000000001Z'),
  (2, '.123456789', '2028-01-01T00:00:00.123456Z', 789, '2028-01-01T00:00:00.123456789Z', '2028-01-01T00:00:00.123456789Z'),
  (3, '.999999999 before UTC midnight', '2028-01-01T23:59:59.999999Z', 999, '2028-01-01T23:59:59.999999999Z', '2028-01-01T23:59:59.999999999Z'),
  (4, 'UTC midnight plus 1ns', '2028-01-02T00:00:00Z', 1, '2028-01-02T00:00:00.000000001Z', '2028-01-02T00:00:00.000000001Z'),
  (5, 'equivalent +05:30 offset', '2028-01-01T05:30:00.123456+05:30', 789, '2028-01-01T00:00:00.123456789Z', '2028-01-01T00:00:00.123456789Z'),
  (6, 'legacy zero remainder preserves microseconds', '2028-01-01T00:00:00.654321Z', 0, '2028-01-01T00:00:00.654321000Z', '2028-01-01T00:00:00.654321Z')
) cases(ord, title, stored, ns, expected, six_digits) order by ord;

select * from finish();
rollback;
