-- Slice 12 lane locale, the provider body of cms.locale.no_fallback_gate version 1 (BE03c Locale preflight
-- provider 1391, Preflight providers registered by Slice 12 1397; BE03b Publication preflight registry
-- 1811-1818; tracker P2-S12-AC-051, AC-052, AC-152, AC-240): the `locale` category of the publication
-- preflight.
--
-- cms_locale_no_fallback_gate(revision, phase) evaluates EVERY active no_fallback field of the revision's
-- schema version for the revision's locale in ONE statement (the shared resolver core, with the revision
-- itself as the target locale's own revision), then:
--   * any blocking resolution fails the category: reason no_fallback_missing when a field has no value in
--     the locale, otherwise no_fallback_stale; blockingCount is the number of blocking fields (DEC-121:
--     a no_fallback field is never resolved through fallbackChains, so a locale that lacks it is blocked);
--   * otherwise a revision that IS a locale variant (a cms_locale_variants row names it) fails with
--     locale_variant_not_approved unless its 03b effective state (E2) is approved, scheduled or
--     published (DEC-192, owner-ratified).  This check applies in the phases schedule, publish and
--     execute: at submit the revision must be an effective draft (CMS-03B-05), so applying it there
--     would make a locale revision unsubmittable and the check is never applied at submit.  At execute
--     the effective state is scheduled by construction (CMS-03B-20); the check is defense in depth only
--     and `scheduled` is admitted so a revision with a pending, executing or failed_retryable publish
--     schedule passes (the derived variant state, 050400, already shows scheduled as approved);
--   * otherwise the category passes.
-- A revision of the source locale has no variant row, needs no approval check and is judged on its own
-- no_fallback values.  Returns one row (outcome passed|failed, reason_code, blocking_count).  Private,
-- STABLE, SECURITY DEFINER owned by the CMS definer (SEC-2); the evaluator calls it under the CMS RPC
-- context.  Forward-only.
begin;
set local lock_timeout = '5s';

create function platform_private.cms_locale_no_fallback_gate(p_revision_id uuid, p_phase text)
returns table(outcome text, reason_code text, blocking_count integer)
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  revision_row platform_private.cms_entry_revisions%rowtype;
  missing_count integer;
  stale_count integer;
begin
  if p_revision_id is null or p_phase is null
     or p_phase not in ('submit', 'schedule', 'publish', 'execute') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  select revision.* into revision_row
    from platform_private.cms_entry_revisions revision
   where revision.id = p_revision_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  select (pg_catalog.count(*) filter (where resolved.resolution ->> 'reasonCode' = 'no_fallback_missing'))::integer,
         (pg_catalog.count(*) filter (where resolved.resolution ->> 'reasonCode' = 'no_fallback_stale'))::integer
    into missing_count, stale_count
    from platform_private.cms_locale_resolutions(
           revision_row.entry_id, revision_row.locale, revision_row.schema_version_id,
           (select pg_catalog.array_agg(definition.stable_field_id order by definition.stable_field_id)
              from platform_private.cms_field_definition_versions definition
             where definition.content_type_version_id = revision_row.schema_version_id
               and definition.state = 'active'
               and definition.localization_mode = 'no_fallback'),
           revision_row.id) resolved;

  if missing_count > 0 then
    return query select 'failed'::text, 'no_fallback_missing'::text, missing_count + stale_count;
  elsif stale_count > 0 then
    return query select 'failed'::text, 'no_fallback_stale'::text, stale_count;
  elsif p_phase in ('schedule', 'publish', 'execute')
        and exists (select 1 from platform_private.cms_locale_variants variant
                     where variant.revision_id = revision_row.id)
        and platform_private.cms_revision_effective_state(revision_row.id) not in ('approved', 'scheduled', 'published') then
    return query select 'failed'::text, 'locale_variant_not_approved'::text, 1;
  else
    return query select 'passed'::text, null::text, 0;
  end if;
end;
$body$;

comment on function platform_private.cms_locale_no_fallback_gate(uuid, text) is
  'cms.locale.no_fallback_gate v1 (DEC-121, DEC-138): evaluates every active no_fallback field of the revision schema for the revision locale in one statement (no_fallback_missing, no_fallback_stale) and, in the schedule, publish and execute phases (never submit), requires a locale variant revision to be in effective state approved, scheduled or published (locale_variant_not_approved; DEC-192). Private; STABLE; callers run under the CMS RPC context.';

grant select on table
  platform_private.cms_entry_revisions,
  platform_private.cms_field_definition_versions,
  platform_private.cms_locale_variants
  to wejammin_cms_definer;

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_locale_no_fallback_gate(uuid, text) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_locale_no_fallback_gate(uuid, text)
  from public, anon, authenticated, service_role;

commit;
