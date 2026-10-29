-- Slice 12 gap lane claude_s12_gaps_db2: P2-S12-AC-276 (BE03c "Slice 12 lock order" rule 4, Typed deadlock): `deadlock_detected` and a
-- lock-acquisition failure at a lock step are converted to the 409 code of the operation's catalog (SQL token CONFLICT) with nothing
-- committed, and the same Idempotency-Key stays reusable (the failed statement rolls its reservation back with it).  For every Slice 12
-- writer the private body is replaced inside a sub-transaction by a function that raises the lock failure (40P01, 55P03), the public
-- platform_api wrapper is called, and the answer must be P0001:CONFLICT; any other failure (XX000) is not converted.  The sub-transaction
-- restores the real definition; a final control proves it.  This is the precedent of phase_02_slice_12_locale_variant/004 for CMS-03C-04.
-- The source ORDER of the lock clauses of each writer is the companion file phase_02_slice_12_gaps_lock_sources.sql.
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- The sqlstate:message a wrapper answers when its private body raises the given SQLSTATE; the real body is restored on return.
-- OTHERS does not match query_canceled (57014), so it is named too.  p_private is the name of the private body when it differs from the wrapper's (the Worker schema activation command).
create or replace function pg_temp.g2_inject(p_wrapper text, p_state text, p_private text default null) returns text
language plpgsql as $body$
begin
  begin
    execute format($f$create or replace function platform_private.%I(p_request jsonb)
      returns jsonb language plpgsql as $b$ begin raise exception 'injected' using errcode = %L; end $b$$f$, coalesce(p_private, p_wrapper), p_state);
    perform pg_catalog.set_config('app.cms_rpc', '', true);
    execute format('select platform_api.%I($1)', p_wrapper) using '{}'::jsonb;
    return 'no error';
  exception when others or query_canceled then
    return sqlstate || ':' || sqlerrm;
  end;
end;
$body$;

select is(pg_temp.g2_inject('cms_define_template', '40P01'), 'P0001:CONFLICT',
  'CMS-03C-01 template define: a deadlock inside the command is converted to the typed retryable CONFLICT (409) [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_define_template', '55P03'), 'P0001:CONFLICT',
  'CMS-03C-01 template define: a lock-acquisition failure inside the command is converted to the typed retryable CONFLICT (409) [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_define_template', 'XX000'), 'XX000:injected',
  'CMS-03C-01 template define: control, any other failure is not converted [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_insert_pattern_instance', '40P01'), 'P0001:CONFLICT',
  'CMS-03C-02 pattern placement: a deadlock inside the command is converted to the typed retryable CONFLICT (409) [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_insert_pattern_instance', '55P03'), 'P0001:CONFLICT',
  'CMS-03C-02 pattern placement: a lock-acquisition failure inside the command is converted to the typed retryable CONFLICT (409) [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_insert_pattern_instance', 'XX000'), 'XX000:injected',
  'CMS-03C-02 pattern placement: control, any other failure is not converted [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_act_taxonomy_term', '40P01'), 'P0001:CONFLICT',
  'CMS-03C-03 term action and merge: a deadlock inside the command is converted to the typed retryable CONFLICT (409) [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_act_taxonomy_term', '55P03'), 'P0001:CONFLICT',
  'CMS-03C-03 term action and merge: a lock-acquisition failure inside the command is converted to the typed retryable CONFLICT (409) [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_act_taxonomy_term', 'XX000'), 'XX000:injected',
  'CMS-03C-03 term action and merge: control, any other failure is not converted [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_curate_related_content', '40P01'), 'P0001:CONFLICT',
  'CMS-03C-05 related-content curation: a deadlock inside the command is converted to the typed retryable CONFLICT (409) [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_curate_related_content', '55P03'), 'P0001:CONFLICT',
  'CMS-03C-05 related-content curation: a lock-acquisition failure inside the command is converted to the typed retryable CONFLICT (409) [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_curate_related_content', 'XX000'), 'XX000:injected',
  'CMS-03C-05 related-content curation: control, any other failure is not converted [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_submit_governed_review', '40P01'), 'P0001:CONFLICT',
  'CMS-03C-06 governed submit: a deadlock inside the command is converted to the typed retryable CONFLICT (409) [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_submit_governed_review', '55P03'), 'P0001:CONFLICT',
  'CMS-03C-06 governed submit: a lock-acquisition failure inside the command is converted to the typed retryable CONFLICT (409) [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_submit_governed_review', 'XX000'), 'XX000:injected',
  'CMS-03C-06 governed submit: control, any other failure is not converted [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_record_governed_decision', '40P01'), 'P0001:CONFLICT',
  'CMS-03C-07 governed decision: a deadlock inside the command is converted to the typed retryable CONFLICT (409) [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_record_governed_decision', '55P03'), 'P0001:CONFLICT',
  'CMS-03C-07 governed decision: a lock-acquisition failure inside the command is converted to the typed retryable CONFLICT (409) [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_record_governed_decision', 'XX000'), 'XX000:injected',
  'CMS-03C-07 governed decision: control, any other failure is not converted [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_assign_governed_reviewer', '40P01'), 'P0001:CONFLICT',
  'CMS-03C-08 governed assignment: a deadlock inside the command is converted to the typed retryable CONFLICT (409) [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_assign_governed_reviewer', '55P03'), 'P0001:CONFLICT',
  'CMS-03C-08 governed assignment: a lock-acquisition failure inside the command is converted to the typed retryable CONFLICT (409) [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_assign_governed_reviewer', 'XX000'), 'XX000:injected',
  'CMS-03C-08 governed assignment: control, any other failure is not converted [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_activate_governed_subject', '40P01'), 'P0001:CONFLICT',
  'CMS-03C-09 governed activation: a deadlock inside the command is converted to the typed retryable CONFLICT (409) [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_activate_governed_subject', '55P03'), 'P0001:CONFLICT',
  'CMS-03C-09 governed activation: a lock-acquisition failure inside the command is converted to the typed retryable CONFLICT (409) [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_activate_governed_subject', 'XX000'), 'XX000:injected',
  'CMS-03C-09 governed activation: control, any other failure is not converted [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_create_pattern_version', '40P01'), 'P0001:CONFLICT',
  'CMS-03C-12 pattern create: a deadlock inside the command is converted to the typed retryable CONFLICT (409) [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_create_pattern_version', '55P03'), 'P0001:CONFLICT',
  'CMS-03C-12 pattern create: a lock-acquisition failure inside the command is converted to the typed retryable CONFLICT (409) [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_create_pattern_version', 'XX000'), 'XX000:injected',
  'CMS-03C-12 pattern create: control, any other failure is not converted [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_apply_pattern_update', '40P01'), 'P0001:CONFLICT',
  'CMS-03C-15 pattern update: a deadlock inside the command is converted to the typed retryable CONFLICT (409) [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_apply_pattern_update', '55P03'), 'P0001:CONFLICT',
  'CMS-03C-15 pattern update: a lock-acquisition failure inside the command is converted to the typed retryable CONFLICT (409) [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_apply_pattern_update', 'XX000'), 'XX000:injected',
  'CMS-03C-15 pattern update: control, any other failure is not converted [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_create_taxonomy_version', '40P01'), 'P0001:CONFLICT',
  'CMS-03C-16 taxonomy create: a deadlock inside the command is converted to the typed retryable CONFLICT (409) [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_create_taxonomy_version', '55P03'), 'P0001:CONFLICT',
  'CMS-03C-16 taxonomy create: a lock-acquisition failure inside the command is converted to the typed retryable CONFLICT (409) [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_create_taxonomy_version', 'XX000'), 'XX000:injected',
  'CMS-03C-16 taxonomy create: control, any other failure is not converted [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_execute_governed_activation', '40P01'), 'P0001:CONFLICT',
  'CMS-03C-19 scheduled execution: a deadlock inside the command is converted to the typed retryable CONFLICT (409) [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_execute_governed_activation', '55P03'), 'P0001:CONFLICT',
  'CMS-03C-19 scheduled execution: a lock-acquisition failure inside the command is converted to the typed retryable CONFLICT (409) [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_execute_governed_activation', 'XX000'), 'XX000:injected',
  'CMS-03C-19 scheduled execution: control, any other failure is not converted [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_create_revision', '40P01'), 'P0001:CONFLICT',
  'revision-append carry-over: a deadlock inside the command is converted to the typed retryable CONFLICT (409) [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_create_revision', '55P03'), 'P0001:CONFLICT',
  'revision-append carry-over: a lock-acquisition failure inside the command is converted to the typed retryable CONFLICT (409) [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_create_revision', 'XX000'), 'XX000:injected',
  'revision-append carry-over: control, any other failure is not converted [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_resolve_conflict', '40P01'), 'P0001:CONFLICT',
  'conflict-resolution carry-over: a deadlock inside the command is converted to the typed retryable CONFLICT (409) [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_resolve_conflict', '55P03'), 'P0001:CONFLICT',
  'conflict-resolution carry-over: a lock-acquisition failure inside the command is converted to the typed retryable CONFLICT (409) [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_resolve_conflict', 'XX000'), 'XX000:injected',
  'conflict-resolution carry-over: control, any other failure is not converted [P2-S12-AC-276]');

select is(pg_temp.g2_inject('cms_restore_revision', '40P01'), 'P0001:CONFLICT',
  'restore carry-over: a deadlock inside the command is converted to the typed retryable CONFLICT (409) [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_restore_revision', '55P03'), 'P0001:CONFLICT',
  'restore carry-over: a lock-acquisition failure inside the command is converted to the typed retryable CONFLICT (409) [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_restore_revision', 'XX000'), 'XX000:injected',
  'restore carry-over: control, any other failure is not converted [P2-S12-AC-276]');

-- V13-02: the four writers that 20261005013100 left deadlock-only (BE03b rule 6: deadlock and lock-acquisition failure alike).
select is(pg_temp.g2_inject('cms_create_entry', '40P01'), 'P0001:CONFLICT',
  'entry create (DEC-202 default-template lock): a deadlock inside the command is converted to the typed retryable CONFLICT (409) [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_create_entry', '55P03'), 'P0001:CONFLICT',
  'entry create (DEC-202 default-template lock): a lock-acquisition failure inside the command is converted to the typed retryable CONFLICT (409) [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_create_entry', 'XX000'), 'XX000:injected',
  'entry create (DEC-202 default-template lock): control, any other failure is not converted [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_create_entry', '57014'), '57014:injected',
  'entry create (DEC-202 default-template lock): control, a statement timeout (57014) is deliberately not converted (DEC-221) [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_activate_schema', '40P01'), 'P0001:CONFLICT',
  'human schema activation: a deadlock inside the command is converted to the typed retryable CONFLICT (409) [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_activate_schema', '55P03'), 'P0001:CONFLICT',
  'human schema activation: a lock-acquisition failure inside the command is converted to the typed retryable CONFLICT (409) [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_activate_schema', 'XX000'), 'XX000:injected',
  'human schema activation: control, any other failure is not converted [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_activate_schema', '57014'), '57014:injected',
  'human schema activation: control, a statement timeout (57014) is deliberately not converted (DEC-221) [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_activate_schema_migration', '40P01', 'cms_worker_activate_schema'), 'P0001:CONFLICT',
  'Worker schema activation: a deadlock inside the command is converted to the typed retryable CONFLICT (409) [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_activate_schema_migration', '55P03', 'cms_worker_activate_schema'), 'P0001:CONFLICT',
  'Worker schema activation: a lock-acquisition failure inside the command is converted to the typed retryable CONFLICT (409) [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_activate_schema_migration', 'XX000', 'cms_worker_activate_schema'), 'XX000:injected',
  'Worker schema activation: control, any other failure is not converted [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_activate_schema_migration', '57014', 'cms_worker_activate_schema'), '57014:injected',
  'Worker schema activation: control, a statement timeout (57014) is deliberately not converted (DEC-221) [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_revoke_capability_grant', '40P01'), 'P0001:CONFLICT',
  'CMS-03A-17 capability revocation: a deadlock inside the command is converted to the typed retryable CONFLICT (409) [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_revoke_capability_grant', '55P03'), 'P0001:CONFLICT',
  'CMS-03A-17 capability revocation: a lock-acquisition failure inside the command is converted to the typed retryable CONFLICT (409) [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_revoke_capability_grant', 'XX000'), 'XX000:injected',
  'CMS-03A-17 capability revocation: control, any other failure is not converted [P2-S12-AC-276]');
select is(pg_temp.g2_inject('cms_revoke_capability_grant', '57014'), '57014:injected',
  'CMS-03A-17 capability revocation: control, a statement timeout (57014) is deliberately not converted (DEC-221) [P2-S12-AC-276]');

select is((select count(*)::integer from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'platform_private' and p.prosrc like '%injected%' and p.proname = any(array['cms_define_template', 'cms_insert_pattern_instance',
        'cms_act_taxonomy_term', 'cms_curate_related_content', 'cms_submit_governed_review', 'cms_record_governed_decision', 'cms_assign_governed_reviewer',
        'cms_activate_governed_subject', 'cms_create_pattern_version', 'cms_apply_pattern_update', 'cms_create_taxonomy_version',
        'cms_execute_governed_activation', 'cms_create_revision', 'cms_resolve_conflict', 'cms_restore_revision', 'cms_create_entry', 'cms_activate_schema',
        'cms_worker_activate_schema', 'cms_revoke_capability_grant'])), 0,
  'control: every injected definition was rolled back with its sub-transaction [P2-S12-AC-276]');

select * from finish();
rollback;
