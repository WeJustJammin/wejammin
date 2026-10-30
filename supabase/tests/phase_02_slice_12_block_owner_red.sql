-- Slice 12 lane claude_s12_block_owner: proof that a released block reaches an organization designer's chooser.
-- The assertions tagged [RED] FAILED before DEC-243 (run 2026-10-29 14:03, 28/31) and pass with the WIP migration
-- supabase/migrations-wip/block-owner/20261029150000_cms_template_context_platform_blocks.sql applied (31/31).
--
--   CMS-03A-05 stores owner_id = platform_private.cms_release_actor(request) = the signed RELEASE PRINCIPAL
--   (20261003130600:34,67-77; the principal id is an auth.users id, cfg_release_principals.principal_id).
--   platform_private.cms_template_context (20261013100500:99-111) lists blocks WHERE owner_id = the designer's
--   ACTING PARTY (an organization).  The CMS-03C-01 / CMS-03C-12 validators read a block by (key, version) with
--   no owner predicate.  So the validators accept a released block that no organization designer is ever shown.
--
-- Every row of the released block comes from the REAL signed CMS-03A-05 registration (no forged block row feeds a
-- [RED] assertion).  The one forged row is the labelled CONTROL that shows the filter (an organization-owned copy),
-- exactly as the db1 suite's gt_block does.  PAT-031: every context read runs as a fresh request (RPC flag cleared)
-- and again with the flag leaked, and must restore the flag it found.
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

select set_config('s12pd.type_count', '1', true);
\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_p240/01-block.sqlinc
\ir phase_02_slice_12_pattern_definition/000-fixtures.sqlinc
\ir phase_02_slice_12_pattern_definition/010-oracles.sqlinc

-- One service-transport call as the `owner` designer, captured with the RPC-context flag it ends with.
create temp table bo_out(label text primary key, state text, message text, response jsonb, flag_after text) on commit drop;
create or replace function pg_temp.bo_call(p_label text, p_function text, p_request jsonb, p_flag text default '')
returns void language plpgsql as $body$
declare answer jsonb; code text := '00000'; msg text; prior_role text := current_setting('role');
begin
  perform pg_temp.s09d_session('owner', 'service_role');
  perform set_config('app.cms_rpc', p_flag, true);
  perform set_config('role', 'service_role', true);
  begin
    execute format('select %s($1)', p_function) into answer using p_request;
  exception when others then
    get stacked diagnostics msg = message_text;
    code := sqlstate; answer := null;
  end;
  perform set_config('role', prior_role, true);
  insert into bo_out values (p_label, code, msg, answer, current_setting('app.cms_rpc', true));
end;
$body$;
create or replace function pg_temp.bo_listed(p_label text, p_key text) returns boolean language sql stable as $body$
  select coalesce((select bool_or(item->>'blockKey' = p_key and (item->>'blockVersion')::integer = 1)
                     from bo_out, jsonb_array_elements(response->'registeredBlocks') item
                    where label = p_label), false)
$body$;

-- ------------------------------------------------------------------------------------------ setup --
select pg_temp.p_register('bo:block', pg_temp.p_block_request('bo.released', 1));
select is(pg_temp.s09d_outcome('bo:block'), 'OK',
  'setup: the signed CMS-03A-05 registers a supported block through the real release path');
select ok(exists(select 1 from platform_private.cms_block_definition_versions b
   where b.id = (pg_temp.s09d_resp('bo:block')->>'id')::uuid and b.block_key = 'bo.released'
     and b.state = 'registered' and b.release_key_id = 'release.p240'),
  'setup: the registered row carries the release key evidence of the signed request');
select is((select count(*)::integer from platform_private.cms_block_definition_lifecycle_events
   where block_key = 'bo.released'), 0,
  'setup: no lifecycle event exists, so the block is currently supported');

-- ------------------------------------------------------------------------------ the ownership fact --
select ok((select b.owner_id = b.release_principal_id
              and b.owner_id = (select principal_id from platform_private.cfg_release_principals where key_id = 'release.p240')
           from platform_private.cms_block_definition_versions b where b.block_key = 'bo.released'),
  'fact: the stored owner_id of a released block is the signed release principal (cms_release_actor)');
select ok((select b.owner_id not in (pg_temp.s09d_id('ownerOrg'), pg_temp.s09d_id('otherOrg'))
           from platform_private.cms_block_definition_versions b where b.block_key = 'bo.released'),
  'fact: that owner is neither organization of the fixture world: it is an auth.users service identity, not a party');
select ok(exists(select 1 from auth.users where id = (select owner_id from platform_private.cms_block_definition_versions where block_key = 'bo.released')),
  'fact: the owner id resolves to an auth.users row (cfg_release_principals.principal_id references auth.users)');

-- --------------------------------------------------------------------- the designer is authorized --
select is((select count(*)::integer from identity_private.organization_actor_grant g
   where g.organization_id = pg_temp.s09d_id('ownerOrg') and g.capability_code = 'cms.template_designer' and g.active), 1,
  'setup: the owner organization has exactly one active cms.template_designer grant (CMS-03A-15, real command)');

-- ---------------------------------------------- the context read, fresh request (flag cleared) ------
select pg_temp.bo_call('ctx:fresh', 'platform_api.cms_template_context',
  jsonb_build_object('context', pg_temp.s09d_context('owner', true)), '');
select is((select state from bo_out where label = 'ctx:fresh'), '00000',
  'control: the organization designer reads the context on a request that starts without the RPC flag');
select ok((select jsonb_array_length(response->'contentTypes') >= 1 from bo_out where label = 'ctx:fresh'),
  'control: the same read lists the organization''s own active compiled content type');
select is((select flag_after from bo_out where label = 'ctx:fresh'), '',
  'control (PAT-031): the context read restores the cleared RPC flag, it does not leave the flag set');
select ok(pg_temp.bo_listed('ctx:fresh', 'bo.released'),
  '[RED] a registered, supported, released block is a selector in the designer context read (BE03a 2550, IA CMS-11)');
select is((select coalesce(jsonb_agg(item->>'blockKey' order by item->>'blockKey' collate "C"), '[]'::jsonb)
             from bo_out, jsonb_array_elements(response->'registeredBlocks') item where label = 'ctx:fresh'),
  '["bo.released","s12pd.block","s12pd.high","s12pd.wide"]'::jsonb,
  '[RED] the selector list is every released block of the world (this lane''s block plus the three the pattern fixture registers)');

-- ------------------------------------------------------ the same read with the flag leaked ('true') ----
select pg_temp.bo_call('ctx:leaked', 'platform_api.cms_template_context',
  jsonb_build_object('context', pg_temp.s09d_context('owner', true)), 'true');
select is((select state from bo_out where label = 'ctx:leaked'), '00000',
  'control: the read also succeeds when an earlier statement left the RPC flag set');
select ok(pg_temp.bo_listed('ctx:leaked', 'bo.released'),
  '[RED] the leaked-flag read lists the released block too: no owner predicate and no RLS hides it (DEC-243)');
select is((select flag_after from bo_out where label = 'ctx:leaked'), 'true',
  'control (PAT-031): the wrapper restores the flag it found, here true');

-- ---------------------------------------------------- the validators accept the same block -----
select pg_temp.s12pd_run('bo:pattern', pg_temp.s12pd_request('bo-pattern', jsonb_build_array(jsonb_build_object(
  'kind', 'block', 'key', 'root1', 'blockKey', 'bo.released', 'blockVersion', 1,
  'props', jsonb_build_object('title', 'Pattern title'), 'children', '[]'::jsonb)), null, 'bo-pattern-0001'));
select is(pg_temp.s12pd_state('bo:pattern'), '00000',
  'control: CMS-03C-12 accepts a pattern whose tree names the released block, for the same organization designer');
select is((select response->>'state' from s12pd_out where label = 'bo:pattern'), 'draft',
  'control: the accepted pattern is a draft PatternVersion');

select pg_temp.bo_call('tpl:released', 'platform_api.cms_define_template', jsonb_build_object(
  'templateKey', 'bo-template', 'compatibleTypeIds', jsonb_build_array((select id from s12pd_types where ordinal = 1)),
  'slots', jsonb_build_array(jsonb_build_object('key', 'primary', 'required', true,
    'allowedBlocks', jsonb_build_array(jsonb_build_object('blockKey', 'bo.released', 'blockVersion', 1)), 'maxCount', 1)),
  'reservedRegions', jsonb_build_array('header', 'now', 'record', 'detail', 'provenance'),
  'bindings', '{}'::jsonb, 'locale', 'en-US', 'audience', 'public', 'expectedVersion', null,
  'idempotencyKey', 'bo-template-0001', 'context', pg_temp.s09d_context('owner', true)), '');
select is((select state from bo_out where label = 'tpl:released'), '00000',
  'control: CMS-03C-01 accepts a template whose slot names the released block, for the same designer');

-- ------------------------------ an organization-owned row no longer differs from a released one --------
-- FIXTURE FORGERY (labelled, as the db1 suite's gt_block): a copy of the released row owned by the organization.
-- Before DEC-243 this row was the control that showed the filter (listed while the released block was not).  The
-- owner column now plays no part, so the same two reads are relabelled to prove both rows are listed.
select set_config('app.cms_rpc', 'true', true);
insert into platform_private.cms_block_definition_versions
select (jsonb_populate_record(null::platform_private.cms_block_definition_versions, to_jsonb(b)
  || jsonb_build_object('id', extensions.gen_random_uuid(), 'owner_id', pg_temp.s09d_id('ownerOrg'),
       'block_key', 'bo.orgowned',
       'release_nonce_hash', encode(extensions.digest('bo-orgowned-nonce', 'sha256'), 'hex')))).*
  from platform_private.cms_block_definition_versions b where b.block_key = 'bo.released';
select set_config('app.cms_rpc', '', true);
select pg_temp.bo_call('ctx:org', 'platform_api.cms_template_context',
  jsonb_build_object('context', pg_temp.s09d_context('owner', true)), '');
select ok(pg_temp.bo_listed('ctx:org', 'bo.orgowned'),
  'control: a block row whose owner_id is the organization is listed too (relabelled: it no longer distinguishes the filter)');
select ok(pg_temp.bo_listed('ctx:org', 'bo.released'),
  'with both rows present both are listed: the owner column of a registry row plays no part (relabelled: it asserted the released block was absent)');

select finish();
rollback;
