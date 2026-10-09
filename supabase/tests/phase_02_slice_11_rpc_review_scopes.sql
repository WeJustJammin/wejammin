-- Slice 11 lane S11-3a: platform_private.cms_editorial_review_scopes (BE03b "Review scopes, reviewer
-- assignment and decision evaluation (DEC-136)"; tracker P2-S11-AC-069, AC-108).  The five scopes are
-- derived server-side; the empty array conceals the review.  RED before 20261005017600.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(20);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/002-reviews.sqlinc
\ir phase_02_slice_11_rpc_review/000-world.sqlinc

create or replace function pg_temp.r11_scopes(p_actor text, p_review text default 'r1', p_party uuid default pg_temp.s11_id('org'))
returns text
language sql
as $body$
  select pg_temp.h11_text(format(
    'select coalesce(array_to_string(platform_private.cms_editorial_review_scopes(%L::uuid, %L::uuid, %L::uuid), '',''), ''<null>'')',
    pg_temp.s11_id(p_review), (select auth_user_id from r11_actor where key = p_actor), p_party))
$body$;

select pg_temp.h11r_review('r1');
select pg_temp.h11r_assign('asg-rvA', 'r1', 'rvA');
select pg_temp.h11r_assign('asg-rvB', 'r1', 'rvB');

select is(pg_temp.r11_scopes('owner'), 'owner,assignee', 'the receipt-derived owner who is also an entry author holds owner and assignee [P2-S11-AC-069]');
select is(pg_temp.r11_scopes('editor'), 'submitter,assignee', 'the submitter who is an entry editor holds submitter and assignee [P2-S11-AC-069]');
select is(pg_temp.r11_scopes('rvA'), 'reviewer', 'a reviewer with a non-revoked assignment (an expired window still reads) holds reviewer [P2-S11-AC-069]');
select is(pg_temp.r11_scopes('pub'), 'publisher', 'an owner-party cms.publisher holds publisher [P2-S11-AC-069]');
select is(pg_temp.r11_scopes('rvS'), '', 'a reviewer without an assignment holds no scope [P2-S11-AC-069]');
select is(pg_temp.r11_scopes('outsider'), '', 'a member with no capability holds no scope [P2-S11-AC-069]');
select is(pg_temp.r11_scopes('stranger'), '', 'a non-member holds no scope even when acting in the owner party [P2-S11-AC-069]');
select is(pg_temp.r11_scopes('owner', 'r1', pg_temp.s11_id('creator')), '', 'a caller acting in another party holds no scope (cross-owner concealment) [P2-S11-AC-069]');
select is(pg_temp.h11_text(format('select cardinality(platform_private.cms_editorial_review_scopes(%L::uuid, null, %L::uuid))',
  pg_temp.s11_id('r1'), pg_temp.s11_id('org'))), '0', 'a null actor holds no scope [P2-S11-AC-069]');
select is(pg_temp.h11_text(format('select cardinality(platform_private.cms_editorial_review_scopes(%L::uuid, %L::uuid, %L::uuid))',
  extensions.gen_random_uuid(), (select auth_user_id from r11_actor where key = 'owner'), pg_temp.s11_id('org'))), '0',
  'an absent review is concealed [P2-S11-AC-069]');

select set_config('app.cms_rpc', 'true', true);
update platform_private.cms_editorial_review_assignments set state = 'revoked', version = version + 1, updated_at = clock_timestamp()
 where id = pg_temp.s11_id('asg-rvA');
select is(pg_temp.r11_scopes('rvA'), '', 'a revoked assignment grants no read scope [P2-S11-AC-069]');
update identity_private.membership_tenure set state = 'ended', revoked_at = clock_timestamp(), ends_on = current_date + 1
 where organization_id = pg_temp.s11_id('org') and person_id = pg_temp.s11_id('rvB');
select is(pg_temp.r11_scopes('rvB'), '', 'an ended membership holds no scope although the assignment row is intact [P2-S11-AC-069]');
update identity_private.organization_actor_grant set active = false
 where organization_id = pg_temp.s11_id('org') and person_id = pg_temp.s11_id('pub') and capability_code = 'cms.publisher';
select is(pg_temp.r11_scopes('pub'), '', 'a deactivated cms.publisher grant removes the publisher scope [P2-S11-AC-069]');
update platform_private.cms_entry_assignments set state = 'revoked', version = version + 1, updated_at = clock_timestamp()
 where entry_id = pg_temp.s11_id('entryA') and assignee_person_id = pg_temp.s11_id('editor');
select is(pg_temp.r11_scopes('editor'), 'submitter', 'without the entry assignment the editor keeps only the submitter scope [P2-S11-AC-069]');

select * from finish();
rollback;
