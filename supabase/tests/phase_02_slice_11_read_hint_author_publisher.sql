-- Slice 11 lane "misc": the read hint of a revision AUTHOR who also holds cms.publisher (BE03b 268-270, E11:
-- only the human who schedules a `publish` is barred from publishing; DEC-164 FE03 reconciliation; tracker
-- P2-S11-AC-051, AC-054, AC-055, AC-057).  Both reads that derive `permittedNextActions` from
-- platform_private.cms_review_next_actions -- CMS-03B-16 (cms_get_editorial_review) and CMS-03B-15
-- (cms_get_entry_workflow) -- must offer such a caller `schedule` (so the author may schedule a NON-publish
-- action) and never `publish`.  Each case sits beside the same caller on a revision someone else authored,
-- which is offered `publish`, so the withheld action is the authorship and nothing else.  The hint grants no
-- authority (every command re-proves its own); this suite pins what the UI is told.
--
--   ah-ap   approved review, revision authored by the publisher       ah-na   approved, authored by another human
--   ah-as   approved + pending publish schedule (`scheduled`), author = publisher    ah-ns   the same, other author

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(19);

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
\ir phase_02_slice_11_rpc_review/030-submit.sqlinc
\ir phase_02_slice_11_rpc_reads/000-world.sqlinc

create temp table r11_snap(label text primary key, effects text not null) on commit drop;

-- One entry of tag p_tag authored by p_author with an APPROVED review (submitted by the editor, approved by
-- the assigned reviewer rvA); p_scheduled adds a pending publish schedule, which makes the revision `scheduled`.
create or replace function pg_temp.ah_world(p_tag text, p_author text, p_scheduled boolean)
returns void
language plpgsql
as $body$
declare
  review_key text := 'rv-' || p_tag;
begin
  perform pg_temp.r11_entry(p_tag, p_author);
  perform pg_temp.r11r_review(review_key, p_tag, 'editor');
  perform pg_temp.r11_assign_now(review_key || '-rvA', review_key, 'rvA');
  perform pg_temp.r11_decide_now(review_key || '-dec', review_key, 'rvA', review_key || '-rvA', 'approve');
  if p_scheduled then
    perform pg_temp.h11r_raw_insert('platform_private.cms_publication_schedules', pg_temp.s11_schedule_row(jsonb_build_object(
      'entry_id', pg_temp.h11w_uuid(p_tag || ':entry'), 'revision_id', pg_temp.h11w_uuid(p_tag || ':revision'),
      'review_id', pg_temp.s11_id(review_key),
      'dependency_hash', (select dependency_hash from platform_private.cms_editorial_reviews where id = pg_temp.s11_id(review_key)),
      'audience', 'public', 'state', 'pending', 'version', 1)));
  end if;
end;
$body$;

select pg_temp.ah_world('ah-ap', 'pub', false);
select pg_temp.ah_world('ah-na', 'creator', false);
select pg_temp.ah_world('ah-as', 'pub', true);
select pg_temp.ah_world('ah-ns', 'creator', true);

-- The CMS-03B-16 request of the review of tag p_tag and the CMS-03B-15 request of its entry.
create or replace function pg_temp.ah_review_rq(p_tag text)
returns jsonb language sql as $body$
  select jsonb_build_object('reviewId', pg_temp.s11_id('rv-' || p_tag), 'context', pg_temp.r11_ctx())
$body$;
create or replace function pg_temp.ah_workflow_rq(p_tag text)
returns jsonb language sql as $body$
  select jsonb_build_object('entryId', pg_temp.h11w_uuid(p_tag || ':entry'), 'context', pg_temp.r11_ctx())
$body$;

-- The members of a permittedNextActions list that are the publishing actions, sorted (the one thing both reads share).
create or replace function pg_temp.ah_publishing(p_actions jsonb)
returns text language sql immutable as $body$
  select coalesce(string_agg(action, ',' order by action), '-')
    from jsonb_array_elements_text(p_actions) action where action in ('schedule', 'publish')
$body$;

-- ---------------------------------------------------------------------------
-- The world: the publisher authored two of the revisions; the effective states are the ones the hints depend on.
-- ---------------------------------------------------------------------------
select ok(
  platform_private.cms_person_holds_capability(pg_temp.s11_id('org'), pg_temp.s11_id('pub'), 'cms.publisher')
    and (select string_agg(tag || '=' || (author_person_id = pg_temp.s11_id('pub'))::text || '/'
                           || platform_private.cms_revision_effective_state(revision.id), ' ' order by tag)
           from (values ('ah-ap'), ('ah-as'), ('ah-na'), ('ah-ns')) as t(tag)
           join platform_private.cms_entry_revisions revision on revision.id = pg_temp.h11w_uuid(t.tag || ':revision'))
       = 'ah-ap=true/approved ah-as=true/scheduled ah-na=false/approved ah-ns=false/scheduled',
  'fixture: the publisher holds cms.publisher and authored the revisions of ah-ap and ah-as; the others have another author; the effective states are approved and scheduled [P2-S11-AC-057]');
insert into r11_snap(label, effects) values ('before', pg_temp.r11r_effects());

-- ---------------------------------------------------------------------------
-- CMS-03B-16: the review read.
-- ---------------------------------------------------------------------------
select pg_temp.r11r_call('rv-ap', 'cms_get_editorial_review', 'pub', pg_temp.ah_review_rq('ah-ap'));
select pg_temp.r11r_call('rv-na', 'cms_get_editorial_review', 'pub', pg_temp.ah_review_rq('ah-na'));
select pg_temp.r11r_call('rv-as', 'cms_get_editorial_review', 'pub', pg_temp.ah_review_rq('ah-as'));
select pg_temp.r11r_call('rv-ns', 'cms_get_editorial_review', 'pub', pg_temp.ah_review_rq('ah-ns'));
select ok(
  pg_temp.r11_out('rv-ap') = '00000:' and pg_temp.r11_resp('rv-ap')->>'state' = 'approved'
    and pg_temp.r11_resp('rv-ap')->'permittedNextActions' = '["schedule"]'::jsonb,
  'CMS-03B-16: the author who also holds cms.publisher reads the approved review and is offered schedule but NOT publish [P2-S11-AC-057]');
select ok(
  pg_temp.r11_out('rv-na') = '00000:' and pg_temp.r11_resp('rv-na')->>'state' = 'approved'
    and pg_temp.r11_resp('rv-na')->'permittedNextActions' = '["schedule", "publish"]'::jsonb,
  'CMS-03B-16 control: the same publisher on a revision someone else authored is offered schedule and publish, so the withheld action is the authorship [P2-S11-AC-057]');
select ok(
  pg_temp.r11_out('rv-as') = '00000:' and pg_temp.r11_resp('rv-as')->'permittedNextActions' = '[]'::jsonb
    and pg_temp.r11_out('rv-ns') = '00000:' and pg_temp.r11_resp('rv-ns')->'permittedNextActions' = '["publish"]'::jsonb,
  'CMS-03B-16: once a publish schedule is pending (revision scheduled) the author-publisher is offered nothing, the other publisher still publish [P2-S11-AC-057]');

-- ---------------------------------------------------------------------------
-- CMS-03B-15: the workflow read.
-- ---------------------------------------------------------------------------
select pg_temp.r11r_call('wf-ap', 'cms_get_entry_workflow', 'pub', pg_temp.ah_workflow_rq('ah-ap'));
select pg_temp.r11r_call('wf-na', 'cms_get_entry_workflow', 'pub', pg_temp.ah_workflow_rq('ah-na'));
select pg_temp.r11r_call('wf-as', 'cms_get_entry_workflow', 'pub', pg_temp.ah_workflow_rq('ah-as'));
select pg_temp.r11r_call('wf-ns', 'cms_get_entry_workflow', 'pub', pg_temp.ah_workflow_rq('ah-ns'));
select ok(
  pg_temp.r11_out('wf-ap') = '00000:' and pg_temp.r11_resp('wf-ap')#>>'{revision,state}' = 'approved'
    and pg_temp.r11_resp('wf-ap')->'permittedNextActions' = '["schedule", "preview"]'::jsonb,
  'CMS-03B-15: the author who also holds cms.publisher is offered schedule and preview of the approved revision but NOT publish [P2-S11-AC-054]');
select ok(
  pg_temp.r11_out('wf-na') = '00000:' and pg_temp.r11_resp('wf-na')#>>'{revision,state}' = 'approved'
    and pg_temp.r11_resp('wf-na')->'permittedNextActions' = '["schedule", "preview", "publish"]'::jsonb,
  'CMS-03B-15 control: the same publisher on a revision someone else authored is offered schedule, preview and publish [P2-S11-AC-054]');
select ok(
  pg_temp.r11_out('wf-as') = '00000:' and pg_temp.r11_resp('wf-as')#>>'{revision,state}' = 'scheduled'
    and jsonb_array_length(pg_temp.r11_resp('wf-as')->'schedules') = 1
    and pg_temp.r11_resp('wf-as')->'permittedNextActions' = '["preview"]'::jsonb,
  'CMS-03B-15: with a pending publish schedule (revision scheduled) the author-publisher is offered preview only [P2-S11-AC-054]');
select ok(
  pg_temp.r11_out('wf-ns') = '00000:' and pg_temp.r11_resp('wf-ns')#>>'{revision,state}' = 'scheduled'
    and pg_temp.r11_resp('wf-ns')->'permittedNextActions' = '["preview", "publish"]'::jsonb,
  'CMS-03B-15 control: with a pending publish schedule the other publisher is offered preview and publish [P2-S11-AC-054]');

-- ---------------------------------------------------------------------------
-- The two reads tell the UI the same thing, and a read writes nothing.
-- ---------------------------------------------------------------------------
select is(
  (select string_agg(tag || ':' || pg_temp.ah_publishing(pg_temp.r11_resp('rv-' || suffix)->'permittedNextActions')
                         || '=' || pg_temp.ah_publishing(pg_temp.r11_resp('wf-' || suffix)->'permittedNextActions'), ' ' order by tag)
     from (values ('ah-ap', 'ap'), ('ah-as', 'as'), ('ah-na', 'na'), ('ah-ns', 'ns')) as t(tag, suffix)),
  'ah-ap:schedule=schedule ah-as:-=- ah-na:publish,schedule=publish,schedule ah-ns:publish=publish',
  'the review read and the workflow read offer the same publishing actions (schedule, publish) to the same caller on each of the four revisions [P2-S11-AC-051]');
select ok(
  not pg_temp.r11_leaks(jsonb_build_array(pg_temp.r11_resp('rv-ap'), pg_temp.r11_resp('wf-ap')), array[
    pg_temp.s11_id('pub')::text, pg_temp.s11_id('rvA')::text, pg_temp.s11_id('editor')::text, pg_temp.s11_id('creator')::text,
    (select auth_user_id::text from r11_actor where key = 'pub')])
    and pg_temp.r11r_effects() = (select effects from r11_snap where label = 'before'),
  'the author-publisher reads leak no person or account identifier and write nothing: reviews, assignments, decisions, reservations, audit, events, tokens, schedules and publications are unchanged [P2-S11-AC-051]');

select * from finish();
rollback;
