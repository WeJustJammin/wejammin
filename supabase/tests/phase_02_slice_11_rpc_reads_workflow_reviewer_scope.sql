-- Slice 11 lane reviewA-1: the reviewer read scope of platform_api.cms_get_entry_workflow (CMS-03B-15; tracker
-- P2-S11-AC-051, review finding A-M14).  BE03b: the read is open to an entry assignee, the owner-party publisher or
-- an "active reviewer assignee of a review of the revision"; a visible entry without that scope is 403
-- capability_missing.  phase_02_slice_11_rpc_reads_workflow.sql proves the negatives of an unassigned reviewer and a
-- capability-less member; this file adds the two negatives the scope definition itself names and no test drove:
--   * a reviewer whose assignment was REVOKED reads no workflow of the revision (it still reads as a stranger of the
--     scope, never as a concealed 404: 403);
--   * an active assignee of a review of ANOTHER revision of the same entry, and of a review of another entry, holds
--     no scope on this revision.
-- The positive control (an active assignee reads the revision its review is of) is in the same file so the
-- refusals are about the scope and not about the world.

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

create temp table r11_snap(label text primary key, effects text not null) on commit drop;

-- rs-open: one revision, an OPEN review assigned to rvA and (later revoked) to rvB.
-- rs-two: two revisions; the review is of the FIRST one and rvB holds an active assignment on it.
select pg_temp.r11_entry('rs-open');
select pg_temp.r11_entry('rs-two');
select pg_temp.h11w_revision('rs-two2', 'creatorPerson', 'en-US', '[]'::jsonb, 'rs-two', 2);
select pg_temp.h11_raw_exec('platform_private.cms_entry_revisions', format(
  $$update platform_private.cms_entry_revisions set payload_hash = platform_private.cms_draft_content_hash(id, locale) where id = %L$$,
  pg_temp.h11w_uuid('rs-two2:revision')));

select pg_temp.r11r_review('rso', 'rs-open', 'editor');
select pg_temp.r11_assign_now('rso-rvA', 'rso', 'rvA');
select pg_temp.r11_assign_now('rso-rvB', 'rso', 'rvB');
-- The review of the first revision of rs-two (created after revision 2 exists, so it is not invalidated by it).
select pg_temp.r11r_review('rst', 'rs-two', 'editor');
select pg_temp.r11_assign_now('rst-rvB', 'rst', 'rvB');

create or replace function pg_temp.r11s_rq(p_tag text, p_extra jsonb default '{}'::jsonb)
returns jsonb language sql as $body$
  select jsonb_build_object('entryId', pg_temp.h11w_uuid(p_tag || ':entry'), 'context', pg_temp.r11_ctx()) || p_extra
$body$;

select is(
  (select string_agg(a.key || '=' || assignment.state, ',' order by a.key)
     from (values ('rso-rvA'), ('rso-rvB'), ('rst-rvB')) a(key)
     join platform_private.cms_editorial_review_assignments assignment on assignment.id = pg_temp.s11_id(a.key)),
  'rso-rvA=active,rso-rvB=active,rst-rvB=active',
  'control: rvA and rvB hold active assignments on the review of rs-open and rvB on the review of the first revision of rs-two');

-- A revoked assignment confers nothing.  The revocation is the fixture (a raw write, so it is made BEFORE the effect
-- snapshot): every statement after the snapshot is a read.
select pg_temp.h11_raw_exec('platform_private.cms_editorial_review_assignments', format(
  $$update platform_private.cms_editorial_review_assignments set state = 'revoked', version = version + 1 where id = %L$$,
  pg_temp.s11_id('rso-rvB')));
insert into r11_snap(label, effects) values ('before', pg_temp.r11r_effects());

-- Positive controls: an active assignee reads exactly the revision its review is of.
select pg_temp.r11r_call('ok-rvA', 'cms_get_entry_workflow', 'rvA', pg_temp.r11s_rq('rs-open'));
select ok(pg_temp.r11_out('ok-rvA') = '00000:'
    and pg_temp.r11_resp('ok-rvA')#>>'{review,id}' = pg_temp.s11_id('rso')::text
    and pg_temp.r11_resp('ok-rvA')->'preparation' = 'null'::jsonb,
  'control: an active reviewer assignee reads the workflow of the revision of its review (the review is served, no preparation) [P2-S11-AC-051]');
select pg_temp.r11r_call('ok-rvB-first', 'cms_get_entry_workflow', 'rvB',
  pg_temp.r11s_rq('rs-two', jsonb_build_object('revisionId', pg_temp.h11w_uuid('rs-two:revision'))));
select ok(pg_temp.r11_out('ok-rvB-first') = '00000:'
    and pg_temp.r11_resp('ok-rvB-first')#>>'{revision,id}' = pg_temp.h11w_uuid('rs-two:revision')::text
    and pg_temp.r11_resp('ok-rvB-first')#>>'{review,id}' = pg_temp.s11_id('rst')::text,
  'control: an active assignee of the review of the FIRST revision of rs-two reads that revision [P2-S11-AC-051]');

-- Another revision of the same entry: the default revision is the current draft (revision 2).
select pg_temp.r11r_call('other-revision-default', 'cms_get_entry_workflow', 'rvB', pg_temp.r11s_rq('rs-two'), false);
select pg_temp.r11r_call('other-revision-named', 'cms_get_entry_workflow', 'rvB',
  pg_temp.r11s_rq('rs-two', jsonb_build_object('revisionId', pg_temp.h11w_uuid('rs-two2:revision'))), false);
select is(
  pg_temp.r11_out('other-revision-default') || '|' || coalesce(pg_temp.r11_detail('other-revision-default'), 'null')
    || ' ' || pg_temp.r11_out('other-revision-named') || '|' || coalesce(pg_temp.r11_detail('other-revision-named'), 'null'),
  'P0001:capability_missing|null P0001:capability_missing|null',
  'an active assignee of a review of another revision of the entry holds no read scope on this revision (default and named): 403 capability_missing [P2-S11-AC-051]');

-- Another entry: rvA is assigned only on the review of rs-open.
select pg_temp.r11r_call('other-entry', 'cms_get_entry_workflow', 'rvA', pg_temp.r11s_rq('rs-two'), false);
select is(pg_temp.r11_out('other-entry') || '|' || coalesce(pg_temp.r11_detail('other-entry'), 'null'),
  'P0001:capability_missing|null',
  'an active assignee of a review of ANOTHER entry holds no read scope on this entry: 403 capability_missing [P2-S11-AC-051]');

-- The revoked assignment of rvB on the review of rs-open (revoked above) confers nothing.
select pg_temp.r11r_call('revoked-rvB', 'cms_get_entry_workflow', 'rvB', pg_temp.r11s_rq('rs-open'), false);
select is(pg_temp.r11_out('revoked-rvB') || '|' || coalesce(pg_temp.r11_detail('revoked-rvB'), 'null'),
  'P0001:capability_missing|null',
  'a reviewer whose assignment was REVOKED holds no read scope: 403 capability_missing, not a concealed 404 and not a served workflow [P2-S11-AC-051]');
select pg_temp.r11r_call('ok-rvA-after', 'cms_get_entry_workflow', 'rvA', pg_temp.r11s_rq('rs-open'));
select ok(pg_temp.r11_out('ok-rvA-after') = '00000:',
  'control: revoking rvB''s assignment left the other reviewer''s scope intact [P2-S11-AC-051]');

-- The refusals are the same shape a stranger of the scope gets, and the member is still a member (not concealed).
select pg_temp.r11r_call('stranger', 'cms_get_entry_workflow', 'stranger', pg_temp.r11s_rq('rs-open'), false);
select isnt(pg_temp.r11_out('revoked-rvB'), pg_temp.r11_out('stranger'),
  'the revoked reviewer is told 403 (a visible entry without scope) while a non-member is concealed 404: the two are not conflated [P2-S11-AC-051]');

select ok(pg_temp.r11r_effects() = (select effects from r11_snap where label = 'before'),
  'the reads above write nothing [P2-S11-AC-053]');

select * from finish();
rollback;
