-- Slice 12 gap lane claude_s12_db9b, item 1 (review V18 MINOR-2, DEC-243): a template designer of a SECOND organization receives
-- the same block selectors from platform_private.cms_template_context (through platform_api.cms_template_context) as the designer
-- of the first.  Blocks are records of the code-owned platform registry: their owner_id is the signed RELEASE PRINCIPAL, never a
-- party (20261003130600:34,67-77), and migration 20261029150000 removed the acting-party predicate from the block half of the read.
-- Oracle: phase_02_slice_09_p240_reads_detail.sql:110 ("visible to an authorized reader of any organization", P2-S09-AC-145).
--
-- Fixtures.  The block is registered through the REAL signed CMS-03A-05 path.  The second organization is the S09 world's `other`
-- (organization created through rpc_create_organization).  Its cms.template_designer grant is a LABELLED FIXTURE FORGERY: CMS-03A-15
-- is the owner-receipt holder's command and the repository has no command that grants a CMS capability of a non-initialized
-- organization (phase_02_slice_09_dec108/01-actors.sqlinc documents this; the gaps_pattern and db1 suites forge it the same way).
-- Every context read starts as a fresh request (RPC flag cleared) and is repeated with the flag leaked (PAT-031).
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

create temp table d9_out(label text primary key, state text, message text, response jsonb, flag_after text) on commit drop;
create or replace function pg_temp.d9_call(p_label text, p_actor text, p_flag text default '')
returns void language plpgsql as $body$
declare answer jsonb; code text := '00000'; msg text; prior_role text := current_setting('role'); request jsonb;
begin
  perform pg_temp.s09d_session(p_actor, 'service_role');
  request := jsonb_build_object('context', pg_temp.s09d_context(p_actor, true));
  perform set_config('app.cms_rpc', p_flag, true);
  perform set_config('role', 'service_role', true);
  begin
    answer := platform_api.cms_template_context(request);
  exception when others then
    get stacked diagnostics msg = message_text;
    code := sqlstate; answer := null;
  end;
  perform set_config('role', prior_role, true);
  insert into d9_out values (p_label, code, msg, answer, current_setting('app.cms_rpc', true));
end;
$body$;
create or replace function pg_temp.d9_blocks(p_label text) returns jsonb language sql stable as $body$
  select response->'registeredBlocks' from d9_out where label = p_label $body$;

-- ------------------------------------------------------------------------------------------ setup --
select pg_temp.p_register('d9:block', pg_temp.p_block_request('d9.released', 1));
select is(pg_temp.s09d_outcome('d9:block'), 'OK', 'setup: the signed CMS-03A-05 registers a supported block through the real release path');
select ok(exists(select 1 from platform_private.cms_block_definition_versions b
   where b.id = (pg_temp.s09d_resp('d9:block')->>'id')::uuid and b.block_key = 'd9.released' and b.state = 'registered'
     and b.owner_id = b.release_principal_id),
  'fact: the registered block''s owner_id is the signed release principal, not a party [DEC-243]');
select is((select count(*)::integer from platform_private.cms_block_definition_lifecycle_events where block_key = 'd9.released'), 0,
  'setup: no lifecycle event exists, so the block is currently supported');
select ok((select count(*) = 4 and count(distinct b.owner_id) = 1 and bool_and(b.owner_id not in (pg_temp.s09d_id('ownerOrg'), pg_temp.s09d_id('otherOrg')))
             from platform_private.cms_block_definition_versions b where b.state = 'registered'),
  'fact: all four registered blocks of the world (this file''s and the pattern fixture''s) share one owner that is neither organization');
select ok(pg_temp.s09d_id('ownerOrg') <> pg_temp.s09d_id('otherOrg')
    and (select actor.party_id from s09d_actor actor where actor.key = 'other') = pg_temp.s09d_id('otherOrg')
    and (select actor.party_id from s09d_actor actor where actor.key = 'owner') = pg_temp.s09d_id('ownerOrg'),
  'fact: the two readers act in two distinct organizations');
select ok(exists(select 1 from identity_private.membership_tenure t
   where t.organization_id = pg_temp.s09d_id('otherOrg') and t.person_id = (select person_id from s09d_actor where key = 'other') and t.state = 'confirmed')
  and not exists(select 1 from identity_private.membership_tenure t
   where t.organization_id = pg_temp.s09d_id('otherOrg') and t.person_id = (select person_id from s09d_actor where key = 'owner')),
  'fact: `other` is a confirmed member of the second organization and the first organization''s designer is no member of it');

-- ---------------------------------------------------------- the first organization's designer (control) --
select pg_temp.d9_call('owner:fresh', 'owner');
select is((select state from d9_out where label = 'owner:fresh'), '00000', 'control: the first organization''s designer reads the context');
select ok(jsonb_array_length(pg_temp.d9_blocks('owner:fresh')) >= 1 and pg_temp.d9_blocks('owner:fresh') @> '[{"blockKey":"d9.released","blockVersion":1}]'::jsonb,
  'control: the first designer''s list is non-empty and holds the released block');
select ok(jsonb_array_length(pg_temp.d9_blocks('owner:fresh')) = 4
    and (select jsonb_agg(item->>'blockKey' order by item->>'blockKey' collate "C") from jsonb_array_elements(pg_temp.d9_blocks('owner:fresh')) item)
        = '["d9.released","s12pd.block","s12pd.high","s12pd.wide"]'::jsonb,
  'control: the list is every released block of the world (this file''s block plus the three the pattern fixture registers), in C order');
select ok(jsonb_array_length(pg_temp.d9_blocks('owner:fresh')) = (select count(*)::integer from platform_private.cms_block_definition_versions where state = 'registered'),
  'independent oracle: the list length equals the count of registered block rows');

-- ------------------------------------------------ the second organization's user before any designer grant ---
select pg_temp.d9_call('other:ungranted', 'other');
select is((select state || ':' || message from d9_out where label = 'other:ungranted'), 'P0001:FORBIDDEN',
  'control: a member of the second organization with NO cms.template_designer grant is refused FORBIDDEN, so the grant below is what opens the read');
select ok((select response is null from d9_out where label = 'other:ungranted'), 'the refusal returns no body and no block list');

-- ------------------------------------------------------------ FIXTURE FORGERY: the second organization's designer grant ---
insert into identity_private.organization_actor_grant(organization_id, person_id, capability_code, valid_from, valid_through, active)
select pg_temp.s09d_id('otherOrg'), person_id, 'cms.template_designer', current_date, current_date + 1, true
  from s09d_actor where key = 'other';
select ok(platform_private.cms_person_holds_capability(pg_temp.s09d_id('otherOrg'), (select person_id from s09d_actor where key = 'other'), 'cms.template_designer')
    and not platform_private.cms_person_holds_capability(pg_temp.s09d_id('ownerOrg'), (select person_id from s09d_actor where key = 'other'), 'cms.template_designer'),
  'fixture: `other` holds cms.template_designer in the second organization only');

-- ------------------------------------------------------------------ the second organization's designer ---
select pg_temp.d9_call('other:fresh', 'other');
select is((select state from d9_out where label = 'other:fresh'), '00000', 'a template designer of the second organization reads the context');
select ok(jsonb_array_length(pg_temp.d9_blocks('other:fresh')) > 0, 'non-empty guard: the second organization''s designer receives block selectors');
select is(pg_temp.d9_blocks('other:fresh'), pg_temp.d9_blocks('owner:fresh'),
  'the second organization''s designer receives EXACTLY the first designer''s selectors, same members in the same order (blocks are platform registry records) [DEC-243]');
select ok(pg_temp.d9_blocks('other:fresh') @> '[{"blockKey":"d9.released","blockVersion":1}]'::jsonb,
  'the second designer''s list holds the released block');
select ok((select bool_and((select array_agg(k order by k) from jsonb_object_keys(item) k) = array['blockKey', 'blockVersion'])
             from jsonb_array_elements(pg_temp.d9_blocks('other:fresh')) item),
  'every selector is exactly {blockKey, blockVersion}: no owner, release or authority member is serialized');
select is((select flag_after from d9_out where label = 'other:fresh'), '', 'control (PAT-031): the context read restores the cleared RPC flag');

select pg_temp.d9_call('other:leaked', 'other', 'true');
select is(pg_temp.d9_blocks('other:leaked'), pg_temp.d9_blocks('owner:fresh'),
  'the second designer''s list with the RPC flag leaked is the same list: neither the owner column nor RLS hides a block');
select is((select flag_after from d9_out where label = 'other:leaked'), 'true', 'control (PAT-031): the wrapper restores the flag it found, here true');

-- ---------------------------------------------------- only the block half is platform-wide: types stay owner-scoped ---
select ok((select response->'contentTypes' = '[]'::jsonb from d9_out where label = 'other:fresh'),
  'the second organization owns no content type, so its contentTypes is empty: the first organization''s type is not leaked');
select ok((select jsonb_array_length(response->'contentTypes') >= 1
             and exists(select 1 from jsonb_array_elements(response->'contentTypes') item where item->>'id' = (select id::text from s12pd_types where ordinal = 1))
             from d9_out where label = 'owner:fresh'),
  'control: the first organization''s designer sees its own active content type');
select ok(not exists(select 1 from d9_out, jsonb_array_elements(response->'contentTypes') item
   where label = 'other:fresh' and item->>'id' in (select id::text from s12pd_types)),
  'no content type of the first organization appears in the second organization''s read');

-- ----------------------------------------------- a block registered later reaches BOTH organizations --
select pg_temp.p_register('d9:late', pg_temp.p_block_request('d9.late', 1));
select is(pg_temp.s09d_outcome('d9:late'), 'OK', 'setup: a second block is registered through the real release path after both reads');
select pg_temp.d9_call('owner:late', 'owner');
select pg_temp.d9_call('other:late', 'other');
select ok(pg_temp.d9_blocks('owner:late') @> '[{"blockKey":"d9.late","blockVersion":1}]'::jsonb
    and pg_temp.d9_blocks('other:late') @> '[{"blockKey":"d9.late","blockVersion":1}]'::jsonb
    and pg_temp.d9_blocks('other:late') = pg_temp.d9_blocks('owner:late')
    and jsonb_array_length(pg_temp.d9_blocks('other:late')) = jsonb_array_length(pg_temp.d9_blocks('other:fresh')) + 1,
  'a block registered after the first reads appears in both organizations'' lists, identical again, one longer than before');

select finish();
rollback;
