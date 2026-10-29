-- Slice 12 lane nestable-read, DEC-232 (root amendment 2026-10-27 "DEC-232 read consistency"; BE03c field matrix CMS-03C-12 patternKey row, E13, AC-172):
-- `nestable` joins `context`, `versions`, `selector` and `new` as a RESERVED pattern key.  `GET /api/v1/cms/patterns/nestable` is the nestable read
-- (20261027100000), so a pattern of that key could be saved but never read back through cmsPatternLatestRead.
-- Three enforcement points are amended (forward-only):
--   1. platform_private.cms_create_pattern_version(jsonb)  the `key_reserved` refusal at /patternKey          (20261014020400)
--   2. platform_private.cms_pattern_latest(jsonb)          the reserved path key is INVALID_REQUEST           (20261014020500)
--   3. cms_pattern_versions_pattern_key_not_reserved       the storage check constraint                       (20261014020100)
-- Each function is amended by ONE guarded anchored replacement in the installed source (the DEC-210 precedent 20261022080200): the anchor occurs
-- exactly once, the inverse replacement restores the installed source byte for byte, and every pg_proc attribute except the source (owner, SECURITY
-- DEFINER, search_path, ACL, comment) is unchanged.  The constraint is dropped and re-added in one statement with the five keys; adding it validates
-- every stored row, so the statement is preceded by an explicit pre-check (V14-04, PAT-025): a stored pattern version that holds the key `nestable`
-- (the old four-key CHECK allowed it) stops the migration with SQLSTATE 55000 and a message naming the count, never a bare 23514, and nothing
-- is changed.  The shape of the installed constraint is asserted before and after.  The text between the BEGIN/END NESTABLE-RESERVED-DDL markers is
-- replayed verbatim by the populated-table witness supabase/tests/phase_02_slice_12_nestable_read_populated.sql (the two copies must stay
-- byte-identical; tests/contracts/phase-02-slice-12-nestable-reserved-witness-parity.test.ts).
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  identities constant text[] := array[
    'platform_private.cms_create_pattern_version(jsonb)', 'platform_private.cms_pattern_latest(jsonb)'];
  anchors_old constant text[] := array[
    $old$  if v_key in ('context', 'versions', 'selector', 'new') then$old$,
    $old$     or p_request->>'patternKey' in ('context', 'versions', 'selector', 'new') then$old$];
  anchors_new constant text[] := array[
    $new$  if v_key in ('context', 'versions', 'selector', 'nestable', 'new') then$new$,
    $new$     or p_request->>'patternKey' in ('context', 'versions', 'selector', 'nestable', 'new') then$new$];
  identity text;
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  old_source text;
  new_source text;
  inverse_source text;
  definition text;
  comment_text text;
  i integer;
begin
  for i in 1 .. pg_catalog.cardinality(identities) loop
    identity := identities[i];
    select proc.* into original from pg_catalog.pg_proc proc where proc.oid = pg_catalog.to_regprocedure(identity);
    if not found then
      raise exception 'DEC-232 missing existing function: %', identity using errcode = '55000';
    end if;
    old_source := original.prosrc;
    comment_text := pg_catalog.obj_description(original.oid, 'pg_proc');
    if (pg_catalog.length(old_source) - pg_catalog.length(pg_catalog.replace(old_source, anchors_old[i], '')))
         / pg_catalog.length(anchors_old[i]) <> 1
       or pg_catalog.strpos(old_source, anchors_new[i]) <> 0 then
      raise exception 'DEC-232 unexpected anchor in %', identity using errcode = '55000';
    end if;
    new_source := pg_catalog.replace(old_source, anchors_old[i], anchors_new[i]);
    inverse_source := pg_catalog.replace(new_source, anchors_new[i], anchors_old[i]);
    if (pg_catalog.length(new_source) - pg_catalog.length(pg_catalog.replace(new_source, anchors_new[i], '')))
         / pg_catalog.length(anchors_new[i]) <> 1
       or inverse_source is distinct from old_source then
      raise exception 'DEC-232 non-anchored change in %', identity using errcode = '55000';
    end if;
    definition := pg_catalog.pg_get_functiondef(original.oid);
    if definition is null or pg_catalog.length(old_source) = 0
       or (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, old_source, '')))
            / pg_catalog.length(old_source) <> 1 then
      raise exception 'DEC-232 ambiguous definition: %', identity using errcode = '55000';
    end if;
    execute pg_catalog.replace(definition, old_source, new_source);
    select proc.* into actual from pg_catalog.pg_proc proc where proc.oid = pg_catalog.to_regprocedure(identity);
    if not found or actual.oid <> original.oid or actual.prosrc is distinct from new_source
       or pg_catalog.to_jsonb(actual) - 'prosrc' is distinct from pg_catalog.to_jsonb(original) - 'prosrc'
       or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from comment_text then
      raise exception 'DEC-232 replacement changed more than the source: %', identity using errcode = '55000';
    end if;
  end loop;
end;
$migration$;

-- BEGIN NESTABLE-RESERVED-DDL
do $check$
declare
  stored bigint;
  constraint_text text;
begin
  select pg_catalog.count(*) into stored from platform_private.cms_pattern_versions where pattern_key = 'nestable';
  if stored > 0 then
    raise exception 'DEC-232 refused: % stored pattern version(s) hold the reserved key nestable; re-key or remove them before this migration', stored
      using errcode = '55000';
  end if;
  select pg_catalog.pg_get_constraintdef(con.oid) into constraint_text from pg_catalog.pg_constraint con
   where con.conrelid = 'platform_private.cms_pattern_versions'::pg_catalog.regclass
     and con.conname = 'cms_pattern_versions_pattern_key_not_reserved';
  if constraint_text is null or constraint_text !~ '''context''.*''versions''.*''selector''.*''new''' or constraint_text ~ 'nestable' then
    raise exception 'DEC-232 unexpected installed constraint: %', constraint_text using errcode = '55000';
  end if;
end;
$check$;

alter table platform_private.cms_pattern_versions
  drop constraint cms_pattern_versions_pattern_key_not_reserved,
  add constraint cms_pattern_versions_pattern_key_not_reserved
    check (pattern_key not in ('context', 'versions', 'selector', 'nestable', 'new'));
-- END NESTABLE-RESERVED-DDL

do $verify$
declare
  constraint_text text;
begin
  select pg_catalog.pg_get_constraintdef(con.oid) into constraint_text from pg_catalog.pg_constraint con
   where con.conrelid = 'platform_private.cms_pattern_versions'::pg_catalog.regclass
     and con.conname = 'cms_pattern_versions_pattern_key_not_reserved' and con.convalidated;
  if constraint_text is null or constraint_text !~ '''context''.*''versions''.*''selector''.*''nestable''.*''new''' then
    raise exception 'DEC-232 constraint not replaced: %', constraint_text using errcode = '55000';
  end if;
end;
$verify$;

commit;
