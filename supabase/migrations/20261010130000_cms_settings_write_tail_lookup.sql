-- BE03b E7 / DEC-163: ordinary writes initialize snapshots; reads only look up.
-- Preserve the six existing owned objects, privileges and all earlier branches.
-- Forward-only rollback: restore these six prior definitions in a new migration;
-- retain immutable snapshot rows. No backfill or generic completion change.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  cms_owner oid := 'wejammin_cms_definer'::pg_catalog.regrole;
  target record;
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  baselines jsonb := '[]'::jsonb;
  baseline jsonb;
  identity text;
  definition text;
  old_source text;
  new_source text;
  old_anchor text;
  new_anchor text;
  marker text;
  lookup_source text := $lookup$
declare
  snapshot_values jsonb;
  snapshot_digest text;
  found_ordinal bigint;
begin
  -- E7 lookup-only: never initialize publication settings on a read.
  if p_owner_id is null then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  snapshot_values := platform_private.cms_publication_settings_effective_values(
    p_owner_id, pg_catalog.clock_timestamp()
  );
  snapshot_digest := platform_private.cms_jcs_sha256(snapshot_values);
  select snapshot.ordinal into found_ordinal
    from platform_private.cms_publication_settings_snapshots snapshot
   where snapshot.owner_id = p_owner_id
     and snapshot.snapshot_hash = snapshot_digest;
  if found_ordinal is null then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;
  return pg_catalog.jsonb_build_object(
    'version', found_ordinal::text,
    'hash', snapshot_digest
  );
end;
$lookup$;
  tail_template text := $tail$
  -- E7 ordinary-write snapshot tail: after completed201, before return.
  declare
    settings_owner uuid;
    settings_values jsonb;
    settings_digest text;
    settings_registry bigint;
    settings_ordinal bigint;
  begin
    select resource.owner_id into settings_owner
      from platform_private.%I resource
     where resource.id = %I;
    if settings_owner is null then
      raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
    end if;
    settings_values := platform_private.cms_publication_settings_effective_values(
      settings_owner, pg_catalog.clock_timestamp()
    );
    settings_digest := platform_private.cms_jcs_sha256(settings_values);
    settings_registry := platform_private.cms_publication_settings_registry_version();
    -- Leaf: no later canonical lock or effective-value resolver evaluation.
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('cms.settings_snapshot:' || settings_owner::text, 0)
    );
    insert into platform_private.cms_publication_settings_snapshots(
      owner_id, state, version, ordinal, registry_version, snapshot_hash, effective_values
    )
    select settings_owner, 'active', 1,
           coalesce(pg_catalog.max(existing.ordinal), 0) + 1,
           settings_registry, settings_digest, settings_values
      from platform_private.cms_publication_settings_snapshots existing
     where existing.owner_id = settings_owner
    on conflict (owner_id, snapshot_hash) do nothing;
    select snapshot.ordinal into settings_ordinal
      from platform_private.cms_publication_settings_snapshots snapshot
     where snapshot.owner_id = settings_owner
       and snapshot.snapshot_hash = settings_digest;
    if settings_ordinal is null then
      raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
    end if;
  end;
$tail$;
begin
  if not exists (
    select 1 from pg_catalog.pg_roles role
     where role.oid = cms_owner and not role.rolcanlogin
       and not role.rolbypassrls and not role.rolsuper
  ) or pg_catalog.has_schema_privilege(cms_owner, 'platform_private', 'CREATE') then
    raise exception 'E7 unexpected CMS owner authority' using errcode = '55000';
  end if;

  -- Preflight every exact existing identity before replacing any definition.
  for target in
    select * from (values
      ('cms_settings_snapshot', 'uuid', 'p_owner_id',
       '81fceb00824647462f4b3eef19596235', null, null),
      ('cms_create_entry', 'jsonb', 'p_request',
       '4b3ff16fc36a2cf6e11353e3b2b313c6', 'cms_content_entries', 'entry_id'),
      ('cms_create_revision', 'jsonb', 'p_request',
       'f0bfdac1be9fee6f14873698bae2c953', 'cms_entry_revisions', 'new_revision_id'),
      ('cms_resolve_conflict', 'jsonb', 'p_request',
       '26ede79aefc8a7fcb2ee5330dc617af1', 'cms_entry_revisions', 'new_revision_id'),
      ('cms_restore_revision', 'jsonb', 'p_request',
       '551996cb945b4b09d634e19d39710a59', 'cms_entry_revisions', 'new_revision_id'),
      ('cms_author_locale_variant', 'jsonb', 'p_request',
       '9521f3178fc52bc9cfe05dc57a9a3e2c', 'cms_locale_variants', 'new_variant_id')
    ) mapping(function_name, argument_type, argument_name, fingerprint, resource_table, resource_id)
  loop
    identity := pg_catalog.format('platform_private.%I(%s)',
                                  target.function_name, target.argument_type);
    select proc.* into original from pg_catalog.pg_proc proc
     where proc.oid = pg_catalog.to_regprocedure(identity);
    if not found then
      raise exception 'E7 missing existing function: %', identity using errcode = '55000';
    end if;
    if original.proowner <> cms_owner or not original.prosecdef
       or original.prokind <> 'f' or original.provolatile <> 'v'
       or original.proconfig is distinct from array['search_path=""']::text[]
       or original.pronargs <> 1 or original.pronargdefaults <> 0
       or original.proargnames is distinct from array[target.argument_name]::text[]
       or pg_catalog.oidvectortypes(original.proargtypes) <> target.argument_type
       or original.prorettype <> 'jsonb'::pg_catalog.regtype or original.proretset
       or original.prolang <> (select oid from pg_catalog.pg_language where lanname = 'plpgsql')
       or pg_catalog.md5(original.prosrc) <> target.fingerprint
       or (select pg_catalog.count(*) from pg_catalog.aclexplode(
         coalesce(original.proacl, pg_catalog.acldefault('f', cms_owner)))) <> 1
       or exists (
         select 1 from pg_catalog.aclexplode(
           coalesce(original.proacl, pg_catalog.acldefault('f', cms_owner))) acl
          where acl.grantee <> cms_owner or acl.grantor <> cms_owner
             or acl.privilege_type <> 'EXECUTE' or acl.is_grantable
       ) then
      raise exception 'E7 unexpected baseline: %', identity using errcode = '55000';
    end if;
    definition := pg_catalog.pg_get_functiondef(original.oid);
    if (pg_catalog.length(definition) - pg_catalog.length(
          pg_catalog.replace(definition, original.prosrc, '')))
         / pg_catalog.length(original.prosrc) <> 1 then
      raise exception 'E7 ambiguous definition: %', identity using errcode = '55000';
    end if;
    baselines := baselines || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'identity', identity, 'oid', original.oid, 'source', original.prosrc,
      'definition', definition, 'metadata', pg_catalog.to_jsonb(original) - 'prosrc',
      'table', target.resource_table, 'id', target.resource_id
    ));
  end loop;

  for baseline in select value from pg_catalog.jsonb_array_elements(baselines)
  loop
    identity := baseline->>'identity';
    old_source := baseline->>'source';
    old_anchor := null;
    if baseline->>'table' is null then
      marker := '-- E7 lookup-only:';
      new_source := lookup_source;
    else
      marker := '-- E7 ordinary-write snapshot tail:';
      old_anchor := pg_catalog.format(
        E'  perform platform_private.cms_complete(reservation.id, %I, 201, response);\n  return response;',
        baseline->>'id'
      );
      if (pg_catalog.length(old_source) - pg_catalog.length(
            pg_catalog.replace(old_source, old_anchor, '')))
           / pg_catalog.length(old_anchor) <> 1 then
        raise exception 'E7 unexpected positive201 anchor: %', identity using errcode = '55000';
      end if;
      new_anchor := pg_catalog.replace(old_anchor, E'\n  return response;',
        pg_catalog.format(tail_template, baseline->>'table', baseline->>'id')
          || '  return response;');
      new_source := pg_catalog.replace(old_source, old_anchor, new_anchor);
      -- Exact inverse protects every earlier replay, 409 and error branch.
      if pg_catalog.replace(new_source, new_anchor, old_anchor) <> old_source then
        raise exception 'E7 non-tail change: %', identity using errcode = '55000';
      end if;
    end if;
    if pg_catalog.strpos(old_source, marker) <> 0 then
      raise exception 'E7 already marked baseline: %', identity using errcode = '55000';
    end if;
    definition := pg_catalog.replace(baseline->>'definition', old_source, new_source);
    execute definition;
    select proc.* into actual from pg_catalog.pg_proc proc
     where proc.oid = pg_catalog.to_regprocedure(identity);
    if not found then
      raise exception 'E7 missing replaced function: %', identity using errcode = '55000';
    end if;
    if actual.oid <> (baseline->>'oid')::oid or actual.prosrc <> new_source
       or pg_catalog.to_jsonb(actual) - 'prosrc' <> baseline->'metadata'
       or pg_catalog.pg_get_functiondef(actual.oid) <> definition
       or (pg_catalog.length(actual.prosrc) - pg_catalog.length(
             pg_catalog.replace(actual.prosrc, marker, ''))) / pg_catalog.length(marker) <> 1
       or (old_anchor is not null and pg_catalog.strpos(actual.prosrc, old_anchor) <> 0) then
      raise exception 'E7 replacement verification failed: %', identity using errcode = '55000';
    end if;
  end loop;
end;
$migration$;

comment on function platform_private.cms_settings_snapshot(uuid) is
  'BE03b E7 / DEC-163: lookup-only current owner settings snapshot {version: stored ordinal, hash}; missing exact hash => DEPENDENCY_UNAVAILABLE. VOLATILE, private, CMS RPC context; initialization occurs only at ordinary-write positive201 tails.';

commit;
