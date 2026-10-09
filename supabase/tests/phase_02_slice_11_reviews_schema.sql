-- Slice 11 data model, lane S11-2: the EditorialReview record (BE03b Database
-- Schema, Persisted model envelope, Review invalidation; tracker P2-S11-AC-111,
-- AC-120) and the revision (id, entry_id) key it relies on.  RED before
-- 20261005017000/017010, GREEN after.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(21);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc

-- ---------------------------------------------------------------------------
-- The (id, entry_id) key the review row binds a revision to its entry with.
-- (E2, the constant `draft` physical revision state, ships with the derived-state
-- helper in the Slice 11 command/read migrations, lane S11-3: the Slice 10 reads
-- still read the physical state and their suites seed the other five states.)
-- ---------------------------------------------------------------------------
select ok(
  pg_temp.s11_constraint_has(
    'platform_private.cms_entry_revisions', 'cms_entry_revisions_id_entry_key',
    array['UNIQUE (id, entry_id)']
  ),
  'revision: it is addressable by (id, entry_id) so child rows bind a revision to its entry [P2-S11-AC-120]'
);

-- ---------------------------------------------------------------------------
-- EditorialReview shape.
-- ---------------------------------------------------------------------------
select ok(
  pg_temp.s10r_column_type('platform_private.cms_editorial_reviews', 'entry_id') = 'uuid'
    and pg_temp.s10r_col_notnull('platform_private.cms_editorial_reviews', 'entry_id')
    and pg_temp.s10r_column_type('platform_private.cms_editorial_reviews', 'decided_at') = 'timestamptz'
    and not pg_temp.s10r_col_notnull('platform_private.cms_editorial_reviews', 'decided_at'),
  'review: entry_id is a required uuid and decided_at an optional timestamptz [P2-S11-AC-120]'
);

select is(
  pg_temp.s11_labels('platform_private.cms_editorial_reviews', 'invalidated_reason'),
  array['dependency_changed','entry_unavailable','reviewer_authority_changed','revision_superseded']::text[],
  'review: the invalidation reason is the closed four-token union [P2-S11-AC-111]'
);

select ok(
  pg_temp.s11_constraint_has(
    'platform_private.cms_editorial_reviews', 'cms_editorial_reviews_invalidated_state_check',
    array['state = ''invalidated''', 'invalidated_reason IS NOT NULL']
  )
    and pg_temp.s11_constraint_has(
      'platform_private.cms_editorial_reviews', 'cms_editorial_reviews_decided_state_check',
      array['approved', 'rejected', 'decided_at IS NOT NULL']
    ),
  'review: state invalidated holds exactly when a reason is stored, and approved/rejected exactly when decided_at is stored [P2-S11-AC-120]'
);

select ok(
  pg_temp.s10r_fk_target('platform_private.cms_editorial_reviews', 'entry_id')
      = 'platform_private.cms_content_entries.id'
    and pg_temp.s11_constraint_has(
      'platform_private.cms_editorial_reviews', 'cms_editorial_reviews_entry_owner_fkey',
      array['FOREIGN KEY (entry_id, owner_id)', 'cms_content_entries(id, owner_id)']
    )
    and pg_temp.s11_constraint_has(
      'platform_private.cms_editorial_reviews', 'cms_editorial_reviews_revision_entry_fkey',
      array['FOREIGN KEY (revision_id, entry_id)', 'cms_entry_revisions(id, entry_id)']
    ),
  'review: the entry, its owner and the revision-belongs-to-entry rule are foreign keys [P2-S11-AC-120]'
);

select ok(
  pg_temp.s11_constraint_has(
    'platform_private.cms_editorial_reviews', 'cms_editorial_reviews_id_owner_key',
    array['UNIQUE (id, owner_id)']
  )
    and pg_temp.s11_constraint_has(
      'platform_private.cms_editorial_reviews', 'cms_editorial_reviews_id_revision_key',
      array['UNIQUE (id, revision_id)']
    ),
  'review: child rows can bind to the review owner and to its revision [P2-S11-AC-120]'
);

select ok(
  pg_temp.s11_index_has(
    'platform_private.cms_editorial_reviews', 'cms_editorial_reviews_revision_submitted_idx',
    array['(revision_id, submitted_at DESC, id DESC)']
  )
    and pg_temp.s11_index_has(
      'platform_private.cms_editorial_reviews', 'cms_editorial_reviews_entry_state_idx',
      array['(entry_id, state)']
    )
    and pg_temp.s11_index_has(
      'platform_private.cms_editorial_reviews', 'cms_editorial_reviews_submitter_updated_idx',
      array['(submitted_by, updated_at DESC)']
    ),
  'review: the latest-review, entry-state and submitter indexes of the locked schema exist [P2-S11-AC-120]'
);

-- ---------------------------------------------------------------------------
-- EditorialReview constraints in isolation (user triggers disabled).
-- ---------------------------------------------------------------------------
select is(
  pg_temp.s11_bare_outcome(
    'platform_private.cms_editorial_reviews',
    pg_temp.s11_insert_sql(
      'platform_private.cms_editorial_reviews', pg_temp.s11_review_row()
    )
  ),
  '00000',
  'review: control - the canonical open review image is accepted [P2-S11-AC-120]'
);

select is(
  pg_temp.s11_bare_outcome(
    'platform_private.cms_editorial_reviews',
    pg_temp.s11_insert_sql(
      'platform_private.cms_editorial_reviews',
      pg_temp.s11_review_row('{"state":"invalidated"}'::jsonb)
    )
  ),
  '23514',
  'review: an invalidated review must carry its reason [P2-S11-AC-111]'
);

select is(
  pg_temp.s11_bare_outcome(
    'platform_private.cms_editorial_reviews',
    pg_temp.s11_insert_sql(
      'platform_private.cms_editorial_reviews',
      pg_temp.s11_review_row('{"invalidated_reason":"dependency_changed"}'::jsonb)
    )
  ),
  '23514',
  'review: a reason on a review that is not invalidated is refused [P2-S11-AC-111]'
);

select is(
  pg_temp.s11_bare_outcome(
    'platform_private.cms_editorial_reviews',
    pg_temp.s11_insert_sql(
      'platform_private.cms_editorial_reviews',
      pg_temp.s11_review_row('{"state":"invalidated","invalidated_reason":"stale"}'::jsonb)
    )
  ),
  '23514',
  'review: an invalidation reason outside the four closed tokens is refused [P2-S11-AC-111]'
);

select is(
  pg_temp.s11_bare_outcome(
    'platform_private.cms_editorial_reviews',
    pg_temp.s11_insert_sql(
      'platform_private.cms_editorial_reviews',
      pg_temp.s11_review_row(
        '{"state":"approved","recorded_decision_count":1}'::jsonb
      )
    )
  ),
  '23514',
  'review: an approved review must carry decided_at [P2-S11-AC-120]'
);

select is(
  pg_temp.s11_bare_outcome(
    'platform_private.cms_editorial_reviews',
    pg_temp.s11_insert_sql(
      'platform_private.cms_editorial_reviews',
      pg_temp.s11_review_row('{"decided_at":"2026-10-08T14:30:00Z"}'::jsonb)
    )
  ),
  '23514',
  'review: an open review cannot carry decided_at [P2-S11-AC-120]'
);

select is(
  pg_temp.s11_bare_outcome(
    'platform_private.cms_editorial_reviews',
    pg_temp.s11_insert_sql(
      'platform_private.cms_editorial_reviews',
      pg_temp.s11_review_row(
        '{"revision_id":"a9110000-0000-4000-8000-000000000102"}'::jsonb
      )
    )
  ),
  '23503',
  'review: a revision of another entry cannot be frozen under this entry [P2-S11-AC-120]'
);

select is(
  pg_temp.s11_bare_outcome(
    'platform_private.cms_editorial_reviews',
    pg_temp.s11_insert_sql(
      'platform_private.cms_editorial_reviews',
      pg_temp.s11_review_row(
        jsonb_build_object('owner_id', pg_temp.s11_id('stranger'))
      )
    )
  ),
  '23503',
  'review: the owner is the entry owner, never another party [P2-S11-AC-120]'
);

select is(
  pg_temp.s11_bare_outcome(
    'platform_private.cms_editorial_reviews',
    pg_temp.s11_insert_sql(
      'platform_private.cms_editorial_reviews',
      pg_temp.s11_review_row('{"risk_class":"protected"}'::jsonb)
    )
  ),
  '23514',
  'review: a protected review needs at least two decisions [P2-S11-AC-120]'
);

select * from finish();
rollback;
