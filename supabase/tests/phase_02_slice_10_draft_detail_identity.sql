-- Slice 10 QA-RED (WP-S10-2a): CMS-03B-11 draft-detail identity (D3).
--
-- The authorized draft read must now carry the server-derived identity the
-- CMS-05 editor builds its write base from and the CMS-06 conflict discovery
-- seam:
--   * revisionNumber    - the current draft's revision number;
--   * schemaVersionId   - the verified active schema the draft was authored on;
--   * openConflict      - the bounded {conflictId, version, conflictHash} of the
--                         entry's currently open conflict, or null.
-- These are the safe identity the 03B-02 conflict-resolution route re-reads
-- after a moved-base 409 so a divergent draft survives reload across tabs.
-- The envelope stays privacy-bounded: it never carries resolvedByPersonId or
-- any owner/assignee identifier, keeps the RLS/concealment/no-store read
-- boundaries, and emits no audit or outbox evidence.
--
-- The suite is written before the WP-S10-3 `cms_draft_detail_identity.sql`
-- migration exists, so an absent RPC or key is evidence-backed RED.  This file
-- is the single Supabase discovery entrypoint; the shared rpc/remaining-schema
-- helpers and the Slice 10 fixtures are includes in the repository convention.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(18);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc

-- The read is a named worker-only RPC: a missing wrapper or a browser-reachable
-- one is RED, and the existence check is folded in so an absent function cannot
-- satisfy either assertion vacuously.
select ok(
  pg_temp.s10_fn_exists('platform_api', 'cms_get_entry_draft', 'jsonb')
    and pg_temp.s10_fn_exists('platform_private', 'cms_get_entry_draft', 'jsonb'),
  'CMS-03B-11 draft-detail identity read has a named worker RPC and wrapper'
);

select ok(
  pg_temp.s10_fn_exists('platform_api', 'cms_get_entry_draft', 'jsonb')
    and pg_temp.s10_fn_privilege(
      'platform_api', 'cms_get_entry_draft', 'jsonb', 'service_role'
    )
    and not pg_temp.s10_fn_privilege(
      'platform_api', 'cms_get_entry_draft', 'jsonb', 'authenticated'
    )
    and not pg_temp.s10_fn_privilege(
      'platform_api', 'cms_get_entry_draft', 'jsonb', 'anon'
    ),
  'the draft-detail identity read is service-role only, never browser-callable'
);

-- The draft read exposes conflict identity, so the durable conflict record must
-- stay private: no browser role holds any direct table privilege on it.
select ok(
  pg_temp.s10_no_table_privilege(
    'platform_private.cms_conflict_records', 'authenticated'
  )
    and pg_temp.s10_no_table_privilege(
      'platform_private.cms_conflict_records', 'anon'
    ),
  'conflict records stay private with no browser table grant'
);

create temp table s10_ddi_request on commit drop as
select jsonb_build_object(
  'entryId', ids_entry.value,
  'context', jsonb_build_object(
    'actingPartyId', ids_org.value,
    'actingContextId', 'a9100000-0000-4000-8000-000000000096',
    'correlationId', 'a9100000-0000-4000-8000-000000000097'
  )
) as request
from s10_ids ids_entry, s10_ids ids_org
where ids_entry.key = 'entryId'
  and ids_org.key = 'organization';

-- Audit and outbox are counted before and after so the identity read is proven
-- side-effect free rather than merely asserted to be.
create temp table s10_ddi_effect_baseline on commit drop as
select pg_temp.s10_audit_total() as audit_total,
       pg_temp.s10_outbox_total() as outbox_total;

select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'creatorAuth'),
  (select value::uuid from s10_ids where key = 'organization')
);

create temp table s10_ddi_result on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_get_entry_draft('
    || quote_literal((select request::text from s10_ddi_request))
    || '::jsonb)'
) as response;

select is(
  pg_temp.s10_last_error_state(), '00000',
  'an assigned author reads the draft identity envelope'
);

-- Identity keys: the three D3 fields must be present on the envelope.
select ok(
  (select response ?& array[
     'revisionNumber', 'schemaVersionId', 'openConflict'
   ]
   from s10_ddi_result),
  'CMS-03B-11 returns revisionNumber, schemaVersionId and openConflict'
);

-- revisionNumber is the server-derived current draft revision number, never a
-- caller-supplied base.
select is(
  (select response->>'revisionNumber' from s10_ddi_result),
  (
    select revision.revision_number::text
    from platform_private.cms_entry_revisions revision
    where revision.id = (select value::uuid from s10_ids where key = 'entryRevisionId')
  ),
  'CMS-03B-11 revisionNumber is the stored current draft revision number'
);

-- schemaVersionId is the verified active schema the draft was authored on.
select is(
  (select response->>'schemaVersionId' from s10_ddi_result),
  (
    select revision.schema_version_id::text
    from platform_private.cms_entry_revisions revision
    where revision.id = (select value::uuid from s10_ids where key = 'entryRevisionId')
  ),
  'CMS-03B-11 schemaVersionId is the stored draft schema version'
);

-- Privacy: the identity envelope never carries the resolver or an ownership
-- identifier.  Asserted over the whole response text so a nested leak fails too.
select ok(
  (select response is not null
      and response::text !~ 'resolvedByPersonId'
      and response::text !~ 'ownerId'
      and response::text !~ 'assigneeId'
   from s10_ddi_result),
  'CMS-03B-11 identity envelope exposes no resolver or ownership identifier'
);

-- No open conflict on the seeded draft: the seam is an explicit null, never a
-- fabricated object.
select ok(
  (select (response->'openConflict') = 'null'::jsonb
   from s10_ddi_result),
  'CMS-03B-11 reports openConflict as null when no conflict is open'
);

-- Seed one durable open conflict and prove the read surfaces exactly its
-- bounded identity.  The write is a labelled fixture forgery inside a savepoint
-- and rolls back so the shared fixture stays pristine.  CMS-03B-02 resolution
-- relies on this seam to re-read the divergent conflict after a moved-base 409.
savepoint s10_ddi_open_conflict;
select set_config('app.cms_rpc', 'true', true);
insert into platform_private.cms_conflict_records(
  id, owner_id, entry_id, base_revision_id, theirs_revision_id,
  yours_revision_id, yours_source, changed_paths,
  base_hash, theirs_hash, yours_hash, conflict_hash, state, version
)
select
  'a9100000-0000-4000-8000-000000000401',
  ids_org.value::uuid,
  (select value::uuid from s10_ids where key = 'entryId'),
  (select value::uuid from s10_ids where key = 'entryRevisionId'),
  (select value::uuid from s10_ids where key = 'entryRevisionId'),
  (select value::uuid from s10_ids where key = 'entryRevisionId'),
  'revision',
  jsonb_build_array('/fields/' || (select value from s10_ids where key = 'typeFieldId')),
  repeat('a', 64), repeat('b', 64), repeat('c', 64), repeat('e', 64),
  'open', 1
from s10_ids ids_org
where ids_org.key = 'organization';

select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'creatorAuth'),
  (select value::uuid from s10_ids where key = 'organization')
);

create temp table s10_ddi_open_result on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_get_entry_draft('
    || quote_literal((select request::text from s10_ddi_request))
    || '::jsonb)'
) as response;

-- Exact safe shape: conflictId, version, conflictHash and nothing else.
select ok(
  (select jsonb_typeof(response->'openConflict') = 'object'
      and (select count(*) from jsonb_object_keys(response->'openConflict')) = 3
      and response->'openConflict' ?& array['conflictId', 'version', 'conflictHash']
   from s10_ddi_open_result),
  'CMS-03B-11 openConflict carries exactly conflictId, version and conflictHash'
);

-- The surfaced identity equals the durable open record, so a reader can bind
-- the CMS-03B-02 resolution target and its CAS version.
select ok(
  (select response->'openConflict'->>'conflictId' = conflict.id::text
      and response->'openConflict'->>'version' = conflict.version::text
      and response->'openConflict'->>'conflictHash' = conflict.conflict_hash::text
   from s10_ddi_open_result, platform_private.cms_conflict_records conflict
   where conflict.id = 'a9100000-0000-4000-8000-000000000401'),
  'CMS-03B-11 openConflict identity matches the durable open conflict record'
);

-- The conflict seam stays bounded: no proposed values, resolver or ownership.
select ok(
  (select (response->'openConflict')::text !~ 'proposedValues'
      and (response->'openConflict')::text !~ 'resolvedByPersonId'
      and (response->'openConflict')::text !~ 'ownerId'
   from s10_ddi_open_result),
  'CMS-03B-11 openConflict exposes no proposed values, resolver or owner'
);

-- Concealment boundary: an authenticated principal outside the owner tenant
-- still learns nothing, even while a conflict is open.
select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'strangerAuth'),
  (select value::uuid from s10_ids where key = 'organization')
);
select pg_temp.s10_rpc_call(
  'select platform_api.cms_get_entry_draft('
    || quote_literal((select request::text from s10_ddi_request))
    || '::jsonb)'
);
select is(
  pg_temp.s10_last_error_message(),
  'NOT_FOUND',
  'CMS-03B-11 non-member read still conceals the entry as NOT_FOUND'
);

rollback to savepoint s10_ddi_open_conflict;
release savepoint s10_ddi_open_conflict;

-- No-store: the identity read is side-effect free, emitting no audit or outbox.
select is(
  pg_temp.s10_audit_total() = (select audit_total from s10_ddi_effect_baseline)
    and pg_temp.s10_outbox_total() = (select outbox_total from s10_ddi_effect_baseline),
  true,
  'the draft-detail identity read emits no audit or outbox evidence'
);

select finish();
rollback;
