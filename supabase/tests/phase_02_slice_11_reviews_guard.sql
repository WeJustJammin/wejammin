-- Slice 11 data model, lane S11-2: the EditorialReview insert guard and state
-- guard (BE03b Database Schema, Review invalidation; tracker P2-S11-AC-111,
-- AC-120).  RED before 20261005017010, GREEN after.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(55);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/002-reviews.sqlinc

-- A decision row appended for a review (outcome of the INSERT), and one CAS update of a review.
create or replace function pg_temp.s11g_decide(
  p_review text, p_reviewer text, p_assignment text, p_decision text,
  p_capability text default 'cms.reviewer'
)
returns text
language sql
as $body$
  select pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_editorial_decisions',
    pg_temp.s11_decision_row(jsonb_build_object(
      'review_id', pg_temp.s11_id(p_review), 'reviewer_person_id', pg_temp.s11_id(p_reviewer),
      'assignment_id', pg_temp.s11_id(p_assignment), 'decision', p_decision, 'capability', p_capability))))
$body$;

create or replace function pg_temp.s11g_cas(
  p_review text, p_state text, p_count integer, p_version bigint
)
returns text
language sql
as $body$
  select pg_temp.s11_outcome(format(
    'update platform_private.cms_editorial_reviews set state = %L, recorded_decision_count = %s, decided_at = case when %L in (''approved'', ''rejected'') then clock_timestamp() end, version = %s, updated_at = clock_timestamp() where id = %L',
    p_state, p_count, p_state, p_version, pg_temp.s11_id(p_review)))
$body$;

-- reviewer01 holds cms.reviewer; reviewer02 also holds the policy specialist slot; reviewer05 holds nothing.
select pg_temp.h11r_member('reviewer01', array['cms.reviewer']);
select pg_temp.h11r_member('reviewer02', array['cms.reviewer', 'cms.reviewer.policy']);

-- ---------------------------------------------------------------------------
-- EditorialReview insert guard (triggers enabled) and one live review per revision.
-- ---------------------------------------------------------------------------
select is(
  pg_temp.s11_outcome(
    pg_temp.s11_insert_sql(
      'platform_private.cms_editorial_reviews',
      pg_temp.s11_review_row('{"version":2}'::jsonb)
    )
  ),
  'P0001:VALIDATION_FAILED',
  'review: a review is created at version 1 [P2-S11-AC-120]'
);

select is(
  pg_temp.s11_outcome(
    pg_temp.s11_insert_sql(
      'platform_private.cms_editorial_reviews',
      pg_temp.s11_review_row(
        '{"state":"approved","recorded_decision_count":1,"decided_at":"2026-10-08T14:30:00Z"}'::jsonb
      )
    )
  ),
  'P0001:VALIDATION_FAILED',
  'review: a review is created open and cannot start decided [P2-S11-AC-120]'
);

select is(
  pg_temp.s11_outcome(
    pg_temp.s11_insert_sql(
      'platform_private.cms_editorial_reviews',
      pg_temp.s11_review_row('{"recorded_decision_count":1}'::jsonb)
    )
  ),
  'P0001:VALIDATION_FAILED',
  'review: a review is created with no recorded decision [P2-S11-AC-120]'
);

insert into s11_ids(key, value) values
  ('review1', 'a9110000-0000-4000-8000-000000000301'),
  ('review2', 'a9110000-0000-4000-8000-000000000302'),
  ('review3', 'a9110000-0000-4000-8000-000000000303'),
  ('review4', 'a9110000-0000-4000-8000-000000000304'),
  ('review5', 'a9110000-0000-4000-8000-000000000305'),
  ('review6', 'a9110000-0000-4000-8000-000000000306');

select is(
  pg_temp.s11_outcome(
    pg_temp.s11_insert_sql(
      'platform_private.cms_editorial_reviews',
      pg_temp.s11_review_row(jsonb_build_object('id', pg_temp.s11_id('review1')))
    )
  ),
  '00000',
  'review: the canonical review is created open through the guarded path [P2-S11-AC-120]'
);

select is(
  pg_temp.s11_outcome(
    pg_temp.s11_insert_sql(
      'platform_private.cms_editorial_reviews', pg_temp.s11_review_row()
    )
  ),
  '23505',
  'review: a second live review of the same revision is refused [P2-S11-AC-120]'
);

-- ---------------------------------------------------------------------------
-- EditorialReview state guard: frozen evidence, CAS and the transition machine.
-- ---------------------------------------------------------------------------
select is(
  pg_temp.s11_outcome(format(
    'update platform_private.cms_editorial_reviews set frozen_hash = %L, version = 2, updated_at = clock_timestamp() where id = %L',
    pg_temp.s11_hex('other'), pg_temp.s11_id('review1')
  )),
  'P0001:IMMUTABLE_RECORD',
  'review: the frozen hash is immutable evidence [P2-S11-AC-120]'
);

select is(
  pg_temp.s11_outcome(format(
    'update platform_private.cms_editorial_reviews set dependency_manifest = %L::jsonb, version = 2, updated_at = clock_timestamp() where id = %L',
    '{"schema":{}}', pg_temp.s11_id('review1')
  )),
  'P0001:IMMUTABLE_RECORD',
  'review: the frozen dependency manifest is immutable evidence [P2-S11-AC-120]'
);

select is(
  pg_temp.s11_outcome(format(
    'update platform_private.cms_editorial_reviews set required_capabilities = %L::jsonb, version = 2, updated_at = clock_timestamp() where id = %L',
    '["cms.reviewer","cms.reviewer.legal"]', pg_temp.s11_id('review1')
  )),
  'P0001:IMMUTABLE_RECORD',
  'review: the frozen workflow policy evidence is immutable [P2-S11-AC-120]'
);

select is(
  pg_temp.s11_outcome(format(
    'update platform_private.cms_editorial_reviews set submitted_by = %L, version = 2, updated_at = clock_timestamp() where id = %L',
    pg_temp.s11_id('creator'), pg_temp.s11_id('review1')
  )),
  'P0001:IMMUTABLE_RECORD',
  'review: the submitter is immutable [P2-S11-AC-120]'
);

select is(
  pg_temp.s11_outcome(format(
    'update platform_private.cms_editorial_reviews set state = ''approved'', recorded_decision_count = 1, decided_at = clock_timestamp(), version = 3, updated_at = clock_timestamp() where id = %L',
    pg_temp.s11_id('review1')
  )),
  'P0001:CONFLICT',
  'review: a transition must advance the version by exactly one [P2-S11-AC-120]'
);

select is(
  pg_temp.s11_outcome(format(
    'update platform_private.cms_editorial_reviews set version = 2, updated_at = clock_timestamp() where id = %L',
    pg_temp.s11_id('review1')
  )),
  'P0001:CONFLICT',
  'review: an update that records no decision and no invalidation is refused [P2-S11-AC-120]'
);

select is(
  pg_temp.s11_outcome(format(
    'update platform_private.cms_editorial_reviews set state = ''approved'', decided_at = clock_timestamp(), version = 2, updated_at = clock_timestamp() where id = %L',
    pg_temp.s11_id('review1')
  )),
  'P0001:CONFLICT',
  'review: approval is only reachable with the decision count advanced by one [P2-S11-AC-120]'
);

select is(
  pg_temp.s11_outcome(format(
    'update platform_private.cms_editorial_reviews set state = ''approved'', recorded_decision_count = 1, decided_at = clock_timestamp(), version = 2, updated_at = timestamptz ''2020-01-01T00:00:00Z'' where id = %L',
    pg_temp.s11_id('review1')
  )),
  'P0001:CONFLICT',
  'review: updated_at never moves backwards [P2-S11-AC-120]'
);

-- The CAS cannot manufacture a decision (BE03b EditorialReview: approval and rejection are computed from the
-- immutable decision rows): every transition out of `open` must agree with the rows of the review.
select is(pg_temp.s11g_cas('review1', 'approved', 1, 2), 'P0001:CONFLICT',
  'review: an approval with no decision row is refused although the count and version advance by one [P2-S11-AC-120]');
select is(pg_temp.s11g_cas('review1', 'rejected', 1, 2), 'P0001:CONFLICT',
  'review: a rejection with no decision row is refused [P2-S11-AC-120]');
select is(pg_temp.s11g_cas('review1', 'open', 1, 2), 'P0001:CONFLICT',
  'review: the recorded count must equal the number of decision rows [P2-S11-AC-120]');

select pg_temp.h11r_assign('asg-r1', 'review1', 'reviewer01');
select is(pg_temp.s11g_decide('review1', 'reviewer01', 'asg-r1', 'approve'), '00000',
  'review: the approve decision row is appended before the review advances [P2-S11-AC-120]');
select is(pg_temp.s11g_cas('review1', 'open', 1, 2), 'P0001:CONFLICT',
  'review: a review whose qualifying approvals reach the required count cannot stay open [P2-S11-AC-120]');
select is(pg_temp.s11g_cas('review1', 'rejected', 1, 2), 'P0001:CONFLICT',
  'review: a rejection needs a reject decision row, an approve row is not one [P2-S11-AC-120]');

select is(
  pg_temp.s11_outcome(format(
    'update platform_private.cms_editorial_reviews set state = ''approved'', recorded_decision_count = 1, decided_at = clock_timestamp(), version = 2, updated_at = clock_timestamp() where id = %L',
    pg_temp.s11_id('review1')
  )),
  '00000',
  'review: open to approved with one qualifying approval row and CAS version + 1 is accepted [P2-S11-AC-120]'
);

select is(
  pg_temp.s11_outcome(format(
    'update platform_private.cms_editorial_reviews set state = ''open'', recorded_decision_count = 0, decided_at = null, version = 3, updated_at = clock_timestamp() where id = %L',
    pg_temp.s11_id('review1')
  )),
  'P0001:CONFLICT',
  'review: an approved review never reopens [P2-S11-AC-120]'
);

select is(
  pg_temp.s11_outcome(format(
    'update platform_private.cms_editorial_reviews set state = ''invalidated'', invalidated_reason = ''revision_superseded'', decided_at = null, version = 3, updated_at = clock_timestamp() where id = %L',
    pg_temp.s11_id('review1')
  )),
  '00000',
  'review: an approved review is invalidated with one closed reason and CAS version + 1 [P2-S11-AC-111]'
);

select is(
  pg_temp.s11_outcome(format(
    'update platform_private.cms_editorial_reviews set state = ''invalidated'', invalidated_reason = ''dependency_changed'', version = 4, updated_at = clock_timestamp() where id = %L',
    pg_temp.s11_id('review1')
  )),
  'P0001:CONFLICT',
  'review: an invalidated review is terminal [P2-S11-AC-111]'
);

select is(
  pg_temp.s11_outcome(
    pg_temp.s11_insert_sql(
      'platform_private.cms_editorial_reviews',
      pg_temp.s11_review_row(jsonb_build_object('id', pg_temp.s11_id('review2')))
    )
  ),
  '00000',
  'review: after an invalidation the same revision can be resubmitted as a new open review [P2-S11-AC-111]'
);

select pg_temp.h11r_assign('asg-r2', 'review2', 'reviewer01');
select is(pg_temp.s11g_decide('review2', 'reviewer01', 'asg-r2', 'reject'), '00000',
  'review: the reject decision row is appended before the review advances [P2-S11-AC-120]');
select is(pg_temp.s11g_cas('review2', 'approved', 1, 2), 'P0001:CONFLICT',
  'review: a review with a reject row is never approved [P2-S11-AC-120]');
select is(pg_temp.s11g_cas('review2', 'open', 1, 2), 'P0001:CONFLICT',
  'review: the first rejection ends the review, it cannot stay open [P2-S11-AC-120]');

select is(
  pg_temp.s11_outcome(format(
    'update platform_private.cms_editorial_reviews set state = ''rejected'', recorded_decision_count = 1, decided_at = clock_timestamp(), version = 2, updated_at = clock_timestamp() where id = %L',
    pg_temp.s11_id('review2')
  )),
  '00000',
  'review: open to rejected terminates the review at one decision row that is a reject [P2-S11-AC-120]'
);

select is(
  pg_temp.s11_outcome(format(
    'update platform_private.cms_editorial_reviews set state = ''invalidated'', invalidated_reason = ''entry_unavailable'', decided_at = null, version = 3, updated_at = clock_timestamp() where id = %L',
    pg_temp.s11_id('review2')
  )),
  'P0001:CONFLICT',
  'review: a rejected review is terminal [P2-S11-AC-120]'
);

-- Protected review: two decisions, the first leaves the review open.
select is(
  pg_temp.s11_outcome(
    pg_temp.s11_insert_sql(
      'platform_private.cms_editorial_reviews',
      pg_temp.s11_review_row(jsonb_build_object(
        'id', pg_temp.s11_id('review3'), 'revision_id', pg_temp.s11_id('revA2'),
        'risk_class', 'protected', 'required_decision_count', 2,
        'required_capabilities', jsonb_build_array('cms.reviewer', 'cms.reviewer.policy')
      ))
    )
  ),
  '00000',
  'review: a protected review with two decisions and a specialist slot is created [P2-S11-AC-120]'
);

select pg_temp.h11r_assign('asg-r3', 'review3', 'reviewer01');
select is(pg_temp.s11g_decide('review3', 'reviewer01', 'asg-r3', 'approve'), '00000',
  'review: the first approve row of a protected review is appended [P2-S11-AC-120]');
select is(pg_temp.s11g_cas('review3', 'approved', 1, 2), 'P0001:CONFLICT',
  'review: one approval of two required does not approve a protected review [P2-S11-AC-120]');

select is(
  pg_temp.s11_outcome(format(
    'update platform_private.cms_editorial_reviews set recorded_decision_count = 1, version = 2, updated_at = clock_timestamp() where id = %L',
    pg_temp.s11_id('review3')
  )),
  '00000',
  'review: a first decision row of two advances the count and leaves the review open [P2-S11-AC-120]'
);

select is(
  pg_temp.s11_bare_outcome(
    'platform_private.cms_editorial_reviews',
    format(
      'update platform_private.cms_editorial_reviews set recorded_decision_count = 3, version = 3, updated_at = clock_timestamp() where id = %L',
      pg_temp.s11_id('review3')
    )
  ),
  '23514',
  'review: the recorded count never exceeds the required count [P2-S11-AC-120]'
);

select is(
  pg_temp.s11_outcome(format(
    'update platform_private.cms_editorial_reviews set state = ''invalidated'', invalidated_reason = ''reviewer_authority_changed'', version = 3, updated_at = clock_timestamp() where id = %L',
    pg_temp.s11_id('review3')
  )),
  '00000',
  'review: an open review is invalidated without changing its recorded count [P2-S11-AC-111]'
);

-- Qualification: an approve row counts only while its human holds the standing capability of the slot it satisfied.
select is(
  pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_editorial_reviews',
    pg_temp.s11_review_row(jsonb_build_object('id', pg_temp.s11_id('review6'))))),
  '00000', 'review: an ordinary review of revision A1 is created after the earlier ones closed [P2-S11-AC-120]');
select pg_temp.h11r_assign('asg-r6', 'review6', 'reviewer05');
select is(pg_temp.s11g_decide('review6', 'reviewer05', 'asg-r6', 'approve'), '00000',
  'review: an approve row by a person without the reviewer capability is appended (the evidence is immutable) [P2-S11-AC-120]');
select is(pg_temp.s11g_cas('review6', 'approved', 1, 2), 'P0001:CONFLICT',
  'review: an approve row of a person who does not hold the capability does not qualify, so no approval [P2-S11-AC-120]');
select is(
  pg_temp.s11_outcome(format(
    'update platform_private.cms_editorial_reviews set state = ''invalidated'', invalidated_reason = ''reviewer_authority_changed'', version = 2, updated_at = clock_timestamp() where id = %L',
    pg_temp.s11_id('review6'))),
  '00000', 'review: the unqualified review is invalidated reviewer_authority_changed without moving the count [P2-S11-AC-111]');

-- Specialist slot: two distinct approvers are not enough while no qualifying decision holds cms.reviewer.policy.
select is(
  pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_editorial_reviews',
    pg_temp.s11_review_row(jsonb_build_object(
      'id', pg_temp.s11_id('review4'), 'revision_id', pg_temp.s11_id('revB1'), 'entry_id', pg_temp.s11_id('entryB'),
      'risk_class', 'protected', 'required_decision_count', 2,
      'required_capabilities', jsonb_build_array('cms.reviewer', 'cms.reviewer.policy'))))),
  '00000', 'review: a protected review of entry B is created [P2-S11-AC-120]');
select pg_temp.h11r_assign('asg-r4a', 'review4', 'reviewer01');
select pg_temp.h11r_assign('asg-r4b', 'review4', 'reviewer02');
select is(pg_temp.s11g_decide('review4', 'reviewer01', 'asg-r4a', 'approve'), '00000',
  'review: the first approve row is appended [P2-S11-AC-120]');
select is(pg_temp.s11g_cas('review4', 'open', 1, 2), '00000',
  'review: one approval of two leaves the protected review open [P2-S11-AC-120]');
select is(pg_temp.s11g_decide('review4', 'reviewer02', 'asg-r4b', 'approve', 'cms.reviewer'), '00000',
  'review: the second approve row satisfies the base slot, not the policy slot [P2-S11-AC-120]');
select is(pg_temp.s11g_cas('review4', 'approved', 2, 3), 'P0001:CONFLICT',
  'review: two distinct approvers do not approve while the cms.reviewer.policy slot is held by no qualifying decision [P2-S11-AC-120]');

-- The same two humans with the second approval recorded for the policy slot approve the review.
select is(
  pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_editorial_reviews',
    pg_temp.s11_review_row(jsonb_build_object(
      'id', pg_temp.s11_id('review5'), 'risk_class', 'protected', 'required_decision_count', 2,
      'required_capabilities', jsonb_build_array('cms.reviewer', 'cms.reviewer.policy'))))),
  '00000', 'review: a second protected review of revision A1 is created [P2-S11-AC-120]');
select pg_temp.h11r_assign('asg-r5a', 'review5', 'reviewer01');
select pg_temp.h11r_assign('asg-r5b', 'review5', 'reviewer02');
select is(pg_temp.s11g_decide('review5', 'reviewer01', 'asg-r5a', 'approve'), '00000',
  'review: the base-slot approve row is appended [P2-S11-AC-120]');
select is(pg_temp.s11g_cas('review5', 'open', 1, 2), '00000',
  'review: the first of two approvals leaves the review open [P2-S11-AC-120]');
select is(pg_temp.s11g_decide('review5', 'reviewer02', 'asg-r5b', 'approve', 'cms.reviewer.policy'), '00000',
  'review: the policy-slot approve row is appended [P2-S11-AC-120]');
select is(pg_temp.s11g_cas('review5', 'approved', 2, 3), '00000',
  'review: two qualifying approvers with every specialist slot held approve the protected review [P2-S11-AC-120]');

select is(
  pg_temp.s11_outcome(format(
    'delete from platform_private.cms_editorial_reviews where id = %L',
    pg_temp.s11_id('review1')
  )),
  'P0001:IMMUTABLE_RECORD',
  'review: a review is history and is never deleted [P2-S11-AC-120]'
);

select * from finish();
rollback;
