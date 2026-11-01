-- Slice 11 data model, lane S11-2: the EditorialReviewAssignment insert and
-- update guards (BE03b Review scopes and reviewer assignment, DEC-136; tracker
-- P2-S11-AC-119).  RED before 20261005017020, GREEN after.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(25);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc

-- Two reviews of entry A: review1 stays open, review2 is rejected (closed).
insert into s11_ids(key, value) values
  ('review1', 'a9110000-0000-4000-8000-000000000301'),
  ('review2', 'a9110000-0000-4000-8000-000000000302');
select pg_temp.s11_outcome(
  pg_temp.s11_insert_sql(
    'platform_private.cms_editorial_reviews',
    pg_temp.s11_review_row(jsonb_build_object('id', pg_temp.s11_id('review1')))
  )
);
select pg_temp.s11_outcome(
  pg_temp.s11_insert_sql(
    'platform_private.cms_editorial_reviews',
    pg_temp.s11_review_row(jsonb_build_object(
      'id', pg_temp.s11_id('review2'), 'revision_id', pg_temp.s11_id('revA2')
    ))
  )
);
select pg_temp.s11_seed_review_update(format(
  'update platform_private.cms_editorial_reviews set state = ''rejected'', recorded_decision_count = 1, decided_at = clock_timestamp(), version = 2, updated_at = clock_timestamp() where id = %L',
  pg_temp.s11_id('review2')
));

select is(
  (select string_agg(state, ',' order by id::text)
     from platform_private.cms_editorial_reviews
    where id in (pg_temp.s11_id('review1'), pg_temp.s11_id('review2'))),
  'open,rejected',
  'S11 assignment fixture: review1 is open and review2 is rejected'
);

-- ---------------------------------------------------------------------------
-- Insert guard: open review, eligible reviewer, sixteen active assignments.
-- ---------------------------------------------------------------------------
insert into s11_ids(key, value) values
  ('assignment1', 'a9110000-0000-4000-8000-000000000401');

select is(
  pg_temp.s11_outcome(
    pg_temp.s11_insert_sql(
      'platform_private.cms_editorial_review_assignments',
      pg_temp.s11_assignment_row(jsonb_build_object('id', pg_temp.s11_id('assignment1')))
    )
  ),
  '00000',
  'assignment: an eligible reviewer is assigned to an open review [P2-S11-AC-119]'
);

select is(
  pg_temp.s11_outcome(
    pg_temp.s11_insert_sql(
      'platform_private.cms_editorial_review_assignments', pg_temp.s11_assignment_row()
    )
  ),
  '23505',
  'assignment: a reviewer holds at most one active assignment per review [P2-S11-AC-119]'
);

select is(
  pg_temp.s11_outcome(
    pg_temp.s11_insert_sql(
      'platform_private.cms_editorial_review_assignments',
      pg_temp.s11_assignment_row(jsonb_build_object('reviewer_person_id', pg_temp.s11_id('editor')))
    )
  ),
  'P0001:reviewer_not_eligible',
  'assignment: the review submitter is never assigned as its reviewer [P2-S11-AC-119]'
);

select is(
  pg_temp.s11_outcome(
    pg_temp.s11_insert_sql(
      'platform_private.cms_editorial_review_assignments',
      pg_temp.s11_assignment_row(jsonb_build_object('reviewer_person_id', pg_temp.s11_id('creator')))
    )
  ),
  'P0001:reviewer_not_eligible',
  'assignment: the author of the reviewed revision is never assigned as its reviewer [P2-S11-AC-119]'
);

select is(
  pg_temp.s11_outcome(
    pg_temp.s11_insert_sql(
      'platform_private.cms_editorial_review_assignments',
      pg_temp.s11_assignment_row(jsonb_build_object(
        'review_id', pg_temp.s11_id('review2'),
        'reviewer_person_id', pg_temp.s11_id('reviewer02')
      ))
    )
  ),
  'P0001:review_not_open',
  'assignment: a closed review accepts no new assignment [P2-S11-AC-119]'
);

select is(
  pg_temp.s11_outcome(
    pg_temp.s11_insert_sql(
      'platform_private.cms_editorial_review_assignments',
      pg_temp.s11_assignment_row(jsonb_build_object(
        'reviewer_person_id', pg_temp.s11_id('reviewer02'), 'state', 'revoked'
      ))
    )
  ),
  'P0001:VALIDATION_FAILED',
  'assignment: an assignment is created active [P2-S11-AC-119]'
);

select is(
  pg_temp.s11_outcome(
    pg_temp.s11_insert_sql(
      'platform_private.cms_editorial_review_assignments',
      pg_temp.s11_assignment_row(jsonb_build_object(
        'reviewer_person_id', pg_temp.s11_id('reviewer02'), 'version', 2
      ))
    )
  ),
  'P0001:VALIDATION_FAILED',
  'assignment: an assignment is created at version 1 [P2-S11-AC-119]'
);

select is(
  (select string_agg(distinct pg_temp.s11_outcome(
     pg_temp.s11_insert_sql(
       'platform_private.cms_editorial_review_assignments',
       pg_temp.s11_assignment_row(jsonb_build_object(
         'reviewer_person_id', pg_temp.s11_id('reviewer' || lpad(n::text, 2, '0'))
       ))
     )), ',')
     from generate_series(2, 16) as n),
  '00000',
  'assignment: fifteen further reviewers fill the review to sixteen active assignments [P2-S11-AC-119]'
);

select is(
  pg_temp.s11_outcome(
    pg_temp.s11_insert_sql(
      'platform_private.cms_editorial_review_assignments',
      pg_temp.s11_assignment_row(jsonb_build_object('reviewer_person_id', pg_temp.s11_id('reviewer17')))
    )
  ),
  'P0001:assignment_limit',
  'assignment: a seventeenth active assignment is refused [P2-S11-AC-119]'
);

-- ---------------------------------------------------------------------------
-- Update guard: only active -> revoked, version + 1, nothing else moves.
-- ---------------------------------------------------------------------------
select is(
  pg_temp.s11_outcome(format(
    'update platform_private.cms_editorial_review_assignments set ends_at = ends_at + interval ''1 hour'', state = ''revoked'', version = 2, updated_at = clock_timestamp() where id = %L',
    pg_temp.s11_id('assignment1')
  )),
  'P0001:IMMUTABLE_RECORD',
  'assignment: the window never moves after creation [P2-S11-AC-119]'
);

select is(
  pg_temp.s11_outcome(format(
    'update platform_private.cms_editorial_review_assignments set reviewer_person_id = %L, state = ''revoked'', version = 2, updated_at = clock_timestamp() where id = %L',
    pg_temp.s11_id('reviewer17'), pg_temp.s11_id('assignment1')
  )),
  'P0001:IMMUTABLE_RECORD',
  'assignment: the reviewer never changes [P2-S11-AC-119]'
);

select is(
  pg_temp.s11_outcome(format(
    'update platform_private.cms_editorial_review_assignments set reason = ''edited'', state = ''revoked'', version = 2, updated_at = clock_timestamp() where id = %L',
    pg_temp.s11_id('assignment1')
  )),
  'P0001:IMMUTABLE_RECORD',
  'assignment: the stored reason never changes [P2-S11-AC-119]'
);

select is(
  pg_temp.s11_outcome(format(
    'update platform_private.cms_editorial_review_assignments set state = ''revoked'', version = 3, updated_at = clock_timestamp() where id = %L',
    pg_temp.s11_id('assignment1')
  )),
  'P0001:CONFLICT',
  'assignment: a revoke advances the CAS version by exactly one [P2-S11-AC-119]'
);

select is(
  pg_temp.s11_outcome(format(
    'update platform_private.cms_editorial_review_assignments set version = 2, updated_at = clock_timestamp() where id = %L',
    pg_temp.s11_id('assignment1')
  )),
  'P0001:CONFLICT',
  'assignment: the only transition is active to revoked [P2-S11-AC-119]'
);

select is(
  pg_temp.s11_outcome(format(
    'update platform_private.cms_editorial_review_assignments set state = ''revoked'', version = 2, updated_at = clock_timestamp() where id = %L',
    pg_temp.s11_id('assignment1')
  )),
  '00000',
  'assignment: revocation moves active to revoked with version + 1 [P2-S11-AC-119]'
);

select is(
  pg_temp.s11_outcome(format(
    'update platform_private.cms_editorial_review_assignments set state = ''active'', version = 3, updated_at = clock_timestamp() where id = %L',
    pg_temp.s11_id('assignment1')
  )),
  'P0001:CONFLICT',
  'assignment: a revoked assignment is never re-activated [P2-S11-AC-119]'
);

select is(
  pg_temp.s11_outcome(
    pg_temp.s11_insert_sql(
      'platform_private.cms_editorial_review_assignments',
      pg_temp.s11_assignment_row(jsonb_build_object('reviewer_person_id', pg_temp.s11_id('reviewer01')))
    )
  ),
  '00000',
  'assignment: a revocation frees a slot and the revoked reviewer is assigned again only as a new row [P2-S11-AC-119]'
);

select is(
  pg_temp.s11_outcome(
    pg_temp.s11_insert_sql(
      'platform_private.cms_editorial_review_assignments',
      pg_temp.s11_assignment_row(jsonb_build_object('reviewer_person_id', pg_temp.s11_id('reviewer17')))
    )
  ),
  'P0001:assignment_limit',
  'assignment: the sixteen-assignment ceiling holds again once the freed slot is refilled [P2-S11-AC-119]'
);

select is(
  pg_temp.s11_outcome(format(
    'delete from platform_private.cms_editorial_review_assignments where id = %L',
    pg_temp.s11_id('assignment1')
  )),
  'P0001:IMMUTABLE_RECORD',
  'assignment: an assignment is history and is never deleted [P2-S11-AC-119]'
);

select * from finish();
rollback;
