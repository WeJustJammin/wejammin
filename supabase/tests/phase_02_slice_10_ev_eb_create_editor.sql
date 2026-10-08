-- Slice 10 evidence lane EB (AC-063, AC-061): a creator who holds ONLY the cms.editor grant (the create route policy is
-- any_of cms.author / cms.editor) is assigned the capability they proved, so they can append to and read the draft of
-- the entry they just created.  (EVIDENCE GAP EB-AC063, fixed by migration 20261005013300; these assertions were
-- TODO-wrapped probes until then.)  The author-only creator keeps cms.author.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_10_rpc/009-restore-policy-binding.sqlinc
\ir phase_02_slice_10_ev_eb/000-helpers.sqlinc

select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'editorAuth'),
  (select value::uuid from s10_ids where key = 'organization'));
select pg_temp.s10_rpc_probe_persist('eb-editor-creator-create', null, pg_temp.eb_create_sql('eb-editor-creator-create-0001'));
select is(
  pg_temp.s10_probe_state('eb-editor-creator-create'), '00000',
  'EB editor creator fixture: the editor-only actor creates the entry the follow-up probes use'
);

select is(
  (select assignment_row.capability_key from platform_private.cms_entry_assignments assignment_row
    where assignment_row.entry_id = (pg_temp.s10_probe_response('eb-editor-creator-create')->'entry'->>'id')::uuid
      and assignment_row.assignee_person_id = (select value::uuid from s10_ids where key = 'editorPerson')),
  'cms.editor',
  'EB editor creator: the initial assignment of an editor-only creator carries the capability the creator exercised (cms.editor)'
);
select pg_temp.s10_rpc_probe_persist(
  'eb-editor-creator-append', null,
  pg_temp.eb_append_sql(
    'eb-editor-creator-append-0001', '{}'::jsonb,
    pg_temp.s10_probe_response('eb-editor-creator-create')->'entry'->>'id'));
select is(
  pg_temp.s10_probe_state('eb-editor-creator-append'), '00000',
  'EB editor creator: an editor-only creator can append a revision to the entry they just created'
);
select pg_temp.s10_rpc_probe_persist(
  'eb-editor-creator-read', null,
  format('select platform_api.cms_get_entry_draft(%L::jsonb)', jsonb_build_object(
    'entryId', pg_temp.s10_probe_response('eb-editor-creator-create')->'entry'->>'id',
    'context', pg_temp.eb_context())::text));
select is(
  pg_temp.s10_probe_state('eb-editor-creator-read'), '00000',
  'EB editor creator: an editor-only creator can read the draft of the entry they just created'
);

select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'creatorAuth'),
  (select value::uuid from s10_ids where key = 'organization'));
select pg_temp.s10_rpc_probe_persist('eb-author-creator', null, pg_temp.eb_create_sql('eb-author-creator-0001'));
select is(
  (select assignment_row.capability_key from platform_private.cms_entry_assignments assignment_row
    where assignment_row.entry_id = (pg_temp.s10_probe_response('eb-author-creator')->'entry'->>'id')::uuid
      and assignment_row.assignee_person_id = (select value::uuid from s10_ids where key = 'creatorPerson')),
  'cms.author',
  'EB editor creator control: the initial assignment of an author creator carries cms.author'
);

select * from finish();
rollback;
