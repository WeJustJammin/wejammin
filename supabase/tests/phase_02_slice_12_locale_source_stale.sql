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

create temp table s12_source_variant on commit drop as
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
  'idempotencyKey', 'locale-stale-source-0001'
)) as response;

create temp table s12_second_variant on commit drop as
select platform_api.cms_author_locale_variant(jsonb_build_object(
  'entryId', (select value from s10_ids where key = 'entryId'),
  'locale', 'de-DE',
  'sourceRevisionId', (select value from s10_ids where key = 'entryRevisionId'),
  'sourceHash', (
    select btrim(payload_hash::text)
    from platform_private.cms_entry_revisions
    where id = (select value::uuid from s10_ids where key = 'entryRevisionId')
  ),
  'fields', jsonb_build_array(jsonb_build_object(
    'fieldId', (select value from s10_ids where key = 'typeFieldId'),
    'value', 'Uebersetzter Titel'
  )),
  'fallbackChain', jsonb_build_array('en-US'),
  'noFallbackFieldIds', '[]'::jsonb,
  'expectedVersion', '2', 'ifMatch', '2',
  'idempotencyKey', 'locale-stale-source-0002'
)) as response;

select ok(
  exists (
    select 1 from pg_catalog.pg_trigger trigger_row
    where trigger_row.tgrelid = 'platform_private.cms_entry_revisions'::regclass
      and trigger_row.tgname = 'cms_entry_revisions_locale_stale'
      and not trigger_row.tgisinternal
  ),
  'every committed source revision enters the locale-staleness transition'
);
select ok(
  not has_function_privilege('anon',
    'platform_private.cms_stale_locale_dependents(uuid, boolean)', 'execute')
    and not has_function_privilege('authenticated',
      'platform_private.cms_stale_locale_dependents(uuid, boolean)', 'execute')
    and not has_function_privilege('service_role',
      'platform_private.cms_stale_locale_dependents(uuid, boolean)', 'execute'),
  'browser and service roles cannot invoke the private stale transition directly'
);

create or replace function pg_temp.s12_append_source_revision(
  p_revision_id uuid,
  p_revision_number bigint,
  p_value jsonb
)
returns void
language plpgsql
as $body$
declare
  source_row platform_private.cms_entry_revisions%rowtype;
  field_row platform_private.cms_entry_field_values%rowtype;
  snapshot_time timestamptz := pg_catalog.clock_timestamp();
begin
  select * into source_row
  from platform_private.cms_entry_revisions revision
  where revision.id = (select value::uuid from s10_ids where key = 'entryRevisionId');
  select * into field_row
  from platform_private.cms_entry_field_values field
  where field.revision_id = source_row.id
    and field.field_id = (select value::uuid from s10_ids where key = 'typeFieldId');

  insert into platform_private.cms_entry_revisions(
    id, owner_id, entry_id, revision_number, schema_version_id,
    template_version_id, taxonomy_version_ids, parent_revision_ids, locale,
    payload_hash, author_person_id, acting_party_id, state, version,
    validation_state, validation_report, created_at, updated_at
  ) values (
    p_revision_id, source_row.owner_id, source_row.entry_id, p_revision_number,
    source_row.schema_version_id, source_row.template_version_id,
    source_row.taxonomy_version_ids, pg_catalog.jsonb_build_array(source_row.id),
    source_row.locale,
    platform_private.cms_jcs_sha256(
      pg_catalog.jsonb_build_object(field_row.field_id::text, p_value)
    )::char(64),
    source_row.author_person_id, source_row.acting_party_id, 'draft', 1,
    'valid', '{}'::jsonb, snapshot_time, snapshot_time
  );
  insert into platform_private.cms_entry_field_values(
    owner_id, state, version, revision_id, field_id, field_definition_id,
    locale, value, provenance, value_hash, created_at, updated_at
  ) values (
    field_row.owner_id, 'active', 1, p_revision_id, field_row.field_id,
    field_row.field_definition_id, source_row.locale, p_value, 'authored',
    platform_private.cms_jcs_sha256(p_value)::char(64),
    snapshot_time, snapshot_time
  );
end;
$body$;

select pg_temp.s12_append_source_revision(
  'a9300000-0000-4000-8000-000000000002'::uuid,
  2,
  to_jsonb('Seeded draft title'::text)
);
select is(
  (select count(*)::integer from platform_private.cms_locale_variants
   where entry_id = (select value::uuid from s10_ids where key = 'entryId')),
  2,
  'a source revision with the same canonical hash does not stale variants'
);

select pg_temp.s12_append_source_revision(
  'a9300000-0000-4000-8000-000000000003'::uuid,
  3,
  to_jsonb('Updated source title'::text)
);
select is(
  (select count(*)::integer from platform_private.cms_locale_variants
   where entry_id = (select value::uuid from s10_ids where key = 'entryId')),
  4,
  'a changed source appends one stale version for each dependent locale'
);
select is(
  (select state from platform_private.cms_locale_variants
   where id = (select (response->>'id')::uuid from s12_source_variant)),
  'draft',
  'the previously authored locale variant remains immutable'
);
select ok(
  (select state = 'stale'
     and version = 2
     and revision_id = (select (response->>'revisionId')::uuid from s12_source_variant)
     and source_revision_id = (select value::uuid from s10_ids where key = 'entryRevisionId')
     and approval_evidence is null
   from platform_private.cms_locale_variants
   where entry_id = (select value::uuid from s10_ids where key = 'entryId')
     and locale = 'fr-FR'
   order by version desc limit 1),
  'the new stale version retains immutable provenance and clears approval evidence'
);
select is(
  (select state from platform_private.cms_locale_variants
   where entry_id = (select value::uuid from s10_ids where key = 'entryId')
     and locale = 'de-DE'
   order by version desc limit 1),
  'stale',
  'the second source-dependent locale is invalidated in the same transaction'
);
select is(
  (select pg_temp.s10_audit_count(
    'cms.locale.variant.stale', variant.id
  ) from platform_private.cms_locale_variants variant
  where variant.entry_id = (select value::uuid from s10_ids where key = 'entryId')
    and variant.locale = 'fr-FR'
  order by variant.version desc limit 1),
  1,
  'source staleness commits one attributable private audit event'
);
select is(
  pg_temp.s10_outbox_count(
    'cms.localization.changed.v1',
    (select value::uuid from s10_ids where key = 'entryId')
  ),
  4,
  'source staleness emits one identifier-only locale change event per locale'
);
select ok(
  (select bool_and(payload ?& array['entryId','locale','revisionId']
      and (select count(*) from pg_catalog.jsonb_object_keys(payload)) = 3)
   from platform_private.outbox_events
   where event_type = 'cms.localization.changed.v1'
     and aggregate_id = (select value::uuid from s10_ids where key = 'entryId')),
  'locale change events never disclose source or translated text'
);

select pg_temp.s12_append_source_revision(
  'a9300000-0000-4000-8000-000000000004'::uuid,
  4,
  to_jsonb('Updated source title'::text)
);
select is(
  (select count(*)::integer from platform_private.cms_locale_variants
   where entry_id = (select value::uuid from s10_ids where key = 'entryId')),
  4,
  'already-stale variants are not duplicated by a repeated source hash'
);

select finish();
rollback;
