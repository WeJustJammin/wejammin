-- Slice 11 data model, lane S11-2: the EditorialReviewAssignment record (BE03b
-- Database Schema "Support records", Review scopes and reviewer assignment,
-- DEC-136; tracker P2-S11-AC-119).  RED before 20261005017020, GREEN after.

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
-- Shape.
-- ---------------------------------------------------------------------------
select ok(
  to_regclass('platform_private.cms_editorial_review_assignments') is not null
    and pg_temp.s10r_column_type('platform_private.cms_editorial_review_assignments', 'actions') = '_text'
    and pg_temp.s10r_column_type('platform_private.cms_editorial_review_assignments', 'starts_at') = 'timestamptz'
    and pg_temp.s10r_col_notnull('platform_private.cms_editorial_review_assignments', 'starts_at')
    and pg_temp.s10r_col_notnull('platform_private.cms_editorial_review_assignments', 'ends_at')
    and pg_temp.s10r_col_notnull('platform_private.cms_editorial_review_assignments', 'reviewer_person_id')
    and pg_temp.s10r_col_notnull('platform_private.cms_editorial_review_assignments', 'grantor_person_id')
    and not pg_temp.s10r_col_notnull('platform_private.cms_editorial_review_assignments', 'reason')
    and pg_temp.s10r_has_default('platform_private.cms_editorial_review_assignments', 'version')
    and pg_temp.s10r_has_default('platform_private.cms_editorial_review_assignments', 'created_at'),
  'assignment: the locked column set, nullability and defaults exist [P2-S11-AC-119]'
);

select is(
  pg_temp.s11_labels('platform_private.cms_editorial_review_assignments', 'state'),
  array['active','revoked']::text[],
  'assignment: state is the closed active/revoked union [P2-S11-AC-119]'
);

select ok(
  pg_temp.s10r_fk_target('platform_private.cms_editorial_review_assignments', 'review_id')
      = 'platform_private.cms_editorial_reviews.id'
    and pg_temp.s10r_fk_target('platform_private.cms_editorial_review_assignments', 'reviewer_person_id')
      = 'platform_private.person_party.party_id'
    and pg_temp.s10r_fk_target('platform_private.cms_editorial_review_assignments', 'grantor_person_id')
      = 'platform_private.person_party.party_id'
    and pg_temp.s11_constraint_has(
      'platform_private.cms_editorial_review_assignments', 'cms_editorial_review_assignments_review_owner_fkey',
      array['FOREIGN KEY (review_id, owner_id)', 'cms_editorial_reviews(id, owner_id)']
    ),
  'assignment: the review, the reviewer, the grantor and the review owner are real references [P2-S11-AC-119]'
);

select ok(
  pg_temp.s11_constraint_has(
    'platform_private.cms_editorial_review_assignments', 'cms_editorial_review_assignments_id_review_reviewer_key',
    array['UNIQUE (id, review_id, reviewer_person_id)']
  )
    and pg_temp.s11_index_has(
      'platform_private.cms_editorial_review_assignments', 'cms_editorial_review_assignments_active_reviewer_unique',
      array['UNIQUE', '(review_id, reviewer_person_id)', 'state = ''active''']
    )
    and pg_temp.s11_index_has(
      'platform_private.cms_editorial_review_assignments', 'cms_editorial_review_assignments_review_reviewer_state_idx',
      array['(review_id, reviewer_person_id, state)']
    )
    and pg_temp.s11_index_has(
      'platform_private.cms_editorial_review_assignments', 'cms_editorial_review_assignments_reviewer_state_ends_idx',
      array['(reviewer_person_id, state, ends_at)']
    )
    and pg_temp.s11_index_has(
      'platform_private.cms_editorial_review_assignments', 'cms_editorial_review_assignments_owner_state_ends_idx',
      array['(owner_id, state, ends_at)']
    ),
  'assignment: one active assignment per reviewer and review plus the three locked indexes [P2-S11-AC-119]'
);

-- ---------------------------------------------------------------------------
-- Constraints in isolation.
-- ---------------------------------------------------------------------------
select is(
  pg_temp.s11_bare_outcome(
    'platform_private.cms_editorial_review_assignments',
    pg_temp.s11_insert_sql(
      'platform_private.cms_editorial_review_assignments', pg_temp.s11_assignment_row()
    )
  ),
  '00000',
  'assignment: control - the canonical one-day read/decide assignment image is accepted [P2-S11-AC-119]'
);

select is(
  pg_temp.s11_bare_outcome(
    'platform_private.cms_editorial_review_assignments',
    pg_temp.s11_insert_sql(
      'platform_private.cms_editorial_review_assignments',
      pg_temp.s11_assignment_row('{"capability_key":"cms.reviewer"}'::jsonb)
    )
  ),
  '23514',
  'assignment: the assignment capability is fixed to cms.editorial_review [P2-S11-AC-119]'
);

select is(
  pg_temp.s11_bare_outcome(
    'platform_private.cms_editorial_review_assignments',
    pg_temp.s11_insert_sql(
      'platform_private.cms_editorial_review_assignments',
      pg_temp.s11_assignment_row('{"actions":["read"]}'::jsonb)
    )
  ),
  '23514',
  'assignment: the actions are exactly read and decide, never edit, publish, assign or admin [P2-S11-AC-119]'
);

select is(
  pg_temp.s11_bare_outcome(
    'platform_private.cms_editorial_review_assignments',
    pg_temp.s11_insert_sql(
      'platform_private.cms_editorial_review_assignments',
      pg_temp.s11_assignment_row('{"actions":["read","decide","publish"]}'::jsonb)
    )
  ),
  '23514',
  'assignment: an assignment cannot be broadened with another action [P2-S11-AC-119]'
);

select is(
  pg_temp.s11_bare_outcome(
    'platform_private.cms_editorial_review_assignments',
    pg_temp.s11_insert_sql(
      'platform_private.cms_editorial_review_assignments',
      pg_temp.s11_assignment_row('{"ends_at":"2026-10-01T14:00:00Z"}'::jsonb)
    )
  ),
  '23514',
  'assignment: the window must end after it starts [P2-S11-AC-119]'
);

select is(
  pg_temp.s11_bare_outcome(
    'platform_private.cms_editorial_review_assignments',
    pg_temp.s11_insert_sql(
      'platform_private.cms_editorial_review_assignments',
      pg_temp.s11_assignment_row('{"ends_at":"2026-10-08T14:00:01Z"}'::jsonb)
    )
  ),
  '23514',
  'assignment: the window is at most seven days [P2-S11-AC-119]'
);

select is(
  pg_temp.s11_bare_outcome(
    'platform_private.cms_editorial_review_assignments',
    pg_temp.s11_insert_sql(
      'platform_private.cms_editorial_review_assignments',
      pg_temp.s11_assignment_row('{"ends_at":"2026-10-08T14:00:00Z"}'::jsonb)
    )
  ),
  '00000',
  'assignment: control - a window of exactly seven days is accepted [P2-S11-AC-119]'
);

select is(
  pg_temp.s11_bare_outcome(
    'platform_private.cms_editorial_review_assignments',
    pg_temp.s11_insert_sql(
      'platform_private.cms_editorial_review_assignments',
      pg_temp.s11_assignment_row(jsonb_build_object('reason', repeat('r', 257)))
    )
  ),
  '23514',
  'assignment: the optional reason is at most 256 bytes [P2-S11-AC-119]'
);

select is(
  pg_temp.s11_bare_outcome(
    'platform_private.cms_editorial_review_assignments',
    pg_temp.s11_insert_sql(
      'platform_private.cms_editorial_review_assignments',
      pg_temp.s11_assignment_row('{"reason":""}'::jsonb)
    )
  ),
  '23514',
  'assignment: an empty reason is refused (absent is NULL) [P2-S11-AC-119]'
);

select is(
  pg_temp.s11_bare_outcome(
    'platform_private.cms_editorial_review_assignments',
    pg_temp.s11_insert_sql(
      'platform_private.cms_editorial_review_assignments',
      pg_temp.s11_assignment_row(jsonb_build_object('owner_id', pg_temp.s11_id('stranger')))
    )
  ),
  '23503',
  'assignment: the owner is the review owner, never another party [P2-S11-AC-119]'
);

select * from finish();
rollback;
