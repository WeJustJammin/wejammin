-- Slice 12 lane related, the two helpers of CMS-03C-05 (BE03c Related-content eligibility and derived rules
-- (D11, OD-5) 1381-1383, Transaction 1510; tracker P2-S12-AC-228, AC-230):
--
--   cms_related_rules_replace(entry, owner, actor, instant, pins, exclusions, rule key, rule version, bound)
--       returns void   replaces the whole rule set of one source by APPENDING rows: `revoked` for a pin or
--       exclusion that is gone and for a pin whose position moved, `active` for a new item, a revoked-then-active
--       pair for a derived rule that changed; versions are max + 1 per (source, target, mode) and per
--       (source, derived).  Nothing is updated; an unchanged item adds no row.
--   cms_related_eligible_count(entry, pins, exclusions, rule key, bound) returns integer
--       the write-time eligibleCount: min(128, pins + derived candidates) for the source current draft revision
--       locale and the audience of the source's most recent active publication (0 derived when it has none).
--
-- Private, SECURITY DEFINER owned by the CMS definer (SEC-2); callers hold the entry lock and run under the CMS
-- RPC context.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create function platform_private.cms_related_rules_replace(
  p_entry_id uuid,
  p_owner_id uuid,
  p_actor_id uuid,
  p_snapshot timestamptz,
  p_pins uuid[],
  p_exclusions uuid[],
  p_rule_key text,
  p_rule_version bigint,
  p_rule_bound integer
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  current_derived platform_private.cms_related_content_rules%rowtype;
  had_derived boolean;
begin
  -- Revoke pins and exclusions that are gone, and pins whose position moved.
  insert into platform_private.cms_related_content_rules(
    owner_id, state, version, created_at, updated_at, source_entry_id, target_entry_id,
    mode, reason_code, position, created_by
  )
  select p_owner_id, 'revoked', live.version + 1, p_snapshot, p_snapshot, p_entry_id,
         live.target_entry_id, live.mode, live.reason_code, live.position, p_actor_id
    from (select distinct on (rule_row.mode, rule_row.target_entry_id) rule_row.*
            from platform_private.cms_related_content_rules rule_row
           where rule_row.source_entry_id = p_entry_id and rule_row.mode in ('pin', 'exclude')
           order by rule_row.mode, rule_row.target_entry_id, rule_row.version desc) live
   where live.state = 'active'
     and ((live.mode = 'pin' and not exists (
             select 1 from pg_catalog.unnest(p_pins) with ordinality wanted(id, ord)
              where wanted.id = live.target_entry_id and wanted.ord - 1 = live.position))
          or (live.mode = 'exclude' and not (live.target_entry_id = any(p_exclusions))));
  -- Add pins and exclusions that are new, or that were just revoked for a changed position.
  insert into platform_private.cms_related_content_rules(
    owner_id, state, version, created_at, updated_at, source_entry_id, target_entry_id,
    mode, reason_code, position, created_by
  )
  select p_owner_id, 'active',
         coalesce((select pg_catalog.max(history.version) from platform_private.cms_related_content_rules history
                    where history.source_entry_id = p_entry_id and history.target_entry_id = wanted.id
                      and history.mode = 'pin'), 0) + 1,
         p_snapshot, p_snapshot, p_entry_id, wanted.id, 'pin', 'MANUAL_PIN', (wanted.ord - 1)::integer, p_actor_id
    from pg_catalog.unnest(p_pins) with ordinality wanted(id, ord)
   where not exists (
     select 1 from (select distinct on (rule_row.target_entry_id) rule_row.*
                      from platform_private.cms_related_content_rules rule_row
                     where rule_row.source_entry_id = p_entry_id and rule_row.mode = 'pin'
                     order by rule_row.target_entry_id, rule_row.version desc) live
      where live.target_entry_id = wanted.id and live.state = 'active' and live.position = wanted.ord - 1);
  insert into platform_private.cms_related_content_rules(
    owner_id, state, version, created_at, updated_at, source_entry_id, target_entry_id,
    mode, reason_code, position, created_by
  )
  select p_owner_id, 'active',
         coalesce((select pg_catalog.max(history.version) from platform_private.cms_related_content_rules history
                    where history.source_entry_id = p_entry_id and history.target_entry_id = wanted.id
                      and history.mode = 'exclude'), 0) + 1,
         p_snapshot, p_snapshot, p_entry_id, wanted.id, 'exclude', 'MANUAL_EXCLUSION', null, p_actor_id
    from pg_catalog.unnest(p_exclusions) wanted(id)
   where not exists (
     select 1 from (select distinct on (rule_row.target_entry_id) rule_row.*
                      from platform_private.cms_related_content_rules rule_row
                     where rule_row.source_entry_id = p_entry_id and rule_row.mode = 'exclude'
                     order by rule_row.target_entry_id, rule_row.version desc) live
      where live.target_entry_id = wanted.id and live.state = 'active');
  -- The derived rule: revoke a live rule that is gone or changed, then add the requested one.
  select * into current_derived from platform_private.cms_related_content_rules rule_row
   where rule_row.source_entry_id = p_entry_id and rule_row.mode = 'derived'
   order by rule_row.version desc limit 1;
  had_derived := found;
  if had_derived and current_derived.state = 'active'
     and (p_rule_key is null or current_derived.rule_key <> p_rule_key or current_derived.rule_version <> p_rule_version
          or current_derived.max_candidates <> p_rule_bound) then
    insert into platform_private.cms_related_content_rules(
      owner_id, state, version, created_at, updated_at, source_entry_id, target_entry_id, rule_key, rule_version,
      mode, reason_code, position, created_by, max_candidates
    ) values (
      p_owner_id, 'revoked', current_derived.version + 1, p_snapshot, p_snapshot, p_entry_id, null,
      current_derived.rule_key, current_derived.rule_version, 'derived', current_derived.reason_code, null, p_actor_id,
      current_derived.max_candidates
    );
    current_derived.state := 'revoked';
    current_derived.version := current_derived.version + 1;
  end if;
  if p_rule_key is not null and (not had_derived or current_derived.state <> 'active') then
    insert into platform_private.cms_related_content_rules(
      owner_id, state, version, created_at, updated_at, source_entry_id, target_entry_id, rule_key, rule_version,
      mode, reason_code, position, created_by, max_candidates
    ) values (
      p_owner_id, 'active', coalesce(current_derived.version, 0) + 1, p_snapshot, p_snapshot,
      p_entry_id, null, p_rule_key, p_rule_version, 'derived',
      pg_catalog.upper(platform_private.cms_related_rule_reason(p_rule_key)), null, p_actor_id, p_rule_bound
    );
  end if;
end;
$body$;

create function platform_private.cms_related_eligible_count(
  p_entry_id uuid,
  p_pins uuid[],
  p_exclusions uuid[],
  p_rule_key text,
  p_rule_bound integer
)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  source_locale text;
  source_audience text;
  derived_count integer := 0;
begin
  if p_rule_key is not null then
    select revision.locale into source_locale
      from platform_private.cms_content_entries entry
      join platform_private.cms_entry_revisions revision on revision.id = entry.current_draft_revision_id
     where entry.id = p_entry_id;
    select head.audience into source_audience
      from platform_private.cms_publication_versions head
     where head.entry_id = p_entry_id and head.action = 'publish'
       and not exists (select 1 from platform_private.cms_publication_versions later
                        where later.entry_id = head.entry_id and later.locale = head.locale
                          and later.audience = head.audience and later.version > head.version)
     order by head.created_at desc, head.id desc
     limit 1;
    if source_locale is not null and source_audience is not null then
      select pg_catalog.count(*)::integer into derived_count
        from platform_private.cms_related_derived_candidates(
               p_entry_id, source_locale, source_audience, p_rule_key, p_rule_bound, p_exclusions, p_pins);
    end if;
  end if;
  return least(128, pg_catalog.cardinality(p_pins) + derived_count);
end;
$body$;

comment on function platform_private.cms_related_rules_replace(uuid, uuid, uuid, timestamptz, uuid[], uuid[], text, bigint, integer) is
  'CMS-03C-05: replaces the whole related-content rule set of one source by appending revoked and active rows (never updating one). Private; callers hold the entry lock.';
comment on function platform_private.cms_related_eligible_count(uuid, uuid[], uuid[], text, integer) is
  'CMS-03C-05: the write-time eligibleCount, min(128, pins + derived candidates for the source draft revision locale and the audience of its most recent active publication). Private; STABLE.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_related_rules_replace(uuid, uuid, uuid, timestamptz, uuid[], uuid[], text, bigint, integer)
  owner to wejammin_cms_definer;
alter function platform_private.cms_related_eligible_count(uuid, uuid[], uuid[], text, integer)
  owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_related_rules_replace(uuid, uuid, uuid, timestamptz, uuid[], uuid[], text, bigint, integer)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_related_eligible_count(uuid, uuid[], uuid[], text, integer)
  from public, anon, authenticated, service_role;

commit;
