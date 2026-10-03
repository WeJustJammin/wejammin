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

-- A healthy authoring command must keep succeeding before the mismatch probe:
-- the 409 correction may never turn a correct client hash into a conflict.
create temp table s12_hash_ok on commit drop as
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
  'idempotencyKey', 'locale-hash-mismatch-0001'
)) as response;

select is(
  (select response->>'state' from s12_hash_ok),
  'draft',
  'a correctly pinned client source hash still authors a draft variant'
);

-- Corrupt the stored source values inside this rolled-back fixture only. The
-- pinned payload_hash on the revision row no longer recomputes from storage,
-- which is exactly the stale-client-source state the recompute guard exists
-- for. The immutable guard is bypassed for the fixture row only; no committed
-- history is rewritten.
alter table platform_private.cms_entry_field_values
  disable trigger cms_entry_field_values_immutable_guard;
update platform_private.cms_entry_field_values
set value = to_jsonb('Source drifted under the fixture'::text)
where revision_id = (select value::uuid from s10_ids where key = 'entryRevisionId')
  and field_id = (select value::uuid from s10_ids where key = 'typeFieldId');
alter table platform_private.cms_entry_field_values
  enable trigger cms_entry_field_values_immutable_guard;

select ok(
  platform_private.cms_jcs_sha256(
    (select coalesce(pg_catalog.jsonb_object_agg(field.field_id::text, field.value), '{}'::jsonb)
     from platform_private.cms_entry_field_values field
     where field.revision_id = (select value::uuid from s10_ids where key = 'entryRevisionId'))
  ) <> (select btrim(payload_hash::text)
        from platform_private.cms_entry_revisions
        where id = (select value::uuid from s10_ids where key = 'entryRevisionId')),
  'the fixture really has a stored source that no longer recomputes to its pinned hash'
);

select throws_ok(
  $$select platform_api.cms_author_locale_variant(
      jsonb_build_object(
        'entryId', (select value from s10_ids where key = 'entryId'),
        'locale', 'de-DE',
        'sourceRevisionId', (select value from s10_ids where key = 'entryRevisionId'),
        'sourceHash', (select btrim(payload_hash::text)
                       from platform_private.cms_entry_revisions
                       where id = (select value::uuid from s10_ids where key = 'entryRevisionId')),
        'fields', jsonb_build_array(jsonb_build_object(
          'fieldId', (select value from s10_ids where key = 'typeFieldId'),
          'value', 'Uebersetzter Titel'
        )),
        'fallbackChain', jsonb_build_array('en-US'),
        'noFallbackFieldIds', '[]'::jsonb,
        'expectedVersion', '2', 'ifMatch', '2',
        'idempotencyKey', 'locale-hash-mismatch-0002'
    ))$$,
  'P0001', 'VERSION_MISMATCH',
  'stale recompute hash conflicts as 409, never 503'
);

select finish();
rollback;
