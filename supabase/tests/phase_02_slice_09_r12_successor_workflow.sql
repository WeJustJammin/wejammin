commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 R12 (AC390): CMS-03A-09 is the producer of a workflow policy change on a
-- successor.  The request carries the optional pair workflowKey / workflowVersion
-- (both null or absent: keep the source member; both present: a seeded member of the
-- code-owned registry).  CMS-03A-11 then reviews the successor under the strictest of
-- the source member and the new member.  No workflow key is ever written by hand here.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc

create or replace function pg_temp.s09r_succ(p_label text, p_source text, p_key jsonb, p_version jsonb, p_actor text default 'owner') returns text
language plpgsql as $body$
declare before_fp text := pg_temp.s09d_fingerprint(false);
begin
  perform pg_temp.s09d_rpc(p_label, 'platform_api.cms_create_schema_successor', p_actor,
    jsonb_build_object('contentTypeId', pg_temp.s09d_id(p_source || ':type'), 'versionId', pg_temp.s09d_id(p_source || ':version'),
      'expectedVersion', pg_temp.s09d_version(p_source), 'supportedLocales', null, 'fallbackChains', null,
      'defaultTemplateVersionId', null, 'templateBindings', null,
      'workflowKey', p_key, 'workflowVersion', p_version, 'idempotencyKey', 's09r-' || p_label));
  return pg_temp.s09d_outcome(p_label) || '|' || (before_fp = pg_temp.s09d_fingerprint(false))::text;
end;
$body$;

select pg_temp.s09d_create_type('oa', 'r12wf_ordinary');
select pg_temp.s09d_to_active('oa');

-- Refusals commit nothing.
select is(pg_temp.s09r_succ('r:' || c.n, 'oa', c.k, c.v), 'VALIDATION_FAILED|true',
  'CMS-03A-09 refuses a workflow pair ' || c.n || ' with 422 and commits nothing [P2-S09-AC-390]')
from (values
  ('with a key and no version', '"cms.disclosure.policy"'::jsonb, 'null'::jsonb),
  ('with a version and no key', 'null'::jsonb, '"1"'::jsonb),
  ('whose key is not a string', '7'::jsonb, '"1"'::jsonb),
  ('whose version is not a string', '"cms.disclosure.policy"'::jsonb, '1'::jsonb),
  ('whose key breaks the grammar', '"Cms.Disclosure.Policy"'::jsonb, '"1"'::jsonb),
  ('whose key is not a seeded registry member', '"no.such.policy"'::jsonb, '"1"'::jsonb),
  ('whose version is not a seeded member of a seeded key', '"cms.disclosure.policy"'::jsonb, '"2"'::jsonb),
  ('whose version is not a canonical positive decimal', '"cms.disclosure.policy"'::jsonb, '"01"'::jsonb)
) c(n, k, v);
select is(pg_temp.s09r_succ('r:hidden', 'oa', '"cms.disclosure.policy"'::jsonb, '"1"'::jsonb, 'other'), 'NOT_FOUND|true',
  'another organization''s designer still gets the concealed 404 for the source when naming a workflow pair [P2-S09-AC-390]');
select is(pg_temp.s09r_succ('r:denied', 'oa', '"cms.disclosure.policy"'::jsonb, '"1"'::jsonb, 'rev1'), 'FORBIDDEN|true',
  'a human without cms.schema_designer is still 403 when naming a workflow pair [P2-S09-AC-390]');

-- ordinary -> protected: the successor is produced under the protected member and its review is protected.
select pg_temp.s09d_successor('op', 'oa', 'owner', 's09r-op-successor-0001', null, null, null, null, 'cms.disclosure.policy', '1');
select ok(pg_temp.s09d_outcome('op:successor') = 'OK'
  and pg_temp.s09d_resp('op:successor')->>'workflowKey' = 'cms.disclosure.policy' and pg_temp.s09d_resp('op:successor')->>'workflowVersion' = '1'
  and pg_temp.s09d_read('cms_content_type_versions', 'workflow_key', pg_temp.s09d_id('op:version')) = 'cms.disclosure.policy'
  and pg_temp.s09d_read('cms_content_type_versions', 'workflow_key', pg_temp.s09d_id('oa:version')) = 'editorial',
  'CMS-03A-09 produces a successor under the requested protected member; the immutable source keeps its own [P2-S09-AC-390]');
select is(pg_temp.s09d_scalar(format($q$select (platform_private.cms_definition_artifact_hash(
      platform_private.cms_candidate_definition_request(%1$L), version_no) = definition_hash)::text
    from platform_private.cms_content_type_versions where id = %1$L$q$, pg_temp.s09d_id('op:version'))), 'true',
  'the successor definition hash is the deterministic hash of the definition including the requested workflow member [P2-S09-AC-390]');
select is(pg_temp.s09d_scalar(format($q$select (platform_private.cms_definition_artifact_hash(
      platform_private.cms_candidate_definition_request(%1$L) || jsonb_build_object('workflowKey', 'editorial'), version_no) <> definition_hash)::text
    from platform_private.cms_content_type_versions where id = %1$L$q$, pg_temp.s09d_id('op:version'))), 'true',
  'the workflow member is frozen into the hash: the same definition under the source member hashes differently [P2-S09-AC-390]');
select pg_temp.s09d_dry_run('op');
select pg_temp.s09d_seal('op');
select pg_temp.s09d_submit('op');
select ok(pg_temp.s09d_outcome('op:submit') = 'OK'
  and (select r->>'riskClass' = 'protected' and (r->>'requiredDecisionCount')::int = 2 and r->>'policyKey' = 'cms.disclosure.policy'
        and r->'requiredCapabilities' = '["cms.reviewer", "cms.reviewer.policy"]'::jsonb
      from (select pg_temp.s09d_resp('op:submit') r) s),
  'an ordinary source whose successor names the protected member is reviewed as protected (two decisions, specialist slot) [P2-S09-AC-390]');

-- same-key replay and the inherit case.
select pg_temp.s09d_rpc('r:replay', 'platform_api.cms_create_schema_successor', 'owner',
    jsonb_build_object('contentTypeId', pg_temp.s09d_id('oa:type'), 'versionId', pg_temp.s09d_id('oa:version'),
      'expectedVersion', pg_temp.s09d_version('oa'), 'supportedLocales', null, 'fallbackChains', null,
      'defaultTemplateVersionId', null, 'templateBindings', null, 'workflowKey', 'cms.disclosure.policy', 'workflowVersion', '1',
      'idempotencyKey', 's09r-op-successor-0001'));
select ok(pg_temp.s09d_outcome('r:replay') = 'OK' and pg_temp.s09d_resp('r:replay') = pg_temp.s09d_resp('op:successor'),
  'a same-key replay returns the original successor [P2-S09-AC-390]');
select pg_temp.s09d_create_type('ob', 'r12wf_inherit');
select pg_temp.s09d_to_active('ob');
select pg_temp.s09d_successor('oc', 'ob');
select ok(pg_temp.s09d_outcome('oc:successor') = 'OK'
  and pg_temp.s09d_resp('oc:successor')->>'workflowKey' = 'editorial'
  and pg_temp.s09d_resp('oc:successor')->>'workflowVersion' = '1',
  'both members absent keeps the source workflow member [P2-S09-AC-390]');

select * from finish();
rollback;
