-- Slice 10 QA-RED/GREEN: draft-detail schema lineage (AC067/AC075).
--
-- The authorized draft read returns the verified schema identity the CMS-05
-- editor builds its write base from.  "Verified" means the draft's pinned
-- schema version resolves to the entry's own content type and owner, is
-- active, and is backed by its compiled artifact whose hash equals the version
-- definition hash.  Any break in that chain means the stored values cannot be
-- schema-typed, so the read refuses with the dependency token rather than
-- serving an untyped envelope.  Each probe forges exactly one break inside a
-- rolled-back subtransaction (replica role skips the immutability triggers that
-- guard real writers) and the untouched fixture control must still read.

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
where ids_entry.key = 'entryId'
  and ids_org.key = 'organization';

select pg_temp.s10_rpc_as(
  'a9100000-0000-4000-8000-000000000001'::uuid,
  (select value::uuid from s10_ids where key = 'organization')
);
select set_config('app.cms_rpc', 'true', true);

-- Control: the untouched chain reads, so each refusal below is attributable to
-- the single forged break and not to an over-broad guard.
select pg_temp.s10_rpc_probe(
  'lineage-control', null,
  'select platform_api.cms_get_entry_draft('
    || quote_literal((select request::text from s10_detail_request))
    || '::jsonb)'
);
select is(
  pg_temp.s10_probe_state('lineage-control'), '00000',
  'CMS-03B-11 control: the intact schema lineage reads successfully'
);

-- Schema lineage.  The pinned version must be the entry's content type,
-- the entry owner's, active, and backed by its compiled artifact whose hash is
-- the version definition hash; otherwise the stored values cannot be typed.
select pg_temp.s10_rpc_probe(
  'lineage-content-type-mismatch',
  $sql$set local session_replication_role = replica;
   update platform_private.cms_content_type_versions
   set content_type_id = 'a9100000-0000-4000-8000-0000000007f2'
   where id = (select value::uuid from s10_ids where key = 'draftVersionId');
   set local session_replication_role = origin;$sql$,
  'select platform_api.cms_get_entry_draft('
    || quote_literal((select request::text from s10_detail_request))
    || '::jsonb)'
);
select is(
  pg_temp.s10_probe_message('lineage-content-type-mismatch'),
  'DEPENDENCY_UNAVAILABLE',
  'CMS-03B-11 refuses a pinned schema version of another content type'
);
select pg_temp.s10_rpc_probe(
  'lineage-owner-mismatch',
  $sql$set local session_replication_role = replica;
   update platform_private.cms_content_type_versions
   set owner_id = 'a9100000-0000-4000-8000-0000000007f1'
   where id = (select value::uuid from s10_ids where key = 'draftVersionId');
   set local session_replication_role = origin;$sql$,
  'select platform_api.cms_get_entry_draft('
    || quote_literal((select request::text from s10_detail_request))
    || '::jsonb)'
);
select is(
  pg_temp.s10_probe_message('lineage-owner-mismatch'), 'DEPENDENCY_UNAVAILABLE',
  'CMS-03B-11 refuses a pinned schema version of another owner'
);
select pg_temp.s10_rpc_probe(
  'lineage-artifact-hash-mismatch',
  $sql$set local session_replication_role = replica;
   update platform_private.cms_content_type_versions
   set definition_hash = repeat('c', 64)
   where id = (select value::uuid from s10_ids where key = 'draftVersionId');
   set local session_replication_role = origin;$sql$,
  'select platform_api.cms_get_entry_draft('
    || quote_literal((select request::text from s10_detail_request))
    || '::jsonb)'
);
select is(
  pg_temp.s10_probe_message('lineage-artifact-hash-mismatch'),
  'DEPENDENCY_UNAVAILABLE',
  'CMS-03B-11 refuses a schema version whose compiled artifact hash disagrees'
);

select finish();
rollback;
