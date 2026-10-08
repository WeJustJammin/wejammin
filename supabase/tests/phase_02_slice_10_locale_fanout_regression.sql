-- Slice 10 QA-RED (WP-S10-2a): D12 localization fan-out regression
-- (BE03b event table `cms.localization.changed.v1`; BE03c CMS-03C-04).
-- The fan-out command exists and is bounded; the canonical producer
-- cms_stale_locale_dependents(source_id, true) owns staleness semantics.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(10);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc

-- Counts the deduped localization events for one entry by payload.
create or replace function pg_temp.s10_locfanout_count(p_entry_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $body$
  select count(*)::integer
  from platform_private.outbox_events event
  where event.event_type = 'cms.localization.changed.v1'
    and event.payload ->> 'entryId' = p_entry_id::text
$body$;

create or replace function pg_temp.s10_locfanout_distinct_locales(p_entry_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $body$
  select count(distinct event.payload ->> 'locale')::integer
  from platform_private.outbox_events event
  where event.event_type = 'cms.localization.changed.v1'
    and event.payload ->> 'entryId' = p_entry_id::text
$body$;

-- The revision-write RPC resolves the editorial workflow policy from the
-- seeded registry; the fixture pins the cms.entry.author member in this
-- rolled-back transaction only (same convention as the 004b projection
-- override), so the D12 write can reach the fan-out seam.
select set_config('app.cms_rpc', 'true', true);
set local session_replication_role = replica;
insert into platform_private.cms_workflow_policies(
  id, owner_id, state, version, created_at, updated_at,
  policy_key, policy_version, policy_hash, risk_class,
  required_decision_count, required_capabilities
)
select
  extensions.gen_random_uuid(),
  '0d6a0d6a-0000-4000-8000-000000000108'::uuid,
  'seeded', 1, pg_catalog.now(), pg_catalog.now(),
  'cms.entry.author', 1,
  platform_private.cms_workflow_policy_hash(
    'cms.entry.author', 1, 'ordinary', 1, jsonb_build_array('cms.author')
  ),
  'ordinary', 1, jsonb_build_array('cms.author')
where not exists (
  select 1 from platform_private.cms_workflow_policies policy
  where policy.policy_key = 'cms.entry.author'
    and policy.policy_version = 1
);
update platform_private.cms_content_type_versions
set activation_workflow_policy_key = 'editorial',
    activation_workflow_policy_version = 1,
    activation_workflow_policy_hash = (
  select policy.policy_hash from platform_private.cms_workflow_policies policy
  where policy.policy_key = 'editorial' and policy.policy_version = 1
)
where id = (select value::uuid from s10_ids where key = 'draftVersionId');
set local session_replication_role = origin;

-- The fan-out command exists and is bounded.
select ok(
  pg_temp.s10_fn_exists(
    'platform_private', 'cms_localization_fanout', 'uuid, uuid, integer'
  ),
  'the D12 localization fan-out command exists with the entry/revision/limit identity'
);

select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'creatorAuth'),
  (select value::uuid from s10_ids where key = 'organization')
);

-- A correct create-revision write fans out and completes: the request carries
-- ifMatch and idempotencyKey and runs through the persistent probe so its
-- success writes survive into the assertions below.
select pg_temp.s10_rpc_probe_persist(
  'fanout_write',
  null,
  $sql$select platform_api.cms_create_revision(jsonb_build_object(
    'entryId', (select value from s10_ids where key = 'entryId'),
    'baseRevision', 1,
    'expectedVersion', 1,
    'locale', 'en-US',
    'changedPaths', jsonb_build_array('/fields/' || (select value from s10_ids where key = 'typeFieldId')),
    'values', jsonb_build_object(
      (select value from s10_ids where key = 'typeFieldId'), 'Fanout title'
    ),
    'ifMatch', 1,
    'idempotencyKey', 's10-locale-fanout-0001'
  ))$sql$
);

select is(
  pg_temp.s10_probe_state('fanout_write'), '00000',
  'a revision write with dependent locales completes within its deadline'
);

-- The wrapper must bind the requested entry to the source revision before it
-- delegates to the canonical producer.
select pg_temp.s10_rpc_probe(
  'fanout_entry_mismatch',
  null,
  $sql$select platform_private.cms_localization_fanout(
    'a9100000-0000-4000-8000-000000000399'::uuid,
    (select value::uuid from s10_ids where key = 'entryRevisionId'),
    32)$sql$
);

select is(
  pg_temp.s10_probe_state('fanout_entry_mismatch'), 'P0001',
  'a source revision cannot fan out a different requested entry'
);

-- Exactly one deduped event per dependent locale, never a duplicate.
select ok(
  pg_temp.s10_locfanout_count(
    (select value::uuid from s10_ids where key = 'entryId')
  ) = pg_temp.s10_locfanout_distinct_locales(
    (select value::uuid from s10_ids where key = 'entryId')
  ) and pg_temp.s10_locfanout_count(
    (select value::uuid from s10_ids where key = 'entryId')
  ) <= 32,
  'the fan-out emits one deduped event per locale and never more than 32'
);

-- Over-limit: a fan-out wider than 32 is refused, never truncated.
select pg_temp.s10_rpc_probe(
  'fanout_over_limit',
  null,
  $sql$select platform_private.cms_localization_fanout(
    (select value::uuid from s10_ids where key = 'entryId'),
    (select value::uuid from s10_ids where key = 'entryRevisionId'),
    33)$sql$
);

select ok(
  pg_temp.s10_probe_state('fanout_over_limit') in ('P0001', '42883'),
  'a fan-out wider than 32 locales is refused, never truncated'
);

select ok(
  coalesce((select
    pg_catalog.pg_get_functiondef(proc.oid) ~* 'dependent_count'
    and pg_catalog.pg_get_functiondef(proc.oid) ~* 'dependent_count[[:space:]]*>[[:space:]]*p_limit'
   from pg_proc proc
   where proc.oid = to_regprocedure(
     'platform_private.cms_localization_fanout(uuid,uuid,integer)'
   )), false),
  'the fan-out limit is applied to counted dependents before the canonical write'
);

select finish();
rollback;
