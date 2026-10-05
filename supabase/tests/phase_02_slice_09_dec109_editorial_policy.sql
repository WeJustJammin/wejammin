\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 DEC-109 QA-RED: the editorial workflow-policy evidence projection
-- (BE03b "Editorial workflow-policy evidence", CMS-03B-10).  It resolves the
-- content-type version's bound policy from the seeded code-owned registry and
-- returns NULL on absence, ambiguity or a malformed binding, so cms_create_entry
-- succeeds for a properly activated type and still refuses (DEPENDENCY_UNAVAILABLE)
-- when the binding is missing or malformed.  approvalEvidenceHash is the
-- decision-independent digest of { activationApprovalEvidenceHash, policyHash,
-- schemaVersionId } (BE03b).

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc

create or replace function pg_temp.s09e_expected(p_tag text) returns jsonb language sql stable as $body$
  select jsonb_build_object(
    'key', version_row.workflow_key, 'version', version_row.workflow_version::text,
    'policyHash', policy.policy_hash, 'riskClass', policy.risk_class,
    'requiredDecisionCount', policy.required_decision_count,
    'requiredCapabilities', policy.required_capabilities,
    'approvalEvidenceHash', platform_private.cms_jcs_sha256(jsonb_build_object(
      'activationApprovalEvidenceHash', version_row.activation_approval_evidence_hash,
      'policyHash', policy.policy_hash, 'schemaVersionId', version_row.id)))
  from platform_private.cms_content_type_versions version_row
  join platform_private.cms_workflow_policies policy
    on policy.policy_key = version_row.workflow_key and policy.policy_version = version_row.workflow_version
  where version_row.id = pg_temp.s09d_id(p_tag || ':version')
$body$;
create or replace function pg_temp.s09e_evidence(p_tag text) returns jsonb language plpgsql as $body$
declare result jsonb;
begin
  -- the projection is a definer function that reads the registry through the forced
  -- policies, so it is called under the RPC context, as the producers call it
  perform set_config('app.cms_rpc', 'true', true);
  select platform_private.cms_editorial_workflow_policy_evidence(pg_temp.s09d_id(p_tag || ':version')) into result;
  perform set_config('app.cms_rpc', '', true);
  return result;
exception when others then
  perform set_config('app.cms_rpc', '', true);
  return jsonb_build_object('error', sqlerrm);
end;
$body$;
create or replace function pg_temp.s09e_create_request(p_tag text, p_policy jsonb default null) returns jsonb
language sql stable as $body$
  select jsonb_build_object(
    'contentTypeId', version_row.content_type_id, 'contentTypeVersionId', version_row.id,
    'locale', 'en-US',
    'changedPaths', jsonb_build_array('/fields/' || field.stable_field_id),
    'values', jsonb_build_object(field.stable_field_id::text, 'First draft title'),
    'schemaArtifact', jsonb_build_object('id', artifact.id, 'contentTypeVersionId', version_row.id,
      'artifactHash', artifact.artifact_hash, 'compilerVersion', artifact.compiler_version,
      'zodContractRef', artifact.zod_contract_ref),
    'validatorRefs', '[]'::jsonb,
    'workflowPolicy', coalesce(p_policy, pg_temp.s09e_expected(p_tag)),
    'activationEvidence', platform_private.cms_type_version_resource(version_row.id)->'activationEvidence',
    'idempotencyKey', pg_temp.s09d_idem(p_tag, 'entry'))
  from platform_private.cms_content_type_versions version_row
  join platform_private.cms_schema_artifacts artifact on artifact.id = version_row.schema_artifact_id
  join platform_private.cms_field_definition_versions field on field.content_type_version_id = version_row.id
  where version_row.id = pg_temp.s09d_id(p_tag || ':version') and field.field_key = 'title'
$body$;
create or replace function pg_temp.s09e_create_entry(p_label text, p_tag text, p_policy jsonb default null)
returns jsonb language plpgsql as $body$
declare request jsonb;
begin
  -- building the request reads the activation evidence through a definer function
  perform set_config('app.cms_rpc', 'true', true);
  request := pg_temp.s09e_create_request(p_tag, p_policy);
  perform set_config('app.cms_rpc', '', true);
  return pg_temp.s09d_rpc(p_label, 'platform_api.cms_create_entry', 'owner', request);
end;
$body$;

-- An ordinary and a protected type, both activated through the real producers.
select pg_temp.s09d_create_type('a', 'dec109ordinary');
select pg_temp.s09d_to_active('a');
select is(pg_temp.s09d_outcome('a:activate'), 'OK', 'fixture: an ordinary editorial type is activated by the real producer chain');
select pg_temp.s09d_create_type('b', 'dec109draft');
select pg_temp.s09d_create_type('p', 'dec109protected', 'cms.disclosure.policy');
select pg_temp.s09g_member('rev1');
select pg_temp.s09g_grant('p:specialist', 'owner', 'rev1', 'cms.reviewer.policy', pg_temp.s09g_day(5));
select pg_temp.s09d_to_review('p');
select pg_temp.s09d_assign('p', 'rev1');
select pg_temp.s09d_assign('p', 'rev2');
select pg_temp.s09d_decide('p', 'rev1', 'approve');
select pg_temp.s09d_decide('p', 'rev2', 'approve');
select pg_temp.s09d_activate('p');
select is(pg_temp.s09d_outcome('p:activate'), 'OK', 'fixture: a protected type is activated with two approvals including the specialist');

-- The projection.
select ok(pg_temp.s09e_evidence('a') = pg_temp.s09e_expected('a') and pg_temp.s09e_expected('a') is not null,
  'an activated ordinary type resolves its bound seeded policy with the BE03b approval-evidence digest [P2-S09-AC-092] [P2-S09-AC-716]');
select ok((select e->>'key' = 'editorial' and e->>'version' = '1' and e->>'riskClass' = 'ordinary'
    and (e->>'requiredDecisionCount')::int = 1 and e->'requiredCapabilities' = '["cms.reviewer"]'::jsonb
    and e->>'policyHash' ~ '^[a-f0-9]{64}$' and e->>'approvalEvidenceHash' ~ '^[a-f0-9]{64}$'
    and (select count(*) = 7 from jsonb_object_keys(e))
    from (select pg_temp.s09e_evidence('a') e) s),
  'the evidence is exactly key, version, policyHash, riskClass, requiredDecisionCount, requiredCapabilities, approvalEvidenceHash');
select ok(pg_temp.s09e_evidence('a')->>'approvalEvidenceHash'
    is distinct from (select activation_approval_evidence_hash from platform_private.cms_content_type_versions
                      where id = pg_temp.s09d_id('a:version')),
  'the editorial approval digest is distinct from the 03a schema-review approval hash');
select ok(pg_temp.s09e_evidence('p') = pg_temp.s09e_expected('p') and pg_temp.s09e_evidence('p')->>'riskClass' = 'protected'
  and pg_temp.s09e_evidence('p')->'requiredCapabilities' = '["cms.reviewer", "cms.reviewer.policy"]'::jsonb
  and (pg_temp.s09e_evidence('p')->>'requiredDecisionCount')::int = 2,
  'a protected bound policy resolves with two decisions and the ordered specialist slot');
select ok(pg_temp.s09e_evidence('b') is null or pg_temp.s09e_evidence('b') = 'null'::jsonb,
  'a draft (never activated) version has no editorial policy evidence [P2-S09-AC-716]');
select set_config('app.cms_rpc', 'true', true);
select ok(platform_private.cms_editorial_workflow_policy_evidence(extensions.gen_random_uuid()) is null
  and platform_private.cms_editorial_workflow_policy_evidence(null) is null, 'an absent or null version resolves to NULL [P2-S09-AC-716]');
select set_config('app.cms_rpc', '', true);
select ok(not (pg_temp.s09d_def('platform_private.cms_editorial_workflow_policy_evidence(uuid)') ilike '%select null::jsonb%'),
  'the fail-closed seam stub is replaced by a registry resolution');

-- The entry create path succeeds for the activated type with the bound policy.
select pg_temp.s09g_grant('e:author', 'owner', 'owner', 'cms.author', pg_temp.s09g_day(5));
select is(pg_temp.s09d_outcome('e:author'), 'OK', 'fixture: the owner provisions its own author grant through CMS-03A-15');
select pg_temp.s09e_create_entry('e:ok', 'a');
select is(pg_temp.s09d_outcome('e:ok'), 'OK', 'cms_create_entry succeeds for an activated type with a bound ordinary policy');
select ok((select r->>'state' = 'draft' and r->>'revisionNumber' = '1' and r->>'lifecycle' = 'active'
    from (select pg_temp.s09d_resp('e:ok') r) s), 'the entry is created with its first draft revision');
select is((select count(*)::integer from platform_private.cms_content_entries entry
  where entry.id = (pg_temp.s09d_resp('e:ok')->'entry'->>'id')::uuid), 1, 'one entry row exists');
select pg_temp.s09e_create_entry('e:protected', 'p');
select is(pg_temp.s09d_outcome('e:protected'), 'OK', 'cms_create_entry also succeeds for a protected bound policy with its own evidence');

-- Request-supplied policy is never authority.
select count(*) as entries_before from platform_private.cms_content_entries \gset
select pg_temp.s09e_create_entry('e:forged', 'a', pg_temp.s09e_expected('a') || jsonb_build_object('policyHash', repeat('f', 64)));
select pg_temp.s09e_create_entry('e:weaker', 'p', pg_temp.s09e_expected('a'));
select ok(pg_temp.s09d_outcome('e:forged') = 'DEPENDENCY_UNAVAILABLE' and pg_temp.s09d_outcome('e:weaker') = 'DEPENDENCY_UNAVAILABLE',
  'a forged policy hash and an ordinary policy presented for a protected type are both refused');

select is((select count(*)::integer from platform_private.cms_content_entries) - :entries_before, 0,
  'the refused forged and weaker policies wrote no entry or revision row');

-- Missing or malformed bindings fail closed with no row written.  Each tampering
-- runs inside a sub-transaction that is always rolled back (deferred constraint
-- events are flushed first so ALTER TABLE ... DISABLE TRIGGER is allowed); the
-- observation is returned from the sub-transaction.
create or replace function pg_temp.s09e_tamper(p_tag text, p_table text, p_sql text)
returns jsonb language plpgsql as $body$
declare
  observed jsonb;
  presented_policy jsonb := pg_temp.s09e_expected(p_tag);
  entries_before bigint := (select count(*) from platform_private.cms_content_entries);
  outcome text;
begin
  begin
    set constraints all immediate;
    execute format('alter table platform_private.%I disable trigger user', p_table);
    perform pg_catalog.set_config('app.cms_rpc', 'true', true);
    execute p_sql;
    perform pg_catalog.set_config('app.cms_rpc', '', true);
    observed := pg_temp.s09e_evidence(p_tag);
    -- The request presents the policy that was valid before the tampering.
    perform pg_temp.s09e_create_entry('tamper:' || p_tag || p_table, p_tag, presented_policy);
    outcome := pg_temp.s09d_outcome('tamper:' || p_tag || p_table);
    observed := jsonb_build_object('evidence', observed, 'outcome', outcome,
      'entries', (select count(*) from platform_private.cms_content_entries) - entries_before);
    raise exception 'S09E_ROLLBACK';
  exception when others then
    if sqlerrm <> 'S09E_ROLLBACK' then
      return jsonb_build_object('error', sqlerrm);
    end if;
  end;
  return observed;
end;
$body$;
create or replace function pg_temp.s09e_closed(p_probe jsonb) returns boolean language sql immutable as $body$
  select p_probe ? 'outcome' and (p_probe->'evidence' is null or p_probe->'evidence' = 'null'::jsonb)
     and p_probe->>'outcome' = 'DEPENDENCY_UNAVAILABLE' and (p_probe->>'entries')::int = 0
$body$;

select pg_temp.s09e_tamper('a', 'cms_content_type_versions', format(
  'update platform_private.cms_content_type_versions set workflow_key = %L where id = %L',
  'no.such.policy', pg_temp.s09d_id('a:version'))) as probe_key \gset
select ok(pg_temp.s09e_closed(:'probe_key'::jsonb),
  'an unregistered bound key resolves to NULL; entry create fails closed with DEPENDENCY_UNAVAILABLE and writes nothing [P2-S09-AC-716]');
select pg_temp.s09e_tamper('a', 'cms_content_type_versions', format(
  'update platform_private.cms_content_type_versions set workflow_version = 9 where id = %L',
  pg_temp.s09d_id('a:version'))) as probe_version \gset
select ok(pg_temp.s09e_closed(:'probe_version'::jsonb),
  'an unregistered bound version resolves to NULL; entry create fails closed [P2-S09-AC-716]');
select pg_temp.s09e_tamper('a', 'cms_content_type_versions', format(
  'update platform_private.cms_content_type_versions set activation_workflow_policy_hash = %L where id = %L',
  repeat('0', 64), pg_temp.s09d_id('a:version'))) as probe_snapshot \gset
select ok(pg_temp.s09e_closed(:'probe_snapshot'::jsonb),
  'a frozen activation snapshot that differs from the registry member resolves to NULL; entry create fails closed [P2-S09-AC-716]');
select pg_temp.s09e_tamper('a', 'cms_workflow_policies', format(
  'update platform_private.cms_workflow_policies set policy_hash = %L where policy_key = %L and policy_version = 1',
  repeat('0', 64), 'editorial')) as probe_row \gset
select ok(pg_temp.s09e_closed(:'probe_row'::jsonb),
  'a malformed (hash-mismatched) registry row resolves to NULL; entry create fails closed [P2-S09-AC-716]');
select pg_temp.s09e_tamper('a', 'cms_workflow_policies', format(
  'insert into platform_private.cms_workflow_policies(owner_id, state, version, policy_key, policy_version, policy_hash, risk_class, required_decision_count, required_capabilities)
     select owner_id, state, version, %L, policy_version, policy_hash, risk_class, required_decision_count, required_capabilities
       from platform_private.cms_workflow_policies where policy_key = %L and policy_version = 1',
  'editorial.clone', 'editorial')) as probe_clone \gset
select ok(not (:'probe_clone'::jsonb ? 'error') and (:'probe_clone'::jsonb->'evidence') is not null
  and (:'probe_clone'::jsonb->'evidence') <> 'null'::jsonb,
  'control: an unrelated extra registry row does not disturb the bound member');
select ok(pg_temp.s09e_evidence('a') = pg_temp.s09e_expected('a')
  and pg_temp.s09d_scalar('select count(*)::text from platform_private.cms_workflow_policies') = '8',
  'every tampering was rolled back: the evidence and the eight seeded members are intact');

select * from finish();
rollback;
