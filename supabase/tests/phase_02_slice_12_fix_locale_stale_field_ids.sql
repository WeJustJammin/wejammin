\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 12 FIX lane, CMS-03C-04: the 201 resource carries `staleFieldIds` (BE03c LocaleVariantResource,
-- DEC-121): empty unless the variant is stale, and a freshly authored variant is a draft. A response
-- stored by an earlier deploy (which had no such member) is completed on replay.
-- [P2-S12-AC-054]

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc

select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'creatorAuth'),
  (select value::uuid from s10_ids where key = 'organization')
);

create temp table s12loc_request on commit drop as
select jsonb_build_object(
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
  'idempotencyKey', 's12-locale-stale-0001'
) as request;

create temp table s12loc_created on commit drop as
select platform_api.cms_author_locale_variant(request) as response from s12loc_request;

select is(
  (select response->'staleFieldIds' from s12loc_created),
  '[]'::jsonb,
  'a freshly authored variant answers an empty staleFieldIds [P2-S12-AC-054]');
select is(
  (select response->>'state' from s12loc_created),
  'draft',
  'a freshly authored variant is a draft, so staleFieldIds is empty [P2-S12-AC-054]');
select is(
  (select array_agg(key order by key) from s12loc_created, jsonb_object_keys(response) key),
  array['contentHash', 'createdAt', 'entryId', 'fallbackChain', 'id', 'locale',
        'noFallbackFieldIds', 'revisionId', 'sourceRevisionId', 'staleFieldIds', 'state',
        'updatedAt', 'version'],
  'the resource carries exactly the locked members, nothing private [P2-S12-AC-054]');
select is(
  (select platform_api.cms_author_locale_variant(request) from s12loc_request),
  (select response from s12loc_created),
  'an exact replay returns the identical stored resource including staleFieldIds [P2-S12-AC-054]');

-- A response stored before staleFieldIds existed is completed on replay, not returned short.
-- (A completed receipt is immutable, so the older receipt is forged with the row triggers skipped.)
set local session_replication_role = replica;
update platform_private.idempotency_records
   set response_ref = jsonb_set(
         response_ref, '{safeHeaders,response}',
         (response_ref->'safeHeaders'->'response') - 'staleFieldIds')
 where operation = 'CMS-03C-04'
   and response_ref->'safeHeaders'->'response'->>'id' = (select response->>'id' from s12loc_created);
set local session_replication_role = origin;
select is(
  (select count(*)::integer from platform_private.idempotency_records
    where operation = 'CMS-03C-04'
      and not (response_ref->'safeHeaders'->'response' ? 'staleFieldIds')),
  1,
  'the fixture holds one stored response that predates staleFieldIds');
select is(
  (select platform_api.cms_author_locale_variant(request) from s12loc_request),
  (select response from s12loc_created),
  'replaying that older stored response completes staleFieldIds as [] [P2-S12-AC-054]');

select finish();
rollback;
