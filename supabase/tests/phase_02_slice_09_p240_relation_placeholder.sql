\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 P240 (AC081 / AC203): "Relation reads recheck current target
-- visibility and apply omit, block, or the exact opaque placeholder without
-- copying target authority or private fields", and the placeholder fallback is
-- exactly {status: unavailable, reason: unavailable} with no target identifier,
-- type, key, title, data, or existence distinction.
--
-- cms_get_entry_draft (CMS-03B-11) is the relation read.  Antecedent fixtures
-- only: the Slice 10 fixture seeds one active type whose relation field points
-- at one readable entry.  The relation definition and the stored relation are
-- switched to the 'placeholder' policy inside rolled-back savepoints with
-- the user triggers off (a state shift of real rows, never a forged producer
-- path: the policy under test is the definition's immutable onUnavailable).
\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc

create temp table p240_request on commit drop as
select jsonb_build_object(
  'entryId', ids_entry.value,
  'context', jsonb_build_object(
    'actingPartyId', ids_org.value,
    'actingContextId', 'a9100000-0000-4000-8000-000000000094',
    'correlationId', 'a9100000-0000-4000-8000-000000000095'
  )
) as request
from s10_ids ids_entry, s10_ids ids_org
where ids_entry.key = 'entryId' and ids_org.key = 'organization';
select pg_temp.s10_rpc_as(
  'a9100000-0000-4000-8000-000000000001'::uuid,
  (select value::uuid from s10_ids where key = 'organization')
);

create temp table p240_probe(label text primary key, state text, message text, response jsonb) on commit drop;

-- One scenario: switch the one stored relation and its immutable definition to
-- a policy, apply one state shift to a REAL row, read the draft as the creator,
-- record the outcome, then roll the whole scenario back (plpgsql variables
-- survive a rolled-back sub-block, rows do not).
create or replace function pg_temp.p240_scenario(p_label text, p_policy text, p_shift text default null)
returns void language plpgsql as $body$
declare result jsonb; read_state text := '00000'; read_message text;
begin
  begin
    perform set_config('app.cms_rpc', 'true', true);
    execute 'alter table platform_private.cms_relation_definitions disable trigger user';
    execute 'alter table platform_private.cms_entry_relations disable trigger user';
    execute 'alter table platform_private.cms_content_entries disable trigger user';
    update platform_private.cms_relation_definitions set on_unavailable = p_policy
     where field_definition_id = (select r.field_definition_id from platform_private.cms_entry_relations r limit 1);
    update platform_private.cms_entry_relations set on_unavailable = p_policy;
    if p_shift is not null then execute p_shift; end if;
    begin
      select platform_api.cms_get_entry_draft((select request from p240_request)) into result;
    exception when others then
      read_state := sqlstate; read_message := sqlerrm; result := null;
    end;
    raise exception 'p240_rollback';
  exception when others then
    if sqlerrm <> 'p240_rollback' then raise; end if;
  end;
  insert into p240_probe values (p_label, read_state, read_message, result);
end;
$body$;

select pg_temp.p240_scenario('visible', 'placeholder');
select pg_temp.p240_scenario('stale', 'placeholder',
  $$update platform_private.cms_content_entries set version = 2 where id = 'a9100000-0000-4000-8000-000000000301'$$);
select pg_temp.p240_scenario('archived', 'placeholder',
  $$update platform_private.cms_content_entries set lifecycle = 'archived' where id = 'a9100000-0000-4000-8000-000000000301'$$);
select pg_temp.p240_scenario('absent', 'placeholder',
  $$update platform_private.cms_entry_relations set target_id = 'a9100000-0000-4000-8000-0000000009ff'$$);
select pg_temp.p240_scenario('omit', 'omit',
  $$update platform_private.cms_content_entries set version = 2 where id = 'a9100000-0000-4000-8000-000000000301'$$);
select pg_temp.p240_scenario('block', 'block',
  $$update platform_private.cms_content_entries set version = 2 where id = 'a9100000-0000-4000-8000-000000000301'$$);

select is((select count(*)::integer from p240_probe), 6, 'fixture: all six scenarios ran and rolled back [P2-S09-AC-203]');
select is((select count(*)::integer from platform_private.cms_content_entries where version = 2 or lifecycle <> 'active'), 0,
  'fixture: every state shift was rolled back, the real rows are unchanged [P2-S09-AC-203]');

-- ------------------------------------------------- the resolvable target ----
select is((select state from p240_probe where label = 'visible'), '00000',
  'a placeholder-policy relation whose target is readable reads successfully [P2-S09-AC-203]');
select is((select jsonb_array_length(response->'relations') from p240_probe where label = 'visible'), 1,
  'the readable target is returned as one relation [P2-S09-AC-203]');
select is((select response->'relations'->0->>'targetId' from p240_probe where label = 'visible'),
  'a9100000-0000-4000-8000-000000000301',
  'a readable target keeps its identity, because the recheck found it visible [P2-S09-AC-203]');
select is((select response->'relations'->0->'unavailable' from p240_probe where label = 'visible'), 'null'::jsonb,
  'a readable target carries no placeholder [P2-S09-AC-203]');

-- ----------------------------------- every kind of unavailability, one shape ----
select is((select state from p240_probe where label = 'stale'), '00000',
  'a stale target under the placeholder policy is a successful read, not DEPENDENCY_UNAVAILABLE [P2-S09-AC-081]');
select is((select response->'relations' from p240_probe where label = 'stale'),
  jsonb_build_array(jsonb_build_object(
    'fieldId', (select value from s10_ids where key = 'typeRelationFieldId'),
    'fieldDefinitionId', (select r.field_definition_id::text from platform_private.cms_entry_relations r limit 1),
    'position', 0,
    'onUnavailable', 'placeholder',
    'unavailable', jsonb_build_object('status', 'unavailable', 'reason', 'unavailable'))),
  'the fallback is exactly the opaque placeholder: no target id, kind, version, key, title or data [P2-S09-AC-081]');
select is((select count(distinct response->'relations')::integer from p240_probe where label in ('stale', 'archived', 'absent')), 1,
  'stale, archived and absent targets produce one identical relation: no existence distinction [P2-S09-AC-203]');
select is((select count(*)::integer from p240_probe where label in ('stale', 'archived', 'absent') and state = '00000'), 3,
  'every one of those reads succeeds [P2-S09-AC-203]');
select ok((select bool_and(position('a9100000-0000-4000-8000-000000000301' in (response->'relations')::text) = 0
                         and position('a9100000-0000-4000-8000-0000000009ff' in (response::text)) = 0)
    from p240_probe where label in ('stale', 'archived', 'absent')),
  'the unavailable target identifier appears nowhere in the relations (the fixture target is the entry itself, so its id remains in entry meta only) [P2-S09-AC-081]');
select ok((select bool_and(position('"content"' in (response->'relations')::text) = 0 and position('article' in (response->'relations')::text) = 0)
    from p240_probe where label in ('stale', 'archived', 'absent')),
  'neither the target kind nor its type key is copied into the placeholder [P2-S09-AC-203]');
select is((select (select count(*) from jsonb_object_keys(response->'relations'->0))::integer from p240_probe where label = 'stale'), 5,
  'a placeholder relation has exactly fieldId, fieldDefinitionId, position, onUnavailable and unavailable [P2-S09-AC-203]');

-- ----------------------------------------------------- omit and block ----
select is((select response->'relations' from p240_probe where label = 'omit'), '[]'::jsonb,
  'omit still removes an unavailable target entirely [P2-S09-AC-203]');
select is((select message from p240_probe where label = 'block'), 'DEPENDENCY_UNAVAILABLE',
  'block still refuses the whole read with the generic unavailable outcome [P2-S09-AC-203]');
select is((select count(*)::integer from p240_probe where label = 'block' and position('a9100000' in coalesce(message, '')) > 0), 0,
  'the block refusal names no target [P2-S09-AC-203]');

select * from finish();
rollback;
