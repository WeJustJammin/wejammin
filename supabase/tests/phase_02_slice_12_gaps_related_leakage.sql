-- Slice 12 gap lane claude_s12_gaps_db2: P2-S12-AC-278 clause 0 (BE03c "No leakage"): no private locale text, DRAFT COMPOSITION, unauthorized
-- target, capability or canonical-domain authority enters a public projection.  The Slice 12 public projection is CMS-03C-21
-- (cms_related_content_public_targets: RelatedPublicTarget { entryId, source, reasonCode, position }, no wrapper, no browser route).
-- World: the related-content world (published candidates, a source with a later DRAFT revision, a draft-only entry x5).  Composition rows
-- carrying a marker value are written onto the DRAFT revisions (the source's current draft and the draft-only entry) as direct rows under
-- the CMS RPC context (labelled fixture: the producers need a pattern world this suite does not build); the projection is then read for
-- the source and the marker, the composition structure, canonical-domain and capability authority are shown absent from it.
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/001-world.sqlinc
\ir phase_02_slice_11_helpers/002-reviews.sqlinc
\ir phase_02_slice_11_helpers/004-lineage.sqlinc
\ir phase_02_slice_12_related_content/000-helpers.sqlinc
\ir phase_02_slice_12_related_content/001-world.sqlinc

-- curate srcA exactly as related_content/003 does (two pins, two exclusions, a derived rule), then read its public projection
select pg_temp.s10_rpc_as('a9100000-0000-4000-8000-000000000001'::uuid, (select value::uuid from s10_ids where key = 'organization'));
create temp table g2_cur on commit drop as
select pg_temp.r12_curate(pg_temp.r12_req('srcA', array['c3', 'c1'], array['c4', 'x6'], pg_temp.r12_rule('same-type-recent', 5), 'g2-leak-write-0001')) as response;
create temp table g2_before on commit drop as select pg_temp.r12_targets(pg_temp.r12_id('srcA')) as targets;
select ok((select jsonb_typeof(targets) = 'array' and jsonb_array_length(targets) > 0 from g2_before),
  'fixture: the curated source has a nonempty public related projection [P2-S12-AC-278]');

-- DRAFT composition with a marker value on the source''s current draft revision and on the draft-only entry x5
create or replace function pg_temp.g2_draft_composition(p_tag text, p_marker text) returns uuid language plpgsql as $body$
declare entry_row platform_private.cms_content_entries%rowtype; rev platform_private.cms_entry_revisions%rowtype; row_id uuid := extensions.gen_random_uuid();
begin
  select * into entry_row from platform_private.cms_content_entries where id = pg_temp.r12_id(p_tag);
  select * into rev from platform_private.cms_entry_revisions where id = entry_row.current_draft_revision_id;
  perform set_config('app.cms_rpc', 'true', true);
  insert into platform_private.cms_composition_instances(id, owner_id, state, version, revision_id, path, slot_key, position,
      block_key, block_version, block_registry_digest, link_mode, props, bindings, created_by)
  values (row_id, rev.owner_id, 'draft', 1, rev.id, '/' || p_tag || '-draft', 'root', 0, 'g2.leak', 1, repeat('c', 64), 'detached',
      jsonb_build_object('title', p_marker), jsonb_build_object('caption', jsonb_build_object('literal', p_marker)), entry_row.created_by);
  return row_id;
end;
$body$;
select pg_temp.g2_draft_composition('srcA', 'LEAKMARK-SRC');
select pg_temp.g2_draft_composition('x5', 'LEAKMARK-X5');
select ok((select count(*) = 2 and bool_and(i.state = 'draft') from platform_private.cms_composition_instances i
      where i.props::text like '%LEAKMARK%'),
  'fixture: two draft composition rows carrying the marker exist on draft revisions [P2-S12-AC-278]');

create temp table g2_after on commit drop as select pg_temp.r12_targets(pg_temp.r12_id('srcA')) as targets;
select is((select targets from g2_after), (select targets from g2_before),
  'draft composition on the source''s draft revision and on a draft-only entry changes nothing in the public related projection [P2-S12-AC-278]');
select ok((select targets::text !~* '(LEAKMARK|composition|blockKey|block_key|props|bindings|slot)' from g2_after),
  'the projection text carries no marker, composition, block, props, bindings or slot member [P2-S12-AC-278]');
select ok((select bool_and((select array_agg(k order by k) from jsonb_object_keys(t) k) = array['entryId', 'position', 'reasonCode', 'source']::text[])
      from g2_after, jsonb_array_elements(targets) t),
  'every projected target holds exactly the four RelatedPublicTarget members: no capability, authority, domain or locale-text member [P2-S12-AC-278]');
select ok((select targets::text !~* '(canonical|capabilit|authority|registry|provider|cms\.|label|alias|locale)' from g2_after),
  'the projection text names no canonical domain, capability, authority, registry, provider, label, alias or locale text [P2-S12-AC-278]');
select ok(not exists (select 1 from g2_after, jsonb_array_elements(targets) t where t->>'entryId' = pg_temp.r12_id('x5')::text),
  'the draft-only entry that holds draft composition is never a projected target [P2-S12-AC-278]');

-- the function bodies of the public projection read no draft composition, canonical-domain registry, capability or locale-value store
select is((select array_agg(p.proname order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'platform_private'
     and p.proname in ('cms_related_content_public_targets', 'cms_related_publish_head_revision', 'cms_related_derived_candidates')
     and p.prosrc ~* '(cms_composition_instances|cms_canonical_domain|cms_capability_grants|organization_actor_grant|cms_entry_field_values|cms_locale_variants|cms_term_labels)'),
  null::name[], 'the three functions of the public related projection reference no composition, canonical-domain, capability, field-value, locale-variant or label store [P2-S12-AC-278]');
-- and no function a browser role can execute reads the canonical-domain registry or composition rows directly
select is((select array_agg(n.nspname || '.' || p.proname order by n.nspname, p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('platform_api', 'public')
     and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))
     and p.prosrc ~* '(cms_canonical_domain|cms_composition_instances|cms_capability_grants)'),
  null::text[], 'no platform_api or public function executable by anon or authenticated reads the canonical-domain registry, composition rows or capability grants directly [P2-S12-AC-278]');

select * from finish();
rollback;
