-- Slice 12 lane locale, derived locale variant state (BE03c Derived variant state 1393, State machine 1541;
-- tracker P2-S12-AC-234): the browser LocaleVariantState of one (entry, locale).
--
-- Only `draft` and `stale` are stored.  The state shown is derived, first match wins:
--   untranslated  no variant row exists for the locale;
--   stale         the latest row of the locale is `stale` (a source change appended it);
--   review        the latest row is a draft whose revision has the 03b effective state `submitted`;
--   approved      ... whose revision has the effective state `approved`, `scheduled` or `published`
--                 (a scheduled revision is an approved one with a pending publication);
--   draft         otherwise (no review, a rejected or an invalidated review).
-- Explicit revalidation appends a new draft row, which returns to `approved` only through the
-- editorial review of the new revision.  Private, STABLE, SECURITY DEFINER owned by the CMS definer
-- (SEC-2); callers run under the CMS RPC context.  Forward-only.
begin;
set local lock_timeout = '5s';

create function platform_private.cms_locale_variant_state(p_entry_id uuid, p_locale text)
returns text
language sql
stable
security definer
set search_path = ''
as $body$
  select case
           when latest.id is null then 'untranslated'
           when latest.state = 'stale' then 'stale'
           else case platform_private.cms_revision_effective_state(latest.revision_id)
                  when 'submitted' then 'review'
                  when 'approved' then 'approved'
                  when 'scheduled' then 'approved'
                  when 'published' then 'approved'
                  else 'draft'
                end
         end
    from (select 1) anchor
    left join lateral (
      select variant.id, variant.state, variant.revision_id
        from platform_private.cms_locale_variants variant
       where variant.entry_id = p_entry_id
         and pg_catalog.lower(variant.locale) = pg_catalog.lower(p_locale)
       order by variant.version desc, variant.created_at desc, variant.id desc
       limit 1
    ) latest on true
$body$;

comment on function platform_private.cms_locale_variant_state(uuid, text) is
  'D12: the derived LocaleVariantState of (entry, locale): untranslated, stale, review, approved or draft (only draft and stale are stored). Private; STABLE; callers run under the CMS RPC context.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_locale_variant_state(uuid, text) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_locale_variant_state(uuid, text)
  from public, anon, authenticated, service_role;

commit;
