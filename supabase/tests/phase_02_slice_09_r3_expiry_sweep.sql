\ir support/jwt-claims.sqlinc
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 audit remediation (R3 follow-up, AC1135): expiry of a specialist
-- capability or of a reviewer assignment has no event, so a scheduled sweep
-- invalidates every open or approved CMS schema review whose counted approve
-- decision relied on an authority that has since lapsed.  The candidate returns
-- to an editable draft, the BE00 audit and outbox rows are written, the batch is
-- bounded, and the sweep is idempotent.  Every candidate, review, assignment,
-- decision and grant comes from the named producers; only authority windows are
-- time-shifted (s09g_warp / s09d_timewarp, never a row creation).

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc

create or replace function pg_temp.r3sw_sweep(p_label text, p_batch anyelement) returns jsonb
language plpgsql as $body$
declare result jsonb;
begin
  -- the sweep is a service-role Worker command: a request of its own, with no human session published
  perform set_config('app.cms_session_actor', '', true);
  perform set_config('app.cms_session_party', '', true);
  perform pg_temp.set_jwt_claim('role', 'service_role', true);
  begin
    execute format('select platform_api.cms_sweep_expired_review_authority(%L::integer)', p_batch) into result;
    insert into s09d_probe values (p_label, '00000', null, result, null)
    on conflict (label) do update set state = excluded.state, message = excluded.message, response = excluded.response;
  exception when others then
    insert into s09d_probe values (p_label, sqlstate, sqlerrm, null, null)
    on conflict (label) do update set state = excluded.state, message = excluded.message, response = excluded.response;
    return null;
  end;
  return result;
end;
$body$;
create or replace function pg_temp.r3sw_state(p_tag text) returns text language sql stable as $body$
  select pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id(p_tag || ':review')) $body$;
create or replace function pg_temp.r3sw_vstate(p_tag text) returns text language sql stable as $body$
  select pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id(p_tag || ':version')) $body$;
create or replace function pg_temp.r3sw_window(p_assignment text, p_starts text, p_ends text) returns boolean language sql as $body$
  select pg_temp.s09d_timewarp('cms_schema_review_assignments', format($q$update platform_private.cms_schema_review_assignments
    set starts_at = %s, ends_at = %s where id = %L$q$, p_starts, p_ends, pg_temp.s09d_id(p_assignment))) $body$;

-- ------------------------------------------------------------- interface ----
select ok(to_regprocedure('platform_api.cms_sweep_expired_review_authority(integer)') is not null
  and to_regprocedure('platform_private.cms_sweep_expired_review_authority(integer)') is not null,
  'the sweep exists as a private implementation and a platform_api wrapper [P2-S09-AC-1135]');
select ok(pg_temp.s09d_service_only('platform_api.cms_sweep_expired_review_authority(integer)')
  and not has_function_privilege('service_role', to_regprocedure('platform_private.cms_sweep_expired_review_authority(integer)'), 'execute'),
  'only the service role executes the wrapper and the private implementation is not granted to any API role [P2-S09-AC-1135]');

-- --------------------------------------------------------------- fixtures ----
-- Specialist grants exist BEFORE any review (a later grant is an authority event
-- that invalidates eagerly, which is not what this sweep is for).
select pg_temp.s09d_grant_specialist('rev1', 'cms.reviewer.legal');
select pg_temp.s09d_grant_specialist('rev2', 'cms.reviewer.legal');

-- e1: approved protected review (rev2 holds the legal slot).
select pg_temp.s09d_create_type('e1', 'r3sw_e1', 'cms.disclosure.legal');
select pg_temp.s09d_to_approved('e1', array['rev2', 'rev3']);
select is(pg_temp.r3sw_state('e1'), 'approved', 'fixture e1: a protected review with a specialist approver is approved');

-- e2: open review (1 of 2): the counted approver rev3 relies only on an assignment.
select pg_temp.s09d_create_type('e2', 'r3sw_e2', 'cms.disclosure.legal');
select pg_temp.s09d_to_review('e2');
select pg_temp.s09d_assign('e2', 'rev3');
select pg_temp.s09d_assign('e2', 'rev2');
select pg_temp.s09d_decide('e2', 'rev3');
select is(pg_temp.r3sw_state('e2'), 'open', 'fixture e2: one approve of two keeps the review open');

-- e3: open review (1 of 2): the counted approver rev1 holds the legal slot.
select pg_temp.s09d_create_type('e3', 'r3sw_e3', 'cms.disclosure.legal');
select pg_temp.s09d_to_review('e3');
select pg_temp.s09d_assign('e3', 'rev1');
select pg_temp.s09d_assign('e3', 'rev3');
select pg_temp.s09d_decide('e3', 'rev1');
select is(pg_temp.r3sw_state('e3'), 'open', 'fixture e3: one approve of two keeps the review open');

-- c1: approved ORDINARY review by rev1 (no specialist slot at all).
select pg_temp.s09d_create_type('c1', 'r3sw_c1');
select pg_temp.s09d_to_approved('c1', array['rev1']);
-- c3: open review; the reviewer who never decided (rev2) has an ended assignment.
select pg_temp.s09d_create_type('c3', 'r3sw_c3', 'cms.disclosure.legal');
select pg_temp.s09d_to_review('c3');
select pg_temp.s09d_assign('c3', 'rev2');
select pg_temp.s09d_assign('c3', 'rev3');
select pg_temp.s09d_decide('c3', 'rev3');

-- authority lapses (time-shift of REAL rows only)
select ok(pg_temp.s09g_warp('rev2', 'cms.reviewer.legal', -3, -1), 'lapse e1: rev2''s legal specialist grant ended yesterday');
select ok(pg_temp.r3sw_window('e2:assignment:rev3', 'clock_timestamp() - interval ''2 hours''', 'clock_timestamp() - interval ''1 microsecond'''),
  'lapse e2: the counted approver rev3''s assignment ended a microsecond ago');
select ok(pg_temp.s09g_warp('rev1', 'cms.reviewer.legal', -3, -1), 'lapse e3: rev1''s legal specialist grant ended yesterday');
select ok(pg_temp.r3sw_window('c3:assignment:rev2', 'clock_timestamp() - interval ''2 hours''', 'clock_timestamp() - interval ''1 microsecond'''),
  'lapse c3: the non-deciding reviewer rev2''s assignment ended');

-- rows before the sweep
create temp table r3sw_before on commit drop as
select (select count(*) from audit_private.audit_events where action = 'cms.schema.review.invalidate') as audits,
       (select count(*) from platform_private.outbox_events where event_type = 'cms.schema.review.invalidated.v1') as outbox;

-- --------------------------------------------------------------- validation --
select pg_temp.r3sw_sweep('sw:null', null::integer);
select is(pg_temp.s09d_outcome('sw:null'), 'INVALID_REQUEST', 'a null batch size is 400 INVALID_REQUEST [P2-S09-AC-1135]');
select pg_temp.r3sw_sweep('sw:zero', 0);
select is(pg_temp.s09d_outcome('sw:zero'), 'INVALID_REQUEST', 'a zero batch size is 400 INVALID_REQUEST [P2-S09-AC-1135]');
select pg_temp.r3sw_sweep('sw:huge', 5001);
select is(pg_temp.s09d_outcome('sw:huge'), 'INVALID_REQUEST', 'a batch size above 5000 is 400 INVALID_REQUEST [P2-S09-AC-1135]');
select is(pg_temp.r3sw_state('e1') || '|' || pg_temp.r3sw_state('e2') || '|' || pg_temp.r3sw_state('e3'), 'approved|open|open',
  'a refused sweep call changed nothing [P2-S09-AC-1135]');

-- ------------------------------------------------------- bounded and exact ---
select pg_temp.r3sw_sweep('sw:1', 1);
select is(pg_temp.s09d_resp('sw:1')->>'invalidatedReviews', '1', 'a batch of one invalidates exactly one review [P2-S09-AC-1135]');
select pg_temp.r3sw_sweep('sw:2', 1);
select is(pg_temp.s09d_resp('sw:2')->>'invalidatedReviews', '1', 'the next batch of one invalidates the next review [P2-S09-AC-1135]');
select pg_temp.r3sw_sweep('sw:3', 1);
select is(pg_temp.s09d_resp('sw:3')->>'invalidatedReviews', '1', 'the third batch of one invalidates the last lapsed review [P2-S09-AC-1135]');
select pg_temp.r3sw_sweep('sw:4', 100);
select is(pg_temp.s09d_resp('sw:4')->>'invalidatedReviews', '0', 'a further sweep finds nothing: the sweep is idempotent [P2-S09-AC-1135]');

select is(pg_temp.r3sw_state('e1'), 'invalidated', 'the approved review whose counted approver''s specialist capability expired is invalidated [P2-S09-AC-1135]');
select is(pg_temp.r3sw_vstate('e1'), 'draft', 'and its candidate returns to draft [P2-S09-AC-1135]');
select is(pg_temp.r3sw_state('e2'), 'invalidated', 'the open review whose counted approver''s assignment expired is invalidated [P2-S09-AC-1135]');
select is(pg_temp.r3sw_vstate('e2'), 'draft', 'and its candidate returns to draft [P2-S09-AC-1135]');
select is(pg_temp.r3sw_state('e3'), 'invalidated', 'the open review whose counted approver lost the legal specialist slot to expiry is invalidated [P2-S09-AC-1135]');
select is(pg_temp.r3sw_vstate('e3'), 'draft', 'and its candidate returns to draft [P2-S09-AC-1135]');
select is(pg_temp.r3sw_state('c1') || '|' || pg_temp.r3sw_vstate('c1'), 'approved|approved',
  'control: rev1''s lapsed legal grant does not touch an ordinary review that has no specialist slot [P2-S09-AC-1135]');
select is(pg_temp.r3sw_state('c3') || '|' || pg_temp.r3sw_vstate('c3'), 'open|review',
  'control: a lapsed assignment on which no counted decision relied does not invalidate [P2-S09-AC-1135]');

-- --------------------------------------------------------- audit and outbox --
select is((select count(*)::integer from audit_private.audit_events where action = 'cms.schema.review.invalidate') - (select audits::integer from r3sw_before), 3,
  'one BE00 audit row per invalidated review [P2-S09-AC-1135]');
select is((select count(*)::integer from platform_private.outbox_events where event_type = 'cms.schema.review.invalidated.v1') - (select outbox::integer from r3sw_before), 3,
  'one cms.schema.review.invalidated.v1 outbox event per invalidated review [P2-S09-AC-1135]');
select is((select count(*)::integer from audit_private.audit_events a
            where a.action = 'cms.schema.review.invalidate' and a.target_type = 'cms_schema_review'
              and a.target_id = pg_temp.s09d_id('e1:review') and a.acting_party_id = pg_temp.s09d_id('ownerOrg')
              and a.actor_id is null and a.reason_code = 'REVIEWER_AUTHORITY_EXPIRED'), 1,
  'the audit row names the review, the owner organization, no human actor and REVIEWER_AUTHORITY_EXPIRED [P2-S09-AC-1135]');
select is((select e.payload ?& array['reviewId', 'schemaVersionId', 'reason']::text[] and e.payload->>'reviewId' = pg_temp.s09d_id('e1:review')::text
              and e.aggregate_type = 'cms_schema_review' and e.aggregate_id = pg_temp.s09d_id('e1:review')
              and e.aggregate_version = (select r.version from platform_private.cms_schema_reviews r where r.id = pg_temp.s09d_id('e1:review'))
            from platform_private.outbox_events e
           where e.event_type = 'cms.schema.review.invalidated.v1' and e.aggregate_id = pg_temp.s09d_id('e1:review')), true,
  'the outbox event carries the review id, candidate version id, reason and the review''s post-invalidation aggregate version [P2-S09-AC-1135]');
select pg_temp.r3sw_sweep('sw:6', 100);
select is((select count(*)::integer from platform_private.outbox_events where event_type = 'cms.schema.review.invalidated.v1') - (select outbox::integer from r3sw_before), 3,
  'a repeated sweep emits no further event [P2-S09-AC-1135]');

-- --------------------------------------------------- resubmit after the sweep --
select pg_temp.s09d_dry_run('e1');
select pg_temp.s09d_seal('e1');
select pg_temp.s09d_submit('e1');
select is(pg_temp.s09d_outcome('e1:submit'), 'OK', 'after the sweep the candidate freezes a new review through CMS-03A-11 [P2-S09-AC-1135]');
select pg_temp.r3sw_sweep('sw:7', 100);
select is(pg_temp.s09d_resp('sw:7')->>'invalidatedReviews', '0', 'the fresh open review has no counted decision and is not touched [P2-S09-AC-1135]');

select * from finish();
rollback;
