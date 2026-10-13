\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 12 FIX lane, CMS-03C-01: BE03c E13 (the template keys `context`, `versions` and `new`
-- are reserved: a SQL CHECK and the RPC refuse them with the typed token key_reserved at
-- /templateKey) and E4 (audience matches ^[a-z0-9_-]{1,48}$ as submitted, never trimmed).
-- [P2-S12-AC-005] [P2-S12-AC-022] [P2-S12-AC-025] [P2-S12-AC-189] [P2-S12-AC-192]

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_12_fix/000-owners.sqlinc

-- ---------------------------------------------------------------- catalog shape --
select is(
  (select pg_get_constraintdef(oid) from pg_catalog.pg_constraint
    where conrelid = 'platform_private.cms_template_versions'::regclass
      and conname = 'cms_template_versions_template_key_not_reserved'),
  $d$CHECK ((template_key <> ALL (ARRAY['context'::text, 'versions'::text, 'new'::text])))$d$,
  'E13: a CHECK refuses the reserved template keys [P2-S12-AC-189]');
select is(
  (select convalidated from pg_catalog.pg_constraint
    where conrelid = 'platform_private.cms_template_versions'::regclass
      and conname = 'cms_template_versions_template_key_not_reserved'),
  true,
  'E13: the reserved-key CHECK is validated on a clean table [P2-S12-AC-189]');
select is(
  (select pg_get_constraintdef(oid) from pg_catalog.pg_constraint
    where conrelid = 'platform_private.cms_template_versions'::regclass
      and conname = 'cms_template_versions_audience_grammar'),
  $d$CHECK ((audience ~ '^[a-z0-9_-]{1,48}$'::text))$d$,
  'E4: a CHECK enforces the audience grammar [P2-S12-AC-192]');
select is(
  (select convalidated from pg_catalog.pg_constraint
    where conrelid = 'platform_private.cms_template_versions'::regclass
      and conname = 'cms_template_versions_audience_grammar'),
  true,
  'E4: the audience CHECK is validated on a clean table [P2-S12-AC-192]');

-- --------------------------------------------------------------- reserved keys (RPC) --
select pg_temp.s12fix_as('A');
select is(
  pg_temp.s12fix_define(pg_temp.s12fix_req('A', reserved.key, 's12fix-reserved-' || reserved.n || '-0001')),
  jsonb_build_object('state', 'P0001', 'message', 'key_reserved',
    'detail', '["/templateKey"]', 'constraint', ''),
  'E13: the RPC refuses the reserved key ' || reserved.key || ' with key_reserved at /templateKey [P2-S12-AC-189]')
from (values (1, 'context'), (2, 'versions'), (3, 'new')) reserved(n, key);
select is(
  pg_temp.s12fix_define(pg_temp.s12fix_req('A', reserved.key, 's12fix-reserved-succ-' || reserved.n || '-0001', '1')),
  jsonb_build_object('state', 'P0001', 'message', 'key_reserved',
    'detail', '["/templateKey"]', 'constraint', ''),
  'E13: a successor naming the reserved key ' || reserved.key || ' is key_reserved before any lookup [P2-S12-AC-189]')
from (values (1, 'context'), (2, 'versions'), (3, 'new')) reserved(n, key);
select is(
  (select count(*)::integer from platform_private.cms_template_versions
    where template_key in ('context', 'versions', 'new')),
  0,
  'E13: a refused reserved key writes no row [P2-S12-AC-189]');
select is(
  (select count(*)::integer from platform_private.idempotency_records
    where key_hash in (
      select platform_private.cms_key_hash('s12fix-reserved-' || n || '-0001')
        from generate_series(1, 3) n)),
  0,
  'E13: a refused reserved key leaves no idempotency reservation behind [P2-S12-AC-189]');
select is(
  pg_temp.s12fix_define(pg_temp.s12fix_req('A', near.key, 's12fix-near-' || near.n || '-0001'))->>'state',
  '00000',
  'E13: ' || near.key || ' is not reserved (exact match only) [P2-S12-AC-189]')
from (values (1, 'context-2'), (2, 'new-page'), (3, 'versions2'), (4, 'newer')) near(n, key);

-- ------------------------------------------------------------ reserved keys (direct) --
select set_config('app.cms_rpc', 'true', true);
create temp table s12fix_seed on commit drop as
select id from platform_private.cms_template_versions where template_key = 'newer' limit 1;
select is(
  pg_temp.s12fix_clone((select id from s12fix_seed), reserved.key)->>'constraint',
  'cms_template_versions_template_key_not_reserved',
  'E13: a direct insert of the reserved key ' || reserved.key || ' violates the CHECK [P2-S12-AC-189]')
from (values ('context'), ('versions'), ('new')) reserved(key);
select is(
  pg_temp.s12fix_clone((select id from s12fix_seed), reserved.key)->>'state',
  '23514',
  'E13: that violation is a check_violation (23514) for ' || reserved.key || ' [P2-S12-AC-189]')
from (values ('context'), ('versions'), ('new')) reserved(key);
select is(
  pg_temp.s12fix_clone((select id from s12fix_seed), 'context-direct')->>'state',
  '00000',
  'E13: a near-miss key inserts directly [P2-S12-AC-189]');

-- ------------------------------------------------------------ audience grammar (RPC) --
select is(
  pg_temp.s12fix_define(pg_temp.s12fix_req('A', 's12fix-aud-bad-' || bad.n,
    's12fix-aud-bad-' || bad.n || '-0001', null, bad.audience)),
  jsonb_build_object('state', 'P0001', 'message', 'VALIDATION_FAILED',
    'detail', '["/audience"]', 'constraint', ''),
  'E4: the RPC refuses audience ' || bad.label || ' at /audience [P2-S12-AC-192] [P2-S12-AC-025]')
from (values
  (1, 'Public (uppercase)', 'Public'),
  (2, 'with a leading space', ' public'),
  (3, 'with a trailing space', 'public '),
  (4, 'of 49 characters', repeat('a', 49)),
  (5, 'with an inner space', 'a b'),
  (6, 'with a trailing newline', E'public\n'),
  (7, 'with a dot', 'pub.lic'),
  (8, 'that is empty', ''),
  (9, 'with a non-ASCII letter', 'pübl'),
  (10, 'with markup', 'public<b>'),
  (11, 'with a tab', E'pu\tblic')
) bad(n, label, audience);
select is(
  (select count(*)::integer from platform_private.cms_template_versions
    where template_key like 's12fix-aud-bad-%'),
  0,
  'E4: a refused audience writes no row [P2-S12-AC-192]');
select is(
  pg_temp.s12fix_define(pg_temp.s12fix_req('A', 's12fix-aud-ok-' || good.n,
    's12fix-aud-ok-' || good.n || '-0001', null, good.audience))->>'state',
  '00000',
  'E4: the RPC accepts audience ' || good.label || ' [P2-S12-AC-192]')
from (values
  (1, 'public', 'public'),
  (2, 'members_only', 'members_only'),
  (3, 'a-b_c9', 'a-b_c9'),
  (4, 'of exactly 48 characters', repeat('a', 48)),
  (5, 'of one character', 'a'),
  (6, 'of digits', '0123456789')
) good(n, label, audience);
select is(
  (select audience from platform_private.cms_template_versions
    where template_key = 's12fix-aud-ok-4'),
  repeat('a', 48),
  'E4: the stored audience is exactly as submitted, never trimmed or folded [P2-S12-AC-025]');
select is(
  pg_temp.s12fix_define(jsonb_set(
    pg_temp.s12fix_req('A', 's12fix-aud-number', 's12fix-aud-number-0001'),
    '{audience}', '5'::jsonb))->>'message',
  'VALIDATION_FAILED',
  'E4: a non-string audience is VALIDATION_FAILED [P2-S12-AC-005]');

-- ------------------------------------------------------- audience grammar (direct) --
select is(
  pg_temp.s12fix_clone((select id from s12fix_seed), 's12fix-aud-direct-' || bad.n, bad.audience)->>'constraint',
  'cms_template_versions_audience_grammar',
  'E4: a direct insert of audience ' || bad.label || ' violates the CHECK [P2-S12-AC-192]')
from (values
  (1, 'Public', 'Public'), (2, 'padded', ' public '), (3, 'of 49 characters', repeat('a', 49)),
  (4, 'with an inner space', 'a b'), (5, 'with a trailing newline', E'public\n')
) bad(n, label, audience);
select is(
  pg_temp.s12fix_clone((select id from s12fix_seed), 's12fix-aud-direct-ok', 'ok_audience-1')->>'state',
  '00000',
  'E4: a direct insert of a conforming audience succeeds [P2-S12-AC-192]');

select finish();
rollback;
