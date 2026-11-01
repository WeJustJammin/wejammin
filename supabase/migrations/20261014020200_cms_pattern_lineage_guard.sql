-- Slice 12 lane pattern-def (BE03c Registry invariants 215-219, DEC-188; tracker P2-S12-AC-100, AC-103):
-- the lineage rules of a pattern version, folded into the EXISTING definition guard (no new trigger; the trigger
-- catalog suites count them).  A first version is its own lineage; a successor carries its parent's lineage and
-- must directly follow a row of the SAME owner and key; a direct insert that omits the lineage id gets the right
-- one (existing fixtures keep working), a wrong one is refused; the lineage id of a stored row never changes.
-- The governed-lifecycle early return of 20261013300000 and the in-place immutability of a draft are kept
-- exactly (every definition column of a stored row is frozen; only `state` and `updated_at` move).
-- The body names a forced CMS table, so (SEC-2) the definer role owns the function.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function platform_private.cms_pattern_versions_lifecycle_guard()
returns trigger
language plpgsql
set search_path = ''
as $body$
declare
  parent platform_private.cms_pattern_versions%rowtype;
  expected_lineage uuid;
begin
  if tg_op = 'INSERT' then
    if new.state <> 'draft' or new.updated_at <> new.created_at then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    if new.supersedes_id is null then
      expected_lineage := new.id;
    else
      select * into parent
        from platform_private.cms_pattern_versions candidate
       where candidate.id = new.supersedes_id;
      if not found
         or parent.owner_id <> new.owner_id
         or parent.pattern_key <> new.pattern_key
         or parent.version + 1 <> new.version then
        raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
      end if;
      expected_lineage := parent.pattern_id;
    end if;
    if new.pattern_id is null then
      new.pattern_id := expected_lineage;
    elsif new.pattern_id <> expected_lineage then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    return new;
  end if;
  -- BE03c governed lifecycle: only a governed RPC advances state, lifecycle_version, activated_at and retired_at.
  if tg_op = 'UPDATE' and platform_private.cms_governed_lifecycle_update(pg_catalog.to_jsonb(old), pg_catalog.to_jsonb(new)) then
    return new;
  end if;
  if tg_op = 'DELETE' or old.state in ('active','superseded','retired','blocked') then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if (pg_catalog.to_jsonb(new) - 'state' - 'updated_at') is distinct from
     (pg_catalog.to_jsonb(old) - 'state' - 'updated_at') or new.updated_at < old.updated_at then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  return new;
end;
$body$;

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_pattern_versions_lifecycle_guard() owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_pattern_versions_lifecycle_guard()
  from public, anon, authenticated, service_role;

commit;
