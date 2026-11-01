-- Slice 11 data model, lane S11-2: the ReviewDependency index (BE03b Database
-- Schema "ReviewDependency", Review invalidation "Dependency recheck"; tracker
-- P2-S11-AC-113).  RED before 20261005017040, GREEN after.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(22);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc

insert into s11_ids(key, value) values
  ('review1', 'a9110000-0000-4000-8000-000000000301'),
  ('review2', 'a9110000-0000-4000-8000-000000000302');

select pg_temp.s11_outcome(pg_temp.s11_insert_sql(
  'platform_private.cms_editorial_reviews',
  pg_temp.s11_review_row(jsonb_build_object('id', pg_temp.s11_id('review1')))
));
-- review2 stays open but is advanced past submission (version 2).
select pg_temp.s11_outcome(pg_temp.s11_insert_sql(
  'platform_private.cms_editorial_reviews',
  pg_temp.s11_review_row(jsonb_build_object(
    'id', pg_temp.s11_id('review2'), 'revision_id', pg_temp.s11_id('revA2'),
    'required_decision_count', 2, 'risk_class', 'protected',
    'required_capabilities', jsonb_build_array('cms.reviewer', 'cms.reviewer.policy')
  ))
));
select pg_temp.s11_seed_review_update(format(
  'update platform_private.cms_editorial_reviews set recorded_decision_count = 1, version = 2, updated_at = clock_timestamp() where id = %L',
  pg_temp.s11_id('review2')
));

select is(
  (select string_agg(version::text, ',' order by id::text) from platform_private.cms_editorial_reviews),
  '1,2',
  'S11 dependency fixture: review1 is at its submission version and review2 has advanced'
);

-- ---------------------------------------------------------------------------
-- Shape.
-- ---------------------------------------------------------------------------
select ok(
  to_regclass('platform_private.cms_editorial_review_dependencies') is not null
    and pg_temp.s10r_column_type('platform_private.cms_editorial_review_dependencies', 'ref_id') = 'uuid'
    and pg_temp.s10r_col_notnull('platform_private.cms_editorial_review_dependencies', 'ref_id')
    and pg_temp.s10r_col_notnull('platform_private.cms_editorial_review_dependencies', 'kind')
    and pg_temp.s10r_col_notnull('platform_private.cms_editorial_review_dependencies', 'review_id')
    and pg_temp.s10r_has_default('platform_private.cms_editorial_review_dependencies', 'version'),
  'dependency: the locked column set exists [P2-S11-AC-113]'
);

select is(
  pg_temp.s11_labels('platform_private.cms_editorial_review_dependencies', 'kind'),
  array['block','locale_source','pattern','relation_target','schema','settings','taxonomy_version','template','term']::text[],
  'dependency: kind is the closed nine-member union of the frozen manifest identities [P2-S11-AC-113]'
);

select ok(
  pg_temp.s11_constraint_has(
    'platform_private.cms_editorial_review_dependencies', 'cms_editorial_review_dependencies_review_kind_ref_key',
    array['UNIQUE (review_id, kind, ref_id)']
  )
    and pg_temp.s11_constraint_has(
      'platform_private.cms_editorial_review_dependencies', 'cms_editorial_review_dependencies_review_owner_fkey',
      array['FOREIGN KEY (review_id, owner_id)', 'cms_editorial_reviews(id, owner_id)']
    )
    and pg_temp.s10r_fk_target('platform_private.cms_editorial_review_dependencies', 'review_id')
      = 'platform_private.cms_editorial_reviews.id'
    and pg_temp.s11_index_has(
      'platform_private.cms_editorial_review_dependencies', 'cms_editorial_review_dependencies_kind_ref_idx',
      array['(kind, ref_id)']
    )
    and pg_temp.s11_index_has(
      'platform_private.cms_editorial_review_dependencies', 'cms_editorial_review_dependencies_review_idx',
      array['(review_id)']
    ),
  'dependency: one row per (review, kind, identity), a real review owner, and the recheck job''s (kind, ref) index [P2-S11-AC-113]'
);

-- ---------------------------------------------------------------------------
-- Constraints in isolation.
-- ---------------------------------------------------------------------------
select is(
  pg_temp.s11_bare_outcome(
    'platform_private.cms_editorial_review_dependencies',
    pg_temp.s11_insert_sql('platform_private.cms_editorial_review_dependencies', pg_temp.s11_dependency_row())
  ),
  '00000',
  'dependency: control - the canonical schema dependency image is accepted [P2-S11-AC-113]'
);

select is(
  pg_temp.s11_bare_outcome(
    'platform_private.cms_editorial_review_dependencies',
    pg_temp.s11_insert_sql('platform_private.cms_editorial_review_dependencies',
      pg_temp.s11_dependency_row('{"kind":"media"}'::jsonb))
  ),
  '23514',
  'dependency: a kind outside the manifest groups is refused [P2-S11-AC-113]'
);

select is(
  pg_temp.s11_bare_outcome(
    'platform_private.cms_editorial_review_dependencies',
    pg_temp.s11_insert_sql('platform_private.cms_editorial_review_dependencies',
      pg_temp.s11_dependency_row('{"version":2}'::jsonb))
  ),
  '23514',
  'dependency: the row is version 1 forever [P2-S11-AC-113]'
);

select is(
  pg_temp.s11_bare_outcome(
    'platform_private.cms_editorial_review_dependencies',
    pg_temp.s11_insert_sql('platform_private.cms_editorial_review_dependencies',
      pg_temp.s11_dependency_row('{"updated_at":"2026-10-02T14:00:00Z"}'::jsonb))
  ),
  '23514',
  'dependency: updated_at equals created_at on immutable evidence [P2-S11-AC-113]'
);

select is(
  pg_temp.s11_bare_outcome(
    'platform_private.cms_editorial_review_dependencies',
    pg_temp.s11_insert_sql('platform_private.cms_editorial_review_dependencies',
      pg_temp.s11_dependency_row(jsonb_build_object('owner_id', pg_temp.s11_id('stranger'))))
  ),
  '23503',
  'dependency: the owner is the review owner, never another party [P2-S11-AC-113]'
);

-- ---------------------------------------------------------------------------
-- Insert guard: written at submission only.
-- ---------------------------------------------------------------------------
select is(
  pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_editorial_review_dependencies',
    pg_temp.s11_dependency_row())),
  '00000',
  'dependency: the submission writes a manifest identity of a review at its submission version [P2-S11-AC-113]'
);

select is(
  pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_editorial_review_dependencies',
    pg_temp.s11_dependency_row())),
  '23505',
  'dependency: an identity is indexed once per review and kind [P2-S11-AC-113]'
);

select is(
  (select string_agg(distinct pg_temp.s11_outcome(pg_temp.s11_insert_sql(
      'platform_private.cms_editorial_review_dependencies',
      pg_temp.s11_dependency_row(jsonb_build_object('kind', kind_name, 'ref_id', gen_random_uuid())))), ',')
     from unnest(array['template','block','pattern','term','taxonomy_version','locale_source','relation_target','settings']) as kind_name),
  '00000',
  'dependency: every remaining manifest kind is accepted [P2-S11-AC-113]'
);

select is(
  pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_editorial_review_dependencies',
    pg_temp.s11_dependency_row(jsonb_build_object('review_id', pg_temp.s11_id('review2'))))),
  'P0001:CONFLICT',
  'dependency: a review that has advanced past submission takes no further dependency rows [P2-S11-AC-113]'
);

select is(
  pg_temp.s11_outcome(format(
    'update platform_private.cms_editorial_reviews set state = ''invalidated'', invalidated_reason = ''dependency_changed'', version = 2, updated_at = clock_timestamp() where id = %L',
    pg_temp.s11_id('review1')
  )),
  '00000',
  'dependency: the review is invalidated by a dependency change [P2-S11-AC-113]'
);

select is(
  (select count(*)::integer from platform_private.cms_editorial_review_dependencies
    where review_id = pg_temp.s11_id('review1')),
  9,
  'dependency: the rows persist after invalidation as history [P2-S11-AC-113]'
);

select is(
  pg_temp.s11_outcome(format(
    'update platform_private.cms_editorial_review_dependencies set ref_id = gen_random_uuid() where review_id = %L',
    pg_temp.s11_id('review1')
  )),
  'P0001:IMMUTABLE_RECORD',
  'dependency: the frozen manifest index is never edited [P2-S11-AC-113]'
);

select is(
  pg_temp.s11_outcome(format(
    'delete from platform_private.cms_editorial_review_dependencies where review_id = %L',
    pg_temp.s11_id('review1')
  )),
  'P0001:IMMUTABLE_RECORD',
  'dependency: the frozen manifest index is never deleted [P2-S11-AC-113]'
);

select * from finish();
rollback;
