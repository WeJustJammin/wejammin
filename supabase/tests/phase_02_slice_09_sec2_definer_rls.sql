\ir support/jwt-claims.sqlinc
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- SEC-2 (RLS protects no real caller).  The platform `postgres` role bypasses
-- RLS and used to own every SECURITY DEFINER function, so the forced policies
-- never applied to any real caller.  The fix is structural: the functions that
-- touch a forced Slice 09 table are owned by a dedicated NOLOGIN, non-superuser,
-- non-BYPASSRLS role, so the policies bite inside the RPCs.  This file proves it
-- four ways, all against the REAL roles (no synthetic probe role):
--   A. catalog guard, matched N/N over the live function bodies;
--   B. behavioural RLS under the definer role with a forged and an authorized
--      published session;
--   C. behavioural grants: every platform_api function is called under SET ROLE
--      anon / authenticated / service_role with request.jwt.claims published;
--   D. the RPC flag does not leak: after an RPC (also a failed one) a direct
--      write in the same transaction is refused.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc

-- ---------------------------------------------------------------- A: catalog --
-- The Slice 09 forced-table set is DERIVED, never listed: every forced table
-- named cms_* plus every forced table whose policies depend on the CMS session
-- helpers.  The function set is every platform_private/platform_api function
-- whose body names one of those tables.
create temp table sec2_tables on commit drop as
select c.oid as table_oid, n.nspname as schema_name, c.relname as table_name
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where c.relforcerowsecurity and c.relkind in ('r', 'p')
   and ((n.nspname = 'platform_private' and c.relname like 'cms\_%')
        or c.oid in (
          select pol.polrelid
            from pg_policy pol
            join pg_depend d on d.classid = 'pg_policy'::regclass and d.objid = pol.oid
                            and d.refclassid = 'pg_proc'::regclass
            join pg_proc h on h.oid = d.refobjid
           where h.pronamespace = 'platform_private'::regnamespace
             and h.proname in ('cms_rpc_context_valid', 'cms_session_scope_ok', 'cms_session_scope_ok_report',
                               'cms_session_scope_ok_system', 'identity_session_scope_ok')));
create temp table sec2_functions on commit drop as
select p.oid as function_oid, n.nspname as schema_name, p.proname as function_name,
       p.proowner as owner_oid, p.prosecdef as is_definer, p.proconfig as config,
       p.oid::regprocedure::text as signature
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname in ('platform_private', 'platform_api') and p.prokind in ('f', 'p')
   and exists (
     select 1 from sec2_tables t
      where p.prosrc ~* ('(^|[^a-z0-9_])(' || t.schema_name || '\.)?' || t.table_name || '([^a-z0-9_]|$)'));

select cmp_ok((select count(*)::integer from sec2_tables), '>', 0, 'the Slice 09 forced-table set is derived from the catalog [P2-S09-AC-181]');
select cmp_ok((select count(*)::integer from sec2_functions), '>', 0, 'the set of functions whose body names a forced Slice 09 table is derived from the live bodies [P2-S09-AC-181]');
select is((select string_agg(t.table_name, ',' order by t.table_name)
             from sec2_tables t join pg_class c on c.oid = t.table_oid
            where not (c.relrowsecurity and c.relforcerowsecurity)), null,
  'RLS is enabled AND forced on every table of the set, including cms_workflow_policies (N/N) [P2-S09-AC-181] [P2-S09-AC-686]');
select is((select string_agg(t.schema_name || '.' || t.table_name || ':' || r.role_name || ':' || p.privilege, ',' order by t.table_name)
             from sec2_tables t
            cross join unnest(array['anon', 'authenticated', 'service_role']) r(role_name)
            cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) p(privilege)
           where has_table_privilege(r.role_name, t.table_oid, p.privilege)), null,
  'no API role (anon, authenticated, service_role) holds any table privilege on any table of the set (N/N) [P2-S09-AC-181] [P2-S09-AC-647] [P2-S09-AC-660] [P2-S09-AC-675]');

-- (a) every matching function is owned by a NOLOGIN, non-super, non-BYPASSRLS role.
select is((select string_agg(f.signature || ' owner=' || r.rolname, ',' order by f.signature)
             from sec2_functions f join pg_roles r on r.oid = f.owner_oid
            where r.rolcanlogin or r.rolsuper or r.rolbypassrls), null,
  'every function whose body reads or writes a forced Slice 09 table is owned by a NOLOGIN role with rolsuper = false and rolbypassrls = false (N/N over the live bodies) [P2-S09-AC-181]');
select is((select string_agg(f.signature, ',' order by f.signature)
             from sec2_functions f
            where f.is_definer and not (coalesce(f.config, array[]::text[]) @> array['search_path=""'])), null,
  'every such SECURITY DEFINER function pins an empty search_path (N/N) [P2-S09-AC-181]');
select is((select count(*)::integer from pg_roles
            where rolname in ('wejammin_cms_definer', 'wejammin_cms_authority_reader')
              and not rolcanlogin and not rolsuper and not rolbypassrls and not rolcreaterole
              and not rolcreatedb and not rolreplication), 2,
  'the definer and the authority-reader roles exist as NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION [P2-S09-AC-181]');
select is((select string_agg(distinct r.rolname, ',') from sec2_functions f join pg_roles r on r.oid = f.owner_oid
            where r.rolname not in ('wejammin_cms_definer', 'wejammin_cms_authority_reader')), null,
  'no other role owns a function of the set: ownership is one of the two dedicated roles [P2-S09-AC-181]');
select is((select string_agg(distinct m.rolname, ',')
             from pg_auth_members am join pg_roles m on m.oid = am.roleid
             join pg_roles g on g.oid = am.member
            where g.rolname in ('wejammin_cms_definer', 'wejammin_cms_authority_reader')), null,
  'neither dedicated role is a member of any other role (no inherited privilege or bypass) [P2-S09-AC-181]');
select is((select string_agg(g.rolname || ' member of ' || m.rolname, ',')
             from pg_auth_members am join pg_roles m on m.oid = am.roleid
             join pg_roles g on g.oid = am.member
            where m.rolname in ('wejammin_cms_definer', 'wejammin_cms_authority_reader')
              and g.rolname in ('anon', 'authenticated', 'service_role', 'authenticator', 'public')), null,
  'no API role can SET ROLE to either dedicated role [P2-S09-AC-181]');

-- least privilege: the roles hold privileges only on relations a function they
-- own names, and never CREATE, TRUNCATE, REFERENCES or TRIGGER.
select is((select string_agg(distinct rel.nspname || '.' || rel.relname || ':' || r.rolname, ',')
             from (select c.oid, n.nspname, c.relname, c.relkind
                     from pg_class c join pg_namespace n on n.oid = c.relnamespace
                    where c.relkind in ('r', 'p', 'v', 'm')
                      and n.nspname in ('platform_private', 'platform_api', 'identity', 'identity_private',
                                        'profile_private', 'profiles', 'audit_private', 'auth')) rel
            cross join pg_roles r
           where r.rolname in ('wejammin_cms_definer', 'wejammin_cms_authority_reader')
             and (has_table_privilege(r.oid, rel.oid, 'SELECT') or has_table_privilege(r.oid, rel.oid, 'INSERT')
                  or has_table_privilege(r.oid, rel.oid, 'UPDATE') or has_table_privilege(r.oid, rel.oid, 'DELETE'))
             and not exists (
               select 1 from pg_proc p
                where p.proowner = r.oid and p.pronamespace in ('platform_private'::regnamespace, 'platform_api'::regnamespace)
                  and p.prosrc ~* ('(^|[^a-z0-9_"])' || rel.nspname || '\.' || rel.relname || '([^a-z0-9_]|$)'))), null,
  'each dedicated role holds table privileges only on relations that a function it owns names (least privilege, N/N) [P2-S09-AC-181]');
select is((select string_agg(distinct rel.relname || ':' || r.rolname || ':' || p.privilege, ',')
             from pg_class rel join pg_namespace n on n.oid = rel.relnamespace
            cross join pg_roles r
            cross join unnest(array['TRUNCATE', 'REFERENCES', 'TRIGGER']) p(privilege)
           where r.rolname in ('wejammin_cms_definer', 'wejammin_cms_authority_reader')
             and rel.relkind in ('r', 'p') and n.nspname in ('platform_private', 'identity', 'identity_private', 'audit_private', 'auth')
             and has_table_privilege(r.oid, rel.oid, p.privilege)), null,
  'neither dedicated role holds TRUNCATE, REFERENCES or TRIGGER on any table [P2-S09-AC-181]');
select is((select string_agg(distinct n.nspname || ':' || r.rolname, ',')
             from pg_namespace n cross join pg_roles r
            where r.rolname in ('wejammin_cms_definer', 'wejammin_cms_authority_reader')
              and has_schema_privilege(r.oid, n.oid, 'CREATE') and n.nspname not like 'pg\_%'), null,
  'neither dedicated role may CREATE in any schema [P2-S09-AC-181]');
select is((select string_agg(t.schema_name || '.' || t.table_name || ':' || pol.polname, ',' order by t.table_name)
             from sec2_tables t join pg_policy pol on pol.polrelid = t.table_oid
            where coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') = 'true'
              and not (pol.polcmd = 'r' and (
                    pol.polroles = array[(select oid from pg_roles where rolname = 'wejammin_cms_authority_reader')]
                 or t.table_name in ('cms_workflow_policies', 'cms_schema_transform_registry', 'outbox_event_producers')))), null,
  'no table of the set carries a blanket USING (true) policy, except the SELECT-only reads of the code-owned registries and of the authority reader that owns the read-only session helpers [P2-S09-AC-181]');
select is((select string_agg(t.table_name || ':' || pol.polname, ',' order by t.table_name)
             from sec2_tables t join pg_policy pol on pol.polrelid = t.table_oid
            where pol.polcmd <> 'r' and (coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') = 'true'
                                         or coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '') = 'true')), null,
  'no write policy of any table of the set is a blanket true predicate [P2-S09-AC-181]');
select is((select string_agg(distinct rel.relname || ':' || p.privilege, ',')
             from pg_class rel join pg_namespace n on n.oid = rel.relnamespace
            cross join unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p(privilege)
           where n.nspname in ('platform_private', 'identity', 'identity_private', 'audit_private', 'auth') and rel.relkind in ('r', 'p')
             and has_table_privilege('wejammin_cms_authority_reader', rel.oid, p.privilege)), null,
  'the authority reader holds no write privilege on any table (it owns read-only helpers) [P2-S09-AC-181]');

-- ------------------------------------------------------------ fixtures ------
select pg_temp.s09d_create_type('x', 'sec2_x');
select pg_temp.s09d_to_review('x');
select pg_temp.s09d_assign('x', 'rev1');
select pg_temp.s09d_decide('x', 'rev1');

create temp table sec2_ctx on commit drop as
select pg_temp.s09d_id('ownerOrg') as owner_org,
       pg_temp.s09d_id('otherOrg') as other_org,
       pg_temp.s09d_id('x:review') as review_id,
       pg_temp.s09d_actor_id('owner', 'auth')::uuid as owner_auth,
       pg_temp.s09d_actor_id('owner', 'person')::uuid as owner_person,
       pg_temp.s09d_actor_id('rev1', 'auth')::uuid as rev1_auth,
       pg_temp.s09d_actor_id('rev1', 'person')::uuid as rev1_person,
       pg_temp.s09d_actor_id('other', 'auth')::uuid as other_auth,
       pg_temp.s09d_actor_id('other', 'person')::uuid as other_person;
select ok((select owner_org is not null and other_org is not null and other_org <> owner_org and review_id is not null from sec2_ctx),
  'fixture: two organizations and a frozen, assigned, decided review exist (provisioned through the real producers)');

-- ------------------------------------------------------------------ helpers --
-- Runs p_sql as p_role and returns the row count ('OK:n'), or the SQLSTATE and
-- message of the refusal.  SET LOCAL ROLE is always undone, even on error.
create or replace function pg_temp.sec2_as(p_role text, p_sql text) returns text
language plpgsql as $body$
declare n bigint;
begin
  begin
    execute format('set local role %I', p_role);
    execute p_sql;
    get diagnostics n = row_count;
    reset role;
    return 'OK:' || n;
  exception when others then
    reset role;
    return sqlstate || ':' || sqlerrm;
  end;
end;
$body$;
create or replace function pg_temp.sec2_count(p_role text, p_table text) returns bigint
language plpgsql as $body$
declare n bigint;
begin
  begin
    execute format('set local role %I', p_role);
    execute format('select count(*) from %s', p_table) into n;
    reset role;
    return n;
  exception when others then
    reset role;
    return -1;
  end;
end;
$body$;
-- INSERT built from the catalog: overrides for the scope columns, a type-correct
-- dummy for every other NOT NULL column without a default.  The policy's WITH
-- CHECK is evaluated before the constraints, so a refusal by the policy is
-- SQLSTATE 42501 and anything else means the policy admitted the row.
create or replace function pg_temp.sec2_insert_sql(p_table regclass, p_overrides jsonb) returns text
language plpgsql as $body$
declare cols text := ''; vals text := ''; a record; lit text;
begin
  for a in
    select att.attname, att.attnum, att.atttypid, att.attnotnull, att.atthasdef, att.attidentity, att.attgenerated,
           format_type(att.atttypid, att.atttypmod) as type_name, t.typtype, t.typcategory, t.typelem
      from pg_attribute att join pg_type t on t.oid = att.atttypid
     where att.attrelid = p_table and att.attnum > 0 and not att.attisdropped order by att.attnum
  loop
    continue when a.attgenerated <> '';
    if p_overrides ? a.attname then
      lit := format('%L::%s', p_overrides ->> a.attname, a.type_name);
    elsif a.atthasdef or a.attidentity <> '' or not a.attnotnull then
      continue;
    elsif a.typtype = 'e' then
      lit := format('%L::%s', (select enumlabel from pg_enum where enumtypid = a.atttypid order by enumsortorder limit 1), a.type_name);
    elsif a.typcategory = 'A' then lit := format('%L::%s', '{}', a.type_name);
    elsif a.type_name = 'uuid' then lit := 'extensions.gen_random_uuid()';
    elsif a.type_name in ('text', 'character varying') or a.type_name like 'character%' then lit := '''sec2''';
    elsif a.type_name in ('integer', 'bigint', 'smallint') or a.type_name like 'numeric%' then lit := format('1::%s', a.type_name);
    elsif a.type_name = 'boolean' then lit := 'false';
    elsif a.typcategory = 'D' then lit := format('%L::%s', pg_catalog.clock_timestamp()::text, a.type_name);
    elsif a.type_name = 'bytea' then lit := '''\x00''::bytea';
    elsif a.type_name in ('jsonb', 'json') then lit := format('%L::%s', '{}', a.type_name);
    else lit := 'null';
    end if;
    cols := cols || case when cols = '' then '' else ', ' end || quote_ident(a.attname);
    vals := vals || case when vals = '' then '' else ', ' end || lit;
  end loop;
  return format('insert into %s (%s) values (%s)', p_table, cols, vals);
end;
$body$;
create or replace function pg_temp.sec2_publish(p_actor uuid, p_party uuid, p_subject uuid, p_claim_role text)
returns void language plpgsql as $body$
begin
  perform set_config('app.cms_rpc', 'true', true);
  perform set_config('app.cms_session_actor', coalesce(p_actor::text, ''), true);
  perform set_config('app.cms_session_party', coalesce(p_party::text, ''), true);
  perform set_config('app.mfa_session_subject', coalesce(p_subject::text, ''), true);
  perform pg_temp.set_jwt_claim('role', p_claim_role, true);
end;
$body$;

-- ------------------------------------- B: behavioural RLS under the definer ---
create temp table sec2_scoped(table_name text primary key, overrides jsonb) on commit drop;
insert into sec2_scoped
select t.table_name, (select jsonb_build_object('owner_id', c.owner_org, 'review_id', c.review_id, 'report_id', (
                        select id from platform_private.cms_schema_dry_run_reports limit 1)) from sec2_ctx c)
  from unnest(array['cms_schema_reviews', 'cms_schema_review_decisions', 'cms_schema_review_assignments',
                    'cms_schema_dry_run_reports', 'cms_schema_dry_run_row_evidence',
                    'cms_schema_migration_target_rows', 'cms_schema_migration_plans',
                    'cms_capability_grants', 'cms_capability_grant_events']) t(table_name);
create temp table sec2_baseline(table_name text primary key, total bigint) on commit drop;
insert into sec2_baseline
select s.table_name, pg_temp.sec2_count('postgres', 'platform_private.' || s.table_name) from sec2_scoped s;
select cmp_ok((select total from sec2_baseline where table_name = 'cms_schema_reviews'), '>', 0::bigint, 'control: the platform owner sees the review rows the fixture created');
select cmp_ok((select count(*)::integer from sec2_baseline where total > 0), '>=', 7, 'control: at least seven of the nine scoped tables hold fixture rows created by real producers');

-- The definer holds only the privileges its functions need (proved in A), so on
-- most tables a write would be refused by the privilege before the policy is
-- reached.  To prove the POLICY on its own, every verb is granted to the definer
-- for the rest of this transaction (rolled back with it); every refusal below
-- must then name row-level security.
grant select, insert, update, delete on
  platform_private.cms_schema_reviews, platform_private.cms_schema_review_decisions,
  platform_private.cms_schema_review_assignments, platform_private.cms_schema_dry_run_reports,
  platform_private.cms_schema_dry_run_row_evidence, platform_private.cms_schema_migration_target_rows,
  platform_private.cms_schema_migration_plans, platform_private.cms_capability_grants,
  platform_private.cms_capability_grant_events, platform_private.cms_workflow_policies,
  platform_private.cms_schema_transform_registry, platform_private.cms_content_types,
  identity.mfa_factor_registry, identity.step_up_challenges, identity.mfa_verification_lockouts,
  identity.in_app_notification_intents
  to wejammin_cms_definer;
-- triggers other than the policy are irrelevant to the proof and would refuse
-- the synthetic rows first
-- NEGATIVE CONTROL: a direct statement (or trigger-bypassing tamper) against a producer-made row, proving that a guard refuses it or that a gate notices it; never a producer path, no authority or evidence is claimed.
do $do$
declare t record;
begin
  for t in select s.table_name from sec2_scoped s loop
    execute format('alter table platform_private.%I disable trigger user', t.table_name);
  end loop;
  alter table platform_private.cms_workflow_policies disable trigger user;
  alter table platform_private.cms_schema_transform_registry disable trigger user;
end
$do$;

select pg_temp.sec2_publish((select other_auth from sec2_ctx), (select owner_org from sec2_ctx), null, 'authenticated');
select is((select string_agg(s.table_name || '=' || pg_temp.sec2_count('wejammin_cms_definer', 'platform_private.' || s.table_name), ',' order by s.table_name)
             from sec2_scoped s join sec2_baseline b using (table_name) where b.total > 0
              and pg_temp.sec2_count('wejammin_cms_definer', 'platform_private.' || s.table_name) <> 0), null,
  'under the definer role, a forged published session (a non-member claiming the owner organization) with the RPC flag set reads NO foreign row from any scoped table that holds rows [P2-S09-AC-181] [P2-S09-AC-647] [P2-S09-AC-660] [P2-S09-AC-675]');
select pg_temp.sec2_publish(null, null, null, 'authenticated');
select is((select string_agg(s.table_name, ',' order by s.table_name)
             from sec2_scoped s join sec2_baseline b using (table_name) where b.total > 0
              and pg_temp.sec2_count('wejammin_cms_definer', 'platform_private.' || s.table_name) <> 0), null,
  'under the definer role, no published session and no service role reads no scoped row [P2-S09-AC-181]');
select pg_temp.sec2_publish((select other_auth from sec2_ctx), (select other_org from sec2_ctx), null, 'authenticated');
select is((select string_agg(s.table_name, ',' order by s.table_name)
             from sec2_scoped s join sec2_baseline b using (table_name) where b.total > 0
              and pg_temp.sec2_count('wejammin_cms_definer', 'platform_private.' || s.table_name) <> 0), null,
  'under the definer role, a real session of ANOTHER organization reads none of the owner organization''s scoped rows [P2-S09-AC-181]');

-- Refused BY THE POLICY: SQLSTATE 42501 naming row-level security.  (The
-- privileges were granted above, so a privilege refusal cannot hide here.)
create or replace function pg_temp.sec2_rls_refused(p_table regclass, p_overrides jsonb) returns boolean
language plpgsql as $body$
declare outcome text := pg_temp.sec2_as('wejammin_cms_definer', pg_temp.sec2_insert_sql(p_table, p_overrides));
begin
  return outcome like '42501:%row-level security%';
end;
$body$;
-- Admitted by the policy: not a row-level-security refusal and not a privilege refusal.
create or replace function pg_temp.sec2_rls_admitted(p_table regclass, p_overrides jsonb) returns boolean
language plpgsql as $body$
declare outcome text := pg_temp.sec2_as('wejammin_cms_definer', pg_temp.sec2_insert_sql(p_table, p_overrides));
begin
  return outcome not like '42501:%';
end;
$body$;

-- The policies evaluate the session scope once per statement through three lookups, while
-- cms_session_scope_ok decides one row at a time: the two must agree on every row, for every
-- kind of session (forged, another organization, the owner, an assigned reviewer, none, the
-- system scope).
create or replace function pg_temp.sec2_ids(p_role text, p_table text) returns text language plpgsql as $body$
declare result text;
begin
  execute format('set local role %I', p_role);
  execute format('select coalesce(string_agg(id::text, '','' order by id), '''') from platform_private.%I', p_table) into result;
  reset role;
  return result;
exception when others then
  reset role;
  return 'ERR:' || sqlerrm;
end;
$body$;
create or replace function pg_temp.sec2_equivalence() returns text language plpgsql as $body$
declare
  s record; t record; visible text; oracle text; mismatches text := '';
begin
  for s in
    select * from (values
      ('forged', (select other_auth from sec2_ctx), (select owner_org from sec2_ctx), 'authenticated'),
      ('other-org', (select other_auth from sec2_ctx), (select other_org from sec2_ctx), 'authenticated'),
      ('owner', (select owner_auth from sec2_ctx), (select owner_org from sec2_ctx), 'authenticated'),
      ('reviewer', (select rev1_auth from sec2_ctx), (select rev1_person from sec2_ctx), 'authenticated'),
      ('none', null::uuid, null::uuid, 'authenticated'),
      ('system', null::uuid, null::uuid, 'service_role')) v(label, actor, party, claim_role)
  loop
    perform pg_temp.sec2_publish(s.actor, s.party, null, s.claim_role);
    for t in
      select * from (values
        ('cms_schema_reviews', 'id'), ('cms_schema_review_decisions', 'review_id'),
        ('cms_schema_review_assignments', 'review_id'), ('cms_schema_dry_run_reports', 'null::uuid'),
        ('cms_schema_migration_plans', 'null::uuid'), ('cms_capability_grants', 'null::uuid'),
        ('cms_capability_grant_events', 'null::uuid'), ('cms_schema_migration_target_rows', 'null::uuid')) v(table_name, review_expr)
    loop
      visible := pg_temp.sec2_ids('wejammin_cms_definer', t.table_name);
      execute format('select coalesce(string_agg(id::text, '','' order by id), '''') from platform_private.%I where platform_private.cms_session_scope_ok(owner_id, %s)',
        t.table_name, t.review_expr) into oracle;
      if visible is distinct from oracle then
        mismatches := mismatches || s.label || ':' || t.table_name || ' ';
      end if;
    end loop;
    -- row evidence is keyed by report
    visible := pg_temp.sec2_ids('wejammin_cms_definer', 'cms_schema_dry_run_row_evidence');
    execute 'select coalesce(string_agg(id::text, '','' order by id), '''') from platform_private.cms_schema_dry_run_row_evidence where platform_private.cms_session_scope_ok_report(report_id)' into oracle;
    if visible is distinct from oracle then
      mismatches := mismatches || s.label || ':cms_schema_dry_run_row_evidence ';
    end if;
  end loop;
  perform pg_temp.sec2_publish(null, null, null, null);
  return nullif(mismatches, '');
end;
$body$;
select is(pg_temp.sec2_equivalence(), null,
  'the once-per-statement policy scope equals the single-row cms_session_scope_ok oracle on every row of every scoped table, for a forged, a foreign, the owner, a reviewer, no and the system session [P2-S09-AC-181]');
select pg_temp.sec2_publish(null, null, null, null);
select set_config('app.cms_rpc', '', true);

-- WITH CHECK refuses every write of a foreign or forged session (all nine).
select pg_temp.sec2_publish((select other_auth from sec2_ctx), (select owner_org from sec2_ctx), null, 'authenticated');
select is((select string_agg(s.table_name, ',' order by s.table_name)
             from sec2_scoped s
            where not pg_temp.sec2_rls_refused(('platform_private.' || s.table_name)::regclass, s.overrides)), null,
  'under the definer role a forged session''s INSERT into each of the nine scoped tables is refused by WITH CHECK (SQLSTATE 42501 naming row-level security, N/N) [P2-S09-AC-181] [P2-S09-AC-647] [P2-S09-AC-660] [P2-S09-AC-675]');
-- positive control: the same inserts under the AUTHORIZED session pass the policy
-- (they may then fail a constraint, but never the row-level security check)
select pg_temp.sec2_publish((select owner_auth from sec2_ctx), (select owner_org from sec2_ctx), null, 'authenticated');
select is((select string_agg(s.table_name, ',' order by s.table_name)
             from sec2_scoped s
            where not pg_temp.sec2_rls_admitted(('platform_private.' || s.table_name)::regclass, s.overrides)), null,
  'positive control: with the authorized session the owner organization''s inserts are admitted by the policy (N/N) [P2-S09-AC-181]');
select is((select string_agg(s.table_name || '=' || pg_temp.sec2_count('wejammin_cms_definer', 'platform_private.' || s.table_name) || '/' || b.total, ',' order by s.table_name)
             from sec2_scoped s join sec2_baseline b using (table_name)
            where b.total > 0 and pg_temp.sec2_count('wejammin_cms_definer', 'platform_private.' || s.table_name) <> b.total), null,
  'positive control: under the authorized owner session every scoped table shows exactly the owner rows the platform owner sees [P2-S09-AC-181] [P2-S09-AC-647] [P2-S09-AC-660]');
select pg_temp.sec2_publish(null, null, null, 'authenticated');

-- UPDATE and DELETE are filtered, never a way around the scope
select pg_temp.sec2_publish((select other_auth from sec2_ctx), (select owner_org from sec2_ctx), null, 'authenticated');
select is(pg_temp.sec2_as('wejammin_cms_definer', 'update platform_private.cms_schema_reviews set updated_at = updated_at'), 'OK:0',
  'a forged session''s UPDATE touches no review row [P2-S09-AC-647]');
select is(pg_temp.sec2_as('wejammin_cms_definer', 'delete from platform_private.cms_capability_grants'), 'OK:0',
  'a forged session''s DELETE removes no capability grant [P2-S09-AC-660]');
select is(pg_temp.sec2_as('wejammin_cms_definer', 'delete from platform_private.cms_schema_reviews'), 'OK:0',
  'a forged session''s DELETE removes no review [P2-S09-AC-647]');
select is((select count(*)::integer from platform_private.cms_capability_grants), (select total::integer from sec2_baseline where table_name = 'cms_capability_grants'),
  'and the grants are intact for the platform owner [P2-S09-AC-660]');

-- code-owned registries: readable, written only under the system scope
select pg_temp.sec2_publish((select owner_auth from sec2_ctx), (select owner_org from sec2_ctx), null, 'authenticated');
select is(pg_temp.sec2_count('wejammin_cms_definer', 'platform_private.cms_workflow_policies') > 0, true,
  'the code-owned workflow-policy registry is readable under a human session [P2-S09-AC-686]');
select ok(pg_temp.sec2_rls_refused('platform_private.cms_workflow_policies'::regclass, '{}'::jsonb),
  'a human session cannot insert a workflow policy: registry writes are system-scope only [P2-S09-AC-686]');
select is(pg_temp.sec2_as('wejammin_cms_definer', 'delete from platform_private.cms_workflow_policies'), 'OK:0',
  'a human session''s DELETE removes no workflow policy [P2-S09-AC-686]');
-- NEGATIVE CONTROL: a direct statement (or trigger-bypassing tamper) against a producer-made row, proving that a guard refuses it or that a gate notices it; never a producer path, no authority or evidence is claimed.
select is(pg_temp.sec2_as('wejammin_cms_definer', 'update platform_private.cms_workflow_policies set updated_at = updated_at'), 'OK:0',
  'a human session''s UPDATE changes no workflow policy [P2-S09-AC-686]');
select ok(pg_temp.sec2_rls_refused('platform_private.cms_schema_transform_registry'::regclass, '{}'::jsonb),
  'a human session cannot insert a transform registry row [P2-S09-AC-181]');
-- system scope: the verified service-role JWT with NO published human session
select pg_temp.sec2_publish(null, null, null, 'service_role');
select ok(pg_temp.sec2_rls_admitted('platform_private.cms_workflow_policies'::regclass, '{}'::jsonb),
  'the service-role system scope (no human session) is admitted by the registry policy [P2-S09-AC-181]');
select pg_temp.sec2_publish(null, null, null, 'authenticated');

-- identity tables: the published MFA subject, with a live eligible binding
create temp table sec2_identity(table_name text primary key, overrides jsonb) on commit drop;
insert into sec2_identity values
  ('mfa_factor_registry', '{}'), ('step_up_challenges', '{}'), ('mfa_verification_lockouts', '{}');
update sec2_identity set overrides = jsonb_build_object('auth_user_id', (select rev1_auth from sec2_ctx));
alter table identity.mfa_factor_registry disable trigger user;
alter table identity.step_up_challenges disable trigger user;
alter table identity.mfa_verification_lockouts disable trigger user;
select pg_temp.sec2_publish(null, null, (select other_auth from sec2_ctx), 'authenticated');
select is((select string_agg(i.table_name, ',' order by i.table_name)
             from sec2_identity i
            where not pg_temp.sec2_rls_refused(('identity.' || i.table_name)::regclass, i.overrides)), null,
  'under the definer role a published MFA subject that is not the row''s account cannot INSERT into any of the three MFA tables (N/N) [P2-S09-AC-181]');
select pg_temp.sec2_publish(null, null, (select rev1_auth from sec2_ctx), 'authenticated');
select is((select string_agg(i.table_name, ',' order by i.table_name)
             from sec2_identity i
            where not pg_temp.sec2_rls_admitted(('identity.' || i.table_name)::regclass, i.overrides)), null,
  'positive control: the published subject''s own rows are admitted by the policy [P2-S09-AC-181]');
select pg_temp.sec2_publish(null, null, null, 'authenticated');
select ok(pg_temp.sec2_rls_refused('identity.in_app_notification_intents'::regclass, '{}'::jsonb),
  'under the definer role a human session cannot write a notification intent (system scope only) [P2-S09-AC-181]');

alter table identity.mfa_factor_registry enable trigger user;
alter table identity.step_up_challenges enable trigger user;
alter table identity.mfa_verification_lockouts enable trigger user;
select pg_temp.sec2_publish(null, null, null, null);
select set_config('app.cms_rpc', '', true);

-- ---------------------------- C: behavioural grants per API role (N/N) --------
-- Every platform_api function is called under SET ROLE <api role> with that
-- role's verified claims in request.jwt.claims.  The call either reaches the
-- function (any outcome except "permission denied for function <it>") or is
-- refused at the function ACL.  Expected = the grant design, below.  A
-- "permission denied" for a table, schema or ANOTHER function inside a reached
-- call means the definer lacks a grant it needs, and is a defect.
create temp table sec2_calls(signature text, function_name text, role_name text, claimed boolean,
                             reached boolean, state text, message text) on commit drop;
create or replace function pg_temp.sec2_call_all() returns void language plpgsql as $body$
declare f record; r text; arglist text; state text; msg text; reached boolean;
        sub text := 'a9d10000-0000-4000-8000-000000000003';
begin
  for f in
    select p.oid, p.proname, p.oid::regprocedure::text as signature,
           (select string_agg('null', ', ') from generate_series(1, p.pronargs)) as args,
           (select string_agg(format('null::%s', format_type(t.oid, null)), ', ' order by a.ord)
              from unnest(coalesce(p.proargtypes::oid[], array[]::oid[])) with ordinality a(typ, ord)
              join pg_type t on t.oid = a.typ) as typed_args
      from pg_proc p where p.pronamespace = 'platform_api'::regnamespace and p.prokind = 'f'
     order by p.proname, p.oid
  loop
    foreach r in array array['anon', 'authenticated', 'service_role'] loop
      reached := true; state := null; msg := null;
      begin
        perform set_config('request.jwt.claims',
          case r when 'authenticated' then jsonb_build_object('role', r, 'sub', sub)::text
                 else jsonb_build_object('role', r)::text end, true);
        execute format('set local role %I', r);
        begin
          execute format('select %s(%s)', f.oid::regproc, coalesce(f.args, ''));
        exception when ambiguous_function then
          -- overloads of one arity: resolve with the declared types (the caller
          -- then needs USAGE on their schema, which is itself part of the design)
          execute format('select %s(%s)', f.oid::regproc, coalesce(f.typed_args, ''));
        end;
        reset role;
      exception when others then
        reset role;
        get stacked diagnostics msg = message_text;
        state := sqlstate;
        reached := not (sqlstate = '42501' and msg like 'permission denied for function ' || f.proname);
      end;
      insert into sec2_calls values (f.signature, f.proname, r, true, reached, state, msg);
    end loop;
  end loop;
  perform set_config('request.jwt.claims', '', true);
end;
$body$;
select pg_temp.sec2_call_all();

select cmp_ok((select count(distinct signature)::integer from sec2_calls), '=', (select count(*)::integer from pg_proc where pronamespace = 'platform_api'::regnamespace and prokind = 'f'),
  'every platform_api function was called under every API role (N/N) [P2-S09-AC-181]');
select is((select string_agg(c.role_name || ':' || c.signature, ',' order by c.signature)
             from sec2_calls c join pg_proc p on p.oid = c.signature::regprocedure
            where c.reached is distinct from has_function_privilege(c.role_name, p.oid, 'execute')), null,
  'behaviour matches the ACL for every function and role: an executable function is reached, a non-executable one is refused at the function (N/N) [P2-S09-AC-181]');
select is((select string_agg(distinct c.function_name, ',' order by c.function_name) from sec2_calls c
            where c.role_name = 'anon' and c.reached), 'get_public_party_projection,identity_organization_read,rpc_profile_public_facts',
  'grant design: anon reaches exactly the three public read projections [P2-S09-AC-181]');
select is((select string_agg(distinct c.function_name, ',' order by c.function_name) from sec2_calls c
            where c.role_name = 'authenticated' and c.reached
              and c.function_name !~ '^(identity_|rpc_|auth_|cms_(add_field_definition|bind_relation|create_type_draft|get_content_type_version|list_content_types)$|get_public_party_projection$|list_harness_fixtures$)'), null,
  'grant design: authenticated reaches only the human identity, profile and CMS authoring surface, never a Worker or system command [P2-S09-AC-181]');
select is((select string_agg(distinct c.function_name, ',' order by c.function_name) from sec2_calls c
            where c.role_name = 'service_role' and not c.reached
              and c.function_name ~ '^(cms_(claim|heartbeat|process|read|finalize|begin|verify|complete|rollback|release|dead_letter|acknowledge|activate_schema_migration|reconcile|sweep|get_schema_migration_plan)|ac265_)'), null,
  'grant design: service_role reaches every Worker command (N/N) [P2-S09-AC-181]');
select is((select string_agg(c.role_name || ':' || c.signature || ':' || c.state || ':' || c.message, ' | ' order by c.signature)
             from sec2_calls c
            where c.reached and c.state = '42501'), null,
  'no reached call fails with a permission-denied inside the definer: every function runs with the privileges it needs (N/N) [P2-S09-AC-181]');

-- ---------------------- D: the RPC flag does not leak out of an RPC -----------
-- Catalog guard, N/N over the live bodies: every platform_api function that sets the RPC flag
-- itself, or reaches (by name, transitively) a function that does, restores the previous
-- value before it returns.
select is((with recursive base as (
              select p.oid, n.nspname || '.' || p.proname as fq, n.nspname as schema_name, p.prosrc
                from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname in ('platform_private', 'platform_api') and p.prokind = 'f'),
            reach(oid) as (
              select oid from base where prosrc ~* $re$set_config\(\s*'app\.cms_rpc'\s*,\s*'true'$re$
              union
              select b.oid from base b join reach r on true join base g on g.oid = r.oid
               where b.prosrc ~* (replace(g.fq, '.', '\.') || '\s*\('))
          select string_agg(b.fq, ',' order by b.fq)
            from base b join reach r on r.oid = b.oid
           where b.schema_name = 'platform_api'
             and not (b.prosrc ~* $re$set_config\(\s*'app\.cms_rpc'\s*,\s*(rpc_previous|previous_rpc)\s*,\s*true\)$re$)), null,
  'every platform_api function that sets or reaches the RPC flag restores the previous value on return (N/N) [P2-S09-AC-181]');

select set_config('app.cms_rpc', '', true);
select pg_temp.s09d_session('owner');
select pg_temp.s09d_call('sec2:list', 'platform_api.cms_list_content_types', jsonb_build_object(
  'context', pg_temp.s09d_context('owner'), 'cursor', null, 'limit', 10));
select is(pg_temp.s09d_outcome('sec2:list'), 'OK', 'fixture: the owner reads the content types through CMS-03A-04');
select isnt(coalesce(current_setting('app.cms_rpc', true), ''), 'true',
  'after a CMS RPC returns, app.cms_rpc is restored to its previous value, not left set [P2-S09-AC-181]');
select is(pg_temp.sec2_as('wejammin_cms_definer', pg_temp.sec2_insert_sql('platform_private.cms_content_types'::regclass, '{}'::jsonb)),
  'P0001:DIRECT_CMS_TABLE_WRITE',
  'in the same transaction the definer role''s direct write to a guarded table is refused by the write guard [P2-S09-AC-181]');
-- NEGATIVE CONTROL: a direct statement (or trigger-bypassing tamper) against a producer-made row, proving that a guard refuses it or that a gate notices it; never a producer path, no authority or evidence is claimed.
alter table platform_private.cms_content_types disable trigger user;
select ok(pg_temp.sec2_rls_refused('platform_private.cms_content_types'::regclass, '{}'::jsonb),
  'and, with the guard trigger out of the way, by the RPC-context policy itself [P2-S09-AC-181]');
-- NEGATIVE CONTROL: a direct statement (or trigger-bypassing tamper) against a producer-made row, proving that a guard refuses it or that a gate notices it; never a producer path, no authority or evidence is claimed.
alter table platform_private.cms_content_types enable trigger user;
select throws_ok(pg_temp.sec2_insert_sql('platform_private.cms_content_types'::regclass, '{}'::jsonb), 'P0001', 'DIRECT_CMS_TABLE_WRITE',
  'and the platform owner''s direct write to a guarded table is refused by the write guard [P2-S09-AC-181]');
-- an RPC that fails: the flag is not left set either
select pg_temp.s09d_session('owner');
select pg_temp.s09d_call('sec2:bad', 'platform_api.cms_get_schema_review', jsonb_build_object('reviewId', gen_random_uuid(), 'context', pg_temp.s09d_context('owner')));
select isnt(pg_temp.s09d_outcome('sec2:bad'), 'OK', 'fixture: an RPC that raises');
select isnt(coalesce(current_setting('app.cms_rpc', true), ''), 'true', 'after a failed CMS RPC the flag is not left set [P2-S09-AC-181]');
-- nesting: an inner RPC call restores the OUTER value, not blank
select set_config('app.cms_rpc', 'true', true);
select pg_temp.s09d_call('sec2:nested', 'platform_api.cms_list_content_types', jsonb_build_object(
  'context', pg_temp.s09d_context('owner'), 'cursor', null, 'limit', 10));
select is(current_setting('app.cms_rpc', true), 'true', 'an RPC called while the flag was already set restores that previous value [P2-S09-AC-181]');
select set_config('app.cms_rpc', '', true);

select * from finish();
rollback;
