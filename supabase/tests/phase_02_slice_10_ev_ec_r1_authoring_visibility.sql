-- Slice 10 evidence lane EC, remediation R1 (P2-S10-AC-100, AC-102): CMS-03B-14 lists ONLY the
-- acting party's active compiled creatable types, and conceals every version it will not
-- serve - an absent id AND an EXISTING one the caller may not use - as one identical refusal.
-- New file; nothing here edits or weakens an existing suite.
--
-- The fixture holds two active, compiled types of the creator's organization (the 001
-- fixture type and the gallery type). Each exclusion probe changes exactly one thing about
-- one of them (or adds a type that was never activated) and is rolled back with its probe:
--   - a draft type that was never activated;
--   - an active version later superseded;
--   - an active version whose compiled artifact no longer matches its definition hash;
--   - an active version that belongs to another owner.
-- None of them may appear in `creatableTypes`, and selecting any of them by id must be
-- byte-for-byte the refusal a random id gets (NOT_FOUND, no detail), so the read is never
-- an oracle for which versions exist.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_10_value_source/000-gallery-fixture.sqlinc

select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'creatorAuth'),
  (select value::uuid from s10_ids where key = 'organization'));

-- A type that exists in the creator's organization but was never activated.
create temp table ec_unactivated on commit drop as
select platform_api.cms_create_type_draft(
  request || jsonb_build_object(
    'typeKey', 's10unactivated', 'label', 'Unactivated',
    'idempotencyKey', 'ec-r1-unactivated-0001',
    'fields', jsonb_build_array(
      jsonb_build_object('stableFieldId', 'a9100000-0000-4000-8000-000000000c91',
        'key', 'title', 'kind', 'short_text', 'constraints', '{}'::jsonb,
        'required', false, 'validatorKey', null, 'validatorVersion', null,
        'defaultMode', 'none', 'localizationMode', 'none',
        'editorConfig', jsonb_build_object('label', 'Title', 'order', 0), 'lifecycle', 'active')),
    'relations', '[]'::jsonb)) as response
from s10_type_request;

create temp table ec_ids(key text primary key, value text not null) on commit drop;
insert into ec_ids
select 'fixture', value from s10_ids where key = 'draftVersionId'
union all select 'gallery', value from s10g_ids where key = 'versionId'
union all select 'unactivated', response->>'id' from ec_unactivated;

select ok((select count(*) = 3 and bool_and(value ~ '^[0-9a-f-]{36}$') from ec_ids),
  'EC-100 fixture: the creator party holds two active types and one that was never activated');
select is(
  (select state::text from platform_private.cms_content_type_versions
    where id = (select value::uuid from ec_ids where key = 'unactivated')),
  'draft',
  'EC-100 fixture: the third type is a draft version, not an active one');

create temp table ec_reads(label text primary key, state text, message text, detail text, response jsonb) on commit drop;
create or replace function pg_temp.ec_read(p_label text, p_setup text, p_request jsonb)
returns void
language plpgsql
as $body$
declare
  observed_state text := '00000';
  observed_message text;
  observed_detail text;
  observed_response jsonb;
begin
  begin
    if p_setup is not null then execute p_setup; end if;
    begin
      select platform_api.cms_get_entry_authoring_context(p_request) into observed_response;
    exception when others then
      get stacked diagnostics observed_detail = pg_exception_detail;
      observed_state := sqlstate;
      observed_message := sqlerrm;
      observed_response := null;
    end;
    raise exception 'EC_PROBE_SENTINEL_r1a' using errcode = 'P0001';
  exception when others then
    if sqlerrm <> 'EC_PROBE_SENTINEL_r1a' then raise; end if;
  end;
  insert into ec_reads values (p_label, observed_state, observed_message, observed_detail, observed_response);
end;
$body$;

-- The creatable version ids of one read, sorted, as text.
create or replace function pg_temp.ec_creatable(p_label text)
returns text
language sql
stable
as $body$
  select coalesce(string_agg(type->>'contentTypeVersionId', ',' order by type->>'contentTypeVersionId'), '<none>')
  from ec_reads, jsonb_array_elements(response->'creatableTypes') as type
  where label = p_label
$body$;
create or replace function pg_temp.ec_expect(variadic p_keys text[])
returns text
language sql
stable
as $body$
  select coalesce(string_agg(value, ',' order by value), '<none>')
  from ec_ids where key = any(p_keys)
$body$;
create or replace function pg_temp.ec_refusal(p_label text)
returns text
language sql
stable
as $body$
  select coalesce(state || ' ' || coalesce(message, '-') || ' ' || coalesce(nullif(detail, ''), '-'), 'MISSING')
  from ec_reads where label = p_label
$body$;

select pg_temp.ec_read('baseline', null, '{}'::jsonb);
select is(pg_temp.ec_creatable('baseline'), pg_temp.ec_expect('fixture', 'gallery'),
  'EC-100 the creatable types are exactly the two active compiled types of the acting party');
select ok(
  (select count(*) = 2 from ec_reads, jsonb_array_elements(response->'creatableTypes') as type
    where label = 'baseline' and type ? 'schemaArtifact' and type ? 'validatorRefs'
      and type ? 'workflowPolicy' and type ? 'activationEvidence'),
  'EC-100 each served type carries the schema artifact, validator refs, workflow policy and activation evidence');

-- Exclusions: each probe changes one fact and the type leaves the list.
select pg_temp.ec_read('superseded',
  format($sql$set local session_replication_role = replica;
    update platform_private.cms_content_type_versions set state = 'superseded' where id = %L;
    set local session_replication_role = origin;$sql$, (select value from ec_ids where key = 'gallery')),
  '{}'::jsonb);
select is(pg_temp.ec_creatable('superseded'), pg_temp.ec_expect('fixture'),
  'EC-100 an active version that was superseded is no longer creatable');

select pg_temp.ec_read('hash-drift',
  format($sql$set local session_replication_role = replica;
    update platform_private.cms_content_type_versions set definition_hash = repeat('f', 64) where id = %L;
    set local session_replication_role = origin;$sql$, (select value from ec_ids where key = 'gallery')),
  '{}'::jsonb);
select is(pg_temp.ec_creatable('hash-drift'), pg_temp.ec_expect('fixture'),
  'EC-100 an active version whose compiled artifact no longer matches its definition hash is not creatable');

select pg_temp.ec_read('foreign',
  format($sql$set local session_replication_role = replica;
    update platform_private.cms_content_type_versions set owner_id = extensions.gen_random_uuid() where id = %L;
    set local session_replication_role = origin;$sql$, (select value from ec_ids where key = 'gallery')),
  '{}'::jsonb);
select is(pg_temp.ec_creatable('foreign'), pg_temp.ec_expect('fixture'),
  'EC-100 an active version owned by another party is not creatable');

select ok(
  (select value from ec_ids where key = 'unactivated') <> all (string_to_array(pg_temp.ec_creatable('baseline'), ',')),
  'EC-100 the never-activated draft type is not in the creatable list');

-- Concealment: an absent id and every EXISTING version the caller may not use get the same refusal.
select pg_temp.ec_read('select-absent', null,
  jsonb_build_object('contentTypeVersionId', extensions.gen_random_uuid()));
select is(pg_temp.ec_refusal('select-absent'), 'P0001 NOT_FOUND -',
  'EC-102 an absent version id is refused as NOT_FOUND with no detail');

select pg_temp.ec_read('select-unactivated', null,
  jsonb_build_object('contentTypeVersionId', (select value from ec_ids where key = 'unactivated')));
select is(pg_temp.ec_refusal('select-unactivated'), pg_temp.ec_refusal('select-absent'),
  'EC-102 an existing draft version is concealed exactly like an absent one');

select pg_temp.ec_read('select-superseded',
  format($sql$set local session_replication_role = replica;
    update platform_private.cms_content_type_versions set state = 'superseded' where id = %L;
    set local session_replication_role = origin;$sql$, (select value from ec_ids where key = 'gallery')),
  jsonb_build_object('contentTypeVersionId', (select value from ec_ids where key = 'gallery')));
select is(pg_temp.ec_refusal('select-superseded'), pg_temp.ec_refusal('select-absent'),
  'EC-102 an existing superseded version is concealed exactly like an absent one');

select pg_temp.ec_read('select-drift',
  format($sql$set local session_replication_role = replica;
    update platform_private.cms_content_type_versions set definition_hash = repeat('f', 64) where id = %L;
    set local session_replication_role = origin;$sql$, (select value from ec_ids where key = 'gallery')),
  jsonb_build_object('contentTypeVersionId', (select value from ec_ids where key = 'gallery')));
select is(pg_temp.ec_refusal('select-drift'), pg_temp.ec_refusal('select-absent'),
  'EC-102 an existing version with a drifted artifact is concealed exactly like an absent one');

select pg_temp.ec_read('select-foreign',
  format($sql$set local session_replication_role = replica;
    update platform_private.cms_content_type_versions set owner_id = extensions.gen_random_uuid() where id = %L;
    set local session_replication_role = origin;$sql$, (select value from ec_ids where key = 'gallery')),
  jsonb_build_object('contentTypeVersionId', (select value from ec_ids where key = 'gallery')));
select is(pg_temp.ec_refusal('select-foreign'), pg_temp.ec_refusal('select-absent'),
  'EC-102 an existing active version of another party is concealed exactly like an absent one');

select pg_temp.ec_read('select-usable', null,
  jsonb_build_object('contentTypeVersionId', (select value from ec_ids where key = 'fixture')));
select is(pg_temp.ec_refusal('select-usable'), '00000 - -',
  'EC-102 control: the same read of a usable version of the acting party is served');
select is((select response->'selectedType'->>'contentTypeVersionId' from ec_reads where label = 'select-usable'),
  (select value from ec_ids where key = 'fixture'),
  'EC-102 control: the selection is exactly the requested version');

select * from finish();
rollback;
