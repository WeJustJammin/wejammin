-- Slice 12 lane L1 (BE03c "Governed review machinery", "Subject state machine", Persisted model envelope,
-- DEC-137, DEC-180 G3; tracker P2-S12-AC-197, AC-205, AC-207, AC-249, AC-250): the lifecycle columns of a
-- governed subject version and the one rule that lets ONLY the governed RPCs advance them.
--
--   * activated_at, retired_at and lifecycle_version are added to the template, pattern and taxonomy
--     version tables.  lifecycle_version is the CAS counter of the lifecycle: it advances by exactly one on
--     every governed transition and is the aggregateVersion of the activation event (DEC-180 G3).  The row
--     `version` column stays what CMS-03C-01 made it, the DEFINITION number (templateVersion, the E14
--     uniqueness key, the If-Match operand of an edit): advancing it on a lifecycle transition would break
--     UNIQUE (owner, key, version) whenever a sibling successor holds the next number (retiring an active
--     version while a successor draft exists), so the lifecycle counter is a separate column.
--   * cms_governed_lifecycle_update(old, new) answers true only inside a governed RPC (the transaction-local
--     flag app.cms_governed_lifecycle), only when every definition column is unchanged, lifecycle_version
--     advances by one, the state pair is a legal move of the subject state machine and activated_at /
--     retired_at move exactly with it.
--   * the three definition guards (cms_template_versions_guard, cms_pattern_versions_lifecycle_guard,
--     cms_taxonomy_versions_lifecycle_guard) each gain ONE early return for such an update.  The text anchor
--     is the first terminal-state test of each guard; the amendment asserts exactly one occurrence, keeps
--     owner, ACL and attributes (CREATE OR REPLACE) and is idempotent.  Every other clause of the guards is
--     untouched, so a direct UPDATE (outside the flag) still sees the Slice 09 and FIX rules.
--   * the producer registry gains the cms.pattern. and cms.taxonomy. prefixes (BE03c "Job transport").
-- Runs on populated tables (defaults backfill every row).  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table platform_private.cms_template_versions
  add column if not exists activated_at timestamptz,
  add column if not exists retired_at timestamptz,
  add column if not exists lifecycle_version bigint not null default 1;
alter table platform_private.cms_pattern_versions
  add column if not exists activated_at timestamptz,
  add column if not exists retired_at timestamptz,
  add column if not exists lifecycle_version bigint not null default 1;
alter table platform_private.cms_taxonomy_versions
  add column if not exists activated_at timestamptz,
  add column if not exists retired_at timestamptz,
  add column if not exists lifecycle_version bigint not null default 1;

alter table platform_private.cms_template_versions
  add constraint cms_template_versions_lifecycle_version_check check (lifecycle_version > 0);
alter table platform_private.cms_pattern_versions
  add constraint cms_pattern_versions_lifecycle_version_check check (lifecycle_version > 0);
alter table platform_private.cms_taxonomy_versions
  add constraint cms_taxonomy_versions_lifecycle_version_check check (lifecycle_version > 0);

create or replace function platform_private.cms_governed_transition_legal(p_from text, p_to text)
returns boolean
language sql
immutable
set search_path = ''
as $body$
  select (p_from, p_to) in (
    ('draft', 'review'),
    ('review', 'approved'), ('review', 'draft'),
    ('approved', 'active'), ('approved', 'scheduled'), ('approved', 'draft'),
    ('scheduled', 'active'), ('scheduled', 'blocked'), ('scheduled', 'draft'),
    ('blocked', 'active'), ('blocked', 'scheduled'), ('blocked', 'draft'),
    ('active', 'superseded'), ('active', 'retired')
  )
$body$;

comment on function platform_private.cms_governed_transition_legal(text, text) is
  'BE03c Subject state machine: the legal (from, to) pairs of a governed subject version; superseded and retired are terminal. Private; IMMUTABLE.';

create or replace function platform_private.cms_governed_lifecycle_update(p_old jsonb, p_new jsonb)
returns boolean
language plpgsql
stable
set search_path = ''
as $body$
declare
  lifecycle_keys constant text[] := array['state', 'lifecycle_version', 'activated_at', 'retired_at', 'updated_at']::text[];
  old_state text := p_old->>'state';
  new_state text := p_new->>'state';
begin
  if pg_catalog.current_setting('app.cms_governed_lifecycle', true) is distinct from 'true'
     or pg_catalog.current_setting('app.cms_rpc', true) is distinct from 'true' then
    return false;
  end if;
  -- Every definition column (identity, hash, digest, key, version number, lineage, creator) is frozen.
  if (p_old - lifecycle_keys) is distinct from (p_new - lifecycle_keys) then
    return false;
  end if;
  if (p_new->>'lifecycle_version')::bigint is distinct from (p_old->>'lifecycle_version')::bigint + 1
     or (p_new->>'updated_at')::timestamptz < (p_old->>'updated_at')::timestamptz
     or not platform_private.cms_governed_transition_legal(old_state, new_state) then
    return false;
  end if;
  -- activated_at is stamped by the move to active and never otherwise changed; retired_at likewise.
  if new_state = 'active' then
    if p_new->>'activated_at' is null then return false; end if;
  elsif p_new->>'activated_at' is distinct from p_old->>'activated_at' then
    return false;
  end if;
  if new_state = 'retired' then
    if p_new->>'retired_at' is null then return false; end if;
  elsif p_new->>'retired_at' is distinct from p_old->>'retired_at' then
    return false;
  end if;
  return true;
end;
$body$;

comment on function platform_private.cms_governed_lifecycle_update(jsonb, jsonb) is
  'BE03c: true only for a governed lifecycle UPDATE of a subject version row: inside a governed RPC (app.cms_governed_lifecycle), definition columns unchanged, lifecycle_version + 1, a legal state pair, activated_at / retired_at moving with the state. Called by the three definition guards. Private; STABLE.';

-- The early return, inserted once before the first terminal-state test of each guard.
do $amend$
declare
  guard record;
  live pg_catalog.pg_proc%rowtype;
  anchor constant text := 'if tg_op = ''DELETE'' or old.state in (';
  marker constant text := 'cms_governed_lifecycle_update';
  insertion constant text := E'-- BE03c governed lifecycle: only a governed RPC advances state, lifecycle_version, activated_at and retired_at.\n  if tg_op = ''UPDATE'' and platform_private.cms_governed_lifecycle_update(pg_catalog.to_jsonb(old), pg_catalog.to_jsonb(new)) then\n    return new;\n  end if;\n  ';
  source text;
  occurrences integer;
begin
  for guard in
    select * from (values
      ('platform_private.cms_template_versions_guard()'),
      ('platform_private.cms_pattern_versions_lifecycle_guard()'),
      ('platform_private.cms_taxonomy_versions_lifecycle_guard()')
    ) as guarded(identity)
  loop
    select proc.* into live from pg_catalog.pg_proc proc
     where proc.oid = pg_catalog.to_regprocedure(guard.identity);
    if not found then
      raise exception 'governed lifecycle: % is missing', guard.identity using errcode = '55000';
    end if;
    source := live.prosrc;
    if pg_catalog.strpos(source, marker) > 0 then
      continue;
    end if;
    occurrences := (pg_catalog.length(source) - pg_catalog.length(pg_catalog.replace(source, anchor, '')))
                   / pg_catalog.length(anchor);
    if occurrences <> 1 or live.prolang <> (select lang.oid from pg_catalog.pg_language lang where lang.lanname = 'plpgsql')
       or live.prorettype <> 'trigger'::pg_catalog.regtype or live.prosecdef then
      raise exception 'governed lifecycle: % does not have the expected shape', guard.identity using errcode = '55000';
    end if;
    execute pg_catalog.format(
      'create or replace function %s returns trigger language plpgsql set search_path = %L as %L',
      guard.identity,
      '', pg_catalog.replace(source, anchor, insertion || anchor));
    select proc.* into live from pg_catalog.pg_proc proc
     where proc.oid = pg_catalog.to_regprocedure(guard.identity);
    if pg_catalog.strpos(live.prosrc, marker) = 0 then
      raise exception 'governed lifecycle: % was not amended', guard.identity using errcode = '55000';
    end if;
  end loop;
end;
$amend$;

-- Producer prefixes for the Slice 12 events and jobs (BE03c Job transport), inserted if absent.
select pg_catalog.set_config('app.cms_rpc', 'true', true);
insert into platform_private.outbox_event_producers(event_type_prefix, producer)
values ('cms.pattern.', 'cms.composition'), ('cms.taxonomy.', 'cms.composition')
on conflict (event_type_prefix) do nothing;

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_governed_transition_legal(text, text) owner to wejammin_cms_definer;
alter function platform_private.cms_governed_lifecycle_update(jsonb, jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_governed_transition_legal(text, text)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_governed_lifecycle_update(jsonb, jsonb)
  from public, anon, authenticated, service_role;
grant select, update on table
  platform_private.cms_template_versions,
  platform_private.cms_pattern_versions,
  platform_private.cms_taxonomy_versions
  to wejammin_cms_definer;

comment on column platform_private.cms_template_versions.lifecycle_version is
  'BE03c lifecycle CAS counter (+1 per governed transition); the aggregateVersion of the activation event. The definition number stays in version.';
comment on column platform_private.cms_pattern_versions.lifecycle_version is
  'BE03c lifecycle CAS counter (+1 per governed transition); the aggregateVersion of the activation event. The definition number stays in version.';
comment on column platform_private.cms_taxonomy_versions.lifecycle_version is
  'BE03c lifecycle CAS counter (+1 per governed transition); the aggregateVersion of the activation event. The definition number stays in version.';

commit;
