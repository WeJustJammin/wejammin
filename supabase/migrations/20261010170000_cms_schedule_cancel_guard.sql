-- CMS-03B-20 (BE03b "Schedule execution": "A schedule whose entry is not `active` at execution is `cancelled` with
-- `entry_unavailable`"; tracker P2-S11-AC-083, AC-122; review finding A-M7; orchestrator ruling 2026-10-11, which
-- supersedes DEC-158(d)'s "ScheduleExecutionResult omits cancelled" for this one case): the schedule state guard
-- admits ONE more transition, executing -> cancelled, and only with reason_code `entry_unavailable`.
--
-- Why a transition at all: a sweeper CLAIMS a due schedule (executing, lease held) and only then the entry leaves
-- `active`.  The review invalidation that the lifecycle change fires cancels `pending` and `failed_retryable`
-- schedules and leaves an executing one to its executor, which until now could only BLOCK it
-- (`approval_invalidated`).  The executor now reads the entry lifecycle under the entry row's FOR SHARE lock and
-- cancels the schedule in its own transaction (migration 20261010170100), so the guard must let the claimed
-- schedule go to `cancelled`.  Every other transition out of `executing` is unchanged (completed, failed_retryable,
-- blocked), no other reason cancels an executing schedule, and the guard's other rules (identity columns frozen, the
-- CAS pair, the attempt count, the terminal states) are untouched; the table CHECKs already require a cancelled
-- schedule to carry `approval_invalidated` or `entry_unavailable` and to hold no lease.
--
-- Only the listed anchor of the installed body changes (the installed source is pinned by MD5 and the replacement
-- is proved reversible), the owner, ACL, search_path and every other pg_proc attribute are preserved.  Forward-only:
-- rollback is a reviewed forward migration restoring the prior definition.
begin;
set local lock_timeout = '5s';

do $migration$
declare
  identity text := 'platform_private.cms_schedule_state_guard()';
  cms_owner oid := 'wejammin_cms_definer'::pg_catalog.regrole;
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  original_definition text;
  replacement_definition text;
  actual_definition text;
  replacement_source text;
  inverse_source text;
  original_metadata jsonb;
  original_comment text;
  old_anchor text := $old$      or (old.state = 'executing'
            and new.state in ('completed', 'failed_retryable', 'blocked'))
    ) then$old$;
  new_anchor text := $new$      or (old.state = 'executing'
            and new.state in ('completed', 'failed_retryable', 'blocked'))
      -- BE03b CMS-03B-20 (orchestrator ruling 2026-10-11 over DEC-158(d)): the executor cancels a claimed schedule whose
      -- entry is no longer active.  No other reason cancels an executing schedule: an invalidated approval blocks it.
      or (old.state = 'executing' and new.state = 'cancelled'
            and new.reason_code = 'entry_unavailable')
    ) then$new$;
begin
  if not exists (
    select 1 from pg_catalog.pg_roles role
     where role.oid = cms_owner
       and not role.rolcanlogin and not role.rolsuper and not role.rolbypassrls
  ) or pg_catalog.has_schema_privilege(cms_owner, 'platform_private', 'CREATE') then
    raise exception 'CMS schedule cancel guard owner baseline mismatch' using errcode = '55000';
  end if;

  select proc.* into original
    from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found then
    raise exception 'CMS schedule cancel guard function missing' using errcode = '55000';
  end if;
  original_definition := pg_catalog.pg_get_functiondef(original.oid);
  if pg_catalog.md5(original.prosrc) is distinct from 'be0cf18d76840b6722c28d7f85170dfb'
     or pg_catalog.md5(original_definition) is distinct from '904d575199e4e15058531f7ba5065e43'
     or original.proowner is distinct from cms_owner
     or original.prokind is distinct from 'f'
     or original.provolatile is distinct from 'v'
     or original.prosecdef is distinct from false
     or original.proisstrict is distinct from false
     or original.proleakproof is distinct from false
     or original.proparallel is distinct from 'u'
     or original.proconfig is distinct from array['search_path=""']::text[]
     or original.proacl is distinct from
       array['wejammin_cms_definer=X/wejammin_cms_definer']::pg_catalog.aclitem[]
     or original.pronargs is distinct from 0
     or original.prorettype is distinct from 'trigger'::pg_catalog.regtype
     or original.proretset is distinct from false
     or original.prolang is distinct from (
       select lang.oid from pg_catalog.pg_language lang where lang.lanname = 'plpgsql'
     ) then
    raise exception 'CMS schedule cancel guard function baseline mismatch (installed source md5 %, definition md5 %)',
      pg_catalog.md5(original.prosrc), pg_catalog.md5(original_definition) using errcode = '55000';
  end if;
  original_metadata := pg_catalog.to_jsonb(original) - 'prosrc';
  original_comment := pg_catalog.obj_description(original.oid, 'pg_proc');
  if (pg_catalog.length(original_definition) - pg_catalog.length(
        pg_catalog.replace(original_definition, original.prosrc, '')
      )) / pg_catalog.length(original.prosrc) <> 1 then
    raise exception 'CMS schedule cancel guard definition shape mismatch' using errcode = '55000';
  end if;

  if (pg_catalog.length(original.prosrc) - pg_catalog.length(
        pg_catalog.replace(original.prosrc, old_anchor, '')
      )) / pg_catalog.length(old_anchor) <> 1
     or pg_catalog.strpos(original.prosrc, new_anchor) <> 0 then
    raise exception 'CMS schedule cancel guard anchor mismatch' using errcode = '55000';
  end if;
  replacement_source := pg_catalog.replace(original.prosrc, old_anchor, new_anchor);
  -- Inverse proof: undoing the replacement restores the installed source byte for byte, so the one anchor is the
  -- ONLY body change.
  if (pg_catalog.length(replacement_source) - pg_catalog.length(
        pg_catalog.replace(replacement_source, new_anchor, '')
      )) / pg_catalog.length(new_anchor) <> 1
     or pg_catalog.replace(replacement_source, new_anchor, old_anchor) is distinct from original.prosrc then
    raise exception 'CMS schedule cancel guard source inverse mismatch' using errcode = '55000';
  end if;

  replacement_definition := pg_catalog.replace(original_definition, original.prosrc, replacement_source);
  if (pg_catalog.length(replacement_definition) - pg_catalog.length(
        pg_catalog.replace(replacement_definition, replacement_source, '')
      )) / pg_catalog.length(replacement_source) <> 1
     or pg_catalog.replace(replacement_definition, replacement_source, original.prosrc)
       is distinct from original_definition then
    raise exception 'CMS schedule cancel guard definition inverse mismatch' using errcode = '55000';
  end if;

  execute replacement_definition;

  select proc.* into actual from pg_catalog.pg_proc proc where proc.oid = original.oid;
  if not found then
    raise exception 'CMS schedule cancel guard replacement missing' using errcode = '55000';
  end if;
  actual_definition := pg_catalog.pg_get_functiondef(actual.oid);
  inverse_source := pg_catalog.replace(actual.prosrc, new_anchor, old_anchor);
  if actual.prosrc is distinct from replacement_source
     or (pg_catalog.to_jsonb(actual) - 'prosrc') is distinct from original_metadata
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from original_comment
     or actual_definition is distinct from replacement_definition
     or inverse_source is distinct from original.prosrc
     or pg_catalog.replace(actual_definition, actual.prosrc, inverse_source)
       is distinct from original_definition then
    raise exception 'CMS schedule cancel guard preservation mismatch' using errcode = '55000';
  end if;
end;
$migration$;

commit;
