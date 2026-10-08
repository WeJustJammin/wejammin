-- Slice 10 QA-RED/GREEN: draft-detail relation integrity (finding 10, relations).
--
-- CMS-03B-11 returns authorized, schema-typed content only.  Stored values are
-- already split into two classes: a value with no declaring definition is
-- corrupt storage (INTERNAL_ERROR), a value whose declaring definition is not
-- active is intentionally omitted.  Stored relations follow the same split:
--   * a relation bound to no declaring relation definition on the draft's
--     schema version and owner is INTERNAL_ERROR, retired or not;
--   * a relation whose declaring field definition is declared but not active
--     is omitted exactly like a value (no resolved entry, no placeholder, and
--     never an unavailable-target `block` refusal);
--   * relations are normalized rows kept beside the revision, never part of
--     the revision payload hash (every write path hashes the field value map
--     only), so omitting one cannot change the verified or returned hash.
-- Each probe forges one state inside a rolled-back subtransaction; the replica
-- role skips the immutability triggers that guard real writers.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc

create temp table s10_detail_request on commit drop as
select jsonb_build_object(
  'entryId', ids_entry.value,
  'context', jsonb_build_object(
    'actingPartyId', ids_org.value,
    'actingContextId', 'a9100000-0000-4000-8000-000000000094',
    'correlationId', 'a9100000-0000-4000-8000-000000000095'
  )
) as request
from s10_ids ids_entry, s10_ids ids_org
where ids_entry.key = 'entryId' and ids_org.key = 'organization';

select pg_temp.s10_rpc_as(
  'a9100000-0000-4000-8000-000000000001'::uuid,
  (select value::uuid from s10_ids where key = 'organization')
);
select set_config('app.cms_rpc', 'true', true);

-- Control: the seeded relation (policy omit, readable target) is projected.
select pg_temp.s10_rpc_probe(
  'relation-control', null,
  'select platform_api.cms_get_entry_draft('
    || quote_literal((select request::text from s10_detail_request))
    || '::jsonb)'
);
select is(
  jsonb_array_length(pg_temp.s10_probe_response('relation-control')->'relations'),
  1, 'CMS-03B-11 control: an active relation definition projects its relation'
);

-- 1. Declared but not active: omitted like a value, hash untouched.
select pg_temp.s10_rpc_probe(
  'relation-retired',
  $sql$set local session_replication_role = replica;
   update platform_private.cms_field_definition_versions
   set state = 'retired', updated_at = clock_timestamp()
   where id = (select value::uuid from s10_ids where key = 'typeRelationFieldId');
   set local session_replication_role = origin;$sql$,
  'select platform_api.cms_get_entry_draft('
    || quote_literal((select request::text from s10_detail_request))
    || '::jsonb)'
);
select is(
  pg_temp.s10_probe_state('relation-retired'), '00000',
  'CMS-03B-11 succeeds when a stored relation definition is retired'
);
select is(
  jsonb_array_length(pg_temp.s10_probe_response('relation-retired')->'relations'),
  0, 'CMS-03B-11 omits a relation whose declaring definition is retired'
);
select is(
  pg_temp.s10_probe_response('relation-retired')->>'contentHash',
  (select payload_hash::text from platform_private.cms_entry_revisions
    where id = 'a9100000-0000-4000-8000-000000000302'),
  'CMS-03B-11 contentHash ignores relations: retiring one leaves the field-value hash'
);
select is(
  jsonb_array_length(pg_temp.s10_probe_response('relation-retired')->'fields'),
  1, 'CMS-03B-11 retiring a relation definition leaves the active field value'
);

-- 2. Omission precedes the unavailable-target policy: a retired definition's
-- stale target must not trip `block`, and must not leave a `placeholder`.
-- Each armed state first runs with the definition ACTIVE, proving the policy
-- is live (refusal / placeholder), then retired, proving it is omitted.
create or replace function pg_temp.s10_rel_policy_setup(
  p_policy text, p_retire boolean
)
returns text
language sql
as $body$
  select format($sql$
    set local session_replication_role = replica;
    update platform_private.cms_relation_definitions
    set on_unavailable = %L
    where field_definition_id = (select value::uuid from s10_ids where key = 'typeRelationFieldId');
    update platform_private.cms_entry_relations
    set on_unavailable = %L
    where revision_id = 'a9100000-0000-4000-8000-000000000302';
    update platform_private.cms_content_entries set version = 2
    where id = 'a9100000-0000-4000-8000-000000000301';
    %s
    set local session_replication_role = origin;$sql$,
    p_policy, p_policy,
    case when p_retire then $r$
      update platform_private.cms_field_definition_versions
      set state = 'retired', updated_at = clock_timestamp()
      where id = (select value::uuid from s10_ids where key = 'typeRelationFieldId');$r$
    else '' end)
$body$;

select pg_temp.s10_rpc_probe(
  'relation-block-active', pg_temp.s10_rel_policy_setup('block', false),
  'select platform_api.cms_get_entry_draft('
    || quote_literal((select request::text from s10_detail_request))
    || '::jsonb)'
);
select is(
  pg_temp.s10_probe_message('relation-block-active'), 'DEPENDENCY_UNAVAILABLE',
  'CMS-03B-11 control: an active block-policy relation with a stale target refuses'
);
select pg_temp.s10_rpc_probe(
  'relation-block-retired', pg_temp.s10_rel_policy_setup('block', true),
  'select platform_api.cms_get_entry_draft('
    || quote_literal((select request::text from s10_detail_request))
    || '::jsonb)'
);
select is(
  pg_temp.s10_probe_state('relation-block-retired'), '00000',
  'CMS-03B-11 a retired block-policy relation never refuses the read'
);
select is(
  jsonb_array_length(pg_temp.s10_probe_response('relation-block-retired')->'relations'),
  0, 'CMS-03B-11 a retired block-policy relation is omitted'
);

select pg_temp.s10_rpc_probe(
  'relation-placeholder-active', pg_temp.s10_rel_policy_setup('placeholder', false),
  'select platform_api.cms_get_entry_draft('
    || quote_literal((select request::text from s10_detail_request))
    || '::jsonb)'
);
select is(
  pg_temp.s10_probe_response('relation-placeholder-active')->'relations'->0->'unavailable',
  jsonb_build_object('status', 'unavailable', 'reason', 'unavailable'),
  'CMS-03B-11 control: an active placeholder-policy relation with a stale target is a placeholder'
);
select pg_temp.s10_rpc_probe(
  'relation-placeholder-retired', pg_temp.s10_rel_policy_setup('placeholder', true),
  'select platform_api.cms_get_entry_draft('
    || quote_literal((select request::text from s10_detail_request))
    || '::jsonb)'
);
select is(
  jsonb_array_length(pg_temp.s10_probe_response('relation-placeholder-retired')->'relations'),
  0, 'CMS-03B-11 a retired placeholder-policy relation leaves no placeholder'
);

-- 3. Absent declaration is corrupt storage, never omission, retired or not.
select pg_temp.s10_rpc_probe(
  'relation-no-definition',
  $sql$set local session_replication_role = replica;
   update platform_private.cms_entry_relations
   set field_definition_id = 'a9100000-0000-4000-8000-000000000999'
   where revision_id = 'a9100000-0000-4000-8000-000000000302';
   set local session_replication_role = origin;$sql$,
  'select platform_api.cms_get_entry_draft('
    || quote_literal((select request::text from s10_detail_request))
    || '::jsonb)'
);
select is(
  pg_temp.s10_probe_message('relation-no-definition'), 'INTERNAL_ERROR',
  'CMS-03B-11 refuses a relation bound to no declaring field definition'
);
select pg_temp.s10_rpc_probe(
  'relation-foreign-owner-definition',
  $sql$set local session_replication_role = replica;
   update platform_private.cms_field_definition_versions
   set owner_id = 'a9100000-0000-4000-8000-0000000007f1'
   where id = (select value::uuid from s10_ids where key = 'typeRelationFieldId');
   set local session_replication_role = origin;$sql$,
  'select platform_api.cms_get_entry_draft('
    || quote_literal((select request::text from s10_detail_request))
    || '::jsonb)'
);
select is(
  pg_temp.s10_probe_message('relation-foreign-owner-definition'), 'INTERNAL_ERROR',
  'CMS-03B-11 refuses a relation declared by another owner''s definition'
);
select pg_temp.s10_rpc_probe(
  'relation-retired-undeclared',
  $sql$set local session_replication_role = replica;
   update platform_private.cms_field_definition_versions
   set state = 'retired', updated_at = clock_timestamp()
   where id = (select value::uuid from s10_ids where key = 'typeRelationFieldId');
   delete from platform_private.cms_relation_definitions
   where field_definition_id = (select value::uuid from s10_ids where key = 'typeRelationFieldId');
   set local session_replication_role = origin;$sql$,
  'select platform_api.cms_get_entry_draft('
    || quote_literal((select request::text from s10_detail_request))
    || '::jsonb)'
);
select is(
  pg_temp.s10_probe_message('relation-retired-undeclared'), 'INTERNAL_ERROR',
  'CMS-03B-11 retirement does not excuse a relation with no immutable relation definition'
);

select finish();
rollback;
