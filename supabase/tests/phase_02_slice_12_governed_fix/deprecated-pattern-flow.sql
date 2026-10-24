\ir ../support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Behavioral proof (lane governed-fix2) that a pattern draft over a DEPRECATED block now goes draft -> review ->
-- approved -> active through the real governed commands.  BE03c 396 and 1361: CMS-03C-12 admits a deprecated block
-- and rejects only a missing, withdrawn or incompatible one; "the digest is recomputed again at activation and at
-- 03b publication preflight".  Before the fix the governed recompute raised CONFLICT for a deprecated block, so the
-- draft was created (CMS-03C-12) but its submit (CMS-03C-06) was refused.  A standalone file (the precedent is
-- phase_02_slice_12_pattern_definition/populated-lineage.sql): it reuses the pattern-definition fixtures with two
-- types, needs the pattern producer and the governed commands staged (lane list pattern-def,governed-b,governed-fix2),
-- and forges nothing: registration, deprecation and withdrawal are the signed CMS-03A commands.
select set_config('s12pd.type_count', '2', true);
\ir ../phase_02_slice_09_dec108/00-helpers.sqlinc
\ir ../phase_02_slice_09_dec108/01-actors.sqlinc
\ir ../phase_02_slice_09_dec108/02-chain.sqlinc
\ir ../phase_02_slice_09_p240/01-block.sqlinc
\ir ../phase_02_slice_12_pattern_definition/000-fixtures.sqlinc
\ir ../phase_02_slice_12_pattern_definition/010-oracles.sqlinc

-- rev1 reviews inside the owner organization, exactly as phase_02_slice_12_pattern_definition/050-nested.sqlinc and
-- phase_02_slice_12_governed_decision/010-setup.sqlinc do (the CMS-03C-07 decision resolves the standing grant in the
-- acting party).  The grant itself is the real CMS-03A-15 command, issued by 000-fixtures.
update s09d_actor set party_id = pg_temp.s09d_id('ownerOrg') where key = 'rev1';

-- The governed recompute and the frozen-status currency test run as the governed commands run them: inside an RPC
-- context.  Each wrapper turns a raise into a comparable value so one defect cannot abort the transaction.
create or replace function pg_temp.fix2_recompute(p_label text) returns text language plpgsql volatile as $body$
declare prior text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), ''); result text;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  begin
    result := platform_private.cms_governed_current_digest('pattern_version', pg_temp.s09d_id('ownerOrg'),
      pg_catalog.jsonb_build_object('blockTree', pg_temp.s12pd_row(p_label)->'block_tree'));
  exception when others then
    result := 'RAISED ' || sqlstate || ' ' || sqlerrm;
  end;
  perform pg_catalog.set_config('app.cms_rpc', prior, true);
  return result;
end;
$body$;
create or replace function pg_temp.fix2_status(p_review_id uuid) returns text language plpgsql volatile as $body$
declare prior text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), ''); result text;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  begin
    result := platform_private.cms_governed_frozen_status(p_review_id);
  exception when others then
    result := 'RAISED ' || sqlstate || ' ' || sqlerrm;
  end;
  perform pg_catalog.set_config('app.cms_rpc', prior, true);
  return result;
end;
$body$;
-- The reason a governed step was refused, as a TAP diagnostic (nothing when it succeeded); the same helper
-- phase_02_slice_12_pattern_definition/050-nested.sqlinc defines for its governed walks.
create or replace function pg_temp.s12pd_why(p_step text) returns text language sql stable as $body$
  select case when state = '00000' then '' else extensions.diag(p_step || ' refused ' || state || ' ' ||
    coalesce(message, '') || ' ' || coalesce(detail, '')) end
  from s12pd_out where label = p_step
$body$;
-- One governed walk of a stored draft: submit, assign, decide, activate.  p_through stops it early.  A refused step
-- prints its SQLSTATE, message and DETAIL as a TAP diagnostic.
create or replace function pg_temp.fix2_walk(p_label text, p_through text default 'activate') returns setof text
language plpgsql as $body$
declare body jsonb := pg_temp.s12pd_body(p_label); review jsonb; decision jsonb;
begin
  perform pg_temp.s12pd_run(p_label || ':submit',
    jsonb_build_object('subjectKind','pattern_version','subjectId',body->'id',
      'subjectHash',body->'contentHash','idempotencyKey','fix2-' || p_label || '-submit',
      'context',pg_temp.s09d_context('owner',true)),'owner','service_role','submit');
  if pg_temp.s12pd_why(p_label || ':submit') <> '' then return next pg_temp.s12pd_why(p_label || ':submit'); end if;
  return next extensions.is(pg_temp.s12pd_state(p_label || ':submit'),'00000',
    p_label || ': the governed submit of a draft over a deprecated block succeeds [BE03c 389, 396, 1361]');
  review := pg_temp.s12pd_body(p_label || ':submit');
  if p_through = 'submit' then return; end if;
  perform pg_temp.s12pd_run(p_label || ':assign',
    jsonb_build_object('reviewId',review->'id','action','create',
      'expectedVersion',review->'version','ifMatch',review->'version',
      'reviewerPersonId',pg_temp.s09d_actor_id('rev1','person'),
      'expiresAt',to_char((clock_timestamp()+interval '1 day') at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'reason','Deprecated block pattern',
      'idempotencyKey','fix2-' || p_label || '-assign',
      'context',pg_temp.s09d_context('owner',true)),'owner','service_role','assign');
  if pg_temp.s12pd_why(p_label || ':assign') <> '' then return next pg_temp.s12pd_why(p_label || ':assign'); end if;
  return next extensions.is(pg_temp.s12pd_state(p_label || ':assign'),'00000',
    p_label || ': the independent reviewer is assigned');
  perform pg_temp.s12pd_run(p_label || ':decide',
    jsonb_build_object('reviewId',review->'id','decision','approve','reason','Deprecated block pattern approved',
      'expectedVersion',review->'version','ifMatch',review->'version',
      'idempotencyKey','fix2-' || p_label || '-decide',
      'context',pg_temp.s09d_context('rev1',true)),'rev1','service_role','decide');
  decision := pg_temp.s12pd_body(p_label || ':decide');
  if pg_temp.s12pd_why(p_label || ':decide') <> '' then return next pg_temp.s12pd_why(p_label || ':decide'); end if;
  return next extensions.is(pg_temp.s12pd_state(p_label || ':decide'),'00000',
    p_label || ': the independent approval is recorded');
  if p_through = 'decide' then return; end if;
  perform pg_temp.s12pd_run(p_label || ':activate',
    jsonb_build_object('reviewId',review->'id','action','activate',
      'expectedVersion',decision->'version','ifMatch',decision->'version',
      'idempotencyKey','fix2-' || p_label || '-activate',
      'context',pg_temp.s09d_context('owner',true)),'owner','service_role','activate');
  if pg_temp.s12pd_why(p_label || ':activate') <> '' then return next pg_temp.s12pd_why(p_label || ':activate'); end if;
  return next extensions.is(pg_temp.s12pd_state(p_label || ':activate'),'00000',
    p_label || ': the governed activation recomputes the digest and succeeds [BE03c 1361]');
end;
$body$;

-- Setup: the ordinary signed lifecycle command deprecates the block (CMS-03A-08).
select pg_temp.p_advance('fix2:block-deprecate', pg_temp.p_lifecycle_request(
  (pg_temp.s09d_resp('s12pd:block')->>'id')::uuid, 'supported', 'deprecated'));
select is(pg_temp.s09d_outcome('fix2:block-deprecate'), 'OK', 'setup: the signed lifecycle command deprecates the block');

-- CMS-03C-12 admits the deprecated block (precondition: this already holds before the fix).
select pg_temp.s12pd_run('dep', pg_temp.s12pd_request('fix2-dep', pg_temp.s12pd_forest(1), null, 'fix2-dep'));
select is(pg_temp.s12pd_state('dep'), '00000', 'CMS-03C-12 creates a draft over a deprecated block [BE03c 396, 1361]');
select is(pg_temp.s12pd_body('dep')->>'blockRegistryDigest', pg_temp.s12pd_expected_digest('deprecated'),
  'the producer folds the deprecated lifecycle into the stored digest [BE03c 306-313]');

-- The recompute agrees with the producer for a deprecated block (the equality the submit comparison requires).
select is(pg_temp.fix2_recompute('dep'), pg_temp.s12pd_body('dep')->>'blockRegistryDigest',
  'the governed recompute equals the producer digest for a deprecated block [BE03c 1361]');

-- Draft -> review -> approved -> active, all through the real governed commands.
select * from pg_temp.fix2_walk('dep');
select is(pg_temp.s12pd_row('dep')->>'state', 'active',
  'the pattern over a deprecated block is active after governed activation [BE03c 1361]');
select is(pg_temp.s12pd_row('dep')->'lifecycle_version', '4'::jsonb,
  'draft, review, approved and active advance the lifecycle exactly once each (DEC-188)');
select is(pg_temp.fix2_recompute('dep'), pg_temp.s12pd_body('dep')->>'blockRegistryDigest',
  'the digest still recomputes to the stored one after activation [BE03c 1361]');

-- An open review over a deprecated block is current; withdrawing the block afterwards makes it changed (a withdrawn
-- block is refused at governed time exactly as at definition time).
select pg_temp.s12pd_run('dep2', pg_temp.s12pd_request('fix2-dep2', pg_temp.s12pd_forest(2), null, 'fix2-dep2'));
select is(pg_temp.s12pd_state('dep2'), '00000', 'a second draft over the deprecated block is created');
select * from pg_temp.fix2_walk('dep2', 'submit');
select is(pg_temp.s12pd_row('dep2')->>'state', 'review', 'the submit moves the second draft into review [BE03c 389]');
select is(pg_temp.fix2_status((pg_temp.s12pd_body('dep2:submit')->>'id')::uuid), 'current',
  'the frozen currency test finds the open review over a deprecated block current [BE03c 1361]');
select pg_temp.p_advance('fix2:block-withdraw', pg_temp.p_lifecycle_request(
  (pg_temp.s09d_resp('s12pd:block')->>'id')::uuid, 'deprecated', 'withdrawn'));
select is(pg_temp.s09d_outcome('fix2:block-withdraw'), 'OK', 'setup: the signed lifecycle command withdraws the block');
select is(pg_temp.fix2_status((pg_temp.s12pd_body('dep2:submit')->>'id')::uuid), 'changed',
  'a block withdrawn after submit makes the open review changed [BE03c 1361]');
select is(pg_temp.fix2_recompute('dep2'), 'RAISED P0001 CONFLICT',
  'the recompute still refuses a withdrawn block [BE03c 396, 1361]');
select * from pg_temp.s12pd_refused('withdrawn-definition', pg_temp.s12pd_request('fix2-withdrawn',
  pg_temp.s12pd_forest(1), null, 'fix2-withdrawn'), 'VALIDATION_FAILED');

select finish();
rollback;
