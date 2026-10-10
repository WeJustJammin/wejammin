-- Slice 11 criteria: P2-S11-AC-108, the CMS-03B-06 evaluation order (BE03b "Decision (CMS-03B-06)", the
-- paragraph at line 1850).  In one transaction holding the review row lock: the step-up proof; concealment per
-- scope (404 hidden or absent, 403 without an effective assignment or capability); `open` state (409
-- review_not_open) and If-Match equal to the review version (409 VERSION_MISMATCH); the dependency rebuild, where
-- a mismatch commits the invalidation and answers `dependency_changed` without recording the decision;
-- separation (403 separation_of_duties, 409 duplicate_decision); the active `cms.reviewer` grant (403
-- capability_missing).
--
-- The older suite asserts each refusal alone and the order only for step-up before concealment, state before the
-- CAS operand and state before the rebuild.  Here every caller fails TWO adjacent steps at once, so reordering
-- any pair of steps fails a test:
--   concealment > CAS            a hidden review with a stale If-Match is 404
--   assignment 403 > state       a lapsed assignment on an approved review is 403 capability_missing
--   state > rebuild              an approved review with a drifted manifest is review_not_open (nothing committed)
--   state > separation           the submitter on an approved review is review_not_open
--   CAS > rebuild                a stale If-Match on a drifted manifest is VERSION_MISMATCH (nothing committed)
--   rebuild > separation         the submitter / the author on a drifted manifest get the committed dependency_changed
--   rebuild > capability         a lapsed standing grant on a drifted manifest gets the committed dependency_changed
--   CAS > capability             a lapsed standing grant with a stale If-Match is VERSION_MISMATCH
--   separation > capability      the submitter with a lapsed grant is separation_of_duties
--   duplicate > capability       a second decision with a lapsed grant is duplicate_decision

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(24);

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
\ir phase_02_slice_11_criteria/000-effect-digest.sqlinc

-- A raw effective assignment (the assignment guard itself refuses the submitter and the author, so this proves the
-- command's own check).
create or replace function pg_temp.c11_assign_raw(p_review text, p_person text)
returns void
language sql
as $body$
  select pg_temp.h11r_raw_insert('platform_private.cms_editorial_review_assignments',
    pg_temp.s11_assignment_row(jsonb_build_object('id', extensions.gen_random_uuid(), 'review_id', pg_temp.s11_id(p_review),
      'reviewer_person_id', pg_temp.s11_id(p_person), 'starts_at', clock_timestamp() - interval '1 hour',
      'ends_at', clock_timestamp() + interval '23 hours')))
$body$;

-- The manifest of the review drifts after the freeze: the revision gains a relation, so the rebuild differs.
create or replace function pg_temp.c11_drift(p_tag text)
returns void
language plpgsql
as $body$
begin
  perform set_config('app.cms_rpc', 'true', true);
  perform pg_temp.h11w_revision(p_tag || '-t');
  perform pg_temp.h11w_relation(pg_temp.h11w_uuid(p_tag || ':revision'), 'rel_omit', pg_temp.h11w_uuid(p_tag || '-t:entry'), 1);
end;
$body$;

create or replace function pg_temp.c11_lapse(p_person text, p_lapsed boolean)
returns void
language sql
as $body$
  select pg_temp.h11_raw_exec('identity_private.organization_actor_grant', format(
    $q$update identity_private.organization_actor_grant set valid_from = %L::date, valid_through = %s
        where organization_id = %L::uuid and person_id = %L::uuid and capability_code = 'cms.reviewer'$q$,
    case when p_lapsed then current_date - 5 else current_date end, case when p_lapsed then '(current_date - 1)' else 'null' end,
    pg_temp.s11_id('org'), pg_temp.s11_id(p_person)))
$body$;

-- '<outcome>[|kind:reason]|<review state/version/recorded>|decisions=<rows of that review>'.
create or replace function pg_temp.c11_d(p_label text, p_actor text, p_review text, p_extra jsonb default '{}'::jsonb, p_keep boolean default false)
returns text
language plpgsql
as $body$
begin
  perform pg_temp.r11_dcall(p_label, p_actor, pg_temp.r11_dreq(p_review, 'approve', p_extra), p_keep);
  return pg_temp.r11_out(p_label)
    || coalesce('|' || (pg_temp.r11_resp(p_label)->>'kind') || ':' || (pg_temp.r11_resp(p_label)->>'reasonCode'), '')
    || '|' || pg_temp.r11_rv(p_review)
    || '|decisions=' || (select count(*) from platform_private.cms_editorial_decisions where review_id = pg_temp.s11_id(p_review))::text;
end;
$body$;

-- ---------------------------------------------------------------------------
-- Fixtures.
-- ---------------------------------------------------------------------------
-- oTwo: open at version 2 (rvB approved, two decisions needed); rvA is assigned.
select pg_temp.r11_frozen_review('oTwo', 'o-two', jsonb_build_object('required_decision_count', 2));
select pg_temp.r11_assign_now('oTwo-rvA', 'oTwo', 'rvA');
select pg_temp.r11_assign_now('oTwo-rvB', 'oTwo', 'rvB');
select pg_temp.r11_decide_now('oTwo-dec', 'oTwo', 'rvB', 'oTwo-rvB', 'approve');
-- oApp: approved at version 2 (rvA approved); rvB holds an assignment whose window is over.
select pg_temp.r11_frozen_review('oApp', 'o-app');
select pg_temp.r11_assign_now('oApp-rvA', 'oApp', 'rvA');
select pg_temp.h11r_assign('oApp-rvB', 'oApp', 'rvB');
select pg_temp.r11_decide_now('oApp-dec', 'oApp', 'rvA', 'oApp-rvA', 'approve');
-- oJ: approved at version 2 with a drifted manifest; rvA decided, the submitter (editor) holds an effective assignment.
select pg_temp.r11_frozen_review('oJ', 'o-j');
select pg_temp.r11_assign_now('oJ-rvA', 'oJ', 'rvA');
select pg_temp.r11_decide_now('oJ-dec', 'oJ', 'rvA', 'oJ-rvA', 'approve');
select pg_temp.c11_drift('o-j');
select pg_temp.c11_assign_raw('oJ', 'editor');
-- oD: open at version 2 with a drifted manifest; rvA is assigned.
select pg_temp.r11_frozen_review('oD', 'o-d', jsonb_build_object('required_decision_count', 2));
select pg_temp.r11_assign_now('oD-rvA', 'oD', 'rvA');
select pg_temp.r11_assign_now('oD-rvB', 'oD', 'rvB');
select pg_temp.r11_decide_now('oD-dec', 'oD', 'rvB', 'oD-rvB', 'approve');
select pg_temp.c11_drift('o-d');
-- oE1 / oE2: open at version 1 with a drifted manifest; the submitter (editor) and the author (creator) hold an effective assignment.
select pg_temp.r11_frozen_review('oE1', 'o-e1');
select pg_temp.c11_drift('o-e1');
select pg_temp.c11_assign_raw('oE1', 'editor');
select pg_temp.r11_frozen_review('oE2', 'o-e2');
select pg_temp.c11_drift('o-e2');
select pg_temp.c11_assign_raw('oE2', 'creator');
-- oF: open at version 1 with a drifted manifest; rvX is assigned and will hold a lapsed standing grant.
select pg_temp.r11_frozen_review('oF', 'o-f');
select pg_temp.c11_drift('o-f');
select pg_temp.r11_assign_now('oF-rvX', 'oF', 'rvX');
-- oG: submitted by rvX, who holds an effective assignment and a lapsed standing grant.
select pg_temp.r11_frozen_review('oG', 'o-g', '{}'::jsonb, 'creatorPerson', 'rvX');
select pg_temp.c11_assign_raw('oG', 'rvX');
-- oI: open at version 2 (rvB approved); rvX is assigned and holds a lapsed grant.
select pg_temp.r11_frozen_review('oI', 'o-i', jsonb_build_object('required_decision_count', 2));
select pg_temp.r11_assign_now('oI-rvB', 'oI', 'rvB');
select pg_temp.r11_assign_now('oI-rvX', 'oI', 'rvX');
select pg_temp.r11_decide_now('oI-dec', 'oI', 'rvB', 'oI-rvB', 'approve');
-- oH: open at version 2 (rvB approved); rvB, whose grant lapsed, decides again.
select pg_temp.r11_frozen_review('oH', 'o-h', jsonb_build_object('required_decision_count', 2));
select pg_temp.r11_assign_now('oH-rvB', 'oH', 'rvB');
select pg_temp.r11_decide_now('oH-dec', 'oH', 'rvB', 'oH-rvB', 'approve');

select is(
  (select string_agg(key || '=' || pg_temp.r11_rv(key), ',' order by key)
     from (values ('oTwo'), ('oApp'), ('oJ'), ('oD'), ('oE1'), ('oE2'), ('oF'), ('oG'), ('oI'), ('oH')) as v(key)),
  'oApp=approved/2/1,oD=open/2/1,oE1=open/1/0,oE2=open/1/0,oF=open/1/0,oG=open/1/0,oH=open/2/1,oI=open/2/1,oJ=approved/2/1,oTwo=open/2/1',
  'control: ten review fixtures in the intended states [P2-S11-AC-108]');
select is(
  platform_private.cms_frozen_dependencies_status(pg_temp.h11w_uuid('o-d:revision'), (select dependency_manifest from platform_private.cms_editorial_reviews where id = pg_temp.s11_id('oD')))
    || '/' || platform_private.cms_frozen_dependencies_status(pg_temp.h11w_uuid('o-two:revision'), (select dependency_manifest from platform_private.cms_editorial_reviews where id = pg_temp.s11_id('oTwo'))),
  'stale/current',
  'control: the drifted fixtures have a stale frozen manifest and the undrifted one a current manifest [P2-S11-AC-108]');

select pg_temp.c11_lapse('rvX', true);
select pg_temp.c11_lapse('rvB', true);
select pg_temp.c11_take('start');

-- ---------------------------------------------------------------------------
-- Raised refusals: the earlier step wins, and nothing is committed.
-- ---------------------------------------------------------------------------
select is(pg_temp.c11_d('A', 'stranger', 'oTwo', '{"expectedVersion":"1","ifMatch":"1"}'), 'P0001:NOT_FOUND|open/2/1|decisions=1',
  'concealment before the CAS operand: a hidden review with a stale If-Match is NOT_FOUND, not VERSION_MISMATCH [P2-S11-AC-108]');
select is(pg_temp.c11_d('B', 'rvB', 'oApp', '{"expectedVersion":"1","ifMatch":"1"}'), 'P0001:capability_missing|approved/2/1|decisions=1',
  'the effective-assignment check before the state: a lapsed assignment on an approved review is 403 capability_missing, not review_not_open [P2-S11-AC-108]');
select is(pg_temp.c11_d('J1', 'rvA', 'oJ'), 'P0001:review_not_open|approved/2/1|decisions=1',
  'state before the dependency rebuild: an approved review with a drifted manifest is review_not_open and is not invalidated [P2-S11-AC-108]');
select is(pg_temp.c11_d('J2', 'editor', 'oJ'), 'P0001:review_not_open|approved/2/1|decisions=1',
  'state before separation: the submitter on an approved review is review_not_open, not separation_of_duties [P2-S11-AC-108]');
select is(pg_temp.c11_d('D', 'rvA', 'oD', '{"expectedVersion":"1","ifMatch":"1"}'), 'P0001:VERSION_MISMATCH|open/2/1|decisions=1',
  'the CAS operand before the dependency rebuild: a stale If-Match on a drifted manifest is VERSION_MISMATCH and commits no invalidation [P2-S11-AC-108]');
select is(pg_temp.c11_d('G', 'rvX', 'oG'), 'P0001:separation_of_duties|open/1/0|decisions=0',
  'separation before the standing grant: the submitter with a lapsed cms.reviewer grant is separation_of_duties, not capability_missing [P2-S11-AC-108]');
select is(pg_temp.c11_d('I', 'rvX', 'oI', '{"expectedVersion":"1","ifMatch":"1"}'), 'P0001:VERSION_MISMATCH|open/2/1|decisions=1',
  'the CAS operand before the standing grant: a stale If-Match with a lapsed grant is VERSION_MISMATCH, not capability_missing [P2-S11-AC-108]');
select is(pg_temp.c11_d('H', 'rvB', 'oH'), 'P0001:duplicate_decision|open/2/1|decisions=1',
  'duplicate_decision before the standing grant: a second decision with a lapsed grant is duplicate_decision, not capability_missing [P2-S11-AC-108]');
select is(pg_temp.c11_delta('start'), '',
  'every raised refusal above left no decision, review change, reservation, audit record, event or snapshot behind [P2-S11-AC-108]');

-- ---------------------------------------------------------------------------
-- Committed refusals: the rebuild precedes separation and the standing grant, and records no decision.
-- ---------------------------------------------------------------------------
select is(pg_temp.c11_d('E1', 'editor', 'oE1', '{}', true), '00000:|refusal:dependency_changed|invalidated/2/0|decisions=0',
  'the rebuild before separation: the submitter on a drifted manifest gets the committed dependency_changed, not separation_of_duties [P2-S11-AC-108]');
select is(pg_temp.c11_d('E2', 'owner', 'oE2', '{}', true), '00000:|refusal:dependency_changed|invalidated/2/0|decisions=0',
  'the rebuild before separation: the revision author on a drifted manifest gets the committed dependency_changed [P2-S11-AC-108]');
select is(pg_temp.c11_d('F', 'rvX', 'oF', '{}', true), '00000:|refusal:dependency_changed|invalidated/2/0|decisions=0',
  'the rebuild before the standing grant: a lapsed cms.reviewer grant on a drifted manifest gets the committed dependency_changed, not capability_missing [P2-S11-AC-108]');
select is(pg_temp.c11_d('Dc', 'rvA', 'oD', '{}', true), '00000:|refusal:dependency_changed|invalidated/3/1|decisions=1',
  'control: with the current If-Match the same drifted review is invalidated dependency_changed at version 3 and rvA''s decision is not recorded [P2-S11-AC-108]');

select * from finish();
rollback;
