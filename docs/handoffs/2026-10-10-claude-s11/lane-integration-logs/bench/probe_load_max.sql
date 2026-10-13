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
\ir phase_02_slice_11_helpers/003-registry.sqlinc

create temp table lm_ms(label text, ms numeric, extra text) on commit drop;

-- Builds a revision with F object fields of P rich_text properties each (a value for every property) and B composed
-- block instances, then times the render plan and the whole checker input.
create or replace function pg_temp.lm_build(p_tag text, p_fields integer, p_props integer, p_blocks integer, p_key_len integer)
returns uuid language plpgsql as $body$
declare
  revision uuid;
  fields_json jsonb;
  properties jsonb;
  value_json jsonb;
  version_id uuid := pg_temp.h11w_version();
  creator uuid := (select value::uuid from s10_ids where key = 'creatorAuth');
  n integer; p integer;
  rich jsonb := '{"format":"rich_text.v1","blocks":[{"type":"heading","level":2,"spans":[{"text":"Section","marks":[]}]},{"type":"paragraph","spans":[{"text":"Read the full guide","marks":[],"link":{"kind":"https","href":"https://example.org/guide"}}]}]}';
begin
  perform set_config('app.cms_rpc', 'true', true);
  revision := pg_temp.h11w_revision(p_tag);
  for n in 1..p_fields loop
    properties := (select jsonb_agg(jsonb_build_object('key', rpad('p', p_key_len, 'x' ) || lpad(g::text, 2, '0'), 'kind', 'rich_text', 'required', false, 'constraints', '{}'::jsonb) order by g) from generate_series(1, p_props) g);
    properties := (select jsonb_agg(jsonb_set(e.value, '{key}', to_jsonb(left(rpad('p', p_key_len, 'x'), p_key_len - 2) || lpad(e.ordinality::text, 2, '0')))) from jsonb_array_elements(properties) with ordinality e(value, ordinality));
    value_json := (select jsonb_object_agg(e.value->>'key', rich) from jsonb_array_elements(properties) e);
    perform pg_temp.h11_raw_insert('platform_private.cms_field_definition_versions', jsonb_build_object(
      'id', pg_temp.h11w_uuid(p_tag || ':f' || n), 'owner_id', pg_temp.h11w_org(), 'state', 'active', 'version', 1,
      'content_type_version_id', version_id, 'stable_field_id', pg_temp.h11w_uuid(p_tag || ':f' || n),
      'field_key', 'mx' || p_tag || lpad(n::text, 3, '0'), 'kind', 'object',
      'constraints', jsonb_build_object('objectStructure', jsonb_build_object('properties', properties)),
      'required', false, 'default_mode', 'none', 'localization_mode', 'none',
      'editor_config', jsonb_build_object('order', 100 + n), 'created_by', creator,
      'created_at', timestamptz '2026-10-08T12:00:00Z', 'updated_at', timestamptz '2026-10-08T12:00:00Z'));
    perform pg_temp.h11_raw_insert('platform_private.cms_entry_field_values', jsonb_build_object(
      'id', extensions.gen_random_uuid(), 'owner_id', pg_temp.h11w_org(), 'state', 'active', 'version', 1, 'revision_id', revision,
      'field_id', pg_temp.h11w_uuid(p_tag || ':f' || n), 'field_definition_id', pg_temp.h11w_uuid(p_tag || ':f' || n),
      'locale', 'en-US', 'value', value_json, 'provenance', 'authored',
      'value_hash', encode(extensions.digest(convert_to(value_json::text, 'utf8'), 'sha256'), 'hex'),
      'created_at', timestamptz '2026-10-08T12:00:00Z', 'updated_at', timestamptz '2026-10-08T12:00:00Z'));
  end loop;
  if p_blocks > 0 then
    perform set_config('app.cms_rpc', 'true', true);
    execute 'alter table platform_private.cms_composition_instances disable trigger user';
    insert into platform_private.cms_composition_instances(
      id, owner_id, state, version, revision_id, path, slot_key, block_key, block_version,
      pattern_id, pattern_version, block_registry_digest, link_mode, props, created_by
    )
    select pg_temp.h11w_uuid(p_tag || ':i' || g), pg_temp.h11w_org(), 'draft', 1, revision,
           '/s' || lpad((g % 64)::text, 2, '0') || '/i' || g, 'primary', 'h11.first', 1, null, null,
           repeat('a', 64), 'detached',
           jsonb_build_object('accessible_name', 'Landmark region number ' || g), creator
      from generate_series(1, p_blocks) g;
    execute 'alter table platform_private.cms_composition_instances enable trigger user';
  end if;
  return revision;
end;
$body$;

create or replace function pg_temp.lm_time(p_label text, p_revision uuid)
returns void language plpgsql as $body$
declare t0 timestamptz; doc jsonb; plan_rows bigint; i integer;
begin
  perform set_config('app.cms_rpc', 'true', true);
  for i in 1..3 loop
    t0 := clock_timestamp();
    select count(*) into plan_rows from platform_private.cms_revision_render_plan(p_revision);
    insert into lm_ms values (p_label || ' render_plan #' || i, extract(epoch from clock_timestamp() - t0) * 1000, plan_rows::text || ' rows');
    t0 := clock_timestamp();
    doc := platform_private.cms_accessibility_checker_input(p_revision, repeat('a', 64));
    insert into lm_ms values (p_label || ' checker_input #' || i, extract(epoch from clock_timestamp() - t0) * 1000,
      jsonb_array_length(doc->'nodes') || ' nodes, ' || octet_length(doc::text) || ' bytes');
  end loop;
end;
$body$;

select pg_temp.lm_time('A 256 nodes (2x32 props=64 + 192 blocks)', pg_temp.lm_build('ma', 2, 32, 192, 4));
select pg_temp.lm_time('B 4096 field nodes (128x32, 4-char keys)', pg_temp.lm_build('mb', 128, 32, 0, 4));
select pg_temp.lm_time('C 4096 field nodes (128x32, 64-char keys)', pg_temp.lm_build('mc', 128, 32, 0, 64));
select pg_temp.lm_time('D 8192 block nodes only', pg_temp.lm_build('md', 0, 0, 8192, 4));
select pg_temp.lm_time('E 4096 + 8192 = 12288 nodes', pg_temp.lm_build('me', 128, 32, 8192, 4));

select diag(rpad(label, 56) || ' ' || lpad(round(ms, 1)::text, 8) || ' ms   ' || extra) from lm_ms order by label;

select * from finish();
rollback;
