-- Slice 10 evidence lane EB: CMS-03B-10 create and CMS-03B-01/03 write-side facts that no other suite asserts.
--
--   * Attribution (AC-050 "attributable", AC-061 "attributable first draft revision"): the first revision
--     row and the audit event carry the session actor, never a caller value.
--   * Atomicity under a fault AFTER the inserts (AC-061, AC-065, AC-066): a probe trigger raises while the
--     create is emitting its outbox row; the entry, revision, values and assignment inserted before it must
--     not survive.
--   * Active compiled schema (AC-063): a version that is not active, an absent version and a mismatched
--     type/version pair are refused and nothing is written.
--   * Oversized values (AC-062): a values tree past the 128-key, 8-level or 256 KiB bound is a typed
--     VALIDATION_FAILED at /values and nothing is written.
--   * Explicit readable base (AC-050): an append against a base revision that does not exist is refused.
--   * Compare readability (AC-036): a compare target that is absent or belongs to another entry is a
--     concealed NOT_FOUND and nothing is written.
--
-- Every probe runs through the named worker-facing RPC (platform_api.*), exactly as the Worker calls it, in a
-- rolled-back subtransaction; a refusal is checked against a fingerprint of every table a command could touch.

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

-- ---------------------------------------------------------------------------------------
-- A. Attribution of the first draft revision and its audit event.
-- ---------------------------------------------------------------------------------------
select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'creatorAuth'),
  (select value::uuid from s10_ids where key = 'organization'));

select pg_temp.s10_rpc_probe_persist('eb-create-attribution', null, pg_temp.eb_create_sql('eb-create-attribution-0001'));
select is(
  pg_temp.s10_probe_state('eb-create-attribution'), '00000',
  'EB create control: the authorized creator creates an entry with the fixture policy evidence'
);
select is(
  (select revision_row.author_person_id::text from platform_private.cms_entry_revisions revision_row
    where revision_row.id = (pg_temp.s10_probe_response('eb-create-attribution')->'revision'->>'id')::uuid),
  (select value from s10_ids where key = 'creatorPerson'),
  'EB create attribution: the first revision author is the canonical person of the session actor'
);
select is(
  (select revision_row.acting_party_id::text from platform_private.cms_entry_revisions revision_row
    where revision_row.id = (pg_temp.s10_probe_response('eb-create-attribution')->'revision'->>'id')::uuid),
  (select value from s10_ids where key = 'organization'),
  'EB create attribution: the first revision acting party is the acting organization of the session'
);
select is(
  (select event_row.actor_id::text || '/' || event_row.acting_party_id::text
     from audit_private.audit_events event_row
    where event_row.action = 'cms.entry.revision.create'
      and event_row.target_id = (pg_temp.s10_probe_response('eb-create-attribution')->'entry'->>'id')::uuid),
  (select (select value from s10_ids where key = 'creatorAuth') || '/' || (select value from s10_ids where key = 'organization')),
  'EB create attribution: the audit event names the session actor and the acting party'
);
select is(
  (select assignment_row.assignee_person_id::text from platform_private.cms_entry_assignments assignment_row
    where assignment_row.entry_id = (pg_temp.s10_probe_response('eb-create-attribution')->'entry'->>'id')::uuid),
  (select value from s10_ids where key = 'creatorPerson'),
  'EB create attribution: the initial assignee is the canonical person of the session actor'
);

-- ---------------------------------------------------------------------------------------
-- B. Atomicity under a fault raised after the entry, revision, value and assignment inserts.
-- ---------------------------------------------------------------------------------------
create or replace function pg_temp.eb_fault_after_inserts()
returns trigger
language plpgsql
as $body$
begin
  raise exception 'EB_INJECTED_FAULT' using errcode = 'P0001',
    detail = format('entries=%s revisions=%s values=%s assignments=%s',
      (select count(*) from platform_private.cms_content_entries),
      (select count(*) from platform_private.cms_entry_revisions),
      (select count(*) from platform_private.cms_entry_field_values),
      (select count(*) from platform_private.cms_entry_assignments));
end;
$body$;

create temp table eb_baseline on commit drop as
select (select count(*) from platform_private.cms_content_entries) as entries,
       (select count(*) from platform_private.cms_entry_revisions) as revisions,
       (select count(*) from platform_private.cms_entry_field_values) as field_values,
       (select count(*) from platform_private.cms_entry_assignments) as assignments;

-- The create inserts one entry, one revision, one value and one assignment before it emits its event, so the
-- fault detail must show baseline+1 of each: the rows existed when the fault hit.
select pg_temp.eb_probe(
  'eb-fault-outbox',
  'create trigger eb_fault_outbox before insert on platform_private.outbox_events '
    || 'for each row execute function pg_temp.eb_fault_after_inserts()',
  pg_temp.eb_create_sql('eb-create-fault-outbox-0001'));
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('eb-fault-outbox')),
  'P0001|EB_INJECTED_FAULT|' || (select format('entries=%s revisions=%s values=%s assignments=%s',
      entries + 1, revisions + 1, field_values + 1, assignments + 1) from eb_baseline) || '|-',
  'EB create atomicity: a fault raised while the outbox row is written finds the entry, revision, value and assignment already inserted'
);
select is(
  pg_temp.eb_obs('eb-fault-outbox')->>'after', pg_temp.eb_obs('eb-fault-outbox')->>'before',
  'EB create atomicity: after the outbox fault no entry, revision, value, relation, assignment, reservation, audit or outbox row survives'
);

select pg_temp.eb_probe(
  'eb-fault-audit',
  'create trigger eb_fault_audit before insert on audit_private.audit_events '
    || 'for each row execute function pg_temp.eb_fault_after_inserts()',
  pg_temp.eb_create_sql('eb-create-fault-audit-0001'));
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('eb-fault-audit')),
  'P0001|EB_INJECTED_FAULT|' || (select format('entries=%s revisions=%s values=%s assignments=%s',
      entries + 1, revisions + 1, field_values + 1, assignments + 1) from eb_baseline) || '|-',
  'EB create atomicity: a fault raised while the audit row is written finds the entry, revision, value and assignment already inserted'
);
select is(
  pg_temp.eb_obs('eb-fault-audit')->>'after', pg_temp.eb_obs('eb-fault-audit')->>'before',
  'EB create atomicity: after the audit fault no entry, revision, value, relation, assignment, reservation, audit or outbox row survives'
);
select is(
  (select format('entries=%s revisions=%s values=%s assignments=%s',
     (select count(*) from platform_private.cms_content_entries),
     (select count(*) from platform_private.cms_entry_revisions),
     (select count(*) from platform_private.cms_entry_field_values),
     (select count(*) from platform_private.cms_entry_assignments))),
  (select format('entries=%s revisions=%s values=%s assignments=%s', entries, revisions, field_values, assignments)
     from eb_baseline),
  'EB create atomicity: the committed state after both faulted creates equals the state before them'
);
-- One assertion per fault that fails if EITHER the fault does not fire after the four inserts OR the inserts survive it:
-- the shape pins the fault detail (baseline+1 of each table, so the rows existed when it hit) and the last member is the
-- committed-state fingerprint comparison, which is false the moment any inserted row, reservation, audit or outbox row stays.
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('eb-fault-outbox')) || '|'
    || (pg_temp.eb_obs('eb-fault-outbox')->>'after' = pg_temp.eb_obs('eb-fault-outbox')->>'before')::text,
  'P0001|EB_INJECTED_FAULT|' || (select format('entries=%s revisions=%s values=%s assignments=%s',
      entries + 1, revisions + 1, field_values + 1, assignments + 1) from eb_baseline) || '|-|true',
  'EB create atomicity rollback: the outbox fault raised after the four inserts leaves the committed state equal to the state before the create'
);
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('eb-fault-audit')) || '|'
    || (pg_temp.eb_obs('eb-fault-audit')->>'after' = pg_temp.eb_obs('eb-fault-audit')->>'before')::text,
  'P0001|EB_INJECTED_FAULT|' || (select format('entries=%s revisions=%s values=%s assignments=%s',
      entries + 1, revisions + 1, field_values + 1, assignments + 1) from eb_baseline) || '|-|true',
  'EB create atomicity rollback: the audit fault raised after the four inserts leaves the committed state equal to the state before the create'
);
select pg_temp.eb_probe('eb-fault-control', null, pg_temp.eb_create_sql('eb-create-fault-control-0001'));
select is(
  pg_temp.eb_obs('eb-fault-control')->>'state', '00000',
  'EB create atomicity control: the same request without the injected fault commits'
);

-- ---------------------------------------------------------------------------------------
-- C. Active compiled schema: a version that is not active, an absent version, a mismatched pair.
-- ---------------------------------------------------------------------------------------
create or replace function pg_temp.eb_set_version_state(p_state text)
returns void
language plpgsql
as $body$
begin
  perform set_config('app.cms_rpc', 'true', true);
  set local session_replication_role = replica;
  update platform_private.cms_content_type_versions
     set state = p_state::platform_private.cms_definition_state
   where id = (select value::uuid from s10_ids where key = 'draftVersionId');
  set local session_replication_role = origin;
end;
$body$;

select pg_temp.eb_probe('eb-version-draft', $s$select pg_temp.eb_set_version_state('draft')$s$, pg_temp.eb_create_sql('eb-create-version-draft-0001'));
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('eb-version-draft')), 'P0001|VALIDATION_FAILED|["/contentTypeVersionId"]|-',
  'EB create active schema: a draft content type version is refused VALIDATION_FAILED at /contentTypeVersionId'
);
select is(
  pg_temp.eb_obs('eb-version-draft')->>'after', pg_temp.eb_obs('eb-version-draft')->>'before',
  'EB create active schema: the draft-version refusal wrote nothing'
);
select pg_temp.eb_probe('eb-version-approved', $s$select pg_temp.eb_set_version_state('approved')$s$, pg_temp.eb_create_sql('eb-create-version-approved-0001'));
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('eb-version-approved')), 'P0001|VALIDATION_FAILED|["/contentTypeVersionId"]|-',
  'EB create active schema: an approved but not yet active content type version is refused at /contentTypeVersionId'
);
select pg_temp.eb_probe('eb-version-superseded', $s$select pg_temp.eb_set_version_state('superseded')$s$, pg_temp.eb_create_sql('eb-create-version-superseded-0001'));
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('eb-version-superseded')), 'P0001|VALIDATION_FAILED|["/contentTypeVersionId"]|-',
  'EB create active schema: a superseded content type version is refused at /contentTypeVersionId'
);
select pg_temp.eb_probe('eb-version-retired', $s$select pg_temp.eb_set_version_state('retired')$s$, pg_temp.eb_create_sql('eb-create-version-retired-0001'));
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('eb-version-retired')), 'P0001|VALIDATION_FAILED|["/contentTypeVersionId"]|-',
  'EB create active schema: a retired content type version is refused at /contentTypeVersionId'
);
select pg_temp.eb_probe('eb-version-active', null, pg_temp.eb_create_sql('eb-create-version-active-0001'));
select is(
  pg_temp.eb_obs('eb-version-active')->>'state', '00000',
  'EB create active schema control: the same request against the active version is accepted'
);
select pg_temp.eb_probe(
  'eb-version-absent', null,
  pg_temp.eb_create_sql('eb-create-version-absent-0001', jsonb_build_object(
    'contentTypeVersionId', 'a9100000-0000-4000-8000-0000000009a1',
    'schemaArtifact', pg_temp.eb_create_request('x')->'schemaArtifact'
      || jsonb_build_object('contentTypeVersionId', 'a9100000-0000-4000-8000-0000000009a1'))));
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('eb-version-absent')), 'P0001|NOT_FOUND|-|-',
  'EB create active schema: an absent content type version is the concealed NOT_FOUND'
);
select is(
  pg_temp.eb_obs('eb-version-absent')->>'after', pg_temp.eb_obs('eb-version-absent')->>'before',
  'EB create active schema: the absent-version refusal wrote nothing'
);
select pg_temp.eb_probe(
  'eb-version-pair', null,
  pg_temp.eb_create_sql('eb-create-version-pair-0001', jsonb_build_object(
    'contentTypeId', 'a9100000-0000-4000-8000-0000000009a2')));
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('eb-version-pair')), 'P0001|NOT_FOUND|-|-',
  'EB create active schema: a content type id that does not own the version is the concealed NOT_FOUND'
);

-- ---------------------------------------------------------------------------------------
-- D. Oversized values: key count, nesting depth and byte size are bounded at /values.
-- ---------------------------------------------------------------------------------------
create or replace function pg_temp.eb_many_keys(p_count integer)
returns jsonb
language sql
stable
as $body$
  select jsonb_object_agg(
    'a9100000-0000-4000-8000-' || lpad(to_hex(n), 12, '0'), 'v')
  from generate_series(1, p_count) as n
$body$;

create or replace function pg_temp.eb_nested(p_levels integer)
returns jsonb
language plpgsql
stable
as $body$
declare
  node jsonb := '"leaf"'::jsonb;
begin
  for level in 1..p_levels loop
    node := jsonb_build_object('n', node);
  end loop;
  return jsonb_build_object((select value from s10_ids where key = 'typeFieldId'), node);
end;
$body$;

select pg_temp.eb_probe(
  'eb-values-129', null,
  pg_temp.eb_create_sql('eb-create-values-129-0001', jsonb_build_object('values', pg_temp.eb_many_keys(129))));
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('eb-values-129')), 'P0001|VALIDATION_FAILED|["/values"]|-',
  'EB create values bound: 129 value keys are refused VALIDATION_FAILED at /values'
);
select is(
  pg_temp.eb_obs('eb-values-129')->>'after', pg_temp.eb_obs('eb-values-129')->>'before',
  'EB create values bound: the 129-key refusal wrote nothing'
);
select pg_temp.eb_probe(
  'eb-values-deep', null,
  pg_temp.eb_create_sql('eb-create-values-deep-0001', jsonb_build_object('values', pg_temp.eb_nested(9))));
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('eb-values-deep')), 'P0001|VALIDATION_FAILED|["/values"]|-',
  'EB create values bound: a values tree nested past 8 levels is refused at /values'
);
select is(
  pg_temp.eb_obs('eb-values-deep')->>'after', pg_temp.eb_obs('eb-values-deep')->>'before',
  'EB create values bound: the nesting refusal wrote nothing'
);
select pg_temp.eb_probe(
  'eb-values-big', null,
  pg_temp.eb_create_sql('eb-create-values-big-0001', jsonb_build_object('values',
    jsonb_build_object((select value from s10_ids where key = 'typeFieldId'), repeat('x', 262145)))));
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('eb-values-big')), 'P0001|VALIDATION_FAILED|["/values"]|-',
  'EB create values bound: a values payload over 262144 bytes is refused at /values'
);
select is(
  pg_temp.eb_obs('eb-values-big')->>'after', pg_temp.eb_obs('eb-values-big')->>'before',
  'EB create values bound: the oversized-payload refusal wrote nothing'
);

-- ---------------------------------------------------------------------------------------
-- E. CMS-03B-01 explicit readable base revision.
-- ---------------------------------------------------------------------------------------
select pg_temp.eb_probe('eb-base-missing', null, pg_temp.eb_append_sql('eb-append-base-missing-0001', jsonb_build_object('baseRevision', '99')));
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('eb-base-missing')), 'P0001|VALIDATION_FAILED|["/baseRevision"]|-',
  'EB append base: a base revision number that names no revision of the entry is the 422 VALIDATION_FAILED at /baseRevision (BE03b matrix; lane H round 3, it was a 404)'
);
select is(
  pg_temp.eb_obs('eb-base-missing')->>'after', pg_temp.eb_obs('eb-base-missing')->>'before',
  'EB append base: the unreadable-base refusal wrote nothing'
);
select pg_temp.eb_probe('eb-base-readable', null, pg_temp.eb_append_sql('eb-append-base-readable-0001'));
select is(
  pg_temp.eb_obs('eb-base-readable')->>'state', '00000',
  'EB append base control: the same append against the readable base revision 1 is accepted'
);

-- ---------------------------------------------------------------------------------------
-- F. CMS-03B-03 compare readability.
-- ---------------------------------------------------------------------------------------
select vault.create_secret(
  repeat('a1', 32), 'cms_editorial_history_cursor_active', 'pgTAP transaction-only CMS-03B-03 test key');

create or replace function pg_temp.eb_history_sql(p_patch jsonb default '{}'::jsonb)
returns text
language sql
stable
as $body$
  select 'select platform_api.cms_list_revisions(' || quote_literal((jsonb_build_object(
    'entryId', (select value from s10_ids where key = 'entryId'),
    'context', pg_temp.eb_context()) || p_patch)::text) || '::jsonb)'
$body$;

select pg_temp.eb_probe('eb-compare-absent', null, pg_temp.eb_history_sql(jsonb_build_object(
  'compareRevisionId', 'a9100000-0000-4000-8000-0000000009b1')));
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('eb-compare-absent')), 'P0001|NOT_FOUND|-|-',
  'EB compare readability: a compareRevisionId that names no revision is the concealed NOT_FOUND'
);
select is(
  pg_temp.eb_obs('eb-compare-absent')->>'after', pg_temp.eb_obs('eb-compare-absent')->>'before',
  'EB compare readability: the absent-compare refusal wrote no audit, outbox or other row'
);
select pg_temp.eb_probe('eb-compare-foreign', null, pg_temp.eb_history_sql(jsonb_build_object(
  'compareRevisionId', pg_temp.s10_probe_response('eb-create-attribution')->'revision'->>'id')));
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('eb-compare-foreign')), 'P0001|NOT_FOUND|-|-',
  'EB compare readability: a revision that belongs to another readable entry is not a comparison target (NOT_FOUND)'
);
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('eb-compare-foreign')), pg_temp.eb_shape(pg_temp.eb_obs('eb-compare-absent')),
  'EB compare readability: the other-entry refusal is indistinguishable from the absent-revision refusal'
);
select pg_temp.eb_probe('eb-compare-self', null, pg_temp.eb_history_sql(jsonb_build_object(
  'compareRevisionId', (select value from s10_ids where key = 'entryRevisionId'))));
select is(
  pg_temp.eb_obs('eb-compare-self')->>'state', '00000',
  'EB compare readability control: a compareRevisionId that is a readable revision of this entry is accepted'
);

-- ---------------------------------------------------------------------------------------
-- G. Capability: the create route policy is any_of cms.author / cms.editor.
-- ---------------------------------------------------------------------------------------
select is(
  (select count(*) from identity_private.organization_actor_grant actor_grant
    where actor_grant.person_id = (select value::uuid from s10_ids where key = 'editorPerson')
      and actor_grant.capability_code = 'cms.author'),
  0::bigint,
  'EB create capability fixture: the editor actor holds no cms.author grant'
);
select pg_temp.eb_probe(
  'eb-editor-create', pg_temp.eb_as_sql('editorAuth'), pg_temp.eb_create_sql('eb-create-editor-only-0001'));
select is(
  pg_temp.eb_obs('eb-editor-create')->>'state', '00000',
  'EB create capability: an actor holding only the cms.editor grant creates an entry'
);
select pg_temp.eb_probe(
  'eb-outsider-create', pg_temp.eb_as_sql('outsiderAuth'), pg_temp.eb_create_sql('eb-create-outsider-0001'));
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('eb-outsider-create')), 'P0001|FORBIDDEN|-|-',
  'EB create capability: a confirmed member holding neither cms.author nor cms.editor is refused FORBIDDEN'
);
select is(
  pg_temp.eb_obs('eb-outsider-create')->>'after', pg_temp.eb_obs('eb-outsider-create')->>'before',
  'EB create capability: the FORBIDDEN create wrote nothing'
);

select * from finish();
rollback;
