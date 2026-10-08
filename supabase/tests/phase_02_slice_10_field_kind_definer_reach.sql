-- Slice 10 repair (stream 1): the field-kind validators are reachable by the
-- role that actually runs them.
--
-- SEC-2: the CMS definer role holds EXECUTE only on the functions the bodies it
-- owns call, and every validator below is invoker-rights, so a SECURITY DEFINER
-- command (cms_create_type_draft, the revision writers, the restore chain, ...)
-- reaches them as wejammin_cms_definer.  Calling a validator as the migration
-- owner proves nothing about that wiring: a missing EXECUTE grant on a helper the
-- validator calls (the rich_text.v1 depth pre-check called cms_json_depth, which
-- the definer role could not execute) surfaces only inside a real command as
-- "permission denied for function ...", turning a valid rich-text value into an
-- untyped failure.  Each probe therefore switches to the definer role, runs one
-- validator on a valid value and requires the correct verdict, so a missing grant
-- on any function in the validator call tree fails here.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc

-- Evaluates one boolean expression as wejammin_cms_definer.  A permission error
-- (or any other failure) is returned as text so it fails the assertion visibly.
create or replace function pg_temp.s10d_as_definer(p_expression text)
returns text
language plpgsql
as $body$
declare
  verdict boolean;
begin
  begin
    set local role wejammin_cms_definer;
    execute 'select ' || p_expression into verdict;
    reset role;
    return verdict::text;
  exception
    when others then
      reset role;
      return 'ERROR ' || sqlstate || ': ' || sqlerrm;
  end;
end;
$body$;

select is(pg_temp.s10d_as_definer(c.expression), c.expected,
  c.label || ' [P2-S10-AC-031]')
from (values
  ($$platform_private.cms_rich_text_v1_valid('{"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"Hi","marks":["bold"],"link":{"kind":"https","href":"https://example.com/a"}}]}]}'::jsonb)$$,
    'true', 'the definer role runs the rich_text.v1 grammar on a canonical document'),
  ($$platform_private.cms_rich_text_v1_valid('{"format":"rich_text.v1","blocks":[]}'::jsonb)$$,
    'false', 'the definer role runs the rich_text.v1 grammar and refuses an empty document'),
  ($$platform_private.cms_rich_text_length_in_bounds('{"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"Hi","marks":[]}]}]}'::jsonb, '{"maxLength":5}'::jsonb)$$,
    'true', 'the definer role runs the rich-text total-length bound'),
  ($$platform_private.cms_protected_validator_ref('rich_text.v1', 1)$$,
    'true', 'the definer role reads the protected validator registry'),
  ($$platform_private.cms_object_structure_valid('{"properties":[{"key":"title","kind":"scalar","required":true,"constraints":{}}]}'::jsonb)$$,
    'true', 'the definer role validates an object structure'),
  ($$platform_private.cms_object_value_valid('{"properties":[{"key":"body","kind":"rich_text","required":true,"constraints":{}}]}'::jsonb, '{"body":{"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"Hi","marks":[]}]}]}}'::jsonb)$$,
    'true', 'the definer role validates an object value with a rich_text property'),
  ($$platform_private.cms_list_item_kind_valid('date')$$,
    'true', 'the definer role validates a list item kind'),
  ($$platform_private.cms_list_item_value_valid('date', '{}'::jsonb, '"2026-02-28"'::jsonb)$$,
    'true', 'the definer role validates a list date item'),
  ($$platform_private.cms_field_kind_value_shape('short_text', '{}'::jsonb, '"n/a"'::jsonb)$$,
    'true', 'the definer role runs the shared shape on a short_text value'),
  ($$platform_private.cms_field_kind_value_shape('rich_text', '{}'::jsonb, '{"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"Hi","marks":[]}]}]}'::jsonb)$$,
    'true', 'the definer role runs the shared shape on a rich_text value'),
  ($$platform_private.cms_field_kind_value_shape('relation', '{}'::jsonb, '{"targets":[{"targetId":"a9100000-0000-4000-8000-000000000301"}]}'::jsonb)$$,
    'true', 'the definer role runs the shared shape on a relation value'),
  ($$platform_private.cms_field_kind_value_shape('datetime', '{}'::jsonb, '"2026-02-28T10:00:00Z"'::jsonb)$$,
    'true', 'the definer role runs the shared shape on a datetime value'),
  ($$platform_private.cms_field_kind_value_shape('list', '{"itemKind":"integer"}'::jsonb, '[1,2]'::jsonb)$$,
    'true', 'the definer role runs the shared shape on a list value'),
  ($$platform_private.cms_media_reference_valid('{"assetId":"a9100000-0000-4000-8000-0000000000a1","assetVersion":"3"}'::jsonb)$$,
    'true', 'the definer role validates a typed media reference'),
  ($$platform_private.cms_field_kind_value_shape('taxonomy', '{}'::jsonb, '{"termIds":[]}'::jsonb)$$,
    'true', 'the definer role runs the shared shape on a taxonomy value'),
  ($$platform_private.cms_field_kind_value_shape('media', '{}'::jsonb, '[]'::jsonb)$$,
    'true', 'the definer role runs the shared shape on a media value'),
  ($$platform_private.cms_value_source_refusal('taxonomy', '{"termIds":["a9100000-0000-4000-8000-0000000000f1"]}'::jsonb) = 'taxonomy_source_unavailable'$$,
    'true', 'the definer role runs the taxonomy producer refusal'),
  ($$platform_private.cms_value_source_refusal('media', '[{"assetId":"a9100000-0000-4000-8000-0000000000a1","assetVersion":"3"}]'::jsonb) = 'media_source_unavailable'$$,
    'true', 'the definer role runs the media producer refusal'),
  ($$platform_private.cms_authored_value_kind_supported('object')$$,
    'true', 'the definer role reads the writable-kind list'),
  ($$(select true from (select platform_private.cms_require_value_source_available('$$ || (select value from s10_ids where key = 'draftVersionId') || $$'::uuid, '$$ || (select value from s10_ids where key = 'typeFieldId') || $$'::uuid, '"Headline"'::jsonb)) probe)$$,
    'true', 'the definer role reads the pinned field kind for the write-time producer refusal'),
  ($$platform_private.cms_valid_field_input('{"stableFieldId":"a9100000-0000-4000-8000-000000000d01","key":"probe","kind":"rich_text","constraints":{},"required":false,"validatorKey":"rich_text.v1","validatorVersion":1,"defaultMode":"literal","defaultValue":{"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"Hi","marks":[]}]}]},"localizationMode":"none","editorConfig":{"label":"Probe","order":0},"lifecycle":"active"}'::jsonb, true)$$,
    'true', 'the definer role validates a rich_text field definition with a rich_text.v1 literal default'),
  ($$platform_private.cms_valid_field_input('{"stableFieldId":"a9100000-0000-4000-8000-000000000d02","key":"probe","kind":"short_text","constraints":{},"required":false,"validatorKey":null,"validatorVersion":null,"defaultMode":"literal","defaultValue":"n/a","localizationMode":"none","editorConfig":{"label":"Probe","order":0},"lifecycle":"active"}'::jsonb, true)$$,
    'true', 'the definer role validates a short_text field definition with a literal default'),
  ($$platform_private.cms_valid_field_input('{"stableFieldId":"a9100000-0000-4000-8000-000000000d03","key":"probe","kind":"short_text","constraints":{},"required":false,"validatorKey":null,"validatorVersion":null,"defaultMode":"literal","defaultValue":null,"localizationMode":"none","editorConfig":{"label":"Probe","order":0},"lifecycle":"active"}'::jsonb, true)$$,
    'true', 'the definer role validates a field definition whose literal default is explicit JSON null')
) c(expression, expected, label);

-- The pinned-schema draft gate, on the fixture schema, as the definer role.
select is(
  pg_temp.s10d_as_definer(format(
    'platform_private.cms_draft_field_value_valid(%L::uuid, %L::uuid, %L::jsonb, %L)',
    (select value from s10_ids where key = 'draftVersionId'),
    (select value from s10_ids where key = 'typeFieldId'),
    '"Headline"', 'authored')),
  'true',
  'the definer role runs the pinned-schema draft gate on a short_text value [P2-S10-AC-031]'
);
select is(
  pg_temp.s10d_as_definer(format(
    'platform_private.cms_draft_field_value_valid(%L::uuid, %L::uuid, %L::jsonb, %L)',
    (select value from s10_ids where key = 'draftVersionId'),
    (select value from s10_ids where key = 'typeFieldId'),
    '7', 'authored')),
  'false',
  'the definer role runs the pinned-schema draft gate and refuses a number for short_text [P2-S10-AC-031]'
);
select is(
  pg_temp.s10d_as_definer(format(
    'platform_private.cms_draft_field_value_valid(%L::uuid, %L::uuid, %L::jsonb, %L)',
    (select value from s10_ids where key = 'draftVersionId'),
    (select value from s10_ids where key = 'typeRelationFieldId'),
    '{"targets":[{"targetId":"a9100000-0000-4000-8000-000000000301","expectedTargetVersion":null}]}', 'authored')),
  'true',
  'the definer role runs the pinned-schema draft gate on a relation value [P2-S10-AC-031]'
);

-- No API role may call any of them directly (least privilege is unchanged).
select is(
  (select count(*)::integer
   from unnest(array[
     'platform_private.cms_field_kind_value_shape(text, jsonb, jsonb)',
     'platform_private.cms_list_item_kind_valid(text)',
     'platform_private.cms_list_item_value_valid(text, jsonb, jsonb)',
     'platform_private.cms_object_structure_valid(jsonb)',
     'platform_private.cms_object_value_valid(jsonb, jsonb)',
     'platform_private.cms_rich_text_v1_valid(jsonb)',
     'platform_private.cms_rich_text_length_in_bounds(jsonb, jsonb)',
     'platform_private.cms_protected_validator_ref(text, bigint)',
     'platform_private.cms_media_reference_valid(jsonb)',
     'platform_private.cms_value_source_refusal(text, jsonb)',
     'platform_private.cms_require_value_source_available(uuid, uuid, jsonb)',
     'platform_private.cms_authored_value_kind_supported(text)'
   ]) as signature
   cross join unnest(array['anon', 'authenticated', 'service_role']) as api_role
   where has_function_privilege(api_role, signature, 'execute')),
  0,
  'no API role holds EXECUTE on any field-kind validator [P2-S10-AC-031]'
);

select * from finish();
rollback;
