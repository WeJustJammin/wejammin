-- Slice 11 data model, lane S11-2: the EditorialDecision record (BE03b Database
-- Schema "EditorialDecision", Decision CMS-03B-06, Recent MFA E6, Separation of
-- duties E11; tracker P2-S11-AC-109, AC-121).  RED before 20261005017030,
-- GREEN after.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(40);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc

insert into s11_ids(key, value) values
  ('review1', 'a9110000-0000-4000-8000-000000000301'),
  ('review2', 'a9110000-0000-4000-8000-000000000302'),
  ('review3', 'a9110000-0000-4000-8000-000000000303'),
  ('assignment1', 'a9110000-0000-4000-8000-000000000401'),
  ('assignment2', 'a9110000-0000-4000-8000-000000000402'),
  ('assignment3', 'a9110000-0000-4000-8000-000000000403'),
  ('assignment4', 'a9110000-0000-4000-8000-000000000411'),
  ('assignment5', 'a9110000-0000-4000-8000-000000000412');

-- review1 (ordinary, one decision) and review3 (protected, two decisions with a
-- policy specialist slot) are open; review2 is rejected.  All through the guards.
select pg_temp.s11_outcome(pg_temp.s11_insert_sql(
  'platform_private.cms_editorial_reviews',
  pg_temp.s11_review_row(jsonb_build_object('id', pg_temp.s11_id('review1')))
));
select pg_temp.s11_outcome(pg_temp.s11_insert_sql(
  'platform_private.cms_editorial_reviews',
  pg_temp.s11_review_row(jsonb_build_object(
    'id', pg_temp.s11_id('review2'), 'revision_id', pg_temp.s11_id('revA2')
  ))
));
select pg_temp.s11_seed_review_update(format(
  'update platform_private.cms_editorial_reviews set state = ''rejected'', recorded_decision_count = 1, decided_at = clock_timestamp(), version = 2, updated_at = clock_timestamp() where id = %L',
  pg_temp.s11_id('review2')
));
select pg_temp.s11_outcome(pg_temp.s11_insert_sql(
  'platform_private.cms_editorial_reviews',
  pg_temp.s11_review_row(jsonb_build_object(
    'id', pg_temp.s11_id('review3'), 'revision_id', pg_temp.s11_id('revA2'),
    'risk_class', 'protected', 'required_decision_count', 2,
    'required_capabilities', jsonb_build_array('cms.reviewer', 'cms.reviewer.policy')
  ))
));

-- Assignments: reviewer01/02/03 on review1 (03 already expired), reviewer01/02 on review3.
select pg_temp.s11_outcome(pg_temp.s11_insert_sql(
  'platform_private.cms_editorial_review_assignments',
  pg_temp.s11_assignment_row(jsonb_build_object(
    'id', pg_temp.s11_id('assignment1'), 'reviewer_person_id', pg_temp.s11_id('reviewer01')))
));
select pg_temp.s11_outcome(pg_temp.s11_insert_sql(
  'platform_private.cms_editorial_review_assignments',
  pg_temp.s11_assignment_row(jsonb_build_object(
    'id', pg_temp.s11_id('assignment2'), 'reviewer_person_id', pg_temp.s11_id('reviewer02')))
));
select pg_temp.s11_outcome(pg_temp.s11_insert_sql(
  'platform_private.cms_editorial_review_assignments',
  pg_temp.s11_assignment_row(jsonb_build_object(
    'id', pg_temp.s11_id('assignment3'), 'reviewer_person_id', pg_temp.s11_id('reviewer03'),
    'starts_at', '2026-09-29T14:00:00Z'::timestamptz, 'ends_at', '2026-09-30T14:00:00Z'::timestamptz))
));
select pg_temp.s11_outcome(pg_temp.s11_insert_sql(
  'platform_private.cms_editorial_review_assignments',
  pg_temp.s11_assignment_row(jsonb_build_object(
    'id', pg_temp.s11_id('assignment4'), 'review_id', pg_temp.s11_id('review3'),
    'reviewer_person_id', pg_temp.s11_id('reviewer01')))
));
select pg_temp.s11_outcome(pg_temp.s11_insert_sql(
  'platform_private.cms_editorial_review_assignments',
  pg_temp.s11_assignment_row(jsonb_build_object(
    'id', pg_temp.s11_id('assignment5'), 'review_id', pg_temp.s11_id('review3'),
    'reviewer_person_id', pg_temp.s11_id('reviewer02')))
));
select pg_temp.s11_outcome(format(
  'update platform_private.cms_editorial_review_assignments set state = ''revoked'', version = 2, updated_at = clock_timestamp() where id = %L',
  pg_temp.s11_id('assignment2')
));

select is(
  (select string_agg(state, ',' order by id::text) from platform_private.cms_editorial_reviews
    where id in (pg_temp.s11_id('review1'), pg_temp.s11_id('review2'), pg_temp.s11_id('review3')))
  || '/' ||
  (select string_agg(state, ',' order by id::text) from platform_private.cms_editorial_review_assignments),
  'open,rejected,open/active,revoked,active,active,active',
  'S11 decision fixture: three reviews and five assignments (one revoked, one expired) are in place'
);

-- ---------------------------------------------------------------------------
-- Shape.
-- ---------------------------------------------------------------------------
select ok(
  pg_temp.s10r_column_type('platform_private.cms_editorial_decisions', 'assignment_id') = 'uuid'
    and pg_temp.s10r_col_notnull('platform_private.cms_editorial_decisions', 'assignment_id')
    and pg_temp.s10r_column_type('platform_private.cms_editorial_decisions', 'assignment_version') = 'int8'
    and pg_temp.s10r_col_notnull('platform_private.cms_editorial_decisions', 'assignment_version')
    and pg_temp.s10r_col_notnull('platform_private.cms_editorial_decisions', 'step_up_at'),
  'decision: the authorizing assignment is recorded and the binding MFA instant is NOT NULL (E10) [P2-S11-AC-121]'
);

select ok(
  pg_temp.s11_constraint_has(
    'platform_private.cms_editorial_decisions', 'cms_editorial_decisions_assignment_fkey',
    array['FOREIGN KEY (assignment_id, review_id, reviewer_person_id)',
          'cms_editorial_review_assignments(id, review_id, reviewer_person_id)']
  )
    and pg_temp.s11_constraint_has(
      'platform_private.cms_editorial_decisions', 'cms_editorial_decisions_review_owner_fkey',
      array['FOREIGN KEY (review_id, owner_id)', 'cms_editorial_reviews(id, owner_id)']
    ),
  'decision: the assignment must be the reviewer''s own on the same review and the owner the review owner [P2-S11-AC-121]'
);

-- ---------------------------------------------------------------------------
-- Constraints in isolation.
-- ---------------------------------------------------------------------------
select is(
  pg_temp.s11_bare_outcome(
    'platform_private.cms_editorial_decisions',
    pg_temp.s11_insert_sql('platform_private.cms_editorial_decisions', pg_temp.s11_decision_row())
  ),
  '00000',
  'decision: control - the canonical approve image is accepted [P2-S11-AC-121]'
);

select is(
  pg_temp.s11_bare_outcome(
    'platform_private.cms_editorial_decisions',
    pg_temp.s11_insert_sql('platform_private.cms_editorial_decisions',
      pg_temp.s11_decision_row('{"decision":"reject","capability":"cms.reviewer.policy"}'::jsonb))
  ),
  '23514',
  'decision: a reject always carries the base slot cms.reviewer [P2-S11-AC-109]'
);

select is(
  pg_temp.s11_bare_outcome(
    'platform_private.cms_editorial_decisions',
    pg_temp.s11_insert_sql('platform_private.cms_editorial_decisions',
      pg_temp.s11_decision_row(jsonb_build_object('comment_hash', pg_temp.s11_hex('another reason'))))
  ),
  '23514',
  'decision: the comment hash is the SHA-256 of the reason''s UTF-8 bytes [P2-S11-AC-109]'
);

select is(
  pg_temp.s11_bare_outcome(
    'platform_private.cms_editorial_decisions',
    pg_temp.s11_insert_sql('platform_private.cms_editorial_decisions',
      pg_temp.s11_decision_row('{"assignment_version":0}'::jsonb))
  ),
  '23514',
  'decision: the recorded assignment version is positive [P2-S11-AC-121]'
);

select is(
  pg_temp.s11_bare_outcome(
    'platform_private.cms_editorial_decisions',
    pg_temp.s11_insert_sql('platform_private.cms_editorial_decisions',
      pg_temp.s11_decision_row('{"step_up_at":null}'::jsonb))
  ),
  '23502',
  'decision: a decision without the binding MFA instant is refused [P2-S11-AC-121]'
);

select is(
  pg_temp.s11_bare_outcome(
    'platform_private.cms_editorial_decisions',
    pg_temp.s11_insert_sql('platform_private.cms_editorial_decisions',
      pg_temp.s11_decision_row(jsonb_build_object('reviewer_person_id', pg_temp.s11_id('reviewer02'))))
  ),
  '23503',
  'decision: another reviewer''s assignment cannot authorize this reviewer [P2-S11-AC-121]'
);

select is(
  pg_temp.s11_bare_outcome(
    'platform_private.cms_editorial_decisions',
    pg_temp.s11_insert_sql('platform_private.cms_editorial_decisions',
      pg_temp.s11_decision_row(jsonb_build_object('assignment_id', pg_temp.s11_id('assignment4'))))
  ),
  '23503',
  'decision: an assignment of another review cannot authorize this review [P2-S11-AC-121]'
);

select is(
  pg_temp.s11_bare_outcome(
    'platform_private.cms_editorial_decisions',
    pg_temp.s11_insert_sql('platform_private.cms_editorial_decisions',
      pg_temp.s11_decision_row(jsonb_build_object('owner_id', pg_temp.s11_id('stranger'))))
  ),
  '23503',
  'decision: the owner is the review owner, never another party [P2-S11-AC-121]'
);

select is(
  pg_temp.s11_bare_outcome(
    'platform_private.cms_editorial_decisions',
    pg_temp.s11_insert_sql('platform_private.cms_editorial_decisions',
      pg_temp.s11_decision_row(jsonb_build_object('reason', repeat('x', 2001),
        'comment_hash', null)))
  ),
  '23514',
  'decision: the reason is at most 2000 code points [P2-S11-AC-109]'
);

select is(
  pg_temp.s11_bare_outcome(
    'platform_private.cms_editorial_decisions',
    pg_temp.s11_insert_sql('platform_private.cms_editorial_decisions',
      pg_temp.s11_decision_row(jsonb_build_object('reason', repeat(E'\u00e9', 2000),
        'comment_hash', null)))
  ),
  '00000',
  'decision: control - a 2000-code-point reason is accepted although it is 4000 bytes (DEC-158a) [P2-S11-AC-109]'
);

select is(
  pg_temp.s11_bare_outcome(
    'platform_private.cms_editorial_decisions',
    pg_temp.s11_insert_sql('platform_private.cms_editorial_decisions',
      pg_temp.s11_decision_row(jsonb_build_object('reason', repeat(E'\u00e9', 2001),
        'comment_hash', null)))
  ),
  '23514',
  'decision: a 2001-code-point reason is refused whatever its byte length (DEC-158a) [P2-S11-AC-109]'
);

select is(
  pg_temp.s11_bare_outcome(
    'platform_private.cms_editorial_decisions',
    pg_temp.s11_insert_sql('platform_private.cms_editorial_decisions',
      pg_temp.s11_decision_row(jsonb_build_object('reason', '', 'comment_hash', null)))
  ),
  '23514',
  'decision: an empty reason is refused [P2-S11-AC-109]'
);

-- ---------------------------------------------------------------------------
-- Insert guard (triggers enabled): the refusals a named RPC would raise first.
-- ---------------------------------------------------------------------------
select is(
  pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_editorial_decisions',
    pg_temp.s11_decision_row(jsonb_build_object('reviewer_person_id', pg_temp.s11_id('editor'))))),
  'P0001:separation_of_duties',
  'decision: the review submitter never records its decision [P2-S11-AC-121]'
);

select is(
  pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_editorial_decisions',
    pg_temp.s11_decision_row(jsonb_build_object('reviewer_person_id', pg_temp.s11_id('creator'))))),
  'P0001:separation_of_duties',
  'decision: the author of the reviewed revision never records its decision [P2-S11-AC-121]'
);

select is(
  pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_editorial_decisions',
    pg_temp.s11_decision_row(jsonb_build_object('review_id', pg_temp.s11_id('review2'))))),
  'P0001:review_not_open',
  'decision: a decision is recorded only against an open review [P2-S11-AC-109]'
);

select is(
  pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_editorial_decisions',
    pg_temp.s11_decision_row('{"assignment_version":2}'::jsonb))),
  'P0001:FORBIDDEN',
  'decision: the recorded assignment version must be the assignment''s current version [P2-S11-AC-121]'
);

select is(
  pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_editorial_decisions',
    pg_temp.s11_decision_row(jsonb_build_object(
      'reviewer_person_id', pg_temp.s11_id('reviewer02'),
      'assignment_id', pg_temp.s11_id('assignment2'), 'assignment_version', 2)))),
  'P0001:FORBIDDEN',
  'decision: a revoked assignment authorizes no decision [P2-S11-AC-121]'
);

select is(
  pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_editorial_decisions',
    pg_temp.s11_decision_row(jsonb_build_object(
      'reviewer_person_id', pg_temp.s11_id('reviewer03'),
      'assignment_id', pg_temp.s11_id('assignment3'))))),
  'P0001:FORBIDDEN',
  'decision: an assignment whose window has ended authorizes no decision [P2-S11-AC-121]'
);

select is(
  pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_editorial_decisions',
    pg_temp.s11_decision_row(jsonb_build_object(
      'decided_at', '2026-10-01T13:59:59Z'::timestamptz,
      'step_up_at', '2026-10-01T13:59:00Z'::timestamptz)))),
  'P0001:FORBIDDEN',
  'decision: a decision before the assignment window opens is refused [P2-S11-AC-121]'
);

select is(
  pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_editorial_decisions',
    pg_temp.s11_decision_row(jsonb_build_object('reviewed_hash', pg_temp.s11_hex('another frozen hash'))))),
  'P0001:CONFLICT',
  'decision: the reviewed hash is the review''s frozen hash [P2-S11-AC-109]'
);

select is(
  pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_editorial_decisions',
    pg_temp.s11_decision_row('{"capability":"cms.reviewer.legal"}'::jsonb))),
  'P0001:VALIDATION_FAILED',
  'decision: the satisfied slot is a slot of the frozen workflow policy [P2-S11-AC-109]'
);

select is(
  pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_editorial_decisions',
    pg_temp.s11_decision_row(jsonb_build_object(
      'step_up_at', '2026-10-01T14:00:00Z'::timestamptz - interval '631 seconds')))),
  'P0001:STEP_UP_REQUIRED',
  'decision: an MFA instant older than 600 s plus the 30 s skew is refused [P2-S11-AC-109]'
);

select is(
  pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_editorial_decisions',
    pg_temp.s11_decision_row(jsonb_build_object(
      'step_up_at', '2026-10-01T14:00:00Z'::timestamptz + interval '31 seconds')))),
  'P0001:STEP_UP_REQUIRED',
  'decision: an MFA instant more than 30 s in the future is refused [P2-S11-AC-109]'
);

-- ---------------------------------------------------------------------------
-- Accepted decisions, decision/count sequencing and append-only evidence.
-- ---------------------------------------------------------------------------
insert into s11_ids(key, value) values
  ('decision1', 'a9110000-0000-4000-8000-000000000501');

select is(
  pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_editorial_decisions',
    pg_temp.s11_decision_row(jsonb_build_object('id', pg_temp.s11_id('decision1'))))),
  '00000',
  'decision: an assigned reviewer with a fresh MFA instant records an approve [P2-S11-AC-109]'
);

select is(
  pg_temp.s11_bare_outcome(
    'platform_private.cms_editorial_decisions',
    pg_temp.s11_insert_sql('platform_private.cms_editorial_decisions',
      pg_temp.s11_decision_row(jsonb_build_object('assignment_version', 1)))
  ),
  '23505',
  'decision: one decision per reviewer per review [P2-S11-AC-121]'
);

select is(
  pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_editorial_decisions',
    pg_temp.s11_decision_row(jsonb_build_object(
      'reviewer_person_id', pg_temp.s11_id('reviewer02'),
      'assignment_id', pg_temp.s11_id('assignment2'), 'assignment_version', 2)))),
  'P0001:FORBIDDEN',
  'decision: control - the revoked-assignment refusal stands after a first decision [P2-S11-AC-121]'
);

select is(
  pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_editorial_decisions',
    pg_temp.s11_decision_row(jsonb_build_object(
      'reviewer_person_id', pg_temp.s11_id('reviewer01'),
      'review_id', pg_temp.s11_id('review3'),
      'assignment_id', pg_temp.s11_id('assignment4'), 'reviewed_hash', pg_temp.s11_hex('s11-frozen'),
      'step_up_at', '2026-10-01T14:00:00Z'::timestamptz - interval '630 seconds')))),
  '00000',
  'decision: an MFA instant exactly 630 s old is inside the freshness window plus skew [P2-S11-AC-109]'
);

select is(
  pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_editorial_decisions',
    pg_temp.s11_decision_row(jsonb_build_object(
      'reviewer_person_id', pg_temp.s11_id('reviewer02'),
      'review_id', pg_temp.s11_id('review3'),
      'assignment_id', pg_temp.s11_id('assignment5'), 'capability', 'cms.reviewer.policy')))),
  'P0001:CONFLICT',
  'decision: a second decision is refused while the review has not recorded the first (count and rows agree) [P2-S11-AC-109]'
);

select is(
  pg_temp.s11_outcome(format(
    'update platform_private.cms_editorial_reviews set recorded_decision_count = 1, version = 2, updated_at = clock_timestamp() where id = %L',
    pg_temp.s11_id('review3')
  )),
  '00000',
  'decision: the review advances its count after the decision row is appended [P2-S11-AC-109]'
);

select is(
  pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_editorial_decisions',
    pg_temp.s11_decision_row(jsonb_build_object(
      'reviewer_person_id', pg_temp.s11_id('reviewer02'),
      'review_id', pg_temp.s11_id('review3'),
      'assignment_id', pg_temp.s11_id('assignment5'), 'capability', 'cms.reviewer.policy',
      'step_up_at', '2026-10-01T14:00:00Z'::timestamptz + interval '30 seconds')))),
  '00000',
  'decision: the specialist slot decision of a protected review is recorded, MFA 30 s ahead is inside the skew [P2-S11-AC-109]'
);

select is(
  pg_temp.s11_outcome(format(
    'update platform_private.cms_editorial_decisions set reason = ''edited'' where id = %L',
    pg_temp.s11_id('decision1')
  )),
  'P0001:IMMUTABLE_RECORD',
  'decision: decision evidence is append-only and is never edited [P2-S11-AC-121]'
);

select is(
  pg_temp.s11_outcome(format(
    'delete from platform_private.cms_editorial_decisions where id = %L',
    pg_temp.s11_id('decision1')
  )),
  'P0001:IMMUTABLE_RECORD',
  'decision: decision evidence is never deleted [P2-S11-AC-121]'
);

select * from finish();
rollback;
