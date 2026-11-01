-- Slice 12 gap lane claude_s12_gaps_db4: P2-S12-AC-256 clause 0, the persistence definition of `cms_canonical_domain_registry`
-- (BE03c "CanonicalDomainRegistry / cms_canonical_domain_registry", Persistence; migration 20261013300100).  The clause states: rows are
-- seeded by forward migration only, immutable and never writable by a caller (`state` `seeded`, `updated_at = created_at`, `owner_id` the
-- seeding release record), `domain` one of role, instrument, gear, place, rights and jurisdiction, `provider_state` built or unbuilt with
-- `provider_key` and `provider_version` non-null exactly when built, UNIQUE(domain, version), the current row of a domain being the one with
-- the greatest `version`.  Catalog definitions, the real seed rows, and direct-write probes as the test administrator (every probe raises
-- at its end so a statement that unexpectedly succeeds cannot corrupt a later assertion).  Nothing here needs a fixture.
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- The single-quoted literals of a constraint definition, sorted.
create or replace function pg_temp.g4_lits(p_def text) returns text[]
language sql immutable as $body$
  select coalesce(pg_catalog.array_agg(m[1] order by m[1]), array[]::text[])
    from pg_catalog.regexp_matches(coalesce(p_def, ''), '''([^'']*)''', 'g') m
$body$;
create or replace function pg_temp.g4_con(p_name text) returns text
language sql stable as $body$
  select pg_catalog.pg_get_constraintdef(c.oid)
    from pg_catalog.pg_constraint c
   where c.conrelid = 'platform_private.cms_canonical_domain_registry'::regclass and c.conname = p_name
$body$;
create or replace function pg_temp.g4_trigger_ok(p_name text, p_function text, p_events integer) returns boolean
language sql stable as $body$
  select exists (
    select 1 from pg_catalog.pg_trigger t
     where t.tgrelid = 'platform_private.cms_canonical_domain_registry'::regclass
       and t.tgname = p_name and not t.tgisinternal and t.tgenabled = 'O'
       and t.tgfoid = pg_catalog.to_regproc('platform_private.' || p_function)
       and (t.tgtype & 3) = 3 and (t.tgtype & 28) = p_events)
$body$;
-- One statement as the test administrator, with app.cms_rpc set (p_rpc) or cleared; always rolled back.  '<sqlstate>:<message>' of a
-- refusal, '00000:' when the statement ran.
create or replace function pg_temp.g4_try(p_sql text, p_rpc boolean default true) returns text
language plpgsql as $body$
declare prior text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
begin
  perform pg_catalog.set_config('app.cms_rpc', case when p_rpc then 'true' else '' end, true);
  begin
    execute p_sql;
    raise exception 'g4 probe ran' using errcode = 'G4OK0';
  exception when others then
    perform pg_catalog.set_config('app.cms_rpc', prior, true);
    if sqlstate = 'G4OK0' then return '00000:'; end if;
    return sqlstate || ':' || sqlerrm;
  end;
end;
$body$;
-- SQLSTATE of one statement run as another database role (the CMS context switched on, so only privileges can refuse it); rolled back.
create or replace function pg_temp.g4_as(p_role text, p_sql text) returns text
language plpgsql as $body$
declare prior_role text := current_setting('role'); prior text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  execute 'set local role ' || quote_ident(p_role);
  begin
    execute p_sql;
    raise exception 'g4 probe ran' using errcode = 'G4OK0';
  exception when others then
    perform pg_catalog.set_config('role', prior_role, true);
    perform pg_catalog.set_config('app.cms_rpc', prior, true);
    if sqlstate = 'G4OK0' then return '00000'; end if;
    return sqlstate;
  end;
end;
$body$;
-- Like g4_as but returns the refusal's message, so the reason of a 42501 can be asserted.
create or replace function pg_temp.g4_as_msg(p_role text, p_sql text) returns text
language plpgsql as $body$
declare prior_role text := current_setting('role'); prior text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  execute 'set local role ' || quote_ident(p_role);
  begin
    execute p_sql;
    raise exception 'g4 probe ran' using errcode = 'G4OK0';
  exception when others then
    perform pg_catalog.set_config('role', prior_role, true);
    perform pg_catalog.set_config('app.cms_rpc', prior, true);
    if sqlstate = 'G4OK0' then return 'ran'; end if;
    return sqlstate || ':' || sqlerrm;
  end;
end;
$body$;
create or replace function pg_temp.g4_row(p_patch jsonb) returns text language sql stable as $body$
  select pg_catalog.format($f$insert into platform_private.cms_canonical_domain_registry(owner_id, state, version, domain, provider_state, provider_key, provider_version, created_at, updated_at)
      select r.owner_id, r.state, r.version, r.domain, r.provider_state, r.provider_key, r.provider_version, r.created_at, r.updated_at
        from pg_catalog.jsonb_populate_record(null::platform_private.cms_canonical_domain_registry,
          pg_catalog.jsonb_build_object('owner_id', '0d6a0d6a-0000-4000-8000-000000000135', 'state', 'seeded', 'version', 99,
            'domain', 'role', 'provider_state', 'built', 'provider_key', 'probe.provider', 'provider_version', 1,
            'created_at', '2026-10-28T00:00:00Z', 'updated_at', '2026-10-28T00:00:00Z') || %L::jsonb) r$f$, p_patch::text)
$body$;

-- ================================================================================= the definition (catalog) ==
select has_table('platform_private', 'cms_canonical_domain_registry',
  'cms_canonical_domain_registry exists in platform_private [P2-S12-AC-256]');
select is((select pg_catalog.array_agg(a.attname || ':' || pg_catalog.format_type(a.atttypid, a.atttypmod)
              || case when a.attnotnull then ':notnull' else ':null' end order by a.attnum)
     from pg_catalog.pg_attribute a
    where a.attrelid = 'platform_private.cms_canonical_domain_registry'::regclass and a.attnum > 0 and not a.attisdropped),
  array['id:uuid:notnull', 'owner_id:uuid:notnull', 'state:text:notnull', 'version:bigint:notnull', 'domain:text:notnull',
    'provider_state:text:notnull', 'provider_key:text:null', 'provider_version:bigint:null',
    'created_at:timestamp with time zone:notnull', 'updated_at:timestamp with time zone:notnull']::text[],
  'the table has exactly the ten stored columns, provider_key and provider_version nullable and every other column NOT NULL [P2-S12-AC-256]');
select ok((select pg_catalog.pg_get_expr(d.adbin, d.adrelid) = '''seeded''::text'
     from pg_catalog.pg_attrdef d join pg_catalog.pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
    where d.adrelid = 'platform_private.cms_canonical_domain_registry'::regclass and a.attname = 'state'),
  'state defaults to seeded [P2-S12-AC-256]');
select is(pg_temp.g4_lits(pg_temp.g4_con('cms_canonical_domain_registry_state_check')), array['seeded']::text[],
  'a CHECK closes state to exactly seeded [P2-S12-AC-256]');
select is(pg_temp.g4_lits(pg_temp.g4_con('cms_canonical_domain_registry_domain_check')),
  array['gear', 'instrument', 'jurisdiction', 'place', 'rights', 'role']::text[],
  'a CHECK closes domain to exactly role, instrument, gear, place, rights and jurisdiction [P2-S12-AC-256]');
select is(pg_temp.g4_lits(pg_temp.g4_con('cms_canonical_domain_registry_provider_state_check')), array['built', 'unbuilt']::text[],
  'a CHECK closes provider_state to exactly built and unbuilt [P2-S12-AC-256]');
select ok(pg_temp.g4_con('cms_canonical_domain_registry_provider_check') like '%provider_state = ''built''::text%'
    and pg_temp.g4_con('cms_canonical_domain_registry_provider_check') like '%provider_key IS NOT NULL%'
    and pg_temp.g4_con('cms_canonical_domain_registry_provider_check') like '%provider_version IS NOT NULL%',
  'a CHECK ties provider_key and provider_version to provider_state = built, both non-null exactly when built [P2-S12-AC-256]');
select ok(pg_temp.g4_con('cms_canonical_domain_registry_time_check') = 'CHECK ((updated_at = created_at))',
  'a CHECK pins updated_at = created_at [P2-S12-AC-256]');
select ok(pg_temp.g4_con('cms_canonical_domain_registry_domain_version_key') = 'UNIQUE (domain, version)',
  'UNIQUE (domain, version) is the registry key [P2-S12-AC-256]');
select ok(pg_temp.g4_trigger_ok('cms_canonical_domain_registry_write_guard', 'cms_write_guard', 4),
  'a BEFORE INSERT row guard (cms_write_guard) polices every insert [P2-S12-AC-256]');
select ok(pg_temp.g4_trigger_ok('cms_canonical_domain_registry_immutable_guard', 'cms_immutable_guard', 24),
  'a BEFORE UPDATE OR DELETE row guard (cms_immutable_guard) makes every row immutable [P2-S12-AC-256]');

-- ============================================================================== the seed (forward migration) ==
select is((select pg_catalog.array_agg(domain || ':' || version || ':' || state || ':' || (updated_at = created_at)::text
                                       || ':' || (owner_id = '0d6a0d6a-0000-4000-8000-000000000135'::uuid)::text order by domain)
     from platform_private.cms_canonical_domain_registry),
  array['gear:1:seeded:true:true', 'instrument:1:seeded:true:true', 'jurisdiction:1:seeded:true:true', 'place:1:seeded:true:true',
    'rights:1:seeded:true:true', 'role:1:seeded:true:true']::text[],
  'the migrated registry holds exactly one version-1 seeded row per domain, updated_at = created_at, owned by the seeding release record [P2-S12-AC-256]');

-- ================================================================== CHECKs, through the real table (probes) ==
select is(pg_temp.g4_try(pg_temp.g4_row('{"version": 99}'::jsonb)), '00000:',
  'control: a well-formed built row (valid domain, key and version, state seeded, updated_at = created_at) is accepted inside the CMS context [P2-S12-AC-256]');
select is(substr(pg_temp.g4_try(pg_temp.g4_row('{"domain": "bogus"}'::jsonb)), 1, 6), '23514:',
  'a domain outside the six is refused by the domain CHECK [P2-S12-AC-256]');
select is(substr(pg_temp.g4_try(pg_temp.g4_row('{"provider_state": "maybe"}'::jsonb)), 1, 6), '23514:',
  'a provider_state other than built or unbuilt is refused [P2-S12-AC-256]');
select is(substr(pg_temp.g4_try(pg_temp.g4_row('{"provider_key": null}'::jsonb)), 1, 6), '23514:',
  'a built row without a provider_key is refused [P2-S12-AC-256]');
select is(substr(pg_temp.g4_try(pg_temp.g4_row('{"provider_version": null}'::jsonb)), 1, 6), '23514:',
  'a built row without a provider_version is refused [P2-S12-AC-256]');
select is(substr(pg_temp.g4_try(pg_temp.g4_row('{"provider_state": "unbuilt", "provider_version": null}'::jsonb)), 1, 6), '23514:',
  'an unbuilt row that keeps its provider_key is refused [P2-S12-AC-256]');
select is(substr(pg_temp.g4_try(pg_temp.g4_row('{"provider_state": "unbuilt", "provider_key": null}'::jsonb)), 1, 6), '23514:',
  'an unbuilt row that keeps its provider_version is refused [P2-S12-AC-256]');
select is(substr(pg_temp.g4_try(pg_temp.g4_row('{"provider_state": "unbuilt"}'::jsonb)), 1, 6), '23514:',
  'an unbuilt row keeping both provider members is refused [P2-S12-AC-256]');
select is(pg_temp.g4_try(pg_temp.g4_row('{"provider_state": "unbuilt", "provider_key": null, "provider_version": null}'::jsonb)), '00000:',
  'control: an unbuilt row with neither key nor version is accepted [P2-S12-AC-256]');
select is(substr(pg_temp.g4_try(pg_temp.g4_row('{"state": "unseeded"}'::jsonb)), 1, 6), '23514:',
  'a state other than seeded is refused [P2-S12-AC-256]');
select is(substr(pg_temp.g4_try(pg_temp.g4_row('{"updated_at": "2026-10-28T00:00:01Z"}'::jsonb)), 1, 6), '23514:',
  'an updated_at that differs from created_at is refused [P2-S12-AC-256]');
select is(substr(pg_temp.g4_try(pg_temp.g4_row('{"version": 1}'::jsonb)), 1, 6), '23505:',
  'a second row of an existing (domain, version) is refused by the UNIQUE key (role, 1 is seeded) [P2-S12-AC-256]');
select is(pg_temp.g4_try(pg_temp.g4_row('{"version": 2, "domain": "instrument", "provider_state": "unbuilt", "provider_key": null, "provider_version": null}'::jsonb)), '00000:',
  'control: the same version number under another domain is a different key and is accepted [P2-S12-AC-256]');

-- ===================================================== immutable, forward-migration-only, never caller-writable ==
select is(pg_temp.g4_try(pg_temp.g4_row('{"version": 99}'::jsonb), false), 'P0001:DIRECT_CMS_TABLE_WRITE',
  'a direct insert outside the CMS RPC context is refused DIRECT_CMS_TABLE_WRITE even for a well-formed row [P2-S12-AC-256]');
select is(pg_temp.g4_try('update platform_private.cms_canonical_domain_registry set provider_state = ''unbuilt'', provider_key = null, provider_version = null where domain = ''role'''),
  'P0001:IMMUTABLE_RECORD', 'an UPDATE of a registry row is refused IMMUTABLE_RECORD even inside the CMS context [P2-S12-AC-256]');
select is(pg_temp.g4_try('update platform_private.cms_canonical_domain_registry set owner_id = owner_id'),
  'P0001:IMMUTABLE_RECORD', 'an UPDATE that changes nothing is still refused: no row may be rewritten [P2-S12-AC-256]');
select is(pg_temp.g4_try('delete from platform_private.cms_canonical_domain_registry where domain = ''gear'''),
  'P0001:IMMUTABLE_RECORD', 'a DELETE of a registry row is refused IMMUTABLE_RECORD [P2-S12-AC-256]');
select is((select pg_catalog.count(*)::integer from platform_private.cms_canonical_domain_registry), 6,
  'the six seeded rows survived every probe: nothing was rewritten or removed [P2-S12-AC-256]');

select is((select pg_catalog.array_agg(r order by r) from (values ('anon'), ('authenticated'), ('service_role')) q(r)
            where pg_catalog.has_table_privilege(r, 'platform_private.cms_canonical_domain_registry', 'select,insert,update,delete,truncate,references,trigger')
               or pg_catalog.has_any_column_privilege(r, 'platform_private.cms_canonical_domain_registry', 'select,insert,update,references')),
  null::text[], 'anon, authenticated and service_role hold no table or column privilege on the registry [P2-S12-AC-256]');
select ok(not exists (select 1 from pg_catalog.pg_class c, pg_catalog.aclexplode(c.relacl) a
     where c.oid = 'platform_private.cms_canonical_domain_registry'::regclass and a.grantee = 0),
  'PUBLIC holds no privilege on the registry [P2-S12-AC-256]');
select is((select pg_catalog.array_agg(distinct pg_catalog.pg_get_userbyid(a.grantee) || ':' || a.privilege_type
            order by pg_catalog.pg_get_userbyid(a.grantee) || ':' || a.privilege_type)
     from pg_catalog.pg_class c, pg_catalog.aclexplode(c.relacl) a
    where c.oid = 'platform_private.cms_canonical_domain_registry'::regclass
      and a.grantee <> c.relowner),
  array['wejammin_cms_definer:SELECT']::text[],
  'the only grant beyond the table owner is SELECT to the CMS definer that the pinned reader functions run as: no caller grant and no write grant [P2-S12-AC-256]');
select ok(not pg_catalog.has_table_privilege('wejammin_cms_definer', 'platform_private.cms_canonical_domain_registry', 'insert,update,delete,truncate'),
  'the CMS definer holds no write privilege either: only a forward migration can add a row [P2-S12-AC-256]');
select ok((select c.relrowsecurity and c.relforcerowsecurity from pg_catalog.pg_class c
            where c.oid = 'platform_private.cms_canonical_domain_registry'::regclass),
  'row level security is enabled and forced on the registry [P2-S12-AC-256]');
select ok((select pg_catalog.count(*) = 1 and pg_catalog.bool_and(cmd = 'ALL' and qual like '%cms_rpc_context_valid()%' and with_check like '%cms_rpc_context_valid()%')
     from pg_catalog.pg_policies where schemaname = 'platform_private' and tablename = 'cms_canonical_domain_registry'),
  'the single policy admits a row only inside the CMS RPC context, for reads and writes alike [P2-S12-AC-256]');
-- anon and authenticated hold no USAGE on platform_private, so a call fails at the schema whatever the table grants say; USAGE is granted here
-- (rolled back with the transaction) so the refusal observed below can only come from the table privilege and the policy.
grant usage on schema platform_private to anon, authenticated;
select is(pg_temp.g4_as_msg('anon', pg_temp.g4_row('{"version": 99}'::jsonb)), '42501:permission denied for table cms_canonical_domain_registry',
  'anon, with schema USAGE, cannot insert a registry row even inside the CMS context: the refusal is the missing table privilege itself [P2-S12-AC-256]');
select is(pg_temp.g4_as_msg('authenticated', pg_temp.g4_row('{"version": 99}'::jsonb)), '42501:permission denied for table cms_canonical_domain_registry',
  'authenticated, with schema USAGE, cannot insert a registry row even inside the CMS context: the refusal is the missing table privilege itself [P2-S12-AC-256]');
select is(pg_temp.g4_as('service_role', pg_temp.g4_row('{"version": 99}'::jsonb)), '42501',
  'service_role cannot insert a registry row even inside the CMS context [P2-S12-AC-256]');
select is(pg_temp.g4_as('service_role', 'select count(*) from platform_private.cms_canonical_domain_registry'), '42501',
  'service_role cannot read the registry [P2-S12-AC-256]');
-- control: the probe can see a privilege.  Granting INSERT on the table and EXECUTE on the policy function to anon (rolled back) lets the same call run.
grant insert on table platform_private.cms_canonical_domain_registry to anon;
grant execute on function platform_private.cms_rpc_context_valid() to anon;
select is(pg_temp.g4_as('anon', pg_temp.g4_row('{"version": 99}'::jsonb)), '00000',
  'control: once anon is granted INSERT and EXECUTE on the policy function (and holds schema USAGE) the same insert runs, so the 42501 above came from the missing table privilege [P2-S12-AC-256]');
revoke insert on table platform_private.cms_canonical_domain_registry from anon;
revoke execute on function platform_private.cms_rpc_context_valid() from anon;
select is((select pg_catalog.array_agg(n.nspname || '.' || p.proname order by n.nspname, p.proname)
     from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('platform_private', 'platform_api') and p.prokind = 'f'
      and p.prosrc ~* 'insert\s+into\s+platform_private\.cms_canonical_domain_registry\M'),
  null::text[], 'no stored function inserts a registry row: the seeds and every later provider registration are forward migrations only [P2-S12-AC-256]');
select is((select pg_catalog.array_agg(n.nspname || '.' || p.proname order by n.nspname, p.proname)
     from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('platform_private', 'platform_api') and p.prokind = 'f'
      and p.prosrc ~* '(update\s+platform_private\.cms_canonical_domain_registry|delete\s+from\s+platform_private\.cms_canonical_domain_registry)\M'),
  null::text[], 'no stored function updates or deletes a registry row [P2-S12-AC-256]');

-- ================================================ the current row of a domain is the greatest version (reader) ==
create or replace function pg_temp.g4_current(p_domain text, p_rpc boolean default true) returns text language plpgsql as $body$
declare prior text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), ''); v text;
begin
  perform pg_catalog.set_config('app.cms_rpc', case when p_rpc then 'true' else '' end, true);
  select coalesce(provider_state || ':' || coalesce(provider_key, '-') || ':' || coalesce(provider_version::text, '-'), 'none') into v
    from platform_private.cms_canonical_domain_current(p_domain);
  perform pg_catalog.set_config('app.cms_rpc', prior, true);
  return coalesce(v, 'none');
end;
$body$;
select is(pg_temp.g4_current('role'), 'built:shard02.role_facet_assertion:1',
  'the current row of role is its seed: built, provider shard02.role_facet_assertion at version 1 [P2-S12-AC-256]');
select is(pg_temp.g4_current('instrument'), 'unbuilt:-:-',
  'the current row of instrument is its unbuilt seed [P2-S12-AC-256]');
select is(pg_temp.g4_current('not-a-domain'), 'none',
  'a domain outside the closed set has no current row [P2-S12-AC-256]');
select is(pg_temp.g4_current('role', false), 'none',
  'context-cleared: outside the CMS RPC context the forced RLS conceals every registry row from the reader, so no provider is ever visible to an uncontexted caller [P2-S12-AC-256]');
select set_config('app.cms_rpc', 'true', true);
insert into platform_private.cms_canonical_domain_registry(owner_id, version, domain, provider_state, provider_key, provider_version)
values ('0d6a0d6a-0000-4000-8000-000000000135', 5, 'instrument', 'built', 'shard-x.instrument', 2);
insert into platform_private.cms_canonical_domain_registry(owner_id, version, domain, provider_state, provider_key, provider_version)
values ('0d6a0d6a-0000-4000-8000-000000000135', 4, 'instrument', 'unbuilt', null, null);
select set_config('app.cms_rpc', '', true);
select is(pg_temp.g4_current('instrument'), 'built:shard-x.instrument:2',
  'the current row is the one with the greatest version (5), not the one inserted last (4): an owning shard registers a provider by inserting a newer row [P2-S12-AC-256]');
select is(pg_temp.g4_current('role'), 'built:shard02.role_facet_assertion:1',
  'a newer row of one domain leaves every other domain''s current row alone [P2-S12-AC-256]');

select * from finish();
rollback;
