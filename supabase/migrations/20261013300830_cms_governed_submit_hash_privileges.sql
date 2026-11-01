-- CMS-03C-06: the governed submit definer directly calls these two hash helpers.
-- Diagnostic RED: SQLSTATE 42501, permission denied for function cms_key_hash.
-- Add only non-grantable EXECUTE; preserve definitions, owners and every prior ACL.
-- Rollback: a separately reviewed forward migration may revoke only grants absent
-- from the pre-migration ACL. Never remove a pre-existing grant or edit applied SQL.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  v_definer_oid oid := pg_catalog.to_regrole('wejammin_cms_definer');
  v_identity text;
  v_original pg_catalog.pg_proc%rowtype;
  v_actual pg_catalog.pg_proc%rowtype;
  v_baselines jsonb := '[]'::jsonb;
  v_baseline jsonb;
  v_expected_acl jsonb;
  v_actual_acl jsonb;
begin
  if v_definer_oid is null then
    raise exception 'governed submit hash grantee is missing' using errcode = '55000';
  end if;

  -- Preflight both exact signatures before either grant. ACL defaults are expanded
  -- so NULL and explicit ACL representations compare by their actual privileges.
  for v_identity in
    select identity_name from (values
      ('platform_private.cms_key_hash(text)'),
      ('platform_private.cms_request_hash(jsonb)')
    ) targets(identity_name)
  loop
    select proc.* into v_original from pg_catalog.pg_proc proc
     where proc.oid = pg_catalog.to_regprocedure(v_identity);
    if not found or v_original.prokind is distinct from 'f' then
      raise exception 'governed submit hash function is missing: %', v_identity
        using errcode = '55000';
    end if;
    if pg_catalog.has_function_privilege(
      v_definer_oid, v_original.oid, 'EXECUTE WITH GRANT OPTION'
    ) is distinct from false then
      raise exception 'governed submit hash grant option already exists: %', v_identity
        using errcode = '55000';
    end if;

    -- A function owner is the grantor for these exact grants. UNION tolerates an
    -- already-present identical grant, while retaining every other ACL tuple.
    select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(acl)
             order by acl.grantor, acl.grantee, acl.privilege_type, acl.is_grantable)
      into v_expected_acl
      from (
        select prior_acl.* from pg_catalog.aclexplode(coalesce(
          v_original.proacl, pg_catalog.acldefault('f', v_original.proowner)
        )) prior_acl
        union
        select v_original.proowner, v_definer_oid, 'EXECUTE'::text, false
      ) acl;
    v_baselines := v_baselines || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'identity', v_identity,
        'metadata', pg_catalog.to_jsonb(v_original) - 'proacl',
        'expected_acl', v_expected_acl
      )
    );
  end loop;
  if pg_catalog.jsonb_array_length(v_baselines) <> 2 then
    raise exception 'governed submit hash preflight is incomplete' using errcode = '55000';
  end if;

  grant execute on function platform_private.cms_key_hash(text) to wejammin_cms_definer;
  grant execute on function platform_private.cms_request_hash(jsonb) to wejammin_cms_definer;

  for v_baseline in select value from pg_catalog.jsonb_array_elements(v_baselines)
  loop
    v_identity := v_baseline->>'identity';
    select proc.* into v_actual from pg_catalog.pg_proc proc
     where proc.oid = pg_catalog.to_regprocedure(v_identity);
    if not found then
      raise exception 'governed submit hash function disappeared: %', v_identity
        using errcode = '55000';
    end if;
    -- Includes OID, signature, owner, full source, language, security and config.
    if (pg_catalog.to_jsonb(v_actual) - 'proacl')
       is distinct from v_baseline->'metadata' then
      raise exception 'governed submit hash metadata changed: %', v_identity
        using errcode = '55000';
    end if;
    select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(acl)
             order by acl.grantor, acl.grantee, acl.privilege_type, acl.is_grantable)
      into v_actual_acl
      from pg_catalog.aclexplode(coalesce(
        v_actual.proacl, pg_catalog.acldefault('f', v_actual.proowner)
      )) acl;
    if v_actual_acl is distinct from v_baseline->'expected_acl'
       or pg_catalog.has_function_privilege(v_definer_oid, v_actual.oid, 'EXECUTE')
          is distinct from true
       or pg_catalog.has_function_privilege(
         v_definer_oid, v_actual.oid, 'EXECUTE WITH GRANT OPTION'
       ) is distinct from false then
      raise exception 'governed submit hash ACL delta is not exact: %', v_identity
        using errcode = '55000';
    end if;
  end loop;
end;
$migration$;

commit;
