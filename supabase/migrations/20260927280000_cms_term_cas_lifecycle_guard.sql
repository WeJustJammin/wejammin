-- CMS-03C-03 term actions retain stable IDs and advance version on CAS.
-- Correct the prior private guard forward-only; the curator RPC still owns
-- cycle, overlap, survivor eligibility, and assignment-convergence checks.
begin;

create or replace function platform_private.cms_terms_lifecycle_guard()
returns trigger language plpgsql set search_path = '' as $body$
begin
  if tg_op = 'INSERT' then
    if new.lifecycle <> 'active' or new.successor_id is not null
       or new.version <> 1 or new.updated_at <> new.created_at then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' or old.lifecycle in ('merged', 'deprecated') then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  -- Rename/alias/hierarchy actions change only the bounded mutable surface.
  -- The stable key, owner, taxonomy, creator, and original creation time may
  -- never move, while every accepted action consumes exactly one version.
  if (to_jsonb(new) - 'lifecycle' - 'successor_id' - 'aliases'
       - 'parent_term_id' - 'version' - 'updated_at') is distinct from
     (to_jsonb(old) - 'lifecycle' - 'successor_id' - 'aliases'
       - 'parent_term_id' - 'version' - 'updated_at')
     or new.version <> old.version + 1
     or new.updated_at <= old.updated_at
     or (new.lifecycle = 'merged' and new.successor_id is null)
     or (new.lifecycle <> 'merged' and new.successor_id is not null) then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  return new;
end;
$body$;

revoke all on function platform_private.cms_terms_lifecycle_guard()
  from public, anon, authenticated, service_role;

commit;
