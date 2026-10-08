-- Slice 10 round 2 (Codex SQL review 3 findings 1 and 2): the catalog guard of the ONE
-- lock order shared by the entry/revision writers, both schema activation commands and
-- authority revocation (migrations 20261005013000 and 20261005013100).
--
-- The behavior is proven across real sessions by the race runners
-- supabase/tests/phase_02_slice_10_races/010-activation-serialization.mjs (writers x
-- human and Worker activation, defense in depth) and 014-revocation-vs-activation.mjs
-- (CMS-03A-17 revocation and tenure end x both activations).  A single-transaction pgTAP
-- file cannot interleave two sessions, so this suite pins the structure those proofs
-- depend on, so a later redefinition of one command cannot silently restore the old
-- order:
--   * the activation commands lock the authority rows BEFORE the candidate row;
--   * the invalidation trigger function locks the candidate BEFORE its reviews;
--   * the two lock steps are definer functions with a fixed search_path, owner
--     wejammin_cms_definer and no execute grant to a browser or service role;
--   * every command wrapper that must not leak SQLSTATE 40P01 answers a deadlock with
--     the typed retryable CONFLICT.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(38);

create or replace function pg_temp.s10l_def(p_signature text)
returns text
language sql
stable
as $body$
  select coalesce(pg_catalog.pg_get_functiondef(to_regprocedure(p_signature)), '')
$body$;

create or replace function pg_temp.s10l_pos(p_signature text, p_needle text)
returns integer
language sql
stable
as $body$
  select pg_catalog.strpos(pg_temp.s10l_def(p_signature), p_needle)
$body$;

-- ------------------------------------------------------------ definer discipline ----
select ok(
  to_regprocedure('platform_private.cms_lock_activation_identity_authority(uuid,uuid,uuid)') is not null
    and to_regprocedure('platform_private.cms_lock_activation_review_rows(uuid)') is not null
    and to_regprocedure('platform_private.cms_lock_activation_authority(uuid,uuid,uuid)') is not null,
  'the identity-authority step, the review-rows step and their composite exist');

select is(
  (select count(*)::integer
     from pg_proc proc
     join pg_roles owner_role on owner_role.oid = proc.proowner
    where proc.oid in (
      to_regprocedure('platform_private.cms_lock_activation_identity_authority(uuid,uuid,uuid)'),
      to_regprocedure('platform_private.cms_lock_activation_review_rows(uuid)'),
      to_regprocedure('platform_private.cms_lock_activation_authority(uuid,uuid,uuid)'))
      and proc.prosecdef
      and owner_role.rolname = 'wejammin_cms_definer'
      and proc.proconfig @> array['search_path=""']),
  3,
  'all three lock steps are SECURITY DEFINER, owned by wejammin_cms_definer, with an empty search_path');

select ok(
  not exists (
    select 1
      from unnest(array['anon', 'authenticated', 'service_role']) as role_name(role_name)
      cross join unnest(array[
        'platform_private.cms_lock_activation_identity_authority(uuid,uuid,uuid)',
        'platform_private.cms_lock_activation_review_rows(uuid)',
        'platform_private.cms_lock_activation_authority(uuid,uuid,uuid)']) as fn(signature)
     where has_function_privilege(role_name.role_name, to_regprocedure(fn.signature), 'execute')),
  'no browser or service role can execute a lock step directly');

-- ------------------------------------------------------------------ the order ----
select ok(
  pg_temp.s10l_pos('platform_private.cms_lock_activation_authority(uuid,uuid,uuid)', 'cms_lock_activation_identity_authority(') > 0
    and pg_temp.s10l_pos('platform_private.cms_lock_activation_authority(uuid,uuid,uuid)', 'cms_lock_activation_identity_authority(')
      < pg_temp.s10l_pos('platform_private.cms_lock_activation_authority(uuid,uuid,uuid)', 'cms_lock_activation_review_rows('),
  'the composite locks the identity authority rows, then the review rows');

select ok(
  pg_temp.s10l_pos('platform_private.cms_lock_activation_identity_authority(uuid,uuid,uuid)', 'acting_context_binding') > 0
    and pg_temp.s10l_pos('platform_private.cms_lock_activation_identity_authority(uuid,uuid,uuid)', 'acting_context_binding')
      < pg_temp.s10l_pos('platform_private.cms_lock_activation_identity_authority(uuid,uuid,uuid)', 'membership_tenure')
    and pg_temp.s10l_pos('platform_private.cms_lock_activation_identity_authority(uuid,uuid,uuid)', 'membership_tenure')
      < pg_temp.s10l_pos('platform_private.cms_lock_activation_identity_authority(uuid,uuid,uuid)', 'organization_actor_grant'),
  'the identity step locks the acting-context binding, then every tenure, then every actor grant');

select ok(
  pg_temp.s10l_pos('platform_private.cms_lock_activation_review_rows(uuid)', 'cms_schema_reviews') > 0
    and pg_temp.s10l_pos('platform_private.cms_lock_activation_review_rows(uuid)', 'cms_schema_reviews')
      < pg_temp.s10l_pos('platform_private.cms_lock_activation_review_rows(uuid)', 'cms_schema_review_assignments'),
  'the review step locks the reviews, then their reviewer assignments');

select ok(
  pg_temp.s10l_pos('platform_private.cms_activate_schema(jsonb)', 'cms_lock_activation_identity_authority(') > 0
    and pg_temp.s10l_pos('platform_private.cms_activate_schema(jsonb)', 'cms_lock_activation_identity_authority(')
      < pg_temp.s10l_pos('platform_private.cms_activate_schema(jsonb)', 'cms_lock_activation_graph('),
  'the human switch locks the identity authority rows before the candidate and its dependency graph');

select ok(
  pg_temp.s10l_pos('platform_private.cms_activate_schema(jsonb)', 'cms_lock_activation_identity_authority(')
      < pg_temp.s10l_pos('platform_private.cms_activate_schema(jsonb)', 'into candidate from platform_private.cms_content_type_versions'),
  'the human switch reads and locks its candidate row only after the identity authority rows');

select is(
  (select count(*)::integer
     from regexp_matches(pg_temp.s10l_def('platform_private.cms_activate_schema(jsonb)'),
                         'cms_require_capability\(actor_id, acting_party_id, ''cms.schema_designer''\)', 'g')),
  2,
  'the human switch proves the activator''s capability before AND again under the authority locks');

select ok(
  pg_temp.s10l_pos('platform_private.cms_activate_schema(jsonb)', 'cms_lock_activation_review_rows(candidate.id)') >
    pg_temp.s10l_pos('platform_private.cms_activate_schema(jsonb)', 'cms_lock_activation_graph('),
  'the human switch locks the review rows after the candidate, graph and active version');

-- round 5 (Codex final review): no late authority rescan
select is(
  (select count(*)::integer
     from regexp_matches(pg_temp.s10l_def('platform_private.cms_activate_schema(jsonb)'),
                         'cms_lock_activation_authority\(', 'g')),
  0,
  'round 5: the human switch no longer calls the legacy composite, which rescanned the authority rows after the candidate');
select is(
  (select count(*)::integer
     from regexp_matches(pg_temp.s10l_def('platform_private.cms_activate_schema(jsonb)'),
                         'cms_lock_activation_identity_authority\(', 'g')),
  1,
  'round 5: the human switch scans the identity authority rows exactly once, before its candidate');
select ok(
  pg_temp.s10l_pos('platform_private.cms_worker_activate_schema(jsonb)', 'cms_worker_human_approval_evidence_valid(') > 0
    and pg_temp.s10l_pos('platform_private.cms_worker_activate_schema(jsonb)', 'cms_worker_human_approval_valid(') = 0,
  'round 5: the Worker switch rechecks the approval through the evidence helper that holds nothing earlier in the order');
select ok(
  pg_temp.s10l_pos('platform_private.cms_worker_human_approval_evidence_valid(uuid)', 'cms_lock_activation_review_rows(') > 0
    and pg_temp.s10l_pos('platform_private.cms_worker_human_approval_evidence_valid(uuid)', 'cms_lock_activation_identity_authority(') = 0
    and pg_temp.s10l_pos('platform_private.cms_worker_human_approval_evidence_valid(uuid)', 'cms_lock_activation_graph(') = 0
    and pg_temp.s10l_pos('platform_private.cms_worker_human_approval_evidence_valid(uuid)', ' for update') = 0
    and pg_temp.s10l_pos('platform_private.cms_worker_human_approval_evidence_valid(uuid)', 'cms_lock_activation_review_rows(')
      < pg_temp.s10l_pos('platform_private.cms_worker_human_approval_evidence_valid(uuid)', 'cms_resolve_activation_review('),
  'round 5: the evidence recheck locks only the review rows (no identity, candidate or graph lock) and then rechecks');
select ok(
  to_regprocedure('platform_private.cms_worker_human_approval_evidence_valid(uuid)') is not null
    and (select proc.prosecdef and owner_role.rolname = 'wejammin_cms_definer'
                and proc.proconfig @> array['search_path=""']
           from pg_proc proc join pg_roles owner_role on owner_role.oid = proc.proowner
          where proc.oid = to_regprocedure('platform_private.cms_worker_human_approval_evidence_valid(uuid)'))
    and not exists (
      select 1 from unnest(array['anon', 'authenticated', 'service_role']) as role_name(role_name)
       where has_function_privilege(role_name.role_name,
         to_regprocedure('platform_private.cms_worker_human_approval_evidence_valid(uuid)'), 'execute')),
  'round 5: the evidence recheck is a definer function owned by wejammin_cms_definer that no browser or service role can execute');

select ok(
  pg_temp.s10l_pos('platform_private.cms_worker_activate_schema(jsonb)', 'cms_lock_activation_identity_authority(') > 0
    and pg_temp.s10l_pos('platform_private.cms_worker_activate_schema(jsonb)', 'cms_lock_activation_identity_authority(')
      < pg_temp.s10l_pos('platform_private.cms_worker_activate_schema(jsonb)', 'cms_lock_activation_graph(')
    and pg_temp.s10l_pos('platform_private.cms_worker_activate_schema(jsonb)', 'cms_lock_activation_identity_authority(')
      < pg_temp.s10l_pos('platform_private.cms_worker_activate_schema(jsonb)', 'into candidate'),
  'the Worker switch locks the identity authority rows before the candidate row and its graph');

select ok(
  pg_temp.s10l_pos('platform_private.cms_worker_activate_schema(jsonb)', 'early_version.state <>') > 0,
  'the Worker switch takes no authority lock for an already-active candidate (a replay)');

select ok(
  pg_temp.s10l_pos('platform_private.cms_worker_human_approval_valid(uuid)', 'cms_lock_activation_identity_authority(') > 0
    and pg_temp.s10l_pos('platform_private.cms_worker_human_approval_valid(uuid)', 'cms_lock_activation_identity_authority(')
      < pg_temp.s10l_pos('platform_private.cms_worker_human_approval_valid(uuid)', 'for update')
    and pg_temp.s10l_pos('platform_private.cms_worker_human_approval_valid(uuid)', 'for update')
      < pg_temp.s10l_pos('platform_private.cms_worker_human_approval_valid(uuid)', 'cms_lock_activation_graph(')
    and pg_temp.s10l_pos('platform_private.cms_worker_human_approval_valid(uuid)', 'cms_lock_activation_graph(')
      < pg_temp.s10l_pos('platform_private.cms_worker_human_approval_valid(uuid)', 'cms_worker_human_approval_evidence_valid('),
  'the standalone approval recheck locks identity authority, then the candidate, then the graph, then delegates (review rows last)');

select ok(
  pg_temp.s10l_pos('platform_private.cms_worker_human_approval_valid(uuid)', 'when deadlock_detected') > 0
    and pg_temp.s10l_pos('platform_private.cms_worker_human_approval_valid(uuid)', 'sqlerrm = ''CONFLICT''') > 0,
  'the approval recheck reports a lock failure as CONFLICT, never as "not approved"');

select ok(
  pg_temp.s10l_pos('platform_private.cms_invalidate_activation_reviews(uuid)', 'for update;') > 0
    and pg_temp.s10l_pos('platform_private.cms_invalidate_activation_reviews(uuid)', 'for update;')
      < pg_temp.s10l_pos('platform_private.cms_invalidate_activation_reviews(uuid)', 'locked_reviews as materialized'),
  'the revocation invalidation locks the CANDIDATE before its reviews');

-- ----------------------------------------------------- behavior without a session race ----
select is(
  platform_private.cms_invalidate_activation_reviews('00000000-0000-4000-8000-0000000000aa'::uuid),
  0,
  'invalidating an unknown candidate locks nothing and answers 0');

select is(
  platform_private.cms_worker_human_approval_valid('00000000-0000-4000-8000-0000000000aa'::uuid),
  false,
  'the approval recheck of an unknown candidate is "not approved"');

select lives_ok(
  $$select platform_private.cms_lock_activation_identity_authority(
      '00000000-0000-4000-8000-0000000000bb'::uuid, '00000000-0000-4000-8000-0000000000cc'::uuid, null)$$,
  'the identity step tolerates an owner with no rows and an actor with no person');

select lives_ok(
  $$select platform_private.cms_lock_activation_identity_authority(null, null, null)$$,
  'the identity step answers a null owner without locking');

select lives_ok(
  $$select platform_private.cms_lock_activation_authority('00000000-0000-4000-8000-0000000000aa'::uuid, null, null)$$,
  'the composite answers an unknown candidate without locking');

-- --------------------------------------------------------------- typed deadlock ----
select is(
  (select count(*)::integer
     from unnest(array[
       'platform_api.cms_create_entry(jsonb)',
       'platform_api.cms_create_revision(jsonb)',
       'platform_api.cms_resolve_conflict(jsonb)',
       'platform_api.cms_restore_revision(jsonb)',
       'platform_api.cms_activate_schema(jsonb)',
       'platform_api.cms_activate_schema_migration(jsonb)',
       'platform_api.cms_revoke_capability_grant(jsonb)']) as wrapper(signature)
    where pg_temp.s10l_def(wrapper.signature) ~ 'when deadlock_detected then\s+raise exception ''CONFLICT'' using errcode = ''P0001'''),
  7,
  'the four writers, both activation commands and the revocation answer a deadlock with the typed retryable CONFLICT');

select is(
  (select count(*)::integer
     from unnest(array[
       'platform_api.cms_create_entry(jsonb)',
       'platform_api.cms_create_revision(jsonb)',
       'platform_api.cms_resolve_conflict(jsonb)',
       'platform_api.cms_restore_revision(jsonb)',
       'platform_api.cms_activate_schema(jsonb)',
       'platform_api.cms_activate_schema_migration(jsonb)',
       'platform_api.cms_revoke_capability_grant(jsonb)']) as wrapper(signature)
    where pg_temp.s10l_def(wrapper.signature) ~ 'rpc_previous'
      and pg_temp.s10l_def(wrapper.signature) ~ 'set_config\(''app.cms_rpc'', rpc_previous, true\)'),
  7,
  'each wrapper still restores the RPC flag it found');

select is(
  (select count(*)::integer
     from pg_proc proc
     join pg_roles owner_role on owner_role.oid = proc.proowner
    where proc.oid = any(array[
       to_regprocedure('platform_api.cms_create_entry(jsonb)'),
       to_regprocedure('platform_api.cms_create_revision(jsonb)'),
       to_regprocedure('platform_api.cms_resolve_conflict(jsonb)'),
       to_regprocedure('platform_api.cms_restore_revision(jsonb)'),
       to_regprocedure('platform_api.cms_activate_schema(jsonb)'),
       to_regprocedure('platform_api.cms_activate_schema_migration(jsonb)'),
       to_regprocedure('platform_api.cms_revoke_capability_grant(jsonb)')])
      and proc.prosecdef and proc.proconfig @> array['search_path=""']),
  7,
  'the redefined wrappers keep SECURITY DEFINER and the empty search_path');

select ok(
  has_function_privilege('service_role', to_regprocedure('platform_api.cms_create_entry(jsonb)'), 'execute')
    and has_function_privilege('service_role', to_regprocedure('platform_api.cms_activate_schema(jsonb)'), 'execute')
    and has_function_privilege('service_role', to_regprocedure('platform_api.cms_activate_schema_migration(jsonb)'), 'execute')
    and not has_function_privilege('anon', to_regprocedure('platform_api.cms_create_entry(jsonb)'), 'execute')
    and not has_function_privilege('anon', to_regprocedure('platform_api.cms_activate_schema(jsonb)'), 'execute'),
  'the wrappers keep their grants: service role only, never anon');

-- A deadlock that survives the order is a raw 40P01 inside the private function and the
-- typed CONFLICT at the API: both ends are proven in the race runner (010, S4); here the
-- handler's presence in the body that wraps the private call is pinned.
select ok(
  pg_temp.s10l_pos('platform_api.cms_create_revision(jsonb)', 'rpc_result := platform_private.cms_create_revision(p_request)')
    < pg_temp.s10l_pos('platform_api.cms_create_revision(jsonb)', 'when deadlock_detected'),
  'the deadlock handler wraps the private command call');

select ok(
  pg_temp.s10l_pos('platform_private.cms_lock_activation_identity_authority(uuid,uuid,uuid)', 'when deadlock_detected') > 0
    and pg_temp.s10l_pos('platform_private.cms_lock_activation_review_rows(uuid)', 'when deadlock_detected') > 0,
  'both lock steps convert a deadlock into the typed retryable CONFLICT');

select ok(
  pg_temp.s10l_pos('platform_private.cms_lock_activation_identity_authority(uuid,uuid,uuid)', 'order by tenure.id') > 0
    and pg_temp.s10l_pos('platform_private.cms_lock_activation_identity_authority(uuid,uuid,uuid)', 'order by actor_grant.organization_id') > 0,
  'tenure and grant rows are locked in a deterministic key order');

select ok(
  pg_temp.s10l_pos('platform_private.cms_list_entries(jsonb)', 'cms_entry_list_epoch(') > 0,
  'guard: the list reader carries the collection epoch (round 2 item 3 migration is in the chain)');

select ok(
  (select count(*) from pg_trigger
    where tgrelid = 'identity_private.organization_actor_grant'::regclass
      and tgname = 'cms_organization_actor_grant_activation_review_invalidation') = 1
    and (select count(*) from pg_trigger
          where tgrelid = 'identity_private.membership_tenure'::regclass
            and tgname = 'cms_membership_tenure_activation_review_invalidation') = 1,
  'the grant and tenure invalidation triggers whose order this suite protects exist');

select ok(
  (select count(*) from pg_proc proc
    join pg_namespace ns on ns.oid = proc.pronamespace
   where ns.nspname = 'platform_private'
     and proc.proname in ('cms_lock_activation_identity_authority', 'cms_lock_activation_review_rows',
                          'cms_lock_activation_authority')) = 3,
  'exactly one definition of each lock step exists (no overload can shadow the order)');

-- ---------------------------------------------------- writers: no late authority rescan ----
select ok(
  pg_temp.s10l_pos('platform_private.cms_lock_relation_target(uuid,uuid,uuid)', 'cms_lock_entry_assignments_shared(') > 0
    and pg_temp.s10l_pos('platform_private.cms_lock_relation_target(uuid,uuid,uuid)', 'cms_lock_entry_authority(') = 0
    and pg_temp.s10l_pos('platform_private.cms_lock_relation_target(uuid,uuid,uuid)', 'membership_tenure') = 0
    and pg_temp.s10l_pos('platform_private.cms_lock_relation_target(uuid,uuid,uuid)', 'organization_actor_grant') = 0,
  'round 5: the relation-target lock takes the target entry and the caller''s assignments over it, and never rescans the caller''s person, tenure or grant rows after the active version');
select ok(
  pg_temp.s10l_pos('platform_private.cms_lock_entry_authority(uuid,uuid,uuid)', 'cms_lock_entry_assignments_shared(') > 0
    and pg_temp.s10l_pos('platform_private.cms_lock_entry_authority(uuid,uuid,uuid)', 'organization_actor_grant')
      < pg_temp.s10l_pos('platform_private.cms_lock_entry_authority(uuid,uuid,uuid)', 'cms_lock_entry_assignments_shared('),
  'round 5: the start-of-command authority lock still takes person, tenure, grants and then the assignments (now through the shared step)');
select ok(
  (select proc.prosecdef and owner_role.rolname = 'wejammin_cms_definer'
          and proc.proconfig @> array['search_path=""']
     from pg_proc proc join pg_roles owner_role on owner_role.oid = proc.proowner
    where proc.oid = to_regprocedure('platform_private.cms_lock_entry_assignments_shared(uuid,uuid,uuid)'))
    and not exists (
      select 1 from unnest(array['anon', 'authenticated', 'service_role']) as role_name(role_name)
       where has_function_privilege(role_name.role_name,
         to_regprocedure('platform_private.cms_lock_entry_assignments_shared(uuid,uuid,uuid)'), 'execute')),
  'round 5: the assignment step is a definer function owned by wejammin_cms_definer that no browser or service role can execute');

select * from finish();
rollback;
