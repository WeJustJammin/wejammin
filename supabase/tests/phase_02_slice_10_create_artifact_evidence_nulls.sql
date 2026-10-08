-- Slice 10 round 5 (Codex final review, MEDIUM): cms_create_entry requires the caller's
-- SchemaArtifact evidence (P2-S10-AC-079 / DEC-133), including when a member is JSON null.
--
-- The exact-key check passes a `schemaArtifact` whose members are JSON null; `->>` turns a JSON
-- null into SQL NULL, every `<>` comparison against the stored artifact is then NULL, and
-- PL/pgSQL does not enter an IF whose condition is NULL.  A caller could therefore submit a
-- valid artifact `id` and null for `contentTypeVersionId`, `artifactHash`, `compilerVersion`
-- and `zodContractRef` and the create proceeded without the evidence it must carry.  The
-- members must now be strings and are compared null-safely (IS DISTINCT FROM): anything else is
-- the 422 VALIDATION_FAILED at /schemaArtifact and nothing is written.

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

create temp table na_probe(label text primary key, verdict text, detail text, entries integer) on commit drop;
create or replace function pg_temp.na_probe(p_label text, p_sql text)
returns void
language plpgsql
as $body$
declare
  observed_verdict text;
  observed_detail text;
  observed_entries integer;
begin
  begin
    begin
      execute p_sql into observed_verdict;
    exception when others then
      get stacked diagnostics observed_detail = pg_exception_detail;
      observed_verdict := 'ERR ' || sqlerrm;
    end;
    -- entries of the gallery type that exist inside the probe, after the call
    select count(*)::integer into observed_entries
      from platform_private.cms_content_entries
     where content_type_id = (select value::uuid from s10g_ids where key = 'typeId');
    raise exception 'NA_PROBE_SENTINEL_r5a' using errcode = 'P0001';
  exception when others then
    if sqlerrm <> 'NA_PROBE_SENTINEL_r5a' then raise; end if;
  end;
  insert into na_probe values (p_label, observed_verdict, observed_detail, observed_entries);
end;
$body$;
create or replace function pg_temp.na_verdict(p_label text)
returns text language sql stable as $body$
  select coalesce((select verdict from na_probe where label = p_label), 'MISSING')
$body$;
create or replace function pg_temp.na_entries(p_label text)
returns integer language sql stable as $body$
  select entries from na_probe where label = p_label
$body$;
create or replace function pg_temp.na_detail(p_label text)
returns text language sql stable as $body$
  select detail from na_probe where label = p_label
$body$;

-- A create whose schemaArtifact is the valid one with the given members replaced (or the whole
-- member set replaced when p_artifact is given).
create or replace function pg_temp.na_create_sql(p_key text, p_patch jsonb default '{}'::jsonb, p_artifact jsonb default null)
returns text language sql stable as $body$
  select 'select platform_api.cms_create_entry(' || quote_literal(
    ((pg_temp.s10g_create_request(jsonb_build_object('title', 'New'), p_key) - 'schemaArtifact')
      || jsonb_build_object('schemaArtifact', coalesce(p_artifact,
           (pg_temp.s10g_create_request(jsonb_build_object('title', 'New'), p_key)->'schemaArtifact') || p_patch)))::text)
    || '::jsonb)::text'
$body$;

create temp table na_before on commit drop as select pg_temp.s10g_counts() as counts;

select pg_temp.na_probe('control', pg_temp.na_create_sql('na-create-0001'));
select ok(pg_temp.na_verdict('control') not like 'ERR %',
  'control: a create carrying the exact stored artifact evidence commits');

-- every evidence member JSON null at once (the finding's reproduction)
select pg_temp.na_probe('all-null', pg_temp.na_create_sql('na-create-0002',
  '{"contentTypeVersionId": null, "artifactHash": null, "compilerVersion": null, "zodContractRef": null}'::jsonb));
select is(pg_temp.na_verdict('all-null'), 'ERR VALIDATION_FAILED',
  'a valid artifact id with JSON null for every other member is refused VALIDATION_FAILED');
select is(pg_temp.na_detail('all-null'), '["/schemaArtifact"]', 'and it points at /schemaArtifact');

-- each member alone
select pg_temp.na_probe('null-version', pg_temp.na_create_sql('na-create-0003', '{"contentTypeVersionId": null}'::jsonb));
select is(pg_temp.na_verdict('null-version'), 'ERR VALIDATION_FAILED', 'a JSON null contentTypeVersionId is refused');
select pg_temp.na_probe('null-hash', pg_temp.na_create_sql('na-create-0004', '{"artifactHash": null}'::jsonb));
select is(pg_temp.na_verdict('null-hash'), 'ERR VALIDATION_FAILED', 'a JSON null artifactHash is refused');
select pg_temp.na_probe('null-compiler', pg_temp.na_create_sql('na-create-0005', '{"compilerVersion": null}'::jsonb));
select is(pg_temp.na_verdict('null-compiler'), 'ERR VALIDATION_FAILED', 'a JSON null compilerVersion is refused');
select pg_temp.na_probe('null-contract', pg_temp.na_create_sql('na-create-0006', '{"zodContractRef": null}'::jsonb));
select is(pg_temp.na_verdict('null-contract'), 'ERR VALIDATION_FAILED', 'a JSON null zodContractRef is refused');

-- the artifact id itself JSON null, and wrong JSON types
select pg_temp.na_probe('null-id', pg_temp.na_create_sql('na-create-0007', '{"id": null}'::jsonb));
select is(pg_temp.na_verdict('null-id'), 'ERR VALIDATION_FAILED', 'a JSON null artifact id is refused');
select pg_temp.na_probe('number-hash', pg_temp.na_create_sql('na-create-0008', '{"artifactHash": 7}'::jsonb));
select is(pg_temp.na_verdict('number-hash'), 'ERR VALIDATION_FAILED', 'a numeric artifactHash is refused');
select pg_temp.na_probe('array-compiler', pg_temp.na_create_sql('na-create-0009', '{"compilerVersion": ["x"]}'::jsonb));
select is(pg_temp.na_verdict('array-compiler'), 'ERR VALIDATION_FAILED', 'an array compilerVersion is refused');
select pg_temp.na_probe('bool-contract', pg_temp.na_create_sql('na-create-0010', '{"zodContractRef": true}'::jsonb));
select is(pg_temp.na_verdict('bool-contract'), 'ERR VALIDATION_FAILED', 'a boolean zodContractRef is refused');

-- the whole member is JSON null / absent / not an object
select pg_temp.na_probe('artifact-null', pg_temp.na_create_sql('na-create-0011', '{}'::jsonb, 'null'::jsonb));
select is(pg_temp.na_verdict('artifact-null'), 'ERR VALIDATION_FAILED', 'a JSON null schemaArtifact is refused');
select pg_temp.na_probe('artifact-array', pg_temp.na_create_sql('na-create-0012', '{}'::jsonb, '[]'::jsonb));
select is(pg_temp.na_verdict('artifact-array'), 'ERR VALIDATION_FAILED', 'an array schemaArtifact is refused');
select pg_temp.na_probe('artifact-absent', 'select platform_api.cms_create_entry(' || quote_literal(
    (pg_temp.s10g_create_request(jsonb_build_object('title', 'New'), 'na-create-0013') - 'schemaArtifact')::text) || '::jsonb)::text');
select is(pg_temp.na_verdict('artifact-absent'), 'ERR INVALID_REQUEST',
  'an absent schemaArtifact member is refused INVALID_REQUEST (a required key of the request)');

-- a wrong string is still the same refusal (unchanged behavior)
select pg_temp.na_probe('wrong-hash', pg_temp.na_create_sql('na-create-0014', jsonb_build_object('artifactHash', repeat('0', 64))));
select is(pg_temp.na_verdict('wrong-hash'), 'ERR VALIDATION_FAILED', 'a wrong artifactHash string is still refused');

-- nothing was written by a refused create: the entries visible INSIDE each probe after the call
select is(pg_temp.na_entries('control'), 1, 'the control create wrote its entry');
select is(
  (select coalesce(sum(entries), 0)::integer from na_probe where label <> 'control'),
  0, 'no refused create wrote an entry (every refused probe sees none after its call)');

select * from finish();
rollback;
