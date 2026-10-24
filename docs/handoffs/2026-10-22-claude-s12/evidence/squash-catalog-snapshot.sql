-- DEC-215 squash proof: catalog snapshot of the end state of the staged migration stack.
--
-- pgTAP-free. One TAP `ok` line per catalog object in platform_private, platform_api and public, followed by a
-- `# sha256:` diagnostic carrying the same hash. The hash covers the complete definition of the object:
--   function    pg_get_functiondef (source, signature, language, volatility, security mode, search_path), owner, ACL, comment
--   relation    kind, owner, ACL, options, RLS flags, every column (type, nullability, default, identity, generated,
--               collation, comment, column ACL), view definition or sequence parameters, comment
--   constraint  pg_get_constraintdef, validation/deferral flags, comment
--   index       pg_get_indexdef, validity, comment
--   policy      command, permissive flag, roles, USING and WITH CHECK expressions
--   trigger     pg_get_triggerdef, enabled state
--   type        enum labels, domain base type and constraints, composite attributes, owner, ACL, comment
--   schema      owner, ACL, default privileges
-- Object OIDs never enter a hash, so two stacks that build the same catalog in a different creation order give the
-- same lines. Run it FIRST in a staged run (right after the reset) before any other test commits anything. A history
-- refactor of the migrations is behaviour-neutral when the lines of the before-run and the after-run are identical
-- by object key (the number prefix shifts when an object is added or removed and is not part of the comparison).
-- Read-only: it issues no DDL, no DML and no GRANT.
\set QUIET 1
with objs as (
  -- functions and procedures
  select 'function ' || n.nspname || '.' || p.proname || '(' || pg_catalog.pg_get_function_identity_arguments(p.oid) || ')' as key,
         pg_catalog.pg_get_functiondef(p.oid)
           || E'\nowner=' || pg_catalog.pg_get_userbyid(p.proowner)
           || E'\nkind=' || p.prokind::text
           || E'\nacl=' || coalesce((
                select pg_catalog.string_agg(
                         (case when a.grantee = 0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(a.grantee) end) || ':' || a.privilege_type
                         || ':' || a.is_grantable::text || ':' || pg_catalog.pg_get_userbyid(a.grantor),
                         ',' order by (case when a.grantee = 0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(a.grantee) end), a.privilege_type, a.grantor)
                  from pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a), '')
           || E'\ncomment=' || coalesce(pg_catalog.obj_description(p.oid, 'pg_proc'), '<null>') as body
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('platform_private', 'platform_api', 'public')
     and p.prokind in ('f', 'p')
  union all
  -- relations, with their columns
  select 'relation ' || n.nspname || '.' || c.relname || ' ' || c.relkind::text,
         'relkind=' || c.relkind::text
           || E'\nowner=' || pg_catalog.pg_get_userbyid(c.relowner)
           || E'\npersistence=' || c.relpersistence::text
           || E'\nrls=' || c.relrowsecurity::text || '/' || c.relforcerowsecurity::text
           || E'\noptions=' || coalesce(c.reloptions::text, '<null>')
           || E'\nreplident=' || c.relreplident::text
           || E'\nacl=' || coalesce((
                select pg_catalog.string_agg(
                         (case when a.grantee = 0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(a.grantee) end) || ':' || a.privilege_type
                         || ':' || a.is_grantable::text || ':' || pg_catalog.pg_get_userbyid(a.grantor),
                         ',' order by (case when a.grantee = 0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(a.grantee) end), a.privilege_type, a.grantor)
                  from pg_catalog.aclexplode(coalesce(c.relacl,
                         pg_catalog.acldefault((case when c.relkind = 'S' then 's' else 'r' end)::"char", c.relowner))) a), '')
           || E'\ncomment=' || coalesce(pg_catalog.obj_description(c.oid, 'pg_class'), '<null>')
           || E'\ncolumns=' || coalesce((
                select pg_catalog.string_agg(
                         att.attname || '|' || pg_catalog.format_type(att.atttypid, att.atttypmod)
                         || '|nn=' || att.attnotnull::text
                         || '|def=' || coalesce(pg_catalog.pg_get_expr(def.adbin, def.adrelid), '<null>')
                         || '|id=' || att.attidentity::text || '|gen=' || att.attgenerated::text
                         || '|coll=' || coalesce((select co.collname from pg_catalog.pg_collation co where co.oid = att.attcollation and att.attcollation <> 0), '<none>')
                         || '|opts=' || coalesce(att.attoptions::text, '<null>')
                         || '|comment=' || coalesce(pg_catalog.col_description(c.oid, att.attnum), '<null>')
                         || '|acl=' || coalesce((
                              select pg_catalog.string_agg(
                                       (case when a.grantee = 0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(a.grantee) end) || ':' || a.privilege_type
                                       || ':' || a.is_grantable::text || ':' || pg_catalog.pg_get_userbyid(a.grantor),
                                       ',' order by (case when a.grantee = 0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(a.grantee) end), a.privilege_type, a.grantor)
                                from pg_catalog.aclexplode(att.attacl) a), ''),
                         E'\n' order by att.attnum)
                  from pg_catalog.pg_attribute att
                  left join pg_catalog.pg_attrdef def on def.adrelid = att.attrelid and def.adnum = att.attnum
                 where att.attrelid = c.oid and att.attnum > 0 and not att.attisdropped), '')
           || case when c.relkind in ('v', 'm') then E'\nviewdef=' || pg_catalog.pg_get_viewdef(c.oid, true) else '' end
           || case when c.relkind = 'S' then E'\nsequence=' || coalesce((
                select s.seqtypid::pg_catalog.regtype::text || '/' || s.seqstart || '/' || s.seqincrement || '/'
                       || s.seqmax || '/' || s.seqmin || '/' || s.seqcache || '/' || s.seqcycle::text
                  from pg_catalog.pg_sequence s where s.seqrelid = c.oid), '') else '' end
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('platform_private', 'platform_api', 'public')
     and c.relkind in ('r', 'p', 'v', 'm', 'S', 'f')
  union all
  -- constraints
  select 'constraint ' || n.nspname || '.' || c.relname || '.' || con.conname,
         'type=' || con.contype::text
           || E'\ndef=' || pg_catalog.pg_get_constraintdef(con.oid, true)
           || E'\nvalidated=' || con.convalidated::text || ' deferrable=' || con.condeferrable::text
           || ' deferred=' || con.condeferred::text
           || E'\ncomment=' || coalesce(pg_catalog.obj_description(con.oid, 'pg_constraint'), '<null>')
    from pg_catalog.pg_constraint con
    join pg_catalog.pg_class c on c.oid = con.conrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('platform_private', 'platform_api', 'public')
  union all
  -- indexes
  select 'index ' || n.nspname || '.' || ic.relname,
         pg_catalog.pg_get_indexdef(i.indexrelid)
           || E'\nvalid=' || i.indisvalid::text || ' ready=' || i.indisready::text
           || E'\ncomment=' || coalesce(pg_catalog.obj_description(i.indexrelid, 'pg_class'), '<null>')
    from pg_catalog.pg_index i
    join pg_catalog.pg_class ic on ic.oid = i.indexrelid
    join pg_catalog.pg_class tc on tc.oid = i.indrelid
    join pg_catalog.pg_namespace n on n.oid = tc.relnamespace
   where n.nspname in ('platform_private', 'platform_api', 'public')
  union all
  -- row-level security policies
  select 'policy ' || n.nspname || '.' || c.relname || '.' || pol.polname,
         'cmd=' || pol.polcmd::text || ' permissive=' || pol.polpermissive::text
           || E'\nroles=' || coalesce((
                select pg_catalog.string_agg((case when r.oid = 0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(r.oid) end), ',' order by r.oid)
                  from pg_catalog.unnest(pol.polroles) as r(oid)), '')
           || E'\nusing=' || coalesce(pg_catalog.pg_get_expr(pol.polqual, pol.polrelid), '<null>')
           || E'\ncheck=' || coalesce(pg_catalog.pg_get_expr(pol.polwithcheck, pol.polrelid), '<null>')
    from pg_catalog.pg_policy pol
    join pg_catalog.pg_class c on c.oid = pol.polrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('platform_private', 'platform_api', 'public')
  union all
  -- triggers
  select 'trigger ' || n.nspname || '.' || c.relname || '.' || t.tgname,
         pg_catalog.pg_get_triggerdef(t.oid, true) || E'\nenabled=' || t.tgenabled::text
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_class c on c.oid = t.tgrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where not t.tgisinternal and n.nspname in ('platform_private', 'platform_api', 'public')
  union all
  -- standalone types: enums, domains, composite types that are not table row types
  select 'type ' || n.nspname || '.' || ty.typname || ' ' || ty.typtype::text,
         'type=' || ty.typtype::text
           || E'\nowner=' || pg_catalog.pg_get_userbyid(ty.typowner)
           || E'\nbase=' || coalesce(pg_catalog.format_type(nullif(ty.typbasetype, 0), ty.typtypmod), '<none>')
           || E'\nnotnull=' || ty.typnotnull::text || ' default=' || coalesce(ty.typdefault, '<null>')
           || E'\nlabels=' || coalesce((
                select pg_catalog.string_agg(e.enumlabel, ',' order by e.enumsortorder)
                  from pg_catalog.pg_enum e where e.enumtypid = ty.oid), '')
           || E'\nconstraints=' || coalesce((
                select pg_catalog.string_agg(pg_catalog.pg_get_constraintdef(dc.oid, true), ',' order by dc.conname)
                  from pg_catalog.pg_constraint dc where dc.contypid = ty.oid), '')
           || E'\nattributes=' || coalesce((
                select pg_catalog.string_agg(att.attname || ':' || pg_catalog.format_type(att.atttypid, att.atttypmod),
                                             ',' order by att.attnum)
                  from pg_catalog.pg_attribute att
                 where att.attrelid = ty.typrelid and att.attnum > 0 and not att.attisdropped
                   and ty.typtype = 'c'), '')
           || E'\nacl=' || coalesce((
                select pg_catalog.string_agg(
                         (case when a.grantee = 0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(a.grantee) end) || ':' || a.privilege_type
                         || ':' || a.is_grantable::text,
                         ',' order by (case when a.grantee = 0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(a.grantee) end), a.privilege_type)
                  from pg_catalog.aclexplode(coalesce(ty.typacl, pg_catalog.acldefault('T', ty.typowner))) a), '')
           || E'\ncomment=' || coalesce(pg_catalog.obj_description(ty.oid, 'pg_type'), '<null>')
    from pg_catalog.pg_type ty
    join pg_catalog.pg_namespace n on n.oid = ty.typnamespace
   where n.nspname in ('platform_private', 'platform_api', 'public')
     and ty.typtype in ('e', 'd', 'c')
     and (ty.typtype <> 'c' or exists (
            select 1 from pg_catalog.pg_class tc where tc.oid = ty.typrelid and tc.relkind = 'c'))
  union all
  -- schemas and default privileges
  select 'schema ' || n.nspname,
         'owner=' || pg_catalog.pg_get_userbyid(n.nspowner)
           || E'\nacl=' || coalesce((
                select pg_catalog.string_agg(
                         (case when a.grantee = 0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(a.grantee) end) || ':' || a.privilege_type
                         || ':' || a.is_grantable::text || ':' || pg_catalog.pg_get_userbyid(a.grantor),
                         ',' order by (case when a.grantee = 0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(a.grantee) end), a.privilege_type, a.grantor)
                  from pg_catalog.aclexplode(coalesce(n.nspacl, pg_catalog.acldefault('n', n.nspowner))) a), '')
           || E'\ncomment=' || coalesce(pg_catalog.obj_description(n.oid, 'pg_namespace'), '<null>')
           || E'\ndefaults=' || coalesce((
                select pg_catalog.string_agg(
                         pg_catalog.pg_get_userbyid(d.defaclrole) || ':' || d.defaclobjtype::text || ':' || d.defaclacl::text,
                         ',' order by pg_catalog.pg_get_userbyid(d.defaclrole), d.defaclobjtype)
                  from pg_catalog.pg_default_acl d where d.defaclnamespace = n.oid), '')
    from pg_catalog.pg_namespace n
   where n.nspname in ('platform_private', 'platform_api', 'public')
), hashed as (
  select key,
         pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(body, 'UTF8')), 'hex') as digest
    from objs
), numbered as (
  select pg_catalog.row_number() over (order by key collate "C") as n, key, digest from hashed
)
select line from (
  select 0::numeric as ord, '1..' || (select pg_catalog.count(*) from numbered) as line
  union all
  select n, 'ok ' || n || ' - ' || key from numbered
  union all
  select n + 0.5, '# sha256:' || digest || ' ' || key from numbered
) lines
order by ord;
