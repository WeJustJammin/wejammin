commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 DEC-119/DEC-120 QA-RED (BE03a "Persistence", "Database invariants
-- and grants"): the private CapabilityGrant aggregate and its append-only
-- event table, the closed grantable registry, the owner-initialization
-- backfill and the four service-role-only RPC wrappers.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc

select has_table('platform_private', t, 'DEC-119 private table ' || t || ' exists')
from unnest(array['cms_capability_grants', 'cms_capability_grant_events']) t;
select ok(pg_temp.s09d_rls(t), t || ' has ENABLE and FORCE row level security')
from unnest(array['cms_capability_grants', 'cms_capability_grant_events']) t;
select ok(pg_temp.s09d_no_direct_grants(t), t || ' has no direct grant for anon, authenticated or service_role')
from unnest(array['cms_capability_grants', 'cms_capability_grant_events']) t;
select ok(pg_temp.s09d_has_columns('cms_capability_grants', array['id', 'owner_id', 'state', 'version',
  'created_at', 'updated_at', 'subject_person_ref', 'capability_code', 'valid_from', 'valid_through',
  'grantor_person_ref', 'last_action', 'reason']), 'cms_capability_grants carries the typed aggregate columns');
select ok(pg_temp.s09d_has_columns('cms_capability_grant_events', array['id', 'owner_id', 'state', 'version',
  'created_at', 'updated_at', 'grant_id', 'aggregate_version', 'action', 'subject_person_ref',
  'capability_code', 'grantor_person_ref', 'valid_from', 'valid_through', 'prior_valid_through', 'reason',
  'binding_context_hash', 'mfa_verified_at']), 'cms_capability_grant_events carries the typed event columns');
select ok(pg_temp.s09d_constraint_has('cms_capability_grants', 'valid_through - valid_from) <= 89'),
  'the aggregate term CHECK allows at most 90 UTC days (valid_through - valid_from <= 89, DEC-120)');
select ok(pg_temp.s09d_constraint_has('cms_capability_grants', 'last_action'),
  'the aggregate ties state revoked to last_action revoked');
select ok(exists (select 1 from pg_constraint
    where conrelid = to_regclass('platform_private.cms_capability_grants') and contype = 'u'
      and pg_get_constraintdef(oid) like '%owner_id, subject_person_ref, capability_code%'),
  'UNIQUE(owner_id, subject_person_ref, capability_code)');
select ok(pg_temp.s09d_constraint_has('cms_capability_grant_events', 'aggregate_version'),
  'UNIQUE(grant_id, aggregate_version) keys the append-only history');
select ok(pg_temp.s09d_trigger_count('cms_capability_grants') >= 2
  and pg_temp.s09d_trigger_count('cms_capability_grant_events') >= 2,
  'both tables carry a write guard and a state/immutability guard');

-- Named RPCs: service-role-only wrappers, ungranted private commands.
select ok(pg_temp.s09d_service_only(f), f || ' is executable by service_role only')
from unnest(array['platform_api.cms_grant_capability(jsonb)', 'platform_api.cms_renew_capability_grant(jsonb)',
  'platform_api.cms_revoke_capability_grant(jsonb)', 'platform_api.cms_list_capability_grants(jsonb)']) f;
select ok(to_regprocedure(f) is not null and not has_function_privilege('service_role', to_regprocedure(f), 'execute'),
  f || ' is not directly executable by any role')
from unnest(array['platform_private.cms_grant_capability(jsonb)', 'platform_private.cms_renew_capability_grant(jsonb)',
  'platform_private.cms_revoke_capability_grant(jsonb)', 'platform_private.cms_list_capability_grants(jsonb)']) f;

-- The closed grantable registry is code-owned and a subset of the platform registry.
select is((select count(*)::integer from unnest(array['cms.schema_registry.read', 'cms.schema_designer',
  'cms.template_designer', 'cms.taxonomy_curator', 'cms.author', 'cms.editor', 'cms.reviewer',
  'cms.reviewer.policy', 'cms.reviewer.legal', 'cms.reviewer.security', 'cms.reviewer.financial',
  'cms.publisher', 'cms.navigation_editor', 'cms.media_contributor', 'cms.media_curator']) c
  where coalesce(pg_temp.s09d_scalar(format(
    'select platform_private.cms_grantable_capability(%L)::text', c)), 'f') = 'true'), 15,
  'all fifteen GrantableCmsCapability members are grantable');
select is((select count(*)::integer from unnest(array['cms.schema_review', 'cms.schema_review.assign',
  'cms.delivery_review', 'cms.delivery_review.assign', 'cms.public_content.read', 'admin.inbox.read',
  'admin.audit.read', 'cms.*', 'cms.unregistered']) c
  where coalesce(pg_temp.s09d_scalar(format(
    'select platform_private.cms_grantable_capability(%L)::text', c)), 'missing') = 'false'), 9,
  'assignment-only, owner-only, read-only, admin, wildcard and unregistered keys are not grantable');
select is((select count(*)::integer from unnest(array['cms.navigation_editor', 'cms.media_contributor',
  'cms.media_curator']) c where platform_private.cms_capability_registry_valid(c, 1)), 3,
  'the navigation and media members are added to the platform capability registry');
select is((select count(*)::integer from unnest(array['cms.schema_registry.read', 'cms.schema_designer',
  'cms.template_designer', 'cms.taxonomy_curator', 'cms.author', 'cms.editor', 'cms.reviewer',
  'cms.reviewer.policy', 'cms.reviewer.legal', 'cms.reviewer.security', 'cms.reviewer.financial',
  'cms.publisher', 'cms.navigation_editor', 'cms.media_contributor', 'cms.media_curator']) c
  where platform_private.cms_capability_registry_valid(c, 1)), 15,
  'every grantable member is a platform capability registry member');

-- Backfill: the owner-initialization grants are listable and renewable aggregates.
select is(pg_temp.s09d_scalar(format(
  'select count(*)::text from platform_private.cms_capability_grants g
    where g.owner_id = %L and g.subject_person_ref = %L
      and g.capability_code in (''cms.schema_registry.read'', ''cms.schema_designer'')
      and g.version = 1 and g.last_action = ''granted'' and g.state = ''active''
      and g.grantor_person_ref = %L',
  pg_temp.s09d_id('ownerOrg'), pg_temp.s09d_actor_id('owner', 'person'), pg_temp.s09d_actor_id('owner', 'person'))), '2',
  'initialize_cms_owner leaves one version-1 granted aggregate per grantable owner capability');
select is(pg_temp.s09d_scalar('select count(*)::text from platform_private.cms_capability_grants g
  where g.capability_code like ''admin.%'''), '0', 'admin capabilities are never aggregated');
select ok(coalesce(pg_temp.s09d_scalar('select (not exists (
  select 1 from platform_private.cms_capability_grants g
  join identity_private.organization_actor_grant a
    on a.organization_id = g.owner_id and a.person_id = g.subject_person_ref
   and a.capability_code = g.capability_code
  where g.valid_from is distinct from a.valid_from or g.valid_through is distinct from a.valid_through)
  and exists (select 1 from platform_private.cms_capability_grants))::text'), 'false') = 'true',
  'a backfilled aggregate mirrors its actor-grant projection term exactly');

-- Direct writes, deletes and identity changes are rejected.  The RPC context flag
-- a previous command left behind is cleared first.
select set_config('app.cms_rpc', '', true);
select ok(to_regclass('platform_private.cms_capability_grants') is not null and not pg_temp.s09d_try(format(
  'insert into platform_private.cms_capability_grants(owner_id, state, subject_person_ref, capability_code, '
  || 'valid_from, valid_through, grantor_person_ref, last_action) values (%L, ''active'', %L, ''cms.author'', '
  || 'current_date, current_date, %L, ''granted'')',
  pg_temp.s09d_id('ownerOrg'), pg_temp.s09d_actor_id('rev1', 'person'), pg_temp.s09d_actor_id('owner', 'person'))),
  'a direct INSERT outside the RPC context is rejected');
select ok(pg_temp.s09d_scalar('select count(*)::text from platform_private.cms_capability_grants') = '3'
  and not pg_temp.s09d_try(format('select set_config(''app.cms_rpc'', ''true'', true); delete from platform_private.cms_capability_grants where owner_id = %L',
  pg_temp.s09d_id('ownerOrg'))), 'DELETE of an aggregate is rejected even inside the RPC context');
select ok(to_regclass('platform_private.cms_capability_grants') is not null and not pg_temp.s09d_try(format('select set_config(''app.cms_rpc'', ''true'', true); update platform_private.cms_capability_grants set capability_code = ''cms.author'' where owner_id = %L',
  pg_temp.s09d_id('ownerOrg'))), 'the capability of an aggregate is immutable');
select ok(to_regclass('platform_private.cms_capability_grants') is not null and not pg_temp.s09d_try(format('select set_config(''app.cms_rpc'', ''true'', true); update platform_private.cms_capability_grants set subject_person_ref = %L where owner_id = %L',
  pg_temp.s09d_actor_id('rev1', 'person'), pg_temp.s09d_id('ownerOrg'))), 'the subject of an aggregate is immutable');
select set_config('app.cms_rpc', '', true);

select * from finish();
rollback;
