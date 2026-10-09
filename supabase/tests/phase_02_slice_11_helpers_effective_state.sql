-- Slice 11 shared helpers: platform_private.cms_revision_effective_state and
-- cms_revision_effective_states (BE03b "Derived revision workflow state (E2)";
-- tracker P2-S11-AC-085).  RED before 20261005017540, GREEN after.
--
-- The physical cms_entry_revisions.state is the constant `draft`; the
-- browser-visible EntryRevisionState is derived, first match wins:
--   1 published  a publication-lineage row with action = 'publish' references the revision
--   2 scheduled  a schedule of the revision with action = 'publish' is pending|executing|failed_retryable
--   3 approved   the latest review (greatest submitted_at, then id) is approved
--   4 rejected   the latest review is rejected
--   5 submitted  the latest review is open
--   6 draft      otherwise (no review, or the latest review is invalidated)

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(44);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/001-world.sqlinc
\ir phase_02_slice_11_helpers/002-reviews.sqlinc

create or replace function pg_temp.h11_state(p_tag text)
returns text
language sql
as $body$
  select pg_temp.h11_text(format('select platform_private.cms_revision_effective_state(%L::uuid)',
    pg_temp.h11w_uuid(p_tag || ':revision')))
$body$;

create or replace function pg_temp.h11e_set(p_tags text[])
returns text
language sql
as $body$
  select pg_temp.h11_text(format(
    'select coalesce(string_agg(state, '','' order by revision_id), '''') from platform_private.cms_revision_effective_states(%L::uuid[])',
    (select array_agg(pg_temp.h11w_uuid(t || ':revision')) from unnest(p_tags) t)))
$body$;

-- ---------------------------------------------------------------------------
-- Shape and privileges.
-- ---------------------------------------------------------------------------
select ok(
  pg_temp.h11_private_definer('cms_revision_effective_state(uuid)')
    and pg_temp.h11_private_definer('cms_revision_effective_states(uuid[])'),
  'both effective-state helpers are private SECURITY DEFINER functions of the CMS definer with an empty search_path and no API-role execute [P2-S11-AC-085]'
);
select ok(
  pg_temp.h11_volatility('cms_revision_effective_state(uuid)') = 's'
    and pg_temp.h11_volatility('cms_revision_effective_states(uuid[])') = 's',
  'both effective-state helpers are STABLE [P2-S11-AC-085]'
);
select is(pg_temp.h11_rettype('cms_revision_effective_state(uuid)'), 'text',
  'the single form returns text [P2-S11-AC-085]');
select is(pg_temp.h11_rettype('cms_revision_effective_states(uuid[])'),
  'TABLE(revision_id uuid, state text)', 'the set form returns (revision_id, state) [P2-S11-AC-085]');

-- ---------------------------------------------------------------------------
-- The six states.
-- ---------------------------------------------------------------------------
select pg_temp.h11w_revision('draft');
select is(pg_temp.h11_state('draft'), 'draft', 'a revision with no review is draft [P2-S11-AC-085]');

select pg_temp.h11w_revision('open');
select pg_temp.h11r_review('open-review', jsonb_build_object(
  'revision_id', pg_temp.h11w_uuid('open:revision'), 'entry_id', pg_temp.h11w_uuid('open:entry')));
select is(pg_temp.h11_state('open'), 'submitted', 'a revision whose latest review is open is submitted [P2-S11-AC-085]');

-- The approved reviews below are approved by reviewer01: the review state guard only accepts an approval
-- that qualifying decision rows back, so the approver holds the standing reviewer capability.
select pg_temp.h11r_member('reviewer01', array['cms.reviewer']);

select pg_temp.h11w_revision('approved');
select pg_temp.h11r_approved('appr-review', pg_temp.h11w_uuid('approved:revision'), pg_temp.h11w_uuid('approved:entry'));
select is(pg_temp.h11_state('approved'), 'approved', 'a revision whose latest review is approved is approved [P2-S11-AC-085]');

select pg_temp.h11w_revision('rejected');
select pg_temp.h11r_review('rej-review', jsonb_build_object(
  'revision_id', pg_temp.h11w_uuid('rejected:revision'), 'entry_id', pg_temp.h11w_uuid('rejected:entry')));
select pg_temp.h11r_assign('rej-asg', 'rej-review', 'reviewer02');
select pg_temp.h11r_decide('rej-dec', 'rej-review', 'reviewer02', 'rej-asg', 'reject');
select is(pg_temp.h11_state('rejected'), 'rejected', 'a revision whose latest review is rejected is rejected [P2-S11-AC-085]');

select pg_temp.h11w_revision('invalidated');
select pg_temp.h11r_review('inv-review', jsonb_build_object(
  'revision_id', pg_temp.h11w_uuid('invalidated:revision'), 'entry_id', pg_temp.h11w_uuid('invalidated:entry')));
update platform_private.cms_editorial_reviews
   set state = 'invalidated', invalidated_reason = 'dependency_changed',
       version = version + 1, updated_at = clock_timestamp()
 where id = pg_temp.s11_id('inv-review');
select is(pg_temp.h11_state('invalidated'), 'draft',
  'an invalidated review returns its revision to draft (resubmittable) [P2-S11-AC-085]');

-- ---------------------------------------------------------------------------
-- The latest review decides (greatest submitted_at, then id).
-- ---------------------------------------------------------------------------
select pg_temp.h11w_revision('later');
select pg_temp.h11r_review('later-old', jsonb_build_object(
  'revision_id', pg_temp.h11w_uuid('later:revision'), 'entry_id', pg_temp.h11w_uuid('later:entry'),
  'submitted_at', timestamptz '2026-10-02T10:00:00Z'));
update platform_private.cms_editorial_reviews
   set state = 'invalidated', invalidated_reason = 'revision_superseded', version = version + 1,
       updated_at = clock_timestamp()
 where id = pg_temp.s11_id('later-old');
select pg_temp.h11r_review('later-new', jsonb_build_object(
  'revision_id', pg_temp.h11w_uuid('later:revision'), 'entry_id', pg_temp.h11w_uuid('later:entry'),
  'submitted_at', timestamptz '2026-10-03T10:00:00Z'));
select is(pg_temp.h11_state('later'), 'submitted',
  'an invalidated older review does not mask the newer open review [P2-S11-AC-085]');

select pg_temp.h11w_revision('older-wins-not');
select pg_temp.h11r_review('ow-new', jsonb_build_object(
  'revision_id', pg_temp.h11w_uuid('older-wins-not:revision'), 'entry_id', pg_temp.h11w_uuid('older-wins-not:entry'),
  'submitted_at', timestamptz '2026-10-03T10:00:00Z'));
update platform_private.cms_editorial_reviews
   set state = 'invalidated', invalidated_reason = 'dependency_changed', version = version + 1,
       updated_at = clock_timestamp()
 where id = pg_temp.s11_id('ow-new');
select pg_temp.h11r_review('ow-old', jsonb_build_object(
  'revision_id', pg_temp.h11w_uuid('older-wins-not:revision'), 'entry_id', pg_temp.h11w_uuid('older-wins-not:entry'),
  'submitted_at', timestamptz '2026-10-02T10:00:00Z'));
select is(pg_temp.h11_state('older-wins-not'), 'draft',
  'order is by submitted_at, not insertion order: an open review inserted later but submitted earlier is not the latest [P2-S11-AC-085]');

-- Equal submitted_at: the greater id wins (insertion order must not matter).
select pg_temp.h11w_revision('tie');
insert into s11_ids(key, value) values
  ('tie-low', 'a9200000-0000-4000-8000-0000000a0001'), ('tie-high', 'a9200000-0000-4000-8000-0000000a0002');
select pg_temp.h11r_review('tie-high', jsonb_build_object(
  'revision_id', pg_temp.h11w_uuid('tie:revision'), 'entry_id', pg_temp.h11w_uuid('tie:entry'),
  'submitted_at', timestamptz '2026-10-04T10:00:00Z'));
update platform_private.cms_editorial_reviews
   set state = 'invalidated', invalidated_reason = 'dependency_changed', version = version + 1,
       updated_at = clock_timestamp()
 where id = pg_temp.s11_id('tie-high');
select pg_temp.h11r_review('tie-low', jsonb_build_object(
  'revision_id', pg_temp.h11w_uuid('tie:revision'), 'entry_id', pg_temp.h11w_uuid('tie:entry'),
  'submitted_at', timestamptz '2026-10-04T10:00:00Z'));
select is(pg_temp.h11_state('tie'), 'draft',
  'with equal submitted_at the review with the greater id is the latest (invalidated => draft) [P2-S11-AC-085]');

-- ---------------------------------------------------------------------------
-- scheduled
-- ---------------------------------------------------------------------------
create or replace function pg_temp.h11e_schedule(
  p_key text, p_tag text, p_review text, p_overrides jsonb default '{}'::jsonb
)
returns void
language plpgsql
as $body$
begin
  insert into s11_ids(key, value) values (p_key, extensions.gen_random_uuid()::text)
  on conflict (key) do nothing;
  perform pg_temp.h11r_raw_insert('platform_private.cms_publication_schedules',
    pg_temp.s11_schedule_row(jsonb_build_object(
      'id', pg_temp.s11_id(p_key), 'entry_id', pg_temp.h11w_uuid(p_tag || ':entry'),
      'revision_id', pg_temp.h11w_uuid(p_tag || ':revision'), 'review_id', pg_temp.s11_id(p_review),
      'created_by', pg_temp.s11_id('reviewer04')) || p_overrides));
end;
$body$;

select pg_temp.h11w_revision('sched-pending');
select pg_temp.h11r_approved('sp-review', pg_temp.h11w_uuid('sched-pending:revision'), pg_temp.h11w_uuid('sched-pending:entry'));
select pg_temp.h11e_schedule('sp-sched', 'sched-pending', 'sp-review');
select is(pg_temp.h11_state('sched-pending'), 'scheduled',
  'an approved revision with a pending publish schedule is scheduled (second rule beats the third) [P2-S11-AC-085]');

select pg_temp.h11w_revision('sched-exec');
select pg_temp.h11r_approved('se-review', pg_temp.h11w_uuid('sched-exec:revision'), pg_temp.h11w_uuid('sched-exec:entry'));
select pg_temp.h11e_schedule('se-sched', 'sched-exec', 'se-review', jsonb_build_object(
  'state', 'executing', 'lease_id', extensions.gen_random_uuid(),
  'lease_until', timestamptz '2027-01-15T08:05:00Z'));
select is(pg_temp.h11_state('sched-exec'), 'scheduled', 'an executing publish schedule keeps the revision scheduled [P2-S11-AC-085]');

select pg_temp.h11w_revision('sched-retry');
select pg_temp.h11r_approved('sr-review', pg_temp.h11w_uuid('sched-retry:revision'), pg_temp.h11w_uuid('sched-retry:entry'));
select pg_temp.h11e_schedule('sr-sched', 'sched-retry', 'sr-review', jsonb_build_object(
  'state', 'failed_retryable', 'attempt_count', 1, 'next_attempt_at', timestamptz '2027-01-15T08:01:00Z'));
select is(pg_temp.h11_state('sched-retry'), 'scheduled', 'a failed_retryable publish schedule keeps the revision scheduled [P2-S11-AC-085]');

select pg_temp.h11w_revision('sched-done');
select pg_temp.h11r_approved('sd-review', pg_temp.h11w_uuid('sched-done:revision'), pg_temp.h11w_uuid('sched-done:entry'));
select pg_temp.h11e_schedule('sd-sched', 'sched-done', 'sd-review', jsonb_build_object(
  'state', 'blocked', 'reason_code', 'preflight_failed'));
select is(pg_temp.h11_state('sched-done'), 'approved',
  'a blocked schedule no longer schedules the revision: it falls back to approved [P2-S11-AC-085]');

select pg_temp.h11w_revision('sched-cancel');
select pg_temp.h11r_approved('sc-review', pg_temp.h11w_uuid('sched-cancel:revision'), pg_temp.h11w_uuid('sched-cancel:entry'));
select pg_temp.h11e_schedule('sc-sched', 'sched-cancel', 'sc-review', jsonb_build_object(
  'state', 'cancelled', 'reason_code', 'approval_invalidated'));
select is(pg_temp.h11_state('sched-cancel'), 'approved', 'a cancelled schedule falls back to approved [P2-S11-AC-085]');

select pg_temp.h11w_revision('sched-complete');
select pg_temp.h11r_approved('scm-review', pg_temp.h11w_uuid('sched-complete:revision'), pg_temp.h11w_uuid('sched-complete:entry'));
select pg_temp.h11e_schedule('scm-sched', 'sched-complete', 'scm-review', jsonb_build_object(
  'state', 'completed', 'actual_at_utc', timestamptz '2027-01-15T08:00:03Z', 'deviation_seconds', 3));
select is(pg_temp.h11_state('sched-complete'), 'approved',
  'a completed schedule without a lineage row leaves the revision approved (published needs the lineage row) [P2-S11-AC-085]');

select pg_temp.h11w_revision('sched-unpublish');
select pg_temp.h11r_approved('su-review', pg_temp.h11w_uuid('sched-unpublish:revision'), pg_temp.h11w_uuid('sched-unpublish:entry'));
select pg_temp.h11e_schedule('su-sched', 'sched-unpublish', 'su-review', jsonb_build_object('action', 'unpublish'));
select is(pg_temp.h11_state('sched-unpublish'), 'approved',
  'only a publish schedule schedules a revision: a pending unpublish does not [P2-S11-AC-085]');

-- ---------------------------------------------------------------------------
-- published
-- ---------------------------------------------------------------------------
create or replace function pg_temp.h11e_publication(
  p_key text, p_tag text, p_overrides jsonb default '{}'::jsonb
)
returns void
language plpgsql
as $body$
begin
  insert into s11_ids(key, value) values (p_key, extensions.gen_random_uuid()::text)
  on conflict (key) do nothing;
  perform pg_temp.h11r_raw_insert('platform_private.cms_publication_versions',
    pg_temp.s11_publication_row(jsonb_build_object(
      'id', pg_temp.s11_id(p_key), 'publication_id', pg_temp.s11_id(p_key),
      'entry_id', pg_temp.h11w_uuid(p_tag || ':entry'),
      'revision_id', pg_temp.h11w_uuid(p_tag || ':revision'),
      'publisher_person_id', pg_temp.s11_id('reviewer04')) || p_overrides));
end;
$body$;

select pg_temp.h11w_revision('pub');
select pg_temp.h11e_publication('pub-row', 'pub');
select is(pg_temp.h11_state('pub'), 'published',
  'a revision referenced by a publish lineage row is published (no review needed) [P2-S11-AC-085]');

select pg_temp.h11w_revision('pub-all');
select pg_temp.h11r_approved('pa-review', pg_temp.h11w_uuid('pub-all:revision'), pg_temp.h11w_uuid('pub-all:entry'));
select pg_temp.h11e_schedule('pa-sched', 'pub-all', 'pa-review');
select pg_temp.h11e_publication('pa-row', 'pub-all');
select is(pg_temp.h11_state('pub-all'), 'published',
  'published wins over a live schedule and an approved review (first match) [P2-S11-AC-085]');

-- Whether that publication is still the live head is carried by the lineage, never by the revision.
select pg_temp.h11w_revision('pub-revoked');
select pg_temp.h11e_publication('prv-head', 'pub-revoked');
select pg_temp.h11e_publication('prv-tomb', 'pub-revoked', jsonb_build_object(
  'publication_id', pg_temp.s11_id('prv-head'), 'state', 'revoked', 'version', 2,
  'supersedes_id', pg_temp.s11_id('prv-head'), 'action', 'unpublish',
  'activated_at', null, 'revoked_at', timestamptz '2026-10-02T10:00:00Z'));
select is(pg_temp.h11_state('pub-revoked'), 'published',
  'a revoked lineage still leaves the revision published: head state lives on the PublicationVersion [P2-S11-AC-085]');

select pg_temp.h11w_revision('pub-other');
select pg_temp.h11w_revision('pub-sibling', 'creatorPerson', 'en-US', '[]'::jsonb, 'pub-other', 2);
select pg_temp.h11e_publication('po-row', 'pub-other');
select is(pg_temp.h11_state('pub-sibling'), 'draft',
  'a publication of a sibling revision of the same entry does not publish this revision [P2-S11-AC-085]');
select is(pg_temp.h11_state('pub-other'), 'published', 'control: the referenced revision is published [P2-S11-AC-085]');

-- ---------------------------------------------------------------------------
-- Set form.
-- ---------------------------------------------------------------------------
select is(
  pg_temp.h11e_set(array['draft', 'open', 'approved', 'rejected', 'invalidated', 'sched-pending', 'pub']),
  (select string_agg(expected.state, ',' order by expected.id) from (
     select pg_temp.h11w_uuid(t.tag || ':revision') as id, t.state
       from (values ('draft','draft'), ('open','submitted'), ('approved','approved'), ('rejected','rejected'),
                    ('invalidated','draft'), ('sched-pending','scheduled'), ('pub','published')) t(tag, state)
   ) expected),
  'the set form returns the same derived state per revision as the single form [P2-S11-AC-085]');

select is(
  pg_temp.h11_text(format('select count(*) from platform_private.cms_revision_effective_states(%L::uuid[])',
    array[pg_temp.h11w_uuid('draft:revision'), pg_temp.h11w_uuid('draft:revision'), pg_temp.h11w_uuid('open:revision')])),
  '2', 'the set form returns one row per distinct id [P2-S11-AC-085]');
select is(
  pg_temp.h11_text(format('select count(*) from platform_private.cms_revision_effective_states(%L::uuid[])',
    array[pg_temp.h11w_uuid('draft:revision'), 'a9200000-0000-4000-8000-0000000000ee'::uuid])),
  '1', 'the set form omits an absent revision (no concealing row) [P2-S11-AC-085]');
select is(
  pg_temp.h11_text('select count(*) from platform_private.cms_revision_effective_states(null::uuid[])'),
  '0', 'a null array is the empty set [P2-S11-AC-085]');
select is(
  pg_temp.h11_text('select count(*) from platform_private.cms_revision_effective_states(array[]::uuid[])'),
  '0', 'an empty array is the empty set [P2-S11-AC-085]');
select is(
  pg_temp.h11_text(format('select count(*) from platform_private.cms_revision_effective_states(%L::uuid[])',
    (select array_agg(extensions.gen_random_uuid()) from generate_series(1, 1001)))),
  'ERR:P0001:INVALID_REQUEST', 'more than 1000 ids is a malformed helper call [P2-S11-AC-085]');
select is(
  pg_temp.h11_text(format('select count(*) from platform_private.cms_revision_effective_states(%L::uuid[])',
    (select array_agg(extensions.gen_random_uuid()) from generate_series(1, 1000)))),
  '0', 'exactly 1000 ids is within the bound [P2-S11-AC-085]');

select is(pg_temp.h11_text(format('select platform_private.cms_revision_effective_state(%L::uuid)',
    'a9200000-0000-4000-8000-0000000000ee')), null,
  'the single form answers NULL for an absent revision [P2-S11-AC-085]');
select is(pg_temp.h11_text('select platform_private.cms_revision_effective_state(null)'), null,
  'the single form answers NULL for a null id [P2-S11-AC-085]');

-- ---------------------------------------------------------------------------
-- Read discipline: the helpers read only the three evidence tables.
-- ---------------------------------------------------------------------------
select ok(
  (select pg_get_functiondef(to_regprocedure('platform_private.cms_revision_effective_states(uuid[])')) !~* '(insert|update|delete)\s+(into\s+)?platform_private'),
  'the set form writes nothing [P2-S11-AC-085]');
select ok(
  (select pg_get_functiondef(to_regprocedure('platform_private.cms_revision_effective_states(uuid[])')) !~* 'cms_editorial_decisions|cms_editorial_review_assignments|cms_preview_tokens'),
  'the derivation reads only reviews, schedules and publication lineage (E2) [P2-S11-AC-085]');
select is(
  (select count(*)::integer from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'platform_private' and p.proname in ('cms_revision_effective_state', 'cms_revision_effective_states')),
  2, 'exactly one overload of each effective-state helper exists [P2-S11-AC-085]');

select * from finish();
rollback;
