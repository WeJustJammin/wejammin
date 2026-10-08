-- Slice 10 gap resolution (P2-S10-AC-002/AC-056, audit WP-A3, lane D unresolved):
-- CMS-03B-04 restore re-fetches the editorial workflow-policy evidence.
--
-- BE03b:546: "every key, version, policyHash, requiredCapabilities, decision
-- count, risk class, and approvalEvidenceHash is re-fetched and compared before
-- save, review, restore, preview, schedule execution, and publication".
-- cms_create_revision re-fetches it; restore did not.  cms_restore_revision now
-- requires platform_private.cms_editorial_workflow_policy_valid (the validation
-- append shares): an absent projection (no owner-approved policy) or a malformed
-- one is DEPENDENCY_UNAVAILABLE and nothing, including the idempotency
-- reservation, is committed.  A valid projection restores.
--
-- The projection is bound the way the 004b revision-write, presence and gallery
-- suites bind it: a transaction-local definer function (never an approved
-- production policy) whose answer this file switches per probe through the
-- app.s10_policy_mode setting.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc

select pg_temp.s10_rpc_as(
  'a9100000-0000-4000-8000-000000000001'::uuid,
  (select value::uuid from s10_ids where key = 'organization')
);

create or replace function pg_temp.s10p_counts()
returns text
language sql
stable
as $body$
  select (select count(*) from platform_private.cms_content_entries)::text || '/'
      || (select count(*) from platform_private.cms_entry_revisions)::text || '/'
      || (select count(*) from platform_private.cms_entry_field_values)::text || '/'
      || (select count(*) from platform_private.cms_entry_relations)::text || '/'
      || (select count(*) from platform_private.cms_restore_chain_manifests)::text || '/'
      || (select count(*) from platform_private.idempotency_records)::text || '/'
      || (select count(*) from platform_private.outbox_events)::text || '/'
      || (select count(*) from audit_private.audit_events)::text
$body$;

create or replace function pg_temp.s10p_restore_sql(p_key text)
returns text
language sql
stable
as $body$
  select 'select platform_api.cms_restore_revision(jsonb_build_object('
    || '''entryId'', ' || quote_literal((select value from s10_ids where key = 'entryId')) || ','
    || '''revisionId'', ' || quote_literal((select value from s10_ids where key = 'entryRevisionId')) || ','
    || '''migrationChainId'', platform_private.cms_restore_chain_manifest_id('
    ||   'platform_private.cms_restore_chain_derive('
    ||     quote_literal((select value from s10_ids where key = 'typeId')) || '::uuid,'
    ||     quote_literal((select value from s10_ids where key = 'draftVersionId')) || '::uuid,'
    ||     quote_literal((select value from s10_ids where key = 'draftVersionId')) || '::uuid'
    ||   ')->>''hash'')::text,'
    || '''expectedVersion'', ' || quote_literal((select entry_row.version::text
         from platform_private.cms_content_entries entry_row
         where entry_row.id = (select value::uuid from s10_ids where key = 'entryId'))) || ','
    || '''idempotencyKey'', ' || quote_literal(p_key) || '))'
$body$;

-- The transaction-local policy projection.  Each mode answers a complete or
-- deliberately broken seven-key evidence for any version.
create or replace function platform_private.cms_editorial_workflow_policy_evidence(p_version_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $body$
  with base as (
    select jsonb_build_object(
      'key', 'editorial', 'version', '1',
      'policyHash', repeat('c', 64), 'riskClass', 'ordinary',
      'requiredDecisionCount', 1,
      'requiredCapabilities', jsonb_build_array('cms.author'),
      'approvalEvidenceHash', repeat('d', 64)
    ) as evidence
  )
  select case coalesce(pg_catalog.current_setting('app.s10_policy_mode', true), 'valid')
    when 'valid' then base.evidence
    when 'absent' then null
    when 'missing_key' then base.evidence - 'key'
    when 'extra_key' then base.evidence || '{"extra":true}'::jsonb
    when 'bad_risk' then base.evidence || '{"riskClass":"extreme"}'::jsonb
    when 'decisions_over' then base.evidence || '{"requiredDecisionCount":9}'::jsonb
    when 'protected_single' then base.evidence || '{"riskClass":"protected"}'::jsonb
    when 'unregistered_capability' then base.evidence
      || jsonb_build_object('requiredCapabilities', jsonb_build_array('cms.not_registered'))
    when 'bad_policy_hash' then base.evidence || jsonb_build_object('policyHash', 'XYZ')
    when 'bad_version' then base.evidence || '{"version":"0x1"}'::jsonb
  end
  from base
  where p_version_id is not null
$body$;

-- ---------------------------------------------------------------------------
-- The projection is absent or malformed: restore is a dependency outage and
-- commits nothing.
-- ---------------------------------------------------------------------------
create temp table s10p_before on commit drop as select pg_temp.s10p_counts() as counts;

select pg_temp.s10_rpc_probe_persist(
  'restore_' || c.mode, null, pg_temp.s10p_restore_sql('s10-restore-policy-' || lpad(c.n::text, 4, '0')))
from (values
  (1, 'absent'), (2, 'missing_key'), (3, 'extra_key'), (4, 'bad_risk'),
  (5, 'decisions_over'), (6, 'protected_single'), (7, 'unregistered_capability'),
  (8, 'bad_policy_hash'), (9, 'bad_version')
) c(n, mode)
where set_config('app.s10_policy_mode', c.mode, true) is not null;

select is(pg_temp.s10_probe_message('restore_' || mode), 'DEPENDENCY_UNAVAILABLE',
  'restore with ' || mode || ' editorial policy evidence is DEPENDENCY_UNAVAILABLE [BE03b:546]')
from unnest(array['absent', 'missing_key', 'extra_key', 'bad_risk', 'decisions_over',
  'protected_single', 'unregistered_capability', 'bad_policy_hash', 'bad_version']) mode;
select is(pg_temp.s10p_counts(), (select counts from s10p_before),
  'a refused restore committed no entry, revision, value, relation, manifest, reservation, outbox or audit row');

-- ---------------------------------------------------------------------------
-- A complete projection restores.
-- ---------------------------------------------------------------------------
select set_config('app.s10_policy_mode', 'valid', true);
create temp table s10p_restored on commit drop as
select pg_temp.s10_rpc_exec(pg_temp.s10p_restore_sql('s10-restore-policy-1001')) as response;
select is(pg_temp.s10_last_error_message(), null::text,
  'restore proceeds once the editorial workflow-policy evidence is complete [BE03b:546]');
select is(
  (select response->'resource'->>'state' from s10p_restored), 'draft',
  'the restore returns a new draft revision');
select is(
  (select count(*)::integer from platform_private.cms_entry_revisions revision
   where revision.entry_id = (select value::uuid from s10_ids where key = 'entryId')),
  2, 'exactly one revision was appended by the restore');

-- The predicate is private and definer-owned.
select ok(
  pg_temp.s10_fn_exists('platform_private', 'cms_editorial_workflow_policy_valid', 'uuid')
    and pg_temp.s10_no_execute_for('platform_private', 'cms_editorial_workflow_policy_valid', 'authenticated')
    and pg_temp.s10_no_execute_for('platform_private', 'cms_editorial_workflow_policy_valid', 'anon')
    and pg_temp.s10_no_execute_for('platform_private', 'cms_editorial_workflow_policy_valid', 'service_role'),
  'cms_editorial_workflow_policy_valid is private: no API role may execute it');

select * from finish();
rollback;
