-- Slice 12 lane related, CMS-03C-05 persistence delta (BE03c RelatedContentRule row 1432, Derived rules (OD-5)
-- 1383; tracker P2-S12-AC-228, AC-229, AC-261):
--
--   cms_related_rule_valid(key, version)   the code-owned registry CMS_RELATED_RULES: shared-terms and
--       same-type-recent, both at version 1.  IMMUTABLE, it backs a CHECK.
--   cms_related_rule_reason(key)           the registry reason of a member (shared_terms, same_type_recent);
--       NULL for a non-member.  The column reason_code keeps its upper-case storage grammar
--       (^[A-Z][A-Z0-9_]{0,63}$): a derived row stores upper(reason), the projection lower-cases it again.
--   max_candidates integer                 the derived rule's bound, 1..128 (BE03c 1383 "at most maxCandidates
--       derived candidates are used"; the row definition at 1432 omits the column).  Required on derived rows,
--       absent on pin and exclude rows.
--   CHECKs                                a derived row selects a registered rule and its registry reason; pin
--       and exclude rows select none; a pin carries the position its array index gave it.
--
-- The table has no writer before this slice (cms_curate_related_content is added here), so it holds no row and
-- the constraints validate trivially.  The CMS definer receives exactly the privileges the command needs:
-- INSERT and SELECT on the append-only rules and SELECT on the term assignments the ranking reads.
-- Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create function platform_private.cms_related_rule_valid(p_key text, p_version bigint)
returns boolean
language sql
immutable
set search_path = ''
as $body$
  select coalesce(p_key is not null and p_version is not null and exists (
    select 1
      from (values ('shared-terms'::text, 1::bigint), ('same-type-recent'::text, 1::bigint)) member(rule_key, rule_version)
     where member.rule_key = p_key and member.rule_version = p_version), false)
$body$;

create function platform_private.cms_related_rule_reason(p_key text)
returns text
language sql
immutable
set search_path = ''
as $body$
  select case p_key
           when 'shared-terms' then 'shared_terms'
           when 'same-type-recent' then 'same_type_recent'
         end
$body$;

comment on function platform_private.cms_related_rule_valid(text, bigint) is
  'BE03c OD-5: true for a member of the code-owned rule registry CMS_RELATED_RULES (shared-terms, same-type-recent) at its registered version 1. Private; IMMUTABLE.';
comment on function platform_private.cms_related_rule_reason(text) is
  'BE03c OD-5: the registry reason of a derived rule (shared_terms, same_type_recent), NULL for a non-member. Private; IMMUTABLE.';

revoke all on function platform_private.cms_related_rule_valid(text, bigint)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_related_rule_reason(text)
  from public, anon, authenticated, service_role;
grant execute on function platform_private.cms_related_rule_valid(text, bigint) to wejammin_cms_definer;
grant execute on function platform_private.cms_related_rule_reason(text) to wejammin_cms_definer;

alter table platform_private.cms_related_content_rules
  add column max_candidates integer;

alter table platform_private.cms_related_content_rules
  add constraint cms_related_content_rules_rule_registry_check
    check (rule_key is null or platform_private.cms_related_rule_valid(rule_key, rule_version)),
  add constraint cms_related_content_rules_derived_rule_check
    check ((mode = 'derived') = (rule_key is not null)),
  add constraint cms_related_content_rules_derived_reason_check
    check (mode <> 'derived'
           or reason_code = pg_catalog.upper(platform_private.cms_related_rule_reason(rule_key))),
  add constraint cms_related_content_rules_max_candidates_check
    check ((mode = 'derived') = (max_candidates is not null)
           and (max_candidates is null or max_candidates between 1 and 128)),
  add constraint cms_related_content_rules_pin_position_check
    check (mode <> 'pin' or position is not null);

comment on column platform_private.cms_related_content_rules.max_candidates is
  'BE03c 1383: the derivedRule.maxCandidates bound (1..128) of a derived row; NULL on pin and exclude rows.';

grant insert, select on table platform_private.cms_related_content_rules to wejammin_cms_definer;
grant select on table platform_private.cms_term_assignments to wejammin_cms_definer;

commit;
