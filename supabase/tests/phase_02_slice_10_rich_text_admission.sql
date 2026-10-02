commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(11);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc

-- Create an independent rich-text schema through the same authoring RPC. The
-- registered field kind is immutable, so changing the fixture in place would
-- prove only that guard. All rows still roll back with this test transaction.
create temp table s10_rich_type_created on commit drop as
select platform_api.cms_create_type_draft(
  request || jsonb_build_object(
    'typeKey', 'article_rich', 'label', 'Rich article',
    'fields', jsonb_build_array(jsonb_build_object(
      'stableFieldId', 'a9100000-0000-4000-8000-000000000103',
      'key', 'body', 'kind', 'rich_text', 'constraints', '{}'::jsonb,
      'required', false, 'validatorKey', null, 'validatorVersion', null,
      'defaultMode', 'none', 'localizationMode', 'localized',
      'editorConfig', jsonb_build_object('label', 'Body', 'order', 0),
      'lifecycle', 'active'
    )),
    'relations', '[]'::jsonb,
    'idempotencyKey', 's10-rich-type-create-0001'
  )
) as response from s10_type_request;

create temp table s10_rich_field_ids on commit drop as
select (response->>'id')::uuid as schema_version_id,
       'a9100000-0000-4000-8000-000000000103'::uuid as field_id
from s10_rich_type_created;

select is(
  (select kind from platform_private.cms_field_definition_versions
   where content_type_version_id =
     (select schema_version_id from s10_rich_field_ids)
     and stable_field_id =
       (select field_id from s10_rich_field_ids)),
  'rich_text',
  'the isolated field uses the rich-text kind'
);

select is(
  platform_private.cms_draft_field_value_valid(
    (select schema_version_id from s10_rich_field_ids),
    (select field_id from s10_rich_field_ids),
    to_jsonb('Plain copy'::text), 'explicit'
  ), false,
  'raw rich-text strings are not an approved structured AST'
);
select is(
  platform_private.cms_draft_field_value_valid(
    (select schema_version_id from s10_rich_field_ids),
    (select field_id from s10_rich_field_ids),
    to_jsonb('<script>alert(1)</script>'::text), 'explicit'
  ), false,
  'executable HTML cannot enter a rich-text draft as a string'
);
select is(
  platform_private.cms_draft_field_value_valid(
    (select schema_version_id from s10_rich_field_ids),
    (select field_id from s10_rich_field_ids),
    '{"type":"document","children":[{"type":"script","value":"x"}]}'::jsonb,
    'explicit'
  ), false,
  'unapproved AST-like objects remain closed until a validator is registered'
);
select is(
  platform_private.cms_draft_field_value_valid(
    (select schema_version_id from s10_rich_field_ids),
    (select field_id from s10_rich_field_ids),
    'null'::jsonb, 'explicit_null'
  ), true,
  'an explicit null retains its existing rich-text provenance semantics'
);
select is(
  platform_private.cms_draft_field_value_valid(
    (select schema_version_id from s10_rich_field_ids),
    (select field_id from s10_rich_field_ids),
    null, 'missing'
  ), true,
  'a missing rich-text value remains distinct from an unapproved value'
);

select is(
  platform_private.cms_draft_field_value_valid(
    (select value::uuid from s10_ids where key = 'draftVersionId'),
    (select value::uuid from s10_ids where key = 'typeFieldId'),
    to_jsonb('Plain copy'::text), 'explicit'
  ), true,
  'ordinary short text remains writable after rich-text refusal'
);

select finish();
rollback;
