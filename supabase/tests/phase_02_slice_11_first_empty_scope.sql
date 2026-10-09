-- DEC-162 private helper unit: initial scope is proved from persisted rows.
-- Source-only QA-RED; author execution UNRUN. All fixtures roll back.
-- Synthetic auth FK/shadow person, draft definitions and content are DB unit
-- fixtures, NOT Auth, review, migration completion or activation evidence.
-- No approvals, sealed reports, completed plans or active schemas are inserted.
-- NOT PROVEN here: publication/current-active branches (their guards require
-- genuine approved producer evidence); cross-owner corruption (validated FKs).
-- Locale initial refusals overlap revision roots: not independent L-only proof.
-- Existing non-null revision/affected-locale counting is separately asserted.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_temp;
select plan(20);
select set_config('app.cms_rpc', 'true', true);

create function pg_temp.dec162_id(p_key text) returns uuid
language sql immutable as $$ select md5('dec162:first-empty:' || p_key)::uuid $$;

insert into auth.users(id) values (pg_temp.dec162_id('auth'));
insert into platform_private.party(id, kind)
values (pg_temp.dec162_id('owner'), 'person');
insert into platform_private.person_party(party_id, account_state)
values (pg_temp.dec162_id('owner'), 'shadow');

-- Builders never catch setup errors. Cyclic artifact FK is checked explicitly
-- after setup, before any assertions; no deferred violation can hide in rollback.
create function pg_temp.dec162_version(
  p_key text, p_existing_type text default null, p_number integer default 1,
  p_predecessor text default null, p_locales jsonb default '["en-US","fr-FR"]'
) returns void language plpgsql as $$
declare
  type_id uuid;
  definition_hash text := encode(extensions.digest(p_key, 'sha256'), 'hex');
begin
  if p_existing_type is null then
    type_id := pg_temp.dec162_id(p_key || ':type');
    insert into platform_private.cms_content_types(
      id, owner_id, type_key, owner_capability, created_by
    ) values (type_id, pg_temp.dec162_id('owner'), 'dec162_' || p_key,
      'cms.schema_designer', pg_temp.dec162_id('auth'));
  else
    select content_type_id into strict type_id
      from platform_private.cms_content_type_versions
      where id = pg_temp.dec162_id(p_existing_type);
  end if;
  insert into platform_private.cms_content_type_versions(
    id, owner_id, content_type_id, version_no, labels, workflow_key,
    workflow_version, source_locale, default_locale, schema_artifact_id,
    definition_hash, compatibility, supersedes_id, created_by,
    supported_locales, fallback_chains, locale_config_hash
  ) values (
    pg_temp.dec162_id(p_key), pg_temp.dec162_id('owner'), type_id, p_number,
    '{"en-US":"DEC-162 helper fixture"}', 'cms.editorial.standard', 1,
    'en-US', 'en-US', pg_temp.dec162_id(p_key || ':artifact'),
    definition_hash, 'additive',
    case when p_predecessor is null then null else pg_temp.dec162_id(p_predecessor) end,
    pg_temp.dec162_id('auth'), p_locales, '{}',
    platform_private.cms_locale_config_hash('en-US', 'en-US', p_locales, '{}')
  );
  insert into platform_private.cms_schema_artifacts(
    id, owner_id, content_type_version_id, compiler_version, zod_contract_ref,
    editor_manifest, renderer_manifest, artifact_hash, compiled_at
  ) values (
    pg_temp.dec162_id(p_key || ':artifact'), pg_temp.dec162_id('owner'),
    pg_temp.dec162_id(p_key), '1', 'cms/dec162/helper-unit', '{}', '{}',
    definition_hash, now()
  );
end;
$$;

create function pg_temp.dec162_entry(
  p_key text, p_schema text, p_lifecycle text default 'active'
) returns void language plpgsql as $$
declare type_id uuid;
begin
  select content_type_id into strict type_id
    from platform_private.cms_content_type_versions where id = pg_temp.dec162_id(p_schema);
  insert into platform_private.cms_content_entries(
    id, owner_id, content_type_id, owner_party_id, lifecycle, version, created_by
  ) values (pg_temp.dec162_id(p_key), pg_temp.dec162_id('owner'), type_id,
    pg_temp.dec162_id('owner'), p_lifecycle, 1, pg_temp.dec162_id('auth'));
end;
$$;

create function pg_temp.dec162_revision(
  p_key text, p_entry text, p_schema text, p_locale text default 'en-US',
  p_number bigint default 1
) returns void language plpgsql as $$
begin
  insert into platform_private.cms_entry_revisions(
    id, owner_id, entry_id, revision_number, schema_version_id,
    taxonomy_version_ids, parent_revision_ids, locale, payload_hash,
    author_person_id, acting_party_id, state, version, validation_state, validation_report
  ) values (pg_temp.dec162_id(p_key), pg_temp.dec162_id('owner'),
    pg_temp.dec162_id(p_entry), p_number, pg_temp.dec162_id(p_schema),
    '[]', '[]', p_locale, encode(extensions.digest(p_key, 'sha256'), 'hex'),
    pg_temp.dec162_id('owner'), pg_temp.dec162_id('owner'), 'draft', 1, 'unknown', '{}');
end;
$$;

create function pg_temp.dec162_locale(p_key text, p_source text, p_translated text)
returns void language plpgsql as $$
declare
  source_row platform_private.cms_entry_revisions;
  translated_row platform_private.cms_entry_revisions;
begin
  select * into strict source_row from platform_private.cms_entry_revisions
    where id = pg_temp.dec162_id(p_source);
  select * into strict translated_row from platform_private.cms_entry_revisions
    where id = pg_temp.dec162_id(p_translated);
  insert into platform_private.cms_locale_variants(
    id, owner_id, state, version, entry_id, revision_id, source_revision_id,
    locale, source_locale, source_hash, created_by
  ) values (pg_temp.dec162_id(p_key), source_row.owner_id, 'draft', 1,
    source_row.entry_id, translated_row.id, source_row.id,
    translated_row.locale, source_row.locale, source_row.payload_hash, pg_temp.dec162_id('auth'));
end;
$$;

select pg_temp.dec162_version('empty');
select pg_temp.dec162_version('wrong_version', null, 2);
select pg_temp.dec162_version('history');
select pg_temp.dec162_version('history_second', 'history', 2);
select pg_temp.dec162_version('predecessor');
-- Cross-type predecessor is representable under its current single-column FK.
-- This is intentionally invalid firstness, never ordinary successor authority.
select pg_temp.dec162_version('has_predecessor', null, 1, 'predecessor');

do $$
declare lifecycle text;
begin
  foreach lifecycle in array array['active','archived','held','deletion_pending'] loop
    perform pg_temp.dec162_version('entry_' || lifecycle);
    perform pg_temp.dec162_entry('row_' || lifecycle, 'entry_' || lifecycle, lifecycle);
  end loop;
end;
$$;

-- Same-owner, cross-type schema roots are allowed by current FKs. They ensure
-- an entries-only census cannot silently discard a revision's schema root.
select pg_temp.dec162_version('other');
select pg_temp.dec162_version('schema_root');
select pg_temp.dec162_entry('foreign_entry', 'other', 'archived');
select pg_temp.dec162_revision('schema_revision', 'foreign_entry', 'schema_root');
select pg_temp.dec162_version('retained_root');
select pg_temp.dec162_entry('retained_entry', 'other');
select pg_temp.dec162_revision('retained_revision', 'retained_entry', 'retained_root');
select pg_temp.dec162_revision('latest_revision', 'retained_entry', 'other', 'en-US', 2);
update platform_private.cms_content_entries
  set current_draft_revision_id = pg_temp.dec162_id('latest_revision'), version = version + 1
  where id = pg_temp.dec162_id('retained_entry');

select pg_temp.dec162_version('locale_source_root');
select pg_temp.dec162_entry('locale_source_entry', 'other', 'archived');
select pg_temp.dec162_revision('locale_source_en', 'locale_source_entry', 'locale_source_root');
select pg_temp.dec162_revision('locale_source_fr', 'locale_source_entry', 'other', 'fr-FR');
select pg_temp.dec162_locale('variant_source', 'locale_source_en', 'locale_source_fr');
select pg_temp.dec162_version('locale_revision_root');
select pg_temp.dec162_entry('locale_revision_entry', 'other', 'archived');
select pg_temp.dec162_revision('locale_revision_en', 'locale_revision_entry', 'other');
select pg_temp.dec162_revision('locale_revision_fr', 'locale_revision_entry', 'locale_revision_root', 'fr-FR');
select pg_temp.dec162_locale('variant_revision', 'locale_revision_en', 'locale_revision_fr');

-- Non-null branch controls: draft fixtures exercise counting only. No claim of
-- approved successor authority. Locale removal affects exactly the one variant.
select pg_temp.dec162_version('source');
select pg_temp.dec162_version('removed_locale', 'source', 2, 'source', '["en-US"]');
select pg_temp.dec162_version('same_locale', 'source', 3, 'source');
set constraints all immediate;

select is(platform_private.cms_schema_source_row_count(null, pg_temp.dec162_id('empty')), 0::bigint,
  'DEC162 initial empty version 1 with matching type-owner and no predecessor/history returns zero without a sealed report');
insert into platform_private.cms_field_definition_versions(
  owner_id, content_type_version_id, stable_field_id, field_key, kind, created_by
) values (pg_temp.dec162_id('owner'), pg_temp.dec162_id('empty'),
  pg_temp.dec162_id('field'), 'title', 'short_text', pg_temp.dec162_id('auth'));
insert into platform_private.cms_content_type_capability_bindings(
  owner_id, content_type_version_id, capability_key, capability_version
) values (pg_temp.dec162_id('owner'), pg_temp.dec162_id('empty'), 'cms.author', 1);
select is(platform_private.cms_schema_source_row_count(null, pg_temp.dec162_id('empty')), 0::bigint,
  'DEC162 candidate fields artifact and capability bindings are declarations rather than persisted content');
select throws_ok($$select platform_private.cms_schema_source_row_count(null, pg_temp.dec162_id('unknown'))$$,
  'P0001', 'DEPENDENCY_UNAVAILABLE', 'DEC162 unknown initial target refuses dependency unavailable');
select throws_ok($$select platform_private.cms_schema_source_row_count(null, null)$$,
  'P0001', 'DEPENDENCY_UNAVAILABLE', 'DEC162 null initial target refuses dependency unavailable');
select throws_ok($$select platform_private.cms_schema_source_row_count(null, pg_temp.dec162_id('wrong_version'))$$,
  'P0001', 'DEPENDENCY_UNAVAILABLE', 'DEC162 lone version 2 cannot masquerade as a first candidate');
select throws_ok($$select platform_private.cms_schema_source_row_count(null, pg_temp.dec162_id('history'))$$,
  'P0001', 'DEPENDENCY_UNAVAILABLE', 'DEC162 version 1 with another persisted draft version is not first-empty history');
select throws_ok($$select platform_private.cms_schema_source_row_count(null, pg_temp.dec162_id('has_predecessor'))$$,
  'P0001', 'DEPENDENCY_UNAVAILABLE', 'DEC162 version 1 with a persisted predecessor refuses initial admission');
select is((select count(*) from platform_private.cms_content_entries
  where content_type_id = pg_temp.dec162_id('empty:type')), 0::bigint,
  'DEC162 empty positive control remains scoped apart from other same-owner persisted content');

select throws_ok($$select platform_private.cms_schema_source_row_count(null, pg_temp.dec162_id('entry_active'))$$,
  'P0001', 'DEPENDENCY_UNAVAILABLE', 'DEC162 an active entry alone makes initial persisted scope nonempty');
select throws_ok($$select platform_private.cms_schema_source_row_count(null, pg_temp.dec162_id('entry_archived'))$$,
  'P0001', 'DEPENDENCY_UNAVAILABLE', 'DEC162 an archived entry alone makes initial persisted scope nonempty');
select throws_ok($$select platform_private.cms_schema_source_row_count(null, pg_temp.dec162_id('entry_held'))$$,
  'P0001', 'DEPENDENCY_UNAVAILABLE', 'DEC162 a held entry alone makes initial persisted scope nonempty');
select throws_ok($$select platform_private.cms_schema_source_row_count(null, pg_temp.dec162_id('entry_deletion_pending'))$$,
  'P0001', 'DEPENDENCY_UNAVAILABLE', 'DEC162 a deletion-pending entry alone makes initial persisted scope nonempty');
select throws_ok($$select platform_private.cms_schema_source_row_count(null, pg_temp.dec162_id('schema_root'))$$,
  'P0001', 'DEPENDENCY_UNAVAILABLE', 'DEC162 draft revision schema root refuses even when its archived entry names another type');
select throws_ok($$select platform_private.cms_schema_source_row_count(null, pg_temp.dec162_id('retained_root'))$$,
  'P0001', 'DEPENDENCY_UNAVAILABLE', 'DEC162 retained draft revision refuses even when current draft points to another schema');
select throws_ok($$select platform_private.cms_schema_source_row_count(null, pg_temp.dec162_id('locale_source_root'))$$,
  'P0001', 'DEPENDENCY_UNAVAILABLE', 'DEC162 persisted draft locale source revision root refuses initial admission');
select throws_ok($$select platform_private.cms_schema_source_row_count(null, pg_temp.dec162_id('locale_revision_root'))$$,
  'P0001', 'DEPENDENCY_UNAVAILABLE', 'DEC162 persisted draft locale translated revision root refuses initial admission');

select is(platform_private.cms_schema_source_row_count(
  pg_temp.dec162_id('source'), pg_temp.dec162_id('removed_locale')), 0::bigint,
  'DEC162 non-null counting control preserves zero for an empty source');
select pg_temp.dec162_entry('source_entry', 'source', 'archived');
select pg_temp.dec162_revision('source_en', 'source_entry', 'source');
select pg_temp.dec162_revision('source_fr', 'source_entry', 'source', 'fr-FR');
select is(platform_private.cms_schema_source_row_count(
  pg_temp.dec162_id('source'), pg_temp.dec162_id('removed_locale')), 2::bigint,
  'DEC162 non-null counting preserves both draft revisions beneath an archived entry');
select pg_temp.dec162_locale('source_variant', 'source_en', 'source_fr');
select is(platform_private.cms_schema_source_row_count(
  pg_temp.dec162_id('source'), pg_temp.dec162_id('removed_locale')), 3::bigint,
  'DEC162 non-null counting includes exactly two revisions and the removed-locale draft variant');
select is(platform_private.cms_schema_source_row_count(
  pg_temp.dec162_id('source'), pg_temp.dec162_id('same_locale')), 2::bigint,
  'DEC162 non-null locale-neutral counting excludes the unaffected variant and retains two revisions');

select * from finish();
rollback;
