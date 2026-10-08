-- Slice 10 QA-RED/GREEN: draft-detail representation integrity (finding 10).
--
-- The authorized draft read omits stored values whose owning field-definition
-- version is retired/deprecated/inactive on the read's resolved schema
-- version, never projects them with stale schema typing, and recomputes the
-- returned contentHash over the returned projection so the envelope stays
-- internally consistent.  A stored value with no declaring definition row at
-- all stays a corrupt-storage INTERNAL_ERROR.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_10_rpc/003-detail.sqlinc

-- The canonical history cursor key is the repository's only Vault signing
-- secret; creating it here keeps every cursor suite self-contained.
select vault.create_secret(
  repeat('a1', 32),
  'cms_editorial_history_cursor_active',
  'pgTAP transaction-only CMS-03B-03/13 test key'
);

select pg_temp.s10_rpc_as(
  'a9100000-0000-4000-8000-000000000001'::uuid,
  (select value::uuid from s10_ids where key = 'organization')
);

-- Build corrupt-storage fixtures by bypassing the definition-row trigger
-- guards with the replica role (row triggers skipped), the same convention
-- the locale fan-out regression uses.  The guards stay in force for every
-- real caller; only the test fixture writes the divergent graph.
select set_config('app.cms_rpc', 'true', true);

-- 1. A stored value whose owning field-definition version is retired is
-- omitted from the draft detail; the read itself stays a success.
select pg_temp.s10_rpc_probe(
  'detail-retired-definition',
  $sql$set local session_replication_role = replica;
   update platform_private.cms_field_definition_versions
   set state = 'retired', updated_at = clock_timestamp()
   where id = (
     select field_definition_id
     from platform_private.cms_entry_field_values
     where revision_id = 'a9100000-0000-4000-8000-000000000302'
       and locale = 'en-US'
   );
   set local session_replication_role = origin;$sql$,
  'select platform_api.cms_get_entry_draft('
    || quote_literal((select request::text from s10_detail_request))
    || '::jsonb)'
);

select is(
  pg_temp.s10_probe_state('detail-retired-definition'), '00000',
  'CMS-03B-11 succeeds when a stored value definition is retired'
);
select is(
  (select jsonb_array_length(response->'fields')
   from (select pg_temp.s10_probe_response('detail-retired-definition')
           as response) as probe_response),
  0,
  'CMS-03B-11 omits a value whose definition version is retired'
);
select is(
  (select response->>'contentHash'
   from (select pg_temp.s10_probe_response('detail-retired-definition')
           as response) as probe_response),
  platform_private.cms_jcs_sha256('{}'::jsonb),
  'CMS-03B-11 contentHash is recomputed over the returned projection'
);

-- 2. A stored value with NO declaring definition row at all is corrupt
-- storage: the read refuses, never projects an untyped value.  The fixture
-- stamps created_at and updated_at from ONE literal: the immutable snapshot
-- check (updated_at = created_at) rejects two independent clock_timestamp()
-- calls before the read is ever reached, which would leave the producer-
-- integrity probe unexercised.
select pg_temp.s10_rpc_probe(
  'detail-undeclared-value',
  $sql$set local session_replication_role = replica;
   delete from platform_private.cms_entry_field_values
   where revision_id = 'a9100000-0000-4000-8000-000000000302'
     and locale = 'en-US';
   insert into platform_private.cms_entry_field_values(
     owner_id, state, version, revision_id, field_id, field_definition_id,
     locale, value, provenance, value_hash, created_at, updated_at
   )
   select ids_org.value::uuid, 'active', 1,
     'a9100000-0000-4000-8000-000000000302',
     ids_field.value::uuid, 'a9100000-0000-4000-8000-000000000999'::uuid,
     'en-US', to_jsonb('Orphan value'::text), 'authored',
     platform_private.cms_jcs_sha256(to_jsonb('Orphan value'::text))::char(64),
     timestamptz '2026-09-26T12:00:00Z', timestamptz '2026-09-26T12:00:00Z'
   from s10_ids ids_org, s10_ids ids_field
   where ids_org.key = 'organization'
     and ids_field.key = 'typeFieldId';
   update platform_private.cms_entry_revisions
   set payload_hash = platform_private.cms_jcs_sha256(jsonb_build_object(
     (select value from s10_ids where key = 'typeFieldId'), 'Orphan value'
   ))::char(64)
   where id = 'a9100000-0000-4000-8000-000000000302';
   set local session_replication_role = origin;$sql$,
  'select platform_api.cms_get_entry_draft('
    || quote_literal((select request::text from s10_detail_request))
    || '::jsonb)'
);
select is(
  pg_temp.s10_probe_state('detail-undeclared-value'), 'P0001',
  'CMS-03B-11 refuses a stored value with no declaring definition row'
);
select is(
  pg_temp.s10_probe_message('detail-undeclared-value'),
  'INTERNAL_ERROR',
  'CMS-03B-11 non-active stored value is the scrubbed internal token'
);

-- 3. The healthy read carries exactly the locked twelve-key envelope.
create temp table s10_detail_lineage on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_get_entry_draft('
    || quote_literal((select request::text from s10_detail_request))
    || '::jsonb)'
) as response;
select is(
  pg_temp.s10_last_error_state(), '00000',
  'CMS-03B-11 authorized draft read succeeds'
);
select ok(
  (select response is not null
      and platform_private.cms_exact_keys(
            response,
            array[
              'entry', 'revision', 'lifecycle', 'state', 'locale',
              'revisionNumber', 'schemaVersionId', 'contentHash',
              'validationState', 'openConflict', 'fields', 'relations'
            ]::text[],
            array[
              'entry', 'revision', 'lifecycle', 'state', 'locale',
              'revisionNumber', 'schemaVersionId', 'contentHash',
              'validationState', 'openConflict', 'fields', 'relations'
            ]::text[]
          )
   from s10_detail_lineage),
  'CMS-03B-11 exposes exactly the locked twelve-key identity envelope'
);

-- 4. Explicit JSON null for the non-nullable optional locale is refused, not
-- silently defaulted to the draft locale.
select ok(
  pg_temp.s10_rpc_call(
    $sql$select platform_api.cms_get_entry_draft(
      (select request::text from s10_detail_request)::jsonb
        || '{"locale":null}'::jsonb
    )$sql$
  ),
  'CMS-03B-11 refuses an explicit JSON null locale'
);
select is(
  pg_temp.s10_last_error_message(), 'VALIDATION_FAILED',
  'CMS-03B-11 explicit null locale is a typed validation refusal'
);

-- 5. Representation integrity: the returned contentHash is the JCS hash over
-- the returned field projection (stable field id keyed value map).
select is(
  (select response->>'contentHash' from s10_detail_lineage),
  platform_private.cms_jcs_sha256(
    jsonb_build_object(
      (select value from s10_ids where key = 'typeFieldId'),
      'Seeded draft title'
    )
  ),
  'CMS-03B-11 contentHash is recomputed over the returned fields'
);

-- 6. Field items carry exactly the six contract members; no owner, assignee,
-- or private authority identifier ever appears.
select ok(
  (
    select coalesce(bool_and(
      platform_private.cms_exact_keys(
        field_item,
        array[
          'fieldId', 'fieldDefinitionId', 'locale', 'value', 'provenance',
          'valueHash'
        ]::text[],
        array[
          'fieldId', 'fieldDefinitionId', 'locale', 'value', 'provenance',
          'valueHash'
        ]::text[]
      )
    ), true)
    from s10_detail_lineage
      cross join lateral jsonb_array_elements(response->'fields') as field_item
  ),
  'CMS-03B-11 field items carry the exact six contract members'
);

-- 7. Server-derived identity (AC067/AC075): revisionNumber and schemaVersionId
-- are the stored draft's, never caller-supplied, and openConflict is an
-- explicit JSON null while no conflict is open.
select is(
  (select response->>'revisionNumber' from s10_detail_lineage),
  (select revision_number::text from platform_private.cms_entry_revisions
   where id = 'a9100000-0000-4000-8000-000000000302'),
  'CMS-03B-11 revisionNumber is the stored current draft revision number'
);
select is(
  (select response->>'schemaVersionId' from s10_detail_lineage),
  (select value from s10_ids where key = 'draftVersionId'),
  'CMS-03B-11 schemaVersionId is the verified active schema the draft pins'
);
select is(
  (select response->'openConflict' from s10_detail_lineage), 'null'::jsonb,
  'CMS-03B-11 openConflict is an explicit null while no conflict is open'
);

-- A durable open conflict surfaces exactly its bounded identity.
savepoint s10_lineage_open_conflict;
select set_config('app.cms_rpc', 'true', true);
insert into platform_private.cms_conflict_records(
  id, owner_id, entry_id, base_revision_id, theirs_revision_id,
  yours_revision_id, yours_source, changed_paths,
  base_hash, theirs_hash, yours_hash, conflict_hash, state, version
)
select 'a9100000-0000-4000-8000-000000000451', ids_org.value::uuid,
  'a9100000-0000-4000-8000-000000000301',
  'a9100000-0000-4000-8000-000000000302',
  'a9100000-0000-4000-8000-000000000302',
  'a9100000-0000-4000-8000-000000000302',
  'revision',
  jsonb_build_array('/fields/' || (select value from s10_ids where key = 'typeFieldId')),
  repeat('a', 64), repeat('b', 64), repeat('c', 64), repeat('e', 64), 'open', 1
from s10_ids ids_org where ids_org.key = 'organization';
select pg_temp.s10_rpc_probe_persist(
  'lineage-open-conflict', null,
  'select platform_api.cms_get_entry_draft('
    || quote_literal((select request::text from s10_detail_request))
    || '::jsonb)'
);
select is(
  (select pg_temp.s10_probe_response('lineage-open-conflict')->'openConflict'),
  jsonb_build_object(
    'conflictId', 'a9100000-0000-4000-8000-000000000451',
    'version', '1', 'conflictHash', repeat('e', 64)
  ),
  'CMS-03B-11 openConflict is exactly the bounded durable conflict identity'
);
rollback to savepoint s10_lineage_open_conflict;
release savepoint s10_lineage_open_conflict;

-- 8. Partial retirement.  The draft stores a title (active) and an event date
-- whose definition is retired.  The read omits the retired value, verifies the
-- frozen full-revision hash over EVERY stored value, and returns the hash of
-- the projection it actually returns.
create or replace function pg_temp.s10_lineage_mixed_revision(
  p_revision_id uuid, p_revision_number integer, p_forge_hash boolean default false
)
returns void
language plpgsql
as $body$
declare
  stamp timestamptz := timestamptz '2026-09-26T12:00:00Z';
begin
  perform set_config('app.cms_rpc', 'true', true);
  insert into platform_private.cms_entry_revisions(
    id, owner_id, entry_id, revision_number, schema_version_id,
    template_version_id, taxonomy_version_ids, parent_revision_ids, locale,
    payload_hash, author_person_id, acting_party_id, state, version,
    validation_state, validation_report, created_at, updated_at)
  select p_revision_id, ids_org.value::uuid,
    'a9100000-0000-4000-8000-000000000301', p_revision_number,
    ids_version.value::uuid, null, '[]'::jsonb, '[]'::jsonb, 'en-US',
    (case when p_forge_hash then repeat('f', 64)
      else platform_private.cms_jcs_sha256(jsonb_build_object(
        ids_title.value, 'Mixed title', ids_date.value, '2026-10-06'))
      end)::char(64),
    ids_person.value::uuid, ids_org.value::uuid, 'draft', 1, 'valid',
    '{}'::jsonb, stamp, stamp
  from s10_ids ids_org, s10_ids ids_version, s10_ids ids_person,
       s10_ids ids_title, s10_ids ids_date
  where ids_org.key = 'organization' and ids_version.key = 'draftVersionId'
    and ids_person.key = 'creatorPerson' and ids_title.key = 'typeFieldId'
    and ids_date.key = 'typeDateFieldId';
  insert into platform_private.cms_entry_field_values(
    owner_id, state, version, revision_id, field_id, field_definition_id,
    locale, value, provenance, value_hash, created_at, updated_at)
  select ids_org.value::uuid, 'active', 1, p_revision_id, stored.field_id::uuid,
    stored.field_id::uuid, 'en-US', to_jsonb(stored.text_value), 'authored',
    platform_private.cms_jcs_sha256(to_jsonb(stored.text_value))::char(64),
    stamp, stamp
  from s10_ids ids_org
  cross join lateral (
    select ids_title.value as field_id, 'Mixed title'::text as text_value
    from s10_ids ids_title where ids_title.key = 'typeFieldId'
    union all
    select ids_date.value, '2026-10-06'::text
    from s10_ids ids_date where ids_date.key = 'typeDateFieldId'
  ) stored
  where ids_org.key = 'organization';
  update platform_private.cms_content_entries
     set current_draft_revision_id = p_revision_id
   where id = 'a9100000-0000-4000-8000-000000000301';
end;
$body$;

select pg_temp.s10_rpc_probe(
  'lineage-partial-retirement',
  $sql$select pg_temp.s10_lineage_mixed_revision(
     'a9100000-0000-4000-8000-000000000501', 2);
   set local session_replication_role = replica;
   update platform_private.cms_field_definition_versions
   set state = 'retired', updated_at = clock_timestamp()
   where id = (select value::uuid from s10_ids where key = 'typeDateFieldId');
   set local session_replication_role = origin;$sql$,
  'select platform_api.cms_get_entry_draft('
    || quote_literal((select request::text from s10_detail_request))
    || '::jsonb)'
);
select is(
  pg_temp.s10_probe_state('lineage-partial-retirement'), '00000',
  'CMS-03B-11 partially retired draft reads successfully'
);
select is(
  (select jsonb_agg(item->>'fieldId')
   from jsonb_array_elements(
     pg_temp.s10_probe_response('lineage-partial-retirement')->'fields') item),
  jsonb_build_array((select value from s10_ids where key = 'typeFieldId')),
  'CMS-03B-11 partially retired draft returns only the active value'
);
select is(
  pg_temp.s10_probe_response('lineage-partial-retirement')->>'contentHash',
  platform_private.cms_jcs_sha256(jsonb_build_object(
    (select value from s10_ids where key = 'typeFieldId'), 'Mixed title')),
  'CMS-03B-11 partially retired draft returns the hash of the returned projection'
);

-- The frozen revision hash is still verified over every STORED value while a
-- definition is retired: a forged hash is producer corruption, not omission.
select pg_temp.s10_rpc_probe(
  'lineage-retired-hash-forged',
  $sql$select pg_temp.s10_lineage_mixed_revision(
     'a9100000-0000-4000-8000-000000000502', 3, true);
   set local session_replication_role = replica;
   update platform_private.cms_field_definition_versions
   set state = 'retired', updated_at = clock_timestamp()
   where id = (select value::uuid from s10_ids where key = 'typeDateFieldId');
   set local session_replication_role = origin;$sql$,
  'select platform_api.cms_get_entry_draft('
    || quote_literal((select request::text from s10_detail_request))
    || '::jsonb)'
);
select is(
  pg_temp.s10_probe_message('lineage-retired-hash-forged'), 'INTERNAL_ERROR',
  'CMS-03B-11 forged frozen hash is refused even while a definition is retired'
);

-- 9. A value whose stable field id its bound definition does not declare is
-- undeclared storage, distinct from an intentionally retired definition.
select pg_temp.s10_rpc_probe(
  'lineage-pairing-mismatch',
  $sql$set local session_replication_role = replica;
   update platform_private.cms_entry_field_values
   set field_id = 'a9100000-0000-4000-8000-000000000104'
   where revision_id = 'a9100000-0000-4000-8000-000000000302'
     and locale = 'en-US';
   update platform_private.cms_entry_revisions
   set payload_hash = platform_private.cms_jcs_sha256(jsonb_build_object(
     'a9100000-0000-4000-8000-000000000104', 'Seeded draft title'))::char(64)
   where id = 'a9100000-0000-4000-8000-000000000302';
   set local session_replication_role = origin;$sql$,
  'select platform_api.cms_get_entry_draft('
    || quote_literal((select request::text from s10_detail_request))
    || '::jsonb)'
);
select is(
  pg_temp.s10_probe_message('lineage-pairing-mismatch'), 'INTERNAL_ERROR',
  'CMS-03B-11 refuses a value whose stable id its bound definition does not declare'
);

select finish();
rollback;
