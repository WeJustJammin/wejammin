\ir ../support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Behavioral proof (lane governed-fix3) that the governed recompute of a PATTERN enforces block compatibility the way
-- the template recompute does.  BE03c 317-327 and 1361: the server recomputes the digest at pattern create, pattern
-- activate and 03b publication preflight and rejects a missing, withdrawn or incompatible block; the create-time
-- verdict can go stale between create and (re)submit when the bound type's ACTIVE version moves to an artifact
-- compiled by another compiler (IA03 45; BE03a 1098-1101).  Before the fix the pattern recompute never evaluated the
-- range, so such a draft could still be submitted.
-- A standalone file (precedent: deprecated-pattern-flow.sql in ../phase_02_slice_12_governed_fix): it reuses the
-- pattern-definition fixtures with two types, needs the pattern producer and the governed commands staged (lane list
-- governed-b,governed-fix3) and forges nothing except the ONE labelled fixture clone no producer can write: a
-- successor version of a type whose artifact carries another registry-valid compiler_version (the real compiler only
-- ever writes '1').  The clone is built under app.cms_rpc, no trigger disabled, with the predecessor's own workflow
-- policy and activation evidence; the predecessor is superseded exactly as CMS-03A activation supersedes it.
select set_config('s12pd.type_count', '2', true);
\ir ../phase_02_slice_09_dec108/00-helpers.sqlinc
\ir ../phase_02_slice_09_dec108/01-actors.sqlinc
\ir ../phase_02_slice_09_dec108/02-chain.sqlinc
\ir ../phase_02_slice_09_p240/01-block.sqlinc
\ir ../phase_02_slice_12_pattern_definition/000-fixtures.sqlinc
\ir ../phase_02_slice_12_pattern_definition/010-oracles.sqlinc

-- The governed recompute and the frozen-status currency test run as the governed commands run them: inside an RPC
-- context, over the subject the production resolver returns (typeIds included).  Each wrapper turns a raise into a
-- comparable value (SQLSTATE, message, DETAIL) so one defect cannot abort the transaction.
create or replace function pg_temp.fix3_recompute(p_label text) returns text language plpgsql volatile as $body$
declare prior text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), ''); result text; why text;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  begin
    result := platform_private.cms_governed_current_digest('pattern_version', pg_temp.s09d_id('ownerOrg'),
      platform_private.cms_governed_subject_resolve('pattern_version', (pg_temp.s12pd_row(p_label)->>'id')::uuid));
  exception when others then
    get stacked diagnostics why = pg_exception_detail;
    result := 'RAISED ' || sqlstate || ' ' || sqlerrm || ' ' || coalesce(nullif(why, ''), '-');
  end;
  perform pg_catalog.set_config('app.cms_rpc', prior, true);
  return result;
end;
$body$;
create or replace function pg_temp.s12pd_why(p_step text) returns text language sql stable as $body$
  select case when state = '00000' then '' else extensions.diag(p_step || ' refused ' || state || ' ' ||
    coalesce(message, '') || ' ' || coalesce(detail, '')) end
  from s12pd_out where label = p_step
$body$;
-- A pattern request over the pattern-definition type of the given ordinal (the shared request builder names ordinal 1).
create or replace function pg_temp.fix3_request(p_key text, p_ordinal integer) returns jsonb language sql stable as $body$
  select pg_temp.s12pd_request(p_key, pg_temp.s12pd_forest(1), null, p_key)
         || jsonb_build_object('compatibleTypeIds',
              jsonb_build_array((select id from s12pd_types where ordinal = p_ordinal)))
$body$;
-- Labelled fixture clone: the type's active version is superseded by a successor whose artifact carries p_compiler.
create or replace function pg_temp.fix3_move_type(p_ordinal integer, p_compiler text) returns uuid
language plpgsql as $body$
declare
  v_type uuid := (select id from s12pd_types where ordinal = p_ordinal);
  src_version platform_private.cms_content_type_versions%rowtype;
  src_artifact platform_private.cms_schema_artifacts%rowtype;
  o_version uuid := extensions.gen_random_uuid();
  new_artifact uuid := extensions.gen_random_uuid();
  stamp timestamptz := clock_timestamp();
begin
  perform set_config('app.cms_rpc', 'true', true);
  select v.* into src_version from platform_private.cms_content_type_versions v
   where v.content_type_id = v_type and v.state = 'active';
  select a.* into src_artifact from platform_private.cms_schema_artifacts a where a.id = src_version.schema_artifact_id;
  insert into platform_private.cms_content_type_versions
    select (jsonb_populate_record(null::platform_private.cms_content_type_versions, to_jsonb(src_version)
      || jsonb_build_object('id', o_version, 'schema_artifact_id', new_artifact, 'state', 'draft', 'version', 1,
        'version_no', src_version.version_no + 1, 'supersedes_id', src_version.id, 'dry_run_id', null,
        'approved_at', null, 'created_at', stamp, 'updated_at', stamp,
        'definition_hash', md5(o_version::text || 'd') || md5(o_version::text || 'e'),
        'activation_workflow_policy_key', null, 'activation_workflow_policy_version', null,
        'activation_workflow_policy_hash', null, 'activation_required_decision_count', null,
        'activation_required_capabilities', null, 'activation_approval_evidence_hash', null))).*;
  insert into platform_private.cms_schema_artifacts
    select (jsonb_populate_record(null::platform_private.cms_schema_artifacts, to_jsonb(src_artifact)
      || jsonb_build_object('id', new_artifact, 'content_type_version_id', o_version,
        'compiler_version', p_compiler, 'created_at', stamp, 'updated_at', stamp, 'compiled_at', stamp,
        'artifact_hash', md5(o_version::text || 'a') || md5(o_version::text || 'b')))).*;
  update platform_private.cms_content_type_versions version_row
     set state = 'superseded', version = version_row.version + 1, updated_at = clock_timestamp()
   where version_row.id = src_version.id;
  update platform_private.cms_content_type_versions version_row
     set state = 'active', version = version_row.version + 1, updated_at = clock_timestamp(),
         activation_workflow_policy_key = src_version.activation_workflow_policy_key,
         activation_workflow_policy_version = src_version.activation_workflow_policy_version,
         activation_workflow_policy_hash = src_version.activation_workflow_policy_hash,
         activation_required_decision_count = src_version.activation_required_decision_count,
         activation_required_capabilities = src_version.activation_required_capabilities,
         activation_approval_evidence_hash = src_version.activation_approval_evidence_hash
   where version_row.id = o_version;
  return o_version;
end;
$body$;
-- One governed walk of a stored draft: submit, assign, decide, activate; p_through stops it early.  A refused step
-- prints its SQLSTATE, message and DETAIL as a TAP diagnostic.
create or replace function pg_temp.fix3_walk(p_label text, p_through text default 'activate') returns setof text
language plpgsql as $body$
declare body jsonb := pg_temp.s12pd_body(p_label); review jsonb; decision jsonb;
begin
  perform pg_temp.s12pd_run(p_label || ':submit',
    jsonb_build_object('subjectKind','pattern_version','subjectId',body->'id',
      'subjectHash',body->'contentHash','idempotencyKey','fix3-' || p_label || '-submit',
      'context',pg_temp.s09d_context('owner',true)),'owner','service_role','submit');
  if pg_temp.s12pd_why(p_label || ':submit') <> '' then return next pg_temp.s12pd_why(p_label || ':submit'); end if;
  return next extensions.is(pg_temp.s12pd_state(p_label || ':submit'),'00000',
    p_label || ': the governed submit of a compatible pattern succeeds [BE03c 389, 1361]');
  review := pg_temp.s12pd_body(p_label || ':submit');
  if p_through = 'submit' then return; end if;
  perform pg_temp.s12pd_run(p_label || ':assign',
    jsonb_build_object('reviewId',review->'id','action','create',
      'expectedVersion',review->'version','ifMatch',review->'version',
      'reviewerPersonId',pg_temp.s09d_actor_id('rev1','person'),
      'expiresAt',to_char((clock_timestamp()+interval '1 day') at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'reason','Compatible pattern',
      'idempotencyKey','fix3-' || p_label || '-assign',
      'context',pg_temp.s09d_context('owner',true)),'owner','service_role','assign');
  if pg_temp.s12pd_why(p_label || ':assign') <> '' then return next pg_temp.s12pd_why(p_label || ':assign'); end if;
  return next extensions.is(pg_temp.s12pd_state(p_label || ':assign'),'00000',
    p_label || ': the independent reviewer is assigned');
  perform pg_temp.s12pd_run(p_label || ':decide',
    jsonb_build_object('reviewId',review->'id','decision','approve','reason','Compatible pattern approved',
      'expectedVersion',review->'version','ifMatch',review->'version',
      'idempotencyKey','fix3-' || p_label || '-decide',
      'context',pg_temp.s09d_context('rev1',true)),'rev1','service_role','decide');
  decision := pg_temp.s12pd_body(p_label || ':decide');
  if pg_temp.s12pd_why(p_label || ':decide') <> '' then return next pg_temp.s12pd_why(p_label || ':decide'); end if;
  return next extensions.is(pg_temp.s12pd_state(p_label || ':decide'),'00000',
    p_label || ': the independent approval is recorded');
  if p_through = 'decide' then return; end if;
  perform pg_temp.s12pd_run(p_label || ':activate',
    jsonb_build_object('reviewId',review->'id','action','activate',
      'expectedVersion',decision->'version','ifMatch',decision->'version',
      'idempotencyKey','fix3-' || p_label || '-activate',
      'context',pg_temp.s09d_context('owner',true)),'owner','service_role','activate');
  if pg_temp.s12pd_why(p_label || ':activate') <> '' then return next pg_temp.s12pd_why(p_label || ':activate'); end if;
  return next extensions.is(pg_temp.s12pd_state(p_label || ':activate'),'00000',
    p_label || ': the governed activation recomputes the digest and succeeds [BE03c 1361]');
end;
$body$;

-- Three drafts, created through the real producer while every type is a real chain type (compiler_version 1) that the
-- block's registered range 1..1 covers: a (type 1, will become incompatible), b (type 2, walks to active) and c
-- (type 2, will move to a COMPATIBLE compiler).
select pg_temp.s12pd_run('a', pg_temp.fix3_request('fix3-draft-a', 1));
select pg_temp.s12pd_run('b', pg_temp.fix3_request('fix3-draft-b', 2));
select pg_temp.s12pd_run('c', pg_temp.fix3_request('fix3-draft-c', 2));
select is(pg_temp.s12pd_state('a') || pg_temp.s12pd_state('b') || pg_temp.s12pd_state('c'), '000000000000000',
  'CMS-03C-12 creates the three drafts while the block range covers every bound type [BE03c 1361]');
select is(pg_temp.fix3_recompute('a'), pg_temp.s12pd_body('a')->>'blockRegistryDigest',
  'control: the recompute equals the stored digest while the range covers the bound type [BE03c 1361]');
select is(pg_temp.fix3_recompute('b'), pg_temp.s12pd_body('b')->>'blockRegistryDigest',
  'control: the same for the second draft [BE03c 1361]');

-- b walks draft -> review -> approved -> active through the real governed commands.
select * from pg_temp.fix3_walk('b');
select is(pg_temp.s12pd_row('b')->>'state', 'active', 'a compatible pattern is active after governed activation [BE03c 1361]');
select is(pg_temp.fix3_recompute('b'), pg_temp.s12pd_body('b')->>'blockRegistryDigest',
  'the digest still recomputes to the stored one after activation [BE03c 1361]');

-- Type 1 moves to an artifact compiled at 1.9: outside the block range 1..1 (labelled fixture clone).
select isnt(pg_temp.fix3_move_type(1, '1.9'), null::uuid, 'fixture: type 1 now has a successor active version');
select is((select count(*)::integer from platform_private.cms_content_type_versions v
             join platform_private.cms_schema_artifacts art on art.id = v.schema_artifact_id
            where v.content_type_id = (select id from s12pd_types where ordinal = 1)
              and v.state = 'active' and art.compiler_version = '1.9'), 1,
  'fixture: type 1 has exactly one active version and its artifact is compiled at 1.9');
select is(pg_temp.fix3_recompute('a'), 'RAISED P0001 VALIDATION_FAILED ["/blockTree"]',
  'the recompute refuses a pattern whose bound type moved outside the block compiler range: the producer refusal [BE03c 317-327, 1361]');
select * from pg_temp.s12pd_refused('a-submit', jsonb_build_object('subjectKind','pattern_version',
  'subjectId',pg_temp.s12pd_body('a')->'id','subjectHash',pg_temp.s12pd_body('a')->'contentHash',
  'idempotencyKey','fix3-a-submit','context',pg_temp.s09d_context('owner',true)),
  'VALIDATION_FAILED', null, 'owner', 'service_role', 'submit');
select is(pg_temp.s12pd_row('a')->>'state', 'draft', 'the refused submit leaves the draft a draft [BE03c 389]');
select is((select count(*)::integer from platform_private.cms_governed_reviews
            where subject_id = (pg_temp.s12pd_body('a')->>'id')::uuid), 0,
  'the refused submit opened no review [BE03c 389]');

-- Type 2 moves to a compiler the range still covers: dotted-numeric 1.0.0 = 1 (BE03a 1098-1101), no false positive.
select isnt(pg_temp.fix3_move_type(2, '1.0.0'), null::uuid, 'fixture: type 2 now has a successor active version compiled at 1.0.0');
select is(pg_temp.fix3_recompute('c'), pg_temp.s12pd_body('c')->>'blockRegistryDigest',
  'a compiler the block range still covers (1.0.0 within 1..1) recomputes to the stored digest [BE03a 1098-1101]');
select * from pg_temp.fix3_walk('c', 'submit');
select is(pg_temp.s12pd_row('c')->>'state', 'review', 'the submit of the still-compatible draft moves it into review [BE03c 389]');

select finish();
rollback;
