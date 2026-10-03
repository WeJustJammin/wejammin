\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc

select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'creatorAuth'),
  (select value::uuid from s10_ids where key = 'organization')
);

create temp table s12_original_variant on commit drop as
select platform_api.cms_author_locale_variant(jsonb_build_object(
  'entryId', (select value from s10_ids where key = 'entryId'),
  'locale', 'fr-FR',
  'sourceRevisionId', (select value from s10_ids where key = 'entryRevisionId'),
  'sourceHash', (
    select btrim(payload_hash::text)
    from platform_private.cms_entry_revisions
    where id = (select value::uuid from s10_ids where key = 'entryRevisionId')
  ),
  'fields', jsonb_build_array(jsonb_build_object(
    'fieldId', (select value from s10_ids where key = 'typeFieldId'),
    'value', 'Titre traduit'
  )),
  'fallbackChain', jsonb_build_array('en-US'),
  'noFallbackFieldIds', '[]'::jsonb,
  'expectedVersion', '1', 'ifMatch', '1',
  'idempotencyKey', 'locale-stale-backfill-0001'
)) as response;

-- Recreate pre-migration history in this rolled-back fixture only: a source
-- revision landed before the staleness trigger existed.
alter table platform_private.cms_entry_revisions
  disable trigger cms_entry_revisions_locale_stale;
insert into platform_private.cms_entry_revisions(
  id, owner_id, entry_id, revision_number, schema_version_id,
  template_version_id, taxonomy_version_ids, parent_revision_ids, locale,
  payload_hash, author_person_id, acting_party_id, state, version,
  validation_state, validation_report, created_at, updated_at
)
select
  'a9400000-0000-4000-8000-000000000002'::uuid, source.owner_id,
  source.entry_id, 2, source.schema_version_id,
  source.template_version_id, source.taxonomy_version_ids,
  jsonb_build_array(source.id), source.locale,
  platform_private.cms_jcs_sha256(jsonb_build_object(
    (select value from s10_ids where key = 'typeFieldId'),
    'Source changed before migration'
  ))::char(64),
  source.author_person_id, source.acting_party_id, 'draft', 1,
  'valid', '{}'::jsonb, statement_timestamp(), statement_timestamp()
from platform_private.cms_entry_revisions source
where source.id = (select value::uuid from s10_ids where key = 'entryRevisionId');
insert into platform_private.cms_entry_field_values(
  owner_id, state, version, revision_id, field_id, field_definition_id,
  locale, value, provenance, value_hash, created_at, updated_at
)
select field.owner_id, 'active', 1,
  'a9400000-0000-4000-8000-000000000002'::uuid,
  field.field_id, field.field_definition_id, field.locale,
  to_jsonb('Source changed before migration'::text), 'authored',
  platform_private.cms_jcs_sha256(
    to_jsonb('Source changed before migration'::text)
  )::char(64), statement_timestamp(), statement_timestamp()
from platform_private.cms_entry_field_values field
where field.revision_id = (select value::uuid from s10_ids where key = 'entryRevisionId')
  and field.field_id = (select value::uuid from s10_ids where key = 'typeFieldId');
alter table platform_private.cms_entry_revisions
  enable trigger cms_entry_revisions_locale_stale;

select is(
  (select count(*)::integer from platform_private.cms_locale_variants
   where entry_id = (select value::uuid from s10_ids where key = 'entryId')),
  1,
  'pre-migration source history leaves one unreconciled draft variant'
);
select set_config(
  'app.correlation_id', 'a9400000-0000-4000-8000-000000000099', true
);
select is(
  platform_private.cms_stale_locale_dependents(
    'a9400000-0000-4000-8000-000000000002'::uuid, true
  ),
  1,
  'the migration reconciliation appends one stale version'
);
select ok(
  (select state = 'stale' and version = 2
   from platform_private.cms_locale_variants
   where entry_id = (select value::uuid from s10_ids where key = 'entryId')
   order by version desc limit 1),
  'backfill leaves the original immutable and makes the latest version stale'
);
select is(
  (select version::text from platform_private.cms_content_entries
   where id = (select value::uuid from s10_ids where key = 'entryId')),
  '2',
  'backfill does not invent a new entry aggregate version'
);
select ok(
  exists (
    select 1 from platform_private.outbox_events event
    where event.event_type = 'cms.localization.changed.v1'
      and event.aggregate_id = (select value::uuid from s10_ids where key = 'entryId')
      and event.aggregate_version = 2
      and event.correlation_id = 'a9400000-0000-4000-8000-000000000099'::uuid
  ),
  'reconciliation emits a traceable event at the existing aggregate version'
);
select is(
  platform_private.cms_stale_locale_dependents(
    'a9400000-0000-4000-8000-000000000002'::uuid, true
  ),
  0,
  'replaying migration reconciliation is idempotent'
);
select is(
  pg_temp.s10_outbox_count(
    'cms.localization.changed.v1',
    (select value::uuid from s10_ids where key = 'entryId')
  ),
  2,
  'idempotent reconciliation emits no duplicate locale event'
);

select finish();
rollback;
