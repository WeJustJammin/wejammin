-- CMS-03C-12 RED authoring, UNRUN. BE03c:174,215-219,395-397,1361,1425,1612.
-- AC-100..104/193/211 are partial DB-boundary coverage, not HTTP/whole-AC proof.
-- BE03c:1447 names cms_create_pattern_version. The public jsonb wrapper and
-- private signature are derived SQL adapter choices; the locked boundary is
-- PatternVersionRequest/Resource. Reconcile that adapter when implemented.
-- No trigger bypass, synthetic active pattern, or acceptance claim is allowed.
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;
begin;
select no_plan();

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_p240/01-block.sqlinc
\ir phase_02_slice_12_pattern_definition/000-fixtures.sqlinc
\ir phase_02_slice_12_pattern_definition/010-oracles.sqlinc

-- Missing schema members are ordinary failing assertions, never parse failures.
select ok(pg_temp.s09d_has_columns('cms_pattern_versions', array[
  'pattern_id','compatible_type_ids','node_count','supersedes_id','lifecycle_version']),
  'pattern storage carries lineage, compatibility, expanded count and lifecycle [P2-S12-AC-100]');
select has_function('platform_api', 'cms_create_pattern_version', array['jsonb'],
  'named producer adapter must resolve before behavior can be observed [P2-S12-AC-100]');
select ok(pg_temp.s09d_service_only('platform_api.cms_create_pattern_version(jsonb)'),
  'only the service transport may execute the pattern producer [P2-S12-AC-102]');
select is(pg_temp.s12pd_request('s12pd-null', pg_temp.s12pd_forest(1), null,
  's12pd-null-control')->'expectedVersion', 'null'::jsonb,
  'fixture control: first definition serializes JSON null, not the string null');
select is(pg_temp.s12pd_request('s12pd-next', pg_temp.s12pd_forest(1), '1',
  's12pd-next-control', null, '1')->'expectedVersion', '"1"'::jsonb,
  'fixture control: successor version keeps the contract decimal-string type');

\ir phase_02_slice_12_pattern_definition/020-create-successor.sqlinc
\ir phase_02_slice_12_pattern_definition/025-agreement.sqlinc
\ir phase_02_slice_12_pattern_definition/030-refusals.sqlinc
\ir phase_02_slice_12_pattern_definition/040-graph.sqlinc
\ir phase_02_slice_12_pattern_definition/045-props-digest.sqlinc
\ir phase_02_slice_12_pattern_definition/047-block-compat.sqlinc
\ir phase_02_slice_12_pattern_definition/050-nested.sqlinc
\ir phase_02_slice_12_pattern_definition/055-nested-agreement.sqlinc
\ir phase_02_slice_12_pattern_definition/090-atomicity.sqlinc
\ir phase_02_slice_12_pattern_definition/060-block-lifecycle.sqlinc
\ir phase_02_slice_12_pattern_definition/070-storage.sqlinc
\ir phase_02_slice_12_pattern_definition/080-latest-read.sqlinc

select ok(exists(select 1 from s12pd_out where requested_role='service_role')
  and not exists(select 1 from s12pd_out where call_role is distinct from requested_role),
  'every owned command records its actual effective database role, including service transport');
select ok(exists(select 1 from s12pd_out)
  and not exists(select 1 from s12pd_out where role_restored is not true),
  'every owned command restores both the prior role setting and effective harness user');
select is((select count(*)::integer from s12pd_out
  where label in ('acl-anon','acl-authenticated')),2,
  'both distinct real database-role ACL probes were captured');
select is((select call_role from s12pd_out where label='anonymous'),'service_role',
  'missing human identity is refused through service transport, not an anonymous database role');
select is((select count(*)::integer from s12pd_out
  where operation in ('submit','assign','decide','activate') and requested_role='service_role'),8,
  'both nested activation chains use all four owned service-role transport operations');

select finish();
rollback;
