\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

select ok(
  exists (select 1 from pg_constraint
    where conrelid = to_regclass('platform_private.cms_terms')
      and conname = 'cms_terms_parent_taxonomy_owner_fkey'
      and contype = 'f' and convalidated),
  'term parent must belong to the same vocabulary and owner'
);
select ok(
  exists (select 1 from pg_constraint
    where conrelid = to_regclass('platform_private.cms_terms')
      and conname = 'cms_terms_successor_taxonomy_owner_fkey'
      and contype = 'f' and convalidated),
  'merge successor must belong to the same vocabulary and owner'
);
select ok(
  exists (select 1 from pg_constraint
    where conrelid = to_regclass('platform_private.cms_term_assignments')
      and conname = 'cms_term_assignments_term_taxonomy_owner_fkey'
      and contype = 'f' and convalidated),
  'assignment term and vocabulary must resolve to one owner-bound pair'
);
select ok(
  exists (select 1 from pg_constraint
    where conrelid = to_regclass('platform_private.cms_term_assignments')
      and conname = 'cms_term_assignments_revision_owner_fkey'
      and contype = 'f' and convalidated),
  'assignment revision must belong to the same owner'
);
select ok(
  exists (select 1 from pg_constraint
    where conrelid = to_regclass('platform_private.cms_term_assignments')
      and conname = 'cms_term_assignments_field_owner_fkey'
      and contype = 'f' and convalidated
      and pg_get_constraintdef(oid) like
        'FOREIGN KEY (field_definition_id, owner_id) REFERENCES platform_private.cms_field_definition_versions(id, owner_id)%'),
  'assignment field definition must belong to the same owner'
);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc

select set_config('app.cms_rpc', 'true', true);
insert into platform_private.cms_taxonomy_versions(
  id, owner_id, version, taxonomy_key, owner_capability, shape,
  allowlisted_type_keys, allowlisted_field_keys, content_hash, created_by
)
select id, owner_id, 1, key, 'cms.taxonomy_curator', 'hierarchical',
       '[]'::jsonb, '[]'::jsonb, repeat('a', 64), created_by
from (values
  ('a9140000-0000-4000-8000-000000000001'::uuid,
   (select value::uuid from s10_ids where key = 'organization'),
   'first-vocabulary',
   (select value::uuid from s10_ids where key = 'creatorAuth')),
  ('a9140000-0000-4000-8000-000000000002'::uuid,
   (select value::uuid from s10_ids where key = 'organization'),
   'second-vocabulary',
   (select value::uuid from s10_ids where key = 'creatorAuth')),
  ('a9140000-0000-4000-8000-000000000003'::uuid,
   (select value::uuid from s10_ids where key = 'strangerPerson'),
   'foreign-vocabulary',
   (select value::uuid from s10_ids where key = 'strangerAuth'))
) rows(id, owner_id, key, created_by);

insert into platform_private.cms_terms(
  id, owner_id, version, taxonomy_version_id, term_key, created_by
)
select id, owner_id, 1, taxonomy_version_id, term_key, created_by
from (values
  ('a9140000-0000-4000-8000-000000000011'::uuid,
   (select value::uuid from s10_ids where key = 'organization'),
   'a9140000-0000-4000-8000-000000000001'::uuid,
   'first-term',
   (select value::uuid from s10_ids where key = 'creatorAuth')),
  ('a9140000-0000-4000-8000-000000000012'::uuid,
   (select value::uuid from s10_ids where key = 'organization'),
   'a9140000-0000-4000-8000-000000000002'::uuid,
   'second-term',
   (select value::uuid from s10_ids where key = 'creatorAuth')),
  ('a9140000-0000-4000-8000-000000000013'::uuid,
   (select value::uuid from s10_ids where key = 'strangerPerson'),
   'a9140000-0000-4000-8000-000000000003'::uuid,
   'foreign-term',
   (select value::uuid from s10_ids where key = 'strangerAuth'))
) rows(id, owner_id, taxonomy_version_id, term_key, created_by);

select throws_ok(
  $$insert into platform_private.cms_terms(
      id, owner_id, version, taxonomy_version_id, term_key,
      parent_term_id, created_by
    )
    select 'a9140000-0000-4000-8000-000000000014',
           (select value::uuid from s10_ids where key = 'organization'),
           1, 'a9140000-0000-4000-8000-000000000001', 'invalid-child',
           'a9140000-0000-4000-8000-000000000012',
           (select value::uuid from s10_ids where key = 'creatorAuth')$$,
  '23503', null, 'a term cannot name a parent from another vocabulary'
);
select throws_ok(
  $$update platform_private.cms_terms
    set lifecycle = 'merged', version = 2,
        successor_id = 'a9140000-0000-4000-8000-000000000012',
        updated_at = clock_timestamp()
    where id = 'a9140000-0000-4000-8000-000000000011'$$,
  '23503', null, 'a merge cannot redirect to another vocabulary'
);
select throws_ok(
  $$insert into platform_private.cms_term_assignments(
      id, owner_id, version, revision_id, field_definition_id,
      term_id, taxonomy_version_id, position, provenance, created_by
    )
    select 'a9140000-0000-4000-8000-000000000021',
           (select value::uuid from s10_ids where key = 'organization'),
           1, (select value::uuid from s10_ids where key = 'entryRevisionId'),
           (select value::uuid from s10_ids where key = 'typeFieldId'),
           'a9140000-0000-4000-8000-000000000012',
           'a9140000-0000-4000-8000-000000000001', 0, 'authored',
           (select value::uuid from s10_ids where key = 'creatorAuth')$$,
  '23503', null, 'assignment cannot pair a term with another vocabulary'
);
select throws_ok(
  $$insert into platform_private.cms_term_assignments(
      id, owner_id, version, revision_id, field_definition_id,
      term_id, taxonomy_version_id, position, provenance, created_by
    )
    select 'a9140000-0000-4000-8000-000000000022',
           (select value::uuid from s10_ids where key = 'strangerPerson'),
           1, (select value::uuid from s10_ids where key = 'entryRevisionId'),
           (select value::uuid from s10_ids where key = 'typeFieldId'),
           'a9140000-0000-4000-8000-000000000013',
           'a9140000-0000-4000-8000-000000000003', 0, 'authored',
           (select value::uuid from s10_ids where key = 'strangerAuth')$$,
  '23503', null, 'assignment cannot attach a foreign-owner revision'
);

insert into platform_private.cms_term_assignments(
  id, owner_id, version, revision_id, field_definition_id,
  term_id, taxonomy_version_id, position, provenance, created_by
)
select 'a9140000-0000-4000-8000-000000000023',
       (select value::uuid from s10_ids where key = 'organization'),
       1, (select value::uuid from s10_ids where key = 'entryRevisionId'),
       (select value::uuid from s10_ids where key = 'typeFieldId'),
       'a9140000-0000-4000-8000-000000000011',
       'a9140000-0000-4000-8000-000000000001', 0, 'authored',
       (select value::uuid from s10_ids where key = 'creatorAuth');
select ok(
  exists (select 1 from platform_private.cms_term_assignments
    where id = 'a9140000-0000-4000-8000-000000000023'),
  'a matching owner and vocabulary assignment remains insertable'
);

-- A curator may move a term under an existing descendant. Stable IDs and the
-- same-taxonomy FK alone do not prevent a cycle after a permitted CAS update.
insert into platform_private.cms_terms(
  id, owner_id, version, taxonomy_version_id, term_key,
  parent_term_id, created_by
)
select 'a9140000-0000-4000-8000-000000000015',
       (select value::uuid from s10_ids where key = 'organization'),
       1, 'a9140000-0000-4000-8000-000000000001', 'first-child',
       'a9140000-0000-4000-8000-000000000011',
       (select value::uuid from s10_ids where key = 'creatorAuth');
insert into platform_private.cms_terms(
  id, owner_id, version, taxonomy_version_id, term_key,
  parent_term_id, created_by
)
select 'a9140000-0000-4000-8000-000000000016',
       (select value::uuid from s10_ids where key = 'organization'),
       1, 'a9140000-0000-4000-8000-000000000001', 'first-grandchild',
       'a9140000-0000-4000-8000-000000000015',
       (select value::uuid from s10_ids where key = 'creatorAuth');
select throws_ok(
  $$update platform_private.cms_terms
    set parent_term_id = 'a9140000-0000-4000-8000-000000000016',
        version = 2, updated_at = clock_timestamp()
    where id = 'a9140000-0000-4000-8000-000000000011'$$,
  'P0001', 'VALIDATION_FAILED',
  'a curator cannot reparent a root below its grandchild'
);
select is(
  (select parent_term_id from platform_private.cms_terms
    where id = 'a9140000-0000-4000-8000-000000000011'),
  null::uuid, 'a rejected cycle leaves the existing hierarchy unchanged'
);
select lives_ok(
  $$update platform_private.cms_terms
    set parent_term_id = 'a9140000-0000-4000-8000-000000000011',
        version = 2, updated_at = clock_timestamp()
    where id = 'a9140000-0000-4000-8000-000000000016'$$,
  'a valid CAS move within the vocabulary remains possible'
);

-- A term merged into a survivor remains a permanent redirect, not a usable
-- hierarchy parent. A later command must not attach children to that ID.
update platform_private.cms_terms
   set lifecycle = 'merged',
       successor_id = 'a9140000-0000-4000-8000-000000000015',
       version = 3, updated_at = clock_timestamp()
 where id = 'a9140000-0000-4000-8000-000000000016';
select throws_ok(
  $$insert into platform_private.cms_terms(
      id, owner_id, version, taxonomy_version_id, term_key,
      parent_term_id, created_by
    )
    select 'a9140000-0000-4000-8000-000000000017',
           (select value::uuid from s10_ids where key = 'organization'),
           1, 'a9140000-0000-4000-8000-000000000001',
           'child-of-merged',
           'a9140000-0000-4000-8000-000000000016',
           (select value::uuid from s10_ids where key = 'creatorAuth')$$,
  'P0001', 'VALIDATION_FAILED',
  'a merged redirect cannot become a new term parent'
);
select throws_ok(
  $$update platform_private.cms_terms
    set parent_term_id = 'a9140000-0000-4000-8000-000000000016',
        version = 2, updated_at = clock_timestamp()
    where id = 'a9140000-0000-4000-8000-000000000015'$$,
  'P0001', 'VALIDATION_FAILED',
  'an existing term cannot move under a merged redirect'
);
select throws_ok(
  $$update platform_private.cms_terms
    set lifecycle = 'merged',
        successor_id = 'a9140000-0000-4000-8000-000000000015',
        version = 2, updated_at = clock_timestamp()
    where id = 'a9140000-0000-4000-8000-000000000011'$$,
  'P0001', 'VALIDATION_FAILED',
  'a parent cannot merge while children still reference it'
);
select is(
  (select lifecycle from platform_private.cms_terms
    where id = 'a9140000-0000-4000-8000-000000000011'),
  'active', 'a refused parent merge keeps the original term active'
);

-- A redirect must always point directly to an active, terminal survivor.
-- Otherwise a later merge can strand the permanent ID behind a chain or cycle.
insert into platform_private.cms_terms(
  id, owner_id, version, taxonomy_version_id, term_key, created_by
)
select id, (select value::uuid from s10_ids where key = 'organization'),
       1, 'a9140000-0000-4000-8000-000000000001', term_key,
       (select value::uuid from s10_ids where key = 'creatorAuth')
from (values
  ('a9140000-0000-4000-8000-000000000018'::uuid, 'new-retiree'),
  ('a9140000-0000-4000-8000-000000000019'::uuid, 'valid-retiree')
) terms(id, term_key);
select throws_ok(
  $$update platform_private.cms_terms
    set lifecycle = 'merged',
        successor_id = 'a9140000-0000-4000-8000-000000000016',
        version = 2, updated_at = clock_timestamp()
    where id = 'a9140000-0000-4000-8000-000000000018'$$,
  'P0001', 'VALIDATION_FAILED',
  'a merge cannot choose an already-merged redirect as survivor'
);
select throws_ok(
  $$update platform_private.cms_terms
    set lifecycle = 'merged',
        successor_id = 'a9140000-0000-4000-8000-000000000011',
        version = 2, updated_at = clock_timestamp()
    where id = 'a9140000-0000-4000-8000-000000000015'$$,
  'P0001', 'VALIDATION_FAILED',
  'a direct survivor cannot later merge while inbound redirects exist'
);
select lives_ok(
  $$update platform_private.cms_terms
    set lifecycle = 'merged',
        successor_id = 'a9140000-0000-4000-8000-000000000015',
        version = 2, updated_at = clock_timestamp()
    where id = 'a9140000-0000-4000-8000-000000000019'$$,
  'a fresh term may still merge directly into an active survivor'
);
select is(
  (select successor_id from platform_private.cms_terms
    where id = 'a9140000-0000-4000-8000-000000000019'),
  'a9140000-0000-4000-8000-000000000015'::uuid,
  'a successful merge stores the direct survivor ID'
);
select ok(
  exists (
    select 1
    from pg_proc function_record
    join pg_namespace namespace_record
      on namespace_record.oid = function_record.pronamespace
    where namespace_record.nspname = 'platform_private'
      and function_record.proname = 'cms_terms_hierarchy_cycle_guard'
      and function_record.prosecdef
      and not has_function_privilege(
        'authenticated', function_record.oid, 'EXECUTE')
  ), 'the private cycle guard runs under a closed definer boundary'
);

select finish();
rollback;
