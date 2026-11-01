-- Slice 12 lane governed-v4 (DEC-221; BE03c "Governed review machinery" Invalidation and its changelog row "Governed lock failures and
-- revocation races"; BE03b "Write-path lock order and authority fencing" rule 3: "a lock failure there is CONFLICT, never 'not approved'"):
-- cms_governed_frozen_status must not report a lock failure as a changed dependency.
--
-- The promoted body (20261013300400) recomputes the frozen block/pattern digest inside a nested block whose handler is
--   exception when others then return 'changed';
-- so a lock timeout (55P03) or a deadlock (40P01) raised by the FOR SHARE reads of that digest was reported as `changed`: the recheck run, the
-- decision and the activation then invalidated a healthy review (subject back to draft, schedule cancelled, audit) instead of raising the
-- retryable conflict their platform_api wrappers map to CONFLICT.  The handler now re-raises exactly those two SQLSTATEs (the lock-failure
-- class of BE03b rule 3) before it falls through to the unchanged mapping: any other error of the digest (a missing, withdrawn or
-- incompatible block, VALIDATION_FAILED, CONFLICT) is still a genuine difference and is still reported as `changed`.
-- 57014 (query_canceled, a statement timeout) is deliberately NOT named: PL/pgSQL `when others` never traps it, so it already propagates.
--
-- The installed private function is amended by 1 guarded anchored replacement: the anchor occurs exactly once in the installed source, the
-- inverse replacement restores the installed source byte for byte, and every pg_proc attribute except the source (owner, SECURITY DEFINER,
-- search_path, ACL) is unchanged; only the comment gains one sentence.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  identity constant text := 'platform_private.cms_governed_frozen_status(uuid)';
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  old_source text;
  new_source text;
  inverse_source text;
  definition text;
  comment_text text;
  i integer;
  anchors_old text[] := array[
    $old$    exception when others then
      return 'changed';
    end;$old$
  ];
  anchors_new text[] := array[
    $new$    exception
      -- DEC-221: a lock timeout or a deadlock while the digest is recomputed is the retryable conflict (BE03b rule 3), never `changed`
      when deadlock_detected or lock_not_available then
        raise;
      when others then
        return 'changed';
    end;$new$
  ];
begin
  select proc.* into original from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found then
    raise exception 'DEC-221 missing existing function: %', identity using errcode = '55000';
  end if;
  old_source := original.prosrc;
  comment_text := pg_catalog.obj_description(original.oid, 'pg_proc');
  if original.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole
     or not original.prosecdef or original.prokind <> 'f' or original.provolatile <> 'v'
     or original.proretset or original.prorettype <> 'text'::pg_catalog.regtype
     or original.proconfig is distinct from array['search_path=""']::text[]
     or original.prolang <> (select oid from pg_catalog.pg_language where lanname = 'plpgsql') then
    raise exception 'DEC-221 unexpected baseline attributes: %', identity using errcode = '55000';
  end if;
  new_source := old_source;
  for i in 1 .. pg_catalog.cardinality(anchors_old) loop
    if (pg_catalog.length(new_source) - pg_catalog.length(pg_catalog.replace(new_source, anchors_old[i], '')))
         / pg_catalog.length(anchors_old[i]) <> 1
       or pg_catalog.strpos(old_source, anchors_new[i]) <> 0 then
      raise exception 'DEC-221 unexpected anchor % in %', i, identity using errcode = '55000';
    end if;
    new_source := pg_catalog.replace(new_source, anchors_old[i], anchors_new[i]);
  end loop;
  inverse_source := new_source;
  for i in reverse pg_catalog.cardinality(anchors_old) .. 1 loop
    if (pg_catalog.length(inverse_source) - pg_catalog.length(pg_catalog.replace(inverse_source, anchors_new[i], '')))
         / pg_catalog.length(anchors_new[i]) <> 1 then
      raise exception 'DEC-221 ambiguous inverse % in %', i, identity using errcode = '55000';
    end if;
    inverse_source := pg_catalog.replace(inverse_source, anchors_new[i], anchors_old[i]);
  end loop;
  if inverse_source is distinct from old_source then
    raise exception 'DEC-221 non-anchored change in %', identity using errcode = '55000';
  end if;
  definition := pg_catalog.pg_get_functiondef(original.oid);
  if definition is null or pg_catalog.length(old_source) = 0
     or (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, old_source, '')))
          / pg_catalog.length(old_source) <> 1 then
    raise exception 'DEC-221 ambiguous definition: %', identity using errcode = '55000';
  end if;
  execute pg_catalog.replace(definition, old_source, new_source);
  select proc.* into actual from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found or actual.oid <> original.oid or actual.prosrc is distinct from new_source
     or pg_catalog.to_jsonb(actual) - 'prosrc' is distinct from pg_catalog.to_jsonb(original) - 'prosrc'
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from comment_text then
    raise exception 'DEC-221 replacement changed more than the source: %', identity using errcode = '55000';
  end if;
  execute pg_catalog.format(
    'comment on function %s is %L', identity,
    comment_text || ' A lock timeout (55P03) or deadlock (40P01) raised while the block digest is recomputed is re-raised, never reported as changed (DEC-221).');
end;
$migration$;

commit;
